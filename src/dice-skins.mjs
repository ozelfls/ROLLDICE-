import * as THREE from 'three';

export const SKINS = Object.freeze({
  classic: Object.freeze({
    label: 'Clássico',
    accent: '#e2b969',
    colors: [0xffe5b0, 0xffd489, 0xf9c774, 0xffe9bf],
    edge: 0x8c5c41,
    number: '#31251e',
    roughness: .42,
    metalness: .04,
    clearcoat: .08,
    clearcoatRoughness: .4,
    emissive: 0x000000,
    emissiveIntensity: 0,
    rim: 0x8de9d6,
  }),
  scuffed: Object.freeze({
    label: 'Scuffed Metal',
    accent: '#aba7bd',
    colors: [0xaaa6b3, 0x89899d, 0xb3afbc, 0x9591a9],
    edge: 0x555365,
    number: '#f1eff5',
    roughness: .58,
    metalness: .72,
    clearcoat: .13,
    clearcoatRoughness: .56,
    emissive: 0x17111f,
    emissiveIntensity: .08,
    rim: 0xd1c8e8,
  }),
  behir: Object.freeze({
    label: 'Behir Blue',
    accent: '#398aff',
    colors: [0x1260d0, 0x123caa, 0x2583e8, 0x194eb8],
    edge: 0x6fcfff,
    number: '#f1fbff',
    roughness: .18,
    metalness: .12,
    clearcoat: 1,
    clearcoatRoughness: .08,
    emissive: 0x092c74,
    emissiveIntensity: .2,
    rim: 0x75d9ff,
  }),
  dragonflame: Object.freeze({
    label: 'Dragonflame Red',
    accent: '#d34b40',
    colors: [0xa70d22, 0x82091b, 0xb41429, 0x970d20],
    edge: 0xeabd67,
    number: '#ffe2a1',
    roughness: .18,
    metalness: .08,
    clearcoat: .72,
    clearcoatRoughness: .14,
    emissive: 0x430006,
    emissiveIntensity: .055,
    rim: 0xffc181,
  }),
});

const labelCache = new Map();
let scuffTexture;

function brushedTexture() {
  if (scuffTexture) return scuffTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, 256, 256);
  let seed = 17489;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let index = 0; index < 850; index++) {
    const x = random() * 256;
    const y = random() * 256;
    const length = 12 + random() * 65;
    context.strokeStyle = random() > .34 ? 'rgba(53,42,68,.075)' : 'rgba(255,255,255,.38)';
    context.lineWidth = random() > .82 ? 1.5 : .55;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + length, y - length * .09);
    context.stroke();
  }
  for (let index = 0; index < 90; index++) {
    context.fillStyle = 'rgba(62,47,72,.09)';
    context.fillRect(random() * 256, random() * 256, 1 + random() * 3, 1 + random() * 2);
  }
  scuffTexture = new THREE.CanvasTexture(canvas);
  scuffTexture.colorSpace = THREE.SRGBColorSpace;
  return scuffTexture;
}

export function numberTexture(value, skin) {
  const color = SKINS[skin].number;
  const key = `${value}:${color}`;
  if (labelCache.has(key)) return labelCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  const dragon = skin === 'dragonflame';
  const size = String(value).length > 2 ? 224 : 290;
  context.font = `900 ${size}px system-ui`;
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  context.lineJoin = 'round';
  const metrics = context.measureText(String(value));
  const baseline = (512 + metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
  if (dragon) {
    context.strokeStyle = '#5f2310';
    context.lineWidth = 13;
    context.strokeText(String(value), 256, baseline);
    const gold = context.createLinearGradient(0, baseline - size * .5, 0, baseline + size * .35);
    gold.addColorStop(0, '#fff5c9');
    gold.addColorStop(.42, color);
    gold.addColorStop(1, '#b87930');
    context.fillStyle = gold;
  } else context.fillStyle = color;
  context.fillText(String(value), 256, baseline);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  labelCache.set(key, texture);
  return texture;
}

export function faceMaterial(skin, index) {
  const style = SKINS[skin];
  return new THREE.MeshPhysicalMaterial({
    color: style.colors[index % style.colors.length],
    map: skin === 'scuffed' ? brushedTexture() : null,
    roughness: style.roughness,
    metalness: style.metalness,
    clearcoat: style.clearcoat,
    clearcoatRoughness: style.clearcoatRoughness,
    envMapIntensity: skin === 'dragonflame' ? .85 : 0,
    emissive: style.emissive,
    emissiveIntensity: style.emissiveIntensity,
    side: THREE.FrontSide,
    flatShading: true,
  });
}

export function edgeMaterial(skin) {
  return new THREE.LineBasicMaterial({ color: SKINS[skin].edge, transparent: true, opacity: skin === 'dragonflame' ? .94 : .72 });
}
