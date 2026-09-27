const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
class CDP {
  constructor(ws){this.ws=ws;this.next=0;this.pending=new Map();this.listeners=new Map();ws.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.id){const p=this.pending.get(m.id);if(p){clearTimeout(p.timer);this.pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}}else for(const f of this.listeners.get(m.method)||[])f(m.params);});ws.addEventListener('close',()=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Card renderer closed.'));}this.pending.clear();});}
  on(name,fn){this.listeners.set(name,[...(this.listeners.get(name)||[]),fn]);}
  send(method,params={}){return new Promise((resolve,reject)=>{const id=++this.next;const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Renderer timed out: '+method));},45000);this.pending.set(id,{resolve,reject,timer});this.ws.send(JSON.stringify({id,method,params}));});}
  static async connect(url){const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',()=>reject(new Error('Could not connect to local renderer.')),{once:true});});return new CDP(ws);}
}
async function launch(){
  const candidates=[process.env['PROGRAMFILES(X86)'],process.env.PROGRAMFILES,process.env.LOCALAPPDATA].filter(Boolean).map(p=>path.join(p,'Microsoft/Edge/Application/msedge.exe'));
  let exe;for(const p of candidates)try{await fs.access(p);exe=p;break;}catch{}
  if(!exe)throw new Error('Microsoft Edge is required by this Windows build. No card pack is needed.');
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'deadlock-card-renderer-'));
  const child=spawn(exe,['--headless=new','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+dir,'--no-first-run','--disable-background-networking','--disable-extensions','--disable-sync','--hide-scrollbars','about:blank'],{windowsHide:true,stdio:'ignore'});
  let launchError;child.on('error',e=>launchError=e);
  let port;for(let i=0;i<100;i++){if(launchError)throw launchError;try{port=Number((await fs.readFile(path.join(dir,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{}await delay(100);}
  if(!port)throw new Error('Could not start the bundled card renderer in Microsoft Edge.');
  const tabs=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const c=await CDP.connect(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await c.send('Page.enable');await c.send('Runtime.enable');
  await c.send('Emulation.setDeviceMetricsOverride',{width:1200,height:2200,deviceScaleFactor:2,mobile:false});
  await c.send('Emulation.setDefaultBackgroundColorOverride',{color:{r:0,g:0,b:0,a:0}});
  c.on('Fetch.requestPaused',p=>{let allowed=false;try{const u=new URL(p.request.url);allowed=u.protocol==='https:'&&u.hostname==='deadlock.wiki'&&!['Script','Media'].includes(p.resourceType);}catch{}c.send(allowed?'Fetch.continueRequest':'Fetch.failRequest',allowed?{requestId:p.requestId}:{requestId:p.requestId,errorReason:'BlockedByClient'}).catch(()=>{});});
  await c.send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
  const evaluate=async expression=>{const r=await c.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||'Wiki extraction failed.');return r.result.value;};
  return {async page(url){if(!/^https:\/\/deadlock\.wiki\/[^?#]+$/.test(url))throw new Error('Invalid wiki source.');const result=await c.send('Page.navigate',{url});if(result.errorText)throw new Error(result.errorText);for(let i=0;i<450;i++){if(await evaluate(`location.href===${JSON.stringify(url)} && document.readyState==='complete'`))return;await delay(100);}const diagnostic=await evaluate(`JSON.stringify({url:location.href,ready:document.readyState,title:document.title,body:document.body?.innerText.slice(0,350)})`);throw new Error('Wiki did not finish loading: '+diagnostic);},evaluate,async screenshot(clip){const r=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,omitBackground:true,clip:{...clip,scale:1}});return Buffer.from(r.data,'base64');},async close(){await c.send('Browser.close').catch(()=>{});c.ws.close();await Promise.race([new Promise(r=>child.once('exit',r)),delay(4000)]);await fs.rm(dir,{recursive:true,force:true}).catch(()=>{});}};
}
module.exports={launch};
