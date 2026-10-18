import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createDieShape } from './die-shapes.mjs';
import { beveledSurface } from './die-surface.mjs';
import { SKINS, numberTexture, faceMaterial, edgeMaterial, dragonFaceMaterial, dragonGoldMaterial, scuffedFaceMaterial, scuffedEdgeMaterial } from './dice-skins.mjs';
import { scuffedD20Surface, scuffedD20Numbers } from './scuffed-d20.mjs';
import { scuffedD20Materials, scuffedNumberMaterial } from './scuffed-materials.mjs';
import { behirD20Surface, behirD20Material, behirD20Core, behirD20CoreMaterial, behirD20Numbers, behirD20NumberMaterials } from './behir-d20.mjs';
import { dragonD20Surface, dragonD20Material, dragonD20Core, dragonD20CoreMaterial, dragonD20Numbers, dragonD20NumberMaterials } from './dragon-d20.mjs';
import { lightningD20Surface, lightningD20Material, lightningD20Pulse, lightningD20Veins, lightningD20VeinMaterials, lightningD20Numbers, lightningD20NumberMaterials } from './lightning-d20.mjs';
import { createPhysicalMotion, stepPhysicalMotion, resolvePhysicalCollisions, settlePhysicalMotion, createSpinProfile, spinAt, PHYSICAL_PHASE, ROLL_DURATION } from './dice-motion.mjs';

const shapeCache = new Map();
let sharedScuffedD20;
let sharedBehirD20;
let sharedDragonD20;
let sharedLightningD20;
const contactTextures = new Map();

function contactShadowTexture(skin) {
  if (contactTextures.has(skin)) return contactTextures.get(skin);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.translate(64, 64);
  context.scale(1, .62);
  const gradient = context.createRadialGradient(0, 0, 4, 0, 0, 59);
  const color = skin === 'scuffed' ? '86, 68, 64' : skin === 'behir' ? '115, 88, 92' : skin === 'dragonD20' ? '82, 48, 42' : skin === 'lightningD20' ? '92, 70, 26' : '110, 55, 45';
  gradient.addColorStop(0, `rgba(${color}, ${skin === 'scuffed' ? .67 : .48})`);
  if (skin === 'scuffed') gradient.addColorStop(.2, `rgba(${color}, .43)`);
  gradient.addColorStop(.42, `rgba(${color}, ${skin === 'scuffed' ? .21 : .24})`);
  gradient.addColorStop(1, `rgba(${color}, 0)`);
  context.fillStyle = gradient;
  context.fillRect(-64, -104, 128, 208);
  const texture = new THREE.CanvasTexture(canvas);
  contactTextures.set(skin, texture);
  return texture;
}

function modelFor(dice) {
  if (shapeCache.has(dice)) return shapeCache.get(dice);
  const shape = createDieShape(dice);
  shapeCache.set(dice, shape);
  return shape;
}

export function faceFrame(points) {
  const normal = new THREE.Vector3().crossVectors(points[1].clone().sub(points[0]), points[2].clone().sub(points[0])).normalize();
  const right = points[1].clone().sub(points[0]).normalize();
  const up = new THREE.Vector3().crossVectors(normal, right).normalize();
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
  return { right, up, normal, quaternion };
}

