/* ============================================================
   40 - 大佛组装：衣层 / 头面 / 螺发 / 手臂 / 手 / 脚 / 头光
   ============================================================ */

const H = BUDDHA_H;
const yv = (y) => y / H;          // 米 -> v 参数

/* mask 工具：平滑带 */
function sband(x, a, b, f) { return smoothstep(a - f, a + f, x) * smoothstep(b + f, b - f, x); }
/* u 的周期最近距离 */
function ucyc(u, c) { let d = u - c; while (d > 0.5) d -= 1; while (d < -0.5) d += 1; return d; }

const BUDDHA = {
  group: null,
  parts: {},
  haloMats: [],
  detailMats: [],   // 眉眼唇等，随上色淡入
};

function buildBuddha() {
  const G = new THREE.Group();
  BUDDHA.group = G;

  /* ---------------- 材质 ---------------- */
  const matSkin = makeStageMaterial({
    finalMap: TEX.skin.map, finalTint: new THREE.Color(0.955, 0.855, 0.715), finalScale: [1/7, 1/7], mudScale: [1/2.4, 1/2.4], rockScale: [1/3.6, 1/3.6],
    roughSet: [1.0, 0.97, 0.94, 0.86, 0.72, 0.52, 0.46], normalScale: 1.0,
  });
  const matRobe = makeStageMaterial({
    finalMap: TEX.robeRed.map, finalScale: [1/5, 1/5], mudScale: [1/2.4, 1/2.4], rockScale: [1/3.6, 1/3.6],
    roughSet: [1.0, 0.97, 0.94, 0.88, 0.76, 0.60, 0.68], normalScale: 1.1,
  });
  const matRobeLower = makeStageMaterial({
    finalMap: TEX.robeRed.map, finalScale: [1/6, 1/6], mudScale: [1/2.8, 1/2.8], rockScale: [1/4.0, 1/4.0],
    roughSet: [1.0, 0.97, 0.94, 0.88, 0.76, 0.60, 0.68], normalScale: 1.1,
  });
  const matInner = makeStageMaterial({
    finalMap: TEX.innerBlue.map, finalScale: [1/8.5, 1/8.5], mudScale: [1/2.4, 1/2.4], rockScale: [1/3.6, 1/3.6],
    roughSet: [1.0, 0.97, 0.94, 0.88, 0.76, 0.60, 0.70], normalScale: 1.0,
  });
  const matSash = makeStageMaterial({
    finalMap: TEX.sash.map, finalScale: [1/8, 1/8], mudScale: [1/2.4, 1/2.4], rockScale: [1/3.6, 1/3.6],
    roughSet: [1.0, 0.97, 0.94, 0.88, 0.76, 0.60, 0.70], normalScale: 1.0,
  });
  const matBelt = makeStageMaterial({
    finalMap: TEX.skin.map, finalScale: [1/5, 1/5],
    finalTint: new THREE.Color(0.072, 0.192, 0.330),
    mudScale: [1/2.4, 1/2.4], rockScale: [1/3.6, 1/3.6], roughSet: [1.0, 0.97, 0.94, 0.88, 0.76, 0.60, 0.70],
  });
  const matHair = makeStageMaterial({
    finalMap: TEX.skin.map, finalScale: [1/1.2, 1/1.2],
    finalTint: new THREE.Color(0.052, 0.048, 0.052),
    mudScale: [1/1.4, 1/1.4], rockScale: [1/1.6, 1/1.6],
    roughSet: [1.0, 0.97, 0.94, 0.86, 0.72, 0.55, 0.78], normalScale: 0.4,
  });
  BUDDHA.parts.mats = { matSkin, matRobe, matRobeLower, matInner, matSash, matBelt, matHair };

  /* ---------------- 1. 下身：赭红大裙 ---------------- */
  const gLower = buildLayerGeometry({
    uSeg: 200, vSeg: 200, v0: 0, v1: yv(20.4),
    offset: 0.16, uvScale: [1, 1],
  });
  const mLower = new THREE.Mesh(gLower, matRobeLower);
  mLower.castShadow = mLower.receiveShadow = true;
  G.add(mLower); BUDDHA.parts.lower = mLower;

  /* ---------------- 2. 躯干皮肤（胸口裸露部分） ---------------- */
  const gTorso = buildLayerGeometry({
    uSeg: 176, vSeg: 120, v0: yv(19.0), v1: yv(30.6),
    offset: 0.0, uvScale: [1, 1],
  });
  const mTorso = new THREE.Mesh(gTorso, matSkin);
  mTorso.castShadow = mTorso.receiveShadow = true;
  G.add(mTorso); BUDDHA.parts.torso = mTorso;

  /* ---------------- 3. 头 ---------------- */
  const gHead = buildLayerGeometry({
    uSeg: 176, vSeg: 130, v0: yv(29.2), v1: 1.0,
    offset: 0.0, uvScale: [1, 1],
  });
  const mHead = new THREE.Mesh(gHead, matSkin);
  mHead.castShadow = mHead.receiveShadow = true;
  G.add(mHead); BUDDHA.parts.head = mHead;

  /* ---------------- 4. 内衣（孔雀蓝，覆佛之右肩/右臂/左下摆） ---------------- */
  const gInner = buildLayerGeometry({
    uSeg: 300, vSeg: 240, v0: yv(6.0), v1: yv(29.6),
    offset: 0.20, uvScale: [1, 1],
    mask: (u, v) => {
      const y = v * H;
      // 右肩→右臂：u 在 0.55~1.02（-X 半侧绕到正前）
      const vvI = clamp((y - 18.0) / (29.6 - 18.0), 0, 1);
      const edgeI = lerp(0.055, 0.205, smoothstep(0.25, 0.95, vvI));
      const du = ucyc(u, 0.78);
      let m = sband(du, -0.245, edgeI, 0.048);
      // 高处覆盖到肩，低处只保留侧后方
      const vLim = smoothstep(-0.24, 0.16, du) * 0.0;
      let hi = smoothstep(30.1, 29.2, y);
      let lo = 1.0;
      if (y < 20.0) {
        // 下部只在偏后侧保留（裙内衬）
        lo = smoothstep(0.02, -0.14, du) * smoothstep(4.0, 8.0, y);
      }
      return clamp(m * hi * lo, 0, 1);
    },
  });
  const mInner = new THREE.Mesh(gInner, matInner);
  mInner.castShadow = mInner.receiveShadow = true;
  G.add(mInner); BUDDHA.parts.inner = mInner;

  /* ---------------- 5. 斜披（土黄 + 绿菱纹），左肩高、右腰低 ---------------- */
  const gSash = buildLayerGeometry({
    uSeg: 380, vSeg: 300, v0: yv(18.0), v1: yv(29.6),
    offset: 0.32, uvScale: [1, 1],
    mask: (u, v) => {
      const du = ucyc(u, 0.055);              // 以正前略偏 +X 为中心
      const s = clamp((du + 0.205) / 0.43, 0, 1);   // 0 = -X 端, 1 = +X 端
      const vHi = 0.6820 + s * 0.1350;
      const vLo = 0.5720 + s * 0.1220;
      const f = 0.0225;
      const inV = smoothstep(vLo - f, vLo + f, v) * smoothstep(vHi + f, vHi - f, v);
      const inU = sband(du, -0.205, 0.225, 0.042);
      return clamp(inV * inU, 0, 1);
    },
  });
  const mSash = new THREE.Mesh(gSash, matSash);
  mSash.castShadow = mSash.receiveShadow = true;
  G.add(mSash); BUDDHA.parts.sash = mSash;

  /* ---------------- 6. 袈裟外披（赭红，覆佛之左肩/左臂/绕背） ---------------- */
  const gRobe = buildLayerGeometry({
    uSeg: 300, vSeg: 230, v0: yv(15.0), v1: yv(29.7),
    offset: 0.50, uvScale: [1, 1],
    mask: (u, v) => {
      const y = v * H;
      const du = ucyc(u, 0.34);
      /* 正面开口边：腹部完全包住（edge 大），到胸/肩逐步让位给斜披与裸胸 */
      const edgeU = lerp(0.195, 0.000, smoothstep(23.2, 26.8, y));
      const m = sband(du, -(0.190 + edgeU), 0.285, 0.055);
      const hi = smoothstep(30.2, 29.2, y);
      return clamp(m * hi, 0, 1);
    },
  });
  const mRobe = new THREE.Mesh(gRobe, matRobe);
  mRobe.castShadow = mRobe.receiveShadow = true;
  G.add(mRobe); BUDDHA.parts.robe = mRobe;

  /* ---------------- 7. 腰带（深蓝横带 + 红边） ---------------- */
  const gBelt = buildLayerGeometry({
    uSeg: 240, vSeg: 34, v0: yv(17.4), v1: yv(19.7),
    offset: 0.40, uvScale: [1, 1],
    mask: (u, v) => {
      const du = ucyc(u, 0.0);
      const y = v * H;
      return sband(du, -0.225, 0.225, 0.03) * sband(y, 17.92, 19.14, 0.14);
    },
  });
  const mBelt = new THREE.Mesh(gBelt, matBelt);
  G.add(mBelt); BUDDHA.parts.belt = mBelt;

  /* ---------------- 8. 螺发 ---------------- */
  buildHair(G, matHair);

  /* ---------------- 9. 五官 ---------------- */
  buildFace(G);

  /* ---------------- 10. 手臂与手 ---------------- */
  buildArms(G, matSkin, matInner, matRobe);

  /* ---------------- 11. 双脚 ---------------- */
  buildFeet(G, matSkin);

  /* ---------------- 12. 耳 ---------------- */
  buildEars(G, matSkin);

  /* ---------------- 13. 头光（上色阶段淡入） ---------------- */
  buildHalo3D(G);

  G.position.set(0, 0, 0);
  return G;
}

