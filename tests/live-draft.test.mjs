import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveDraft,canStream} from '../electron/live-draft.mjs';
import {draftHash} from '../electron/delivery.mjs';
function fixture(){
 let body='原有🙂文字｜替换这里｜保留结尾';const start=body.indexOf('替换'),length='替换这里'.length;
 let context={pid:123,fieldIdentity:'field',fingerprint:'initial',selectionStart:start,selectionLength:length,liveEditable:true};
 const writes=[];let revision=0;
 const controller=new AbortController();
 const native=async()=>({...context});
 const replace=async request=>{
  writes.push(request);
  assert.equal(request.fingerprint,context.fingerprint);
  body=body.slice(0,request.start)+request.text+body.slice(request.start+request.length);
  context={...context,fingerprint:`v${++revision}`,draftHash:draftHash(body),selectionStart:request.start+request.text.length,selectionLength:0};
  return {ok:true,expectedDraftHash:draftHash(body)};
 };
 const draft=new LiveDraft({...context},{native,replace,signal:controller.signal});
 return {draft,writes,controller,body:()=>body,change:patch=>Object.assign(context,patch),initial:()=>({...context})};
}
test('streaming revisions replace only the owned UTF-16 span and preserve surrounding text',async()=>{
 const f=fixture();assert.equal(canStream(f.initial()),true);
 await f.draft.update('明天开会');await f.draft.update('明天九点开会🙂。');await f.draft.update('明天十点开会。');
 assert.equal(f.body(),'原有🙂文字｜明天十点开会。｜保留结尾');
 assert.equal(f.writes[0].length,4);assert.equal(f.writes[2].length,'明天九点开会🙂。'.length);
 await f.draft.update('明天十点开会。');assert.equal(f.writes.length,3);
});
test('overlapping preview and final revisions are applied in order, without duplicate append',async()=>{
 const f=fixture();await Promise.all([f.draft.update('你好'),f.draft.update('你好世界'),f.draft.update('你好，世界。')]);
 assert.equal(f.body(),'原有🙂文字｜你好，世界。｜保留结尾');assert.equal(f.writes.length,3);
});
test('manual editing, caret movement or focus changes stop further writes, including final rewrite',async()=>{
 for(const patch of [{fingerprint:'manual-edit'},{fingerprint:'caret-moved'},{pid:456},{fieldIdentity:'other'}]){
  const f=fixture();await f.draft.update('初稿');f.change(patch);
  await assert.rejects(f.draft.update('修改稿'),/暂停/);
  await assert.rejects(f.draft.update('最终稿'),/暂停/);
  assert.equal(f.writes.length,1);
 }
});
test('cancellation preserves already inserted text and prohibits subsequent writes',async()=>{
 const f=fixture();await f.draft.update('保留草稿');f.controller.abort();
 await assert.rejects(f.draft.update('不应写入'));assert.equal(f.writes.length,1);
 assert.equal(f.body(),'原有🙂文字｜保留草稿｜保留结尾');
});
test('unsupported controls cannot enable live editing; failed updates stay blocked',async()=>{
 assert.equal(canStream({liveEditable:true,selectionStart:0,selectionLength:0}),false);
 const f=fixture();f.draft.replace=async()=>({ok:false,message:'更新被拒绝'});
 await assert.rejects(f.draft.update('文本'),/拒绝/);
 await assert.rejects(f.draft.update('再试'),/拒绝/);
 assert.equal(f.body(),'原有🙂文字｜替换这里｜保留结尾');
});
