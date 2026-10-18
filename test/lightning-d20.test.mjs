import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { parse as parseOpenType } from 'three/addons/libs/opentype.module.js';
import { createD20Shape } from '../src/die-shapes.mjs';
import { numeralShapes } from '../src/scuffed-d20.mjs';
import { lightningD20Surface, lightningD20Material, lightningD20Planes, lightningD20Graph, lightningD20Pulse, lightningD20Volume, lightningD20Veins, lightningD20VeinMaterials, lightningD20Numbers, lightningD20NumberMaterials } from '../src/lightning-d20.mjs';

test('Lightning Storm monta o D20 translúcido com veios internos e números escuros', () => {
  const binary = readFileSync(new URL('../assets/fonts/Rajdhani-Bold.ttf', import.meta.url));
  const font = parseOpenType(binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength));
  assert.equal(font.names.fontFamily.en, 'Rajdhani');
  const shape = createD20Shape();
  const shell = lightningD20Surface(shape);
  const pulse = lightningD20Pulse();
  const shellMaterial = lightningD20Material(shape, pulse);
  const veins = lightningD20Veins();
  const veinMaterials = lightningD20VeinMaterials(shape, pulse);
  const numbers = lightningD20Numbers(shape, font);
  const zero = numeralShapes(font, '0', false)[0];
  assert.equal(zero.holes.length, 1);
  assert.ok(Math.abs(THREE.ShapeUtils.area(zero.getPoints(12))) > Math.abs(THREE.ShapeUtils.area(zero.holes[0].getPoints(12))));
  const numberMaterials = lightningD20NumberMaterials(shape);
  assert.ok(shell.getAttribute('position').count > 0);
  assert.ok(shellMaterial.transmission >= .45);
  assert.equal(shellMaterial.metalness, 0);
  assert.equal(veins.length, 3);
  assert.ok(veins.every((geometry) => geometry.getAttribute('position').count > 0));
  const graph = lightningD20Graph();
  assert.equal(graph.filter((channel) => channel.tier === 0).length, 4);
  assert.equal(graph.filter((channel) => channel.tier === 1).length, 16);
  assert.equal(graph.filter((channel) => channel.tier === 2).length, 32);
  const planes = lightningD20Planes(shape);
  assert.ok(graph.every((channel) => channel.points.every((point) => planes.every((plane) => point.dot(plane) < plane.w))));
  const volume = lightningD20Volume();
  assert.equal(volume.image.depth, 96);
  const occupiedSlices = new Set();
  for (let z = 0; z < volume.image.depth; z++) {
    const start = z * volume.image.width * volume.image.height * 4;
    if (volume.image.data.subarray(start, start + volume.image.width * volume.image.height * 4).some((value, index) => index % 4 === 0 && value > 100)) occupiedSlices.add(z);
  }
  assert.ok(occupiedSlices.size > 15);
  assert.equal(veinMaterials.length, 3);
  assert.equal(numbers.paintGeometry.userData.faceRanges.length, 20);
  assert.equal(numberMaterials.paint.color.getHex(), 0x231909);
  for (const resource of [shell, shellMaterial, ...veins, ...veinMaterials, numbers.grooveGeometry, numbers.paintGeometry, ...Object.values(numberMaterials)]) resource.dispose();
});
