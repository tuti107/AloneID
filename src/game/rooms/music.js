// 音楽室 — Eleanor still plays, waiting for her waltz.
import * as THREE from 'three';
import * as F from '../furniture.js';
import { M, C } from '../mats.js';
import { starStoneModel } from '../items.js';

export default {
  id: 'music',
  name: '音楽室',
  bounds: [-4.2, -3.7, 4.2, 3.7],
  floorType: 'wood',
  ambience: 'piano',
  build(r, g) {
    const H = 3.4;
    r.shell(-4, -3.5, 4, 3.5, {
      h: H, floor: 'woodFloor', ceil: 'plaster', mat: 'wallpaperRose', wainscot: 'wainscotLight', wainscotH: 0.95, crown: 'woodLight', trim: 'woodLight',
      openings: { w: [{ at: 1.5, w: 1.2, h: 2.3 }], n: [{ at: -1.8, w: 1.1, h: 2.0, sill: 0.8 }, { at: 2.2, w: 1.1, h: 2.0, sill: 0.8 }] },
    });
    F.rug(r, 'rugBlue', 0.4, 0.6, 4.6, 3.4);
    r.door(-4, 1.5, Math.PI / 2, { w: 1.2, h: 2.3, to: 'hall', entry: 'fromMusic', label: '広間への扉', wallMat: 'wallpaperRose', panel: 'woodLight' });
    r.entry('fromHall', -3.35, 1.5, Math.PI / 2);
    for (const x of [-1.8, 2.2]) r.window(x, -3.5, 0, { w: 1.1, h: 2.0, sill: 0.8, curtains: 'curtainGold', intensity: 55, shadow: x > 0 ? 'lo' : false });

    const piano = F.grandPiano();
    r.place(piano, 0.6, 0.15, 0, { collide: true });
    r.place(F.bench({ w: 0.9 }), 0.6, 0.78, 0, { collide: true });
    const cd = F.candelabra({ arms: 3, h: 0.4 });
    r.place(cd, 0.0, -0.55, 0.3, { y: 0.93, cast: false });
    for (const f of cd.userData.flames) r.flame(0.0 + f[0], 0.93 + f[1], -0.55 + f[2], { size: 0.06, light: f[0] === 0, intensity: 3.5, distance: 7 });

    const gram = F.gramophone();
    r.place(F.sideTable({ s: 0.55, h: 0.72 }), 3.1, 2.75, 0, { collide: [0.55, 0.55] });
    r.place(gram, 3.1, 2.75, -2.4, { y: 0.72, dyn: true });
    r.gram = gram;
    if (g.flags.eleanorGone) { gram.userData.record.visible = true; }
    r.interact({
      id: 'gramophone', x: 2.6, z: 2.3, r: 0.5, label: '蓄音機',
      use: async (gg) => {
        if (gg.flags.eleanorGone) { await gg.say('ワルツのレコードが、ターンテーブルの上で静かに止まっている。'); return; }
        await gg.say('古い蓄音機。ターンテーブルには何も載っていない。');
        if (gg.has('record')) {
          const c = await gg.ask('レコードを掛けますか？', ['掛ける', 'やめる']);
          if (c === 0) await playWaltz(r, gg);
        }
      },
      item: async (gg, id) => {
        if (id !== 'record') return false;
        await playWaltz(r, gg);
        return true;
      },
    });

    r.place(F.sofa({ w: 2.0, fabric: 'velvet' }), -1.4, 3.05, Math.PI, { collide: true });
    r.place(F.chair({ wood: 'woodLight', seat: 'velvet' }), -2.7, -1.5, 0.8, { collide: [0.45, 0.45] });
    r.place(F.chair({ wood: 'woodLight', seat: 'velvet' }), 3.2, -0.6, -1.9, { collide: [0.45, 0.45] });
    for (const [x, z, ry] of [[-2.2, -0.2, 0.6], [2.9, 0.6, -1.2]]) {
      const st = new THREE.Group();
      F.bx(st, 'woodBlack', 0.03, 1.1, 0.03, 0, 0, 0);
      F.bx(st, 'woodBlack', 0.4, 0.3, 0.02, 0, 1.0, 0.02, -0.3);
      F.bx(st, M('paperBlank'), 0.3, 0.22, 0.005, 0, 1.04, 0.04, -0.3);
      r.place(st, x, z, ry, { collide: [0.3, 0.3] });
    }
    const pt = F.painting({ w: 0.8, h: 1.0, art: 'portraitWoman' });
    pt.position.set(3.97, 2.0, -1.0);
    pt.rotation.y = -Math.PI / 2;
    r.static.add(pt);
    r.interact({ id: 'portrait', x: 3.4, z: -1.0, r: 0.45, label: '肖像画', use: (gg) => gg.say('ピアノの傍らに立つ婦人の肖像画。\n「エレノア・アシュコム　一九〇八年」とある。') });
    F.cobweb(r, 3.95, H, 3.45, Math.PI, 0.7);

    r.hemi(0x6878a8, 0x2a1c14, 2.1);

    if (!g.flags.eleanorGone) {
      const el = g.spawn(r, { id: 'eleanor', type: 'ghost', x: 0.6, z: 0.82, rot: Math.PI, dress: true, color: 0xc0c8f0, state: 'still' });
      el.anim.play('play', { fade: 0 });
      el.pos.y = 0;
      el.sync();
      r.eleanor = el;
      r.interact({
        id: 'piano', x: 0.6, z: 1.35, r: 0.6, label: 'ピアノを弾く女',
        enabled: (gg) => !gg.flags.eleanorGone,
        use: async (gg) => {
          await gg.say('白い服の女が、鍵盤の上で指を彷徨わせている。\n途切れ途切れの旋律は、何かを探しているかのように物悲しい。');
          await gg.say('……肩に触れようとした瞬間、指先が凍えるほどに冷たくなった。\n彼女が求めているのは、私ではない。');
        },
      });
    } else placeStone(r, g);
    r.interact({ id: 'pianoBody', x: 0.6, z: -1.9, r: 0.6, label: 'グランドピアノ', use: (gg) => gg.say(gg.flags.eleanorGone ? '主を失ったピアノが、月明かりに黒く光っている。' : 'グランドピアノの譜面台には、手書きのワルツの楽譜。') });

    r.shot({ id: 'door', pos: [3.65, 2.95, -3.15], look: [-1.8, 0.6, 1.9], fov: 58, zone: [-4.2, -3.7, 0.4, 3.7] });
    r.shot({ id: 'gram', pos: [-3.65, 2.95, -3.15], look: [2.2, 0.6, 2.0], fov: 58, zone: [0.4, -3.7, 4.2, 3.7] });
  },

  update(r, g, dt) {
    const el = r.eleanor;
    if (!el || g.flags.eleanorGone || r.dancing) return;
    const d = Math.hypot(g.player.pos.x - el.pos.x, g.player.pos.z - el.pos.z);
    r.shoveT = (r.shoveT || 0) - dt;
    if (d < 0.75 && r.shoveT <= 0 && g.player.alive) {
      r.shoveT = 2.5;
      g.audio.sfx('ghostScream', { at: el.pos });
      g.player.damage(8, el.pos.x, el.pos.z, { knock: 4 });
      g.notify('冷たい手に、突き飛ばされた！');
    }
  },
};

