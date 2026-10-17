import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { parse as parseOpenType } from 'three/addons/libs/opentype.module.js';

let fontPromise;

export function loadScuffedFont() {
  if (!fontPromise) {
    const loader = new THREE.FileLoader();
    loader.setResponseType('arraybuffer');
    fontPromise = loader.loadAsync(new URL('../assets/fonts/Cinzel-Bold.ttf', document.baseURI).href).then(parseOpenType);
  }
  return fontPromise;
}

function faceData(shape, face) {
  const vertices = face.vertices.map((index) => new THREE.Vector3(...shape.vertices[index]));
  const center = vertices.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / 3);
  const right = vertices[1].clone().sub(vertices[0]).normalize();
  const normal = new THREE.Vector3().crossVectors(vertices[1].clone().sub(vertices[0]), vertices[2].clone().sub(vertices[0])).normalize();
  const up = new THREE.Vector3().crossVectors(normal, right).normalize();
  const edgeLength = vertices[0].distanceTo(vertices[1]);
  const inradius = edgeLength * Math.sqrt(3) / 6;
  const outerInset = .015 * edgeLength / inradius;
  const innerInset = .08 * edgeLength / inradius;
  const outer = vertices.map((point) => point.clone().lerp(center, outerInset));
  const inner = vertices.map((point) => point.clone().lerp(center, innerInset));
  const bottom = inner.map((point) => point.clone().addScaledVector(normal, -.02 * edgeLength));
  return { vertices, center, right, up, normal, edgeLength, outer, inner, bottom };
}

export function scuffedD20Surface(shape) {
  if (shape.faces.length !== 20) throw new RangeError('A estrutura Scuffed Metal requer um D20.');
  const buckets = Array.from({ length: 4 }, () => ({ positions: [], normals: [], uvs: [], barycentrics: [] }));
  const addPolygon = (points, uv, materialIndex, outward = false) => {
    const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
    const normal = new THREE.Vector3().crossVectors(points[1].clone().sub(points[0]), points[2].clone().sub(points[0]));
    const vertices = outward && normal.dot(center) < 0 ? [...points].reverse() : points;
    const coordinates = outward && normal.dot(center) < 0 ? [...uv].reverse() : uv;
    const bucket = buckets[materialIndex];
    for (let corner = 1; corner < vertices.length - 1; corner++) {
      const triangle = [vertices[0], vertices[corner], vertices[corner + 1]];
      const texture = [coordinates[0], coordinates[corner], coordinates[corner + 1]];
      const faceNormal = new THREE.Vector3().crossVectors(triangle[1].clone().sub(triangle[0]), triangle[2].clone().sub(triangle[0])).normalize();
      for (let vertex = 0; vertex < 3; vertex++) {
        bucket.positions.push(...triangle[vertex]);
        bucket.normals.push(...faceNormal);
        bucket.uvs.push(...texture[vertex]);
        bucket.barycentrics.push(...(materialIndex === 0 ? [Number(vertex === 0), Number(vertex === 1), Number(vertex === 2)] : [0, 0, 0]));
      }
    }
  };
  const data = shape.faces.map((face) => faceData(shape, face));
  const edges = new Map();
  const cornersByVertex = shape.vertices.map(() => []);
  for (const [faceIndex, face] of shape.faces.entries()) {
    const surface = data[faceIndex];
    const uv = (point) => {
      const offset = point.clone().sub(surface.center);
      return [offset.dot(surface.right) / surface.edgeLength + faceIndex * .37, offset.dot(surface.up) / surface.edgeLength + faceIndex * .23];
    };
    addPolygon(surface.bottom, surface.bottom.map(uv), 0);
    for (let corner = 0; corner < 3; corner++) {
      const next = (corner + 1) % 3;
      addPolygon([surface.outer[corner], surface.outer[next], surface.inner[next], surface.inner[corner]], [uv(surface.outer[corner]), uv(surface.outer[next]), uv(surface.inner[next]), uv(surface.inner[corner])], 1);
      addPolygon([surface.inner[corner], surface.inner[next], surface.bottom[next], surface.bottom[corner]], [[0, 0], [1, 0], [1, 1], [0, 1]], 2);
      const a = face.vertices[corner];
      const b = face.vertices[next];
      cornersByVertex[a].push(surface.outer[corner]);
      const key = [a, b].sort((left, right) => left - right).join(':');
      if (!edges.has(key)) edges.set(key, []);
      edges.get(key).push(new Map([[a, surface.outer[corner]], [b, surface.outer[next]]]));
    }
  }
  let edgeIndex = 0;
  for (const [key, pair] of edges) {
    if (pair.length !== 2) throw new Error(`Aresta metálica aberta: ${key}`);
    const [a, b] = key.split(':').map(Number);
    const offset = edgeIndex * .193;
    addPolygon([pair[0].get(a), pair[0].get(b), pair[1].get(b), pair[1].get(a)], [[offset, 0], [offset + 1, 0], [offset + 1, 1], [offset, 1]], 3, true);
    edgeIndex++;
  }
  for (const [index, corners] of cornersByVertex.entries()) {
    const axis = new THREE.Vector3(...shape.vertices[index]).normalize();
    const center = corners.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / corners.length);
    const reference = Math.abs(axis.y) > .9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const right = reference.addScaledVector(axis, -reference.dot(axis)).normalize();
    const up = new THREE.Vector3().crossVectors(axis, right).normalize();
    corners.sort((a, b) => {
      const deltaA = a.clone().sub(center);
      const deltaB = b.clone().sub(center);
      return Math.atan2(deltaA.dot(up), deltaA.dot(right)) - Math.atan2(deltaB.dot(up), deltaB.dot(right));
    });
    addPolygon(corners, corners.map((_, corner) => [index * .13 + corner * .17, 0]), 3, true);
  }
  const positions = [];
  const normals = [];
  const uvs = [];
  const barycentrics = [];
  const geometry = new THREE.BufferGeometry();
  for (const [materialIndex, bucket] of buckets.entries()) {
    const start = positions.length / 3;
    positions.push(...bucket.positions);
    normals.push(...bucket.normals);
    uvs.push(...bucket.uvs);
    barycentrics.push(...bucket.barycentrics);
    geometry.addGroup(start, bucket.positions.length / 3, materialIndex);
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('panelBarycentric', new THREE.Float32BufferAttribute(barycentrics, 3));
  return geometry;
}

