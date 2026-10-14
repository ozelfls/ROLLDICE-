export const ROLL_DURATION = 2100;

export function motionAt(progress, index) {
  const t = Math.max(0, Math.min(1, progress));
  if (t === 1) return { x: 0, y: 0, z: 0, spin: 0, settle: 1 };
  const settle = 1 - Math.pow(1 - t, 3);
  const energy = Math.pow(1 - t, 2);
  const bounce = Math.abs(Math.sin((t * 3.4 + index * .13) * Math.PI)) * energy;
  return {
    x: Math.sin(t * Math.PI * 2.3 + index * 1.7) * energy * .65,
    y: bounce * 1.05 + Math.sin(t * Math.PI) * .22,
    z: Math.cos(t * Math.PI * 1.7 + index * 2.1) * energy * .4,
    spin: (1 - settle) * (Math.PI * (5 + index % 4)),
    settle,
  };
}
