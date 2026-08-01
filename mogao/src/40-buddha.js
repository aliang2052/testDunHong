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

/*
  一体化坐姿下身：前表面同时包含双膝、垂腿、骨盆与袈裟褶，
  避免旋转体“花瓶”轮廓，也避免多个球体叠成香肠。
*/
function buildSeatedRobeGeometry() {
  const g = buildBuddhaAssetGeometry('lower');
  attachRockMorph(g, 1.0);
  return g;
}


/* ------------------------------------------------------------------
   新一代坐佛主体资产：封闭 loft，而非绕轴旋转体。
   肩胸、腹部和颈部拥有独立宽度/深度曲线，正面含胸肌、腹部和锁骨起伏。
   ------------------------------------------------------------------ */
function buildAnatomicalTorsoGeometry() {
  const g = buildBuddhaAssetGeometry('torso');
  /* Reference-led taper: compact waist, expanding rib cage, softened shoulder shelf and narrow neck. */
  const p=g.attributes.position;
  const taper=makeCurve1D([[17.8,.70],[19.4,.70],[21.3,.75],[23.3,.84],[25.2,.94],[26.6,.92],[27.7,.82],[29.3,.62]]);
  for(let i=0;i<p.count;i++){
    let x=p.getX(i),y=p.getY(i),z=p.getZ(i),s=taper(y);
    const front=smoothstep(-.6,4.9,z);
    const belly=Math.exp(-Math.pow((y-21.2)/1.75,2))*Math.exp(-Math.pow(x/4.2,4))*.26*front;
    const chest=Math.exp(-Math.pow((y-25.0)/1.45,2))*Math.exp(-Math.pow(x/5.0,4))*.16*front;
    x*=s;z+=belly+chest;
    p.setXYZ(i,x,y,z);
  }
  p.needsUpdate=true;g.computeVertexNormals();
  attachRockMorph(g, 1.0);
  return g;
}

const HEAD_FORM={cx:0,cy:32.02,cz:1.82,rx:2.94,ry:3.50,rz:2.78};
function headFrontZ(x,y){
  const nx=x/HEAD_FORM.rx,ny=(y-HEAD_FORM.cy)/HEAD_FORM.ry;
  const ell=Math.sqrt(Math.max(.012,1-nx*nx-ny*ny));
  const ellZ=HEAD_FORM.cz+HEAD_FORM.rz*ell;
  const faceMask=Math.exp(-Math.pow(x/2.72,6))*smoothstep(29.25,30.05,y)*smoothstep(35.05,34.25,y);
  const cheek=(Math.exp(-Math.pow((x-1.48)/1.08,2))+Math.exp(-Math.pow((x+1.48)/1.08,2)))*Math.exp(-Math.pow((y-31.68)/1.08,2))*.13;
  const chin=Math.exp(-Math.pow(x/1.18,4))*Math.exp(-Math.pow((y-29.78)/.48,2))*.12;
  const browPlane=Math.exp(-Math.pow(x/2.25,4))*Math.exp(-Math.pow((y-32.72)/.72,2))*.055;
  const plane=HEAD_FORM.cz+2.64+cheek+chin+browPlane;
  return lerp(ellZ,plane,faceMask*.62);
}
function headSurfacePoint(x,y,lift=0,out){
  const p=out||new THREE.Vector3(),z=headFrontZ(x,y);
  const eps=.008;
  const dzdx=(headFrontZ(x+eps,y)-headFrontZ(x-eps,y))/(eps*2);
  const dzdy=(headFrontZ(x,y+eps)-headFrontZ(x,y-eps))/(eps*2);
  const n=new THREE.Vector3(-dzdx,-dzdy,1).normalize();
  p.set(x,y,z).addScaledVector(n,lift);p.userDataNormal=n;return p;
}
function headSurfaceNormal(x,y,out){
  const eps=.008,n=out||new THREE.Vector3();
  const dzdx=(headFrontZ(x+eps,y)-headFrontZ(x-eps,y))/(eps*2);
  const dzdy=(headFrontZ(x,y+eps)-headFrontZ(x,y-eps))/(eps*2);
  return n.set(-dzdx,-dzdy,1).normalize();
}
function buildAnatomicalHeadGeometry(){
  const g=buildBuddhaAssetGeometry('head'),p=g.attributes.position;
  /* Preserve the closed asset while adding a readable brow/nose/chin relief at full-body distance. */
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),front=smoothstep(1.0,5.2,z);
    const nose=Math.exp(-Math.pow(x/.42,2))*Math.exp(-Math.pow((y-31.75)/1.12,2))*.22;
    const brow=(Math.exp(-Math.pow((x-1.02)/.68,2))+Math.exp(-Math.pow((x+1.02)/.68,2)))*Math.exp(-Math.pow((y-32.55)/.30,2))*.075;
    const chin=Math.exp(-Math.pow(x/.82,4))*Math.exp(-Math.pow((y-29.85)/.42,2))*.07;
    p.setZ(i,z+(nose+brow+chin)*front);
  }
  p.needsUpdate=true;g.computeVertexNormals();attachRockMorph(g,1.0);
  return g;
}

