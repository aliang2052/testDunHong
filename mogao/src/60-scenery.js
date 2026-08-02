/* ============================================================
   60 - 配景：栈道 / 白塔 / 树 / 庙宇 / 九层楼 / 碎石粒子
   ============================================================ */

/* ------------------------------------------------------------
   碎石粒子池
   ------------------------------------------------------------ */
class DebrisPool {
  constructor(scene, count = 520) {
    const g = new THREE.IcosahedronGeometry(1, 0);
    // 打乱成不规则石块
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const s = 0.6 + hash3(i * 7, i * 13, 3) * 0.75;
      pa.setXYZ(i, pa.getX(i) * s, pa.getY(i) * s * 0.82, pa.getZ(i) * s);
    }
    pa.needsUpdate = true; g.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      map: TEX.rockCore.map, normalMap: TEX.rockCore.normal, roughness: 0.98,
    });
    this.mesh = new THREE.InstancedMesh(g, mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this.count = count;
    this.p = new Float32Array(count * 3);
    this.v = new Float32Array(count * 3);
    this.q = new Float32Array(count * 4);
    this.w = new Float32Array(count * 3);
    this.s = new Float32Array(count);
    this.life = new Float32Array(count);
    this.rest = new Uint8Array(count);
    this.cursor = 0;
    this.rnd = mulberry32(99);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._sv = new THREE.Vector3();
    for (let i = 0; i < count; i++) { this.s[i] = 0; this.life[i] = 0; }
    this.sync();
  }

  emit(x, y, z, n, opts = {}) {
    const spread = opts.spread || 3.0;
    const speed = opts.speed || 6.0;
    const size = opts.size || 0.8;
    const life = opts.life || 6.0;
    for (let k = 0; k < n; k++) {
      const i = this.cursor; this.cursor = (this.cursor + 1) % this.count;
      const r = this.rnd;
      this.p[i * 3] = x + (r() - 0.5) * spread * 2;
      this.p[i * 3 + 1] = y + (r() - 0.5) * spread;
      this.p[i * 3 + 2] = z + (r() - 0.5) * spread;
      this.v[i * 3] = (r() - 0.5) * speed;
      this.v[i * 3 + 1] = r() * speed * 0.5;
      this.v[i * 3 + 2] = (r() - 0.2) * speed * 1.2;
      this.w[i * 3] = (r() - 0.5) * 7; this.w[i * 3 + 1] = (r() - 0.5) * 7; this.w[i * 3 + 2] = (r() - 0.5) * 7;
      this.q[i * 4] = 0; this.q[i * 4 + 1] = 0; this.q[i * 4 + 2] = 0; this.q[i * 4 + 3] = 1;
      this.s[i] = size * (0.45 + r() * 1.1);
      this.life[i] = life * (0.7 + r() * 0.6);
      this.rest[i] = 0;
    }
  }

  update(dt) {
    const g = -26.0;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.s[i] = 0; continue; }
      if (!this.rest[i]) {
        this.v[i * 3 + 1] += g * dt;
        this.p[i * 3] += this.v[i * 3] * dt;
        this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt;
        this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
        const floor = this.s[i] * 0.55;
        if (this.p[i * 3 + 1] < floor) {
          this.p[i * 3 + 1] = floor;
          this.v[i * 3 + 1] *= -0.28;
          this.v[i * 3] *= 0.55; this.v[i * 3 + 2] *= 0.55;
          this.w[i * 3] *= 0.4; this.w[i * 3 + 1] *= 0.4; this.w[i * 3 + 2] *= 0.4;
          if (Math.abs(this.v[i * 3 + 1]) < 1.2) { this.rest[i] = 1; this.v[i * 3 + 1] = 0; }
        }
        // 角速度积分
        const wx = this.w[i * 3] * dt, wy = this.w[i * 3 + 1] * dt, wz = this.w[i * 3 + 2] * dt;
        const qx = this.q[i * 4], qy = this.q[i * 4 + 1], qz = this.q[i * 4 + 2], qw = this.q[i * 4 + 3];
        let nx = qx + 0.5 * (wx * qw + wy * qz - wz * qy);
        let ny = qy + 0.5 * (wy * qw + wz * qx - wx * qz);
        let nz = qz + 0.5 * (wz * qw + wx * qy - wy * qx);
        let nw = qw - 0.5 * (wx * qx + wy * qy + wz * qz);
        const l = Math.hypot(nx, ny, nz, nw) || 1;
        this.q[i * 4] = nx / l; this.q[i * 4 + 1] = ny / l; this.q[i * 4 + 2] = nz / l; this.q[i * 4 + 3] = nw / l;
      }
      // 生命末期缩小
      if (this.life[i] < 0.8) this.s[i] *= 0.965;
    }
    this.sync();
  }

  clear() {
    for (let i = 0; i < this.count; i++) { this.life[i] = 0; this.s[i] = 0; }
    this.sync();
  }

  sync() {
    for (let i = 0; i < this.count; i++) {
      const s = this.s[i];
      this._v.set(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]);
      this._q.set(this.q[i * 4], this.q[i * 4 + 1], this.q[i * 4 + 2], this.q[i * 4 + 3]);
      this._sv.set(s, s, s);
      this._m.compose(this._v, this._q, this._sv);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/* ------------------------------------------------------------
   屋顶（带翘角的歇山/庑殿简化式）
   ------------------------------------------------------------ */
function makeRoof(w, d, h, over, upturn = 1.0, innerScale = 0.30) {
  const hw = w / 2 + over, hd = d / 2 + over;
  const tw = w / 2 * innerScale, td = d / 2 * innerScale;
  const pos = [], idx = [], uvs = [];
  const seg = 10;
  // 四坡：由檐口（带翘角）到脊
  const corners = [
    [-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd],
  ];
  const ridge = [
    [-tw, -td], [tw, -td], [tw, td], [-tw, td],
  ];
  for (let f = 0; f < 4; f++) {
    const a = corners[f], b = corners[(f + 1) % 4];
    const ra = ridge[f], rb = ridge[(f + 1) % 4];
    const base = pos.length / 3;
    for (let j = 0; j <= seg; j++) {
      const t = j / seg;
      for (let i = 0; i <= seg; i++) {
        const s = i / seg;
        // 檐口位置（含翘角：两端上翘）
        const ex = lerp(a[0], b[0], s), ez = lerp(a[1], b[1], s);
        const curl = Math.pow(Math.abs(s - 0.5) * 2, 3.2) * upturn * h * 0.55;
        const ey = curl;
        const rx = lerp(ra[0], rb[0], s), rz = lerp(ra[1], rb[1], s);
        const x = lerp(ex, rx, t), z = lerp(ez, rz, t);
        const y = lerp(ey, h, Math.pow(t, 0.78));
        pos.push(x, y, z);
        uvs.push(s * 3, t * 1.6);
      }
    }
    const nu = seg + 1;
    for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) {
      const A = base + j * nu + i, B = A + 1, C = A + nu + 1, D = A + nu;
      idx.push(A, B, D, B, C, D);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------
   九层楼（莫高窟标志性木构，参考 t114）
   每层作为独立 Group，便于「拆解 / 组装」动画
   ------------------------------------------------------------ */
function buildNineStorey() {
  const root = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({
    map: TEX.woodRed.map, normalMap: TEX.woodRed.normal, roughness: 0.85,
  });
  const tileMat = new THREE.MeshStandardMaterial({ map: TEX.tile.map, roughness: 0.72, metalness: 0.05 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xC4B08C, roughness: 0.96 });

  const floors = [];
  const N = 9;
  let y = 0;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const w = lerp(30.0, 12.0, Math.pow(t, 0.80));
    const d = lerp(14.0, 6.6, Math.pow(t, 0.80));
    const fh = i === 0 ? 7.6 : lerp(3.9, 3.1, t);
    const G = new THREE.Group();
    G.position.y = y;

    /* 柱 */
    if (i === 0) {
      const nc = 9;
      const colGeo = new THREE.CylinderGeometry(0.40, 0.46, fh, 10);
      for (let c = 0; c < nc; c++) {
        const px = -w / 2 + (w / (nc - 1)) * c;
        const m = new THREE.Mesh(colGeo, woodMat);
        m.position.set(px, fh / 2, d / 2 + 0.6);
        m.castShadow = true;
        G.add(m);
      }
    }
    /* 楼身：实心墙体（贴崖），让层与层之间不透空 */
    {
      const body = new THREE.Mesh(new THREE.BoxGeometry(w * 0.97, fh + 0.6, d * 0.80), wallMat);
      body.position.set(0, fh / 2, -d * 0.12);
      body.castShadow = body.receiveShadow = true;
      G.add(body);
      /* 木构立面：柱 + 横枋 */
      const nb = Math.max(5, Math.round(w / 3.4));
      const pg = new THREE.BoxGeometry(0.42, fh, 0.42);
      for (let c = 0; c < nb; c++) {
        const m = new THREE.Mesh(pg, woodMat);
        m.position.set(-w / 2 + (w / (nb - 1)) * c, fh / 2, d * 0.29);
        m.castShadow = true;
        G.add(m);
      }
      const lin = new THREE.Mesh(new THREE.BoxGeometry(w, 0.55, 0.5), woodMat);
      lin.position.set(0, fh - 0.35, d * 0.29); G.add(lin);
      const lin2 = new THREE.Mesh(new THREE.BoxGeometry(w, 0.45, 0.5), woodMat);
      lin2.position.set(0, 0.3, d * 0.29); G.add(lin2);
      /* 窗（深色格心） */
      const winMat = new THREE.MeshStandardMaterial({ color: 0x4A342A, roughness: 0.9 });
      const nw = Math.max(3, nb - 2);
      const wg = new THREE.BoxGeometry(w / nb * 0.62, fh * 0.46, 0.22);
      for (let c = 0; c < nw; c++) {
        const m = new THREE.Mesh(wg, winMat);
        m.position.set(-w / 2 + (w / nw) * (c + 0.5), fh * 0.56, d * 0.29 + 0.16);
        G.add(m);
      }
    }
    /* 栏杆 */
    if (i > 0) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w + 1.4, 0.34, 0.34), woodMat);
      rail.position.set(0, 1.35, d * 0.42);
      G.add(rail);
      const rail2 = rail.clone(); rail2.position.y = 0.5; G.add(rail2);
      const bg = new THREE.BoxGeometry(0.19, 1.5, 0.19);
      for (let c = 0; c < 18; c++) {
        const m = new THREE.Mesh(bg, woodMat);
        m.position.set(-w / 2 - 0.6 + ((w + 1.2) / 17) * c, 0.7, d * 0.42);
        G.add(m);
      }
      /* 门窗 */
      const dm = new THREE.Mesh(new THREE.BoxGeometry(w * 0.20, fh * 0.62, 0.3), woodMat);
      dm.position.set(0, fh * 0.36, d * 0.30);
      G.add(dm);
    }
    /* 屋檐 */
    {
      const rh = i === N - 1 ? 3.4 : 1.15;
      const rg = makeRoof(w, d, rh, i === 0 ? 3.2 : 2.7, i === N - 1 ? 1.3 : 1.05, i === N - 1 ? 0.07 : 0.985);
      const rm = new THREE.Mesh(rg, tileMat);
      rm.position.set(0, fh, 0);
      rm.castShadow = true;
      G.add(rm);
      /* 檐下额枋 + 平坐板 */
      const ab = new THREE.Mesh(new THREE.BoxGeometry(w + 1.4, 0.55, d + 1.4), woodMat);
      ab.position.set(0, fh - 0.28, 0);
      G.add(ab);
      if (i < N - 1) {
        const dk = new THREE.Mesh(new THREE.BoxGeometry(w + 1.6, 0.32, d + 1.6), woodMat);
        dk.position.set(0, fh + rh + 0.18, 0);
        dk.castShadow = true;
        G.add(dk);
      }
      if (i === N - 1) {
        /* 宝顶 */
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.4, 8), tileMat);
        sp.position.set(0, fh + rh + 1.0, 0);
        G.add(sp);
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10),
          new THREE.MeshStandardMaterial({ color: 0xC8A24A, roughness: 0.35, metalness: 0.6 }));
        ball.position.set(0, fh + rh + 2.4, 0);
        G.add(ball);
      }
    }

    G.userData.baseY = y;
    floors.push(G);
    root.add(G);
    y += fh + (i === N - 1 ? 0 : 1.05);
  }
  root.userData.floors = floors;
  root.userData.totalH = y;
  return root;
}

