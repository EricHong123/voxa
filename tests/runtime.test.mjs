import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveRuntime} from '../electron/runtime.mjs';

test('packaged model runtime is resolved inside the relocated application, without Homebrew',()=>{
 const requested=[];
 const actual=resolveRuntime('whisper-server',{packaged:true,resourcesPath:'/Applications/Voxa.app/Contents/Resources',exists:p=>{requested.push(p);return true;}});
 assert.equal(actual,'/Applications/Voxa.app/Contents/Resources/runtime/whisper-server');
 assert.deepEqual(requested,[actual]);
});
test('incomplete package fails instead of falling back to a machine-specific executable',()=>{
 const requested=[];
 assert.throws(()=>resolveRuntime('llama-server',{packaged:true,resourcesPath:'/tmp/Voxa.app/Contents/Resources',exists:p=>{requested.push(p);return p.startsWith('/opt/homebrew');}}),/安装包缺少/);
 assert.equal(requested.length,1);
});
test('source development keeps supported Homebrew paths and rejects arbitrary commands',()=>{
 assert.equal(resolveRuntime('llama-server',{packaged:false,exists:p=>p.startsWith('/usr/local')}),'/usr/local/bin/llama-server');
 assert.throws(()=>resolveRuntime('../bin/sh',{packaged:true,resourcesPath:'/tmp',exists:()=>true}),/Unsupported/);
});
