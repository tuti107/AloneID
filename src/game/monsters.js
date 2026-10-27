// Monster actors and their AI.
import * as THREE from 'three';
import { Animator, blobShadow, addXray } from './rig.js';
import * as CH from './characters.js';
import { resolveCircle, separateCircles } from '../engine/collision.js';
import { angleDiff, approachAngle, approach, damp, clamp } from '../engine/util.js';
import { tex } from '../engine/textures.js';
import { loft } from './body.js';

const TYPES = {
  butler: { build: CH.buildButler, hp: 45, dmg: 12, speed: 0.78, turn: 2.6, range: 1.05, sight: 9, cd: 0.8, radius: 0.3, voice: 'zombie', stagger: 0 },
  maid: { build: CH.buildMaid, hp: 40, dmg: 11, speed: 0.8, turn: 2.6, range: 1.05, sight: 9, cd: 0.9, radius: 0.3, voice: 'zombie', stagger: 0 },
  zombie: { build: CH.buildButler, hp: 45, dmg: 12, speed: 0.75, turn: 2.6, range: 1.05, sight: 9, cd: 0.9, radius: 0.3, voice: 'zombie', stagger: 0 },
  silas: { build: CH.buildSilas, hp: 75, dmg: 15, speed: 0.92, turn: 2.8, range: 1.05, sight: 10, cd: 0.7, radius: 0.3, voice: 'zombie', stagger: 0 },
  cook: { build: CH.buildCook, hp: 115, dmg: 22, speed: 0.82, turn: 2.2, range: 1.3, sight: 10, cd: 1.1, radius: 0.42, voice: 'cook', stagger: 14 },
  ghoul: { build: CH.buildGhoul, hp: 32, dmg: 10, speed: 2.3, turn: 6, range: 1.0, sight: 12, cd: 0.6, radius: 0.3, voice: 'ghoul', stagger: 0 },
  // the drowned crew: slow, hard to put down, heavy-handed
  thrall: { build: (o) => CH.buildThrall({ seed: o.seed || 1 }), hp: 64, dmg: 15, speed: 0.62, turn: 2.2, range: 1.1, sight: 10, cd: 1.0, radius: 0.33, voice: 'thrall', stagger: 14 },
  ancestor: { build: (o) => CH.buildAncestor({ seed: o.seed || 1 }), hp: 55, dmg: 14, speed: 0.55, turn: 2.0, range: 1.05, sight: 9, cd: 1.2, radius: 0.3, voice: 'zombie', stagger: 12 },
  stoker: { build: CH.buildStoker, hp: 120, dmg: 22, speed: 0.78, turn: 2.0, range: 1.35, sight: 10, cd: 1.2, radius: 0.42, voice: 'cook', stagger: 16 },
};

export class Monster {
  constructor(game, room, o) {
    const T = o.T || TYPES[o.type];
    this.game = game;
    this.room = room;
    this.id = o.id;
    this.type = o.type;
    this.T = { ...T, ...(o.stats || {}) };
    const { parts, clips } = T.build(o);
    this.parts = parts;
    this.root = parts.root;
    this.anim = new Animator(parts, clips);
    this.anim.play('idle', { fade: 0, t: Math.random() * 3 });
    this.root.add(blobShadow(0.42));
    this.pos = new THREE.Vector3(o.x, 0, o.z);
    this.rot = o.rot || 0;
    this.home = { x: o.x, z: o.z, rot: o.rot || 0 };
    this.radius = this.T.radius;
    this.maxHp = this.hp = this.T.hp;
    this.state = o.dormant ? 'dormant' : 'idle';
    this.stateT = 0;
    this.solid = true;
    this.knock = new THREE.Vector2();
    this.path = null;
    this.pathT = 0;
    this.attackCd = 0;
    this.onDeath = o.onDeath || null;
    this.onNotice = o.onNotice || null;
    this.noticed = false;
    this.sightOverride = o.sight;
    this.leash = o.leash || null; // optional rect the monster stays in
    this.growlT = 2 + Math.random() * 4;
    this.xray = addXray(this.root, 0xa83a2a);
    this.xray.visible = false;
    this.sync();
  }

  get alive() { return this.state !== 'dead'; }
  // chasing or fighting the player
  get hunting() { return this.state === 'chase' || this.state === 'attack' || this.state === 'leap' || this.state === 'hurt'; }
  get player() { return this.game.player; }

  setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.stateT = 0;
  }

  wake() {
    if (this.state === 'dormant' || this.state === 'idle') this.setState('chase');
  }

  sync() {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.rot;
  }

  canSee(p) {
    const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    const sight = this.sightOverride ?? this.T.sight;
    if (d > sight) return false;
    if (d < 2.2) return true;
    if (this.game.room.dark && !this.game.flags.lampLit && d > 3) return false;
    return this.room.nav.sight(this.pos.x, this.pos.z, p.pos.x, p.pos.z);
  }

  update(dt) {
    if (this.hidden) return;
    // silhouette through walls only while it is hunting you
    this.xray.visible = this.hunting;
    this.stateT += dt;
    this.attackCd -= dt;
    const p = this.player;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const toP = Math.atan2(dx, dz);
    let moveSpeed = 0;

    switch (this.state) {
      case 'dormant':
        this.anim.play('idle');
        break;
      case 'idle':
        this.anim.play('idle');
        if (p.alive && this.canSee(p)) {
          this.setState('chase');
        }
        break;
      case 'chase': {
        if (!this.noticed) {
          this.noticed = true;
          this.game.audio.sfx(this.T.voice + 'Notice', { at: this.pos });
          if (this.onNotice) this.onNotice(this);
          this.game.onMonsterNotice(this);
        }
        if (!p.alive) { this.setState('feast'); break; }
        const facing = Math.abs(angleDiff(this.rot, toP));
        // (never through a wall: what he can't strike back at can't strike him)
        if (dist < this.T.range + p.radius * 0.5 && this.attackCd <= 0 && facing < 0.7 && Math.abs(p.pos.y - this.pos.y) < 0.9 && this.room.nav.sight(this.pos.x, this.pos.z, p.pos.x, p.pos.z)) {
          this.startAttack(dist);
          break;
        }
        if (this.special && this.special(dt, dist, toP)) break;
        moveSpeed = this.chase(dt, p.pos.x, p.pos.z, dist);
        this.growlT -= dt;
        if (this.growlT <= 0) {
          this.growlT = 3 + Math.random() * 5;
          this.game.audio.sfx(this.T.voice + 'Growl', { at: this.pos });
        }
        break;
      }
      case 'attack':
        if (this.stateT < (this.trackTime ?? 0.45)) this.rot = approachAngle(this.rot, toP, this.T.turn * 0.6 * dt);
        if (this.anim.finished) {
          this.attackCd = this.T.cd * (0.7 + Math.random() * 0.6);
          this.setState('chase');
        }
        break;
      case 'leap':
        if (this.stateT > 0.2 && this.stateT < 0.6) {
          moveSpeed = 4.8;
        }
        if (this.anim.finished) {
          this.attackCd = 1.0;
          this.leapCd = 3 + Math.random() * 2;
          this.setState('chase');
        }
        break;
      case 'hurt':
        if (this.stateT > 0.45) { this.setState('chase'); this.attackCd = Math.min(this.attackCd, 0.15); }
        break;
      case 'feast':
        this.anim.play('idle');
        break;
      case 'dead':
        break;
    }

    // integrate
    let nx = this.pos.x + Math.sin(this.rot) * moveSpeed * dt + this.knock.x * dt;
    let nz = this.pos.z + Math.cos(this.rot) * moveSpeed * dt + this.knock.y * dt;
    this.knock.multiplyScalar(Math.exp(-6 * dt));
    if (this.state !== 'dead') {
      const q = { x: nx, z: nz };
      if (!this.ghostly) resolveCircle(q, this.radius, this.room.colliders, null, 3, this.pos.y);
      for (const m of this.room.monsters) {
        if (m === this || !m.solid || !this.solid) continue;
        const mq = { x: m.pos.x, z: m.pos.z };
        if (separateCircles(q, this.radius, mq, m.radius, 0.5)) { m.pos.x = mq.x; m.pos.z = mq.z; }
      }
      nx = q.x; nz = q.z;
      if (this.leash) {
        const [x0, z0, x1, z1] = this.leash;
        nx = clamp(nx, x0, x1);
        nz = clamp(nz, z0, z1);
      }
    }
    this.pos.x = nx;
    this.pos.z = nz;
    this.pos.y = damp(this.pos.y, this.room.floorY(this.pos.x, this.pos.z) + (this.hover || 0), 12, dt);
    this.sync();
    if (this.state === 'chase' && moveSpeed > 0) this.anim.play(this.runAnim || 'walk', { fade: 0.2, speed: this.walkAnimSpeed || 1 });
    else if (this.state === 'chase') this.anim.play('idle', { fade: 0.3 });
    const evs = this.anim.update(dt);
    for (const e of evs) this.onAnimEvent(e);
  }

  // Steer towards (tx, tz) using the nav grid. Returns speed used.
  chase(dt, tx, tz, dist) {
    const nav = this.room.nav;
    this.pathT -= dt;
    if (this.pathT <= 0) {
      this.pathT = 0.45 + Math.random() * 0.2;
      if (nav.clear(this.pos.x, this.pos.z, tx, tz)) this.path = [{ x: tx, z: tz }];
      else this.path = nav.findPath(this.pos.x, this.pos.z, tx, tz) || [{ x: tx, z: tz }];
    }
    let wp = this.path && this.path[0];
    while (wp && this.path.length > 1 && Math.hypot(wp.x - this.pos.x, wp.z - this.pos.z) < 0.3) {
      this.path.shift();
      wp = this.path[0];
    }
    if (!wp) return 0;
    if (this.path.length === 1) wp = { x: tx, z: tz };
    const want = Math.atan2(wp.x - this.pos.x, wp.z - this.pos.z);
    const diff = Math.abs(angleDiff(this.rot, want));
    this.rot = approachAngle(this.rot, want, this.T.turn * dt);
    // close enough: stand and strike, unless something is in between, then
    // keep coming round it
    const p = this.player;
    if (dist < this.T.range * 0.8 && Math.abs(p.pos.y - this.pos.y) < 0.9 && this.room.nav.sight(this.pos.x, this.pos.z, p.pos.x, p.pos.z)) return 0;
    return this.T.speed * (diff > 1.2 ? 0.15 : diff > 0.6 ? 0.5 : 1);
  }

  startAttack() {
    this.setState('attack');
    this.anim.play('attack', { restart: true, fade: 0.1 });
    this.hitDone = false;
    this.game.audio.sfx(this.T.voice + 'Attack', { at: this.pos });
  }

  onAnimEvent(e) {
    const p = this.player;
    if (e === 'hit' && (this.state === 'attack' || this.state === 'leap')) {
      const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      const ang = Math.abs(angleDiff(this.rot, Math.atan2(dx, dz)));
      const reach = this.T.range + 0.4 + (this.state === 'leap' ? 0.4 : 0);
      // nothing solid between them (a ghost, that glides through furniture, strikes through it too)
      const clear = this.ghostly || this.room.nav.sight(this.pos.x, this.pos.z, p.pos.x, p.pos.z);
      if (d < reach && ang < 1.1 && p.alive && Math.abs(p.pos.y - this.pos.y) < 1.0 && clear) {
        if (p.damage(this.T.dmg, this.pos.x, this.pos.z)) this.game.audio.sfx('hitFlesh', { at: p.pos });
      } else this.game.audio.sfx('whoosh', { at: this.pos, rate: 0.6 });
    } else if (e === 'step') {
      this.game.audio.sfx('monsterStep', { at: this.pos, vol: this.type === 'cook' ? 1 : 0.6 });
    } else if (e === 'thud') {
      this.game.audio.sfx('thud', { at: this.pos });
    }
  }

  damage(n, fromX, fromZ, knock = 1) {
    if (!this.alive) return false;
    if (this.invulnerable) return false;
    this.hp -= n;
    const dx = this.pos.x - fromX, dz = this.pos.z - fromZ;
    const l = Math.hypot(dx, dz) || 1;
    this.knock.set((dx / l) * knock, (dz / l) * knock);
    if (this.state === 'dormant' || this.state === 'idle') this.setState('chase');
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    this.game.audio.sfx(this.T.voice + 'Hurt', { at: this.pos });
    // poise: a stagger leaves a short window where hits don't interrupt
    const now = this.game.time;
    if (n >= this.T.stagger && now >= (this.poiseUntil || 0)) {
      this.poiseUntil = now + (this.T.poise ?? 1.3);
      this.setState('hurt');
      this.anim.play('hit', { restart: true, fade: 0.05 });
    }
    return true;
  }

  die() {
    this.setState('dead');
    this.solid = false;
    this.anim.play('death', { restart: true, fade: 0.1 });
    this.game.audio.sfx(this.T.voice + 'Die', { at: this.pos });
    this.game.stats.kills++;
    this.game.onMonsterDeath(this);
    if (this.onDeath) this.onDeath(this);
  }

  serialize() {
    return { hp: this.hp, x: +this.pos.x.toFixed(2), z: +this.pos.z.toFixed(2), rot: +this.rot.toFixed(2), dead: !this.alive, dormant: this.state === 'dormant' };
  }

  restore(d) {
    this.hp = d.hp;
    this.pos.set(d.x, 0, d.z);
    this.rot = d.rot;
    if (d.dead) {
      this.state = 'dead';
      this.solid = false;
      this.anim.play('death', { fade: 0 });
      this.anim.t = 99;
      this.anim.update(0);
    } else this.state = d.dormant ? 'dormant' : 'idle';
    this.pos.y = this.room.floorY(this.pos.x, this.pos.z);
    this.sync();
  }
}

