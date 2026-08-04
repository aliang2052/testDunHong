/* ============================================================
   50 - 崖壁 / 洞窟 / 开凿系统
   ============================================================ */

/* 洞窟尺寸（米） */
const CAVE = {
  x0: -15.5, x1: 15.5,      // 左右壁
  yTop: 41.5,               // 拱顶最高
  yArch: 37.0,              // 起拱线
  zBack: -11.5,             // 后壁
  zFront: 10.0,             // 洞口（= 崖壁面）
};
const CLIFF_Z = 10.0;
const CLIFF_TOP = 46.0;

const WORLD = { group: null };

function buildIrregularRockSlab(width, height, depth, seed) {
  const rnd = mulberry32(seed);
  const shape = new THREE.Shape();
  const pts = [
    [-0.36, -0.48], [0.42 + rnd() * 0.08, -0.50],
    [0.50, -0.18 + rnd() * 0.10], [0.43 + rnd() * 0.07, 0.18],
    [0.36 + rnd() * 0.10, 0.50], [-0.42, 0.47 + rnd() * 0.05],
    [-0.46, 0.12], [-0.31, -0.18],
  ];
  shape.moveTo(pts[0][0] * width, pts[0][1] * height);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0] * width, pts[i][1] * height);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: 0.16,
    bevelSize: 0.18,
    bevelSegments: 2,
    curveSegments: 1,
  });
  g.translate(0, 0, -depth * 0.5);
  const pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
    const rough = (fbm2(x * 0.28 + seed, y * 0.24 + z * 0.18, 3, seed + 13) - 0.5) * 0.16;
    pa.setXYZ(i, x + rough * 0.22, y + rough * 0.34, z + rough);
  }
  pa.needsUpdate = true;
  g.computeVertexNormals();
  scaleUV(g, 0.55);
  return g;
}

/* 完成镜头左侧是上宽下窄的天然岩楔，不是一根等宽立柱。 */
function buildRevealLeftJamb(width, height, depth, seed) {
  const shape = new THREE.Shape();
  const pts = [
    [-0.50, -0.50], [-0.42, -0.50], [-0.30, -0.24], [-0.16, 0.02],
    [0.08, 0.22], [0.34, 0.40], [0.48, 0.50], [-0.43, 0.49],
  ];
  shape.moveTo(pts[0][0] * width, pts[0][1] * height);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0] * width, pts[i][1] * height);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, steps: 1, bevelEnabled: true,
    bevelThickness: 0.18, bevelSize: 0.20, bevelSegments: 3, curveSegments: 1,
  });
  g.translate(0, 0, -depth * 0.5);
  const pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
    const rough = (fbm2(x * 0.21 + seed, y * 0.18 + z * 0.15, 4, seed + 31) - 0.5) * 0.62;
    pa.setXYZ(i, x + rough * 0.22, y + rough * 0.34, z + rough * 0.44);
  }
  pa.needsUpdate = true;
  g.computeVertexNormals();
  scaleUV(g, 0.55);
  return g;
}

