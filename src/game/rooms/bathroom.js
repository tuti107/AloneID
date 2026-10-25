// 浴室 — black water in the tub, and a message in the mirror.
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import * as F from '../furniture.js';
import { C } from '../mats.js';
import { tex } from '../../engine/textures.js';
import { loft, headGeo } from '../body.js';

// Things on this layer are drawn only by the mirror's camera.
const MIRROR_ONLY = 2;
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

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
    // a drowned hand, waiting under the water
    r.hand = drownedHand();
    r.hand.root.visible = false;
    r.dynamic.add(r.hand.root);
    r.dynamic.add(r.hand.head);

    r.place(F.toilet(), -1.55, -1.38, 0, { collide: true });
    r.place(F.sink(), 1.72, 0.25, -Math.PI / 2, { collide: true });
    // A real mirror over the basin: the room, and whoever stands in it,
    // reflected a little dim and spotted with age.
    const mir = F.wallMirror({ w: 0.55, h: 0.75 });
    mir.position.set(1.965, 1.5, 0.25);
    mir.rotation.y = -Math.PI / 2;
    r.dynamic.add(mir);
    mir.userData.mirror.visible = false;
    const glass = new Reflector(new THREE.PlaneGeometry(0.55, 0.75), { textureWidth: 256, textureHeight: 192, color: 0x9aa2a8, clipBias: 0.003 });
    glass.position.set(0, 0.375, 0.032);
    mir.add(glass);
    r.mirror = glass;
    const film = (name, opacity, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.75), new THREE.MeshLambertMaterial({ map: tex(name), transparent: true, opacity, depthWrite: false }));
      m.position.set(0, 0.375, z);
      mir.add(m);
      return m;
    };
    film('mirrorAge', 1, 0.034);
    r.fog = film('mirrorFog', g.flags.mirrorSeen ? 1 : 0, 0.036);
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
      animateHand(r.hand, r.handT);
      if (r.handT > 3.2) r.handT = undefined;
    }
  },
};

// The arm bursts up out of the black water at his wrist and closes on it,
// trembles and pulls, lets go when he wrenches free and slides back under;
// behind it the crown of a drowned head rises and sinks again.
function animateHand(h, t) {
  const up = ease(t / 0.18), grab = ease((t - 0.14) / 0.2);
  const loose = ease((t - 1.2) / 0.3), down = ease((t - 1.35) / 0.9);
  const held = t > 0.34 && t < 1.25;
  const shake = held ? Math.sin(t * 41) * 0.035 : 0;
  const pull = held ? 0.03 + Math.sin(t * 9) * 0.02 : 0;
  h.root.visible = t < 2.4;
  h.root.position.copy(h.base).addScaledVector(h.dir, -0.38 * (1 - up) - pull - 0.65 * down);
  h.root.quaternion.copy(h.aim);
  h.root.rotateZ(shake);
  h.wrist.rotation.x = 0.35 * grab * (1 - loose) - 0.25 * loose;
  const curl = 0.1 + 1.25 * grab * (1 - loose) + 0.2 * loose;
  for (const f of h.fingers) f.forEach((seg, k) => { seg.rotation.x = curl * [0.75, 1.1, 0.95][k] + shake; });
  h.thumb.forEach((seg, k) => { seg.rotation.x = curl * (0.4 + 0.3 * k); });
  // the drowned head: only its crown and hair ever break the surface
  const rise = ease((t - 0.3) / 0.7) * (1 - ease((t - 1.5) / 0.8));
  h.head.visible = t > 0.25 && t < 2.4;
  h.head.position.y = 0.36 + 0.17 * rise;
  h.head.rotation.y = t * 0.15;
}

