import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createDieShape } from '../src/die-shapes.mjs';
import { beveledSurface } from '../src/die-surface.mjs';
import { faceFrame, finalRotation } from '../src/dice-view.mjs';
import { createPhysicalMotion, stepPhysicalMotion, resolvePhysicalCollisions, settlePhysicalMotion, createSpinProfile, spinAt, PHYSICAL_PHASE, ROLL_DURATION } from '../src/dice-motion.mjs';

const counts = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100, dpercent: 10 };
const subtract = (a, b) => a.map((value, index) => value - b[index]);
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

test('todos os dados têm geometria convexa, fechada e faces numeradas', () => {
  for (const [dice, count] of Object.entries(counts)) {
    const shape = createDieShape(dice);
    assert.equal(shape.faces.length, count, dice);
    const expected = dice === 'dpercent' ? [10, 20, 30, 40, 50, 60, 70, 80, 90, '00'] : Array.from({ length: count }, (_, index) => index + 1);
    assert.deepEqual(shape.faces.map((face) => face.label).sort((a, b) => Number(a) - Number(b)), expected.sort((a, b) => Number(a) - Number(b)), dice);
    const edges = new Set();
    for (const face of shape.faces) {
      const points = face.vertices.map((index) => shape.vertices[index]);
      assert.ok(points.length >= 3, dice);
      const normal = cross(subtract(points[1], points[0]), subtract(points[2], points[0]));
      assert.ok(dot(normal, points[0]) > 0, dice);
      for (const point of points) assert.ok(Math.abs(dot(normal, subtract(point, points[0]))) < 1e-6, dice);
      for (const vertex of shape.vertices) assert.ok(dot(normal, subtract(vertex, points[0])) <= 1e-6, dice);
      for (let index = 0; index < face.vertices.length; index++) {
        const edge = [face.vertices[index], face.vertices[(index + 1) % face.vertices.length]].sort((a, b) => a - b).join(':');
        edges.add(edge);
      }
    }
    assert.equal(shape.vertices.length - edges.size + shape.faces.length, 2, dice);
  }
});

test('faces opostas do D20 somam vinte e um', () => {
  const shape = createDieShape('d20');
  for (const face of shape.faces) {
    const [a, b, c] = face.vertices.map((index) => shape.vertices[index]);
    const normal = cross(subtract(b, a), subtract(c, a));
    const opposite = shape.faces.find((candidate) => candidate.label === 21 - face.label);
    const [x, y, z] = opposite.vertices.map((index) => shape.vertices[index]);
    const other = cross(subtract(y, x), subtract(z, x));
    assert.ok(dot(normal, other) < -dot(normal, normal) * .999);
  }
});

