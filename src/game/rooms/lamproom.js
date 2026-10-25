// 灯室 — the top of the east tower: the great lamp Ezekiel brought the
// island's oil home to burn, and Harlow kept alight for a hundred and
// twenty years. Fill it with the holy oil and light it, and the sea
// draws back from the house; carry its fire away in a storm lantern.
import * as THREE from 'three';
import * as F from '../furniture.js';
import { M, spriteMat } from '../mats.js';

const H = 3.4;

export default {
  id: 'lamproom',
  name: '灯室',
  bounds: [-3.2, -3.2, 3.2, 3.2],
  floorType: 'wood',
  ambience: 'lamp',
  build(r, g) {
    r.shell(-3, -3, 3, 3, {
      h: H, floor: 'woodFloorDark', ceil: 'woodBlack', mat: 'stoneWall', baseboard: false, crown: 'woodBlack',
      openings: {
        n: [{ at: 0, w: 2.2, h: 1.7, sill: 0.8 }],
        e: [{ at: 0, w: 2.2, h: 1.7, sill: 0.8 }],
        w: [{ at: 0, w: 2.2, h: 1.7, sill: 0.8 }],
        s: [{ at: -1.8, w: 0.9, h: 2.1 }, { at: 1.3, w: 1.2, h: 1.5, sill: 0.9 }],
      },
    });
    r.window(0, -3, 0, { w: 2.2, h: 1.7, sill: 0.8, intensity: 16, beam: false });
    r.window(3, 0, -Math.PI / 2, { w: 2.2, h: 1.7, sill: 0.8, intensity: 16, beam: false });
    r.window(-3, 0, Math.PI / 2, { w: 2.2, h: 1.7, sill: 0.8, light: false });
    r.window(1.3, 3, Math.PI, { w: 1.2, h: 1.5, sill: 0.9, light: false });

    r.door(-1.8, 3, Math.PI, { to: 'tower', entry: 'fromLamp', w: 0.9, h: 2.1, label: '階段への扉', wallMat: 'stoneWall', panel: 'woodBlack' });
    r.entry('fromTower', -1.8, 2.35, Math.PI);

    // ---- the great lamp: an iron pedestal, the burner, the lens round it
    const iron = M('iron', { phong: true, shininess: 30 });
    const brass = M('brass', { phong: true, shininess: 70, specular: 0x887744 });
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.9, 8), iron);
    ped.position.set(0, 0.449, 0);
    ped.castShadow = true;
    r.static.add(ped);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.06, 16), brass);
    table.position.set(0, 0.93, 0);
    r.static.add(table);
    const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.42, 10), brass);
    burner.position.set(0, 0.96 + 0.21, 0);
    r.static.add(burner);
    // the lens: rings of glass prisms in a brass cage round the flame
    r.lensM = new THREE.MeshLambertMaterial({ color: 0x7a9a94, emissive: 0x000000, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.1, 20, 1, true), r.lensM);
    lens.position.set(0, 0.97 + 0.55, 0);
    lens.renderOrder = 2;
    r.dynamic.add(lens);
    r.prismM = new THREE.MeshLambertMaterial({ color: 0x92aaa4, emissive: 0x000000, transparent: true, opacity: 0.75 });
    for (let i = 0; i < 13; i++) {
      const y = 1.02 + i * 0.083;
      const k = Math.abs(i - 6) / 6;
      const pr = new THREE.Mesh(new THREE.TorusGeometry(0.43 - k * k * 0.04, 0.008 + (1 - k) * 0.008, 3, 24), r.prismM);
      pr.rotation.x = Math.PI / 2;
      pr.position.set(0, y, 0);
      r.dynamic.add(pr);
    }
    for (const y of [0.99, 2.06]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.03, 6, 24), brass);
      band.rotation.x = Math.PI / 2;
      band.position.set(0, y, 0);
      r.dynamic.add(band);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.08, 0.03), brass);
      bar.position.set(Math.sin(a) * 0.44, 1.52, Math.cos(a) * 0.44);
      r.dynamic.add(bar);
    }
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.32, 16), iron);
    cap.position.set(0, 2.08 + 0.16, 0);
    cap.castShadow = true;
    r.dynamic.add(cap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.025, 6, 32), brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.92, 0);
    r.static.add(ring);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      r.box(brass, 0.04, 0.92, 0.04, Math.sin(a) * 0.85, 0, Math.cos(a) * 0.85);
    }
    r.collider(0, 0, 0.8, 0.8);
    r.collider(0, 0, 0.8, 0.8, Math.PI / 4);
    // the undying flame, and its light
    r.fire = new THREE.Sprite(spriteMat('flame', 0xfff4e0, 0.95));
    r.fire.position.set(0, 1.55, 0);
    r.fire.scale.set(0.001, 0.001, 1);
    r.dynamic.add(r.fire);
    r.halo = new THREE.Sprite(spriteMat('glow', 0xffe6b0, 0.0));
    r.halo.position.set(0, 1.55, 0);
    r.halo.scale.set(2.6, 2.6, 1);
    r.dynamic.add(r.halo);
    r.fireLight = r.point(0, 1.6, 0, { color: 0xfff0d0, intensity: 0, distance: 12, flicker: 0.08, speed: 5 });
    // the beams it throws, turning
    r.beams = new THREE.Group();
    r.beams.position.set(0, 1.55, 0);
    const beamM = new THREE.MeshBasicMaterial({ color: 0xfff2d0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (const s of [1, -1]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.6, 9, 16, 1, true), beamM);
      b.rotation.z = (-s * Math.PI) / 2;
      b.position.x = -s * 4.5;
      b.userData.noShadow = true;
      b.renderOrder = 6;
      r.beams.add(b);
    }
    r.beamM = beamM;
    r.dynamic.add(r.beams);
    r.sweep = r.spot(0, 1.55, 0, 6, 1.4, 0, { color: 0xfff0d0, intensity: 0, distance: 16, angle: 0.3, penumbra: 0.5 });
    r.lit = 0;
    r.interact({
      id: 'greatLamp', x: 0, z: 1.15, r: 0.45, y: 1.2, label: '大灯台の灯',
      verb: (gg) => (!gg.flags.holyOilPoured && gg.has('holyOil') ? '油を注ぐ' : gg.flags.holyOilPoured && !gg.flags.towerLit ? '灯す' : '調べる'),
      use: (gg) => useLamp(r, gg),
      item: async (gg, id) => {
        if (id === 'holyOil' && !gg.flags.holyOilPoured) { await pourOil(r, gg); return true; }
        if (id === 'matches' && gg.flags.holyOilPoured && !gg.flags.towerLit) { await lightLamp(r, gg); return true; }
        if (id === 'lantern' && gg.flags.towerLit && !gg.flags.lanternLit) { await lightLantern(r, gg); return true; }
        return false;
      },
    });

    // ---- Harlow's corner: his desk, his log, his lamp
    r.place(F.desk({ w: 1.0, d: 0.5, wood: 'woodBlack' }), -2.55, 1.35, Math.PI / 2, { collide: true });
    r.place(F.chair({ wood: 'woodBlack', seat: 'leather' }), -1.95, 1.4, -Math.PI / 2 + 0.3, { collide: [0.45, 0.45] });
    r.pickup('harlow', -2.5, 0.79, 1.2, { label: '黒い革の日誌', ry: 1.4, onTake: async (gg) => { const c = await gg.ask('読みますか？', ['読む', 'あとで']); if (c === 0) await gg.readDoc('harlow'); } });
    const ol = F.oilLamp();
    ol.position.set(-2.6, 0.785, 1.7);
    r.static.add(ol);
    r.flame(-2.6, 0.785 + 0.2, 1.7, { size: 0.05, intensity: 2.2, distance: 6 });
    // star charts pinned up by the door
    const chart = F.painting({ w: 0.9, h: 0.62, art: 'paper', frame: 'wood' });
    chart.position.set(-0.35, 1.95, 2.97);
    chart.rotation.y = Math.PI;
    r.static.add(chart);
    r.interact({ id: 'chart', x: -0.35, z: 2.4, r: 0.45, y: 1.6, label: '星図', use: (gg) => gg.say('黄ばんだ星図。南の空の、見慣れない星の並びに、赤い印が付けてある。\n余白に、震える字で――「二つの星揃う夜、深きものは目覚める」') });
    // the telescope at the east window
    const scope = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 1.25, 5), M('woodBlack'));
      leg.position.set(Math.sin(a) * 0.2, 0.6, Math.cos(a) * 0.2);
      leg.rotation.set(Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3);
      scope.add(leg);
    }
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.95, 10), brass);
    tube.position.set(0, 1.28, 0);
    tube.rotation.z = -Math.PI / 2 + 0.3;
    scope.add(tube);
    scope.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    r.place(scope, 2.25, -0.6, 0, { collide: [0.5, 0.5] });
    r.interact({
      id: 'telescope', x: 1.7, z: -0.6, r: 0.4, y: 1.3, label: '望遠鏡',
      use: (gg) => gg.say('望遠鏡を覗くと――\n稲光の下、沖の岩礁に、黒い帆船の影が浮かんでいた。\n\n……マストに翻る旗に、黒い鴎の紋。'),
    });
    r.box('rust', 0.3, 0.4, 0.3, 2.55, 0, 2.5, { collide: true, ry: 0.4 });
    r.interact({ id: 'oilcans', x: 2.0, z: 2.3, r: 0.4, label: '油缶', use: (gg) => gg.say('空の油缶が転がっている。\nどれも、底に琥珀色の雫が乾いてこびりついている。……普通の油ではない。') });

    r.hemi(0x5a6a8a, 0x1a1612, 3.2);

    if (g.flags.towerLit) setLit(r, 1);

    r.shot({ id: 'sw', pos: [-2.65, 3.05, 2.65], look: [1.0, 0.9, -1.0], fov: 60, zone: [[-3.2, -3.2], [3.2, -3.2], [3.2, 3.2]] });
    r.shot({ id: 'ne', pos: [2.65, 3.05, -2.65], look: [-1.0, 0.9, 1.0], fov: 60, zone: [[-3.2, -3.2], [3.2, 3.2], [-3.2, 3.2]] });
  },

  setup(r, g) {
    r.ambience = g.flags.towerLit ? 'lampLit' : 'lamp';
  },

  update(r, g, dt) {
    if (r.lit <= 0) return;
    r.beams.rotation.y += dt * 0.55;
    const a = r.beams.rotation.y;
    r.sweep.target.position.set(Math.cos(a) * 6, 1.4, -Math.sin(a) * 6);
    const k = 1 + Math.sin(r.time * 13) * 0.04 + Math.sin(r.time * 7.3) * 0.05;
    r.fire.scale.set(0.16 * r.lit * k, 0.34 * r.lit * (2 - k), 1);
  },
};