function buildSculptureRevealFrame(parent) {
  const group = new THREE.Group();
  group.name = 'ThreeDimensionalSculptureRevealFrame';
  const mat = new THREE.MeshStandardMaterial({
    map: TEX.rockCore.map,
    normalMap: TEX.rockCore.normal,
    color: 0xC39B76,
    roughness: 0.98,
    metalness: 0,
    envMapIntensity: 0.04,
  });
  mat.normalScale.set(0.34, 0.34);

  const left = new THREE.Group();
  left.name = 'LeftRockJamb';
  const lm = new THREE.Mesh(buildRevealLeftJamb(7.0, 44.5, 2.6, 951), mat);
  /* 岩楔退到造像之后，只形成洞口轮廓，不再像木柱一样穿过佛手与脸。 */
  lm.position.set(-9.55, 22.2, 1.0);
  lm.rotation.set(0.015, -0.28, -0.012);
  lm.castShadow = lm.receiveShadow = true;
  left.add(lm);
  group.add(left);

  const right = new THREE.Group();
  right.name = 'RightRockJamb';
  const rm = new THREE.Mesh(buildIrregularRockSlab(5.8, 44.5, 1.8, 987), mat);
  rm.position.set(9.55, 22.2, 7.15);
  /* 终景从左下仰视，岩壁正面也朝向该机位，避免挤出侧面读成黑木柱。 */
  rm.rotation.set(-0.008, -0.42, 0.010);
  rm.castShadow = rm.receiveShadow = true;
  right.add(rm);
  group.add(right);
  group.visible = false;
  parent.add(group);
  WORLD.sculptureFrame = group;
  WORLD.sculptureFrameLeft = left;
  WORLD.sculptureFrameRight = right;
  return group;
}

/* 崖壁面的起伏 */
function cliffFaceZ(x, y) {
  const n = fbm2(x * 0.011 + 5, y * 0.013 + 2, 5, 3.1) - 0.5;
  const n2 = fbm2(x * 0.045, y * 0.05, 4, 8.8) - 0.5;
  const erode = ridge2(x * 0.02, y * 0.055, 4, 1.7);
  let z = CLIFF_Z + n * 6.6 + n2 * 2.2 - erode * 3.2;
  // 靠近洞口区域压平，保证洞口是干净的立面
  const near = smoothstep(30, 16, Math.abs(x)) * smoothstep(50, 42, y);
  z = lerp(z, CLIFF_Z + n2 * 0.35, near * 0.96);
  // 底部略外凸（坡积）
  z += smoothstep(9, 0, y) * 1.6;
  return z;
}

/* 沙丘顶高度 */
function duneY(x, z) {
  const d = (CLIFF_Z - z);                        // 向后的距离
  const rise = smoothstep(-14, 70, d) * 16.0;
  const n = fbm2(x * 0.007 + 11, z * 0.007 + 3, 5, 6.6) - 0.5;
  const streak = fbm2(x * 0.04, z * 0.004, 4, 2.2) - 0.5;
  return CLIFF_TOP + rise + n * 9.0 + streak * 1.6;
}

