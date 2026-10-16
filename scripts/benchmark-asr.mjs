import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
const wav=await readFile('artifacts/chinese-test.wav');
const results=[];
for(const [name,port] of [['base',17863],['large-v3-turbo-q5_0',17864]]){
 const child=spawn('/opt/homebrew/bin/whisper-server',['-m',`models/ggml-${name}.bin`,'--host','127.0.0.1','--port',String(port),'-l','zh','-nt'],{stdio:['ignore','ignore','ignore']});
 let exited=false;child.on('exit',()=>exited=true);
 try{
  let ready=false;
  for(let i=0;i<120;i++){
   if(exited)throw new Error('Server exited: '+name);
   try{const r=await fetch(`http://127.0.0.1:${port}/health`);if(r.ok){ready=true;break;}}catch{}
   await new Promise(r=>setTimeout(r,500));
  }
  if(!ready)throw new Error('Server startup timed out');
  for(let i=0;i<2;i++){
   const form=new FormData();form.set('file',new Blob([wav]),'sample.wav');form.set('language','zh');form.set('response_format','json');form.set('temperature','0');
   const started=performance.now();const r=await fetch(`http://127.0.0.1:${port}/inference`,{method:'POST',body:form,signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error('HTTP '+r.status);
   const result={model:name,run:i+1,ms:Math.round(performance.now()-started),...(await r.json())};results.push(result);console.log(JSON.stringify(result));
  }
 }finally{child.kill();await new Promise(r=>child.once('exit',r));}
}
await writeFile('artifacts/asr-comparison.json',JSON.stringify({source:'Synthetic Tingting speech, not the user recording',expected:'我的这个辅助功能在哪里打开？我想在微信输入框里直接说话，停顿以后自动输入。',results},null,2));
