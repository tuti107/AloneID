// Everything you hear is synthesised here with WebAudio: footsteps, doors,
// monsters, weather, room ambience and the music.
import * as THREE from 'three';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const rand = (a, b) => a + Math.random() * (b - a);

export class Audio {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.7;
    this.sfxVol = 0.9;
    this.pendingAmb = null;
    this.pendingMusic = undefined;
    this.amb = null;
    this.song = null;
    this.scrapeT = 0;
    this.tension = 0;
    this.game = null;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    let ctx;
    try { ctx = new AC(); } catch (e) { return; }
    this.init(ctx);
  }

  init(ctx) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.8, 2.2);
    this.reverbOut = ctx.createGain();
    this.reverbOut.gain.value = 0.55;
    this.reverb.connect(this.reverbOut).connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.sfxVerb = ctx.createGain();
    this.sfxVerb.gain.value = 0.35;
    this.sfxBus.connect(this.sfxVerb).connect(this.reverb);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    const mv = ctx.createGain();
    mv.gain.value = 0.4;
    this.musicBus.connect(mv).connect(this.reverb);
    this.ambBus = ctx.createGain();
    this.ambBus.connect(this.master);
    this.noiseBuf = this.makeNoise(3, 'white');
    this.pinkBuf = this.makeNoise(4, 'pink');
    this.brownBuf = this.makeNoise(4, 'brown');
    this.setVolumes(this.musicVol, this.sfxVol);
    this.buildTension();
    if (this.pendingAmb) { const [n, r] = this.pendingAmb; this.pendingAmb = null; this.setAmbience(n, r); }
    if (this.pendingMusic !== undefined) { const m = this.pendingMusic; this.pendingMusic = undefined; this.music(m); }
  }

  setVolumes(m, s) {
    this.musicVol = m;
    this.sfxVol = s;
    if (!this.ctx) return;
    this.musicBus.gain.value = m * 0.8;
    this.sfxBus.gain.value = s;
    this.ambBus.gain.value = s * 0.22;
  }

  impulse(sec, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  makeNoise(sec, kind) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') {
        b0 = 0.997 * b0 + w * 0.029591;
        b1 = 0.985 * b1 + w * 0.032534;
        b2 = 0.95 * b2 + w * 0.048056;
        d[i] = (b0 + b1 + b2 + w * 0.05) * 2.2;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    return buf;
  }

  // ------------------------------------------------------------ helpers
  now() { return this.ctx.currentTime; }

  out(o = {}) {
    // returns an input node routed through pan + gain into the sfx bus
    const ctx = this.ctx;
    const g = ctx.createGain();
    let vol = (o.vol ?? 1);
    let pan = 0;
    if (o.at && this.game && this.game.player) {
      const p = this.game.player.pos;
      const d = Math.hypot(o.at.x - p.x, (o.at.y ?? p.y) - p.y, o.at.z - p.z);
      vol *= 1 / (1 + d * 0.22);
      const cam = this.game.director && this.game.director.cam;
      if (cam) {
        const v = new THREE.Vector3(o.at.x, o.at.y ?? 1, o.at.z).project(cam);
        pan = Math.max(-1, Math.min(1, v.x)) * 0.8;
      }
    }
    g.gain.value = vol;
    if (ctx.createStereoPanner) {
      const pn = ctx.createStereoPanner();
      pn.pan.value = pan;
      g.connect(pn).connect(o.bus || this.sfxBus);
    } else g.connect(o.bus || this.sfxBus);
    return g;
  }

  noise(t, dur, dest, o = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = o.buf || this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = o.rate || 1;
    let node = src;
    const filt = (type, freq, q, f2) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.setValueAtTime(freq, t);
      if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
      f.Q.value = q ?? 1;
      node.connect(f);
      node = f;
    };
    if (o.hp) filt('highpass', o.hp, o.hpq);
    if (o.lp) filt('lowpass', o.lp, o.lpq, o.lp2);
    if (o.bp) filt('bandpass', o.bp, o.q ?? 1.5, o.bp2);
    const g = ctx.createGain();
    const a = o.attack ?? 0.003;
    const peak = o.vol ?? 1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    if (o.sustain) g.gain.setValueAtTime(peak, t + dur - (o.release ?? dur * 0.5));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g).connect(dest);
    src.start(t, Math.random() * 2);
    src.stop(t + dur + 0.05);
    return { src, g };
  }

  tone(t, freq, dur, dest, o = {}) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide ?? dur));
    if (o.detune) osc.detune.value = o.detune;
    let node = osc;
    if (o.vib) {
      const l = ctx.createOscillator();
      l.frequency.value = o.vibRate || 5;
      const lg = ctx.createGain();
      lg.gain.value = o.vib;
      l.connect(lg).connect(osc.frequency);
      l.start(t);
      l.stop(t + dur + 0.1);
    }
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(o.lp, t);
      if (o.lp2) f.frequency.exponentialRampToValueAtTime(o.lp2, t + dur);
      f.Q.value = o.q ?? 0.8;
      node.connect(f);
      node = f;
    }
    if (o.bp) {
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = o.bp;
      f.Q.value = o.q ?? 2;
      node.connect(f);
      node = f;
    }
    const g = ctx.createGain();
    const a = o.attack ?? 0.005;
    const peak = o.vol ?? 0.5;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    if (o.hold) g.gain.setValueAtTime(peak, t + a + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (o.am) {
      const l = ctx.createOscillator();
      l.type = 'square';
      l.frequency.value = o.am;
      const lg = ctx.createGain();
      lg.gain.value = 0.5;
      const amg = ctx.createGain();
      amg.gain.value = 0.5;
      l.connect(lg).connect(amg.gain);
      node.connect(amg);
      node = amg;
      l.start(t);
      l.stop(t + dur + 0.1);
    }
    node.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    return osc;
  }

  // Formant-filtered voice for growls and groans.
  voice(t, f0, f1, dur, dest, o = {}) {
    const ctx = this.ctx;
    const sum = ctx.createGain();
    sum.gain.value = 1;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const v = ctx.createOscillator();
    v.frequency.value = o.vibRate || 7;
    const vg = ctx.createGain();
    vg.gain.value = f0 * (o.vib ?? 0.06);
    v.connect(vg).connect(osc.frequency);
    let src = osc;
    if (o.gargle) {
      const am = ctx.createGain();
      const l = ctx.createOscillator();
      l.type = 'square';
      l.frequency.value = o.gargle;
      const lg = ctx.createGain();
      lg.gain.value = 0.45;
      am.gain.value = 0.55;
      l.connect(lg).connect(am.gain);
      osc.connect(am);
      src = am;
      l.start(t);
      l.stop(t + dur + 0.1);
    }
    for (const [f, q, gn] of o.formants || [[500, 4, 1], [1100, 5, 0.6], [2500, 6, 0.25]]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(f, t);
      if (o.formantShift) bp.frequency.exponentialRampToValueAtTime(f * o.formantShift, t + dur);
      bp.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gn;
      src.connect(bp).connect(g).connect(sum);
    }
    const env = ctx.createGain();
    const peak = o.vol ?? 0.6;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + (o.attack ?? 0.05));
    env.gain.setValueAtTime(peak, t + dur * 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    sum.connect(env).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    v.start(t);
    v.stop(t + dur + 0.05);
    if (o.breath) this.noise(t, dur, dest, { bp: o.breath, q: 1.2, vol: peak * 0.4, attack: 0.05 });
  }

  // ------------------------------------------------------------ public sfx
  ui(kind) {
    if (!this.ctx) return;
    const t = this.now();
    const d = this.out({ vol: 0.35, bus: this.sfxBus });
    if (kind === 'move') this.tone(t, 1250, 0.05, d, { type: 'square', vol: 0.3, lp: 3000 });
    else if (kind === 'ok') { this.tone(t, 880, 0.08, d, { type: 'triangle', vol: 0.25 }); this.tone(t + 0.06, 1320, 0.12, d, { type: 'triangle', vol: 0.2 }); }
    else if (kind === 'cancel') { this.tone(t, 660, 0.08, d, { type: 'triangle', vol: 0.2 }); this.tone(t + 0.06, 440, 0.12, d, { type: 'triangle', vol: 0.18 }); }
    else if (kind === 'open') { this.noise(t, 0.25, d, { bp: 2500, bp2: 900, vol: 0.3 }); this.tone(t, 330, 0.3, d, { vol: 0.12, type: 'triangle' }); }
    else if (kind === 'close') this.noise(t, 0.2, d, { bp: 900, bp2: 2500, vol: 0.25 });
    else if (kind === 'tick') this.tone(t, 1600, 0.03, d, { type: 'square', vol: 0.2, lp: 4000 });
  }

  footstep(type, run, at) {
    if (!this.ctx) return;
    const t = this.now() + 0.005;
    const d = this.out({ at, vol: run ? 1.0 : 0.7 });
    const k = rand(0.85, 1.15);
    switch (type) {
      case 'carpet':
        this.noise(t, 0.09, d, { lp: 420 * k, vol: 1.1 });
        this.tone(t, 70, 0.07, d, { vol: 0.6 });
        break;
      case 'stone':
        this.noise(t, 0.06, d, { hp: 1800 * k, vol: 0.9 });
        this.noise(t, 0.12, d, { bp: 700 * k, q: 1, vol: 1.0 });
        this.tone(t, 90, 0.06, d, { vol: 0.5 });
        break;
      case 'tile':
        this.noise(t, 0.05, d, { bp: 3200 * k, q: 4, vol: 1.2 });
        this.noise(t, 0.09, d, { bp: 900 * k, q: 1, vol: 1.0 });
        break;
      case 'rock':
        for (let i = 0; i < 3; i++) this.noise(t + i * 0.018, 0.04, d, { bp: rand(1500, 3500), q: 2, vol: 0.7 });
        this.noise(t, 0.12, d, { lp: 600, vol: 1.0 });
        break;
      default: // wood
        this.noise(t, 0.08, d, { bp: 1100 * k, q: 2.5, vol: 1.2 });
        this.tone(t, 110 * k, 0.09, d, { f2: 70, vol: 0.8 });
        if (Math.random() < 0.12) this.tone(t + 0.04, rand(300, 500), 0.25, d, { type: 'sawtooth', vol: 0.15, bp: 700, q: 6, f2: rand(250, 450) });
    }
  }

  scrape(at) {
    if (!this.ctx) return;
    if (!this.scrapeNode) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.brownBuf;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 380;
      f.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(this.out({ at, vol: 1.6 }));
      src.start();
      this.scrapeNode = { src, g, f };
    }
    this.scrapeT = 0.12;
    this.scrapeNode.g.gain.setTargetAtTime(0.9, this.now(), 0.03);
    this.scrapeNode.f.frequency.setTargetAtTime(rand(300, 520), this.now(), 0.05);
  }

  thunder(delay = 1, intensity = 1) {
    if (!this.ctx) return;
    const t = this.now() + delay;
    const d = this.out({ vol: 0.9 * intensity, bus: this.ambBus });
    if (intensity > 0.6) this.noise(t, 0.4, d, { hp: 400, vol: 0.4, attack: 0.002 });
    const dur = rand(3, 5.5);
    this.noise(t + 0.05, dur, d, { buf: this.brownBuf, lp: 260, lp2: 90, vol: 1.2 * intensity, attack: 0.15 });
    this.noise(t + 0.3, dur * 0.8, d, { buf: this.brownBuf, lp: 160, vol: 0.9 * intensity, attack: 0.5 });
  }

  sfx(name, o = {}) {
    if (!this.ctx) return;
    const t = this.now() + (o.delay || 0) + 0.005;
    const d = this.out({ at: o.at, vol: o.vol ?? 1 });
    const r = o.rate || 1;
    const fn = SFX[name];
    if (fn) fn.call(this, t, d, r, o);
  }

  // ------------------------------------------------------------ ambience
  setAmbience(name, room) {
    if (!this.ctx) { this.pendingAmb = [name, room]; return; }
    if (this.amb && this.amb.name === name) return;
    const old = this.amb;
    if (old) {
      old.gain.gain.setTargetAtTime(0, this.now(), 0.4);
      setTimeout(() => { for (const s of old.srcs) { try { s.stop(); } catch (e) { /* already stopped */ } } old.gain.disconnect(); }, 2500);
    }
    if (!name) { this.amb = null; return; }
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(1, this.now(), 0.6);
    gain.connect(this.ambBus);
    const amb = { name, gain, srcs: [], events: [], t: 0 };
    const bed = (buf, o) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      let node = src;
      for (const [type, f, q] of o.filters) {
        const fl = ctx.createBiquadFilter();
        fl.type = type;
        fl.frequency.value = f;
        fl.Q.value = q ?? 0.7;
        node.connect(fl);
        node = fl;
        if (o.lfo && type === o.lfo.on) {
          const l = ctx.createOscillator();
          l.frequency.value = o.lfo.rate;
          const lg = ctx.createGain();
          lg.gain.value = o.lfo.depth;
          l.connect(lg).connect(fl.frequency);
          l.start();
          amb.srcs.push(l);
        }
      }
      const g = ctx.createGain();
      g.gain.value = o.vol;
      if (o.swell) {
        const l = ctx.createOscillator();
        l.frequency.value = o.swell;
        const lg = ctx.createGain();
        lg.gain.value = o.vol * 0.6;
        l.connect(lg).connect(g.gain);
        l.start();
        amb.srcs.push(l);
      }
      node.connect(g).connect(gain);
      src.start(0, Math.random() * 3);
      amb.srcs.push(src);
    };
    const drone = (f, vol, type = 'sawtooth', lp = 200) => {
      for (const det of [-6, 5]) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.detune.value = det;
        const fl = ctx.createBiquadFilter();
        fl.type = 'lowpass';
        fl.frequency.value = lp;
        const g = ctx.createGain();
        g.gain.value = vol;
        o.connect(fl).connect(g).connect(gain);
        o.start();
        amb.srcs.push(o);
      }
    };
    const rainOut = (vol) => bed(this.pinkBuf, { filters: [['highpass', 900], ['lowpass', 7000]], vol });
    const rainIn = (vol) => bed(this.pinkBuf, { filters: [['lowpass', 700], ['highpass', 120]], vol });
    const wind = (vol) => bed(this.noiseBuf, { filters: [['bandpass', 420, 2.5]], vol, lfo: { on: 'bandpass', rate: 0.07, depth: 260 }, swell: 0.05 });
    switch (name) {
      case 'exterior': case 'rain':
        rainOut(0.16); wind(0.12); bed(this.brownBuf, { filters: [['lowpass', 180]], vol: 0.25 });
        break;
      case 'attic':
        rainIn(0.22); bed(this.pinkBuf, { filters: [['bandpass', 2500, 0.6]], vol: 0.05 }); wind(0.09);
        amb.events.push({ every: [4, 9], fn: (tt, dd) => SFX.creak.call(this, tt, dd, rand(0.6, 1.1), { vol: 0.8 }) });
        break;
      case 'house':
        rainIn(0.22); wind(0.07);
        amb.events.push({ every: [6, 14], fn: (tt, dd) => SFX.creak.call(this, tt, dd, rand(0.5, 1), { vol: 0.6 }) });
        break;
      case 'hall':
        rainIn(0.18); wind(0.1); drone(55, 0.015, 'sawtooth', 120);
        amb.events.push({ every: [7, 15], fn: (tt, dd) => SFX.creak.call(this, tt, dd, rand(0.4, 0.8), { vol: 0.6 }) });
        break;
      case 'fire':
        rainIn(0.16); bed(this.brownBuf, { filters: [['lowpass', 300]], vol: 0.18 });
        amb.events.push({ every: [0.08, 0.5], fn: (tt, dd) => this.noise(tt, 0.02, dd, { bp: rand(1500, 4000), q: 2, vol: rand(0.05, 0.2) }) });
        break;
      case 'drip':
        rainIn(0.14);
        amb.events.push({ every: [0.8, 2.5], fn: (tt, dd) => SFX.drip.call(this, tt, dd, 1, {}) });
        break;
      case 'whispers':
        rainIn(0.12); drone(73.4, 0.012, 'triangle', 300);
        bed(this.noiseBuf, { filters: [['bandpass', 1800, 6]], vol: 0.05, lfo: { on: 'bandpass', rate: 0.9, depth: 700 }, swell: 1.7 });
        bed(this.noiseBuf, { filters: [['bandpass', 900, 5]], vol: 0.05, lfo: { on: 'bandpass', rate: 1.3, depth: 400 }, swell: 2.3 });
        amb.events.push({ every: [1.5, 4], fn: (tt, dd) => this.tone(tt, rand(2500, 4200), 0.25, dd, { vol: 0.03 }) });
        break;
      case 'piano':
        rainIn(0.14);
        amb.events.push({ every: [0.7, 2.2], fn: (tt, dd) => { if (!this.game || !this.game.flags.eleanorGone) SFX.pianoNote.call(this, tt, dd, 1, {}); } });
        break;
      case 'kitchen':
        rainIn(0.14);
        amb.events.push({ every: [0.15, 0.6], fn: (tt, dd) => this.tone(tt, rand(120, 320), 0.08, dd, { vol: 0.04, f2: rand(300, 600) }) });
        break;
      case 'cellar':
        drone(41.2, 0.02, 'sawtooth', 90); bed(this.brownBuf, { filters: [['lowpass', 220]], vol: 0.3, swell: 0.08 });
        amb.events.push({ every: [1.2, 3.5], fn: (tt, dd) => SFX.drip.call(this, tt, dd, 0.8, {}) });
        break;
      case 'cave':
        drone(36.7, 0.03, 'sawtooth', 110); drone(55, 0.012, 'triangle', 200);
        bed(this.brownBuf, { filters: [['lowpass', 380]], vol: 0.45, swell: 0.11 });
        amb.events.push({ every: [0.6, 2], fn: (tt, dd) => SFX.drip.call(this, tt, dd, rand(0.6, 1.2), {}) });
        amb.events.push({ every: [10, 20], fn: (tt, dd) => this.voice(tt, 70, 55, 3, dd, { vol: 0.05, gargle: 9, formants: [[350, 5, 1], [700, 6, 0.5]] }) });
        break;
      case 'dawn':
        wind(0.06); bed(this.brownBuf, { filters: [['lowpass', 400]], vol: 0.2 });
        amb.events.push({ every: [0.05, 0.3], fn: (tt, dd) => this.noise(tt, 0.02, dd, { bp: rand(1500, 4000), q: 2, vol: rand(0.05, 0.15) }) });
        amb.events.push({ every: [3, 7], fn: (tt, dd) => { const f = rand(2500, 3800); for (let i = 0; i < 3; i++) this.tone(tt + i * 0.12, f * rand(0.95, 1.1), 0.1, dd, { vol: 0.03, f2: f * 1.2 }); } });
        break;
      default:
        rainIn(0.18);
    }
    for (const e of amb.events) e.next = rand(...e.every);
    this.amb = amb;
  }

  // ------------------------------------------------------------ music
  music(name) {
    if (!this.ctx) { this.pendingMusic = name; return; }
    if (this.song && this.song.name === name) return;
    if (this.song) {
      const old = this.song;
      old.gain.gain.setTargetAtTime(0, this.now(), 0.5);
      setTimeout(() => old.gain.disconnect(), 3000);
      old.dead = true;
    }
    this.song = null;
    if (!name) return;
    const def = SONGS[name];
    if (!def) return;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(def.vol ?? 1, this.now(), def.fadeIn ?? 0.6);
    gain.connect(this.musicBus);
    this.song = { name, def, gain, bar: 0, next: this.now() + 0.15 };
    if (def.oneShot) { def.play.call(this, this.song.next, gain); this.song.done = true; }
  }

  buildTension() {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(this.musicBus);
    for (const [f, det] of [[73.4, -8], [73.4, 7], [77.8, 0], [110, -4]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      const trem = ctx.createGain();
      const l = ctx.createOscillator();
      l.frequency.value = 6 + Math.random() * 2;
      const lg = ctx.createGain();
      lg.gain.value = 0.35;
      trem.gain.value = 0.6;
      l.connect(lg).connect(trem.gain);
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.value = 420;
      const v = ctx.createGain();
      v.gain.value = 0.05;
      o.connect(trem).connect(fl).connect(v).connect(g);
      o.start();
      l.start();
    }
    this.tensionGain = g;
  }

  update(dt, game) {
    this.game = game;
    if (!this.ctx) return;
    const t = this.now();
    if (this.scrapeNode) {
      this.scrapeT -= dt;
      if (this.scrapeT <= 0) this.scrapeNode.g.gain.setTargetAtTime(0, t, 0.05);
    }
    if (this.amb) {
      for (const e of this.amb.events) {
        e.next -= dt;
        if (e.next <= 0) {
          e.next = rand(...e.every);
          e.fn(t + 0.02, this.amb.gain);
        }
      }
    }
    const s = this.song;
    if (s && !s.dead && !s.done) {
      while (s.next < t + 0.6) {
        s.def.bar.call(this, s.bar, s.next, s.gain);
        s.next += s.def.barLen;
        s.bar++;
      }
    }
    // tension layer: monsters hunting in the current room
    let want = 0;
    if (game && game.state === 'play' && game.room && !(this.song && this.song.def.noTension)) {
      for (const m of game.room.monsters) if (m.alive && (m.state === 'chase' || m.state === 'attack' || m.state === 'leap')) want = 1;
      if (game.room.horror && game.room.horror.state !== 'hidden' && game.room.horror.state !== 'gone') want = 0;
    }
    this.tension += (want - this.tension) * Math.min(1, dt * (want ? 1.5 : 0.4));
    if (this.tensionGain) this.tensionGain.gain.setTargetAtTime(this.tension * 0.9, t, 0.1);
  }
}

