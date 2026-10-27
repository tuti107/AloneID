// What lasts between visits: saves, settings, endings seen. Kept in this
// browser's localStorage, read synchronously; and, when the page runs as a
// claude.ai artifact that is granted it, in the viewer's own private store
// on the server too (db, data/users/<id>/), so a phone app that forgets its
// web storage between launches still finds the saves. Whichever copy of a
// key was written last wins.
const PREFIX = 'ashcombe.';
const META = 'ashcombe.meta'; // key -> when this browser last wrote it
// the server refuses these for good: carry on with this browser only
const FATAL = ['not_granted', 'revoked', 'invalid_argument', 'transform_error', 'capability_disabled', 'capability_removed', 'quota_exceeded'];

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function lsKeys() {
  const out = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX) && k !== META) out.push(k); } } catch (e) { /* storage unavailable */ }
  return out;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

class Store {
  constructor() {
    this.mem = new Map(); // when localStorage itself is unavailable
    this.cloud = null; // the viewer's collection, once connected
    this.pending = new Set();
    this.writing = new Set();
    this.listeners = [];
    try { this.meta = JSON.parse(lsGet(META) || '{}') || {}; } catch (e) { this.meta = {}; }
  }

  get(k) {
    const v = lsGet(k);
    return v !== null ? v : this.mem.has(k) ? this.mem.get(k) : null;
  }

  // True when it was kept somewhere that outlasts the page.
  set(k, v) {
    const ok = lsSet(k, v);
    this.mem.set(k, v);
    this.meta[k] = Date.now();
    lsSet(META, JSON.stringify(this.meta));
    this.push(k);
    return ok || !!this.cloud;
  }

  // Something changed under the game's feet (the server's copy arrived).
  onChange(fn) { this.listeners.push(fn); }

  async connect() {
    const c = typeof window !== 'undefined' ? window.claude : null;
    if (!c || typeof c.use !== 'function') return false;
    try {
      const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
      if (!db || !user) return false;
      const uid = await user.id();
      if (!uid) return false;
      const col = db.collection('data/users/' + uid);
      const snap = await col.get();
      const remote = {};
      for (const d of snap.docs) {
        const b = d.data();
        if (d.id.startsWith(PREFIX) && b && typeof b.value === 'string') remote[d.id] = b;
      }
      this.cloud = col;
      let changed = false;
      for (const k of new Set([...Object.keys(remote), ...lsKeys(), ...this.mem.keys()])) {
        const r = remote[k], local = this.get(k), at = this.meta[k] || 0;
        if (r && (local === null || (r.at || 0) > at)) {
          lsSet(k, r.value);
          this.mem.set(k, r.value);
          this.meta[k] = r.at || 0;
          changed = true;
        } else if (local !== null && (!r || at > (r.at || 0))) this.push(k);
      }
      lsSet(META, JSON.stringify(this.meta));
      if (changed) for (const f of this.listeners) f();
      return true;
    } catch (e) {
      this.cloud = null;
      return false;
    }
  }

  // One write at a time per key; a key written again meanwhile goes up once
  // more, with its latest value.
  push(k) {
    if (!this.cloud || !k.startsWith(PREFIX) || k === META) return;
    this.pending.add(k);
    if (!this.writing.has(k)) this.flush(k);
  }

  async flush(k) {
    this.writing.add(k);
    let retried = false;
    while (this.cloud && this.pending.has(k)) {
      this.pending.delete(k);
      const value = this.get(k);
      try {
        if (value === null) await this.cloud.doc(k).delete();
        else await this.cloud.doc(k).set({ value, at: this.meta[k] || Date.now() });
        retried = false;
      } catch (e) {
        const code = e && e.code;
        if (FATAL.includes(code)) { this.cloud = null; break; }
        if (!retried) { retried = true; this.pending.add(k); await wait(800 + Math.random() * 800); }
      }
    }
    this.writing.delete(k);
  }
}

export const store = new Store();
