/** Web Bluetooth transport and optional advertisement observation. */
(function (global) {
  'use strict';
  const api = global.BleEsl;
  const uuid = n => `0000${n}-0000-1000-8000-00805f9b34fb`;
  const services = {
    picksmart: ['fef0', 'fdf0', 'fcf0'].map(uuid),
    wolink: ['30323032-4c53-4545-4c42-4b4e494c4f57'],
    xte: ['00002760-08c2-11e1-9073-0e8ac72e1001'],
    easytag: ['00001523-1212-efde-1523-785feabcd123'],
    etag: [uuid('ffe0'), uuid('180a')],
  };
  const manufacturers = { picksmart: 0x5053, wolink: 0xbbaa, xte: 0x5258 };
  const filters = {
    picksmart: [{ manufacturerData: [{ companyIdentifier: 0x5053 }] }],
    wolink: [{ manufacturerData: [{ companyIdentifier: 0xbbaa }] }],
    xte: [{ manufacturerData: [{ companyIdentifier: 0x5258 }] }],
    easytag: [{ namePrefix: 'easyTag' }], etag: [{ namePrefix: 'ETAG-' }],
  };
  function supportedProtocol(protocol) {
    if (!services[protocol]) throw new Error(`Unknown protocol: ${protocol}`);
  }
  function requestOptions(protocol, { acceptAllDevices = false } = {}) {
    if (protocol) supportedProtocol(protocol);
    return {
      ...(acceptAllDevices ? { acceptAllDevices: true } : { filters: protocol ? filters[protocol] : Object.values(filters).flat() }),
      optionalServices: protocol ? services[protocol] : Object.values(services).flat(),
      optionalManufacturerData: protocol ? (manufacturers[protocol] ? [manufacturers[protocol]] : []) : Object.values(manufacturers),
    };
  }
  function capabilities(device, bluetooth = global.navigator?.bluetooth) {
    return { secureContext: global.isSecureContext === true, bluetooth: !!bluetooth,
      requestDevice: typeof bluetooth?.requestDevice === 'function',
      watchAdvertisements: typeof device?.watchAdvertisements === 'function',
      requestLEScan: typeof bluetooth?.requestLEScan === 'function',
      getDevices: typeof bluetooth?.getDevices === 'function' };
  }
  function bytes(value) {
    if (value instanceof ArrayBuffer) return new Uint8Array(value).slice();
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice();
  }
  function parseAdvertisement(event) {
    const records = new Map();
    event.manufacturerData?.forEach((value, key) => records.set(key, bytes(value)));
    const serviceData = new Map();
    event.serviceData?.forEach((value, key) => serviceData.set(key, bytes(value)));
    const name = event.name ?? event.device?.name ?? '';
    const result = { device: event.device, name, rssi: event.rssi, txPower: event.txPower,
      uuids: Array.from(event.uuids || []), manufacturerData: records, serviceData,
      protocol: null, modelKey: null, batteryMv: null, batteryPercent: null, raw: {} };
    const p = records.get(0x5053), w = records.get(0xbbaa), x = records.get(0x5258);
    if (p?.length === 5) {
      const hardware = p[4] << 8 | p[0], deviceId = hardware & 0x3fff, firmware = p[2] << 8 | p[3];
      const key = '0x' + deviceId.toString(16).toUpperCase().padStart(4, '0');
      Object.assign(result, { protocol: 'picksmart', modelKey: api.models.picksmart.some(m => m.key === key) ? key : null,
        batteryMv: p[1] * 100, raw: { device_id: deviceId, firmware, hardware } });
    } else if (w?.length >= 10) {
      const view = new DataView(w.buffer), fields = ['product_id', 'app_version', 'hardware_version', 'display_version', 'battery_mv'];
      fields.forEach((key, i) => { result.raw[key] = view.getUint16(i * 2); });
      Object.assign(result, { protocol: 'wolink', batteryMv: result.raw.battery_mv,
        modelKey: api.models.wolink.find(m => m.extra.display_version === result.raw.display_version)?.key ?? null });
    } else if (x?.length >= 8 && [0xfd, 0xfe, 0xfc, 4].includes(x[0])) {
      const number = x[4] << 8 | x[5];
      Object.assign(result, { protocol: 'xte', batteryPercent: Math.min(100, x[6]),
        modelKey: api.models.xte.find(m => m.extra.device_number === number)?.key ?? null,
        raw: { device_number: number, hardware_revision: x[1], firmware: `${x[2] >> 4}.${x[2] & 15}.${x[3]}`, record_type: x[0], chip_type: x[7] >> 4, tx_power: x[7] & 15 } });
    } else if (name.startsWith('easyTag')) result.protocol = 'easytag';
    else if (name.startsWith('ETAG-')) Object.assign(result, { protocol: 'etag', modelKey: 'etag213' });
    return result;
  }
  async function watchAdvertisements(device, onAdvertisement, { signal } = {}) {
    if (typeof device?.watchAdvertisements !== 'function') throw new Error('watchAdvertisements is unavailable in this browser');
    const controller = new AbortController();
    const listener = event => onAdvertisement(parseAdvertisement(event));
    const stop = () => { controller.abort(); device.removeEventListener('advertisementreceived', listener); signal?.removeEventListener('abort', stop); };
    if (signal?.aborted) { stop(); throw new DOMException('Aborted', 'AbortError'); }
    signal?.addEventListener('abort', stop, { once: true });
    device.addEventListener('advertisementreceived', listener);
    try { await device.watchAdvertisements({ signal: controller.signal }); }
    catch (error) { stop(); throw error; }
    return stop;
  }
  async function scanAdvertisements(onAdvertisement, { protocol, signal, bluetooth = global.navigator?.bluetooth } = {}) {
    if (!bluetooth?.requestLEScan) throw new Error('requestLEScan is unavailable in this browser');
    if (protocol) supportedProtocol(protocol);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    // Scanning filters also grant access to the selected manufacturer records.
    const options = { filters: protocol ? filters[protocol] : Object.values(filters).flat(), keepRepeatedDevices: true };
    let scan;
    const listener = event => onAdvertisement(parseAdvertisement(event));
    const stop = () => { scan?.stop(); bluetooth.removeEventListener('advertisementreceived', listener); signal?.removeEventListener('abort', stop); };
    bluetooth.addEventListener('advertisementreceived', listener);
    signal?.addEventListener('abort', stop, { once: true });
    try { scan = await bluetooth.requestLEScan(options); if (signal?.aborted) { stop(); throw new DOMException('Aborted', 'AbortError'); } }
    catch (error) { stop(); throw error; }
    return stop;
  }
  class TimeoutError extends Error {}
  class Transport {
    constructor(device, { signal, writeTimeoutMs = 10000, onTrace } = {}) {
      this.device = device; this.signal = signal; this.writeTimeoutMs = writeTimeoutMs;
      this.queue = []; this.waiter = null; this.failure = null; this.writes = 0;
      this.trace = event => onTrace?.({ component: 'gatt', ...event });
      this.dropped = () => this.fail(new Error('Bluetooth device disconnected'));
      this.aborted = () => this.fail(new DOMException('Aborted', 'AbortError'));
      device.addEventListener('gattserverdisconnected', this.dropped);
      signal?.addEventListener('abort', this.aborted, { once: true });
    }
    check() { if (this.signal?.aborted) throw new DOMException('Aborted', 'AbortError'); if (this.failure) throw this.failure; }
    fail(error) { this.trace({ event: 'failure', error: error.message, writes: this.writes }); this.failure = error; this.waiter?.reject(error); }
    async bounded(promise, ms, label) {
      const operation = Promise.resolve(promise);
      try { this.check(); }
      catch (error) { operation.catch(() => {}); throw error; }
      let timer, abort, dropped;
      const fail = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(`Timed out: ${label}`)), ms);
        abort = () => reject(new DOMException('Aborted', 'AbortError'));
        this.signal?.addEventListener('abort', abort, { once: true });
        dropped = () => reject(new Error('Bluetooth device disconnected'));
        this.device.addEventListener('gattserverdisconnected', dropped, { once: true });
      });
      try { return await Promise.race([operation, fail]); }
      finally { clearTimeout(timer); this.signal?.removeEventListener('abort', abort); this.device.removeEventListener('gattserverdisconnected', dropped); }
    }
    async connect() { this.check(); this.server = await this.bounded(this.device.gatt.connect(), 15000, 'connect'); this.trace({ event: 'connected' }); return this; }
    async characteristic(service, characteristic) {
      this.check();
      const svc = await this.bounded(this.server.getPrimaryService(service), this.writeTimeoutMs, 'service discovery');
      const char = await this.bounded(svc.getCharacteristic(characteristic), this.writeTimeoutMs, 'characteristic discovery');
      this.trace({ event: 'characteristic', service, uuid: char.uuid, write: char.properties?.write, writeWithoutResponse: char.properties?.writeWithoutResponse, notify: char.properties?.notify });
      return char;
    }
    async read(char) { this.check(); return bytes(await this.bounded(char.readValue(), this.writeTimeoutMs, 'read')); }
    async write(char, data, response = true) {
      this.check();
      const method = response ? 'writeValueWithResponse' : 'writeValueWithoutResponse';
      if (typeof char[method] !== 'function') throw new Error(`Characteristic cannot ${method}`);
      // A stalled ATT write is fatal. Never treat it as a retryable reply timeout.
      const number = ++this.writes;
      try { await this.bounded(char[method](data), this.writeTimeoutMs, 'GATT write'); }
      catch (error) { this.trace({ event: 'write-error', uuid: char.uuid, number, bytes: data.length, response, error: error.message }); this.fail(error); throw error; }
    }
    async subscribe(char) {
      this.check();
      this.notify = char;
      this.listener = event => {
        const data = bytes(event.target.value);
        if (this.waiter) {
          const waiter = this.waiter;
          this.waiter = null;
          waiter.resolve(data);
        } else this.queue.push(data);
      };
      char.addEventListener('characteristicvaluechanged', this.listener);
      await this.bounded(char.startNotifications(), this.writeTimeoutMs, 'subscribe');
      this.trace({ event: 'subscribed', uuid: char.uuid });
    }
    clear() { const old = this.queue; this.queue = []; return old; }
    async next(ms = 10000) {
      this.check();
      if (this.queue.length) return this.queue.shift();
      try {
        return await this.bounded(new Promise((resolve, reject) => { this.waiter = { resolve, reject }; }), ms, 'notification');
      } finally { this.waiter = null; }
    }
    async waitFor(check, ms) {
      const deadline = Date.now() + ms;
      while (true) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new TimeoutError('Timed out: matching notification');
        const frame = await this.next(remaining);
        if (check(frame)) return frame;
      }
    }
    async request(char, data, ms = 10000, response = false) {
      const hex = frame => Array.from(frame.slice(0, 64), b => b.toString(16).padStart(2, '0')).join('');
      this.trace({ event: 'request', uuid: char.uuid, bytes: data.length, timeoutMs: ms, ...(char === this.notify && data.length <= 16 ? { hex: hex(data) } : {}) });
      this.clear(); await this.write(char, data, response);
      const reply = await this.next(ms);
      this.trace({ event: 'reply', uuid: char.uuid, bytes: reply.length, hex: hex(reply) });
      return reply;
    }
    async pause(ms) { await this.bounded(new Promise(resolve => setTimeout(resolve, ms)), ms + 1000, 'pacing'); this.check(); }
    async close() {
      this.device.removeEventListener('gattserverdisconnected', this.dropped);
      this.signal?.removeEventListener('abort', this.aborted);
      if (this.notify) {
        this.notify.removeEventListener('characteristicvaluechanged', this.listener);
        if (this.device.gatt.connected && !this.failure && !this.signal?.aborted) {
          try { await this.bounded(this.notify.stopNotifications(), 1000, 'unsubscribe'); } catch { /* disconnect also removes subscription */ }
        }
      }
      this.device.gatt.disconnect();
      this.trace({ event: 'closed', writes: this.writes });
    }
  }
  api.bluetooth = { services, manufacturers, requestOptions, capabilities, parseAdvertisement, watchAdvertisements, scanAdvertisements, Transport, TimeoutError, bytes };
})(typeof window !== 'undefined' ? window : globalThis);
