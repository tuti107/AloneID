// 船長室 — the Black Gull's great cabin, heeled over and half full of the
// sea. Captain Ezekiel Ashcombe is still at his stern windows, a hundred and
// twenty years on, with the other star stone where his heart was.
import * as THREE from 'three';
import * as F from '../furniture.js';
import { M, C } from '../mats.js';

const H = 2.6;

export default {
  id: 'gullcabin',
  name: '黒鴎号 船長室',
  bounds: [-4.2, -3.2, 4.2, 3.2],
  floorType: 'wood',
  ambience: 'cabin',
  build(r, g) {
    r.shell(-4, -3, 4, 3, {
      h: H, floor: 'woodFloorDark', ceil: 'woodBlack', mat: 'wainscot', baseboard: false, crown: 'woodBlack',
      openings: {
        n: [{ at: -2.2, w: 0.9, h: 0.9, sill: 1.0 }, { at: 0, w: 0.9, h: 0.9, sill: 1.0 }, { at: 2.2, w: 0.9, h: 0.9, sill: 1.0 }],
        e: [{ at: 0, w: 0.9, h: 2.0 }],
      },
    });
    // beams overhead, and the stern windows on the sea
    for (let i = 0; i < 5; i++) r.box('woodBlack', 7.96, 0.16, 0.18, 0, H - 0.16, -2.4 + i * 1.2, { cast: false });
    for (const x of [-2.2, 0, 2.2]) r.window(x, -3, 0, { w: 0.9, h: 0.9, sill: 1.0, panes: true, intensity: 16, beam: false });
    r.door(4, 0, -Math.PI / 2, { to: 'tidecave', entry: 'fromCabin', w: 0.9, h: 2.0, label: '甲板への扉', wallMat: 'wainscot', panel: 'woodBlack', sound: 'doorHeavy' });
    r.entry('fromDeck', 3.35, 0, -Math.PI / 2);

    // ---- the sea, in over the low side
    const water = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.2), new THREE.MeshPhongMaterial({ color: 0x06141a, specular: 0x6a8a90, shininess: 120, transparent: true, opacity: 0.8, depthWrite: false }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.03, 1.9);
    r.dynamic.add(water);
    r.updaters.push((dt, t) => { water.position.y = 0.03 + Math.sin(t * 0.9) * 0.01; water.position.z = 1.9 + Math.sin(t * 0.6) * 0.06; });
    r.waterAt = (x, z) => z > 0.9;

    // ---- his cabin as he left it
    r.place(F.table({ w: 1.6, d: 0.95, h: 0.78, wood: 'woodBlack', legs: 'square' }), -1.0, -0.4, 0.06, { collide: true });
    for (const [x, z, ry] of [[-1.3, -0.5, 0.3], [-0.6, -0.3, -0.4]]) r.box(M('paper', { color: 0xc8b890 }), 0.5, 0.004, 0.36, x, 0.781, z, { ry, cast: false });
    r.box('brass', 0.08, 0.16, 0.08, -0.4, 0.78, -0.65);
    r.place(F.chair({ wood: 'woodBlack', seat: 'leather' }), -1.0, -1.25, Math.PI, { collide: [0.5, 0.5] });
    r.box('woodBlack', 2.0, 0.6, 0.8, 2.6, 0, -2.5, { collide: true });
    r.box(M('linen', { color: 0x6a6458 }), 1.9, 0.1, 0.7, 2.6, 0.6, -2.5);
    r.place(F.trunk({ w: 0.9, h: 0.5, d: 0.5 }), -3.4, 1.7, Math.PI / 2, { collide: true });
    r.place(F.barrel(), 3.4, 2.3, 0, { collide: true });
    r.interact({ id: 'charts', x: -1.0, z: 0.35, r: 0.5, label: '海図', use: (gg) => gg.say('海図の上に、南洋の島がひとつ、赤く丸で囲まれている。\n島の名は、インクが滲んで読めない。\n傍らに、「ウル＝タガ」と三度書き殴ってある。') });
    // a lamp that swings with a ship that no longer moves
    const lamp = F.oilLamp();
    const lampG = new THREE.Group();
    lampG.position.set(1.6, H - 0.3, -1.2);
    lamp.position.set(0, -0.35, 0);
    lampG.add(lamp);
    r.dynamic.add(lampG);
    const fl = r.flame(0, -0.15, 0, { size: 0.05, intensity: 10, distance: 10, parent: lampG });
    void fl;
    r.updaters.push((dt, t) => { lampG.rotation.z = Math.sin(t * 0.9) * 0.18; lampG.rotation.x = Math.sin(t * 0.7) * 0.08; });

    r.hemi(0x5a6a80, 0x2a2018, 4.8);
    r.point(-2.0, 2.0, -2.2, { color: 0x5a7aa0, intensity: 9, distance: 8 });
    r.point(2.2, 2.0, -2.2, { color: 0x5a7aa0, intensity: 7, distance: 7 });

    // ---- the captain
    const m = g.spawn(r, {
      id: 'ezekiel', type: 'ezekiel', x: -2.2, z: -2.0, rot: Math.PI, dormant: !g.flags.ezekielWoke,
      onHalf: (mm) => crewRises(r, g, mm),
      onDeath: (mm) => {
        g.flags['dead:ezekiel'] = true;
        g.flags.ezekielAt = [+mm.pos.x.toFixed(2), +mm.pos.z.toFixed(2)];
        g.audio.music(null);
        g.run(() => captainFalls(r, g));
      },
    });
    void m;
    if (g.flags['dead:ezekiel']) { dropStar(r, g); placeLog(r, g); }

    r.shot({ id: 'door', pos: [3.6, 2.35, 2.5], look: [-1.8, 0.8, -1.4], fov: 62, zone: [0.0, -3.2, 4.2, 3.2] });
    r.shot({ id: 'stern', pos: [-3.6, 2.35, 2.5], look: [1.6, 0.8, -1.4], fov: 62, zone: [-4.2, -3.2, 0.0, 3.2] });
  },

  setup(r, g) {
    if (g.flags.ezekielWoke && !g.flags['dead:ezekiel']) g.audio.music('boss');
  },

  leave(r, g) {
    if (!g.flags['dead:ezekiel']) g.audio.music(null);
  },

  async enter(r, g) {
    if (g.flags.ezekielWoke) return;
    g.flags.ezekielWoke = true;
    const m = r.monsters.find((x) => x.id === 'ezekiel');
    g.lock();
    g.cut({ pos: [1.8, 1.6, 1.2], look: [-2.2, 1.4, -2.0], fov: 46 });
    await g.wait(1.0);
    await g.say('船尾の窓辺に、ずぶ濡れの大きな背中があった。\n色褪せた船長服。三角帽から、海藻が垂れている。');
    g.audio.sfx('ezekielNotice', { at: m.pos });
    m.turnTo(g.player.pos);
    g.cut({ pos: [-0.6, 1.5, -0.6], look: [-2.2, 1.6, -2.0], fov: 40 });
    await g.wait(1.2);
    await g.say('「……ジョナか？　いや、違うな」\n\n「だが、わしの血の匂いがする。\nあれへの供物を、もうひとつ連れてきてくれたか」');
    await g.say('男の胸の奥で、青い星が脈打った。\n――エゼキエル・アシュコム船長。');
    g.cut(null);
    g.unlock();
    m.wake();
    g.audio.music('boss');
  },
};

