// Sculpted low-poly body parts for the jointed humanoids. Every part is a
// smooth "loft": cross-section rings (ellipses that can be squared off)
// stacked along the bone, so limbs taper and bulge like limbs rather than
// boxes, and their ends are domed so elbows and knees stay closed when they
// bend. Heads are shaped separately (brow, eye sockets, nose, jaw) and carry
// a face texture projected from the front.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// A ring is [y, rx, rz, ox, oz, sq]: half-widths, centre offset and
// squareness (0 = ellipse, 1 = rounded box). rx = rz = 0 makes a pole.
const norm = (r) => [r[0], r[1], r[2], r[3] || 0, r[4] || 0, r[5] || 0];
const isPole = (r) => r[1] <= 0 && r[2] <= 0;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Point on a ring at angle a (0 = front/+z, pi/2 = +x side), pushed `off`
// metres outwards along the surface normal.
function ringPoint(r, a, off, out) {
  const [y, rx, rz, ox, oz, sq] = r;
  const s = Math.sin(a), c = Math.cos(a);
  const e = 2 / (2 + sq * 6);
  let x = ox + rx * Math.sign(s) * Math.abs(s) ** e;
  let z = oz + rz * Math.sign(c) * Math.abs(c) ** e;
  if (off) {
    const nx = s / Math.max(rx, 1e-3), nz = c / Math.max(rz, 1e-3);
    const l = Math.hypot(nx, nz) || 1;
    x += (nx / l) * off;
    z += (nz / l) * off;
  }
  out.push(x, y, z);
}

// The parameter angle of the point seen at true angle phi from the ring's
// centre (squared-off rings bunch their parameter towards the corners).
function polar(r, phi) {
  const e = 2 / (2 + r[5] * 6);
  const s = Math.sin(phi), c = Math.cos(phi);
  let a = Math.atan(Math.pow((r[2] / Math.max(r[1], 1e-4)) * Math.abs(s) / Math.max(Math.abs(c), 1e-6), 1 / e));
  if (c < 0) a = Math.PI - a;
  return s < 0 ? -a : a;
}

// The ring a loft passes through at height y (rings may run up or down).
export function ringAt(rings0, y) {
  const rings = rings0.map(norm);
  for (let i = 0; i + 1 < rings.length; i++) {
    const a = rings[i], b = rings[i + 1];
    if (a[0] === b[0] || y < Math.min(a[0], b[0]) || y > Math.max(a[0], b[0])) continue;
    const t = (y - a[0]) / (b[0] - a[0]);
    return a.map((v, k) => (k === 0 ? y : lerp(v, b[k], t)));
  }
  const first = rings[0], last = rings[rings.length - 1];
  const r = Math.abs(y - first[0]) < Math.abs(y - last[0]) ? first : last;
  return [y, ...r.slice(1)];
}

// Point on a loft's surface at height y, seen at angle a (0 = front,
// +pi/2 = the character's left) from its axis, `off` metres above it.
export function surfacePoint(rings, y, a, off = 0) {
  const out = [];
  const r = ringAt(rings, y);
  ringPoint(r, polar(r, a), off, out);
  return new THREE.Vector3(out[0], out[1], out[2]);
}

