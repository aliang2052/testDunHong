/* ============================================================
   20 - 大佛形体参数化（依据视频 t=8 正面 / t=96 侧面逐像素测量）
   坐标：Y 向上，佛面朝 +Z，脚底中心为原点，单位 = 米，通高 35.5m
   ============================================================ */

const BUDDHA_H = 35.5;

/* --- 一维 Catmull-Rom 采样器：给定 (key, value) 关键点 --- */
function makeCurve1D(pts) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const n = pts.length;
  return function (x) {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && xs[i + 1] < x) i++;
    const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
    const p0 = ys[Math.max(0, i - 1)], p1 = ys[i], p2 = ys[i + 1], p3 = ys[Math.min(n - 1, i + 2)];
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  };
}

/* ------------------------------------------------------------
   横截面半轴：rx（左右）、rz（前后）、cz（截面中心前后偏移）
   数值由 t8 逐行量宽 + t96 侧影换算而来
   ------------------------------------------------------------ */
const PROF_RX = makeCurve1D([
  /* 35.5m倚坐佛：宽阔下身、收腰、斜肩、窄颈与庄严头面。 */
  [-1.00, 9.15], [0.00, 9.18], [2.00, 9.22], [5.00, 9.18],
  [8.00, 9.05], [11.00, 8.82], [14.00, 8.45], [17.00, 7.72],
  [19.00, 6.75], [20.50, 5.95], [22.00, 5.38], [23.50, 5.18],
  [24.70, 5.32], [25.65, 5.68], [26.45, 6.10], [27.05, 6.25],
  [27.55, 5.78], [28.05, 4.52], [28.48, 3.05], [28.84, 1.92],
  [29.35, 1.74], [29.85, 1.92], [30.40, 2.14], [31.20, 2.28],
  [32.10, 2.34], [33.00, 2.30], [33.80, 2.18], [34.45, 1.95],
  [34.95, 1.58], [35.38, 0.90], [35.60, 0.18],
]);

const PROF_RZ = makeCurve1D([
  [-1.00, 6.22], [0.00, 6.24], [2.00, 6.26], [5.00, 6.22],
  [8.00, 6.08], [11.00, 5.86], [14.00, 5.55], [17.00, 5.15],
  [19.00, 4.70], [20.50, 4.30], [22.00, 4.02], [23.50, 3.90],
  [24.70, 3.96], [25.65, 4.10], [26.45, 4.22], [27.05, 4.26],
  [27.55, 4.00], [28.05, 3.35], [28.48, 2.45], [28.84, 1.72],
  [29.35, 1.62], [29.85, 1.82], [30.40, 2.14], [31.20, 2.35],
  [32.10, 2.46], [33.00, 2.42], [33.80, 2.28], [34.45, 2.02],
  [34.95, 1.64], [35.38, 0.94], [35.60, 0.18],
]);

/* 截面中心的前后位移：坐姿下身前倾、头略后靠 */
const PROF_CZ = makeCurve1D([
  [0.00, 0.48], [6.00, 0.42], [12.00, 0.34], [18.00, 0.20],
  [21.50, 0.06], [24.00, -0.02], [26.50, -0.08], [28.20, -0.14],
  [29.00, -0.04], [30.20, 0.18], [31.80, 0.28], [33.20, 0.22],
  [34.40, 0.05], [35.55, -0.16],
]);

/* ------------------------------------------------------------
   衣褶：下裙的横向 U 形垂褶（t8 可数出 7 道大褶）
   ------------------------------------------------------------ */
