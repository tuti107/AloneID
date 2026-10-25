// 食堂 — the dinner that never ends. The guests detest noise, and they do
// not let you take anything from their table.
import * as F from '../furniture.js';
import { M, C } from '../mats.js';
import { angleDiff } from '../../engine/util.js';

const SEATS = [
  { x: -2.4, z: -1.0, rot: 0, dress: false, color: 0x8098c0 },
  { x: 0.0, z: -1.0, rot: 0, dress: true, color: 0x90a0d0 },
  { x: 2.4, z: 1.0, rot: Math.PI, dress: false, color: 0x7890b8, guard: { x: 4.4, z: 0 } },
  { x: -1.2, z: 1.0, rot: Math.PI, dress: true, color: 0x98a8d0 },
  { x: -3.55, z: 0, rot: Math.PI / 2, dress: false, color: 0xa0b0e0 },
];

export default {
  id: 'dining',
  name: '食堂',
  bounds: [-5.2, -3.2, 5.2, 3.2],
  floorType: 'wood',
  ambience: 'whispers',
  build(r, g) {
    const H = 3.4;
    // second act: the guests are gone, their chairs thrown down
    const act2 = g.act >= 2;
    if (act2) r.ambience = 'tide';
    r.shell(-5, -3, 5, 3, {
      h: H, floor: 'woodFloor', ceil: 'plasterDark', mat: 'wallpaperGreen', wainscot: 'wainscot', wainscotH: 1.0, crown: true,
      openings: { e: [{ at: 0, w: 1.7, h: 2.6 }], w: [{ at: -2.0, w: 1.0, h: 2.15 }], s: [{ at: -2.2, w: 1.1, h: 2.0, sill: 0.8 }, { at: 2.2, w: 1.1, h: 2.0, sill: 0.8 }] },
    });
    // the west door, to the portrait gallery: held shut until the house
    // shook in the night
    r.door(-5, -2.0, Math.PI / 2, {
      id: 'galleryDoor', to: 'gallery', entry: 'fromDining', label: '西の扉', wallMat: 'wallpaperGreen', panel: 'woodRed',
      locked: (gg) => gg.act < 2, lockedMsg: '扉の向こうに、何か重いものが寄りかかっているようだ。\nびくともしない。',
      onOpen: async (gg) => {
        if (gg.hasRoom('gallery')) return true;
        await gg.notYet();
        return false;
      },
    });
    r.entry('fromGallery', -4.35, -2.0, Math.PI / 2);
    F.rug(r, 'rugGreen', 0, 0, 7.2, 3.6);
    r.door(5, 0, -Math.PI / 2, { w: 1.7, h: 2.6, double: true, to: 'hall', entry: 'fromDining', label: '広間への扉', wallMat: 'wallpaperGreen', glass: true });
    r.entry('fromHall', 4.35, 0, -Math.PI / 2);
    for (const x of [-2.2, 2.2]) r.window(x, 3, Math.PI, { w: 1.1, h: 2.0, sill: 0.8, curtains: 'curtainRed', intensity: 45, shadow: x > 0 ? 'lo' : false });

    // long table
    const tbl = F.table({ w: 5.6, d: 1.3, h: 0.78, wood: 'woodRed', cloth: true });
    r.place(tbl, -0.6, 0, 0, { collide: true });
    let k = 0;
    for (const x of [-2.4, -1.2, 0.0, 1.2, 2.4]) {
      for (const [z, ry] of [[-1.0, 0], [1.0, Math.PI]]) {
        const occupied = SEATS.some((s) => Math.abs(s.x - x) < 0.1 && Math.abs(s.z - z) < 0.1);
        const ch = F.chair({ wood: 'woodRed', seat: 'velvet' });
        if (act2 && k++ % 3 !== 1) {
          // pushed back as they rose, some knocked over
          const over = k % 2 === 0;
          const zz = z * (over ? 1.75 : 1.4);
          r.place(ch, x + (k % 3) * 0.12 - 0.12, zz, ry + (k % 5) * 0.25 - 0.5, { collide: [0.5, 0.5] });
          if (over) { ch.rotation.x = -Math.sign(z) * 1.45; ch.position.y = 0.06; }
        } else r.place(ch, x, z * (occupied ? 1.02 : 1), ry, { collide: [0.45, 0.45] });
      }
    }
    // the host's chair, tucked in far enough to leave a way past the sideboard
    r.place(F.chair({ wood: 'woodRed', seat: 'velvet' }), -3.6, 0, Math.PI / 2, { collide: [0.45, 0.45] });
    // place settings
    for (const x of [-2.4, -1.2, 0.0, 1.2, 2.4]) {
      for (const z of [-0.42, 0.42]) {
        r.box(C(0xd8d4c8, { phong: true }), 0.24, 0.01, 0.24, x, 0.79, z, { cast: false });
        r.box(C(0x8a8a8a, { phong: true }), 0.02, 0.005, 0.18, x + 0.17, 0.79, z, { cast: false });
      }
    }
    r.box(C(0x5a0a0a), 0.5, 0.06, 0.3, 0.6, 0.79, 0);
    r.candles = [];
    for (const x of [-2.6, -0.6, 1.4]) {
      const cd = F.candelabra({ arms: 3, h: 0.45 });
      r.place(cd, x, 0, 0, { y: 0.79, cast: false });
      if (!act2) for (const f of cd.userData.flames) r.candles.push(r.flame(x + f[0], 0.79 + f[1], f[2], { size: 0.065, color: 0x9fc8ff, glow: 0x4080ff, lightColor: 0x6a9aff, light: f[0] === 0, intensity: 3.2, distance: 6, flicker: 0.4 }));
    }
    // sideboard holding the record
    const sb = F.counter({ w: 1.8, d: 0.55, h: 0.95, top: 'woodRed' });
    r.place(sb, -4.68, 0, Math.PI / 2, { collide: true });
    const mirror = F.painting({ w: 1.4, h: 0.9, art: 'seascape', frame: 'gold' });
    mirror.position.set(-4.97, 2.0, 0);
    mirror.rotation.y = Math.PI / 2;
    r.static.add(mirror);
    r.interact({
      id: 'sideboard', x: -4.05, z: 0.55, r: 0.45, label: '飾り棚',
      use: async (gg) => {
        if (gg.flags.recordTaken) { await gg.say('飾り棚には、銀食器が整然と並んでいるだけだ。'); return; }
        await gg.searchAnim();
        gg.flags.recordTaken = true;
        await gg.say('飾り棚の引き出しに、紙の袋に入ったレコード盤がしまわれていた。');
        await gg.give('record');
        if (!gg.flags.diningAngry) await theft(r, gg);
      },
    });
    r.place(F.fireplace({ w: 1.7, h: 1.25, stone: 'marble', lit: false }), 0.5, -2.75, 0, { collide: true });
    const pt = F.painting({ w: 0.7, h: 0.9, art: 'portraitOld' });
    pt.position.set(0.5, 2.25, -2.97);
    r.static.add(pt);
    const ch = F.chandelier({ r: 0.7, n: 6, drop: 0.9 });
    ch.position.set(-0.6, H, 0);
    r.static.add(ch);
    if (!act2) for (const f of ch.userData.flames) r.candles.push(r.flame(-0.6 + f[0], H + f[1], f[2], { size: 0.06, color: 0x9fc8ff, glow: 0x4080ff, light: false }));
    r.chandelierLight = r.point(-0.6, H - 1.2, 0, { color: 0x7090ff, intensity: act2 ? 0 : 6, distance: 9, flicker: 0.3 });
    F.cobweb(r, -4.95, H, -2.95, 0, 0.8);
    F.cobweb(r, 4.95, H, 2.95, Math.PI, 0.8);
    r.interact({
      id: 'table', x: 1.4, z: 0.0, r: 1.0, label: '食卓', enabled: (gg) => !gg.flags.diningAngry,
      use: (gg) => gg.say(gg.act >= 2 ? '食卓の客たちは、どこにもいない。\n濡れたテーブルクロスの上で、皿の上の海水がかすかに波打っている。' : '青白い客たちが、空の皿を前に静かに食事を続けている。\n銀器の触れ合う音だけが、かすかに聞こえる。'),
    });

    if (act2) {
      r.hemi(0x4a6488, 0x141a1c, 2.4);
      r.point(-0.6, 2.4, 0.4, { color: 0x6a84a8, intensity: 6, distance: 10 });
      r.ghosts = [];
      r.shot({ id: 'east', pos: [4.65, 2.9, -2.65], look: [-3.4, 0.7, 0.9], fov: 56, zone: [-5.2, -3.2, 0.2, 3.2] });
      r.shot({ id: 'west', pos: [-4.65, 2.9, 2.65], look: [3.4, 0.7, -0.9], fov: 56, zone: [0.2, -3.2, 5.2, 3.2] });
      return;
    }
    r.hemi(0x506090, 0x1a1410, 1.8);

    // seated, each turns its head to watch you within a couple of metres;
    // risen, they drift faster than you walk, slower than you run, and the
    // one nearest the doors keeps the way out
    r.ghosts = SEATS.map((s, i) => g.spawn(r, {
      id: 'diner' + i, type: 'ghost', x: s.x, z: s.z, rot: s.rot, dress: s.dress, color: s.color,
      seat: { x: s.x, z: s.z, rot: s.rot }, speed: 2.25 + i * 0.1, watch: 2.0, guard: s.guard,
    }));
    for (const gh of r.ghosts) { gh.pos.y = 0; gh.sync(); }

    r.shot({ id: 'east', pos: [4.65, 2.9, -2.65], look: [-3.4, 0.7, 0.9], fov: 56, zone: [-5.2, -3.2, 0.2, 3.2] });
    r.shot({ id: 'west', pos: [-4.65, 2.9, 2.65], look: [3.4, 0.7, -0.9], fov: 56, zone: [0.2, -3.2, 5.2, 3.2] });
  },

  setup(r, g) {
    if (g.act >= 2) return;
    // the guests are always seated again when you come back, candles lit
    g.flags.diningAngry = false;
    for (const gh of r.ghosts) gh.reseat();
    for (const c of r.candles) setLit(c, true);
    r.chandelierLight.userData.off = false;
  },

  async enter(r, g) {
    if (g.flags.diningSeen) return;
    g.flags.diningSeen = true;
    g.lock();
    g.cut({ pos: [3.9, 1.5, 1.6], look: [-2.0, 0.9, -0.4], fov: 50 });
    g.audio.sfx('sting');
    await g.wait(1.4);
    await g.say('長い食卓に、青白い人影がいくつも座っている……！');
    await g.say('彼らはこちらに目もくれず、静かに晩餐を続けている。\n……この静寂を、乱してはならない気がした。');
    await g.say('（走ったり、争ったりせず、ゆっくり歩こう）');
    g.cut(null);
    g.unlock();
  },

  onNoise(r, g, kind) {
    if (g.flags.diningAngry || g.act >= 2) return;
    g.notify(kind === 'run' ? '足音が、静寂を破った――！' : '物音が、静寂を破った――！', 2.4);
    g.audio.sfx('sting');
    wake(r, g);
  },
};

