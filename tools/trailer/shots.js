// The trailer's shots, staged in the game itself (see runtime.js for the fields).
// Times are seconds from the first captured frame; each capture runs a little
// longer than its slot in the cut so the edit can choose where to come in.
(() => {
  const PI = Math.PI;
  const flash = (g, k) => { g.gfx.u.uFlash.value = Math.max(g.gfx.u.uFlash.value, k); };
  // title scene: a lightning strike now, the thunder a moment later
  const strike = (g, power, delay) => {
    const ts = g.titleScene;
    ts.flash = 1;
    ts.flash2 = 0.14;
    flash(g, 0.3 * power);
    g.audio.thunder(delay, power);
  };
  const toTitle = (g) => {
    g.toTitle();
    g.titleScene.nextFlash = 1e9;
  };
  // a slow orbit/dolly around the house, like the title screen's own camera
  const orbit = (a, r, y, ly, fov, lx = 0) => ({ pos: [Math.sin(a) * r, y, 6 + Math.cos(a) * r], look: [lx, ly, 0], fov });
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (k) => k * k * (3 - 2 * k);
  const ramp = (t, t0, t1) => ease(Math.min(1, Math.max(0, (t - t0) / (t1 - t0))));
  const strong = (g) => { g.player.maxHp = g.player.hp = 9999; };

  // Edgar's acting, as a timeline of steps run from a shot's `each` hook:
  // { t, clip, speed, fade, v: m/s along his facing (negative backs away),
  //   face: an angle or g => angle, turn: how fast he turns to it,
  //   free: hand him back to the game (hits, attacks), do: g => anything }
  // The game's own update still resolves collisions and fires footsteps.
  const edgar = (steps) => {
    let i = 0, v = 0, face = null, turn = 7;
    return (g, t, dt) => {
      const p = g.player;
      while (i < steps.length && t >= steps[i].t) {
        const s = steps[i++];
        if (s.do) s.do(g);
        if (s.free) {
          v = 0;
          face = null;
          if (p.state === 'scripted') p.setState('idle');
          continue;
        }
        if (s.clip) {
          p.setState('scripted');
          p.scriptedDone = null;
          p.anim.play(s.clip, { restart: true, fade: s.fade ?? 0.18, speed: s.speed ?? 1 });
        }
        if (s.v !== undefined) v = s.v;
        if (s.face !== undefined) face = s.face;
        if (s.turn !== undefined) turn = s.turn;
      }
      if (p.state !== 'scripted') return;
      if (face !== null) {
        const want = typeof face === 'function' ? face(g) : face;
        const d = Math.atan2(Math.sin(want - p.rot), Math.cos(want - p.rot));
        p.rot += d * Math.min(1, dt * turn);
      }
      if (v) {
        p.pos.x += Math.sin(p.rot) * v * dt;
        p.pos.z += Math.cos(p.rot) * v * dt;
      }
    };
  };
  const toward = (x, z) => (g) => Math.atan2(x - g.player.pos.x, z - g.player.pos.z);
  const towardM = (pick) => (g) => {
    const m = pick(g), p = g.player;
    return m ? Math.atan2(m.pos.x - p.pos.x, m.pos.z - p.pos.z) : p.rot;
  };
  // a punch or a kick (or a shot, with the revolver drawn) at a monster
  const attack = (pick, kick = false) => (g) => {
    const p = g.player, m = pick(g);
    if (m) p.rot = Math.atan2(m.pos.x - p.pos.x, m.pos.z - p.pos.z);
    p.combo = kick ? 1 : 0;
    p.comboT = kick ? 0.5 : 0;
    p.attack();
  };
  const ghoul = (g) => g.room.ghoul;
  const cook = (g) => g.room.monsters.find((m) => m.id === 'cook');
  const nearest = (type) => (g) => {
    const p = g.player;
    let best = null, bd = 1e9;
    for (const m of g.room.monsters) {
      if (m.type !== type || !m.alive) continue;
      const d = Math.hypot(m.pos.x - p.pos.x, m.pos.z - p.pos.z);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  };

  window.__SHOTS = {
    // 嵐の館: push in on the house; two strikes; the tower's top light goes out
    S01: {
      len: 7.5, pre: 2.2,
      setup: (g) => toTitle(g),
      titleCam: (t) => { const k = ramp(t, 0, 7.5); return orbit(-0.24, lerp(30.5, 22.0, k), lerp(2.9, 3.5, k), lerp(6.4, 7.5, k), 42); },
      events: [
        { t: 1.5, run: (g) => strike(g, 1, 0.3) },
        { t: 3.7, run: (g) => strike(g, 1.15, 0.12) },
        { t: 5.2, run: (g) => {
          const w = g.titleScene.house.windows[12];
          w.lit = false;
          w.mat.color.set(0x0c1018);
        } },
      ],
    },

    // 屋根裏: scratching at the glass, the window bursts, the ghoul crouches, then springs
    S02: {
      len: 6.5, pre: 1.5,
      setup: (g) => {
        g.debugStart('attic', 'start', { flags: { atticIntro: true } });
        strong(g);
      },
      ready: (g) => { g.player.place(0.45, -0.95, Math.atan2(-2.45, -2.05)); },
      cam: [
        { t: 0, pos: [1.15, 1.45, 0.6], look: [-2.1, 1.25, -2.9], fov: 54 },
        { t: 6.5, pos: [0.95, 1.44, 0.32], look: [-2.0, 1.22, -2.9], fov: 53 },
      ],
      each: edgar([
        { t: 0.2, clip: 'walk', speed: 0.6, v: 0.84 },
        { t: 1.55, clip: 'idle', v: 0, fade: 0.3 },
        { t: 1.95, clip: 'startle', v: -0.9, face: towardM(ghoul) },
        { t: 2.25, v: 0 },
        { t: 2.45, clip: 'back', speed: 0.95, v: -0.8 },
        { t: 3.0, clip: 'guard', v: 0 },
        { t: 3.35, free: true },
        { t: 4.05, do: attack(ghoul) },
        { t: 4.55, do: attack(ghoul, true) },
      ]),
      events: [
        { t: 0.3, run: (g) => g.audio.sfx('scratch', { at: { x: -2, y: 1.4, z: -3 } }) },
        { t: 1.2, run: (g) => { g.audio.sfx('bang', { at: { x: -2, y: 1.4, z: -3 } }); g.shake(0.03, 0.15); } },
        { t: 1.9, run: (g) => { g.room.ghoulTimer = 0.0001; } },
        // it lands and stays down a beat before it springs
        { t: 2.0, run: (g) => { const gh = g.room.ghoul; if (gh) gh.setState('dormant'); } },
        { t: 2.15, run: (g) => g.audio.sfx('ghoulGrowl', { at: g.room.ghoul.pos }) },
        { t: 3.0, run: (g) => { const gh = g.room.ghoul; gh.leapCd = 0; gh.setState('chase'); } },
      ],
    },

    // 廊下: the butler shambles out of the dark end of the corridor
    S03: {
      len: 6.5, pre: 1.5,
      setup: (g) => {
        g.debugStart('corridor', 'fromAttic', { flags: { lampLit: true, atticIntro: true }, items: ['lamp'] });
        strong(g);
      },
      ready: (g) => {
        g.player.place(1.9, -0.35, -PI / 2);
        const b = g.room.monsters.find((m) => m.id === 'butler');
        b.pos.set(-4.7, 0, 0.25);
        b.rot = PI / 2;
        b.sync();
        b.wake();
      },
      cam: [
        { t: 0, pos: [4.0, 1.55, 0.7], look: [-5.0, 1.35, 0.12], fov: 42 },
        { t: 6.5, pos: [4.5, 1.55, 0.68], look: [-5.0, 1.33, 0.1], fov: 42 },
      ],
      each: edgar([
        { t: 0, clip: 'stalk', v: 0.7 },
        { t: 2.4, clip: 'peer', v: 0, fade: 0.4 },
        { t: 3.3, clip: 'back', speed: 0.75, v: -0.55, face: -PI / 2 },
      ]),
    },

    // 浴室: he reaches into the black water and a hand takes him by the wrist
    S04: {
      len: 6.0, pre: 1.5, choices: [0],
      setup: (g) => {
        g.debugStart('bathroom', 'fromCorridor', { flags: { mirrorSeen: true } });
        strong(g);
      },
      ready: async (g, T) => {
        g.testUse('tub');
        await T.until(() => g.player.anim.cur === 'dip', 10);
      },
    },

    // 食堂 → 振り返ると: one take from the overhead shot to the host's scream
    S05: {
      len: 14, pre: 1.5,
      setup: (g) => {
        g.debugStart('dining', 'fromHall', { flags: { diningSeen: true } });
        strong(g);
      },
      ready: async (g, T) => {
        g.testUse('sideboard');
        await T.until(() => g.director.override && g.director.override.pos.y === 2.05, 15);
      },
      each: edgar([
        { t: 5.5, clip: 'hit', speed: 0.5 },
        { t: 6.25, clip: 'run', v: 2.8, face: toward(-2.6, 2.2), turn: 10 },
        { t: 6.95, face: toward(3.8, 2.0) },
      ]),
    },

    // 音楽室: Eleanor waltzes to the record
    S07: {
      len: 6.5, pre: 1.5, choices: [0], music: true,
      setup: (g) => g.debugStart('music', 'fromHall', { items: ['record'] }),
      ready: async (g, T) => {
        g.testUse('gramophone', 'record');
        await T.until(() => g.room.eleanor && g.room.eleanor.anim.cur === 'dance', 20);
        await T.advance(2.0);
        g.player.place(-1.95, 0.25, Math.atan2(1.95, 1.25));
      },
      each: edgar([
        { t: 0.5, clip: 'walk', speed: 0.45, v: 0.63, face: toward(0, 1.5), turn: 3 },
        { t: 1.5, clip: 'idle', v: 0, fade: 0.4 },
        { t: 2.6, clip: 'reach', speed: 0.45, fade: 0.3 },
        { t: 4.2, clip: 'idle', fade: 0.4 },
      ]),
      cam: [
        { t: 0, pos: [-3.3, 1.3, 3.45], look: [0.2, 1.15, 1.0], fov: 48 },
        { t: 6.5, pos: [-2.85, 1.42, 3.0], look: [0.25, 1.2, 0.95], fov: 46 },
      ],
    },

    // 厨房: the cook turns from the stove and comes with the cleaver
    S08: {
      len: 5.5, pre: 1.5,
      setup: (g) => {
        g.debugStart('kitchen', 'fromHall', { flags: { lampLit: true }, items: ['lamp', 'revolver'], ammo: 6 });
        g.equip('revolver');
        strong(g);
      },
      each: edgar([
        { t: 0.5, clip: 'aim', face: towardM(cook), fade: 0.25 },
        { t: 1.3, do: attack(cook) },
        { t: 1.8, clip: 'aim', face: towardM(cook), fade: 0.1 },
        { t: 2.15, do: attack(cook) },
        { t: 2.65, clip: 'aim', face: towardM(cook), fade: 0.1 },
        { t: 3.05, do: attack(cook) },
        { t: 3.55, clip: 'aim', face: towardM(cook), fade: 0.1 },
        { t: 4.6, free: true },
      ]),
      ready: (g) => {
        g.player.place(-1.95, 0.05, Math.atan2(2.3, -1.8));
      },
      cam: [
        { t: 0, pos: [-2.05, 1.25, 1.95], look: [0.45, 1.35, -2.2], fov: 48 },
        { t: 5.5, pos: [-1.8, 1.27, 1.65], look: [0.3, 1.38, -2.0], fov: 46 },
      ],
      events: [
        { t: 0.4, run: (g) => {
          const c = g.room.monsters.find((m) => m.id === 'cook');
          c.wake();
        } },
      ],
    },

    // 地下室: two crawlers come scuttling out of the dark into his lamplight
    S09: {
      len: 3.4, pre: 1.5,
      setup: (g) => {
        g.debugStart('cellar', 'fromHall', { flags: { lampLit: true, cellarSeen: true }, items: ['lamp'] });
        strong(g);
      },
      each: edgar([
        { t: 0, clip: 'stalk', v: 0.65 },
        { t: 1.35, clip: 'startle', v: -0.8, face: towardM(nearest('crawler')) },
        { t: 1.6, v: 0 },
        { t: 2.0, clip: 'guard', face: towardM(nearest('crawler')) },
        { t: 2.3, do: attack(nearest('crawler'), true) },
      ]),
      ready: (g) => {
        g.player.place(-2.1, 1.05, PI / 2);
        const cs = g.room.monsters.filter((m) => m.type === 'crawler');
        [[3.7, 1.35], [4.0, 0.45]].forEach(([x, z], i) => {
          const c = cs[i];
          c.pos.set(x, 0, z);
          c.rot = -PI / 2;
          c.sync();
          c.wake();
        });
      },
      cam: [
        { t: 0, pos: [-4.05, 1.6, 2.3], look: [2.6, 0.45, 0.6], fov: 50 },
        { t: 3.4, pos: [-3.8, 1.5, 2.15], look: [1.5, 0.4, 0.8], fov: 52 },
      ],
    },

    // 地底の洞窟: something vast rises out of the black pool
    S10: {
      len: 6.0, pre: 2.0,
      setup: (g) => {
        g.debugStart('cavern', 'fromCellar', { flags: { horrorRisen: true, cavernSeen: true, lampLit: true }, items: ['lamp'] });
        strong(g);
      },
      ready: (g) => {
        g.player.place(0.35, 0.9, Math.atan2(-0.35, -5.8));
        const h = g.room.horror;
        h.state = 'hidden';
        h.root.visible = false;
      },
      cam: [
        { t: 0, pos: [1.7, 0.95, 3.5], look: [-0.55, 2.2, -4.9], fov: 56 },
        { t: 6.0, pos: [1.85, 0.95, 3.85], look: [-0.55, 2.6, -4.9], fov: 58 },
      ],
      each: edgar([
        { t: 0, clip: 'peer' },
        { t: 1.15, clip: 'startle', v: -0.7 },
        { t: 1.45, v: 0 },
        { t: 1.9, clip: 'back', speed: 0.55, v: -0.4 },
        { t: 3.1, v: 0 },
        { t: 3.6, clip: 'guard', v: 0 },
      ]),
      events: [
        { t: 1.0, run: (g) => { const h = g.room.horror; h.rise(true); h.roar = 1; } },
      ],
    },

    // 玄関の闇: the front door opens on a darkness full of eyes, and it takes him
    S11: {
      len: 7.0, pre: 1.5,
      setup: (g) => {
        g.debugStart('hall', 'start');
        for (const m of g.room.monsters) { m.hidden = true; m.root.visible = false; }
        strong(g);
      },
      ready: (g) => { g.testUse('frontDoor'); },
      each: edgar([
        { t: 2.35, clip: 'startle', v: -0.6 },
        { t: 2.65, v: 0 },
        { t: 3.0, clip: 'back', speed: 0.6, v: -0.45 },
        { t: 3.85, clip: 'guard', v: 0 },
      ]),
      cam: [
        { t: 0, pos: [1.15, 1.7, 2.3], look: [-0.4, 1.5, 5.2], fov: 50 },
        { t: 7.0, pos: [0.9, 1.68, 2.75], look: [-0.4, 1.45, 5.2], fov: 48 },
      ],
    },

    // rain and wind only, to lie under the opening card
    BED: {
      len: 4.0, pre: 2.2,
      setup: (g) => toTitle(g),
      titleCam: () => orbit(-0.24, 30.5, 2.9, 6.4, 42),
    },

    // タイトル: the house from low down; the logo is laid over it in the edit
    S12: {
      len: 6.0, pre: 2.2,
      setup: (g) => toTitle(g),
      titleCam: (t) => { const k = ramp(t, 0, 6); return orbit(lerp(0.06, 0.02, k), lerp(24.5, 23, k), lerp(1.25, 1.45, k), lerp(7.9, 8.3, k), 46, -1.5); },
      events: [
        { t: 0.5, run: (g) => strike(g, 1.25, 0.15) },
      ],
    },
  };
})();
