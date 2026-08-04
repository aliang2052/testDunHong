/* ============================================================
   90 - 主程序：确定性状态机 / 渲染循环 / 交互 / 自检接口
   ============================================================ */

const APP = {
  time: 0,
  playing: false,
  speed: 1,
  free: false,
  renderSuspended: false,
  quality: 1,
  dirty: true,
  currentStep: -1,
  playUntil: null,
  playFromChapter: -1,
  baseExposure: 1.02,
};

let renderer, scene, camera, freeCam, debris, tower, walkway, decorGroup, clock;
let elSub, elTime, elBar, elBarFill, elChapters, elPlay, elLoading, elSvg, elHud;
let elStepNo, elStepTitle, elStepAction, elStepFill;
let chapterButtons = [];

function init() {
  const canvas = document.getElementById('c');
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = APP.baseExposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  APP.skyBackground = TEX.sky.map;
  APP.skyFogColor = new THREE.Color(0xB9D6D2);
  APP.sectionBackground = new THREE.Color(0x241B16);
  APP.sectionFogColor = new THREE.Color(0x4A3324);
  scene.background = APP.skyBackground;
  /* 中性暖色程序化光场只参与 PBR 反射，不承载任何佛像图像或轮廓。 */
  {
    const envCanvas = makeCanvas(512, 256);
    const eg = envCanvas.getContext('2d');
    const base = eg.createLinearGradient(0, 0, 0, 256);
    base.addColorStop(0.00, '#F4E7D8');
    base.addColorStop(0.42, '#B9A995');
    base.addColorStop(1.00, '#42382F');
    eg.fillStyle = base;
    eg.fillRect(0, 0, 512, 256);
    const softbox = eg.createRadialGradient(122, 76, 3, 122, 76, 112);
    softbox.addColorStop(0.00, 'rgba(255,248,238,0.95)');
    softbox.addColorStop(0.35, 'rgba(255,232,209,0.48)');
    softbox.addColorStop(1.00, 'rgba(255,224,198,0)');
    eg.fillStyle = softbox;
    eg.fillRect(0, 0, 512, 256);
    const envTex = new THREE.CanvasTexture(envCanvas);
    envTex.colorSpace = THREE.SRGBColorSpace;
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    APP.environmentTarget = pmrem.fromEquirectangular(envTex);
    scene.environment = APP.environmentTarget.texture;
    envTex.dispose();
    pmrem.dispose();
  }
  scene.fog = new THREE.Fog(APP.skyFogColor, 380, 1100);

  camera = new THREE.PerspectiveCamera(35, 9 / 16, 0.5, 1400);
  freeCam = new THREE.PerspectiveCamera(45, 9 / 16, 0.5, 1400);

  /* ---------------- 光照 ---------------- */
  scene.add(new THREE.AmbientLight(0xFFF2E2, 0.07));
  scene.add(new THREE.HemisphereLight(0xC6E6EC, 0x8B684C, 0.17));

  const sun = new THREE.DirectionalLight(0xFFF3E0, 2.15);
  sun.position.set(76, 108, 128);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = -95; sc.right = 95; sc.top = 95; sc.bottom = -55;
  sc.near = 20; sc.far = 380;
  sun.shadow.bias = -0.0009;
  sun.shadow.normalBias = 0.55;
  sun.target.position.set(0, 18, 0);
  scene.add(sun, sun.target);
  APP.sun = sun;

  const fill = new THREE.DirectionalLight(0xDCE8EE, 0.13);
  fill.position.set(-70, 40, 120);
  scene.add(fill);

  const inner = new THREE.PointLight(0xFFE7C6, 12, 130, 1.6);
  inner.position.set(0, 27, 22);
  scene.add(inner);
  APP.innerLight = inner;

  const inner2 = new THREE.DirectionalLight(0xFFF0DC, 0.16);
  inner2.position.set(4, 34, 90);
  inner2.target.position.set(0, 20, -8);
  scene.add(inner2, inner2.target);

  const inner3 = new THREE.DirectionalLight(0xE8F0F4, 0.16);
  inner3.position.set(-46, 22, 70);
  inner3.target.position.set(0, 22, -6);
  scene.add(inner3, inner3.target);

  /* 造像局部塑形光：让眼睑、鼻翼、唇峰、指缝和螺发产生可读的实体阴影。 */
  const sculptKey = new THREE.DirectionalLight(0xFFF0E4, 2.18);
  sculptKey.position.set(-42, 54, 24);
  sculptKey.target.position.set(0, 26, 0);
  sculptKey.castShadow = true;
  sculptKey.shadow.mapSize.set(2048, 2048);
  sculptKey.shadow.camera.left = -18;
  sculptKey.shadow.camera.right = 18;
  sculptKey.shadow.camera.top = 22;
  sculptKey.shadow.camera.bottom = -18;
  sculptKey.shadow.camera.near = 18;
  sculptKey.shadow.camera.far = 105;
  sculptKey.shadow.bias = -0.00020;
  sculptKey.shadow.normalBias = 0.035;
  scene.add(sculptKey, sculptKey.target);
  APP.sculptKey = sculptKey;

  const sculptFill = new THREE.DirectionalLight(0xFFF7F0, 0);
  sculptFill.position.set(34, 38, 58);
  sculptFill.target.position.set(0, 27.5, 1.5);
  scene.add(sculptFill, sculptFill.target);
  APP.sculptFill = sculptFill;

  /* ---------------- 场景 ---------------- */
  buildWorld(scene);
  buildSmallCaves(WORLD.group);

  const buddha = buildBuddha();
  scene.add(buddha);
  buildPegs(buddha);

  tower = buildNineStorey();
  tower.position.set(0, 0, CLIFF_Z + 5.2);
  scene.add(tower);

  walkway = buildWalkway();
  scene.add(walkway);

  decorGroup = new THREE.Group();
  decorGroup.name = 'ExteriorDecor';
  scene.add(decorGroup);
  {
    const s1 = buildStupa(3.4); s1.position.set(-36, 0, CLIFF_Z + 52); decorGroup.add(s1);
    const s2 = buildStupa(2.2); s2.position.set(-24, 0, CLIFF_Z + 78); decorGroup.add(s2);
    const s3 = buildStupa(3.2); s3.position.set(38, 0, CLIFF_Z + 54); decorGroup.add(s3);
    const s4 = buildStupa(2.0); s4.position.set(26, 0, CLIFF_Z + 80); decorGroup.add(s4);
    const tp = buildTemple(); tp.position.set(66, 0, CLIFF_Z + 24); decorGroup.add(tp);
    const tp2 = buildTemple(); tp2.position.set(-66, 0, CLIFF_Z + 28); tp2.scale.setScalar(0.72); decorGroup.add(tp2);
    for (const [x, z, h, seed] of [
      [-38, 46, 15, 2], [-26, 74, 12, 3], [40, 48, 14, 4], [28, 78, 11, 5],
      [-16, 108, 13, 6], [18, 112, 12, 7], [58, 68, 14, 8], [-58, 72, 13, 9],
    ]) {
      const tr = buildTree(h, seed); tr.position.set(x, 0, CLIFF_Z + z); decorGroup.add(tr);
    }
    const pl1 = buildPlanter(26, 8); pl1.position.set(-25, 0, CLIFF_Z + 44); decorGroup.add(pl1);
    const pl2 = buildPlanter(26, 8); pl2.position.set(25, 0, CLIFF_Z + 44); decorGroup.add(pl2);
    const pl3 = buildPlanter(20, 7); pl3.position.set(-22, 0, CLIFF_Z + 96); decorGroup.add(pl3);
    const pl4 = buildPlanter(20, 7); pl4.position.set(22, 0, CLIFF_Z + 96); decorGroup.add(pl4);
  }

  // 兼容旧对象，但不再用帧累积粒子；施工特效全部由绝对时间重建。
  debris = new DebrisPool(scene, 48);
  debris.mesh.visible = false;
  buildProps(scene);
  buildConstruction(scene, tower, walkway);

  /* ---------------- UI ---------------- */
  elSub = document.getElementById('sub');
  elTime = document.getElementById('time');
  elBar = document.getElementById('bar');
  elBarFill = document.getElementById('barfill');
  elChapters = document.getElementById('chapters');
  elPlay = document.getElementById('play');
  elLoading = document.getElementById('loading');
  elSvg = document.getElementById('anno');
  elHud = document.getElementById('hud');
  elStepNo = document.getElementById('stepnum');
  elStepTitle = document.getElementById('steptitle');
  elStepAction = document.getElementById('stepaction');
  elStepFill = document.getElementById('stepfill');

  initAnnotations(elSvg);
  buildChapterUI();
  bindUI();

  clock = new THREE.Clock();
  onResize();
  addEventListener('resize', onResize);

  installDebugAPI();

  // 首帧真实编译并渲染成功后才标记 ready。
  renderFrame(0, 0);
  window.__READY__ = true;
  elLoading.classList.add('gone');
  setTimeout(() => { if (elLoading) elLoading.style.display = 'none'; }, 560);
  animate();
}

