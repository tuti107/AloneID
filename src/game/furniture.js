// Low-poly furniture and props. Each builder returns a THREE.Group whose
// origin sits on the floor at the footprint centre, front facing +z.
// userData.col = [w, d] gives the collision footprint.
import * as THREE from 'three';
import { uvBox, frustum, rockGeo } from '../engine/geom.js';
import { M, C, mat } from './mats.js';

const G = () => new THREE.Group();

// Bottom-anchored box.
export function bx(g, m, w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const material = mat(m);
  const mesh = new THREE.Mesh(uvBox(w, h, d, material.userData.ts || [1, 1]), material);
  mesh.position.set(x, y + h / 2, z);
  mesh.rotation.set(rx, ry, rz);
  g.add(mesh);
  return mesh;
}
// Bottom-anchored cylinder.
export function cy(g, m, rTop, rBot, h, x = 0, y = 0, z = 0, seg = 8) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat(m));
  mesh.position.set(x, y + h / 2, z);
  g.add(mesh);
  return mesh;
}
export function sp(g, m, r, x, y, z, ws = 8, hs = 6) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat(m));
  mesh.position.set(x, y, z);
  g.add(mesh);
  return mesh;
}
const brass = () => M('brass', { phong: true, shininess: 50, specular: 0x665533 });

// ------------------------------------------------------------------ storage
export function wardrobe({ w = 1.2, h = 2.1, d = 0.6, wood = 'woodRed' } = {}) {
  const g = G();
  bx(g, wood, w, h - 0.17, d, 0, 0.1, 0);
  bx(g, 'woodBlack', w + 0.06, 0.1, d + 0.04, 0, 0, 0);
  bx(g, wood, w + 0.1, 0.08, d + 0.08, 0, h - 0.15, 0);
  bx(g, 'woodBlack', w + 0.16, 0.07, d + 0.12, 0, h - 0.07, 0);
  const doors = [];
  for (const sx of [-1, 1]) {
    const pivot = G();
    pivot.position.set(sx * (w / 2 - 0.01), 0, d / 2);
    g.add(pivot);
    const cx = -sx * (w / 4 - 0.01);
    bx(pivot, wood, w / 2 - 0.03, h - 0.4, 0.03, cx, 0.18, 0.015);
    bx(pivot, 'woodBlack', w / 2 - 0.16, (h - 0.4) * 0.36, 0.015, cx, 0.3, 0.035);
    bx(pivot, 'woodBlack', w / 2 - 0.16, (h - 0.4) * 0.42, 0.015, cx, 0.3 + (h - 0.4) * 0.45, 0.035);
    sp(pivot, brass(), 0.025, -sx * 0.06, 1.05, 0.05, 6, 4);
    doors.push({ pivot, sx });
  }
  g.userData.col = [w + 0.1, d + 0.1];
  g.userData.doors = doors;
  g.userData.setOpen = (v) => { for (const dd of doors) dd.pivot.rotation.y = dd.sx * v * 1.6; };
  return g;
}

export function trunk({ w = 1.0, h = 0.55, d = 0.55 } = {}) {
  const g = G();
  bx(g, 'woodLight', w, h * 0.7, d, 0, 0, 0);
  const lid = G();
  lid.position.set(0, h * 0.7, -d / 2);
  g.add(lid);
  bx(lid, 'woodLight', w, h * 0.3, d, 0, 0, d / 2);
  for (const x of [-w * 0.32, w * 0.32]) {
    bx(g, 'iron', 0.06, h * 0.7 + 0.01, d + 0.02, x, 0, 0);
    bx(lid, 'iron', 0.06, h * 0.3 + 0.01, d + 0.02, x, 0, d / 2);
  }
  bx(g, 'iron', w + 0.02, 0.05, d + 0.02, 0, 0.02, 0);
  bx(lid, brass(), 0.1, 0.12, 0.02, 0, -0.06, d + 0.005);
  g.userData.col = [w + 0.05, d + 0.05];
  g.userData.lid = lid;
  g.userData.setOpen = (v) => { lid.rotation.x = -v * 1.9; };
  return g;
}

export function crate({ s = 0.6, h = null } = {}) {
  const g = G();
  bx(g, 'crate', s, h || s, s, 0, 0, 0);
  g.userData.col = [s, s];
  return g;
}

export function barrel({ r = 0.32, h = 0.85 } = {}) {
  const g = G();
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push(new THREE.Vector2(r * (0.86 + Math.sin(t * Math.PI) * 0.14), t * h));
  }
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 12), M('wood', { ts: [0.5, 0.5] }));
  g.add(body);
  for (const t of [0.12, 0.88]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(r * (0.86 + Math.sin(t * Math.PI) * 0.14) + 0.005, 0.015, 3, 12), M('iron'));
    band.rotation.x = Math.PI / 2;
    band.position.y = t * h;
    g.add(band);
  }
  cy(g, 'woodBlack', r * 0.86, r * 0.86, 0.01, 0, h - 0.01, 0, 12);
  g.userData.col = [r * 2, r * 2];
  return g;
}

export function bookshelf({ w = 1.6, h = 2.4, d = 0.4, wood = 'wood', books = 'books' } = {}) {
  const g = G();
  bx(g, wood, 0.05, h, d, -w / 2 + 0.025, 0, 0);
  bx(g, wood, 0.05, h, d, w / 2 - 0.025, 0, 0);
  bx(g, wood, w, 0.05, d, 0, h - 0.05, 0);
  bx(g, 'woodBlack', w + 0.08, 0.08, d + 0.05, 0, h, 0.01);
  bx(g, wood, w, 0.1, d, 0, 0, 0);
  bx(g, M(books), w - 0.1, h - 0.15, d - 0.06, 0, 0.1, -0.02);
  g.userData.col = [w, d];
  return g;
}

export function wineRack({ w = 1.2, h = 2.0, d = 0.45 } = {}) {
  const g = G();
  bx(g, 'wood', 0.06, h, d, -w / 2 + 0.03, 0, 0);
  bx(g, 'wood', 0.06, h, d, w / 2 - 0.03, 0, 0);
  bx(g, 'wood', w, 0.06, d, 0, h - 0.06, 0);
  bx(g, M('wineRack'), w - 0.12, h - 0.1, d - 0.04, 0, 0.04, 0);
  g.userData.col = [w, d];
  return g;
}

