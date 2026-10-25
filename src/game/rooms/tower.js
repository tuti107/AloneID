// 塔の階段室 — the east tower, hollow, its stair climbing the walls round
// an open well: up from the boiler room to a landing with Harlow's door to
// the lamp room, and a panel that opens on the master bedroom. Seen from
// straight above, as the stair turns.
import * as THREE from 'three';
import * as F from '../furniture.js';
import { M } from '../mats.js';
import { tex } from '../../engine/textures.js';

const H = 7.2;
const RISE = 1.4;
const L1 = RISE, L2 = RISE * 2, L3 = RISE * 3;
// the stair runs in a band 1.1 m wide inside the walls; inside that, the well
const IN = 1.9;
const UPPER = [[-3.2, -3.2], [3.2, -3.2], [3.2, -IN], [-IN, -IN], [-IN, -0.6], [-3.2, -0.6]];
const LOWER = [[-3.2, -0.6], [-IN, -0.6], [-IN, -IN], [3.2, -IN], [3.2, 3.2], [-3.2, 3.2]];

export default {
  id: 'tower',
  name: '塔の階段室',
  bounds: [-3.2, -3.2, 3.2, 3.2],
  floorType: 'stone',
  ambience: 'tower',
  build(r, g) {
    r.shell(-3, -3, 3, 3, {
      h: H, floor: 'stoneFloor', ceil: 'woodBlack', mat: 'stoneWall', baseboard: false,
      openings: {
        w: [{ at: 1.2, w: 1.0, h: 2.15 }, { at: -1.5, w: 0.9, h: 2.1, sill: L3 }],
        n: [{ at: -2.45, w: 0.9, h: 2.1, sill: L3 }, { at: 0.3, w: 0.7, h: 1.3, sill: 5.0 }],
        s: [{ at: 0, w: 0.8, h: 1.4, sill: 2.0 }],
        e: [{ at: 0, w: 0.8, h: 1.4, sill: 3.4 }],
      },
    });
    r.window(0, 3, Math.PI, { w: 0.8, h: 1.4, sill: 2.0, intensity: 12, beam: false });
    r.window(3, 0, -Math.PI / 2, { w: 0.8, h: 1.4, sill: 3.4, light: false });
    r.window(0.3, -3, 0, { w: 0.7, h: 1.3, sill: 5.0, intensity: 12, beam: false });

    // ---- the stair: three flights and the landings between them, all of
    // solid stone from the floor of the well
    const landing = (x0, z0, x1, z1, y) => {
      r.box('stoneWall', x1 - x0, y - 0.06, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2);
      r.box('stoneFloor', x1 - x0, 0.06, z1 - z0, (x0 + x1) / 2, y - 0.06, (z0 + z1) / 2);
      r.platform(x0, z0, x1, z1, y);
    };
    const flight = { w: 1.1, len: 3.8, rise: RISE, steps: 9, mat: 'stoneFloor', side: 'stoneWall', sides: [1], collideSides: [1] };
    r.stairs(-IN, 2.45, 'e', flight);
    landing(IN, IN, 3, 3, L1);
    r.box('stoneWall', 1.1, L1, 3.8, 2.45, 0, 0);
    r.stairs(2.45, IN, 'n', { ...flight, y0: L1 });
    landing(IN, -3, 3, -IN, L2);
    r.box('stoneWall', 3.8, L2, 1.1, 0, 0, -2.45);
    r.stairs(IN, -2.45, 'w', { ...flight, y0: L2 });
    landing(-3, -3, -IN, -0.6, L3);
    // the top landing's rail, over the well and over the way in
    r.collider(-IN + 0.06, -1.25, 0.06, 0.65);
    r.collider(-2.45, -0.66, 0.55, 0.06);
    const bal = M('woodBlack');
    for (let i = 0; i < 5; i++) r.box(bal, 0.05, 0.9, 0.05, -IN + 0.05, L3, -1.85 + i * 0.3);
    for (let i = 0; i < 4; i++) r.box(bal, 0.05, 0.9, 0.05, -2.85 + i * 0.3, L3, -0.65);
    r.box(bal, 0.08, 0.06, 1.35, -IN + 0.05, L3 + 0.9, -1.25);
    r.box(bal, 1.15, 0.06, 0.08, -2.45, L3 + 0.9, -0.65);
    r.box(bal, 0.12, 1.15, 0.12, -IN + 0.05, L3, -0.65);

    // ---- the weight of the lamp's clockwork, hanging down the well
    const weight = new THREE.Group();
    const iron = M('iron', { phong: true, shininess: 30 });
    const wbody = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.8, 10), iron);
    wbody.castShadow = true;
    weight.add(wbody);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, H, 4), iron);
    chain.position.y = H / 2 + 0.4;
    weight.add(chain);
    weight.position.set(0, 1.1, 0);
    r.dynamic.add(weight);
    r.weight = weight;
    r.collider(0, 0, 0.3, 0.3);
    r.interact({
      id: 'weight', x: 0, z: 0.55, r: 0.4, label: '鉄の錘',
      use: (gg) => gg.say(gg.flags.towerLit ? '鉄の錘が、ゆっくりと下がっていく。\nこの重みが、塔の上の灯を回している。' : '天井から鎖で吊られた、鉄の錘。\n塔の上の何かの仕掛けにつながっているらしい。……今は止まっている。'),
    });
    r.decal('dirt', 0.6, 0.9, 1.6, 1.2, 0.4, 0.004);

    // ---- doors
    r.door(-3, 1.2, Math.PI / 2, { to: 'boiler', entry: 'fromTower', label: 'ボイラー室への扉', wallMat: 'stoneWall', panel: 'iron', panelInset: 'rust', sound: 'doorHeavy' });
    r.entry('fromBoiler', -2.35, 1.2, Math.PI / 2);
    // a panel in the wall of the landing, with a latch on this side only
    const panel = r.door(-3, -1.5, Math.PI / 2, {
      id: 'towerPanel', to: 'bedroom', entry: 'fromTower', w: 0.9, h: 2.1, label: '壁の羽目板', wallMat: 'stoneWall', panel: 'wood', frame: 'wood',
      onOpen: async (gg) => {
        if (!gg.flags.towerPassage) {
          await gg.say('壁の羽目板に、小さな掛け金がある。\n外すと、板が扉のように内側へ開いた。奥に、狭い隠し通路が続いている。');
          gg.flags.towerPassage = true;
        }
        return gg.hasRoom('bedroom');
      },
    });
    panel.group.position.y = L3;
    r.entry('fromBedroom', -2.4, -1.5, Math.PI / 2);
    const lampDoor = r.door(-2.45, -3, 0, {
      id: 'lampDoor', to: 'lamproom', entry: 'fromTower', w: 0.9, h: 2.1, label: '灯室への扉', wallMat: 'stoneWall', panel: 'woodBlack',
      locked: true, key: 'keyring', lockedMsg: '鍵がかかっている。真鍮の札に「灯室」。',
      unlockMsg: 'ハーロウの鍵束から「灯室」の札の鍵を選んで、扉を開けた。',
      onOpen: async (gg) => {
        if (gg.hasRoom('lamproom')) return true;
        await gg.notYet();
        return false;
      },
    });
    lampDoor.group.position.y = L3;
    r.entry('fromLamp', -2.45, -2.4, 0);

    // ---- the storm lantern, on a hook at the second landing
    r.box('iron', 0.03, 0.03, 0.16, 2.45, L2 + 1.3, -2.92, { cast: false });
    r.pickup('lantern', 2.45, L2 + 0.95, -2.84, {
      label: 'ランタン', ry: 0.4,
      onTake: async (gg) => {
        await gg.say('鉄枠の、船乗りの嵐のランタン。\n中は空っぽで、油も火もない。');
        const m = r.monsters.find((x) => x.id === 'towerThrall2');
        if (m && m.alive && m.state === 'dormant') {
          m.wake();
          gg.audio.sfx('thrallNotice', { at: m.pos });
        }
      },
    });

    // ---- light
    for (const [x, y, z, ry] of [[-3, 1.9, 2.4, Math.PI / 2], [-1.2, L3 + 1.5, -3, 0], [3, L2 + 1.6, -2.5, -Math.PI / 2]]) {
      const sc = F.sconce();
      sc.position.set(x, y, z);
      sc.rotation.y = ry;
      r.static.add(sc);
      const f = sc.userData.flames[0];
      r.flame(x + f[2] * Math.sin(ry), y + f[1], z + f[2] * Math.cos(ry), { size: 0.06, intensity: 3.6, distance: 8 });
    }
    r.point(0, 5.5, 0, { color: 0x6a7898, intensity: 7, distance: 12 });
    r.hemi(0x5a6a8a, 0x1a1612, 3.2);

    // ---- something climbing the tower, seen past the high window
    const climber = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.84), new THREE.MeshBasicMaterial({ map: tex('climber'), color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
    // between the glass and the room, hidden in the wall below the sill
    climber.position.set(0.3, 4.6, -3.1);
    r.dynamic.add(climber);
    r.climber = climber;
    r.trigger({
      box: [IN, -3, 3, -IN], once: true,
      when: (gg) => !gg.flags.climberSeen && gg.player.pos.y > L2 - 0.3,
      enter: (gg) => climberPasses(r, gg),
    });

    // ---- the drowned: one in the well, one waiting at the top
    if (!g.flags['dead:towerThrall1']) g.spawn(r, { id: 'towerThrall1', type: 'thrall', seed: 11, x: 1.0, z: -0.9, rot: -2.4, onDeath: () => { g.flags['dead:towerThrall1'] = true; } });
    if (!g.flags['dead:towerThrall2']) g.spawn(r, { id: 'towerThrall2', type: 'thrall', seed: 12, x: -2.45, z: -1.3, rot: Math.PI / 2, dormant: true, sight: 3.5, onDeath: () => { g.flags['dead:towerThrall2'] = true; } });

    // looking straight down the well; from the top landing, across it
    r.shot({ id: 'well', pos: [0, 6.8, 1.9], look: [0, 0, -0.5], fov: 62, track: 0, zone: LOWER });
    r.shot({ id: 'upper', pos: [1.5, 6.6, 1.3], look: [-1.0, 3.6, -2.2], fov: 62, zone: UPPER });
  },

  setup(r, g, entry) {
    // never put him down beside the one waiting at the top
    const m = r.monsters.find((x) => x.id === 'towerThrall2');
    const e = r.entries[entry];
    if (m && m.alive && e && Math.hypot(m.pos.x - e.x, m.pos.z - e.z) < 1.6) {
      m.pos.set(2.45, L2, -2.45);
      m.sync();
    }
  },

  async enter(r, g, entry) {
    if (g.flags.towerSeen || entry !== 'fromBoiler') return;
    g.flags.towerSeen = true;
    g.lock();
    g.cut({ pos: [-1.2, 0.6, 1.6], look: [0.6, 5.6, -1.6], fov: 58 });
    await g.wait(1.2);
    await g.say('塔の中は、がらんどうだった。\n石の階段が壁を伝って、闇の上へと渦を巻いている。');
    g.cut(null);
    g.unlock();
  },

  update(r, g) {
    // the dormant one wakes when he comes up the last flight
    const m = r.monsters.find((x) => x.id === 'towerThrall2');
    if (m && m.alive && m.state === 'dormant' && g.player.pos.y > L2 + 0.3 && Math.hypot(g.player.pos.x - m.pos.x, g.player.pos.z - m.pos.z) < 3.2) m.wake();
    if (g.flags.towerLit) r.weight.position.y = Math.max(0.55, 1.1 - (r.time % 600) * 0.0005);
  },
};

// Lightning, and for a moment, past the high window, something on the
// outside of the tower going up it.
async function climberPasses(r, g) {
  g.flags.climberSeen = true;
  g.lock();
  g.cut({ pos: [1.3, L2 + 1.5, -1.7], look: [0.3, 5.5, -3.0], fov: 50 });
  await g.wait(0.5);
  g.flashQueue = [0, 0.14];
  g.flashT = 0;
  g.audio.thunder(0.25, 1);
  const c = r.climber;
  const st = { v: 0 };
  const iv = setInterval(() => {
    c.position.y = 4.6 + st.v * 2.1;
    c.material.opacity = Math.min(0.92, 0.25 + r.flash * 1.2);
  }, 16);
  await g.tween(st, 'v', 1, 0.9);
  clearInterval(iv);
  c.material.opacity = 0;
  g.audio.sfx('scratch', { at: { x: 0.3, y: 6, z: -3.2 } });
  await g.wait(0.6);
  await g.say('……今、稲光の中を、\n窓の外を何かが這い上がっていった。');
  g.cut(null);
  g.unlock();
}
