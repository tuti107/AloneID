// 主寝室 — Silas's bedroom. Something is waiting in the wardrobe.
import * as F from '../furniture.js';
import { M, C } from '../mats.js';

export default {
  id: 'bedroom',
  name: '主寝室',
  bounds: [-3.7, -3.2, 3.7, 3.2],
  floorType: 'carpet',
  ambience: 'house',
  build(r, g) {
    const H = 3.2;
    r.shell(-3.5, -3, 3.5, 3, {
      h: H, floor: 'woodFloor', ceil: 'plaster', mat: 'wallpaperBlue', wainscot: 'wainscot', wainscotH: 0.95, crown: true,
      openings: { s: [{ at: 1.8, w: 1.0, h: 2.15 }], e: [{ at: -1.6, w: 1.0, h: 1.7, sill: 0.8 }] },
    });
    F.rug(r, 'rugBlue', 0, 0.4, 3.4, 2.6);
    r.door(1.8, 3, Math.PI, { to: 'corridor', entry: 'fromBedroom', label: '廊下への扉', wallMat: 'wallpaperBlue' });
    r.entry('fromCorridor', 1.8, 2.4, Math.PI);
    r.window(3.5, -1.6, -Math.PI / 2, { w: 1.0, h: 1.7, sill: 0.8, curtains: 'curtainGreen', intensity: 60, shadow: 'hi' });

    r.place(F.bed({ w: 1.7, l: 2.15 }), 0, -1.88, 0, { collide: true });
    r.interact({ id: 'bed', x: 0, z: -0.6, r: 0.7, label: '寝台', use: (gg) => gg.say('天蓋付きの大きな寝台。シーツは乱れたままだ。\n枕には、塩の結晶のような白い染みがこびりついている。') });
    r.place(F.nightstand(), -1.32, -2.62, 0, { collide: true });
    r.place(F.nightstand(), 1.32, -2.62, 0, { collide: true });
    const cnd = F.candle({ h: 0.14 });
    r.place(cnd, -1.25, -2.65, 0, { y: 0.68, cast: false });
    r.flame(-1.25, 0.68 + 0.15, -2.65, { size: 0.07, intensity: 3.5, distance: 7, shadow: 'lo' });
    r.pickup('photo', -1.42, 0.69, -2.55, { ry: 0.3, label: '写真立て' });
    r.interact({
      id: 'nightstand', x: 1.32, z: -2.05, r: 0.45, label: 'ナイトテーブル',
      verb: (gg) => (gg.flags.gunTaken ? '調べる' : '開ける'),
      use: async (gg) => {
        if (gg.flags.gunTaken) { await gg.say('引き出しの中は、もう空だ。'); return; }
        await gg.searchAnim();
        gg.flags.gunTaken = true;
        await gg.say('引き出しの奥に、回転式拳銃と弾の箱がしまわれていた。');
        await gg.give('revolver');
        gg.inv.ammo += 6;
        await gg.give('ammo', { count: 6 });
        if (!gg.inv.equipped || gg.inv.equipped === 'poker') {
          const c = await gg.ask('拳銃を装備しますか？', ['装備する', 'そのまま']);
          if (c === 0) gg.equip('revolver');
        }
        await silasEmerges(r, gg);
      },
    });

    const wardrobe = F.wardrobe({ w: 1.3, h: 2.2, d: 0.6, wood: 'woodRed' });
    r.place(wardrobe, -3.17, 0.55, Math.PI / 2, { collide: true, dyn: true });
    r.wardrobe = wardrobe;
    if (g.flags.silasOut) wardrobe.userData.setOpen(1);
    // its back opens on a passage to the tower, from the tower's side
    r.entry('fromTower', -2.45, 0.55, Math.PI / 2);
    if (g.flags.towerPassage) r.box('#050403', 0.012, 1.55, 0.95, -2.866, 0.28, 0.55, { cast: false });
    r.interact({
      id: 'wardrobe', x: -2.55, z: 0.55, r: 0.6, label: (gg) => (gg.flags.towerPassage ? '隠し通路' : '洋服箪笥'),
      verb: (gg) => (gg.flags.towerPassage ? '入る' : '調べる'),
      use: async (gg) => {
        if (gg.flags.towerPassage) {
          const c = await gg.ask('洋服箪笥の奥の隠し通路を抜けて、塔へ行きますか？', ['行く', 'やめる']);
          if (c === 0) await gg.goTo('tower', 'fromBedroom', { fadeOut: 0.5 });
          return;
        }
        if (gg.act >= 2) { await gg.say('扉の壊れた洋服箪笥。奥の板の隙間から、冷たい風が吹き込んでくる。\n……板は、向こう側から留められているようだ。'); return; }
        if (gg.flags.silasOut) { await gg.say('扉の壊れた洋服箪笥。中には、すえた臭いだけが残っている。'); return; }
        gg.audio.sfx('knock', { at: { x: -3.1, y: 1, z: 0.55 } });
        await gg.say('洋服箪笥の中から……コツン、と音がした。\n扉は、内側から押さえつけられたように開かない。');
      },
    });

    const dresser = F.dresser({ w: 1.25 });
    r.place(dresser, 3.24, 0.85, -Math.PI / 2, { collide: true });
    r.pickup('eleanor', 3.2, 0.96, 0.6, {
      ry: 0.5, label: '手紙',
      onTake: async (gg) => { const c = await gg.ask('手紙を読みますか？', ['読む', 'あとで']); if (c === 0) await gg.readDoc('eleanor'); },
    });
    r.box('brass', 0.14, 0.08, 0.1, 3.25, 0.95, 1.2);
    r.interact({ id: 'dresser', x: 2.65, z: 1.2, r: 0.4, label: '鏡台', use: (gg) => gg.say('鏡台の上に、エレノア夫人の宝石箱。中身は空っぽだ。\n鏡に映る部屋は、なぜか本物より少しだけ暗い。') });

    r.place(F.armchair({ fabric: 'velvet' }), -2.55, 2.25, Math.PI * 0.8, { collide: [0.8, 0.8] });
    r.place(F.sideTable({ s: 0.45, h: 0.6 }), -1.55, 2.55, 0, { collide: [0.4, 0.4] });
    const p = F.painting({ w: 0.7, h: 0.9, art: 'portraitWoman' });
    p.position.set(0.0, 2.45, -2.98);
    r.static.add(p);
    F.cobweb(r, -3.45, H, -2.95, 0, 0.7);

    r.hemi(0x5a6890, 0x22180e, 2.0);

    if (!g.flags['dead:silas']) {
      const s = g.spawn(r, {
        id: 'silas', type: 'silas', x: -2.75, z: 0.55, rot: Math.PI / 2, dormant: true,
        onDeath: (m) => {
          g.flags['dead:silas'] = true;
          g.flags.silasKeyPos = [+m.pos.x.toFixed(2), +m.pos.z.toFixed(2)];
          dropKey(r, g);
        },
      });
      if (!g.flags.silasOut) { s.hidden = true; s.root.visible = false; s.solid = false; }
    } else dropKey(r, g);

    r.shot({ id: 'se', pos: [3.25, 2.95, 2.75], look: [-1.7, 0.6, -1.5], fov: 58, zone: [-3.7, -3.2, 1.0, 1.4] });
    r.shot({ id: 'nw', pos: [-3.3, 2.9, -0.55], look: [1.9, 0.5, 2.4], fov: 60, zone: [[-3.7, 1.4], [3.7, 1.4], [3.7, 3.2], [-3.7, 3.2]] });
    r.shot({ id: 'sw', pos: [-3.25, 2.95, 2.75], look: [1.9, 0.6, -1.5], fov: 58, zone: [1.0, -3.2, 3.7, 1.4] });
  },
};

