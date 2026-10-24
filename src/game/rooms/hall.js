// 玄関ホール — the grand hall: staircase, the great clock, and a front door
// that will not open.
import * as F from '../furniture.js';
import { M, C } from '../mats.js';

const H = 6.4, LAND = 3.6;

export default {
  id: 'hall',
  name: '玄関ホール',
  bounds: [-7.2, -5.2, 7.2, 5.2],
  floorType: 'stone',
  ambience: 'hall',
  build(r, g) {
    r.shell(-7, -5, 7, 5, {
      h: H, floor: 'marble', ceil: 'plasterDark', mat: 'wallpaperRed', wainscot: 'wainscot', wainscotH: 1.2, crown: true,
      openings: {
        s: [{ at: 0, w: 1.9, h: 2.9 }, { at: -4.2, w: 1.2, h: 2.4, sill: 0.9 }, { at: 4.2, w: 1.2, h: 2.4, sill: 0.9 }, { at: -4.2, w: 1.0, h: 1.4, sill: 4.3 }, { at: 4.2, w: 1.0, h: 1.4, sill: 4.3 }],
        w: [{ at: 1.2, w: 1.7, h: 2.6 }],
        e: [{ at: 2.6, w: 1.2, h: 2.3 }, { at: -0.8, w: 1.0, h: 2.15 }, { at: -3.9, w: 1.0, h: 2.15 }],
        n: [{ at: -6.1, w: 1.4, h: 2.4, sill: LAND }],
      },
    });
    F.rug(r, 'carpetRunner', 0, 1.6, 1.6, 6.4, 0);
    F.rug(r, 'rugRed', 0, -1.4, 4.5, 3.2);

    // ---- grand staircase along the north wall, rising westward
    r.stairs(2.6, -4.25, 'w', { w: 1.4, len: 6.8, rise: LAND, steps: 20, mat: 'woodBlack', carpet: 'stairCarpet', sides: [1], collideSides: [1] });
    // landing in the north-west corner
    r.box('woodBlack', 2.8, 0.25, 1.8, -5.6, LAND - 0.25, -4.1);
    r.floor(-7, -5, -4.2, -3.2, 'woodFloorDark', LAND);
    r.box('wainscot', 2.8, LAND - 0.25, 0.08, -5.6, 0, -3.24);
    r.box('wainscot', 0.08, LAND - 0.25, 1.75, -4.24, 0, -4.12);
    r.platform(-7, -5, -4.2, -3.2, LAND);
    r.collider(-5.6, -4.1, 1.4, 0.9, 0, { y0: -1, y1: LAND - 0.1 });
    for (let i = 0; i < 9; i++) r.box('woodBlack', 0.05, 0.9, 0.05, -6.8 + i * 0.32, LAND, -3.28);
    r.box('woodBlack', 2.9, 0.07, 0.09, -5.6, LAND + 0.9, -3.28);
    r.box('woodBlack', 0.16, 1.25, 0.16, -4.22, LAND, -3.28);
    r.collider(-5.6, -3.24, 1.4, 0.07, 0, { y0: LAND - 0.3, y1: LAND + 2 });
    r.collider(-4.22, -3.4, 0.08, 0.2, 0, { y0: LAND - 0.3, y1: LAND + 2 });
    // dark corridor beyond the upper arch
    r.box('#040303', 1.4, 2.4, 0.05, -6.1, LAND, -5.15, { cast: false });
    r.trigger({
      box: [-7, -5, -5.3, -4.3],
      when: (gg) => gg.player.pos.y > LAND - 0.4,
      enter: (gg) => gg.goTo('corridor', 'fromStairs', { fadeOut: 0.5 }),
    });
    r.entry('fromUpstairs', -5.4, -3.9, Math.PI / 2 + 0.3);

    // ---- doors
    r.door(0, 5, Math.PI, {
      id: 'frontDoor', w: 1.9, h: 2.9, double: true, label: '玄関の扉', panel: 'woodBlack', panelInset: 'woodRed', wallMat: 'wallpaperRed', glass: true,
      onOpen: async (gg) => {
        if (gg.flags.horrorDead) { gg.task(() => gg.ending()); return false; }
        gg.audio.sfx('locked');
        await gg.say('玄関の扉は、びくともしない。\nまるで屋敷そのものが、私を逃すまいとしているかのようだ。');
        return false;
      },
    });
    r.entry('start', 0, 4.2, Math.PI);
    r.door(-7, 1.2, Math.PI / 2, { w: 1.7, h: 2.6, double: true, to: 'dining', entry: 'fromHall', label: '食堂の扉', wallMat: 'wallpaperRed', glass: true });
    r.entry('fromDining', -6.3, 1.2, Math.PI / 2);
    r.door(7, 2.6, -Math.PI / 2, { w: 1.2, h: 2.3, to: 'music', entry: 'fromHall', label: '音楽室の扉', wallMat: 'wallpaperRed', panel: 'woodLight' });
    r.entry('fromMusic', 6.3, 2.6, -Math.PI / 2);
    r.door(7, -0.8, -Math.PI / 2, { to: 'kitchen', entry: 'fromHall', label: '厨房への扉', wallMat: 'wallpaperRed', panel: 'wood' });
    r.entry('fromKitchen', 6.3, -0.8, -Math.PI / 2);
    r.door(7, -3.9, -Math.PI / 2, {
      id: 'cellarDoor', to: 'cellar', entry: 'fromHall', label: '地下室の扉', wallMat: 'wallpaperRed', panel: 'iron', panelInset: 'rust',
      locked: true, key: 'cellarKey', lockedMsg: '鉄で補強された重い扉。錠前は錆びついているが、しっかりと閉ざされている。',
      sound: 'doorHeavy',
      onOpen: async (gg) => {
        if (!gg.flags.lampLit) {
          await gg.say('扉の向こうには、地の底へ続く石段。\n……底知れない闇だ。灯りなしでは、とても降りられない。');
          return false;
        }
        return true;
      },
    });
    r.entry('fromCellar', 6.3, -3.9, -Math.PI / 2);

    // ---- windows
    for (const x of [-4.2, 4.2]) {
      r.window(x, 5, Math.PI, { w: 1.2, h: 2.4, sill: 0.9, curtains: 'curtainRed', curtainW: 0.5, wallMat: 'wallpaperRed', intensity: 70, angle: 0.5, shadow: x < 0 ? 'lo' : false });
      r.window(x, 5, Math.PI, { w: 1.0, h: 1.4, sill: 4.3, wallMat: 'wallpaperRed', intensity: 30, angle: 0.5, beam: false, light: false });
    }

    // ---- the great clock
    const clock = F.grandfatherClock({ wood: 'woodRed' });
    r.place(clock, -6.72, 3.7, Math.PI / 2, { collide: true, dyn: true });
    r.clock = clock;
    if (g.flags.clockSolved) {
      clock.userData.setTime(3, 0);
      clock.userData.running = true;
      clock.userData.panel.rotation.y = -1.6;
    }
    r.interact({
      id: 'clock', x: -6.15, z: 3.7, r: 0.5, label: '大時計',
      use: async (gg) => {
        if (gg.flags.clockSolved) { await gg.say('大時計は再び動き出し、静かに時を刻んでいる。'); return; }
        await gg.say('振り子の止まった大時計。針は七時四十分を指したまま動かない。\n文字盤の「III」の数字だけが、何度も指でなぞられたように擦り減っている。');
        if (gg.has('clockKey')) await clockPuzzle(r, gg);
        else await gg.say('文字盤の下に、ぜんまいを巻くための鍵穴がある。');
      },
      item: async (gg, id) => {
        if (id !== 'clockKey') return false;
        if (gg.flags.clockSolved) { await gg.say('もう必要ない。'); return true; }
        await clockPuzzle(r, gg);
        return true;
      },
    });
    if (g.flags.clockSolved) placeCellarKey(r, g);

    // ---- decor
    r.place(F.column({ h: H, r: 0.22 }), -2.4, 3.3, 0, { collide: true });
    r.place(F.column({ h: H, r: 0.22 }), 2.4, 3.3, 0, { collide: true });
    r.place(F.armor(), -3.0, 4.45, Math.PI, { collide: true });
    r.interact({ id: 'armor', x: -3.0, z: 3.9, r: 0.45, label: '甲冑', use: (gg) => gg.say('古い甲冑が、斧槍を手に玄関を見張っている。\n兜の隙間の暗闇から、視線を感じる気がする。') });
    r.place(F.coatRack(), 3.0, 4.5, 0.4, { collide: true });
    r.interact({ id: 'coat', x: 3.0, z: 4.0, r: 0.4, label: 'コート掛け', use: (gg) => gg.say('濡れた外套が一着掛かっている。私の物ではない。\n……裾から、まだ海水が滴っている。') });
    r.place(F.sideTable({ s: 0.6, h: 0.78 }), -6.55, -1.6, 0, { collide: [0.55, 0.55] });
    r.place(F.vase({ h: 0.45, color: 0x4a2a2a }), -6.55, -1.6, 0, { y: 0.78 });
    r.place(F.deadPlant(), 6.55, 4.55, 0, { collide: true });
    r.place(F.deadPlant(), -6.55, 4.55, 0, { collide: true });
    r.place(F.bench({ w: 1.2 }), 4.2, 0.9, Math.PI / 2, { collide: true });
    const big = F.painting({ w: 1.5, h: 1.9, art: 'portraitCaptain' });
    big.position.set(-0.6, 3.9, -4.96);
    r.static.add(big);
    r.interact({ id: 'bigPortrait', x: 1.6, z: -3.1, r: 0.4, reach: 0.5, label: '大きな肖像画', use: (gg) => gg.say('階段の上に、船長服の男の巨大な肖像画。\nエゼキエル・アシュコム。屋敷の建造者だ。') });
    const ch = F.chandelier({ r: 0.9, n: 8, drop: 1.6 });
    ch.position.set(0, H, 0.6);
    r.static.add(ch);
    for (const f of ch.userData.flames) r.flame(f[0], H + f[1], 0.6 + f[2], { size: 0.07, light: false });
    r.point(0, H - 1.9, 0.6, { color: 0xffb070, intensity: 28, distance: 14, flicker: 0.12, shadow: 'lo' });
    for (const [x, z, ry] of [[-6.98, -0.4, Math.PI / 2], [6.98, 1.0, -Math.PI / 2], [-2.4, 4.98, Math.PI], [2.4, 4.98, Math.PI]]) {
      const sc = F.sconce();
      sc.position.set(x, 2.1, z);
      sc.rotation.y = ry;
      r.static.add(sc);
      const f = sc.userData.flames[0];
      const c = Math.cos(ry), s = Math.sin(ry);
      r.flame(x + f[2] * s, 2.1 + f[1], z + f[2] * c, { size: 0.06, intensity: 2.2, distance: 6 });
    }
    F.cobweb(r, -6.95, H, 4.95, Math.PI / 2, 1.0);
    F.cobweb(r, 6.95, H, -4.95, -Math.PI / 2, 1.0);

    r.hemi(0x6070a0, 0x2a1810, 2.4);

    if (!g.flags['dead:maid']) {
      g.spawn(r, { id: 'maid', type: 'maid', x: -3.0, z: -0.8, rot: 0.5, onDeath: () => { g.flags['dead:maid'] = true; } });
    }

    r.shot({ id: 'front', pos: [0.0, 5.3, 4.65], look: [-0.4, 1.3, -2.6], fov: 60, zone: [-3.8, -3.2, 3.6, 5.2] });
    r.shot({ id: 'west', pos: [6.4, 5.5, -2.6], look: [-3.6, 0.8, 2.4], fov: 56, zone: [-7.2, -3.2, -3.8, 5.2] });
    r.shot({ id: 'east', pos: [-5.8, 5.6, 1.0], look: [4.0, 0.7, -0.6], fov: 60, zone: [3.6, -5.2, 7.2, 5.2] });
    r.shot({ id: 'stairs', pos: [4.8, 2.4, 1.2], look: [-3.0, 2.4, -4.2], fov: 58, zone: [-4.2, -5.2, 3.6, -3.2] });
    r.shot({ id: 'landing', pos: [-1.4, 5.9, -1.2], look: [-5.6, 3.4, -4.2], fov: 55, zone: [-7.2, -5.2, -4.2, -3.2] });
  },
};