function buildBuddha() {
  const G = new THREE.Group();
  BUDDHA.group = G;
  const upperBody = new THREE.Group();
  upperBody.name = 'CompressedAnatomicalUpperBody';
  G.add(upperBody);
  BUDDHA.parts.upperBody = upperBody;
  const headGroup = new THREE.Group();
  headGroup.name = 'ProportionalHeadAssembly';
  G.add(headGroup);
  BUDDHA.parts.headAssembly = headGroup;

  /* ---------------- 材质 ---------------- */
  const matSkin = makeStageMaterial({
    finalMap: TEX.skin.map, finalTint: new THREE.Color(0.91, 0.82, 0.70), finalScale: [1/7, 1/7], mudScale: [1/2.4, 1/2.4], rockScale: [1/3.6, 1/3.6],
    roughSet: [1.0, 0.97, 0.94, 0.88, 0.78, 0.66, 0.74], normalScale: 1.0,
  });
  const matRobe = makeStageMaterial({
    finalMap: TEX.robeRed.map, finalTint: new THREE.Color(0.78, 0.70, 0.62), finalScale: [1/5.5, 1/5.5], mudScale: [1/2.4, 1/2.4], rockScale: [1/3.6, 1/3.6],
    roughSet: [1.0, 0.97, 0.94, 0.88, 0.76, 0.60, 0.68], normalScale: 1.1,
  });
  const matRobeLower = makeStageMaterial({
    finalMap: TEX.robeRed.map, finalTint: new THREE.Color(0.80, 0.72, 0.64), finalScale: [1/6.5, 1/6.5], mudScale: [1/2.8, 1/2.8], rockScale: [1/4.0, 1/4.0],
    roughSet: [1.0, 0.97, 0.94, 0.88, 0.76, 0.60, 0.68], normalScale: 1.1,
  });
  matRobeLower.side = THREE.DoubleSide;
  matRobeLower.needsUpdate = true;
  if (matRobeLower.userData && matRobeLower.userData.U) matRobeLower.userData.U.uNormalAmt.value = 0.88;

  const matInner = makeStageMaterial({
    finalMap: TEX.innerBlue.map, finalTint: new THREE.Color(0.70, 0.75, 0.76), finalScale: [1/8.5, 1/8.5], mudScale: [1/2.4, 1/2.4], rockScale: [1/3.6, 1/3.6],
    roughSet: [1.0, 0.97, 0.94, 0.88, 0.76, 0.60, 0.70], normalScale: 1.0,
  });
  const matSash = makeStageMaterial({
    finalMap: TEX.sash.map, finalTint: new THREE.Color(0.74, 0.70, 0.58), finalScale: [1/8, 1/8], mudScale: [1/2.4, 1/2.4], rockScale: [1/3.6, 1/3.6],
    roughSet: [1.0, 0.97, 0.94, 0.88, 0.76, 0.60, 0.70], normalScale: 1.0,
  });
  const matBelt = makeStageMaterial({
    finalMap: TEX.skin.map, finalScale: [1/5, 1/5],
    finalTint: new THREE.Color(0.072, 0.192, 0.330),
    mudScale: [1/2.4, 1/2.4], rockScale: [1/3.6, 1/3.6], roughSet: [1.0, 0.97, 0.94, 0.88, 0.76, 0.60, 0.70],
  });
  const matHair = makeStageMaterial({
    finalMap: TEX.hair.map, finalNormal: TEX.hair.normal, finalScale: [1/1.85, 1/1.85],
    finalTint: new THREE.Color(0.25, 0.23, 0.21),
    mudScale: [1/1.4, 1/1.4], rockScale: [1/1.6, 1/1.6],
    roughSet: [1.0, 0.97, 0.94, 0.86, 0.72, 0.55, 0.78], normalScale: 0.4,
  });
  BUDDHA.parts.mats = { matSkin, matRobe, matRobeLower, matInner, matSash, matBelt, matHair };

  /* ---------------- 1. 下身：赭红大裙 ---------------- */
  const gLower = buildSeatedRobeGeometry();
  const mLower = new THREE.Mesh(gLower, matRobeLower);
  mLower.castShadow = mLower.receiveShadow = true;
  mLower.visible = false; // frozen SDF lower body kept only for reproducibility; the readable lotus assembly is used below.
  G.add(mLower); BUDDHA.parts.lower = mLower;
  buildReferenceLotusLower(G, matRobeLower);
  buildWaistRobeBridge(G, matRobeLower);
  buildKneeRobeRelief(G, matRobeLower);

  /* ---------------- 2. 躯干皮肤（胸口裸露部分） ---------------- */
  const gTorso = buildAnatomicalTorsoGeometry();
  const mTorso = new THREE.Mesh(gTorso, matSkin);
  mTorso.castShadow = mTorso.receiveShadow = true;
  upperBody.add(mTorso); BUDDHA.parts.torso = mTorso;

  /* ---------------- 3. 头 ---------------- */
  const gHead = buildAnatomicalHeadGeometry();
  const mHead = new THREE.Mesh(gHead, matSkin);
  mHead.castShadow = mHead.receiveShadow = true;
  headGroup.add(mHead); BUDDHA.parts.head = mHead;
  buildNeck(headGroup, matSkin);

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
  attachRockMorph(gInner, 0.995);
  const mInner = new THREE.Mesh(gInner, matInner);
  mInner.castShadow = mInner.receiveShadow = true;
  mInner.visible = false; upperBody.add(mInner); BUDDHA.parts.inner = mInner;

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
  attachRockMorph(gSash, 0.995);
  const mSash = new THREE.Mesh(gSash, matSash);
  mSash.castShadow = mSash.receiveShadow = true;
  mSash.visible = false; upperBody.add(mSash); BUDDHA.parts.sash = mSash;

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
  attachRockMorph(gRobe, 0.995);
  const mRobe = new THREE.Mesh(gRobe, matRobe);
  mRobe.castShadow = mRobe.receiveShadow = true;
  mRobe.visible = false; upperBody.add(mRobe); BUDDHA.parts.robe = mRobe;

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
  attachRockMorph(gBelt, 0.995);
  const mBelt = new THREE.Mesh(gBelt, matBelt);
  mBelt.visible = false; upperBody.add(mBelt); BUDDHA.parts.belt = mBelt;

  /* 真实凸起的衣褶、领口与袈裟边缘。 */
  /* legacy axisymmetric robe shells disabled; fitted panels are built below. */
  buildFittedRobePanels(upperBody, matRobe, matInner, matSash, matSkin);
  buildShoulderGarmentMasses(upperBody, matInner, matRobe);

  /* ---------------- 8. 螺发 ---------------- */
  buildHair(headGroup, matHair);

  /* ---------------- 9. 五官 ---------------- */
  buildFace(headGroup, matSkin);

  /* ---------------- 10. 手臂与手 ---------------- */
  buildArms(upperBody, matSkin, matInner, matRobe);

  /* 下身完全由盘坐双腿与袈裟覆盖，不再额外挂出两只脚。 */

  /* ---------------- 12. 耳 ---------------- */
  buildEars(headGroup, matSkin);

  /* ---------------- 13. 头光（上色阶段淡入） ---------------- */
  buildHalo3D(headGroup);

  /* Shorten the ribcage-to-pelvis span without compressing the head.  This is a group
     transform around the waist, so all arm/robe contact relationships remain deterministic. */
  const upperYScale = 0.82, upperPivotY = 18.0;
  upperBody.scale.set(0.97, upperYScale, 1.02);
  upperBody.position.set(0, upperPivotY * (1 - upperYScale), 0);
  const hs = 1.22, hpY = 31.85, hpZ = 1.82;
  headGroup.scale.setScalar(hs);
  headGroup.position.set(0, (1 - hs) * hpY - 0.86, (1 - hs) * hpZ + 0.08);
  G.position.set(0, 0, 0);
  return G;
}

/* ------------------------------------------------------------
   Reference-led lotus lower body. Separate knees, crossed shins, compact pelvis and
   a narrow central apron replace the previous pear-shaped continuous shell.
   Every mesh shares the deterministic stage material and rock morph.
   ------------------------------------------------------------ */
