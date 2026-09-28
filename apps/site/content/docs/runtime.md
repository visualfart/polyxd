---
title: Runtime
description: Generate a UI document for an ask with the model you choose, with your Design Direction applied, checked and repaired, streamed, and remembered per intent.
order: 20.5
section: Guides
---

# Runtime

`@polyxd/runtime` turns an ask into a UI document with the model you choose. It builds the prompt from the spec and your [Design Direction](/docs/design-direction), checks the answer, sends any problems back to the model to fix, streams as it goes, and remembers the screen shown for each intent. It uses `fetch` only and has no model SDK dependencies, so it runs in Node, browsers and Workers.

It is new in the repository and not on npm yet.

## Install

```bash
npm install @polyxd/runtime
```

## A first document

```ts
import { createRuntime, anthropic } from "@polyxd/runtime";

const runtime = createRuntime({
  generator: anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
  direction,   // your direction.json
});

const { document, report, attempts, usage } = await runtime.generate({
  ask: "Send £250 to Alex for the rent",
  intent: "money.send",
  capabilities: { "transfer.confirm": registry.capabilities["transfer.confirm"] },
  data: { quote },
});

if (report.valid) {
  // render `document` with @polyxd/react or @polyxd/web, passing the same data
}
```

`capabilities` are the ones this surface may trigger, by name, with the same fields as your [capability registry](/docs/product#capabilities). `data` is what the surface binds to. The document is checked against it.

## Choosing a model

Every model sits behind one small interface: `generate({ system, messages, signal, onText })` returns the text and token usage, and calls `onText` as text streams in. Four adapters come with the package. You pass the key in. The runtime never reads keys from disk or the environment, and never logs them.

```ts
import { anthropic, openai, gemini, local } from "@polyxd/runtime";

// Claude, through the Messages API. The model defaults to claude-sonnet-5.
anthropic({ apiKey, model: "claude-sonnet-5", maxTokens: 8192 });

// OpenAI, through Chat Completions (the default) or the Responses API.
openai({ apiKey, model: "your-model-id" });
openai({ apiKey, model: "your-model-id", api: "responses" });

// Google Gemini, through streamGenerateContent. The key goes in a header, not the URL.
gemini({ apiKey, model: "your-model-id" });

// A model on your machine, through an OpenAI-compatible endpoint.
local({ model: "qwen3:8b" });                                          // Ollama, http://localhost:11434/v1
local({ model: "your-model", baseURL: "http://localhost:8080/v1" });   // llama.cpp server
local({ model: "your-model", baseURL: "http://localhost:1234/v1" });   // LM Studio
```

| Adapter | Details |
|---|---|
| `anthropic` | Streams from `/v1/messages`. The system prompt is marked for prompt caching, since it's the same for every ask; `cache: false` turns that off. `browser: true` adds the header Anthropic requires for calls from a browser: only use it with a key the person using the page owns |
| `openai` | `api: "chat"` streams Chat Completions with usage in the last chunk. `api: "responses"` streams the Responses API with `store: false`, so responses aren't kept on OpenAI's side |
| `gemini` | Streams `streamGenerateContent` and asks for JSON output (`responseMimeType: "application/json"`) |
| `local` | Streams Chat Completions from any OpenAI-compatible server. No key unless your server wants one |

Every adapter takes `baseURL`, `maxTokens`, `temperature`, `headers`, and `fetch` for a proxy or tests. Only `anthropic` has a default model; the others need `model`. A refusal or failure throws a `GeneratorError` with `provider` and `status`.

Your own code can be the generator too: anything with a `name` and a `generate` method that returns text works.

## The prompt

`systemPrompt()` is built from the spec when the package is built: the document shape, the rules a generated document follows, every component a surface may use with its props, and the six patterns. The shell components are left out, and one rule says never to use them. The text is the same for every ask, so a provider's prompt cache can hold it. Pass `components` to `createRuntime` to offer only the components your product allows; the runtime then checks that too.

`userPrompt()` holds the ask:

- the ask, the intent, and a pattern if you name one with `pattern`;
- the capabilities on offer, each with its risk, its inputs (required ones marked) and its undo;
- the data as JSON, and the JSON Pointers it offers, with lists described once by their items' fields;
- the Design Direction (see below);
- the screen shown last time for this intent, when you use [memory](#memory).

The same input always gives the same text. `await runtime.prompt(ask)` returns exactly what the first model call would send, for inspection and tests.

## The Design Direction at generation

Pass `direction` to `createRuntime`. These parts reach the model:

| Part | What the model is told |
|---|---|
| `profile.density` | Compact fits more on one screen; spacious shows fewer things |
| `profile.emphasisBudget` | How many primary actions may be visible at a time. The validator enforces the same number |
| `profile.dataDisplay` | Prefer charts, tables or metrics. `auto` adds nothing |
| `profile.disclosure` | Put secondary detail behind a `Disclosure`, or show it directly |
| `profile.freedom` | Strict: stay close to the preferred patterns and the examples. Guided: new layouts from the listed components. Open: any layout that passes the checks |
| `voice` | Guidelines, tone, person, casing, spelling, reading level, punctuation, label length and verb-first labels, glossary, words to avoid, and guidance for each situation |
| `rules` | Each rule's description, marked as checked |
| `patterns.prefer` | The preferred patterns that fit this ask, with their structure. A pattern fits when it shares words with the ask, the intent or the capabilities, or when it's written for the risk of a capability on offer |
| `patterns.disallow` | Listed as patterns never to use, and checked |
| `exemplars` | Up to two, chosen by the words their request shares with the ask (`exemplars` sets how many). An exemplar's `document` is a path, so pass `resolveExemplar(path)` to load it; without it, path exemplars are skipped. A document given inline is used as it is |

`profile.motion` isn't given to the model, since a document holds no motion. `patterns.custom` files aren't read yet.

The Direction's rules and its compiled voice are also checked on every answer (see below), the same checks `directionRules` gives the verifier.

## Checks and repair

Each answer is parsed first. A code fence, or a sentence before the JSON, is tolerated. Then it is checked:

- **Everywhere:** `checkDocument` runs the [verifier's](/docs/verifier) document checks, `staticAudit` from `@polyxd/verifier/static`. That is the spec validator (with the Direction's `emphasisBudget`, and every binding checked against your `data`), the checks of the pattern the document declares, the capabilities on offer, the Direction's rules and compiled voice, and the verifier's agent-readiness checks: distinct control names, labels that say what happens, no template placeholders, and the rest. They read no files and load no browser, so they run anywhere the runtime does.
- **Generated only:** the document is never a shell (`generated:shell`), uses only the allowed components (`generated:component`), and follows no disallowed pattern (`direction:pattern-disallowed`).
- **Your own:** pass `audit` to use your own checks instead of `checkDocument`. It gets the same options `staticAudit` takes. The generated-only checks still run.

```ts
const runtime = createRuntime({ generator, direction, audit: (doc, options) => myChecks(doc, options) });
```

If an answer has errors, the model gets it back with each problem listed and is asked for the whole document again. That happens up to `maxRepairs` times (default 2). Warnings don't trigger a repair unless you set `repairWarnings: true`, and even then a document with only warnings is accepted on the last attempt.

The result is `{ document, report, attempts, usage }`. `report` has `valid`, `errors`, `warnings` and the `findings`. `usage` adds up input and output tokens across attempts. When the runtime gives up, `report.valid` is false and `document` is the last answer that parsed, so you can show a fallback.

## Streaming

```ts
for await (const p of runtime.stream(ask)) {
  if (p.type === "text") appendToPreview(p.text);
  if (p.type === "attempt" && !p.report.valid) showChecking();
  if (p.type === "done") show(p.result.document);
  if (p.type === "error") showFallback(p.reason);
}
```

| Item | When |
|---|---|
| `started` | Once, with whether memory had a screen and how many exemplars went in |
| `text` | Each piece of the model's answer, with the attempt number |
| `attempt` | After each answer is checked, with its report |
| `repaired` | When an answer passes after a repair |
| `done` | Last, with the result |
| `error` | Last, instead of `done`. `reason` is `invalid` (gave up), `generator`, `aborted` or `setup` |

Leaving the loop early aborts the model call. `runtime.generate(ask, { onProgress })` gives the same items to a callback. Pass `signal` in the ask to cancel either.

## Memory

Interface memory keeps the screen shown for each intent, on the client, so asking again gives a screen the person recognises.

```ts
import { createRuntime, storageStore } from "@polyxd/runtime";

const runtime = createRuntime({ generator, direction, memory: storageStore(localStorage) });
```

When a document passes, it is stored by its ask's `intent`, without its data. The next ask with that intent sends it to the model with the instruction to keep its keys, structure, order and labels, and to change only what the new ask needs. `memoryStore()` keeps screens in memory instead. Any object with `get`, `set` and `delete` can be a store. The runtime makes no network calls for memory. A store that fails to write doesn't fail the document.

## Events and privacy

`onEvent` is for your own analytics. It receives the same six moments with numbers only:

| Event | Fields |
|---|---|
| `started` | `maxAttempts`, `exemplars`, `remembered`, `promptChars` |
| `text` | `attempt`, `chars` |
| `attempt` | `attempt`, `ms`, `chars`, `valid`, `errors`, `warnings`, `checks`, `inputTokens`, `outputTokens` |
| `repaired` | `attempt` |
| `done` | `attempts`, `ms`, `warnings`, `checks`, `inputTokens`, `outputTokens` |
| `error` | `reason`, `attempts`, `ms`, and `status` or `checks` when there are any |

`checks` holds check ids such as `spec` or `rule:money-moves-in-confirm`, never their messages. No event carries the ask, the data or the document. A hook that throws never breaks generation. The package sends no telemetry anywhere.

## Everything it exports

| Export | What it does |
|---|---|
| `createRuntime(options)` | The runtime: `generate`, `stream` and `prompt` |
| `anthropic`, `openai`, `gemini`, `local` | The model adapters |
| `GeneratorError` | What an adapter throws when a provider refuses or fails |
| `systemPrompt(options)`, `userPrompt(input)`, `repairPrompt(findings)` | The three kinds of prompt text, for use with your own loop |
| `dataPaths(data)` | The JSON Pointers a data object offers, as the prompt lists them |
| `parseDocument(text)`, `extractJson(text)` | The JSON inside a model's answer, fences and prose removed |
| `checkDocument(doc, options)` | The verifier's document checks (`staticAudit`), which run anywhere. The default checks |
| `memoryStore()`, `storageStore(storage, { prefix })` | Interface memory in memory, or in `localStorage` |
