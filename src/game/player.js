// Edgar Hale: movement (tank or camera-relative), pushing, combat, held lamp.
import * as THREE from 'three';
import { buildInvestigator } from './characters.js';
import { Animator, blobShadow, addXray, brighten } from './rig.js';
import { resolveCircle, separateCircles } from '../engine/collision.js';
import { angleDiff, approachAngle, damp, noise1 } from '../engine/util.js';
import { ITEMS } from './items.js';
import * as F from './furniture.js';

const WALK = 1.4, RUN = 3.1, BACK = 0.85, TURN = 2.7, PUSH = 0.55;

export class Player {
  constructor(game) {
    const { parts, clips } = buildInvestigator();
    this.game = game;
    this.parts = parts;
    this.root = parts.root;
    this.anim = new Animator(parts, clips);
    this.anim.play('idle', { fade: 0 });
    this.pos = new THREE.Vector3();
    this.rot = 0;
    this.radius = 0.27;
    this.hp = 100;
    this.maxHp = 100;
    this.state = 'idle';
    this.stateT = 0;
    this.busy = 0;
    this.knock = new THREE.Vector2();
    this.invuln = 0;
    this.bumpT = 0;
    this.bumpBox = null;
    this.pushing = null;
    this.combo = 0;
    this.comboT = 0;
    this.basis = null;
    this.moving = false;
    this.root.add(blobShadow(0.38));

    // lamp hanging from the left hand
    this.lamp = F.oilLamp();
    this.lamp.scale.setScalar(0.9);
    this.lamp.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    this.lampHolder = new THREE.Group();
    parts.lGrip.add(this.lampHolder);
    this.lampHolder.add(this.lamp);
    this.lamp.position.set(0, -0.3, 0.02);
    this.lampFlame = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffd090, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.lampFlame.scale.set(0.05, 0.09, 1);
    this.lampFlame.position.set(0, 0.2, 0);
    this.lamp.add(this.lampFlame);
    this.lampLight = new THREE.PointLight(0xffa860, 0, 12, 2);
    this.lampLight.position.set(0, 0.22, 0);
    this.lamp.add(this.lampLight);
    // the storm lantern of the second act, with the tower's flame in it
    this.lantern = F.stormLantern();
    this.lantern.scale.setScalar(1.15);
    this.lantern.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    this.lantern.position.set(0, -0.36, 0.02);
    this.lampHolder.add(this.lantern);
    this.lanternFlame = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xfff0c0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.lanternFlame.scale.set(0.06, 0.1, 1);
    this.lanternFlame.position.set(0, 0.12, 0);
    this.lantern.add(this.lanternFlame);
    this.lanternLight = new THREE.PointLight(0xffe0a0, 0, 13, 1.8);
    this.lanternLight.position.set(0, 0.14, 0);
    this.lantern.add(this.lanternLight);
    this.lampHolder.visible = false;

    // weapons in the right hand
    this.weaponObjs = {};
    const poker = ITEMS.poker.model();
    poker.position.set(0, -0.06, 0.04);
    poker.rotation.x = Math.PI - 0.5;
    poker.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const pw = new THREE.Group();
    pw.add(poker);
    const gun = ITEMS.revolver.model();
    gun.rotation.x = Math.PI / 2;
    gun.position.set(0, -0.02, 0.02);
    const gw = new THREE.Group();
    gw.add(gun);
    const cut = ITEMS.cutlass.model();
    cut.position.set(0, -0.06, 0.04);
    cut.rotation.x = Math.PI - 0.5;
    cut.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const cw = new THREE.Group();
    cw.add(cut);
    this.weaponObjs.poker = pw;
    this.weaponObjs.revolver = gw;
    this.weaponObjs.cutlass = cw;
    for (const w of Object.values(this.weaponObjs)) {
      w.visible = false;
      parts.rGrip.add(w);
    }
    this.muzzle = new THREE.PointLight(0xffd080, 0, 6, 2);
    this.muzzle.position.set(0, -0.2, 0.05);
    parts.rGrip.add(this.muzzle);
    brighten(this.root);
    this.xray = addXray(this.root, 0xf0d898);
  }

  place(x, z, rot) {
    this.pos.set(x, 0, z);
    this.rot = rot;
    const room = this.game.room;
    if (room) this.pos.y = room.floorY(x, z);
    this.knock.set(0, 0);
    this.pushing = null;
    this.bumpT = 0;
    this.sync();
  }

  sync() {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.rot;
  }

  get alive() { return this.state !== 'dead'; }
  get fx() { return Math.sin(this.rot); }
  get fz() { return Math.cos(this.rot); }

