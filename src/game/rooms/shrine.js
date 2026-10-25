// 深淵の祭殿 — under the cavern of the first act, down the drained channel
// from the tide cave: a shelf of rock over the abyss, a causeway to an island
// with two pillars and an altar, and Clara on the altar. What was burned and
// drowned in the cavern above comes up out of the dark behind her. Two stars
// in the pillars hold it; the undying flame thrown into it ends it. Then the
// way back up, with Clara, before the shrine falls in.
import * as THREE from 'three';
import * as F from '../furniture.js';
import { M, C, spriteMat } from '../mats.js';
import { rockGeo } from '../../engine/geom.js';
import { Horror } from '../boss.js';
import { starStoneModel } from '../items.js';
import { rng } from '../../engine/util.js';

export const FINAL_ESCAPE = 120;
const PILLARS = [{ id: 'pillarW', x: -2.3, z: -4.2 }, { id: 'pillarE', x: 2.3, z: -4.2 }];

export default {
  id: 'shrine',
  name: '深淵の祭殿',
  bounds: [-10.4, -10.4, 10.4, 10.4],
  floorType: 'rock',
  ambience: 'abyss',
  dark: true,
  silentThunder: true,
  bg: 0x020304,
  build(r, g) {
    const R = rng(131);
    r.scene.fog = new THREE.FogExp2(0x081214, 0.016);
    // the shelf they come in on, the causeway, and the island
    const rockM = M('rockWet', { ts: [3, 3], color: 0xd4dcd8, flat: true });
    r.floor(-9.0, 2.2, 9.0, 10.0, rockM, 0, 'rock');
    r.floor(-1.2, -2.2, 1.2, 2.2, rockM, 0, 'rock');
    r.floor(-3.4, -8.2, 3.4, -2.2, rockM, 0, 'rock');
    // the abyss all round: nothing to stand on
    r.collider(-5.6, 0.0, 4.4, 2.2);
    r.collider(5.6, 0.0, 4.4, 2.2);
    r.collider(-6.9, -6.3, 3.5, 4.1);
    r.collider(6.9, -6.3, 3.5, 4.1);
    r.collider(0, -9.3, 3.4, 1.1);
    r.collider(-9.8, 6.1, 0.6, 3.9);
    r.collider(9.8, 6.1, 0.6, 3.9);
    r.collider(0, 10.3, 9.0, 0.4);
    const deep = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: 0x030608 }));
    deep.rotation.x = -Math.PI / 2;
    deep.position.y = -14;
    r.dynamic.add(deep);
    for (let i = 0; i < 18; i++) {
      const mist = new THREE.Sprite(spriteMat('smoke', 0x1a2a2a, 0.35, false));
      const s = 4 + R() * 5;
      mist.scale.set(s, s * 0.5, 1);
      const a = R() * Math.PI * 2;
      mist.position.set(Math.cos(a) * (6 + R() * 6), -3 - R() * 4, Math.sin(a) * (6 + R() * 6) - 3);
      r.dynamic.add(mist);
    }
    // ragged edges along the drop
    const edge = (x, z, s) => {
      const m = new THREE.Mesh(rockGeo(s, Math.floor(R() * 999), 1, [1.2, 0.7, 1.2]), M('rockWet', { flat: true }));
      m.position.set(x, -s * 0.62, z);
      r.static.add(m);
    };
    for (let x = -8.6; x <= 8.6; x += 1.3) if (Math.abs(x) > 1.6) edge(x, 2.0, 0.8 + R() * 0.3);
    for (let z = -2.0; z <= 2.0; z += 1.2) { edge(-1.5, z, 0.6); edge(1.5, z, 0.6); }
    for (let z = -8.0; z <= -2.4; z += 1.3) { edge(-3.7, z, 0.75); edge(3.7, z, 0.75); }
    for (let x = -3.0; x <= 3.0; x += 1.3) edge(x, -8.5, 0.8);
    // the cavern walls round the shelf, and the roof far above
    for (let x = -9; x <= 9; x += 1.8) { const m = new THREE.Mesh(rockGeo(2 + R(), Math.floor(R() * 999), 1, [1, 2.2, 1]), M('rock', { flat: true })); m.position.set(x, 1.5, 11.0 + R()); r.static.add(m); }
    for (let z = 2.5; z <= 10; z += 1.8) for (const sx of [-1, 1]) { const m = new THREE.Mesh(rockGeo(2 + R(), Math.floor(R() * 999), 1, [1, 2.2, 1]), M('rock', { flat: true })); m.position.set(sx * (10.6 + R()), 1.5, z); r.static.add(m); }
    for (let i = 0; i < 20; i++) {
      const st = F.stalactite(1.2 + R() * 2.4, 0.2 + R() * 0.3, R() * 6, 'rock');
      st.position.set(-9 + R() * 18, 9.5, -9 + R() * 18);
      if (Math.hypot(st.position.x, st.position.z + 1.5) < 3 || Math.hypot(st.position.x - 3.6, st.position.z - 4.2) < 3) continue;
      r.static.add(st);
    }

    // ---- the way in, from the channel
    r.box('#010203', 1.6, 2.6, 0.1, 6.6, 0, 10.1, { cast: false });
    r.trigger({ box: [5.6, 9.4, 7.6, 10.4], enter: (gg) => leaveShrine(r, gg) });
    r.entry('fromCave', 6.6, 9.2, Math.PI + 0.5);

    // ---- what fell from the cavern above: the old altar, broken, and in it
    // the first star stone, still warm
    for (let i = 0; i < 6; i++) r.box('runes', 0.6 + R() * 0.5, 0.3 + R() * 0.3, 0.5 + R() * 0.4, -6.2 + R() * 1.4, 0, 5.2 + R() * 1.2, { ry: R() * 3, collide: i < 3 });
    r.box('runes', 0.7, 0.34, 0.6, -5.5, 0, 4.6, { ry: 0.3, collide: true });
    r.pickup('starstone', -5.5, 0.345, 4.6, { id: 'shrineStar', label: '瓦礫の中の光', ry: 0.4, r: 0.45, model: () => { const s = starStoneModel(); s.rotation.x = -Math.PI / 2 + 0.3; return s; } });
    // Clara's bag, where she was dragged across the shelf
    r.box(M('leather', { color: 0x5a3a28 }), 0.36, 0.22, 0.14, 3.8, 0, 6.2, { ry: 0.5 });
    r.pickup('tonic', 3.45, 0.02, 6.0, { id: 'claraTonic', label: 'クララの鞄', ry: 0.9 });
    r.interact({ id: 'rubble', x: -5.2, z: 6.6, r: 0.5, label: '崩れた祭壇', use: (gg) => gg.say('見覚えのある、ルーン文字の刻まれた石。\n地下洞窟の祭壇が、床ごとここへ崩れ落ちてきたのだ。') });

    // ---- the island: two pillars, the altar, Clara
    r.pillars = {};
    for (const P of PILLARS) {
      const col = F.column({ h: 2.6, r: 0.24, m: 'runes' });
      r.place(col, P.x, P.z, 0, { collide: true });
      const star = starStoneModel();
      star.position.set(P.x, 1.6, P.z + 0.33);
      star.visible = !!g.flags['set:' + P.id];
      r.dynamic.add(star);
      const glow = new THREE.Sprite(spriteMat('glow', P.id === 'pillarW' ? 0x9ad0a0 : 0x8ab0e0, star.visible ? 0.7 : 0));
      glow.scale.set(1.2, 1.2, 1);
      glow.position.copy(star.position);
      r.dynamic.add(glow);
      r.pillars[P.id] = { star, glow };
      r.interact({
        id: P.id, x: P.x, z: P.z + 0.75, r: 0.4, y: 1.5, label: '石の柱',
        use: (gg) => usePillar(r, gg, P),
        item: async (gg, id) => {
          if (id !== 'starstone' && id !== 'seastar') return false;
          await setStar(r, gg, P, id);
          return true;
        },
      });
    }
    r.place(F.altar(), 0, -6.2, 0, { collide: true });
    r.clara = claraOnAltar(r, g);
    r.interact({
      id: 'altar', x: 0, z: -5.1, r: 0.6, label: (gg) => (gg.flags.godBurned ? '祭壇' : '祭壇のクララ'),
      use: (gg) => useAltar(r, gg),
      item: async (gg, id) => {
        if (id !== 'lantern') return false;
        await throwFlame(r, gg);
        return true;
      },
    });

    // ---- the god, under the dark behind the altar
    r.horror = new Horror(g, r, { x: 0, z: -12.5, edge: -8.6 });
    r.horror.root.scale.setScalar(2.6);
    if (g.flags.godRisen && !g.flags.godBurned) { r.horror.rise(true); if (g.flags.starsSet) r.horror.seal(); }
    r.boss = r.horror;
    r.trigger({ box: [-1.2, -2.2, 1.2, 1.6], once: true, when: (gg) => !gg.flags.godRisen, enter: (gg) => godRises(r, gg) });

    // ---- light: the abyss glowing green from below, witch-fires along the
    // way to the island, a cold shaft down onto the altar
    r.hemi(0x5a8a90, 0x1a2a28, 6.0);
    r.spot(0, 10, -2.4, 0, 0.9, -6.2, { color: 0x9ab8d8, intensity: 110, distance: 18, angle: 0.42, penumbra: 0.7 });
    r.shaft(0, 10, -2.4, 0, 0.9, -6.2, { r0: 0.3, r: 1.9, alpha: 0.05 });
    r.point(0, 3.5, -6.0, { color: 0x6a8aa0, intensity: 12, distance: 12 });
    r.point(-4.0, 2.5, 6.0, { color: 0x5a8a7a, intensity: 12, distance: 12 });
    r.point(5.0, 2.5, 7.0, { color: 0x5a7a8a, intensity: 12, distance: 12 });
    for (const [x, z] of [[-4.8, -1.2], [4.8, -1.2], [0, -9.8]]) r.point(x, -1.4, z, { color: 0x40c8a0, intensity: 22, distance: 13, flicker: 0.15, speed: 0.5 });
    r.point(0, -4, -10, { color: 0x40a080, intensity: 30, distance: 20, flicker: 0.2, speed: 0.6 });
    // (only the island's pair throw light: a phone can only carry so many)
    for (const [x, z, lit] of [[-1.0, 2.0, false], [1.0, 2.0, false], [-3.0, -2.5, true], [3.0, -2.5, true]]) {
      r.box('runes', 0.3, 0.9, 0.3, x, 0, z, { collide: true });
      r.box('runes', 0.42, 0.08, 0.42, x, 0.9, z);
      r.flame(x, 0.98, z, { size: 0.22, color: 0x9affd8, glow: 0x40ffb0, lightColor: 0x50e0a0, intensity: 10, distance: 10, flicker: 0.3, light: lit });
    }

    r.shot({ id: 'shelf', pos: [0.0, 6.0, -1.5], look: [0.0, 0.2, 6.6], fov: 64, zone: [-10.4, 2.0, 10.4, 10.4] });
    r.shot({ id: 'island', pos: [3.6, 5.6, 4.2], look: [-0.4, 0.8, -5.4], fov: 62, zone: [-10.4, -10.4, 10.4, 2.0] });
  },

  setup(r, g) {
    if (g.flags.godRisen && !g.flags.godBurned) g.audio.music('boss');
  },

  update(r, g, dt) {
    r.horror.update(dt);
    if (r.clara) r.clara.update(dt);
    for (const P of PILLARS) {
      const q = r.pillars[P.id];
      if (q.star.visible) q.star.rotation.y += dt * 0.8;
    }
    // more of the drowned climb up out of the dark while it lives
    if (g.flags.godRisen && !g.flags.godBurned && g.player.alive && !g.locked) {
      r.spawnT = (r.spawnT ?? 6) - dt;
      const live = r.monsters.filter((m) => m.alive).length;
      if (r.spawnT <= 0 && live < 2 && (r.spawned || 0) < 6) {
        r.spawnT = 9;
        r.spawned = (r.spawned || 0) + 1;
        const side = r.spawned % 2 ? -1 : 1;
        const t = g.spawn(r, { id: 'abyss' + r.spawned, type: 'thrall', seed: 50 + r.spawned, x: side * 2.6, z: -2.6, rot: -side * 1.2 });
        t.bury();
        t.emerge();
      }
    }
    if (r.collapse) {
      r.rockT = (r.rockT ?? 1) - dt;
      if (r.rockT <= 0) {
        r.rockT = 0.6 + Math.random() * 1.2;
        const x = -7 + Math.random() * 14, z = -7 + Math.random() * 15;
        g.burst('dust', x, 0.2, z, { n: 10, size: 0.4 });
        g.audio.sfx('thud', { at: { x, y: 0, z } });
      }
    }
  },

  onThrowLamp: (r, g) => throwFlame(r, g),
};