function foldDisp(u, y) {
  const a = u * TAU;
  const front = Math.cos(a);                 // +1 正前，-1 背后
  const side = Math.abs(Math.sin(a));

  let d = 0;

  if (y < 19.5) {
    /* 主褶：等高线 y = c - K·cos(a) → 正面中央最低，向两侧上翘（U 形垂褶） */
    const K = 4.75 * smoothstep(19.5, 6.5, y) + 1.20;       // 越靠下 U 形越深
    const lam = 2.28 + (19.5 - y) * 0.046;                  // 褶距自上而下加大
    const jig = (fbm2(y * 0.13, 3.7, 3, 21) - 0.5) * 0.42;
    const phase = (y + K * front + 0.42 * Math.sin(a * 2.0 + 0.7) + jig) / lam;
    const amp = 0.0305 * smoothstep(19.5, 15.0, y) * smoothstep(0.0, 2.6, y)
              * (0.80 + 0.34 * fbm2(y * 0.19, 1.3, 3, 7));
    // 尖底的褶形（|sin| 加权），比纯正弦更像布料堆叠
    const frontW = 0.30 + 0.70 * smoothstep(-0.35, 0.72, front);
    const sv = Math.sin(phase * TAU);
    d += (sv * 0.68 + Math.sign(sv) * Math.pow(Math.abs(sv), 2.2) * 0.32) * amp * frontW;

    /* 次级细褶：同样是水平走向 */
    d += Math.sin(((y + K * 0.62 * front) / (lam * 0.46)) * TAU) * 0.0072
       * smoothstep(19.0, 14.0, y) * smoothstep(1.2, 4.5, y);

    /* 侧面的竖向瀑布褶（幅度小，只出现在正侧方） */
    const sideOnly = Math.pow(side, 2.2) * smoothstep(0.55, -0.2, front);
    d += Math.sin(a * 8.0 + y * 0.09 + fbm2(a * 1.1, y * 0.05, 2, 5) * 2.0) * 0.020 * sideOnly
       * smoothstep(0.8, 5.0, y) * smoothstep(19.5, 12.0, y);
    d += Math.sin(a * 15.0 - y * 0.14) * 0.0088 * sideOnly * smoothstep(1.5, 6.0, y) * smoothstep(19.0, 11.0, y);

    /* 裙摆落地处外撇 */
    d += smoothstep(3.4, 0.0, y) * 0.045;
  }

  if (y >= 17.0 && y < 29.6) {
    /* 上身袈裟褶：右肩(-X)垂下的大 U 褶 + 胸前斜披的层叠 */
    const t = smoothstep(17.0, 20.0, y) * smoothstep(29.6, 27.0, y);
    d += Math.sin((y / 1.72 + front * 0.42) * TAU) * 0.0210 * t;
    d += Math.sin(a * 5.0 + y * 0.32) * 0.0120 * t;
  }

  /* 头颈区不加褶 */
  if (y > 29.4) d *= smoothstep(30.4, 29.4, y);

  return d;
}

/* ------------------------------------------------------------
   膝盖：倚坐双腿下垂并拢，正前方 y≈13~18 有两团圆凸
   ------------------------------------------------------------ */
function kneeBulge(u, y) {
  const a = u * TAU;
  const dz = Math.cos(a), dx = Math.sin(a);
  if (dz <= 0.02) return 0;
  const yc = 15.6, ys = 3.4;
  const gy = Math.exp(-Math.pow((y - yc) / ys, 2));
  // 双峰：左右各一
  const off = 3.5;                              // 膝心 X 偏移（米）
  const px = dx * PROF_RX(y);
  const gL = Math.exp(-Math.pow((px + off) / 3.9, 2));
  const gR = Math.exp(-Math.pow((px - off) / 3.9, 2));
  return (gL + gR) * gy * dz * 1.20;
}

/* 腿部：膝下小腿向下延伸，裙面在正前方略前凸 */
function shinBulge(u, y) {
  const a = u * TAU;
  const dz = Math.cos(a), dx = Math.sin(a);
  if (dz <= 0.02) return 0;
  const gy = smoothstep(14.5, 11.0, y) * smoothstep(0.5, 4.0, y);
  const px = dx * PROF_RX(y);
  const off = 4.2;
  const gL = Math.exp(-Math.pow((px + off) / 4.6, 2));
  const gR = Math.exp(-Math.pow((px - off) / 4.6, 2));
  return (gL + gR) * gy * dz * 0.42;
}

/* ------------------------------------------------------------
   面部浮雕：鼻/眉弓/眼睑/唇/人中/下巴/颊
   全部按 t8 实测的绝对高度（米）布置，做成曲面起伏而非贴片
   ------------------------------------------------------------ */
