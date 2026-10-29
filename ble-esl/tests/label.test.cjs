const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../models.js');require('../image.js');require('../wire.js');require('../bluetooth.js');require('../core.js');require('../label.js');
const {label}=BleEsl;
test('Gicisky keeps the existing screen-number formats and NEMR chooser',()=>{
  for(const input of ['92.95.75.10','92957510','NEMR92957510','FF:FF:92:95:75:10']){
    const target=label.parse(input);
    assert.equal(target.protocol,'picksmart');assert.equal(target.key,'0x004B');
    assert.equal(target.mac,'FF:FF:92:95:75:10');assert.equal(target.name,'NEMR92957510');
    assert.deepEqual(label.requestOptions(target).filters,[{namePrefix:'NEMR92957510'}]);
    assert.equal(BleEsl.models.picksmart.find(p=>p.key===target.key).colors,'BWR');
  }
  assert.equal(label.parse('1.2.a.f').label,'01.02.0A.0F');
});
test('Poshiji searches the printed name and reverses bytes only for the MAC',()=>{
  for(const [input,mac] of [['373917109A4F','4F:9A:10:17:39:37'],['37391810BD4D','4D:BD:10:18:39:37']]){
    const target=label.parse(input.toLowerCase());
    assert.equal(target.protocol,'xte');assert.equal(target.key,'psj-420');assert.equal(target.mac,mac);
    assert.deepEqual(label.requestOptions(target).filters,[{name:input}]);
    assert.equal(BleEsl.models.xte.find(p=>p.key===target.key).colors,'BWRY');
    assert.equal(label.matches(target,{name:input}),true);
    assert.equal(label.matches(target,{name:input+'1'}),false);
  }
});
test('invalid and ambiguous address input is rejected without guessing',()=>{
  for(const input of ['', '373917109A4', '373917109A4FG','92.95.75.100','4F:9A:10:17:39:37','92/95/75/10'])assert.equal(label.parse(input),null,input);
  assert.throws(()=>label.requestOptions(null),/valid label/);
});

test('Poshiji size picker includes named PSJ models only',()=>{
 const models=label.modelsFor('xte');
 assert.deepEqual(models.map(m=>m.key).sort(),['psj-213','psj-266','psj-290','psj-420']);
 assert.ok(models.every(m=>m.display_name.startsWith('PSJ-')&&m.colors==='BWRY'));
 assert.ok(label.modelsFor('picksmart').every(m=>m.colors==='BWR'));
});

test('reported Gicisky label uses the same name filter as the original uploader',()=>{
 const target=label.parse('99.83.02.31');assert.equal(target.name,'NEMR99830231');
 assert.deepEqual(label.requestOptions(target).filters,[{namePrefix:'NEMR99830231'}]);
 assert.deepEqual(BleEsl.bluetooth.requestOptions('picksmart').filters,[{manufacturerData:[{companyIdentifier:0x5053}]}]);
});
