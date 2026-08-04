/**
 * Gicisky device definitions aligned with hass-gicisky DeviceEntry.
 * UI keys (0B, 33, 2B, ...) map to full device IDs.
 */
(function (global) {
  'use strict';

  /**
   * @typedef {Object} DeviceEntry
   * @property {number} id
   * @property {string} uiKey
   * @property {string} name
   * @property {string} model
   * @property {number} width
   * @property {number} height
   * @property {boolean} red
   * @property {boolean} tft
   * @property {boolean} mirror_x
   * @property {boolean} mirror_y
   * @property {number} rotation
   * @property {boolean} compression
   * @property {boolean} compression2
   * @property {boolean} invert_luminance
   * @property {boolean} four_color
   * @property {string} maxWidth
   * @property {string} [background]
   * @property {string} inch
   * @property {string} shape
   * @property {string} cm
   * @property {string} colors
   */

  /** @type {Record<number, DeviceEntry>} */
  const DEVICE_TYPES = {
    0x00A0: {
      id: 0x00A0,
      uiKey: 'A0',
      name: 'TFT 21',
      model: 'TFT 2.1" BW',
      width: 250,
      height: 132,
      red: false,
      tft: true,
      mirror_x: true,
      mirror_y: false,
      rotation: 90,
      compression: false,
      compression2: false,
      invert_luminance: false,
      four_color: false,
      maxWidth: '350px',
      background: '#ccc',
      inch: '2.1 TFT',
      shape: '가로형 (TFT)',
      cm: '약 6×3cm',
      colors: '흑백만',
    },
    0x010B: {
      id: 0x010B,
      uiKey: '0B',
      name: 'EPD 21',
      model: 'EPD 2.1" BWR',
      width: 250,
      height: 128,
      red: true,
      tft: false,
      mirror_x: true,
      mirror_y: false,
      rotation: 270,
      compression: false,
      compression2: false,
      invert_luminance: false,
      four_color: false,
      maxWidth: '350px',
      inch: '2.1',
      shape: '가로형 소형',
      cm: '약 6×3cm',
      colors: '흑백빨강',
    },
    0x0033: {
      id: 0x0033,
      uiKey: '33',
      name: 'EPD 29',
      model: 'EPD 2.9" BWR',
      width: 296,
      height: 128,
      red: true,
      tft: false,
      mirror_x: false,
      mirror_y: false,
      rotation: 90,
      compression: false,
      compression2: false,
      invert_luminance: false,
      four_color: false,
      maxWidth: '396px',
      inch: '2.9',
      shape: '가로형 (2.1보다 넓음)',
      cm: '약 7×3cm',
      colors: '흑백빨강',
    },
    0x022B: {
      id: 0x022B,
      uiKey: '22B',
      name: 'EPD 37',
      model: 'EPD 3.7" BWR',
      width: 240,
      height: 416,
      red: true,
      tft: false,
      mirror_x: true,
      mirror_y: false,
      rotation: 180,
      compression: true,
      compression2: false,
      invert_luminance: false,
      four_color: false,
      maxWidth: '450px',
      inch: '3.7',
      shape: '세로형 길쭉',
      cm: '약 5×10cm',
      colors: '흑백빨강',
    },
    0x004B: {
      id: 0x004B,
      uiKey: '4B',
      name: 'EPD 42',
      model: 'EPD 4.2" BWR',
      width: 400,
      height: 300,
      red: true,
      tft: false,
      mirror_x: false,
      mirror_y: false,
      rotation: 0,
      compression: false,
      compression2: false,
      invert_luminance: false,
      four_color: false,
      maxWidth: '450px',
      inch: '4.2',
      shape: '거의 정사각',
      cm: '약 10×7cm',
      colors: '흑백빨강',
    },
    0x004E: {
      id: 0x004E,
      uiKey: '4E',
      name: 'EPD 42',
      model: 'EPD 4.2" BWRY',
      width: 400,
      height: 300,
      red: true,
      tft: false,
      mirror_x: false,
      mirror_y: false,
      rotation: 0,
      compression: false,
      compression2: false,
      invert_luminance: false,
      four_color: true,
      maxWidth: '450px',
      inch: '4.2',
      shape: '거의 정사각',
      cm: '약 10×7cm',
      colors: '흑백빨강노랑',
    },
    0x012B: {
      id: 0x012B,
      uiKey: '2B',
      name: 'EPD 75',
      model: 'EPD 7.5" BWR',
      width: 800,
      height: 480,
      red: true,
      tft: false,
      mirror_x: false,
      mirror_y: true,
      rotation: 0,
      compression: false,
      compression2: true,
      invert_luminance: true,
      four_color: false,
      maxWidth: '530px',
      inch: '7.5',
      shape: '대형 가로',
      cm: '약 16×10cm',
      colors: '흑백빨강',
    },
    0x008B: {
      id: 0x008B,
      uiKey: '8B',
      name: 'EPD 102',
      model: 'EPD 10.2" BWR',
      width: 960,
      height: 640,
      red: true,
      tft: false,
      mirror_x: false,
      mirror_y: false,
      rotation: 0,
      compression: false,
      compression2: true,
      invert_luminance: false,
      four_color: false,
      maxWidth: '550px',
      inch: '10.2',
      shape: '초대형 가로',
      cm: '약 19×13cm',
      colors: '흑백빨강',
    },
    0x002E: {
      id: 0x002E,
      uiKey: '2E',
      name: 'EPD 29',
      model: 'EPD 2.9" BWRY',
      width: 296,
      height: 128,
      red: true,
      tft: false,
      mirror_x: false,
      mirror_y: false,
      rotation: 90,
      compression: false,
      compression2: false,
      invert_luminance: false,
      four_color: true,
      maxWidth: '396px',
      inch: '2.9',
      shape: '가로형',
      cm: '약 7×3cm',
      colors: '흑백빨강노랑',
    },
  };

  /** KO uploader select order */
  const UI_ORDER_KO = ['0B', '33', '22B', '4B', '2B', '8B', 'A0'];

  /** EN uploader order (includes BWRY) */
  const UI_ORDER_EN = ['0B', '33', '2E', '22B', '4B', '4E', '2B', '8B', 'A0'];

  const UI_KEY_TO_ID = {};
  Object.values(DEVICE_TYPES).forEach((d) => {
    UI_KEY_TO_ID[d.uiKey] = d.id;
  });

  /**
   * Resolve device from UI key or numeric id.
   * @param {string|number} keyOrId
   * @param {{ legacy75?: boolean }} [opts]
   * @returns {DeviceEntry|null}
   */
  function getDevice(keyOrId, opts) {
    let id;
    if (typeof keyOrId === 'string') {
      const cleaned = keyOrId.replace(/^0x/i, '').toUpperCase();
      id = UI_KEY_TO_ID[cleaned];
      if (id === undefined) {
        id = parseInt(cleaned, 16);
      }
    } else {
      id = keyOrId;
    }
    if (!(id in DEVICE_TYPES)) return null;
    const device = Object.assign({}, DEVICE_TYPES[id]);
    // 7.5" old firmware 0x8101 → legacy compression (hass get_device)
    if (opts && opts.legacy75 && id === 0x012B) {
      device.compression = true;
      device.compression2 = false;
    }
    return device;
  }

  function listDevices(order) {
    return (order || UI_ORDER_KO)
      .map((key) => getDevice(key))
      .filter(Boolean);
  }

  global.GiciskyDevices = {
    DEVICE_TYPES,
    UI_ORDER_KO,
    UI_ORDER_EN,
    UI_KEY_TO_ID,
    getDevice,
    listDevices,
  };
})(typeof window !== 'undefined' ? window : globalThis);