function buildWorld(scene) {
  const G = new THREE.Group();
  WORLD.group = G;
  scene.add(G);

  /* ---------------- 崖壁立面 ---------------- */
  {
    const W = 340, Hh = CLIFF_TOP + 14;
    const segX = 180, segY = 96;
    const g = new THREE.PlaneGeometry(W, Hh, segX, segY);
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i);
      const y = pa.getY(i) + Hh / 2;
      pa.setY(i, y);
      pa.setZ(i, cliffFaceZ(x, y));
    }
    pa.needsUpdate = true;
    g.computeVertexNormals();
    const uvA = g.attributes.uv;
    for (let i = 0; i < uvA.count; i++) {
      // uv -> 米制，再按 6.5m 一循环
      uvA.setXY(i, uvA.getX(i) * W / 15.5, uvA.getY(i) * Hh / 15.5);
    }
    const mat = new THREE.MeshStandardMaterial({
      map: TEX.sandstone.map, normalMap: TEX.sandstone.normal,
      roughness: 0.98, metalness: 0, side: THREE.DoubleSide,
    });
    mat.normalScale.set(2.0, 2.0);
    applyCarve(mat);
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true; m.castShadow = true;
    G.add(m);
    WORLD.cliffFace = m;
    WORLD.cliffMat = mat;
  }

  /* ---------------- 崖壁厚度：洞口周围的侧壁（让洞口有进深） ---------------- */
  {
    // 洞口四周一圈"墙厚"，避免看到纸片边
    const th = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      map: TEX.caveWall.map, normalMap: TEX.caveWall.normal, roughness: 0.97, side: THREE.DoubleSide,
    });
    applyCarve(mat);
    WORLD.jambMat = mat;
    G.add(th);
    WORLD.jambs = th;
  }

  /* ---------------- 沙丘顶 ---------------- */
  {
    const g = new THREE.PlaneGeometry(360, 240, 112, 76);
    g.rotateX(-Math.PI / 2);
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i);
      const z = pa.getZ(i) - 96;     // 平面中心后移，前缘压住崖顶
      pa.setZ(i, z);
      pa.setY(i, duneY(x, z));
    }
    pa.needsUpdate = true; g.computeVertexNormals();
    const uvA = g.attributes.uv;
    for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * 360 / 22, uvA.getY(i) * 240 / 22);
    const mat = new THREE.MeshStandardMaterial({
      map: TEX.dune.map, normalMap: TEX.dune.normal, roughness: 1.0, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    G.add(m);
    WORLD.dune = m;
  }

  /* ---------------- 窟门隧道（门洞后的暗腔） ---------------- */
  {
    const tg = new THREE.BoxGeometry(8.6, 8.9, 20, 1, 1, 1);
    const uvA = tg.attributes.uv;
    for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * 8.6, uvA.getY(i) * 8.9);
    const tmat = new THREE.MeshStandardMaterial({
      map: TEX.caveWall.map, normalMap: TEX.caveWall.normal,
      roughness: 0.98, side: THREE.BackSide,
    });
    tmat.map = TEX.caveWall.map;
    const tm = new THREE.Mesh(tg, tmat);
    tm.position.set(0, 34.85, CLIFF_Z - 5.5);
    tm.visible = false;
    G.add(tm);
    WORLD.doorTunnel = tm;
  }

  /* ---------------- 岩芯：尚未挖走的土石（顶面 = 当前开凿面） ---------------- */
  {
    const w = CAVE.x1 - CAVE.x0 + 0.9, d = (CLIFF_Z - 0.2) - (CAVE.zBack - 1.5);
    const FH = 70;                       // 固定高度，只靠 position 平移
    const g = new THREE.BoxGeometry(w, FH, d, 26, 1, 26);
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      if (pa.getY(i) > FH / 2 - 0.01) {
        const n = fbm2(pa.getX(i) * 0.20 + 3, pa.getZ(i) * 0.20, 3, 5);
        pa.setY(i, FH / 2 + (n - 0.5) * 1.5);     // 凿击面的起伏（绝对米）
      }
    }
    pa.needsUpdate = true; g.computeVertexNormals();
    const uvA = g.attributes.uv;
    for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * 2.2, uvA.getY(i) * 2.2);
    const mat = new THREE.MeshStandardMaterial({
      map: TEX.sandstone.map, normalMap: TEX.sandstone.normal, roughness: 0.99,
    });
    mat.normalScale.set(1.2, 1.2);
    applyCarve(mat);
    WORLD.rockFillH = FH;
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true; m.castShadow = true;
    G.add(m);
    WORLD.rockFill = m;
    WORLD.rockFillDepth = d;
  }

  /* ---------------- 洞窟内壁 ---------------- */
  buildCaveInterior(G);
  buildSculptureRevealFrame(G);

  /* ---------------- 地面广场 ---------------- */
  {
    const g = new THREE.PlaneGeometry(400, 300, 1, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0, -0.05, CLIFF_Z + 130);
    const uvA = g.attributes.uv;
    for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * 400 / 9, uvA.getY(i) * 300 / 9);
    const mat = new THREE.MeshStandardMaterial({
      map: TEX.ground.map, normalMap: TEX.ground.normal, roughness: 0.93,
    });
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    G.add(m);
    WORLD.ground = m;
  }

  /* 佛像基座台 */
  {
    const g = new THREE.BoxGeometry(40, 1.2, 26);
    const mat = new THREE.MeshStandardMaterial({
      map: TEX.ground.map, normalMap: TEX.ground.normal, roughness: 0.92,
    });
    const m = new THREE.Mesh(g, mat);
    m.position.set(0, 0.6, 1.0);
    m.receiveShadow = true;
    G.add(m);
    WORLD.plinth = m;
    m.visible = false;
  }

  return G;
}

