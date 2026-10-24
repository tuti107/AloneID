// 浴室 — black water in the tub, and a message in the mirror.
import * as THREE from 'three';
import * as F from '../furniture.js';
import { M, C } from '../mats.js';
import { frustum } from '../../engine/geom.js';

export default {
  id: 'bathroom',
  name: '浴室',
  bounds: [-2.2, -1.95, 2.2, 1.95],
  floorType: 'tile',
  ambience: 'drip',
  build(r, g) {
    const H = 3.0;
    r.shell(-2, -1.75, 2, 1.75, {
      h: H, floor: 'bathFloor', ceil: 'plaster', mat: 'wallpaperRose', wainscot: 'tileWhite', wainscotH: 1.45, trim: 'woodLight', crown: 'woodLight',
      openings: { s: [{ at: -1.0, w: 0.9, h: 2.1 }], n: [{ at: 0.35, w: 0.8, h: 0.75, sill: 1.65 }] },
    });
    r.door(-1.0, 1.75, Math.PI, { w: 0.9, h: 2.1, to: 'corridor', entry: 'fromBathroom', label: '廊下への扉', panel: 'woodLight', frame: 'woodLight', wallMat: 'wallpaperRose' });
    r.entry('fromCorridor', -1.0, 1.15, Math.PI);
    r.window(0.35, -1.75, 0, { w: 0.8, h: 0.75, sill: 1.65, frame: 'woodLight', wallMat: 'wallpaperRose', intensity: 35, angle: 0.6, shadow: 'lo' });

    const tub = F.bathtub();
    r.place(tub, 0.35, -1.3, 0, { collide: true });
    r.tub = tub;
    // a drowned hand, hidden under the water
    const hand = new THREE.Group();
    const skin = C(0x8a9a88);
    const arm = new THREE.Mesh(frustum(0.07, 0.07, 0.06, 0.06, 0.45), skin);
    hand.add(arm);
    for (let i = -1.5; i <= 1.5; i++) {
      const f = new THREE.Mesh(frustum(0.016, 0.016, 0.012, 0.012, 0.1), skin);
      f.position.set(i * 0.018, 0.45, 0);
      f.rotation.z = i * 0.15;
      hand.add(f);
    }
    hand.position.set(0.55, 0.0, -1.25);
    hand.visible = false;
    r.dynamic.add(hand);
    r.hand = hand;

    r.place(F.toilet(), -1.55, -1.38, 0, { collide: true });
    r.place(F.sink(), 1.72, 0.25, -Math.PI / 2, { collide: true });
    const mir = F.wallMirror({ w: 0.55, h: 0.75 });
    mir.position.set(1.98, 1.6, 0.25);
    mir.rotation.y = -Math.PI / 2;
    r.dynamic.add(mir);
    r.mirror = mir.userData.mirror;
    if (g.flags.mirrorSeen) r.mirror.material = M('mirrorIII', { phong: true, shininess: 100, specular: 0x99aabb });
    const cab = F.cabinet({ w: 0.5, h: 0.6, d: 0.18 });
    cab.position.set(-1.9, 1.3, 0.55);
    cab.rotation.y = Math.PI / 2;
    r.static.add(cab);
    const shelfC = F.candle({ h: 0.12 });
    r.place(shelfC, 1.85, -0.35, 0, { y: 1.15, cast: false });
    r.box('woodLight', 0.2, 0.03, 0.3, 1.9, 1.12, -0.35);
    r.flame(1.85, 1.15 + 0.13, -0.35, { size: 0.06, intensity: 2.6, distance: 5 });
    r.box('brass', 0.6, 0.03, 0.03, -1.95, 1.1, -0.6, { ry: Math.PI / 2 });
    r.box('linen', 0.04, 0.5, 0.45, -1.93, 0.65, -0.6);
    F.cobweb(r, 1.95, H, -1.7, -Math.PI / 2, 0.6);
    r.decal('blood', 0.9, -0.55, 0.5, 0.5, 0.4, 0.004);

    r.interact({
      id: 'tub', x: 0.35, z: -0.75, r: 0.6, label: 'バスタブ',
      use: async (gg) => {
        if (gg.flags.tubDone) { await gg.say('黒く濁った水が、まだゆらゆらと揺れている。'); return; }
        await gg.say('黒く濁った水が張られている。\n底のほうで、何かが鈍く光った……。');
        const c = await gg.ask('水の中に手を入れますか？', ['入れる', 'やめる']);
        if (c !== 0) return;
        await tubScare(r, gg);
      },
    });
    r.interact({
      id: 'mirror', x: 1.5, z: 0.25, r: 0.4, label: '鏡',
      use: async (gg) => {
        if (gg.flags.mirrorSeen) { await gg.say('曇った鏡に、まだ『III』の文字が残っている。\n……さっきの顔は、気のせいだったのだろうか。'); return; }
        await mirrorScare(r, gg);
      },
    });
    r.interact({
      id: 'cabinet', x: -1.6, z: 0.55, r: 0.4, label: '薬棚',
      use: async (gg) => {
        if (gg.flags.cabinetDone) { await gg.say('薬棚には、空の瓶がいくつか転がっているだけだ。'); return; }
        await gg.reachAnim();
        gg.flags.cabinetDone = true;
        await gg.say('薬棚の奥に、未開封の薬瓶があった。');
        await gg.give('tonic');
      },
    });
    r.interact({ id: 'toilet', x: -1.55, z: -0.9, r: 0.4, label: '便器', use: (gg) => gg.say('鎖を引くと、配管の奥で何かが呻くような音がした。') });

    r.hemi(0x6878a0, 0x2a2018, 2.4);
    r.shot({ id: 'main', pos: [1.8, 2.75, 1.55], look: [-1.0, 0.55, -1.0], fov: 62, zone: [-2.2, -1.95, 2.2, 1.95] });
  },

  update(r, g, dt) {
    if (r.handT !== undefined) {
      r.handT += dt;
      const t = r.handT;
      const h = r.hand;
      h.visible = t < 2.2;
      h.position.y = t < 0.25 ? -0.2 + t * 3.0 : t < 1.4 ? 0.55 + Math.sin(t * 20) * 0.02 : 0.55 - (t - 1.4) * 1.0;
      h.rotation.z = Math.sin(t * 7) * 0.2;
      if (t > 2.5) r.handT = undefined;
    }
  },
};

