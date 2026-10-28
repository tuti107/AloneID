// 潮の洞窟 — down the sea tunnel from the crypt, a cave under the cliff the
// tower's light has drained: the Black Gull lies there on her side where she
// ran aground in 1802, her captain still aboard. A boarding stair hangs from
// her rail on a chain; a capstan on the rocks lets it down.
import * as THREE from 'three';
import * as F from '../furniture.js';
import { M, C, spriteMat } from '../mats.js';
import { rockGeo } from '../../engine/geom.js';
import { loft } from '../body.js';
import { rng } from '../../engine/util.js';

const DECK = 2.2;
// pools the drowned come up out of: x, z, facing
const POOLS = [[2.6, 2.2, -2.4], [-3.4, 3.6, 2.6]];

export default {
  id: 'tidecave',
  name: '潮の洞窟',
  bounds: [-9.4, -8.4, 9.4, 8.4],
  floorType: 'rock',
  ambience: 'cave',
  bg: 0x030506,
  build(r, g) {
    const R = rng(91);
    r.scene.fog = new THREE.FogExp2(0x0a1418, 0.018);
    r.floor(-9.4, -8.4, 9.4, 8.4, M('rockWet', { ts: [3, 3], color: 0xc0c8c4 }), 0, 'rock');
    // the sea, drawn back to the cave's mouth in the north
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(20, 6, 20, 6), new THREE.MeshPhongMaterial({ color: 0x041014, specular: 0x5a7a80, shininess: 100, flatShading: true }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -0.12, -10.6);
    r.dynamic.add(sea);
    const sp = sea.geometry.attributes.position;
    const base = Float32Array.from(sp.array);
    r.updaters.push((dt, t) => {
      for (let i = 0; i < sp.count; i++) sp.setZ(i, Math.sin(base[i * 3] * 0.9 + t * 1.2) * 0.06 + Math.cos(base[i * 3 + 1] * 1.4 + t) * 0.05);
      sp.needsUpdate = true;
    });
    r.collider(0, -8.3, 9.4, 0.3);
    // rock heaped round the walls, each set back behind the floor's edge so
    // he never stands half inside one, and clear of the way up to the crypt
    const lump = (x, z, s, sq = [1, 1.3, 1]) => {
      const m = new THREE.Mesh(rockGeo(s, Math.floor(R() * 999), 1, sq), M(R() < 0.5 ? 'rock' : 'rockWet', { flat: true }));
      m.position.set(x, s * 0.5, z);
      m.rotation.y = R() * 6;
      m.castShadow = true;
      r.static.add(m);
      return m;
    };
    const STAIR = [6.3, 8.1]; // the opening up to the crypt, z from .. to
    const offStair = (m) => (m.position.z < 7.2 ? r.clearOf(m, 0, -1, -STAIR[0]) : r.clearOf(m, 0, 1, STAIR[1]));
    for (let x = -9; x <= 9; x += 1.6) {
      const m = r.clearOf(lump(x + R() * 0.4, 8.9 + R() * 0.4, 1.5 + R() * 0.5), 0, 1, 8.0);
      if (m.position.x > 6.5) offStair(m);
    }
    for (let z = -7.5; z <= 8; z += 1.6) {
      r.clearOf(lump(-9.9 - R() * 0.3, z, 1.6 + R() * 0.5), -1, 0, 8.9);
      if (z < -5.6 || z > -2.4) offStair(r.clearOf(lump(9.9 + R() * 0.3, z, 1.6 + R() * 0.5), 1, 0, 8.9));
    }
    r.collider(0, 8.5, 9.4, 0.5);
    r.collider(-9.4, 0, 0.5, 8.4);
    r.collider(9.4, 4.0, 0.5, 4.4);
    r.collider(9.4, -7.2, 0.5, 1.2);
    // the channel east is under water: it is the way on only through its
    // interact, never on foot
    r.collider(9.4, -3.2, 0.5, 2.8);
    // tide pools, gone phosphorescent where the drowned lie in them
    r.pools = [];
    for (const [x, z, w, d] of [[2.6, 2.2, 1.8, 1.3], [-3.4, 3.6, 2.0, 1.4], [5.6, -1.0, 1.4, 1.0]]) {
      const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 16), new THREE.MeshPhongMaterial({ color: 0x0a3a3a, emissive: 0x0c5a50, specular: 0x8ab0b0, shininess: 120, transparent: true, opacity: 0.88, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2;
      pool.scale.set(w / 2, d / 2, 1);
      pool.position.set(x, 0.012, z);
      r.dynamic.add(pool);
      r.pools.push([x, z, w / 2, d / 2]);
      const glow = new THREE.Sprite(spriteMat('glow', 0x3ad0b0, 0.35));
      glow.scale.set(w * 1.6, d * 1.2, 1);
      glow.position.set(x, 0.25, z);
      r.dynamic.add(glow);
      r.point(x, 0.6, z, { color: 0x3ac8a8, intensity: 6, distance: 6, flicker: 0.15, speed: 0.5 });
    }
    r.waterAt = (x, z) => z < -7.9 || r.pools.some(([px, pz, a, b]) => ((x - px) / a) ** 2 + ((z - pz) / b) ** 2 < 1);

    // ---- the way down from the crypt: old stone steps going up into the
    // rock between two dressed jambs, the crypt's lamplight at the top
    for (let i = 0; i < 4; i++) r.box('stoneFloor', 0.3, 0.12 + i * 0.12, 1.2, 8.0 + i * 0.3, 0, 7.2, { cast: false });
    r.box('#020304', 0.1, 2.2, 1.4, 9.3, 0, 7.2, { cast: false });
    for (const z of [STAIR[0] + 0.1, STAIR[1] - 0.1]) r.box('stoneWall', 0.9, 2.5, 0.25, 9.25, 0, z);
    r.box('stoneWall', 0.9, 0.35, 2.0, 9.25, 2.2, 7.2);
    r.stairLight = r.point(8.9, 1.9, 7.2, { color: 0xffa860, intensity: 3, distance: 5, flicker: 0.1, speed: 3 });
    const stairGlow = new THREE.Sprite(spriteMat('glow', 0xffa860, 0.25));
    stairGlow.scale.set(1.6, 2.0, 1);
    stairGlow.position.set(9.0, 1.2, 7.2);
    r.dynamic.add(stairGlow);
    r.stairGlow = stairGlow;
    r.trigger({ box: [8.2, 6.5, 9.4, 7.9], enter: (gg) => gg.goTo('crypt', 'fromCave', { fadeOut: 0.5 }) });
    r.entry('fromCrypt', 7.6, 7.2, -Math.PI / 2 - 0.4);

    // ---- the Black Gull, on her side
    buildWreck(r, g);

    // ---- the capstan on the rocks, and the chain to her rail
    const cap = new THREE.Group();
    const iron = M('iron', { phong: true, shininess: 30 });
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.9, 10), M('woodBlack'));
    drum.position.y = 0.45;
    cap.add(drum);
    const head = new THREE.Group();
    head.position.y = 0.95;
    cap.add(head);
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.07, 0.07), M('wood'));
      bar.rotation.y = (i * Math.PI) / 4;
      head.add(bar);
    }
    const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 10), iron);
    head.add(capTop);
    cap.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    r.place(cap, 1.0, 1.0, 0, { collide: [0.9, 0.9] });
    r.capHead = head;
    // the chain, from the drum to the rail
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 4), iron);
    const ca = new THREE.Vector3(1.0, 0.7, 0.6), cb = new THREE.Vector3(-1.2, DECK + 0.9, -2.3);
    chain.scale.y = ca.distanceTo(cb);
    chain.position.copy(ca).add(cb).multiplyScalar(0.5);
    chain.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), cb.clone().sub(ca).normalize());
    r.static.add(chain);
    r.interact({
      id: 'capstan', x: 1.0, z: 1.85, r: 0.5, label: '巻き上げ機',
      verb: (gg) => (gg.flags.plankDown ? '調べる' : '回す'),
      use: (gg) => turnCapstan(r, gg),
    });
    if (g.flags.plankDown) lowerPlank(r, true);
    else {
      // the boarding stair, hauled up against her rail
      const up = new THREE.Group();
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.6, 0.08), M('woodBlack'));
      board.position.y = 1.8;
      up.add(board);
      for (let i = 0; i < 9; i++) {
        const cleat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.05), M('wood'));
        cleat.position.set(0, 0.3 + i * 0.38, 0.06);
        up.add(cleat);
      }
      up.position.set(-1.6, DECK + 0.02, -2.25);
      up.rotation.x = 0.12;
      r.dynamic.add(up);
      r.plankUp = up;
    }

    // ---- the channel down to the shrine, at the east, under water until the
    // captain is dead
    r.box('#010203', 0.1, 2.6, 2.6, 9.55, 0, -4.0, { cast: false });
    const ch = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.6), new THREE.MeshPhongMaterial({ color: 0x06141a, specular: 0x6a8a90, shininess: 120, transparent: true, opacity: 0.9 }));
    ch.rotation.x = -Math.PI / 2;
    ch.position.set(8.8, 0.25, -4.0);
    ch.visible = !g.flags['dead:ezekiel'];
    r.dynamic.add(ch);
    r.channelWater = ch;
    r.entry('fromShrine', 7.8, -4.0, -Math.PI / 2);
    r.interact({
      id: 'channel', x: 8.2, z: -4.0, r: 0.6, label: '奥への水路',
      use: async (gg) => {
        if (!gg.flags['dead:ezekiel']) { await gg.say('洞窟の奥へ続く水路は、黒い水に満たされている。\n水の底から、心臓の鼓動のような音が響いてくる。\n\n……まだ、進めない。'); return; }
        if (gg.flags.finalEscape) { await gg.say('水路の奥で、岩の崩れ落ちる音が続いている。\n……もう、戻れない。'); return; }
        if (gg.hasRoom('shrine')) { await gg.goTo('shrine', 'fromCave', { fadeOut: 0.6 }); return; }
        await gg.say('水路の水が引き、濡れた岩の道が、地の底へ下っている。');
        await gg.notYet();
      },
    });

    // ---- light: the moon through the cave's mouth and down a crack in its
    // roof onto her flank, weed glowing on the rocks, lanterns on the wreck
    r.hemi(0x7a96a8, 0x2a3432, 7.0);
    r.spot(-4, 7, -9, -1, 0, -1, { color: 0x7a90b8, intensity: 50, distance: 24, angle: 0.9, penumbra: 0.8, window: true });
    r.spot(-0.6, 9.6, 2.0, -2.0, 0, -0.6, { color: 0x9ab4d8, intensity: 140, distance: 26, angle: 0.6, penumbra: 0.75, window: true });
    r.shaft(-0.6, 9.6, 2.0, -2.0, 0, -0.6, { r0: 0.4, r: 3.0, alpha: 0.04 });
    r.point(6.5, 2.0, 6.0, { color: 0x7a8a90, intensity: 10, distance: 12 });
    r.point(1.0, 2.2, 2.0, { color: 0x6a8a8a, intensity: 8, distance: 11 });
    r.point(-6.0, 2.6, 4.0, { color: 0x5a8a80, intensity: 8, distance: 11 });
    for (let i = 0; i < 14; i++) {
      const a = R() * 2 - 1;
      const [x, z] = i % 2 ? [-9.1, a * 7.5] : [a * 8.6, 8.4];
      const w = new THREE.Sprite(spriteMat('glow', 0x3ad0a0, 0.18 + R() * 0.12));
      w.scale.set(0.8 + R(), 0.5 + R() * 0.6, 1);
      w.position.set(x, 0.4 + R() * 2.2, z);
      r.dynamic.add(w);
    }
    const lamp = F.oilLamp();
    lamp.position.set(-6.2, DECK + 1.5, -2.2);
    r.static.add(lamp);
    r.flame(-6.2, DECK + 1.7, -2.2, { size: 0.05, intensity: 9, distance: 12 });
    // a ship's lantern on the rail where the boarding stair hangs
    const ship = F.stormLantern();
    ship.position.set(-2.62, DECK + 0.922, -2.22);
    r.static.add(ship);
    r.flame(-2.62, DECK + 1.03, -2.22, { size: 0.04, intensity: 7, distance: 9 });
    const moon = new THREE.Sprite(spriteMat('glow', 0x9ab0d0, 0.35));
    moon.scale.set(6, 4, 1);
    moon.position.set(-3, 2.5, -12);
    r.dynamic.add(moon);

    // ---- the drowned crew: two in the pools, one on her deck
    POOLS.forEach(([x, z, ry], i) => {
      const id = 'caveThrall' + (i + 1);
      if (g.flags['dead:' + id]) return;
      const t = g.spawn(r, { id, type: 'thrall', seed: 30 + i, x, z, rot: ry, onDeath: () => { g.flags['dead:' + id] = true; } });
      if (!g.flags['up:' + id]) t.bury();
    });

    r.shot({ id: 'entry', pos: [2.4, 4.4, 2.6], look: [8.0, 0.6, 7.0], fov: 60, zone: [3.0, 3.0, 9.4, 8.4] });
    r.shot({ id: 'east', pos: [3.4, 4.8, 4.6], look: [8.0, 0.6, -3.8], fov: 60, zone: [3.0, -8.4, 9.4, 3.0] });
    r.shot({ id: 'wreck', pos: [-1.2, 4.0, 7.2], look: [-3.4, 1.4, -2.6], fov: 60, zone: [-5.0, -2.2, 3.0, 8.4] });
    r.shot({ id: 'stern', pos: [-1.0, 5.2, 3.2], look: [-8.0, 0.4, 3.2], fov: 62, zone: [-9.4, -2.2, -5.0, 8.4] });
    r.shot({ id: 'deck', pos: [2.6, 5.6, 2.6], look: [-3.6, DECK, -3.6], fov: 58, zone: [-9.4, -8.4, 3.0, -2.2] });
    // the way back, up out of the shrine with the cave coming down: from the
    // channel's end, down the east side to the steps
    r.shot({ id: 'outEast', pos: [6.4, 5.4, -9.8], look: [8.0, 0.4, 3.6], fov: 58, priority: 2, zone: [3.0, -8.4, 9.4, 3.0], when: () => !!g.flags.finalEscape });
  },

  async enter(r, g, entry) {
    if (g.flags.finalEscape) { g.notify('灯りの漏れる石段を上れ――納骨堂へ！', 3.2); return; }
    if (g.flags.caveSeen || entry !== 'fromCrypt') return;
    g.flags.caveSeen = true;
    g.lock();
    g.cut({ pos: [6.0, 2.6, 6.4], look: [-3.0, 1.6, -3.0], fov: 54 });
    await g.wait(1.2);
    await g.say('潮の引いた洞窟の底に、一隻の帆船が横たわっていた。\n黒く朽ちた船腹に、かすれた文字――「BLACK GULL」。');
    g.cut(null);
    g.unlock();
  },

  setup(r, g) {
    if (g.flags['dead:ezekiel']) r.channelWater.visible = false;
    // (the cave may still be built from the way down)
    if (g.flags.finalEscape) escapeLights(r);
  },

  update(r, g) {
    const p = g.player;
    for (const m of r.monsters) {
      if (m.state !== 'buried' || !p.alive || g.locked) continue;
      if (Math.hypot(p.pos.x - m.pos.x, p.pos.z - m.pos.z) < 3.2 || r.capTurns > 0) {
        g.flags['up:' + m.id] = true;
        m.emerge();
      }
    }
  },
};

