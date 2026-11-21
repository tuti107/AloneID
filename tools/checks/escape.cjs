// The final escape on foot: from the burning god to the graveyard, steering
// like a player holds the stick (camera-relative keys towards the next
// waypoint), running. Reports time left at each doorway and any stall.
//   node build.mjs --dev && node tools/checks/escape.cjs
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, 'out');
require('fs').mkdirSync(OUT, { recursive: true });
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}\n${(e.stack || "").split("\n").slice(0, 8).join("\n")}`));
  await page.goto('file://' + path.join(ROOT, 'dist/index.html'));
  await page.waitForTimeout(1200);
  const ev = (js) => page.evaluate(js);
  const until = async (js, label, timeout = 30000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) { try { if (await ev(js)) return true; } catch (e) { /* */ } await page.waitForTimeout(100); }
    console.log('  !! TIMEOUT', label); return false;
  };
  const idle = (l) => until('__game.idle && __game.state === "play"', l || 'idle');
  const use = async (id, choices = [], item = null) => {
    await ev(`__game.debugAuto.choices = ${JSON.stringify(choices)}`);
    const r = await ev(`__game.testUse(${JSON.stringify(id)}${item ? ',' + JSON.stringify(item) : ''})`);
    if (r !== 'ok' && r !== 'item') console.log('  !! use', id, r);
    await page.waitForTimeout(150);
    await idle('after ' + id);
  };
  await ev(`__game.debugAuto = { choices: [] }; __game.startChapter('abyss'); 0`);
  await until('__game.room && __game.room.id === "shrine"', 'shrine');
  await idle();
  await ev('__game.godMode = true');
  // the tide cave and the crypt already built (and kept) from the way down
  for (const [room, entry] of [['tidecave', 'fromShrine'], ['crypt', 'fromCave'], ['tidecave', 'fromCrypt'], ['shrine', 'fromCave']]) {
    await ev(`__game.run(() => __game.goTo(${JSON.stringify(room)}, ${JSON.stringify(entry)})); 0`);
    await until(`__game.room.id === ${JSON.stringify(room)} && __game.idle`, 'to ' + room);
  }
  console.log('kept rooms:', await ev('Object.keys(__game.rooms).join(",")'));
  await use('taken:shrineStar');
  await ev('__game.player.place(0, 1.0, Math.PI)');
  await page.waitForTimeout(600);
  await idle('it rises');
  for (const m of await ev('__game.room.monsters.map((m) => m.id)')) await ev(`(() => { const m = __game.room.monsters.find((q) => q.id === ${JSON.stringify(m)}); if (m && m.alive) m.die(); })()`);
  await use('pillarW', [], 'starstone');
  await use('pillarE', [], 'seastar');
  await use('altar', [0]);
  await idle('the flame');
  if (!(await ev('__game.flags.finalEscape'))) { console.log('  !! no escape'); await browser.close(); return; }
  await ev('__game.debugAuto = null');
  console.log('escape begins, time', await ev('__game.escape.t.toFixed(1)'), 'shot', await ev('__game.director.current.id'));

  // hold camera-relative arrows towards (tx, tz), re-aimed every 120 ms
  const keysFor = async (tx, tz) => ev(`(() => {
    const g = __game, p = g.player.pos;
    let dx = ${tx} - p.x, dz = ${tz} - p.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    // what the player would read the stick as: the basis kept while held
    const b = g.player.basis; let fx, fz;
    if (b) { fx = b.fx; fz = b.fz; } else { const d = g.director.controlDir(); fx = d.x; fz = d.z; }
    const f = dx * fx + dz * fz, r = dx * -fz + dz * fx;
    const k = [];
    if (f > 0.38) k.push('ArrowUp'); if (f < -0.38) k.push('ArrowDown');
    if (r > 0.38) k.push('ArrowRight'); if (r < -0.38) k.push('ArrowLeft');
    return k;
  })()`);
  let held = [];
  const setKeys = async (k) => {
    for (const key of held) if (!k.includes(key)) await page.keyboard.up(key);
    for (const key of k) if (!held.includes(key)) await page.keyboard.down(key);
    held = k;
  };
  const go = async (room, tx, tz, done, ms = 40000) => {
    const t0 = Date.now();
    let last = null, lastT = Date.now(), stalls = 0, shots = new Set();
    await page.keyboard.down('ShiftLeft');
    while (Date.now() - t0 < ms) {
      if (await ev(done)) break;
      const st = await ev(`[__game.room.id, __game.player.pos.x, __game.player.pos.z, __game.director.current && __game.director.current.id, __game.idle]`);
      if (st[0] !== room) break;
      shots.add(st[3]);
      // next waypoint on the nav path
      const wp = await ev(`(() => { const g = __game, p = g.player.pos; const path = g.room.nav.findPath(p.x, p.z, ${tx}, ${tz}); if (!path || !path.length) return [${tx}, ${tz}]; let w = path[0]; for (const q of path) { if (Math.hypot(q.x - p.x, q.z - p.z) > 0.6) { w = q; break; } } return [w.x, w.z]; })()`);
      await setKeys(st[4] ? await keysFor(wp[0], wp[1]) : []);
      if (last && Math.hypot(st[1] - last[0], st[2] - last[1]) > 0.25) { last = [st[1], st[2]]; lastT = Date.now(); }
      if (!last) { last = [st[1], st[2]]; lastT = Date.now(); }
      if (Date.now() - lastT > 1500 && st[4]) {
        stalls++;
        console.log(`   stall in ${room} at ${st[1].toFixed(2)},${st[2].toFixed(2)} shot ${st[3]} keys ${held.join('+')}`);
        await page.screenshot({ path: `${OUT}/stall_${room}_${stalls}.png` });
        lastT = Date.now();
        if (stalls > 4) break;
      }
      await page.waitForTimeout(120);
    }
    await setKeys([]);
    await page.keyboard.up('ShiftLeft');
    return { stalls, shots: [...shots] };
  };
  const leg = async (room, tx, tz, done, next) => {
    const t0 = Date.now();
    const r = await go(room, tx, tz, done);
    const ok = await until(next, `${room} -> next`, 15000);
    console.log(`${room}: ${ok ? 'through' : 'NOT through'} in ${((Date.now() - t0) / 1000).toFixed(1)}s, stalls ${r.stalls}, shots ${r.shots.join(',')}, time left ${await ev('__game.escape ? __game.escape.t.toFixed(1) : "-"')}`);
    await page.screenshot({ path: `${OUT}/after_${room}.png` });
    return ok;
  };
  if (await leg('shrine', 6.6, 10.9, '__game.room.id !== "shrine" || __game.transitioning', '__game.room.id === "tidecave" && __game.idle')) {
    await page.waitForTimeout(400);
    console.log('tide cave lit for the way out:', await ev('!!__game.room.escapeLit'), 'shot', await ev('__game.director.current.id'));
    await page.screenshot({ path: `${OUT}/tide_arrive.png` });
    if (await leg('tidecave', 8.45, 7.2, '__game.room.id !== "tidecave" || __game.transitioning', '__game.room.id === "crypt" && __game.idle')) {
      await page.waitForTimeout(400);
      console.log('crypt lit for the way out:', await ev('!!__game.room.escapeLit'), 'shot', await ev('__game.director.current.id'));
      await page.screenshot({ path: `${OUT}/crypt_arrive.png` });
      await go('crypt', 0, 5.75, 'Math.hypot(__game.player.pos.x, __game.player.pos.z - 5.75) < 0.5');
      const p = await ev('__game.promptText || (__game.ui && __game.ui.promptText)');
      console.log('at the door, prompt:', p);
      await page.keyboard.press('Space');
      await page.waitForTimeout(200);
      await page.keyboard.press('KeyE');
      const ok = await until('__game.state === "ending"', 'the ending', 20000);
      console.log('crypt:', ok ? 'out into the graveyard: ending' : 'NOT out', 'time left', await ev('__game.escape ? __game.escape.t.toFixed(1) : "-"'));
    }
  }
  console.log(errors.length ? errors.join('\n') : 'no page errors');
  await browser.close();
})();
