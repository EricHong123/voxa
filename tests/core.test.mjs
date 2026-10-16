import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {DEFAULTS,createStore,localURL,validateSettings,validateWav,processAudio} from '../electron/core.mjs';
import {encodeWav} from '../src/audio.mjs';

test('audio exported as valid mono 16 kHz PCM; corrupt and oversized inputs rejected',()=>{
 const input=Float32Array.from({length:48000},(_,i)=>Math.sin(i/30));const wav=encodeWav(input,48000);const parsed=validateWav(wav);
 assert.equal(parsed.length,32044);assert.equal(parsed.readUInt32LE(24),16000);
 assert.throws(()=>validateWav(new Uint8Array(50)),/WAV/);
 const broken=Buffer.from(wav);broken.writeUInt32LE(8,40);assert.throws(()=>validateWav(broken));
});
test('model URLs cannot leave literal IPv4 loopback or redirect via URL components',()=>{
 assert.equal(localURL('http://127.0.0.1:8080'),'http://127.0.0.1:8080');
 for(const url of ['https://example.com','http://localhost:8080','http://127.0.0.1:8080@evil.com','http://127.0.0.1:8080/path','http://127.0.0.1:8080?x=1'])assert.throws(()=>localURL(url));
 assert.throws(()=>validateSettings({...DEFAULTS,polish:'yes'}));assert.throws(()=>validateSettings({...DEFAULTS,rewriteModel:'qwen-cloud'}));
});
test('dictionary, history and settings persist; disabling history avoids new writes',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'voiceleaf-unit-'));
 try{const store=createStore(dir);store.dictionary(['声笺','声笺']);assert.equal(store.read().dictionary.length,1);
 store.add({text:'测试',duration:3});store.settings({keepHistory:false});store.add({text:'不应保存'});
 assert.equal(createStore(dir).read().history.length,1);assert.equal(createStore(dir).read().settings.keepHistory,false);
 const snapshot=store.read();snapshot.history=[];assert.equal(store.read().history.length,1);
 store.clear();assert.equal(JSON.parse(readFileSync(path.join(dir,'state.json'))).history.length,0);
 }finally{rmSync(dir,{recursive:true});}
});
async function server(handler,fn){const srv=http.createServer(handler);await new Promise(r=>srv.listen(0,'127.0.0.1',r));try{await fn(`http://127.0.0.1:${srv.address().port}`);}finally{srv.closeAllConnections();await new Promise(r=>srv.close(r));}}
const wav=()=>encodeWav(new Float32Array(16000),16000);
test('ASR output survives rewrite failure with explicit warning',async()=>{
 await server((req,res)=>{if(req.url==='/inference'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({text:'原始转写'}));}else{res.writeHead(503);res.end();}},async url=>{
  const result=await processAudio(wav(),{...DEFAULTS,whisperUrl:url,rewriteUrl:url},[],new AbortController().signal);
  assert.equal(result.text,'原始转写');assert.match(result.warning,/未完成/);
 });
});
test('transcription-only mode makes no rewrite request and passes dictionary',async()=>{
 let requests=0,body='';await server((req,res)=>{requests++;req.on('data',d=>body+=d);req.on('end',()=>{res.end(JSON.stringify({text:'声笺你好'}));});},async url=>{
  const result=await processAudio(wav(),{...DEFAULTS,whisperUrl:url,polish:false},['声笺'],new AbortController().signal);
  assert.equal(result.text,'声笺你好');assert.equal(requests,1);assert.match(body,/声笺/);assert.match(body,/recording.wav/);
 });
});
test('cancel aborts in-flight inference instead of producing stale text',async()=>{
 await server((_req,_res)=>{},async url=>{const controller=new AbortController();const pending=processAudio(wav(),{...DEFAULTS,whisperUrl:url},[],controller.signal);setTimeout(()=>controller.abort(new Error('cancelled')),40);await assert.rejects(pending,/cancelled/);});
});
test('redirect to nonlocal service is not followed',async()=>{
 await server((_req,res)=>{res.writeHead(302,{Location:'https://example.com'});res.end();},async url=>{await assert.rejects(processAudio(wav(),{...DEFAULTS,whisperUrl:url},[],new AbortController().signal),/识别失败/);});
});
test('editing requires a selection; selection and speech instruction have separate fields',async()=>{
 const settings={...DEFAULTS,mode:'edit'};
 await assert.rejects(processAudio(wav(),settings,[],new AbortController().signal),/选中文字/);
 let rewriteBody;
 await server((req,res)=>{let body='';req.on('data',d=>body+=d);req.on('end',()=>{if(req.url==='/inference')res.end(JSON.stringify({text:'Make it shorter'}));else{rewriteBody=JSON.parse(body);res.end(JSON.stringify({choices:[{message:{content:'Meeting tomorrow.'},finish_reason:'stop'}]}));}});},async url=>{
 const result=await processAudio(wav(),{...settings,whisperUrl:url,rewriteUrl:url},[],new AbortController().signal,()=>{},{selectedText:'We will have a meeting tomorrow.'});
 assert.equal(result.text,'Meeting tomorrow.');assert.deepEqual(JSON.parse(rewriteBody.messages[1].content),{selectedText:'We will have a meeting tomorrow.',editInstruction:'Make it shorter'});
 });
});
test('send suffix is removed before rewrite and model-generated suffix cannot authorize Enter',async()=>{
 let input='明天九点开会，确认发送。',seen;
 await server((req,res)=>{let body='';req.on('data',d=>body+=d);req.on('end',()=>{if(req.url==='/inference')res.end(JSON.stringify({text:input}));else{seen=JSON.parse(body).messages[1].content;res.end(JSON.stringify({choices:[{message:{content:input.endsWith('确认发送。')?'明天九点开会。':'明天九点开会，确认发送。'},finish_reason:'stop'}]}));}});},async url=>{
  const settings={...DEFAULTS,voiceEnter:true,whisperUrl:url,rewriteUrl:url};
  const result=await processAudio(wav(),settings,[],new AbortController().signal);
  assert.equal(seen,'明天九点开会');assert.equal(result.confirmEnter,true);assert.equal(result.original,'明天九点开会');
  input='明天九点开会';const plain=await processAudio(wav(),settings,[],new AbortController().signal);assert.equal(plain.confirmEnter,false);
 });
});
