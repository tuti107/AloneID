// Procedurally painted textures (Canvas 2D). Everything in the game is
// generated at start-up, so the build ships without any image files.
import * as THREE from 'three';
import { rng } from './util.js';

const cache = new Map();
export const TEX_SIZE = {}; // world metres covered by one repeat [u, v]

export function tex(name) {
  let t = cache.get(name);
  if (!t) {
    const fn = BUILDERS[name];
    if (!fn) throw new Error('unknown texture ' + name);
    const c = fn();
    t = finish(c.canvas || c, c.opts || {});
    t.name = name;
    cache.set(name, t);
  }
  return t;
}
export function texCanvas(name) {
  const fn = BUILDERS[name];
  const c = fn();
  return c.canvas || c;
}

function finish(canvas, opts) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  const rep = opts.repeat !== false;
  t.wrapS = t.wrapT = rep ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = opts.smooth ? THREE.LinearMipmapLinearFilter : THREE.NearestMipmapLinearFilter;
  t.generateMipmaps = true;
  return t;
}

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  return [c, g];
}

// Tileable value noise.
function makeNoise(rand, period) {
  const grid = new Float32Array(period * period);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const at = (x, y) => grid[((y % period + period) % period) * period + ((x % period + period) % period)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    let xf = x - xi, yf = y - yi;
    xf = xf * xf * (3 - 2 * xf);
    yf = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}
function fbm(n, x, y, oct = 4) {
  let s = 0, amp = 0.5, f = 1, tot = 0;
  for (let i = 0; i < oct; i++) {
    s += n(x * f, y * f) * amp;
    tot += amp;
    amp *= 0.5;
    f *= 2;
  }
  return s / tot;
}

// Per-pixel painter: fn(x, y) -> [r, g, b] or [r, g, b, a] (0..255)
function paint(w, h, fn) {
  const [c, g] = mk(w, h);
  const img = g.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = fn(x, y);
      const i = (y * w + x) * 4;
      d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = p.length > 3 ? p[3] : 255;
    }
  }
  g.putImageData(img, 0, 0);
  return [c, g];
}

function grain(g, w, h, amount, rand) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

// Darken with tileable blotches (age, damp, soot).
function grime(g, w, h, rand, strength = 0.35, scale = 4, color = [20, 14, 8]) {
  const n = makeNoise(rand, scale * 2);
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = fbm(n, (x / w) * scale * 2, (y / h) * scale * 2, 4);
      const k = Math.max(0, v - 0.45) * 2.2 * strength;
      const i = (y * w + x) * 4;
      d[i] = d[i] * (1 - k) + color[0] * k;
      d[i + 1] = d[i + 1] * (1 - k) + color[1] * k;
      d[i + 2] = d[i + 2] * (1 - k) + color[2] * k;
    }
  }
  g.putImageData(img, 0, 0);
}

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// ---------------------------------------------------------------- wood
// Splits [0, size) into segments; returns {segs:[{s, len}], off}. Cyclic so the
// texture tiles seamlessly.
function cyclicSegments(rand, size, minLen, maxLen) {
  const segs = [];
  let x = 0;
  while (x < size) {
    let len = Math.round(minLen + rand() * (maxLen - minLen));
    if (size - (x + len) < minLen * 0.6) len = size - x;
    segs.push({ s: x, len, tint: 0.75 + rand() * 0.5, hue: rand() * 10 });
    x += len;
  }
  return { segs, off: Math.floor(rand() * size) };
}
function segAt(row, x, size) {
  const xx = (x + row.off) % size;
  let seg = row.segs[0];
  for (const s of row.segs) if (xx >= s.s) seg = s;
  return [seg, xx - seg.s];
}

function woodPlanks({ seed, base, dark, plank = 16, size = 128, gap = [10, 7, 4], vertical = false, worn = 0.3, nails = true, joints = true }) {
  const rand = rng(seed);
  const P = 4;
  const n = makeNoise(rand, P);
  const rows = Math.ceil(size / plank);
  const rowInfo = [];
  for (let r = 0; r < rows; r++) rowInfo.push(cyclicSegments(rand, size, 44, 100));
  const B = hex(base), D = hex(dark);
  const [c, g] = paint(size, size, (px, py) => {
    const x = vertical ? py : px;
    const y = vertical ? px : py;
    const r = Math.floor(y / plank);
    const [seg, lx] = segAt(rowInfo[r], x, size);
    const ly = y - r * plank;
    // grain: noise stretched along the plank
    const gr = fbm(n, (x / size) * P + seg.hue, (y / size) * P * 8 + r * 0.37, 3);
    const ring = Math.sin((gr * 9 + ly * 0.15) * 3.14) * 0.5 + 0.5;
    let col = mix(D, B, (0.35 + gr * 0.6) * seg.tint);
    col = mix(col, D, ring * 0.25);
    if (joints && (ly === 0 || ly === plank - 1)) col = mix(col, gap, 0.65);
    if (joints && (lx === 0 || lx === seg.len - 1)) col = mix(col, gap, 0.75);
    if (nails && (lx === 3 || lx === seg.len - 4) && (ly === 3 || ly === plank - 4)) col = mix(col, [20, 18, 16], 0.8);
    const wear = fbm(n, (x / size) * P + 2.5, (y / size) * P + 1.5, 2);
    col = mix(col, mix(B, [150, 140, 120], 0.3), Math.max(0, wear - 0.55) * worn);
    return col;
  });
  grain(g, size, size, 14, rand);
  return c;
}

// ---------------------------------------------------------------- wallpaper
function damaskMotif(g, cx, cy, s, color) {
  g.fillStyle = color;
  g.beginPath();
  // a symmetric fleur-ish motif
  for (const m of [1, -1]) {
    g.moveTo(cx, cy - s);
    g.bezierCurveTo(cx + m * s * 0.55, cy - s * 0.6, cx + m * s * 0.15, cy - s * 0.15, cx + m * s * 0.6, cy);
    g.bezierCurveTo(cx + m * s * 0.15, cy + s * 0.15, cx + m * s * 0.45, cy + s * 0.6, cx, cy + s);
  }
  g.fill();
  g.beginPath();
  g.ellipse(cx, cy, s * 0.14, s * 0.3, 0, 0, Math.PI * 2);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fill();
  g.fillStyle = color;
  for (const m of [1, -1]) {
    g.beginPath();
    g.arc(cx + m * s * 0.62, cy - s * 0.55, s * 0.12, 0, Math.PI * 2);
    g.arc(cx + m * s * 0.62, cy + s * 0.55, s * 0.12, 0, Math.PI * 2);
    g.fill();
  }
}
function wallpaper({ seed, base, motif, stripe = null, size = 128, age = 0.45 }) {
  const rand = rng(seed);
  const [c, g] = mk(size, size);
  g.fillStyle = css(hex(base));
  g.fillRect(0, 0, size, size);
  if (stripe) {
    g.fillStyle = css(hex(stripe), 0.55);
    for (let x = 0; x < size; x += 32) {
      g.fillRect(x + 2, 0, 3, size);
      g.fillRect(x + 27, 0, 3, size);
    }
  }
  const mc = css(hex(motif), 0.7);
  const s = size / 4;
  for (let yy = 0; yy <= 2; yy++) {
    for (let xx = 0; xx <= 2; xx++) {
      damaskMotif(g, xx * size / 2, yy * size / 2, s * 0.85, mc);
      damaskMotif(g, xx * size / 2 + size / 4, yy * size / 2 + size / 4, s * 0.55, css(hex(motif), 0.4));
    }
  }
  grain(g, size, size, 12, rand);
  grime(g, size, size, rand, age, 3, [25, 18, 10]);
  return c;
}