/* ------------------------------------------------------------
   螺发：沿头皮球面排布的小球（InstancedMesh）
   ------------------------------------------------------------ */
function buildHair(G, mat) {
  const beads = [];
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  /* 发际线（米）：正面 33.58、侧面 32.55、后脑 30.55 —— 依 t8 实测 */
  const rows = 34;
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    const y = lerp(30.45, 35.46, Math.pow(t, 0.94));
    const v = yv(y);
    const ringR = PROF_RX(y);
    const cols = Math.max(6, Math.round(TAU * ringR / 0.265));
    for (let c = 0; c < cols; c++) {
      const u = (c + (r % 2) * 0.5) / cols;
      const du = ucyc(u, 0.0);
      const frontness = Math.cos(du * TAU) * 0.5 + 0.5;   // 1 = 正前
      const hairline = lerp(30.60, 33.58, Math.pow(frontness, 0.25));
      if (y < hairline) continue;
      bodyPoint(u, v, P);
      bodyNormal(u, v, N);
      const jitter = (hash3(r * 13, c * 7, 3) - 0.5) * 0.04;
      P.addScaledVector(N, 0.108 + jitter);
      beads.push({ p: P.clone(), n: N.clone(), s: 0.163 + hash3(c, r, 9) * 0.034 });
    }
  }
  const bg = new THREE.SphereGeometry(1, 10, 8);
  scaleUV(bg, 0.6);
  const inst = new THREE.InstancedMesh(bg, mat, beads.length);
  inst.castShadow = true;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  beads.forEach((b, i) => {
    Q.setFromUnitVectors(up, b.n);
    S.set(b.s, b.s * 0.80, b.s);
    M.compose(b.p, Q, S);
    inst.setMatrixAt(i, M);
  });
  inst.instanceMatrix.needsUpdate = true;
  attachRockMorph(bg, 1.0);
  inst.userData.beads = beads;
  G.add(inst);
  BUDDHA.parts.hair = inst;

  /* 白毫（眉心红点） */
  const urnaGeo = new THREE.SphereGeometry(0.17, 16, 12);
  const urnaMat = new THREE.MeshStandardMaterial({ color: 0xC8302A, roughness: 0.45, transparent: true, opacity: 0 });
  const urna = new THREE.Mesh(urnaGeo, urnaMat);
  const UP = bodyPoint(0, yv(32.98), new THREE.Vector3());
  const UN = bodyNormal(0, yv(32.98), new THREE.Vector3());
  urna.position.copy(UP).addScaledVector(UN, 0.10);
  urna.scale.set(1, 1, 0.55);
  G.add(urna);
  BUDDHA.detailMats.push(urnaMat);
  BUDDHA.parts.urna = urna;
}