// A drowned arm with a hand of jointed fingers (curl them by rotating the
// segments about x; the palm faces +z), and the head it belongs to.
function drownedHand() {
  const skin = C(0x93a294, { phong: true, flat: false, shininess: 70, specular: 0x4a5a4a });
  const nailM = C(0x231f1a, { flat: false });
  const hairM = C(0x0b0c0d, { phong: true, flat: false, shininess: 90, specular: 0x333a40 });
  const root = new THREE.Group();
  const mesh = (geo, m, parent) => {
    const me = new THREE.Mesh(geo, m);
    me.castShadow = true;
    parent.add(me);
    return me;
  };
  // forearm from under the water up to the wrist: swollen, then bony
  mesh(loft([[-0.03, 0, 0], [0, 0.04, 0.036], [0.16, 0.042, 0.037], [0.34, 0.032, 0.025, 0.003], [0.46, 0.027, 0.019], [0.475, 0, 0]], 8), skin, root);
  const wrist = new THREE.Group();
  wrist.position.y = 0.46;
  root.add(wrist);
  mesh(loft([[-0.014, 0.026, 0.019], [0.024, 0.037, 0.016, 0, 0.002], [0.08, 0.042, 0.015, 0, 0.004], [0.1, 0.039, 0.014, 0, 0.004]], 8), skin, wrist);
  const fingers = [];
  const segs = [[0.05, 0.035, 0.026], [0.056, 0.04, 0.028], [0.054, 0.037, 0.026], [0.042, 0.03, 0.022]];
  [-0.028, -0.0095, 0.0095, 0.028].forEach((x, i) => {
    let parent = wrist, y = 0.098;
    const chain = [];
    segs[i].forEach((len, k) => {
      const j = new THREE.Group();
      j.position.set(k === 0 ? x : 0, y, k === 0 ? 0.003 : 0);
      if (k === 0) j.rotation.z = -x * 2.4; // splayed
      parent.add(j);
      const r0 = 0.01 - k * 0.0014;
      mesh(loft([[-0.004, r0, r0 * 0.85], [len * 0.5, r0 * 0.94, r0 * 0.82], [len, r0 * 0.8, r0 * 0.72], [len + 0.004, 0, 0]], 6), skin, j);
      if (k === 2) mesh(loft([[len * 0.3, 0.006, 0.0018], [len + 0.016, 0.004, 0.0014], [len + 0.02, 0, 0]], 4), nailM, j).position.z = r0 * 0.6;
      chain.push(j);
      parent = j;
      y = len;
    });
    fingers.push(chain);
  });
  const thumb = [];
  let tp = wrist, ty = 0.024;
  [0.042, 0.035].forEach((len, k) => {
    const j = new THREE.Group();
    j.position.set(k === 0 ? 0.035 : 0, ty, k === 0 ? 0.012 : 0);
    if (k === 0) j.rotation.set(0.5, 0, -0.7);
    tp.add(j);
    mesh(loft([[-0.004, 0.012, 0.011], [len, 0.0095, 0.0085], [len + 0.005, 0, 0]], 6), skin, j);
    thumb.push(j);
    tp = j;
    ty = len;
  });
  // the crown of a head of long black hair, strands floating out round it
  const head = new THREE.Group();
  mesh(loft([[-0.12, 0.1, 0.11], [0.0, 0.105, 0.115], [0.07, 0.08, 0.09], [0.11, 0.035, 0.04], [0.12, 0, 0]], 10), hairM, head);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const strand = new THREE.Mesh(loft([[0, 0.02, 0.004], [0.18, 0.016, 0.003], [0.32, 0.008, 0.002], [0.34, 0, 0]], 4), hairM);
    strand.rotation.set(0, a, 0);
    strand.rotateX(Math.PI / 2 - 0.08);
    strand.position.set(Math.sin(a) * 0.08, 0.13, Math.cos(a) * 0.08);
    head.add(strand);
  }
  head.visible = false;
  return { root, wrist, fingers, thumb, head, base: new THREE.Vector3(), dir: new THREE.Vector3(0, 1, 0), aim: new THREE.Quaternion() };
}

// Point the arm so that its hand closes on `target` (his wrist), coming up
// from deeper in the tub.
function aimHand(h, target) {
  h.base.set(target.x + 0.05, target.y - 0.43, target.z - 0.2);
  h.dir.subVectors(target, h.base).normalize();
  h.aim.setFromUnitVectors(new THREE.Vector3(0, 1, 0), h.dir);
  h.base.addScaledVector(h.dir, -0.02);
  h.head.position.set(target.x - 0.32, 0.36, target.z - 0.3);
}

