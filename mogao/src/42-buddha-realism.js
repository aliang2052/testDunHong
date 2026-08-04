/* ============================================================
   42 - 真实三维造像升级

   设计约束：
   - 头、眼睑、鼻、唇、长耳、螺发和双手全部由实体网格构成；
   - 不用人物照片、面部图片、法线烘焙卡片或 billboard 塑造轮廓；
   - 延续现有石胎 → 泥塑 → 素胎 → 彩绘材质状态机；
   - 保留 BUDDHA.parts.hair 的逐实例施工接口。
   ============================================================ */

const REAL_HEAD_Y0 = 29.12;
const REAL_HEAD_Y1 = 35.55;
const REAL_HEAD_SECTION_POW = 1.04;

const REAL_HEAD_RX = makeCurve1D([
  [28.95, 1.24], [29.30, 1.42], [29.62, 1.60], [30.05, 1.82], [30.52, 2.02],
  [31.18, 2.18], [31.92, 2.31], [32.62, 2.24], [33.28, 2.08],
  [33.88, 1.88], [34.35, 1.66], [34.78, 1.38], [35.18, 0.94],
  [35.48, 0.34], [35.55, 0.05],
]);

const REAL_HEAD_FRONT = makeCurve1D([
  [28.95, 1.02], [29.30, 1.29], [29.62, 1.54], [30.05, 1.77], [30.52, 1.96],
  [31.18, 2.16], [31.92, 2.25], [32.62, 2.22], [33.28, 2.14],
  [33.88, 2.02], [34.35, 1.84], [34.78, 1.51], [35.18, 1.02],
  [35.48, 0.36], [35.55, 0.05],
]);

const REAL_HEAD_BACK = makeCurve1D([
  [28.95, 1.00], [29.30, 1.31], [29.62, 1.58], [30.05, 1.82], [30.52, 2.00],
  [31.18, 2.12], [31.92, 2.20], [32.62, 2.20], [33.28, 2.15],
  [33.88, 2.04], [34.35, 1.86], [34.78, 1.53], [35.18, 1.04],
  [35.48, 0.38], [35.55, 0.05],
]);

const REAL_HEAD_CZ = makeCurve1D([
  [28.95, -0.46], [29.30, -0.44], [30.0, -0.39], [31.2, -0.31], [32.4, -0.29],
  [33.5, -0.34], [34.5, -0.40], [35.55, -0.43],
]);

function realGauss(x, c, w) {
  return Math.exp(-Math.pow((x - c) / w, 2));
}

/* 宽圆造像脸的体积起伏；鼻、唇另以封闭网格叠加。 */
function realFacialRelief(x, y) {
  let d = 0;
  /*
    直接把额弓、眼窝、颧颊、人中和下巴写入头部母曲面。参考片的庄严感
    来自大面积平缓转折，而不是在球面上粘几根线。
  */
  const bilateral = (cx, wx) => realGauss(x, -cx, wx) + realGauss(x, cx, wx);
  d += bilateral(1.00, 0.96) * realGauss(y, 31.38, 0.82) * 0.245;  // 颧颊大缓坡
  d += bilateral(1.30, 0.46) * realGauss(y, 30.78, 0.72) * 0.100;  // 下颌转折
  d += realGauss(x, 0, 1.10) * realGauss(y, 30.00, 0.48) * 0.260;  // 圆钝下巴
  d += realGauss(x, 0, 0.92) * realGauss(y, 31.13, 0.70) * 0.052;
  d -= bilateral(0.98, 0.70) * realGauss(y, 32.30, 0.48) * 0.280; // 宽阔眼窝
  d += bilateral(0.96, 0.88) * realGauss(y, 32.76, 0.44) * 0.285; // 宽面额弓
  d += realGauss(x, 0, 0.48) * realGauss(y, 32.48, 0.55) * 0.100; // 眉间鼻根
  d += realGauss(x, 0, 0.46) * realGauss(y, 31.92, 0.92) * 0.075; // 鼻根与面部柔和衔接
  d -= bilateral(0.46, 0.22) * realGauss(y, 30.82, 0.40) * 0.055; // 口角
  d -= realGauss(x, 0, 0.13) * realGauss(y, 30.86, 0.30) * 0.052; // 人中
  d -= bilateral(0.66, 0.19) * realGauss(y, 30.67, 0.46) * 0.030; // 鼻翼至口角的柔和鼻唇沟
  d -= bilateral(1.62, 0.40) * realGauss(y, 31.38, 0.88) * 0.038; // 颊侧平面转折
  d -= bilateral(1.55, 0.42) * realGauss(y, 30.55, 0.78) * 0.060; // 下颌阴影收束
  d += realNoseDisplacement(x, y);                                // 与头面共拓扑的鼻体
  d -= (realGauss(x, -0.41, 0.105) + realGauss(x, 0.41, 0.105))
    * realGauss(y, 30.96, 0.075) * 0.050;                         // 鼻孔凹陷
  return d;
}

/* u=0 朝 +Z；横截面用轻微超椭圆，使正脸宽圆而非球/方盒。 */
function realHeadPoint(u, v, out) {
  const vv = clamp(v, 0, 1);
  const baseY = lerp(REAL_HEAD_Y0, REAL_HEAD_Y1, vv);
  const a = u * TAU;
  const sx = Math.sin(a), sz = Math.cos(a);
  /*
    最下一圈不能是水平切口。正面中心向下形成圆下巴，越靠耳后越早
    回收到颈部；这是实际三维轮廓，不是正面贴片。
  */
  const lowerBlend = Math.pow(1 - smoothstep(0, 0.22, vv), 2);
  const faceFacing = Math.max(0, sz);
  const chinDrop = 0.36 * lowerBlend * Math.pow(faceFacing, 1.20);
  const jawSideLift = 0.34 * lowerBlend * (1 - faceFacing);
  const y = baseY + jawSideLift - chinDrop;
  /* 接近椭圆而非超椭圆，消除方盒/面具式侧壁。 */
  const pow = REAL_HEAD_SECTION_POW;
  const x = REAL_HEAD_RX(y) * Math.sign(sx || 1) * Math.pow(Math.abs(sx), pow);
  const rz = sz >= 0 ? REAL_HEAD_FRONT(y) : REAL_HEAD_BACK(y);
  let z = REAL_HEAD_CZ(y) + rz * Math.sign(sz || 1) * Math.pow(Math.abs(sz), pow);
  if (sz > 0.16) z += realFacialRelief(x, y) * smoothstep(0.16, 0.72, sz);
  const p = out || new THREE.Vector3();
  p.set(x, y, z);
  return p;
}

const _rh0 = new THREE.Vector3(), _rh1 = new THREE.Vector3();
const _rh2 = new THREE.Vector3(), _rh3 = new THREE.Vector3();
const _rhu = new THREE.Vector3(), _rhv = new THREE.Vector3();
function realHeadNormal(u, v, out) {
  const du = 0.0016, dv = 0.0016;
  realHeadPoint(u - du, v, _rh0);
  realHeadPoint(u + du, v, _rh1);
  realHeadPoint(u, Math.max(0, v - dv), _rh2);
  realHeadPoint(u, Math.min(1, v + dv), _rh3);
  _rhu.subVectors(_rh1, _rh0);
  _rhv.subVectors(_rh3, _rh2);
  const n = out || new THREE.Vector3();
  n.crossVectors(_rhu, _rhv).normalize();
  return n;
}

function realFaceSurfaceZ(x, y) {
  const rx = Math.max(0.08, REAL_HEAD_RX(y));
  const ax = Math.min(1, Math.abs(x) / rx);
  const q = Math.pow(
    Math.max(0, 1 - Math.pow(ax, 2 / REAL_HEAD_SECTION_POW)),
    REAL_HEAD_SECTION_POW / 2
  );
  return REAL_HEAD_CZ(y) + REAL_HEAD_FRONT(y) * q + realFacialRelief(x, y);
}