/* ------------------------------------------------------------
   画布尺寸：竖屏 9:16 居中
   ------------------------------------------------------------ */
function onResize() {
  const wrap = document.getElementById('stage');
  const aw = Math.max(1, wrap.clientWidth), ah = Math.max(1, wrap.clientHeight);
  let w = ah * 9 / 16, h = ah;
  if (w > aw) { w = aw; h = aw * 16 / 9; }
  w = Math.max(1, Math.floor(w));
  h = Math.max(1, Math.floor(h));
  const el = renderer.domElement;
  el.style.width = w + 'px'; el.style.height = h + 'px';
  elSvg.style.width = w + 'px'; elSvg.style.height = h + 'px';
  elSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  elHud.style.width = w + 'px'; elHud.style.height = h + 'px';
  // 浏览器窗口在不同 DPR 的屏幕间移动，或测试/系统动态切换缩放时，
  // resize 不会重新创建 renderer。同步像素比后再 setSize，避免高分屏
  // 仍沿用初始化时的 1x backing buffer 而出现明显模糊。
  const pixelRatio = Math.min(devicePixelRatio || 1, 1.5);
  if (Math.abs(renderer.getPixelRatio() - pixelRatio) > 0.001) {
    renderer.setPixelRatio(pixelRatio);
  }
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  freeCam.aspect = w / h; freeCam.updateProjectionMatrix();
  APP.vw = w; APP.vh = h; APP.dirty = true;
}