// Long wet hair and a drowned face, worn over his own head where only the
// mirror can see it.
function drownedReflection(g) {
  const head = g.player.parts.head;
  const [hw, hh, hd] = g.player.parts.spec.head;
  const hair = C(0x0b0c0d, { phong: true, flat: false, shininess: 90, specular: 0x333a40 });
  const face = new THREE.Mesh(
    headGeo({ w: hw * 1.12, h: hh * 1.06, d: hd * 1.14, nose: 0.5, hair: { front: 0.36, side: -0.4, back: -0.95, thick: 0.018 } }),
    [new THREE.MeshLambertMaterial({ map: tex('faceDrowned') }), C(0xa8b6b2, { flat: false }), hair],
  );
  // strands hanging past the jaw on both sides and down the back
  for (const [x, z, w] of [[-0.085, 0.02, 0.05], [0.085, 0.02, 0.05], [0, -0.07, 0.16]]) {
    const strand = new THREE.Mesh(loft([[0.04, w, 0.03], [-0.12, w * 0.9, 0.025], [-0.24, w * 0.7, 0.012], [-0.26, 0, 0]], 8), hair);
    strand.position.set(x, 0, z);
    face.add(strand);
  }
  face.traverse((o) => o.layers.set(MIRROR_ONLY));
  head.add(face);
  return face;
}

async function tubScare(r, g) {
  g.lock();
  const p = g.player;
  // he kneels at the tub and reaches down into the black water
  p.place(0.35, -0.7, Math.PI);
  p.setState('scripted');
  p.anim.play('dip', { restart: true, fade: 0.25 });
  // from the foot of the tub: the water, the hand and him all in view
  g.cut({ pos: [1.72, 1.25, -0.55], look: [0.3, 0.68, -1.02], fov: 52 });
  await g.wait(1.6);
  // it takes him by the forearm, just above the water
  p.root.updateMatrixWorld(true);
  const elbow = p.parts.joints.rElbow.getWorldPosition(new THREE.Vector3());
  const wrist = p.parts.joints.rElbow.localToWorld(new THREE.Vector3(0, -p.parts.spec.foreArm, 0));
  const k = Math.min(1, Math.max(0, (elbow.y - 0.6) / Math.max(0.01, elbow.y - wrist.y)));
  const grip = elbow.lerp(wrist, k);
  aimHand(r.hand, grip);
  r.handT = 0;
  animateHand(r.hand, 0);
  g.audio.sfx('splash', { at: grip });
  g.burst('splash', grip.x, 0.52, grip.z);
  g.flash(0.3, [0.6, 0.9, 0.7]);
  g.audio.sfx('sting');
  g.shake(0.1, 0.5);
  // close on the hand round his sleeve, the hair rising behind it
  g.cut({ pos: [grip.x + 1.05, grip.y + 0.33, grip.z + 0.15], look: [grip.x, grip.y + 0.02, grip.z], fov: 36 });
  // it holds on and pulls; he wrenches himself free
  await g.wait(1.2);
  g.cut({ pos: [1.72, 1.25, -0.55], look: [0.3, 0.68, -1.02], fov: 52 });
  p.setState('idle');
  p.damage(10, 0.35, -1.4, { knock: 1.6 });
  await g.wait(0.8);
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
  // over his shoulder: his own tired face looks back from the glass
  g.player.place(1.42, 0.2, Math.PI / 2);
  g.cut({ pos: [0.62, 1.82, 0.66], look: [1.98, 1.76, 0.24], fov: 42 });
  await g.wait(1.4);
  // then it isn't his face any more
  r.mirror.getReflectionCamera(g.director.cam).layers.enable(MIRROR_ONLY);
  const other = drownedReflection(g);
  g.audio.sfx('sting');
  g.flash(0.12, [0.7, 0.8, 0.9]);
  g.cut({ pos: [1.0, 1.8, 0.55], look: [1.98, 1.78, 0.3], fov: 34 });
  await g.wait(0.5);
  // it tilts its head; he doesn't move
  await g.tween(other.rotation, 'z', 0.38, 1.3);
  await g.wait(0.3);
  g.flash(0.3, [0.85, 0.9, 1.0]);
  g.shake(0.06, 0.25);
  other.parent.remove(other);
  g.flags.mirrorSeen = true;
  await g.wait(0.5);
  await g.say('鏡の中に、自分のものではない顔が――');
  await g.tween(r.fog.material, 'opacity', 1, 0.9);
  await g.say('……いや、もう自分の顔しか映っていない。\n曇った鏡面に、指でなぞったような文字だけが残っている。\n\n『III』');
  g.cut(null);
  g.unlock();
}