// ---------------------------------------------------------------- panels
function wainscot({ seed, base, dark, size = 128 }) {
  const c0 = woodPlanks({ seed, base, dark, plank: 128, nails: false, vertical: true, worn: 0.1 });
  const [c, g] = mk(size, size);
  g.drawImage(c0, 0, 0, size, size);
  const B = hex(base), D = hex(dark);
  // one raised panel per tile
  const m = 14;
  g.fillStyle = css(D, 0.55);
  g.fillRect(m - 3, m - 3, size - 2 * m + 6, size - 2 * m + 6);
  g.drawImage(c0, m, m, size - 2 * m, size - 2 * m, m, m, size - 2 * m, size - 2 * m);
  g.fillStyle = css(mix(B, [255, 230, 190], 0.25), 0.35);
  g.fillRect(m - 3, m - 3, size - 2 * m + 6, 3);
  g.fillRect(m - 3, m - 3, 3, size - 2 * m + 6);
  g.fillStyle = css([0, 0, 0], 0.45);
  g.fillRect(m - 3, size - m, size - 2 * m + 6, 3);
  g.fillRect(size - m, m - 3, 3, size - 2 * m + 6);
  g.fillStyle = css([0, 0, 0], 0.5);
  g.fillRect(0, 0, size, 2);
  g.fillRect(0, 0, 2, size);
  return c;
}

// ---------------------------------------------------------------- stone
function stones({ seed, base, dark, mortar, rows = 6, size = 128, jitter = 0.35, rough = 0.6 }) {
  const rand = rng(seed);
  const P = 8;
  const n = makeNoise(rand, P);
  const B = hex(base), D = hex(dark), M = hex(mortar);
  const rh = size / rows;
  const rowInfo = [];
  for (let r = 0; r < rows; r++) rowInfo.push(cyclicSegments(rand, size, rh * 1.2, rh * 2.6));
  const [c, g] = paint(size, size, (x, y) => {
    const r = Math.floor(y / rh);
    const ly = y - r * rh;
    const [seg, lx] = segAt(rowInfo[r], x, size);
    const e = fbm(n, (x / size) * P * 2, (y / size) * P * 2, 3);
    const edge = Math.min(lx, seg.len - lx, ly, rh - ly) + (e - 0.5) * 12 * jitter;
    const v = fbm(n, (x / size) * P * 2 + 3, (y / size) * P * 2 + 7, 4);
    let col = mix(D, B, (0.3 + v * 0.7) * seg.tint);
    if (edge < 1.6) col = mix(M, col, Math.max(0, edge / 1.6) * 0.5);
    else if (edge < 3) col = mix(col, D, 0.25 * rough);
    return col;
  });
  grain(g, size, size, 18, rand);
  return c;
}

function rock({ seed, base, dark, size = 128 }) {
  const rand = rng(seed);
  const n = makeNoise(rand, 8);
  const n2 = makeNoise(rand, 32);
  const B = hex(base), D = hex(dark);
  const [c, g] = paint(size, size, (x, y) => {
    const v = fbm(n, x / size * 8, y / size * 8, 5);
    const s = fbm(n2, x / size * 32, y / size * 32, 2);
    const ridge = 1 - Math.abs(v * 2 - 1);
    let col = mix(D, B, Math.pow(ridge, 1.5) * 0.9 + s * 0.2);
    return col;
  });
  grain(g, size, size, 16, rand);
  return c;
}

// ---------------------------------------------------------------- tiles
function checker({ seed, a, b, tiles = 2, size = 128, grout = [40, 38, 34], veins = true }) {
  const rand = rng(seed);
  const n = makeNoise(rand, 8);
  const A = hex(a), Bc = hex(b);
  const ts = size / tiles;
  const [c, g] = paint(size, size, (x, y) => {
    const i = Math.floor(x / ts), j = Math.floor(y / ts);
    let col = (i + j) % 2 ? A : Bc;
    if (veins) {
      const v = fbm(n, x / size * 8 + i * 3, y / size * 8 + j * 5, 4);
      const vein = Math.abs(Math.sin(v * 18 + (x / size) * Math.PI * 4));
      col = mix(col, mix(col, [128, 128, 128], 0.5), Math.pow(1 - vein, 8) * 0.8);
      col = mix(col, [0, 0, 0], (v - 0.5) * 0.15);
    }
    const lx = x % ts, ly = y % ts;
    if (lx === 0 || ly === 0) col = mix(col, grout, 0.8);
    return col;
  });
  grain(g, size, size, 8, rand);
  grime(g, size, size, rand, 0.25, 2);
  return c;
}

function smallTiles({ seed, base, grout, tiles = 8, size = 128, crack = 0.15 }) {
  const rand = rng(seed);
  const B = hex(base), G = hex(grout);
  const ts = size / tiles;
  const tint = [];
  for (let i = 0; i < tiles * tiles; i++) tint.push(0.88 + rand() * 0.14);
  const [c, g] = paint(size, size, (x, y) => {
    const i = Math.floor(x / ts), j = Math.floor(y / ts);
    const lx = x - i * ts, ly = y - j * ts;
    if (lx < 1 || ly < 1) return G;
    let col = B.map((v) => v * tint[j * tiles + i]);
    if (lx < 2 || ly < 2) col = mix(col, [255, 255, 255], 0.2);
    return col;
  });
  // cracks
  g.strokeStyle = 'rgba(40,36,30,0.6)';
  g.lineWidth = 1;
  for (let k = 0; k < 4 * crack * 10; k++) {
    let x = rand() * size, y = rand() * size;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 6; s++) { x += (rand() - 0.5) * 14; y += rand() * 10; g.lineTo(x, y); }
    g.stroke();
  }
  grime(g, size, size, rand, 0.3, 2, [60, 50, 30]);
  return c;
}

// ---------------------------------------------------------------- textiles
function carpetRunner({ seed }) {
  const rand = rng(seed);
  const w = 64, h = 128;
  const R = [110, 18, 20], D = [60, 8, 12], G = [170, 130, 60], N = [25, 20, 40];
  const [c, g] = paint(w, h, (x, y) => {
    const ex = Math.min(x, w - 1 - x);
    if (ex < 3) return D;
    if (ex < 5) return G;
    if (ex < 9) return ((y >> 2) % 2 ? N : D);
    if (ex < 10) return G;
    // diamonds in the field
    const cx = w / 2, cy = (Math.floor(y / 32) + 0.5) * 32;
    const dd = Math.abs(x - cx) + Math.abs(y - cy) * 0.8;
    if (dd < 5) return G;
    if (dd < 9) return N;
    if (dd > 12 && dd < 14) return mix(G, R, 0.4);
    return R;
  });
  grain(g, w, h, 22, rand);
  grime(g, w, h, rand, 0.4, 2, [30, 15, 10]);
  return c;
}

