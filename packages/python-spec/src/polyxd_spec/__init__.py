"""The Polyxd spec in Python: the JSON Schemas, the component catalogue and a validator.

    from polyxd_spec import validate_document, load_example

    result = validate_document(load_example("tasks-add"))
    result.valid   # True
    result.issues  # [Issue(path, message, severity, hint, code), ...]

The schemas and components are copies of packages/spec, the source of truth, made by
scripts/sync.py. The validator is a port of the TypeScript one and gives the same verdicts, paths
and messages on the spec's examples and fixtures.
"""

from __future__ import annotations

import copy
from typing import Any

from . import _data
from .models import ComponentDefinition, Direction, Document
from .validate import Issue, Result, validate_direction, validate_document, validate_schema

__all__ = [
    "SPEC_VERSION",
    "__version__",
    "Issue",
    "Result",
    "validate_document",
    "validate_direction",
    "validate_schema",
    "components",
    "shell_components",
    "catalog",
    "schema",
    "reference_types",
    "load_example",
    "example_names",
    "Document",
    "Direction",
    "ComponentDefinition",
]

#: The spec version documents checked by this package conform to.
SPEC_VERSION: str = _data.version()["specVersion"]
__version__: str = _data.version()["version"]


def components() -> dict[str, ComponentDefinition]:
    """Every semantic component's definition (components/*.json), by name."""
    return copy.deepcopy(_data.component_definitions())  # type: ignore[return-value]


def shell_components() -> list[str]:
    """The components that belong only in an authored shell document."""
    return [name for name, d in _data.component_definitions().items() if d.get("shell")]


def catalog() -> dict[str, Any]:
    """Usage guidance per component (catalog/catalog.json): when to use it, accessibility, rendering, platform mappings."""
    return copy.deepcopy(_data.catalog())


def schema(name: str = "ui") -> dict[str, Any]:
    """One of the spec's JSON Schemas by name: "ui", "ui-tree", "direction", "journey", "check"..."""
    return copy.deepcopy(_data.schema(name))


def reference_types() -> dict[str, list[str]]:
    """Which component types each reference may point to, e.g. "ActionBar.children": ["Action"]."""
    return copy.deepcopy(_data.reference_types())


def load_example(name: str) -> Any:
    """An example from the spec, by name: "tasks-add", "shell-product", "directions/calm-finance"."""
    return _data.example(name)


def example_names() -> list[str]:
    """The names load_example takes."""
    return _data.example_names()