// Smooth solid through the rings. Open ends get flat caps unless caps:false.
export function loft(rings0, n = 8, o = {}) {
  const rings = rings0.map(norm);
  const L = rings.length;
  const pos = [], uv = [], idx = [], start = [];
  rings.forEach((r, i) => {
    start.push(pos.length / 3);
    const v = i / (L - 1);
    if (isPole(r)) { pos.push(r[3], r[0], r[4]); uv.push(0.5, v); return; }
    for (let k = 0; k < n; k++) {
      ringPoint(r, (k / n) * Math.PI * 2, o.off || 0, pos);
      uv.push(k / n, v);
    }
  });
  const up = rings[L - 1][0] >= rings[0][0];
  const tri = (a, b, c) => (up ? idx.push(a, b, c) : idx.push(a, c, b));
  const at = (i, k) => (isPole(rings[i]) ? start[i] : start[i] + (k % n));
  for (let i = 0; i + 1 < L; i++) {
    for (let k = 0; k < n; k++) {
      const a = at(i, k), b = at(i, k + 1), c = at(i + 1, k + 1), d = at(i + 1, k);
      if (!isPole(rings[i])) tri(a, b, d);
      if (!isPole(rings[i + 1])) tri(b, c, d);
    }
  }
  if (o.caps !== false) {
    for (const i of [0, L - 1]) {
      const r = rings[i];
      if (isPole(r)) continue;
      const ci = pos.length / 3;
      pos.push(r[3], r[0], r[4]);
      uv.push(0.5, i ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const a = start[i] + k, b = start[i] + ((k + 1) % n);
        if (i) tri(ci, a, b); else tri(ci, b, a);
      }
    }
  }
  return finish(pos, uv, idx);
}

// A thin plate lying on a loft's surface: rows of [y, a0, a1] (the range of
// angles seen from the axis at that height, so collars, lapels, ties and
// aprons can taper), `off` metres above it. Used for clothing details that
// follow the body's curve.
export function shell(rings, rows0, n = 4, off = 0.004) {
  // Follow the surface: add rows at every ring the plate passes over and
  // every few centimetres, or straight spans would sink into the body.
  const ringYs = rings.map((r) => r[0]);
  const rows = [];
  rows0.forEach((r0, i) => {
    rows.push(r0);
    const r1 = rows0[i + 1];
    if (!r1) return;
    const [y0] = r0, [y1] = r1;
    const ys = ringYs.filter((y) => (y - y0) * (y - y1) < 0);
    const steps = Math.ceil(Math.abs(y1 - y0) / 0.035);
    for (let k = 1; k < steps; k++) ys.push(lerp(y0, y1, k / steps));
    ys.sort((p, q) => (y1 > y0 ? p - q : q - p));
    for (const y of ys) {
      const t = (y - y0) / (y1 - y0);
      rows.push([y, lerp(r0[1], r1[1], t), lerp(r0[2], r1[2], t)]);
    }
  });
  const pos = [], uv = [], idx = [];
  rows.forEach(([y, a0, a1], i) => {
    const r = ringAt(rings, y);
    for (let k = 0; k <= n; k++) {
      ringPoint(r, polar(r, lerp(a0, a1, k / n)), off, pos);
      uv.push(k / n, i / (rows.length - 1));
    }
  });
  const up = rows[rows.length - 1][0] >= rows[0][0];
  for (let i = 0; i + 1 < rows.length; i++) {
    for (let k = 0; k < n; k++) {
      const a = i * (n + 1) + k, b = a + 1, d = a + n + 1, c = d + 1;
      if (up) idx.push(a, b, d, b, c, d); else idx.push(a, d, b, b, d, c);
    }
  }
  return finish(pos, uv, idx);
}

