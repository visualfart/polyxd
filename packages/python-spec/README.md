# polyxd-spec

The Polyxd spec in Python: the JSON Schemas, the component catalogue, and a validator that gives the same answers as the TypeScript one.

A generated interface is a **UI document**: a flat list of semantic components, bound to data the host provides, with actions that name capabilities the host has registered. This package checks one from Python, for example in a generation service or an evaluation script, without running Node.

It is not on PyPI yet. Install it from the repository (see [Using it](#using-it)).

## What's here

| Path | What |
|---|---|
| `src/polyxd_spec/validate.py` | `validate_document` and `validate_direction`: a port of `packages/spec/src/validate.ts` |
| `src/polyxd_spec/_spec/` | Copies of `packages/spec`: the schemas, the 44 component definitions, the catalogue and the examples. Made by `scripts/sync.py`; never edited by hand |
| `src/polyxd_spec/models.py` | Typed dicts for documents, surfaces, components and Design Directions |
| `src/polyxd_spec/cli.py` | The `polyxd-spec` command |
| `scripts/sync.py` | Copies the spec in from `packages/spec`, or reports drift with `--check` |
| `scripts/ts-parity.ts` | Runs the TypeScript validator on every example and fixture and writes `tests/fixtures/parity.json` |
| `tests/` | pytest: the parity test, the drift test, the API and the command line |

## Using it

Inside the Polyxd repository:

```bash
pip install ./packages/python-spec          # or: uv pip install ./packages/python-spec

polyxd-spec validate my-ui.json             # schema + structural and design rules
polyxd-spec validate --direction taste.json # a Design Direction
polyxd-spec validate --json my-ui.json      # one JSON result per file
```

The command exits with 0 when every file is valid (warnings are allowed), 1 when any file has an error, and 2 when a file can't be read or isn't JSON.

From code:

```python
from polyxd_spec import validate_document, load_example

result = validate_document(load_example("tasks-add"))
result.valid      # True
result.errors     # issues with severity "error"
result.warnings   # issues with severity "warning"

for issue in result.issues:
    print(issue.path, issue.message, issue.hint)
```

Each issue has a `path` (a JSON Pointer into the document), a `message`, a `severity`, and a `hint` when there is something specific to change. Issues about the shell's structure or about bindings that read nothing also carry a `code` (`"shell:structure"`, `"data:missing-path"`).

The same options as the TypeScript validator:

```python
validate_document(doc, emphasis_budget=2)      # a Design Direction allows two primary actions per view
validate_document(doc, missing_data="error")   # a binding that reads nothing is an error, as in the verifier
```

And the rest of the spec:

```python
from polyxd_spec import components, catalog, schema, validate_direction, validate_schema, load_example

components()["Action"]["props"]                 # the 44 component definitions
catalog()["components"]["Action"]["whenToUse"]  # usage guidance
schema("ui")                                    # any of the spec's JSON Schemas by name
validate_direction(load_example("directions/calm-finance"))
validate_schema("journey", load_example("journeys/money.send"))
```

## Rules the validator enforces beyond the schema

The same rules as `@polyxd/spec`:

- Every referenced component exists, has one parent, and is reachable from the root; no cycles.
- References have allowed types (e.g. `ActionBar` holds only `Action`s).
- At most one primary action is visible at a time, unless `emphasis_budget` says more.
- Relative data paths only inside repeated items; with data given, every binding should read something.
- Only `ui.dismiss`, `ui.back`, `ui.next` and `ui.copy` in the reserved `ui.` action namespace.
- The shell components (`Frame`, `AppBar`, `Footer`, `Outlet`, `Custom`) appear only in an authored shell document. A generated document never contains them.

## Keeping it in step with packages/spec

`packages/spec` is the source of truth. After changing it:

```bash
cd packages/python-spec
python scripts/sync.py                # copy the schemas, components, catalogue and examples in
node scripts/ts-parity.ts             # record what the TypeScript validator says now
uv run --extra test pytest            # or, from the repository root: npm run test:python
```

The tests fail when the copies differ from `packages/spec`, when `tests/fixtures/parity.json` is older than the TypeScript validator, or when the Python validator gives a different verdict, path, message or order for any of about 700 cases. Those cases are every example, the cases in `packages/spec/test`, and a sweep of common mistakes over every example. A build inside the repository runs the sync first (`hatch_build.py`).

`npm test` doesn't run these, so nobody needs Python to work on the rest of the repository. CI runs them with `npm run test:python`.

## Publishing

Nothing has been published. When it is, the plan is PyPI trusted publishing, so no API token is stored anywhere:

1. On PyPI, add a pending trusted publisher for the project `polyxd-spec`: repository `visualfart/polyxd`, workflow `release.yml`, environment `pypi`. A pending publisher lets the first upload come from the workflow too, unlike npm.
2. Add a job to `.github/workflows/release.yml` with `id-token: write` and `environment: pypi` that runs `uv build` in `packages/python-spec` and then `pypa/gh-action-pypi-publish`. The version in `pyproject.toml` follows `@polyxd/spec`, and the tests check that they match.
3. Once it is live, update the Distribution table in the roadmap.

Code is Apache-2.0; the spec content (schemas, components, patterns, docs) is CC-BY-4.0.