function rug({ seed, field = [120, 25, 25], border = [30, 30, 70], accent = [190, 150, 80] }) {
  const rand = rng(seed);
  const w = 128, h = 96;
  const [c, g] = paint(w, h, (x, y) => {
    const ex = Math.min(x, w - 1 - x), ey = Math.min(y, h - 1 - y);
    const e = Math.min(ex, ey);
    if (e < 2) return mix(accent, [230, 220, 200], 0.4); // fringe
    if (e < 9) return ((x + y) >> 2) % 3 === 0 ? accent : border;
    if (e < 11) return accent;
    const cx = x - w / 2, cy = (y - h / 2) * 1.3;
    const r = Math.hypot(cx, cy);
    if (r < 10) return accent;
    if (r < 16) return border;
    if (r < 20 + Math.sin(Math.atan2(cy, cx) * 8) * 3) return mix(field, accent, 0.4);
    const p = (Math.abs(((x - 11) % 14) - 7) + Math.abs(((y - 11) % 14) - 7));
    if (p < 2) return accent;
    return field;
  });
  grain(g, w, h, 26, rand);
  grime(g, w, h, rand, 0.35, 2);
  c.opts = { repeat: false };
  return c;
}

function curtain({ seed, color }) {
  const rand = rng(seed);
  const C = hex(color);
  const [c, g] = paint(64, 128, (x, y) => {
    const f = Math.sin((x / 64) * Math.PI * 2 * 4 + Math.sin(y * 0.05) * 0.3);
    return mix([0, 0, 0], C, 0.45 + f * 0.4);
  });
  grain(g, 64, 128, 12, rand);
  return c;
}

function quilt({ seed, a, b }) {
  const rand = rng(seed);
  const A = hex(a), B = hex(b);
  const [c, g] = paint(64, 64, (x, y) => {
    const lx = x % 16, ly = y % 16;
    let col = ((x >> 4) + (y >> 4)) % 2 ? A : B;
    if (lx === 0 || ly === 0) col = mix(col, [0, 0, 0], 0.4);
    if (Math.abs(lx - ly) < 1 || Math.abs(lx + ly - 15) < 1) col = mix(col, [255, 240, 220], 0.15);
    return col;
  });
  grain(g, 64, 64, 14, rand);
  return c;
}

function linen({ seed }) {
  const rand = rng(seed);
  const [c, g] = paint(64, 64, (x, y) => {
    const v = 205 + ((x + y) % 2) * 6;
    return [v, v - 6, v - 18];
  });
  grain(g, 64, 64, 10, rand);
  grime(g, 64, 64, rand, 0.45, 2, [120, 90, 50]);
  // wine stains
  g.fillStyle = 'rgba(110,30,40,0.18)';
  g.beginPath();
  g.arc(rand() * 64, rand() * 64, 3 + rand() * 3, 0, Math.PI * 2);
  g.fill();
  return c;
}

// ---------------------------------------------------------------- objects
function books({ seed }) {
  const rand = rng(seed);
  const size = 128;
  const [c, g] = mk(size, size);
  const shelfH = 32;
  const cols = [[90, 20, 18], [30, 50, 30], [70, 45, 25], [25, 30, 60], [20, 18, 16], [110, 80, 40], [60, 20, 50], [120, 100, 70]];
  g.fillStyle = '#120c08';
  g.fillRect(0, 0, size, size);
  for (let s = 0; s < 4; s++) {
    const y0 = s * shelfH;
    let x = 0;
    while (x < size) {
      const bw = 3 + Math.floor(rand() * 6);
      const bh = Math.floor(shelfH * (0.55 + rand() * 0.35));
      if (rand() < 0.08) { x += bw; continue; } // gap
      const col = cols[Math.floor(rand() * cols.length)].map((v) => v * (0.7 + rand() * 0.5));
      const lean = rand() < 0.06;
      g.fillStyle = css(col);
      g.fillRect(x, y0 + shelfH - 4 - bh, bw, bh);
      g.fillStyle = css(mix(col, [255, 255, 255], 0.25));
      g.fillRect(x, y0 + shelfH - 4 - bh, 1, bh);
      g.fillStyle = css([0, 0, 0], 0.5);
      g.fillRect(x + bw - 1, y0 + shelfH - 4 - bh, 1, bh);
      if (bw > 4) {
        g.fillStyle = 'rgba(200,160,80,0.75)';
        g.fillRect(x + 1, y0 + shelfH - 4 - bh + 3, bw - 2, 1);
        g.fillRect(x + 1, y0 + shelfH - 4 - 5, bw - 2, 1);
        if (rand() < 0.5) g.fillRect(x + 1, y0 + shelfH - 4 - bh + 8, bw - 2, 2);
      }
      x += bw + (lean ? 2 : 0);
    }
    // shelf board
    g.fillStyle = '#3a2615';
    g.fillRect(0, y0 + shelfH - 4, size, 4);
    g.fillStyle = '#5a3d22';
    g.fillRect(0, y0 + shelfH - 4, size, 1);
  }
  grain(g, size, size, 14, rand);
  grime(g, size, size, rand, 0.3, 2);
  return c;
}

