// Title screen: the mansion on its cliff in a storm (and at dawn, burning,
// for the ending).
import * as THREE from 'three';
import { uvBox, uvPlane, rockGeo } from '../engine/geom.js';
import { tex } from '../engine/textures.js';
import { M, C, spriteMat } from './mats.js';
import { Modal, el } from './ui.js';
import { noise1, rng } from '../engine/util.js';

function box(g, m, w, h, d, x, y, z, ry = 0) {
  const mat = typeof m === 'string' ? M(m) : m;
  const mesh = new THREE.Mesh(uvBox(w, h, d, mat.userData.ts || [1, 1]), mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.rotation.y = ry;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

// Gable roof prism over a w x d footprint, ridge along x.
function gable(g, m, w, d, h, x, y, z, ry = 0) {
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2 - 0.3, 0);
  shape.lineTo(d / 2 + 0.3, 0);
  shape.lineTo(0, h);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w + 0.4, bevelEnabled: false });
  geo.translate(0, 0, -(w + 0.4) / 2);
  geo.rotateY(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, typeof m === 'string' ? M(m, { ts: [2, 2] }) : m);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.castShadow = true;
  g.add(mesh);
  return mesh;
}

function buildHouse() {
  const g = new THREE.Group();
  const wall = M('atticWall', { ts: [2, 2], color: 0x8a8070 });
  const trim = C(0x1a1612);
  const roof = C(0x1e2226);
  const windows = [];
  const win = (x, y, z, ry, lit, w = 0.9, h = 1.5) => {
    const glassM = new THREE.MeshBasicMaterial({ color: lit ? 0xffb050 : 0x0c1018 });
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassM);
    pane.position.set(x, y, z);
    pane.rotation.y = ry;
    g.add(pane);
    const fr = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.25, h + 0.25), trim);
    fr.position.set(x - Math.sin(ry) * 0.01, y, z - Math.cos(ry) * 0.01);
    fr.rotation.y = ry;
    g.add(fr);
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.06, h), trim);
    bar.position.set(x + Math.sin(ry) * 0.01, y, z + Math.cos(ry) * 0.01);
    bar.rotation.y = ry;
    g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.06), trim);
    bar2.position.copy(bar.position);
    bar2.position.y += h * 0.12;
    bar2.rotation.y = ry;
    g.add(bar2);
    windows.push({ mat: glassM, lit, flicker: Math.random() });
  };
  // main block
  box(g, wall, 14, 7.2, 9, 0, 0, 0);
  box(g, trim, 14.3, 0.25, 9.3, 0, 3.5, 0);
  box(g, trim, 14.5, 0.3, 9.5, 0, 7.1, 0);
  gable(g, roof, 14, 9, 4.6, 0, 7.3, 0);
  // front windows (z = +4.5)
  for (const x of [-5.2, -2.8, 2.8, 5.2]) {
    win(x, 2.0, 4.51, 0, x === -5.2 || x === 2.8);
    win(x, 5.4, 4.51, 0, x === 5.2);
  }
  win(0, 5.4, 4.51, 0, false);
  // attic dormer with a candle
  box(g, wall, 1.8, 1.8, 1.6, 0, 8.0, 3.2);
  gable(g, roof, 1.6, 2.2, 1.0, 0, 9.8, 3.2, Math.PI / 2);
  win(0, 8.9, 4.02, 0, true, 0.7, 1.0);
  windows[windows.length - 1].attic = true;
  // porch
  box(g, trim, 5, 0.3, 2.4, 0, 0, 5.7);
  for (const x of [-2.2, 2.2]) box(g, C(0xb8b0a0), 0.25, 3.2, 0.25, x, 0.3, 6.6);
  box(g, roof, 5.4, 0.25, 2.8, 0, 3.5, 5.75);
  box(g, C(0x2a1a10), 1.6, 2.6, 0.1, 0, 0.3, 4.52);
  // tower
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 11, 8), wall);
  tower.position.set(7.5, 5.5, 3.2);
  tower.castShadow = true;
  g.add(tower);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(2.5, 5, 8), roof);
  cone.position.set(7.5, 13.5, 3.2);
  cone.castShadow = true;
  g.add(cone);
  for (const y of [2.5, 6, 9.2]) win(7.5 + Math.sin(0.4) * 2.02, y, 3.2 + Math.cos(0.4) * 2.02, 0.4, y === 9.2, 0.7, 1.2);
  // spike on tower
  const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 1.6, 4), trim);
  spike.position.set(7.5, 16.6, 3.2);
  g.add(spike);
  // chimneys
  for (const x of [-4.5, 3.5]) box(g, M('brick', { color: 0x806050 }), 0.9, 4, 0.9, x, 9, -1.5);
  // side wing
  box(g, wall, 6, 5, 7, -9.5, 0, -0.5);
  gable(g, roof, 6, 7, 3.2, -9.5, 5, -0.5);
  for (const x of [-11, -8]) win(x, 2.0, 3.01, 0, x === -8);
  return { group: g, windows };
}