// ------------------------------------------------------------------ tables
export function desk({ w = 1.4, d = 0.7, h = 0.78, wood = 'woodRed' } = {}) {
  const g = G();
  bx(g, wood, w, 0.05, d, 0, h - 0.05, 0);
  bx(g, 'leather', w * 0.6, 0.005, d * 0.6, 0, h, 0.02);
  for (const sx of [-1, 1]) {
    const px = sx * (w / 2 - 0.22);
    bx(g, wood, 0.42, h - 0.05, d - 0.06, px, 0, 0);
    for (let i = 0; i < 3; i++) {
      const dy = 0.08 + i * ((h - 0.2) / 3);
      bx(g, 'woodBlack', 0.36, (h - 0.25) / 3 - 0.02, 0.02, px, dy, d / 2 - 0.02);
      sp(g, brass(), 0.015, px, dy + (h - 0.25) / 6, d / 2 + 0.005, 5, 3);
    }
  }
  bx(g, wood, w - 0.84, h * 0.6, 0.02, 0, h * 0.3, -d / 2 + 0.05);
  bx(g, 'woodBlack', w - 0.86, 0.1, 0.02, 0, h - 0.16, d / 2 - 0.03);
  g.userData.col = [w, d];
  return g;
}

export function table({ w = 1.2, d = 0.8, h = 0.76, wood = 'woodRed', cloth = false, legs = 'turned' } = {}) {
  const g = G();
  bx(g, wood, w, 0.05, d, 0, h - 0.05, 0);
  bx(g, wood, w - 0.1, 0.08, d - 0.1, 0, h - 0.13, 0);
  const lx = w / 2 - 0.08, lz = d / 2 - 0.08;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      if (legs === 'turned') {
        const leg = new THREE.Mesh(frustum(0.07, 0.07, 0.045, 0.045, -(h - 0.05)), mat(wood));
        leg.position.set(sx * lx, h - 0.05, sz * lz);
        g.add(leg);
      } else bx(g, wood, 0.06, h - 0.05, 0.06, sx * lx, 0, sz * lz);
    }
  }
  if (cloth) {
    const lm = M('linen', { ts: [1.5, 1.5], color: 0x8a8478 });
    bx(g, lm, w + 0.12, 0.012, d + 0.12, 0, h, 0);
    for (const sz of [-1, 1]) bx(g, lm, w + 0.12, 0.28, 0.012, 0, h - 0.27, sz * (d / 2 + 0.06));
    for (const sx of [-1, 1]) bx(g, lm, 0.012, 0.28, d + 0.12, sx * (w / 2 + 0.06), h - 0.27, 0);
  }
  g.userData.col = [w + 0.05, d + 0.05];
  g.userData.top = h;
  return g;
}

export function sideTable({ s = 0.5, h = 0.7, wood = 'woodRed' } = {}) {
  const g = G();
  cy(g, wood, s / 2, s / 2, 0.04, 0, h - 0.04, 0, 10);
  cy(g, wood, 0.03, 0.05, h - 0.04, 0, 0, 0, 6);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    bx(g, wood, 0.04, 0.05, s * 0.45, Math.sin(a) * s * 0.2, 0, Math.cos(a) * s * 0.2, 0, a);
  }
  g.userData.col = [s * 0.8, s * 0.8];
  g.userData.top = h;
  return g;
}

export function nightstand({ wood = 'woodRed' } = {}) {
  const g = G();
  bx(g, wood, 0.5, 0.6, 0.42, 0, 0.05, 0);
  bx(g, 'woodBlack', 0.54, 0.03, 0.46, 0, 0.65, 0);
  bx(g, 'woodBlack', 0.42, 0.16, 0.02, 0, 0.42, 0.21);
  sp(g, brass(), 0.018, 0, 0.5, 0.225, 5, 3);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, 'woodBlack', 0.05, 0.05, 0.05, sx * 0.21, 0, sz * 0.17);
  g.userData.col = [0.52, 0.45];
  g.userData.top = 0.68;
  return g;
}

export function dresser({ w = 1.2, wood = 'woodRed', mirror = true } = {}) {
  const g = G();
  bx(g, wood, w, 0.85, 0.5, 0, 0.06, 0);
  bx(g, 'woodBlack', w + 0.04, 0.04, 0.54, 0, 0.91, 0);
  for (let i = 0; i < 3; i++) {
    bx(g, 'woodBlack', w - 0.1, 0.22, 0.02, 0, 0.12 + i * 0.26, 0.25);
    for (const sx of [-1, 1]) sp(g, brass(), 0.02, sx * w * 0.25, 0.23 + i * 0.26, 0.27, 5, 3);
  }
  if (mirror) {
    bx(g, wood, w * 0.7, 0.9, 0.04, 0, 0.95, -0.2);
    bx(g, M('mirror', { phong: true, shininess: 90, specular: 0x8899aa }), w * 0.58, 0.75, 0.01, 0, 1.02, -0.175);
  }
  g.userData.col = [w, 0.52];
  g.userData.top = 0.95;
  return g;
}

// ------------------------------------------------------------------ seats
export function chair({ wood = 'wood', seat = 'velvet' } = {}) {
  const g = G();
  bx(g, wood, 0.45, 0.05, 0.45, 0, 0.4, 0);
  bx(g, seat, 0.41, 0.05, 0.41, 0, 0.45, 0.01);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, wood, 0.04, 0.4, 0.04, sx * 0.19, 0, sz * 0.19);
  for (const sx of [-1, 1]) bx(g, wood, 0.045, 0.58, 0.045, sx * 0.19, 0.45, -0.2);
  bx(g, wood, 0.12, 0.38, 0.025, 0, 0.55, -0.205);
  bx(g, wood, 0.44, 0.07, 0.05, 0, 0.98, -0.2);
  g.userData.col = [0.46, 0.46];
  return g;
}

export function armchair({ fabric = 'velvet', wood = 'woodBlack' } = {}) {
  const g = G();
  bx(g, fabric, 0.75, 0.3, 0.75, 0, 0.12, 0);
  bx(g, fabric, 0.6, 0.12, 0.62, 0, 0.42, 0.05);
  bx(g, fabric, 0.75, 0.75, 0.18, 0, 0.42, -0.29);
  bx(g, fabric, 0.65, 0.18, 0.2, 0, 1.12, -0.31, -0.2);
  for (const sx of [-1, 1]) {
    bx(g, fabric, 0.14, 0.32, 0.72, sx * 0.33, 0.42, 0.02);
    bx(g, fabric, 0.16, 0.08, 0.74, sx * 0.33, 0.74, 0.02);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, wood, 0.06, 0.12, 0.06, sx * 0.32, 0, sz * 0.32);
  g.userData.col = [0.78, 0.78];
  return g;
}

