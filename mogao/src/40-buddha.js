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
    finalMap: TEX.skin.map, finalTint: new THREE.Color(0.88, 0.79, 0.67), finalScale: [1/7, 1/7], mudScale: [1/2.4, 1/2.4], rockScale: [1/3.6, 1/3.6],
    roughSet: [1.0, 0.97, 0.94, 0.88, 0.78, 0.66, 0.74], normalScale: 1.0,
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
    finalTint: new THREE.Color(0.16, 0.105, 0.060),
    mudScale: [1/1.4, 1/1.4], rockScale: [1/1.6, 1/1.6],
    roughSet: [1.0, 0.97, 0.94, 0.86, 0.72, 0.55, 0.78], normalScale: 0.4,
  });
  BUDDHA.parts.mats = { matSkin, matRobe, matRobeLower, matInner, matSash, matBelt, matHair };

  /* ---------------- 1. 下身：赭红大裙 ---------------- */
  const gLower = buildLayerGeometry({
    uSeg: 120, vSeg: 128, v0: 0, v1: yv(20.4),
    offset: 0.16, uvScale: [1, 1],
  });
  const mLower = new THREE.Mesh(gLower, matRobeLower);
  mLower.castShadow = mLower.receiveShadow = true;
  G.add(mLower); BUDDHA.parts.lower = mLower;

  /* ---------------- 2. 躯干皮肤（胸口裸露部分） ---------------- */
  const gTorso = buildLayerGeometry({
    uSeg: 112, vSeg: 82, v0: yv(19.0), v1: yv(30.6),
    offset: 0.0, uvScale: [1, 1],
  });
  const mTorso = new THREE.Mesh(gTorso, matSkin);
  mTorso.castShadow = mTorso.receiveShadow = true;
  G.add(mTorso); BUDDHA.parts.torso = mTorso;

  /* ---------------- 3. 头 ---------------- */
  const gHead = buildLayerGeometry({
    uSeg: 112, vSeg: 88, v0: yv(29.2), v1: 1.0,
    offset: 0.0, uvScale: [1, 1],
  });
  const mHead = new THREE.Mesh(gHead, matSkin);
  mHead.castShadow = mHead.receiveShadow = true;
  G.add(mHead); BUDDHA.parts.head = mHead;

  /* ---------------- 4. 内衣（孔雀蓝，覆佛之右肩/右臂/左下摆） ---------------- */
  const gInner = buildLayerGeometry({
    uSeg: 136, vSeg: 118, v0: yv(6.0), v1: yv(29.6),
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
    uSeg: 152, vSeg: 112, v0: yv(18.0), v1: yv(29.6),
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
    uSeg: 144, vSeg: 116, v0: yv(15.0), v1: yv(29.7),
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
    uSeg: 112, vSeg: 18, v0: yv(17.4), v1: yv(19.7),
    offset: 0.40, uvScale: [1, 1],
    mask: (u, v) => {
      const du = ucyc(u, 0.0);
      const y = v * H;
      return sband(du, -0.225, 0.225, 0.03) * sband(y, 17.92, 19.14, 0.14);
    },
  });
  const mBelt = new THREE.Mesh(gBelt, matBelt);
  G.add(mBelt); BUDDHA.parts.belt = mBelt;

  /* 真实凸起的衣褶、领口与袈裟边缘。 */
  buildRobeRelief(G, matRobeLower, matRobe, matSash, matSkin);

  /* ---------------- 8. 螺发 ---------------- */
  buildHair(G, matHair);

  /* ---------------- 9. 五官 ---------------- */
  buildFace(G, matSkin);

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
   衣褶实体层：沿佛身曲面铺设低矮圆脊，解决仅靠纹理/法线的平面感。
   ------------------------------------------------------------ */
