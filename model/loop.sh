#!/bin/zsh
# Self-improvement loop: expert iteration that keeps a round only if it beats the best so far.
#
# Each round, the best model writes six candidates per training scenario, the verifier's training
# reward keeps the best of each, and a fresh adapter is trained from the base model on the clean
# pool plus every accepted round's picks. It is then scored on the held-out benchmark. Better than
# the best by at least MARGIN, and it becomes the best and generates the next round; otherwise its
# picks are set aside. Two rejections in a row and the loop stops: the reward has nothing left to
# teach this model, and the next gain has to come from somewhere else (a designer's preferences).
#
#   ./loop.sh               start, or resume where it stopped
#   ./loop.sh 8             at most 8 rounds
#
# What round 2 taught (research log): a round trained on a weaker model's picks got worse, so only
# rounds that improved on the best contribute to the pool, and candidates always come from the best.
set -e
cd "$(dirname "$0")"
MAX_ROUNDS=${1:-6}
MARGIN=1.0
PATIENCE=2
ITERS=400
MODEL=mlx-community/gemma-4-e4b-it-4bit
STATE=data/loop
mkdir -p $STATE
BASE_POOL=data/selected-v4.jsonl

run_of() { echo "runs/${MODEL:t}+$1-tree-constrained" }
# Mean benchmark score to a tenth, invalid answers counting 0: finer than the leaderboard's integer.
score_of() { node -p "const r=require('./$(run_of $1)/summary.json').rows; (r.reduce((s,x)=>s+(x.score??0),0)/r.length).toFixed(1)" }
better() { node -p "$1 >= $2 + $MARGIN" }
say() { echo "[$(date '+%m-%d %H:%M')] $*" | tee -a $STATE/log }

# Start from whichever of sft-v2 and sft-v4 scores higher under today's checks.
if [[ ! -f $STATE/best ]]; then
  for a in sft-v2 sft-v4; do [[ -f $(run_of $a)/summary.json ]] || { echo "$a has no benchmark run yet"; exit 1 } done
  v2=$(score_of sft-v2); v4=$(score_of sft-v4)
  if [[ $(better $v4 $v2) == true ]]; then echo sft-v4 > $STATE/best; else echo sft-v2 > $STATE/best; fi
  say "start: sft-v2 $v2, sft-v4 $v4; best is $(cat $STATE/best)"
  : > $STATE/accepted
  echo 0 > $STATE/misses
  echo 0 > $STATE/done
fi

# Resuming redoes an unfinished round; candidates already written are kept and not regenerated.
round=$(( $(cat $STATE/done) + 1 ))
while (( round <= MAX_ROUNDS )); do
  best=$(cat $STATE/best); best_score=$(score_of $best)
  name=loop-$round
  pool=data/candidates/$name
  say "round $round: candidates from $best ($best_score)"
  mkdir -p $STATE/round-$round
  uv run python -m polyxd_model.candidates --model $MODEL --adapter adapters/$best --samples 6 --temp 0.9 --out $pool 2>&1 | tail -1

  say "round $round: reward and selection"
  (cd .. && node packages/verifier/scripts/select-candidates.ts model/$pool --min 95 --reward --out model/data/selected-$name.jsonl | tail -1) | tee -a $STATE/log

  # The clean base pool, every accepted round's picks, and this round's.
  cat $BASE_POOL $(sed 's|.*|data/selected-&.jsonl|' $STATE/accepted) data/selected-$name.jsonl | sort -u > $STATE/round-$round/pool.jsonl
  (cd .. && node packages/verifier/scripts/audit-pool.ts model/$STATE/round-$round/pool.jsonl --keep model/$STATE/round-$round/train.jsonl) | tee -a $STATE/log
  uv run python -m polyxd_model.sft build --input $STATE/round-$round/train.jsonl

  say "round $round: training $name ($ITERS iterations)"
  uv run python -m polyxd_model.sft train --model $MODEL --iters $ITERS --name $name 2>&1 | grep -E "Iter [0-9]+: Val|Saved final|Error|Traceback" | tee -a $STATE/log

  say "round $round: held-out benchmark"
  uv run python -m polyxd_model.generate --model $MODEL --adapter adapters/$name --constrained --format tree 2>&1 | grep -E "Traceback" || true
  (cd .. && node packages/verifier/scripts/score-run.ts "model/$(run_of $name)" | tail -1 && npm run leaderboard -w @polyxd/verifier >/dev/null)

  s=$(score_of $name)
  if [[ $(better $s $best_score) == true ]]; then
    echo $name >> $STATE/accepted
    echo $name > $STATE/best
    echo 0 > $STATE/misses
    say "round $round: $name $s beats $best $best_score — accepted, now the best"
  else
    echo $(( $(cat $STATE/misses) + 1 )) > $STATE/misses
    say "round $round: $name $s doesn't beat $best $best_score by $MARGIN — set aside ($(cat $STATE/misses)/$PATIENCE)"
  fi
  echo $round > $STATE/done
  if (( $(cat $STATE/misses) >= PATIENCE )); then
    say "stopped: $PATIENCE rounds in a row without improvement; best is $(cat $STATE/best)"
    exit 0
  fi
  round=$(( round + 1 ))
done
say "stopped after $MAX_ROUNDS rounds; best is $(cat $STATE/best)"
