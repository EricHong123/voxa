import {app,BrowserWindow,ipcMain,globalShortcut,clipboard,dialog,systemPreferences,shell,screen,session} from 'electron';
import fs from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {LiveDraft,canStream} from './live-draft.mjs';
import {pressEnterAfterPaste,targetProblem,pasteProblem,verifyPaste,splitEnterCommand} from './delivery.mjs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {createStore,processAudio,transcribeAudio,health,validateSettings} from './core.mjs';
const exec=promisify(execFile),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Preserve the existing profile when changing the display name.
app.setPath('userData',process.env.VOICELEAF_DATA_DIR||path.join(app.getPath('appData'),'Voiceleaf'));
app.setName('Voxa');
const page=pathToFileURL(path.join(root,'dist/index.html')).href;
let main,hud,store,controller,target=null,phase='idle',quitting=false,modelBoot=null;
const children=new Set();
let liveDraft=null,liveAbort=null;
let escapeRegistered=false;
let previewController=null,externalSession=false,holdHud=false,lastHudText='',hudDismissTimer=null;
const cancelPreview=()=>{previewController?.abort();previewController=null;};
const helper=app.isPackaged?path.join(process.resourcesPath,'voiceleaf-bridge'):path.join(root,'native/voiceleaf-bridge');
const send=(message)=>{for(const win of [main,hud])if(win&&!win.isDestroyed())win.webContents.send('voiceleaf:event',message);};
const broadcast=()=>send({type:'data',data:store.read()});
async function native(command,...args){if(process.platform!=='darwin'||!fs.existsSync(helper))throw new Error('macOS 辅助组件尚未编译');const {stdout}=await exec(helper,[command,...args],{timeout:3000});return JSON.parse(stdout);}
function replaceNative({pid,fingerprint,start,length,text}){
 return new Promise((resolve,reject)=>{const child=execFile(helper,['replaceDraft',String(pid),fingerprint,String(start),String(length)],{timeout:3000},(error,stdout)=>{if(error){reject(error);return;}try{resolve(JSON.parse(stdout));}catch(error){reject(error);}});child.stdin.on('error',()=>{});child.stdin.end(text);});
}
function setPhase(next){phase=next;if(next!=='idle'&&!escapeRegistered&&!process.env.VOICELEAF_TEST)escapeRegistered=globalShortcut.register('Escape',()=>cancelSession());if(next==='idle'&&escapeRegistered){globalShortcut.unregister('Escape');escapeRegistered=false;}send({type:'phase',phase});if(next==='idle'&&!holdHud){hud?.hide();}else if(hud&&!hud.isDestroyed()){if(!process.env.VOICELEAF_TEST)hud.showInactive();}}
function protect(win){win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',event=>event.preventDefault());}
function createWindows(){
 main=new BrowserWindow({show:!process.env.VOICELEAF_TEST,width:1180,height:820,minWidth:900,minHeight:680,title:'Voxa',backgroundColor:'#fafafa',titleBarStyle:'hiddenInset',webPreferences:{preload:path.join(root,'electron/preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
 protect(main);main.loadURL(page);main.on('close',e=>{if(!quitting){e.preventDefault();main.hide();}});
 const area=screen.getPrimaryDisplay().workArea;
 hud=new BrowserWindow({width:400,height:76,x:Math.round(area.x+(area.width-400)/2),y:area.y+24,frame:false,transparent:true,resizable:false,focusable:false,skipTaskbar:true,alwaysOnTop:true,show:false,webPreferences:{preload:path.join(root,'electron/preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 hud.setAlwaysOnTop(true,'floating');
 hud.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
 protect(hud);hud.loadURL(page+'#hud');
 main.webContents.on('render-process-gone',()=>{controller?.abort();setPhase('idle');});
}
async function toggle(external=false,captured=null){
 if(phase==='recording'){send({type:'stop'});return;}
 if(phase!=='idle')return;
 if(!external&&store.read().settings.liveInput&&store.read().settings.autoPaste&&store.read().settings.mode==='dictate')return chooseRecordingTarget();
 clearTimeout(hudDismissTimer);externalSession=external;holdHud=false;lastHudText='';send({type:'hud-notice',message:''});
 cancelPreview();send({type:'preview',text:''});send({type:'revision',value:null});
 phase='starting';send({type:'phase',phase});
 const area=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
 hud.setBounds({x:Math.round(area.x+(area.width-400)/2),y:area.y+24,width:400,height:76});
 try{target=external?(captured||await native('context')):null;}catch{target=null;}
 if(phase!=='starting')return;
 liveAbort?.abort();liveAbort=new AbortController();liveDraft=null;
 const settings=store.read().settings;
 if(external&&target?.pid!==process.pid&&settings.liveInput&&settings.autoPaste&&settings.mode==='dictate'&&canStream(target))liveDraft=new LiveDraft(target,{native,replace:replaceNative,signal:liveAbort.signal});
 setPhase('starting');
 if(external){main.hide();const problem=store.read().settings.autoPaste?targetProblem(target):'';send({type:'target',name:target?.name||'',ready:!problem&&!!target?.fingerprint});send({type:'hud-notice',message:problem,permission:target?.status==='permission-denied'});if(!problem&&settings.liveInput&&settings.mode==='dictate')send({type:'hud-notice',message:liveDraft?'实时填入已开启 · 手动改字或移动光标会暂停':'此输入框不支持实时修改，结束后尝试一次填入。'});}
 if(store.read().settings.mode==='edit'&&!target?.selectedText){holdHud=external;setPhase('idle');send({type:external?'hud-notice':'error',message:'请先选中文字并开启辅助功能权限，或在设置中切换到听写模式。'});return;}
 send({type:'start'});
}
function cancelSession(){liveAbort?.abort();liveDraft=null;clearTimeout(hudDismissTimer);holdHud=false;lastHudText='';externalSession=false;cancelPreview();controller?.abort(new Error('已取消'));controller=null;target=null;send({type:'cancel'});setPhase('idle');}
async function chooseRecordingTarget(){
 if(phase!=='idle')return;
 const active=new AbortController();controller=active;externalSession=true;holdHud=true;
 clearTimeout(hudDismissTimer);send({type:'preview',text:''});send({type:'revision',value:null});send({type:'target',name:'',ready:false});main.hide();setPhase('choosing');
 try{
  for(let count=5;count>0;count--){send({type:'hud-notice',message:`请点击要实时填入的文字框 · ${count} 秒后开始聆听`});await delay(1000,undefined,{signal:active.signal});}
  const chosen=await native('context');active.signal.throwIfAborted();
  const problem=targetProblem(chosen);
  if(chosen.pid===process.pid||problem)throw new Error(problem||'请先点击其他 App 或网页的文字输入框。');
  controller=null;phase='idle';await toggle(true,chosen);
 }catch(error){if(!active.signal.aborted){send({type:'hud-notice',message:error.message});setPhase('idle');}throw error;}
 finally{if(controller===active)controller=null;}
}
async function testLiveInsertion(){
 if(phase!=='idle')throw new Error('请先结束当前录音或处理');
 const active=new AbortController();controller=active;externalSession=true;holdHud=true;lastHudText='';
 clearTimeout(hudDismissTimer);send({type:'revision',value:null});send({type:'preview',text:''});send({type:'target',name:'',ready:false});main.hide();setPhase('choosing');
 try{
  for(let count=5;count>0;count--){send({type:'hud-notice',message:`请点击测试输入框 · ${count} 秒后开始实时修改测试`});await delay(1000,undefined,{signal:active.signal});}
  const chosen=await native('context');active.signal.throwIfAborted();
  if(chosen.pid===process.pid||!canStream(chosen))throw new Error(targetProblem(chosen)||'此输入框不支持实时修改，请改用普通文字输入框。');
  const draft=new LiveDraft(chosen,{native,replace:replaceNative,signal:active.signal});
  setPhase('pasting');send({type:'target',name:chosen.name,ready:true});
  for(const text of ['明天','明天九点开会','明天十点开会。']){
   send({type:'preview',text});await draft.update(text);lastHudText=text;
   await delay(1200,undefined,{signal:active.signal});
  }
  send({type:'hud-notice',message:'实时追加和改字已核对成功：九点 → 十点。',status:'inserted',canCopy:true});
 }catch(error){if(!active.signal.aborted)send({type:'hud-notice',message:error.message,status:'retained',canCopy:!!lastHudText});throw error;}
 finally{if(controller===active){controller=null;target=null;setPhase('idle');}}
}
async function insertWithCountdown(text){
 if(phase!=='idle')throw new Error('请先结束当前录音或处理');
 if(!text)throw new Error('没有可填入的文字');
 const active=new AbortController();controller=active;externalSession=true;holdHud=true;lastHudText=text;
 clearTimeout(hudDismissTimer);send({type:'revision',value:null});send({type:'preview',text});send({type:'target',name:'',ready:false});
 const area=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
 hud.setPosition(Math.round(area.x+(area.width-400)/2),area.y+24);
 main.hide();setPhase('choosing');
 try{
  for(let count=5;count>0;count--){send({type:'hud-notice',message:`请点击要填入的输入框 · ${count} 秒后填入`,canCopy:true});await delay(1000,undefined,{signal:active.signal});}
  const chosen=await native('context');active.signal.throwIfAborted();
  const problem=targetProblem(chosen);
  if(chosen.pid===process.pid)throw new Error('请点击其他 App 或网页的文字输入框。');
  if(problem)throw new Error(problem);
  setPhase('pasting');clipboard.writeText(text);
  const pasted=await native('paste',String(chosen.pid),chosen.fingerprint);active.signal.throwIfAborted();
  if(!pasted.ok)throw new Error(pasted.message);
  const verified=await verifyPaste({target:chosen,expectedHash:pasted.expectedDraftHash,native,signal:active.signal});
  active.signal.throwIfAborted();
  send({type:'hud-notice',message:verified?`已填入 ${chosen.name}`:'已发出粘贴操作，请确认输入结果。',status:verified?'inserted':'unverified',canCopy:true});
  return {verified};
 }catch(error){if(!active.signal.aborted)send({type:'hud-notice',message:error.message,status:'retained',canCopy:true});throw error;}
 finally{if(controller===active){controller=null;target=null;setPhase('idle');}}
}
function registerShortcut(value){
 if(process.env.VOICELEAF_TEST)return;
 const previous=store.read().settings.shortcut;
 if(globalShortcut.isRegistered(value))return;
 if(!globalShortcut.register(value,()=>void toggle(true)))throw new Error('快捷键已被占用，请选择另一个组合。');
 if(previous!==value)globalShortcut.unregister(previous);
}
function executable(name){for(const p of ['/opt/homebrew/bin/'+name,'/usr/local/bin/'+name])if(fs.existsSync(p))return p;throw new Error(`没有找到 ${name}。请先安装对应的本地模型运行环境。`);}
async function launchServer(kind,settings){
 const isWhisper=kind==='whisper';
 const model=isWhisper?settings.whisperModelPath:settings.rewriteModelPath;
 if(!model||!fs.existsSync(model))throw new Error(`请选择${isWhisper?'Whisper':'文字整理'}模型文件。`);
 const base=isWhisper?settings.whisperUrl:settings.rewriteUrl;
 const args=isWhisper?['-m',model,'--host','127.0.0.1','--port',new URL(base).port,'-l','auto','-nt']:['-m',model,'--host','127.0.0.1','--port',new URL(base).port,'-c','4096','--log-disable'];
 const child=spawn(executable(isWhisper?'whisper-server':'llama-server'),args,{stdio:['ignore','ignore','pipe']});children.add(child);let failure='',tail='';
 child.stderr.on('data',data=>{tail=(tail+data).slice(-3000);});
 child.on('error',e=>{failure=e.message;children.delete(child);});child.on('exit',code=>{failure=`模型服务退出 (${code})`;children.delete(child);});
 for(let i=0;i<90;i++){
  if(failure)throw new Error(failure+'。请检查模型文件和端口。');
  if(quitting){child.kill();throw new Error('应用正在退出');}
  try{const r=await fetch(base+'/health',{signal:AbortSignal.timeout(1000),redirect:'error'});if(r.ok){const d=await r.json();if(d.status==='ok')return;}}catch{}
  await new Promise(r=>setTimeout(r,500));
 }
 child.kill();throw new Error('模型启动超时，请检查模型文件、内存和端口。');
}
async function startModels(){
 if(modelBoot)return modelBoot;
 modelBoot=(async()=>{const settings=store.read().settings,current=await health(settings);
 const jobs=[];if(!current.whisper)jobs.push(launchServer('whisper',settings));
 if(!current.rewrite&&settings.rewriteEngine==='llama'&&(settings.polish||settings.mode!=='dictate'))jobs.push(launchServer('rewrite',settings));
 const results=await Promise.allSettled(jobs);const errors=results.filter(x=>x.status==='rejected');
 if(errors.length)throw new Error(errors.map(x=>x.reason.message).join('\n'));
 return health(settings);
 })();try{return await modelBoot;}finally{modelBoot=null;}
}
function bind(name,fn,hudAllowed=false){ipcMain.handle('voiceleaf:'+name,async(event,...args)=>{
 const isMain=event.sender===main?.webContents,isHud=event.sender===hud?.webContents;
 if((!isMain&&!(hudAllowed&&isHud))||event.senderFrame!==event.sender.mainFrame||!event.senderFrame.url.startsWith(page))throw new Error('不受信任的调用来源');
 try{return {ok:true,value:await fn(...args)};}catch(error){return {ok:false,error:error.message||'操作失败'};}
});}
app.whenReady().then(async()=>{
try{store=createStore(app.getPath('userData'));}catch(error){dialog.showErrorBox('无法读取本地数据',error.message);app.quit();}
if(store){
 const modelDir=app.isPackaged?path.join(process.resourcesPath,'models'):path.join(root,'models');
 const defaults={};for(const [key,file] of [['whisperModelPath','ggml-large-v3-turbo-q5_0.bin'],['rewriteModelPath','qwen2.5-1.5b-instruct-q4_k_m.gguf']])if(!store.read().settings[key]&&fs.existsSync(path.join(modelDir,file)))defaults[key]=path.join(modelDir,file);
 if(app.isPackaged){
  const previousModels=modelDir.replace('/Voxa.app/','/Voiceleaf.app/');
  for(const key of ['whisperModelPath','rewriteModelPath']){
   const saved=store.read().settings[key];
   if(saved&&path.dirname(saved)===previousModels&&previousModels!==modelDir){
    const replacement=path.join(modelDir,path.basename(saved));
    if(fs.existsSync(replacement))defaults[key]=replacement;
   }
  }
 }
 if(Object.keys(defaults).length)store.settings(defaults);
 session.defaultSession.setPermissionRequestHandler((contents,permission,callback,details)=>callback(contents===main?.webContents&&permission==='media'&&details.mediaTypes?.length===1&&details.mediaTypes[0]==='audio'));
 session.defaultSession.setPermissionCheckHandler((contents,permission)=>contents===main?.webContents&&permission==='media');
 createWindows();
 bind('read',()=>store.read());
 bind('settings',input=>{if(phase!=='idle')throw new Error('请结束当前录音或处理后再更改设置');const next=validateSettings({...store.read().settings,...input});registerShortcut(next.shortcut);const data=store.settings(next);broadcast();return data;});
 bind('dictionary',words=>{const data=store.dictionary(words);broadcast();return data;});
 bind('remove',id=>{const data=store.remove(id);broadcast();return data;});
 bind('clear',()=>{const data=store.clear();broadcast();return data;});
 bind('health',()=>health(store.read().settings));
 bind('startModels',startModels);
 bind('chooseModel',async()=>{const result=await dialog.showOpenDialog(main,{title:'选择本地模型',properties:['openFile'],filters:[{name:'模型',extensions:['bin','gguf']}]});return result.canceled?null:result.filePaths[0];});
 bind('toggle',external=>toggle(external===true),true);
 bind('state',(next,message)=>{if(!['idle','recording'].includes(next))throw new Error('无效状态');if(next==='idle'&&externalSession){holdHud=true;send({type:'hud-notice',message:typeof message==='string'?message.slice(0,500):'录音已结束，可重新按快捷键开始。'});target=null;}setPhase(next);});
 bind('cancel',cancelSession,true);
 bind('preview',async input=>{
  if(phase!=='recording'||previewController)return null;
  const active=new AbortController();previewController=active;
  try{
   const {settings,dictionary}=store.read();
   const text=await transcribeAudio(input,settings,dictionary,AbortSignal.any([active.signal,AbortSignal.timeout(12000)]));
   if(!active.signal.aborted&&phase==='recording'){
    send({type:'preview',text});
    const draft=liveDraft;
    if(draft&&!draft.blocked){
     // A command can authorize Enter only during final processing, never a preview.
     let preview=text;try{preview=splitEnterCommand(text,settings.voiceEnter).text;}catch{preview='';}
     if(preview)try{await draft.update(preview);}catch(error){if(!draft.signal.aborted)send({type:'hud-notice',message:error.message});}
    }
    return text;
   }
  }catch(error){if(!active.signal.aborted&&phase==='recording')send({type:'preview-error',message:'实时预览暂不可用，结束后会重新识别。'});throw error;}finally{if(previewController===active)previewController=null;}
 });
 bind('process',async input=>{
  cancelPreview();
  if(controller)throw new Error('已有录音正在处理');
  const active=new AbortController();controller=active;
  const sessionDraft=liveDraft;
  await sessionDraft?.queue;active.signal.throwIfAborted();
  const capturedTarget=target;const {settings,dictionary}=store.read();
  try {
   const result=await processAudio(input,settings,dictionary,active.signal,setPhase,{selectedText:capturedTarget?.selectedText,onTranscript:text=>send({type:'preview',text,final:true})});active.signal.throwIfAborted();
   send({type:'revision',value:{original:result.original,text:result.text,warning:result.warning}});
   store.add(result);lastHudText=result.text;broadcast();
   let deliveryStatus='retained';
   let delivery=result.confirmEnter?'已识别“确认发送”，但没有可自动写入的目标；请复制文字后手动发送。':'文字已准备好；本轮未绑定外部输入框，可点击“选择输入框填入”。';
   if(sessionDraft){
    try{
     if(result.warning)throw new Error('整理未完成，输入框保留实时草稿；请检查后手动复制。');
     const updated=await sessionDraft.update(result.text);active.signal.throwIfAborted();
     deliveryStatus='inserted';delivery=`已更新 ${capturedTarget.name} 中的本轮草稿`;
     if(result.confirmEnter){setPhase('sending');delivery=await pressEnterAfterPaste({target:updated,text:result.text,native,signal:active.signal});deliveryStatus='enter-posted';}
    }catch(error){delivery=error.message;deliveryStatus=sessionDraft.text===result.text?'manual-enter':'retained';}
   }else if(settings.autoPaste&&capturedTarget?.pid&&capturedTarget.pid!==process.pid&&!result.warning){
    try{
     const current=await native('context');active.signal.throwIfAborted();
     const problem=pasteProblem(capturedTarget,current);
     if(problem){delivery=problem;}
     else {
      setPhase('pasting');clipboard.writeText(result.text);const pasted=await native('paste',String(capturedTarget.pid),capturedTarget.fingerprint);
      if(!pasted.ok){delivery=pasted.message;}
      else {
       const verified=await verifyPaste({target:capturedTarget,expectedHash:pasted.expectedDraftHash,native,signal:active.signal});
       deliveryStatus=verified?'inserted':'unverified';
       delivery=verified?`已填入 ${capturedTarget.name}`:'已发出粘贴操作，请确认输入结果。';
       if(result.confirmEnter){
        if(verified){setPhase('sending');send({type:'hud-notice',message:'已识别发送指令 · 正在核对文字并按 Enter'});delivery=await pressEnterAfterPaste({target:capturedTarget,text:result.text,native,signal:active.signal});deliveryStatus='enter-posted';}
        else delivery='无法确认文字已填入，没有按回车。请检查输入框。';
       }
      }
     }
    }catch(error){deliveryStatus=deliveryStatus==='inserted'?'manual-enter':'retained';delivery=error.message+'。结果可在应用中复制。';}
   }
   active.signal.throwIfAborted();if(externalSession){holdHud=true;lastHudText=result.text;send({type:'hud-notice',message:delivery,canCopy:true,status:deliveryStatus,permission:capturedTarget?.status==='permission-denied'});if(deliveryStatus==='inserted'||deliveryStatus==='enter-posted')hudDismissTimer=setTimeout(()=>{if(phase==='idle'){holdHud=false;hud?.hide();}},1800);}send({type:'result',result:{...result,delivery,deliveryStatus}});return {...result,delivery,deliveryStatus};
  }catch(error){if(externalSession&&!active.signal.aborted){holdHud=true;send({type:'hud-notice',message:error.message});}throw error;}finally{if(controller===active){controller=null;target=null;liveAbort?.abort();liveDraft=null;setPhase('idle');}}
 });
 bind('testLiveInsertion',testLiveInsertion);
 bind('chooseRecordingTarget',chooseRecordingTarget);
 bind('testInsertion',()=>insertWithCountdown('Voxa 输入测试成功。'));
 bind('retryInsertion',()=>insertWithCountdown(lastHudText),true);
 bind('copyHudResult',()=>{if(!lastHudText)throw new Error('没有可复制的结果');clipboard.writeText(lastHudText);return true;},true);
 bind('copy',text=>{if(typeof text!=='string'||text.length>100000)throw new Error('文字长度不正确');clipboard.writeText(text);});
 bind('permissions',async()=>({microphone:systemPreferences.getMediaAccessStatus('microphone'),accessibility:await native('permission').then(x=>x.accessibility).catch(()=>false)}));
 bind('openAccessibility',async()=>{await native('requestPermission');await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');});
 bind('show',()=>{main.show();send({type:'setup-input'});},true);
 bind('hudSize',kind=>{const height=({compact:76,preview:176,notice:268})[kind];if(!height)throw new Error('无效浮窗尺寸');hud.setSize(400,height);},true);
 bind('exportHistory',async()=>{const result=await dialog.showSaveDialog(main,{defaultPath:'voxa-history.md',filters:[{name:'Markdown',extensions:['md']}]});if(result.canceled)return false;fs.writeFileSync(result.filePath,store.read().history.map(h=>`## ${h.createdAt}\n\n${h.text}\n`).join('\n'),{mode:0o600});return true;});
 try{registerShortcut(store.read().settings.shortcut);}catch(error){main.webContents.once('did-finish-load',()=>send({type:'error',message:error.message}));}
 main.webContents.once('did-finish-load',()=>{if(!process.env.VOICELEAF_TEST)void startModels().then(value=>send({type:'health',value})).catch(error=>send({type:'model-error',message:error.message}));});
 app.on('activate',()=>main.show());
}
}).catch(error=>{dialog.showErrorBox('Voxa 启动失败',error.message);app.quit();});
app.on('before-quit',()=>{quitting=true;cancelPreview();controller?.abort();globalShortcut.unregisterAll();for(const child of children)child.kill();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
