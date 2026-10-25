// The map screen: a floor plan of the rooms Edgar has been in, the doors
// between them, and where he stands now.
import { Modal, el } from './ui.js';
import { FLOORS, MAP_ROOMS, MAP_LINKS, MAP_MARKS } from './mapdata.js';
import { ROOMS } from './rooms/index.js';

const INK = '#e9dfc8', DIM = '#9a8d74', GOLD = '#e0b54a', GOLD2 = '#6e5426', RED = '#c04030';

// A point of a room, in its own coordinates, placed in its box on the map
// (clamped to the box, so a door on the wall lands on its edge).
function toBox(id, x, z) {
  const m = MAP_ROOMS[id];
  const [rx0, rz0, rx1, rz1] = m.rect, [bx0, bz0, bx1, bz1] = m.box;
  const u = Math.min(1, Math.max(0, (x - rx0) / (rx1 - rx0)));
  const v = Math.min(1, Math.max(0, (z - rz0) / (rz1 - rz0)));
  return [bx0 + u * (bx1 - bx0), bz0 + v * (bz1 - bz0)];
}

// Which way a door on a box edge leads out: [dx, dz].
function outward(id, p) {
  const [x0, z0, x1, z1] = MAP_ROOMS[id].box;
  const d = [[Math.abs(p[0] - x0), [-1, 0]], [Math.abs(p[0] - x1), [1, 0]], [Math.abs(p[1] - z0), [0, -1]], [Math.abs(p[1] - z1), [0, 1]]];
  d.sort((a, b) => a[0] - b[0]);
  return d[0][1];
}

export class MapModal extends Modal {
  constructor(game) {
    super(game);
    const g = game;
    this.here = g.room ? g.room.id : null;
    this.visited = (id) => !!g.flags['visited:' + id] || id === this.here;
    const cur = this.here && MAP_ROOMS[this.here] ? MAP_ROOMS[this.here].floor : null;
    this.floors = FLOORS.filter((f) => f.id === cur || Object.entries(MAP_ROOMS).some(([id, m]) => m.floor === f.id && this.visited(id)));
    this.fi = Math.max(0, this.floors.findIndex((f) => f.id === cur));
    this.el = el('div', { class: 'menu-wrap' }, this.ui.layer);
    const box = el('div', { class: 'mapbox panel fs' }, this.el);
    el('div', { class: 'deco fs' }, box, '見取り図');
    this.tabs = el('div', { class: 'tabs fs-s' }, box);
    this.floors.forEach((f, i) => {
      const t = el('span', {}, this.tabs, f.name);
      t.onclick = () => this.setFloor(i);
    });
    this.cv = el('canvas', {}, box);
    const foot = el('div', { class: 'foot fs-s' }, box);
    const name = this.here && ROOMS[this.here] ? ROOMS[this.here].name : '';
    el('span', {}, foot, `現在地：${name}`);
    el('span', {}, foot, g.ui.touch.enabled ? '' : '←→：階を切り替え　取消：閉じる');
    const close = el('span', { class: 'close' }, foot, '閉じる');
    close.onclick = () => this.shut();
    this.t = 0;
    this.setFloor(this.fi, true);
  }

  setFloor(i, quiet = false) {
    if (!this.floors.length) return;
    this.fi = (i + this.floors.length) % this.floors.length;
    [...this.tabs.children].forEach((t, k) => t.classList.toggle('sel', k === this.fi));
    if (!quiet) this.game.audio.ui('move');
    this.draw();
  }

  shut() {
    this.game.audio.ui('cancel');
    this.close();
  }

  update(dt, input) {
    this.t += dt;
    if (input.pressed('left')) this.setFloor(this.fi - 1);
    if (input.pressed('right')) this.setFloor(this.fi + 1);
    if (input.pressed('cancel') || input.pressed('confirm') || input.pressed('pause') || input.pressed('map') || input.pressed('inventory')) {
      input.consume('cancel', 'confirm', 'action', 'attack', 'pause', 'map', 'inventory');
      this.shut();
      return;
    }
    this.draw();
  }

