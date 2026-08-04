/**
 * Node smoke tests for gicisky core (no browser / canvas).
 * Run: node gicisky/smoke_test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

class ImageData {
  constructor(a, b, c) {
    if (typeof a === 'number') {
      this.width = a;
      this.height = b;
      this.data = new Uint8ClampedArray(a * b * 4);
    } else {
      this.data = a;
      this.width = b;
      this.height = c;
    }
  }
}

const sandbox = {
  globalThis: null,
  window: null,
  Uint8Array,
  Uint8ClampedArray,
  Int32Array,
  Float32Array,
  Math,
  ImageData,
  console,
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);

for (const file of ['utils.js', 'devices.js', 'dither.js', 'compress2.js', 'pack.js', 'ble.js']) {
  const code = fs.readFileSync(path.join(__dirname, file), 'utf8');
  vm.runInContext(code, sandbox);
}

const {
  GiciskyDevices,
  GiciskyCompress2,
  GiciskyPack,
  GiciskyBle,
  GiciskyDither,
} = sandbox;

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed++;
    console.error('FAIL:', msg);
  } else {
    console.log('OK:', msg);
  }
}

const d75 = GiciskyDevices.getDevice('2B');
assert(d75 && d75.compression2 && d75.mirror_y && d75.invert_luminance, '7.5" flags');
const d75legacy = GiciskyDevices.getDevice('2B', { legacy75: true });
assert(d75legacy.compression && !d75legacy.compression2, '7.5" legacy fallback');
const d102 = GiciskyDevices.getDevice('8B');
assert(d102 && d102.compression2 && !d102.mirror_y, '10.2" flags');
const d42 = GiciskyDevices.getDevice('4B');
assert(d42 && !d42.compression && !d42.compression2 && d42.rotation === 0, '4.2" flags');
const d37 = GiciskyDevices.getDevice('22B');
assert(d37 && d37.compression && d37.rotation === 180 && d37.mirror_x, '3.7" flags');

assert(GiciskyBle.makeSizeCommandHex(100, false) === '0264000000000000', 'SIZE normal 8B');
assert(GiciskyBle.makeSizeCommandHex(0x12a4b, true) === '024b2a010001', 'SIZE compression2 6B (wireshark)');

// 3.7" legacy compression size
const d37pack = GiciskyDevices.getDevice('22B');
const w37 = 240, h37 = 416;
const data37 = new Uint8ClampedArray(w37 * h37 * 4);
for (let i = 0; i < data37.length; i += 4) {
  data37[i] = 255; data37[i + 1] = 255; data37[i + 2] = 255; data37[i + 3] = 255;
}
const p37 = GiciskyPack.packImage(new ImageData(data37, w37, h37), d37pack);
const expected37 = 4 + 2 * w37 * (7 + h37 / 8);
assert(p37.length === expected37, '3.7" legacy compression size');
assert(p37[4] === 0x75, '3.7" starts with 0x75 marker after len');

const raw = new Uint8Array(96000);
for (let i = 0; i < raw.length; i++) raw[i] = (i * 13) & 0xff;
const compressed = GiciskyCompress2.compress(raw);
assert(compressed.length > 4, 'compression2 produces output');
assert(compressed[0] === (48000 & 0xff) && compressed[1] === ((48000 >> 8) & 0xff), 'part2 len header');

// Highly compressible input should shrink
const zeros = new Uint8Array(96000);
const compressedZeros = GiciskyCompress2.compress(zeros);
assert(compressedZeros.length < zeros.length, 'compression2 shrinks zeros');

const w = 400;
const h = 300;
const data = new Uint8ClampedArray(w * h * 4);
for (let i = 0; i < data.length; i += 4) {
  data[i] = 255;
  data[i + 1] = 255;
  data[i + 2] = 255;
  data[i + 3] = 255;
}
const imageData = new ImageData(data, w, h);
const payload = GiciskyPack.packImage(imageData, d42);
const expectedPlane = (w * h) / 8;
assert(payload.length === expectedPlane * 2, '4.2" BWR payload size = 2 planes');
assert(payload[0] === 0xff, 'white plane starts with 0xff');

// 7.5" compression2 payload
const w75 = 800;
const h75 = 480;
const data75 = new Uint8ClampedArray(w75 * h75 * 4);
for (let i = 0; i < data75.length; i += 4) {
  data75[i] = 255;
  data75[i + 1] = 255;
  data75[i + 2] = 255;
  data75[i + 3] = 255;
}
const payload75 = GiciskyPack.packImage(new ImageData(data75, w75, h75), d75);
assert(payload75.length > 4, '7.5" compression2 produces payload');
assert(payload75.length < (w75 * h75 / 8) * 2, '7.5" payload smaller than raw dual plane');

const qd = GiciskyDither.thresholdQuantize(imageData, d42, { lumThreshold: 128, redThreshold: 128 });
assert(qd.data[0] === 255 && qd.data[1] === 255, 'threshold white');

const floyd = GiciskyDither.floydSteinberg(imageData, d42);
assert(floyd.data[0] === 255, 'floyd white stays white on solid');

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nALL SMOKE TESTS PASSED');
