/* ============================================================
   10 - 程序化纹理（全部用 Canvas 生成，无外部资源）
   ============================================================ */

const TEX = {};           // 纹理缓存
const _texCanvases = {};  // 调试用

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/* 由灰度高度图生成法线贴图 */
function normalFromHeight(heights, size, strength = 2.0) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const at = (x, y) => heights[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx, ny = -dy, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = (nz * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/* 通用烘焙：fn(u,v) -> [r,g,b,height01] */
function bake(size, fn) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = fn(x / size, y / size, x, y);
      const i = (y * size + x) * 4;
      d[i] = r[0]; d[i + 1] = r[1]; d[i + 2] = r[2]; d[i + 3] = 255;
      heights[y * size + x] = r[3] !== undefined ? r[3] : (0.299 * r[0] + 0.587 * r[1] + 0.114 * r[2]) / 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { canvas: c, heights, size };
}

function toTex(canvas, repeat = 1, aniso = 8) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
function toDataTex(canvas, repeat = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;   // 线性空间（法线/粗糙度）
}

/* ------------------------------------------------------------
   崖壁砂岩 —— 暖土黄 + 灰紫矿物斑 + 水平层理
   ------------------------------------------------------------ */
function buildSandstone(size = 512) {
  const baseA = [0xA2, 0x77, 0x48];   // 暗
  const baseB = [0xEE, 0xCE, 0x9E];   // 亮
  const mineral = [0x9A, 0x94, 0x9C]; // 灰紫矿物
  const dark = [0x93, 0x70, 0x46];

  const r = bake(size, (u, v) => {
    // 层理（水平沉积带）
    const bed = fbm2(u * 2.2, v * 17.0, 4, 3.1);
    // 大块明暗
    const macro = fbm2(u * 4.2, v * 3.8, 5, 11.7);
    // 竖向风蚀条纹（崖壁的主要肌理）
    const streak = ridge2(u * 34.0, v * 1.8, 4, 6.2);
    // 细颗粒
    const grain = fbm2(u * 120, v * 120, 3, 5.3);

    let t = clamp(macro * 0.30 + bed * 0.24 + streak * 0.28 + grain * 0.18, 0, 1);
    t = Math.pow(t, 0.94);
    let col = [
      lerp(baseA[0], baseB[0], t),
      lerp(baseA[1], baseB[1], t),
      lerp(baseA[2], baseB[2], t),
    ];
    // 灰紫矿物斑（柔和、低频、低对比）
    const ms = smoothstep(0.58, 0.86, fbm2(u * 5.2, v * 4.8, 4, 41)) * 0.42;
    col = [lerp(col[0], mineral[0], ms), lerp(col[1], mineral[1], ms), lerp(col[2], mineral[2], ms)];
    // 稀疏的水平岩缝（只在少数层出现）
    const seamBand = smoothstep(0.80, 0.94, fbm2(u * 1.6, v * 9.0, 3, 71));
    const seam = seamBand * smoothstep(0.40, 0.82, fbm2(u * 9, v * 40, 3, 13)) * 0.52;
    col = [lerp(col[0], dark[0], seam), lerp(col[1], dark[1], seam), lerp(col[2], dark[2], seam)];

    const h = clamp(macro * 0.24 + bed * 0.18 + streak * 0.40 + grain * 0.18 - seam * 0.5, 0, 1);
    return [col[0], col[1], col[2], h];
  });
  return { map: toTex(r.canvas), normal: toDataTex(normalFromHeight(r.heights, size, 2.6)), raw: r };
}

/* ------------------------------------------------------------
   洞窟内壁 —— 开凿出的平滑土棕面
   ------------------------------------------------------------ */
function buildCaveWall(size = 512) {
  const a = [0x8E, 0x68, 0x44], b = [0xB2, 0x8B, 0x60];
  const r = bake(size, (u, v) => {
    const macro = fbm2(u * 4.0, v * 4.0, 4, 7.7);
    const chisel = ridge2(u * 13, v * 30, 3, 2.2);     // 凿痕
    const grain = fbm2(u * 120, v * 120, 2, 9.1);
    let t = clamp(macro * 0.7 + grain * 0.2 + chisel * 0.18, 0, 1);
    const col = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    const h = clamp(macro * 0.35 + chisel * 0.45 + grain * 0.2, 0, 1);
    return [col[0], col[1], col[2], h];
  });
  return { map: toTex(r.canvas), normal: toDataTex(normalFromHeight(r.heights, size, 1.5)) };
}

/* ------------------------------------------------------------
   石胎岩石 —— 黄褐砂岩 + 明显灰斑与凿面
   ------------------------------------------------------------ */
function buildRockCore(size = 512) {
  const a = [0x98, 0x79, 0x55], b = [0xD5, 0xB8, 0x89];
  const gy = [0x82, 0x81, 0x7E], ochre = [0xA3, 0x73, 0x45];
  const r = bake(size, (u, v) => {
    const macro = fbm2(u * 5.0, v * 5.0, 5, 23.3);
    const bed = fbm2(u * 2.3, v * 17.0, 4, 46.1);
    const chunk = worley2(u * 9, v * 9, 5);
    const facet = smoothstep(0.5, 0.02, chunk.f2 - chunk.f1);  // 凿击面
    const grain = fbm2(u * 118, v * 118, 3, 3.3);
    const pores = worley2(u * 43, v * 43, 91);
    const pit = smoothstep(0.085, 0.018, pores.f1)
      * smoothstep(0.60, 0.92, fbm2(u * 23, v * 23, 2, 18.2));
    let t = clamp(macro * 0.54 + bed * 0.18 + grain * 0.21 + facet * 0.07, 0, 1);
    let col = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    const gm = smoothstep(0.58, 0.86, fbm2(u * 3.4, v * 3.4, 4, 61)) * 0.56;
    col = [lerp(col[0], gy[0], gm), lerp(col[1], gy[1], gm), lerp(col[2], gy[2], gm)];
    const om = smoothstep(0.67, 0.90, fbm2(u * 8.0, v * 7.0, 3, 74.4)) * 0.24;
    col = [lerp(col[0], ochre[0], om), lerp(col[1], ochre[1], om), lerp(col[2], ochre[2], om)];
    col = [lerp(col[0], 0x63, pit * 0.44), lerp(col[1], 0x59, pit * 0.44), lerp(col[2], 0x48, pit * 0.44)];
    const h = clamp(macro * 0.32 + bed * 0.17 + facet * 0.25 + grain * 0.24 + 0.08 - pit * 0.34, 0, 1);
    return [col[0], col[1], col[2], h];
  });
  return { map: toTex(r.canvas), normal: toDataTex(normalFromHeight(r.heights, size, 2.65)) };
}

/* ------------------------------------------------------------
   粗泥（龟裂）—— 视频 63-66s：普通泥土开裂
   ------------------------------------------------------------ */
function buildCrackedMud(size = 512) {
  const a = [0x9C, 0x8E, 0x74], b = [0xC5, 0xB6, 0x96], ck = [0x4A, 0x40, 0x33];
  const r = bake(size, (u, v) => {
    const macro = fbm2(u * 4, v * 4, 4, 13.1);
    const grain = fbm2(u * 70, v * 70, 3, 2.2);
    // 两级龟裂
    const w1 = worley2(u * 7 + fbm2(u * 3, v * 3, 2, 1) * 0.6, v * 7, 31);
    const w2 = worley2(u * 16 + fbm2(u * 5, v * 5, 2, 4) * 0.5, v * 16, 47);
    const c1 = smoothstep(0.075, 0.0, w1.f2 - w1.f1);
    const c2 = smoothstep(0.05, 0.0, w2.f2 - w2.f1) * 0.6;
    const crack = clamp(c1 + c2, 0, 1);
    let t = clamp(macro * 0.7 + grain * 0.3, 0, 1);
    let col = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    col = [lerp(col[0], ck[0], crack), lerp(col[1], ck[1], crack), lerp(col[2], ck[2], crack)];
    const h = clamp(macro * 0.4 + grain * 0.25 + 0.35 - crack * 0.75, 0, 1);
    return [col[0], col[1], col[2], h];
  });
  return { map: toTex(r.canvas), normal: toDataTex(normalFromHeight(r.heights, size, 3.4)) };
}

/* ------------------------------------------------------------
   泥层（粗 / 中 / 细）—— 颗粒随层级变细
   ------------------------------------------------------------ */
function buildMud(size, tint, grainScale, roughAmp) {
  const a = tint.a, b = tint.b;
  const r = bake(size, (u, v) => {
    const macro = fbm2(u * 5, v * 5, 4, 17.7);
    const grain = fbm2(u * grainScale, v * grainScale, 3, 8.8);
    const sweep = ridge2(u * 3.0 + fbm2(u * 2, v * 2, 2, 39.2) * 0.28, v * 22.0, 3, 26.4);
    const flake = worley2(u * grainScale * 0.35, v * grainScale * 0.35, 12);
    const fl = smoothstep(0.35, 0.0, flake.f1) * 0.25;
    const pores = worley2(u * grainScale * 0.62, v * grainScale * 0.62, 113);
    const pore = smoothstep(0.10, 0.015, pores.f1) * (0.20 + roughAmp * 0.18);
    let t = clamp(macro * 0.43 + grain * 0.40 + sweep * 0.10 + fl * 0.32, 0, 1);
    let col = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    const cool = (fbm2(u * 9.0, v * 8.0, 3, 64.8) - 0.5) * (2.5 + roughAmp * 3.5);
    col = [col[0] + cool * 0.45, col[1] + cool * 0.62, col[2] + cool];
    const h = clamp(0.5 + (grain - 0.5) * roughAmp * 0.72
      + (macro - 0.5) * 0.28 + (sweep - 0.5) * 0.10 - pore, 0, 1);
    return [col[0], col[1], col[2], h];
  });
  return { map: toTex(r.canvas), normal: toDataTex(normalFromHeight(r.heights, size, 1.55 + roughAmp * 0.72)) };
}

/* ------------------------------------------------------------
   袈裟：赭红，带细小深褐斑点（视频里泥塑表面的杂质）
   ------------------------------------------------------------ */
function buildRobeRed(size = 512) {
  const a = [0x8B, 0x54, 0x49], b = [0xB6, 0x7B, 0x67], dust = [0xB8, 0x94, 0x79];
  const r = bake(size, (u, v) => {
    const macro = fbm2(u * 4, v * 4, 4, 3.9);
    const grain = fbm2(u * 66, v * 66, 3, 6.1);
    const warp = Math.sin((u * 118.0 + fbm2(u * 9, v * 9, 2, 48.2) * 0.65) * TAU);
    const weft = Math.sin((v * 92.0 + fbm2(u * 8, v * 8, 2, 12.6) * 0.58) * TAU);
    const weave = warp * 0.54 + weft * 0.46;
    let t = clamp(macro * 0.58 + grain * 0.30 + weave * 0.035 + 0.06, 0, 1);
    let col = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    // 矿物颜料的褪色与泥尘，不用高对比黑点破坏布面连续性。
    const wear = smoothstep(0.58, 0.86, fbm2(u * 7.0, v * 6.0, 4, 81.4)) * 0.34;
    col = [lerp(col[0], dust[0], wear), lerp(col[1], dust[1], wear), lerp(col[2], dust[2], wear)];
    const sp = worley2(u * 34, v * 34, 77);
    const s = smoothstep(0.105, 0.018, sp.f1)
      * smoothstep(0.62, 0.92, fbm2(u * 20, v * 20, 2, 55)) * 0.46;
    col = [lerp(col[0], 0x61, s), lerp(col[1], 0x40, s), lerp(col[2], 0x34, s)];
    const h = clamp(0.5 + (grain - 0.5) * 0.19 + weave * 0.055
      + (macro - 0.5) * 0.07 - s * 0.11, 0, 1);
    return [col[0], col[1], col[2], h];
  });
  return { map: toTex(r.canvas), normal: toDataTex(normalFromHeight(r.heights, size, 1.75)) };
}

/* ------------------------------------------------------------
   内衣：孔雀蓝 + 深蓝团花圆点（参考 t96 左肩）
   ------------------------------------------------------------ */
function buildInnerBlue(size = 512) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  g.fillStyle = '#5D8996'; g.fillRect(0, 0, size, size);
  // 底纹
  const img = g.getImageData(0, 0, size, size); const d = img.data;
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const n = fbm2(u * 42, v * 42, 3, 2.1);
    const m = fbm2(u * 5.2, v * 4.6, 4, 33.7);
    const wear = smoothstep(0.62, 0.88, fbm2(u * 10, v * 9, 3, 71.2));
    const warp = Math.sin((x / 3.7 + fbm2(u * 8, v * 8, 2, 14.3) * 0.55) * TAU);
    const weft = Math.sin((y / 4.2 + fbm2(u * 7, v * 7, 2, 25.9) * 0.48) * TAU);
    const i = (y * size + x) * 4;
    d[i] = clamp(d[i] + (n - 0.5) * 17 + (m - 0.5) * 12 + wear * 12, 0, 255);
    d[i + 1] = clamp(d[i + 1] + (n - 0.5) * 20 + (m - 0.5) * 10 + wear * 8, 0, 255);
    d[i + 2] = clamp(d[i + 2] + (n - 0.5) * 22 + (m - 0.5) * 7 - wear * 2, 0, 255);
    heights[y * size + x] = clamp(0.5 + (n - 0.5) * 0.11
      + (m - 0.5) * 0.045 + warp * 0.026 + weft * 0.023, 0, 1);
  }
  g.putImageData(img, 0, 0);
  // 深蓝团花：中心圆 + 5 瓣
  const rnd = mulberry32(7);
  g.fillStyle = 'rgba(39,72,88,0.58)';
  const step = size / 3;
  for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 3; gx++) {
    const cx = gx * step + step * 0.5 + (rnd() - 0.5) * step * 0.18;
    const cy = gy * step + step * 0.5 + (rnd() - 0.5) * step * 0.18;
    const R = step * 0.115;
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    for (let k = 0; k < 5; k++) {
      const an = (k / 5) * TAU + rnd() * 0.4;
      g.beginPath();
      g.arc(cx + Math.cos(an) * R * 2.05, cy + Math.sin(an) * R * 2.05, R * 0.82, 0, TAU);
      g.fill();
    }
  }
  // 低透明尘斑压过纹样，表现彩绘磨蚀而非新印花。
  g.fillStyle = 'rgba(164,151,126,0.11)';
  for (let i = 0; i < 72; i++) {
    const x = rnd() * size, y = rnd() * size;
    const rx = size * (0.005 + rnd() * 0.023);
    g.beginPath(); g.ellipse(x, y, rx, rx * (0.25 + rnd() * 0.65), rnd() * TAU, 0, TAU); g.fill();
  }
  return { map: toTex(c), normal: toDataTex(normalFromHeight(heights, size, 1.55)) };
}