// Clara, bound on the altar: lying there until the god is burned, then up
// and following him out.
function claraOnAltar(r, g) {
  if (g.flags.godBurned) return null;
  const c = g.makeClara();
  c.root.position.set(0, 0.97, -6.2);
  c.root.rotation.y = Math.PI / 2;
  c.lie();
  r.dynamic.add(c.root);
  return c;
}

async function godRises(r, g) {
  g.flags.godRisen = true;
  g.lock();
  g.audio.music(null);
  g.audio.sfx('rumble');
  g.shake(0.1, 2.0);
  g.cut({ pos: [0.6, 1.5, 1.4], look: [0, 1.4, -6.2], fov: 46 });
  await g.wait(1.0);
  await g.say('祭壇の上に、クララが横たわっている。\n……息は、ある。');
  r.horror.rise();
  g.audio.sfx('roar');
  g.cut({ pos: [2.6, 1.2, 0.0], look: [0, 4.0, -11.0], fov: 60 });
  await g.wait(2.4);
  await g.say('深淵の底から、焼け爛れた巨体がせり上がってきた。\n洞窟で沈んだあれが――無数の眼で、こちらを見下ろしている。');
  await g.say('二つの星の石を、柱に。\nそして、消えない火を――！');
  g.cut(null);
  g.unlock();
  g.audio.music('boss');
}

