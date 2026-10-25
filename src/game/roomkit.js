// Room construction kit + runtime container. A room is one THREE.Scene with
// static geometry (merged per material on finalize), colliders, lights,
// camera shots, doors, triggers, interactables and monsters.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Box } from '../engine/collision.js';
import { uvBox, uvPlane } from '../engine/geom.js';
import { NavGrid } from '../engine/nav.js';
import { Shot, Occluder } from '../engine/camera.js';
import { noise1, clamp } from '../engine/util.js';
import { M, C, spriteMat, mat } from './mats.js';
import { tex } from '../engine/textures.js';
import { ITEMS } from './items.js';

export { mat };

// Pool of light under a door: brightest at the door edge (top of the
// texture), fading out into the room and towards the sides.
let spillCanvasTex = null;
function spillTex() {
  if (spillCanvasTex) return spillCanvasTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 32;
  const g = c.getContext('2d');
  const img = g.createImageData(64, 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 64; x++) {
      const u = (x + 0.5) / 64 * 2 - 1, v = (y + 0.5) / 32;
      const a = Math.max(0, 1 - v) ** 1.6 * Math.max(0, 1 - Math.abs(u) ** 2.2);
      const i = (y * 64 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(255 * a);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  spillCanvasTex = new THREE.CanvasTexture(c);
  spillCanvasTex.colorSpace = THREE.SRGBColorSpace;
  return spillCanvasTex;
}

export class Room {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(def.bg ?? 0x000000);
    this.static = new THREE.Group();
    this.dynamic = new THREE.Group();
    this.scene.add(this.static, this.dynamic);
    this.colliders = [];
    this.interactables = [];
    this.triggers = [];
    this.monsters = [];
    this.pushables = [];
    this.pickups = [];
    this.lights = [];
    this.updaters = [];
    this.shots = [];
    this.entries = {};
    this.ramps = [];
    this.windows = [];
    this.tags = {};
    this.floorZones = [];
    this.floorType = def.floorType || 'wood';
    this.bounds = def.bounds || [-10, -10, 10, 10];
    this.dark = !!def.dark;
    this.time = 0;
    this.flash = 0;
    this.hemiLight = null;
    this.visited = false;
  }

  get flags() { return this.game.flags; }

  tag(name, obj) {
    (this.tags[name] || (this.tags[name] = [])).push(obj);
    obj.userData.tag = name;
    return obj;
  }
  setTagVisible(name, v) {
    for (const o of this.tags[name] || []) o.visible = v;
  }

  // ------------------------------------------------------------ primitives
  // y is the bottom of the box.
  box(m, w, h, d, x, y, z, o = {}) {
    const material = mat(m);
    const mesh = new THREE.Mesh(uvBox(w, h, d, material.userData.ts || [1, 1]), material);
    mesh.position.set(x, y + h / 2, z);
    mesh.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
    mesh.castShadow = o.cast !== false;
    mesh.receiveShadow = o.receive !== false;
    const parent = o.parent || (o.dyn || o.tag ? this.dynamic : this.static);
    parent.add(mesh);
    if (o.tag) this.tag(o.tag, mesh);
    if (o.collide) this.collider(x, z, w / 2 + (o.pad || 0), d / 2 + (o.pad || 0), o.ry || 0, o);
    return mesh;
  }

  collider(x, z, hw, hd, rot = 0, o = {}) {
    const b = new Box(x, z, hw, hd, rot, { low: o.low, tag: o.ctag, owner: o.owner, solid: o.solid, y0: o.y0, y1: o.y1 });
    this.colliders.push(b);
    return b;
  }

  floor(x0, z0, x1, z1, m, y = 0, type = null) {
    const material = mat(m);
    const w = x1 - x0, d = z1 - z0;
    const mesh = new THREE.Mesh(uvPlane(w, d, material.userData.ts || [1, 1]), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    mesh.receiveShadow = true;
    this.static.add(mesh);
    if (type) this.floorZones.push({ r: [x0, z0, x1, z1], type });
    return mesh;
  }

  ceiling(x0, z0, x1, z1, m, y) {
    const material = mat(m);
    const w = x1 - x0, d = z1 - z0;
    const mesh = new THREE.Mesh(uvPlane(w, d, material.userData.ts || [1, 1]), material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    mesh.receiveShadow = true;
    this.static.add(mesh);
    return mesh;
  }

  // Arbitrary textured quad (a, b, c, d counter-clockwise seen from the front).
  quad(m, a, b, c, d, o = {}) {
    const material = mat(m);
    const ts = material.userData.ts || [1, 1];
    const lu = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const lv = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
    const u1 = lu / ts[0], v1 = lv / ts[1];
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, u1, 0, u1, v1, 0, 0, u1, v1, 0, v1], 2));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, o.double ? material.clone() : material);
    if (o.double) mesh.material.side = THREE.DoubleSide;
    mesh.castShadow = o.cast !== false;
    mesh.receiveShadow = true;
    (o.tag ? this.dynamic : this.static).add(mesh);
    if (o.tag) this.tag(o.tag, mesh);
    return mesh;
  }

  // Triangle (gable ends); uv uses world x/z along the base and y for height.
  tri(m, a, b, c, o = {}) {
    const material = mat(m);
    const ts = material.userData.ts || [1, 1];
    const base = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
    const along = (p) => Math.hypot(p[0] - a[0], p[2] - a[2]) / ts[0];
    g.setAttribute('uv', new THREE.Float32BufferAttribute([along(a), a[1] / ts[1], base / ts[0], b[1] / ts[1], along(c), c[1] / ts[1]], 2));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, material);
    mesh.castShadow = o.cast !== false;
    mesh.receiveShadow = true;
    (o.tag ? this.dynamic : this.static).add(mesh);
    if (o.tag) this.tag(o.tag, mesh);
    return mesh;
  }

  // Flat decal on the floor (rugs, blood, runner).
  decal(m, x, z, w, d, ry = 0, y = 0.005) {
    const material = typeof m === 'string' && m[0] !== '#' ? M(m, { transparent: m === 'blood', alphaTest: m === 'blood' ? 0.3 : 0, ts: [w, d] }) : mat(m);
    // Millimetres above the floor isn't enough on every GPU: also pull it
    // forward in depth (a step further per millimetre of height), so it
    // never flickers against the floor or a rug beneath it.
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1;
    material.polygonOffsetUnits = -(2 + Math.round(y * 1000));
    const g = new THREE.PlaneGeometry(w, d);
    const mesh = new THREE.Mesh(g, material);
    mesh.rotation.set(-Math.PI / 2, 0, ry);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    this.static.add(mesh);
    return mesh;
  }

  // ------------------------------------------------------------ walls
  // A straight wall whose inner face lies on the segment (x0,z0)-(x1,z1).
  // openings: [{at: distance from start to centre, w, h, sill, pass}]
  wall(x0, z0, x1, z1, o = {}) {
    const h = o.h ?? 3;
    const thick = o.thick ?? 0.2;
    const L = Math.hypot(x1 - x0, z1 - z0);
    let ux = (x1 - x0) / L, uz = (z1 - z0) / L;
    // inward normal: towards the room centre (or given explicitly)
    let nx = -uz, nz = ux;
    const cx = (this.bounds[0] + this.bounds[2]) / 2, cz = (this.bounds[1] + this.bounds[3]) / 2;
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const flip = o.normal ? o.normal[0] * nx + o.normal[1] * nz < 0 : (cx - mx) * nx + (cz - mz) * nz < 0;
    let openings = o.openings || [];
    if (flip) {
      // Reverse the wall so the box's +z face (with sane UVs) faces inward.
      [x0, z0, x1, z1] = [x1, z1, x0, z0];
      ux = -ux; uz = -uz;
      nx = -uz; nz = ux;
      openings = openings.map((op) => ({ ...op, at: L - op.at }));
    }
    const ry = Math.atan2(-uz, ux);
    const wm = mat(o.mat || 'plaster');
    const tag = o.tag;
    const parent = tag ? this.dynamic : this.static;
    const opens = openings.slice().sort((a, b) => a.at - b.at);
    // Vertical strips between opening edges, each with the openings crossing
    // it, so stacked openings (a window above a window) cut each other's wall
    // instead of bricking each other up.
    const cuts = [...new Set([0, L, ...opens.flatMap((op) => [op.at - op.w / 2, op.at + op.w / 2])])]
      .map((c) => Math.min(L, Math.max(0, c))).sort((a, b) => a - b);
    const strips = [];
    for (let i = 0; i + 1 < cuts.length; i++) {
      const a = cuts[i], b = cuts[i + 1], m = (a + b) / 2;
      if (b - a > 0.001) strips.push({ a, b, holes: opens.filter((op) => Math.abs(m - op.at) < op.w / 2).map((op) => [op.sill || 0, (op.sill || 0) + op.h]) });
    }

    const piece = (a, b, y0, y1, material, depth, inset) => {
      const len = b - a;
      if (len <= 0.001 || y1 - y0 <= 0.001) return null;
      const mesh = new THREE.Mesh(uvBox(len, y1 - y0, depth, material.userData.ts || [1, 1]), material);
      const t = (a + b) / 2;
      // centre: along the wall at t, pushed outward by depth/2 - inset
      const off = -depth / 2 + inset;
      mesh.position.set(x0 + ux * t + nx * off, (y0 + y1) / 2, z0 + uz * t + nz * off);
      mesh.rotation.y = ry;
      mesh.castShadow = o.cast !== false;
      mesh.receiveShadow = true;
      // UV continuity along the wall
      const uv = mesh.geometry.attributes.uv;
      const ts = material.userData.ts || [1, 1];
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) + a / ts[0]);
      for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) + y0 / ts[1]);
      parent.add(mesh);
      if (tag) this.tag(tag, mesh);
      return mesh;
    };

    // The band y0..y1 along the whole wall minus the openings; neighbouring
    // strips that come out the same share one piece.
    const band = (y0, y1, material, depth, inset) => {
      let run = null;
      const flush = () => { if (run) for (const [p0, p1] of run.ys) piece(run.a, run.b, p0, p1, material, depth, inset); };
      for (const st of strips) {
        let ys = [[y0, y1]];
        for (const [h0, h1] of st.holes) ys = ys.flatMap(([p0, p1]) => [[p0, Math.min(p1, h0)], [Math.max(p0, h1), p1]]);
        ys = ys.filter(([p0, p1]) => p1 - p0 > 0.001);
        const key = JSON.stringify(ys);
        if (run && run.key === key) run.b = st.b;
        else { flush(); run = { a: st.a, b: st.b, ys, key }; }
      }
      flush();
    };

    band(0, h, wm, thick, 0);
    // wainscot / baseboard / crown. Two walls' trim overlaps in the corner
    // they share, so trim on walls running along z sits 1.5 mm higher than
    // along x: their tops and undersides there never coincide.
    const alt = Math.abs(uz) > Math.abs(ux) ? 0.0015 : 0;
    const skirt = o.baseboard !== false ? 0.14 + alt : 0;
    if (o.wainscot) {
      const wh = (o.wainscotH ?? 1.0) + alt;
      // from the skirting up, so the two never end flush at an opening
      band(skirt, wh, mat(o.wainscot), 0.04, 0.04);
      band(wh, wh + 0.06, mat(o.trim || 'woodBlack'), 0.07, 0.07);
    }
    if (skirt) band(0, skirt, mat(o.trim || 'woodBlack'), 0.06, 0.06);
    if (o.crown) band(h - 0.12 - alt, h, mat(o.crown === true ? 'woodBlack' : o.crown), 0.1, 0.1);
    // colliders: whole wall unless an opening is passable
    if (o.collide !== false) {
      const cs = [];
      let st = 0;
      for (const op of opens) {
        if (op.pass) { cs.push([st, op.at - op.w / 2]); st = op.at + op.w / 2; }
      }
      cs.push([st, L]);
      for (const [a, b] of cs) {
        if (b - a <= 0.01) continue;
        const t = (a + b) / 2;
        const off = -thick / 2;
        this.collider(x0 + ux * t + nx * off, z0 + uz * t + nz * off, (b - a) / 2, thick / 2, ry);
      }
    }
    return { ux, uz, nx, nz, L, ry };
  }

  // Rectangular room shell. openings per side use absolute coordinates
  // (x for n/s walls, z for e/w walls).
  shell(x0, z0, x1, z1, o = {}) {
    const h = o.h ?? 3;
    if (!this.camRect) this.camRect = [x0, z0, x1, z1, h];
    if (o.floor) this.floor(x0, z0, x1, z1, o.floor, 0, o.floorType);
    if (o.ceil) this.ceiling(x0, z0, x1, z1, o.ceil, h);
    const sides = {
      n: [x0, z0, x1, z0, x0],
      s: [x1, z1, x0, z1, null],
      w: [x0, z1, x0, z0, null],
      e: [x1, z0, x1, z1, z0],
    };
    const walls = {};
    for (const k of ['n', 's', 'w', 'e']) {
      if (o.skip && o.skip.includes(k)) continue;
      const [ax, az, bx, bz] = sides[k];
      const ops = ((o.openings && o.openings[k]) || []).map((op) => {
        let at;
        if (k === 'n') at = op.at - x0;
        else if (k === 's') at = x1 - op.at;
        else if (k === 'w') at = z1 - op.at;
        else at = op.at - z0;
        return { ...op, at };
      });
      const so = (o.side && o.side[k]) || {};
      walls[k] = this.wall(ax, az, bx, bz, { ...o, ...so, h, openings: ops, tag: so.tag || (o.tags && o.tags[k]) });
    }
    return walls;
  }

  // ------------------------------------------------------------ placement
  place(obj, x, z, ry = 0, o = {}) {
    obj.position.set(x, o.y || 0, z);
    obj.rotation.y = ry;
    const parent = o.dyn || o.tag ? this.dynamic : this.static;
    if (parent === this.dynamic && o.occlude !== false) obj.userData.dynOcc = true;
    parent.add(obj);
    if (o.tag) this.tag(o.tag, obj);
    obj.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = o.cast !== false && !m.userData.noShadow;
        m.receiveShadow = !m.userData.noReceive;
      }
    });
    const col = o.collide === true ? obj.userData.col : o.collide;
    if (col) {
      const [w, d] = col;
      const ox = obj.userData.colOff ? obj.userData.colOff[0] : 0;
      const oz = obj.userData.colOff ? obj.userData.colOff[1] : 0;
      const c = Math.cos(ry), s = Math.sin(ry);
      obj.userData.collider = this.collider(x + ox * c + oz * s, z - ox * s + oz * c, w / 2, d / 2, ry, o);
    }
    if (obj.userData.update) this.updaters.push(obj.userData.update);
    return obj;
  }

  // ------------------------------------------------------------ lights
  hemi(sky, ground, intensity) {
    const l = new THREE.HemisphereLight(sky, ground, intensity);
    this.scene.add(l);
    this.hemiLight = l;
    this.hemiBase = intensity;
    return l;
  }

  point(x, y, z, o = {}) {
    const l = new THREE.PointLight(o.color ?? 0xffcc88, o.intensity ?? 4, o.distance ?? 8, o.decay ?? 2);
    l.position.set(x, y, z);
    if (o.shadow) this.shadowify(l, o.shadow);
    (o.parent || this.scene).add(l);
    this.lights.push({ light: l, base: l.intensity, flicker: o.flicker || 0, speed: o.speed || 6, phase: Math.random() * 100, window: false });
    return l;
  }

  spot(x, y, z, tx, ty, tz, o = {}) {
    const l = new THREE.SpotLight(o.color ?? 0xffffff, o.intensity ?? 10, o.distance ?? 15, o.angle ?? 0.6, o.penumbra ?? 0.5, o.decay ?? 2);
    l.position.set(x, y, z);
    l.target.position.set(tx, ty, tz);
    if (o.shadow) this.shadowify(l, o.shadow);
    this.scene.add(l, l.target);
    this.lights.push({ light: l, base: l.intensity, flicker: o.flicker || 0, speed: o.speed || 6, phase: Math.random() * 100, window: !!o.window });
    return l;
  }

  // A fake volumetric shaft of light: an open cone from (x,y,z) down to a
  // disc round (tx,ty,tz), fading out as it goes.
  shaft(x, y, z, tx, ty, tz, o = {}) {
    const top = new THREE.Vector3(x, y, z), bot = new THREE.Vector3(tx, ty, tz);
    const geo = new THREE.CylinderGeometry(o.r0 ?? 0.3, o.r ?? 1.5, top.distanceTo(bot), 16, 1, true);
    const c = new THREE.Color(o.color ?? 0x8aa0c8), a = o.alpha ?? 0.05;
    const pos = geo.attributes.position, col = [];
    for (let i = 0; i < pos.count; i++) col.push(c.r, c.g, c.b, pos.getY(i) > 0 ? a : 0);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.position.copy(top).add(bot).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.sub(bot).normalize());
    m.userData.noShadow = true;
    m.renderOrder = 5;
    this.dynamic.add(m);
    return m;
  }

  shadowify(l, q) {
    const size = q === 'hi' ? 1024 : 512;
    l.castShadow = true;
    l.userData.shadow = true;
    this.shadowLights = this.shadowLights || [];
    this.shadowLights.push(l);
    l.shadow.mapSize.set(size, size);
    l.shadow.bias = -0.002;
    l.shadow.normalBias = 0.02;
    if (l.shadow.camera) {
      l.shadow.camera.near = 0.2;
      l.shadow.camera.far = l.distance || 20;
    }
  }

  // A flickering flame sprite (+ optional light).
  flame(x, y, z, o = {}) {
    const sp = new THREE.Sprite(spriteMat('flame', o.color ?? 0xffffff, 0.95));
    const s = o.size ?? 0.12;
    sp.scale.set(s * 0.6, s, 1);
    sp.position.set(x, y + s * 0.4, z);
    (o.parent || this.dynamic).add(sp);
    const glow = new THREE.Sprite(spriteMat('glow', o.glow ?? 0xffa040, 0.35));
    glow.scale.set(s * 3, s * 3, 1);
    glow.position.copy(sp.position);
    (o.parent || this.dynamic).add(glow);
    const ph = Math.random() * 100;
    this.updaters.push((dt, t) => {
      const f = 1 + noise1(t * 9 + ph) * 0.18;
      sp.scale.set(s * 0.6 * (2 - f), s * f, 1);
      glow.material.opacity = 0.3 + noise1(t * 7 + ph) * 0.08;
    });
    let light = null;
    if (o.light !== false) {
      light = this.point(x, y + 0.15, z, { color: o.lightColor ?? 0xff9a40, intensity: o.intensity ?? 1.5, distance: o.distance ?? 5, flicker: o.flicker ?? 0.25, speed: 8, shadow: o.shadow, parent: o.parent });
    }
    return { sprite: sp, glow, light };
  }

  // ------------------------------------------------------------ openings
  // Window centred at (x,z) on a wall line; ry points local +z into the room.
  window(x, z, ry, o = {}) {
    const w = o.w ?? 1.0, h = o.h ?? 1.4, sill = o.sill ?? 0.9, thick = o.thick ?? 0.2;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    const frameM = mat(o.frame || 'woodBlack');
    const glassMat = new THREE.MeshBasicMaterial({ map: tex(o.view || 'nightWindow'), color: new THREE.Color(o.glassColor ?? 0x8090a0) });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat);
    glass.position.set(0, sill + h / 2, -thick + 0.02);
    g.add(glass);
    const rainMat = new THREE.MeshBasicMaterial({ map: tex('rain').clone(), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
    rainMat.map.needsUpdate = true;
    rainMat.map.repeat.set(w * 1.5, h * 1.5);
    const rain = new THREE.Mesh(new THREE.PlaneGeometry(w, h), rainMat);
    rain.position.set(0, sill + h / 2, -thick + 0.05);
    if (o.rain !== false) g.add(rain);
    const fb = (bw, bh, bd, bx, by, bz) => {
      const m = new THREE.Mesh(uvBox(bw, bh, bd), frameM);
      m.position.set(bx, by, bz);
      m.castShadow = true;
      g.add(m);
    };
    const ft = 0.07;
    // frame: 3 mm proud of the opening's sides and head, never flush with the
    // wall's own faces there (flush faces flicker against each other)
    fb(w + ft * 2, ft, 0.08, 0, sill + h + ft / 2 - 0.003, -thick + 0.06);
    fb(w + ft * 2, ft, 0.08, 0, sill - ft / 2, -thick + 0.06);
    fb(ft, h, 0.08, -w / 2 - ft / 2 + 0.003, sill + h / 2, -thick + 0.06);
    fb(ft, h, 0.08, w / 2 + ft / 2 - 0.003, sill + h / 2, -thick + 0.06);
    // mullions (the crossbar a touch shallower, so their faces don't coincide)
    fb(0.04, h, 0.04, 0, sill + h / 2, -thick + 0.07);
    fb(w, 0.04, 0.036, 0, sill + h * 0.62, -thick + 0.07);
    if (o.panes !== false) {
      fb(w, 0.03, 0.03, 0, sill + h * 0.3, -thick + 0.07);
    }
    // sill board, its top a hair above the wall and frame beneath it
    fb(w + 0.2, 0.05, thick + 0.12, 0, sill - 0.02, -thick / 2 + 0.06);
    if (o.curtains) {
      const cm = M(o.curtains, { side: THREE.DoubleSide });
      for (const sx of [-1, 1]) {
        const cw = o.curtainW ?? 0.45;
        const c = new THREE.Mesh(uvBox(cw, sill + h + 0.25, 0.06, [1, 2]), cm);
        c.position.set(sx * (w / 2 + cw / 2 - 0.12), (sill + h + 0.25) / 2 + 0.02, 0.08);
        c.castShadow = true;
        g.add(c);
      }
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, w + 1.1, 6), M('brass'));
      rod.rotation.z = Math.PI / 2;
      rod.position.set(0, sill + h + 0.3, 0.08);
      g.add(rod);
    }
    (o.dyn ? this.dynamic : this.static).add(g);
    // moonlight
    let light = null;
    if (o.light !== false) {
      const c = Math.cos(ry), s = Math.sin(ry);
      const toW = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
      const [lx, lz] = toW(o.lightOff ?? 0, -2.6);
      const [tx, tz] = toW(o.lightOff ?? 0, 2.6);
      light = this.spot(lx, sill + h + 1.6, lz, tx, 0, tz, {
        color: o.color ?? 0x7f90c8, intensity: o.intensity ?? 14, distance: 14, angle: o.angle ?? 0.55, penumbra: 0.7,
        shadow: o.shadow, window: true,
      });
    }
    // Fake volumetric shaft of moonlight through the opening.
    let beam = null;
    if (light && o.beam !== false) {
      const lp = light.position;
      const c = Math.cos(ry), s = Math.sin(ry);
      const corners = [[-w / 2, sill], [w / 2, sill], [w / 2, sill + h], [-w / 2, sill + h]].map(([lx, ly]) => new THREE.Vector3(x + lx * c, ly, z - lx * s));
      const far = corners.map((p) => {
        const d = p.clone().sub(lp);
        const t = d.y < -0.01 ? (0.02 - lp.y) / d.y : 3;
        return lp.clone().addScaledVector(d, Math.min(t, 6));
      });
      const pos = [], col = [];
      const near = 0.011 * (o.beamStrength ?? 1);
      const quadAt = (a, b, cc, d, ia, ib) => {
        for (const [p, al] of [[a, ia], [b, ia], [cc, ib], [a, ia], [cc, ib], [d, ib]]) {
          pos.push(p.x, p.y, p.z);
          col.push(0.55, 0.62, 0.85, al);
        }
      };
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        quadAt(corners[i], corners[j], far[j], far[i], near, 0);
      }
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      bg.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
      const bm = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      beam = new THREE.Mesh(bg, bm);
      beam.userData.noShadow = true;
      beam.renderOrder = 5;
      this.dynamic.add(beam);
    }
    const rec = { glassMat, rainMat, light, beam, glass, rain, group: g, base: glassMat.color.clone() };
    this.windows.push(rec);
    this.updaters.push((dt) => { rainMat.map.offset.y += dt * 2.2; });
    return rec;
  }

  // Door in a wall opening. (x, z) on the inner wall line, ry faces the room.
  door(x, z, ry, o = {}) {
    const w = o.w ?? 1.0, h = o.h ?? 2.15;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    const frameM = mat(o.frame || 'woodBlack');
    const panelM = mat(o.panel || 'woodRed');
    const fb = (parent, m, bw, bh, bd, bx, by, bz) => {
      const mesh = new THREE.Mesh(uvBox(bw, bh, bd, m.userData.ts || [1, 1]), m);
      mesh.position.set(bx, by, bz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    // architrave, its inner edges 3 mm inside the opening so they never lie
    // flush with the wainscot and skirting ends behind them
    fb(g, frameM, 0.123, h + 0.12, 0.05, -w / 2 - 0.0585, (h + 0.12) / 2, 0.02);
    fb(g, frameM, 0.123, h + 0.12, 0.05, w / 2 + 0.0585, (h + 0.12) / 2, 0.02);
    fb(g, frameM, w + 0.36, 0.14, 0.07, 0, h + 0.07, 0.03);
    // dark void behind the door
    const voidM = C(0x050403);
    const voidMesh = fb(g, voidM, w, h, 0.02, 0, h / 2, -0.19);
    const reveal = mat(o.wallMat || 'plaster');
    fb(g, reveal, 0.02, h - 0.02, 0.2, -w / 2 + 0.01, (h - 0.02) / 2, -0.1);
    fb(g, reveal, 0.02, h - 0.02, 0.2, w / 2 - 0.01, (h - 0.02) / 2, -0.1);
    fb(g, reveal, w, 0.02, 0.2, 0, h - 0.01, -0.1);
    const leaves = [];
    const makeLeaf = (lw, hingeX, dir) => {
      const pivot = new THREE.Group();
      pivot.position.set(hingeX, 0, -0.06);
      g.add(pivot);
      const cx = dir * lw / 2;
      fb(pivot, panelM, lw - 0.01, h - 0.01, 0.05, cx, h / 2, 0);
      // raised panels
      const pm = mat(o.panelInset || o.panel || 'woodRed');
      for (const py of [h * 0.28, h * 0.72]) {
        fb(pivot, pm, lw * 0.62, h * 0.32, 0.02, cx, py, 0.035);
      }
      if (o.glass) {
        // clear of the raised panel behind it (0.025-0.045)
        const gm = new THREE.MeshBasicMaterial({ color: 0x223040 });
        fb(pivot, gm, lw * 0.5, h * 0.25, 0.02, cx, h * 0.72, 0.058);
      }
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), M('brass', { phong: true, shininess: 60, specular: 0x887755 }));
      knob.position.set(cx + dir * (lw / 2 - 0.09), 1.0, 0.07);
      pivot.add(knob);
      const plate = fb(pivot, M('brass'), 0.04, 0.16, 0.01, cx + dir * (lw / 2 - 0.09), 1.0, 0.03);
      void plate;
      leaves.push({ pivot, dir });
    };
    if (o.double) {
      makeLeaf(w / 2, -w / 2, 1);
      makeLeaf(w / 2, w / 2, -1);
    } else makeLeaf(w, o.hinge === 'right' ? w / 2 : -w / 2, o.hinge === 'right' ? -1 : 1);
    if (o.spill) {
      // light from the room beyond: a bright line under the door and a pool
      // on the floor in front of it, so a door reads even in a dark hall
      const add = (geo, m, y, z) => {
        const me = new THREE.Mesh(geo, m);
        me.position.set(0, y, z);
        me.rotation.x = -Math.PI / 2;
        me.renderOrder = 1;
        g.add(me);
      };
      const glowM = (op, map) => new THREE.MeshBasicMaterial({
        color: o.spill, map, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -12,
      });
      add(new THREE.PlaneGeometry(w - 0.06, 0.05), glowM(1), 0.012, -0.03);
      add(new THREE.PlaneGeometry(w + 0.7, 1.0), glowM(0.5, spillTex()), 0.014, 0.5);
    }
    this.dynamic.add(g);
    const c = Math.cos(ry), s = Math.sin(ry);
    const col = this.collider(x - s * 0.1, z - c * 0.1, w / 2 + 0.05, 0.2, ry, { ctag: 'door' });
    const doorId = o.id || `door:${this.id}:${o.to || 'x'}:${x.toFixed(1)},${z.toFixed(1)}`;
    const door = {
      kind: 'door', group: g, leaves, collider: col, x, z, ry, w, h, ...o, id: doorId, voidMesh,
      open: 0,
      setOpen(v) {
        this.open = v;
        for (const l of leaves) l.pivot.rotation.y = l.dir * v * 1.35;
      },
    };
    col.owner = door;
    // interaction point a little inside the room
    this.interact({
      id: doorId,
      x: x + s * 0.45, z: z + c * 0.45, r: w * 0.5, label: o.label || '扉', door,
      verb: '開ける',
      use: (game) => game.useDoor(this, door),
      item: o.key ? (game, item) => (item === o.key ? game.useDoor(this, door, item) : false) : null,
    });
    return door;
  }

  // ------------------------------------------------------------ stairs/floors
  // Straight flight. (x, z) = centre of the bottom edge; dir = 'n'|'s'|'e'|'w'
  stairs(x, z, dir, o = {}) {
    const w = o.w ?? 1.4, len = o.len ?? 4, rise = o.rise ?? 3, steps = o.steps ?? 14;
    const stepM = mat(o.mat || 'wood');
    const runM = o.carpet ? M(o.carpet) : null;
    const sideM = mat(o.side || o.mat || 'wood');
    const d = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[dir];
    const ry = Math.atan2(d[0], d[1]);
    const g = new THREE.Group();
    g.position.set(x, o.y0 || 0, z);
    g.rotation.y = ry;
    const run = len / steps, sh = rise / steps;
    for (let i = 0; i < steps; i++) {
      const top = (i + 1) * sh;
      const m = new THREE.Mesh(uvBox(w, top, run, stepM.userData.ts), stepM);
      m.position.set(0, top / 2, i * run + run / 2);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      if (runM) {
        const r = new THREE.Mesh(uvBox(w * 0.7, 0.01, run + 0.002, [w * 0.7, run]), runM);
        r.position.set(0, top + 0.005, i * run + run / 2);
        r.receiveShadow = true;
        g.add(r);
      }
    }
    const rail = (sx) => {
      // stringer
      const str = new THREE.Mesh(uvBox(0.08, 0.25, Math.hypot(len, rise) + 0.1, sideM.userData.ts), sideM);
      str.position.set(sx * (w / 2 + 0.04), rise / 2 + 0.05, len / 2);
      str.rotation.x = -Math.atan2(rise, len);
      g.add(str);
      if (o.rail !== false) {
        const bal = M('woodBlack');
        for (let i = 0; i < steps; i += 1) {
          const b = new THREE.Mesh(uvBox(0.04, 0.9, 0.04), bal);
          b.position.set(sx * (w / 2 - 0.05), (i + 1) * sh + 0.45, i * run + run / 2);
          b.castShadow = true;
          g.add(b);
        }
        const hr = new THREE.Mesh(uvBox(0.08, 0.06, Math.hypot(len, rise) + 0.2), bal);
        hr.position.set(sx * (w / 2 - 0.05), rise / 2 + 0.95, len / 2);
        hr.rotation.x = -Math.atan2(rise, len);
        hr.castShadow = true;
        g.add(hr);
        const post = new THREE.Mesh(uvBox(0.12, 1.15, 0.12), bal);
        post.position.set(sx * (w / 2 - 0.05), 0.575, 0.05);
        g.add(post);
      }
    };
    for (const sx of o.sides || [-1, 1]) rail(sx);
    this.static.add(g);
    // walkable ramp
    const ex = x + d[0] * len, ez = z + d[1] * len;
    const y0 = o.y0 || 0;
    if (dir === 'n' || dir === 's') {
      this.ramp(x - w / 2, Math.min(z, ez), x + w / 2, Math.max(z, ez), 'z', dir === 's' ? y0 : y0 + rise, dir === 's' ? y0 + rise : y0);
    } else {
      this.ramp(Math.min(x, ex), z - w / 2, Math.max(x, ex), z + w / 2, 'x', dir === 'e' ? y0 : y0 + rise, dir === 'e' ? y0 + rise : y0);
    }
    // side walls for collision
    if (o.collideSides !== false) {
      const c = Math.cos(ry), s = Math.sin(ry);
      for (const sx of o.collideSides || [-1, 1]) {
        const lx = sx * (w / 2 + 0.06), lz = len / 2;
        this.collider(x + lx * c + lz * s, z - lx * s + lz * c, 0.06, len / 2, ry);
      }
    }
    return g;
  }

  // Height zone with linear slope along an axis ('x' or 'z').
  ramp(x0, z0, x1, z1, axis, yStart, yEnd) {
    this.ramps.push({ x0, z0, x1, z1, axis, yStart, yEnd });
  }
  platform(x0, z0, x1, z1, y) {
    this.ramps.push({ x0, z0, x1, z1, axis: null, yStart: y, yEnd: y });
  }

  floorY(x, z) {
    let y = 0;
    let found = false;
    for (const r of this.ramps) {
      if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
      let v;
      if (!r.axis) v = r.yStart;
      else {
        const t = r.axis === 'x' ? (x - r.x0) / (r.x1 - r.x0) : (z - r.z0) / (r.z1 - r.z0);
        v = r.yStart + (r.yEnd - r.yStart) * clamp(t, 0, 1);
      }
      if (!found || v > y) { y = v; found = true; }
    }
    return y;
  }

  floorTypeAt(x, z) {
    // a flooded floor splashes, whatever it is made of
    if (this.waterAt && this.waterAt(x, z)) return 'water';
    for (let i = this.floorZones.length - 1; i >= 0; i--) {
      const f = this.floorZones[i];
      if (x >= f.r[0] && x <= f.r[2] && z >= f.r[1] && z <= f.r[3]) return f.type;
    }
    return this.floorType;
  }

  // ------------------------------------------------------------ logic
  interact(def) {
    const it = { r: 0.5, y: 1.0, label: '調べる', verb: '調べる', enabled: null, ...def };
    this.interactables.push(it);
    return it;
  }
  trigger(def) {
    const t = { once: false, inside: false, ...def };
    this.triggers.push(t);
    return t;
  }
  // Furniture that slides along one axis when pushed. obj must already be
  // placed (dyn). t=0 is its current position; t in [min, max].
  pushable(obj, o) {
    const ox = obj.position.x, oz = obj.position.z;
    const room = this;
    const box = this.collider(ox, oz, o.hw, o.hd, obj.rotation.y, { ctag: 'push' });
    const p = {
      id: o.id, obj, box, axis: o.axis, min: o.min ?? 0, max: o.max, t: 0, enabled: true,
      push(delta, g) {
        const nt = clamp(this.t + delta, this.min, this.max);
        if (Math.abs(nt - this.t) < 1e-5) return 0;
        this.dustT = (this.dustT || 0) + Math.abs(nt - this.t);
        this.setT(nt, g);
        g.audio.scrape && g.audio.scrape(obj.position);
        if (this.dustT > 0.3) {
          this.dustT = 0;
          g.burst && g.burst('dust', obj.position.x - this.axis[0] * 0.3, 0.05, obj.position.z - this.axis[1] * 0.3);
        }
        return nt;
      },
      setT(t, g, silent = false) {
        this.t = t;
        obj.position.x = ox + this.axis[0] * t;
        obj.position.z = oz + this.axis[1] * t;
        box.x = obj.position.x;
        box.z = obj.position.z;
        if (obj.userData.occluders) {
          obj.updateMatrixWorld(true);
          for (const oc of obj.userData.occluders) oc.refresh();
        }
        if (o.onMove) o.onMove(t, g, silent);
        if (!silent && (t >= this.max - 1e-4 || t <= this.min + 1e-4) && o.onEnd) o.onEnd(t, g);
        room.navDirty = true;
      },
    };
    box.owner = p;
    if (o.t) p.setT(o.t, this.game, true);
    this.pushables.push(p);
    return p;
  }

  // An item lying in the world that can be picked up.
  pickup(item, x, y, z, o = {}) {
    const flag = 'taken:' + (o.id || item);
    if (this.game.flags[flag]) return null;
    const model = o.model ? o.model() : ITEMS[item].model();
    model.position.set(x, y, z);
    model.rotation.y = o.ry || 0;
    if (o.rx) model.rotation.x = o.rx;
    if (o.scale) model.scale.setScalar(o.scale);
    model.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    this.dynamic.add(model);
    let glint = null;
    if (o.glint !== false) {
      glint = new THREE.Sprite(spriteMat('glow', 0xfff0c0, 0.0));
      glint.scale.set(0.18, 0.18, 1);
      glint.position.set(x, y + 0.06, z);
      this.dynamic.add(glint);
      const ph = Math.random() * 10;
      this.updaters.push((dt, t) => { glint.material.opacity = Math.max(0, Math.sin(t * 1.7 + ph)) * 0.35; });
    }
    const it = this.interact({
      id: flag, x, z, r: o.r ?? 0.3, y,
      label: o.label || ITEMS[item].name,
      verb: '取る',
      reach: o.reach ?? 0.75,
      use: async (g) => {
        if (o.before && (await o.before(g)) === false) return;
        if (y < 0.55) await g.searchAnim(); else await g.reachAnim();
        model.visible = false;
        if (glint) glint.visible = false;
        g.flags[flag] = true;
        this.interactables = this.interactables.filter((i) => i !== it);
        await g.give(item, o.give || {});
        if (o.onTake) await o.onTake(g);
      },
    });
    return { model, it };
  }

  shot(def) {
    const s = new Shot(def);
    s.hide = def.hide || [];
    this.shots.push(s);
    return s;
  }
  entry(name, x, z, rot) {
    this.entries[name] = { x, z, rot };
  }
  addMonster(m) {
    this.monsters.push(m);
    this.dynamic.add(m.root);
    return m;
  }

  // ------------------------------------------------------------ runtime
  update(dt) {
    this.time += dt;
    const t = this.time;
    if (this.navDirty && this.nav) {
      this.navT = (this.navT || 0) + dt;
      if (this.navT > 0.5) { this.navT = 0; this.navDirty = false; this.nav.rebuild(this.colliders, 0.34); }
    }
    for (const u of this.updaters.slice()) u(dt, t);
    const flash = this.flash;
    for (const L of this.lights) {
      let k = 1;
      if (L.flicker) k += noise1(t * L.speed + L.phase) * L.flicker;
      let i = L.base * k;
      if (L.window) i += flash * L.base * 6;
      if (L.light.userData.off) i = 0;
      L.light.intensity = i;
    }
    for (const w of this.windows) {
      w.glassMat.color.copy(w.base).multiplyScalar(1 + flash * 3);
      if (w.beam) w.beam.material.opacity = 1 + flash * 2;
    }
    if (this.hemiLight) this.hemiLight.intensity = this.hemiBase + flash * 0.6;
  }

  // Merge static meshes per material to cut draw calls; build navigation.
  finalize() {
    this.static.updateMatrixWorld(true);
    this.dynamic.updateMatrixWorld(true);
    this.collectOccluders();
    const groups = new Map();
    const victims = [];
    this.static.traverse((o) => {
      if (!o.isMesh || Array.isArray(o.material) || o.userData.keep || o.userData.tag) return;
      const key = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
      let arr = groups.get(key);
      if (!arr) { arr = { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, geos: [] }; groups.set(key, arr); }
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      for (const name of Object.keys(g.attributes)) {
        if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
      }
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.morphAttributes = {};
      arr.geos.push(g);
      victims.push(o);
    });
    for (const v of victims) v.parent.remove(v);
    const merged = new THREE.Group();
    for (const { mat: m, cast, recv, geos } of groups.values()) {
      const g = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!g) continue;
      const mesh = new THREE.Mesh(g, m);
      mesh.castShadow = cast;
      mesh.receiveShadow = recv;
      mesh.matrixAutoUpdate = false;
      merged.add(mesh);
    }
    this.scene.add(merged);
    this.mergedCount = merged.children.length;
    this.buildNav();
    this.buildAutoShots();
  }

  // Opaque, shadow-casting meshes become view blockers for the camera
  // director (oriented boxes, so sloped beams stay tight).
  collectOccluders() {
    const occ = [];
    const ok = (m) => {
      if (!m.isMesh || !m.castShadow || !m.visible) return false;
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      if (!mat || mat.transparent || mat.isMeshBasicMaterial) return false;
      const g = m.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      const sz = g.boundingBox.getSize(new THREE.Vector3());
      const sc = m.getWorldScale(new THREE.Vector3());
      return Math.max(sz.x * sc.x, sz.y * sc.y, sz.z * sc.z) >= 0.3;
    };
    this.static.traverse((m) => { if (ok(m)) occ.push(new Occluder(m)); });
    for (const obj of this.dynamic.children) {
      if (!obj.userData.dynOcc) continue;
      const list = [];
      obj.traverse((m) => { if (ok(m)) list.push(new Occluder(m)); });
      obj.userData.occluders = list;
      occ.push(...list);
    }
    this.occluders = occ;
  }

  // Corner cameras near the ceiling, used whenever the authored shots lose
  // sight of the player.
  buildAutoShots() {
    const r = this.def.camRect || this.camRect || [this.bounds[0] + 0.4, this.bounds[1] + 0.4, this.bounds[2] - 0.4, this.bounds[3] - 0.4, 3.2];
    this.camRect = r;
    this.autoShots = [];
    if (this.def.autoShots === false) return;
    const [x0, z0, x1, z1, h] = r;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const y = h > 4 ? Math.min(h - 0.6, 4.8) : h - 0.25;
    const inside = (p) => this.occluders.some((o) => o.contains(p));
    let i = 0;
    for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
      const pos = new THREE.Vector3(px + Math.sign(cx - px) * 0.35, y, pz + Math.sign(cz - pz) * 0.35);
      for (let k = 0; k < 4 && inside(pos); k++) {
        pos.x += Math.sign(cx - pos.x) * 0.4;
        pos.z += Math.sign(cz - pos.z) * 0.4;
      }
      if (inside(pos)) continue;
      this.autoShots.push(new Shot({ id: 'auto' + i++, pos: pos.toArray(), look: [cx, 0.5, cz], fov: 62, auto: true }));
    }
  }

  buildNav() {
    this.nav = new NavGrid(this.bounds, 0.25);
    this.nav.rebuild(this.colliders, 0.34);
  }
}
