"""Builds the fine-tuning dataset from verifier-selected examples and prints the MLX LoRA command.

    uv run python -m polyxd_model.sft build            # data/selected.jsonl → data/sft/{train,valid}.jsonl
    uv run python -m polyxd_model.sft train --model mlx-community/gemma-4-e4b-it-4bit --iters 600
"""

from __future__ import annotations

import argparse
import json
import random
import subprocess
import sys

from .prompt import REPO, system_prompt

DATA = REPO / "model" / "data"
ADAPTERS = REPO / "model" / "adapters"


def build(valid_fraction: float = 0.1, seed: int = 7) -> None:
    rows = [json.loads(l) for l in (DATA / "selected.jsonl").read_text().splitlines() if l.strip()]
    random.Random(seed).shuffle(rows)
    n_valid = max(1, int(len(rows) * valid_fraction))
    out = DATA / "sft"
    out.mkdir(parents=True, exist_ok=True)
    system = system_prompt("tree")
    for name, part in (("valid", rows[:n_valid]), ("train", rows[n_valid:])):
        with (out / f"{name}.jsonl").open("w") as f:
            for r in part:
                messages = [{"role": "system", "content": system}, {"role": "user", "content": r["user"]}, {"role": "assistant", "content": r["assistant"]}]
                f.write(json.dumps({"messages": messages}, ensure_ascii=False) + "\n")
    print(f"train {len(rows) - n_valid}, valid {n_valid} → {out}")


def train(model: str, iters: int, name: str | None) -> None:
    adapter = ADAPTERS / (name or model.split("/")[-1])
    cmd = [
        sys.executable, "-m", "mlx_lm", "lora",
        "--model", model,
        "--train",
        "--data", str(DATA / "sft"),
        "--adapter-path", str(adapter),
        "--iters", str(iters),
        "--batch-size", "1",
        "--num-layers", "16",
        "--learning-rate", "1e-4",
        "--max-seq-length", "8192",
        "--mask-prompt",
        "--grad-checkpoint",
        "--steps-per-eval", "100",
        "--save-every", "100",
    ]
    print(" ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("step", choices=["build", "train"])
    ap.add_argument("--model", default="mlx-community/gemma-4-e4b-it-4bit")
    ap.add_argument("--iters", type=int, default=600)
    ap.add_argument("--name")
    a = ap.parse_args()
    build() if a.step == "build" else train(a.model, a.iters, a.name)
