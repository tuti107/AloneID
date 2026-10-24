// Monster actors and their AI.
import * as THREE from 'three';
import { Animator, blobShadow } from './rig.js';
import * as CH from './characters.js';
import { resolveCircle, separateCircles } from '../engine/collision.js';
import { angleDiff, approachAngle, damp, clamp } from '../engine/util.js';

const TYPES = {
  butler: { build: CH.buildButler, hp: 45, dmg: 12, speed: 0.78, turn: 2.6, range: 1.05, sight: 9, cd: 0.8, radius: 0.3, voice: 'zombie', stagger: 0 },
  maid: { build: CH.buildMaid, hp: 40, dmg: 11, speed: 0.8, turn: 2.6, range: 1.05, sight: 9, cd: 0.9, radius: 0.3, voice: 'zombie', stagger: 0 },
  zombie: { build: CH.buildButler, hp: 45, dmg: 12, speed: 0.75, turn: 2.6, range: 1.05, sight: 9, cd: 0.9, radius: 0.3, voice: 'zombie', stagger: 0 },
  silas: { build: CH.buildSilas, hp: 75, dmg: 15, speed: 0.92, turn: 2.8, range: 1.05, sight: 10, cd: 0.7, radius: 0.3, voice: 'zombie', stagger: 0 },
  cook: { build: CH.buildCook, hp: 115, dmg: 22, speed: 0.82, turn: 2.2, range: 1.3, sight: 10, cd: 1.1, radius: 0.42, voice: 'cook', stagger: 14 },
  ghoul: { build: CH.buildGhoul, hp: 32, dmg: 10, speed: 2.3, turn: 6, range: 1.0, sight: 12, cd: 0.6, radius: 0.3, voice: 'ghoul', stagger: 0 },
};

export class Monster {
  constructor(game, room, o) {
    const T = o.T || TYPES[o.type];
    this.game = game;
    this.room = room;
    this.id = o.id;
    this.type = o.type;
    this.T = { ...T, ...(o.stats || {}) };
    const { parts, clips } = T.build();
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
    this.sync();
  }

  get alive() { return this.state !== 'dead'; }
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
        if (dist < this.T.range + p.radius * 0.5 && this.attackCd <= 0 && facing < 0.7) {
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
    if (dist < this.T.range * 0.8) return 0;
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
      if (d < reach && ang < 1.1 && p.alive) {
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

// Spectral dinner guests: invulnerable, glide through furniture.
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
  }
  setOpacity(a) {
    this.opacity = a;
    this.parts.ghostMat.opacity = a;
  }
  update(dt) {
    this.flick += dt;
    const base = this.opacity;
    this.parts.ghostMat.opacity = base * (0.85 + Math.sin(this.flick * 13) * 0.08 + Math.sin(this.flick * 3.1) * 0.07);
    if (this.state === 'seated') {
      this.stateT += dt;
      this.anim.play('sit');
      this.anim.update(dt);
      this.sync();
      return;
    }
    if (this.state === 'rising') {
      this.stateT += dt;
      this.anim.play('idle', { fade: 0.4 });
      this.anim.update(dt);
      this.pos.y = damp(this.pos.y, 0.15, 3, dt);
      const p = this.player;
      this.rot = approachAngle(this.rot, Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z), 3 * dt);
      this.sync();
      if (this.stateT > 0.9) this.setState('chase');
      return;
    }
    if (this.state === 'dance' || this.state === 'still') {
      this.stateT += dt;
      this.anim.update(dt);
      this.sync();
      return;
    }
    if (this.state === 'chase' || this.state === 'attack') {
      this.noticed = true;
      // glide straight through furniture
      const p = this.player;
      if (this.state === 'chase') {
        const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
        const dist = Math.hypot(dx, dz);
        const toP = Math.atan2(dx, dz);
        this.rot = approachAngle(this.rot, toP, this.T.turn * dt);
        if (dist < this.T.range + 0.2 && this.attackCd <= 0) {
          this.startAttack();
        } else if (dist > 0.6) {
          this.pos.x += Math.sin(this.rot) * this.T.speed * dt;
          this.pos.z += Math.cos(this.rot) * this.T.speed * dt;
        }
        this.anim.play('walk', { fade: 0.3 });
        this.attackCd -= dt;
        this.stateT += dt;
      } else {
        this.stateT += dt;
        if (this.anim.finished) { this.attackCd = this.T.cd; this.setState('chase'); }
      }
      this.pos.y = damp(this.pos.y, 0.05, 4, dt);
      this.sync();
      const evs = this.anim.update(dt);
      for (const e of evs) this.onAnimEvent(e);
      return;
    }
    super.update(dt);
  }
  rise() {
    if (this.state !== 'seated') return;
    this.setState('rising');
    this.game.audio.sfx('ghostScream', { at: this.pos });
  }
  reseat() {
    if (!this.seat) return;
    this.pos.set(this.seat.x, this.seat.y || 0, this.seat.z);
    this.rot = this.seat.rot;
    this.state = 'seated';
    this.stateT = 0;
    this.anim.play('sit', { fade: 0 });
    this.sync();
  }
}

export function makeMonster(game, room, o) {
  if (o.type === 'ghoul') return new Ghoul(game, room, o);
  if (o.type === 'crawler') return new Crawler(game, room, o);
  if (o.type === 'ghost') return new Ghost(game, room, o);
  return new Monster(game, room, o);
}
