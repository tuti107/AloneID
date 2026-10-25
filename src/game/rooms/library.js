// 書斎 — Silas's library: books, a cursed tome, and a locked desk drawer.
import * as THREE from 'three';
import * as F from '../furniture.js';
import { M, C } from '../mats.js';
import { ITEMS } from '../items.js';

export default {
  id: 'library',
  name: '書斎',
  bounds: [-4.2, -3.7, 4.2, 3.7],
  floorType: 'wood',
  ambience: 'fire',
  build(r, g) {
    const H = 3.4;
    r.shell(-4, -3.5, 4, 3.5, {
      h: H, floor: 'woodFloor', ceil: 'plasterDark', mat: 'wallpaperGold', wainscot: 'wainscot', wainscotH: 0.9, crown: true,
      openings: { n: [{ at: -2.5, w: 1.0, h: 2.15 }], s: [{ at: 1.5, w: 1.2, h: 1.8, sill: 0.8 }] },
    });
    F.rug(r, 'rugRed', 0.2, 0.1, 4.2, 3.2);
    r.door(-2.5, -3.5, 0, { to: 'corridor', entry: 'fromLibrary', label: '廊下への扉', wallMat: 'wallpaperGold' });
    r.entry('fromCorridor', -2.5, -2.9, 0);
    r.window(1.5, 3.5, Math.PI, { w: 1.2, h: 1.8, sill: 0.8, curtains: 'curtainGreen', intensity: 55, shadow: 'lo' });

    // shelves
    const shelf = (x, z, ry, w = 1.8, h = 2.7, books = 'books') => r.place(F.bookshelf({ w, h, d: 0.42, books }), x, z, ry, { collide: true });
    shelf(-3.78, -2.0, Math.PI / 2);
    shelf(-3.78, 0.0, Math.PI / 2, 1.8, 2.7, 'books2');
    shelf(-3.78, 2.0, Math.PI / 2);
    shelf(3.78, -2.45, -Math.PI / 2, 1.5);
    shelf(3.78, 2.45, -Math.PI / 2, 1.5, 2.7, 'books2');
    shelf(1.2, -3.28, 0, 1.6, 2.7, 'books2');
    shelf(3.0, -3.28, 0, 1.4);
    shelf(-2.3, 3.28, Math.PI, 1.8);
    const bookInfo = (id, x, z, text) => r.interact({ id, x, z, r: 0.6, label: '本棚', use: (gg) => gg.say(text) });
    r.interact({ id: 'genealogy', x: -3.35, z: -2.0, r: 0.6, label: '本棚', use: async (gg) => {
      const c = await gg.ask('革装丁の『アシュコム家の系譜』がある。読みますか？', ['読む', 'やめる']);
      if (c === 0) await gg.readDoc('genealogy');
    } });
    r.interact({ id: 'folklore', x: -3.35, z: 0.0, r: 0.6, label: '本棚', use: async (gg) => {
      const c = await gg.ask('栞の挟まった『南洋諸島の伝承』がある。読みますか？', ['読む', 'やめる']);
      if (c === 0) await gg.readDoc('folklore');
    } });
    bookInfo('books3', -3.35, 2.0, '民俗学の専門書がぎっしりと並んでいる。\nどの背表紙も、海と、海に棲むものの名を冠している。');
    bookInfo('books4', 3.35, -2.45, '航海日誌の写しや、古い海図の束。\n《黒鴎号》の名が、何度も目につく。');
    bookInfo('books5', 3.35, 2.45, '詩集と小説の棚。エレノア夫人の蔵書だろうか、楽譜も混じっている。');

    // fireplace (east wall)
    const fp = F.fireplace({ w: 1.9, h: 1.35, stone: 'marble' });
    r.place(fp, 3.75, 0, -Math.PI / 2, { collide: true });
    for (const [dx, s] of [[0, 0.32], [0.18, 0.22], [-0.2, 0.24]]) r.flame(3.72, 0.3, dx, { size: s, light: dx === 0, intensity: 16, distance: 9, flicker: 0.35, shadow: dx === 0 ? 'lo' : false, lightColor: 0xff7a30 });
    const mirror = F.painting({ w: 1.0, h: 0.7, art: 'seascape', frame: 'gold' });
    mirror.position.set(3.97, 2.05, 0);
    mirror.rotation.y = -Math.PI / 2;
    r.static.add(mirror);
    r.interact({ id: 'fire', x: 3.1, z: 0, r: 0.5, label: '暖炉', use: (gg) => gg.say('暖炉で火が燃えている。\n……主のいない屋敷で、誰が薪をくべたのだろう。') });
    r.interact({ id: 'seascape', x: 3.0, z: 0.0, r: 0.3, reach: 0.4, label: '絵画', enabled: () => false });
    r.pickup('poker', 3.55, 0.02, 1.15, {
      label: '火かき棒',
      model: () => { const m = ITEMS.poker.model(); m.rotation.set(0, 0, 0.25); return m; },
      onTake: async (gg) => {
        if (!gg.inv.equipped) {
          gg.equip('poker');
          await gg.say('火かき棒を構えた。\n（持ち物画面で装備を切り替えられる）');
        }
      },
    });

    // desk with a locked drawer
    r.place(F.desk({ w: 1.5, d: 0.75 }), -0.8, 1.55, 0, { collide: true });
    r.place(F.chair({ wood: 'woodRed', seat: 'leather' }), 0.25, 2.45, -0.5, { collide: [0.45, 0.45] });
    const lamp = F.candelabra({ arms: 1, h: 0.3 });
    r.place(lamp, -1.3, 1.4, 0, { y: 0.78, cast: false });
    r.flame(-1.3, 0.78 + lamp.userData.flames[0][1], 1.4, { size: 0.06, intensity: 2.5, distance: 6 });
    r.box(M('paper', { ts: [0.2, 0.25] }), 0.25, 0.004, 0.3, -0.5, 0.78, 1.45, { ry: -0.4, cast: false });
    r.box(C(0x1a1a1a), 0.06, 0.12, 0.06, -0.1, 0.78, 1.35);
    r.interact({
      id: 'drawer', x: -0.8, z: 2.05, r: 0.55, label: '机の引き出し',
      verb: (gg) => (gg.flags.drawerOpen ? '調べる' : '開ける'),
      use: async (gg) => {
        if (gg.flags.drawerOpen) { await gg.say('引き出しの中は、もう空だ。'); return; }
        if (!gg.has('brassKey')) { gg.audio.sfx('locked'); await gg.say('引き出しには鍵がかかっている。\n小さな真鍮の鍵穴がある。'); return; }
        await openDrawer(gg);
      },
      item: async (gg, id) => {
        if (id !== 'brassKey') return false;
        if (gg.flags.drawerOpen) { await gg.say('引き出しは、もう開いている。'); return true; }
        await openDrawer(gg);
        return true;
      },
    });

    // the cursed book on a lectern
    r.place(F.pedestal({ h: 1.0 }), 2.9, 2.75, 0, { collide: true });
    const book = new THREE.Group();
    F.bx(book, C(0x0a0a0a), 0.22, 0.03, 0.3, -0.11, 0, 0, 0, 0, 0.12);
    F.bx(book, C(0x0a0a0a), 0.22, 0.03, 0.3, 0.11, 0, 0, 0, 0, -0.12);
    F.bx(book, C(0x8a9a80), 0.2, 0.02, 0.28, -0.1, 0.02, 0, 0, 0, 0.12);
    F.bx(book, C(0x8a9a80), 0.2, 0.02, 0.28, 0.1, 0.02, 0, 0, 0, -0.12);
    r.place(book, 2.9, 2.75, -0.4, { y: 1.0 });
    const glow = r.point(2.9, 1.3, 2.75, { color: 0x50ff90, intensity: 0.6, distance: 2.5, flicker: 0.4, speed: 3 });
    void glow;
    r.interact({
      id: 'shadowBook', x: 2.9, z: 2.75, r: 0.45, label: '黒い革の本',
      use: async (gg) => {
        await gg.say('黒い革の本が、書見台の上に開かれている。\nページは湿り、かすかに潮の匂いがする。');
        await gg.readDoc('shadow');
      },
    });

    r.place(F.armchair({ fabric: 'leather' }), 2.15, -1.25, Math.PI / 2 - 0.3, { collide: [0.8, 0.8] });
    r.place(F.sideTable({ s: 0.5, h: 0.62 }), 2.55, -2.25, 0, { collide: [0.45, 0.45] });
    r.place(F.globe(), -2.6, -1.4, 0.3, { collide: true });
    F.cobweb(r, -3.95, H, 3.45, Math.PI / 2, 0.7);
    F.cobweb(r, 3.95, H, -3.45, -Math.PI / 2, 0.8);

    r.hemi(0x5a6a90, 0x2a1a0c, 2.0);

    if (!g.flags['dead:libGhoul']) {
      g.spawn(r, { id: 'libGhoul', type: 'ghoul', x: 3.25, z: 1.5, rot: -Math.PI / 2 - 0.4, dormant: true, onDeath: () => { g.flags['dead:libGhoul'] = true; } });
    }

    r.shot({ id: 'north', pos: [-3.65, 3.05, 3.15], look: [2.0, 0.6, -1.9], fov: 58, zone: [-4.2, -3.7, 4.2, -0.2] });
    r.shot({ id: 'south', pos: [3.65, 3.05, -3.15], look: [-1.9, 0.5, 2.0], fov: 58, zone: [-4.2, -0.2, 4.2, 3.7] });
    r.shot({ id: 'fire', pos: [-0.6, 1.35, -0.7], look: [3.9, 0.9, 0.4], fov: 46, zone: [2.3, -1.0, 4.2, 1.6], priority: 1 });
  },

  update(r, g) {
    const gh = r.monsters.find((m) => m.id === 'libGhoul');
    if (gh && gh.state === 'dormant') {
      const d = Math.hypot(g.player.pos.x - gh.pos.x, g.player.pos.z - gh.pos.z);
      if (d < 2.8 || g.flags.drawerOpen || g.flags['taken:poker']) {
        gh.wake();
        g.audio.sfx('ghoulNotice', { at: gh.pos });
      }
    }
  },
};

async function openDrawer(g) {
  await g.searchAnim();
  g.flags.drawerOpen = true;
  g.audio.sfx('unlock');
  await g.say('真鍮の鍵で引き出しを開けた。');
  await g.give('bedroomKey');
  await g.give('notes');
  const c = await g.ask('覚え書きを読みますか？', ['読む', 'あとで']);
  if (c === 0) await g.readDoc('notes');
}
