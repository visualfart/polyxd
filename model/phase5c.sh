#!/bin/zsh
# Phase 5c: retrain on the current spec (26 components, dense tables, undo-over-confirm).
# Business scenarios top up the existing set (scenarios and candidates both skip work already done),
# then selection and training run across everything.
set -e
cd "$(dirname "$0")"
MODEL=mlx-community/gemma-4-e4b-it-4bit
echo "[$(date +%H:%M)] scenarios (business-heavy top-up)"
uv run python -m polyxd_model.scenarios --model $MODEL --count 550 2>&1 | tail -3
echo "[$(date +%H:%M)] candidates for the new scenarios"
uv run python -m polyxd_model.candidates --model $MODEL --samples 4 2>&1 | tail -3
echo "[$(date +%H:%M)] selection"
(cd .. && node packages/verifier/scripts/select-candidates.ts model/data/candidates/${MODEL:t} --min 90 --require-wiring --max-nocap 0.1 | tail -1)
uv run python -m polyxd_model.sft build
echo "[$(date +%H:%M)] training"
uv run python -m polyxd_model.sft train --model $MODEL --iters 400 --name sft-v3 2>&1 | grep -E "Iter [0-9]+: Val|Saved final|Error|Traceback"
echo "[$(date +%H:%M)] evaluating"
uv run python -m polyxd_model.generate --model $MODEL --adapter adapters/sft-v3 --constrained --format tree 2>&1 | grep -E "Traceback" || true
(cd .. && node packages/verifier/scripts/score-run.ts "model/runs/${MODEL:t}+sft-v3-tree-constrained" | tail -16 && npm run leaderboard -w @polyxd/verifier >/dev/null)
echo "[$(date +%H:%M)] phase 5c done"
