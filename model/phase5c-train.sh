#!/bin/zsh
# Phase 5c, from selection onward (selection already ran).
set -e
cd "$(dirname "$0")"
MODEL=mlx-community/gemma-4-e4b-it-4bit
uv run python -m polyxd_model.sft build
echo "[$(date +%H:%M)] training"
uv run python -m polyxd_model.sft train --model $MODEL --iters 400 --name sft-v3 2>&1 | grep -E "Iter [0-9]+: Val|Saved final|Error|Traceback"
echo "[$(date +%H:%M)] evaluating"
uv run python -m polyxd_model.generate --model $MODEL --adapter adapters/sft-v3 --constrained --format tree 2>&1 | grep -E "Traceback" || true
(cd .. && node packages/verifier/scripts/score-run.ts "model/runs/${MODEL:t}+sft-v3-tree-constrained" | tail -16 && npm run leaderboard -w @polyxd/verifier >/dev/null)
echo "[$(date +%H:%M)] phase 5c done"
