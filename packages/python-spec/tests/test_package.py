"""The package's public API: catalogue, examples, schemas and results."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

import polyxd_spec
from polyxd_spec import Issue, Result, components, load_example, validate_direction, validate_document, validate_schema

PACKAGE = Path(__file__).resolve().parent.parent


@pytest.mark.skipif(not (PACKAGE / "pyproject.toml").is_file(), reason="needs the source tree")
def test_version_matches_the_npm_package() -> None:
    version = re.search(r'^version = "([^"]+)"', (PACKAGE / "pyproject.toml").read_text("utf-8"), re.M).group(1)  # type: ignore[union-attr]
    assert version == polyxd_spec.__version__
    spec = PACKAGE.parent / "spec" / "package.json"
    if spec.is_file():
        assert version == json.loads(spec.read_text("utf-8"))["version"]
    assert polyxd_spec.SPEC_VERSION.startswith("0.")


def test_components_catalogue() -> None:
    defs = components()
    assert len(defs) == 44
    assert sorted(polyxd_spec.shell_components()) == ["AppBar", "Custom", "Footer", "Frame", "Outlet"]
    assert defs["Action"]["category"] == "action"
    assert "label" in defs["Action"]["props"]
    assert set(polyxd_spec.catalog()["components"]) == set(defs)
    # Callers get copies: changing one doesn't change the next.
    defs["Action"]["summary"] = "changed"
    assert components()["Action"]["summary"] != "changed"


def test_examples() -> None:
    names = polyxd_spec.example_names()
    assert "tasks-add" in names and "directions/calm-finance" in names and "journeys/money.send" in names
    assert load_example("tasks-add")["root"]
    assert load_example("tasks-add.json") == load_example("tasks-add")
    with pytest.raises(KeyError):
        load_example("no-such-example")


def test_other_schemas() -> None:
    assert polyxd_spec.schema()["$id"].endswith("/ui.schema.json")
    for name in ("journeys/money.send", "journeys/account.delete"):
        assert validate_schema("journey", load_example(name)).valid
    assert validate_schema("event", load_example("events/action-taken")).valid
    assert validate_schema("capabilities", load_example("registry/capabilities")).valid
    with pytest.raises(KeyError):
        validate_schema("nope", {})


def test_directions() -> None:
    assert validate_direction(load_example("directions/calm-finance")).valid
    r = validate_direction({"name": "x", "version": "1"})
    assert not r.valid
    assert [(i.path, i.message) for i in r.errors] == [("/", "must have required property 'profile'")]


def test_result_shape() -> None:
    doc = load_example("tasks-add")
    doc["components"].append({"id": "orphan", "component": "Text", "text": "x"})
    doc["components"][0]["colour"] = "red"
    bad = validate_document(doc)
    assert isinstance(bad, Result) and not bad and not bad.valid
    assert bad.errors == [Issue("/components/0", 'unknown property "colour"', "error", "Remove it; polyxd_spec.components() lists each component's props.")]
    assert bad.to_dict() == {"valid": False, "issues": [{"path": "/components/0", "message": 'unknown property "colour"', "severity": "error", "hint": "Remove it; polyxd_spec.components() lists each component's props."}]}

    del doc["components"][0]["colour"]
    ok = validate_document(doc)
    assert ok and ok.valid and not ok.errors
    [w] = ok.warnings
    assert (w.path, w.severity, str(w)) == (f"/components/{len(doc['components']) - 1}", "warning", w.__str__())
    assert w.hint == "Reference it from a parent, or remove it."
