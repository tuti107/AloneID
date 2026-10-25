// The trailer's score, played on the game's own synth (src/engine/audio.js)
// into an OfflineAudioContext and timed to the cut in edit.json:
// a low drone and an out-of-tune music box under the rain, string clusters
// and a heartbeat as it tightens, dead silence for 振り返るな, hits and drums
// on every cut to the end, one sub boom into black, and the music box again,
// broken, under the title.
(() => {
  window.__score = async (beats, total) => {
    const Audio = window.__game.audio.constructor;
    const ctx = new OfflineAudioContext(2, Math.ceil(total * 48000), 48000);
    const a = new Audio();
    a.init(ctx);
    a.now = () => 0;
    // rendered with headroom; assemble.py sets the balance
    a.setVolumes(0.4, 1);
    const out = a.musicBus;
    const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const at = (label, k = 0) => {
      const b = beats.find((x) => x.label === label);
      return b.start + k;
    };
    const end = (label) => { const b = beats.find((x) => x.label === label); return b.start + b.dur; };
    const hits = beats.flatMap((b) => (b.hits || []).map((h) => b.start + h));

    // ---------------------------------------------------------------- voices
    const gainEnv = (pts) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, 0);
      for (const [t, v] of pts) g.gain.linearRampToValueAtTime(v, t);
      return g;
    };
    // low bowed drone: detuned saws through a slowly breathing lowpass
    const drone = (pts, notes, lp = 240) => {
      const g = gainEnv(pts);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      f.Q.value = 0.9;
      const l = ctx.createOscillator();
      l.frequency.value = 0.09;
      const lg = ctx.createGain();
      lg.gain.value = lp * 0.35;
      l.connect(lg).connect(f.frequency);
      l.start(0);
      f.connect(g).connect(out);
      const t1 = pts[pts.length - 1][0] + 0.1;
      for (const n of notes) {
        for (const det of [-7, 6]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = NOTE(n);
          o.detune.value = det;
          const v = ctx.createGain();
          v.gain.value = 0.5;
          o.connect(v).connect(f);
          o.start(0);
          o.stop(t1);
        }
      }
    };
    // music box: a bright tine and its metallic partial, a little out of tune
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const box = (t, n, vol = 0.14) => {
      const f = NOTE(n) * Math.pow(2, (rnd() - 0.5) * 0.03);
      a.tone(t, f, 2.2, out, { vol, attack: 0.003 });
      a.tone(t, f * 4.02, 0.7, out, { vol: vol * 0.22, attack: 0.002 });
      a.tone(t, f * 2.0, 1.2, out, { vol: vol * 0.12, attack: 0.002 });
    };
    const phrase = (t0, notes, step = 0.62, vol) => notes.forEach((n, i) => { if (n) box(t0 + i * step, n, vol); });
    const heart = (t, vol = 0.9) => {
      a.tone(t, 54, 0.24, out, { f2: 36, vol });
      a.tone(t + 0.17, 50, 0.22, out, { f2: 34, vol: vol * 0.7 });
    };
    const heartbeat = (t0, t1, bpm0, bpm1, vol) => {
      let t = t0;
      while (t < t1 - 0.3) {
        const k = (t - t0) / (t1 - t0);
        heart(t, vol * (0.6 + 0.4 * k));
        t += 60 / (bpm0 + (bpm1 - bpm0) * k);
      }
    };
    // dissonant string cluster, tremolo, swelling and bending upwards, cut dead at t1
    const cluster = (t0, t1, notes, v0, v1, bend, lp = 1400) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, 0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v0, t0 + 1.2);
      g.gain.exponentialRampToValueAtTime(v1, t1 - 0.03);
      g.gain.linearRampToValueAtTime(0, t1);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(lp * 0.6, t0);
      f.frequency.linearRampToValueAtTime(lp, t1);
      f.connect(g).connect(out);
      for (const n of notes) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = NOTE(n);
        o.detune.setValueAtTime((rnd() - 0.5) * 18, t0);
        o.detune.linearRampToValueAtTime(bend + (rnd() - 0.5) * 18, t1);
        const trem = ctx.createGain();
        trem.gain.value = 0.7;
        const l = ctx.createOscillator();
        l.frequency.value = 5 + rnd() * 2.5;
        const lg = ctx.createGain();
        lg.gain.value = 0.3;
        l.connect(lg).connect(trem.gain);
        o.connect(trem).connect(f);
        o.start(t0);
        l.start(t0);
        o.stop(t1 + 0.05);
        l.stop(t1 + 0.05);
      }
    };
    // orchestral hit: sub drop, a burst of noise and a metal clang
    const hit = (t, vol = 1) => {
      a.tone(t, 72, 1.4, out, { f2: 30, vol: vol * 1.0 });
      a.noise(t, 0.9, out, { lp: 1600, lp2: 180, vol: vol * 0.7, attack: 0.002 });
      a.tone(t, 155, 0.6, out, { type: 'square', bp: 900, q: 3, vol: vol * 0.1 });
      a.tone(t, 233, 0.5, out, { type: 'square', bp: 1300, q: 3, vol: vol * 0.07 });
    };
    const drum = (t, vol = 0.7) => {
      a.tone(t, 96, 0.4, out, { f2: 52, vol });
      a.noise(t, 0.14, out, { lp: 500, vol: vol * 0.5, attack: 0.002 });
    };
    // shrieking strings: a high cluster sliding up, with vibrato
    const shriek = (t0, t1, v0, v1) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, 0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v0, t0 + 0.8);
      g.gain.exponentialRampToValueAtTime(v1, t1 - 0.03);
      g.gain.linearRampToValueAtTime(0, t1);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 2200;
      f.Q.value = 0.8;
      f.connect(g).connect(out);
      for (let i = 0; i < 6; i++) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(1300 + rnd() * 1100, t0);
        o.frequency.exponentialRampToValueAtTime((1300 + rnd() * 1100) * 1.5, t1);
        const v = ctx.createOscillator();
        v.frequency.value = 5.5 + rnd() * 2;
        const vg = ctx.createGain();
        vg.gain.value = 18;
        v.connect(vg).connect(o.frequency);
        o.connect(f);
        o.start(t0);
        v.start(t0);
        o.stop(t1 + 0.05);
        v.stop(t1 + 0.05);
      }
    };
    const boom = (t, vol = 1.3) => {
      a.tone(t, 48, 3.2, out, { f2: 22, vol });
      a.noise(t, 2.6, out, { buf: a.brownBuf, lp: 110, vol: vol * 0.8, attack: 0.01 });
    };

    // ---------------------------------------------------------------- the cut
    const silence1 = at('c5_dont_look'), black = at('black');
    // 1. the drone under the rain, until the dead-silence card
    drone([[0, 0], [2.5, 0.05], [at('S07'), 0.06], [at('S07', 1.0), 0.02], [at('S05'), 0.05], [silence1 - 0.04, 0.09], [silence1, 0]], [38, 45, 50], 230);
    // 2. the music box, until the window bursts in the attic
    const M1 = [76, 0, 72, 69, 0, 71, 0, 68, 64, 0, 69, 72];
    const M2 = [76, 0, 77, 76, 0, 75, 0, 71, 0, 74, 72, 0];
    phrase(1.0, M1, 0.62, 0.13);
    phrase(at('c2_attic', 0.2), M2.slice(0, 7), 0.62, 0.12);
    // 3. two lost notes on the letter cards
    box(at('c3_letter', 0.5), 69, 0.1);
    box(at('c4_fire', 0.4), 68, 0.1);
    // 4. tension: clusters and a heartbeat from the dining room to the silence
    cluster(at('S05'), silence1, [57, 58, 60, 63, 64], 0.004, 0.05, 260, 1500);
    cluster(at('S04'), silence1, [69, 70, 75], 0.002, 0.03, 300, 2400);
    heartbeat(at('S05'), silence1, 62, 112, 0.9);
    // 5. hits where the cut asks for them (the window, the scream, the fast cuts)
    for (const t of hits) hit(t, 1.0);
    // lighter stings for the hand and the cleaver
    hit(at('S04', 1.225), 0.45);
    hit(at('S08', 2.7), 0.5);
    // 6. after the scream: drums, shrieking strings, all cut dead at black
    const climaxFrom = at('S06', 0.875);
    for (let t = climaxFrom + 0.5; t < black - 0.2; t += 0.5) drum(t, 0.45 + 0.35 * ((t - climaxFrom) / (black - climaxFrom)));
    shriek(climaxFrom + 0.3, black, 0.006, 0.07);
    cluster(climaxFrom, black, [45, 46, 52, 53], 0.01, 0.08, 500, 900);
    heartbeat(climaxFrom + 0.4, black, 120, 150, 0.8);
    // 7. one deep boom into black
    boom(black, 1.4);
    // 8. the music box again, distant and broken, under the title and the end card
    phrase(at('S12', 1.2), [76, 0, 72, 69, 0, 68], 0.78, 0.07);
    box(at('c6_end', 0.6), 64, 0.05);
    box(at('c6_end', 1.6), 63, 0.04);

    const buf = await ctx.startRendering();
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    const pcm = new Int16Array(L.length * 2);
    const q = (v) => Math.max(-1, Math.min(1, v)) * 32767;
    for (let i = 0; i < L.length; i++) { pcm[2 * i] = q(L[i]); pcm[2 * i + 1] = q(R[i]); }
    const u8 = new Uint8Array(pcm.buffer);
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  };
})();