function makeDie(dice, skin, fonts) {
  const shape = modelFor(dice);
  const group = new THREE.Group();
  const faceFrames = new Map();
  if (skin === 'classic' && dice === 'd20' && fonts.classic) {
    if (!sharedLightningD20) {
      const frames = new Map(shape.faces.map((face) => {
        const points = face.vertices.map((vertex) => new THREE.Vector3(...shape.vertices[vertex]));
        return [face.label, faceFrame(points).quaternion];
      }));
      const pulse = lightningD20Pulse();
      sharedLightningD20 = {
        pulse,
        body: lightningD20Surface(shape),
        material: lightningD20Material(shape, pulse),
        veins: lightningD20Veins(),
        veinMaterials: lightningD20VeinMaterials(shape, pulse),
        numbers: lightningD20Numbers(shape, fonts.classic),
        numberMaterials: lightningD20NumberMaterials(shape),
        faceFrames: frames,
      };
    }
    const parts = [
      ...sharedLightningD20.veins.map((geometry, index) => [geometry, sharedLightningD20.veinMaterials[index]]),
      [sharedLightningD20.body, sharedLightningD20.material],
      [sharedLightningD20.numbers.grooveGeometry, sharedLightningD20.numberMaterials.groove],
      [sharedLightningD20.numbers.paintGeometry, sharedLightningD20.numberMaterials.paint],
    ];
    for (const [geometry, material] of parts) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.shared = true;
      const veinIndex = sharedLightningD20.veins.indexOf(geometry);
      if (veinIndex >= 0) mesh.renderOrder = .2 + veinIndex * .05;
      if (geometry === sharedLightningD20.numbers.grooveGeometry) mesh.renderOrder = 1;
      if (geometry === sharedLightningD20.numbers.paintGeometry) mesh.renderOrder = 2;
      group.add(mesh);
    }
    return { group, faceFrames: sharedLightningD20.faceFrames };
  }
  if (skin === 'dragonflame' && dice === 'd20' && fonts.dragonflame) {
    if (!sharedDragonD20) {
      const frames = new Map(shape.faces.map((face) => {
        const points = face.vertices.map((vertex) => new THREE.Vector3(...shape.vertices[vertex]));
        return [face.label, faceFrame(points).quaternion];
      }));
      sharedDragonD20 = {
        body: dragonD20Surface(shape),
        material: dragonD20Material(),
        core: dragonD20Core(),
        coreMaterial: dragonD20CoreMaterial(),
        numbers: dragonD20Numbers(shape, fonts.dragonflame),
        numberMaterials: dragonD20NumberMaterials(),
        faceFrames: frames,
      };
    }
    for (const [geometry, material] of [
      [sharedDragonD20.core, sharedDragonD20.coreMaterial],
      [sharedDragonD20.body, sharedDragonD20.material],
      [sharedDragonD20.numbers.grooveGeometry, sharedDragonD20.numberMaterials.groove],
      [sharedDragonD20.numbers.goldGeometry, sharedDragonD20.numberMaterials.gold],
    ]) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.shared = true;
      if (geometry === sharedDragonD20.numbers.grooveGeometry) mesh.renderOrder = 1;
      if (geometry === sharedDragonD20.numbers.goldGeometry) mesh.renderOrder = 2;
      group.add(mesh);
    }
    return { group, faceFrames: sharedDragonD20.faceFrames };
  }
  if (skin === 'behir' && dice === 'd20' && fonts.behir) {
    if (!sharedBehirD20) {
      const frames = new Map(shape.faces.map((face) => {
        const points = face.vertices.map((vertex) => new THREE.Vector3(...shape.vertices[vertex]));
        return [face.label, faceFrame(points).quaternion];
      }));
      const numbers = behirD20Numbers(shape, fonts.behir);
      const numberMaterials = behirD20NumberMaterials();
      sharedBehirD20 = {
        body: behirD20Surface(shape),
        material: behirD20Material(),
        core: behirD20Core(),
        coreMaterial: behirD20CoreMaterial(),
        numbers,
        numberMaterials,
        faceFrames: frames,
      };
    }
    for (const [geometry, material] of [
      [sharedBehirD20.core, sharedBehirD20.coreMaterial],
      [sharedBehirD20.body, sharedBehirD20.material],
      [sharedBehirD20.numbers.grooveGeometry, sharedBehirD20.numberMaterials.groove],
      [sharedBehirD20.numbers.paintGeometry, sharedBehirD20.numberMaterials.paint],
    ]) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.shared = true;
      if (geometry === sharedBehirD20.numbers.grooveGeometry) mesh.renderOrder = 1;
      if (geometry === sharedBehirD20.numbers.paintGeometry) mesh.renderOrder = 2;
      group.add(mesh);
    }
    return { group, faceFrames: sharedBehirD20.faceFrames };
  }
  if (skin === 'scuffed' && dice === 'd20' && fonts.scuffed) {
    if (!sharedScuffedD20) {
      const frames = new Map(shape.faces.map((face) => {
        const points = face.vertices.map((vertex) => new THREE.Vector3(...shape.vertices[vertex]));
        return [face.label, faceFrame(points).quaternion];
      }));
      sharedScuffedD20 = {
        body: scuffedD20Surface(shape),
        numbers: scuffedD20Numbers(shape, fonts.scuffed),
        materials: scuffedD20Materials(),
        numberMaterial: scuffedNumberMaterial(),
        faceFrames: frames,
      };
    }
    const body = new THREE.Mesh(sharedScuffedD20.body, sharedScuffedD20.materials);
    const numbers = new THREE.Mesh(sharedScuffedD20.numbers, sharedScuffedD20.numberMaterial);
    body.userData.shared = true;
    numbers.userData.shared = true;
    group.add(body, numbers);
    return { group, faceFrames: sharedScuffedD20.faceFrames };
  }
  if (skin === 'dragonflame' || skin === 'scuffed') {
    const materials = shape.faces.map((face, index) => {
      const points = face.vertices.map((vertex) => new THREE.Vector3(...shape.vertices[vertex]));
      faceFrames.set(face.label, faceFrame(points).quaternion);
      return skin === 'scuffed' ? scuffedFaceMaterial(face.label, index, dice) : dragonFaceMaterial(face.label, dice);
    });
    if (skin === 'scuffed') {
      materials.push(scuffedEdgeMaterial(0xb2b6c2), scuffedEdgeMaterial(0xd6d9e1), scuffedEdgeMaterial(0x5e6270));
    } else materials.push(dragonGoldMaterial());
    const geometry = beveledSurface(shape, skin === 'scuffed' ? .105 : .075);
    if (skin === 'scuffed') {
      const normals = geometry.getAttribute('normal');
      const light = new THREE.Vector3(-3, 8, 5).normalize();
      for (const segment of geometry.groups.slice(shape.faces.length)) {
        const normal = new THREE.Vector3().fromBufferAttribute(normals, segment.start);
        const angle = normal.dot(light);
        segment.materialIndex = shape.faces.length + (angle > .25 ? 1 : angle < -.25 ? 2 : 0);
      }
    }
    group.add(new THREE.Mesh(geometry, materials));
    return { group, faceFrames };
  }
  shape.faces.forEach((face, index) => {
    const points = face.vertices.map((vertex) => new THREE.Vector3(...shape.vertices[vertex]));
    const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
    const { right, up, normal, quaternion } = faceFrame(points);
    faceFrames.set(face.label, quaternion);
    const vertices = [];
    const uv = [];
    const radius = Math.max(...points.map((point) => point.distanceTo(center)));
    const coordinate = (point) => {
      const offset = point.clone().sub(center);
      return [.5 + offset.dot(right) / (2 * radius), .5 + offset.dot(up) / (2 * radius)];
    };
    for (let corner = 0; corner < points.length; corner++) {
      vertices.push(...center, ...points[corner], ...points[(corner + 1) % points.length]);
      uv.push(...coordinate(center), ...coordinate(points[corner]), ...coordinate(points[(corner + 1) % points.length]));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, faceMaterial(skin, index));
    group.add(mesh);
    const edges = [];
    for (let corner = 0; corner < points.length; corner++) edges.push(...points[corner], ...points[(corner + 1) % points.length]);
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edges, 3));
    group.add(new THREE.LineSegments(edgeGeometry, edgeMaterial(skin)));
    const labelSize = dice === 'd100' ? .17 : Math.min(.53, Math.max(.25, Math.min(...points.map((point) => point.distanceTo(center))) * 1.05));
    const label = new THREE.Mesh(new THREE.PlaneGeometry(labelSize, labelSize), new THREE.MeshBasicMaterial({ map: numberTexture(face.label, skin), transparent: true, depthWrite: false, side: THREE.FrontSide }));
    label.position.copy(center).addScaledVector(normal, .018);
    label.quaternion.copy(quaternion);
    group.add(label);
  });
  return { group, faceFrames };
}

