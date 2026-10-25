// ボイラー室 — down a flight of steps from the servants' wing, the coal
// boiler that once drove the bolt of the tower door. Three valves must be
// opened in the right order (water, fuel, steam); the stoker who kept it is
// still down here, on his coal.
import * as THREE from 'three';
import * as F from '../furniture.js';
import { M, C } from '../mats.js';

const H = 3.8;
const LAND = 1.2;
// the boiler, and the manifold of valves on the south wall
const BX = 2.6, BZ = -1.8, BR = 1.0;
const MZ = 3.3;
const VALVES = [
  { id: 'yellow', name: '黄色い', color: 0xc8a020, x: -0.6 },
  { id: 'red', name: '赤い', color: 0xa02018, x: 0.3 },
  { id: 'blue', name: '青い', color: 0x2a4a9a, x: 1.2 },
];
// water, then fuel, then steam (Agnes's letter and the manual between them)
const ORDER = ['blue', 'yellow', 'red'];

export default {
  id: 'boiler',
  name: 'ボイラー室',
  bounds: [-4.7, -3.7, 4.7, 3.7],
  floorType: 'stone',
  ambience: 'boiler',
  build(r, g) {
    r.shell(-4.5, -3.5, 4.5, 3.5, {
      h: H, floor: 'stoneFloor', ceil: 'soot', mat: 'brick', baseboard: false,
      openings: { n: [{ at: -2.8, w: 1.0, h: 2.15, sill: LAND }], e: [{ at: 1.6, w: 1.1, h: 2.2 }], s: [{ at: -2.6, w: 1.1, h: 0.5, sill: 3.0 }] },
    });
    // the light well: a slit of night at the top of the south wall
    r.window(-2.6, 3.5, Math.PI, { w: 1.1, h: 0.5, sill: 3.0, panes: false, intensity: 14, beam: false });

    // ---- the way in: a landing at the door and steps down from it
    r.box('stoneWall', 1.2, LAND - 0.06, 1.0, -2.8, 0, -3.0);
    r.box('stoneFloor', 1.24, 0.06, 1.02, -2.8, LAND - 0.06, -2.99);
    r.platform(-3.4, -3.5, -2.2, -2.5, LAND);
    r.stairs(-2.8, 0.3, 'n', { w: 1.2, len: 2.8, rise: LAND, steps: 8, mat: 'stoneFloor', side: 'stoneWall' });
    for (const sx of [-1, 1]) {
      const x = -2.8 + sx * 0.64;
      r.collider(x, -3.0, 0.06, 0.5);
      for (let i = 0; i < 4; i++) r.box('woodBlack', 0.05, 0.9, 0.05, x - sx * 0.06, LAND, -3.4 + i * 0.3);
      r.box('woodBlack', 0.08, 0.06, 1.0, x - sx * 0.06, LAND + 0.9, -3.0);
    }
    const door = r.door(-2.8, -3.5, 0, { to: 'servants', entry: 'fromBoiler', label: '使用人棟への扉', wallMat: 'brick', panel: 'iron', panelInset: 'rust', sound: 'doorHeavy' });
    door.group.position.y = LAND;
    r.entry('fromServants', -2.8, -2.95, 0);

    // ---- the coal, in the bay beside the steps
    const coal = M('soot', { phong: true, shininess: 60, specular: 0x3a3a3a });
    const heap = F.rockLump(0.95, 7, [0.75, 0.6, 1.35], 'soot');
    heap.material = coal;
    heap.position.set(-4.05, 0, -2.6);
    r.static.add(heap);
    for (let i = 0; i < 14; i++) {
      const lump = F.rockLump(0.08 + (i % 4) * 0.03, 20 + i, [1, 0.8, 1], 'soot');
      lump.material = coal;
      lump.position.set(-4.0 + Math.sin(i * 2.4) * 0.42, 0.04, -1.6 + Math.cos(i * 1.7) * 0.35 + (i % 3) * 0.12);
      lump.rotation.y = i;
      r.static.add(lump);
    }
    r.collider(-4.0, -2.65, 0.5, 0.85);
    r.interact({ id: 'coal', x: -3.75, z: -1.55, r: 0.45, label: '石炭の山', use: (gg) => gg.say('湿った石炭の山。崩れた跡がある。\n……誰かが、ここに横たわっていたような窪み。') });

    // ---- the boiler
    const boilerM = M('iron', { phong: true, shininess: 25, specular: 0x333333 });
    r.box('brick', 2.3, 0.3, 2.3, BX, 0, BZ);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(BR, BR, 2.6, 22), boilerM);
    body.position.set(BX, 0.3 + 1.3, BZ);
    body.castShadow = true;
    r.static.add(body);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(BR, 22, 8, 0, Math.PI * 2, 0, Math.PI / 2), boilerM);
    dome.scale.y = 0.35;
    dome.position.set(BX, 2.9, BZ);
    r.static.add(dome);
    for (const y of [0.6, 1.6, 2.6]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(BR + 0.012, 0.028, 4, 30), M('rust'));
      band.rotation.x = Math.PI / 2;
      band.position.set(BX, y, BZ);
      r.static.add(band);
    }
    r.box('iron', 0.36, H - 3.15, 0.36, BX, 3.15, BZ);
    r.collider(BX, BZ, BR + 0.08, BR + 0.08);
    // the firebox door, facing the room, and the glow behind its slits
    r.box('iron', 0.66, 0.56, 0.08, BX, 0.46, BZ + BR - 0.02);
    r.glowM = new THREE.MeshBasicMaterial({ color: 0x120402 });
    for (let i = 0; i < 3; i++) r.box(r.glowM, 0.44, 0.03, 0.01, BX, 0.58 + i * 0.12, BZ + BR + 0.025, { cast: false });
    r.box('brass', 0.12, 0.04, 0.05, BX + 0.22, 0.72, BZ + BR + 0.04);
    r.furnace = r.point(BX, 0.75, BZ + BR + 0.5, { color: 0xff6a2a, intensity: 0, distance: 7, flicker: 0.3, speed: 9 });
    // the pressure gauge, on the side towards the valves
    const gauge = new THREE.Group();
    const ga = -Math.PI / 4;
    gauge.position.set(BX + Math.sin(ga) * (BR + 0.09), 1.75, BZ + Math.cos(ga) * (BR + 0.09));
    gauge.rotation.y = ga;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 6, 20), M('brass', { phong: true, shininess: 60, specular: 0x665533 }));
    gauge.add(rim);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.14, 20), C(0xd8d0b8));
    face.position.z = -0.005;
    gauge.add(face);
    const red = new THREE.Mesh(new THREE.RingGeometry(0.09, 0.125, 10, 1, -0.95, 0.75), C(0x9a1a12, { side: THREE.DoubleSide }));
    red.position.z = -0.002;
    gauge.add(red);
    const needle = new THREE.Group();
    const nm = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.12, 0.006), C(0x101010));
    nm.position.y = 0.05;
    needle.add(nm);
    needle.position.z = 0.004;
    gauge.add(needle);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6), M('brass'));
    stem.rotation.x = Math.PI / 2;
    stem.position.z = -0.06;
    gauge.add(stem);
    r.dynamic.add(gauge);
    r.needle = needle;
    r.pressure = 0;
    r.interact({
      id: 'gauge', x: BX + Math.sin(ga) * (BR + 0.5), z: BZ + Math.cos(ga) * (BR + 0.5), r: 0.4, y: 1.75, label: '圧力計',
      use: (gg) => gg.say(gg.flags.steamUp ? '圧力計の針は、赤い目盛りの手前で震えている。' : '圧力計の針は、零を指したまま動かない。\nボイラーは、冷え切っている。'),
    });

    // ---- pipes: boiler to manifold along the ceiling, manifold to the bolt
    const pipeM = M('iron', { phong: true, shininess: 30, specular: 0x2a2a2a });
    const collars = new Set();
    const pipe = (a, b, rad = 0.065) => {
      const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, d.length(), 8), pipeM);
      m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      m.castShadow = true;
      r.static.add(m);
      for (const p of [a, b]) {
        // one collar at a joint, however many pipes meet there
        const key = p.map((v) => v.toFixed(2)).join(',');
        if (collars.has(key)) continue;
        collars.add(key);
        const j = new THREE.Mesh(new THREE.SphereGeometry(rad * 1.35, 8, 6), pipeM);
        j.position.set(...p);
        r.static.add(j);
      }
    };
    r.joints = [[BX - 0.6, 3.45, BZ], [0.3, 3.45, BZ], [0.3, 3.45, MZ], [-1.3, 1.55, MZ], [4.25, 1.55, MZ], [4.25, 3.45, MZ], [4.25, 3.45, 1.6]];
    pipe([BX - 0.6, 2.75, BZ + 0.4], [BX - 0.6, 3.45, BZ + 0.4]);
    pipe([BX - 0.6, 3.45, BZ + 0.4], [0.3, 3.45, BZ + 0.4]);
    pipe([0.3, 3.45, BZ + 0.4], [0.3, 3.45, MZ]);
    pipe([0.3, 3.45, MZ], [0.3, 1.55, MZ]);
    pipe([-1.3, 1.55, MZ], [4.25, 1.55, MZ], 0.075);
    pipe([4.25, 1.55, MZ], [4.25, 3.45, MZ]);
    pipe([4.25, 3.45, MZ], [4.25, 3.45, 1.6]);
    pipe([-1.3, 1.55, MZ], [-1.3, 0.0, MZ]);

    // ---- the valves
    r.turned = (g.flags.boilerValves || []).slice();
    r.wheels = {};
    for (const v of VALVES) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 6), pipeM);
      st.rotation.x = Math.PI / 2;
      st.position.set(v.x, 1.55, MZ - 0.12);
      r.static.add(st);
      r.box('iron', 0.14, 0.14, 0.12, v.x, 1.48, MZ - 0.2);
      const wheel = new THREE.Group();
      wheel.position.set(v.x, 1.55, MZ - 0.3);
      const wm = C(v.color, { phong: true, shininess: 40 });
      wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 6, 18), wm));
      for (let k = 0; k < 4; k++) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.02), wm);
        sp.rotation.z = (k * Math.PI) / 4;
        wheel.add(sp);
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 8), wm);
      hub.rotation.x = Math.PI / 2;
      wheel.add(hub);
      wheel.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      r.dynamic.add(wheel);
      r.wheels[v.id] = wheel;
      if (r.turned.includes(v.id) || g.flags.steamUp) wheel.rotation.z = -Math.PI * 4;
      r.interact({
        id: 'valve_' + v.id, x: v.x, z: MZ - 0.45, r: 0.28, y: 1.55, label: `${v.name}弁`,
        verb: (gg) => (gg.flags.steamUp ? '調べる' : '回す'),
        use: (gg) => turnValve(r, gg, v),
      });
    }
    r.interact({ id: 'manifold', x: -1.2, z: MZ - 0.5, r: 0.3, y: 1.4, label: '配管', use: (gg) => gg.say('太い配管に、赤・青・黄の三つの弁が並んでいる。\n弁の脇に、煤けた字で「順を誤るな」。') });

    // ---- the tower door, barred by a bolt the steam lifts
    r.door(4.5, 1.6, -Math.PI / 2, {
      id: 'towerDoor', to: 'tower', entry: 'fromBoiler', w: 1.1, h: 2.2, label: '塔への鉄扉', wallMat: 'brick', panel: 'iron', panelInset: 'rust', sound: 'doorHeavy',
      locked: (gg) => !gg.flags.steamUp,
      lockedMsg: '塔へ続く鉄の扉。太い閂が渡されている。\n閂は、上の蒸気シリンダーにつながっている。人の力では、とても持ち上がらない。',
      onOpen: async (gg) => {
        if (gg.hasRoom('tower')) return true;
        await gg.notYet();
        return false;
      },
    });
    r.entry('fromTower', 3.85, 1.6, -Math.PI / 2);
    const bolt = new THREE.Group();
    bolt.position.set(4.36, 0, 1.6);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 1.55), M('iron'));
    bar.position.y = 1.1;
    bar.castShadow = true;
    bolt.add(bar);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.45, 6), M('iron'));
    rod.position.y = 1.1 + 0.725;
    bolt.add(rod);
    r.dynamic.add(bolt);
    r.bolt = bolt;
    for (const z of [0.8, 2.4]) r.box('iron', 0.1, 0.3, 0.1, 4.42, 0.95, z);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.2, 10), pipeM);
    cyl.position.set(4.36, 2.55 + 0.6, 1.6);
    cyl.castShadow = true;
    r.static.add(cyl);
    if (g.flags.steamUp) bolt.position.y = 1.0;

    // ---- the workbench and what is on it
    r.place(F.table({ w: 1.5, d: 0.6, h: 0.86, wood: 'wood', legs: 'square' }), -1.1, -3.12, 0, { collide: true });
    r.pickup('manual', -1.3, 0.87, -3.1, { label: '取扱説明書', ry: 0.2, onTake: async (gg) => { const c = await gg.ask('読みますか？', ['読む', 'あとで']); if (c === 0) await gg.readDoc('manual'); } });
    r.box('iron', 0.32, 0.05, 0.05, -0.6, 0.86, -3.0, { ry: 0.5 });
    r.box('iron', 0.05, 0.05, 0.28, -0.45, 0.86, -3.2, { ry: -0.3 });
    r.place(F.shelf({ w: 1.0, h: 1.6, d: 0.3, seed: 9 }), 0.35, -3.33, 0, { collide: true });
    r.pickup('flask', 0.15, 0.6, -3.3, { id: 'boilerFlask', ry: 0.6 });

    // ---- light: a lamp on a hook by the steps, the light well, the fire
    const lamp = F.oilLamp();
    lamp.position.set(-1.75, 2.25, -2.35);
    r.static.add(lamp);
    r.box('iron', 0.02, H - 2.57, 0.02, -1.75, 2.57, -2.35, { cast: false });
    r.flame(-1.75, 2.25 + 0.2, -2.35, { size: 0.05, intensity: 3.2, distance: 8 });
    const lamp2 = F.oilLamp();
    lamp2.position.set(1.0, 2.3, 2.1);
    r.static.add(lamp2);
    r.box('iron', 0.02, H - 2.62, 0.02, 1.0, 2.62, 2.1, { cast: false });
    r.flame(1.0, 2.3 + 0.2, 2.1, { size: 0.05, intensity: 3.2, distance: 8 });
    r.point(-0.5, 3.0, -0.6, { color: 0x6a7490, intensity: 5, distance: 10 });
    r.hemi(0x4a5a78, 0x1a140e, 3.2);

    // ---- the stoker
    g.spawn(r, {
      id: 'stoker', type: 'stoker', x: -4.0, z: -1.05, rot: 0, dormant: true,
      onDeath: () => { g.flags['dead:stoker'] = true; },
    });

    if (g.flags.steamUp) heatUp(r, g, true);
    else if (r.turned.includes('yellow')) setFire(r, 1);

    r.shot({ id: 'stairs', pos: [0.9, 3.3, 2.7], look: [-3.0, 0.8, -1.8], fov: 58, zone: [-4.7, -3.7, -1.6, 3.7] });
    r.shot({ id: 'boiler', pos: [-1.3, 3.3, 3.1], look: [2.6, 0.9, -1.4], fov: 58, zone: [-1.6, -3.7, 4.7, 0.6] });
    r.shot({ id: 'valves', pos: [-0.9, 3.2, -1.3], look: [1.4, 0.9, 2.9], fov: 60, zone: [-1.6, 0.6, 4.7, 3.7] });
  },

  setup(r, g) {
    r.ambience = g.flags.steamUp ? 'boilerHot' : 'boiler';
  },

  update(r, g, dt) {
    // the needle trembles under pressure
    r.needle.rotation.z = 2.3 - 4.2 * r.pressure + (r.pressure > 0.5 ? Math.sin(r.time * 23) * 0.03 : 0);
    if (g.flags.steamUp) {
      r.wispT = (r.wispT || 1) - dt;
      if (r.wispT <= 0) {
        r.wispT = 1.2 + Math.random() * 2.2;
        const j = r.joints[Math.floor(Math.random() * r.joints.length)];
        g.burst('steam', j[0], j[1], j[2], { n: 5, size: 0.5, speed: 0.4, up: 0.6, life: 1.6 });
      }
    }
    // he wakes when someone comes up to him (not going by on the steps)
    const m = r.monsters.find((x) => x.id === 'stoker');
    const p = g.player;
    if (m && m.state === 'dormant' && !m.hidden && p.alive && !g.locked && p.pos.y < 0.3 && Math.hypot(p.pos.x - m.pos.x, p.pos.z - m.pos.z) < 1.6) g.run(() => stokerRises(r, g));
  },

  onNoise(r, g, kind) {
    if (kind === 'gun') g.run(() => stokerRises(r, g));
  },
};