function buildReferenceLotusLower(G, mat) {
  const group = new THREE.Group(); group.name = 'ReferenceLotusLower';
  const addEllipsoid = (name, pos, scale, kind = 'soft', rotY = 0) => {
    const geo = new THREE.SphereGeometry(1, 72, 52), pa = geo.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      let x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      const front = smoothstep(-0.55, 0.98, z);
      if (kind === 'knee') {
        y *= 0.90;
        z += front * (0.15 + (1 - Math.min(1, x*x + y*y)) * 0.12);
        z += Math.sin((y + Math.abs(x) * 0.72) * Math.PI * 2.4) * 0.030 * front * smoothstep(-0.95, 0.25, y);
        if (y < -0.50) y = -0.50 + (y + 0.50) * 0.25;
        x *= 1.03 + smoothstep(-0.1, -1.0, y) * 0.06;
      } else if (kind === 'pelvis') {
        y *= 0.72; z += front * 0.08;
      } else if (kind === 'cushion') {
        y *= 0.72; z += front * 0.05;
      }
      pa.setXYZ(i, x, y, z);
    }
    pa.needsUpdate = true; geo.computeVertexNormals(); scaleUV(geo, 4.5);
    const mesh = new THREE.Mesh(geo, mat); mesh.name = name; mesh.position.copy(pos); mesh.scale.copy(scale); mesh.rotation.y = rotY;
    mesh.castShadow = mesh.receiveShadow = true; attachRockMorphMesh(mesh); group.add(mesh); return mesh;
  };
  const addTube = (name, points, r0, r1 = r0) => {
    const geo = tubeAlong(points, t => lerp(r0, r1, t), 72, 22); scaleUV(geo, 4.0); attachRockMorph(geo, 0.99);
    const mesh = new THREE.Mesh(geo, mat); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh;
  };

  addEllipsoid('lotus-cushion', new THREE.Vector3(0, 1.18, 0.42), new THREE.Vector3(9.55, .82, 3.82), 'cushion');
  /* Crossed shins sit in front of the cushion and remain individually readable. */
  addTube('crossed-shin-left', [new THREE.Vector3(-7.15,3.05,2.92), new THREE.Vector3(-3.15,3.95,4.58), new THREE.Vector3(1.65,4.55,5.08)], 1.28, 1.06);
  addTube('crossed-shin-right', [new THREE.Vector3(7.15,3.05,2.86), new THREE.Vector3(3.15,3.92,4.48), new THREE.Vector3(-1.68,4.48,4.96)], 1.28, 1.04);
  /* Broad, low knee crowns create the iconic horizontal lotus silhouette. */
  addEllipsoid('knee-screen-left', new THREE.Vector3(-5.45,9.65,4.34), new THREE.Vector3(5.35,3.62,4.72), 'knee', -0.045);
  addEllipsoid('knee-screen-right', new THREE.Vector3(5.45,9.65,4.34), new THREE.Vector3(5.35,3.62,4.72), 'knee', 0.045);
  addTube('thigh-screen-left', [new THREE.Vector3(-5.30,11.20,2.62), new THREE.Vector3(-4.10,13.65,2.02), new THREE.Vector3(-2.35,15.75,1.40)], 2.62, 2.15);
  addTube('thigh-screen-right', [new THREE.Vector3(5.30,11.20,2.62), new THREE.Vector3(4.10,13.65,2.02), new THREE.Vector3(2.35,15.75,1.40)], 2.62, 2.15);
  addEllipsoid('compact-pelvis', new THREE.Vector3(0,16.55,0.82), new THREE.Vector3(5.50,2.05,3.48), 'pelvis');

  /* Broad lap drape connects the compact waist to both knees. Its double crown and central
     valley make the lotus posture legible without returning to a pear-shaped shell. */
  {
    const nx=96, ny=58, stride=nx+1, pos=[], uv=[], idx=[];
    const widthAt=makeCurve1D([[9.5,9.55],[11.0,9.28],[12.8,8.52],[14.8,7.12],[17.6,5.35]]);
    const frontAt=makeCurve1D([[9.5,8.18],[11.0,8.04],[12.8,7.08],[14.8,5.55],[17.6,3.96]]);
    for(let j=0;j<=ny;j++){
      const v=j/ny,y=lerp(9.5,17.6,v),w=widthAt(y),zf=frontAt(y);
      for(let i=0;i<=nx;i++){
        const u=i/nx,x=lerp(-w,w,u),edge=Math.pow(Math.abs(u-.5)*2,1.55);
        const crown=(Math.exp(-Math.pow((x-5.15)/2.45,2))+Math.exp(-Math.pow((x+5.15)/2.45,2)))*Math.exp(-Math.pow((y-10.8)/2.7,2));
        const valley=Math.exp(-Math.pow(x/1.15,2))*Math.exp(-Math.pow((y-11.3)/3.0,2));
        const fold=Math.sin((y+edge*4.25)*TAU/2.35)*(.085-.030*v)*(1-edge*.58);
        const gravity=Math.sin(x*1.15+y*.14)*.040*Math.sin(v*Math.PI)*(1-edge*.4);
        const z=zf-edge*.20+crown*.26-valley*.62+fold+gravity;
        pos.push(x,y,z);uv.push(u*7.2,v*7.0);
      }
    }
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=j*stride+i,b=a+1,d=a+stride,c=d+1;idx.push(a,b,d,b,c,d);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();attachRockMorph(geo,.99);
    const mesh=new THREE.Mesh(geo,mat);mesh.name='broad-lap-drape';mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  }

  /* Narrow front apron bridges the lap without erasing the two-knee valley. */
  const nx=60, ny=64, stride=nx+1, pos=[], uv=[], idx=[];
  for(let j=0;j<=ny;j++){
    const v=j/ny, y=lerp(5.15,11.85,v), half=lerp(1.35,2.28,Math.sin(v*Math.PI));
    for(let i=0;i<=nx;i++){
      const u=i/nx, x=lerp(-half,half,u), edge=Math.pow(Math.abs(u-.5)*2,1.55);
      const z=lerp(5.62,7.12,v)-edge*.18 + Math.sin((y+edge*3.2)*TAU/2.15)*.062*(1-edge*.52);
      pos.push(x,y,z);uv.push(u*4.2,v*8.0);
    }
  }
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=j*stride+i,b=a+1,d=a+stride,c=d+1;idx.push(a,b,d,b,c,d);}
  const apronGeo=new THREE.BufferGeometry();apronGeo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));apronGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));apronGeo.setIndex(idx);apronGeo.computeVertexNormals();attachRockMorph(apronGeo,.99);
  const apron=new THREE.Mesh(apronGeo,mat);apron.name='narrow-central-apron';apron.castShadow=apron.receiveShadow=true;group.add(apron);

  /* Shallow nested lap folds use the same clay/paint material and hug the drape surface. */
  for(let row=0;row<4;row++){
    const pts=[],baseY=11.15+row*1.22,span=lerp(7.45,5.15,row/3);
    for(let i=0;i<=42;i++){
      const q=i/42,x=lerp(-span,span,q),edge=Math.pow(Math.abs(q-.5)*2,1.55);
      const y=baseY+edge*(.64+row*.06),v=clamp((y-9.5)/(17.6-9.5),0,1),w=lerp(9.10,4.55,v),zf=lerp(8.06,3.82,v);
      const z=zf-Math.pow(Math.abs(x)/Math.max(.1,w),1.55)*.18+.055;
      pts.push(new THREE.Vector3(x,y,z));
    }
    const fg=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),78,.042+row*.004,8,false);scaleUV(fg,1.1);attachRockMorph(fg,.995);
    const fm=new THREE.Mesh(fg,mat);fm.receiveShadow=true;group.add(fm);
  }
  group.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});
  G.add(group); BUDDHA.parts.referenceLotusLower=group;
}

/* ------------------------------------------------------------
   双膝前袈裟面：一张连续弧面覆盖盘坐腿部，保留两膝外轮廓，
   同时以真实顶点位移形成腹部垂坠和膝上 U 形褶。
   ------------------------------------------------------------ */
function buildLowerFrontRobePanel(G, mat){
  const nx=88,ny=82,stride=nx+1,pos=[],uv=[],idx=[];
  const widthAt=makeCurve1D([[3.0,5.55],[5.0,5.75],[9.2,4.55],[12.2,3.35],[15.0,2.70],[17.7,2.20]]);
  const frontAt=makeCurve1D([[3.0,6.25],[5.0,6.72],[9.2,7.18],[12.2,6.76],[15.0,5.42],[17.7,4.25]]);
  for(let j=0;j<=ny;j++){
    const v=j/ny,y=lerp(3.0,17.7,v),w=widthAt(y),zf=frontAt(y);
    for(let i=0;i<=nx;i++){
      const u=i/nx,x=lerp(-w,w,u),edge=Math.pow(Math.abs(u-.5)*2,1.65);
      const center=Math.exp(-Math.pow(x/(w*.19),2))*Math.exp(-Math.pow((y-9.2)/3.5,2));
      const uFold=Math.sin((y+edge*4.6)*Math.PI*2/2.42)*(.060+.018*v)*(1-edge*.46);
      const gravity=(Math.sin(x*1.24+y*.15)*.045+Math.sin(x*2.20-y*.10)*.016)*smoothstep(2.8,5.8,y)*smoothstep(17.8,12.0,y);
      const z=zf-edge*.30-center*.18+uFold+gravity;
      pos.push(x,y,z);uv.push(u*7.0,v*8.5);
    }
  }
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=j*stride+i,b=a+1,d=a+stride,c=d+1;idx.push(a,b,d,b,c,d);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();attachRockMorph(geo,.995);
  const mesh=new THREE.Mesh(geo,mat);mesh.name='LowerFrontRobePanel';mesh.castShadow=mesh.receiveShadow=true;G.add(mesh);BUDDHA.parts.lowerFrontRobe=mesh;
}

/* ------------------------------------------------------------
   上部膝间袈裟：只连接骨盆与双膝上缘，保留下方清晰的两膝谷线。
   ------------------------------------------------------------ */
