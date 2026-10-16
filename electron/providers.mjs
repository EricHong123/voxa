// All cloud traffic is initiated by the main process; renderer CSP stays local-only.
export function cloudURL(value) {
 const u=new URL(value);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.port&&u.port!=='443'||u.hostname==='localhost'||u.hostname.endsWith('.local')||u.hostname.endsWith('.localhost')||/^[\d.]+$/.test(u.hostname)||u.hostname.includes(':'))throw new Error('云端地址必须为 HTTPS 域名，不能包含密钥、查询参数或本机地址');
 return u.href.replace(/\/+$/,'');
}
export function serviceConfig(settings,kind) {
 if(!['asr','rewrite'].includes(kind))throw new Error('无效服务类型');
 const provider=kind==='asr'?settings.asrProvider:settings.rewriteProvider;
 return {provider:provider||'local',base:cloudURL(kind==='asr'?settings.asrBase:settings.cloudRewriteBase),model:(kind==='asr'?settings.asrModel:settings.cloudRewriteModel).trim()};
}
export function credentialId(settings,kind) {
 const {provider,base}=serviceConfig(settings,kind);
 return `${kind}:${provider}:${base}`;
}
async function request(url,options,signal,fetcher=fetch) {
 signal.throwIfAborted();
 let r;
 try{r=await fetcher(url,{...options,redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(90000)])});}
 catch {if(signal.aborted)throw signal.reason;throw new Error('云端连接失败或超时，请检查地址和网络（不跟随重定向）');}
 if(!r.ok){const hint=r.status===401||r.status===403?'检查 API Key 和账户权限':r.status===429?'额度不足或请求过于频繁':r.status===404?'检查 Base URL 和模型名称':'检查服务商状态及模型兼容性';throw new Error(`云端 HTTP ${r.status}：${hint}`);}
 try{return await r.json();}catch{throw new Error('云端没有返回有效 JSON');}
}
function keyRequired(key){if(typeof key!=='string'||!key.trim())throw new Error('请先为当前服务地址保存 API Key');}
export async function cloudTranscribe(wav,settings,dictionary,signal,key,fetcher=fetch){
 keyRequired(key);const {provider,base,model}=serviceConfig(settings,'asr');
 if(provider!=='openai')throw new Error('不支持此语音接口');
 const form=new FormData();form.set('file',new Blob([wav],{type:'audio/wav'}),'recording.wav');form.set('model',model);
 // SiliconFlow's documented schema accepts only file/model, not Whisper hints.
 if(new URL(base).hostname!=='api.siliconflow.cn'){
  form.set('response_format','json');
  if(settings.language!=='auto')form.set('language',settings.language);
  if(dictionary.length)form.set('prompt',dictionary.join('、').slice(0,4000));
 }
 const data=await request(base+'/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form},signal,fetcher);
 if(typeof data.text!=='string')throw new Error('语音接口未返回 text 字段');
 return data.text.trim();
}
export async function cloudRewrite(system,content,settings,signal,key,fetcher=fetch){
 keyRequired(key);const {provider,base,model}=serviceConfig(settings,'rewrite');
 let endpoint,headers={'Content-Type':'application/json'},payload;
 if(provider==='openai'){
  endpoint='/chat/completions';headers.Authorization=`Bearer ${key}`;
  payload={model,messages:[{role:'system',content:system},{role:'user',content}],stream:false};
  if(['api.minimax.cn','api.minimaxi.com','api.minimax.io'].includes(new URL(base).hostname))payload.reasoning_split=true;
 }else if(provider==='anthropic'){
  endpoint='/messages';headers['x-api-key']=key;headers['anthropic-version']='2023-06-01';
  payload={model,system,messages:[{role:'user',content}],max_tokens:4096};
 }else if(provider==='gemini'){
  endpoint=`/models/${encodeURIComponent(model)}:generateContent`;headers['x-goog-api-key']=key;
  payload={systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:content}]}],generationConfig:{maxOutputTokens:8192}};
 }else throw new Error('不支持此文字接口');
 const data=await request(base+endpoint,{method:'POST',headers,body:JSON.stringify(payload)},signal,fetcher);
 const reason=provider==='openai'?data.choices?.[0]?.finish_reason:provider==='anthropic'?data.stop_reason:data.candidates?.[0]?.finishReason;
 if(['length','max_tokens','MAX_TOKENS','content_filter','SAFETY','RECITATION'].includes(reason))throw new Error('云端输出被截断或拦截，已保留原始转写');
 const output=provider==='openai'?data.choices?.[0]?.message?.content:provider==='anthropic'?data.content?.filter(p=>p.type==='text').map(p=>p.text).join(''):data.candidates?.[0]?.content?.parts?.filter(p=>!p.thought).map(p=>p.text||'').join('');
 if(typeof output!=='string'||!output.trim())throw new Error('云端模型没有返回文字');
 signal.throwIfAborted();return output.trim();
}
