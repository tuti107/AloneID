// The thing in the pool beneath Ashcombe House.
import * as THREE from 'three';
import { buildHorror } from './characters.js';
import { loft } from './body.js';
import { spriteMat } from './mats.js';
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
    this.minX = o.minX ?? -5.2; // no reaching him west of this
    this.reach = o.reach ?? 9.5;
    room.dynamic.add(this.root);
    // lit from below, off the pool, cold from above, and red from its maw
    this.light = new THREE.PointLight(0x9aa458, 0, 16, 1.4);
    this.light.position.set(0, 0.3, 2.2);
    this.root.add(this.light);
    this.topLight = new THREE.PointLight(0x6a80c0, 0, 14, 1.3);
    this.topLight.position.set(-0.4, 3.6, -2.0);
    this.root.add(this.topLight);
    this.roar = 0;
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
      // it writhes in the fire, sinking a little
      this.pos.y = Math.max(-1.3, this.pos.y - dt * 0.12);
      b.core.rotation.z = Math.sin(t * 9) * 0.15;
      if (this.pos.y < -5) { this.state = 'gone'; this.root.visible = false; }
    } else if (this.state === 'falling') {
      this.pos.y -= dt * (0.3 + t * 0.6);
      b.core.rotation.z = Math.sin(t * 9) * 0.15;
      if (this.pos.y < -14) { this.state = 'gone'; this.root.visible = false; }
    } else if (this.state === 'sinking') {
      // back into the pool, unhurried, watching him all the way down
      this.pos.y -= dt * (0.25 + Math.min(1, t / 3) * 0.3);
      if (this.pos.y < -5) { this.state = 'gone'; this.root.visible = false; }
    } else {
      this.pos.y = -0.6 + Math.sin(t * 0.8) * 0.12;
    }
    const burning = this.state === 'burning' || this.state === 'falling';
    const writhe = this.state === 'sealed' ? 2.2 : burning ? 3.5 : this.state === 'sinking' ? 0.6 : 1;
    b.core.rotation.y = Math.sin(t * 0.4) * 0.2;
    b.core.rotation.z = Math.sin(t * 0.33) * 0.05 * writhe;
    // the flesh heaves
    b.mass.scale.set(1 + Math.sin(t * 2.1) * 0.03 * writhe, 1 + Math.sin(t * 1.7) * 0.035 * writhe, 1 + Math.sin(t * 2.6) * 0.02 * writhe);
    // the maw breathes; it opens wide to roar, and screams when sealed or burning
    this.roar = Math.max(0, this.roar - dt * 0.8);
    const scream = this.state === 'sealed' || burning;
    const open = Math.min(1, 0.25 + 0.2 * Math.sin(t * 1.3) + this.roar + (scream ? 0.55 + Math.sin(t * 23) * 0.08 : 0));
    const m = b.maw;
    m.throat.scale.x = 0.07 + open * 0.32;
    for (const row of m.rows) row.position.x = row.userData.side * (0.03 + open * 0.2);
    m.light.intensity = burning ? 0 : 0.8 + open * 2.6;
    // human arms reaching out of it, fingers clutching at nothing
    b.arms.forEach((a, i) => {
      const ph = t * (1.1 + i * 0.13) + a.phase;
      const spasm = Math.max(0, Math.sin(t * 0.7 + a.phase * 3)) ** 8;
      a.root.rotation.x = a.baseRot.x + Math.sin(ph) * 0.18 + spasm * 0.3 * Math.sin(t * 31);
      a.root.rotation.z = a.baseRot.z + Math.sin(ph * 0.7) * 0.22;
      const curl = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(ph * 1.9)) + spasm * 0.4;
      for (const f of a.fingers) f.forEach((sg, k) => { sg.rotation.x = curl * [0.7, 1.0, 0.9][k]; });
      a.thumb.forEach((sg) => { sg.rotation.x = curl * 0.5; });
    });
    // the faces strain to get out
    b.faces.forEach((f, i) => { f.rotation.z = Math.sin(t * 0.5 + i * 2.1) * 0.12; });
    for (const tn of b.tentacles) {
      tn.segs.forEach((s, k) => {
        s.rotation.x = Math.sin(t * 1.6 * writhe + tn.phase + k * 0.55) * 0.28 * (0.4 + k * 0.12);
        s.rotation.z = Math.cos(t * 1.2 * writhe + tn.phase * 1.7 + k * 0.4) * 0.22;
      });
      tn.base.rotation.x = -0.6 + Math.sin(t * 0.7 + tn.phase) * 0.3;
    }
    // every eye follows him, and they blink out of step
    const p = g.player.pos;
    const wp = new THREE.Vector3(), lp = new THREE.Vector3();
    for (const e of b.eyes) {
      e.parent.getWorldPosition(wp);
      lp.set(p.x, p.y + 1.4, p.z);
      e.parent.worldToLocal(lp);
      e.rotation.y = Math.max(-0.7, Math.min(0.7, Math.atan2(lp.x, lp.z)));
      e.rotation.x = Math.max(-0.6, Math.min(0.6, -Math.atan2(lp.y, Math.hypot(lp.x, lp.z))));
      e.userData.blinkT -= dt;
      if (e.userData.blinkT < 0) e.userData.blinkT = 1.5 + Math.random() * 6;
      e.scale.y = e.userData.blinkT < 0.14 ? 0.12 : 1;
    }
    const sealed = this.state === 'sealed';
    b.sclera.color.setHex(sealed ? 0xd85040 : 0xc0aa44);
    this.light.intensity = burning ? 0 : 4.5 + Math.sin(t * 3) * 1.2;
    this.topLight.intensity = burning ? 0 : 11;
    this.root.position.copy(this.pos);
    // attacks
    if ((this.state === 'idle' || sealed) && g.player.alive) {
      this.attackT -= dt;
      if (this.attackT <= 0) {
        this.attackT = sealed ? 3.4 : 2.3 + Math.random() * 0.8;
        const reach = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
        if (reach < this.reach && p.x > this.minX) this.slam(p.x + (Math.random() - 0.5) * 0.6, p.z + (Math.random() - 0.5) * 0.6);
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
    const n = 8, sl = len / n;
    let parent = arm;
    for (let k = 0; k < n; k++) {
      const seg = new THREE.Group();
      seg.position.y = k === 0 ? 0 : sl;
      parent.add(seg);
      const r0 = 0.24 * (1 - k / n) + 0.05, r1 = 0.24 * (1 - (k + 1) / n) + 0.05;
      const m = new THREE.Mesh(loft([[-0.03, r0, r0 * 0.85], [sl / 2, (r0 + r1) / 2 * 1.04, (r0 + r1) / 2 * 0.86], [sl + 0.02, r1, r1 * 0.85]], 7), this.b.tentacle);
      m.castShadow = true;
      seg.add(m);
      seg.rotation.x = 0.05;
      parent = seg;
    }
    const hook = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.32, 5), this.b.bone);
    hook.position.y = sl + 0.12;
    hook.rotation.x = 0.7;
    parent.add(hook);
    arm.rotation.x = Math.PI / 2 - 1.3;
    this.slams.push({ x, z, bx, bz, t: 0, marker, group, arm, hit: false });
    this.roar = 1;
    this.game.audio.sfx('tentacle', { at: { x: bx, y: 0, z: bz } });
  }

  seal() {
    this.state = 'sealed';
    this.attackT = 2.5;
  }

  // The tide puts the fire out: it hisses away and the thing goes down
  // into the pool, burnt but alive.
  drown() {
    this.state = 'sinking';
    this.t = 0;
    for (const f of this.fires) this.root.remove(f);
    this.fires = [];
    if (this.fireLight) { this.root.remove(this.fireLight); this.fireLight = null; }
  }

  // Burnt through, it goes down into the dark below, still burning.
  fall() {
    this.state = 'falling';
    this.t = 0;
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
