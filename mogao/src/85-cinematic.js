/* ===== Local cinematic refinement =====
   A final, source-independent quality pass layered over Round 7.  It deliberately keeps
   the deterministic construction state machine intact and only replaces the visual reads
   that failed review: boulder-like cliffs, toy-dark timber, swollen hands and flat light. */
const CINEMA = {
  root:null, finalFacade:null, finalRibs:null, dust:null, caveDust:null,
  key:null, rim:null, caveWarm:null, walkway:null, paintRelief:null, reliefPegs:null, finalPanels:null, finalStrata:null, installed:false,
};

function makeCinematicSky() {
  const c=document.createElement('canvas');c.width=1024;c.height=512;
  const x=c.getContext('2d'),g=x.createLinearGradient(0,0,0,c.height);
  g.addColorStop(0,'#4d93ad');g.addColorStop(.42,'#82b6c3');g.addColorStop(.72,'#d6c8a8');g.addColorStop(1,'#bda77d');
  x.fillStyle=g;x.fillRect(0,0,c.width,c.height);
  /* Deterministic high desert haze: broad translucent strokes, never a flat studio grey. */
  for(let i=0;i<34;i++){
    const px=hash3(i,1701,3)*c.width,py=40+hash3(i,1703,7)*230;
    const rx=55+hash3(i,1709,11)*165,ry=5+hash3(i,1711,13)*20;
    const a=.018+hash3(i,1717,17)*.045;x.fillStyle=`rgba(246,239,220,${a})`;
    x.beginPath();x.ellipse(px,py,rx,ry,hash3(i,1721,19)*.16,0,TAU);x.fill();
  }
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.mapping=THREE.EquirectangularReflectionMapping;return tex;
}

function colorizeGeometry(geo, darkHex, lightHex, seed=1) {
  const p=geo.attributes.position, colors=new Float32Array(p.count*3);
  const a=new THREE.Color(darkHex), b=new THREE.Color(lightHex), c=new THREE.Color();
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const macro=fbm3(x*.021+seed,y*.026+seed*.7,z*.055+seed*.31,5)-.5;
    const bed=.5+.5*Math.sin(y*.145+fbm2(x*.018,y*.024,3,seed)*2.8);
    const tone=clamp(.42+macro*.62+bed*.18+z*.012,0,1);
    c.copy(a).lerp(b,tone);colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
  }
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
  return geo;
}

function makeCinematicCliffFacade() {
  const sh=new THREE.Shape();
  const outer=[
    [-148,-2],[-147,17],[-145,37],[-140,58],[-130,77],[-111,84],[-90,87],[-67,85],
    [-45,88],[-23,86],[-4,90],[17,87],[39,89],[62,85],[86,88],[111,83],[132,76],
    [142,58],[147,35],[149,14],[147,-2]
  ];
  sh.moveTo(outer[0][0],outer[0][1]);for(let i=1;i<outer.length;i++)sh.lineTo(outer[i][0],outer[i][1]);sh.closePath();
  /* The opening follows the real cliff recess rather than a perfect arch. */
  const hole=new THREE.Path();
  const mouth=[[-31,-1],[-31,18],[-30,35],[-27,52],[-22,65],[-13,72],[-3,74],[8,73],[18,68],[25,58],[29,42],[31,23],[31,-1]];
  hole.moveTo(mouth[0][0],mouth[0][1]);for(let i=1;i<mouth.length;i++)hole.lineTo(mouth[i][0],mouth[i][1]);hole.closePath();sh.holes.push(hole);
  const geo=new THREE.ExtrudeGeometry(sh,{depth:16,steps:2,bevelEnabled:true,bevelThickness:1.45,bevelSize:1.15,bevelSegments:3,curveSegments:24});
  const p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
    let x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const macro=(fbm3(x*.020+11,y*.026+3,z*.075+7,5)-.5)*2.55;
    const fluting=(ridge2(x*.020+fbm2(x*.008,y*.017,3,73)*.75,y*.034,5,87)-.5)*1.45;
    const strata=Math.sin((y*.155+fbm2(x*.013,y*.021,3,91)*2.0)*Math.PI)*.24;
    z+=macro-fluting+strata;
    /* Small edge erosion makes the facade one continuous weathered mass. */
    x+=(fbm2(y*.045,z*.08,3,101)-.5)*.32;
    y+=(fbm2(x*.027,z*.09,3,103)-.5)*.22;
    p.setXYZ(i,x,y,z);
  }
  p.needsUpdate=true;geo.computeVertexNormals();colorizeGeometry(geo,0x887056,0xD8BF92,109);
  const map=TEX.sandstone.map.clone(),normal=TEX.sandstone.normal.clone();
  map.wrapS=map.wrapT=normal.wrapS=normal.wrapT=THREE.RepeatWrapping;map.repeat.set(4.8,2.5);normal.repeat.copy(map.repeat);map.needsUpdate=normal.needsUpdate=true;
  const mat=new THREE.MeshStandardMaterial({map,normalMap:normal,color:0xD1B68B,vertexColors:true,roughness:.965,metalness:0,side:THREE.DoubleSide});
  mat.normalScale.set(.82,.82);
  const mesh=new THREE.Mesh(geo,mat);mesh.name='ContinuousWeatheredMogaoFacade';mesh.position.set(0,0,-12.0);mesh.castShadow=mesh.receiveShadow=true;
  return mesh;
}

