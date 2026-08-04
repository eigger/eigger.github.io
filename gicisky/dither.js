/**
 * Palette quantization + Floyd–Steinberg dithering for e-ink.
 */
(function (global) {
  'use strict';

  const PALETTE_BW = [
    { name: 'black', r: 0, g: 0, b: 0 },
    { name: 'white', r: 255, g: 255, b: 255 },
  ];

  const PALETTE_BWR = [
    { name: 'black', r: 0, g: 0, b: 0 },
    { name: 'white', r: 255, g: 255, b: 255 },
    { name: 'red', r: 255, g: 0, b: 0 },
  ];

  const PALETTE_BWRY = [
    { name: 'black', r: 0, g: 0, b: 0 },
    { name: 'white', r: 255, g: 255, b: 255 },
    { name: 'yellow', r: 255, g: 220, b: 0 },
    { name: 'red', r: 255, g: 0, b: 0 },
  ];

  function pickPalette(device) {
    if (device.four_color) return PALETTE_BWRY;
    if (device.red) return PALETTE_BWR;
    return PALETTE_BW;
  }

  function nearestColor(r, g, b, palette) {
    let best = palette[0];
    let bestDist = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const c = palette[i];
      const dr = r - c.r;
      const dg = g - c.g;
      const db = b - c.b;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        best = c;
      }
    }
    return best;
  }

  function clampByte(v) {
    return v < 0 ? 0 : v > 255 ? 255 : v;
  }

  /**
   * Threshold quantization (no dither). Matches classic uploader rules when
   * lumThreshold/redThreshold provided; otherwise uses fixed 128 like hass.
   */
  function thresholdQuantize(imageData, device, opts) {
    const lumT = (opts && opts.lumThreshold != null) ? opts.lumThreshold : 128;
    const redT = (opts && opts.redThreshold != null) ? opts.redThreshold : 128;
    const yellowT = (opts && opts.yellowThreshold != null) ? opts.yellowThreshold : 128;
    const out = new ImageData(imageData.width, imageData.height);
    const src = imageData.data;
    const dst = out.data;
    const tftGray = device.tft ? 150 : 255;

    for (let i = 0; i < src.length; i += 4) {
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];

      if (device.four_color) {
        const white = (((r * 38) + (g * 75) + (b * 15)) >> 7) > 128 ? 1 : 0;
        let red = r > redT ? 1 : 0;
        let green = g > yellowT ? 1 : 0;
        const blue = b > 128 ? 1 : 0;
        if (green && red && blue) green = 0;
        if (red && white) red = 0;
        if (green) {
          dst[i] = 255; dst[i + 1] = 220; dst[i + 2] = 0;
        } else if (red) {
          dst[i] = 255; dst[i + 1] = 0; dst[i + 2] = 0;
        } else if (white) {
          dst[i] = 255; dst[i + 1] = 255; dst[i + 2] = 255;
        } else {
          dst[i] = 0; dst[i + 1] = 0; dst[i + 2] = 0;
        }
      } else {
        const isRed = device.red && r > redT && g < redT;
        if (isRed) {
          dst[i] = 255; dst[i + 1] = 0; dst[i + 2] = 0;
        } else {
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          if (lum > lumT) {
            dst[i] = tftGray; dst[i + 1] = tftGray; dst[i + 2] = tftGray;
          } else {
            dst[i] = 0; dst[i + 1] = 0; dst[i + 2] = 0;
          }
        }
      }
      dst[i + 3] = 255;
    }
    return out;
  }

  /**
   * Floyd–Steinberg dither onto device palette.
   * Returns a new ImageData with exact palette colors.
   */
  function floydSteinberg(imageData, device) {
    const w = imageData.width;
    const h = imageData.height;
    const palette = pickPalette(device);
    // Working buffer as float RGB
    const buf = new Float32Array(w * h * 3);
    const src = imageData.data;
    for (let i = 0, j = 0; i < src.length; i += 4, j += 3) {
      buf[j] = src[i];
      buf[j + 1] = src[i + 1];
      buf[j + 2] = src[i + 2];
    }

    const out = new ImageData(w, h);
    const dst = out.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 3;
        const oldR = buf[idx];
        const oldG = buf[idx + 1];
        const oldB = buf[idx + 2];
        const c = nearestColor(oldR, oldG, oldB, palette);
        const outIdx = (y * w + x) * 4;
        let pr = c.r;
        let pg = c.g;
        let pb = c.b;
        if (device.tft && c.name === 'white') {
          pr = pg = pb = 150;
        }
        dst[outIdx] = pr;
        dst[outIdx + 1] = pg;
        dst[outIdx + 2] = pb;
        dst[outIdx + 3] = 255;

        const errR = oldR - pr;
        const errG = oldG - pg;
        const errB = oldB - pb;

        const diffuse = (nx, ny, factor) => {
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) return;
          const di = (ny * w + nx) * 3;
          buf[di] += errR * factor;
          buf[di + 1] += errG * factor;
          buf[di + 2] += errB * factor;
        };

        diffuse(x + 1, y, 7 / 16);
        diffuse(x - 1, y + 1, 3 / 16);
        diffuse(x, y + 1, 5 / 16);
        diffuse(x + 1, y + 1, 1 / 16);
      }
    }

    // Clamp was applied via nearest; floats may overshoot neighbors — already quantized at write.
    return out;
  }

  /**
   * Quantize ImageData according to mode.
   * @param {ImageData} imageData
   * @param {object} device
   * @param {{ mode?: 'off'|'floyd', lumThreshold?: number, redThreshold?: number, yellowThreshold?: number }} opts
   */
  function quantize(imageData, device, opts) {
    const mode = (opts && opts.mode) || 'off';
    if (mode === 'floyd') {
      return floydSteinberg(imageData, device);
    }
    return thresholdQuantize(imageData, device, opts || {});
  }

  global.GiciskyDither = {
    PALETTE_BW,
    PALETTE_BWR,
    PALETTE_BWRY,
    pickPalette,
    nearestColor,
    thresholdQuantize,
    floydSteinberg,
    quantize,
  };
})(typeof window !== 'undefined' ? window : globalThis);
