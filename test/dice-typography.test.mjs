import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { parse as parseOpenType } from 'three/addons/libs/opentype.module.js';
import { DICE_TYPOGRAPHY, numeralCanvasFont } from '../src/dice-typography.mjs';
import { numeralShapes } from '../src/scuffed-d20.mjs';

test('as skins usam famílias de números distintas e os assets locais corretos', () => {
  const cases = [
    ['classic', 'Rajdhani-Bold.ttf', 'Rajdhani'],
    ['scuffed', 'Cinzel-Bold.ttf', 'Cinzel'],
    ['behir', 'Caudex-Bold.ttf', 'Caudex'],
  ];
  const outlines = new Set();
  for (const [skin, filename, family] of cases) {
    const bytes = readFileSync(new URL(`../assets/fonts/${filename}`, import.meta.url));
    const font = parseOpenType(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    assert.equal(font.names.fontFamily.en, family);
    assert.match(numeralCanvasFont(skin, 120), new RegExp(DICE_TYPOGRAPHY[skin].family));
    outlines.add(JSON.stringify(font.getPath('20', 0, 0, 1).commands));
    if (skin === 'behir') {
      for (const [digit, holes] of [['0', 1], ['6', 1], ['8', 2], ['9', 1]]) {
        const shapes = numeralShapes(font, digit, 'nested');
        assert.equal(shapes.length, 1, `Contorno de ${digit}`);
        assert.equal(shapes[0].holes.length, holes, `Furos de ${digit}`);
        const outerArea = Math.abs(THREE.ShapeUtils.area(shapes[0].getPoints(12)));
        assert.ok(shapes[0].holes.every((hole) => outerArea > Math.abs(THREE.ShapeUtils.area(hole.getPoints(12)))), `Área de ${digit}`);
      }
    }
  }
  assert.equal(outlines.size, 3);
  assert.equal(DICE_TYPOGRAPHY.dragonflame.family, 'Trajan Pro Bold');
  assert.deepEqual(DICE_TYPOGRAPHY.dragonflame.fallback, ['Palatino Linotype', 'Times New Roman']);
});
