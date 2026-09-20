"""Samples several candidate interfaces per training scenario (tree format, constrained).

    uv run python -m polyxd_model.candidates --model mlx-community/gemma-4-e4b-it-4bit --samples 4
Output: model/data/candidates/<model>/<scenario-id>.json  (then: node packages/verifier/scripts/select-candidates.ts)
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from mlx_lm import load

from .generate import run_one
from .prompt import REPO, user_prompt

DATA = REPO / "model" / "data"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="mlx-community/gemma-4-e4b-it-4bit")
    ap.add_argument("--samples", type=int, default=4)
    ap.add_argument("--temp", type=float, default=0.7)
    ap.add_argument("--limit", type=int)
    ap.add_argument("--adapter", help="LoRA adapter to generate with (a later round of expert iteration)")
    ap.add_argument("--out", help="output directory (default: model/data/candidates/<model>)")
    args = ap.parse_args()

    scenarios = [json.loads(l) for l in (DATA / "scenarios.jsonl").read_text().splitlines() if l.strip()]
    if args.limit:
        scenarios = scenarios[: args.limit]
    out = Path(args.out) if args.out else DATA / "candidates" / args.model.split("/")[-1]
    out.mkdir(parents=True, exist_ok=True)
    model, tokenizer = load(args.model, adapter_path=args.adapter) if args.adapter else load(args.model)
    for sc in scenarios:
        path = out / f"{sc['id']}.json"
        if path.exists():
            continue
        user = user_prompt(sc)
        # One greedy sample plus temperature samples: diversity for selection, with a sane default included.
        samples = [run_one(model, tokenizer, user, 3500, True, "tree", 0.0)]
        samples += [run_one(model, tokenizer, user, 3500, True, "tree", args.temp) for _ in range(args.samples - 1)]
        path.write_text(json.dumps({"scenario": sc, "user": user, "samples": [{"doc": s["doc"], "total_s": s["total_s"]} for s in samples]}, ensure_ascii=False))
        print(f"{sc['id']}  {sum(1 for s in samples if s['doc'])}/{len(samples)} parsed  {sc['request'][:60]}", flush=True)


if __name__ == "__main__":
    main()