export function finalRotation(faceFrames, value, cameraQuaternion) {
  const frame = faceFrames.get(value);
  if (!frame) throw new RangeError('Face do dado não encontrada.');
  return cameraQuaternion.clone().multiply(frame.clone().invert());
}

export class DiceView {
  constructor(stage, labels, fonts) {
    this.stage = stage;
    this.labels = labels;
    this.fonts = fonts;
    this.lightningRaf = null;
    this.lightningLastFrame = 0;
    this.lightningSurgeAt = null;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-5, 5, 4, -4, .1, 100);
    this.camera.position.set(0, 13, 7);
    this.camera.lookAt(0, 0, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.stage.append(this.renderer.domElement);
    this.dragonEnvironment = null;
    this.scuffedEnvironment = null;
    this.behirEnvironment = null;
    this.lightningEnvironment = null;
    const ambient = new THREE.HemisphereLight(0xffffff, 0x7d4e37, 2.15);
    this.scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-3, 8, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8de9d6, 1.15);
    rim.position.set(5, 4, -6);
    this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffaa8c, 0);
    fill.position.set(4, 2, 7);
    this.scene.add(fill);
    const dragonAmbient = new THREE.AmbientLight(0x78463c, 0);
    this.scene.add(dragonAmbient);
    const scuffedAmbient = new THREE.AmbientLight(0x4c4a4a, 0);
    this.scene.add(scuffedAmbient);
    const behirAmbient = new THREE.AmbientLight(0x1c2a4e, 0);
    this.scene.add(behirAmbient);
    const lightningAmbient = new THREE.AmbientLight(0x4c360e, 0);
    this.scene.add(lightningAmbient);
    this.ambient = ambient;
    this.key = key;
    this.rim = rim;
    this.fill = fill;
    this.dragonAmbient = dragonAmbient;
    this.scuffedAmbient = scuffedAmbient;
    this.behirAmbient = behirAmbient;
    this.lightningAmbient = lightningAmbient;
    this.skin = 'classic';
    this.stage.dataset.skin = this.skin;
    this.displayState = null;
    this.items = [];
    this.token = 0;
    this.currentAnimation = null;
    this.viewSpan = 3.6;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(stage);
    this.resize();
  }

  resize() {
    const width = Math.max(1, this.stage.clientWidth);
    const height = Math.max(1, this.stage.clientHeight);
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    const span = this.viewSpan;
    this.camera.left = -span * aspect / 2;
    this.camera.right = span * aspect / 2;
    this.camera.top = span / 2;
    this.camera.bottom = -span / 2;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  clear() {
    this.stopLightningIdle();
    this.token++;
    this.renderer.domElement.style.filter = '';
    this.displayState = null;
    for (const item of this.items) {
      this.scene.remove(item.root);
      this.scene.remove(item.shadow);
      item.shadow.geometry.dispose();
      item.shadow.material.dispose();
      item.root.traverse((part) => {
        if (part.userData.shared) {
          if (part.userData.ownedMaterials) {
            if (Array.isArray(part.material)) part.material.forEach((material) => material.dispose());
            else part.material.dispose();
          }
          return;
        }
        part.geometry?.dispose();
        if (Array.isArray(part.material)) part.material.forEach((material) => material.dispose());
        else part.material?.dispose();
      });
    }
    this.items = [];
    this.labels.replaceChildren();
  }

  updateLightningPulse(now) {
    if (!sharedLightningD20) return;
    sharedLightningD20.pulse.time.value = now / 1000;
    if (this.lightningSurgeAt === null) {
      sharedLightningD20.pulse.surge.value = 0;
      return;
    }
    const elapsed = now - this.lightningSurgeAt;
    sharedLightningD20.pulse.surge.value = elapsed < 120 ? 1 : Math.max(0, 1 - (elapsed - 120) / 350);
    if (elapsed >= 470) this.lightningSurgeAt = null;
  }

  stopLightningIdle() {
    if (this.lightningRaf !== null) cancelAnimationFrame(this.lightningRaf);
    this.lightningRaf = null;
    this.lightningLastFrame = 0;
  }

  startLightningIdle() {
    if (this.lightningRaf !== null) return;
    const frame = (now) => {
      if (this.skin !== 'classic' || this.displayState?.dice !== 'd20' || !sharedLightningD20) {
        this.lightningRaf = null;
        return;
      }
      if (now - this.lightningLastFrame >= 33) {
        this.updateLightningPulse(now);
        if (document.visibilityState !== 'hidden') this.render();
        this.lightningLastFrame = now;
      }
      this.lightningRaf = requestAnimationFrame(frame);
    };
    this.lightningRaf = requestAnimationFrame(frame);
  }

  applySkinLighting(dice) {
    const skin = this.skin;
    const behirD20 = skin === 'behir' && dice === 'd20';
    const dragonD20 = skin === 'dragonflame' && dice === 'd20';
    const lightningD20 = skin === 'classic' && dice === 'd20';
    this.rim.color.setHex(behirD20 ? 0x54e1ff : dragonD20 ? 0xff5c3a : lightningD20 ? 0xfff3a9 : skin === 'scuffed' ? 0xd2cec6 : SKINS[skin].rim);
    this.rim.position.set(5, behirD20 || dragonD20 || lightningD20 ? 1 : 4, -6);
    const environmentKey = skin === 'dragonflame' ? 'dragonEnvironment' : skin === 'scuffed' ? 'scuffedEnvironment' : behirD20 ? 'behirEnvironment' : lightningD20 ? 'lightningEnvironment' : null;
    if (environmentKey && !this[environmentKey]) {
      const environment = new RoomEnvironment();
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this[environmentKey] = pmrem.fromScene(environment).texture;
      pmrem.dispose();
      environment.dispose();
    }
    this.scene.environment = environmentKey ? this[environmentKey] : null;
    this.renderer.toneMapping = skin === 'dragonflame' || skin === 'scuffed' || behirD20 || lightningD20 ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    this.renderer.toneMappingExposure = dragonD20 ? .94 : skin === 'dragonflame' ? .87 : skin === 'scuffed' ? .84 : behirD20 ? 1.05 : lightningD20 ? .82 : 1;
    this.ambient.intensity = skin === 'dragonflame' || skin === 'scuffed' || behirD20 || lightningD20 ? 0 : 2.15;
    this.dragonAmbient.color.setHex(dragonD20 ? 0x401010 : 0x78463c);
    this.dragonAmbient.intensity = dragonD20 ? .62 : skin === 'dragonflame' ? .85 : 0;
    this.scuffedAmbient.intensity = skin === 'scuffed' ? .8 : 0;
    this.behirAmbient.intensity = behirD20 ? .7 : 0;
    this.lightningAmbient.intensity = lightningD20 ? .43 : 0;
    this.key.color.setHex(behirD20 ? 0xdae8ff : dragonD20 ? 0xffe4d2 : lightningD20 ? 0xffecb9 : skin === 'dragonflame' ? 0xffd6aa : skin === 'scuffed' ? 0xece4d8 : 0xffffff);
    this.key.intensity = behirD20 ? 2 : dragonD20 ? 1.85 : lightningD20 ? 1.35 : skin === 'dragonflame' ? 2.1 : skin === 'scuffed' ? 1.9 : 2.2;
    this.rim.intensity = behirD20 ? 1.3 : dragonD20 ? 1.18 : lightningD20 ? .74 : skin === 'dragonflame' ? 0 : skin === 'scuffed' ? 1.16 : 1.15;
    this.fill.color.setHex(behirD20 ? 0x78aaf5 : dragonD20 ? 0xff9a78 : lightningD20 ? 0xffcc7d : skin === 'scuffed' ? 0xaab0ba : 0xffaa8c);
    this.fill.intensity = behirD20 ? .85 : dragonD20 ? .74 : lightningD20 ? .47 : skin === 'dragonflame' ? .65 : skin === 'scuffed' ? .72 : 0;
  }

  setSkin(skin) {
    if (!Object.hasOwn(SKINS, skin) || this.currentAnimation) return false;
    if (this.skin === skin) return true;
    const state = this.displayState;
    const positions = this.items.map((item) => ({ x: item.root.position.x, z: item.root.position.z }));
    this.skin = skin;
    this.stage.dataset.skin = skin;
    this.applySkinLighting(state?.dice);
    if (state) this.show(state.dice, state.quantity, state.mode, state.result, positions);
    return true;
  }

  cancelAnimation() {
    const current = this.currentAnimation;
    this.currentAnimation = null;
    this.clear();
    current?.resolve(false);
  }

  skipAnimation() {
    const current = this.currentAnimation;
    if (!current) return false;
    const positions = this.items.map((item) => ({ x: item.root.position.x, z: item.root.position.z }));
    this.currentAnimation = null;
    this.lightningSurgeAt = performance.now();
    this.show(current.dice, current.result.quantity, current.result.mode, current.result, positions);
    current.resolve(true);
    return true;
  }

  show(dice, quantity, mode, result = null, positions = null) {
    this.clear();
    this.displayState = { dice, quantity, mode, result };
    this.applySkinLighting(dice);
    const pair = mode !== 'normal';
    const columns = quantity === 1 ? 1 : Math.ceil(Math.sqrt(quantity * 1.6));
    const rows = Math.ceil(quantity / columns);
    this.stage.style.height = rows > 2 ? '250px' : rows === 2 ? '225px' : '205px';
    this.viewSpan = Math.max(3.6, rows * 1.65 + .65);
    this.resize();
    const width = Math.max(1, this.stage.clientWidth);
    const height = Math.max(1, this.stage.clientHeight);
    const aspect = width / height;
    const xStep = Math.min(quantity <= 4 ? 4.2 : 3.4, (this.viewSpan * aspect - .5) / columns);
    const zStep = Math.min(1.8, (this.viewSpan - .4) / rows);
    const baseScale = dice === 'd100' && quantity === 1
      ? pair ? 1.3 : 1.5
      : Math.min(pair ? 1.1 : 1.5, xStep / (pair ? 3.85 : 1.8), zStep / 1.7);
    const scale = this.skin === 'classic' && dice === 'd20' && !pair ? baseScale * 1.2 : (this.skin === 'behir' || this.skin === 'dragonflame') && dice === 'd20' && !pair ? baseScale * 1.08 : baseScale;
    for (let slot = 0; slot < quantity; slot++) {
      const row = Math.floor(slot / columns);
      const inRow = Math.min(columns, quantity - row * columns);
      const column = slot - row * columns;
      const centerX = (column - (inRow - 1) / 2) * xStep;
      const centerZ = (row - (rows - 1) / 2) * zStep;
      for (let member = 0; member < (pair ? 2 : 1); member++) {
        const model = makeDie(dice, this.skin, this.fonts);
        const root = new THREE.Group();
        const placement = positions?.[this.items.length];
        root.position.set(placement?.x ?? centerX + (pair ? (member - .5) * scale * (dice === 'd100' ? 2.1 : 1.75) : 0), 0, placement?.z ?? centerZ);
        model.group.scale.setScalar(scale);
        root.add(model.group);
        const behirD20 = this.skin === 'behir' && dice === 'd20';
        const dragonD20 = this.skin === 'dragonflame' && dice === 'd20';
        const lightningD20 = this.skin === 'classic' && dice === 'd20';
        const contactShadow = this.skin === 'dragonflame' || this.skin === 'scuffed' || behirD20 || lightningD20;
        const shadowOpacity = behirD20 || dragonD20 || lightningD20 ? .58 : this.skin === 'scuffed' ? .6 : .55;
        const shadowOffset = this.skin === 'scuffed' ? .48 : behirD20 || dragonD20 || lightningD20 ? .6 : contactShadow ? .28 : 0;
        const shadow = contactShadow
          ? new THREE.Mesh(new THREE.PlaneGeometry(scale * 2.25, scale * 2.25), new THREE.MeshBasicMaterial({ map: contactShadowTexture(dragonD20 ? 'dragonD20' : lightningD20 ? 'lightningD20' : this.skin), transparent: true, opacity: shadowOpacity, depthWrite: false, side: THREE.DoubleSide }))
          : new THREE.Mesh(new THREE.CircleGeometry(scale * 1.05, 32), new THREE.MeshBasicMaterial({ color: 0x552c1d, transparent: true, opacity: .13, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.set(root.position.x, -1.12 * scale, root.position.z + shadowOffset * scale);
        shadow.userData.contact = contactShadow;
        shadow.userData.baseOpacity = contactShadow ? shadowOpacity : .13;
        shadow.userData.offsetZ = shadowOffset;
        this.scene.add(root, shadow);
        const value = result?.results[slot]?.rolls[member];
        const target = finalRotation(model.faceFrames, value ?? (dice === 'dpercent' ? 10 : 1), this.camera.quaternion);
        model.group.quaternion.copy(target);
        const item = { root, shadow, model, value, target, slot, member, base: root.position.clone() };
        this.items.push(item);
      }
      const chip = document.createElement('span');
      chip.className = 'die-result-chip';
      const one = result?.results[slot];
      chip.textContent = one ? pair ? `${one.first}${dice === 'dpercent' ? '%' : ''} / ${one.second}${dice === 'dpercent' ? '%' : ''} → ${one.selected}${dice === 'dpercent' ? '%' : ''}` : `${one.selected}${dice === 'dpercent' ? '%' : ''}` : pair ? `${slot + 1} · 2 dados` : `${slot + 1}`;
      chip.dataset.selected = one ? 'true' : 'false';
      this.labels.append(chip);
    }
    this.labels.style.setProperty('--chip-columns', String(Math.min(columns, quantity)));
    if (result && pair) {
      for (const item of this.items) {
        const chosen = result.results[item.slot].selectedIndex === item.member;
        if (chosen) {
          const behirD20 = this.skin === 'behir' && dice === 'd20';
          const ring = new THREE.Mesh(new THREE.RingGeometry(scale * .76, scale * .88, 40), new THREE.MeshBasicMaterial({ color: this.skin === 'dragonflame' ? 0xd4a84a : this.skin === 'scuffed' ? 0xb2b6c2 : behirD20 ? 0x54e1ff : 0xd9fd62, transparent: true, opacity: this.skin === 'scuffed' || behirD20 ? .25 : .58, side: THREE.DoubleSide }));
          ring.rotation.x = -Math.PI / 2;
          if (this.skin === 'scuffed' || behirD20) ring.scale.y = .65;
          ring.position.y = -1.1 * scale;
          item.root.add(ring);
        } else item.model.group.traverse((part) => {
          if (this.skin === 'classic' && dice === 'd20' && part.userData.shared) {
            if (part.geometry === sharedLightningD20.body) part.material = lightningD20Material(modelFor('d20'), sharedLightningD20.pulse, true);
            else {
              const veinIndex = sharedLightningD20.veins.indexOf(part.geometry);
              part.material = part.material.clone();
              if (veinIndex >= 0) {
                part.material.onBeforeCompile = sharedLightningD20.veinMaterials[veinIndex].onBeforeCompile;
                part.material.customProgramCacheKey = sharedLightningD20.veinMaterials[veinIndex].customProgramCacheKey;
                part.material.opacity *= .52;
              } else part.material.color.lerp(new THREE.Color(part.geometry === sharedLightningD20.numbers.paintGeometry ? 0x4e340a : 0x2a1804), .46);
            }
            part.userData.ownedMaterials = true;
            return;
          }
          if (this.skin === 'behir' && dice === 'd20' && part.userData.shared) {
            if (part.geometry === sharedBehirD20.body) part.material = behirD20Material(true);
            else if (part.geometry === sharedBehirD20.core) part.material = behirD20CoreMaterial(true);
            else {
              part.material = part.material.clone();
              part.material.color.lerp(new THREE.Color(part.geometry === sharedBehirD20.numbers.paintGeometry ? 0xaaafbc : 0x0b1c48), .52);
            }
            part.userData.ownedMaterials = true;
            return;
          }
          if (this.skin === 'dragonflame' && dice === 'd20' && part.userData.shared) {
            if (part.geometry === sharedDragonD20.body) part.material = dragonD20Material(true);
            else if (part.geometry === sharedDragonD20.core) part.material = dragonD20CoreMaterial(true);
            else {
              part.material = part.material.clone();
              part.material.color.lerp(new THREE.Color(part.geometry === sharedDragonD20.numbers.goldGeometry ? 0x9c6c21 : 0x6e4812), .45);
            }
            part.userData.ownedMaterials = true;
            return;
          }
          if (part.userData.shared && !part.userData.ownedMaterials) {
            const cloneMaterial = (material) => {
              const clone = material.clone();
              clone.onBeforeCompile = material.onBeforeCompile;
              return clone;
            };
            part.material = Array.isArray(part.material) ? part.material.map(cloneMaterial) : cloneMaterial(part.material);
            part.userData.ownedMaterials = true;
          }
          const materials = Array.isArray(part.material) ? part.material : [part.material];
          for (const material of materials) {
            if (material?.isMeshStandardMaterial) {
              material.color.lerp(new THREE.Color(this.skin === 'scuffed' ? 0x494c5c : 0x9b8377), .62);
              material.emissiveIntensity *= .35;
            }
            if (material?.isMeshBasicMaterial || material?.isLineBasicMaterial) material.opacity = .45;
          }
        });
      }
    }
    this.render();
    if (this.skin === 'classic' && dice === 'd20' && sharedLightningD20) this.startLightningIdle();
  }

  animate(dice, result) {
    this.show(dice, result.quantity, result.mode, null);
    this.stopLightningIdle();
    if (this.skin === 'classic' && dice === 'd20' && sharedLightningD20) sharedLightningD20.pulse.rolling.value = 1;
    this.labels.replaceChildren();
    const token = this.token;
    this.items.forEach((item) => {
      const value = result.results[item.slot].rolls[item.member];
      item.target = finalRotation(item.model.faceFrames, value, this.camera.quaternion);
    });
    const startTime = performance.now();
    let previousTime = startTime;
    const bodies = this.items.map((item, index) => createPhysicalMotion({
      baseX: item.base.x,
      baseZ: item.base.z,
      halfWidth: (this.camera.right - this.camera.left) / 2 - .25,
      halfDepth: this.viewSpan / 2 - .35,
      radius: item.model.group.scale.x * .82,
      index,
      total: this.items.length,
    }));
    const spins = this.items.map(() => createSpinProfile());
    const spinEuler = new THREE.Euler();
    const spinQuaternion = new THREE.Quaternion();
    let landing = null;
    return new Promise((resolve) => {
      const current = { dice, result, resolve };
      this.currentAnimation = current;
      const frame = (now) => {
        if (token !== this.token) {
          if (this.currentAnimation === current) {
            this.currentAnimation = null;
            resolve(false);
          }
          return;
        }
        const progress = Math.min(1, (now - startTime) / ROLL_DURATION);
        if (progress < PHYSICAL_PHASE) {
          const delta = Math.min(.05, Math.max(0, (now - previousTime) / 1000));
          const steps = Math.max(1, Math.ceil(delta / (1 / 90)));
          for (let step = 0; step < steps; step++) {
            bodies.forEach((body) => stepPhysicalMotion(body, delta / steps));
            resolvePhysicalCollisions(bodies);
          }
          this.items.forEach((item, index) => {
            const body = bodies[index];
            item.root.position.set(body.x, body.y, body.z);
          });
        } else {
          if (!landing) landing = bodies.map((body) => ({ ...body }));
          const t = Math.min(1, (progress - PHYSICAL_PHASE) / (1 - PHYSICAL_PHASE));
          this.items.forEach((item, index) => {
            const motion = settlePhysicalMotion(landing[index], t);
            item.root.position.set(motion.x, motion.y, motion.z);
          });
        }
        this.items.forEach((item, index) => {
          const spin = spinAt(progress, spins[index]);
          spinEuler.set(spin.x, spin.y, spin.z);
          spinQuaternion.setFromEuler(spinEuler);
          item.model.group.quaternion.copy(item.target).multiply(spinQuaternion);
        });
        const blur = spinAt(progress, spins[0]).blur;
        this.renderer.domElement.style.filter = blur > .04 ? `blur(${blur.toFixed(2)}px)` : '';
        this.items.forEach((item) => {
          item.shadow.position.x = item.root.position.x;
          item.shadow.position.z = item.root.position.z + item.shadow.userData.offsetZ * item.model.group.scale.x;
          if (item.shadow.userData.contact) {
            item.shadow.material.opacity = item.shadow.userData.baseOpacity / (1 + item.root.position.y * 1.2);
            item.shadow.scale.setScalar(1 + item.root.position.y * .18);
          } else item.shadow.material.opacity = item.shadow.userData.baseOpacity / (1 + item.root.position.y * .65);
        });
        previousTime = now;
        if (this.skin === 'classic' && dice === 'd20' && sharedLightningD20) this.updateLightningPulse(now);
        this.render();
        if (progress < 1) requestAnimationFrame(frame);
        else {
          const positions = this.items.map((item) => ({ x: item.root.position.x, z: item.root.position.z }));
          this.currentAnimation = null;
          this.lightningSurgeAt = now;
          if (sharedLightningD20) sharedLightningD20.pulse.rolling.value = 0;
          this.show(dice, result.quantity, result.mode, result, positions);
          resolve(true);
        }
      };
      requestAnimationFrame(frame);
    });
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
