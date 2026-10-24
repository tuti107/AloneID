// Tiny particle bursts: blood, sparks, glass, dust, splashes.
import * as THREE from 'three';
import { tex } from '../engine/textures.js';

const mats = new Map();
function mat(color, additive) {
  const key = color + (additive ? 'a' : 'n');
  let m = mats.get(key);
  if (!m) {
    m = new THREE.SpriteMaterial({ map: tex('glow'), color: new THREE.Color(color), transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    mats.set(key, m);
  }
  return m;
}

const PRESETS = {
  blood: { color: 0x5a0606, n: 10, speed: 2.2, up: 1.6, life: 0.6, size: 0.07, gravity: 9, additive: false },
  ichor: { color: 0x1a3a10, n: 12, speed: 2.4, up: 1.8, life: 0.7, size: 0.08, gravity: 9, additive: false },
  spark: { color: 0xffc070, n: 8, speed: 3.5, up: 1.0, life: 0.3, size: 0.05, gravity: 6, additive: true },
  glass: { color: 0xb0c8e0, n: 18, speed: 3.0, up: 1.5, life: 0.9, size: 0.05, gravity: 9, additive: true },
  dust: { color: 0x8a8070, n: 6, speed: 0.6, up: 0.4, life: 0.9, size: 0.18, gravity: -0.3, additive: false },
  splash: { color: 0x506860, n: 14, speed: 1.8, up: 2.6, life: 0.7, size: 0.07, gravity: 9, additive: false },
  ember: { color: 0xff7a2a, n: 16, speed: 1.4, up: 2.5, life: 1.4, size: 0.06, gravity: -1.0, additive: true },
  ghost: { color: 0x8090ff, n: 14, speed: 0.8, up: 0.8, life: 1.2, size: 0.12, gravity: -0.6, additive: true },
};

export function burst(room, x, y, z, kind = 'blood', o = {}) {
  const P = { ...PRESETS[kind], ...o };
  const parts = [];
  for (let i = 0; i < P.n; i++) {
    const sp = new THREE.Sprite(mat(P.color, P.additive).clone());
    const s = P.size * (0.6 + Math.random() * 0.8);
    sp.scale.set(s, s, 1);
    sp.position.set(x, y, z);
    const a = Math.random() * Math.PI * 2;
    const v = P.speed * (0.4 + Math.random() * 0.6);
    let vx = Math.cos(a) * v, vz = Math.sin(a) * v;
    if (o.dir) { vx = vx * 0.4 + o.dir[0] * v; vz = vz * 0.4 + o.dir[1] * v; }
    parts.push({ sp, vx, vy: P.up * (0.5 + Math.random() * 0.8), vz, life: P.life * (0.6 + Math.random() * 0.6), t: 0 });
    room.dynamic.add(sp);
  }
  const upd = (dt) => {
    let alive = 0;
    for (const p of parts) {
      if (p.t >= p.life) continue;
      p.t += dt;
      p.vy -= P.gravity * dt;
      p.sp.position.x += p.vx * dt;
      p.sp.position.y = Math.max(0.01, p.sp.position.y + p.vy * dt);
      p.sp.position.z += p.vz * dt;
      if (p.sp.position.y <= 0.011) { p.vx *= 0.8; p.vz *= 0.8; }
      p.sp.material.opacity = Math.max(0, 1 - p.t / p.life);
      if (p.t >= p.life) room.dynamic.remove(p.sp);
      else alive++;
    }
    if (!alive) room.updaters.splice(room.updaters.indexOf(upd), 1);
  };
  room.updaters.push(upd);
}
