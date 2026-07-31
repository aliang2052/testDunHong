/* ============================================================
   75 - 轻量电影级后处理：景深、暖色调、暗角、细颗粒
   不依赖外部库；失败时自动回退到 renderer.render。
   ============================================================ */
const POSTFX = { ready:false, target:null, scene:null, camera:null, quad:null, mat:null, w:1, h:1 };

function initPostFX(renderer) {
  try {
    const depth = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    depth.format = THREE.DepthFormat;
    const target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
      depthBuffer: true, stencilBuffer: false,
    });
    target.depthTexture = depth;
    const mat = new THREE.ShaderMaterial({
      depthTest:false, depthWrite:false,
      uniforms:{
        tColor:{value:target.texture}, tDepth:{value:depth},
        resolution:{value:new THREE.Vector2(1,1)},
        cameraNear:{value:0.5}, cameraFar:{value:1400},
        focusDistance:{value:70}, focusRange:{value:80},
        grain:{value:0}, exposureLift:{value:1.045},
      },
      vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
      fragmentShader:`
        varying vec2 vUv;
        uniform sampler2D tColor,tDepth;
        uniform vec2 resolution;
        uniform float cameraNear,cameraFar,focusDistance,focusRange,grain,exposureLift;
        float linearDepth(float z){
          float ndc=z*2.0-1.0;
          return (2.0*cameraNear*cameraFar)/(cameraFar+cameraNear-ndc*(cameraFar-cameraNear));
        }
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){
          vec2 px=1.0/resolution;
          float d=linearDepth(texture2D(tDepth,vUv).x);
          float coc=clamp(abs(d-focusDistance)/max(1.0,focusRange),0.0,1.0);
          vec2 off=px*(0.65+2.4*coc);
          vec3 c=texture2D(tColor,vUv).rgb*0.54;
          c+=texture2D(tColor,vUv+vec2(off.x,0.)).rgb*0.115;
          c+=texture2D(tColor,vUv-vec2(off.x,0.)).rgb*0.115;
          c+=texture2D(tColor,vUv+vec2(0.,off.y)).rgb*0.115;
          c+=texture2D(tColor,vUv-vec2(0.,off.y)).rgb*0.115;
          vec3 bloom=max(c-vec3(0.72),0.0);
          c+=bloom*bloom*0.23;
          // 胶片式暖高光 / 冷阴影，不改变文物主色。
          float lum=dot(c,vec3(.2126,.7152,.0722));
          c=mix(c*vec3(.985,1.00,1.015),c*vec3(1.015,1.005,.985),smoothstep(.23,.78,lum));
          float shadowLift=1.0-smoothstep(.055,.42,lum);
          c+=shadowLift*vec3(.045,.042,.038);
          c=pow(max(c,vec3(0.0)),vec3(.94));
          c=(c-0.5)*1.025+0.5;
          c*=exposureLift;
          float vig=1.0-smoothstep(.38,.90,distance(vUv,vec2(.5)));
          c*=mix(.96,1.0,vig);
          c+=(hash(gl_FragCoord.xy+grain)-.5)/255.0*1.9;
          gl_FragColor=vec4(c,1.0);
        }`,
    });
    const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),mat);
    const s=new THREE.Scene(); s.add(quad);
    const cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    POSTFX.target=target; POSTFX.scene=s; POSTFX.camera=cam; POSTFX.quad=quad; POSTFX.mat=mat; POSTFX.ready=true;
  } catch(e) { console.warn('postFX fallback',e); POSTFX.ready=false; }
}

function resizePostFX(w,h,pixelRatio=1) {
  if(!POSTFX.ready)return;
  const rw=Math.max(1,Math.floor(w*pixelRatio)), rh=Math.max(1,Math.floor(h*pixelRatio));
  if(rw===POSTFX.w&&rh===POSTFX.h)return;
  POSTFX.w=rw;POSTFX.h=rh;POSTFX.target.setSize(rw,rh);POSTFX.mat.uniforms.resolution.value.set(rw,rh);
}

function renderPostFX(renderer, scene, camera, focusDistance=70, time=0) {
  if(!POSTFX.ready){renderer.render(scene,camera);return;}
  const U=POSTFX.mat.uniforms;
  U.cameraNear.value=camera.near;U.cameraFar.value=camera.far;U.focusDistance.value=focusDistance;
  U.focusRange.value=Math.max(18,focusDistance*.72);U.grain.value=time*47.0;
  renderer.setRenderTarget(POSTFX.target);renderer.render(scene,camera);
  renderer.setRenderTarget(null);renderer.render(POSTFX.scene,POSTFX.camera);
}
