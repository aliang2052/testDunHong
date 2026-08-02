/* ============================================================
   80 - 2D 标注层（SVG）+ 3D 讲解道具
   ============================================================ */

const ANNO = { svg: null, layer: null, els: {}, cam: null, w: 0, h: 0 };

function initAnnotations(svg) {
  ANNO.svg = svg;
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };
  ANNO.mk = mk;

  /* 竖排标题：莫高窟第96窟大佛像 */
  const title = mk('g', { id: 'a-title', opacity: '0' });
  '莫高窟第96窟大佛像'.split('').forEach((ch, i) => {
    const t = mk('text', {
      x: 0, y: i * 46, 'font-size': 40, fill: '#FFD400',
      'font-weight': '900', 'text-anchor': 'middle',
      stroke: '#6B4A00', 'stroke-width': 1.6, 'paint-order': 'stroke',
      'font-family': '"Noto Serif SC","Songti SC",serif',
    });
    t.textContent = ch;
    title.appendChild(t);
  });
  svg.appendChild(title); ANNO.els.title = title;

  /* 尺度标尺（黄色 L 形 + 数值） */
  const ruler = mk('g', { id: 'a-ruler', opacity: '0' });
  ruler.appendChild(mk('path', { id: 'a-ruler-path', stroke: '#FFD400', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }));
  const rt = mk('text', {
    id: 'a-ruler-text', fill: '#FFD400', 'font-size': 46, 'font-weight': '900',
    stroke: '#6B4A00', 'stroke-width': 2, 'paint-order': 'stroke', 'text-anchor': 'middle',
    'font-family': 'system-ui,-apple-system,"PingFang SC",sans-serif',
  });
  ruler.appendChild(rt);
  svg.appendChild(ruler); ANNO.els.ruler = ruler; ANNO.els.rulerPath = ruler.querySelector('#a-ruler-path'); ANNO.els.rulerText = rt;

  /* 大问号 */
  const q = mk('text', {
    id: 'a-q', fill: '#FFFFFF', 'font-size': 220, 'font-weight': '900',
    'text-anchor': 'middle', opacity: '0', 'fill-opacity': '0.88',
    'font-family': 'system-ui,-apple-system,sans-serif',
  });
  q.textContent = '?';
  svg.appendChild(q); ANNO.els.q = q;

  /* 红色箭头 */
  const arrow = mk('g', { id: 'a-arrow', opacity: '0' });
  arrow.appendChild(mk('path', { id: 'a-arrow-path', fill: '#E01F1F' }));
  svg.appendChild(arrow); ANNO.els.arrow = arrow; ANNO.els.arrowPath = arrow.querySelector('#a-arrow-path');

  /* 红色高亮区（拱顶） */
  const hi = mk('path', { id: 'a-hi', fill: '#E01F1F', opacity: '0', 'fill-opacity': '0.82' });
  svg.appendChild(hi); ANNO.els.hi = hi;

  /* 石胎黄色手绘轮廓 */
  const out = mk('path', {
    id: 'a-outline', stroke: '#FFD400', 'stroke-width': 7, fill: 'none',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: '0',
  });
  svg.appendChild(out); ANNO.els.outline = out;

  /* 「石胎」竖排字 */
  const shitai = mk('g', { id: 'a-shitai', opacity: '0' });
  '石胎'.split('').forEach((ch, i) => {
    const t = mk('text', {
      x: 0, y: i * 60, 'font-size': 58, fill: '#FFD400', 'font-weight': '900',
      'text-anchor': 'middle', stroke: '#6B4A00', 'stroke-width': 2.4, 'paint-order': 'stroke',
      'font-family': '"Noto Serif SC","Songti SC",serif',
    });
    t.textContent = ch;
    shitai.appendChild(t);
  });
  svg.appendChild(shitai); ANNO.els.shitai = shitai;

  /* 材料名（河流沉淀土 / 麦秆 / 棉花 / 蛋清 米汁） */
  const mtl = mk('g', { id: 'a-mtl', opacity: '0' });
  svg.appendChild(mtl); ANNO.els.mtl = mtl;

  /* 片尾书法「敦煌莫高窟」 */
  const endt = mk('g', { id: 'a-end', opacity: '0' });
  '敦煌莫高窟'.split('').forEach((ch, i) => {
    const col = i < 2 ? 0 : 1;
    const row = i < 2 ? i : i - 2;
    const t = mk('text', {
      x: -col * 52, y: row * 58, 'font-size': 52, fill: '#2A1B10', 'font-weight': '900',
      'text-anchor': 'middle', 'font-family': '"Songti SC","STKaiti",serif',
    });
    t.textContent = ch;
    endt.appendChild(t);
  });
  svg.appendChild(endt); ANNO.els.end = endt;
}

