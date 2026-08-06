/* ============================================================
   41 - 用户确认的 v3 彩绘佛像
   资产由 build.js 以内嵌 GLB 注入；这里只实现该冻结资产需要的
   GLB 2.0 子集，避免运行时网络请求和额外 loader 依赖。
   ============================================================ */

const REFERENCE_BUDDHA_HEIGHT = 35.5;
const REFERENCE_BUDDHA_Z = 0.40;

function referenceFail(message) {
  throw new Error(`彩绘佛像 GLB：${message}`);
}

function decodeEmbeddedBuddhaGLB() {
  const el = document.getElementById('buddha-glb');
  if (!el) referenceFail('找不到内嵌资产节点');
  const encoded = (el.textContent || '').trim();
  if (!encoded) referenceFail('内嵌资产为空');
  const expectedBytes = Number(el.dataset.bytes || 0);
  const expectedSha256 = el.dataset.sha256 || '';
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  el.remove();
  if (expectedBytes && bytes.byteLength !== expectedBytes) {
    referenceFail(`字节数不一致，期望 ${expectedBytes}，实际 ${bytes.byteLength}`);
  }
  return { bytes, expectedBytes, expectedSha256 };
}

function parseBuddhaGLB(bytes) {
  if (bytes.byteLength < 20) referenceFail('文件过短');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) referenceFail('magic 不是 glTF');
  if (view.getUint32(4, true) !== 2) referenceFail('只支持 GLB 2.0');
  if (view.getUint32(8, true) !== bytes.byteLength) referenceFail('声明长度不匹配');

  let json = null;
  let bin = null;
  let offset = 12;
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) referenceFail('chunk 头越界');
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const end = offset + 8 + length;
    if (end > bytes.byteLength) referenceFail('chunk 数据越界');
    if (type === 0x4e4f534a) {
      json = JSON.parse(new TextDecoder().decode(bytes.subarray(offset + 8, end)));
    } else if (type === 0x004e4942) {
      bin = bytes.subarray(offset + 8, end);
    }
    offset = end;
  }
  if (offset !== bytes.byteLength || !json || !bin) referenceFail('缺少 JSON 或 BIN chunk');
  if (json.asset?.version !== '2.0') referenceFail('JSON 不是 glTF 2.0');
  if ((json.extensionsRequired || []).length) referenceFail('包含不支持的 required extensions');
  if ((json.images || []).length || (json.textures || []).length) referenceFail('冻结资产不应包含图片或纹理');
  if ((json.animations || []).length || (json.skins || []).length) referenceFail('冻结资产不应包含动画或骨骼');

  const itemSizes = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const componentTypes = {
    5121: Uint8Array,
    5123: Uint16Array,
    5125: Uint32Array,
    5126: Float32Array,
  };

  function readAccessor(index) {
    const accessor = json.accessors?.[index];
    if (!accessor) referenceFail(`accessor ${index} 不存在`);
    if (accessor.sparse) referenceFail(`accessor ${index} 使用 sparse`);
    const bufferView = json.bufferViews?.[accessor.bufferView];
    if (!bufferView || bufferView.buffer !== 0) referenceFail(`accessor ${index} bufferView 无效`);
    const itemSize = itemSizes[accessor.type];
    const TypedArray = componentTypes[accessor.componentType];
    if (!itemSize || !TypedArray) referenceFail(`accessor ${index} 类型不受支持`);
    const packedStride = itemSize * TypedArray.BYTES_PER_ELEMENT;
    if (bufferView.byteStride && bufferView.byteStride !== packedStride) {
      referenceFail(`accessor ${index} 使用交错 byteStride`);
    }
    const localOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
    const length = accessor.count * itemSize;
    const byteLength = length * TypedArray.BYTES_PER_ELEMENT;
    if (localOffset < 0 || localOffset + byteLength > bin.byteLength) {
      referenceFail(`accessor ${index} 数据越界`);
    }
    const absoluteOffset = bin.byteOffset + localOffset;
    let array;
    if (absoluteOffset % TypedArray.BYTES_PER_ELEMENT === 0) {
      array = new TypedArray(bin.buffer, absoluteOffset, length);
    } else {
      const copy = bin.slice(localOffset, localOffset + byteLength);
      array = new TypedArray(copy.buffer, copy.byteOffset, length);
    }
    return {
      array,
      count: accessor.count,
      itemSize,
      normalized: !!accessor.normalized,
      min: accessor.min || null,
      max: accessor.max || null,
    };
  }

  const referenceMaterials = [];
  const referenceMeshes = [];
  let vertexCount = 0;
  let triangleCount = 0;
  let coloredMeshCount = 0;

  function makeMaterial(index, hasVertexColors, localBounds) {
    const definition = json.materials?.[index] || {};
    const pbr = definition.pbrMetallicRoughness || {};
    const factor = pbr.baseColorFactor || [1, 1, 1, 1];
    const isPaintedBody = hasVertexColors && localBounds && !localBounds.isEmpty();
    const material = new THREE.MeshStandardMaterial({
      color: isPaintedBody
        ? new THREE.Color(0xffffff)
        : new THREE.Color().setRGB(factor[0], factor[1], factor[2]),
      opacity: factor[3],
      transparent: factor[3] < 0.999,
      // The supplied showcase does not read COLOR_0 at render time. Its final
      // appearance is a local-position shader, so keep the richer v3 color
      // accessor in the geometry without multiplying it into the material.
      vertexColors: false,
      metalness: isPaintedBody ? 0.02 : (pbr.metallicFactor ?? 1),
      roughness: isPaintedBody ? 0.72 : (pbr.roughnessFactor ?? 1),
      side: isPaintedBody || definition.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      dithering: true,
    });
    material.name = definition.name || `ReferenceMaterial${index}`;
    material.userData.referenceBaseOpacity = factor[3];
    if (isPaintedBody) {
      const localSize = localBounds.getSize(new THREE.Vector3());
      const paintUniforms = {
        uReferencePaintFront: { value: -1.08 },
        uReferencePaintSoft: { value: 0.055 },
        uReferenceClay: { value: new THREE.Color(0xDCC7A5) },
        uBuddhaMin: { value: localBounds.min.clone() },
        uBuddhaSize: { value: localSize },
      };
      material.userData.referencePaintUniforms = paintUniforms;
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, paintUniforms);
        shader.vertexShader = `varying vec3 vBuddhaPos;\n` + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `vBuddhaPos = position;\n#include <begin_vertex>`
        );
        shader.fragmentShader = `
          varying vec3 vBuddhaPos;
          uniform float uReferencePaintFront;
          uniform float uReferencePaintSoft;
          uniform vec3 uReferenceClay;
          uniform vec3 uBuddhaMin;
          uniform vec3 uBuddhaSize;
        ` + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          `
          vec3 bp = (vBuddhaPos - uBuddhaMin) / uBuddhaSize;
          float yn = bp.y;
          float xn = (bp.x - .5) * 2.;
          float front = bp.z;
          vec3 blue = vec3(.009, .147, .223);
          vec3 red = vec3(.397, .078, .055);
          vec3 ochre = vec3(.591, .323, .078);
          vec3 skin = vec3(.720, .420, .280);
          vec3 hair = vec3(.033, .021, .020);
          vec3 jade = vec3(.017, .263, .243);
          vec3 gold = vec3(.784, .510, .135);
          vec3 robe = xn < -.10 ? blue : (xn > .20 ? red : ochre);

          if (yn > .95 || (yn > .84 && abs(xn) > .57) || (yn > .87 && front < .25)) robe = hair;
          else if (yn > .79 && yn < .94 && abs(xn) > .16 && abs(xn) < .38 && front > .10 && front < .65) robe = skin;
          else if (yn > .81 && abs(xn) < mix(.14, .48, smoothstep(.81, .90, yn)) && front > .20) robe = skin;
          else if (yn > .56 && yn < .84 && xn > .52 && front > .66) robe = skin;
          else if (yn > .16 && yn < .56 && xn < -.56 && front > .70) robe = skin;
          else if (yn > .12 && yn < .34 && xn > .72 && front > .72) robe = skin;

          float chestProgress = smoothstep(.64, .82, yn);
          float chestWidth = .255 * pow(chestProgress, .72);
          float chestEdge = 1. - smoothstep(-.008, .018, abs(xn) - chestWidth);
          float chestMask = smoothstep(.64, .675, yn) * (1. - smoothstep(.82, .835, yn)) * chestEdge;
          robe = mix(robe, skin, chestMask);

          if (yn > .08 && yn < .60 && abs(xn) < .34 && front > .50) {
            float weave = sin(vBuddhaPos.x * 92. + vBuddhaPos.y * 38.)
              + sin(vBuddhaPos.x * 168. - vBuddhaPos.y * 34.);
            if (weave > 1.28) robe = jade;
            else if (weave < -.98) robe = gold;
          }

          float referencePaint = smoothstep(
            uReferencePaintFront - uReferencePaintSoft,
            uReferencePaintFront + uReferencePaintSoft,
            vBuddhaPos.y
          );
          diffuseColor.rgb = mix(uReferenceClay, robe, referencePaint);
          `
        );
      };
      material.customProgramCacheKey = () => 'reference-buddha-position-paint-v2';
    }
    if ((definition.name || '').includes('白毫')) material.userData.referencePaintY = 0.79;
    referenceMaterials.push(material);
    return material;
  }

  function makePrimitive(primitive, meshName, primitiveIndex) {
    if (primitive.mode !== undefined && primitive.mode !== 4) referenceFail('只支持 TRIANGLES primitive');
    const position = readAccessor(primitive.attributes?.POSITION);
    const normal = readAccessor(primitive.attributes?.NORMAL);
    if (position.itemSize !== 3 || normal.itemSize !== 3 || position.count !== normal.count) {
      referenceFail(`${meshName} 的 POSITION/NORMAL 无效`);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position.array, 3, position.normalized));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normal.array, 3, normal.normalized));
    let hasVertexColors = false;
    if (primitive.attributes.COLOR_0 !== undefined) {
      const color = readAccessor(primitive.attributes.COLOR_0);
      if ((color.itemSize !== 3 && color.itemSize !== 4) || color.count !== position.count) {
        referenceFail(`${meshName} 的 COLOR_0 无效`);
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(color.array, color.itemSize, color.normalized));
      hasVertexColors = true;
      coloredMeshCount++;
    }
    if (primitive.attributes.TEXCOORD_0 !== undefined) {
      const uv = readAccessor(primitive.attributes.TEXCOORD_0);
      if (uv.itemSize !== 2 || uv.count !== position.count) referenceFail(`${meshName} 的 TEXCOORD_0 无效`);
      geometry.setAttribute('uv', new THREE.BufferAttribute(uv.array, 2, uv.normalized));
    }
    if (primitive.indices === undefined) referenceFail(`${meshName} 缺少 indices`);
    const indices = readAccessor(primitive.indices);
    if (indices.itemSize !== 1 || indices.count % 3 !== 0) referenceFail(`${meshName} indices 无效`);
    geometry.setIndex(new THREE.BufferAttribute(indices.array, 1, indices.normalized));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const material = makeMaterial(primitive.material, hasVertexColors, geometry.boundingBox);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = primitiveIndex ? `${meshName}.${primitiveIndex}` : meshName;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    referenceMeshes.push(mesh);
    vertexCount += position.count;
    triangleCount += indices.count / 3;
    return mesh;
  }

  function makeMesh(index) {
    const definition = json.meshes?.[index];
    if (!definition || !definition.primitives?.length) referenceFail(`mesh ${index} 无 primitive`);
    if (definition.primitives.length === 1) {
      return makePrimitive(definition.primitives[0], definition.name || `ReferenceMesh${index}`, 0);
    }
    const group = new THREE.Group();
    group.name = definition.name || `ReferenceMesh${index}`;
    definition.primitives.forEach((primitive, i) => group.add(makePrimitive(primitive, group.name, i)));
    return group;
  }

  function makeNode(index) {
    const definition = json.nodes?.[index];
    if (!definition) referenceFail(`node ${index} 不存在`);
    const object = definition.mesh !== undefined ? makeMesh(definition.mesh) : new THREE.Group();
    object.name = definition.name || object.name || `ReferenceNode${index}`;
    if (definition.matrix) {
      object.matrix.fromArray(definition.matrix);
      object.matrixAutoUpdate = false;
    } else {
      if (definition.translation) object.position.fromArray(definition.translation);
      if (definition.rotation) object.quaternion.fromArray(definition.rotation);
      if (definition.scale) object.scale.fromArray(definition.scale);
    }
    for (const child of definition.children || []) object.add(makeNode(child));
    return object;
  }

  const assetRoot = new THREE.Group();
  assetRoot.name = 'EmbeddedBuddhaGLB';
  const sceneIndex = json.scene ?? 0;
  const sceneDefinition = json.scenes?.[sceneIndex];
  if (!sceneDefinition) referenceFail(`scene ${sceneIndex} 不存在`);
  for (const node of sceneDefinition.nodes || []) assetRoot.add(makeNode(node));
  assetRoot.updateMatrixWorld(true);

  return {
    root: assetRoot,
    materials: referenceMaterials,
    meshes: referenceMeshes,
    stats: {
      glbVersion: 2,
      meshCount: referenceMeshes.length,
      vertexCount,
      triangleCount,
      coloredMeshCount,
      nodeCount: (json.nodes || []).length,
      materialCount: referenceMaterials.length,
      extensionsRequired: (json.extensionsRequired || []).slice(),
    },
  };
}