// On the way back out: the lamplight at the top of the steps up to the crypt
// burns brighter, so the way shows from the far end of the cave.
function escapeLights(r) {
  if (r.escapeLit) return;
  r.escapeLit = true;
  const L = r.lights.find((q) => q.light === r.stairLight);
  if (L) L.base = 9;
  r.stairGlow.material = spriteMat('glow', 0xffb070, 0.6);
  r.stairGlow.scale.set(2.2, 2.6, 1);
}

// The wreck: a hull on her side along the north of the cave, her deck tilted
// up towards the cave floor, a broken mast, rags of sail, and the stern
// house with the captain's door.
function buildWreck(r, g) {
  const hullM = M('woodBlack', { ts: [1.2, 1.2] });
  const deckM = M('woodFloorDark', { ts: [1.5, 1.5] });
  // the hull's flank below the deck: a heavy block, sloped back, ribbed
  const rings = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const w = 1.0 - Math.abs(t - 0.45) ** 2 * 1.6;
    rings.push([-8.4 + t * 11.6, 1.35 * w + 0.15, 1.6 * w + 0.2]);
  }
  const hull = new THREE.Mesh(loft(rings, 12), hullM);
  hull.rotation.z = -Math.PI / 2;
  hull.rotation.x = -0.35;
  hull.position.set(0, DECK - 1.2, -4.4);
  hull.castShadow = true;
  r.static.add(hull);
  r.box(hullM, 11.0, DECK - 0.1, 2.6, -2.6, 0, -3.5);
  r.box(deckM, 11.0, 0.1, 2.92, -2.6, DECK - 0.1, -3.64);
  r.platform(-8.1, -5.1, 2.9, -2.2, DECK);
  // under the deck and its rail: no way through from the rocks, and a rail
  // at the deck's edge for whoever is up there
  r.collider(-2.6, -3.65, 5.5, 1.45, 0, { y0: -1, y1: DECK - 0.1 });
  // behind the deck, her bottom: no way round behind her, nor off the deck's
  // high side; and the mainmast where it goes through the deck
  r.collider(-3.2, -6.55, 6.2, 1.45);
  r.box('woodBlack', 8.4, 1.0, 0.12, -1.3, DECK, -5.16, { cast: false });
  r.collider(-2.0, -4.2, 0.55, 0.22, 0, { y0: DECK - 0.4, y1: DECK + 2 });
  r.collider(-5.1, -2.17, 3.0, 0.05, 0, { y0: DECK - 0.4, y1: DECK + 2 });
  r.collider(0.9, -2.17, 2.0, 0.05, 0, { y0: DECK - 0.4, y1: DECK + 2 });
  r.collider(2.92, -3.65, 0.05, 1.45, 0, { y0: DECK - 0.4, y1: DECK + 2 });
  for (let i = 0; i < 18; i++) {
    const x = -7.9 + i * 0.6;
    if (x > -2.1 && x < -1.1) continue;
    r.box('woodBlack', 0.05, 0.85, 0.05, x, DECK, -2.22);
  }
  r.box('woodBlack', 4.2, 0.07, 0.08, -4.6, DECK + 0.85, -2.22);
  r.box('woodBlack', 4.3, 0.07, 0.08, 0.85, DECK + 0.85, -2.22);
  // ribs showing through where the planking has gone
  for (let i = 0; i < 6; i++) r.box('wood', 0.12, DECK - 0.25, 0.09, -7.2 + i * 1.9, 0.1, -2.135);
  // the broken mainmast and its rags
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 5.2, 8), M('woodBlack'));
  mast.position.set(-2.6, DECK + 2.0, -4.2);
  mast.rotation.z = 0.5;
  mast.castShadow = true;
  r.static.add(mast);
  const rag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.2), M('linen', { color: 0x5a5448, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
  rag.position.set(-3.6, DECK + 2.6, -4.0);
  rag.rotation.set(0.1, 0.4, 0.5);
  r.dynamic.add(rag);
  r.updaters.push((dt, t) => { rag.rotation.y = 0.4 + Math.sin(t * 1.3) * 0.12; });
  // the stern house at her west end
  r.box('woodBlack', 2.6, 2.4, 2.8, -6.83, DECK, -3.7, { collide: true, y0: DECK - 0.4, y1: DECK + 2.6 });
  r.box(C(0x7a6a40, { emissive: 0x2a1c08 }), 0.6, 0.5, 0.04, -6.0, DECK + 1.3, -2.28, { cast: false });
  const door = r.door(-5.5, -3.7, Math.PI / 2, {
    id: 'cabinDoor', to: 'gullcabin', entry: 'fromDeck', w: 0.9, h: 2.0, label: '船長室の扉', wallMat: 'woodBlack', panel: 'woodBlack', panelInset: 'wood', sound: 'doorHeavy',
    onOpen: async (gg) => {
      if (gg.hasRoom('gullcabin')) return true;
      await gg.notYet();
      return false;
    },
  });
  door.group.position.y = DECK;
  r.entry('fromCabin', -4.8, -3.7, Math.PI / 2);
  // a sea chest by the cabin door, and a flask of rum on it
  r.place(F.trunk({ w: 0.8, h: 0.45, d: 0.45 }), -4.4, -4.7, 0.1, { y: DECK, collide: [0.8, 0.45], y0: DECK - 0.4, y1: DECK + 1 });
  r.pickup('flask', -4.4, DECK + 0.46, -4.7, { id: 'gullFlask', label: 'ラム酒の小瓶', ry: 0.3 });
  // the harpoon gun, left on the deck
  r.pickup('harpoon', 0.6, DECK + 0.02, -3.2, { label: '銛撃ち銃', ry: 1.2, r: 0.45 });
  r.pickup('harpoons', 1.6, DECK + 0.02, -4.4, { label: '銛の束', ry: 0.4, give: { count: 3 } });
}

async function turnCapstan(r, g) {
  if (g.flags.plankDown) { await g.say('巻き上げ機の鎖は、すっかり繰り出されている。'); return; }
  r.capTurns = (r.capTurns || 0);
  const c = await g.ask('巻き上げ機を回しますか？', ['回す', 'やめる']);
  if (c !== 0) return;
  g.lock();
  for (let k = 0; k < 3; k++) {
    g.audio.sfx('creak', { at: { x: 1, y: 1, z: 1 } });
    g.audio.sfx('clank', { at: { x: 1, y: 1, z: 1 } });
    const st = { v: r.capHead.rotation.y };
    const iv = setInterval(() => { r.capHead.rotation.y = st.v; }, 16);
    await g.tween(st, 'v', st.v + Math.PI / 2, 0.8);
    clearInterval(iv);
    r.capTurns++;
    if (r.plankUp) r.plankUp.rotation.x = 0.12 + (r.capTurns / 3) * 0.3;
  }
  g.unlock();
  await lowerPlank(r, false, g);
}

// The boarding stair comes down on its chain and bites into the rocks.
async function lowerPlank(r, instant, g) {
  if (r.plankUp) { r.dynamic.remove(r.plankUp); r.plankUp = null; }
  r.stairs(-1.6, 1.0, 'n', { w: 0.9, len: 3.2, rise: DECK, steps: 10, mat: 'woodBlack', side: 'woodBlack' });
  // (while the cave is still being built there is no nav yet: it is made
  // with the stair in it)
  if (r.nav) r.nav.rebuild(r.colliders, 0.34);
  if (instant) return;
  g.flags.plankDown = true;
  g.audio.sfx('slam', { at: { x: -1.6, y: 1, z: 0 } });
  g.shake(0.08, 0.4);
  g.burst('splash', -1.6, 0.2, 1.0, { n: 12 });
  await g.say('鎖が緩み、船縁から昇降梯子が岩場へ倒れ込んだ。\nこれで、甲板へ上がれる。');
}