function faceRelief(u, y) {
  if (y < 29.7 || y > 33.5) return 0;
  let du = u; while (du > 0.5) du -= 1; while (du < -0.5) du += 1;
  if (Math.abs(du) > 0.30) return 0;
  const a = du * TAU;
  const front = Math.cos(a);
  if (front < 0.20) return 0;
  const ax = Math.abs(Math.sin(a) * PROF_RX(y));
  const fw = smoothstep(0.20, 0.58, front);
  const G = (x, c, w) => Math.exp(-Math.pow((x - c) / w, 2));
  let d = 0;

  /* 鼻梁 → 鼻头（眉间 32.86 → 鼻底 31.28） */
  {
    const gy = smoothstep(32.98, 32.50, y) * smoothstep(31.10, 31.40, y);
    const prof = smoothstep(32.90, 31.45, y);
    const w = lerp(0.19, 0.40, prof);
    d += G(ax, 0, w) * gy * lerp(0.22, 0.68, prof);
    d += G(ax, 0.39, 0.20) * G(y, 31.44, 0.22) * 0.29;   // 鼻翼
  }
  /* 眉弓 */
  d += G(ax, 0.98, 0.70) * G(y, 32.62, 0.25) * 0.145;
  /* 眼窝（凹）+ 眼睑（凸） */
  d -= G(ax, 0.88, 0.56) * G(y, 32.52, 0.30) * 0.115;
  d += G(ax, 0.82, 0.43) * G(y, 32.31, 0.160) * 0.245;
  /* 唇 + 唇下沟 */
  d += G(ax, 0, 0.48) * G(y, 30.84, 0.190) * 0.135;
  d -= G(ax, 0, 0.45) * G(y, 30.50, 0.16) * 0.055;
  /* 人中 */
  d -= G(ax, 0, 0.105) * G(y, 31.10, 0.175) * 0.050;
  /* 下巴 */
  d += G(ax, 0, 0.54) * G(y, 30.34, 0.28) * 0.105;
  /* 颊 */
  d += G(ax, 1.30, 0.64) * G(y, 31.76, 0.62) * 0.120;

  return d * fw;
}

/* ------------------------------------------------------------
   胸腹与肩颈体块：给旋转体加入正面解剖起伏，避免瓶形轮廓。
   ------------------------------------------------------------ */
function anatomyRelief(u, y) {
  let du = u; while (du > 0.5) du -= 1; while (du < -0.5) du += 1;
  const a = du * TAU;
  const front = Math.max(0, Math.cos(a));
  const side = Math.abs(Math.sin(a));
  if (front <= 0.001) return 0;
  const G = (x, c, w) => Math.exp(-Math.pow((x - c) / w, 2));
  const px = Math.sin(a) * PROF_RX(y);
  let d = 0;
  /* 腹部不是直筒，脐上略前凸、腰际收束。 */
  d += G(y, 21.7, 2.35) * Math.pow(front, 1.35) * 0.48;
  d += G(y, 24.7, 2.15) * Math.pow(front, 1.45) * 0.34;
  /* 双侧胸肌与中央胸骨沟。 */
  const chestY = G(y, 26.15, 1.85);
  d += (G(px, -2.35, 2.2) + G(px, 2.35, 2.2)) * chestY * Math.pow(front, 1.15) * 0.46;
  d -= G(px, 0, 0.78) * chestY * Math.pow(front, 1.8) * 0.16;
  /* 锁骨下阴影与肩头圆转。 */
  d -= G(y, 28.02, 0.35) * G(px, 0, 3.8) * Math.pow(front, 1.5) * 0.10;
  d += G(y, 27.35, 0.72) * Math.pow(side, 2.4) * front * 0.18;
  return d;
}

/* ------------------------------------------------------------
   身体表面点：u∈[0,1) 绕轴（0 = 正前 +Z），v∈[0,1] 高度
   ------------------------------------------------------------ */
function bodyPoint(u, v, out) {
  const y = v * BUDDHA_H;
  const a = u * TAU;
  const dx = Math.sin(a), dz = Math.cos(a);
  const rx = PROF_RX(y), rz = PROF_RZ(y), cz = PROF_CZ(y);
  const f = 1 + foldDisp(u, y);
  const kb = kneeBulge(u, y) + shinBulge(u, y);
  const fr = faceRelief(u, y);
  const ar = anatomyRelief(u, y);
  const p = out || new THREE.Vector3();
  p.set(dx * (rx * f + fr), y, dz * (rz * f + fr) + cz + kb + ar);
  return p;
}

/* 数值法线 */
const _bpA = new THREE.Vector3(), _bpB = new THREE.Vector3(), _bpC = new THREE.Vector3();
const _bpU = new THREE.Vector3(), _bpV = new THREE.Vector3();
function bodyNormal(u, v, out) {
  const du = 0.0016, dv = 0.0012;
  bodyPoint(u, v, _bpA);
  bodyPoint(u + du, v, _bpB);
  bodyPoint(u, Math.min(1, v + dv), _bpC);
  _bpU.subVectors(_bpB, _bpA);
  _bpV.subVectors(_bpC, _bpA);
  const n = out || new THREE.Vector3();
  n.crossVectors(_bpU, _bpV).normalize();
  return n;
}

