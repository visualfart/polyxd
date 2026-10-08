---
name: polyxd-screens
description: Show an interactive screen in the chat with the Polyxd MCP server (a form, a review, a comparison, a dashboard, a confirmation) in a real design system such as Material 3, Carbon, GOV.UK or shadcn/ui. Use when the user asks to see something as a screen or UI, or when a form or choice would serve them better than text.
---

# Show a screen with Polyxd

The Polyxd MCP server (bundled with this plugin) turns a small JSON document of meaning into a real screen. You write the document; the server checks it and shows it.

## The loop

1. **`polyxd_guide`**, once per conversation, before your first document. It is the full format: the document shape, bindings, actions, every component and the patterns. Don't write a document from memory.
2. **Write the document.** Bind every value the screen shows to `data` with `{"path": "/pointer"}`; never invent numbers the user didn't give. One primary action per view, at most six inputs, labels that say what happens.
3. **`polyxd_validate`** until it has no errors. Each issue has a JSON Pointer and a fix hint.
4. **`polyxd_verify`** when the user asks for a check, or with a Design Direction or capability registry.
5. **`polyxd_show`** with the document, its `data`, and a `pack` ("material3", "carbon", "govuk", "shadcn", or a name like "IBM Carbon") and `mode` ("light" or "dark"). `polyxd_packs` lists all 25.

## When the user presses a button

The press comes back as the user's next message, naming the action and the values they entered. A press only says what they chose: it submits, pays and saves nothing, so never say it did. Carry on from what they chose.

## Questions about Polyxd itself

For how to install a renderer, run the verifier, use the runtime or anything else in the docs, call **`polyxd_docs`** with a `query` and cite the URLs it returns, rather than answering from memory.
