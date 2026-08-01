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
  [-1.0,6.15],[0.0,6.25],[2.0,6.55],[4.0,7.05],[6.0,7.80],[8.0,8.75],
  [10.0,9.65],[11.5,10.00],[13.0,9.70],[15.0,8.35],[17.0,7.25],[18.5,6.25],
  [19.5,5.15],[20.5,4.80],[22.0,5.05],[23.5,5.35],[25.0,5.72],[26.2,6.12],
  [27.0,6.18],[27.65,5.65],[28.20,3.65],[28.70,2.42],[29.10,2.30],[29.55,2.42],
  [30.10,2.82],[30.80,3.02],[31.60,3.08],[32.45,3.08],[33.25,2.98],[34.00,2.76],
  [34.62,2.32],[35.10,1.72],[35.43,.82],[35.60,.16],
]);

const PROF_RZ = makeCurve1D([
  [-1.0,3.45],[0.0,3.55],[2.0,3.75],[4.0,4.00],[6.0,4.32],[8.0,4.72],
  [10.0,5.20],[11.5,5.62],[13.0,5.50],[15.0,4.95],[17.0,4.35],[18.5,3.75],
  [19.5,3.25],[20.5,3.16],[22.0,3.30],[23.5,3.48],[25.0,3.62],[26.2,3.66],
  [27.0,3.52],[27.65,3.15],[28.20,2.30],[28.70,1.80],[29.10,2.12],[29.55,2.42],
  [30.10,2.72],[30.80,3.06],[31.60,3.28],[32.45,3.36],[33.25,3.26],[34.00,2.98],
  [34.62,2.52],[35.10,1.86],[35.43,.90],[35.60,.16],
]);

/* 截面中心的前后位移：坐姿下身前倾、头略后靠 */
const PROF_CZ = makeCurve1D([
  [0.0,.38],[4.0,.50],[8.0,.72],[11.5,.92],[14.0,.82],[17.0,.55],[19.0,.28],
  [21.0,.10],[23.0,.02],[25.0,-.02],[27.2,-.08],[28.4,.00],[29.3,.38],
  [30.4,1.05],[32.0,1.55],[33.4,1.42],[34.6,.72],[35.55,-.02],
]);

/* ------------------------------------------------------------
   衣褶：下裙的横向 U 形垂褶（t8 可数出 7 道大褶）
   ------------------------------------------------------------ */
function foldDisp(u,y){
  const a=u*TAU,front=Math.cos(a),side=Math.abs(Math.sin(a));let d=0;
  if(y<19.8){
    const frontW=smoothstep(-.10,.78,front);
    /* 宽缓 U 形垂褶，仅在正面形成，不再绕成整圈横纹。 */
    const K=lerp(1.4,4.8,smoothstep(18.5,3.0,y));
    const spacing=2.55+(19.0-y)*.025;
    const phase=(y+K*front+.24*Math.sin(a*2.0+.7))/spacing;
    const sv=Math.sin(phase*TAU);
    d+=(sv*.66+Math.sign(sv)*Math.pow(Math.abs(sv),2.2)*.34)*.024*frontW*smoothstep(19.5,15.0,y)*smoothstep(.5,3.2,y);
    /* 两侧受重力形成纵向瀑布褶。 */
    const sideW=Math.pow(side,2.4)*smoothstep(.50,-.20,front);
    d+=Math.sin(a*7.0+y*.13)*.020*sideW*smoothstep(19.5,12.0,y);
    d+=Math.sin(a*13.0-y*.17)*.008*sideW*smoothstep(18.0,8.0,y);
    d+=smoothstep(3.2,0.0,y)*.030;
  }
  if(y>=17.0&&y<29.5){
    const t=smoothstep(17.0,20.0,y)*smoothstep(29.5,27.0,y);
    d+=Math.sin((y/1.95+front*.30)*TAU)*.014*t*smoothstep(-.05,.72,front);
    d+=Math.sin(a*4.0+y*.28)*.009*t;
  }
  if(y>29.3)d*=smoothstep(30.2,29.3,y);return d;
}

/* ------------------------------------------------------------
   膝盖：倚坐双腿下垂并拢，正前方 y≈13~18 有两团圆凸
   ------------------------------------------------------------ */
