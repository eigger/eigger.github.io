/** Pure command framing plus injectable browser crypto/compression. */
(function (global) {
  'use strict';
  const api = global.BleEsl, cat = (...a) => api.concat(...a);
  const bytes = a => Uint8Array.from(a);
  const ascii = s => new TextEncoder().encode(s);
  const hex = s => bytes(s.match(/../g).map(v => parseInt(v, 16)));
  const u16 = (n, little = false) => { const a = new Uint8Array(2); new DataView(a.buffer).setUint16(0, n, little); return a; };
  const u32 = (n, little = false) => { const a = new Uint8Array(4); new DataView(a.buffer).setUint32(0, n, little); return a; };
  const sum = a => a.reduce((n, b) => n + b, 0);
  function rle(a) {
    const out = [];
    for (let i = 0; i < a.length;) {
      let end = i + 1;
      while (end < a.length && end - i < 255 && a[end] === a[i]) end++;
      out.push(end - i, a[i]); i = end;
    }
    return bytes(out);
  }
  const xte = {
    object(pixels, w, h) {
      if (pixels.length !== Math.ceil(w / 4) * h) throw new Error('Invalid XTE buffer size');
      const half = Math.floor(pixels.length / 2), data = cat(rle(pixels.slice(0, half)), rle(pixels.slice(half)));
      const body = cat(hex('01000000110000000000000000'), u32(w), u32(h), bytes([1]), u32(data.length), data);
      return cat(ascii('XTEK'), u32(sum(body) >>> 0), u32(12 + body.length), body);
    },
    command(payload) {
      if (payload.length > 249) throw new Error('XTE command too long');
      return cat(hex('58544501'), bytes([6 + payload.length, sum(payload) & 255]), payload);
    },
    blocks(obj) {
      const count = Math.ceil(obj.length / 1211), out = [];
      if (count < 1 || count > 255) throw new Error('Invalid XTE block count');
      for (let i = 0; i < count; i++) {
        const body = cat(bytes([count, i]), obj.slice(i * 1211, (i + 1) * 1211));
        out.push(cat(hex('58544502'), u16(7 + body.length), bytes([sum(body) & 255]), body));
      }
      return out;
    },
    check(frame, expected) {
      if (frame.slice(0, 4).toString() !== '88,84,69,4') return false;
      if (frame.length < 6 || frame[4] < 7 || frame[4] > frame.length) throw new Error('Invalid XTE reply length');
      const body = frame.slice(6, frame[4]);
      if ((sum(body) & 255) !== frame[5] || body.toString() !== expected.toString()) throw new Error('XTE reply rejected');
      return true;
    },
  };
  const keyTable = 'b8b26356ec4473bd3f36e6495d756703a4bb835139f0b161423b5f286c4e97d60015bab2cdefb7ae0fcb099b599cc44d391645dde4b89b6e50f53dc046ec25acb8b26356ec4473bd3f36e6495d756703a4bb835139f0b161423b5f286c4e97d60015bab2cdefb7ae0fcb099b599ac44d391645dde4b89b6e50f53dc046ec25ac';
  function macBytes(mac) {
    if (typeof mac !== 'string' || !/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac)) throw new Error('easyTag needs its real MAC address (AA:BB:CC:DD:EE:FF); BluetoothDevice.id is not a MAC');
    return hex(mac.replaceAll(':', ''));
  }
  function crc16(a) {
    let crc = 65535;
    for (const b of a) {
      crc ^= b << 8;
      for (let j = 0; j < 8; j++) crc = ((crc << 1) ^ (crc & 0x8000 ? 0x8005 : 0)) & 65535;
    }
    return crc;
  }
  const sessionKey = (mac, index) => macBytes(mac).reduce((key, b) => key ^ b, keyTable.charCodeAt(index));
  const xor = (a, key, keep = -1) => a.map((v, i) => i === keep ? v : v ^ key);
  const easytag = {
    frames(mac, payload) {
      const key = sessionKey(mac, 98), count = Math.floor((payload.length + 201) / 200);
      const wrap = (a, keep) => xor(cat(a, u16(crc16(a))), key, keep);
      const out = [wrap(cat(hex('fffc'), ascii('easyTag'), bytes([98]), u32(payload.length), u16(count), ascii('BT')), 9)];
      for (let i = 1; i <= count; i++) {
        const chunk = new Uint8Array(200); chunk.set(payload.slice((i - 1) * 200, i * 200));
        out.push(wrap(cat(u16(i), chunk)));
      }
      return out;
    },
    reply(mac, frame) {
      if (frame.length < 4) throw new Error('Truncated easyTag reply');
      const a = xor(frame, sessionKey(mac, 0));
      return { batteryMv: a[2] * 100, temperatureC: a[3] > 127 ? a[3] - 256 : a[3] };
    },
  };
  const etag = {
    handshake: ['ac05ca', 'ac1100112233445566778899112233445566ca', 'ac07ca'].map(hex),
    refresh: hex('ac03ca'),
    packets(planes) {
      const out = [];
      planes.forEach((plane, number) => {
        const count = Math.ceil(plane.length / 230);
        for (let i = 0; i < count; i++) {
          const data = plane.slice(i * 230, (i + 1) * 230);
          out.push(cat(bytes([0xac, 1, number]), u16(i), u16(count), u16(data.length), data, bytes([0xca])));
        }
      });
      return out;
    },
    check(packet, reply) {
      const expected = { 5: 6, 17: 18, 7: 8, 1: 2, 3: 4 }[packet[1]];
      if (reply.length < 4 || reply[0] !== 0x91 || reply[reply.length - 1] !== 0x19 || reply[1] !== expected) throw new Error('Unexpected ETAG reply');
      if (packet[1] === 1) {
        if (reply.length < 6 || (reply[2] | reply[3] << 8) !== (packet[3] << 8 | packet[4]) || reply[4] !== 0) throw new Error('ETAG image packet rejected');
      } else if (packet[1] !== 7 && reply[2] !== 0) throw new Error('ETAG command rejected');
    },
  };
  const wolink = {
    async compress(raw, deflateRaw = async block => {
      let stream;
      try { stream = new CompressionStream('deflate-raw'); }
      catch { throw new Error('Raw DEFLATE unavailable; provide options.deflateRaw(bytes)'); }
      const result = new Response(new Blob([block]).stream().pipeThrough(stream));
      return new Uint8Array(await result.arrayBuffer());
    }) {
      const count = Math.ceil(raw.length / 8192), out = [];
      if (count < 1 || count > 255) throw new Error('Invalid WOLINK compression block count');
      out.push(bytes([0xa5, 0xa6, count, 2]));
      for (let i = 0; i < count; i++) {
        const data = await deflateRaw(raw.slice(i * 8192, (i + 1) * 8192));
        if (!(data instanceof Uint8Array) || data.length > 65535) throw new Error('Invalid DEFLATE result');
        out.push(bytes([i + 1]), u16(data.length, true), data);
      }
      return cat(...out);
    },
    async unlock(nonce) {
      if (nonce.length !== 16) throw new Error('WOLINK expected a 16-byte nonce');
      // For one block: CBC with IV=0 is ECB. Web Crypto adds a padding block; discard it.
      const key = await global.crypto.subtle.importKey('raw', hex('9b609f28bc49e25729bd7b8df22b4420'), 'AES-CBC', false, ['encrypt']);
      const encrypted = await global.crypto.subtle.encrypt({ name: 'AES-CBC', iv: new Uint8Array(16) }, key, nonce);
      return new Uint8Array(encrypted).slice(0, 16);
    },
    data: (offset, data) => cat(u16(0xa500, true), u32(offset, true), data),
    refresh: size => cat(u16(0xa502, true), u32(size, true)),
    check(frame) {
      if (frame.length >= 2 && frame[1]) throw new Error(`WOLINK device error ${frame[1]}`);
      return frame.length > 0 && [0, 255].includes(frame[0]);
    },
  };
  api.wire = { xte, easytag, etag, wolink, crc16, hex, u16, u32 };
})(typeof window !== 'undefined' ? window : globalThis);
