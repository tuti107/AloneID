// 屋根裏部屋 — where Silas Ashcombe hanged himself. The game starts here.
import * as F from '../furniture.js';
import { M } from '../mats.js';

const H = 2.2, RIDGE = 3.6;

export default {
  id: 'attic',
  name: '屋根裏部屋',
  bounds: [-4.2, -3.2, 4.2, 3.2],
  floorType: 'wood',
  ambience: 'attic',
  build(r) {
    r.shell(-4, -3, 4, 3, {
      h: H, floor: 'atticFloor', mat: 'atticWall', trim: 'woodBlack',
      openings: { n: [{ at: -2.0, w: 0.9, h: 1.0, sill: 0.9 }], e: [{ at: 1.6, w: 1.0, h: 2.0 }] },
    });
    // pitched roof
    const roof = M('atticWall', { ts: [2, 2] });
    r.quad(roof, [-4, H, -3], [4, H, -3], [4, RIDGE, 0], [-4, RIDGE, 0]);
    r.quad(roof, [4, H, 3], [-4, H, 3], [-4, RIDGE, 0], [4, RIDGE, 0]);
    r.tri('atticWall', [-4, H, 3], [-4, H, -3], [-4, RIDGE, 0]);
    r.tri('atticWall', [4, H, -3], [4, H, 3], [4, RIDGE, 0]);
    const ang = Math.atan2(RIDGE - H, 3);
    const rl = Math.hypot(3, RIDGE - H);
    for (let x = -3.5; x <= 3.6; x += 1) {
      r.box('wood', 0.1, 0.16, rl, x, H + (RIDGE - H) / 2 - 0.16, -1.5, { rx: -ang });
      r.box('wood', 0.1, 0.16, rl, x, H + (RIDGE - H) / 2 - 0.16, 1.5, { rx: ang });
    }
    r.box('woodBlack', 8, 0.22, 0.2, 0, RIDGE - 0.3, 0);
    for (const x of [-2.5, 0.8, 3.0]) r.box('wood', 0.14, 0.16, 3.2, x, 2.82, 0);

    // the wardrobe that can be pushed over the window
    const wardrobe = F.wardrobe({ w: 1.2, h: 2.0, d: 0.55, wood: 'woodRed' });
    r.place(wardrobe, -0.6, -2.68, 0, { dyn: true });
    r.wardrobe = wardrobe;
    const wInfo = r.interact({
      id: 'wardrobe', x: -0.6, z: -2.2, r: 0.6, label: '洋服箪笥',
      use: async (g) => {
        if (g.flags.atticWindow === 'blocked') await g.say('洋服箪笥が、窓をしっかりと塞いでいる。');
        else await g.say('どっしりとした洋服箪笥だ。中は空っぽで、思ったより軽そうだ。\n押せば動かせるかもしれない。');
      },
    });
    r.pushable(wardrobe, {
      id: 'wardrobe', hw: 0.62, hd: 0.3, axis: [-1, 0], min: 0, max: 1.4,
      onMove: (t, g, silent) => {
        wInfo.x = wardrobe.position.x;
        if (t >= 1.39 && !g.flags.atticWindow) {
          g.flags.atticWindow = 'blocked';
          if (!silent) g.task(() => blocked(r, g));
        }
        if (g.flags.atticWindow === 'blocked') windowBlocked(r);
      },
    });

    const trunk = F.trunk();
    r.place(trunk, -3.3, 2.3, Math.PI / 2, { collide: true, dyn: true });
    r.trunk = trunk;
    if (r.game.flags.trunkOpen) trunk.userData.setOpen(1);
    r.interact({
      id: 'trunk', x: -2.85, z: 2.3, r: 0.5, label: 'トランク',
      verb: (g) => (g.flags.trunkOpen ? '調べる' : '開ける'),
      use: async (g) => {
        if (g.flags.trunkOpen) { await g.say('トランクの中は、もう空だ。'); return; }
        await g.searchAnim();
        g.flags.trunkOpen = true;
        g.audio.sfx('creak', { at: g.player.pos });
        g.tween({ v: 0 }, 'v', 1, 0.6);
        const st = { v: 0 };
        const iv = setInterval(() => trunk.userData.setOpen(st.v), 16);
        await g.tween(st, 'v', 1, 0.7);
        clearInterval(iv);
        await g.say('古いトランクの中に、真鍮の石油ランプと、銀のスキットルが入っていた。');
        await g.give('lamp');
        await g.give('flask');
      },
    });

    r.place(F.desk({ w: 1.3, d: 0.65 }), 2.65, 2.6, Math.PI, { collide: true });
    r.place(F.chair({ wood: 'woodLight', seat: 'woodLight' }), 2.5, 1.95, 0.25, { collide: [0.45, 0.45] });
    const candle = F.candle();
    r.place(candle, 3.05, 2.6, 0, { y: 0.78, cast: false });
    r.flame(3.05, 0.78 + 0.19, 2.6, { size: 0.09, intensity: 9, distance: 7, shadow: 'lo' });
    r.box(M('paper', { ts: [0.2, 0.25] }), 0.22, 0.004, 0.28, 2.95, 0.78, 2.4, { ry: 0.3, cast: false });
    r.pickup('diary', 2.35, 0.79, 2.55, {
      ry: 0.4, label: 'サイラスの日記',
      onTake: async (g) => {
        const c = await g.ask('日記を読みますか？', ['読む', 'あとで']);
        if (c === 0) await g.readDoc('diary');
      },
    });
    r.interact({ id: 'desk', x: 2.65, z: 2.0, r: 0.6, label: '書き物机', use: (g) => g.say('インクの染みだらけの書き物机。蝋燭が、まだ灯っている。\n……誰が火を点けたのだろう。') });

    // the noose
    const n = F.noose({ len: 0.95 });
    r.place(n, 0.8, 0, 0, { y: 2.82, cast: true });
    const fallen = F.chair({ wood: 'woodLight', seat: 'woodLight' });
    fallen.rotation.set(0, 0.6, Math.PI / 2);
    fallen.position.set(1.05, 0.23, 0.35);
    r.static.add(fallen);
    r.collider(1.0, 0.35, 0.4, 0.35, 0.6);

    r.interact({ id: 'noose', x: 0.8, z: 0.0, r: 0.45, label: '首吊りの縄', use: (g) => g.say('サイラスが首を吊った縄が、まだ梁から垂れ下がっている。\n真下には、蹴倒された椅子が転がったままだ。') });
    r.place(F.crate({ s: 0.7 }), 3.4, -2.45, 0.1, { collide: true });
    r.place(F.crate({ s: 0.6 }), 3.4, -1.7, -0.2, { collide: true });
    r.place(F.crate({ s: 0.5 }), 3.38, -2.45, 0.4, { y: 0.7 });
    r.place(F.barrel(), 2.45, -2.6, 0, { collide: true });
    r.place(F.draped({ w: 0.9, h: 1.05, d: 0.85, seed: 3 }), -3.3, -1.3, 0.3, { collide: true });
    r.place(F.draped({ w: 1.5, h: 0.75, d: 0.7, seed: 7 }), -1.3, 2.6, 0.05, { collide: true });
    r.place(F.mannequin(), -3.35, 0.55, 0.9, { collide: true });
    r.interact({ id: 'mannequin', x: -3.35, z: 0.55, r: 0.45, label: 'トルソー', use: (g) => g.say('古い仕立て用のトルソー。エレノア夫人のものだろうか。\n暗がりで見ると、まるで人が立っているようだ。') });
    r.interact({ id: 'crates', x: 3.3, z: -2.0, r: 0.7, label: '木箱', use: (g) => g.say('木箱には「ボストン港経由」の焼き印。中身は古い書類ばかりだ。') });
    r.place(F.rockingChair(), 1.6, -2.25, -0.6, { collide: true });
    const p1 = F.painting({ w: 0.6, h: 0.75, art: 'portraitOld', frame: 'gold' });
    p1.position.set(0.3, 0.49, 2.88);
    p1.rotation.set(-0.16, Math.PI, 0);
    r.static.add(p1);
    const p2 = F.painting({ w: 0.8, h: 0.55, art: 'seascape', frame: 'wood' });
    p2.position.set(-0.45, 0.35, 2.92);
    p2.rotation.set(-0.12, Math.PI + 0.1, 0);
    r.static.add(p2);
    F.cobweb(r, -3.95, H, -2.95, 0, 0.9);
    F.cobweb(r, 3.95, H, 2.95, Math.PI, 0.8);
    F.cobweb(r, -3.95, H + 0.3, 2.95, Math.PI / 2, 0.7);

    // window + moonlight
    r.win = r.window(-2.0, -3, 0, { w: 0.9, h: 1.0, sill: 0.9, frame: 'woodBlack', wallMat: 'atticWall', shadow: 'hi', intensity: 90, angle: 0.5, dyn: true });
    r.interact({
      id: 'window', x: -2.0, z: -2.5, r: 0.5, label: '窓',
      enabled: (g) => g.flags.atticWindow !== 'blocked',
      use: (g) => g.say(g.flags.atticWindow === 'broken' ? '割れた窓から、冷たい雨風が吹き込んでくる。' : '嵐の夜だ。雨に濡れたガラスの向こうで、何かが蠢いている……！'),
    });
    r.door(4, 1.6, -Math.PI / 2, { w: 1.0, h: 2.0, to: 'corridor', entry: 'fromAttic', label: '階段への扉', panel: 'wood', wallMat: 'atticWall',
      onOpen: async (g) => {
        if (g.flags.atticIntro && !g.flags.atticWindow) { await g.say('扉が開かない……！　何かが、私をここに閉じ込めている。'); return false; }
        return true;
      } });

    // the thing outside the window
    if (!r.game.flags.atticWindow || r.game.flags.atticWindow === 'broken') {
      const gh = r.game.spawn(r, { id: 'atticGhoul', type: 'ghoul', x: -2.0, z: -3.8, rot: 0, dormant: true });
      if (!r.game.flags.atticWindow) { gh.hidden = true; gh.root.visible = false; }
      r.ghoul = gh;
    }
    if (r.game.flags.atticWindow === 'broken') breakWindow(r, true);

    r.hemi(0x6a7490, 0x2a1c10, 3.2);
    r.point(0.5, 2.6, 0.5, { color: 0x6878a8, intensity: 10, distance: 12 });

    r.shot({ id: 'a', pos: [3.7, 2.1, 2.55], look: [-1.6, 0.9, -1.4], fov: 60, zone: [-4.3, -3.3, 1.3, 3.3] });
    r.shot({ id: 'b', pos: [-3.7, 2.1, -2.55], look: [2.4, 0.8, 1.7], fov: 60, zone: [1.3, -3.3, 4.3, 3.3] });
    r.entry('start', 3.3, 1.6, -Math.PI / 2);
    r.entry('fromCorridor', 3.3, 1.6, -Math.PI / 2);
  },

  async enter(r, g, entry) {
    if (entry !== 'start' || g.flags.atticIntro) return;
    g.flags.atticIntro = true;
    g.lock();
    g.gfx.u.uFade.value = 1;
    g.cut({ pos: [-0.6, 1.25, 0.6], look: [3.4, 1.1, 1.6], fov: 48 });
    g.player.place(3.6, 1.6, -Math.PI / 2);
    g.fade(0, 1.6);
    await g.walk(2.6, 1.6, 1.0);
    g.audio.sfx('doorSlam');
    g.shake(0.08, 0.3);
    await g.wait(0.5);
    g.player.rot = Math.PI / 2;
    await g.wait(0.6);
    await g.say('背後で扉が閉まった。\n……風のせいだろうか。');
    g.player.rot = -Math.PI / 2;
    await g.wait(0.4);
    g.cut({ pos: [-0.9, 1.35, -0.9], look: [-2.0, 1.35, -3.0], fov: 46 });
    g.audio.sfx('scratch', { at: { x: -2, y: 1.4, z: -3 } });
    await g.wait(1.4);
    g.audio.sfx('scratch', { at: { x: -2, y: 1.4, z: -3 } });
    await g.say('……窓の外で、何かがガラスに爪を立てている。');
    await g.say('何かで、あの窓を塞がなければ――！');
    g.cut(null);
    r.ghoulTimer = 26;
    r.scratchT = 2;
    g.unlock();
  },

  update(r, g, dt) {
    if (r.ghoulTimer > 0 && !g.flags.atticWindow) {
      r.ghoulTimer -= dt;
      r.scratchT -= dt;
      if (r.scratchT <= 0) {
        r.scratchT = 2.5 + Math.random() * 2;
        g.audio.sfx(r.ghoulTimer < 9 ? 'bang' : 'scratch', { at: { x: -2, y: 1.4, z: -3 } });
        if (r.ghoulTimer < 9) g.shake(0.03, 0.15);
      }
      if (r.ghoulTimer <= 0) g.task(() => ghoulBreaksIn(r, g));
    }
  },
};

