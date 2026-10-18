import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { beveledSurface } from './die-surface.mjs';
import { parse as parseOpenType } from 'three/addons/libs/opentype.module.js';
import { numeralShapes } from './scuffed-d20.mjs';

const gold = {
  shell: new THREE.Color('rgb(239, 175, 28)'),
  bright: new THREE.Color('rgb(255, 207, 43)'),
  deep: new THREE.Color('rgb(151, 91, 9)'),
  inner: new THREE.Color('rgb(99, 62, 10)'),
  shadow: new THREE.Color('rgb(58, 35, 5)'),
  transmitted: new THREE.Color('rgb(255, 225, 105)'),
  reflection: new THREE.Color('rgb(255, 247, 195)'),
  filament: new THREE.Color('rgb(255, 253, 232)'),
  discharge: new THREE.Color('rgb(255, 243, 160)'),
  secondary: new THREE.Color('rgb(255, 212, 59)'),
  halo: new THREE.Color('rgb(255, 173, 28)'),
  node: new THREE.Color('rgb(255, 249, 204)'),
  coreMid: new THREE.Color('rgb(255, 185, 35)'),
  coreBright: new THREE.Color('rgb(255, 238, 145)'),
};

const corePosition = new THREE.Vector3(.065, -.045, .015);
let fontPromise;

export function loadLightningFont() {
  if (!fontPromise) {
    const loader = new THREE.FileLoader();
    loader.setResponseType('arraybuffer');
    const files = ['Rajdhani-Bold.ttf', 'Oxanium-Bold.ttf', 'Exo2-ExtraBold.ttf'];
    const load = async (index) => {
      try {
        return parseOpenType(await loader.loadAsync(new URL(`../assets/fonts/${files[index]}`, document.baseURI).href));
      } catch (error) {
        if (index === files.length - 1) throw error;
        return load(index + 1);
      }
    };
    fontPromise = load(0);
  }
  return fontPromise;
}

export function lightningD20Planes(shape) {
  return shape.faces.map((face) => {
    const [a, b, c] = face.vertices.map((index) => new THREE.Vector3(...shape.vertices[index]));
    const normal = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
    if (normal.dot(a) < 0) normal.negate();
    return new THREE.Vector4(normal.x, normal.y, normal.z, normal.dot(a));
  });
}

const noise = `
  float stormHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float stormNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(stormHash(i), stormHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(stormHash(i + vec3(0.0, 1.0, 0.0)), stormHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y), mix(mix(stormHash(i + vec3(0.0, 0.0, 1.0)), stormHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(stormHash(i + vec3(0.0, 1.0, 1.0)), stormHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
  }
  float stormCloud(vec3 p) { return stormNoise(p * 3.7) * 0.62 + stormNoise(p * 8.1 + 7.4) * 0.38; }
`;

export function lightningD20Surface(shape) {
  if (shape.faces.length !== 20) throw new RangeError('Lightning Storm requer um D20.');
  const geometry = beveledSurface(shape, .07);
  geometry.clearGroups();
  return geometry;
}

export function lightningD20Pulse() {
  return { time: { value: 0 }, rolling: { value: 0 }, surge: { value: 0 } };
}