function buildKneeRobeRelief(G, mat){
  const group=new THREE.Group();group.name='KneeRobeRelief';
  for(const sx of [-1,1]){
    const geo=new THREE.SphereGeometry(1,52,30),pa=geo.attributes.position;
    for(let i=0;i<pa.count;i++){
      let x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i);
      const front=smoothstep(-.20,.95,z),edge=Math.max(0,1-x*x-y*y);
      z*=.48;z+=front*edge*.12;y*=.92;
      pa.setXYZ(i,x,y,z);
    }
    pa.needsUpdate=true;geo.computeVertexNormals();scaleUV(geo,3.5);
    const m=new THREE.Mesh(geo,mat);m.position.set(sx*5.05,10.65,6.62);m.scale.set(4.12,2.55,.72);m.rotation.z=-sx*.035;m.castShadow=false;m.receiveShadow=true;attachRockMorphMesh(m);group.add(m);
  }
  G.add(group);BUDDHA.parts.kneeRobeRelief=group;
}

function buildLapRobePanel(G,mat){
  const nx=84,ny=44,stride=nx+1,pos=[],uv=[],idx=[];
  const widthAt=makeCurve1D([[12.4,7.75],[14.0,7.15],[16.0,5.90],[18.15,4.35]]);
  const frontAt=makeCurve1D([[12.4,6.28],[14.0,5.82],[16.0,4.92],[18.15,4.05]]);
  for(let j=0;j<=ny;j++){
    const v=j/ny,y=lerp(12.4,18.15,v),w=widthAt(y),zf=frontAt(y);
    for(let i=0;i<=nx;i++){
      const u=i/nx,x=lerp(-w,w,u),edge=Math.pow(Math.abs(u-.5)*2,1.55);
      const center=Math.exp(-Math.pow(x/1.18,2))*Math.exp(-Math.pow((y-13.8)/1.65,2));
      const knee=(Math.exp(-Math.pow((x-4.65)/2.20,2))+Math.exp(-Math.pow((x+4.65)/2.20,2)))*Math.exp(-Math.pow((y-13.15)/2.10,2));
      const fold=Math.sin((y+edge*3.7)*TAU/2.12)*.060*(1-edge*.55);
      const z=zf-edge*.32-center*.42+knee*.30+fold;
      pos.push(x,y,z);uv.push(u*6.5,v*4.5);
    }
  }
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=j*stride+i,b=a+1,d=a+stride,c=d+1;idx.push(a,b,d,b,c,d);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();attachRockMorph(geo,.995);
  const mesh=new THREE.Mesh(geo,mat);mesh.name='LapRobePanel';mesh.castShadow=mesh.receiveShadow=true;G.add(mesh);BUDDHA.parts.lapRobe=mesh;
}

/* ------------------------------------------------------------
   腰腹袈裟连接层：将窄腰、骨盆和盘坐下身连续包裹，消除分段黑缝。
   几何为椭圆截面的轻微锥台，并带三道重力弧褶。
   ------------------------------------------------------------ */
function buildWaistRobeBridge(G, mat){
  const group=new THREE.Group();group.name='WaistRobeBridge';
  const geo=new THREE.CylinderGeometry(4.08,5.18,2.22,72,24,false),pa=geo.attributes.position;
  for(let i=0;i<pa.count;i++){
    let x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i);
    const yn=(y+1.11)/2.22,front=smoothstep(-.45,1,z);
    z*=.68; z+=front*(.18+Math.sin((yn*.82+.08)*Math.PI)*.10);
    x*=1-.035*Math.cos(yn*Math.PI);
    pa.setXYZ(i,x,y,z);
  }
  pa.needsUpdate=true;geo.computeVertexNormals();scaleUV(geo,4);attachRockMorph(geo,.995);
  const mesh=new THREE.Mesh(geo,mat);mesh.position.set(0,17.78,.62);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  const makeFold=(yy,span,drop)=>{
    const pts=[];for(let i=0;i<=38;i++){const q=i/38,x=lerp(-span,span,q),edge=Math.pow(Math.abs(q-.5)*2,1.62);pts.push(new THREE.Vector3(x,yy+edge*drop,4.04-edge*.10));}
    const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),72,.055,8,false);scaleUV(g,1);attachRockMorph(g,.995);const m=new THREE.Mesh(g,mat);m.castShadow=true;group.add(m);
  };
  makeFold(16.95,4.50,.40);makeFold(17.48,4.20,.34);makeFold(17.98,3.88,.28);
  G.add(group);BUDDHA.parts.waistBridge=group;
}

/* ------------------------------------------------------------
   下身袈裟实体褶：横跨双膝的嵌套 U 形褶与中央重力褶。
   这些是真实 TubeGeometry，不是贴图线条；灰泥、收光和彩绘阶段共用。
   ------------------------------------------------------------ */
function buildLowerRobeRelief(G, mat){
  const group=new THREE.Group();group.name='LowerRobeRelief';
  const makeTube=(pts,r)=>{const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),Math.max(32,pts.length*2),r,8,false);scaleUV(g,1.2);attachRockMorph(g,.995);const m=new THREE.Mesh(g,mat);m.castShadow=m.receiveShadow=true;group.add(m);return m;};
  for(let row=0;row<7;row++){
    const base=4.0+row*1.78,span=lerp(7.3,8.7,row/6),pts=[];
    for(let i=0;i<=42;i++){
      const q=i/42,x=lerp(-span,span,q),edge=Math.pow(Math.abs(x)/span,1.55);
      const y=base+edge*lerp(2.35,3.10,row/6);
      const lat=x/Math.max(6.0,BUDDHA_SURF_RX(y)),p=new THREE.Vector3(),n=new THREE.Vector3();
      buddhaSurfacePoint(lat,y,p,n);p.addScaledVector(n,.075+row*.004);pts.push(p);
    }
    makeTube(pts,.080+row*.006);
  }
  /* Four narrow gravity folds descend from the lap between and beside the knees. */
  for(const x0 of [-4.8,-1.65,1.65,4.8]){
    const pts=[];for(let i=0;i<=30;i++){
      const q=i/30,y=lerp(16.9,3.0,q),sway=Math.sin(q*Math.PI)*(.28*(x0>0?1:-1));
      const x=x0+sway,lat=x/Math.max(6.0,BUDDHA_SURF_RX(y)),p=new THREE.Vector3(),n=new THREE.Vector3();
      buddhaSurfacePoint(lat,y,p,n);p.addScaledVector(n,.065);pts.push(p);
    }makeTube(pts,.055);
  }
  G.add(group);BUDDHA.parts.lowerRobeRelief=group;
}

/* ------------------------------------------------------------
   坐佛的双膝、盘坐体量和肩峰：独立三维体块与主参数曲面融合。
   这些体块使用同一施工材质并拥有石胎 morph，因此各阶段都可 seek。
   ------------------------------------------------------------ */
