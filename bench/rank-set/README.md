# Ranking set: the model's own options

Three options the model produced for the same request, ranked by a designer. Where `bench/gold`
asks *does the verifier agree with a designer about interfaces we wrote*, this asks *are the
model's own first options any good, and which one would a designer ship*.

Build it after a training run:

```
cd model && uv run python -m polyxd_model.rank_set --adapter adapters/sft-v3 --samples 3
```

That writes one file per option (`<request-id>-a.json` …) plus `ranking.json`. Options come from
one greedy sample (what the model does by default) and sampled alternatives, deduplicated.

Rank them in the local gallery: `npm run dev -w @polyxd/gallery`, then
<http://localhost:5173/?rank&set=model>. The page shuffles the options under neutral names, so the
greedy one isn't identifiable, and saves as you go — including notes per option and annotations on
individual elements.

The requests are a spread across money, tasks, shopping, calendar, settings, personal and the
business set (`bench/requests-b2b.json`).

What the ranking is for:

- **Now:** does the design pass show up in what the model actually produces?
- **Later:** preference pairs for DPO — the designer's order is the training signal.
