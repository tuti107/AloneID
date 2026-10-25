// 墓地 — out through the conservatory's garden door: the family's graves on
// the clifftop in the rain, the drop to the sea beyond the railings, Ezekiel's
// stone with no one under it, Thomas's little grave, and the iron door of
// the crypt. The sailors of the Black Gull are buried here too, not deep.
import * as THREE from 'three';
import * as F from '../furniture.js';
import { M, C } from '../mats.js';
import { rockGeo } from '../../engine/geom.js';

// graves the drowned crawl out of: x, z, facing
const MOUNDS = [[-1.4, 1.6, 0.4], [2.6, 2.8, -2.4], [-3.6, -1.2, 1.2]];

export default {
  id: 'graveyard',
  name: '墓地',
  bounds: [-8.4, -7.4, 8.4, 7.4],
  floorType: 'mud',
  ambience: 'exterior',
  outdoor: true,
  bg: 0x05070b,
  build(r, g) {
    r.scene.fog = new THREE.FogExp2(0x0a0e16, 0.03);
    r.floor(-8.4, -7.4, 8.4, 7.4, M('graveGround', { ts: [3, 3] }), 0, 'mud');
    // the gravel path from the garden door to the crypt
    const gravel = M('stoneFloor', { ts: [1.2, 1.2], color: 0xe8e2d4 });
    r.decal(gravel, 3.2, 0.9, 1.1, 9.2, Math.PI / 2 - 0.25, 0.004);
    r.decal(M('stoneFloor', { ts: [1.2, 1.2], color: 0xe6e0d2 }), -2.2, -2.7, 1.1, 5.2, 0.35, 0.009);

    // ---- the conservatory's glass wall at the east, and its door
    r.box('stoneWall', 0.4, 0.6, 14.8, 8.0, 0, 0, { collide: true });
    for (let i = 0; i < 6; i++) {
      const z = -6.2 + i * 2.5;
      if (Math.abs(z - 1.5) < 1) continue;
      r.box(C(0x2a3a30, { transparent: true, opacity: 0.55 }), 0.04, 2.4, 2.3, 7.95, 0.6, z, { cast: false });
    }
    for (let i = 0; i < 7; i++) r.box('iron', 0.08, 3.1, 0.08, 7.9, 0, -7.4 + i * 2.47);
    r.box('iron', 0.1, 0.1, 14.8, 7.9, 3.0, 0);
    r.point(8.8, 1.8, 0, { color: 0xc8a060, intensity: 4, distance: 7 });
    r.door(7.8, 1.5, -Math.PI / 2, { to: 'conservatory', entry: 'fromGraveyard', label: '温室への扉', wallMat: 'iron', panel: 'iron', frame: 'iron', sound: 'doorHeavy' });
    r.entry('fromConservatory', 7.1, 1.5, -Math.PI / 2);

    // ---- railings round the clifftop; beyond them, nothing but the dark
    const rail = (x0, z0, x1, z1) => {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 0.3);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        r.box('iron', 0.03, 1.5, 0.03, x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, { cast: false });
      }
      r.box('iron', Math.abs(x1 - x0) + 0.05, 0.05, Math.abs(z1 - z0) + 0.05, (x0 + x1) / 2, 1.28, (z0 + z1) / 2, { cast: false });
      r.box('iron', Math.abs(x1 - x0) + 0.05, 0.04, Math.abs(z1 - z0) + 0.05, (x0 + x1) / 2, 0.25, (z0 + z1) / 2, { cast: false });
      r.collider((x0 + x1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0) / 2 + 0.06, Math.abs(z1 - z0) / 2 + 0.06);
    };
    rail(-8, -7, 7.7, -7);
    rail(-8, 7, 7.7, 7);
    rail(-8, -6.7, -8, 6.7);
    // the cliff edge and the black sea far below, west of the railings
    r.box('rockWet', 1.2, 0.3, 14.4, -8.9, -0.32, 0, { cast: false });
    r.box('#020304', 30, 0.02, 40, -24, -18, 0, { cast: false });
    r.interact({ id: 'cliff', x: -7.5, z: 4.5, r: 0.5, label: '柵の向こう', use: (gg) => gg.say('鉄柵の向こうは、切り立った崖だ。\n遥か下で、黒い海が岩を噛んでいる。\n\n……波の音に混じって、誰かが名を呼んだ気がした。') });
    // a dead tree, and the woods' darkness to the north and south
    const tree = deadTree();
    r.place(tree, 4.6, -4.6, 0.7, { collide: [0.6, 0.6] });
    for (const [x, z, s] of [[-6, -9, 1.2], [-1, -9.5, 1.4], [5, -9, 1.1], [-4, 9.2, 1.3], [2, 9.6, 1.5], [6.5, 9, 1.0]]) {
      const t = deadTree();
      t.scale.setScalar(s);
      t.position.set(x, 0, z);
      t.rotation.y = x;
      r.static.add(t);
    }

    // ---- the crypt: a squat house of stone at the north-west
    const cx = -4, cz = -5.6;
    // its body, and a front wall with the door's opening in it
    r.box('stoneWall', 4.0, 2.9, 2.4, cx, 0, cz - 0.2, { collide: true });
    r.wall(cx - 2, cz + 1.4, cx + 2, cz + 1.4, { h: 2.9, mat: 'stoneWall', normal: [0, 1], thick: 0.4, baseboard: false, openings: [{ at: 2, w: 1.1, h: 2.2 }] });
    r.box('stoneWall', 4.4, 0.3, 3.2, cx, 2.9, cz);
    r.tri('stoneWall', [cx - 2.2, 3.2, cz + 1.6], [cx + 2.2, 3.2, cz + 1.6], [cx, 4.3, cz + 1.6]);
    r.quad('stoneWall', [cx - 2.25, 3.18, cz + 1.65], [cx, 4.35, cz + 1.65], [cx, 4.35, cz - 1.65], [cx - 2.25, 3.18, cz - 1.65]);
    r.quad('stoneWall', [cx, 4.35, cz + 1.65], [cx + 2.25, 3.18, cz + 1.65], [cx + 2.25, 3.18, cz - 1.65], [cx, 4.35, cz - 1.65]);
    for (const sx of [-1, 1]) r.place(F.column({ h: 2.9, r: 0.14, m: 'stoneWall' }), cx + sx * 1.55, cz + 1.62, 0);
    r.box(C(0xb8b0a0), 1.6, 0.22, 0.04, cx, 2.55, cz + 1.42, { cast: false });
    r.interact({ id: 'cryptName', x: cx + 1.2, z: cz + 2.3, r: 0.45, y: 2.6, label: '納骨堂', use: (gg) => gg.say('石の納骨堂。扉の上に「アシュコム家」と彫られている。\nその下に、もう一行――「海より来たりし者、海へ還る」') });
    r.door(cx, cz + 1.4, 0, {
      id: 'cryptDoor', to: 'crypt', entry: 'fromGraveyard', w: 1.1, h: 2.2, label: '納骨堂の鉄扉', wallMat: 'stoneWall', panel: 'iron', panelInset: 'rust', frame: 'stoneWall', sound: 'doorHeavy',
      locked: true, key: 'cryptKey', lockedMsg: '錆びた鉄の扉。大きな錠前が下りている。',
      unlockMsg: 'トマスの鍵を錠前に差し込むと、軋みながら回った。',
      onOpen: async (gg) => {
        if (gg.hasRoom('crypt')) return true;
        await gg.notYet();
        return false;
      },
    });
    r.entry('fromCrypt', cx, cz + 2.1, 0);
    const lamp = F.oilLamp();
    lamp.position.set(cx + 0.95, 2.2, cz + 1.55);
    r.static.add(lamp);
    r.box('iron', 0.02, 0.3, 0.12, cx + 0.95, 2.5, cz + 1.47, { cast: false });
    r.flame(cx + 0.95, 2.2 + 0.2, cz + 1.55, { size: 0.05, intensity: 3.2, distance: 8 });

    // ---- the graves
    const stoneM = M('stoneWall', { color: 0xd8d4c8 });
    const head = (x, z, ry, o = {}) => {
      const s = new THREE.Group();
      const w = o.w ?? 0.55, h = o.h ?? 0.75;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h - w / 2, 0.12), stoneM);
      slab.position.y = (h - w / 2) / 2;
      s.add(slab);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.12, 12, 1, false, 0, Math.PI), stoneM);
      top.rotation.set(Math.PI / 2, Math.PI / 2, 0);
      top.position.y = h - w / 2;
      s.add(top);
      s.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      s.rotation.set(o.tilt ?? 0, ry, o.lean ?? 0);
      s.position.set(x, 0, z);
      r.static.add(s);
      r.collider(x, z, w / 2 + 0.05, 0.12, ry);
      return s;
    };
    const cross = (x, z, ry, tilt = 0) => {
      const s = new THREE.Group();
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.1), stoneM);
      a.position.y = 0.5;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.13), stoneM);
      b.position.y = 0.72;
      s.add(a, b);
      s.rotation.set(tilt, ry, 0);
      s.position.set(x, 0, z);
      r.static.add(s);
      r.collider(x, z, 0.2, 0.1, ry);
    };
    const rows = [
      [-5.4, -0.2], [-3.4, -0.3], [-1.3, 0.0], [0.8, -0.1], [2.8, 0.2],
      [-5.0, 4.6], [-2.6, 4.9], [-0.4, 4.4], [1.9, 5.0], [4.3, 4.7],
    ];
    rows.forEach(([x, z], i) => {
      if (i % 3 === 2) cross(x, z, 0.1 * (i - 4), (i % 2 ? 0.12 : -0.08));
      else head(x, z, 0.08 * (i - 5), { tilt: i % 4 === 1 ? 0.18 : 0, lean: i % 5 === 3 ? 0.14 : 0, h: 0.6 + (i % 3) * 0.12 });
    });
    r.interact({ id: 'graves', x: 0.8, z: 0.6, r: 0.5, label: '墓石', use: (gg) => gg.say('苔むした墓石。どれも、刻まれた没年は嵐の夜の日付ばかりだ。\n「黒鴎号 水夫」「黒鴎号 甲板長」……船乗りの墓が多い。') });

    // Ezekiel's stone, standing over no one
    const ob = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.9), stoneM);
    base.position.y = 0.2;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 2.6, 4), stoneM);
    shaft.position.y = 0.4 + 1.3;
    shaft.rotation.y = Math.PI / 4;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.35, 4), stoneM);
    tip.position.y = 0.4 + 2.6 + 0.17;
    tip.rotation.y = Math.PI / 4;
    ob.add(base, shaft, tip);
    ob.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    r.place(ob, 1.2, -3.6, 0, { collide: [0.95, 0.95] });
    r.interact({ id: 'ezekielStone', x: 1.2, z: -2.75, r: 0.45, label: '尖塔の墓標', use: (gg) => gg.say('ひときわ高い墓標。\n「エゼキエル・アシュコム船長　一八〇二年　海に眠る」\n\n……その下に、土を掘った跡はない。空の墓だ。') });

    // Thomas's grave, by the railings, looking out to sea
    const tg = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.1), M('marble'));
    slab.position.y = 0.275;
    tg.add(slab);
    const angel = new THREE.Group();
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 8), C(0xd0ccc0));
    robe.position.y = 0.21;
    const ah = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), C(0xd0ccc0));
    ah.position.y = 0.48;
    angel.add(robe, ah);
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.02), C(0xc8c4b8));
      wing.position.set(sx * 0.1, 0.3, -0.04);
      wing.rotation.set(0, sx * 0.5, sx * 0.3);
      angel.add(wing);
    }
    angel.position.y = 0.55;
    tg.add(angel);
    const mound = new THREE.Mesh(rockGeo(0.5, 9, 1, [0.9, 0.18, 1.5]), M('graveGround', { color: 0xa09080 }));
    mound.position.set(0, 0.025, 0.85);
    tg.add(mound);
    tg.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    r.place(tg, -6.3, 3.0, Math.PI / 2, { collide: [0.6, 0.3] });
    r.interact({
      id: 'thomasGrave', x: -5.3, z: 3.0, r: 0.5, label: '小さな墓',
      verb: (gg) => (gg.has('toyBoat') && !gg.flags.boatPlaced ? '供える' : '調べる'),
      use: (gg) => thomasGrave(r, gg),
      item: async (gg, id) => {
        if (id !== 'toyBoat') return false;
        await placeBoat(r, gg);
        return true;
      },
    });
    if (g.flags.boatPlaced) boatOnGrave(r);

    // ---- the mounds the drowned are buried in, not deep
    const dirt = M('graveGround', { color: 0x9a8a70 });
    MOUNDS.forEach(([x, z, ry], i) => {
      const m = new THREE.Mesh(rockGeo(0.55, 30 + i, 1, [0.8, 0.22, 1.5]), dirt);
      m.position.set(x, 0.025, z);
      m.rotation.y = ry;
      r.static.add(m);
      const id = 'graveThrall' + (i + 1);
      if (g.flags['dead:' + id]) return;
      const t = g.spawn(r, { id, type: 'thrall', seed: 20 + i, x, z, rot: ry, onDeath: () => { g.flags['dead:' + id] = true; } });
      if (!g.flags['up:' + id]) t.bury();
    });

    // ---- rain, falling round wherever he is
    r.rain = rainFall(r);
    // moonlight through the storm, which the lightning turns to day
    r.hemi(0x6a7a9a, 0x3a3a2e, 6.0);
    r.spot(-3, 10, 5, 0, 0, -1, { color: 0x8090c0, intensity: 60, distance: 30, angle: 1.0, penumbra: 0.8, window: true });
    r.point(0, 6, 0, { color: 0x4a5878, intensity: 6, distance: 22 });

    r.shot({ id: 'gate', pos: [7.2, 4.2, -5.6], look: [1.2, 0.4, 2.4], fov: 60, zone: [2.0, -7.4, 8.4, 7.4] });
    r.shot({ id: 'graves', pos: [5.0, 4.4, 6.4], look: [-2.8, 0.4, -1.6], fov: 60, zone: [-3.0, -2.0, 2.0, 7.4] });
    r.shot({ id: 'crypt', pos: [1.6, 3.6, 1.6], look: [-4.0, 1.0, -4.6], fov: 58, zone: [-8.4, -7.4, 2.0, -2.0] });
    r.shot({ id: 'sea', pos: [-1.4, 3.4, -1.8], look: [-6.4, 0.5, 3.6], fov: 60, zone: [-8.4, -2.0, -3.0, 7.4] });
  },

  async enter(r, g) {
    // up out of the crypt with Clara, the shrine fallen in behind them
    if (g.flags.finalEscape) { await g.ending(g.flags.boatPlaced ? 'dawn' : 'ember'); return; }
    if (g.flags.graveyardSeen) return;
    g.flags.graveyardSeen = true;
    g.lock();
    g.cut({ pos: [6.6, 2.4, 3.6], look: [-3.0, 1.2, -3.0], fov: 54 });
    await g.wait(1.2);
    await g.say('温室の裏は、崖の上の墓地だった。\n冷たい雨が、無数の墓石を叩いている。');
    g.cut(null);
    g.unlock();
  },

  update(r, g, dt) {
    r.rain.update(dt);
    // the drowned come up out of their graves as he passes
    const p = g.player;
    for (const m of r.monsters) {
      if (m.state !== 'buried' || !p.alive || g.locked) continue;
      if (Math.hypot(p.pos.x - m.pos.x, p.pos.z - m.pos.z) < 2.6) {
        g.flags['up:' + m.id] = true;
        m.emerge();
      }
    }
  },
};