/* ------------------------------------------------------------
   斜披（僧祇支）：土黄底 + 绿松石菱形连环纹
   ------------------------------------------------------------ */
function buildSash(size = 512) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  g.fillStyle = '#B69A6C'; g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size); const d = img.data;
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const n = fbm2(u * 36, v * 36, 3, 9.3);
    const m = fbm2(u * 5.4, v * 4.8, 4, 57.8);
    const wear = smoothstep(0.60, 0.87, fbm2(u * 11, v * 8, 3, 21.4));
    const warp = Math.sin((x / 3.5 + fbm2(u * 7, v * 7, 2, 36.8) * 0.50) * TAU);
    const weft = Math.sin((y / 4.0 + fbm2(u * 8, v * 8, 2, 44.1) * 0.45) * TAU);
    const i = (y * size + x) * 4;
    d[i] = clamp(d[i] + (n - 0.5) * 20 + (m - 0.5) * 15 + wear * 8, 0, 255);
    d[i + 1] = clamp(d[i + 1] + (n - 0.5) * 18 + (m - 0.5) * 10 + wear * 5, 0, 255);
    d[i + 2] = clamp(d[i + 2] + (n - 0.5) * 13 + (m - 0.5) * 6 - wear * 2, 0, 255);
    heights[y * size + x] = clamp(0.5 + (n - 0.5) * 0.10
      + (m - 0.5) * 0.045 + warp * 0.027 + weft * 0.024, 0, 1);
  }
  g.putImageData(img, 0, 0);
  // 连环菱格
  g.strokeStyle = 'rgba(63,126,117,0.78)'; g.lineWidth = size * 0.0062; g.lineCap = 'round';
  const N = 5, s = size / N;
  for (let gy = -1; gy <= N; gy++) for (let gx = -1; gx <= N; gx++) {
    const cx = gx * s + s * 0.5, cy = gy * s + s * 0.5;
    // 菱形
    g.beginPath();
    g.moveTo(cx, cy - s * 0.42); g.lineTo(cx + s * 0.42, cy);
    g.lineTo(cx, cy + s * 0.42); g.lineTo(cx - s * 0.42, cy);
    g.closePath(); g.stroke();
    // 内小菱
    g.beginPath();
    g.moveTo(cx, cy - s * 0.2); g.lineTo(cx + s * 0.2, cy);
    g.lineTo(cx, cy + s * 0.2); g.lineTo(cx - s * 0.2, cy);
    g.closePath(); g.stroke();
    // 连接钩
    g.beginPath(); g.arc(cx + s * 0.5, cy, s * 0.16, -0.9, 0.9); g.stroke();
  }
  const rnd = mulberry32(29);
  g.fillStyle = 'rgba(181,157,113,0.20)';
  for (let i = 0; i < 96; i++) {
    const x = rnd() * size, y = rnd() * size;
    const rx = size * (0.004 + rnd() * 0.018);
    g.beginPath(); g.ellipse(x, y, rx, rx * (0.24 + rnd() * 0.72), rnd() * TAU, 0, TAU); g.fill();
  }
  return { map: toTex(c), normal: toDataTex(normalFromHeight(heights, size, 1.58)) };
}

