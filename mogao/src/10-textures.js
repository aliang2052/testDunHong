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
  const shadow=[0x78,0x63,0x4C],base=[0xB8,0x98,0x70],sun=[0xE1,0xC6,0x9B],cool=[0x8E,0x8B,0x82];
  const r=bake(size,(u,v)=>{
    /* 以竖向风蚀和不规则块面为主，压低会造成“木纹板”的连续横带。 */
    const macro=fbm2(u*2.7,v*3.1,5,3.7);
    const warp=(fbm2(u*4.4,v*3.6,4,17.2)-.5)*1.15;
    const flute=ridge2(u*11.0+warp,v*.82,5,7.3);
    const narrow=ridge2(u*31.0+warp*2.1,v*.46,4,31.3);
    const blocks=fbm2(u*7.2+warp*.25,v*8.4,4,29.1);
    const pits=worley2(u*13.0+warp*.4,v*14.0,57);
    const pocket=smoothstep(.23,.035,pits.f2-pits.f1);
    const grain=fbm2(u*170,v*170,3,5.8);
    const faintBed=fbm2(u*1.2+warp*.08,v*4.0,3,11.1);
    /* 裂隙由崖体几何和独立细线承担；纹理不再生成铺满全场的多边形龟裂。 */
    const mineralVein=smoothstep(.74,.94,fbm2(u*6.0+warp*.35,v*7.2,4,43.0));
    const t=clamp(macro*.40+flute*.20+narrow*.07+blocks*.16+pocket*.08+grain*.06+faintBed*.03,0,1);
    let col=[lerp(base[0],sun[0],t),lerp(base[1],sun[1],t),lerp(base[2],sun[2],t)];
    const mineral=smoothstep(.70,.92,fbm2(u*4.0,v*4.5,4,71))*.20;
    col=[lerp(col[0],cool[0],mineral),lerp(col[1],cool[1],mineral),lerp(col[2],cool[2],mineral)];
    const shade=clamp((1-flute)*.065+(1-blocks)*.055+pocket*.085+mineralVein*.045,0,.28);
    col=[lerp(col[0],shadow[0],shade),lerp(col[1],shadow[1],shade),lerp(col[2],shadow[2],shade)];
    const h=clamp(.16+macro*.25+flute*.24+narrow*.08+blocks*.14+pocket*.10+grain*.07,0,1);
    return [col[0],col[1],col[2],h];
  });
  return {map:toTex(r.canvas),normal:toDataTex(normalFromHeight(r.heights,size,2.85)),raw:r};
}

/* ------------------------------------------------------------
   洞窟内壁 —— 开凿出的平滑土棕面
   ------------------------------------------------------------ */
