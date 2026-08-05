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
  [-1.0, 11.30],
  [0.00, 11.25],  // 裙摆落地
  [1.60, 11.05],
  [4.00, 10.60],
  [7.00, 10.10],
  [10.00, 9.60],
  [13.00, 9.10],
  [15.50, 8.65],  // 膝高
  [17.50, 7.95],
  [19.50, 7.28],
  [21.50, 6.60],  // 腰
  [23.50, 5.86],
  [25.50, 5.30],
  [27.20, 5.06],  // 胸
  [28.30, 4.94],  // 肩
  [28.72, 4.34],
  [29.05, 2.72],
  [29.40, 1.68],
  [29.85, 1.42],  // 颈
  [30.20, 1.58],
  [30.75, 1.80],  // 下颌
  [31.60, 1.92],
  [32.40, 1.94],  // 脸中（颧）
  [33.30, 1.86],  // 额
  [34.10, 1.70],
  [34.70, 1.44],  // 肉髻起
  [35.10, 1.14],
  [35.42, 0.70],
  [35.60, 0.16],
]);

const PROF_RZ = makeCurve1D([
  [-1.0, 7.30],
  [0.00, 7.25],
  [1.60, 7.10],
  [4.00, 6.90],
  [7.00, 6.70],
  [10.00, 6.50],
  [13.00, 6.30],
  [15.50, 6.10],
  [17.50, 5.75],
  [19.50, 5.25],
  [21.50, 4.80],
  [23.50, 4.42],
  [25.50, 4.36],
  [27.20, 4.20],
  [28.30, 4.12],
  [28.72, 3.80],
  [29.05, 2.62],
  [29.40, 1.82],
  [29.85, 1.56],
  [30.20, 1.80],
  [30.75, 2.06],
  [31.60, 2.20],
  [32.40, 2.24],
  [33.30, 2.18],
  [34.10, 1.98],
  [34.70, 1.66],
  [35.10, 1.30],
  [35.42, 0.78],
  [35.60, 0.18],
]);

