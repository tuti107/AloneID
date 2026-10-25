// Character models: the investigator, the household dead and worse things.
// Clothing is built on the body's own surface (body.js), so collars, lapels,
// aprons and coat skirts follow its curves instead of floating as plates.
import * as THREE from 'three';
import { frustum } from '../engine/geom.js';
import { C, spriteMat } from './mats.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Animator, buildHumanoid, humanClips, zombieClips, ghoulClips, ghostClips, armorClips, preacherClips, setJ, addJ, ROOT } from './rig.js';
import { loft, shell, ringAt, surfacePoint, headGeo } from './body.js';
import { tex } from '../engine/textures.js';
import { rng } from '../engine/util.js';

const TAU = Math.PI * 2;

function box(parent, m, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function add(parent, geo, m, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// smooth-shaded cloth, optionally visible from inside (skirts, tails)
const S = (c, inside = false) => C(c, inside ? { flat: false, side: THREE.DoubleSide } : { flat: false });
// A plate lying on a body part's surface: rows of [y, fromAngle, toAngle]
// (angle 0 = front, +pi/2 = the character's left).
const plate = (parent, m, rings, rows, n = 4, off = 0.004) => add(parent, shell(rings, rows, n, off), m);
// A band all the way round a body part (belts, cuffs, collars).
const band = (parent, m, rings, y0, y1, off = 0.006, n = 12) => add(parent, loft([ringAt(rings, y0), ringAt(rings, y1)], n, { off, caps: false }), m);
// Mirror a row list to the other side of the body.
const mirror = (rows) => rows.map(([y, a0, a1]) => [y, -a1, -a0]);

// Lapels of an open jacket, from the V at `bottom` up round the neck.
function lapels(p, m, bottom, wide = 1) {
  const L = p.spec.torsoLen;
  const rows = [[bottom, 0.02, 0.12 * wide], [L * 0.76, 0.2, 0.2 + 0.28 * wide], [L * 0.9, 0.33, 0.33 + 0.34 * wide], [L - 0.012, 0.48, 0.48 + 0.3 * wide]];
  plate(p.joints.spine, m, p.surf.torso, rows, 3, 0.008);
  plate(p.joints.spine, m, p.surf.torso, mirror(rows), 3, 0.008);
}

// Flap of cloth hanging from a hip joint and following the thigh (coat
// skirts, tails): rings [y, rx, rz] round the leg, `arc` [from, to] angles
// (the whole way round when omitted).
function legSkirt(p, side, m, rings, arc = null, n = 10) {
  const sx = side === 'l' ? 1 : -1;
  const R = rings.map(([y, rx, rz, oz = 0]) => [y, rx, rz, -sx * 0.022, oz, 0.3]);
  if (!arc) return add(p.joints[side + 'Hip'], loft(R, n, { caps: false }), m);
  const [a0, a1] = sx > 0 ? arc : [-arc[1], -arc[0]];
  return add(p.joints[side + 'Hip'], shell(R, R.map(([y]) => [y, a0, a1]), n, 0), m);
}

// Something sitting on the head (hat, cap, bun): head-local coordinates in
// units of the head's half-size.
function onHead(p, geo, m, u, v, w, rx = 0) {
  const [hw, hh, hd] = p.spec.head;
  const mesh = add(p.head, geo, m, u * hw / 2, v * hh / 2, w * hd / 2);
  mesh.rotation.x = rx;
  return mesh;
}

// ------------------------------------------------------------------ player
export function buildInvestigator() {
  const coat = 0x7a6440, coatDark = 0x5a4a2e;
  const parts = buildHumanoid({
    armW: 0.115,
    colors: { torso: coat, arms: coat, legs: 0x2a2520, pelvis: coat, skin: 0xc89a78, shoes: 0x16110d, hair: 0x2a1c12 },
    face: 'facePlayer',
    extras(p, spec) {
      const j = p.joints, T = p.surf.torso, L = spec.torsoLen;
      const cd = S(coatDark);
      // fedora, tipped a little forward
      const hat = new THREE.Group();
      p.head.add(hat);
      hat.position.set(0, spec.head[1] / 2 * 0.56, -0.004);
      hat.rotation.x = 0.1;
      const felt = S(0x3a2c20);
      add(hat, loft([[0, 0.172, 0.194, 0, 0.01], [0.012, 0.168, 0.19, 0, 0.01], [0.016, 0, 0, 0, 0.01]], 16), felt);
      // tall crown with the crease along the top
      add(hat, loft([[0, 0.097, 0.11, 0, -0.004, 0.25], [0.085, 0.09, 0.1, 0, -0.004, 0.3], [0.122, 0.078, 0.088, 0, -0.004, 0.35], [0.126, 0.05, 0.07, 0, -0.008, 0.2], [0.11, 0.012, 0.05, 0, -0.008], [0.106, 0, 0, 0, -0.008]], 12), felt);
      add(hat, loft([[0.01, 0.099, 0.112, 0, -0.004, 0.25], [0.036, 0.097, 0.109, 0, -0.004, 0.27]], 12, { off: 0.003, caps: false }), S(0x14100c));
      p.hat = hat;
      // open collar: shirt and tie in the V of the lapels
      plate(j.spine, S(0xd8d4c8), T, [[L * 0.52, -0.05, 0.05], [L * 0.8, -0.24, 0.24], [L * 0.93, -0.38, 0.38], [L - 0.004, -0.55, 0.55]], 4, 0.003);
      plate(j.spine, S(0x7a1a1a), T, [[L * 0.56, -0.13, 0.13], [L * 0.62, -0.17, 0.17], [L * 0.86, -0.13, 0.13], [L * 0.9, -0.2, 0.2], [L * 0.945, -0.17, 0.17]], 2, 0.006);
      lapels(p, cd, L * 0.5);
      plate(j.spine, cd, T, [[L * 0.88, 0.75, TAU - 0.75], [L + 0.028, 0.95, TAU - 0.95]], 8, 0.012);
      // belt, buckle and a double row of buttons
      band(j.spine, S(0x2a1e14), T, 0.02, 0.075, 0.009);
      const bp = surfacePoint(T, 0.047, 0, 0.014);
      box(j.spine, C(0x8a7a4a), 0.05, 0.035, 0.01, bp.x, bp.y, bp.z);
      for (const sx of [-1, 1]) {
        for (const y of [L * 0.22, L * 0.36, L * 0.5]) {
          const b = surfacePoint(T, y, sx * 0.34, 0.006);
          box(j.spine, C(0x2a1e10), 0.018, 0.018, 0.01, b.x, b.y, b.z, 0, sx * 0.34, 0);
        }
      }
      // coat skirts swing with each thigh
      for (const side of ['l', 'r']) legSkirt(p, side, S(coat, true), [[0.1, 0.118, 0.128], [-0.1, 0.124, 0.136, -0.004], [-0.36, 0.134, 0.15, -0.01], [-0.6, 0.146, 0.164, -0.014]]);
      // turned-back cuffs
      for (const side of ['l', 'r']) band(j[side + 'Elbow'], cd, p.surf.foreArm, -spec.foreArm * 0.68, -spec.foreArm * 0.84, 0.007, 8);
    },
  });
  return { parts, clips: humanClips() };
}

// ------------------------------------------------------------------ Clara
// Silas's daughter, come from Boston in the storm: cloche hat over a dark
// bob, a long wool coat with a fur collar, gloves, stockings.
export function buildClara() {
  const coat = 0x4a5a6e, coatDark = 0x2c3846, fur = 0x8a7660;
  const parts = buildHumanoid({
    hipY: 0.9, thigh: 0.43, shin: 0.42, torsoLen: 0.52,
    chest: [0.34, 0.21], waist: [0.27, 0.17], pelvis: [0.3, 0.14, 0.2], bust: 0.016, head: [0.168, 0.208, 0.192],
    shoulderX: 0.17, armW: 0.08, legW: 0.115, upperArm: 0.28, foreArm: 0.25, handW: 0.07,
    colors: { torso: coat, arms: coat, legs: 0xbfa48a, pelvis: coat, skin: 0xe4c4ae, shoes: 0x120c0a, hair: 0x2a170e, hands: 0x241a16 },
    face: 'faceClara',
    hair: { front: 0.62, side: -0.18, back: -0.55, thick: 0.016 },
    extras(p, spec) {
      const j = p.joints, T = p.surf.torso, L = spec.torsoLen;
      const cd = S(coatDark);
      // the coat hangs to mid-calf, swinging with each leg
      for (const side of ['l', 'r']) legSkirt(p, side, S(coat, true), [[0.1, 0.122, 0.13], [-0.1, 0.13, 0.142, -0.004], [-0.38, 0.142, 0.158, -0.01], [-0.66, 0.152, 0.17, -0.016]]);
      // belt, and two rows of buttons
      band(j.spine, cd, T, 0.05, 0.095, 0.01);
      for (const sx of [-1, 1]) {
        for (const y of [L * 0.3, L * 0.52]) {
          const b = surfacePoint(T, y, sx * 0.3, 0.008);
          box(j.spine, C(0x0e0c0a), 0.016, 0.016, 0.01, b.x, b.y, b.z, 0, sx * 0.3, 0);
        }
      }
      // a deep fur collar round the shoulders
      add(j.spine, loft([[L - 0.06, 0.13, 0.1, 0, -0.004], [L - 0.01, 0.12, 0.095, 0, -0.006], [L + 0.035, 0.085, 0.075, 0, -0.008], [L + 0.06, 0.06, 0.056, 0, -0.008]], 12, { caps: false }), S(fur));
      // cuffs
      for (const side of ['l', 'r']) band(j[side + 'Elbow'], cd, p.surf.foreArm, -spec.foreArm * 0.72, -spec.foreArm * 0.86, 0.008, 8);
      // cloche hat, pulled down to the brows, with a band
      const felt = S(0x2e2a3a);
      const hat = onHead(p, loft([[-0.012, 0.112, 0.124, 0, 0.004], [0.0, 0.104, 0.116, 0, 0.002], [0.05, 0.1, 0.11], [0.1, 0.088, 0.096, 0, -0.004], [0.13, 0.058, 0.066, 0, -0.006], [0.142, 0, 0, 0, -0.006]], 14), felt, 0, 0.32, -0.04);
      hat.rotation.x = -0.12;
      const bandM = onHead(p, loft([[0.008, 0.1055, 0.1175, 0, 0.002], [0.026, 0.1035, 0.1155, 0, 0.001]], 14, { caps: false, off: 0.002 }), S(0x6a1e28), 0, 0.32, -0.04);
      bandM.rotation.x = -0.12;
    },
  });
  return { parts, clips: humanClips() };
}

// ------------------------------------------------------------------ Thomas
// Clara's little brother, drowned in 1912: a pale boy in a sailor suit, and
// not all there. setFade(0..1) brings him and takes him away again.
export function buildThomas() {
  const mats = [];
  const G = (c, glow = 0.3) => {
    const m = new THREE.MeshLambertMaterial({ color: c, emissive: new THREE.Color(c).multiplyScalar(glow), transparent: true, opacity: 0.85 });
    mats.push(m);
    return m;
  };
  const skin = G(0xd2dce4, 0.4), suit = G(0xdfe6f0, 0.35), navy = G(0x2a3a64, 0.2), hair = G(0x4a3a2c, 0.15), shoes = G(0x16161c, 0.1);
  const parts = buildHumanoid({
    hipY: 0.56, thigh: 0.26, shin: 0.25, torsoLen: 0.33, neckLen: 0.05,
    chest: [0.25, 0.16], waist: [0.22, 0.15], pelvis: [0.21, 0.1, 0.14], head: [0.15, 0.172, 0.16],
    shoulderX: 0.12, armW: 0.055, legW: 0.075, upperArm: 0.18, foreArm: 0.16, handW: 0.05, hipX: 0.06, neckR: 0.03,
    colors: { torso: suit, arms: suit, legs: navy, shins: suit, pelvis: navy, skin, shoes, hair },
    face: 'faceThomas',
    hair: { front: 0.62, side: -0.12, back: -0.5, thick: 0.01 },
    extras(p, spec) {
      const j = p.joints, T = p.surf.torso, L = spec.torsoLen;
      // a sailor's collar and its knotted scarf
      band(j.spine, navy, T, L - 0.06, L - 0.015, 0.008);
      box(j.spine, navy, 0.05, 0.07, 0.02, 0, L - 0.11, 0.08, -0.2);
      for (const side of ['l', 'r']) band(j[side + 'Elbow'], navy, p.surf.foreArm, -spec.foreArm * 0.78, -spec.foreArm * 0.9, 0.006, 8);
    },
  });
  if (parts.faceMat) {
    parts.faceMat.transparent = true;
    parts.faceMat.emissive = new THREE.Color(0x404850);
    parts.faceMat.emissiveMap = parts.faceMat.map;
    mats.push(parts.faceMat);
  }
  parts.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  const halo = new THREE.Sprite(spriteMat('glow', 0x9ab8d8, 0.0));
  halo.scale.set(1.6, 1.9, 1);
  halo.position.y = 0.7;
  parts.root.add(halo);
  const light = new THREE.PointLight(0xa8c0e0, 0, 4, 2);
  light.position.set(0, 1.0, 0.3);
  parts.root.add(light);
  const anim = new Animator(parts, humanClips());
  anim.play('idle', { fade: 0 });
  return {
    root: parts.root,
    parts,
    setFade(v) {
      for (const m of mats) { m.opacity = 0.85 * v; m.depthWrite = v > 0.7; }
      halo.material.opacity = 0.3 * v;
      light.intensity = 2.5 * v;
      parts.root.visible = v > 0.01;
    },
    giveKey() { anim.play('reach', { restart: true, fade: 0.2 }); },
    update(dt) { anim.update(dt); if (anim.cur === 'reach' && anim.finished) anim.play('idle', { fade: 0.4 }); },
  };
}

// ------------------------------------------------------------------ ancestors
// The family's dead, out of their niches in the crypt: dried to the bone in
// old-fashioned black, dust and cobweb on their shoulders.
export function buildAncestor({ seed = 1 } = {}) {
  const R = rng(seed * 13 + 5);
  const skin = [0x8a8070, 0x7e7666, 0x928a78][seed % 3];
  const coat = R() < 0.5 ? 0x1e1c1a : 0x2a2622;
  const parts = buildHumanoid({
    chest: [0.34, 0.2], waist: [0.27, 0.17], pelvis: [0.29, 0.13, 0.19], head: [0.17, 0.215, 0.195],
    armW: 0.07, legW: 0.1, handW: 0.072, shoulderX: 0.17, neckR: 0.034,
    headShape: { jaw: 0.85, nose: 0.6 },
    colors: { torso: coat, arms: coat, legs: coat, pelvis: coat, skin, shoes: 0x0e0c0a, hair: R() < 0.5 ? 0xb8b4a8 : 0x3a3430 },
    face: 'faceAncestor', faceGlow: 'faceAncestorGlow',
    hair: { front: 0.3, side: -0.2, back: -0.5, thick: 0.006 },
    extras(p, spec) {
      const j = p.joints, T = p.surf.torso, L = spec.torsoLen;
      // a high white collar gone yellow, and the coat's tails
      band(j.spine, S(0xb8b098), T, L - 0.04, L - 0.005, 0.006);
      for (const side of ['l', 'r']) legSkirt(p, side, S(coat, true), [[0.1, 0.11, 0.12], [-0.12, 0.12, 0.13, -0.004], [-0.4, 0.13, 0.14, -0.01]]);
      // dust and cobweb on the shoulders
      for (let i = 0; i < 4; i++) {
        const b = surfacePoint(T, L - 0.03, (i % 2 ? 1 : -1) * (0.6 + R() * 0.8), 0.008);
        box(j.spine, C(0x9a968a, { transparent: true, opacity: 0.6 }), 0.08 + R() * 0.05, 0.004, 0.06, b.x, b.y, b.z, 0, R() * 3, 0);
      }
    },
  });
  return { parts, clips: zombieClips({ hunch: 0.3 }) };
}

// ------------------------------------------------------------------ Ezekiel
// Captain Ezekiel Ashcombe of the Black Gull, a hundred and twenty years in
// the sea: a big man gone green under a rotten captain's coat and tricorn,
// weed for a beard, barnacles up his arms, his cutlass, and the other star
// stone burning blue in his chest where his heart was.
export function buildEzekiel() {
  const coat = 0x1a2030, coatDark = 0x0e121a, gold = 0x9a7a30, skin = 0x6a8478;
  const parts = buildHumanoid({
    hipY: 1.0, thigh: 0.48, shin: 0.47, torsoLen: 0.62,
    chest: [0.5, 0.3], waist: [0.45, 0.28], pelvis: [0.38, 0.16, 0.26], head: [0.21, 0.245, 0.225],
    shoulderX: 0.245, armW: 0.11, legW: 0.15, upperArm: 0.36, foreArm: 0.33, handW: 0.095, hipX: 0.12, neckR: 0.05,
    headShape: { jaw: 1.2 },
    colors: { torso: coat, arms: coat, legs: 0x2a2620, pelvis: coat, skin, shoes: 0x0c0b0a, hair: 0x8a8a7c, hands: skin },
    face: 'faceEzekiel', faceGlow: 'faceEzekielGlow',
    hair: { front: 0.25, side: 0.0, back: -0.65, thick: 0.012 },
    extras(p, spec) {
      const j = p.joints, T = p.surf.torso, L = spec.torsoLen;
      const gm = S(gold), cd = S(coatDark);
      // the coat's long skirts, its lapels and buttons, a sash
      for (const side of ['l', 'r']) legSkirt(p, side, S(coat, true), [[0.12, 0.17, 0.18], [-0.1, 0.18, 0.19, -0.004], [-0.45, 0.2, 0.21, -0.01], [-0.8, 0.21, 0.22, -0.016]]);
      plate(j.spine, cd, T, [[L * 0.35, -0.5, -0.18], [L * 0.95, -0.7, -0.2]], 3, 0.008);
      plate(j.spine, cd, T, mirror([[L * 0.35, -0.5, -0.18], [L * 0.95, -0.7, -0.2]]), 3, 0.008);
      for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {
        const b = surfacePoint(T, L * (0.25 + i * 0.16), sx * 0.24, 0.01);
        box(j.spine, gm, 0.022, 0.022, 0.012, b.x, b.y, b.z);
      }
      band(j.spine, S(0x5a1a14), T, 0.02, 0.09, 0.012);
      // epaulettes, gone green
      for (const sx of [-1, 1]) {
        const e = box(j.spine, S(0x6a6a3a), 0.14, 0.03, 0.12, sx * 0.21, L - 0.02, 0);
        e.rotation.z = -sx * 0.25;
      }
      // the tricorn: a round crown, its brim cocked up into three sides
      const felt = S(0x121216, true);
      onHead(p, loft([[0, 0.122, 0.132], [0.06, 0.118, 0.128], [0.105, 0.096, 0.104], [0.13, 0, 0]], 12), felt, 0, 0.42, -0.05);
      const brim = onHead(p, loft([[0, 0.15, 0.15], [0.085, 0.27, 0.27]], 3, { caps: false }), felt, 0, 0.42, -0.05);
      brim.rotation.y = Math.PI / 2;
      const trim = onHead(p, loft([[0.083, 0.272, 0.272], [0.093, 0.275, 0.275]], 3, { caps: false }), S(gold, true), 0, 0.42, -0.05);
      trim.rotation.y = Math.PI / 2;
      // weed for a beard, and down his front
      const weed = S(0x1e2e1a, true);
      for (let i = 0; i < 7; i++) {
        const st = onHead(p, loft([[0, 0.02, 0.008], [-0.18 - (i % 3) * 0.06, 0.012, 0.005], [-0.3 - (i % 3) * 0.06, 0, 0]], 4), weed, (i - 3) * 0.22, -0.55, 0.6);
        st.rotation.z = (i - 3) * 0.08;
      }
      // barnacles up the forearms
      for (let i = 0; i < 10; i++) {
        const side = i % 2 ? 'l' : 'r';
        const b = surfacePoint(p.surf.foreArm, -spec.foreArm * (0.2 + (i % 5) * 0.14), (i * 1.7) % 6.2, 0.006);
        const bn = add(j[side + 'Elbow'], new THREE.ConeGeometry(0.018, 0.022, 5), S(0xb2aea2), b.x, b.y, b.z);
        bn.rotation.x = Math.PI / 2;
      }
      // the star where his heart was
      const star = starShape(0.06, 0.012);
      const starM = new THREE.MeshBasicMaterial({ color: 0x7ad8f0 });
      const s = surfacePoint(T, L * 0.62, 0.25, 0.012);
      const sm = add(j.spine, star, starM, s.x, s.y, s.z);
      sm.rotation.y = 0.25;
      const glow = new THREE.Sprite(spriteMat('glow', 0x6ad0f0, 0.7));
      glow.scale.set(0.36, 0.36, 1);
      glow.position.set(s.x, s.y, s.z + 0.04);
      j.spine.add(glow);
      const light = new THREE.PointLight(0x6ad0f0, 3, 4, 2);
      light.position.set(s.x, s.y, s.z + 0.2);
      j.spine.add(light);
      p.star = { mesh: sm, glow, light };
      // his cutlass
      const blade = new THREE.Group();
      p.rGrip.add(blade);
      const steel = C(0x8a9094, { phong: true, shininess: 70, specular: 0xaaaaaa });
      box(blade, steel, 0.06, 0.012, 0.52, 0, 0, 0.35);
      const tip = box(blade, steel, 0.055, 0.012, 0.2, 0.012, 0, 0.69);
      tip.rotation.y = 0.12;
      box(blade, C(gold), 0.13, 0.025, 0.035, 0, 0, 0.075);
      box(blade, C(gold), 0.02, 0.1, 0.14, -0.05, -0.04, 0.0);
      p.weapon = blade;
    },
  });
  const clips = zombieClips({ hunch: 0.08 });
  // he still stands like the master of his ship: square, head up, the
  // cutlass low and ready
  clips.idle = {
    loop: true,
    fn(t, p) {
      setJ(p, 'spine', 0.04 + Math.sin(t * 0.9) * 0.02, Math.sin(t * 0.4) * 0.06, 0);
      setJ(p, 'neck', -0.06, Math.sin(t * 0.5) * 0.14, 0.05);
      setJ(p, 'lShoulder', 0.08, 0, 0.14);
      setJ(p, 'lElbow', -0.3);
      setJ(p, 'rShoulder', -0.4, 0, -0.2);
      setJ(p, 'rElbow', -0.7);
      setJ(p, 'lHip', 0.06);
      setJ(p, 'rHip', -0.1);
      setJ(p, 'lKnee', 0.06);
      setJ(p, 'rKnee', 0.12);
    },
  };
  const walk = humanClips().walk;
  clips.walk = {
    ...walk,
    fn(t, p) {
      walk.fn(t, p);
      addJ(p, 'rShoulder', -0.35, 0, -0.1);
      addJ(p, 'rElbow', -0.5);
    },
  };
  // a cutlass cut, from high on the right across and down
  clips.attack = {
    dur: 1.0,
    events: [{ t: 0.55, name: 'hit' }],
    fn(t, p) {
      const e = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
      const a = e(t / 0.42), b = e((t - 0.42) / 0.18), c = e((t - 0.7) / 0.3);
      const up = a * (1 - b), down = b * (1 - c);
      setJ(p, 'rShoulder', -2.6 * up - 0.9 * down - 0.2, 0.6 * up - 0.8 * down, -0.4 * up);
      setJ(p, 'rElbow', -1.2 * up - 0.2);
      setJ(p, 'spine', 0.05 + 0.25 * down, 0.4 * up - 0.5 * down, 0);
      setJ(p, 'lShoulder', 0.3 * down, 0, 0.3);
      setJ(p, 'lHip', -0.35 * down);
      setJ(p, 'lKnee', 0.35 * down + 0.1);
    },
  };
  return { parts, clips };
}

// A flat five-pointed star, for the stones.
function starShape(r, depth) {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    if (i === 0) sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
}

// ------------------------------------------------------------------ armour
// The suit of armour from the hall: plate over nothing, a visor slit with
// something burning behind it once it wakes, and its halberd.
export function buildArmor() {
  const iron = 0x707076, ironDark = 0x4a4a50;
  const shine = { phong: true, shininess: 70, specular: 0x9a9aa0, flat: false };
  const I = (c) => C(c, shine);
  const parts = buildHumanoid({
    hipY: 0.97, thigh: 0.46, shin: 0.45, torsoLen: 0.58,
    chest: [0.5, 0.31], waist: [0.36, 0.25], pelvis: [0.37, 0.17, 0.25], head: [0.23, 0.28, 0.26],
    shoulderX: 0.225, armW: 0.13, legW: 0.165, upperArm: 0.3, foreArm: 0.28, handW: 0.095,
    matOpts: shine,
    colors: { torso: iron, arms: iron, legs: iron, pelvis: ironDark, skin: iron, shoes: ironDark, hands: ironDark, neck: ironDark },
    face: 'faceArmor', faceGlow: 'faceArmorGlow', ears: false, hair: false,
    headShape: { nose: 0.15, jaw: 1.15 },
    extras(p, spec) {
      const j = p.joints, T = p.surf.torso, L = spec.torsoLen;
      // gorget and a ridge down the breastplate
      band(j.spine, I(ironDark), T, L - 0.06, L + 0.02, 0.016, 12);
      plate(j.spine, I(0x7c7c82), T, [[L * 0.25, -0.06, 0.06], [L * 0.7, -0.05, 0.05], [L * 0.9, -0.03, 0.03]], 2, 0.012);
      band(j.spine, I(ironDark), T, 0.02, 0.07, 0.014, 12);
      for (const side of ['l', 'r']) {
        const sx = side === 'l' ? 1 : -1;
        // pauldrons over the shoulders
        const pd = add(j[side + 'Shoulder'], new THREE.SphereGeometry(0.12, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), I(iron), sx * 0.025, -0.01, 0);
        pd.scale.set(1.2, 0.95, 1.1);
        pd.rotation.z = sx * 0.25;
        // couters and poleyns
        add(j[side + 'Elbow'], new THREE.SphereGeometry(0.066, 10, 6), I(ironDark), 0, 0, -0.01);
        add(j[side + 'Knee'], new THREE.SphereGeometry(0.08, 10, 6), I(ironDark), 0, 0, 0.035);
        // tassets over the thighs
        legSkirt(p, side, I(ironDark), [[0.06, 0.135, 0.145], [-0.1, 0.145, 0.155, -0.004], [-0.22, 0.148, 0.158, -0.006]]);
      }
      // a crest along the helm
      onHead(p, new THREE.BoxGeometry(0.022, 0.06, 0.24), I(ironDark), 0, 0.97, -0.05);
      // the halberd: its pole stands along the fist's z, upright while the
      // forearm is held level
      const hal = new THREE.Group();
      hal.rotation.x = Math.PI / 2;
      p.rGrip.add(hal);
      const steel = C(0x9a9aa2, { phong: true, shininess: 90, specular: 0xcccccc });
      add(hal, new THREE.CylinderGeometry(0.019, 0.022, 2.25, 6), C(0x3a2818), 0, 0.17, 0);
      add(hal, new THREE.BoxGeometry(0.24, 0.3, 0.014), steel, 0.13, 1.08, 0);
      add(hal, new THREE.BoxGeometry(0.13, 0.035, 0.014), steel, -0.08, 1.12, 0);
      add(hal, new THREE.ConeGeometry(0.028, 0.26, 6), steel, 0, 1.42, 0);
      p.halberd = hal;
    },
  });
  return { parts, clips: armorClips() };
}

// ------------------------------------------------------------------ the drowned
// The Black Gull's crew, a hundred and twenty years under the sea: bloated
// and grey-green, in what is left of striped shirts and canvas trousers,
// weed in their hair and barnacles on their arms. seed varies them.
export function buildThrall({ seed = 1 } = {}) {
  const R = rng(seed * 7 + 3);
  const skin = [0x6e8a80, 0x74887a, 0x667e78][seed % 3];
  const shirt = R() < 0.5 ? 0x8a8a7c : 0x7a8088, stripe = R() < 0.5 ? 0x22304a : 0x4a2428;
  const trousers = R() < 0.5 ? 0x4a4a3e : 0x3a4048;
  const weed = S(0x1e2e1a, true), shell = S(0xb2aea2);
  const parts = buildHumanoid({
    chest: [0.5, 0.31], waist: [0.47, 0.32], pelvis: [0.37, 0.16, 0.25], head: [0.215, 0.25, 0.225],
    armW: 0.125, legW: 0.165, handW: 0.095, shoulderX: 0.215,
    colors: { torso: shirt, arms: skin, legs: trousers, shins: skin, pelvis: trousers, skin, shoes: skin, hair: 0x1a2418 },
    face: 'faceThrall', faceGlow: 'faceThrallGlow',
    hair: { front: 0.5, side: -0.1, back: -0.45, thick: 0.012 },
    extras(p, spec) {
      const j = p.joints, T = p.surf.torso, L = spec.torsoLen;
      // stripes, and the sleeves rotted off above the elbow
      for (let i = 0; i < 5; i++) band(j.spine, S(stripe), T, 0.07 + i * L * 0.18, 0.1 + i * L * 0.18, 0.006);
      for (const side of ['l', 'r']) {
        band(j[side + 'Shoulder'], S(shirt), p.surf.upperArm, 0.0, -spec.upperArm * 0.62, 0.008, 8);
        // trousers torn off below the knee
        band(j[side + 'Knee'], S(trousers), p.surf.shin, 0.0, -spec.shin * 0.25, 0.006, 8);
      }
      // a rope for a belt
      band(j.spine, S(0x6a5a3a), T, 0.0, 0.03, 0.012);
      // knit cap, pushed back
      const cap = onHead(p, loft([[0, 0.114, 0.122], [0.05, 0.106, 0.112], [0.1, 0.07, 0.076], [0.125, 0, 0]], 10), S(R() < 0.5 ? 0x4a1c1a : 0x1e2a3a), 0, 0.42, -0.12);
      cap.rotation.x = -0.25;
      // weed hanging off the shoulders and out of the cap
      for (let i = 0; i < 6; i++) {
        const sx = i % 2 ? 1 : -1;
        const b = surfacePoint(T, L - 0.02 - R() * 0.12, sx * (0.8 + R() * 1.2), 0.01);
        const strand = add(j.spine, loft([[0, 0.016, 0.006], [-0.18 - R() * 0.2, 0.01, 0.004], [-0.4 - R() * 0.15, 0.002, 0.002]], 4), weed, b.x, b.y, b.z);
        strand.rotation.z = sx * (0.1 + R() * 0.2);
      }
      for (let i = 0; i < 3; i++) {
        const st = onHead(p, loft([[0, 0.012, 0.005], [-0.2 - R() * 0.15, 0.006, 0.003]], 4), weed, (R() - 0.5) * 1.6, -0.2, -0.6 - R() * 0.3);
        st.rotation.z = (R() - 0.5) * 0.6;
      }
      // barnacles on the forearms and the neck
      for (let i = 0; i < 10; i++) {
        const side = i % 2 ? 'l' : 'r';
        const parent = i < 8 ? j[side + 'Elbow'] : j.neck;
        const y = i < 8 ? -0.05 - R() * spec.foreArm * 0.8 : 0.02 + R() * 0.05;
        const a = R() * Math.PI * 2;
        const rr = i < 8 ? spec.armW * 0.45 : 0.05;
        const bump = add(parent, new THREE.ConeGeometry(0.014 + R() * 0.008, 0.018, 5), shell, Math.sin(a) * rr, y, Math.cos(a) * rr);
        bump.rotation.set(Math.cos(a) * 1.5, 0, -Math.sin(a) * 1.5);
      }
    },
  });
  return { parts, clips: zombieClips({ hunch: 0.35 }) };
}

// The minister of Jonah's chapel, drowned with the rest: black cassock to
// the ankles, white collar, a faded stole, and his Bible.
export function buildPreacher() {
  const black = 0x15171b, skin = 0x7a948a;
  const parts = buildHumanoid({
    hipY: 0.95, chest: [0.46, 0.29], waist: [0.42, 0.28], head: [0.2, 0.25, 0.22],
    colors: { torso: black, arms: black, legs: black, pelvis: black, skin, shoes: 0x0a0a0a, hair: 0x9aa49c, hands: skin },
    face: 'faceThrall', faceGlow: 'faceThrallGlow',
    hair: { front: 0.72, side: 0.15, back: -0.42, thick: 0.01 },
    extras(p, spec) {
      const j = p.joints, T = p.surf.torso, L = spec.torsoLen;
      // the cassock hangs from the hips to the ankles
      const skirt = [[0.1, 0.195, 0.145, 0, 0, 0.3], [-0.1, 0.22, 0.17, 0, -0.005, 0.3], [-0.45, 0.26, 0.21, 0, -0.01, 0.25], [-0.86, 0.29, 0.24, 0, -0.012, 0.2]];
      add(j.hips, loft(skirt, 14, { caps: false }), S(black, true));
      // collar and stole
      add(j.neck, loft([[0.0, 0.058, 0.056], [0.032, 0.055, 0.053]], 10, { off: 0.004, caps: false }), S(0xd0ccc0));
      const stole = S(0x3a2242);
      plate(j.spine, stole, T, [[0.02, 0.1, 0.24], [L * 0.6, 0.12, 0.26], [L - 0.01, 0.2, 0.36]], 2, 0.008);
      plate(j.spine, stole, T, mirror([[0.02, 0.1, 0.24], [L * 0.6, 0.12, 0.26], [L - 0.01, 0.2, 0.36]]), 2, 0.008);
      for (const sx of [-1, 1]) {
        const c = surfacePoint(T, L * 0.35, sx * 0.17, 0.012);
        box(j.spine, C(0xb08a40), 0.012, 0.05, 0.004, c.x, c.y, c.z);
        box(j.spine, C(0xb08a40), 0.032, 0.012, 0.004, c.x, c.y + 0.008, c.z);
      }
      // the Bible in his left hand, swollen with water
      const bible = new THREE.Group();
      p.lGrip.add(bible);
      bible.rotation.set(0, 0, 0.2);
      box(bible, C(0x1c100c), 0.15, 0.21, 0.055, 0, -0.02, 0.03);
      box(bible, C(0xb8ac90), 0.135, 0.195, 0.05, 0.01, -0.02, 0.03);
      box(bible, C(0xb08a40), 0.012, 0.09, 0.057, -0.03, -0.02, 0.03);
      box(bible, C(0xb08a40), 0.05, 0.012, 0.057, -0.03, 0.0, 0.03);
      // weed in his hair
      for (let i = 0; i < 4; i++) {
        const st = onHead(p, loft([[0, 0.012, 0.005], [-0.22, 0.006, 0.003]], 4), S(0x1e2e1a, true), (i - 1.5) * 0.5, 0.1, -0.7);
        st.rotation.z = (i - 1.5) * 0.2;
      }
    },
  });
  return { parts, clips: preacherClips() };
}

// ------------------------------------------------------------------ zombies
export function buildButler() {
  const black = 0x18181c;
  const parts = buildHumanoid({
    colors: { torso: black, arms: black, legs: 0x1c1c20, pelvis: black, skin: 0x7a8a6a, shoes: 0x080808, hair: 0x2a2a26 },
    face: 'faceZombie', faceGlow: 'faceZombieGlow',
    hair: { front: 0.62, thick: 0.005 },
    extras(p, spec) {
      const j = p.joints, T = p.surf.torso, L = spec.torsoLen;
      // starched shirt front in the open tailcoat, stained
      plate(j.spine, S(0x8a8678), T, [[L * 0.28, -0.12, 0.12], [L * 0.62, -0.3, 0.3], [L * 0.9, -0.46, 0.46], [L - 0.004, -0.62, 0.62]], 4, 0.004);
      plate(j.spine, S(0x5a0808), T, [[L * 0.36, 0.05, 0.22], [L * 0.5, 0.02, 0.27], [L * 0.6, 0.07, 0.2]], 3, 0.007);
      lapels(p, S(0x26262c), L * 0.26, 0.8);
      const bt = surfacePoint(T, L - 0.02, 0, 0.014);
      box(j.spine, C(0x050505), 0.09, 0.032, 0.022, bt.x, bt.y, bt.z);
      // tails hang behind the legs
      const tail = S(black, true);
      for (const side of ['l', 'r']) legSkirt(p, side, tail, [[0.06, 0.112, 0.124], [-0.3, 0.118, 0.13, -0.006], [-0.56, 0.12, 0.13, -0.01]], [2.3, 3.55], 5);
    },
  });
  return { parts, clips: zombieClips({ hunch: 0.25 }) };
}

export function buildMaid() {
  const dress = 0x1a1a22, linen = 0x9a968a;
  const parts = buildHumanoid({
    chest: [0.36, 0.22], waist: [0.27, 0.18], pelvis: [0.3, 0.14, 0.2], bust: 0.018, head: [0.175, 0.215, 0.2],
    shoulderX: 0.18, armW: 0.085, legW: 0.13,
    colors: { torso: dress, arms: dress, legs: 0x2a2a2e, pelvis: dress, skin: 0x7e8c72, shoes: 0x080808, hair: 0x2a1a12 },
    face: 'faceMaid', faceGlow: 'faceZombieGlow',
    hair: { front: 0.42, side: 0.0, back: -0.62, thick: 0.01 },
    extras(p, spec) {
      const j = p.joints, T = p.surf.torso, L = spec.torsoLen;
      const skirt = [[0.09, 0.14, 0.1, 0, 0, 0.3], [-0.05, 0.19, 0.15, 0, -0.005, 0.3], [-0.32, 0.25, 0.21, 0, -0.01, 0.25], [-0.62, 0.29, 0.25, 0, -0.012, 0.2]];
      add(j.hips, loft(skirt, 14, { caps: false }), S(dress, true));
      // apron, bib and an old stain
      plate(j.hips, S(linen), skirt, [[0.04, -0.85, 0.85], [-0.3, -0.8, 0.8], [-0.56, -0.76, 0.76]], 6, 0.006);
      plate(j.spine, S(linen), T, [[0.0, -0.5, 0.5], [L * 0.45, -0.4, 0.4], [L * 0.72, -0.38, 0.38]], 4, 0.005);
      plate(j.spine, S(0x6a0a0a), T, [[L * 0.3, 0.08, 0.3], [L * 0.45, 0.04, 0.33], [L * 0.56, 0.12, 0.26]], 3, 0.008);
      // collar, cap and bun
      add(j.neck, loft([[0.0, 0.056, 0.054], [0.032, 0.052, 0.05]], 10, { off: 0.004, caps: false }), S(0xd8d4c8));
      onHead(p, loft([[0, 0.075, 0.06, 0, 0, 0.3], [0.022, 0.08, 0.064, 0, 0, 0.3], [0.036, 0.05, 0.04], [0.04, 0, 0]], 10), S(0xd8d4c8), 0, 0.8, -0.3, -0.55);
      onHead(p, loft([[0.04, 0, 0], [0.026, 0.044, 0.04], [-0.02, 0.046, 0.04], [-0.036, 0, 0]], 8), S(0x2a1a12), 0, 0.15, -1.05);
    },
  });
  return { parts, clips: zombieClips({ hunch: 0.3 }) };
}

export function buildSilas() {
  const shirt = 0xb8b2a0, hairC = 0xb0b0a8;
  const parts = buildHumanoid({
    colors: { torso: shirt, arms: shirt, legs: 0x8a8a7a, pelvis: shirt, skin: 0x9aa08e, shoes: 0x7a806e, hair: hairC },
    face: 'faceSilas', faceGlow: 'faceSilasGlow',
    head: [0.19, 0.24, 0.21],
    hair: { front: 0.66, side: 0.05, back: -0.62, thick: 0.016 },
    extras(p, spec) {
      const j = p.joints, T = p.surf.torso, L = spec.torsoLen;
      // long nightshirt
      for (const side of ['l', 'r']) legSkirt(p, side, S(0xb0aa98, true), [[0.09, 0.116, 0.126], [-0.12, 0.12, 0.132, -0.004], [-0.4, 0.13, 0.142, -0.008]]);
      plate(j.spine, S(0x5a1010), T, [[L * 0.3, -0.3, -0.05], [L * 0.45, -0.34, -0.02], [L * 0.58, -0.26, -0.08]], 3, 0.006);
      plate(j.spine, S(0x9a9484), T, [[L * 0.7, -0.12, 0.12], [L - 0.004, -0.5, 0.5]], 3, 0.004);
      // the noose, and the rope it was cut from
      const rope = S(0x8a7a5a);
      const loop = add(j.neck, new THREE.TorusGeometry(0.066, 0.014, 5, 12), rope, 0, 0.035, 0.004);
      loop.rotation.x = Math.PI / 2 + 0.2;
      const end = add(j.neck, loft([[0, 0.012, 0.012], [-0.48, 0.011, 0.011]], 5), rope, 0.03, -0.0, -0.07);
      end.rotation.set(0.45, 0, 0.2);
      // wild grey hair sticking out
      const tuft = S(hairC);
      for (const [u, v, w, rz, rx] of [[0.97, 0.25, -0.25, -1.9, 0], [-0.97, 0.25, -0.25, 1.9, 0], [0.75, 0.5, -0.65, -1.4, -0.6], [-0.75, 0.5, -0.65, 1.4, -0.6], [0.2, 0.1, -1.0, -0.3, -2.2]]) {
        const t = onHead(p, loft([[0, 0.034, 0.024], [0.05, 0, 0]], 5), tuft, u, v, w, rx);
        t.rotation.z = rz;
      }
    },
  });
  const clips = zombieClips({ hunch: 0.15 });
  return { parts, clips };
}

export function buildCook() {
  const whites = 0xb8b4a8;
  const parts = buildHumanoid({
    hipY: 0.92,
    pelvis: [0.46, 0.16, 0.34],
    waist: [0.58, 0.42],
    chest: [0.5, 0.34],
    torsoLen: 0.58,
    shoulderX: 0.25,
    armW: 0.13, handW: 0.1,
    legW: 0.19, hipX: 0.13,
    head: [0.22, 0.24, 0.23],
    neckR: 0.062,
    headShape: { jaw: 1.2 },
    colors: { torso: whites, arms: whites, legs: 0x3a3a40, pelvis: whites, skin: 0xb09a88, shoes: 0x101010, hair: 0x3a2a1a },
    face: 'faceCook', faceGlow: 'faceCookGlow',
    extras(p, spec) {
      const j = p.joints, T = p.surf.torso, L = spec.torsoLen;
      const apron = S(0xd0ccc0, true), blood = S(0x6a0a0a);
      // stained apron over the belly and down the legs
      plate(j.spine, apron, T, [[-0.02, -0.8, 0.8], [L * 0.4, -0.66, 0.66], [L * 0.62, -0.52, 0.52]], 6, 0.006);
      plate(j.spine, blood, T, [[L * 0.2, -0.45, -0.1], [L * 0.32, -0.5, -0.05], [L * 0.42, -0.36, -0.16]], 3, 0.01);
      const front = [[0.06, 0.29, 0.21, 0, 0.012], [-0.48, 0.3, 0.23, 0, 0.03]];
      plate(j.hips, apron, front, [[0.05, -0.85, 0.85], [-0.47, -0.8, 0.8]], 6, 0);
      plate(j.hips, blood, front, [[-0.12, 0.05, 0.45], [-0.3, 0.12, 0.4]], 3, 0.006);
      band(j.spine, apron, T, 0.0, 0.05, 0.01);
      // toque
      onHead(p, loft([[0, 0.1, 0.108], [0.1, 0.104, 0.11], [0.15, 0.128, 0.128], [0.2, 0.13, 0.13], [0.23, 0.08, 0.08], [0.24, 0, 0]], 12), S(0xe0dcd0), 0, 0.5, -0.08, -0.12);
      // cleaver
      const cl = new THREE.Group();
      p.rGrip.add(cl);
      box(cl, C(0x9a9a9a, { phong: true, shininess: 60 }), 0.02, 0.16, 0.26, 0, -0.05, 0.16);
      box(cl, C(0x2a1a10), 0.03, 0.04, 0.12, 0, 0, 0.0);
      p.weapon = cl;
    },
  });
  const clips = zombieClips({ hunch: 0.12 });
  clips.attack = {
    dur: 1.3,
    events: [{ t: 0.72, name: 'hit' }],
    fn(t, p) {
      const e = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
      const a = e(t / 0.5), b = e((t - 0.55) / 0.2), c = e((t - 0.9) / 0.4);
      const up = a * (1 - b), down = b * (1 - c);
      setJ(p, 'rShoulder', -2.9 * up - 0.9 * down - 0.2, 0, -0.15);
      setJ(p, 'rElbow', -1.2 * up - 0.1);
      setJ(p, 'lShoulder', -0.6 * up, 0, 0.35);
      setJ(p, 'lElbow', -0.4);
      setJ(p, 'spine', 0.1 - 0.2 * up + 0.45 * down, 0.2 * up - 0.2 * down, 0);
      setJ(p, 'neck', -0.1, 0, 0);
      setJ(p, 'lHip', -0.35 * down);
      setJ(p, 'lKnee', 0.35 * down + 0.1);
      setJ(p, 'rKnee', 0.1);
      p[ROOT + 1] = -0.06 * down;
      p[ROOT + 2] = 0.12 * down;
    },
  };
  return { parts, clips };
}

// The stoker, drowned at his boiler: a big man black with coal dust over
// grey dead skin, braces over a filthy undershirt, a leather apron, and the
// coal shovel he swings over his head.
export function buildStoker() {
  const parts = buildHumanoid({
    hipY: 0.94, pelvis: [0.44, 0.16, 0.32], waist: [0.54, 0.38], chest: [0.56, 0.34], torsoLen: 0.6,
    shoulderX: 0.26, armW: 0.14, handW: 0.105, legW: 0.19, hipX: 0.13,
    head: [0.23, 0.25, 0.24], neckR: 0.066, headShape: { jaw: 1.25 },
    colors: { torso: 0x5a564c, arms: 0x5a6a62, legs: 0x2a2a30, pelvis: 0x2a2a30, skin: 0x5a6a62, shoes: 0x0c0c0c, hair: 0x1a1a1a },
    face: 'faceCook', faceGlow: 'faceCookGlow',
    hair: { front: 0.85, side: 0.2, back: -0.2, thick: 0.006 },
    extras(p, spec) {
      const j = p.joints, T = p.surf.torso, L = spec.torsoLen;
      const leather = S(0x3a2614, true), soot = S(0x141210);
      // braces
      for (const sx of [-1, 1]) plate(j.spine, S(0x2a1a10), T, [[0.0, sx * 0.4 - 0.06, sx * 0.4 + 0.06], [L, sx * 0.5 - 0.06, sx * 0.5 + 0.06]].map(([y, a0, a1]) => [y, Math.min(a0, a1), Math.max(a0, a1)]), 2, 0.008);
      // the leather apron, scorched
      plate(j.spine, leather, T, [[-0.02, -0.75, 0.75], [L * 0.5, -0.6, 0.6], [L * 0.7, -0.45, 0.45]], 6, 0.012);
      const front = [[0.06, 0.28, 0.21, 0, 0.012], [-0.5, 0.29, 0.23, 0, 0.03]];
      plate(j.hips, leather, front, [[0.05, -0.85, 0.85], [-0.48, -0.8, 0.8]], 6, 0);
      // coal black up the forearms and over the face
      for (const side of ['l', 'r']) band(j[side + 'Elbow'], soot, p.surf.foreArm, -spec.foreArm * 0.2, -spec.foreArm * 0.95, 0.004, 8);
      plate(j.spine, soot, T, [[L * 0.55, -0.3, 0.3], [L * 0.8, -0.5, 0.5]], 4, 0.004);
      // the coal shovel
      const sh = new THREE.Group();
      p.rGrip.add(sh);
      box(sh, C(0x3a2a1a), 0.035, 0.035, 0.95, 0, 0, 0.32);
      box(sh, C(0x2a2a2a, { phong: true, shininess: 40 }), 0.26, 0.03, 0.3, 0, 0.0, 0.88);
      box(sh, C(0x2a2a2a), 0.26, 0.08, 0.02, 0, 0.04, 1.02);
      p.weapon = sh;
    },
  });
  const clips = zombieClips({ hunch: 0.15 });
  // the shovel comes down two-handed
  clips.attack = {
    dur: 1.4,
    events: [{ t: 0.8, name: 'hit' }],
    fn(t, p) {
      const e = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
      const a = e(t / 0.6), b = e((t - 0.65) / 0.2), c = e((t - 1.0) / 0.4);
      const up = a * (1 - b), down = b * (1 - c);
      setJ(p, 'rShoulder', -3.0 * up - 1.1 * down - 0.2, 0, -0.1);
      setJ(p, 'lShoulder', -2.8 * up - 1.0 * down - 0.2, 0, 0.1);
      setJ(p, 'rElbow', -1.0 * up - 0.2);
      setJ(p, 'lElbow', -1.0 * up - 0.2);
      setJ(p, 'spine', 0.1 - 0.25 * up + 0.5 * down, 0, 0);
      setJ(p, 'lHip', -0.4 * down);
      setJ(p, 'lKnee', 0.4 * down + 0.1);
      setJ(p, 'rKnee', 0.1);
      p[ROOT + 1] = -0.07 * down;
      p[ROOT + 2] = 0.12 * down;
    },
  };
  return { parts, clips };
}

// ------------------------------------------------------------------ ghoul
export function buildGhoul() {
  const skin = 0x6e6e60;
  const parts = buildHumanoid({
    hipY: 0.9,
    pelvis: [0.24, 0.12, 0.16],
    waist: [0.22, 0.15],
    chest: [0.34, 0.21],
    torsoLen: 0.52,
    head: [0.16, 0.2, 0.24],
    headShape: { nose: 0.15, jaw: 1.4, muzzle: 0.14 },
    shoulderX: 0.16,
    upperArm: 0.37, foreArm: 0.36, armW: 0.07, handW: 0.09,
    legW: 0.105, hipX: 0.08, thigh: 0.45, shin: 0.44,
    neckR: 0.036,
    colors: { torso: skin, arms: skin, legs: 0x4a4038, pelvis: 0x3a3028, skin, shoes: skin },
    face: 'faceGhoul', faceGlow: 'faceGhoulGlow',
    ears: false,
    extras(p, spec) {
      const j = p.joints, T = p.surf.torso, L = spec.torsoLen;
      // ribs showing through the skin, and a ridge of spine
      const bone = S(0x58584c);
      for (let i = 0; i < 4; i++) {
        const y = L * 0.38 + i * 0.055;
        plate(j.spine, bone, T, [[y, -1.1, 1.1], [y + 0.016, -1.05, 1.05]], 8, 0.004);
      }
      for (let i = 0; i < 5; i++) {
        const b = surfacePoint(T, 0.08 + i * 0.09, Math.PI, 0.004);
        add(j.spine, loft([[0.02, 0, 0], [0.0, 0.014, 0.012], [-0.02, 0, 0]], 5), bone, b.x, b.y, b.z);
      }
      // long pointed ears
      for (const sx of [-1, 1]) {
        const ear = onHead(p, new THREE.ConeGeometry(0.028, 0.13, 5), S(skin), sx * 0.95, 0.35, -0.25, -0.35);
        ear.rotation.z = -sx * 0.7;
      }
      // claws
      for (const side of ['l', 'r']) {
        for (let k = -1; k <= 1; k++) {
          const cl = add(j[side + 'Elbow'], new THREE.ConeGeometry(0.011, 0.11, 4), C(0x1a1610), 0, -spec.foreArm - 0.14, k * 0.022 + 0.01);
          cl.rotation.x = Math.PI + 0.3;
        }
      }
    },
  });
  return { parts, clips: ghoulClips() };
}

// ------------------------------------------------------------------ ghosts
export function ghostMaterial(color = 0x8098c0) {
  return new THREE.MeshLambertMaterial({
    color: new THREE.Color(color).multiplyScalar(0.35),
    emissive: new THREE.Color(color).multiplyScalar(0.22),
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export function buildGhost({ dress = false, color = 0x8098c0 } = {}) {
  const gm = ghostMaterial(color);
  const parts = buildHumanoid({
    colors: { torso: gm, arms: gm, legs: gm, pelvis: gm, skin: gm, shoes: gm, hair: gm },
    face: 'faceGhost',
    head: dress ? [0.17, 0.215, 0.19] : [0.19, 0.23, 0.21],
    chest: dress ? [0.34, 0.21] : [0.44, 0.25],
    waist: dress ? [0.25, 0.17] : [0.32, 0.2],
    bust: dress ? 0.016 : 0,
    shoulderX: dress ? 0.17 : 0.2,
    armW: dress ? 0.08 : 0.1,
    hair: dress ? { front: 0.42, side: 0.0, back: -0.62, thick: 0.01 } : { front: 0.55 },
    extras(p) {
      const j = p.joints;
      if (dress) {
        add(j.hips, loft([[0.09, 0.13, 0.095], [-0.1, 0.2, 0.16], [-0.5, 0.29, 0.24], [-0.88, 0.36, 0.3]], 14, { caps: false }), gm);
        onHead(p, loft([[0.04, 0, 0], [0.026, 0.044, 0.04], [-0.02, 0.046, 0.04], [-0.036, 0, 0]], 8), gm, 0, 0.2, -1.05);
        for (const n of ['lHip', 'rHip']) j[n].visible = false;
      }
    },
  });
  parts.ghostMats = [gm, parts.faceMat];
  // Lay down the ghost's depth first so only its front-most surface glows,
  // instead of every overlapping limb adding up.
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
  const meshes = [];
  parts.root.traverse((o) => { if (o.isMesh) { o.castShadow = false; meshes.push(o); } });
  for (const m of meshes) {
    const d = new THREE.Mesh(m.geometry, depthOnly);
    d.position.copy(m.position);
    d.quaternion.copy(m.quaternion);
    d.scale.copy(m.scale);
    m.parent.add(d);
  }
  return { parts, clips: ghostClips() };
}

// ------------------------------------------------------------------ drowned arm
// A drowned arm with a hand of jointed fingers: curl them by rotating the
// segments about x (the palm faces +z). Rises from the bathtub, and reaches
// out of the thing in the pool.
export function buildDrownedArm({ skinColor = 0x93a294 } = {}) {
  const skin = C(skinColor, { phong: true, flat: false, shininess: 70, specular: 0x4a5a4a });
  const nailM = C(0x231f1a, { flat: false });
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
  return { root, wrist, fingers, thumb };
}

// ------------------------------------------------------------------ the vine
// What became of the gardener: a mound of black weed out of the South Seas,
// grown up through him. His face and one hand still show through it. The
// weed's materials are its own, so it can wither on its own.
export function buildVineMass() {
  const root = new THREE.Group();
  const R = rng(41);
  const weed = new THREE.MeshPhongMaterial({ color: 0x16301e, shininess: 50, specular: 0x2a4a3a });
  const weedDark = new THREE.MeshLambertMaterial({ color: 0x0c1a0f });
  const mesh = (geo, m, parent) => {
    const me = new THREE.Mesh(geo, m);
    me.castShadow = true;
    parent.add(me);
    return me;
  };
  const mound = mesh(new THREE.SphereGeometry(0.95, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), weedDark, root);
  mound.scale.set(1, 0.55, 1);
  // fronds: tapering stalks out of the mound, jointed so they can sway
  const fronds = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + R() * 0.4, rr = 0.25 + R() * 0.55;
    const base = new THREE.Group();
    base.position.set(Math.cos(a) * rr, 0.22, Math.sin(a) * rr);
    base.rotation.set(Math.sin(a) * 0.35 + (R() - 0.5) * 0.3, 0, -Math.cos(a) * 0.35 + (R() - 0.5) * 0.3);
    root.add(base);
    const n = 5, len = 1.0 + R() * 1.1;
    const segs = [];
    let parent = base;
    for (let k = 0; k < n; k++) {
      const sg = new THREE.Group();
      sg.position.y = k === 0 ? 0 : len / n;
      parent.add(sg);
      const r0 = 0.07 * (1 - k / n) + 0.012, r1 = 0.07 * (1 - (k + 1) / n) + 0.012;
      mesh(loft([[-0.01, r0, r0 * 0.7], [len / n + 0.01, r1, r1 * 0.7]], 6), weed, sg);
      segs.push(sg);
      parent = sg;
    }
    fronds.push({ base, segs, ph: R() * 10, sx: Math.cos(a), sz: Math.sin(a) });
  }
  // the gardener, his face pressed up through the weed, one hand reaching
  const skin = C(0x8e9a90, { flat: false });
  const head = mesh(headGeo({ w: 0.19, h: 0.23, d: 0.21 }), [new THREE.MeshLambertMaterial({ map: tex('faceAgony') }), skin, skin], root);
  head.position.set(0.12, 0.6, 0.62);
  head.rotation.set(-0.35, 0.25, 0.2);
  const arm = buildDrownedArm({ skinColor: 0x8e9a90 });
  arm.root.position.set(-0.4, 0.3, 0.62);
  arm.root.rotation.set(1.0, 0.2, 0.45);
  root.add(arm.root);
  // pale bulbs at the frond tips, like eyes
  const bulbs = [];
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Sprite(spriteMat('glow', 0xd0e070, 0.6));
    sp.scale.setScalar(0.14);
    const f = fronds[i * 2];
    f.segs[f.segs.length - 1].add(sp);
    sp.position.y = 0.22;
    sp.userData.ph = R() * 6;
    bulbs.push(sp);
  }
  return { root, fronds, head, arm, bulbs, weed, weedDark, mound };
}

// ------------------------------------------------------------------ crawler
// A low, many-legged thing for the cellar. Its own tiny rig.
export function buildCrawler() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.32;
  root.add(body);
  const skin = C(0x3a3428);
  const thorax = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), skin);
  thorax.scale.set(1.0, 0.6, 1.4);
  thorax.castShadow = true;
  body.add(thorax);
  const abd = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), C(0x2a2018));
  abd.scale.set(1.1, 0.75, 1.3);
  abd.position.set(0, 0.04, -0.42);
  abd.castShadow = true;
  body.add(abd);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), skin);
  head.position.set(0, 0.02, 0.36);
  body.add(head);
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), C(0xff3020, { basic: true }));
      e.position.set(sx * (0.04 + k * 0.035), 0.06 - k * 0.02, 0.47);
      body.add(e);
    }
  }
  const legs = [];
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? 1 : -1;
    const k = i % 3;
    const hip = new THREE.Group();
    hip.position.set(side * 0.18, 0, 0.18 - k * 0.2);
    body.add(hip);
    const upper = new THREE.Mesh(frustum(0.05, 0.05, 0.035, 0.035, 0.38), skin);
    upper.rotation.z = -side * 1.1;
    hip.add(upper);
    const knee = new THREE.Group();
    knee.position.set(side * 0.38 * Math.sin(1.1), 0.38 * Math.cos(1.1), 0);
    hip.add(knee);
    const lower = new THREE.Mesh(frustum(0.035, 0.035, 0.01, 0.01, -0.55), C(0x1e1a14));
    lower.rotation.z = side * 0.35;
    knee.add(lower);
    legs.push({ hip, side, k });
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, body, legs, head };
}