function buildCaveWall(size = 512) {
  const a=[0x78,0x5F,0x48],b=[0xB2,0x90,0x6B],dust=[0xC7,0xAA,0x82];
  const r=bake(size,(u,v)=>{
    const macro=fbm2(u*4.1,v*4.0,5,7.7);
    const chop=ridge2(u*12.5,v*28.0,4,2.2);
    const soot=smoothstep(.72,.94,fbm2(u*3.2,v*3.6,4,63));
    const grain=fbm2(u*130,v*130,3,9.1);
    const t=clamp(macro*.52+grain*.18+chop*.30,0,1);
    let col=[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
    col=[lerp(col[0],dust[0],grain*.10),lerp(col[1],dust[1],grain*.10),lerp(col[2],dust[2],grain*.10)];
    col=col.map((c,i)=>lerp(c,[0x55,0x48,0x3D][i],soot*.24));
    return [col[0],col[1],col[2],clamp(macro*.25+chop*.54+grain*.17,0,1)];
  });
  return {map:toTex(r.canvas),normal:toDataTex(normalFromHeight(r.heights,size,2.4))};
}

/* ------------------------------------------------------------
   石胎岩石 —— 黄褐砂岩 + 明显灰斑与凿面
   ------------------------------------------------------------ */
function buildRockCore(size = 512) {
  const a=[0x92,0x74,0x50],b=[0xCE,0xAC,0x7A],grey=[0x83,0x80,0x78];
  const r=bake(size,(u,v)=>{
    const macro=fbm2(u*5.0,v*5.0,5,23.3);
    const w=worley2(u*10.5,v*10.5,5);
    const facet=smoothstep(.30,.025,w.f2-w.f1);
    const grain=fbm2(u*140,v*140,3,3.3);
    const chisel=ridge2(u*18,v*27,3,91);
    const t=clamp(macro*.55+grain*.18+facet*.15+chisel*.12,0,1);
    let col=[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
    const gm=smoothstep(.64,.88,fbm2(u*3.7,v*3.5,4,61))*.36;
    col=[lerp(col[0],grey[0],gm),lerp(col[1],grey[1],gm),lerp(col[2],grey[2],gm)];
    return [col[0],col[1],col[2],clamp(macro*.28+facet*.37+grain*.17+chisel*.25,0,1)];
  });
  return {map:toTex(r.canvas),normal:toDataTex(normalFromHeight(r.heights,size,3.8))};
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
  const c=makeCanvas(size,size),g=c.getContext('2d');
  g.fillStyle='#858A8C';g.fillRect(0,0,size,size);
  const rows=14,cols=7,hh=size/rows,ww=size/cols,rnd=mulberry32(619);
  for(let r=0;r<rows;r++){
    const offset=(r%2)*ww*.5;
    for(let i=-1;i<cols+1;i++){
      const x=i*ww+offset,y=r*hh;
      const n=rnd()-.5;
      g.fillStyle=`rgb(${Math.round(134+n*15)},${Math.round(137+n*14)},${Math.round(137+n*13)})`;
      g.fillRect(x+1.4,y+1.4,ww-2.8,hh-2.8);
      g.strokeStyle='rgba(48,52,54,.35)';g.lineWidth=1.4;g.strokeRect(x+1.2,y+1.2,ww-2.4,hh-2.4);
    }
  }
  const img=g.getImageData(0,0,size,size),d=img.data,heights=new Float32Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,n=fbm2(x/size*70,y/size*70,3,13),m=fbm2(x/size*7,y/size*7,3,29);
    const k=(n-.5)*11+(m-.5)*7;d[i]=clamp(d[i]+k,0,255);d[i+1]=clamp(d[i+1]+k,0,255);d[i+2]=clamp(d[i+2]+k*.95,0,255);heights[y*size+x]=.5+(n-.5)*.18;
  }
  g.putImageData(img,0,0);
  return {map:toTex(c),normal:toDataTex(normalFromHeight(heights,size,1.35))};
}

/* ------------------------------------------------------------
   壁画（洞窟四壁，参考 t107）—— 千佛 + 飞天 + 卷草边饰
   ------------------------------------------------------------ */
function buildMural(w = 1024, h = 1024) {
  const c=makeCanvas(w,h),g=c.getContext('2d'),rnd=mulberry32(2307);
  g.fillStyle='#7A7058';g.fillRect(0,0,w,h);
  if(ROUND6_MURAL_IMAGE){
    /* 同一来源做镜像拼接与轻微错位，避免单张无透视贴板。 */
    const crop=Math.min(ROUND6_MURAL_IMAGE.width,ROUND6_MURAL_IMAGE.height);
    const sx=(ROUND6_MURAL_IMAGE.width-crop)*.5,sy=(ROUND6_MURAL_IMAGE.height-crop)*.5;
    g.globalAlpha=.94;
    g.drawImage(ROUND6_MURAL_IMAGE,sx,sy,crop,crop,0,0,w*.52,h);
    g.save();g.translate(w,0);g.scale(-1,1);g.drawImage(ROUND6_MURAL_IMAGE,sx,sy,crop,crop,0,0,w*.52,h);g.restore();
    g.globalAlpha=1;
  }
  /* 矿物颜料不均匀、烟熏、粉化、裂纹和剥落。 */
  for(let i=0;i<560;i++){
    const x=rnd()*w,y=rnd()*h,rx=3+rnd()*28,ry=2+rnd()*20;
    g.fillStyle=rnd()>.52?'rgba(192,173,137,.12)':'rgba(58,49,40,.11)';
    g.beginPath();g.ellipse(x,y,rx,ry,rnd()*TAU,0,TAU);g.fill();
  }
  g.strokeStyle='rgba(48,39,32,.31)';
  for(let i=0;i<62;i++){
    let x=rnd()*w,y=rnd()*h;g.lineWidth=.45+rnd()*1.2;g.beginPath();g.moveTo(x,y);
    for(let k=0;k<4+rnd()*8;k++){x+=(rnd()-.5)*29;y+=6+rnd()*22;g.lineTo(x,y);}g.stroke();
  }
  const img=g.getImageData(0,0,w,h),d=img.data,heights=new Float32Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4,n=fbm2(x/w*82,y/h*82,3,8.1),m=fbm2(x/w*6,y/h*6,4,3.3);
    const k=(n-.5)*13+(m-.5)*12;d[i]=clamp(d[i]+k*.86,0,255);d[i+1]=clamp(d[i+1]+k*.72,0,255);d[i+2]=clamp(d[i+2]+k*.52,0,255);heights[y*w+x]=clamp(.48+(n-.5)*.24+(m-.5)*.12,0,1);
  }
  g.putImageData(img,0,0);
  return {map:toTex(c),normal:toDataTex(normalFromHeight(heights,w,1.35))};
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
  const grad=g.createLinearGradient(0,0,0,h);
  grad.addColorStop(0,'#7899A2');grad.addColorStop(.35,'#9FB0AA');grad.addColorStop(.70,'#C8BFA9');grad.addColorStop(1,'#D7B887');
  g.fillStyle=grad;g.fillRect(0,0,w,h);
  const img=g.getImageData(0,0,w,h),d=img.data;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const u=x/w,v=y/h;const cloud=smoothstep(.57,.84,fbm2(u*6,v*10,6,2.9))*smoothstep(.03,.42,v)*smoothstep(.96,.50,v);
    const dust=smoothstep(.58,1,v)*(.12+.20*fbm2(u*4,v*5,4,61));const grain=(fbm2(u*110,v*110,2,17)-.5)*3;
    const i=(y*w+x)*4;d[i]=clamp(lerp(d[i],242,cloud*.42+dust*.20)+grain,0,255);d[i+1]=clamp(lerp(d[i+1],244,cloud*.42+dust*.16)+grain*.8,0,255);d[i+2]=clamp(lerp(d[i+2],235,cloud*.40+dust*.10)+grain*.55,0,255);
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

/* 螺发彩绘：细密重叠的浅浮雕卷纹，替代棋盘状球珠。 */
function buildHairTexture(size = 384) {
  const c=makeCanvas(size,size),g=c.getContext('2d');
  g.fillStyle='#241F1C';g.fillRect(0,0,size,size);
  const h=new Float32Array(size*size);
  const cell=size/18;
  for(let row=-1;row<20;row++){
    for(let col=-1;col<20;col++){
      const cx=(col+.5+(row&1)*.5)*cell,cy=(row+.56)*cell;
      const rr=cell*.42;
      const grad=g.createRadialGradient(cx-rr*.18,cy-rr*.22,rr*.04,cx,cy,rr);
      grad.addColorStop(0,'#5B514A');grad.addColorStop(.42,'#37302B');grad.addColorStop(1,'#171411');
      g.fillStyle=grad;g.beginPath();g.arc(cx,cy,rr,0,TAU);g.fill();
      g.strokeStyle='rgba(150,132,116,.38)';g.lineWidth=Math.max(1,size/260);
      g.beginPath();g.arc(cx,cy,rr*.58,.25,TAU*1.05);g.stroke();
    }
  }
  const img=g.getImageData(0,0,size,size),d=img.data;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const row=Math.floor(y/cell),shift=(row&1)*.5*cell;
    const cx=(Math.floor((x-shift)/cell)+.5)*cell+shift,cy=(row+.56)*cell;
    const dx=(x-cx)/(cell*.43),dy=(y-cy)/(cell*.43),r=Math.sqrt(dx*dx+dy*dy);
    h[y*size+x]=clamp(1-r,0,1)*.88+fbm2(x/size*70,y/size*70,2,19)*.08;
    const i=(y*size+x)*4,age=smoothstep(.69,.94,fbm2(x/size*6,y/size*6,3,72));
    d[i]=lerp(d[i],0x16,age*.22);d[i+1]=lerp(d[i+1],0x14,age*.22);d[i+2]=lerp(d[i+2],0x12,age*.22);
  }
  g.putImageData(img,0,0);
  return {map:toTex(c),normal:toDataTex(normalFromHeight(h,size,2.7))};
}

/* 沙丘顶（崖顶戈壁） */
function buildDune(size = 512) {
  const r=bake(size,(u,v)=>{
    const dunes=fbm2(u*3.4,v*3.4,5,4.4),streak=fbm2(u*2.0,v*34,4,8.2),grain=fbm2(u*120,v*120,2,1.1);
    const t=clamp(dunes*.50+streak*.32+grain*.18,0,1);
    return [lerp(0xA8,0xD0,t),lerp(0x86,0xB2,t),lerp(0x62,0x86,t),clamp(dunes*.55+streak*.32+grain*.13,0,1)];
  });
  return {map:toTex(r.canvas),normal:toDataTex(normalFromHeight(r.heights,size,1.7))};
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
    ['hair', () => buildHairTexture(384)],
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
  return loadRound6MuralSource().then(()=>new Promise((resolve) => {
    let i = 0;
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
  }));
}