function finish(pos, uv, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ body
// All builders take the humanoid spec (see rig.js) and return rings or
// geometry in the frame of the joint the part hangs from.

export function pelvisRings(s) {
  const [pw, ph, pd] = s.pelvis;
  const [ww, wd] = s.waist;
  return [
    [0.075, ww * 0.49, wd * 0.49, 0, 0, 0.3],
    [0.0, pw * 0.5, pd * 0.52, 0, -0.004, 0.35],
    [-ph * 0.55, pw * 0.47, pd * 0.5, 0, -0.01, 0.3],
    [-ph * 0.95, pw * 0.3, pd * 0.34, 0, -0.008, 0.2],
    [-ph * 1.1, 0, 0, 0, -0.008],
  ];
}

export function torsoRings(s) {
  const L = s.torsoLen;
  const wx = s.waist[0] / 2, wz = s.waist[1] / 2, cx = s.chest[0] / 2, cz = s.chest[1] / 2;
  const bust = s.bust || 0;
  return [
    [-0.03, wx * 0.97, wz * 0.97, 0, 0, 0.3],
    [L * 0.16, lerp(wx, cx * 0.8, 0.2), lerp(wz, cz, 0.25), 0, 0.004, 0.3],
    [L * 0.4, cx * 0.8, lerp(wz, cz, 0.75) + bust * 0.5, 0, 0.01 + bust * 0.5, 0.35],
    [L * 0.6, cx * 0.84, cz + bust, 0, 0.014 + bust, 0.4],
    [L * 0.8, cx * 0.9, cz * 0.93, 0, 0.006, 0.45],
    // shoulder line under the deltoids, then the slope up to the neck
    [L - 0.045, s.shoulderX + 0.03, cz * 0.74, 0, -0.006, 0.6],
    [L - 0.008, s.shoulderX * 0.56, cz * 0.56, 0, -0.012, 0.35],
    [L + 0.03, 0.062, 0.056, 0, -0.008],
  ];
}

export function neckRings(s) {
  const r = s.neckR || 0.054;
  return [[-0.04, r * 1.12, r * 1.05], [s.neckLen * 0.5, r, r, 0, 0.003], [s.neckLen + 0.05, r * 0.96, r * 0.96, 0, 0.006]];
}

export function upperArmRings(s) {
  const r = s.armW / 2, L = s.upperArm;
  return [
    [0.038, 0, 0],
    [0.026, r * 0.8, r * 0.82],
    [0.004, r * 1.08, r * 1.04],
    [-L * 0.32, r * 0.98, r * 0.96, 0, 0.004],
    [-L * 0.75, r * 0.86, r * 0.86],
    [-L, r * 0.8, r * 0.82],
    [-L - 0.03, r * 0.55, r * 0.56],
    [-L - 0.045, 0, 0],
  ];
}

export function foreArmRings(s) {
  const r = (s.armW / 2) * 0.88, L = s.foreArm;
  return [
    [0.042, 0, 0],
    [0.026, r * 0.62, r * 0.62],
    [0.0, r * 0.94, r * 0.94],
    [-L * 0.3, r * 0.96, r * 1.02],
    [-L * 0.82, r * 0.6, r * 0.76],
    [-L - 0.005, r * 0.52, r * 0.68],
  ];
}

// Hand hanging from the wrist, palm towards the body (sx: +1 left, -1 right).
export function handGeo(s, sx) {
  const w = s.handW;
  const palm = loft([
    [0.012, w * 0.24, w * 0.36],
    [-0.025, w * 0.27, w * 0.54, 0, 0.003, 0.4],
    [-0.065, w * 0.24, w * 0.56, 0, 0.006, 0.45],
    [-0.095, w * 0.18, w * 0.46, sx * -0.006, 0.012, 0.3],
    [-0.11, 0, 0, sx * -0.01, 0.014],
  ], 8);
  const thumb = loft([[0.004, w * 0.13, w * 0.13], [-0.03, w * 0.12, w * 0.11], [-0.05, 0, 0]], 6);
  thumb.rotateX(-0.55);
  thumb.rotateZ(sx * 0.35);
  thumb.translate(-sx * w * 0.12, -0.022, w * 0.38);
  return mergeGeometries([palm, thumb]);
}

export function thighRings(s) {
  const r = s.legW / 2, L = s.thigh;
  return [
    [0.078, 0, 0],
    [0.056, r * 0.8, r * 0.84],
    [0.014, r * 1.08, r * 1.08, 0, 0.004],
    [-L * 0.3, r * 1.0, r * 1.02, 0, 0.008],
    [-L * 0.78, r * 0.8, r * 0.84, 0, 0.004],
    [-L, r * 0.68, r * 0.74],
    [-L - 0.034, r * 0.5, r * 0.56],
    [-L - 0.05, 0, 0],
  ];
}

export function shinRings(s) {
  const r = s.legW / 2, L = s.shin;
  return [
    [0.046, 0, 0],
    [0.03, r * 0.56, r * 0.6],
    [0.0, r * 0.7, r * 0.76],
    [-L * 0.26, r * 0.74, r * 0.82, 0, -0.012],
    [-L * 0.62, r * 0.56, r * 0.6, 0, -0.004],
    [-L * 0.93, r * 0.44, r * 0.48],
    [-L - 0.03, r * 0.43, r * 0.48],
  ];
}

// Shoe, sole at y = 0, toes towards +z. Built as a loft along y and turned.
export function shoeGeo(s) {
  const [fw, fh, fl] = s.foot;
  const w = fw / 2, h = fh;
  const back = -fl * 0.28;
  // [along the foot, half-width, half-height, centre height, squareness]
  const R = (t, hw, hh, cy, sq) => [back + fl * t, w * hw, h * hh, 0, -h * cy, sq];
  const g = loft([
    [back - 0.012, 0, 0, 0, -h * 0.42],
    R(0, 0.66, 0.4, 0.42, 0.5),
    R(0.16, 0.82, 0.52, 0.52, 0.5),
    R(0.42, 0.94, 0.38, 0.38, 0.55),
    R(0.74, 0.92, 0.26, 0.26, 0.6),
    R(0.95, 0.62, 0.2, 0.21, 0.5),
    [back + fl + 0.008, 0, 0, 0, -h * 0.19],
  ], 8);
  g.rotateX(Math.PI / 2);
  return g;
}

// ------------------------------------------------------------------ head
// Rows from crown to chin: [y/b, width (×a), front depth (×c), back depth (×c)].
const HEAD_ROWS = [
  [0.94, 0.5, 0.42, 0.52],
  [0.8, 0.76, 0.68, 0.8],
  [0.56, 0.93, 0.86, 0.99],
  [0.32, 0.98, 0.93, 1.04],
  [0.12, 1.0, 0.95, 1.04],
  [-0.08, 0.98, 0.97, 0.98],
  [-0.28, 0.92, 0.96, 0.86],
  [-0.46, 0.83, 0.92, 0.7],
  [-0.64, 0.72, 0.86, 0.56],
  [-0.8, 0.56, 0.76, 0.42],
  [-0.92, 0.34, 0.5, 0.3],
];
const BROW = 3, EYES = 4, BRIDGE = 5, TIP = 6, MOUTH = 7, JAW = 8, CHIN = 9;
const HN = 16;

// o: { w, h, d, nose, jaw, muzzle, hair: { front, side, back, thick } | null }
// Returns a geometry with groups 0 = face (textured), 1 = skin, 2 = hair.
export function headGeo(o) {
  const a = o.w / 2, b = o.h / 2, c = o.d / 2;
  const nose = o.nose ?? 1, jaw = o.jaw ?? 1, muzzle = o.muzzle || 0;
  const hair = o.hair || null;
  const pos = [], uv = [], isHair = [];
  const front = (k) => (k <= HN / 2 ? k : HN - k); // meridians away from the face centre
  // sculpting, in units of c (depth)
  const bump = (row, f) => {
    let z = 0;
    if (row === BROW) z += f === 0 ? 0.06 : f === 1 ? 0.1 : f === 2 ? 0.04 : 0;
    if (row === EYES) z += f === 0 ? 0.08 * nose : f === 1 ? -0.07 : 0;
    if (row === BRIDGE) z += f === 0 ? 0.17 * nose : f === 2 ? 0.04 : f === 1 ? 0.02 : 0;
    if (row === TIP) z += f === 0 ? 0.26 * nose : f === 1 ? 0.07 * nose : 0;
    if (row === MOUTH) z += f === 0 ? 0.05 : f === 1 ? 0.025 : 0;
    if (row === JAW) z += f === 0 ? 0.02 : 0;
    if (row === CHIN) z += f === 0 ? 0.09 * jaw : f === 1 ? 0.05 * jaw : 0;
    if (muzzle && row >= TIP && row <= CHIN && f <= 2) z += muzzle * (f === 2 ? 0.5 : 1);
    return z * c;
  };
  const hairY = (theta) => {
    const t = Math.abs(theta) / Math.PI; // 0 front .. 1 back
    return t < 0.5 ? lerp(hair.front, hair.side, smooth(0, 0.5, t)) : lerp(hair.side, hair.back, smooth(0.5, 1, t));
  };
  const push = (x, y, z) => {
    pos.push(x, y, z);
    uv.push(0.5 + x / (2 * a), (y / b + 1) / 1.7);
  };
  // crown pole
  push(0, b, -0.04 * c);
  isHair.push(!!hair);
  HEAD_ROWS.forEach(([yb, ws, fs, bs], row) => {
    const y = yb * b;
    const jw = yb < -0.1 ? lerp(1, 0.9 + 0.1 * jaw, smooth(-0.1, -0.9, yb)) : 1;
    for (let k = 0; k < HN; k++) {
      const th = (k / HN) * Math.PI * 2;
      const s = Math.sin(th), co = Math.cos(th);
      let x = a * ws * jw * s;
      let z = co > 0 ? c * fs * Math.pow(co, 0.8) : c * bs * co;
      z += bump(row, front(k));
      const h = !!hair && yb >= hairY(th > Math.PI ? th - Math.PI * 2 : th);
      if (h) {
        const l = Math.hypot(x / a, z / c) || 1;
        x += (x / a / l) * hair.thick;
        z += (z / c / l) * hair.thick;
      }
      isHair.push(h);
      push(x, y + (h ? hair.thick * 0.4 : 0), z);
    }
  });
  // under the jaw, where the neck goes in
  push(0, -0.97 * b, -0.12 * c);
  isHair.push(false);
  const R = HEAD_ROWS.length;
  const top = 0, bottom = 1 + R * HN;
  const vi = (row, k) => 1 + row * HN + (k % HN);
  const groups = [[], [], []];
  const faceVert = (i) => {
    if (i === top || i === bottom) return false;
    const row = Math.floor((i - 1) / HN), k = (i - 1) % HN;
    return row >= 2 && front(k) <= 3;
  };
  const addTri = (p, q, r) => {
    const g = isHair[p] && isHair[q] && isHair[r] ? 2 : faceVert(p) && faceVert(q) && faceVert(r) ? 0 : 1;
    groups[g].push(p, q, r);
  };
  for (let k = 0; k < HN; k++) addTri(top, vi(0, k), vi(0, k + 1));
  for (let row = 0; row + 1 < R; row++) {
    for (let k = 0; k < HN; k++) {
      const p = vi(row, k), q = vi(row, k + 1), r = vi(row + 1, k + 1), d = vi(row + 1, k);
      addTri(p, d, q);
      addTri(q, d, r);
    }
  }
  for (let k = 0; k < HN; k++) addTri(bottom, vi(R - 1, k + 1), vi(R - 1, k));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const idx = [];
  groups.forEach((g, i) => {
    if (g.length) geo.addGroup(idx.length, g.length, i);
    idx.push(...g);
  });
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Small ear on the side of the head (sx: +1 left).
export function earGeo(o, sx) {
  const a = o.w / 2, b = o.h / 2, c = o.d / 2;
  const g = loft([[0.045, 0, 0], [0.03, 0.012, 0.024], [-0.02, 0.013, 0.022], [-0.045, 0, 0]], 6);
  g.rotateZ(sx * 0.12);
  g.translate(sx * a * 0.96, -0.05 * b, -0.12 * c);
  return g;
}
