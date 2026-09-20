# @polyxd/ds-govuk

**GOV.UK Frontend** as a Polyxd design-system pack: DTCG 2025.10 token files that satisfy the semantic token contract.

```sh
npm run check -w @polyxd/ds-govuk     # contract check
npm run generate -w @polyxd/ds-govuk  # regenerate tokens/*.json
```

## Source

`govuk-frontend` 6.5.1 (MIT). GOV.UK publishes compiled component CSS and no token file at all: its palette, functional colours, spacing points, measurements and type scale live in Sass settings, as maps. Those six settings files are vendored verbatim under `scripts/sources/govuk`, and the generator reads their maps directly — narrowly, by the shape of each map, rather than by evaluating Sass.

Names are kept: `govuk.palette-blue-shade-25` for a palette colour, `govuk.link` or `govuk.secondary-text` for a functional one, `govuk.spacing-4`, `govuk.font-size-19`.

## One mode

GOV.UK has one theme. There is no dark mode to read, and this pack does not invent one: it ships a single mode, and the theme compiler renders it whichever mode a surface asks for. A dark-mode surface in a GOV.UK pack is a light GOV.UK page, which is what GOV.UK is.

## What GOV.UK doesn't have, and what the pack does

| Contract token | GOV.UK | What the pack uses |
|---|---|---|
| `radius.*` | square corners, everywhere | 0 — the one shape decision the whole system is built on |
| `shadow.raised`, `shadow.overlay` | no shadows at all | a zero, transparent shadow: depth is a border, not a blur |
| `motion.duration.*` | nothing animates | zero, rather than an invented curve |
| `color.border.focus` | a yellow block with a 4px black bar under it | the black bar — the yellow alone is 1.35:1 on the page, and a single-colour ring can't be both halves |
| `color.status.warning.*` | its warning component is black text beside a black icon | its orange, which the palette carries for exactly this weight of message |
| `type.label.small` | the scale stops at 16px | 16px — GOV.UK has no small print, which is the point of the system |

Where a role does have to move, it moves along GOV.UK's own variants of the same colour (`primary`, `tint-25`…`tint-95`, `shade-25`, `shade-50`), sorted by measured luminance. In 6.5.1 the only moves are in orange: `orange-primary` is 2.25:1 on white, so accents take `orange-shade-25`, and panel text takes `orange-shade-50`.

## Files

| File | What's in it |
|---|---|
| `tokens/system.light.json` | GOV.UK's palette, functional colours, spacing and type scale, plus the `polyxd.sys.*` additions |
| `tokens/semantic.json` | the Polyxd contract, each token an alias |
| `manifest.json` | the one mode, contract version, provenance |
| `scripts/sources/govuk/` | the vendored Sass settings and GOV.UK's licence |
