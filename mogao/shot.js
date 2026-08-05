#!/usr/bin/env node
/* 自检脚本：打开成品页，逐时间点截图，收集控制台错误 */
const puppeteer = require('/Users/sniper/node_modules/puppeteer');
const path = require('path');
const fs = require('fs');

const FILE = 'file://' + path.resolve(process.argv[2] || '/Users/sniper/Desktop/temp/敦煌莫高窟大佛建造全过程.html');
const OUTDIR = process.argv[3] || '/private/tmp/claude-502/-Users-sniper-Desktop-temp/cb5b5895-3ce2-4022-918f-8609eb52a792/scratchpad/shots';
const TIMES = process.argv[4]
  ? process.argv[4].split(',').map(Number)
  : [1, 4, 8, 13, 17, 21, 26, 28, 33, 35, 41, 45, 49, 53, 57, 60, 64, 69, 74, 79, 84, 88, 91, 94, 97, 104, 107, 110, 114];

fs.mkdirSync(OUTDIR, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--enable-unsafe-swiftshader',
      '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist',
      '--no-sandbox', '--disable-dev-shm-usage',
      '--allow-file-access-from-files',
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`));

  await page.goto(FILE, { waitUntil: 'load', timeout: 120000 });

  try {
    await page.waitForFunction('window.__READY__ === true', { timeout: 180000 });
  } catch (e) {
    const txt = await page.$eval('#ltxt', el => el.textContent).catch(() => '?');
    console.log('!! 初始化未完成，loading 文本 =', txt);
    console.log(logs.join('\n'));
    await page.screenshot({ path: path.join(OUTDIR, 'FAIL.png') });
    await browser.close();
    process.exit(1);
  }

  const stats = await page.evaluate(() => { window.MOGAO.seek(1); return null; });
  await new Promise(r => setTimeout(r, 600));

  for (const t of TIMES) {
    await page.evaluate((tt) => window.MOGAO.seek(tt), t);
    await new Promise(r => setTimeout(r, 260));
    const name = 't' + String(t).padStart(3, '0') + '.png';
    await page.screenshot({ path: path.join(OUTDIR, name) });
    process.stdout.write(t + ' ');
  }
  console.log('');

  const st = await page.evaluate(() => window.MOGAO.stats());
  console.log('渲染统计:', JSON.stringify(st));

  const errs = logs.filter(l => /error|pageerror|warn/i.test(l));
  if (errs.length) {
    console.log('--- 控制台 ---');
    console.log([...new Set(errs)].slice(0, 40).join('\n'));
  } else {
    console.log('控制台无错误');
  }

  await browser.close();
})();