function buildSeatedMasses(G, mat){
  const group=new THREE.Group();group.name='SeatedAnatomyMasses';
  const add=(name,pos,scale,rotY=0,deform='soft')=>{
    const geo=new THREE.SphereGeometry(1,58,42),pa=geo.attributes.position;
    for(let i=0;i<pa.count;i++){
      let x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i);
      if(deform==='knee'){
        const front=smoothstep(-.58,.96,z),bottom=smoothstep(-.20,-1.0,y);
        y*=.80; z+=front*(.12+(1-Math.min(1,x*x+y*y))*.12); x*=1+bottom*.08;
        if(y<-.42)y=-.42+(y+.42)*.30;
      }else if(deform==='thigh'){
        y*=.88;z+=smoothstep(-.45,1,z)*.10;x*=1.04;
      }else if(deform==='pelvis'){
        y*=.78;z+=smoothstep(-.5,1,z)*.08;
      }else if(deform==='drape'){
        y*=1.08;x*=.92;z+=smoothstep(-.5,1,z)*.06;
      }
      pa.setXYZ(i,x,y,z);
    }
    pa.needsUpdate=true;geo.computeVertexNormals();scaleUV(geo,4.2);
    const m=new THREE.Mesh(geo,mat);m.name=name;m.position.copy(pos);m.scale.copy(scale);m.rotation.y=rotY;
    m.castShadow=false;m.receiveShadow=true;attachRockMorphMesh(m);group.add(m);return m;
  };
  /* 宽膝是坐姿主轮廓；膝前缘明显前突，中央保留谷线。 */
  add('knee-screen-left',new THREE.Vector3(-5.55,12.75,4.92),new THREE.Vector3(5.55,3.55,5.18),-.055,'knee');
  add('knee-screen-right',new THREE.Vector3(5.55,12.75,4.92),new THREE.Vector3(5.55,3.55,5.18),.055,'knee');
  add('thigh-screen-left',new THREE.Vector3(-3.55,16.55,2.70),new THREE.Vector3(5.35,2.72,4.62),-.10,'thigh');
  add('thigh-screen-right',new THREE.Vector3(3.55,16.55,2.70),new THREE.Vector3(5.35,2.72,4.62),.10,'thigh');
  add('pelvis-bridge',new THREE.Vector3(0,18.55,1.12),new THREE.Vector3(6.75,2.18,4.05),0,'pelvis');
  /* 中央袈裟垂片薄而前伸，不把双膝再次填成梨形。 */
  add('central-drape',new THREE.Vector3(0,8.0,5.08),new THREE.Vector3(3.85,7.20,2.45),0,'drape');
  G.add(group);BUDDHA.parts.seatedMasses=group;
}

function buildNeck(G, mat){
  const group=new THREE.Group();group.name='AnatomicalNeck';
  const g=new THREE.CylinderGeometry(2.18,2.48,2.05,64,18,false),pa=g.attributes.position;
  for(let i=0;i<pa.count;i++){
    const x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i);const front=smoothstep(-.4,1,z);
    pa.setXYZ(i,x*(1-.05*front),y,z*.86+front*.12);
  }
  pa.needsUpdate=true;g.computeVertexNormals();scaleUV(g,4);const m=new THREE.Mesh(g,mat);m.position.set(0,29.25,1.36);m.castShadow=true;attachRockMorphMesh(m);group.add(m);
  for(let r=0;r<3;r++){
    const ring=new THREE.TorusGeometry(2.18-r*.10,.055,8,64);
    scaleUV(ring,1);
    const rm=new THREE.Mesh(ring,mat);
    rm.rotation.x=Math.PI/2;
    rm.position.set(0,28.63+r*.34,2.12+r*.01);
    rm.updateMatrix();
    attachRockMorphMesh(rm);
    rm.castShadow=true;
    group.add(rm);
  }
  G.add(group);BUDDHA.parts.neck=group;
}

function buildShoulderGarmentMasses(G, matInner, matRobe){
  const group=new THREE.Group();group.name='ConnectedShoulderGarmentMasses';
  for(const item of [
    {x:-5.45,y:25.28,z:1.02,sx:1.82,sy:1.36,sz:1.66,mat:matInner,rz:-.10},
    {x: 5.45,y:25.25,z:1.02,sx:1.86,sy:1.40,sz:1.68,mat:matRobe, rz:.10},
  ]){
    const g=new THREE.SphereGeometry(1,42,30),pa=g.attributes.position;
    for(let i=0;i<pa.count;i++){
      let x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i);
      const front=smoothstep(-.45,1,z),lower=smoothstep(.15,-1,y);
      z+=front*(.09+lower*.05);y*=.92;x*=1.0-lower*.04;
      pa.setXYZ(i,x,y,z);
    }
    pa.needsUpdate=true;g.computeVertexNormals();scaleUV(g,3.2);
    const m=new THREE.Mesh(g,item.mat);m.position.set(item.x,item.y,item.z);m.scale.set(item.sx,item.sy,item.sz);m.rotation.z=item.rz;m.castShadow=m.receiveShadow=true;attachRockMorphMesh(m);group.add(m);
  }
  G.add(group);BUDDHA.parts.shoulderGarments=group;
}

function buildShoulderMasses(G, mat){
  const group = new THREE.Group(); group.name = 'ShoulderMasses';
  for (const sx of [-1, 1]) {
    const geo = new THREE.SphereGeometry(1, 32, 24); scaleUV(geo, 3);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(sx * 6.78, 26.42, 0.34);
    m.scale.set(1.92, 1.22, 1.72);
    m.rotation.z = -sx * 0.08;
    m.castShadow = true; attachRockMorphMesh(m); group.add(m);
  }
  G.add(group); BUDDHA.parts.shoulderMasses = group;
}

/* ------------------------------------------------------------
   贴合新躯干资产的袈裟面片与立体褶。只覆盖胸腹正面，避免旧旋转壳体
   在肩部形成水平“飞碟”。灰泥阶段与身体同色，彩绘阶段材质分区可读。
   ------------------------------------------------------------ */
