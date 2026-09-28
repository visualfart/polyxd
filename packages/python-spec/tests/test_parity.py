"""The Python validator agrees with the TypeScript one.

tests/fixtures/parity.json holds what the TypeScript validator reports for every example and
fixture (scripts/ts-parity.ts writes it). Each case here rebuilds the same document, validates it
in Python, and expects the same verdict and the same issues: severity, JSON Pointer and message.
"""

from __future__ import annotations

import copy
import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

import pytest

import polyxd_spec
from polyxd_spec import load_example, validate_direction, validate_document

HERE = Path(__file__).resolve().parent
PACKAGE = HERE.parent
FIXTURE = HERE / "fixtures" / "parity.json"
PARITY = json.loads(FIXTURE.read_text("utf-8"))


def apply_ops(doc: Any, ops: list[dict[str, Any]]) -> Any:
    """JSON Patch (RFC 6902) add, remove and replace, as scripts/ts-parity.ts applies them."""
    for op in ops:
        parts = [p.replace("~1", "/").replace("~0", "~") for p in op["path"][1:].split("/")]
        last = parts.pop()
        parent = doc
        for p in parts:
            parent = parent[int(p)] if isinstance(parent, list) else parent[p]
        value = copy.deepcopy(op.get("value"))
        if isinstance(parent, list):
            i = len(parent) if last == "-" else int(last)
            if op["op"] == "add":
                parent.insert(i, value)
            elif op["op"] == "remove":
                del parent[i]
            else:
                parent[i] = value
        elif op["op"] == "remove":
            del parent[last]
        else:
            parent[last] = value
    return doc


def build(case: dict[str, Any]) -> Any:
    if "doc" in case:
        return copy.deepcopy(case["doc"])
    return apply_ops(load_example(case["example"]), case.get("ops", []))


def as_ts(issue: polyxd_spec.Issue) -> dict[str, Any]:
    out = {"severity": issue.severity, "at": issue.path, "message": issue.message}
    if issue.code:
        out["code"] = issue.code
    return out


def run(case: dict[str, Any]) -> polyxd_spec.Result:
    doc = build(case)
    if case["kind"] == "direction":
        return validate_direction(doc)
    opts = case.get("options", {})
    return validate_document(doc, emphasis_budget=opts.get("emphasisBudget"), missing_data=opts.get("missingData"))


CASES = PARITY["cases"]


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_same_verdict_paths_and_messages(case: dict[str, Any]) -> None:
    result = run(case)
    expected = case["expected"]
    got = [as_ts(i) for i in result.issues]
    assert result.valid == expected["valid"], f"verdict differs\n  python: {got}\n  typescript: {expected['issues']}"
    # Same paths, messages, severities and codes, in the same order.
    assert got == expected["issues"]


def test_every_example_document_and_direction_is_a_case() -> None:
    as_is = {c["example"] for c in CASES if c.get("example") and not c.get("ops")}
    wanted = {n for n in polyxd_spec.example_names() if "/" not in n or n.startswith("directions/")}
    assert as_is == wanted


def test_reference_types_and_shell_components_match() -> None:
    assert polyxd_spec.reference_types() == PARITY["referenceTypes"]
    assert sorted(polyxd_spec.shell_components()) == sorted(PARITY["shellComponents"])
    assert polyxd_spec.SPEC_VERSION == PARITY["specVersion"]


@pytest.mark.skipif(shutil.which("node") is None or not (PACKAGE.parent / "spec" / "package.json").is_file(), reason="needs node and the Polyxd repository")
def test_fixture_is_what_the_typescript_validator_says_today() -> None:
    """The committed fixture is current: regenerate it with node packages/python-spec/scripts/ts-parity.ts."""
    out = subprocess.run(["node", str(PACKAGE / "scripts" / "ts-parity.ts"), "--stdout"], capture_output=True, text=True, check=True, cwd=PACKAGE.parent.parent)
    assert json.loads(out.stdout) == PARITY, "tests/fixtures/parity.json is stale: run node packages/python-spec/scripts/ts-parity.ts"