function buildRobeRelief(G, matLower, matRobe, matSash, matSkin) {
  const group = new THREE.Group();
  group.name = 'RobeRelief';
  const addCurve = (samples, radius, mat, lift = 0.20, closed = false) => {
    const pts = [];
    for (const smp of samples) {
      const u = (smp.u + 1) % 1;
      const P = bodyPoint(u, yv(smp.y), new THREE.Vector3());
      const N = bodyNormal(u, yv(smp.y), new THREE.Vector3()).normalize();
      pts.push(P.addScaledVector(N, lift + (smp.lift || 0)));
    }
    if (pts.length < 3) return;
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', 0.34), Math.max(28, pts.length * 3), radius, 8, closed);
    scaleUV(geo, 1.8); attachRockMorph(geo, 0.985);
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; group.add(m);
  };

  /* 下裙十二道宽缓 U 形褶，边缘向两侧抬升。 */
  for (let r = 0; r < 12; r++) {
    const baseY = 2.2 + r * 1.38;
    const samples = [];
    for (let i = 0; i <= 26; i++) {
      const q = i / 26, u = lerp(-0.205, 0.205, q);
      const edge = Math.pow(Math.abs(q - 0.5) * 2, 1.55);
      const y = baseY + edge * (1.35 + r * 0.035) + Math.sin(q * Math.PI * 2 + r * 0.52) * 0.055;
      samples.push({ u, y });
    }
    addCurve(samples, 0.080 + r * 0.003, matLower, 0.24);
  }

  /* 胸腹袈裟层叠，向画面右肩汇聚。 */
  for (let r = 0; r < 7; r++) {
    const samples = [];
    for (let i = 0; i <= 24; i++) {
      const q = i / 24;
      const u = lerp(-0.18, 0.17, q);
      const y = 20.7 + r * 0.78 + q * (2.2 + r * 0.10) + Math.sin(q * Math.PI) * 0.34;
      samples.push({ u, y });
    }
    addCurve(samples, 0.075, r < 3 ? matRobe : matSash, 0.28);
  }

  /* 领圈与颈部三道塑泥收口。 */
  for (let r = 0; r < 3; r++) {
    const samples = [];
    for (let i = 0; i <= 28; i++) {
      const q = i / 28, u = lerp(-0.18, 0.18, q);
      const y = 29.15 + r * 0.20 + Math.pow(Math.abs(q - 0.5) * 2, 1.8) * 0.10;
      samples.push({ u, y });
    }
    addCurve(samples, 0.052, matSkin, 0.13);
  }

  /* 袈裟竖边，从肩部自然落到腹前。 */
  const edge = [];
  for (let i = 0; i <= 30; i++) {
    const q = i / 30;
    edge.push({ u: lerp(-0.19, -0.11, q), y: lerp(28.55, 17.6, q) + Math.sin(q * Math.PI) * 0.28 });
  }
  addCurve(edge, 0.095, matRobe, 0.31);

  G.add(group); BUDDHA.parts.robeRelief = group;
}

/* ------------------------------------------------------------
   螺发：扁圆螺髻与同心环
   ------------------------------------------------------------ */