/* ------------------------------------------------------------
   洞窟内壁：后壁 / 侧壁（带退台）/ 拱顶 / 地面
   全部使用「壁面阶段材质」：粗凿 → 细泥 → 白粉 → 壁画
   ------------------------------------------------------------ */
const WALL_MATS = [];
function makeWallMaterial(uvScale = [4, 4]) {
  const mat = new THREE.MeshStandardMaterial({
    map: TEX.caveWall.map, normalMap: TEX.caveWall.normal,
    roughness: 0.97, metalness: 0, side: THREE.DoubleSide,
  });
  const U = {
    uWallPhase: { value: 0 },       // 0 粗凿 1 细泥 2 白粉 3 壁画
    uWallFrom: { value: 0 },
    uWallTo: { value: 0 },
    uWallProgress: { value: -1 },   // <0 表示全局阶段；否则为 0..1 的空间传播
    uWallMode: { value: 0 },        // 1 自下而上；2 自上而下；3 蛇形刷涂
    uWallTime: { value: 0 },
    uRevealY: { value: 9999 },      // 低于此高度不显示（开凿推进）
    tRaw: { value: TEX.caveWall.map },
    tFine: { value: TEX.mudFine.map },
    tWhite: { value: TEX.whitewash.map },
    tMural: { value: TEX.mural.map },
    nRaw: { value: TEX.caveWall.normal },
    nFine: { value: TEX.mudFine.normal },
    uScale: { value: new THREE.Vector2(uvScale[0], uvScale[1]) },
    uWallSection: { value: 99999 },
    uMuralScale: { value: new THREE.Vector2(1 / 10.5, 1 / 10.5) },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = `varying vec3 vWP;\nvarying vec2 vUvX;\n` + sh.vertexShader;
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>',
      `vWP = (modelMatrix * vec4(transformed,1.0)).xyz;\n vUvX = uv;\n#include <project_vertex>`);
    sh.fragmentShader = `
      varying vec3 vWP;
      varying vec2 vUvX;
      uniform float uWallPhase, uRevealY;
      uniform float uWallFrom, uWallTo, uWallProgress, uWallMode, uWallTime;
      uniform sampler2D tRaw, tFine, tWhite, tMural, nRaw, nFine;
      uniform vec2 uScale, uMuralScale;
      uniform float uWallSection;
      float wallPhaseLocal(){
        if (uWallProgress < 0.0) return uWallPhase;
        float side = step(13.8, abs(vWP.x));
        float uuBack = clamp((vWP.x + 15.5) / 31.0, 0.0, 1.0);
        float uuSide = clamp((vWP.z + 11.5) / 21.5, 0.0, 1.0);
        float uu = mix(uuBack, uuSide, side);
        if (vWP.x > 13.8) uu = 1.0 - uu;
        float vv = clamp(vWP.y / 41.5, 0.0, 1.0);
        float rag = sin(vWP.x * 0.83 + vWP.z * 0.47 + uWallTime * 0.55) * 0.020
                  + sin(vWP.y * 1.37 - vWP.z * 0.31) * 0.014;
        float coord = vv;
        if (uWallMode > 1.5 && uWallMode < 2.5) coord = 1.0 - vv;
        if (uWallMode > 2.5) {
          float band = floor(vv * 7.0);
          float snake = mod(band, 2.0) < 1.0 ? uu : 1.0 - uu;
          coord = (band + snake) / 7.0;
        }
        float m = 1.0 - smoothstep(uWallProgress - 0.045, uWallProgress + 0.045, coord + rag);
        return mix(uWallFrom, uWallTo, m);
      }
      float pw(float k){ return clamp(wallPhaseLocal() - k, 0.0, 1.0); }
    ` + sh.fragmentShader;
    sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
       if (vWP.y < uRevealY) discard;
       if (vWP.x > uWallSection) discard;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>',
      `
      vec2 uvA = vUvX * uScale;
      vec4 col = texture2D(tRaw, uvA);
      col = mix(col, texture2D(tFine,  uvA), pw(0.0));
      col = mix(col, texture2D(tWhite, uvA), pw(1.0));
      col = mix(col, texture2D(tMural, vUvX * uMuralScale), pw(2.0));
      diffuseColor *= col;
      `);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>',
      `
      vec3 mA = texture2D(nRaw, vUvX*uScale).xyz*2.0-1.0;
      vec3 mB = texture2D(nFine, vUvX*uScale).xyz*2.0-1.0;
      vec3 mN = mix(mA, mB, pw(0.0));
      mN = mix(mN, vec3(0.0,0.0,1.0), pw(1.0)*0.8);
      mN.xy *= 1.0;
      normal = normalize( tbn * mN );
      `);
    mat.userData.shader = sh;
  };
  mat.customProgramCacheKey = () => 'wall-mat';
  mat.userData.U = U;
  WALL_MATS.push(mat);
  return mat;
}
function setWallPhase(p) { for (const m of WALL_MATS) m.userData.U.uWallPhase.value = p; }
function setWallTransition(from, to, progress, mode, time) {
  for (const m of WALL_MATS) {
    const U = m.userData.U;
    U.uWallFrom.value = from;
    U.uWallTo.value = to;
    U.uWallProgress.value = progress;
    U.uWallMode.value = mode;
    U.uWallTime.value = time || 0;
  }
}
function clearWallTransition() { for (const m of WALL_MATS) m.userData.U.uWallProgress.value = -1; }
function setWallReveal(y) { for (const m of WALL_MATS) m.userData.U.uRevealY.value = y; }
function setWallSection(x) { for (const m of WALL_MATS) m.userData.U.uWallSection.value = x; }