/* 世界坐标 → 屏幕像素 */
const _pv = new THREE.Vector3();
function project(x, y, z, cam, w, h) {
  _pv.set(x, y, z).project(cam);
  return { x: (_pv.x * 0.5 + 0.5) * w, y: (-_pv.y * 0.5 + 0.5) * h, z: _pv.z };
}

function setOp(el, v) { el.setAttribute('opacity', String(clamp(v, 0, 1))); }
function fadeWin(t, a, b, f = 0.28) { return smoothstep(a, a + f, t) * smoothstep(b, b - f, t); }

/* 材料名文字（黄色描边字） */
function setMaterialLabel(text, x, y, size = 54) {
  const g = ANNO.els.mtl;
  if (g.dataset.txt !== text) {
    g.dataset.txt = text;
    while (g.firstChild) g.removeChild(g.firstChild);
    const parts = text.split(' ');
    parts.forEach((word, wi) => {
      word.split('').forEach((ch, i) => {
        const t = ANNO.mk('text', {
          x: (i * size * 1.02) + wi * size * 1.6, y: 0,
          'font-size': size, fill: '#FFD400', 'font-weight': '900',
          stroke: '#6B4A00', 'stroke-width': 2.4, 'paint-order': 'stroke',
          'font-family': '"Noto Serif SC","Songti SC",serif',
        });
        t.textContent = ch;
        g.appendChild(t);
      });
    });
    const total = text.replace(/ /g, '').length * size * 1.02 + (parts.length - 1) * size * 0.58;
    g.dataset.w = total;
  }
  g.setAttribute('transform', `translate(${x - (parseFloat(g.dataset.w) || 0) / 2},${y})`);
}

/* ------------------------------------------------------------
   每帧更新标注
   ------------------------------------------------------------ */
