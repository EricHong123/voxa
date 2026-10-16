import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version;
const out=path.join(root,'release-distribution');
const run=(command,args)=>execFileSync(command,args,{cwd:root,stdio:'inherit'});
for(const file of ['runtime/whisper-server','runtime/llama-server','runtime/manifest.json','models/ggml-large-v3-turbo-q5_0.bin','models/qwen2.5-1.5b-instruct-q4_k_m.gguf','licenses/Qwen2.5-1.5B-Instruct-APACHE-2.0.txt','licenses/Whisper-MIT.txt']){
 if(!fs.existsSync(path.join(root,file)))throw new Error('Missing package input: '+file);
}
const models=JSON.parse(fs.readFileSync(path.join(root,'licenses/models.json')));
for(const [name,metadata] of Object.entries(models)){
 const hash=createHash('sha256');
 for await(const chunk of fs.createReadStream(path.join(root,'models',name)))hash.update(chunk);
 if(hash.digest('hex')!==metadata.sha256)throw new Error('Model checksum mismatch: '+name);
}
run(path.join(root,'node_modules/.bin/electron-builder'),['--mac','dir','--arm64','--config.directories.output='+out]);
const bundle=path.join(out,'mac-arm64/Voxa.app');
run(process.execPath,[path.join(root,'scripts/sign-local.mjs'),bundle]);
const staging=path.join(out,'dmg-staging');
fs.rmSync(staging,{recursive:true,force:true});
fs.mkdirSync(staging,{recursive:true});
// ditto preserves the bundle's permissions and symlinks; destination is generated output only.
run('/usr/bin/ditto',[bundle,path.join(staging,'Voxa.app')]);
if(!fs.existsSync(path.join(staging,'Applications')))fs.symlinkSync('/Applications',path.join(staging,'Applications'));
fs.copyFileSync(path.join(root,'docs/INSTALL-MAC.md'),path.join(staging,'READ ME FIRST.md'));
const dmg=path.join(out,`Voxa-${version}-macOS26-AppleSilicon.dmg`);
run('/usr/bin/hdiutil',['create','-volname',`Voxa ${version}`,'-srcfolder',staging,'-ov','-format','UDZO',dmg]);
run('/usr/bin/hdiutil',['verify',dmg]);
if(fs.statSync(dmg).size>=2*1024**3)throw new Error('DMG exceeds GitHub per-asset limit; do not upload.');
const hash=createHash('sha256');
for await(const chunk of fs.createReadStream(dmg))hash.update(chunk);
fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),`${hash.digest('hex')}  ${path.basename(dmg)}\n`);
console.log('Distribution ready:',dmg);
