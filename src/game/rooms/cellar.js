// 地下室 — the wine cellar. Pitch dark without a lamp.
import * as THREE from 'three';
import * as F from '../furniture.js';
import { M, C } from '../mats.js';
import { floodLevel } from './cavern.js';

export default {
  id: 'cellar',
  name: '地下室',
  bounds: [-5.2, -3.2, 5.6, 3.2],
  floorType: 'stone',
  ambience: 'cellar',
  dark: true,
  silentThunder: false,
  build(r, g) {
    const H = 2.6;
    r.shell(-5, -3, 5, 3, {
      h: H, floor: 'stoneFloor', ceil: 'woodFloorDark', mat: 'stoneWall', baseboard: false,
      openings: { e: [{ at: 0.2, w: 1.0, h: 1.9, pass: true }] },
    });
    for (let x = -4.5; x <= 4.6; x += 1.5) r.box('woodBlack', 0.22, 0.25, 6, x, H - 0.25, 0);
    // stairs up to the hall (north-west corner)
    r.stairs(-4.3, -0.5, 'n', { w: 1.2, len: 2.5, rise: 2.3, steps: 9, mat: 'stoneFloor', side: 'stoneWall', rail: false, sides: [-1], collideSides: [-1] });
    r.box('#020202', 1.2, 0.05, 1.2, -4.3, H - 0.02, -2.4, { cast: false });
    r.point(-4.3, 2.4, -2.6, { color: 0xffb070, intensity: 1.2, distance: 4.5 });
    r.trigger({ box: [-5, -3, -3.6, -1.6], when: (gg) => gg.player.pos.y > 0.9, enter: (gg) => gg.goTo('hall', 'fromCellar', { fadeOut: 0.5 }) });
    r.entry('fromHall', -4.3, 0.3, 0);

    // racks along the south wall
    for (const x of [-2.4, -0.9, 0.6, 2.1]) r.place(F.wineRack({ w: 1.3, h: 2.0 }), x, 2.75, Math.PI, { collide: true });
    for (const [x, z, s] of [[2.6, -2.5, 1], [3.3, -2.45, 0.9], [2.95, -1.8, 1]]) r.place(F.barrel({ r: 0.32 * s, h: 0.85 * s }), x, z, x, { collide: true });
    r.place(F.crate({ s: 0.7 }), -1.6, -2.55, 0.2, { collide: true });
    r.place(F.crate({ s: 0.55 }), -0.9, -2.6, -0.3, { collide: true });
    r.place(F.crate({ s: 0.5 }), -1.6, -2.55, 0.5, { y: 0.7 });
    for (const x of [-1.6, 1.4]) r.box('stoneWall', 0.45, H, 0.45, x, 0, 0.1, { collide: true });
    r.place(F.trunk({ w: 1.1, h: 0.6, d: 0.6 }), 0.4, -2.6, 0, { collide: true });
    r.interact({
      id: 'chest', x: 0.4, z: -2.05, r: 0.5, label: '古い櫃',
      use: async (gg) => {
        if (gg.flags.cellarChest) { await gg.say('エゼキエルの櫃。もう何も残っていない。'); return; }
        await gg.searchAnim();
        gg.flags.cellarChest = true;
        await gg.say('「E・A　一七九二」と刻まれた古い櫃。\nサイラスが航海日誌を見つけたのは、きっとここだ。');
        await gg.say('底に、油紙に包まれた拳銃の弾が残っていた。');
        await gg.give('ammo', { count: 6 });
      },
    });
    F.cobweb(r, -4.95, H, 2.95, Math.PI / 2, 0.9);
    F.cobweb(r, 4.95, H, -2.95, -Math.PI / 2, 0.9);
    r.decal('blood', 3.6, 0.3, 1.0, 1.0, 0.5);

    // the movable rack hiding the passage
    const rack = F.wineRack({ w: 1.3, h: 2.0 });
    r.place(rack, 4.73, 0.2, -Math.PI / 2, { dyn: true });
    const info = r.interact({
      id: 'rackInfo', x: 4.1, z: 0.2, r: 0.5, label: 'ワイン棚',
      use: async (gg) => {
        if (gg.flags.passageOpen) { await gg.say('ワイン棚の裏に、岩肌の剥き出しになった穴が口を開けている。'); return; }
        await gg.say('床に、何かを引きずったような跡が、このワイン棚の前まで続いている。\n棚の隙間から、冷たい風と潮の匂いが漏れてくる……。');
        await gg.say('横から押せば、ずらせそうだ。');
      },
    });
    r.pushable(rack, {
      id: 'cellarRack', hw: 0.66, hd: 0.24, axis: [0, 1], min: 0, max: 1.5,
      onMove: (t, gg, silent) => {
        info.z = rack.position.z;
        if (t >= 1.45 && !gg.flags.passageOpen) {
          gg.flags.passageOpen = true;
          if (!silent) gg.task(async () => { gg.audio.sfx('sting'); await gg.say('ワイン棚の裏の壁に、黒々とした穴が口を開けた。\n奥から、波の音が聞こえる……。'); });
        }
      },
    });
    // tunnel mouth beyond the wall
    r.box('rockWet', 1.6, 2.2, 0.2, 5.6, 0, 0.2, { cast: false });
    r.box('rockWet', 0.8, 2.2, 0.2, 5.4, 0, -0.5, { ry: 0.4, cast: false });
    r.box('rockWet', 0.8, 2.2, 0.2, 5.4, 0, 0.9, { ry: -0.4, cast: false });
    r.floor(5.0, -0.4, 5.6, 0.8, 'rockWet');
    r.trigger({ box: [5.05, -0.4, 5.6, 0.8], when: (gg) => gg.flags.passageOpen, enter: (gg) => gg.goTo('cavern', 'fromCellar', { fadeOut: 0.7 }) });
    r.entry('fromCavern', 4.55, 0.2, -Math.PI / 2);

    r.hemi(0x2a3448, 0x0a0806, 0.7);

    // after the fire: the sea comes up the tunnel behind him
    const flood = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 6.4), new THREE.MeshPhongMaterial({ color: 0x041410, specular: 0x6a9a8a, shininess: 100, transparent: true, opacity: 0.8, depthWrite: false }));
    flood.rotation.x = -Math.PI / 2;
    flood.position.set(0.2, -0.2, 0);
    r.dynamic.add(flood);
    r.updaters.push((dt, t) => {
      const k = floodLevel(g);
      flood.visible = k > 0.12;
      flood.position.y = -0.08 + k * 0.5 + Math.sin(t * 0.9) * 0.01;
      r.floodY = flood.position.y;
    });
    r.waterAt = () => (r.floodY || -1) > 0.01;
    r.wade = () => 1 - 0.3 * Math.min(1, Math.max(0, ((r.floodY || 0) - 0.15) / 0.3));

    for (const [id, x, z] of [['crawler1', 1.2, 1.6], ['crawler2', 3.0, -0.9]]) {
      if (!g.flags['dead:' + id]) g.spawn(r, { id, type: 'crawler', x, z, rot: Math.random() * 6, onDeath: () => { g.flags['dead:' + id] = true; } });
    }

    r.shot({ id: 'stairs', pos: [4.6, 2.35, 2.6], look: [-3.0, 0.4, -1.4], fov: 60, zone: [-5.2, -3.2, 0.0, 3.2] });
    r.shot({ id: 'east', pos: [-4.0, 2.35, 2.6], look: [3.4, 0.4, -0.8], fov: 60, zone: [0.0, -3.2, 5.6, 3.2] });
  },

  setup(r, g) {
    if (g.flags.flameDrowned) {
      // the sea coming up the tunnel glows, a little: enough to run by
      if (!r.tideLit) {
        r.tideLit = true;
        r.dark = false;
        r.point(4.6, 0.6, 0.2, { color: 0x3a9a70, intensity: 14, distance: 10, flicker: 0.25, speed: 1.5 });
        r.point(-2.0, 2.0, 0.0, { color: 0x4a7a6a, intensity: 4, distance: 9 });
      }
      return;
    }
    if (!g.flags.lampLit) {
      g.task(async () => {
        await g.say('真っ暗で何も見えない……！\n灯りがなければ、とても進めない。');
        g.goTo('hall', 'fromCellar');
      });
    }
  },

  async enter(r, g) {
    if (g.flags.cellarSeen || !g.flags.lampLit) return;
    g.flags.cellarSeen = true;
    await g.say('ランプの灯りが、湿った石壁を照らし出す。\n闇の奥で、何かがカサカサと這い回る音がした。');
  },
};