/* ------------------------------------------------------------
   皮肤（肉色，细腻微颗粒）
   ------------------------------------------------------------ */
function buildSkin(size = 256) {
  const r = bake(size, (u, v) => {
    const n = fbm2(u * 62, v * 62, 3, 12.2);
    const m = fbm2(u * 6, v * 6, 4, 31.7);
    const bloom = fbm2(u * 13, v * 11, 3, 74.1);
    const poreCell = worley2(u * 74, v * 74, 129);
    const pore = smoothstep(0.055, 0.012, poreCell.f1)
      * smoothstep(0.70, 0.94, fbm2(u * 31, v * 31, 2, 52.6));
    const t = clamp(n * 0.25 + m * 0.66 + bloom * 0.09, 0, 1);
    let col = [lerp(0xCE, 0xE9, t), lerp(0xAE, 0xD0, t), lerp(0x91, 0xAF, t)];
    const rosy = smoothstep(0.64, 0.88, bloom) * 0.12;
    col = [lerp(col[0], 0xD8, rosy), lerp(col[1], 0xA0, rosy), lerp(col[2], 0x8D, rosy)];
    col = [lerp(col[0], 0x9C, pore * 0.30), lerp(col[1], 0x83, pore * 0.30), lerp(col[2], 0x70, pore * 0.30)];
    const h = clamp(0.5 + (n - 0.5) * 0.20 + (m - 0.5) * 0.055 - pore * 0.13, 0, 1);
    return [col[0], col[1], col[2], h];
  });
  return { map: toTex(r.canvas), normal: toDataTex(normalFromHeight(r.heights, size, 0.92)) };
}

