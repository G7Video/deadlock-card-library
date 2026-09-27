// Host-independent update transaction. No Premiere API calls, process launch,
// mutable media paths, or execution of downloaded code.
const {sha256}=require('@noble/hashes/sha256');
const {bytesToHex}=require('@noble/hashes/utils');
const DAY=86400000;
function validateCatalog(value){
 if(!value||value.schemaVersion!==1||!Number.isSafeInteger(value.revision)||value.revision<1||!Array.isArray(value.items)||value.items.length<50||value.items.length>1000)throw Error('Invalid library manifest.');
 const ids=new Set();
 for(const item of value.items){
  if(!Number.isInteger(item.itemId)||item.itemId<1||item.itemId>4294967295||ids.has(item.itemId))throw Error('Invalid or duplicate item ID.');
  ids.add(item.itemId);
  if(typeof item.name!=='string'||!item.name.trim()||item.name.length>160||item.mode!=='normal'||item.variant!=='default'||/enhanced|street.?brawl/i.test(item.name))throw Error('Unsupported item variant.');
  if(!/^[a-f0-9]{64}\.png$/.test(item.asset)||![item.width,item.height].every(n=>Number.isInteger(n)&&n>=100&&n<=4096))throw Error('Invalid card asset.');
  if(typeof item.source!=='string'||!/^https:\/\/deadlock\.wiki\/[^\s]+$/.test(item.source))throw Error('Invalid card source.');
 }
 return value;
}
function verifyImage(bytes,item){
 const b=new Uint8Array(bytes);
 if(b.length<24||b.length>12000000||bytesToHex(sha256(b))+'.png'!==item.asset)throw Error('Card checksum failed: '+item.name);
 const sig=[137,80,78,71,13,10,26,10];if(!sig.every((v,i)=>b[i]===v))throw Error('Card is not PNG: '+item.name);
 const view=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(view.getUint32(16)!==item.width||view.getUint32(20)!==item.height)throw Error('Card dimensions failed: '+item.name);
 // Decode as well as checking header/hash so corrupt pixel streams cannot
 // become active media. Only supported 8-bit static wiki screenshots qualify.
 const png=require('fast-png').decode(b,{checkCrc:true});
 if(png.depth!==8||![3,4].includes(png.channels))throw Error('Unsupported PNG encoding: '+item.name);
 return b;
}
function merge(previous,next){
 const active=new Map(next.map(i=>[i.itemId,{...i,retired:false}]));
 for(const i of previous)if(!active.has(i.itemId))active.set(i.itemId,{...i,retired:true});
 return [...active.values()];
}
function createUpdater({seed,io,fetchManifest,fetchAsset,now=Date.now,yieldControl=()=>Promise.resolve()}){
 let pending;
 async function perform(force){
  const old=await io.readState()||{revision:0,items:seed,checkedAt:0};
  if(!force&&old.checkedAt&&now()-old.checkedAt<DAY)return {...old,skipped:true};
  const next=validateCatalog(await fetchManifest());
  if(next.revision<old.revision)throw Error('Library update is older than the installed version.');
  if(next.items.length<seed.length*.8)throw Error('Library unexpectedly lost too many items.');
  const previous=new Map(old.items.map(i=>[i.itemId,i]));
  const changed=next.items.filter(i=>previous.get(i.itemId)?.asset!==i.asset||previous.get(i.itemId)?.name!==i.name||previous.get(i.itemId)?.retired);
  if(next.revision===old.revision&&changed.length)throw Error('Library revision was reused for different content.');
  // All downloads must verify and survive a readback before committing the
  // index. Failed staging can leave harmless orphan hashes, never lost media.
  for(const item of next.items){
   let bytes;try{bytes=await io.readAsset(item.asset);verifyImage(bytes,item);}catch{bytes=null;}
   if(!bytes){bytes=verifyImage(await fetchAsset(item.asset),item);await io.writeAsset(item.asset,bytes);verifyImage(await io.readAsset(item.asset),item);}
   await yieldControl();
  }
  const result={schemaVersion:1,revision:next.revision,checkedAt:now(),items:merge(old.items,next.items),changed:changed.map(i=>({itemId:i.itemId,name:i.name}))};
  await io.commitState(result);return result;
 }
 return {check(force=false){if(!pending)pending=perform(force).finally(()=>{pending=null;});return pending;}};
}
module.exports={validateCatalog,verifyImage,merge,createUpdater,DAY};
