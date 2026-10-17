import * as THREE from 'three';

export function beveledSurface(shape, inset = .075) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const groups = [];
  const faceCorners = shape.faces.map((face) => {
    const points = face.vertices.map((index) => new THREE.Vector3(...shape.vertices[index]));
    const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
    return points.map((point) => point.lerp(center, inset));
  });
  const addPolygon = (points, textureCoordinates, materialIndex) => {
    const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
    const normal = new THREE.Vector3().crossVectors(points[1].clone().sub(points[0]), points[2].clone().sub(points[0]));
    const vertices = normal.dot(center) >= 0 ? points : [...points].reverse();
    const coordinates = normal.dot(center) >= 0 ? textureCoordinates : [...textureCoordinates].reverse();
    const start = positions.length / 3;
    for (let corner = 1; corner < vertices.length - 1; corner++) {
      const triangle = [vertices[0], vertices[corner], vertices[corner + 1]];
      const uv = [coordinates[0], coordinates[corner], coordinates[corner + 1]];
      const faceNormal = new THREE.Vector3().crossVectors(triangle[1].clone().sub(triangle[0]), triangle[2].clone().sub(triangle[0])).normalize();
      for (let vertex = 0; vertex < 3; vertex++) {
        positions.push(...triangle[vertex]);
        normals.push(...faceNormal);
        uvs.push(...uv[vertex]);
      }
    }
    groups.push({ start, count: positions.length / 3 - start, materialIndex });
  };
  const edges = new Map();
  const cornersByVertex = shape.vertices.map(() => []);
  for (const [faceIndex, face] of shape.faces.entries()) {
    const points = face.vertices.map((index) => new THREE.Vector3(...shape.vertices[index]));
    const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
    const normal = new THREE.Vector3().crossVectors(points[1].clone().sub(points[0]), points[2].clone().sub(points[0])).normalize();
    const right = points[1].clone().sub(points[0]).normalize();
    const up = new THREE.Vector3().crossVectors(normal, right).normalize();
    const radius = Math.max(...points.map((point) => point.distanceTo(center)));
    const uv = faceCorners[faceIndex].map((point) => {
      const offset = point.clone().sub(center);
      return [.5 + offset.dot(right) / (2 * radius), .5 + offset.dot(up) / (2 * radius)];
    });
    addPolygon(faceCorners[faceIndex], uv, faceIndex);
    for (let corner = 0; corner < face.vertices.length; corner++) {
      const a = face.vertices[corner];
      const b = face.vertices[(corner + 1) % face.vertices.length];
      cornersByVertex[a].push(faceCorners[faceIndex][corner]);
      const key = [a, b].sort((left, right) => left - right).join(':');
      if (!edges.has(key)) edges.set(key, []);
      edges.get(key).push(new Map([[a, faceCorners[faceIndex][corner]], [b, faceCorners[faceIndex][(corner + 1) % face.vertices.length]]]));
    }
  }
  const goldIndex = shape.faces.length;
  for (const [key, pair] of edges) {
    if (pair.length !== 2) throw new Error(`Aresta aberta: ${key}`);
    const [a, b] = key.split(':').map(Number);
    addPolygon([pair[0].get(a), pair[0].get(b), pair[1].get(b), pair[1].get(a)], [[0, 0], [1, 0], [1, 1], [0, 1]], goldIndex);
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
    addPolygon(corners, corners.map(() => [0, 0]), goldIndex);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  for (const group of groups) geometry.addGroup(group.start, group.count, group.materialIndex);
  return geometry;
}
