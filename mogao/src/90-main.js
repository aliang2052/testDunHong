/* ============================================================
   90 - 主程序：渲染循环 / 状态机 / 交互
   ============================================================ */

const APP = {
  time: 0,
  playing: true,
  speed: 1,
  free: false,
  quality: 1,
};

let renderer, scene, camera, freeCam, debris, tower, walkway, clock;
let elSub, elTime, elBar, elBarFill, elChapters, elPlay, elLoading, elSvg, elHud;

function init() {
  const canvas = document.getElementById('c');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = TEX.sky.map;
  scene.environment = null;                 // 手动布光，避免全场被天空染成青绿
  scene.fog = new THREE.Fog(0xB9D6D2, 380, 1100);

  camera = new THREE.PerspectiveCamera(35, 9 / 16, 0.5, 1400);
  freeCam = new THREE.PerspectiveCamera(45, 9 / 16, 0.5, 1400);

  /* ---------------- 光照 ---------------- */
  const amb = new THREE.AmbientLight(0xFFF2E2, 0.34);
  scene.add(amb);

  const hemi = new THREE.HemisphereLight(0xC6E6EC, 0xC09872, 0.66);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xFFF3E0, 2.25);
  sun.position.set(76, 108, 128);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -95; sc.right = 95; sc.top = 95; sc.bottom = -55;
  sc.near = 20; sc.far = 380;
  sun.shadow.bias = -0.0009;
  sun.shadow.normalBias = 0.55;
  scene.add(sun);
  scene.add(sun.target);
  sun.target.position.set(0, 18, 0);

  /* 窟内补光（否则洞窟太黑） */
  const fill = new THREE.DirectionalLight(0xDCE8EE, 0.42);
  fill.position.set(-70, 40, 120);
  scene.add(fill);

  // 窟内补光：面光式，避免洞窟死黑
  const inner = new THREE.PointLight(0xFFE7C6, 120, 130, 1.6);
  inner.position.set(0, 27, 22);
  scene.add(inner);
  APP.innerLight = inner;

  // 从洞口射入的天光：让窟内与佛像有明亮均匀的照明（对应原片观感）
  const inner2 = new THREE.DirectionalLight(0xFFF0DC, 1.15);
  inner2.position.set(4, 34, 90);
  inner2.target.position.set(0, 20, -8);
  scene.add(inner2); scene.add(inner2.target);

  const inner3 = new THREE.DirectionalLight(0xE8F0F4, 0.55);
  inner3.position.set(-46, 22, 70);
  inner3.target.position.set(0, 22, -6);
  scene.add(inner3); scene.add(inner3.target);

  /* ---------------- 场景 ---------------- */
  buildWorld(scene);
  buildSmallCaves(WORLD.group);

  const buddha = buildBuddha();
  scene.add(buddha);
  buildPegs(buddha);

  tower = buildNineStorey();
  tower.position.set(0, 0, CLIFF_Z + 5.2);
  scene.add(tower);
  // 每层的拆解目标
  tower.userData.floors.forEach((f, i) => {
    const r = mulberry32(100 + i * 7);
    f.userData.off = new THREE.Vector3(
      (r() - 0.5) * 140, 10 + r() * 54, 4 + r() * 26);
    f.userData.rot = new THREE.Vector3((r() - 0.5) * 2.2, (r() - 0.5) * 3.0, (r() - 0.5) * 2.2);
    f.userData.delay = i * 0.055;
  });

  walkway = buildWalkway();
  scene.add(walkway);

  /* 配景 */
  {
    const s1 = buildStupa(3.4); s1.position.set(-36, 0, CLIFF_Z + 52); scene.add(s1);
    const s2 = buildStupa(2.2); s2.position.set(-24, 0, CLIFF_Z + 78); scene.add(s2);
    const s3 = buildStupa(3.2); s3.position.set(38, 0, CLIFF_Z + 54); scene.add(s3);
    const s4 = buildStupa(2.0); s4.position.set(26, 0, CLIFF_Z + 80); scene.add(s4);
    const tp = buildTemple(); tp.position.set(66, 0, CLIFF_Z + 24); scene.add(tp);
    const tp2 = buildTemple(); tp2.position.set(-66, 0, CLIFF_Z + 28); tp2.scale.setScalar(0.72); scene.add(tp2);
    for (const [x, z, h, s] of [[-38, 46, 15, 2], [-26, 74, 12, 3], [40, 48, 14, 4], [28, 78, 11, 5],
                                [-16, 108, 13, 6], [18, 112, 12, 7], [58, 68, 14, 8], [-58, 72, 13, 9]]) {
      const tr = buildTree(h, s); tr.position.set(x, 0, CLIFF_Z + z); scene.add(tr);
    }
    const pl1 = buildPlanter(26, 8); pl1.position.set(-25, 0, CLIFF_Z + 44); scene.add(pl1);
    const pl2 = buildPlanter(26, 8); pl2.position.set(25, 0, CLIFF_Z + 44); scene.add(pl2);
    const pl3 = buildPlanter(20, 7); pl3.position.set(-22, 0, CLIFF_Z + 96); scene.add(pl3);
    const pl4 = buildPlanter(20, 7); pl4.position.set(22, 0, CLIFF_Z + 96); scene.add(pl4);
  }

  debris = new DebrisPool(scene, 560);
  buildProps(scene);

  /* ---------------- UI ---------------- */
  elSub = document.getElementById('sub');
  elTime = document.getElementById('time');
  elBar = document.getElementById('bar');
  elBarFill = document.getElementById('barfill');
  elChapters = document.getElementById('chapters');
  elPlay = document.getElementById('play');
  elSvg = document.getElementById('anno');
  elHud = document.getElementById('hud');
  initAnnotations(elSvg);
  buildChapterUI();
  bindUI();

  clock = new THREE.Clock();
  onResize();
  addEventListener('resize', onResize);

  /* 调试/自检钩子 */
  window.MOGAO = {
    APP, THREE, BUDDHA, WORLD, PROPS, CAVE, PHASE,
    get scene() { return scene; },
    get camera() { return camera; },
    get renderer() { return renderer; },
    get tower() { return tower; },
    seek(t) { APP.time = t; APP.playing = false; debris.clear(); applyState(t, 0); },
    stats() {
      return {
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      };
    },
  };
  window.__READY__ = true;

  document.getElementById('loading').classList.add('gone');
  applyState(0, 0);
  renderer.compile(scene, camera);
  animate();
}