  refreshHeld() {
    const g = this.game;
    const oil = g.inv.has('lamp') && !!g.flags.lampLit;
    this.holdsLantern = g.inv.has('lantern') && !!g.flags.lanternLit;
    this.lampHolder.visible = oil || this.holdsLantern;
    this.lamp.visible = oil;
    this.lantern.visible = this.holdsLantern;
    for (const [id, w] of Object.entries(this.weaponObjs)) w.visible = g.inv.equipped === id;

  }

  canAct() {
    return !this.game.locked && this.busy === 0 && this.alive && (this.state === 'idle' || this.state === 'move' || this.state === 'push');
  }

  update(dt) {
    const g = this.game;
    const input = g.input;
    const room = g.room;
    // no silhouette for a body on the floor (its feet go through it)
    this.xray.visible = this.state !== 'dead';
    this.stateT += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.comboT = Math.max(0, this.comboT - dt);

    if (this.state === 'hit' && this.stateT > 0.42) this.setState('idle');
    if (this.state === 'attack' && this.anim.finished) this.setState('idle');
    if (this.state === 'scripted' && this.anim.finished && this.scriptedDone) { this.scriptedDone(); this.scriptedDone = null; }

    let move = 0, turn = 0, run = false;
    if (this.autoWalk && (this.state === 'idle' || this.state === 'move')) {
      const aw = this.autoWalk;
      const dx = aw.x - this.pos.x, dz = aw.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      // Something in the way (furniture, a monster): stop there instead of
      // walking on the spot until the time runs out.
      if (d < aw.best - 0.01) { aw.best = d; aw.stuck = 0; }
      else if (Math.abs(angleDiff(this.rot, want)) < 0.6) aw.stuck += dt;
      if (d < 0.08 || aw.stuck > 0.5 || this.stateT > 8) { this.autoWalk = null; aw.res(); }
      else {
        this.rot = approachAngle(this.rot, want, 7 * dt);
        move = Math.min(1, d / 0.25);
      }
    }
    // one button does everything: examine, open, take or fight
    if (this.canAct() && (input.pressed('action') || input.pressed('attack'))) {
      input.consume('action', 'attack');
      g.contextAction();
    }
    if (this.canAct()) {
      if (g.settings.controls === 'modern') {
        const ax = input.axis.x, ay = input.axis.y;
        const mag = Math.min(1, Math.hypot(ax, ay));
        if (mag > 0.2) {
          const dirIn = Math.atan2(ax, -ay);
          // Directions are read relative to the camera when the stick is
          // pushed. While it stays held the same way the old basis is kept,
          // so a camera cut doesn't suddenly flip where you're walking;
          // swing the stick somewhere new and the current view is used.
          if (!this.basis || Math.abs(angleDiff(this.basis.dirIn, dirIn)) > 0.9) {
            const d = g.director.controlDir();
            this.basis = { fx: d.x, fz: d.z, dirIn };
          }
          const { fx, fz } = this.basis;
          const dx = fx * -ay - fz * ax, dz = fz * -ay + fx * ax;
          let want = Math.atan2(dx, dz);
          if (this.pushing) {
            // square up to the furniture and shove it straight along its track
            const ax2 = this.pushing.axis;
            const sgn = Math.sign(Math.sin(want) * ax2[0] + Math.cos(want) * ax2[1]) || 1;
            const along = Math.atan2(ax2[0] * sgn, ax2[1] * sgn);
            if (Math.abs(angleDiff(want, along)) < 1.25) want = along;
            else this.pushing = null;
          }
          const diff = angleDiff(this.rot, want);
          this.rot = approachAngle(this.rot, want, 11 * dt);
          move = Math.abs(diff) < 1.2 ? Math.min(1, mag / 0.85) * Math.max(0.25, Math.cos(diff)) : 0;
          this.turningVisual = move === 0;
          run = input.down('run') || (input.analog && mag > 0.92);
        } else this.basis = null;
      } else {
        if (input.down('up')) move = 1;
        else if (input.down('down')) move = -1;
        if (input.down('left')) turn += 1;
        if (input.down('right')) turn -= 1;
        // touch has no run button: push the stick all the way to run
        run = (input.down('run') || (input.analog && Math.hypot(input.axis.x, input.axis.y) > 0.92)) && move > 0;
      }
    }

    // --- movement
    let speed = 0;
    if (this.state === 'idle' || this.state === 'move' || this.state === 'push') {
      this.rot += turn * TURN * dt * (run ? 0.85 : 1);
      if (move > 0) speed = (run ? RUN : WALK) * Math.min(1, move);
      else if (move < 0) speed = -BACK;
      if (this.pushing) speed = Math.min(speed, PUSH);
      // deep water drags at his legs
      const room = this.game.room;
      if (speed && room && room.wade) speed *= room.wade(this.pos.x, this.pos.z);
      if (speed > 0) this.setState(this.pushing ? 'push' : 'move');
      else if (speed < 0 || turn) this.setState('move');
      else this.setState('idle');
    }
    this.moving = speed !== 0;
    const nx = this.pos.x + this.fx * speed * dt + this.knock.x * dt;
    const nz = this.pos.z + this.fz * speed * dt + this.knock.y * dt;
    this.knock.multiplyScalar(Math.exp(-7 * dt));

    const p = { x: nx, z: nz };
    // pushing moves the object first
    if (this.pushing && speed > 0) {
      const ps = this.pushing;
      const d = this.fx * ps.axis[0] + this.fz * ps.axis[1];
      if (Math.abs(d) > 0.6) ps.push(Math.sign(d) * speed * dt * Math.abs(d), g);
      else this.pushing = null;
    }
    const touched = [];
    if (room) {
      resolveCircle(p, this.radius, room.colliders, touched, 3, this.pos.y);
      for (const m of room.monsters) {
        if (!m.solid) continue;
        const mp = { x: m.pos.x, z: m.pos.z };
        if (separateCircles(p, this.radius, mp, m.radius, 0.7)) {
          m.pos.x = mp.x;
          m.pos.z = mp.z;
        }
      }
      resolveCircle(p, this.radius, room.colliders, null, 1, this.pos.y);
    }
    this.pos.x = p.x;
    this.pos.z = p.z;

    // --- bump logic: doors and pushables in front of us
    let bumped = null;
    if (speed > 0) {
      for (const b of touched) {
        if (b.tag !== 'door' && b.tag !== 'push') continue;
        const l = b.toLocal(this.pos.x, this.pos.z, { x: 0, z: 0 });
        const cx = Math.max(-b.hw, Math.min(b.hw, l.x)), cz = Math.max(-b.hd, Math.min(b.hd, l.z));
        const w = b.toWorld(cx, cz, { x: 0, z: 0 });
        const ang = Math.atan2(w.x - this.pos.x, w.z - this.pos.z);
        // walking into it within ~60° counts (diagonal approaches included)
        if (Math.abs(angleDiff(this.rot, ang)) < 1.05) { bumped = b; break; }
      }
    }
    if (bumped && bumped === this.bumpBox) this.bumpT += dt;
    else { this.bumpT = 0; this.bumpBox = bumped; }
    if (this.pushing && speed > 0) {
      // stay in contact while the furniture slides away from us
      const b = this.pushing.box;
      const near = b.distance(this.pos.x, this.pos.z) < this.radius + 0.08;
      const l = b.toLocal(this.pos.x, this.pos.z, { x: 0, z: 0 });
      const w = b.toWorld(Math.max(-b.hw, Math.min(b.hw, l.x)), Math.max(-b.hd, Math.min(b.hd, l.z)), { x: 0, z: 0 });
      const facing = Math.abs(angleDiff(this.rot, Math.atan2(w.x - this.pos.x, w.z - this.pos.z))) < 0.9;
      if (!near || !facing) this.pushing = null;
    }
    if (bumped && this.canAct()) {
      if (bumped.tag === 'push' && this.bumpT > 0.3 && !this.pushing) {
        const ps = bumped.owner;
        if (ps && ps.enabled) {
          const d = this.fx * ps.axis[0] + this.fz * ps.axis[1];
          if (Math.abs(d) > 0.45) this.pushing = ps;
        }
      }
      if (bumped.tag === 'door' && this.bumpT > 0.3 && !run) {
        this.bumpT = -10;
        const door = bumped.owner;
        g.run(() => g.useDoor(room, door));
      } else if (bumped.tag === 'door' && this.bumpT > 0.15 && run) {
        this.bumpT = -10;
        g.run(() => g.useDoor(room, bumped.owner));
      }
    }
    if (this.pushing && speed <= 0) this.pushing = null;

    // floor height (stairs)
    if (room) this.pos.y = damp(this.pos.y, room.floorY(this.pos.x, this.pos.z), 18, dt);
    this.sync();

    // --- animation
    if (this.state === 'move' || this.state === 'idle' || this.state === 'push') {
      if (this.pushing && speed > 0) this.anim.play('push', { fade: 0.2 });
      else if (speed > 0) this.anim.play(run ? 'run' : 'walk', { fade: 0.18, speed: run ? 1 : Math.max(0.6, speed / WALK) });
      else if (speed < 0) this.anim.play('back', { fade: 0.2 });
      else if (turn || this.turningVisual) this.anim.play('turn', { fade: 0.2 });
      else this.anim.play('idle', { fade: 0.25 });
    }
    this.turningVisual = false;
    const evs = this.anim.update(dt);
    for (const e of evs) this.onAnimEvent(e, run);

    // lamp: keep upright and flicker
    if (this.lampHolder.visible) {
      const q = new THREE.Quaternion();
      this.lampHolder.parent.getWorldQuaternion(q);
      this.lampHolder.quaternion.copy(q.invert()).multiply(this.root.quaternion);
      const t = g.time;
      const f = 1 + noise1(t * 7) * 0.12 + noise1(t * 23) * 0.05;
      this.lampLight.intensity = this.lamp.visible ? (g.room && g.room.dark ? 16 : 9) * f * (g.lampBoost || 1) : 0;
      this.lampFlame.scale.set(0.05 * (2 - f), 0.09 * f, 1);
      // the tower's flame hardly flickers at all
      const f2 = 1 + noise1(t * 3) * 0.04;
      this.lanternLight.intensity = this.lantern.visible ? 14 * f2 : 0;
      this.lanternFlame.scale.set(0.06 * (2 - f2), 0.1 * f2, 1);
    } else { this.lampLight.intensity = 0; this.lanternLight.intensity = 0; }
    this.muzzle.intensity = Math.max(0, this.muzzle.intensity - dt * 120);
  }

