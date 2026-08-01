/* ============================================================
   90 - 主程序：确定性状态机 / 渲染循环 / 交互 / 自检接口
   ============================================================ */

const APP = {
  time: 0,
  playing: false,
  speed: 1,
  free: false,
  renderSuspended: false,
  qaNoRender: false,
  quality: 1,
  dirty: true,
  currentStep: -1,
  playUntil: null,
  playFromChapter: -1,
  baseExposure: 1.06,
  focusDistance: 70,
};

let renderer, scene, camera, freeCam, debris, tower, walkway, decorGroup, forecourt, clock;
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
  const pixelCap = (typeof innerWidth !== 'undefined' && innerWidth <= 680) ? 1.0 : 1.5;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, pixelCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = APP.baseExposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  initPostFX(renderer);

  scene = new THREE.Scene();
  APP.skyBackground = TEX.sky.map;
  APP.skyFogColor = new THREE.Color(0xC7BBA4);
  APP.sectionBackground = new THREE.Color(0x655747);
  APP.sectionFogColor = new THREE.Color(0x7C6A57);
  scene.background = APP.skyBackground;
  scene.environment = null;
  scene.fog = new THREE.Fog(APP.skyFogColor, 245, 820);

  camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.42, 1400);
  freeCam = new THREE.PerspectiveCamera(45, 16 / 9, 0.42, 1400);

  /* ---------------- 电影化日照 + 洞窟反弹光 ---------------- */
  scene.add(new THREE.AmbientLight(0xFFF8EE, 0.32));
  scene.add(new THREE.HemisphereLight(0xCFE5EA, 0x9A795D, 0.62));

  const sun = new THREE.DirectionalLight(0xFFF2D8, 2.55);
  sun.position.set(92, 118, 106); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera,{left:-100,right:100,top:92,bottom:-55,near:18,far:410});
  sun.shadow.bias=-0.0008; sun.shadow.normalBias=0.38;
  sun.target.position.set(0,20,2); scene.add(sun,sun.target);

  const skyFill = new THREE.DirectionalLight(0xD8E8EC, 0.45);
  skyFill.position.set(-78,54,128); skyFill.target.position.set(0,23,0); scene.add(skyFill,skyFill.target);
  const sandBounce = new THREE.DirectionalLight(0xDDBB96, 0.26);
  sandBounce.position.set(0,-18,86); sandBounce.target.position.set(0,18,0); scene.add(sandBounce,sandBounce.target);
  const rim = new THREE.DirectionalLight(0xDCE2DF, 0.48);
  rim.position.set(-82,70,-56); rim.target.position.set(0,26,0); scene.add(rim,rim.target);

  const inner = new THREE.PointLight(0xF6DEC3, 62, 132, 1.62);
  inner.position.set(0,25,18); scene.add(inner); APP.innerLight=inner;
  const faceKey = new THREE.SpotLight(0xFFF1E2, 96, 118, Math.PI/4.6,0.72,1.55);
  faceKey.position.set(18,36,44); faceKey.target.position.set(0,29.6,-0.5); scene.add(faceKey,faceKey.target);
  const caveRim = new THREE.SpotLight(0xC9DFE7, 62, 122, Math.PI/4.2,0.76,1.68);
  caveRim.position.set(-28,32,-15); caveRim.target.position.set(0,23,2); scene.add(caveRim,caveRim.target);
  const workFill = new THREE.PointLight(0xFFE2C6, 64, 112, 1.55);
  workFill.position.set(-8, 27, 37); scene.add(workFill); APP.workFill = workFill;
  const wallKey = new THREE.PointLight(0xFFF0D7, 0, 112, 1.28);
  wallKey.position.set(0, 23, 12); scene.add(wallKey); APP.wallKey = wallKey;
  const bodyFill = new THREE.SpotLight(0xF7E7D6, 0, 120, Math.PI/3.2, 0.82, 1.42);
  bodyFill.position.set(-18, 25, 50); bodyFill.target.position.set(0, 22, 0); scene.add(bodyFill, bodyFill.target); APP.bodyFill = bodyFill;
  const lowerFill = new THREE.PointLight(0xFFE4C5, 0, 96, 1.38);
  lowerFill.position.set(8, 11, 34); scene.add(lowerFill); APP.lowerFill = lowerFill;
  const towerKey = new THREE.SpotLight(0xFFE9D4, 0, 285, Math.PI/3.8, 0.76, 1.30);
  towerKey.position.set(22, 45, 148); towerKey.target.position.set(0, 24, CLIFF_Z + 10); scene.add(towerKey, towerKey.target); APP.towerKey = towerKey;
  const cliffLift = new THREE.DirectionalLight(0xE3D6C6, 0.46);
  cliffLift.position.set(-36, 48, 136); cliffLift.target.position.set(0, 24, CLIFF_Z); scene.add(cliffLift, cliffLift.target);
  APP.faceKey = faceKey; APP.caveRim = caveRim;

  /* ---------------- 场景 ---------------- */
  buildWorld(scene);
  buildSmallCaves(WORLD.group);

  const buddha = buildBuddha();
  scene.add(buddha);
  buildPegs(buddha);

  tower = buildNineStorey();
  tower.position.set(0, 0, CLIFF_Z + 2.4);
  tower.scale.set(1.42, 1.55, 1.38);
  scene.add(tower);

  walkway = buildWalkway();
  scene.add(walkway);

  forecourt = buildForecourt();
  scene.add(forecourt);
  WORLD.forecourt = forecourt;

  decorGroup = new THREE.Group();
  decorGroup.name = 'ExteriorDecor';
  scene.add(decorGroup);
  {
    // 只保留疏朗的白塔、枯树和风蚀石，去掉基线里现代园林式花坛与对称寺院。
    const st = [
      [-34,CLIFF_Z+72,1.05],[42,CLIFF_Z+82,0.92],[-72,CLIFF_Z+110,0.82],[70,CLIFF_Z+122,0.78],
    ];
    st.forEach(([x,z,k])=>{const o=buildStupa(k);o.position.set(x,0,z);decorGroup.add(o);});
    for (const [x,z,h,seed] of [[-40,72,7.8,2],[48,80,7.2,3],[-72,108,6.4,4],[70,116,6.0,5],[-8,150,5.2,6]]) {
      const tr=buildTree(h,seed);tr.position.set(x,0,CLIFF_Z+z);tr.scale.set(1,0.82,1);decorGroup.add(tr);
    }
  }

  // 兼容旧对象，但不再用帧累积粒子；施工特效全部由绝对时间重建。
  debris = new DebrisPool(scene, 48);
  debris.mesh.visible = false;
  buildProps(scene);
  buildConstruction(scene, tower, walkway);
  buildExhibitStages(scene);
  installCinematicEnhancements(scene, tower, walkway);

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
   画布尺寸：横屏 16:9，自适应浏览器可用区域
   ------------------------------------------------------------ */
