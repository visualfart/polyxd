#!/bin/zsh
# Self-improvement loop: expert iteration that keeps a round only if it beats the best so far,
# on the verifier and against the approved flow designs.
#
# Each round, the best model writes six candidates per training scenario, the verifier's training
# reward keeps the best of each, and a fresh adapter is trained from the base model on the clean
# pool plus every accepted round's picks. Then two measures:
#
#   verifier  mean score on the 50 held-out benchmark requests
#   designs   a blind review of the new model against the best on the 17 requests that have an
#             approved design (bench/design-set.json, rubric in bench/design-review.md)
#
# A round is kept when it is at least as close to the designs (wins >= losses), no more than a
# point worse on the verifier, and better on one of the two: a point up on the verifier, or more
# wins than losses against the designs. Kept, it becomes the best and generates the next round;
# otherwise its picks are set aside. Two misses in a row and the loop stops.
#
# The review is done by a reviewer outside this script: the loop prepares it, writes
# round-N/review-needed, and waits for round-N/review/verdicts.json. The designs are only ever
# reviewed against, never trained on (design/flows/README.md).
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
REVIEW=../packages/verifier/scripts/design-review.ts

run_of() { echo "runs/${MODEL:t}+$1-tree-constrained" }
# Mean benchmark score to a tenth, invalid answers counting 0: finer than the leaderboard's integer.
score_of() { node -p "const r=require('./$(run_of $1)/summary.json').rows; (r.reduce((s,x)=>s+(x.score??0),0)/r.length).toFixed(1)" }
say() { echo "[$(date '+%m-%d %H:%M')] $*" | tee -a $STATE/log }

# The B2B requests aren't in the 50-request benchmark, but five of them have approved designs.
b2b_answers() {
  [[ -d $(run_of $1)/requests-b2b ]] && return
  uv run python -m polyxd_model.generate --model $MODEL --adapter adapters/$1 --constrained --format tree --b2b 2>&1 | grep -E "Traceback" || true
}

# Blind review of $2 (the candidate) against $1 (the best) in folder $3; prints "wins losses ties".
review() {
  local best=$1 cand=$2 dir=$3
  b2b_answers $best >&2
  b2b_answers $cand >&2
  if [[ ! -f $dir/review/result.json ]]; then
    if [[ ! -f $dir/review/manifest.json ]]; then
      node $REVIEW prepare --a $(run_of $best) --b $(run_of $cand) --out $dir/review --key $dir/review-key.json --seed $RANDOM | tail -1 >&2
    fi
    touch $dir/review-needed
    say "review: $cand against $best, waiting for $dir/review/verdicts.json" >&2
    until [[ -f $dir/review/verdicts.json ]]; do sleep 60; done
    rm -f $dir/review-needed
    node $REVIEW tally --out $dir/review --key $dir/review-key.json >/dev/null
  fi
  node -p "const t=require('./$dir/review/result.json').tally; [t.b, t.a, t.tie].join(' ')"
}

# Whether $2 should replace $1, given verifier scores and review wins/losses. Prints true or false.
keep() {
  local s_best=$1 s_cand=$2 wins=$3 losses=$4
  node -p "const up = $s_cand >= $s_best + $MARGIN, down = $s_cand < $s_best - $MARGIN;
    $wins >= $losses && !down && (up || $wins > $losses)"
}

# Start from sft-v2 or sft-v4, by the same rule a round is judged by.
if [[ ! -f $STATE/best ]]; then
  for a in sft-v2 sft-v4; do [[ -f $(run_of $a)/summary.json ]] || { echo "$a has no benchmark run yet"; exit 1 } done
  mkdir -p $STATE/start
  v2=$(score_of sft-v2); v4=$(score_of sft-v4)
  read wins losses ties <<< "$(review sft-v2 sft-v4 $STATE/start)"
  if [[ $(keep $v2 $v4 $wins $losses) == true ]]; then echo sft-v4 > $STATE/best; else echo sft-v2 > $STATE/best; fi
  say "start: sft-v2 $v2, sft-v4 $v4 on the verifier; against the designs sft-v4 won $wins, lost $losses, tied $ties. Best is $(cat $STATE/best)"
  : > $STATE/accepted
  echo 0 > $STATE/misses
  echo 0 > $STATE/done
fi

# Resuming redoes an unfinished round; candidates, selections and reviews already made are kept.
round=$(( $(cat $STATE/done) + 1 ))
while (( round <= MAX_ROUNDS )); do
  best=$(cat $STATE/best); best_score=$(score_of $best)
  name=loop-$round
  pool=data/candidates/$name
  dir=$STATE/round-$round
  mkdir -p $dir

  if [[ ! -f $(run_of $name)/summary.json ]]; then
    say "round $round: candidates from $best ($best_score)"
    uv run python -m polyxd_model.candidates --model $MODEL --adapter adapters/$best --samples 6 --temp 0.9 --out $pool 2>&1 | tail -1

    say "round $round: reward and selection"
    (cd .. && node packages/verifier/scripts/select-candidates.ts model/$pool --min 95 --reward --out model/data/selected-$name.jsonl | tail -1) | tee -a $STATE/log

    # The clean base pool, every accepted round's picks, and this round's.
    cat $BASE_POOL $(sed 's|.*|data/selected-&.jsonl|' $STATE/accepted) data/selected-$name.jsonl | sort -u > $dir/pool.jsonl
    (cd .. && node packages/verifier/scripts/audit-pool.ts model/$dir/pool.jsonl --keep model/$dir/train.jsonl) | tee -a $STATE/log
    uv run python -m polyxd_model.sft build --input $dir/train.jsonl

    say "round $round: training $name ($ITERS iterations)"
    uv run python -m polyxd_model.sft train --model $MODEL --iters $ITERS --name $name 2>&1 | grep -E "Iter [0-9]+: Val|Saved final|Error|Traceback" | tee -a $STATE/log

    say "round $round: held-out benchmark"
    uv run python -m polyxd_model.generate --model $MODEL --adapter adapters/$name --constrained --format tree 2>&1 | grep -E "Traceback" || true
    (cd .. && node packages/verifier/scripts/score-run.ts "model/$(run_of $name)" | tail -1 && npm run leaderboard -w @polyxd/verifier >/dev/null)
  fi

  s=$(score_of $name)
  read wins losses ties <<< "$(review $best $name $dir)"
  verdict="verifier $s vs $best_score; against the designs won $wins, lost $losses, tied $ties"
  if [[ $(keep $best_score $s $wins $losses) == true ]]; then
    echo $name >> $STATE/accepted
    echo $name > $STATE/best
    echo 0 > $STATE/misses
    say "round $round: $name kept, now the best ($verdict)"
  else
    echo $(( $(cat $STATE/misses) + 1 )) > $STATE/misses
    say "round $round: $name set aside ($verdict) — $(cat $STATE/misses)/$PATIENCE"
  fi
  echo $round > $STATE/done
  if (( $(cat $STATE/misses) >= PATIENCE )); then
    say "stopped: $PATIENCE rounds in a row without improvement; best is $(cat $STATE/best)"
    exit 0
  fi
  round=$(( round + 1 ))
done
say "stopped after $MAX_ROUNDS rounds; best is $(cat $STATE/best)"
