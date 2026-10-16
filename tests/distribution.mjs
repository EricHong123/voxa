import {_electron as electron,expect} from '@playwright/test';
import {mkdtemp,rm,writeFile,readFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {DEFAULTS} from '../electron/core.mjs';

const bundle=path.resolve(process.env.VOXA_TEST_BUNDLE||'release-distribution/mac-arm64/Voxa.app');
const resources=path.join(bundle,'Contents/Resources');
const profile=await mkdtemp(path.join(tmpdir(),'voxa-distribution-'));
const freePort=()=>new Promise((resolve,reject)=>{
 const server=net.createServer();server.once('error',reject);
 server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});
});
let app;
try{
 await mkdir('artifacts',{recursive:true});
 for(const name of ['whisper-server','llama-server']){
  const executable=path.join(resources,'runtime',name);
  const links=execFileSync('otool',['-L',executable],{encoding:'utf8'}).split('\n').slice(1).map(l=>l.trim().split(' ')[0]).filter(Boolean);
  expect(links.every(l=>l.startsWith('/usr/lib/')||l.startsWith('/System/Library/'))).toBe(true);
 }
 execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',bundle]);
 const whisperPort=await freePort();let rewritePort=await freePort();while(rewritePort===whisperPort)rewritePort=await freePort();
 await writeFile(path.join(profile,'state.json'),JSON.stringify({settings:{...DEFAULTS,autoPaste:false,language:'en',whisperUrl:`http://127.0.0.1:${whisperPort}`,rewriteUrl:`http://127.0.0.1:${rewritePort}`},history:[],dictionary:[]}));
 app=await electron.launch({executablePath:path.join(bundle,'Contents/MacOS/Voxa'),env:{...process.env,PATH:'/usr/bin:/bin:/usr/sbin:/sbin',VOICELEAF_DATA_DIR:profile,VOICELEAF_TEST:'1'}});
 await expect.poll(()=>app.windows().some(p=>p.url().endsWith('index.html')),{timeout:20000}).toBe(true);
 const page=app.windows().find(p=>p.url().endsWith('index.html'));
 const state=await page.evaluate(()=>window.voiceleaf.read());
 expect(state.value.history).toHaveLength(0);
 expect(state.value.settings.whisperModelPath).toBe(path.join(resources,'models/ggml-large-v3-turbo-q5_0.bin'));
 expect(state.value.settings.rewriteModelPath).toBe(path.join(resources,'models/qwen2.5-1.5b-instruct-q4_k_m.gguf'));
 const started=await page.evaluate(()=>window.voiceleaf.startModels());
 expect(started).toEqual({ok:true,value:{whisper:true,rewrite:true}});
 const wav=await readFile('artifacts/test-speech.wav');
 const result=await page.evaluate(bytes=>window.voiceleaf.process(Uint8Array.from(bytes).buffer),[...wav]);
 expect(result.ok).toBe(true);expect(result.value.warning).toBe('');
 expect(result.value.original.toLowerCase()).toContain('project');expect(result.value.text.length).toBeGreaterThan(15);
 await writeFile('artifacts/distribution-results.json',JSON.stringify({passed:true,standaloneRuntimes:true,isolatedPorts:true,systemOnlyPath:true,transcription:result.value.original,rewrite:result.value.text},null,2));
 console.log('Distribution passed: signed bundle, packaged-only runtimes/models, fresh profile, isolated ports, synthetic speech and rewrite.');
}finally{await app?.close();await rm(profile,{recursive:true,force:true});}