function dropKey(r, g) {
  if (!g.flags.silasKeyPos || g.flags['taken:clockKey']) return;
  const [x, z] = g.flags.silasKeyPos;
  r.pickup('clockKey', x + 0.25, 0.03, z, { label: 'サイラスの亡骸', r: 0.5,
    before: async (gg) => { await gg.say('サイラスの首に掛けられた紐に、真鍮の鍵が結わえてある。'); },
  });
}

async function silasEmerges(r, g) {
  if (g.flags.silasOut) return;
  g.flags.silasOut = true;
  const s = r.monsters.find((m) => m.id === 'silas');
  g.lock();
  g.audio.sfx('knock', { at: { x: -3.1, y: 1, z: 0.55 } });
  await g.wait(0.5);
  g.cut({ pos: [0.2, 1.5, 2.2], look: [-3.0, 1.1, 0.5], fov: 44 });
  g.audio.sfx('knock', { at: { x: -3.1, y: 1, z: 0.55 } });
  await g.wait(0.7);
  g.audio.sfx('bang');
  g.audio.sfx('sting');
  g.shake(0.12, 0.4);
  const w = r.wardrobe;
  const st = { v: 0 };
  const iv = setInterval(() => w.userData.setOpen(st.v), 16);
  await g.tween(st, 'v', 1, 0.18);
  clearInterval(iv);
  w.userData.setOpen(1);
  if (s) {
    s.hidden = false;
    s.root.visible = true;
    s.solid = true;
    s.pos.set(-2.55, 0, 0.55);
    s.rot = Math.PI / 2;
    s.sync();
    s.setState('chase');
    s.attackCd = 1.5;
  }
  g.audio.sfx('zombieNotice');
  await g.wait(0.9);
  await g.say('洋服箪笥の扉が弾け飛び――\n首に縄を巻いたままの男が、よろめき出てきた。\n\nサイラス・アシュコム……！');
  g.cut(null);
  g.unlock();
}
