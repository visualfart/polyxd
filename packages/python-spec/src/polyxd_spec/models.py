"""Types for Polyxd documents, for type checkers and editors.

They describe the JSON as plain dicts (TypedDict), so a document read with json.load already is
one. They cover a document's frame and what every component shares. Each component's own props
are in polyxd_spec.components() and in the schema.
"""

from __future__ import annotations

from typing import Any, Literal, TypedDict, Union


class Binding(TypedDict):
    """A value read from the host's data: a JSON Pointer ("/account/balance"), or a field of the current item ("name")."""

    path: str


DynamicString = Union[str, Binding]
DynamicNumber = Union[float, Binding]
DynamicBoolean = Union[bool, Binding]


class _ActionEventRequired(TypedDict):
    name: str


class ActionEvent(_ActionEventRequired, total=False):
    context: dict[str, Any]


class Action(TypedDict):
    """A capability the host has registered, by name. `ui.dismiss`, `ui.back`, `ui.next` and `ui.copy` are the renderer's own."""

    event: ActionEvent


class _ComponentRequired(TypedDict):
    id: str
    component: str


class Component(_ComponentRequired, total=False):
    """One entry in a document's flat component list. The other props depend on the component type."""

    accessibility: dict[str, Any]


class _SurfaceRequired(TypedDict):
    id: str
    title: str


class Surface(_SurfaceRequired, total=False):
    intent: str
    kind: Literal["surface", "shell"]
    origin: Literal["generated", "authored"]
    pattern: str
    journey: str
    subtitle: DynamicString
    breadcrumbs: list[dict[str, Any]]
    badge: dict[str, Any]
    avatar: DynamicString
    actions: str
    presentation: Literal["page", "panel"]
    dismissible: bool


class _DocumentRequired(TypedDict):
    specVersion: str
    surface: Surface
    root: str
    components: list[Component]


class Document(_DocumentRequired, total=False):
    """A UI document: a flat list of semantic components, the root's id, and data the host provides."""

    data: Any


class _ComponentDefinitionRequired(TypedDict):
    name: str
    category: str
    summary: str
    props: dict[str, Any]


class ComponentDefinition(_ComponentDefinitionRequired, total=False):
    """A component's definition, from components/*.json."""

    required: list[str]
    shell: bool


class _DirectionRequired(TypedDict):
    name: str
    version: str
    profile: dict[str, Any]


class Direction(_DirectionRequired, total=False):
    """A Design Direction: a company's taste (profile, voice, patterns, rules, exemplars)."""

    designSystem: Any
    voice: dict[str, Any]
    patterns: dict[str, Any]
    rules: list[dict[str, Any]]
    exemplars: list[dict[str, Any]]
