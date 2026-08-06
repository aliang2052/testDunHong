/* ============================================================
   65 - 可感知施工系统
   所有动画由绝对时间决定：可 seek、可章节跳转、无需依赖上一帧。
   ============================================================ */

const CONSTRUCTION = {
  group: null,
  cutBlocks: null,
  chips: null,
  dust: null,
  pigment: null,
  tools: [],
  mudPatches: null,
  cracks: null,
  straw: null,
  cotton: null,
  droplets: null,
  walkway: null,
  tower: null,
  state: { stage: 'complete', progress: 0, impact: 0, activeGeometry: 0 },
  feedback: { x: 0, y: 0, z: 0, fov: 0, exposure: 0 },
  debug: { stage: 'complete', progress: 0, activeTool: 'none', movingPieces: 0, dustCount: 0, geometrySignal: 0 },
  camera: null, hammer: null, chisel: null, trowel: null, brush: null,
  cutCircleGeo: null,
  cutArchGeo: null,
  sectionBackdrop: null,
  excavationLayers: [],
};

const _cgM = new THREE.Matrix4();
const _cgQ = new THREE.Quaternion();
const _cgP = new THREE.Vector3();
const _cgS = new THREE.Vector3();
const _cgA = new THREE.Vector3();
const _cgB = new THREE.Vector3();
const _cgC = new THREE.Vector3();
const _cgUp = new THREE.Vector3(0, 1, 0);
const _cgForward = new THREE.Vector3(0, 0, 1);

function frac(v) { return v - Math.floor(v); }
function pulse01(x, width = 0.18) {
  const p = frac(x);
  return p < width ? Math.pow(1 - p / width, 2.2) : 0;
}
function windowK(t, a, b) { return clamp((t - a) / Math.max(0.0001, b - a), 0, 1); }
function hideInstance(mesh, i) {
  _cgM.compose(_cgP.set(0, -9999, 0), _cgQ.identity(), _cgS.set(0.0001, 0.0001, 0.0001));
  mesh.setMatrixAt(i, _cgM);
}
function setInstance(mesh, i, p, q, s) {
  _cgM.compose(p, q, s);
  mesh.setMatrixAt(i, _cgM);
}
function hideAllInstances(mesh) {
  for (let i = 0; i < mesh.count; i++) hideInstance(mesh, i);
  mesh.instanceMatrix.needsUpdate = true;
}

function makeDustTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,244,220,0.96)');
  g.addColorStop(0.24, 'rgba(226,188,132,0.72)');
  g.addColorStop(0.62, 'rgba(166,120,78,0.25)');
  g.addColorStop(1, 'rgba(90,60,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeParticleCloud(scene, count, color, size) {
  const pos = new Float32Array(count * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.PointsMaterial({
    color, size, map: makeDustTexture(), transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.NormalBlending, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  return { points, pos, count, seeds: Array.from({ length: count }, (_, i) => ({
    a: hash3(i * 7, 11, 3) * TAU,
    r: 0.25 + hash3(i * 13, 5, 17) * 1.8,
    phase: hash3(i * 29, 23, 9),
    lift: 0.25 + hash3(i * 31, 41, 5) * 1.45,
    drift: hash3(i * 47, 3, 29) - 0.5,
  })) };
}

function makeHammerRig(scale = 1) {
  const root = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x87909A, roughness: 0.34, metalness: 0.78 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x4B535C, roughness: 0.42, metalness: 0.62 });
  const wood = new THREE.MeshStandardMaterial({ map: TEX.wood.map, normalMap: TEX.wood.normal, roughness: 0.86 });

  const chisel = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.14, 2.55, 8), darkSteel);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 1.15;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.55, 8), steel);
  tip.rotation.x = -Math.PI / 2;
  tip.position.z = -0.28;
  chisel.add(shaft, tip);
  root.add(chisel);

  const pivot = new THREE.Group();
  pivot.position.set(0.15, 1.65, 2.3);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 3.2, 9), wood);
  handle.position.y = 1.1;
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.62, 0.72), steel);
  head.position.y = 2.65;
  head.rotation.z = 0.08;
  pivot.add(handle, head);
  root.add(pivot);

  root.scale.setScalar(scale);
  root.userData.hammerPivot = pivot;
  root.userData.chisel = chisel;
  root.visible = false;
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return root;
}

function makeTrowelRig(scale = 1, brush = false) {
  const root = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xC9CDD1, roughness: 0.2, metalness: 0.85 });
  const wood = new THREE.MeshStandardMaterial({ map: TEX.wood.map, normalMap: TEX.wood.normal, roughness: 0.82 });
  const bristle = new THREE.MeshStandardMaterial({ color: brush ? 0x8D4A2D : 0xBD8B58, roughness: 0.96 });
  if (brush) {
    const ferrule = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.42, 0.34), metal);
    ferrule.position.z = 0.28;
    const hair = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.85, 0.22), bristle);
    hair.position.set(0, -0.56, 0.05);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 2.4, 9), wood);
    handle.position.y = 1.35;
    root.add(ferrule, hair, handle);
  } else {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.35, 0.16), metal);
    blade.position.z = 0.02;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.13, 0.65, 8), metal);
    neck.rotation.x = Math.PI / 2;
    neck.position.z = 0.46;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.7, 10), wood);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(-1.85, 0, 0.75);
    root.add(blade, neck, handle);
  }
  root.scale.setScalar(scale);
  root.visible = false;
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return root;
}

function pointOnFront(y, lateral = 0, outP = new THREE.Vector3(), outN = new THREE.Vector3()) {
  const a = lateral * 0.62;
  let u = a / TAU;
  if (u < 0) u += 1;
  bodyPoint(u, clamp(y / BUDDHA_H, 0.002, 0.998), outP);
  bodyNormal(u, clamp(y / BUDDHA_H, 0.002, 0.998), outN);
  return { p: outP, n: outN };
}

function orientZTo(q, n) {
  return q.setFromUnitVectors(_cgForward, n.clone().normalize());
}

