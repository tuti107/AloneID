// Captain Ezekiel: shot down he kneels and stands again; only the cutlass
// ends him. Real input for the shots and the cut.
//   node build.mjs --dev && node tools/checks/captain.cjs
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, 'out');
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errors = [], says = [];
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 5).join('\n')}`));
  await page.goto('file://' + path.join(ROOT, 'dist/index.html'));
  await page.waitForTimeout(1200);
  const ev = (js) => page.evaluate(js);
  const until = async (js, label, timeout = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) { try { if (await ev(js)) return true; } catch (e) { /* */ } await page.waitForTimeout(100); }
    console.log('  !! TIMEOUT', label); return false;
  };
  const check = async (js, label) => { const ok = await ev(js); console.log(`  ${ok ? 'ok ' : 'FAIL'} ${label}`); return ok; };
  const EZ = `__game.room.monsters.find((m) => m.id === 'ezekiel')`;
  await ev(`__game.debugAuto = { choices: [] }; __game.log = (k, t) => { (window.__says = window.__says || []).push(t); }; __game.startChapter('sea'); 0`);
  await until('__game.room && __game.room.id === "tidecave" && __game.idle', 'tide cave');
  const run = async (withCutlass) => {
    console.log(withCutlass ? '\n== revolver, the cutlass in his bag' : '\n== revolver, no cutlass');
    await ev(`(() => { const g = __game; g.flags.plankDown = true; if (!${withCutlass}) g.inv.remove('cutlass'); g.inv.ammo = 60; g.godMode = true; g.run(() => g.goTo('gullcabin', 'fromDeck')); })()`);
    await until('__game.room.id === "gullcabin" && __game.idle', 'cabin', 30000);
    await ev(`(() => { const g = __game; g.equip('revolver'); for (const m of g.room.monsters) if (m.id !== 'ezekiel') m.die(); const m = ${EZ}; m.pos.set(-2.6, 0, 0.6); m.sync(); g.player.place(1.6, 0.6, -Math.PI / 2); window.__says = []; })()`);
    // shoot until he goes down
    for (let i = 0; i < 30 && !(await ev(`${EZ}.state === 'down'`)); i++) {
      await ev(`__game.player.rot = Math.atan2(${EZ}.pos.x - __game.player.pos.x, ${EZ}.pos.z - __game.player.pos.z)`);
      await page.keyboard.press('KeyX');
      await page.waitForTimeout(500);
      if (await ev('__game.room.monsters.filter((m) => m.alive && m.id !== "ezekiel").length')) await ev(`for (const m of __game.room.monsters) if (m.id !== 'ezekiel' && m.alive) m.die()`);
    }
    await check(`${EZ}.alive && ${EZ}.state === 'down'`, 'shot down, he only kneels');
    await until('__game.idle', 'idle after kneel');
    await page.waitForTimeout(600);
    await page.locator('#view').screenshot({ path: `${OUT}/kneel_${withCutlass ? 'c' : 'n'}.png` });
    console.log('   said:', JSON.stringify(await ev('window.__says.slice(-1)')));
    // walk up to him and see what the action button would do
    await ev(`(() => { const g = __game, m = ${EZ}; g.player.place(m.pos.x + 1.2, m.pos.z + 0.2, Math.atan2(-1.2, -0.2)); })()`);
    await page.waitForTimeout(300);
    const prompt = await ev('__game.ui.promptText');
    console.log('   prompt beside him:', prompt);
    if (withCutlass) {
      await check(`/斬る.*膝をついた船長/.test(__game.ui.promptText)`, 'the action is to cut him');
      await check(`__game.inv.equipped === 'revolver'`, 'still holding the revolver');
      await page.keyboard.press('Space');
      await page.waitForTimeout(1500);
      await until('__game.idle', 'idle after the cut');
      await check(`!${EZ}.alive && __game.flags['dead:ezekiel'] && __game.inv.equipped === 'cutlass'`, 'cut with his own blade, he dies');
      await check(`__game.room.interactables.some((i) => i.id === 'taken:seastar')`, 'the star rolls out');
    } else {
      await check(`/調べる.*膝をついた船長/.test(__game.ui.promptText)`, 'no blade: the action is only to look');
      await page.keyboard.press('Space');
      await page.waitForTimeout(400);
      await until('__game.idle', 'idle after looking');
      console.log('   said:', JSON.stringify(await ev('window.__says.slice(-1)')));
      await until(`${EZ}.state !== 'down'`, 'he stands', 12000);
      await check(`${EZ}.alive && ${EZ}.hp > 50 && !__game.room.interactables.some((i) => i.id === 'ezekielDown')`, 'and the sea stands him up again');
      await page.waitForTimeout(500);
      await page.locator('#view').screenshot({ path: `${OUT}/stood.png` });
    }
  };
  await run(false);
  // fresh: the chapter again, cutlass kept
  await ev(`__game.debugAuto = { choices: [] }; __game.startChapter('sea'); 0`);
  await until('__game.room && __game.room.id === "tidecave" && __game.idle', 'tide cave again');
  await run(true);
  console.log(errors.length ? errors.join('\n') : 'no page errors');
  await browser.close();
})();