function buildHair(G, mat) {
  const group = new THREE.Group();
  group.name = 'SculptedHair';
  const elements = [];

  /* 连续发帽只提供暗部，不承担可见纹样。 */
  const capGeo = buildLayerGeometry({
    uSeg: 112, vSeg: 64, v0: yv(30.20), v1: 1.0,
    offset: 0.075, uvScale: [1.8, 1.8],
    mask: (u, v) => {
      const y = v * H;
      const du = ucyc(u, 0.0);
      const front = Math.cos(du * TAU) * 0.5 + 0.5;
      const hairline = lerp(30.45, 33.62, Math.pow(front, 0.26));
      return smoothstep(hairline - 0.16, hairline + 0.18, y);
    },
  });
  const cap = new THREE.Mesh(capGeo, mat);
  cap.castShadow = true;
  cap.userData.revealY = 30.2;
  cap.userData.finalScale = new THREE.Vector3(1, 1, 1);
  group.add(cap); elements.push(cap);

  /* 每一行把扁圆螺髻与同心环合并成一个 Mesh，既有雕塑感又控制 draw call。 */
  const zAxis = new THREE.Vector3(0, 0, 1);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
  const rows = 16;
  for (let r = 0; r < rows; r++) {
    const tt = r / Math.max(1, rows - 1);
    const y0 = lerp(30.55, 35.18, Math.pow(tt, 0.92));
    const ringR = PROF_RX(y0);
    const frontSpan = lerp(0.46, 0.30, tt);
    const count = Math.max(7, Math.round(TAU * ringR * frontSpan * 1.65));
    const parts = [];
    for (let i = 0; i < count; i++) {
      const u = -frontSpan + (frontSpan * 2) * ((i + (r % 2) * 0.5) / count);
      const du = ucyc(u, 0.0);
      const frontness = Math.cos(du * TAU) * 0.5 + 0.5;
      const hairline = lerp(30.45, 33.60, Math.pow(frontness, 0.28));
      if (y0 < hairline) continue;
      const P = bodyPoint((u + 1) % 1, yv(y0), new THREE.Vector3());
      const N = bodyNormal((u + 1) % 1, yv(y0), new THREE.Vector3()).normalize();
      const size = 0.145 + hash3(r, i, 91) * 0.028;
      Q.setFromUnitVectors(zAxis, N);
      M.compose(P.clone().addScaledVector(N, 0.105), Q, S.set(size * 1.15, size * 1.15, size * 0.52));
      const dome = new THREE.SphereGeometry(1, 9, 7, 0, TAU, 0, Math.PI * 0.72);
      dome.applyMatrix4(M); parts.push(dome);
      M.compose(P.clone().addScaledVector(N, 0.165), Q, S.set(size, size, size));
      const ring1 = new THREE.TorusGeometry(0.68, 0.115, 6, 14);
      ring1.applyMatrix4(M); parts.push(ring1);
      const ring2 = new THREE.TorusGeometry(0.36, 0.080, 5, 12);
      ring2.applyMatrix4(M); parts.push(ring2);
    }
    if (!parts.length) continue;
    const geo = mergeGeometries(parts);
    scaleUV(geo, 1.1); attachRockMorph(geo, 0.97);
    const row = new THREE.Mesh(geo, mat);
    row.castShadow = true;
    row.userData.revealY = y0;
    row.userData.finalScale = new THREE.Vector3(1, 1, 1);
    group.add(row); elements.push(row);
  }

  group.userData.elements = elements;
  group.userData.revealMin = 30.2;
  group.userData.revealMax = 35.6;
  G.add(group);
  BUDDHA.parts.hair = group;

  const urnaGeo = new THREE.SphereGeometry(0.105, 18, 14);
  const urnaMat = new THREE.MeshStandardMaterial({ color: 0x8B3027, roughness: 0.72, transparent: true, opacity: 0 });
  const urna = new THREE.Mesh(urnaGeo, urnaMat);
  const UP = bodyPoint(0, yv(32.98), new THREE.Vector3());
  const UN = bodyNormal(0, yv(32.98), new THREE.Vector3());
  urna.position.copy(UP).addScaledVector(UN, 0.13);
  urna.scale.set(1, 1, 0.48);
  G.add(urna);
  BUDDHA.detailMats.push(urnaMat);
  BUDDHA.parts.urna = urna;
}

/* ------------------------------------------------------------
   五官：眉 / 眼 / 鼻 / 唇
   ------------------------------------------------------------ */
