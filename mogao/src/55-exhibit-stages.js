/* ============================================================
   55 - Round 7 visual stages
   Deterministic world-space replacements for the causal excavation,
   full seated-sculpture workshop, mural workshop and final Mogao cliff.
   No video, fetch, iframe or remote asset is used.
   ============================================================ */

const EXHIBIT = {
  root:null,
  walkWorkers:[],
  door:null, doorWorkers:[], doorDust:null,
  excavation:null, excavationFrame:null, excavationFill:null, excavationCeiling:null, excavationBack:null,
  excavationMouths:[], excavationWorkers:[], excavationScree:null, excavationDecks:[], excavationFractures:[], excavationMasses:[],
  sculpt:null, sculptDust:null,
  wall:null, wallRaw:null, wallMud:null,
  wallTiles:{white:[],mineral:[],mural:[]}, wallWorkers:[], wallBrushes:[], wallBowls:null, wallDrips:null,
  finalCliff:null, finalBack:null, finalFrame:null, finalMouths:[], finalDust:null, finalWings:[], finalMasses:[], finalTop:null,
};

function makeArchPlate(w,h,arch,mat,z=0){
  const shape=new THREE.Shape(),hw=w*.5;
  shape.moveTo(-hw,0);shape.lineTo(-hw,h-arch);
  for(let i=0;i<=40;i++){const a=Math.PI-Math.PI*i/40;shape.lineTo(Math.cos(a)*hw,h-arch+Math.sin(a)*arch);}
  shape.lineTo(hw,0);shape.closePath();
  const g=new THREE.ShapeGeometry(shape,20),m=new THREE.Mesh(g,mat);m.position.z=z;return m;
}


/* Thick irregular cliff frame: a single eroded mass with real jamb depth, not a pile of rocks. */
function makeIrregularCaveFrame(w,h,openingW,openingH,depth,mat,seed=1){
  const hw=w*.5,shape=new THREE.Shape();
  shape.moveTo(-hw+1.0,0);shape.lineTo(hw-1.0,0);
  shape.lineTo(hw+.35,h*.18);shape.lineTo(hw-.85,h*.38);shape.lineTo(hw+.25,h*.63);shape.lineTo(hw-1.15,h);
  shape.lineTo(hw*.48,h+1.0);shape.lineTo(0,h+.15);shape.lineTo(-hw*.50,h+1.25);shape.lineTo(-hw+1.0,h);
  shape.lineTo(-hw-.30,h*.64);shape.lineTo(-hw+1.20,h*.38);shape.lineTo(-hw-.20,h*.18);shape.closePath();
  const hole=new THREE.Path(),ow=openingW*.5;
  const pts=[[-ow*.94,.75],[-ow,7.0],[-ow*.98,15.0],[-ow*.93,23.0],[-ow*.83,31.2],[-ow*.60,openingH-1.8],[-ow*.22,openingH+.15],[ow*.18,openingH+.05],[ow*.56,openingH-1.7],[ow*.82,31.0],[ow*.93,22.8],[ow,14.2],[ow*.95,.75]];
  hole.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++)hole.lineTo(pts[i][0]+(hash3(i,seed,7)-.5)*.42,pts[i][1]+(hash3(i,seed,11)-.5)*.34);
  hole.closePath();shape.holes.push(hole);
  const g=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelThickness:.26,bevelSize:.24,bevelSegments:2,curveSegments:18});
  const pa=g.attributes.position,colors=new Float32Array(pa.count*3),cDark=new THREE.Color(0x876746),cLight=new THREE.Color(0xD2B082),c=new THREE.Color();
  for(let i=0;i<pa.count;i++){
    let x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i);
    const n=fbm3(x*.082+seed,y*.072,z*.21+seed*.31,4)-.5;
    const fiss=ridge2(x*.046+z*.08,y*.068,3,seed*2.7)-.5;
    const bed=Math.sin((y*.145+fbm2(x*.025,y*.034,3,seed)*1.8)*Math.PI)*.5+.5;
    pa.setXYZ(i,x+n*.82+fiss*.22,y+n*.48+fiss*.18,z+n*.92-fiss*.36);
    const tone=clamp(.48+n*.64+bed*.20-fiss*.22,0,1);c.copy(cDark).lerp(cLight,tone);colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
  }
  pa.needsUpdate=true;g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.computeVertexNormals();
  const localMat=mat.clone();localMat.vertexColors=true;localMat.needsUpdate=true;
  const m=new THREE.Mesh(g,localMat);m.castShadow=m.receiveShadow=true;return m;
}

function makeDescendingFillGeometry(w,d,seed=1){
  const g=new THREE.BoxGeometry(w,1,d,56,4,34),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    let x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const n=fbm3(x*.14+seed,y*2.4,z*.16+seed*.4,4)-.5;
    const r=ridge2(x*.075+z*.045,y*.9,3,seed*3.1)-.5;
    const top=smoothstep(.14,.49,y),front=smoothstep(-d*.35,d*.5,z);
    y+=top*(n*.92+r*.30);z+=front*(n*.30+r*.13);
    p.setXYZ(i,x,y,z);
  }
  p.needsUpdate=true;g.computeVertexNormals();return g;
}

function cloneTileMaterial(baseMap,normalMap,repeat,offset,color=0xffffff,roughness=.92){
  const map=baseMap.clone();map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping;map.repeat.set(repeat.x,repeat.y);map.offset.set(offset.x,offset.y);map.needsUpdate=true;
  let normal=null;if(normalMap){normal=normalMap.clone();normal.wrapS=normal.wrapT=THREE.ClampToEdgeWrapping;normal.repeat.copy(repeat);normal.offset.copy(offset);normal.needsUpdate=true;}
  const mat=new THREE.MeshStandardMaterial({map,normalMap:normal,color,roughness,metalness:0,side:THREE.DoubleSide,transparent:true,opacity:1});
  if(normal)mat.normalScale.set(.82,.82);return mat;
}

