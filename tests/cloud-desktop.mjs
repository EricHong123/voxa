import {_electron as electron,expect} from '@playwright/test';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const directory=await mkdtemp(path.join(tmpdir(),'voxa-cloud-ui-'));
let app;
try{
 app=await electron.launch({args:['.'],env:{...process.env,VOICELEAF_DATA_DIR:directory,VOICELEAF_TEST:'1'}});
 await expect.poll(()=>app.windows().some(p=>p.url().endsWith('index.html'))).toBe(true);
 const page=app.windows().find(p=>p.url().endsWith('index.html')),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.getByRole('button',{name:'设置',exact:true}).click();
 await page.getByLabel('文字服务',{exact:true}).selectOption('qwen');
 await expect(page.getByLabel('文字 Base URL')).toHaveValue('https://dashscope.aliyuncs.com/compatible-mode/v1');
 await page.getByLabel('云端文字模型名称').fill('test-model');
 await expect(page.getByRole('button',{name:'测试连接',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'保存设置'}).click();
 await expect(page.getByRole('status')).toHaveText('设置已保存');
 let r=await page.evaluate(()=>window.voiceleaf.read());expect(r.value.settings.rewriteProvider).toBe('openai');expect(r.value.settings.asrProvider).toBe('local');
 for(const preset of ['deepseek','zhipu','kimi','doubao','siliconflow','minimax','anthropic','gemini']){
  await page.getByLabel('文字服务',{exact:true}).selectOption(preset);
  await expect(page.getByLabel('文字 Base URL')).not.toHaveValue('');
 }
 await page.getByLabel('文字服务',{exact:true}).selectOption('deepseek');await page.getByLabel('云端文字模型名称').fill('test-model');
 await page.getByLabel('识别服务',{exact:true}).selectOption('siliconflow');
 await expect(page.getByLabel('语音模型名称')).toHaveValue('FunAudioLLM/SenseVoiceSmall');
 await page.getByRole('button',{name:'保存设置'}).click();
 r=await page.evaluate(()=>window.voiceleaf.read());expect(r.value.settings.asrProvider).toBe('openai');
 // Never save real credentials or make external requests in this UI test.
 const denied=await app.evaluate(async({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('#hud'));return w.webContents.executeJavaScript('window.voiceleaf.credentialStatus({}).then(()=>false,()=>true)');});expect(denied).toBe(true);
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/cloud-settings.png',fullPage:true});
 await page.getByLabel('识别服务',{exact:true}).selectOption('local');await page.getByLabel('文字服务',{exact:true}).selectOption('local');await page.getByRole('button',{name:'保存设置'}).click();
 r=await page.evaluate(()=>window.voiceleaf.read());expect(r.value.settings.asrProvider).toBe('local');expect(r.value.settings.rewriteProvider).toBe('local');expect(errors).toEqual([]);
 console.log('Cloud UI passed: domestic presets, independent routes, persistence, local fallback, missing-key guard, HUD credential isolation. No external requests.');
}finally{await app?.close();await rm(directory,{recursive:true,force:true});}