function buildConstruction(scene, tower, walkway) {
  const G = new THREE.Group();
  G.name = 'ConstructionSystem';
  scene.add(G);
  CONSTRUCTION.group = G;
  CONSTRUCTION.tower = tower;
  CONSTRUCTION.walkway = walkway;

  /* 大体量脱落岩块 */
  {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const pa = geo.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const s = 0.70 + hash3(i * 3, 19, 31) * 0.65;
      pa.setXYZ(i, pa.getX(i) * s, pa.getY(i) * s * (0.72 + hash3(i, 8, 4) * 0.28), pa.getZ(i) * s);
    }
    pa.needsUpdate = true;
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      map: TEX.rockCore.map, normalMap: TEX.rockCore.normal,
      color: 0xB48757, roughness: 0.98,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, 112);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    G.add(mesh);
    CONSTRUCTION.cutBlocks = mesh;
    hideAllInstances(mesh);
  }

  /* 撞击小碎屑 */
  {
    const geo = new THREE.TetrahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x9B7048, roughness: 0.96 });
    const mesh = new THREE.InstancedMesh(geo, mat, 72);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    G.add(mesh);
    CONSTRUCTION.chips = mesh;
    hideAllInstances(mesh);
  }

  CONSTRUCTION.dust = makeParticleCloud(G, 180, 0xD8B98C, 1.45);
  CONSTRUCTION.pigment = makeParticleCloud(G, 96, 0xD8A442, 0.52);

  /* 两套锤凿，主开凿镜头中同时工作 */
  for (let i = 0; i < 2; i++) {
    const rig = makeHammerRig(i === 0 ? 1.0 : 0.84);
    G.add(rig);
    CONSTRUCTION.tools.push(rig);
  }

  /* 主剖切面：带洞腔开口的实体岩层截面，避免剖切后露出纯背景 */
  {
    const sectionShape = new THREE.Shape();
    sectionShape.moveTo(-31, -12);
    sectionShape.lineTo(31, -12);
    sectionShape.lineTo(31, 54);
    sectionShape.lineTo(-31, 54);
    sectionShape.closePath();
    const caveHole = new THREE.Path();
    caveHole.moveTo(-10.4, -1.2);
    caveHole.lineTo(11.9, -1.2);
    caveHole.lineTo(11.9, 41.2);
    caveHole.lineTo(-10.4, 41.2);
    caveHole.closePath();
    sectionShape.holes.push(caveHole);
    const sectionGeo = new THREE.ShapeGeometry(sectionShape, 8);
    const spa = sectionGeo.attributes.position;
    const suv = sectionGeo.attributes.uv;
    for (let i = 0; i < suv.count; i++) {
      suv.setXY(i, (spa.getX(i) + 31) / 9.0, (spa.getY(i) + 12) / 9.0);
    }
    suv.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({
      map: TEX.rockCore.map, normalMap: TEX.rockCore.normal, color: 0xB98554,
      roughness: 1.0, metalness: 0, transparent: true, opacity: 0.0,
      side: THREE.DoubleSide, depthWrite: true,
    });
    const plane = new THREE.Mesh(sectionGeo, mat);
    plane.rotation.y = Math.PI / 2;
    plane.position.set(4.05, 0, -0.7);
    plane.receiveShadow = true;
    G.add(plane);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(sectionGeo, 18),
      new THREE.LineBasicMaterial({ color: 0xFFB34D, transparent: true, opacity: 0 }));
    edge.rotation.copy(plane.rotation);
    edge.position.copy(plane.position);
    G.add(edge);
    CONSTRUCTION.sectionPlane = plane;
    CONSTRUCTION.sectionEdge = edge;

    const frontMat = new THREE.MeshBasicMaterial({ color: 0xF0A343, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    CONSTRUCTION.cutCircleGeo = new THREE.CircleGeometry(13.5, 48);
    CONSTRUCTION.cutArchGeo = new THREE.RingGeometry(9.2, 10.2, 48, 1, 0, Math.PI);
    const front = new THREE.Mesh(CONSTRUCTION.cutCircleGeo, frontMat);
    front.rotation.x = -Math.PI / 2;
    front.position.set(0, 40, -1);
    G.add(front);
    CONSTRUCTION.cutFront = front;

    // 固定在剖切后方的深色岩层背景：关闭被切开的世界，而不遮挡洞腔、石胎和工具。
    const backdropMat = new THREE.MeshStandardMaterial({
      map: TEX.rockCore.map, normalMap: TEX.rockCore.normal, color: 0x594434,
      roughness: 1.0, metalness: 0, side: THREE.DoubleSide,
      transparent: true, opacity: 0, depthWrite: true,
    });
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(76, 76, 1, 1), backdropMat);
    backdrop.rotation.y = Math.PI / 2;
    backdrop.position.set(CAVE.x0 - 4.0, 24, -1.0);
    backdrop.receiveShadow = true;
    backdrop.visible = false;
    G.add(backdrop);
    CONSTRUCTION.sectionBackdrop = backdrop;
  }

  /* 栈道材料堆、吊装绳 */
  {
    const grp = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ map: TEX.wood.map, normalMap: TEX.wood.normal, roughness: 0.9 });
    for (let i = 0; i < 14; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.34, 0.42), wood);
      b.position.set(61 + (i % 2) * 0.5, 0.3 + Math.floor(i / 2) * 0.38, CLIFF_Z + 31 + (i % 3) * 0.55);
      b.rotation.y = (hash3(i, 2, 5) - 0.5) * 0.09;
      b.castShadow = true;
      grp.add(b);
    }
    const ropeGeo = new THREE.BufferGeometry();
    ropeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3).setUsage(THREE.DynamicDrawUsage));
    const rope = new THREE.Line(ropeGeo, new THREE.LineBasicMaterial({ color: 0x403329, linewidth: 2 }));
    grp.add(rope);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 6, 14, Math.PI * 1.55),
      new THREE.MeshStandardMaterial({ color: 0x4E5154, roughness: 0.5, metalness: 0.72 }));
    hook.rotation.z = Math.PI * 0.48;
    grp.add(hook);
    G.add(grp);
    CONSTRUCTION.walkPile = grp;
    CONSTRUCTION.walkRope = rope;
    CONSTRUCTION.walkHook = hook;
  }

  /* 木桩孔 */
  {
    const holes = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x19130F, roughness: 1 });
    if (BUDDHA.parts.pegList) {
      for (const peg of BUDDHA.parts.pegList) {
        const h = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.18, 16), mat);
        h.quaternion.copy(peg.userData.finalQuaternion);
        h.position.copy(peg.userData.finalPosition).addScaledVector(peg.userData.axis, -1.55);
        holes.add(h);
      }
    }
    holes.visible = false;
    G.add(holes);
    CONSTRUCTION.pegHoles = holes;
  }

  /* 泥团：短暂附着在施工前沿，随后由 shader 表面接管 */
  {
    const geo = new THREE.SphereGeometry(1, 10, 7);
    const mat = new THREE.MeshStandardMaterial({ map: TEX.mudCoarse.map, normalMap: TEX.mudCoarse.normal, color: 0xA68C68, roughness: 0.9 });
    const mesh = new THREE.InstancedMesh(geo, mat, 64);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    const data = [];
    const rnd = mulberry32(6102);
    for (let i = 0; i < mesh.count; i++) {
      const y = lerp(2.2, 33.8, (i + 0.5) / mesh.count) + (rnd() - 0.5) * 1.2;
      const lat = (rnd() - 0.5) * 1.36;
      const p = new THREE.Vector3(), n = new THREE.Vector3();
      pointOnFront(y, lat, p, n);
      data.push({ p: p.clone(), n: n.clone(), threshold: clamp(y / BUDDHA_H, 0, 1), s: 0.55 + rnd() * 0.78, phase: rnd(), lat });
    }
    mesh.userData.data = data;
    G.add(mesh);
    CONSTRUCTION.mudPatches = mesh;
    hideAllInstances(mesh);
  }

  /* 裂缝段 */
  {
    const geo = new THREE.CylinderGeometry(0.035, 0.075, 1, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3D3025, roughness: 1 });
    const mesh = new THREE.InstancedMesh(geo, mat, 46);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    const data = [];
    const rnd = mulberry32(6324);
    for (let i = 0; i < mesh.count; i++) {
      const y = lerp(4, 31, rnd());
      const lat = (rnd() - 0.5) * 1.2;
      const p = new THREE.Vector3(), n = new THREE.Vector3();
      pointOnFront(y, lat, p, n);
      const tangent = new THREE.Vector3(1, (rnd() - 0.5) * 1.5, 0).normalize();
      tangent.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_cgForward, n));
      data.push({ p: p.clone().addScaledVector(n, 0.2), dir: tangent, len: 0.55 + rnd() * 1.45, order: rnd(), n: n.clone() });
    }
    mesh.userData.data = data;
    G.add(mesh);
    CONSTRUCTION.cracks = mesh;
    hideAllInstances(mesh);
  }

  /* 麦秆纤维 */
  {
    const geo = new THREE.CylinderGeometry(0.028, 0.04, 1, 5);
    const mat = new THREE.MeshStandardMaterial({ color: 0xD2A044, roughness: 0.82 });
    const mesh = new THREE.InstancedMesh(geo, mat, 86);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    const data = [];
    const rnd = mulberry32(6811);
    for (let i = 0; i < mesh.count; i++) {
      const y = lerp(3, 32, rnd());
      const lat = (rnd() - 0.5) * 1.4;
      const p = new THREE.Vector3(), n = new THREE.Vector3();
      pointOnFront(y, lat, p, n);
      data.push({ p: p.clone(), n: n.clone(), len: 0.45 + rnd() * 0.9, order: clamp(y / BUDDHA_H + (rnd() - 0.5) * 0.08, 0, 1), spin: rnd() * TAU });
    }
    mesh.userData.data = data;
    G.add(mesh);
    CONSTRUCTION.straw = mesh;
    hideAllInstances(mesh);
  }

  /* 棉花团 */
  {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xF3EFE5, roughness: 0.98 });
    const mesh = new THREE.InstancedMesh(geo, mat, 48);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    const data = [];
    const rnd = mulberry32(7841);
    for (let i = 0; i < mesh.count; i++) {
      const y = lerp(6, 32, rnd());
      const lat = (rnd() - 0.5) * 1.2;
      const p = new THREE.Vector3(), n = new THREE.Vector3();
      pointOnFront(y, lat, p, n);
      data.push({ p: p.clone(), n: n.clone(), s: 0.15 + rnd() * 0.25, order: rnd(), phase: rnd() });
    }
    mesh.userData.data = data;
    G.add(mesh);
    CONSTRUCTION.cotton = mesh;
    hideAllInstances(mesh);
  }

  /* 蛋清米汁液滴 */
  {
    const geo = new THREE.SphereGeometry(1, 8, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0xF0E6C9, roughness: 0.18, transparent: true, opacity: 0.82 });
    const mesh = new THREE.InstancedMesh(geo, mat, 58);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    const data = [];
    const rnd = mulberry32(8342);
    for (let i = 0; i < mesh.count; i++) {
      const y = lerp(18, 32, rnd());
      const lat = (rnd() - 0.5) * 1.0;
      const p = new THREE.Vector3(), n = new THREE.Vector3();
      pointOnFront(y, lat, p, n);
      data.push({ p: p.clone(), n: n.clone(), s: 0.07 + rnd() * 0.13, order: rnd(), phase: rnd() });
    }
    mesh.userData.data = data;
    G.add(mesh);
    CONSTRUCTION.droplets = mesh;
    hideAllInstances(mesh);
  }

  /* 世界空间抹子 / 彩绘笔 / 壁画刷 */
  CONSTRUCTION.mudTrowels = [makeTrowelRig(0.66), makeTrowelRig(0.52)];
  CONSTRUCTION.polishTrowel = makeTrowelRig(0.78);
  CONSTRUCTION.paintBrush = makeTrowelRig(0.72, true);
  CONSTRUCTION.wallBrushes = [makeTrowelRig(0.92, true), makeTrowelRig(0.82, true), makeTrowelRig(0.74, true)];
  for (const o of [...CONSTRUCTION.mudTrowels, CONSTRUCTION.polishTrowel, CONSTRUCTION.paintBrush, ...CONSTRUCTION.wallBrushes]) G.add(o);

  /* 低开销冲击补光 */
  const flash = new THREE.PointLight(0xFFB45B, 0, 22, 2.1);
  scene.add(flash);
  CONSTRUCTION.flash = flash;

  /* 九层楼的有序装配目标 */
  if (tower && tower.userData.floors) {
    tower.userData.floors.forEach((floor, i) => {
      floor.userData.finalPosition = new THREE.Vector3(0, floor.userData.baseY, 0);
      floor.userData.finalQuaternion = new THREE.Quaternion();
      const side = i % 2 === 0 ? -1 : 1;
      floor.userData.stagingPosition = new THREE.Vector3(side * (34 + i * 4.5), floor.userData.baseY + 8 + i * 1.1, 18 + i * 2.2);
      floor.userData.stagingQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler((i - 4) * 0.035, side * (0.36 + i * 0.028), side * 0.08));
      floor.userData.assemblyDelay = (8 - i) * 0.055; // 拆解时先揭顶，复原时由下往上锁定
    });
  }

  hideConstructionTransient();
  return G;
}

