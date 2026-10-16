import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sources=path.join(root,'artifacts/runtime-sources');
const output=path.join(root,'runtime');
const projects=[
 {name:'whisper',directory:'whisper.cpp-1.9.4',url:'https://github.com/ggml-org/whisper.cpp/archive/refs/tags/v1.9.4.tar.gz',sha256:'57e280cee375ab02425b806ad5146b99f6eb9357e3c2b31357c8a6af2e2e44ae',version:'v1.9.4',target:'whisper-server',flags:['WHISPER_BUILD_TESTS=OFF','WHISPER_BUILD_SERVER=ON','WHISPER_CURL=OFF','WHISPER_USE_SYSTEM_GGML=OFF','WHISPER_USE_SYSTEM_LLAMA=OFF','WHISPER_SDL2=OFF']},
 {name:'llama',directory:'llama.cpp-7fe450e19305b828c199d602c23a8337aaa1f03b',url:'https://github.com/ggml-org/llama.cpp/archive/7fe450e19305b828c199d602c23a8337aaa1f03b.tar.gz',sha256:'a6861d549427f814dc591c439e08206f67ffaba0248344d421589abf18199e67',version:'7fe450e19305b828c199d602c23a8337aaa1f03b',target:'llama-server',flags:['LLAMA_BUILD_TESTS=OFF','LLAMA_BUILD_SERVER=ON','LLAMA_BUILD_APP=OFF','LLAMA_OPENSSL=OFF','LLAMA_USE_SYSTEM_GGML=OFF','LLAMA_BUILD_UI=OFF','LLAMA_USE_PREBUILT_UI=OFF']}
];
if(process.platform!=='darwin'||process.arch!=='arm64')throw new Error('Release runtimes require an Apple Silicon Mac.');
const run=(command,args)=>execFileSync(command,args,{cwd:root,stdio:'inherit'});
fs.mkdirSync(sources,{recursive:true});fs.mkdirSync(output,{recursive:true});
for(const p of projects){
 const archive=path.join(sources,p.name+'.tar.gz');
 if(!fs.existsSync(archive))run('curl',['--fail','--location','--retry','3',p.url,'-o',archive]);
 const actual=createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
 if(actual!==p.sha256)throw new Error(`Source checksum mismatch: ${p.name}; remove the archive and retry.`);
 const source=path.join(sources,p.directory);
 if(!fs.existsSync(source))run('tar',['-xzf',archive,'-C',sources]);
 const build=path.join(source,'build-voxa');
 run('cmake',['-S',source,'-B',build,'-DCMAKE_BUILD_TYPE=Release',`-DCMAKE_C_FLAGS=-ffile-prefix-map=${root}=/voxa-source`,`-DCMAKE_CXX_FLAGS=-ffile-prefix-map=${root}=/voxa-source`,'-DCMAKE_OSX_DEPLOYMENT_TARGET=26.0','-DCMAKE_OSX_ARCHITECTURES=arm64','-DBUILD_SHARED_LIBS=OFF','-DGGML_BACKEND_DL=OFF','-DGGML_NATIVE=OFF','-DGGML_OPENMP=OFF','-DGGML_METAL=ON','-DGGML_METAL_EMBED_LIBRARY=ON',...p.flags.map(f=>'-D'+f)]);
 run('cmake',['--build',build,'--config','Release','--target',p.target,'--parallel','6']);
 const target=path.join(output,p.target);
 fs.copyFileSync(path.join(build,'bin',p.target),target);fs.chmodSync(target,0o755);
 const linked=execFileSync('otool',['-L',target],{encoding:'utf8'});
 const libraries=linked.split('\n').slice(1).map(l=>l.trim().split(' ')[0]).filter(Boolean);
 if(libraries.some(l=>!l.startsWith('/usr/lib/')&&!l.startsWith('/System/Library/')))throw new Error('Non-system dependency in '+p.target+': '+linked);
 run('/usr/bin/codesign',['--force','--sign','-',target]);
 fs.copyFileSync(path.join(source,'LICENSE'),path.join(output,p.name+'-LICENSE'));
 const ggmlLicense=path.join(source,'ggml/LICENSE');
 if(fs.existsSync(ggmlLicense))fs.copyFileSync(ggmlLicense,path.join(output,p.name+'-ggml-LICENSE'));
}
// Preserve upstream notices, including licenses embedded in header-only sources.
const notices=path.join(output,'notices');fs.mkdirSync(notices,{recursive:true});
const whisperSource=path.join(sources,projects[0].directory);
const llamaSource=path.join(sources,projects[1].directory);
fs.cpSync(path.join(llamaSource,'vendor'),path.join(notices,'llama-vendor'),{recursive:true});
for(const relative of ['examples/json.hpp','examples/server/httplib.h'])fs.copyFileSync(path.join(whisperSource,relative),path.join(notices,'whisper-'+path.basename(relative)));
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify({architecture:'arm64',minimumMacOS:'26.0',projects:projects.map(({name,url,sha256,version,target})=>({name,url,sha256,version,target}))},null,2)+'\n');
console.log('Standalone runtimes ready; only Apple system libraries are linked.');
