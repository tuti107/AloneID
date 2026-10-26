// Start the game from every chapter in chapter select, as a player would
// from the title screen, and check each lands in the right place, playable.
//
//   node build.mjs --dev && node tools/walkthrough/chapters.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'out', 'chapters');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../../dist/index.html'));
  await page.waitForTimeout(1500);
  const ev = (js) => page.evaluate(js);
  let fails = 0;
  const check = async (js, label) => {
    const ok = await ev(js);
    console.log(`  ${ok ? 'ok ' : 'FAIL'} ${label}`);
    if (!ok) fails++;
  };
  const chapters = await ev(`__game.chapters.map((c) => ({ id: c.id, title: c.title, room: c.state && c.state.room }))`);
  for (const [i, ch] of chapters.entries()) {
    if (ch.id === 'storm') continue;
    if (!ch.room) { console.log(`  FAIL ${ch.title}: no recorded state`); fails++; continue; }
    await ev(`__game.toTitle()`);
    await page.waitForTimeout(400);
    await ev(`__game.debugAuto = { choices: [] }; __game.startChapter(${JSON.stringify(ch.id)})`);
    await page.waitForFunction(() => __game.state === 'play' && __game.idle, null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(800);
    console.log(`\n== ${ch.title}`);
    await check(`__game.room && __game.room.id === ${JSON.stringify(ch.room)}`, `starts in ${ch.room}`);
    await check(`__game.player.alive && __game.player.hp === __game.player.maxHp`, 'alive, full health');
    await check(`__game.state === 'play' && !__game.escape`, 'playing, no countdown running');
    await page.screenshot({ path: path.join(OUT, `${String(i).padStart(2, '0')}_${ch.id}.png`) });
  }
  console.log(`\nFAILS: ${fails}`);
  console.log(errors.length ? errors.join('\n') : 'no page errors');
  await browser.close();
})();