async function clockPuzzle(r, g) {
  const clock = r.clock;
  const c = await g.ask('ぜんまいを巻いて、針を動かしますか？', ['動かす', 'やめる']);
  if (c !== 0) return;
  g.audio.sfx('wind');
  const h = await g.dial(clock.userData.hour > 12 ? 12 : clock.userData.hour || 7);
  if (h === null) return;
  clock.userData.setTime(h, 0);
  g.lock();
  for (let i = 0; i < h; i++) {
    g.audio.sfx('chime');
    await g.wait(1.0);
  }
  if (h === 3) {
    g.flags.clockSolved = true;
    clock.userData.running = true;
    g.audio.sfx('mechanism');
    g.shake(0.03, 0.4);
    const st = { v: 0 };
    const iv = setInterval(() => { clock.userData.panel.rotation.y = -1.6 * st.v; }, 16);
    await g.tween(st, 'v', 1, 0.8);
    clearInterval(iv);
    g.unlock();
    await g.say('三つ目の鐘が鳴り終わると同時に、ガチャリと歯車の噛み合う音がした。\n時計の台座の板が、ひとりでに開いている。');
    placeCellarKey(r, g);
  } else {
    g.unlock();
    await g.say('鐘の音が、空っぽの広間に虚しく響いた。\n……何も起こらない。');
  }
}

function placeCellarKey(r, g) {
  if (g.flags['taken:cellarKey']) return;
  r.pickup('cellarKey', -6.5, 0.15, 3.7, { label: '時計の台座', ry: 1.4, r: 0.4 });
}