function kneeBulge(u, y) {
  const a = u * TAU;
  const front = Math.max(0, Math.cos(a));
  if (front <= 0.002) return 0;
  const px = Math.sin(a) * PROF_RX(y);
  const gy = Math.exp(-Math.pow((y - 14.25) / 3.55, 2));
  const off = 5.45;
  const left = Math.exp(-Math.pow((px + off) / 3.10, 2));
  const right = Math.exp(-Math.pow((px - off) / 3.10, 2));
  const centreValley = Math.exp(-Math.pow(px / 1.65, 2)) * 0.42;
  return Math.max(0, left + right - centreValley) * gy * Math.pow(front, 1.20) * 2.18;
}

/* 腿部：膝下小腿向下延伸，裙面在正前方略前凸 */
function shinBulge(u, y) {
  const a = u * TAU;
  const front = Math.max(0, Math.cos(a));
  if (front <= 0.002) return 0;
  const px = Math.sin(a) * PROF_RX(y);
  const gy = smoothstep(14.2, 10.6, y) * smoothstep(0.4, 3.1, y);
  const off = 4.50;
  const left = Math.exp(-Math.pow((px + off) / 3.25, 2));
  const right = Math.exp(-Math.pow((px - off) / 3.25, 2));
  const valley = Math.exp(-Math.pow(px / 1.65, 2)) * 0.20;
  return Math.max(0, left + right - valley) * gy * Math.pow(front, 1.12) * 0.92;
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
    d += G(ax, 0, w) * gy * lerp(0.30, 0.88, prof);
    d += G(ax, 0.42, 0.22) * G(y, 31.44, 0.23) * 0.39;   // 鼻翼
  }
  /* 眉弓 */
  d += G(ax, 0.98, 0.70) * G(y, 32.62, 0.25) * 0.145;
  /* 眼窝（凹）+ 眼睑（凸） */
  d -= G(ax, 0.88, 0.56) * G(y, 32.52, 0.30) * 0.115;
  d += G(ax, 0.84, 0.46) * G(y, 32.31, 0.175) * 0.335;
  /* 唇 + 唇下沟 */
  d += G(ax, 0, 0.52) * G(y, 30.84, 0.205) * 0.205;
  d -= G(ax, 0, 0.45) * G(y, 30.50, 0.16) * 0.055;
  /* 人中 */
  d -= G(ax, 0, 0.105) * G(y, 31.10, 0.175) * 0.050;
  /* 下巴 */
  d += G(ax, 0, 0.54) * G(y, 30.34, 0.28) * 0.135;
  /* 颊 */
  d += G(ax, 1.34, 0.70) * G(y, 31.76, 0.66) * 0.205;

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
  /* 坐姿骨盆和腹部从宽大的双膝自然过渡到腰部。 */
  d += G(y, 18.8, 1.50) * Math.pow(front, 1.22) * 0.44;
  d += G(y, 21.4, 1.65) * Math.pow(front, 1.30) * 0.48;
  d += G(y, 24.1, 1.90) * Math.pow(front, 1.38) * 0.60;
  /* 胸廓为左右两个缓坡，中央胸骨沟极浅。 */
  const chestY = G(y, 26.10, 1.72);
  d += (G(px, -2.45, 2.35) + G(px, 2.45, 2.35)) * chestY * Math.pow(front, 1.14) * 0.56;
  d -= G(px, 0, 0.95) * chestY * Math.pow(front, 1.70) * 0.10;
  d -= G(y, 27.95, 0.36) * G(px, 0, 4.10) * Math.pow(front, 1.35) * 0.09;
  d += G(y, 27.15, 0.78) * Math.pow(side, 2.0) * front * 0.25;
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
  const lower = smoothstep(20.5, 16.8, y);
  const back = Math.max(0, -dz);
  const lowerDepth = 1.0 - lower * back * 0.24;
  const p = out || new THREE.Vector3();
  p.set(dx * (rx * f + fr), y, dz * (rz * f + fr) * lowerDepth + cz + kb + ar);
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
   施工接触面：与高密度 lower / torso / head 资产一致的正面近似。
   工具、木桩、泥团和纤维全部使用该表面，避免继续依赖旧旋转体而悬浮。
   lateral 为 -1..1 的正面横向参数。
   ------------------------------------------------------------ */
