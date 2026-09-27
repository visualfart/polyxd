# polyxd

```sh
npx polyxd pack ./src/tokens.css     # a Polyxd pack from your design system's tokens
npx polyxd check ./ds-acme/manifest.json
POLYXD_STUDIO_KEY=… npx polyxd studio push ./ --to https://studio.polyxd.com/api/w/acme
npx polyxd dev ./screens             # preview the documents in a folder as you edit them
```

`pack` reads your CSS custom properties (or a DTCG JSON file), maps what it can onto Polyxd's semantic token contract, and writes a pack plus a mapping file recording every guess. It reports what's still missing and any of your own colour pairs that fail contrast. `check` validates a pack against the contract. `studio push` sends a token package (packed with npm, so private registries never matter), a tarball or a single token file to Polyxd Studio as a new version of your design system; made for a CI step on every release, with an API key from Studio's Team page.

`dev` watches a folder of documents and serves a page that renders the selected one with the real renderer in any built-in pack (or yours, with `--pack`), light or dark, phone to desktop, with the static check, the document, its data and the actions it dispatches beside it; it reloads in place on save. `--verify` adds a button that runs the full verifier when `@polyxd/verifier` is installed.

[How it guesses](https://polyxd.com/docs/your-design-system/) · [Polyxd](https://polyxd.com) · [Source](https://github.com/visualfart/polyxd)
