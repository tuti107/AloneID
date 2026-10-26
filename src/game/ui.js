// DOM user interface: HUD, message box, menus, inventory, documents, clock
// dial and on-screen touch controls. Modals are stacked by the Game.
import { ITEMS, itemDesc } from './items.js';
import { DOCS } from './text.js';

export function el(tag, attrs = {}, parent = null, html = null) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  }
  if (html !== null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export class UI {
  constructor(game, app) {
    this.game = game;
    this.app = app;
    this.stage = el('div', { id: 'stage' }, app);
    this.canvas = el('canvas', { id: 'view' }, this.stage);
    this.hud = el('div', { id: 'hud' }, this.stage);
    this.roomName = el('div', { id: 'roomname', class: 'fs' }, this.hud);
    this.objective = el('div', { id: 'objective', class: 'fs-s' }, this.hud);
    this.prompt = el('div', { id: 'prompt', class: 'fs' }, this.hud);
    this.ammoEl = el('div', { id: 'ammo', class: 'fs-s' }, this.hud);
    this.timerEl = el('div', { id: 'timer', class: 'fs-l hidden' }, this.hud);
    this.godEl = el('div', { id: 'god', class: 'fs-s hidden' }, this.hud, '無敵');
    this.layer = el('div', { id: 'layer' }, this.stage);
    this.msg = el('div', { id: 'msg', class: 'fs hidden' }, this.stage);
    this.curtain = el('div', { id: 'curtain', class: 'fs-l' }, this.stage);
    this.curtainText = el('div', { class: 't' }, this.curtain);
    this.touch = new TouchControls(game.input, app, this);
    this.promptText = '';
    this.roomNameTimer = 0;
    window.addEventListener('resize', () => this.layout());
    window.addEventListener('orientationchange', () => setTimeout(() => this.layout(), 200));
  }

  layout() {
    if (!this.game.gfx) return;
    // Lay out inside #app's padding box (safe-area insets / side gutter).
    const cs = getComputedStyle(this.app);
    const pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
    const pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
    const W = Math.max(64, this.app.clientWidth - pl - pr), H = Math.max(48, this.app.clientHeight - pt - pb);
    const touch = this.touch.enabled;
    const portrait = H > W * 1.05;
    let availH = H;
    if (touch && portrait) availH = Math.max(H * 0.5, H - Math.min(300, H * 0.42));
    const scale = Math.max(1, Math.min(W / 4, availH / 3));
    const sw = Math.floor(scale * 4), sh = Math.floor(scale * 3);
    const left = pl + Math.floor((W - sw) / 2);
    const top = pt + (touch && portrait ? Math.floor(Math.max(0, (availH - sh) / 2)) : Math.floor((H - sh) / 2));
    Object.assign(this.stage.style, { left: left + 'px', top: top + 'px', width: sw + 'px', height: sh + 'px' });
    this.stage.style.setProperty('--u', (sw / 320).toFixed(3) + 'px');
    this.app.style.setProperty('--u', (sw / 320).toFixed(3) + 'px');
    this.game.gfx.resizeCanvas(sw, sh);
    this.touch.layout(W, H, { left: left - pl, top: top - pt, width: sw, height: sh }, portrait, pl, pt);
    this.stageRect = { left, top, width: sw, height: sh };
  }

  setPrompt(text) {
    if (text === this.promptText) return;
    this.promptText = text;
    if (text) {
      this.prompt.innerHTML = text;
      this.prompt.classList.add('on');
    } else this.prompt.classList.remove('on');
    this.touch.setActionLabel(text ? this.game.promptVerb || '' : '');
  }

  showRoomName(name) {
    this.roomName.textContent = name;
    this.roomName.classList.add('on');
    this.roomNameTimer = 2.6;
  }

  setAmmo(n, label = '弾') {
    if (n === null) this.ammoEl.classList.remove('on');
    else {
      this.ammoEl.textContent = `${label} ${n}`;
      this.ammoEl.classList.add('on');
    }
  }

  setGodMode(on) {
    this.godEl.classList.toggle('hidden', !on);
  }

  setTimer(sec) {
    if (sec === null) { this.timerEl.classList.add('hidden'); return; }
    this.timerEl.classList.remove('hidden');
    const s = Math.max(0, Math.ceil(sec));
    this.timerEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  update(dt) {
    if (this.roomNameTimer > 0) {
      this.roomNameTimer -= dt;
      if (this.roomNameTimer <= 0) this.roomName.classList.remove('on');
    }
  }

  // Full-screen black curtain with optional centred text.
  setCurtain(alpha, text = null) {
    this.curtain.style.opacity = alpha;
    if (text !== null) {
      this.curtainText.textContent = text;
    }
  }
  curtainTextOn(on) {
    this.curtainText.classList.toggle('on', on);
  }
}

// ------------------------------------------------------------------ modals
export class Modal {
  constructor(game) {
    this.game = game;
    this.ui = game.ui;
    this.pauses = true;
    this.closed = false;
    this.age = 0;
    this.promise = new Promise((r) => (this.resolve = r));
  }
  open() {
    this.game.pushModal(this);
    return this.promise;
  }
  close(result) {
    if (this.closed) return;
    this.closed = true;
    this.game.popModal(this);
    this.destroy();
    this.resolve(result);
  }
  destroy() {
    if (this.el) this.el.remove();
  }
  tick(dt, input) {
    this.age += dt;
    if (this.age <= dt + 1e-6) return; // ignore the frame we opened on
    this.update(dt, input);
  }
  update() {}
}

export class MessageModal extends Modal {
  constructor(game, pages, o = {}) {
    super(game);
    this.pages = Array.isArray(pages) ? pages : [pages];
    this.page = 0;
    this.shown = 0;
    this.speed = o.speed || 48;
    this.who = o.who || null;
    this.box = this.ui.msg;
    this.box.classList.remove('hidden');
    this.box.onclick = () => this.advance();
    this.render();
  }
  get text() { return this.pages[this.page]; }
  render() {
    const t = this.text.slice(0, Math.floor(this.shown));
    const done = this.shown >= this.text.length;
    this.box.innerHTML = (this.who ? `<div class="who">${esc(this.who)}</div>` : '') + esc(t) + (done ? '<span class="next">▼</span>' : '');
  }
  update(dt, input) {
    if (this.game.debugAuto) { this.game.log && this.game.log('say', this.text); this.shown = this.text.length; this.advance(); return; }
    if (this.shown < this.text.length) {
      this.shown = Math.min(this.text.length, this.shown + dt * this.speed);
      this.render();
    }
    if (input.pressed('confirm') || input.pressed('cancel') || input.pressed('attack')) {
      input.consume('confirm', 'cancel', 'action', 'attack');
      this.advance();
    }
  }
  advance() {
    if (this.closed) return;
    if (this.shown < this.text.length) {
      this.shown = this.text.length;
      this.render();
      return;
    }
    this.game.audio.ui('tick');
    if (this.page < this.pages.length - 1) {
      this.page++;
      this.shown = 0;
      this.render();
    } else this.close();
  }
  destroy() {
    this.box.classList.add('hidden');
    this.box.onclick = null;
    this.box.innerHTML = '';
  }
}

export class ChoiceModal extends Modal {
  constructor(game, text, options, o = {}) {
    super(game);
    this.options = options;
    this.sel = o.default || 0;
    this.box = this.ui.msg;
    this.box.classList.remove('hidden');
    this.box.onclick = null;
    this.box.innerHTML = `${esc(text)}<div class="opts"><ul class="list" style="display:flex;gap:2em"></ul></div>`;
    this.list = this.box.querySelector('ul');
    options.forEach((op, i) => {
      const li = el('li', { text: op }, this.list);
      li.onclick = (e) => { e.stopPropagation(); this.sel = i; this.close(i); };
    });
    this.render();
  }
  render() {
    [...this.list.children].forEach((li, i) => li.classList.toggle('sel', i === this.sel));
  }
  update(dt, input) {
    const n = this.options.length;
    if (this.game.debugAuto) { const c = this.game.debugAuto.choices && this.game.debugAuto.choices.length ? this.game.debugAuto.choices.shift() : 0; this.close(c); return; }
    if (input.pressed('left') || input.pressed('up')) { this.sel = (this.sel + n - 1) % n; this.game.audio.ui('move'); this.render(); }
    if (input.pressed('right') || input.pressed('down')) { this.sel = (this.sel + 1) % n; this.game.audio.ui('move'); this.render(); }
    if (input.pressed('confirm')) { input.consume('confirm', 'action'); this.game.audio.ui('ok'); this.close(this.sel); }
    else if (input.pressed('cancel')) { input.consume('cancel', 'attack'); this.game.audio.ui('cancel'); this.close(-1); }
  }
  destroy() {
    this.box.classList.add('hidden');
    this.box.innerHTML = '';
  }
}

// Generic list menu. items: [{label, value(), onSelect(), onChange(dir), disabled}]
export class MenuModal extends Modal {
  constructor(game, o) {
    super(game);
    this.o = o;
    this.items = o.items;
    this.sel = o.sel || 0;
    while (this.items[this.sel] && this.items[this.sel].disabled) this.sel++;
    this.pauses = o.pauses !== false;
    this.el = el('div', { class: o.wrapClass || 'menu-wrap' }, this.ui.layer);
    if (o.bg === false) this.el.style.background = 'none';
    const box = el('div', { class: 'menu panel fs' }, this.el);
    if (o.title) el('h2', { class: 'deco fs' }, box, esc(o.title));
    this.list = el('ul', { class: 'list' }, box);
    if (o.hint) el('div', { class: 'hint fs-s' }, box, esc(o.hint));
    this.build();
  }
  build() {
    this.list.innerHTML = '';
    this.items.forEach((it, i) => {
      const li = el('li', {}, this.list);
      li.innerHTML = esc(typeof it.label === 'function' ? it.label() : it.label) + (it.value ? `<span class="val">${esc(it.value())}</span>` : '');
      if (it.disabled) li.classList.add('off');
      li.onclick = () => {
        if (it.disabled) return;
        this.sel = i;
        if (it.onChange && !it.onSelect) { it.onChange(1); this.game.audio.ui('move'); this.build(); return; }
        this.choose();
      };
    });
    this.render();
  }
  render() {
    [...this.list.children].forEach((li, i) => li.classList.toggle('sel', i === this.sel));
  }
  move(d) {
    const n = this.items.length;
    for (let k = 0; k < n; k++) {
      this.sel = (this.sel + d + n) % n;
      if (!this.items[this.sel].disabled) break;
    }
    this.game.audio.ui('move');
    this.render();
  }
  choose() {
    const it = this.items[this.sel];
    if (!it || it.disabled) return;
    this.game.audio.ui('ok');
    if (it.onSelect) it.onSelect(this);
    else if (it.onChange) { it.onChange(1); this.build(); }
  }
  update(dt, input) {
    if (input.pressed('up')) this.move(-1);
    if (input.pressed('down')) this.move(1);
    const it = this.items[this.sel];
    if (it && it.onChange) {
      if (input.pressed('left')) { it.onChange(-1); this.game.audio.ui('move'); this.build(); }
      if (input.pressed('right')) { it.onChange(1); this.game.audio.ui('move'); this.build(); }
    }
    if (input.pressed('confirm')) { input.consume('confirm', 'action'); this.choose(); }
    else if (input.pressed('cancel') || (this.o.closeOn && input.pressed(this.o.closeOn))) {
      input.consume('cancel', 'attack', 'pause', 'inventory');
      if (this.o.onCancel) { this.game.audio.ui('cancel'); this.o.onCancel(this); }
    }
  }
}

// ------------------------------------------------------------------ inventory
const ACTION_LABEL = { use: '使う', examine: '調べる', equip: '装備する', unequip: '装備を外す', read: '読む', throw: '投げる' };

export class InventoryModal extends Modal {
  constructor(game) {
    super(game);
    this.sel = 0;
    this.mode = 'items';
    this.actSel = 0;
    this.el = el('div', { class: 'inv fs' }, this.ui.layer);
    const items = el('div', { class: 'items panel' }, this.el);
    el('div', { class: 'deco fs-s' }, items, '所持品');
    this.listEl = el('ul', { class: 'list', style: 'margin-top:0.6em' }, items);
    this.view = el('div', { class: 'view' }, this.el);
    this.nameEl = el('div', { class: 'name fs' }, this.view);
    this.actBox = el('div', { class: 'actions panel hidden' }, this.view);
    this.actList = el('ul', { class: 'list' }, this.actBox);
    const bottom = el('div', { class: 'bottom' }, this.el);
    const status = el('div', { class: 'status panel fs-s' }, bottom);
    this.condEl = el('div', {}, status);
    this.barEl = el('i');
    el('div', { class: 'bar' }, status).appendChild(this.barEl);
    this.ecg = el('canvas', { class: 'ecg', width: 160, height: 32 }, status);
    this.descEl = el('div', { class: 'desc panel fs-s' }, bottom);
    this.ecgX = 0;
    this.build();
    game.audio.ui('open');
  }
  get ids() { return this.game.inv.items; }
  get previewItem() { return this.ids[this.sel] || null; }
  build() {
    const g = this.game;
    this.listEl.innerHTML = '';
    if (!this.ids.length) el('li', { class: 'empty' }, this.listEl, '（何も持っていない）');
    this.ids.forEach((id, i) => {
      const li = el('li', {}, this.listEl);
      li.innerHTML = esc(ITEMS[id].name) + (g.inv.equipped === id ? '<span class="eq">［装備］</span>' : '');
      li.onclick = () => {
        if (this.mode === 'actions' && this.sel === i) return;
        this.sel = i;
        this.mode = 'items';
        this.openActions();
      };
    });
    this.sel = Math.min(this.sel, Math.max(0, this.ids.length - 1));
    this.render();
  }
  actionsFor(id) {
    const g = this.game;
    return ITEMS[id].actions.map((a) => (a === 'equip' && g.inv.equipped === id ? 'unequip' : a));
  }
  openActions() {
    const id = this.previewItem;
    if (!id) return;
    this.mode = 'actions';
    this.actSel = 0;
    this.actList.innerHTML = '';
    this.actionsFor(id).forEach((a, i) => {
      const li = el('li', { text: ACTION_LABEL[a] }, this.actList);
      li.onclick = () => { this.actSel = i; this.doAction(); };
    });
    this.actBox.classList.remove('hidden');
    this.game.audio.ui('ok');
    this.render();
  }
  closeActions() {
    this.mode = 'items';
    this.actBox.classList.add('hidden');
    this.render();
  }
  render() {
    const g = this.game;
    [...this.listEl.children].forEach((li, i) => li.classList.toggle('sel', i === this.sel && this.ids.length > 0));
    [...this.actList.children].forEach((li, i) => li.classList.toggle('sel', i === this.actSel));
    const id = this.previewItem;
    this.nameEl.textContent = id ? ITEMS[id].name : '';
    this.descEl.textContent = id ? itemDesc(g, id) : '';
    const hp = g.player.hp / g.player.maxHp;
    const cond = hp > 0.66 ? '良好' : hp > 0.4 ? '注意' : hp > 0.18 ? '危険' : '瀕死';
    this.condEl.innerHTML = `体力　<span style="color:${hp > 0.4 ? '#c8d8a0' : '#e0604a'}">${cond}</span>`;
    this.barEl.style.width = Math.max(0, hp * 100) + '%';
    const sel = this.listEl.children[this.sel];
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
  }
  drawEcg(dt) {
    const c = this.ecg, g = c.getContext('2d');
    const hp = this.game.player.hp / this.game.player.maxHp;
    const bpm = hp > 0.66 ? 70 : hp > 0.4 ? 95 : hp > 0.18 ? 120 : 150;
    const col = hp > 0.66 ? '#8fd070' : hp > 0.4 ? '#d8c050' : '#e05040';
    const speed = 70;
    const x0 = this.ecgX;
    this.ecgX = (this.ecgX + dt * speed) % c.width;
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, 0, c.width, c.height);
    g.clearRect(this.ecgX, 0, 6, c.height);
    g.fillStyle = 'rgba(0,0,0,1)';
    g.fillRect(this.ecgX, 0, 6, c.height);
    const t = performance.now() / 1000;
    const beat = (t * bpm / 60) % 1;
    let y = 0;
    if (beat < 0.05) y = -beat * 200;
    else if (beat < 0.1) y = (beat - 0.075) * 400;
    else if (beat < 0.14) y = -(0.14 - beat) * 100;
    else if (beat > 0.3 && beat < 0.4) y = -Math.sin((beat - 0.3) * 31) * 2;
    g.strokeStyle = col;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x0, this.lastY ?? c.height / 2);
    const ny = c.height / 2 + y;
    if (this.ecgX > x0) g.lineTo(this.ecgX, ny);
    g.stroke();
    this.lastY = ny;
  }
  update(dt, input) {
    this.drawEcg(dt);
    const n = this.ids.length;
    if (this.mode === 'items') {
      if (n && input.pressed('up')) { this.sel = (this.sel + n - 1) % n; this.game.audio.ui('move'); this.render(); }
      if (n && input.pressed('down')) { this.sel = (this.sel + 1) % n; this.game.audio.ui('move'); this.render(); }
      if (input.pressed('confirm')) { input.consume('confirm', 'action'); if (n) this.openActions(); }
      else if (input.pressed('cancel') || input.pressed('inventory') || input.pressed('pause')) {
        input.consume('cancel', 'inventory', 'pause', 'attack');
        this.game.audio.ui('close');
        this.close(null);
      }
    } else {
      const acts = this.actionsFor(this.previewItem);
      if (input.pressed('up')) { this.actSel = (this.actSel + acts.length - 1) % acts.length; this.game.audio.ui('move'); this.render(); }
      if (input.pressed('down')) { this.actSel = (this.actSel + 1) % acts.length; this.game.audio.ui('move'); this.render(); }
      if (input.pressed('confirm')) { input.consume('confirm', 'action'); this.doAction(); }
      else if (input.pressed('cancel')) { input.consume('cancel', 'attack'); this.game.audio.ui('cancel'); this.closeActions(); }
      else if (input.pressed('inventory')) { input.consume('inventory'); this.close(null); }
    }
  }
  async doAction() {
    const id = this.previewItem;
    const act = this.actionsFor(id)[this.actSel];
    const g = this.game;
    g.audio.ui('ok');
    if (act === 'examine') {
      this.closeActions();
      await g.say(itemDesc(g, id));
      return;
    }
    if (act === 'read') {
      this.closeActions();
      await g.readDoc(ITEMS[id].doc);
      return;
    }
    if (act === 'equip' || act === 'unequip') {
      g.equip(act === 'equip' ? id : null);
      this.closeActions();
      this.build();
      return;
    }
    // use / throw act in the world: close first
    this.close(null);
    if (act === 'use') g.run(() => g.useItem(id));
    if (act === 'throw') g.run(() => g.throwItem(id));
  }
}