export function lightningD20Material(shape, pulse = lightningD20Pulse(), dimmed = false) {
  const planes = lightningD20Planes(shape);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: .12,
    transmission: .45,
    thickness: 1,
    attenuationDistance: .38,
    attenuationColor: gold.shadow,
    ior: 1.49,
    specularIntensity: .8,
    specularColor: gold.reflection,
    clearcoat: .65,
    clearcoatRoughness: .09,
    envMapIntensity: .4,
    side: THREE.FrontSide,
    depthTest: true,
    depthWrite: true,
  });
  material.onBeforeCompile = (shader) => {
    for (const [name, value] of Object.entries(gold)) shader.uniforms[`storm_${name}`] = { value };
    shader.uniforms.stormHull = { value: planes };
    shader.uniforms.stormCore = { value: corePosition };
    shader.uniforms.stormField = { value: lightningD20Volume() };
    shader.uniforms.stormTime = pulse.time;
    shader.uniforms.stormRolling = pulse.rolling;
    shader.uniforms.stormSurge = pulse.surge;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vStormPosition;\nvarying vec3 vStormNormal;\nvarying vec3 vStormEye;\nvarying float vStormScale;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvStormPosition = position;\nvStormNormal = normal;\nvStormScale = length(modelMatrix[0].xyz);\nfloat stormScaleSquared = vStormScale * vStormScale;\nvStormEye = transpose(mat3(modelMatrix)) * (cameraPosition - modelMatrix[3].xyz) / stormScaleSquared;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vStormPosition;\nvarying vec3 vStormNormal;\nvarying vec3 vStormEye;\nvarying float vStormScale;\nuniform vec4 stormHull[20];\nuniform sampler3D stormField;\nuniform vec3 stormCore;\nuniform float stormTime;\nuniform float stormRolling;\nuniform float stormSurge;\n${Object.keys(gold).map((name) => `uniform vec3 storm_${name};`).join('\n')}\n${noise}`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      vec3 stormRay = normalize(vStormPosition - vStormEye);
      float stormPath = 3.0;
      for (int face = 0; face < 20; face++) {
        float denominator = dot(stormHull[face].xyz, stormRay);
        if (denominator > 0.0001) {
          float distanceToExit = (stormHull[face].w - dot(stormHull[face].xyz, vStormPosition)) / denominator;
          if (distanceToExit > 0.0001) stormPath = min(stormPath, distanceToExit);
        }
      }
      stormPath = clamp(stormPath, 0.03, 2.0);
      float stormDepth = smoothstep(0.3, 1.55, stormPath);
      float stormCloudiness = stormCloud(vStormPosition + stormRay * stormPath * 0.37);
      float stormEdge = pow(1.0 - max(0.0, dot(normalize(vStormNormal), normalize(vStormEye - vStormPosition))), 1.8);
      float stormCoreField = 0.0;
      for (int sampleIndex = 0; sampleIndex < 5; sampleIndex++) {
        vec3 samplePoint = vStormPosition + stormRay * stormPath * (float(sampleIndex) + 0.5) / 5.0;
        vec3 delta = samplePoint - stormCore;
        stormCoreField = max(stormCoreField, exp(-dot(delta, delta) * 22.0));
      }
      float stormNode = stormCoreField * (0.88 + 0.08 * sin(stormTime * 2.617));
      vec3 stormEmission = vec3(0.0);
      for (int rayStep = 0; rayStep < 40; rayStep++) {
        float fraction = (float(rayStep) + 0.5) / 40.0;
        vec3 interior = vStormPosition + stormRay * stormPath * fraction;
        vec4 charge = texture(stormField, interior * 0.5 + 0.5);
        float phase = charge.a * 6.2831853;
        float idle = 0.975 + 0.08 * sin(stormTime * 2.6179939 + phase) + 0.045 * sin(stormTime * 4.8332195 + phase * 1.71);
        float traveling = 1.0 + stormRolling * 0.12 * pow(max(0.0, sin(fraction * 24.0 - stormTime * 9.0 + phase)), 6.0);
        float intensity = clamp(idle * (1.0 + stormRolling * 0.15) * traveling * (1.0 + stormSurge * 0.2), 0.82, 1.5);
        float absorption = exp(-stormPath * fraction * (1.35 + stormCloud(interior) * 0.9));
        vec3 filament = mix(storm_filament, storm_secondary, fraction * 0.62);
        vec3 energy = filament * pow(charge.r, 1.4) * 8.0 + storm_discharge * pow(charge.g, 2.0) * 0.42 + storm_halo * charge.b * 0.02;
        stormEmission += energy * intensity * absorption * stormPath / 40.0;
      }
      diffuseColor.rgb = mix(storm_shell, storm_deep, stormDepth * 0.95);
      diffuseColor.rgb = mix(diffuseColor.rgb, storm_inner, stormDepth * (1.0 - stormCloudiness) * 0.52);
      diffuseColor.rgb = mix(diffuseColor.rgb, storm_shadow, stormDepth * (1.0 - stormCloudiness) * 0.21);
      diffuseColor.rgb = mix(diffuseColor.rgb, storm_transmitted, (1.0 - stormDepth) * 0.38 + stormEdge * 0.22);
      diffuseColor.rgb = mix(diffuseColor.rgb, storm_bright, stormEdge * 0.12);
      diffuseColor.rgb = mix(diffuseColor.rgb, storm_coreMid, stormNode * 0.35);
      diffuseColor.rgb = mix(diffuseColor.rgb, storm_coreBright, stormNode * 0.23);
      ${dimmed ? 'diffuseColor.rgb = mix(diffuseColor.rgb, storm_inner, 0.43);' : ''}
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(0.12 + (stormCloudiness - 0.5) * 0.025 - stormEdge * 0.018, 0.085, 0.15);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += mix(storm_coreMid, storm_node, stormNode * 0.28) * stormNode * ${dimmed ? '0.018' : '0.085'} * (1.0 + stormSurge * 0.16);
      totalEmissiveRadiance += stormEmission * ${dimmed ? '0.17' : '0.58'};
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <transmission_fragment>', THREE.ShaderChunk.transmission_fragment.replace('material.thickness = thickness;', 'material.thickness = stormPath * vStormScale;'));
  };
  material.customProgramCacheKey = () => dimmed ? 'lightning-shell-dim' : 'lightning-shell';
  return material;
}

function createGraph() {
  let seed = 29731;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const direction = () => {
    const azimuth = random() * Math.PI * 2;
    const elevation = (random() - .5) * 1.7;
    return new THREE.Vector3(Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.sin(azimuth) * Math.cos(elevation)).normalize();
  };
  const bound = (point) => point.length() > .7 ? point.setLength(.7) : point;
  const channels = [];
  for (let trunk = 0; trunk < 4; trunk++) {
    const heading = direction();
    const side = new THREE.Vector3().crossVectors(heading, Math.abs(heading.y) > .8 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
    const points = [corePosition.clone()];
    for (let index = 1; index <= 8; index++) {
      const t = index / 8;
      const jitter = (random() - .5) * (.03 + t * .045);
      points.push(bound(corePosition.clone().addScaledVector(heading, t * .64).addScaledVector(side, jitter + Math.sin(t * 7 + trunk) * .025)));
    }
    channels.push({ tier: 0, points, phase: random() * Math.PI * 2 });
    for (const pivot of [2, 3, 5, 6]) {
      const origin = points[pivot];
      const branchDirection = direction().addScaledVector(heading, .28).normalize();
      const branchPoints = [origin.clone()];
      for (let index = 1; index <= 3; index++) {
        const point = origin.clone().addScaledVector(branchDirection, index / 3 * (.19 + random() * .16)).addScaledVector(side, (random() - .5) * .035);
        branchPoints.push(bound(point));
      }
      channels.push({ tier: 1, points: branchPoints, phase: random() * Math.PI * 2 });
      for (const fork of [1, 2]) {
        const forkDirection = direction().addScaledVector(branchDirection, .22).normalize();
        const forkStart = branchPoints[fork];
        const length = .08 + random() * .085;
        const middle = bound(forkStart.clone().addScaledVector(forkDirection, length * .48).addScaledVector(side, (random() - .5) * .027));
        const end = bound(forkStart.clone().addScaledVector(forkDirection, length));
        channels.push({ tier: 2, points: [forkStart.clone(), middle, end], phase: random() * Math.PI * 2 });
      }
    }
  }
  return channels;
}

const graph = createGraph();
let volumeTexture;

export function lightningD20Graph() {
  return graph;
}

export function lightningD20Volume() {
  if (volumeTexture) return volumeTexture;
  const resolution = 96;
  const voxels = resolution ** 3;
  const field = new Float32Array(voxels * 4);
  const step = 2 / (resolution - 1);
  for (const channel of graph) {
    const curve = new THREE.CatmullRomCurve3(channel.points, false, 'centripetal');
    const samples = channel.tier === 0 ? 72 : channel.tier === 1 ? 24 : 12;
    const strength = [1, .65, .38][channel.tier];
    for (let sample = 0; sample <= samples; sample++) {
      const point = curve.getPoint(sample / samples);
      const ix = (point.x + 1) / step;
      const iy = (point.y + 1) / step;
      const iz = (point.z + 1) / step;
      const range = 4;
      for (let z = Math.max(0, Math.floor(iz - range)); z <= Math.min(resolution - 1, Math.ceil(iz + range)); z++) {
        for (let y = Math.max(0, Math.floor(iy - range)); y <= Math.min(resolution - 1, Math.ceil(iy + range)); y++) {
          for (let x = Math.max(0, Math.floor(ix - range)); x <= Math.min(resolution - 1, Math.ceil(ix + range)); x++) {
            const dx = (x - ix) * step;
            const dy = (y - iy) * step;
            const dz = (z - iz) * step;
            const distance2 = dx * dx + dy * dy + dz * dz;
            const core = Math.exp(-distance2 / (.025 ** 2)) * strength;
            const envelope = Math.exp(-distance2 / (.048 ** 2)) * strength;
            const halo = Math.exp(-distance2 / (.09 ** 2)) * strength;
            const offset = ((z * resolution + y) * resolution + x) * 4;
            if (core > field[offset]) field[offset] = core;
            if (envelope > field[offset + 1]) {
              field[offset + 1] = envelope;
              field[offset + 3] = .5 + Math.sin(channel.phase) * .48;
            }
            if (halo > field[offset + 2]) field[offset + 2] = halo;
          }
        }
      }
    }
  }
  const bytes = new Uint8Array(field.length);
  for (let index = 0; index < field.length; index++) bytes[index] = Math.round(Math.min(1, field[index]) * 255);
  volumeTexture = new THREE.Data3DTexture(bytes, resolution, resolution, resolution);
  volumeTexture.format = THREE.RGBAFormat;
  volumeTexture.type = THREE.UnsignedByteType;
  volumeTexture.minFilter = THREE.LinearFilter;
  volumeTexture.magFilter = THREE.LinearFilter;
  volumeTexture.wrapS = THREE.ClampToEdgeWrapping;
  volumeTexture.wrapT = THREE.ClampToEdgeWrapping;
  volumeTexture.wrapR = THREE.ClampToEdgeWrapping;
  volumeTexture.unpackAlignment = 1;
  volumeTexture.needsUpdate = true;
  return volumeTexture;
}

export function lightningD20Veins() {
  const radii = [.022, .011, .007];
  return radii.map((radius, layer) => {
    const pieces = graph.map((channel) => {
      const tierScale = [1, .54, .26][channel.tier];
      const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(channel.points, false, 'centripetal'), [26, 10, 6][channel.tier], radius * tierScale, layer === 2 ? 4 : 5, false);
      const count = geometry.getAttribute('position').count;
      geometry.setAttribute('stormPhase', new THREE.Float32BufferAttribute(new Float32Array(count).fill(channel.phase), 1));
      geometry.setAttribute('stormTier', new THREE.Float32BufferAttribute(new Float32Array(count).fill(channel.tier), 1));
      return geometry;
    });
    if (layer === 1) {
      for (const channel of graph.filter((entry) => entry.tier === 0)) {
        const sphere = new THREE.SphereGeometry(.017, 6, 5);
        sphere.translate(...channel.points[4].toArray());
        const count = sphere.getAttribute('position').count;
        sphere.setAttribute('stormPhase', new THREE.Float32BufferAttribute(new Float32Array(count).fill(channel.phase), 1));
        sphere.setAttribute('stormTier', new THREE.Float32BufferAttribute(new Float32Array(count).fill(3), 1));
        pieces.push(sphere);
      }
    }
    const merged = mergeGeometries(pieces);
    pieces.forEach((geometry) => geometry.dispose());
    if (!merged) throw new Error('Não foi possível unir os canais de relâmpago.');
    merged.clearGroups();
    return merged;
  });
}

export function lightningD20VeinMaterials(shape, pulse = lightningD20Pulse()) {
  const planes = lightningD20Planes(shape);
  return [0, 1, 2].map((layer) => {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: true,
      transparent: true,
      opacity: [.42, .95, 1][layer],
      depthTest: false,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.stormHull = { value: planes };
      shader.uniforms.stormTime = pulse.time;
      shader.uniforms.stormRolling = pulse.rolling;
      shader.uniforms.stormSurge = pulse.surge;
      shader.uniforms.stormMainColor = { value: [gold.halo, gold.discharge, gold.filament][layer] };
      shader.uniforms.stormSecondaryColor = { value: [gold.halo, gold.secondary, gold.discharge][layer] };
      shader.uniforms.stormTertiaryColor = { value: [gold.halo, gold.halo, gold.secondary][layer] };
      shader.uniforms.stormNodeColor = { value: gold.node };
      shader.uniforms.stormDepthColor = { value: gold.deep };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float stormPhase;\nattribute float stormTier;\nvarying vec3 vStormPoint;\nvarying vec3 vStormEye;\nvarying float vStormPhase;\nvarying float vStormTier;\nvarying float vStormAlong;');
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvStormPoint = position;\nfloat stormScaleSquared = dot(modelMatrix[0].xyz, modelMatrix[0].xyz);\nvStormEye = transpose(mat3(modelMatrix)) * (cameraPosition - modelMatrix[3].xyz) / stormScaleSquared;\nvStormPhase = stormPhase;\nvStormTier = stormTier;\nvStormAlong = uv.x;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vStormPoint;\nvarying vec3 vStormEye;\nvarying float vStormPhase;\nvarying float vStormTier;\nvarying float vStormAlong;\nuniform vec4 stormHull[20];\nuniform float stormTime;\nuniform float stormRolling;\nuniform float stormSurge;\nuniform vec3 stormMainColor;\nuniform vec3 stormSecondaryColor;\nuniform vec3 stormTertiaryColor;\nuniform vec3 stormNodeColor;\nuniform vec3 stormDepthColor;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        vec3 ray = vStormPoint - vStormEye;
        float entry = 0.0;
        float exit = 2.0;
        for (int face = 0; face < 20; face++) {
          float denominator = dot(stormHull[face].xyz, ray);
          if (denominator < -0.0001) entry = max(entry, (stormHull[face].w - dot(stormHull[face].xyz, vStormEye)) / denominator);
          if (denominator > 0.0001) exit = min(exit, (stormHull[face].w - dot(stormHull[face].xyz, vStormEye)) / denominator);
        }
        if (entry > 1.0 || exit < 1.0) discard;
        float opticalDepth = clamp((1.0 - entry) * length(ray), 0.0, 2.2);
        float visibility = exp(-opticalDepth * ${[.65, .85, 1.4][layer].toFixed(2)});
        vec3 energyColor = vStormTier > 2.5 ? stormNodeColor : vStormTier > 1.5 ? stormTertiaryColor : vStormTier > 0.5 ? stormSecondaryColor : stormMainColor;
        diffuseColor.rgb = mix(energyColor, stormDepthColor, (1.0 - visibility) * 0.73);
        float idle = 0.975 + 0.08 * sin(stormTime * 2.6179939 + vStormPhase) + 0.045 * sin(stormTime * 4.8332195 + vStormPhase * 1.71);
        float traveling = 1.0 + stormRolling * 0.12 * pow(max(0.0, sin(vStormAlong * 11.0 - stormTime * 9.0 + vStormPhase)), 6.0);
        diffuseColor.a *= visibility * clamp(idle * (1.0 + stormRolling * 0.15) * traveling * (1.0 + stormSurge * 0.2), 0.82, 1.5);
      `);
    };
    material.customProgramCacheKey = () => `lightning-vein-${layer}`;
    return material;
  });
}

