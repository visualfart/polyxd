#!/bin/zsh
# What phase 6 is doing right now, refreshed every few seconds.
#
#   ./watch.sh          watch round 1
#   ./watch.sh 2        watch round 2
#
# phase6.sh pipes each step through `tail -3` or a grep, so its log stays quiet for hours at a
# time and says nothing about progress. This reads the artefacts on disk instead: candidate files
# as they are written, then the selected set, then the adapter's checkpoints.
set -u
export TERM=${TERM:-xterm-256color}
cd "$(dirname "$0")"
ROUND=${1:-1}
POOL=data/candidates/round-$ROUND
SELECTED=data/selected-rl-$ROUND.jsonl
ADAPTER=adapters/rl-$ROUND
TOTAL=$(wc -l < data/scenarios.jsonl | tr -d ' ')
START=$(date +%s)

while true; do
  clear
  elapsed=$(( $(date +%s) - START ))
  print "phase 6, round $ROUND — watching since $(date -r $START +%H:%M), now $(date +%H:%M)\n"

  made=$(ls "$POOL" 2>/dev/null | wc -l | tr -d ' ')
  if [[ -d $POOL ]]; then
    print "  generate   $made / $TOTAL scenarios"
    # The pool's oldest and newest files give a rate without the script having to report one.
    if [[ $made -gt 2 ]]; then
      first=$(stat -f %m "$POOL"/$(ls -tr "$POOL" | head -1))
      last=$(stat -f %m "$POOL"/$(ls -t "$POOL" | head -1))
      span=$(( last - first ))
      if [[ $span -gt 0 && $made -lt $TOTAL ]]; then
        rate=$(( made * 60 / span ))
        left=$(( (TOTAL - made) * span / made / 60 ))
        print "             ~$rate a minute, about $left minutes left"
      fi
    fi
  else
    print "  generate   not started"
  fi

  if [[ -f $SELECTED ]]; then
    kept=$(wc -l < "$SELECTED" | tr -d ' ')
    print "  select     $kept candidates kept (reward ≥ 95)"
  elif [[ $made -ge $TOTAL ]]; then
    print "  select     running — 0.3s a candidate, about $(( TOTAL * 6 * 3 / 600 )) minutes"
  fi

  if [[ -d $ADAPTER ]]; then
    size=$(du -sh "$ADAPTER" 2>/dev/null | cut -f1)
    saved=$(stat -f %Sm -t %H:%M "$ADAPTER/adapters.safetensors" 2>/dev/null)
    print "  train      adapter written $size${saved:+, last checkpoint $saved}"
  fi

  print "\n  last from the log:"
  tail -4 data/phase6.log 2>/dev/null | sed 's/^/    /'
  print "\n  (ctrl-c to stop watching; this does not stop the run)"
  sleep 20
done