// ------------------------------------------------------------------ the thing in the pool
// A heaving mass of dark wet flesh: lumps and folds, pale veins, bony
// spines, a slit maw of needle teeth that opens on a red glow, a cluster of
// yellow slit-pupilled eyes, and the drowned of Ashcombe still in it: faces
// sunk into the flesh, arms reaching out of it.
export function buildHorror() {
  const root = new THREE.Group();
  const core = new THREE.Group();
  root.add(core);
  const rand = rng(666);
  const lumps = [];
  const lump = (n, a0, a1, w0, w1) => {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
      lumps.push({ v, a: a0 + rand() * (a1 - a0), w: w0 + rand() * (w1 - w0) });
    }
  };
  lump(7, 0.2, 0.45, 0.12, 0.3); // great swollen lobes
  lump(30, 0.06, 0.18, 0.025, 0.09); // tumours
  lump(60, 0.02, 0.06, 0.006, 0.02); // pustules and knots
  const C0 = new THREE.Vector3(0, 1.3, 0); // centre of the mass
  const SC = new THREE.Vector3(1.15, 1.6, 1.0);
  const MAW = new THREE.Vector3(0, 0.32, 1).normalize();
  const radius = (d) => {
    let r = 1;
    for (const l of lumps) r += l.a * Math.exp(-(1 - d.dot(l.v)) / l.w);
    r += 0.04 * Math.sin(d.x * 9 + d.y * 4) * Math.sin(d.z * 8 - d.y * 6);
    r += 0.018 * Math.sin(d.x * 23 + d.z * 17) * Math.sin(d.y * 29 - d.x * 11); // wrinkles
    // a groove down the front where the maw splits the body
    const m = 1 - d.dot(MAW);
    if (m < 0.35 && d.z > 0) r -= 0.12 * Math.exp(-(d.x * d.x) / 0.004) * (1 - m / 0.35);
    return r;
  };
  // surface point for a direction from the centre: hunched forward, leaning left
  const place = (d, r = radius(d)) => {
    const p = d.clone().multiplyScalar(r).multiply(SC);
    if (p.y > 0) { p.z += 0.2 * p.y * p.y; p.x -= 0.06 * p.y * p.y; }
    return p.add(C0);
  };
  const ico = new THREE.IcosahedronGeometry(1, 22); // ~5000 vertices: enough for tumours and wrinkles
  ico.deleteAttribute('normal');
  ico.deleteAttribute('uv');
  const geo = mergeVertices(ico);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const base = new THREE.Color(0x3e2a2c), dark = new THREE.Color(0x0a0506), vein = new THREE.Color(0x8a90a0), raw = new THREE.Color(0x7a1c16);
  const c = new THREE.Color(), d = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    const r = radius(d);
    const p = place(d, r);
    pos.setXYZ(i, p.x, p.y, p.z);
    c.copy(dark).lerp(base, Math.min(1, Math.max(0, 0.35 + (r - 1) * 3)));
    const v = Math.abs(Math.sin(p.x * 7 + Math.sin(p.y * 5) * 1.6 + p.z * 3));
    if (v < 0.07) c.lerp(vein, 0.7 * (1 - v / 0.07));
    const m = 1 - d.dot(MAW);
    if (m < 0.25) c.lerp(raw, 0.8 * (1 - m / 0.25));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const fleshM = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 60, specular: 0x6a6070 });
  const mass = new THREE.Mesh(geo, fleshM);
  mass.castShadow = true;
  core.add(mass);
  const add = (g, m, parent = core) => { const me = new THREE.Mesh(g, m); me.castShadow = true; parent.add(me); return me; };
  // orient a group so its +z points along the surface normal at `at`
  const onSurface = (at, outward, depth = 0) => {
    const g = new THREE.Group();
    g.position.copy(at).addScaledVector(outward, -depth);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), outward);
    core.add(g);
    return g;
  };
  const normalAt = (dir) => {
    const e = 0.04;
    const u = Math.abs(dir.y) < 0.95 ? new THREE.Vector3(0, 1, 0).cross(dir).normalize() : new THREE.Vector3(1, 0, 0);
    const w = dir.clone().cross(u).normalize();
    const a = place(dir);
    const t1 = place(dir.clone().addScaledVector(u, e).normalize()).sub(a);
    const t2 = place(dir.clone().addScaledVector(w, e).normalize()).sub(a);
    const nrm = t1.cross(t2).normalize();
    return nrm.dot(dir) < 0 ? nrm.negate() : nrm;
  };

  // the maw: a slit down the front, red within, lined with needle teeth
  const mawAt = place(MAW);
  const maw = onSurface(mawAt, normalAt(MAW), 0.02);
  const throat = add(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshLambertMaterial({ color: 0x1a0204, emissive: 0x7a0a08 }), maw);
  throat.scale.set(0.12, 0.66, 0.24);
  throat.position.z = -0.1;
  // swollen lips along the split
  const lipM = new THREE.MeshPhongMaterial({ color: 0x4a1418, shininess: 70, specular: 0x6a4040 });
  const bone = C(0xbcae8a, { phong: true, flat: false, shininess: 50 });
  const rows = [];
  for (const sx of [-1, 1]) {
    const row = new THREE.Group();
    maw.add(row);
    const lip = add(loft([[-0.66, 0, 0], [-0.55, 0.05, 0.05], [0, 0.07, 0.07], [0.55, 0.05, 0.05], [0.66, 0, 0]], 6), lipM, row);
    lip.position.set(sx * 0.03, 0, 0.04);
    for (let i = 0; i < 15; i++) {
      const y = -0.56 + i * 0.08;
      const len = 0.12 + 0.14 * Math.sin((i / 14) * Math.PI) + rand() * 0.05;
      const tooth = add(new THREE.ConeGeometry(0.024, len, 4), bone, row);
      tooth.position.set(-sx * len * 0.35, y, 0.06);
      // jutting forward out of the lips and across the gap
      tooth.rotation.z = sx * (Math.PI / 2 + 0.15) + (rand() - 0.5) * 0.35;
      tooth.rotation.x = -0.35 + (rand() - 0.5) * 0.3;
    }
    row.userData.side = sx;
    rows.push(row);
  }
  const mawLight = new THREE.PointLight(0xff2a10, 2.5, 2.6, 2);
  mawLight.position.set(0, 0, 0.3);
  maw.add(mawLight);

  // eyes: yellow, slit-pupilled, sunk in dark sockets, all sizes
  const sclera = new THREE.MeshPhongMaterial({ color: 0xc0aa44, emissive: 0x2a2004, shininess: 110, specular: 0x666644 });
  const irisM = new THREE.MeshPhongMaterial({ color: 0x8a2a06, emissive: 0x200400, shininess: 90 });
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const socketM = new THREE.MeshPhongMaterial({ color: 0x0a0c0a, shininess: 40 });
  const eyes = [];
  const EYES = [[-0.42, 0.62, 0.66, 0.19], [0.38, 0.56, 0.72, 0.14], [0.1, 0.86, 0.5, 0.12], [-0.7, 0.3, 0.64, 0.08], [0.72, 0.18, 0.66, 0.09],
    [-0.28, 0.95, 0.15, 0.07], [0.5, 0.88, 0.2, 0.06], [-0.85, 0.55, 0.2, 0.06], [0.88, 0.5, 0.25, 0.07], [0.02, 0.05, 1.0, 0.06], [-0.2, 0.42, 0.88, 0.05]];
  for (const [x, y, z, r] of EYES) {
    const dir = new THREE.Vector3(x, y, z).normalize();
    const n = normalAt(dir);
    const socket = onSurface(place(dir), n, r * 0.45);
    const ring = add(new THREE.TorusGeometry(r * 1.02, r * 0.32, 6, 14), socketM, socket);
    ring.position.z = r * 0.25;
    const ball = new THREE.Group();
    socket.add(ball);
    add(new THREE.SphereGeometry(r, 12, 10), sclera, ball);
    const iris = add(new THREE.SphereGeometry(r * 0.62, 10, 8), irisM, ball);
    iris.scale.z = 0.35;
    iris.position.z = r * 0.82;
    const pupil = add(new THREE.BoxGeometry(r * 0.16, r * 1.05, r * 0.12), black, ball);
    pupil.position.z = r * 0.98;
    ball.userData.blinkT = rand() * 6;
    eyes.push(ball);
  }

  // the drowned, sunk into it: faces and reaching arms
  const faceM = new THREE.MeshLambertMaterial({ map: tex('faceAgony'), color: 0xc8b4b0 });
  const pale = C(0x7e7270, { flat: false });
  const faces = [];
  for (const [x, y, z, tilt] of [[-0.72, -0.15, 0.68, 0.5], [0.66, -0.3, 0.72, -0.4], [0.32, 0.05, 0.94, 0.2], [-0.35, -0.45, 0.86, -0.3]]) {
    const dir = new THREE.Vector3(x, y, z).normalize();
    const g = onSurface(place(dir), normalAt(dir), 0.075);
    const h = add(headGeo({ w: 0.2, h: 0.24, d: 0.21, nose: 0.8 }), [faceM, pale, pale], g);
    h.rotation.set(-0.15, 0, tilt);
    faces.push(g);
  }
  const arms = [];
  for (const [x, y, z, roll] of [[-0.9, -0.35, 0.4, 0.4], [0.92, -0.2, 0.35, -0.5], [-0.55, -0.55, 0.78, 0.9], [0.6, -0.6, 0.7, -0.7], [-0.1, -0.7, 0.95, 0.1]]) {
    const dir = new THREE.Vector3(x, y, z).normalize();
    const g = onSurface(place(dir), normalAt(dir), 0.06);
    const a = buildDrownedArm({ skinColor: 0x8a9488 });
    a.root.scale.setScalar(1.4);
    // the arm's own +y points out of the flesh, reaching up and forward
    a.root.rotation.set(Math.PI / 2 - 0.5, 0, roll);
    g.add(a.root);
    a.phase = rand() * 10;
    a.baseRot = a.root.rotation.clone();
    arms.push(a);
  }

  // spines along the back and crown
  const spineM = C(0x2a241c, { phong: true, flat: false, shininess: 40 });
  for (let i = 0; i < 9; i++) {
    const a = -1.2 + i * 0.3 + (rand() - 0.5) * 0.15;
    const dir = new THREE.Vector3(Math.sin(a) * 0.6, 0.75 + rand() * 0.2, -0.55 - rand() * 0.2).normalize();
    const g = onSurface(place(dir), normalAt(dir), 0.05);
    const len = 0.35 + rand() * 0.55;
    const sp = add(new THREE.ConeGeometry(0.05 + len * 0.06, len, 6), spineM, g);
    sp.rotation.x = Math.PI / 2 - 0.5;
    sp.position.z = len * 0.4;
  }

  // tentacles: chains of tapered, wet segments ending in bone hooks
  const tentM = new THREE.MeshPhongMaterial({ color: 0x32222a, shininess: 60, specular: 0x6a6070 });
  const tentacles = [];
  const nT = 9, n = 9;
  for (let i = 0; i < nT; i++) {
    const a = (i / nT) * Math.PI * 2 + 0.2;
    const tb = new THREE.Group();
    tb.position.set(Math.cos(a) * 1.0, 0.45 + (i % 3) * 0.3, Math.sin(a) * 0.85);
    tb.rotation.y = -a + Math.PI / 2;
    core.add(tb);
    const segs = [];
    let parent = tb;
    for (let k = 0; k < n; k++) {
      const s = new THREE.Group();
      s.position.y = k === 0 ? 0 : 0.3;
      parent.add(s);
      const r0 = 0.15 * (1 - k / n) + 0.025, r1 = 0.15 * (1 - (k + 1) / n) + 0.025;
      add(loft([[-0.02, r0, r0 * 0.85], [0.15, (r0 + r1) / 2 * 1.04, (r0 + r1) / 2 * 0.86], [0.32, r1, r1 * 0.85]], 7), tentM, s);
      segs.push(s);
      parent = s;
    }
    const hook = add(new THREE.ConeGeometry(0.03, 0.22, 5), bone, parent);
    hook.position.y = 0.38;
    hook.rotation.x = 0.6;
    tentacles.push({ base: tb, segs, phase: i * 1.3, angle: a });
  }
  return { root, core, mass, eyes, sclera, tentacles, maw: { group: maw, throat, rows, light: mawLight }, faces, arms, flesh: fleshM, tentacle: tentM, bone };
}