/* ------------------------------------------------------------
   五官：眉 / 眼 / 鼻 / 唇
   ------------------------------------------------------------ */
function buildFace(G) {
  /* 形体已由 faceRelief 做成浮雕，这里只放「上色阶段」才出现的彩色薄片 */
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0x2B2620, roughness: 0.52, transparent: true, opacity: 0,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
  });
  BUDDHA.detailMats.push(lineMat);

  /* 眼线：闭目下视的细长弧（y≈32.34，x 0.26→1.32） */
  for (const sx of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const uu = sx * lerp(0.021, 0.113, t);
      const yy = 32.36 - Math.sin(t * Math.PI) * 0.062 + t * 0.045;
      const P = bodyPoint(uu, yv(yy), new THREE.Vector3());
      const N = bodyNormal(uu, yv(yy), new THREE.Vector3());
      P.addScaledVector(N, 0.030);
      pts.push(P);
    }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 22, 0.048, 6, false);
    G.add(new THREE.Mesh(g, lineMat));
  }

  /* 眉：细长弯弧（y≈32.63~32.78，x 0.30→1.78） */
  for (const sx of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const uu = sx * lerp(0.0245, 0.152, t);
      const yy = 32.60 + Math.sin(t * Math.PI) * 0.105 - t * 0.150;
      const P = bodyPoint(uu, yv(yy), new THREE.Vector3());
      const N = bodyNormal(uu, yv(yy), new THREE.Vector3());
      P.addScaledVector(N, 0.030);
      pts.push(P);
    }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 22, 0.060, 6, false);
    G.add(new THREE.Mesh(g, lineMat));
  }

  /* 唇色：贴着唇部浮雕的薄片 */
  {
    const lipMat = new THREE.MeshStandardMaterial({
      color: 0xC24634, roughness: 0.40, transparent: true, opacity: 0,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide,
    });
    BUDDHA.detailMats.push(lipMat);
    const uSeg = 26, vSeg = 10;
    const pos = [], idx = [], uvs = [];
    for (let j = 0; j <= vSeg; j++) {
      const yy = lerp(30.66, 31.02, j / vSeg);
      const halfU = 0.0385 * Math.sqrt(Math.max(0, 1 - Math.pow((j / vSeg - 0.5) * 2, 2)));
      for (let i = 0; i <= uSeg; i++) {
        const uu = lerp(-halfU, halfU, i / uSeg);
        const P = bodyPoint(uu, yv(yy), new THREE.Vector3());
        const N = bodyNormal(uu, yv(yy), new THREE.Vector3());
        P.addScaledVector(N, 0.028);
        pos.push(P.x, P.y, P.z);
        uvs.push(i / uSeg, j / vSeg);
      }
    }
    const nu = uSeg + 1;
    for (let j = 0; j < vSeg; j++) for (let i = 0; i < uSeg; i++) {
      const a = j * nu + i, b = a + 1, c = a + nu + 1, d = a + nu;
      idx.push(a, b, d, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    G.add(new THREE.Mesh(g, lipMat));
  }
}

/* 给已 position 好的 Mesh 附加石胎 morph（世界位置计算） */
function attachRockMorphMesh(mesh) {
  mesh.updateMatrix();
  const g = mesh.geometry;
  const p = g.attributes.position;
  const rp = new Float32Array(p.count * 3);
  const rn = new Float32Array(p.count * 3);
  const V = new THREE.Vector3(), R = new THREE.Vector3();
  const inv = new THREE.Matrix4().copy(mesh.matrix).invert();
  for (let i = 0; i < p.count; i++) {
    V.fromBufferAttribute(p, i).applyMatrix4(mesh.matrix);
    rockPoint(V, R);
    R.applyMatrix4(inv);
    rp[i * 3] = R.x; rp[i * 3 + 1] = R.y; rp[i * 3 + 2] = R.z;
    rn[i * 3] = 0; rn[i * 3 + 1] = 0; rn[i * 3 + 2] = 1;
  }
  g.setAttribute('aRockPos', new THREE.BufferAttribute(rp, 3));
  g.setAttribute('aRockNrm', new THREE.BufferAttribute(rn, 3));
  return mesh;
}

/* ------------------------------------------------------------
   耳：大耳垂
   ------------------------------------------------------------ */
function buildEars(G, mat) {
  for (const sx of [-1, 1]) {
    const g = new THREE.SphereGeometry(1, 18, 14);
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      // 拉成竖长的薄耳，下端加厚（耳垂）
      const yy = y * 1.60 - 0.10;
      const wid = 0.50 + smoothstep(0.3, -1.4, yy) * 0.16;
      pa.setXYZ(i, x * 0.20, yy, z * wid);
    }
    pa.needsUpdate = true; g.computeVertexNormals();
    scaleUV(g, 3);
    const uu = sx * 0.262;
    const P = bodyPoint(uu, yv(31.70), new THREE.Vector3());
    const N = bodyNormal(uu, yv(31.70), new THREE.Vector3());
    P.addScaledVector(N, 0.02);
    const m = new THREE.Mesh(g, mat);
    m.position.copy(P);
    m.scale.setScalar(1.0);
    m.rotation.y = sx * 0.22;
    m.rotation.z = sx * 0.07;
    m.castShadow = true;
    attachRockMorphMesh(m);
    G.add(m);
  }
}

