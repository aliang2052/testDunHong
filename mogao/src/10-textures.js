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
  const dark=[0x6A,0x4B,0x35], mid=[0xA8,0x78,0x50], light=[0xD3,0xAD,0x7B], grey=[0x8B,0x7C,0x70];
  const r=bake(size,(u,v)=>{
    const warp=fbm2(u*2.1,v*2.7,5,17.2);
    const macro=fbm2(u*3.0+warp*.42,v*3.4,5,3.7);
    const vertical=ridge2(u*7.0+warp*1.35,v*1.35,5,7.3);
    const pockets=fbm2(u*8.5+warp*.7,v*11.0,4,29.1);
    const grain=fbm2(u*150,v*150,3,5.8);
    const beds=fbm2(u*1.2+warp*.18,v*13.0,4,11.1);
    const crackMask=smoothstep(.72,.91,fbm2(u*3.2,v*8.0,4,43.0));
    const crackLine=smoothstep(.955,.995,Math.abs(Math.sin((u*5.2+warp*1.7+v*.18)*3.14159)))*crackMask;
    let t=clamp(macro*.43+vertical*.25+pockets*.16+beds*.08+grain*.08,0,1);
    let col=[lerp(mid[0],light[0],t),lerp(mid[1],light[1],t),lerp(mid[2],light[2],t)];
    const mineral=smoothstep(.67,.90,fbm2(u*4.0,v*4.6,4,71))*0.24;
    col=[lerp(col[0],grey[0],mineral),lerp(col[1],grey[1],mineral),lerp(col[2],grey[2],mineral)];
    const shade=clamp((1.0-vertical)*.16+(1.0-pockets)*.12+crackLine*.48,0,.62);
    col=[lerp(col[0],dark[0],shade),lerp(col[1],dark[1],shade),lerp(col[2],dark[2],shade)];
    const h=clamp(.12+macro*.30+vertical*.33+pockets*.18+beds*.08+grain*.06-crackLine*.38,0,1);
    return [col[0],col[1],col[2],h];
  });
  return {map:toTex(r.canvas),normal:toDataTex(normalFromHeight(r.heights,size,3.6)),raw:r};
}

/* ------------------------------------------------------------
   洞窟内壁 —— 开凿出的平滑土棕面
   ------------------------------------------------------------ */
function buildCaveWall(size = 512) {
  const a=[0x59,0x3E,0x2D],b=[0x9A,0x6E,0x4D],dust=[0xB4,0x8B,0x66];
  const r=bake(size,(u,v)=>{
    const macro=fbm2(u*4.5,v*4.0,5,7.7);
    const chop=ridge2(u*10.5,v*34.0,4,2.2);
    const soot=smoothstep(.62,.9,fbm2(u*3.2,v*3.6,4,63));
    const grain=fbm2(u*130,v*130,3,9.1);
    let t=clamp(macro*.55+grain*.18+chop*.27,0,1);
    let col=[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
    col=[lerp(col[0],dust[0],grain*.12),lerp(col[1],dust[1],grain*.12),lerp(col[2],dust[2],grain*.12)];
    col=col.map((c,i)=>lerp(c,[0x34,0x29,0x23][i],soot*.48));
    return [col[0],col[1],col[2],clamp(macro*.26+chop*.52+grain*.18,0,1)];
  });
  return {map:toTex(r.canvas),normal:toDataTex(normalFromHeight(r.heights,size,2.0))};
}

/* ------------------------------------------------------------
   石胎岩石 —— 黄褐砂岩 + 明显灰斑与凿面
   ------------------------------------------------------------ */
function buildRockCore(size = 512) {
  const a=[0x7E,0x5A,0x3A],b=[0xC3,0x96,0x62],grey=[0x70,0x69,0x60];
  const r=bake(size,(u,v)=>{
    const macro=fbm2(u*5.0,v*5.0,5,23.3);
    const w=worley2(u*10.5,v*10.5,5);
    const facet=smoothstep(.30,.025,w.f2-w.f1);
    const grain=fbm2(u*140,v*140,3,3.3);
    const chisel=ridge2(u*18,v*27,3,91);
    let t=clamp(macro*.58+grain*.19+facet*.13+chisel*.10,0,1);
    let col=[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
    const gm=smoothstep(.61,.86,fbm2(u*3.7,v*3.5,4,61))*.55;
    col=[lerp(col[0],grey[0],gm),lerp(col[1],grey[1],gm),lerp(col[2],grey[2],gm)];
    return [col[0],col[1],col[2],clamp(macro*.30+facet*.35+grain*.18+chisel*.23,0,1)];
  });
  return {map:toTex(r.canvas),normal:toDataTex(normalFromHeight(r.heights,size,3.5))};
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
    const flake = worley2(u * grainScale * 0.35, v * grainScale * 0.35, 12);
    const fl = smoothstep(0.35, 0.0, flake.f1) * 0.25;
    let t = clamp(macro * 0.45 + grain * 0.45 + fl * 0.4, 0, 1);
    const col = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    const h = clamp(0.5 + (grain - 0.5) * roughAmp + (macro - 0.5) * 0.35, 0, 1);
    return [col[0], col[1], col[2], h];
  });
  return { map: toTex(r.canvas), normal: toDataTex(normalFromHeight(r.heights, size, 2.0)) };
}