function makeDustPoints(count,color,size,seed){
  const g=new THREE.BufferGeometry(),p=new Float32Array(count*3);
  for(let i=0;i<count;i++){p[i*3]=(hash3(i,seed,2)-.5)*68;p[i*3+1]=hash3(i,seed,7)*46;p[i*3+2]=-5+hash3(i,seed,11)*34;}
  g.setAttribute('position',new THREE.BufferAttribute(p,3));
  return new THREE.Points(g,new THREE.PointsMaterial({color,size,transparent:true,opacity:.18,depthWrite:false,sizeAttenuation:true}));
}

function buildExhibitStages(scene){
  const root=new THREE.Group();root.name='Round7VisualStages';scene.add(root);EXHIBIT.root=root;
  const rockMap=TEX.sandstone.map.clone(),rockNormal=TEX.sandstone.normal.clone();rockMap.wrapS=rockMap.wrapT=THREE.RepeatWrapping;rockNormal.wrapS=rockNormal.wrapT=THREE.RepeatWrapping;rockMap.repeat.set(3.4,3.4);rockNormal.repeat.copy(rockMap.repeat);rockMap.needsUpdate=rockNormal.needsUpdate=true;
  const rockMat=new THREE.MeshStandardMaterial({map:rockMap,normalMap:rockNormal,color:0xC5A77D,roughness:.99,metalness:0});rockMat.normalScale.set(2.0,2.0);
  const innerRock=new THREE.MeshStandardMaterial({map:TEX.caveWall.map,normalMap:TEX.caveWall.normal,color:0x705B49,roughness:1,side:THREE.DoubleSide});innerRock.normalScale.set(2.0,2.0);
  const darkRock=new THREE.MeshStandardMaterial({map:TEX.caveWall.map,normalMap:TEX.caveWall.normal,color:0x493C31,roughness:1,side:THREE.DoubleSide});
  const screeMat=new THREE.MeshStandardMaterial({map:TEX.rockCore.map,normalMap:TEX.rockCore.normal,color:0x98734E,roughness:1});

  /* Human scale on the cliff-hugging switchback walkway. */
  for(let i=0;i<5;i++){
    const w=makeWorkerRig(760+i);w.scale.setScalar(1.08+i%2*.06);w.visible=false;root.add(w);EXHIBIT.walkWorkers.push(w);
  }

  /* ---------------- Small entrance stage: a narrow horizontal landing and one readable door. */
  {
    const G=new THREE.Group();G.name='SmallEntranceStage';G.visible=false;root.add(G);EXHIBIT.door=G;
    const facadeGeo=new THREE.PlaneGeometry(74,52,88,54),fp=facadeGeo.attributes.position;
    for(let i=0;i<fp.count;i++){const x=fp.getX(i),y=fp.getY(i)+26;const n=(fbm2(x*.028,y*.035,4,672)-.5)*2.2-ridge2(x*.017,y*.075,4,673)*.9;fp.setY(i,y);fp.setZ(i,9.0+n);}
    fp.needsUpdate=true;facadeGeo.computeVertexNormals();const facadeMat=new THREE.MeshStandardMaterial({map:TEX.sandstone.map,normalMap:TEX.sandstone.normal,color:0xC5A477,roughness:.99});facadeMat.normalScale.set(3.0,3.0);const facade=new THREE.Mesh(facadeGeo,facadeMat);facade.castShadow=facade.receiveShadow=true;G.add(facade);
    const mouthMat=new THREE.MeshStandardMaterial({color:0x17120F,roughness:1,side:THREE.DoubleSide});
    const mouth=makeArchPlate(2.85,4.55,1.28,mouthMat,12.66);mouth.position.set(0,30.30,0);G.add(mouth);
    const jambMat=new THREE.MeshStandardMaterial({map:TEX.sandstone.map,normalMap:TEX.sandstone.normal,color:0xB99668,roughness:.99});jambMat.normalScale.set(2.6,2.6);
    const left=new THREE.Mesh(makeRoughBlockGeometry(.34,4.70,1.55,681,24),jambMat);left.position.set(-1.67,32.65,11.55);left.castShadow=left.receiveShadow=true;G.add(left);
    const right=left.clone();right.geometry=makeRoughBlockGeometry(.38,4.75,1.58,682,24);right.position.x=1.67;G.add(right);
    const crown=new THREE.Mesh(makeErodedRock(683,1.72,.48,.92),jambMat);crown.position.set(0,35.05,11.45);crown.castShadow=crown.receiveShadow=true;G.add(crown);
    const wood=new THREE.MeshStandardMaterial({map:TEX.wood.map,normalMap:TEX.wood.normal,color:0x4D3020,roughness:.90});wood.normalScale.set(1.5,1.5);
    const landing=new THREE.Mesh(new THREE.BoxGeometry(26,.42,2.8),wood);landing.position.set(-1.5,30.15,13.05);landing.castShadow=landing.receiveShadow=true;G.add(landing);
    for(let i=0;i<9;i++){
      const x=lerp(-13.8,10.8,i/8);const a=new THREE.Mesh(new THREE.CylinderGeometry(.11,.14,3.7,9),wood);a.position.set(x,28.45,12.0);a.rotation.x=.62;a.castShadow=true;G.add(a);
      const peg=new THREE.Mesh(new THREE.CylinderGeometry(.10,.12,2.25,9),wood);peg.rotation.z=Math.PI/2;peg.position.set(x,30.0,11.1);G.add(peg);
    }
    const rail=new THREE.Mesh(new THREE.CylinderGeometry(.095,.11,26,9),wood);rail.rotation.z=Math.PI/2;rail.position.set(-1.5,31.35,14.15);G.add(rail);
    for(let i=0;i<7;i++){const r=new THREE.Mesh(new THREE.CylinderGeometry(.08,.10,1.35,8),wood);r.position.set(lerp(-13,10,i/6),30.75,14.15);G.add(r);}
    for(let i=0;i<2;i++){const w=makeWorkerRig(790+i);w.scale.setScalar(1.22);w.position.set(i?4.0:-4.8,30.38,13.9);w.rotation.y=Math.PI;G.add(w);EXHIBIT.doorWorkers.push(w);}
    const dust=makeDustPoints(46,0xCDB18A,.26,697);dust.position.set(0,33.5,10.5);dust.scale.set(.14,.12,.10);dust.material.opacity=.13;G.add(dust);EXHIBIT.doorDust=dust;
  }

  /* ---------------- Causal excavation: an exterior cliff cutaway, never a rectangular stage box. */
  {
    const G=new THREE.Group();G.name='CausalExcavation';G.visible=false;root.add(G);EXHIBIT.excavation=G;
    const frame=makeIrregularCaveFrame(118,66,58.0,47.0,7.2,rockMat,721);
    frame.position.set(-2.0,-.8,6.2);frame.rotation.y=-.030;frame.scale.set(1.04,1.03,1);frame.visible=false;G.add(frame);EXHIBIT.excavationFrame=frame;
    /* Deep asymmetric cliff wings keep the cutaway embedded in a continuous rock mass. */
    for(const [side,seed] of [[-1,724],[1,727]]){
      const wing=new THREE.Mesh(makeRoughBlockGeometry(31,61,24,seed,62),rockMat);
      wing.position.set(side*49.0,30.0,-4.2);wing.rotation.y=side>0?-.18:.14;wing.rotation.z=side*.018;
      wing.castShadow=wing.receiveShadow=true;wing.visible=false;G.add(wing);
    }
    const exMasses=[
      [-31,16,-6,20,31,10,731],[-42,39,-10,25,42,12,733],[-60,29,-15,33,50,15,735],[-82,42,-20,40,57,18,737],
      [31,15,-7,20,30,10,739],[43,38,-11,26,43,12,741],[61,30,-16,34,51,15,743],[83,43,-21,41,58,18,745],
      [-20,54,-12,28,17,13,747],[6,56,-14,30,18,14,749],[31,53,-13,27,17,13,751]
    ];
    for(const [x,y,z,sx,sy,sz,seed] of exMasses){const mm=rockMat.clone();mm.color.lerp(new THREE.Color(0xD4B489),hash3(seed,12,4)*.24);if(mm.normalScale)mm.normalScale.set(1.25,1.25);const mass=new THREE.Mesh(makeErodedRock(seed,sx,sy,sz),mm);mass.position.set(x,y,z);mass.rotation.set((hash3(seed,4,8)-.5)*.08,(hash3(seed,5,9)-.5)*.18,(hash3(seed,6,10)-.5)*.05);mass.castShadow=mass.receiveShadow=true;G.add(mass);EXHIBIT.excavationMasses.push(mass);}

    /* Natural cave shell: thin eroded surfaces continue beyond the camera and have no
       readable rectangular thickness.  This removes the former proscenium / cutaway-box look. */
    const makeSide=(side,seed)=>{
      const g=new THREE.PlaneGeometry(38,52,72,84),pa=g.attributes.position;
      for(let i=0;i<pa.count;i++){
        const depth=pa.getX(i),y=pa.getY(i)+26;
        const macro=(fbm2(depth*.052+seed*.11,y*.036,5,seed*1.7)-.5)*2.4;
        const fiss=(ridge2(depth*.035+seed*.23,y*.080,4,seed*2.3)-.5)*1.30;
        const under=Math.sin((y*.17+fbm2(depth*.040,y*.027,3,seed)*1.8)*Math.PI)*.32;
        pa.setY(i,y);pa.setZ(i,(macro-fiss+under)*side);
      }
      pa.needsUpdate=true;g.computeVertexNormals();g.rotateY(side>0?-Math.PI/2:Math.PI/2);
      const m=new THREE.Mesh(g,innerRock);m.position.set(side*19.3,0,-3.6);m.castShadow=m.receiveShadow=true;return m;
    };
    G.add(makeSide(-1,711),makeSide(1,713));

    const backGeo=new THREE.PlaneGeometry(43,49,76,80),bp=backGeo.attributes.position;
    for(let i=0;i<bp.count;i++){
      const x=bp.getX(i),y=bp.getY(i)+24.5;
      bp.setY(i,y);bp.setZ(i,(fbm2(x*.058,y*.045,5,733)-.5)*1.75-ridge2(x*.032,y*.079,4,739)*.72);
    }
    bp.needsUpdate=true;backGeo.computeVertexNormals();const back=new THREE.Mesh(backGeo,darkRock);back.position.set(0,0,-21.5);back.receiveShadow=true;G.add(back);EXHIBIT.excavationBack=back;

    const floorGeo=new THREE.PlaneGeometry(43,39,72,58),fp=floorGeo.attributes.position;
    for(let i=0;i<fp.count;i++){
      const x=fp.getX(i),z=fp.getY(i);fp.setZ(i,(fbm2(x*.072,z*.061,4,746)-.5)*1.10-ridge2(x*.050,z*.080,3,749)*.28);
    }
    fp.needsUpdate=true;floorGeo.computeVertexNormals();floorGeo.rotateX(-Math.PI/2);
    const floor=new THREE.Mesh(floorGeo,innerRock);floor.position.set(0,.05,-2.8);floor.receiveShadow=true;G.add(floor);

    const ceilingGeo=new THREE.PlaneGeometry(34,25,72,52),cp=ceilingGeo.attributes.position;
    for(let i=0;i<cp.count;i++){
      const x=cp.getX(i),depth=cp.getY(i);
      const macro=(fbm2(x*.061,depth*.054,5,751)-.5)*1.72;
      const chis=(ridge2(x*.084+depth*.024,depth*.074,4,755)-.5)*.72;
      cp.setZ(i,macro-chis-smoothstep(19,-18,depth)*.22);
    }
    cp.needsUpdate=true;ceilingGeo.computeVertexNormals();ceilingGeo.rotateX(-Math.PI/2);
    const ceiling=new THREE.Mesh(ceilingGeo,innerRock);ceiling.position.set(-1.2,41.2,-6.2);ceiling.castShadow=ceiling.receiveShadow=true;G.add(ceiling);EXHIBIT.excavationCeiling=ceiling;

    /* Broken ceiling lip: separated stones instead of one dark horizontal slab. */
    for(let i=0;i<15;i++){
      const q=i/14,x=lerp(-18.2,18.2,q),r=.82+hash3(i,762,4)*1.05;
      const stone=new THREE.Mesh(makeErodedRock(760+i,r*1.45,r*.68,r),rockMat);
      stone.position.set(x,39.65+(hash3(i,4,9)-.5)*1.15,10.7+(hash3(i,8,3)-.5)*1.45);
      stone.rotation.set(hash3(i,2,5)*.3,hash3(i,7,6)*.5,hash3(i,9,1)*.25);stone.castShadow=stone.receiveShadow=true;G.add(stone);
    }

    /* A low irregular excavation front descends with absolute time. It never fills the
       whole frame and disappears once the retained stone core becomes readable. */
    const fillGeo=makeDescendingFillGeometry(31.5,24.0,768);
    const fill=new THREE.Mesh(fillGeo,rockMat);fill.position.set(-1.0,38.3,-5.6);fill.rotation.y=-.035;fill.castShadow=fill.receiveShadow=true;fill.visible=false;G.add(fill);EXHIBIT.excavationFill=fill;
    const mouthMat=new THREE.MeshStandardMaterial({color:0x17120F,roughness:1,side:THREE.DoubleSide});
    for(const [x,y,w,h] of [[-14.2,1.15,5.4,7.4],[14.0,1.20,5.5,7.5],[-13.8,14.4,3.5,5.0]]){
      const mouth=makeArchPlate(w,h,Math.min(1.65,h*.30),mouthMat,14.2);mouth.position.set(x,y,0);mouth.visible=false;G.add(mouth);EXHIBIT.excavationMouths.push(mouth);
    }
    const wood=new THREE.MeshStandardMaterial({map:TEX.wood.map,normalMap:TEX.wood.normal,color:0x4B301F,roughness:.91});wood.normalScale.set(1.3,1.3);
    for(const [yy,x0,x1] of [[32.0,-17,15],[18.2,-18,17],[7.8,-17,16]]){
      const deckGroup=new THREE.Group();deckGroup.visible=false;G.add(deckGroup);EXHIBIT.excavationDecks.push(deckGroup);
      const deck=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,.36,2.2),wood);deck.position.set((x0+x1)/2,yy,13.0);deck.castShadow=deck.receiveShadow=true;deckGroup.add(deck);
      for(let i=0;i<6;i++){const x=lerp(x0+.7,x1-.7,i/5),b=new THREE.Mesh(new THREE.CylinderGeometry(.10,.13,3.35,9),wood);b.position.set(x,yy-1.45,12.0);b.rotation.x=.62;b.castShadow=true;deckGroup.add(b);}
      const rail=new THREE.Mesh(new THREE.CylinderGeometry(.08,.10,x1-x0,8),wood);rail.rotation.z=Math.PI/2;rail.position.set((x0+x1)/2,yy+1.1,14.0);deckGroup.add(rail);
    }
    for(let i=0;i<6;i++){const w=makeWorkerRig(820+i);w.scale.setScalar(.76+i%2*.035);w.visible=false;G.add(w);EXHIBIT.excavationWorkers.push(w);}
    const geo=new THREE.IcosahedronGeometry(1,1),inst=new THREE.InstancedMesh(geo,screeMat,96);inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);inst.castShadow=true;inst.frustumCulled=false;G.add(inst);EXHIBIT.excavationScree=inst;
    /* Vertical fracture seams interrupt the repeated horizontal texture scale. */
    const fractureMat=new THREE.LineBasicMaterial({color:0x654A32,transparent:true,opacity:.38});
    for(let f=0;f<9;f++){const pts=[];const x=-47+f*12.1+(hash3(f,801,2)-.5)*5;for(let i=0;i<9;i++){const y=i*7.2,xx=x+(fbm2(f*.7,i*.4,3,809)-.5)*3.8;pts.push(new THREE.Vector3(xx,y,11.2));}const ln=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),fractureMat);G.add(ln);EXHIBIT.excavationFractures.push(ln);}
  }

  /* ---------------- Sculpture workshop: full seated figure, embedded in a rock alcove. */
  {
    const G=new THREE.Group();G.name='SeatedBuddhaWorkshop';G.visible=false;root.add(G);EXHIBIT.sculpt=G;
    const back=new THREE.Mesh(new THREE.PlaneGeometry(48,43,32,28),innerRock);back.position.set(0,21,-9.0);back.receiveShadow=true;G.add(back);
    const sculptRockMat=new THREE.MeshStandardMaterial({map:TEX.sandstone.map,normalMap:TEX.sandstone.normal,color:0x91775C,roughness:.99});sculptRockMat.normalScale.set(2.8,2.8);
    const frame=makeIrregularCaveFrame(50.5,46.5,34.2,41.0,4.6,sculptRockMat,801);frame.position.set(0,0,8.9);G.add(frame);EXHIBIT.sculptFrame=frame;
    for(const sx of [-1,1]){
      const wall=new THREE.Mesh(makeRoughBlockGeometry(4.0,41.0,25.0,803+(sx>0?2:1),38),innerRock);
      wall.position.set(sx*17.45,20.6,-1.4);wall.rotation.y=sx*.025;wall.castShadow=wall.receiveShadow=true;G.add(wall);
    }
    const crown=new THREE.Mesh(makeRoughBlockGeometry(33.2,2.9,25.0,807,44),innerRock);crown.position.set(0,41.0,-1.4);crown.castShadow=crown.receiveShadow=true;G.add(crown);
    const base=new THREE.Mesh(makeRoughBlockGeometry(25,1.55,15,811,24),innerRock);base.position.set(0,.55,1.2);base.castShadow=base.receiveShadow=true;G.add(base);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(46,28,20,12),innerRock);floor.rotation.x=-Math.PI/2;floor.position.set(0,-.05,5);floor.receiveShadow=true;G.add(floor);
    const dust=makeDustPoints(180,0xD9C2A0,.42,816);dust.material.opacity=.13;G.add(dust);EXHIBIT.sculptDust=dust;
  }

  /* ---------------- Full mural workshop: entire wall carries four simultaneous material states. */
  {
    const G=new THREE.Group();G.name='FullMuralWorkshop';G.visible=false;root.add(G);EXHIBIT.wall=G;
    const rawMat=new THREE.MeshStandardMaterial({map:TEX.caveWall.map,normalMap:TEX.caveWall.normal,color:0x886E55,roughness:.99,side:THREE.DoubleSide});
    const raw=new THREE.Mesh(new THREE.PlaneGeometry(56,43,48,40),rawMat);raw.position.set(5,21.5,-11.5);raw.receiveShadow=true;G.add(raw);EXHIBIT.wallRaw=raw;
    const mudMat=new THREE.MeshStandardMaterial({map:TEX.mudFine.map,normalMap:TEX.mudFine.normal,color:0xB39A79,roughness:.95,side:THREE.DoubleSide});
    const mud=new THREE.Mesh(new THREE.PlaneGeometry(55.4,42.5,38,34),mudMat);mud.position.set(5,21.3,-11.34);mud.receiveShadow=true;G.add(mud);EXHIBIT.wallMud=mud;
    const cols=8,rows=6,tw=55/cols,th=42/rows;
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const repeat=new THREE.Vector2(1/cols,1/rows),offset=new THREE.Vector2(col/cols,row/rows),x=5-27.5+tw*(col+.5),y=th*(row+.5);
      const whiteMat=cloneTileMaterial(TEX.whitewash.map,TEX.whitewash.normal,repeat,offset,0xD9CBAF,.93);
      const white=new THREE.Mesh(new THREE.PlaneGeometry(tw+.10,th+.10),whiteMat);white.position.set(x,y,-11.17);white.visible=false;white.receiveShadow=true;white.userData.order=(rows-1-row)*cols+(row%2?cols-1-col:col);G.add(white);EXHIBIT.wallTiles.white.push(white);
      const mineralMat=cloneTileMaterial(TEX.mural.map,TEX.mural.normal||TEX.mudFine.normal,repeat,offset,0x817766,.90);
      const mineral=new THREE.Mesh(new THREE.PlaneGeometry(tw+.10,th+.10),mineralMat);mineral.position.set(x,y,-11.02);mineral.visible=false;mineral.userData.order=row*cols+(row%2?cols-1-col:col);G.add(mineral);EXHIBIT.wallTiles.mineral.push(mineral);
      const muralMat=cloneTileMaterial(TEX.mural.map,TEX.mural.normal||TEX.mudFine.normal,repeat,offset,0xD7C8A8,.87);
      const mural=new THREE.Mesh(new THREE.PlaneGeometry(tw+.10,th+.10),muralMat);mural.position.set(x,y,-10.87);mural.visible=false;mural.userData.order=row*cols+(row%2?cols-1-col:col);G.add(mural);EXHIBIT.wallTiles.mural.push(mural);
    }
    const wood=new THREE.MeshStandardMaterial({map:TEX.wood.map,normalMap:TEX.wood.normal,color:0x68452D,roughness:.91});
    for(const x of [-17,-3,11,25]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.105,.13,38,9),wood);p.position.set(x,19.0,-6.75);p.castShadow=true;G.add(p);}
    for(const y of [7.0,16.0,25.0,34.0]){const b=new THREE.Mesh(new THREE.CylinderGeometry(.095,.12,45,9),wood);b.rotation.z=Math.PI/2;b.position.set(4,y,-6.55);b.castShadow=true;G.add(b);const deck=new THREE.Mesh(new THREE.BoxGeometry(45,.28,1.85),wood);deck.position.set(4,y-.31,-6.55);deck.castShadow=deck.receiveShadow=true;G.add(deck);}
    for(let i=0;i<4;i++){const w=makeWorkerRig(880+i);w.scale.setScalar(1.02+i%2*.05);w.visible=false;G.add(w);EXHIBIT.wallWorkers.push(w);}
    const bowlGroup=new THREE.Group();
    for(let i=0;i<9;i++){const bowl=new THREE.Mesh(new THREE.CylinderGeometry(.58,.39,.28,24),new THREE.MeshStandardMaterial({color:[0x9B6042,0xD2C3A4,0x466F69,0x7E4C3A,0xB79345][i%5],roughness:.78}));bowl.position.set((i-4)*1.18,0,0);bowlGroup.add(bowl);}bowlGroup.position.set(8,6.55,-5.2);G.add(bowlGroup);EXHIBIT.wallBowls=bowlGroup;
    for(let i=0;i<4;i++){const brush=makeTrowelRig(.60,true);brush.visible=false;G.add(brush);EXHIBIT.wallBrushes.push(brush);}
    const dripPos=[];for(let i=0;i<42;i++){const x=-20+hash3(i,321,3)*49,y=4+hash3(i,322,7)*34,len=.35+hash3(i,323,11)*1.6;dripPos.push(x,y,-10.70,x,y-len,-10.70);}
    const dripGeo=new THREE.BufferGeometry();dripGeo.setAttribute('position',new THREE.Float32BufferAttribute(dripPos,3));
    const drips=new THREE.LineSegments(dripGeo,new THREE.LineBasicMaterial({color:0x76513B,transparent:true,opacity:.0}));G.add(drips);EXHIBIT.wallDrips=drips;
  }

  /* ---------------- Final eroded Mogao cliff around the nine-storey tower. */
  {
    const G=new THREE.Group();G.name='ErodedFinalMogaoCliff';G.visible=false;root.add(G);EXHIBIT.finalCliff=G;
    const mat=new THREE.MeshStandardMaterial({map:TEX.sandstone.map,normalMap:TEX.sandstone.normal,color:0xC9AD82,roughness:.985});mat.normalScale.set(2.8,2.8);
    /* A continuous displaced cliff body and one deep irregular central recess replace the
       previous collection of isolated boulder masses. */
    const backGeo=new THREE.PlaneGeometry(268,82,190,92),bp=backGeo.attributes.position;
    for(let i=0;i<bp.count;i++){
      const x=bp.getX(i),y=bp.getY(i)+41;
      const macro=(fbm2(x*.014,y*.021,5,913)-.5)*6.8;
      const vertical=(ridge2(x*.021+fbm2(x*.009,y*.018,3,921)*.8,y*.034,4,917)-.5)*2.7;
      const strata=Math.sin((y*.115+fbm2(x*.013,y*.020,3,927)*2.2)*Math.PI)*.48;
      bp.setY(i,y);bp.setZ(i,macro-vertical+strata-18.5);
    }
    const backColors=new Float32Array(bp.count*3),bc0=new THREE.Color(0x92704D),bc1=new THREE.Color(0xD2B184),bc=new THREE.Color();
    for(let i=0;i<bp.count;i++){const x=bp.getX(i),y=bp.getY(i),z=bp.getZ(i),tone=clamp(.48+(fbm2(x*.021,y*.028,4,963)-.5)*.72+(z+18.5)*.025,0,1);bc.copy(bc0).lerp(bc1,tone);backColors[i*3]=bc.r;backColors[i*3+1]=bc.g;backColors[i*3+2]=bc.b;}
    bp.needsUpdate=true;backGeo.setAttribute('color',new THREE.BufferAttribute(backColors,3));backGeo.computeVertexNormals();const backMat=mat.clone();backMat.vertexColors=true;const back=new THREE.Mesh(backGeo,backMat);back.castShadow=back.receiveShadow=true;G.add(back);EXHIBIT.finalBack=back;
    const recessMat=new THREE.MeshStandardMaterial({map:TEX.caveWall.map,normalMap:TEX.caveWall.normal,color:0x2B241E,roughness:1,side:THREE.DoubleSide});
    const recess=makeArchPlate(58,70,12.5,recessMat,-.4);recess.position.set(0,0,-.4);recess.receiveShadow=true;G.add(recess);
    const frame=makeIrregularCaveFrame(258,82,60,70,22.0,mat,908);frame.position.set(0,-.4,-20.0);frame.rotation.y=-.025;frame.castShadow=frame.receiveShadow=true;frame.visible=false;G.add(frame);EXHIBIT.finalFrame=frame;
    /* Overlapping eroded masses replace the flat ring facade. Their silhouette, depth and contact shadows remain readable during the final orbit. */
    const masses=[
      [-42,22,-10,27,42,13,981],[-54,52,-16,33,52,16,983],[-82,33,-22,43,62,19,985],[-118,43,-29,48,70,22,987],
      [42,21,-11,28,41,13,989],[56,51,-17,34,53,16,991],[83,34,-23,44,63,19,993],[119,44,-30,49,71,22,995],
      [-28,75,-19,38,20,16,997],[28,76,-20,39,21,16,999],[-72,74,-27,43,28,19,1001],[74,75,-28,44,29,20,1003]
    ];
    for(const [x,y,z,sx,sy,sz,seed] of masses){const mm=mat.clone();const tint=new THREE.Color(0xBFA075).lerp(new THREE.Color(0xD0B184),hash3(seed,7,9)*.42);mm.color.copy(tint);if(mm.normalScale)mm.normalScale.set(1.35,1.35);const mass=new THREE.Mesh(makeErodedRock(seed,sx,sy,sz),mm);mass.position.set(x,y,z);mass.rotation.set((hash3(seed,2,4)-.5)*.08,(hash3(seed,3,5)-.5)*.20,(hash3(seed,4,6)-.5)*.06);mass.castShadow=mass.receiveShadow=true;G.add(mass);EXHIBIT.finalMasses.push(mass);}
    /* Curved side wings and a weathered cliff top give the facade real spatial depth in the final orbit. */
    for(const [side,seed] of [[-1,941],[1,947]]){
      const wing=new THREE.Mesh(makeRoughBlockGeometry(54,82,38,seed,72),mat);
      wing.position.set(side*128,40,-27);wing.rotation.y=side>0?-.22:.20;wing.rotation.z=side*.012;wing.castShadow=wing.receiveShadow=true;wing.visible=false;G.add(wing);EXHIBIT.finalWings.push(wing);
    }
    const topGeo=new THREE.PlaneGeometry(260,78,150,46),tp=topGeo.attributes.position;
    for(let i=0;i<tp.count;i++){const x=tp.getX(i),z=tp.getY(i),n=(fbm2(x*.014,z*.018,5,953)-.5)*5.2-ridge2(x*.021,z*.025,4,959)*1.1;tp.setZ(i,n);}
    tp.needsUpdate=true;topGeo.computeVertexNormals();topGeo.rotateX(-Math.PI/2);
    const top=new THREE.Mesh(topGeo,mat);top.position.set(0,80.3,-38);top.receiveShadow=true;G.add(top);EXHIBIT.finalTop=top;
    /* Long erosion ribs are shallow reliefs attached to the same facade, not separate rocks. */
    const ribMat=new THREE.MeshStandardMaterial({map:TEX.sandstone.map,normalMap:TEX.sandstone.normal,color:0xBFA075,roughness:.99});ribMat.normalScale.set(2.5,2.5);
    for(let r=0;r<12;r++){
      const x=-116+r*(232/11)+(hash3(r,930,2)-.5)*4.2;
      if(Math.abs(x)<36)continue;
      const pts=[];
      for(let i=0;i<=18;i++){
        const q=i/18,y=3+q*72,xx=x+(fbm2(r*.7,q*2.2,3,938)-.5)*3.4;
        pts.push(new THREE.Vector3(xx,y,.25+Math.sin(q*Math.PI)*.9));
      }
      const rib=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),72,.42+hash3(r,4,8)*.34,9,false),ribMat);rib.castShadow=true;G.add(rib);
    }
    const mouthMat=new THREE.MeshStandardMaterial({color:0x271E18,roughness:1,side:THREE.DoubleSide});
    const coords=[[-44,8,4.4,5.4],[-32,17,3.4,4.4],[-47,29,4.0,5.2],[-31,40,3.2,4.2],[-16,51,3.0,4.0],[44,9,4.4,5.4],[33,19,3.4,4.4],[47,31,4.0,5.2],[31,42,3.2,4.2],[16,52,3.0,4.0],[-73,14,3.5,4.6],[73,18,3.5,4.6],[-85,32,3.0,4.0],[86,37,3.0,4.0],[-68,53,2.8,3.8],[69,55,2.8,3.8],[-108,11,3.6,4.7],[-104,25,3.0,4.0],[-96,48,2.8,3.7],[108,13,3.6,4.7],[103,27,3.0,4.0],[96,50,2.8,3.7],[-54,65,2.6,3.5],[55,66,2.6,3.5]];
    const finalWood=new THREE.MeshStandardMaterial({map:TEX.wood.map,normalMap:TEX.wood.normal,color:0x4A2D1D,roughness:.91});
    for(let ci=0;ci<coords.length;ci++){
      const [x,y,w0,h0]=coords[ci],w=w0*1.24,h=h0*1.18,depth=1.4+hash3(ci,966,2)*1.8;
      const m=makeArchPlate(w,h,Math.min(1.8,h*.32),mouthMat,depth);m.position.set(x,y,depth);m.rotation.z=(hash3(ci,971,3)-.5)*.035;G.add(m);EXHIBIT.finalMouths.push(m);
      if(ci%3!==1){const ledge=new THREE.Mesh(new THREE.BoxGeometry(w*1.55,.24,1.55),finalWood);ledge.position.set(x,y-.18,depth+.48);ledge.castShadow=ledge.receiveShadow=true;G.add(ledge);}
    }
    const dust=makeDustPoints(360,0xDEC7A2,.58,918);dust.position.z=18;dust.material.opacity=.14;G.add(dust);EXHIBIT.finalDust=dust;
  }

  updateExhibitStages(0,{carveY:0});
  return root;
}