export function lightningD20Numbers(shape, font) {
  const grooves = [];
  const paints = [];
  const grooveRanges = [];
  const paintRanges = [];
  let grooveStart = 0;
  let paintStart = 0;
  for (const face of shape.faces) {
    const [a, b, c] = face.vertices.map((index) => new THREE.Vector3(...shape.vertices[index]));
    const center = a.clone().add(b).add(c).divideScalar(3);
    const normal = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
    if (normal.dot(center) < 0) normal.negate();
    const right = b.clone().sub(a).normalize();
    const up = new THREE.Vector3().crossVectors(normal, right).normalize();
    const edge = a.distanceTo(b);
    const shapes = numeralShapes(font, String(face.label), false);
    if (!shapes.length) throw new Error(`Contorno Rajdhani ausente: ${face.label}`);
    const silhouette = new THREE.ShapeGeometry(shapes, 6);
    silhouette.computeBoundingBox();
    const box = new THREE.Box2(new THREE.Vector2(silhouette.boundingBox.min.x, silhouette.boundingBox.min.y), new THREE.Vector2(silhouette.boundingBox.max.x, silhouette.boundingBox.max.y));
    silhouette.dispose();
    const size = box.getSize(new THREE.Vector2());
    const fit = Math.min(edge * .48 / Math.max(size.x, .001), edge * .31 / Math.max(size.y, .001));
    const middle = box.getCenter(new THREE.Vector2());
    const matrixFor = (scale, depth) => new THREE.Matrix4().makeBasis(right.clone().multiplyScalar(scale), up.clone().multiplyScalar(scale), normal.clone().multiplyScalar(scale)).setPosition(center.clone().addScaledVector(normal, depth).addScaledVector(right, -middle.x * scale).addScaledVector(up, -middle.y * scale));
    const groove = new THREE.ExtrudeGeometry(shapes, { depth: edge * .005 / fit, bevelEnabled: true, bevelThickness: edge * .0008 / fit, bevelSize: edge * .0008 / fit, bevelSegments: 1, curveSegments: 6, steps: 1 });
    groove.applyMatrix4(matrixFor(fit * 1.09, edge * .0008));
    grooves.push(groove);
    grooveRanges.push({ label: face.label, start: grooveStart, count: groove.getAttribute('position').count });
    grooveStart += groove.getAttribute('position').count;
    const paint = new THREE.ShapeGeometry(shapes, 6).toNonIndexed();
    paint.applyMatrix4(matrixFor(fit, edge * .009));
    paints.push(paint);
    paintRanges.push({ label: face.label, start: paintStart, count: paint.getAttribute('position').count });
    paintStart += paint.getAttribute('position').count;
  }
  const grooveGeometry = mergeGeometries(grooves);
  const paintGeometry = mergeGeometries(paints);
  grooves.forEach((geometry) => geometry.dispose());
  paints.forEach((geometry) => geometry.dispose());
  grooveGeometry.userData.faceRanges = grooveRanges;
  paintGeometry.userData.faceRanges = paintRanges;
  return { grooveGeometry, paintGeometry };
}