function placeStone(r, g) {
  if (g.flags['taken:starstone']) return;
  r.pickup('starstone', 0.25, 0.94, -0.4, { label: '光る石', model: () => { const m = starStoneModel(); m.rotation.x = -Math.PI / 2; return m; } });
  r.point(0.25, 1.2, -0.4, { color: 0x90ff90, intensity: 1.5, distance: 3, flicker: 0.3, speed: 2 });
}

async function playWaltz(r, g) {
  if (g.flags.eleanorGone) return;
  g.lock();
  g.inv.remove('record');
  await g.reachAnim();
  r.gram.userData.record.visible = true;
  r.gram.userData.playing = true;
  g.audio.sfx('needle');
  await g.wait(1.0);
  g.audio.music('waltz');
  r.dancing = true;
  const el = r.eleanor;
  g.cut({ pos: [-2.6, 1.6, 2.6], look: [0.6, 1.0, 0.4], fov: 50 });
  await g.wait(1.5);
  await g.say('雑音混じりに、古いワルツが流れ出した。\n白い女の指が、ぴたりと止まる。');
  el.setState('dance');
  el.anim.play('idle', { fade: 0.8 });
  const st = { y: 0 };
  await g.tween(st, 'y', 1, 1.2);
  el.pos.set(0.4, 0, 1.6);
  el.anim.play('dance', { fade: 0.6 });
  g.cut({ pos: [-2.9, 1.3, 3.0], look: [0.3, 1.1, 1.2], fov: 46 });
  // she waltzes in slow circles
  const t0 = g.time;
  const spin = () => {
    const t = g.time - t0;
    el.pos.x = 0.0 + Math.cos(t * 0.6) * 1.1;
    el.pos.z = 1.5 + Math.sin(t * 0.6) * 0.7;
    el.rot = t * 0.6 + Math.PI;
    el.sync();
  };
  r.updaters.push(spin);
  await g.wait(7.5);
  await g.say('女はひとり、見えない誰かの腕に抱かれるように踊っている。\nその顔は、穏やかに微笑んでいた。');
  await g.wait(3.5);
  const fade = { a: 0.55 };
  const iv = setInterval(() => el.setOpacity(fade.a), 16);
  await g.tween(fade, 'a', 0, 2.5);
  clearInterval(iv);
  r.updaters = r.updaters.filter((u) => u !== spin);
  g.burst('ghost', el.pos.x, 1.2, el.pos.z, { n: 24 });
  el.root.visible = false;
  r.monsters = r.monsters.filter((m) => m !== el);
  g.flags.eleanorGone = true;
  r.dancing = false;
  r.gram.userData.playing = false;
  g.audio.music(null);
  g.audio.sfx('chime');
  placeStone(r, g);
  g.cut({ pos: [-1.2, 1.6, 1.4], look: [0.3, 0.9, -0.4], fov: 45 });
  await g.wait(1.0);
  await g.say('曲が終わると、女の姿は光の粒となって消えていった。\n\n……ピアノの上で、何かが淡く光っている。');
  g.cut(null);
  g.unlock();
}
