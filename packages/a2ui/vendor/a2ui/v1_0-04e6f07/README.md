# Vendored A2UI v1.0 schemas

These files are unmodified copies of the official A2UI specification JSON Schemas. `@polyxd/a2ui` validates its exported messages and its catalog against them.

- **Source:** https://github.com/a2ui-project/a2ui, directory `specification/v1_0/`
- **Commit:** `04e6f07fde12ff2638b3b489bd9e3033066cb957` (tip of `main`, committed 2026-09-18T11:34:38Z)
- **Fetched:** 2026-09-19, from `https://raw.githubusercontent.com/a2ui-project/a2ui/04e6f07fde12ff2638b3b489bd9e3033066cb957/specification/v1_0/<path>`
- **Spec status:** v1.0 **release candidate**. The upstream README says it "is currently a candidate for becoming stable". Messages carry `"version": "v1.0"`.
- **License:** Apache-2.0 (upstream `LICENSE` copied alongside as `LICENSE`).

| File | Upstream path | Used for |
|---|---|---|
| `json/agent_to_renderer.json` | `specification/v1_0/json/agent_to_renderer.json` | Server-to-client message envelope (`createSurface`, `updateComponents`, `updateDataModel`, ...) |
| `json/common_types.json` | `specification/v1_0/json/common_types.json` | Shared types (`ComponentCommon`, `ChildList`, `Dynamic*`, `Action`, `AccessibilityAttributes`, `Extensions`) |
| `json/catalog_definition.json` | `specification/v1_0/json/catalog_definition.json` | Validates the Polyxd catalog as an A2UI catalog |
| `catalogs/basic/catalog.json` | `specification/v1_0/catalogs/basic/catalog.json` | The Basic catalog, for comparison and as a sanity check of the catalog-definition schema |

SHA-256 of the files as fetched:

```
468c8e544dbe0b02d5d5586ebcdca399ecfa6d07a7b875d887089ce3bd2df160  json/agent_to_renderer.json
f2911c1cc05ca1dae2cf78ed18bf463816daf75c44c43bb5603144934425bcb2  json/common_types.json
f3c15537c179f06217b3746f9106674a747668a3109e6f380b5f3f9a52a060eb  json/catalog_definition.json
29d843fccbe24e2314a134ae04fee4d64b078e2f43fa364b1beb9b2bd6adb9f5  catalogs/basic/catalog.json
```

`agent_to_renderer.json` refers to the active catalog as `catalog.json#/$defs/anyComponent`. Following the upstream test runner (`specification/v1_0/test/run_tests.py`), validation registers the catalog in use under the `$id` `https://a2ui.org/specification/v1_0/catalog.json`. The files here are never edited. The aliasing happens in memory (see `src/validate.ts`).

To update: fetch the same paths at a newer commit into a new `v1_0-<short-sha>/` directory, point `VENDOR_DIR` in `src/a2ui.ts` at it, and run the tests.