/* ------------------------------------------------------------
   袈裟：赭红，带细小深褐斑点（视频里泥塑表面的杂质）
   ------------------------------------------------------------ */
function buildRobeRed(size = 512) {
  /* 褪色朱砂与土红，而不是饱和巧克力红。 */
  const a=[0x66,0x37,0x2C],b=[0xAE,0x67,0x4E],ochre=[0xC0,0x87,0x59];
  const r=bake(size,(u,v)=>{
    const macro=fbm2(u*4,v*4,5,3.9),grain=fbm2(u*75,v*75,3,6.1);
    const wear=smoothstep(.66,.91,fbm2(u*8,v*8,4,34));
    const soot=smoothstep(.68,.92,fbm2(u*3.5,v*5,3,88));
    let t=clamp(macro*.62+grain*.38,0,1);
    let col=[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
    col=[lerp(col[0],ochre[0],wear*.25),lerp(col[1],ochre[1],wear*.25),lerp(col[2],ochre[2],wear*.25)];
    col=col.map((c,i)=>lerp(c,[0x45,0x31,0x2A][i],soot*.22));
    return [col[0],col[1],col[2],clamp(.45+(grain-.5)*.45+(wear-.5)*.12,0,1)];
  });
  return {map:toTex(r.canvas),normal:toDataTex(normalFromHeight(r.heights,size,1.35))};
}

/* ------------------------------------------------------------
   内衣：孔雀蓝 + 深蓝团花圆点（参考 t96 左肩）
   ------------------------------------------------------------ */
function buildInnerBlue(size = 512) {
  const c=makeCanvas(size,size),g=c.getContext('2d');
  const img=g.createImageData(size,size),d=img.data;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size,n=fbm2(u*44,v*44,3,2.1),m=fbm2(u*5,v*5,4,18);
    const i=(y*size+x)*4;d[i]=45+(n-.5)*15;d[i+1]=82+(m-.5)*20;d[i+2]=88+(n-.5)*18;d[i+3]=255;
  }
  g.putImageData(img,0,0);
  g.strokeStyle='rgba(171,145,99,.48)';g.fillStyle='rgba(31,58,61,.74)';g.lineWidth=size*.006;
  const step=size/4;
  for(let yy=-1;yy<5;yy++)for(let xx=-1;xx<5;xx++){
    const cx=(xx+.5)*step+(yy%2)*step*.18,cy=(yy+.5)*step;
    g.beginPath();g.arc(cx,cy,step*.105,0,TAU);g.fill();
    for(let k=0;k<6;k++){const a=k/6*TAU;g.beginPath();g.ellipse(cx+Math.cos(a)*step*.17,cy+Math.sin(a)*step*.17,step*.07,step*.035,a,0,TAU);g.stroke();}
  }
  return {map:toTex(c)};
}

/* ------------------------------------------------------------
   斜披（僧祇支）：土黄底 + 绿松石菱形连环纹
   ------------------------------------------------------------ */
