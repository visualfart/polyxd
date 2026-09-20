"""Preference training on a designer's rankings (decision 0003, step 2).

    uv run python -m polyxd_model.dpo build                          rankings → data/dpo/pairs.jsonl
    uv run python -m polyxd_model.dpo train --reference adapters/sft-v3 --iters 200

mlx-lm ships supervised LoRA and distillation losses and no preference trainer, so the loss is
here. It is the standard DPO objective:

    L = -log sigmoid( beta * [ (logp(chosen) - logp_ref(chosen)) - (logp(rejected) - logp_ref(rejected)) ] )

with two things specific to this project.

**Pairs carry weights.** A designer ranked three options per request, and a re-rank of six groups
showed which of those preferences he reproduces: best-versus-worst survived in 5 of 6 groups, the
adjacent pairs in 10 of 12, and both groups he re-ordered were groups where independent model
judges had also called the candidates near-identical. A pair a rater reverses is not a mistake,
it is a report that the pair carries no preference — so a pair's weight is the distance between
its members in the ranking, and a pair contradicted by a re-rank is dropped.

**The reference is frozen, so its log-probabilities are computed once.** The reference model is the
SFT adapter the candidates were sampled from. Caching that pass keeps one model in memory instead
of two, which matters on a 24 GB machine.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import random

import mlx.core as mx
import mlx.nn as nn
import mlx.optimizers as optim
from mlx.utils import tree_flatten
from mlx_lm import load
from mlx_lm.tuner import linear_to_lora_layers
from mlx_lm.tuner.trainer import grad_checkpoint
from mlx_lm.tuner.utils import load_adapters

from .prompt import BENCH, REPO, system_prompt, user_prompt

DATA = REPO / "model" / "data"
ADAPTERS = REPO / "model" / "adapters"
RANKINGS = BENCH / "rankings"


# ---------- Pairs ----------


def _requests() -> dict:
    out = {}
    for name in ("requests.json", "requests-b2b.json"):
        path = BENCH / name
        if path.exists():
            out.update({r["id"]: r for r in json.loads(path.read_text())["requests"]})
    return out


def _rounds() -> list[dict]:
    """Every archived ranking, plus whatever is in bench/rank-set if it has been ranked."""
    out = []
    for path in sorted(RANKINGS.glob("*/ranking.json")):
        out.append(json.loads(path.read_text()) | {"dir": path.parent})
    current = BENCH / "rank-set" / "ranking.json"
    if current.exists():
        parsed = json.loads(current.read_text())
        # A re-rank is a second sitting on groups already counted; it contributes by dropping the
        # pairs it reverses, not by supplying the same preferences twice under shuffled names.
        if parsed.get("model") != "re-rank" and any(g.get("humanRank") for g in parsed.get("groups", [])):
            out.append(parsed | {"dir": current.parent})
    return out


def build(min_weight: int = 1) -> None:
    """Writes one line per preference pair: the prompt, the two documents, and what the pair is worth."""
    requests = _requests()
    rounds = _rounds()

    # A re-rank is a second sitting on groups already ranked. Where the two sittings disagree about
    # a pair, that pair is dropped: the rater is telling us the two options are interchangeable.
    key_path = RANKINGS / "rerank-key.json"
    reversed_pairs: set[tuple[str, str]] = set()
    if key_path.exists():
        key = json.loads(key_path.read_text())
        current = BENCH / "rank-set" / "ranking.json"
        again = {g["id"]: g for g in json.loads(current.read_text())["groups"]} if current.exists() else {}
        for k in key:
            group = again.get(k["id"])
            if not group or not group.get("humanRank"):
                continue
            order = [k["letters"].get(name, name) for name in group["humanRank"]]
            for i, better in enumerate(k["earlier"]):
                for worse in k["earlier"][i + 1 :]:
                    if order.index(better) > order.index(worse):
                        reversed_pairs.add((better, worse))

    rows, dropped = [], 0
    system = system_prompt("tree")
    for round_ in rounds:
        for group in round_["groups"]:
            rank = group.get("humanRank") or []
            if len(rank) < 2:
                continue
            request = requests.get(group["id"])
            if not request:
                continue
            docs = {}
            for variant in group["variants"]:
                path = Path(round_["dir"]) / f"{variant}.json"
                if path.exists():
                    docs[variant] = json.loads(path.read_text())
            for i, better in enumerate(rank):
                for j in range(i + 1, len(rank)):
                    worse = rank[j]
                    if better not in docs or worse not in docs:
                        continue
                    if (better, worse) in reversed_pairs:
                        dropped += 1
                        continue
                    # Distance in the ranking: first-versus-last is the preference the rater
                    # reproduces, first-versus-second is the one he sometimes reverses.
                    weight = j - i
                    if weight < min_weight:
                        continue
                    rows.append(
                        {
                            "id": group["id"],
                            "prompt": user_prompt(request),
                            "chosen": json.dumps(docs[better], ensure_ascii=False),
                            "rejected": json.dumps(docs[worse], ensure_ascii=False),
                            "weight": weight,
                        }
                    )

    out = DATA / "dpo"
    out.mkdir(parents=True, exist_ok=True)
    (out / "system.txt").write_text(system)
    with (out / "pairs.jsonl").open("w") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    by_weight = {w: sum(1 for r in rows if r["weight"] == w) for w in sorted({r["weight"] for r in rows})}
    print(f"{len(rows)} pairs from {len(rounds)} rounds → {out / 'pairs.jsonl'}")
    print(f"  by weight: {by_weight}" + (f"; {dropped} dropped as reversed on a re-rank" if dropped else ""))


# ---------- Training ----------


def _sequence(tokenizer, system: str, prompt: str, answer: str) -> tuple[list[int], int]:
    """The full chat sequence, and where the answer starts, so only the answer is scored."""
    messages = [{"role": "system", "content": system}, {"role": "user", "content": prompt}]
    # Depending on the tokenizer, a chat template returns ids, a mapping, or a nested batch.
    head = tokenizer.apply_chat_template(messages, add_generation_prompt=True, tokenize=True)
    if hasattr(head, "input_ids"):
        head = head.input_ids
    if head and isinstance(head[0], list):
        head = head[0]
    head = list(head)
    full = head + list(tokenizer.encode(answer, add_special_tokens=False)) + [tokenizer.eos_token_id]
    return full, len(head)


def _logp(model, tokens: mx.array, start: int) -> mx.array:
    """
    Sum of log-probabilities of the answer tokens under `model`.

    Only the answer is scored, and the slice happens before the softmax rather than after. The
    prompt here is the whole system prompt plus the request — a few thousand tokens against a
    262k vocabulary — so normalising the full sequence in float32 would cost gigabytes for
    positions whose values are then multiplied by zero.
    """
    logits = model(tokens[None, :-1])
    first = max(start - 1, 0)
    answer = logits[0, first:].astype(mx.float32)
    targets = tokens[1:][first:]
    logprobs = answer - mx.logsumexp(answer, axis=-1, keepdims=True)
    return mx.take_along_axis(logprobs, targets[:, None], axis=-1).sum()


def train(model_name: str, reference: str, name: str, iters: int, beta: float, lr: float, layers: int, seed: int, limit: int | None = None) -> None:
    pairs = [json.loads(l) for l in (DATA / "dpo" / "pairs.jsonl").read_text().splitlines() if l.strip()]
    if limit:
        pairs = pairs[:limit]
    if not pairs:
        raise SystemExit("no pairs; run `dpo build` first")
    system = (DATA / "dpo" / "system.txt").read_text()
    random.Random(seed).shuffle(pairs)

    lora_config = {"rank": 8, "scale": 20.0, "dropout": 0.0, "keys": None}

    # Pass one: the reference. It is frozen, so every pair's reference log-probabilities are
    # computed once and the model is then thrown away rather than held alongside the policy.
    print(f"reference pass with {reference} over {len(pairs)} pairs", flush=True)
    model, tokenizer = load(model_name, adapter_path=reference or None)
    model.freeze()
    encoded = []
    for i, pair in enumerate(pairs):
        chosen, chosen_start = _sequence(tokenizer, system, pair["prompt"], pair["chosen"])
        rejected, rejected_start = _sequence(tokenizer, system, pair["prompt"], pair["rejected"])
        ref_chosen = _logp(model, mx.array(chosen), chosen_start)
        ref_rejected = _logp(model, mx.array(rejected), rejected_start)
        mx.eval(ref_chosen, ref_rejected)
        encoded.append(
            {
                "chosen": chosen,
                "chosen_start": chosen_start,
                "rejected": rejected,
                "rejected_start": rejected_start,
                "ref_chosen": float(ref_chosen),
                "ref_rejected": float(ref_rejected),
                "weight": float(pair["weight"]),
            }
        )
        if (i + 1) % 10 == 0:
            print(f"  {i + 1}/{len(pairs)}", flush=True)
    del model
    mx.clear_cache()

    # Pass two: the policy, starting from the same adapter, with its LoRA layers trainable.
    model, _ = load(model_name)
    model.freeze()
    linear_to_lora_layers(model, layers, lora_config)
    # Starting the policy from the reference's weights, when there is one: DPO moves a model away
    # from where it already is, and starting anywhere else would be training two things at once.
    if reference:
        load_adapters(model, reference)
    # Two forwards per step, each over a few thousand tokens: trade compute for memory the way the
    # supervised trainer does.
    for layer in model.layers[max(0, len(model.layers) - layers) :]:
        grad_checkpoint(layer)
    trainable = [(n, p) for n, p in tree_flatten(model.trainable_parameters()) if p.size > 0]
    print(f"policy: {sum(p.size for _, p in trainable) / 1e6:.2f}M trainable parameters", flush=True)

    def loss_fn(model, item):
        chosen = _logp(model, mx.array(item["chosen"]), item["chosen_start"])
        rejected = _logp(model, mx.array(item["rejected"]), item["rejected_start"])
        # How much more the policy prefers the chosen answer than the reference did.
        margin = (chosen - item["ref_chosen"]) - (rejected - item["ref_rejected"])
        return -item["weight"] * nn.log_sigmoid(beta * margin)

    optimizer = optim.Adam(learning_rate=lr)
    step = nn.value_and_grad(model, loss_fn)
    adapter_dir = ADAPTERS / name
    adapter_dir.mkdir(parents=True, exist_ok=True)
    (adapter_dir / "adapter_config.json").write_text(json.dumps({"fine_tune_type": "lora", "num_layers": layers, "lora_parameters": lora_config}, indent=2))

    window: list[float] = []
    for it in range(1, iters + 1):
        item = encoded[(it - 1) % len(encoded)]
        loss, grads = step(model, item)
        optimizer.update(model, grads)
        mx.eval(model.parameters(), optimizer.state, loss)
        window.append(float(loss))
        if it % 10 == 0 or it == 1:
            mean = sum(window) / len(window)
            # A pair is "won" when the policy has moved it past the reference at all.
            print(f"iter {it}: loss {mean:.4f}  (chance is {-math.log(0.5):.4f})", flush=True)
            window = []
        if it % 50 == 0 or it == iters:
            mx.save_safetensors(str(adapter_dir / "adapters.safetensors"), dict(tree_flatten(model.trainable_parameters())))
    print(f"saved {adapter_dir}", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="command", required=True)

    b = sub.add_parser("build", help="rankings → preference pairs")
    b.add_argument("--min-weight", type=int, default=1, help="2 keeps only best-versus-worst pairs")

    t = sub.add_parser("train", help="train a LoRA adapter on the pairs")
    t.add_argument("--model", default="mlx-community/gemma-4-e4b-it-4bit")
    t.add_argument("--reference", default="adapters/sft-v3", help="the adapter the candidates were sampled from; empty means the base model")
    t.add_argument("--limit", type=int, help="use only the first N pairs (for a smoke test)")
    t.add_argument("--name", default="dpo-1")
    t.add_argument("--iters", type=int, default=200)
    t.add_argument("--beta", type=float, default=0.1)
    t.add_argument("--learning-rate", type=float, default=1e-5)
    t.add_argument("--num-layers", type=int, default=16)
    t.add_argument("--seed", type=int, default=7)

    args = ap.parse_args()
    if args.command == "build":
        build(args.min_weight)
    else:
        train(args.model, args.reference, args.name, args.iters, args.beta, args.learning_rate, args.num_layers, args.seed, args.limit)


if __name__ == "__main__":
    main()
