// Jointed low-poly humanoids and a small procedural animation system.
// Poses are flat Float32Arrays: 3 euler angles per joint + root offset xyz.
import * as THREE from 'three';
import { loft, pelvisRings, torsoRings, neckRings, upperArmRings, foreArmRings, handGeo, thighRings, shinRings, shoeGeo, headGeo, earGeo } from './body.js';
import { C, M } from './mats.js';
import { tex } from '../engine/textures.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const JOINTS = ['hips', 'spine', 'neck', 'lShoulder', 'lElbow', 'rShoulder', 'rElbow', 'lHip', 'lKnee', 'rHip', 'rKnee'];
export const J = Object.fromEntries(JOINTS.map((n, i) => [n, i * 3]));
export const ROOT = JOINTS.length * 3;
export const POSE_SIZE = ROOT + 3;

export function newPose() { return new Float32Array(POSE_SIZE); }
export function setJ(p, name, x = 0, y = 0, z = 0) {
  const i = J[name];
  p[i] = x; p[i + 1] = y; p[i + 2] = z;
}
export function addJ(p, name, x = 0, y = 0, z = 0) {
  const i = J[name];
  p[i] += x; p[i + 1] += y; p[i + 2] += z;
}

const DEFAULT_SPEC = {
  hipY: 0.94,
  pelvis: [0.32, 0.14, 0.2],
  torsoLen: 0.56,
  waist: [0.32, 0.2],
  chest: [0.44, 0.25],
  neckLen: 0.1,
  head: [0.19, 0.23, 0.21],
  shoulderX: 0.2,
  upperArm: 0.3, foreArm: 0.27, armW: 0.105, handW: 0.08,
  hipX: 0.095,
  thigh: 0.45, shin: 0.44, legW: 0.15,
  foot: [0.11, 0.08, 0.25],
  colors: { torso: 0x6a5a3a, arms: 0x6a5a3a, legs: 0x2e2a26, skin: 0xc89a78, shoes: 0x141210, pelvis: 0x2e2a26 },
  face: null,
};

// Build a humanoid. extras(parts, spec) can add accessories; parts.surf
// holds the rings of the body parts so clothing can follow them.
export function buildHumanoid(spec0 = {}) {
  const spec = { ...DEFAULT_SPEC, ...spec0, colors: { ...DEFAULT_SPEC.colors, ...(spec0.colors || {}) } };
  const col = spec.colors;
  // smooth-shaded: the parts are rounded now, not boxes
  const matOf = (c) => (typeof c === 'number' ? C(c, { ...(spec.matOpts || {}), flat: false }) : c);
  const root = new THREE.Group();
  const joints = {};
  const mk = (name, parent, x, y, z) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    parent.add(g);
    joints[name] = g;
    return g;
  };
  const mesh = (geo, m, parent, x = 0, y = 0, z = 0) => {
    const me = new THREE.Mesh(geo, Array.isArray(m) ? m : matOf(m));
    me.position.set(x, y, z);
    me.castShadow = true;
    me.receiveShadow = true;
    parent.add(me);
    return me;
  };
  const surf = {
    pelvis: pelvisRings(spec), torso: torsoRings(spec),
    upperArm: upperArmRings(spec), foreArm: foreArmRings(spec), thigh: thighRings(spec), shin: shinRings(spec),
  };
  const hips = mk('hips', root, 0, spec.hipY, 0);
  mesh(loft(surf.pelvis, 12), col.pelvis, hips);
  const spine = mk('spine', hips, 0, 0.03, 0);
  mesh(loft(surf.torso, 12), col.torso, spine);
  const neck = mk('neck', spine, 0, spec.torsoLen, 0);
  mesh(loft(neckRings(spec), 8), col.neck ?? col.skin, neck);
  // head: sculpted, face projected on the front, hair pushed out a little
  const [hw, hh, hd] = spec.head;
  const hairCol = col.hair ?? col.skin;
  const hs = { w: hw, h: hh, d: hd, ...(spec.headShape || {}) };
  if (spec.hair !== false && col.hair !== undefined) hs.hair = { front: 0.5, side: 0.16, back: -0.5, thick: 0.007, ...(spec.hair || {}) };
  const skinM = matOf(col.skin);
  let faceM = skinM;
  if (spec.face) {
    if (skinM.isMaterial && typeof col.skin !== 'number') {
      faceM = skinM.clone();
      faceM.map = tex(spec.face);
      if (faceM.blending === THREE.AdditiveBlending) faceM.emissiveMap = faceM.map;
    } else {
      faceM = new THREE.MeshLambertMaterial({ map: tex(spec.face), ...(spec.faceOpts || {}) });
      if (spec.faceGlow) { faceM.emissiveMap = tex(spec.faceGlow); faceM.emissive = new THREE.Color(0xffffff); }
    }
  }
  const head = mesh(headGeo(hs), [faceM, skinM, matOf(hairCol)], neck, 0, spec.neckLen + hh / 2 - 0.02, 0.01);
  head.receiveShadow = false;
  if (spec.ears !== false) for (const sx of [-1, 1]) mesh(earGeo(hs, sx), col.skin, head);
  const parts = { root, joints, head, spec, surf, faceMat: faceM };
  for (const side of ['l', 'r']) {
    const sx = side === 'l' ? 1 : -1;
    const sh = mk(side + 'Shoulder', spine, sx * spec.shoulderX, spec.torsoLen - 0.06, 0);
    mesh(loft(surf.upperArm, 8), col.arms, sh);
    const el = mk(side + 'Elbow', sh, 0, -spec.upperArm, 0);
    mesh(loft(surf.foreArm, 8), col.forearms ?? col.arms, el);
    mesh(handGeo(spec, sx), col.hands ?? col.skin, el, 0, -spec.foreArm, 0);
    const grip = new THREE.Group();
    grip.position.set(0, -spec.foreArm - 0.07, 0.0);
    el.add(grip);
    parts[side + 'Grip'] = grip;
    const hp = mk(side + 'Hip', hips, sx * spec.hipX, 0, 0);
    mesh(loft(surf.thigh, 8), col.legs, hp);
    const kn = mk(side + 'Knee', hp, 0, -spec.thigh, 0);
    mesh(loft(surf.shin, 8), col.shins ?? col.legs, kn);
    // sole on the floor: the knee sits hipY - thigh above it
    mesh(shoeGeo(spec), col.shoes, kn, 0, -(spec.hipY - spec.thigh) + 0.004, 0);
  }
  if (spec.extras) spec.extras(parts, spec, { mesh, matOf });
  weld(parts);
  // order joints for pose application
  parts.list = JOINTS.map((n) => joints[n]);
  parts.hipBase = hips.position.clone();
  return parts;
}