/* ------------------------------------------------------------
   头光：多层同心团花（带 alpha）—— 参考 t8
   ------------------------------------------------------------ */
function buildHalo(size = 1024) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  g.clearRect(0, 0, size, size);
  const cx = size / 2, cy = size / 2, R = size / 2;

  // 环带定义： [r0, r1, 底色]
  const bands = [
    [0.34, 0.50, '#8FD5C9'],
    [0.50, 0.53, '#2E9B86'],
    [0.53, 0.71, '#A8DED2'],
    [0.71, 0.74, '#2E9B86'],
    [0.74, 0.905, '#8FD5C9'],
    [0.905, 0.955, '#C2553F'],
    [0.955, 1.00, '#7FCBBD'],
  ];
  for (const [r0, r1, col] of bands) {
    g.beginPath();
    g.arc(cx, cy, R * r1, 0, TAU);
    g.arc(cx, cy, R * r0, 0, TAU, true);
    g.fillStyle = col; g.fill('evenodd');
  }

  // 团花：在两条宽环带上环形排布
  function rosette(x, y, rad, petalCol, coreCol) {
    g.fillStyle = petalCol;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * rad * 0.55, y + Math.sin(a) * rad * 0.55,
        rad * 0.42, rad * 0.26, a, 0, TAU);
      g.fill();
    }
    g.beginPath(); g.arc(x, y, rad * 0.34, 0, TAU); g.fillStyle = coreCol; g.fill();
    g.beginPath(); g.arc(x, y, rad * 0.15, 0, TAU); g.fillStyle = '#F2E6C8'; g.fill();
  }
  const rings = [
    { r: 0.620, n: 22, rad: 0.070, p: '#2E9B86', c: '#C2553F' },
    { r: 0.825, n: 28, rad: 0.066, p: '#3AA890', c: '#B94E3A' },
    { r: 0.435, n: 16, rad: 0.054, p: '#2E9B86', c: '#C2553F' },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * TAU;
      rosette(cx + Math.cos(a) * R * ring.r, cy + Math.sin(a) * R * ring.r, R * ring.rad, ring.p, ring.c);
    }
  }
  // 中心留空（佛头位置）
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.arc(cx, cy, R * 0.360, 0, TAU); g.fill();
  g.globalCompositeOperation = 'source-over';

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return { map: t };
}