function hideConstructionTransient() {
  for (const rig of CONSTRUCTION.tools) rig.visible = false;
  if (CONSTRUCTION.sectionPlane) {
    CONSTRUCTION.sectionPlane.material.opacity = 0;
    CONSTRUCTION.sectionPlane.visible = false;
    CONSTRUCTION.sectionEdge.material.opacity = 0;
    CONSTRUCTION.sectionEdge.visible = false;
  }
  if (CONSTRUCTION.sectionBackdrop) {
    CONSTRUCTION.sectionBackdrop.visible = false;
    CONSTRUCTION.sectionBackdrop.material.opacity = 0;
  }
  if (CONSTRUCTION.cutFront) { CONSTRUCTION.cutFront.visible = false; CONSTRUCTION.cutFront.material.opacity = 0; }
  if (CONSTRUCTION.walkPile) CONSTRUCTION.walkPile.visible = false;
  if (CONSTRUCTION.pegHoles) CONSTRUCTION.pegHoles.visible = false;
  for (const o of [...(CONSTRUCTION.mudTrowels || []), CONSTRUCTION.polishTrowel, CONSTRUCTION.paintBrush, ...(CONSTRUCTION.wallBrushes || [])]) if (o) o.visible = false;
  if (CONSTRUCTION.dust) { CONSTRUCTION.dust.points.visible = false; CONSTRUCTION.dust.points.material.opacity = 0; }
  if (CONSTRUCTION.pigment) { CONSTRUCTION.pigment.points.visible = false; CONSTRUCTION.pigment.points.material.opacity = 0; }
  if (CONSTRUCTION.flash) CONSTRUCTION.flash.intensity = 0;
}