/* ============================================================
   状态机：每个画面只由绝对时间决定，可任意 seek
   ============================================================ */
function applySculptState(t, carveY) {
  let phase = CURVE_PHASE(t);
  let morph = CURVE_MORPH(t);
  const opts = {
    time: t,
    revealOn: t >= 31.0 && t < 51.9,
    revealY: carveY - 1.10,
  };

  const w = activeMudWindow(t);
  if (w) {
    const dir = w.dir || 1;
    const k = easeInOut(w.k);
    const front = dir > 0
      ? lerp(-3.0, BUDDHA_H + 3.0, k)
      : lerp(BUDDHA_H + 3.0, -3.0, k);
    phase = w.toP;
    morph = w.toM;
    Object.assign(opts, {
      spread: true,
      spreadY: front,
      spreadSoft: dir < 0 ? 1.45 : 1.08,
      spreadDir: dir,
      phaseFrom: w.fromP,
      phaseTo: w.toP,
      morphFrom: w.fromM,
      morphTo: w.toM,
      wet: w.a >= 90 ? 0.34 : 1.0,
    });
  }
  setStage(phase, morph, opts);
  return { phase, morph, spread: !!w, spreadProgress: w ? w.k : 0 };
}

function applyCarveState(t) {
  const carveY = CURVE_CARVE(t);
  setCarveY(carveY);

  let doorProgress = 0;
  if (t < 15.2 || t >= 27.0) doorProgress = 1;
  else if (t >= 24.55) doorProgress = easeOut(windowK(t, 24.55, 27.0));
  setDoorProgress(doorProgress);
  /*
    门洞盒体只用于外部凿门镜头。旧逻辑让它在佛像施工期仍常驻，近景相机
    实际钻进盒体后，前壁会像一块巨型横板截掉佛脸与胸口。
  */
  if (WORLD.doorTunnel) {
    WORLD.doorTunnel.visible = doorProgress > 0.035 && (t < 30.4 || t >= 111.4);
  }

  const complete = t < 15.2 || t >= 51.6;
  let lower1 = complete ? 1 : 0;
  let lower2 = complete ? 1 : 0;
  if (!complete && t >= 46.2) {
    lower1 = easeInOut(windowK(t, 46.2, 49.3));
    lower2 = easeInOut(windowK(t, 49.0, 51.6));
  }
  setLowerCaveProgress(lower1, lower2);
  setSectionX(CURVE_SECTION(t));

  return { carveY, doorProgress, lower1, lower2, complete };
}

