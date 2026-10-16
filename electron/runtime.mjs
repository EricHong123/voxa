import fs from 'node:fs';
import path from 'node:path';

// A distributed app must never silently depend on the developer's Homebrew install.
export function resolveRuntime(name,{packaged,resourcesPath,exists=fs.existsSync}) {
 if(!['whisper-server','llama-server'].includes(name))throw new Error('Unsupported model runtime');
 if(packaged){
  const bundled=path.join(resourcesPath,'runtime',name);
  if(exists(bundled))return bundled;
  throw new Error(`安装包缺少 ${name}，请重新下载完整的 Voxa 安装包。`);
 }
 for(const prefix of ['/opt/homebrew/bin','/usr/local/bin']){
  const candidate=path.join(prefix,name);
  if(exists(candidate))return candidate;
 }
 throw new Error(`没有找到 ${name}。源码开发请先安装对应的本地模型运行环境。`);
}