  walkTo(x, z) {
    return new Promise((res) => { this.autoWalk = { x, z, res, best: Infinity, stuck: 0 }; });
  }

  setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.stateT = 0;
  }

  onAnimEvent(e, run) {
    const g = this.game;
    if (e === 'step') g.footstep(this, run);
    else if (e === 'hit') g.meleeHit(this, this.attackDef);
    else if (e === 'fire') g.fireGun(this, this.attackDef);
    else if (e === 'thud') g.audio.sfx('thud', { at: this.pos });
    if (this.onEvent) this.onEvent(e);
  }

  attack() {
    const g = this.game;
    const wid = g.inv.equipped;
    const w = wid ? ITEMS[wid].weapon : null;
    this.pushing = null;
    if (!w) {
      const kick = this.comboT > 0 && this.combo === 1;
      this.combo = kick ? 0 : 1;
      this.comboT = kick ? 0 : 0.85;
      this.attackDef = kick ? { dmg: 11, range: 1.15, arc: 0.85, knock: 2.2, kind: 'kick' } : { dmg: 7, range: 0.95, arc: 0.8, knock: 1.0, kind: 'punch' };
      this.setState('attack');
      this.anim.play(kick ? 'kick' : 'punch', { restart: true, fade: 0.06 });
      g.audio.sfx('whoosh', { at: this.pos, rate: kick ? 0.8 : 1.1 });
      return;
    }
    if (w.kind === 'melee') {
      this.attackDef = { dmg: w.dmg, range: w.range, arc: 0.95, knock: 2.0, kind: w.blade ? 'blade' : 'blunt' };
      this.setState('attack');
      this.anim.play(w.clip, { restart: true, fade: 0.08 });
      g.audio.sfx('whoosh', { at: this.pos, rate: 0.7, delay: 0.25 });
      return;
    }
    if (w.kind === 'gun') {
      if (g.inv.ammo <= 0) {
        g.audio.sfx('click', { at: this.pos });
        g.notify('弾が切れている。');
        return;
      }
      const target = g.autoAim(this, 0.75, w.range);
      if (target) this.rot = Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z);
      this.attackDef = { dmg: w.dmg, range: w.range, kind: 'gun' };
      this.setState('attack');
      this.anim.play('shoot', { restart: true, fade: 0.04 });
    }
  }

  damage(n, fromX, fromZ, o = {}) {
    const g = this.game;
    if (!this.alive || this.invuln > 0 || g.godMode) return false;
    this.hp = Math.max(0, this.hp - n);
    this.invuln = o.invuln ?? 0.75;
    const dx = this.pos.x - fromX, dz = this.pos.z - fromZ;
    const l = Math.hypot(dx, dz) || 1;
    const k = o.knock ?? 2.6;
    this.knock.set((dx / l) * k, (dz / l) * k);
    this.pushing = null;
    g.onPlayerHurt(n);
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    if (this.state !== 'scripted') {
      this.setState('hit');
      this.anim.play('hit', { restart: true, fade: 0.05 });
    }
    return true;
  }

  heal(n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  die() {
    this.state = 'dead';
    this.stateT = 0;
    this.xray.visible = false;
    this.anim.play('death', { restart: true, fade: 0.1 });
    this.game.onPlayerDeath();
  }

  // Play a one-shot clip as part of a script; resolves when it ends.
  playClip(name, o = {}) {
    return new Promise((res) => {
      this.setState('scripted');
      this.anim.play(name, { restart: true, fade: o.fade ?? 0.12 });
      this.scriptedDone = () => {
        if (this.state === 'scripted') this.setState('idle');
        res();
      };
      if (o.onEvent) this.onEvent = (e) => { o.onEvent(e); };
      else this.onEvent = null;
    });
  }
}