export class Ghoul extends Monster {
  constructor(game, room, o) {
    super(game, room, { ...o, type: 'ghoul' });
    this.runAnim = 'run';
    this.leapCd = 1.5;
  }
  special(dt, dist) {
    this.leapCd -= dt;
    if (this.leapCd <= 0 && dist > 1.8 && dist < 3.4) {
      const p = this.player;
      if (this.room.nav.sight(this.pos.x, this.pos.z, p.pos.x, p.pos.z)) {
        this.rot = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
        this.setState('leap');
        this.anim.play('leap', { restart: true, fade: 0.08 });
        this.game.audio.sfx('ghoulAttack', { at: this.pos });
        return true;
      }
    }
    return false;
  }
}

// Many-legged cellar crawler with its own procedural gait.
const CRAWLER_T = {
  build: () => {
    const c = CH.buildCrawler();
    const parts = { root: c.root, joints: { hips: c.body }, list: [], hipBase: c.body.position.clone(), crawler: c };
    const clip = (loop, dur, events = null) => ({ loop, dur, events, fn() {} });
    const clips = { idle: clip(true, 1), walk: clip(true, 1), attack: clip(false, 0.7, [{ t: 0.35, name: 'hit' }]), hit: clip(false, 0.3), death: clip(false, 1.0) };
    return { parts, clips };
  },
  hp: 24, dmg: 8, speed: 2.1, turn: 5, range: 0.95, sight: 7, cd: 0.9, radius: 0.36, voice: 'crawler', stagger: 0,
};
export class Crawler extends Monster {
  constructor(game, room, o) {
    super(game, room, { ...o, type: 'crawler', T: CRAWLER_T });
  }
  update(dt) {
    super.update(dt);
    const c = this.parts.crawler;
    const t = this.game.time;
    const st = this.state;
    const moving = st === 'chase';
    const rate = moving ? 14 : 3;
    c.legs.forEach((L, i) => {
      const ph = t * rate + (i % 2 ? Math.PI : 0) + L.k * 1.1;
      L.hip.rotation.x = Math.sin(ph) * (moving ? 0.45 : 0.08);
      L.hip.rotation.z = (moving ? Math.max(0, Math.cos(ph)) * 0.35 : 0.05) * L.side;
    });
    if (st === 'dead') {
      const k = Math.min(1, this.stateT / 0.6);
      c.body.rotation.z = k * Math.PI;
      c.body.position.y = 0.32 - k * 0.05;
      c.legs.forEach((L) => { L.hip.rotation.z = -L.side * k * 0.8; });
    } else if (st === 'attack') {
      const k = Math.sin(Math.min(1, this.stateT / 0.7) * Math.PI);
      c.body.rotation.x = -k * 0.5;
      c.body.position.z = k * 0.25;
      c.body.position.y = 0.32 + k * 0.12;
    } else {
      c.body.rotation.x = 0;
      c.body.position.z = 0;
      c.body.position.y = 0.32 + Math.sin(t * (moving ? 20 : 3)) * 0.02;
    }
  }
}

