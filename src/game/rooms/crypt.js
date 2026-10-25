// 納骨堂 — under the family's stone house in the graveyard: the dead of the
// Ashcombes in their niches, Jonah's coffin with his last letter, Ezekiel's
// sarcophagus with its lid pushed off from the inside, his cutlass on the
// wall, and at the far end the old sea tunnel, under water until the
// tower's light draws the tide back.
import * as THREE from 'three';
import * as F from '../furniture.js';
import { M, C } from '../mats.js';

const H = 3.2;
// coffins in the walls that open, one after another, as he goes by
const NICHES = [{ x: -3.6, z: 3.4 }, { x: 3.6, z: 1.8 }, { x: -3.6, z: 0.2 }, { x: 3.6, z: -1.4 }, { x: -3.6, z: -3.0 }];

export default {
  id: 'crypt',
  name: '納骨堂',
  bounds: [-4.2, -6.7, 4.2, 6.7],
  floorType: 'stone',
  ambience: 'crypt',
  build(r, g) {
    r.shell(-4, -6.5, 4, 6.5, {
      h: H, floor: 'stoneFloor', ceil: 'stoneWall', mat: 'stoneWall', baseboard: false,
      openings: { s: [{ at: 0, w: 1.1, h: 2.2 }], n: [{ at: 0, w: 1.8, h: 2.4, pass: true }] },
    });
    // ribs of the vault
    for (let i = 0; i < 6; i++) r.box('stoneWall', 8.0, 0.22, 0.3, 0, H - 0.22, -5.4 + i * 2.2, { cast: false });
    r.door(0, 6.5, Math.PI, { to: 'graveyard', entry: 'fromCrypt', w: 1.1, h: 2.2, label: '墓地への扉', wallMat: 'stoneWall', panel: 'iron', panelInset: 'rust', sound: 'doorHeavy' });
    r.entry('fromGraveyard', 0, 5.8, Math.PI);
    r.entry('fromCave', 0, -5.6, 0);

    // ---- the niches: two rows of coffin ends down both long walls
    const niche = M('soot');
    const wood = M('woodBlack');
    r.lids = [];
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        const z = 3.4 - k * 1.6;
        for (const y of [0.3, 1.45]) {
          r.box(niche, 0.06, 0.9, 1.2, sx * 3.98, y, z, { cast: false });
          const n = NICHES.find((q) => Math.abs(q.z - z) < 0.5 && q.x * sx > 0 && y < 1);
          if (n) {
            // this one's lid will slide
            const lid = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 1.1), wood);
            lid.position.set(sx * 3.91, y + 0.45, z);
            lid.castShadow = true;
            r.dynamic.add(lid);
            r.lids.push({ n, lid, sx, open: false });
          } else r.box(wood, 0.05, 0.8, 1.1, sx * 3.93, y + 0.05, z);
        }
      }
    }
    // the dead that have already come out: bones on the floor of the niches
    for (const [x, z] of [[-3.5, 1.0], [3.5, 3.4]]) r.place(F.bones(), x, z, 0.8);

    // ---- Jonah, in a plain coffin on a bier, his letter in his hands
    r.box('stoneWall', 2.1, 0.55, 0.8, -1.9, 0, 2.2, { collide: true });
    r.box('woodBlack', 1.9, 0.35, 0.6, -1.9, 0.55, 2.2);
    r.box('wood', 1.9, 0.04, 0.6, -1.9, 0.9, 2.2);
    r.interact({
      id: 'jonahCoffin', x: -1.9, z: 1.45, r: 0.5, label: 'ジョナの棺',
      use: async (gg) => {
        if (gg.flags['taken:testament']) { await gg.say('ジョナ・アシュコムの棺。\n組んだ手の中は、もう空だ。'); return; }
        await gg.say('質素な木の棺。蓋に「ジョナ・アシュコム　一八七〇年没」。\n……蓋は、釘を打たれていない。');
      },
    });
    r.pickup('testament', -1.9, 0.95, 2.2, {
      label: 'ジョナの遺書', ry: 0.2,
      before: async (gg) => { await gg.say('蓋をずらすと、干からびた老人の組んだ手に、封をした手紙が挟まっていた。'); },
      onTake: async (gg) => { const c = await gg.ask('読みますか？', ['読む', 'あとで']); if (c === 0) await gg.readDoc('testament'); },
    });

    // ---- Ezekiel's sarcophagus, opened from inside
    const sx0 = 1.6, sz0 = -2.4;
    const tombM = M('stoneWall', { color: 0xd8d2c4 });
    r.box(tombM, 1.0, 0.9, 2.2, sx0, 0, sz0, { collide: true });
    r.box(C(0x050404), 0.8, 0.02, 2.0, sx0, 0.9, sz0, { cast: false });
    const slabLid = r.box(tombM, 1.05, 0.14, 2.25, sx0 + 0.55, 0.62, sz0 + 0.5, { rz: -0.5, ry: 0.35 });
    void slabLid;
    r.interact({
      id: 'ezekielTomb', x: sx0 - 0.85, z: sz0, r: 0.5, label: '石棺',
      use: (gg) => gg.say('大理石の石棺。「エゼキエル・アシュコム」と刻まれている。\n重い蓋は床に落ち、中は空っぽだ。\n\n……蓋の裏に、内側から引っ掻いた、無数の爪痕。'),
    });
    // his cutlass, on the wall above
    const cut = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.75, 0.008), C(0xa8acb0, { phong: true, shininess: 80, specular: 0xffffff }));
    blade.position.y = 0.42;
    blade.rotation.z = 0.08;
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 4, 10, Math.PI), M('brass'));
    guard.position.y = 0.05;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.13, 6), M('woodBlack'));
    grip.position.y = -0.03;
    cut.add(blade, guard, grip);
    cut.rotation.set(0, 0, -0.9);
    if (!g.flags['taken:cutlass']) {
      cut.position.set(sx0, 1.85, -6.42);
      r.dynamic.add(cut);
      r.interact({
        id: 'taken:cutlass', x: sx0, z: -5.7, r: 0.45, y: 1.8, label: '壁のカトラス', verb: '取る',
        use: async (gg) => {
          await gg.reachAnim();
          cut.visible = false;
          gg.flags['taken:cutlass'] = true;
          r.interactables = r.interactables.filter((i) => i.id !== 'taken:cutlass');
          await gg.give('cutlass');
          const c = await gg.ask('カトラスを装備しますか？', ['装備する', 'そのまま']);
          if (c === 0) gg.equip('cutlass');
        },
      });
    }

    // ---- the sea tunnel at the north end
    // the tunnel's sides, set back a little from the opening's edges
    r.box('stoneWall', 1.2, 2.4, 1.58, -1.52, 0, -7.31, { cast: false });
    r.box('stoneWall', 1.2, 2.4, 1.58, 1.52, 0, -7.31, { cast: false });
    r.box('#020304', 1.8, 2.4, 0.05, 0, 0, -8.1, { cast: false });
    r.floor(-0.9, -8.1, 0.9, -6.5, 'rockWet', 0.002);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.6), new THREE.MeshPhongMaterial({ color: 0x06120f, specular: 0x6a8a84, shininess: 120, transparent: true, opacity: 0.85 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.6, -7.3);
    r.dynamic.add(water);
    water.visible = !g.flags.tideReceded;
    r.tunnelWater = water;
    r.collider(0, -6.9, 0.9, 0.35);
    r.interact({
      id: 'seaTunnel', x: 0, z: -6.1, r: 0.6, label: '海への隧道',
      use: async (gg) => {
        if (!gg.flags.tideReceded) { await gg.say('奥へ続く古い隧道は、黒い海水に沈んでいる。\n潮の匂い。……水の底から、低い唸りが聞こえる。\n\n（潮が引かなければ、先へは進めない）'); return; }
        if (gg.hasRoom('tidecave')) { await gg.goTo('tidecave', 'fromCrypt'); return; }
        await gg.say('潮が引き、濡れた石段が海の方へ下っている。\n……波の音に混じって、船の鐘が鳴った気がした。');
        await gg.notYet();
      },
    });

    // ---- light: two lamps at the door, a guttering one by Jonah
    for (const x of [-1.0, 1.0]) {
      const sc = F.sconce();
      sc.position.set(x, 1.9, 6.5);
      sc.rotation.y = Math.PI;
      r.static.add(sc);
      r.flame(x, 1.9 + 0.09, 6.5 - 0.15, { size: 0.06, intensity: 2.6, distance: 7 });
    }
    const cnd = F.candle({ h: 0.16 });
    r.place(cnd, -0.8, 2.2, 0, { y: 0.55, cast: false });
    r.flame(-0.8, 0.55 + 0.17, 2.2, { size: 0.05, intensity: 2.2, distance: 6 });
    r.point(1.6, 2.6, -3.2, { color: 0x5a6a8a, intensity: 7, distance: 10 });
    r.point(0, 2.6, 3.4, { color: 0x8a7a68, intensity: 6, distance: 9 });
    r.point(-1.6, 2.5, 0.0, { color: 0x6a7088, intensity: 5, distance: 9 });
    r.point(0, 2.2, -5.6, { color: 0x4a7a7a, intensity: 6, distance: 8 });
    r.hemi(0x5a6480, 0x1a140e, 4.0);

    // ---- the dead of the house, waiting in their niches
    for (const [i, L] of r.lids.entries()) {
      const id = 'ancestor' + (i + 1);
      if (i % 2 === 1) continue;
      if (g.flags['dead:' + id]) continue;
      const m = g.spawn(r, { id, type: 'ancestor', seed: 40 + i, x: L.sx * 3.2, z: L.n.z, rot: L.sx > 0 ? -Math.PI / 2 : Math.PI / 2, onDeath: () => { g.flags['dead:' + id] = true; } });
      if (!g.flags['lid:' + i]) { m.hidden = true; m.root.visible = false; m.solid = false; L.monster = m; }
    }
    r.lids.forEach((L, i) => { if (g.flags['lid:' + i]) openLid(L, true); });

    r.shot({ id: 'door', pos: [2.6, 2.9, 6.0], look: [-1.2, 0.6, 0.0], fov: 58, zone: [-4.2, 1.0, 4.2, 6.7] });
    r.shot({ id: 'mid', pos: [-2.6, 2.9, 2.6], look: [1.4, 0.6, -3.4], fov: 58, zone: [-4.2, -3.0, 4.2, 1.0] });
    r.shot({ id: 'tunnel', pos: [2.4, 2.9, -0.6], look: [-0.4, 0.8, -6.4], fov: 58, zone: [-4.2, -6.7, 4.2, -3.0] });
  },

  async enter(r, g) {
    if (g.flags.cryptSeen) return;
    g.flags.cryptSeen = true;
    g.lock();
    g.cut({ pos: [0.6, 1.6, 5.6], look: [0, 1.0, -4.0], fov: 52 });
    await g.wait(1.0);
    await g.say('石段を下りた先は、アシュコム家の納骨堂だった。\n壁一面に、棺が収められている。');
    g.cut(null);
    g.unlock();
  },

  update(r, g) {
    // the lids slide, one after another, as he walks the length of it
    const p = g.player;
    if (!p.alive || g.locked) return;
    r.lids.forEach((L, i) => {
      if (L.open || p.pos.z > L.n.z + 1.4 || p.pos.z < L.n.z - 2.5) return;
      g.flags['lid:' + i] = true;
      openLid(L, false, g);
      if (L.monster) {
        const m = L.monster;
        L.monster = null;
        g.wait(0.8).then(() => {
          m.hidden = false;
          m.root.visible = true;
          m.solid = true;
          m.wake();
          g.audio.sfx('zombieNotice', { at: m.pos });
        });
      }
    });
  },
};

function openLid(L, instant, g) {
  L.open = true;
  const to = { z: L.lid.position.z + 0.5, x: L.lid.position.x - L.sx * 0.25, ry: L.sx * 0.5 };
  if (instant) {
    L.lid.position.x = to.x;
    L.lid.position.z = to.z;
    L.lid.rotation.y = to.ry;
    return;
  }
  g.audio.sfx('scrape', { at: L.lid.position });
  g.audio.sfx('creak', { at: L.lid.position });
  const st = { v: 0 };
  const x0 = L.lid.position.x, z0 = L.lid.position.z;
  const iv = setInterval(() => {
    L.lid.position.x = x0 + (to.x - x0) * st.v;
    L.lid.position.z = z0 + (to.z - z0) * st.v;
    L.lid.rotation.y = to.ry * st.v;
  }, 16);
  g.tween(st, 'v', 1, 0.7).then(() => clearInterval(iv));
}
