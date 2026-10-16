import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {DEFAULTS,validateSettings,createStore,processAudio} from '../electron/core.mjs';
import {cloudURL,credentialId,cloudTranscribe,cloudRewrite} from '../electron/providers.mjs';
import {createSecrets} from '../electron/secrets.mjs';
import {encodeWav} from '../src/audio.mjs';
const signal=()=>new AbortController().signal;
const response=data=>new Response(JSON.stringify(data),{status:200});
test('cloud opt-in preserves migrated local defaults and rejects unsafe endpoints',()=>{
 assert.equal(validateSettings({}).asrProvider,'local');assert.equal(validateSettings({}).rewriteProvider,'local');
 for(const url of ['http://api.example.com/v1','https://key@api.example.com','https://api.example.com?key=secret','https://127.0.0.1','https://localhost','https://[::1]'])assert.throws(()=>cloudURL(url));
 assert.equal(cloudURL('https://api.example.com/v1/'),'https://api.example.com/v1');
 assert.throws(()=>validateSettings({...DEFAULTS,rewriteProvider:'anthropic'}),/模型名称/);
 assert.notEqual(credentialId(DEFAULTS,'rewrite'),credentialId({...DEFAULTS,cloudRewriteBase:'https://other.example/v1'},'rewrite'));
});
test('cloud ASR uses multipart auth and omits auto language',async()=>{
 const s={...DEFAULTS,asrProvider:'openai'};
 const text=await cloudTranscribe(encodeWav(new Float32Array(16000),16000),s,['Voxa'],signal(),'test-only',async(url,o)=>{
  assert.equal(url,'https://api.openai.com/v1/audio/transcriptions');assert.equal(o.redirect,'error');assert.equal(o.headers.Authorization,'Bearer test-only');assert.equal(o.body.get('language'),null);assert.equal(o.body.get('model'),'whisper-1');assert.equal(o.body.get('prompt'),'Voxa');return response({text:'测试'});
 });assert.equal(text,'测试');
});
for(const provider of ['openai','anthropic','gemini'])test(`${provider} adapter sends correct protocol and extracts text`,async()=>{
 const s={...DEFAULTS,rewriteProvider:provider,cloudRewriteBase:'https://provider.example/v1',cloudRewriteModel:'example-model'};
 const text=await cloudRewrite('system','user',s,signal(),'test-only',async(url,o)=>{
  const b=JSON.parse(o.body);assert.equal(o.redirect,'error');assert(!url.includes('test-only'));
  if(provider==='openai'){assert(url.endsWith('/chat/completions'));assert.equal(b.messages[1].content,'user');return response({choices:[{message:{content:'result'},finish_reason:'stop'}]});}
  if(provider==='anthropic'){assert.equal(o.headers['x-api-key'],'test-only');assert.equal(b.system,'system');assert.equal(b.max_tokens,4096);return response({content:[{type:'thinking',thinking:'private'},{type:'text',text:'result'}],stop_reason:'end_turn'});}
  assert.equal(o.headers['x-goog-api-key'],'test-only');assert(url.endsWith('/models/example-model:generateContent'));return response({candidates:[{content:{parts:[{thought:true,text:'private'},{text:'result'}]},finishReason:'STOP'}]});
 });assert.equal(text,'result');
});
test('provider errors do not echo remote secrets; truncation and cancellation fail explicitly',async()=>{
 const s={...DEFAULTS,rewriteProvider:'openai',cloudRewriteModel:'test'};
 await assert.rejects(cloudRewrite('s','u',s,signal(),'key',async()=>new Response('echo secret transcript',{status:401})),e=>e.message.includes('401')&&!e.message.includes('secret'));
 await assert.rejects(cloudRewrite('s','u',s,signal(),'key',async()=>response({choices:[{message:{content:'partial'},finish_reason:'length'}]})),/截断/);
 const c=new AbortController();c.abort(new Error('cancelled'));await assert.rejects(cloudRewrite('s','u',s,c.signal,'key',async()=>{throw new Error('should not fetch');}),/cancelled/);
 await assert.rejects(cloudRewrite('s','u',s,signal(),'',async()=>{throw new Error('should not fetch');}),/API Key/);
});
test('credential vault encrypts, binds by destination, deletes and fails closed',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'voxa-secrets-')),key=randomBytes(32);
 // Fake platform wrapper tests vault behavior without accessing the user's Keychain.
 const storage={isEncryptionAvailable:()=>true,encryptString:value=>{const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);const body=Buffer.concat([c.update(value,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),body]);},decryptString:value=>{const d=createDecipheriv('aes-256-gcm',key,value.subarray(0,12));d.setAuthTag(value.subarray(12,28));return Buffer.concat([d.update(value.subarray(28)),d.final()]).toString();}};
 try{const vault=createSecrets(dir,storage),id=credentialId(DEFAULTS,'asr');vault.set(id,'synthetic-test-key');assert(!readFileSync(path.join(dir,'credentials.enc.json'),'utf8').includes('synthetic-test-key'));assert.equal(vault.get(id),'synthetic-test-key');assert.equal(vault.get('another-destination'),'');assert(vault.has(id));vault.set(id,'');assert(!vault.has(id));assert.throws(()=>createSecrets(dir,{isEncryptionAvailable:()=>false}).set(id,'key'),/安全存储/);const store=createStore(dir);store.settings({apiKey:'must-not-persist'});assert(!readFileSync(path.join(dir,'state.json'),'utf8').includes('must-not-persist'));}finally{rmSync(dir,{recursive:true});}
});
test('SiliconFlow ASR sends only its documented multipart fields',async()=>{
 const s={...DEFAULTS,asrProvider:'openai',asrBase:'https://api.siliconflow.cn/v1',asrModel:'FunAudioLLM/SenseVoiceSmall',language:'zh'};
 await cloudTranscribe(new Uint8Array([1]),s,['private dictionary'],signal(),'test',async(url,o)=>{assert.deepEqual([...o.body.keys()],['file','model']);return response({text:'国内语音测试'});});
});
test('cloud pipeline uses service-bound keys and preserves transcript on rewrite failure',async()=>{
 const previous=globalThis.fetch,seen=[];
 globalThis.fetch=async(url,o)=>{seen.push({url,key:o.headers.Authorization});return url.endsWith('/audio/transcriptions')?response({text:'明天开会，确认发送。'}):new Response('secret',{status:429});};
 try{const result=await processAudio(encodeWav(new Float32Array(16000),16000),{...DEFAULTS,asrProvider:'openai',rewriteProvider:'openai',cloudRewriteModel:'test',voiceEnter:true},[],signal(),()=>{},{getKey:kind=>kind+'-test'});assert.equal(result.original,'明天开会');assert.equal(result.text,'明天开会');assert(result.confirmEnter);assert.match(result.warning,/429/);assert.deepEqual(seen.map(x=>x.key),['Bearer asr-test','Bearer rewrite-test']);}finally{globalThis.fetch=previous;}
});
