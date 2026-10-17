import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { parse as parseOpenType } from 'three/addons/libs/opentype.module.js';
import { createD20Shape } from '../src/die-shapes.mjs';
import { behirD20Surface, behirD20Numbers } from '../src/behir-d20.mjs';

test('a resina azul mantém uma malha fechada e chanfros orientados para fora', () => {
  const geometry = behirD20Surface(createD20Shape());
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const edges = new Map();
  assert.equal(geometry.groups.length, 0);
  for (let index = 0; index < positions.count; index += 3) {
    const triangle = [0, 1, 2].map((offset) => new THREE.Vector3().fromBufferAttribute(positions, index + offset));
    const normal = new THREE.Vector3().crossVectors(triangle[1].clone().sub(triangle[0]), triangle[2].clone().sub(triangle[0])).normalize();
    assert.ok(normal.dot(new THREE.Vector3().fromBufferAttribute(normals, index)) > .99999);
    for (let corner = 0; corner < 3; corner++) {
      const a = triangle[corner].toArray().map((value) => value.toFixed(6)).join(',');
      const b = triangle[(corner + 1) % 3].toArray().map((value) => value.toFixed(6)).join(',');
      const edge = [a, b].sort().join('|');
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  for (const uses of edges.values()) assert.equal(uses, 2);
  geometry.dispose();
});

test('os vinte números gravados permanecem dentro das faces do D20', () => {
  const binary = readFileSync(new URL('../assets/fonts/Cinzel-Bold.ttf', import.meta.url));
  const font = parseOpenType(binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength));
  const shape = createD20Shape();
  const { grooveGeometry, paintGeometry } = behirD20Numbers(shape, font);
  const groovePositions = grooveGeometry.getAttribute('position');
  const paintPositions = paintGeometry.getAttribute('position');
  assert.equal(grooveGeometry.userData.faceRanges.length, 20);
  assert.equal(paintPositions.count, paintGeometry.getAttribute('color').count);
  for (const range of grooveGeometry.userData.faceRanges) {
    const face = shape.faces.find((item) => item.label === range.label);
    const corners = face.vertices.map((index) => new THREE.Vector3(...shape.vertices[index]));
    const center = corners.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / 3);
    const [a, b, c] = corners.map((point) => point.lerp(center, .07));
    const ab = b.clone().sub(a);
    const ac = c.clone().sub(a);
    const normal = new THREE.Vector3().crossVectors(ab, ac).normalize();
    const aa = ab.dot(ab);
    const bb = ab.dot(ac);
    const cc = ac.dot(ac);
    const denominator = aa * cc - bb * bb;
    for (const [positions, start, count] of [[groovePositions, range.grooveStart, range.grooveCount], [paintPositions, range.paintStart, range.paintCount]]) {
      for (let index = start; index < start + count; index++) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, index).sub(a);
        const d = point.dot(ab);
        const e = point.dot(ac);
        const u = (cc * d - bb * e) / denominator;
        const v = (aa * e - bb * d) / denominator;
        assert.ok(Math.min(u, v, 1 - u - v) > .005, `número ${range.label} ultrapassa a face`);
        assert.ok(point.dot(normal) > 0, `número ${range.label} atravessa a resina`);
      }
    }
  }
  grooveGeometry.dispose();
  paintGeometry.dispose();
});
