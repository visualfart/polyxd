"""The schema and component copies match packages/spec, the source of truth."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

PACKAGE = Path(__file__).resolve().parent.parent
IN_REPO = (PACKAGE.parent / "spec" / "package.json").is_file()


def load_sync():
    spec = importlib.util.spec_from_file_location("polyxd_spec_sync", PACKAGE / "scripts" / "sync.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.skipif(not IN_REPO, reason="needs the Polyxd repository (packages/spec)")
def test_copies_match_packages_spec() -> None:
    problems = load_sync().drift()
    assert not problems, "The spec copies are out of date; run python scripts/sync.py:\n  " + "\n  ".join(problems)


@pytest.mark.skipif(not IN_REPO, reason="needs the Polyxd repository (packages/spec)")
def test_every_component_and_schema_is_copied() -> None:
    spec = PACKAGE.parent / "spec"
    copied = PACKAGE / "src" / "polyxd_spec" / "_spec"
    for folder in ("components", "schema"):
        names = sorted(f.name for f in (spec / folder).glob("*.json"))
        assert names == sorted(f.name for f in (copied / folder).glob("*.json"))


@pytest.mark.skipif(not (PACKAGE / "scripts" / "sync.py").is_file(), reason="needs the source tree")
def test_reference_types_are_read_from_typescript() -> None:
    sync = load_sync()
    source = 'export const REFERENCE_TYPES: Record<string, string[]> = {\n  "Card.media": ["Media"],\n  // a comment\n  "ActionBar.children": ["Action"],\n};\n'
    assert sync.reference_types(source) == {"Card.media": ["Media"], "ActionBar.children": ["Action"]}
    with pytest.raises(SystemExit):
        sync.reference_types('export const REFERENCE_TYPES = {\n  "Card.media": MEDIA,\n};\n')