function windowBlocked(r) {
  if (r.win.light) r.win.light.userData.off = true;
  if (r.win.beam) r.win.beam.visible = false;
}

async function blocked(r, g) {
  windowBlocked(r);
  r.ghoulTimer = 0;
  g.audio.sfx('bang', { at: { x: -2, y: 1.4, z: -3 } });
  g.shake(0.06, 0.3);
  await g.wait(0.5);
  g.audio.sfx('ghoulGrowl', { at: { x: -2, y: 1.4, z: -3 } });
  await g.wait(1.0);
  g.audio.sfx('bang', { at: { x: -2, y: 1.4, z: -3 } });
  g.shake(0.05, 0.2);
  await g.wait(1.2);
  if (r.ghoul) { r.monsters = r.monsters.filter((m) => m !== r.ghoul); r.dynamic.remove(r.ghoul.root); r.ghoul = null; }
  await g.say('箪笥の向こうで、何かが苛立たしげに唸り……\nやがて、雨音だけが残った。');
}

function breakWindow(r, silent = false) {
  if (r.win.glass) r.win.glass.material = r.win.glass.material.clone(), r.win.glass.material.color.set(0x05070a);
  if (r.win.rain) r.win.rain.visible = false;
  void silent;
}

async function ghoulBreaksIn(r, g) {
  if (g.flags.atticWindow) return;
  g.flags.atticWindow = 'broken';
  breakWindow(r);
  g.audio.sfx('glass', { at: { x: -2, y: 1.4, z: -3 } });
  g.burst('glass', -2.0, 1.4, -2.85, { dir: [0, 1] });
  g.flash(0.7);
  g.shake(0.14, 0.4);
  const gh = r.ghoul;
  if (!gh) return;
  gh.hidden = false;
  gh.root.visible = true;
  gh.pos.set(-2.0, 0, -2.45);
  gh.rot = Math.atan2(g.player.pos.x - gh.pos.x, g.player.pos.z - gh.pos.z);
  gh.sync();
  gh.setState('chase');
  gh.leapCd = 0.6;
  await g.wait(0.2);
  g.notify('窓が破られた！');
}