/* ------------------------------------------------------------
   手臂 + 手掌
   ------------------------------------------------------------ */
function tubeAlong(points, radiusFn, seg = 40, rseg = 12) {
  const curve = new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(curve, seg, 1, rseg, false);
  const pa = g.attributes.position;
  const na = g.attributes.normal;
  // TubeGeometry 半径固定为 1，这里按参数缩放
  const nSeg = seg + 1;
  for (let i = 0; i < pa.count; i++) {
    const si = Math.floor(i / (rseg + 1));
    const t = clamp(si / seg, 0, 1);
    const r = radiusFn(t);
    const cx = curve.getPoint(t);
    pa.setXYZ(i,
      cx.x + (pa.getX(i) - cx.x) * r,
      cx.y + (pa.getY(i) - cx.y) * r,
      cx.z + (pa.getZ(i) - cx.z) * r);
  }
  pa.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/* 手掌：掌 + 四指并拢 + 拇指 */
function buildHandGeometry(scale) {
  const parts = [];
  // 掌
  const palm = new THREE.SphereGeometry(1, 20, 14);
  {
    const pa = palm.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      pa.setXYZ(i, pa.getX(i) * 1.34, pa.getY(i) * 1.42, pa.getZ(i) * 0.38);
    }
    pa.needsUpdate = true; palm.computeVertexNormals();
  }
  parts.push(palm);
  // 四指
  const fingerLen = [1.72, 1.94, 1.82, 1.48];
  const fingerX = [-0.86, -0.29, 0.29, 0.85];
  const fingerR = [0.245, 0.262, 0.252, 0.222];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.CapsuleGeometry(fingerR[i], fingerLen[i], 4, 10);
    g.translate(fingerX[i] * 1.0, 1.30 + fingerLen[i] * 0.5, 0);
    const pa = g.attributes.position;
    for (let k = 0; k < pa.count; k++) pa.setZ(k, pa.getZ(k) * 0.82);
    pa.needsUpdate = true; g.computeVertexNormals();
    parts.push(g);
  }
  // 拇指
  {
    const g = new THREE.CapsuleGeometry(0.285, 1.28, 4, 10);
    g.rotateZ(1.02);
    g.translate(-1.48, 0.24, 0.14);
    parts.push(g);
  }
  const merged = mergeGeometries(parts);
  merged.scale(scale, scale, scale);
  return merged;
}

