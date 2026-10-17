import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { parse as parseOpenType } from 'three/addons/libs/opentype.module.js';
import { createD20Shape } from '../src/die-shapes.mjs';
import { scuffedD20Surface, scuffedD20Numbers, numeralShapes } from '../src/scuffed-d20.mjs';

test('estrutura metálica e painéis rebaixados formam um D20 fechado', () => {
  const shape = createD20Shape();
  const geometry = scuffedD20Surface(shape);
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const edges = new Map();
  assert.equal(geometry.groups.length, 4);
  assert.equal(geometry.groups[0].count, 60);
  for (let index = 0; index < positions.count; index += 3) {
    const points = [0, 1, 2].map((offset) => new THREE.Vector3().fromBufferAttribute(positions, index + offset));
    const normal = new THREE.Vector3().fromBufferAttribute(normals, index);
    const actual = new THREE.Vector3().crossVectors(points[1].clone().sub(points[0]), points[2].clone().sub(points[0]));
    assert.ok(actual.length() > 1e-9);
    assert.ok(actual.normalize().dot(normal) > .999999);
    for (let corner = 0; corner < 3; corner++) {
      const a = points[corner].toArray().map((value) => value.toFixed(6)).join(',');
      const b = points[(corner + 1) % 3].toArray().map((value) => value.toFixed(6)).join(',');
      const key = [a, b].sort().join('|');
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  for (const uses of edges.values()) assert.equal(uses, 2);
  const face = shape.faces[0];
  const points = face.vertices.map((index) => new THREE.Vector3(...shape.vertices[index]));
  const normal = new THREE.Vector3().crossVectors(points[1].clone().sub(points[0]), points[2].clone().sub(points[0])).normalize();
  const edgeLength = points[0].distanceTo(points[1]);
  const panel = new THREE.Vector3().fromBufferAttribute(positions, 0);
  assert.ok(Math.abs(panel.clone().sub(points[0]).dot(normal) + edgeLength * .02) < 1e-6);
  geometry.dispose();
});

test('números Cinzel Bold são geometria extrudada sobre o painel', () => {
  const binary = readFileSync(new URL('../assets/fonts/Cinzel-Bold.ttf', import.meta.url));
  const font = parseOpenType(binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength));
  assert.equal(font.tables.os2.usWeightClass, 700);
  for (let value = 1; value <= 20; value++) assert.ok(numeralShapes(font, value).length >= String(value).length, `contorno incompleto no ${value}`);
  const shape = createD20Shape();
  const geometry = scuffedD20Numbers(shape, font);
  assert.ok(geometry.getAttribute('position').count > 1000);
  assert.equal(geometry.getAttribute('position').count, geometry.getAttribute('color').count);
  assert.equal(geometry.userData.faceRanges.length, 20);
  const normal = geometry.getAttribute('normal');
  assert.ok(Array.from({ length: normal.count }, (_, index) => normal.getZ(index)).some((value) => Math.abs(value) < .9));
  const positions = geometry.getAttribute('position');
  for (const range of geometry.userData.faceRanges) {
    const face = shape.faces.find((item) => item.label === range.label);
    const corners = face.vertices.map((index) => new THREE.Vector3(...shape.vertices[index]));
    const center = corners.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / 3);
    const edgeLength = corners[0].distanceTo(corners[1]);
    const inset = .08 * edgeLength / (edgeLength * Math.sqrt(3) / 6);
    const [a, b, c] = corners.map((point) => point.lerp(center, inset));
    const ab = b.clone().sub(a);
    const ac = c.clone().sub(a);
    const faceNormal = new THREE.Vector3().crossVectors(ab, ac).normalize();
    const aa = ab.dot(ab);
    const bb = ab.dot(ac);
    const cc = ac.dot(ac);
    const denominator = aa * cc - bb * bb;
    let lowest = Infinity;
    let highest = -Infinity;
    for (let index = range.start; index < range.start + range.count; index++) {
      const point = new THREE.Vector3().fromBufferAttribute(positions, index).sub(a);
      const elevation = point.dot(faceNormal);
      lowest = Math.min(lowest, elevation);
      highest = Math.max(highest, elevation);
      const d = point.dot(ab);
      const e = point.dot(ac);
      const u = (cc * d - bb * e) / denominator;
      const v = (aa * e - bb * d) / denominator;
      assert.ok(Math.min(u, v, 1 - u - v) > .01, `número ${range.label} atravessa a moldura`);
    }
    assert.ok((highest - lowest) / edgeLength >= .008 && (highest - lowest) / edgeLength <= .012, `extrusão incorreta no número ${range.label}`);
  }
  geometry.dispose();
});
