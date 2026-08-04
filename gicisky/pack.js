/**
 * Image packing for Gicisky panels — aligned with hass-gicisky writer.py.
 */
(function (global) {
  'use strict';

  const COMP_BLOCK_MARKER = 0x75;
  const COMP_HEADER_EXTRA = 7;

  function getPixel(data, width, height, x, y) {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  }

  /**
   * Rotate ImageData by 0/90/180/270 (PIL expand=True semantics).
   */
  function rotateImageData(imageData, degrees) {
    const rot = ((degrees % 360) + 360) % 360;
    if (rot === 0) {
      return {
        data: new Uint8ClampedArray(imageData.data),
        width: imageData.width,
        height: imageData.height,
      };
    }
    const sw = imageData.width;
    const sh = imageData.height;
    const src = imageData.data;
    let dw;
    let dh;
    if (rot === 90 || rot === 270) {
      dw = sh;
      dh = sw;
    } else {
      dw = sw;
      dh = sh;
    }
    const dst = new Uint8ClampedArray(dw * dh * 4);

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        let nx;
        let ny;
        if (rot === 90) {
          // PIL rotate(90) = counter-clockwise
          nx = y;
          ny = sw - 1 - x;
        } else if (rot === 180) {
          nx = sw - 1 - x;
          ny = sh - 1 - y;
        } else {
          // 270 CCW
          nx = sh - 1 - y;
          ny = x;
        }
        const si = (y * sw + x) * 4;
        const di = (ny * dw + nx) * 4;
        dst[di] = src[si];
        dst[di + 1] = src[si + 1];
        dst[di + 2] = src[si + 2];
        dst[di + 3] = src[si + 3];
      }
    }
    return { data: dst, width: dw, height: dh };
  }

  /**
   * TFT resample: (w/2, h*2) nearest-neighbor (hass uses BICUBIC; NN is fine for 1-bit).
   */
  function tftResize(imageData) {
    const sw = imageData.width;
    const sh = imageData.height;
    const dw = Math.floor(sw / 2);
    const dh = sh * 2;
    const src = imageData.data;
    const dst = new Uint8ClampedArray(dw * dh * 4);
    for (let y = 0; y < dh; y++) {
      for (let x = 0; x < dw; x++) {
        const sx = Math.min(sw - 1, Math.floor(x * sw / dw));
        const sy = Math.min(sh - 1, Math.floor(y * sh / dh));
        const si = (sy * sw + sx) * 4;
        const di = (y * dw + x) * 4;
        dst[di] = src[si];
        dst[di + 1] = src[si + 1];
        dst[di + 2] = src[si + 2];
        dst[di + 3] = 255;
      }
    }
    return { data: dst, width: dw, height: dh };
  }

  function compressLegacy(byteData, byteDataRed, width, height) {
    const bytesPerLine = Math.floor(height / 8);
    const buf = [0, 0, 0, 0];

    const appendChannel = (channelBytes) => {
      let pos = 0;
      for (let col = 0; col < width; col++) {
        buf.push(
          COMP_BLOCK_MARKER,
          bytesPerLine + COMP_HEADER_EXTRA,
          bytesPerLine,
          0, 0, 0, 0
        );
        for (let b = 0; b < bytesPerLine; b++) {
          buf.push(channelBytes[pos++]);
        }
      }
    };

    appendChannel(byteData);
    if (byteDataRed) appendChannel(byteDataRed);

    const len = buf.length;
    buf[0] = len & 0xff;
    buf[1] = (len >> 8) & 0xff;
    buf[2] = (len >> 16) & 0xff;
    buf[3] = (len >> 24) & 0xff;
    return Uint8Array.from(buf);
  }

  function packFourColor(pixels, width, height, device) {
    const byteData = [];
    let currentByte = 0;
    let shiftCounter = 3;
    const yStart = device.mirror_y ? height - 1 : 0;
    const yEnd = device.mirror_y ? -1 : height;
    const yStep = device.mirror_y ? -1 : 1;
    const xStart = device.mirror_x ? width - 1 : 0;
    const xEnd = device.mirror_x ? -1 : width;
    const xStep = device.mirror_x ? -1 : 1;

    for (let y = yStart; y !== yEnd; y += yStep) {
      for (let x = xStart; x !== xEnd; x += xStep) {
        const [r, g, b] = getPixel(pixels, width, height, x, y);
        const pixelIsWhite = r > 128 && g > 128 && b > 128;
        const pixelIsBlack = r <= 128 && g <= 128 && b <= 128;
        let isWhite = device.invert_luminance ? pixelIsBlack : pixelIsWhite;
        let isRed = r > 128;
        let isGreen = g > 128;
        let isBlue = b > 128;
        if (isGreen && isRed && isBlue) isGreen = false;
        if (isRed && isWhite) isRed = false;
        // 00 black, 01 white, 10 yellow, 11 red
        const val = isGreen ? 2 : isRed ? 3 : isWhite ? 1 : 0;
        currentByte |= val << (shiftCounter * 2);
        if (shiftCounter === 0) {
          byteData.push(currentByte);
          currentByte = 0;
          shiftCounter = 3;
        } else {
          shiftCounter -= 1;
        }
      }
    }
    return Uint8Array.from(byteData);
  }

  function packPlanes(pixels, width, height, device, forCompression2) {
    const totalPixels = width * height;
    const planeBytes = Math.floor(totalPixels / 8);
    const bwPlane = new Uint8Array(planeBytes);
    const redPlane = device.red ? new Uint8Array(planeBytes) : null;
    let byteIdx = 0;
    let bitPos = 7;

    const yStart = device.mirror_y ? height - 1 : 0;
    const yEnd = device.mirror_y ? -1 : height;
    const yStep = device.mirror_y ? -1 : 1;
    const xStart = device.mirror_x ? width - 1 : 0;
    const xEnd = device.mirror_x ? -1 : width;
    const xStep = device.mirror_x ? -1 : 1;

    for (let y = yStart; y !== yEnd; y += yStep) {
      for (let x = xStart; x !== xEnd; x += xStep) {
        const [r, g, b] = getPixel(pixels, width, height, x, y);
        const pixelIsWhite = r > 128 && g > 128 && b > 128;
        const pixelIsBlack = r <= 128 && g <= 128 && b <= 128;
        const isWhite = device.invert_luminance ? pixelIsBlack : pixelIsWhite;
        let isRed;
        if (forCompression2) {
          isRed = r > 128 && g <= 128;
        } else {
          isRed = r > 128 && g <= 128 && b <= 128;
        }

        if (isWhite) bwPlane[byteIdx] |= 1 << bitPos;
        if (redPlane && isRed) redPlane[byteIdx] |= 1 << bitPos;

        bitPos -= 1;
        if (bitPos < 0) {
          byteIdx += 1;
          bitPos = 7;
        }
      }
    }
    return { bwPlane, redPlane };
  }

  /**
   * Pack quantized canvas ImageData into device payload bytes.
   * @param {ImageData} imageData - already quantized (palette colors)
   * @param {object} device - DeviceEntry
   * @returns {Uint8Array}
   */
  function packImage(imageData, device) {
    let working = {
      data: new Uint8ClampedArray(imageData.data),
      width: imageData.width,
      height: imageData.height,
    };

    // hass: TFT resize before rotation
    if (device.tft) {
      working = tftResize(working);
    }
    if (device.rotation) {
      working = rotateImageData(working, device.rotation);
    }

    const { data, width, height } = working;

    if (device.four_color) {
      return packFourColor(data, width, height, device);
    }

    if (device.compression2) {
      const { bwPlane, redPlane } = packPlanes(data, width, height, device, true);
      const raw = new Uint8Array(bwPlane.length + (redPlane ? redPlane.length : 0));
      raw.set(bwPlane, 0);
      if (redPlane) raw.set(redPlane, bwPlane.length);
      return global.GiciskyCompress2.compress(raw);
    }

    const { bwPlane, redPlane } = packPlanes(data, width, height, device, false);
    const byteData = Array.from(bwPlane);
    const byteDataRed = redPlane ? Array.from(redPlane) : null;

    // Legacy compression expects column-major layout (outer x) like original
    // hass _compress_byte_data: bytes packed row-major then wrapped per column of height/8.
    // After row-major packing, bytesPerLine = height/8 contiguous bytes = one column.
    // So the plane must be packed column-major for legacy compression!
    // hass packs row-major for uncompressed, but for compression flag it uses the same
    // byte_data from row-major loops... wait:
    // Looking at writer: the loop is for y in ...: for x in ...:  → ROW-MAJOR
    // Then _compress_byte_data takes bytesPerLine = height // 8 and walks width columns
    // taking bytesPerLine bytes each. For that to be a column, packing must be COLUMN-major!
    //
    // Actually with row-major: bit stream goes left-to-right then next row.
    // bytesPerLine = height/8 would be wrong for row-major...
    //
    // Wait - if height=416, width=240 for 3.7":
    // Row-major: each row has width/8 = 30 bytes. Total = 416*30.
    // Column compression: bytesPerLine = height/8 = 52, loops width=240 times → 240*52 = 12480 = one plane.
    // For column-major packing (x outer, y inner): each column is height bits = height/8 bytes.
    // So legacy compression REQUIRES column-major packing!
    //
    // But hass packs row-major then uses compression with bytesPerLine = height//8.
    // That only works if after rotation the "row-major" happens to store columns?
    // for y: for x:  is row-major (x varies fastest).
    // Column of pixels at fixed x, varying y are NOT contiguous in row-major.
    //
    // Unless... for 3.7" with rotation 180, dimensions stay 240x416.
    // Hmm, looking again at the Python loop - it IS row-major.
    // And _compress_byte_data does:
    //   byte_per_line = self.height // 8
    //   for _ in range(self.width):
    //     take byte_per_line bytes from byte_data
    //
    // self.height is the ORIGINAL device height (416), not post-rotation!
    // And byte_data was built from post-rotation width/height.
    //
    // After rot 180: still 240x416. Row-major: 416 rows * 30 bytes/row = 12480.
    // Taking 52-byte chunks 240 times also = 12480. So it's just slicing the
    // row-major buffer into 52-byte pieces — NOT actual columns. It's a
    // "fake compression" wire format that the firmware expects with this slicing.
    // So we should match hass: row-major pack + slice by height//8.

    if (device.compression) {
      // Use original device height for bytesPerLine (hass uses self.height)
      return compressLegacy(byteData, device.red ? byteDataRed : null, device.width, device.height);
    }

    if (device.red && byteDataRed) {
      return Uint8Array.from(byteData.concat(byteDataRed));
    }
    return Uint8Array.from(byteData);
  }

  /**
   * Pack from ImageData using dither module for quantization first.
   */
  function packFromCanvasImageData(imageData, device, quantOpts) {
    const quantized = global.GiciskyDither.quantize(imageData, device, quantOpts || { mode: 'off' });
    return {
      quantized,
      payload: packImage(quantized, device),
    };
  }

  global.GiciskyPack = {
    packImage,
    packFromCanvasImageData,
    rotateImageData,
    tftResize,
    compressLegacy,
  };
})(typeof window !== 'undefined' ? window : globalThis);
