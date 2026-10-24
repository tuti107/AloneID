// The game: owns every subsystem, runs the loop, and offers the small async
// scripting vocabulary (say, ask, wait, fade, goTo…) that rooms use.
import * as THREE from 'three';
import { Gfx } from '../engine/gfx.js';
import { Input } from '../engine/input.js';
import { Audio } from '../engine/audio.js';
import { CameraDirector } from '../engine/camera.js';
import { angleDiff } from '../engine/util.js';
import { Room } from './roomkit.js';
import { Player } from './player.js';
import { Inventory, ITEMS } from './items.js';
import { UI, MessageModal, ChoiceModal, MenuModal, InventoryModal, DocumentModal, DialModal, Modal, el } from './ui.js';
import { ROOMS } from './rooms/index.js';
import { makeMonster } from './monsters.js';
import { DOCS, PROLOGUE, EPILOGUE } from './text.js';
import { TitleScene } from './title.js';
import { burst } from './fx.js';

const SAVE_KEY = 'ashcombe.save.';
const SETTINGS_KEY = 'ashcombe.settings';
const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
const DEFAULT_SETTINGS = { controls: 'classic', res: 'low', dither: true, shadows: COARSE ? 1 : 2, music: 0.7, sfx: 0.9 };

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    return { ...DEFAULT_SETTINGS, ...(s || {}) };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

// Full-screen text cards on black (prologue/epilogue).
class CurtainModal extends Modal {
  constructor(game, pages, o = {}) {
    super(game);
    this.pages = pages;
    this.i = -1;
    this.t = 0;
    this.phase = 'out';
    this.hold = o.hold ?? 5.5;
    this.ui.setCurtain(1);
    this.ui.curtain.style.pointerEvents = 'auto';
    this.ui.curtain.onclick = () => this.skip();
    this.nextPage();
  }
  nextPage() {
    this.i++;
    if (this.i >= this.pages.length) { this.close(); return; }
    this.ui.setCurtain(1, this.pages[this.i]);
    this.ui.curtainTextOn(true);
    this.phase = 'in';
    this.t = 0;
  }
  skip() {
    if (this.phase === 'in' && this.t > 0.4) { this.phase = 'leaving'; this.t = 0; this.ui.curtainTextOn(false); }
  }
  update(dt, input) {
    this.t += dt;
    if (this.game.debugAuto) { this.close(); return; }
    if (input.pressed('confirm') || input.pressed('cancel') || input.pressed('attack')) {
      input.consume('confirm', 'action', 'cancel', 'attack');
      this.skip();
    }
    if (this.phase === 'in' && this.t > this.hold + this.pages[this.i].length * 0.03) { this.phase = 'leaving'; this.t = 0; this.ui.curtainTextOn(false); }
    if (this.phase === 'leaving' && this.t > 1.25) this.nextPage();
  }
  destroy() {
    this.ui.curtainTextOn(false);
    this.ui.curtain.onclick = null;
    this.ui.curtain.style.pointerEvents = 'none';
  }
}

export class Game {
  constructor(app) {
    this.app = app;
    this.settings = loadSettings();
    this.input = new Input();
    this.audio = new Audio();
    this.ui = new UI(this, app);
    this.gfx = new Gfx(this.ui.canvas);
    this.ui.layout();
    this.director = new CameraDirector(4 / 3);
    this.director.onCut = (shot) => this.onCut(shot);
    this.modals = [];
    this.lockCount = 0;
    this.flags = {};
    this.inv = new Inventory();
    this.player = new Player(this);
    this.rooms = {};
    this.room = null;
    this.state = 'boot';
    this.time = 0;
    this.realTime = 0;
    this.timers = [];
    this.tweens = [];
    this.stats = { kills: 0, saves: 0, deaths: 0, time: 0 };
    this.savedRoomState = {};
    this.lightningT = 6;
    this.flashQueue = [];
    this.shakeAmt = 0;
    this.shakeT = 0;
    this.hurt = 0;
    this.escape = null;
    this.deathText = null;
    this.invScene = null;
    this.toastT = 0;
    this.toastEl = el('div', { id: 'prompt', class: 'fs', style: 'bottom:auto;top:calc(var(--u)*30)' }, this.ui.hud);
    this.applySettings();
  }

  // ------------------------------------------------------------ settings
  applySettings() {
    const s = this.settings;
    if (s.res === 'high') this.gfx.setResolution(640, 480);
    else this.gfx.setResolution(320, 240);
    this.gfx.u.uDither.value = s.dither ? 1 : 0;
    this.gfx.u.uLevels.value = s.dither ? 9 : 24;
    this.gfx.setShadows(s.shadows);
    for (const r of Object.values(this.rooms)) {
      this.applyRoomShadows(r);
      r.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    }
    this.audio.setVolumes && this.audio.setVolumes(s.music, s.sfx);
  }
  // 影: 高 = every shadow light, 低 = spotlights only (point lights cost 6 passes).
  applyRoomShadows(r) {
    const q = this.settings.shadows;
    for (const l of r.shadowLights || []) l.castShadow = q >= 2 || (q >= 1 && !l.isPointLight);
  }

  saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch (e) { /* storage unavailable */ }
  }

  // ------------------------------------------------------------ loop
  start() {
    this.last = performance.now();
    const loop = (now) => {
      requestAnimationFrame(loop);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt <= 0) return;
      if (dt > 0.1) dt = 0.1;
      this.frame(dt);
    };
    requestAnimationFrame(loop);
    this.toTitle();
  }

  frame(dt) {
    this.input.update();
    if (this.input.anyPressed) this.audio.unlock();
    this.realTime += dt;
    this.updateTweens(dt);
    const top = this.modals[this.modals.length - 1];
    if (top) top.tick(dt, this.input);
    const world = this.state === 'play' && (!top || top.pauses === false);
    if (world) this.updateWorld(dt);
    if ((this.state === 'title' || this.state === 'ending') && this.titleScene) this.titleScene.update(dt);
    if (this.state === 'play' && !this.modals.length && !this.locked && this.player.alive) {
      if (this.input.pressed('pause')) { this.input.consume('pause'); this.openPause(); }
      else if (this.input.pressed('inventory')) { this.input.consume('inventory'); this.openInventory(); }
    }
    this.ui.update(dt);
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toastEl.classList.remove('on');
    }
    this.audio.update(dt, this);
    this.render(dt);
  }

  get locked() { return this.lockCount > 0; }
  lock() { this.lockCount++; }
  unlock() { this.lockCount = Math.max(0, this.lockCount - 1); }

  pushModal(m) { this.modals.push(m); this.ui.setPrompt(null); }
  popModal(m) {
    const i = this.modals.indexOf(m);
    if (i >= 0) this.modals.splice(i, 1);
  }
  topModal() { return this.modals[this.modals.length - 1]; }

  updateWorld(dt) {
    this.time += dt;
    this.stats.time += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      if (this.time >= t.at) { this.timers.splice(i, 1); t.res(); }
    }
    const room = this.room;
    if (!room) return;
    this.player.update(dt);
    for (const m of room.monsters) m.update(dt);
    room.update(dt);
    if (room.def.update) room.def.update(room, this, dt);
    this.checkTriggers();
    this.updatePrompt();
    const p = this.player.pos;
    this.director.update(new THREE.Vector3(p.x, p.y + 1.1, p.z), dt);
    this.updateLightning(dt);
    if (this.escape) {
      this.escape.rumble = (this.escape.rumble ?? 2) - dt;
      if (this.escape.rumble <= 0) {
        this.escape.rumble = 2.5 + Math.random() * 3.5;
        this.audio.sfx('rumble');
        this.shake(0.08 + Math.random() * 0.08, 1.2);
      }
      this.escape.t -= dt;
      this.ui.setTimer(this.escape.t);
      if (this.escape.t <= 0 && this.player.alive) {
        this.escape = null;
        this.ui.setTimer(null);
        this.deathText = '崩れ落ちる屋敷に、エドガーは呑み込まれた……';
        this.player.hp = 0;
        this.player.die();
      }
    }
    if (this.hurt > 0) this.hurt = Math.max(0, this.hurt - dt * 1.6);
    const low = this.player.hp / this.player.maxHp < 0.25 && this.player.alive ? 0.25 + Math.sin(this.time * 6) * 0.12 : 0;
    this.gfx.u.uHurt.value = Math.max(this.hurt, low);
  }

  updateTweens(dt) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.obj[tw.key] = tw.from + (tw.to - tw.from) * k;
      if (k >= 1) { this.tweens.splice(i, 1); tw.res(); }
    }
    if (this.shakeT > 0) this.shakeT -= dt;
    const fl = this.gfx.u.uFlash;
    fl.value = Math.max(0, fl.value - dt * 4);
  }

  render(dt) {
    const g = this.gfx;
    if ((this.state === 'title' || this.state === 'ending') && this.titleScene) {
      g.render(this.titleScene.scene, this.titleScene.camera, this.realTime);
      return;
    }
    const inv = this.modals.find((m) => m instanceof InventoryModal);
    if (inv) {
      this.renderInventory(dt, inv);
      return;
    }
    if (!this.room) {
      g.render(this.blankScene || (this.blankScene = new THREE.Scene()), this.director.cam, this.realTime);
      return;
    }
    const cam = this.director.cam;
    let ox = 0, oy = 0;
    if (this.shakeT > 0) {
      ox = (Math.random() - 0.5) * this.shakeAmt;
      oy = (Math.random() - 0.5) * this.shakeAmt;
      cam.position.x += ox;
      cam.position.y += oy;
    }
    g.render(this.room.scene, cam, this.realTime);
    cam.position.x -= ox;
    cam.position.y -= oy;
  }

  renderInventory(dt, inv) {
    if (!this.invScene) {
      const s = new THREE.Scene();
      s.background = new THREE.Color(0x050403);
      s.add(new THREE.HemisphereLight(0x8090b0, 0x302010, 2.2));
      const l = new THREE.DirectionalLight(0xffe8c8, 3.2);
      l.position.set(2, 3, 4);
      s.add(l);
      const cam = new THREE.PerspectiveCamera(30, 4 / 3, 0.05, 50);
      cam.position.set(0, 0, 4);
      cam.lookAt(0, 0, 0);
      this.invScene = { scene: s, cam, models: {}, holder: new THREE.Group(), id: null };
      s.add(this.invScene.holder);
    }
    const S = this.invScene;
    const id = inv.previewItem;
    if (S.id !== id) {
      S.holder.clear();
      S.id = id;
      if (id) {
        let m = S.models[id];
        if (!m) {
          m = ITEMS[id].model();
          const box = new THREE.Box3().setFromObject(m);
          const size = box.getSize(new THREE.Vector3());
          const c = box.getCenter(new THREE.Vector3());
          const inner = new THREE.Group();
          m.position.sub(c);
          inner.add(m);
          inner.userData.scale = 0.75 / Math.max(size.x, size.y, size.z, 0.01);
          S.models[id] = inner;
          m = inner;
        }
        S.holder.add(m);
      }
    }
    const r = inv.view.getBoundingClientRect(), st = this.ui.stage.getBoundingClientRect();
    const cx = ((r.left + r.width / 2 - st.left) / st.width) * 2 - 1;
    const cy = -(((r.top + r.height * 0.45 - st.top) / st.height) * 2 - 1);
    const v = new THREE.Vector3(cx, cy, 0.5).unproject(S.cam).sub(S.cam.position).normalize();
    S.holder.position.copy(S.cam.position).addScaledVector(v, 4);
    const sc = (r.height / st.height) * 1.9;
    if (S.holder.children[0]) S.holder.children[0].scale.setScalar(S.holder.children[0].userData.scale * sc);
    S.holder.rotation.y += dt * 0.9;
    S.holder.rotation.x = 0.35;
    this.gfx.render(S.scene, S.cam, this.realTime);
  }

  // ------------------------------------------------------------ scripting
  run(fn) {
    this.player.busy++;
    let p;
    try { p = Promise.resolve(fn()); } catch (e) { p = Promise.reject(e); }
    return p.catch((e) => console.error(e)).finally(() => { this.player.busy = Math.max(0, this.player.busy - 1); });
  }
  burst(kind, x, y, z, o) {
    if (this.room) burst(this.room, x, y, z, kind, o);
  }
  task(fn) {
    return Promise.resolve().then(fn).catch((e) => console.error(e));
  }
  wait(sec) {
    return new Promise((res) => this.timers.push({ at: this.time + sec, res }));
  }
  waitReal(sec) {
    return this.tween({ v: 0 }, 'v', 1, sec);
  }
  tween(obj, key, to, dur) {
    return new Promise((res) => {
      this.tweens = this.tweens.filter((t) => !(t.obj === obj && t.key === key));
      if (dur <= 0) { obj[key] = to; res(); return; }
      this.tweens.push({ obj, key, from: obj[key], to, dur, t: 0, res });
    });
  }
  fade(to, dur = 0.4) { return this.tween(this.gfx.u.uFade, 'value', to, dur); }
  say(text, o) { return new MessageModal(this, text, o).open(); }
  ask(text, options, o) { return new ChoiceModal(this, text, options, o).open(); }
  notify(text, dur = 1.8) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('on');
    this.toastT = dur;
  }
  shake(amount = 0.1, dur = 0.3) {
    if (REDUCED_MOTION) return;
    this.shakeAmt = amount;
    this.shakeT = dur;
  }
  flash(amount = 0.8, color = [0.75, 0.82, 1.0]) {
    if (REDUCED_MOTION) amount *= 0.35;
    this.gfx.u.uFlashColor.value.set(...color);
    this.gfx.u.uFlash.value = Math.max(this.gfx.u.uFlash.value, amount);
  }
  cut(def) {
    this.director.override = def ? { pos: new THREE.Vector3(...def.pos), look: new THREE.Vector3(...def.look), fov: def.fov || 50 } : null;
    if (!def && this.room) this.director.current = null;
    if (def) this.director.update(null, 0, true);
  }
  setFlag(k, v = true) { this.flags[k] = v; }
  has(id) { return this.inv.has(id); }

  async give(id, o = {}) {
    if (id === 'ammo') {
      this.inv.ammo += o.count || 6;
      this.audio.sfx('pickup');
      if (!o.silent) await this.say(`${ITEMS.ammo.name}を手に入れた。（${o.count || 6}発）`);
      this.updateHud();
      return;
    }
    this.inv.add(id);
    this.audio.sfx('pickup');
    if (!o.silent) await this.say(o.msg || `${ITEMS[id].name}を手に入れた。`);
  }

  equip(id) {
    this.inv.equipped = id;
    if (id) this.audio.sfx('equip');
    this.player.refreshHeld();
    this.updateHud();
  }

  updateHud() {
    this.ui.setAmmo(this.inv.equipped === 'revolver' ? this.inv.ammo : null);
  }

  walk(x, z) {
    return this.player.walkTo(x, z);
  }

  async searchAnim() {
    await this.player.playClip('search');
  }
  async reachAnim() {
    await this.player.playClip('reach');
  }

  // ------------------------------------------------------------ rooms
  getRoom(id) {
    let r = this.rooms[id];
    if (!r) {
      const def = ROOMS[id];
      if (!def) throw new Error('no room ' + id);
      r = new Room(this, def);
      def.build(r, this);
      r.finalize();
      this.applyRoomShadows(r);
      const st = this.savedRoomState[id];
      if (st) this.restoreRoom(r, st);
      this.rooms[id] = r;
    }
    return r;
  }

  spawn(room, o) {
    const m = makeMonster(this, room, o);
    room.addMonster(m);
    return m;
  }

  enterRoom(id, entry, o = {}) {
    const room = this.getRoom(id);
    this.lastEntry = entry;
    if (this.room && this.room !== room) {
      if (this.room.def.leave) this.room.def.leave(this.room, this);
      this.room.scene.remove(this.player.root);
    }
    this.room = room;
    room.scene.add(this.player.root);
    const e = room.entries[entry] || Object.values(room.entries)[0];
    if (!o.keepPos) this.player.place(e.x, e.z, e.rot);
    this.player.refreshHeld();
    this.director.override = null;
    this.director.setShots(room.shots);
    if (room.def.setup) room.def.setup(room, this, entry);
    const p = this.player.pos;
    this.director.update(new THREE.Vector3(p.x, p.y + 1.1, p.z), 0, true);
    this.audio.setAmbience(room.def.ambience || 'house', room);
    if (!o.quiet) this.ui.showRoomName(room.name);
    room.visited = true;
    this.flags['visited:' + id] = true;
    this.updateHud();
    this.lightningT = Math.min(this.lightningT, 4 + Math.random() * 6);
  }

  onCut(shot) {
    const room = this.room;
    if (!room || !shot) return;
    for (const tag of Object.keys(room.tags)) room.setTagVisible(tag, !(shot.hide || []).includes(tag));
  }

  async goTo(id, entry, o = {}) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.lock();
    try {
      if (o.door) {
        this.audio.sfx(o.door.sound || 'doorOpen', { at: this.player.pos });
        const d = o.door;
        const st = { v: 0 };
        this.tweens.push({ obj: st, key: 'v', from: 0, to: 1, dur: 0.35, t: 0, res: () => {} });
        const upd = () => { if (d.setOpen) d.setOpen(st.v); };
        const iv = setInterval(upd, 16);
        await this.fade(1, 0.38);
        clearInterval(iv);
        if (d.setOpen) d.setOpen(0);
      } else await this.fade(1, o.fadeOut ?? 0.4);
      this.enterRoom(id, entry);
      if (o.door) this.audio.sfx('doorClose', { delay: 0.15 });
      this.checkpoint = this.serialize();
      await this.fade(0, 0.35);
    } finally {
      this.transitioning = false;
      this.unlock();
    }
    const room = this.room;
    if (room.def.enter) await this.run(() => room.def.enter(room, this, entry));
  }

  async useDoor(room, door, withItem = null) {
    if (this.transitioning || !door) return false;
    const locked = typeof door.locked === 'function' ? door.locked(this) : door.locked;
    const key = 'unlocked:' + door.id;
    if (locked && !this.flags[key]) {
      if (door.key && (withItem === door.key || this.inv.has(door.key))) {
        this.flags[key] = true;
        this.audio.sfx('unlock', { at: this.player.pos });
        await this.say(door.unlockMsg || `${ITEMS[door.key].name}を使って、扉の鍵を開けた。`);
      } else {
        this.audio.sfx('locked', { at: this.player.pos });
        await this.say(door.lockedMsg || '鍵がかかっている。');
        return false;
      }
    }
    if (door.onOpen) {
      const ok = await door.onOpen(this, room);
      if (ok === false) return false;
    }
    if (!door.to) return false;
    await this.goTo(door.to, door.entry, { door });
    return true;
  }

  checkTriggers() {
    const p = this.player.pos;
    for (const t of this.room.triggers) {
      if (t.done) continue;
      const [x0, z0, x1, z1] = t.box;
      const inside = p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1 && (!t.when || t.when(this));
      if (inside && !t.inside) {
        t.inside = true;
        if (t.once) t.done = true;
        if (t.enter) (t.lock === false ? this.task(() => t.enter(this)) : this.run(() => t.enter(this)));
      } else if (!inside && t.inside) {
        t.inside = false;
        if (t.exit) t.exit(this);
      }
    }
  }

  // ------------------------------------------------------------ interaction
  findInteractable(itemId = null) {
    const p = this.player;
    let best = null, bestScore = 1e9;
    for (const it of this.room.interactables) {
      if (it.enabled && !it.enabled(this)) continue;
      if (itemId && !it.item) continue;
      const dx = it.x - p.pos.x, dz = it.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      const reach = it.r + (it.reach ?? 0.7) + (itemId ? 0.6 : 0);
      if (d > reach) continue;
      const ang = d < 0.3 ? 0 : Math.abs(angleDiff(p.rot, Math.atan2(dx, dz)));
      if (ang > (itemId ? 1.8 : it.arc ?? 1.15)) continue;
      const score = d + ang * 0.9;
      if (score < bestScore) { best = it; bestScore = score; }
    }
    return best;
  }

  updatePrompt() {
    if (!this.player.canAct() || this.modals.length || this.transitioning) {
      this.ui.setPrompt(null);
      return;
    }
    const it = this.findInteractable();
    this.currentInteractable = it;
    if (it) {
      this.promptVerb = typeof it.verb === 'function' ? it.verb(this) : it.verb;
      const label = typeof it.label === 'function' ? it.label(this) : it.label;
      this.ui.setPrompt(`<b>${this.promptVerb}</b>${label}`);
    } else this.ui.setPrompt(null);
  }

  tryInteract() {
    const it = this.findInteractable();
    if (it && it.use) this.run(() => it.use(this));
  }

  // ------------------------------------------------------------ combat
  footstep(actor, run) {
    const room = this.room;
    this.audio.footstep(room.floorTypeAt(actor.pos.x, actor.pos.z), run, actor.pos);
    if (run && room.def.onNoise) room.def.onNoise(room, this, 'run');
  }

  meleeHit(p, def) {
    if (!def) return;
    let hit = false, ghost = false;
    for (const m of this.room.monsters) {
      if (!m.alive || m.hidden) continue;
      const dx = m.pos.x - p.pos.x, dz = m.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > def.range + m.radius) continue;
      if (Math.abs(angleDiff(p.rot, Math.atan2(dx, dz))) > def.arc) continue;
      if (m.invulnerable) { ghost = true; continue; }
      if (m.damage(def.dmg, p.pos.x, p.pos.z, def.knock)) {
        hit = true;
        burst(this.room, m.pos.x - (dx / (d || 1)) * m.radius, m.pos.y + 1.1, m.pos.z - (dz / (d || 1)) * m.radius, m.type === 'crawler' || m.type === 'ghoul' ? 'ichor' : 'blood', { dir: [dx / (d || 1), dz / (d || 1)] });
      }
    }
    if (this.room.def.onMelee) this.room.def.onMelee(this.room, this, def);
    if (hit) {
      this.audio.sfx(def.kind === 'blunt' ? 'hitBlunt' : 'hitFlesh', { at: p.pos });
      this.shake(0.04, 0.1);
    }
    if (ghost) this.notify('攻撃がすり抜けた……！');
    if (this.room.def.onNoise) this.room.def.onNoise(this.room, this, 'fight');
  }

  autoAim(p, arc, range) {
    let best = null, bestScore = 1e9;
    for (const m of this.room.monsters) {
      if (!m.alive || m.hidden || m.state === 'dormant') continue;
      const dx = m.pos.x - p.pos.x, dz = m.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > range) continue;
      const a = Math.abs(angleDiff(p.rot, Math.atan2(dx, dz)));
      if (a > arc) continue;
      if (!this.room.nav.sight(p.pos.x, p.pos.z, m.pos.x, m.pos.z)) continue;
      const s = a * 3 + d * 0.15;
      if (s < bestScore) { best = m; bestScore = s; }
    }
    if (!best && this.room.boss && this.room.boss.targetable) {
      const b = this.room.boss;
      const a = Math.abs(angleDiff(p.rot, Math.atan2(b.pos.x - p.pos.x, b.pos.z - p.pos.z)));
      if (a < arc) best = b;
    }
    return best;
  }

  fireGun(p) {
    if (this.inv.ammo <= 0) return;
    this.inv.ammo--;
    this.updateHud();
    this.audio.sfx('gunshot', { at: p.pos });
    this.flash(0.35, [1.0, 0.85, 0.6]);
    this.player.muzzle.intensity = 40;
    this.shake(0.05, 0.12);
    const t = this.autoAim(p, 0.3, 14);
    if (t) {
      if (t.invulnerable) this.notify('弾がすり抜けた……！');
      else {
        t.damage(34, p.pos.x, p.pos.z, 2.0);
        this.audio.sfx('hitFlesh', { at: t.pos, delay: 0.03 });
        const dx = t.pos.x - p.pos.x, dz = t.pos.z - p.pos.z, l = Math.hypot(dx, dz) || 1;
        burst(this.room, t.pos.x - (dx / l) * 0.25, t.pos.y + 1.15, t.pos.z - (dz / l) * 0.25, t.type === 'crawler' || t.type === 'ghoul' ? 'ichor' : 'blood', { dir: [dx / l, dz / l], n: 14 });
      }
    } else {
      const fx = p.pos.x + Math.sin(p.rot) * 3, fz = p.pos.z + Math.cos(p.rot) * 3;
      burst(this.room, fx, 1.1, fz, 'spark', { n: 5 });
    }
    if (this.room.def.onNoise) this.room.def.onNoise(this.room, this, 'gun');
  }

  onMonsterNotice(m) {
    this.audio.combat && this.audio.combat(true);
    void m;
  }
  onMonsterDeath(m) {
    void m;
  }

  onPlayerHurt(n) {
    const pp = this.player.pos;
    if (this.room) burst(this.room, pp.x, pp.y + 1.2, pp.z, 'blood', { n: 8 });
    this.hurt = Math.min(1, 0.5 + n / 30);
    this.audio.sfx('hurt', { at: this.player.pos });
    this.shake(0.12, 0.25);
  }

  onPlayerDeath() {
    this.stats.deaths++;
    this.audio.sfx('death');
    this.escape = null;
    this.ui.setTimer(null);
    this.task(async () => {
      this.lock();
      await this.waitReal(2.4);
      this.audio.music('death');
      await this.fade(1, 1.6);
      this.unlock();
      this.showGameOver();
    });
  }

  showGameOver() {
    const text = this.deathText || 'エドガー・ヘイルは、二度と屋敷から出ることはなかった……';
    this.deathText = null;
    const wrap = el('div', { id: 'gameover' }, this.ui.layer);
    el('div', { class: 'big fs-l' }, wrap, 'GAME OVER');
    el('div', { class: 'sub fs' }, wrap, text);
    const hasSave = this.listSaves().some(Boolean);
    const menu = new MenuModal(this, {
      bg: false,
      items: [
        { label: '最後の部屋からやり直す', onSelect: (m) => { m.close(); wrap.remove(); this.restoreCheckpoint(); } },
        { label: 'ロードする', disabled: !hasSave, onSelect: () => this.openSaveMenu('load', () => wrap.remove()) },
        { label: 'タイトルへ戻る', onSelect: (m) => { m.close(); wrap.remove(); this.toTitle(); } },
      ],
    });
    menu.el.style.alignItems = 'flex-end';
    menu.el.style.paddingBottom = '12%';
    menu.el.style.boxSizing = 'border-box';
    menu.open();
  }

  restoreCheckpoint() {
    if (!this.checkpoint) { this.toTitle(); return; }
    this.loadState(this.checkpoint);
  }

  // ------------------------------------------------------------ items
  async useItem(id) {
    const it = ITEMS[id];
    const p = this.player;
    if (it.heal) {
      if (p.hp >= p.maxHp) { await this.say('今は必要ない。'); return; }
      p.heal(it.heal);
      this.inv.remove(id);
      this.audio.sfx('drink');
      await this.say(id === 'flask' ? 'ウイスキーをあおった。喉が焼け、少し力が戻ってきた。' : '気付け薬を飲んだ。体に力がみなぎってくる。');
      return;
    }
    if (id === 'oil') {
      if (!this.inv.has('lamp')) { await this.say('今は使い道がない。'); return; }
      if (this.flags.lampOil) { await this.say('ランプの油は、もう満ちている。'); return; }
      this.flags.lampOil = true;
      this.inv.remove('oil');
      this.audio.sfx('pour');
      await this.say('ランプに油を注いだ。');
      return;
    }
    if (id === 'matches' || (id === 'lamp' && !this.flags.lampLit)) {
      if (!this.inv.has('lamp')) { await this.say('今は使い道がない。'); return; }
      if (!this.flags.lampOil) { await this.say(id === 'lamp' ? 'ランプには油が入っていない。' : 'ランプには油が入っていない。火を点けても無駄だ。'); return; }
      if (!this.inv.has('matches')) { await this.say('火を点けるものがない。'); return; }
      if (this.flags.lampLit) { await this.say('ランプはもう灯っている。'); return; }
      this.flags.lampLit = true;
      this.audio.sfx('match');
      this.player.refreshHeld();
      await this.say('マッチを擦り、ランプに火を灯した。\n温かな光が、闇を押し返していく。');
      return;
    }
    const target = this.findInteractable(id);
    if (target && target.item) {
      const handled = await target.item(this, id);
      if (handled !== false) return;
    }
    if (this.room.def.useItem) {
      const handled = await this.room.def.useItem(this.room, this, id);
      if (handled) return;
    }
    await this.say(id === 'lamp' ? 'ランプの灯りが、揺らめいている。' : 'ここでは使えないようだ。');
  }

  async throwItem(id) {
    if (id !== 'lamp') { await this.say('投げても仕方がない。'); return; }
    if (!this.flags.lampLit) { await this.say('火の点いていないランプを投げても、意味がない。'); return; }
    if (this.room.def.onThrowLamp) { await this.room.def.onThrowLamp(this.room, this); return; }
    await this.say('いや……この灯りを失うわけにはいかない。');
  }

  async readDoc(docId) {
    const doc = DOCS[docId];
    if (doc.cursed) {
      await new DocumentModal(this, doc, { maxPage: 0 }).open();
      const c = await this.ask('……先を読みますか？', ['読む', 'やめておく'], { default: 1 });
      if (c !== 0) return false;
      this.audio.sfx('madness');
      this.tween(this.gfx.u.uWarp, 'value', 1, 1.5);
      await new DocumentModal(this, { title: doc.title, pages: [doc.pages[1]], cursed: true }).open();
      const p = this.player;
      this.flags.readShadow = (this.flags.readShadow || 0) + 1;
      if (p.hp <= 40) {
        this.tween(this.gfx.u.uWarp, 'value', 2.5, 2);
        await this.say('頭の中に、潮騒が満ちていく。\n深く、深く、冷たい水の底へ――');
        this.deathText = '狂気が、エドガーの精神を呑み込んだ……';
        p.hp = 0;
        p.die();
        this.tween(this.gfx.u.uWarp, 'value', 0, 4);
        return true;
      }
      p.hp -= 40;
      this.onPlayerHurt(40);
      await this.say('頭が割れるように痛む……！\nこれ以上読めば、正気を保てない。');
      this.tween(this.gfx.u.uWarp, 'value', 0, 3);
      return true;
    }
    await new DocumentModal(this, doc).open();
    return true;
  }

  async dial(hour) {
    return new DialModal(this, hour).open();
  }

  // ------------------------------------------------------------ lightning
  updateLightning(dt) {
    const room = this.room;
    this.lightningT -= dt;
    if (this.lightningT <= 0) {
      this.lightningT = 10 + Math.random() * 22;
      if (room.windows.length || room.def.outdoor) {
        this.flashQueue = [0, 0.12 + Math.random() * 0.1, 0.35 + Math.random() * 0.2].filter((_, i) => i < 2 || Math.random() < 0.5);
        this.flashT = 0;
        this.audio.thunder(0.5 + Math.random() * 1.5, 1);
      } else if (!room.def.silentThunder) this.audio.thunder(0.2, 0.35);
    }
    if (this.flashQueue.length) {
      this.flashT += dt;
      if (this.flashT >= this.flashQueue[0]) {
        this.flashQueue.shift();
        room.flash = 1;
      }
    }
    room.flash = Math.max(0, room.flash - dt * 7);
  }

  // ------------------------------------------------------------ menus
  openInventory() {
    if (this.topModal()) return;
    new InventoryModal(this).open();
  }

  openPause() {
    const m = new MenuModal(this, {
      title: '中断',
      closeOn: 'pause',
      items: [
        { label: 'ゲームに戻る', onSelect: (mm) => mm.close() },
        { label: '持ち物を見る', onSelect: (mm) => { mm.close(); this.openInventory(); } },
        { label: 'セーブ', onSelect: () => this.openSaveMenu('save') },
        { label: 'ロード', onSelect: () => this.openSaveMenu('load') },
        { label: '設定', onSelect: () => this.openOptions() },
        { label: '操作方法', onSelect: () => this.showControls() },
        { label: 'タイトルへ戻る', onSelect: async (mm) => { const c = await this.ask('タイトルに戻りますか？（セーブしていない進行は失われます）', ['戻る', 'やめる'], { default: 1 }); if (c === 0) { mm.close(); this.toTitle(); } } },
      ],
      onCancel: (mm) => mm.close(),
    });
    this.audio.ui('open');
    m.open();
  }

  showControls() {
    const lines = this.ui.touch.enabled
      ? ['左のパッド：移動（上で前進、左右で旋回）', '［調べる］：調べる・扉を開ける・会話', '［攻撃］：素手／装備した武器で攻撃', '［走る］：押している間走る', '［持物］：持ち物を開く']
      : ['↑↓←→ / WASD：移動（↑前進 ↓後退 ←→旋回）', 'Shift：走る', 'Space / Z：調べる・扉を開ける・決定', 'X：攻撃（素手は連打でパンチ→キック）', 'I / Tab：持ち物　Esc：中断メニュー', '家具に向かって歩き続けると押せる'];
    return this.say(lines.join('\n'));
  }

  openOptions() {
    const s = this.settings;
    const on = (b) => (b ? 'オン' : 'オフ');
    const items = [
      { label: '操作方式', value: () => (s.controls === 'classic' ? 'クラシック' : 'モダン'), onChange: () => { s.controls = s.controls === 'classic' ? 'modern' : 'classic'; } },
      { label: '解像度', value: () => (s.res === 'low' ? '320×240' : '640×480'), onChange: () => { s.res = s.res === 'low' ? 'high' : 'low'; this.applySettings(); } },
      { label: 'ディザリング', value: () => on(s.dither), onChange: () => { s.dither = !s.dither; this.applySettings(); } },
      { label: '影', value: () => ['オフ', '低', '高'][s.shadows], onChange: (d) => { s.shadows = (s.shadows + (d > 0 ? 1 : 2)) % 3; this.applySettings(); } },
      { label: '音楽', value: () => '■'.repeat(Math.round(s.music * 5)) + '□'.repeat(5 - Math.round(s.music * 5)), onChange: (d) => { s.music = Math.max(0, Math.min(1, Math.round(s.music * 5 + d) / 5)); this.applySettings(); } },
      { label: '効果音', value: () => '■'.repeat(Math.round(s.sfx * 5)) + '□'.repeat(5 - Math.round(s.sfx * 5)), onChange: (d) => { s.sfx = Math.max(0, Math.min(1, Math.round(s.sfx * 5 + d) / 5)); this.applySettings(); this.audio.ui('move'); } },
      { label: '戻る', onSelect: (m) => { this.saveSettings(); m.close(); } },
    ];
    new MenuModal(this, {
      title: '設定',
      items,
      hint: '←→で変更',
      onCancel: (m) => { this.saveSettings(); m.close(); },
    }).open();
  }

  listSaves() {
    const out = [];
    for (let i = 1; i <= 3; i++) {
      try {
        const raw = localStorage.getItem(SAVE_KEY + i);
        out.push(raw ? JSON.parse(raw) : null);
      } catch (e) { out.push(null); }
    }
    return out;
  }

  openSaveMenu(mode, onLoaded) {
    const saves = this.listSaves();
    const fmt = (s) => {
      if (!s) return '――　空き　――';
      const t = Math.floor(s.stats.time);
      const room = ROOMS[s.room] ? ROOMS[s.room].name : s.room;
      return `${room}　${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    };
    const items = saves.map((s, i) => ({
      label: `${i + 1}. ${fmt(s)}`,
      disabled: mode === 'load' && !s,
      onSelect: async (m) => {
        if (mode === 'save') {
          if (s) {
            const c = await this.ask('上書きしますか？', ['はい', 'いいえ'], { default: 1 });
            if (c !== 0) return;
          }
          this.stats.saves++;
          const data = this.serialize();
          try {
            localStorage.setItem(SAVE_KEY + (i + 1), JSON.stringify(data));
            m.close();
            await this.say('記録した。');
          } catch (e) {
            m.close();
            await this.say('記録できなかった。（ブラウザの保存領域が使えません）');
          }
        } else {
          for (const mm of this.modals.slice()) mm.close();
          if (onLoaded) onLoaded();
          this.loadState(s);
        }
      },
    }));
    items.push({ label: '戻る', onSelect: (m) => m.close() });
    new MenuModal(this, { title: mode === 'save' ? 'セーブ' : 'ロード', items, onCancel: (m) => m.close() }).open();
  }

  // ------------------------------------------------------------ state
  roomState(r) {
    const monsters = {};
    for (const m of r.monsters) if (m.id) monsters[m.id] = m.serialize();
    const pushables = {};
    for (const p of r.pushables) pushables[p.id] = p.t;
    return { monsters, pushables, custom: r.def.serialize ? r.def.serialize(r, this) : null };
  }

  restoreRoom(r, st) {
    for (const m of r.monsters) if (m.id && st.monsters && st.monsters[m.id]) m.restore(st.monsters[m.id]);
    for (const p of r.pushables) if (st.pushables && st.pushables[p.id] !== undefined) p.setT(st.pushables[p.id], this, true);
    if (r.def.restore && st.custom) r.def.restore(r, this, st.custom);
    r.nav.rebuild(r.colliders, 0.34);
  }

  serialize() {
    const rooms = { ...this.savedRoomState };
    for (const [id, r] of Object.entries(this.rooms)) rooms[id] = this.roomState(r);
    const p = this.player;
    return {
      v: 1,
      room: this.room ? this.room.id : 'attic',
      x: +p.pos.x.toFixed(3), z: +p.pos.z.toFixed(3), rot: +p.rot.toFixed(3),
      hp: p.hp,
      inv: this.inv.serialize(),
      flags: JSON.parse(JSON.stringify(this.flags)),
      rooms: JSON.parse(JSON.stringify(rooms)),
      stats: { ...this.stats },
      escape: this.escape ? this.escape.t : null,
      entry: this.lastEntry || null,
      date: Date.now(),
    };
  }

  resetWorld() {
    for (const m of this.modals.slice()) m.close();
    for (const r of Object.values(this.rooms)) {
      r.scene.remove(this.player.root);
      r.scene.traverse((o) => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); });
    }
    this.rooms = {};
    this.room = null;
    this.timers = [];
    this.lockCount = 0;
    this.escape = null;
    this.ui.setTimer(null);
    this.player = new Player(this);
    this.transitioning = false;
    this.gfx.u.uWarp.value = 0;
    this.hurt = 0;
  }

  loadState(d) {
    this.resetWorld();
    this.flags = JSON.parse(JSON.stringify(d.flags));
    this.inv.restore(d.inv);
    this.stats = { ...d.stats };
    this.savedRoomState = JSON.parse(JSON.stringify(d.rooms || {}));
    this.player.hp = d.hp;
    this.state = 'play';
    if (this.titleScene) this.titleScene.hide();
    this.ui.hud.classList.remove('hidden');
    this.enterRoom(d.room, null, { quiet: true });
    this.player.place(d.x, d.z, d.rot);
    const p = this.player.pos;
    this.director.update(new THREE.Vector3(p.x, p.y + 1.1, p.z), 0, true);
    if (d.escape) this.escape = { t: Math.max(d.escape, 35) }; // never restore into a hopeless countdown
    this.checkpoint = this.serialize();
    this.audio.music(this.escape ? 'escape' : null);
    this.gfx.u.uFade.value = 1;
    this.fade(0, 0.6);
    this.lastEntry = d.entry;
    const room = this.room;
    if (room.def.enter) this.run(() => room.def.enter(room, this, d.entry));
  }

  // Test helpers (used by the automated walkthrough).
  log(kind, text) {
    (this.testLog || (this.testLog = [])).push(`${kind}: ${String(text).replace(/\n/g, ' ')}`);
    if (this.testLog.length > 400) this.testLog.shift();
  }
  testUse(id, item = null) {
    const it = this.room.interactables.find((i) => i.id === id);
    if (!it) return `no interactable ${id} in ${this.room.id}`;
    this.player.place(it.x, it.z + 0.01, this.player.rot);
    if (item) return this.run(() => it.item(this, item)), 'item';
    this.run(() => it.use(this));
    return 'ok';
  }
  testDoor(to) {
    const it = this.room.interactables.find((i) => i.door && i.door.to === to);
    if (!it) return `no door to ${to} in ${this.room.id}`;
    this.run(() => this.useDoor(this.room, it.door));
    return 'ok';
  }
  get idle() {
    return !this.modals.length && !this.transitioning && this.player.busy === 0 && !this.locked;
  }

  // Debug: frame a given camera shot of a room (for screenshots).
  debugShot(roomId, i) {
    if (!this.room || this.room.id !== roomId) this.debugStart(roomId, null);
    const s = this.room.shots[i];
    if (!s) return false;
    const poly = s.zones[0];
    let x = 0, z = 0;
    for (const [px, pz] of poly) { x += px; z += pz; }
    x /= poly.length; z /= poly.length;
    this.player.place(x, z, this.player.rot);
    this.director.current = s;
    this.director.update(this.player.pos, 0, true);
    this.director.current = s;
    this.onCut(s);
    return s.id;
  }

  // Debug/test entry point: fresh game straight into a room.
  debugStart(roomId, entry, o = {}) {
    this.resetWorld();
    this.flags = { ...(o.flags || {}) };
    this.inv = new Inventory();
    for (const id of o.items || []) this.inv.add(id);
    this.inv.ammo = o.ammo || 0;
    this.state = 'play';
    if (this.titleScene) this.titleScene.hide();
    this.ui.hud.classList.remove('hidden');
    this.gfx.u.uFade.value = 0;
    this.enterRoom(roomId, entry, { quiet: true });
    this.checkpoint = this.serialize();
  }

  // ------------------------------------------------------------ title / intro / ending
  toTitle() {
    this.resetWorld();
    this.state = 'title';
    this.ui.hud.classList.add('hidden');
    if (!this.titleScene) this.titleScene = new TitleScene(this);
    this.titleScene.show('night');
    this.gfx.u.uFade.value = 1;
    this.fade(0, 1.5);
    this.audio.setAmbience('exterior');
    this.audio.music('title');
    this.titleScene.openMenu();
  }

  async newGame() {
    this.resetWorld();
    this.flags = {};
    this.inv = new Inventory();
    this.stats = { kills: 0, saves: 0, deaths: 0, time: 0 };
    this.savedRoomState = {};
    this.player.hp = this.player.maxHp;
    await this.fade(1, 1.0);
    this.titleScene.hide();
    this.state = 'intro';
    this.audio.music('prologue');
    this.audio.setAmbience('rain');
    await new CurtainModal(this, PROLOGUE).open();
    this.ui.setCurtain(0);
    this.state = 'play';
    this.ui.hud.classList.remove('hidden');
    this.enterRoom('attic', 'start', { quiet: true });
    this.checkpoint = this.serialize();
    this.audio.music(null);
    const room = this.room;
    if (room.def.enter) await this.run(() => room.def.enter(room, this, 'start'));
  }

  async ending() {
    this.lock();
    this.escape = null;
    this.ui.setTimer(null);
    await this.fade(1, 1.5);
    this.unlock();
    this.state = 'ending';
    this.ui.hud.classList.add('hidden');
    this.titleScene.show('dawn');
    this.audio.setAmbience('dawn');
    this.audio.music('ending');
    await this.fade(0, 2.5);
    await this.waitReal(4);
    await this.fade(1, 1.5);
    await new CurtainModal(this, EPILOGUE, { hold: 5 }).open();
    const t = Math.floor(this.stats.time);
    const time = `${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    await new CurtainModal(this, [`― THE END ―\n\nクリアタイム　${time}\n倒した怪物　${this.stats.kills}\n力尽きた回数　${this.stats.deaths}\nセーブ回数　${this.stats.saves}\n\nプレイしてくれてありがとう。`], { hold: 9 }).open();
    this.ui.setCurtain(0);
    this.toTitle();
  }
}
