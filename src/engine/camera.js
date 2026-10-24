// Fixed "pre-rendered" style cameras. Each room owns a set of authored shots
// (with floor zones) plus automatically placed corner shots. The director
// keeps the classic instant cuts, but it checks that the player is actually
// in frame and not hidden behind walls or furniture: when the current shot
// loses sight of him it cuts to the best shot that can see him, and as a
// last resort it uses a follow camera.
import * as THREE from 'three';
import { pointInPoly, rectToPoly } from './util.js';

const ASPECT = 4 / 3;
const V = new THREE.Vector3();
const A = new THREE.Vector3();
const B = new THREE.Vector3();

export class Shot {
  constructor(def) {
    this.id = def.id;
    this.pos = new THREE.Vector3(...def.pos);
    this.look = new THREE.Vector3(...def.look);
    this.fov = def.fov || 50;
    this.auto = !!def.auto;
    // 0..1: how much the view pans towards the player, within trackLimit rad
    this.track = def.track ?? (this.auto ? 0.55 : 0.3);
    this.trackLimit = def.trackLimit ?? (this.auto ? 0.8 : 0.5);
    this.zones = (def.zones || (def.zone ? [def.zone] : [])).map((z) => (z.length === 4 && typeof z[0] === 'number' ? rectToPoly(z) : z));
    this.priority = def.priority || 0;
    this.near = def.near || 0.05;
    this.hide = def.hide || [];
    this.cam = new THREE.PerspectiveCamera(this.fov, ASPECT, this.near, 100);
    this.place(this.pos, this.look);
  }
  place(pos, look) {
    if (pos !== this.pos) this.pos.copy(pos);
    if (look !== this.look) this.look.copy(look);
    this.cam.position.copy(this.pos);
    this.cam.lookAt(this.look);
    this.cam.updateMatrixWorld(true);
    this.cam.matrixWorldInverse.copy(this.cam.matrixWorld).invert();
  }
  contains(x, z) {
    for (const poly of this.zones) if (pointInPoly(x, z, poly)) return true;
    return false;
  }
}

// Something that can block the view: an oriented box taken from a mesh.
const SHRINK = {
  BoxGeometry: 1, BufferGeometry: 0.92, CylinderGeometry: 0.85, LatheGeometry: 0.8, ExtrudeGeometry: 0.85,
  IcosahedronGeometry: 0.66, SphereGeometry: 0.7, ConeGeometry: 0.6, OctahedronGeometry: 0.6, TorusGeometry: 0.6,
};

export class Occluder {
  constructor(mesh) {
    const g = mesh.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    this.box = g.boundingBox.clone();
    // Round shapes fill far less than their box: shrink it to roughly the
    // solid part so rocks and pots don't hide the player by their corners.
    const k = SHRINK[g.type] ?? 0.85;
    if (k < 1) {
      const c = this.box.getCenter(new THREE.Vector3());
      this.box.min.sub(c).multiplyScalar(k).add(c);
      this.box.max.sub(c).multiplyScalar(k).add(c);
    }
    this.mesh = mesh;
    this.inv = new THREE.Matrix4();
    this.refresh();
  }
  refresh() {
    this.inv.copy(this.mesh.matrixWorld).invert();
  }
  // Does the segment from a to b pass through the box (ignoring the ends)?
  hits(a, b, t0, t1) {
    const o = A.copy(a).applyMatrix4(this.inv);
    const e = B.copy(b).applyMatrix4(this.inv);
    const min = this.box.min, max = this.box.max;
    let lo = t0, hi = t1;
    for (const k of ['x', 'y', 'z']) {
      const d = e[k] - o[k];
      if (Math.abs(d) < 1e-9) {
        if (o[k] < min[k] || o[k] > max[k]) return false;
      } else {
        let u = (min[k] - o[k]) / d, w = (max[k] - o[k]) / d;
        if (u > w) { const s = u; u = w; w = s; }
        if (u > lo) lo = u;
        if (w < hi) hi = w;
        if (lo > hi) return false;
      }
    }
    return true;
  }
  contains(p) {
    const l = A.copy(p).applyMatrix4(this.inv);
    return this.box.containsPoint(l);
  }
}