/* 头光顶部的火焰宝珠华盖（参考 t8 顶部红色装饰） */
function buildHaloCrown(w = 640, h = 220) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.clearRect(0, 0, w, h);
  const cx = w * 0.5;
  /* 外层宝盖弧 */
  const arc = (rx, ry, col) => {
    g.beginPath();
    g.moveTo(cx - rx, h * 0.98);
    g.quadraticCurveTo(cx, h * 0.98 - ry * 2.0, cx + rx, h * 0.98);
    g.closePath();
    g.fillStyle = col; g.fill();
  };
  arc(w * 0.47, h * 0.86, '#B84B33');
  arc(w * 0.40, h * 0.74, '#8E3324');
  arc(w * 0.31, h * 0.60, '#C6603F');
  /* 卷草纹 */
  g.strokeStyle = '#37302A'; g.lineWidth = h * 0.024; g.lineCap = 'round';
  for (let i = 0; i < 11; i++) {
    const t = i / 10;
    const x = cx + (t - 0.5) * w * 0.84;
    const yTop = h * 0.98 - Math.sin(t * Math.PI) * h * 0.70;
    g.beginPath();
    g.moveTo(x, h * 0.96);
    g.quadraticCurveTo(x + (t - 0.5) * w * 0.10, (yTop + h) * 0.5, x + (t - 0.5) * w * 0.16, yTop + h * 0.06);
    g.stroke();
  }
  /* 绿松石团点 */
  g.fillStyle = '#43C0A8';
  for (let i = 0; i < 13; i++) {
    const t = i / 12;
    const x = cx + (t - 0.5) * w * 0.80;
    const y = h * 0.94 - Math.sin(t * Math.PI) * h * 0.56;
    g.beginPath(); g.arc(x, y, h * 0.042, 0, TAU); g.fill();
  }
  /* 中央火焰宝珠 */
  const by = h * 0.20;
  g.beginPath();
  g.moveTo(cx, by - h * 0.16);
  g.quadraticCurveTo(cx + h * 0.14, by + h * 0.06, cx, by + h * 0.20);
  g.quadraticCurveTo(cx - h * 0.14, by + h * 0.06, cx, by - h * 0.16);
  g.fillStyle = '#D9A93C'; g.fill();
  g.beginPath(); g.arc(cx, by + h * 0.05, h * 0.075, 0, TAU);
  g.fillStyle = '#F3E3AE'; g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { map: t };
}

