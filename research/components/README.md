# Component survey

Every component the 13 supported design systems document, read from their official documentation in September 2026, mapped onto Polyxd's semantic components. It is the source of the [design-system coverage](https://polyxd.com/docs/reference/coverage/) page and of the 11 components planned for spec v0.2.

| File | What |
|---|---|
| `inventory-a.json` … `inventory-d.json` | The inventories: 1,079 entries across Material 3, Carbon, Ant Design, Fluent 2, shadcn/ui, Bootstrap, Mantine, Radix Themes, Polaris, Primer, Spectrum 2, GOV.UK and Chakra, with a category, a purpose and the docs URL for each |
| `mapping.json` | Every entry mapped to a Polyxd component and variant, a renderer behaviour, or out of scope, with the reason |
| `build.py` | Applies the decisions taken after the mapping (no Timeline or Calendar component, QR codes as a Media kind, password fields out of scope) and writes `apps/site/content/coverage.json` |

`python3 build.py` regenerates the site data. The inventories are a snapshot; a system that adds a component after September 2026 isn't in them until someone re-runs the survey.
