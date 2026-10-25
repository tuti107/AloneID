// 子供部屋 — Thomas's room at the west end of the upstairs corridor, boarded
// up in 1912 and broken open from the inside now. His music box still
// plays, with its key; and when it plays, he comes.
import * as THREE from 'three';
import * as F from '../furniture.js';
import { M, C } from '../mats.js';
import { buildThomas } from '../characters.js';

const H = 3.0;

export default {
  id: 'nursery',
  name: '子供部屋',
  bounds: [-3.2, -2.7, 3.2, 2.7],
  floorType: 'wood',
  ambience: 'nursery',
  build(r, g) {
    r.shell(-3, -2.5, 3, 2.5, {
      h: H, floor: 'woodFloor', ceil: 'plaster', mat: 'wallpaperRose', wainscot: 'wainscotLight', wainscotH: 0.9, crown: true,
      openings: { s: [{ at: 0.6, w: 1.0, h: 2.15 }], w: [{ at: 0.2, w: 1.0, h: 1.4, sill: 0.9 }] },
    });
    F.rug(r, 'rugBlue', -0.2, 0.1, 3.0, 2.2);
    r.door(0.6, 2.5, Math.PI, { to: 'corridor', entry: 'fromNursery', label: '廊下への扉', wallMat: 'wallpaperRose', panel: 'woodLight' });
    r.entry('fromCorridor', 0.6, 1.85, Math.PI);
    r.window(-3, 0.2, Math.PI / 2, { w: 1.0, h: 1.4, sill: 0.9, curtains: 'curtainGold', intensity: 20, beam: false });

    // ---- his bed, his drawings, his toys
    r.place(F.bed({ w: 0.9, l: 1.65, wood: 'woodLight', canopy: false }), 2.3, -1.6, 0, { collide: [0.95, 1.7] });
    r.place(F.nightstand({ wood: 'woodLight' }), 1.4, -2.2, 0, { collide: [0.5, 0.45] });
    const cnd = F.candle({ h: 0.1 });
    r.place(cnd, 1.42, -2.22, 0, { y: 0.68, cast: false });
    r.flame(1.42, 0.68 + 0.11, -2.22, { size: 0.05, intensity: 2.4, distance: 6 });
    r.interact({ id: 'thomasBed', x: 2.3, z: -0.55, r: 0.5, label: '小さな寝台', use: (gg) => gg.say('子供用の寝台。枕元に、すり切れた熊のぬいぐるみ。\nシーツは、つい今しがたまで誰かが寝ていたように、乱れている。') });
    r.box(C(0x7a5a3a), 0.16, 0.2, 0.12, 2.1, 0.63, -2.15, { ry: 0.4 });
    for (const [x, art, id, text] of [
      [-1.0, 'drawWoman', 'drawingWoman', '子供の絵。「みずのなかの　おんなのひと」\n長い黒髪の女が、波の下からこちらを見上げている。目だけが、白く塗り残されている。'],
      [0.25, 'drawTower', 'drawingTower', '子供の絵。「とうの　あかり」\n塔のてっぺんに、黄色い光。その下の黒い海から、たくさんの手が伸びている。'],
    ]) {
      const p = F.painting({ w: 0.62, h: 0.46, art, frame: 'wood' });
      p.position.set(x, 1.55, -2.48);
      r.static.add(p);
      r.interact({ id, x, z: -1.9, r: 0.4, y: 1.5, label: '子供の絵', use: (gg) => gg.say(text) });
    }
    // building blocks, a ball, a drum on the rug
    const toyCols = [0xa83228, 0x2a5aa0, 0xd0a030, 0x3a8a4a];
    [[-0.2, 0.9, 0.3], [-0.05, 0.98, 1.1], [0.12, 0.84, 2.0], [-0.12, 0.84, 0.7]].forEach(([x, z, ry], i) => r.box(C(toyCols[i % 4]), 0.1, 0.1, 0.1, x, 0.006, z, { ry }));
    r.box(C(toyCols[1]), 0.1, 0.1, 0.1, -0.08, 0.106, 0.9, { ry: 0.8 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), C(0xc84a3a, { phong: true }));
    ball.position.set(0.9, 0.09, 0.6);
    r.static.add(ball);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.14, 12), C(0x8a2a2a));
    drum.position.set(1.2, 0.076, 1.3);
    r.static.add(drum);

    // ---- the rocking horse, which rocks with no one on it
    const horse = rockingHorse();
    horse.position.set(-1.2, 0, -0.9);
    horse.rotation.y = Math.PI / 2;
    r.dynamic.add(horse);
    r.horse = horse;
    r.collider(-1.2, -0.9, 0.55, 0.25);
    r.rock = 0.25;
    r.interact({ id: 'horse', x: -1.2, z: -0.35, r: 0.5, label: '木馬', use: (gg) => gg.say('塗りの剥げた木馬。\n……誰も乗っていないのに、ゆっくりと揺れている。') });

    // ---- the puppet theatre against the west wall
    const th = puppetTheatre();
    r.place(th, -2.62, -1.7, Math.PI / 2, { collide: [1.1, 0.45] });
    r.interact({ id: 'theatre', x: -2.0, z: -1.7, r: 0.5, label: '人形劇の舞台', use: (gg) => gg.say('人形劇の舞台。幕の陰に、水夫と、黒い鴎と、長い髪の女の人形が並んでいる。\n……女の人形の髪だけが、濡れている。') });

    // ---- the music box, on the chest of drawers
    r.place(F.dresser({ w: 0.9, wood: 'woodLight', mirror: false }), 2.73, 0.95, -Math.PI / 2, { collide: true });
    const box = musicBox();
    box.position.set(2.72, 0.95, 0.95);
    box.rotation.y = -Math.PI / 2;
    r.dynamic.add(box);
    r.musicBox = box;
    r.interact({
      id: 'musicBox', x: 2.2, z: 0.95, r: 0.4, y: 1.0, label: 'オルゴール',
      verb: (gg) => (gg.flags.thomasMet ? '調べる' : gg.has('musicBoxKey') ? '鍵を差す' : '調べる'),
      use: (gg) => playBox(r, gg),
      item: async (gg, id) => {
        if (id !== 'musicBoxKey') return false;
        await playBox(r, gg);
        return true;
      },
    });
    if (g.flags.thomasMet && !g.flags['taken:cryptKey']) placeKey(r, g);

    r.hemi(0x6a6a88, 0x22181a, 3.0);
    r.point(0, 2.5, 0, { color: 0x8a7aa0, intensity: 4, distance: 8 });

    r.shot({ id: 'door', pos: [2.6, 2.6, 2.2], look: [-1.2, 0.6, -1.2], fov: 60, zone: [-0.4, -2.7, 3.2, 2.7] });
    r.shot({ id: 'west', pos: [-2.6, 2.6, 2.2], look: [1.6, 0.6, -1.2], fov: 60, zone: [-3.2, -2.7, -0.4, 2.7] });
  },

  async enter(r, g) {
    if (g.flags.nurserySeen) return;
    g.flags.nurserySeen = true;
    g.lock();
    g.cut({ pos: [1.2, 1.5, 2.0], look: [-1.2, 0.5, -0.9], fov: 46 });
    g.audio.sfx('giggle', { at: { x: -2, y: 1, z: -2 } });
    await g.wait(1.4);
    await g.say('板を打ち付けられていたはずの子供部屋。\n板は、内側から叩き割られていた。');
    g.cut(null);
    g.unlock();
  },

  update(r, g, dt) {
    // the horse rocks; harder while the music plays
    r.rockT = (r.rockT || 0) + dt * (1.6 + r.rock * 3);
    r.horse.userData.pivot.rotation.x = Math.sin(r.rockT) * 0.12 * (0.4 + r.rock);
    if (r.thomas) r.thomas.update(dt);
  },
};