export function sofa({ w = 1.9, fabric = 'velvetGreen' } = {}) {
  const g = G();
  bx(g, fabric, w, 0.3, 0.8, 0, 0.12, 0);
  for (const sx of [-1, 1]) bx(g, fabric, w / 2 - 0.12, 0.12, 0.62, sx * (w / 4 - 0.02), 0.42, 0.06);
  bx(g, fabric, w, 0.6, 0.18, 0, 0.42, -0.31);
  for (const sx of [-1, 1]) bx(g, fabric, 0.16, 0.42, 0.8, sx * (w / 2 - 0.08), 0.42, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, 'woodBlack', 0.06, 0.12, 0.06, sx * (w / 2 - 0.08), 0, sz * 0.33);
  g.userData.col = [w, 0.82];
  return g;
}

export function rockingChair() {
  const g = chair({ wood: 'woodLight', seat: 'woodLight' });
  for (const sx of [-1, 1]) {
    const r = bx(g, 'woodLight', 0.04, 0.04, 0.9, sx * 0.19, 0.0, 0);
    r.rotation.x = 0.06;
  }
  g.userData.col = [0.5, 0.8];
  return g;
}

export function bench({ w = 0.9 } = {}) {
  const g = G();
  bx(g, 'velvet', w, 0.08, 0.38, 0, 0.42, 0);
  bx(g, 'woodBlack', w - 0.04, 0.06, 0.34, 0, 0.36, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, 'woodBlack', 0.05, 0.36, 0.05, sx * (w / 2 - 0.06), 0, sz * 0.13);
  g.userData.col = [w, 0.4];
  return g;
}

// ------------------------------------------------------------------ beds
export function bed({ w = 1.6, l = 2.1, wood = 'woodRed', canopy = true } = {}) {
  const g = G();
  bx(g, wood, w, 0.25, l, 0, 0.12, 0);
  bx(g, M('linen', { ts: [1.2, 1.2] }), w - 0.08, 0.22, l - 0.12, 0, 0.37, 0.03);
  bx(g, 'quilt', w - 0.02, 0.06, l * 0.66, 0, 0.57, l * 0.17);
  for (const sx of [-1, 1]) bx(g, 'quilt', 0.02, 0.36, l * 0.66, sx * (w / 2 - 0.01), 0.24, l * 0.17);
  bx(g, 'quilt', w - 0.02, 0.36, 0.02, 0, 0.24, l / 2 - 0.02);
  for (const sx of [-1, 1]) {
    const p = bx(g, M('linen', { ts: [1.2, 1.2] }), w * 0.38, 0.13, 0.36, sx * w * 0.22, 0.58, -l / 2 + 0.28);
    p.rotation.x = -0.25;
  }
  bx(g, wood, w + 0.1, 1.15, 0.08, 0, 0.3, -l / 2 + 0.04);
  bx(g, 'woodBlack', w + 0.16, 0.08, 0.12, 0, 1.43, -l / 2 + 0.04);
  bx(g, wood, w + 0.1, 0.5, 0.06, 0, 0.25, l / 2 - 0.03);
  const ph = canopy ? 2.2 : 1.35;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const h = sz < 0 ? ph : canopy ? ph : 0.95;
      cy(g, 'woodBlack', 0.045, 0.06, h, sx * (w / 2 + 0.04), 0, sz * (l / 2 - 0.02), 6);
    }
  }
  if (canopy) {
    for (const sx of [-1, 1]) bx(g, 'woodBlack', 0.06, 0.08, l + 0.06, sx * (w / 2 + 0.04), ph - 0.04, 0);
    for (const sz of [-1, 1]) bx(g, 'woodBlack', w + 0.14, 0.08, 0.06, 0, ph - 0.04, sz * (l / 2 - 0.02));
    const cm = M('curtainRed', { side: THREE.DoubleSide });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, cm, 0.04, ph - 0.3, 0.36, sx * (w / 2 + 0.07), 0.3, sz * (l / 2 - 0.22));
    bx(g, cm, w + 0.2, 0.25, 0.04, 0, ph - 0.27, l / 2 + 0.02);
  }
  g.userData.col = [w + 0.16, l + 0.06];
  return g;
}

// ------------------------------------------------------------------ fireplace
export function fireplace({ w = 1.8, h = 1.3, d = 0.45, stone = 'marble', lit = true } = {}) {
  const g = G();
  const sm = mat(stone);
  bx(g, sm, 0.32, h, d, -(w / 2 - 0.16), 0, 0);
  bx(g, sm, 0.32, h, d, w / 2 - 0.16, 0, 0);
  bx(g, sm, w, 0.3, d, 0, h - 0.3, 0);
  bx(g, 'woodBlack', w + 0.24, 0.07, d + 0.14, 0, h, 0.05);
  bx(g, 'soot', w - 0.64, h - 0.3, 0.05, 0, 0, -d / 2 + 0.03);
  bx(g, 'soot', 0.04, h - 0.3, d, -(w / 2 - 0.34), 0, 0);
  bx(g, 'soot', 0.04, h - 0.3, d, w / 2 - 0.34, 0, 0);
  bx(g, 'stoneFloor', w + 0.3, 0.05, 0.6, 0, 0, d / 2 + 0.27);
  bx(g, 'iron', w - 0.8, 0.05, d * 0.6, 0, 0.12, 0);
  for (const [x, rz] of [[-0.18, 0.1], [0.15, -0.15], [0, 0.0]]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.55, 6), M(lit ? 'woodBlack' : 'wood'));
    log.rotation.set(0, 0, Math.PI / 2 + rz);
    log.position.set(x * 0.4, 0.22 + (x === 0 ? 0.08 : 0), 0.0);
    log.rotation.y = x;
    g.add(log);
  }
  if (lit) {
    const ember = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.8, 0.2), C(0xff5010, { basic: true }));
    ember.rotation.x = -Math.PI / 2;
    ember.position.set(0, 0.18, 0);
    ember.userData.noShadow = true;
    g.add(ember);
  }
  g.userData.col = [w + 0.1, d + 0.1];
  g.userData.fire = [0, 0.3, 0.02];
  return g;
}