export function numeralShapes(font, value) {
  const shapes = [];
  let offset = 0;
  for (const digit of String(value)) {
    const outline = font.getPath(digit, offset, 0, 1);
    const path = new THREE.ShapePath();
    for (const command of outline.commands) {
      if (command.type === 'M') path.moveTo(command.x, -command.y);
      else if (command.type === 'L') path.lineTo(command.x, -command.y);
      else if (command.type === 'Q') path.quadraticCurveTo(command.x1, -command.y1, command.x, -command.y);
      else if (command.type === 'C') path.bezierCurveTo(command.x1, -command.y1, command.x2, -command.y2, command.x, -command.y);
      else if (command.type === 'Z') path.currentPath.closePath();
    }
    shapes.push(...path.toShapes(true));
    offset += font.getAdvanceWidth(digit, 1);
  }
  return shapes;
}

export function scuffedD20Numbers(shape, font) {
  const geometries = [];
  const ranges = [];
  let vertexOffset = 0;
  const base = new THREE.Color(0xbcb4a8);
  const highlight = new THREE.Color(0xe2dcd0);
  const shadow = new THREE.Color(0x5e5852);
  const contact = new THREE.Color(0x101010);
  for (const face of shape.faces) {
    const surface = faceData(shape, face);
    const shapes = numeralShapes(font, face.label);
    if (!shapes.length) throw new Error(`Contorno Cinzel ausente: ${face.label}`);
    let silhouette = new THREE.ShapeGeometry(shapes, 5);
    silhouette.computeBoundingBox();
    const box = silhouette.boundingBox.clone();
    const width = box.max.x - box.min.x;
    const height = box.max.y - box.min.y;
    const fit = Math.min(surface.edgeLength * .29 / width, surface.edgeLength * .27 / height);
    const flatSilhouette = silhouette.toNonIndexed();
    silhouette.dispose();
    silhouette = flatSilhouette;
    const geometry = new THREE.ExtrudeGeometry(shapes, {
      depth: surface.edgeLength * .008 / fit,
      bevelEnabled: true,
      bevelThickness: surface.edgeLength * .0012 / fit,
      bevelSize: surface.edgeLength * .0012 / fit,
      bevelSegments: 2,
      curveSegments: 5,
      steps: 1,
    });
    geometry.translate(-(box.max.x + box.min.x) / 2, -(box.max.y + box.min.y) / 2, 0);
    const normals = geometry.getAttribute('normal');
    const vertices = geometry.getAttribute('position');
    const colors = [];
    for (let index = 0; index < normals.count; index++) {
      const z = normals.getZ(index);
      const upper = (vertices.getY(index) + height / 2) / height;
      const color = z > .92 ? base.clone().lerp(highlight, Math.max(0, upper - .4) * .5) : z > .18 || normals.getY(index) > .3 ? highlight : shadow;
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.scale(fit, fit, fit);
    silhouette.translate(-(box.max.x + box.min.x) / 2, -(box.max.y + box.min.y) / 2, 0);
    silhouette.scale(fit * 1.045, fit * 1.045, fit);
    const contactColors = [];
    for (let index = 0; index < silhouette.getAttribute('position').count; index++) contactColors.push(contact.r, contact.g, contact.b);
    silhouette.setAttribute('color', new THREE.Float32BufferAttribute(contactColors, 3));
    const contactPosition = surface.center.clone().addScaledVector(surface.normal, -.02 * surface.edgeLength + .0004 * surface.edgeLength);
    const contactTransform = new THREE.Matrix4().makeBasis(surface.right, surface.up, surface.normal).setPosition(contactPosition);
    silhouette.applyMatrix4(contactTransform);
    const position = surface.center.clone().addScaledVector(surface.normal, -.02 * surface.edgeLength + .001 * surface.edgeLength);
    const transform = new THREE.Matrix4().makeBasis(surface.right, surface.up, surface.normal).setPosition(position);
    geometry.applyMatrix4(transform);
    const count = silhouette.getAttribute('position').count + geometry.getAttribute('position').count;
    ranges.push({ label: face.label, start: vertexOffset, count });
    vertexOffset += count;
    geometries.push(silhouette, geometry);
  }
  const merged = mergeGeometries(geometries);
  geometries.forEach((geometry) => geometry.dispose());
  if (!merged) throw new Error('Não foi possível unir os números Cinzel.');
  merged.clearGroups();
  merged.userData.faceRanges = ranges;
  return merged;
}