function portrait({ seed, bg = [40, 30, 20], cloth = [20, 18, 22], skin = [190, 160, 130], kind = 'man' }) {
  const rand = rng(seed);
  const w = 64, h = 80;
  const [c, g] = mk(w, h);
  const grd = g.createRadialGradient(w * 0.5, h * 0.35, 4, w * 0.5, h * 0.4, w * 0.8);
  grd.addColorStop(0, css(mix(bg, [255, 220, 160], 0.25)));
  grd.addColorStop(1, css(mix(bg, [0, 0, 0], 0.6)));
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  // shoulders
  g.fillStyle = css(cloth);
  g.beginPath();
  g.moveTo(4, h);
  g.quadraticCurveTo(8, h * 0.62, w * 0.5, h * 0.6);
  g.quadraticCurveTo(w - 8, h * 0.62, w - 4, h);
  g.fill();
  if (kind === 'woman') {
    g.fillStyle = css(mix(cloth, [255, 255, 255], 0.1));
    g.beginPath();
    g.ellipse(w * 0.5, h * 0.36, 15, 18, 0, 0, Math.PI * 2);
    g.fill();
  }
  // collar
  g.fillStyle = 'rgba(220,210,190,0.9)';
  g.beginPath();
  g.moveTo(w * 0.42, h * 0.6);
  g.lineTo(w * 0.5, h * 0.72);
  g.lineTo(w * 0.58, h * 0.6);
  g.fill();
  // face
  g.fillStyle = css(skin);
  g.beginPath();
  g.ellipse(w * 0.5, h * 0.4, 10, 13, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = css(mix(skin, [0, 0, 0], 0.45));
  g.fillRect(w * 0.5 - 6, h * 0.38, 4, 2);
  g.fillRect(w * 0.5 + 2, h * 0.38, 4, 2);
  g.fillRect(w * 0.5 - 1, h * 0.42, 2, 4);
  g.fillRect(w * 0.5 - 4, h * 0.49, 8, 1);
  if (kind === 'man') {
    g.fillStyle = css([70, 60, 50]);
    g.fillRect(w * 0.5 - 5, h * 0.465, 10, 2);
    g.fillStyle = css(mix(bg, [0, 0, 0], 0.4));
    g.fillRect(w * 0.5 - 10, h * 0.24, 20, 4);
  } else {
    g.fillStyle = css([50, 30, 20]);
    g.beginPath();
    g.ellipse(w * 0.5, h * 0.27, 12, 7, 0, Math.PI, Math.PI * 2);
    g.fill();
  }
  // shading
  const sh = g.createLinearGradient(0, 0, w, 0);
  sh.addColorStop(0, 'rgba(0,0,0,0.0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = sh;
  g.fillRect(0, 0, w, h);
  grain(g, w, h, 20, rand);
  grime(g, w, h, rand, 0.3, 2, [30, 20, 5]);
  // craquelure
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < 18; i++) {
    g.beginPath();
    let x = rand() * w, y = rand() * h;
    g.moveTo(x, y);
    g.lineTo(x + (rand() - 0.5) * 10, y + (rand() - 0.5) * 10);
    g.stroke();
  }
  c.opts = { repeat: false };
  return c;
}

function seascape({ seed }) {
  const rand = rng(seed);
  const w = 96, h = 64;
  const [c, g] = mk(w, h);
  const sky = g.createLinearGradient(0, 0, 0, h * 0.55);
  sky.addColorStop(0, '#141a20');
  sky.addColorStop(1, '#4a4c44');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#1a2a2a';
  g.fillRect(0, h * 0.55, w, h * 0.45);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(200,210,200,${0.1 + rand() * 0.25})`;
    g.fillRect(rand() * w, h * 0.55 + rand() * h * 0.45, 3 + rand() * 6, 1);
  }
  // ship
  g.fillStyle = '#0b0b0b';
  g.beginPath();
  g.moveTo(w * 0.55, h * 0.58);
  g.lineTo(w * 0.78, h * 0.58);
  g.lineTo(w * 0.74, h * 0.64);
  g.lineTo(w * 0.58, h * 0.64);
  g.fill();
  g.fillRect(w * 0.62, h * 0.3, 1, h * 0.28);
  g.fillRect(w * 0.7, h * 0.34, 1, h * 0.24);
  g.fillStyle = 'rgba(180,170,150,0.6)';
  g.fillRect(w * 0.6, h * 0.34, 6, 8);
  g.fillRect(w * 0.68, h * 0.38, 5, 7);
  // a black shape in the water
  g.fillStyle = 'rgba(0,0,0,0.85)';
  g.beginPath();
  g.ellipse(w * 0.3, h * 0.66, 10, 3, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.9)';
  g.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.moveTo(w * 0.24 + i * 4, h * 0.66);
    g.quadraticCurveTo(w * 0.2 + i * 6, h * 0.45, w * 0.26 + i * 5, h * (0.38 + rand() * 0.1));
    g.stroke();
  }
  grain(g, w, h, 20, rand);
  c.opts = { repeat: false };
  return c;
}

function clockFace() {
  const s = 64;
  const [c, g] = mk(s, s);
  g.fillStyle = '#2a1c10';
  g.fillRect(0, 0, s, s);
  g.fillStyle = '#d8ccb0';
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#3a2a1a';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2 - 5, 0, Math.PI * 2);
  g.stroke();
  const nums = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  g.fillStyle = '#1a1208';
  g.font = 'bold 7px serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const r = s / 2 - 11;
    g.fillText(nums[i], s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r);
  }
  // III is worn smooth (a clue)
  g.fillStyle = 'rgba(160,120,60,0.55)';
  g.beginPath();
  g.arc(s / 2 + (s / 2 - 11), s / 2, 5, 0, Math.PI * 2);
  g.fill();
  const rand = rng(5);
  grain(g, s, s, 14, rand);
  c.opts = { repeat: false };
  return c;
}

function nightWindow({ seed }) {
  const rand = rng(seed);
  const w = 64, h = 96;
  const [c, g] = mk(w, h);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0a1020');
  sky.addColorStop(0.7, '#1c2a40');
  sky.addColorStop(1, '#0b0f14');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  // clouds
  for (let i = 0; i < 14; i++) {
    g.fillStyle = `rgba(90,100,120,${0.1 + rand() * 0.2})`;
    g.beginPath();
    g.ellipse(rand() * w, rand() * h * 0.6, 8 + rand() * 14, 3 + rand() * 4, 0, 0, Math.PI * 2);
    g.fill();
  }
  // moon
  g.fillStyle = 'rgba(220,225,210,0.9)';
  g.beginPath();
  g.arc(w * 0.7, h * 0.22, 6, 0, Math.PI * 2);
  g.fill();
  // dead tree silhouette
  g.strokeStyle = '#020304';
  g.lineWidth = 2;
  const branch = (x, y, a, len, d) => {
    if (d <= 0 || len < 2) return;
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    g.lineWidth = Math.max(1, d * 0.8);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x2, y2);
    g.stroke();
    branch(x2, y2, a - 0.4 - rand() * 0.4, len * 0.7, d - 1);
    branch(x2, y2, a + 0.3 + rand() * 0.4, len * 0.68, d - 1);
  };
  branch(w * 0.25, h, -Math.PI / 2, 22, 5);
  g.fillStyle = '#030405';
  g.fillRect(0, h * 0.86, w, h * 0.14);
  c.opts = { repeat: false, smooth: true };
  return c;
}

function sprite(kind) {
  const s = 64;
  const [c, g] = mk(s, s);
  if (kind === 'glow') {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  } else if (kind === 'flame') {
    const grd = g.createRadialGradient(s / 2, s * 0.68, 1, s / 2, s * 0.6, s * 0.42);
    grd.addColorStop(0, 'rgba(255,250,220,1)');
    grd.addColorStop(0.3, 'rgba(255,190,80,0.95)');
    grd.addColorStop(0.7, 'rgba(220,80,20,0.5)');
    grd.addColorStop(1, 'rgba(120,20,0,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(s / 2, 2);
    g.bezierCurveTo(s * 0.9, s * 0.45, s * 0.85, s * 0.95, s / 2, s * 0.95);
    g.bezierCurveTo(s * 0.15, s * 0.95, s * 0.1, s * 0.45, s / 2, 2);
    g.fill();
  } else if (kind === 'cobweb') {
    g.strokeStyle = 'rgba(220,220,220,0.55)';
    g.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI / 2;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * s * 1.2, Math.sin(a) * s * 1.2);
      g.stroke();
    }
    for (let r = 6; r < s * 1.1; r += 7) {
      g.beginPath();
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI / 2;
        const rr = r + Math.sin(i * 2.3 + r) * 1.5;
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        if (i === 0) g.moveTo(x, y);
        else g.quadraticCurveTo(Math.cos(a - 0.1) * rr * 0.92, Math.sin(a - 0.1) * rr * 0.92, x, y);
      }
      g.stroke();
    }
  } else if (kind === 'rain') {
    const rand = rng(77);
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(190,200,220,${0.15 + rand() * 0.35})`;
      const x = rand() * s, y = rand() * s, l = 4 + rand() * 10;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 1, y + l);
      g.stroke();
    }
  } else if (kind === 'blood') {
    const rand = rng(31);
    g.fillStyle = 'rgba(70,4,6,0.95)';
    g.beginPath();
    g.arc(s / 2, s / 2, s * 0.22, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 14; i++) {
      const a = rand() * Math.PI * 2, r = s * (0.2 + rand() * 0.25);
      g.beginPath();
      g.arc(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r, 1 + rand() * 4, 0, Math.PI * 2);
      g.fill();
    }
  } else if (kind === 'eyes') {
    g.fillStyle = 'rgba(255,240,180,1)';
    g.beginPath();
    g.ellipse(s * 0.32, s / 2, 5, 3, 0, 0, Math.PI * 2);
    g.ellipse(s * 0.68, s / 2, 5, 3, 0, 0, Math.PI * 2);
    g.fill();
  } else if (kind === 'smoke') {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,0.5)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  }
  c.opts = { repeat: kind === 'rain', smooth: true };
  return c;
}