function realFaceNormal(x, y, out) {
  const e = 0.004;
  const dzdx = (realFaceSurfaceZ(x + e, y) - realFaceSurfaceZ(x - e, y)) / (2 * e);
  const dzdy = (realFaceSurfaceZ(x, y + e) - realFaceSurfaceZ(x, y - e)) / (2 * e);
  const n = out || new THREE.Vector3();
  return n.set(-dzdx, -dzdy, 1).normalize();
}

function realFacePoint(x, y, lift = 0) {
  const p = new THREE.Vector3(x, y, realFaceSurfaceZ(x, y));
  if (lift) p.addScaledVector(realFaceNormal(x, y, new THREE.Vector3()), lift);
  return p;
}

function buildRealHeadGeometry() {
  const uSeg = 384, vSeg = 288, nu = uSeg + 1;
  const pos = [], nrm = [], uv = [], idx = [];
  const rp = [], rn = [];
  const P = new THREE.Vector3(), N = new THREE.Vector3(), R = new THREE.Vector3();
  for (let j = 0; j <= vSeg; j++) {
    const v = j / vSeg;
    for (let i = 0; i <= uSeg; i++) {
      const u = i / uSeg;
      realHeadPoint(u, v, P);
      realHeadNormal(u, v, N);
      pos.push(P.x, P.y, P.z);
      nrm.push(N.x, N.y, N.z);
      uv.push(u * 5.4, v * 7.2);
      rockPoint(P, R);
      rp.push(R.x, R.y, R.z);
      const rl = Math.hypot(R.x, R.z) || 1;
      rn.push(R.x / rl * 0.94, 0.18, R.z / rl * 0.94);
    }
  }
  for (let j = 0; j < vSeg; j++) for (let i = 0; i < uSeg; i++) {
    const a = j * nu + i, b = a + 1, c = a + nu + 1, d = a + nu;
    idx.push(a, b, d, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aRockPos', new THREE.Float32BufferAttribute(rp, 3));
  g.setAttribute('aRockNrm', new THREE.Float32BufferAttribute(rn, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

function bakeEllipsoid(rx, ry, rz, x, y, z, seg = 28) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(12, Math.round(seg * 0.66)));
  g.scale(rx, ry, rz);
  g.translate(x, y, z);
  g.computeVertexNormals();
  return g;
}

const REAL_THROAT_Y0 = 28.10;
const REAL_THROAT_Y1 = 29.55;

function realThroatSection(y) {
  const t = smoothstep(REAL_THROAT_Y0, REAL_THROAT_Y1, y);
  const waist = Math.sin(Math.PI * t);
  return {
    /* 胸口外扩、下颌内收，中段略收腰，形成真正的颈胸过渡。 */
    rx: lerp(2.12, 2.08, t) - waist * 0.32,
    front: lerp(0.75, 0.72, t) - waist * 0.035,
    back: lerp(1.05, 0.82, t),
  };
}

function realThroatFrontZ(x, y) {
  const s = realThroatSection(y);
  const q = Math.sqrt(Math.max(0, 1 - Math.pow(x / s.rx, 2)));
  return s.front * q;
}

/* 下宽上收、从胸口连续过渡到下颌的封闭喉部，不再用前凸椭球形成悬空圆盘。 */
function buildSculptedThroatGeometry() {
  const uSeg = 96, vSeg = 72, nu = uSeg + 1;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= vSeg; j++) {
    const t = j / vSeg;
    const y = lerp(REAL_THROAT_Y0, REAL_THROAT_Y1, t);
    const s = realThroatSection(y);
    for (let i = 0; i <= uSeg; i++) {
      const u = i / uSeg, a = u * TAU;
      const sx = Math.sin(a), cz = Math.cos(a);
      const x = s.rx * sx;
      let z = cz >= 0 ? s.front * cz : s.back * cz;
      /*
        三道颈纹直接雕进封闭颈体。横向随正面朝向淡出、中央略下垂，
        因而是随颈部曲率生长的软褶皱，不是套在脖子上的三根圆管。
      */
      if (cz > 0) {
        const frontFade = Math.pow(cz, 1.35);
        const centerSag = 0.085 * Math.pow(cz, 1.10);
        let folds = 0;
        for (let r = 0; r < 3; r++) {
          const foldY = 28.29 + r * 0.225 - centerSag;
          folds += realGauss(y, foldY + 0.022, 0.047) * 0.026;
          folds -= realGauss(y, foldY - 0.034, 0.030) * 0.012;
        }
        z += folds * frontFade;
      }
      pos.push(x, y, z);
      uv.push(u * 3.2, t * 1.8);
    }
  }
  for (let j = 0; j < vSeg; j++) for (let i = 0; i < uSeg; i++) {
    const a = j * nu + i, b = a + 1, c = b + nu, d = a + nu;
    idx.push(a, b, d, b, c, d);
  }
  const bottomCenter = pos.length / 3;
  pos.push(0, REAL_THROAT_Y0, 0); uv.push(0.5, 0.5);
  const topCenter = pos.length / 3;
  pos.push(0, REAL_THROAT_Y1, 0); uv.push(0.5, 0.5);
  for (let i = 0; i < uSeg; i++) {
    idx.push(bottomCenter, i + 1, i);
    const a = vSeg * nu + i, b = a + 1;
    idx.push(topCenter, a, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function addRealStageMesh(parent, geometry, material, name) {
  if (!geometry.attributes.aRockPos) attachRockMorph(geometry);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name || '';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function realDetailMaterial(color, roughness, target) {
  const mat = new THREE.MeshStandardMaterial({
    color, roughness, metalness: 0, transparent: true, opacity: 0,
    depthWrite: false,
  });
  (target || BUDDHA.detailMats).push(mat);
  return mat;
}

function makeTubeThrough(points, radius, radial = 10, tubularOverride = 0) {
  const curve = new THREE.CatmullRomCurve3(points);
  const tubular = tubularOverride || Math.max(18, points.length * 4);
  const frames = curve.computeFrenetFrames(tubular, false);
  const pos = [], uv = [], idx = [];
  const p = new THREE.Vector3(), offset = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, p);
    for (let j = 0; j < radial; j++) {
      const a = j / radial * TAU;
      offset.copy(frames.normals[i]).multiplyScalar(Math.cos(a) * radius)
        .addScaledVector(frames.binormals[i], Math.sin(a) * radius);
      pos.push(p.x + offset.x, p.y + offset.y, p.z + offset.z);
      uv.push(t, j / radial);
    }
  }
  for (let i = 0; i < tubular; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + (j + 1) % radial;
    const d = (i + 1) * radial + j, c = (i + 1) * radial + (j + 1) % radial;
    idx.push(a, d, b, b, d, c);
  }
  const startCenter = pos.length / 3;
  curve.getPointAt(0, p); pos.push(p.x, p.y, p.z); uv.push(0, 0.5);
  const endCenter = pos.length / 3;
  curve.getPointAt(1, p); pos.push(p.x, p.y, p.z); uv.push(1, 0.5);
  const endBase = tubular * radial;
  for (let j = 0; j < radial; j++) {
    const next = (j + 1) % radial;
    idx.push(startCenter, next, j);
    idx.push(endCenter, endBase + j, endBase + next);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/*
  鼻子是贴着面部母曲面生长的一块封闭体积。旧实现逐圈绕鼻轴 loft，底圈
  在正面形成两根叉状棱线；这里改为“正面连续曲面 + 埋入脸内的背面”，
  鼻梁、圆钝鼻头和鼻翼共享同一张拓扑，任何角度都不会裂成几颗小球。
*/
const REAL_NOSE_ROWS = [
  [32.58, 0.120, 0.018], [32.36, 0.180, 0.050], [32.12, 0.250, 0.100],
  [31.88, 0.310, 0.150], [31.62, 0.380, 0.205], [31.39, 0.460, 0.245],
  [31.18, 0.580, 0.265], [31.08, 0.625, 0.235], [30.99, 0.640, 0.170],
  [30.92, 0.560, 0.095], [30.86, 0.390, 0.035], [30.82, 0.130, 0.006],
];
const REAL_NOSE_WIDTH = makeCurve1D([...REAL_NOSE_ROWS].reverse().map((r) => [r[0], r[1]]));
const REAL_NOSE_DEPTH = makeCurve1D([...REAL_NOSE_ROWS].reverse().map((r) => [r[0], r[2]]));

function noseRowAt(y) {
  return [Math.max(0.035, REAL_NOSE_WIDTH(y)), Math.max(0, REAL_NOSE_DEPTH(y))];
}

function realNoseDisplacement(x, y) {
  if (y > REAL_NOSE_ROWS[0][0] || y < REAL_NOSE_ROWS[REAL_NOSE_ROWS.length - 1][0]) return 0;
  const [width, depth] = noseRowAt(y);
  if (Math.abs(x) >= width) return 0;
  const s = clamp(x / Math.max(0.001, width), -1, 1);
  /* 宽缓穹面让鼻梁和鼻翼从面颊连续长出，避免正面形成尖锐三角楔。 */
  const edge = Math.max(0, 1 - Math.abs(s));
  const edgeFade = smoothstep(0.0, 0.22, edge);
  const dome = Math.pow(Math.max(0, 1 - s * s), 0.90);
  const noseTip = realGauss(y, 31.08, 0.19);
  const centralTip = realGauss(s, 0, 0.60) * noseTip * 0.130;
  const wing = realGauss(Math.abs(s), 0.68, 0.25) * noseTip * 0.120;
  const alarLobe = realGauss(Math.abs(x), 0.43, 0.16) * realGauss(y, 30.98, 0.13) * 0.070;
  const columella = realGauss(x, 0, 0.15) * realGauss(y, 30.90, 0.10) * 0.040;
  return (depth * dome + centralTip + wing + alarLobe + columella) * edgeFade;
}

function realNoseFrontZ(x, y) {
  return realFaceSurfaceZ(x, y);
}

function buildNoseGeometry() {
  const rows = REAL_NOSE_ROWS;
  const xSeg = 32, nx = xSeg + 1;
  const pos = [], uv = [], idx = [];
  const frontCount = rows.length * nx;

  for (let layer = 0; layer < 2; layer++) {
    for (let j = 0; j < rows.length; j++) {
      const [y, width, depth] = rows[j];
      for (let i = 0; i <= xSeg; i++) {
        const s = i / xSeg * 2 - 1;
        const x = s * width;
        const base = realFaceSurfaceZ(x, y);
        let z;
        if (layer === 0) {
          z = realFaceSurfaceZ(x, y);
        } else {
          z = base - 0.030;
        }
        pos.push(x, y, z);
        uv.push(i / xSeg, j / (rows.length - 1));
      }
    }
  }

  for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < xSeg; i++) {
    const a = j * nx + i, b = a + 1, d = a + nx, c = d + 1;
    idx.push(a, d, b, b, d, c); // 正面朝 +Z
    const aa = frontCount + a, bb = frontCount + b;
    const cc = frontCount + c, dd = frontCount + d;
    idx.push(aa, bb, dd, bb, cc, dd); // 埋入脸内的背面
  }
  for (let j = 0; j < rows.length - 1; j++) {
    const leftA = j * nx, leftB = (j + 1) * nx;
    const rightA = leftA + xSeg, rightB = leftB + xSeg;
    idx.push(leftA, frontCount + leftA, leftB,
      leftB, frontCount + leftA, frontCount + leftB);
    idx.push(rightA, rightB, frontCount + rightA,
      rightB, frontCount + rightB, frontCount + rightA);
  }
  for (const j of [0, rows.length - 1]) for (let i = 0; i < xSeg; i++) {
    const a = j * nx + i, b = a + 1;
    if (j === 0) idx.push(a, b, frontCount + a, b, frontCount + b, frontCount + a);
    else idx.push(a, frontCount + a, b, b, frontCount + a, frontCount + b);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* 封闭的上下唇体积。u 控制口角到口角，a 绕唇截面一周。 */
function buildLipGeometry(kind, pigment) {
  const uSeg = 52, vSeg = 16, nv = vSeg + 1;
  const pos = [], uv = [], idx = [];
  const isUpper = kind === 'upper';
  const width = isUpper ? 0.62 : 0.65;
  const frontCount = (uSeg + 1) * nv;
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i <= uSeg; i++) {
      const u = i / uSeg * 2 - 1;
      const env = Math.pow(Math.max(0, 1 - u * u), 0.72);
      const seam = 30.325 + realGauss(Math.abs(u), 0.30, 0.19) * 0.008
        - realGauss(u, 0, 0.15) * 0.003 - Math.abs(u) * 0.003;
      const x = u * width;
      const upperBow = 0.030 * realGauss(Math.abs(u), 0.28, 0.20)
        - 0.014 * realGauss(u, 0, 0.15);
      const outer = isUpper
        ? seam + 0.160 * env + upperBow * 0.86
        : seam - 0.235 * env;
      for (let j = 0; j <= vSeg; j++) {
        const q = j / vSeg;
        const y = lerp(seam + (isUpper ? 0.006 : -0.006), outer, q);
        const bulb = Math.pow(Math.max(0, Math.sin(q * Math.PI)), 0.76);
        const depth = (isUpper ? 0.105 : 0.145) * env * bulb;
        const p = realFacePoint(x, y);
        const n = realFaceNormal(x, y, new THREE.Vector3());
        const offset = layer === 0
          ? depth + (pigment ? 0.002 : 0)
          : -0.014;
        p.addScaledVector(n, offset);
        pos.push(p.x, p.y, p.z);
        uv.push(i / uSeg, q);
      }
    }
  }
  for (let i = 0; i < uSeg; i++) for (let j = 0; j < vSeg; j++) {
    const a = i * nv + j, b = (i + 1) * nv + j, c = b + 1, d = a + 1;
    if (isUpper) idx.push(a, b, d, b, c, d);
    else idx.push(a, d, b, b, d, c);
    const aa = frontCount + a, bb = frontCount + b, cc = frontCount + c, dd = frontCount + d;
    if (isUpper) idx.push(aa, dd, bb, bb, dd, cc);
    else idx.push(aa, bb, dd, bb, cc, dd);
  }
  for (const i of [0, uSeg]) for (let j = 0; j < vSeg; j++) {
    const a = i * nv + j, b = a + 1;
    idx.push(a, frontCount + a, b, b, frontCount + a, frontCount + b);
  }
  for (const j of [0, vSeg]) for (let i = 0; i < uSeg; i++) {
    const a = i * nv + j, b = (i + 1) * nv + j;
    idx.push(a, b, frontCount + a, b, frontCount + b, frontCount + a);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function eyeCurve(side, kind) {
  const pts = [];
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    const x = side * lerp(0.38, 1.63, t);
    const arch = Math.pow(Math.max(0, Math.sin(t * Math.PI)), 0.80);
    const centerY = 32.145 - t * 0.036;
    let y;
    if (kind === 'upper') y = centerY + arch * 0.195;
    else if (kind === 'lower') y = centerY - arch * 0.075;
    else y = centerY;
    pts.push(realFacePoint(x, y, kind === 'slit' ? 0.125 : 0.095));
  }
  /* 两侧都保持从画面左到右的顶点序，避免负侧三角形法线反转。 */
  if (side < 0) pts.reverse();
  return pts;
}

function browCurve(side, lift) {
  const pts = [];
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    const x = side * lerp(0.24, 1.74, t);
    const y = 32.65 + Math.sin(t * Math.PI) * 0.310 - t * 0.070;
    pts.push(realFacePoint(x, y, lift));
  }
  if (side < 0) pts.reverse();
  return pts;
}

/* 闭合的杏仁形眼缝：前后两层曲面和侧壁均有真实厚度，不是平面贴片。 */
function buildEyeOpeningGeometry(side) {
  const seg = 40;
  const front = [], back = [];
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const s = side < 0 ? 1 - t : t;
    const rawX = side * lerp(0.38, 1.63, s);
    const x = rawX;
    /* 两端闭合的真实杏仁形开口；旧实现端点不闭合，投影后像矩形黑线。 */
    const arch = Math.pow(Math.max(0, Math.sin(s * Math.PI)), 0.80);
    const centerY = 32.145 - s * 0.036;
    const upper = centerY + arch * 0.132;
    const lower = centerY - arch * 0.040;
    for (const y of [upper, lower]) {
      /* 沿局部面法线嵌入，让三分之四视角仍读作凹腔，而非浮起的黑片。 */
      const p = realFacePoint(x, y, 0.010);
      const n = realFaceNormal(x, y, new THREE.Vector3());
      const pb = p.clone().addScaledVector(n, -0.055);
      front.push([p.x, p.y, p.z]);
      back.push([pb.x, pb.y, pb.z]);
    }
  }
  for (const layer of [front, back]) for (let i = 0; i < layer.length; i++) {
    pos.push(layer[i][0], layer[i][1], layer[i][2]);
    uv.push((i >> 1) / seg, i & 1);
  }
  const row = (seg + 1) * 2;
  for (let i = 0; i < seg; i++) {
    const a = i * 2, b = a + 2, c = b + 1, d = a + 1;
    idx.push(a, d, b, b, d, c);
    const aa = row + a, bb = row + b, cc = row + c, dd = row + d;
    idx.push(aa, bb, dd, bb, cc, dd);
  }
  /* 上下边及两端封口。 */
  for (let i = 0; i < seg; i++) for (const lane of [0, 1]) {
    const a = i * 2 + lane, b = (i + 1) * 2 + lane;
    const c = row + b, d = row + a;
    idx.push(a, d, b, b, d, c);
  }
  for (const e of [0, seg * 2]) {
    idx.push(e, e + 1, row + e, e + 1, row + e + 1, row + e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/*
  在头面曲面上生成宽而低的浮雕带。它是带法线与真实高度变化的网格，
  用于眼睑和眉弓的体积，不使用 PlaneGeometry 或图片轮廓。
*/
function buildFaceReliefRibbonGeometry(points, halfWidth, height, baseLift, crossSeg = 10, crownPow = 1.75) {
  const nc = crossSeg + 1;
  const pos = [], uv = [], idx = [];
  const layerSize = points.length * nc;
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < points.length; i++) {
      const c = points[i];
      const along = i / Math.max(1, points.length - 1);
      const endTaper = Math.pow(Math.sin(along * Math.PI), 0.42);
      for (let j = 0; j <= crossSeg; j++) {
        const s = j / crossSeg * 2 - 1;
        const crown = Math.pow(Math.max(0, Math.cos(s * Math.PI * 0.5)), crownPow) * endTaper;
        const lift = layer === 0 ? baseLift + crown * height : baseLift - 0.010;
        const p = realFacePoint(c.x, c.y + s * halfWidth * endTaper, lift);
        pos.push(p.x, p.y, p.z);
        uv.push(along, j / crossSeg);
      }
    }
  }
  for (let i = 0; i < points.length - 1; i++) for (let j = 0; j < crossSeg; j++) {
    const a = i * nc + j, b = (i + 1) * nc + j, c = b + 1, d = a + 1;
    idx.push(a, b, d, b, c, d);
    const aa = layerSize + a, bb = layerSize + b, cc = layerSize + c, dd = layerSize + d;
    idx.push(aa, dd, bb, bb, dd, cc);
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a0 = i * nc, b0 = (i + 1) * nc;
    idx.push(a0, layerSize + a0, b0, b0, layerSize + a0, layerSize + b0);
    const a1 = i * nc + crossSeg, b1 = (i + 1) * nc + crossSeg;
    idx.push(a1, b1, layerSize + a1, b1, layerSize + b1, layerSize + a1);
  }
  for (const i of [0, points.length - 1]) for (let j = 0; j < crossSeg; j++) {
    const a = i * nc + j, b = a + 1;
    idx.push(a, b, layerSize + a, b, layerSize + b, layerSize + a);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function buildRealFace(parent, mats) {
  const group = new THREE.Group();
  group.name = 'SculptedFace';
  parent.add(group);

  /* 眼窝、眼睑和额弓均为曲面几何；杏仁眼缝藏在上下睑之后。 */
  for (const side of [-1, 1]) {
    addRealStageMesh(group, buildFaceReliefRibbonGeometry(eyeCurve(side, 'upper'), 0.070, 0.040, 0.014, 14), mats.matSkin, 'UpperEyelid');
    addRealStageMesh(group, buildFaceReliefRibbonGeometry(eyeCurve(side, 'lower'), 0.045, 0.028, 0.014, 12), mats.matSkin, 'LowerEyelid');
    addRealStageMesh(group, buildFaceReliefRibbonGeometry(browCurve(side, 0), 0.320, 0.058, 0.008, 18, 1.30), mats.matSkin, 'BrowRidge');
  }

  /* 鼻梁、鼻头和鼻翼直接雕入 AnatomicalHead 母网格，保持连续轮廓与法线。 */

  /* 嘴唇先以素胎实体塑出，再在同一体积上淡入矿物色。 */
  addRealStageMesh(group, buildLipGeometry('upper', false), mats.matSkin, 'UpperLip');
  addRealStageMesh(group, buildLipGeometry('lower', false), mats.matSkin, 'LowerLip');

  const darkMat = realDetailMaterial(0x392820, 0.80, BUDDHA.cavityMats);
  /* 眼腔在素胎阶段也是实体阴影，不能随彩绘 detailOpacity 一起消失。 */
  const eyeSurfaceMat = realDetailMaterial(0x2F241F, 0.94, BUDDHA.cavityMats);
  eyeSurfaceMat.userData.clayColor = new THREE.Color(0x2F241F);
  eyeSurfaceMat.userData.paintColor = new THREE.Color(0x1F1512);
  BUDDHA.parts.eyeSurfaceMats = [eyeSurfaceMat];
  const pupilMat = realDetailMaterial(0x160E0C, 0.96, BUDDHA.cavityMats);
  const lipUpperMat = realDetailMaterial(0x793C34, 0.56);
  const lipLowerMat = realDetailMaterial(0x9B5043, 0.52);
  const mouthMat = realDetailMaterial(0x70453A, 0.78, BUDDHA.cavityMats);
  const urnaMat = realDetailMaterial(0xA82D31, 0.48);

  for (const side of [-1, 1]) {
    const slit = new THREE.Mesh(buildEyeOpeningGeometry(side), eyeSurfaceMat);
    slit.name = 'RecessedEyeSlit'; slit.castShadow = true; slit.renderOrder = 2; group.add(slit);

    /* 扁平封闭椭球藏在半睁眼腔内，形成实体瞳体，而不是贴图或平面黑线。 */
    const px = side * 1.01, py = 32.125;
    const pupil = new THREE.Mesh(
      bakeEllipsoid(0.088, 0.046, 0.011, px, py, realFaceSurfaceZ(px, py) + 0.017, 18),
      pupilMat
    );
    pupil.name = 'RecessedEyePupil'; pupil.castShadow = true; pupil.renderOrder = 3; group.add(pupil);

    const nx = side * 0.41, ny = 30.96;
    const nostril = new THREE.Mesh(
      bakeEllipsoid(0.088, 0.030, 0.018, nx, ny, realNoseFrontZ(nx, ny) - 0.006, 18),
      darkMat
    );
    nostril.name = 'NostrilRecess';
    group.add(nostril);
  }

  const mouthPts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, x = lerp(-0.530, 0.530, t);
    const y = 30.315 - Math.pow(Math.abs(t - 0.5) * 2, 1.7) * 0.008;
    mouthPts.push(realFacePoint(x, y, 0.002));
  }
  const mouth = new THREE.Mesh(makeTubeThrough(mouthPts, 0.0040, 8), mouthMat);
  mouth.name = 'MouthRecess'; group.add(mouth);

  {
    const m = new THREE.Mesh(buildLipGeometry('upper', true), lipUpperMat);
    m.name = 'UpperLipPigment'; m.castShadow = true; group.add(m);
  }
  {
    const m = new THREE.Mesh(buildLipGeometry('lower', true), lipLowerMat);
    m.name = 'LowerLipPigment'; m.castShadow = true; group.add(m);
  }

  /* 白毫是两层实体：泥塑底座 + 彩绘红珠。 */
  const uy = 32.93, uz = realFaceSurfaceZ(0, uy) + 0.055;
  const urnaBase = bakeEllipsoid(0.058, 0.058, 0.040, 0, uy, uz, 20);
  addRealStageMesh(group, urnaBase, mats.matSkin, 'UrnaBase');
  const urna = new THREE.Mesh(bakeEllipsoid(0.052, 0.052, 0.034, 0, uy, uz + 0.035, 20), urnaMat);
  urna.name = 'UrnaPigment'; urna.castShadow = true; group.add(urna);
  BUDDHA.parts.urna = urna;

  BUDDHA.parts.face = group;
}

function buildRealEars(parent, matSkin) {
  const group = new THREE.Group();
  group.name = 'SculptedLongEars';
  for (const side of [-1, 1]) {
    /* 较短而厚的整块耳廓埋入颞侧；耳垂保留宽度，但不再垂成平板。 */
    const shell = new THREE.SphereGeometry(1, 42, 34);
    const pa = shell.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      const lobe = smoothstep(0.12, -0.88, y);
      const upperTaper = smoothstep(0.55, 0.98, y);
      const width = 1 + lobe * 0.32 - upperTaper * 0.28;
      const radial = Math.min(1, Math.hypot(x, y));
      const concha = z > 0 ? 0.29 * radial * radial - 0.20 * (1 - radial * radial) : 0;
      pa.setXYZ(i,
        side * 2.10 + x * 0.39 * width,
        30.98 + y * 1.50 - lobe * 0.050,
        -0.035 + z * (0.265 + lobe * 0.110) + concha
      );
    }
    pa.needsUpdate = true;
    shell.computeVertexNormals();
    addRealStageMesh(group, shell, matSkin, 'EarShell');

    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      pts.push(new THREE.Vector3(
        side * (2.12 + Math.sin(t * Math.PI) * 0.130),
        lerp(32.35, 29.58, t),
        0.265 + Math.sin(t * Math.PI) * 0.070
      ));
    }
    if (side < 0) pts.reverse();
    addRealStageMesh(group, makeTubeThrough(pts, 0.045, 9), matSkin, 'EarInnerRidge');
  }
  parent.add(group);
  BUDDHA.parts.ears = group;
}

function addIdentityRockAttributes(g) {
  const p = g.attributes.position, n = g.attributes.normal;
  const rp = new Float32Array(p.array.length);
  rp.set(p.array);
  const rn = new Float32Array(p.count * 3);
  if (n) rn.set(n.array);
  else for (let i = 0; i < p.count; i++) rn[i * 3 + 2] = 1;
  g.setAttribute('aRockPos', new THREE.BufferAttribute(rp, 3));
  g.setAttribute('aRockNrm', new THREE.BufferAttribute(rn, 3));
  return g;
}

/* 单枚螺发：三层封闭锥状颗粒 + 真正抬离头皮的空间螺旋环脊。 */
function buildCurlGeometry() {
  const base = bakeEllipsoid(0.185, 0.185, 0.120, 0, 0, 0.055, 16);
  const middle = bakeEllipsoid(0.132, 0.132, 0.085, 0, 0, 0.145, 14);
  const crown = bakeEllipsoid(0.066, 0.066, 0.055, 0, 0, 0.225, 12);
  const pts = [];
  const turns = 2.85, steps = 44;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * TAU;
    const r = lerp(0.162, 0.018, Math.pow(t, 0.90));
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0.115 + t * 0.140));
  }
  const ridge = makeTubeThrough(pts, 0.018, 7, 64);
  const g = mergeGeometries([base, middle, crown, ridge]);
  g.computeVertexNormals();
  return addIdentityRockAttributes(g);
}

/* 发卷下方的头皮帽也是随头颅弯曲的实体曲面，避免近景从发卷缝隙漏出背景。 */
function buildHairCapGeometry() {
  const uSeg = 128, vSeg = 34, nu = uSeg + 1;
  const pos = [], uv = [], idx = [];
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  for (let j = 0; j <= vSeg; j++) {
    const t = j / vSeg;
    for (let i = 0; i <= uSeg; i++) {
      const u = i / uSeg;
      const frontness = Math.cos(u * TAU) * 0.5 + 0.5;
      const hairline = lerp(30.62, 33.44, Math.pow(frontness, 0.36));
      const y = lerp(hairline, 35.49, Math.pow(t, 0.94));
      const v = (y - REAL_HEAD_Y0) / (REAL_HEAD_Y1 - REAL_HEAD_Y0);
      realHeadPoint(u, v, P);
      realHeadNormal(u, v, N);
      P.addScaledVector(N, 0.028);
      pos.push(P.x, P.y, P.z);
      uv.push(u * 6, t * 4);
    }
  }
  for (let j = 0; j < vSeg; j++) for (let i = 0; i < uSeg; i++) {
    const a = j * nu + i, b = a + 1, c = b + nu, d = a + nu;
    idx.push(a, b, d, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function buildRealHair(parent, matHair) {
  const cap = addRealStageMesh(parent, buildHairCapGeometry(), matHair, 'SculptedHairCap');
  BUDDHA.parts.hairCap = cap;
  const curlGeo = buildCurlGeometry();
  const curls = [];
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  const rows = 24;
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    const y = lerp(30.72, 35.28, Math.pow(t, 0.93));
    const v = (y - REAL_HEAD_Y0) / (REAL_HEAD_Y1 - REAL_HEAD_Y0);
    const cols = Math.max(13, Math.round(lerp(37, 13, t)));
    for (let c = 0; c < cols; c++) {
      const u = (c + (r % 2) * 0.47) / cols;
      const frontness = Math.cos(u * TAU) * 0.5 + 0.5;
      const hairline = lerp(30.62, 33.44, Math.pow(frontness, 0.36));
      if (y < hairline) continue;
      realHeadPoint(u, v, P);
      realHeadNormal(u, v, N);
      P.addScaledVector(N, 0.038);
      curls.push({
        p: P.clone(), n: N.clone(),
        s: 1.0 + (hash3(r, c, 17) - 0.5) * 0.12,
        twist: (hash3(r, c, 29) - 0.5) * 0.36,
      });
    }
  }

  const inst = new THREE.InstancedMesh(curlGeo, matHair, curls.length);
  inst.name = 'ThreeDimensionalSpiralCurls';
  inst.castShadow = true;
  inst.receiveShadow = true;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), twistQ = new THREE.Quaternion(), S = new THREE.Vector3();
  const forward = new THREE.Vector3(0, 0, 1);
  const baseMatrices = [], revealY = [];
  curls.forEach((c, i) => {
    Q.setFromUnitVectors(forward, c.n);
    twistQ.setFromAxisAngle(forward, c.twist);
    Q.multiply(twistQ);
    S.setScalar(c.s);
    M.compose(c.p, Q, S);
    inst.setMatrixAt(i, M);
    baseMatrices.push(M.clone());
    revealY.push(c.p.y);
  });
  inst.userData.baseMatrices = baseMatrices;
  inst.userData.revealY = revealY;
  inst.userData.isTrueSpiralGeometry = true;
  inst.instanceMatrix.needsUpdate = true;
  parent.add(inst);
  BUDDHA.parts.hair = inst;
  BUDDHA.parts.hairCurlCount = curls.length;
}

function taperedFinger(points, r0, r1) {
  return tubeAlong(points, (t) => {
    const base = lerp(r0, r1, smoothstep(0, 1, t));
    const knuckle = 1 + realGauss(t, 0.34, 0.10) * 0.060 + realGauss(t, 0.68, 0.085) * 0.045;
    return base * knuckle;
  }, 42, 14);
}

function fingertipGeometry(p, r, vertical) {
  return bakeEllipsoid(r * 1.02, vertical ? r * 1.22 : r * 0.88, vertical ? r * 0.86 : r * 1.18, p.x, p.y, p.z, 20);
}

function buildPalmGeometry(cx, cy, cz, rx, ry, rz) {
  const g = new THREE.SphereGeometry(1, 42, 30);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    /* 指根略宽、腕部收窄、掌弓前凸，形成真实掌形而非圆球。 */
    const top = smoothstep(-0.15, 0.82, y);
    const wrist = smoothstep(-0.15, -0.92, y);
    const width = 0.94 + top * 0.10 - wrist * 0.34;
    const arch = (1 - x * x) * (1 - y * y) * 0.16;
    p.setXYZ(i, cx + x * rx * width, cy + y * ry, cz + z * rz + arch);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

function buildRaisedHandGeometry() {
  /* 参考片中施无畏印是前景视觉锚点：掌心略低于胸口，比例明显大于旧版。 */
  const cx = -4.55, cy = 25.95, cz = 5.25;
  const parts = [
    buildPalmGeometry(cx, cy, cz, 1.17, 1.25, 0.44),
    buildTaperedConnectorGeometry(
      new THREE.Vector3(cx, cy - 1.42, cz - 0.20),
      new THREE.Vector3(cx, cy - 0.80, cz - 0.07),
      0.43,
      0.62
    ),
  ];
  const xs = [-0.65, -0.22, 0.22, 0.66];
  const lens = [1.90, 2.32, 2.47, 2.18];
  const r0 = [0.262, 0.282, 0.292, 0.270];
  const r1 = [0.180, 0.194, 0.201, 0.187];
  const lean = [-0.140, -0.040, 0.035, 0.120];
  for (let i = 0; i < 4; i++) {
    const x0 = cx + xs[i], y0 = cy + 0.68;
    const end = new THREE.Vector3(x0 + lean[i] * 1.8, y0 + lens[i], cz - 0.01);
    const pts = [
      new THREE.Vector3(x0, y0, cz),
      new THREE.Vector3(x0 + lean[i] * 0.38, y0 + lens[i] * 0.31, cz + 0.075),
      new THREE.Vector3(x0 + lean[i] * 1.12, y0 + lens[i] * 0.68, cz - 0.045),
      end,
    ];
    parts.push(taperedFinger(pts, r0[i], r1[i]));
    parts.push(fingertipGeometry(end, r1[i] * 1.04, true));
  }
  /* 拇指位于靠身体一侧，离掌约 45° 张开。 */
  const thumbEnd = new THREE.Vector3(cx + 1.94, cy + 1.34, cz + 0.02);
  parts.push(taperedFinger([
    new THREE.Vector3(cx + 0.70, cy - 0.02, cz + 0.01),
    new THREE.Vector3(cx + 1.29, cy + 0.59, cz + 0.10),
    thumbEnd,
  ], 0.320, 0.218));
  parts.push(fingertipGeometry(thumbEnd, 0.225, false));
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  scaleUV(g, 4.5);
  return g;
}

function buildRestingHandGeometry() {
  /* 参考片为收拢在膝侧的圆钝袖端/握拳，不是四指直垂的张开白手。 */
  const cx = 3.85, cy = 20.85, cz = 6.66;
  const parts = [bakeEllipsoid(1.14, 1.02, 0.58, cx, cy, cz, 36)];
  const xs = [-0.62, -0.22, 0.20, 0.59];
  for (let i = 0; i < 4; i++) {
    parts.push(bakeEllipsoid(
      0.29, 0.38, 0.25,
      cx + xs[i], cy + 0.40 - Math.abs(i - 1.5) * 0.035, cz + 0.48,
      20
    ));
  }
  parts.push(taperedFinger([
    new THREE.Vector3(cx - 0.76, cy + 0.36, cz + 0.44),
    new THREE.Vector3(cx - 0.10, cy + 0.02, cz + 0.62),
    new THREE.Vector3(cx + 0.66, cy - 0.18, cz + 0.48),
  ], 0.32, 0.23));
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  scaleUV(g, 4.5);
  return g;
}

function buildTaperedConnectorGeometry(a, b, r0, r1) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  const m = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1));
  const g = new THREE.CylinderGeometry(r1, r0, len, 32, 8, false);
  g.applyMatrix4(m);
  g.computeVertexNormals();
  return g;
}