function setFire(r, v) {
  r.glowM.color.setRGB(0.07 + v * 0.93, 0.016 + v * 0.36, 0.008 + v * 0.06);
  r.furnace.userData.off = v <= 0;
  r.lights.find((L) => L.light === r.furnace).base = v * 7;
}

// Up to pressure: the fire roaring, steam at every joint, the bolt lifted.
function heatUp(r, g, instant) {
  setFire(r, 1);
  r.pressure = 0.82;
  if (instant) r.bolt.position.y = 1.0;
  for (const w of Object.values(r.wheels)) w.rotation.z = -Math.PI * 4;
}

async function spin(r, g, id, to, dur) {
  const w = r.wheels[id];
  const st = { v: w.rotation.z };
  const iv = setInterval(() => { w.rotation.z = st.v; }, 16);
  await g.tween(st, 'v', to, dur);
  clearInterval(iv);
  w.rotation.z = to;
}

async function turnValve(r, g, v) {
  if (g.flags.steamUp) { await g.say(`${v.name}弁は、開いたままだ。\nボイラーが、唸りを上げている。`); return; }
  if (r.turned.includes(v.id)) { await g.say(`${v.name}弁は、もう開いている。`); return; }
  const c = await g.ask(`${v.name}弁を回しますか？`, ['回す', 'やめる']);
  if (c !== 0) return;
  g.lock();
  g.audio.sfx('valve', { at: { x: v.x, y: 1.5, z: MZ } });
  await spin(r, g, v.id, -Math.PI * 4, 1.0);
  r.turned.push(v.id);
  g.flags.boilerValves = r.turned.slice();
  if (r.turned.some((id, i) => id !== ORDER[i])) {
    await vent(r, g);
  } else if (v.id === 'blue') {
    g.audio.sfx('pour', { at: { x: 0.3, y: 2, z: MZ } });
    g.audio.sfx('bubble', { at: { x: BX, y: 1.5, z: BZ } });
    await g.say('青い弁を開いた。\n配管の中を、水の流れていく音がする。');
  } else if (v.id === 'yellow') {
    g.audio.sfx('fireBurst', { at: { x: BX, y: 0.7, z: BZ + BR } });
    const st = { v: 0 };
    const iv = setInterval(() => setFire(r, st.v), 16);
    await g.tween(st, 'v', 1, 0.8);
    clearInterval(iv);
    setFire(r, 1);
    await g.say('黄色い弁を開くと、\n炉の奥で、ごうっと火が噴き上がった。');
  } else await raiseSteam(r, g);
  g.unlock();
  await stokerRises(r, g);
}