function buildFittedRobePanels(G, matRobe, matInner, matSash, matSkin) {
  const group = new THREE.Group();
  group.name = 'FittedRobePanels';
  const widthAt = makeCurve1D([[18.2,4.90],[20.0,5.10],[22.0,5.42],[24.2,5.78],[25.8,6.35],[26.6,5.95],[27.4,4.55],[28.2,2.95],[29.2,2.25]]);
  const depthAt = makeCurve1D([[18.2,3.05],[20.0,3.30],[22.0,3.66],[24.2,4.02],[25.8,4.05],[26.6,3.72],[27.4,3.02],[28.2,2.32],[29.2,1.92]]);
  const surf = (x, y, lift = 0.12, wave = 0) => {
    const W = widthAt(y);
    const q = clamp(x / Math.max(0.01, W), -0.995, 0.995);
    const ell = Math.sqrt(Math.max(0.012, 1 - q * q));
    const chest = (Math.exp(-Math.pow((x - 2.0) / 1.85, 2)) + Math.exp(-Math.pow((x + 2.0) / 1.85, 2))) * Math.exp(-Math.pow((y - 24.8) / 1.55, 2)) * 0.15;
    const belly = Math.exp(-Math.pow(x / 3.6, 4)) * Math.exp(-Math.pow((y - 21.1) / 1.7, 2)) * 0.16;
    return new THREE.Vector3(x, y, 0.78 + depthAt(y) * ell + chest + belly + lift + wave);
  };
  const makePanel = (name, mat, y0, y1, leftFn, rightFn, lift, waveAmp = 0.035) => {
    const nx = 64, ny = 72, pos = [], uv = [], idx = [], stride = nx + 1;
    for (let j = 0; j <= ny; j++) {
      const v = j / ny, y = lerp(y0, y1, v), L = leftFn(y, v), R = rightFn(y, v);
      for (let i = 0; i <= nx; i++) {
        const u = i / nx, x = lerp(L, R, u);
        const edge = Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
        const wave = Math.sin(u * Math.PI * 3.0 + v * 4.2) * waveAmp * edge;
        const p = surf(x, y, lift + edge * 0.045, wave);
        pos.push(p.x, p.y, p.z); uv.push(u * 5.5, v * 7.0);
      }
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = j * stride + i, b = a + 1, d = a + stride, c = d + 1;
      idx.push(a, b, d, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals(); attachRockMorph(geo, 0.992);
    const mesh = new THREE.Mesh(geo, mat); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
    return mesh;
  };
  const tube = (pts, radius, mat) => {
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.32), Math.max(42, pts.length * 3), radius, 9, false);
    scaleUV(geo, 1.5); attachRockMorph(geo, 0.99);
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  const edgeCurve = (y0, y1, xFn, lift, mat, radius = 0.075) => {
    const pts = [];
    for (let i = 0; i <= 32; i++) { const v = i / 32, y = lerp(y0, y1, v); pts.push(surf(xFn(y, v), y, lift)); }
    return tube(pts, radius, mat);
  };

  /* Viewer-left blue mantle: wraps the shoulder, narrows toward the waist and has a curved inner edge. */
  const blueL = (y, v) => -widthAt(y) + 0.20;
  const blueR = (y, v) => lerp(-1.55, 0.55, smoothstep(0.0, 1.0, v)) - Math.sin(v * Math.PI) * 0.30;
  makePanel('inner-blue', matInner, 18.55, 28.65, blueL, blueR, 0.16, 0.028);
  edgeCurve(18.55, 28.65, blueR, 0.235, matInner, 0.080);
  for (let f = 0; f < 3; f++) {
    const pts = [];
    for (let i = 0; i <= 28; i++) {
      const v = i / 28, y = lerp(19.0, 28.25, v);
      const x = lerp(-5.55 + f * 0.83, -2.25 + f * 0.48, v) + Math.sin(v * Math.PI) * 0.18;
      pts.push(surf(x, y, 0.245 + f * 0.004));
    }
    tube(pts, 0.048 + f * 0.004, matInner);
  }

  /* Central ochre sash: a broad diagonal layer with two raised borders and gravity folds. */
  const sashCenter = (y, v) => lerp(-0.95, 2.25, v) + Math.sin(v * Math.PI) * 0.18;
  const sashHalf = (y, v) => lerp(2.25, 2.65, Math.sin(v * Math.PI));
  const sashL = (y, v) => sashCenter(y, v) - sashHalf(y, v);
  const sashR = (y, v) => sashCenter(y, v) + sashHalf(y, v);
  makePanel('ochre-sash', matSash, 18.75, 28.55, sashL, sashR, 0.235, 0.032);
  edgeCurve(18.75, 28.55, sashL, 0.315, matSash, 0.085);
  edgeCurve(18.75, 28.55, sashR, 0.315, matSash, 0.075);
  for (let f = 0; f < 3; f++) {
    const pts = [];
    for (let i = 0; i <= 32; i++) {
      const q = i / 32;
      const y = 19.45 + f * 1.22 + q * (1.20 + f * 0.11) + Math.sin(q * Math.PI) * 0.34;
      const v = clamp((y - 18.75) / (28.55 - 18.75), 0, 1);
      const x = lerp(sashL(y, v) + 0.30, sashR(y, v) - 0.25, q);
      pts.push(surf(x, y, 0.34));
    }
    tube(pts, 0.060 + f * 0.005, matSash);
  }

  /* Viewer-right red outer robe: wraps the shoulder and overlaps the ochre layer down the abdomen. */
  const redL = (y, v) => lerp(0.75, 2.65, v) - Math.sin(v * Math.PI) * 0.22;
  const redR = (y, v) => widthAt(y) - 0.16;
  makePanel('outer-red', matRobe, 17.85, 29.00, redL, redR, 0.26, 0.030);
  edgeCurve(17.85, 29.00, redL, 0.355, matRobe, 0.095);
  for (let f = 0; f < 3; f++) {
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const v = i / 30, y = lerp(18.45 + f * 0.83, 27.9 - f * 0.16, v);
      const x = lerp(redR(y, v) - 0.65 - f * 0.35, redL(y, v) + 0.45, v) + Math.sin(v * Math.PI) * 0.24;
      pts.push(surf(x, y, 0.36));
    }
    tube(pts, 0.055 + f * 0.004, matRobe);
  }

  /* Soft neckline and lower overlap seams give the garment physical thickness. */
  const neckPts = [];
  for (let i = 0; i <= 34; i++) {
    const q = i / 34, x = lerp(-3.35, 3.55, q), y = 27.65 - Math.pow(Math.abs(q - 0.5) * 2, 1.65) * 0.42;
    neckPts.push(surf(x, y, 0.31));
  }
  tube(neckPts, 0.070, matSkin);

  G.add(group); BUDDHA.parts.fittedRobe = group;
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
  const addWorldCurve = (pts, radius, mat) => {
    if (pts.length < 3) return;
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.30), Math.max(32, pts.length * 3), radius, 8, false);
    scaleUV(geo, 1.8); attachRockMorph(geo, 0.985);
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; group.add(m);
  };

  /* 下裙 U 形褶直接铺在分开的双膝和垂腿体块前方。 */
  for (let r = 0; r < 9; r++) {
    const pts = [];
    const baseY = 2.45 + r * 1.55;
    for (let i = 0; i <= 34; i++) {
      const q = i / 34;
      const x = lerp(-8.25, 8.25, q);
      const edge = Math.pow(Math.abs(q - 0.5) * 2, 1.55);
      const y = baseY + edge * (1.02 + r * 0.045) + Math.sin(q * Math.PI * 2 + r * 0.45) * 0.045;
      const front = lerp(6.15, 8.05, r / 8) + Math.cos((q - 0.5) * Math.PI) * 0.24 - edge * 0.12;
      pts.push(new THREE.Vector3(x, y, front));
    }
    addWorldCurve(pts, 0.092 + r * 0.004, matLower);
  }
  /* 垂腿上的纵向细褶，强调倚坐而非瓶形。 */
  for (const sx of [-1, 1]) for (let c = -1; c <= 1; c++) {
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const q = i / 18;
      const y = lerp(1.15, 11.5, q);
      const x = sx * (4.58 + c * 0.68 + Math.sin(q * Math.PI * 1.5 + c) * 0.10);
      const z = 6.05 + Math.sin(q * Math.PI + c * 0.4) * 0.18 + (1 - q) * 0.12;
      pts.push(new THREE.Vector3(x, y, z));
    }
    addWorldCurve(pts, 0.060 + (c === 0 ? 0.012 : 0), matLower);
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
    addCurve(samples, 0.070, r < 3 ? matRobe : matSash, 0.25);
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
  const group=new THREE.Group();group.name='SculptedHair';const elements=[];
  /* 头皮帽按可变发际线直接生成，避免球帽切进额头。 */
  const pSeg=96,vSeg=34,pos=[],uv=[],idx=[];
  for(let j=0;j<=vSeg;j++){
    const q=j/vSeg;
    for(let i=0;i<=pSeg;i++){
      const phi=i/pSeg*TAU,front=Math.cos(phi)*.5+.5;
      const hairY=lerp(31.25,33.48,Math.pow(front,.34));
      const ny=clamp((hairY-HEAD_FORM.cy)/HEAD_FORM.ry,-.96,.96),thetaMax=Math.acos(ny);
      const theta=q*thetaMax,st=Math.sin(theta),ct=Math.cos(theta);
      const x=HEAD_FORM.rx*st*Math.sin(phi),y=HEAD_FORM.cy+HEAD_FORM.ry*ct,z=HEAD_FORM.cz+HEAD_FORM.rz*st*Math.cos(phi);
      const n=new THREE.Vector3(x/(HEAD_FORM.rx*HEAD_FORM.rx),(y-HEAD_FORM.cy)/(HEAD_FORM.ry*HEAD_FORM.ry),(z-HEAD_FORM.cz)/(HEAD_FORM.rz*HEAD_FORM.rz)).normalize();
      pos.push(x+n.x*.055,y+n.y*.055,z+n.z*.055);uv.push(i/pSeg*8,q*5);
    }
  }
  const stride=pSeg+1;for(let j=0;j<vSeg;j++)for(let i=0;i<pSeg;i++){const a=j*stride+i,b=a+1,d=a+stride,c=d+1;idx.push(a,b,d,b,c,d);}
  const capGeo=new THREE.BufferGeometry();capGeo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));capGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));capGeo.setIndex(idx);capGeo.computeVertexNormals();attachRockMorph(capGeo,.99);
  const cap=new THREE.Mesh(capGeo,mat);cap.castShadow=true;cap.userData.revealY=31.2;cap.userData.finalScale=new THREE.Vector3(1,1,1);group.add(cap);elements.push(cap);

  const zAxis=new THREE.Vector3(0,0,1),M=new THREE.Matrix4(),Q=new THREE.Quaternion(),S=new THREE.Vector3();
  const rows=14;
  for(let r=0;r<rows;r++){
    const qy=r/(rows-1),y=lerp(31.30,35.25,Math.pow(qy,.92));
    const ny=(y-HEAD_FORM.cy)/HEAD_FORM.ry,ring=Math.sqrt(Math.max(.015,1-ny*ny));
    const circumference=TAU*HEAD_FORM.rx*ring,count=Math.max(11,Math.round(circumference/.50));
    const parts=[];
    for(let i=0;i<count;i++){
      const phi=(i+(r%2)*.5)/count*TAU,front=Math.cos(phi)*.5+.5;
      const hairline=lerp(31.18,33.46,Math.pow(front,.34));if(y<hairline)continue;
      const x=HEAD_FORM.rx*ring*Math.sin(phi),z=HEAD_FORM.cz+HEAD_FORM.rz*ring*Math.cos(phi);
      const n=new THREE.Vector3(x/(HEAD_FORM.rx*HEAD_FORM.rx),ny/HEAD_FORM.ry,(z-HEAD_FORM.cz)/(HEAD_FORM.rz*HEAD_FORM.rz)).normalize();
      const size=.165+hash3(r,i,91)*.030;Q.setFromUnitVectors(zAxis,n);M.compose(new THREE.Vector3(x,y,z).addScaledVector(n,.095),Q,S.set(size*1.06,size*1.06,size*.68));
      const dome=new THREE.SphereGeometry(1,9,7,0,TAU,0,Math.PI*.72);dome.applyMatrix4(M);parts.push(dome);
    }
    if(!parts.length)continue;const geo=mergeGeometries(parts);scaleUV(geo,1.1);attachRockMorph(geo,.98);const row=new THREE.Mesh(geo,mat);row.castShadow=true;row.userData.revealY=y;row.userData.finalScale=new THREE.Vector3(1,1,1);group.add(row);elements.push(row);
  }
  group.userData.elements=elements;group.userData.revealMin=31.2;group.userData.revealMax=35.5;G.add(group);BUDDHA.parts.hair=group;
  const urnaMat=new THREE.MeshStandardMaterial({color:0x8B3027,roughness:.72,transparent:true,opacity:0});
  const urna=new THREE.Mesh(new THREE.SphereGeometry(.105,18,14),urnaMat);urna.position.copy(headSurfacePoint(0,32.93,.11,new THREE.Vector3()));urna.scale.set(1,1,.48);G.add(urna);BUDDHA.detailMats.push(urnaMat);BUDDHA.parts.urna=urna;
}

