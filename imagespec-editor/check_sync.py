#!/usr/bin/env python3
"""Verify imagespec-editor schema.js types stay in sync with elements.json / editor_types.json.

Run from repo root or this directory:
  python imagespec-editor/check_sync.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def extract_defaults_types(schema_js: Path) -> list[str]:
    text = schema_js.read_text(encoding="utf-8")
    m = re.search(r"ELEMENT_DEFAULTS:\s*\{(.*?)\n\},", text, re.S)
    if not m:
        raise SystemExit(f"Could not parse ELEMENT_DEFAULTS from {schema_js}")
    block = m.group(1)
    types = re.findall(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:", block, re.M)
    seen: set[str] = set()
    out: list[str] = []
    for t in types:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


def main() -> int:
    schema_js = HERE / "schema.js"
    elements = json.loads((HERE / "elements.json").read_text(encoding="utf-8"))
    editor = json.loads((HERE / "editor_types.json").read_text(encoding="utf-8"))

    js_types = extract_defaults_types(schema_js)
    editor_types = editor["types"]
    known = set(elements["types"])

    errors: list[str] = []
    if js_types != editor_types:
        errors.append(
            "schema.js ELEMENT_DEFAULTS keys != editor_types.json\n"
            f"  schema.js: {js_types}\n"
            f"  editor_types.json: {editor_types}"
        )
    unknown = sorted(set(js_types) - known)
    if unknown:
        errors.append(f"editor types not in elements.json (imagespec): {unknown}")

    if errors:
        print("SYNC FAILED:", file=sys.stderr)
        for e in errors:
            print(e, file=sys.stderr)
        print(
            "\nRefresh from imagespec:\n"
            "  python ../imagespec/scripts/export_schema.py "
            "--editor-schema imagespec-editor/schema.js\n"
            "  copy schema/*.json into imagespec-editor/",
            file=sys.stderr,
        )
        return 1

    print(f"OK: {len(js_types)} editor types ⊆ {len(known)} imagespec types")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
