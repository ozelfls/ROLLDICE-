import test from 'node:test';
import assert from 'node:assert/strict';
import { createD20Shape } from '../src/die-shapes.mjs';
import { motionAt, ROLL_DURATION } from '../src/dice-motion.mjs';

const subtract = (a, b) => a.map((value, index) => value - b[index]);
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

test('D20 tem vinte faces numeradas e convexas', () => {
  const shape = createD20Shape();
  assert.equal(shape.faces.length, 20);
  assert.deepEqual(shape.faces.map((face) => face.label).sort((a, b) => a - b), Array.from({ length: 20 }, (_, index) => index + 1));
  for (const face of shape.faces) {
    const [a, b, c] = face.vertices.map((index) => shape.vertices[index]);
    const normal = cross(subtract(b, a), subtract(c, a));
    assert.ok(dot(normal, a) > 0);
    for (const vertex of shape.vertices) assert.ok(dot(normal, subtract(vertex, a)) <= 1e-6);
    const opposite = shape.faces.find((candidate) => candidate.label === 21 - face.label);
    const [x, y, z] = opposite.vertices.map((index) => shape.vertices[index]);
    const other = cross(subtract(y, x), subtract(z, x));
    assert.ok(dot(normal, other) < -dot(normal, normal) * .999);
  }
});

test('movimento do D20 termina estável em pouco mais de dois segundos', () => {
  assert.ok(ROLL_DURATION >= 1500 && ROLL_DURATION <= 2500);
  assert.equal(motionAt(1, 0).spin, 0);
  assert.equal(motionAt(1, 0).y, 0);
  assert.ok(motionAt(.3, 0).spin > motionAt(.9, 0).spin);
});
