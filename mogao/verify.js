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
const referenceAsset = path.join(__dirname, 'assets', 'buddha-reference-v3.glb');
const inputBuffer = fs.readFileSync(input);
const inputHtml = inputBuffer.toString('utf8');
const referenceBuffer = fs.readFileSync(referenceAsset);
const referenceBytes = referenceBuffer.length;
const referenceSha256 = crypto.createHash('sha256').update(referenceBuffer).digest('hex');
const embeddedMatch = inputHtml.match(/<script id="buddha-glb"[^>]*>([\s\S]*?)<\/script>/);
const embeddedReference = embeddedMatch
  ? Buffer.from(embeddedMatch[1].replace(/\s+/g, ''), 'base64')
  : Buffer.alloc(0);
const embeddedReferenceSha256 = crypto.createHash('sha256').update(embeddedReference).digest('hex');
const keyTimes = [0, 5, 9, 14.7, 16.2, 20, 25, 33, 40, 49, 60, 65, 70, 79, 86, 90.2, 92.9, 93, 95.4, 101, 106, 112, 116];
fs.mkdirSync(outDir, { recursive: true });

const report = {
  input,
  inputBytes: inputBuffer.length,
  inputSha256: crypto.createHash('sha256').update(inputBuffer).digest('hex'),
  startedAt: new Date().toISOString(),
  checks: {},
  keyframes: [],
  console: [],
  pageErrors: [],
  remoteRequests: [],
  referenceAsset: { path: referenceAsset, bytes: referenceBytes, sha256: referenceSha256 },
  referenceEmbedded: {
    found: !!embeddedMatch,
    bytes: embeddedReference.length,
    sha256: embeddedReferenceSha256,
  },
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
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  page.on('console', (m) => report.console.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => report.pageErrors.push(e.message));
  page.on('request', (req) => {
    const u = req.url();
    if (/^https?:/i.test(u)) report.remoteRequests.push(u);
  });

  try {
    await page.goto(`file://${input}`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction('window.__READY__ === true', { timeout: 180000 });
    report.performance = {
      readyMs: await page.evaluate(() => performance.now()),
    };
    assert('ready-hook', await page.evaluate(() => window.__READY__ === true), 'window.__READY__ 必须为 true');
    const desktopCanvas = await page.evaluate(() => {
      const c = document.querySelector('#c').getBoundingClientRect();
      return { width: c.width, height: c.height, aspect: c.width / c.height };
    });
    assert('desktop-16-by-9', Math.abs(desktopCanvas.aspect - 16 / 9) < 0.006, desktopCanvas);
    assert('no-video-element', await page.evaluate(() => document.querySelectorAll('video').length === 0), '不得嵌入 video');
    assert('no-remote-requests', report.remoteRequests.length === 0, report.remoteRequests);
    assert('embedded-reference-present', !!embeddedMatch, report.referenceEmbedded);
    assert('embedded-reference-bytes', embeddedReference.length === referenceBytes, report.referenceEmbedded);
    assert('embedded-reference-sha256', embeddedReferenceSha256 === referenceSha256, report.referenceEmbedded);

    const reference = await page.evaluate(() => {
      const b = window.MOGAO.BUDDHA;
      const body = b.referenceMeshes.find((mesh) => !!mesh.geometry?.attributes?.color);
      return {
        ready: b.referenceReady,
        stats: b.referenceStats,
        meshCount: b.referenceMeshes.length,
        materialCount: b.referenceMaterials.length,
        hasColorAccessor: !!body,
        usesLegacyVertexColors: body?.material?.vertexColors === true,
      };
    });
    report.referenceRuntime = reference;
    assert('reference-glb-ready', reference.ready === true, reference);
    assert('reference-glb-sha256', reference.stats.sha256 === referenceSha256, reference.stats);
    assert('reference-glb-bytes', reference.stats.bytes === referenceBytes, reference.stats);
    assert('reference-glb-meshes', reference.meshCount === 2 && reference.stats.meshCount === 2, reference);
    assert('reference-glb-geometry', reference.stats.vertexCount === 171419 && reference.stats.triangleCount === 342684, reference.stats);
    assert('reference-glb-color-accessor', reference.hasColorAccessor && reference.stats.coloredMeshCount === 1, reference);
    assert('reference-position-shader-replaces-legacy-colors', reference.usesLegacyVertexColors === false, reference);
    assert(
      'reference-glb-height',
      Math.abs(reference.stats.fittedBounds.size[1] - 35.5) < 0.01,
      reference.stats.fittedBounds
    );
    assert('reference-glb-no-extensions', reference.stats.extensionsRequired.length === 0, reference.stats.extensionsRequired);

    const shaderAudit = await page.evaluate(() => {
      const M = window.MOGAO;
      const b = M.BUDDHA;
      M.seek(0);
      M.renderer.compile(M.scene, M.camera);
      const body = b.referenceMeshes.find((mesh) => !!mesh.geometry?.attributes?.color);
      const urna = b.referenceMeshes.find((mesh) => /白毫/.test(`${mesh.name} ${mesh.material?.name || ''}`));
      if (!body || !urna) return { bodyFound: !!body, urnaFound: !!urna };

      const material = body.material;
      const uniforms = material.userData.referencePaintUniforms || {};
      const box = body.geometry.boundingBox;
      const boxSize = box?.getSize(new M.THREE.Vector3());
      const synthetic = {
        uniforms: {},
        vertexShader: '#include <begin_vertex>',
        fragmentShader: '#include <map_fragment>',
      };
      material.onBeforeCompile(synthetic, M.renderer);
      const fragmentTokens = [
        'vBuddhaPos', 'uBuddhaMin', 'uBuddhaSize',
        'vec3 blue', 'vec3 red', 'vec3 ochre',
        'chestMask', 'weave', 'mix(uReferenceClay, robe, referencePaint)',
      ];
      const programCacheKeys = M.renderer.info.programs.map((program) => String(program.cacheKey || ''));
      return {
        bodyFound: true,
        urnaFound: true,
        body: {
          cacheKey: material.customProgramCacheKey(),
          vertexColors: material.vertexColors,
          roughness: material.roughness,
          metalness: material.metalness,
          side: material.side,
          doubleSide: M.THREE.DoubleSide,
          uniformKeys: Object.keys(uniforms).sort(),
          syntheticUniformKeys: Object.keys(synthetic.uniforms).sort(),
          vertexInjected: synthetic.vertexShader.includes('vBuddhaPos = position;'),
          fragmentTokens: Object.fromEntries(fragmentTokens.map((token) => [token, synthetic.fragmentShader.includes(token)])),
          mapFragmentReplaced: !synthetic.fragmentShader.includes('#include <map_fragment>'),
          programCompiled: programCacheKeys.some((key) => key.includes('reference-buddha-position-paint-v2')),
          boxMin: box?.min.toArray() || null,
          boxSize: boxSize?.toArray() || null,
          uniformMin: uniforms.uBuddhaMin?.value?.toArray() || null,
          uniformSize: uniforms.uBuddhaSize?.value?.toArray() || null,
        },
        urna: {
          meshName: urna.name,
          materialName: urna.material?.name || '',
          color: urna.material?.color?.toArray() || null,
          paintY: urna.material?.userData?.referencePaintY,
          hasPositionShader: !!urna.material?.userData?.referencePaintUniforms,
          cacheKey: urna.material?.customProgramCacheKey?.() || '',
        },
      };
    });
    report.referenceShader = shaderAudit;
    const requiredPaintUniforms = ['uBuddhaMin', 'uBuddhaSize', 'uReferenceClay', 'uReferencePaintFront', 'uReferencePaintSoft'];
    const vectorsClose = (a, b, tolerance = 1e-6) => Array.isArray(a)
      && Array.isArray(b)
      && a.length === b.length
      && a.every((value, index) => Math.abs(value - b[index]) <= tolerance);
    assert(
      'reference-position-shader-configured',
      shaderAudit.bodyFound
        && shaderAudit.body.cacheKey === 'reference-buddha-position-paint-v2'
        && shaderAudit.body.vertexColors === false
        && Math.abs(shaderAudit.body.roughness - 0.72) < 1e-9
        && Math.abs(shaderAudit.body.metalness - 0.02) < 1e-9
        && shaderAudit.body.side === shaderAudit.body.doubleSide
        && requiredPaintUniforms.every((key) => shaderAudit.body.uniformKeys.includes(key)),
      shaderAudit.body || shaderAudit
    );
    assert(
      'reference-position-shader-compiled',
      shaderAudit.bodyFound
        && shaderAudit.body.programCompiled
        && shaderAudit.body.vertexInjected
        && shaderAudit.body.mapFragmentReplaced
        && requiredPaintUniforms.every((key) => shaderAudit.body.syntheticUniformKeys.includes(key))
        && Object.values(shaderAudit.body.fragmentTokens).every(Boolean),
      shaderAudit.body || shaderAudit
    );
    assert(
      'reference-position-shader-bounds',
      shaderAudit.bodyFound
        && vectorsClose(shaderAudit.body.boxMin, shaderAudit.body.uniformMin)
        && vectorsClose(shaderAudit.body.boxSize, shaderAudit.body.uniformSize)
        && shaderAudit.body.uniformSize.every((value) => Number.isFinite(value) && value > 0),
      shaderAudit.body || shaderAudit
    );
    const expectedUrnaColor = [0.520995557308197, 0.014443843625485897, 0.020288562402129173];
    assert(
      'reference-urna-material-preserved',
      shaderAudit.urnaFound
        && /白毫/.test(`${shaderAudit.urna.meshName} ${shaderAudit.urna.materialName}`)
        && vectorsClose(shaderAudit.urna.color, expectedUrnaColor)
        && Math.abs(shaderAudit.urna.paintY - 0.79) < 1e-6
        && shaderAudit.urna.hasPositionShader === false
        && shaderAudit.urna.cacheKey !== 'reference-buddha-position-paint-v2',
      shaderAudit.urna || shaderAudit
    );

    const representations = {};
    for (const t of [0, 16.2, 31, 90.19, 90.2, 92.9, 93, 108.6]) {
      representations[String(t)] = await page.evaluate((time) => window.MOGAO.seek(time), t);
    }
    report.representations = representations;
    assert('reference-used-at-opening', representations['0'].representation === 'reference-glb', representations['0']);
    assert('reference-hidden-before-excavation', representations['16.2'].representation === 'none', representations['16.2']);
    assert('procedural-used-for-construction', representations['31'].representation === 'procedural', representations['31']);
    assert('procedural-used-through-polish', representations['90.19'].representation === 'procedural', representations['90.19']);
    assert(
      'reference-used-for-painting',
      representations['90.2'].representation === 'reference-glb' && representations['90.2'].referencePaintProgress === 0,
      representations['90.2']
    );
    assert(
      'reference-paint-progress',
      representations['92.9'].representation === 'reference-glb' && representations['92.9'].referencePaintProgress > 0.95,
      representations['92.9']
    );
    assert('reference-used-after-hard-cut', representations['93'].representation === 'reference-glb', representations['93']);
    assert('reference-used-in-finished-cave', representations['108.6'].representation === 'reference-glb', representations['108.6']);

    const paintFrames = {};
    for (const t of [0, 90.2, 92.9, 93]) {
      paintFrames[String(t)] = await page.evaluate((time) => {
        const M = window.MOGAO;
        const state = M.seek(time);
        const body = M.BUDDHA.referenceMeshes.find((mesh) => !!mesh.geometry?.attributes?.color);
        const urna = M.BUDDHA.referenceMeshes.find((mesh) => /白毫/.test(`${mesh.name} ${mesh.material?.name || ''}`));
        const uniforms = body.material.userData.referencePaintUniforms;
        const front = uniforms.uReferencePaintFront.value;
        const soft = uniforms.uReferencePaintSoft.value;
        const position = body.geometry.attributes.position;
        let minPaint = 1;
        let maxPaint = 0;
        let nearFullCount = 0;
        const smoothstep = (a, b, value) => {
          const x = Math.max(0, Math.min(1, (value - a) / (b - a)));
          return x * x * (3 - 2 * x);
        };
        for (let i = 0; i < position.count; i++) {
          const painted = smoothstep(front - soft, front + soft, position.getY(i));
          minPaint = Math.min(minPaint, painted);
          maxPaint = Math.max(maxPaint, painted);
          if (painted >= 0.98) nearFullCount++;
        }
        return {
          representation: state.representation,
          progress: M.BUDDHA.referencePaintProgress,
          stateFront: M.BUDDHA.referencePaintFront,
          uniformFront: front,
          soft,
          minPaint,
          maxPaint,
          nearFullFraction: nearFullCount / position.count,
          bodyOpacity: body.material.opacity,
          urnaOpacity: urna.material.opacity,
          urnaColor: urna.material.color.toArray(),
        };
      }, t);
    }
    report.referencePaintFrames = paintFrames;
    const frontsSynchronized = Object.values(paintFrames).every((frame) => (
      Math.abs(frame.stateFront - frame.uniformFront) < 1e-9
    ));
    assert('reference-paint-uniform-synchronized', frontsSynchronized, paintFrames);
    assert(
      'reference-opening-fully-painted',
      paintFrames['0'].representation === 'reference-glb'
        && paintFrames['0'].progress === 1
        && Math.abs(paintFrames['0'].uniformFront + 1.08) < 1e-9
        && paintFrames['0'].minPaint > 0.999
        && paintFrames['0'].bodyOpacity > 0.99,
      paintFrames['0']
    );
    assert(
      'reference-paint-start-is-clay',
      paintFrames['90.2'].representation === 'reference-glb'
        && paintFrames['90.2'].progress === 0
        && Math.abs(paintFrames['90.2'].uniformFront - 1.08) < 1e-9
        && paintFrames['90.2'].maxPaint < 0.001
        && paintFrames['90.2'].bodyOpacity > 0.99,
      paintFrames['90.2']
    );
    assert(
      'reference-nearly-painted-before-cut',
      paintFrames['92.9'].representation === 'reference-glb'
        && paintFrames['92.9'].progress > 0.96
        && paintFrames['92.9'].uniformFront < -1.07
        && paintFrames['92.9'].nearFullFraction > 0.98,
      paintFrames['92.9']
    );
    assert(
      'reference-full-paint-at-cut',
      paintFrames['93'].representation === 'reference-glb'
        && paintFrames['93'].progress === 1
        && Math.abs(paintFrames['93'].uniformFront + 1.08) < 1e-9
        && paintFrames['93'].minPaint > 0.999,
      paintFrames['93']
    );
    assert(
      'reference-urna-paint-sequence',
      paintFrames['0'].urnaOpacity > 0.99
        && paintFrames['90.2'].urnaOpacity < 0.001
        && paintFrames['92.9'].urnaOpacity > 0.99
        && paintFrames['93'].urnaOpacity > 0.99
        && Object.values(paintFrames).every((frame) => vectorsClose(frame.urnaColor, expectedUrnaColor)),
      paintFrames
    );
    const finishedFrame = await page.evaluate(() => {
      window.MOGAO.seek(93);
      return {
        stats: window.MOGAO.stats(),
        brushVisible: !!window.MOGAO.CONSTRUCTION.paintBrush?.visible,
      };
    });
    assert('reference-model-rendered', finishedFrame.stats.triangles >= 342684, finishedFrame.stats);
    assert('paint-brush-stops-before-reference-cut', finishedFrame.brushVisible === false, finishedFrame);

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
    await page.reload({ waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction('window.__READY__ === true', { timeout: 180000 });
    report.performance.mobileReadyMs = await page.evaluate(() => performance.now());
    const mobile = await page.evaluate(() => {
      const c = document.querySelector('#c').getBoundingClientRect();
      return { width: c.width, height: c.height, aspect: c.width / c.height, viewport: [innerWidth, innerHeight] };
    });
    assert(
      'mobile-fit-16-by-9',
      mobile.width <= 390.1
        && mobile.height <= 844.1
        && mobile.width > 200
        && Math.abs(mobile.aspect - 16 / 9) < 0.006,
      mobile
    );

    await page.setViewport({ width: 604, height: 816, deviceScaleFactor: 2 });
    await page.reload({ waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction('window.__READY__ === true', { timeout: 180000 });
    report.performance.mobileDpr2ReadyMs = await page.evaluate(() => performance.now());
    report.mobileDpr2 = [];
    for (const t of [5, 93]) {
      const frame = await page.evaluate((time) => {
        window.MOGAO.APP.free = false;
        const started = performance.now();
        const visual = window.MOGAO.seek(time);
        const renderMs = performance.now() - started;
        const canvas = document.querySelector('#c').getBoundingClientRect();
        const camera = window.MOGAO.camera;
        camera.updateMatrixWorld(true);
        const project = (x, y, z) => {
          const p = new window.MOGAO.THREE.Vector3(x, y, z).project(camera);
          return {
            x: p.x,
            y: p.y,
            z: p.z,
            visible: Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && p.z >= -1 && p.z <= 1,
          };
        };
        const anchors = time < 10
          ? { face: project(0, 32.2, 0.4) }
          : {
              center: project(0, 17.75, 0.4),
              crown: project(0, 35.2, 0.4),
              foot: project(0, 0.3, 0.4),
            };
        return {
          time,
          representation: visual.representation,
          referenceVisible: !!window.MOGAO.BUDDHA.referenceGroup?.visible,
          triangles: window.MOGAO.stats().triangles,
          renderMs,
          devicePixelRatio,
          rendererPixelRatio: window.MOGAO.renderer.getPixelRatio(),
          canvas: { width: canvas.width, height: canvas.height, aspect: canvas.width / canvas.height },
          anchors,
        };
      }, t);
      const file = path.join(outDir, `mobile-dpr2-t${String(t).padStart(3, '0')}.png`);
      await page.screenshot({ path: file });
      frame.file = path.basename(file);
      frame.sha256 = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      report.mobileDpr2.push(frame);
    }
    const [mobileFace, mobileFull] = report.mobileDpr2;
    assert(
      'mobile-dpr2-reference-rendered',
      report.mobileDpr2.every((frame) => frame.representation === 'reference-glb'
        && frame.referenceVisible
        && frame.triangles >= 342684
        && frame.rendererPixelRatio >= 1.49),
      report.mobileDpr2
    );
    assert(
      'mobile-dpr2-16-by-9',
      report.mobileDpr2.every((frame) => Math.abs(frame.canvas.aspect - 16 / 9) < 0.006),
      report.mobileDpr2
    );
    assert('mobile-dpr2-face-framing', mobileFace.anchors.face.visible, mobileFace.anchors);
    assert(
      'mobile-dpr2-full-body-framing',
      mobileFull.anchors.center.visible && mobileFull.anchors.crown.visible && mobileFull.anchors.foot.visible,
      mobileFull.anchors
    );

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
