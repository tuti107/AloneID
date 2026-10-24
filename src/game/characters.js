// Character models: the investigator, the household dead and worse things.
import * as THREE from 'three';
import { frustum } from '../engine/geom.js';
import { C, M } from './mats.js';
import { buildHumanoid, humanClips, zombieClips, ghoulClips, ghostClips, setJ, ROOT } from './rig.js';

function box(parent, m, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// ------------------------------------------------------------------ player
export function buildInvestigator() {
  const coat = 0x7a6440, coatDark = 0x5a4a2e;
  const parts = buildHumanoid({
    colors: { torso: coat, arms: coat, legs: 0x2a2520, pelvis: coat, skin: 0xc89a78, shoes: 0x16110d, hair: 0x2a1c12 },
    face: 'facePlayer',
    extras(p, spec) {
      const j = p.joints;
      const cm = C(coat), cd = C(coatDark);
      // fedora
      const hat = new THREE.Group();
      hat.position.set(0, spec.neckLen + spec.head[1] - 0.005, 0.01);
      j.neck.add(hat);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.014, 10), C(0x3a2c20));
      brim.castShadow = true;
      hat.add(brim);
      const crown = new THREE.Mesh(frustum(0.2, 0.2, 0.16, 0.15, 0.11), C(0x3a2c20));
      hat.add(crown);
      const band = new THREE.Mesh(frustum(0.205, 0.205, 0.2, 0.2, 0.03), C(0x14100c));
      band.position.y = 0.008;
      hat.add(band);
      p.hat = hat;
      // collar, tie, lapels, belt
      box(j.spine, C(0xd8d4c8), 0.13, 0.05, 0.02, 0, spec.torsoLen - 0.04, spec.chest[1] / 2 + 0.005);
      box(j.spine, C(0x7a1a1a), 0.04, 0.2, 0.012, 0, spec.torsoLen - 0.17, spec.chest[1] / 2 + 0.008);
      for (const sx of [-1, 1]) box(j.spine, cd, 0.07, 0.26, 0.02, sx * 0.08, spec.torsoLen - 0.18, spec.chest[1] / 2 - 0.005, 0, 0, sx * 0.25);
      box(j.spine, C(0x2a1e14), spec.waist[0] + 0.02, 0.05, spec.waist[1] + 0.02, 0, 0.06, 0);
      box(j.spine, C(0x8a7a4a), 0.05, 0.035, 0.01, 0, 0.065, spec.waist[1] / 2 + 0.012);
      // coat tails follow each thigh
      for (const side of ['l', 'r']) {
        const sx = side === 'l' ? 1 : -1;
        const tail = new THREE.Mesh(frustum(0.19, 0.27, 0.22, 0.31, -0.52), cm);
        tail.position.set(sx * 0.01, 0.06, -0.005);
        tail.castShadow = true;
        j[side + 'Hip'].add(tail);
      }
      // cuffs
      for (const side of ['l', 'r']) box(j[side + 'Elbow'], cd, 0.095, 0.04, 0.095, 0, -spec.foreArm + 0.03, 0);
    },
  });
  return { parts, clips: humanClips() };
}

// ------------------------------------------------------------------ zombies
export function buildButler() {
  const parts = buildHumanoid({
    colors: { torso: 0x18181c, arms: 0x18181c, legs: 0x1c1c20, pelvis: 0x18181c, skin: 0x7a8a6a, shoes: 0x080808, hair: 0x3a3a34 },
    face: 'faceZombie',
    extras(p, spec) {
      const j = p.joints;
      box(j.spine, C(0x8a8678), 0.16, 0.36, 0.02, 0, spec.torsoLen - 0.22, spec.chest[1] / 2 + 0.002);
      box(j.spine, C(0x5a0808), 0.1, 0.12, 0.022, 0.02, spec.torsoLen - 0.32, spec.chest[1] / 2 + 0.004);
      box(j.spine, C(0x050505), 0.09, 0.035, 0.03, 0, spec.torsoLen - 0.05, spec.chest[1] / 2 + 0.01);
      for (const sx of [-1, 1]) {
        const tail = box(j.hips, C(0x18181c), 0.13, 0.55, 0.03, sx * 0.08, -0.22, -0.12, 0.08, 0, sx * 0.05);
        void tail;
      }
      // eyes glow faintly
      for (const sx of [-1, 1]) box(j.neck, C(0xd8d090, { basic: true }), 0.025, 0.012, 0.01, sx * 0.045, spec.neckLen + spec.head[1] * 0.55, spec.head[2] / 2 + 0.012);
    },
  });
  return { parts, clips: zombieClips({ hunch: 0.25 }) };
}

