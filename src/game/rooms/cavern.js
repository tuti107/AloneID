// 地下洞窟 — the sea cave beneath the house, where the idol waits.
import * as THREE from 'three';
import * as F from '../furniture.js';
import { M, C, spriteMat } from '../mats.js';
import { rockGeo, uvPlane } from '../../engine/geom.js';
import { Horror } from '../boss.js';
import { starStoneModel } from '../items.js';
import { rng } from '../../engine/util.js';

// The flood after the fire: seconds to get out, and how far the water has
// come (0 to 1) by now.
export const FLOOD_TIME = 75;
export function floodLevel(g) {
  if (!g.flags.flameDrowned) return 0;
  if (!g.escape) return 1;
  return Math.min(1, Math.max(0, 1 - g.escape.t / (g.escape.total || FLOOD_TIME)));
}

export default {
  id: 'cavern',
  name: '地下洞窟',
  bounds: [-7.6, -6.6, 7.2, 5.2],
  floorType: 'rock',
  ambience: 'cave',
  dark: true,
  silentThunder: true,
  build(r, g) {
    r.scene.fog = new THREE.FogExp2(0x061008, 0.035);
    const R = rng(77);
    // floor and pool
    const floor = new THREE.Mesh(uvPlane(15, 7.2, [3, 3]), M('rockWet', { flat: true }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(-0.2, 0, 1.6);
    floor.receiveShadow = true;
    r.static.add(floor);
    r.floorZones.push({ r: [-7.6, -2, 7.2, 5.2], type: 'rock' });
    const bed = new THREE.Mesh(uvPlane(15, 5, [3, 3]), M('rock'));
    bed.rotation.x = -Math.PI / 2;
    bed.position.set(0, -1.2, -4.3);
    r.static.add(bed);
    const waterGeo = new THREE.PlaneGeometry(15, 5, 24, 10);
    const water = new THREE.Mesh(waterGeo, new THREE.MeshPhongMaterial({ color: 0x020504, specular: 0x557766, shininess: 90, flatShading: true }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.28, -4.3);
    water.receiveShadow = true;
    r.dynamic.add(water);
    const wp = waterGeo.attributes.position;
    const base = Float32Array.from(wp.array);
    r.updaters.push((dt, t) => {
      for (let i = 0; i < wp.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1];
        wp.setZ(i, Math.sin(x * 1.3 + t * 1.1) * 0.04 + Math.cos(y * 1.7 + t * 0.8) * 0.04 + (r.boil || 0) * Math.sin(x * 4 + t * 9) * 0.08);
      }
      wp.needsUpdate = true;
      waterGeo.computeVertexNormals();
    });
    // the flood: the pool brims over and fills the cave
    const flood = new THREE.Mesh(new THREE.PlaneGeometry(15.4, 12.4), new THREE.MeshPhongMaterial({ color: 0x041410, specular: 0x7a9a90, shininess: 110, transparent: true, opacity: 0.82, depthWrite: false }));
    flood.rotation.x = -Math.PI / 2;
    flood.position.set(-0.2, -0.3, -0.7);
    flood.receiveShadow = true;
    r.dynamic.add(flood);
    r.flood = flood;
    r.updaters.push((dt, t) => {
      const k = floodLevel(g);
      flood.visible = k > 0;
      flood.position.y = -0.06 + k * 1.0 + Math.sin(t * 0.9) * 0.015;
      r.floodY = flood.position.y;
      if (k > 0) water.position.y = Math.max(-0.28, flood.position.y - 0.03);
    });
    r.waterAt = () => (r.floodY || -1) > 0.01;
    r.wade = () => 1 - 0.45 * Math.min(1, Math.max(0, ((r.floodY || 0) - 0.2) / 0.6));
    // rim of rocks along the pool edge
    for (let x = -6.8; x <= 6.8; x += 1.1) {
      if (Math.abs(x) < 1.2) continue;
      const rk = new THREE.Mesh(rockGeo(0.55 + R() * 0.35, Math.floor(R() * 99), 1, [1.3, 0.55, 1]), M('rockWet', { flat: true }));
      rk.position.set(x, 0.0, -2.15 + (R() - 0.5) * 0.3);
      rk.rotation.y = R() * 6;
      r.static.add(rk);
    }
    r.collider(-3.9, -2.2, 3.1, 0.3);
    r.collider(3.9, -2.2, 3.1, 0.3);
    r.collider(0, -2.4, 1.0, 0.25);
    // cave walls: heaps of rock around the perimeter
    const wall = (x, z, s, sq = [1, 1.4, 1]) => {
      const rk = new THREE.Mesh(rockGeo(s, Math.floor(R() * 999), 1, sq), M(R() < 0.5 ? 'rock' : 'rockWet', { flat: true }));
      rk.position.set(x, s * 0.6, z);
      rk.rotation.y = R() * 6;
      rk.castShadow = true;
      rk.receiveShadow = true;
      r.static.add(rk);
    };
    for (let x = -7.2; x <= 7; x += 1.5) { wall(x, 5.6 + R() * 0.4, 1.4 + R() * 0.5); wall(x + 0.7, -7.0 - R() * 0.4, 1.8 + R() * 0.6, [1, 1.8, 1]); }
    for (let z = -6.5; z <= 5.5; z += 1.5) { wall(7.6 + R() * 0.4, z, 1.5 + R() * 0.5); if (z < 0 || z > 2.2) wall(-8.0 - R() * 0.3, z, 1.5 + R() * 0.5); }
    r.collider(0, 5.1, 8, 0.4);
    r.collider(7.2, 0, 0.4, 7);
    r.collider(-7.6, -3.0, 0.4, 3.0);
    r.collider(-7.6, 4.0, 0.4, 1.4);
    r.collider(-7.4, 0, 0.3, 0.3);
    // ceiling with stalactites
    const ceil = new THREE.Mesh(uvPlane(16, 13, [3, 3]), M('rock'));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 5.2, -0.7);
    r.static.add(ceil);
    for (let i = 0; i < 26; i++) {
      const st = F.stalactite(0.6 + R() * 1.6, 0.12 + R() * 0.2, R() * 6, R() < 0.5 ? 'rock' : 'rockWet');
      st.position.set(-7 + R() * 14, 5.2, -6 + R() * 10.5);
      r.static.add(st);
    }
    for (let i = 0; i < 8; i++) {
      const sg = new THREE.Mesh(new THREE.ConeGeometry(0.12 + R() * 0.12, 0.4 + R() * 0.7, 5), M('rockWet', { flat: true }));
      sg.position.set(-6 + R() * 12, 0.2, 2.5 + R() * 2.2);
      r.static.add(sg);
    }
    // tunnel back to the cellar
    r.box('#020202', 0.2, 2.0, 1.5, -7.75, 0, 1.0, { cast: false });
    r.trigger({ box: [-7.6, 0.25, -7.0, 1.75], enter: (gg) => gg.goTo('cellar', 'fromCavern', { fadeOut: 0.5 }) });
    r.entry('fromCellar', -6.4, 1.0, Math.PI / 2);

    // glowing fungus
    const fr = rng(5);
    for (let i = 0; i < 30; i++) {
      const sp = new THREE.Sprite(spriteMat('glow', 0x60ff90, 0.6));
      const s = 0.1 + fr() * 0.2;
      sp.scale.set(s, s, 1);
      const side = fr();
      if (side < 0.33) sp.position.set(-6.9 + fr() * 0.4, 0.2 + fr() * 2.5, -5 + fr() * 9.5);
      else if (side < 0.66) sp.position.set(6.8 + fr() * 0.4, 0.2 + fr() * 2.5, -5 + fr() * 9.5);
      else sp.position.set(-6 + fr() * 12, 0.2 + fr() * 2.2, 4.8 + fr() * 0.3);
      r.dynamic.add(sp);
    }
    r.point(-6.6, 1.2, -1.5, { color: 0x40ff80, intensity: 2.5, distance: 6, flicker: 0.2, speed: 1 });
    r.point(6.6, 1.2, 1.5, { color: 0x40ff80, intensity: 2.5, distance: 6, flicker: 0.2, speed: 1 });
    r.point(0, 1.5, 4.6, { color: 0x40ff80, intensity: 1.8, distance: 6, flicker: 0.2, speed: 1 });
    r.hemi(0x2a5a3a, 0x081008, 1.5);
    r.point(0, 3.5, -4.5, { color: 0x50c080, intensity: 8, distance: 12, flicker: 0.15, speed: 0.7 });
    r.point(-4.5, 2.5, 3.5, { color: 0x40a070, intensity: 4, distance: 8 });
    r.point(4.5, 2.5, 3.5, { color: 0x40a070, intensity: 4, distance: 8 });

    // altar and idol
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.1, 0.12, 9), M('runes', { flat: true }));
    dais.position.set(0, 0.06, -1.3);
    dais.receiveShadow = true;
    r.static.add(dais);
    const alt = F.altar();
    r.place(alt, 0, -1.75, 0, { collide: [1.6, 0.9] });
    const idol = F.idol();
    r.place(idol, 0, -1.8, 0, { y: 0.97, dyn: true });
    r.idol = idol;
    for (const [x, z] of [[-1.2, -0.9], [1.2, -0.9], [-0.9, -2.15], [0.9, -2.15], [-1.5, -1.7], [1.5, -1.7]]) {
      r.place(F.candle({ h: 0.25, r: 0.035 }), x, z, 0, { cast: false });
      r.flame(x, 0.26, z, { size: 0.08, color: 0x9fffb0, glow: 0x40ff80, lightColor: 0x60ff90, light: x > 0 && z > -1, intensity: 3, distance: 6 });
    }
    r.idolLight = r.point(0, 1.9, -1.4, { color: 0x60ff90, intensity: 3, distance: 5, flicker: 0.5, speed: 2 });
    // Ezekiel's note on a post
    r.box('woodBlack', 0.12, 1.5, 0.12, 2.2, 0, -1.2);
    r.box(M('paper', { ts: [0.25, 0.3] }), 0.25, 0.3, 0.01, 2.2, 1.0, -1.13);
    r.interact({ id: 'note', x: 2.2, z: -0.65, r: 0.45, label: '古い羊皮紙', use: (gg) => gg.readDoc('ezekiel') });
    r.place(F.bones(), -2.6, -1.0, 0.7);
    r.place(F.bones(), 3.4, 0.8, 2.1);
    r.place(F.bones(), -4.2, 2.8, 4.0);
    r.interact({ id: 'bones', x: -2.6, z: -0.6, r: 0.4, label: '人骨', use: (gg) => gg.say('朽ちた人骨。服の切れ端に、アシュコム家の紋章の刺繍が残っている。') });

    r.interact({
      id: 'altar', x: 0, z: -0.95, r: 0.5, label: '祭壇',
      use: async (gg) => {
        if (gg.flags.altarSealed) { await gg.say('星の石が、祭壇の窪みで淡く光っている。'); return; }
        await gg.say('黒い石の祭壇。偶像の足元に、星形の窪みが穿たれている。');
        if (gg.has('starstone')) {
          const c = await gg.ask('星の石を嵌め込みますか？', ['嵌める', 'やめる']);
          if (c === 0) await seal(r, gg);
        } else await gg.say('……何かを嵌め込むためのものらしい。');
      },
      item: async (gg, id) => {
        if (id !== 'starstone') return false;
        if (!gg.flags.altarSealed) await seal(r, gg);
        return true;
      },
    });
    if (g.flags.altarSealed) showStone(r);

    r.horror = new Horror(g, r, { x: 0, z: -4.9, edge: -2.25 });
    r.boss = r.horror;
    r.updaters.push((dt) => r.horror.update(dt));
    if (g.flags.flameDrowned) {
      r.horror.state = 'gone';
    } else if (g.flags.horrorRisen) {
      r.horror.rise(true);
      if (g.flags.altarSealed) r.horror.seal();
    }

    r.trigger({
      box: [-3.8, -2.5, 6, 2.6],
      when: (gg) => !gg.flags.horrorRisen,
      enter: (gg) => rise(r, gg),
    });

    r.shot({ id: 'main', pos: [5.6, 4.1, 4.4], look: [-1.0, 0.2, -2.2], fov: 58, zone: [-3.4, -6.6, 7.2, 5.2] });
    r.shot({ id: 'tunnel', pos: [-1.2, 2.7, 4.4], look: [-6.6, 0.6, 0.6], fov: 58, zone: [-7.6, -6.6, -3.4, 5.2] });
  },

  async enter(r, g) {
    if (g.flags.cavernSeen) return;
    g.flags.cavernSeen = true;
    g.lock();
    g.cut({ pos: [-5.2, 2.2, 3.2], look: [0, 0.8, -2.0], fov: 52 });
    await g.wait(1.2);
    await g.say('地の底に、巨大な洞窟が口を開けていた。\n黒い水を湛えた淵のほとりに、石の祭壇……。');
    await g.say('祭壇の上の偶像が、こちらを見ている。\n……そんな気がした。');
    g.cut(null);
    g.unlock();
  },

  async onThrowLamp(r, g) {
    if (!g.flags.horrorRisen) { await g.say('いや……この灯りを失うわけにはいかない。'); return; }
    if (!g.flags.altarSealed) { await g.say('……まだだ。\n今これを投げても、あの怪物には届かない気がする。'); return; }
    await burn(r, g);
  },

  setup(r, g) {
    if (g.flags.horrorRisen && !g.flags.flameDrowned) g.audio.music('boss');
    if (g.flags.flameDrowned && g.escape) escapeLights(r);
  },
};