/* ------------------------------------------------------------
   覆钵式白塔
   ------------------------------------------------------------ */
function buildStupa(scale = 1) {
  const G = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xE6E0D4, roughness: 0.9 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 3.2), mat);
  base.position.y = 0.8; G.add(base);
  const base2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 2.4), mat);
  base2.position.y = 2.1; G.add(base2);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(1.35, 18, 14), mat);
  bowl.position.y = 3.3; bowl.scale.set(1, 0.86, 1); G.add(bowl);
  for (let i = 0; i < 8; i++) {
    const r = 0.85 - i * 0.075;
    const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.06, 0.28, 12), mat);
    d.position.y = 4.4 + i * 0.30; G.add(d);
  }
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 12), mat);
  top.position.y = 7.3; G.add(top);
  G.scale.setScalar(scale);
  G.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return G;
}

/* ------------------------------------------------------------
   树（交叉面片 + 树干）
   ------------------------------------------------------------ */
function buildTree(h = 9, seed = 1) {
  const G = new THREE.Group();
  const rnd = mulberry32(seed);
  const trunkMat = new THREE.MeshStandardMaterial({ map: TEX.wood.map, roughness: 0.95 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.035, h * 0.06, h * 0.55, 8), trunkMat);
  trunk.position.y = h * 0.275; trunk.castShadow = true;
  G.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({
    map: TEX.leaf.map, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.9,
  });
  for (let i = 0; i < 7; i++) {
    const s = h * (0.42 + rnd() * 0.30);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(s, s), leafMat);
    p.position.set((rnd() - 0.5) * h * 0.28, h * (0.52 + rnd() * 0.38), (rnd() - 0.5) * h * 0.28);
    p.rotation.y = rnd() * TAU;
    p.rotation.z = (rnd() - 0.5) * 0.5;
    p.castShadow = true;
    G.add(p);
  }
  return G;
}