  draw() {
    const cv = this.cv;
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = Math.max(64, Math.round(r.width * dpr)), H = Math.max(48, Math.round(r.height * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const c = cv.getContext('2d');
    c.fillStyle = '#0b0907';
    c.fillRect(0, 0, W, H);
    const floor = this.floors[this.fi];
    if (!floor) return;
    const g = this.game;
    const rooms = Object.entries(MAP_ROOMS).filter(([, m]) => m.floor === floor.id);
    // fit the whole floor (seen or not), so the plan never jumps about
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const [, m] of rooms) { x0 = Math.min(x0, m.box[0]); z0 = Math.min(z0, m.box[1]); x1 = Math.max(x1, m.box[2]); z1 = Math.max(z1, m.box[3]); }
    const pad = 3.2;
    x0 -= pad; z0 -= pad; x1 += pad; z1 += pad;
    const s = Math.min(W / (x1 - x0), H / (z1 - z0), 26 * dpr);
    const ox = (W - (x1 - x0) * s) / 2 - x0 * s, oz = (H - (z1 - z0) * s) / 2 - z0 * s;
    const P = ([x, z]) => [ox + x * s, oz + z * s];
    const px = Math.max(1, dpr);
    const font = (k) => `${Math.round(k * dpr)}px 'DotGothic16', 'MS Gothic', 'Hiragino Kaku Gothic ProN', monospace`;
    const fontPx = Math.max(10, Math.min(16, r.width / 28));
    // faint survey grid
    c.strokeStyle = 'rgba(184,149,74,0.07)';
    c.lineWidth = px;
    const step = 2 * s;
    for (let x = ((ox % step) + step) % step; x < W; x += step) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = ((oz % step) + step) % step; y < H; y += step) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }

    const blink = 0.55 + 0.45 * Math.sin(this.t * 5);
    const onFloor = (id) => MAP_ROOMS[id] && MAP_ROOMS[id].floor === floor.id;
    const floorName = (id) => (FLOORS.find((f) => f.id === MAP_ROOMS[id].floor) || {}).name || '';
    const doorTicks = [];
    const labels = [];
    // passages first, under the rooms
    for (const L of MAP_LINKS) {
      if (L.act && (g.flags.act || 1) < L.act) continue;
      for (const [a, ap, b, bp] of [[L.a, L.ap, L.b, L.bp], [L.b, L.bp, L.a, L.ap]]) {
        if (!onFloor(a) || !this.visited(a)) continue;
        const pa = toBox(a, ...ap);
        const da = outward(a, pa);
        // red on the side the locked door is on, until it is opened
        const locked = a === L.a && L.door && g.flags['locked:' + L.door] && !g.flags['unlocked:' + L.door];
        doorTicks.push({ p: pa, d: da, locked });
        if (onFloor(b) && this.visited(b)) {
          if (a > b) continue; // draw a passage once
          const pb = toBox(b, ...bp);
          const db = outward(b, pb);
          c.strokeStyle = GOLD2;
          c.lineWidth = 2.2 * px;
          c.beginPath();
          const A = P(pa), B = P(pb);
          c.moveTo(...A);
          if (Math.abs(A[0] - B[0]) > 1 && Math.abs(A[1] - B[1]) > 1) {
            if (da[0] !== 0 && db[0] !== 0) { const mx = (A[0] + B[0]) / 2; c.lineTo(mx, A[1]); c.lineTo(mx, B[1]); }
            else if (da[1] !== 0 && db[1] !== 0) { const my = (A[1] + B[1]) / 2; c.lineTo(A[0], my); c.lineTo(B[0], my); }
            else if (da[0] !== 0) c.lineTo(B[0], A[1]);
            else c.lineTo(A[0], B[1]);
          }
          c.lineTo(...B);
          c.stroke();
        } else {
          // a way on: to another floor, or somewhere not yet seen
          const A = P(pa);
          const len = 1.3 * s;
          const E = [A[0] + da[0] * len, A[1] + da[1] * len];
          c.strokeStyle = GOLD2;
          c.lineWidth = 2.2 * px;
          c.setLineDash([3 * px, 3 * px]);
          c.beginPath(); c.moveTo(...A); c.lineTo(...E); c.stroke();
          c.setLineDash([]);
          const other = !onFloor(b);
          const up = other && FLOORS.findIndex((f) => f.id === MAP_ROOMS[b].floor) < this.fi;
          const text = other ? `${up ? '▲' : '▼'}${floorName(b)}` : '？';
          labels.push({ x: E[0] + da[0] * 2 * px, y: E[1] + da[1] * 2 * px, d: da, text, color: other ? GOLD : DIM });
        }
      }
    }
    // rooms
    for (const [id, m] of rooms) {
      if (!this.visited(id)) continue;
      const [a, b] = [P([m.box[0], m.box[1]]), P([m.box[2], m.box[3]])];
      const here = id === this.here;
      c.fillStyle = here ? '#3a2c14' : '#221c13';
      c.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
      c.strokeStyle = here ? `rgba(224,181,74,${0.6 + 0.4 * blink})` : '#8a7448';
      c.lineWidth = (here ? 2 : 1.4) * px;
      c.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
      const name = ROOMS[id] ? ROOMS[id].name : id;
      const bw = b[0] - a[0], bh = b[1] - a[1];
      let k = fontPx;
      c.font = font(k);
      c.fillStyle = here ? '#fff' : INK;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      if (c.measureText(name).width > bw - 6 * px && bh > bw * 1.8) {
        // a long narrow room: its name runs down it, one character under another
        const chars = [...name];
        while (k > 7 && chars.length * k * 1.08 * dpr > bh - 6 * px) { k -= 0.5; c.font = font(k); }
        const step = k * 1.08 * dpr, y0 = (a[1] + b[1]) / 2 - ((chars.length - 1) * step) / 2;
        chars.forEach((ch, i) => c.fillText(ch, (a[0] + b[0]) / 2, y0 + i * step));
      } else {
        while (k > 7 && c.measureText(name).width > bw - 6 * px) { k -= 0.5; c.font = font(k); }
        c.fillText(name, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      }
    }
    // doors: a bright gap across the wall
    for (const t of doorTicks) {
      const [x, y] = P(t.p);
      const half = 0.55 * s;
      c.strokeStyle = t.locked ? RED : '#d8c9a4';
      c.lineWidth = 3 * px;
      c.beginPath();
      if (t.d[0] !== 0) { c.moveTo(x, y - half); c.lineTo(x, y + half); } else { c.moveTo(x - half, y); c.lineTo(x + half, y); }
      c.stroke();
    }
    for (const mk of MAP_MARKS) {
      if (!onFloor(mk.room) || !this.visited(mk.room)) continue;
      const p = toBox(mk.room, ...mk.at);
      const d = outward(mk.room, p);
      const [x, y] = P(p);
      const half = 0.9 * s;
      c.strokeStyle = RED;
      c.lineWidth = 3 * px;
      c.beginPath();
      if (d[0] !== 0) { c.moveTo(x, y - half); c.lineTo(x, y + half); } else { c.moveTo(x - half, y); c.lineTo(x + half, y); }
      c.stroke();
      labels.push({ x: x + d[0] * 4 * px, y: y + d[1] * 4 * px, d, text: mk.label, color: RED });
    }
    c.font = font(fontPx * 0.85);
    for (const l of labels) {
      c.textAlign = l.d[0] > 0 ? 'left' : l.d[0] < 0 ? 'right' : 'center';
      c.textBaseline = l.d[1] > 0 ? 'top' : l.d[1] < 0 ? 'bottom' : 'middle';
      // on a dark tag, so it reads over walls and passages
      const w = c.measureText(l.text).width, h = fontPx * 0.85 * dpr;
      const x0 = c.textAlign === 'left' ? l.x : c.textAlign === 'right' ? l.x - w : l.x - w / 2;
      const y0 = c.textBaseline === 'top' ? l.y : c.textBaseline === 'bottom' ? l.y - h : l.y - h / 2;
      c.fillStyle = 'rgba(11,9,7,0.88)';
      c.fillRect(x0 - 2 * px, y0 - 1 * px, w + 4 * px, h + 2 * px);
      c.fillStyle = l.color;
      c.fillText(l.text, l.x, l.y);
    }
    // Edgar
    if (this.here && onFloor(this.here) && g.player) {
      const p = g.player;
      const [x, y] = P(toBox(this.here, p.pos.x, p.pos.z));
      const fx = Math.sin(p.rot), fz = Math.cos(p.rot);
      const R = Math.max(5 * px, 0.75 * s);
      c.fillStyle = `rgba(232,90,58,${0.5 + 0.5 * blink})`;
      c.strokeStyle = '#000';
      c.lineWidth = px;
      c.beginPath();
      c.moveTo(x + fx * R, y + fz * R);
      c.lineTo(x - fx * R * 0.6 - fz * R * 0.6, y - fz * R * 0.6 + fx * R * 0.6);
      c.lineTo(x - fx * R * 0.6 + fz * R * 0.6, y - fz * R * 0.6 - fx * R * 0.6);
      c.closePath();
      c.fill();
      c.stroke();
    }
  }
}
