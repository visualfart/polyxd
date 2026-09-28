"""Copies the spec in from packages/spec before a build (scripts/sync.py), when building inside the repository."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any

from hatchling.builders.hooks.plugin.interface import BuildHookInterface


class SyncSpec(BuildHookInterface):
    PLUGIN_NAME = "custom"

    def initialize(self, version: str, build_data: dict[str, Any]) -> None:
        root = Path(self.root)
        if not (root.parent / "spec" / "package.json").is_file():
            return
        spec = importlib.util.spec_from_file_location("polyxd_spec_sync", root / "scripts" / "sync.py")
        assert spec and spec.loader
        sync = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(sync)
        sync.sync()
