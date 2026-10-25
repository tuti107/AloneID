// 礼拝堂 — Jonah's chapel. Its drowned minister still preaches to the empty
// pews; its window, read from the bottom up, tells in what order to light
// the four coloured lamps; its tabernacle keeps the island's holy oil.
import * as THREE from 'three';
import * as F from '../furniture.js';
import { M, C } from '../mats.js';

const H = 6.0, STEP = 0.3;
// the four lamps round the chancel, and the order the window gives them
const LAMPS = [
  { id: 'red', name: '赤い', x: -2.6, z: -4.4, color: 0xff3a20 },
  { id: 'gold', name: '金色の', x: -1.4, z: -5.5, color: 0xffc040 },
  { id: 'blue', name: '青い', x: 1.4, z: -5.5, color: 0x3a70ff },
  { id: 'green', name: '緑の', x: 2.6, z: -4.4, color: 0x40e060 },
];
const ORDER = ['blue', 'green', 'red', 'gold'];
// where the drowned come down off the broken window: the chancel's corners
const THRALLS = [[1, -3.7, -5.2], [2, 3.7, -5.2], [3, -3.9, -4.2]];

export default {
  id: 'chapel',
  name: '礼拝堂',
  bounds: [-4.7, -6.2, 4.7, 6.2],
  floorType: 'stone',
  ambience: 'tide',
  build(r, g) {
    r.shell(-4.5, -6, 4.5, 6, {
      h: H, floor: 'stoneFloor', ceil: 'plasterDark', mat: 'stoneWall', wainscot: 'wainscot', wainscotH: 1.1, crown: 'woodBlack',
      openings: {
        s: [{ at: 0, w: 1.3, h: 2.5 }],
        n: [{ at: 0, w: 2.0, h: 3.2, sill: 2.1 }],
        e: [{ at: 1.5, w: 0.8, h: 2.2, sill: 2.4 }, { at: -1.5, w: 0.8, h: 2.2, sill: 2.4 }],
        w: [{ at: 1.5, w: 0.8, h: 2.2, sill: 2.4 }, { at: -1.5, w: 0.8, h: 2.2, sill: 2.4 }],
      },
    });
    F.rug(r, 'carpetRunner', 0, 1.1, 1.2, 9.4, 0);

    // ---- the chancel, a step up at the north end
    const slab = M('stoneFloor').clone();
    slab.polygonOffset = true;
    slab.polygonOffsetFactor = 1;
    slab.polygonOffsetUnits = 2;
    r.box(slab, 8.88, STEP - 0.005, 2.4, 0, 0, -4.8);
    r.floor(-4.44, -5.94, 4.44, -3.6, 'stoneFloor', STEP);
    r.platform(-4.5, -6, 4.5, -3.6, STEP);

    r.door(0, 6, Math.PI, { w: 1.3, h: 2.5, double: true, to: 'gallery', entry: 'fromChapel', label: '回廊への扉', wallMat: 'stoneWall', panel: 'woodBlack', panelInset: 'wood', sound: 'doorHeavy' });
    r.entry('fromGallery', 0, 5.3, Math.PI);

    // ---- the window over the altar: whole, or smashed in
    const win = r.window(0, -6, 0, { w: 2.0, h: 3.2, sill: 2.1, view: 'stainedGlass', glassColor: 0xc8c0b8, rain: false, panes: false, intensity: 30, angle: 0.45, color: 0x8a70c0, beam: false, dyn: true });
    r.win = win;
    if (g.flags.chapelGlassBroken) breakGlass(r);
    r.interact({
      id: 'glass', x: 0, z: -2.7, r: 0.5, label: 'ステンドグラス', arc: 0.7,
      use: (gg) => gg.say(gg.flags.chapelGlassBroken
        ? '砕けたステンドグラスの枠から、雨が吹き込んでくる。'
        : '祭壇の上の、大きなステンドグラス。\n下から順に、青い海、緑の星、赤い炎、金色の太陽が描かれている。'),
    });
    for (const x of [-4.5, 4.5]) {
      for (const z of [-1.5, 1.5]) {
        r.window(x, z, x < 0 ? Math.PI / 2 : -Math.PI / 2, { w: 0.8, h: 2.2, sill: 2.4, intensity: 18, angle: 0.5, beam: false, panes: false });
      }
    }

    // ---- pews either side of the aisle
    for (const z of [4.1, 2.6, 1.1, -0.4]) {
      for (const x of [-2.55, 2.55]) {
        // seat and back stop short inside the end panels, so no faces meet
        r.box('wood', 2.5, 0.06, 0.4, x, 0.42, z - 0.03);
        r.box('wood', 2.5, 0.55, 0.05, x, 0.48, z + 0.2);
        for (const ex of [-1.27, 1.27]) r.box('woodBlack', 0.06, 0.95, 0.5, x + ex, 0, z);
        r.collider(x, z, 1.32, 0.28);
      }
    }

    // ---- altar and tabernacle
    const altar = F.table({ w: 2.0, d: 0.8, h: 0.95, wood: 'woodBlack', cloth: true });
    r.place(altar, 0, -5.25, 0, { y: STEP, collide: [2.0, 0.8] });
    const tab = new THREE.Group();
    const gold = M('brass', { phong: true, shininess: 70, specular: 0xaa8844 });
    F.bx(tab, gold, 0.56, 0.62, 0.4, 0, 0, 0);
    F.bx(tab, gold, 0.64, 0.06, 0.46, 0, 0.62, 0);
    const doors = [];
    for (const sx of [-1, 1]) {
      const piv = new THREE.Group();
      piv.position.set(sx * 0.25, 0.08, 0.205);
      tab.add(piv);
      const leaf = F.bx(piv, gold, 0.25, 0.46, 0.02, -sx * 0.125, 0, 0);
      void leaf;
      F.bx(piv, C(0x4a2a10), 0.1, 0.1, 0.01, -sx * 0.125, 0.2, 0.012);
      doors.push({ piv, sx });
    }
    const inside = C(0x1a0e08);
    F.bx(tab, inside, 0.5, 0.46, 0.02, 0, 0.08, 0.16);
    r.place(tab, 0, -5.35, 0, { y: STEP + 0.95, dyn: true });
    r.tabernacle = { tab, doors, open: 0 };
    const setOpen = (v) => { r.tabernacle.open = v; for (const d of doors) d.piv.rotation.y = d.sx * v * 1.6; };
    r.setTabernacle = setOpen;
    if (g.flags.lampsLit) setOpen(1);
    for (const x of [-0.75, 0.75]) {
      r.place(F.candle({ h: 0.3, r: 0.03 }), x, -5.3, 0, { y: STEP + 0.95, cast: false });
      r.flame(x, STEP + 0.95 + 0.31, -5.3, { size: 0.07, intensity: 2.0, distance: 5 });
    }
    if (g.flags.lampsLit && !g.flags['taken:holyOil']) placeOil(r, g);
    if (g.flags.lampsLit && !g.flags['taken:prayer']) r.pickup('prayer', 0.18, STEP + 0.97, -5.05, { label: '祈祷書', ry: -0.3 });
    r.interact({
      id: 'tabernacle', x: 0, z: -4.45, r: 0.5, label: '聖櫃',
      enabled: (gg) => !gg.flags.lampsLit,
      use: (gg) => gg.say('祭壇の上の、金色の小さな聖櫃。扉は固く閉ざされている。\n台座に刻まれている――「炎を、正しき順に灯せ」。'),
    });

    // ---- the four lamps
    r.lamps = {};
    for (const L of LAMPS) {
      const st = new THREE.Group();
      F.bx(st, 'iron', 0.3, 0.04, 0.3, 0, 0.004, 0);
      F.cy(st, M('iron'), 0.025, 0.035, 1.05, 0, 0.04, 0, 6);
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshPhongMaterial({ color: L.color, emissive: new THREE.Color(L.color).multiplyScalar(0.15), transparent: true, opacity: 0.6, shininess: 80, depthWrite: false }));
      globe.position.y = 1.2;
      st.add(globe);
      r.place(st, L.x, L.z, 0, { y: STEP, collide: [0.3, 0.3] });
      const fl = r.flame(L.x, STEP + 1.1, L.z, { size: 0.08, color: L.color, glow: L.color, lightColor: L.color, intensity: 0, distance: 6 });
      const lamp = { L, globe, fl, lit: false };
      r.lamps[L.id] = lamp;
      setLamp(lamp, !!g.flags.lampsLit);
      r.interact({
        id: 'lamp_' + L.id, x: L.x, z: L.z + 0.5, r: 0.4, label: `${L.name}硝子の燭台`,
        verb: (gg) => (gg.flags.lampsLit || lamp.lit ? '調べる' : '灯す'),
        use: (gg) => lightLamp(r, gg, lamp),
        item: async (gg, id) => {
          if (id !== 'matches') return false;
          await lightLamp(r, gg, lamp);
          return true;
        },
      });
    }

    // ---- pulpit and organ
    const pulpit = new THREE.Group();
    F.bx(pulpit, 'woodBlack', 0.9, 1.15, 0.7, 0, 0, 0);
    F.bx(pulpit, 'wood', 0.95, 0.06, 0.8, 0, 1.15, 0);
    F.bx(pulpit, M('woodRed'), 0.6, 0.6, 0.02, 0, 0.35, 0.36);
    r.place(pulpit, -2.9, -3.15, 0, { collide: [0.9, 0.7] });
    r.interact({
      id: 'pulpit', x: -2.9, z: -2.45, r: 0.45, label: '説教壇',
      use: async (gg) => {
        if (gg.flags.pulpitSearched) { await gg.say('ふやけた説教の原稿が、何枚も貼りついている。'); return; }
        await gg.searchAnim();
        gg.flags.pulpitSearched = true;
        await gg.say('説教壇の棚に、薬局の古い小瓶がしまわれていた。');
        await gg.give('tonic');
      },
    });
    const organ = new THREE.Group();
    F.bx(organ, 'woodBlack', 1.6, 1.1, 0.8, 0, 0, 0);
    F.bx(organ, 'wood', 1.5, 0.08, 0.35, 0, 1.0, 0.35);
    for (let i = 0; i < 9; i++) {
      const hgt = 1.4 + Math.sin(i / 8 * Math.PI) * 1.4;
      F.cy(organ, M('brass', { phong: true, shininess: 50 }), 0.055, 0.055, hgt, -0.64 + i * 0.16, 1.1, -0.25, 8);
    }
    r.place(organ, 3.65, -2.9, -Math.PI / 2, { collide: [1.6, 0.9] });
    r.interact({
      id: 'organ', x: 3.0, z: -2.9, r: 0.5, label: 'パイプオルガン',
      use: async (gg) => {
        gg.audio.sfx('preacherHurt', { at: { x: 3.6, y: 1.5, z: -2.9 } });
        gg.audio.sfx('bubble', { at: { x: 3.6, y: 1.5, z: -2.9 } });
        await gg.say('鍵盤に触れると、海水の詰まったパイプが、\n溺れる獣のような音を立てた。');
      },
    });

    // ---- light: altar candles, the window, and a little from the storm
    r.hemi(0x4a5070, 0x161214, 3.0);
    r.point(0, 4.2, 0.5, { color: 0x5a6a9a, intensity: 11, distance: 15 });
    // candles in iron brackets down the side walls
    for (const x of [-4.5, 4.5]) {
      for (const z of [0, 3.6]) {
        const sc = F.sconce();
        const ry = x < 0 ? Math.PI / 2 : -Math.PI / 2;
        sc.position.set(x, 2.0, z);
        sc.rotation.y = ry;
        r.static.add(sc);
        const f = sc.userData.flames[0];
        const c = Math.cos(ry), sn = Math.sin(ry);
        r.flame(x + f[2] * sn, 2.0 + f[1], z + f[2] * c, { size: 0.06, intensity: 2.2, distance: 6 });
      }
    }

    // ---- the minister, still preaching
    if (!g.flags['dead:preacher']) {
      g.spawn(r, {
        id: 'preacher', type: 'preacher', x: -2.9, z: -3.85, rot: 0, preaching: true,
        onDeath: () => { g.flags['dead:preacher'] = true; g.audio.music(null); },
      });
    } else g.spawn(r, { id: 'preacher', type: 'preacher', x: -2.4, z: -2.8, rot: 0 }).restore({ hp: 0, x: -2.4, z: -2.8, rot: 0.4, dead: true });
    const preacher = r.monsters.find((m) => m.id === 'preacher');
    if (preacher) preacher.onDown = () => g.notify('……まだ、起き上がる。', 1.6);
    // the drowned who came in through the window
    for (const [i, x, z] of THRALLS) {
      const id = 'chapelThrall' + i;
      if (!g.flags.chapelGlassBroken || g.flags['dead:' + id]) continue;
      g.spawn(r, { id, type: 'thrall', seed: i + 3, x, z, rot: 0, onDeath: () => { g.flags['dead:' + id] = true; } });
    }
    // halfway up the aisle, the sermon stops
    r.trigger({ box: [-4.5, -6, 4.5, 0.6], once: true, lock: false, enter: (gg) => wakePreacher(r, gg) });

    r.shot({ id: 'nave', pos: [2.7, 3.9, 5.6], look: [-0.5, 0.9, -3.0], fov: 58, zone: [-4.7, 0.2, 4.7, 6.2] });
    r.shot({ id: 'chancel', pos: [3.9, 3.4, 0.4], look: [-1.0, 0.9, -4.8], fov: 60, zone: [-4.7, -6.2, 4.7, 0.2] });
    r.shot({ id: 'back', pos: [-0.6, 4.6, -5.6], look: [0.4, 0.6, 3.8], fov: 56, zone: [-1.2, -3.0, 1.2, 0.2], priority: -1 });
  },

  setup(r, g) {
    const p = r.monsters.find((m) => m.id === 'preacher');
    if (p && p.alive && p.state !== 'preach') g.audio.music('boss');
  },

  leave(r, g) {
    const p = r.monsters.find((m) => m.id === 'preacher');
    if (p && p.alive && p.state !== 'preach') g.audio.music(null);
  },

  async enter(r, g) {
    if (g.flags.chapelSeen) return;
    g.flags.chapelSeen = true;
    g.lock();
    g.cut({ pos: [1.6, 1.4, 3.2], look: [-2.6, 1.9, -3.9], fov: 46 });
    await g.wait(1.4);
    await g.say('誰もいない会衆席に向かって、\n溺れた男が、両手を掲げて説教を続けている……。');
    await g.say('水の詰まった喉から漏れるのは、もはや言葉ではない。');
    g.cut(null);
    g.unlock();
  },
};

