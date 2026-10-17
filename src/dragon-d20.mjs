import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { beveledSurface } from './die-surface.mjs';
import { numeralShapes } from './scuffed-d20.mjs';

const ruby = {
  main: new THREE.Color('rgb(123, 7, 18)'),
  wine: new THREE.Color('rgb(92, 4, 14)'),
  core: new THREE.Color('rgb(62, 3, 10)'),
  black: new THREE.Color('rgb(28, 3, 6)'),
  hot: new THREE.Color('rgb(173, 11, 18)'),
  ember: new THREE.Color('rgb(212, 20, 22)'),
  crimson: new THREE.Color('rgb(238, 48, 36)'),
  orange: new THREE.Color('rgb(255, 96, 44)'),
  edge: new THREE.Color('rgb(180, 22, 24)'),
  edgeBright: new THREE.Color('rgb(255, 76, 54)'),
  marble: new THREE.Color('rgb(68, 10, 14)'),
  marbleShadow: new THREE.Color('rgb(42, 5, 9)'),
  shard: new THREE.Color('rgb(255, 64, 54)'),
};

const field = `
  float rubyHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float rubyNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(rubyHash(i), rubyHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(rubyHash(i + vec3(0.0, 1.0, 0.0)), rubyHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y), mix(mix(rubyHash(i + vec3(0.0, 0.0, 1.0)), rubyHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(rubyHash(i + vec3(0.0, 1.0, 1.0)), rubyHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
  }
  vec3 rubyWarp(vec3 p) {
    return p + vec3(rubyNoise(p * 3.7), rubyNoise(p * 4.1 + 13.7), rubyNoise(p * 3.3 - 8.2)) * 0.28;
  }
  float rubyMarble(vec3 p) {
    vec3 q = rubyWarp(p);
    return 0.5 + 0.5 * sin(q.x * 12.2 + q.y * 8.7 + q.z * 5.4 + rubyNoise(q * 8.4) * 5.1);
  }
  float rubyShard(vec3 p) {
    vec3 q = rubyWarp(p) * 6.8;
    vec3 f = abs(fract(q) - 0.5);
    float seam = 1.0 - smoothstep(0.012, 0.065, min(f.x, min(f.y, f.z)));
    return seam * smoothstep(0.52, 0.75, rubyNoise(floor(q) * 0.8));
  }
`;

export function dragonD20Surface(shape) {
  if (shape.faces.length !== 20) throw new RangeError('A resina Dragonflame requer um D20.');
  const geometry = beveledSurface(shape, .07);
  geometry.clearGroups();
  return geometry;
}