// Weld everything riding on each joint into one mesh per material, plain
// colours turned into vertex colours: a body costs about a dozen draw
// calls (and shadow passes) instead of fifty. The head keeps its face
// material, and what the hands hold stays separate.
const VC_MATS = {};
function vcMaterial(side) {
  return (VC_MATS[side] ??= new THREE.MeshLambertMaterial({ vertexColors: true, side }));
}
function weld(parts) {
  parts.root.updateMatrixWorld(true);
  const joints = new Set(Object.values(parts.joints));
  const keep = new Set([parts.lGrip, parts.rGrip]);
  const inv = new THREE.Matrix4();
  for (const j of joints) {
    const list = [];
    const walk = (o) => {
      for (const c of o.children) {
        if (joints.has(c) || keep.has(c)) continue;
        if (c.isMesh && !Array.isArray(c.material)) list.push(c);
        walk(c);
      }
    };
    walk(j);
    // plain Lambert colours share one vertex-coloured material; anything
    // else (textures, ghosts, shine) merges only with its own material
    const groups = new Map();
    for (const m of list) {
      const mat = m.material;
      const plain = mat.isMeshLambertMaterial && !mat.map && !mat.transparent && mat.emissive.getHex() === 0;
      const key = plain ? 'vc' + mat.side : mat;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(m);
    }
    inv.copy(j.matrixWorld).invert();
    for (const [key, ms] of groups) {
      const plain = typeof key === 'string';
      if (ms.length < 2 && !plain) continue;
      const geos = ms.map((m) => {
        const src = m.geometry;
        const g = new THREE.BufferGeometry();
        for (const a of ['position', 'normal', 'uv']) {
          const at = src.attributes[a];
          g.setAttribute(a, at ? at.clone() : new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
        }
        if (!src.attributes.normal) g.computeVertexNormals();
        const n = g.attributes.position.count;
        g.setIndex(src.index ? src.index.clone() : [...Array(n).keys()]);
        if (plain) {
          const c = m.material.color, col = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
          g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        }
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
        return g;
      });
      const merged = new THREE.Mesh(mergeGeometries(geos), plain ? vcMaterial(ms[0].material.side) : key);
      merged.castShadow = true;
      merged.receiveShadow = true;
      j.add(merged);
      for (const m of ms) m.parent.remove(m);
    }
  }
}

// X-ray silhouette: a stippled copy of an actor drawn only where walls or
// furniture hide it. Rendered after the room (renderOrder 1) and before the
// actor itself (renderOrder 2), so the actor never shows through itself.
// Pulled 0.3m towards the camera so floors touching the soles, or a hat
// brushing a beam, don't count as hiding the actor.
const XRAY_VERT = `void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  mv.xyz += normalize(-mv.xyz) * 0.3;
  gl_Position = projectionMatrix * mv;
}`;
const XRAY_FRAG = `uniform vec3 color;
void main() {
  if (mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 0.5) discard;
  gl_FragColor = vec4(color, 1.0);
}`;
export function addXray(root, color) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) } },
    vertexShader: XRAY_VERT,
    fragmentShader: XRAY_FRAG,
    depthFunc: THREE.GreaterDepth,
    depthWrite: false,
  });
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && o.castShadow && !o.userData.xray) meshes.push(o); });
  for (const m of meshes) {
    const x = new THREE.Mesh(m.geometry, mat);
    x.userData.xray = true;
    x.renderOrder = 1;
    x.position.copy(m.position);
    x.quaternion.copy(m.quaternion);
    x.scale.copy(m.scale);
    m.parent.add(x);
    m.renderOrder = 2;
  }
  return mat;
}

// A little self-illumination so an actor still reads in the darkest corners.
export function brighten(root, k = 0.18) {
  root.traverse((o) => {
    if (!o.isMesh || !o.castShadow || o.userData.xray) return;
    const boost = (m) => {
      const c = m.clone();
      if (!c.emissive) return c;
      if (c.map) { c.emissiveMap = c.map; c.emissive.setScalar(k); }
      else if (c.vertexColors) {
        c.emissive.setScalar(k);
        c.onBeforeCompile = (sh) => {
          sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor.rgb;');
        };
      } else c.emissive.copy(c.color).multiplyScalar(k);
      return c;
    };
    o.material = Array.isArray(o.material) ? o.material.map(boost) : boost(o.material);
  });
}

