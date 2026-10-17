import * as THREE from 'three';

let textures;

function canvas(size, color) {
  const surface = document.createElement('canvas');
  surface.width = size;
  surface.height = size;
  const context = surface.getContext('2d');
  context.fillStyle = color;
  context.fillRect(0, 0, size, size);
  return { surface, context };
}

function texture(surface, color = false) {
  const map = new THREE.CanvasTexture(surface);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  if (color) map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function getMaps() {
  if (textures) return textures;
  const frame = canvas(256, 'rgb(118, 114, 108)');
  const wall = canvas(256, 'rgb(78, 76, 73)');
  const bevel = canvas(256, 'rgb(118, 114, 108)');
  const roughness = canvas(256, 'rgb(215, 215, 215)');
  const bump = canvas(256, 'rgb(128, 128, 128)');
  const bevelRoughness = canvas(256, 'rgb(205, 205, 205)');
  const bevelBump = canvas(256, 'rgb(128, 128, 128)');
  let seed = 21791;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const wallShade = wall.context.createLinearGradient(0, 0, 0, 256);
  wallShade.addColorStop(0, 'rgba(78, 76, 73, 0)');
  wallShade.addColorStop(.65, 'rgba(39, 38, 37, .28)');
  wallShade.addColorStop(1, 'rgba(24, 24, 24, .65)');
  wall.context.fillStyle = wallShade;
  wall.context.fillRect(0, 0, 256, 256);
  for (let stroke = 0; stroke < 560; stroke++) {
    const x = random() * 256;
    const y = random() * 256;
    const length = 3 + random() ** 1.6 * 47;
    const angle = (random() - .5) * (stroke % 7 === 0 ? 1.2 : .25);
    const width = .25 + random() * .7;
    const light = random() > .55;
    for (const [context, pigment] of [
      [frame.context, light ? 'rgba(186, 180, 170, .12)' : 'rgba(78, 76, 73, .18)'],
      [wall.context, light ? 'rgba(186, 180, 170, .04)' : 'rgba(38, 37, 36, .1)'],
      [bevel.context, light ? 'rgba(220, 214, 203, .23)' : 'rgba(78, 76, 73, .11)'],
      [roughness.context, light ? 'rgba(110, 110, 110, .34)' : 'rgba(245, 245, 245, .24)'],
      [bump.context, light ? 'rgba(170, 170, 170, .26)' : 'rgba(84, 84, 84, .24)'],
      [bevelRoughness.context, light ? 'rgba(90, 90, 90, .37)' : 'rgba(245, 245, 245, .2)'],
      [bevelBump.context, light ? 'rgba(179, 179, 179, .31)' : 'rgba(78, 78, 78, .25)'],
    ]) {
      context.strokeStyle = pigment;
      context.lineWidth = width;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + length, y + length * angle);
      context.stroke();
    }
  }
  for (let mark = 0; mark < 180; mark++) {
    const x = random() * 256;
    const y = random() * 256;
    const length = 2 + random() * 12;
    const angle = (random() - .5) * 1.8;
    const bright = random() > .36;
    bevel.context.strokeStyle = bright ? 'rgba(220, 214, 203, .16)' : 'rgba(78, 76, 73, .12)';
    bevel.context.lineWidth = .25 + random() * .45;
    bevel.context.beginPath();
    bevel.context.moveTo(x, y);
    bevel.context.lineTo(x + length, y + length * angle);
    bevel.context.stroke();
    bevelRoughness.context.strokeStyle = bright ? 'rgba(95, 95, 95, .26)' : 'rgba(244, 244, 244, .16)';
    bevelRoughness.context.lineWidth = .35;
    bevelRoughness.context.beginPath();
    bevelRoughness.context.moveTo(x, y);
    bevelRoughness.context.lineTo(x + length, y + length * angle);
    bevelRoughness.context.stroke();
  }
  for (let mark = 0; mark < 94; mark++) {
    const x = random() * 256;
    const y = random() > .5 ? random() * 4 : 252 + random() * 4;
    const length = 1.5 + random() * 9;
    bevel.context.strokeStyle = 'rgba(220, 214, 203, .2)';
    bevel.context.lineWidth = .3 + random() * .5;
    bevel.context.beginPath();
    bevel.context.moveTo(x, y);
    bevel.context.lineTo(x + length, y + (random() - .5) * 1.5);
    bevel.context.stroke();
    bevelRoughness.context.strokeStyle = 'rgba(96, 96, 96, .2)';
    bevelRoughness.context.lineWidth = .5;
    bevelRoughness.context.beginPath();
    bevelRoughness.context.moveTo(x, y);
    bevelRoughness.context.lineTo(x + length, y);
    bevelRoughness.context.stroke();
  }
  const panel = canvas(256, 'rgb(24, 24, 24)');
  const panelRoughness = canvas(256, 'rgb(249, 249, 249)');
  const panelBump = canvas(256, 'rgb(128, 128, 128)');
  for (let fleck = 0; fleck < 4600; fleck++) {
    const x = random() * 256;
    const y = random() * 256;
    const radius = .25 + random() * .9;
    panel.context.fillStyle = random() > .82 ? 'rgba(52, 52, 52, .2)' : 'rgba(34, 34, 34, .28)';
    panel.context.fillRect(x, y, radius, radius);
    panelRoughness.context.fillStyle = 'rgba(180, 180, 180, .14)';
    panelRoughness.context.fillRect(x, y, radius, radius);
    panelBump.context.fillStyle = random() > .5 ? 'rgba(151, 151, 151, .25)' : 'rgba(102, 102, 102, .25)';
    panelBump.context.fillRect(x, y, radius, radius);
  }
  textures = {
    frame: texture(frame.surface, true),
    wall: texture(wall.surface, true),
    bevel: texture(bevel.surface, true),
    metalRoughness: texture(roughness.surface),
    metalBump: texture(bump.surface),
    bevelRoughness: texture(bevelRoughness.surface),
    bevelBump: texture(bevelBump.surface),
    panel: texture(panel.surface, true),
    panelRoughness: texture(panelRoughness.surface),
    panelBump: texture(panelBump.surface),
  };
  return textures;
}