// Running from the flood with no lamp: the risen tide glows, light spills
// down the tunnel he came by, and the murk thins, so the way out shows.
function escapeLights(r) {
  if (r.escapeLit) return;
  r.escapeLit = true;
  if (r.scene.fog) r.scene.fog.density = 0.016;
  if (r.hemiLight) {
    r.hemiLight.color.set(0x3a7a6a);
    r.hemiLight.groundColor.set(0x0a1612);
    r.hemiBase = 3.0;
  }
  r.flood.material.emissive = new THREE.Color(0x0a2a22);
  r.point(-7.0, 1.6, 1.0, { color: 0xffb070, intensity: 12, distance: 11, flicker: 0.12, speed: 3 });
  r.point(-3.6, 1.6, 1.6, { color: 0x4ab090, intensity: 7, distance: 9 });
  r.point(2.0, 1.8, 2.6, { color: 0x4ab090, intensity: 5, distance: 9 });
  const glow = new THREE.Sprite(spriteMat('glow', 0xffa860, 0.6));
  glow.scale.set(2.0, 2.0, 1);
  glow.position.set(-7.4, 1.0, 1.0);
  r.dynamic.add(glow);
}

function showStone(r) {
  const st = starStoneModel();
  st.position.set(0, 0.99, -1.35);
  st.rotation.x = -Math.PI / 2;
  st.scale.setScalar(0.9);
  r.dynamic.add(st);
  r.idol.userData.eye.material = r.idol.userData.eye.material.clone();
  r.idol.userData.eye.material.color.set(0x101010);
  if (r.idolLight) r.idolLight.userData.off = true;
}

