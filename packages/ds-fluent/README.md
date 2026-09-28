# @polyxd/ds-fluent

Microsoft's **Fluent 2** as a Polyxd design-system pack: DTCG 2025.10 token files that satisfy the semantic token contract (`packages/spec/tokens/semantic-contract.json`, v0.1.0) in `light` and `dark`.

```sh
npm run check -w @polyxd/ds-fluent     # contract check, both modes
npm run generate -w @polyxd/ds-fluent  # regenerate tokens/*.json from the vendored sources
```

## Source

`@fluentui/tokens` 1.0.0-alpha.24 (MIT), `webLightTheme` and `webDarkTheme` — 459 tokens each, vendored verbatim as `scripts/sources/fluent/{light,dark}.json`. Fluent's own names are kept (`fluent.colorNeutralBackground1`), so every semantic token traces back to something you can look up in Fluent's documentation.

| Tier | File | Contents |
|---|---|---|
| System, per mode | `tokens/system.light.json`, `tokens/system.dark.json` | The whole Fluent theme as `fluent.*`, plus `polyxd.sys.*` for what Fluent doesn't define |
| Semantic | `tokens/semantic.json` | The Polyxd contract, each token an alias. The same file in both modes |

## Mapping notes

- **Surfaces** follow Fluent's own stacking: the page is `colorNeutralBackground2`, cards and dialogs sit on `colorNeutralBackground1` above it. In dark mode that ordering is what makes a card read as raised.
- **Info status.** Fluent has `colorStatusSuccess*`, `Warning*` and `Danger*`, but no info family. Info uses Fluent's shared blue (`colorPaletteBlue*`).
- **Chart colours.** Fluent's tokens carry no chart ramp, so the six categorical colours are six shared-colour hues at foreground 2.
- **Body text.** Fluent's base size is 14px; the contract asks for 16px running text, which is Fluent's `fontSizeBase400`.
- **Target size.** Fluent's controls are 32px (medium) and 40px (large). The pack sets 44px, Fluent's own touch guidance, because a generated surface may be used on a phone.

## Contrast adjustments

Three places where Fluent's natural choice doesn't clear the contract's floor. Each moves to another token on the same ramp, and says so in the token's `$description`:

| Token | Fluent's value | Measured | Used instead |
|---|---|---|---|
| `color.border.strong` | `colorNeutralStroke1` | 1.46:1 light, 2.87:1 dark | `colorNeutralStrokeAccessible` — Fluent's own name for the 3:1 stroke |
| `color.action.primary.background` | `colorBrandBackground` | 2.48:1 on the dark canvas | `colorBrandBackgroundStatic` (3.06:1, white text on it 5.38:1) |
| `color.status.warning.emphasis` | `colorStatusWarningBorderActive` | 2.98:1 on the light canvas | `colorStatusWarningBorder2` |

## Logo

This pack has no logo file yet. Microsoft's [trademark guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks) don't allow its logos to be used without Microsoft's permission, so wherever Polyxd lists this pack it sets the name, *Microsoft Fluent 2*, in its own type and leaves the logo's place empty. The official mark is published by Microsoft ([here](https://fluent2.microsoft.design/)); it goes in as `logo.svg`, recorded in the manifest's `logo`, once Microsoft permits it.

Microsoft and Fluent are trademarks of Microsoft Corporation, named here to identify the design system this pack is modelled on. Polyxd is not affiliated with Microsoft Corporation.
