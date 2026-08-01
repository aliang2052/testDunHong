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

function addDougongBand(G,w,d,y,mat){
  const n=Math.max(5,Math.round(w/3.2));
  for(let i=0;i<n;i++){
    const x=lerp(-w*.48,w*.48,i/Math.max(1,n-1));
    const bracket=new THREE.Group();
    const arm=new THREE.Mesh(new THREE.BoxGeometry(.72,.18,1.15),mat);arm.position.set(0,.08,.22);bracket.add(arm);
    const block=new THREE.Mesh(new THREE.BoxGeometry(.38,.34,.52),mat);block.position.set(0,-.12,-.10);bracket.add(block);
    const arm2=new THREE.Mesh(new THREE.BoxGeometry(1.08,.15,.42),mat);arm2.position.set(0,.28,.42);bracket.add(arm2);
    bracket.position.set(x,y,d*.38);G.add(bracket);
  }
}

/* ------------------------------------------------------------
   九层楼（莫高窟标志性木构，参考 t114）
   每层作为独立 Group，便于「拆解 / 组装」动画
   ------------------------------------------------------------ */
function buildNineStorey() {
  const root=new THREE.Group();root.name='NineStoreyFacade';
  const woodMat=new THREE.MeshStandardMaterial({map:TEX.woodRed.map,normalMap:TEX.woodRed.normal,color:0xB34F3F,roughness:.78});
  const woodDark=new THREE.MeshStandardMaterial({map:TEX.wood.map,normalMap:TEX.wood.normal,color:0x6A392A,roughness:.88});
  const tileMat=new THREE.MeshStandardMaterial({map:TEX.tile.map,color:0x59636B,roughness:.70,metalness:.03});
  const wallMat=new THREE.MeshStandardMaterial({map:TEX.whitewash.map,normalMap:TEX.whitewash.normal,color:0xD4C2A4,roughness:.94});
  const recessMat=new THREE.MeshStandardMaterial({color:0x3B2B24,roughness:1});
  const floors=[];const N=9;let y=0;
  for(let i=0;i<N;i++){
    const t=i/(N-1),w=lerp(33.0,13.2,Math.pow(t,.82)),d=lerp(13.5,6.5,Math.pow(t,.80));
    const fh=i===0?7.2:lerp(4.05,3.15,t);const G=new THREE.Group();G.position.y=y;G.name='TowerFloor'+i;
    const body=new THREE.Mesh(new THREE.BoxGeometry(w*.96,fh+.35,d*.70),wallMat);body.position.set(0,fh*.50,-d*.16);body.castShadow=body.receiveShadow=true;G.add(body);
    const recess=new THREE.Mesh(new THREE.BoxGeometry(w*.88,fh*.56,.32),recessMat);recess.position.set(0,fh*.56,d*.205);G.add(recess);
    const nb=Math.max(7,Math.round(w/2.65));
    const colGeo=new THREE.CylinderGeometry(.25,.29,fh,10);
    for(let c=0;c<nb;c++){
      const x=lerp(-w*.47,w*.47,c/(nb-1));const m=new THREE.Mesh(colGeo,woodMat);m.position.set(x,fh*.50,d*.31);m.castShadow=true;G.add(m);
    }
    for(const yy of [.24,fh*.48,fh-.28]){
      const beam=new THREE.Mesh(new THREE.BoxGeometry(w*.98,.34,.42),woodMat);beam.position.set(0,yy,d*.31);beam.castShadow=true;G.add(beam);
    }
    /* 深色格扇和竖棂，不再是整块窗口贴片。 */
    const bay=w/(nb-1);
    for(let c=0;c<nb-1;c++){
      const cx=lerp(-w*.47,w*.47,(c+.5)/(nb-1));
      const frame=new THREE.Mesh(new THREE.BoxGeometry(bay*.76,fh*.37,.18),woodDark);frame.position.set(cx,fh*.58,d*.34);G.add(frame);
      for(let q=-1;q<=1;q++){const slat=new THREE.Mesh(new THREE.BoxGeometry(.055,fh*.34,.08),woodMat);slat.position.set(cx+q*bay*.19,fh*.58,d*.45);G.add(slat);}
    }
    if(i>0){
      const balcony=new THREE.Mesh(new THREE.BoxGeometry(w+1.4,.24,d+1.25),woodDark);balcony.position.set(0,.28,.1);G.add(balcony);
      for(const yy of [.72,1.38]){const rail=new THREE.Mesh(new THREE.BoxGeometry(w+1.2,.15,.16),woodMat);rail.position.set(0,yy,d*.47);G.add(rail);}
      for(let c=0;c<Math.max(12,nb*2);c++){const post=new THREE.Mesh(new THREE.BoxGeometry(.10,1.35,.10),woodMat);post.position.set(lerp(-w*.5,w*.5,c/(Math.max(12,nb*2)-1)),.72,d*.47);G.add(post);}
    }
    const rh=i===N-1?3.1:1.10;
    const roof=new THREE.Mesh(makeRoof(w,d,rh,i===0?3.4:2.6,i===N-1?1.35:1.08,i===N-1?.08:.88),tileMat);roof.position.y=fh;roof.castShadow=true;G.add(roof);
    const eave=new THREE.Mesh(new THREE.BoxGeometry(w+2.0,.30,d+1.8),woodDark);eave.position.set(0,fh-.18,0);G.add(eave);
    addDougongBand(G,w+1.0,d,fh-.62,woodMat);
    if(i<N-1){const upperPlate=new THREE.Mesh(new THREE.BoxGeometry(w+1.4,.24,d+1.3),woodMat);upperPlate.position.set(0,fh+rh+.10,0);G.add(upperPlate);}
    if(i===N-1){
      const ridge=new THREE.Mesh(new THREE.BoxGeometry(w*.34,.24,.34),tileMat);ridge.position.set(0,fh+rh-.12,0);G.add(ridge);
      const sp=new THREE.Mesh(new THREE.ConeGeometry(.44,2.15,12),tileMat);sp.position.set(0,fh+rh+.95,0);G.add(sp);
      const ball=new THREE.Mesh(new THREE.SphereGeometry(.48,16,12),new THREE.MeshStandardMaterial({color:0xB89544,roughness:.42,metalness:.38}));ball.position.set(0,fh+rh+2.10,0);G.add(ball);
    }
    G.userData.baseY=y;floors.push(G);root.add(G);y+=fh+(i===N-1?0:.90);
  }
  root.userData.floors=floors;root.userData.totalH=y;return root;
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
  const G = new THREE.Group(); G.name = 'HistoricSwitchbackWalkway';
  const woodMat = new THREE.MeshStandardMaterial({ map: TEX.wood.map, normalMap: TEX.wood.normal, color: 0x5E371E, roughness: 0.84 });
  const darkWood = new THREE.MeshStandardMaterial({ map: TEX.wood.map, normalMap: TEX.wood.normal, color: 0x2F1C10, roughness: 0.88 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x34312D, roughness: 0.72, metalness: 0.18 });
  const components = [], segs = [];
  const rnd = mulberry32(2406);
  let order = 0;
  const materialYard = new THREE.Vector3(-39, 0.42, CLIFF_Z + 18);

  const register = (m, parent, type, stage) => {
    m.userData.finalPosition = m.position.clone();
    m.userData.finalQuaternion = m.quaternion.clone();
    m.userData.finalScale = m.scale.clone();
    const fp = m.userData.finalPosition;
    m.userData.startPosition = new THREE.Vector3(
      materialYard.x + (rnd() - 0.5) * 5.0,
      materialYard.y + rnd() * 0.9,
      materialYard.z + (rnd() - 0.5) * 3.0);
    m.userData.startQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd()-.5)*.45,(rnd()-.5)*1.2,(rnd()-.5)*.45));
    m.userData.hoistPosition = new THREE.Vector3(fp.x + (rnd()-.5)*.35, fp.y + 2.3 + rnd()*.8, fp.z + .65);
    m.userData.order = order++ + stage * 100;
    m.userData.type = type; m.userData.stage = stage;
    m.position.copy(m.userData.startPosition); m.quaternion.copy(m.userData.startQuaternion);
    m.scale.copy(m.userData.finalScale).multiplyScalar(.035); m.visible = false;
    m.castShadow = true; m.receiveShadow = type === 'plank' || type === 'landing';
    parent.add(m); components.push(m); return m;
  };
  const beam = (a,b,r,mat=woodMat,rad=8) => {
    const d = new THREE.Vector3().subVectors(b,a);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r*.92,r,d.length(),rad),mat);
    m.position.copy(a).add(b).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
    return m;
  };
  const box = (x,y,z,sx,sy,sz,mat=woodMat) => { const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat);m.position.set(x,y,z);return m; };

  /* 轮廓严格压缩为三段窄挑台和两道反向木梯。没有落地立杆森林。 */
  const levels = [
    { y:9.6,  x0:-25.0, x1:-11.0, stage:0.0 },
    { y:21.0, x0:-11.0, x1:  8.0, stage:1.35 },
    { y:31.10, x0: -3.0, x1:  5.5, stage:2.70 },
  ];

  function buildPlatform(L, li) {
    const grp = new THREE.Group(); grp.name = 'NarrowCliffPlatform' + li;
    const cx = (L.x0 + L.x1) * .5;
    const wallZ = cliffFaceZ(cx, L.y) + .14;
    const innerZ = wallZ + .18, outerZ = wallZ + 1.72;
    const length = L.x1 - L.x0;
    /* 两根纵梁、挑梁和短斜撑直接锚入崖体。 */
    register(beam(new THREE.Vector3(L.x0,L.y-.18,innerZ+.20),new THREE.Vector3(L.x1,L.y-.18,innerZ+.20),.285,darkWood,12),grp,'long-beam',L.stage+.02);
    register(beam(new THREE.Vector3(L.x0,L.y-.18,outerZ-.16),new THREE.Vector3(L.x1,L.y-.18,outerZ-.16),.305,darkWood,12),grp,'long-beam',L.stage+.03);
    const anchors = Math.max(4, Math.round(length/4.2));
    for (let i=0;i<anchors;i++) {
      const x=lerp(L.x0+.65,L.x1-.65,i/Math.max(1,anchors-1));
      const localWall=cliffFaceZ(x,L.y)+.08;
      register(box(x,L.y-.20,localWall+.02,.46,.46,.16,ironMat),grp,'anchor-plate',L.stage+.045+i*.005);
      register(beam(new THREE.Vector3(x,L.y-.22,localWall-.72),new THREE.Vector3(x,L.y-.22,outerZ),.245,darkWood,12),grp,'anchor',L.stage+.05+i*.005);
      register(beam(new THREE.Vector3(x,L.y-1.75,localWall-.35),new THREE.Vector3(x,L.y-.30,outerZ-.12),.215,woodMat,12),grp,'brace',L.stage+.10+i*.005);
    }
    /* 横向铺板，每块仅约 1.3 米，明确读出窄台尺度。 */
    const pc=Math.max(10,Math.round(length/1.25));
    for(let i=0;i<pc;i++){
      const x=lerp(L.x0,L.x1,(i+.5)/pc),w=length/pc*.92;
      register(box(x,L.y,lerp(innerZ,outerZ,.52),w,.56,2.78),grp,'plank',L.stage+.18+i*.003);
    }
    /* 外侧低护栏；靠崖一侧保持开放，避免现代脚手架盒子。 */
    const posts=Math.max(4,Math.round(length/4.0));
    for(let i=0;i<posts;i++){
      const x=lerp(L.x0,L.x1,i/Math.max(1,posts-1));
      register(beam(new THREE.Vector3(x,L.y,outerZ+.04),new THREE.Vector3(x,L.y+1.55,outerZ+.04),.165,darkWood,10),grp,'rail-post',L.stage+.28+i*.004);
    }
    for(const h of [.78,1.48]) register(beam(new THREE.Vector3(L.x0,L.y+h,outerZ+.04),new THREE.Vector3(L.x1,L.y+h,outerZ+.04),.150,darkWood,10),grp,'rail',L.stage+.34+h*.01);
    grp.userData.wallZ=wallZ;grp.userData.innerZ=innerZ;grp.userData.outerZ=outerZ;
    /* dark contact band at the anchoring line makes the timber visibly bite into the cliff. */
    const shadowMat=new THREE.MeshBasicMaterial({color:0x1F160F,transparent:true,opacity:.34,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4});
    const contact=new THREE.Mesh(new THREE.PlaneGeometry(length,1.55),shadowMat);contact.position.set(cx,L.y-.42,wallZ+.06);contact.rotation.x=0;grp.add(contact);
    L.z0=innerZ; L.z1=outerZ;
    segs.push(grp);G.add(grp);return grp;
  }
  const platformGroups=levels.map(buildPlatform);

  /* 最高工作层的木质遮棚，参考视频中的贴崖屋檐，而非现代门式吊架。 */
  {
    const grp=new THREE.Group(); grp.name='HistoricTopCanopy';
    const z=platformGroups[2].userData.wallZ+1.18;
    const roof=box(1.1,35.55,z,8.8,.38,3.35,darkWood);
    roof.rotation.x=-0.035; register(roof,grp,'canopy-roof',1.80);
    for(let i=0;i<5;i++){
      const x=lerp(-2.8,5.0,i/4);
      register(beam(new THREE.Vector3(x,31.35,z-.85),new THREE.Vector3(x,35.60,z-.35),.085,darkWood,7),grp,'canopy-bracket',1.84+i*.004);
    }
    G.add(grp);segs.push(grp);
  }

  function buildStair(a,b,x0,x1,stage,name){
    const grp=new THREE.Group();grp.name=name;
    const z0=platformGroups[a].userData.outerZ-.46;
    const z1=platformGroups[b].userData.outerZ-.46;
    const steps=18;
    for(let i=0;i<steps;i++){
      const k=i/(steps-1),x=lerp(x0,x1,k),y=lerp(levels[a].y+.20,levels[b].y-.20,k),z=lerp(z0,z1,k);
      register(box(x,y,z,2.05,.66,2.65),grp,'stair-step',stage+i*.014);
    }
    for(const dz of [-.46,.46]) register(beam(new THREE.Vector3(x0,levels[a].y-.05,z0+dz),new THREE.Vector3(x1,levels[b].y-.45,z1+dz),.275,darkWood,12),grp,'stair-stringer',stage-.03);
    /* 仅外侧单栏杆，形成参考中的轻薄折线。 */
    register(beam(new THREE.Vector3(x0,levels[a].y+1.20,z0+.62),new THREE.Vector3(x1,levels[b].y+.78,z1+.62),.170,darkWood,10),grp,'stair-rail',stage+.28);
    segs.push(grp);G.add(grp);
  }
  buildStair(0,1,-11.0,8.0,.92,'LowerSwitchbackStair');
  buildStair(1,2,8.0,-3.0,2.18,'UpperSwitchbackStair');

  /* 窟门前只保留一块短工作台和简单木架，不再出现大型吊装门架。 */
  {
    const grp=new THREE.Group();grp.name='EntranceWorkLanding';
    const wallZ=platformGroups[2].userData.wallZ,outerZ=platformGroups[2].userData.outerZ;
    for(let i=0;i<6;i++) register(box(lerp(-3.7,3.7,i/5),31.15,(wallZ+outerZ)*.5,1.24,.28,2.35),grp,'landing',3.18+i*.012);
    for(const sx of [-1,1]){
      const x=sx*3.85;
      register(beam(new THREE.Vector3(x,31.05,wallZ-.55),new THREE.Vector3(x,31.05,outerZ),.095,darkWood,7),grp,'anchor',3.14);
      register(beam(new THREE.Vector3(x,29.55,wallZ-.20),new THREE.Vector3(x,31.05,outerZ-.08),.075,woodMat,7),grp,'brace',3.16);
    }
    const handWinch=new THREE.Mesh(new THREE.CylinderGeometry(.23,.23,.82,10),ironMat);
    handWinch.rotation.z=Math.PI/2;handWinch.position.set(3.15,31.82,outerZ-.10);register(handWinch,grp,'hand-winch',3.30);
    segs.push(grp);G.add(grp);
  }

  components.sort((a,b)=>(a.userData.stage-b.userData.stage)||(a.userData.order-b.userData.order));
  components.forEach((m,i)=>{m.userData.order=i;});
  G.userData.segs=segs;G.userData.components=components;G.userData.materialYard=materialYard;
  G.userData.hoistTop=new THREE.Vector3(-3.7,35.8,platformGroups[2].userData.outerZ-.2);
  G.userData.levels=levels;
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
  const small = new THREE.Group(); small.name = 'SmallCaveDetails'; G.add(small); WORLD.smallCaves = small;
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
    small.add(hole);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 2.4, h + 2.4, 0.8), trim);
    fr.position.set(x, y + h / 2, z + 0.3);
    small.add(fr);
  }
}

