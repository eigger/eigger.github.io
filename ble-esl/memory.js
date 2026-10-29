/** Local preferences, committed only after a confirmed successful upload. No image storage. */
(function (global) {
  'use strict';
  const api=global.BleEsl, KEY='ble-esl:last-success:v1';
  function create(storage) {
    const read=()=>{try{const value=JSON.parse(storage.getItem(KEY)||'null');return value&&typeof value==='object'?value:{models:{}};}catch{return{models:{}};}};
    const valid=(target,key)=>target&&api.label.modelsFor(target.protocol).some(m=>m.key===key);
    const id=target=>`${target.protocol}:${target.label}`;
    function modelFor(target){const key=target?read().models?.[id(target)]:null;return valid(target,key)?key:null;}
    function last(){const previous=read().last,target=api.label.parse(previous?.label);return valid(target,previous?.modelKey)?{target,modelKey:previous.modelKey}:null;}
    function remember(target,modelKey){
      if(!valid(target,modelKey))return false;
      const previous=read(),models={...(previous.models||{})};
      delete models[id(target)];models[id(target)]=modelKey;
      const entries=Object.entries(models).slice(-50);
      try{storage.setItem(KEY,JSON.stringify({last:{label:target.label,modelKey},models:Object.fromEntries(entries)}));return true;}catch{return false;}
    }
    return{modelFor,last,remember};
  }
  let storage;
  try{storage=global.localStorage;}catch{/* unavailable in some private/file contexts */}
  api.memory=create(storage);
  api.createLabelMemory=create;
})(typeof window !== 'undefined' ? window : globalThis);