function buildRealHands(parent, mats) {
  const raisedSleeve = addRealStageMesh(
    parent,
    tubeAlong([
      new THREE.Vector3(-4.45, 27.65, 0.05),
      new THREE.Vector3(-4.62, 26.55, 1.55),
      new THREE.Vector3(-4.63, 25.35, 3.55),
      new THREE.Vector3(-4.57, 24.70, 4.88),
    ], (t) => lerp(1.78, 0.82, Math.pow(t, 0.82)), 54, 20),
    mats.matInner,
    'VolumetricRaisedSleeve'
  );
  const cuff = addRealStageMesh(
    parent,
    buildTaperedConnectorGeometry(
      new THREE.Vector3(-4.59, 24.55, 4.78),
      new THREE.Vector3(-4.56, 25.12, 5.12),
      0.90,
      0.80
    ),
    mats.matInner,
    'BlueSleeveCuff'
  );
  const restingSleeve = addRealStageMesh(
    parent,
    tubeAlong([
      new THREE.Vector3(5.70, 24.20, 0.45),
      new THREE.Vector3(5.20, 23.50, 2.65),
      new THREE.Vector3(4.50, 22.45, 4.70),
      new THREE.Vector3(3.98, 21.70, 6.34),
    ], (t) => lerp(1.78, 0.72, Math.pow(t, 0.78)), 54, 20),
    mats.matRobe,
    'VolumetricRestingSleeve'
  );
  const restingCuff = addRealStageMesh(
    parent,
    buildTaperedConnectorGeometry(
      new THREE.Vector3(4.10, 21.78, 6.24),
      new THREE.Vector3(3.88, 21.25, 6.60),
      0.78,
      0.66
    ),
    mats.matRobe,
    'RestingSleeveCuff'
  );
  const raised = addRealStageMesh(parent, buildRaisedHandGeometry(), mats.matSkin, 'AbhayaHand');
  const resting = addRealStageMesh(parent, buildRestingHandGeometry(), mats.matRobe, 'RobedRestingHand');
  BUDDHA.parts.cuffR = cuff;
  BUDDHA.parts.raisedSleeve = raisedSleeve;
  BUDDHA.parts.restingSleeve = restingSleeve;
  BUDDHA.parts.restingCuff = restingCuff;
  BUDDHA.parts.handR = raised;
  BUDDHA.parts.handL = resting;
}

