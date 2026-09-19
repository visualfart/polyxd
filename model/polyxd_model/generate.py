"""Runs a local MLX model on the benchmark and records raw outputs with timing.

    uv run python -m polyxd_model.generate --model mlx-community/Qwen3.5-4B-4bit
    uv run python -m polyxd_model.generate --model ... --only money-freeze-card,tasks-add-quick
    uv run python -m polyxd_model.generate --model ... --sequences      # multi-turn consistency, with memory

Outputs go to model/runs/<model-name>/<id>.json; score them with the verifier:
    npm run score -w @polyxd/verifier -- model/runs/<model-name>
"""

from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path

from mlx_lm import load, stream_generate
from mlx_lm.sample_utils import make_sampler

from .prompt import BENCH, REPO, system_prompt, user_prompt

RUNS = REPO / "model" / "runs"


def extract_json(text: str) -> tuple[dict | None, str | None]:
    """The first complete top-level JSON object in the text (models sometimes add fences or prose)."""
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S)
    start = text.find("{")
    if start < 0:
        return None, "no JSON object in output"
    depth, in_str, esc = 0, False, False
    for i, ch in enumerate(text[start:], start):
        if in_str:
            esc = (ch == "\\") and not esc
            if ch == '"' and not esc:
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start : i + 1]), None
                except json.JSONDecodeError as e:
                    return None, f"invalid JSON: {e}"
    return None, "unterminated JSON (output cut off?)"


def chat(tokenizer, user: str) -> str:
    messages = [{"role": "system", "content": system_prompt()}, {"role": "user", "content": user}]
    try:
        return tokenizer.apply_chat_template(messages, add_generation_prompt=True, tokenize=False, enable_thinking=False)
    except TypeError:
        return tokenizer.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)


_constrained = {}


def run_constrained(model, tokenizer, user: str, max_tokens: int) -> dict:
    """JSON-schema-constrained decoding via Outlines: every token must keep the output schema-valid."""
    import outlines
    from outlines.types import JsonSchema

    if "gen" not in _constrained:
        schema = (REPO / "packages" / "spec" / "schema" / "ui.schema.json").read_text()
        _constrained["gen"] = outlines.Generator(outlines.from_mlxlm(model, tokenizer), JsonSchema(schema))
    prompt = chat(tokenizer, user)
    start = time.perf_counter()
    raw = _constrained["gen"](prompt, max_tokens=max_tokens)
    total = time.perf_counter() - start
    doc, error = extract_json(raw)
    tokens = len(tokenizer.encode(raw))
    return {"raw": raw, "doc": doc, "error": error, "ttft_s": None, "total_s": round(total, 3), "prompt_tokens": None, "generation_tokens": tokens, "generation_tps": round(tokens / total, 1) if total else 0, "prompt_tps": None}


def run_one(model, tokenizer, user: str, max_tokens: int, constrained: bool = False) -> dict:
    if constrained:
        return run_constrained(model, tokenizer, user, max_tokens)
    prompt = chat(tokenizer, user)
    sampler = make_sampler(temp=0.0)
    out, ttft, last = [], None, None
    start = time.perf_counter()
    for resp in stream_generate(model, tokenizer, prompt, max_tokens=max_tokens, sampler=sampler):
        if ttft is None:
            ttft = time.perf_counter() - start
        out.append(resp.text)
        last = resp
    total = time.perf_counter() - start
    raw = "".join(out)
    doc, error = extract_json(raw)
    return {
        "raw": raw,
        "doc": doc,
        "error": error,
        "ttft_s": round(ttft or 0, 3),
        "total_s": round(total, 3),
        "prompt_tokens": getattr(last, "prompt_tokens", None),
        "generation_tokens": getattr(last, "generation_tokens", None),
        "generation_tps": round(getattr(last, "generation_tps", 0) or 0, 1),
        "prompt_tps": round(getattr(last, "prompt_tps", 0) or 0, 1),
    }


def memory_of(doc: dict | None) -> str | None:
    """Interface memory as the host would keep it: keyed components in order, with type and label."""
    if not doc or not isinstance(doc.get("components"), list):
        return None
    lines = []
    for c in doc["components"]:
        if isinstance(c, dict) and c.get("key"):
            label = c.get("label") or c.get("title") or ""
            lines.append(f'- key "{c["key"]}": {c.get("component")}' + (f' labelled "{label}"' if isinstance(label, str) and label else ""))
    pattern = (doc.get("surface") or {}).get("pattern")
    return "\n".join(([f"pattern: {pattern}"] if pattern else []) + lines) or None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--name", help="run folder name (default: model name)")
    ap.add_argument("--only", help="comma-separated request ids")
    ap.add_argument("--sequences", action="store_true", help="run the multi-turn sequences with interface memory")
    ap.add_argument("--no-memory", action="store_true", help="with --sequences: don't give the model its previous output")
    ap.add_argument("--max-tokens", type=int, default=3500)
    ap.add_argument("--constrained", action="store_true", help="JSON-schema-constrained decoding (Outlines)")
    args = ap.parse_args()

    name = (args.name or args.model.split("/")[-1]) + ("-constrained" if args.constrained else "")
    out_dir = RUNS / name / ("sequences" + ("-nomem" if args.no_memory else "") if args.sequences else "requests")
    out_dir.mkdir(parents=True, exist_ok=True)
    model, tokenizer = load(args.model)
    print(f"loaded {args.model} → {out_dir}")

    if not args.sequences:
        requests = json.loads((BENCH / "requests.json").read_text())["requests"]
        if args.only:
            keep = set(args.only.split(","))
            requests = [r for r in requests if r["id"] in keep]
        for r in requests:
            res = run_one(model, tokenizer, user_prompt(r), args.max_tokens, args.constrained)
            (out_dir / f"{r['id']}.json").write_text(json.dumps({"id": r["id"], "model": args.model, **res}, indent=2, ensure_ascii=False))
            status = "ok " if res["doc"] else "ERR"
            print(f"{status} {r['id']:<34} {res['total_s']:6.1f}s  ttft {res['ttft_s'] or 0:.2f}s  {res['generation_tps']:5.1f} tok/s  {res['error'] or ''}", flush=True)
        return

    sequences = json.loads((BENCH / "sequences.json").read_text())["sequences"]
    for seq in sequences:
        previous_doc, previous_data = None, None
        turns = []
        for i, turn in enumerate(seq["turns"]):
            data = previous_data if turn.get("data") == "same" else turn.get("data", {})
            request = {"request": turn["request"], "intent": seq["intent"], "capabilities": seq.get("capabilities", []), "data": data, "direction": seq.get("direction")}
            memory = None if args.no_memory else memory_of(previous_doc)
            if seq.get("keys") and not args.no_memory and i == 0:
                memory = "Use these keys: " + "; ".join(f"{k} = {v}" for k, v in seq["keys"].items())
            res = run_one(model, tokenizer, user_prompt(request, memory), args.max_tokens, args.constrained)
            turns.append({"turn": i, "request": turn["request"], "data": data, **res})
            previous_doc, previous_data = res["doc"], data
            print(f"{'ok ' if res['doc'] else 'ERR'} {seq['id']} turn {i}  {res['total_s']:.1f}s")
        (out_dir / f"{seq['id']}.json").write_text(json.dumps({"id": seq["id"], "model": args.model, "turns": turns}, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
