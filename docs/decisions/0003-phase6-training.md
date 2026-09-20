# 0003 — How to train past supervised fine-tuning (Phase 6)

- **Status:** Accepted (2026-09-20)
- **Date:** 2026-09-20
- **Scope:** What "reinforcement learning with the verifier as the reward" should actually mean on this hardware, and in what order to do it.

## Decision (TL;DR)

**Expert iteration first, DPO second, GRPO not yet.** Phase 6 is repeated rounds of *generate many, keep the best by reward, fine-tune on those* — the same loop as Phase 5's selection, run more than once, with a reward that goes beyond the verifier's score. Preference training (DPO) follows once a designer's rankings exist, because that is the only source of taste we have. Policy-gradient methods (GRPO, PPO) are not worth their cost here yet.

## Why

**1. The tooling.** mlx-lm 0.31.3 ships supervised LoRA training and distillation losses (KL, JS). There is no DPO or GRPO trainer. DPO needs a reference model plus a pairwise loss, which is a contained amount of code against `mlx_lm.tuner.trainer`. GRPO needs a sampling loop inside training, advantage estimation and much more compute. On a 24 GB Mac, where generating one surface takes ~4 seconds, a GRPO round that samples 8 completions per prompt for a few thousand prompts is days, not hours.

**2. Expert iteration is where the gains still are.** Phase 5's one round of selection took the model from 71 to 79 mean score and from 14/37 to 16/37 agent tasks. The score distribution says the remaining loss is concentrated: 26 of 50 requests already score 80+, and the tail is mostly *missing components* and *failed agent tasks* — surfaces that are valid and safe but leave out what was asked for. Those are exactly the failures a better-filtered supervised set fixes.

**3. The reward has to be more than the score.** Run 1 of Phase 5 selected on verifier score alone and produced a *timid* model: a surface that shows a summary and no controls scores well and does nothing useful. The reward for Phase 6 is:

| Part | Weight | Why |
|---|---|---|
| Verifier score (valid, safe, accessible, laid out) | 1.0 | The floor. A surface that fails this is not a candidate. |
| Capability wiring: offered capabilities the surface actually uses | 0.2 per offered capability wired | Stops the timid failure mode. |
| The scripted agent can trigger the surface's main action | 0.2 | A surface an agent can't act on is decoration. |
| Length penalty above the median for that request | small | Discourages padding the document to hit checks. |

**4. Taste needs a human.** No reward we can compute captures what the designer's ranking captured: the verifier's order matched a designer's exactly in 5 of 10 gold groups. Preference pairs from rankings — of the model's own options, in `bench/rank-set` — are the only training signal for the other half. That is DPO's job, and it is worth building the trainer once those rankings exist.

## Order of work

1. **Round-based expert iteration** (`phase6.sh`): generate k candidates per scenario with the *current* adapter, score with the composite reward, keep the best per scenario above a threshold, retrain from the base model on the accumulated set, evaluate on the held-out benchmark. Stop when a round doesn't improve the benchmark.
2. **DPO on designer rankings**, once `bench/rank-set/ranking.json` has orders in it: pairs are (ranked higher, ranked lower) within a group. Implement the loss against `mlx_lm.tuner.trainer` with the SFT adapter as the reference.
3. **GRPO** only if 1 and 2 stall, and probably not on this machine.

## What would change this

- mlx-lm shipping a DPO or GRPO trainer worth using (then step 2 gets cheaper, and step 3 becomes testable).
- Expert iteration flattening after one round: then the supervised pool is exhausted and preference training becomes the priority sooner.
- A second machine. The 2017 Mac Pro is CPU-only for this work; generation, not training, is the bottleneck in every round.

## Risks

- **Reward hacking.** Every part of the reward is checkable by the model's own output shape, so a round could learn to satisfy checks rather than people. The benchmark is held out from training scenarios, and the designer's ranking is the check on the checks — if scores rise while rankings don't, the reward is being gamed.
- **Distribution collapse.** Keeping only the best candidate per scenario narrows variety each round. Keep the sampling temperature up, and keep the accumulated set from earlier rounds rather than replacing it.
- **Overfitting to the verifier's blind spots.** Anything the verifier can't see (taste, tone, whether the surface answers the question) can drift without ever showing up in a number. Rank again after each round.
