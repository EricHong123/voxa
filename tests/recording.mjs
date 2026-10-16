import {_electron as electron,expect} from '@playwright/test';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
const dir=await mkdtemp(path.join(tmpdir(),'voiceleaf-record-'));
let app;
try{
 app=await electron.launch({args:['--autoplay-policy=no-user-gesture-required','.'],env:{...process.env,VOICELEAF_DATA_DIR:dir,VOICELEAF_TEST:'1'}});
 await expect.poll(()=>app.windows().some(p=>p.url().endsWith('index.html'))).toBe(true);const page=app.windows().find(p=>p.url().endsWith('index.html'));
 await expect(page.getByRole('heading',{name:'让想法，自然流动。'})).toBeVisible();
 const bytes=[...await readFile('artifacts/test-speech.wav')];
 await page.evaluate(data=>{
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
   const ctx=new AudioContext();const decoded=await ctx.decodeAudioData(Uint8Array.from(data).buffer);const source=ctx.createBufferSource();source.buffer=decoded;source.loop=false;
   const destination=ctx.createMediaStreamDestination();source.connect(destination);await ctx.resume();source.start();
   for(const track of destination.stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{stop();source.stop();void ctx.close();};}
   return destination.stream;
  }});
 },bytes);
 const boot=await page.evaluate(()=>window.voiceleaf.startModels());expect(boot.ok).toBe(true);await page.evaluate(()=>window.voiceleaf.settings({language:'en',autoPaste:false}));
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('index.html')).show());
 await page.evaluate(()=>window.voiceleaf.toggle(true));await expect(page.getByRole('heading',{name:'正在聆听',exact:true})).toBeVisible();
 const hud=app.windows().find(p=>p.url().endsWith('#hud'));
 await expect(hud.locator('.hud')).toContainText('正在聆听');
 const hudWindow=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('#hud'));return {focusable:w.isFocusable(),allSpaces:w.isVisibleOnAllWorkspaces(),top:w.isAlwaysOnTop()};});
 expect(hudWindow).toEqual({focusable:false,allSpaces:true,top:true});
 await expect.poll(async()=>await hud.locator('.hud-preview p').innerText(),{timeout:15000}).not.toBe('');
 await hud.screenshot({path:'artifacts/live-transcription.png'});
 console.log('Live text visible in HUD before automatic silence completion.');
 expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('index.html')).isVisible())).toBe(false);
 await expect(page.locator('.result-card')).toBeVisible({timeout:45000});
 await expect(hud.locator('.hud-preview p')).not.toBeEmpty();
 await expect(hud.getByRole('button',{name:'复制文字',exact:true})).toBeVisible();
 await expect(hud.locator('.hud-toolbar')).toContainText('文字已保留');
 await expect(hud.locator('.hud-toolbar .spin')).toHaveCount(0);
 expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('index.html')).isVisible())).toBe(false);
 await hud.getByRole('button',{name:'取消',exact:true}).click();const state=await page.evaluate(()=>window.voiceleaf.read());expect(state.value.history.length).toBe(1);console.log('Synthetic microphone result:',state.value.history[0]);expect(state.value.history[0].original.toLowerCase()).toContain('project');
 await page.getByRole('button',{name:'开始录音',exact:true}).click();await expect(page.getByRole('heading',{name:'正在聆听',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'开始录音',exact:true})).toBeEnabled();
 const stateAfter=await page.evaluate(()=>window.voiceleaf.read());expect(stateAfter.value.history.length).toBe(1);
 await writeFile('artifacts/recording-results.json',JSON.stringify({passed:true,text:state.value.history[0].text,source:'Injected WebAudio MediaStream with synthetic speech; no real microphone requested'},null,2));
 console.log('Live HUD preview, silence auto-finish, real revision view, local inference, history, and Esc cancellation passed using an injected synthetic MediaStream.');
}finally{await app?.close();await rm(dir,{recursive:true,force:true});}