/* ------------------------------------------------------------
   地面石板（参考 t17 广场）
   ------------------------------------------------------------ */
function buildGroundStone(size = 512) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  g.fillStyle = '#8C8F92'; g.fillRect(0, 0, size, size);
  const rows = 16, cols = 4;
  const rnd = mulberry32(11);
  for (let r = 0; r < rows; r++) {
    for (let cc = 0; cc < cols; cc++) {
      const x = cc * (size / cols), y = r * (size / rows);
      const v = 0.86 + rnd() * 0.26;
      g.fillStyle = `rgb(${(0x92 * v) | 0},${(0x95 * v) | 0},${(0x99 * v) | 0})`;
      g.fillRect(x + 1.5, y + 1.5, size / cols - 3, size / rows - 3);
    }
  }
  // 颗粒
  const img = g.getImageData(0, 0, size, size); const d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = (fbm2(x / size * 80, y / size * 80, 3, 21) - 0.5) * 22;
    const i = (y * size + x) * 4;
    d[i] = clamp(d[i] + n, 0, 255); d[i + 1] = clamp(d[i + 1] + n, 0, 255); d[i + 2] = clamp(d[i + 2] + n, 0, 255);
  }
  g.putImageData(img, 0, 0);
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const inX = (x % (size / cols)), inY = (y % (size / rows));
    const edge = (inX < 2 || inX > size / cols - 3 || inY < 2 || inY > size / rows - 3) ? 0.2 : 0.8;
    heights[y * size + x] = edge;
  }
  return { map: toTex(c, 1), normal: toDataTex(normalFromHeight(heights, size, 1.4)) };
}

/* ------------------------------------------------------------
   壁画（洞窟四壁，参考 t107）—— 千佛 + 飞天 + 卷草边饰
   ------------------------------------------------------------ */