const BUDDHA_SURF_RX = makeCurve1D([
  [0,6.2],[3,6.8],[6,7.7],[9,9.2],[11.5,9.9],[14,9.1],[16.5,7.5],[18.5,6.2],
  [20,4.8],[22,5.1],[24,5.5],[26,6.1],[27.2,6.0],[28.2,3.7],[29.0,2.35],
  [30,2.75],[31.5,3.05],[33,3.0],[34.2,2.65],[35.5,.25]
]);
const BUDDHA_SURF_RZ = makeCurve1D([
  [0,3.45],[3,3.8],[6,4.25],[9,4.9],[11.5,5.55],[14,5.05],[16.5,4.35],[18.5,3.55],
  [20,3.10],[22,3.30],[24,3.48],[26,3.58],[27.2,3.35],[28.2,2.15],[29.0,2.05],
  [30,2.72],[31.5,3.25],[33,3.22],[34.2,2.72],[35.5,.22]
]);
const BUDDHA_SURF_CZ = makeCurve1D([
  [0,.35],[6,.60],[11.5,.90],[16,.60],[20,.18],[24,.02],[27,-.04],[28.5,.22],
  [30,1.05],[32,1.70],[33.5,1.34],[35.5,.0]
]);
function buddhaSurfacePoint(lateral, y, outP = new THREE.Vector3(), outN = new THREE.Vector3()) {
  const yy=clamp(y,.08,BUDDHA_H-.05), lat=clamp(lateral,-.96,.96);
  const rx=BUDDHA_SURF_RX(yy), rz=BUDDHA_SURF_RZ(yy), cz=BUDDHA_SURF_CZ(yy);
  const x=lat*rx;
  const ell=Math.sqrt(Math.max(.025,1-lat*lat));
  let z=cz+rz*ell;
  if(yy<19.2){
    const kneeY=Math.exp(-Math.pow((yy-11.4)/3.55,2));
    const knee=(Math.exp(-Math.pow((x-5.0)/2.55,2))+Math.exp(-Math.pow((x+5.0)/2.55,2)))*kneeY;
    const valley=Math.exp(-Math.pow(x/.95,2))*kneeY;
    const apron=Math.exp(-Math.pow(x/2.2,4))*Math.exp(-Math.pow((yy-8.8)/5.5,2));
    z+=knee*.56-valley*.55+apron*.24;
  }else if(yy<28.4){
    const chest=Math.exp(-Math.pow((yy-25.1)/1.5,2))*(Math.exp(-Math.pow((x-2.0)/1.7,2))+Math.exp(-Math.pow((x+2.0)/1.7,2)))*.16;
    const abdomen=Math.exp(-Math.pow((yy-21.2)/1.7,2))*Math.exp(-Math.pow(x/3.5,4))*.20;
    z+=chest+abdomen;
  }else{
    const nx=x/3.08, ny=(yy-32.18)/3.52;
    z=1.82+2.66*Math.sqrt(Math.max(.02,1-nx*nx-ny*ny));
    const face=Math.exp(-Math.pow(x/2.55,6))*smoothstep(29.1,30.0,yy)*smoothstep(35.1,34.2,yy);
    const plane=4.48+Math.exp(-Math.pow((yy-31.7)/1.05,2))*.13;
    z=lerp(z,plane,face*.68);
    z+=Math.exp(-Math.pow(x/.34,2))*smoothstep(33.0,32.5,yy)*smoothstep(31.0,31.4,yy)*.34;
  }
  outP.set(x,yy,z);
  const eps=.018;
  const pX=new THREE.Vector3(),pY=new THREE.Vector3();
  const sample=(l,y0)=>{
    const rxx=BUDDHA_SURF_RX(y0),rzz=BUDDHA_SURF_RZ(y0),czz=BUDDHA_SURF_CZ(y0),xx=l*rxx;
    let zz=czz+rzz*Math.sqrt(Math.max(.025,1-l*l));
    if(y0<19.2){const ky=Math.exp(-Math.pow((y0-11.4)/3.55,2));zz+=(Math.exp(-Math.pow((xx-5)/2.55,2))+Math.exp(-Math.pow((xx+5)/2.55,2)))*ky*.56-Math.exp(-Math.pow(xx/.95,2))*ky*.55+Math.exp(-Math.pow(xx/2.2,4))*Math.exp(-Math.pow((y0-8.8)/5.5,2))*.24;}
    else if(y0<28.4){zz+=Math.exp(-Math.pow((y0-25.1)/1.5,2))*(Math.exp(-Math.pow((xx-2)/1.7,2))+Math.exp(-Math.pow((xx+2)/1.7,2)))*.16+Math.exp(-Math.pow((y0-21.2)/1.7,2))*Math.exp(-Math.pow(xx/3.5,4))*.20;}
    else{const nx=xx/3.08,ny=(y0-32.18)/3.52;zz=1.82+2.66*Math.sqrt(Math.max(.02,1-nx*nx-ny*ny));const fm=Math.exp(-Math.pow(xx/2.55,6))*smoothstep(29.1,30.0,y0)*smoothstep(35.1,34.2,y0);zz=lerp(zz,4.48+Math.exp(-Math.pow((y0-31.7)/1.05,2))*.13,fm*.68);zz+=Math.exp(-Math.pow(xx/.34,2))*smoothstep(33.0,32.5,y0)*smoothstep(31.0,31.4,y0)*.34;}
    return [xx,y0,zz];
  };
  const sx=sample(clamp(lat+eps,-.97,.97),yy), sy=sample(lat,clamp(yy+eps,.08,BUDDHA_H-.05));
  pX.set(sx[0]-outP.x,sx[1]-outP.y,sx[2]-outP.z);
  pY.set(sy[0]-outP.x,sy[1]-outP.y,sy[2]-outP.z);
  outN.crossVectors(pX,pY).normalize();
  if(outN.z<0)outN.multiplyScalar(-1);
  return {p:outP,n:outN};
}

