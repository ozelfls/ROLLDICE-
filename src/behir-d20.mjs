import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { beveledSurface } from './die-surface.mjs';
import { numeralShapes } from './scuffed-d20.mjs';

const palette = {
  smoky: new THREE.Color('rgb(30, 69, 145)'),
  darker: new THREE.Color('rgb(19, 47, 108)'),
  deep: new THREE.Color('rgb(11, 28, 72)'),
  frost: new THREE.Color('rgb(88, 128, 198)'),
  cyan: new THREE.Color('rgb(0, 194, 255)'),
  deeperCyan: new THREE.Color('rgb(0, 136, 217)'),
  dimCyan: new THREE.Color('rgb(0, 92, 168)'),
  glow: new THREE.Color('rgb(90, 232, 255)'),
  crack: new THREE.Color('rgb(45, 64, 104)'),
  crackGlow: new THREE.Color('rgb(0, 172, 234)'),
};

export function behirD20Surface(shape) {
  if (shape.faces.length !== 20) throw new RangeError('A resina Behir Blue requer um D20.');
  const geometry = beveledSurface(shape, .07);
  geometry.clearGroups();
  return geometry;
}

export function behirD20Material(dimmed = false) {
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: .38,
    transmission: .78,
    thickness: .82,
    attenuationDistance: 2.8,
    attenuationColor: 0x1e4591,
    ior: 1.44,
    specularIntensity: .78,
    specularColor: 0xa6ccff,
    clearcoat: .14,
    clearcoatRoughness: .34,
    envMapIntensity: .55,
    side: THREE.FrontSide,
    depthTest: true,
    depthWrite: true,
  });
  material.onBeforeCompile = (shader) => {
    for (const [name, value] of Object.entries(palette)) shader.uniforms[`behir_${name}`] = { value };
    const colorUniforms = Object.keys(palette).map((name) => `uniform vec3 behir_${name};`).join('\n');
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBehirPosition;\nvarying float vBehirHeight;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBehirPosition = position;\nvBehirHeight = (modelViewMatrix * vec4(position, 1.0)).y - (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).y;\nvBehirHeight /= length(modelMatrix[0].xyz);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vBehirPosition;\nvarying float vBehirHeight;\n${colorUniforms}
      float behirHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float behirNoise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(behirHash(i), behirHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(behirHash(i + vec3(0.0, 1.0, 0.0)), behirHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y), mix(mix(behirHash(i + vec3(0.0, 0.0, 1.0)), behirHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(behirHash(i + vec3(0.0, 1.0, 1.0)), behirHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
      }
      float behirCloud(vec3 p) { return behirNoise(p * 4.2) * 0.65 + behirNoise(p * 11.3) * 0.35; }
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float behirLower = 1.0 - smoothstep(-0.78, 0.22, vBehirHeight);
      float behirGlow = 1.0 - smoothstep(-0.78, -0.12, vBehirHeight);
      float behirUpper = smoothstep(-0.12, 0.7, vBehirHeight);
      float behirMist = behirCloud(vBehirPosition);
      vec3 behirUpperColor = mix(behir_darker, behir_smoky, 0.42 + behirMist * 0.36);
      behirUpperColor = mix(behirUpperColor, behir_frost, behirUpper * behirMist * 0.23);
      vec3 behirLowerColor = mix(behir_dimCyan, behir_deeperCyan, 0.38 + behirMist * 0.4);
      behirLowerColor = mix(behirLowerColor, behir_cyan, behirGlow * (0.42 + behirMist * 0.25));
      diffuseColor.rgb = mix(behirUpperColor, behirLowerColor, behirLower * 0.83);
      diffuseColor.rgb = mix(diffuseColor.rgb, behir_deep, behirUpper * (1.0 - behirMist) * 0.23);
      float behirVeinPath = abs(vBehirPosition.x * 0.82 + vBehirPosition.z * 0.37 + sin(vBehirPosition.y * 10.7 + vBehirPosition.z * 5.3) * 0.12 + (behirNoise(vBehirPosition * 10.0) - 0.5) * 0.08);
      float behirVeinGate = smoothstep(0.43, 0.62, behirNoise(vBehirPosition * 3.1 + vec3(1.7, 5.3, 2.1)));
      float behirVein = (1.0 - smoothstep(0.007, 0.019, behirVeinPath)) * behirVeinGate * 0.55;
      float behirBranchPath = abs(vBehirPosition.z * 0.64 - vBehirPosition.x * 0.29 + sin(vBehirPosition.y * 14.3 + vBehirPosition.x * 8.1) * 0.09 - 0.21);
      behirVein += (1.0 - smoothstep(0.005, 0.014, behirBranchPath)) * smoothstep(0.57, 0.8, behirMist) * 0.24;
      diffuseColor.rgb = mix(diffuseColor.rgb, mix(behir_crack, behir_crackGlow, behirGlow), behirVein);
      ${dimmed ? 'diffuseColor.rgb = mix(diffuseColor.rgb, behir_deep, 0.5);' : ''}
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(mix(0.25, 0.61, behirUpper) + (behirMist - 0.5) * 0.17 + (behirHash(floor(vBehirPosition * 100.0)) - 0.5) * 0.025, 0.2, 0.68);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += mix(behir_cyan, behir_glow, behirMist * 0.35) * behirGlow * (0.4 + behirMist * 0.28) * ${dimmed ? '0.25' : '1.0'};
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <transmission_fragment>', THREE.ShaderChunk.transmission_fragment.replace('material.transmission = transmission;', 'material.transmission = transmission * mix(0.24, 0.94, behirLower);'));
  };
  material.customProgramCacheKey = () => dimmed ? 'behir-d20-dim' : 'behir-d20';
  return material;
}

export function behirD20Core() {
  const geometry = new THREE.IcosahedronGeometry(.76, 2);
  return geometry;
}

export function behirD20CoreMaterial(dimmed = false) {
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.FrontSide, depthTest: true, depthWrite: true });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.behirCoreDark = { value: new THREE.Color('rgb(4, 10, 24)') };
    shader.uniforms.behirCoreMiddle = { value: new THREE.Color('rgb(9, 20, 46)') };
    shader.uniforms.behirCoreCyan = { value: palette.cyan };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vBehirCoreHeight;\nvarying vec3 vBehirCorePosition;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBehirCorePosition = position;\nvBehirCoreHeight = (modelViewMatrix * vec4(position, 1.0)).y - (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).y;\nvBehirCoreHeight /= length(modelMatrix[0].xyz);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vBehirCoreHeight;\nvarying vec3 vBehirCorePosition;\nuniform vec3 behirCoreDark;\nuniform vec3 behirCoreMiddle;\nuniform vec3 behirCoreCyan;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float coreLower = 1.0 - smoothstep(-0.65, 0.1, vBehirCoreHeight);
      float coreMist = 0.5 + 0.5 * sin(vBehirCorePosition.x * 9.0 + sin(vBehirCorePosition.z * 11.0) + vBehirCorePosition.y * 7.0);
      diffuseColor.rgb = mix(behirCoreDark, behirCoreMiddle, 0.45 + coreMist * 0.35);
      diffuseColor.rgb = mix(diffuseColor.rgb, behirCoreCyan, coreLower * (0.46 + coreMist * 0.3));
      ${dimmed ? 'diffuseColor.rgb = mix(diffuseColor.rgb, behirCoreDark, 0.55);' : ''}
    `);
  };
  material.customProgramCacheKey = () => dimmed ? 'behir-core-dim' : 'behir-core';
  return material;
}

export function behirD20Numbers(shape, font) {
  const grooves = [];
  const paint = [];
  const ranges = [];
  let grooveStart = 0;
  let paintStart = 0;
  for (const face of shape.faces) {
    const points = face.vertices.map((index) => new THREE.Vector3(...shape.vertices[index]));
    const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / 3);
    const right = points[1].clone().sub(points[0]).normalize();
    const normal = new THREE.Vector3().crossVectors(points[1].clone().sub(points[0]), points[2].clone().sub(points[0])).normalize();
    const up = new THREE.Vector3().crossVectors(normal, right).normalize();
    const edgeLength = points[0].distanceTo(points[1]);
    const shapes = numeralShapes(font, face.label);
    if (!shapes.length) throw new Error(`Contorno Cinzel ausente: ${face.label}`);
    const bounds = new THREE.ShapeGeometry(shapes, 5);
    bounds.computeBoundingBox();
    const box = bounds.boundingBox;
    const width = box.max.x - box.min.x;
    const height = box.max.y - box.min.y;
    bounds.dispose();
    const fit = Math.min(edgeLength * .42 / width, edgeLength * .3 / height);
    const groove = new THREE.ExtrudeGeometry(shapes, {
      depth: edgeLength * .0014 / fit,
      bevelEnabled: true,
      bevelThickness: edgeLength * .0006 / fit,
      bevelSize: edgeLength * .0008 / fit,
      bevelSegments: 2,
      curveSegments: 5,
      steps: 1,
    });
    groove.translate(-(box.max.x + box.min.x) / 2, -(box.max.y + box.min.y) / 2, 0);
    groove.scale(fit * 1.1, fit * 1.1, fit);
    const paintShape = new THREE.ShapeGeometry(shapes, 5);
    const filling = paintShape.toNonIndexed();
    paintShape.dispose();
    filling.translate(-(box.max.x + box.min.x) / 2, -(box.max.y + box.min.y) / 2, 0);
    const paintColors = [];
    const paintVertices = filling.getAttribute('position');
    const pale = new THREE.Color('rgb(244, 244, 246)');
    const shaded = new THREE.Color('rgb(170, 175, 188)');
    for (let index = 0; index < paintVertices.count; index++) {
      const upper = THREE.MathUtils.clamp(.5 + paintVertices.getY(index) / height, 0, 1);
      const color = shaded.clone().lerp(pale, .55 + upper * .45);
      paintColors.push(color.r, color.g, color.b);
    }
    filling.setAttribute('color', new THREE.Float32BufferAttribute(paintColors, 3));
    filling.scale(fit * .96, fit * .96, fit);
    const grooveTransform = new THREE.Matrix4().makeBasis(right, up, normal).setPosition(center.clone().addScaledVector(normal, edgeLength * .0007));
    const paintTransform = new THREE.Matrix4().makeBasis(right, up, normal).setPosition(center.clone().addScaledVector(normal, edgeLength * .0038));
    groove.applyMatrix4(grooveTransform);
    filling.applyMatrix4(paintTransform);
    const grooveCount = groove.getAttribute('position').count;
    const paintCount = filling.getAttribute('position').count;
    ranges.push({ label: face.label, grooveStart, grooveCount, paintStart, paintCount });
    grooveStart += grooveCount;
    paintStart += paintCount;
    grooves.push(groove);
    paint.push(filling);
  }
  const grooveGeometry = mergeGeometries(grooves);
  const paintGeometry = mergeGeometries(paint);
  grooves.forEach((geometry) => geometry.dispose());
  paint.forEach((geometry) => geometry.dispose());
  if (!grooveGeometry || !paintGeometry) throw new Error('Não foi possível unir a gravação Behir Blue.');
  grooveGeometry.clearGroups();
  paintGeometry.clearGroups();
  grooveGeometry.userData.faceRanges = ranges;
  paintGeometry.userData.faceRanges = ranges;
  return { grooveGeometry, paintGeometry };
}

export function behirD20NumberMaterials() {
  return {
    groove: new THREE.MeshPhysicalMaterial({ color: 0x344260, metalness: 0, roughness: .69, transparent: true, opacity: 1, depthTest: true, depthWrite: true, side: THREE.FrontSide }),
    paint: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, metalness: 0, roughness: .75, specularColor: 0xaaafbc, specularIntensity: .21, transparent: true, opacity: 1, depthTest: true, depthWrite: true, side: THREE.FrontSide }),
  };
}