/* 简易 BufferGeometry 合并（只处理 position/normal/uv） */
function mergeGeometries(list) {
  let vc = 0, ic = 0;
  for (const g of list) {
    vc += g.attributes.position.count;
    ic += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vc * 3), nrm = new Float32Array(vc * 3), uv = new Float32Array(vc * 2);
  const idx = new Uint32Array(ic);
  let vo = 0, io = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      pos[(vo + i) * 3] = p.getX(i); pos[(vo + i) * 3 + 1] = p.getY(i); pos[(vo + i) * 3 + 2] = p.getZ(i);
      if (n) { nrm[(vo + i) * 3] = n.getX(i); nrm[(vo + i) * 3 + 1] = n.getY(i); nrm[(vo + i) * 3 + 2] = n.getZ(i); }
      if (u) { uv[(vo + i) * 2] = u.getX(i); uv[(vo + i) * 2 + 1] = u.getY(i); }
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.getX(i) + vo;
      io += g.index.count;
    } else {
      for (let i = 0; i < p.count; i++) idx[io + i] = i + vo;
      io += p.count;
    }
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

function buildArms(G, matSkin, matInner, matRobe) {
  /* --- 佛之右臂（-X）：上举施无畏印 --- */
  {
    const pts = [
      new THREE.Vector3(-3.9, 27.6, -0.2),
      new THREE.Vector3(-5.0, 25.6, 1.2),
      new THREE.Vector3(-5.6, 23.4, 2.9),
      new THREE.Vector3(-5.85, 22.2, 4.3),
      new THREE.Vector3(-5.95, 22.4, 4.9),
    ];
    const g = tubeAlong(pts, (t) => lerp(1.85, 1.30, t), 36, 12);
    scaleUV(g, 8); attachRockMorph(g);
    const m = new THREE.Mesh(g, matSkin);
    m.castShadow = true; G.add(m);
    BUDDHA.parts.armR = m;

    // 手掌：掌心朝 +Z，指尖朝上
    const hg = buildHandGeometry(1.12);
    hg.rotateX(-0.16);
    hg.rotateY(0.10);
    hg.translate(-5.99, 24.55, 4.95);
    scaleUV(hg, 4); attachRockMorph(hg);
    const hm = new THREE.Mesh(hg, matSkin);
    hm.castShadow = true; G.add(hm);
    BUDDHA.parts.handR = hm;

    // 蓝色宽袖（垂下的袖筒）
    const sg = buildSleeveGeometry(
      new THREE.Vector3(-4.30, 27.6, -0.3),
      new THREE.Vector3(-5.50, 22.6, 2.4),
      2.95, 2.05, 4.6
    );
    scaleUV(sg, 4); attachRockMorph(sg);
    const sm = new THREE.Mesh(sg, matInner);
    sm.castShadow = true; G.add(sm);
    BUDDHA.parts.sleeveR = sm;
  }

  /* --- 佛之左臂（+X）：垂下抚膝 --- */
  {
    const pts = [
      new THREE.Vector3(4.0, 27.5, -0.3),
      new THREE.Vector3(5.6, 24.6, 0.9),
      new THREE.Vector3(6.7, 21.4, 2.6),
      new THREE.Vector3(7.2, 18.9, 4.0),
      new THREE.Vector3(7.35, 17.9, 4.7),
    ];
    const g = tubeAlong(pts, (t) => lerp(1.95, 1.30, t), 36, 12);
    scaleUV(g, 8); attachRockMorph(g);
    const m = new THREE.Mesh(g, matSkin);
    m.castShadow = true; G.add(m);
    BUDDHA.parts.armL = m;

    // 手：掌心向下覆膝
    const hg = buildHandGeometry(1.08);
    hg.rotateX(-1.46);
    hg.rotateZ(0.14);
    hg.rotateY(-0.30);
    hg.translate(7.42, 17.35, 5.35);
    scaleUV(hg, 4); attachRockMorph(hg);
    const hm = new THREE.Mesh(hg, matSkin);
    hm.castShadow = true; G.add(hm);
    BUDDHA.parts.handL = hm;

    // 赭红袖（袈裟覆左臂）
    const sg = buildSleeveGeometry(
      new THREE.Vector3(4.45, 27.6, -0.4),
      new THREE.Vector3(6.55, 20.8, 2.2),
      3.05, 1.95, 4.2
    );
    scaleUV(sg, 4); attachRockMorph(sg);
    const sm = new THREE.Mesh(sg, matRobe);
    sm.castShadow = true; G.add(sm);
    BUDDHA.parts.sleeveL = sm;
  }
}

