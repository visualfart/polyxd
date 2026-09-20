#!/bin/zsh
# Phase 6: expert iteration (decision 0003).
#
# One round: the current model writes several candidate interfaces per scenario, the verifier's
# training reward picks the best, and a fresh adapter is trained from the base model on everything
# kept so far. The benchmark is held out, so an improvement there is not an improvement on itself.
#
#   ./phase6.sh 1 adapters/sft-v3       first round, starting from the phase 5c model
#   ./phase6.sh 2 adapters/sft-v2 400   second round, from the best model rather than the last
set -e
cd "$(dirname "$0")"
ROUND=${1:?round number}
FROM=${2:?adapter to generate with}
# Round 1's validation loss bottomed at iteration 400 and rose by 500, so the default stops there.
ITERS=${3:-400}
MODEL=mlx-community/gemma-4-e4b-it-4bit
NAME=rl-$ROUND
POOL=data/candidates/round-$ROUND

echo "[$(date +%H:%M)] round $ROUND: candidates from $FROM"
uv run python -m polyxd_model.candidates --model $MODEL --adapter $FROM --samples 6 --temp 0.9 --out $POOL 2>&1 | tail -3

echo "[$(date +%H:%M)] reward and selection"
(cd .. && node packages/verifier/scripts/select-candidates.ts model/$POOL --min 95 --reward --out model/data/selected-$NAME.jsonl | tail -1)

# Keep every earlier round's examples, not just the first: dropping them narrows what the model
# has seen (decision 0003, risks), and round 1's kept examples already passed today's checks.
cat data/selected.jsonl data/selected-rl-*.jsonl 2>/dev/null | sort -u > data/selected-pool-$ROUND.jsonl
uv run python -m polyxd_model.sft build --input data/selected-pool-$ROUND.jsonl

echo "[$(date +%H:%M)] training $NAME"
uv run python -m polyxd_model.sft train --model $MODEL --iters $ITERS --name $NAME 2>&1 | grep -E "Iter [0-9]+: Val|Saved final|Error|Traceback"

echo "[$(date +%H:%M)] evaluating on the held-out benchmark"
uv run python -m polyxd_model.generate --model $MODEL --adapter adapters/$NAME --constrained --format tree 2>&1 | grep -E "Traceback" || true
(cd .. && node packages/verifier/scripts/score-run.ts "model/runs/${MODEL:t}+$NAME-tree-constrained" | tail -16 && npm run leaderboard -w @polyxd/verifier >/dev/null)
echo "[$(date +%H:%M)] round $ROUND done"
