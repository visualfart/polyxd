# @polyxd/mcp

An MCP server for Polyxd. The host's model is the generator: the server gives it the spec as instructions, checks the UI documents it writes, and shows them to the user as an **MCP App**, drawn by the Polyxd renderer in any design-system pack.

```sh
npx -y @polyxd/mcp        # stdio
```

Or connect by URL to the hosted server, which needs no account and no sign-in:

```
https://mcp.polyxd.com/mcp
```

## Connect by URL

- **Claude** (claude.ai, and Claude Desktop through your account): **Customize > Connectors > Add custom connector**, paste the URL, **No sign-in**.
- **Claude Code**: `claude mcp add --transport http polyxd https://mcp.polyxd.com/mcp`
- **ChatGPT**: turn on developer mode (**Settings > Security and login**), then add it at [chatgpt.com/plugins](https://chatgpt.com/plugins) with the URL and no authentication.
- **Cursor**: `{ "mcpServers": { "polyxd": { "url": "https://mcp.polyxd.com/mcp" } } }` in `~/.cursor/mcp.json`.
- **VS Code**: `{ "servers": { "polyxd": { "type": "http", "url": "https://mcp.polyxd.com/mcp" } } }` in `.vscode/mcp.json`.

## Add it to a host over stdio

Claude Desktop (`claude_desktop_config.json`) and most other MCP clients:

```json
{
  "mcpServers": {
    "polyxd": { "command": "npx", "args": ["-y", "@polyxd/mcp"] }
  }
}
```

Claude Code:

```sh
claude mcp add polyxd -- npx -y @polyxd/mcp
```

From a clone of this repository: `npm install && npm run build -w @polyxd/mcp`, then use `node <repo>/packages/mcp/dist/bin.js` as the command.

## Tools

| Tool | What it does | `structuredContent` |
|---|---|---|
| `polyxd_guide` | The spec as instructions: how to use these tools, then the generator prompt the demos use (document shape, rules for generated screens, bindings, actions, every component and its props, the patterns). | `{ specVersion, guide }`, the guide being the same text as the content |
| `polyxd_validate` | Validates a document. Every issue comes with its JSON Pointer, the component it is in, and a hint saying what to change. | `{ valid, errors, warnings, issues[{ severity, pointer, component?, message, hint? }] }` |
| `polyxd_verify` | The verifier's document checks (`staticAudit` from `@polyxd/verifier/static`, so installing the server installs no Playwright), optionally against a Design Direction (an object, or `calm-finance` / `playful-personal`) and a capability registry. A compact report. | `{ errors, warnings, findings[{ severity, check, message, hint? }], direction?, rules }` |
| `polyxd_show` | Validates, then returns the document for display. `pack` picks the design-system pack (default `material3`), `mode` picks light or dark (default: the host's theme). Shows nothing when there are errors. | `{ shown: true, document, pack, packName, mode?, specVersion }`, or `{ shown: false, issues }` with `isError` |
| `polyxd_packs` | The packs: published design systems and original templates. | `{ default, packs[{ name, displayName, template, package, description }] }` |
| `polyxd_components` | The components with a one-line summary each, or one component's full definition by `name`. | `{ components[{ name, category, summary, shell }] }`, or `{ component }` with the full definition |
| `polyxd_docs` | Searches the polyxd.com docs bundled into this version: the sections that best match `query`, one whole `page`, or the list of pages. | `{ sections[{ page, title, heading, url, text }] }`, `{ page }` or `{ pages[] }` |

Every tool is read-only. `data` can be passed to `polyxd_validate`, `polyxd_verify` and `polyxd_show` separately from the document; it replaces the document's own `data`.

Every tool declares an `outputSchema` (JSON Schema 2020-12, in `src/output-schemas.ts`, each property described for the model), and every successful result carries `structuredContent` that conforms to it; the SDK checks each one before it is sent. Error results (`isError: true`) are not held to the schema: `polyxd_show`'s not-shown result still conforms, the others carry text only.

## Resources

- `ui://polyxd/surface.html` (`text/html;profile=mcp-app`): the MCP App.
- `polyxd://examples/<name>.json`: the spec's example documents.
- `polyxd://directions/<name>.json`: the spec's example Design Directions.

## The MCP App

`polyxd_show` declares `_meta.ui.resourceUri: "ui://polyxd/surface.html"`, per the MCP Apps extension (SEP-1865, `2026-01-26`), and ChatGPT's alias `openai/outputTemplate`. A host that supports MCP Apps reads that resource and renders it in a sandboxed iframe. The page is self-contained: the `@polyxd/web` renderer, the renderer's stylesheet and every pack's theme, inlined, with no external origins, so the host's default Content Security Policy is enough.

The resource's `_meta` says so for each host (`appResourceMeta()`):

- `ui.csp`: `{ connectDomains: [], resourceDomains: [] }`. The page loads nothing.
- `ui.prefersBorder: true`.
- ChatGPT's own keys: `openai/widgetCSP` (the same empty lists), `openai/widgetPrefersBorder`, `openai/widgetDescription`, and `openai/widgetDomain: "https://mcp.polyxd.com"`, the origin ChatGPT gives the app's sandbox.
- No `ui.domain`. Claude wants a hash of the connector URL there and ChatGPT wants an origin, and Claude refuses to render an app whose `ui.domain` is not its own format. The page needs no stable origin, so it sets none, and ChatGPT reads `openai/widgetDomain` instead.

The page speaks the MCP Apps protocol over `postMessage`: `ui/initialize`, then `ui/notifications/initialized`. It renders the document from the `ui/notifications/tool-result` notification's `structuredContent`, in the chosen pack, light or dark from the host's `theme` unless `mode` was given. It reports its height with `ui/notifications/size-changed`.

When the user presses an action, the page sends `ui/message` with a user message naming the action, the button's label and the action's context (the values bound into it, including what the user typed):

```
[Polyxd] In the "New task" screen I pressed "Add task" (action task.save).
Context: {"title":"Buy milk","due":"2026-10-01"}
```

The model receives that as the user's next message and acts on it. Closing the screen (`ui.dismiss`) arrives the same way. A host without MCP Apps support gets `polyxd_show`'s text summary instead.

## The prompt

The generator prompt comes from `@polyxd/runtime`, which builds it from the spec. `src/packs.generated.ts` lists the packs, and `src/spec-files.generated.ts` imports the spec's component definitions and examples as JSON modules, so the server reads no files. `npm run sync -w @polyxd/mcp` rewrites both, and the tests fail if either is out of date.

## Over HTTP

`@polyxd/mcp/http` serves the same server over MCP's Streamable HTTP transport, as a web-standard `(Request) => Promise<Response>` handler. It uses nothing from Node, so it runs in a Cloudflare Worker, Deno or Bun.

```ts
import { createHttpHandler, rateLimiter } from "@polyxd/mcp/http";
import viewHtml from "@polyxd/mcp/view.html"; // bundled as text

const mcp = createHttpHandler({ viewHtml: () => viewHtml, rateLimit: rateLimiter({ limit: 600, windowMs: 60_000 }) });
export default { fetch: (request: Request) => (new URL(request.url).pathname === "/mcp" ? mcp(request) : new Response(null, { status: 404 })) };
```

The transport is the SDK's `createMcpHandler`, stateless: a fresh server per request, no sessions. For 2025-era clients GET and DELETE answer 405, as the spec asks of a server with no standalone stream and no sessions. Clients on the 2026-07-28 protocol, which send the version with every request, work too. Around it:

- **Body limit**: `maxBodyBytes`, default 1 MiB, answered 413. It is checked on `Content-Length` first and again as the body is read.
- **Timeout**: `timeoutMs`, default 15 seconds, for the whole answer. Late answers get a JSON-RPC error: a 504, or on an SSE stream an error for the request's id.
- **Rate limit**: `rateLimit(request)` returns false for 429 with `Retry-After`. `rateLimiter()` is a fixed window in memory, keyed on `CF-Connecting-IP`. It counts per process or per Worker isolate, so it is best effort.
- **CORS**: any origin, since the server holds no credentials and no one's data. Preflights allow the headers they ask for, and responses expose `Mcp-Session-Id` and `Mcp-Protocol-Version`.
- **Logs**: one line per request with the method, path, status and duration. Nothing else: not a body, a header, a query string, an address or an error message.

## The hosted server

`https://mcp.polyxd.com/mcp` is `apps/mcp`, a Cloudflare Worker: `/mcp` is the handler above, `/health` answers JSON, and `/` redirects to the docs. The view is bundled into the Worker as text (about 2.4 MB in all, 385 KB gzipped). Its rate limit is Cloudflare's rate limiting binding, 600 requests a minute per IP address. That binding counts per Cloudflare location, so it guards against floods rather than enforcing an exact quota. Claude and ChatGPT call from their own servers, which is why the limit is generous. Cloudflare's invocation logs, traces and Issues are off in `wrangler.jsonc`, so the Worker's own lines are all that is kept. With a `POSTHOG_KEY` secret set, the hosted Worker also counts initializes and tool calls anonymously (`apps/mcp/src/analytics.ts`): names and counts only, never a document, its data or an address. This package, and `npx @polyxd/mcp`, send nothing anywhere.

```sh
npm run dev -w @polyxd/mcp-remote                        # wrangler dev on http://127.0.0.1:8787/mcp
node apps/mcp/scripts/smoke.ts http://127.0.0.1:8787/mcp  # every tool, in both protocol eras, over real HTTP
npm run deploy -w @polyxd/mcp-remote                     # builds @polyxd/mcp, then wrangler deploy
```

Deploying creates the `mcp.polyxd.com` custom domain on the `polyxd.com` zone. `workers.dev` and preview URLs are off.

## MCP Registry

`server.json` describes the hosted server for the [MCP Registry](https://registry.modelcontextprotocol.io) as `com.polyxd/mcp`. A name under `com.polyxd` needs proof that you control `polyxd.com`:

```sh
openssl genpkey -algorithm Ed25519 -out key.pem
echo "polyxd.com. IN TXT \"v=MCPv1; k=ed25519; p=$(openssl pkey -in key.pem -pubout -outform DER | tail -c 32 | base64)\""
mcp-publisher login dns --domain polyxd.com --private-key "$(openssl pkey -in key.pem -noout -text | grep -A3 'priv:' | tail -n +2 | tr -d ' :\n')"
mcp-publisher publish      # from packages/mcp
```

This needs OpenSSL 3 (macOS's LibreSSL has no Ed25519). Keep `key.pem` private and out of the repository. The TXT record goes on the apex, `polyxd.com`. HTTP proof works instead: serve the same `v=MCPv1; k=ed25519; p=...` line at `https://polyxd.com/.well-known/mcp-registry-auth` and use `mcp-publisher login http`. It has to be `polyxd.com`, not `mcp.polyxd.com`, whose proof would only cover names under `com.polyxd.mcp`.

The release workflow publishes `server.json` to the registry on each version tag, once npm has the version, signing in with the private key in the `MCP_REGISTRY_KEY` Actions secret (the hex string the `--private-key` command above prints). Without the secret, or when the registry already has the version, the step is skipped with a notice.

`server.json` lists both the hosted server (`remotes`) and the npm package (`packages`), so hosts can offer either. The registry checks the package's `mcpName` in `package.json`. Keep both `version` fields in `server.json` in step with `package.json`; a test checks it.

## Build and test

```sh
npm run build -w @polyxd/mcp     # tsc, then scripts/build-view.ts writes dist/view.html
npm test -w @polyxd/mcp
npm test -w @polyxd/mcp-remote   # the Worker's routes
```

The tests connect a client to the server in memory and call every tool on every spec example and on broken documents; start the built bin and speak JSON-RPC to it over stdio; serve it over Streamable HTTP to the SDK client in both protocol eras, and send the raw requests a client library never would (bad JSON, oversize bodies, too many requests, preflights, slow answers); bundle the HTTP entry for a Worker and check it needs nothing from Node; and load the MCP App in headless Chromium with the test playing the host, from the handshake to an action arriving as `ui/message`. The browser tests skip when Playwright has no Chromium (`npx playwright install chromium`).