/* ------------------------------------------------------------
   木栈道（贴崖的之字形阶梯，视频 20-24s）
   ------------------------------------------------------------ */
function buildWalkway() {
  const G = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({
    map: TEX.wood.map, normalMap: TEX.wood.normal, roughness: 0.9, side: THREE.DoubleSide,
  });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x8A3428, roughness: 0.85 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x51453A, roughness: 0.76, metalness: 0.12 });
  const rnd = mulberry32(2406);
  const segs = [];
  const components = [];
  let order = 0;

  const register = (mesh, group, delayBias = 0) => {
    mesh.userData.finalPosition = mesh.position.clone();
    mesh.userData.finalQuaternion = mesh.quaternion.clone();
    mesh.userData.finalScale = mesh.scale.clone();
    mesh.userData.startPosition = new THREE.Vector3(
      58 + (rnd() - 0.5) * 18,
      0.45 + rnd() * 1.2,
      CLIFF_Z + 28 + (rnd() - 0.5) * 12);
    mesh.userData.startQuaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler((rnd() - 0.5) * 1.8, (rnd() - 0.5) * 2.8, (rnd() - 0.5) * 1.8));
    mesh.userData.order = order++ + delayBias;
    mesh.position.copy(mesh.userData.startPosition);
    mesh.quaternion.copy(mesh.userData.startQuaternion);
    mesh.scale.setScalar(0.06);
    mesh.visible = false;
    group.add(mesh);
    components.push(mesh);
    return mesh;
  };

  const beamBetween = (a, b, r, mat) => {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, len, 7), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return m;
  };

  /* 之字形：构件从广场材料堆逐根飞到崖壁，梁柱、踏板、斜撑顺序安装。 */
  const runs = [
    { x0: 68, x1: 40, y0: 1.0, y1: 12.0 },
    { x0: 40, x1: 66, y0: 12.0, y1: 22.0 },
    { x0: 66, x1: 38, y0: 22.0, y1: 31.5 },
    { x0: 42, x1: 24, y0: 31.5, y1: 34.6 },
  ];
  for (let ri = 0; ri < runs.length; ri++) {
    const r = runs[ri];
    const grp = new THREE.Group();
    const n = 16;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = lerp(r.x0, r.x1, t), y = lerp(r.y0, r.y1, t);
      const z = cliffFaceZ(x, y) + 1.75;
      const step = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(r.x1 - r.x0) / n * 1.38, 0.34, 3.8), woodMat);
      step.position.set(x, y, z);
      step.rotation.z = Math.atan2(r.y1 - r.y0, r.x1 - r.x0);
      step.castShadow = step.receiveShadow = true;
      register(step, grp, ri * 0.2);

      if (i % 3 === 0) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.26, 2.8, 0.26), railMat);
        post.position.set(x, y + 1.35, z + 1.62);
        post.castShadow = true;
        register(post, grp, ri * 0.2 + 0.10);
      }
      if (i % 4 === 0) {
        const wall = new THREE.Vector3(x, Math.max(0.3, y - 3.0), cliffFaceZ(x, y) - 0.2);
        const deck = new THREE.Vector3(x, y - 0.08, z - 0.75);
        const brace = beamBetween(wall, deck, 0.16, ironMat);
        brace.castShadow = true;
        register(brace, grp, ri * 0.2 + 0.16);
      }
    }
    const len = Math.hypot(r.x1 - r.x0, r.y1 - r.y0);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.21, 0.21), railMat);
      rail.position.set((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2 + 2.52,
        cliffFaceZ((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2) + 2.85 + side * 1.42);
      rail.rotation.z = Math.atan2(r.y1 - r.y0, r.x1 - r.x0);
      rail.castShadow = true;
      register(rail, grp, ri * 0.2 + 0.22);
    }
    grp.userData.order = ri;
    segs.push(grp);
    G.add(grp);
  }
  {
    const grp = new THREE.Group();
    const p = new THREE.Mesh(new THREE.BoxGeometry(22, 0.52, 4.6), woodMat);
    p.position.set(29, 34.6, cliffFaceZ(29, 34.6) + 2.0);
    p.castShadow = p.receiveShadow = true;
    register(p, grp, 1.0);
    for (let i = 0; i < 7; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.30, 2.9, 0.30), railMat);
      post.position.set(20 + i * 3.0, 36.0, cliffFaceZ(20 + i * 3.0, 34.6) + 3.5);
      register(post, grp, 1.06);
    }
    grp.userData.order = runs.length;
    segs.push(grp); G.add(grp);
  }
  G.userData.segs = segs;
  G.userData.components = components;
  return G;
}