// Spectral dinner guests: invulnerable, glide through furniture. Seated,
// they turn their heads to watch you go by; risen, their faces tear open
// and they hunt you, swooping in when close.
export class Ghost extends Monster {
  constructor(game, room, o) {
    const T = { build: () => CH.buildGhost({ dress: o.dress, color: o.color }), hp: 999, dmg: o.dmg ?? 26, speed: o.speed ?? 1.5, turn: 3.5, range: 1.0, sight: 30, cd: 1.0, radius: 0.3, voice: 'ghost', stagger: 9999 };
    super(game, room, { ...o, type: 'ghost', T });
    this.invulnerable = true;
    this.ghostly = true;
    this.solid = false;
    this.seat = o.seat || null;
    this.hover = 0;
    this.state = o.state || 'seated';
    this.anim.play(this.state === 'seated' ? 'sit' : 'idle', { fade: 0 });
    this.parts.root.traverse((m) => { if (m.isMesh) m.castShadow = false; });
    this.flick = Math.random() * 10;
    this.opacity = 0.55;
    this.watchR = o.watch || 0; // seated: watch the player within this distance
    this.watch = this.watchR;
    this.look = 0; // head turn on top of the animation
    this.lookAt = null;
    this.lookMax = 1.3;
    this.lookRate = 0.8;
    this.riseT = 0.9;
    this.lungeT = 0;
    this.lungeCd = 1;
    this.guard = o.guard || null; // {x, z}: hold the way out instead of giving chase
  }
  setOpacity(a) {
    this.opacity = a;
    for (const m of this.parts.ghostMats) m.opacity = a;
  }
  // Turn the head toward lookAt, or back to the front. lookMax may go past
  // what a living neck allows.
  turnHead(dt) {
    const t = this.lookAt;
    const want = t ? clamp(angleDiff(this.rot, Math.atan2(t.x - this.pos.x, t.z - this.pos.z)), -this.lookMax, this.lookMax) : 0;
    this.look = approach(this.look, want, this.lookRate * dt);
    if (!this.look) return;
    const j = this.parts.joints;
    j.neck.rotation.y += this.look * 0.85;
    j.spine.rotation.y += this.look * 0.15;
  }
  // The serene face tears open into a scream, and burns brighter.
  enrage() {
    const fm = this.parts.faceMat;
    fm.map = fm.emissiveMap = tex('faceGhostScream');
    this.opacity = 0.78;
  }
  calm() {
    const fm = this.parts.faceMat;
    fm.map = fm.emissiveMap = tex('faceGhost');
    this.opacity = 0.55;
  }
  update(dt) {
    this.flick += dt;
    const base = this.opacity;
    const flicker = base * (0.85 + Math.sin(this.flick * 13) * 0.08 + Math.sin(this.flick * 3.1) * 0.07);
    for (const m of this.parts.ghostMats) m.opacity = flicker;
    const p = this.player;
    if (this.state === 'seated') {
      this.stateT += dt;
      if (this.watch) {
        const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
        if (d < this.watch) this.lookAt = p.pos;
        else if (d > this.watch + 0.6) this.lookAt = null;
      }
      this.anim.play('sit');
      this.anim.update(dt);
      this.turnHead(dt);
      this.sync();
      return;
    }
    if (this.state === 'rising') {
      this.stateT += dt;
      this.anim.play('loom', { fade: 0.4 });
      this.anim.update(dt);
      this.lookAt = p.pos;
      this.lookMax = 1.3;
      this.lookRate = 2.5;
      this.turnHead(dt);
      this.pos.y = damp(this.pos.y, 0.15, 3, dt);
      this.rot = approachAngle(this.rot, Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z), 3 * dt);
      this.sync();
      if (this.stateT > this.riseT) this.setState('chase');
      return;
    }
    if (this.state === 'dance' || this.state === 'still') {
      this.stateT += dt;
      this.anim.update(dt);
      this.turnHead(dt);
      this.sync();
      return;
    }
    if (this.state === 'chase' || this.state === 'attack') {
      this.noticed = true;
      this.lookAt = null;
      // glide straight through furniture
      if (this.state === 'chase') {
        const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
        const dist = Math.hypot(dx, dz);
        const toP = Math.atan2(dx, dz);
        // a guard waits between you and the way out until you come close
        let goal = toP, hold = false;
        if (this.guard && dist > 2.4) {
          const gx = p.pos.x - this.guard.x, gz = p.pos.z - this.guard.z, gl = Math.hypot(gx, gz) || 1;
          const tx = this.guard.x + (gx / gl) * Math.min(1.3, gl * 0.5), tz = this.guard.z + (gz / gl) * Math.min(1.3, gl * 0.5);
          goal = Math.atan2(tx - this.pos.x, tz - this.pos.z);
          hold = Math.hypot(tx - this.pos.x, tz - this.pos.z) < 0.15;
        }
        this.rot = approachAngle(this.rot, hold ? toP : goal, this.T.turn * dt);
        this.lungeCd -= dt;
        if (this.lungeT > 0) this.lungeT -= dt;
        else if (this.lungeCd <= 0 && dist > 1.3 && dist < 3.2 && Math.abs(angleDiff(this.rot, toP)) < 0.4) {
          // a sudden swoop with a shriek
          this.lungeT = 0.45;
          this.lungeCd = 2 + Math.random() * 1.6;
          this.game.audio.sfx('ghostLunge', { at: this.pos });
        }
        if (dist < this.T.range + 0.2 && this.attackCd <= 0) {
          this.lungeT = 0;
          this.startAttack();
        } else if (dist > 0.6 && !hold) {
          const sp = this.T.speed * (this.lungeT > 0 ? 2.4 : 1);
          this.pos.x += Math.sin(this.rot) * sp * dt;
          this.pos.z += Math.cos(this.rot) * sp * dt;
        }
        if (this.state === 'chase') this.anim.play(this.lungeT > 0 ? 'lunge' : 'walk', { fade: this.lungeT > 0 ? 0.08 : 0.3 });
        this.attackCd -= dt;
        this.stateT += dt;
      } else {
        this.stateT += dt;
        if (this.anim.finished) { this.attackCd = this.T.cd; this.setState('chase'); }
      }
      this.pos.y = damp(this.pos.y, 0.05, 4, dt);
      this.sync();
      const evs = this.anim.update(dt);
      this.turnHead(dt);
      for (const e of evs) this.onAnimEvent(e);
      return;
    }
    super.update(dt);
  }
  rise(t = 0.9) {
    if (this.state !== 'seated' && this.state !== 'still') return;
    this.riseT = t;
    this.setState('rising');
    this.enrage();
    this.game.audio.sfx('ghostScream', { at: this.pos });
  }
  reseat() {
    if (!this.seat) return;
    this.pos.set(this.seat.x, this.seat.y || 0, this.seat.z);
    this.rot = this.seat.rot;
    this.state = 'seated';
    this.stateT = 0;
    this.watch = this.watchR;
    this.look = 0;
    this.lookAt = null;
    this.lookMax = 1.3;
    this.lookRate = 0.8;
    this.lungeT = 0;
    this.calm();
    this.anim.play('sit', { fade: 0 });
    this.sync();
  }
}