export function buildMaid() {
  const dress = 0x1a1a22;
  const parts = buildHumanoid({
    chest: [0.38, 0.23], waist: [0.27, 0.19], head: [0.18, 0.22, 0.2],
    colors: { torso: dress, arms: dress, legs: 0x2a2a2e, pelvis: dress, skin: 0x7e8c72, shoes: 0x080808, hair: 0x2a1a12 },
    face: 'faceZombie',
    extras(p, spec) {
      const j = p.joints;
      const skirt = new THREE.Mesh(frustum(0.3, 0.24, 0.56, 0.48, -0.62), C(dress));
      skirt.position.y = 0.05;
      skirt.castShadow = true;
      j.hips.add(skirt);
      const apron = new THREE.Mesh(frustum(0.24, 0.02, 0.36, 0.02, -0.5), C(0x9a968a));
      apron.position.set(0, 0.02, 0.24);
      apron.rotation.x = -0.12;
      j.hips.add(apron);
      box(j.spine, C(0x9a968a), 0.2, 0.22, 0.02, 0, spec.torsoLen - 0.3, spec.chest[1] / 2 + 0.003);
      box(j.spine, C(0x6a0a0a), 0.08, 0.1, 0.022, 0.05, spec.torsoLen - 0.25, spec.chest[1] / 2 + 0.005);
      box(j.neck, C(0xd8d4c8), 0.2, 0.04, 0.12, 0, spec.neckLen + spec.head[1] + 0.01, 0.0);
      box(j.neck, C(0x2a1a12), 0.12, 0.1, 0.1, 0, spec.neckLen + spec.head[1] * 0.75, -0.12);
      for (const sx of [-1, 1]) box(j.neck, C(0xd8d090, { basic: true }), 0.024, 0.012, 0.01, sx * 0.042, spec.neckLen + spec.head[1] * 0.55, spec.head[2] / 2 + 0.012);
    },
  });
  return { parts, clips: zombieClips({ hunch: 0.3 }) };
}

export function buildSilas() {
  const parts = buildHumanoid({
    colors: { torso: 0xb8b2a0, arms: 0xb8b2a0, legs: 0x5a5650, pelvis: 0xb8b2a0, skin: 0x9aa08e, shoes: 0x2a2420, hair: 0xb0b0a8 },
    face: 'faceSilas',
    head: [0.19, 0.24, 0.21],
    extras(p, spec) {
      const j = p.joints;
      // long nightshirt
      for (const side of ['l', 'r']) {
        const sx = side === 'l' ? 1 : -1;
        const tail = new THREE.Mesh(frustum(0.19, 0.24, 0.21, 0.27, -0.42), C(0xb0aa98));
        tail.position.set(sx * 0.01, 0.05, 0);
        tail.castShadow = true;
        j[side + 'Hip'].add(tail);
      }
      // noose around the neck with a trailing end
      const rope = C(0x8a7a5a);
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.015, 3, 8), rope);
      loop.rotation.x = Math.PI / 2 + 0.2;
      loop.position.set(0, 0.04, 0);
      j.neck.add(loop);
      box(j.neck, rope, 0.025, 0.5, 0.025, 0.04, -0.2, -0.1, 0.4, 0, 0.2);
      // wild grey hair
      box(j.neck, C(0xb0b0a8), 0.21, 0.06, 0.2, 0, spec.neckLen + spec.head[1] + 0.005, 0);
      for (const sx of [-1, 1]) box(j.neck, C(0xb0b0a8), 0.03, 0.12, 0.16, sx * 0.105, spec.neckLen + spec.head[1] * 0.75, -0.02);
      for (const sx of [-1, 1]) box(j.neck, C(0xf0e8c0, { basic: true }), 0.025, 0.014, 0.01, sx * 0.045, spec.neckLen + spec.head[1] * 0.55, spec.head[2] / 2 + 0.012);
      box(j.spine, C(0x5a1010), 0.12, 0.2, 0.02, -0.06, spec.torsoLen - 0.3, spec.chest[1] / 2 + 0.003);
    },
  });
  const clips = zombieClips({ hunch: 0.15 });
  return { parts, clips };
}