export function scuffedD20Materials() {
  const maps = getMaps();
  const metal = (map, envMapIntensity, exposed = false) => new THREE.MeshPhysicalMaterial({
    map,
    roughnessMap: exposed ? maps.bevelRoughness : maps.metalRoughness,
    bumpMap: exposed ? maps.bevelBump : maps.metalBump,
    bumpScale: exposed ? .011 : .008,
    metalness: .9,
    roughness: exposed ? .53 : .58,
    anisotropy: exposed ? .62 : .55,
    clearcoat: 0,
    envMapIntensity,
    side: THREE.FrontSide,
    depthTest: true,
    depthWrite: true,
  });
  const panel = new THREE.MeshPhysicalMaterial({
      map: maps.panel,
      roughnessMap: maps.panelRoughness,
      bumpMap: maps.panelBump,
      bumpScale: .006,
      roughness: .94,
      metalness: .18,
      envMapIntensity: .16,
      side: THREE.FrontSide,
      depthTest: true,
      depthWrite: true,
    });
  panel.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 panelBarycentric;\nvarying vec3 vPanelBarycentric;');
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvPanelBarycentric = panelBarycentric;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPanelBarycentric;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\nfloat panelEdge = min(vPanelBarycentric.x, min(vPanelBarycentric.y, vPanelBarycentric.z));\ndiffuseColor.rgb *= mix(0.58, 1.05, smoothstep(0.006, 0.115, panelEdge));');
  };
  return [
    panel,
    metal(maps.frame, .72),
    metal(maps.wall, .16),
    metal(maps.bevel, 1.08, true),
  ];
}

export function scuffedNumberMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    metalness: .87,
    roughness: .44,
    envMapIntensity: .88,
    side: THREE.FrontSide,
    depthTest: true,
    depthWrite: true,
  });
}
