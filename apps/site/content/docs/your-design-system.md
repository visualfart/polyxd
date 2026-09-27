---
title: Your design system
description: Make a Polyxd pack out of your own tokens with one command, and find out in a minute what the contract still needs from you.
order: 3
section: Start
---

# Your design system

Polyxd ships thirteen packs — Material 3, Carbon, Ant, Fluent, shadcn, Bootstrap, Mantine, Radix, Polaris, Primer, Spectrum, GOV.UK, Chakra. You almost certainly want a fourteenth: yours.

```sh
npx polyxd pack ./src/tokens.css
```

That reads your CSS custom properties, works out which of the contract's 87 tokens each one is, and writes a pack plus `polyxd.mapping.json` recording every guess it made. Correct the wrong lines, fill the blanks, run it again.

It takes a DTCG JSON file too, and `--dark ./dark.css` when your two modes live in separate files.

## What one run looks like

```
read 42 variables from tokens.css

mapped 61 of 87 contract tokens
  46 from their names
  color.surface.default ← acme-bg (the lightest colour you define)
  color.text.default ← acme-text (17.8:1 on your page colour)

15 tokens took a Polyxd default (state opacities, touch target, focus ring, motion).

still needed — nothing in your tokens matched, and there is no sensible default:
  color.scrim                        (color)
  color.text.link                    (color)
  color.action.secondary.border      (color)

3 of your own pairs don't meet the contrast the contract requires:
  color.border.strong on color.surface.default: 2.56:1, needs 3:1
  color.border.focus on color.surface.default: 1.80:1, needs 3:1
  These are your tokens, not ours — the pack won't paper over them.
```

Three questions to answer and two decisions to make, rather than a specification to read.

## How it guesses

**Names first.** A variable called `--border-focus` is telling you what it is. Patterns are matched against the name and every suffix of it, so `--acme-border` and `--border` map alike — real files mix prefixed and bare names, so guessing one project-wide prefix doesn't work.

**Then the kind of value.** A `16px` never becomes a colour, whatever it's called.

**Then measurement,** for the two roles defined by contrast rather than by name: your page colour is the lightest you define, and your body text is the furthest from it that still clears 4.5:1.

**Then what one role implies about another.** A system that names a success colour has said enough for a chart's positive series. A system with an informative tint has said enough for a selected row. Each of these is marked `derived` and names where it came from, so you can disagree.

**Never invention.** Where the contract needs something your tokens don't have, it says so. It will not pick a colour for you.

## What Polyxd fills in

Fifteen tokens aren't values a design system publishes: state-layer opacities, the 44px touch target, the focus ring's width and offset, the 65-character measure, and motion durations when you have none. These are the same for everyone and you shouldn't have to invent them. Override any of them in the mapping.

## Then check it

```sh
npx polyxd check ./ds-acme/manifest.json
```

Every token present and correctly typed, all 34 contrast pairs measured with alpha compositing, every constraint met. This is the same check the thirteen shipped packs pass, and it's the thing that tells you a generated interface in your design system will be readable before anyone sees it.

## Preview documents as you write them

```sh
npx polyxd dev ./screens
```

`polyxd dev` watches a folder for Polyxd documents (a JSON file with `specVersion` and `components`, or an intent file with a `document` inside) and opens a page that renders the one you pick with the real renderer. Switch it between every built-in design system, or your own pack with `--pack ./ds-acme/manifest.json`; light and dark; phone, tablet and desktop, or drag the edge to any width; compact to spacious. Beside the surface sit the static check (schema, structure, and every binding against the data, so a path that reads nothing shows up before anyone sees a blank), the document, its data, and a log of the actions the surface dispatches with their context resolved. Save the file and the surface reloads in place; your selection and controls stay.

Data comes from the document's own `data`, from a `<name>.data.json` beside it, or from `--data sample.json` for every document that has none. With `--verify`, a button runs the full verifier (13 packs, light and dark, phone and desktop, with axe and the layout check) and streams the result into the panel (`npm install -D @polyxd/verifier` first). Documents that name `"$schema": "https://polyxd.com/schema/0.3/ui.schema.json"` also get completion and hover text in VS Code, Cursor, Zed and JetBrains without anything installed.

## In your editor

The **Polyxd** extension for VS Code (it runs in Cursor and Windsurf too) puts the same things next to the file you're editing, without a server to start.

- **The schema, without configuration.** Files matching `*.polyxd.json`, `authored/*.json`, `intents/*.json` and `screens/*.json` get completion, hover text from the spec's descriptions and squiggles from the bundled JSON Schema. A file anywhere else needs only the `$schema` line.
- **The static check as you type.** The spec's validator runs on every edit and on save, against the document's own `data` or the `<name>.data.json` beside it. A structural problem is an error; a binding that reads nothing is a warning with a "did you mean". Each one is underlined at its line, not listed somewhere else.
- **A preview beside the editor.** *Polyxd: Open preview* (or the icon in the title bar of a document file) renders the active document with the real renderer: any of the thirteen packs or your own with the `polyxd.pack` setting pointing at a `manifest.json` or theme stylesheet; light or dark, defaulting to your editor's theme; phone, tablet, desktop, or drag the edge; compact to spacious. It updates as you type and keeps the surface mounted, so what you typed into an input survives a keystroke in the JSON. Click a component in the preview and the cursor goes to its JSON; put the cursor in a component's JSON and the preview outlines it. Actions the surface dispatches log underneath with their context resolved.
- **Commands.** *Verify document* runs `polyxd-verify` from your workspace in a task terminal, every pack, light and dark, 390 and 1100, and tells you how it went. *Insert component* offers the 44 components by category with the spec's one-line summary and drops a valid skeleton at the cursor, tab stops on the placeholders. *Open in Studio* copies the document and opens Studio, where "Paste JSON" makes a screen of it. *Push to Studio* runs `polyxd studio push` with a key from `POLYXD_STUDIO_KEY` or the editor's secret storage, never from a settings file.
- **Polyxd documents** in the Explorer: every document in the workspace by folder, with the check's status as a dot.

It's in the repository at `apps/vscode`; build it with `npm run build -w polyxd-vscode`, package it with `vsce package`, and install the `.vsix` with `code --install-extension` (or Extensions → Install from VSIX in Cursor and Windsurf).

## Keep Studio in step

If your team uses [Studio](https://studio.polyxd.com), the same tokens can go there from the build that produces them, with an API key from the workspace's Team page:

```sh
POLYXD_STUDIO_KEY=… npx polyxd studio push ./ --to https://studio.polyxd.com/api/w/<workspace>
```

A directory is packed with `npm pack`; a tarball or a token file is sent as is. Each push with the same package name becomes a new version of the same design system, scanned and ready to map, so a release step can run it every time.

## The contrast failures are worth reading

Every pack in this repository needed adjustments, including ones built by very large teams: Ant's primary blue is 4.10:1 with white text, Chakra's focus ring is 1.48:1 on the page, Carbon's light warning colour is 1.68:1. Yours will have some too. Where a role fails, move it to the nearest passing step of your own ramp rather than inventing a colour, and write down why — that's what [every pack here does](/docs/design-systems).
