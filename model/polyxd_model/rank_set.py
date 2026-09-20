"""Builds a ranking set: three of the model's own options for each of a few benchmark requests.

The hand-made gold set (bench/gold) measures whether the verifier agrees with a designer about
interfaces we wrote. This measures something else: whether the model's own first options are any
good, and which of three a designer would ship. The ranking doubles as preference data.

    uv run python -m polyxd_model.rank_set --adapter adapters/sft-v3 --samples 3

Output: bench/rank-set/<request-id>-{a,b,c}.json plus ranking.json for the ranking page.
"""

from __future__ import annotations

import argparse
import json
import random

from mlx_lm import load

from .generate import run_one
from .prompt import BENCH, REPO, user_prompt

# A spread of domains and kinds, including the dense B2B work the spec just gained.
DEFAULT_REQUESTS = [
    "money-send-alex",
    "money-spending-month",
    "tasks-add-passport",
    "tasks-delete-project",
    "shop-compare-plans",
    "calendar-find-slot",
    "settings-stop-emails",
    "personal-reading-list",
    "b2b-accounts-past-due",
    "b2b-cancel-subscription",
    "b2b-overdue-money",
    "b2b-invite-teammate",
]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="mlx-community/gemma-4-e4b-it-4bit")
    ap.add_argument("--adapter", help="LoRA adapter to generate with")
    ap.add_argument("--samples", type=int, default=3)
    ap.add_argument("--temp", type=float, default=0.8)
    ap.add_argument("--only", help="comma-separated request ids (default: a fixed spread)")
    ap.add_argument("--seed", type=int, default=11)
    args = ap.parse_args()

    random.seed(args.seed)
    requests = {r["id"]: r for r in json.loads((BENCH / "requests.json").read_text())["requests"]}
    b2b = BENCH / "requests-b2b.json"
    if b2b.exists():
        requests.update({r["id"]: r for r in json.loads(b2b.read_text())["requests"]})
    wanted = args.only.split(",") if args.only else DEFAULT_REQUESTS
    chosen = [requests[i] for i in wanted if i in requests]
    missing = [i for i in wanted if i not in requests]
    if missing:
        print(f"not in the benchmark, skipped: {', '.join(missing)}")

    out = BENCH / "rank-set"
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.json"):
        if old.name != "ranking.json":
            old.unlink()

    model, tokenizer = load(args.model, adapter_path=args.adapter) if args.adapter else load(args.model)
    groups = []
    for req in chosen:
        user = user_prompt(req)
        docs, seen = [], set()
        # One greedy option (what the model would do by default), then sampled alternatives.
        for i in range(args.samples * 3):
            if len(docs) == args.samples:
                break
            r = run_one(model, tokenizer, user, 3500, True, "tree", 0.0 if i == 0 else args.temp)
            doc = r.get("doc")
            if not doc:
                continue
            key = json.dumps(doc, sort_keys=True)
            if key in seen:
                continue
            seen.add(key)
            docs.append(doc)
        if len(docs) < 2:
            print(f"{req['id']}: only {len(docs)} distinct option(s), skipped")
            continue
        names = []
        for doc, letter in zip(docs, "abc"):
            doc.setdefault("data", req.get("data", {}))
            name = f"{req['id']}-{letter}"
            (out / f"{name}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
            names.append(name)
        groups.append({"id": req["id"], "request": req["request"], "variants": names, "humanRank": None})
        print(f"{req['id']}: {len(names)} options")

    (out / "ranking.json").write_text(
        json.dumps(
            {
                "$comment": "The model's own options, ranked by a designer. Best to worst in humanRank.",
                "rater": "",
                "model": f"{args.model}{'+' + args.adapter.split('/')[-1] if args.adapter else ''}",
                "generatedAt": __import__("datetime").date.today().isoformat(),
                "groups": groups,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )
    print(f"{len(groups)} groups → {out}")


if __name__ == "__main__":
    main()
