import {_electron as electron,expect} from '@playwright/test';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const dir=await mkdtemp(path.join(tmpdir(),'voiceleaf-package-'));
let app;
try{
 app=await electron.launch({executablePath:path.resolve('release/mac-arm64/Voxa.app/Contents/MacOS/Voxa'),args:[],env:{...process.env,VOICELEAF_DATA_DIR:dir,VOICELEAF_TEST:'1'}});
 await expect.poll(()=>app.windows().some(p=>p.url().endsWith('index.html')),{timeout:15000}).toBe(true);
 const page=app.windows().find(p=>p.url().endsWith('index.html'));await expect(page.getByRole('heading',{name:'让想法，自然流动。'})).toBeVisible();
 const state=await page.evaluate(()=>window.voiceleaf.read());expect(state.value.settings.whisperModelPath).toContain('Voxa.app/Contents/Resources/models/');expect(state.value.settings.rewriteModelPath).toContain('Voxa.app/Contents/Resources/models/');
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('button',{name:'启动已保存的模型',exact:true}).click();await expect(page.locator('.connection.connected')).toHaveCount(2,{timeout:60000});
 await page.getByRole('button',{name:'首页',exact:true}).click();await page.screenshot({path:'artifacts/voiceleaf-ready.png',fullPage:true});
 await writeFile('artifacts/packaged-results.json',JSON.stringify({passed:true,modelPaths:state.value.settings.whisperModelPath,health:await page.evaluate(()=>window.voiceleaf.health())},null,2));
 console.log('Packaged .app passed: app load, bundled model files, both inference servers ready.');
}finally{await app?.close();await rm(dir,{recursive:true,force:true});}