function updateAnnotations(t, cam, w, h) {
  const E = ANNO.els;
  const P = (x, y, z) => project(x, y, z, cam, w, h);

  /* 标题 2.8–5.6 */
  {
    const o = fadeWin(t, 2.9, 5.5, 0.35);
    setOp(E.title, o);
    if (o > 0) {
      const a = P(-9.5, 34.5, 3);
      E.title.setAttribute('transform', `translate(${a.x},${a.y})`);
    }
  }

  /* 35.5m 标尺 5.9–9.6 */
  {
    const o = fadeWin(t, 6.0, 9.5, 0.3);
    setOp(E.ruler, o);
    if (o > 0) {
      const top = P(-3.0, 35.5, 4.5), bot = P(-3.0, 0.2, 4.5);
      const k = clamp((t - 6.0) / 1.1, 0, 1);
      const yEnd = lerp(top.y, bot.y, easeOut(k));
      const arm = 46;
      E.rulerPath.setAttribute('d',
        `M ${top.x - arm} ${top.y} L ${top.x} ${top.y} L ${top.x} ${yEnd} M ${top.x - arm} ${bot.y} L ${top.x} ${bot.y}`);
      E.rulerText.textContent = t < 7.6 ? '35.5m' : '35.5m';
      E.rulerText.setAttribute('x', top.x - 96);
      E.rulerText.setAttribute('y', (top.y + bot.y) / 2);
    }
  }

  /* 大问号 18.0–19.4 */
  {
    const o = fadeWin(t, 18.0, 19.4, 0.25);
    setOp(E.q, o);
    if (o > 0) {
      const a = P(0, 30, 8);
      E.q.setAttribute('x', a.x); E.q.setAttribute('y', a.y);
    }
  }

  /* 红箭头 27.2–30.0：沿窟门水平向内 */
  {
    const o = fadeWin(t, 27.2, 30.0, 0.25);
    setOp(E.arrow, o);
    if (o > 0) {
      const k = (t - 27.2) % 1.2 / 1.2;
      const zTip = lerp(6, -6, k);
      const a = P(0, 34.6, zTip), b = P(0, 34.6, zTip + 9);
      const dx = b.x - a.x, dy = b.y - a.y;
      const L = Math.hypot(dx, dy) || 1;
      const ux = dx / L, uy = dy / L;
      const nx = -uy, ny = ux;
      const hw = 24, hl = 40, sw = 11;
      const d = `M ${a.x} ${a.y}
                 L ${a.x + ux * hl + nx * hw} ${a.y + uy * hl + ny * hw}
                 L ${a.x + ux * hl + nx * sw} ${a.y + uy * hl + ny * sw}
                 L ${b.x + nx * sw} ${b.y + ny * sw}
                 L ${b.x - nx * sw} ${b.y - ny * sw}
                 L ${a.x + ux * hl - nx * sw} ${a.y + uy * hl - ny * sw}
                 L ${a.x + ux * hl - nx * hw} ${a.y + uy * hl - ny * hw} Z`;
      E.arrowPath.setAttribute('d', d);
      setOp(E.arrow, o * (0.55 + 0.45 * Math.sin(t * 5) * 0.5 + 0.225));
    }
  }

  /* 拱顶红色高亮 34.2–36.8 */
  {
    const o = fadeWin(t, 34.2, 36.8, 0.3);
    setOp(E.hi, o);
    if (o > 0) {
      const pts = [];
      const N = 22;
      for (let i = 0; i <= N; i++) {
        const a = Math.PI * (i / N);
        const x = -Math.cos(a) * (CAVE.x1 - CAVE.x0) / 2;
        const y = CAVE.yArch + Math.sin(a) * (CAVE.yTop - CAVE.yArch);
        pts.push(P(x, y, CAVE.zBack + 1.5));
      }
      for (let i = N; i >= 0; i--) {
        const a = Math.PI * (i / N);
        const x = -Math.cos(a) * (CAVE.x1 - CAVE.x0) / 2;
        const y = CAVE.yArch + Math.sin(a) * (CAVE.yTop - CAVE.yArch);
        pts.push(P(x, y, CAVE.zFront - 1.0));
      }
      E.hi.setAttribute('d', 'M ' + pts.map(p => `${p.x} ${p.y}`).join(' L ') + ' Z');
    }
  }

  /* 石胎轮廓 + 文字 39.4–43.2 */
  {
    const o = fadeWin(t, 39.4, 43.2, 0.3);
    setOp(E.outline, o);
    if (o > 0) {
      const draw = clamp((t - 39.4) / 1.3, 0, 1);
      const pts = [];
      const yTopO = 35.6;
      const yBotO = clamp((typeof CARVE !== 'undefined' ? CARVE.y : 19) - 0.8, 18.0, 31.5);
      const N = 26;
      // 右半（+X 侧）自下而上
      for (let i = 0; i <= N; i++) {
        const y = lerp(yBotO, yTopO, i / N);
        pts.push([ENV_RX(y) * 0.62, y, ENV_RZ(y) * 0.72]);
      }
      // 顶部绕过
      for (let i = 0; i <= 10; i++) {
        const a = (i / 10) * Math.PI;
        pts.push([Math.cos(a) * ENV_RX(35.2) * 0.62, 35.55 + Math.sin(a) * 0.9, ENV_RZ(35.2) * 0.5]);
      }
      // 左半自上而下
      for (let i = N; i >= 0; i--) {
        const y = lerp(yBotO, yTopO, i / N);
        pts.push([-ENV_RX(y) * 0.62, y, ENV_RZ(y) * 0.72]);
      }
      const total = pts.length;
      const cut = Math.max(2, Math.round(total * draw));
      const sp = pts.slice(0, cut).map(([x, y, z]) => {
        const p = P(x, y, z);
        // 手绘抖动
        const j = (hash3(Math.round(x * 10), Math.round(y * 10), 7) - 0.5) * 5;
        return `${p.x + j} ${p.y + j}`;
      });
      E.outline.setAttribute('d', 'M ' + sp.join(' L '));
    }
    const o2 = fadeWin(t, 41.3, 43.2, 0.28);
    setOp(E.shitai, o2);
    if (o2 > 0) {
      const a = P(7.2, 31.6, 3.5);
      E.shitai.setAttribute('transform', `translate(${a.x},${a.y})`);
    }
  }

  /* 8.4m / 35.5m 佛窟尺度 51.4–56.0 */
  if (t >= 51.2 && t < 56.1) {
    const o = fadeWin(t, 51.4, 56.0, 0.3);
    setOp(E.ruler, o);
    if (o > 0) {
      const isFirst = t < 53.4;
      const yTopR = isFirst ? 8.4 : 35.5;
      const top = P(-13.0, yTopR, 8.5), bot = P(-13.0, 0.1, 8.5);
      const arm = 40;
      E.rulerPath.setAttribute('d',
        `M ${top.x - arm} ${top.y} L ${top.x} ${top.y} L ${top.x} ${bot.y} M ${top.x - arm} ${bot.y} L ${top.x} ${bot.y}`);
      E.rulerText.textContent = isFirst ? '8.4m' : '35.5m';
      E.rulerText.setAttribute('x', top.x - 92);
      E.rulerText.setAttribute('y', (top.y + bot.y) / 2);
    }
  }

  /* 材料名 */
  {
    let label = '', anchor = null, o = 0;
    if (t >= 67.0 && t < 68.6) { label = '河流沉淀土'; o = fadeWin(t, 67.0, 68.6, 0.25); anchor = [-1.0, 27.4, 6]; }
    else if (t >= 68.6 && t < 72.0) { label = '麦秆'; o = fadeWin(t, 68.7, 72.0, 0.25); anchor = [-1.2, 27.2, 6]; }
    else if (t >= 78.4 && t < 80.4) { label = '棉花'; o = fadeWin(t, 78.5, 80.3, 0.25); anchor = [-1.0, 28.6, 6]; }
    else if (t >= 83.4 && t < 85.4) { label = '蛋清 米汁'; o = fadeWin(t, 83.5, 85.3, 0.25); anchor = [-1.0, 29.6, 6]; }
    setOp(E.mtl, o);
    if (o > 0 && anchor) {
      const a = P(anchor[0], anchor[1], anchor[2]);
      setMaterialLabel(label, a.x, a.y, 54);
    }
  }

  /* 片尾书法 111.6– */
  {
    const o = fadeWin(t, 111.6, DURATION, 0.5);
    setOp(E.end, o);
    if (o > 0) {
      const a = P(-58, 52, 40);
      E.end.setAttribute('transform', `translate(${a.x},${a.y})`);
    }
  }
}

