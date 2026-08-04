/**
 * BLE protocol helpers for Gicisky image upload.
 */
(function (global) {
  'use strict';

  const IMAGE_PART_BYTES = 240;
  const IMAGE_PART_HEX_LEN = IMAGE_PART_BYTES * 2;
  const OPTIONAL_SERVICES = [0xFEF0, 0xFDF0];
  const MANUFACTURER_ID = 0x5053;

  /**
   * Build SIZE (0x02) command hex.
   * compression2: 6 bytes [02][size LE][01]
   * otherwise: 8 bytes [02][size LE][00 00 00]
   */
  function makeSizeCommandHex(payloadByteLength, compression2) {
    const sizeHex = global.GiciskyUtils.u32LeHex(payloadByteLength);
    if (compression2) {
      return '02' + sizeHex + '01';
    }
    return '02' + sizeHex + '000000';
  }

  function makeSizeCommandBytes(payloadByteLength, compression2) {
    return global.GiciskyUtils.hexToBytes(makeSizeCommandHex(payloadByteLength, compression2));
  }

  function totalParts(hexLength) {
    return Math.ceil(hexLength / IMAGE_PART_HEX_LEN);
  }

  function progressPercent(partIndex, parts) {
    if (!parts) return 0;
    return Math.min(100, Math.round((partIndex / parts) * 100));
  }

  global.GiciskyBle = {
    IMAGE_PART_BYTES,
    IMAGE_PART_HEX_LEN,
    OPTIONAL_SERVICES,
    MANUFACTURER_ID,
    makeSizeCommandHex,
    makeSizeCommandBytes,
    totalParts,
    progressPercent,
  };
})(typeof window !== 'undefined' ? window : globalThis);