// ------------------------------------------------------------------ clock
export function grandfatherClock({ wood = 'woodRed' } = {}) {
  const g = G();
  bx(g, wood, 0.52, 0.45, 0.34, 0, 0, 0);
  bx(g, 'woodBlack', 0.56, 0.05, 0.38, 0, 0.42, 0);
  bx(g, wood, 0.4, 0.95, 0.28, 0, 0.47, 0);
  bx(g, C(0x070504), 0.24, 0.78, 0.01, 0, 0.55, 0.141);
  bx(g, 'woodBlack', 0.56, 0.05, 0.38, 0, 1.42, 0);
  bx(g, wood, 0.5, 0.56, 0.34, 0, 1.47, 0);
  bx(g, 'woodBlack', 0.56, 0.08, 0.38, 0, 2.03, 0);
  const crown = new THREE.Mesh(frustum(0.5, 0.3, 0.1, 0.1, 0.22), mat('woodBlack'));
  crown.position.set(0, 2.11, 0);
  g.add(crown);
  const faceM = M('clockFace', { ts: [1, 1] });
  const faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.38), faceM);
  faceMesh.position.set(0, 1.75, 0.172);
  g.add(faceMesh);
  const hand = (len, wdt) => {
    const p = G();
    p.position.set(0, 1.75, 0.18);
    const m = new THREE.Mesh(new THREE.BoxGeometry(wdt, len, 0.006), C(0x100c08));
    m.position.y = len / 2 - 0.015;
    p.add(m);
    g.add(p);
    p.userData.keep = true;
    m.userData.keep = true;
    return p;
  };
  const hourHand = hand(0.1, 0.018);
  const minHand = hand(0.15, 0.012);
  const pend = G();
  pend.position.set(0, 1.35, 0.15);
  g.add(pend);
  const rod = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.6, 0.005), brass());
  rod.position.y = -0.3;
  rod.userData.keep = true;
  pend.add(rod);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 10), brass());
  disc.rotation.x = Math.PI / 2;
  disc.position.y = -0.62;
  disc.userData.keep = true;
  pend.add(disc);
  // secret compartment in the base
  const panel = G();
  panel.position.set(-0.2, 0.06, 0.175);
  g.add(panel);
  const pm = bx(panel, wood, 0.4, 0.32, 0.02, 0.2, 0, 0);
  pm.userData.keep = true;
  g.userData.col = [0.58, 0.4];
  g.userData.hour = 7;
  g.userData.minute = 40;
  g.userData.running = false;
  g.userData.setTime = (hh, mm) => {
    g.userData.hour = hh;
    g.userData.minute = mm;
    minHand.rotation.z = -(mm / 60) * Math.PI * 2;
    hourHand.rotation.z = -((hh % 12) / 12 + mm / 720) * Math.PI * 2;
  };
  g.userData.setTime(7, 40);
  g.userData.panel = panel;
  g.userData.update = (dt, t) => {
    if (g.userData.running) pend.rotation.z = Math.sin(t * 2.6) * 0.18;
  };
  return g;
}

// ------------------------------------------------------------------ music
export function grandPiano() {
  const g = G();
  const shape = new THREE.Shape();
  shape.moveTo(-0.75, 0);
  shape.lineTo(0.75, 0);
  shape.lineTo(0.75, 0.45);
  shape.bezierCurveTo(0.75, 0.85, 0.12, 0.85, 0.02, 1.25);
  shape.bezierCurveTo(-0.08, 1.65, -0.3, 1.85, -0.5, 1.85);
  shape.bezierCurveTo(-0.7, 1.85, -0.75, 1.72, -0.75, 1.55);
  shape.lineTo(-0.75, 0);
  const pm = C(0x0c0a0a, { phong: true, shininess: 70, specular: 0x555555 });
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false, curveSegments: 6 }), pm);
  body.rotation.x = -Math.PI / 2;
  body.position.y = 0.62;
  g.add(body);
  const inner = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.01, bevelEnabled: false, curveSegments: 6 }), M('woodLight'));
  inner.rotation.x = -Math.PI / 2;
  inner.scale.set(0.95, 0.95, 1);
  inner.position.set(0, 0.88, -0.04);
  g.add(inner);
  const lidPivot = G();
  lidPivot.position.set(-0.75, 0.93, 0);
  g.add(lidPivot);
  const lid = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false, curveSegments: 6 }), pm);
  lid.rotation.x = -Math.PI / 2;
  lid.position.x = 0.75;
  lidPivot.add(lid);
  lidPivot.rotation.z = 0.55;
  const prop = bx(g, C(0x0c0a0a), 0.02, 0.62, 0.02, 0.62, 0.92, -0.6);
  prop.rotation.z = 0.28;
  // keyboard
  bx(g, pm, 1.5, 0.12, 0.22, 0, 0.62, 0.11);
  bx(g, C(0xd8d0c0), 1.36, 0.02, 0.16, 0, 0.74, 0.12);
  const nW = 36, kw = 1.36 / nW;
  for (let i = 0; i < nW - 1; i++) {
    if ([0, 1, 3, 4, 5].includes(i % 7)) bx(g, C(0x101010), kw * 0.6, 0.02, 0.09, -0.68 + (i + 1) * kw, 0.76, 0.09);
  }
  for (const sx of [-1, 1]) bx(g, pm, 0.06, 0.16, 0.24, sx * 0.72, 0.62, 0.12);
  // music stand
  const stand = bx(g, pm, 0.6, 0.28, 0.02, 0, 0.93, -0.05);
  stand.rotation.x = -0.25;
  bx(g, M('paperBlank'), 0.36, 0.22, 0.005, 0, 0.98, -0.032, -0.25);
  for (const [x, z] of [[-0.65, 0.12], [0.65, 0.12], [-0.45, -1.6]]) {
    const leg = new THREE.Mesh(frustum(0.1, 0.1, 0.06, 0.06, -0.62), pm);
    leg.position.set(x, 0.62, z);
    g.add(leg);
  }
  g.userData.col = [1.55, 1.9];
  g.userData.colOff = [0, -0.85];
  return g;
}

