const phi = (1 + Math.sqrt(5)) / 2;
const add = (a, b) => a.map((value, index) => value + b[index]);
const subtract = (a, b) => a.map((value, index) => value - b[index]);
const scale = (a, factor) => a.map((value) => value * factor);
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a) => Math.hypot(...a);
const normalize = (a) => scale(a, 1 / length(a));
const average = (points) => scale(points.reduce(add, [0, 0, 0]), 1 / points.length);

function outwardFace(vertices, face) {
  const [a, b, c] = face.map((index) => vertices[index]);
  return dot(cross(subtract(b, a), subtract(c, a)), a) >= 0 ? face : [...face].reverse();
}

function solid(vertices, polygons, labels) {
  const radius = Math.max(...vertices.map(length));
  const normalized = vertices.map((vertex) => scale(vertex, 1 / radius));
  return {
    vertices: normalized,
    faces: polygons.map((face, index) => ({ vertices: outwardFace(normalized, face), label: labels[index] })),
  };
}

function hullTriangles(vertices) {
  const faces = [];
  for (let a = 0; a < vertices.length - 2; a++) {
    for (let b = a + 1; b < vertices.length - 1; b++) {
      for (let c = b + 1; c < vertices.length; c++) {
        const normal = cross(subtract(vertices[b], vertices[a]), subtract(vertices[c], vertices[a]));
        if (length(normal) < 1e-8) continue;
        let positive = false;
        let negative = false;
        for (let index = 0; index < vertices.length; index++) {
          if (index === a || index === b || index === c) continue;
          const side = dot(normal, subtract(vertices[index], vertices[a]));
          if (side > 1e-8) positive = true;
          if (side < -1e-8) negative = true;
          if (positive && negative) break;
        }
        if (!positive || !negative) faces.push(outwardFace(vertices, [a, b, c]));
      }
    }
  }
  return faces;
}

function icosahedron() {
  const vertices = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
  ].map(normalize);
  return { vertices, faces: hullTriangles(vertices) };
}

function oppositeLabels(vertices, polygons) {
  const labels = Array(polygons.length).fill(null);
  let next = 1;
  for (let index = 0; index < polygons.length; index++) {
    if (labels[index] !== null) continue;
    const [a, b, c] = polygons[index].map((vertex) => vertices[vertex]);
    const normal = cross(subtract(b, a), subtract(c, a));
    const opposite = polygons.findIndex((face, otherIndex) => {
      if (otherIndex === index || labels[otherIndex] !== null) return false;
      const [x, y, z] = face.map((vertex) => vertices[vertex]);
      const other = cross(subtract(y, x), subtract(z, x));
      return dot(normal, other) < -dot(normal, normal) * .999;
    });
    if (opposite < 0) throw new Error('Faces opostas do D20 não encontradas.');
    labels[index] = next;
    labels[opposite] = 21 - next;
    next++;
  }
  return labels;
}

function dual(vertices, polygons) {
  const faceVertices = polygons.map((face) => {
    const [a, b, c] = outwardFace(vertices, face).map((index) => vertices[index]);
    const normal = normalize(cross(subtract(b, a), subtract(c, a)));
    return scale(normal, 1 / dot(normal, a));
  });
  const faces = vertices.map((vertex, vertexIndex) => {
    const normal = normalize(vertex);
    const right = normalize(cross(normal, Math.abs(normal[1]) > .9 ? [1, 0, 0] : [0, 1, 0]));
    const up = cross(normal, right);
    const adjacent = polygons.flatMap((face, index) => face.includes(vertexIndex) ? [index] : []);
    const center = average(adjacent.map((index) => faceVertices[index]));
    adjacent.sort((a, b) => {
      const deltaA = subtract(faceVertices[a], center);
      const deltaB = subtract(faceVertices[b], center);
      return Math.atan2(dot(deltaA, up), dot(deltaA, right)) - Math.atan2(dot(deltaB, up), dot(deltaB, right));
    });
    return adjacent;
  });
  return { vertices: faceVertices, faces };
}

function trapezohedron() {
  const vertices = [];
  for (let index = 0; index < 5; index++) {
    const top = index * Math.PI * 2 / 5;
    const bottom = (index + .5) * Math.PI * 2 / 5;
    vertices.push([Math.cos(top), Math.sin(top), .58]);
    vertices.push([Math.cos(bottom), Math.sin(bottom), -.58]);
  }
  const faces = [[0, 2, 4, 6, 8], [9, 7, 5, 3, 1]];
  for (let index = 0; index < 5; index++) {
    const next = (index + 1) % 5;
    const previous = (index + 4) % 5;
    faces.push([index * 2, next * 2, index * 2 + 1]);
    faces.push([previous * 2 + 1, index * 2 + 1, index * 2]);
  }
  return dual(vertices, faces);
}

function hundredSided() {
  const base = icosahedron();
  const vertices = base.vertices.map((vertex) => [...vertex]);
  const midpointCache = new Map();
  const midpoint = (a, b) => {
    const key = [a, b].sort((left, right) => left - right).join(':');
    if (midpointCache.has(key)) return midpointCache.get(key);
    const index = vertices.push(normalize(add(vertices[a], vertices[b]))) - 1;
    midpointCache.set(key, index);
    return index;
  };
  const eighty = [];
  for (const [a, b, c] of base.faces) {
    const ab = midpoint(a, b);
    const bc = midpoint(b, c);
    const ca = midpoint(c, a);
    eighty.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
  }
  for (let index = 0; index < eighty.length; index += 8) {
    const [a, b, c] = eighty[index];
    vertices.push(normalize(average([vertices[a], vertices[b], vertices[c]])));
  }
  return { vertices, faces: hullTriangles(vertices) };
}

export function createDieShape(dice) {
  if (dice === 'd4') {
    const vertices = [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]];
    return solid(vertices, hullTriangles(vertices), [1, 2, 3, 4]);
  }
  if (dice === 'd6') {
    const vertices = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
    return solid(vertices, [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]], [1, 6, 2, 5, 3, 4]);
  }
  if (dice === 'd8') {
    const vertices = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    return solid(vertices, hullTriangles(vertices), Array.from({ length: 8 }, (_, index) => index + 1));
  }
  if (dice === 'd10' || dice === 'dpercent') {
    const shape = trapezohedron();
    const labels = dice === 'dpercent' ? [10, 20, 30, 40, 50, 60, 70, 80, 90, '00'] : Array.from({ length: 10 }, (_, index) => index + 1);
    return solid(shape.vertices, shape.faces, labels);
  }
  if (dice === 'd12') {
    const base = icosahedron();
    const shape = dual(base.vertices, base.faces);
    return solid(shape.vertices, shape.faces, Array.from({ length: 12 }, (_, index) => index + 1));
  }
  if (dice === 'd20') {
    const shape = icosahedron();
    return solid(shape.vertices, shape.faces, oppositeLabels(shape.vertices, shape.faces));
  }
  if (dice === 'd100') {
    const shape = hundredSided();
    return solid(shape.vertices, shape.faces, Array.from({ length: 100 }, (_, index) => index + 1));
  }
  throw new RangeError('Tipo de dado inválido.');
}

export function createD20Shape() {
  return createDieShape('d20');
}