async function rise(r, g) {
  if (g.flags.horrorRisen) return;
  g.flags.horrorRisen = true;
  g.lock();
  g.cut({ pos: [3.4, 1.3, 2.4], look: [0, 1.6, -3.6], fov: 52 });
  g.audio.sfx('bubble');
  r.boil = 1;
  g.shake(0.06, 1.5);
  await g.wait(1.6);
  r.horror.rise();
  g.audio.sfx('roar');
  g.shake(0.15, 1.2);
  await g.wait(2.6);
  r.boil = 0.3;
  await g.say('黒い淵の水面が盛り上がり――\nぬらりと光る巨大な肉塊が、姿を現した！');
  await g.say('無数の眼が、一斉にこちらを向いた。');
  g.cut(null);
  g.audio.music('boss');
  g.unlock();
}

async function seal(r, g) {
  g.lock();
  await g.reachAnim();
  g.inv.remove('starstone');
  g.flags.altarSealed = true;
  showStone(r);
  g.audio.sfx('seal');
  g.flash(0.7, [0.6, 1.0, 0.7]);
  g.shake(0.1, 0.8);
  if (r.horror.state !== 'hidden') {
    r.horror.seal();
    g.audio.sfx('roar');
    g.cut({ pos: [2.8, 1.2, 1.6], look: [0, 2.0, -4.0], fov: 55 });
    await g.wait(1.2);
  }
  await g.say('星の石を、祭壇の窪みに嵌め込んだ。\n偶像の目から、緑の光がふっと消える――');
  if (r.horror.state !== 'hidden') await g.say('怪物が身をよじり、苦悶の絶叫を上げた！\n……今なら、炎が届く。');
  g.cut(null);
  g.unlock();
}

