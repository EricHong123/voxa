import test from 'node:test';
import assert from 'node:assert/strict';
import {revisionParts,shouldFinish} from '../src/revision.mjs';
test('revision preserves both original and final Chinese text including fillers and repeated words',()=>{
 for(const [a,b] of [['嗯，那个，明天明天开会。','明天开会。'],['请星期一开会','请星期二开会'],['','你好'],['测试',''],['🙂 好','🙂 好']]){
  const parts=revisionParts(a,b);
  assert.equal(parts.filter(p=>p.kind!=='insert').map(p=>p.text).join(''),a);
  assert.equal(parts.filter(p=>p.kind!=='delete').map(p=>p.text).join(''),b);
 }
 assert.ok(revisionParts('嗯，明天开会','明天开会').some(p=>p.kind==='delete'&&p.text==='嗯，'));
});
test('silence only finishes after meaningful speech and a 2.5 second pause',()=>{
 assert.equal(shouldFinish(0,0,10000),false);
 assert.equal(shouldFinish(239,0,3000),false);
 assert.equal(shouldFinish(300,1000,3499),false);
 assert.equal(shouldFinish(300,1000,3500),true);
});
