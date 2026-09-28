# @polyxd/mcp

An MCP server for Polyxd. The host's model is the generator: the server gives it the spec as instructions, checks the UI documents it writes, and shows them to the user as an **MCP App**, drawn by the Polyxd renderer in any design-system pack.

```sh
npx -y @polyxd/mcp        # stdio
```

## Add it to a host

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

| Tool | What it does |
|---|---|
| `polyxd_guide` | The spec as instructions: how to use these tools, then the generator prompt the demos use (document shape, rules for generated screens, bindings, actions, every component and its props, the patterns). |
| `polyxd_validate` | Validates a document. Every issue comes with its JSON Pointer, the component it is in, and a hint saying what to change. |
| `polyxd_verify` | The verifier's document checks (`staticAudit` from `@polyxd/verifier`), optionally against a Design Direction (an object, or `calm-finance` / `playful-personal`) and a capability registry. A compact report. |
| `polyxd_show` | Validates, then returns the document for display. `pack` picks the design-system pack (default `material3`), `mode` picks light or dark (default: the host's theme). Shows nothing when there are errors. |
| `polyxd_packs` | The packs: published design systems and original templates. |
| `polyxd_components` | The components with a one-line summary each, or one component's full definition by `name`. |

Every tool is read-only. `data` can be passed to `polyxd_validate`, `polyxd_verify` and `polyxd_show` separately from the document; it replaces the document's own `data`.

## Resources

- `ui://polyxd/surface.html` (`text/html;profile=mcp-app`): the MCP App.
- `polyxd://examples/<name>.json`: the spec's example documents.
- `polyxd://directions/<name>.json`: the spec's example Design Directions.

## The MCP App

`polyxd_show` declares `_meta.ui.resourceUri: "ui://polyxd/surface.html"`, per the MCP Apps extension (SEP-1865, `2026-01-26`). A host that supports MCP Apps reads that resource and renders it in a sandboxed iframe. The page is self-contained: the `@polyxd/web` renderer, the renderer's stylesheet and every pack's theme, inlined, with no external origins, so the host's default Content Security Policy is enough.

The page speaks the MCP Apps protocol over `postMessage`: `ui/initialize`, then `ui/notifications/initialized`. It renders the document from the `ui/notifications/tool-result` notification's `structuredContent`, in the chosen pack, light or dark from the host's `theme` unless `mode` was given. It reports its height with `ui/notifications/size-changed`.

When the user presses an action, the page sends `ui/message` with a user message naming the action, the button's label and the action's context (the values bound into it, including what the user typed):

```
[Polyxd] In the "New task" screen I pressed "Add task" (action task.save).
Context: {"title":"Buy milk","due":"2026-10-01"}
```

The model receives that as the user's next message and acts on it. Closing the screen (`ui.dismiss`) arrives the same way. A host without MCP Apps support gets `polyxd_show`'s text summary instead.

## The prompt

`src/prompt.generated.ts` is the generator prompt that `apps/demos/scripts/build-prompt.ts` builds from the spec, copied unchanged by `npm run sync -w @polyxd/mcp`; `src/packs.generated.ts` lists the packs. The tests fail if either is out of date. `src/prompt.ts` is the only module that reads the prompt.

## Build and test

```sh
npm run build -w @polyxd/mcp     # tsc, then scripts/build-view.ts writes dist/view.html
npm test -w @polyxd/mcp
```

The tests connect a client to the server in memory and call every tool on every spec example and on broken documents; start the built bin and speak JSON-RPC to it over stdio; and load the MCP App in headless Chromium with the test playing the host, from the handshake to an action arriving as `ui/message`. The browser tests skip when Playwright has no Chromium (`npx playwright install chromium`).