// Bare black branches.
function deadTree() {
  const g = new THREE.Group();
  const bark = C(0x1a1612);
  const limb = (x0, y0, z0, x1, y1, z1, r0, r1) => {
    const d = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, d.length(), 5), bark);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    m.castShadow = true;
    g.add(m);
  };
  limb(0, 0, 0, 0.1, 2.2, 0.05, 0.22, 0.13);
  limb(0.1, 2.0, 0.05, 1.1, 3.0, 0.3, 0.1, 0.03);
  limb(0.1, 1.7, 0.05, -0.9, 2.6, -0.2, 0.09, 0.03);
  limb(0.1, 2.2, 0.05, 0.3, 3.4, -0.4, 0.08, 0.02);
  limb(-0.5, 2.2, -0.1, -0.9, 3.0, 0.4, 0.04, 0.015);
  limb(0.6, 2.5, 0.15, 0.7, 3.2, 0.8, 0.04, 0.015);
  g.userData.col = [0.6, 0.6];
  return g;
}

// Lines of rain in a box that follows the player.
function rainFall(r) {
  const N = 380;
  const pos = new Float32Array(N * 6);
  const seeds = [];
  for (let i = 0; i < N; i++) seeds.push([Math.random() * 16 - 8, Math.random() * 7, Math.random() * 14 - 7]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x7a8aa0, transparent: true, opacity: 0.22 }));
  lines.frustumCulled = false;
  r.dynamic.add(lines);
  let t = 0;
  return {
    update(dt) {
      t += dt;
      const p = r.game.player.pos;
      for (let i = 0; i < N; i++) {
        const s = seeds[i];
        const y = 7 - ((s[1] + t * 9) % 7);
        const x = p.x + ((s[0] - p.x * 0.0) % 16);
        const z = p.z + s[2];
        pos.set([x, y, z, x - 0.04, y - 0.45, z + 0.02], i * 6);
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

function boatOnGrave(r) {
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.07), C(0x8a2a22));
  hull.position.y = 0.03;
  const sail = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.16, 0.1), C(0xe0d8c4));
  sail.position.y = 0.14;
  boat.add(hull, sail);
  boat.position.set(-5.95, 0.12, 3.0);
  boat.rotation.y = 0.4;
  r.dynamic.add(boat);
}

async function thomasGrave(r, g) {
  if (g.flags.boatPlaced) {
    await g.say('小さな墓の前に、赤い帆船が供えてある。\n雨の中で、帆だけが、乾いているように見えた。');
    return;
  }
  if (g.has('toyBoat')) {
    const c = await g.ask('おもちゃの帆船を、墓に供えますか？', ['供える', 'やめる']);
    if (c === 0) await placeBoat(r, g);
    return;
  }
  await g.say('天使の像が守る、小さな墓。\n「トマス・アシュコム　一九〇五――一九一二　潮に召されし子」');
}

async function placeBoat(r, g) {
  if (g.flags.boatPlaced) return;
  g.flags.boatPlaced = true;
  g.inv.remove('toyBoat');
  await g.searchAnim();
  boatOnGrave(r);
  g.audio.sfx('giggle', { at: { x: -6.3, y: 1, z: 3 } });
  await g.say('トマスの墓に、赤い帆船を供えた。\n\n……雨音の向こうで、子供が小さく笑った気がした。');
}
