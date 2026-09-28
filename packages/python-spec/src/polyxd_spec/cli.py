"""polyxd-spec: validate UI documents and Design Directions from the command line.

    polyxd-spec validate my-ui.json [more.json ...]
    polyxd-spec validate --direction my-direction.json
    polyxd-spec validate --json my-ui.json

Exit codes: 0 when every file is valid (warnings allowed), 1 when any file has an error,
2 when a file can't be read or isn't JSON, or the command is wrong.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from . import SPEC_VERSION, __version__
from .validate import Result, issue_lines, validate_direction, validate_document


def _parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="polyxd-spec", description="The Polyxd spec: validate UI documents and Design Directions.")
    p.add_argument("--version", action="version", version=f"polyxd-spec {__version__} (spec {SPEC_VERSION})")
    sub = p.add_subparsers(dest="command", required=True)
    v = sub.add_parser("validate", help="validate UI documents (or Design Directions with --direction)")
    v.add_argument("files", nargs="+", metavar="file.json")
    v.add_argument("--direction", action="store_true", help="the files are Design Directions, not UI documents")
    v.add_argument("--json", action="store_true", help="print one JSON result per file instead of text")
    v.add_argument("--emphasis-budget", type=int, metavar="N", help="primary actions allowed in one view (default 1)")
    v.add_argument("--missing-data", choices=["warning", "error"], help="how to report a binding that reads nothing from data (default warning)")
    return p


def _validate(doc: Any, args: argparse.Namespace) -> Result:
    if args.direction:
        return validate_direction(doc)
    return validate_document(doc, emphasis_budget=args.emphasis_budget, missing_data=args.missing_data)


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    failed = unreadable = 0
    results = []
    for file in args.files:
        try:
            with open(file, encoding="utf-8") as f:
                doc = json.load(f)
        except (OSError, ValueError) as e:
            unreadable += 1
            if args.json:
                results.append({"file": file, "error": str(e)})
            else:
                print(f"✗ {file}\n    cannot read: {e}", file=sys.stderr)
            continue
        result = _validate(doc, args)
        if not result.valid:
            failed += 1
        if args.json:
            results.append({"file": file, **result.to_dict()})
        else:
            print(f"{'✓' if result.valid else '✗'} {file}")
            for line in issue_lines(result):
                print(line)
    if args.json:
        print(json.dumps(results, indent=2, ensure_ascii=False))
    return 2 if unreadable else 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