function makeAtmosphere(count,spanX,spanY,spanZ,seed,color,size,opacity) {
  const p=new Float32Array(count*3);
  for(let i=0;i<count;i++){
    p[i*3]=(hash3(i,seed,2)-.5)*spanX;
    p[i*3+1]=hash3(i,seed,7)*spanY;
    p[i*3+2]=(hash3(i,seed,11)-.5)*spanZ;
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));
  return new THREE.Points(g,new THREE.PointsMaterial({color,size,transparent:true,opacity,depthWrite:false,blending:THREE.NormalBlending,sizeAttenuation:true}));
}

function makeWeatheredCliffPanel(w,h,x,y,seed,mat) {
  const geo=new THREE.PlaneGeometry(w,h,Math.max(24,Math.round(w*.72)),Math.max(18,Math.round(h*.72))),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
    const wx=p.getX(i)+x,wy=p.getY(i)+y;
    const macro=(fbm2(wx*.018+seed,wy*.025+3,5,seed*1.3)-.5)*6.6;
    const fluting=(ridge2(wx*.018+fbm2(wx*.008,wy*.015,3,seed+7)*.8,wy*.037,5,seed+11)-.5)*3.4;
    const ledge=Math.sin((wy*.14+fbm2(wx*.014,wy*.021,3,seed+17)*2.6)*Math.PI)*.42;
    p.setZ(i,macro-fluting+ledge);
  }
  p.needsUpdate=true;geo.computeVertexNormals();colorizeGeometry(geo,0xA58E6B,0xE7D2A7,seed+23);
  const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,11.5);mesh.castShadow=mesh.receiveShadow=true;return mesh;
}

