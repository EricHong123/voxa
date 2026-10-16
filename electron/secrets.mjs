import fs from 'node:fs';
import path from 'node:path';
// Electron safeStorage uses a macOS Keychain-protected encryption key.
// API keys remain encrypted on disk and are never returned through IPC.
export function createSecrets(directory,storage){
 const file=path.join(directory,'credentials.enc.json');
 const read=()=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
 function available(){if(!storage.isEncryptionAvailable())throw new Error('系统安全存储不可用，无法读取或保存 API Key');}
 return {
  has(id){return typeof read()[id]==='string';},
  get(id){const entry=read()[id];if(!entry)return '';available();try{return storage.decryptString(Buffer.from(entry,'base64'));}catch{throw new Error('无法解密 API Key，请重新保存');}},
  set(id,key){
   if(typeof key!=='string'||key.length>4096||/[\r\n\x00-\x1f]/.test(key))throw new Error('API Key 格式无效');
   const data=read();if(key.trim()){available();data[id]=storage.encryptString(key.trim()).toString('base64');}else delete data[id];
   fs.writeFileSync(file+'.tmp',JSON.stringify(data),{mode:0o600});fs.renameSync(file+'.tmp',file);
  }
 };
}
