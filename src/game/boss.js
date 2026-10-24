// The thing in the pool beneath Ashcombe House.
import * as THREE from 'three';
import { buildHorror } from './characters.js';
import { frustum } from '../engine/geom.js';
import { C, spriteMat } from './mats.js';
import { damp, noise1 } from '../engine/util.js';

export class Horror {
  constructor(game, room, o) {
    this.game = game;
    this.room = room;
    const b = buildHorror();
    this.b = b;
    this.root = b.root;
    this.pos = new THREE.Vector3(o.x, -4.5, o.z);
    this.root.position.copy(this.pos);
    this.root.scale.setScalar(1.7);
    this.state = 'hidden';
    this.t = 0;
    this.attackT = 2.5;
    this.slams = [];
    this.targetable = false;
    this.solid = false;
    this.alive = true;
    this.radius = 2;
    this.invulnerable = true;
    this.fires = [];
    this.root.visible = false;
    this.edge = o.edge; // z of the pool edge
    room.dynamic.add(this.root);
    this.light = new THREE.PointLight(0x60ff90, 0, 9, 2);
    this.light.position.set(0, 2.2, 1.2);
    this.root.add(this.light);
  }

  rise(instant = false) {
    this.root.visible = true;
    this.state = instant ? 'idle' : 'rising';
    if (instant) this.pos.y = -0.6;
    this.t = 0;
  }

  update(dt) {
    if (this.state === 'hidden' || this.state === 'gone') return;
    this.t += dt;
    const t = this.t;
    const g = this.game;
    const b = this.b;
    // body motion
    if (this.state === 'rising') {
      this.pos.y = damp(this.pos.y, -0.6, 1.2, dt);
      if (this.pos.y > -0.75) this.state = 'idle';
    } else if (this.state === 'burning') {
      this.pos.y -= dt * 0.55;
      b.core.rotation.z = Math.sin(t * 9) * 0.15;
      if (this.pos.y < -5) { this.state = 'gone'; this.root.visible = false; }
    } else {
      this.pos.y = -0.6 + Math.sin(t * 0.8) * 0.12;
    }
    const writhe = this.state === 'sealed' ? 2.2 : this.state === 'burning' ? 3.5 : 1;
    b.core.rotation.y = Math.sin(t * 0.4) * 0.2;
    b.mass.scale.set(1.2 + Math.sin(t * 2.1) * 0.04 * writhe, 1.5 + Math.sin(t * 1.7) * 0.05 * writhe, 1.0);
    for (const tn of b.tentacles) {
      tn.segs.forEach((s, k) => {
        s.rotation.x = Math.sin(t * 1.6 * writhe + tn.phase + k * 0.55) * 0.28 * (0.4 + k * 0.12);
        s.rotation.z = Math.cos(t * 1.2 * writhe + tn.phase * 1.7 + k * 0.4) * 0.22;
      });
      tn.base.rotation.x = -0.6 + Math.sin(t * 0.7 + tn.phase) * 0.3;
    }
    // eyes track the player
    const p = g.player.pos;
    for (const e of b.eyes) {
      const wp = new THREE.Vector3();
      e.getWorldPosition(wp);
      e.rotation.y = Math.atan2(p.x - wp.x, p.z - wp.z) * 0.6;
      e.rotation.x = -0.2;
    }
    const sealed = this.state === 'sealed';
    for (const e of b.eyes) e.material.color.setHex(sealed ? 0xd85040 : 0xd8d8b0);
    this.light.intensity = this.state === 'burning' ? 0 : 6 + Math.sin(t * 3) * 2;
    this.root.position.copy(this.pos);
    // attacks
    if ((this.state === 'idle' || sealed) && g.player.alive) {
      this.attackT -= dt;
      if (this.attackT <= 0) {
        this.attackT = sealed ? 3.4 : 2.3 + Math.random() * 0.8;
        const reach = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
        if (reach < 9.5 && p.x > -5.2) this.slam(p.x + (Math.random() - 0.5) * 0.6, p.z + (Math.random() - 0.5) * 0.6);
      }
    }
    for (let i = this.slams.length - 1; i >= 0; i--) {
      const s = this.slams[i];
      s.t += dt;
      const k = s.t;
      s.marker.scale.setScalar(Math.min(1, k / 0.9) * 1.6);
      s.marker.material.opacity = k < 0.9 ? 0.25 + k * 0.5 : Math.max(0, 0.7 - (k - 0.9) * 1.5);
      // tentacle: raised until 0.9s, slams down, lies, withdraws
      let pitch;
      if (k < 0.9) pitch = -1.3 + k * 0.2;
      else if (k < 1.05) pitch = -1.12 + ((k - 0.9) / 0.15) * 1.12;
      else if (k < 1.6) pitch = 0;
      else pitch = -(k - 1.6) * 2.5;
      s.arm.rotation.x = Math.PI / 2 + pitch;
      s.arm.position.y = k > 1.6 ? -(k - 1.6) * 3 : 0;
      if (!s.hit && k >= 1.05) {
        s.hit = true;
        g.audio.sfx('slam', { at: { x: s.x, y: 0, z: s.z } });
        g.burst('splash', s.x, 0.1, s.z, { n: 10 });
        g.shake(0.12, 0.3);
        const d = Math.hypot(p.x - s.x, p.z - s.z);
        if (d < 1.1) g.player.damage(22, s.bx, s.bz, { knock: 4.5 });
      }
      if (k > 2.4) {
        this.room.dynamic.remove(s.group);
        this.room.dynamic.remove(s.marker);
        this.slams.splice(i, 1);
      }
    }
    // fire
    for (const f of this.fires) {
      const kk = 1 + noise1(t * 6 + f.userData.ph) * 0.3;
      f.scale.set(f.userData.s * 0.6 * (2 - kk), f.userData.s * kk, 1);
    }
  }