function buildImportedBuddha() {
  try {
    const embedded = decodeEmbeddedBuddhaGLB();
    const parsed = parseBuddhaGLB(embedded.bytes);
    const sourceBounds = new THREE.Box3().setFromObject(parsed.root);
    const sourceSize = sourceBounds.getSize(new THREE.Vector3());
    if (!Number.isFinite(sourceSize.y) || sourceSize.y <= 0) referenceFail('包围盒高度无效');

    const fitted = new THREE.Group();
    fitted.name = 'ReferenceBuddhaV3';
    fitted.add(parsed.root);
    const scale = REFERENCE_BUDDHA_HEIGHT / sourceSize.y;
    fitted.scale.setScalar(scale);
    fitted.position.set(
      -(sourceBounds.min.x + sourceBounds.max.x) * 0.5 * scale,
      -sourceBounds.min.y * scale,
      REFERENCE_BUDDHA_Z - (sourceBounds.min.z + sourceBounds.max.z) * 0.5 * scale,
    );
    fitted.updateMatrixWorld(true);
    const fittedBounds = new THREE.Box3().setFromObject(fitted);
    const fittedSize = fittedBounds.getSize(new THREE.Vector3());

    BUDDHA.referenceGroup = fitted;
    BUDDHA.referenceMaterials = parsed.materials;
    BUDDHA.referenceMeshes = parsed.meshes;
    BUDDHA.referenceReady = true;
    BUDDHA.referenceStats = {
      ...parsed.stats,
      bytes: embedded.bytes.byteLength,
      sha256: embedded.expectedSha256,
      sourceBounds: { min: sourceBounds.min.toArray(), max: sourceBounds.max.toArray(), size: sourceSize.toArray() },
      fittedBounds: { min: fittedBounds.min.toArray(), max: fittedBounds.max.toArray(), size: fittedSize.toArray() },
      scale,
      frontAxis: '+Z',
    };
    setImportedBuddhaOpacity(0);
    return fitted;
  } catch (error) {
    BUDDHA.referenceReady = false;
    BUDDHA.referenceStats = { error: String(error && (error.message || error) || error) };
    console.warn('彩绘佛像加载失败，已回退到程序化佛像。', error);
    return null;
  }
}

