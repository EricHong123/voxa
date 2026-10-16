import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
export const draftHash=text=>createHash('sha256').update(text.replace(/\r\n?/g,'\n').trim()).digest('hex');
// Only a trailing command in the original ASR text can authorize Enter.
export function splitEnterCommand(original,enabled){
 if(!enabled)return {text:original,confirmEnter:false};
 const match=original.match(/(?:确认发送|確認發送)[。.!！?？\s]*$/u);
 if(!match)return {text:original,confirmEnter:false};
 const prefix=original.slice(0,match.index);
 if(/(?:不要|不用|不必|别|別|取消|不需要)\s*$/u.test(prefix))return {text:original,confirmEnter:false};
 const text=prefix.replace(/[，,、；;：:\s]+$/u,'').trim();
 if(!text)throw new Error('请先说消息内容，再在末尾说“确认发送”。');
 return {text,confirmEnter:true};
}
export async function pressEnterAfterPaste({target,text,native,signal}){
 signal.throwIfAborted();
 if(!target?.fieldIdentity||!target.editable)throw new Error('无法确认目标输入框，文字已保留，请手动按回车。');
 const expected=draftHash(text);
 for(let i=0;i<10;i++){
  signal.throwIfAborted();
  const current=await native('context');
  signal.throwIfAborted();
  if(current.pid!==target.pid||current.fieldIdentity!==target.fieldIdentity)throw new Error('输入位置已改变，没有按回车。');
  if(current.editable&&current.draftHash===expected){
   const result=await native('enter',String(target.pid),target.fieldIdentity,expected);
   if(!result.ok)throw new Error(result.message||'未能按回车，请手动确认。');
   return '已填入并按下 Enter，请在目标软件确认发送结果。';
  }
  await delay(100,undefined,{signal});
 }
 throw new Error('无法核对输入框全文，或其中还有其他文字；没有按回车，请手动确认。');
}

// Missing AX data is not evidence that the user moved the caret.
export function targetProblem(target){
 if(target?.status==='permission-denied')return 'Voxa 的辅助功能权限未生效，请在系统设置中重新授权。';
 if(target?.status==='secure-field')return '当前是密码等受保护输入框，无法自动填入。';
 if(target?.status==='not-editable')return '当前没有聚焦文字输入框；请先切回键盘输入模式，并点击输入框后重试。';
 if(!target?.fingerprint)return '无法读取目标输入框；请先点击文字输入框后重试。若仍失败，请复制结果粘贴。';
 return '';
}
export function pasteProblem(target,current){
 const problem=targetProblem(target)||targetProblem(current);
 if(problem)return problem;
 if(current.pid!==target.pid)return '前台软件已切换，未自动写入。请复制结果。';
 if(current.fingerprint!==target.fingerprint)return '输入位置或文字已变化，未自动写入。请复制结果。';
 return '';
}

export async function verifyPaste({target,expectedHash,native,signal}){
 if(!expectedHash)return false;
 for(let i=0;i<12;i++){
  signal.throwIfAborted();
  const current=await native('context');
  signal.throwIfAborted();
  if(current.pid!==target.pid||current.fieldIdentity!==target.fieldIdentity)return false;
  if(current.editable&&current.draftHash===expectedHash)return true;
  await delay(100,undefined,{signal});
 }
 return false;
}
