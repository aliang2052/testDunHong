/* ============================================================
   50 - 崖壁 / 洞窟 / 开凿系统
   ============================================================ */

/* 洞窟尺寸（米） */
const CAVE = {
  x0: -18.0, x1: 18.0,      // 左右壁
  yTop: 43.5,               // 拱顶最高
  yArch: 37.5,              // 起拱线
  zBack: -18.5,             // 后壁
  zFront: 10.0,             // 洞口（= 崖壁面）
};
const CLIFF_Z = 10.0;
const CLIFF_TOP = 52.0;

const WORLD = { group: null };

function buildArchTunnelGeometry(width = 8.8, wallHeight = 5.8, archHeight = 3.3, length = 20, segArch = 24, segDepth = 12) {
  const half = width * 0.5;
  const ring = [];
  ring.push(new THREE.Vector2(-half, 0));
  ring.push(new THREE.Vector2(-half, wallHeight));
  for (let i = 0; i <= segArch; i++) {
    const a = Math.PI - (i / segArch) * Math.PI;
    ring.push(new THREE.Vector2(Math.cos(a) * half, wallHeight + Math.sin(a) * archHeight));
  }
  ring.push(new THREE.Vector2(half, 0));
  const pos = [], uv = [], idx = [];
  const nr = ring.length;
  for (let j = 0; j <= segDepth; j++) {
    const z = lerp(length * 0.5, -length * 0.5, j / segDepth);
    for (let i = 0; i < nr; i++) {
      const q = ring[i];
      pos.push(q.x, q.y, z);
      uv.push(i / Math.max(1, nr - 1) * 5.0, j / segDepth * length / 4.0);
    }
  }
  for (let j = 0; j < segDepth; j++) for (let i = 0; i < nr - 1; i++) {
    const a = j * nr + i, b = a + 1, c = a + nr + 1, d = a + nr;
    idx.push(a, d, b, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function buildArchBackGeometry(width = 8.8, wallHeight = 5.8, archHeight = 3.3, seg = 36) {
  const shape = new THREE.Shape();
  const half = width * 0.5;
  shape.moveTo(-half, 0); shape.lineTo(-half, wallHeight);
  for (let i = 0; i <= seg; i++) {
    const a = Math.PI - (i / seg) * Math.PI;
    shape.lineTo(Math.cos(a) * half, wallHeight + Math.sin(a) * archHeight);
  }
  shape.lineTo(half, 0); shape.closePath();
  return new THREE.ShapeGeometry(shape, 24);
}

/* 崖壁面的起伏 */
function cliffFaceZ(x, y) {
  const macro=fbm2(x*.010+5,y*.012+2,5,3.1)-.5;
  const blocks=fbm2(x*.031,y*.038,4,8.8)-.5;
  const vertical=ridge2(x*.020+fbm2(x*.008,y*.025,3,41)*.8,y*.010,5,1.7);
  const fracture=ridge2(x*.008+fbm2(x*.025,y*.010,3,19)*.6,y*.082,4,27);
  const alcove=smoothstep(.60,.90,fbm2(x*.014+7,y*.029,4,5.1))*smoothstep(39,8,y)*smoothstep(155,18,Math.abs(x));
  let z=CLIFF_Z+macro*8.6+blocks*3.4-vertical*4.2-fracture*2.1-alcove*2.8;
  /* 仅在主窟门边缘局部收平，中央之外保持真实起伏。 */
  const near=smoothstep(24,15.5,Math.abs(x))*smoothstep(50,39,y);
  z=lerp(z,CLIFF_Z+blocks*.75-fracture*.55,near*.72);
  z+=smoothstep(10,0,y)*2.2;
  return z;
}

/* 沙丘顶高度 */
function duneY(x, z) {
  const d = (CLIFF_Z - z);                        // 向后的距离
  const rise = smoothstep(-14, 70, d) * 16.0;
  const n = fbm2(x * 0.007 + 11, z * 0.007 + 3, 5, 6.6) - 0.5;
  const streak = fbm2(x * 0.04, z * 0.004, 4, 2.2) - 0.5;
  return CLIFF_TOP + rise + n * 9.0 + streak * 1.6;
}

function makeErodedRock(seed, sx, sy, sz) {
  const g=new THREE.IcosahedronGeometry(1,3),pa=g.attributes.position;
  for(let i=0;i<pa.count;i++){
    let x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i);
    const n=fbm3(x*1.9+seed*.71,y*1.7+seed*1.17,z*1.8+seed*.43,4)-.5;
    const cut=ridge2(x*2.7+seed,y*3.8,3,seed*3.1);
    const r=1+n*.24-cut*.07;
    x*=sx*r;y*=sy*(r+(y>0?.03:0));z*=sz*r;
    pa.setXYZ(i,x,y,z);
  }
  pa.needsUpdate=true;g.computeVertexNormals();return g;
}

function buildWorld(scene) {
  const G = new THREE.Group();
  WORLD.group = G;
  scene.add(G);

  /* ---------------- 砂岩崖体厚度：完整三维岩墙，正面细节由高密度立面叠加 ---------------- */
  {
    const W=340,Hh=CLIFF_TOP+14,D=38;
    const g=new THREE.BoxGeometry(W,Hh,D,84,42,10);
    const pa=g.attributes.position;
    for(let i=0;i<pa.count;i++){
      let x=pa.getX(i),y=pa.getY(i)+Hh*.5,z=pa.getZ(i)-9.0;
      const side=Math.abs(x)/(W*.5);
      const back=smoothstep(4,-28,z);
      const rough=(fbm3(x*.018,y*.022,z*.025,4)-.5)*(1.3+back*1.8);
      z+=rough;
      x+=Math.sign(x||1)*smoothstep(.78,1.0,side)*rough*.35;
      pa.setXYZ(i,x,y,z);
    }
    pa.needsUpdate=true;g.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({map:TEX.sandstone.map,normalMap:TEX.sandstone.normal,color:0xB78A5D,roughness:.99,metalness:0});
    mat.normalScale.set(2.0,2.0);applyCarve(mat);
    const m=new THREE.Mesh(g,mat);m.castShadow=m.receiveShadow=true;G.add(m);WORLD.cliffBody=m;
  }

  /* ---------------- 崖壁立面 ---------------- */
  {
    const W = 340, Hh = CLIFF_TOP + 14;
    const segX = 180, segY = 96;
    const g = new THREE.PlaneGeometry(W, Hh, segX, segY);
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i);
      const y = pa.getY(i) + Hh / 2;
      pa.setY(i, y);
      pa.setZ(i, cliffFaceZ(x, y));
    }
    pa.needsUpdate = true;
    g.computeVertexNormals();
    const uvA = g.attributes.uv;
    for (let i = 0; i < uvA.count; i++) {
      // uv -> 米制，再按 6.5m 一循环
      uvA.setXY(i, uvA.getX(i) * W / 15.5, uvA.getY(i) * Hh / 15.5);
    }
    const mat = new THREE.MeshStandardMaterial({
      map: TEX.sandstone.map, normalMap: TEX.sandstone.normal,
      roughness: 0.98, metalness: 0, side: THREE.DoubleSide,
    });
    mat.normalScale.set(3.5, 3.5);
    applyCarve(mat);
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true; m.castShadow = true;
    G.add(m);
    WORLD.cliffFace = m;
    WORLD.cliffMat = mat;
  }

  /* ---------------- 竖向断裂与崖脚碎石：只做地质尺度参照，不再堆叠球状巨石 ---------------- */
  {
    const fractureMat=new THREE.MeshStandardMaterial({color:0x4A3326,roughness:1,transparent:true,opacity:.58,depthWrite:false});
    const fractures=new THREE.Group();
    for(let j=0;j<18;j++){
      const side=j%2?-1:1;
      const baseX=side*(28+hash3(j,9,7)*132);
      const pts=[];
      for(let i=0;i<=22;i++){
        const y=lerp(1.0,CLIFF_TOP+5,i/22);
        const x=baseX+Math.sin(i*.58+j)*(.35+hash3(j,i,2)*1.15)+(fbm2(i*.12,j,2,17)-.5)*1.5;
        pts.push(new THREE.Vector3(x,y,cliffFaceZ(x,y)+.18));
      }
      const tube=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),66,.018+hash3(j,3,5)*.032,5,false),fractureMat);
      fractures.add(tube);
    }
    G.add(fractures);WORLD.fractures=fractures;

    const rockGeo=new THREE.IcosahedronGeometry(1,1),rpa=rockGeo.attributes.position;
    for(let i=0;i<rpa.count;i++){const q=.72+hash3(i,5,3)*.62;rpa.setXYZ(i,rpa.getX(i)*q,rpa.getY(i)*q*.72,rpa.getZ(i)*q);}rpa.needsUpdate=true;rockGeo.computeVertexNormals();
    const screeMat=new THREE.MeshStandardMaterial({map:TEX.rockCore.map,normalMap:TEX.rockCore.normal,color:0x8B6849,roughness:.99});
    const scree=new THREE.InstancedMesh(rockGeo,screeMat,132),M=new THREE.Matrix4(),Q=new THREE.Quaternion(),S=new THREE.Vector3();
    for(let i=0;i<132;i++){
      const x=(hash3(i,8,4)-.5)*290,z=CLIFF_Z+5+hash3(i,11,5)*30,y=.12+hash3(i,2,17)*.8,sc=.16+Math.pow(hash3(i,19,7),2.2)*1.25;
      Q.setFromEuler(new THREE.Euler(hash3(i,3,13)*2,hash3(i,9,23)*TAU,hash3(i,17,29)*1.5));S.set(sc*(.8+hash3(i,31,2)*.8),sc*(.50+hash3(i,37,4)*.50),sc);M.compose(new THREE.Vector3(x,y,z),Q,S);scree.setMatrixAt(i,M);
    }
    scree.instanceMatrix.needsUpdate=true;scree.castShadow=scree.receiveShadow=true;G.add(scree);WORLD.scree=scree;
  }

  /* ---------------- 崖壁厚度：洞口周围的侧壁（让洞口有进深） ---------------- */
  {
    // 洞口四周一圈"墙厚"，避免看到纸片边
    const th = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      map: TEX.caveWall.map, normalMap: TEX.caveWall.normal, roughness: 0.97, side: THREE.DoubleSide,
    });
    applyCarve(mat);
    WORLD.jambMat = mat;
    G.add(th);
    WORLD.jambs = th;
  }

  /* ---------------- 沙丘顶 ---------------- */
  {
    const g = new THREE.PlaneGeometry(360, 240, 112, 76);
    g.rotateX(-Math.PI / 2);
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i);
      const z = pa.getZ(i) - 96;     // 平面中心后移，前缘压住崖顶
      pa.setZ(i, z);
      pa.setY(i, duneY(x, z));
    }
    pa.needsUpdate = true; g.computeVertexNormals();
    const uvA = g.attributes.uv;
    for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * 360 / 22, uvA.getY(i) * 240 / 22);
    const mat = new THREE.MeshStandardMaterial({
      map: TEX.dune.map, normalMap: TEX.dune.normal, roughness: 1.0, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    G.add(m);
    WORLD.dune = m;
  }

  /* ---------------- 窟门隧道：真实拱形内壁和暗后壁 ---------------- */
  {
    const tg = buildArchTunnelGeometry(8.8, 5.8, 3.3, 20, 28, 16);
    const tmat = new THREE.MeshStandardMaterial({
      map: TEX.caveWall.map, normalMap: TEX.caveWall.normal,
      color: 0xB38A65, emissive: 0x3A2113, emissiveIntensity: 0.34,
      roughness: 0.99, side: THREE.DoubleSide,
    });
    tmat.normalScale.set(1.4, 1.4);
    const tm = new THREE.Mesh(tg, tmat);
    tm.position.set(0, 30.3, CLIFF_Z - 5.4);
    tm.visible = false; tm.receiveShadow = true;
    G.add(tm); WORLD.doorTunnel = tm;

    const backMat = new THREE.MeshStandardMaterial({
      map: TEX.rockCore.map, normalMap: TEX.rockCore.normal,
      color: 0x745744, emissive: 0x28160D, emissiveIntensity: 0.34,
      roughness: 1.0, side: THREE.DoubleSide,
    });
    const back = new THREE.Mesh(buildArchBackGeometry(8.8, 5.8, 3.3), backMat);
    back.position.set(0, 30.3, CLIFF_Z - 15.25);
    back.visible = false; back.receiveShadow = true;
    G.add(back); WORLD.doorBack = back;
  }

  /* ---------------- 岩芯：尚未挖走的土石（顶面 = 当前开凿面） ---------------- */
  {
    const w = CAVE.x1 - CAVE.x0 + 0.9, d = (CLIFF_Z - 0.2) - (CAVE.zBack - 1.5);
    const FH = 70;                       // 固定高度，只靠 position 平移
    const g = new THREE.BoxGeometry(w, FH, d, 26, 1, 26);
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      if (pa.getY(i) > FH / 2 - 0.01) {
        const n = fbm2(pa.getX(i) * 0.20 + 3, pa.getZ(i) * 0.20, 3, 5);
        pa.setY(i, FH / 2 + (n - 0.5) * 2.8);     // 凿击面的起伏（绝对米）
      }
    }
    pa.needsUpdate = true; g.computeVertexNormals();
    const uvA = g.attributes.uv;
    for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * 2.2, uvA.getY(i) * 2.2);
    const mat = new THREE.MeshStandardMaterial({
      map: TEX.sandstone.map, normalMap: TEX.sandstone.normal, roughness: 0.99,
    });
    mat.normalScale.set(2.5, 2.5);
    applyCarve(mat);
    WORLD.rockFillH = FH;
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true; m.castShadow = true;
    G.add(m);
    WORLD.rockFill = m;
    WORLD.rockFillDepth = d;
  }

  /* ---------------- 洞窟内壁 ---------------- */
  buildCaveInterior(G);

  /* ---------------- 风蚀沙地与踩踏硬化区 ---------------- */
  {
    const g = new THREE.PlaneGeometry(400, 300, 84, 60);
    g.rotateX(-Math.PI / 2);
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), z = pa.getZ(i) + CLIFF_Z + 130;
      const macro = fbm2(x * 0.008 + 3, z * 0.010 + 7, 4, 5.2) - 0.5;
      const ripple = Math.sin(z * 0.075 + fbm2(x * 0.035, z * 0.018, 2, 4) * 3.0) * 0.12;
      const apron = smoothstep(CLIFF_Z + 78, CLIFF_Z + 6, z);
      const packed = smoothstep(55, 20, Math.abs(x)) * smoothstep(CLIFF_Z + 90, CLIFF_Z + 20, z);
      pa.setXYZ(i, x, -0.16 + macro * 0.72 + ripple * (1 - packed * 0.75) + apron * 0.22, z);
    }
    pa.needsUpdate = true; g.computeVertexNormals();
    const uvA = g.attributes.uv;
    for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * 400 / 18, uvA.getY(i) * 300 / 18);
    const mat = new THREE.MeshStandardMaterial({ map: TEX.ground.map, normalMap: TEX.ground.normal, roughness: 0.99 });
    mat.normalScale.set(1.35, 1.35);
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; G.add(m); WORLD.ground = m;
  }

  /* 佛像基座：三层风化椭圆石台，避免现代矩形展台感。 */
  {
    const mat = new THREE.MeshStandardMaterial({ map: TEX.ground.map, normalMap: TEX.ground.normal, color: 0x8E7358, roughness: 0.98 });
    const grp = new THREE.Group();
    const dims = [[17.8, 0.55, 11.8], [16.8, 0.42, 10.8], [15.8, 0.32, 9.8]];
    let y = 0;
    dims.forEach((d, i) => {
      const g = new THREE.CylinderGeometry(1, 1.02, d[1], 64, 1);
      const m = new THREE.Mesh(g, mat);
      m.scale.set(d[0], 1, d[2]);
      m.position.set(0, y + d[1] * 0.5, 0.35 - i * 0.12);
      m.receiveShadow = true; m.castShadow = true; grp.add(m); y += d[1] - 0.06;
    });
    G.add(grp); WORLD.plinth = grp; grp.visible = false;
  }

  return G;
}