// At half his strength he calls one of his crew up out of the sea in the
// cabin's low side.
function crewRises(r, g, m) {
  g.audio.sfx('ezekielNotice', { at: m.pos });
  g.notify('「起きろ……野郎ども！」', 2.5);
  const t = g.spawn(r, { id: 'gullCrew', type: 'thrall', seed: 41, x: -0.8, z: 2.3, rot: Math.PI });
  t.bury();
  t.emerge();
}

function placeLog(r, g) {
  if (g.flags['taken:gullLog'] || r.logPlaced) return;
  r.logPlaced = true;
  r.pickup('gullLog', -0.5, 0.79, -0.15, { label: '航海日誌', ry: 0.4, onTake: async (gg) => { const c = await gg.ask('読みますか？', ['読む', 'あとで']); if (c === 0) await gg.readDoc('gullLog'); } });
}

function dropStar(r, g) {
  if (g.flags['taken:seastar']) return;
  const [x, z] = g.flags.ezekielAt || [-1.6, -1.4];
  r.pickup('seastar', x + 0.3, 0.03, z, { label: '青く光る石', r: 0.45 });
}

async function captainFalls(r, g) {
  g.lock();
  await g.wait(1.6);
  await g.say('船長は膝をつき、ゆっくりと崩れ落ちた。\n「……星を……揃えるつもりか、小僧……」\n\n胸から、青く光る石が転がり出た。');
  dropStar(r, g);
  placeLog(r, g);
  g.unlock();
}
