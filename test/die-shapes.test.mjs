import test from 'node:test';
import assert from 'node:assert/strict';
import { createDieShape } from '../src/die-shapes.mjs';
import { createPhysicalMotion, stepPhysicalMotion, resolvePhysicalCollisions, settlePhysicalMotion, PHYSICAL_PHASE, ROLL_DURATION } from '../src/dice-motion.mjs';

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

test('movimento termina estável entre um e meio e dois e meio segundos', () => {
  assert.ok(ROLL_DURATION >= 1500 && ROLL_DURATION <= 2500);
  const body = { x: 2.5, y: .4, z: -.6, vx: .7, vz: -.3, xLimit: 4, zLimit: 1.5 };
  assert.deepEqual(settlePhysicalMotion(body, 0), { x: 2.5, y: .4, z: -.6, rotation: 0 });
  const end = settlePhysicalMotion(body, 1);
  assert.equal(end.y, 0);
  assert.equal(end.rotation, 1);
  assert.ok(end.x > 2.5 && end.x < 4);
  assert.ok(end.z < -.6 && end.z > -1.5);
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