export function gramophone() {
  const g = G();
  bx(g, 'woodRed', 0.36, 0.16, 0.36, 0, 0, 0);
  bx(g, 'woodBlack', 0.38, 0.02, 0.38, 0, 0.16, 0);
  cy(g, C(0x161010), 0.15, 0.15, 0.015, 0, 0.18, 0, 16);
  const rec = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.006, 20), [M('woodBlack'), M('recordLabel', { ts: [1, 1] }), M('woodBlack')]);
  rec.position.set(0, 0.198, 0);
  rec.visible = false;
  g.add(rec);
  const arm = G();
  arm.position.set(0.14, 0.2, -0.14);
  g.add(arm);
  bx(arm, brass(), 0.02, 0.06, 0.02, 0, 0, 0);
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector2(0.015 + Math.pow(t, 3) * 0.24, t * 0.5));
  }
  const horn = new THREE.Mesh(new THREE.LatheGeometry(pts, 12), M('brass', { phong: true, side: THREE.DoubleSide, shininess: 60, specular: 0x887744 }));
  horn.position.set(0, 0.06, 0);
  horn.rotation.set(-0.9, 0, -0.5);
  arm.add(horn);
  g.userData.col = [0.4, 0.4];
  g.userData.record = rec;
  g.userData.update = (dt) => { if (g.userData.playing) rec.rotation.y -= dt * 8; };
  return g;
}

// ------------------------------------------------------------------ bathroom
function roundRect(w, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
export function bathtub({ water = true } = {}) {
  const g = G();
  const outer = roundRect(1.6, 0.76, 0.34);
  outer.holes.push(roundRect(1.46, 0.62, 0.28));
  const enamel = C(0xd6d0c2, { phong: true, flat: false, shininess: 60, specular: 0x666666 });
  const shell = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.48, bevelEnabled: false, curveSegments: 6 }), enamel);
  shell.rotation.x = -Math.PI / 2;
  shell.position.y = 0.14;
  g.add(shell);
  const bottom = new THREE.Mesh(new THREE.ExtrudeGeometry(roundRect(1.5, 0.66, 0.3), { depth: 0.05, bevelEnabled: false }), enamel);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.14;
  g.add(bottom);
  const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(Object.assign(roundRect(1.66, 0.82, 0.37), { holes: [roundRect(1.46, 0.62, 0.28)] }), { depth: 0.04, bevelEnabled: false, curveSegments: 6 }), enamel);
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.6;
  g.add(rim);
  if (water) {
    const wm = C(0x0a0d08, { phong: true, flat: false, shininess: 120, specular: 0x667766 });
    const wmesh = new THREE.Mesh(new THREE.ShapeGeometry(roundRect(1.46, 0.62, 0.28), 6), wm);
    wmesh.rotation.x = -Math.PI / 2;
    wmesh.position.y = 0.5;
    wmesh.userData.noShadow = true;
    g.add(wmesh);
    g.userData.water = wmesh;
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) sp(g, brass(), 0.07, sx * 0.62, 0.07, sz * 0.24, 6, 4);
  bx(g, brass(), 0.04, 0.2, 0.04, -0.72, 0.6, 0);
  bx(g, brass(), 0.14, 0.03, 0.03, -0.66, 0.78, 0);
  g.userData.col = [1.66, 0.82];
  return g;
}

export function sink() {
  const g = G();
  const enamel = C(0xd6d0c2, { phong: true, flat: false, shininess: 60 });
  cy(g, enamel, 0.09, 0.14, 0.75, 0, 0, 0, 10);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.18, 12, 1, true), enamel);
  basin.position.set(0, 0.84, 0);
  basin.scale.set(1, 1, 0.75);
  basin.material.side = THREE.DoubleSide;
  g.add(basin);
  bx(g, brass(), 0.03, 0.2, 0.03, 0, 0.9, -0.18);
  bx(g, brass(), 0.03, 0.03, 0.12, 0, 1.08, -0.13);
  g.userData.col = [0.6, 0.48];
  return g;
}

export function toilet() {
  const g = G();
  const enamel = C(0xd6d0c2, { phong: true, flat: false, shininess: 60 });
  cy(g, enamel, 0.2, 0.15, 0.4, 0, 0, 0.05, 10);
  bx(g, 'woodBlack', 0.42, 0.04, 0.46, 0, 0.4, 0.05);
  bx(g, 'woodBlack', 0.42, 0.1, 0.24, 0, 1.75, -0.12);
  cy(g, brass(), 0.02, 0.02, 1.35, 0.12, 0.4, -0.18, 6);
  bx(g, 'iron', 0.01, 0.4, 0.01, 0.2, 1.35, -0.05);
  g.userData.col = [0.46, 0.55];
  return g;
}

export function wallMirror({ w = 0.6, h = 0.8 } = {}) {
  const g = G();
  bx(g, 'woodBlack', w + 0.1, h + 0.1, 0.04, 0, -0.05, 0);
  const m = bx(g, M('mirror', { phong: true, shininess: 100, specular: 0x99aabb }), w, h, 0.01, 0, 0, 0.025);
  g.userData.mirror = m;
  return g;
}

export function cabinet({ w = 0.5, h = 0.6, d = 0.18 } = {}) {
  const g = G();
  bx(g, 'woodLight', w, h, d, 0, 0, 0);
  bx(g, M('mirror', { phong: true }), w - 0.1, h - 0.1, 0.01, 0, 0.05, d / 2);
  return g;
}

// ------------------------------------------------------------------ kitchen
export function stove({ chimney = 2.4 } = {}) {
  const g = G();
  bx(g, 'iron', 1.3, 0.78, 0.7, 0, 0.06, 0);
  bx(g, C(0x161412, { phong: true, shininess: 30 }), 1.36, 0.05, 0.74, 0, 0.84, 0);
  for (const x of [-0.3, 0.3]) cy(g, 'iron', 0.13, 0.13, 0.015, x, 0.89, 0.05, 10);
  for (const x of [-0.35, 0.3]) {
    bx(g, 'rust', 0.5, 0.42, 0.02, x, 0.18, 0.35);
    bx(g, brass(), 0.25, 0.025, 0.04, x, 0.55, 0.37);
  }
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.08), C(0xff4a10, { basic: true }));
  glow.position.set(0.3, 0.68, 0.362);
  g.add(glow);
  bx(g, 'iron', 0.12, 0.06, 0.6, 0, 0.0, 0);
  cy(g, 'iron', 0.1, 0.1, chimney, 0.4, 0.89, -0.25, 8);
  bx(g, 'iron', 1.3, 0.35, 0.05, 0, 0.89, -0.33);
  g.userData.col = [1.38, 0.76];
  g.userData.glowPos = [0.3, 0.68, 0.45];
  return g;
}