function setLit(c, on) {
  c.sprite.visible = c.glow.visible = on;
  if (c.light) c.light.userData.off = !on;
}

// The guests rise: silence, the candles gutter out, and every face tears
// open as they come for you.
function wake(r, g, o = {}) {
  g.flags.diningAngry = true;
  g.audio.setAmbience(null);
  const still = () => g.room === r && g.flags.diningAngry;
  if (!o.dark) {
    r.candles.forEach((c, i) => g.wait(0.04 * i).then(() => still() && setLit(c, false)));
    r.chandelierLight.userData.off = true;
  }
  r.ghosts.forEach((gh, i) => g.wait(i * 0.18).then(() => still() && gh.rise(o.riseT)));
}

// Taking the record from under their noses. The silverware falls silent,
// every head turns to you (further than a neck should), the candles die from
// the far end, and when you turn round the host is standing at your back.
async function theft(r, g) {
  const p = g.player, host = r.ghosts[4];
  const toward = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
  g.lock();
  g.flags.diningAngry = true;
  g.audio.setAmbience(null);
  p.rot = -Math.PI / 2;
  await g.wait(1.0);
  // just above your head, down the table: the heads turn up into the lens
  g.cut({ pos: [p.pos.x - 0.25, 2.05, p.pos.z - 0.1], look: [0.8, 0.9, 0], fov: 54 });
  for (const gh of r.ghosts) {
    gh.watch = 0;
    gh.lookAt = p.pos;
    gh.lookMax = 2.3;
    gh.lookRate = Math.abs(angleDiff(gh.rot, toward(gh.pos, p.pos))) / 1.6 + 0.01;
    g.audio.sfx('neckCreak', { at: gh.pos, vol: 0.6 });
  }
  await g.wait(2.3);
  const far = r.candles.slice().sort((a, b) => b.sprite.position.x - a.sprite.position.x);
  for (const c of far) {
    setLit(c, false);
    g.audio.sfx('candleOut', { at: c.sprite.position, vol: 0.5 });
    await g.wait(0.08);
  }
  r.chandelierLight.userData.off = true;
  await g.wait(1.0);
  // turn round: the host is up, looming over you
  host.setState('still');
  host.rot = toward(host.pos, p.pos);
  host.pos.y = 0.12;
  host.lookAt = null;
  host.look = 0;
  host.anim.play('loom', { fade: 0 });
  host.sync();
  p.rot = toward(p.pos, host.pos);
  // from beside you, so nothing hides its face
  const ux = Math.sin(p.rot), uz = Math.cos(p.rot);
  g.cut({ pos: [p.pos.x - ux * 0.35 - uz * 0.75, 1.6, p.pos.z - uz * 0.35 + ux * 0.75], look: [host.pos.x, 1.78, host.pos.z], fov: 50 });
  await g.wait(0.9);
  host.rise(1.2);
  g.audio.sfx('sting');
  g.flash(0.55, [0.7, 0.8, 1.0]);
  g.shake(0.08, 0.4);
  await g.wait(0.7);
  g.cut(null);
  g.notify('逃げろ――！', 2.2);
  wake(r, g, { dark: true, riseT: 1.0 });
  g.unlock();
}