function buildMural(w = 1024, h = 1024) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#7D8768'; g.fillRect(0, 0, w, h);
  const img = g.getImageData(0, 0, w, h); const d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = fbm2(x / w * 7, y / h * 7, 5, 3.3);
    const n2 = fbm2(x / w * 48, y / h * 48, 3, 8.1);
    const i = (y * w + x) * 4;
    const k = (n - 0.5) * 46 + (n2 - 0.5) * 14;
    d[i] = clamp(d[i] + k * 1.15, 0, 255);
    d[i + 1] = clamp(d[i + 1] + k, 0, 255);
    d[i + 2] = clamp(d[i + 2] + k * 0.75, 0, 255);
  }
  g.putImageData(img, 0, 0);

  const rnd = mulberry32(23);
  /* 上下卷草边饰 */
  function border(y0, hh) {
    g.fillStyle = '#8A3E2E'; g.fillRect(0, y0, w, hh);
    g.strokeStyle = '#D6C489'; g.lineWidth = hh * 0.10;
    for (let i = 0; i < 40; i++) {
      const x = (i / 40) * w;
      g.beginPath();
      g.moveTo(x, y0 + hh * 0.82);
      g.quadraticCurveTo(x + w / 80, y0 + hh * 0.12, x + w / 40, y0 + hh * 0.82);
      g.stroke();
    }
    g.fillStyle = '#3FA890';
    for (let i = 0; i < 20; i++) {
      g.beginPath(); g.arc((i + 0.5) / 20 * w, y0 + hh * 0.5, hh * 0.14, 0, TAU); g.fill();
    }
  }
  border(0, h * 0.042);
  border(h * 0.958, h * 0.042);

  /* 千佛：小而密（14 x 12） */
  const cols = 14, rows = 12;
  const cw = w / cols, ch = (h * 0.70) / rows, y0 = h * 0.245;
  const bodyCols = ['#A85A3C', '#7B5340', '#4E6B7A', '#6E7A4E'];
  const haloCols = ['#5C7F6C', '#7A5A48', '#4E6E80', '#8A6A46'];
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < cols; i++) {
      const cx = i * cw + cw / 2, cy = y0 + r * ch + ch / 2;
      const sz = Math.min(cw, ch) * 0.40;
      g.beginPath(); g.arc(cx, cy - sz * 0.18, sz * 0.98, 0, TAU);
      g.fillStyle = haloCols[(r * 3 + i) % 4]; g.fill();
      g.beginPath(); g.arc(cx, cy - sz * 0.18, sz * 0.80, 0, TAU);
      g.strokeStyle = 'rgba(230,210,160,0.55)'; g.lineWidth = sz * 0.07; g.stroke();
      g.beginPath();
      g.moveTo(cx - sz * 0.66, cy + sz * 0.88);
      g.quadraticCurveTo(cx, cy + sz * 0.10, cx + sz * 0.66, cy + sz * 0.88);
      g.closePath();
      g.fillStyle = bodyCols[(r + i * 2) % 4]; g.fill();
      g.beginPath(); g.arc(cx, cy - sz * 0.36, sz * 0.27, 0, TAU);
      g.fillStyle = '#E7CCA5'; g.fill();
      g.beginPath(); g.arc(cx, cy - sz * 0.45, sz * 0.24, Math.PI, TAU);
      g.fillStyle = '#312F2B'; g.fill();
    }
  }

  /* 上方飞天带 */
  for (let i = 0; i < 8; i++) {
    const cx = (i + 0.5) * (w / 8) + (rnd() - 0.5) * 30;
    const cy = h * 0.135 + (rnd() - 0.5) * 26;
    const sz = w * 0.030;
    g.save(); g.translate(cx, cy); g.rotate((rnd() - 0.5) * 0.55);
    g.fillStyle = '#CFA845';
    g.beginPath(); g.ellipse(0, 0, sz * 1.1, sz * 0.40, 0, 0, TAU); g.fill();
    g.beginPath(); g.arc(-sz * 0.88, -sz * 0.18, sz * 0.25, 0, TAU); g.fillStyle = '#E8D0A8'; g.fill();
    g.strokeStyle = '#C0654A'; g.lineWidth = sz * 0.13;
    g.beginPath(); g.moveTo(sz * 0.6, -sz * 0.1);
    g.quadraticCurveTo(sz * 2.0, -sz * 1.1, sz * 3.4, -sz * 0.25); g.stroke();
    g.restore();
  }

  /* 做旧剥落 */
  g.globalAlpha = 0.45;
  for (let i = 0; i < 420; i++) {
    const x = rnd() * w, y = rnd() * h, sz = rnd() * 18 + 3;
    g.fillStyle = rnd() > 0.5 ? 'rgba(152,142,118,0.5)' : 'rgba(74,66,54,0.38)';
    g.beginPath(); g.ellipse(x, y, sz, sz * (0.4 + rnd() * 0.8), rnd() * 3, 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
  return { map: toTex(c) };
}

/* 白粉底（上壁画之前的一层） */
function buildWhitewash(size = 256) {
  const r = bake(size, (u, v) => {
    const n = fbm2(u * 30, v * 30, 4, 6.6);
    const m = fbm2(u * 5, v * 5, 3, 15.1);
    const t = clamp(n * 0.35 + m * 0.65, 0, 1);
    return [lerp(0xD8, 0xF2, t), lerp(0xD0, 0xEC, t), lerp(0xBE, 0xDC, t), t];
  });
  return { map: toTex(r.canvas), normal: toDataTex(normalFromHeight(r.heights, size, 0.8)) };
}

/* 天空：青绿渐变 + 卷云 */
function buildSky(w = 1024, h = 512) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.00, '#1E8FA6');
  grad.addColorStop(0.35, '#37AFC0');
  grad.addColorStop(0.62, '#63C8D0');
  grad.addColorStop(0.82, '#9BDCDC');
  grad.addColorStop(1.00, '#CFE7DF');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  const img = g.getImageData(0, 0, w, h); const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      let cl = fbm2(u * 7, v * 13, 6, 2.9);
      cl = smoothstep(0.50, 0.86, cl) * smoothstep(0.02, 0.35, v) * smoothstep(0.95, 0.55, v);
      const i = (y * w + x) * 4;
      d[i] = lerp(d[i], 250, cl * 0.85);
      d[i + 1] = lerp(d[i + 1], 252, cl * 0.85);
      d[i + 2] = lerp(d[i + 2], 250, cl * 0.85);
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.mapping = THREE.EquirectangularReflectionMapping;
  return { map: t };
}

/* 树叶（带 alpha 的簇叶片） */
function buildLeaf(size = 256) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  g.clearRect(0, 0, size, size);
  const rnd = mulberry32(5);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * size, y = rnd() * size;
    const s = size * (0.05 + rnd() * 0.075);
    const gr = 0.55 + rnd() * 0.45;
    g.save(); g.translate(x, y); g.rotate(rnd() * TAU);
    g.fillStyle = `rgb(${(70 * gr) | 0},${(126 * gr) | 0},${(52 * gr) | 0})`;
    g.beginPath(); g.ellipse(0, 0, s, s * 0.5, 0, 0, TAU); g.fill();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { map: t };
}