/* ------------------------------------------------------------
   洞窟内壁：后壁 / 侧壁（带退台）/ 拱顶 / 地面
   全部使用「壁面阶段材质」：粗凿 → 细泥 → 白粉 → 壁画
   ------------------------------------------------------------ */
const WALL_MATS = [];
function makeWallMaterial(uvScale = [4, 4]) {
  const mat = new THREE.MeshStandardMaterial({
    map: TEX.caveWall.map, normalMap: TEX.caveWall.normal,
    color: 0xFFFFFF, emissive: 0x24160E, emissiveIntensity: 0.16,
    roughness: 0.97, metalness: 0, side: THREE.DoubleSide,
  });
  const U = {
    uWallPhase: { value: 0 },       // 0 粗凿 1 细泥 2 白粉 3 壁画
    uWallFrom: { value: 0 },
    uWallTo: { value: 0 },
    uWallProgress: { value: -1 },   // <0 表示全局阶段；否则为 0..1 的空间传播
    uWallMode: { value: 0 },        // 1 自下而上；2 自上而下；3 蛇形刷涂
    uWallTime: { value: 0 },
    uRevealY: { value: 9999 },      // 低于此高度不显示（开凿推进）
    tRaw: { value: TEX.caveWall.map },
    tFine: { value: TEX.mudFine.map },
    tWhite: { value: TEX.whitewash.map },
    tMural: { value: TEX.mural.map },
    nRaw: { value: TEX.caveWall.normal },
    nFine: { value: TEX.mudFine.normal },
    uScale: { value: new THREE.Vector2(uvScale[0], uvScale[1]) },
    uWallSection: { value: 99999 },
    uMuralScale: { value: new THREE.Vector2(1 / 36.0, 1 / 43.5) },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = `varying vec3 vWP;\nvarying vec2 vUvX;\n` + sh.vertexShader;
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>',
      `vWP = (modelMatrix * vec4(transformed,1.0)).xyz;\n vUvX = uv;\n#include <project_vertex>`);
    sh.fragmentShader = `
      varying vec3 vWP;
      varying vec2 vUvX;
      uniform float uWallPhase, uRevealY;
      uniform float uWallFrom, uWallTo, uWallProgress, uWallMode, uWallTime;
      uniform sampler2D tRaw, tFine, tWhite, tMural, nRaw, nFine;
      uniform vec2 uScale, uMuralScale;
      uniform float uWallSection;
      float wallPhaseLocal(){
        if (uWallProgress < 0.0) return uWallPhase;
        float side = step(16.0, abs(vWP.x));
        float uuBack = clamp((vWP.x + 18.0) / 36.0, 0.0, 1.0);
        float uuSide = clamp((vWP.z + 18.5) / 28.5, 0.0, 1.0);
        float uu = mix(uuBack, uuSide, side);
        if (vWP.x > 16.0) uu = 1.0 - uu;
        float vv = clamp(vWP.y / 43.5, 0.0, 1.0);
        float rag = sin(vWP.x * 0.83 + vWP.z * 0.47 + uWallTime * 0.55) * 0.020
                  + sin(vWP.y * 1.37 - vWP.z * 0.31) * 0.014;
        float coord = vv;
        if (uWallMode > 1.5 && uWallMode < 2.5) coord = 1.0 - vv;
        if (uWallMode > 2.5) {
          float band = floor(vv * 7.0);
          float snake = mod(band, 2.0) < 1.0 ? uu : 1.0 - uu;
          coord = (band + snake) / 7.0;
        }
        float m = 1.0 - smoothstep(uWallProgress - 0.045, uWallProgress + 0.045, coord + rag);
        return mix(uWallFrom, uWallTo, m);
      }
      float pw(float k){ return clamp(wallPhaseLocal() - k, 0.0, 1.0); }
    ` + sh.fragmentShader;
    sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
       if (vWP.y < uRevealY) discard;
       if (vWP.x > uWallSection) discard;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>',
      `
      vec2 uvA = vUvX * uScale;
      vec4 rawCol = texture2D(tRaw, uvA);
      vec4 fineCol = texture2D(tFine, uvA); fineCol.rgb *= vec3(0.76,0.69,0.60);
      vec4 whiteCol = texture2D(tWhite, uvA); whiteCol.rgb *= vec3(1.035,1.025,0.99);
      vec4 muralCol = texture2D(tMural, vUvX * uMuralScale); muralCol.rgb *= vec3(1.04,1.00,0.94);
      vec4 col = rawCol;
      col = mix(col, fineCol, pw(0.0));
      col = mix(col, whiteCol, pw(1.0));
      col = mix(col, muralCol, pw(2.0));
      if (uWallProgress >= 0.0) {
        float side = step(16.0, abs(vWP.x));
        float uuBack = clamp((vWP.x + 18.0) / 36.0, 0.0, 1.0);
        float uuSide = clamp((vWP.z + 18.5) / 28.5, 0.0, 1.0);
        float uu = mix(uuBack, uuSide, side); if (vWP.x > 16.0) uu = 1.0 - uu;
        float vv = clamp(vWP.y / 43.5, 0.0, 1.0);
        float coord = vv;
        if (uWallMode > 1.5 && uWallMode < 2.5) coord = 1.0 - vv;
        if (uWallMode > 2.5) { float band=floor(vv*7.0); float snake=mod(band,2.0)<1.0?uu:1.0-uu; coord=(band+snake)/7.0; }
        float frontEdge = 1.0 - smoothstep(0.018,0.082,abs(coord-uWallProgress));
        col.rgb += frontEdge * vec3(0.18,0.095,0.040);
      }
      diffuseColor *= col;
      `);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>',
      `
      vec3 mA = texture2D(nRaw, vUvX*uScale).xyz*2.0-1.0;
      vec3 mB = texture2D(nFine, vUvX*uScale).xyz*2.0-1.0;
      vec3 mN = mix(mA, mB, pw(0.0));
      mN = mix(mN, vec3(0.0,0.0,1.0), pw(1.0)*0.8);
      mN.xy *= 1.0;
      normal = normalize( tbn * mN );
      `);
    mat.userData.shader = sh;
  };
  mat.customProgramCacheKey = () => 'wall-mat';
  mat.userData.U = U;
  WALL_MATS.push(mat);
  return mat;
}
function setWallPhase(p) { for (const m of WALL_MATS) m.userData.U.uWallPhase.value = p; }
function setWallTransition(from, to, progress, mode, time) {
  for (const m of WALL_MATS) {
    const U = m.userData.U;
    U.uWallFrom.value = from;
    U.uWallTo.value = to;
    U.uWallProgress.value = progress;
    U.uWallMode.value = mode;
    U.uWallTime.value = time || 0;
  }
}
function clearWallTransition() { for (const m of WALL_MATS) m.userData.U.uWallProgress.value = -1; }
function setWallReveal(y) { for (const m of WALL_MATS) m.userData.U.uRevealY.value = y; }
function setWallSection(x) { for (const m of WALL_MATS) m.userData.U.uWallSection.value = x; }

