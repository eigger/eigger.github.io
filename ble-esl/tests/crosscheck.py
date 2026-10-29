"""Compare JS encoders with a local hass-ble-esl checkout (requires Pillow).
Usage: python crosscheck.py /path/to/hass-ble-esl
No Home Assistant installation required; reference files are loaded in isolation.
"""
import dataclasses
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import types
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(sys.argv[1]).resolve() / 'custom_components/ble_esl/esl_ble'
@dataclasses.dataclass
class DevicePreset:
    key: str
    display_name: str
    width: int
    height: int
    colors: str
    extra: dict = dataclasses.field(default_factory=dict)

for name in ['reference', 'reference.base']:
    module = types.ModuleType(name)
    module.__path__ = [str(SOURCE)]
    sys.modules[name] = module
sys.modules['reference.base'].DevicePreset = DevicePreset
# The pure wire files only use DeviceError as an exception base.
sys.modules['blesession'] = types.SimpleNamespace(DeviceError=RuntimeError)

def load(protocol, name):
    key = f'reference.{protocol}.{name}'
    spec = importlib.util.spec_from_file_location(key, SOURCE / protocol / f'{name}.py')
    module = importlib.util.module_from_spec(spec)
    sys.modules[key] = module
    spec.loader.exec_module(module)
    return module

def digest(data):
    return hashlib.sha256(data).hexdigest()

models_js = subprocess.check_output(['node', '-e', "require('./ble-esl/models.js'); process.stdout.write(JSON.stringify(BleEsl.models))"], cwd=ROOT, text=True)
models = json.loads(models_js)
cases = []
for protocol, presets in models.items():
    package = types.ModuleType(f'reference.{protocol}')
    package.__path__ = [str(SOURCE / protocol)]
    sys.modules[package.__name__] = package
    load(protocol, 'const')
    if protocol == 'picksmart':
        package.quicklz = load(protocol, 'quicklz')
    encoder = load(protocol, 'image')
    wire = load(protocol, 'wire')
    for entry in presets:
        preset = DevicePreset(**entry)
        if 'resample' in preset.extra:
            preset.extra['resample'] = tuple(preset.extra['resample'])
        w, h = preset.width, preset.height
        # Asymmetric RGB pattern catches rotation, mirrors, padding and diffusion.
        data = bytes(c for y in range(h) for x in range(w) for c in ((x*17+y*3)%256, (x*5+y*23)%256, (x*11+y*7)%256))
        image = Image.frombytes('RGB', (w, h), data)
        raw = encoder.encode_image(image, preset)
        expected = {key: [digest(p) for p in planes] for key, planes in raw.items()} if isinstance(raw, dict) else digest(raw)
        case = dict(protocol=protocol, preset=entry, expected=expected)
        if protocol == 'xte':
            obj = wire.image_object(raw, *encoder.buffer_size(preset))
            case['frames'] = [digest(p) for p in wire.blocks(obj)]
        if protocol == 'easytag':
            case['frames'] = [digest(p) for p in wire.image_frames('AA:BB:CC:DD:EE:FF', raw)]
        cases.append(case)
result = subprocess.run(['node', str(Path(__file__).with_name('crosscheck.cjs'))], input=json.dumps(cases), text=True, cwd=ROOT)
raise SystemExit(result.returncode)
