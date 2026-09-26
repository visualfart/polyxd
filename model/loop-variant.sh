#!/bin/zsh
# Loop round 1, variant b: does maximizing the verifier's reward pull the model away from the designs?
#
# Round 1 selected sft-v4's candidates by the full training reward and lost to sft-v4 on the
# verifier (66.7 vs 70.3) and against the approved designs (3 wins, 13 losses). sft-v4 itself came
# from filtering, not maximizing. So: the same round-1 candidates, selected the way sft-v4's pool
# was (score at least 90, capabilities wired), added only for scenarios the clean pool lacks, so no
# scenario has two answers that disagree. If this beats round 1, the reward was the problem.
set -e
cd "$(dirname "$0")"
MODEL=mlx-community/gemma-4-e4b-it-4bit
NAME=loop-1b
DIR=data/loop/variant-1b
mkdir -p $DIR
echo "[$(date +%H:%M)] selecting round 1's candidates the sft-v4 way"
(cd .. && node packages/verifier/scripts/select-candidates.ts model/data/candidates/loop-1 --min 90 --require-wiring --max-nocap 0.1 --out model/$DIR/picks.jsonl | tail -1)
node -e '
const fs = require("fs");
const lines = (f) => fs.readFileSync(f, "utf8").split("\n").filter(Boolean);
const base = lines("data/selected-v4.jsonl");
const have = new Set(base.map((l) => JSON.parse(l).id));
const extra = lines(process.argv[1]).filter((l) => !have.has(JSON.parse(l).id));
fs.writeFileSync(process.argv[2], [...base, ...extra].join("\n") + "\n");
console.log(`pool: ${base.length} clean + ${extra.length} new scenarios = ${base.length + extra.length}`);
' $DIR/picks.jsonl $DIR/pool.jsonl
(cd .. && node packages/verifier/scripts/audit-pool.ts model/$DIR/pool.jsonl --keep model/$DIR/train.jsonl)
uv run python -m polyxd_model.sft build --input $DIR/train.jsonl
echo "[$(date +%H:%M)] training $NAME"
uv run python -m polyxd_model.sft train --model $MODEL --iters 400 --name $NAME 2>&1 | grep -E "Iter [0-9]+: Val|Saved final|Error|Traceback"
echo "[$(date +%H:%M)] held-out benchmark"
uv run python -m polyxd_model.generate --model $MODEL --adapter adapters/$NAME --constrained --format tree 2>&1 | grep -E "Traceback" || true
uv run python -m polyxd_model.generate --model $MODEL --adapter adapters/$NAME --constrained --format tree --b2b 2>&1 | grep -E "Traceback" || true
(cd .. && node packages/verifier/scripts/score-run.ts "model/runs/${MODEL:t}+$NAME-tree-constrained" | tail -1 && npm run leaderboard -w @polyxd/verifier >/dev/null)
node ../packages/verifier/scripts/design-review.ts prepare --a runs/${MODEL:t}+sft-v4-tree-constrained --b runs/${MODEL:t}+$NAME-tree-constrained --out $DIR/review --key $DIR/review-key.json --seed $RANDOM | tail -1
touch $DIR/review-needed
echo "[$(date +%H:%M)] $NAME ready for review"