/* ------------------------------------------------------------
   石胎包络：开凿留下的粗岩柱（t52 侧影）
   ------------------------------------------------------------ */
const ENV_RX = makeCurve1D([
  [0.0, 9.72], [5.0, 9.66], [10.0, 9.36], [15.0, 8.85], [19.0, 7.35],
  [21.5, 6.30], [23.8, 5.86], [25.5, 6.20], [27.0, 6.78], [27.8, 5.82],
  [28.5, 3.48], [29.0, 2.28], [29.6, 2.14], [30.4, 2.48], [31.5, 2.68],
  [32.8, 2.72], [33.9, 2.52], [34.7, 2.12], [35.25, 1.42], [35.62, 0.56],
]);
const ENV_RZ = makeCurve1D([
  [0.0, 6.62], [5.0, 6.56], [10.0, 6.30], [15.0, 5.94], [19.0, 5.18],
  [21.5, 4.66], [23.8, 4.38], [25.5, 4.48], [27.0, 4.62], [27.8, 4.12],
  [28.5, 2.74], [29.0, 2.06], [29.6, 2.08], [30.4, 2.44], [31.5, 2.68],
  [32.8, 2.76], [33.9, 2.58], [34.7, 2.18], [35.25, 1.48], [35.62, 0.56],
]);

/* 石胎位置：把任意佛像顶点投影到包络面并加岩石噪声 */
function rockPoint(p, out) {
  const y = clamp(p.y, 0, BUDDHA_H);
  const cz = PROF_CZ(y) * 0.4;
  let dx = p.x, dz = p.z - cz;
  let len = Math.hypot(dx, dz);
  if (len < 1e-5) { dx = 0; dz = 1; len = 1; }
  dx /= len; dz /= len;
  const erx = ENV_RX(y), erz = ENV_RZ(y);
  // 椭圆包络在该方向上的半径
  const denom = Math.sqrt((dx * dx) / (erx * erx) + (dz * dz) / (erz * erz));
  let R = 1 / denom;
  // 岩石凿击噪声（大块 + 细碎）
  const n1 = fbm3(p.x * 0.16, y * 0.16, p.z * 0.16, 4) - 0.5;
  const n2 = fbm3(p.x * 0.55, y * 0.55, p.z * 0.55, 3) - 0.5;
  const n3 = fbm3(p.x * 1.6, y * 1.6, p.z * 1.6, 2) - 0.5;
  /* 石胎保留凿痕，但不能把完整轮廓打散成一团噪声。 */
  R *= 1 + n1 * 0.070 + n2 * 0.030 + n3 * 0.012;
  // 背面并入崖体：向 -Z 拉平
  const back = smoothstep(-0.15, -0.75, dz);
  const o = out || new THREE.Vector3();
  o.set(dx * R, y + (n2 * 0.28), dz * R + cz);
  if (back > 0) o.z = lerp(o.z, -11.2, back * 0.82);
  return o;
}

/* ------------------------------------------------------------
   通用：由 (u,v) 参数域 + 遮罩生成一层曲面
   maskFn(u,v) -> 0..1，>0 才生成；边缘按 mask 收缩贴回下层
   ------------------------------------------------------------ */
