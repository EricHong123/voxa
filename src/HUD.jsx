import React,{useEffect,useRef,useState} from 'react';
import {AudioLines,Square,Check,LoaderCircle,X,Copy,AlertCircle} from 'lucide-react';
import {revisionParts} from './revision.mjs';
const bridge=window.voiceleaf;
async function api(name,...args){const result=await bridge[name](...args);if(!result.ok)throw new Error(result.error);return result.value;}
const stages={choosing:'请选择输入框',starting:'准备聆听',recording:'正在聆听',transcribing:'正在识别',polishing:'正在整理',pasting:'正在填入',sending:'核对文字并回车'};
export default function HUD(){
 const [phase,setPhase]=useState('idle'),[text,setText]=useState(''),[previous,setPrevious]=useState(''),[revision,setRevision]=useState(null),[settled,setSettled]=useState(false);
 const [notice,setNotice]=useState(''),[error,setError]=useState(''),[canCopy,setCanCopy]=useState(false),[status,setStatus]=useState(''),[permission,setPermission]=useState(false),[target,setTarget]=useState(null);
 const current=useRef(''),preview=useRef(null);
 useEffect(()=>bridge?.on(e=>{
  if(e.type==='phase')setPhase(e.phase);
  if(e.type==='target')setTarget(e);
  if(e.type==='preview'){setPrevious(current.current);current.current=e.text;setText(e.text);setError('');}
  if(e.type==='revision'){setRevision(e.value);setSettled(false);}
  if(e.type==='preview-error')setError(e.message);
  if(e.type==='hud-notice'){setNotice(e.message);setCanCopy(Boolean(e.canCopy));setStatus(e.status||'');setPermission(Boolean(e.permission));}
  if(e.type==='cancel'){setText('');current.current='';setPrevious('');setRevision(null);setError('');setTarget(null);}
 }),[]);
 useEffect(()=>{if(!revision)return;const id=setTimeout(()=>setSettled(true),900);return()=>clearTimeout(id);},[revision]);
 const hasText=Boolean(text||revision),hasNotice=Boolean(notice||error);
 useEffect(()=>{api('hudSize',hasNotice?'notice':hasText?'preview':'compact').catch(e=>setError(e.message));},[hasNotice,hasText]);
 useEffect(()=>{if(preview.current)preview.current.scrollTop=preview.current.scrollHeight;},[text,revision,settled]);
 const success=['inserted','enter-posted'].includes(status);
 const title=phase==='idle'?(status==='manual-enter'?'已填入，请手动发送':status==='inserted'?'已填入':status==='enter-posted'?'已按 Enter':status==='unverified'?'请确认输入结果':canCopy?'文字已保留':'已结束'):stages[phase]||'正在处理';
 let prefix=0;while(prefix<previous.length&&prefix<text.length&&previous[prefix]===text[prefix])prefix++;
 const fail=e=>setError(e.message);
 return <section className={'hud '+(hasText?'expanded':'compact')} aria-label="Voxa 语音浮窗">
  <div className="hud-toolbar"><span className={'hud-symbol '+(phase==='recording'?'listening':'')}>{phase==='idle'&&success?<Check size={20}/>:<AudioLines size={20}/>}</span><div className="hud-heading"><strong role="status">{title}</strong>{target?.ready&&phase!=='idle'&&<small>输入到 {target.name}</small>}</div>
   {phase==='recording'?<button aria-label="停止录音" title="完成本轮听写" onClick={()=>api('toggle').catch(fail)}><Square size={13} fill="currentColor"/></button>:phase!=='idle'&&<LoaderCircle className="spin" size={16} aria-label="处理中"/>}
   <button aria-label="取消" title="取消尚未填入的内容 · Esc" onClick={()=>api('cancel').catch(fail)}><X size={17}/></button>
  </div>
  {hasText&&<div className="hud-preview" ref={preview} aria-label="实时转录" aria-live="polite"><p>{revision?(settled?revision.text:revisionParts(revision.original,revision.text).map((part,i)=><span key={i} className={'revision-'+part.kind}>{part.text}</span>)):<>{text.slice(0,prefix)}<span key={text} className="new-words">{text.slice(prefix)}</span></>}</p></div>}
  {hasNotice&&<div className="hud-feedback"><div className="hud-message">{!success&&<AlertCircle size={14}/>}<small>{error||notice}</small></div>{(canCopy||permission)&&<div className="hud-actions">{canCopy&&<button className="hud-copy" onClick={()=>api('copyHudResult').then(()=>setNotice('已复制，在输入框按 ⌘V 粘贴。')).catch(fail)}><Copy size={13}/>复制文字</button>}{canCopy&&phase==='idle'&&<button onClick={()=>api('retryInsertion').catch(fail)}>选择输入框填入</button>}{permission&&<button onClick={()=>api('show').catch(fail)}>前往设置</button>}</div>}</div>}
 </section>;
}