// The wrong valve: the pipes scream, the joints blow scalding steam over
// whoever stands at them, and every valve springs shut again.
async function vent(r, g) {
  g.audio.sfx('pipeGroan', { at: { x: 0.3, y: 2, z: MZ } });
  await g.wait(0.6);
  g.audio.sfx('hiss', { at: { x: 0.3, y: 1.5, z: MZ } });
  g.shake(0.1, 0.6);
  for (const x of [-0.9, 0.3, 1.5]) g.burst('steam', x, 1.55, MZ - 0.2, { n: 18, size: 0.9, speed: 1.8, up: 0.8, life: 1.8, dir: [0, -1] });
  const p = g.player;
  const near = (o, d) => Math.hypot(o.pos.x - 0.3, o.pos.z - MZ) < d;
  if (p.alive && near(p, 2.0) && p.hp > 1) p.damage(Math.min(10, p.hp - 1), 0.3, MZ + 0.5, { knock: 3.2 });
  // anything else in the steam gets it worse
  for (const m of r.monsters) if (m.alive && m.state !== 'dormant' && near(m, 2.3)) m.damage(40, 0.3, MZ + 0.5, 2.5);
  r.turned = [];
  g.flags.boilerValves = [];
  setFire(r, 0);
  await Promise.all(VALVES.map((v) => spin(r, g, v.id, 0, 0.35)));
  await g.say('配管が悲鳴のような音を立て――\n継ぎ目から、熱い蒸気が噴き出した！\n\n弁が、すべて勢いよく閉じてしまった。');
}