// ------------------------------------------------------------------ documents
export class DocumentModal extends Modal {
  constructor(game, docId, o = {}) {
    super(game);
    this.doc = typeof docId === 'string' ? DOCS[docId] : docId;
    this.page = 0;
    this.maxPage = o.maxPage ?? this.doc.pages.length - 1;
    this.el = el('div', { class: 'doc-wrap' }, this.ui.layer);
    this.paper = el('div', { class: 'doc fs' + (this.doc.cursed ? ' cursed' : '') }, this.el);
    this.paper.onclick = () => this.next();
    this.render();
    game.audio.sfx('paper');
  }
  render() {
    const pg = this.doc.pages[this.page];
    let h = `<h3>${esc(this.doc.title)}</h3>`;
    pg.forEach((p, i) => {
      if (!p) return;
      h += `<p class="${i === 0 && this.doc.pages[this.page].length > 1 && p.length < 22 ? 'head' : ''}">${esc(p)}</p>`;
    });
    if (this.maxPage > 0) h += `<div class="pg fs-s">${this.page + 1} / ${this.maxPage + 1}　${this.page < this.maxPage ? '▶' : '×'}</div>`;
    this.paper.innerHTML = h;
  }
  next() {
    if (this.page < this.maxPage) {
      this.page++;
      this.game.audio.sfx('paper');
      this.render();
    } else this.close(this.page);
  }
  update(dt, input) {
    if (this.game.debugAuto) { this.game.log && this.game.log('doc', this.doc.title); this.page = this.maxPage; this.next(); return; }
    if (input.pressed('right') || input.pressed('confirm')) { input.consume('confirm', 'action'); this.next(); }
    else if (input.pressed('left') && this.page > 0) { this.page--; this.game.audio.sfx('paper'); this.render(); }
    else if (input.pressed('cancel')) { input.consume('cancel', 'attack'); this.close(this.page); }
  }
}

