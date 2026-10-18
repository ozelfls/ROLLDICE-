import * as THREE from 'three';
import { DICE_TYPOGRAPHY, numeralCanvasFont } from './dice-typography.mjs';

export const SKINS = Object.freeze({
  classic: Object.freeze({
    label: 'Lightning Storm',
    accent: '#ffcf2b',
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
    accent: '#606576',
    colors: [0x606576, 0x484d5c, 0x343844],
    edge: 0xb2b6c2,
    number: '#e8ebf1',
    roughness: .6,
    metalness: .74,
    clearcoat: 0,
    clearcoatRoughness: .48,
    emissive: 0x000000,
    emissiveIntensity: 0,
    rim: 0xebe5da,
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
    accent: '#7a0a20',
    colors: [0x7a0a20, 0x5e0818],
    edge: 0xd4a84a,
    number: '#f5e8b9',
    roughness: .18,
    metalness: .02,
    clearcoat: .08,
    clearcoatRoughness: .22,
    emissive: 0x000000,
    emissiveIntensity: 0,
    rim: 0xffd6aa,
  }),
});

const labelCache = new Map();
const dragonFaceCache = new Map();
const scuffedFaceCache = new Map();
let scuffedEdgeMaps;

function scuffedFaceMaps(value, index, size = 256) {
  const key = `${value}:${index % 3}:${size}`;
  if (scuffedFaceCache.has(key)) return scuffedFaceCache.get(key);
  const canvas = document.createElement('canvas');
  const roughnessCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  for (const surface of [canvas, roughnessCanvas, bumpCanvas]) {
    surface.width = size;
    surface.height = size;
  }
  const context = canvas.getContext('2d');
  const roughness = roughnessCanvas.getContext('2d');
  const bump = bumpCanvas.getContext('2d');
  context.fillStyle = ['rgb(96, 101, 118)', 'rgb(72, 77, 92)', 'rgb(96, 101, 118)'][index % 3];
  context.fillRect(0, 0, size, size);
  const darkening = context.createLinearGradient(0, 0, size, size);
  darkening.addColorStop(0, 'rgba(144, 148, 164, .1)');
  darkening.addColorStop(.55, 'rgba(72, 77, 92, .08)');
  darkening.addColorStop(1, 'rgba(52, 56, 68, .23)');
  context.fillStyle = darkening;
  context.fillRect(0, 0, size, size);
  const recess = context.createRadialGradient(size / 2, size / 2, size * .18, size / 2, size / 2, size * .59);
  recess.addColorStop(0, 'rgba(52, 56, 68, 0)');
  recess.addColorStop(.76, 'rgba(52, 56, 68, .04)');
  recess.addColorStop(1, 'rgba(52, 56, 68, .24)');
  context.fillStyle = recess;
  context.fillRect(0, 0, size, size);
  roughness.fillStyle = 'rgb(220, 220, 220)';
  roughness.fillRect(0, 0, size, size);
  bump.fillStyle = 'rgb(128, 128, 128)';
  bump.fillRect(0, 0, size, size);
  const spacing = size / 38;
  for (let line = 0; line < 38; line++) {
    const y = line * spacing + Math.sin(line * 2.31 + index) * spacing * .22;
    const start = (line * 37 + index * 41) % Math.round(size * .23);
    const end = size - (line * 19 + index * 13) % Math.round(size * .18);
    const offset = Math.sin(line * 1.73) * size * .006;
    const draw = (surface, color, width) => {
      surface.strokeStyle = color;
      surface.lineWidth = width;
      surface.beginPath();
      surface.moveTo(start, y);
      surface.lineTo(end, y + offset);
      surface.stroke();
    };
    draw(roughness, line % 3 === 0 ? 'rgb(160, 160, 160)' : 'rgb(248, 248, 248)', line % 5 === 0 ? 10 : 6);
    draw(bump, line % 3 === 0 ? 'rgb(86, 86, 86)' : 'rgb(170, 170, 170)', line % 5 === 0 ? 12 : 7);
  }
  const digits = String(value).length;
  context.font = numeralCanvasFont('scuffed', size * (digits > 2 ? .18 : digits > 1 ? .23 : .28));
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  const metrics = context.measureText(String(value));
  const baseline = (size + metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
  context.lineJoin = 'round';
  context.strokeStyle = 'rgb(70, 74, 88)';
  context.lineWidth = size * .021;
  context.strokeText(String(value), size / 2, baseline);
  context.fillStyle = 'rgb(70, 74, 88)';
  context.fillText(String(value), size / 2 - size * .004, baseline - size * .006);
  context.fillStyle = 'rgb(232, 235, 241)';
  context.fillText(String(value), size / 2, baseline);
  roughness.fillStyle = 'rgb(244, 244, 244)';
  roughness.font = context.font;
  roughness.textAlign = 'center';
  roughness.textBaseline = 'alphabetic';
  roughness.fillText(String(value), size / 2, baseline);
  bump.fillStyle = 'rgb(70, 70, 70)';
  bump.font = context.font;
  bump.textAlign = 'center';
  bump.textBaseline = 'alphabetic';
  bump.fillText(String(value), size / 2, baseline);
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const normalContext = normalCanvas.getContext('2d');
  const heightData = bump.getImageData(0, 0, size, size).data;
  const normalData = normalContext.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4;
      const left = heightData[(y * size + Math.max(0, x - 1)) * 4];
      const right = heightData[(y * size + Math.min(size - 1, x + 1)) * 4];
      const above = heightData[(Math.max(0, y - 1) * size + x) * 4];
      const below = heightData[(Math.min(size - 1, y + 1) * size + x) * 4];
      const dx = (left - right) * .018;
      const dy = (above - below) * .018;
      const length = Math.hypot(dx, dy, 1);
      normalData.data[offset] = 128 + dx / length * 127;
      normalData.data[offset + 1] = 128 + dy / length * 127;
      normalData.data[offset + 2] = 128 + 1 / length * 127;
      normalData.data[offset + 3] = 255;
    }
  }
  normalContext.putImageData(normalData, 0, 0);
  const color = new THREE.CanvasTexture(canvas);
  color.colorSpace = THREE.SRGBColorSpace;
  const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
  const normalMap = new THREE.CanvasTexture(normalCanvas);
  const maps = { color, roughnessMap, normalMap };
  scuffedFaceCache.set(key, maps);
  return maps;
}