function plain({ seed, base, dark, scale = 6, size = 64, amount = 20 }) {
  const rand = rng(seed);
  const n = makeNoise(rand, scale * 2);
  const B = hex(base), D = hex(dark);
  const [c, g] = paint(size, size, (x, y) => mix(D, B, fbm(n, (x / size) * scale * 2, (y / size) * scale * 2, 4)));
  grain(g, size, size, amount, rand);
  return c;
}

function plaster({ seed, base, size = 128 }) {
  const c = plain({ seed, base, dark: hex(base).map((v) => v * 0.7).reduce((a, v) => (a << 8) | v, 0), size, scale: 4, amount: 12 });
  const g = c.getContext('2d');
  const rand = rng(seed + 9);
  g.strokeStyle = 'rgba(40,30,20,0.45)';
  for (let k = 0; k < 5; k++) {
    let x = rand() * size, y = rand() * size;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 10; s++) { x += (rand() - 0.5) * 12; y += (rand() - 0.3) * 9; g.lineTo(x, y); }
    g.stroke();
  }
  grime(g, size, size, rand, 0.5, 2, [60, 45, 25]);
  return c;
}

function crate({ seed }) {
  const c = woodPlanks({ seed, base: 0x8a6a42, dark: 0x4a3418, plank: 21, size: 64, worn: 0.2 });
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(30,20,10,0.9)';
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, 61, 61);
  g.beginPath();
  g.moveTo(3, 3);
  g.lineTo(61, 61);
  g.stroke();
  return c;
}