function updateTowerConstruction(t) {
  const tower = CONSTRUCTION.tower;
  if (!tower || !tower.userData.floors) return { k: 0, moving: 0 };
  const k = CURVE_TOWER(t); // 0 完整，1 拆开
  let moving = 0;
  tower.visible = true;
  tower.userData.floors.forEach((floor) => {
    const delay = floor.userData.assemblyDelay || 0;
    const q = clamp((k - delay) / Math.max(0.001, 1 - delay), 0, 1);
    const e = easeInOut(q);
    const fp = floor.userData.finalPosition;
    const sp = floor.userData.stagingPosition;
    floor.position.lerpVectors(fp, sp, e);
    floor.position.y += Math.sin(e * Math.PI) * (5.5 + floor.userData.baseY * 0.04);
    floor.quaternion.slerpQuaternions(floor.userData.finalQuaternion, floor.userData.stagingQuaternion, e);
    floor.scale.setScalar(1 - Math.sin(e * Math.PI) * 0.035);
    floor.visible = q < 0.986 || t < 2.55 || t > 110.7;
    if (q > 0.015 && q < 0.985) moving++;
  });
  return { k, moving };
}

function updateWalkwayConstruction(t) {
  const walkway = CONSTRUCTION.walkway;
  if (!walkway || !walkway.userData.components) return { k: 0, moving: 0, built: 0 };
  const k = CURVE_WALK(t);
  const components = walkway.userData.components;
  const maxOrder = Math.max(1, ...components.map(c => c.userData.order || 0));
  let active = null;
  let moving = 0;
  let built = 0;
  for (const c of components) {
    const order = (c.userData.order || 0) / maxOrder;
    const q = clamp((k - order * 0.86) / 0.14, 0, 1);
    c.visible = q > 0.001;
    if (q <= 0.001) {
      c.position.copy(c.userData.startPosition);
      c.quaternion.copy(c.userData.startQuaternion);
      c.scale.setScalar(0.03);
      continue;
    }
    const e = easeOut(q);
    c.position.lerpVectors(c.userData.startPosition, c.userData.finalPosition, e);
    c.position.y += Math.sin(e * Math.PI) * (6.5 + order * 4.5);
    c.quaternion.slerpQuaternions(c.userData.startQuaternion, c.userData.finalQuaternion, easeInOut(q));
    const ss = lerp(0.08, 1, easeOut(q));
    c.scale.copy(c.userData.finalScale).multiplyScalar(ss);
    if (q > 0.05 && q < 0.94) { active = c; moving++; }
    if (q >= 0.94) built++;
  }

  const pile = CONSTRUCTION.walkPile;
  if (pile) {
    pile.visible = t >= 19.6 && t < 25.0;
    pile.children.forEach((o, i) => {
      if (o === CONSTRUCTION.walkRope || o === CONSTRUCTION.walkHook) return;
      o.visible = i / 14 > k * 0.72 - 0.12;
    });
    const top = _cgA.set(58, 27, CLIFF_Z + 28);
    const target = active ? active.getWorldPosition(_cgB) : _cgB.set(59, 1.2, CLIFF_Z + 31);
    const arr = CONSTRUCTION.walkRope.geometry.attributes.position.array;
    arr[0] = top.x; arr[1] = top.y; arr[2] = top.z;
    arr[3] = target.x; arr[4] = target.y; arr[5] = target.z;
    CONSTRUCTION.walkRope.geometry.attributes.position.needsUpdate = true;
    CONSTRUCTION.walkRope.visible = !!active;
    CONSTRUCTION.walkHook.visible = !!active;
    CONSTRUCTION.walkHook.position.copy(target).add(_cgC.set(0, 0.6, 0));
    CONSTRUCTION.walkHook.rotation.y = t * 1.8;
  }
  return { k, moving, built };
}

function excavationDescriptor(t) {
  if (t >= 24.55 && t < 27.0) {
    const k = easeOut(windowK(t, 24.55, 27.0));
    return { stage: 'door', k, center: new THREE.Vector3(0, lerp(31.4, 36.5, k), CLIFF_Z + 0.5), normal: new THREE.Vector3(0, 0, 1), scale: 1.0, start: 24.55 };
  }
  if (t >= 27.0 && t < 30.2) {
    const k = windowK(t, 27.0, 30.2);
    return { stage: 'tunnel', k, center: new THREE.Vector3(0, 34.8, lerp(CLIFF_Z + 0.4, -7.0, easeInOut(k))), normal: new THREE.Vector3(0, 0, 1), scale: 0.92, start: 27.0 };
  }
  if (t >= 30.2 && t < 37.0) {
    const k = windowK(t, 30.2, 37.0);
    return { stage: 'arch', k, center: new THREE.Vector3(0, lerp(CAVE.yTop, CAVE.yArch - 0.2, easeInOut(k)), CLIFF_Z + 0.7), normal: new THREE.Vector3(0, 0, 1), scale: 1.05, start: 30.2 };
  }
  if (t >= 37.0 && t < 46.2) {
    const cy = CURVE_CARVE(t);
    const k = windowK(t, 37.0, 46.2);
    return { stage: 'main', k, center: new THREE.Vector3(0, cy + 0.6, CLIFF_Z + 0.8), normal: new THREE.Vector3(0, 0, 1), scale: 1.25, start: 37.0, cy };
  }
  if (t >= 46.2 && t < 51.6) {
    const k = windowK(t, 46.2, 51.6);
    const upper = k < 0.52;
    const local = upper ? k / 0.52 : (k - 0.52) / 0.48;
    return { stage: 'lower', k, center: new THREE.Vector3(-7.5, upper ? 16.0 : 4.0, lerp(CLIFF_Z + 0.6, -3.0, easeInOut(local))), normal: new THREE.Vector3(0, 0, 1), scale: 1.1, start: upper ? 46.2 : 49.0, local };
  }
  return null;
}