function onResize() {
  const wrap=document.getElementById('stage');
  const aw=Math.max(1,wrap.clientWidth), ah=Math.max(1,wrap.clientHeight), aspect=16/9;
  let w=aw,h=w/aspect;if(h>ah){h=ah;w=h*aspect;}
  w=Math.max(1,Math.floor(w));h=Math.max(1,Math.floor(h));
  const el=renderer.domElement;el.style.width=w+'px';el.style.height=h+'px';
  elSvg.style.width=w+'px';elSvg.style.height=h+'px';elSvg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  elHud.style.width=w+'px';elHud.style.height=h+'px';
  renderer.setSize(w,h,false);resizePostFX(w,h,renderer.getPixelRatio());
  camera.aspect=w/h;camera.updateProjectionMatrix();freeCam.aspect=w/h;freeCam.updateProjectionMatrix();
  APP.vw=w;APP.vh=h;APP.dirty=true;
}

/* ============================================================
   状态机：每个画面只由绝对时间决定，可任意 seek
   ============================================================ */
function applySculptState(t, carveY) {
  let phase = CURVE_PHASE(t);
  let morph = CURVE_MORPH(t);
  const revealK = easeInOut(windowK(t, 36.2, 40.8));
  const opts = {
    time: t,
    revealOn: t >= 36.2 && t < 40.8,
    revealY: lerp(BUDDHA_H + 2.0, -2.0, revealK),
  };

  const w = activeMudWindow(t);
  if (w) {
    const dir = w.dir || 1;
    const k = w.a >= 90 ? easeOut(w.k) : easeInOut(w.k);
    const front = dir > 0
      ? lerp(-3.0, BUDDHA_H + 3.0, k)
      : lerp(BUDDHA_H + 3.0, -3.0, k);
    phase = w.toP;
    morph = w.toM;
    Object.assign(opts, {
      spread: true,
      spreadY: front,
      spreadSoft: dir < 0 ? (w.a >= 90 ? 4.10 : 1.70) : 1.28,
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
  /* 小门开凿时先显示贴在崖面后的暗口；甬道阶段再显露真实墙厚，避免悬浮的拱形木板感。 */
  const doorFaceVisible = t >= 24.50 && t < 31.0 && doorProgress > 0.035;
  const tunnelVisible = t >= 26.65 && t < 31.0 && doorProgress > 0.82;
  if (WORLD.doorTunnel) WORLD.doorTunnel.visible = tunnelVisible;
  if (WORLD.doorBack) {
    WORLD.doorBack.visible = doorFaceVisible;
    WORLD.doorBack.position.z = t < 26.65
      ? CLIFF_Z - 0.82
      : lerp(CLIFF_Z - 0.82, CLIFF_Z - 17.85, easeInOut(windowK(t, 26.65, 29.7)));
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
  const excavationOn = t >= 26.7 && t < 51.6;
  /*
    开凿阶段始终保留完整砂岩实体，洞腔由 carve shader 从真实崖体中挖出。
    禁用旧的开放式“展箱”断面；甬道、洞顶和下降施工面通过洞口直接观察。
  */
  if (WORLD.cliffBody) WORLD.cliffBody.visible = true;
  if (WORLD.cliffFace) WORLD.cliffFace.visible = true;
  if (WORLD.dune) WORLD.dune.visible = true;
  if (WORLD.sectionFrame) WORLD.sectionFrame.visible = false;
  if (WORLD.excavationCeiling) WORLD.excavationCeiling.visible = false;
  if (WORLD.caveBackdrop) WORLD.caveBackdrop.visible = excavationOn;
  if (WORLD.excavationVoid) WORLD.excavationVoid.visible = excavationOn;
  if (WORLD.excavationRim) {
    /* 顶板初凿先直接读取真实洞口；下降开凿后再以崩蚀岩缘强化尺度。 */
    const rimOn = t >= 36.4 && t < 51.6;
    WORLD.excavationRim.visible = rimOn;
    if (rimOn && WORLD.excavationRim.userData.bottom) {
      WORLD.excavationRim.userData.bottom.position.y = clamp(carve.carveY - 1.5, 1.0, 37.8);
    }
  }
  if (WORLD.arch) WORLD.arch.visible = !excavationOn && !(t >= 110.6);
  if (WORLD.towerCliffWings) WORLD.towerCliffWings.visible = t < 15.2 || t >= 110.6;
  setSectionX(99999);
  if (WORLD.sideWalls) {
    WORLD.sideWalls.left.visible = true;
    WORLD.sideWalls.right.visible = true;
  }
  scene.background = APP.skyBackground;
  scene.fog.color.copy(APP.skyFogColor);
  const sculpt = applySculptState(t, carve.carveY);

  /* 佛像在开凿阶段由高度阈值从石胎中显露，不做整尊跳变。 */
  const excavationReveal = t >= 36.2 && t < 51.9;
  const wallFocus = 1.0;
  const towerClosure = t >= 111.4 ? 1 - easeInOut(windowK(t, 111.4, 114.1)) : 1;
  const preCoreExcavation = t >= 30.2 && t < 36.2;
  const bop = (preCoreExcavation ? 0 : (excavationReveal ? 1 : CURVE_BOPA(t))) * wallFocus * towerClosure;
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
  const haloOpacity = CURVE_HALO(t) * bop * 0.90;
  for (const m of BUDDHA.haloMats) m.opacity = haloOpacity;

  // 螺发的逐颗显露/上色由施工系统接管，避免整组缩放。
  if (BUDDHA.parts.hair) BUDDHA.parts.hair.scale.setScalar(1);
  if (BUDDHA.parts.robeRelief) BUDDHA.parts.robeRelief.visible = t < 15.2 || t >= 56.0;

  setWallPhase(CURVE_WALL(t));
  clearWallTransition();

  tower.visible = true;
  walkway.visible = t >= 19.15 && t < 30.2;
  if (decorGroup) decorGroup.visible = t < 26.6 || t >= 108.4;
  if (forecourt) forecourt.visible = t < 15.2 || t >= 108.4;

  const caveOpen = carve.complete
    ? 1
    : clamp((CAVE.yTop + 1 - carve.carveY) / (CAVE.yTop + 1), 0, 1);
  APP.innerLight.intensity = lerp(76, 158, easeOut(caveOpen));
  if (APP.workFill) APP.workFill.intensity = (t >= 26.7 && t < 51.6) ? 138 : (t >= 24.2 && t < 95.4 ? 96 : 44);
  if (APP.faceKey) APP.faceKey.intensity = t >= 56.0 ? (t < 95.4 ? (t>=83.0&&t<90.2?82:94) : 92) : 68;
  if (APP.bodyFill) APP.bodyFill.intensity = (t >= 56.0 && t < 95.4) ? (t>=83.0&&t<90.2?72:90) : ((t < 15.2 || t >= 108.6) ? 52 : (t >= 98.7 && t < 108.6 ? 48 : 0));
  if (APP.lowerFill) APP.lowerFill.intensity = (t >= 51.6 && t < 95.4) ? (t>=83.0&&t<90.2?78:96) : ((t < 15.2 || t >= 108.6) ? 34 : 0);
  if (APP.wallKey) APP.wallKey.intensity = (t >= 98.7 && t < 108.6) ? 84 : 0;
  if (APP.towerKey) APP.towerKey.intensity = (t < 15.2 || t >= 110.6) ? 176 : 0;
  const finalCliffLift = (t < 15.2 || t >= 110.6);
  for (const cliffMat of [WORLD.cliffMat, WORLD.cliffBody && WORLD.cliffBody.material]) {
    if (!cliffMat || !cliffMat.emissive) continue;
    cliffMat.emissive.setHex(finalCliffLift ? 0x5E5A52 : 0x000000);
    cliffMat.emissiveIntensity = finalCliffLift ? 0.10 : 0;
  }
  WORLD.plinth.visible = t < 15.2 || t >= 51.55;

  const construction = updateConstruction(t);
  updateExhibitStages(t, carve);
  updateCinematicEnhancements(t);
  APP.lastVisualState = { t, ...sculpt, ...carve, construction };
  return APP.lastVisualState;
}

/* ============================================================
   相机 / 单帧渲染
   ============================================================ */
function exposureBoostAt(t) {
  if (t >= 87.2 && t < 90.2) return -0.15;
  if (t >= 83.0 && t < 90.2) return -0.045;
  if (t >= 56.0 && t < 95.4) return 0.035;
  if (t >= 110.6) return 0.12;
  if (t < 15.2) return 0.06;
  if (t >= 15.2 && t < 26.7) return 0.04;
  if (t >= 26.7 && t < 51.6) return 0.18;
  if (t >= 98.7 && t < 108.6) return 0.045;
  return 0.04;
}
function setScriptedCamera(t) {
  const s = shotAt(t);
  const fb = constructionCameraFeedback();
  const look = new THREE.Vector3(s.lx + fb.x * 0.14, s.ly + fb.y * 0.10, s.lz);
  const pos = new THREE.Vector3(s.px + fb.x, s.py + fb.y, s.pz + fb.z);
  /* The reference-led relief's face sits lower than the legacy procedural head.  Keep the
     polishing close-up on the eyes, robe and moving surface tools instead of the halo rim. */
  const polishCloseup = t >= 87.2 && t < 90.2;
  if (polishCloseup) {
    const k = easeInOut(clamp((t - 87.2) / 3.0, 0, 1));
    pos.set(lerp(6.5,-4.5,k),29.6,32.0);
    look.set(0,28.3,10.2);
  }
  /* Portrait browser windows still host a 16:9 canvas, but the stage card and controls reduce
     usable height. Pull back opening/final establishing shots so the complete tower remains readable. */
  const narrow = typeof innerWidth !== 'undefined' && (innerWidth / Math.max(1, innerHeight) < 1.05 || innerWidth <= 680);
  if (narrow && (t < 15.2 || t >= 108.6)) {
    const delta = pos.clone().sub(look);
    pos.copy(look).addScaledVector(delta, 1.42);
  }
  camera.position.copy(pos);
  camera.lookAt(look);
  const fov = clamp((polishCloseup ? 29.0 : s.fov) - fb.fov + (narrow && (t < 15.2 || t >= 108.6) ? 3.2 : 0), 22, 60);
  if (Math.abs(camera.fov - fov) > 0.001) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  renderer.toneMappingExposure = APP.baseExposure + exposureBoostAt(t) + fb.exposure;
  APP.focusDistance = Math.max(4, camera.position.distanceTo(look));
}

function renderFrame(t, dt) {
  const state = applyState(t, dt);
  const cam = APP.free ? freeCam : camera;
  if (APP.free) {
    updateFreeCam(dt);
    renderer.toneMappingExposure = APP.baseExposure + exposureBoostAt(t) + constructionCameraFeedback().exposure * 0.45;
  } else {
    setScriptedCamera(t);
  }

  updateProps(t, cam);
  updateAnnotations(t, cam, APP.vw, APP.vh);
  updateTimelineUI(t);
  renderPostFX(renderer, scene, cam, APP.free ? 72 : APP.focusDistance, t);
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
      if (!APP.qaNoRender) renderFrame(APP.time, 0);
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
  if (!APP.qaNoRender) renderFrame(APP.time, 0);
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
    freeOrbit: {
      yaw: FREE.yaw, pitch: FREE.pitch, dist: FREE.dist,
      target: { x: FREE.target.x, y: FREE.target.y, z: FREE.target.z },
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
      if (!APP.qaNoRender) renderFrame(APP.time, advanced ? Number(seconds) || 0 : 0);
      return visualState();
    },
    setSpeed(v) {
      APP.speed = clamp(Number(v) || 1, 0.25, 2);
      const select = document.getElementById('speed');
      if (select) select.value = String(APP.speed);
      return APP.speed;
    },
    setFree(on) { setFreeMode(on); renderFrame(APP.time, 0); return APP.free; },
    setQANoRender(on) { APP.qaNoRender = !!on; return APP.qaNoRender; },
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