// ------------------------------------------------------------------ sfx bank
const SFX = {
  pickup(t, d) {
    [76, 83, 88].forEach((n, i) => this.tone(t + i * 0.07, NOTE(n), 0.6, d, { type: 'triangle', vol: 0.18 }));
  },
  equip(t, d) { this.noise(t, 0.15, d, { bp: 3000, bp2: 1200, q: 3, vol: 1.0 }); this.tone(t + 0.1, 1800, 0.15, d, { vol: 0.08, type: 'square', lp: 4000 }); },
  paper(t, d) { for (let i = 0; i < 4; i++) this.noise(t + i * 0.05, 0.08, d, { bp: rand(3000, 6000), q: 1, vol: 0.25 }); },
  whoosh(t, d, r) { this.noise(t, 0.22 / r, d, { bp: 400 * r, bp2: 2200 * r, q: 1.2, vol: 1.4, attack: 0.05 }); },
  hitFlesh(t, d) { this.tone(t, 140, 0.15, d, { f2: 45, vol: 0.8 }); this.noise(t, 0.12, d, { lp: 900, vol: 0.7 }); this.noise(t, 0.05, d, { bp: 2500, vol: 0.3 }); },
  hitBlunt(t, d) { this.tone(t, 120, 0.2, d, { f2: 40, vol: 0.9 }); this.noise(t, 0.12, d, { lp: 1200, vol: 0.8 }); this.tone(t, 920, 0.4, d, { vol: 0.08, type: 'triangle' }); },
  hurt(t, d) { this.voice(t, rand(170, 190), 110, 0.32, d, { vol: 0.5, formants: [[650, 5, 1], [1100, 6, 0.6]], breath: 1500 }); },
  death(t, d) { this.voice(t, 150, 65, 1.6, d, { vol: 0.55, formants: [[600, 5, 1], [1000, 6, 0.5]], breath: 1200, gargle: 8 }); },
  thud(t, d) { this.tone(t, 90, 0.4, d, { f2: 35, vol: 0.9 }); this.noise(t, 0.25, d, { lp: 500, vol: 0.6 }); },
  gunshot(t, d) {
    this.noise(t, 0.09, d, { hp: 300, vol: 1.4, attack: 0.001 });
    this.tone(t, 110, 0.35, d, { f2: 38, vol: 1.0 });
    this.noise(t + 0.01, 0.7, d, { lp: 1800, lp2: 300, vol: 0.5, attack: 0.01 });
  },
  click(t, d) { this.tone(t, 2400, 0.02, d, { type: 'square', vol: 0.4 }); this.tone(t + 0.04, 1800, 0.02, d, { type: 'square', vol: 0.1 }); },
  doorOpen(t, d) {
    this.noise(t, 0.04, d, { bp: 2500, q: 3, vol: 0.4 });
    this.tone(t + 0.05, rand(160, 210), 0.7, d, { type: 'sawtooth', f2: rand(260, 340), bp: 900, q: 7, vol: 0.7, vib: 18, vibRate: 13 });
  },
  doorHeavy(t, d) {
    this.noise(t, 0.06, d, { bp: 1800, q: 3, vol: 0.5 });
    this.tone(t + 0.05, 110, 1.1, d, { type: 'sawtooth', f2: 160, bp: 600, q: 6, vol: 0.7, vib: 12, vibRate: 9 });
    this.tone(t + 0.02, 600, 0.6, d, { type: 'triangle', vol: 0.06 });
  },
  doorClose(t, d) { this.tone(t, 80, 0.3, d, { f2: 40, vol: 0.6 }); this.noise(t, 0.15, d, { lp: 600, vol: 0.5 }); },
  doorSlam(t, d) { this.tone(t, 70, 0.6, d, { f2: 30, vol: 1.2 }); this.noise(t, 0.4, d, { lp: 900, vol: 1.0 }); },
  locked(t, d) { for (let i = 0; i < 4; i++) this.noise(t + i * 0.07, 0.03, d, { bp: 2200, q: 4, vol: 1.0 }); this.tone(t + 0.3, 1400, 0.15, d, { type: 'triangle', vol: 0.06 }); },
  unlock(t, d) { this.noise(t, 0.03, d, { bp: 3000, q: 5, vol: 0.5 }); this.noise(t + 0.15, 0.04, d, { bp: 1800, q: 4, vol: 0.6 }); this.tone(t + 0.15, 1100, 0.2, d, { type: 'triangle', vol: 0.08 }); },
  creak(t, d, r, o) { this.tone(t, rand(140, 220) * r, rand(0.5, 1.1), d, { type: 'sawtooth', f2: rand(200, 330) * r, bp: rand(700, 1100), q: 8, vol: 0.5 * (o.vol ?? 1), vib: 20, vibRate: rand(9, 15), attack: 0.08 }); },
  knock(t, d) { for (let i = 0; i < 2; i++) { this.noise(t + i * 0.18, 0.06, d, { bp: 600, q: 2, vol: 0.8 }); this.tone(t + i * 0.18, 140, 0.1, d, { f2: 80, vol: 0.5 }); } },
  bang(t, d) { this.tone(t, 65, 0.5, d, { f2: 32, vol: 1.1 }); this.noise(t, 0.3, d, { lp: 700, vol: 0.9 }); this.noise(t, 0.08, d, { bp: 2500, vol: 0.3 }); },
  scratch(t, d) { for (let i = 0; i < 3; i++) this.noise(t + i * 0.35, 0.28, d, { bp: rand(3500, 5500), q: 6, vol: 0.35, attack: 0.08 }); },
  glass(t, d) {
    this.noise(t, 0.15, d, { hp: 2000, vol: 1.0, attack: 0.001 });
    for (let i = 0; i < 14; i++) this.tone(t + rand(0, 0.6), rand(2500, 6000), rand(0.1, 0.4), d, { vol: rand(0.05, 0.15), type: 'triangle' });
    this.tone(t, 80, 0.3, d, { f2: 40, vol: 0.6 });
  },
  splash(t, d) { this.noise(t, 0.5, d, { lp: 1600, lp2: 400, vol: 0.9, attack: 0.01 }); for (let i = 0; i < 6; i++) this.tone(t + rand(0.1, 0.6), rand(300, 800), 0.06, d, { f2: rand(900, 1600), vol: 0.1 }); },
  sting(t, d) {
    for (const n of [48, 49, 54, 60, 61]) this.tone(t, NOTE(n), 2.4, d, { type: 'sawtooth', vol: 0.06, lp: 2400, lp2: 600, attack: 0.02 });
    this.tone(t, 3520, 1.5, d, { vol: 0.05, vib: 60, vibRate: 7, attack: 0.05 });
    this.tone(t, 55, 1.2, d, { f2: 35, vol: 0.6 });
  },
  drink(t, d) { for (let i = 0; i < 3; i++) this.noise(t + i * 0.28, 0.16, d, { lp: 600, vol: 0.5, attack: 0.03 }); this.tone(t + 0.95, 2800, 0.3, d, { type: 'triangle', vol: 0.06 }); },
  pour(t, d) { this.noise(t, 1.2, d, { bp: 1400, q: 2, vol: 0.4, attack: 0.1, sustain: true, release: 0.3 }); for (let i = 0; i < 10; i++) this.tone(t + i * 0.1, rand(500, 900), 0.08, d, { vol: 0.05, f2: rand(900, 1300) }); },
  match(t, d) { this.noise(t, 0.12, d, { bp: 4000, q: 1, vol: 0.6, attack: 0.002 }); this.noise(t + 0.08, 0.6, d, { lp: 500, lp2: 1500, vol: 0.5, attack: 0.1 }); },
  madness(t, d) {
    this.tone(t, 4200, 3.5, d, { vol: 0.05, attack: 1 });
    for (const f of [55, 58.3, 82.4]) this.tone(t, f, 3.5, d, { type: 'sawtooth', vol: 0.12, lp: 300, attack: 1.2 });
    for (let i = 0; i < 8; i++) this.noise(t + rand(0, 3), 0.5, d, { bp: rand(800, 2400), q: 8, vol: 0.12, attack: 0.1 });
  },
  tick(t, d) { this.tone(t, 2200, 0.03, d, { type: 'square', vol: 0.08, lp: 5000 }); },
  chime(t, d) { for (const [m, v] of [[1, 0.35], [2.4, 0.18], [3.0, 0.12], [4.5, 0.08], [5.2, 0.05]]) this.tone(t, 196 * m, 3.5 / Math.sqrt(m), d, { vol: v, attack: 0.002 }); },
  wind(t, d) { for (let i = 0; i < 8; i++) this.noise(t + i * 0.09, 0.03, d, { bp: 2600, q: 5, vol: 0.4 }); },
  mechanism(t, d) { for (let i = 0; i < 6; i++) this.noise(t + i * 0.13, 0.05, d, { bp: rand(800, 2000), q: 4, vol: 0.5 }); this.tone(t + 0.8, 70, 0.6, d, { f2: 40, vol: 0.5 }); this.noise(t + 0.8, 0.3, d, { lp: 800, vol: 0.6 }); },
  needle(t, d) { this.noise(t, 1.5, d, { bp: 3000, q: 0.8, vol: 0.12 }); for (let i = 0; i < 20; i++) this.noise(t + rand(0, 1.5), 0.01, d, { hp: 2000, vol: rand(0.1, 0.3) }); },
  drip(t, d, r) { const f = rand(900, 1700) * r; this.tone(t, f, 0.18, d, { f2: f * 1.8, vol: 0.3, glide: 0.05 }); },
  pianoNote(t, d) {
    const scale = [57, 60, 62, 63, 64, 67, 69, 70, 72];
    const n = scale[Math.floor(Math.random() * scale.length)] + (Math.random() < 0.3 ? -12 : 0);
    for (const [m, v] of [[1, 0.12], [2, 0.04], [3, 0.02]]) this.tone(t, NOTE(n) * m * (1 + rand(-0.004, 0.004)), 2.5, d, { type: 'triangle', vol: v, attack: 0.004 });
  },
  chop(t, d) { this.noise(t, 0.05, d, { bp: 900, q: 1.5, vol: 1.5 }); this.tone(t, 160, 0.08, d, { f2: 90, vol: 0.4 }); },
  bubble(t, d) { for (let i = 0; i < 30; i++) this.tone(t + rand(0, 2.2), rand(80, 260), rand(0.1, 0.25), d, { f2: rand(300, 600), vol: 0.15 }); this.noise(t, 2.4, d, { buf: this.brownBuf, lp: 200, vol: 0.8, attack: 0.5 }); },
  roar(t, d) {
    this.voice(t, 62, 44, 2.8, d, { vol: 0.9, gargle: 13, vib: 0.1, vibRate: 5, formants: [[300, 4, 1], [700, 5, 0.8], [1600, 6, 0.3]], formantShift: 0.7, breath: 700 });
    this.voice(t + 0.1, 93, 60, 2.6, d, { vol: 0.6, gargle: 17, formants: [[500, 4, 1], [1200, 5, 0.5]] });
    this.noise(t, 2.8, d, { buf: this.brownBuf, lp: 160, vol: 1.2, attack: 0.3 });
  },
  slam(t, d) { this.tone(t, 60, 0.6, d, { f2: 28, vol: 1.3 }); this.noise(t, 0.5, d, { lp: 1200, lp2: 300, vol: 1.0 }); SFX.splash.call(this, t + 0.02, d); },
  tentacle(t, d) { this.noise(t, 0.9, d, { bp: 600, bp2: 900, q: 3, vol: 1.2, attack: 0.2 }); },
  seal(t, d) { for (const [i, n] of [72, 76, 79, 84, 88].entries()) this.tone(t + i * 0.12, NOTE(n), 2.2, d, { type: 'triangle', vol: 0.12 }); this.tone(t, 55, 2.5, d, { vol: 0.4, attack: 0.5 }); },
  fireBurst(t, d) { this.noise(t, 1.6, d, { lp: 300, lp2: 3000, vol: 1.2, attack: 0.05 }); for (let i = 0; i < 25; i++) this.noise(t + rand(0.2, 2.5), 0.02, d, { bp: rand(1500, 4000), q: 2, vol: rand(0.2, 0.5) }); },
  rumble(t, d) { this.noise(t, 3, d, { buf: this.brownBuf, lp: 140, vol: 1.6, attack: 0.4 }); for (let i = 0; i < 10; i++) this.noise(t + rand(0, 2.5), 0.05, d, { bp: rand(600, 2000), q: 2, vol: rand(0.1, 0.35) }); },
  monsterStep(t, d) { this.tone(t, 70, 0.12, d, { f2: 45, vol: 0.8 }); this.noise(t, 0.08, d, { lp: 500, vol: 0.7 }); },
  // monster voices
  zombieNotice(t, d) { this.voice(t, rand(85, 100), 70, 1.3, d, { vol: 0.6, gargle: 11, formants: [[400, 5, 1], [800, 6, 0.6]], breath: 900 }); },
  zombieGrowl(t, d) { this.voice(t, rand(70, 90), rand(60, 75), rand(0.9, 1.5), d, { vol: 0.35, gargle: rand(8, 12), formants: [[380, 5, 1], [760, 6, 0.5]] }); },
  zombieAttack(t, d) { this.voice(t, 110, 80, 0.7, d, { vol: 0.5, gargle: 14, formants: [[500, 4, 1], [1000, 5, 0.6]], breath: 1200 }); },
  zombieHurt(t, d) { this.voice(t, 130, 90, 0.4, d, { vol: 0.45, gargle: 18 }); },
  zombieDie(t, d) { this.voice(t, 100, 45, 1.8, d, { vol: 0.55, gargle: 7, formants: [[400, 5, 1], [700, 6, 0.5]], breath: 700 }); },
  cookNotice(t, d) { this.voice(t, 60, 48, 1.6, d, { vol: 0.75, gargle: 9, formants: [[300, 4, 1], [650, 5, 0.6]], breath: 600 }); },
  cookGrowl(t, d) { this.voice(t, 55, 45, 1.2, d, { vol: 0.45, gargle: 8, formants: [[300, 4, 1], [600, 5, 0.5]] }); },
  cookAttack(t, d) { this.voice(t, 80, 55, 0.9, d, { vol: 0.65, gargle: 12, formants: [[350, 4, 1], [800, 5, 0.6]], breath: 800 }); },
  cookHurt(t, d) { this.voice(t, 90, 60, 0.5, d, { vol: 0.55, gargle: 15 }); },
  cookDie(t, d) { this.voice(t, 70, 32, 2.4, d, { vol: 0.7, gargle: 6, formants: [[300, 4, 1], [600, 5, 0.5]], breath: 500 }); },
  ghoulNotice(t, d) { this.voice(t, 300, 520, 0.6, d, { vol: 0.5, gargle: 30, formants: [[900, 5, 1], [2000, 6, 0.7]], breath: 3000 }); },
  ghoulGrowl(t, d) { this.voice(t, rand(180, 240), rand(150, 200), 0.6, d, { vol: 0.3, gargle: 25, formants: [[800, 5, 1], [1800, 6, 0.5]] }); },
  ghoulAttack(t, d) { this.voice(t, 380, 700, 0.45, d, { vol: 0.5, gargle: 35, formants: [[1100, 4, 1], [2400, 5, 0.6]], breath: 3500 }); },
  ghoulHurt(t, d) { this.voice(t, 500, 300, 0.3, d, { vol: 0.45, gargle: 40, formants: [[1000, 5, 1], [2200, 6, 0.5]] }); },
  ghoulDie(t, d) { this.voice(t, 450, 120, 1.2, d, { vol: 0.5, gargle: 25, formants: [[900, 5, 1], [2000, 6, 0.5]], breath: 2500 }); },
  crawlerNotice(t, d) { for (let i = 0; i < 18; i++) this.noise(t + i * 0.025, 0.012, d, { bp: rand(2500, 4500), q: 3, vol: 0.4 }); this.noise(t, 0.6, d, { bp: 5000, q: 1, vol: 0.2, attack: 0.1 }); },
  crawlerGrowl(t, d) { for (let i = 0; i < 10; i++) this.noise(t + i * 0.03, 0.012, d, { bp: rand(2500, 4500), q: 3, vol: 0.25 }); },
  crawlerAttack(t, d) { this.noise(t, 0.35, d, { bp: 4500, q: 1, vol: 0.5, attack: 0.02 }); },
  crawlerHurt(t, d) { this.voice(t, 600, 900, 0.25, d, { vol: 0.3, gargle: 45, formants: [[1500, 4, 1], [3000, 5, 0.5]] }); },
  crawlerDie(t, d) { this.voice(t, 700, 200, 0.7, d, { vol: 0.35, gargle: 40, formants: [[1500, 4, 1], [3000, 5, 0.5]] }); this.noise(t, 0.3, d, { lp: 900, vol: 0.4 }); },
  ghostNotice(t, d) { SFX.ghostScream.call(this, t, d); },
  ghostScream(t, d) {
    this.tone(t, 520, 1.6, d, { f2: 980, glide: 0.5, vol: 0.18, vib: 40, vibRate: 6, attack: 0.08 });
    this.tone(t, 780, 1.6, d, { f2: 1250, glide: 0.6, vol: 0.1, vib: 50, vibRate: 7, attack: 0.08 });
    this.noise(t, 1.6, d, { bp: 1800, q: 3, vol: 0.3, attack: 0.1 });
  },
  ghostAttack(t, d) { SFX.ghostScream.call(this, t, d); },
  ghostLunge(t, d) {
    this.tone(t, 640, 0.55, d, { f2: 1500, glide: 0.3, vol: 0.16, vib: 70, vibRate: 9, attack: 0.02 });
    this.noise(t, 0.45, d, { bp: 2200, q: 2, vol: 0.4, attack: 0.02 });
  },
  neckCreak(t, d) { for (let i = 0; i < 9; i++) this.noise(t + i * 0.11 + rand(0, 0.05), 0.04, d, { bp: rand(300, 700), q: 7, vol: 0.35 }); },
  candleOut(t, d) { this.noise(t, 0.3, d, { lp: 700, vol: 0.35, attack: 0.01 }); },
  ghostGrowl(t, d) { this.tone(t, rand(300, 500), 1.2, d, { vol: 0.06, vib: 20, vibRate: 5, attack: 0.3 }); },
  ghostHurt() {},
  ghostDie() {},
};