/* ------------------------------------------------------------
   画布尺寸：竖屏 9:16 居中
   ------------------------------------------------------------ */
function onResize() {
  const wrap = document.getElementById('stage');
  const aw = wrap.clientWidth, ah = wrap.clientHeight;
  let w = ah * 9 / 16, h = ah;
  if (w > aw) { w = aw; h = aw * 16 / 9; }
  const el = renderer.domElement;
  el.style.width = w + 'px'; el.style.height = h + 'px';
  elSvg.style.width = w + 'px'; elSvg.style.height = h + 'px';
  elSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  elHud.style.width = w + 'px'; elHud.style.height = h + 'px';
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  freeCam.aspect = w / h; freeCam.updateProjectionMatrix();
  APP.vw = w; APP.vh = h;
}

/* ============================================================
   状态机：按时间设置整个场景
   ============================================================ */
function applyState(t, dt) {
  /* --- 塑造阶段 --- */
  const phase = CURVE_PHASE(t);
  const morph = CURVE_MORPH(t);
  // 敷泥时让泥层从下往上推进（更像施工）
  let opts = {};
  const spreadWindows = [[62.4, 65.0], [68.4, 71.4], [74.4, 77.4], [79.6, 82.6], [85.2, 88.4]];
  for (const [a, b] of spreadWindows) {
    if (t >= a && t < b) {
      const k = (t - a) / (b - a);
      opts.morphY = lerp(-4, BUDDHA_H + 4, easeInOut(k));
      opts.morphK = 0.20;
      opts.wet = 1.0;
    }
  }
  setStage(phase, morph, opts);

  /* --- 佛像可见性 / 透明度 --- */
  const bop = CURVE_BOPA(t);
  BUDDHA.group.visible = bop > 0.004;
  for (const m of STAGE_MATS) {
    if (bop >= 0.999) { m.transparent = false; m.opacity = 1; }
    else { m.transparent = true; m.opacity = bop; m.depthWrite = bop > 0.6; }
  }
  const det = CURVE_DETAIL(t);
  for (const m of BUDDHA.detailMats) m.opacity = det * bop;
  const hal = CURVE_HALO(t);
  for (const m of BUDDHA.haloMats) m.opacity = hal * bop * 0.98;

  /* 螺发：石胎阶段缩进头里 */
  if (BUDDHA.parts.hair) {
    const s = 1 - morph;
    BUDDHA.parts.hair.visible = s > 0.05;
    BUDDHA.parts.hair.scale.setScalar(clamp(s * 1.0 + 0.0, 0.001, 1));
  }

  /* 木桩：59–64s 显现，之后被泥覆盖 */
  if (BUDDHA.parts.pegs) {
    const on = t >= 59.2 && t < 64.6;
    BUDDHA.parts.pegs.visible = on;
    if (on) {
      BUDDHA.parts.pegList.forEach((p, i) => {
        const st = 59.3 + i * 0.32;
        const k = clamp((t - st) / 0.45, 0, 1);
        p.scale.setScalar(k < 0.02 ? 0.001 : 1);
        // 敲入的下沉感
        p.visible = k > 0.02;
      });
    }
  }

  /* --- 开凿 --- */
  const cy = CURVE_CARVE(t);
  setCarveY(cy);
  const doorOn = (t >= 25.2 && t < 34.6);
  openDoor(doorOn);
  if (WORLD.doorTunnel) WORLD.doorTunnel.visible = doorOn;
  openLowerCaves(t < 47.4 ? 0 : (t >= 51.9 ? 0 : (t < 49.4 ? 1 : 2)));
  if (t < 15.2 || t >= 51.6) { /* 建成态：洞窟完整 */ }
  setSectionX(CURVE_SECTION(t));

  /* --- 窟壁装饰 --- */
  setWallPhase(CURVE_WALL(t));

  /* --- 九层楼拆解 / 组装 --- */
  {
    const k = CURVE_TOWER(t);
    tower.visible = k < 0.995 || t < 3.2 || t > 110.4;
    tower.userData.floors.forEach((f) => {
      const kk = clamp((k - f.userData.delay) / (1 - f.userData.delay), 0, 1);
      const e = easeInOut(kk);
      f.position.set(
        f.userData.off.x * e,
        f.userData.baseY + f.userData.off.y * e,
        f.userData.off.z * e);
      f.rotation.set(f.userData.rot.x * e, f.userData.rot.y * e, f.userData.rot.z * e);
      f.visible = kk < 0.985;
    });
  }

  /* --- 栈道逐段出现 --- */
  {
    const k = CURVE_WALK(t);
    const n = walkway.userData.segs.length;
    walkway.userData.segs.forEach((s, i) => {
      const a = i / n, b = (i + 1) / n;
      const kk = clamp((k - a) / (b - a), 0, 1);
      s.visible = kk > 0.02;
      s.scale.set(1, kk < 0.999 ? Math.max(0.02, kk) : 1, 1);
      s.children.forEach((c, ci) => { c.visible = ci / s.children.length < kk + 0.08; });
    });
  }

  /* --- 窟内补光强度：随开凿深入变亮 --- */
  APP.innerLight.intensity = lerp(90, 220, smoothstep(40, 5, cy));

  /* --- 碎石发射 --- */
  if (dt > 0 && dt < 0.5) {
    ST.emitAcc += dt;
    const emitting =
      (t >= 25.2 && t < 26.9) ||     // 凿窟门
      (t >= 31.0 && t < 34.0) ||     // 凿拱顶
      (t >= 37.0 && t < 46.2) ||     // 自上而下
      (t >= 47.4 && t < 51.8);       // 下方运土窟
    if (emitting && ST.emitAcc > 0.055) {
      ST.emitAcc = 0;
      const rnd = Math.random();
      if (t >= 47.4 && t < 51.8) {
        // 从下方两个洞口滚出
        const y = t < 49.4 ? 15.5 : 3.0;
        debris.emit(-7.5 + (rnd - 0.5) * 8, y, CLIFF_Z + 1, 7, { spread: 3.2, speed: 9, size: 1.25, life: 7 });
      } else if (t >= 25.2 && t < 26.9) {
        debris.emit((rnd - 0.5) * 7, 35.0, CLIFF_Z + 1.0, 5, { spread: 2.6, speed: 7, size: 0.80, life: 5 });
      } else {
        const y = clamp(cy, 1, CAVE.yTop);
        debris.emit((rnd - 0.5) * 24, y + 1.6, (rnd - 0.5) * 14 + 1, 9, { spread: 4.2, speed: 9.0, size: 1.35, life: 7 });
      }
    }
    if (t < 20 || (t > 56.5 && t < 95)) {
      // 非开凿期：清理堆积
      if (ST.emitAcc > 2) { debris.clear(); ST.emitAcc = 0; }
    }
  }

  /* --- 基座台（建成后出现） --- */
  WORLD.plinth.visible = (t < 15.2) || (t >= 51.6);
}