function deadTree(seed, h = 6) {
  const g = new THREE.Group();
  const r = rng(seed);
  const bark = C(0x0e0c0a);
  const branch = (parent, len, rad, depth) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.6, rad, len, 5), bark);
    m.position.y = len / 2;
    parent.add(m);
    if (depth <= 0) return;
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const pivot = new THREE.Group();
      pivot.position.y = len * (0.6 + r() * 0.4);
      pivot.rotation.set((r() - 0.5) * 1.6, r() * Math.PI * 2, (r() - 0.5) * 1.6);
      parent.add(pivot);
      branch(pivot, len * 0.62, rad * 0.6, depth - 1);
    }
  };
  branch(g, h * 0.45, h * 0.05, 3);
  return g;
}

function car() {
  const g = new THREE.Group();
  const body = C(0x1a1e1a, { phong: true, shininess: 60 });
  box(g, body, 1.7, 0.55, 4.0, 0, 0.45, 0);
  box(g, body, 1.5, 0.75, 1.9, 0, 1.0, -0.6);
  box(g, C(0x101418), 1.52, 0.4, 1.0, 0, 1.25, 0.05);
  for (const sx of [-1, 1]) for (const z of [-1.3, 1.3]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 10), C(0x080808));
    w.rotation.z = Math.PI / 2;
    w.position.set(sx * 0.82, 0.42, z);
    g.add(w);
  }
  for (const sx of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }));
    l.position.set(sx * 0.6, 0.85, 2.05);
    g.add(l);
  }
  return g;
}

