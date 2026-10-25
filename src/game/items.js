// Inventory item definitions and their little 3D models.
import * as THREE from 'three';
import { frustum } from '../engine/geom.js';
import * as F from './furniture.js';
import { C, M } from './mats.js';

const G = () => new THREE.Group();
const brass = () => M('brass', { phong: true, shininess: 60, specular: 0x887744 });

function book(color, gold = true) {
  return () => {
    const g = G();
    F.bx(g, C(color), 0.18, 0.04, 0.24, 0, 0, 0);
    F.bx(g, C(0xd8ccb0), 0.165, 0.032, 0.225, 0.008, 0.004, 0);
    if (gold) F.bx(g, C(0xb08a40), 0.06, 0.002, 0.08, 0, 0.04, 0.02);
    return g;
  };
}
function paperModel(tint = 0xd9cdb0) {
  return () => {
    const g = G();
    const m = F.bx(g, M('paper', { ts: [0.2, 0.26], color: tint }), 0.2, 0.004, 0.26, 0, 0, 0);
    m.rotation.y = 0.15;
    return g;
  };
}
function keyModel(m, size = 1) {
  return () => {
    const g = G();
    const mat = typeof m === 'function' ? m() : m;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035 * size, 0.01 * size, 4, 10), mat);
    ring.position.x = -0.07 * size;
    g.add(ring);
    F.bx(g, mat, 0.13 * size, 0.016 * size, 0.016 * size, 0.03 * size, -0.008 * size, 0);
    F.bx(g, mat, 0.02 * size, 0.04 * size, 0.012 * size, 0.08 * size, -0.045 * size, 0);
    F.bx(g, mat, 0.016 * size, 0.03 * size, 0.012 * size, 0.05 * size, -0.035 * size, 0);
    g.rotation.x = Math.PI / 2;
    const w = G();
    w.add(g);
    return w;
  };
}