export class CameraDirector {
  constructor(aspect = ASPECT) {
    this.cam = new THREE.PerspectiveCamera(50, aspect, 0.05, 80);
    this.shots = [];
    this.current = null;
    this.override = null; // {pos, look, fov} for cutscenes
    this.forced = null; // debug: pin a shot
    this.lookNow = new THREE.Vector3();
    this.cutCount = 0;
    this.onCut = null;
    this.room = null;
    this.occluders = [];
    this.follow = new Shot({ id: 'follow', pos: [0, 2, 0], look: [0, 0, 1], fov: 58, auto: true });
    this.follow.isFollow = true;
    this.followPos = new THREE.Vector3();
    this.pts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    this.badT = 0;
    this.dwell = 0;
    this.evalT = 0;
    this.ev = {};
  }

  setRoom(room) {
    this.room = room;
    this.occluders = room.occluders || [];
    this.shots = [...room.shots, ...(room.autoShots || [])];
    this.current = null;
    this.badT = 0;
    this.dwell = 0;
    this.evalT = 0;
  }

  // Kept for callers that only have shot definitions.
  setShots(defs) {
    this.shots = defs.map((d) => (d instanceof Shot ? d : new Shot(d)));
    this.current = null;
  }

  // Feet, chest and head of the player.
  setPoints(t) {
    this.pts[0].set(t.x, t.y + 0.25, t.z);
    this.pts[1].set(t.x, t.y + 1.05, t.z);
    this.pts[2].set(t.x, t.y + 1.62, t.z);
    return this.pts;
  }

  clear(from, to) {
    const L = from.distanceTo(to);
    if (L < 0.05) return true;
    const t0 = 0.12 / L, t1 = 1 - 0.3 / L;
    if (t1 <= t0) return true;
    for (const o of this.occluders) {
      // a camera tucked inside a box (e.g. beside a rock) isn't blocked by it
      if (o.hits(from, to, t0, t1) && !o.contains(from)) return false;
    }
    return true;
  }

  // How well a shot shows the player.
  evaluate(shot, pts, out = {}) {
    let frame = 0, vis = 0, minY = 9, maxY = -9;
    out.cx = 0;
    out.cy = 0;
    for (let i = 0; i < pts.length; i++) {
      V.copy(pts[i]).applyMatrix4(shot.cam.matrixWorldInverse);
      const behind = V.z > -0.1;
      V.applyMatrix4(shot.cam.projectionMatrix);
      if (behind) continue;
      if (i === 1) { out.cx = V.x; out.cy = V.y; }
      if (V.y < minY) minY = V.y;
      if (V.y > maxY) maxY = V.y;
      if (Math.abs(V.x) < 0.9 && Math.abs(V.y) < 0.9) {
        frame++;
        if (this.clear(shot.pos, pts[i])) vis++;
      }
    }
    out.frame = frame;
    out.vis = vis;
    out.size = Math.max(0, maxY - minY);
    out.good = vis >= 2 && frame >= 2 && out.size > 0.14;
    return out;
  }

  score(shot, e, x, z) {
    let s = e.vis * 3 + e.frame;
    if (e.size > 0.01) s -= Math.abs(Math.log(e.size / 0.45)) * 1.2;
    else s -= 6;
    s -= (Math.abs(e.cx) + Math.abs(e.cy + 0.1)) * 0.8;
    if (shot.contains(x, z)) s += 1.5 + shot.priority;
    if (!shot.auto) s += 0.8;
    if (shot === this.current) s += 1.0;
    return s;
  }

  zoneShot(x, z) {
    let best = null;
    for (const s of this.shots) if (!s.auto && s.contains(x, z) && (!best || s.priority > best.priority)) best = s;
    return best;
  }

  best(pts, x, z, exclude = null) {
    let best = null, bestS = -1e9, bestE = null;
    for (const s of this.shots) {
      if (s === exclude) continue;
      const e = this.evaluate(s, pts, {});
      const sc = this.score(s, e, x, z);
      if (sc > bestS) { best = s; bestS = sc; bestE = e; }
    }
    return { shot: best, e: bestE };
  }

  cutTo(shot) {
    if (shot === this.current) return false;
    this.current = shot;
    this.cutCount++;
    this.dwell = 0;
    this.badT = 0;
    if (this.onCut) this.onCut(shot);
    return true;
  }