// A wooden rocking horse, facing +z, its runners curved under it.
function rockingHorse() {
  const g = new THREE.Group();
  const wood = M('woodLight');
  const paint = C(0xd8ccb8, { flat: true });
  const red = C(0x9a2a22);
  const pivot = new THREE.Group();
  g.add(pivot);
  for (const sx of [-1, 1]) {
    const runner = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.025, 4, 16, 0.9), wood);
    runner.rotation.set(0, Math.PI / 2, Math.PI + 1.12);
    runner.position.set(sx * 0.17, 1.13, 0);
    pivot.add(runner);
  }
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.62), paint);
  body.position.set(0, 0.62, 0);
  pivot.add(body);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.14), paint);
  neck.position.set(0, 0.84, 0.27);
  neck.rotation.x = 0.45;
  pivot.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.3), paint);
  head.position.set(0, 0.98, 0.42);
  head.rotation.x = 0.3;
  pivot.add(head);
  const eye = C(0x101010);
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.025, 0.025), eye);
    e.position.set(sx * 0.068, 1.0, 0.4);
    pivot.add(e);
  }
  const mane = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.12), C(0x3a2a1a));
  mane.position.set(0, 0.9, 0.21);
  mane.rotation.x = 0.45;
  pivot.add(mane);
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.22), red);
  saddle.position.set(0, 0.755, -0.02);
  pivot.add(saddle);
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.06), paint);
    leg.position.set(sx * 0.09, 0.36, sz * 0.24);
    leg.rotation.x = sz * 0.35;
    pivot.add(leg);
  }
  pivot.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.pivot = pivot;
  return g;
}

