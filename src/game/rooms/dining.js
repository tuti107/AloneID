// 食堂 — the dinner that never ends. The guests detest noise.
import * as F from '../furniture.js';
import { M, C } from '../mats.js';

const SEATS = [
  { x: -2.4, z: -1.0, rot: 0, dress: false, color: 0x8098c0 },
  { x: 0.0, z: -1.0, rot: 0, dress: true, color: 0x90a0d0 },
  { x: 2.4, z: 1.0, rot: Math.PI, dress: false, color: 0x7890b8 },
  { x: -1.2, z: 1.0, rot: Math.PI, dress: true, color: 0x98a8d0 },
  { x: -3.75, z: 0, rot: Math.PI / 2, dress: false, color: 0xa0b0e0 },
];

export default {
  id: 'dining',
  name: '食堂',
  bounds: [-5.2, -3.2, 5.2, 3.2],
  floorType: 'wood',
  ambience: 'whispers',
  build(r, g) {
    const H = 3.4;
    r.shell(-5, -3, 5, 3, {
      h: H, floor: 'woodFloor', ceil: 'plasterDark', mat: 'wallpaperGreen', wainscot: 'wainscot', wainscotH: 1.0, crown: true,
      openings: { e: [{ at: 0, w: 1.7, h: 2.6 }], s: [{ at: -2.2, w: 1.1, h: 2.0, sill: 0.8 }, { at: 2.2, w: 1.1, h: 2.0, sill: 0.8 }] },
    });
    F.rug(r, 'rugGreen', 0, 0, 7.2, 3.6);
    r.door(5, 0, -Math.PI / 2, { w: 1.7, h: 2.6, double: true, to: 'hall', entry: 'fromDining', label: '広間への扉', wallMat: 'wallpaperGreen', glass: true });
    r.entry('fromHall', 4.35, 0, -Math.PI / 2);
    for (const x of [-2.2, 2.2]) r.window(x, 3, Math.PI, { w: 1.1, h: 2.0, sill: 0.8, curtains: 'curtainRed', wallMat: 'wallpaperGreen', intensity: 45, shadow: x > 0 ? 'lo' : false });

    // long table
    const tbl = F.table({ w: 5.6, d: 1.3, h: 0.78, wood: 'woodRed', cloth: true });
    r.place(tbl, -0.6, 0, 0, { collide: true });
    for (const x of [-2.4, -1.2, 0.0, 1.2, 2.4]) {
      for (const [z, ry] of [[-1.0, 0], [1.0, Math.PI]]) {
        const occupied = SEATS.some((s) => Math.abs(s.x - x) < 0.1 && Math.abs(s.z - z) < 0.1);
        const ch = F.chair({ wood: 'woodRed', seat: 'velvet' });
        r.place(ch, x, z * (occupied ? 1.02 : 1), ry, { collide: [0.45, 0.45] });
      }
    }
    r.place(F.chair({ wood: 'woodRed', seat: 'velvet' }), -3.8, 0, Math.PI / 2, { collide: [0.45, 0.45] });
    // place settings
    for (const x of [-2.4, -1.2, 0.0, 1.2, 2.4]) {
      for (const z of [-0.42, 0.42]) {
        r.box(C(0xd8d4c8, { phong: true }), 0.24, 0.01, 0.24, x, 0.79, z, { cast: false });
        r.box(C(0x8a8a8a, { phong: true }), 0.02, 0.005, 0.18, x + 0.17, 0.79, z, { cast: false });
      }
    }
    r.box(C(0x5a0a0a), 0.5, 0.06, 0.3, 0.6, 0.79, 0);
    for (const x of [-2.6, -0.6, 1.4]) {
      const cd = F.candelabra({ arms: 3, h: 0.45 });
      r.place(cd, x, 0, 0, { y: 0.79, cast: false });
      for (const f of cd.userData.flames) r.flame(x + f[0], 0.79 + f[1], f[2], { size: 0.065, color: 0x9fc8ff, glow: 0x4080ff, lightColor: 0x6a9aff, light: f[0] === 0, intensity: 3.2, distance: 6, flicker: 0.4 });
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
      },
    });
    r.place(F.fireplace({ w: 1.7, h: 1.25, stone: 'marble', lit: false }), 0.5, -2.75, 0, { collide: true });
    const pt = F.painting({ w: 0.7, h: 0.9, art: 'portraitOld' });
    pt.position.set(0.5, 2.25, -2.97);
    r.static.add(pt);
    const ch = F.chandelier({ r: 0.7, n: 6, drop: 0.9 });
    ch.position.set(-0.6, H, 0);
    r.static.add(ch);
    for (const f of ch.userData.flames) r.flame(-0.6 + f[0], H + f[1], f[2], { size: 0.06, color: 0x9fc8ff, glow: 0x4080ff, light: false });
    r.point(-0.6, H - 1.2, 0, { color: 0x7090ff, intensity: 6, distance: 9, flicker: 0.3 });
    F.cobweb(r, -4.95, H, -2.95, 0, 0.8);
    F.cobweb(r, 4.95, H, 2.95, Math.PI, 0.8);
    r.interact({ id: 'table', x: 1.4, z: 0.0, r: 1.0, label: '食卓', enabled: (gg) => !gg.flags.diningAngry, use: (gg) => gg.say('青白い客たちが、空の皿を前に静かに食事を続けている。\n銀器の触れ合う音だけが、かすかに聞こえる。') });

    r.hemi(0x506090, 0x1a1410, 1.8);

    r.ghosts = SEATS.map((s, i) => g.spawn(r, {
      id: 'diner' + i, type: 'ghost', x: s.x, z: s.z, rot: s.rot, dress: s.dress, color: s.color,
      seat: { x: s.x, z: s.z, rot: s.rot }, speed: 1.45 + i * 0.08,
    }));
    for (const gh of r.ghosts) { gh.pos.y = 0; gh.sync(); }

    r.shot({ id: 'east', pos: [4.65, 2.9, -2.65], look: [-3.4, 0.7, 0.9], fov: 56, zone: [-5.2, -3.2, 0.2, 3.2] });
    r.shot({ id: 'west', pos: [-4.65, 2.9, 2.65], look: [3.4, 0.7, -0.9], fov: 56, zone: [0.2, -3.2, 5.2, 3.2] });
  },

  setup(r, g) {
    // the guests are always seated again when you come back
    g.flags.diningAngry = false;
    for (const gh of r.ghosts) gh.reseat();
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
    g.cut(null);
    g.unlock();
  },

  onNoise(r, g, kind) {
    if (g.flags.diningAngry) return;
    g.flags.diningAngry = true;
    g.notify(kind === 'run' ? '足音が、静寂を破った――！' : '物音が、静寂を破った――！', 2.4);
    for (const gh of r.ghosts) gh.rise();
    g.audio.sfx('sting');
  },
};
