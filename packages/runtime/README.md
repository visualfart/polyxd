# @polyxd/runtime

Generates a spec-valid Polyxd UI document for an ask, with the model you choose. It builds the prompt from the spec and your Design Direction, checks the answer, sends the problems back for repair, streams as it goes, and remembers the screen shown for each intent so the next one is recognisable. It uses `fetch` only and has no model SDK dependencies. It runs in Node, browsers and Cloudflare Workers as it is: the spec's schema checks come compiled ahead of time, so nothing needs `eval` or `new Function`.

```ts
import { createRuntime, anthropic, memoryStore } from "@polyxd/runtime";

const runtime = createRuntime({
  generator: anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),  // model defaults to claude-sonnet-5
  direction,                                                        // your direction.json
  memory: memoryStore(),
});

const { document, report, attempts, usage } = await runtime.generate({
  ask: "Send £250 to Alex for the rent",
  intent: "money.send",
  capabilities: { "transfer.confirm": registry.capabilities["transfer.confirm"] },
  data: { quote },
});

if (report.valid) render(document, { data: { quote } });
```

## Generators

One interface, `generate({ system, messages, signal, onText })`, returning the text and token usage. Four adapters implement it. Keys are passed in by you; the runtime never reads them from anywhere and never logs them.

| Adapter | Calls | Model |
|---|---|---|
| `anthropic({ apiKey, model?, maxTokens?, temperature?, baseURL?, cache?, browser? })` | Anthropic Messages API, streaming. The system prompt is marked for prompt caching unless `cache: false` | Default `claude-sonnet-5` |
| `openai({ apiKey, model, api?, baseURL?, maxTokens?, temperature? })` | Chat Completions (`api: "chat"`, the default) or the Responses API (`api: "responses"`, sent with `store: false`) | Required |
| `gemini({ apiKey, model, baseURL?, maxTokens?, temperature? })` | Gemini API `streamGenerateContent`, asking for JSON output. The key goes in a header, not the URL | Required |
| `local({ model, baseURL?, apiKey?, maxTokens?, temperature? })` | Any OpenAI-compatible server. Default `http://localhost:11434/v1` (Ollama); llama.cpp is usually on port 8080, LM Studio on 1234 | Required |

Every adapter also takes `fetch` (your own, for a proxy or tests) and `headers`. A refusal or failure throws a `GeneratorError` with the provider and the HTTP status. Anything with a `name` and a `generate` method works as a generator, so your own code or a fake in tests can stand in.

## What goes in the prompt

`systemPrompt()` is built from the spec at build time: the document shape, the rules for a generated document (bind data by JSON Pointer, only the capabilities offered, destructive actions from a `Confirm`, no shell components), every surface component with its props, and the patterns. It is the same for every ask. Pass `components` to `createRuntime` to offer only the components your product allows.

`userPrompt()` holds everything about this ask:

- the ask, the intent, and a pattern when you name one;
- the capabilities on offer, with risk, inputs and undo;
- the data, and the JSON Pointers it offers;
- the Direction: profile, voice and rules as instructions, the preferred patterns that fit this ask, and disallowed patterns;
- up to two exemplars from the Direction, chosen by the words they share with the ask (`exemplars` sets how many; `resolveExemplar` turns a `document` path into the document);
- the screen shown last time for this intent, from memory.

The same input gives the same text. `runtime.prompt(ask)` returns exactly what the first call would send.

## Checks and repair

Each answer is parsed (code fences and prose around the JSON are tolerated) and checked:

- `checkDocument`: the verifier's document checks, `staticAudit` from `@polyxd/verifier/static`. That is the spec validator, with the Direction's `emphasisBudget` and bindings checked against your data; the declared pattern's checks; the capabilities on offer; the Direction's rules and its compiled voice; and the verifier's agent-readiness checks (distinct control names, labels that say what happens, no template placeholders, and the rest). They read no files and load no browser, so they run anywhere.
- Generated-only checks: never a shell (`generated:shell`), only allowed components (`generated:component`), no disallowed pattern (`direction:pattern-disallowed`).

Pass `audit` to use checks of your own instead of `checkDocument`. It gets the same options `staticAudit` takes.

If anything is an error, the model gets its answer back with the problems listed and is asked for the whole document again, up to `maxRepairs` times (default 2). `repairWarnings: true` sends warnings back too. The result is `{ document, report, attempts, usage }`. When it gives up, `report.valid` is false and `document` is the last one that parsed.

## Streaming

```ts
for await (const p of runtime.stream(ask)) {
  if (p.type === "text") showTyping(p.text);
  if (p.type === "done") show(p.result.document);
  if (p.type === "error") showFallback(p.reason);
}
```

The order is `started`, then for each attempt its `text` pieces and an `attempt` report, then `repaired` if a repair worked, then `done` or `error`. Leaving the loop early aborts the model call. `generate(ask, { onProgress })` gives the same sequence as a callback, and `ask.signal` cancels either.

## Memory

`memoryStore()` keeps screens in memory; `storageStore(localStorage)` keeps them in `localStorage` or anything with `getItem`, `setItem` and `removeItem`. When a document passes, it is stored by intent without its data. The next ask with that intent sends it to the model as the screen to keep recognisable. Nothing leaves the client.

## Events

`onEvent` receives `started`, `text`, `attempt`, `repaired`, `done` and `error` with counts, timings, validity, token usage and check ids only. Never the ask, the data or the document. The package sends no telemetry anywhere; what you do with the events is up to you.

## Tests

`npm test -w @polyxd/runtime` runs with a fake generator and no network: prompt snapshots, the repair loop and giving up, fence stripping, streaming order, memory, event redaction, the default checks and a custom `audit`, that nothing loads the file system or Playwright, and each adapter's request and stream parsing against fixture streams written in each provider's documented format. `npm run build:catalog -w @polyxd/runtime` regenerates the spec catalog; a test fails when it is out of date.