// A little stage with red curtains and the dark behind them.
function puppetTheatre() {
  const g = new THREE.Group();
  const wood = M('woodRed');
  const add = (m, w, h, d, x, y, z) => {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    me.position.set(x, y + h / 2, z);
    me.castShadow = true;
    g.add(me);
    return me;
  };
  add(wood, 1.0, 0.75, 0.4, 0, 0, 0);
  add(wood, 0.12, 0.8, 0.4, -0.44, 0.75, 0);
  add(wood, 0.12, 0.8, 0.4, 0.44, 0.75, 0);
  add(wood, 1.0, 0.3, 0.4, 0, 1.55, 0);
  add(C(0x050404), 0.76, 0.8, 0.02, 0, 0.75, -0.1);
  const curtain = M('curtainRed', { side: THREE.DoubleSide });
  add(curtain, 0.2, 0.78, 0.03, -0.3, 0.76, 0.1);
  add(curtain, 0.2, 0.78, 0.03, 0.3, 0.76, 0.1);
  add(C(0xc8a040), 0.6, 0.12, 0.02, 0, 1.64, 0.205);
  g.userData.col = [1.0, 0.4];
  return g;
}

// The music box: a walnut case, its lid up, a little ship on the lid.
function musicBox() {
  const g = new THREE.Group();
  const walnut = C(0x4a2a16, { phong: true, shininess: 50 });
  const brass = M('brass', { phong: true, shininess: 60, specular: 0x665533 });
  const add = (m, w, h, d, x, y, z, parent = g) => {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    me.position.set(x, y + h / 2, z);
    me.castShadow = true;
    parent.add(me);
    return me;
  };
  add(walnut, 0.24, 0.1, 0.16, 0, 0, 0);
  add(brass, 0.16, 0.025, 0.04, 0, 0.1, -0.02);
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.15, 8), brass);
  cyl.rotation.z = Math.PI / 2;
  cyl.position.set(0, 0.11, 0.03);
  g.add(cyl);
  g.userData.cyl = cyl;
  const lid = new THREE.Group();
  lid.position.set(0, 0.1, -0.08);
  lid.rotation.x = -1.9;
  g.add(lid);
  add(walnut, 0.24, 0.02, 0.16, 0, 0, 0.08, lid);
  add(M('mirror'), 0.2, 0.004, 0.12, 0, 0.021, 0.08, lid);
  const hull = add(C(0x8a2a22), 0.07, 0.025, 0.02, 0.04, 0.1, 0.06);
  hull.rotation.y = 0.3;
  const sail = add(C(0xe0d8c4), 0.003, 0.05, 0.03, 0.04, 0.125, 0.06);
  sail.rotation.y = 0.3;
  return g;
}