export class TitleScene {
  constructor(game) {
    this.game = game;
    const s = (this.scene = new THREE.Scene());
    s.fog = new THREE.FogExp2(0x0a0e16, 0.018);
    s.background = new THREE.Color(0x05070c);
    this.camera = new THREE.PerspectiveCamera(42, 4 / 3, 0.1, 400);
    // sky dome
    const skyGeo = new THREE.SphereGeometry(200, 16, 12);
    const skyCols = [];
    const pos = skyGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 200;
      const c = new THREE.Color().lerpColors(new THREE.Color(0x1a2232), new THREE.Color(0x020306), Math.max(0, y));
      skyCols.push(c.r, c.g, c.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyCols, 3));
    this.skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
    this.sky = new THREE.Mesh(skyGeo, this.skyMat);
    s.add(this.sky);
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex('glow'), color: 0xd8e0f0, fog: false, transparent: true, depthWrite: false }));
    this.moon.scale.set(30, 30, 1);
    this.moon.position.set(-60, 70, -150);
    s.add(this.moon);
    // clouds
    this.clouds = [];
    const cr = rng(9);
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex('smoke'), color: 0x2a3040, fog: false, transparent: true, opacity: 0.55, depthWrite: false }));
      c.scale.set(60 + cr() * 60, 18 + cr() * 14, 1);
      c.position.set(-150 + cr() * 300, 40 + cr() * 50, -120 - cr() * 40);
      s.add(c);
      this.clouds.push(c);
    }
    // ground: cliff plateau
    const gtex = M('dirt', { ts: [6, 6], color: 0x6a7060 });
    const ground = new THREE.Mesh(uvPlane(200, 200, [6, 6]), gtex);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    s.add(ground);
    const path = new THREE.Mesh(uvPlane(3, 30, [2, 2]), M('stoneFloor', { color: 0x8a8a80 }));
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.01, 21);
    path.receiveShadow = true;
    s.add(path);
    const house = buildHouse();
    this.house = house;
    s.add(house.group);
    for (let i = 0; i < 9; i++) {
      const t = deadTree(i + 3, 5 + (i % 3) * 2);
      const a = i / 9;
      t.position.set(-30 + a * 60 + (i % 2) * 6, 0, 10 + (i % 3) * 8 + (Math.abs(a - 0.5) < 0.2 ? 10 : 0));
      if (Math.abs(t.position.x) < 6) t.position.x += 12;
      t.rotation.y = i;
      s.add(t);
    }
    const c = car();
    c.position.set(4.5, 0, 16);
    c.rotation.y = -0.5;
    s.add(c);
    // fence
    for (let x = -26; x <= 26; x += 1.2) {
      if (Math.abs(x) < 2) continue;
      box(s, C(0x0a0a0a), 0.06, 1.4, 0.06, x, 0, 27);
    }
    box(s, C(0x0a0a0a), 22, 0.05, 0.05, -14, 1.2, 27);
    box(s, C(0x0a0a0a), 22, 0.05, 0.05, 14, 1.2, 27);
    // rocks at the cliff edge behind
    for (let i = 0; i < 10; i++) {
      const rk = new THREE.Mesh(rockGeo(2 + (i % 3), i + 1, 1, [1.4, 0.6, 1]), M('rock', { flat: true }));
      rk.position.set(-40 + i * 9, 0, -20 - (i % 3) * 4);
      s.add(rk);
    }
    // lights
    this.hemi = new THREE.HemisphereLight(0x4a5a7a, 0x0a0806, 1.2);
    s.add(this.hemi);
    this.moonLight = new THREE.DirectionalLight(0x8090c0, 1.4);
    this.moonLight.position.set(-30, 40, 30);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(1024, 1024);
    Object.assign(this.moonLight.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 120 });
    s.add(this.moonLight);
    this.porch = new THREE.PointLight(0xffa050, 12, 10, 2);
    this.porch.position.set(0, 3, 6.4);
    s.add(this.porch);
    this.carLights = new THREE.SpotLight(0xffe0a0, 40, 30, 0.5, 0.6, 1.5);
    this.carLights.position.set(4.5, 1, 18);
    this.carLights.target.position.set(0, 0, 4);
    s.add(this.carLights, this.carLights.target);
    // rain
    const N = 1600;
    const rp = new Float32Array(N * 6);
    const rr = rng(4);
    for (let i = 0; i < N; i++) {
      const x = (rr() - 0.5) * 60, y = rr() * 30, z = (rr() - 0.5) * 50 + 20;
      rp.set([x, y, z, x - 0.05, y - 0.7, z], i * 6);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x8090a8, transparent: true, opacity: 0.45, fog: false }));
    s.add(this.rain);
    // fire for the ending
    this.fires = new THREE.Group();
    s.add(this.fires);
    const fr = rng(12);
    for (let i = 0; i < 40; i++) {
      const f = new THREE.Sprite(spriteMat('flame', 0xffffff, 0.9));
      const sc = 2 + fr() * 4;
      f.scale.set(sc * 0.7, sc, 1);
      f.position.set(-12 + fr() * 24, 3 + fr() * 9, -3 + fr() * 8);
      f.userData.base = sc;
      f.userData.ph = fr() * 10;
      this.fires.add(f);
    }
    for (let i = 0; i < 16; i++) {
      const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex('smoke'), color: 0x302820, transparent: true, opacity: 0.6, depthWrite: false }));
      sm.scale.set(12, 12, 1);
      sm.position.set(-10 + fr() * 20, 12 + fr() * 15, -2 + fr() * 4);
      sm.userData.ph = fr() * 10;
      this.fires.add(sm);
    }
    this.fireLight = new THREE.PointLight(0xff7020, 0, 60, 1.5);
    this.fireLight.position.set(0, 8, 8);
    s.add(this.fireLight);
    this.t = 0;
    this.flash = 0;
    this.nextFlash = 3;
    this.mode = 'night';
    this.el = null;
  }

  show(mode = 'night') {
    this.mode = mode;
    const dawn = mode === 'dawn';
    this.rain.visible = !dawn;
    this.fires.visible = dawn;
    this.fireLight.intensity = dawn ? 60 : 0;
    const top = dawn ? new THREE.Color(0x1a2a4a) : new THREE.Color(0x020306);
    const bot = dawn ? new THREE.Color(0xd08060) : new THREE.Color(0x1a2232);
    const pos = this.sky.geometry.attributes.position, col = this.sky.geometry.attributes.color;
    for (let i = 0; i < pos.count; i++) {
      const y = Math.max(0, pos.getY(i) / 200);
      const c = new THREE.Color().lerpColors(bot, top, Math.pow(y, 0.6));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
    this.scene.fog.color.set(dawn ? 0x5a4a50 : 0x0a0e16);
    this.scene.fog.density = dawn ? 0.008 : 0.018;
    this.hemi.color.set(dawn ? 0xd0a090 : 0x4a5a7a);
    this.hemi.intensity = dawn ? 1.6 : 1.2;
    this.moonLight.color.set(dawn ? 0xffb080 : 0x8090c0);
    this.moonLight.position.set(dawn ? 40 : -30, dawn ? 12 : 40, 30);
    this.moonLight.intensity = dawn ? 2.0 : 1.4;
    this.moon.visible = !dawn;
    for (const c of this.clouds) c.material.color.set(dawn ? 0x8a6a70 : 0x2a3040);
    for (const w of this.house.windows) w.mat.color.set(dawn ? 0xff8030 : w.lit ? 0xffb050 : 0x0c1018);
    this.porch.intensity = dawn ? 0 : 12;
    this.carLights.intensity = dawn ? 0 : 40;
    this.t = 0;
  }

  hide() {
    if (this.menu) { this.menu.close(); this.menu = null; }
  }

  openMenu() {
    if (this.menu) this.menu.close();
    this.menu = new TitleMenu(this.game);
    this.menu.open();
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    const dawn = this.mode === 'dawn';
    // slow dolly
    const a = dawn ? 0.15 + t * 0.01 : -0.25 + Math.sin(t * 0.05) * 0.12;
    const r = dawn ? 34 : 30 - Math.min(t, 40) * 0.08;
    this.camera.position.set(Math.sin(a) * r, dawn ? 4 : 3 + Math.sin(t * 0.1) * 0.3, 6 + Math.cos(a) * r);
    this.camera.lookAt(0, dawn ? 8 : 6.5, 0);
    for (const c of this.clouds) {
      c.position.x += dt * 1.5;
      if (c.position.x > 160) c.position.x = -160;
    }
    if (this.rain.visible) {
      this.rain.position.y -= dt * 22;
      if (this.rain.position.y < -10) this.rain.position.y += 10;
      this.rain.position.x = Math.sin(t * 0.3) * 0.5;
    }
    // candle in the attic window
    for (const w of this.house.windows) {
      if (w.attic && !dawn) w.mat.color.setRGB(1.0 * (0.8 + noise1(t * 6) * 0.2), 0.62, 0.25);
    }
    if (!dawn) {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) {
        this.nextFlash = 6 + Math.random() * 12;
        this.flash = 1;
        this.flash2 = 0.15 + Math.random() * 0.15;
        this.game.audio.thunder(0.3 + Math.random() * 1.2, 1);
      }
      if (this.flash2 !== undefined && this.flash2 > 0) {
        this.flash2 -= dt;
        if (this.flash2 <= 0) this.flash = 0.8;
      }
      this.flash = Math.max(0, this.flash - dt * 5);
      this.hemi.intensity = 1.2 + this.flash * 6;
      this.moonLight.intensity = 1.4 + this.flash * 8;
      this.skyMat.color.setScalar(1 + this.flash * 4);
    } else {
      for (const f of this.fires.children) {
        const k = 1 + noise1(t * 5 + f.userData.ph) * 0.25;
        if (f.userData.base) f.scale.set(f.userData.base * 0.7 * (2 - k), f.userData.base * k, 1);
        else f.position.y += dt * 1.2, f.position.y > 30 && (f.position.y = 12);
      }
      this.fireLight.intensity = 60 * (1 + noise1(t * 4) * 0.2);
    }
  }
}

