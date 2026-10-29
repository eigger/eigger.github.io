/** Pure ImageData encoders. No canvas, DOM, BLE or image layout dependency. */
(function (global) {
  'use strict';
  const api = global.BleEsl = global.BleEsl || {};
  const concat = (...arrays) => {
    const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
    let offset = 0;
    for (const a of arrays) { out.set(a, offset); offset += a.length; }
    return out;
  };
  function validate(image, preset) {
    if (!image || image.width !== preset.width || image.height !== preset.height ||
        image.data?.length !== image.width * image.height * 4) {
      throw new Error(`Expected ${preset.width}x${preset.height} RGBA ImageData`);
    }
  }
  // Pillow-compatible separable BICUBIC (a=-0.5), 22-bit normalized coefficients.
  function resample(image, target) {
    const kernel = x => {
      x = Math.abs(x);
      return x < 1 ? ((1.5 * x - 2.5) * x) * x + 1 : x < 2 ? ((-0.5 * x + 2.5) * x - 4) * x + 2 : 0;
    };
    let current = image;
    for (const axis of [0, 1]) {
      const source = axis ? current.height : current.width, dest = target[axis];
      if (source === dest) continue;
      const scale = source / dest, filterScale = Math.max(1, scale), support = 2 * filterScale;
      const width = axis ? current.width : dest, height = axis ? dest : current.height;
      const data = new Uint8ClampedArray(width * height * 4);
      for (let pos = 0; pos < dest; pos++) {
        const center = (pos + 0.5) * scale;
        const start = Math.max(0, Math.trunc(center - support + 0.5));
        const end = Math.min(source, Math.trunc(center + support + 0.5));
        const weights = [];
        for (let i = start; i < end; i++) weights.push(kernel((i - center + 0.5) / filterScale));
        const total = weights.reduce((a, b) => a + b, 0);
        const fixed = weights.map(w => Math.trunc(w / total * 4194304 + (w < 0 ? -0.5 : 0.5)));
        const length = axis ? width : height;
        for (let other = 0; other < length; other++) {
          const x = axis ? other : pos, y = axis ? pos : other;
          const offset = (y * width + x) * 4;
          for (let c = 0; c < 3; c++) {
            let sum = 2097152;
            for (let i = start; i < end; i++) {
              const sx = axis ? other : i, sy = axis ? i : other;
              sum += current.data[(sy * current.width + sx) * 4 + c] * fixed[i - start];
            }
            data[offset + c] = Math.max(0, Math.min(255, Math.floor(sum / 4194304)));
          }
          data[offset + 3] = 255;
        }
      }
      current = { data, width, height };
    }
    return current;
  }
  function scan(image, extra = {}) {
    let { width, height } = image;
    let data = new Uint8ClampedArray(image.data);
    // Explicit white compositing gives every frontend the same alpha behavior.
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3] / 255;
      for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * alpha + 255 * (1 - alpha));
      data[i + 3] = 255;
    }
    if (extra.resample) {
      const resized = resample({ data, width, height }, extra.resample);
      data = resized.data; width = resized.width; height = resized.height;
    }
    const rot = extra.rotation || 0;
    if (![0, 90, 180, 270].includes(rot)) throw new Error('Invalid scan rotation');
    const w = rot % 180 ? height : width, h = rot % 180 ? width : height;
    const out = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      let nx = x, ny = y;
      if (rot === 90) { nx = y; ny = width - 1 - x; }
      if (rot === 180) { nx = width - 1 - x; ny = height - 1 - y; }
      if (rot === 270) { nx = height - 1 - y; ny = x; }
      if (extra.mirror_x) nx = w - 1 - nx;
      if (extra.mirror_y) ny = h - 1 - ny;
      out.set(data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4), (ny * w + nx) * 4);
    }
    return { data: out, width: w, height: h };
  }
  function nearest(rgb, palette) {
    let best = 0, distance = Infinity;
    palette.forEach((color, i) => {
      const d = color.reduce((sum, v, c) => sum + (v - rgb[c]) ** 2, 0);
      if (d < distance) { distance = d; best = i; }
    });
    return best;
  }
  function codes(image, palette, dither = false) {
    const { width: w, height: h } = image;
    const data = new Int32Array(image.data), out = new Uint8Array(w * h);
    const clamp = v => Math.max(0, Math.min(255, v));
    // easyTag's diffusion is column-first, including its intentional y > 1 rule.
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      const code = nearest(data.subarray(i, i + 3), palette);
      out[y * w + x] = code;
      if (!dither) continue;
      for (let c = 0; c < 3; c++) {
        const error = data[i + c] - palette[code][c];
        const spread = (nx, ny, weight) => {
          const j = (ny * w + nx) * 4 + c;
          data[j] = clamp(data[j] + (error * weight >> 4));
        };
        if (y + 1 < h) spread(x, y + 1, 7);
        if (x + 1 < w) {
          if (y > 1) spread(x + 1, y - 1, 3);
          spread(x + 1, y, 5);
          if (y + 1 < h) spread(x + 1, y + 1, 1);
        }
      }
    }
    return out;
  }
  function bits(values, width = values.length) {
    const stride = Math.ceil(width / 8), out = new Uint8Array(stride * Math.ceil(values.length / width));
    values.forEach((v, i) => { if (v) out[Math.floor(i / width) * stride + Math.floor(i % width / 8)] |= 128 >> (i % width % 8); });
    return out;
  }
  function twoBits(values, width, padding) {
    const stride = Math.ceil(width / 4), out = new Uint8Array(stride * (values.length / width));
    out.fill(padding ? 0x55 : 0);
    values.forEach((v, i) => {
      const j = Math.floor(i / width) * stride + Math.floor(i % width / 4), shift = 6 - (i % width % 4) * 2;
      out[j] = (out[j] & ~(3 << shift)) | v << shift;
    });
    return out;
  }
  const palette = [[0, 0, 0], [255, 255, 255], [255, 255, 0], [255, 0, 0]];
  function picksmart(image, preset) {
    const scanned = scan(image, preset.extra), { data } = scanned;
    const n = data.length / 4, white = new Uint8Array(n), red = new Uint8Array(n), values = new Uint8Array(n);
    const encoding = preset.extra.encoding;
    for (let i = 0; i < n; i++) {
      const r = data[i * 4] > 128, g = data[i * 4 + 1] > 128, b = data[i * 4 + 2] > 128;
      const w = r && g && b;
      white[i] = preset.extra.black_plane ? !r && !g && !b : w;
      red[i] = r && !g && (encoding === 'quicklz' || !b);
      values[i] = g && !w ? 2 : r && !w ? 3 : w ? 1 : 0;
    }
    if (encoding === '2bpp') return twoBits(values.subarray(0, n - n % 4), n - n % 4, 0);
    const first = bits(white), accent = preset.colors.includes('R') ? bits(red) : new Uint8Array();
    if (encoding === 'quicklz') {
      if (!global.GiciskyCompress2) throw new Error('Load gicisky/compress2.js for QuickLZ models');
      return global.GiciskyCompress2.compress(concat(first, accent));
    }
    if (encoding === 'lines') {
      const lineBytes = Math.floor(scanned.height / 8), blocks = [];
      for (const plane of [first, accent]) if (plane.length) {
        for (let line = 0; line < scanned.width; line++) {
          blocks.push(Uint8Array.of(0x75, lineBytes + 7, lineBytes, 0, 0, 0, 0), plane.slice(line * lineBytes, (line + 1) * lineBytes));
        }
      }
      const out = concat(new Uint8Array(4), ...blocks);
      new DataView(out.buffer).setUint32(0, out.length, true);
      return out;
    }
    return concat(first, accent);
  }
  function easyRuns(values) {
    const out = [];
    for (let i = 0; i < values.length;) {
      let run = 1;
      while (i + run < values.length && values[i + run] === values[i] && run < 65535) run++;
      if (run < 7) {
        let literal = 128;
        for (let j = 0; j < 7; j++) literal |= (values[i + j] || 0) << (6 - j);
        out.push(literal); i += 7;
      } else {
        const flag = values[i] << 6;
        if (run <= 31) out.push(flag | run);
        else if (run <= 255) out.push(flag | 1, run);
        else out.push(flag, run & 255, run >> 8);
        i += run;
      }
    }
    return Uint8Array.from(out);
  }
  function easytag(image, preset) {
    const scanned = scan(image), p = [[0, 0, 0], [250, 250, 250]];
    if (preset.colors === 'BWR') p.push([230, 0, 0]);
    const values = codes(scanned, p, preset.extra.dither !== false);
    const w = (image.width + 7) & ~7, h = (image.height + 7) & ~7, raw = [], runs = [];
    for (const color of preset.colors === 'BWR' ? [0, 2] : [0]) {
      const plane = new Uint8Array(w * h);
      values.forEach((v, i) => { plane[Math.floor(i / image.width) * w + i % image.width] = v === color; });
      const packed = bits(plane), rle = easyRuns(plane), flag = color === 2 ? 0x8000 : 0;
      const header = new Uint8Array(13), view = new DataView(header.buffer);
      header[0] = 0xfc;
      view.setUint16(1, flag); view.setUint16(5, flag | h - 1); view.setUint16(7, w - 1); view.setUint32(9, rle.length);
      runs.push(header, rle);
      const rawHeader = new Uint8Array(9), rv = new DataView(rawHeader.buffer);
      rawHeader[0] = color === 2 ? 3 : 0xfe;
      rv.setUint16(5, h - 1); rv.setUint16(7, w - 1);
      raw.push(rawHeader, packed);
    }
    const a = concat(...runs), b = concat(...raw);
    return a.length <= b.length ? a : b;
  }
  function etag(image, reverse) {
    const flat = scan(image);
    // Pillow's fixed-palette lookup uses the lower corner of a 4x4x4 RGB cell.
    for (let i = 0; i < flat.data.length; i++) if (i % 4 !== 3) flat.data[i] &= 0xfc;
    const values = codes(flat, [palette[0], palette[1], palette[3]]);
    const stride = Math.ceil(image.height / 8), black = new Uint8Array(image.width * stride), red = new Uint8Array(black.length);
    black.fill(255);
    for (let col = 0; col < image.width; col++) for (let row = 0; row < image.height; row++) {
      const x = reverse ? image.width - 1 - col : col, y = reverse ? image.height - 1 - row : row;
      const position = reverse ? row : row + stride * 8 - image.height;
      const i = col * stride + Math.floor(position / 8), bit = 128 >> position % 8;
      const code = values[y * image.width + x];
      if (code === 0) black[i] &= ~bit;
      if (code === 2) red[i] |= bit;
    }
    // NP61 pads the top with black. MN50 leaves trailing padding white.
    if (!reverse) for (let col = 0; col < image.width; col++) {
      for (let i = 0; i < stride * 8 - image.height; i++) black[col * stride] &= ~(128 >> i);
    }
    return [black, red];
  }
  function encode(protocol, image, preset) {
    validate(image, preset);
    if (protocol === 'picksmart') return picksmart(image, preset);
    if (protocol === 'easytag') return easytag(image, preset);
    if (protocol === 'etag') return { 'SE0213NP61-TNG-A0': etag(image, false), 'SE0213MN50-TNG-A0': etag(image, true) };
    const scanned = scan(image, preset.extra);
    const p = preset.colors === 'BWR' ? [palette[0], palette[1], palette[3]] : palette;
    const values = codes(scanned, p);
    if (protocol === 'wolink' && preset.colors === 'BWR') return concat(bits(values.map(v => v !== 0), scanned.width), bits(values.map(v => v === 2), scanned.width));
    if (!['xte', 'wolink'].includes(protocol)) throw new Error(`Unknown protocol: ${protocol}`);
    return twoBits(values, scanned.width, protocol === 'wolink' ? 1 : 0);
  }
  api.image = { encode, scan, bits, twoBits, easyRuns };
  api.concat = concat;
})(typeof window !== 'undefined' ? window : globalThis);