// The hall's suit of armour. It stands on its plinth (dormant) until he
// comes close or strikes it; then the visor lights and it steps down.
const ARMOR_T = { build: CH.buildArmor, hp: 120, dmg: 24, speed: 0.72, turn: 1.9, range: 1.75, sight: 12, cd: 1.5, radius: 0.36, voice: 'armor', stagger: 30, poise: 2.2 };
export class Armor extends Monster {
  constructor(game, room, o) {
    super(game, room, { ...o, type: 'armor', T: ARMOR_T, dormant: !o.awake });
    this.faceMat = this.parts.faceMat;
    this.wakeR = o.wakeR ?? 2.3;
    this.trackTime = 0.7;
    this.setEyes(!!o.awake);
  }
  setEyes(on) {
    if (this.faceMat && this.faceMat.emissive) this.faceMat.emissive.setHex(on ? 0xffffff : 0x000000);
  }
  wake() {
    if (this.state !== 'dormant') return;
    this.setEyes(true);
    if (this.onWake) this.onWake(this);
    super.wake();
  }
  update(dt) {
    if (this.state === 'dormant' && !this.hidden) {
      const p = this.player;
      if (p.alive && Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) < this.wakeR) this.wake();
    }
    super.update(dt);
  }
  damage(n, fromX, fromZ, knock = 1) {
    if (this.state === 'dormant') this.wake();
    // plate turns a blow: it barely rocks
    return super.damage(n, fromX, fromZ, knock * 0.35);
  }
  onAnimEvent(e) {
    if (e === 'step') { this.game.audio.sfx('armorStep', { at: this.pos }); return; }
    super.onAnimEvent(e);
  }
  restore(d) {
    super.restore(d);
    const awake = this.state !== 'dormant';
    this.setEyes(awake && this.alive);
    if (awake) this.hover = 0;
  }
}

