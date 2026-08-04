/**
 * Shared hex / byte helpers for Gicisky uploader.
 */
(function (global) {
  'use strict';

  function bytesToHex(buffer) {
    const bytes = buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : buffer instanceof Uint8Array
        ? buffer
        : Uint8Array.from(buffer);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  function hexToBytes(hex) {
    const cleaned = String(hex).replace(/[^0-9a-fA-F]/g, '');
    const out = new Uint8Array(cleaned.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(cleaned.substr(i * 2, 2), 16);
    }
    return out;
  }

  /** Little-endian u32 as 8-char hex (BLE part index / size). */
  function u32LeHex(num) {
    const n = num >>> 0;
    return (
      ((n) & 0xff).toString(16).padStart(2, '0') +
      ((n >> 8) & 0xff).toString(16).padStart(2, '0') +
      ((n >> 16) & 0xff).toString(16).padStart(2, '0') +
      ((n >> 24) & 0xff).toString(16).padStart(2, '0')
    );
  }

  /** Alias used by existing BLE code — little-endian u32 hex. */
  function intToHex(num) {
    return u32LeHex(num);
  }

  global.GiciskyUtils = {
    bytesToHex,
    hexToBytes,
    intToHex,
    u32LeHex,
  };
})(typeof window !== 'undefined' ? window : globalThis);