// ------------------------------------------------------------------ clock dial
export class DialModal extends Modal {
  constructor(game, hour) {
    super(game);
    this.hour = hour;
    this.el = el('div', { class: 'menu-wrap' }, this.ui.layer);
    const box = el('div', { class: 'dial panel fs' }, this.el);
    el('div', { class: 'deco fs' }, box, '針を合わせる');
    this.cv = el('canvas', { width: 96, height: 96 }, box);
    this.label = el('div', { class: 'fs', style: 'margin-top:0.4em' }, box);
    el('div', { class: 'hint fs-s', style: 'color:var(--dim);margin-top:0.6em' }, box, '←→：針を回す　決定：鐘を鳴らす　取消：やめる');
    const row = el('div', { style: 'display:flex;gap:1.5em;margin-top:0.6em' }, box);
    const mk = (t, f) => { const b = el('div', { class: 'panel fs', style: 'padding:0.3em 1em;cursor:pointer' }, row, t); b.onclick = f; };
    mk('◀', () => this.turn(-1));
    mk('決定', () => this.close(this.hour));
    mk('▶', () => this.turn(1));
    this.draw();
  }
  turn(d) {
    this.hour = ((this.hour - 1 + d + 12) % 12) + 1;
    this.game.audio.sfx('tick');
    this.draw();
  }
  draw() {
    const g = this.cv.getContext('2d');
    const s = 96, c = s / 2;
    g.fillStyle = '#1a120a';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#d8ccb0';
    g.beginPath(); g.arc(c, c, 44, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 2;
    g.beginPath(); g.arc(c, c, 40, 0, Math.PI * 2); g.stroke();
    const nums = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    g.fillStyle = '#1a1208'; g.font = 'bold 9px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      g.fillText(nums[i], c + Math.cos(a) * 32, c + Math.sin(a) * 32);
    }
    const a = ((this.hour % 12) / 12) * Math.PI * 2 - Math.PI / 2;
    g.strokeStyle = '#100c08'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a) * 20, c + Math.sin(a) * 20); g.stroke();
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(c, c); g.lineTo(c, c - 30); g.stroke();
    g.fillStyle = '#b08a40'; g.beginPath(); g.arc(c, c, 3, 0, Math.PI * 2); g.fill();
    this.label.textContent = `${this.hour} 時`;
  }
  update(dt, input) {
    if (this.game.debugAuto) { this.close(this.game.debugAuto.dial ?? 3); return; }
    if (input.pressed('left') || input.pressed('down')) this.turn(-1);
    if (input.pressed('right') || input.pressed('up')) this.turn(1);
    if (input.pressed('confirm')) { input.consume('confirm', 'action'); this.close(this.hour); }
    else if (input.pressed('cancel')) { input.consume('cancel', 'attack'); this.close(null); }
  }
}