function updateExcavationBlocks(t, d) {
  const mesh = CONSTRUCTION.cutBlocks;
  const chips = CONSTRUCTION.chips;
  for (let i = 0; i < mesh.count; i++) hideInstance(mesh, i);
  for (let i = 0; i < chips.count; i++) hideInstance(chips, i);
  if (!d) {
    mesh.instanceMatrix.needsUpdate = true;
    chips.instanceMatrix.needsUpdate = true;
    return 0;
  }

  let visible = 0;
  const q = new THREE.Quaternion();
  const largeLimit = d.stage === 'main' ? 14 : 10;
  for (let i = 0; i < largeLimit; i++) {
    const seed = hash3(i * 37 + Math.floor(d.start * 10), 19, 5);
    const age = frac((t - d.start) * (0.42 + seed * 0.10) + seed * 0.83);
    if (age > 0.30 || seed < 0.20) continue;
    const a = hash3(i * 7, 2, 31) * TAU;
    const spread = 1.2 + seed * 2.0;
    const p = _cgA.copy(d.center).add(_cgB.set(
      Math.cos(a) * spread * age,
      0.45 - age * age * 5.5,
      Math.sin(a) * spread * 0.35 + age * 2.4
    ));
    q.setFromEuler(new THREE.Euler(age * 3.2, age * (2.2 + seed), age * 2.4));
    const ss = (0.18 + seed * 0.32) * (1 - smoothstep(0.20, 0.31, age));
    setInstance(mesh, i, p, q, _cgS.set(ss * 1.25, ss * 0.82, ss));
    visible++;
  }

  const chipLimit = d.stage === 'main' || d.stage === 'lower' ? 22 : 15;
  for (let i = 0; i < chipLimit; i++) {
    const seed = hash3(i * 19 + Math.floor(d.start * 7), 23, 5);
    const age = frac((t - d.start) * (0.78 + seed * 0.24) + seed);
    if (age > 0.25 || seed < 0.28) continue;
    const a = hash3(i * 7, 2, 31) * TAU;
    const v = 1.8 + hash3(i * 13, 11, 17) * 3.8;
    const p = _cgA.copy(d.center).add(_cgB.set(
      Math.cos(a) * v * age,
      Math.sin(a) * v * age - age * age * 4.2,
      0.3 + v * age
    ));
    q.setFromEuler(new THREE.Euler(age * 6, age * 4, age * 7));
    const ss = (0.055 + seed * 0.11) * (1 - smoothstep(0.18, 0.26, age));
    setInstance(chips, i, p, q, _cgS.setScalar(ss));
    visible++;
  }
  mesh.instanceMatrix.needsUpdate = true;
  chips.instanceMatrix.needsUpdate = true;
  return visible;
}

function updateDustCloud(t, d) {
  const cloud = CONSTRUCTION.dust;
  if (!cloud) return 0;
  if (!d) {
    cloud.points.visible = false;
    cloud.points.material.opacity = 0;
    return 0;
  }
  cloud.points.visible = true;
  cloud.points.material.opacity = d.stage === 'main' || d.stage === 'lower' ? 0.24 : 0.18;
  cloud.points.material.size = d.stage === 'main' ? 1.05 : 0.88;
  const activeCount = d.stage === 'main' || d.stage === 'lower' ? 52 : 38;
  const arr = cloud.pos;
  for (let i = 0; i < cloud.count; i++) {
    if (i >= activeCount) {
      arr[i * 3] = 0; arr[i * 3 + 1] = -9999; arr[i * 3 + 2] = 0;
      continue;
    }
    const s = cloud.seeds[i];
    const age = frac((t - d.start) * (0.18 + s.phase * 0.10) + s.phase);
    const grow = Math.sin(Math.min(1, age * 1.5) * Math.PI * 0.5);
    const r = s.r * (0.25 + age * 1.35);
    const x = d.center.x + Math.cos(s.a) * r + s.drift * age * 1.5;
    const z = d.center.z + Math.sin(s.a) * r * 0.45 + age * 1.6;
    const y = d.center.y + s.lift * grow * 0.55 - age * age * 0.9;
    arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
  }
  cloud.points.geometry.attributes.position.needsUpdate = true;
  return activeCount;
}

function updateExcavationTools(t, d) {
  for (const tool of CONSTRUCTION.tools) tool.visible = false;
  if (CONSTRUCTION.flash) CONSTRUCTION.flash.intensity = 0;
  return 0;
}

function updateSectionAndFront(t, d) {
  const plane = CONSTRUCTION.sectionPlane;
  if (plane) {
    plane.visible = false;
    CONSTRUCTION.sectionEdge.visible = false;
    plane.material.opacity = 0;
    plane.material.depthWrite = false;
    CONSTRUCTION.sectionEdge.material.opacity = 0;
    if (CONSTRUCTION.sectionBackdrop) {
      CONSTRUCTION.sectionBackdrop.visible = false;
      CONSTRUCTION.sectionBackdrop.material.opacity = 0;
      CONSTRUCTION.sectionBackdrop.material.depthWrite = false;
    }
  }
  const front = CONSTRUCTION.cutFront;
  if (!front) return;
  front.visible = false;
  front.material.opacity = 0;
}

function updatePegConstruction(t) {
  const pegs = BUDDHA.parts.pegList || [];
  const grp = BUDDHA.parts.pegs;
  const on = t >= 56.2 && t < 64.8;
  if (grp) grp.visible = on;
  if (CONSTRUCTION.pegHoles) CONSTRUCTION.pegHoles.visible = on;
  if (!on) return { impact: 0, active: 0 };
  let active = -1;
  let activeK = 0;
  let completed = 0;
  for (let i = 0; i < pegs.length; i++) {
    const p = pegs[i];
    const st = 56.45 + i * 0.52;
    const k = clamp((t - st) / 0.58, 0, 1);
    p.visible = k > 0.001;
    p.scale.setScalar(k > 0.001 ? 1 : 0.001);
    p.quaternion.copy(p.userData.finalQuaternion);
    p.position.copy(p.userData.finalPosition).addScaledVector(p.userData.axis, (1 - easeOut(k)) * 3.2);
    if (k >= 1) completed++;
    if (k > 0 && k < 1) { active = i; activeK = k; }
  }
  if (active >= 0) {
    const tool = CONSTRUCTION.tools[0];
    const peg = pegs[active];
    tool.visible = true;
    tool.position.copy(peg.position).addScaledVector(peg.userData.axis, 1.6);
    orientZTo(tool.quaternion, peg.userData.axis);
    tool.scale.setScalar(0.72);
    const ph = frac((t - (56.45 + active * 0.52)) / 0.31);
    tool.userData.hammerPivot.rotation.x = ph < 0.68 ? lerp(-0.9, 0.1, easeInOut(ph / 0.68)) : lerp(0.1, -0.55, (ph - 0.68) / 0.32);
    const impact = pulse01((t - (56.45 + active * 0.52)) / 0.31, 0.24);
    if (CONSTRUCTION.flash) {
      CONSTRUCTION.flash.position.copy(peg.userData.finalPosition).addScaledVector(peg.userData.axis, -1.2);
      CONSTRUCTION.flash.intensity = impact * 170;
    }
    return { impact, active: active + activeK };
  }
  return { impact: 0, active: completed };
}

