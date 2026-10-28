// Clara, out of the shrine: lying bound on the altar until the god burns,
// then up and after Edgar, a step or two behind him through every door,
// running when he runs.
import * as THREE from 'three';
import { buildClara } from './characters.js';
import { Animator, blobShadow, humanClips } from './rig.js';
import { approachAngle, damp } from '../engine/util.js';

export class Clara {
  constructor(game) {
    this.game = game;
    const { parts } = buildClara();
    this.parts = parts;
    this.root = parts.root;
    this.anim = new Animator(parts, humanClips());
    this.anim.play('idle', { fade: 0 });
    this.shadow = blobShadow(0.32);
    this.root.add(this.shadow);
    this.pos = new THREE.Vector3();
    this.rot = 0;
    this.path = null;
    this.pathT = 0;
    this.onUp = null;
    this.following = false;
  }

  // flat on her back, as he found her
  lie() {
    this.anim.play('getUp', { restart: true, fade: 0, speed: 0 });
    this.anim.update(0);
    this.shadow.visible = false;
  }

  wake() {
    return new Promise((res) => {
      this.anim.play('getUp', { restart: true, fade: 0.05, speed: 1.1 });
      this.onUp = res;
    });
  }

  // join him in a room, just behind where he came in (or beside him, when
  // the doorway is at his back)
  enter(room, player) {
    this.room = room;
    let x = player.pos.x, z = player.pos.z;
    for (const a of [Math.PI, Math.PI * 0.75, -Math.PI * 0.75, Math.PI / 2, -Math.PI / 2]) {
      const qx = player.pos.x + Math.sin(player.rot + a) * 0.9, qz = player.pos.z + Math.cos(player.rot + a) * 0.9;
      if (!room.nav || !room.nav.blockedAt(qx, qz)) { x = qx; z = qz; break; }
    }
    this.pos.set(x, room.floorY(x, z), z);
    this.rot = player.rot;
    this.path = null;
    this.following = true;
    this.shadow.visible = true;
    this.anim.play('idle', { fade: 0 });
    room.dynamic.add(this.root);
    this.sync();
  }

  leave() {
    if (this.room) this.room.dynamic.remove(this.root);
    this.room = null;
  }

  sync() {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.rot;
  }

  update(dt) {
    if (this.onUp && this.anim.finished) {
      const f = this.onUp;
      this.onUp = null;
      this.anim.play('idle', { fade: 0.3 });
      f();
    }
    if (this.following && this.room) this.follow(dt);
    this.anim.update(dt);
  }

  follow(dt) {
    const p = this.game.player;
    const room = this.room;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    let speed = 0;
    if (dist > 1.3) {
      this.pathT -= dt;
      if (this.pathT <= 0 || !this.path) {
        this.pathT = 0.4;
        this.path = room.nav.clear(this.pos.x, this.pos.z, p.pos.x, p.pos.z) ? [{ x: p.pos.x, z: p.pos.z }] : (room.nav.findPath(this.pos.x, this.pos.z, p.pos.x, p.pos.z) || [{ x: p.pos.x, z: p.pos.z }]);
      }
      let wp = this.path[0];
      while (wp && this.path.length > 1 && Math.hypot(wp.x - this.pos.x, wp.z - this.pos.z) < 0.3) { this.path.shift(); wp = this.path[0]; }
      if (this.path.length === 1) wp = { x: p.pos.x, z: p.pos.z };
      this.rot = approachAngle(this.rot, Math.atan2(wp.x - this.pos.x, wp.z - this.pos.z), 7 * dt);
      // keep up: she runs when he gets ahead
      speed = dist > 3 ? 3.4 : dist > 1.8 ? 2.4 : 1.4;
      this.pos.x += Math.sin(this.rot) * speed * dt;
      this.pos.z += Math.cos(this.rot) * speed * dt;
    } else this.rot = approachAngle(this.rot, Math.atan2(dx, dz), 3 * dt);
    this.pos.y = damp(this.pos.y, room.floorY(this.pos.x, this.pos.z), 14, dt);
    this.sync();
    if (speed > 2) this.anim.play('run', { fade: 0.2 });
    else if (speed > 0) this.anim.play('walk', { fade: 0.2 });
    else this.anim.play('idle', { fade: 0.3 });
  }
}
