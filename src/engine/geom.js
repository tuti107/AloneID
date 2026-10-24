// Geometry helpers: boxes with world-space UVs, tapered limbs, rocks, etc.
import * as THREE from 'three';
import { TEX_SIZE } from './textures.js';
import { rng } from './util.js';

// Box whose UVs are scaled so a texture covers `ts` metres per repeat.
export function uvBox(w, h, d, ts = [1, 1]) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [a, b] = dims[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * a / ts[0], uv.getY(i) * b / ts[1]);
    }
  }
  return g;
}
export function texSize(name) {
  return TEX_SIZE[name] || [1, 1];
}

export function uvPlane(w, h, ts = [1, 1]) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / ts[0], uv.getY(i) * h / ts[1]);
  return g;
}

// Convex hull from vertices + quads, with faces auto-oriented outward from the
// centroid. Non-indexed, so normals come out flat (faceted look).
export function hull(verts, quads) {
  const c = [0, 0, 0];
  for (const v of verts) { c[0] += v[0]; c[1] += v[1]; c[2] += v[2]; }
  c[0] /= verts.length; c[1] /= verts.length; c[2] /= verts.length;
  const pos = [];
  const tri = (a, b, d) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const fx = (a[0] + b[0] + d[0]) / 3 - c[0], fy = (a[1] + b[1] + d[1]) / 3 - c[1], fz = (a[2] + b[2] + d[2]) / 3 - c[2];
    if (nx * fx + ny * fy + nz * fz < 0) pos.push(...a, ...d, ...b);
    else pos.push(...a, ...b, ...d);
  };
  for (const q of quads) {
    const p = q.map((i) => verts[i]);
    tri(p[0], p[1], p[2]);
    if (p.length > 3) tri(p[0], p[2], p[3]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// Frustum box: ring A (wA x dA) at y=0, ring B (wB x dB) at y=len (len may be
// negative for limbs hanging from a joint). `off` shifts ring B in x/z.
export function frustum(wA, dA, wB, dB, len, off = [0, 0]) {
  const [ox, oz] = off;
  const v = [
    [-wA / 2, 0, -dA / 2], [wA / 2, 0, -dA / 2], [wA / 2, 0, dA / 2], [-wA / 2, 0, dA / 2],
    [-wB / 2 + ox, len, -dB / 2 + oz], [wB / 2 + ox, len, -dB / 2 + oz], [wB / 2 + ox, len, dB / 2 + oz], [-wB / 2 + ox, len, dB / 2 + oz],
  ];
  return hull(v, [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]);
}

// Octagonal-ish prism between two radii (for hats, bottles, columns).
export function prism(rA, rB, len, sides = 8, y0 = 0) {
  const g = new THREE.CylinderGeometry(rB, rA, Math.abs(len), sides, 1);
  g.translate(0, y0 + len / 2, 0);
  return g.toNonIndexed ? flatten(g) : g;
}
function flatten(g) {
  const n = g.toNonIndexed();
  n.computeVertexNormals();
  return n;
}

// Irregular rock lump for caves.
export function rockGeo(radius, seed = 1, detail = 1, squash = [1, 1, 1]) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const r = rng(seed);
  const p = g.attributes.position;
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let k = map.get(key);
    if (k === undefined) { k = 0.75 + r() * 0.5; map.set(key, k); }
    p.setXYZ(i, p.getX(i) * k * squash[0], p.getY(i) * k * squash[1], p.getZ(i) * k * squash[2]);
  }
  g.computeVertexNormals();
  return g;
}