const MUD_WINDOWS = [
  { a: 62.4, b: 66.0, fromP: PHASE.ROCK, toP: PHASE.CRACK, fromM: 1.00, toM: 0.72, color: 0xA18D70 },
  { a: 67.0, b: 72.0, fromP: PHASE.CRACK, toP: PHASE.COARSE, fromM: 0.72, toM: 0.44, color: 0x9D8767 },
  { a: 72.0, b: 77.2, fromP: PHASE.COARSE, toP: PHASE.MID, fromM: 0.44, toM: 0.26, color: 0xB09A7D },
  { a: 77.0, b: 83.4, fromP: PHASE.MID, toP: PHASE.FINE, fromM: 0.26, toM: 0.08, color: 0xCBB79B },
  { a: 83.4, b: 89.6, fromP: PHASE.FINE, toP: PHASE.POLISH, fromM: 0.08, toM: 0.00, color: 0xDECBAF },
  { a: 90.2, b: 93.5, fromP: PHASE.POLISH, toP: PHASE.PAINT, fromM: 0.00, toM: 0.00, color: 0xD7B57B, dir: -1 },
];

function activeMudWindow(t) {
  for (const w of MUD_WINDOWS) if (t >= w.a && t < w.b) return { ...w, k: windowK(t, w.a, w.b) };
  return null;
}

function updateMudPatches(t, w) {
  const mesh = CONSTRUCTION.mudPatches;
  for (let i = 0; i < mesh.count; i++) hideInstance(mesh, i);
  if (!w || w.a >= 90) { mesh.instanceMatrix.needsUpdate = true; return 0; }
  mesh.material.color.setHex(w.color);
  let visible = 0;
  for (let i = 0; i < mesh.count; i++) {
    const d = mesh.userData.data[i];
    const threshold = w.dir === -1 ? 1 - d.threshold : d.threshold;
    const rel = w.k - threshold;
    if (rel < -0.08 || rel > 0.18) continue;
    const age = clamp((rel + 0.08) / 0.26, 0, 1);
    const p = _cgA.copy(d.p).addScaledVector(d.n, lerp(2.7 + d.phase * 1.6, 0.12, easeOut(age)));
    p.x += Math.sin(age * Math.PI) * (d.phase - 0.5) * 1.4;
    const q = orientZTo(_cgQ, d.n);
    q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, d.phase * TAU)));
    const squash = lerp(0.5, 0.18, age);
    setInstance(mesh, i, p, q, _cgS.set(d.s * lerp(0.55, 1.25, age), d.s * lerp(0.55, 1.0, age), d.s * squash));
    visible++;
  }
  mesh.instanceMatrix.needsUpdate = true;
  return visible;
}

function updateCracks(t) {
  const mesh = CONSTRUCTION.cracks;
  for (let i = 0; i < mesh.count; i++) hideInstance(mesh, i);
  if (t < 63.5 || t >= 68.1) { mesh.instanceMatrix.needsUpdate = true; return; }
  const k = windowK(t, 63.5, 66.6);
  for (let i = 0; i < mesh.count; i++) {
    const d = mesh.userData.data[i];
    const q = clamp((k - d.order * 0.72) / 0.28, 0, 1);
    if (q <= 0) continue;
    const len = d.len * easeOut(q);
    const mid = _cgA.copy(d.p).addScaledVector(d.dir, len * 0.5);
    _cgQ.setFromUnitVectors(_cgUp, d.dir.clone().normalize());
    setInstance(mesh, i, mid, _cgQ, _cgS.set(1, len, 1));
  }
  mesh.instanceMatrix.needsUpdate = true;
}

function updateStraw(t) {
  const mesh = CONSTRUCTION.straw;
  for (let i = 0; i < mesh.count; i++) hideInstance(mesh, i);
  if (t < 67.8 || t >= 73.2) { mesh.instanceMatrix.needsUpdate = true; return; }
  const k = windowK(t, 67.8, 72.0);
  for (let i = 0; i < mesh.count; i++) {
    const d = mesh.userData.data[i];
    const qv = clamp((k - d.order * 0.78) / 0.22, 0, 1);
    if (qv <= 0 || (qv >= 1 && t > 72.2)) continue;
    const p = _cgA.copy(d.p).addScaledVector(d.n, lerp(3.2, 0.18, easeOut(qv)));
    p.x += Math.sin(qv * Math.PI) * Math.cos(d.spin) * 1.3;
    const tangent = new THREE.Vector3(Math.cos(d.spin), Math.sin(d.spin) * 0.7, 0.3).normalize();
    tangent.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_cgForward, d.n));
    _cgQ.setFromUnitVectors(_cgUp, tangent);
    setInstance(mesh, i, p, _cgQ, _cgS.set(1, d.len, 1));
  }
  mesh.instanceMatrix.needsUpdate = true;
}

function updateCotton(t) {
  const mesh = CONSTRUCTION.cotton;
  for (let i = 0; i < mesh.count; i++) hideInstance(mesh, i);
  if (t < 78.2 || t >= 82.2) { mesh.instanceMatrix.needsUpdate = true; return; }
  const k = windowK(t, 78.2, 81.4);
  for (let i = 0; i < mesh.count; i++) {
    const d = mesh.userData.data[i];
    const qv = clamp((k - d.order * 0.72) / 0.28, 0, 1);
    if (qv <= 0) continue;
    const p = _cgA.copy(d.p).addScaledVector(d.n, lerp(2.8, 0.16, easeOut(qv)));
    p.y += Math.sin(qv * Math.PI) * (0.5 + d.phase);
    orientZTo(_cgQ, d.n);
    const ss = d.s * (1 - smoothstep(0.78, 1, qv) * 0.72);
    setInstance(mesh, i, p, _cgQ, _cgS.set(ss * 1.25, ss, ss * 0.72));
  }
  mesh.instanceMatrix.needsUpdate = true;
}

function updateDroplets(t) {
  const mesh = CONSTRUCTION.droplets;
  for (let i = 0; i < mesh.count; i++) hideInstance(mesh, i);
  if (t < 83.3 || t >= 86.0) { mesh.instanceMatrix.needsUpdate = true; return; }
  const k = windowK(t, 83.3, 85.4);
  for (let i = 0; i < mesh.count; i++) {
    const d = mesh.userData.data[i];
    const age = frac(k * 2.0 + d.phase);
    if (age > 0.82) continue;
    const p = _cgA.copy(d.p).addScaledVector(d.n, lerp(2.5, 0.10, easeInOut(age)));
    p.y += (1 - age) * (0.6 + d.order) - age * age * 0.9;
    orientZTo(_cgQ, d.n);
    const ss = d.s * (1 - smoothstep(0.65, 0.85, age));
    setInstance(mesh, i, p, _cgQ, _cgS.set(ss, ss * 1.7, ss));
  }
  mesh.instanceMatrix.needsUpdate = true;
}

function placeSurfaceTool(tool, y, lateral, lift, roll) {
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  pointOnFront(y, lateral, p, n);
  tool.position.copy(p).addScaledVector(n, lift);
  orientZTo(tool.quaternion, n);
  tool.rotateZ(roll);
  return { p, n };
}

