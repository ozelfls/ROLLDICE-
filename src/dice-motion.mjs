export const ROLL_DURATION = 1950;
export const PHYSICAL_PHASE = 0.72;

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function createPhysicalMotion({ baseX, baseZ, halfWidth, halfDepth, radius, index, total }, random = Math.random) {
  const side = random() < .5 ? -1 : 1;
  const signed = () => random() * 2 - 1;
  const spacious = total <= 2;
  const xLimit = Math.max(radius, halfWidth - radius);
  const zLimit = Math.max(radius * .5, halfDepth - radius * .7);
  return {
    x: clamp(baseX + signed() * radius * (spacious ? .25 : .5), -xLimit, xLimit),
    z: clamp(baseZ + signed() * Math.min(radius, .45), -zLimit, zLimit),
    y: radius * (.75 + random() * .5),
    vx: spacious ? side * (10 + random() * 3) : signed() * (3 + random() * 4),
    vz: signed() * (2.5 + random() * 2.5),
    vy: 2 + random() * 2.2,
    radius,
    xLimit,
    zLimit,
    floorHits: 0,
    wallHits: 0,
    index,
  };
}

export function stepPhysicalMotion(body, seconds) {
  const dt = Math.max(0, Math.min(seconds, .05));
  body.vy -= 23 * dt;
  body.x += body.vx * dt;
  body.z += body.vz * dt;
  body.y += body.vy * dt;
  if (body.x < -body.xLimit || body.x > body.xLimit) {
    body.x = clamp(body.x, -body.xLimit, body.xLimit);
    body.vx *= -.62;
    body.vy = Math.max(body.vy, .7);
    body.wallHits++;
  }
  if (body.z < -body.zLimit || body.z > body.zLimit) {
    body.z = clamp(body.z, -body.zLimit, body.zLimit);
    body.vz *= -.57;
    body.vy = Math.max(body.vy, .55);
    body.wallHits++;
  }
  if (body.y < 0) {
    const impact = body.vy < -.55;
    body.y = 0;
    body.vy = impact ? -body.vy * .46 : 0;
    if (impact) {
      body.vx *= .88;
      body.vz *= .88;
      body.floorHits++;
    }
  }
  const drag = Math.exp(-(body.y === 0 ? 1 : .52) * dt);
  body.vx *= drag;
  body.vz *= drag;
  return body;
}

export function resolvePhysicalCollisions(bodies) {
  for (let first = 0; first < bodies.length; first++) {
    for (let second = first + 1; second < bodies.length; second++) {
      const a = bodies[first];
      const b = bodies[second];
      if (Math.abs(a.y - b.y) > Math.max(a.radius, b.radius)) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const distance = Math.hypot(dx, dz);
      const minimum = (a.radius + b.radius) * .77;
      if (distance >= minimum) continue;
      const nx = distance > 1e-6 ? dx / distance : (first + second) % 2 ? 1 : -1;
      const nz = distance > 1e-6 ? dz / distance : 0;
      const correction = (minimum - distance) * .5;
      a.x = clamp(a.x - nx * correction, -a.xLimit, a.xLimit);
      a.z = clamp(a.z - nz * correction, -a.zLimit, a.zLimit);
      b.x = clamp(b.x + nx * correction, -b.xLimit, b.xLimit);
      b.z = clamp(b.z + nz * correction, -b.zLimit, b.zLimit);
      const approach = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (approach < 0) {
        const impulse = -approach * .72;
        a.vx -= impulse * nx;
        a.vz -= impulse * nz;
        b.vx += impulse * nx;
        b.vz += impulse * nz;
        a.vy = Math.max(a.vy, .35);
        b.vy = Math.max(b.vy, .35);
      }
    }
  }
}

export function settlePhysicalMotion(body, progress) {
  const t = clamp(progress, 0, 1);
  const travel = 1 - Math.pow(1 - t, 3);
  return {
    x: clamp(body.x + body.vx * .12 * travel, -body.xLimit, body.xLimit),
    y: body.y * (1 - travel),
    z: clamp(body.z + body.vz * .12 * travel, -body.zLimit, body.zLimit),
  };
}

export function createSpinProfile(random = Math.random) {
  const turn = () => (random() < .5 ? -1 : 1) * Math.PI * (5 + random() * 3);
  return { x: turn(), y: turn(), z: turn(), phase: random() * Math.PI * 2 };
}

export function spinAt(progress, profile) {
  const remaining = 1 - clamp(progress, 0, 1);
  const energy = Math.pow(remaining, 2.2);
  const wobble = Math.sin(progress * Math.PI * 8 + profile.phase) * remaining * remaining * .24;
  return {
    x: profile.x * energy + wobble,
    y: profile.y * energy - wobble * .7,
    z: profile.z * energy + wobble * .45,
    blur: 2.6 * Math.pow(remaining, 1.5),
  };
}