test('a superfície chanfrada fecha todos os formatos sem faces invertidas', () => {
  for (const dice of Object.keys(counts)) {
    const shape = createDieShape(dice);
    const geometry = beveledSurface(shape);
    const coordinates = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    const edges = new Map();
    assert.ok(geometry.groups.length > shape.faces.length, dice);
    assert.deepEqual(geometry.groups.slice(0, shape.faces.length).map((group) => group.materialIndex), shape.faces.map((_, index) => index), dice);
    if (dice === 'd20') assert.ok(geometry.groups.slice(0, 20).every((group) => group.count === 3));
    for (let index = 0; index < coordinates.count; index += 3) {
      const points = [0, 1, 2].map((offset) => new THREE.Vector3().fromBufferAttribute(coordinates, index + offset));
      const normal = new THREE.Vector3().fromBufferAttribute(normals, index);
      const actual = new THREE.Vector3().crossVectors(points[1].clone().sub(points[0]), points[2].clone().sub(points[0]));
      const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / 3);
      assert.ok(actual.length() > 1e-9, `${dice}: triângulo degenerado`);
      assert.ok(actual.dot(center) > 0, `${dice}: face invertida`);
      assert.ok(actual.normalize().dot(normal) > .999999, `${dice}: normal incorreta`);
      for (let corner = 0; corner < 3; corner++) {
        const a = points[corner].toArray().map((value) => value.toFixed(7)).join(',');
        const b = points[(corner + 1) % 3].toArray().map((value) => value.toFixed(7)).join(',');
        const key = [a, b].sort().join('|');
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    for (const uses of edges.values()) assert.equal(uses, 2, `${dice}: aresta aberta`);
    geometry.dispose();
  }
});

test('cada resultado do D20 termina voltado e alinhado para a câmera', () => {
  const shape = createDieShape('d20');
  const frames = new Map(shape.faces.map((face) => {
    const points = face.vertices.map((index) => new THREE.Vector3(...shape.vertices[index]));
    return [face.label, faceFrame(points).quaternion];
  }));
  const camera = new THREE.OrthographicCamera(-5, 5, 4, -4, .1, 100);
  camera.position.set(0, 13, 7);
  camera.lookAt(0, 0, 0);
  const towardCamera = camera.position.clone().normalize();
  const screenUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  for (const face of shape.faces) {
    const points = face.vertices.map((index) => new THREE.Vector3(...shape.vertices[index]));
    const frame = faceFrame(points);
    const rotation = finalRotation(frames, face.label, camera.quaternion);
    assert.ok(frame.normal.clone().applyQuaternion(rotation).dot(towardCamera) > .999999, face.label);
    assert.ok(frame.up.clone().applyQuaternion(rotation).dot(screenUp) > .999999, face.label);
  }
});

test('movimento termina estável entre um e meio e dois e meio segundos', () => {
  assert.ok(ROLL_DURATION >= 1600 && ROLL_DURATION <= 2200);
  const body = { x: 2.5, y: .4, z: -.6, vx: .7, vz: -.3, xLimit: 4, zLimit: 1.5 };
  assert.deepEqual(settlePhysicalMotion(body, 0), { x: 2.5, y: .4, z: -.6 });
  const end = settlePhysicalMotion(body, 1);
  assert.equal(end.y, 0);
  assert.ok(end.x > 2.5 && end.x < 4);
  assert.ok(end.z < -.6 && end.z > -1.5);
  const profile = createSpinProfile(() => .7);
  const fast = spinAt(.1, profile);
  const slow = spinAt(.8, profile);
  assert.ok(Math.hypot(fast.x, fast.y, fast.z) > Math.hypot(slow.x, slow.y, slow.z) * 5);
  assert.ok(fast.blur > slow.blur);
  assert.deepEqual(spinAt(1, profile), { x: 0, y: 0, z: 0, blur: 0 });
});

test('lançamento físico percorre o painel, quica e permanece dentro das bordas', () => {
  const options = { baseX: 0, baseZ: 0, halfWidth: 5.5, halfDepth: 1.8, radius: .9, index: 0, total: 1 };
  const first = createPhysicalMotion(options, () => .4);
  const second = createPhysicalMotion(options, () => .8);
  assert.notEqual(first.x, second.x);
  let minimumX = first.x;
  let maximumX = first.x;
  for (let step = 0; step < Math.round(ROLL_DURATION * PHYSICAL_PHASE / 1000 * 120); step++) {
    stepPhysicalMotion(first, 1 / 120);
    minimumX = Math.min(minimumX, first.x);
    maximumX = Math.max(maximumX, first.x);
    assert.ok(Math.abs(first.x) <= first.xLimit + 1e-8);
    assert.ok(Math.abs(first.z) <= first.zLimit + 1e-8);
    assert.ok(first.y >= 0);
  }
  assert.ok(maximumX - minimumX > 4);
  assert.ok(first.floorHits >= 1);
  assert.ok(first.wallHits >= 1);
});

test('dados próximos colidem e se separam', () => {
  const options = { baseX: 0, baseZ: 0, halfWidth: 5, halfDepth: 2, radius: .7, index: 0, total: 2 };
  const first = createPhysicalMotion(options, () => .4);
  const second = createPhysicalMotion({ ...options, index: 1 }, () => .6);
  first.x = 0;
  second.x = .2;
  first.z = second.z = 0;
  first.y = second.y = 0;
  first.vx = 2;
  second.vx = -2;
  resolvePhysicalCollisions([first, second]);
  assert.ok(second.x - first.x >= (first.radius + second.radius) * .77 - 1e-8);
  assert.ok(first.vx < 2);
  assert.ok(second.vx > -2);
});
