---
title: MCP server
description: "@polyxd/mcp lets the model in Claude, or any MCP host, write Polyxd documents, check them, and show them to the user as a real screen in any design-system pack."
order: 21.5
section: Guides
---

# MCP server

`@polyxd/mcp` is an [MCP](https://modelcontextprotocol.io) server. The model in the host is the generator. The server gives it the spec as instructions and checks the documents it writes. Then it shows each one to the user as an **MCP App**: a real screen, drawn by the Polyxd renderer in the design-system pack the model picks. When the user presses a button in that screen, the model hears about it.

It runs two ways. Polyxd hosts it at `https://mcp.polyxd.com/mcp`, so you can connect by URL. Or you run it on your own machine over stdio:

```sh
npx -y @polyxd/mcp
```

## Connect by URL

The hosted server is at this address:

```
https://mcp.polyxd.com/mcp
```

It is listed in the official [MCP Registry](https://registry.modelcontextprotocol.io/v0/servers?search=com.polyxd) as `com.polyxd/mcp`, so apps that read the registry can find it by name.

It needs no account and no sign-in. Every tool is read-only. The server keeps nothing between requests, and it never sees your conversation, only the documents the model sends to its tools.

**Claude.** In claude.ai, open **Customize > Connectors** and click **Add custom connector**. Paste the URL, choose **No sign-in** if Claude asks about authentication, and click **Add**. Then turn the connector on for a chat from **+ > Connectors**. On the Free plan you can add one custom connector.

**Claude Desktop.** Claude Desktop uses the connectors on your claude.ai account, so add it in claude.ai as above and it shows up in the app too.

**Claude Code.**

```sh
claude mcp add --transport http polyxd https://mcp.polyxd.com/mcp
```

**ChatGPT.** Custom servers need developer mode. Open **Settings > Security and login** and turn on **Developer mode**. Then go to [chatgpt.com/plugins](https://chatgpt.com/plugins) and select the plus button. Give it a name, such as Polyxd, and enter the URL under **Connection**. The server needs no authentication. Your workspace's policy decides whether developer mode is available to you.

**Cursor.** Add this to `~/.cursor/mcp.json`, or to `.cursor/mcp.json` in a project:

```json
{
  "mcpServers": {
    "polyxd": { "url": "https://mcp.polyxd.com/mcp" }
  }
}
```

**VS Code.** Add this to `.vscode/mcp.json` in a workspace, or run **MCP: Add Server** and choose HTTP:

```json
{
  "servers": {
    "polyxd": { "type": "http", "url": "https://mcp.polyxd.com/mcp" }
  }
}
```

**Grok.** At [grok.com/connectors](https://grok.com/connectors), choose **New Connector**, then **Custom**, and paste the URL. It needs no sign-in. We haven't confirmed that Grok draws MCP Apps; where a client doesn't, `polyxd_show` still answers with a text summary of the screen, and every other tool works as usual. Developers calling the xAI API can pass the same URL as a [remote MCP tool](https://docs.x.ai/developers/tools/remote-mcp).

**Other clients.** Any client that speaks MCP's Streamable HTTP transport can use the URL. A client that can only start local commands can run the stdio server instead, below.

The hosted server takes request bodies up to 1 MB and answers within 15 seconds. One address can make 600 requests a minute. For each request it logs the method, the path, the status and how long it took. It never logs what you send.

The hosted server also counts its use, anonymously, in PostHog. When a client connects, it counts the client's name and version and the protocol version. For each tool call, it counts the tool, whether it worked and the kind of error, the pack and mode of a shown screen, how many of each component type the document used, how many errors and warnings came back, how long it took, and the product name from the User-Agent. Each event has a new random id. It never sends the document, its data, a Direction, the IP address or anything from your conversation. The [privacy policy](/privacy/#the-hosted-mcp-server) has the details. The server you run yourself, below, sends nothing anywhere.

## Run it on your machine

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

**From a clone.** To run your own changes, clone the [repository](https://github.com/visualfart/polyxd), run `npm install && npm run build -w @polyxd/mcp`, then use `node <repo>/packages/mcp/dist/bin.js` as the command.

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
| `polyxd_docs` | The polyxd.com docs, as of the server's version: the sections that best match a `query`, one whole `page`, or the list of pages, each with its URL to cite. |

`polyxd_validate`, `polyxd_verify` and `polyxd_show` also take `data`: the values the screen shows. It replaces the document's own `data`.

Every tool also returns its result as structured data, and says what that data looks like: each declares an output schema. `polyxd_validate` gives `valid`, the counts and every issue with its pointer and hint. `polyxd_verify` gives the counts and the findings. `polyxd_show` gives the document as shown, with the pack, or `shown: false` and the issues. `polyxd_guide` gives the guide's text and the spec version.

`polyxd_verify` runs the document checks only, from `@polyxd/verifier/static`, so installing the server installs no Playwright and no browser. The rendered checks (accessibility, layout and agent tasks) need a browser, so run [`polyxd-verify`](/docs/verifier/) for those.

The server also lists the spec's example documents as resources (`polyxd://examples/<name>.json`), and the example Design Directions (`polyxd://directions/<name>.json`).

## The MCP App

`polyxd_show` points at one UI resource, `ui://polyxd/surface.html`, in its `_meta.ui.resourceUri`. That is how the [MCP Apps](https://github.com/modelcontextprotocol/ext-apps) extension links a tool to a screen. The host loads the page in a sandboxed iframe.

The page holds the [Web Components renderer](/docs/renderers/), its stylesheet and every pack's theme. Nothing loads from anywhere else, so the host's strictest content rules are enough. The resource says so: its `_meta.ui.csp` lists no domains at all. It also asks for a border (`prefersBorder`). ChatGPT reads its own names for the same things (`openai/widgetCSP`, `openai/widgetDomain` and the rest), and the resource carries those too, so the screen shows there as well.

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