function placeKey(r, g) {
  r.pickup('cryptKey', 0.2, 0.02, -0.2, { label: '古い鍵', ry: 0.6, r: 0.4 });
}

// The music box plays, and Thomas comes to hear it.
async function playBox(r, g) {
  if (g.flags.thomasMet) {
    await g.say('オルゴールの蓋の裏に、子供の字で「トマス」。\n……もう、鳴らない。');
    return;
  }
  if (!g.has('musicBoxKey')) {
    await g.say('小さなオルゴール。蓋の上に、赤い帆船の飾り。\nぜんまいを巻く鍵穴があるが、鍵がない。');
    return;
  }
  const c = await g.ask('オルゴールに、蝶の形の鍵を差し込みますか？', ['差し込む', 'やめる']);
  if (c !== 0) return;
  g.flags.thomasMet = true;
  g.inv.remove('musicBoxKey');
  g.lock();
  await g.reachAnim();
  g.cut({ pos: [1.5, 1.3, 1.9], look: [-0.1, 0.8, -0.4], fov: 52 });
  g.audio.music(null);
  g.audio.sfx('musicBox', { at: { x: 2.7, y: 1, z: 0.95 } });
  // the room dims, the horse rocks, and someone laughs, here and there
  const st = { v: 0 };
  const iv = setInterval(() => {
    r.rock = 0.25 + st.v * 1.2;
    if (r.hemiLight) r.hemiLight.intensity = r.hemiBase * (1 - st.v * 0.45);
  }, 16);
  g.tween(st, 'v', 1, 3);
  for (const [x, z] of [[-2.4, -2], [2.4, -2], [-1.5, 2]]) {
    await g.wait(1.1);
    g.audio.sfx('giggle', { at: { x, y: 1, z } });
  }
  // there he is, by the horse
  const t = buildThomas();
  t.root.position.set(-0.1, 0, -0.5);
  t.root.rotation.y = Math.atan2(1.6 + 0.1, 1.9 + 0.5);
  t.setFade(0);
  r.dynamic.add(t.root);
  r.thomas = t;
  const f = { v: 0 };
  const iv2 = setInterval(() => t.setFade(f.v), 16);
  await g.tween(f, 'v', 1, 1.6);
  clearInterval(iv2);
  t.setFade(1);
  g.cut({ pos: [0.9, 1.25, 0.9], look: [-0.1, 0.95, -0.5], fov: 40 });
  await g.say('……おじさん、だあれ？\nぼくのオルゴール、鳴らしてくれたんだね。');
  if (g.has('toyBoat')) {
    g.flags.boatAsked = true;
    await g.say('あ……ぼくの「トマス号」！\n海で、なくしちゃったんだ。\n\n……ねえ、ぼくのお墓に、置いてくれる？');
  }
  await g.say('おじいさまはね、海の下の悪い神さまと、約束したんだ。\n……あのおねえさんも、いまはそこにいるよ。');
  await g.say('これ、おじいさまのお部屋の鍵。\nお墓の下の、お部屋だよ。');
  t.giveKey();
  await g.wait(0.6);
  placeKey(r, g);
  g.audio.sfx('giggle', { at: { x: -0.1, y: 1, z: -0.5 } });
  const f2 = { v: 1 };
  const iv3 = setInterval(() => t.setFade(f2.v), 16);
  await g.tween(f2, 'v', 0, 1.4);
  clearInterval(iv3);
  r.dynamic.remove(t.root);
  r.thomas = null;
  clearInterval(iv);
  r.rock = 0.25;
  if (r.hemiLight) r.hemiLight.intensity = r.hemiBase;
  g.cut(null);
  g.unlock();
  await g.say('少年の姿は消え、床に古い鍵が残されていた。');
}