function buildSash(size = 512) {
  const c=makeCanvas(size,size),g=c.getContext('2d');g.fillStyle='#9A8144';g.fillRect(0,0,size,size);
  const img=g.getImageData(0,0,size,size),d=img.data;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const n=fbm2(x/size*38,y/size*38,3,9.3),m=fbm2(x/size*5,y/size*5,4,27);const i=(y*size+x)*4;d[i]=clamp(d[i]+(n-.5)*28+(m-.5)*18,0,255);d[i+1]=clamp(d[i+1]+(n-.5)*25,0,255);d[i+2]=clamp(d[i+2]+(n-.5)*18,0,255);}g.putImageData(img,0,0);
  g.strokeStyle='rgba(43,105,88,.82)';g.lineWidth=size*.010;const st=size/5;
  for(let yy=-1;yy<6;yy++)for(let xx=-1;xx<6;xx++){const cx=(xx+.5)*st,cy=(yy+.5)*st;g.beginPath();g.moveTo(cx,cy-st*.38);g.lineTo(cx+st*.38,cy);g.lineTo(cx,cy+st*.38);g.lineTo(cx-st*.38,cy);g.closePath();g.stroke();}
  g.globalAlpha=.18;g.fillStyle='#342820';const rnd=mulberry32(92);for(let i=0;i<170;i++){g.beginPath();g.arc(rnd()*size,rnd()*size,1+rnd()*8,0,TAU);g.fill();}g.globalAlpha=1;
  return {map:toTex(c)};
}

/* ------------------------------------------------------------
   皮肤（肉色，细腻微颗粒）
   ------------------------------------------------------------ */
function buildSkin(size = 256) {
  const r=bake(size,(u,v)=>{
    const micro=fbm2(u*90,v*90,3,12.2),m=fbm2(u*7,v*7,4,31.7);
    const pore=worley2(u*42,v*46,67); const p=smoothstep(.16,.02,pore.f2-pore.f1);
    const stain=smoothstep(.64,.90,fbm2(u*4,v*5,4,51));
    const wear=smoothstep(.72,.94,fbm2(u*13,v*9,3,88));
    const t=clamp(micro*.26+m*.62+p*.08,0,1);
    let col=[lerp(0xC2,0xDF,t),lerp(0xA9,0xCC,t),lerp(0x88,0xB0,t)];
    col=[lerp(col[0],0x8E,stain*.16),lerp(col[1],0x72,stain*.16),lerp(col[2],0x58,stain*.16)];
    col=[lerp(col[0],0xD2,wear*.08),lerp(col[1],0xBD,wear*.08),lerp(col[2],0x99,wear*.08)];
    return [col[0],col[1],col[2],clamp(.44+(micro-.5)*.22+p*.22+(wear-.5)*.07,0,1)];
  });
  return {map:toTex(r.canvas),normal:toDataTex(normalFromHeight(r.heights,size,.95))};
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
    [0.34, 0.50, '#8FA99C'],
    [0.50, 0.53, '#3E6B61'],
    [0.53, 0.71, '#B1B29B'],
    [0.71, 0.74, '#466F64'],
    [0.74, 0.905, '#88A79B'],
    [0.905, 0.955, '#965044'],
    [0.955, 1.00, '#76968C'],
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
    g.beginPath(); g.arc(x, y, rad * 0.15, 0, TAU); g.fillStyle = '#D9D0B8'; g.fill();
  }
  const rings = [
    { r: 0.620, n: 22, rad: 0.070, p: '#4B756A', c: '#965044' },
    { r: 0.825, n: 28, rad: 0.066, p: '#547F73', c: '#8E4A3F' },
    { r: 0.435, n: 16, rad: 0.054, p: '#486E65', c: '#965044' },
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
  arc(w * 0.47, h * 0.86, '#934839');
  arc(w * 0.40, h * 0.74, '#6D342B');
  arc(w * 0.31, h * 0.60, '#A95B45');
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
  g.fillStyle = '#5D8B7D';
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
  const r=bake(size,(u,v)=>{
    const macro=fbm2(u*4,v*4,5,17),grain=fbm2(u*110,v*110,3,22),ripple=ridge2(u*7,v*24,3,11);
    const peb=worley2(u*34,v*34,31);const edge=smoothstep(.09,.0,peb.f1)*.28;
    const t=clamp(macro*.48+grain*.28+ripple*.18+edge,0,1);
    const a=[0x76,0x5A,0x3D],b=[0xBE,0x96,0x66];
    return [lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t),clamp(macro*.35+grain*.2+ripple*.22+edge*.45,0,1)];
  });
  return {map:toTex(r.canvas,1),normal:toDataTex(normalFromHeight(r.heights,size,2.2))};
}

