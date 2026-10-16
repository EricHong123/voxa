import {spawn} from 'node:child_process';
import {mkdir,rename,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const directory=fileURLToPath(new URL('../models/',import.meta.url));
await mkdir(directory,{recursive:true});
const models=[
 ['ggml-large-v3-turbo-q5_0.bin','https://huggingface.co/ggerganov/whisper.cpp/resolve/0b364b566045a405be7225ee1e415a073e04da77/ggml-large-v3-turbo-q5_0.bin',574000000],
 ['ggml-base.bin','https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base.bin',140000000],
 ['qwen2.5-1.5b-instruct-q4_k_m.gguf','https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/91cad51170dc346986eccefdc2dd33a9da36ead9/qwen2.5-1.5b-instruct-q4_k_m.gguf',900000000]
];
for(const [name,url,minSize] of models){
 const dest=directory+name;
 if(await stat(dest).then(s=>s.size>minSize).catch(()=>false)){console.log('Already downloaded:',name);continue;}
 console.log('Downloading:',name);
 await new Promise((resolve,reject)=>{const child=spawn('curl',['--fail','--location','--retry','3','--connect-timeout','20',url,'-o',dest+'.part'],{stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Download failed: '+name)));});
 if((await stat(dest+'.part')).size<minSize)throw new Error('Incomplete model: '+name);
 await rename(dest+'.part',dest);
}
console.log('Local models ready.');