export function dragonD20Material(dimmed = false) {
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: .2,
    transmission: .62,
    thickness: 1.08,
    attenuationDistance: 1.7,
    attenuationColor: ruby.core,
    ior: 1.48,
    specularIntensity: .75,
    specularColor: ruby.edgeBright,
    clearcoat: .31,
    clearcoatRoughness: .16,
    envMapIntensity: .45,
    side: THREE.FrontSide,
    depthTest: true,
    depthWrite: true,
  });
  material.onBeforeCompile = (shader) => {
    for (const [name, value] of Object.entries(ruby)) shader.uniforms[`ruby_${name}`] = { value };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRubyPosition;\nvarying vec3 vRubyNormal;\nvarying float vRubyHeight;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRubyPosition = position;\nvRubyNormal = normal;\nvRubyHeight = (modelViewMatrix * vec4(position, 1.0)).y - (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).y;\nvRubyHeight /= length(modelMatrix[0].xyz);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vRubyPosition;\nvarying vec3 vRubyNormal;\nvarying float vRubyHeight;\n${Object.keys(ruby).map((name) => `uniform vec3 ruby_${name};`).join('\n')}\n${field}`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float rubyCloud = rubyNoise(rubyWarp(vRubyPosition) * 5.3);
      float rubyVein = rubyMarble(vRubyPosition);
      float rubyFragment = rubyShard(vRubyPosition);
      float rubyInnerDark = smoothstep(0.35, 0.68, 1.0 - rubyVein) * (0.38 + rubyCloud * 0.4);
      float rubyInnerEmber = smoothstep(0.7, 0.86, rubyCloud * 0.52 + rubyVein * 0.48);
      float rubyLower = 1.0 - smoothstep(-0.85, 0.4, vRubyHeight);
      float rubyEdge = 1.0 - max(0.0, dot(normalize(vRubyNormal), normalize(-vViewPosition)));
      float rubyFire = smoothstep(0.68, 0.88, rubyCloud * 0.5 + rubyVein * 0.5) * (0.12 + rubyLower * 0.88);
      float rubyFissure = 1.0 - smoothstep(0.09, 0.23, abs(rubyVein - 0.48));
      diffuseColor.rgb = mix(ruby_core, ruby_wine, 0.29 + rubyCloud * 0.32);
      diffuseColor.rgb = mix(diffuseColor.rgb, ruby_main, rubyVein * 0.24);
      diffuseColor.rgb = mix(diffuseColor.rgb, ruby_marbleShadow, rubyInnerDark * 0.68);
      diffuseColor.rgb = mix(diffuseColor.rgb, ruby_black, rubyInnerDark * (1.0 - rubyVein) * 0.18);
      diffuseColor.rgb = mix(diffuseColor.rgb, ruby_marble, rubyFissure * 0.31);
      diffuseColor.rgb = mix(diffuseColor.rgb, ruby_hot, rubyFire * 0.38);
      diffuseColor.rgb = mix(diffuseColor.rgb, ruby_ember, rubyInnerEmber * rubyLower * 0.28);
      diffuseColor.rgb = mix(diffuseColor.rgb, ruby_edge, rubyEdge * 0.28);
      diffuseColor.rgb = mix(diffuseColor.rgb, ruby_edgeBright, rubyEdge * rubyLower * 0.11);
      diffuseColor.rgb = mix(diffuseColor.rgb, ruby_shard, rubyFragment * rubyLower * 0.15);
      ${dimmed ? 'diffuseColor.rgb = mix(diffuseColor.rgb, ruby_black, 0.42);' : ''}
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(0.18 + rubyCloud * 0.065 + (1.0 - rubyVein) * 0.035 - rubyEdge * 0.03, 0.14, 0.28);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += mix(ruby_hot, ruby_crimson, rubyVein) * (rubyFire + rubyInnerEmber * 0.38) * ${dimmed ? '0.02' : '0.075'};
      totalEmissiveRadiance += ruby_orange * rubyFragment * rubyLower * ${dimmed ? '0.008' : '0.035'};
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <transmission_fragment>', THREE.ShaderChunk.transmission_fragment.replace('material.transmission = transmission;', 'material.transmission = transmission * clamp(0.28 + rubyLower * 0.32 + rubyEdge * 0.28 + rubyCloud * 0.08, 0.26, 0.88);'));
  };
  material.customProgramCacheKey = () => dimmed ? 'dragon-ruby-dim' : 'dragon-ruby';
  return material;
}

export function dragonD20Core() {
  return new THREE.IcosahedronGeometry(.76, 3);
}

export function dragonD20CoreMaterial(dimmed = false) {
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.FrontSide, depthTest: true, depthWrite: true });
  material.onBeforeCompile = (shader) => {
    for (const name of ['black', 'core', 'hot', 'ember', 'crimson', 'orange', 'marble', 'marbleShadow', 'shard']) shader.uniforms[`ruby_${name}`] = { value: ruby[name] };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRubyCore;\nvarying float vRubyCoreHeight;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRubyCore = position;\nvRubyCoreHeight = (modelViewMatrix * vec4(position, 1.0)).y - (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).y;\nvRubyCoreHeight /= length(modelMatrix[0].xyz);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vRubyCore;\nvarying float vRubyCoreHeight;\n${['black', 'core', 'hot', 'ember', 'crimson', 'orange', 'marble', 'marbleShadow', 'shard'].map((name) => `uniform vec3 ruby_${name};`).join('\n')}\n${field}`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float rubyDepth = rubyNoise(rubyWarp(vRubyCore) * 5.9);
      float rubyBand = rubyMarble(vRubyCore * 1.28);
      float rubyFlake = rubyShard(vRubyCore * 0.9);
      float rubyLower = 1.0 - smoothstep(-0.75, 0.48, vRubyCoreHeight);
      float rubyPocket = smoothstep(0.55, 0.83, rubyDepth * 0.48 + rubyBand * 0.52);
      diffuseColor.rgb = mix(ruby_marbleShadow, ruby_core, rubyDepth * 0.58);
      diffuseColor.rgb = mix(diffuseColor.rgb, ruby_black, (1.0 - rubyBand) * 0.56);
      diffuseColor.rgb = mix(diffuseColor.rgb, ruby_hot, rubyBand * (0.2 + rubyLower * 0.2));
      diffuseColor.rgb = mix(diffuseColor.rgb, ruby_ember, rubyPocket * (0.13 + rubyLower * 0.32));
      diffuseColor.rgb = mix(diffuseColor.rgb, ruby_crimson, rubyPocket * rubyLower * 0.16);
      diffuseColor.rgb = mix(diffuseColor.rgb, ruby_shard, rubyFlake * (0.08 + rubyLower * 0.18));
      diffuseColor.rgb = mix(diffuseColor.rgb, ruby_orange, rubyFlake * rubyPocket * rubyLower * 0.09);
      ${dimmed ? 'diffuseColor.rgb = mix(diffuseColor.rgb, ruby_black, 0.5);' : ''}
    `);
  };
  material.customProgramCacheKey = () => dimmed ? 'dragon-core-dim' : 'dragon-core';
  return material;
}

export function dragonD20Numbers(shape, font) {
  const grooves = [];
  const gold = [];
  const ranges = [];
  let grooveStart = 0;
  let goldStart = 0;
  const base = new THREE.Color('rgb(224, 170, 70)');
  const highlight = new THREE.Color('rgb(255, 215, 112)');
  const shadow = new THREE.Color('rgb(156, 108, 33)');
  for (const face of shape.faces) {
    const points = face.vertices.map((index) => new THREE.Vector3(...shape.vertices[index]));
    const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / 3);
    const right = points[1].clone().sub(points[0]).normalize();
    const normal = new THREE.Vector3().crossVectors(points[1].clone().sub(points[0]), points[2].clone().sub(points[0])).normalize();
    const up = new THREE.Vector3().crossVectors(normal, right).normalize();
    const edge = points[0].distanceTo(points[1]);
    const shapes = numeralShapes(font, face.label);
    if (!shapes.length) throw new Error(`Contorno Cinzel ausente: ${face.label}`);
    const bounds = new THREE.ShapeGeometry(shapes, 5);
    bounds.computeBoundingBox();
    const box = bounds.boundingBox;
    const width = box.max.x - box.min.x;
    const height = box.max.y - box.min.y;
    bounds.dispose();
    const fit = Math.min(edge * .42 / width, edge * .3 / height);
    const groove = new THREE.ExtrudeGeometry(shapes, { depth: edge * .002 / fit, bevelEnabled: true, bevelThickness: edge * .0007 / fit, bevelSize: edge * .001 / fit, bevelSegments: 2, curveSegments: 6, steps: 1 });
    groove.translate(-(box.max.x + box.min.x) / 2, -(box.max.y + box.min.y) / 2, 0);
    groove.scale(fit * 1.13, fit * 1.13, fit);
    const fillGeometry = new THREE.ExtrudeGeometry(shapes, { depth: edge * .0009 / fit, bevelEnabled: true, bevelThickness: edge * .0004 / fit, bevelSize: edge * .00045 / fit, bevelSegments: 2, curveSegments: 6, steps: 1 });
    fillGeometry.translate(-(box.max.x + box.min.x) / 2, -(box.max.y + box.min.y) / 2, 0);
    fillGeometry.scale(fit * .97, fit * .97, fit);
    const filled = fillGeometry.index ? fillGeometry.toNonIndexed() : fillGeometry;
    if (filled !== fillGeometry) fillGeometry.dispose();
    const colors = [];
    const vertices = filled.getAttribute('position');
    for (let index = 0; index < vertices.count; index++) {
      const upper = THREE.MathUtils.clamp(.5 + vertices.getY(index) / height, 0, 1);
      const color = shadow.clone().lerp(base, .55 + upper * .35).lerp(highlight, upper * .18);
      colors.push(color.r, color.g, color.b);
    }
    filled.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    groove.applyMatrix4(new THREE.Matrix4().makeBasis(right, up, normal).setPosition(center.clone().addScaledVector(normal, edge * .0005)));
    filled.applyMatrix4(new THREE.Matrix4().makeBasis(right, up, normal).setPosition(center.clone().addScaledVector(normal, edge * .0038)));
    const grooveCount = groove.getAttribute('position').count;
    const goldCount = filled.getAttribute('position').count;
    ranges.push({ label: face.label, grooveStart, grooveCount, goldStart, goldCount });
    grooveStart += grooveCount;
    goldStart += goldCount;
    grooves.push(groove);
    gold.push(filled);
  }
  const grooveGeometry = mergeGeometries(grooves);
  const goldGeometry = mergeGeometries(gold);
  grooves.forEach((geometry) => geometry.dispose());
  gold.forEach((geometry) => geometry.dispose());
  if (!grooveGeometry || !goldGeometry) throw new Error('Não foi possível unir a gravação Dragonflame.');
  grooveGeometry.clearGroups();
  goldGeometry.clearGroups();
  grooveGeometry.userData.faceRanges = ranges;
  goldGeometry.userData.faceRanges = ranges;
  return { grooveGeometry, goldGeometry };
}

export function dragonD20NumberMaterials() {
  return {
    groove: new THREE.MeshPhysicalMaterial({ color: 0x6e4812, metalness: .4, roughness: .5, transparent: true, opacity: 1, depthTest: true, depthWrite: true, side: THREE.FrontSide }),
    gold: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, metalness: .7, roughness: .34, specularColor: 0xffd770, specularIntensity: .75, transparent: true, opacity: 1, depthTest: true, depthWrite: true, side: THREE.FrontSide }),
  };
}