/* ------------------------------------------------------------
   壁画（洞窟四壁，参考 t107）—— 千佛 + 飞天 + 卷草边饰
   ------------------------------------------------------------ */
function buildMural(w = 1024, h = 1024) {
  const c=makeCanvas(w,h),g=c.getContext('2d'),rnd=mulberry32(2307);
  g.fillStyle='#766F58';g.fillRect(0,0,w,h);
  /* 矿物底色先用多层半透明斑驳铺开，避免纯净平面。 */
  for(let i=0;i<900;i++){
    const x=rnd()*w,y=rnd()*h,rx=5+rnd()*54,ry=3+rnd()*34;
    const cols=['rgba(111,118,91,.10)','rgba(129,80,55,.10)','rgba(56,73,69,.09)','rgba(199,164,104,.06)'];
    g.fillStyle=cols[(rnd()*cols.length)|0];g.beginPath();g.ellipse(x,y,rx,ry,rnd()*TAU,0,TAU);g.fill();
  }
  /* 上下边饰：断续、错位、褪色。 */
  const border=(y0,hh)=>{
    g.globalAlpha=.68;g.fillStyle='#743F32';g.fillRect(0,y0,w,hh);
    g.strokeStyle='rgba(205,177,112,.72)';g.lineWidth=hh*.07;
    for(let i=0;i<34;i++){
      if(rnd()<.12)continue;const x=i/34*w+(rnd()-.5)*9;
      g.beginPath();g.moveTo(x,y0+hh*.78);g.bezierCurveTo(x+w/120,y0+hh*.12,x+w/80,y0+hh*.12,x+w/55,y0+hh*.78);g.stroke();
    }
    g.globalAlpha=1;
  };
  border(0,h*.055);border(h*.945,h*.055);

  /* 叙事主带：不规则千佛与供养人，尺寸、姿态、缺损均不同。 */
  const bodyCols=['#8F4E39','#70513F','#4E6667','#6D704E','#9B7641'];
  const haloCols=['#566D61','#6D5848','#4C6870','#786346'];
  const cols=8,rows=6,cw=w/cols,ch=h*.72/rows,y0=h*.16;
  for(let r=0;r<rows;r++)for(let i=0;i<cols;i++){
    if(rnd()<.10)continue;
    const cx=(i+.5)*cw+(rnd()-.5)*cw*.22,cy=y0+(r+.5)*ch+(rnd()-.5)*ch*.18;
    const sz=Math.min(cw,ch)*(.30+rnd()*.12),alpha=.48+rnd()*.30;
    g.save();g.translate(cx,cy);g.rotate((rnd()-.5)*.12);g.globalAlpha=alpha;
    g.fillStyle=haloCols[(r*2+i)%haloCols.length];g.beginPath();g.ellipse(0,-sz*.10,sz*.92,sz*1.02,0,0,TAU);g.fill();
    g.strokeStyle='rgba(218,194,139,.48)';g.lineWidth=sz*.055;g.stroke();
    g.fillStyle=bodyCols[(r+i*3)%bodyCols.length];g.beginPath();g.moveTo(-sz*.60,sz*.88);g.quadraticCurveTo(0,sz*.05,sz*.60,sz*.88);g.lineTo(sz*.45,sz*1.12);g.lineTo(-sz*.45,sz*1.12);g.closePath();g.fill();
    g.fillStyle='#C8AD83';g.beginPath();g.ellipse(0,-sz*.22,sz*.24,sz*.30,0,0,TAU);g.fill();
    g.strokeStyle='rgba(55,45,37,.65)';g.lineWidth=sz*.04;g.beginPath();g.moveTo(-sz*.12,-sz*.24);g.lineTo(sz*.12,-sz*.24);g.stroke();
    g.restore();
  }

  /* 飞天与飘带以多次低透明笔触构成。 */
  for(let i=0;i<7;i++){
    const cx=(i+.55)/7*w+(rnd()-.5)*35,cy=h*(.105+rnd()*.055),sz=w*(.026+rnd()*.010);
    g.save();g.translate(cx,cy);g.rotate((rnd()-.5)*.7);g.globalAlpha=.58+rnd()*.18;
    g.fillStyle='#B9934E';g.beginPath();g.ellipse(0,0,sz*1.15,sz*.36,0,0,TAU);g.fill();
    g.fillStyle='#C7AA83';g.beginPath();g.arc(-sz*.82,-sz*.14,sz*.23,0,TAU);g.fill();
    g.strokeStyle='#9D5542';g.lineWidth=sz*.10;
    for(let q=0;q<3;q++){g.beginPath();g.moveTo(sz*.55,(-.14+q*.14)*sz);g.bezierCurveTo(sz*1.5,-sz*(.7-q*.2),sz*2.4,sz*(.35+q*.15),sz*3.2,sz*(.05+q*.15));g.stroke();}
    g.restore();
  }

  /* 颜料脱落、粉化、裂纹和积尘。 */
  g.globalCompositeOperation='source-over';
  for(let i=0;i<620;i++){
    const x=rnd()*w,y=rnd()*h,sz=2+rnd()*24;
    g.fillStyle=rnd()>.47?'rgba(168,151,119,.34)':'rgba(56,49,41,.25)';
    g.beginPath();g.ellipse(x,y,sz,sz*(.28+rnd()*.75),rnd()*TAU,0,TAU);g.fill();
  }
  g.strokeStyle='rgba(58,47,38,.34)';
  for(let i=0;i<52;i++){
    let x=rnd()*w,y=rnd()*h;g.lineWidth=.5+rnd()*1.3;g.beginPath();g.moveTo(x,y);
    for(let k=0;k<5+rnd()*7;k++){x+=(rnd()-.5)*34;y+=8+rnd()*26;g.lineTo(x,y);}g.stroke();
  }
  /* 全局微粒和色偏，用图像数据把矢量边缘打散。 */
  const img=g.getImageData(0,0,w,h),d=img.data;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4,n=fbm2(x/w*80,y/h*80,3,8.1),m=fbm2(x/w*6,y/h*6,4,3.3);
    const k=(n-.5)*15+(m-.5)*18;d[i]=clamp(d[i]+k*.92,0,255);d[i+1]=clamp(d[i+1]+k*.78,0,255);d[i+2]=clamp(d[i+2]+k*.58,0,255);
  }
  g.putImageData(img,0,0);
  return {map:toTex(c)};
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
  const c=makeCanvas(w,h),g=c.getContext('2d');
  const grad=g.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#7B8589');grad.addColorStop(.34,'#9CA19D');grad.addColorStop(.68,'#BCAF9A');grad.addColorStop(1,'#D0BA91');g.fillStyle=grad;g.fillRect(0,0,w,h);
  const img=g.getImageData(0,0,w,h),d=img.data;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const u=x/w,v=y/h;const cloud=smoothstep(.55,.84,fbm2(u*6,v*10,6,2.9))*smoothstep(.03,.42,v)*smoothstep(.97,.50,v);
    const dust=smoothstep(.48,1,v)*(.20+.32*fbm2(u*4,v*5,4,61));const grain=(fbm2(u*110,v*110,2,17)-.5)*5;
    const i=(y*w+x)*4;d[i]=clamp(lerp(d[i],229,cloud*.39+dust*.22)+grain,0,255);d[i+1]=clamp(lerp(d[i+1],220,cloud*.38+dust*.20)+grain*.8,0,255);d[i+2]=clamp(lerp(d[i+2],202,cloud*.35+dust*.17)+grain*.55,0,255);
  }g.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.mapping=THREE.EquirectangularReflectionMapping;return {map:t};
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
    ['mudMid', () => buildMud(256, { a: [0xA8, 0x94, 0x78], b: [0xCB, 0xB8, 0x9A] }, 80, 0.68)],
    ['mudFine', () => buildMud(256, { a: [0xC3, 0xAE, 0x92], b: [0xE0, 0xCE, 0xB4] }, 150, 0.38)],
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
