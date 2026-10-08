# Polyxd for Cursor

Interactive screens in the chat, in a real design system, checked before anyone sees them; and help putting Polyxd into your own code.

## What it adds

- **The Polyxd MCP server** (`https://mcp.polyxd.com/mcp`, no account or key). Its tools write nothing anywhere:
  - `polyxd_guide`: the document format, read once before the first screen.
  - `polyxd_validate`, `polyxd_verify`: check a document against the spec, a Design Direction and a capability registry.
  - `polyxd_show`: draw it in any of 25 design-system packs, light or dark. Where the chat can't show interactive screens, the tool returns a text summary instead.
  - `polyxd_packs`, `polyxd_components`: what's available.
  - `polyxd_docs`: answers from the Polyxd docs, with links.
- **Skills**: `polyxd-screens` (show a screen in the chat) and `add-polyxd` (render, validate and verify Polyxd documents in your app, and make a pack from your own tokens).
- **A rule** for writing and editing Polyxd documents.

## Try it

- "Show me a form to split Friday's dinner between four of us, in Material 3."
- "Compare these three plans as a screen in shadcn, dark mode."
- "Add Polyxd to this app and render `screens/checkout.json` in our design system."
- "How do I run the Polyxd verifier in CI?"

## Prefer to run it locally?

`npx -y @polyxd/mcp` runs the same server over stdio. See [polyxd.com/docs/mcp](https://polyxd.com/docs/mcp/).

## Privacy

The hosted server counts tool calls anonymously and never records documents, data or questions. See [polyxd.com/privacy](https://polyxd.com/privacy/#the-hosted-mcp-server). Apache-2.0.