/* 截面中心的前后位移：坐姿下身前倾、头略后靠 */
const PROF_CZ = makeCurve1D([
  [0.00, 0.55],
  [6.00, 0.45],
  [13.00, 0.30],
  [17.00, 0.05],
  [21.00, -0.25],
  [25.00, -0.40],
  [28.30, -0.45],
  [29.80, -0.55],
  [31.50, -0.35],
  [33.50, -0.30],
  [35.55, -0.40],
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
    const K = 5.20 * smoothstep(19.5, 6.5, y) + 1.4;       // 越靠下 U 形越深
    const lam = 2.05 + (19.5 - y) * 0.052;                  // 褶距自上而下加大
    const jig = (fbm2(y * 0.13, 3.7, 3, 21) - 0.5) * 0.42;
    const phase = (y + K * front + 0.42 * Math.sin(a * 2.0 + 0.7) + jig) / lam;
    const amp = 0.0262 * smoothstep(19.5, 15.0, y) * smoothstep(0.0, 2.6, y)
              * (0.80 + 0.34 * fbm2(y * 0.19, 1.3, 3, 7));
    // 尖底的褶形（|sin| 加权），比纯正弦更像布料堆叠
    const frontW = 0.30 + 0.70 * smoothstep(-0.35, 0.72, front);
    const sv = Math.sin(phase * TAU);
    d += (sv * 0.68 + Math.sign(sv) * Math.pow(Math.abs(sv), 2.2) * 0.32) * amp * frontW;

    /* 次级细褶：同样是水平走向 */
    d += Math.sin(((y + K * 0.62 * front) / (lam * 0.42)) * TAU) * 0.0052
       * smoothstep(19.0, 14.0, y) * smoothstep(1.2, 4.5, y);

    /* 侧面的竖向瀑布褶（幅度小，只出现在正侧方） */
    const sideOnly = Math.pow(side, 2.2) * smoothstep(0.55, -0.2, front);
    d += Math.sin(a * 8.0 + y * 0.09 + fbm2(a * 1.1, y * 0.05, 2, 5) * 2.0) * 0.020 * sideOnly
       * smoothstep(0.8, 5.0, y) * smoothstep(19.5, 12.0, y);
    d += Math.sin(a * 15.0 - y * 0.14) * 0.009 * sideOnly * smoothstep(1.5, 6.0, y) * smoothstep(19.0, 11.0, y);

    /* 裙摆落地处外撇 */
    d += smoothstep(3.4, 0.0, y) * 0.042;
  }

  if (y >= 17.0 && y < 29.6) {
    /* 上身袈裟褶：右肩(-X)垂下的大 U 褶 + 胸前斜披的层叠 */
    const t = smoothstep(17.0, 20.0, y) * smoothstep(29.6, 27.0, y);
    d += Math.sin((y / 1.55 + front * 0.5) * TAU) * 0.020 * t;
    d += Math.sin(a * 7.0 + y * 0.4) * 0.012 * t;
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
  return (gL + gR) * gy * dz * 1.55;
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
  return (gL + gR) * gy * dz * 0.55;
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
    d += G(ax, 0, w) * gy * lerp(0.13, 0.40, prof);
    d += G(ax, 0.37, 0.19) * G(y, 31.44, 0.21) * 0.17;   // 鼻翼
  }
  /* 眉弓 */
  d += G(ax, 0.98, 0.70) * G(y, 32.62, 0.25) * 0.095;
  /* 眼窝（凹）+ 眼睑（凸） */
  d -= G(ax, 0.88, 0.56) * G(y, 32.52, 0.30) * 0.080;
  d += G(ax, 0.78, 0.40) * G(y, 32.30, 0.150) * 0.150;
  /* 唇 + 唇下沟 */
  d += G(ax, 0, 0.45) * G(y, 30.84, 0.195) * 0.105;
  d -= G(ax, 0, 0.45) * G(y, 30.50, 0.16) * 0.038;
  /* 人中 */
  d -= G(ax, 0, 0.105) * G(y, 31.10, 0.175) * 0.036;
  /* 下巴 */
  d += G(ax, 0, 0.54) * G(y, 30.34, 0.28) * 0.058;
  /* 颊 */
  d += G(ax, 1.24, 0.55) * G(y, 31.78, 0.55) * 0.050;

  return d * fw;
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
  const p = out || new THREE.Vector3();
  p.set(dx * (rx * f + fr), y, dz * (rz * f + fr) + cz + kb);
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
  [0.0, 12.3], [4.0, 12.1], [9.0, 11.6], [13.0, 11.0], [16.2, 10.55],  // 膝
  [18.4, 9.85], [20.2, 8.55], [22.2, 7.25], [24.2, 6.35], [26.0, 5.90],
  [27.2, 6.05], [28.5, 5.80],                                          // 肩（略外扩）
  [29.2, 4.30], [29.9, 2.95],  // 颈（明显收束）
  [30.5, 2.70], [31.4, 2.72], [32.6, 2.70], [33.6, 2.60],             // 头
  [34.6, 2.25], [35.2, 1.55], [35.62, 0.70],
]);
const ENV_RZ = makeCurve1D([
  [0.0, 8.3], [4.0, 8.2], [9.0, 7.9], [13.0, 7.6], [16.2, 7.40],
  [18.4, 6.95], [20.2, 6.20], [22.2, 5.55], [24.2, 4.95], [26.0, 4.60],
  [27.2, 4.72], [28.5, 4.45],
  [29.2, 3.55], [29.9, 2.85],
  [30.5, 2.70], [31.4, 2.80], [32.6, 2.80], [33.6, 2.68],
  [34.6, 2.30], [35.2, 1.58], [35.62, 0.72],
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
  R *= 1 + n1 * 0.235 + n2 * 0.105 + n3 * 0.055;
  // 背面并入崖体：向 -Z 拉平
  const back = smoothstep(-0.15, -0.75, dz);
  const o = out || new THREE.Vector3();
  o.set(dx * R, y + (n2 * 0.9), dz * R + cz);
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
