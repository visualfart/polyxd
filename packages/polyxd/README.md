# polyxd

```sh
npx polyxd pack ./src/tokens.css     # a Polyxd pack from your design system's tokens
npx polyxd check ./ds-acme/manifest.json
```

`pack` reads your CSS custom properties (or a DTCG JSON file), maps what it can onto Polyxd's semantic token contract, and writes a pack plus a mapping file recording every guess. It reports what's still missing and any of your own colour pairs that fail contrast. `check` validates a pack against the contract.

[How it guesses](https://polyxd.com/docs/your-design-system/) · [Polyxd](https://polyxd.com) · [Source](https://github.com/visualfart/polyxd)
