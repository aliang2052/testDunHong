#!/usr/bin/env node
/*
 * Independent Buddha geometry gate.
 *
 * Proves that the realism upgrade is made from volumetric Three.js geometry,
 * not a Sprite, billboard, or PlaneGeometry image impostor. It also captures
 * front and +/-25 degree views and measures their rendered pixel differences.
 */
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
  console.error('Cannot find Puppeteer. Set PUPPETEER_MODULE to its module path.');
  process.exit(2);
}

const input = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const outDir = path.resolve(process.argv[3] || path.join(__dirname, '..', 'artifacts', 'buddha-3d'));
fs.mkdirSync(outDir, { recursive: true });

const report = {
  input,
  inputBytes: fs.statSync(input).size,
  inputSha256: crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'),
  startedAt: new Date().toISOString(),
  checks: {},
  geometry: null,
  views: [],
  parallax: {},
  console: [],
  pageErrors: [],
};

function check(name, condition, detail) {
  report.checks[name] = { pass: !!condition, detail };
  return !!condition;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function comparePngs(page, firstBase64, secondBase64) {
  return page.evaluate(async ({ a, b }) => {
    const load = (src) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `data:image/png;base64,${src}`;
    });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    if (ia.width !== ib.width || ia.height !== ib.height) {
      return { sameSize: false, a: [ia.width, ia.height], b: [ib.width, ib.height] };
    }
    const c = document.createElement('canvas');
    c.width = ia.width; c.height = ia.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(ia, 0, 0);
    const pa = ctx.getImageData(0, 0, c.width, c.height).data;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(ib, 0, 0);
    const pb = ctx.getImageData(0, 0, c.width, c.height).data;

    let absolute = 0, changed = 0, opaque = 0;
    const pixels = c.width * c.height;
    for (let i = 0; i < pa.length; i += 4) {
      const dr = Math.abs(pa[i] - pb[i]);
      const dg = Math.abs(pa[i + 1] - pb[i + 1]);
      const db = Math.abs(pa[i + 2] - pb[i + 2]);
      absolute += dr + dg + db;
      if (Math.max(dr, dg, db) >= 12) changed++;
      if (pa[i + 3] || pb[i + 3]) opaque++;
    }
    return {
      sameSize: true,
      width: c.width,
      height: c.height,
      meanAbsoluteDifference: absolute / Math.max(1, pixels * 3 * 255),
      changedPixelRatio: changed / Math.max(1, pixels),
      comparedPixelRatio: opaque / Math.max(1, pixels),
    };
  }, { a: firstBase64, b: secondBase64 });
}

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
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

    await page.goto(`file://${input}`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction('window.__READY__ === true', { timeout: 180000 });
    await page.evaluate(() => window.MOGAO.seek(93.0));

    report.geometry = await page.evaluate(() => {
      const M = window.MOGAO;
      const T = M.THREE;
      const parts = M.BUDDHA && M.BUDDHA.parts;

      function trianglesForGeometry(g) {
        if (!g || !g.attributes || !g.attributes.position) return 0;
        return Math.floor((g.index ? g.index.count : g.attributes.position.count) / 3);
      }

      function summarize(root) {
        if (!root) return null;
        root.updateWorldMatrix(true, true);
        const box = new T.Box3().setFromObject(root);
        const size = new T.Vector3();
        box.getSize(size);
        const summary = {
          type: root.type,
          name: root.name || '',
          isMesh: !!root.isMesh,
          isInstancedMesh: !!root.isInstancedMesh,
          meshCount: 0,
          instancedMeshCount: 0,
          instanceCount: 0,
          geometryTriangles: 0,
          renderedTriangles: 0,
          missingPosition: [],
          missingNormals: [],
          planeGeometries: [],
          sprites: [],
          dimensions: { x: size.x, y: size.y, z: size.z },
          names: [],
        };
        root.traverse((o) => {
          if (o.isSprite) summary.sprites.push(o.name || o.type);
          if (!o.isMesh && !o.isInstancedMesh) return;
          summary.meshCount++;
          if (o.isInstancedMesh) {
            summary.instancedMeshCount++;
            summary.instanceCount += o.count || 0;
          }
          const g = o.geometry;
          const label = o.name || (g && g.type) || o.type;
          summary.names.push(label);
          if (!g || !g.attributes || !g.attributes.position) summary.missingPosition.push(label);
          if (!g || !g.attributes || !g.attributes.normal) summary.missingNormals.push(label);
          if (g && g.type === 'PlaneGeometry') summary.planeGeometries.push(label);
          const tris = trianglesForGeometry(g);
          summary.geometryTriangles += tris;
          summary.renderedTriangles += tris * (o.isInstancedMesh ? Math.max(0, o.count || 0) : 1);
        });
        return summary;
      }

      return {
        contract: parts && parts.realism && {
          name: parts.realism.name,
          usesImageImpostor: parts.realism.userData.usesImageImpostor,
          geometryContract: parts.realism.userData.geometryContract,
          referencePose: parts.realism.userData.referencePose,
        },
        realism: summarize(parts && parts.realism),
        head: summarize(parts && parts.head),
        face: summarize(parts && parts.face),
        raisedHand: summarize(parts && parts.handR),
        restingHand: summarize(parts && parts.handL),
        hair: summarize(parts && parts.hair),
        hairCurlCount: parts && parts.hairCurlCount,
      };
    });

    const g = report.geometry;
    check('realism-group-present', !!g.realism && g.contract?.name === 'RealThreeDimensionalBuddhaUpgrade', g.contract);
    check('realism-contract', g.contract?.usesImageImpostor === false && g.contract?.geometryContract === 'volumetric-surfaces-with-normals-no-impostors', g.contract);
    check('realism-no-sprites', g.realism?.sprites.length === 0, g.realism?.sprites);
    check('realism-no-planes', g.realism?.planeGeometries.length === 0, g.realism?.planeGeometries);
    check('realism-all-meshes-have-position', g.realism?.missingPosition.length === 0, g.realism?.missingPosition);
    check('realism-all-meshes-have-normals', g.realism?.missingNormals.length === 0, g.realism?.missingNormals);
    check('realism-mesh-density', g.realism?.meshCount >= 40 && g.realism?.renderedTriangles >= 50000, g.realism);
    check('realism-three-axis-volume', g.realism?.dimensions.x >= 10 && g.realism?.dimensions.y >= 15 && g.realism?.dimensions.z >= 6, g.realism?.dimensions);

    check('head-is-volumetric-mesh', g.head?.isMesh === true && g.head?.planeGeometries.length === 0 && g.head?.renderedTriangles >= 25000 && g.head?.dimensions.x >= 3.5 && g.head?.dimensions.y >= 5.5 && g.head?.dimensions.z >= 3.5, g.head);
    // Three neck rings are now displaced directly into the neck surface instead
    // of existing as separate tube meshes, so the meaningful face assembly
    // contains 19 parts while carrying more actual geometry.
    check('face-is-volumetric-mesh-assembly', g.face?.meshCount >= 19 && g.face?.missingNormals.length === 0 && g.face?.planeGeometries.length === 0 && g.face?.renderedTriangles >= 8000 && g.face?.dimensions.x >= 2.5 && g.face?.dimensions.y >= 3.0 && g.face?.dimensions.z >= 0.3, g.face);
    check('raised-hand-is-volumetric-mesh', g.raisedHand?.isMesh === true && g.raisedHand?.missingNormals.length === 0 && g.raisedHand?.renderedTriangles >= 3000 && g.raisedHand?.dimensions.x >= 2.0 && g.raisedHand?.dimensions.y >= 4.0 && g.raisedHand?.dimensions.z >= 0.5, g.raisedHand);
    // The reference pose shows a compact, robe-covered resting fist rather than
    // an open palm. Keep the depth threshold high enough to reject a card while
    // allowing that deliberately compressed silhouette.
    check('resting-hand-is-volumetric-mesh', g.restingHand?.isMesh === true && g.restingHand?.missingNormals.length === 0 && g.restingHand?.renderedTriangles >= 3000 && g.restingHand?.dimensions.x >= 2.0 && g.restingHand?.dimensions.y >= 0.7 && g.restingHand?.dimensions.z >= 1.4, g.restingHand);
    // One procedural spiral contains 696 triangles. Instance count, rendered
    // triangle count and three-axis bounds below are the stronger anti-impostor
    // checks for the full field of individually placed curls.
    check('hair-is-instanced-spiral-mesh', g.hair?.isInstancedMesh === true && g.hair?.missingNormals.length === 0 && g.hair?.planeGeometries.length === 0 && g.hair?.geometryTriangles >= 650 && g.hair?.instanceCount >= 60 && g.hair?.renderedTriangles >= 50000 && g.hairCurlCount === g.hair?.instanceCount, { hair: g.hair, hairCurlCount: g.hairCurlCount });
    check('hair-three-axis-volume', g.hair?.dimensions.x >= 3.0 && g.hair?.dimensions.y >= 3.0 && g.hair?.dimensions.z >= 2.0, g.hair?.dimensions);

    await page.evaluate(() => {
      const M = window.MOGAO;
      M.setTestMode(true);
      for (const o of M.scene.children) {
        if (o === M.BUDDHA.group || o.isLight || o.type === 'HemisphereLight') continue;
        o.visible = false;
      }
      M.scene.background = new M.THREE.Color(0x211b18);
      // Keep the Fog object alive because the app's absolute-time state machine
      // updates fog.color on every frame. Moving its range effectively disables
      // it for this isolated near-field geometry capture without causing errors.
      if (M.scene.fog) {
        M.scene.fog.color.set(0x211b18);
        M.scene.fog.near = 500;
        M.scene.fog.far = 900;
      }
      // Lock the capture surface so all views have identical pixel dimensions.
      const canvas = M.renderer.domElement;
      canvas.style.width = '540px';
      canvas.style.height = '960px';
      M.renderer.setSize(540, 960, false);
      M.camera.aspect = 9 / 16;
      M.camera.updateProjectionMatrix();
    });

    const captured = {};
    for (const view of [
      { key: 'left25', angle: -25 },
      { key: 'front', angle: 0 },
      { key: 'right25', angle: 25 },
    ]) {
      const capture = await page.evaluate(({ angle }) => {
        const M = window.MOGAO;
        const T = M.THREE;
        const cam = M.camera;
        // ElementHandle.screenshot may provoke a viewport/layout refresh in
        // Chromium. Re-apply the deterministic capture size for every view.
        const canvas = M.renderer.domElement;
        canvas.style.width = '540px';
        canvas.style.height = '960px';
        M.renderer.setSize(540, 960, false);
        cam.aspect = 9 / 16;
        const box = new T.Box3().setFromObject(M.BUDDHA.group);
        const center = new T.Vector3();
        const size = new T.Vector3();
        box.getCenter(center); box.getSize(size);
        const fov = 32;
        const distance = size.y * 0.5 / Math.tan(T.MathUtils.degToRad(fov * 0.5)) * 1.18;
        const radians = T.MathUtils.degToRad(angle);
        cam.fov = fov;
        cam.position.set(center.x + Math.sin(radians) * distance, center.y, center.z + Math.cos(radians) * distance);
        cam.lookAt(center);
        cam.updateProjectionMatrix();
        M.renderer.render(M.scene, cam);
        return {
          camera: {
            angle,
            position: cam.position.toArray(),
            target: center.toArray(),
            fov,
            subjectSize: size.toArray(),
          },
          // Read in the same task as renderer.render(). WebGL's default
          // preserveDrawingBuffer=false may clear the buffer before a later
          // browser-level screenshot, which would make all views look equal.
          pngBase64: canvas.toDataURL('image/png').split(',')[1],
        };
      }, view);
      const buffer = Buffer.from(capture.pngBase64, 'base64');
      const filename = `${view.key}.png`;
      fs.writeFileSync(path.join(outDir, filename), buffer);
      captured[view.key] = buffer.toString('base64');
      report.views.push({ ...capture.camera, file: filename, bytes: buffer.length, sha256: sha256(buffer) });
    }

    for (const [name, a, b] of [
      ['front-vs-left25', 'front', 'left25'],
      ['front-vs-right25', 'front', 'right25'],
      ['left25-vs-right25', 'left25', 'right25'],
    ]) {
      const diff = await comparePngs(page, captured[a], captured[b]);
      report.parallax[name] = diff;
      check(`parallax-${name}`, diff.sameSize === true && diff.meanAbsoluteDifference >= 0.012 && diff.changedPixelRatio >= 0.08, diff);
    }

    check('three-distinct-view-images', new Set(report.views.map((v) => v.sha256)).size === 3, report.views.map((v) => v.sha256));
    check('no-page-errors', report.pageErrors.length === 0, report.pageErrors);
    check('no-console-errors', report.console.filter((x) => x.type === 'error').length === 0, report.console.filter((x) => x.type === 'error'));
  } catch (error) {
    report.fatal = error.stack || error.message;
  } finally {
    report.finishedAt = new Date().toISOString();
    report.pass = !report.fatal && Object.values(report.checks).every((entry) => entry.pass);
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
    if (browser) await browser.close();
    console.log(JSON.stringify({
      pass: report.pass,
      checks: report.checks,
      geometry: report.geometry,
      parallax: report.parallax,
      report: path.join(outDir, 'report.json'),
      fatal: report.fatal,
    }, null, 2));
    process.exit(report.pass ? 0 : 1);
  }
})();
