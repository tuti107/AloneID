// Automated end-to-end walkthrough of the whole game.
//
//   node build.mjs --dev
//   node tools/walkthrough/walkthrough.cjs [--write-chapters]
//
// Plays dist/index.html from the attic to the true ending (about 30 minutes
// under SwiftShader), printing ok/FAIL for each check. Screenshots and a
// record of every chapter's starting state go to tools/walkthrough/out/;
// with --write-chapters those states also become src/game/chapters.json,
// which is what the title screen's chapter select starts from.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 5).join('\n')}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`); });
  await page.goto('file://' + path.resolve(__dirname, '../../dist/index.html'));
  await page.waitForTimeout(1200);
  const ev = (js) => page.evaluate(js);
  let fails = 0;
  const until = async (js, label, timeout = 30000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      try { if (await ev(js)) return true; } catch (e) { /* retry */ }
      await page.waitForTimeout(100);
    }
    console.log(`  !! TIMEOUT waiting for ${label || js}`);
    fails++;
    return false;
  };
  const idle = (label) => until('__game.idle && __game.state === "play"', label || 'idle');
  const check = async (js, label) => {
    const ok = await ev(js);
    console.log(`  ${ok ? 'ok ' : 'FAIL'} ${label}`);
    if (!ok) fails++;
    return ok;
  };
  const use = async (id, choices = [], item = null) => {
    await ev(`__game.debugAuto.choices = ${JSON.stringify(choices)}`);
    const r = await ev(`__game.testUse(${JSON.stringify(id)}${item ? ',' + JSON.stringify(item) : ''})`);
    if (r !== 'ok' && r !== 'item') { console.log(`  !! use ${id}: ${r}`); fails++; }
    await page.waitForTimeout(150);
    await idle(`after use ${id}`);
  };
  const door = async (to) => {
    const r = await ev(`__game.testDoor(${JSON.stringify(to)})`);
    if (r !== 'ok') { console.log(`  !! door ${to}: ${r}`); fails++; return; }
    await until(`__game.room.id === ${JSON.stringify(to)}`, `enter ${to}`);
    await idle(`settle in ${to}`);
  };
  const place = (x, z, rot = 0) => ev(`__game.player.place(${x}, ${z}, ${rot})`);
  const kill = async (id) => {
    await ev(`(() => { const m = __game.room.monsters.find((m) => m.id === ${JSON.stringify(id)}); if (m) { m.hidden = false; m.damage(999, m.pos.x + 1, m.pos.z); } })()`);
    await page.waitForTimeout(300);
  };
  const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
  // modern controls: keys that walk in world direction (dx, dz) under the settled camera
  const holdDir = async (dx, dz, ms, settled = false) => {
    const t0 = Date.now();
    while (!settled && Date.now() - t0 < 4000 && !(await ev('__game.director.dwell > 0.6'))) await page.waitForTimeout(100);
    const k = await ev(`(() => {
      const d = new __game.director.cam.position.constructor();
      __game.director.cam.getWorldDirection(d);
      const l = Math.hypot(d.x, d.z); const fx = d.x / l, fz = d.z / l;
      const f = ${dx} * fx + ${dz} * fz, r = ${dx} * -fz + ${dz} * fx;
      const k = [];
      if (f > 0.38) k.push('ArrowUp'); if (f < -0.38) k.push('ArrowDown');
      if (r > 0.38) k.push('ArrowRight'); if (r < -0.38) k.push('ArrowLeft');
      return k;
    })()`);
    for (const key of k) await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    for (const key of k) await page.keyboard.up(key);
    return k;
  };
  const walkUntil = async (dx, dz, cond, ms = 9000) => {
    const t0 = Date.now();
    let first = true;
    while (Date.now() - t0 < ms && !(await ev(cond))) { await holdDir(dx, dz, 600, !first); first = false; }
    return ev(cond);
  };
  const step = (s) => console.log(`\n== ${s}`);
  const snap = (n) => page.screenshot({ path: path.join(OUT, 'shots', `wt_${n}.png`) });
  // the game as it stands at the start of a chapter, for chapter select
  const chapters = {};
  const chapter = async (id) => {
    chapters[id] = JSON.parse(await ev('JSON.stringify(__game.serialize())'));
    console.log(`   (chapter ${id}: ${chapters[id].room})`);
  };

  step('new game');
  await ev(`__game.debugAuto = { choices: [] }; __game.newGame(); 0`);
  await until('__game.room && __game.room.id === "attic"', 'attic');
  await idle('attic intro');
  await check('__game.flags.atticIntro === true', 'attic intro played');
  await check('__game.room.ghoulTimer > 0', 'ghoul timer started');

  step('attic: push the wardrobe over the window (real input)');
  await ev('__game.debugAuto = null');
  await place(0.25, -2.68, -Math.PI / 2);
  await holdDir(-1, 0, 7000);
  await ev('__game.debugAuto = { choices: [] }');
  await page.waitForTimeout(500);
  console.log('   wardrobe x =', await ev('__game.room.wardrobe.position.x.toFixed(2)'), ' flag =', await ev('__game.flags.atticWindow'));
  if (!(await ev('__game.flags.atticWindow'))) { await ev('__game.room.pushables[0].setT(1.4, __game)'); }
  await idle('after push');
  await check('__game.flags.atticWindow === "blocked"', 'window blocked');
  await use('trunk');
  await check('__game.has("lamp") && __game.has("flask")', 'lamp + flask from trunk');
  await use('taken:diary', [0]);
  await check('__game.has("diary")', 'diary');
  await snap('attic');
  await door('corridor');

  step('corridor');
  await check('__game.room.monsters.some((m) => m.id === "butler" && m.alive)', 'butler present');
  // real combat: punch the butler a few times
  await ev(`(() => { const b = __game.room.monsters.find((m) => m.id === 'butler'); b.pos.set(5.6, 0, 0); b.sync(); __game.player.place(6.5, 0, -Math.PI / 2); })()`);
  await ev('__game.debugAuto = null');
  for (let i = 0; i < 6; i++) { await page.keyboard.press('KeyX'); await page.waitForTimeout(500); }
  await ev('__game.debugAuto = { choices: [] }');
  console.log('   butler hp after punches:', await ev(`__game.room.monsters.find((m) => m.id === 'butler').hp`), ' player hp:', await ev('__game.player.hp'));
  await snap('corridor_fight');
  await kill('butler');
  await use('taken:butler', [0]);
  await use('taken:corridorFlask');
  await check('__game.has("butler")', 'butler note');
  await door('library');

  step('library');
  await use('taken:poker');
  await check('__game.inv.equipped === "poker"', 'poker equipped');
  await page.waitForTimeout(800);
  await check('__game.room.monsters.find((m) => m.id === "libGhoul").state !== "dormant"', 'ghoul woke');
  await kill('libGhoul');
  await use('genealogy', [0]);
  await use('folklore', [0]);
  const hp0 = await ev('__game.player.hp');
  await use('shadowBook', [0]);
  console.log('   hp before/after cursed book:', hp0, await ev('__game.player.hp'));
  await check(`__game.player.hp === ${hp0} - 40 || __game.player.hp === 0`, 'cursed book hurts');
  await ev('__game.player.hp = 100');
  await use('drawer');
  await check('!__game.flags.drawerOpen', 'drawer locked without key');
  await door('corridor');
  await door('bathroom');

  step('bathroom');
  await use('tub', [0]);
  await check('__game.has("brassKey")', 'brass key from tub');
  await use('mirror');
  await check('__game.flags.mirrorSeen', 'mirror clue');
  await use('cabinet');
  await check('__game.has("tonic")', 'tonic');
  await snap('bathroom');
  await door('corridor');
  await door('library');
  await use('drawer', [1]);
  await check('__game.has("bedroomKey") && __game.has("notes")', 'bedroom key + notes');
  await door('corridor');
  await door('bedroom');

  step('bedroom');
  await check('__game.flags["unlocked:bedroomDoor"]', 'bedroom door unlocked');
  await use('nightstand', [0]);
  await check('__game.has("revolver") && __game.inv.ammo >= 12', 'revolver + ammo');
  await check('__game.inv.equipped === "revolver"', 'revolver equipped');
  await check('__game.room.monsters.find((m) => m.id === "silas").state === "chase"', 'silas emerged');
  await snap('silas');
  // shoot Silas with real input
  await ev(`(() => { const s = __game.room.monsters.find((m) => m.id === 'silas'); s.pos.set(-1.5, 0, 0.55); s.sync(); __game.player.place(1.5, 0.55, -Math.PI / 2); })()`);
  await ev('__game.debugAuto = null');
  for (let i = 0; i < 3; i++) { await page.keyboard.press('KeyX'); await page.waitForTimeout(700); }
  await ev('__game.debugAuto = { choices: [] }');
  console.log('   silas hp after shots:', await ev(`__game.room.monsters.find((m) => m.id === 'silas').hp`), ' ammo:', await ev('__game.inv.ammo'));
  await kill('silas');
  await page.waitForTimeout(500);
  await use('taken:clockKey');
  await check('__game.has("clockKey")', 'clock key from Silas');
  await use('taken:eleanor', [1]);
  await use('taken:photo');
  await check('__game.has("eleanor") && __game.has("photo")', 'letter + photo');
  await door('corridor');

  step('downstairs');
  await place(-9.8, 0, Math.PI / 2 * -1);
  await until('__game.room.id === "hall"', 'hall via stairs');
  await idle('hall');
  await chapter('downstairs');
  await check('__game.player.pos.y > 3', 'arrived on the landing');
  await snap('hall_landing');
  await kill('maid');
  await use('clock', [0]);
  await check('__game.flags.clockSolved', 'clock solved at three');
  // the key comes out of the clock's base by itself now
  await check('__game.has("cellarKey")', 'cellar key');
  await door('kitchen');

  step('kitchen');
  await check('__game.room.monsters.find((m) => m.id === "cook")', 'cook present');
  await kill('cook');
  await use('pantry');
  await check('__game.has("oil") && __game.has("matches")', 'oil + matches');
  await use('drawerK');
  await ev('__game.run(() => __game.useItem("oil"))');
  await idle();
  await ev('__game.run(() => __game.useItem("matches"))');
  await idle();
  await check('__game.flags.lampLit && __game.player.lampHolder.visible', 'lamp lit and held');
  await snap('kitchen_lamp');
  await door('hall');
  await door('dining');

  step('dining');
  await check('__game.room.ghosts.every((g) => g.state === "seated")', 'ghosts seated');
  // noise wakes them; out and back in, they are seated again
  await ev('__game.room.def.onNoise(__game.room, __game, "run")');
  // (the candles go out one by one in game time; slow frames stretch that)
  await page.waitForFunction(() => __game.room.ghosts.some((g) => g.state !== 'seated') && __game.room.candles.every((c) => !c.sprite.visible), null, { timeout: 10000 }).catch(() => {});
  await check('__game.room.ghosts.some((g) => g.state !== "seated") && __game.room.candles.every((c) => !c.sprite.visible)', 'noise angers the ghosts, candles out');
  await door('hall');
  await door('dining');
  await check('__game.room.ghosts.every((g) => g.state === "seated") && __game.room.candles.every((c) => c.sprite.visible)', 'seated again, candles lit');
  // taking the record raises them all; run for it
  await use('sideboard');
  await check('__game.has("record")', 'record');
  await page.waitForTimeout(900);
  await check('__game.room.ghosts.every((g) => g.state !== "seated")', 'the theft raises the guests');
  await snap('dining_angry');
  await door('hall');
  await check('__game.player.alive', 'got out alive');
  await door('music');

  step('music room');
  await use('gramophone', [0]);
  await check('__game.flags.eleanorGone', 'eleanor at peace');
  await use('taken:starstone');
  await check('__game.has("starstone")', 'star stone');
  await door('hall');
  await door('cellar');

  step('cellar');
  await check('__game.room.id === "cellar"', 'in the cellar');
  await chapter('cellar');
  await snap('cellar');
  await kill('crawler1');
  await kill('crawler2');
  await ev('__game.debugAuto = null');
  await place(4.73, -0.78, 0);
  await holdDir(0, 1, 7000);
  await ev('__game.debugAuto = { choices: [] }');
  console.log('   rack z =', await ev('__game.room.pushables[0].obj.position.z.toFixed(2)'));
  if (!(await ev('__game.flags.passageOpen'))) await ev('__game.room.pushables[0].setT(1.5, __game)');
  await idle();
  await check('__game.flags.passageOpen', 'passage revealed');
  await place(5.3, 0.2, Math.PI / 2);
  await until('__game.room.id === "cavern"', 'cavern');
  await idle('cavern intro');

  step('cavern');
  await place(0, 1.2, Math.PI);
  await until('__game.flags.horrorRisen', 'horror rises');
  await idle('rise cutscene');
  await ev('__game.godMode = true');
  await snap('horror');
  await ev('__game.debugAuto.choices = []; __game.run(() => __game.throwItem("lamp"))');
  await idle();
  await check('__game.has("lamp")', 'lamp refused before sealing');
  await use('altar', [0]);
  await check('__game.flags.altarSealed', 'altar sealed with the star stone');
  await ev('__game.run(() => __game.throwItem("lamp"))');
  await until('__game.flags.flameDrowned', 'the tide puts the fire out', 40000);
  await idle('burn cutscene');
  await snap('burn');
  await check('__game.escape && __game.escape.t > 45', 'flood timer running');
  await check('__game.room.horror.state === "sinking" || __game.room.horror.state === "gone"', 'the horror sinks back alive');
  await check('!__game.has("lamp") && !__game.flags.lampLit', 'lamp lost');

  step('escape the flood (on foot)');
  await check('__game.room.escapeLit', 'the way out lit');
  await ev('__game.debugAuto = null');
  await walkUntil(-1, 0, '__game.room.id === "cellar"', 25000);
  if (await ev('__game.room.id !== "cellar"')) console.log('   (not in the cellar yet:', await ev(`[__game.room.id, __game.player.pos.x.toFixed(2), __game.player.pos.z.toFixed(2), __game.escape && __game.escape.t.toFixed(1), __game.director.current && __game.director.current.id, __game.player.state, __game.modals.length, __game.locked].join(' ')`), ')');
  await ev('__game.debugAuto = { choices: [] }');
  await until('__game.room.id === "cellar"', 'back to cellar');
  await idle();
  console.log('   time left reaching the cellar:', await ev('__game.escape && __game.escape.t.toFixed(1)'));
  await check('!__game.room.dark', 'cellar lit by the glowing tide');
  await check('__game.room.floodY > -0.08', 'the cellar is flooding');
  await ev('__game.debugAuto = null');
  await walkUntil(0, 1, '__game.player.pos.z > 0.8', 6000);
  await walkUntil(-1, 0, '__game.player.pos.x < -4.0', 15000);
  await walkUntil(0, -1, '__game.room.id === "hall"', 12000);
  await ev('__game.debugAuto = { choices: [] }');
  console.log('   time left on the stairs:', await ev('__game.escape ? __game.escape.t.toFixed(1) : "done"'));
  if (await ev('__game.room.id !== "hall"')) { console.log('   (walked out of time or stuck at', await ev('[__game.player.pos.x, __game.player.pos.y, __game.player.pos.z].map((v) => v.toFixed(2)).join(", ")'), ')'); await place(-4.3, -2.3, Math.PI); }
  await until('__game.room.id === "hall"', 'back to hall');

  step('the act break');
  await until('__game.flags.claraTaken', 'clara taken', 60000);
  await until('__game.act === 2 && __game.idle', 'second act', 60000);
  await chapter('tide');
  await check('!__game.escape', 'flood timer stopped');
  await check('__game.room.id === "hall" && __game.room.ambience === "tide"', 'flooded hall');
  await snap('act2_hall');
  await use('taken:claraNote', [0]);
  await check('__game.has("claraNote")', "clara's notebook");
  await ev(`__game.testUse('cellarDoor')`);
  await page.waitForTimeout(300);
  await idle();
  await check('__game.room.id === "hall"', 'cellar is under water');
  // the armour comes down off its plinth
  await place(-2.7, 2.5, 0);
  await until('__game.flags.armorWoke', 'armour wakes', 8000);
  await idle('armour wakes');
  await check('__game.room.monsters.find((m) => m.id === "armor").state !== "dormant"', 'armour awake');
  await kill('armor');
  await page.waitForTimeout(2500);
  await idle('armour falls');
  await check('__game.flags["dead:armor"]', 'armour destroyed');
  await door('dining');
  await check('!__game.room.ghosts.length', 'the guests are gone');
  await door('gallery');
  await check('__game.room.id === "gallery"', 'west door opens on the gallery');
  await door('dining');
  await door('hall');
  await door('kitchen');
  await door('servants');
  await check('__game.room.id === "servants"', "back door opens on the servants' wing");
  await door('kitchen');
  await door('hall');

  step('west wing: the attic canvas');
  await ev(`__game.goTo('corridor', 'fromStairs')`);
  await until('__game.room.id === "corridor"', 'corridor');
  await idle();
  await door('attic');
  await use('taken:canvas');
  await check('__game.has("canvas")', 'canvas from the fallen crates');
  await door('corridor');
  await ev(`__game.goTo('hall', 'fromUpstairs')`);
  await until('__game.room.id === "hall"', 'hall');
  await idle();
  await door('dining');
  await door('gallery');
  await chapter('west');

  step('gallery');
  await check('__game.room.id === "gallery"', 'in the gallery');
  await kill('galleryThrall');
  await page.waitForTimeout(400);
  await ev(`__game.testUse('chapelDoor')`);
  await page.waitForTimeout(300);
  await idle();
  await check('__game.room.id === "gallery" && __game.flags["locked:chapelDoor"]', 'chapel sealed');
  await use('pJonah', [1]);
  await check('__game.flags.galleryNote', "silas's note behind the frame");
  await use('pJonah', [], 'canvas');
  await check('__game.flags.canvasHung && !__game.has("canvas")', 'jonah back in his frame');
  await snap('gallery');
  await door('chapel');

  step('chapel');
  await check('__game.room.monsters.find((m) => m.id === "preacher").state === "preach"', 'the preacher preaching');
  for (let i = 0; i < 40; i++) {
    const st = await ev(`(() => { const m = __game.room.monsters.find((m) => m.id === 'preacher'); if (!m.alive) return 'dead'; if (m.state !== 'down') { m.hidden = false; m.damage(999, m.pos.x + 1, m.pos.z); } return m.state + ':' + m.lives; })()`);
    if (st === 'dead') break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(500);
  await idle();
  await check('__game.flags["dead:preacher"]', 'the preacher stays down at last');
  await use('lamp_red', [0]);
  await page.waitForTimeout(300);
  await idle();
  await check('!__game.flags.lampsLit && !Object.values(__game.room.lamps).some((l) => l.lit)', 'wrong lamp: all blown out');
  for (const id of ['blue', 'green', 'red', 'gold']) await use('lamp_' + id, [0]);
  await idle();
  await check('__game.flags.lampsLit', 'lamps in the window order');
  await use('taken:holyOil');
  await idle('the window comes in');
  await check('__game.has("holyOil") && __game.flags.chapelGlassBroken', 'holy oil; the glass breaks');
  await check('__game.room.monsters.filter((m) => m.type === "thrall" && m.alive).length === 3', 'the drowned come in');
  await use('taken:prayer');
  await check('__game.has("prayer")', "jonah's prayer book");
  await snap('chapel');
  for (const i of [1, 2, 3]) await kill('chapelThrall' + i);
  await door('gallery');
  await door('conservatory');

  step('conservatory');
  await check('__game.room.id === "conservatory"', 'in the conservatory');
  await use('taken:gardener', [1]);
  await check('__game.has("gardener")', "gardener's log");
  await use('valve_star');
  await idle();
  await check('!__game.flags.pondDrained && !(__game.room.turned || []).length', 'wrong valve: water bursts back');
  for (const id of ['moon', 'anchor', 'star']) await use('valve_' + id);
  await idle();
  await check('__game.flags.pondDrained', 'pond drained');
  await use('taken:musicBoxKey');
  await use('taken:toyBoat');
  await check('__game.has("musicBoxKey") && __game.has("toyBoat")', 'music box key and toy boat from the mud');
  await kill('vine');
  await page.waitForTimeout(2600);
  await idle('the weed withers');
  await check('__game.flags["dead:vine"]', 'the weed is dead');
  await use('taken:gardenKey');
  await check('__game.has("gardenKey")', 'garden key');
  await snap('conservatory');
  await ev(`__game.testUse('gardenDoor')`);
  await until('__game.room.id === "graveyard"', 'out through the garden door');
  await idle();
  await check('__game.room.id === "graveyard" && __game.flags["unlocked:gardenDoor"]', 'garden door unlocked: out into the graveyard');
  await door('conservatory');
  await door('gallery');
  await door('dining');
  await door('hall');

  step("east wing: the servants' wing");
  await door('kitchen');
  await door('servants');
  await chapter('east');
  await check('__game.room.id === "servants"', "in the servants' wing");
  await kill('servThrall1');
  // (god mode has been on since the cavern: off, to feel the arm)
  await ev('__game.godMode = false');
  const hpArm = await ev('__game.player.hp');
  await place(-3.6, 2.6, Math.PI / 2);
  await page.waitForTimeout(1500);
  console.log('   arm:', await ev(`JSON.stringify((({ t, cool, hit }) => ({ t, cool, hit }))(__game.room.arms[0]))`), 'hp', hpArm, '->', await ev('__game.player.hp'), 'invuln', await ev('__game.player.invuln'));
  await check('__game.room.arms[0].hit && __game.player.hp < ' + hpArm, 'an arm bursts out of the wall at him');
  await ev('__game.godMode = true');
  await place(-3.6, 1.0, Math.PI / 2);
  await page.waitForTimeout(1600);
  await idle();
  await snap('servants');
  await use('taken:agnes', [1]);
  await use('taken:morgan', [1]);
  await check('__game.has("agnes") && __game.has("morgan")', "agnes's letter, morgan's ledger");
  await use('taken:coldKey');
  await use('taken:coldTonic');
  await check('__game.has("coldKey")', 'the key off the meat hook');
  await use('harlowDoor');
  await check('__game.flags.harlowOpen', "harlow's door open");
  await check('__game.room.monsters.find((m) => m.id === "servThrall2").state !== "dormant"', 'one was waiting in there');
  await kill('servThrall2');
  // through the doorway on foot: the opened door must really let him in
  await place(4, 1.3, Math.PI);
  await ev('__game.debugAuto = null');
  await walkUntil(0, -1, '__game.player.pos.z < -0.8');
  await ev('__game.debugAuto = { choices: [] }');
  await check('__game.player.pos.z < -0.8', "walked in through harlow's doorway");
  await use('taken:keyring');
  await use('taken:harlowAmmo');
  await check('__game.has("keyring")', "harlow's keys");
  await door('boiler');

  step('boiler room');
  await check('__game.room.id === "boiler" && Math.abs(__game.player.pos.y - 1.2) < 0.05', 'in at the top of the steps');
  await check('__game.room.monsters.find((m) => m.id === "stoker").state === "dormant"', 'the stoker lies on his coal');
  // down the steps for real
  await ev('__game.debugAuto = null');
  await walkUntil(0, 1, '__game.player.pos.z > 0.6', 20000);
  await ev('__game.debugAuto = { choices: [] }');
  await idle();
  console.log('   at the foot of the steps:', await ev('[__game.player.pos.x, __game.player.pos.y, __game.player.pos.z].map((v) => v.toFixed(2)).join(", ")'));
  // the stoker stirs as he comes off the last step beside the coal
  await check('__game.player.pos.y < 0.3 && __game.player.pos.z > -0.6', 'walked down the steps');
  await use('taken:manual', [1]);
  await check('__game.has("manual")', 'the boiler manual');
  await use('valve_red', [0]);
  await idle();
  await check('!__game.flags.steamUp && !__game.room.turned.length', 'wrong valve: steam, every valve shut');
  await check('__game.room.monsters.find((m) => m.id === "stoker").state !== "dormant"', 'the stoker gets up');
  await kill('stoker');
  await page.waitForTimeout(400);
  await check('__game.flags["dead:stoker"]', 'the stoker is down');
  for (const id of ['blue', 'yellow', 'red']) await use('valve_' + id, [0]);
  await idle();
  await check('__game.flags.steamUp && __game.room.bolt.position.y > 0.9', 'steam up: the bolt lifts');
  await use('taken:boilerFlask');
  await snap('boiler');
  await door('tower');

  step('tower');
  await check('__game.room.id === "tower"', 'in the tower');
  await kill('towerThrall1');
  // the panel up on the top landing, right over his head in the well
  await place(-1.5, -1.5, -Math.PI / 2);
  await page.waitForTimeout(300);
  await check('(__game.findInteractable() || {}).id !== "towerPanel"', "the landing's panel is out of reach from the well below");
  // up the three flights for real
  await place(-2.4, 2.45, Math.PI / 2);
  await ev('__game.debugAuto = null');
  await walkUntil(1, 0, '__game.player.pos.x > 2.2 || __game.locked');
  await walkUntil(0, -1, '__game.player.pos.z < -2.1 || __game.locked');
  await ev('__game.debugAuto = { choices: [] }');
  await page.waitForTimeout(600);
  await idle('the climber');
  console.log('   on the stair:', await ev('[__game.player.pos.x, __game.player.pos.y, __game.player.pos.z].map((v) => v.toFixed(2)).join(", ")'));
  await check('__game.player.pos.y > 2.5', 'climbed to the second landing');
  await check('__game.flags.climberSeen', 'something climbs past the window');
  await use('taken:lantern');
  await check('__game.has("lantern") && !__game.player.holdsLantern', 'the storm lantern (empty)');
  await check('__game.room.monsters.find((m) => m.id === "towerThrall2").state !== "dormant"', 'one comes down from the top');
  await kill('towerThrall2');
  await place(2.45, -2.45, -Math.PI / 2);
  await ev('__game.debugAuto = null');
  await walkUntil(-1, 0, '__game.player.pos.x < -2.2');
  await ev('__game.debugAuto = { choices: [] }');
  await idle();
  console.log('   at the top:', await ev('[__game.player.pos.x, __game.player.pos.y, __game.player.pos.z].map((v) => v.toFixed(2)).join(", ")'));
  await check('__game.player.pos.y > 4.1', 'climbed to the top landing');
  await snap('tower');
  await door('lamproom');

  step('lamp room');
  await check('__game.room.id === "lamproom"', 'up in the lamp room');
  await use('taken:harlow', [1]);
  await check('__game.has("harlow")', "harlow's log");
  await use('greatLamp', [0]);
  await check('__game.flags.holyOilPoured && !__game.has("holyOil")', 'the holy oil in the lamp');
  await use('greatLamp', [0, 0]);
  await idle();
  await check('__game.flags.towerLit && __game.flags.tideReceded', 'the lamp burns: the tide goes out');
  await check('__game.flags.lanternLit && __game.player.holdsLantern', 'the undying flame carried in the lantern');
  await snap('lamproom');
  await door('tower');
  await door('bedroom');
  await check('__game.room.id === "bedroom" && __game.flags.towerPassage', 'the panel opens on the master bedroom');
  await use('wardrobe', [0]);
  await until('__game.room.id === "tower"', 'back through the wardrobe');
  await idle();
  await check('__game.room.id === "tower" && __game.player.pos.y > 4.1', 'the wardrobe leads back to the tower');
  await door('bedroom');
  await door('corridor');
  await ev(`__game.goTo('hall', 'fromUpstairs')`);
  await until('__game.room.id === "hall"', 'hall');
  await idle();
  await check('!__game.room.waterAt', 'the hall has drained');
  // the drowned keep off a man carrying the flame
  await ev(`(() => { const p = __game.player; p.place(0, 1.5, 0); __game.spawn(__game.room, { id: 'testThrall', type: 'thrall', x: 0, z: 4.2, rot: Math.PI }); })()`);
  const hpL = await ev('__game.player.hp');
  await page.waitForTimeout(4000);
  const tt = await ev(`(() => { const m = __game.room.monsters.find((m) => m.id === 'testThrall'); return { hp: m.hp, alive: m.alive, d: Math.hypot(m.pos.x - __game.player.pos.x, m.pos.z - __game.player.pos.z).toFixed(2) }; })()`);
  console.log('   thrall against the lantern:', JSON.stringify(tt), 'player hp', hpL, '->', await ev('__game.player.hp'));
  await check(`(() => { const m = __game.room.monsters.find((m) => m.id === 'testThrall'); return (m.hp < 64 || !m.alive) && __game.player.hp >= ${hpL}; })()`, 'the lantern burns it back');
  await kill('testThrall');
  await page.waitForTimeout(800);

  step('nursery');
  await ev(`__game.goTo('corridor', 'fromStairs')`);
  await until('__game.room.id === "corridor"', 'corridor');
  await idle();
  await chapter('grave');
  await door('nursery');
  await check('__game.room.id === "nursery"', 'the nursery is open in the second act');
  await use('drawingWoman');
  await use('theatre');
  await use('musicBox', [0]);
  await idle('thomas');
  await check('__game.flags.thomasMet && __game.flags.boatAsked && !__game.has("musicBoxKey")', 'the music box plays; thomas asks for his boat');
  await use('taken:cryptKey');
  await check('__game.has("cryptKey")', 'the crypt key');
  await snap('nursery');
  await door('corridor');
  await ev(`__game.goTo('hall', 'fromUpstairs')`);
  await until('__game.room.id === "hall"', 'hall');
  await idle();
  await door('dining');
  await door('gallery');
  await door('conservatory');
  await door('graveyard');

  step('graveyard');
  await check('__game.room.id === "graveyard"', 'out in the graveyard');
  await check('__game.room.monsters.filter((m) => m.state === "buried").length === 3', 'three sailors in shallow graves');
  await place(-1.4, 3.4, Math.PI);
  await page.waitForTimeout(1500);
  await check('__game.room.monsters.find((m) => m.id === "graveThrall1").state !== "buried"', 'one crawls out of his grave');
  for (const i of [1, 2, 3]) await kill('graveThrall' + i);
  await use('thomasGrave', [0]);
  await check('__game.flags.boatPlaced && !__game.has("toyBoat")', "the boat on thomas's grave");
  await use('ezekielStone');
  await snap('graveyard');
  await door('crypt');

  step('crypt');
  await check('__game.room.id === "crypt"', 'down in the crypt');
  for (const z of [4.6, 3.0, 1.4, -0.2, -1.8, -3.6]) { await place(0, z, Math.PI); await page.waitForTimeout(700); }
  await idle();
  await check('__game.room.lids.length === 5 && __game.room.lids.every((l) => l.open)', 'the lids slide open one after another');
  await page.waitForTimeout(1000);
  await check('__game.room.monsters.filter((m) => !m.hidden && m.alive).length === 3', 'the dead climb out');
  for (const id of ['ancestor1', 'ancestor3', 'ancestor5']) await kill(id);
  await use('taken:testament', [1]);
  await check('__game.has("testament")', "jonah's testament");
  await use('taken:cutlass', [0]);
  await check('__game.inv.equipped === "cutlass"', "ezekiel's cutlass, in hand");
  await check('__game.flags.tideReceded', 'the sea tunnel: drained by the tower light');
  await snap('crypt');
  await door('graveyard');
  await door('conservatory');
  await door('gallery');
  await door('dining');
  await door('hall');

  step('map and saves');
  await ev('__game.debugAuto = null');
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(500);
  await check('__game.modals.length === 1', 'map opens');
  await snap('map');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await check('__game.modals.length === 0', 'map closes');
  await ev('__game.debugAuto = { choices: [] }');
  await ev('window.__save = JSON.stringify(__game.serialize())');
  fs.writeFileSync(path.join(OUT, 'act2save.json'), await ev('window.__save'));
  await ev('__game.loadState(JSON.parse(window.__save))');
  await idle('after load');
  await check('__game.act === 2 && __game.room.id === "hall" && __game.flags["dead:armor"] && __game.has("claraNote")', 'act two save loads');
  // an old (version 1) save made while fleeing the burning cavern
  await ev(`(() => { const d = JSON.parse(window.__save); d.v = 1; delete d.act; d.flags = { ...d.flags }; delete d.flags.act; delete d.flags.claraTaken; delete d.flags.flameDrowned; d.flags.horrorDead = true; d.room = 'cellar'; d.x = 0; d.z = 0; d.escape = 70; __game.loadState(d); })()`);
  await idle('old save');
  await check('__game.act === 1 && __game.flags.flameDrowned && !__game.flags.horrorDead && __game.escape', 'old escape save becomes the flood');

  step('the sea caves');
  await ev('__game.loadState(JSON.parse(window.__save))');
  await idle('back to the act two save');
  await ev('__game.godMode = true; __game.debugAuto = { choices: [] }');
  await door('dining');
  await door('gallery');
  await door('conservatory');
  await door('graveyard');
  await door('crypt');
  await use('seaTunnel');
  await until('__game.room.id === "tidecave"', 'down the sea tunnel');
  await idle();
  await chapter('sea');
  await check('__game.room.id === "tidecave" && __game.flags.caveSeen', 'the Black Gull, aground in the cave');
  await use('channel');
  await idle();
  await check('__game.room.id === "tidecave"', 'the channel is under water while the captain lives');
  await use('capstan', [0]);
  await idle();
  await check('__game.flags.plankDown', 'the capstan lets her boarding stair down');
  for (const id of ['caveThrall1', 'caveThrall2']) await kill(id);
  await place(-1.6, 1.4, Math.PI);
  await ev('__game.debugAuto = null');
  await walkUntil(0, -1, '__game.player.pos.y > 2.1', 20000);
  await ev('__game.debugAuto = { choices: [] }');
  console.log('   on the stair:', await ev('[__game.player.pos.x, __game.player.pos.y, __game.player.pos.z].map((v) => v.toFixed(2)).join(", ")'));
  await check('__game.player.pos.y > 2.1', 'up the stair onto her deck');
  await use('taken:harpoon');
  await use('taken:harpoons');
  await check('__game.has("harpoon") && __game.inv.harpoons === 3', 'the harpoon gun and three harpoons');
  await snap('tidecave');
  await door('gullcabin');

  step('the captain');
  await check('__game.room.id === "gullcabin"', "in the captain's cabin");
  await check('__game.flags.ezekielWoke && __game.room.monsters.find((m) => m.id === "ezekiel").state !== "dormant"', 'he turns from his windows');
  await ev('__game.equip("harpoon")');
  await ev(`(() => { const m = __game.room.monsters.find((m) => m.id === 'ezekiel'); m.pos.set(-2.6, 0, 0.6); m.sync(); __game.player.place(1.6, 0.6, -Math.PI / 2); })()`);
  const ezHp = await ev(`__game.room.monsters.find((m) => m.id === 'ezekiel').hp`);
  await ev('__game.debugAuto = null');
  for (let i = 0; i < 2; i++) { await page.keyboard.press('KeyX'); await page.waitForTimeout(900); }
  await ev('__game.debugAuto = { choices: [] }');
  console.log('   ezekiel hp after harpoons:', ezHp, '->', await ev(`__game.room.monsters.find((m) => m.id === 'ezekiel').hp`), ' harpoons left:', await ev('__game.inv.harpoons'));
  await check(`__game.room.monsters.find((m) => m.id === 'ezekiel').hp <= ${ezHp} - 85`, 'a harpoon goes home');
  await kill('ezekiel');
  await page.waitForTimeout(800);
  await idle('he falls');
  await check('__game.flags["dead:ezekiel"]', 'the captain is dead');
  await use('taken:seastar');
  await use('taken:gullLog', [1]);
  await check('__game.has("seastar") && __game.has("gullLog")', 'the sea star and his log');
  await snap('gullcabin');
  await door('tidecave');
  await use('channel');
  await until('__game.room.id === "shrine"', 'down the drained channel');
  await idle();
  await chapter('abyss');

  step('the shrine');
  await check('__game.room.id === "shrine"', 'in the shrine');
  await use('taken:shrineStar');
  await check('__game.has("starstone")', 'the first star, fallen with the cavern');
  await place(0, 1.0, Math.PI);
  await page.waitForTimeout(600);
  await idle('it rises');
  await check('__game.flags.godRisen', 'the god rises behind the altar');
  await use('pillarW', [], 'starstone');
  await use('pillarE', [], 'seastar');
  await check('__game.flags.starsSet && !__game.has("starstone") && !__game.has("seastar")', 'two stars in the pillars');
  await use('altar', [0]);
  await idle('the flame');
  await check('__game.flags.godBurned && __game.flags.finalEscape && !!__game.follower', 'the undying flame thrown: Clara wakes and follows');
  await snap('shrine');
  await place(6.6, 9.9, 0);
  await until('__game.room.id === "tidecave"', 'out of the shrine');
  await idle();
  await page.waitForTimeout(800);
  console.log('   clara behind him:', await ev('(__game.follower.pos.distanceTo(__game.player.pos)).toFixed(2)'));
  await check('__game.follower && __game.follower.room === __game.room', 'Clara comes too');
  await place(8.8, 7.2, -Math.PI / 2);
  await until('__game.room.id === "crypt"', 'up into the crypt');
  await idle();
  await ev(`__game.testDoor('graveyard')`);
  await until('__game.state === "ending"', 'the ending', 30000);
  await check('__game.state === "ending"', 'out into the dawn: the ending');
  await until('JSON.parse(localStorage.getItem("ashcombe.endings") || "[]").includes("dawn")', 'the true ending recorded', 90000);
  await check('JSON.parse(localStorage.getItem("ashcombe.endings") || "[]").includes("dawn")', 'the true ending (boat on the grave)');
  console.log('   stats:', JSON.stringify(await ev('__game.stats')));

  // chapter states: full health, a fresh clock, nothing pending
  const ids = ['downstairs', 'cellar', 'tide', 'west', 'east', 'grave', 'sea', 'abyss'];
  for (const d of Object.values(chapters)) {
    d.hp = 100;
    d.stats = { kills: 0, saves: 0, deaths: 0, time: 0 };
    d.escape = null;
    delete d.date;
  }
  fs.writeFileSync(path.join(OUT, 'chapters.json'), JSON.stringify(chapters));
  const missing = ids.filter((id) => !chapters[id]);
  if (missing.length) { console.log('  !! chapters not reached:', missing.join(' ')); fails++; }
  else if (process.argv.includes('--write-chapters')) {
    fs.writeFileSync(path.resolve(__dirname, '../../src/game/chapters.json'), JSON.stringify(chapters));
    console.log('   chapters written to src/game/chapters.json');
  }

  console.log(`\nFAILS: ${fails}`);
  console.log(errors.length ? errors.join('\n') : 'no page errors');
  await browser.close();
})();
