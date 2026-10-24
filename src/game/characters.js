// Character models: the investigator, the household dead and worse things.
// Clothing is built on the body's own surface (body.js), so collars, lapels,
// aprons and coat skirts follow its curves instead of floating as plates.
import * as THREE from 'three';
import { frustum } from '../engine/geom.js';
import { C } from './mats.js';
import { buildHumanoid, humanClips, zombieClips, ghoulClips, ghostClips, setJ, ROOT } from './rig.js';
import { loft, shell, ringAt, surfacePoint } from './body.js';

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
export function buildHorror() {
  const root = new THREE.Group();
  const flesh = C(0x2a3a30, { phong: true, shininess: 70, specular: 0x557766 });
  const dark = C(0x101810, { phong: true, shininess: 40 });
  const core = new THREE.Group();
  root.add(core);
  const mass = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 1), flesh);
  mass.scale.set(1.2, 1.5, 1.0);
  mass.position.y = 1.2;
  core.add(mass);
  const mass2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), dark);
  mass2.position.set(0.3, 2.3, -0.1);
  core.add(mass2);
  // eyes
  const eyes = [];
  const eyeData = [[0, 1.6, 0.9, 0.22], [-0.45, 1.25, 0.8, 0.12], [0.5, 1.9, 0.7, 0.1], [0.25, 2.5, 0.45, 0.09], [-0.3, 2.0, 0.75, 0.08]];
  for (const [x, y, z, r] of eyeData) {
    const ew = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), C(0xd8d8b0, { basic: true }));
    ew.position.set(x, y, z);
    core.add(ew);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(r * 0.45, 6, 4), C(0x000000, { basic: true }));
    pupil.position.set(0, 0, r * 0.75);
    ew.add(pupil);
    eyes.push(ew);
  }
  // mouth
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.1), C(0x300808, { basic: true }));
  mouth.position.set(0, 1.0, 1.02);
  core.add(mouth);
  for (let i = -3; i <= 3; i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 3), C(0xd8d0b0));
    tooth.position.set(i * 0.09, 1.1, 1.05);
    tooth.rotation.x = Math.PI;
    core.add(tooth);
  }
  // tentacles: chains of segments
  const tentacles = [];
  const nT = 7;
  for (let i = 0; i < nT; i++) {
    const a = (i / nT) * Math.PI * 2 + 0.3;
    const base = new THREE.Group();
    base.position.set(Math.cos(a) * 0.9, 0.6 + (i % 2) * 0.5, Math.sin(a) * 0.7);
    base.rotation.y = -a + Math.PI / 2;
    core.add(base);
    const segs = [];
    let parent = base;
    const n = 8;
    for (let k = 0; k < n; k++) {
      const s = new THREE.Group();
      s.position.y = k === 0 ? 0 : 0.32;
      parent.add(s);
      const r0 = 0.16 * (1 - k / n) + 0.02;
      const m = new THREE.Mesh(frustum(r0 * 2, r0 * 2, r0 * 1.7, r0 * 1.7, 0.34), k % 2 ? flesh : dark);
      s.add(m);
      segs.push(s);
      parent = s;
    }
    tentacles.push({ base, segs, phase: i * 1.3, angle: a });
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, core, mass, eyes, tentacles, mouth };
}