/* ------------------------------------------------------------
   五官：眉 / 眼 / 鼻 / 唇
   ------------------------------------------------------------ */
function buildFace(G, matSkin) {
  const lineMat=new THREE.MeshStandardMaterial({color:0x2E2926,roughness:.90,transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  const lipMat=new THREE.MeshStandardMaterial({color:0x98584E,roughness:.82,transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  const nostrilMat=new THREE.MeshStandardMaterial({color:0x2B211C,roughness:.96,transparent:true,opacity:0,depthWrite:false});
  BUDDHA.detailMats.push(lineMat,lipMat,nostrilMat);
  const addStage=(geo,pos,scale,rot)=>{const m=new THREE.Mesh(geo,matSkin);m.position.copy(pos);m.scale.copy(scale);if(rot)m.rotation.copy(rot);m.castShadow=true;attachRockMorphMesh(m);G.add(m);return m;};
  const curveOnFace=(x0,x1,yFn,lift,steps=36)=>{const pts=[];for(let i=0;i<=steps;i++){const q=i/steps,x=lerp(x0,x1,q),y=yFn(q);pts.push(headSurfacePoint(x,y,lift,new THREE.Vector3()));}return pts;};
  /* Soft eyelid ridges remain visible in unpainted clay. */
  for(const sx of [-1,1]){
    const ex=sx*1.03,rot=new THREE.Euler(0,0,-sx*.035);
    addStage(new THREE.SphereGeometry(1,32,20),headSurfacePoint(ex,32.30,.050,new THREE.Vector3()),new THREE.Vector3(.82,.085,.135),rot);
    const eyePts=curveOnFace(sx*.38,sx*1.72,q=>32.28-Math.sin(q*Math.PI)*.070,.145);
    G.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(eyePts),52,.026,8,false),lineMat));
    const browPts=curveOnFace(sx*.34,sx*1.86,q=>32.73+Math.sin(q*Math.PI)*.105-q*.035,.145);
    G.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(browPts),54,.040,9,false),lineMat));
    const nostril=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),nostrilMat);nostril.position.copy(headSurfacePoint(sx*.29,31.22,.18,new THREE.Vector3()));nostril.scale.set(.066,.031,.028);G.add(nostril);
  }
  /* Nose bridge, tip and clay lip ridges remain readable before colour is applied. */
  const noseBridge=new THREE.CapsuleGeometry(.255,1.15,8,24);noseBridge.translate(0,31.95,4.82);addStage(noseBridge,new THREE.Vector3(0,0,0),new THREE.Vector3(1,1,1),null);
  addStage(new THREE.SphereGeometry(1,28,20),new THREE.Vector3(0,31.18,5.14),new THREE.Vector3(.56,.37,.48),null);
  addStage(new THREE.SphereGeometry(1,28,18),new THREE.Vector3(0,30.70,4.92),new THREE.Vector3(.72,.095,.125),null);
  addStage(new THREE.SphereGeometry(1,28,18),new THREE.Vector3(0,30.48,4.90),new THREE.Vector3(.68,.105,.135),null);
  /* Mineral colour is a thin overlay on the sculpted lips, not a separate plastic part. */
  const upper=headSurfacePoint(0,30.72,.125,new THREE.Vector3()),lower=headSurfacePoint(0,30.50,.125,new THREE.Vector3());
  const um=new THREE.Mesh(new THREE.SphereGeometry(1,28,18),lipMat);um.position.copy(upper);um.scale.set(.68,.082,.045);G.add(um);
  const lm=new THREE.Mesh(new THREE.SphereGeometry(1,28,18),lipMat);lm.position.copy(lower);lm.scale.set(.65,.092,.045);G.add(lm);
  const mouthPts=curveOnFace(-.62,.62,q=>30.61+Math.cos((q-.5)*TAU)*.012,.17,38);
  G.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mouthPts),50,.020,8,false),lineMat));
  BUDDHA.parts.faceDetails=true;
}

/* 给已 position 好的 Mesh 附加石胎 morph（世界位置计算） */
function attachRockMorphMesh(mesh) {
  mesh.updateMatrix();
  const g = mesh.geometry;
  const p = g.attributes.position, normal = g.attributes.normal;
  const rp = new Float32Array(p.count * 3);
  const rn = new Float32Array(p.count * 3);
  const V = new THREE.Vector3(), N = new THREE.Vector3(), WN = new THREE.Vector3(), R = new THREE.Vector3();
  const inv = new THREE.Matrix4().copy(mesh.matrix).invert();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrix);
  const invNormal = new THREE.Matrix3().getNormalMatrix(inv);
  for (let i = 0; i < p.count; i++) {
    V.fromBufferAttribute(p, i);
    if (normal) N.fromBufferAttribute(normal, i).normalize(); else N.set(0,0,1);
    const world = V.clone().applyMatrix4(mesh.matrix);
    WN.copy(N).applyMatrix3(normalMatrix).normalize();
    const macro = fbm3(world.x*.19+8.2,world.y*.17+2.4,world.z*.21+4.6,4)-.5;
    const chip = ridge2(world.x*.31+world.z*.13,world.y*.23,3,31)-.5;
    R.copy(world).addScaledVector(WN, macro*.24-chip*.07).applyMatrix4(inv);
    const LN=WN.clone().applyMatrix3(invNormal).normalize();
    rp[i*3]=R.x;rp[i*3+1]=R.y;rp[i*3+2]=R.z;
    rn[i*3]=LN.x;rn[i*3+1]=LN.y;rn[i*3+2]=LN.z;
  }
  g.setAttribute('aRockPos',new THREE.BufferAttribute(rp,3));
  g.setAttribute('aRockNrm',new THREE.BufferAttribute(rn,3));
  return mesh;
}