function buildCaveInterior(G) {
  const grp = new THREE.Group();
  G.add(grp);
  WORLD.cave = grp;

  const { x0, x1, yTop, yArch, zBack, zFront } = CAVE;

  /* 后壁：矩形墙 + 半椭圆拱顶，完整封闭窟腔后端 */
  {
    const uSeg = 56, vSeg = 70;
    const pos = [], uvs = [], idx = [];
    const cx = (x0 + x1) / 2, rx = (x1 - x0) / 2, ry = yTop - yArch;
    for (let j = 0; j <= vSeg; j++) {
      const yy = (j / vSeg) * yTop;
      for (let i = 0; i <= uSeg; i++) {
        let xx = x0 + (x1 - x0) * (i / uSeg);
        if (yy > yArch) {
          // 拱形区：按该高度的半宽收窄
          const k = clamp((yy - yArch) / ry, 0, 1);
          const half = rx * Math.sqrt(Math.max(0, 1 - k * k));
          xx = cx + (xx - cx) * (half / rx);
        }
        pos.push(xx, yy, zBack);
        uvs.push(xx - x0, yy);
      }
    }
    const nu = uSeg + 1;
    for (let j = 0; j < vSeg; j++) for (let i = 0; i < uSeg; i++) {
      const a = j * nu + i, b = a + 1, c = a + nu + 1, d = a + nu;
      idx.push(a, b, d, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, makeWallMaterial([1 / 5.5, 1 / 5.5]));
    m.receiveShadow = true;
    grp.add(m);
    WORLD.backWall = m;
  }

  /* 左右侧壁：竖直整壁，从后壁一直延伸出洞口（避免侧缝漏天光） */
  for (const sx of [-1, 1]) {
    const X = sx < 0 ? x0 : x1;
    const zEnd = CLIFF_Z - 0.6;
    const uSeg = 30, vSeg = 40;
    const pos = [], uvs = [], idx = [];
    for (let j = 0; j <= vSeg; j++) {
      const yy = (j / vSeg) * (yArch + 0.6);
      for (let i = 0; i <= uSeg; i++) {
        const zz = lerp(zBack, zEnd, i / uSeg);
        // 窟壁在深处略微内收，形成开凿的层次
        const inset = Math.sin((yy / yArch) * Math.PI * 2.0) * 0.55 + (fbm2(zz * 0.08, yy * 0.06, 3, 9) - 0.5) * 1.1;
        pos.push(X - sx * inset, yy, zz);
        uvs.push(zz - zBack, yy);
      }
    }
    const nu = uSeg + 1;
    for (let j = 0; j < vSeg; j++) for (let i = 0; i < uSeg; i++) {
      const a = j * nu + i, b = a + 1, c = a + nu + 1, d = a + nu;
      if (sx < 0) idx.push(a, b, d, b, c, d);
      else idx.push(a, d, b, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, makeWallMaterial([1 / 5.5, 1 / 5.5]));
    m.receiveShadow = true;
    grp.add(m);
  }

  /* 拱形天花板：沿 X 轴的半圆柱 */
  {
    const rx = (x1 - x0) / 2, ry = yTop - yArch;
    const segU = 44, segV = 34;
    const pos = [], uvs = [], idx = [], nrm = [];
    for (let j = 0; j <= segV; j++) {
      const z = lerp(zBack, CLIFF_Z - 0.6, j / segV);
      for (let i = 0; i <= segU; i++) {
        const a = Math.PI * (i / segU);
        const x = (x0 + x1) / 2 - Math.cos(a) * rx;
        const y = (yArch - 0.6) + Math.sin(a) * (ry + 0.6);
        pos.push(x, y, z);
        nrm.push(Math.cos(a), -Math.sin(a), 0);
        uvs.push((i / segU) * Math.PI * rx, (j / segV) * (CLIFF_Z - 0.6 - zBack));
      }
    }
    const nu = segU + 1;
    for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
      const a = j * nu + i, b = a + 1, c = a + nu + 1, d = a + nu;
      idx.push(a, b, d, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, makeWallMaterial([1 / 5.5, 1 / 5.5]));
    m.receiveShadow = true;
    grp.add(m);
    WORLD.arch = m;
  }

  /* 窟内地面 */
  {
    const zE = CLIFF_Z - 0.6;
    const g = new THREE.PlaneGeometry(x1 - x0, zE - zBack, 2, 2);
    g.rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, 0.02, (zBack + zE) / 2);
    const uvA = g.attributes.uv;
    for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * 3, uvA.getY(i) * 3);
    const m = new THREE.Mesh(g, makeWallMaterial([1 / 5.5, 1 / 5.5]));
    m.receiveShadow = true;
    grp.add(m);
  }
}