function applyState(t, dt) {
  const carve = applyCarveState(t);
  const sectionOn = t >= 26.7 && t < 51.6 && CURVE_SECTION(t) < 9000;
  scene.background = sectionOn ? APP.sectionBackground : APP.skyBackground;
  scene.fog.color.copy(sectionOn ? APP.sectionFogColor : APP.skyFogColor);
  const sculpt = applySculptState(t, carve.carveY);

  if (APP.sculptKey) {
    const focus = (t < 15.2 || (t >= 51.0 && t < 99.0) || t >= 108.6) ? 1 : 0;
    const paintedLift = smoothstep(90.2, 92.6, t);
    APP.sculptKey.intensity = lerp(0.14, lerp(3.60, 5.80, paintedLift), focus);
  }
  if (APP.sculptFill) APP.sculptFill.intensity = (t >= 56.0 && t < 99.0) ? 0.06 : 0;
  if (APP.sun) APP.sun.intensity = (t >= 56.0 && t < 99.0) ? 0.32 : 2.15;

  /* 佛像在开凿阶段由高度阈值从石胎中显露，不做整尊跳变。 */
  const excavationReveal = t >= 31.0 && t < 51.9;
  const bop = excavationReveal ? 1 : CURVE_BOPA(t);
  BUDDHA.group.visible = bop > 0.004;
  for (const m of STAGE_MATS) {
    if (bop >= 0.999) {
      m.transparent = false; m.opacity = 1; m.depthWrite = true;
    } else {
      m.transparent = true; m.opacity = bop; m.depthWrite = bop > 0.6;
    }
  }
  const detailOpacity = CURVE_DETAIL(t) * bop;
  for (const m of BUDDHA.detailMats) m.opacity = detailOpacity;
  /* 雕刻凹槽在素胎阶段已经存在；彩绘只改变其综合色，而不是凭空出现。 */
  const cavityOpacity = (t < 72 ? 0 : smoothstep(72, 78, t)) * bop;
  for (const m of BUDDHA.cavityMats) m.opacity = cavityOpacity;
  if (BUDDHA.parts.eyeSurfaceMats) {
    const eyePaint = smoothstep(90.2, 92.6, t);
    for (const m of BUDDHA.parts.eyeSurfaceMats) {
      m.color.copy(m.userData.clayColor).lerp(m.userData.paintColor, eyePaint);
    }
  }
  const haloOpacity = CURVE_HALO(t) * bop * 0.98;
  for (const m of BUDDHA.haloMats) m.opacity = haloOpacity;

  /* 原片 87.2–94.1 s 是正面脸胸特写，举手位于镜头外；95 s 低机位再完整入画。 */
  const faceCloseWithoutHand = t >= 87.2 && t < 94.1;
  for (const part of [BUDDHA.parts.handR, BUDDHA.parts.cuffR, BUDDHA.parts.raisedSleeve]) {
    if (part) part.visible = !faceCloseWithoutHand;
  }

  // 螺发的逐颗显露/上色由施工系统接管，避免整组缩放。
  if (BUDDHA.parts.hair) BUDDHA.parts.hair.scale.setScalar(1);

  setWallPhase(CURVE_WALL(t));
  clearWallTransition();

  tower.visible = true;
  walkway.visible = true;
  if (decorGroup) decorGroup.visible = t < 26.6 || t >= 108.4;
  if (WORLD.sculptureFrame) {
    const materialClose = t >= 71.6 && t < 83.4;
    const completedReveal = t >= 94.1 && t < 95.4;
    WORLD.sculptureFrame.visible = materialClose || completedReveal;
    WORLD.sculptureFrameLeft.visible = materialClose || completedReveal;
    WORLD.sculptureFrameRight.visible = completedReveal;
    if (materialClose) {
      WORLD.sculptureFrameLeft.position.x = -7.0;
      WORLD.sculptureFrameLeft.scale.x = 0.30;
    } else {
      /* 完成镜头的岩壁只在左右构成天然画框，不能移到佛身中央。 */
      WORLD.sculptureFrameLeft.position.x = 4.0;
      WORLD.sculptureFrameLeft.scale.x = 0.75;
    }
    WORLD.sculptureFrameRight.position.x = -3.5;
    WORLD.sculptureFrameRight.scale.x = 1.12;
  }

  const caveOpen = carve.complete
    ? 1
    : clamp((CAVE.yTop + 1 - carve.carveY) / (CAVE.yTop + 1), 0, 1);
  /* 正面点光在近景会把鼻翼、眼窝和唇峰全部洗平；造像段改由侧上方塑形光主导。 */
  APP.innerLight.intensity = (t >= 56.0 && t < 99.0)
    ? lerp(1.10, 0.55, smoothstep(90.2, 92.6, t))
    : lerp(9, 28, easeOut(caveOpen));
  WORLD.plinth.visible = t < 15.2 || t >= 51.55;

  const construction = updateConstruction(t);
  APP.lastVisualState = { t, ...sculpt, ...carve, construction };
  return APP.lastVisualState;
}

