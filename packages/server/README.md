# @polyxd/server

A generation server for Polyxd: [`@polyxd/runtime`](../runtime/) behind a small HTTP API, pointed at the model you choose. Your app sends an ask; the server builds the prompt from the spec and your Design Direction, calls the model, checks the answer, repairs it, and returns the document, as JSON or streamed as server-sent events. It keeps no state between requests and logs only the method, path, status and duration of each one.

It is on npm. Run it with `npx @polyxd/server`, or with Docker: `docker run -p 8080:8080 ghcr.io/visualfart/polyxd-server:0.4.2`. Docs: [polyxd.com/docs/server](https://polyxd.com/docs/server/).

```sh
# Docker, from the repository root
docker build -f packages/server/Dockerfile -t polyxd-server .
docker run --rm -p 8080:8080 -e POLYXD_PROVIDER=anthropic -e ANTHROPIC_API_KEY polyxd-server

# Node, from a clone (npx @polyxd/server once it is on npm)
npm install && npm run build -w @polyxd/server
POLYXD_PROVIDER=local POLYXD_MODEL=qwen3:8b node packages/server/dist/bin.js
```

## Settings

| Variable | |
|---|---|
| `POLYXD_PROVIDER` | `anthropic`, `openai`, `gemini` or `local` (required) |
| `POLYXD_MODEL` | The model id (required except for `anthropic`, default `claude-sonnet-5`) |
| `POLYXD_API_KEY` | The key; or `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY` |
| `POLYXD_BASE_URL` | A local server (default `http://localhost:11434/v1`) or a proxy |
| `POLYXD_DIRECTION` | Path to your Design Direction; exemplar paths are read relative to it |
| `POLYXD_REGISTRY` | Path to your capability registry, so callers can offer capabilities by name |
| `POLYXD_SERVER_TOKEN` | Require `Authorization: Bearer <token>` on everything but `/v1/health` |
| `POLYXD_CORS_ORIGINS` | Comma-separated browser origins allowed to call, or `*`. Default none |
| `POLYXD_MAX_BODY_BYTES` | Default 1048576 |
| `POLYXD_TIMEOUT_MS` | Default 120000; the model call is aborted after it |
| `POLYXD_MAX_REPAIRS` | Default 2 |
| `PORT`, `HOST` | Default `8080` on `127.0.0.1` (the image sets `0.0.0.0`) |

`--help` prints the same list. A missing or wrong setting stops the server at start with a message saying what to set.

## Endpoints

| | |
|---|---|
| `POST /v1/generate` | `{ ask, intent, capabilities?, data?, pattern? }` → `{ document, report, attempts, usage }`. 200 when valid, 422 when every repair failed (the last document and report are still there), 502 when the provider failed, 504 on timeout. `capabilities` is a list of names from the registry, or full definitions by name |
| `POST /v1/generate` with `Accept: text/event-stream` | The runtime's progress as SSE: `started`, `text`, `attempt`, `repaired`, then `done` (the same body as the JSON answer) or `error` (`code`, `message`, and `status` or `result` when there is one). Keep-alive comments every 15 seconds |
| `POST /v1/validate` | `{ document, data? }` → the spec validator's `{ valid, errors, warnings, issues }` |
| `POST /v1/verify` | `{ document, data?, capabilities? }` → the verifier's document checks (`@polyxd/verifier/static`) with the Direction's rules and the registry |
| `GET /v1/spec` | Server and spec versions, the components a generated screen may use, the patterns, the Direction's name, the capability names |
| `GET /v1/health` | `{ status: "ok", version }`, never behind the token |

A caller that disconnects aborts the model call. Errors are `{ error: { code, message } }`, and never repeat what the provider said.

## From code

```ts
import { createServer } from "@polyxd/server";

createServer({ generator, direction, registry, token }).listen(8080);
```

`createServer` returns a Node `http.Server`. It takes `runtime` or `generator`, and `direction`, `registry`, `resolveExemplar`, `maxRepairs`, `token`, `corsOrigins`, `maxBodyBytes`, `timeoutMs`, `heartbeatMs` and `log`. `configFromEnv()` and `generatorFromEnv()` read the same environment variables the bin does.

## Tests

`npm test -w @polyxd/server` starts the server on an ephemeral port with a fake generator: JSON and streamed generation, repair and giving up, provider failures, request errors, validate and verify, the token, CORS, the body limit, aborting on disconnect, the timeout, keep-alives, what the log holds, the settings, and the built bin. No network and no keys.

## Image

`packages/server/Dockerfile` builds from the repository root in three stages: compile the five packages the server is made of, install their packed tarballs with production dependencies only (no Playwright, no browser), and run on `node:26-slim` as the unprivileged `node` user with a health check on `/v1/health`. The release workflow pushes it to `ghcr.io/visualfart/polyxd-server` on a version tag, after the npm publish succeeds.
