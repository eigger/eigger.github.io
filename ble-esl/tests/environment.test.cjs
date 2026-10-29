const {test}=require('node:test');const assert=require('node:assert/strict');require('../environment.js');
const inspect=BleEsl.environment.inspect;
const nav=(ua,brands)=>({userAgent:ua,userAgentData:brands?{brands}:undefined,bluetooth:{requestDevice(){}}});
test('insecure context and missing Web Bluetooth block uploads with specific guidance',()=>{
 assert.equal(inspect({navigator:nav('Chrome'),isSecureContext:false}).reason,'insecure');
 const missing=inspect({navigator:{userAgent:'Chrome'},isSecureContext:true});
 assert.equal(missing.canUpload,false);assert.equal(missing.reason,'unsupported');
});
test('Chrome detection does not override actual API or adapter availability',()=>{
 assert.equal(inspect({navigator:nav('Chrome/130'),isSecureContext:true}).message,'');
 const unavailable=inspect({navigator:nav('Chrome'),isSecureContext:true,availability:false});
 assert.equal(unavailable.canUpload,false);assert.equal(unavailable.reason,'unavailable');
});
test('other browsers with Bluetooth receive advice but can still upload',()=>{
 for(const userAgent of ['Chrome/130 Edg/130','Chrome/130 OPR/100','Chrome/130 SamsungBrowser/25','Safari']){
  const support=inspect({navigator:nav(userAgent),isSecureContext:true});
  assert.equal(support.canUpload,true);assert.equal(support.reason,'recommended');
 }
 assert.equal(inspect({navigator:nav('',[{brand:'Google Chrome'}]),isSecureContext:true}).reason,'supported');
});
