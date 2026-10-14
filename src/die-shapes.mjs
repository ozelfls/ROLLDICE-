const phi = (1 + Math.sqrt(5)) / 2;
const vertices = [
  [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
  [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
  [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
].map((point) => point.map((coordinate) => coordinate / Math.hypot(...point)));

const subtract = (a, b) => a.map((value, index) => value - b[index]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);

export function createD20Shape() {
  const faces = [];
  for (let a = 0; a < vertices.length - 2; a++) {
    for (let b = a + 1; b < vertices.length - 1; b++) {
      for (let c = b + 1; c < vertices.length; c++) {
        const normal = cross(subtract(vertices[b], vertices[a]), subtract(vertices[c], vertices[a]));
        let positive = false;
        let negative = false;
        for (let index = 0; index < vertices.length; index++) {
          if ([a, b, c].includes(index)) continue;
          const side = dot(normal, subtract(vertices[index], vertices[a]));
          if (side > 1e-8) positive = true;
          if (side < -1e-8) negative = true;
          if (positive && negative) break;
        }
        if (!positive || !negative) {
          const face = dot(normal, vertices[a]) > 0 ? [a, b, c] : [a, c, b];
          faces.push({ vertices: face, label: null });
        }
      }
    }
  }
  let nextLabel = 1;
  for (const face of faces) {
    if (face.label !== null) continue;
    const [a, b, c] = face.vertices.map((index) => vertices[index]);
    const normal = cross(subtract(b, a), subtract(c, a));
    const opposite = faces.find((candidate) => {
      if (candidate === face || candidate.label !== null) return false;
      const [x, y, z] = candidate.vertices.map((index) => vertices[index]);
      const other = cross(subtract(y, x), subtract(z, x));
      return dot(normal, other) < -dot(normal, normal) * .999;
    });
    face.label = nextLabel;
    opposite.label = 21 - nextLabel;
    nextLabel++;
  }
  return { vertices, faces };
}