function setLamp(lamp, on) {
  lamp.lit = on;
  lamp.fl.sprite.visible = lamp.fl.glow.visible = on;
  if (lamp.fl.light) { lamp.fl.light.userData.off = !on; if (on) lamp.fl.light.intensity = 3; }
  lamp.globe.material.emissive.set(lamp.L.color).multiplyScalar(on ? 0.9 : 0.15);
}

function wakePreacher(r, g) {
  const p = r.monsters.find((m) => m.id === 'preacher');
  if (!p || !p.alive || p.state !== 'preach') return;
  p.wake();
  g.audio.sfx('preacherNotice', { at: p.pos });
  g.audio.music('boss');
  g.notify('説教が、止んだ――', 1.8);
}

// Lighting the lamps in the window's order: the sea, the star, the flame, the
// dawn. A wrong one and a cold wind puts them all out.
async function lightLamp(r, g, lamp) {
  if (g.flags.lampsLit || lamp.lit) { await g.say(`${lamp.L.name}硝子の中で、炎が静かに揺れている。`); return; }
  wakePreacher(r, g);
  if (!g.has('matches')) { await g.say('火を点けるものがない。'); return; }
  const c = await g.ask(`${lamp.L.name}硝子の燭台に、火を灯しますか？`, ['灯す', 'やめる']);
  if (c !== 0) return;
  g.audio.sfx('match');
  setLamp(lamp, true);
  const lit = (r.order = r.order || []);
  lit.push(lamp.L.id);
  if (lit.some((id, i) => id !== ORDER[i])) {
    r.order = [];
    await g.wait(0.6);
    g.audio.sfx('wind');
    g.audio.sfx('candleOut');
    for (const l of Object.values(r.lamps)) setLamp(l, false);
    await g.say('冷たい風が礼拝堂を吹き抜け、\n灯した炎が、すべて掻き消えた。');
    return;
  }
  if (lit.length < ORDER.length) return;
  // all four, in order: the tabernacle opens
  g.flags.lampsLit = true;
  g.lock();
  g.cut({ pos: [1.1, 1.9, -3.4], look: [0, 1.4, -5.4], fov: 46 });
  await g.wait(0.6);
  g.audio.sfx('seal');
  g.audio.sfx('mechanism');
  const st = { v: 0 };
  const iv = setInterval(() => r.setTabernacle(st.v), 16);
  await g.tween(st, 'v', 1, 1.2);
  clearInterval(iv);
  r.setTabernacle(1);
  placeOil(r, g);
  r.pickup('prayer', 0.18, STEP + 0.97, -5.05, { label: '祈祷書', ry: -0.3 });
  await g.say('四つの炎が揃うと、聖櫃の扉がひとりでに開いた。\n中に、琥珀色の油の小瓶と、古い祈祷書がある。');
  g.cut(null);
  g.unlock();
}

