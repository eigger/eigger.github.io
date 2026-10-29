const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
require('../../gicisky/compress2.js');
for (const file of ['models', 'image', 'wire', 'bluetooth', 'core']) require(`../${file}.js`);
const digest = a => createHash('sha256').update(a).digest('hex');
let failed = 0;
for (const c of JSON.parse(fs.readFileSync(0, 'utf8'))) {
  const { width: w, height: h } = c.preset, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set([(x*17+y*3)%256, (x*5+y*23)%256, (x*11+y*7)%256, 255], (y*w+x)*4);
  try {
    const raw = BleEsl.image.encode(c.protocol, { width: w, height: h, data }, c.preset);
    assert.deepEqual(raw instanceof Uint8Array ? digest(raw) : Object.fromEntries(Object.entries(raw).map(([panel, planes]) => [panel, planes.map(digest)])), c.expected);
    if (c.protocol === 'xte') {
      const turned = (c.preset.extra.rotation || 0) % 180;
      assert.deepEqual(BleEsl.wire.xte.blocks(BleEsl.wire.xte.object(raw, turned ? h : w, turned ? w : h)).map(digest), c.frames);
    }
    if (c.protocol === 'easytag') assert.deepEqual(BleEsl.wire.easytag.frames('AA:BB:CC:DD:EE:FF', raw).map(digest), c.frames);
    console.log(`PASS ${c.protocol}/${c.preset.key}`);
  } catch (error) { failed++; console.error(`FAIL ${c.protocol}/${c.preset.key}: ${error.message}`); }
}
process.exitCode = failed ? 1 : 0;
