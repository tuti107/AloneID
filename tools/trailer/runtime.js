// In-page side of the trailer capture (see capture.cjs). The page's own loop is
// stopped; each output frame is drawn first and then the game is stepped by a
// fixed dt, so every frame lands on the same instant of the action on every
// run. The HUD is DOM and never reaches the canvas. Each shot's sound effects
// and ambience are played by the game's own Audio engine into an
// OfflineAudioContext whose clock is the shot clock.
(() => {
  const g = window.__game;
  const V3 = g.director.cam.position.constructor;
  const draw = g.render.bind(g);
  g.render = () => {};
  const tick = () => new Promise((r) => setTimeout(r, 0));
  let S = null;

  const mix = (a, b, k) => a + (b - a) * k;
  const smooth = (k) => k * k * (3 - 2 * k);
  // keys: [{ t, pos: [x, y, z], look: [x, y, z], fov }], eased between keys
  function camAt(keys, t) {
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1].t) i++;
    const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
    const k = b.t > a.t ? smooth(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)))) : 0;
    const v = (p, q) => new V3(mix(p[0], q[0], k), mix(p[1], q[1], k), mix(p[2], q[2], k));
    return { pos: v(a.pos, b.pos), look: v(a.look, b.look), fov: mix(a.fov, b.fov, k) };
  }

  // Step the game without drawing or recording, yielding so its scripts run.
  async function advance(sec, dt = 1 / 30) {
    for (let t = 0; t < sec - 1e-6; t += dt) { g.frame(dt); await tick(); }
  }
  async function until(pred, max = 20, dt = 1 / 30) {
    for (let t = 0; t < max; t += dt) {
      if (pred()) return true;
      g.frame(dt);
      await tick();
    }
    return false;
  }
  const T = { V3, advance, until, camAt };

  async function setup(id) {
    const shot = window.__SHOTS[id];
    g.debugAuto = { choices: [...(shot.choices || [])] };
    await shot.setup(g, T);
    await tick();
    await advance(shot.pre ?? 1.5);
    if (shot.ready) await shot.ready(g, T);
    return shot.len;
  }

  function begin(id, o) {
    const shot = window.__SHOTS[id];
    S = { shot, fps: o.fps, sub: o.sub, fired: new Set(), clock: 0 };
    g.gfx.setResolution(o.w, o.h);
    g.gfx.renderer.setSize(o.w, o.h, false);
    for (const c of [g.director.cam, g.titleScene && g.titleScene.camera]) {
      if (!c) continue;
      c.aspect = o.w / o.h;
      c.updateProjectionMatrix();
    }
    // a fresh offline context for this shot; the room's ambience restarts in it
    const a = g.audio;
    S.actx = new OfflineAudioContext(2, Math.ceil((shot.len + 4) * 48000), 48000);
    a.now = () => S.clock;
    a.init(S.actx);
    if (!shot.music) a.musicBus.gain.value = 0;
    // the room's ambience has been going all along: no fade-in at the first frame
    if (a.amb) {
      a.amb.gain.gain.cancelScheduledValues(0);
      a.amb.gain.gain.setValueAtTime(1, 0);
    }
  }

  function camera(t) {
    const shot = S.shot;
    if (shot.cam && g.state === 'play') {
      g.director.override = camAt(shot.cam, t);
      g.director.update(null, 0, true);
    }
    if (shot.titleCam && g.titleScene) {
      const c = g.titleScene.camera, o = shot.titleCam(t);
      c.position.set(...o.pos);
      c.fov = o.fov;
      c.updateProjectionMatrix();
      c.lookAt(...o.look);
    }
  }

  // Draw the frame for t = i / fps, then step the game to the next one.
  async function step(i) {
    const shot = S.shot, dt = 1 / S.fps, sd = dt / S.sub;
    const t0 = i * dt;
    camera(t0);
    if (g.player && g.player.xray) g.player.xray.visible = false;
    if (g.room) for (const m of g.room.monsters) if (m.xray) m.xray.visible = false;
    g.hurt = 0;
    g.gfx.u.uHurt.value = 0;
    if (shot.draw) shot.draw(g, t0);
    draw(dt);
    const png = g.gfx.canvas.toDataURL('image/png');
    for (let k = 0; k < S.sub; k++) {
      const t = t0 + k * sd;
      S.clock = t;
      for (const e of shot.events || []) {
        if (!S.fired.has(e) && t >= e.t) { S.fired.add(e); e.run(g, T, t); }
      }
      camera(t);
      if (shot.each) shot.each(g, t, sd);
      g.frame(sd);
      await tick();
    }
    return png;
  }

  // Render the shot's sound; 16-bit interleaved stereo PCM as base64.
  async function end() {
    const buf = await S.actx.startRendering();
    const a = g.audio;
    a.ctx = null;
    a.amb = null;
    a.song = null;
    a.scrapeNode = null;
    a.tensionGain = null;
    delete a.now;
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    const out = new Int16Array(L.length * 2);
    const q = (v) => Math.max(-1, Math.min(1, v)) * 32767;
    for (let i = 0; i < L.length; i++) { out[2 * i] = q(L[i]); out[2 * i + 1] = q(R[i]); }
    const u8 = new Uint8Array(out.buffer);
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }

  window.__T = { setup, begin, step, end, ...T };
})();
