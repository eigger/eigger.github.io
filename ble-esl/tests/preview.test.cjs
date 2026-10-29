const {test}=require('node:test');const assert=require('node:assert/strict');
require('../preview.js');
function image(pixel,w=16,h=8){const data=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++)data.set([...pixel,255],i*4);return{data,width:w,height:h};}
function count(out,color){let n=0;for(let i=0;i<out.data.length;i+=4)if(color.every((v,c)=>out.data[i+c]===v))n++;return n;}
test('supported palette colors survive conversion and BWR never emits yellow',()=>{
 for(const mode of ['off','floyd'])for(const colors of ['BWR','BWRY']){
  const allowed=[[0,0,0],[255,255,255],[255,0,0],...(colors==='BWRY'?[[255,255,0]]:[])];
  for(const p of allowed)assert.equal(count(BleEsl.preview.quantize(image(p),{colors,mode}),p),128);
  assert.equal(count(BleEsl.preview.quantize(image([255,255,0]),{colors:'BWR',mode}),[255,255,0]),0);
 }
});
test('each color amount changes selection in sharp and dither modes',()=>{
 for(const mode of ['off','floyd'])for(const [option,pixel,color] of [['black',[130,130,130],[0,0,0]],['red',[190,90,90],[255,0,0]],['yellow',[200,190,90],[255,255,0]]]){
  const low=BleEsl.preview.quantize(image(pixel),{colors:'BWRY',mode,[option]:0});
  const high=BleEsl.preview.quantize(image(pixel),{colors:'BWRY',mode,[option]:255});
  assert.ok(count(high,color)>count(low,color),`${mode}/${option}`);
 }
});
test('photo mode diffuses tone into palette pixels',()=>{
 const input=image([125,125,125],32,16);
 const sharp=BleEsl.preview.quantize(input),photo=BleEsl.preview.quantize(input,{mode:'floyd'});
 assert.equal(count(sharp,[255,255,255]),0);assert.ok(count(photo,[255,255,255])>0);assert.ok(count(photo,[0,0,0])>0);
});