async function tubScare(r, g) {
  g.lock();
  g.player.rot = Math.PI;
  await g.player.playClip('search');
  g.cut({ pos: [-0.8, 1.35, 0.4], look: [0.6, 0.5, -1.25], fov: 50 });
  g.audio.sfx('splash', { at: { x: 0.4, y: 0.5, z: -1.2 } });
  g.burst('splash', 0.55, 0.55, -1.25);
  r.handT = 0;
  g.flash(0.3, [0.6, 0.9, 0.7]);
  g.audio.sfx('sting');
  g.shake(0.1, 0.5);
  await g.wait(0.4);
  g.player.damage(10, 0.4, -1.4, { knock: 1.5 });
  await g.wait(0.7);
  await g.say('水の中から、冷たい何かが手首を掴んだ――！');
  g.cut(null);
  await g.say('……必死に振りほどいた手の中に、\n小さな真鍮の鍵が握られていた。');
  g.flags.tubDone = true;
  g.unlock();
  await g.give('brassKey', { silent: true });
  await g.say('真鍮の小さな鍵を手に入れた。');
}

async function mirrorScare(r, g) {
  g.lock();
  g.cut({ pos: [0.6, 1.62, 0.25], look: [2.0, 1.6, 0.25], fov: 40 });
  await g.wait(0.6);
  r.mirror.material = M('mirrorHaunt', { phong: true, shininess: 100, specular: 0x99aabb });
  g.audio.sfx('sting');
  g.flash(0.25, [0.8, 0.9, 1.0]);
  await g.wait(0.9);
  r.mirror.material = M('mirrorIII', { phong: true, shininess: 100, specular: 0x99aabb });
  g.flags.mirrorSeen = true;
  await g.wait(0.4);
  await g.say('鏡の中に、自分のものではない顔が――');
  await g.say('……いや、もう何も映っていない。\n曇った鏡面に、指でなぞったような文字だけが残っている。\n\n『III』');
  g.cut(null);
  g.unlock();
}
