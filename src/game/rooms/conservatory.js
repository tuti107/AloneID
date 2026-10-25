// 温室 — a glass house in the storm, gone over to black weed from the South
// Seas. Its pond hides what a drowned boy lost there; three valves let the
// water out, in the order the gardener wrote down. The weed has the gardener.
import * as THREE from 'three';
import * as F from '../furniture.js';
import { M, C, spriteMat } from '../mats.js';
import { tex } from '../../engine/textures.js';

const H = 3.2, RIDGE = 4.6;
// the pond, and the valves along the east wall, in their order
const POND = [-1.6, -0.9, 2.2, 1.5];
const VALVES = [
  { id: 'anchor', name: '錨', z: -2.2 },
  { id: 'star', name: '星', z: -0.2 },
  { id: 'moon', name: '月', z: 1.8 },
];
const ORDER = ['moon', 'anchor', 'star'];

export default {
  id: 'conservatory',
  name: '温室',
  bounds: [-5.2, -4.7, 5.2, 4.7],
  floorType: 'stone',
  ambience: 'rain',
  build(r, g) {
    r.floor(-5, -4.5, 5, 4.5, 'stoneFloor', 0, 'stone');
    r.camRect = [-5, -4.5, 5, 4.5, H];
    // the house wall to the north, with the door to the gallery
    r.wall(-5, -4.5, 5, -4.5, { h: RIDGE, mat: 'stoneWall', normal: [0, 1], openings: [{ at: 5, w: 1.1, h: 2.3 }] });
    r.door(0, -4.5, 0, { to: 'gallery', entry: 'fromConservatory', label: '回廊への扉', wallMat: 'stoneWall', panel: 'wood', glass: true });
    r.entry('fromGallery', 0, -3.8, 0);
    // low brick walls round the rest, glass above them
    r.wall(5, -4.5, 5, 4.5, { h: 0.9, mat: 'brick', normal: [-1, 0], baseboard: false });
    r.wall(5, 4.5, -5, 4.5, { h: 0.9, mat: 'brick', normal: [0, -1], baseboard: false });
    r.wall(-5, 4.5, -5, -4.5, { h: 0.9, mat: 'brick', normal: [1, 0], baseboard: false, openings: [{ at: 3.0, w: 1.0, h: 2.2, pass: false }] });
    // a stone sill along the top of the brick
    r.box('stoneFloor', 0.3, 0.06, 9.0, 5.1, 0.9, 0, { cast: false });
    r.box('stoneFloor', 10.4, 0.06, 0.3, 0, 0.9, 4.6, { cast: false });
    r.box('stoneFloor', 0.3, 0.06, 2.5, -5.1, 0.9, 3.25, { cast: false });
    r.box('stoneFloor', 0.3, 0.06, 5.5, -5.1, 0.9, -1.75, { cast: false });
    glassHouse(r);

    // ---- the garden door, out to the graveyard
    r.door(-5, 1.5, Math.PI / 2, {
      id: 'gardenDoor', to: 'graveyard', entry: 'fromConservatory', label: '庭口', wallMat: 'brick', panel: 'iron', glass: true,
      locked: true, key: 'gardenKey', lockedMsg: '庭へ出る鉄の扉。錠が下りている。\n……ガラスの向こうは、雨と闇ばかりだ。',
      onOpen: async (gg) => {
        if (gg.hasRoom('graveyard')) return true;
        await gg.notYet();
        return false;
      },
    });
    r.entry('fromGraveyard', -4.35, 1.5, Math.PI / 2);

    // ---- the pond
    const [px0, pz0, px1, pz1] = POND;
    const cx = (px0 + px1) / 2, cz = (pz0 + pz1) / 2, pw = px1 - px0, pd = pz1 - pz0;
    for (const [x, z, w, d] of [[cx, pz0 - 0.1, pw + 0.4, 0.2], [cx, pz1 + 0.1, pw + 0.4, 0.2], [px0 - 0.1, cz, 0.2, pd], [px1 + 0.1, cz, 0.2, pd]]) {
      r.box('stoneWall', w, 0.35, d, x, 0, z);
    }
    r.collider(cx, cz, pw / 2 + 0.2, pd / 2 + 0.2);
    // mud at the bottom, and the water over it
    r.box(M('dirt', { ts: [1, 1] }), pw, 0.05, pd, cx, -0.03, cz, { cast: false });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), new THREE.MeshPhongMaterial({ color: 0x0a1810, specular: 0x8aaa9a, shininess: 120, transparent: true, opacity: 0.9 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(cx, 0.28, cz);
    r.dynamic.add(water);
    r.water = water;
    if (g.flags.pondDrained) { water.position.y = 0.0; water.visible = false; }
    // weed growing out of it
    for (let i = 0; i < 7; i++) {
      const k = F.cy(r.static, C(0x16301e), 0.02, 0.05, 0.6 + (i % 3) * 0.3, px0 + 0.3 + (i * 0.53) % (pw - 0.5), 0.0, pz0 + 0.25 + ((i * 0.71) % (pd - 0.4)), 5);
      void k;
    }
    r.interact({
      id: 'pond', x: cx, z: pz1 + 0.6, r: 0.5, label: '池',
      use: (gg) => gg.say(gg.flags.pondDrained ? '水の抜けた池の底は、黒い泥に覆われている。' : '海草のはびこった池。黒い水の底は見えない。\n……何か小さなものが、泥に沈んでいる気がする。'),
    });
    if (g.flags.pondDrained) placeFinds(r, g);

    // ---- three valves on the pipe along the east wall
    r.box('iron', 0.1, 0.1, 6.0, 4.75, 1.3, -0.2);
    r.box('iron', 0.1, 1.3, 0.1, 4.75, 0, -3.2);
    r.box('iron', 3.2, 0.1, 0.1, 3.15, 0.05, -3.2);
    r.valves = {};
    for (const V of VALVES) {
      r.box('iron', 0.08, 0.3, 0.08, 4.62, 1.0, V.z);
      const wheel = new THREE.Group();
      wheel.position.set(4.52, 1.05, V.z);
      wheel.rotation.y = Math.PI / 2;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 6, 14), C(0x8a1a12, { phong: true, shininess: 40 }));
      wheel.add(rim);
      for (let k = 0; k < 3; k++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.02), C(0x8a1a12));
        spoke.rotation.z = (k / 3) * Math.PI;
        wheel.add(spoke);
      }
      r.dynamic.add(wheel);
      // an enamel plate with its sign
      r.box(C(0xd8d4c0), 0.02, 0.16, 0.16, 4.86, 1.5, V.z);
      const sign = makeSign(V.id);
      sign.position.set(4.845, 1.58, V.z);
      sign.rotation.y = -Math.PI / 2;
      r.dynamic.add(sign);
      r.valves[V.id] = { V, wheel };
      r.interact({
        id: 'valve_' + V.id, x: 4.0, z: V.z, r: 0.35, label: `${V.name}の弁`,
        verb: '回す',
        use: (gg) => turnValve(r, gg, V),
      });
    }

    // ---- the gardener's bench, plants, and the weed that has him
    r.place(F.counter({ w: 1.6, d: 0.55, h: 0.88, top: 'wood' }), -2.6, -4.05, 0, { collide: true });
    r.pickup('gardener', -2.9, 0.89, -4.0, { label: '作業帳', ry: 0.4, onTake: async (gg) => { const c = await gg.ask('読みますか？', ['読む', 'あとで']); if (c === 0) await gg.readDoc('gardener'); } });
    r.pickup('flask', -1.95, 0.89, -3.95, { id: 'benchFlask', ry: 1.3 });
    r.place(F.barrel({ r: 0.3, h: 0.7 }), -4.5, -3.9, 0, { collide: true });
    for (const [x, z] of [[3.9, 3.9], [1.2, 3.95], [-1.8, 3.95], [3.9, -3.9]]) potted(r, x, z);
    for (let i = 0; i < 9; i++) {
      // strands hanging from the rafters
      const x = -4 + i * 1.0, z = (i % 2 ? 1 : -1) * (1.2 + (i % 3) * 0.8);
      r.box(C(0x16301e), 0.03, 0.9 + (i % 4) * 0.35, 0.03, x, H - 0.4 - (i % 4) * 0.35, z, { cast: false });
    }
    if (!g.flags['dead:vine']) {
      g.spawn(r, { id: 'vine', type: 'vine', x: -3.6, z: 3.1, rot: 0.6, onDeath: () => vineDies(r, g) });
    } else {
      g.spawn(r, { id: 'vine', type: 'vine', x: -3.6, z: 3.1, rot: 0.6 }).restore({ hp: 0, x: -3.6, z: 3.1, rot: 0.6, dead: true });
      if (!g.flags['taken:gardenKey']) placeKey(r, g);
    }
    r.collider(-3.6, 3.1, 0.8, 0.8);

    // ---- figures outside the glass, more each time the lightning comes
    r.watchers = [];
    const shapes = [[-6.0, 3.6], [-6.2, -1.2], [-2.0, 5.8], [1.6, 6.1], [-6.4, 0.6], [4.4, 5.9], [6.0, 2.8], [-4.6, 5.9]];
    for (const [x, z] of shapes) {
      const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.85), new THREE.MeshBasicMaterial({ map: tex('silhouette'), color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
      sp.position.set(x, 0.92, z);
      sp.lookAt(0, 0.92, 0);
      r.dynamic.add(sp);
      r.watchers.push(sp);
    }
    r.seen = 0;
    r.updaters.push(() => {
      if (r.flash > 0.9 && !r.flashed) { r.flashed = true; r.seen = Math.min(r.watchers.length, r.seen + 2); }
      if (r.flash < 0.2) r.flashed = false;
      r.watchers.forEach((w, i) => { w.material.opacity = i < r.seen ? Math.min(0.85, r.flash * 1.4) : 0; });
    });

    r.hemi(0x5a6a88, 0x1a221c, 3.4);
    r.point(0, 3.4, 0, { color: 0x6a80a0, intensity: 12, distance: 13 });
    // the weed gives off a sickly light of its own
    r.point(-3.2, 1.4, 2.6, { color: 0x7aa050, intensity: 5, distance: 5, flicker: 0.3, speed: 1.2 });
    r.point(-2.6, 1.6, -3.6, { color: 0xffb070, intensity: 3, distance: 5, flicker: 0.2 });
    r.place(F.candle({ h: 0.14 }), -2.2, -4.1, 0, { y: 0.88, cast: false });
    r.flame(-2.2, 0.88 + 0.15, -4.1, { size: 0.06, intensity: 0, light: false });

    r.shot({ id: 'door', pos: [3.6, 3.4, -3.9], look: [-1.8, 0.6, 1.6], fov: 62, zone: [-5.2, -4.7, 5.2, 0.4] });
    r.shot({ id: 'far', pos: [-3.0, 3.5, -3.4], look: [1.6, 0.5, 2.8], fov: 62, zone: [-5.2, 0.4, 5.2, 4.7] });
  },

  async enter(r, g) {
    if (g.flags.conservatorySeen) return;
    g.flags.conservatorySeen = true;
    g.lock();
    g.cut({ pos: [1.6, 1.5, -3.6], look: [-3.4, 1.0, 2.8], fov: 50 });
    await g.wait(1.2);
    await g.say('雨がガラスを叩く温室。\n見たこともない黒い海草が、床から天井まで這い上がっている。');
    await g.say('奥の隅の、あの塊……\n草の中に、人の顔が埋もれている。');
    g.cut(null);
    g.unlock();
  },
};

