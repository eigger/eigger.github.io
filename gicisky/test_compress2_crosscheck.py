"""Cross-check JS GiciskyCompress2 against hass-gicisky Python compress()."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(r"D:\Source\Github\hass-gicisky\custom_components\gicisky")))

from gicisky_ble.compression import compress  # noqa: E402


def make_pattern(n: int) -> bytes:
    return bytes((i * 17 + (i // 3)) & 0xFF for i in range(n))


def js_compress(data: bytes) -> bytes:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".bin") as f:
        f.write(data)
        bin_path = f.name
    try:
        script = f"""
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync({json.dumps(str(ROOT / 'gicisky' / 'compress2.js'))}, 'utf8');
const sandbox = {{ globalThis: {{}}, Uint8Array, Int32Array, Math }};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const input = new Uint8Array(fs.readFileSync({json.dumps(bin_path)}));
const out = sandbox.GiciskyCompress2.compress(input);
process.stdout.write(Buffer.from(out).toString('hex'));
"""
        result = subprocess.run(
            ["node", "-e", script],
            capture_output=True,
            text=True,
            check=True,
        )
        return bytes.fromhex(result.stdout.strip())
    finally:
        Path(bin_path).unlink(missing_ok=True)


def main() -> int:
    cases = [
        ("uniform_64", bytes([0xAA] * 128)),
        ("zeros_1k", bytes(1024)),
        ("pattern_1k", make_pattern(1024)),
        ("pattern_96000", make_pattern(96000)),
        ("zeros_96000", bytes(96000)),
    ]
    failed = 0
    for name, raw in cases:
        py = compress(raw)
        js = js_compress(raw)
        ok = py == js
        print(f"{name}: raw={len(raw)} py={len(py)} js={len(js)} match={ok}")
        if not ok:
            failed += 1
            n = min(64, len(py), len(js))
            print(f"  py head: {py[:n].hex()}")
            print(f"  js head: {js[:n].hex()}")
    if failed:
        print(f"FAILED {failed}/{len(cases)}")
        return 1
    print("ALL PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