export function lightningD20NumberMaterials(shape) {
  const planes = lightningD20Planes(shape);
  const visible = (material, key) => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.stormHull = { value: planes };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vStormGlyphPoint;\nvarying vec3 vStormGlyphRayDirection;');
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvStormGlyphPoint = position;\nvStormGlyphRayDirection = normalize(transpose(mat3(modelViewMatrix)) * vec3(0.0, 0.0, -1.0));');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vStormGlyphPoint;\nvarying vec3 vStormGlyphRayDirection;\nuniform vec4 stormHull[20];');
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        vec3 stormGlyphRay = vStormGlyphRayDirection * 3.0;
        vec3 stormGlyphEye = vStormGlyphPoint - stormGlyphRay;
        float stormGlyphEntry = 0.0;
        for (int face = 0; face < 20; face++) {
          float denominator = dot(stormHull[face].xyz, stormGlyphRay);
          if (denominator < -0.0001) stormGlyphEntry = max(stormGlyphEntry, (stormHull[face].w - dot(stormHull[face].xyz, stormGlyphEye)) / denominator);
        }
        if (stormGlyphEntry < 0.995) discard;
      `);
    };
    material.customProgramCacheKey = () => `lightning-glyph-${key}`;
    return material;
  };
  return {
    groove: visible(new THREE.MeshBasicMaterial({ color: 0xffe169, toneMapped: false, transparent: true, opacity: 1, depthTest: false, depthWrite: false, side: THREE.FrontSide }), 'groove'),
    paint: visible(new THREE.MeshBasicMaterial({ color: 0x231909, toneMapped: false, transparent: true, opacity: 1, depthTest: false, depthWrite: false, side: THREE.FrontSide }), 'paint'),
  };
}
