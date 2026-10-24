// Small math helpers shared across the game.
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => t * t * (3 - 2 * t);
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export function wrapAngle(a) {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  if (a < -Math.PI) a += TAU;
  return a;
}
export const angleDiff = (from, to) => wrapAngle(to - from);
export function approach(a, b, step) {
  if (a < b) return Math.min(a + step, b);
  return Math.max(a - step, b);
}
export function approachAngle(a, b, step) {
  const d = angleDiff(a, b);
  if (Math.abs(d) <= step) return b;
  return a + Math.sign(d) * step;
}

// Deterministic PRNG (mulberry32).
export function rng(seed = 1) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 1D value noise in [-1, 1], used for flickering lights.
const NOISE = new Float32Array(256);
{
  const r = rng(1337);
  for (let i = 0; i < 256; i++) NOISE[i] = r() * 2 - 1;
}
export function noise1(t) {
  const i = Math.floor(t);
  const f = t - i;
  const a = NOISE[i & 255];
  const b = NOISE[(i + 1) & 255];
  return lerp(a, b, f * f * (3 - 2 * f));
}

export function pick(arr, r = Math.random) {
  return arr[Math.floor(r() * arr.length) % arr.length];
}

// Point in polygon (x,z pairs).
export function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1];
    const xj = poly[j][0], zj = poly[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function rectToPoly(r) {
  const [x0, z0, x1, z1] = r;
  return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
}