function setImportedBuddhaOpacity(value) {
  const opacity = clamp(Number(value) || 0, 0, 1);
  BUDDHA.referenceOpacity = opacity;
  if (!BUDDHA.referenceGroup) return;
  BUDDHA.referenceGroup.visible = opacity > 0.004;
  for (const material of BUDDHA.referenceMaterials) {
    const base = material.userData.referenceBaseOpacity ?? 1;
    let painted = 1;
    if (material.userData.referencePaintY !== undefined) {
      const y = material.userData.referencePaintY;
      const front = BUDDHA.referencePaintFront;
      painted = smoothstep(front - 0.055, front + 0.055, y);
    }
    material.opacity = base * opacity * painted;
    material.transparent = material.opacity < 0.999;
    material.depthWrite = material.opacity > 0.92;
  }
  const solidShadow = opacity > 0.98;
  for (const mesh of BUDDHA.referenceMeshes) mesh.castShadow = solidShadow;
}

function setImportedBuddhaPaintProgress(value) {
  const progress = clamp(Number(value) || 0, 0, 1);
  const front = lerp(1.08, -1.08, easeInOut(progress));
  BUDDHA.referencePaintProgress = progress;
  BUDDHA.referencePaintFront = front;
  for (const material of BUDDHA.referenceMaterials) {
    const uniforms = material.userData.referencePaintUniforms;
    if (uniforms) uniforms.uReferencePaintFront.value = front;
  }
}