async function usePillar(r, g, P) {
  if (g.flags['set:' + P.id]) { await g.say('柱の窪みで、星の石が脈打っている。'); return; }
  const have = ['starstone', 'seastar'].filter((id) => g.has(id));
  if (!have.length) { await g.say('石の柱。胸の高さに、星の形の窪みがある。'); return; }
  await setStar(r, g, P, have[0]);
}

async function setStar(r, g, P, id) {
  if (g.flags['set:' + P.id]) { await g.say('この柱には、もう星が嵌まっている。'); return; }
  g.flags['set:' + P.id] = true;
  g.inv.remove(id);
  await g.reachAnim();
  const q = r.pillars[P.id];
  q.star.visible = true;
  q.glow.material.opacity = 0.7;
  g.audio.sfx('seal', { at: { x: P.x, y: 1.6, z: P.z } });
  g.flash(0.4, [0.6, 1.0, 0.8]);
  if (PILLARS.every((p) => g.flags['set:' + p.id])) {
    g.flags.starsSet = true;
    if (g.flags.godRisen) r.horror.seal();
    g.audio.sfx('roar');
    g.shake(0.15, 1.2);
    await g.say('二つの星が揃った瞬間、\nあれが、耳を裂くような叫びを上げた――！\n\n今だ。消えない火を……！');
  } else await g.say('星の石を柱に嵌めた。\n石が青白く輝き、あれの動きが、わずかに鈍った。');
}

