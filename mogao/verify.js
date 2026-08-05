#!/usr/bin/env node
/* 独立验收：离线性、初始化、关键帧、章节交互、播放控制与响应式。 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let puppeteer;
for (const candidate of [
  process.env.PUPPETEER_MODULE,
  '/Users/sniper/node_modules/puppeteer',
  'puppeteer',
].filter(Boolean)) {
  try { puppeteer = require(candidate); break; } catch (_) {}
}
if (!puppeteer) {
  console.error('找不到 Puppeteer。可通过 PUPPETEER_MODULE 指定模块路径。');
  process.exit(2);
}

const input = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const outDir = path.resolve(process.argv[3] || path.join(__dirname, '..', 'artifacts', 'verification'));
const keyTimes = [0, 20, 25, 33, 40, 49, 60, 65, 70, 79, 86, 92, 101, 106, 112, 116];
fs.mkdirSync(outDir, { recursive: true });

const report = {
  input,
  inputBytes: fs.statSync(input).size,
  inputSha256: crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'),
  startedAt: new Date().toISOString(),
  checks: {},
  keyframes: [],
  initialPreview: null,
  console: [],
  pageErrors: [],
  remoteRequests: [],
};

function assert(name, condition, detail) {
  report.checks[name] = { pass: !!condition, detail };
  if (!condition) throw new Error(`${name}: ${detail}`);
}

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
  await page.setViewport({ width: 760, height: 1340, deviceScaleFactor: 1 });
  page.on('console', (m) => report.console.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => report.pageErrors.push(e.message));
  page.on('request', (req) => {
    const u = req.url();
    if (/^https?:/i.test(u)) report.remoteRequests.push(u);
  });

  try {
    await page.goto(`file://${input}`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction('window.__READY__ === true', { timeout: 180000 });
    assert('ready-hook', await page.evaluate(() => window.__READY__ === true), 'window.__READY__ 必须为 true');
    const initialState = await page.evaluate(() => ({
      time: window.MOGAO.APP.time,
      playing: window.MOGAO.APP.playing,
      initialPreview: window.MOGAO.APP.initialPreview,
      playIcon: document.querySelector('#play')?.textContent,
    }));
    assert(
      'initial-buddha-preview-paused',
      Math.abs(initialState.time - 2.5) < 0.001
        && initialState.playing === false
        && initialState.initialPreview === true
        && initialState.playIcon === '▶',
      initialState
    );
    const initialPreviewFile = path.join(outDir, 'initial-buddha-preview.png');
    await page.screenshot({ path: initialPreviewFile });
    report.initialPreview = {
      ...initialState,
      file: path.basename(initialPreviewFile),
      sha256: crypto.createHash('sha256').update(fs.readFileSync(initialPreviewFile)).digest('hex'),
    };

    const firstPlay = await page.evaluate(() => {
      document.querySelector('#play').click();
      return {
        time: window.MOGAO.APP.time,
        playing: window.MOGAO.APP.playing,
        initialPreview: window.MOGAO.APP.initialPreview,
      };
    });
    assert(
      'initial-preview-play-restarts-chapter-one',
      firstPlay.time < 0.05 && firstPlay.playing === true && firstPlay.initialPreview === false,
      firstPlay
    );
    await page.evaluate(() => window.MOGAO.pause());
    assert('no-video-element', await page.evaluate(() => document.querySelectorAll('video').length === 0), '不得嵌入 video');
    assert('no-remote-requests', report.remoteRequests.length === 0, report.remoteRequests);

    const chapterCount = await page.evaluate(() => document.querySelectorAll('#chapters button').length);
    assert('chapter-count', chapterCount === 16, `期望 16，实际 ${chapterCount}`);

    for (const t of keyTimes) {
      await page.evaluate((time) => window.MOGAO.seek(time), t);
      await new Promise((r) => setTimeout(r, 180));
      const name = `t${String(t).padStart(3, '0')}.png`;
      const file = path.join(outDir, name);
      await page.screenshot({ path: file });
      const state = await page.evaluate(() => ({
        time: window.MOGAO.APP.time,
        stats: window.MOGAO.stats(),
        subtitle: document.querySelector('#sub')?.textContent || '',
      }));
      report.keyframes.push({
        requestedTime: t,
        actualTime: state.time,
        subtitle: state.subtitle,
        stats: state.stats,
        file: name,
        sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
      });
    }
    assert('keyframe-count', report.keyframes.length === keyTimes.length, report.keyframes.length);

    const boundaryState = await page.evaluate(() => {
      const chapter = window.MOGAO.playChapter(2);
      window.MOGAO.tick(chapter.until - chapter.from + 1);
      return {
        time: window.MOGAO.APP.time,
        playing: window.MOGAO.APP.playing,
        playUntil: window.MOGAO.APP.playUntil,
        expectedStop: chapter.until - 1 / 60,
      };
    });
    assert(
      'chapter-stops-at-next-boundary',
      boundaryState.playing === false
        && boundaryState.playUntil == null
        && Math.abs(boundaryState.time - boundaryState.expectedStop) < 0.002,
      boundaryState
    );

    await page.evaluate(() => {
      window.MOGAO.APP.playing = false;
      window.MOGAO.APP.time = 0;
      document.querySelectorAll('#chapters button')[2].click();
    });
    await new Promise((r) => setTimeout(r, 900));
    const afterChapter = await page.evaluate(() => ({
      time: window.MOGAO.APP.time,
      playing: window.MOGAO.APP.playing,
    }));
    assert('chapter-seek-and-play', afterChapter.time >= 20.1 && afterChapter.playing === true, afterChapter);

    await page.click('#play');
    const pausedState = await page.evaluate(() => window.MOGAO.APP.playing);
    await page.click('#play');
    const resumedState = await page.evaluate(() => window.MOGAO.APP.playing);
    assert('play-pause-toggle', pausedState !== resumedState, { pausedState, resumedState });

    await page.select('#speed', '2');
    assert('speed-control', await page.evaluate(() => window.MOGAO.APP.speed === 2), 'APP.speed 应为 2');
    // The compact layout intentionally hides secondary controls at <= 760px.
    // Switch to a desktop viewport before testing the visible free-camera button.
    await page.setViewport({ width: 900, height: 900, deviceScaleFactor: 1 });
    await page.click('#freebtn');
    assert('free-camera-toggle', await page.evaluate(() => window.MOGAO.APP.free === true), '自由视角应开启');

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await page.evaluate(() => dispatchEvent(new Event('resize')));
    await page.waitForFunction(() => {
      const c = document.querySelector('#c').getBoundingClientRect();
      return c.width <= innerWidth + 0.1 && c.height <= innerHeight + 0.1 && c.width > 200;
    }, { timeout: 5000 });
    const mobile = await page.evaluate(() => {
      const c = document.querySelector('#c').getBoundingClientRect();
      return { width: c.width, height: c.height, viewport: [innerWidth, innerHeight] };
    });
    assert('mobile-fit', mobile.width <= 390.1 && mobile.height <= 844.1 && mobile.width > 200, mobile);

    await page.setViewport({ width: 604, height: 816, deviceScaleFactor: 2 });
    await page.evaluate(() => dispatchEvent(new Event('resize')));
    await page.waitForFunction(() => {
      const c = document.querySelector('#c').getBoundingClientRect();
      const canvas = document.querySelector('#c');
      return c.width <= innerWidth + 0.1
        && c.height <= innerHeight + 0.1
        && c.width > 300
        && canvas.width > c.width
        && canvas.height > c.height;
    }, { timeout: 5000 });
    const narrowDpr2 = await page.evaluate(() => {
      const c = document.querySelector('#c').getBoundingClientRect();
      return {
        cssWidth: c.width,
        cssHeight: c.height,
        backingWidth: document.querySelector('#c').width,
        backingHeight: document.querySelector('#c').height,
        viewport: [innerWidth, innerHeight],
        dpr: devicePixelRatio,
      };
    });
    assert(
      'narrow-dpr2-fit',
      narrowDpr2.cssWidth <= 604.1
        && narrowDpr2.cssHeight <= 816.1
        && narrowDpr2.cssWidth > 300
        && narrowDpr2.backingWidth > narrowDpr2.cssWidth
        && narrowDpr2.backingHeight > narrowDpr2.cssHeight,
      narrowDpr2
    );
    await page.screenshot({ path: path.join(outDir, 'narrow-604x816-dpr2.png') });

    assert('no-page-errors', report.pageErrors.length === 0, report.pageErrors);
    report.finishedAt = new Date().toISOString();
    report.pass = Object.values(report.checks).every((x) => x.pass);
  } catch (error) {
    report.finishedAt = new Date().toISOString();
    report.pass = false;
    report.fatal = error.stack || error.message;
  } finally {
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close();
    console.log(JSON.stringify({
      pass: report.pass,
      checks: report.checks,
      keyframes: report.keyframes.length,
      report: path.join(outDir, 'report.json'),
    }, null, 2));
    process.exit(report.pass ? 0 : 1);
  }
})();