/* ------------------------------------------------------------
   周边寺院建筑（t17 右侧）
   ------------------------------------------------------------ */
function buildTemple() {
  const G = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xCBBE9C, roughness: 0.95 });
  const tileMat = new THREE.MeshStandardMaterial({ map: TEX.tile.map, roughness: 0.75 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(26, 11, 14), wallMat);
  body.position.y = 5.5; body.castShadow = body.receiveShadow = true;
  G.add(body);
  const roof = new THREE.Mesh(makeRoof(26, 14, 3.4, 2.2), tileMat);
  roof.position.y = 11; roof.castShadow = true;
  G.add(roof);
  const doorMat = new THREE.MeshStandardMaterial({ map: TEX.woodRed.map, roughness: 0.85 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(4.2, 6.5, 0.4), doorMat);
  door.position.set(0, 3.25, 7.1); G.add(door);
  return G;
}

/* 花坛 */
function buildPlanter(w, d) {
  const G = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x9AA0A4, roughness: 0.92 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, 1.5, d), m);
  box.position.y = 0.75; box.receiveShadow = true; G.add(box);
  const leafMat = new THREE.MeshStandardMaterial({
    map: TEX.leaf.map, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.9,
  });
  const rnd = mulberry32(w * 100 + d);
  for (let i = 0; i < Math.round(w / 2.2); i++) {
    const s = 2.4 + rnd() * 1.4;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(s, s * 0.8), leafMat);
    p.position.set(-w / 2 + 1.2 + rnd() * (w - 2.4), 1.5 + s * 0.32, (rnd() - 0.5) * (d - 1));
    p.rotation.y = rnd() * TAU;
    G.add(p);
  }
  return G;
}

/* 窟门上方的小窟（崖壁点缀） */
function buildSmallCaves(G) {
  const rnd = mulberry32(31);
  const mat = new THREE.MeshStandardMaterial({ color: 0x3A2C1E, roughness: 1.0 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xC6B592, roughness: 0.95 });
  const spots = [
    [-104, 26], [-84, 13], [-66, 31], [88, 21], [104, 33], [122, 15], [138, 28], [-128, 19],
    [-52, 40], [76, 39],
  ];
  for (const [x, y] of spots) {
    const w = 3.2 + rnd() * 2.2, h = 4.6 + rnd() * 2.4;
    const z = cliffFaceZ(x, y);
    const hole = new THREE.Mesh(new THREE.BoxGeometry(w, h, 3.0), mat);
    hole.position.set(x, y + h / 2, z - 1.2);
    G.add(hole);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 2.4, h + 2.4, 0.8), trim);
    fr.position.set(x, y + h / 2, z + 0.3);
    G.add(fr);
  }
}