export function buildCook() {
  const parts = buildHumanoid({
    hipY: 0.92,
    pelvis: [0.46, 0.16, 0.34],
    waist: [0.58, 0.42],
    chest: [0.56, 0.36],
    torsoLen: 0.58,
    shoulderX: 0.27,
    armW: 0.13, handW: 0.1,
    legW: 0.19, hipX: 0.13,
    head: [0.22, 0.24, 0.23],
    colors: { torso: 0xb8b4a8, arms: 0xb8b4a8, legs: 0x3a3a40, pelvis: 0xb8b4a8, skin: 0xb09a88, shoes: 0x101010, hair: 0x3a2a1a },
    face: 'faceCook',
    extras(p, spec) {
      const j = p.joints;
      // stained apron
      box(j.spine, C(0xd0ccc0), 0.42, 0.42, 0.02, 0, 0.12, spec.waist[1] / 2 + 0.01, -0.12);
      box(j.hips, C(0xd0ccc0), 0.46, 0.45, 0.02, 0, -0.28, 0.21);
      box(j.hips, C(0x6a0a0a), 0.2, 0.18, 0.025, 0.08, -0.2, 0.215);
      box(j.spine, C(0x6a0a0a), 0.15, 0.12, 0.025, -0.1, 0.3, spec.waist[1] / 2 + 0.02, -0.12);
      // toque
      const hat = new THREE.Mesh(frustum(0.2, 0.2, 0.26, 0.26, 0.22), C(0xe0dcd0));
      hat.position.set(0, spec.neckLen + spec.head[1] - 0.01, 0.01);
      j.neck.add(hat);
      for (const sx of [-1, 1]) box(j.neck, C(0xffe080, { basic: true }), 0.03, 0.014, 0.01, sx * 0.05, spec.neckLen + spec.head[1] * 0.55, spec.head[2] / 2 + 0.012);
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
    chest: [0.36, 0.22],
    torsoLen: 0.52,
    head: [0.16, 0.2, 0.24],
    shoulderX: 0.17,
    upperArm: 0.37, foreArm: 0.36, armW: 0.075, handW: 0.09,
    legW: 0.11, hipX: 0.08, thigh: 0.45, shin: 0.44,
    colors: { torso: skin, arms: skin, legs: 0x4a4038, pelvis: 0x3a3028, skin, shoes: skin, hair: 0x4a4a40 },
    extras(p, spec) {
      const j = p.joints;
      // ribs
      for (let i = 0; i < 3; i++) box(j.spine, C(0x58584c), spec.chest[0] * 0.9, 0.02, 0.01, 0, 0.22 + i * 0.08, spec.chest[1] / 2 - 0.01);
      // ears, eyes, jaw
      const hy = spec.neckLen + spec.head[1] * 0.5;
      for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), C(skin));
        ear.position.set(sx * 0.09, hy + 0.06, -0.02);
        ear.rotation.set(-0.3, 0, -sx * 0.6);
        j.neck.add(ear);
        box(j.neck, C(0xffd040, { basic: true }), 0.03, 0.016, 0.01, sx * 0.04, hy + 0.025, spec.head[2] / 2 + 0.012);
      }
      box(j.neck, C(0x200808), 0.1, 0.03, 0.02, 0, hy - 0.06, spec.head[2] / 2 + 0.005);
      for (let i = -2; i <= 2; i++) box(j.neck, C(0xd8d0b0), 0.012, 0.02, 0.01, i * 0.018, hy - 0.05, spec.head[2] / 2 + 0.012);
      // claws
      for (const side of ['l', 'r']) {
        for (let k = -1; k <= 1; k++) {
          const cl = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.12, 3), C(0x1a1610));
          cl.position.set(k * 0.03, -spec.foreArm - 0.14, 0.02);
          cl.rotation.x = Math.PI + 0.3;
          j[side + 'Elbow'].add(cl);
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
    flatShading: true,
    blending: THREE.AdditiveBlending,
  });
}

export function buildGhost({ dress = false, color = 0x8098c0, seed = 0 } = {}) {
  const gm = ghostMaterial(color);
  const parts = buildHumanoid({
    colors: { torso: gm, arms: gm, legs: gm, pelvis: gm, skin: gm, shoes: gm, hair: gm },
    head: dress ? [0.17, 0.22, 0.19] : [0.19, 0.23, 0.21],
    chest: dress ? [0.36, 0.22] : [0.44, 0.25],
    waist: dress ? [0.26, 0.18] : [0.32, 0.2],
    extras(p, spec) {
      const j = p.joints;
      if (dress) {
        const skirt = new THREE.Mesh(frustum(0.3, 0.22, 0.72, 0.6, -0.92), gm);
        skirt.position.y = 0.05;
        j.hips.add(skirt);
        box(j.neck, gm, 0.12, 0.1, 0.12, 0, spec.neckLen + spec.head[1] + 0.03, -0.06);
        for (const n of ['lHip', 'rHip']) j[n].visible = false;
      } else {
        // tailcoat & bow tie suggestion
        for (const sx of [-1, 1]) box(j.hips, gm, 0.13, 0.5, 0.03, sx * 0.08, -0.2, -0.12);
      }
      const eyeM = C(0x000000, { basic: true });
      for (const sx of [-1, 1]) box(j.neck, eyeM, 0.035, 0.03, 0.01, sx * 0.045, spec.neckLen + spec.head[1] * 0.55, spec.head[2] / 2 + 0.008);
      box(j.neck, eyeM, 0.05, 0.06, 0.01, 0, spec.neckLen + spec.head[1] * 0.22, spec.head[2] / 2 + 0.008);
    },
  });
  parts.ghostMat = gm;
  parts.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  void seed;
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