function setLit(r, v) {
  r.lit = v;
  r.halo.material.opacity = 0.3 * v;
  r.lensM.emissive.setRGB(0.22 * v, 0.19 * v, 0.13 * v);
  r.prismM.emissive.setRGB(0.34 * v, 0.3 * v, 0.2 * v);
  r.beamM.opacity = 0.045 * v;
  r.lights.find((L) => L.light === r.fireLight).base = 7 * v;
  r.lights.find((L) => L.light === r.sweep).base = 16 * v;
  r.fire.scale.set(0.16 * v, 0.34 * v, 1);
}

async function useLamp(r, g) {
  if (!g.flags.holyOilPoured) {
    if (g.has('holyOil')) {
      const c = await g.ask('火皿に、聖油を注ぎますか？', ['注ぐ', 'やめる']);
      if (c === 0) await pourOil(r, g);
      return;
    }
    await g.say('巨大なレンズの奥に、芯の付いた火皿がある。\n油壺は、からからに乾いている。\n\n……ここに注ぐのは、ただの油ではないのだろう。');
    return;
  }
  if (!g.flags.towerLit) {
    if (!g.has('matches')) { await g.say('火皿は聖油で満ちている。\n……火を点けるものがない。'); return; }
    const c = await g.ask('マッチで、火皿に火を点けますか？', ['点ける', 'やめる']);
    if (c === 0) await lightLamp(r, g);
    return;
  }
  if (g.has('lantern') && !g.flags.lanternLit) {
    const c = await g.ask('嵐のランタンに、この火を移しますか？', ['移す', 'やめる']);
    if (c === 0) await lightLantern(r, g);
    return;
  }
  await g.say(g.flags.lanternLit ? '消えない火が、レンズの奥で静かに燃えている。' : '消えない火が、レンズの奥で静かに燃えている。\n……この火を、持ち運べるものがあれば。');
}