/* ============================================================
   渲染循环
   ============================================================ */
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.06);

  if (APP.playing) {
    APP.time += dt * APP.speed;
    if (APP.time >= DURATION) { APP.time = 0; debris.clear(); }
  }
  const t = APP.time;

  applyState(t, APP.playing ? dt * APP.speed : 0);
  debris.update(dt);

  /* 相机 */
  const cam = APP.free ? freeCam : camera;
  if (!APP.free) {
    const s = shotAt(t);
    camera.position.set(s.px, s.py, s.pz);
    camera.lookAt(s.lx, s.ly, s.lz);
    if (Math.abs(camera.fov - s.fov) > 0.001) { camera.fov = s.fov; camera.updateProjectionMatrix(); }
  } else {
    updateFreeCam(dt);
  }

  updateProps(t, cam);
  updateAnnotations(t, cam, APP.vw, APP.vh);

  /* 字幕 */
  const s = subAt(t);
  if (elSub.textContent !== s) elSub.textContent = s;

  /* 进度 */
  elBarFill.style.width = (t / DURATION * 100) + '%';
  elTime.textContent = fmt(t) + ' / ' + fmt(DURATION);

  renderer.render(scene, cam);
}

function fmt(x) {
  const m = Math.floor(x / 60), s = Math.floor(x % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/* ============================================================
   自由视角
   ============================================================ */
const FREE = { yaw: 0, pitch: -0.06, dist: 90, target: new THREE.Vector3(0, 20, 0), keys: {}, drag: false, lx: 0, ly: 0 };
function updateFreeCam(dt) {
  const sp = 40 * dt * (FREE.keys['shift'] ? 3 : 1);
  const fwd = new THREE.Vector3(Math.sin(FREE.yaw), 0, Math.cos(FREE.yaw));
  const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
  if (FREE.keys['w']) FREE.target.addScaledVector(fwd, -sp);
  if (FREE.keys['s']) FREE.target.addScaledVector(fwd, sp);
  if (FREE.keys['a']) FREE.target.addScaledVector(right, -sp);
  if (FREE.keys['d']) FREE.target.addScaledVector(right, sp);
  if (FREE.keys['q']) FREE.target.y -= sp;
  if (FREE.keys['e']) FREE.target.y += sp;
  const cp = Math.cos(FREE.pitch), sp2 = Math.sin(FREE.pitch);
  freeCam.position.set(
    FREE.target.x + Math.sin(FREE.yaw) * cp * FREE.dist,
    FREE.target.y - sp2 * FREE.dist,
    FREE.target.z + Math.cos(FREE.yaw) * cp * FREE.dist);
  freeCam.lookAt(FREE.target);
}

/* ============================================================
   UI
   ============================================================ */
function buildChapterUI() {
  elChapters.innerHTML = '';
  CHAPTERS.forEach(([t, name]) => {
    const b = document.createElement('button');
    b.textContent = name;
    b.onclick = () => { APP.time = t; debris.clear(); };
    elChapters.appendChild(b);
  });
}

function bindUI() {
  elPlay.onclick = () => {
    APP.playing = !APP.playing;
    elPlay.textContent = APP.playing ? '⏸' : '▶';
  };
  elBar.onpointerdown = (e) => {
    const seek = (ev) => {
      const r = elBar.getBoundingClientRect();
      APP.time = clamp((ev.clientX - r.left) / r.width, 0, 1) * DURATION;
      debris.clear();
    };
    seek(e);
    const mv = (ev) => seek(ev);
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  };
  document.getElementById('speed').onchange = (e) => { APP.speed = parseFloat(e.target.value); };
  const freeBtn = document.getElementById('freebtn');
  freeBtn.onclick = () => {
    APP.free = !APP.free;
    freeBtn.classList.toggle('on', APP.free);
    if (APP.free) {
      freeCam.position.copy(camera.position);
      FREE.target.set(0, 20, 0);
      const d = camera.position.clone().sub(FREE.target);
      FREE.dist = d.length();
      FREE.yaw = Math.atan2(d.x, d.z);
      FREE.pitch = -Math.asin(d.y / FREE.dist);
    }
  };
  document.getElementById('hidebtn').onclick = (e) => {
    document.body.classList.toggle('clean');
    e.target.classList.toggle('on');
  };

  addEventListener('keydown', (e) => {
    FREE.keys[e.key.toLowerCase()] = true;
    if (e.code === 'Space') { e.preventDefault(); elPlay.onclick(); }
    if (e.key === 'ArrowLeft') APP.time = Math.max(0, APP.time - 3);
    if (e.key === 'ArrowRight') APP.time = Math.min(DURATION, APP.time + 3);
  });
  addEventListener('keyup', (e) => { FREE.keys[e.key.toLowerCase()] = false; });

  const cv = renderer.domElement;
  cv.addEventListener('pointerdown', (e) => { FREE.drag = true; FREE.lx = e.clientX; FREE.ly = e.clientY; });
  addEventListener('pointerup', () => { FREE.drag = false; });
  addEventListener('pointermove', (e) => {
    if (!FREE.drag || !APP.free) return;
    FREE.yaw -= (e.clientX - FREE.lx) * 0.005;
    FREE.pitch = clamp(FREE.pitch + (e.clientY - FREE.ly) * 0.005, -1.4, 1.4);
    FREE.lx = e.clientX; FREE.ly = e.clientY;
  });
  cv.addEventListener('wheel', (e) => {
    if (!APP.free) return;
    e.preventDefault();
    FREE.dist = clamp(FREE.dist * (1 + Math.sign(e.deltaY) * 0.1), 4, 500);
  }, { passive: false });
}

/* ============================================================
   启动
   ============================================================ */
(function boot() {
  const bar = document.getElementById('lbar');
  const txt = document.getElementById('ltxt');
  buildAllTextures((p, name) => {
    bar.style.width = (p * 100).toFixed(0) + '%';
    txt.textContent = `正在烘焙材质 ${(p * 100) | 0}% · ${name}`;
  }).then(() => {
    txt.textContent = '正在构建洞窟与大佛…';
    requestAnimationFrame(() => {
      setTimeout(() => {
        try { init(); }
        catch (err) {
          txt.textContent = '出错：' + err.message;
          console.error(err);
        }
      }, 30);
    });
  });
})();