function updateSurfaceTools(t, w) {
  for (const o of CONSTRUCTION.mudTrowels) o.visible = false;
  CONSTRUCTION.polishTrowel.visible = false;
  CONSTRUCTION.paintBrush.visible = false;

  if (w && w.a < 83.4) {
    CONSTRUCTION.mudTrowels.forEach((tool, i) => {
      tool.visible = true;
      const local = frac((t - w.a) / 1.9 + i * 0.43);
      const y = lerp(3.2, 33.0, w.dir === -1 ? 1 - w.k : w.k) + Math.sin(local * TAU) * 1.4 + (i - 0.5) * 2.5;
      const lat = Math.sin(t * 1.55 + i * 2.3) * 0.54;
      placeSurfaceTool(tool, clamp(y, 2.5, 33.4), lat, 0.65, -0.15 + Math.sin(t * 2.4 + i) * 0.34);
      tool.scale.setScalar(i === 0 ? 0.66 : 0.52);
    });
  }
  if (t >= 85.0 && t < 90.0) {
    const tool = CONSTRUCTION.polishTrowel;
    tool.visible = true;
    const k = windowK(t, 85.0, 89.6);
    const y = lerp(19.5, 33.0, k) + Math.sin(t * 3.4) * 1.6;
    const lat = Math.sin(t * 2.1) * 0.46;
    placeSurfaceTool(tool, y, lat, 0.42, Math.sin(t * 3.6) * 0.55);
    tool.scale.setScalar(0.78);
  }
  if (t >= 90.2 && t < 93.0) {
    const tool = CONSTRUCTION.paintBrush;
    tool.visible = true;
    const k = windowK(t, 90.2, 93.5);
    const y = lerp(34.0, 5.5, k) + Math.sin(t * 4.0) * 0.8;
    const lat = Math.sin(t * 2.5) * 0.55;
    placeSurfaceTool(tool, y, lat, 0.55, Math.sin(t * 5.1) * 0.26);
    tool.scale.setScalar(0.72);
    updatePigmentCloud(t, tool.position, 0xD6A13A, 0.72);
  }
}

function updatePigmentCloud(t, center, color, opacity) {
  const cloud = CONSTRUCTION.pigment;
  cloud.points.visible = true;
  cloud.points.material.color.setHex(color);
  cloud.points.material.opacity = opacity;
  const arr = cloud.pos;
  for (let i = 0; i < cloud.count; i++) {
    const s = cloud.seeds[i];
    const age = frac(t * (0.65 + s.phase * 0.4) + s.phase);
    const r = s.r * age * 1.2;
    arr[i * 3] = center.x + Math.cos(s.a) * r;
    arr[i * 3 + 1] = center.y + Math.sin(s.a) * r + age * 0.6;
    arr[i * 3 + 2] = center.z + (s.drift * 1.5 + 0.4) * age;
  }
  cloud.points.geometry.attributes.position.needsUpdate = true;
}

function wallTransitionAt(t) {
  if (t >= 95.4 && t < 100.0) return { from: 0, to: 1, k: windowK(t, 95.4, 100.0), mode: 1, label: 'wall-mud' };
  if (t >= 100.0 && t < 103.6) return { from: 1, to: 2, k: windowK(t, 100.0, 103.6), mode: 2, label: 'whitewash' };
  if (t >= 103.6 && t < 108.6) return { from: 2, to: 3, k: windowK(t, 103.6, 108.6), mode: 3, label: 'mural' };
  return null;
}

function wallSnakePoint(k, lane, out) {
  const bands = 7;
  const x = clamp(k, 0, 0.999) * bands;
  const band = Math.floor(x);
  const f = frac(x);
  const u = band % 2 === 0 ? f : 1 - f;
  const y = (band + 0.5 + lane * 0.13) / bands * 38.0 + 1.5;
  out.set(lerp(CAVE.x0 + 1.2, CAVE.x1 - 1.2, u), y, CAVE.zBack + 0.65);
  return out;
}

function updateWallConstruction(t) {
  const w = wallTransitionAt(t);
  for (const b of CONSTRUCTION.wallBrushes) b.visible = false;
  if (!w) {
    clearWallTransition();
    return null;
  }
  setWallTransition(w.from, w.to, w.k, w.mode, t);
  CONSTRUCTION.wallBrushes.forEach((brush, i) => {
    brush.visible = true;
    const kk = clamp(w.k + (i - 1) * 0.025, 0, 1);
    const p = wallSnakePoint(kk, i - 1, _cgA);
    brush.position.copy(p);
    brush.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, 0, (i - 1) * 0.12 + Math.sin(t * 4 + i) * 0.18));
    brush.scale.setScalar(0.78 + i * 0.08);
  });
  const color = w.label === 'mural' ? 0xBE5638 : (w.label === 'whitewash' ? 0xF1E8D2 : 0xA78C6E);
  updatePigmentCloud(t, CONSTRUCTION.wallBrushes[1].position, color, 0.68);
  return w;
}

function updateHairConstruction(t) {
  const hair = BUDDHA.parts.hair;
  if (!hair || !hair.userData.baseMatrices) return;
  const base = hair.userData.baseMatrices;
  const ys = hair.userData.revealY;
  let mode = 'full';
  let k = 1;
  if (t >= 15.2 && t < 51.6) { mode = 'carve'; k = CURVE_CARVE(t); }
  else if (t >= 56.0 && t < 90.2) { mode = 'hidden'; }
  else if (t >= 90.2 && t < 93.6) { mode = 'paint'; k = windowK(t, 90.2, 93.6); }
  for (let i = 0; i < hair.count; i++) {
    if (mode === 'hidden') {
      hideInstance(hair, i);
      continue;
    }
    if (mode === 'carve' && ys[i] < k) { hideInstance(hair, i); continue; }
    if (mode === 'paint') {
      const threshold = 1 - clamp((ys[i] - 30.2) / 5.4, 0, 1);
      const q = clamp((k - threshold * 0.72) / 0.28, 0, 1);
      if (q <= 0) { hideInstance(hair, i); continue; }
      base[i].decompose(_cgP, _cgQ, _cgS);
      _cgP.add(_cgA.set(0, (1 - q) * 0.8, (1 - q) * 0.7));
      _cgS.multiplyScalar(easeOut(q));
      setInstance(hair, i, _cgP, _cgQ, _cgS);
      continue;
    }
    hair.setMatrixAt(i, base[i]);
  }
  hair.instanceMatrix.needsUpdate = true;
  hair.visible = mode !== 'hidden';
}