/* ============================================================
   相机 / 单帧渲染
   ============================================================ */
function setScriptedCamera(t) {
  const s = shotAt(t);
  const fb = constructionCameraFeedback();
  camera.position.set(s.px + fb.x, s.py + fb.y, s.pz + fb.z);
  camera.lookAt(s.lx + fb.x * 0.14, s.ly + fb.y * 0.10, s.lz);
  const fov = clamp(s.fov - fb.fov, 22, 58);
  if (Math.abs(camera.fov - fov) > 0.001) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  const sculptExposure = t >= 56.0 && t < 95.4
    ? lerp(0.48, 0.88, smoothstep(90.2, 92.6, t))
    : 0;
  renderer.toneMappingExposure = APP.baseExposure + fb.exposure + sculptExposure;
}

function renderFrame(t, dt) {
  const state = applyState(t, dt);
  const cam = APP.free ? freeCam : camera;
  if (APP.free) {
    updateFreeCam(dt);
    renderer.toneMappingExposure = APP.baseExposure + constructionCameraFeedback().exposure * 0.45;
  } else {
    setScriptedCamera(t);
  }

  updateProps(t, cam);
  updateAnnotations(t, cam, APP.vw, APP.vh);
  updateTimelineUI(t);
  renderer.render(scene, cam);
  APP.dirty = false;
  return state;
}

function advancePlayback(realDelta) {
  if (!APP.playing) return false;
  const delta = Math.max(0, Number(realDelta) || 0) * APP.speed;
  APP.time += delta;
  if (APP.playUntil != null && APP.time >= APP.playUntil) {
    // 章节按钮只播放当前段：停在下一段开始前一帧，避免 UI 跳到下一章节。
    APP.time = Math.max(0, APP.playUntil - 1 / 60);
    APP.playing = false;
    APP.playUntil = null;
    APP.playFromChapter = -1;
    elPlay.textContent = '▶';
  } else if (APP.time >= DURATION) {
    APP.time = 0;
  }
  APP.dirty = true;
  return true;
}

function animate() {
  requestAnimationFrame(animate);
  // 允许低帧率设备按真实时间前进；只限制极端后台恢复造成的超大跳帧。
  const dt = Math.min(clock.getDelta(), 0.50);
  if (APP.renderSuspended) return;

  const advanced = advancePlayback(dt);
  // 暂停时仍允许自由视角、窗口变化和 UI 交互立即刷新。
  if (advanced || APP.free || APP.dirty) renderFrame(APP.time, advanced ? dt * APP.speed : dt);
}

