import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { parse as parseOpenType } from 'three/addons/libs/opentype.module.js';
import { createD20Shape } from '../src/die-shapes.mjs';
import { dragonD20Surface, dragonD20Material, dragonD20Numbers } from '../src/dragon-d20.mjs';

test('a casca rubi é fechada, chanfrada e possui transmissão física', () => {
  const geometry = dragonD20Surface(createD20Shape());
  const positions = geometry.getAttribute('position');
  const edges = new Map();
  for (let index = 0; index < positions.count; index += 3) {
    const points = [0, 1, 2].map((offset) => new THREE.Vector3().fromBufferAttribute(positions, index + offset));
    for (let side = 0; side < 3; side++) {
      const a = points[side].toArray().map((value) => value.toFixed(6)).join(',');
      const b = points[(side + 1) % 3].toArray().map((value) => value.toFixed(6)).join(',');
      const edge = [a, b].sort().join('|');
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  assert.ok([...edges.values()].every((uses) => uses === 2));
  const material = dragonD20Material();
  assert.ok(material.transmission > .5);
  assert.equal(material.metalness, 0);
  assert.equal(material.depthWrite, true);
  geometry.dispose();
  material.dispose();
});

test('as vinte faces preservam números dourados dentro dos triângulos', () => {
  const binary = readFileSync(new URL('../assets/fonts/Cinzel-Bold.ttf', import.meta.url));
  const font = parseOpenType(binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength));
  const shape = createD20Shape();
  const { grooveGeometry, goldGeometry } = dragonD20Numbers(shape, font);
  assert.equal(goldGeometry.userData.faceRanges.length, 20);
  const positions = goldGeometry.getAttribute('position');
  assert.equal(positions.count, goldGeometry.getAttribute('color').count);
  for (const range of goldGeometry.userData.faceRanges) {
    const face = shape.faces.find((item) => item.label === range.label);
    const corners = face.vertices.map((index) => new THREE.Vector3(...shape.vertices[index]));
    const center = corners.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / 3);
    const [a, b, c] = corners.map((point) => point.lerp(center, .07));
    const ab = b.clone().sub(a);
    const ac = c.clone().sub(a);
    const aa = ab.dot(ab);
    const bb = ab.dot(ac);
    const cc = ac.dot(ac);
    const denominator = aa * cc - bb * bb;
    for (let index = range.goldStart; index < range.goldStart + range.goldCount; index++) {
      const point = new THREE.Vector3().fromBufferAttribute(positions, index).sub(a);
      const d = point.dot(ab);
      const e = point.dot(ac);
      const u = (cc * d - bb * e) / denominator;
      const v = (aa * e - bb * d) / denominator;
      assert.ok(Math.min(u, v, 1 - u - v) > .005, `número ${range.label} ultrapassa a face`);
    }
  }
  grooveGeometry.dispose();
  goldGeometry.dispose();
});
