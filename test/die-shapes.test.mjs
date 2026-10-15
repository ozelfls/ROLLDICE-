import test from 'node:test';
import assert from 'node:assert/strict';
import { createDieShape } from '../src/die-shapes.mjs';
import { motionAt, ROLL_DURATION } from '../src/dice-motion.mjs';

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
  assert.deepEqual(motionAt(1, 0), { x: 0, y: 0, z: 0, spin: 0, settle: 1 });
  assert.ok(motionAt(.3, 0).spin > motionAt(.9, 0).spin);
});