function updateExhibitStages(t,carve){
  if(!EXHIBIT.root)return;
  const walkOn=t>=19.15&&t<25.25;
  const doorOn=t>=24.2&&t<30.2;
  const exOn=t>=30.2&&t<51.6;
  const sculptOn=t>=51.6&&t<95.4;
  const wallOn=t>=95.4&&t<108.6;
  const finalOn=t<15.2||t>=108.6;
  EXHIBIT.door.visible=doorOn;EXHIBIT.excavation.visible=exOn;EXHIBIT.sculpt.visible=sculptOn;EXHIBIT.wall.visible=wallOn;EXHIBIT.finalCliff.visible=finalOn;
  if(EXHIBIT.finalFrame)EXHIBIT.finalFrame.visible=false;

  EXHIBIT.walkWorkers.forEach((w,i)=>{
    const levels=walkway&&walkway.userData&&walkway.userData.levels;
    const active=walkOn&&levels&&i<4;w.visible=!!active;if(!active)return;
    const li=[0,1,1,2][i],L=levels[Math.min(levels.length-1,li)],u=[.25,.22,.76,.55][i];
    w.scale.setScalar(1.72+(i%2)*.08);w.position.set(lerp(L.x0+1.4,L.x1-1.4,u),L.y+.16,L.z1-.72);
    w.rotation.y=i%2?-.95:2.15;poseWorker(w,t*.82+i*.19,i===3?'hammer':(i===0?'carry':'trowel'));
  });

  if(walkway&&walkway.userData&&walkway.userData.segs){
    walkway.userData.segs.forEach(g=>{g.visible=!doorOn;});
  }
  if(doorOn){
    EXHIBIT.doorWorkers.forEach((w,i)=>{w.visible=true;poseWorker(w,t*.88+i*.27,i?'hammer':'trowel');});
    if(EXHIBIT.doorDust){EXHIBIT.doorDust.rotation.y=t*.08;EXHIBIT.doorDust.material.opacity=.09+.05*pulse01(t*.8,.18);}
    if(CONSTRUCTION.dust&&CONSTRUCTION.dust.points){CONSTRUCTION.dust.points.material.opacity=Math.min(CONSTRUCTION.dust.points.material.opacity,.10);CONSTRUCTION.dust.points.material.size=.28;}
    if(CONSTRUCTION.chunks)CONSTRUCTION.chunks.count=Math.min(CONSTRUCTION.chunks.count,12);
    if(CONSTRUCTION.chips)CONSTRUCTION.chips.count=Math.min(CONSTRUCTION.chips.count,14);
    if(CONSTRUCTION.frontRing)CONSTRUCTION.frontRing.visible=false;
    if(CONSTRUCTION.flash)CONSTRUCTION.flash.intensity=Math.min(CONSTRUCTION.flash.intensity,8);
  }

  if(exOn){
    if(EXHIBIT.excavationFrame)EXHIBIT.excavationFrame.visible=false;
    const top=clamp(carve.carveY,1.8,39.5),fill=EXHIBIT.excavationFill;
    fill.visible=t>=34.2&&t<37.15;fill.scale.set(1,1,1);fill.position.y=top;
    EXHIBIT.excavationCeiling.visible=t<37.35;EXHIBIT.excavationCeiling.position.y=lerp(41.55,40.15,easeInOut(windowK(t,30.2,37.0)));
    EXHIBIT.excavationDecks.forEach((g,i)=>{g.visible=t>=30.2+[0,11.2,15.7][i];});
    if(CONSTRUCTION.dust&&CONSTRUCTION.dust.points){CONSTRUCTION.dust.points.material.opacity=Math.min(CONSTRUCTION.dust.points.material.opacity,.22);CONSTRUCTION.dust.points.material.size=.48;}
    if(CONSTRUCTION.chunks)CONSTRUCTION.chunks.count=Math.min(CONSTRUCTION.chunks.count,24);
    if(CONSTRUCTION.chips)CONSTRUCTION.chips.count=Math.min(CONSTRUCTION.chips.count,22);
    if(CONSTRUCTION.frontRing)CONSTRUCTION.frontRing.visible=false;
    if(CONSTRUCTION.frontSlab)CONSTRUCTION.frontSlab.visible=false;
    if(CONSTRUCTION.doorGuide)CONSTRUCTION.doorGuide.visible=false;
    if(CONSTRUCTION.doorLine)CONSTRUCTION.doorLine.visible=false;
    if(CONSTRUCTION.archLine)CONSTRUCTION.archLine.visible=false;
    if(CONSTRUCTION.sectionPlane)CONSTRUCTION.sectionPlane.visible=false;
    if(CONSTRUCTION.sectionEdges)CONSTRUCTION.sectionEdges.visible=false;
    if(CONSTRUCTION.workPlatform)CONSTRUCTION.workPlatform.visible=false;
    if(CONSTRUCTION.cutBlocks)CONSTRUCTION.cutBlocks.count=Math.min(CONSTRUCTION.cutBlocks.count,5);
    if(CONSTRUCTION.chips)CONSTRUCTION.chips.count=Math.min(CONSTRUCTION.chips.count,6);
    const lowerK=windowK(t,46.2,51.3);EXHIBIT.excavationMouths.forEach((m,i)=>{const delay=i*.18,q=clamp((lowerK-delay)/.58,0,1);m.visible=q>.005;m.scale.setScalar(Math.max(.001,easeOut(q)));});
    EXHIBIT.excavationWorkers.forEach((w,i)=>{
      const active=i<(t<37?2:(t<46?4:6));w.visible=active;if(!active)return;
      const levels=t<37?[32,32]:t<46?[32,32,18,18]:[32,18,18,8,8,8],yy=levels[i]||8;
      const xs=[-10,5,-12,7,-9,8];w.position.set(xs[i],yy+.15,13.65);w.rotation.y=i%2?-.9:2.1;poseWorker(w,t*.88+i*.17,i===4?'carry':'hammer');
    });
    const inst=EXHIBIT.excavationScree,M=new THREE.Matrix4(),Q=new THREE.Quaternion(),S=new THREE.Vector3();
    for(let i=0;i<inst.count;i++){const seed=hash3(i,991,3),age=frac(t*.34+seed*3.1),x=(seed-.5)*29,y=top+1.5+age*(2+hash3(i,5,7)*4)-age*age*10,z=7.5+age*(3+hash3(i,11,13)*6);Q.setFromEuler(new THREE.Euler(age*5,seed*6,age*7));const ss=.10+hash3(i,17,19)*.34;M.compose(new THREE.Vector3(x,y,z),Q,S.set(ss,ss*.7,ss*.8));inst.setMatrixAt(i,M);}inst.instanceMatrix.needsUpdate=true;
  }

  if(sculptOn && EXHIBIT.sculptDust){EXHIBIT.sculptDust.rotation.y=t*.006;EXHIBIT.sculptDust.material.opacity=.10+.05*Math.sin(t*.5)*.5+.025;}

  if(wallOn){
    const mud=t<98.75?easeInOut(windowK(t,95.4,98.75)):1;
    const white=t<98.35?0:(t<102.65?easeInOut(windowK(t,98.35,102.65)):1);
    const mural=t<102.45?0:easeInOut(windowK(t,102.45,108.6));
    EXHIBIT.wallMud.visible=mud>.01;EXHIBIT.wallMud.scale.y=Math.max(.001,mud);EXHIBIT.wallMud.position.y=21.3*mud;
    const reveal=(arr,p,lag=.14)=>arr.forEach((m,i)=>{const order=m.userData.order/Math.max(1,arr.length-1),q=clamp((p-order+lag)/.20,0,1);m.visible=q>.004;m.material.opacity=q;m.scale.set(.97+.03*easeOut(q),.97+.03*easeOut(q),1);});
    const mineralPreview=t<99.15?0:clamp(windowK(t,99.15,102.65)*.52,0,.52);
    reveal(EXHIBIT.wallTiles.white,Math.min(1,white+.12),.34);
    reveal(EXHIBIT.wallTiles.mineral,Math.max(mineralPreview,mural),.38);
    reveal(EXHIBIT.wallTiles.mural,Math.max(0,(mural-.06)/.94),.30);
    const phaseP=t<98.75?mud:(t<102.65?white:mural);
    if(EXHIBIT.wallDrips){EXHIBIT.wallDrips.material.opacity=t<102.45?.16:.34;EXHIBIT.wallDrips.visible=true;}
    EXHIBIT.wallWorkers.forEach((w,i)=>{w.visible=true;const p=clamp(phaseP+i*.055,0,.999),band=Math.floor(p*5),u=frac(p*5),x=lerp(-17,25,band%2?1-u:u),y=6.7+band*7.5;w.position.set(x,y,-5.55);w.rotation.y=Math.PI;poseWorker(w,t*.75+i*.23,i===3?'carry':'trowel');});
    EXHIBIT.wallBrushes.forEach((b,i)=>{b.visible=true;const p=clamp(phaseP+i*.032,0,.999),band=Math.floor(p*5),u=frac(p*5);b.position.set(lerp(-17,25,band%2?1-u:u),6.7+band*7.5,-10.5);b.rotation.set(Math.PI/2,0,Math.sin(t*4+i)*.25);b.scale.setScalar(.64);});
  }

  if(BUDDHA.group){
    if(wallOn){BUDDHA.group.position.set(-14.2,0,-.8);BUDDHA.group.scale.setScalar(.64);BUDDHA.group.rotation.y=.10;}
    else{BUDDHA.group.position.set(0,0,0);BUDDHA.group.scale.setScalar(1);BUDDHA.group.rotation.y=0;}
  }

  /* Dedicated exhibit crews replace the generic miniature crew during the three exterior construction stages. */
  if(walkOn||doorOn||exOn){
    for(const w of CONSTRUCTION.workers||[])w.visible=false;
    if(CONSTRUCTION.workPlatform)CONSTRUCTION.workPlatform.visible=false;
  }

  const dedicated=doorOn||exOn||sculptOn||wallOn||finalOn;
  if(WORLD.cliffBody)WORLD.cliffBody.visible=!dedicated;
  if(WORLD.cliffFace)WORLD.cliffFace.visible=!dedicated;
  if(WORLD.dune)WORLD.dune.visible=!dedicated;
  if(WORLD.cave)WORLD.cave.visible=!dedicated;
  if(WORLD.arch)WORLD.arch.visible=!dedicated;
  if(WORLD.fractures)WORLD.fractures.visible=!dedicated;
  if(WORLD.scree)WORLD.scree.visible=!dedicated;
  if(WORLD.smallCaves)WORLD.smallCaves.visible=!dedicated;
  if(forecourt&&forecourt.userData&&forecourt.userData.cliffGroup)forecourt.userData.cliffGroup.visible=!finalOn;
  if(WORLD.towerCliffWings)WORLD.towerCliffWings.visible=false;
  if(WORLD.caveBackdrop)WORLD.caveBackdrop.visible=false;
  if(WORLD.excavationVoid)WORLD.excavationVoid.visible=false;
  if(WORLD.excavationRim)WORLD.excavationRim.visible=false;
  if(WORLD.rockFill&&dedicated)WORLD.rockFill.visible=false;
}