/* 宽袖：沿两点连线的锥筒 + 下垂的褶边 */
function buildSleeveGeometry(a, b, r0, r1, dropLen) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  dir.normalize();
  const uSeg = 40, vSeg = 30;
  const pos = [], nrm = [], uvs = [], idx = [];
  const side = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
  const up = new THREE.Vector3().crossVectors(dir, side).normalize();
  for (let j = 0; j <= vSeg; j++) {
    const t = j / vSeg;
    const r = lerp(r0, r1, Math.pow(t, 0.8));
    const c = new THREE.Vector3().copy(a).addScaledVector(dir, len * t);
    // 袖口向下垂
    c.y -= Math.pow(t, 2.4) * dropLen;
    for (let i = 0; i <= uSeg; i++) {
      const ang = (i / uSeg) * TAU;
      const fold = 1 + Math.sin(ang * 6 + t * 2.4) * 0.062 + Math.sin(ang * 3 - t * 1.5) * 0.045;
      const p = new THREE.Vector3()
        .copy(c)
        .addScaledVector(side, Math.cos(ang) * r * fold)
        .addScaledVector(up, Math.sin(ang) * r * fold * 0.86);
      pos.push(p.x, p.y, p.z);
      const n = new THREE.Vector3().subVectors(p, c).normalize();
      nrm.push(n.x, n.y, n.z);
      uvs.push(i / uSeg * 2, t * 2);
    }
  }
  const nu = uSeg + 1;
  for (let j = 0; j < vSeg; j++) for (let i = 0; i < uSeg; i++) {
    const A = j * nu + i, B = A + 1, C = A + nu + 1, D = A + nu;
    idx.push(A, B, D, B, C, D);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------
   双脚：从裙下伸出，平踏于基座
   ------------------------------------------------------------ */
function buildFeet(G, mat) {
  for (const sx of [-1, 1]) {
    const parts = [];
    // 脚背
    const f = new THREE.SphereGeometry(1, 22, 16);
    const pa = f.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      let x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      y = Math.max(y, -0.28);            // 削平脚底
      // 前端（+z）变窄变薄
      const fz = (z + 1) * 0.5;
      const narrow = lerp(1.0, 0.74, Math.pow(fz, 1.5));
      pa.setXYZ(i, x * 1.82 * narrow, y * 0.86, z * 2.40);
    }
    pa.needsUpdate = true; f.computeVertexNormals();
    parts.push(f);
    // 脚趾
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const r = 0.40 - t * 0.11;
      const g = new THREE.SphereGeometry(r, 12, 10);
      g.scale(1, 0.86, 1.36);
      g.translate((-1.05 + t * 2.1) * sx, -0.22 + (1 - Math.abs(t - 0.1)) * 0.12, 2.86 - Math.abs(t - 0.15) * 0.42);
      parts.push(g);
    }
    const merged = mergeGeometries(parts);
    merged.scale(1.05, 1.05, 1.05);
    merged.translate(sx * 8.20, 0.98, 6.10);
    scaleUV(merged, 6); attachRockMorph(merged);
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = m.receiveShadow = true;
    G.add(m);
    BUDDHA.parts['foot' + (sx > 0 ? 'L' : 'R')] = m;
  }
}

