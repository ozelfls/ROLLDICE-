import * as THREE from 'three';
import { createDieShape } from './die-shapes.mjs';
import { SKINS, numberTexture, faceMaterial, edgeMaterial } from './dice-skins.mjs';
import { createPhysicalMotion, stepPhysicalMotion, resolvePhysicalCollisions, settlePhysicalMotion, createSpinProfile, spinAt, PHYSICAL_PHASE, ROLL_DURATION } from './dice-motion.mjs';

const shapeCache = new Map();

function modelFor(dice) {
  if (shapeCache.has(dice)) return shapeCache.get(dice);
  const shape = createDieShape(dice);
  shapeCache.set(dice, shape);
  return shape;
}

function makeDie(dice, skin) {
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
    this.rim = rim;
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
    this.token++;
    this.renderer.domElement.style.filter = '';
    this.displayState = null;
    for (const item of this.items) {
      this.scene.remove(item.root);
      this.scene.remove(item.shadow);
      item.shadow.geometry.dispose();
      item.shadow.material.dispose();
      item.root.traverse((part) => {
        part.geometry?.dispose();
        part.material?.dispose();
      });
    }
    this.items = [];
    this.labels.replaceChildren();
  }

  setSkin(skin) {
    if (!Object.hasOwn(SKINS, skin) || this.currentAnimation) return false;
    if (this.skin === skin) return true;
    const state = this.displayState;
    const positions = this.items.map((item) => ({ x: item.root.position.x, z: item.root.position.z }));
    this.skin = skin;
    this.stage.dataset.skin = skin;
    this.rim.color.setHex(SKINS[skin].rim);
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
    this.show(current.dice, current.result.quantity, current.result.mode, current.result, positions);
    current.resolve(true);
    return true;
  }

  show(dice, quantity, mode, result = null, positions = null) {
    this.clear();
    this.displayState = { dice, quantity, mode, result };
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
        const model = makeDie(dice, this.skin);
        const root = new THREE.Group();
        const placement = positions?.[this.items.length];
        root.position.set(placement?.x ?? centerX + (pair ? (member - .5) * scale * (dice === 'd100' ? 2.1 : 1.75) : 0), 0, placement?.z ?? centerZ);
        model.group.scale.setScalar(scale);
        root.add(model.group);
        const shadow = new THREE.Mesh(new THREE.CircleGeometry(scale * 1.05, 32), new THREE.MeshBasicMaterial({ color: 0x552c1d, transparent: true, opacity: .13, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.set(root.position.x, -1.12 * scale, root.position.z);
        this.scene.add(root, shadow);
        const value = result?.results[slot]?.rolls[member];
        const target = finalRotation(model, value ?? (dice === 'dpercent' ? 10 : 1));
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
          const ring = new THREE.Mesh(new THREE.RingGeometry(scale * .76, scale * .88, 40), new THREE.MeshBasicMaterial({ color: 0xd9fd62, transparent: true, opacity: .58, side: THREE.DoubleSide }));
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = -1.1 * scale;
          item.root.add(ring);
        } else item.model.group.traverse((part) => {
          if (part.material?.isMeshStandardMaterial) {
            part.material.color.lerp(new THREE.Color(0x9b8377), .62);
            part.material.emissiveIntensity *= .35;
          }
          if (part.material?.isMeshBasicMaterial || part.material?.isLineBasicMaterial) part.material.opacity = .45;
        });
      }
    }
    this.render();
  }

  animate(dice, result) {
    this.show(dice, result.quantity, result.mode, null);
    this.labels.replaceChildren();
    const token = this.token;
    this.items.forEach((item) => {
      const value = result.results[item.slot].rolls[item.member];
      item.target = finalRotation(item.model, value);
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
          item.shadow.position.z = item.root.position.z;
          item.shadow.material.opacity = .13 / (1 + item.root.position.y * .65);
        });
        previousTime = now;
        this.render();
        if (progress < 1) requestAnimationFrame(frame);
        else {
          const positions = this.items.map((item) => ({ x: item.root.position.x, z: item.root.position.z }));
          this.currentAnimation = null;
          this.show(dice, result.quantity, result.mode, result, positions);
          resolve(true);
        }
      };
      requestAnimationFrame(frame);
    });
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
