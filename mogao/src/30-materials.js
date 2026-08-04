/* ============================================================
   30 - 阶段材质：石胎 → 泥层 → 收光 → 彩绘，并支持空间施工前沿
   ============================================================ */

const STAGE_MATS = [];

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
    finalMap,
    finalNormalMap = TEX.mudPolish.normal,
    finalScale = [1, 1],
    finalNormalScale = finalScale,
    finalTint = new THREE.Color(1, 1, 1),
    mudScale = [3, 6],
    rockScale = [4, 8],
    roughSet = [1.0, 0.97, 0.94, 0.88, 0.76, 0.58, 0.66],
    normalScale = 1.0,
    finalNormalStrength = 0.35,
    roughVariation = 0.04,
    envMapIntensity = 0.24,
    side = THREE.FrontSide,
  } = opts;

  const mat = new THREE.MeshStandardMaterial({
    map: TEX.rockCore.map,
    normalMap: TEX.rockCore.normal,
    roughness: 1.0,
    metalness: 0.0,
    envMapIntensity,
    side,
  });

  const U = {
    /* 全局状态（不做空间传播时使用） */
    uPhase: { value: PHASE.ROCK },
    uMorph: { value: 1 },                    // 1 = 粗石胎；0 = 完整塑形

    /* 空间施工前沿：world-space Y，支持上下两个方向 */
    uSpreadOn: { value: 0 },
    uSpreadY: { value: -999 },
    uSpreadSoft: { value: 0.82 },
    uSpreadDir: { value: 1 },                // +1 前沿以下完成；-1 前沿以上完成
    uSpreadTime: { value: 0 },
    uPhaseFrom: { value: PHASE.ROCK },
    uPhaseTo: { value: PHASE.ROCK },
    uMorphFrom: { value: 1 },
    uMorphTo: { value: 1 },

    /* 开凿时石胎从上至下显露 */
    uRevealOn: { value: 0 },
    uRevealY: { value: -999 },

    tRock: { value: TEX.rockCore.map }, nRock: { value: TEX.rockCore.normal },
    tCrack: { value: TEX.crackedMud.map }, nCrack: { value: TEX.crackedMud.normal },
    tCoarse: { value: TEX.mudCoarse.map }, nCoarse: { value: TEX.mudCoarse.normal },
    tMid: { value: TEX.mudMid.map }, nMid: { value: TEX.mudMid.normal },
    tFine: { value: TEX.mudFine.map }, nFine: { value: TEX.mudFine.normal },
    tPolish: { value: TEX.mudPolish.map }, nPolish: { value: TEX.mudPolish.normal },
    tFinal: { value: finalMap }, nFinal: { value: finalNormalMap }, uFinalTint: { value: finalTint },
    uRockScale: { value: new THREE.Vector2(rockScale[0], rockScale[1]) },
    uMudScale: { value: new THREE.Vector2(mudScale[0], mudScale[1]) },
    uFinalScale: { value: new THREE.Vector2(finalScale[0], finalScale[1]) },
    uFinalNormalScale: { value: new THREE.Vector2(finalNormalScale[0], finalNormalScale[1]) },
    uRough: { value: new Float32Array(roughSet) },
    uNormalAmt: { value: normalScale },
    uFinalNormalAmt: { value: finalNormalStrength },
    uRoughVariation: { value: roughVariation },
    uWet: { value: 0 },
    uFrontGlow: { value: new THREE.Color(1.0, 0.55, 0.16) },
  };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    mat.userData.shader = shader;

    shader.vertexShader = `
      attribute vec3 aRockPos;
      attribute vec3 aRockNrm;
      uniform float uMorph;
      uniform float uSpreadOn;
      uniform float uSpreadY;
      uniform float uSpreadSoft;
      uniform float uSpreadDir;
      uniform float uMorphFrom;
      uniform float uMorphTo;
      varying float vMorphW;
      varying float vStageCover;
      varying float vFrontEdge;
      varying vec3 vStageWP;
      varying vec3 vStageLP;
      varying vec2 vUvX;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      `
      vUvX = uv;
      vec4 stageBase = vec4(position, 1.0);
      #ifdef USE_INSTANCING
        stageBase = instanceMatrix * stageBase;
      #endif
      vec3 stageLP0 = stageBase.xyz;
      vec3 stageWP0 = (modelMatrix * stageBase).xyz;
      float cover = 0.0;
      float frontEdge = 0.0;
      float mw = uMorph;
      if (uSpreadOn > 0.5) {
        float rag = sin(stageWP0.x * 1.17 + stageWP0.z * 0.73) * 0.27
                  + sin(stageWP0.x * 0.31 - stageWP0.z * 1.43) * 0.16;
        float edge = stageWP0.y + rag;
        cover = 1.0 - smoothstep(uSpreadY - uSpreadSoft, uSpreadY + uSpreadSoft, edge);
        if (uSpreadDir < 0.0) cover = 1.0 - cover;
        mw = mix(uMorphFrom, uMorphTo, cover);
        frontEdge = 1.0 - smoothstep(0.0, max(0.12, uSpreadSoft * 1.35), abs(edge - uSpreadY));
      }
      vMorphW = mw;
      vStageCover = cover;
      vFrontEdge = frontEdge;
      vec3 objectNormal = normalize(mix(normal, aRockNrm, mw));
      #ifdef USE_TANGENT
        vec3 objectTangent = vec3(tangent.xyz);
      #endif
      `
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `vec3 transformed = mix(position, aRockPos, mw);`
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `
      vec4 stageP = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        stageP = instanceMatrix * stageP;
      #endif
      vStageLP = stageP.xyz;
      vStageWP = (modelMatrix * stageP).xyz;
      #include <project_vertex>
      `
    );

    shader.fragmentShader = `
      uniform float uPhase;
      uniform float uSpreadOn;
      uniform float uPhaseFrom;
      uniform float uPhaseTo;
      uniform float uRevealOn;
      uniform float uRevealY;
      uniform sampler2D tRock, tCrack, tCoarse, tMid, tFine, tPolish, tFinal;
      uniform sampler2D nRock, nCrack, nCoarse, nMid, nFine, nPolish, nFinal;
      uniform vec3 uFinalTint;
      uniform vec3 uFrontGlow;
      uniform vec2 uRockScale, uMudScale, uFinalScale, uFinalNormalScale;
      uniform float uRough[7];
      uniform float uNormalAmt;
      uniform float uFinalNormalAmt;
      uniform float uRoughVariation;
      uniform float uWet;
      varying float vMorphW;
      varying float vStageCover;
      varying float vFrontEdge;
      varying vec3 vStageWP;
      varying vec3 vStageLP;
      varying vec2 vUvX;

      float localPhase(){
        return uSpreadOn > 0.5 ? mix(uPhaseFrom, uPhaseTo, vStageCover) : uPhase;
      }
      float phW(float k){ return clamp(localPhase() - k, 0.0, 1.0); }
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      `
      #include <clipping_planes_fragment>
      if (uRevealOn > 0.5 && vStageWP.y < uRevealY) discard;
      `
    );

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
      col.rgb = mix(col.rgb, uFrontGlow, vFrontEdge * uWet * 0.18);
      diffuseColor *= col;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `
      vec3 mapNa = texture2D(nRock,   vUvX * uRockScale).xyz * 2.0 - 1.0;
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
      float finalW = phW(5.0);
      vec3 mapNg = texture2D(nFinal, vUvX * uFinalNormalScale).xyz * 2.0 - 1.0;
      mapN = mix(mapN, mapNg, finalW);
      float stageAmt = uNormalAmt * mix(1.0, 0.38, phW(4.0));
      float amt = mix(stageAmt, uFinalNormalAmt, finalW);
      mapN.xy *= amt;
      normal = normalize(tbn * mapN);
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `
      float rIdx = clamp(localPhase(), 0.0, 6.0);
      float r0=uRough[0], r1=uRough[1], r2=uRough[2], r3=uRough[3];
      float r4=uRough[4], r5=uRough[5], r6=uRough[6];
      float rlo = r0;
      rlo = mix(rlo, r1, step(0.5, rIdx));
      rlo = mix(rlo, r2, step(1.5, rIdx));
      rlo = mix(rlo, r3, step(2.5, rIdx));
      rlo = mix(rlo, r4, step(3.5, rIdx));
      rlo = mix(rlo, r5, step(4.5, rIdx));
      rlo = mix(rlo, r6, step(5.5, rIdx));
      float roughGrain = sin(dot(vUvX, vec2(57.7, 91.3)) * 6.2831853);
      roughGrain += 0.55 * sin(dot(vUvX, vec2(-83.1, 43.9)) * 6.2831853);
      roughGrain /= 1.55;
      float pigment = clamp((dot(col.rgb, vec3(0.2126, 0.7152, 0.0722)) - 0.48) * 0.60, -0.35, 0.35);
      float roughnessFactor = clamp(rlo + (roughGrain * 0.72 - pigment) * uRoughVariation, 0.18, 1.0);
      roughnessFactor = mix(roughnessFactor, 0.24, vFrontEdge * uWet);
      `
    );
  };

  mat.customProgramCacheKey = () => 'stage-material-spatial-v4';
  mat.userData.U = U;
  STAGE_MATS.push(mat);
  return mat;
}

/*
  opts:
   spread=true, spreadY, spreadDir, spreadSoft, phaseFrom/To, morphFrom/To
   wet, revealOn, revealY
*/
function setStage(phase, morph, opts = {}) {
  for (const m of STAGE_MATS) {
    const U = m.userData.U;
    if (!U) continue;
    U.uPhase.value = phase;
    U.uMorph.value = morph;
    const spread = !!opts.spread;
    U.uSpreadOn.value = spread ? 1 : 0;
    U.uSpreadY.value = opts.spreadY !== undefined ? opts.spreadY : -999;
    U.uSpreadSoft.value = opts.spreadSoft !== undefined ? opts.spreadSoft : 0.82;
    U.uSpreadDir.value = opts.spreadDir !== undefined ? opts.spreadDir : 1;
    U.uSpreadTime.value = opts.time !== undefined ? opts.time : 0;
    U.uPhaseFrom.value = opts.phaseFrom !== undefined ? opts.phaseFrom : phase;
    U.uPhaseTo.value = opts.phaseTo !== undefined ? opts.phaseTo : phase;
    U.uMorphFrom.value = opts.morphFrom !== undefined ? opts.morphFrom : morph;
    U.uMorphTo.value = opts.morphTo !== undefined ? opts.morphTo : morph;
    U.uWet.value = opts.wet !== undefined ? opts.wet : 0;
    U.uRevealOn.value = opts.revealOn ? 1 : 0;
    U.uRevealY.value = opts.revealY !== undefined ? opts.revealY : -999;
  }
}

/* ------------------------------------------------------------
   崖体材质：支持逐步洞门、主窟、运输洞与局部剖切
   ------------------------------------------------------------ */
const CARVE_MATS = [];
const CARVE_U = {
  uCarveY: { value: 9999 },
  uCarveMin: { value: new THREE.Vector3(-9999, -9999, -9999) },
  uCarveMax: { value: new THREE.Vector3(-9999, -9999, -9999) },
  uCarveMin2: { value: new THREE.Vector3(-9999, -9999, -9999) },
  uCarveMax2: { value: new THREE.Vector3(-9999, -9999, -9999) },
  uCarveMin3: { value: new THREE.Vector3(-9999, -9999, -9999) },
  uCarveMax3: { value: new THREE.Vector3(-9999, -9999, -9999) },
  uDoorMin: { value: new THREE.Vector3(-9999, -9999, -9999) },
  uDoorMax: { value: new THREE.Vector3(-9999, -9999, -9999) },
  uDoorProgress: { value: 0 },
  uArchY: { value: 37.0 },
  uArchH: { value: 4.5 },
  uSectionX: { value: 99999 },
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
      uniform float uDoorProgress;
      uniform float uSectionX;
      uniform float uArchY, uArchH;
      bool inBox(vec3 p, vec3 mn, vec3 mx){
        return all(greaterThan(p, mn)) && all(lessThan(p, mx));
      }
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
       bool sectionZone = vWorldP.x > -18.5 && vWorldP.x < 18.5 &&
                          vWorldP.y > -2.0 && vWorldP.y < 43.5 &&
                          vWorldP.z > -14.5 && vWorldP.z < 18.5;
       if (uSectionX < 9000.0 && sectionZone && vWorldP.x > uSectionX) discard;
       if (inCave(vWorldP, uCarveMin, uCarveMax) && vWorldP.y > uCarveY) discard;
       if (inBox(vWorldP, uCarveMin2, uCarveMax2)) discard;
       if (inBox(vWorldP, uCarveMin3, uCarveMax3)) discard;
       {
         vec3 dmn = uDoorMin, dmx = uDoorMax;
         if (uDoorProgress > 0.001 &&
             vWorldP.x > dmn.x && vWorldP.x < dmx.x &&
             vWorldP.z > dmn.z && vWorldP.z < dmx.z &&
             vWorldP.y > dmn.y) {
           float dcx = (dmn.x + dmx.x) * 0.5;
           float drx = (dmx.x - dmn.x) * 0.5;
           float springY = dmx.y - drx;
           float k = clamp(1.0 - pow((vWorldP.x - dcx) / drx, 2.0), 0.0, 1.0);
           float dtop = springY + drx * sqrt(k);
           if (vWorldP.y < dtop) {
             float vy = clamp((vWorldP.y - dmn.y) / max(0.01, dtop - dmn.y), 0.0, 1.0);
             float vx = abs(vWorldP.x - dcx) / max(0.01, drx);
             float vz = clamp((dmx.z - vWorldP.z) / max(0.01, dmx.z - dmn.z), 0.0, 1.0);
             // 先从外表面凿入，再沿拱顶与两侧扩展；避免一帧切穿整块崖体。
             float order = vz * 0.48 + vy * 0.34 + vx * 0.18;
             if (order < uDoorProgress * 1.06) discard;
           }
         }
       }
      `
    );
  };
  mat.customProgramCacheKey = () => 'carve-spatial-v3-' + mat.uuid;
  CARVE_MATS.push(mat);
  return mat;
}
