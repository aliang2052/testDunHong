/* ============================================================
   30 - 阶段材质：一套 shader 贯穿 石胎→粗泥→细泥→收光→彩绘
   ============================================================ */

const STAGE_MATS = [];   // 全部阶段材质，便于统一改 uniform

/*
  uPhase 语义（连续可插值）：
   0 石胎岩石
   1 普通泥（龟裂）
   2 掺麦秆粗泥
   3 中层泥
   4 细泥（加棉花）
   5 收光素胎（蛋清米汁 + 塑刀）
   6 彩绘完成
*/
const PHASE = {
  ROCK: 0, CRACK: 1, COARSE: 2, MID: 3, FINE: 4, POLISH: 5, PAINT: 6,
};

function makeStageMaterial(opts) {
  const {
    finalMap,                 // 彩绘阶段贴图
    finalScale = [1, 1],
    finalTint = new THREE.Color(1, 1, 1),
    mudScale = [3, 6],
    rockScale = [4, 8],
    roughSet = [1.0, 0.97, 0.94, 0.88, 0.76, 0.58, 0.66],
    normalScale = 1.0,
    side = THREE.FrontSide,
  } = opts;

  const mat = new THREE.MeshStandardMaterial({
    map: TEX.rockCore.map,
    normalMap: TEX.rockCore.normal,
    roughness: 1.0,
    metalness: 0.0,
    side,
  });

  const U = {
    uPhase: { value: 0 },
    uMorph: { value: 1 },          // 1 = 完全石胎形
    uMorphY: { value: -999 },      // 敷泥推进高度（-999 = 关闭推进，用 uMorph 全局）
    uMorphK: { value: 0.28 },
    tRock: { value: TEX.rockCore.map }, nRock: { value: TEX.rockCore.normal },
    tCrack: { value: TEX.crackedMud.map }, nCrack: { value: TEX.crackedMud.normal },
    tCoarse: { value: TEX.mudCoarse.map }, nCoarse: { value: TEX.mudCoarse.normal },
    tMid: { value: TEX.mudMid.map }, nMid: { value: TEX.mudMid.normal },
    tFine: { value: TEX.mudFine.map }, nFine: { value: TEX.mudFine.normal },
    tPolish: { value: TEX.mudPolish.map }, nPolish: { value: TEX.mudPolish.normal },
    tFinal: { value: finalMap }, uFinalTint: { value: finalTint },
    uRockScale: { value: new THREE.Vector2(rockScale[0], rockScale[1]) },
    uMudScale: { value: new THREE.Vector2(mudScale[0], mudScale[1]) },
    uFinalScale: { value: new THREE.Vector2(finalScale[0], finalScale[1]) },
    uRough: { value: new Float32Array(roughSet) },
    uNormalAmt: { value: normalScale },
    uWet: { value: 0 },            // 敷泥推进面的湿润高光
  };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    mat.userData.shader = shader;

    /* ---------- 顶点：石胎 <-> 成品 形变 ---------- */
    shader.vertexShader = `
      attribute vec3 aRockPos;
      attribute vec3 aRockNrm;
      uniform float uMorph;
      uniform float uMorphY;
      uniform float uMorphK;
      varying float vMorphW;
      varying vec3 vLocalPos;
      varying vec2 vUvX;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      `
      vUvX = uv;
      float mw = uMorph;
      if (uMorphY > -900.0) {
        mw = clamp((position.y - uMorphY) * uMorphK, 0.0, 1.0);
      }
      vMorphW = mw;
      vLocalPos = position;
      vec3 objectNormal = normalize(mix(normal, aRockNrm, mw));
      #ifdef USE_TANGENT
        vec3 objectTangent = vec3( tangent.xyz );
      #endif
      `
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `vec3 transformed = mix(position, aRockPos, mw);`
    );

    /* ---------- 片元：多阶段贴图链式混合 ---------- */
    shader.fragmentShader = `
      uniform float uPhase;
      uniform sampler2D tRock, tCrack, tCoarse, tMid, tFine, tPolish, tFinal;
      uniform sampler2D nRock, nCrack, nCoarse, nMid, nFine, nPolish;
      uniform vec3 uFinalTint;
      uniform vec2 uRockScale, uMudScale, uFinalScale;
      uniform float uRough[7];
      uniform float uNormalAmt;
      uniform float uWet;
      varying float vMorphW;
      varying vec3 vLocalPos;
      varying vec2 vUvX;

      float phW(float k){ return clamp(uPhase - k, 0.0, 1.0); }
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      vec2 uvR = vUvX * uRockScale;
      vec2 uvM = vUvX * uMudScale;
      vec2 uvF = vUvX * uFinalScale;
      vec4 col = texture2D(tRock, uvR);
      col = mix(col, texture2D(tCrack,  uvM), phW(0.0));
      col = mix(col, texture2D(tCoarse, uvM), phW(1.0));
      col = mix(col, texture2D(tMid,    uvM), phW(2.0));
      col = mix(col, texture2D(tFine,   uvM), phW(3.0));
      col = mix(col, texture2D(tPolish, uvM), phW(4.0));
      vec4 fin = texture2D(tFinal, uvF);
      fin.rgb *= uFinalTint;
      col = mix(col, fin, phW(5.0));
      diffuseColor *= col;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `
      vec3 mapNa = texture2D(nRock, vUvX * uRockScale).xyz * 2.0 - 1.0;
      vec3 mapNb = texture2D(nCrack,  vUvX * uMudScale).xyz * 2.0 - 1.0;
      vec3 mapNc = texture2D(nCoarse, vUvX * uMudScale).xyz * 2.0 - 1.0;
      vec3 mapNd = texture2D(nMid,    vUvX * uMudScale).xyz * 2.0 - 1.0;
      vec3 mapNe = texture2D(nFine,   vUvX * uMudScale).xyz * 2.0 - 1.0;
      vec3 mapNf = texture2D(nPolish, vUvX * uMudScale).xyz * 2.0 - 1.0;
      vec3 mapN = mapNa;
      mapN = mix(mapN, mapNb, phW(0.0));
      mapN = mix(mapN, mapNc, phW(1.0));
      mapN = mix(mapN, mapNd, phW(2.0));
      mapN = mix(mapN, mapNe, phW(3.0));
      mapN = mix(mapN, mapNf, phW(4.0));
      mapN = mix(mapN, vec3(0.0,0.0,1.0), phW(5.0) * 0.75);
      float amt = uNormalAmt * mix(1.0, 0.35, phW(4.0));
      mapN.xy *= amt;
      normal = normalize( tbn * mapN );
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `
      float rIdx = clamp(uPhase, 0.0, 6.0);
      int ri = int(floor(rIdx));
      float rf = fract(rIdx);
      float ra = uRough[0];
      // 手动索引（GLSL1 兼容）
      float r0=uRough[0],r1=uRough[1],r2=uRough[2],r3=uRough[3],r4=uRough[4],r5=uRough[5],r6=uRough[6];
      float rlo = r0;
      rlo = mix(rlo, r1, step(0.5, rIdx));
      rlo = mix(rlo, r2, step(1.5, rIdx));
      rlo = mix(rlo, r3, step(2.5, rIdx));
      rlo = mix(rlo, r4, step(3.5, rIdx));
      rlo = mix(rlo, r5, step(4.5, rIdx));
      rlo = mix(rlo, r6, step(5.5, rIdx));
      float roughnessFactor = rlo;
      // 敷泥推进面湿润
      roughnessFactor = mix(roughnessFactor, 0.30, uWet * smoothstep(0.0, 1.0, 1.0 - abs(vMorphW - 0.5) * 2.0));
      `
    );
  };

  mat.customProgramCacheKey = () => 'stage-mat';
  mat.userData.U = U;
  STAGE_MATS.push(mat);
  return mat;
}

/* 统一设置所有阶段材质的 uniform */
function setStage(phase, morph, opts = {}) {
  for (const m of STAGE_MATS) {
    const U = m.userData.U;
    if (!U) continue;
    U.uPhase.value = phase;
    U.uMorph.value = morph;
    U.uMorphY.value = opts.morphY !== undefined ? opts.morphY : -999;
    if (opts.morphK !== undefined) U.uMorphK.value = opts.morphK;
    U.uWet.value = opts.wet !== undefined ? opts.wet : 0;
  }
}

/* ------------------------------------------------------------
   崖体材质：支持"按高度/包围盒挖除"，用于开凿动画
   ------------------------------------------------------------ */
const CARVE_MATS = [];
const CARVE_U = {
  uCarveY: { value: 9999 },              // 开凿推进面（世界 Y），高于此值的洞窟范围被挖掉
  uCarveMin: { value: new THREE.Vector3(-9999, -9999, -9999) },
  uCarveMax: { value: new THREE.Vector3(-9999, -9999, -9999) },
  uCarveMin2: { value: new THREE.Vector3(-9999, -9999, -9999) },  // 下方两个运土洞
  uCarveMax2: { value: new THREE.Vector3(-9999, -9999, -9999) },
  uCarveMin3: { value: new THREE.Vector3(-9999, -9999, -9999) },
  uCarveMax3: { value: new THREE.Vector3(-9999, -9999, -9999) },
  uDoorMin: { value: new THREE.Vector3(-9999, -9999, -9999) },    // 窟门
  uDoorMax: { value: new THREE.Vector3(-9999, -9999, -9999) },
  uArchY: { value: 37.0 },               // 起拱线
  uArchH: { value: 4.5 },                // 拱高
  uSectionX: { value: 99999 },           // 剖切面：x 大于此值的崖体被切掉（露出洞窟纵剖面）
};

function applyCarve(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader) => {
    if (prev) prev(shader);
    mat.userData.carveShader = shader;
    Object.assign(shader.uniforms, CARVE_U);
    shader.vertexShader = `varying vec3 vWorldP;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
       vWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;`
    );
    // 若没有 worldpos_vertex（未启用），兜底
    if (shader.vertexShader.indexOf('vWorldP =') < 0) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `vWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;
         #include <project_vertex>`
      );
    }
    shader.fragmentShader = `
      varying vec3 vWorldP;
      uniform float uCarveY;
      uniform vec3 uCarveMin, uCarveMax;
      uniform vec3 uCarveMin2, uCarveMax2;
      uniform vec3 uCarveMin3, uCarveMax3;
      uniform vec3 uDoorMin, uDoorMax;
      uniform float uSectionX;
      uniform float uArchY, uArchH;
      bool inBox(vec3 p, vec3 mn, vec3 mx){
        return all(greaterThan(p, mn)) && all(lessThan(p, mx));
      }
      /* 主窟腔：矩形 + 半椭圆拱顶，精确匹配洞窟内壁，避免顶部漏空 */
      bool inCave(vec3 p, vec3 mn, vec3 mx){
        if (p.x <= mn.x || p.x >= mx.x) return false;
        if (p.z <= mn.z || p.z >= mx.z) return false;
        if (p.y <= mn.y) return false;
        float cx = (mn.x + mx.x) * 0.5;
        float rx = (mx.x - mn.x) * 0.5;
        float k = clamp(1.0 - pow((p.x - cx) / rx, 2.0), 0.0, 1.0);
        float top = uArchY + uArchH * sqrt(k);
        return p.y < top;
      }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
       if (vWorldP.x > uSectionX) discard;
       if (inCave(vWorldP, uCarveMin, uCarveMax) && vWorldP.y > uCarveY) discard;
       if (inBox(vWorldP, uCarveMin2, uCarveMax2)) discard;
       if (inBox(vWorldP, uCarveMin3, uCarveMax3)) discard;
       {
         vec3 dmn = uDoorMin, dmx = uDoorMax;
         if (vWorldP.x > dmn.x && vWorldP.x < dmx.x &&
             vWorldP.z > dmn.z && vWorldP.z < dmx.z &&
             vWorldP.y > dmn.y) {
           float dcx = (dmn.x + dmx.x) * 0.5;
           float drx = (dmx.x - dmn.x) * 0.5;
           float springY = dmx.y - drx;                       // 起拱线
           float k = clamp(1.0 - pow((vWorldP.x - dcx) / drx, 2.0), 0.0, 1.0);
           float dtop = springY + drx * sqrt(k);
           if (vWorldP.y < dtop) discard;
         }
       }
      `
    );
  };
  mat.customProgramCacheKey = () => 'carve-' + mat.uuid;
  CARVE_MATS.push(mat);
  return mat;
}
