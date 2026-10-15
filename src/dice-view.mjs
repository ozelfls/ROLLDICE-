import * as THREE from 'three';
import { createDieShape } from './die-shapes.mjs';
import { motionAt, ROLL_DURATION } from './dice-motion.mjs';

const palette = [0xffe5b0, 0xffd489, 0xf9c774, 0xffe9bf];
const labelCache = new Map();
const shapeCache = new Map();

function labelTexture(value) {
  const key = String(value);
  if (labelCache.has(key)) return labelCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#31251e';
  context.font = `900 ${key.length > 2 ? 112 : 145}px system-ui`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(key, 128, 135);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  labelCache.set(key, texture);
  return texture;
}

function modelFor(dice) {
  if (shapeCache.has(dice)) return shapeCache.get(dice);
  const shape = createDieShape(dice);
  shapeCache.set(dice, shape);
  return shape;
}

function makeDie(dice) {
  const shape = modelFor(dice);
  const group = new THREE.Group();
  const faceFrames = new Map();
  shape.faces.forEach((face, index) => {
    const points = face.vertices.map((vertex) => new THREE.Vector3(...shape.vertices[vertex]));
    const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
    const normal = new THREE.Vector3().crossVectors(points[1].clone().sub(points[0]), points[2].clone().sub(points[0])).normalize();
    const right = points[1].clone().sub(points[0]).normalize();
    const up = new THREE.Vector3().crossVectors(normal, right).normalize();
    const localFrame = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
    faceFrames.set(face.label, localFrame);
    const vertices = [];
    for (let corner = 0; corner < points.length; corner++) {
      vertices.push(...center, ...points[corner], ...points[(corner + 1) % points.length]);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: palette[index % palette.length], roughness: .42, metalness: .04, side: THREE.FrontSide, flatShading: true }));
    group.add(mesh);
    const edges = [];
    for (let corner = 0; corner < points.length; corner++) edges.push(...points[corner], ...points[(corner + 1) % points.length]);
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edges, 3));
    group.add(new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 0x8c5c41, transparent: true, opacity: .72 })));
    const labelSize = dice === 'd100' ? .17 : Math.min(.53, Math.max(.25, Math.min(...points.map((point) => point.distanceTo(center))) * 1.05));
    const label = new THREE.Mesh(new THREE.PlaneGeometry(labelSize, labelSize), new THREE.MeshBasicMaterial({ map: labelTexture(face.label), transparent: true, depthWrite: false, side: THREE.FrontSide }));
    label.position.copy(center).addScaledVector(normal, .018);
    label.quaternion.copy(localFrame);
    group.add(label);
  });
  return { group, faceFrames };
}

function finalRotation(model, value) {
  const frame = model.faceFrames.get(value);
  const right = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3(0, 0, -1);
  const normal = new THREE.Vector3(0, 1, 0);
  const worldFrame = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
  return worldFrame.multiply(frame.clone().invert());
}

export class DiceView {
  constructor(stage, labels) {
    this.stage = stage;
    this.labels = labels;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-5, 5, 4, -4, .1, 100);
    this.camera.position.set(0, 13, 7);
    this.camera.lookAt(0, 0, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.stage.append(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x7d4e37, 2.15));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-3, 8, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8de9d6, 1.15);
    rim.position.set(5, 4, -6);
    this.scene.add(rim);
    this.items = [];
    this.token = 0;
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
    this.token++;
    for (const item of this.items) {
      this.scene.remove(item.root);
      item.model.group.traverse((part) => {
        part.geometry?.dispose();
        part.material?.dispose();
      });
    }
    this.items = [];
    this.labels.replaceChildren();
  }

  show(dice, quantity, mode, result = null) {
    this.clear();
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
    const scale = dice === 'd100' && quantity === 1
      ? pair ? 1.3 : 1.5
      : Math.min(pair ? 1.1 : 1.5, xStep / (pair ? 3.85 : 1.8), zStep / 1.7);
    for (let slot = 0; slot < quantity; slot++) {
      const row = Math.floor(slot / columns);
      const inRow = Math.min(columns, quantity - row * columns);
      const column = slot - row * columns;
      const centerX = (column - (inRow - 1) / 2) * xStep;
      const centerZ = (row - (rows - 1) / 2) * zStep;
      for (let member = 0; member < (pair ? 2 : 1); member++) {
        const model = makeDie(dice);
        const root = new THREE.Group();
        root.position.set(centerX + (pair ? (member - .5) * scale * (dice === 'd100' ? 2.1 : 1.75) : 0), 0, centerZ);
        model.group.scale.setScalar(scale);
        root.add(model.group);
        const shadow = new THREE.Mesh(new THREE.CircleGeometry(scale * 1.05, 32), new THREE.MeshBasicMaterial({ color: 0x552c1d, transparent: true, opacity: .13, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = -1.12 * scale;
        root.add(shadow);
        this.scene.add(root);
        const value = result?.results[slot]?.rolls[member];
        const target = finalRotation(model, value ?? (dice === 'dpercent' ? 10 : 1));
        model.group.quaternion.copy(target);
        const item = { root, model, value, target, slot, member, base: root.position.clone() };
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
          const ring = new THREE.Mesh(new THREE.RingGeometry(scale * .76, scale * .88, 40), new THREE.MeshBasicMaterial({ color: 0xd9fd62, transparent: true, opacity: .58, side: THREE.DoubleSide }));
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = -1.1 * scale;
          item.root.add(ring);
        } else item.model.group.traverse((part) => {
          if (part.material?.isMeshStandardMaterial) part.material.color.lerp(new THREE.Color(0x9b8377), .62);
          if (part.material?.isMeshBasicMaterial || part.material?.isLineBasicMaterial) part.material.opacity = .45;
        });
      }
    }
    this.render();
  }

  animate(dice, result) {
    this.show(dice, result.quantity, result.mode, null);
    const token = this.token;
    this.items.forEach((item) => {
      const value = result.results[item.slot].rolls[item.member];
      item.target = finalRotation(item.model, value);
    });
    const startTime = performance.now();
    return new Promise((resolve) => {
      const frame = (now) => {
        if (token !== this.token) { resolve(false); return; }
        const progress = Math.min(1, (now - startTime) / ROLL_DURATION);
        this.items.forEach((item, index) => {
          const movement = motionAt(progress, index);
          item.root.position.set(item.base.x + movement.x * item.model.group.scale.x, movement.y * item.model.group.scale.x, item.base.z + movement.z * item.model.group.scale.x);
          const spin = new THREE.Quaternion().setFromEuler(new THREE.Euler(movement.spin, movement.spin * .71, movement.spin * .38));
          item.model.group.quaternion.copy(item.target).multiply(spin);
        });
        this.render();
        if (progress < 1) requestAnimationFrame(frame);
        else { this.show(dice, result.quantity, result.mode, result); resolve(true); }
      };
      requestAnimationFrame(frame);
    });
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