  // Follow camera: high and behind the player, pulled towards the room centre,
  // rotated around him until nothing blocks the view.
  placeFollow(t, dt, snap) {
    const room = this.room;
    const r = (room && room.camRect) || [t.x - 4, t.z - 4, t.x + 4, t.z + 4, 3];
    const [x0, z0, x1, z1, h] = r;
    let dx = (x0 + x1) / 2 - t.x, dz = (z0 + z1) / 2 - t.z;
    const l = Math.hypot(dx, dz);
    if (l < 0.3) { dx = 0; dz = 1; } else { dx /= l; dz /= l; }
    const chest = this.pts[1];
    const y = Math.min(h - 0.3, t.y + 2.3);
    const pos = new THREE.Vector3();
    for (const a of [0, 0.55, -0.55, 1.1, -1.1, 1.65, -1.65, 2.3, -2.3, Math.PI]) {
      const c = Math.cos(a), s = Math.sin(a);
      const ux = dx * c - dz * s, uz = dx * s + dz * c;
      pos.set(
        Math.min(x1 - 0.3, Math.max(x0 + 0.3, t.x + ux * 2.7)),
        y,
        Math.min(z1 - 0.3, Math.max(z0 + 0.3, t.z + uz * 2.7)),
      );
      if (this.clear(pos, chest) && this.clear(pos, this.pts[2])) break;
    }
    if (snap) this.followPos.copy(pos);
    else this.followPos.lerp(pos, 1 - Math.exp(-4 * dt));
    this.follow.place(this.followPos, chest);
  }

  // target: the player's feet position (null during scripted shots)
  update(target, dt, force = false) {
    const cam = this.cam;
    if (this.override || !target) {
      const o = this.override;
      if (!o) return;
      cam.position.copy(o.pos);
      cam.fov = o.fov || 50;
      cam.near = o.near || 0.05;
      cam.updateProjectionMatrix();
      cam.lookAt(o.look);
      return;
    }
    const pts = this.setPoints(target);
    const x = target.x, z = target.z;
    let cut = false;
    if (this.forced) {
      cut = this.cutTo(this.forced) || force;
    } else if (force || !this.current) {
      const zs = this.zoneShot(x, z);
      let pick = zs && this.evaluate(zs, pts, this.ev).good ? zs : null;
      if (!pick) {
        const b = this.best(pts, x, z);
        pick = b.e && b.e.good ? b.shot : null;
      }
      if (!pick) { this.placeFollow(target, dt, true); pick = this.follow; }
      this.current = null;
      cut = this.cutTo(pick) || true;
    } else {
      this.dwell += dt;
      this.evalT -= dt;
      if (this.current === this.follow) this.placeFollow(target, dt, false);
      if (this.evalT <= 0) {
        this.evalT = 0.1;
        const cur = this.current;
        const ce = this.evaluate(cur, pts, this.ev);
        const zs = this.zoneShot(x, z);
        if (zs && zs !== cur && this.dwell > 0.35 && this.evaluate(zs, pts, {}).good) {
          cut = this.cutTo(zs);
        } else {
          if (ce.good && cur !== this.follow) this.badT = 0;
          else this.badT += 0.1;
          const lost = ce.frame === 0 || ce.vis === 0;
          if ((cur === this.follow && this.dwell > 0.5) || this.badT > 0.25 || (lost && this.dwell > 0.15)) {
            const b = this.best(pts, x, z, this.follow);
            if (b.e && b.e.good) cut = this.cutTo(b.shot);
            else if (cur !== this.follow && (lost || this.badT > 0.6)) {
              this.placeFollow(target, dt, true);
              cut = this.cutTo(this.follow);
            }
          }
        }
      }
    }
    const s = this.current;
    if (!s) return;
    cam.position.copy(s.pos);
    if (cam.fov !== s.fov || cam.near !== s.near) {
      cam.fov = s.fov;
      cam.near = s.near;
      cam.updateProjectionMatrix();
    }
    const chest = pts[1];
    const want = TMPV.copy(s.look);
    if (s.isFollow) want.copy(chest);
    else if (s.track > 0) {
      want.lerp(chest, s.track);
      // Keep the panning within a cone around the authored look direction.
      const base = TMPA.copy(s.look).sub(s.pos).normalize();
      const dir = TMPB.copy(want).sub(s.pos).normalize();
      const ang = base.angleTo(dir);
      if (ang > s.trackLimit) {
        dir.lerp(base, 1 - s.trackLimit / ang).normalize();
        want.copy(s.pos).addScaledVector(dir, s.look.distanceTo(s.pos));
      }
    }
    if (cut) this.lookNow.copy(want);
    else this.lookNow.lerp(want, 1 - Math.exp(-6 * dt));
    cam.lookAt(this.lookNow);
  }
}
const TMPV = new THREE.Vector3();
const TMPA = new THREE.Vector3();
const TMPB = new THREE.Vector3();
