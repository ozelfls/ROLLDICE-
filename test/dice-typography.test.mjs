import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse as parseOpenType } from 'three/addons/libs/opentype.module.js';
import { DICE_TYPOGRAPHY, numeralCanvasFont } from '../src/dice-typography.mjs';

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
  }
  assert.equal(outlines.size, 3);
  assert.equal(DICE_TYPOGRAPHY.dragonflame.family, 'Trajan Pro Bold');
  assert.deepEqual(DICE_TYPOGRAPHY.dragonflame.fallback, ['Palatino Linotype', 'Times New Roman']);
});