export function counter({ w = 2, d = 0.6, h = 0.9, top = 'woodLight' } = {}) {
  const g = G();
  bx(g, 'wood', w, h - 0.05, d - 0.04, 0, 0, -0.02);
  bx(g, top, w + 0.04, 0.05, d, 0, h - 0.05, 0);
  const n = Math.max(1, Math.round(w / 0.55));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * (w / n);
    bx(g, 'woodBlack', w / n - 0.06, h - 0.25, 0.02, x, 0.1, d / 2 - 0.03);
    sp(g, brass(), 0.015, x + (w / n) * 0.3, h - 0.3, d / 2, 5, 3);
  }
  g.userData.col = [w, d];
  g.userData.top = h;
  return g;
}

export function shelf({ w = 1.4, h = 1.8, d = 0.32, items = true, seed = 1 } = {}) {
  const g = G();
  bx(g, 'wood', 0.04, h, d, -w / 2, 0, 0);
  bx(g, 'wood', 0.04, h, d, w / 2, 0, 0);
  const levels = [0.05, h * 0.36, h * 0.68, h - 0.04];
  for (const y of levels) bx(g, 'wood', w, 0.03, d, 0, y, 0);
  bx(g, 'woodBlack', w, h, 0.02, 0, 0, -d / 2 + 0.01);
  if (items) {
    let s = seed;
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const cols = [0x5a6a3a, 0x7a5a2a, 0x3a2a1a, 0x8a8070, 0x2a3a4a, 0x6a2a1a];
    for (let li = 0; li < 3; li++) {
      let x = -w / 2 + 0.1;
      while (x < w / 2 - 0.1) {
        const jr = 0.04 + r() * 0.04, jh = 0.1 + r() * 0.16;
        if (r() < 0.8) cy(g, C(cols[Math.floor(r() * cols.length)], { phong: true, shininess: 40 }), jr * 0.8, jr, jh, x + jr, levels[li] + 0.03, (r() - 0.5) * 0.1, 7);
        x += jr * 2 + 0.03 + r() * 0.06;
      }
    }
  }
  g.userData.col = [w + 0.04, d];
  return g;
}

export function potRack({ w = 1.4 } = {}) {
  const g = G();
  bx(g, 'iron', w, 0.03, 0.03, 0, 0, 0);
  for (let i = 0; i < 5; i++) {
    const x = -w / 2 + 0.15 + i * ((w - 0.3) / 4);
    bx(g, 'iron', 0.01, 0.15, 0.01, x, -0.15, 0);
    const r = 0.09 + (i % 3) * 0.03;
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, r * 1.1, 8), M(i % 2 ? 'iron' : 'brass'));
    pot.position.set(x, -0.15 - r * 0.55 - 0.02, 0);
    pot.rotation.x = 0.1 * (i - 2);
    g.add(pot);
  }
  return g;
}

export function choppingTable() {
  const g = table({ w: 1.6, d: 0.85, h: 0.85, wood: 'woodLight', legs: 'square' });
  bx(g, C(0x5a0a0a), 0.45, 0.12, 0.3, -0.25, 0.85, 0.05);
  bx(g, C(0x3a0606), 0.3, 0.008, 0.25, 0.2, 0.851, -0.1);
  const cleaver = G();
  bx(cleaver, C(0x9a9a9a, { phong: true }), 0.12, 0.2, 0.01, 0, 0, 0);
  bx(cleaver, 'woodBlack', 0.03, 0.14, 0.02, 0, 0.2, 0);
  cleaver.position.set(0.35, 0.86, 0.15);
  cleaver.rotation.set(-Math.PI / 2, 0, 0.6);
  g.add(cleaver);
  return g;
}

// ------------------------------------------------------------------ lighting props
export function candle({ h = 0.18, r = 0.02 } = {}) {
  const g = G();
  cy(g, C(0xd8d0b0), r, r, h, 0, 0, 0, 6);
  g.userData.flames = [[0, h + 0.01, 0]];
  return g;
}

export function candelabra({ arms = 3, h = 0.45 } = {}) {
  const g = G();
  const b = brass();
  cy(g, b, 0.04, 0.09, 0.04, 0, 0, 0, 8);
  cy(g, b, 0.015, 0.02, h * 0.75, 0, 0.04, 0, 6);
  const flames = [];
  const pts = arms === 1 ? [[0, 0]] : [];
  if (arms > 1) {
    for (let i = 0; i < arms; i++) {
      const x = (i / (arms - 1) - 0.5) * 0.36;
      pts.push([x, 0]);
    }
    bx(g, b, 0.38, 0.02, 0.02, 0, h * 0.75 + 0.02, 0);
  }
  for (const [x, z] of pts) {
    cy(g, b, 0.03, 0.015, 0.03, x, h * 0.75 + 0.04, z, 6);
    cy(g, C(0xd8d0b0), 0.014, 0.014, 0.12, x, h * 0.75 + 0.07, z, 6);
    flames.push([x, h * 0.75 + 0.2, z]);
  }
  g.userData.flames = flames;
  return g;
}

export function chandelier({ r = 0.6, n = 6, drop = 0.9 } = {}) {
  const g = G();
  const b = brass();
  bx(g, 'iron', 0.02, drop, 0.02, 0, -drop, 0);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 4, 16), b);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -drop;
  g.add(ring);
  cy(g, b, 0.08, 0.02, 0.2, 0, -drop - 0.12, 0, 8);
  const flames = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    cy(g, b, 0.04, 0.02, 0.03, x, -drop, z, 6);
    cy(g, C(0xd8d0b0), 0.014, 0.014, 0.1, x, -drop + 0.03, z, 6);
    flames.push([x, -drop + 0.15, z]);
    const arm = bx(g, 'iron', 0.01, 0.01, r, x / 2, -drop + 0.3 * 0, z / 2, 0, -a + Math.PI / 2);
    void arm;
  }
  g.userData.flames = flames;
  return g;
}

export function sconce() {
  const g = G();
  bx(g, brass(), 0.08, 0.16, 0.03, 0, -0.08, 0.015);
  bx(g, brass(), 0.03, 0.03, 0.14, 0, -0.05, 0.08);
  cy(g, C(0xd8d0b0), 0.014, 0.014, 0.1, 0, -0.03, 0.15, 6);
  g.userData.flames = [[0, 0.09, 0.15]];
  return g;
}

