// Fixed "pre-rendered" style cameras. Each room owns a set of camera shots;
// the active shot is picked from floor zones around the player and cuts
// instantly, like the classic polygon horror games.
import * as THREE from 'three';
import { pointInPoly, rectToPoly } from './util.js';

export class Shot {
  constructor(def) {
    this.id = def.id;
    this.pos = new THREE.Vector3(...def.pos);
    this.look = new THREE.Vector3(...def.look);
    this.fov = def.fov || 50;
    this.track = def.track || 0; // 0..1: how much the view turns to follow the player
    this.trackLimit = def.trackLimit ?? 1.2;
    this.zones = (def.zones || (def.zone ? [def.zone] : [])).map((z) => (z.length === 4 && typeof z[0] === 'number' ? rectToPoly(z) : z));
    this.priority = def.priority || 0;
    this.near = def.near || 0.05;
  }
  contains(x, z) {
    for (const poly of this.zones) if (pointInPoly(x, z, poly)) return true;
    return false;
  }
}

export class CameraDirector {
  constructor(aspect = 4 / 3) {
    this.cam = new THREE.PerspectiveCamera(50, aspect, 0.05, 80);
    this.shots = [];
    this.current = null;
    this.override = null; // {pos, look, fov} for cutscenes
    this.lookNow = new THREE.Vector3();
    this.cutCount = 0;
    this.onCut = null;
  }

  setShots(defs) {
    this.shots = defs.map((d) => (d instanceof Shot ? d : new Shot(d)));
    this.current = null;
  }

  pick(x, z) {
    if (this.current && this.current.contains(x, z)) return this.current;
    let best = null;
    for (const s of this.shots) {
      if (s.contains(x, z) && (!best || s.priority > best.priority)) best = s;
    }
    return best || this.current || this.shots[0];
  }

  // target: Vector3 of the player (y at chest height)
  update(target, dt, force = false) {
    const cam = this.cam;
    if (this.override) {
      const o = this.override;
      cam.position.copy(o.pos);
      cam.fov = o.fov || 50;
      cam.near = o.near || 0.05;
      cam.updateProjectionMatrix();
      cam.lookAt(o.look);
      return;
    }
    const next = this.pick(target.x, target.z);
    const cut = next !== this.current || force;
    if (cut) {
      this.current = next;
      this.cutCount++;
      if (this.onCut) this.onCut(next);
    }
    const s = this.current;
    if (!s) return;
    cam.position.copy(s.pos);
    if (cam.fov !== s.fov || cam.near !== s.near) {
      cam.fov = s.fov;
      cam.near = s.near;
      cam.updateProjectionMatrix();
    }
    const want = TMPV.copy(s.look);
    if (s.track > 0 && target) {
      want.lerp(target, s.track);
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
