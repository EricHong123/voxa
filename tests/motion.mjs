import {_electron as electron, expect} from '@playwright/test';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const directory = await mkdtemp(path.join(tmpdir(), 'voxa-motion-'));
const frames = 'artifacts/motion-frames';
await rm(frames, {recursive: true, force: true});
await mkdir(frames, {recursive: true});
let app;
try {
  app = await electron.launch({args: ['.'], env: {...process.env, VOICELEAF_DATA_DIR: directory, VOICELEAF_TEST: '1'}});
  await expect.poll(() => app.windows().some(p => p.url().endsWith('index.html'))).toBe(true);
  const page = app.windows().find(p => p.url().endsWith('index.html'));
  const hud = app.windows().find(p => p.url().endsWith('#hud'));
  const errors = [];
  for (const window of [page, hud]) window.on('pageerror', e => errors.push(e.message));
  const emit = events => app.evaluate(({BrowserWindow}, events) => {
    const win = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('#hud'));
    for (const event of events) win.webContents.send('voiceleaf:event', event);
  }, events);
  // Reduced motion must retain controls, final text, and switch position.
  for (const window of [page, hud]) {
    await window.emulateMedia({reducedMotion: 'reduce'});
    await window.reload();
  }
  await expect(page.getByRole('heading', {name: '让想法，自然流动。'})).toBeVisible();
  await page.locator('.feature').first().hover();
  await expect.poll(() => page.locator('.feature').first().evaluate(el => getComputedStyle(el).transform)).toBe('none');
  await page.getByRole('button', {name: '设置', exact: true}).click();
  const toggle = page.getByRole('switch', {name: '智能整理', exact: true});
  await toggle.focus(); await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => toggle.locator('span').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m41)).toBe(14);
  await emit([{type:'phase',phase:'recording'},{type:'preview',text:'这是一段测试文字。'}]);
  await expect(hud.getByRole('status')).toHaveText('正在聆听');
  await expect(hud.getByRole('button', {name:'停止录音'})).toBeEnabled();
  expect(await hud.locator('.listening-bars i').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await emit([{type:'phase',phase:'polishing'}]);
  await expect(hud.getByRole('status')).toHaveText('正在整理');
  expect(await hud.locator('.hud').evaluate(el => getComputedStyle(el,'::after').animationName)).toBe('none');
  await emit([{type:'revision',value:{original:'嗯，测试文字。',text:'测试文字。'}},{type:'phase',phase:'idle'}]);
  await expect(hud.locator('.hud-preview')).toHaveText('测试文字。');

  // Capture a synthetic UI sequence. This is not an ASR or app-delivery benchmark.
  await hud.emulateMedia({reducedMotion:'no-preference'}); await hud.reload();
  await expect(hud.getByRole('status')).toHaveText('已结束');
  // Reserve the largest demo size so frames have identical dimensions.
  await emit([{type:'hud-notice',message:'界面演示 · 示例文字，不是实测识别速度',canCopy:false},
    {type:'target',name:'示例输入框',ready:true},{type:'phase',phase:'recording'}]);
  await expect.poll(() => hud.evaluate(() => innerHeight)).toBe(268);
  let frame = 0;
  const capture = async count => {
    for (let i=0; i<count; i++) {
      await hud.screenshot({path: `${frames}/${String(frame++).padStart(3,'0')}.png`});
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };
  await capture(10);
  for (const text of ['嗯，那个，','嗯，那个，明天九点开会，','嗯，那个，明天九点开会，我们讨论新方案。']) {
    await emit([{type:'preview',text}]); await capture(10);
  }
  await emit([{type:'phase',phase:'polishing'}]); await capture(12);
  await emit([{type:'revision',value:{original:'嗯，那个，明天九点开会，我们讨论新方案。',text:'明天九点开会，讨论新方案。'}}]);
  await capture(10);
  await emit([{type:'phase',phase:'idle'},{type:'hud-notice',status:'inserted',message:'界面演示 · 示例成功状态，未向其他软件写入',canCopy:true}]);
  await capture(18);
  expect(errors).toEqual([]);
  await writeFile('artifacts/motion-results.json', JSON.stringify({passed:true, reducedMotion:true, keyboardSwitch:true, rendererErrors:errors, syntheticDemoFrames:frame},null,2));
  console.log('Motion passed: reduced motion, keyboard switches, readable revisions, immediate controls; synthetic demo captured.');
} finally {
  await app?.close(); await rm(directory,{recursive:true,force:true});
}