function buildFace(G, matSkin) {
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0x3B2A20, roughness: 0.78, transparent: true, opacity: 0,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
  });
  const lipMat = new THREE.MeshStandardMaterial({
    color: 0x8F4C3B, roughness: 0.78, transparent: true, opacity: 0,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
  });
  const nostrilMat = new THREE.MeshStandardMaterial({
    color: 0x302018, roughness: 0.90, transparent: true, opacity: 0,
    depthWrite: false,
  });
  BUDDHA.detailMats.push(lineMat, lipMat, nostrilMat);

  const surfacePoint = (u, y, lift = 0.04) => {
    const P = bodyPoint((u + 1) % 1, yv(y), new THREE.Vector3());
    const N = bodyNormal((u + 1) % 1, yv(y), new THREE.Vector3());
    P.addScaledVector(N, lift);
    return { P, N };
  };
  const addPrimitive = (geo, pos, scale, mat = matSkin, rot = null) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.scale.copy(scale);
    if (rot) mesh.rotation.copy(rot);
    mesh.castShadow = true;
    attachRockMorphMesh(mesh);
    G.add(mesh);
    return mesh;
  };

  /* 真实几何眼睑：彩绘眼线只是最后一层。 */
  for (const sx of [-1, 1]) {
    const lidPts = [], linePts = [], browPts = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const u = sx * lerp(0.020, 0.134, t);
      const yEye = 32.37 - Math.sin(t * Math.PI) * 0.095 + t * 0.018;
      const a = surfacePoint(u, yEye, 0.145);
      lidPts.push(a.P);
      linePts.push(a.P.clone().addScaledVector(a.N, 0.035));
      const yBrow = 32.73 + Math.sin(t * Math.PI) * 0.10 - t * 0.12;
      const b = surfacePoint(sx * lerp(0.024, 0.154, t), yBrow, 0.06);
      browPts.push(b.P.clone().addScaledVector(b.N, 0.035));
    }
    const lidGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lidPts), 32, 0.060, 8, false);
    scaleUV(lidGeo, 1.2); attachRockMorph(lidGeo, 0.98);
    const lid = new THREE.Mesh(lidGeo, matSkin); lid.castShadow = true; G.add(lid);
    const eyeGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(linePts), 32, 0.022, 7, false);
    const eye = new THREE.Mesh(eyeGeo, lineMat); G.add(eye);
    const browGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(browPts), 32, 0.043, 7, false);
    const brow = new THREE.Mesh(browGeo, lineMat); G.add(brow);
  }

  /* 鼻梁、鼻头和鼻翼，不再只靠纹理凸起。 */
  {
    const b = surfacePoint(0, 31.98, 0.34);
    addPrimitive(new THREE.CapsuleGeometry(0.155, 0.70, 8, 16), b.P,
      new THREE.Vector3(0.66, 1.0, 0.72), matSkin,
      new THREE.Euler(0.07, 0, 0));
    const tip = surfacePoint(0, 31.39, 0.31);
    addPrimitive(new THREE.SphereGeometry(1, 20, 14), tip.P,
      new THREE.Vector3(0.31, 0.21, 0.26), matSkin);
    for (const sx of [-1, 1]) {
      const wing = surfacePoint(sx * 0.032, 31.38, 0.30);
      addPrimitive(new THREE.SphereGeometry(1, 16, 12), wing.P,
        new THREE.Vector3(0.17, 0.10, 0.13), matSkin);
      const nostril = surfacePoint(sx * 0.025, 31.31, 0.255);
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.038, 14, 10), nostrilMat);
      m.position.copy(nostril.P); m.scale.set(1.0, 0.38, 0.30); G.add(m);
    }
  }

  /* 立体上下唇；颜色层在最后彩绘阶段才出现。 */
  for (const [yy, bow, radius] of [[30.87, 0.070, 0.072], [30.73, -0.038, 0.080]]) {
    const pts = [], colorPts = [];
    for (let i = 0; i <= 26; i++) {
      const t = i / 26;
      const u = lerp(-0.047, 0.047, t);
      const y = yy + Math.cos((t - 0.5) * Math.PI * 2) * bow;
      const a = surfacePoint(u, y, 0.16);
      pts.push(a.P); colorPts.push(a.P.clone().addScaledVector(a.N, 0.035));
    }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, radius, 8, false);
    scaleUV(geo, 1); attachRockMorph(geo, 0.98);
    const m = new THREE.Mesh(geo, matSkin); m.castShadow = true; G.add(m);
    const cgeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(colorPts), 32, radius * 0.62, 7, false);
    G.add(new THREE.Mesh(cgeo, lipMat));
  }
  BUDDHA.parts.faceDetails = true;
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
    const g = new THREE.SphereGeometry(1, 22, 18);
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      const yy = y * 1.34 - 0.08;
      const lobe = 0.36 + smoothstep(0.10, -1.0, yy) * 0.18;
      pa.setXYZ(i, x * 0.25, yy, z * lobe);
    }
    pa.needsUpdate = true; g.computeVertexNormals(); scaleUV(g, 3);
    const uu = sx * 0.232;
    const P = bodyPoint((uu + 1) % 1, yv(31.62), new THREE.Vector3());
    const N = bodyNormal((uu + 1) % 1, yv(31.62), new THREE.Vector3());
    P.addScaledVector(N, 0.04);
    const m = new THREE.Mesh(g, mat);
    m.position.copy(P);
    m.rotation.y = sx * 0.13;
    m.rotation.z = sx * 0.06;
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
  /* 掌根厚、指根收窄，正面略拱。 */
  const palm = new THREE.SphereGeometry(1, 24, 18);
  {
    const pa = palm.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      const taper = lerp(1.06, 0.82, smoothstep(-0.7, 0.95, y));
      pa.setXYZ(i, x * 1.18 * taper, y * 1.48, z * (0.42 + (1 - y * y) * 0.08));
    }
    pa.needsUpdate = true; palm.computeVertexNormals();
  }
  parts.push(palm);
  const fingerLen = [1.54, 1.82, 1.92, 1.70];
  const fingerX = [-0.76, -0.26, 0.26, 0.75];
  const fingerR = [0.205, 0.225, 0.232, 0.210];
  const fingerTilt = [-0.11, -0.035, 0.025, 0.10];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.CapsuleGeometry(fingerR[i], fingerLen[i], 5, 12);
    g.rotateZ(fingerTilt[i]);
    g.translate(fingerX[i], 1.20 + fingerLen[i] * 0.52, 0.015 + (i === 1 || i === 2 ? 0.035 : 0));
    const pa = g.attributes.position;
    for (let k = 0; k < pa.count; k++) pa.setZ(k, pa.getZ(k) * 0.78);
    pa.needsUpdate = true; g.computeVertexNormals();
    parts.push(g);
  }
  const thumb = new THREE.CapsuleGeometry(0.245, 1.15, 5, 12);
  thumb.rotateZ(0.94); thumb.rotateY(-0.16); thumb.translate(-1.25, 0.18, 0.12);
  parts.push(thumb);
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
  /* 佛之右臂（画面左）：手掌举至肩前，比例压回真实雕塑尺度。 */
  {
    const pts = [
      new THREE.Vector3(-5.55, 27.10, 0.05),
      new THREE.Vector3(-6.15, 25.75, 1.10),
      new THREE.Vector3(-6.35, 24.25, 2.45),
      new THREE.Vector3(-6.05, 23.45, 3.62),
    ];
    const g = tubeAlong(pts, (t) => lerp(1.05, 0.70, t), 34, 12);
    scaleUV(g, 7); attachRockMorph(g);
    const m = new THREE.Mesh(g, matSkin); m.castShadow = true; G.add(m); BUDDHA.parts.armR = m;

    const hg = buildHandGeometry(0.68);
    hg.rotateX(-0.10); hg.rotateY(0.05); hg.rotateZ(-0.03);
    hg.translate(-6.02, 24.20, 4.02);
    scaleUV(hg, 3); attachRockMorph(hg);
    const hm = new THREE.Mesh(hg, matSkin); hm.castShadow = true; G.add(hm); BUDDHA.parts.handR = hm;

    const sg = buildSleeveGeometry(
      new THREE.Vector3(-5.70, 27.10, -0.20),
      new THREE.Vector3(-6.08, 24.00, 2.20),
      1.68, 1.08, 2.35);
    scaleUV(sg, 4); attachRockMorph(sg);
    const sm = new THREE.Mesh(sg, matInner); sm.castShadow = true; G.add(sm); BUDDHA.parts.sleeveR = sm;
  }

  /* 佛之左臂（画面右）：自然下垂并覆膝。 */
  {
    const pts = [
      new THREE.Vector3(5.55, 27.05, -0.05),
      new THREE.Vector3(6.18, 24.75, 0.85),
      new THREE.Vector3(6.62, 22.15, 2.12),
      new THREE.Vector3(6.90, 19.70, 3.42),
      new THREE.Vector3(6.86, 18.55, 4.05),
    ];
    const g = tubeAlong(pts, (t) => lerp(1.08, 0.72, t), 36, 12);
    scaleUV(g, 7); attachRockMorph(g);
    const m = new THREE.Mesh(g, matSkin); m.castShadow = true; G.add(m); BUDDHA.parts.armL = m;

    const hg = buildHandGeometry(0.72);
    hg.rotateX(-1.45); hg.rotateY(-0.24); hg.rotateZ(0.12);
    hg.translate(6.92, 18.12, 4.48);
    scaleUV(hg, 3); attachRockMorph(hg);
    const hm = new THREE.Mesh(hg, matSkin); hm.castShadow = true; G.add(hm); BUDDHA.parts.handL = hm;

    const sg = buildSleeveGeometry(
      new THREE.Vector3(5.72, 27.06, -0.22),
      new THREE.Vector3(6.65, 21.35, 1.95),
      1.76, 1.12, 2.55);
    scaleUV(sg, 4); attachRockMorph(sg);
    const sm = new THREE.Mesh(sg, matRobe); sm.castShadow = true; G.add(sm); BUDDHA.parts.sleeveL = sm;
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
    const f = new THREE.SphereGeometry(1, 24, 18);
    const pa = f.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      let x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      y = Math.max(y, -0.26);
      const fz = (z + 1) * 0.5;
      pa.setXYZ(i, x * 1.55 * lerp(1.0, 0.76, fz), y * 0.72, z * 2.02);
    }
    pa.needsUpdate = true; f.computeVertexNormals(); parts.push(f);
    for (let i = 0; i < 5; i++) {
      const t = i / 4, r = 0.31 - t * 0.075;
      const g = new THREE.SphereGeometry(r, 12, 10);
      g.scale(1, 0.78, 1.24);
      g.translate((-0.88 + t * 1.76) * sx, -0.17, 2.35 - Math.abs(t - 0.18) * 0.32);
      parts.push(g);
    }
    const merged = mergeGeometries(parts);
    merged.scale(0.98, 0.98, 0.98);
    merged.translate(sx * 8.10, 0.82, 6.05);
    scaleUV(merged, 5); attachRockMorph(merged);
    const m = new THREE.Mesh(merged, mat); m.castShadow = m.receiveShadow = true;
    G.add(m); BUDDHA.parts['foot' + (sx > 0 ? 'L' : 'R')] = m;
  }
}

