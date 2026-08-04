/**
 * QuickLZ L1 compression2 for Gicisky large panels (7.5"/10.2").
 * Port of hass-gicisky gicisky_ble/compression.py — 64-bucket hash required.
 */
(function (global) {
  'use strict';

  const CWORD_LEN = 4;
  const HASH_VALUES = 64;
  const NO_ENTRY = -1;
  const MINOFFSET = 2;
  const UNCONDITIONAL_MATCHLEN_COMPRESSOR = 12;
  const UNCOMPRESSED_END = 4;
  const CHUNK_SIZE = 64;

  function hashFunc(fetch) {
    return ((fetch >> 12) ^ fetch) & (HASH_VALUES - 1);
  }

  function fastRead3(data, pos) {
    if (pos + 3 > data.length) return 0;
    return data[pos] | (data[pos + 1] << 8) | (data[pos + 2] << 16);
  }

  function same(data, pos, n) {
    if (pos < 0 || pos + n >= data.length) return false;
    const v = data[pos];
    for (let i = 1; i <= n; i++) {
      if (data[pos + i] !== v) return false;
    }
    return true;
  }

  function writeU32LE(buf, offset, value) {
    buf[offset] = value & 0xff;
    buf[offset + 1] = (value >> 8) & 0xff;
    buf[offset + 2] = (value >> 16) & 0xff;
    buf[offset + 3] = (value >> 24) & 0xff;
  }

  function qlzCompressCore(source) {
    const size = source.length;
    const lastByteIdx = size - 1;
    const lastMatchstart = lastByteIdx - UNCONDITIONAL_MATCHLEN_COMPRESSOR - UNCOMPRESSED_END;
    if (lastMatchstart < 0) return null;

    const out = new Uint8Array(size * 2 + 400);
    let cwordPtr = 0;
    let dst = CWORD_LEN;
    let cwordVal = (1 << 31) >>> 0;
    let src = 0;
    let lits = 0;

    const hOffset = new Int32Array(HASH_VALUES);
    const hCache = new Int32Array(HASH_VALUES);
    for (let i = 0; i < HASH_VALUES; i++) hOffset[i] = NO_ENTRY;

    while (src <= lastMatchstart) {
      if ((cwordVal & 1) === 1) {
        if (src > (size >> 1) && dst > src - (src >> 5)) {
          return null;
        }
        writeU32LE(out, cwordPtr, ((cwordVal >>> 1) | (1 << 31)) >>> 0);
        cwordPtr = dst;
        dst += CWORD_LEN;
        cwordVal = (1 << 31) >>> 0;
      }

      const fetch = fastRead3(source, src);
      const h = hashFunc(fetch);
      const cached = (fetch ^ hCache[h]) >>> 0;
      hCache[h] = fetch;
      const o = hOffset[h];
      hOffset[h] = src;

      const dist = src - o;
      if (
        (cached & 0xffffff) === 0 &&
        o !== NO_ENTRY &&
        (dist > MINOFFSET ||
          (src === o + 1 && lits >= 3 && src > 3 && same(source, src - 3, 6)))
      ) {
        let matchlen = 3;
        const remaining = Math.min(255, lastByteIdx - UNCOMPRESSED_END - src + 1);
        while (matchlen < remaining && source[src + matchlen] === source[o + matchlen]) {
          matchlen++;
        }

        const hShifted = h << 4;
        cwordVal = ((cwordVal >>> 1) | (1 << 31)) >>> 0;

        if (matchlen < 18) {
          const val = (matchlen - 2) | hShifted;
          out[dst] = val & 0xff;
          out[dst + 1] = (val >> 8) & 0xff;
          dst += 2;
        } else {
          out[dst] = hShifted & 0xff;
          out[dst + 1] = (hShifted >> 8) & 0xff;
          out[dst + 2] = matchlen & 0xff;
          dst += 3;
        }

        src += matchlen;
        lits = 0;
      } else {
        lits++;
        out[dst] = source[src];
        src++;
        dst++;
        cwordVal = cwordVal >>> 1;
      }
    }

    while (src <= lastByteIdx) {
      if ((cwordVal & 1) === 1) {
        writeU32LE(out, cwordPtr, ((cwordVal >>> 1) | (1 << 31)) >>> 0);
        cwordPtr = dst;
        dst += CWORD_LEN;
        cwordVal = (1 << 31) >>> 0;
      }

      if (src <= lastByteIdx - 2) {
        const f = fastRead3(source, src);
        const hh = hashFunc(f);
        hCache[hh] = f;
        hOffset[hh] = src;
      }

      out[dst] = source[src];
      src++;
      dst++;
      cwordVal = cwordVal >>> 1;
    }

    while ((cwordVal & 1) !== 1) {
      cwordVal = cwordVal >>> 1;
    }
    writeU32LE(out, cwordPtr, ((cwordVal >>> 1) | (1 << 31)) >>> 0);

    if (dst >= size) return null;
    return out.subarray(0, dst);
  }

  function compressChunked(data, forceRaw) {
    const output = [];
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.subarray(i, Math.min(i + CHUNK_SIZE, data.length));
      const n = chunk.length;
      const compressed = forceRaw ? null : qlzCompressCore(chunk);
      if (compressed !== null) {
        const totalLen = 3 + compressed.length;
        output.push(0x75, totalLen & 0xff, n & 0xff);
        for (let j = 0; j < compressed.length; j++) output.push(compressed[j]);
      } else {
        const totalLen = 3 + n;
        output.push(0x74, totalLen & 0xff, n & 0xff);
        for (let j = 0; j < n; j++) output.push(chunk[j]);
      }
    }
    return Uint8Array.from(output);
  }

  /**
   * compression2 format: [4B LE part2 len] + part1 chunks + part2 chunks
   * @param {Uint8Array|number[]} data
   * @param {boolean} [forceRaw]
   * @returns {Uint8Array}
   */
  function compress(data, forceRaw) {
    const bytes = data instanceof Uint8Array ? data : Uint8Array.from(data);
    const totalLen = bytes.length;
    const split = Math.floor(totalLen / 2);
    const part1 = bytes.subarray(0, split);
    const part2 = bytes.subarray(split);
    const c1 = compressChunked(part1, !!forceRaw);
    const c2 = compressChunked(part2, !!forceRaw);
    const out = new Uint8Array(4 + c1.length + c2.length);
    writeU32LE(out, 0, part2.length);
    out.set(c1, 4);
    out.set(c2, 4 + c1.length);
    return out;
  }

  global.GiciskyCompress2 = {
    compress,
    CHUNK_SIZE,
    HASH_VALUES,
    _qlzCompressCore: qlzCompressCore,
  };
})(typeof window !== 'undefined' ? window : globalThis);