// The drowned preacher of Jonah's chapel. Struck down, he lies a moment
// and gets up again, twice; the third time he stays down.
const PREACHER_T = { build: CH.buildPreacher, hp: 50, dmg: 18, speed: 0.82, turn: 2.4, range: 1.15, sight: 14, cd: 1.0, radius: 0.32, voice: 'preacher', stagger: 12 };
export class Preacher extends Monster {
  constructor(game, room, o) {
    super(game, room, { ...o, type: 'preacher', T: PREACHER_T });
    this.lives = o.lives ?? 3;
    this.downT = 0;
    if (o.preaching) { this.state = 'preach'; this.anim.play('preach', { fade: 0 }); }
  }
  get hunting() { return super.hunting || this.state === 'down'; }
  wake() {
    if (this.state === 'preach') this.setState('chase');
    else super.wake();
  }
  update(dt) {
    if (this.hidden) return;
    if (this.state === 'preach') {
      this.anim.play('preach');
      this.mutterT = (this.mutterT || 0) - dt;
      if (this.mutterT <= 0) { this.mutterT = 1.6 + Math.random() * 1.4; this.game.audio.sfx('preacherGrowl', { at: this.pos }); }
      const evs = this.anim.update(dt);
      void evs;
      this.sync();
      return;
    }
    if (this.state === 'down') {
      // lying there; then up again
      this.stateT += dt;
      this.anim.update(dt);
      if (this.stateT > 2.4 && this.anim.cur !== 'rise') {
        this.anim.play('rise', { restart: true, fade: 0.15 });
        this.game.audio.sfx('preacherNotice', { at: this.pos });
      }
      if (this.anim.cur === 'rise' && this.anim.finished) {
        this.hp = this.maxHp;
        this.solid = true;
        this.invulnerable = false;
        this.setState('chase');
        this.attackCd = 0.8;
      }
      return;
    }
    super.update(dt);
  }
  damage(n, fromX, fromZ, knock = 1) {
    if (this.state === 'preach') this.wake();
    return super.damage(n, fromX, fromZ, knock);
  }
  die() {
    this.lives--;
    if (this.lives > 0) {
      this.setState('down');
      this.invulnerable = true;
      this.solid = false;
      this.anim.play('death', { restart: true, fade: 0.1 });
      this.game.audio.sfx('preacherHurt', { at: this.pos });
      if (this.onDown) this.onDown(this);
      return;
    }
    super.die();
  }
  serialize() {
    // down for the moment: it is up again by the time anyone comes back
    return { ...super.serialize(), hp: this.state === 'down' ? this.maxHp : this.hp, lives: this.lives, preaching: this.state === 'preach' };
  }
  restore(d) {
    super.restore(d);
    if (d.lives) this.lives = d.lives;
    if (d.preaching && !d.dead) { this.state = 'preach'; this.anim.play('preach', { fade: 0 }); }
  }
}

