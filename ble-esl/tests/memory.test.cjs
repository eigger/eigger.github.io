const {test}=require('node:test');const assert=require('node:assert/strict');
for(const name of ['models','image','wire','bluetooth','core','label','memory'])require(`../${name}.js`);
function storage(){const values=new Map();return{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};}
test('successful label and size survive a new memory instance and retain per-label sizes',()=>{
 const store=storage(),a=BleEsl.createLabelMemory(store),g=BleEsl.label.parse('99.83.02.31'),p=BleEsl.label.parse('373916107321');
 assert.equal(a.last(),null);assert.equal(a.remember(g,'0x0033'),true);a.remember(p,'psj-213');
 const b=BleEsl.createLabelMemory(store);assert.equal(b.last().target.label,'373916107321');assert.equal(b.last().modelKey,'psj-213');
 assert.equal(b.modelFor(g),'0x0033');assert.equal(b.modelFor(p),'psj-213');
 assert.equal(b.remember(p,'psj-154'),false);assert.equal(b.last().modelKey,'psj-213');
});
test('missing, corrupt or denied local storage cannot prevent editing or upload',()=>{
 for(const store of [undefined,{getItem(){throw Error('denied');},setItem(){throw Error('denied');}},{getItem:()=>'{broken',setItem(){throw Error('quota');}}]){
  const memory=BleEsl.createLabelMemory(store);assert.equal(memory.last(),null);assert.equal(memory.remember(BleEsl.label.parse('99.83.02.31'),'0x004B'),false);
 }
});
