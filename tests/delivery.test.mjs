import test from 'node:test';
import assert from 'node:assert/strict';
import {splitEnterCommand,pressEnterAfterPaste,draftHash,targetProblem,pasteProblem,verifyPaste} from '../electron/delivery.mjs';
test('Enter is authorized only by an enabled trailing ASR command, stripped before rewriting',()=>{
 assert.deepEqual(splitEnterCommand('明天九点开会，确认发送。',true),{text:'明天九点开会',confirmEnter:true});
 assert.equal(splitEnterCommand('明天見，確認發送！',true).confirmEnter,true);
 for(const text of ['确认发送以后告诉我','明天开会，不要确认发送','不用确认发送','你说的是“确认发送”'])assert.equal(splitEnterCommand(text,true).confirmEnter,false);
 assert.equal(splitEnterCommand('明天见，确认发送',false).confirmEnter,false);
 assert.throws(()=>splitEnterCommand('确认发送。',true),/先说消息内容/);
});
const target={pid:123,fieldIdentity:'field-A',editable:true};
test('post-paste Enter requires exact full draft and original focused field',async()=>{
 const calls=[];
 const native=async(name,...args)=>{calls.push([name,...args]);return name==='context'?{...target,draftHash:draftHash('明天见')}:{ok:true};};
 const result=await pressEnterAfterPaste({target,text:'明天见',native,signal:new AbortController().signal});
 assert.match(result,/按下 Enter/);
 assert.deepEqual(calls[1],['enter','123','field-A',draftHash('明天见')]);
});
test('focus change, cancellation, unreadable field and native rejection cannot silently send',async()=>{
 let enterCalls=0;
 const native=async name=>{if(name==='enter')enterCalls++;return {...target,fieldIdentity:'different',draftHash:draftHash('明天见')};};
 await assert.rejects(pressEnterAfterPaste({target,text:'明天见',native,signal:new AbortController().signal}),/位置已改变/);
 const controller=new AbortController();controller.abort();
 await assert.rejects(pressEnterAfterPaste({target,text:'明天见',native,signal:controller.signal}));
 await assert.rejects(pressEnterAfterPaste({target:{...target,editable:false},text:'明天见',native,signal:new AbortController().signal}),/无法确认/);
 assert.equal(enterCalls,0);
 await assert.rejects(pressEnterAfterPaste({target,text:'明天见',native:async name=>name==='context'?{...target,draftHash:draftHash('明天见')}:{ok:false,message:'权限失效'},signal:new AbortController().signal}),/权限失效/);
});
test('existing draft content prevents Enter even if pasted text is included',async()=>{
 let sent=false;
 const native=async name=>{if(name==='enter')sent=true;return {...target,draftHash:draftHash('旧草稿 明天见')};};
 await assert.rejects(pressEnterAfterPaste({target,text:'明天见',native,signal:new AbortController().signal}),/无法核对/);
 assert.equal(sent,false);
});

test('missing accessibility focus is distinguished from a changed draft',()=>{
 const ready={pid:123,fingerprint:'same',status:'ready'};
 assert.match(targetProblem({status:'permission-denied'}),/权限/);
 assert.match(targetProblem({status:'not-editable'}),/键盘输入模式/);
 assert.match(pasteProblem({pid:123,fingerprint:''},ready),/无法读取/);
 assert.match(pasteProblem(ready,{...ready,pid:124}),/软件已切换/);
 assert.match(pasteProblem(ready,{...ready,fingerprint:'changed'}),/文字已变化/);
 assert.equal(pasteProblem(ready,ready),'');
});

test('paste success requires the expected full value in the same field',async()=>{
 const signal=new AbortController().signal;
 let reads=0;
 assert.equal(await verifyPaste({target,expectedHash:'new',signal,native:async()=>({...target,draftHash:++reads===1?'old':'new'})}),true);
 assert.equal(await verifyPaste({target,expectedHash:'new',signal,native:async()=>({...target,fieldIdentity:'other',draftHash:'new'})}),false);
 assert.equal(await verifyPaste({target,signal,native:async()=>{throw Error('must not read');}}),false);
});