// Iron and glass over the brick: posts, a pitched roof, and rain on all of it.
function glassHouse(r) {
  const glassMat = new THREE.MeshBasicMaterial({ color: 0x101c2a, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide });
  const rainMat = new THREE.MeshBasicMaterial({ map: tex('rain').clone(), transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  rainMat.map.needsUpdate = true;
  rainMat.map.repeat.set(2.5, 1.2);
  r.updaters.push((dt) => { rainMat.map.offset.y += dt * 1.6; glassMat.color.setHex(0x101c2a).multiplyScalar(1 + r.flash * 7); });
  const pane = (w, h, x, y, z, ry, rx = 0) => {
    for (const m of [glassMat, rainMat]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      p.position.set(x, y, z);
      p.rotation.set(rx, ry, 0, 'YXZ');
      p.renderOrder = 3;
      r.dynamic.add(p);
    }
  };
  const gh = H - 0.9;
  pane(9.0, gh, 5.0, 0.9 + gh / 2, 0, -Math.PI / 2);
  pane(10.0, gh, 0, 0.9 + gh / 2, 4.5, Math.PI);
  pane(9.0, gh, -5.0, 0.9 + gh / 2, 0, Math.PI / 2);
  // the roof: two slopes up from the long sides to a ridge running east-west
  const slope = Math.atan2(RIDGE - H, 4.5), len = Math.hypot(RIDGE - H, 4.5);
  pane(10.0, len, 0, (H + RIDGE) / 2, 2.25, 0, -(Math.PI / 2 - slope));
  pane(10.0, len, 0, (H + RIDGE) / 2, -2.25, 0, Math.PI / 2 - slope);
  // gable ends
  for (const x of [-5, 5]) {
    const sh = new THREE.Shape();
    sh.moveTo(-4.5, 0);
    sh.lineTo(4.5, 0);
    sh.lineTo(0, RIDGE - H);
    sh.closePath();
    const geo = new THREE.ShapeGeometry(sh);
    const m = new THREE.Mesh(geo, glassMat);
    m.position.set(x, H, 0);
    m.rotation.y = Math.PI / 2;
    r.dynamic.add(m);
  }
  // iron: posts, eaves, ridge and rafters
  for (let i = 0; i <= 8; i++) {
    const x = -5 + i * 1.25;
    for (const z of [-4.48, 4.48]) {
      if (z < 0) continue; // the north side is the house wall
      r.box('iron', 0.06, H - 0.96, 0.06, x, 0.96, z, { cast: false });
    }
    // rafters up to the ridge
    for (const sz of [-1, 1]) {
      const raf = r.box('iron', 0.05, 0.05, len, x, (H + RIDGE) / 2 - 0.025, sz * 2.25, { cast: false });
      raf.rotation.x = sz * slope;
    }
  }
  for (let i = 0; i <= 7; i++) {
    const z = -4.5 + i * 1.28;
    for (const x of [-4.98, 4.98]) r.box('iron', 0.06, H - 0.96, 0.06, x, 0.96, z, { cast: false });
  }
  r.box('iron', 10.1, 0.08, 0.08, 0, H, 4.48, { cast: false });
  r.box('iron', 0.08, 0.08, 8.94, -4.98, H, 0.03, { cast: false });
  r.box('iron', 0.08, 0.08, 8.94, 4.98, H, 0.03, { cast: false });
  r.box('iron', 10.1, 0.08, 0.08, 0, RIDGE, 0, { cast: false });
}

function potted(r, x, z) {
  const pot = new THREE.Group();
  F.cy(pot, C(0x6a3a22), 0.24, 0.18, 0.4, 0, 0, 0, 8);
  for (let i = 0; i < 6; i++) {
    const blade = F.bx(pot, C(0x16301e), 0.04, 0.9 + (i % 3) * 0.25, 0.015, Math.cos(i) * 0.1, 0.35, Math.sin(i) * 0.1);
    blade.rotation.set(Math.sin(i * 2.1) * 0.35, i, Math.cos(i * 1.7) * 0.35);
  }
  r.place(pot, x, z, 0, { collide: [0.5, 0.5] });
}

function makeSign(id) {
  const g = new THREE.Group();
  const m = C(0x1a1a2a);
  if (id === 'anchor') {
    F.bx(g, m, 0.012, 0.09, 0.005, 0, -0.045, 0);
    F.bx(g, m, 0.06, 0.012, 0.005, 0, -0.02, 0);
    F.bx(g, m, 0.07, 0.012, 0.005, 0, -0.09, 0);
  } else if (id === 'star') {
    for (let i = 0; i < 3; i++) {
      const b = F.bx(g, m, 0.09, 0.012, 0.005, 0, -0.06, 0);
      b.rotation.z = (i / 3) * Math.PI;
    }
  } else {
    const c = new THREE.Mesh(new THREE.RingGeometry(0.025, 0.04, 12, 1, 0.6, Math.PI * 1.3), m);
    c.position.y = -0.06;
    g.add(c);
  }
  return g;
}

// The valves in the gardener's order: moon, anchor, star. Out of order, the
// water bursts back up and they all spin shut.
async function turnValve(r, g, V) {
  if (g.flags.pondDrained) { await g.say('弁は開いたままだ。池の水は、もう抜けている。'); return; }
  const v = r.valves[V.id];
  const turned = (r.turned = r.turned || []);
  if (turned.includes(V.id)) { await g.say(`${V.name}の弁は、もう開いている。`); return; }
  await g.reachAnim();
  g.audio.sfx('creak', { at: v.wheel.position });
  g.audio.sfx('mechanism', { at: v.wheel.position });
  const st = { a: v.wheel.rotation.z };
  await g.tween(v.wheel.rotation, 'z', st.a + Math.PI * 2, 0.8);
  turned.push(V.id);
  if (turned.some((id, i) => id !== ORDER[i])) {
    r.turned = [];
    g.audio.sfx('splash', { at: { x: 0.3, y: 0.3, z: 0.3 } });
    g.burst('splash', 0.3, 0.4, 0.3, { n: 30, speed: 2.5, up: 3.5 });
    g.shake(0.06, 0.4);
    for (const o of Object.values(r.valves)) g.tween(o.wheel.rotation, 'z', 0, 0.5);
    await g.say('配管が唸り、池の水が逆に噴き上がった！\n弁はすべて、ひとりでに閉じてしまった。');
    return;
  }
  if (turned.length < ORDER.length) { await g.say(`${V.name}の弁を開いた。配管の奥で、水の流れる音がする。`); return; }
  // all three: the pond empties
  g.flags.pondDrained = true;
  g.lock();
  g.cut({ pos: [1.2, 2.4, 3.6], look: [0.3, 0.0, 0.3], fov: 50 });
  g.audio.sfx('bubble', { at: { x: 0.3, y: 0, z: 0.3 } });
  g.audio.sfx('pour', { at: { x: 0.3, y: 0, z: 0.3 } });
  await g.tween(r.water.position, 'y', 0.0, 2.6);
  r.water.visible = false;
  placeFinds(r, g);
  await g.say('ごぼごぼと音を立てて、池の水が抜けていった。\n黒い泥の中に、何かが二つ光っている。');
  g.cut(null);
  g.unlock();
}

function placeFinds(r, g) {
  r.pickup('musicBoxKey', -0.6, 0.02, 0.9, { label: '泥の中の鍵', ry: 0.7, r: 0.35, reach: 1.1 });
  r.pickup('toyBoat', 1.3, 0.04, -0.2, { label: '泥の中の帆船', ry: 2.2, r: 0.35, reach: 1.1 });
}

function placeKey(r, g) {
  r.pickup('gardenKey', -2.85, 0.03, 2.4, { label: '草の中の鍵', ry: 1.1 });
}

async function vineDies(r, g) {
  g.flags['dead:vine'] = true;
  await g.wait(2.0);
  placeKey(r, g);
  await g.run(async () => {
    g.lock();
    await g.say('黒い草の塊が萎れ、崩れ落ちていく。\n埋もれていた男の手から、鉄の鍵が滑り落ちた。');
    g.unlock();
  });
}
