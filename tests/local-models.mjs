import {_electron as electron,expect} from '@playwright/test';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const dir=await mkdtemp(path.join(tmpdir(),'voiceleaf-models-'));
let app;
try{
 app=await electron.launch({args:['.'],env:{...process.env,VOICELEAF_DATA_DIR:dir,VOICELEAF_TEST:'1'}});
 await expect.poll(()=>app.windows().some(p=>p.url().endsWith('index.html')),{timeout:15000}).toBe(true);
 const page=app.windows().find(p=>p.url().endsWith('index.html'));await expect(page.getByRole('heading',{name:'让想法，自然流动。'})).toBeVisible();
 const start=await page.evaluate(()=>window.voiceleaf.startModels());console.log('Models:',start);expect(start.ok).toBe(true);expect(start.value).toEqual({whisper:true,rewrite:true});
 const wav=await readFile('artifacts/test-speech.wav');const time=Date.now();
 const result=await page.evaluate(bytes=>window.voiceleaf.process(Uint8Array.from(bytes).buffer),[...wav]);console.log('Inference:',result,'elapsed ms',Date.now()-time);
 expect(result.ok).toBe(true);expect(result.value.warning).toBe('');expect(result.value.original.toLowerCase()).toContain('project');expect(result.value.text.length).toBeGreaterThan(15);
 await expect(page.locator('.result-card')).toBeVisible();await page.screenshot({path:'artifacts/local-result.png',fullPage:true});
 const state=await page.evaluate(()=>window.voiceleaf.read());expect(state.value.history).toHaveLength(1);
 await page.evaluate(()=>window.voiceleaf.settings({mode:'translate',targetLanguage:'简体中文'}));
 const translation=await page.evaluate(bytes=>window.voiceleaf.process(Uint8Array.from(bytes).buffer),[...wav]);
 expect(translation.ok).toBe(true);expect(translation.value.warning).toBe('');expect(translation.value.text).toMatch(/[\u4e00-\u9fff]/);
 console.log('Local translation:',translation.value.text);
 await writeFile('artifacts/local-model-results.json',JSON.stringify({passed:true,result:result.value,translation:translation.value,elapsedMs:Date.now()-time},null,2));
 console.log('Real local Whisper + Qwen end-to-end passed.');
}finally{await app?.close();await rm(dir,{recursive:true,force:true});}