// ------------------------------------------------------------------ music
function piano(t, n, dur, dest, vol) {
  const f = NOTE(n);
  this.tone(t, f, dur, dest, { type: 'triangle', vol, attack: 0.004 });
  this.tone(t, f * 2, dur * 0.6, dest, { type: 'sine', vol: vol * 0.3, attack: 0.004 });
  this.tone(t, f * 3.01, dur * 0.3, dest, { type: 'sine', vol: vol * 0.1, attack: 0.004 });
}
function musicBox(t, n, dur, dest, vol) {
  const f = NOTE(n);
  this.tone(t, f, dur, dest, { vol, attack: 0.002 });
  this.tone(t, f * 4.02, dur * 0.4, dest, { vol: vol * 0.25, attack: 0.002 });
  this.tone(t, f * 2.98, dur * 0.25, dest, { vol: vol * 0.15, attack: 0.002 });
}
function pad(t, notes, dur, dest, vol, lp = 900) {
  for (const n of notes) for (const det of [-7, 6]) this.tone(t, NOTE(n), dur, dest, { type: 'sawtooth', vol: vol / notes.length, detune: det, lp, attack: dur * 0.35, hold: dur * 0.3 });
}
function timp(t, n, dest, vol) {
  this.tone(t, NOTE(n), 0.9, dest, { f2: NOTE(n) * 0.85, vol, attack: 0.003 });
  this.noise(t, 0.15, dest, { lp: 500, vol: vol * 0.6 });
}