export function scuffedFaceMaterial(value, index, dice) {
  const maps = scuffedFaceMaps(value, index, dice === 'd100' ? 128 : 256);
  return new THREE.MeshPhysicalMaterial({
    map: maps.color,
    roughnessMap: maps.roughnessMap,
    normalMap: maps.normalMap,
    normalScale: new THREE.Vector2(.55, .55),
    roughness: SKINS.scuffed.roughness,
    metalness: SKINS.scuffed.metalness,
    anisotropy: .78,
    anisotropyRotation: 0,
    clearcoat: 0,
    envMapIntensity: .22,
    side: THREE.FrontSide,
    depthTest: true,
    depthWrite: true,
  });
}

function scuffedEdgeTextureMaps() {
  if (scuffedEdgeMaps) return scuffedEdgeMaps;
  const size = 256;
  const roughnessCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  for (const surface of [roughnessCanvas, bumpCanvas]) {
    surface.width = size;
    surface.height = size;
  }
  const roughness = roughnessCanvas.getContext('2d');
  const bump = bumpCanvas.getContext('2d');
  roughness.fillStyle = 'rgb(223, 223, 223)';
  roughness.fillRect(0, 0, size, size);
  bump.fillStyle = 'rgb(128, 128, 128)';
  bump.fillRect(0, 0, size, size);
  for (let line = 0; line < 48; line++) {
    const y = line * size / 48;
    roughness.strokeStyle = line % 4 === 0 ? 'rgb(245, 245, 245)' : 'rgb(192, 192, 192)';
    bump.strokeStyle = line % 4 === 0 ? 'rgb(146, 146, 146)' : 'rgb(112, 112, 112)';
    for (const surface of [roughness, bump]) {
      surface.lineWidth = line % 4 === 0 ? 1.2 : .7;
      surface.beginPath();
      surface.moveTo(0, y);
      surface.lineTo(size, y);
      surface.stroke();
    }
  }
  scuffedEdgeMaps = { roughnessMap: new THREE.CanvasTexture(roughnessCanvas), bumpMap: new THREE.CanvasTexture(bumpCanvas) };
  return scuffedEdgeMaps;
}

