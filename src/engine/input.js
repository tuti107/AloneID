// Unified input: keyboard, gamepad and on-screen touch controls all feed the
// same set of logical actions.

// Push a stick (touch or gamepad) this far over to run.
export const RUN_TILT = 0.75;

const KEYMAP = {
  ArrowUp: ['up'], KeyW: ['up'],
  ArrowDown: ['down'], KeyS: ['down'],
  ArrowLeft: ['left'], KeyA: ['left'],
  ArrowRight: ['right'], KeyD: ['right'],
  ShiftLeft: ['run'], ShiftRight: ['run'],
  Space: ['action', 'confirm'], KeyZ: ['action', 'confirm'], KeyE: ['action', 'confirm'],
  Enter: ['confirm', 'action'], NumpadEnter: ['confirm', 'action'],
  KeyX: ['attack', 'cancel'], KeyF: ['attack'], ControlLeft: ['attack'], ControlRight: ['attack'],
  KeyI: ['inventory'], KeyC: ['inventory'], Tab: ['inventory'],
  KeyM: ['map'],
  Escape: ['pause', 'cancel'], KeyP: ['pause'], Backspace: ['cancel'],
};
const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace']);
// Holding a direction steps a menu on by itself: once more after
// REPEAT_DELAY seconds, then every REPEAT_EVERY.
const REPEATS = ['up', 'down', 'left', 'right'];
const REPEAT_DELAY = 0.38;
const REPEAT_EVERY = 0.11;

export class Input {
  constructor() {
    this.kb = new Map(); // code -> actions
    this.touch = new Set();
    this.pad = new Set();
    this.cur = new Set();
    this.prev = new Set();
    this.pressedSet = new Set();
    this.freshSet = new Set();
    this.repeatAt = new Map(); // direction held -> when it next steps (Infinity: not until let go)
    this.taps = new Set();
    this.consumed = new Set();
    this.axis = { x: 0, y: 0 };
    this.touchStick = null; // {x, y} from virtual stick, or null
    this.padStick = null;
    this.lastDevice = 'kb';
    this.anyPressed = false;
    this._anyTap = false;
    this.listeners = [];

    window.addEventListener('keydown', (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      this.lastDevice = 'kb';
      this._anyTap = true;
      const acts = KEYMAP[e.code];
      if (!acts || e.repeat) return;
      this.kb.set(e.code, acts);
      for (const a of acts) this.taps.add(a);
    });
    window.addEventListener('keyup', (e) => {
      this.kb.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.kb.clear();
      this.touch.clear();
    });
    window.addEventListener('pointerdown', () => { this._anyTap = true; });
  }

  setTouch(action, on) {
    this.lastDevice = 'touch';
    if (on) {
      if (!this.touch.has(action)) this.taps.add(action);
      this.touch.add(action);
    } else this.touch.delete(action);
  }

  pollGamepad() {
    this.pad.clear();
    this.padStick = null;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      const dead = 0.3;
      if (b(12) || ay < -dead) this.pad.add('up');
      if (b(13) || ay > dead) this.pad.add('down');
      if (b(14) || ax < -dead) this.pad.add('left');
      if (b(15) || ax > dead) this.pad.add('right');
      if (Math.hypot(ax, ay) > dead) this.padStick = { x: ax, y: ay };
      if (b(0)) { this.pad.add('action'); this.pad.add('confirm'); }
      if (b(1)) { this.pad.add('cancel'); this.pad.add('run'); }
      if (b(2)) this.pad.add('attack');
      if (b(3)) this.pad.add('inventory');
      if (b(5) || b(7) || b(4) || b(6)) this.pad.add('run');
      if (b(9)) this.pad.add('pause');
      if (this.pad.size) this.lastDevice = 'pad';
      break;
    }
  }

  update() {
    this.pollGamepad();
    this.prev = this.cur;
    const cur = new Set();
    for (const acts of this.kb.values()) for (const a of acts) cur.add(a);
    for (const a of this.touch) cur.add(a);
    for (const a of this.pad) cur.add(a);
    this.cur = cur;
    const pressed = new Set(this.taps);
    for (const a of cur) if (!this.prev.has(a)) pressed.add(a);
    this.freshSet = new Set(pressed);
    const now = performance.now() / 1000;
    for (const a of REPEATS) {
      if (!cur.has(a)) { this.repeatAt.delete(a); continue; }
      const at = this.repeatAt.get(a);
      if (at === undefined) this.repeatAt.set(a, now + REPEAT_DELAY);
      else if (now >= at) {
        pressed.add(a);
        this.repeatAt.set(a, Math.max(at + REPEAT_EVERY, now));
      }
    }
    this.pressedSet = pressed;
    this.taps.clear();
    this.consumed.clear();
    this.anyPressed = this._anyTap;
    this._anyTap = false;

    // Analog movement vector (x right, y down/back), for "modern" controls.
    let x = 0, y = 0;
    const stick = this.touchStick || this.padStick;
    this.analog = !!stick;
    if (stick) { x = stick.x; y = stick.y; }
    else {
      if (cur.has('left')) x -= 1;
      if (cur.has('right')) x += 1;
      if (cur.has('up')) y -= 1;
      if (cur.has('down')) y += 1;
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
    }
    this.axis.x = x;
    this.axis.y = y;
  }

  down(a) { return this.cur.has(a); }
  // pressed this frame, or stepping on while held (directions)
  pressed(a) { return this.pressedSet.has(a) && !this.consumed.has(a); }
  // pressed this frame only, never by holding (for steps that can't be undone)
  tapped(a) { return this.freshSet.has(a) && !this.consumed.has(a); }
  // a direction already held when a menu opens doesn't step it until let go
  // and pushed again (he may still be walking as he opens it)
  holdOff() { for (const a of REPEATS) if (this.cur.has(a)) this.repeatAt.set(a, Infinity); }
  consume(...as) { for (const a of as) this.consumed.add(a); }
  clear() {
    this.kb.clear();
    this.touch.clear();
    this.cur.clear();
    this.prev.clear();
    this.pressedSet.clear();
    this.freshSet.clear();
    this.repeatAt.clear();
    this.taps.clear();
  }
}