/* ------------------------------------------------------------
   头光 + 顶部华盖（上色阶段淡入）
   ------------------------------------------------------------ */
function buildHalo3D(G) {
  const haloMat = new THREE.MeshStandardMaterial({
    map: TEX.halo.map, transparent: true, opacity: 0,
    roughness: 0.82, metalness: 0.0, side: THREE.DoubleSide,
    alphaTest: 0.015, depthWrite: false,
  });
  BUDDHA.haloMats.push(haloMat);
  const g = new THREE.CircleGeometry(4.55, 80);
  const m = new THREE.Mesh(g, haloMat);
  m.position.set(0, 32.20, -5.05);
  m.rotation.x = 0.015;
  G.add(m); BUDDHA.parts.halo = m;

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xB68A43, emissive: 0x2C1907, emissiveIntensity: 0.12,
    roughness: 0.62, transparent: true, opacity: 0,
  });
  BUDDHA.haloMats.push(ringMat);
  const rings = new THREE.Group();
  for (const r of [3.82, 4.24]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.075, 8, 72), ringMat);
    ring.position.set(0, 32.20, -4.94);
    rings.add(ring);
  }
  G.add(rings); BUDDHA.parts.haloRings = rings;

  const crownMat = new THREE.MeshStandardMaterial({
    map: TEX.haloCrown.map, transparent: true, opacity: 0,
    roughness: 0.78, side: THREE.DoubleSide, alphaTest: 0.035, depthWrite: false,
  });
  BUDDHA.haloMats.push(crownMat);
  const cm = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 1.18), crownMat);
  cm.position.set(0, 36.42, -4.92);
  G.add(cm); BUDDHA.parts.haloCrown = cm;
}