const TITLE_MEL = [
  [62, 0, 1], [65, 1, 1], [69, 2, 2], [67, 4, 1], [65, 5, 1], [64, 6, 2],
  [62, 8, 1], [64, 9, 1], [65, 10, 1], [67, 11, 1], [65, 12, 1], [64, 13, 1], [61, 14, 2],
];
const SONGS = {
  title: {
    barLen: 4.8, vol: 0.9,
    bar(i, t, d) {
      const chords = [[38, 45, 50], [34, 46, 53], [36, 43, 52], [33, 45, 52]];
      pad.call(this, t, chords[i % 4], 5.2, d, 0.22, 600);
      const beat = 4.8 / 8;
      if (i % 8 >= 2) {
        const half = i % 2;
        for (const [n, b, l] of TITLE_MEL) if ((b >= 8) === !!half) musicBox.call(this, t + (b % 8) * beat, n + 12, l * beat * 2.2, d, 0.12);
      }
      if (i % 4 === 0) this.tone(t, NOTE(26), 4.5, d, { vol: 0.25, attack: 0.5 });
    },
  },
  prologue: {
    barLen: 6, vol: 0.8,
    bar(i, t, d) {
      pad.call(this, t, [[38, 45], [36, 43], [34, 41], [33, 45]][i % 4], 6.5, d, 0.18, 500);
      if (i % 2 === 1) musicBox.call(this, t + 1.5, [74, 72, 70, 69][i % 4], 3, d, 0.08);
    },
  },
  waltz: {
    barLen: 1.5, vol: 1.0, noTension: true,
    bar(i, t, d) {
      if (!this.waltzFx) {
        // gramophone colouring
        const ctx = this.ctx;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1400;
        bp.Q.value = 0.5;
        bp.connect(d);
        this.waltzFx = { bp, dest: d };
      }
      if (this.waltzFx.dest !== d) { this.waltzFx.bp.disconnect(); this.waltzFx.bp.connect(d); this.waltzFx.dest = d; }
      const o = this.waltzFx.bp;
      const prog = [[45, [57, 60, 64]], [40, [56, 59, 64]], [45, [57, 60, 64]], [38, [57, 62, 65]], [43, [55, 59, 62]], [48, [55, 60, 64]], [40, [56, 59, 62]], [45, [57, 60, 64]]];
      const [bass, ch] = prog[i % 8];
      const b = 0.5;
      piano.call(this, t, bass, 1.2, o, 0.5);
      for (const k of [1, 2]) for (const n of ch) piano.call(this, t + k * b, n, 0.4, o, 0.15);
      const mel = [[76, 74, 72], [71, 0, 0], [72, 74, 76], [77, 0, 76], [74, 72, 71], [72, 0, 0], [71, 69, 68], [69, 0, 0]][i % 8];
      mel.forEach((n, k) => { if (n) piano.call(this, t + k * b, n, k === 0 ? 1.0 : 0.6, o, 0.28); });
      for (let k = 0; k < 6; k++) this.noise(t + Math.random() * 1.5, 0.01, d, { hp: 3000, vol: Math.random() * 0.08 });
    },
  },
  boss: {
    barLen: 2.0, vol: 0.9, noTension: true,
    bar(i, t, d) {
      const s = 0.25;
      const root = [38, 38, 39, 37][Math.floor(i / 2) % 4];
      for (let k = 0; k < 8; k++) this.tone(t + k * s, NOTE(root + (k % 4 === 3 ? 1 : 0)), 0.22, d, { type: 'sawtooth', vol: 0.12, lp: 380 });
      timp.call(this, t, root - 12, d, 0.5);
      if (i % 2) timp.call(this, t + 1.5, root - 12, d, 0.35);
      pad.call(this, t, [root + 24, root + 25, root + 30], 2.1, d, 0.12, 1400);
      if (i % 4 === 3) this.tone(t, NOTE(root + 36), 2, d, { type: 'sawtooth', vol: 0.04, vib: 30, vibRate: 7, lp: 3000 });
    },
  },
  escape: {
    barLen: 1.6, vol: 0.9, noTension: true,
    bar(i, t, d) {
      const s = 0.2;
      const root = [40, 40, 41, 43][i % 4];
      for (let k = 0; k < 8; k++) this.tone(t + k * s, NOTE(root + (k % 2 ? 12 : 0)), 0.18, d, { type: 'sawtooth', vol: 0.11, lp: 600 });
      timp.call(this, t, root - 12, d, 0.5);
      timp.call(this, t + 0.8, root - 12, d, 0.4);
      if (i % 2 === 0) pad.call(this, t, [root + 24, root + 27, root + 31], 1.6, d, 0.14, 2000);
    },
  },
  ending: {
    barLen: 3.2, vol: 0.9, noTension: true,
    bar(i, t, d) {
      const prog = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]];
      pad.call(this, t, prog[i % 4], 3.6, d, 0.2, 800);
      const mel = [[72, 74, 76, 79], [76, 74, 72, 69], [69, 71, 72, 76], [74, 0, 71, 0]][i % 4];
      mel.forEach((n, k) => { if (n && i > 0) piano.call(this, t + k * 0.8, n, 1.6, d, 0.1); });
    },
  },
  death: {
    oneShot: true, vol: 1, noTension: true,
    play(t, d) {
      for (const n of [36, 37, 42, 48, 49]) this.tone(t, NOTE(n), 5, d, { type: 'sawtooth', vol: 0.06, lp: 1400, lp2: 200, attack: 0.05 });
      this.tone(t, NOTE(24), 4, d, { vol: 0.5, f2: NOTE(19) });
      musicBox.call(this, t + 1.5, 62, 3, d, 0.08);
      musicBox.call(this, t + 2.3, 61, 4, d, 0.07);
    },
  },
};
