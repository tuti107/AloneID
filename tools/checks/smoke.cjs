// Release build smoke test (docs/index.html): title, the act break into
// Act II's hall, the map, and every later room built without errors.
//   node build.mjs && node tools/checks/smoke.cjs
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, 'out');
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.join(ROOT, 'docs/index.html'));
  await page.waitForTimeout(2000);
  const st0 = await page.evaluate(() => __game.state);
  await page.evaluate(() => {
    const g = __game;
    g.debugStart('cellar', 'fromCavern', { flags: { flameDrowned: true, 'unlocked:cellarDoor': true, 'dead:maid': true, 'dead:crawler1': true, 'dead:crawler2': true, 'visited:hall': true } });
    g.escape = { t: 50, total: 60 };
    g.debugAuto = { choices: [] };
    g.goTo('hall', 'fromCellar');
  });
  await page.waitForFunction(() => __game.act === 2 && __game.idle, null, { timeout: 60000 });
  await page.evaluate(() => { __game.debugAuto = null; });
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(600);
  const st = await page.evaluate(() => ({ act: __game.act, room: __game.room.id, modals: __game.modals.length }));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // the second act's newer rooms, built in the release bundle
  const seen = [];
  for (const id of ['gallery', 'chapel', 'conservatory', 'servants', 'boiler', 'tower', 'lamproom', 'nursery', 'graveyard', 'crypt', 'tidecave', 'gullcabin', 'shrine']) {
    await page.evaluate((id) => __game.debugStart(id, null, { flags: { act: 2, flameDrowned: true, claraTaken: true, towerLit: id === 'lamproom' } }), id);
    await page.waitForTimeout(700);
    seen.push(await page.evaluate(() => __game.room.id + ':' + __game.room.monsters.length));
  }
  console.log(st0, JSON.stringify(st), seen.join(' '), 'errors:', errs);
  await browser.close();
})();
