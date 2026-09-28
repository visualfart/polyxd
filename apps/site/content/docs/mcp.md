---
title: MCP server
description: "@polyxd/mcp lets the model in Claude, or any MCP host, write Polyxd documents, check them, and show them to the user as a real screen in any design-system pack."
order: 21.5
section: Guides
---

# MCP server

`@polyxd/mcp` is an [MCP](https://modelcontextprotocol.io) server. The model in the host is the generator. The server gives it the spec as instructions and checks the documents it writes. Then it shows each one to the user as an **MCP App**: a real screen, drawn by the Polyxd renderer in the design-system pack the model picks. When the user presses a button in that screen, the model hears about it.

It runs over stdio:

```sh
npx -y @polyxd/mcp
```

## Add it to a host

**Claude Desktop.** Add the server to `claude_desktop_config.json`, then restart Claude Desktop:

```json
{
  "mcpServers": {
    "polyxd": { "command": "npx", "args": ["-y", "@polyxd/mcp"] }
  }
}
```

**Claude Code.**

```sh
claude mcp add polyxd -- npx -y @polyxd/mcp
```

**Other MCP clients.** Use the same command and arguments: `npx`, with `-y @polyxd/mcp`. The screen shows in hosts that support MCP Apps. Other hosts get a text summary instead, and every tool still works.

**From a clone.** `@polyxd/mcp` is built but not yet on npm, so until it is, `npx` can't fetch it. Clone the [repository](https://github.com/visualfart/polyxd), run `npm install && npm run build -w @polyxd/mcp`, then use `node <repo>/packages/mcp/dist/bin.js` as the command.

## The tools

All six are read-only.

| Tool | What it does |
|---|---|
| `polyxd_guide` | The spec as instructions. First, how to use these tools. Then the generator prompt the [demos](/demos/) use: the document shape, the rules for generated screens, bindings, actions, every component with its props, and the patterns. |
| `polyxd_validate` | Validates a document. Each issue has a JSON Pointer, the component it is in, and a hint saying what to change. |
| `polyxd_verify` | The [verifier](/docs/verifier/)'s document checks, as a short report. Pass a [Design Direction](/docs/design-direction/) to check its rules and voice too: the object itself, or the name of an example (`calm-finance`, `playful-personal`). A capability registry is optional. |
| `polyxd_show` | Validates the document, then shows it. `pack` picks the design system (default `material3`). `mode` picks light or dark (default: the host's theme). A document with errors is not shown. |
| `polyxd_packs` | Every pack: the published design systems and the original templates. |
| `polyxd_components` | Every component with a one-line summary, or one component's full definition by `name`. |

`polyxd_validate`, `polyxd_verify` and `polyxd_show` also take `data`: the values the screen shows. It replaces the document's own `data`.

`polyxd_verify` runs the document checks only. The rendered checks (accessibility, layout and agent tasks) need a browser, so run [`polyxd-verify`](/docs/verifier/) for those.

The server also lists the spec's example documents as resources (`polyxd://examples/<name>.json`), and the example Design Directions (`polyxd://directions/<name>.json`).

## The MCP App

`polyxd_show` points at one UI resource, `ui://polyxd/surface.html`, in its `_meta.ui.resourceUri`. That is how the [MCP Apps](https://github.com/modelcontextprotocol/ext-apps) extension links a tool to a screen. The host loads the page in a sandboxed iframe.

The page holds the [Web Components renderer](/docs/renderers/), its stylesheet and every pack's theme. Nothing loads from anywhere else, so the host's strictest content rules are enough.

The page talks to the host over `postMessage`, as the MCP Apps spec says. It sends `ui/initialize` and `ui/notifications/initialized`. It renders the document from the tool result, in the chosen pack. It follows the host's light or dark theme unless the model set `mode`. It tells the host its height so the frame fits.

## When the user acts

When the user presses an action, the page sends the host a `ui/message`. That is a chat message from the user. It names the action and the button's label, and it carries the action's context. The context holds the values bound into the action, including what the user typed:

```
[Polyxd] In the "New task" screen I pressed "Add task" (action task.save).
Context: {"title":"Buy milk","due":"2026-10-01"}
```

The model reads it as the user's next message and acts on it. Closing the screen (`ui.dismiss`) arrives the same way. Nothing else happens on its own: the server never runs an action.

Nobody registers capabilities with this server. So the guide tells the model to name each action for what it will do when the action arrives, such as `task.save` or `booking.cancel`.

## The prompt

The guide uses the same generator prompt as the [runtime](/docs/runtime), built from the spec, so a model writing screens over MCP gets the same instructions as one the runtime drives.