/* ------------------------------------------------------------
   耳：大耳垂
   ------------------------------------------------------------ */
function buildEars(G, mat) {
  for(const sx of [-1,1]){
    const g=new THREE.SphereGeometry(1,36,28),pa=g.attributes.position;
    for(let i=0;i<pa.count;i++){
      const x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i),lower=clamp((-y+.05)/1.05,0,1);
      const side=.26+lower*.07;
      pa.setXYZ(i,x*side,y*1.58,z*(.42+lower*.12));
    }
    pa.needsUpdate=true;g.computeVertexNormals();scaleUV(g,3);
    const m=new THREE.Mesh(g,mat);m.position.set(sx*3.13,31.45,1.82);m.rotation.y=sx*.10;m.rotation.z=sx*.025;m.castShadow=true;attachRockMorphMesh(m);G.add(m);
    const pts=[];for(let i=0;i<=28;i++){const q=i/28,a=lerp(-1.05,1.05,q);pts.push(new THREE.Vector3(sx*(3.13-.04*Math.cos(a)),31.42+a*.86,2.25+.18*Math.cos(a)));}
    const ig=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),46,.038,8,false);scaleUV(ig,1);attachRockMorph(ig,.99);const im=new THREE.Mesh(ig,mat);im.castShadow=true;G.add(im);
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
      pa.setXYZ(i, x * 0.98 * taper, y * 1.44, z * (0.31 + (1 - y * y) * 0.055));
    }
    pa.needsUpdate = true; palm.computeVertexNormals();
  }
  parts.push(palm);
  const fingerLen = [1.50, 1.76, 1.84, 1.62];
  const fingerX = [-0.62, -0.20, 0.21, 0.62];
  const fingerR = [0.150, 0.165, 0.170, 0.152];
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
  const thumb = new THREE.CapsuleGeometry(0.160, 0.88, 5, 12);
  thumb.rotateZ(0.86); thumb.rotateY(-0.12); thumb.translate(-0.92, 0.16, 0.08);
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
  /* Viewer-left / Buddha-right: a connected upper arm, rising forearm and large abhaya palm. */
  {
    const shoulder=new THREE.Vector3(-5.55,25.55,.84),elbow=new THREE.Vector3(-6.55,19.55,2.82);
    const sleeve=buildSleeveGeometry(shoulder,elbow,2.24,1.56,.72);scaleUV(sleeve,4);attachRockMorph(sleeve);
    const sm=new THREE.Mesh(sleeve,matInner);sm.castShadow=sm.receiveShadow=true;G.add(sm);BUDDHA.parts.sleeveR=sm;
    const forePts=[elbow.clone().add(new THREE.Vector3(0,.05,.18)),new THREE.Vector3(-6.75,20.65,3.70),new THREE.Vector3(-6.78,22.10,4.68),new THREE.Vector3(-6.68,22.82,5.36)];
    const fg=tubeAlong(forePts,t=>lerp(1.12,.82,t),58,18);scaleUV(fg,5);attachRockMorph(fg);const fm=new THREE.Mesh(fg,matSkin);fm.castShadow=fm.receiveShadow=true;G.add(fm);BUDDHA.parts.armR=fm;
    const wrist=new THREE.Mesh(new THREE.CapsuleGeometry(.55,.64,8,20),matSkin);wrist.position.set(-6.68,22.88,5.42);wrist.castShadow=true;attachRockMorphMesh(wrist);G.add(wrist);
    const hg=buildHandGeometry(1.50);hg.rotateX(-.035);hg.rotateY(.018);hg.translate(-6.48,22.38,5.72);scaleUV(hg,3);attachRockMorph(hg);
    const hm=new THREE.Mesh(hg,matSkin);hm.castShadow=hm.receiveShadow=true;G.add(hm);BUDDHA.parts.handR=hm;
  }
  /* Viewer-right / Buddha-left: shoulder-wrapped robe, long descending forearm, hand resting on knee. */
  {
    const shoulder=new THREE.Vector3(5.55,25.50,.82),elbow=new THREE.Vector3(6.45,20.55,2.98);
    const sleeve=buildSleeveGeometry(shoulder,elbow,2.28,1.60,.86);scaleUV(sleeve,4);attachRockMorph(sleeve);
    const sm=new THREE.Mesh(sleeve,matRobe);sm.castShadow=sm.receiveShadow=true;G.add(sm);BUDDHA.parts.sleeveL=sm;
    const robeFore=[elbow.clone().add(new THREE.Vector3(0,.0,.18)),new THREE.Vector3(6.58,18.85,4.08),new THREE.Vector3(6.28,16.95,5.60),new THREE.Vector3(5.82,14.70,7.28)];
    const rg=tubeAlong(robeFore,t=>lerp(1.34,.96,t),62,20);scaleUV(rg,4);attachRockMorph(rg);const rm=new THREE.Mesh(rg,matRobe);rm.castShadow=rm.receiveShadow=true;G.add(rm);BUDDHA.parts.armL=rm;
    const skinFore=[new THREE.Vector3(5.82,14.15,7.28),new THREE.Vector3(5.58,13.05,7.88),new THREE.Vector3(5.34,11.98,8.42)];
    const fg=tubeAlong(skinFore,t=>lerp(.90,.70,t),32,18);scaleUV(fg,4);attachRockMorph(fg);const fm=new THREE.Mesh(fg,matSkin);fm.castShadow=fm.receiveShadow=true;G.add(fm);
    const wrist=new THREE.Mesh(new THREE.CapsuleGeometry(.49,.54,8,18),matSkin);wrist.rotation.z=.10;wrist.position.set(5.32,11.86,8.52);wrist.castShadow=true;attachRockMorphMesh(wrist);G.add(wrist);
    const hg=buildHandGeometry(1.38);hg.rotateZ(Math.PI);hg.rotateX(-.10);hg.rotateY(-.04);hg.translate(5.02,12.65,9.12);scaleUV(hg,3);attachRockMorph(hg);
    const hm=new THREE.Mesh(hg,matSkin);hm.castShadow=hm.receiveShadow=true;G.add(hm);BUDDHA.parts.handL=hm;
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
    merged.translate(sx * 6.55, 0.76, 5.72);
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
  const g = new THREE.CircleGeometry(4.85, 80);
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
  for (const r of [4.05, 4.52]) {
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
    [-0.42,26.95],[-0.18,26.35],[0.10,26.75],[0.36,25.95],
    [-0.34,24.85],[-0.08,23.85],[0.20,24.25],[0.42,22.95],
  ];
  const geo = new THREE.CylinderGeometry(0.085,0.105,1.18,9);
  const mat = new THREE.MeshStandardMaterial({ map:TEX.wood.map,color:0x5B3A22,roughness:.92 });
  const grp = new THREE.Group();
  for(let i=0;i<spots.length;i++){
    const [lat,y]=spots[i],P=new THREE.Vector3(),N=new THREE.Vector3();
    buddhaSurfacePoint(lat,y,P,N);
    const m=new THREE.Mesh(geo,mat);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),N);
    m.position.copy(P).addScaledVector(N,.18);m.castShadow=true;
    m.userData.t=i/Math.max(1,spots.length-1);m.userData.finalPosition=m.position.clone();m.userData.finalQuaternion=m.quaternion.clone();m.userData.axis=N.clone();m.userData.surfaceU=lat;m.userData.surfaceY=y;
    grp.add(m);pegs.push(m);
  }
  grp.visible=false;G.add(grp);BUDDHA.parts.pegs=grp;BUDDHA.parts.pegList=pegs;
}