// The weed that took the gardener: rooted to its corner, it whips at
// anything that comes near. A mark on the floor shows where a lash will
// fall a moment before it does.
const VINE_T = {
  build: () => {
    const v = CH.buildVineMass();
    const parts = { root: v.root, joints: { hips: new THREE.Group() }, list: [], hipBase: new THREE.Vector3(), vine: v };
    const clip = (loop, dur) => ({ loop, dur, fn() {} });
    return { parts, clips: { idle: clip(true, 1), walk: clip(true, 1), attack: clip(false, 1), hit: clip(false, 0.3), death: clip(false, 1.5) } };
  },
  hp: 80, dmg: 16, speed: 0, turn: 0, range: 4.6, sight: 6, cd: 2.0, radius: 0.85, voice: 'vine', stagger: 9999,
};
export class Vine extends Monster {
  constructor(game, room, o) {
    super(game, room, { ...o, type: 'vine', T: VINE_T });
    this.v = this.parts.vine;
    this.attackT = 1.4;
    this.lashes = [];
    this.wither = 0;
    this.tint = new THREE.Color(0x16301e);
  }
  get hunting() { return false; }
  update(dt) {
    if (this.hidden) return;
    const g = this.game, p = this.player, v = this.v, t = g.time;
    this.stateT += dt;
    this.xray.visible = false;
    const dead = this.state === 'dead';
    if (dead && this.wither < 1) {
      this.wither = Math.min(1, this.wither + dt / 2.5);
      v.weed.color.copy(this.tint).lerp(new THREE.Color(0x2a2214), this.wither);
    }
    for (const f of v.fronds) {
      f.segs.forEach((sg, k) => {
        const live = 1 - this.wither;
        sg.rotation.x = Math.sin(t * 1.3 + f.ph + k * 0.6) * 0.12 * live + f.sz * this.wither * 0.3;
        sg.rotation.z = Math.cos(t * 1.1 + f.ph + k * 0.5) * 0.1 * live - f.sx * this.wither * 0.3;
      });
    }
    for (const b of v.bulbs) b.material.opacity = (0.4 + 0.25 * Math.sin(t * 2.2 + b.userData.ph)) * (1 - this.wither);
    if (!dead) {
      const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
      if (p.alive && d < this.T.range) {
        if (!this.noticed) { this.noticed = true; g.audio.sfx('vineNotice', { at: this.pos }); }
        this.state = 'chase';
        this.attackT -= dt;
        if (this.attackT <= 0) {
          this.attackT = this.T.cd * (0.8 + Math.random() * 0.4);
          this.lash(p.pos.x + (Math.random() - 0.5) * 0.5, p.pos.z + (Math.random() - 0.5) * 0.5);
        }
      } else if (this.state === 'chase') this.state = 'idle';
    }
    this.updateLashes(dt);
    this.sync();
  }
  // a frond rears up, then comes down where the mark is
  lash(x, z) {
    const room = this.room, g = this.game;
    const dx = x - this.pos.x, dz = z - this.pos.z, l = Math.hypot(dx, dz) || 1;
    const bx = this.pos.x + (dx / l) * 0.7, bz = this.pos.z + (dz / l) * 0.7;
    const marker = new THREE.Mesh(new THREE.CircleGeometry(0.75, 14), new THREE.MeshBasicMaterial({ color: 0x142a10, transparent: true, opacity: 0.2, depthWrite: false }));
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(x, 0.02, z);
    room.dynamic.add(marker);
    const group = new THREE.Group();
    group.position.set(bx, 0.2, bz);
    group.rotation.y = Math.atan2(x - bx, z - bz);
    room.dynamic.add(group);
    const arm = new THREE.Group();
    group.add(arm);
    const len = Math.hypot(x - bx, z - bz) + 0.4, n = 7, sl = len / n;
    let parent = arm;
    for (let k = 0; k < n; k++) {
      const seg = new THREE.Group();
      seg.position.y = k === 0 ? 0 : sl;
      parent.add(seg);
      const r0 = 0.08 * (1 - k / n) + 0.02, r1 = 0.08 * (1 - (k + 1) / n) + 0.02;
      const m = new THREE.Mesh(loft([[-0.02, r0, r0 * 0.75], [sl + 0.02, r1, r1 * 0.75]], 6), this.v.weed);
      m.castShadow = true;
      seg.add(m);
      seg.rotation.x = 0.06;
      parent = seg;
    }
    arm.rotation.x = Math.PI / 2 - 1.3;
    this.lashes.push({ x, z, bx, bz, t: 0, marker, group, arm, hit: false });
    g.audio.sfx('vineAttack', { at: { x: bx, y: 0, z: bz } });
  }
  updateLashes(dt) {
    const g = this.game, p = this.player;
    for (let i = this.lashes.length - 1; i >= 0; i--) {
      const s = this.lashes[i];
      s.t += dt;
      const k = s.t;
      s.marker.scale.setScalar(Math.min(1, k / 0.85) * 1.2);
      s.marker.material.opacity = k < 0.85 ? 0.22 + k * 0.5 : Math.max(0, 0.65 - (k - 0.85) * 1.5);
      let pitch;
      if (k < 0.85) pitch = -1.3 + k * 0.2;
      else if (k < 0.98) pitch = -1.13 + ((k - 0.85) / 0.13) * 1.13;
      else if (k < 1.5) pitch = 0;
      else pitch = -(k - 1.5) * 2.2;
      s.arm.rotation.x = Math.PI / 2 + pitch;
      s.arm.position.y = k > 1.5 ? -(k - 1.5) * 2.5 : 0;
      if (!s.hit && k >= 0.98) {
        s.hit = true;
        g.audio.sfx('thud', { at: { x: s.x, y: 0, z: s.z } });
        g.burst('dust', s.x, 0.1, s.z, { n: 6 });
        g.shake(0.06, 0.2);
        if (this.alive && p.alive && Math.hypot(p.pos.x - s.x, p.pos.z - s.z) < 0.85) p.damage(this.T.dmg, s.bx, s.bz, { knock: 3.5 });
      }
      if (k > 2.2) {
        this.room.dynamic.remove(s.group);
        this.room.dynamic.remove(s.marker);
        this.lashes.splice(i, 1);
      }
    }
  }
  restore(d) {
    super.restore(d);
    if (d.dead) { this.wither = 0.999; this.v.weed.color.set(0x2a2214); }
  }
}

// The drowned crew cannot abide the tower's flame: held up to them in the
// storm lantern it drives them back, and burns them.
export class Thrall extends Monster {
  constructor(game, room, o) {
    super(game, room, { ...o, type: 'thrall' });
  }
  // Under the earth of a grave, until someone walks over it.
  bury() {
    this.state = 'buried';
    this.hidden = true;
    this.root.visible = false;
    this.solid = false;
  }
  emerge() {
    if (this.state !== 'buried') return;
    this.hidden = false;
    this.root.visible = true;
    this.solid = true;
    this.setState('emerging');
    this.pos.y = -1.7;
    this.sync();
    this.game.audio.sfx('thrallNotice', { at: this.pos });
    this.game.burst('dust', this.pos.x, 0.15, this.pos.z, { n: 16, color: 0x3a3226, size: 0.3, speed: 1.2, up: 1.4, gravity: 4 });
  }
  get hunting() { return super.hunting || this.state === 'emerging'; }
  update(dt) {
    if (this.state === 'buried') return;
    if (this.state === 'emerging') {
      this.stateT += dt;
      const k = Math.min(1, this.stateT / 1.5);
      this.pos.y = -1.7 * (1 - k) * (1 - k);
      this.rot = approachAngle(this.rot, Math.atan2(this.player.pos.x - this.pos.x, this.player.pos.z - this.pos.z), 2 * dt);
      this.anim.play('walk', { fade: 0.2 });
      this.anim.update(dt);
      this.sync();
      if (k >= 1) this.setState('chase');
      return;
    }
    super.update(dt);
  }
  serialize() {
    return { ...super.serialize(), buried: this.state === 'buried' };
  }
  restore(d) {
    super.restore(d);
    if (d.buried && !d.dead) this.bury();
  }
  special(dt, dist, toP) {
    const p = this.player;
    if (!p.holdsLantern || dist > 2.1) return false;
    this.attackCd = Math.max(this.attackCd, 0.6);
    const away = toP + Math.PI;
    this.knock.set(Math.sin(away) * 1.6, Math.cos(away) * 1.6);
    this.burnT = (this.burnT || 0) - dt;
    if (this.burnT <= 0) {
      this.burnT = 0.5;
      this.hp -= 5;
      this.game.audio.sfx('thrallHurt', { at: this.pos });
      this.game.burst('steam', this.pos.x, 1.3, this.pos.z, { n: 4, size: 0.35 });
      if (this.hp <= 0) { this.die(); return true; }
      this.setState('hurt');
      this.anim.play('hit', { restart: true, fade: 0.05 });
    }
    return true;
  }
}