/* ------------------------------------------------------------
   头光 + 顶部华盖（上色阶段淡入）
   ------------------------------------------------------------ */
function buildHalo3D(G) {
  const haloMat = new THREE.MeshStandardMaterial({
    map: TEX.halo.map, transparent: true, opacity: 0,
    roughness: 0.72, metalness: 0.0, side: THREE.DoubleSide,
    alphaTest: 0.02, depthWrite: false,
  });
  BUDDHA.haloMats.push(haloMat);
  const R = 6.15;
  const g = new THREE.PlaneGeometry(R * 2, R * 2, 1, 1);
  const m = new THREE.Mesh(g, haloMat);
  m.position.set(0, 31.95, -3.55);
  m.rotation.x = 0.05;
  G.add(m);
  BUDDHA.parts.halo = m;

  const crownMat = new THREE.MeshStandardMaterial({
    map: TEX.haloCrown.map, transparent: true, opacity: 0,
    roughness: 0.7, side: THREE.DoubleSide, alphaTest: 0.02, depthWrite: false,
  });
  BUDDHA.haloMats.push(crownMat);
  const cg = new THREE.PlaneGeometry(9.4, 3.10);
  const cm = new THREE.Mesh(cg, crownMat);
  cm.position.set(0, 36.55, -3.45);
  cm.rotation.x = 0.05;
  G.add(cm);
  BUDDHA.parts.haloCrown = cm;
}

/* ------------------------------------------------------------
   木桩（凿孔插桩，视频 59-61s）
   ------------------------------------------------------------ */
function buildPegs(G) {
  const pegs = [];
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  const rnd = mulberry32(41);
  // 在举起的手掌/前臂区域插桩（视频里正是这里）
  const spots = [
    [-5.6, 26.6], [-5.2, 25.4], [-6.4, 26.0], [-4.9, 24.2], [-6.2, 24.6],
    [-5.9, 27.6], [-4.4, 23.1],
  ];
  const geo = new THREE.CylinderGeometry(0.20, 0.26, 3.4, 8);
  const mat = new THREE.MeshStandardMaterial({ color: 0x2E241C, roughness: 0.92 });
  const grp = new THREE.Group();
  for (const [x, y] of spots) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, 4.4 + rnd() * 0.6);
    m.rotation.z = -0.5 + rnd() * 0.3;
    m.rotation.x = 0.9 + rnd() * 0.35;
    m.castShadow = true;
    m.userData.t = rnd();
    grp.add(m);
    pegs.push(m);
  }
  grp.visible = false;
  G.add(grp);
  BUDDHA.parts.pegs = grp;
  BUDDHA.parts.pegList = pegs;
}