// Blob shadow under a character (helps grounding where no light casts).
let blobTex = null;
export function blobShadow(r = 0.45) {
  if (!blobTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(16, 16, 2, 16, 16, 16);
    grd.addColorStop(0, 'rgba(0,0,0,0.7)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
    blobTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.012;
  m.renderOrder = 1;
  return m;
}

// ------------------------------------------------------------------ animator
export class Animator {
  constructor(parts, clips) {
    this.parts = parts;
    this.clips = clips;
    this.cur = null;
    this.prev = null;
    this.t = 0;
    this.prevT = 0;
    this.fadeT = 0;
    this.fadeDur = 0;
    this.speed = 1;
    this.prevSpeed = 1;
    this.A = newPose();
    this.B = newPose();
    this.out = newPose();
    this.params = {};
    this.finished = false;
    this.events = [];
  }

  play(name, o = {}) {
    if (this.cur === name && !o.restart) {
      if (o.speed !== undefined) this.speed = o.speed;
      return;
    }
    const clip = this.clips[name];
    if (!clip) throw new Error('no clip ' + name);
    this.prev = this.cur;
    this.prevT = this.t;
    this.prevSpeed = this.speed;
    this.cur = name;
    this.t = o.t || 0;
    this.speed = o.speed ?? 1;
    this.fadeDur = o.fade ?? clip.fade ?? 0.15;
    this.fadeT = this.prev ? 0 : this.fadeDur;
    this.finished = false;
  }

  get clip() { return this.clips[this.cur]; }
  get progress() {
    const c = this.clip;
    return c && c.dur ? Math.min(1, this.t / c.dur) : 0;
  }

  update(dt) {
    this.events.length = 0;
    const c = this.clips[this.cur];
    if (!c) return this.events;
    const t0 = this.t;
    this.t += dt * this.speed;
    if (!c.loop && c.dur && this.t >= c.dur) {
      this.t = c.dur;
      this.finished = true;
    }
    if (c.events) {
      for (const ev of c.events) {
        let et = ev.t;
        if (c.loop && c.period) {
          // looping clips: events at fractions of the period
          const p = c.period(this.params);
          const k0 = Math.floor(t0 / p), k1 = Math.floor(this.t / p);
          for (let k = k0; k <= k1; k++) {
            const tt = (k + ev.t) * p;
            if (tt > t0 && tt <= this.t) this.events.push(ev.name);
          }
          continue;
        }
        if (et > t0 && et <= this.t) this.events.push(ev.name);
      }
    }
    this.B.fill(0);
    c.fn(this.t, this.B, this.params);
    let out = this.B;
    if (this.fadeT < this.fadeDur && this.prev) {
      this.fadeT += dt;
      const pc = this.clips[this.prev];
      this.prevT += dt * this.prevSpeed;
      if (!pc.loop && pc.dur) this.prevT = Math.min(this.prevT, pc.dur);
      this.A.fill(0);
      pc.fn(this.prevT, this.A, this.params);
      let w = Math.min(1, this.fadeT / this.fadeDur);
      w = w * w * (3 - 2 * w);
      for (let i = 0; i < POSE_SIZE; i++) this.out[i] = this.A[i] + (this.B[i] - this.A[i]) * w;
      out = this.out;
    }
    this.apply(out);
    return this.events;
  }

  apply(p) {
    const L = this.parts.list;
    for (let i = 0; i < L.length; i++) {
      const j = L[i];
      if (j) j.rotation.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
    }
    const hb = this.parts.hipBase;
    this.parts.joints.hips.position.set(hb.x + p[ROOT], hb.y + p[ROOT + 1], hb.z + p[ROOT + 2]);
  }
}

// ------------------------------------------------------------------ clips
const S = Math.sin, Co = Math.cos, PI = Math.PI;
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const seg = (t, a, b) => ease((t - a) / (b - a));

function restArms(p, out = 0.1, bend = -0.15) {
  setJ(p, 'lShoulder', 0, 0, out);
  setJ(p, 'rShoulder', 0, 0, -out);
  setJ(p, 'lElbow', bend, 0, 0);
  setJ(p, 'rElbow', bend, 0, 0);
}

function gait(t, p, o) {
  const ph = t * PI * 2 * o.freq;
  const s = S(ph);
  const A = o.leg, Aa = o.arm;
  setJ(p, 'lHip', -s * A + (o.hipBias || 0), 0, 0);
  setJ(p, 'rHip', s * A + (o.hipBias || 0), 0, 0);
  const kl = Math.pow(Math.max(0, Co(ph)), 1.3), kr = Math.pow(Math.max(0, -Co(ph)), 1.3);
  setJ(p, 'lKnee', o.knee0 + kl * o.knee, 0, 0);
  setJ(p, 'rKnee', o.knee0 + kr * o.knee, 0, 0);
  setJ(p, 'lShoulder', s * Aa + (o.armBias || 0), 0, o.armOut ?? 0.08);
  setJ(p, 'rShoulder', -s * Aa + (o.armBias || 0), 0, -(o.armOut ?? 0.08));
  setJ(p, 'lElbow', (o.elbow ?? -0.25) - Math.max(0, -s) * 0.3, 0, 0);
  setJ(p, 'rElbow', (o.elbow ?? -0.25) - Math.max(0, s) * 0.3, 0, 0);
  setJ(p, 'hips', 0, s * 0.08, 0);
  setJ(p, 'spine', o.lean || 0, -s * 0.12, 0);
  setJ(p, 'neck', o.head || 0, s * 0.05, 0);
  p[ROOT + 1] = Co(ph * 2) * o.bob - o.bob - (o.drop || 0);
}

export const STEP_EVENTS = [{ t: 0.25, name: 'step' }, { t: 0.75, name: 'step' }];

// Clip library for the investigator (and shared basics).
export function humanClips() {
  return {
    idle: {
      loop: true,
      fn(t, p) {
        restArms(p, 0.09, -0.12);
        setJ(p, 'spine', 0.02 + S(t * 1.6) * 0.015, 0, 0);
        setJ(p, 'neck', 0.05, S(t * 0.35) * 0.25 * Math.max(0, S(t * 0.21)), 0);
        setJ(p, 'lShoulder', S(t * 1.6) * 0.02, 0, 0.09);
        setJ(p, 'rShoulder', -S(t * 1.6) * 0.02, 0, -0.09);
        setJ(p, 'lHip', -0.02, 0, 0.02);
        setJ(p, 'rHip', -0.02, 0, -0.02);
        setJ(p, 'lKnee', 0.04);
        setJ(p, 'rKnee', 0.04);
        p[ROOT + 1] = S(t * 1.6) * 0.004 - 0.005;
      },
    },
    walk: {
      loop: true,
      period: () => 1 / 0.95,
      events: STEP_EVENTS,
      fn(t, p) { gait(t, p, { freq: 0.95, leg: 0.42, arm: 0.35, knee0: 0.08, knee: 0.75, bob: 0.022, lean: 0.04 }); },
    },
    run: {
      loop: true,
      period: () => 1 / 1.45,
      events: STEP_EVENTS,
      fn(t, p) { gait(t, p, { freq: 1.45, leg: 0.7, arm: 0.75, knee0: 0.2, knee: 1.3, bob: 0.04, lean: 0.22, elbow: -1.1, drop: 0.03, head: -0.12 }); },
    },
    back: {
      loop: true,
      period: () => 1 / 0.8,
      events: STEP_EVENTS,
      fn(t, p) { gait(-t, p, { freq: 0.8, leg: 0.3, arm: 0.2, knee0: 0.1, knee: 0.5, bob: 0.015, lean: -0.03 }); },
    },
    turn: {
      loop: true,
      period: () => 1 / 1.2,
      events: STEP_EVENTS,
      fn(t, p) { gait(t, p, { freq: 1.2, leg: 0.08, arm: 0.06, knee0: 0.08, knee: 0.45, bob: 0.008 }); },
    },
    punch: {
      dur: 0.5,
      events: [{ t: 0.17, name: 'hit' }],
      fn(t, p) {
        const a = seg(t, 0, 0.1), b = seg(t, 0.1, 0.18), c = seg(t, 0.32, 0.5);
        const ext = b * (1 - c);
        restArms(p, 0.1, -0.2);
        setJ(p, 'lShoulder', -0.9 * (1 - c), 0, 0.15);
        setJ(p, 'lElbow', -1.6 * (1 - c), 0, 0);
        setJ(p, 'rShoulder', 0.3 * a * (1 - b) - 1.5 * ext, 0, -0.1 + 0.25 * ext);
        setJ(p, 'rElbow', -1.5 * a * (1 - ext) - 0.1 * ext, 0, 0);
        setJ(p, 'spine', 0.08 * ext, 0.35 * ext - 0.15 * a * (1 - b), 0);
        setJ(p, 'hips', 0, 0.15 * ext, 0);
        setJ(p, 'lHip', -0.25, 0, 0);
        setJ(p, 'rHip', 0.2, 0, 0);
        setJ(p, 'lKnee', 0.25);
        setJ(p, 'rKnee', 0.1);
        p[ROOT + 1] = -0.03;
        p[ROOT + 2] = 0.06 * ext;
      },
    },
    kick: {
      dur: 0.7,
      events: [{ t: 0.3, name: 'hit' }],
      fn(t, p) {
        const a = seg(t, 0, 0.18), b = seg(t, 0.18, 0.3), c = seg(t, 0.42, 0.7);
        restArms(p, 0.35, -0.6);
        setJ(p, 'lShoulder', -0.4 * (1 - c), 0, 0.4);
        setJ(p, 'rShoulder', 0.3 * (1 - c), 0, -0.45);
        const lift = a * (1 - c), ext = b * (1 - c);
        setJ(p, 'rHip', -1.3 * lift - 0.2 * ext, 0, 0);
        setJ(p, 'rKnee', 1.6 * lift * (1 - ext) + 0.1, 0, 0);
        setJ(p, 'lHip', 0.1 * lift, 0, 0);
        setJ(p, 'lKnee', 0.15 * lift);
        setJ(p, 'spine', -0.25 * lift, 0, 0);
        p[ROOT + 1] = -0.02 * lift;
        p[ROOT + 2] = -0.05 * lift + 0.06 * ext;
      },
    },
    swing: {
      dur: 0.75,
      events: [{ t: 0.36, name: 'hit' }],
      fn(t, p) {
        const a = seg(t, 0, 0.25), b = seg(t, 0.25, 0.38), c = seg(t, 0.5, 0.75);
        restArms(p, 0.12, -0.25);
        const up = a * (1 - b), down = b * (1 - c);
        setJ(p, 'rShoulder', -2.6 * up - 0.7 * down - 0.4 * (1 - up - down) * (1 - c), 0.2 * up, -0.2 - 0.3 * up + 0.3 * down);
        setJ(p, 'rElbow', -0.9 * up - 0.15 * down, 0, 0);
        setJ(p, 'lShoulder', -0.5 * (up + down), 0, 0.3);
        setJ(p, 'spine', -0.15 * up + 0.3 * down, 0.3 * up - 0.4 * down, 0);
        setJ(p, 'lHip', -0.3 * (up + down), 0, 0);
        setJ(p, 'lKnee', 0.3 * (up + down));
        setJ(p, 'rKnee', 0.1);
        p[ROOT + 1] = -0.04 * down;
        p[ROOT + 2] = 0.08 * down;
      },
    },
    aim: {
      loop: true,
      fn(t, p) {
        restArms(p, 0.1, -0.2);
        setJ(p, 'rShoulder', -1.5, 0.05, 0.12);
        setJ(p, 'rElbow', -0.05, 0, 0);
        setJ(p, 'lShoulder', -1.3, 0, -0.35);
        setJ(p, 'lElbow', -0.35, 0, 0);
        setJ(p, 'spine', 0.02, 0.1, 0);
        setJ(p, 'neck', 0.05, -0.1, 0);
        setJ(p, 'lHip', -0.15);
        setJ(p, 'rHip', 0.12);
        setJ(p, 'lKnee', 0.15);
        setJ(p, 'rKnee', 0.05);
        p[ROOT + 1] = -0.01 + S(t * 1.5) * 0.003;
      },
    },
    shoot: {
      dur: 0.45,
      fade: 0.05,
      events: [{ t: 0.01, name: 'fire' }],
      fn(t, p) {
        const k = Math.max(0, 1 - t / 0.25);
        restArms(p, 0.1, -0.2);
        setJ(p, 'rShoulder', -1.5 - 0.5 * k, 0.05, 0.12);
        setJ(p, 'rElbow', -0.05 - 0.4 * k, 0, 0);
        setJ(p, 'lShoulder', -1.3 - 0.35 * k, 0, -0.35);
        setJ(p, 'lElbow', -0.35, 0, 0);
        setJ(p, 'spine', -0.08 * k, 0.1, 0);
        setJ(p, 'neck', 0.05 - 0.1 * k, -0.1, 0);
        setJ(p, 'lHip', -0.15);
        setJ(p, 'rHip', 0.12);
        setJ(p, 'lKnee', 0.15);
        p[ROOT + 2] = -0.04 * k;
      },
    },
    push: {
      loop: true,
      period: () => 1 / 0.6,
      events: STEP_EVENTS,
      fn(t, p) {
        gait(t, p, { freq: 0.6, leg: 0.32, arm: 0, knee0: 0.25, knee: 0.5, bob: 0.01, lean: 0.38, drop: 0.06 });
        setJ(p, 'lShoulder', -1.35, 0, -0.1);
        setJ(p, 'rShoulder', -1.35, 0, 0.1);
        setJ(p, 'lElbow', -0.45);
        setJ(p, 'rElbow', -0.45);
        setJ(p, 'neck', -0.3);
      },
    },
    search: {
      dur: 1.1,
      events: [{ t: 0.55, name: 'grab' }],
      fn(t, p) {
        const d = seg(t, 0, 0.35) * (1 - seg(t, 0.75, 1.1));
        restArms(p, 0.1, -0.2);
        setJ(p, 'lHip', -0.9 * d, 0, 0);
        setJ(p, 'rHip', -0.2 * d, 0, 0);
        setJ(p, 'lKnee', 1.3 * d);
        setJ(p, 'rKnee', 1.1 * d);
        setJ(p, 'spine', 0.55 * d);
        setJ(p, 'neck', 0.35 * d);
        const reach = seg(t, 0.3, 0.55) * (1 - seg(t, 0.6, 0.9));
        setJ(p, 'rShoulder', -1.1 * d - 0.3 * reach, 0, -0.1);
        setJ(p, 'rElbow', -0.4 + 0.3 * reach);
        setJ(p, 'lShoulder', -0.5 * d, 0, 0.2);
        p[ROOT + 1] = -0.32 * d;
        p[ROOT + 2] = -0.05 * d;
      },
    },
    // kneeling at a bath or a well, his right hand down in the water (held)
    dip: {
      dur: 6,
      fn(t, p) {
        const d = seg(t, 0, 0.6);
        restArms(p, 0.1, -0.2);
        setJ(p, 'lHip', -1.05 * d);
        setJ(p, 'lKnee', 1.45 * d);
        setJ(p, 'rHip', 0.25 * d);
        setJ(p, 'rKnee', 1.75 * d);
        setJ(p, 'spine', 0.55 * d);
        setJ(p, 'neck', 0.35 * d);
        setJ(p, 'rShoulder', -1.15 * d, 0, -0.12);
        setJ(p, 'rElbow', -0.1 * d);
        setJ(p, 'lShoulder', -0.35 * d, 0, 0.3);
        setJ(p, 'lElbow', -0.6 * d);
        p[ROOT + 1] = -0.5 * d;
        p[ROOT + 2] = 0.05 * d;
      },
    },
    reach: {
      dur: 0.7,
      events: [{ t: 0.35, name: 'grab' }],
      fn(t, p) {
        const d = seg(t, 0, 0.3) * (1 - seg(t, 0.45, 0.7));
        restArms(p, 0.1, -0.2);
        setJ(p, 'rShoulder', -1.3 * d, 0, -0.05);
        setJ(p, 'rElbow', -0.3 * d - 0.1);
        setJ(p, 'spine', 0.15 * d);
        setJ(p, 'neck', 0.1 * d);
        setJ(p, 'lHip', -0.2 * d);
        setJ(p, 'lKnee', 0.2 * d);
      },
    },
    hit: {
      dur: 0.45,
      fade: 0.05,
      fn(t, p) {
        const k = S(Math.min(1, t / 0.45) * PI) * (1 - t / 0.45 * 0.3);
        restArms(p, 0.3 * k + 0.1, -0.4 * k - 0.15);
        setJ(p, 'spine', -0.35 * k, 0.1 * k, 0);
        setJ(p, 'neck', -0.35 * k, 0, 0.1 * k);
        setJ(p, 'lHip', 0.1 * k);
        setJ(p, 'rHip', -0.2 * k);
        setJ(p, 'rKnee', 0.3 * k);
        p[ROOT + 2] = -0.06 * k;
      },
    },
    death: {
      dur: 1.6,
      fade: 0.1,
      events: [{ t: 1.05, name: 'thud' }],
      fn(t, p) {
        const a = seg(t, 0, 0.45), b = seg(t, 0.35, 1.05);
        restArms(p, 0.2 + 0.9 * b, -0.3 - 0.4 * a * (1 - b));
        setJ(p, 'lShoulder', -0.6 * a * (1 - b) + 0.2 * b, 0, 0.2 + 1.0 * b);
        setJ(p, 'rShoulder', -0.4 * a * (1 - b) + 0.3 * b, 0, -0.2 - 1.2 * b);
        setJ(p, 'hips', -1.45 * b, 0, 0.05 * b);
        setJ(p, 'spine', 0.35 * a * (1 - b) - 0.05 * b, 0, 0);
        setJ(p, 'neck', 0.4 * a * (1 - b) - 0.2 * b, 0.5 * b, 0);
        // flat on his back: legs along the floor, one knee up
        setJ(p, 'lHip', -0.8 * a * (1 - b) - 0.08 * b, 0, 0.1 * b);
        setJ(p, 'rHip', -0.5 * a * (1 - b) - 0.3 * b, 0, -0.15 * b);
        setJ(p, 'lKnee', 1.9 * a * (1 - b) + 0.15 * b);
        setJ(p, 'rKnee', 1.6 * a * (1 - b) + 0.6 * b);
        p[ROOT + 1] = -0.35 * a - 0.42 * b;
        p[ROOT + 2] = -0.35 * b;
      },
    },
    // up off his back (the end of 'death'), slowly, the way you get up after
    // being knocked senseless
    getUp: {
      dur: 2.2,
      fn(t, p) {
        const k = 1 - seg(t, 0, 2.2);
        setJ(p, 'hips', -1.45 * k, 0, 0);
        setJ(p, 'lShoulder', -0.5 * k, 0, 0.5 * k + 0.12);
        setJ(p, 'rShoulder', -0.5 * k, 0, -0.5 * k - 0.12);
        setJ(p, 'lElbow', -0.3 * k - 0.15);
        setJ(p, 'rElbow', -0.6 * k - 0.15);
        const mid = k * (1 - k);
        setJ(p, 'lHip', -0.1 * k - 1.4 * mid);
        setJ(p, 'rHip', -0.3 * k - 1.2 * mid);
        setJ(p, 'lKnee', 0.1 + 0.15 * k + 1.6 * mid);
        setJ(p, 'rKnee', 0.6 * k + 1.4 * mid);
        setJ(p, 'spine', 0.25 * mid, 0, 0);
        setJ(p, 'neck', 0.3 * mid, 0.4 * k, 0);
        p[ROOT + 1] = -0.77 * k;
      },
    },
    throw: {
      dur: 0.75,
      events: [{ t: 0.36, name: 'release' }],
      fn(t, p) {
        const a = seg(t, 0, 0.28), b = seg(t, 0.28, 0.4), c = seg(t, 0.5, 0.75);
        restArms(p, 0.12, -0.25);
        setJ(p, 'rShoulder', -2.5 * a * (1 - b) - 1.2 * b * (1 - c) + 0.0, 0, -0.2);
        setJ(p, 'rElbow', -1.4 * a * (1 - b) - 0.1 * b, 0, 0);
        setJ(p, 'lShoulder', -0.9 * a * (1 - c), 0, 0.2);
        setJ(p, 'spine', -0.2 * a * (1 - b) + 0.3 * b * (1 - c), 0.35 * a * (1 - b) - 0.3 * b * (1 - c), 0);
        setJ(p, 'lHip', -0.35 * (a + b) * (1 - c));
        setJ(p, 'lKnee', 0.3 * (a + b) * (1 - c));
        p[ROOT + 2] = 0.06 * b * (1 - c);
      },
    },
    sit: {
      loop: true,
      fn(t, p) {
        restArms(p, 0.05, -0.9);
        setJ(p, 'lShoulder', -0.35, 0, 0.05);
        setJ(p, 'rShoulder', -0.35, 0, -0.05);
        setJ(p, 'lHip', -1.55);
        setJ(p, 'rHip', -1.55);
        setJ(p, 'lKnee', 1.55);
        setJ(p, 'rKnee', 1.55);
        setJ(p, 'spine', 0.05 + S(t) * 0.01);
        p[ROOT + 1] = -0.47;
      },
    },
    lookAround: {
      dur: 2.4,
      fn(t, p) {
        restArms(p, 0.09, -0.12);
        const k = S(Math.min(1, t / 2.4) * PI * 2);
        setJ(p, 'neck', 0.05, k * 0.7, 0);
        setJ(p, 'spine', 0.02, k * 0.2, 0);
      },
    },
    // a sudden fright: he jerks back with his arms thrown up, then settles into a guard
    startle: {
      dur: 1.1,
      fade: 0.04,
      fn(t, p) {
        const a = seg(t, 0, 0.12), r = seg(t, 0.5, 1.1);
        const jolt = a * (1 - r);
        const shiver = S(t * 70) * 0.025 * (1 - seg(t, 0.2, 0.6));
        restArms(p, 0.1, -0.2);
        setJ(p, 'lShoulder', -1.25 * jolt - 0.9 * r, 0, 0.35 * jolt + 0.15 * r);
        setJ(p, 'rShoulder', -1.35 * jolt - 0.75 * r, 0, -0.35 * jolt - 0.15 * r);
        setJ(p, 'lElbow', -1.3 * jolt - 1.6 * r);
        setJ(p, 'rElbow', -1.2 * jolt - 1.7 * r);
        setJ(p, 'spine', -0.32 * jolt + 0.06 * r + shiver, 0, 0);
        setJ(p, 'neck', -0.3 * jolt + 0.05 * r, 0, 0);
        setJ(p, 'lHip', -0.15 * jolt - 0.2 * r);
        setJ(p, 'rHip', 0.35 * jolt + 0.15 * r);
        setJ(p, 'lKnee', 0.25 * jolt + 0.2 * r);
        setJ(p, 'rKnee', 0.35 * jolt + 0.15 * r);
        p[ROOT + 1] = -0.05 * jolt - 0.04 * r;
        p[ROOT + 2] = -0.08 * jolt;
      },
    },
    // fists up, weight on the balls of his feet
    guard: {
      loop: true,
      fn(t, p) {
        const b = S(t * 2.2) * 0.015;
        restArms(p, 0.1, -0.2);
        setJ(p, 'lShoulder', -0.9 + b, 0, 0.15);
        setJ(p, 'rShoulder', -0.75 - b, 0, -0.15);
        setJ(p, 'lElbow', -1.6);
        setJ(p, 'rElbow', -1.7);
        setJ(p, 'spine', 0.06 + b, 0, 0);
        setJ(p, 'neck', 0.05);
        setJ(p, 'lHip', -0.2);
        setJ(p, 'rHip', 0.15);
        setJ(p, 'lKnee', 0.2);
        setJ(p, 'rKnee', 0.15);
        p[ROOT + 1] = -0.04 + b * 0.5;
      },
    },
    // creeping forward with the lamp held up to see by
    stalk: {
      loop: true,
      period: () => 1 / 0.7,
      events: STEP_EVENTS,
      fn(t, p) {
        gait(t, p, { freq: 0.7, leg: 0.3, arm: 0.12, knee0: 0.18, knee: 0.55, bob: 0.012, lean: 0.12, drop: 0.03 });
        setJ(p, 'lShoulder', -1.3, 0, 0.05);
        setJ(p, 'lElbow', -0.5);
        setJ(p, 'neck', -0.05);
      },
    },
    // standing still, the lamp held up into the dark
    peer: {
      loop: true,
      fn(t, p) {
        restArms(p, 0.09, -0.15);
        setJ(p, 'lShoulder', -1.35 + S(t * 1.3) * 0.02, 0, 0.05);
        setJ(p, 'lElbow', -0.45);
        setJ(p, 'spine', 0.1 + S(t * 1.6) * 0.012, 0, 0);
        setJ(p, 'neck', -0.08, S(t * 0.4) * 0.15, 0);
        setJ(p, 'lHip', -0.18);
        setJ(p, 'rHip', 0.05);
        setJ(p, 'lKnee', 0.12);
        setJ(p, 'rKnee', 0.06);
        p[ROOT + 1] = -0.01;
      },
    },
  };
}

// Shambling undead.
export function zombieClips(o = {}) {
  const base = humanClips();
  const hunch = o.hunch ?? 0.25;
  return {
    ...base,
    idle: {
      loop: true,
      fn(t, p) {
        setJ(p, 'spine', hunch + S(t * 0.9) * 0.04, S(t * 0.5) * 0.1, 0.08);
        setJ(p, 'neck', -0.1, S(t * 0.7) * 0.2, 0.35 + S(t * 1.3) * 0.05);
        setJ(p, 'lShoulder', -0.2 + S(t * 0.8) * 0.05, 0, 0.15);
        setJ(p, 'rShoulder', -0.1, 0, -0.25);
        setJ(p, 'lElbow', -0.3);
        setJ(p, 'rElbow', -0.15);
        setJ(p, 'lKnee', 0.15);
        setJ(p, 'rKnee', 0.1);
        setJ(p, 'lHip', -0.1);
        p[ROOT + 1] = -0.03;
      },
    },
    walk: {
      loop: true,
      period: () => 1 / 0.55,
      events: STEP_EVENTS,
      fn(t, p) {
        gait(t, p, { freq: 0.55, leg: 0.3, arm: 0.06, knee0: 0.12, knee: 0.45, bob: 0.03, lean: hunch, armBias: -1.25, armOut: 0.12, elbow: -0.25 });
        const ph = t * PI * 2 * 0.55;
        setJ(p, 'neck', -0.2, S(ph) * 0.15, 0.35);
        addJ(p, 'spine', 0, 0, 0.1 + S(ph) * 0.06);
        addJ(p, 'rKnee', -Math.max(0, Co(ph)) * 0.3);
      },
    },
    attack: {
      dur: 1.15,
      events: [{ t: 0.62, name: 'hit' }],
      fn(t, p) {
        const a = seg(t, 0, 0.45), b = seg(t, 0.45, 0.65), c = seg(t, 0.8, 1.15);
        const up = a * (1 - b), down = b * (1 - c);
        setJ(p, 'lShoulder', -1.2 - 1.3 * up + 0.3 * down, 0, 0.3 - 0.2 * down);
        setJ(p, 'rShoulder', -1.2 - 1.3 * up + 0.3 * down, 0, -0.3 + 0.2 * down);
        setJ(p, 'lElbow', -0.6 * up - 0.1);
        setJ(p, 'rElbow', -0.6 * up - 0.1);
        setJ(p, 'spine', hunch - 0.25 * up + 0.5 * down, 0, 0.1);
        setJ(p, 'neck', -0.3 * up + 0.1 * down, 0, 0.2);
        setJ(p, 'lHip', -0.4 * down);
        setJ(p, 'lKnee', 0.4 * down + 0.1);
        setJ(p, 'rKnee', 0.1);
        p[ROOT + 1] = -0.05 * down;
        p[ROOT + 2] = 0.12 * down;
      },
    },
    death: {
      dur: 1.6,
      fade: 0.1,
      events: [{ t: 1.0, name: 'thud' }],
      fn(t, p) {
        const a = seg(t, 0, 0.5), b = seg(t, 0.4, 1.0);
        setJ(p, 'lShoulder', -0.8 * a * (1 - b) - 2.6 * b, 0, 0.3);
        setJ(p, 'rShoulder', -0.5 * a * (1 - b) - 2.4 * b, 0, -0.4);
        setJ(p, 'lElbow', -0.3);
        setJ(p, 'rElbow', -0.6);
        setJ(p, 'hips', 1.45 * b, 0.2 * b, 0);
        setJ(p, 'spine', 0.3 * a * (1 - b) + 0.05 * b);
        setJ(p, 'neck', 0.5 * a * (1 - b) - 0.3 * b, 0.6 * b, 0);
        // face down: legs stretched out behind along the floor
        setJ(p, 'lHip', -1.0 * a * (1 - b) + 0.12 * b);
        setJ(p, 'rHip', -0.7 * a * (1 - b) + 0.1 * b);
        setJ(p, 'lKnee', 2.0 * a * (1 - b) + 0.2 * b);
        setJ(p, 'rKnee', 1.7 * a * (1 - b) + 0.45 * b);
        p[ROOT + 1] = -0.4 * a - 0.38 * b;
        p[ROOT + 2] = 0.4 * b;
      },
    },
    rise: {
      dur: 1.6,
      fn(t, p) {
        // getting up from lying on the back (reverse of a fall)
        const k = 1 - seg(t, 0, 1.6);
        setJ(p, 'hips', -1.45 * k, 0, 0);
        setJ(p, 'lShoulder', -0.5 * k, 0, 0.5 * k + 0.15);
        setJ(p, 'rShoulder', -0.5 * k, 0, -0.5 * k - 0.15);
        // legs flat at first, knees drawn up on the way to standing
        const mid = k * (1 - k);
        setJ(p, 'lHip', -0.1 * k - 1.4 * mid);
        setJ(p, 'rHip', -0.3 * k - 1.2 * mid);
        setJ(p, 'lKnee', 0.1 + 0.15 * k + 1.6 * mid);
        setJ(p, 'rKnee', 0.6 * k + 1.4 * mid);
        setJ(p, 'spine', hunch * (1 - k), 0, 0);
        setJ(p, 'neck', 0.3 * (1 - k), 0, 0.3 * (1 - k));
        p[ROOT + 1] = -0.77 * k;
      },
    },
  };
}

// The drowned preacher: a zombie that preaches at the pulpit, falls on its
// back when struck down, and gets up again.
export function preacherClips() {
  const base = zombieClips({ hunch: 0.2 });
  return {
    ...base,
    death: humanClips().death,
    // arms up to an empty congregation, swaying, head thrown back
    preach: {
      loop: true,
      fn(t, p) {
        const sw = S(t * 1.3);
        setJ(p, 'lShoulder', -2.3 + S(t * 2.1) * 0.25, 0, 0.35);
        setJ(p, 'rShoulder', -2.1 + S(t * 2.1 + 1.2) * 0.25, 0, -0.35);
        setJ(p, 'lElbow', -0.35);
        setJ(p, 'rElbow', -0.45);
        setJ(p, 'spine', -0.18 + sw * 0.05, sw * 0.12, 0);
        setJ(p, 'neck', -0.35 + S(t * 3.1) * 0.08, 0, S(t * 0.9) * 0.1);
        setJ(p, 'lKnee', 0.08);
        setJ(p, 'rKnee', 0.08);
      },
    },
  };
}

// A suit of armour come down off its plinth, halberd in the right hand:
// stiff and heavy, with one wide sweeping blow. The halberd stands upright
// in its fist while the forearm is level (see buildArmor).
export function armorClips() {
  const base = humanClips();
  const hold = (p, lift = 0) => {
    setJ(p, 'rShoulder', -0.15 - lift, 0, -0.14);
    setJ(p, 'rElbow', -1.35 + lift * 0.4, 0, 0);
  };
  return {
    ...base,
    // at attention on the plinth: not a tremor
    still: {
      loop: true,
      fn(t, p) {
        hold(p);
        setJ(p, 'lShoulder', 0.02, 0, 0.1);
        setJ(p, 'lElbow', -0.12);
      },
    },
    idle: {
      loop: true,
      fn(t, p) {
        hold(p);
        setJ(p, 'lShoulder', -0.1, 0, 0.16);
        setJ(p, 'lElbow', -0.3);
        setJ(p, 'spine', 0.04, S(t * 0.6) * 0.06, 0);
        setJ(p, 'neck', 0.05, S(t * 0.45) * 0.25, 0);
        setJ(p, 'lKnee', 0.06);
        setJ(p, 'rKnee', 0.06);
      },
    },
    walk: {
      loop: true,
      period: () => 1 / 0.62,
      events: STEP_EVENTS,
      fn(t, p) {
        gait(t, p, { freq: 0.62, leg: 0.3, arm: 0.05, knee0: 0.06, knee: 0.32, bob: 0.03, lean: 0.06, armBias: -0.2, armOut: 0.12, elbow: -0.3 });
        hold(p, 0.25);
        const ph = t * PI * 2 * 0.62;
        addJ(p, 'spine', 0, 0, S(ph) * 0.05);
        setJ(p, 'neck', 0.08, 0, 0);
      },
    },
    // the halberd drawn back over the right shoulder, then swept across
    attack: {
      dur: 1.55,
      events: [{ t: 0.98, name: 'hit' }],
      fn(t, p) {
        const a = seg(t, 0, 0.78), b = seg(t, 0.78, 1.08), c = seg(t, 1.2, 1.55);
        const up = a * (1 - b), sweep = b * (1 - c);
        setJ(p, 'spine', -0.12 * up + 0.22 * sweep, 0.75 * up - 0.95 * sweep, 0);
        setJ(p, 'neck', 0.1 * sweep, -0.4 * up + 0.4 * sweep, 0);
        setJ(p, 'rShoulder', -0.15 - 1.5 * up - 1.1 * sweep, 0, -0.14 - 0.8 * up + 0.5 * sweep);
        setJ(p, 'rElbow', -1.35 + 0.7 * up + 0.9 * sweep);
        setJ(p, 'lShoulder', -0.1 - 1.1 * up - 1.0 * sweep, 0, 0.2);
        setJ(p, 'lElbow', -0.3 - 0.6 * up);
        setJ(p, 'lHip', -0.4 * sweep);
        setJ(p, 'lKnee', 0.4 * sweep + 0.06);
        setJ(p, 'rKnee', 0.06 + 0.15 * up);
        p[ROOT + 1] = -0.04 * sweep;
        p[ROOT + 2] = 0.16 * sweep;
      },
    },
    hit: {
      dur: 0.5,
      fade: 0.05,
      fn(t, p) {
        const k = S(Math.min(1, t / 0.5) * PI);
        hold(p, 0.15 * k);
        setJ(p, 'lShoulder', -0.2, 0, 0.2 + 0.2 * k);
        setJ(p, 'spine', -0.22 * k, 0.12 * k, 0);
        setJ(p, 'neck', -0.25 * k, 0, 0);
        setJ(p, 'rHip', -0.15 * k);
        setJ(p, 'rKnee', 0.25 * k);
        p[ROOT + 2] = -0.05 * k;
      },
    },
    // down on its knees, then over on its face
    death: {
      dur: 1.9,
      fade: 0.1,
      events: [{ t: 0.55, name: 'thud' }, { t: 1.35, name: 'thud' }],
      fn(t, p) {
        const a = seg(t, 0, 0.55), b = seg(t, 0.85, 1.35);
        setJ(p, 'lShoulder', -0.3 * a * (1 - b) - 2.6 * b, 0, 0.25);
        setJ(p, 'rShoulder', -0.6 * a * (1 - b) - 2.4 * b, 0, -0.35);
        setJ(p, 'lElbow', -0.4);
        setJ(p, 'rElbow', -0.5);
        setJ(p, 'hips', 1.45 * b, 0.15 * b, 0);
        setJ(p, 'spine', 0.35 * a * (1 - b) + 0.05 * b);
        setJ(p, 'neck', 0.5 * a * (1 - b) - 0.3 * b, 0.5 * b, 0);
        setJ(p, 'lHip', -1.5 * a * (1 - b) + 0.12 * b);
        setJ(p, 'rHip', -1.4 * a * (1 - b) + 0.1 * b);
        setJ(p, 'lKnee', 2.3 * a * (1 - b) + 0.2 * b);
        setJ(p, 'rKnee', 2.2 * a * (1 - b) + 0.4 * b);
        p[ROOT + 1] = -0.5 * a * (1 - b) - 0.78 * b;
        p[ROOT + 2] = 0.42 * b;
      },
    },
  };
}

// Crouched, fast ghoul.
export function ghoulClips() {
  const base = humanClips();
  const crouch = (p) => {
    setJ(p, 'spine', 0.75, 0, 0);
    setJ(p, 'neck', -0.75, 0, 0);
    p[ROOT + 1] = -0.25;
  };
  return {
    ...base,
    idle: {
      loop: true,
      fn(t, p) {
        crouch(p);
        setJ(p, 'lHip', -0.7, 0, 0.15);
        setJ(p, 'rHip', -0.5, 0, -0.15);
        setJ(p, 'lKnee', 1.1);
        setJ(p, 'rKnee', 0.9);
        setJ(p, 'lShoulder', -0.6 + S(t * 2.1) * 0.08, 0, 0.3);
        setJ(p, 'rShoulder', -0.5 + S(t * 1.7) * 0.08, 0, -0.3);
        setJ(p, 'lElbow', -0.5);
        setJ(p, 'rElbow', -0.6);
        addJ(p, 'neck', 0, S(t * 0.9) * 0.4, S(t * 2.3) * 0.1);
        p[ROOT + 1] += S(t * 2.4) * 0.015;
      },
    },
    walk: {
      loop: true,
      period: () => 1 / 1.1,
      events: STEP_EVENTS,
      fn(t, p) {
        gait(t, p, { freq: 1.1, leg: 0.5, arm: 0.5, knee0: 0.6, knee: 0.8, bob: 0.03, lean: 0.75, armBias: -0.7, elbow: -0.4, hipBias: -0.4, armOut: 0.25 });
        setJ(p, 'neck', -0.75, 0, 0);
        p[ROOT + 1] -= 0.22;
      },
    },
    run: {
      loop: true,
      period: () => 1 / 1.9,
      events: STEP_EVENTS,
      fn(t, p) {
        gait(t, p, { freq: 1.9, leg: 0.8, arm: 0.9, knee0: 0.6, knee: 1.2, bob: 0.05, lean: 0.95, armBias: -0.9, elbow: -0.5, hipBias: -0.4, armOut: 0.2 });
        setJ(p, 'neck', -0.9, 0, 0);
        p[ROOT + 1] -= 0.25;
      },
    },
    attack: {
      dur: 0.7,
      events: [{ t: 0.3, name: 'hit' }],
      fn(t, p) {
        crouch(p);
        const a = seg(t, 0, 0.2), b = seg(t, 0.2, 0.32), c = seg(t, 0.45, 0.7);
        const up = a * (1 - b), sw = b * (1 - c);
        setJ(p, 'rShoulder', -0.6 - 1.6 * up - 0.4 * sw, 0, -0.3 - 0.6 * up + 0.5 * sw);
        setJ(p, 'rElbow', -0.8 * up - 0.1);
        setJ(p, 'lShoulder', -0.8 + 0.3 * sw, 0, 0.3);
        setJ(p, 'lElbow', -0.6);
        addJ(p, 'spine', -0.3 * up + 0.2 * sw, 0.4 * up - 0.5 * sw, 0);
        setJ(p, 'lHip', -0.8 - 0.3 * sw, 0, 0.1);
        setJ(p, 'rHip', -0.4, 0, -0.1);
        setJ(p, 'lKnee', 1.0);
        setJ(p, 'rKnee', 0.8);
        p[ROOT + 2] = 0.15 * sw;
      },
    },
    leap: {
      dur: 0.8,
      events: [{ t: 0.45, name: 'hit' }],
      fn(t, p) {
        crouch(p);
        const a = seg(t, 0, 0.2), b = seg(t, 0.2, 0.55), c = seg(t, 0.6, 0.8);
        const air = b * (1 - c);
        setJ(p, 'lShoulder', -0.6 - 1.8 * air, 0, 0.4);
        setJ(p, 'rShoulder', -0.6 - 1.8 * air, 0, -0.4);
        setJ(p, 'lElbow', -0.2);
        setJ(p, 'rElbow', -0.2);
        setJ(p, 'lHip', -1.0 * a * (1 - b) - 0.5 * air, 0, 0.1);
        setJ(p, 'rHip', -1.0 * a * (1 - b) + 0.3 * air, 0, -0.1);
        setJ(p, 'lKnee', 1.4 * a * (1 - b) + 0.6 * air);
        setJ(p, 'rKnee', 1.4 * a * (1 - b) + 0.2 * air);
        p[ROOT + 1] += -0.15 * a * (1 - b) + S(b * PI) * 0.45 * (1 - c);
      },
    },
    death: base.death,
    hit: base.hit,
  };
}

// Floating spectres: no legs work, they glide.
export function ghostClips() {
  return {
    idle: {
      loop: true,
      fn(t, p) {
        setJ(p, 'lShoulder', -0.1 + S(t * 0.8) * 0.1, 0, 0.25);
        setJ(p, 'rShoulder', -0.1 - S(t * 0.8) * 0.1, 0, -0.25);
        setJ(p, 'lElbow', -0.4);
        setJ(p, 'rElbow', -0.4);
        setJ(p, 'neck', 0.15, S(t * 0.3) * 0.2, S(t * 0.5) * 0.1);
        setJ(p, 'lHip', -0.1);
        setJ(p, 'rHip', 0.05);
        setJ(p, 'lKnee', 0.3);
        setJ(p, 'rKnee', 0.35);
        p[ROOT + 1] = 0.12 + S(t * 1.3) * 0.05;
      },
    },
    sit: humanClips().sit,
    play: {
      loop: true,
      fn(t, p) {
        humanClips().sit.fn(t, p);
        setJ(p, 'lShoulder', -0.95 + S(t * 3.1) * 0.08, S(t * 1.3) * 0.15, 0.12);
        setJ(p, 'rShoulder', -0.95 + S(t * 2.7 + 1) * 0.08, S(t * 1.1 + 2) * 0.15, -0.12);
        setJ(p, 'lElbow', -0.9 + S(t * 4.3) * 0.15);
        setJ(p, 'rElbow', -0.9 + S(t * 3.9 + 1) * 0.15);
        setJ(p, 'spine', 0.12 + S(t * 0.8) * 0.06, S(t * 0.6) * 0.08, 0);
        setJ(p, 'neck', 0.3, S(t * 0.4) * 0.15, 0.1);
      },
    },
    dance: {
      loop: true,
      fn(t, p) {
        const ph = t * PI * 2 * 0.45;
        setJ(p, 'lShoulder', -0.9, 0, 1.1 + S(ph) * 0.1);
        setJ(p, 'rShoulder', -1.2, 0, -0.5);
        setJ(p, 'lElbow', -0.3);
        setJ(p, 'rElbow', -1.1);
        setJ(p, 'neck', -0.1, 0.3, 0.15);
        setJ(p, 'spine', -0.05, S(ph) * 0.1, S(ph) * 0.06);
        setJ(p, 'lHip', -S(ph) * 0.3);
        setJ(p, 'rHip', S(ph) * 0.3);
        setJ(p, 'lKnee', 0.2 + Math.max(0, Co(ph)) * 0.4);
        setJ(p, 'rKnee', 0.2 + Math.max(0, -Co(ph)) * 0.4);
        p[ROOT + 1] = 0.05 + Math.abs(S(ph * 1.5)) * 0.04;
      },
    },
    attack: {
      dur: 0.9,
      events: [{ t: 0.45, name: 'hit' }],
      fn(t, p) {
        const a = seg(t, 0, 0.3), b = seg(t, 0.3, 0.5), c = seg(t, 0.6, 0.9);
        const up = a * (1 - c);
        setJ(p, 'lShoulder', -1.0 - 1.4 * up * (1 - b) - 0.4 * b * (1 - c), 0, 0.6 * up);
        setJ(p, 'rShoulder', -1.0 - 1.4 * up * (1 - b) - 0.4 * b * (1 - c), 0, -0.6 * up);
        setJ(p, 'lElbow', -0.2);
        setJ(p, 'rElbow', -0.2);
        setJ(p, 'neck', -0.6 * up, 0, 0);
        setJ(p, 'spine', -0.3 * a * (1 - b) + 0.4 * b * (1 - c));
        setJ(p, 'lKnee', 0.5);
        setJ(p, 'rKnee', 0.5);
        p[ROOT + 1] = 0.2 + 0.25 * up;
        p[ROOT + 2] = 0.3 * b * (1 - c);
      },
    },
    walk: {
      loop: true,
      fn(t, p) {
        // drifting after you, hands out to take hold, head lolling
        setJ(p, 'lShoulder', -1.15 + S(t * 2.1) * 0.12, 0, 0.22);
        setJ(p, 'rShoulder', -1.15 + S(t * 2.1 + 1.7) * 0.12, 0, -0.22);
        setJ(p, 'lElbow', -0.25);
        setJ(p, 'rElbow', -0.25);
        setJ(p, 'spine', 0.3);
        setJ(p, 'neck', -0.1, 0, S(t * 1.3) * 0.18);
        setJ(p, 'lHip', 0.3);
        setJ(p, 'rHip', 0.35);
        setJ(p, 'lKnee', 0.5);
        setJ(p, 'rKnee', 0.6);
        p[ROOT + 1] = 0.18 + S(t * 3) * 0.04;
      },
    },
    lunge: {
      loop: true,
      fn(t, p) {
        // swooping in flat out, arms thrust at you
        setJ(p, 'lShoulder', -1.55, 0, 0.12);
        setJ(p, 'rShoulder', -1.55, 0, -0.12);
        setJ(p, 'lElbow', -0.05);
        setJ(p, 'rElbow', -0.05);
        setJ(p, 'spine', 0.55);
        setJ(p, 'neck', -0.35);
        setJ(p, 'lHip', 0.7);
        setJ(p, 'rHip', 0.8);
        setJ(p, 'lKnee', 1.1);
        setJ(p, 'rKnee', 1.2);
        p[ROOT + 1] = 0.3;
      },
    },
    loom: {
      loop: true,
      fn(t, p) {
        // standing over you, head bowed and tilted, hands lifting
        setJ(p, 'lShoulder', -0.7 + S(t * 0.9) * 0.05, 0, 0.18);
        setJ(p, 'rShoulder', -0.7 + S(t * 0.9 + 1) * 0.05, 0, -0.18);
        setJ(p, 'lElbow', -0.6);
        setJ(p, 'rElbow', -0.6);
        setJ(p, 'spine', 0.12);
        setJ(p, 'neck', 0.35, 0, 0.25);
        p[ROOT + 1] = 0.16 + S(t * 1.1) * 0.02;
      },
    },
    hit: {
      dur: 0.4,
      fn(t, p) {
        const k = S(Math.min(1, t / 0.4) * PI);
        setJ(p, 'spine', -0.4 * k);
        setJ(p, 'neck', -0.4 * k);
        setJ(p, 'lShoulder', 0.3 * k, 0, 0.6 * k);
        setJ(p, 'rShoulder', 0.3 * k, 0, -0.6 * k);
        p[ROOT + 1] = 0.15;
      },
    },
    death: {
      dur: 1.5,
      fn(t, p) {
        const k = seg(t, 0, 1.5);
        setJ(p, 'lShoulder', -2.8 * k, 0, 0.4);
        setJ(p, 'rShoulder', -2.8 * k, 0, -0.4);
        setJ(p, 'neck', -0.7 * k);
        setJ(p, 'spine', -0.3 * k);
        p[ROOT + 1] = 0.15 + k * 0.8;
      },
    },
  };
}
