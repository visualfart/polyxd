#!/bin/zsh
# Phase 5 pipeline: scenarios → candidates → verifier selection → SFT data → LoRA → held-out benchmark.
set -e
cd "$(dirname "$0")"
MODEL=mlx-community/gemma-4-e4b-it-4bit
while pgrep -f "polyxd_model.scenarios" >/dev/null; do sleep 10; done
echo "[$(date +%H:%M)] scenarios: $(wc -l < data/scenarios.jsonl)"
uv run python -m polyxd_model.candidates --model $MODEL --samples 4 2>&1 | grep -E "parsed|Traceback|Error" | tail -1
echo "[$(date +%H:%M)] candidates done"
(cd .. && node packages/verifier/scripts/select-candidates.ts model/data/candidates/${MODEL:t} --min 90 | tail -1)
uv run python -m polyxd_model.sft build
echo "[$(date +%H:%M)] training"
uv run python -m polyxd_model.sft train --model $MODEL --iters 600 2>&1 | grep -E "Iter [0-9]+: (Val|Train)|Saved|Error|Traceback" | tail -20
echo "[$(date +%H:%M)] evaluating on the held-out benchmark"
uv run python -m polyxd_model.generate --model $MODEL --adapter adapters/${MODEL:t} --constrained --format tree 2>&1 | grep -E "^(ok|ERR)|Traceback" | tail -1
(cd .. && node packages/verifier/scripts/score-run.ts "model/runs/${MODEL:t}+${MODEL:t}-tree-constrained" | tail -16 && npm run leaderboard -w @polyxd/verifier >/dev/null)
echo "[$(date +%H:%M)] phase 5 pipeline done"
