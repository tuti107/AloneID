// 使用人棟 — behind the kitchen, the servants' passage: Agnes's room, the
// cold store, and Harlow's room, locked, with his keys in it. Things in the
// walls reach out at anyone going by (a nod to the arms in the walls of
// Alone in the Dark).
import * as THREE from 'three';
import * as F from '../furniture.js';
import { C } from '../mats.js';
import { buildDrownedArm } from '../characters.js';
import { rockGeo } from '../../engine/geom.js';

const H = 2.8;
// where arms come through the plaster: x and z of the wall's face, and which
// way is out of it (+1 south, -1 north), height
const ARMS = [[-3.6, 3.5, -1, 1.3], [-1.2, 3.5, -1, 1.5], [0.9, 3.5, -1, 1.3], [1.45, 0.5, 1, 1.45], [-2.7, 0.5, 1, 1.35]];

export default {
  id: 'servants',
  name: '使用人棟',
  bounds: [-6.2, -3.7, 6.2, 3.7],
  floorType: 'wood',
  ambience: 'tide',
  build(r, g) {
    r.shell(-6, -3.5, 6, 3.5, {
      h: H, floor: 'woodFloorDark', ceil: 'plasterDark', mat: 'plasterDark', wainscot: 'wainscotLight', wainscotH: 1.0,
      openings: { w: [{ at: 2.0, w: 1.0, h: 2.15 }], e: [{ at: 2.0, w: 0.9, h: 1.3, sill: 0.95 }], s: [{ at: 2.8, w: 1.0, h: 2.15 }] },
    });
    // the passage runs along the south; three rooms open off it to the north
    r.wall(-6, 0.5, 6, 0.5, { h: H, mat: 'plasterDark', normal: [0, 1], wainscot: 'wainscotLight', wainscotH: 1.0, openings: [{ at: 2, w: 1.0, h: 2.15, pass: true }, { at: 6, w: 1.1, h: 2.15, pass: true }, { at: 10, w: 1.0, h: 2.15, pass: true }] });
    // (Harlow's doorway is shut by its door's own collider until it opens)
    // dark wood architraves round the two open doorways, so they read as
    // ways in from the passage and not as a shadow on the wall
    for (const [x, w] of [[-4, 1.0], [0, 1.1]]) {
      for (const sx of [-1, 1]) r.box('woodBlack', 0.12, 2.27, 0.05, x + sx * (w / 2 + 0.057), 0, 0.522, { cast: false });
      r.box('woodBlack', w + 0.34, 0.13, 0.06, x, 2.15, 0.527, { cast: false });
    }
    r.wall(-2, -3.5, -2, 0.3, { h: H, mat: 'plasterDark', normal: [1, 0], baseboard: false });
    r.wall(2, -3.5, 2, 0.3, { h: H, mat: 'plasterDark', normal: [1, 0], baseboard: false });
    F.rug(r, 'carpetRunner', 0, 2.0, 1.1, 11.4, Math.PI / 2);
    // the tower, out there in the rain
    r.window(6, 2.0, -Math.PI / 2, { w: 0.9, h: 1.3, sill: 0.95, intensity: 22, beam: false });

    // ---- doors
    r.door(-6, 2.0, Math.PI / 2, { to: 'kitchen', entry: 'fromServants', label: '厨房への扉', wallMat: 'plasterDark', panel: 'wood' });
    r.entry('fromKitchen', -5.35, 2.0, Math.PI / 2);
    r.door(2.8, 3.5, Math.PI, {
      id: 'boilerDoor', to: 'boiler', entry: 'fromServants', label: 'ボイラー室への扉', wallMat: 'plasterDark', panel: 'iron', panelInset: 'rust', sound: 'doorHeavy',
      locked: true, key: 'keyring', lockedMsg: '鍵がかかっている。扉の隙間から、冷えた石炭の匂いがする。\n真鍮の札に「ボイラー室」。',
      unlockMsg: 'ハーロウの鍵束から「ボイラー室」の札の鍵を選んで、扉を開けた。',
      onOpen: async (gg) => {
        if (gg.hasRoom('boiler')) return true;
        await gg.notYet();
        return false;
      },
    });
    r.entry('fromBoiler', 2.8, 2.85, Math.PI);
    // Harlow's own door, inside the wing
    const harlow = r.door(4, 0.5, 0, {
      id: 'harlowDoor', label: 'ハーロウの部屋の扉', wallMat: 'plasterDark', panel: 'woodRed',
      locked: true, key: 'coldKey', lockedMsg: '鍵がかかっている。真鍮の札に「ハーロウ」。',
      unlockMsg: 'ハーロウの部屋の鍵で、扉を開けた。',
      onOpen: async (gg) => { await openHarlow(r, gg, harlow); return false; },
    });
    if (g.flags.harlowOpen) {
      harlow.setOpen(1);
      harlow.voidMesh.visible = false;
      harlow.collider.enabled = false;
      r.interactables = r.interactables.filter((i) => i.id !== 'harlowDoor');
    }

    // ---- Agnes's room
    r.place(F.bed({ w: 1.0, l: 1.9, wood: 'wood', canopy: false }), -5.2, -2.45, 0, { collide: [1.0, 1.9] });
    r.box('leather', 0.52, 0.2, 0.34, -5.15, 0.635, -1.95, { ry: 0.2 });
    r.place(F.nightstand({ wood: 'wood' }), -3.6, -3.12, 0, { collide: [0.5, 0.45] });
    r.place(F.chair({ wood: 'wood', seat: 'wood' }), -2.75, -1.6, -1.2, { collide: [0.45, 0.45] });
    r.pickup('agnes', -3.6, 0.69, -3.1, { label: '出されない手紙', ry: 0.3, onTake: async (gg) => { const c = await gg.ask('読みますか？', ['読む', 'あとで']); if (c === 0) await gg.readDoc('agnes'); } });
    r.interact({ id: 'agnesBed', x: -4.35, z: -1.9, r: 0.5, label: '寝台', use: (gg) => gg.say('メイドの寝台。きちんと畳まれた毛布の上に、旅行鞄が置かれたままだ。\n……出ていくつもりで、出ていけなかったのだろうか。') });

    // ---- the cold store: things on hooks, and a key on one of them
    const meat = C(0x5a1814, { phong: true, flat: false, shininess: 30, specular: 0x2a1410 });
    const bone = C(0xc8bca0);
    for (const [x, z, s] of [[-1.45, -2.75, 1], [-0.85, -3.05, 0.9], [0.95, -3.05, 0.95], [1.45, -2.6, 1.05]]) {
      r.box('iron', 0.025, 0.75, 0.025, x, H - 0.75, z, { cast: false });
      const c = new THREE.Mesh(rockGeo(0.21 * s, Math.round(x * 10 + 40), 1, [0.9, 2.1, 0.65]), meat);
      c.position.set(x, 2.08 - 0.46 * s, z);
      c.rotation.y = x * 2;
      c.castShadow = true;
      r.static.add(c);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.22, 5), bone);
      b.position.set(x + 0.03, 2.08 - 0.92 * s - 0.04, z);
      b.rotation.z = 0.2;
      r.static.add(b);
      r.collider(x, z, 0.16, 0.14);
    }
    r.place(F.crate({ s: 0.6 }), -1.45, -1.25, 0.2, { collide: true });
    r.place(F.barrel(), 1.4, -1.2, 0, { collide: true });
    r.pickup('morgan', 1.4, 0.86, -1.2, { label: '帳簿', ry: 0.8, onTake: async (gg) => { const c = await gg.ask('読みますか？', ['読む', 'あとで']); if (c === 0) await gg.readDoc('morgan'); } });
    r.box('iron', 0.025, 1.3, 0.025, 0.0, 1.5, -3.3, { cast: false });
    r.pickup('coldKey', 0.0, 1.42, -3.27, { label: '鉤に掛かった鍵', ry: 0, r: 0.35, reach: 0.9 });
    r.decal('blood', -0.1, -2.1, 1.3, 1.1, 0.6);
    r.pickup('tonic', -1.45, 0.61, -1.25, { id: 'coldTonic', ry: 0.4 });
    r.interact({ id: 'carcasses', x: -1.1, z: -2.15, r: 0.5, label: '吊るされた肉', use: (gg) => gg.say('天井の鉤に、正体の分からない肉が吊るされている。\n……どれも、ちょうど人の背丈ほどの大きさだ。') });

    // ---- Harlow's room
    r.place(F.bed({ w: 0.95, l: 1.9, wood: 'woodBlack', canopy: false }), 5.2, -2.45, 0, { collide: [0.95, 1.9] });
    r.place(F.desk({ w: 1.1, d: 0.55, wood: 'woodBlack' }), 3.0, -3.08, 0, { collide: true });
    r.place(F.coatRack(), 2.5, -0.35, 0.4, { collide: true });
    r.pickup('keyring', 3.15, 0.79, -3.0, { label: '鍵束', ry: 0.5 });
    r.pickup('ammo', 5.25, 0.64, -1.95, { id: 'harlowAmmo', label: '弾の箱', ry: 0.3, give: { count: 6 } });
    r.interact({ id: 'harlowDesk', x: 2.75, z: -2.5, r: 0.45, label: '机', use: (gg) => gg.say('机の上には、磨き上げられた燭台と懐中時計。\n時計の針は、七時で止まっている。') });

    // ---- light
    for (const [x, z, ry] of [[-6, 3.0, Math.PI / 2], [6, 0.95, -Math.PI / 2], [-5.0, 3.5, Math.PI], [4.2, 3.5, Math.PI]]) {
      const sc = F.sconce();
      sc.position.set(x, 1.9, z);
      sc.rotation.y = ry;
      r.static.add(sc);
      const f = sc.userData.flames[0];
      r.flame(x + f[2] * Math.sin(ry), 1.9 + f[1], z + f[2] * Math.cos(ry), { size: 0.06, intensity: 2.6, distance: 6 });
    }
    r.point(-4, 2.3, -1.5, { color: 0x7484a8, intensity: 7, distance: 6.5 });
    r.point(0, 2.3, -1.6, { color: 0x9a6050, intensity: 6, distance: 6.5 });
    r.point(4, 2.3, -1.5, { color: 0x7484a8, intensity: 7, distance: 6.5 });
    r.point(0, 2.4, 2.0, { color: 0x6a7a9a, intensity: 5, distance: 9 });
    r.hemi(0x5a6a8a, 0x1a1612, 3.3);

    // ---- the arms in the walls
    r.arms = ARMS.map(([x, z, out, y], i) => armSpot(r, g, x, z, out, y, i));

    // ---- the drowned: one in the passage, one waiting in Harlow's room
    if (!g.flags['dead:servThrall1']) g.spawn(r, { id: 'servThrall1', type: 'thrall', seed: 7, x: 3.6, z: 2.2, rot: -Math.PI / 2, onDeath: () => { g.flags['dead:servThrall1'] = true; } });
    if (!g.flags['dead:servThrall2']) g.spawn(r, { id: 'servThrall2', type: 'thrall', seed: 8, x: 3.5, z: -1.5, rot: Math.PI, dormant: !g.flags.harlowOpen, onDeath: () => { g.flags['dead:servThrall2'] = true; } });

    // the passage cameras all look west, so walking the length of it never
    // turns the picture round; the west two look across from the south wall
    // so Agnes's door and the cold store's stand open in the picture
    // (each stands in the next zone east, so its own zone is all in front of
    // it, right up against the south wall)
    r.shot({ id: 'passW', pos: [-0.2, 2.6, 3.3], look: [-5.2, 0.7, 0.2], fov: 60, zone: [-6.2, 0.4, -2.0, 3.7] });
    r.shot({ id: 'passC', pos: [3.7, 2.6, 3.3], look: [-1.3, 0.7, 0.2], fov: 60, zone: [-2.0, 0.4, 2.0, 3.7] });
    r.shot({ id: 'passE', pos: [5.7, 2.5, 0.85], look: [0.2, 0.7, 2.6], fov: 58, zone: [2.0, 0.4, 6.2, 3.7] });
    r.shot({ id: 'agnes', pos: [-2.4, 2.5, 0.05], look: [-4.8, 0.6, -2.4], fov: 60, zone: [-6.2, -3.7, -2.0, 0.4] });
    r.shot({ id: 'cold', pos: [1.6, 2.5, 0.05], look: [-0.4, 0.8, -2.6], fov: 60, zone: [-2.0, -3.7, 2.0, 0.4] });
    r.shot({ id: 'harlow', pos: [2.4, 2.5, 0.05], look: [4.8, 0.6, -2.4], fov: 60, zone: [2.0, -3.7, 6.2, -1.2] });
    // coming in at Harlow's door: from the far corner, the doorway in view
    r.shot({ id: 'harlowIn', pos: [5.75, 2.55, -2.9], look: [3.6, 0.5, 0.4], fov: 60, zone: [2.0, -1.2, 6.2, 0.4] });
  },

  async enter(r, g) {
    if (g.flags.servantsSeen) return;
    g.flags.servantsSeen = true;
    g.lock();
    g.cut({ pos: [-5.3, 1.6, 2.9], look: [3.0, 1.2, 1.4], fov: 52 });
    await g.wait(1.0);
    await g.say('使用人たちの住まいだった、細い廊下。\n漆喰の壁が、ところどころ内側から膨らんでいる。');
    g.cut(null);
    g.unlock();
  },

  update(r, g, dt) {
    for (const a of r.arms) a.update(dt);
  },
};