function burnAltar(r) {
  const fire = r.altarFire = { sprites: [], light: null };
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Sprite(spriteMat('flame', 0xffffff, 0.9));
    const s = 0.5 + Math.random() * 0.5;
    f.scale.set(s * 0.6, s, 1);
    f.position.set((Math.random() - 0.5) * 1.2, 1.2 + Math.random() * 0.4, -1.75 + (Math.random() - 0.5) * 0.5);
    r.dynamic.add(f);
    fire.sprites.push(f);
  }
  fire.light = r.point(0, 1.8, -1.6, { color: 0xff7a2a, intensity: 22, distance: 12, flicker: 0.3 });
}

// The tide puts the fire out, on the altar and on the thing itself.
function douse(r, g) {
  g.audio.sfx('hiss');
  g.audio.sfx('splash');
  // it breaks over everything: a moment of black water
  g.gfx.u.uFade.value = 0.85;
  g.fade(0, 0.8);
  g.shake(0.16, 0.8);
  g.burst('splash', 0, 1.3, -2.1, { n: 34, speed: 3.2, up: 3.4 });
  g.burst('steam', 0, 1.1, -1.9, { n: 18 });
  g.burst('steam', 0, 2.4, -4.4, { n: 24, size: 0.9 });
  const fire = r.altarFire;
  if (fire) {
    for (const f of fire.sprites) r.dynamic.remove(f);
    fire.light.userData.off = true;
    r.altarFire = null;
  }
  r.horror.drown();
  // the wave knocks him back a step
  const p = g.player;
  p.playClip('hit', { fade: 0.05 });
  p.knock.set(0, 2.2);
}

