"""The rules, read as sentences. The parity test checks every case against TypeScript; these say what matters."""

from __future__ import annotations

from typing import Any

from polyxd_spec import load_example, validate_document


def by_id(doc: dict[str, Any], cid: str) -> dict[str, Any]:
    return next(c for c in doc["components"] if c["id"] == cid)


def messages(doc: Any, **opts: Any) -> list[str]:
    return [f"{i.severity} {i.path}: {i.message}" for i in validate_document(doc, **opts).issues]


def test_every_example_is_valid_with_no_warnings() -> None:
    from polyxd_spec import example_names

    for name in example_names():
        if "/" not in name:
            assert validate_document(load_example(name)).issues == [], name


def test_a_generated_document_may_not_contain_shell_components() -> None:
    doc = load_example("tasks-add")
    doc["components"].append({"id": "out", "component": "Outlet"})
    by_id(doc, "form")["children"].append("out")
    r = validate_document(doc)
    assert not r.valid
    [issue] = [i for i in r.issues if i.code == "shell:structure"]
    assert issue.message == 'Outlet belongs in a shell document: set surface.kind to "shell"'


def test_a_shell_is_authored() -> None:
    doc = load_example("shell-product")
    doc["surface"]["origin"] = "generated"
    assert 'error /surface/origin: a shell is authored; set surface.origin to "authored"' in messages(doc)


def test_one_primary_action_per_view_unless_the_direction_allows_more() -> None:
    doc = load_example("tasks-list")
    by_id(doc, "plan")["emphasis"] = "primary"
    assert any("more than one primary action" in m for m in messages(doc))
    assert not any("primary" in m for m in messages(doc, emphasis_budget=2))


def test_bindings_are_checked_against_the_data() -> None:
    doc = load_example("tasks-add")
    by_id(doc, "title")["value"] = {"path": "draft/title"}
    assert any('relative path "draft/title" used outside a repeated item' in m for m in messages(doc))

    doc = load_example("money-budget-settings")
    by_id(doc, "used")["value"] = 212.5
    r = validate_document(doc)
    assert not r.valid and r.errors[0].message == "must be object"
    assert r.errors[0].hint == 'Bind the value to host data: {"path": "/..."}.'


def test_missing_data_can_be_an_error() -> None:
    doc = load_example("tasks-list")
    doc["data"] = {}
    assert validate_document(doc).valid
    r = validate_document(doc, missing_data="error")
    assert not r.valid and all(i.code == "data:missing-path" for i in r.errors)


def test_a_schema_failure_stops_before_the_rules() -> None:
    doc = load_example("tasks-add")
    by_id(doc, "notes")["component"] = "Textarea"
    doc["root"] = "nowhere"
    assert messages(doc) == [f"error /components/{doc['components'].index(by_id(doc, 'notes'))}: unknown or missing component type"]


def test_patterns_end_where_javascript_ends_them() -> None:
    # Python's $ also matches before a final newline; JavaScript's doesn't, and neither does this.
    doc = load_example("tasks-add")
    doc["components"][0]["id"] = doc["root"] = doc["components"][0]["id"] + "\n"
    assert not validate_document(doc).valid