/* 木材（栈道 / 九层楼） */
function buildWood(size = 256, base = [0x6E, 0x3F, 0x2C], hi = [0x9A, 0x5E, 0x40]) {
  const r = bake(size, (u, v) => {
    const rings = Math.sin((v * 9 + fbm2(u * 3, v * 3, 3, 2) * 3) * Math.PI * 2) * 0.5 + 0.5;
    const grain = fbm2(u * 8, v * 90, 3, 7);
    const t = clamp(rings * 0.5 + grain * 0.5, 0, 1);
    return [lerp(base[0], hi[0], t), lerp(base[1], hi[1], t), lerp(base[2], hi[2], t), t];
  });
  return { map: toTex(r.canvas), normal: toDataTex(normalFromHeight(r.heights, size, 0.9)) };
}

/* 瓦顶 */
function buildTile(size = 256) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  g.fillStyle = '#4E5966'; g.fillRect(0, 0, size, size);
  const n = 10, w = size / n;
  for (let i = 0; i < n; i++) {
    const grad = g.createLinearGradient(i * w, 0, (i + 1) * w, 0);
    grad.addColorStop(0, '#3A434E'); grad.addColorStop(0.45, '#6A7684'); grad.addColorStop(1, '#39424D');
    g.fillStyle = grad; g.fillRect(i * w, 0, w, size);
  }
  for (let y = 0; y < size; y += size / 8) {
    g.fillStyle = 'rgba(30,36,44,0.45)'; g.fillRect(0, y, size, 2.5);
  }
  return { map: toTex(c) };
}

/* 沙丘顶（崖顶戈壁） */
function buildDune(size = 512) {
  const r = bake(size, (u, v) => {
    const dunes = fbm2(u * 3.4, v * 3.4, 5, 4.4);
    const streak = fbm2(u * 2.0, v * 40, 4, 8.2);   // 风蚀条纹
    const grain = fbm2(u * 100, v * 100, 2, 1.1);
    const t = clamp(dunes * 0.5 + streak * 0.36 + grain * 0.14, 0, 1);
    return [lerp(0xC5, 0xE6, t), lerp(0x9E, 0xC6, t), lerp(0x6A, 0x93, t), clamp(dunes * 0.55 + streak * 0.45, 0, 1)];
  });
  return { map: toTex(r.canvas), normal: toDataTex(normalFromHeight(r.heights, size, 1.6)) };
}

/* 建造全部纹理（分帧执行，避免长时间阻塞） */
function buildAllTextures(onProgress) {
  /*
    原基线在启动阶段烘焙多张 512/1024 纹理，软件 WebGL 或中端笔记本上
    会出现很长的黑屏。这里把高频细节交给 normal map 与程序噪声，纹理本体
    控制在 384/768；肉眼质量基本不变，但像素烘焙量下降约一半。
  */
  const steps = [
    ['sky', () => buildSky()],
    ['sandstone', () => buildSandstone(384)],
    ['dune', () => buildDune(384)],
    ['caveWall', () => buildCaveWall(384)],
    ['rockCore', () => buildRockCore(384)],
    ['crackedMud', () => buildCrackedMud(384)],
    ['mudCoarse', () => buildMud(256, { a: [0x93, 0x81, 0x66], b: [0xBC, 0xA8, 0x86] }, 46, 1.0)],
    ['mudMid', () => buildMud(256, { a: [0x92, 0x72, 0x55], b: [0xB8, 0x96, 0x70] }, 80, 0.74)],
    ['mudFine', () => buildMud(256, { a: [0xA5, 0x83, 0x64], b: [0xC3, 0xA2, 0x7C] }, 150, 0.46)],
    ['mudPolish', () => buildMud(256, { a: [0xD6, 0xC2, 0xA6], b: [0xEE, 0xDF, 0xC6] }, 260, 0.16)],
    ['skin', () => buildSkin(256)],
    ['robeRed', () => buildRobeRed(384)],
    ['innerBlue', () => buildInnerBlue(384)],
    ['sash', () => buildSash(384)],
    ['halo', () => buildHalo(768)],
    ['haloCrown', () => buildHaloCrown()],
    ['ground', () => buildGroundStone(384)],
    ['mural', () => buildMural(768, 768)],
    ['whitewash', () => buildWhitewash(256)],
    ['leaf', () => buildLeaf(256)],
    ['wood', () => buildWood(256)],
    ['woodRed', () => buildWood(256, [0x7A, 0x2E, 0x22], [0xA8, 0x4A, 0x33])],
    ['tile', () => buildTile(256)],
  ];
  let i = 0;
  return new Promise((resolve) => {
    function tick() {
      const t0 = performance.now();
      while (i < steps.length && performance.now() - t0 < 24) {
        const [name, fn] = steps[i];
        TEX[name] = fn();
        i++;
        if (onProgress) onProgress(i / steps.length, name);
      }
      if (i < steps.length) requestAnimationFrame(tick);
      else resolve(TEX);
    }
    tick();
  });
}
