// What the camera shows with him standing at each spot.
//   node tools/checks/views.cjs <room> <entry> <tag> <flagsJSON> "x,z,rot;x,z,rot;..."
//   python3 tools/checks/sheet.py <tag> [cols]   -> tools/checks/out/sheet_<tag>.png
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, 'out');
require('fs').mkdirSync(OUT, { recursive: true });
const fs = require('fs');
const [room, entry, tag, extra, spotsArg] = process.argv.slice(2);
const chap = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/game/chapters.json'), 'utf8')).abyss;
const flags = { ...chap.flags, ...(extra ? JSON.parse(extra) : {}) };
const spots = spotsArg.split(';').map((s) => s.split(',').map(Number));
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  await page.goto('file://' + path.join(ROOT, 'dist/index.html'));
  await page.waitForTimeout(1500);
  await page.evaluate(([room, entry, flags]) => {
    const g = __game;
    g.debugStart(room, entry, { flags, items: ['lantern'] });
    g.godMode = true;
    for (const m of g.room.monsters) { m.hidden = true; m.root.visible = false; m.solid = false; }
    g.lock();
  }, [room, entry, flags]);
  const out = [];
  for (const [i, [x, z, rot]] of spots.entries()) {
    const id = await page.evaluate(([x, z, rot]) => {
      const g = __game, d = g.director;
      g.player.place(x, z, rot || 0); g.player.pos.y = g.room.floorY(x, z);
      d.current = null;
      for (let k = 0; k < 6; k++) d.update(g.player.pos, 0.1);
      const e = d.evaluate({ cam: d.cam, pos: d.cam.position }, d.setPoints(g.player.pos), {});
      return `${d.current.id} v${e.vis}f${e.frame}s${e.size.toFixed(2)} cam(${d.current.pos.x.toFixed(1)},${d.current.pos.y.toFixed(1)},${d.current.pos.z.toFixed(1)})`;
    }, [x, z, rot]);
    await page.waitForTimeout(400);
    const f = `${OUT}/v_${tag}_${i}.png`;
    await page.locator('#view').screenshot({ path: f });
    out.push([f, `${x},${z} ${id}`]);
    console.log(i, x, z, id);
  }
  fs.writeFileSync(`${OUT}/v_${tag}.json`, JSON.stringify(out));
  await browser.close();
})();