async function useAltar(r, g) {
  if (g.flags.godBurned) { await g.say('祭壇は、ひび割れて冷たい。'); return; }
  if (!g.flags.starsSet) { await g.say('クララは、目を閉じたまま動かない。\n手足を、濡れた海藻の縄で縛られている。\n\n……まずは、あれを止めなければ。'); return; }
  if (g.has('lantern') && g.flags.lanternLit) {
    const c = await g.ask('嵐のランタンを、あれに投げつけますか？', ['投げる', 'やめる']);
    if (c === 0) await throwFlame(r, g);
    return;
  }
  await g.say('火が要る。……消えない、あの火が。');
}

async function throwFlame(r, g) {
  if (g.flags.godBurned) return;
  if (!g.flags.godRisen) { await g.say('いや……この灯りを失うわけにはいかない。'); return; }
  if (!g.flags.starsSet) { await g.say('……まだだ。\n星が揃わなければ、この火も届かない気がする。'); return; }
  if (!g.flags.lanternLit) { await g.say('ランタンには、火が入っていない。'); return; }
  g.lock();
  const p = g.player;
  p.rot = Math.atan2(0 - p.pos.x, -9 - p.pos.z);
  await p.playClip('throw');
  g.inv.remove('lantern');
  g.flags.lanternLit = false;
  p.refreshHeld();
  g.flags.godBurned = true;
  g.audio.sfx('beacon');
  g.audio.sfx('fireBurst');
  g.flash(1, [1.0, 0.85, 0.6]);
  g.shake(0.2, 1.4);
  r.horror.ignite();
  g.audio.music(null);
  g.cut({ pos: [2.8, 1.6, -0.8], look: [0, 4.0, -11.0], fov: 62 });
  await g.wait(2.2);
  await g.say('消えない火は、潮に呑まれなかった。\n白い炎が深き者の全身を駆け上がり、\n百二十年の闇を、内側から焼いていく――');
  g.audio.sfx('roar', { rate: 0.6 });
  await g.wait(2.0);
  r.horror.fall();
  for (const m of r.monsters) if (m.alive) m.die();
  // the shrine starts to come down; Clara wakes
  r.collapse = true;
  g.audio.sfx('rumble');
  g.cut({ pos: [1.4, 1.5, -3.6], look: [0, 1.0, -6.2], fov: 44 });
  await r.clara.wake();
  await g.say('「……エドガー、さん……？」\n\nクララが、目を開けた。');
  await g.say('天井から岩が崩れ落ちてくる。\n祭殿が、潮ごと沈もうとしている――！\n\n来た道を戻れ。クララを連れて、地上へ！');
  r.dynamic.remove(r.clara.root);
  r.clara = null;
  g.cut(null);
  g.flags.claraFollowing = true;
  g.flags.finalEscape = true;
  g.escape = { t: FINAL_ESCAPE, total: FINAL_ESCAPE, final: true };
  g.audio.music('escape');
  g.startFollower();
  g.unlock();
}

async function leaveShrine(r, g) {
  if (g.flags.finalEscape || !g.flags.godRisen || g.flags.godBurned) { await g.goTo('tidecave', 'fromShrine', { fadeOut: 0.5 }); return; }
  await g.say('……クララを置いては行けない。');
  g.player.place(6.6, 8.8, Math.PI);
}