async function openHarlow(r, g, door) {
  if (g.flags.harlowOpen) return;
  g.flags.harlowOpen = true;
  g.audio.sfx('doorOpen', { at: { x: 4, y: 1, z: 0.5 } });
  // a door inside the wing: open, there is a room behind it, not the dark
  door.voidMesh.visible = false;
  const st = { v: 0 };
  const iv = setInterval(() => door.setOpen(st.v), 16);
  await g.tween(st, 'v', 1, 0.5);
  clearInterval(iv);
  door.setOpen(1);
  door.collider.enabled = false;
  r.interactables = r.interactables.filter((i) => i.id !== 'harlowDoor');
  r.nav.rebuild(r.colliders, 0.34);
  const m = r.monsters.find((x) => x.id === 'servThrall2');
  if (m && m.alive) m.wake();
}

// One place in the wall an arm comes out of: when he passes it bursts out
// through the plaster, claws at him, and draws back in to wait for the next
// time. A man who keeps to the other side of the passage is out of reach.
function armSpot(r, g, x, z, out, y, i) {
  const arm = buildDrownedArm({ skinColor: 0x6e7e74 });
  const LEN = 1.3; // reach of the arm at this scale
  const holder = new THREE.Group();
  holder.position.set(x, y, z);
  holder.rotation.x = out * (Math.PI / 2 + 0.12);
  arm.root.scale.setScalar(1.8);
  // the back of the hand up, whichever wall it comes out of
  arm.root.rotation.y = out > 0 ? Math.PI : 0;
  holder.add(arm.root);
  r.dynamic.add(holder);
  holder.visible = false;
  let broken = false;
  const spot = { t: -1, cool: 0.5 + i * 0.4, hit: false };
  const breakWall = () => {
    broken = true;
    // a ragged black hole in the plaster, and the plaster on the floor
    const sh = new THREE.Shape();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const rr = 0.15 + (((k * 37 + i * 11) % 7) / 7) * 0.09;
      if (k === 0) sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const hole = new THREE.Mesh(new THREE.ShapeGeometry(sh), C(0x0a0806, { side: THREE.DoubleSide }));
    hole.position.set(x, y, z + out * 0.012);
    r.dynamic.add(hole);
    for (let k = 0; k < 4; k++) {
      const s = 0.05 + ((k * 13 + i) % 5) * 0.015;
      const chunk = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.6, s * 1.3), C(0x8a8070));
      chunk.position.set(x + (k - 1.5) * 0.14, s * 0.3, z + out * (0.15 + ((k * 7) % 4) * 0.08));
      chunk.rotation.y = k * 1.3 + i;
      r.dynamic.add(chunk);
    }
  };
  spot.update = (dt) => {
    const p = g.player;
    spot.cool -= dt;
    if (spot.t < 0) {
      // waiting: come out when he walks by on this side of the wall
      const front = (p.pos.z - z) * out;
      const d = Math.hypot(p.pos.x - x, p.pos.z - (z + out * 0.6));
      if (spot.cool <= 0 && front > 0.2 && d < 1.3 && p.alive && !g.locked) {
        spot.t = 0;
        spot.hit = false;
        holder.visible = true;
        if (!broken) breakWall();
        g.audio.sfx('bang', { at: holder.position });
        g.audio.sfx('thrallAttack', { at: holder.position });
        g.burst('dust', x, y, z + out * 0.2, { n: 12, dir: [0, out] });
        g.shake(0.05, 0.2);
      }
      return;
    }
    // burst out (0-0.18 s), grope (to 1.0 s), draw back (to 1.4 s)
    spot.t += dt;
    const t = spot.t;
    const ext = t < 0.18 ? t / 0.18 : t < 1.0 ? 1 : Math.max(0, 1 - (t - 1.0) / 0.4);
    // all of the arm is inside the wall at 0, its root at the face at 1
    holder.position.z = z + out * (-LEN - 0.05 + ext * (LEN - 0.05));
    holder.rotation.z = Math.sin(t * 8 + i) * 0.28 * ext;
    arm.wrist.rotation.x = 0.2 + 0.25 * Math.sin(t * 6 + i);
    const curl = 0.25 + 0.9 * Math.abs(Math.sin(t * 7 + i));
    arm.fingers.forEach((f) => f.forEach((sg, k) => { sg.rotation.x = curl * [0.75, 1.1, 0.95][k]; }));
    arm.thumb.forEach((sg, k) => { sg.rotation.x = curl * (0.4 + 0.3 * k); });
    if (!spot.hit && t > 0.15 && t < 0.95 && p.alive) {
      // within reach of the hand anywhere along the arm's length
      const along = Math.max(0, Math.min(LEN - 0.1, (p.pos.z - z) * out));
      const d = Math.hypot(p.pos.x - x, p.pos.z - (z + out * along));
      if (d < 0.55) {
        spot.hit = true;
        p.damage(12, x, z, { knock: 2.6 });
      }
    }
    if (t > 1.4) {
      spot.t = -1;
      spot.cool = 2.5;
      holder.visible = false;
    }
  };
  return spot;
}
