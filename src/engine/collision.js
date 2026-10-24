// 2D collision on the floor plane (x, z). Static geometry is made of oriented
// boxes; actors are circles.
export class Box {
  // (x, z) centre, half extents along local x/z, rotation about y (radians,
  // matching THREE's Object3D.rotation.y).
  constructor(x, z, hw, hd, rot = 0, opts = {}) {
    this.x = x; this.z = z; this.hw = hw; this.hd = hd;
    this.solid = opts.solid !== false;
    this.low = !!opts.low; // does not block line of sight / bullets
    this.tag = opts.tag || null;
    this.owner = opts.owner || null;
    this.enabled = true;
    this.y0 = opts.y0 ?? -Infinity; // vertical extent (for stairs/landings)
    this.y1 = opts.y1 ?? Infinity;
    this.setRot(rot);
  }
  setRot(rot) {
    this.rot = rot;
    this.c = Math.cos(rot);
    this.s = Math.sin(rot);
  }
  // Local axes in world space: ax = (c, -s), az = (s, c).
  toLocal(px, pz, out) {
    const dx = px - this.x, dz = pz - this.z;
    out.x = dx * this.c - dz * this.s;
    out.z = dx * this.s + dz * this.c;
    return out;
  }
  toWorld(lx, lz, out) {
    out.x = this.x + lx * this.c + lz * this.s;
    out.z = this.z - lx * this.s + lz * this.c;
    return out;
  }
  contains(px, pz, margin = 0) {
    const l = this.toLocal(px, pz, TMP);
    return Math.abs(l.x) <= this.hw + margin && Math.abs(l.z) <= this.hd + margin;
  }
  // Distance from point to box surface (negative inside).
  distance(px, pz) {
    const l = this.toLocal(px, pz, TMP);
    const qx = Math.abs(l.x) - this.hw, qz = Math.abs(l.z) - this.hd;
    const ox = Math.max(qx, 0), oz = Math.max(qz, 0);
    return Math.hypot(ox, oz) + Math.min(Math.max(qx, qz), 0);
  }
}
const TMP = { x: 0, z: 0 };
const TMP2 = { x: 0, z: 0 };

// Push a circle at p (object with x, z) out of every enabled solid box.
// Returns the list of boxes touched (for bump detection).
export function resolveCircle(p, r, boxes, touched = null, iterations = 3, y = 0) {
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (!b.enabled || !b.solid) continue;
      if (y + 1.6 < b.y0 || y > b.y1 - 0.3) continue;
      const l = b.toLocal(p.x, p.z, TMP);
      const cx = Math.max(-b.hw, Math.min(b.hw, l.x));
      const cz = Math.max(-b.hd, Math.min(b.hd, l.z));
      let dx = l.x - cx, dz = l.z - cz;
      let d2 = dx * dx + dz * dz;
      if (d2 > r * r) continue;
      let nx, nz, push;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2);
        nx = dx / d; nz = dz / d;
        push = r - d;
      } else {
        // Centre inside the box: leave along the axis of least penetration.
        const px = b.hw - Math.abs(l.x), pz = b.hd - Math.abs(l.z);
        if (px < pz) { nx = Math.sign(l.x) || 1; nz = 0; push = px + r; }
        else { nx = 0; nz = Math.sign(l.z) || 1; push = pz + r; }
      }
      // Rotate the local normal back to world space.
      const wx = nx * b.c + nz * b.s;
      const wz = -nx * b.s + nz * b.c;
      p.x += wx * push;
      p.z += wz * push;
      moved = true;
      if (touched && !touched.includes(b)) touched.push(b);
    }
    if (!moved) break;
  }
  return touched;
}

// Separate two circles (actors). Mass ratio decides who moves.
export function separateCircles(a, ra, b, rb, wa = 0.5) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const d2 = dx * dx + dz * dz;
  const rr = ra + rb;
  if (d2 >= rr * rr || d2 < 1e-12) return false;
  const d = Math.sqrt(d2);
  const pen = rr - d;
  const nx = dx / d, nz = dz / d;
  a.x -= nx * pen * wa;
  a.z -= nz * pen * wa;
  b.x += nx * pen * (1 - wa);
  b.z += nz * pen * (1 - wa);
  return true;
}

// Segment vs box: returns entry fraction t in [0,1] or -1.
export function segmentBox(b, x0, z0, x1, z1) {
  const a = b.toLocal(x0, z0, TMP);
  const ax = a.x, az = a.z;
  const e = b.toLocal(x1, z1, TMP2);
  const dx = e.x - ax, dz = e.z - az;
  let tmin = 0, tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (ax < -b.hw || ax > b.hw) return -1;
  } else {
    let t1 = (-b.hw - ax) / dx, t2 = (b.hw - ax) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  if (Math.abs(dz) < 1e-9) {
    if (az < -b.hd || az > b.hd) return -1;
  } else {
    let t1 = (-b.hd - az) / dz, t2 = (b.hd - az) / dz;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  return tmin;
}

export function lineOfSight(boxes, x0, z0, x1, z1, ignoreLow = true) {
  for (const b of boxes) {
    if (!b.enabled || !b.solid) continue;
    if (ignoreLow && b.low) continue;
    if (segmentBox(b, x0, z0, x1, z1) >= 0) return false;
  }
  return true;
}