// A black wave heaves up out of the pool, rolls over the burning thing and
// the altar, and falls back. Resolves when it has gone.
function wave(r, g) {
  const geo = new THREE.PlaneGeometry(11, 5.6, 24, 16);
  const pos = geo.attributes.position;
  const base = Float32Array.from(pos.array);
  // near black water, so the cave's green light hardly touches it, under a
  // pale crest of foam that catches the fire
  const cols = new Float32Array(pos.count * 3);
  const dark = new THREE.Color(0x050e0b), foam = new THREE.Color(0x7a948c);
  for (let i = 0; i < pos.count; i++) {
    const v = (base[i * 3 + 1] + 2.8) / 5.6;
    const c = dark.clone().lerp(foam, Math.min(1, Math.max(0, (v - 0.86) / 0.12)));
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  m.position.set(0, -0.6, -5.6);
  r.dynamic.add(m);
  let t = 0, doused = false, spray = 0;
  return new Promise((res) => {
    const upd = (dt, time) => {
      t += dt;
      // up out of the pool (0-0.9 s), rolling forward to break over the
      // altar (0.7-1.7 s), then falling back into the pool (to 2.6 s)
      const rise = Math.min(1, t / 0.9);
      const roll = Math.min(1, Math.max(0, (t - 0.7) / 1.0));
      const fall = Math.min(1, Math.max(0, (t - 1.7) / 0.9));
      const H = 5.6 * (0.25 + 0.75 * rise) * (1 - fall * 0.85);
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3], v = (base[i * 3 + 1] + 2.8) / 5.6;
        const ripple = Math.sin(x * 1.7 + time * 4) * 0.14 + Math.sin(x * 3.1 - time * 6) * 0.07;
        // the crest leans further forward, curling, as it rolls
        pos.setXYZ(i, x * (1 - 0.08 * v), v * H + ripple * v, (0.4 + roll * 2.8) * v * v * v + ripple * 0.5);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      m.position.z = -5.6 + roll * 2.6;
      m.position.y = -0.6 - fall * 1.8;
      // spray off the crest as it comes over
      spray -= dt;
      if (rise > 0.5 && fall < 0.5 && spray <= 0) {
        spray = 0.07;
        const x = (Math.random() - 0.5) * 9;
        g.burst('foam', x, m.position.y + H * 0.97, m.position.z + (0.4 + roll * 2.8) * 0.94, { n: 5 });
      }
      if (!doused && t > 1.35) { doused = true; douse(r, g); }
      if (t > 2.6) {
        r.updaters.splice(r.updaters.indexOf(upd), 1);
        r.dynamic.remove(m);
        geo.dispose();
        res();
      }
    };
    r.updaters.push(upd);
  });
}