export function oilLamp({ lit = false } = {}) {
  const g = G();
  const b = brass();
  cy(g, b, 0.06, 0.07, 0.03, 0, 0, 0, 8);
  const pts = [new THREE.Vector2(0.02, 0), new THREE.Vector2(0.07, 0.03), new THREE.Vector2(0.075, 0.07), new THREE.Vector2(0.03, 0.1), new THREE.Vector2(0.02, 0.11)];
  const font = new THREE.Mesh(new THREE.LatheGeometry(pts, 10), b);
  font.position.y = 0.03;
  g.add(font);
  const glass = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.025, 0), new THREE.Vector2(0.045, 0.06), new THREE.Vector2(0.025, 0.16)], 10), C(0xc8d8d0, { transparent: true, opacity: 0.35, flat: false }));
  glass.position.y = 0.14;
  g.add(glass);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.006, 3, 10, Math.PI), b);
  handle.position.y = 0.3;
  g.add(handle);
  g.userData.flames = [[0, 0.2, 0]];
  return g;
}

// ------------------------------------------------------------------ decor
export function painting({ w = 0.6, h = 0.75, art = 'portraitMan', frame = 'gold' } = {}) {
  const g = G();
  const fm = frame === 'gold' ? M('brass', { phong: true, shininess: 30, specular: 0x554422 }) : mat('woodBlack');
  const t = 0.07;
  bx(g, fm, w + t * 2, t, 0.05, 0, -h / 2 - t, 0.025);
  bx(g, fm, w + t * 2, t, 0.05, 0, h / 2, 0.025);
  bx(g, fm, t, h, 0.05, -w / 2 - t / 2, -h / 2, 0.025);
  bx(g, fm, t, h, 0.05, w / 2 + t / 2, -h / 2, 0.025);
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M(art, { ts: [1, 1] }));
  canvas.position.set(0, 0, 0.02);
  g.add(canvas);
  g.userData.canvas = canvas;
  return g;
}

export function rug(room, name, x, z, w, d, ry = 0) {
  return room.decal(M(name, { ts: [w, d] }), x, z, w, d, ry, 0.006);
}

export function column({ h = 3, r = 0.2, m = 'marble' } = {}) {
  const g = G();
  bx(g, m, r * 2.6, 0.2, r * 2.6, 0, 0, 0);
  cy(g, m, r, r * 1.1, h - 0.4, 0, 0.2, 0, 10);
  bx(g, m, r * 2.6, 0.2, r * 2.6, 0, h - 0.2, 0);
  g.userData.col = [r * 2.6, r * 2.6];
  return g;
}

export function globe() {
  const g = G();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = bx(g, 'woodRed', 0.04, 0.6, 0.04, Math.sin(a) * 0.15, 0, Math.cos(a) * 0.15);
    leg.rotation.set(Math.cos(a) * 0.2, 0, -Math.sin(a) * 0.2);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.012, 3, 16), brass());
  ring.position.y = 0.85;
  ring.rotation.y = 0.4;
  g.add(ring);
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), C(0x6a5a3a));
  ball.position.y = 0.85;
  g.add(ball);
  g.userData.col = [0.45, 0.45];
  return g;
}

export function deadPlant() {
  const g = G();
  const pts = [new THREE.Vector2(0.12, 0), new THREE.Vector2(0.17, 0.3), new THREE.Vector2(0.15, 0.35)];
  const pot = new THREE.Mesh(new THREE.LatheGeometry(pts, 8), C(0x7a4a2a));
  g.add(pot);
  cy(g, 'dirt', 0.14, 0.14, 0.01, 0, 0.3, 0, 8);
  const stick = (x, y, z, len, rx, rz) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, len, 3), C(0x2a1a10));
    m.position.set(x, y + len / 2, z);
    m.rotation.set(rx, 0, rz);
    m.geometry.translate(0, 0, 0);
    g.add(m);
  };
  stick(0, 0.3, 0, 0.7, 0.1, 0.15);
  stick(0.02, 0.3, 0, 0.5, -0.4, -0.3);
  stick(-0.03, 0.3, 0.02, 0.45, 0.5, 0.3);
  g.userData.col = [0.36, 0.36];
  return g;
}

export function vase({ h = 0.4, color = 0x3a4a6a } = {}) {
  const g = G();
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(new THREE.Vector2(0.05 + Math.sin(t * Math.PI) * 0.09 * (1 - t * 0.3) + (t > 0.85 ? 0.03 : 0), t * h));
  }
  const v = new THREE.Mesh(new THREE.LatheGeometry(pts, 10), C(color, { phong: true, shininess: 60, flat: false }));
  g.add(v);
  return g;
}

export function pedestal({ h = 1.0 } = {}) {
  const g = G();
  bx(g, 'marble', 0.36, 0.08, 0.36, 0, 0, 0);
  cy(g, 'marble', 0.1, 0.12, h - 0.16, 0, 0.08, 0, 8);
  bx(g, 'marble', 0.34, 0.08, 0.34, 0, h - 0.08, 0);
  g.userData.col = [0.38, 0.38];
  g.userData.top = h;
  return g;
}

export function coatRack() {
  const g = G();
  cy(g, 'woodBlack', 0.025, 0.03, 1.8, 0, 0, 0, 6);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    bx(g, 'woodBlack', 0.03, 0.03, 0.3, Math.sin(a) * 0.12, 0.02, Math.cos(a) * 0.12, 0, a);
    bx(g, 'woodBlack', 0.02, 0.12, 0.02, Math.sin(a) * 0.08, 1.65, Math.cos(a) * 0.08, Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6);
  }
  bx(g, C(0x2a2622), 0.4, 0.9, 0.12, 0.05, 0.8, 0.1);
  g.userData.col = [0.4, 0.4];
  return g;
}

export function mannequin() {
  const g = G();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = bx(g, 'woodBlack', 0.03, 0.03, 0.4, Math.sin(a) * 0.15, 0.0, Math.cos(a) * 0.15, 0, a);
    void leg;
  }
  cy(g, 'woodBlack', 0.015, 0.015, 0.9, 0, 0, 0, 5);
  const torso = new THREE.Mesh(frustum(0.3, 0.2, 0.38, 0.24, 0.55), M('linen'));
  torso.position.y = 0.9;
  g.add(torso);
  const skirt = new THREE.Mesh(frustum(0.3, 0.22, 0.6, 0.5, -0.5), M('velvet'));
  skirt.position.y = 1.0;
  g.add(skirt);
  cy(g, 'woodBlack', 0.03, 0.04, 0.1, 0, 1.45, 0, 5);
  g.userData.col = [0.5, 0.5];
  return g;
}

