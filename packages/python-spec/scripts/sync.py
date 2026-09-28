"""Copies the spec from packages/spec into the Python package.

    python scripts/sync.py           copy, replacing whatever is there
    python scripts/sync.py --check   report drift and exit 1; copies nothing

packages/spec is the source of truth. The files under src/polyxd_spec/_spec are copies, and
two of them are extracted from its TypeScript:

- reference-types.json, from src/references.ts: which component types each reference may point to
- version.json, from package.json and src/version.ts

Never edit the copies by hand. Edit packages/spec, then run this. tests/test_sync.py fails when
the copies and the source differ, and the build hook (hatch_build.py) runs this before every build
made inside the repository.
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
SPEC = HERE.parent / "spec"
TARGET = HERE / "src" / "polyxd_spec" / "_spec"
REPO = HERE.parent.parent

# What is copied, relative to packages/spec: (directory, glob).
COPIED = [
    ("schema", "*.json"),
    ("components", "*.json"),
    ("catalog", "*.json"),
    ("examples", "**/*.json"),
]


def reference_types(source: str) -> dict[str, list[str]]:
    """The REFERENCE_TYPES object in references.ts, as data."""
    body = source[source.index("REFERENCE_TYPES") :]
    body = body[body.index("{") + 1 : body.index("\n};")]
    entries = re.findall(r'^\s*"([A-Za-z]+\.[A-Za-z]+)":\s*(\[[^\]]*\]),?\s*$', body, re.M)
    keys = re.findall(r'^\s*"[^"]+":', body, re.M)
    if len(entries) != len(keys) or not entries:
        raise SystemExit(f"references.ts: read {len(entries)} of {len(keys)} entries; update reference_types() in scripts/sync.py")
    return {k: json.loads(v) for k, v in entries}


def spec_version(source: str) -> str:
    m = re.search(r'SPEC_VERSION\s*=\s*"([^"]+)"', source)
    if not m:
        raise SystemExit("src/version.ts: no SPEC_VERSION; update spec_version() in scripts/sync.py")
    return m.group(1)


def dump(value: object) -> str:
    return json.dumps(value, indent=2) + "\n"


def expected() -> dict[str, bytes]:
    """Every file _spec should hold, by path relative to it."""
    if not SPEC.is_dir():
        raise SystemExit(f"{SPEC} not found: sync runs inside the Polyxd repository")
    out: dict[str, bytes] = {}
    for folder, pattern in COPIED:
        for f in sorted((SPEC / folder).glob(pattern)):
            if f.is_file():
                out[f.relative_to(SPEC).as_posix()] = f.read_bytes()
    out["reference-types.json"] = dump(reference_types((SPEC / "src" / "references.ts").read_text("utf8"))).encode()
    pkg = json.loads((SPEC / "package.json").read_text("utf8"))
    version = {"package": pkg["name"], "version": pkg["version"], "specVersion": spec_version((SPEC / "src" / "version.ts").read_text("utf8"))}
    out["version.json"] = dump(version).encode()
    return out


def actual() -> dict[str, bytes]:
    if not TARGET.is_dir():
        return {}
    return {f.relative_to(TARGET).as_posix(): f.read_bytes() for f in sorted(TARGET.rglob("*")) if f.is_file()}


def drift() -> list[str]:
    """What differs between the copies and packages/spec, one line per file."""
    want, have = expected(), actual()
    problems = [f"missing: {p}" for p in want if p not in have]
    problems += [f"stale: {p}" for p in want if p in have and have[p] != want[p]]
    problems += [f"extra: {p}" for p in have if p not in want]
    return problems


def sync() -> int:
    want = expected()
    if TARGET.exists():
        shutil.rmtree(TARGET)
    for path, content in want.items():
        dest = TARGET / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(content)
    # The Apache licence and the NOTICE travel with every copy (git ignores these two).
    for name in ("LICENSE", "NOTICE"):
        if (REPO / name).is_file():
            shutil.copyfile(REPO / name, HERE / name)
    return len(want)


def main(argv: list[str]) -> int:
    if "--check" in argv:
        problems = drift()
        if problems:
            print("The spec copies are out of date (run python scripts/sync.py):\n  " + "\n  ".join(problems))
            return 1
        print("spec copies match packages/spec")
        return 0
    n = sync()
    print(f"copied {n} files from packages/spec into src/polyxd_spec/_spec")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
