// Top-down map of a room: the render from above, colliders, triggers, entries,
// interactables, and over every reachable spot which shot holds him there and
// whether it sees him (magenta: a spot he can stand on that is inside
// scenery). Starts from the late-game state of the 'abyss' chapter.
//   node tools/checks/topmap.cjs <room> <entry|-> <tag> [extraFlagsJSON]
//   python3 tools/checks/overlay.py <tag>   -> tools/checks/out/map_<tag>.png
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, 'out');
require('fs').mkdirSync(OUT, { recursive: true });
const fs = require('fs');
const [room, entry, tag, extra] = process.argv.slice(2);
const chap = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/game/chapters.json'), 'utf8')).abyss;
const flags = { ...chap.flags, ...(extra ? JSON.parse(extra) : {}) };
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto('file://' + path.join(ROOT, 'dist/index.html') + (process.env.Q || ''));
  await page.waitForTimeout(1500);
  const data = await page.evaluate(([room, entry, flags]) => {
    const g = __game;
    g.debugStart(room, entry === '-' ? null : entry, { flags, items: [] });
    g.godMode = true;
    const r = g.room;
    for (const m of r.monsters) { m.hidden = true; m.root.visible = false; m.solid = false; }
    const free = (x, z) => {
      const y = r.floorY(x, z);
      for (const b of r.colliders) {
        if (!b.enabled || !b.solid) continue;
        if (y + 1.6 < b.y0 || y > b.y1 - 0.3) continue;
        if (b.distance(x, z) < 0.28) return false;
      }
      return true;
    };
    const [bx0, bz0, bx1, bz1] = r.def.bounds;
    const step = 0.25;
    const nx = Math.floor((bx1 - bx0) / step) + 1, nz = Math.floor((bz1 - bz0) / step) + 1;
    const cell = (i, j) => [bx0 + i * step, bz0 + j * step];
    const ok = new Uint8Array(nx * nz), seen = new Uint8Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const [x, z] = cell(i, j); ok[j * nx + i] = free(x, z) ? 1 : 0; }
    const q = [];
    for (const e of Object.values(r.entries)) {
      const i = Math.round((e.x - bx0) / step), j = Math.round((e.z - bz0) / step);
      if (i >= 0 && j >= 0 && i < nx && j < nz && ok[j * nx + i] && !seen[j * nx + i]) { seen[j * nx + i] = 1; q.push([i, j]); }
    }
    while (q.length) {
      const [i, j] = q.pop();
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
        const k = b * nx + a;
        if (seen[k] || !ok[k]) continue;
        const [xa, za] = cell(i, j), [xb, zb] = cell(a, b);
        if (Math.abs(r.floorY(xa, za) - r.floorY(xb, zb)) > 0.5) continue;
        if (!free((xa + xb) / 2, (za + zb) / 2)) continue;
        seen[k] = 1;
        q.push([a, b]);
      }
    }
    // solid scenery at his waist and chest: the first face straight above
    // faces up, so the point is inside something
    const tris = [];
    r.scene.updateMatrixWorld(true);
    r.scene.traverse((m) => {
      if (!m.isMesh || !m.geometry || !m.geometry.attributes.position) return;
      if (r.dynamic && (m === r.dynamic || isIn(m, r.dynamic))) return;
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      if (!mat || mat.transparent) return;
      const pa = m.geometry.attributes.position, idx = m.geometry.index;
      const e = m.matrixWorld.elements;
      const W = (i) => { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i); return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; };
      const n = idx ? idx.count : pa.count;
      for (let t = 0; t < n; t += 3) {
        const a = W(idx ? idx.getX(t) : t), b = W(idx ? idx.getX(t + 1) : t + 1), c = W(idx ? idx.getX(t + 2) : t + 2);
        if (Math.max(a[1], b[1], c[1]) < 0.3) continue;
        const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
        if (Math.abs(ny) < 1e-9) continue;
        tris.push([a, b, c, ny, Math.min(a[0], b[0], c[0]), Math.max(a[0], b[0], c[0]), Math.min(a[2], b[2], c[2]), Math.max(a[2], b[2], c[2])]);
      }
    });
    function isIn(m, root) { for (let o = m.parent; o; o = o.parent) if (o === root) return true; return false; }
    const inside = (x, y0, z) => {
      let best = Infinity, up = false;
      for (const [a, b, c, ny, x0, x1, z0, z1] of tris) {
        if (x < x0 || x > x1 || z < z0 || z > z1) continue;
        // barycentric in xz
        const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
        if (Math.abs(d) < 1e-12) continue;
        const l1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
        const l2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
        const l3 = 1 - l1 - l2;
        if (l1 < 0 || l2 < 0 || l3 < 0) continue;
        const y = l1 * a[1] + l2 * b[1] + l3 * c[1];
        if (y <= y0 || y >= best) continue;
        best = y;
        up = ny > 0;
      }
      return up;
    };
    const d = g.director;
    const spots = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      if (!seen[j * nx + i]) continue;
      const [x, z] = cell(i, j);
      g.player.place(x, z, 0); g.player.pos.y = r.floorY(x, z);
      d.update(g.player.pos, 0, true);
      const e = d.evaluate({ cam: d.current.cam, pos: d.current.cam.position }, d.setPoints(g.player.pos), {});
      const fy = r.floorY(x, z);
      spots.push([x, z, d.current.id, e.vis, e.frame, +e.size.toFixed(2), e.good ? 1 : 0, inside(x, fy + 0.6, z) || inside(x, fy + 1.3, z) ? 1 : 0]);
    }
    // the view from above (back at the way in, out of any trigger)
    { const e = r.entries[entry] || Object.values(r.entries)[0]; g.player.place(e.x, e.z, e.rot); g.lock(); }
    if (r.scene.fog) r.scene.fog = null;
    if (r.hemiLight) { r.hemiLight.intensity *= 3; r.hemiBase = (r.hemiBase || 1) * 3; }
    const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
    const span = Math.max((bx1 - bx0) / (4 / 3), bz1 - bz0) * 1.06;
    const H = 40, fov = (2 * Math.atan(span / 2 / H) * 180) / Math.PI;
    g.cut({ pos: [cx, H, cz + 0.001], look: [cx, 0, cz], fov });
    g.player.root.visible = false;
    const cam = d.cam;
    cam.updateMatrixWorld(true);
    const P = (x, y, z) => { const v = new cam.position.constructor(x, y, z).project(cam); return [+v.x.toFixed(4), +v.y.toFixed(4)]; };
    const cols = r.colliders.filter((b) => b.enabled && b.solid).map((b) => {
      const c = [[-b.hw, -b.hd], [b.hw, -b.hd], [b.hw, b.hd], [-b.hw, b.hd]].map(([lx, lz]) => { const o = {}; b.toWorld(lx, lz, o); return P(o.x, 0, o.z); });
      return { c, low: b.low, y0: b.y0 === -Infinity ? null : b.y0, y1: b.y1 === Infinity ? null : b.y1 };
    });
    const trig = r.triggers.filter((t) => t.box).map((t) => { const [a, b2, c2, e2] = t.box; return [P(a, 0, b2), P(c2, 0, e2)]; });
    const ents = Object.entries(r.entries).map(([k, e]) => [k, P(e.x, 0, e.z)]);
    const its = r.interactables.map((it) => [it.id, P(it.x, 0, it.z), it.r || 0.5]);
    const shots = r.shots.map((s) => [s.id, P(s.pos.x, 0, s.pos.z), P(s.look.x, 0, s.look.z)]);
    const sp = spots.map(([x, z, id, v, f, s, good, ins]) => [P(x, 0, z), id, v, f, s, good, ins, x, z]);
    return { cols, trig, ents, its, shots, sp, ids: [...new Set(spots.map((s) => s[2]))] };
  }, [room, entry, flags]);
  await page.waitForTimeout(700);
  await page.locator('#view').screenshot({ path: `${OUT}/top_${tag}.png` });
  fs.writeFileSync(`${OUT}/top_${tag}.json`, JSON.stringify(data));
  const bad = data.sp.filter((s) => !s[5]);
  const ins = data.sp.filter((s) => s[6]);
  console.log(tag, 'spots', data.sp.length, 'not good', bad.length, 'inside scenery', ins.length, 'shots used', data.ids.join(','));
  await browser.close();
})();