function robeFrontPoint(x, y, lift) {
  const rx = Math.max(0.2, PROF_RX(y));
  const a = Math.asin(clamp(x / rx, -0.995, 0.995));
  const u = a / TAU;
  const p = bodyPoint(u, yv(y), new THREE.Vector3());
  const n = bodyNormal(u, yv(y), new THREE.Vector3());
  return p.addScaledVector(n, lift);
}

function buildFoldRibbonGeometry(centers, halfWidth, height, baseLift) {
  const crossSeg = 12, nc = crossSeg + 1;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i < centers.length; i++) {
    const x = centers[i][0], y = centers[i][1];
    const along = i / Math.max(1, centers.length - 1);
    /* 左右端同时把浮雕高度和离面距离压回裙面，侧视不再露出悬空尖角。 */
    const endTaper = smoothstep(0, 0.18, along) * smoothstep(0, 0.18, 1 - along);
    for (let j = 0; j <= crossSeg; j++) {
      const s = j / crossSeg * 2 - 1;
      const crown = Math.pow(Math.max(0, Math.cos(s * Math.PI * 0.5)), 2.2);
      const p = robeFrontPoint(x, y + s * halfWidth, (baseLift + crown * height) * endTaper);
      pos.push(p.x, p.y, p.z);
      uv.push(i / Math.max(1, centers.length - 1) * 5, j / crossSeg * 2);
    }
  }
  for (let i = 0; i < centers.length - 1; i++) for (let j = 0; j < crossSeg; j++) {
    const a = i * nc + j, b = (i + 1) * nc + j, c = b + 1, d = a + 1;
    idx.push(a, b, d, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function bodyLayerPoint(u, y, lift) {
  const uu = ((u % 1) + 1) % 1;
  const p = bodyPoint(uu, yv(y), new THREE.Vector3());
  const n = bodyNormal(uu, yv(y), new THREE.Vector3());
  return p.addScaledVector(n, lift);
}

/*
  孔雀蓝内披使用明确的肩、腹轮廓生成连续厚布片。旧版 inner 依靠母网格
  mask 删三角形，斜边会随网格阶梯化；这里生成前后两层并封住四边。
*/
function buildCoherentInnerDrapeGeometry() {
  const alongSeg = 104, crossSeg = 30;
  const nc = crossSeg + 1, layerStride = (alongSeg + 1) * nc;
  const pos = [], uv = [], idx = [];

  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i <= alongSeg; i++) {
      const t = i / alongSeg;
      const rise = smoothstep(0, 1, t);
      /* 观者左侧：腹部收窄，向上展开到左肩与颈侧。 */
      const outerU = lerp(-0.160, -0.235, rise);
      const innerU = lerp(-0.090, 0.018, smoothstep(0.06, 0.96, t));
      const outerY = lerp(18.75, 27.85, t);
      const innerY = lerp(19.00, 29.18, t);

      for (let j = 0; j <= crossSeg; j++) {
        const q = j / crossSeg;
        const u = lerp(outerU, innerU, q);
        const y = lerp(outerY, innerY, q);
        const broadFold = Math.pow(Math.sin(q * Math.PI), 1.25)
          * (0.5 + 0.5 * Math.cos(q * Math.PI * 3.0 - t * 0.8));
        const lift = layer === 0 ? 0.235 + broadFold * 0.050 : 0.165;
        const p = bodyLayerPoint(u, y, lift);
        pos.push(p.x, p.y, p.z);
        uv.push(q * 3.2, t * 5.0);
      }
    }
  }

  for (let i = 0; i < alongSeg; i++) for (let j = 0; j < crossSeg; j++) {
    const a = i * nc + j, b = (i + 1) * nc + j, c = b + 1, d = a + 1;
    idx.push(a, b, d, b, c, d);
    const aa = layerStride + a, bb = layerStride + b;
    const cc = layerStride + c, dd = layerStride + d;
    idx.push(aa, dd, bb, bb, dd, cc);
  }
  const seal = (a, b) => {
    const aa = layerStride + a, bb = layerStride + b;
    idx.push(a, aa, b, b, aa, bb);
  };
  for (let i = 0; i < alongSeg; i++) {
    seal(i * nc, (i + 1) * nc);
    seal(i * nc + crossSeg, (i + 1) * nc + crossSeg);
  }
  for (let j = 0; j < crossSeg; j++) {
    seal(j, j + 1);
    seal(alongSeg * nc + j + 1, alongSeg * nc + j);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/*
  胸前斜披是一整块有厚度的弯曲布片。旧版依靠参数遮罩裁剪母网格，近景会
  把三角形裁口读成碎布条；这里直接生成前后两层并封住四边，纹样只负责
  表面颜色，轮廓、厚度、褶皱和阴影全部来自实体几何。
*/
function buildCoherentSashGeometry() {
  const alongSeg = 112, crossSeg = 28;
  const nc = crossSeg + 1, layerStride = (alongSeg + 1) * nc;
  const pos = [], uv = [], idx = [];
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i <= alongSeg; i++) {
      const t = i / alongSeg;
      const du = lerp(-0.205, 0.225, t);
      const s = (du + 0.205) / 0.43;
      const vLo = 0.5720 + s * 0.1220;
      const vHi = 0.6820 + s * 0.1350;
      for (let j = 0; j <= crossSeg; j++) {
        const q = j / crossSeg;
        const y = lerp(vLo, vHi, q) * H;
        const edge = Math.pow(Math.sin(q * Math.PI), 0.55);
        const broadFold = Math.pow(0.5 + 0.5 * Math.cos(q * Math.PI * 3.0 + t * 0.65), 1.45);
        const lift = layer === 0
          ? 0.395 + edge * (0.070 + broadFold * 0.185)
          : 0.285;
        const p = bodyLayerPoint(0.055 + du, y, lift);
        pos.push(p.x, p.y, p.z);
        uv.push(t * 7.0, q * 3.0);
      }
    }
  }

  for (let i = 0; i < alongSeg; i++) for (let j = 0; j < crossSeg; j++) {
    const a = i * nc + j, b = (i + 1) * nc + j, c = b + 1, d = a + 1;
    idx.push(a, b, d, b, c, d);
    const aa = layerStride + a, bb = layerStride + b;
    const cc = layerStride + c, dd = layerStride + d;
    idx.push(aa, dd, bb, bb, dd, cc);
  }
  const seal = (a, b) => {
    const aa = layerStride + a, bb = layerStride + b;
    idx.push(a, aa, b, b, aa, bb);
  };
  for (let i = 0; i < alongSeg; i++) {
    seal(i * nc, (i + 1) * nc);
    seal(i * nc + crossSeg, (i + 1) * nc + crossSeg);
  }
  for (let j = 0; j < crossSeg; j++) {
    seal(j, j + 1);
    seal(alongSeg * nc + j + 1, alongSeg * nc + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function buildGarmentHemPath(sample, segments, lift) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const [u, y] = sample(i / segments);
    pts.push(bodyLayerPoint(u, y, lift));
  }
  return pts;
}

/*
  衣片边缘使用有封口的薄带，而不是圆管或共面的透明三角形。这样斜向裁片
  在超近景中仍是一条连续布边，能投下细阴影，也不会露出网格阶梯。
*/
function buildGarmentBorderGeometry(sample, segments, halfWidth, lift, height, thickness = 0.035) {
  const centers = [];
  const params = [];
  for (let i = 0; i <= segments; i++) {
    const [u, y] = sample(i / segments);
    params.push([u, y]);
    centers.push(bodyLayerPoint(u, y, lift));
  }

  const pos = [], uv = [], idx = [];
  const tangent = new THREE.Vector3(), normal = new THREE.Vector3();
  const side = new THREE.Vector3(), left = new THREE.Vector3(), right = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const prev = centers[Math.max(0, i - 1)];
    const next = centers[Math.min(segments, i + 1)];
    tangent.subVectors(next, prev).normalize();
    const [u, y] = params[i];
    bodyNormal(((u % 1) + 1) % 1, yv(y), normal).normalize();
    side.crossVectors(normal, tangent).normalize();
    left.copy(centers[i]).addScaledVector(side, halfWidth);
    right.copy(centers[i]).addScaledVector(side, -halfWidth);
    for (const p of [
      left.clone().addScaledVector(normal, height),
      right.clone().addScaledVector(normal, height),
      left.clone().addScaledVector(normal, -thickness),
      right.clone().addScaledVector(normal, -thickness),
    ]) pos.push(p.x, p.y, p.z);
    const t = i / segments;
    uv.push(t * 4, 1, t * 4, 0, t * 4, 1, t * 4, 0);
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 4, b = a + 4;
    idx.push(a, a + 1, b, b, a + 1, b + 1);                 // top
    idx.push(a + 2, b + 2, a + 3, b + 2, b + 3, a + 3);     // underside
    idx.push(a, b, a + 2, b, b + 2, a + 2);                 // left wall
    idx.push(a + 1, a + 3, b + 1, b + 1, a + 3, b + 3);     // right wall
  }
  const last = segments * 4;
  idx.push(0, 2, 1, 1, 2, 3);
  idx.push(last, last + 1, last + 2, last + 1, last + 3, last + 2);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* 胸腹和下裙的大 U 形衣褶是宽缓的实体浮雕带，可投影和产生视差。 */
function buildRealRobeFolds(parent, mats) {
  const group = new THREE.Group();
  group.name = 'VolumetricRobeFolds';

  const innerDrape = addRealStageMesh(
    group,
    buildCoherentInnerDrapeGeometry(),
    mats.matInner,
    'CoherentBlueShoulderDrape'
  );
  BUDDHA.parts.innerDrape = innerDrape;
  addRealStageMesh(group, buildCoherentSashGeometry(), mats.matSash, 'CoherentDiagonalSashCloth');

  const lowerFolds = [
    [15.35, 7.05, 1.55, 0.48, 0.27],
    [12.70, 7.55, 1.85, 0.55, 0.29],
    [9.85, 8.05, 2.10, 0.61, 0.31],
    [6.90, 8.45, 2.25, 0.67, 0.32],
    [3.95, 8.80, 2.05, 0.72, 0.30],
  ];
  for (const [baseY, span, rise, halfWidth, height] of lowerFolds) {
    const centers = [];
    for (let i = 0; i <= 42; i++) {
      const t = i / 42, x = lerp(-span, span, t);
      const y = baseY + rise * Math.pow(Math.abs(x) / span, 1.55);
      centers.push([x, y]);
    }
    /* 圆管会像绳索缠在裙面；宽缓浮雕带才符合参考片的厚重泥塑衣褶。 */
    const g = buildFoldRibbonGeometry(centers, halfWidth, height, 0.25);
    addRealStageMesh(group, g, mats.matRobeLower, 'LowerUShapeFoldRidge');
  }

  /* 参考片胸前斜披的三道厚褶：沿胸廓弯曲，而不是画在颜色纹样里。 */
  for (const edge of ['lower', 'upper']) {
    const g = buildGarmentBorderGeometry((t) => {
      const du = lerp(-0.205, 0.225, t);
      const s = (du + 0.205) / 0.43;
      const v = edge === 'upper' ? 0.6820 + s * 0.1350 : 0.5720 + s * 0.1220;
      return [0.055 + du, v * H];
    }, 128, 0.105, 0.345, 0.028);
    addRealStageMesh(group, g, mats.matSash, `TailoredSash${edge === 'upper' ? 'Upper' : 'Lower'}Edge`);
  }

  parent.add(group);
  BUDDHA.parts.volumetricFolds = group;
}

/* 开场背屏也改为薄浮雕实体；施工和彩绘段按参考片隐藏。 */
function buildGeometricBackscreen(parent) {
  const group = new THREE.Group();
  group.name = 'GeometricOpeningBackscreen';
  const baseMat = realDetailMaterial(0xC6A06F, 0.82, BUDDHA.haloMats);
  const redMat = realDetailMaterial(0xA65343, 0.76, BUDDHA.haloMats);
  const blueMat = realDetailMaterial(0x4D8787, 0.72, BUDDHA.haloMats);
  const greenMat = realDetailMaterial(0x7EA17D, 0.80, BUDDHA.haloMats);

  const disk = new THREE.Mesh(new THREE.CylinderGeometry(6.15, 6.15, 0.16, 80), baseMat);
  disk.rotation.x = Math.PI / 2;
  disk.position.set(0, 32.0, -3.66);
  disk.receiveShadow = true;
  group.add(disk);
  for (const [r, tube, mat, z] of [
    [5.72, 0.16, redMat, -3.54], [4.88, 0.13, blueMat, -3.48],
    [4.15, 0.11, greenMat, -3.43], [3.42, 0.10, redMat, -3.39],
  ]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 12, 80), mat);
    ring.position.set(0, 32.0, z);
    ring.castShadow = true;
    group.add(ring);
  }
  /* 周缘莲瓣/宝珠为独立实体，产生真实视差。 */
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * TAU;
    const x = Math.sin(a) * 5.24, y = 32.0 + Math.cos(a) * 5.24;
    const petal = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), i % 2 ? blueMat : greenMat);
    petal.scale.set(0.30, 0.48, 0.11);
    petal.rotation.z = -a;
    petal.position.set(x, y, -3.30);
    petal.castShadow = true;
    group.add(petal);
  }
  parent.add(group);
  BUDDHA.parts.halo = group;
  BUDDHA.parts.haloCrown = group;
}