async function raiseSteam(r, g) {
  g.flags.steamUp = true;
  g.cut({ pos: [0.6, 2.0, 0.4], look: [1.9, 1.7, -1.1], fov: 40 });
  g.audio.sfx('pipeGroan', { at: { x: BX, y: 2, z: BZ } });
  const st = { v: 0 };
  const iv = setInterval(() => { r.pressure = st.v; }, 16);
  await g.tween(st, 'v', 0.82, 2.4);
  clearInterval(iv);
  r.pressure = 0.82;
  for (const j of r.joints.slice(0, 4)) g.burst('steam', j[0], j[1], j[2], { n: 6, size: 0.5, speed: 0.6, up: 0.5, life: 1.4 });
  g.audio.sfx('hiss', { at: { x: 0.3, y: 3, z: 0 } });
  await g.say('赤い弁を開いた。\n圧力計の針が、じりじりと上がっていく――');
  g.cut({ pos: [1.7, 2.1, 0.4], look: [4.4, 1.5, 1.6], fov: 46 });
  await g.wait(0.4);
  g.audio.sfx('hiss', { at: { x: 4.3, y: 2.5, z: 1.6 } });
  const b = { v: 0 };
  const iv2 = setInterval(() => { r.bolt.position.y = b.v; }, 16);
  await g.tween(b, 'v', 1.0, 0.9);
  clearInterval(iv2);
  r.bolt.position.y = 1.0;
  g.audio.sfx('clank', { at: { x: 4.3, y: 2, z: 1.6 } });
  g.shake(0.06, 0.3);
  r.ambience = 'boilerHot';
  g.audio.setAmbience('boilerHot', r);
  await g.say('ガシャン、と重い音。\n塔への鉄扉の閂が、蒸気の力で持ち上がった。');
  g.cut(null);
}

// The stoker gets up off his coal, the first time anything wakes him.
async function stokerRises(r, g) {
  const m = r.monsters.find((x) => x.id === 'stoker');
  if (!m || m.state !== 'dormant') return;
  m.wake();
  g.lock();
  g.cut({ pos: [-1.9, 1.5, 1.5], look: [-4.0, 0.5, -1.4], fov: 48 });
  g.audio.sfx('rumble', { at: m.pos });
  await g.wait(1.6);
  await g.say('石炭の山が崩れ――\n煤にまみれた大男が、シャベルを握って起き上がった。');
  g.cut(null);
  g.unlock();
}
