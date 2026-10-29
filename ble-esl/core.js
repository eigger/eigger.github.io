/** Headless ESL uploader facade. Load models, image, wire and bluetooth first. */
(function (global) {
  'use strict';
  const api = global.BleEsl, { wire, bluetooth: bt } = api;
  const cat = (...a) => api.concat(...a), one = n => Uint8Array.of(n);
  const copy = value => JSON.parse(JSON.stringify(value));
  function presetFor(protocol, key, advertisement) {
    if (advertisement?.protocol && advertisement.protocol !== protocol) throw new Error('Advertisement protocol does not match');
    const advertisedKey = advertisement?.protocol === protocol ? advertisement.modelKey : null;
    if (key != null && advertisedKey && key !== advertisedKey) {
      throw new Error(`Model mismatch: selected ${key}, advertised ${advertisedKey}`);
    }
    const modelKey = key ?? advertisedKey;
    const preset = api.models[protocol]?.find(p => p.key === modelKey);
    if (!preset) throw new Error(`Unknown ${protocol} model: ${modelKey}`);
    const out = copy(preset);
    if (protocol === 'picksmart' && advertisement?.raw?.device_id === 0x012b && advertisement.raw?.firmware === 0x8101) out.extra.encoding = 'lines';
    if (protocol === 'xte' && [97, 102, 106, 109, 119, 122].includes(advertisement?.raw?.device_number)) throw new Error('Unsupported XTE pixel packing');
    return out;
  }
  async function prepare(protocol, key, imageData, options = {}) {
    const preset = presetFor(protocol, key, options.advertisement);
    const raw = api.image.encode(protocol, imageData, preset);
    let payload = raw;
    if (protocol === 'wolink') payload = { data: await wire.wolink.compress(raw, options.deflateRaw), rawSize: raw.length };
    if (protocol === 'xte') {
      const rotated = (preset.extra.rotation || 0) % 180;
      payload = wire.xte.object(raw, rotated ? preset.height : preset.width, rotated ? preset.width : preset.height);
    }
    if (protocol === 'easytag') payload = wire.easytag.frames(options.mac, raw);
    if (protocol === 'etag') payload = Object.fromEntries(Object.entries(raw).map(([panel, planes]) => [panel, wire.etag.packets(planes)]));
    return { protocol, preset, payload, mac: options.mac };
  }
  function progress(options, stage, current = 0, total = 0) {
    options.onProgress?.({ stage, current, total, percent: total ? Math.min(100, Math.round(current / total * 100)) : 0 });
  }
  async function picksmart(t, prepared, options) {
    let chars = [];
    for (const service of bt.services.picksmart) {
      try {
        const svc = await t.bounded(t.server.getPrimaryService(service), 10000, 'PickSmart service');
        chars = await t.bounded(svc.getCharacteristics(), 10000, 'PickSmart characteristics');
        if (chars.length >= 2) break;
      } catch (error) { if (error.name !== 'NotFoundError') throw error; }
    }
    chars.sort((a, b) => parseInt(a.uuid.slice(4, 8), 16) - parseInt(b.uuid.slice(4, 8), 16));
    if (chars.length < 2) throw new Error('PickSmart requires command and image characteristics');
    const [command, image] = chars, data = prepared.payload, total = Math.ceil(data.length / 240);
    await t.subscribe(command); await t.pause(200);
    let reply;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { reply = await t.request(command, one(1), 400); break; }
      catch (error) { if (!(error instanceof bt.TimeoutError) || t.failure || attempt === 2) throw error; }
    }
    if (reply[0] !== 1 || reply[1] !== 0xf4 || reply[2] !== 0) throw new Error('PickSmart START rejected');
    const size = cat(one(2), wire.u32(data.length, true), prepared.preset.extra.encoding === 'quicklz' ? one(1) : new Uint8Array(3));
    reply = await t.request(command, size);
    if (reply[0] !== 2) throw new Error('PickSmart SIZE rejected');
    reply = await t.request(command, one(3));
    let previous = -1, repeats = 0, sent = new Set();
    while (true) {
      if (reply.length < 6 || reply[0] !== 5 || reply[1] !== 0) throw new Error('Invalid PickSmart part request');
      const part = new DataView(reply.buffer, reply.byteOffset, reply.byteLength).getUint32(2, true);
      if (part >= total) throw new Error('PickSmart requested an out-of-range part');
      repeats = part === previous ? repeats + 1 : 1; previous = part;
      if (repeats >= 6) throw new Error(`PickSmart transfer stalled at part ${part}`);
      if (repeats > 1) await t.pause(50 * (repeats - 1));
      if (options.pacingMs) await t.pause(options.pacingMs);
      reply = await t.request(image, cat(wire.u32(part, true), data.slice(part * 240, (part + 1) * 240)));
      sent.add(part);
      progress(options, 'transfer', sent.size, total);
      if (reply[0] === 5 && reply[1] === 8) {
        if (part !== total - 1 || sent.size !== total) throw new Error('PickSmart reported premature completion');
        return {};
      }
    }
  }
  async function xte(t, prepared, options) {
    const service = bt.services.xte[0];
    const write = await t.characteristic(service, '00002760-08c2-11e1-9073-0e8ac72e0001');
    const notify = await t.characteristic(service, '00002760-08c2-11e1-9073-0e8ac72e0002');
    // Web Bluetooth exposes no negotiated MTU. 20 bytes is the safe default.
    const size = options.chunkSize ?? 20;
    // Browser write-without-response resolves when queued, not when the tag consumes it.
    const gap = options.chunkGapMs ?? 30;
    const replyTimeout = options.replyTimeoutMs ?? 15000;
    let chunks = 0;
    const trace = event => options.onTrace?.({ protocol: 'xte', ...event });
    const toHex = frame => Array.from(frame, b => b.toString(16).padStart(2, '0')).join('');
    trace({ event: 'settings', chunkSize: size, chunkGapMs: gap, bytes: prepared.payload.length, replyTimeoutMs: replyTimeout });
    const send = async frame => {
      for (let i = 0; i < frame.length; i += size) { await t.write(write, frame.slice(i, i + size), false); chunks++; if (gap) await t.pause(gap); }
      if (options.pacingMs) await t.pause(options.pacingMs);
    };
    const command = async (payload, expected) => {
      const name = payload[0] === 1 ? 'START' : 'END';
      trace({ event: 'command', name, hex: toHex(wire.xte.command(payload)), chunks });
      t.clear(); await send(wire.xte.command(payload));
      try {
        await t.waitFor(reply => {
          trace({ event: 'reply', name, hex: toHex(reply) });
          return wire.xte.check(reply, expected);
        }, replyTimeout);
      } catch (error) {
        if (error instanceof bt.TimeoutError && !t.failure) error.message = `Timed out: XTE ${name} reply (${replyTimeout}ms; ${chunks} writes)`;
        throw error;
      }
    };
    await t.subscribe(notify); await t.pause(500);
    await command(cat(one(1), wire.u32(prepared.payload.length)), wire.hex('01ffbd'));
    const frames = wire.xte.blocks(prepared.payload);
    for (let i = 0; i < frames.length; i++) {
      const started = Date.now(); await send(frames[i]);
      trace({ event: 'block', number: i + 1, total: frames.length, bytes: frames[i].length, checksum: frames[i][6], chunks, elapsedMs: Date.now() - started });
      progress(options, 'transfer', i + 1, frames.length);
    }
    progress(options, 'finish');
    await command(wire.hex('0400'), wire.hex('04ff'));
    return {};
  }
  async function easytag(t, prepared, options) {
    const service = bt.services.easytag[0];
    const write = await t.characteristic(service, '00001525-1212-efde-1523-785feabcd123');
    const notify = await t.characteristic(service, '00001526-1212-efde-1523-785feabcd123');
    await t.subscribe(notify); await t.pause(800); t.clear();
    for (let i = 0; i < prepared.payload.length; i++) {
      // Arm before the final write: its reply can arrive before the write resolves.
      if (i === prepared.payload.length - 1) t.clear();
      await t.write(write, prepared.payload[i], false);
      progress(options, 'transfer', i + 1, prepared.payload.length);
      await t.pause(20 + (options.pacingMs || 0) + (i % 5 === 0 ? 3 : 0));
    }
    progress(options, 'finish');
    return wire.easytag.reply(prepared.mac, await t.next(20000));
  }
  async function etag(t, prepared, options) {
    const firmware = new TextDecoder().decode(await t.read(await t.characteristic(bt.services.etag[1], '00002a26-0000-1000-8000-00805f9b34fb')));
    const panel = Object.keys(prepared.payload).find(key => firmware.includes(key));
    if (!panel) throw new Error(`Unsupported ETAG panel firmware: ${firmware}`);
    const char = await t.characteristic(bt.services.etag[0], '0000ffe1-0000-1000-8000-00805f9b34fb');
    await t.subscribe(char);
    const send = async packet => wire.etag.check(packet, await t.request(char, packet, 30000, false));
    for (const packet of wire.etag.handshake) await send(packet);
    const packets = prepared.payload[panel];
    for (let i = 0; i < packets.length; i++) {
      await send(packets[i]); progress(options, 'transfer', i + 1, packets.length);
      if (options.pacingMs) await t.pause(options.pacingMs);
    }
    progress(options, 'finish'); await send(wire.etag.refresh); await t.pause(1000);
    return { firmware: panel };
  }
  async function wolink(t, prepared, options) {
    const service = bt.services.wolink[0];
    const auth = await t.characteristic(service, '33323032-4c53-4545-4c42-4b4e494c4f57');
    await t.write(auth, await wire.wolink.unlock(await t.read(auth))); await t.pause(500);
    const data = await t.characteristic(service, '31323032-4c53-4545-4c42-4b4e494c4f57');
    const status = await t.characteristic(service, '34323032-4c53-4545-4c42-4b4e494c4f57');
    await t.subscribe(status);
    const payload = prepared.payload.data;
    const size = options.chunkSize ?? 200;
    for (let i = 0; i < payload.length; i += size) {
      await t.write(data, wire.wolink.data(i, payload.slice(i, i + size)));
      for (const frame of t.clear()) wire.wolink.check(frame);
      progress(options, 'transfer', Math.min(i + size, payload.length), payload.length);
      if (options.pacingMs) await t.pause(options.pacingMs);
    }
    for (const frame of t.clear()) wire.wolink.check(frame);
    progress(options, 'finish');
    await t.write(data, wire.wolink.refresh(payload.length));
    const timeout = prepared.payload.rawSize > 100000 ? 120000 : prepared.payload.rawSize > 20000 ? 60000 : 30000;
    await t.waitFor(wire.wolink.check, timeout);
    return {};
  }
  const writers = { picksmart, wolink, xte, easytag, etag }, busy = new WeakSet();
  async function upload(device, prepared, options = {}) {
    if (!writers[prepared?.protocol]) throw new Error('Invalid prepared upload');
    if (busy.has(device)) throw new Error('An upload is already running for this device');
    if (!device?.gatt) throw new Error('A Web Bluetooth device with GATT is required');
    for (const name of ['pacingMs', 'chunkGapMs']) if (options[name] !== undefined && (!Number.isFinite(options[name]) || options[name] < 0)) throw new Error(`Invalid ${name}`);
    if (options.chunkSize !== undefined && ['xte', 'wolink'].includes(prepared.protocol)) {
      const [min, max] = prepared.protocol === 'xte' ? [20, 244] : [1, 506];
      if (!Number.isInteger(options.chunkSize) || options.chunkSize < min || options.chunkSize > max) {
        throw new Error(`${prepared.protocol} chunkSize must be ${min}..${max}`);
      }
    }
    if (options.replyTimeoutMs !== undefined && (!Number.isFinite(options.replyTimeoutMs) || options.replyTimeoutMs <= 0 || options.replyTimeoutMs > 120000)) throw new Error('Invalid replyTimeoutMs');
    busy.add(device);
    const transport = new bt.Transport(device, options);
    try {
      progress(options, 'connect'); await transport.connect(); progress(options, 'handshake');
      const result = await writers[prepared.protocol](transport, prepared, options);
      progress(options, 'complete', 1, 1);
      return { success: true, protocol: prepared.protocol, modelKey: prepared.preset.key, ...result };
    } finally { try { await transport.close(); } finally { busy.delete(device); } }
  }
  api.listModels = protocol => copy(api.models[protocol] || []);
  api.getPreset = presetFor;
  api.prepare = prepare;
  api.upload = upload;
  api.requestDevice = (protocol, options = {}) => {
    const bluetooth = options.bluetooth || global.navigator?.bluetooth;
    if (!bluetooth?.requestDevice) throw new Error('Web Bluetooth is unavailable; use a supported browser over HTTPS or localhost');
    return bluetooth.requestDevice(bt.requestOptions(protocol, options));
  };
})(typeof window !== 'undefined' ? window : globalThis);