/* ============================================================
   3D 讲解道具：泥球 / 麦秆 / 棉花 / 蛋+米汁 / 塑刀 / 凿子
   ============================================================ */
const PROPS = {};

function buildProps(scene) {
  const G = new THREE.Group();
  scene.add(G);
  PROPS.group = G;

  /* 泥球（河流沉淀土） */
  {
    const g = new THREE.SphereGeometry(1, 20, 16);
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      const n = fbm3(x * 1.6 + 3, y * 1.6, z * 1.6, 3);
      const s = 1 + (n - 0.5) * 0.42;
      pa.setXYZ(i, x * s * 1.16, y * s * 0.80, z * s);
    }
    pa.needsUpdate = true; g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      map: TEX.mudCoarse.map, normalMap: TEX.mudCoarse.normal, roughness: 0.95,
      color: 0x8B6E4E,
    }));
    m.castShadow = true;
    PROPS.mud = m; G.add(m); m.visible = false;
  }

  /* 麦秆（两三根金色细杆） */
  {
    const grp = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xD9A93C, roughness: 0.7 });
    for (let i = 0; i < 3; i++) {
      const g = new THREE.CylinderGeometry(0.035, 0.045, 3.4, 6);
      const m = new THREE.Mesh(g, mat);
      m.position.set((i - 1) * 0.12, 0, (i - 1) * 0.06);
      m.rotation.z = 0.62 + i * 0.045;
      grp.add(m);
      // 麦穗
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.62, 6), mat);
      s.position.set(m.position.x + 1.0, 1.42, m.position.z);
      s.rotation.z = 0.62;
      grp.add(s);
    }
    PROPS.wheat = grp; G.add(grp); grp.visible = false;
  }

  /* 棉花（白色团簇） */
  {
    const grp = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xF6F3EC, roughness: 0.98 });
    const rnd = mulberry32(17);
    for (let i = 0; i < 6; i++) {
      const r = 0.42 + rnd() * 0.30;
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), mat);
      const a = (i / 6) * TAU;
      s.position.set(Math.cos(a) * 0.46, Math.sin(a) * 0.40, (rnd() - 0.5) * 0.4);
      if (i === 5) s.position.set(0, 0, 0.1);
      grp.add(s);
    }
    PROPS.cotton = grp; G.add(grp); grp.visible = false;
  }

  /* 蛋清 + 米汁 */
  {
    const grp = new THREE.Group();
    // 蛋清（半透明摊开）
    const wMat = new THREE.MeshStandardMaterial({
      color: 0xF2F0DC, roughness: 0.15, metalness: 0.0,
      transparent: true, opacity: 0.72,
    });
    const eg = new THREE.SphereGeometry(0.62, 18, 12);
    eg.scale(1.7, 0.30, 1.15);
    const em = new THREE.Mesh(eg, wMat);
    em.position.set(-0.85, 0, 0);
    grp.add(em);
    const yolk = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xE8C24A, roughness: 0.35 }));
    yolk.scale.set(1, 0.62, 1);
    yolk.position.set(-0.85, 0.10, 0);
    grp.add(yolk);
    // 米汁（乳白球）
    const rm = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 16),
      new THREE.MeshStandardMaterial({ color: 0xF4EFD8, roughness: 0.25 }));
    rm.position.set(0.85, 0, 0);
    grp.add(rm);
    PROPS.egg = grp; G.add(grp); grp.visible = false;
  }

  /* 塑刀（抹子） */
  {
    const grp = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0xC8CCD2, roughness: 0.28, metalness: 0.85 });
    const wood = new THREE.MeshStandardMaterial({ map: TEX.wood.map, roughness: 0.85 });
    const bg = new THREE.BoxGeometry(2.7, 0.16, 1.75);
    const b = new THREE.Mesh(bg, steel);
    // 前端削尖
    const pa = bg.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      if (pa.getX(i) > 0) pa.setZ(i, pa.getZ(i) * 0.42);
    }
    pa.needsUpdate = true; bg.computeVertexNormals();
    grp.add(b);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.26, 1.15, 10), wood);
    h.rotation.z = Math.PI / 2;
    h.position.set(-1.72, 0.22, 0);
    grp.add(h);
    grp.traverse(o => { if (o.isMesh) o.castShadow = true; });
    PROPS.trowel = grp; G.add(grp); grp.visible = false;
  }

  /* 凿子（开凿阶段的暗示） */
  {
    const grp = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0x9AA0A8, roughness: 0.4, metalness: 0.7 });
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.16, 2.2, 8), steel);
    grp.add(c);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 8), steel);
    tip.position.y = -1.3; tip.rotation.x = Math.PI;
    grp.add(tip);
    PROPS.chisel = grp; G.add(grp); grp.visible = false;
  }
}