function buildLayerGeometry(opts) {
  const {
    uSeg = 176, vSeg = 200,
    v0 = 0, v1 = 1, u0 = 0, u1 = 1,
    mask = null,            // (u,v)->0..1
    offset = 0,             // 沿法线外偏移（米）
    offsetFn = null,        // (u,v)->米，优先于 offset
    uvScale = [1, 1],
    rock = true,            // 是否生成石胎 morph 属性
  } = opts;

  const nu = uSeg + 1, nv = vSeg + 1;
  const pos = new Float32Array(nu * nv * 3);
  const nrm = new Float32Array(nu * nv * 3);
  const uvs = new Float32Array(nu * nv * 2);
  const rpos = rock ? new Float32Array(nu * nv * 3) : null;
  const rnrm = rock ? new Float32Array(nu * nv * 3) : null;
  const maskArr = new Float32Array(nu * nv);

  const P = new THREE.Vector3(), N = new THREE.Vector3(), R = new THREE.Vector3();

  for (let j = 0; j < nv; j++) {
    const v = v0 + (v1 - v0) * (j / vSeg);
    for (let i = 0; i < nu; i++) {
      const uu = u0 + (u1 - u0) * (i / uSeg);
      const u = ((uu % 1) + 1) % 1;
      const idx = j * nu + i;

      bodyPoint(u, v, P);
      bodyNormal(u, v, N);

      let m = mask ? mask(uu, v) : 1;
      maskArr[idx] = m;

      let off = offsetFn ? offsetFn(uu, v) : offset;
      off *= smoothstep(0, 0.62, m);   // 边缘渐薄，避免硬边锯齿

      P.addScaledVector(N, off);

      pos[idx * 3] = P.x; pos[idx * 3 + 1] = P.y; pos[idx * 3 + 2] = P.z;
      nrm[idx * 3] = N.x; nrm[idx * 3 + 1] = N.y; nrm[idx * 3 + 2] = N.z;
      uvs[idx * 2] = uu * TAU * PROF_RX(v * BUDDHA_H) * uvScale[0];
      uvs[idx * 2 + 1] = v * BUDDHA_H * uvScale[1];

      if (rock) {
        rockPoint(P, R);
        rpos[idx * 3] = R.x; rpos[idx * 3 + 1] = R.y; rpos[idx * 3 + 2] = R.z;
      }
    }
  }

  /* 石胎法线（数值差分） */
  if (rock) {
    const gv = (i, j) => {
      const ii = clamp(i, 0, nu - 1), jj = clamp(j, 0, nv - 1);
      const k = (jj * nu + ii) * 3;
      return [rpos[k], rpos[k + 1], rpos[k + 2]];
    };
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = gv(i + 1, j), b = gv(i - 1, j), c = gv(i, j + 1), d = gv(i, j - 1);
        const ux = a[0] - b[0], uy = a[1] - b[1], uz = a[2] - b[2];
        const vx = c[0] - d[0], vy = c[1] - d[1], vz = c[2] - d[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz) || 1;
        const k = (j * nu + i) * 3;
        rnrm[k] = nx / l; rnrm[k + 1] = ny / l; rnrm[k + 2] = nz / l;
      }
    }
  }

  /* 索引：mask 全为 0 的 quad 丢弃 */
  const idxArr = [];
  for (let j = 0; j < vSeg; j++) {
    for (let i = 0; i < uSeg; i++) {
      const a = j * nu + i, b = j * nu + i + 1, c = (j + 1) * nu + i + 1, d = (j + 1) * nu + i;
      if (mask && maskArr[a] <= 0 && maskArr[b] <= 0 && maskArr[c] <= 0 && maskArr[d] <= 0) continue;
      idxArr.push(a, b, d, b, c, d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (rock) {
    g.setAttribute('aRockPos', new THREE.BufferAttribute(rpos, 3));
    g.setAttribute('aRockNrm', new THREE.BufferAttribute(rnrm, 3));
  }
  g.setIndex(idxArr);
  g.computeBoundingSphere();
  return g;
}

/* 把 0..1 的 uv 拉到米制（零件几何用） */
function scaleUV(geo, k) {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k);
  uv.needsUpdate = true;
  return geo;
}

/* 给任意已有几何附加石胎 morph 属性（用于手、脚、头饰等零件） */
function attachRockMorph(geo, shrinkToAxis = 1.0) {
  const p = geo.attributes.position;
  const n = p.count;
  const rp = new Float32Array(n * 3);
  const rn = new Float32Array(n * 3);
  const V = new THREE.Vector3(), R = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    V.fromBufferAttribute(p, i);
    rockPoint(V, R);
    // shrinkToAxis<1 时，零件被更强地吸进包络内部（融进石胎）
    R.x *= shrinkToAxis; R.z = lerp(R.z, R.z * shrinkToAxis, 0.6);
    rp[i * 3] = R.x; rp[i * 3 + 1] = R.y; rp[i * 3 + 2] = R.z;
  }
  // 用包络的近似法线
  for (let i = 0; i < n; i++) {
    const x = rp[i * 3], y = rp[i * 3 + 1], z = rp[i * 3 + 2];
    const l = Math.hypot(x, z) || 1;
    rn[i * 3] = x / l * 0.92; rn[i * 3 + 1] = 0.2; rn[i * 3 + 2] = z / l * 0.92;
  }
  geo.setAttribute('aRockPos', new THREE.BufferAttribute(rp, 3));
  geo.setAttribute('aRockNrm', new THREE.BufferAttribute(rn, 3));
  return geo;
}