// ------------------------------------------------------------------ touch
class TouchControls {
  constructor(input, app, ui) {
    this.input = input;
    this.ui = ui;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    this.enabled = !!coarse;
    this.el = el('div', { id: 'touch' }, app);
    this.pad = el('div', { class: 'pad' }, this.el);
    this.knob = el('div', { class: 'knob' }, this.pad);
    this.btns = {};
    const B = (key, label, acts, cls = '') => {
      const b = el('div', { class: 'tbtn ' + cls }, this.el, label);
      const on = (e) => { e.preventDefault(); b.classList.add('on'); for (const a of acts) input.setTouch(a, true); };
      const off = (e) => { e.preventDefault(); b.classList.remove('on'); for (const a of acts) input.setTouch(a, false); };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('pointerleave', off);
      this.btns[key] = b;
      return b;
    };
    B('action', 'アクション', ['action', 'confirm'], 'big');
    B('inventory', '持物', ['inventory', 'cancel'], 'mid');
    B('pause', '≡', ['pause'], 'small');
    this.padId = null;
    const padMove = (e) => {
      const r = this.pad.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      this.knob.style.left = 50 + dx * 32 + '%';
      this.knob.style.top = 50 + dy * 32 + '%';
      const dead = 0.25;
      input.touchStick = l > dead ? { x: dx, y: dy } : null;
      this.knob.classList.toggle('run', l > 0.92);
      const th = 0.38;
      input.setTouch('up', dy < -th);
      input.setTouch('down', dy > th);
      input.setTouch('left', dx < -th);
      input.setTouch('right', dx > th);
    };
    const padEnd = () => {
      this.padId = null;
      this.knob.classList.remove('run');
      this.knob.style.left = '50%';
      this.knob.style.top = '50%';
      input.touchStick = null;
      for (const a of ['up', 'down', 'left', 'right']) input.setTouch(a, false);
    };
    this.pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.padId = e.pointerId;
      this.pad.setPointerCapture(e.pointerId);
      padMove(e);
    });
    this.pad.addEventListener('pointermove', (e) => { if (e.pointerId === this.padId) padMove(e); });
    this.pad.addEventListener('pointerup', padEnd);
    this.pad.addEventListener('pointercancel', padEnd);
    if (!this.enabled) this.el.classList.add('hidden');
    window.addEventListener('touchstart', () => {
      if (!this.enabled) {
        this.enabled = true;
        this.el.classList.remove('hidden');
        ui.layout();
      }
    }, { passive: true });
    window.addEventListener('keydown', () => {
      if (this.enabled && !coarse) {
        this.enabled = false;
        this.el.classList.add('hidden');
        ui.layout();
      }
    });
  }
  setActionLabel(t) {
    const label = t || 'アクション';
    if (this.btns.action.textContent !== label) this.btns.action.textContent = label;
    this.btns.action.classList.toggle('hot', !!t);
  }
  layout(W, H, stage, portrait, ox = 0, oy = 0) {
    if (!this.enabled) return;
    const b = this.btns;
    const place = (e, x, y) => { e.style.left = ox + x + 'px'; e.style.top = oy + y + 'px'; };
    const pr = 75;
    if (portrait) {
      const areaTop = stage.top + stage.height;
      const areaH = H - areaTop;
      const cy = areaTop + areaH * 0.55;
      place(this.pad, 24, cy - pr);
      place(b.action, W - 24 - 96, cy - 48);
      place(b.inventory, W - 24 - 96 - 74, cy + 22);
      place(b.pause, W - 56, Math.max(8, areaTop + 8));
    } else {
      const cy = H * 0.66;
      place(this.pad, Math.max(12, (stage.left - 150) / 2), cy - pr);
      const right = W - Math.max(12, (stage.left - 110) / 2);
      place(b.action, right - 96, cy - 48);
      place(b.inventory, right - 82, cy - 140);
      place(b.pause, W - 56, 10);
    }
  }
}