// The drowned stoker lies on the coal where he fell, until a valve turning
// or a shot wakes him; then he gets up, shovel and all.
export class Stoker extends Monster {
  constructor(game, room, o) {
    super(game, room, { ...o, type: 'stoker' });
    if (this.state === 'dormant') this.anim.play('rise', { fade: 0, speed: 0 });
  }
  get hunting() { return super.hunting || this.state === 'rising'; }
  wake() {
    if (this.state !== 'dormant') return;
    this.setState('rising');
    this.anim.play('rise', { restart: true, fade: 0.05, speed: 0.8 });
    this.game.audio.sfx('cookNotice', { at: this.pos });
    if (this.onWake) this.onWake(this);
  }
  update(dt) {
    if (this.hidden) return;
    if (this.state === 'dormant') { this.anim.update(0); this.sync(); return; }
    if (this.state === 'rising') {
      this.stateT += dt;
      this.anim.update(dt);
      this.sync();
      if (this.anim.finished) {
        this.setState('chase');
        this.attackCd = 0.6;
      }
      return;
    }
    super.update(dt);
  }
  damage(n, fromX, fromZ, knock = 1) {
    if (this.state === 'dormant') this.wake();
    if (this.state === 'rising') {
      // hurt, but not to be knocked about while he is getting up
      if (!this.alive) return false;
      this.hp -= n;
      if (this.hp <= 0) this.die();
      else this.game.audio.sfx('cookHurt', { at: this.pos });
      return true;
    }
    return super.damage(n, fromX, fromZ, knock);
  }
  restore(d) {
    super.restore(d);
    if (this.state === 'dormant') this.anim.play('rise', { restart: true, fade: 0, speed: 0 });
  }
}

// Captain Ezekiel: he lunges across his cabin at a man a few paces off, is
// not to be knocked about, and at half his strength calls up his crew.
const EZEKIEL_T = { build: CH.buildEzekiel, hp: 260, dmg: 20, speed: 0.95, turn: 2.6, range: 1.45, sight: 14, cd: 1.1, radius: 0.42, voice: 'ezekiel', stagger: 60, poise: 2.5 };
export class Ezekiel extends Monster {
  constructor(game, room, o) {
    super(game, room, { ...o, type: 'ezekiel', T: EZEKIEL_T });
    this.lungeCd = 3;
    this.summoned = false;
    this.onHalf = o.onHalf || null;
  }
  turnTo(p) {
    this.rot = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    this.sync();
  }
  damage(n, fromX, fromZ, knock = 1) {
    const hit = super.damage(n, fromX, fromZ, knock);
    if (this.alive && !this.summoned && this.hp < this.maxHp / 2) {
      this.summoned = true;
      if (this.onHalf) this.onHalf(this);
    }
    return hit;
  }
  special(dt, dist, toP) {
    this.lungeCd -= dt;
    if (this.lungeCd <= 0 && dist > 2.2 && dist < 4.6 && this.attackCd <= 0) {
      this.lungeCd = 4 + Math.random() * 2;
      this.rot = toP;
      this.knock.set(Math.sin(toP) * 7, Math.cos(toP) * 7);
      this.startAttack();
      return true;
    }
    return false;
  }
  update(dt) {
    super.update(dt);
    const s = this.parts.star;
    if (s) s.light.intensity = this.alive ? 2.5 + Math.sin(this.game.time * 5) * 1.0 : 0;
    if (s && !this.alive) { s.mesh.visible = false; s.glow.visible = false; }
  }
}

export function makeMonster(game, room, o) {
  if (o.type === 'thrall') return new Thrall(game, room, o);
  if (o.type === 'stoker') return new Stoker(game, room, o);
  if (o.type === 'ezekiel') return new Ezekiel(game, room, o);
  if (o.type === 'vine') return new Vine(game, room, o);
  if (o.type === 'armor') return new Armor(game, room, o);
  if (o.type === 'preacher') return new Preacher(game, room, o);
  if (o.type === 'ghoul') return new Ghoul(game, room, o);
  if (o.type === 'crawler') return new Crawler(game, room, o);
  if (o.type === 'ghost') return new Ghost(game, room, o);
  return new Monster(game, room, o);
}