class TitleMenu extends Modal {
  constructor(game) {
    super(game);
    this.pauses = false;
    this.stage = 'press';
    this.el = el('div', { id: 'title' }, this.ui.layer);
    const logo = el('div', { class: 'logo' }, this.el);
    el('div', { class: 'en' }, logo, 'ASHCOMBE HOUSE');
    el('div', { class: 'ja' }, logo, '闇にひとり');
    this.press = el('div', { class: 'press fs' }, this.el, this.ui.touch.enabled ? '― タップしてはじめる ―' : '― PRESS ANY KEY ―');
    this.menuEl = el('div', { class: 'tmenu fs hidden' }, this.el);
    this.list = el('ul', { class: 'list' }, this.menuEl);
    el('div', { class: 'copy fs-s' }, this.el, '© 2026 AloneID — an homage to the classic polygon horror');
    this.el.addEventListener('pointerdown', () => { if (this.stage === 'press') this.toMenu(); });
    this.sel = 0;
  }
  toMenu() {
    this.stage = 'menu';
    this.game.audio.unlock();
    this.game.audio.ui('ok');
    this.press.classList.add('hidden');
    this.menuEl.classList.remove('hidden');
    this.build();
  }
  build() {
    const g = this.game;
    const hasSave = g.hasAnySave();
    this.items = [
      { label: 'はじめから', go: () => { this.close(); g.titleScene.menu = null; g.newGame(); } },
      { label: 'つづきから', disabled: !hasSave, go: () => g.openSaveMenu('load') },
      { label: 'チャプター選択', go: () => g.openChapters() },
      { label: '設定', go: () => g.openOptions() },
      { label: '操作方法', go: () => g.showControls() },
    ];
    this.list.innerHTML = '';
    this.items.forEach((it, i) => {
      const li = el('li', { text: it.label }, this.list);
      if (it.disabled) li.classList.add('off');
      li.onclick = () => { if (!it.disabled) { this.sel = i; this.render(); this.game.audio.ui('ok'); it.go(); } };
    });
    if (this.items[this.sel].disabled) this.sel = 0;
    this.render();
  }
  render() {
    [...this.list.children].forEach((li, i) => li.classList.toggle('sel', i === this.sel));
  }
  update(dt, input) {
    if (this.game.modals[this.game.modals.length - 1] !== this) return;
    if (this.stage === 'press') {
      if (input.anyPressed || input.pressedSet.size) this.toMenu();
      return;
    }
    const n = this.items.length;
    const mv = (d) => {
      for (let k = 0; k < n; k++) {
        this.sel = (this.sel + d + n) % n;
        if (!this.items[this.sel].disabled) break;
      }
      this.game.audio.ui('move');
      this.render();
    };
    if (input.pressed('up')) mv(-1);
    if (input.pressed('down')) mv(1);
    if (input.pressed('confirm')) {
      input.consume('confirm', 'action');
      this.game.audio.ui('ok');
      this.items[this.sel].go();
    }
  }
}
