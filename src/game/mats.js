// Material cache. Textured materials remember how many metres one texture
// repeat covers, so geometry builders can produce world-scaled UVs.
import * as THREE from 'three';
import { tex, TEX_SIZE } from '../engine/textures.js';

const cache = new Map();

// Textured matte material.
export function M(name, opts = {}) {
  const key = 'M:' + name + JSON.stringify(opts);
  let m = cache.get(key);
  if (!m) {
    const Cls = opts.phong ? THREE.MeshPhongMaterial : THREE.MeshLambertMaterial;
    const p = { map: tex(name) };
    if (opts.color !== undefined) p.color = new THREE.Color(opts.color);
    if (opts.emissive !== undefined) p.emissive = new THREE.Color(opts.emissive);
    if (opts.emissiveMap) p.emissiveMap = tex(name);
    if (opts.emissiveIntensity !== undefined) p.emissiveIntensity = opts.emissiveIntensity;
    if (opts.phong) {
      p.shininess = opts.shininess ?? 30;
      p.specular = new THREE.Color(opts.specular ?? 0x222222);
    }
    if (opts.transparent) { p.transparent = true; p.opacity = opts.opacity ?? 1; p.depthWrite = !!opts.depthWrite; }
    if (opts.alphaTest) p.alphaTest = opts.alphaTest;
    if (opts.side) p.side = opts.side;
    if (opts.flat) p.flatShading = true;
    m = new Cls(p);
    m.userData.ts = opts.ts || TEX_SIZE[name] || [1, 1];
    cache.set(key, m);
  }
  return m;
}

// Flat-coloured material (characters, small props).
export function C(color, opts = {}) {
  const key = 'C:' + color + JSON.stringify(opts);
  let m = cache.get(key);
  if (!m) {
    const Cls = opts.phong ? THREE.MeshPhongMaterial : opts.basic ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
    const p = { color: new THREE.Color(color) };
    if (!opts.basic) p.flatShading = opts.flat !== false;
    if (opts.emissive !== undefined) p.emissive = new THREE.Color(opts.emissive);
    if (opts.emissiveIntensity !== undefined) p.emissiveIntensity = opts.emissiveIntensity;
    if (opts.phong) {
      p.shininess = opts.shininess ?? 40;
      p.specular = new THREE.Color(opts.specular ?? 0x333333);
    }
    if (opts.transparent) { p.transparent = true; p.opacity = opts.opacity ?? 1; p.depthWrite = !!opts.depthWrite; }
    if (opts.blending === 'add') { p.blending = THREE.AdditiveBlending; p.transparent = true; p.depthWrite = false; }
    if (opts.side) p.side = opts.side;
    m = new Cls(p);
    m.userData.ts = [1, 1];
    cache.set(key, m);
  }
  return m;
}

// Unique (non-cached) material, for things whose colour/opacity animates.
export function U(color, opts = {}) {
  const p = { color: new THREE.Color(color), ...opts };
  return opts.lambert ? new THREE.MeshLambertMaterial(p) : new THREE.MeshBasicMaterial(p);
}

export function spriteMat(name, color = 0xffffff, opacity = 1, additive = true) {
  return new THREE.SpriteMaterial({
    map: tex(name),
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

// Resolve a material spec: '#rrggbb' colour, texture name, or material.
export function mat(m) {
  if (!m) return C(0x808080);
  if (typeof m !== 'string') return m;
  if (m[0] === '#') return C(parseInt(m.slice(1), 16));
  return M(m);
}
