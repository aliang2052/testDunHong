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
  for (const key of ['title','ruler','q','arrow','hi','outline','shitai','mtl','end']) if (E[key]) setOp(E[key], 0);

  /* 只保留克制的尺度与结构提示；施工主体始终由3D几何表达。 */
  if (t >= 5.8 && t < 9.6) {
    const o = fadeWin(t, 5.8, 9.6, 0.35) * 0.78;
    setOp(E.ruler, o);
    const top = P(-7.2, 35.5, 4.2), bot = P(-7.2, 0.4, 4.2);
    const arm = Math.max(18, w * 0.018);
    E.rulerPath.setAttribute('d', `M ${top.x-arm} ${top.y} L ${top.x} ${top.y} L ${top.x} ${bot.y} M ${top.x-arm} ${bot.y} L ${top.x} ${bot.y}`);
    E.rulerText.textContent = '35.5 m';
    E.rulerText.setAttribute('font-size', Math.max(22, Math.min(36, w * 0.024)));
    E.rulerText.setAttribute('x', top.x - arm - Math.max(46, w * 0.034));
    E.rulerText.setAttribute('y', (top.y + bot.y) * 0.5);
  }

  /* Round6：拱顶完全由实时岩体、施工前沿和碎屑表达。
     旧红色整面填充会把洞腔压成示意图，故不再覆盖真实几何。 */

  /* 石胎轮廓由真实三维岩体与施工前沿表达，不叠加二维示意线。 */
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
  /* 取消漂浮在镜头前的巨型“讲解道具”。材料和工具统一在真实作业面中呈现。 */
  for (const key of ['mud','wheat','cotton','egg','trowel','chisel']) {
    if (PROPS[key]) PROPS[key].visible = false;
  }
}
