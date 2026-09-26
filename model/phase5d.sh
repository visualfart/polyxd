#!/bin/zsh
# Phase 5, run 4: sft-v2's recipe under the check set that rejects blank bindings.
#
# Rated against the approved flow designs, 8 of sft-v2's 12 screens showed nothing real, and 83 of
# the 262 examples it was trained on bind to data that isn't there: they were selected while that
# cost a warning. Same candidates, same selection flags, same 400 iterations as phase5b.sh; the only
# change is the verifier, so a difference between sft-v2 and sft-v4 is the checks' doing.
set -e
cd "$(dirname "$0")"
MODEL=mlx-community/gemma-4-e4b-it-4bit
echo "[$(date +%H:%M)] selecting from ${MODEL:t}'s candidates under today's checks"
(cd .. && node packages/verifier/scripts/select-candidates.ts model/data/candidates/${MODEL:t} --min 90 --require-wiring --max-nocap 0.1 --out model/data/selected-v4.jsonl | tail -1)
(cd .. && node packages/verifier/scripts/audit-pool.ts model/data/selected.jsonl model/data/selected-v4.jsonl)
uv run python -m polyxd_model.sft build --input data/selected-v4.jsonl
echo "[$(date +%H:%M)] training sft-v4"
uv run python -m polyxd_model.sft train --model $MODEL --iters 400 --name sft-v4 2>&1 | grep -E "Iter [0-9]+: Val|Saved final|Error|Traceback"
echo "[$(date +%H:%M)] evaluating on the held-out benchmark"
uv run python -m polyxd_model.generate --model $MODEL --adapter adapters/sft-v4 --constrained --format tree 2>&1 | grep -E "Traceback" || true
(cd .. && node packages/verifier/scripts/score-run.ts "model/runs/${MODEL:t}+sft-v4-tree-constrained" | tail -16 && npm run leaderboard -w @polyxd/verifier >/dev/null)
echo "[$(date +%H:%M)] sft-v4 done"