/* ------------------------------------------------------------
   石胎包络：开凿留下的粗岩柱（t52 侧影）
   ------------------------------------------------------------ */
const ENV_RX = makeCurve1D([
  [0.0,8.65],[4.0,8.85],[8.0,9.18],[10.5,9.65],[12.4,10.15],[14.5,10.82],[16.5,10.60],
  [18.5,9.05],[20.0,7.55],[21.5,7.05],[24.0,7.60],[26.5,8.68],[27.8,8.50],[28.6,5.10],
  [29.2,3.20],[30.2,3.32],[31.8,3.68],[33.3,3.62],[34.5,2.92],[35.25,1.82],[35.62,.58],
]);
const ENV_RZ = makeCurve1D([
  [0.0,4.72],[4.0,4.92],[8.0,5.18],[10.5,5.48],[12.4,5.92],[14.5,6.62],[16.5,6.55],
  [18.5,5.62],[20.0,4.95],[21.5,4.72],[24.0,5.25],[26.5,5.98],[27.8,5.78],[28.6,3.72],
  [29.2,2.74],[30.2,3.20],[31.8,3.70],[33.3,3.64],[34.5,2.96],[35.25,1.84],[35.62,.58],
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
  const normal = geo.attributes.normal;
  const n = p.count;
  const rp = new Float32Array(n * 3);
  const rn = new Float32Array(n * 3);
  const V = new THREE.Vector3(), N = new THREE.Vector3(), R = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    V.fromBufferAttribute(p, i);
    if (normal) N.fromBufferAttribute(normal, i).normalize();
    else N.set(V.x, 0.18, V.z).normalize();
    const macro = fbm3(V.x * 0.19 + 7.1, V.y * 0.17 + 3.7, V.z * 0.21 + 5.2, 4) - 0.5;
    const chip = ridge2(V.x * 0.32 + V.z * 0.16, V.y * 0.24, 3, 23.0) - 0.5;
    const amp = 0.22 + smoothstep(0.0, 35.5, V.y) * 0.05;
    R.copy(V).addScaledVector(N, macro * amp - chip * 0.065);
    /* shrinkToAxis 仅控制零件轻微并入主轮廓，不再把人体压回花瓶包络。 */
    if (shrinkToAxis < 0.999) {
      const k = 1.0 - (1.0 - shrinkToAxis) * 0.34;
      R.x *= k; R.z *= lerp(1.0, k, 0.48);
    }
    rp[i * 3] = R.x; rp[i * 3 + 1] = R.y; rp[i * 3 + 2] = R.z;
    rn[i * 3] = N.x; rn[i * 3 + 1] = N.y; rn[i * 3 + 2] = N.z;
  }
  geo.setAttribute('aRockPos', new THREE.BufferAttribute(rp, 3));
  geo.setAttribute('aRockNrm', new THREE.BufferAttribute(rn, 3));
  return geo;
}