async function pourOil(r, g) {
  g.flags.holyOilPoured = true;
  g.inv.remove('holyOil');
  g.audio.sfx('pour', { at: { x: 0, y: 1.2, z: 0 } });
  await g.reachAnim();
  await g.say('聖油を、火皿に注いだ。\n南洋の香木の、甘く重い匂いが立ちのぼる。');
}

async function lightLamp(r, g) {
  g.flags.towerLit = true;
  g.lock();
  g.cut({ pos: [1.5, 1.9, 2.2], look: [0, 1.45, 0], fov: 46 });
  g.audio.sfx('match', { at: { x: 0, y: 1.4, z: 0 } });
  await g.wait(0.7);
  g.audio.sfx('beacon', { at: { x: 0, y: 1.4, z: 0 } });
  const st = { v: 0 };
  const iv = setInterval(() => setLit(r, st.v), 16);
  await g.tween(st, 'v', 1, 2.2);
  clearInterval(iv);
  setLit(r, 1);
  await g.say('マッチを火皿に近づけると――\n炎は、見たこともないほど白く、眩しく燃え上がった。');
  g.cut({ pos: [-2.7, 3.1, 2.7], look: [0.4, 1.3, -0.6], fov: 64 });
  await g.wait(1.6);
  await g.say('巨大なレンズが、ゆっくりと回りはじめた。\n光の束が、嵐の海を掃いていく――');
  g.audio.sfx('rumble');
  g.shake(0.05, 1.6);
  await g.wait(1.2);
  g.audio.sfx('surge');
  g.flags.tideReceded = true;
  r.ambience = 'lampLit';
  g.audio.setAmbience('lampLit', r);
  await g.say('遠く、館の下で、何かが退いていく音がした。\n……潮が、引いていく。');
  g.cut(null);
  g.unlock();
  if (g.has('lantern')) await useLamp(r, g);
}

async function lightLantern(r, g) {
  g.flags.lanternLit = true;
  g.audio.sfx('match', { at: { x: 0, y: 1.4, z: 0 } });
  g.audio.sfx('fireBurst', { at: { x: 0, y: 1.4, z: 0 }, vol: 0.4 });
  await g.reachAnim();
  g.player.refreshHeld();
  await g.say('嵐のランタンに、消えない火を移した。\n炎は、風にも雨にも揺らがない。\n\n……この光があれば、潮の者どもを退けられるかもしれない。');
}