function buildCaveInterior(G) {
  const grp = new THREE.Group();
  G.add(grp);
  WORLD.cave = grp;

  const { x0, x1, yTop, yArch, zBack, zFront } = CAVE;

  /* 后壁：矩形墙 + 半椭圆拱顶，完整封闭窟腔后端 */
  {
    const uSeg = 56, vSeg = 70;
    const pos = [], uvs = [], idx = [];
    const cx = (x0 + x1) / 2, rx = (x1 - x0) / 2, ry = yTop - yArch;
    for (let j = 0; j <= vSeg; j++) {
      const yy = (j / vSeg) * yTop;
      for (let i = 0; i <= uSeg; i++) {
        let xx = x0 + (x1 - x0) * (i / uSeg);
        if (yy > yArch) {
          // 拱形区：按该高度的半宽收窄
          const k = clamp((yy - yArch) / ry, 0, 1);
          const half = rx * Math.sqrt(Math.max(0, 1 - k * k));
          xx = cx + (xx - cx) * (half / rx);
        }
        pos.push(xx, yy, zBack);
        uvs.push(xx - x0, yy);
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
    const m = new THREE.Mesh(g, makeWallMaterial([1 / 5.5, 1 / 5.5]));
    m.receiveShadow = true;
    grp.add(m);
    WORLD.backWall = m;
  }

  /* 左右侧壁：竖直整壁，从后壁一直延伸出洞口（避免侧缝漏天光） */
  for (const sx of [-1, 1]) {
    const X = sx < 0 ? x0 : x1;
    const zEnd = CLIFF_Z - 0.6;
    const uSeg = 30, vSeg = 40;
    const pos = [], uvs = [], idx = [];
    for (let j = 0; j <= vSeg; j++) {
      const yy = (j / vSeg) * (yArch + 0.6);
      for (let i = 0; i <= uSeg; i++) {
        const zz = lerp(zBack, zEnd, i / uSeg);
        // 窟壁在深处略微内收，形成开凿的层次
        const inset = Math.sin((yy / yArch) * Math.PI * 2.0) * 0.55 + (fbm2(zz * 0.08, yy * 0.06, 3, 9) - 0.5) * 1.1;
        pos.push(X - sx * inset, yy, zz);
        uvs.push(zz - zBack, yy);
      }
    }
    const nu = uSeg + 1;
    for (let j = 0; j < vSeg; j++) for (let i = 0; i < uSeg; i++) {
      const a = j * nu + i, b = a + 1, c = a + nu + 1, d = a + nu;
      if (sx < 0) idx.push(a, b, d, b, c, d);
      else idx.push(a, d, b, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, makeWallMaterial([1 / 5.5, 1 / 5.5]));
    m.receiveShadow = true;
    grp.add(m);
  }

  /* 拱形天花板：沿 X 轴的半圆柱 */
  {
    const rx = (x1 - x0) / 2, ry = yTop - yArch;
    const segU = 44, segV = 34;
    const pos = [], uvs = [], idx = [], nrm = [];
    for (let j = 0; j <= segV; j++) {
      const z = lerp(zBack, CLIFF_Z - 0.6, j / segV);
      for (let i = 0; i <= segU; i++) {
        const a = Math.PI * (i / segU);
        const x = (x0 + x1) / 2 - Math.cos(a) * rx;
        const y = (yArch - 0.6) + Math.sin(a) * (ry + 0.6);
        pos.push(x, y, z);
        nrm.push(Math.cos(a), -Math.sin(a), 0);
        uvs.push((i / segU) * Math.PI * rx, (j / segV) * (CLIFF_Z - 0.6 - zBack));
      }
    }
    const nu = segU + 1;
    for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
      const a = j * nu + i, b = a + 1, c = a + nu + 1, d = a + nu;
      idx.push(a, b, d, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, makeWallMaterial([1 / 5.5, 1 / 5.5]));
    m.receiveShadow = true;
    grp.add(m);
    WORLD.arch = m;
  }

  /* 窟内地面 */
  {
    const zE = CLIFF_Z - 0.6;
    const g = new THREE.PlaneGeometry(x1 - x0, zE - zBack, 2, 2);
    g.rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, 0.02, (zBack + zE) / 2);
    const uvA = g.attributes.uv;
    for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * 3, uvA.getY(i) * 3);
    const m = new THREE.Mesh(g, makeWallMaterial([1 / 5.5, 1 / 5.5]));
    m.receiveShadow = true;
    grp.add(m);
  }
}

/* ------------------------------------------------------------
   开凿控制
   ------------------------------------------------------------ */
const CARVE = {
  y: CAVE.yTop + 4,          // 当前开凿面
  doorOpen: false,
};

function setCarveY(y) {
  CARVE.y = y;
  if (WORLD.rockFill) {
    const top = Math.min(y, CAVE.yTop + 1);
    const bottom = -6;
    if (top <= 0.15 || y > CAVE.yTop + 40) {
      WORLD.rockFill.visible = false;
    } else {
      WORLD.rockFill.visible = true;
      WORLD.rockFill.position.set(
        (CAVE.x0 + CAVE.x1) / 2,
        top - WORLD.rockFillH / 2,
        (CAVE.zBack - 1.5 + CLIFF_Z - 0.2) / 2);
    }
  }
  CARVE_U.uCarveY.value = y;
  CARVE_U.uCarveMin.value.set(CAVE.x0 + 0.25, -2, CAVE.zBack - 2);
  CARVE_U.uCarveMax.value.set(CAVE.x1 - 0.25, CAVE.yTop, CLIFF_Z + 8);
  CARVE_U.uArchY.value = CAVE.yArch;
  CARVE_U.uArchH.value = CAVE.yTop - CAVE.yArch;
  if (y > CAVE.yTop + 30) setWallReveal(9999);
  else if (y <= 0.15) setWallReveal(-9999);
  else setWallReveal(y - 0.35);
}
function disableCarveBox() {
  CARVE_U.uCarveMin.value.set(-9999, -9999, -9999);
  CARVE_U.uCarveMax.value.set(-9999, -9999, -9999);
}
function openDoor(on) {
  if (on) {
    CARVE_U.uDoorMin.value.set(-4.0, 30.4, CLIFF_Z - 9);
    CARVE_U.uDoorMax.value.set(4.0, 38.4, CLIFF_Z + 8);
    CARVE_U.uDoorProgress.value = 1;
  } else {
    CARVE_U.uDoorMin.value.set(-9999, -9999, -9999);
    CARVE_U.uDoorMax.value.set(-9999, -9999, -9999);
    CARVE_U.uDoorProgress.value = 0;
  }
}
function setDoorProgress(k) {
  k = clamp(k, 0, 1);
  if (k <= 0.001) { openDoor(false); return; }
  CARVE_U.uDoorMin.value.set(-4.0, 30.4, CLIFF_Z - 9);
  CARVE_U.uDoorMax.value.set(4.0, 38.4, CLIFF_Z + 8);
  CARVE_U.uDoorProgress.value = k;
}
/* 下方两个运土洞 */
function openLowerCaves(k) {
  if (k >= 1) {
    CARVE_U.uCarveMin2.value.set(-12.5, 11.5, CAVE.zBack - 1);
    CARVE_U.uCarveMax2.value.set(-3.0, 20.5, CLIFF_Z + 8);
  }
  if (k >= 2) {
    CARVE_U.uCarveMin3.value.set(-12.5, -1.0, CAVE.zBack - 1);
    CARVE_U.uCarveMax3.value.set(-3.0, 9.0, CLIFF_Z + 8);
  }
  if (k <= 0) {
    CARVE_U.uCarveMin2.value.set(-9999, -9999, -9999);
    CARVE_U.uCarveMax2.value.set(-9999, -9999, -9999);
    CARVE_U.uCarveMin3.value.set(-9999, -9999, -9999);
    CARVE_U.uCarveMax3.value.set(-9999, -9999, -9999);
  }
}
function setLowerCaveProgress(k1, k2) {
  const setOne = (k, mn, mx, UMin, UMax) => {
    k = clamp(k, 0, 1);
    if (k <= 0.001) {
      UMin.value.set(-9999, -9999, -9999);
      UMax.value.set(-9999, -9999, -9999);
      return;
    }
    const yMax = lerp(mn.y + 0.6, mx.y, easeOut(k));
    const zMin = lerp(CLIFF_Z - 0.6, mn.z, easeInOut(k));
    UMin.value.set(mn.x, mn.y, zMin);
    UMax.value.set(mx.x, yMax, mx.z);
  };
  setOne(k1,
    new THREE.Vector3(-12.5, 11.5, CAVE.zBack - 1), new THREE.Vector3(-3.0, 20.5, CLIFF_Z + 8),
    CARVE_U.uCarveMin2, CARVE_U.uCarveMax2);
  setOne(k2,
    new THREE.Vector3(-12.5, -1.0, CAVE.zBack - 1), new THREE.Vector3(-3.0, 9.0, CLIFF_Z + 8),
    CARVE_U.uCarveMin3, CARVE_U.uCarveMax3);
}
function setSectionX(x) {
  CARVE_U.uSectionX.value = x;
  // 洞窟内壁本身保持完整，剖切只作用于崖体和未挖岩芯。
  setWallSection(99999);
}