function updateConstruction(t) {
  hideConstructionTransient();
  const towerState = updateTowerConstruction(t);
  const walkState = updateWalkwayConstruction(t);

  const d = excavationDescriptor(t);
  const blocks = updateExcavationBlocks(t, d);
  const movingLayers = 0;
  const excavationDustCount = updateDustCloud(t, d);
  const impactExc = updateExcavationTools(t, d);
  updateSectionAndFront(t, d);

  const peg = updatePegConstruction(t);
  const w = activeMudWindow(t);
  const mudCount = updateMudPatches(t, w);
  updateCracks(t);
  updateStraw(t);
  updateCotton(t);
  updateDroplets(t);
  updateSurfaceTools(t, w);
  const wall = updateWallConstruction(t);
  updateHairConstruction(t);

  const impact = Math.max(impactExc, peg.impact);
  if (CONSTRUCTION.flash && CONSTRUCTION.flash.intensity < 1) CONSTRUCTION.flash.intensity = 0;
  const shake = impact * 0.34;
  CONSTRUCTION.feedback.x = Math.sin(t * 57.1) * shake;
  CONSTRUCTION.feedback.y = Math.cos(t * 43.7) * shake * 0.55;
  CONSTRUCTION.feedback.z = Math.sin(t * 37.9) * shake * 0.32;
  CONSTRUCTION.feedback.fov = impact * 0.34;
  CONSTRUCTION.feedback.exposure = impact * 0.08;

  let stage = 'complete', progress = 1;
  if (t < 15.2) { stage = 'tower-reveal'; progress = CURVE_TOWER(t); }
  else if (t < 20.2) { stage = 'bare-cliff'; progress = windowK(t, 15.2, 20.2); }
  else if (t < 24.55) { stage = 'walkway-assembly'; progress = CURVE_WALK(t); }
  else if (d) { stage = 'excavate-' + d.stage; progress = d.k; }
  else if (t < 56.2) { stage = 'stone-core'; progress = windowK(t, 52, 56.2); }
  else if (t < 64.8) { stage = 'peg-insertion'; progress = peg.active / Math.max(1, (BUDDHA.parts.pegList || []).length); }
  else if (w) { stage = w.a >= 90 ? 'paint-buddha' : 'mud-layer'; progress = w.k; }
  else if (wall) { stage = wall.label; progress = wall.k; }
  else if (t >= 110.6) { stage = 'tower-reassembly'; progress = 1 - CURVE_TOWER(t); }

  if (t >= 66.0 && t < 67.0) { stage = 'mud-cracking'; progress = windowK(t, 66.0, 67.0); }
  if (w && w.a >= 83.4 && w.a < 90.0) { stage = 'surface-polish'; progress = w.k; }
  if (t >= 93.5 && t < 98.4) { stage = 'painted-buddha'; progress = windowK(t, 93.5, 98.4); }
  if (t >= 108.6 && t < 110.6) { stage = 'completed-cave'; progress = windowK(t, 108.6, 110.6); }

  CONSTRUCTION.state = {
    stage,
    progress,
    impact,
    activeGeometry: blocks + movingLayers + mudCount,
    excavationLayers: movingLayers,
    movingPieces: towerState.moving + walkState.moving,
    towerProgress: towerState.k,
    walkwayProgress: walkState.k,
    walkwayBuilt: walkState.built,
    dustCount: d ? excavationDustCount : ((w || wall) ? CONSTRUCTION.pigment.count : 0),
  };
  return CONSTRUCTION.state;
}

function constructionCameraFeedback() {
  return CONSTRUCTION.feedback;
}


/* ------------------------------------------------------------
   主程序/验收兼容层：统一绝对时间施工接口与可观测状态
   ------------------------------------------------------------ */
function cfWindow(t, a, b) { return windowK(t, a, b); }
function cfPulse(t, hz = 1) { return 0.5 + 0.5 * Math.sin(t * TAU * hz); }

function cfSurfaceTransitionAt(t) {
  const w = activeMudWindow(t);
  if (!w) return null;
  const dir = w.dir === -1 ? -1 : 1;
  const e = easeInOut(w.k);
  return {
    ...w,
    from: w.fromP,
    to: w.toP,
    m0: w.fromM,
    m1: w.toM,
    dir,
    front: dir > 0 ? lerp(-3.0, BUDDHA_H + 3.0, e) : lerp(BUDDHA_H + 3.0, -3.0, e),
    wet: w.a >= 90 ? 0.24 : (w.a >= 83 ? 0.58 : 1.0),
  };
}

function cfWallTransitionAt(t) { return wallTransitionAt(t); }

function buildConstructionFX(scene, tower, walkway) {
  const group = buildConstruction(scene, tower, walkway);
  CONSTRUCTION.camera = CONSTRUCTION.feedback;
  CONSTRUCTION.hammer = CONSTRUCTION.tools[0] || null;
  CONSTRUCTION.chisel = CONSTRUCTION.hammer ? CONSTRUCTION.hammer.userData.chisel : null;
  CONSTRUCTION.trowel = (CONSTRUCTION.mudTrowels && CONSTRUCTION.mudTrowels[0]) || null;
  CONSTRUCTION.brush = CONSTRUCTION.paintBrush || null;
  return group;
}

function updateConstructionFX(t) {
  const state = updateConstruction(t);
  const visibleTools = [];
  if (CONSTRUCTION.tools) CONSTRUCTION.tools.forEach((o) => { if (o.visible) visibleTools.push('hammer'); });
  if (CONSTRUCTION.mudTrowels) CONSTRUCTION.mudTrowels.forEach((o) => { if (o.visible) visibleTools.push('trowel'); });
  if (CONSTRUCTION.polishTrowel && CONSTRUCTION.polishTrowel.visible) visibleTools.push('polish-trowel');
  if (CONSTRUCTION.paintBrush && CONSTRUCTION.paintBrush.visible) visibleTools.push('paint-brush');
  if (CONSTRUCTION.wallBrushes) CONSTRUCTION.wallBrushes.forEach((o) => { if (o.visible) visibleTools.push('wall-brush'); });

  CONSTRUCTION.trowel = (CONSTRUCTION.mudTrowels || []).find((o) => o.visible) ||
    (CONSTRUCTION.polishTrowel && CONSTRUCTION.polishTrowel.visible ? CONSTRUCTION.polishTrowel : null);
  CONSTRUCTION.brush = CONSTRUCTION.paintBrush && CONSTRUCTION.paintBrush.visible
    ? CONSTRUCTION.paintBrush
    : ((CONSTRUCTION.wallBrushes || []).find((o) => o.visible) || null);

  const movingPieces = (state.activeGeometry || 0) + (state.movingPieces || 0);
  const geometrySignal = Number((movingPieces + (state.progress || 0) * 17 + (state.impact || 0) * 9).toFixed(4));
  CONSTRUCTION.debug = {
    stage: state.stage,
    progress: Number((state.progress || 0).toFixed(4)),
    activeTool: visibleTools[0] || 'none',
    movingPieces,
    dustCount: state.dustCount || 0,
    geometrySignal,
    impact: Number((state.impact || 0).toFixed(4)),
  };
  return state;
}
