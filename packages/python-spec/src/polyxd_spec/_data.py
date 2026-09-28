"""Reads the spec files shipped inside the package (copied from packages/spec by scripts/sync.py)."""

from __future__ import annotations

import json
from functools import cache
from importlib import resources
from typing import Any

_ROOT = resources.files("polyxd_spec").joinpath("_spec")


def _read(*parts: str) -> Any:
    node = _ROOT
    for p in parts:
        node = node.joinpath(p)
    return json.loads(node.read_text("utf-8"))


@cache
def schema(name: str) -> dict[str, Any]:
    """A schema from schema/, by file name without the extension: "ui", "direction", "check"..."""
    return _read("schema", f"{name}.schema.json")


def schema_names() -> list[str]:
    return sorted(f.name.removesuffix(".schema.json") for f in _ROOT.joinpath("schema").iterdir() if f.name.endswith(".schema.json"))


@cache
def component_definitions() -> dict[str, dict[str, Any]]:
    folder = _ROOT.joinpath("components")
    defs = [json.loads(f.read_text("utf-8")) for f in folder.iterdir() if f.name.endswith(".json")]
    return {d["name"]: d for d in sorted(defs, key=lambda d: d["name"])}


@cache
def catalog() -> dict[str, Any]:
    return _read("catalog", "catalog.json")


@cache
def reference_types() -> dict[str, list[str]]:
    return _read("reference-types.json")


@cache
def version() -> dict[str, str]:
    return _read("version.json")


def example_names() -> list[str]:
    """Every example, as the name load_example takes: "tasks-add", "directions/calm-finance"."""
    out: list[str] = []

    def walk(node: Any, prefix: str) -> None:
        for f in node.iterdir():
            if f.is_dir():
                walk(f, f"{prefix}{f.name}/")
            elif f.name.endswith(".json"):
                out.append(prefix + f.name.removesuffix(".json"))

    walk(_ROOT.joinpath("examples"), "")
    return sorted(out)


def example(name: str) -> Any:
    name = name.removesuffix(".json")
    if name not in example_names():
        raise KeyError(f'no example "{name}"; see polyxd_spec.example_names()')
    return _read("examples", *f"{name}.json".split("/"))
