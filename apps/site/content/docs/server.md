---
title: Generation server
description: "@polyxd/server puts the runtime behind an HTTP API with streaming, pointed at the model you choose. Run it with Docker or npx."
order: 21.7
section: Guides
---

# Generation server

`@polyxd/server` is the [runtime](/docs/runtime) behind a small HTTP API. Your app sends an ask. The server builds the prompt from the spec and your [Design Direction](/docs/design-direction), calls the model you chose, checks the answer, sends problems back for repair, and returns the document. It can stream as it goes.

Use it when the model key must stay on a server, or when the code that wants a screen isn't JavaScript. It keeps no state between requests and logs nothing from them but the method, path, status and duration.

It is on npm as `@polyxd/server`. Run it with `npx @polyxd/server`, or build its Docker image from a clone.

## Run it with Docker

From a clone of the [repository](https://github.com/visualfart/polyxd):

```sh
docker build -f packages/server/Dockerfile -t polyxd-server .

docker run --rm -p 8080:8080 \
  -e POLYXD_PROVIDER=anthropic \
  -e ANTHROPIC_API_KEY \
  polyxd-server
```

`-e ANTHROPIC_API_KEY` with no value passes the key from your shell, so it isn't written in the command. The image runs Node 26 as an unprivileged user, listens on port 8080, and has a health check on `/v1/health`. It contains the server and its production dependencies only: no Playwright and no browser.

To give it your Design Direction and capability registry, mount them and point at them:

```sh
docker run --rm -p 8080:8080 \
  -e POLYXD_PROVIDER=openai -e POLYXD_MODEL=your-model-id -e OPENAI_API_KEY \
  -e POLYXD_DIRECTION=/config/direction.json \
  -e POLYXD_REGISTRY=/config/capabilities.json \
  -e POLYXD_SERVER_TOKEN \
  -v "$PWD/config:/config:ro" \
  polyxd-server
```

A model on your own machine works too. From inside a container, the host is `host.docker.internal` on Docker Desktop:

```sh
docker run --rm -p 8080:8080 \
  -e POLYXD_PROVIDER=local -e POLYXD_MODEL=qwen3:8b \
  -e POLYXD_BASE_URL=http://host.docker.internal:11434/v1 \
  polyxd-server
```

## Run it with npx

Once it is on npm:

```sh
POLYXD_PROVIDER=anthropic ANTHROPIC_API_KEY=... npx @polyxd/server
```

Until then, from a clone: `npm install && npm run build -w @polyxd/server`, then `node packages/server/dist/bin.js` with the same settings. `--help` lists them.

Outside Docker it listens on `127.0.0.1` only, so nothing else on the network can reach it. Set `HOST=0.0.0.0` to change that.

## Settings

Everything is set by environment variables. A missing or wrong setting stops the server at start, with a message that says what to set.

| Variable | What it sets |
|---|---|
| `POLYXD_PROVIDER` | `anthropic`, `openai`, `gemini` or `local`. Required |
| `POLYXD_MODEL` | The model id. Required, except for `anthropic`, which defaults to `claude-sonnet-5` |
| `POLYXD_API_KEY` | The provider's key. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` or `GOOGLE_API_KEY` work too; `POLYXD_API_KEY` wins. `local` needs none |
| `POLYXD_BASE_URL` | The provider's base URL. For `local`, your server (default `http://localhost:11434/v1`, Ollama). For the others, a proxy, which may add the key itself |
| `POLYXD_DIRECTION` | Path to your Design Direction. Exemplars it names by path are read relative to it |
| `POLYXD_REGISTRY` | Path to your capability registry, so callers can offer capabilities by name |
| `POLYXD_SERVER_TOKEN` | When set, every endpoint but `/v1/health` needs `Authorization: Bearer <token>` |
| `POLYXD_CORS_ORIGINS` | Origins a browser may call from, comma-separated, or `*`. Default none |
| `POLYXD_MAX_BODY_BYTES` | The largest request body. Default 1048576 (1 MiB) |
| `POLYXD_TIMEOUT_MS` | The longest one generation may take. Default 120000 |
| `POLYXD_MAX_REPAIRS` | How many times a failed answer goes back to the model. Default 2 |
| `PORT`, `HOST` | Where to listen. Default `8080` on `127.0.0.1`; the Docker image sets `0.0.0.0` |

The key goes to the provider and nowhere else. The server never prints or logs it.

## Endpoints

| Endpoint | What it does |
|---|---|
| `POST /v1/generate` | Generates a document for an ask. Returns JSON, or streams with `Accept: text/event-stream` |
| `POST /v1/validate` | The spec validator on a document |
| `POST /v1/verify` | The [verifier's](/docs/verifier) document checks on a document, with your Direction's rules and your registry |
| `GET /v1/spec` | The server and spec versions, the components a generated screen may use, the patterns, your Direction's name and your capabilities' names |
| `GET /v1/health` | `{ "status": "ok", "version" }`. Never needs a token |

Every body is JSON, sent with `Content-Type: application/json`. An error is `{ "error": { "code", "message" } }` with a status that fits: 400 for a body that isn't right (the message says what to fix, and unknown fields are refused so a typo doesn't pass silently), 401 without the token, 403 from an origin that isn't allowed, 404, 405, 413 for a body over the limit, and 415 for a body that isn't JSON.

### Generate

```sh
curl http://localhost:8080/v1/generate \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $POLYXD_SERVER_TOKEN" \
  -d '{
    "ask": "Send £250 to Alex for the rent",
    "intent": "money.send",
    "capabilities": ["transfer.confirm"],
    "data": { "quote": { "id": "q_1", "amount": 250, "currency": "GBP", "recipient": "Alex Kim" } }
  }'
```

| Field | What it is |
|---|---|
| `ask` | What the person asked, in their words. Required |
| `intent` | A stable key for what they're trying to do, such as `money.send`. Required |
| `capabilities` | What the screen may trigger: names from the server's registry, or an object of full capability definitions by name. Leave it out and the screen can offer none |
| `data` | The host data the screen binds to. The document is checked against it |
| `pattern` | A spec pattern the screen should follow, when you already know |

The answer is `{ document, report, attempts, usage }`, as the runtime returns it. `report` has `valid`, `errors`, `warnings` and the `findings`.

| Status | When |
|---|---|
| 200 | The document passed its checks |
| 422 | Every repair failed. The body still has the last `document` and its `report`, plus an `error` with code `invalid`, so you can show a fallback |
| 502 | The model provider failed. `error` has code `generator`, the `provider` and its HTTP `status` (a 401 is a bad key, a 429 a rate limit). The provider's own words are not passed on |
| 504 | No document within `POLYXD_TIMEOUT_MS`. Code `timeout` |

If the caller disconnects, the model call is aborted, so an abandoned request stops costing tokens.

### Streaming

Send `Accept: text/event-stream` to get the runtime's progress as [server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html). Each event is one `event:` line and one `data:` line of JSON:

```
event: started
data: {"remembered":false,"exemplars":0}

event: text
data: {"attempt":1,"text":"{\"specVersion\":\"0.3.0\","}

event: attempt
data: {"attempt":1,"report":{"valid":true,"errors":0,"warnings":0,"findings":[]}}

event: done
data: {"document":{...},"report":{...},"attempts":1,"usage":{"inputTokens":3200,"outputTokens":900}}
```

| Event | Data |
|---|---|
| `started` | `remembered` and `exemplars`, once |
| `text` | `attempt` and a piece of the model's `text` |
| `attempt` | `attempt` and the `report` on that answer |
| `repaired` | `attempt` and `report`, when an answer passes after a repair |
| `done` | Last: `{ document, report, attempts, usage }`, the same as the JSON answer |
| `error` | Last, instead of `done`: `code` (`invalid`, `generator`, `timeout`, `setup` or `aborted`), a `message`, the provider's `status` when there is one, and the `result` when the runtime gave up |

The status is 200 once streaming starts, so read the last event to know how it ended. While the model thinks, the server sends a `: keep-alive` comment every 15 seconds so proxies keep the connection open. Closing the connection aborts the model call.

`EventSource` only sends GET, so read the stream with `fetch`:

```ts
const res = await fetch(`${server}/v1/generate`, {
  method: "POST",
  headers: { "content-type": "application/json", accept: "text/event-stream", authorization: `Bearer ${token}` },
  body: JSON.stringify({ ask, intent, capabilities, data }),
});
const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
let buffer = "";
for (;;) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += value;
  let end;
  while ((end = buffer.indexOf("\n\n")) >= 0) {
    const block = buffer.slice(0, end);
    buffer = buffer.slice(end + 2);
    const event = /^event: (.*)$/m.exec(block)?.[1];
    const data = /^data: (.*)$/m.exec(block)?.[1];
    if (event === "done") show(JSON.parse(data!).document);
    if (event === "error") showFallback(JSON.parse(data!).code);
  }
}
```

### Validate and verify

Both take `{ document, data? }`. `data` replaces the document's own data.

`/v1/validate` runs the spec validator, with your Direction's `emphasisBudget`, and returns `{ valid, errors, warnings, issues }`. Each issue has a `severity`, a JSON Pointer `at`, and a `message`.

`/v1/verify` runs the verifier's document checks from `@polyxd/verifier/static`: the validator, the declared pattern, capabilities, your Direction's rules and voice, and the agent-readiness checks. It checks capabilities against your whole registry, or against `capabilities` in the body if you send them. It returns `{ valid, errors, warnings, findings }`. The rendered checks need a browser, so run [`polyxd-verify`](/docs/verifier/) for those.

## Callers and browsers

- **Token.** Set `POLYXD_SERVER_TOKEN` and send `Authorization: Bearer <token>`. The comparison takes the same time whatever the token, so it can't be guessed a character at a time. Only `/v1/health` is open, for load balancers and the Docker health check.
- **CORS.** By default no browser page can call the server. `POLYXD_CORS_ORIGINS` names the origins that can. A request from any other origin gets a 403, before any model call. `*` allows every origin; use it only with a token, or on a private network.
- **Limits.** Bodies over `POLYXD_MAX_BODY_BYTES` are refused, whether or not they say their length. A generation that runs past `POLYXD_TIMEOUT_MS` is aborted.

A token in a web page is readable by anyone who opens the page. For a browser app, call the server from your own backend, or put it behind the sign-in your product already has.

## Privacy

The server logs one JSON line per request with four fields:

```
{"method":"POST","path":"/v1/generate","status":200,"ms":2140}
```

It never logs the ask, the data, the document, a header or a query string. It keeps nothing between requests: no interface memory, no history. Error messages it sends never repeat what the provider said, so a provider's answer can't leak into your client. The package sends no telemetry.

The model provider does see the ask and the data, as it would with the runtime. Choose `local` to keep them on your own machines.

## From code

The server is also a library, for tests or to run it inside your own Node process:

```ts
import { createServer, configFromEnv } from "@polyxd/server";
import { anthropic } from "@polyxd/runtime";

const server = createServer({
  generator: anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
  direction,           // your direction.json, parsed
  registry,            // your capability registry, parsed
  token: process.env.POLYXD_SERVER_TOKEN,
});
server.listen(8080);
```

`createServer` returns a Node `http.Server` and takes the settings above as options (`token`, `corsOrigins`, `maxBodyBytes`, `timeoutMs`, `maxRepairs`, `resolveExemplar`), plus `runtime` in place of `generator` if you built one yourself, and `log` to send the log lines somewhere else. The server's own tests pass a fake generator this way, with no network and no key.

| Export | What it does |
|---|---|
| `createServer(options)` | The server, as a Node `http.Server` |
| `configFromEnv(env)` | Every setting from environment variables, as the bin reads them. Throws a `ConfigError` that says what to fix |
| `generatorFromEnv(env)` | Just the generator, from `POLYXD_PROVIDER`, `POLYXD_MODEL`, the key and `POLYXD_BASE_URL` |
| `ConfigError` | What `configFromEnv` throws |
| `PROVIDERS` | The providers `POLYXD_PROVIDER` accepts |
| `ENV_HELP` | The text `--help` prints |
| `VERSION` | The server's version |

## Not yet

- On npm and on GitHub Container Registry. The release workflow builds the image and pushes it on a version tag, once `@polyxd/server` has been published.
- Interface memory. The runtime can remember the screen per intent, but a server shared by many people would mix theirs up, so the server keeps none.
- Rate limiting per caller. Put the server behind a gateway or proxy that does it.
