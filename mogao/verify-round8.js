#!/usr/bin/env node
/* Independent Round 8 gate: default pause, chapter boundary, narrow DPR2 framing, and offline safety. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let puppeteer;
for (const candidate of [process.env.PUPPETEER_MODULE, '/Users/sniper/node_modules/puppeteer', 'puppeteer'].filter(Boolean)) {
  try { puppeteer = require(candidate); break; } catch (_) {}
}
if (!puppeteer) throw new Error('Puppeteer not found');

const input = path.resolve(process.argv[2]);
const outDir = path.resolve(process.argv[3]);
fs.mkdirSync(outDir, { recursive: true });
const report = {
  input,
  inputBytes: fs.statSync(input).size,
  inputSha256: crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'),
  viewport: { width: 604, height: 816, deviceScaleFactor: 2 },
  checks: {},
  remoteRequests: [],
  pageErrors: [],
  console: [],
};

function check(name, condition, detail) {
  report.checks[name] = { pass: Boolean(condition), detail };
  if (!condition) throw new Error(`${name}: ${JSON.stringify(detail)}`);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage',
      '--allow-file-access-from-files',
    ],
  });
  const page = await browser.newPage();
  await page.setViewport(report.viewport);
  page.on('request', (req) => { if (/^https?:/i.test(req.url())) report.remoteRequests.push(req.url()); });
  page.on('pageerror', (err) => report.pageErrors.push(err.message));
  page.on('console', (msg) => report.console.push({ type: msg.type(), text: msg.text() }));

  try {
    await page.goto(`file://${input}`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction('window.__READY__ === true', { timeout: 180000 });
    await new Promise((resolve) => setTimeout(resolve, 900));

    const initial = await page.evaluate(() => ({
      time: window.MOGAO.APP.time,
      playing: window.MOGAO.APP.playing,
      stage: (() => { const r = document.querySelector('#stage').getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height }; })(),
      canvas: (() => { const r = document.querySelector('#c').getBoundingClientRect(); return { width:r.width, height:r.height }; })(),
      viewport: [innerWidth, innerHeight, devicePixelRatio],
      scrollWidth: document.documentElement.scrollWidth,
      chapterCount: document.querySelectorAll('#chapters button').length,
    }));
    check('default-t000-paused', initial.time === 0 && initial.playing === false, initial);
    check('viewport-604x816-dpr2', initial.viewport[0] === 604 && initial.viewport[1] === 816 && initial.viewport[2] === 2, initial.viewport);
    check('canvas-16x9', Math.abs(initial.canvas.height - initial.canvas.width * 9 / 16) < 1.5, initial.canvas);
    check('canvas-fills-viewport-width', Math.abs(initial.canvas.width - initial.stage.width) < 1, { stage: initial.stage, canvas: initial.canvas });
    check('no-horizontal-page-overflow', initial.scrollWidth <= 604, initial.scrollWidth);
    check('sixteen-chapters', initial.chapterCount === 16, initial.chapterCount);
    check('offline-no-remote-requests', report.remoteRequests.length === 0, report.remoteRequests);

    const openingFile = path.join(outDir, 't000-604x816-dpr2.png');
    await page.screenshot({ path: openingFile });
    report.openingScreenshot = {
      file: path.basename(openingFile),
      bytes: fs.statSync(openingFile).size,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(openingFile)).digest('hex'),
    };

    const boundary = await page.evaluate(() => {
      const launched = window.MOGAO.playChapter(0);
      window.MOGAO.tick(16);
      return { launched, time: window.MOGAO.APP.time, playing: window.MOGAO.APP.playing, playUntil: window.MOGAO.APP.playUntil };
    });
    check('chapter-stops-before-next', boundary.playing === false && boundary.playUntil === null && Math.abs(boundary.time - (15.2 - 1/60)) < 0.002, boundary);

    await page.evaluate(() => window.MOGAO.seek(116));
    await new Promise((resolve) => setTimeout(resolve, 260));
    const endingFile = path.join(outDir, 't116-604x816-dpr2.png');
    await page.screenshot({ path: endingFile });
    report.endingScreenshot = {
      file: path.basename(endingFile),
      bytes: fs.statSync(endingFile).size,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(endingFile)).digest('hex'),
    };

    check('no-page-errors', report.pageErrors.length === 0, report.pageErrors);
    report.pass = Object.values(report.checks).every((entry) => entry.pass);
  } catch (error) {
    report.pass = false;
    report.error = error.stack || String(error);
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    await browser.close();
  }

  process.stdout.write(JSON.stringify({ pass: report.pass, checks: report.checks, report: path.join(outDir, 'report.json') }, null, 2) + '\n');
  if (!report.pass) process.exit(1);
})();
