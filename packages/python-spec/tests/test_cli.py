"""polyxd-spec validate: output and exit codes."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from polyxd_spec import load_example
from polyxd_spec.cli import main


def write(tmp_path: Path, name: str, value: object) -> str:
    path = tmp_path / name
    path.write_text(json.dumps(value) if not isinstance(value, str) else value, "utf-8")
    return str(path)


def test_valid_file_exits_0(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    f = write(tmp_path, "ok.json", load_example("tasks-add"))
    assert main(["validate", f]) == 0
    assert capsys.readouterr().out == f"✓ {f}\n"


def test_invalid_file_exits_1(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    doc = load_example("tasks-add")
    doc["root"] = "nope"
    ok = write(tmp_path, "ok.json", load_example("tasks-add"))
    bad = write(tmp_path, "bad.json", doc)
    assert main(["validate", ok, bad]) == 1
    out = capsys.readouterr().out
    assert f"✗ {bad}\n    error /root: root \"nope\" is not a component id" in out


def test_unreadable_file_exits_2(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["validate", write(tmp_path, "broken.json", "{not json")]) == 2
    assert main(["validate", str(tmp_path / "missing.json")]) == 2
    assert "cannot read" in capsys.readouterr().err


def test_usage_error_exits_2() -> None:
    with pytest.raises(SystemExit) as e:
        main(["validate"])
    assert e.value.code == 2


def test_json_output(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    doc = load_example("tasks-add")
    doc["components"].append({"id": "orphan", "component": "Text", "text": "x"})
    f = write(tmp_path, "warn.json", doc)
    assert main(["validate", "--json", f]) == 0
    [result] = json.loads(capsys.readouterr().out)
    assert result["file"] == f and result["valid"] is True
    assert result["issues"][0]["severity"] == "warning"


def test_options(tmp_path: Path) -> None:
    doc = load_example("tasks-list")
    doc["data"] = {}
    f = write(tmp_path, "empty-data.json", doc)
    assert main(["validate", f]) == 0
    assert main(["validate", "--missing-data", "error", f]) == 1


def test_direction(tmp_path: Path) -> None:
    ok = write(tmp_path, "d.json", load_example("directions/calm-finance"))
    assert main(["validate", "--direction", ok]) == 0
    assert main(["validate", "--direction", write(tmp_path, "bad.json", {"name": "x"})]) == 1


def test_runs_as_a_module(tmp_path: Path) -> None:
    f = write(tmp_path, "ok.json", load_example("tasks-add"))
    r = subprocess.run([sys.executable, "-m", "polyxd_spec", "validate", f], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