function oilCan() {
  const g = G();
  F.bx(g, M('rust'), 0.14, 0.2, 0.08, 0, 0, 0);
  F.cy(g, M('iron'), 0.012, 0.02, 0.08, 0.04, 0.2, 0, 6);
  F.bx(g, M('iron'), 0.1, 0.015, 0.015, -0.01, 0.24, 0);
  F.bx(g, C(0xc8b080), 0.1, 0.08, 0.002, 0, 0.06, 0.041);
  return g;
}
function matchbox() {
  const g = G();
  F.bx(g, C(0x8a2a1a), 0.1, 0.025, 0.06, 0, 0, 0);
  F.bx(g, C(0xd8c890), 0.06, 0.002, 0.04, 0, 0.025, 0);
  for (let i = 0; i < 3; i++) {
    const m = F.bx(g, C(0xe0d0a0), 0.004, 0.004, 0.07, 0.07 + i * 0.008, 0, 0.0);
    m.rotation.y = 0.2 * i;
    F.sp(g, C(0x6a1010), 0.005, 0.07 + i * 0.008, 0.002, 0.035, 4, 3);
  }
  return g;
}
function flask() {
  const g = G();
  F.bx(g, C(0x8a8a8a, { phong: true, shininess: 80, specular: 0xaaaaaa }), 0.1, 0.14, 0.03, 0, 0, 0);
  F.cy(g, C(0x2a2a2a), 0.012, 0.012, 0.03, 0, 0.14, 0, 6);
  F.bx(g, M('leather'), 0.1, 0.06, 0.032, 0, 0.03, 0);
  return g;
}
function tonic() {
  const g = G();
  const pts = [new THREE.Vector2(0.035, 0), new THREE.Vector2(0.04, 0.08), new THREE.Vector2(0.015, 0.11), new THREE.Vector2(0.012, 0.14)];
  const b = new THREE.Mesh(new THREE.LatheGeometry(pts, 8), C(0x3a6a4a, { phong: true, shininess: 90 }));
  g.add(b);
  F.cy(g, C(0x5a3a1a), 0.014, 0.014, 0.02, 0, 0.14, 0, 6);
  F.bx(g, C(0xd8ccb0), 0.06, 0.04, 0.002, 0, 0.03, 0.04);
  return g;
}
function poker() {
  const g = G();
  const iron = M('iron', { phong: true, shininess: 40 });
  F.bx(g, iron, 0.018, 0.75, 0.018, 0, 0, 0);
  F.bx(g, iron, 0.018, 0.018, 0.09, 0, 0.0, 0.04);
  const tip = new THREE.Mesh(frustum(0.02, 0.02, 0.002, 0.002, -0.08), iron);
  tip.position.set(0, 0, 0);
  g.add(tip);
  F.bx(g, brass(), 0.04, 0.1, 0.04, 0, 0.72, 0);
  F.sp(g, brass(), 0.03, 0, 0.84, 0, 6, 4);
  return g;
}
function revolver() {
  const g = G();
  const steel = C(0x2a2a2e, { phong: true, shininess: 70, specular: 0x666666 });
  F.bx(g, steel, 0.03, 0.03, 0.17, 0, 0.05, 0.08);
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 6), steel);
  cyl.rotation.x = Math.PI / 2;
  cyl.position.set(0, 0.06, 0.0);
  g.add(cyl);
  F.bx(g, steel, 0.028, 0.05, 0.07, 0, 0.04, -0.03);
  const grip = F.bx(g, C(0x4a2a14), 0.028, 0.1, 0.045, 0, -0.06, -0.07);
  grip.rotation.x = -0.35;
  F.bx(g, steel, 0.006, 0.03, 0.02, 0, 0.0, -0.01);
  return g;
}
function ammoBox() {
  const g = G();
  F.bx(g, C(0x6a5a2a), 0.1, 0.04, 0.07, 0, 0, 0);
  F.bx(g, C(0xc8b880), 0.06, 0.002, 0.04, 0, 0.04, 0);
  for (let i = 0; i < 3; i++) F.cy(g, brass(), 0.006, 0.006, 0.03, -0.02 + i * 0.02, 0.04, 0.0, 6);
  return g;
}
function letter() {
  const g = G();
  F.bx(g, C(0xe0d8c8), 0.22, 0.004, 0.14, 0, 0, 0);
  F.bx(g, C(0x8a1a1a), 0.03, 0.006, 0.03, 0, 0.003, 0);
  return g;
}
function photo() {
  const g = G();
  F.bx(g, C(0x2a1a10), 0.16, 0.012, 0.2, 0, 0, 0);
  F.bx(g, M('portraitWoman', { ts: [0.13, 0.17] }), 0.13, 0.004, 0.17, 0, 0.01, 0);
  return g;
}
function windingKey() {
  const g = G();
  const b = brass();
  F.bx(g, b, 0.08, 0.02, 0.02, 0, 0.0, 0);
  F.bx(g, b, 0.02, 0.1, 0.02, 0, -0.1, 0);
  F.bx(g, b, 0.035, 0.035, 0.03, 0, -0.12, 0);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 3, 8), C(0x8a7a5a));
  ring.position.y = 0.04;
  g.add(ring);
  return g;
}
function recordDisc() {
  const g = G();
  const rec = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.006, 20), [M('woodBlack'), M('recordLabel', { ts: [1, 1] }), M('woodBlack')]);
  g.add(rec);
  return g;
}
export function starStoneModel() {
  const g = G();
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.05 : 0.12;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1 });
  geo.translate(0, 0, -0.015);
  const stone = new THREE.Mesh(geo, C(0x6a7a62, { phong: true, shininess: 30 }));
  g.add(stone);
  const mark = new THREE.Mesh(new THREE.CircleGeometry(0.025, 6), C(0xb0ff90, { basic: true }));
  mark.position.z = 0.025;
  g.add(mark);
  return g;
}