/* ------------------------------------------------------------
   开凿控制
   ------------------------------------------------------------ */
const CARVE = {
  y: CAVE.yTop + 4,          // 当前开凿面
  doorOpen: false,
};

function setCarveY(y) {
  CARVE.y = y;
  if (WORLD.rockFill) {
    const top = Math.min(y, CAVE.yTop + 1);
    const bottom = -6;
    if (top <= 0.15 || y > CAVE.yTop + 40) {
      WORLD.rockFill.visible = false;
    } else {
      WORLD.rockFill.visible = true;
      WORLD.rockFill.position.set(
        (CAVE.x0 + CAVE.x1) / 2,
        top - WORLD.rockFillH / 2,
        (CAVE.zBack - 1.5 + CLIFF_Z - 0.2) / 2);
    }
  }
  CARVE_U.uCarveY.value = y;
  CARVE_U.uCarveMin.value.set(CAVE.x0 + 0.25, -2, CAVE.zBack - 2);
  CARVE_U.uCarveMax.value.set(CAVE.x1 - 0.25, CAVE.yTop, CLIFF_Z + 8);
  CARVE_U.uArchY.value = CAVE.yArch;
  CARVE_U.uArchH.value = CAVE.yTop - CAVE.yArch;
  if (y > CAVE.yTop + 30) setWallReveal(9999);
  else if (y <= 0.15) setWallReveal(-9999);
  else setWallReveal(y - 0.35);
}
function disableCarveBox() {
  CARVE_U.uCarveMin.value.set(-9999, -9999, -9999);
  CARVE_U.uCarveMax.value.set(-9999, -9999, -9999);
}
function openDoor(on) {
  if (on) {
    CARVE_U.uDoorMin.value.set(-4.0, 30.4, CLIFF_Z - 9);
    CARVE_U.uDoorMax.value.set(4.0, 38.4, CLIFF_Z + 8);
    CARVE_U.uDoorProgress.value = 1;
  } else {
    CARVE_U.uDoorMin.value.set(-9999, -9999, -9999);
    CARVE_U.uDoorMax.value.set(-9999, -9999, -9999);
    CARVE_U.uDoorProgress.value = 0;
  }
}
function setDoorProgress(k) {
  k = clamp(k, 0, 1);
  if (k <= 0.001) { openDoor(false); return; }
  CARVE_U.uDoorMin.value.set(-4.0, 30.4, CLIFF_Z - 9);
  CARVE_U.uDoorMax.value.set(4.0, 38.4, CLIFF_Z + 8);
  CARVE_U.uDoorProgress.value = k;
}
/* 下方两个运土洞 */
function openLowerCaves(k) {
  if (k >= 1) {
    CARVE_U.uCarveMin2.value.set(-12.5, 11.5, CAVE.zBack - 1);
    CARVE_U.uCarveMax2.value.set(-3.0, 20.5, CLIFF_Z + 8);
  }
  if (k >= 2) {
    CARVE_U.uCarveMin3.value.set(-12.5, -1.0, CAVE.zBack - 1);
    CARVE_U.uCarveMax3.value.set(-3.0, 9.0, CLIFF_Z + 8);
  }
  if (k <= 0) {
    CARVE_U.uCarveMin2.value.set(-9999, -9999, -9999);
    CARVE_U.uCarveMax2.value.set(-9999, -9999, -9999);
    CARVE_U.uCarveMin3.value.set(-9999, -9999, -9999);
    CARVE_U.uCarveMax3.value.set(-9999, -9999, -9999);
  }
}
function setLowerCaveProgress(k1, k2) {
  const setOne = (k, mn, mx, UMin, UMax) => {
    k = clamp(k, 0, 1);
    if (k <= 0.001) {
      UMin.value.set(-9999, -9999, -9999);
      UMax.value.set(-9999, -9999, -9999);
      return;
    }
    const yMax = lerp(mn.y + 0.6, mx.y, easeOut(k));
    const zMin = lerp(CLIFF_Z - 0.6, mn.z, easeInOut(k));
    UMin.value.set(mn.x, mn.y, zMin);
    UMax.value.set(mx.x, yMax, mx.z);
  };
  setOne(k1,
    new THREE.Vector3(-12.5, 11.5, CAVE.zBack - 1), new THREE.Vector3(-3.0, 20.5, CLIFF_Z + 8),
    CARVE_U.uCarveMin2, CARVE_U.uCarveMax2);
  setOne(k2,
    new THREE.Vector3(-12.5, -1.0, CAVE.zBack - 1), new THREE.Vector3(-3.0, 9.0, CLIFF_Z + 8),
    CARVE_U.uCarveMin3, CARVE_U.uCarveMax3);
}
function setSectionX(x) {
  CARVE_U.uSectionX.value = x;
  // 洞窟内壁本身保持完整，剖切只作用于崖体和未挖岩芯。
  setWallSection(99999);
}
