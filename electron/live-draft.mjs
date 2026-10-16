import {setTimeout as delay} from 'node:timers/promises';
// A session owns one UTF-16 range. All revisions are serialized and guarded by
// the last verified field fingerprint, including its text and cursor position.
export class LiveDraft {
 constructor(target,{native,replace,signal}){
  this.target=target;this.native=native;this.replace=replace;this.signal=signal;
  this.start=target.selectionStart;this.length=target.selectionLength;
  this.text=null;this.attempted=false;this.blocked='';this.queue=Promise.resolve();
 }
 update(text){
  const job=this.queue.then(()=>this.apply(text));
  this.queue=job.catch(()=>{});return job;
 }
 async apply(text){
  this.signal.throwIfAborted();
  if(this.blocked)throw new Error(this.blocked);
  if(typeof text!=='string'||text.length>100000)throw new Error('实时草稿过长');
  try{
   const current=await this.native('context');this.signal.throwIfAborted();
   if(current.pid!==this.target.pid||current.fieldIdentity!==this.target.fieldIdentity||current.fingerprint!==this.target.fingerprint)throw new Error('光标、输入框或文字已变化，实时填入已暂停；已填入内容保持不变。');
   if(text===this.text)return this.target;
   this.attempted=true;
   const reply=await this.replace({pid:this.target.pid,fingerprint:this.target.fingerprint,start:this.start,length:this.length,text});
   if(!reply.ok)throw new Error(reply.message||'实时填入失败');
   for(let i=0;i<10;i++){
    const next=await this.native('context');
    this.signal.throwIfAborted();
    if(next.pid!==this.target.pid||next.fieldIdentity!==this.target.fieldIdentity)throw new Error('输入位置已变化，实时填入已暂停。');
    if(next.draftHash===reply.expectedDraftHash&&next.selectionStart===this.start+text.length&&next.selectionLength===0){
     this.target=next;this.length=text.length;this.text=text;return next;
    }
    await delay(80,undefined,{signal:this.signal});
   }
   throw new Error('无法核对实时草稿，已停止继续修改；请检查输入框。');
  }catch(error){this.blocked=error.message;throw error;}
 }
}
export function canStream(target){return Boolean(target?.liveEditable&&target.fingerprint&&target.fieldIdentity&&Number.isInteger(target.selectionStart)&&target.selectionStart>=0&&Number.isInteger(target.selectionLength)&&target.selectionLength>=0);}