export const ITEMS = {
  lamp: {
    name: '石油ランプ', key: true, actions: ['use', 'examine', 'throw'],
    desc: (g) => (g.flags.lampLit ? '火の灯った石油ランプ。闇を照らす唯一の頼りだ。' : g.flags.lampOil ? '油は満ちている。あとは火を点けるだけだ。' : '真鍮の古い石油ランプ。油が切れている。'),
    model: () => F.oilLamp(),
  },
  oil: { name: 'ランプの油', actions: ['use', 'examine'], desc: '灯油の入ったブリキ缶。ランプに注げそうだ。', model: oilCan },
  matches: { name: 'マッチ箱', actions: ['use', 'examine'], desc: '湿気ていないマッチが数本残っている。', model: matchbox },
  flask: { name: 'ウイスキーの小瓶', actions: ['use', 'examine'], heal: 35, desc: '銀のスキットル。気付けにはちょうどいい。（体力が回復する）', model: flask },
  tonic: { name: '気付け薬', actions: ['use', 'examine'], heal: 100, desc: '薬局の古い気付け薬。（体力が大きく回復する）', model: tonic },
  poker: {
    name: '火かき棒', actions: ['equip', 'examine'], weapon: { kind: 'melee', dmg: 16, range: 1.3, clip: 'swing' },
    desc: '重い鉄の火かき棒。殴りつければ相当な威力だ。', model: poker,
  },
  revolver: {
    name: '回転式拳銃', actions: ['equip', 'examine'], weapon: { kind: 'gun', dmg: 34, range: 14, clip: 'shoot' },
    desc: (g) => `サイラスの護身用の拳銃。残弾 ${g.inv.ammo} 発。`, model: revolver,
  },
  ammo: { name: '拳銃の弾', actions: ['use', 'examine'], desc: '.38口径の弾丸が六発。', model: ammoBox },
  diary: { name: 'サイラスの日記', actions: ['read'], doc: 'diary', model: book(0x3a2414) },
  butler: { name: '執事の覚え書き', actions: ['read'], doc: 'butler', model: paperModel() },
  notes: { name: 'サイラスの覚え書き', actions: ['read'], doc: 'notes', model: paperModel(0xe0d4b8) },
  eleanor: { name: 'エレノアの手紙', actions: ['read'], doc: 'eleanor', model: letter },
  photo: { name: '古い写真', actions: ['read'], doc: 'photo', model: photo },
  claraNote: { name: 'クララの手帳', actions: ['read'], doc: 'clara', model: book(0x3a2430) },
  brassKey: { name: '真鍮の小さな鍵', key: true, actions: ['use', 'examine'], desc: '小さな真鍮の鍵。机の引き出しのものだろうか。', model: keyModel(brass, 0.8) },
  bedroomKey: { name: '寝室の鍵', key: true, actions: ['use', 'examine'], desc: '「主寝室」と刻まれた鉄の鍵。', model: keyModel(M('iron'), 1.1) },
  clockKey: { name: '時計のぜんまい鍵', key: true, actions: ['use', 'examine'], desc: '大時計のぜんまいを巻くための鍵。サイラスの首に掛かっていた。', model: windingKey },
  cellarKey: { name: '地下室の鍵', key: true, actions: ['use', 'examine'], desc: '錆びた大きな鉄の鍵。地下室の扉のものだ。', model: keyModel(M('rust'), 1.5) },
  record: { name: 'レコード盤', key: true, actions: ['use', 'examine'], desc: '古いワルツのレコード。ラベルには「エレノアへ」と手書きされている。', model: recordDisc },
  starstone: { name: '星の石', key: true, actions: ['use', 'examine'], desc: '五芒星の形に削られた灰緑色の石。中心に炎のような印が刻まれている。触れると、かすかに温かい。', model: starStoneModel },
};

export function itemDesc(g, id) {
  const d = ITEMS[id].desc;
  return typeof d === 'function' ? d(g) : d || '';
}

export class Inventory {
  constructor() {
    this.items = [];
    this.equipped = null;
    this.ammo = 0;
  }
  has(id) { return this.items.includes(id); }
  add(id) { if (!this.items.includes(id)) this.items.push(id); }
  remove(id) {
    this.items = this.items.filter((i) => i !== id);
    if (this.equipped === id) this.equipped = null;
  }
  serialize() { return { items: this.items.slice(), equipped: this.equipped, ammo: this.ammo }; }
  restore(d) {
    this.items = d.items.slice();
    this.equipped = d.equipped;
    this.ammo = d.ammo;
  }
}
