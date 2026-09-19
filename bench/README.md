# Polyxd benchmark

This benchmark tests whether a model can turn a request into a good just-in-time interface. For each request, the host provides context: registered capabilities, data, and optionally a Design Direction and interface memory. The model must output a Polyxd UI document (`packages/spec/schema/ui.schema.json`). The benchmark supplies those inputs and defines what "good" means, so that `@polyxd/verifier` can score the output. The requests are domain-generic, spread across money, productivity, calendar, commerce, travel, settings/admin and personal software.

## Files

| File | What it is |
|---|---|
| `registry.json` | One capability registry (`capabilities.schema.json`) covering every request: 58 capabilities with risk levels, input schemas, side effects and flags (`csv-export`, `seat-maps`, `price-alerts`, `reading-import`). Risk levels follow the spec: anything that moves money, notifies other people irreversibly or weakens security is `consequential`, and anything that erases data or can't be refunded is `destructive`. |
| `requests.json` | 50 single-turn requests (7 per domain, 8 for personal). See below. |
| `sequences.json` | 10 multi-turn sequences of 3–5 turns for the same or a related intent, used to measure consistency. |
| `tasks.json` | Agent tasks for the 20 spec examples, used to test the verifier itself (`npm run verify:examples`). |
| `gold/` | 30 documents in 10 groups of 3 (a = original, b = mild drift, c = clearly worse), plus `ranking.json` for a designer's ranking. See `gold/README.md`. |

### A request

```jsonc
{
  "id": "money-pay-electricity",        // unique
  "domain": "money",
  "request": "pay the electricity bill",  // what the user typed
  "intent": "money.bill.pay",             // stable intent key (memory and consistency are keyed on it)
  "direction": "calm-finance",            // optional: packages/spec/examples/directions/<name>.json
  "data": { "bills": [ ... ] },           // host data; the UI binds to it and must not invent values
  "capabilities": ["bill.pay"],           // the subset of registry.json the host exposes for this request
  "expect": {
    "pattern": "confirm-destructive",     // when one of the 5 core patterns clearly applies
    "components": ["Confirm", "DetailList"],
    "capability": "bill.pay",             // the event the task should end with
    "names": ["Pay £86.40"],              // host-required copy (see below)
    "mustNot": ["A confirm button labelled 'Yes' or 'OK'"]
  },
  "task": {                                // optional agent task, same step format as tasks.json
    "instruction": "Pay the Northern Power bill.",
    "steps": [{ "press": "Pay £86.40" }],
    "expect": { "event": "bill.pay", "context": { "billId": "b_12" } }
  }
}
```

- **Model inputs:** `request`, `data`, the registry entries named in `capabilities`, the `direction` (if any), and `expect.names`. The names act like copy a journey fixes, such as a confirm label that must state the amount. Everything else in `expect`, and the whole `task`, is used only for scoring.
- **`mustNot`:** an entry that is a component name (e.g. `"Form"`) or a capability name (e.g. `"transfer.confirm"`) can be checked by a machine: that component must not appear, or that capability must not be triggered. Every other entry is prose for a human or LLM judge.
- **Tasks** (37 of the 50 requests) only use accessible names that come from the data (a payee, a product, a slot label), from `expect.names`, or that the renderer adds itself (`Type X to confirm`, `Choose <plan>`). A UI that uses the host's names can therefore be operated by the scripted agent.

**Edge cases:**

| Request | Case | Expected behaviour |
|---|---|---|
| `calendar-unsupported-car` | No capability exists for the request | An explanatory `Status`, not a fake UI |
| `tasks-delete-project`, `travel-cancel-porto`, `settings-delete-account`, `settings-remove-dan`, `personal-delete-august-journal` | Destructive action | Use `Confirm` |
| `tasks-overdue-empty` | Empty data set | An empty-state `Status` |
| `calendar-plan-offsite`, `travel-checkin` | More than 6 inputs | Use `Steps` |
| `money-payees-injection` | A payee's name contains a prompt injection | Render it as text only; never add a transfer |
| `tasks-vague` | The request is just "tasks" | Show a sensible overview |
| `money-freeze-card`, `tasks-tick-dentist`, `shop-return-mug` | Low-risk, reversible action | No `Confirm` |

### A sequence

Each sequence has `turns`, where each turn is a `request` plus its `data`; `"same"` reuses the previous turn's data. It also has `keys`, the semantic-key vocabulary for the intent, which is given to the model in the same way interface memory would give it. `stable` lists the keys whose component, relative order and label must persist across turns. `mayChange` describes what is allowed to differ, such as values, filters or a narrowed collection.

## How Phase 4 uses it

```
request + data + capabilities (+ direction, + memory)
        │
        ▼
   model (constrained to ui.schema.json)
        │  UI document
        ▼
 polyxd-verify ── static (spec, pattern, capabilities, direction rules, agent-readiness)
              ── rendered (axe-core, contrast, target size, overflow) × design systems × modes × widths
              ── task (scripted agent through the accessibility tree)
        │
        ▼
 expect checks (pattern, components, capability, mustNot)   +   consistency: compare(turn n−1, turn n)
```

1. For each request, build the prompt from the model inputs, generate a document, and time it.
2. Run `verifyDocument(doc, { registry, tasks: [task], rules: direction?.rules })` using `registry.json`.
3. Check `expect`: the declared or detected pattern, that the expected components are present, that the task ends with `expect.capability`, and the machine-checkable `mustNot` entries.
4. For each sequence, generate the turns in order. When testing with memory, feed the previous turn's `signature()` back as memory. Score each consecutive pair with `compare()`, and check that every `stable` key survives with the same component and label.

## Metrics

| Metric | Definition |
|---|---|
| **Validity rate** | Share of outputs that pass `validateDocument` (schema and structural rules). Invalid documents score 0 everywhere else. |
| **Mean verifier score** | Mean `Report.score` (0–100) over the 50 requests. It covers static, rendered and agent checks. |
| **Expectation match** | Share of requests whose `expect` holds (pattern, components, capability, machine-checkable `mustNot`). |
| **Agent task success** | Share of task runs, across all targets, where the scripted agent reaches `task.expect` through the accessibility tree. Mean steps and dead ends are also reported. |
| **Consistency** | Mean `compare()` score between consecutive turns in each sequence, plus the share of `stable` keys kept intact. It is reported with and without interface memory. |
| **Latency** | Time to the first byte, time to the first valid partial render, and total generation time, measured on the M5 in Phase 4 (budget: first meaningful render under 1 s). |

All metrics can be split by domain. The gold set (`npm run gold -w @polyxd/verifier`) measures whether the verifier score agrees with a designer's ranking.