function upgradeBuddhaRealism(parent, mats) {
  const legacyHair = BUDDHA.parts.hair;
  for (const key of [
    'head', 'legacyFace', 'legacyEars', 'handR', 'handL',
    'armR', 'armL', 'sleeveR', 'sleeveL', 'footL', 'footR', 'belt', 'inner',
    'urna', 'halo', 'haloCrown',
  ]) {
    if (BUDDHA.parts[key]) BUDDHA.parts[key].visible = false;
  }
  if (legacyHair) legacyHair.visible = false;

  const realism = new THREE.Group();
  realism.name = 'RealThreeDimensionalBuddhaUpgrade';
  parent.add(realism);

  const headAssembly = new THREE.Group();
  headAssembly.name = 'AnatomicalHeadAssembly';
  /* 原 Round2 胸腔过深；将头颈整体前移到肩带上方，避免近景被胸腔横向截断。 */
  headAssembly.position.z = 1.94;
  /* 参考全身镜头的头掌比例明显大于旧 Round2 骨架；围绕颈根放大，而非用镜头假放大。 */
  headAssembly.scale.set(1.24, 1.15, 1.10);
  headAssembly.position.y = REAL_THROAT_Y0 * (1 - headAssembly.scale.y);
  realism.add(headAssembly);

  const neck = addRealStageMesh(
    headAssembly,
    buildSculptedThroatGeometry(),
    mats.matSkin,
    'SculptedNeck'
  );
  BUDDHA.parts.neck = neck;
  const head = addRealStageMesh(headAssembly, buildRealHeadGeometry(), mats.matSkin, 'AnatomicalHead');
  BUDDHA.parts.head = head;
  buildRealFace(headAssembly, mats);
  buildRealEars(headAssembly, mats.matSkin);
  buildRealHands(realism, mats);
  buildRealRobeFolds(realism, mats);
  buildRealHair(headAssembly, mats.matHair);
  buildGeometricBackscreen(realism);

  /* 用连续封闭布片替换遮罩裁片，并校正参考片里宽肩、宽胸的坐佛比例。 */
  if (BUDDHA.parts.sash) BUDDHA.parts.sash.visible = false;
  for (const key of ['torso', 'robe']) {
    if (BUDDHA.parts[key]) BUDDHA.parts[key].scale.x = 1.06;
  }
  if (BUDDHA.parts.lower) BUDDHA.parts.lower.scale.x = 1.03;
  if (BUDDHA.parts.volumetricFolds) BUDDHA.parts.volumetricFolds.scale.x = 1.06;

  realism.userData.usesImageImpostor = false;
  realism.userData.geometryContract = 'volumetric-surfaces-with-normals-no-impostors';
  realism.userData.referencePose = 'abhaya-right-hand-resting-left-hand';
  BUDDHA.parts.realism = realism;
  BUDDHA.parts.headAssembly = headAssembly;
}
