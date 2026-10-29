const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
require('../../gicisky/compress2.js');
for (const name of ['models', 'image', 'wire', 'bluetooth', 'core']) require(`../${name}.js`);
const { bluetooth: bt, wire } = BleEsl;
function picture(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w*h*4).fill(255) }; }
class Characteristic extends EventTarget {
  constructor(uuid, onWrite = () => {}, read = new Uint8Array()) { super(); this.uuid = uuid; this.onWrite = onWrite; this.read = read; this.stopped = false; }
  async writeValueWithResponse(data) { this.onWrite(data); }
  async writeValueWithoutResponse(data) { this.onWrite(data); }
  async startNotifications() { return this; }
  async stopNotifications() { this.stopped = true; }
  async readValue() { return new DataView(this.read.buffer); }
  emit(data) { this.value = new DataView(data.buffer, data.byteOffset, data.byteLength); this.dispatchEvent(new Event('characteristicvaluechanged')); }
}
function deviceWith(chars) {
  const device = new EventTarget();
  device.gatt = { connected: false, async connect() { this.connected = true; return this; }, disconnect() { this.connected = false; },
    async getPrimaryService() { return { async getCharacteristics() { return Object.values(chars); }, async getCharacteristic(id) { assert.ok(chars[id], `Missing ${id}`); return chars[id]; } }; } };
  return device;
}
const load = async (protocol, key, options = {}) => {
  const p = BleEsl.getPreset(protocol, key);
  return BleEsl.prepare(protocol, key, picture(p.width, p.height), options);
};
// Remove pacing only for the mocked sessions.
bt.Transport.prototype.pause = async function () { this.check(); };

