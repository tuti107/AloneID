// 厨房 — Morgan the cook is still preparing dinner.
import * as THREE from 'three';
import * as F from '../furniture.js';
import { M, C } from '../mats.js';

export default {
  id: 'kitchen',
  name: '厨房',
  bounds: [-4.2, -3.2, 4.2, 3.2],
  floorType: 'tile',
  ambience: 'kitchen',
  build(r, g) {
    const H = 3.0;
    const act2 = g.act >= 2;
    if (act2) r.ambience = 'tide';
    r.shell(-4, -3, 4, 3, {
      h: H, floor: 'kitchenFloor', ceil: 'plasterDark', mat: 'plaster', wainscot: 'tileWhite', wainscotH: 1.3, trim: 'woodLight',
      openings: { w: [{ at: 1.6, w: 1.0, h: 2.15 }], e: [{ at: 2.0, w: 1.0, h: 2.15 }], s: [{ at: 1.4, w: 1.1, h: 1.2, sill: 1.1 }] },
    });
    // the back door, out to the servants' wing: wired shut from this side
    // in the first act, the wire snapped in the second
    r.door(4, 2.0, -Math.PI / 2, {
      id: 'backDoor', to: 'servants', entry: 'fromKitchen', label: '裏口', wallMat: 'plaster', panel: 'wood',
      locked: (gg) => gg.act < 2, lockedMsg: '裏口の扉は、内側から針金で何重にも縛られている。\n……誰かが、何かを閉じ込めようとしたのか。',
      onOpen: async (gg) => {
        if (gg.hasRoom('servants')) return true;
        await gg.notYet();
        return false;
      },
    });
    r.entry('fromServants', 3.4, 2.0, -Math.PI / 2);
    if (!act2) {
      for (const [y, rz] of [[0.9, 0.35], [1.0, -0.3], [1.12, 0.1]]) r.box('iron', 0.012, 0.012, 1.05, 3.93, y, 2.0, { rx: rz, cast: false });
    } else {
      // snapped, hanging off the handle
      r.box('iron', 0.012, 0.5, 0.012, 3.93, 0.55, 2.38, { rz: 0.3, cast: false });
    }
    r.door(-4, 1.6, Math.PI / 2, { to: 'hall', entry: 'fromKitchen', label: '広間への扉', wallMat: 'plaster', panel: 'wood' });
    r.entry('fromHall', -3.4, 1.6, Math.PI / 2);
    r.window(1.4, 3, Math.PI, { w: 1.1, h: 1.2, sill: 1.1, intensity: 40, shadow: 'lo' });

    const stove = F.stove({ chimney: 2.1 });
    r.place(stove, 0.4, -2.62, 0, { collide: true });
    const sg = stove.userData.glowPos;
    // the fire is out in the second act
    r.point(0.4 + sg[0], sg[1], -2.62 + sg[2], { color: 0xff5a20, intensity: act2 ? 0.6 : 7, distance: 6, flicker: 0.3, shadow: 'lo' });
    // a pot still bubbling
    F.cy(r.static, 'iron', 0.2, 0.18, 0.28, 0.1, 0.89, -2.55, 10);
    F.cy(r.static, C(0x3a1a10), 0.185, 0.185, 0.006, 0.1, 1.17, -2.55, 10);
    const steam = [];
    for (let i = 0; i < (act2 ? 0 : 4); i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: M('smoke').map, color: 0xd0c8c0, transparent: true, opacity: 0.25, depthWrite: false }));
      sp.scale.set(0.4, 0.4, 1);
      r.dynamic.add(sp);
      steam.push({ sp, ph: i / 4 });
    }
    r.updaters.push((dt, t) => {
      for (const s of steam) {
        const k = (t * 0.35 + s.ph) % 1;
        s.sp.position.set(0.1 + Math.sin(t + s.ph * 6) * 0.08, 1.2 + k * 1.1, -2.55);
        s.sp.material.opacity = 0.22 * (1 - k);
        s.sp.scale.setScalar(0.3 + k * 0.6);
      }
    });
    r.interact({ id: 'pot', x: 0.2, z: -1.95, r: 0.5, label: '大鍋', use: (gg) => gg.say(gg.act >= 2 ? '大鍋は冷え切っている。\n中身は、いつの間にか黒い海水に変わっていた。' : '大鍋の中で、何かが煮えている。\n……覗き込むと、白く濁った目玉がひとつ、浮かび上がってきた。') });

    r.place(F.counter({ w: 2.6, d: 0.62, h: 0.92 }), 3.68, -0.1, -Math.PI / 2, { collide: true });
    r.place(F.counter({ w: 2.0, d: 0.62, h: 0.92 }), -2.6, -2.68, 0, { collide: true });
    r.place(F.shelf({ w: 1.4, h: 1.7, d: 0.3, seed: 7 }), 2.55, -2.82, 0, { collide: true });
    r.place(F.shelf({ w: 1.2, h: 1.4, d: 0.3, seed: 3 }), -2.6, -2.85, 0, { y: 1.35 });
    r.place(F.choppingTable(), -0.2, 0.5, 0.05, { collide: true });
    const rack = F.potRack({ w: 1.5 });
    rack.position.set(-0.2, 2.45, 0.5);
    r.static.add(rack);
    r.box('iron', 0.02, 0.55, 0.02, -0.9, 2.45, 0.5);
    r.box('iron', 0.02, 0.55, 0.02, 0.5, 2.45, 0.5);
    r.place(F.barrel(), -3.45, -1.6, 0, { collide: true });
    r.place(F.barrel({ r: 0.28, h: 0.7 }), -3.55, 2.6, 0.5, { collide: true });
    r.place(F.crate({ s: 0.55 }), -1.1, 2.6, 0.2, { collide: true });
    // hanging carcasses
    for (const [x, z] of [[3.55, -1.75], [3.5, -1.15]]) {
      r.box('iron', 0.02, 0.5, 0.02, x, 2.5, z);
      const m = r.box(C(0x6a1a14), 0.3, 0.9, 0.22, x, 1.55, z, { ry: x });
      void m;
    }
    r.decal('blood', 0.4, -1.2, 1.2, 1.2, 0.3);
    r.decal('blood', 3.2, -1.5, 0.8, 0.8, 1.0);

    // pantry cupboard: oil and matches
    const pantry = F.wardrobe({ w: 1.1, h: 2.1, d: 0.5, wood: 'woodLight' });
    r.place(pantry, -3.73, -0.35, Math.PI / 2, { collide: true, dyn: true });
    r.pantry = pantry;
    if (g.flags.pantryOpen) pantry.userData.setOpen(0.8);
    r.interact({
      id: 'pantry', x: -3.15, z: -0.35, r: 0.5, label: '食料棚',
      verb: (gg) => (gg.flags.pantryOpen ? '調べる' : '開ける'),
      use: async (gg) => {
        if (gg.flags.pantryOpen) { await gg.say('黴の生えた小麦粉の袋と、空の瓶ばかりだ。'); return; }
        await gg.reachAnim();
        gg.flags.pantryOpen = true;
        gg.audio.sfx('creak');
        const st = { v: 0 };
        const iv = setInterval(() => pantry.userData.setOpen(st.v), 16);
        await gg.tween(st, 'v', 0.8, 0.5);
        clearInterval(iv);
        await gg.say('食料棚の奥に、灯油の缶とマッチ箱があった。');
        await gg.give('oil');
        await gg.give('matches');
        if (gg.has('lamp')) await gg.say('これで、ランプに火を灯せる。\n（持ち物から「使う」）');
      },
    });
    r.interact({
      id: 'drawerK', x: 3.05, z: 0.6, r: 0.45, label: '戸棚',
      use: async (gg) => {
        if (gg.flags.kitchenAmmo) { await gg.say('錆びた包丁や肉叩きが、乱雑に放り込まれている。'); return; }
        await gg.searchAnim();
        gg.flags.kitchenAmmo = true;
        await gg.say('包丁に紛れて、拳銃の弾の箱が転がっていた。\n使用人の誰かが護身用に隠していたのだろうか。');
        await gg.give('ammo', { count: 6 });
      },
    });
    const cnd = F.candle({ h: 0.14 });
    r.place(cnd, 3.6, 0.9, 0, { y: 0.92, cast: false });
    r.flame(3.6, 0.92 + 0.15, 0.9, { size: 0.07, intensity: 3, distance: 6 });

    r.hemi(act2 ? 0x4a6488 : 0x5a6a88, act2 ? 0x141a1c : 0x2a1a10, act2 ? 2.2 : 2.0);

    if (!act2 && !g.flags['dead:cook']) {
      g.spawn(r, { id: 'cook', type: 'cook', x: 0.35, z: -1.75, rot: Math.PI, dormant: true, onDeath: () => { g.flags['dead:cook'] = true; } });
    }

    r.shot({ id: 'door', pos: [3.65, 2.65, 2.65], look: [-1.9, 0.7, -1.6], fov: 58, zone: [-4.2, -3.2, 0.6, 3.2] });
    r.shot({ id: 'far', pos: [-3.65, 2.65, -2.65], look: [2.0, 0.6, 1.7], fov: 58, zone: [0.6, -3.2, 4.2, 3.2] });
  },

  async enter(r, g) {
    if (g.flags.kitchenSeen) return;
    g.flags.kitchenSeen = true;
    const cook = r.monsters.find((m) => m.id === 'cook');
    if (!cook || !cook.alive) return;
    g.lock();
    g.cut({ pos: [-2.0, 1.5, 0.6], look: [0.4, 1.2, -2.2], fov: 46 });
    await g.wait(1.0);
    await g.say('かまどの前に、大柄な料理人が背を向けて立っている。\n肉切り包丁が、規則正しくまな板を叩く音……。');
    g.cut(null);
    g.unlock();
  },

  update(r, g, dt) {
    const cook = r.monsters.find((m) => m.id === 'cook');
    if (!cook || cook.state !== 'dormant') return;
    r.chopT = (r.chopT || 0) - dt;
    if (r.chopT <= 0) { r.chopT = 0.9; g.audio.sfx('chop', { at: cook.pos }); }
    const d = Math.hypot(g.player.pos.x - cook.pos.x, g.player.pos.z - cook.pos.z);
    r.cookT = (r.cookT || 0) + dt;
    if (d < 3.2 || r.cookT > 12) {
      cook.wake();
      g.audio.sfx('cookNotice', { at: cook.pos });
    }
  },
  onNoise(r, g) {
    const cook = r.monsters.find((m) => m.id === 'cook');
    if (cook && cook.state === 'dormant') cook.wake();
  },
};