/* 把道具摆到相机前（HUD 式），面向相机 */
const _propV = new THREE.Vector3(), _propF = new THREE.Vector3(), _propR = new THREE.Vector3(), _propU = new THREE.Vector3();
function placeProp(obj, cam, right, up, dist, scale, spin = 0) {
  cam.getWorldDirection(_propF);
  _propR.crossVectors(_propF, cam.up).normalize();
  _propU.crossVectors(_propR, _propF).normalize();
  _propV.copy(cam.position)
    .addScaledVector(_propF, dist)
    .addScaledVector(_propR, right * dist)
    .addScaledVector(_propU, up * dist);
  obj.position.copy(_propV);
  obj.quaternion.copy(cam.quaternion);
  if (spin) obj.rotateY(spin);
  obj.scale.setScalar(scale * dist);
}

function updateProps(t, cam) {
  const show = (o, on) => { if (o) o.visible = on; };
  show(PROPS.mud, false); show(PROPS.wheat, false); show(PROPS.cotton, false);
  show(PROPS.egg, false); show(PROPS.trowel, false); show(PROPS.chisel, false);

  if (t >= 66.9 && t < 68.7) {
    show(PROPS.mud, true);
    placeProp(PROPS.mud, cam, 0.115, -0.075, 6.5, 0.082, t * 0.5);
  } else if (t >= 68.5 && t < 72.0) {
    show(PROPS.mud, true);
    placeProp(PROPS.mud, cam, 0.115, -0.075, 6.5, 0.082, t * 0.5);
    show(PROPS.wheat, true);
    placeProp(PROPS.wheat, cam, 0.075, 0.020, 6.2, 0.030, 0);
  } else if (t >= 78.4 && t < 80.4) {
    show(PROPS.cotton, true);
    placeProp(PROPS.cotton, cam, 0.115, -0.055, 5.6, 0.095, t * 0.4);
  } else if (t >= 83.4 && t < 85.4) {
    show(PROPS.egg, true);
    placeProp(PROPS.egg, cam, 0.125, -0.060, 6.0, 0.088, 0);
  } else if (t >= 85.4 && t < 87.6) {
    show(PROPS.trowel, true);
    const sw = Math.sin(t * 2.6);
    placeProp(PROPS.trowel, cam, 0.105 + sw * 0.060, -0.045 + Math.cos(t * 2.6) * 0.050, 8.2, 0.050, 0);
    PROPS.trowel.rotateX(-1.16);          // 展示刀面而不是刀刃
    PROPS.trowel.rotateY(-0.42 + sw * 0.22);
  }
}