export function scuffedEdgeMaterial(color) {
  const maps = scuffedEdgeTextureMaps();
  return new THREE.MeshStandardMaterial({
    color,
    roughnessMap: maps.roughnessMap,
    bumpMap: maps.bumpMap,
    bumpScale: .008,
    metalness: .84,
    roughness: .48,
    envMapIntensity: .48,
    side: THREE.FrontSide,
    depthTest: true,
    depthWrite: true,
  });
}

export function dragonFaceTexture(value, size = 256) {
  const key = `${value}:${size}`;
  if (dragonFaceCache.has(key)) return dragonFaceCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const faceShade = context.createLinearGradient(0, 0, size, size);
  faceShade.addColorStop(0, 'rgb(122, 10, 32)');
  faceShade.addColorStop(1, 'rgb(94, 8, 24)');
  context.fillStyle = faceShade;
  context.fillRect(0, 0, size, size);
  const digits = String(value).length;
  context.font = numeralCanvasFont('dragonflame', size * (digits > 2 ? .18 : digits > 1 ? .23 : .28));
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  context.lineJoin = 'round';
  const metrics = context.measureText(String(value));
  const baseline = (size + metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
  context.shadowColor = 'rgb(156, 108, 33)';
  context.shadowBlur = size * .008;
  context.shadowOffsetY = size * .004;
  context.fillStyle = DICE_TYPOGRAPHY.dragonflame.number;
  context.fillText(String(value), size / 2, baseline);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  dragonFaceCache.set(key, texture);
  return texture;
}

export function dragonFaceMaterial(value, dice) {
  return new THREE.MeshPhysicalMaterial({
    map: dragonFaceTexture(value, dice === 'd100' ? 128 : 256),
    roughness: .18,
    metalness: .02,
    clearcoat: .08,
    clearcoatRoughness: .22,
    envMapIntensity: 0,
    specularIntensity: .12,
    side: THREE.FrontSide,
    depthTest: true,
    depthWrite: true,
  });
}

export function dragonGoldMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xd4a84a,
    metalness: .7,
    roughness: .25,
    envMapIntensity: .45,
    side: THREE.FrontSide,
    depthTest: true,
    depthWrite: true,
  });
}

export function numberTexture(value, skin) {
  const color = DICE_TYPOGRAPHY[skin].number;
  const key = `${skin}:${value}:${color}`;
  if (labelCache.has(key)) return labelCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = color;
  context.font = numeralCanvasFont(skin, String(value).length > 2 ? 112 : 145);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(value), 128, 135);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  labelCache.set(key, texture);
  return texture;
}

export function faceMaterial(skin, index) {
  const style = SKINS[skin];
  return new THREE.MeshPhysicalMaterial({
    color: style.colors[index % style.colors.length],
    map: null,
    roughness: style.roughness,
    metalness: style.metalness,
    clearcoat: style.clearcoat,
    clearcoatRoughness: style.clearcoatRoughness,
    ...(skin === 'dragonflame' ? { envMapIntensity: .85 } : {}),
    emissive: style.emissive,
    emissiveIntensity: style.emissiveIntensity,
    side: THREE.FrontSide,
    flatShading: true,
  });
}

export function edgeMaterial(skin) {
  return new THREE.LineBasicMaterial({ color: SKINS[skin].edge, transparent: true, opacity: skin === 'dragonflame' ? .94 : .72 });
}
