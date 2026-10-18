import * as THREE from 'three';
import { parse as parseOpenType } from 'three/addons/libs/opentype.module.js';
import { loadScuffedFont } from './scuffed-d20.mjs';
import { loadLightningFont } from './lightning-d20.mjs';

export const DICE_TYPOGRAPHY = Object.freeze({
  classic: Object.freeze({ family: 'Rajdhani Bold', weight: 700, fallback: ['Oxanium Bold', 'Exo 2 ExtraBold'], number: '#231909', recess: '#0e0a04', highlight: '#946a1b', size: 1 }),
  scuffed: Object.freeze({ family: 'Cinzel Bold', weight: 700, fallback: ['Cormorant Garamond SemiBold', 'Georgia'], number: '#e8eaf0', recess: '#4e505c', highlight: '#f5f6fa', size: 1 }),
  behir: Object.freeze({ family: 'Caudex Bold', weight: 700, fallback: ['Bookman Old Style', 'Cambria'], number: '#f4f4f6', recess: '#344260', highlight: '#aaafbc', size: 1 }),
  dragonflame: Object.freeze({ family: 'Trajan Pro Bold', weight: 700, fallback: ['Palatino Linotype', 'Times New Roman'], number: '#e0aa46', recess: '#9c6c21', highlight: '#ffd770', size: 1 }),
});

export function numeralCanvasFont(skin, pixels) {
  const style = DICE_TYPOGRAPHY[skin];
  return `${style.weight} ${Math.round(pixels * style.size)}px ${[style.family, ...style.fallback].map((family) => `"${family}"`).join(', ')}`;
}

async function loadLocalFont(filename) {
  const loader = new THREE.FileLoader();
  loader.setResponseType('arraybuffer');
  return parseOpenType(await loader.loadAsync(new URL(`../assets/fonts/${filename}`, document.baseURI).href));
}

async function loadDragonFont() {
  if (!window.diceFonts?.loadDragonFont) throw new Error('Fonte Dragonflame indisponível.');
  const asset = await window.diceFonts.loadDragonFont();
  if (!asset?.data) throw new Error('Fonte Dragonflame indisponível.');
  const bytes = new Uint8Array(asset.data);
  const font = parseOpenType(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  if (asset.family === 'Trajan Pro Bold') {
    const face = new FontFace('Trajan Pro Bold', bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), { weight: '700' });
    await face.load();
    document.fonts.add(face);
  }
  font.diceFamily = asset.family;
  return font;
}

export async function loadDieFonts() {
  const [scuffed, classic, behir, dragonflame] = await Promise.all([
    loadScuffedFont(),
    loadLightningFont(),
    loadLocalFont('Caudex-Bold.ttf'),
    loadDragonFont(),
  ]);
  return { scuffed, classic, behir, dragonflame };
}