function fmt(x) {
  const m = Math.floor(x / 60), s = Math.floor(x % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/* ============================================================
   自由视角
   ============================================================ */
const FREE = {
  yaw: 0,
  pitch: -0.06,
  dist: 90,
  target: new THREE.Vector3(0, 20, 0),
  keys: {},
  drag: false,
  lx: 0,
  ly: 0,
};

function updateFreeCam(dt) {
  const sp = 40 * dt * (FREE.keys.shift ? 3 : 1);
  const fwd = new THREE.Vector3(Math.sin(FREE.yaw), 0, Math.cos(FREE.yaw));
  const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
  if (FREE.keys.w) FREE.target.addScaledVector(fwd, -sp);
  if (FREE.keys.s) FREE.target.addScaledVector(fwd, sp);
  if (FREE.keys.a) FREE.target.addScaledVector(right, -sp);
  if (FREE.keys.d) FREE.target.addScaledVector(right, sp);
  if (FREE.keys.q) FREE.target.y -= sp;
  if (FREE.keys.e) FREE.target.y += sp;
  const cp = Math.cos(FREE.pitch), sp2 = Math.sin(FREE.pitch);
  freeCam.position.set(
    FREE.target.x + Math.sin(FREE.yaw) * cp * FREE.dist,
    FREE.target.y - sp2 * FREE.dist,
    FREE.target.z + Math.cos(FREE.yaw) * cp * FREE.dist,
  );
  freeCam.lookAt(FREE.target);
}

function setFreeMode(on) {
  APP.free = !!on;
  const freeBtn = document.getElementById('freebtn');
  if (freeBtn) freeBtn.classList.toggle('on', APP.free);
  if (APP.free) {
    freeCam.position.copy(camera.position);
    FREE.target.set(0, 20, 0);
    const d = camera.position.clone().sub(FREE.target);
    FREE.dist = Math.max(4, d.length());
    FREE.yaw = Math.atan2(d.x, d.z);
    FREE.pitch = -Math.asin(clamp(d.y / FREE.dist, -1, 1));
  }
  APP.dirty = true;
}

/* ============================================================
   UI
   ============================================================ */
function buildChapterUI() {
  elChapters.innerHTML = '';
  chapterButtons = [];
  CHAPTERS.forEach(([t, name], index) => {
    const b = document.createElement('button');
    b.textContent = `${String(index + 1).padStart(2, '0')} ${name}`;
    b.dataset.time = String(t);
    b.onclick = () => {
      APP.time = t;
      APP.playUntil = index + 1 < CHAPTERS.length ? CHAPTERS[index + 1][0] : DURATION;
      APP.playFromChapter = index;
      APP.playing = true;
      APP.dirty = true;
      elPlay.textContent = '⏸';
      renderFrame(APP.time, 0);
    };
    elChapters.appendChild(b);
    chapterButtons.push(b);
  });
}

function updateTimelineUI(t) {
  const subtitle = subAt(t);
  if (elSub.textContent !== subtitle) elSub.textContent = subtitle;
  elBarFill.style.width = (t / DURATION * 100) + '%';
  elTime.textContent = fmt(t) + ' / ' + fmt(DURATION);

  const step = stepAt(t);
  const details = STEP_DETAILS[step.idx] || [CHAPTERS[step.idx][1], ''];
  if (APP.currentStep !== step.idx) {
    APP.currentStep = step.idx;
    elStepNo.textContent = String(step.idx + 1).padStart(2, '0');
    elStepTitle.textContent = details[0];
    elStepAction.textContent = details[1];
  }
  elStepFill.style.width = (step.progress * 100).toFixed(2) + '%';
  chapterButtons.forEach((b, i) => {
    b.classList.toggle('on', i === step.idx);
    b.classList.toggle('done', i < step.idx);
  });
}

function seekFromPointer(ev) {
  const r = elBar.getBoundingClientRect();
  APP.time = clamp((ev.clientX - r.left) / Math.max(1, r.width), 0, 1) * DURATION;
  APP.playUntil = null;
  APP.playFromChapter = -1;
  APP.dirty = true;
  renderFrame(APP.time, 0);
}

function bindUI() {
  elPlay.onclick = () => {
    APP.playUntil = null;
    APP.playFromChapter = -1;
    APP.playing = !APP.playing;
    APP.dirty = true;
    elPlay.textContent = APP.playing ? '⏸' : '▶';
  };

  elBar.onpointerdown = (e) => {
    seekFromPointer(e);
    const mv = (ev) => seekFromPointer(ev);
    const up = () => {
      removeEventListener('pointermove', mv);
      removeEventListener('pointerup', up);
    };
    addEventListener('pointermove', mv);
    addEventListener('pointerup', up);
  };

  document.getElementById('speed').onchange = (e) => {
    APP.speed = parseFloat(e.target.value) || 1;
  };
  document.getElementById('freebtn').onclick = () => setFreeMode(!APP.free);
  document.getElementById('hidebtn').onclick = (e) => {
    document.body.classList.toggle('clean');
    e.currentTarget.classList.toggle('on');
  };

  addEventListener('keydown', (e) => {
    FREE.keys[e.key.toLowerCase()] = true;
    if (e.code === 'Space') { e.preventDefault(); elPlay.onclick(); }
    if (e.key === 'ArrowLeft') { APP.time = Math.max(0, APP.time - 3); APP.playUntil = null; APP.playFromChapter = -1; APP.dirty = true; }
    if (e.key === 'ArrowRight') { APP.time = Math.min(DURATION, APP.time + 3); APP.playUntil = null; APP.playFromChapter = -1; APP.dirty = true; }
  });
  addEventListener('keyup', (e) => { FREE.keys[e.key.toLowerCase()] = false; });

  const cv = renderer.domElement;
  cv.addEventListener('pointerdown', (e) => {
    FREE.drag = true; FREE.lx = e.clientX; FREE.ly = e.clientY;
  });
  addEventListener('pointerup', () => { FREE.drag = false; });
  addEventListener('pointermove', (e) => {
    if (!FREE.drag || !APP.free) return;
    FREE.yaw -= (e.clientX - FREE.lx) * 0.005;
    FREE.pitch = clamp(FREE.pitch + (e.clientY - FREE.ly) * 0.005, -1.4, 1.4);
    FREE.lx = e.clientX; FREE.ly = e.clientY;
    APP.dirty = true;
  });
  cv.addEventListener('wheel', (e) => {
    if (!APP.free) return;
    e.preventDefault();
    FREE.dist = clamp(FREE.dist * (1 + Math.sign(e.deltaY) * 0.1), 4, 500);
    APP.dirty = true;
  }, { passive: false });
}

/* ============================================================
   可复验的调试接口（不依赖上一帧）
   ============================================================ */
function visibleCount(list) {
  let n = 0;
  for (const o of list || []) if (o.visible) n++;
  return n;
}

function visualState() {
  const stageU = STAGE_MATS[0] && STAGE_MATS[0].userData.U;
  const wallU = WALL_MATS[0] && WALL_MATS[0].userData.U;
  const components = walkway && walkway.userData.components || [];
  const floors = tower && tower.userData.floors || [];
  return {
    time: APP.time,
    playing: APP.playing,
    playUntil: APP.playUntil,
    playFromChapter: APP.playFromChapter,
    speed: APP.speed,
    free: APP.free,
    chapter: stepAt(APP.time).idx,
    phase: stageU ? stageU.uPhase.value : null,
    morph: stageU ? stageU.uMorph.value : null,
    spreadOn: stageU ? stageU.uSpreadOn.value : null,
    spreadY: stageU ? stageU.uSpreadY.value : null,
    revealY: stageU ? stageU.uRevealY.value : null,
    carveY: CARVE_U.uCarveY.value,
    doorProgress: CARVE_U.uDoorProgress.value,
    wallPhase: wallU ? wallU.uWallPhase.value : null,
    wallProgress: wallU ? wallU.uWallProgress.value : null,
    visibleWalkwayComponents: visibleCount(components),
    visibleTowerFloors: visibleCount(floors),
    visiblePegs: visibleCount(BUDDHA.parts.pegList || []),
    construction: { ...CONSTRUCTION.state },
    camera: {
      x: (APP.free ? freeCam : camera).position.x,
      y: (APP.free ? freeCam : camera).position.y,
      z: (APP.free ? freeCam : camera).position.z,
      fov: (APP.free ? freeCam : camera).fov,
    },
  };
}

function installDebugAPI() {
  window.MOGAO = {
    APP, THREE, BUDDHA, WORLD, PROPS, CAVE, PHASE, CONSTRUCTION,
    duration: DURATION,
    chapters: CHAPTERS.map((x, i) => ({ index: i, time: x[0], name: x[1] })),
    get scene() { return scene; },
    get camera() { return APP.free ? freeCam : camera; },
    get renderer() { return renderer; },
    get tower() { return tower; },
    get walkway() { return walkway; },
    seek(t) {
      APP.time = clamp(Number(t) || 0, 0, DURATION);
      APP.playUntil = null;
      APP.playFromChapter = -1;
      APP.playing = false;
      APP.dirty = true;
      elPlay.textContent = '▶';
      renderFrame(APP.time, 0);
      return visualState();
    },
    renderAt(t) {
      APP.time = clamp(Number(t) || 0, 0, DURATION);
      APP.playUntil = null;
      APP.playFromChapter = -1;
      APP.playing = false;
      APP.dirty = true;
      elPlay.textContent = '▶';
      renderFrame(APP.time, 0);
      return visualState();
    },
    play() { APP.playUntil = null; APP.playFromChapter = -1; APP.playing = true; APP.dirty = true; elPlay.textContent = '⏸'; },
    pause() { APP.playUntil = null; APP.playFromChapter = -1; APP.playing = false; elPlay.textContent = '▶'; },
    playChapter(index) {
      const i = clamp(Math.floor(Number(index) || 0), 0, CHAPTERS.length - 1);
      chapterButtons[i].click();
      return { index: i, from: CHAPTERS[i][0], until: APP.playUntil };
    },
    tick(seconds) {
      const advanced = advancePlayback(Number(seconds) || 0);
      renderFrame(APP.time, advanced ? Number(seconds) || 0 : 0);
      return visualState();
    },
    setSpeed(v) {
      APP.speed = clamp(Number(v) || 1, 0.25, 2);
      const select = document.getElementById('speed');
      if (select) select.value = String(APP.speed);
      return APP.speed;
    },
    setFree(on) { setFreeMode(on); renderFrame(APP.time, 0); return APP.free; },
    setTestMode(on) {
      APP.renderSuspended = !!on;
      if (APP.renderSuspended) { APP.playing = false; elPlay.textContent = '▶'; }
      clock.getDelta();
      return APP.renderSuspended;
    },
    state: visualState,
    stats() {
      return {
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        lines: renderer.info.render.lines,
        points: renderer.info.render.points,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        pixelRatio: renderer.getPixelRatio(),
        canvas: { width: renderer.domElement.width, height: renderer.domElement.height },
        construction: { ...CONSTRUCTION.state },
      };
    },
  };
}

/* ============================================================
   启动
   ============================================================ */
(function boot() {
  window.__READY__ = false;
  window.__BOOT_ERROR__ = null;
  const bar = document.getElementById('lbar');
  const txt = document.getElementById('ltxt');
  buildAllTextures((p, name) => {
    bar.style.width = (p * 100).toFixed(0) + '%';
    txt.textContent = `正在烘焙材质 ${(p * 100) | 0}% · ${name}`;
  }).then(() => {
    txt.textContent = '正在构建洞窟、大佛与施工系统…';
    requestAnimationFrame(() => {
      try { init(); }
      catch (err) {
        window.__BOOT_ERROR__ = String(err && (err.stack || err.message) || err);
        txt.textContent = '出错：' + (err.message || err);
        console.error(err);
      }
    });
  }).catch((err) => {
    window.__BOOT_ERROR__ = String(err && (err.stack || err.message) || err);
    txt.textContent = '材质构建失败：' + (err.message || err);
    console.error(err);
  });
})();