  slam(x, z) {
    const room = this.room;
    const bx = Math.max(-4.5, Math.min(4.5, x * 0.6)), bz = this.edge;
    const marker = new THREE.Mesh(new THREE.CircleGeometry(0.8, 14), new THREE.MeshBasicMaterial({ color: 0x300000, transparent: true, opacity: 0.2, depthWrite: false }));
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(x, 0.02, z);
    room.dynamic.add(marker);
    const group = new THREE.Group();
    group.position.set(bx, 0.1, bz);
    group.rotation.y = Math.atan2(x - bx, z - bz);
    room.dynamic.add(group);
    const arm = new THREE.Group();
    group.add(arm);
    const len = Math.hypot(x - bx, z - bz) + 0.6;
    const n = 7;
    const fl = C(0x2a3a30, { phong: true, shininess: 60 });
    const dk = C(0x101810, { phong: true });
    let parent = arm;
    for (let k = 0; k < n; k++) {
      const seg = new THREE.Group();
      seg.position.y = k === 0 ? 0 : len / n;
      parent.add(seg);
      const r0 = 0.24 * (1 - k / n) + 0.05;
      const m = new THREE.Mesh(frustum(r0 * 2, r0 * 2, r0 * 1.7, r0 * 1.7, len / n + 0.02), k % 2 ? fl : dk);
      m.castShadow = true;
      seg.add(m);
      seg.rotation.x = 0.05;
      parent = seg;
    }
    arm.rotation.x = Math.PI / 2 - 1.3;
    this.slams.push({ x, z, bx, bz, t: 0, marker, group, arm, hit: false });
    this.game.audio.sfx('tentacle', { at: { x: bx, y: 0, z: bz } });
  }

  seal() {
    this.state = 'sealed';
    this.attackT = 2.5;
  }

  ignite() {
    this.state = 'burning';
    this.t = 0;
    for (const s of this.slams) { this.room.dynamic.remove(s.group); this.room.dynamic.remove(s.marker); }
    this.slams = [];
    for (let i = 0; i < 26; i++) {
      const f = new THREE.Sprite(spriteMat('flame', 0xffffff, 0.95));
      const s = 0.6 + Math.random() * 1.2;
      f.userData.s = s;
      f.userData.ph = Math.random() * 10;
      f.position.set((Math.random() - 0.5) * 2.4, 0.4 + Math.random() * 2.8, (Math.random() - 0.2) * 1.4);
      this.root.add(f);
      this.fires.push(f);
    }
    this.fireLight = new THREE.PointLight(0xff7a2a, 40, 16, 1.6);
    this.fireLight.position.set(0, 2, 1);
    this.root.add(this.fireLight);
  }
}
