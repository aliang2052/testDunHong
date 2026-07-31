#!/usr/bin/env node
const puppeteer = require('/Users/sniper/node_modules/puppeteer');
const path = require('path');
const FILE = 'file://' + path.resolve('/Users/sniper/Desktop/temp/敦煌莫高窟大佛建造全过程.html');
const OUT = '/private/tmp/claude-502/-Users-sniper-Desktop-temp/cb5b5895-3ce2-4022-918f-8609eb52a792/scratchpad/shots';

process.on('unhandledRejection', e => { console.log('REJECT', e); process.exit(1); });
(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
      '--no-sandbox', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 760, height: 1340 });
  const logs = [];
  page.on('console', m => logs.push('[' + m.type() + '] ' + m.text()));
  page.on('pageerror', e => logs.push('ERR ' + e.message));
  await page.goto(FILE, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__READY__===true', { timeout: 180000 });
  await page.evaluate(() => window.MOGAO.seek(8));
  await new Promise(r => setTimeout(r, 500));

  const info = await page.evaluate(() => {
    const M = window.MOGAO;
    const out = {};
    const torso = M.BUDDHA.parts.torso;
    const sh = torso.material.userData.shader;
    out.stageShaderPresent = !!sh;
    if (sh) {
      out.stage_vs_hasRock = sh.vertexShader.includes('aRockPos');
      out.stage_vs_hasTransformed = sh.vertexShader.includes('vec3 transformed = mix');
      out.stage_fs_hasChain = sh.fragmentShader.includes('phW(5.0)');
      out.stage_fs_hasRough = sh.fragmentShader.includes('float roughnessFactor = rlo');
      out.stage_fs_hasNormal = sh.fragmentShader.includes('mapNa');
      out.stage_vUvOccur = (sh.fragmentShader.match(/vUv/g) || []).length;
    }
    const cf = M.WORLD.cliffFace;
    const cs = cf.material.userData.carveShader;
    out.carveShaderPresent = !!cs;
    if (cs) {
      out.carve_vs_hasVWorldP = cs.vertexShader.includes('vWorldP =');
      out.carve_fs_hasDiscard = cs.fragmentShader.includes('uCarveY');
    }
    // 找一个 wall mesh
    let wm = null;
    M.WORLD.cave.traverse(o => { if (o.isMesh && !wm) wm = o; });
    out.wallShaderPresent = !!(wm && wm.material.userData.shader);
    if (wm && wm.material.userData.shader) {
      const ws = wm.material.userData.shader;
      out.wall_vs_hasVWP = ws.vertexShader.includes('vWP =');
      out.wall_fs_hasReveal = ws.fragmentShader.includes('uRevealY');
      out.wall_revealVal = wm.material.userData.U.uRevealY.value;
    }
    out.carveUniforms = {
      y: M.APP ? undefined : undefined,
    };
    return out;
  });
  console.log('=== LOGS (' + logs.length + ') ===');
  console.log(logs.join('\n').slice(0, 6000));
  console.log(JSON.stringify(info, null, 1));

  // 关掉 carve/reveal 看是否恢复
  await page.evaluate(() => {
    const M = window.MOGAO;
    const cs = M.WORLD.cliffFace.material.userData.carveShader;
    if (cs && cs.uniforms.uCarveMin) cs.uniforms.uCarveMin.value.set(-9999, -9999, -9999);
    M.WORLD.cave.traverse(o => {
      if (o.isMesh && o.material.userData.U) o.material.userData.U.uRevealY.value = -9999;
    });
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(OUT, 'DBG_nocarve.png') });

  await browser.close();
})();