function placeOil(r, g) {
  r.pickup('holyOil', 0, STEP + 1.06, -5.33, {
    label: '聖油', ry: 0.4,
    onTake: (gg) => shatter(r, gg),
  });
}

function breakGlass(r) {
  const w = r.win;
  w.glassMat.color.set(0x050608);
  w.base.copy(w.glassMat.color);
  if (w.light) w.light.color.set(0x405070);
}

// Taking the oil: the window comes in, and with it the sea's dead.
async function shatter(r, g) {
  if (g.flags.chapelGlassBroken) return;
  g.flags.chapelGlassBroken = true;
  g.lock();
  g.cut({ pos: [0.9, 1.4, -2.2], look: [0, 3.6, -6.0], fov: 56 });
  await g.wait(0.5);
  r.flash = 1;
  g.audio.thunder(0.05, 1.8);
  g.audio.sfx('glass', { at: { x: 0, y: 3.5, z: -6 } });
  g.audio.sfx('glass', { at: { x: 0.5, y: 3.0, z: -6 } });
  breakGlass(r);
  g.burst('glass', 0, 3.6, -5.8, { dir: [0, 1], n: 40, speed: 3.5 });
  g.flash(0.6);
  g.shake(0.12, 0.6);
  await g.wait(0.7);
  for (const [i, x, z] of THRALLS) {
    const id = 'chapelThrall' + i;
    const m = g.spawn(r, { id, type: 'thrall', seed: i + 3, x, z, rot: Math.atan2(-x, -1 - z), onDeath: () => { g.flags['dead:' + id] = true; } });
    m.attackCd = 1.5 + i * 0.3;
    g.audio.sfx('splash', { at: m.pos });
    g.burst('splash', x, 0.5, z, { n: 12 });
    await g.wait(0.35);
  }
  g.audio.sfx('thrallNotice', { at: { x: 0, y: 1, z: -4 } });
  await g.say('ステンドグラスが砕け散り、\n割れた窓から、ずぶ濡れの者たちが次々に這い込んできた！');
  g.cut(null);
  g.unlock();
}
