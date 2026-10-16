import React,{useState,useEffect} from 'react';
const presets={
 openai:{label:'OpenAI / 自定义兼容接口',provider:'openai',base:'https://api.openai.com/v1'},
 deepseek:{label:'DeepSeek（文字）',provider:'openai',base:'https://api.deepseek.com/v1'},
 qwen:{label:'通义千问 / 阿里云百炼（文字）',provider:'openai',base:'https://dashscope.aliyuncs.com/compatible-mode/v1'},
 zhipu:{label:'智谱 GLM（文字）',provider:'openai',base:'https://open.bigmodel.cn/api/paas/v4'},
 kimi:{label:'月之暗面 Kimi（文字）',provider:'openai',base:'https://api.moonshot.cn/v1'},
 doubao:{label:'豆包 / 火山方舟（文字）',provider:'openai',base:'https://ark.cn-beijing.volces.com/api/v3'},
 siliconflow:{label:'硅基流动',provider:'openai',base:'https://api.siliconflow.cn/v1'},
 minimax:{label:'MiniMax 国内（文字）',provider:'openai',base:'https://api.minimax.cn/v1'},
 groq:{label:'Groq',provider:'openai',base:'https://api.groq.com/openai/v1'},
 openrouter:{label:'OpenRouter（文字）',provider:'openai',base:'https://openrouter.ai/api/v1'},
 anthropic:{label:'Claude',provider:'anthropic',base:'https://api.anthropic.com/v1'},
 gemini:{label:'Gemini',provider:'gemini',base:'https://generativelanguage.googleapis.com/v1beta'}
};
async function api(name,...args){const r=await window.voiceleaf[name](...args);if(!r.ok)throw new Error(r.error);return r.value;}
function Service({kind,draft,setDraft,disabled}){
 const asr=kind==='asr',providerKey=asr?'asrProvider':'rewriteProvider',baseKey=asr?'asrBase':'cloudRewriteBase',modelKey=asr?'asrModel':'cloudRewriteModel';
 const [key,setKey]=useState(''),[saved,setSaved]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const provider=draft[providerKey],base=draft[baseKey],model=draft[modelKey];
 useEffect(()=>{let alive=true;setKey('');setMessage('');setSaved(false);api('credentialStatus',draft).then(r=>{if(alive)setSaved(r[kind]);}).catch(()=>{});return()=>{alive=false;};},[provider,base,kind,model]);
 useEffect(()=>setMessage(''),[model]);
 const selected=provider==='local'?'local':Object.keys(presets).find(id=>presets[id].provider===provider&&presets[id].base===base)||'custom';
 async function action(fn){setBusy(true);setMessage('');try{await fn();}catch(e){setMessage(e.message);}finally{setBusy(false);}}
 return <div className="cloud-service"><h3>{asr?'语音识别':'文字整理 / 翻译 / 编辑'}</h3>
  <label className="field"><span>{asr?'识别服务':'文字服务'}</span><select aria-label={asr?'识别服务':'文字服务'} disabled={disabled||busy} value={selected} onChange={e=>{const p=presets[e.target.value];if(!p){setDraft({...draft,[providerKey]:e.target.value==='local'?'local':'openai',...(e.target.value==='custom'?{[baseKey]:'https://your-provider.example/v1'}:{})});return;}setDraft({...draft,[providerKey]:p.provider,[baseKey]:p.base,[modelKey]:asr?(e.target.value==='groq'?'whisper-large-v3-turbo':e.target.value==='siliconflow'?'FunAudioLLM/SenseVoiceSmall':'whisper-1'):''});}}>
   <option value="local">本地模型（默认）</option>{Object.entries(presets).filter(([id])=>!asr||['openai','groq','siliconflow'].includes(id)).map(([id,p])=><option key={id} value={id}>{p.label}</option>)}<option value="custom">自定义兼容接口</option>
  </select></label>
  {provider!=='local'&&<>
   {!asr&&<label className="field"><span>API 协议</span><select disabled={disabled||busy} value={provider} onChange={e=>setDraft({...draft,[providerKey]:e.target.value})}><option value="openai">OpenAI Chat Completions</option><option value="anthropic">Claude Messages</option><option value="gemini">Gemini Generate Content</option></select></label>}
   <label className="field"><span>{asr?'语音 Base URL':'文字 Base URL'}</span><input disabled={disabled||busy} value={base} onChange={e=>setDraft({...draft,[baseKey]:e.target.value})} spellCheck={false}/></label>
   <label className="field"><span>{asr?'语音模型名称':'云端文字模型名称'}</span><input disabled={disabled||busy} value={model} onChange={e=>setDraft({...draft,[modelKey]:e.target.value})} placeholder="填写模型 ID；豆包也可填写推理接入点 ID" spellCheck={false}/></label>
   <label className="field"><span>{asr?'语音 API Key':'文字 API Key'} · {saved?'已安全保存':'尚未保存'}</span><input type="password" disabled={disabled||busy} value={key} onChange={e=>setKey(e.target.value)} placeholder={saved?'留空保留现有密钥':'输入 API Key'} autoComplete="off" spellCheck={false}/></label>
   <div className="cloud-actions"><button type="button" className="secondary" disabled={disabled||busy||!key.trim()||!model.trim()} onClick={()=>action(async()=>{await api('saveCredential',kind,draft,key);setKey('');setSaved(true);setMessage('密钥已保存，请保存设置以启用服务');})}>保存密钥</button>
    <button type="button" className="text-button" disabled={disabled||busy||!saved} onClick={()=>action(async()=>{await api('saveCredential',kind,draft,'');setSaved(false);setKey('');setMessage('当前地址的密钥已移除');})}>移除密钥</button>
    <button type="button" className="secondary" disabled={disabled||busy||!saved||!!key||!model.trim()} onClick={()=>action(async()=>setMessage(await api('testProvider',kind,draft)))}>{busy?'正在处理…':'测试连接'}</button></div>
   <p className="cloud-caption">{asr?'测试会发送 1 秒生成的静音；正式识别在录音结束后上传一次，不提供云端实时预览。':'测试只发送固定示例文字；正式使用会发送转录、词典，编辑模式还会发送选中文字。'}测试可能产生少量 API 费用。</p>
   {message&&<p className="cloud-message" role="status">{message}</p>}
  </>}
 </div>;
}
export default function CloudSettings({draft,setDraft,disabled}){
 return <section className="settings-section"><h3>模型服务</h3><p className="cloud-caption">可独立选择本地或云端。云端音频 / 文字会发送到下方填写的服务地址，计费和数据保留规则由服务商决定。保存设置后生效。</p>
  <div className="cloud-grid">{['asr','rewrite'].map(kind=><Service key={kind} kind={kind} draft={draft} setDraft={setDraft} disabled={disabled}/>)}</div>
  <p className="cloud-caption">API Key 使用 macOS 钥匙串保护的密钥加密保存，不写入设置、历史或 GitHub。更换服务地址后需单独保存密钥。</p>
 </section>;
}