/* ------------------------------------------------------------
   木桩（凿孔插桩，视频 59-61s）
   ------------------------------------------------------------ */
function buildPegs(G) {
  const pegs = [];
  const spots = [
    [-0.18, 27.2], [0.18, 27.0], [-0.12, 24.9], [0.13, 24.4],
    [-0.20, 21.9], [0.19, 21.3], [-0.13, 18.7], [0.14, 18.0],
    [-0.17, 15.0], [0.17, 14.4], [-0.10, 11.3], [0.11, 10.7],
    [-0.14, 7.5], [0.14, 7.0],
  ];
  const geo = new THREE.CylinderGeometry(0.10, 0.13, 1.85, 9);
  const mat = new THREE.MeshStandardMaterial({ map: TEX.wood.map, color: 0x5B3A22, roughness: 0.92 });
  const grp = new THREE.Group();
  for (let i = 0; i < spots.length; i++) {
    const [u, y] = spots[i];
    const uu = (u + 1) % 1;
    const P = bodyPoint(uu, yv(y), new THREE.Vector3());
    const N = bodyNormal(uu, yv(y), new THREE.Vector3()).normalize();
    const m = new THREE.Mesh(geo, mat);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), N);
    m.position.copy(P).addScaledVector(N, 0.42);
    m.castShadow = true;
    m.userData.t = i / Math.max(1, spots.length - 1);
    m.userData.finalPosition = m.position.clone();
    m.userData.finalQuaternion = m.quaternion.clone();
    m.userData.axis = N.clone();
    grp.add(m); pegs.push(m);
  }
  grp.visible = false;
  G.add(grp);
  BUDDHA.parts.pegs = grp;
  BUDDHA.parts.pegList = pegs;
}
