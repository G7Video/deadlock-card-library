// Publisher-side only. This renderer never ships in or runs from Premiere.
// Produce a static site locally; deployment is a separate, explicit operation.
const fs=require('node:fs/promises'),path=require('node:path');
const {CardStore}=require('./cards.cjs');
const {validateCatalog,verifyImage}=require('./library-update');
const seed=require('./catalog.json');
const root=__dirname;
async function build({out=path.join(root,'dist/library-site'),snapshot=false,store}={}){
 await fs.mkdir(path.join(out,'assets'),{recursive:true});
 let prior;try{prior=JSON.parse(await fs.readFile(path.join(out,'manifest.json'),'utf8'));validateCatalog(prior);}catch(e){if(e.code!=='ENOENT')throw e;}
 const renderer=store||new CardStore(path.join(root,'dist/publisher-cache'),{strictCatalog:true});
 try{
  let items;
  if(snapshot)items=seed;
  else{
   const catalog=await renderer.refreshCatalog(true);if(catalog.offline||catalog.warning)throw Error('Discovery failed: '+catalog.warning);
   items=[];
   for(const item of catalog.items){
    console.log('Rendering '+item.name);
    const meta=await renderer.prepare(item.itemId,true);if(meta.offline||meta.warning)throw Error('Render failed: '+item.name+' '+meta.warning);
    items.push(meta);
   }
  }
  const manifest={schemaVersion:1,revision:Math.max(Date.now(),(prior?.revision||0)+1),items:items.map(({cached,offline,warning,...item})=>item)};
  validateCatalog(manifest);
  if(prior&&manifest.items.length<prior.items.length*.8)throw Error('Publication unexpectedly lost too many items.');
  for(const item of manifest.items){
   const source=snapshot?path.join(root,'bundled/cards',item.asset):path.join(renderer.root,'assets',item.asset);
   const bytes=await fs.readFile(source);verifyImage(bytes,item);
   const target=path.join(out,'assets',item.asset);await fs.writeFile(target,bytes);verifyImage(await fs.readFile(target),item);
  }
  let totalBytes=0;for(const file of await fs.readdir(path.join(out,'assets')))totalBytes+=(await fs.stat(path.join(out,'assets',file))).size;
  if(totalBytes>350*1024*1024)throw Error('Library storage budget reached. Keep the previous deployment; archive storage needs review.');
  // Never replace a released manifest unless ALL cards are verified. Prior
  // content-addressed files remain available for projects pinned to old cards.
  const temp=path.join(out,'manifest.next.json');await fs.writeFile(temp,JSON.stringify(manifest,null,2));await fs.rename(temp,path.join(out,'manifest.json'));
  await fs.writeFile(path.join(out,'.nojekyll'),'');
  await fs.writeFile(path.join(out,'index.html'),'<!doctype html><meta charset="utf-8"><title>Deadlock Card Studio Library</title><h1>Deadlock Card Studio Library</h1><p>Unofficial normal-mode wiki cards. Enhanced and Street Brawl variants excluded.</p><p>Wiki text: Deadlock Wiki contributors, CC BY-NC-SA 4.0. Game artwork belongs to its respective owners.</p><a href="manifest.json">Verified card manifest</a>');
  console.log(JSON.stringify({items:items.length,revision:manifest.revision,output:out,snapshot}));return manifest;
 }finally{await renderer.close();}
}
if(require.main===module){const i=process.argv.indexOf('--out');build({snapshot:process.argv.includes('--snapshot'),...(i>=0?{out:path.resolve(process.argv[i+1])}:{})}).catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={build};
