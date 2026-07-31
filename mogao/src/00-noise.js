/* ============================================================
   00 - 噪声与工具函数
   （无 import / export：由 build.js 按序拼接为单文件）
   ============================================================ */

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;

/* --- 确定性伪随机 --- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --- 3D value noise（哈希 + 三线性插值） --- */
function hash3(x, y, z) {
  let h = x * 374761393 + y * 668265263 + z * 1274126177;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

function vnoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = fade(xf), v = fade(yf), w = fade(zf);
  const c000 = hash3(xi, yi, zi),       c100 = hash3(xi + 1, yi, zi);
  const c010 = hash3(xi, yi + 1, zi),   c110 = hash3(xi + 1, yi + 1, zi);
  const c001 = hash3(xi, yi, zi + 1),   c101 = hash3(xi + 1, yi, zi + 1);
  const c011 = hash3(xi, yi + 1, zi + 1), c111 = hash3(xi + 1, yi + 1, zi + 1);
  const x00 = lerp(c000, c100, u), x10 = lerp(c010, c110, u);
  const x01 = lerp(c001, c101, u), x11 = lerp(c011, c111, u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}

function fbm3(x, y, z, oct = 5, lac = 2.03, gain = 0.5) {
  let a = 0.5, f = 1, s = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise3(x * f, y * f, z * f);
    norm += a; a *= gain; f *= lac;
  }
  return s / norm;
}

/* --- 2D 版本（纹理生成用，z 作为 seed 偏移） --- */
const vnoise2 = (x, y, s = 0) => vnoise3(x, y, s * 17.13 + 0.5);
function fbm2(x, y, oct = 5, s = 0, lac = 2.03, gain = 0.5) {
  let a = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += a * vnoise2(x * f, y * f, s + i * 3.7);
    norm += a; a *= gain; f *= lac;
  }
  return sum / norm;
}

/* 脊状噪声：产生岩石层理/侵蚀沟 */
function ridge2(x, y, oct = 4, s = 0) {
  let a = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(vnoise2(x * f, y * f, s + i * 5.1) * 2 - 1);
    sum += a * n * n; norm += a; a *= 0.5; f *= 2.07;
  }
  return sum / norm;
}

/* --- 平铺型 Worley/Voronoi：用于龟裂纹与岩石斑块 --- */
function worley2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 1e9, d2 = 1e9;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = xi + i, cy = yi + j;
      const px = cx + hash3(cx, cy, seed);
      const py = cy + hash3(cx, cy, seed + 91);
      const dx = px - x, dy = py - y;
      const d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return { f1: Math.sqrt(d1), f2: Math.sqrt(d2) };
}

/* 颜色工具 */
function mixHex(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return ((Math.round(lerp(ar, br, t)) << 16) | (Math.round(lerp(ag, bg, t)) << 8) | Math.round(lerp(ab, bb, t)));
}
const rgbStr = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
