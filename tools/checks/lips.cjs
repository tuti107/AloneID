// Find "lips": two collider faces facing the same way, a few centimetres
// apart and meeting end to end, where a body sliding along the wall catches.
// Reported only where he can actually stand next to them (every room, in
// the first act's state and the late game's).
//   node build.mjs --dev && node tools/checks/lips.cjs
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, 'out');
require('fs').mkdirSync(OUT, { recursive: true });
const fs = require('fs');
const ROOMS = ['attic', 'corridor', 'library', 'bathroom', 'bedroom', 'hall', 'dining', 'music', 'kitchen', 'cellar', 'cavern', 'gallery', 'chapel', 'conservatory', 'servants', 'boiler', 'tower', 'lamproom', 'nursery', 'graveyard', 'crypt', 'tidecave', 'gullcabin', 'shrine'];
const chap = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/game/chapters.json'), 'utf8'));
const states = { act1: {}, late: chap.abyss.flags };
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 320, height: 240 } });
  await page.goto('file://' + path.join(ROOT, 'dist/index.html'));
  await page.waitForTimeout(1500);
  const out = [];
  for (const [sname, flags] of Object.entries(states)) {
    for (const room of ROOMS) {
      const res = await page.evaluate(([room, flags]) => {
        const g = __game;
        try { g.debugStart(room, null, { flags, items: [] }); } catch (e) { return { err: String(e) }; }
        const r = g.room;
        const cols = r.colliders.filter((b) => b.enabled && b.solid);
        // faces: endpoints a, b and outward normal n
        const faces = [];
        for (const b of cols) {
          const P = (lx, lz) => { const o = {}; b.toWorld(lx, lz, o); return [o.x, o.z]; };
          const N = (lx, lz) => [lx * b.c + lz * b.s, -lx * b.s + lz * b.c];
          faces.push({ b, a: P(b.hw, -b.hd), e: P(b.hw, b.hd), n: N(1, 0) });
          faces.push({ b, a: P(-b.hw, -b.hd), e: P(-b.hw, b.hd), n: N(-1, 0) });
          faces.push({ b, a: P(-b.hw, b.hd), e: P(b.hw, b.hd), n: N(0, 1) });
          faces.push({ b, a: P(-b.hw, -b.hd), e: P(b.hw, -b.hd), n: N(0, -1) });
        }
        const free = (x, z) => {
          const y = r.floorY(x, z);
          for (const b of cols) {
            if (y + 1.6 < b.y0 || y > b.y1 - 0.3) continue;
            if (b.distance(x, z) < 0.3) return false;
          }
          return true;
        };
        // where he can get to: flood fill from the room's ways in
        const [bx0, bz0, bx1, bz1] = r.def.bounds;
        const step = 0.2;
        const nx = Math.floor((bx1 - bx0) / step) + 1, nz = Math.floor((bz1 - bz0) / step) + 1;
        const cell = (i, j) => [bx0 + i * step, bz0 + j * step];
        const seen = new Uint8Array(nx * nz), ok = new Uint8Array(nx * nz);
        for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const [x, z] = cell(i, j); ok[j * nx + i] = free(x, z) ? 1 : 0; }
        const q = [];
        for (const e of Object.values(r.entries)) {
          const i = Math.round((e.x - bx0) / step), j = Math.round((e.z - bz0) / step);
          if (i >= 0 && j >= 0 && i < nx && j < nz && ok[j * nx + i] && !seen[j * nx + i]) { seen[j * nx + i] = 1; q.push([i, j]); }
        }
        while (q.length) {
          const [i, j] = q.pop();
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const a = i + di, b2 = j + dj;
            if (a < 0 || b2 < 0 || a >= nx || b2 >= nz) continue;
            const k = b2 * nx + a;
            if (seen[k] || !ok[k]) continue;
            const [xa, za] = cell(i, j), [xb, zb] = cell(a, b2);
            if (Math.abs(r.floorY(xa, za) - r.floorY(xb, zb)) > 0.5) continue;
            seen[k] = 1;
            q.push([a, b2]);
          }
        }
        const reach = (x, z) => {
          const i = Math.round((x - bx0) / step), j = Math.round((z - bz0) / step);
          for (const [di, dj] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const a = i + di, b2 = j + dj;
            if (a >= 0 && b2 >= 0 && a < nx && b2 < nz && seen[b2 * nx + a]) return true;
          }
          return false;
        };
        const hits = [];
        for (let i = 0; i < faces.length; i++) for (let j = 0; j < faces.length; j++) {
          if (i === j) continue;
          const f = faces[i], h = faces[j];
          if (f.b === h.b) continue;
          if (f.n[0] * h.n[0] + f.n[1] * h.n[1] < 0.9995) continue;
          // h stands proud of f by d along the normal
          const d = (h.a[0] - f.a[0]) * f.n[0] + (h.a[1] - f.a[1]) * f.n[1];
          if (d < 0.015 || d > 0.3) continue;
          // along the face: t axis
          const t = [-f.n[1], f.n[0]];
          const ft = [f.a[0] * t[0] + f.a[1] * t[1], f.e[0] * t[0] + f.e[1] * t[1]].sort((p, q) => p - q);
          const ht = [h.a[0] * t[0] + h.a[1] * t[1], h.e[0] * t[0] + h.e[1] * t[1]].sort((p, q) => p - q);
          // they meet end to end (h's end within 0.05 of f's span), not overlapping much
          let jt = null;
          if (Math.abs(ht[0] - ft[1]) < 0.06 || (ht[0] > ft[0] && ht[0] < ft[1] + 0.06 && ht[1] > ft[1])) jt = ht[0];
          else if (Math.abs(ht[1] - ft[0]) < 0.06 || (ht[1] < ft[1] && ht[1] > ft[0] - 0.06 && ht[0] < ft[0])) jt = ht[1];
          if (jt === null) continue;
          // the junction point on f's plane, and a spot a body could stand at beside it
          const fn = f.a[0] * f.n[0] + f.a[1] * f.n[1];
          const px = t[0] * jt + f.n[0] * fn, pz = t[1] * jt + f.n[1] * fn;
          const side = jt === ht[0] ? -1 : 1; // the f side of the junction
          const sx = px + f.n[0] * 0.32 + t[0] * side * 0.3, sz = pz + f.n[1] * 0.32 + t[1] * side * 0.3;
          if (!free(sx, sz) || !reach(sx, sz)) continue;
          // and h's face must itself be exposed (not inside another box)
          const qx = px + f.n[0] * (d + 0.32) - t[0] * side * 0.3, qz = pz + f.n[1] * (d + 0.32) - t[1] * side * 0.3;
          if (!free(qx, qz) || !reach(qx, qz)) continue;
          hits.push([+px.toFixed(2), +pz.toFixed(2), +d.toFixed(3), f.n.map((v) => +v.toFixed(2))]);
        }
        return { hits };
      }, [room, flags]);
      if (res.err) { console.log(sname, room, 'ERR', res.err); continue; }
      for (const h of res.hits) { out.push([sname, room, ...h]); console.log(sname, room, JSON.stringify(h)); }
    }
  }
  fs.writeFileSync(`${OUT}/lips.json`, JSON.stringify(out));
  console.log('total', out.length);
  await browser.close();
})();