async function burn(r, g) {
  g.lock();
  const p = g.player;
  const target = new THREE.Vector3(0, 1.4, -1.9);
  p.rot = Math.atan2(target.x - p.pos.x, target.z - p.pos.z);
  let thrown = false;
  const fly = { obj: null };
  await p.playClip('throw', {
    onEvent: (e) => {
      if (e !== 'release' || thrown) return;
      thrown = true;
      const start = new THREE.Vector3();
      p.lamp.getWorldPosition(start);
      g.inv.remove('lamp');
      g.flags.lampLit = false;
      g.flags.lampThrown = true;
      p.refreshHeld();
      const lamp = F.oilLamp();
      lamp.position.copy(start);
      const fl = new THREE.PointLight(0xffa860, 8, 8, 2);
      lamp.add(fl);
      r.dynamic.add(lamp);
      fly.obj = lamp;
      fly.start = start;
      fly.t = 0;
      r.updaters.push(fly.fn = (dt) => {
        fly.t = Math.min(1, fly.t + dt / 0.7);
        const k = fly.t;
        lamp.position.lerpVectors(fly.start, target, k);
        lamp.position.y += Math.sin(k * Math.PI) * 1.4;
        lamp.rotation.x += dt * 9;
      });
    },
  });
  await g.wait(0.6);
  if (fly.obj) { r.dynamic.remove(fly.obj); r.updaters = r.updaters.filter((u) => u !== fly.fn); }
  g.audio.sfx('fireBurst');
  g.burst('ember', 0, 1.4, -1.9, { n: 30, speed: 2.5 });
  g.flash(1, [1.0, 0.6, 0.2]);
  g.shake(0.2, 1.0);
  burnAltar(r);
  r.horror.ignite();
  g.audio.sfx('roar');
  g.cut({ pos: [3.6, 1.6, 2.8], look: [0, 1.6, -3.0], fov: 55 });
  await g.wait(2.0);
  await g.say('砕けたランプの油に火が走り、\n炎が偶像と怪物を呑み込んだ――！');
  g.audio.sfx('roar');
  await g.wait(1.4);
  // ...and the sea answers it
  r.boil = 1;
  g.audio.music(null);
  g.audio.sfx('surge');
  g.shake(0.1, 2.4);
  g.cut({ pos: [4.6, 1.9, 3.9], look: [0, 2.3, -3.6], fov: 64 });
  await wave(r, g);
  g.flags.flameDrowned = true;
  g.flags.lampLit = false;
  r.boil = 0.5;
  await g.wait(0.8);
  await g.say('――淵の底から黒い潮がうねり上がり、\n炎を、一瞬で呑み込んだ。');
  // it sinks back, scorched but alive, every eye on him to the last
  g.cut({ pos: [-2.6, 1.3, -0.2], look: [0.3, 0.2, -4.9], fov: 50 });
  g.audio.sfx('roar', { rate: 0.6 });
  await g.wait(2.6);
  await g.say('怪物は燃え尽きたのではない。\n無数の眼でこちらを見据えたまま、\n潮の底へ、ゆっくりと帰っていく……。');
  g.cut(null);
  await g.wait(0.4);
  await g.say('……この火では、足りないのか。');
  g.audio.sfx('rumble');
  g.shake(0.18, 2.5);
  r.boil = 0.8;
  await g.wait(1.0);
  await g.say('淵の水があふれ出した！\nこのままでは、洞窟ごと潮に沈む――！');
  // show him the way out before he runs for it
  escapeLights(r);
  g.cut({ pos: [-3.0, 2.1, 3.9], look: [-7.4, 0.8, 1.0], fov: 50 });
  await g.wait(0.6);
  await g.say('来た道を戻れ――\n西の隧道から地下室へ。北西の階段を上って、館の上へ！');
  g.cut(null);
  g.escape = { t: FLOOD_TIME, total: FLOOD_TIME };
  g.audio.music('escape');
  g.unlock();
}