function wineRack({ seed }) {
  const rand = rng(seed);
  const s = 64;
  const [c, g] = mk(s, s);
  g.fillStyle = '#2a1a0e';
  g.fillRect(0, 0, s, s);
  const cell = 16;
  for (let y = 0; y < s; y += cell) {
    for (let x = 0; x < s; x += cell) {
      g.fillStyle = '#0a0604';
      g.fillRect(x + 2, y + 2, cell - 4, cell - 4);
      if (rand() < 0.8) {
        g.fillStyle = rand() < 0.5 ? '#14260f' : '#2a0c10';
        g.beginPath();
        g.arc(x + cell / 2, y + cell / 2, 5, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(200,220,180,0.35)';
        g.fillRect(x + cell / 2 - 3, y + cell / 2 - 3, 2, 2);
        g.fillStyle = '#000';
        g.beginPath();
        g.arc(x + cell / 2, y + cell / 2, 2, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  grime(g, s, s, rand, 0.5, 2);
  return c;
}

function paper({ seed, lines = true, w = 64, h = 80 }) {
  const rand = rng(seed);
  const [c, g] = mk(w, h);
  g.fillStyle = '#d9cdb0';
  g.fillRect(0, 0, w, h);
  if (lines) {
    g.fillStyle = 'rgba(40,30,30,0.55)';
    for (let y = 8; y < h - 6; y += 4) {
      let x = 6;
      while (x < w - 8) {
        const l = 2 + rand() * 8;
        g.fillRect(x, y, Math.min(l, w - 6 - x), 1);
        x += l + 2;
      }
    }
  }
  grime(g, w, h, rand, 0.35, 2, [120, 90, 40]);
  c.opts = { repeat: false };
  return c;
}

function recordLabel() {
  const s = 64;
  const [c, g] = mk(s, s);
  g.fillStyle = '#080808';
  g.fillRect(0, 0, s, s);
  g.strokeStyle = 'rgba(80,80,80,0.5)';
  for (let r = 14; r < 31; r += 2) {
    g.beginPath();
    g.arc(s / 2, s / 2, r, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = '#8a1a14';
  g.beginPath();
  g.arc(s / 2, s / 2, 11, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e0c080';
  g.fillRect(s / 2 - 7, s / 2 - 3, 14, 2);
  g.fillStyle = '#000';
  g.beginPath();
  g.arc(s / 2, s / 2, 1.5, 0, Math.PI * 2);
  g.fill();
  c.opts = { repeat: false };
  return c;
}

function runes({ seed }) {
  const rand = rng(seed);
  const c = stones({ seed, base: 0x5a5a52, dark: 0x22221e, mortar: 0x111110, rows: 2, size: 64 });
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(120,200,140,0.55)';
  g.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    const x = 6 + rand() * 52, y = 6 + rand() * 52;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rand() - 0.5) * 8, y + rand() * 6);
    g.lineTo(x + (rand() - 0.5) * 8, y + rand() * 8);
    g.stroke();
  }
  return c;
}

function stairCarpet({ seed }) {
  const rand = rng(seed);
  const [c, g] = paint(64, 64, (x, y) => {
    const ex = Math.min(x, 63 - x);
    if (ex < 6) return [70, 45, 25];
    if (ex < 8) return [170, 130, 60];
    return [105, 20, 22];
  });
  grain(g, 64, 64, 18, rand);
  grime(g, 64, 64, rand, 0.35, 2);
  return c;
}

function mirror() {
  const [c, g] = mk(32, 48);
  const grd = g.createLinearGradient(0, 0, 32, 48);
  grd.addColorStop(0, '#4a5a66');
  grd.addColorStop(0.5, '#1c242a');
  grd.addColorStop(1, '#30383e');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 48);
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.beginPath();
  g.moveTo(4, 0); g.lineTo(12, 0); g.lineTo(2, 20); g.lineTo(0, 20);
  g.fill();
  const rand = rng(3);
  grime(g, 32, 48, rand, 0.6, 2, [10, 10, 8]);
  c.opts = { repeat: false };
  return c;
}

// Breath-fog on the glass with 'III' wiped through it by a finger:
// transparent where the letters are, so the reflection shows through.
function mirrorFog() {
  const [c, g] = mk(64, 96);
  const rand = rng(17);
  for (let y = 0; y < 96; y++) {
    for (let x = 0; x < 64; x++) {
      const e = Math.min(x, 63 - x, y, 95 - y) / 12;
      const a = 0.42 + 0.25 * (1 - Math.min(1, e)) + (rand() - 0.5) * 0.08;
      g.fillStyle = `rgba(214,220,224,${a.toFixed(3)})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  g.globalCompositeOperation = 'destination-out';
  g.lineCap = 'round';
  g.lineWidth = 4;
  g.strokeStyle = 'rgba(0,0,0,0.92)';
  const line = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  for (const x of [21, 32, 43]) line(x + (rand() - 0.5) * 2, 30, x + (rand() - 0.5) * 2, 62);
  line(15, 29, 49, 28);
  line(15, 63, 50, 64);
  // drips running down from the strokes
  g.lineWidth = 1.2;
  for (const x of [17, 22, 31, 44, 48]) line(x, 64, x + (rand() - 0.5), 64 + 6 + rand() * 18);
  g.globalCompositeOperation = 'source-over';
  c.opts = { repeat: false, smooth: true };
  return c;
}

// Old silvering: dark blotches creeping in from the edges, clear centre.
function mirrorAge() {
  const [c, g] = mk(64, 96);
  const rand = rng(29);
  const img = g.createImageData(64, 96);
  for (let y = 0; y < 96; y++) {
    for (let x = 0; x < 64; x++) {
      const e = Math.min(x, 63 - x, y, 95 - y);
      const n = rand();
      let a = Math.max(0, 1 - e / 9) * 0.7 + (n > 0.985 ? 0.5 : 0);
      if (e < 2) a = 0.85;
      const i = (y * 64 + x) * 4;
      img.data[i] = 22; img.data[i + 1] = 20; img.data[i + 2] = 16;
      img.data[i + 3] = Math.round(Math.min(1, a) * 255);
    }
  }
  g.putImageData(img, 0, 0);
  c.opts = { repeat: false };
  return c;
}

// Faces are projected from the front onto the sculpted heads (body.js), so
// the features sit on fixed rows: brows 7, eyes 10-11, nose 13-19, mouth
// 21-22, chin 28; eyes are centred on columns 9.5 and 21.5.
// kind: 'man' | 'dead' | 'ghoul' | 'ghost' | 'ghostScream' | 'agony'.
// glow:true paints only what shines (the eyes), for an emissive map.
function face({ skin, eye = '#e6dece', iris = '#3a2616', brows = '#2a1a10', lips = '#8a5048', mouth = '#2a0a08', mustache = null, kind = 'man', female = false, glow = false }) {
  const [c, g] = mk(32, 32);
  const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  px(0, 0, 32, 32, glow ? '#000' : skin);
  const dead = kind !== 'man';
  if (glow) {
    if (kind === 'ghoul') { px(7, 9, 5, 3, eye); px(20, 9, 5, 3, eye); }
    else if (kind === 'dead') { px(9, 10, 2, 2, eye); px(21, 10, 2, 2, eye); }
    c.opts = { repeat: false };
    return c;
  }
  if (kind === 'agony') {
    const shade = (a) => `rgba(20,10,10,${a})`;
    px(6, 8, 7, 5, shade(0.35)); px(19, 8, 7, 5, shade(0.35));
    px(7, 10, 5, 1, '#1a1010'); px(20, 10, 5, 1, '#1a1010');
    px(8, 6, 4, 1, '#2a2020'); px(20, 6, 4, 1, '#2a2020'); px(12, 7, 1, 1, '#2a2020'); px(19, 7, 1, 1, '#2a2020');
    px(14, 12, 1, 6, shade(0.2)); px(17, 12, 1, 6, shade(0.2));
    px(12, 19, 8, 9, '#120404'); px(13, 18, 6, 1, '#120404'); px(13, 28, 6, 1, '#120404');
    px(13, 20, 6, 1, '#c8bca0');
    c.opts = { repeat: false };
    return c;
  }
  if (kind === 'ghost') {
    // hollow eyes and a moaning mouth: black reads as see-through when added
    px(7, 8, 5, 5, '#000'); px(20, 8, 5, 5, '#000');
    px(8, 7, 3, 1, '#000'); px(21, 7, 3, 1, '#000');
    px(14, 19, 4, 6, '#000'); px(15, 18, 2, 1, '#000'); px(15, 25, 2, 1, '#000');
    c.opts = { repeat: false };
    return c;
  }
  if (kind === 'ghostScream') {
    // the same face torn open: sockets dragged down into the cheeks, black
    // runnels below them, the jaw hanging to the chin
    px(6, 7, 6, 8, '#000'); px(20, 7, 6, 8, '#000');
    px(7, 15, 4, 2, '#000'); px(21, 15, 4, 2, '#000');
    px(8, 17, 2, 5, '#000'); px(22, 17, 2, 5, '#000');
    px(11, 19, 10, 11, '#000'); px(12, 18, 8, 1, '#000'); px(12, 30, 8, 2, '#000');
    c.opts = { repeat: false };
    return c;
  }
  // soft modelling: eye sockets, sides of the nose, under the lip and chin
  const shade = (a) => `rgba(20,8,4,${a})`;
  px(7, 9, 6, 4, shade(dead ? 0.35 : 0.12)); px(19, 9, 6, 4, shade(dead ? 0.35 : 0.12));
  px(8, 13, 3, 1, shade(dead ? 0.25 : 0.06)); px(21, 13, 3, 1, shade(dead ? 0.25 : 0.06));
  px(14, 13, 1, 5, shade(0.1)); px(17, 13, 1, 5, shade(0.1));
  px(13, 19, 6, 1, shade(0.18));
  px(14, 19, 1, 1, shade(0.5)); px(17, 19, 1, 1, shade(0.5));
  px(12, 24, 8, 1, shade(0.1));
  px(10, 29, 12, 3, shade(0.12));
  if (dead) {
    px(5, 14, 3, 6, shade(0.18)); px(24, 14, 3, 6, shade(0.18)); // hollow cheeks
    px(18, 3, 2, 6, 'rgba(40,10,10,0.35)'); // a dark vein
  }
  // brows
  if (kind !== 'ghoul') { px(7, 7, 5, 1, brows); px(20, 7, 5, 1, brows); if (!female) { px(11, 8, 1, 1, brows); px(20, 8, 1, 1, brows); } }
  // eyes
  if (kind === 'ghoul') {
    px(7, 9, 5, 3, eye); px(20, 9, 5, 3, eye);
    px(9, 10, 1, 1, '#000'); px(22, 10, 1, 1, '#000');
  } else {
    px(8, 10, 4, 2, eye); px(20, 10, 4, 2, eye);
    if (kind === 'man') { px(9, 10, 2, 2, iris); px(21, 10, 2, 2, iris); px(9, 10, 1, 1, '#000'); px(22, 10, 1, 1, '#000'); }
    else { px(9, 10, 2, 2, 'rgba(255,250,210,0.9)'); px(21, 10, 2, 2, 'rgba(255,250,210,0.9)'); }
    if (female) { px(7, 9, 1, 1, brows); px(24, 9, 1, 1, brows); }
  }
  // mouth
  if (kind === 'ghoul') {
    px(9, 21, 14, 3, mouth);
    for (let x = 9; x < 23; x += 2) px(x, 21, 1, 1, '#d8d0b0');
    for (let x = 10; x < 23; x += 3) px(x, 23, 1, 1, '#c8c0a0');
  } else {
    if (mustache) px(11, 19, 10, 2, mustache);
    px(12, 21, 8, 1, dead ? mouth : lips);
    px(13, 22, 6, 1, dead ? lips : shade(0.2));
    if (female && !dead) px(13, 21, 6, 1, lips);
  }
  c.opts = { repeat: false };
  return c;
}

// The chapel's window, read from the bottom up: the sea, a green star risen
// out of it, the flame the star kindles, and the dawn at the top.
function stainedGlass() {
  const w = 64, h = 100;
  const [c, g] = mk(w, h);
  const rand = rng(181);
  g.fillStyle = '#060606';
  g.fillRect(0, 0, w, h);
  const band = (y0, y1, base, draw) => {
    g.save();
    g.beginPath();
    g.rect(3, y0, w - 6, y1 - y0);
    g.clip();
    g.fillStyle = base;
    g.fillRect(0, y0, w, y1 - y0);
    draw(y0, y1);
    // lead between the pieces
    g.strokeStyle = '#050505';
    g.lineWidth = 1.2;
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      g.moveTo(3 + rand() * (w - 6), y0);
      g.lineTo(3 + rand() * (w - 6), y1);
      g.stroke();
    }
    g.restore();
    g.fillStyle = '#050505';
    g.fillRect(0, y1 - 1, w, 2);
  };
  // the sea
  band(76, 97, '#163a80', () => {
    g.strokeStyle = '#5a9ae0';
    g.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      for (let x = 3; x <= w - 3; x += 2) g.lineTo(x, 82 + k * 6 + Math.sin(x * 0.35 + k) * 2);
      g.stroke();
    }
  });
  // the star
  band(52, 76, '#10401c', () => {
    g.fillStyle = '#6ae07a';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 4 : 10, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(w / 2 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    g.fill();
  });
  // the flame
  band(28, 52, '#5a100a', () => {
    g.fillStyle = '#ff6a20';
    g.beginPath();
    g.moveTo(w / 2, 30);
    g.quadraticCurveTo(w / 2 + 12, 42, w / 2 + 6, 50);
    g.lineTo(w / 2 - 6, 50);
    g.quadraticCurveTo(w / 2 - 12, 42, w / 2, 30);
    g.fill();
    g.fillStyle = '#ffd060';
    g.beginPath();
    g.moveTo(w / 2, 38);
    g.quadraticCurveTo(w / 2 + 5, 45, w / 2 + 2, 50);
    g.lineTo(w / 2 - 2, 50);
    g.quadraticCurveTo(w / 2 - 5, 45, w / 2, 38);
    g.fill();
  });
  // the dawn, in the arch
  band(3, 28, '#6a5008', () => {
    g.fillStyle = '#ffd848';
    g.beginPath();
    g.arc(w / 2, 22, 7, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffe890';
    g.lineWidth = 1.5;
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      g.beginPath();
      g.moveTo(w / 2 + Math.cos(a) * 9, 22 + Math.sin(a) * 9);
      g.lineTo(w / 2 + Math.cos(a) * 18, 22 + Math.sin(a) * 18);
      g.stroke();
    }
  });
  // pointed arch: everything outside it is stone
  g.fillStyle = '#060606';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, 26);
  g.quadraticCurveTo(2, 4, w / 2, 0);
  g.quadraticCurveTo(w - 2, 4, w, 26);
  g.lineTo(w, 0);
  g.fill();
  c.opts = { repeat: false };
  return c;
}

// A man standing in the rain, as the lightning shows him: white on clear,
// to be tinted black.
function silhouette() {
  const [c, g] = mk(32, 80);
  g.clearRect(0, 0, 32, 80);
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(16, 9, 6, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(5, 23);
  g.quadraticCurveTo(16, 14, 27, 23);
  g.lineTo(28, 50);
  g.lineTo(23, 51);
  g.lineTo(21, 79);
  g.lineTo(17, 79);
  g.lineTo(16, 56);
  g.lineTo(15, 79);
  g.lineTo(11, 79);
  g.lineTo(9, 51);
  g.lineTo(4, 50);
  g.closePath();
  g.fill();
  c.opts = { repeat: false };
  return c;
}

// The armour's helm: a visor slit and breathing holes in iron; the glow map
// is what burns behind the slit once it wakes.
function helmFace(glow) {
  const [c, g] = mk(32, 32);
  const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  if (glow) {
    px(0, 0, 32, 32, '#000');
    px(9, 10, 3, 2, '#ff3018'); px(20, 10, 3, 2, '#ff3018');
    px(10, 10, 1, 1, '#ffd0a0'); px(21, 10, 1, 1, '#ffd0a0');
    c.opts = { repeat: false };
    return c;
  }
  px(0, 0, 32, 32, '#6c6c72');
  px(0, 0, 32, 3, '#7a7a80');
  px(15, 0, 2, 32, '#56565c');
  px(4, 8, 24, 6, '#4a4a50');
  px(5, 10, 22, 2, '#050505');
  for (let y = 18; y <= 24; y += 3) for (let x = 9; x <= 22; x += 3) px(x, y, 1, 1, '#141414');
  px(4, 28, 24, 4, '#56565c');
  c.opts = { repeat: false };
  return c;
}

const BUILDERS = {
  stainedGlass: () => stainedGlass(),
  silhouette: () => silhouette(),
  faceArmor: () => helmFace(false),
  faceArmorGlow: () => helmFace(true),
  woodFloor: () => woodPlanks({ seed: 11, base: 0x6b4426, dark: 0x2a170b }),
  woodFloorDark: () => woodPlanks({ seed: 12, base: 0x4a2e1a, dark: 0x1a0e06, worn: 0.2 }),
  atticFloor: () => woodPlanks({ seed: 13, base: 0x7a6650, dark: 0x352a1e, plank: 21, worn: 0.5 }),
  atticWall: () => woodPlanks({ seed: 14, base: 0x6a5640, dark: 0x2a2016, plank: 21, vertical: true, worn: 0.2 }),
  wood: () => plainWood(21, 0x5a3820, 0x26150a),
  woodRed: () => plainWood(22, 0x6e2a18, 0x2a0c06),
  woodLight: () => plainWood(23, 0x9a7a52, 0x4a3420),
  woodBlack: () => plainWood(24, 0x2a221c, 0x0c0a08),
  wallpaperGreen: () => wallpaper({ seed: 31, base: 0x23352a, motif: 0x6a7a4a }),
  wallpaperRed: () => wallpaper({ seed: 32, base: 0x4a1418, motif: 0x8a5a30, stripe: 0x2a0a0c }),
  wallpaperBlue: () => wallpaper({ seed: 33, base: 0x1e2a40, motif: 0x6a7090 }),
  wallpaperGold: () => wallpaper({ seed: 34, base: 0x5a4628, motif: 0x2a2014, stripe: 0x3a2a14 }),
  wallpaperRose: () => wallpaper({ seed: 35, base: 0x5a3a3a, motif: 0x9a7a6a, age: 0.6 }),
  wainscot: () => wainscot({ seed: 41, base: 0x4a2c16, dark: 0x1e1008 }),
  wainscotLight: () => wainscot({ seed: 42, base: 0x7a5a3a, dark: 0x3a2814 }),
  plaster: () => plaster({ seed: 51, base: 0xa89c86 }),
  plasterDark: () => plaster({ seed: 52, base: 0x6a6052 }),
  stoneWall: () => stones({ seed: 61, base: 0x6a645a, dark: 0x2a2620, mortar: 0x16130f, rows: 6 }),
  stoneFloor: () => stones({ seed: 62, base: 0x56524a, dark: 0x22201c, mortar: 0x0e0c0a, rows: 3, jitter: 0.5 }),
  brick: () => stones({ seed: 63, base: 0x7a3a26, dark: 0x3a160c, mortar: 0x2a2620, rows: 8, jitter: 0.1, rough: 0.3 }),
  rock: () => rock({ seed: 64, base: 0x4a4a40, dark: 0x0e0e0c }),
  rockWet: () => rock({ seed: 65, base: 0x3a4a44, dark: 0x080c0c }),
  marble: () => checker({ seed: 71, a: 0x1a1a1c, b: 0xc8c2b4, tiles: 2 }),
  kitchenFloor: () => checker({ seed: 72, a: 0x2a2a28, b: 0xb0a890, tiles: 4, veins: false }),
  bathFloor: () => checker({ seed: 73, a: 0x202020, b: 0xd0ccc0, tiles: 8, veins: false }),
  tileWhite: () => smallTiles({ seed: 74, base: 0xd8d4c8, grout: 0x7a766a }),
  tileGreen: () => smallTiles({ seed: 75, base: 0x5a7a6a, grout: 0x2a3a30, crack: 0.25 }),
  carpetRunner: () => carpetRunner({ seed: 81 }),
  rugRed: () => rug({ seed: 82 }),
  rugBlue: () => rug({ seed: 83, field: [30, 40, 80], border: [100, 20, 20], accent: [200, 170, 110] }),
  rugGreen: () => rug({ seed: 84, field: [30, 60, 40], border: [70, 30, 20], accent: [180, 150, 90] }),
  curtainRed: () => curtain({ seed: 91, color: 0x7a1418 }),
  curtainGreen: () => curtain({ seed: 92, color: 0x1e4a2a }),
  curtainGold: () => curtain({ seed: 93, color: 0x8a6a2a }),
  quilt: () => quilt({ seed: 94, a: 0x5a1a1e, b: 0x6a5030 }),
  linen: () => linen({ seed: 95 }),
  books: () => books({ seed: 101 }),
  books2: () => books({ seed: 102 }),
  portraitMan: () => portrait({ seed: 111, bg: [50, 35, 20], cloth: [25, 20, 18] }),
  portraitOld: () => portrait({ seed: 112, bg: [30, 35, 30], cloth: [20, 24, 30], skin: [170, 150, 120] }),
  portraitWoman: () => portrait({ seed: 113, bg: [40, 30, 40], cloth: [60, 20, 30], skin: [210, 180, 160], kind: 'woman' }),
  portraitCaptain: () => portrait({ seed: 114, bg: [20, 25, 35], cloth: [15, 18, 40], skin: [160, 130, 100] }),
  portraitLady: () => portrait({ seed: 115, bg: [30, 32, 44], cloth: [36, 44, 64], skin: [200, 176, 156], kind: 'woman' }),
  portraitBoy: () => portrait({ seed: 116, bg: [36, 34, 30], cloth: [28, 30, 40], skin: [214, 190, 170], kind: 'boy' }),
  seascape: () => seascape({ seed: 121 }),
  clockFace: () => clockFace(),
  nightWindow: () => nightWindow({ seed: 131 }),
  nightWindow2: () => nightWindow({ seed: 132 }),
  glow: () => sprite('glow'),
  flame: () => sprite('flame'),
  cobweb: () => sprite('cobweb'),
  rain: () => sprite('rain'),
  blood: () => sprite('blood'),
  eyes: () => sprite('eyes'),
  smoke: () => sprite('smoke'),
  iron: () => plain({ seed: 141, base: 0x3a3634, dark: 0x141210, amount: 18 }),
  rust: () => plain({ seed: 142, base: 0x6a3a1e, dark: 0x1e140e, amount: 26 }),
  brass: () => plain({ seed: 143, base: 0xb08a40, dark: 0x5a3a14, amount: 16 }),
  velvet: () => plain({ seed: 144, base: 0x6a1a22, dark: 0x2a060a, amount: 10 }),
  velvetGreen: () => plain({ seed: 145, base: 0x2a4a30, dark: 0x0a1a10, amount: 10 }),
  leather: () => plain({ seed: 146, base: 0x5a2a16, dark: 0x200c06, amount: 14 }),
  soot: () => plain({ seed: 147, base: 0x2a2420, dark: 0x050404, amount: 20 }),
  dirt: () => plain({ seed: 148, base: 0x3a3024, dark: 0x120e0a, amount: 24, size: 128, scale: 8 }),
  crate: () => crate({ seed: 151 }),
  wineRack: () => wineRack({ seed: 152 }),
  paper: () => paper({ seed: 161 }),
  paperBlank: () => paper({ seed: 162, lines: false }),
  recordLabel: () => recordLabel(),
  runes: () => runes({ seed: 171 }),
  stairCarpet: () => stairCarpet({ seed: 181 }),
  mirror: () => mirror(),
  mirrorFog: () => mirrorFog(),
  mirrorAge: () => mirrorAge(),
  facePlayer: () => face({ skin: '#c89a78', mustache: '#3a2414', brows: '#2a1a10', lips: '#9a5e50' }),
  faceClara: () => face({ skin: '#e4c4ae', brows: '#3a2214', iris: '#2e4a5a', lips: '#a8404c', female: true }),
  faceThrall: () => face({ skin: '#6e8a80', eye: '#c8d4c8', lips: '#2a3a34', mouth: '#081210', brows: '#283430', kind: 'dead' }),
  faceThrallGlow: () => face({ eye: '#b8e0d0', kind: 'dead', glow: true }),
  faceZombie: () => face({ skin: '#7a8a6a', eye: '#c8c090', lips: '#4a3a3a', mouth: '#1a0606', brows: '#3a3a30', kind: 'dead' }),
  faceZombieGlow: () => face({ eye: '#d8d090', kind: 'dead', glow: true }),
  faceMaid: () => face({ skin: '#7e8c72', eye: '#c8c090', lips: '#4a2a30', mouth: '#1a0606', brows: '#2a1a12', kind: 'dead', female: true }),
  faceSilas: () => face({ skin: '#9aa08e', eye: '#e0d8b8', lips: '#4a4040', mouth: '#2a0606', brows: '#c8c8c0', kind: 'dead' }),
  faceSilasGlow: () => face({ eye: '#f0e8c0', kind: 'dead', glow: true }),
  faceCook: () => face({ skin: '#b09a88', eye: '#e8d8a0', lips: '#6a3a30', mouth: '#3a0606', brows: '#3a2a1a', kind: 'dead' }),
  faceCookGlow: () => face({ eye: '#ffe080', kind: 'dead', glow: true }),
  faceGhoul: () => face({ skin: '#6e6e60', eye: '#ffd040', mouth: '#200808', kind: 'ghoul' }),
  faceGhoulGlow: () => face({ eye: '#ffd040', kind: 'ghoul', glow: true }),
  faceGhost: () => face({ skin: '#ffffff', kind: 'ghost' }),
  faceGhostScream: () => face({ skin: '#ffffff', kind: 'ghostScream' }),
  faceDrowned: () => face({ skin: '#a8b6b2', kind: 'ghost' }),
  faceAgony: () => face({ skin: '#8e9290', kind: 'agony' }),
};

function plainWood(seed, base, dark) {
  return woodPlanks({ seed, base, dark, plank: 32, nails: false, worn: 0.05, joints: false });
}

// Metres covered by one texture repeat (used for world-space UVs).
Object.assign(TEX_SIZE, {
  woodFloor: [2, 2], woodFloorDark: [2, 2], atticFloor: [2, 2], atticWall: [2, 2],
  wood: [1, 1], woodRed: [1, 1], woodLight: [1, 1], woodBlack: [1, 1],
  wallpaperGreen: [1, 1], wallpaperRed: [1, 1], wallpaperBlue: [1, 1], wallpaperGold: [1, 1], wallpaperRose: [1, 1],
  wainscot: [1, 1], wainscotLight: [1, 1],
  plaster: [2, 2], plasterDark: [2, 2],
  stoneWall: [2, 2], stoneFloor: [2, 2], brick: [1.5, 1.5], rock: [3, 3], rockWet: [3, 3],
  marble: [1.6, 1.6], kitchenFloor: [1.6, 1.6], bathFloor: [1, 1], tileWhite: [1, 1], tileGreen: [1, 1],
  iron: [1, 1], rust: [1, 1], brass: [0.5, 0.5], velvet: [1, 1], velvetGreen: [1, 1], leather: [1, 1], soot: [1, 1], dirt: [2, 2],
  crate: [1, 1], wineRack: [0.6, 0.6], books: [1, 1], books2: [1, 1], stairCarpet: [1, 1], quilt: [1, 1], linen: [1, 1],
  curtainRed: [1, 2], curtainGreen: [1, 2], curtainGold: [1, 2], runes: [1, 1], carpetRunner: [1.2, 2.4],
});