function makePaintedBuddhaRelief() {
  const geo=new THREE.PlaneGeometry(20.0,33.35,56,84),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i)/10.0,y=(p.getY(i)+16.675)/33.35;
    const torso=Math.exp(-x*x*2.2)*smoothstep(.10,.32,y)*smoothstep(.94,.72,y);
    const head=Math.exp(-x*x*7.5-Math.pow((y-.78)*5.0,2));
    const lap=Math.exp(-x*x*.72-Math.pow((y-.20)*4.0,2));
    p.setZ(i,.18+torso*2.15+head*1.72+lap*1.18-Math.abs(x)*.10);
  }
  p.needsUpdate=true;geo.computeVertexNormals();
  const texture=new THREE.TextureLoader().load('assets/buddha-reference.jpg',()=>{if(typeof APP!=='undefined')APP.dirty=true;});
  texture.colorSpace=THREE.SRGBColorSpace;
  const U={uPaint:{value:0},uMud:{value:0},uWarmth:{value:0}};
  const mat=new THREE.MeshStandardMaterial({map:texture,bumpMap:texture,bumpScale:.36,roughness:.94,metalness:0,transparent:true,opacity:0,alphaTest:.01,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});
  mat.onBeforeCompile=(shader)=>{
    Object.assign(shader.uniforms,U);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      uniform float uPaint;
      uniform float uMud;
      uniform float uWarmth;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float edgeX=smoothstep(0.0,.085,vMapUv.x)*smoothstep(1.0,.915,vMapUv.x);
      float edgeY=smoothstep(0.0,.055,vMapUv.y)*smoothstep(1.0,.945,vMapUv.y);
      float px=abs(vMapUv.x-.5),py=vMapUv.y;
      float haloMask=1.0-smoothstep(.285,.325,length(vec2(vMapUv.x-.5,(py-.792)*.94)));
      float headMask=(1.0-smoothstep(.150,.205,px))*smoothstep(.615,.675,py)*smoothstep(.935,.885,py);
      float torsoMask=1.0-smoothstep(.92,1.08,length(vec2((vMapUv.x-.5)/.31,(py-.50)/.275)));
      float lapMask=1.0-smoothstep(.92,1.07,length(vec2((vMapUv.x-.5)/.47,(py-.175)/.235)));
      float armRaised=1.0-smoothstep(.92,1.08,length(vec2((vMapUv.x-.245)/.175,(py-.455)/.245)));
      float armRest=1.0-smoothstep(.92,1.08,length(vec2((vMapUv.x-.77)/.185,(py-.365)/.265)));
      float armMask=max(armRaised,armRest);
      float figureMask=clamp(max(max(haloMask*uPaint,headMask),max(max(torsoMask,lapMask),armMask)),0.0,1.0);
      float reliefLuma=dot(diffuseColor.rgb,vec3(.299,.587,.114));
      vec3 rockTone=mix(vec3(.245,.195,.145),vec3(.69,.55,.38),smoothstep(.10,.90,reliefLuma));
      vec3 mudTone=mix(vec3(.30,.225,.16),vec3(.82,.68,.49),smoothstep(.08,.94,reliefLuma));
      float mudFront=clamp(uMud*1.15-.08+sin(vMapUv.x*31.0+uMud*7.0)*.018,-.12,1.12);
      float mudCover=1.0-smoothstep(mudFront-.065,mudFront+.065,py);
      vec3 stageTone=mix(rockTone,mudTone,mudCover);
      stageTone*=mix(vec3(.92,.96,1.0),vec3(1.08,.98,.88),uWarmth);
      diffuseColor.rgb=mix(stageTone,diffuseColor.rgb,uPaint)*mix(.50,.82,uPaint);
      diffuseColor.a*=edgeX*edgeY*figureMask;`);
  };
  mat.customProgramCacheKey=()=> 'painted-buddha-relief-v2';
  const mesh=new THREE.Mesh(geo,mat);mesh.name='ReferenceLedPaintedRelief';mesh.position.set(0,16.8,9.86);mesh.castShadow=false;mesh.receiveShadow=true;mesh.visible=false;mesh.userData.reliefUniforms=U;return mesh;
}

function makeCinematicReliefPegs() {
  const group=new THREE.Group();group.name='ReliefSurfaceTimberPegs';group.visible=false;
  const wood=new THREE.MeshStandardMaterial({map:TEX.wood.map,normalMap:TEX.wood.normal,color:0x51301B,roughness:.88,metalness:0,emissive:0x160804,emissiveIntensity:.18});
  const holeMat=new THREE.MeshStandardMaterial({color:0x17100B,roughness:1,side:THREE.DoubleSide});
  const pegGeo=new THREE.CylinderGeometry(.18,.22,3.2,12);
  const holeGeo=new THREE.TorusGeometry(.265,.045,8,18);
  const spots=[[-4.1,24.0],[-1.6,24.8],[1.2,23.7],[3.85,23.0],[-3.25,21.2],[-.85,20.2],[1.9,20.6],[4.15,19.0]];
  for(let i=0;i<spots.length;i++){
    const [x,y]=spots[i];
    const hole=new THREE.Mesh(holeGeo,holeMat);hole.position.set(x,y,12.00);hole.userData={kind:'hole',index:i};group.add(hole);
    const dir=new THREE.Vector3((i%3-1)*.42,(i%2?.30:-.22),1).normalize();
    const base=new THREE.Vector3(x,y,12.03),finalCenter=base.clone().addScaledVector(dir,1.58);
    const peg=new THREE.Mesh(pegGeo,wood);peg.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);peg.position.copy(finalCenter);peg.castShadow=true;peg.userData={kind:'peg',index:i,dir,finalCenter};group.add(peg);
  }
  return group;
}

function scaleGeometryAround(mesh,pivot,scale) {
  if(!mesh||!mesh.geometry)return;
  const names=['position','aRockPos'];
  for(const name of names){
    const a=mesh.geometry.attributes[name];if(!a)continue;
    for(let i=0;i<a.count;i++)a.setXYZ(i,pivot.x+(a.getX(i)-pivot.x)*scale.x,pivot.y+(a.getY(i)-pivot.y)*scale.y,pivot.z+(a.getZ(i)-pivot.z)*scale.z);
    a.needsUpdate=true;
  }
  mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
}

function installCinematicEnhancements(scene,tower,walkway) {
  if(CINEMA.installed)return;CINEMA.installed=true;
  const root=new THREE.Group();root.name='LocalCinematicRefinement';scene.add(root);CINEMA.root=root;

  const sky=makeCinematicSky();APP.skyBackground=sky;APP.skyFogColor.setHex(0xB8B9A5);scene.background=sky;scene.fog.color.copy(APP.skyFogColor);scene.fog.near=270;scene.fog.far=760;
  renderer.toneMappingExposure=1.13;APP.baseExposure=1.13;

  /* Replace the final collection of balloon-like rocks with one stratified cliff body. */
  if(EXHIBIT.finalCliff){
    for(const m of EXHIBIT.finalMasses||[])m.visible=false;
    for(const m of EXHIBIT.finalWings||[])m.visible=false;
    if(EXHIBIT.finalBack){EXHIBIT.finalBack.material.color.setHex(0x8F6947);EXHIBIT.finalBack.position.z=-23.5;}
    const facade=makeCinematicCliffFacade();facade.visible=false;EXHIBIT.finalCliff.add(facade);CINEMA.finalFacade=facade;
    /* Four dense panels provide real erosion relief; the shaped extrusion remains as deep side/back mass. */
    const panelGroup=new THREE.Group();panelGroup.name='SubdividedStratifiedCliffSkin';
    const pMap=new THREE.TextureLoader().load('assets/mogao-cliff-albedo.jpg',()=>{if(typeof APP!=='undefined')APP.dirty=true;}),pNormal=TEX.sandstone.normal.clone();
    pMap.colorSpace=THREE.SRGBColorSpace;pMap.wrapS=pMap.wrapT=pNormal.wrapS=pNormal.wrapT=THREE.RepeatWrapping;pMap.repeat.set(1.05,1.05);pNormal.repeat.set(5.2,3.2);pNormal.needsUpdate=true;
    const pMat=new THREE.MeshStandardMaterial({map:pMap,normalMap:pNormal,color:0xFFF7E5,vertexColors:true,roughness:.972,metalness:0,side:THREE.DoubleSide});pMat.normalScale.set(.72,.72);
    panelGroup.add(makeWeatheredCliffPanel(116,86,-89,42,1601,pMat));
    panelGroup.add(makeWeatheredCliffPanel(116,86,89,42,1607,pMat));
    const topPanel=makeWeatheredCliffPanel(64,18,0,81,1613,pMat);topPanel.position.z=5.2;panelGroup.add(topPanel);
    const sill=makeWeatheredCliffPanel(64,5.5,0,1.3,1619,pMat);panelGroup.add(sill);
    EXHIBIT.finalCliff.add(panelGroup);CINEMA.finalPanels=panelGroup;
    const ribs=new THREE.Group();ribs.name='WindCarvedVerticalRibs';
    const ribMat=new THREE.MeshStandardMaterial({map:TEX.sandstone.map,normalMap:TEX.sandstone.normal,color:0x9D7D5B,roughness:.98});ribMat.normalScale.set(.72,.72);
    for(let r=0;r<18;r++){
      const x=-137+r*(274/17)+(hash3(r,1401,3)-.5)*5.0;if(Math.abs(x)<37)continue;
      const pts=[];for(let i=0;i<=24;i++){const q=i/24,y=1+q*80,xx=x+(fbm2(r*.63,q*2.4,3,1407)-.5)*2.8;pts.push(new THREE.Vector3(xx,y,7.0+Math.sin(q*Math.PI)*.65));}
      const m=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),86,.16+hash3(r,8,5)*.20,7,false),ribMat);m.castShadow=true;ribs.add(m);
    }
    EXHIBIT.finalCliff.add(ribs);CINEMA.finalRibs=ribs;
    const strata=new THREE.Group();strata.name='ErodedHorizontalStrata';
    const strataMat=new THREE.MeshStandardMaterial({color:0xA98863,roughness:1,transparent:true,opacity:.72});
    for(let row=0;row<14;row++){
      const yy=5.8+row*5.55+(hash3(row,1733,3)-.5)*1.6;
      for(const side of [-1,1]){
        const pts=[];for(let i=0;i<=32;i++){const q=i/32,x=side*lerp(34,142,q),z=7.25+(fbm2(row*.31,q*2.6,3,1741)-.5)*1.2;pts.push(new THREE.Vector3(x,yy+Math.sin(q*TAU+row)*.25,z));}
        const line=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),72,.095+hash3(row,side,7)*.08,6,false),strataMat);strata.add(line);
      }
    }
    EXHIBIT.finalCliff.add(strata);CINEMA.finalStrata=strata;
  }

  /* Timber should read as sun-aged wood, not black voxel blocks. */
  CINEMA.walkway=walkway;
  if(walkway)walkway.traverse(o=>{
    if(!o.isMesh||!o.material||!o.material.color)return;
    const lum=o.material.color.r+o.material.color.g+o.material.color.b;
    if(o.material.metalness>.1)o.material.color.setHex(0x565049);
    else if(lum<.42)o.material.color.setHex(0x754528);
    else o.material.color.setHex(0xA96C40);
    if(!o.material.metalness||o.material.metalness<.1)o.material.map=null;
    if('emissive' in o.material){o.material.emissive.setHex(0x1B0D05);o.material.emissiveIntensity=.22;}
    o.material.metalness=Math.min(.04,o.material.metalness||0);o.material.roughness=Math.max(.78,o.material.roughness||0);o.material.envMapIntensity=.24;
  });

  /* Remove the four isolated spherical mountains and recolour the forecourt as sun-warmed stone. */
  if(forecourt){
    for(const o of forecourt.children){if(o.isMesh&&Math.abs(o.position.x)>90&&o.position.y>20)o.visible=false;}
    forecourt.traverse(o=>{if(!o.isMesh||!o.material||!o.material.color)return;const n=o.geometry&&o.geometry.attributes&&o.geometry.attributes.position&&o.geometry.attributes.position.count||0;if(n>1200){o.material.color.setHex(0x9B8B72);o.material.roughness=.96;}});
  }
  if(tower)tower.traverse(o=>{if(!o.isMesh||!o.material||!o.material.color)return;const c=o.material.color;if(c.r>c.g*1.25){c.lerp(new THREE.Color(0xC35C48),.38);}else if(c.r<.32&&c.g<.32){c.lerp(new THREE.Color(0x5E4638),.34);}o.material.envMapIntensity=.32;});
  if(EXHIBIT.sculptFrame&&EXHIBIT.sculptFrame.material&&EXHIBIT.sculptFrame.material.color)EXHIBIT.sculptFrame.material.color.setHex(0xB99A71);

  /* Human hands retain their gestures but lose the swollen, toy-like palm proportions. */
  scaleGeometryAround(BUDDHA.parts.handR,new THREE.Vector3(-6.48,24.55,5.72),new THREE.Vector3(.78,.92,.70));
  scaleGeometryAround(BUDDHA.parts.handL,new THREE.Vector3(5.02,11.85,9.12),new THREE.Vector3(.80,.88,.68));

  const relief=makePaintedBuddhaRelief();BUDDHA.group.add(relief);CINEMA.paintRelief=relief;
  const reliefPegs=makeCinematicReliefPegs();BUDDHA.group.add(reliefPegs);CINEMA.reliefPegs=reliefPegs;

  const mats=BUDDHA.parts.mats||{};
  const tune=(m,color,normal,rough)=>{if(!m||!m.userData||!m.userData.U)return;const U=m.userData.U;U.uFinalTint.value.set(color);U.uNormalAmt.value=normal;if(U.uRough&&U.uRough.value)U.uRough.value[6]=rough;};
  tune(mats.matSkin,0xF0C9A4,.48,.72);tune(mats.matRobe,0xA86045,.68,.78);tune(mats.matRobeLower,0xA9684A,.62,.80);
  tune(mats.matInner,0x2D7892,.58,.76);tune(mats.matSash,0xB6A14F,.54,.78);tune(mats.matHair,0x262321,.28,.74);

  const dust=makeAtmosphere(520,290,82,110,1511,0xE8C99B,.42,.075);dust.position.set(0,0,18);root.add(dust);CINEMA.dust=dust;
  const caveDust=makeAtmosphere(260,43,42,34,1517,0xD9BA91,.20,.11);caveDust.position.set(0,0,0);root.add(caveDust);CINEMA.caveDust=caveDust;

  const key=new THREE.SpotLight(0xFFD7A2,0,330,Math.PI/5.2,.72,1.55);key.position.set(76,92,132);key.target.position.set(0,24,0);scene.add(key,key.target);CINEMA.key=key;
  const rim=new THREE.DirectionalLight(0xC6DCE2,0);rim.position.set(-115,58,84);rim.target.position.set(0,31,4);scene.add(rim,rim.target);CINEMA.rim=rim;
  const caveWarm=new THREE.PointLight(0xFFCB91,0,92,1.78);caveWarm.position.set(-7,26,24);scene.add(caveWarm);CINEMA.caveWarm=caveWarm;
}

function updateCinematicEnhancements(t) {
  if(!CINEMA.installed)return;
  const finalOn=t<15.2||t>=108.6, caveOn=t>=30.2&&t<108.6, sculptOn=t>=51.0&&t<95.4;
  if(CINEMA.dust){CINEMA.dust.visible=finalOn;CINEMA.dust.rotation.y=t*.0018;CINEMA.dust.material.opacity=finalOn?.070:0;}
  if(CINEMA.caveDust){CINEMA.caveDust.visible=caveOn;CINEMA.caveDust.rotation.y=t*.004;CINEMA.caveDust.material.opacity=sculptOn?.115:.075;}
  if(CINEMA.key)CINEMA.key.intensity=finalOn?148:(sculptOn?28:32);
  if(CINEMA.rim)CINEMA.rim.intensity=finalOn?1.42:(sculptOn?.20:.12);
  if(CINEMA.caveWarm)CINEMA.caveWarm.intensity=sculptOn?24:(caveOn?32:0);
  /* The final cliff is always continuous; legacy isolated masses never reappear after seeking. */
  for(const m of EXHIBIT.finalMasses||[])m.visible=false;
  for(const m of EXHIBIT.finalWings||[])m.visible=false;
  if(CINEMA.finalFacade)CINEMA.finalFacade.visible=finalOn;
  if(CINEMA.finalRibs)CINEMA.finalRibs.visible=false;
  if(CINEMA.finalPanels)CINEMA.finalPanels.visible=finalOn;
  if(CINEMA.finalStrata)CINEMA.finalStrata.visible=false;
  if(CINEMA.paintRelief){
    const reliefOn=(t<15.2)||(t>=38.2&&t<108.6),u=CINEMA.paintRelief.userData.reliefUniforms;
    const paint=t<15.2?1:(t>=90.2?easeInOut(windowK(t,90.2,92.15)):0);
    const mud=t<62.4?0:easeInOut(windowK(t,62.4,83.4));
    CINEMA.paintRelief.visible=reliefOn;CINEMA.paintRelief.material.opacity=reliefOn?easeOut(t<15.2?1:windowK(t,38.2,40.0)):0;
    CINEMA.paintRelief.material.roughness=lerp(.98,.76,paint);CINEMA.paintRelief.material.bumpScale=lerp(.44,.22,paint);if(u){u.uPaint.value=paint;u.uMud.value=mud;u.uWarmth.value=clamp(windowK(t,67,90),0,1);}
    const stageSet=new Set(STAGE_MATS),detailSet=new Set([...(BUDDHA.detailMats||[]),...(BUDDHA.haloMats||[])]);
    BUDDHA.group.traverse(o=>{if(!o.isMesh||o===CINEMA.paintRelief)return;const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.some(m=>stageSet.has(m)||detailSet.has(m)))o.visible=!reliefOn;});
    if(reliefOn){if(APP.faceKey)APP.faceKey.intensity=18;if(APP.bodyFill)APP.bodyFill.intensity=20;if(APP.lowerFill)APP.lowerFill.intensity=14;if(APP.caveRim)APP.caveRim.intensity=22;}
  }
  if(CINEMA.reliefPegs){
    const pegOn=t>=56.2&&t<64.8;CINEMA.reliefPegs.visible=pegOn;
    for(const o of CINEMA.reliefPegs.children){
      const st=56.45+o.userData.index*.52,k=clamp((t-st)/.58,0,1),e=easeOut(k);
      o.visible=pegOn&&k>.001;
      if(o.userData.kind==='peg'){
        o.scale.set(1,Math.max(.001,e),1);
        o.position.copy(o.userData.finalCenter).addScaledVector(o.userData.dir,(1-e)*1.25);
      }else{o.scale.setScalar(Math.max(.001,e));}
    }
  }
  if(EXHIBIT.excavationFrame)EXHIBIT.excavationFrame.visible=false;
}