// White sheet over furniture — lumpy and ghostly.
export function draped({ w = 1, h = 1, d = 0.6, seed = 1 } = {}) {
  const g = G();
  const geo = new THREE.BoxGeometry(w, h, d, 3, 2, 3);
  const p = geo.attributes.position;
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const jit = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let j = jit.get(key);
    if (!j) { j = [(r() - 0.5) * 0.08, (r() - 0.3) * 0.08, (r() - 0.5) * 0.08]; jit.set(key, j); }
    const bottom = p.getY(i) < -h / 2 + 0.01;
    p.setXYZ(i, p.getX(i) * (bottom ? 1.12 : 1) + j[0], p.getY(i) + (bottom ? 0 : j[1]), p.getZ(i) * (bottom ? 1.12 : 1) + j[2]);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, M('linen', { flat: false }));
  m.position.y = h / 2;
  g.add(m);
  g.userData.col = [w * 1.1, d * 1.1];
  return g;
}

export function noose({ len = 1.2 } = {}) {
  const g = G();
  const rope = C(0x8a7a5a);
  const r = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 4), rope);
  r.position.y = -len / 2;
  g.add(r);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.014, 3, 10), rope);
  loop.position.y = -len - 0.12;
  g.add(loop);
  bx(g, rope, 0.04, 0.08, 0.04, 0, -len - 0.04, 0);
  return g;
}

export function cobweb(room, x, y, z, ry, s = 0.8) {
  const m = M('cobweb', { transparent: true, side: THREE.DoubleSide, alphaTest: 0.05, ts: [1, 1] });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s, s), m);
  mesh.geometry.translate(s / 2, -s / 2, 0);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.userData.noShadow = true;
  mesh.castShadow = false;
  room.static.add(mesh);
  return mesh;
}

export function armor() {
  const g = G();
  const iron = M('iron', { phong: true, shininess: 50, specular: 0x777777 });
  bx(g, 'stoneFloor', 0.6, 0.12, 0.5, 0, 0, 0);
  for (const sx of [-1, 1]) {
    bx(g, iron, 0.13, 0.42, 0.15, sx * 0.1, 0.12, 0);
    bx(g, iron, 0.14, 0.42, 0.16, sx * 0.1, 0.56, 0);
    bx(g, iron, 0.12, 0.3, 0.13, sx * 0.3, 1.12, 0, 0, 0, sx * 0.1);
    bx(g, iron, 0.11, 0.3, 0.12, sx * 0.33, 0.82, 0.03, -0.3, 0, 0);
  }
  const torso = new THREE.Mesh(frustum(0.3, 0.22, 0.46, 0.28, 0.55), iron);
  torso.position.y = 0.98;
  g.add(torso);
  bx(g, iron, 0.5, 0.12, 0.3, 0, 1.45, 0);
  const helm = new THREE.Mesh(frustum(0.24, 0.26, 0.2, 0.22, 0.3), iron);
  helm.position.y = 1.55;
  g.add(helm);
  bx(g, C(0x050505), 0.16, 0.025, 0.01, 0, 1.73, 0.13);
  // halberd
  bx(g, 'woodBlack', 0.03, 2.2, 0.03, 0.38, 0.12, 0.12);
  const blade = new THREE.Mesh(frustum(0.02, 0.2, 0.02, 0.02, 0.25), iron);
  blade.position.set(0.38, 2.1, 0.12);
  g.add(blade);
  g.userData.col = [0.6, 0.5];
  return g;
}

// ------------------------------------------------------------------ cave
export function rockLump(r = 1, seed = 1, squash = [1, 0.7, 1], m = 'rock') {
  const mesh = new THREE.Mesh(rockGeo(r, seed, 1, squash), M(m, { flat: true }));
  return mesh;
}

export function stalactite(len = 1, r = 0.15, seed = 1, m = 'rock') {
  const geo = new THREE.ConeGeometry(r, len, 5, 1);
  geo.rotateX(Math.PI);
  geo.translate(0, -len / 2, 0);
  const mesh = new THREE.Mesh(geo, M(m, { flat: true }));
  mesh.rotation.y = seed;
  return mesh;
}

export function altar() {
  const g = G();
  bx(g, 'runes', 1.6, 0.25, 1.0, 0, 0, 0);
  bx(g, 'runes', 1.3, 0.6, 0.7, 0, 0.25, 0);
  bx(g, 'runes', 1.5, 0.12, 0.85, 0, 0.85, 0);
  g.userData.col = [1.6, 1.0];
  g.userData.top = 0.97;
  return g;
}

export function idol() {
  const g = G();
  const stone = C(0x1a2a22, { phong: true, shininess: 80, specular: 0x446655 });
  const base = new THREE.Mesh(frustum(0.3, 0.3, 0.22, 0.22, 0.1), stone);
  g.add(base);
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), stone);
  body.scale.set(1, 1.6, 0.8);
  body.position.y = 0.32;
  g.add(body);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), stone);
  head.position.y = 0.6;
  head.scale.set(1, 1.2, 1);
  g.add(head);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.28, 4), stone);
    t.position.set(Math.cos(a) * 0.08, 0.45, Math.sin(a) * 0.08 + 0.03);
    t.rotation.set(Math.PI + Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4);
    g.add(t);
  }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), C(0x80ffb0, { basic: true }));
  eye.position.set(0, 0.63, 0.11);
  g.add(eye);
  g.userData.eye = eye;
  return g;
}

export function bones() {
  const g = G();
  const bone = C(0xc8c0a0);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), bone);
  skull.position.set(0, 0.08, 0);
  skull.scale.set(1, 0.9, 1.2);
  g.add(skull);
  bx(g, C(0x0a0806), 0.03, 0.03, 0.01, -0.035, 0.08, 0.11);
  bx(g, C(0x0a0806), 0.03, 0.03, 0.01, 0.035, 0.08, 0.11);
  for (let i = 0; i < 4; i++) {
    const b = bx(g, bone, 0.03, 0.03, 0.35, 0.15 + i * 0.05, 0, -0.1 + i * 0.07, 0, i * 0.9, 0);
    void b;
  }
  return g;
}
