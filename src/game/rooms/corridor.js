// 二階廊下 — the long upstairs corridor where the butler still waits.
import * as F from '../furniture.js';
import { M } from '../mats.js';

// doors along the corridor: x, and the wall they are in (-1 north, +1 south)
const DOORS = [[-3.5, -1], [0.5, 1], [3.0, -1]];

export default {
  id: 'corridor',
  name: '二階廊下',
  bounds: [-10.5, -1.6, 8.3, 1.6],
  floorType: 'carpet',
  ambience: 'house',
  autoShots: false,
  build(r, g) {
    const H = 3.0;
    r.shell(-8, -1.3, 8, 1.3, {
      h: H, floor: 'woodFloorDark', ceil: 'plaster', mat: 'wallpaperGreen', wainscot: 'wainscot', wainscotH: 1.0, crown: true,
      openings: {
        n: [{ at: -3.5, w: 1.0, h: 2.15 }, { at: 3.0, w: 1.0, h: 2.15 }],
        s: [{ at: 0.5, w: 1.0, h: 2.15 }, { at: 5.6, w: 1.0, h: 1.6, sill: 0.8 }, { at: -5.6, w: 1.0, h: 1.6, sill: 0.8 }],
        e: [{ at: 0, w: 0.9, h: 2.05 }],
        w: [{ at: 0, w: 1.8, h: 2.6, pass: true }],
      },
    });
    F.rug(r, 'carpetRunner', -0.5, 0, 1.2, 14.6, Math.PI / 2);
    // landing beyond the arch: the head of the grand stairs going down
    r.floor(-8.9, -1.3, -8, 1.3, 'woodFloorDark');
    r.floor(-10.4, -1.3, -8.9, -0.7, 'woodFloorDark');
    r.floor(-10.4, 0.7, -8.9, 1.3, 'woodFloorDark');
    r.ceiling(-10.4, -1.3, -8, 1.3, 'plaster', H);
    r.wall(-10.4, -1.3, -8, -1.3, { h: H, mat: 'wallpaperGreen', normal: [0, 1], wainscot: 'wainscot' });
    r.wall(-8, 1.3, -10.4, 1.3, { h: H, mat: 'wallpaperGreen', normal: [0, -1], wainscot: 'wainscot' });
    r.wall(-10.4, 1.3, -10.4, -1.3, { h: H, mat: 'wallpaperGreen', normal: [1, 0] });
    for (let i = 0; i < 5; i++) {
      const top = -0.19 * (i + 1);
      r.box('wood', 0.3, 0.19, 1.4, -8.9 - i * 0.3 - 0.15, top - 0.19 + 0.0, 0);
      r.box(M('stairCarpet', { ts: [0.3, 1.4] }), 0.3, 0.005, 1.0, -8.9 - i * 0.3 - 0.15, top, 0, { cast: false });
    }
    r.box('#020202', 1.6, 0.02, 1.4, -9.7, -1.4, 0, { cast: false });
    r.ramp(-10.4, -0.7, -8.9, 0.7, 'x', -0.95, 0);
    for (const z of [-0.72, 0.72]) {
      for (let i = 0; i < 5; i++) r.box('woodBlack', 0.05, 0.85, 0.05, -9.0 - i * 0.32, 0, z);
      r.box('woodBlack', 1.6, 0.06, 0.08, -9.65, 0.86, z);
      r.collider(-9.65, z, 0.8, 0.05);
    }
    r.box('woodBlack', 0.14, 1.1, 0.14, -8.95, 0, -0.72);
    r.box('woodBlack', 0.14, 1.1, 0.14, -8.95, 0, 0.72);
    // arch trim
    r.box('woodBlack', 0.25, 2.6, 0.15, -7.95, 0, -0.98);
    r.box('woodBlack', 0.25, 2.6, 0.15, -7.95, 0, 0.98);
    r.box('woodBlack', 0.25, 0.25, 2.2, -7.95, 2.6, 0);
    r.trigger({
      box: [-10.5, -0.7, -9.35, 0.7],
      enter: (gg) => gg.goTo('hall', 'fromUpstairs', { fadeOut: 0.5 }),
    });
    r.entry('fromStairs', -7.6, 0, Math.PI / 2);

    // doors
    // pale frames and light spilling from under them, so the doors stand
    // out against the dark green paper
    const frame = '#a89878';
    r.door(8, 0, -Math.PI / 2, { w: 0.9, h: 2.05, to: 'attic', entry: 'fromCorridor', label: '屋根裏への扉', panel: 'wood', frame, spill: 0x8a6030, wallMat: 'wallpaperGreen' });
    r.entry('fromAttic', 7.4, 0, -Math.PI / 2);
    r.door(-3.5, -1.3, 0, { to: 'bathroom', entry: 'fromCorridor', label: '浴室の扉', frame, spill: 0x7088b0, wallMat: 'wallpaperGreen' });
    r.entry('fromBathroom', -3.5, -0.7, 0);
    r.door(3.0, -1.3, 0, {
      id: 'bedroomDoor', to: 'bedroom', entry: 'fromCorridor', label: '主寝室の扉', frame, spill: 0x905038, wallMat: 'wallpaperGreen',
      locked: true, key: 'bedroomKey', lockedMsg: '鍵がかかっている。扉には「主寝室」の真鍮の札。',
    });
    r.entry('fromBedroom', 3.0, -0.7, 0);
    r.door(0.5, 1.3, Math.PI, { to: 'library', entry: 'fromCorridor', label: '書斎の扉', frame, spill: 0xc08040, wallMat: 'wallpaperGreen', panel: 'woodRed' });
    r.entry('fromLibrary', 0.5, 0.7, Math.PI);

    // windows
    r.window(5.6, 1.3, Math.PI, { w: 1.0, h: 1.6, sill: 0.8, curtains: 'curtainRed', wallMat: 'wallpaperGreen', shadow: 'lo', intensity: 60, angle: 0.55 });
    r.window(-5.6, 1.3, Math.PI, { w: 1.0, h: 1.6, sill: 0.8, curtains: 'curtainRed', wallMat: 'wallpaperGreen', intensity: 45, angle: 0.55 });

    // decor
    const pTop = 2.05;
    const P = (x, art, w = 0.6, h = 0.78) => {
      const p = F.painting({ w, h, art });
      p.position.set(x, pTop - 0.4 + h / 2 - 0.2, -1.27);
      r.static.add(p);
    };
    P(-6.0, 'portraitOld');
    P(-1.2, 'portraitCaptain', 0.7, 0.9);
    P(1.2, 'portraitMan');
    P(5.4, 'portraitWoman');
    r.interact({ id: 'pEzekiel', x: -1.2, z: -0.9, r: 0.5, label: '肖像画', use: (gg) => gg.say('船長服の男の肖像画。額には「エゼキエル・アシュコム　一七九五年」。\n絵の具の剥げた目が、じっとこちらを見下ろしている。') });
    r.interact({ id: 'pWoman', x: 5.4, z: -0.9, r: 0.5, label: '肖像画', use: (gg) => gg.say('優しげな婦人の肖像画。「エレノア・アシュコム」とある。') });
    r.interact({ id: 'pOld', x: -6.0, z: -0.9, r: 0.5, label: '肖像画', use: (gg) => gg.say('厳めしい老人の肖像画。名札は削り取られている。') });
    r.interact({ id: 'pMan', x: 1.2, z: -0.9, r: 0.5, label: '肖像画', use: (gg) => gg.say('若き日のサイラスの肖像画だ。理知的な目をしている。') });

    const tbl = F.sideTable({ s: 0.55, h: 0.75 });
    r.place(tbl, 6.6, -0.95, 0, { collide: [0.55, 0.5] });
    const cand = F.candelabra({ arms: 3, h: 0.42 });
    r.place(cand, 6.6, -1.0, 0, { y: 0.75, cast: false });
    for (const f of cand.userData.flames) r.flame(6.6 + f[0], 0.75 + f[1], -1.0 + f[2], { size: 0.07, intensity: 2.2, distance: 6, light: f[0] === 0 });
    r.pickup('butler', 6.5, 0.76, -0.85, { ry: 0.6, label: '覚え書き', onTake: async (gg) => { const c = await gg.ask('読みますか？', ['読む', 'あとで']); if (c === 0) await gg.readDoc('butler'); } });

    const tbl2 = F.sideTable({ s: 0.55, h: 0.75 });
    r.place(tbl2, -5.0, -0.95, 0, { collide: [0.55, 0.5] });
    const c2 = F.candelabra({ arms: 1, h: 0.36 });
    r.place(c2, -5.0, -1.0, 0, { y: 0.75, cast: false });
    r.flame(-5.0, 0.75 + c2.userData.flames[0][1], -1.0, { size: 0.07, intensity: 2.0, distance: 6 });
    r.pickup('flask', -4.9, 0.76, -0.82, { id: 'corridorFlask', ry: 1.2 });

    r.place(F.pedestal({ h: 1.0 }), 2.0, 0.95, 0, { collide: true });
    r.place(F.vase({ h: 0.42, color: 0x2a3a5a }), 2.0, 0.95, 0, { y: 1.0 });
    r.place(F.deadPlant(), -7.3, 0.9, 0, { collide: true });
    r.place(F.deadPlant(), 7.4, -0.9, 0, { collide: true });
    F.cobweb(r, 7.95, H, 1.25, Math.PI, 0.7);
    F.cobweb(r, -7.95, H, -1.25, 0, 0.6);
    for (const x of [-2.4, 4.3]) {
      const sc = F.sconce();
      sc.position.set(x, 1.9, -1.3);
      r.static.add(sc);
      r.flame(x, 1.9 + sc.userData.flames[0][1], -1.3 + sc.userData.flames[0][2], { size: 0.06, intensity: 1.6, distance: 5 });
    }

    r.hemi(0x6070a0, 0x2a1a10, 2.2);

    // the butler, still waiting for orders
    if (!g.flags['dead:butler']) {
      g.spawn(r, { id: 'butler', type: 'butler', x: -3.0, z: 0.1, rot: Math.PI / 2, onDeath: () => { g.flags['dead:butler'] = true; } });
    }

    // One camera travels along the corridor a little behind the player and
    // looks the way he is heading, so no cut ever turns the picture round.
    // Walk back the other way for a metre and it swings round him to the
    // other side; passing a door it drifts to the far wall and pans to it.
    r.shot({
      id: 'rail', zone: [-10.6, -1.6, 8.3, 1.6], fov: 56, lock: true,
      rail(p, dt, snap, st) {
        if (snap || st.dir === undefined) {
          st.dir = Math.sin(g.player.rot) > 0.2 ? 1 : -1; // +1: looking east
          st.b = st.dir > 0 ? 1 : 0;
          st.x = p.x;
          st.back = 0;
          st.side = p.z >= 0 ? 1 : -1;
        }
        const dx = p.x - st.x;
        st.x = p.x;
        if (dx * st.dir < 0) st.back += Math.abs(dx);
        else if (dx) st.back = Math.max(0, st.back - Math.abs(dx) * 2);
        if (st.back > 1.0) {
          st.dir = -st.dir;
          st.back = 0;
          st.side = p.z >= 0 ? 1 : -1;
        }
        st.b += Math.max(-dt / 1.2, Math.min(dt / 1.2, (st.dir > 0 ? 1 : 0) - st.b));
        const e = st.b * st.b * (3 - 2 * st.b);
        const sw = Math.sin(e * Math.PI); // 1 half way round, looking across
        const vx = -Math.cos(e * Math.PI), vz = sw * st.side;
        let lean = 0;
        for (const [x, wall] of DOORS) {
          const w = Math.max(0, 1 - Math.abs(p.x - x) / 2.0);
          lean += wall * w * w * (3 - 2 * w);
        }
        const D = 2.6 - 1.5 * sw;
        // stay near the middle of the corridor, so a man hugging the wall is
        // still seen past door frames and through the arch
        let cx = p.x - vx * D, cz = p.z * 0.45 - vz * D - lean * 0.7;
        let lx = p.x + vx * 1.6, ly = 0.85, lz = p.z + vz * 1.6 + lean * 0.9;
        // No room behind him at an end of the corridor: ease into the corner
        // across from him (chosen once, so it can't jump) for a 3/4 view.
        const over = Math.max(0, cx - 7.8, -10.25 - cx);
        cx = Math.max(-10.25, Math.min(7.8, cx));
        if (over > 0) st.corner ??= p.z >= 0 ? -1 : 1;
        else st.corner = undefined;
        const k = Math.min(1, over / 1.4);
        const c = k * k * (3 - 2 * k);
        let cy = 2.45 + 0.25 * sw;
        if (c > 0) {
          cz += (st.corner * 1.05 - cz) * c;
          cy += 0.2 * c;
          lx += (p.x + vx * 0.8 - lx) * c;
          lz += (p.z - lz) * c;
          ly -= 0.15 * c;
        }
        return {
          pos: [cx, cy, Math.max(-1.1, Math.min(1.1, cz))],
          look: [lx, ly, lz],
          fov: 56 + 10 * Math.max(sw, c),
          // "up" on the stick runs along the corridor, whatever the pan
          fwd: [vx, vz],
        };
      },
    });
  },
};