/* ------------------------------------------------------------
   九层楼前场：崖体凹槽、台阶、石铺广场与自然绿化。
   仅在开场/终景启用，建立“建筑嵌入崖体”与前中后景关系。
   ------------------------------------------------------------ */
function buildForecourt() {
  const G = new THREE.Group();
  G.name = 'HistoricalForecourt';

  const stoneMat = new THREE.MeshStandardMaterial({
    map: TEX.ground.map, normalMap: TEX.ground.normal,
    color: 0xA99F8D, roughness: 0.97, metalness: 0,
  });
  stoneMat.normalScale.set(1.2, 1.2);

  /* 略有高差和磨损的广场，不再是无限重复灰砖。 */
  {
    const g = new THREE.PlaneGeometry(150, 138, 42, 38);
    g.rotateX(-Math.PI / 2);
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), z = pa.getZ(i) + CLIFF_Z + 78;
      const crown = (fbm2(x * 0.025 + 2, z * 0.024 + 9, 3, 31) - 0.5) * 0.26;
      const worn = smoothstep(22, 4, Math.abs(x)) * smoothstep(CLIFF_Z + 128, CLIFF_Z + 18, z);
      pa.setXYZ(i, x, 0.10 + crown * (1 - worn * 0.68), z);
    }
    pa.needsUpdate = true; g.computeVertexNormals();
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 13, uv.getY(i) * 12);
    const m = new THREE.Mesh(g, stoneMat); m.receiveShadow = true; G.add(m); G.userData.plaza = m;
  }

  /* 九层楼基座与逐级台阶。 */
  {
    const stepMat = new THREE.MeshStandardMaterial({
      map: TEX.ground.map, normalMap: TEX.ground.normal, color: 0x9B907E, roughness: 0.98,
    });
    for (let i = 0; i < 6; i++) {
      const w = 39 + i * 2.2, d = 2.15, h = 0.28;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stepMat);
      m.position.set(0, 0.14 + i * 0.15, CLIFF_Z + 16.0 + i * 2.05);
      m.castShadow = m.receiveShadow = true; G.add(m);
    }
    const apron = new THREE.Mesh(new THREE.BoxGeometry(43, 0.72, 9.5), stepMat);
    apron.position.set(0, 0.36, CLIFF_Z + 12.5); apron.castShadow = apron.receiveShadow = true; G.add(apron);
  }

  /* 深色凹槽和不规则岩框：让塔楼真正“坐进”崖壁。 */
  {
    const cliffGroup = new THREE.Group(); cliffGroup.name = 'LegacyForecourtCliffFrame'; G.add(cliffGroup); G.userData.cliffGroup = cliffGroup;
    const sh = new THREE.Shape();
    sh.moveTo(-24.0, 0.4); sh.lineTo(-23.6, 32.0); sh.lineTo(-21.5, 43.0);
    sh.quadraticCurveTo(-13.0, 54.0, 0, 55.5);
    sh.quadraticCurveTo(13.5, 54.2, 21.8, 42.4);
    sh.lineTo(23.8, 31.0); sh.lineTo(24.0, 0.4); sh.closePath();
    const g = new THREE.ShapeGeometry(sh, 44);
    const mat = new THREE.MeshStandardMaterial({
      map: TEX.caveWall.map, normalMap: TEX.caveWall.normal,
      color: 0x635646, roughness: 1, side: THREE.DoubleSide,
      emissive: 0x1E1813, emissiveIntensity: 0.10,
    });
    const m = new THREE.Mesh(g, mat); m.position.set(0, 0, CLIFF_Z + 0.58); m.receiveShadow = true; cliffGroup.add(m); G.userData.recess = m;

    const frameMat = new THREE.MeshStandardMaterial({
      map: TEX.sandstone.map, normalMap: TEX.sandstone.normal, color: 0xC5AD86, roughness: 0.99,
    });
    const makeFrame = (side) => {
      const sh = new THREE.Shape();
      const q = side;
      sh.moveTo(q * 58, 0); sh.lineTo(q * 24.2, 0);
      sh.lineTo(q * 24.0, 29.0); sh.lineTo(q * 22.4, 39.5);
      sh.lineTo(q * 17.8, 47.0); sh.lineTo(q * 12.8, 53.0);
      sh.lineTo(q * 58, 59.5); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh,{depth:2.6,bevelEnabled:true,bevelThickness:.55,bevelSize:.55,bevelSegments:2,curveSegments:10});
      const m = new THREE.Mesh(g, frameMat); m.position.set(0,0,CLIFF_Z-2.0);
      m.castShadow = m.receiveShadow = true; return m;
    };
    cliffGroup.add(makeFrame(-1), makeFrame(1));
    const topShape = new THREE.Shape();
    topShape.moveTo(-16.0,52.0); topShape.lineTo(16.5,52.0); topShape.lineTo(26.0,61.5); topShape.lineTo(-27.0,61.5); topShape.closePath();
    const topRock = new THREE.Mesh(new THREE.ExtrudeGeometry(topShape,{depth:2.8,bevelEnabled:true,bevelThickness:.5,bevelSize:.5,bevelSegments:2}),frameMat);
    topRock.position.set(0,0,CLIFF_Z-2.1); topRock.castShadow=topRock.receiveShadow=true; cliffGroup.add(topRock);
  }

  /* 绿化采用不对称布置，作为尺度与前景遮挡。 */
  const treeData = [
    [-42, CLIFF_Z + 48, 10.5, 71], [46, CLIFF_Z + 53, 11.5, 72],
    [-61, CLIFF_Z + 88, 13.0, 73], [58, CLIFF_Z + 96, 12.2, 74],
    [-27, CLIFF_Z + 118, 9.5, 75], [31, CLIFF_Z + 126, 10.0, 76],
  ];
  for (const [x,z,h,seed] of treeData) {
    const tr = buildTree(h, seed); tr.position.set(x, 0.1, z); tr.scale.set(1.12, 0.98, 1.12); G.add(tr);
  }

  const shrubMat = new THREE.MeshStandardMaterial({
    map: TEX.leaf.map, transparent: true, alphaTest: 0.32, side: THREE.DoubleSide, roughness: 0.92,
  });
  for (let i = 0; i < 22; i++) {
    const side = i % 2 ? -1 : 1;
    const x = side * (24 + hash3(i, 9, 3) * 43);
    const z = CLIFF_Z + 28 + hash3(i, 17, 5) * 102;
    const s = 2.5 + hash3(i, 23, 7) * 3.2;
    const grp = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(s, s * 0.72), shrubMat);
      p.position.set(0, s * 0.25, 0); p.rotation.y = j * Math.PI / 3; grp.add(p);
    }
    grp.position.set(x, 0.08, z); G.add(grp);
  }

  /* 远处山体只露侧翼，保持蓝天轮廓而非整面沙墙。 */
  const mountainMat = new THREE.MeshStandardMaterial({
    map: TEX.sandstone.map, normalMap: TEX.sandstone.normal, color: 0xB7A285, roughness: 1,
  });
  for (const [x,y,z,sx,sy,sz,seed] of [
    [-142,31,-12,45,35,24,151],[142,34,-18,50,39,27,152],[-104,54,-31,40,24,25,153],[108,57,-34,43,27,26,154],
  ]) {
    const m = new THREE.Mesh(makeErodedRock(seed,sx,sy,sz), mountainMat);
    m.position.set(x,y,z); m.receiveShadow = m.castShadow = true; G.add(m);
  }

  G.visible = false;
  return G;
}