test('catalog isolation, image validation and transparent white compositing', async () => {
  const models = BleEsl.listModels('wolink'); models[0].extra.rotation = 13;
  assert.equal(BleEsl.listModels('wolink')[0].extra.rotation, 270);
  await assert.rejects(BleEsl.prepare('xte', 'psj-420', picture(1, 1)), /400x300/);
  assert.deepEqual([...BleEsl.image.scan({ width: 1, height: 1, data: Uint8ClampedArray.of(0,0,0,0) }).data], [255,255,255,255]);
});
test('advertisements: DataView offsets, models, firmware override, malformed and unsupported XTE', async () => {
  const record = Uint8Array.of(99, 0x2b, 30, 0x81, 1, 1, 99);
  const ad = bt.parseAdvertisement({ manufacturerData: new Map([[0x5053, new DataView(record.buffer, 1, 5)]]) });
  assert.equal(ad.batteryMv, 3000); assert.equal(ad.modelKey, '0x012B');
  assert.equal(BleEsl.getPreset('picksmart', '0x004B', ad).extra.encoding, 'lines');
  assert.equal(ad.manufacturerData.get(0x5053).length, 5);
  const xte = bt.parseAdvertisement({ manufacturerData: new Map([[0x5258, Uint8Array.of(0xfd,1,0x12,3,0,153,80,0x21)]]) });
  assert.equal(xte.modelKey, 'psj-420'); assert.equal(xte.batteryPercent, 80);
  assert.equal(bt.parseAdvertisement({ manufacturerData: new Map([[0x5258, Uint8Array.of(255,1)]]) }).protocol, null);
  await assert.rejects(load('xte', 'psj-420', { advertisement: { protocol: 'xte', raw: { device_number: 97 } } }), /Unsupported XTE/);
  assert.equal(bt.parseAdvertisement({ name: 'ETAG-123' }).batteryPercent, null);
});
test('chooser requests manufacturer permission and device info service', () => {
  const options = bt.requestOptions();
  assert.deepEqual(options.optionalManufacturerData, [0x5053,0xbbaa,0x5258]);
  assert.ok(options.optionalServices.includes('0000180a-0000-1000-8000-00805f9b34fb'));
  assert.equal(bt.requestOptions('xte', { acceptAllDevices: true }).filters, undefined);
});
test('advertisement watcher receives, stops and cleans up on errors', async () => {
  const device = new EventTarget(); let signal, calls = 0;
  device.watchAdvertisements = async opts => { signal = opts.signal; };
  const stop = await bt.watchAdvertisements(device, () => calls++);
  device.dispatchEvent(new Event('advertisementreceived')); assert.equal(calls, 1);
  stop(); assert.equal(signal.aborted, true);
  device.dispatchEvent(new Event('advertisementreceived')); assert.equal(calls, 1);
  device.watchAdvertisements = async () => { throw new Error('denied'); };
  await assert.rejects(bt.watchAdvertisements(device, () => calls++), /denied/);
  device.dispatchEvent(new Event('advertisementreceived')); assert.equal(calls, 1);
  await assert.rejects(bt.watchAdvertisements({}, () => {}), /unavailable/);
});
test('scan stops on abort including abort during permission prompt', async () => {
  const bluetooth = new EventTarget(), controller = new AbortController(); let stopped = false;
  bluetooth.requestLEScan = async () => { controller.abort(); return { stop() { stopped = true; } }; };
  await assert.rejects(bt.scanAdvertisements(() => {}, { bluetooth, signal: controller.signal }), { name: 'AbortError' });
  assert.equal(stopped, true);
});
test('WOLINK AES unlock matches native ECB and compression inflates per block', async () => {
  const nonce = new Uint8Array(16).map((_, i) => i);
  const cipher = crypto.createCipheriv('aes-128-ecb', Buffer.from('9b609f28bc49e25729bd7b8df22b4420','hex'), null); cipher.setAutoPadding(false);
  assert.deepEqual(Buffer.from(await wire.wolink.unlock(nonce)), Buffer.concat([cipher.update(nonce), cipher.final()]));
  const raw = new Uint8Array(19000).map((_, i) => i % 251);
  const packed = await wire.wolink.compress(raw);
  let pos = 4, blocks = [];
  for (let i = 1; i <= packed[2]; i++) { assert.equal(packed[pos++], i); const size = packed[pos] | packed[pos+1] << 8; pos += 2; blocks.push(zlib.inflateRawSync(packed.slice(pos, pos+size))); pos += size; }
  assert.deepEqual(Buffer.concat(blocks), Buffer.from(raw));
});
test('PickSmart full session follows requests, resends and waits for completion', async () => {
  const prepared = await load('picksmart', '0x0033'); let resent = false, frames = 0;
  const command = new Characteristic('0000fef1-0000-1000-8000-00805f9b34fb', data => {
    command.emit(data[0] === 1 ? wire.hex('01f400') : data[0] === 2 ? one(2) : wire.hex('050000000000'));
  });
  const image = new Characteristic('0000fef2-0000-1000-8000-00805f9b34fb', data => {
    frames++; const part = new DataView(data.buffer, data.byteOffset).getUint32(0, true);
    if (!resent) { resent = true; command.emit(wire.hex('050000000000')); }
    else command.emit((part+1)*240 >= prepared.payload.length ? wire.hex('0508') : BleEsl.concat(wire.hex('0500'), wire.u32(part+1,true)));
  });
  const device = deviceWith({ command, image });
  const result = await BleEsl.upload(device, prepared);
  assert.equal(result.success, true); assert.equal(frames, Math.ceil(prepared.payload.length/240)+1);
  assert.equal(command.stopped, true); assert.equal(device.gatt.connected, false);
});
const one = n => Uint8Array.of(n);
test('PickSmart rejects premature done and always disconnects', async () => {
  const prepared = await load('picksmart', '0x0033');
  const command = new Characteristic('0000fef1-0000-1000-8000-00805f9b34fb', d => command.emit(d[0]===1 ? wire.hex('01f400') : d[0]===2 ? one(2) : wire.hex('050000000000')));
  const image = new Characteristic('0000fef2-0000-1000-8000-00805f9b34fb', () => command.emit(wire.hex('0508')));
  const device = deviceWith({command,image});
  await assert.rejects(BleEsl.upload(device,prepared), /premature/); assert.equal(device.gatt.connected,false);
});
test('XTE session uses safe chunks and checks final ACK', async () => {
  const prepared = await load('xte','psj-420'); let commands = 0, writes = 0;
  const notifyId = '00002760-08c2-11e1-9073-0e8ac72e0002', writeId = '00002760-08c2-11e1-9073-0e8ac72e0001';
  const notify = new Characteristic(notifyId);
  const write = new Characteristic(writeId, d => {
    writes++; assert.ok(d.length <= 20);
    if (d[0]===88 && d[3]===1) { commands++; const reply = wire.xte.command(wire.hex(commands===1 ? '01ffbd' : '04ff')); reply[3]=4; notify.emit(reply); }
  });
  assert.equal((await BleEsl.upload(deviceWith({[notifyId]:notify,[writeId]:write}), prepared)).success,true);
  assert.equal(commands,2); assert.ok(writes>2);
});
test('easyTag requires real MAC and decodes session telemetry', async () => {
  await assert.rejects(load('easytag','33'), /real MAC/);
  const prepared = await load('easytag','33',{mac:'AA:BB:CC:DD:EE:FF'}); let writes=0;
  const notifyId='00001526-1212-efde-1523-785feabcd123', writeId='00001525-1212-efde-1523-785feabcd123';
  const notify = new Characteristic(notifyId), write = new Characteristic(writeId, () => { if (++writes===prepared.payload.length) notify.emit(Uint8Array.of(1,1,1,1)); });
  const result=await BleEsl.upload(deviceWith({[notifyId]:notify,[writeId]:write}),prepared);
  assert.equal(result.success,true); assert.equal(typeof result.batteryMv,'number');
});
test('ETAG firmware selects planes, all commands acknowledged', async () => {
  const prepared = await load('etag','etag213'); let writes=0;
  const firmwareId='00002a26-0000-1000-8000-00805f9b34fb', charId='0000ffe1-0000-1000-8000-00805f9b34fb';
  const char=new Characteristic(charId, packet => {
    writes++; const cmd=packet[1], replyCmd={5:6,17:18,7:8,1:2,3:4}[cmd];
    char.emit(cmd===1 ? Uint8Array.of(0x91,replyCmd,packet[4],packet[3],0,0x19) : Uint8Array.of(0x91,replyCmd,0,0x19));
  });
  const firmware=new Characteristic(firmwareId,undefined,new TextEncoder().encode('SE0213NP61-TNG-A0'));
  const result=await BleEsl.upload(deviceWith({[charId]:char,[firmwareId]:firmware}),prepared);
  assert.equal(result.firmware,'SE0213NP61-TNG-A0'); assert.equal(writes,prepared.payload[result.firmware].length+4);
});
test('WOLINK session unlocks before notifications, writes then refreshes', async () => {
  const prepared=await load('wolink','154'); let unlocked=false, count=0;
  const authId='33323032-4c53-4545-4c42-4b4e494c4f57', dataId='31323032-4c53-4545-4c42-4b4e494c4f57', statusId='34323032-4c53-4545-4c42-4b4e494c4f57';
  const auth=new Characteristic(authId,()=>{unlocked=true;},new Uint8Array(16));
  const status=new Characteristic(statusId); status.startNotifications=async()=>{assert.equal(unlocked,true);return status;};
  const data=new Characteristic(dataId,d=>{count++; if(d[0]===2) status.emit(Uint8Array.of(255,0));});
  assert.equal((await BleEsl.upload(deviceWith({[authId]:auth,[dataId]:data,[statusId]:status}),prepared)).success,true); assert.ok(count>=2);
});
test('transport handles abort, disconnect, timeout, and notification copy', async () => {
  const device=deviceWith({}), controller=new AbortController(), t=new bt.Transport(device,{signal:controller.signal});
  const pending=t.next(1000); controller.abort(); await assert.rejects(pending,{name:'AbortError'}); await t.close();
  const t2=new bt.Transport(device); const p=t2.next(1000); device.dispatchEvent(new Event('gattserverdisconnected')); await assert.rejects(p,/disconnected/); await t2.close();
  const t3=new bt.Transport(device); await assert.rejects(t3.next(1),bt.TimeoutError); await t3.close();
});
test('WOLINK preserves errors received during final upload pacing', async () => {
  const prepared = await load('wolink', '154');
  const authId='33323032-4c53-4545-4c42-4b4e494c4f57', dataId='31323032-4c53-4545-4c42-4b4e494c4f57', statusId='34323032-4c53-4545-4c42-4b4e494c4f57';
  const auth = new Characteristic(authId, undefined, new Uint8Array(16));
  const status = new Characteristic(statusId);
  let lastPacket = false, refreshed = false;
  const data = new Characteristic(dataId, packet => {
    if (packet[0] === 2) { refreshed = true; status.emit(Uint8Array.of(255, 0)); }
    else {
      const offset = new DataView(packet.buffer, packet.byteOffset).getUint32(2, true);
      lastPacket = offset + packet.length - 6 === prepared.payload.data.length;
    }
  });
  const pause = bt.Transport.prototype.pause;
  bt.Transport.prototype.pause = async function () {
    this.check();
    if (lastPacket) status.emit(Uint8Array.of(1, 2));
  };
  const device = deviceWith({[authId]:auth,[dataId]:data,[statusId]:status});
  try { await assert.rejects(BleEsl.upload(device, prepared, {pacingMs:1}), /WOLINK device error 2/); }
  finally { bt.Transport.prototype.pause = pause; }
  assert.equal(refreshed, false);
  assert.equal(status.stopped, true);
  assert.equal(device.gatt.connected, false);
});
test('transport queues burst notifications while a reader is pending', async () => {
  const device = deviceWith({}), t = new bt.Transport(device), char = new Characteristic('notify');
  try {
    await t.subscribe(char);
    const pending = t.next(1000);
    const backing = Uint8Array.of(99, 1, 99);
    char.emit(backing.subarray(1, 2));
    backing[1] = 9;
    char.emit(Uint8Array.of(2));
    assert.deepEqual([...await pending], [1]);
    assert.deepEqual([...await t.next(10)], [2]);
  } finally { await t.close(); }
});
test('aborted cleanup disconnects without launching another GATT operation', async () => {
  const device = deviceWith({}), controller = new AbortController();
  const t = new bt.Transport(device, { signal: controller.signal }), char = new Characteristic('notify');
  let unsubscribeCalls = 0;
  char.stopNotifications = async () => { unsubscribeCalls++; throw new Error('GATT operation already in progress'); };
  await t.connect(); await t.subscribe(char); controller.abort();
  await t.close();
  assert.equal(unsubscribeCalls, 0);
  assert.equal(device.gatt.connected, false);
  // Even an operation already started by a caller must have its rejection consumed.
  await assert.rejects(t.bounded(Promise.reject(new Error('late GATT failure')), 10, 'late'), { name: 'AbortError' });
  await new Promise(resolve => setImmediate(resolve));
});
