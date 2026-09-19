#!/bin/zsh
# Phase 4: run each baseline model on the benchmark (typed tree grammar, constrained) and score it.
cd "$(dirname "$0")"
for m in mlx-community/Qwen3.5-4B-4bit mlx-community/Qwen3.5-2B-4bit mlx-community/gemma-4-e4b-it-4bit mlx-community/Qwen3.5-9B-4bit; do
  name=${m:t}
  echo "=== $name"
  uv run python -m polyxd_model.generate --model $m --constrained --format tree 2>&1 | grep -E "^(ok|ERR)|Traceback|Error" | tail -2
  (cd .. && node packages/verifier/scripts/score-run.ts model/runs/$name-tree-constrained 2>&1 | tail -16 | grep -E '"(validRate|meanScore|taskSuccess|expectations|medianLatency_s|medianTps)"')
done
echo "=== all done"
