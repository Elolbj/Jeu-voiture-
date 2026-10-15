// Entrées : clavier (QWERTY/AZERTY via codes physiques) et manette (API Gamepad).
import { clamp } from './utils.js';

const KEYMAP = {
  throttle: ['ArrowUp', 'KeyW'],
  brake: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  handbrake: ['Space'],
  shiftUp: ['ShiftLeft', 'ShiftRight', 'KeyE', 'PageUp'],
  shiftDown: ['ControlLeft', 'ControlRight', 'KeyQ', 'PageDown'],
  camera: ['KeyC'],
  lookBack: ['KeyX', 'KeyB'],
  pause: ['Escape', 'KeyP'],
  reset: ['KeyR'],
  hud: ['KeyH'],
  confirm: ['Enter', 'NumpadEnter'],
  back: ['Backspace'],
};

export class Input {
  constructor() {
    this.down = new Set();
    this.edges = new Set();
    this.gp = null;
    this.gpPrev = [];
    this.usingPad = false;
    this.state = { throttle: 0, brake: 0, steer: 0, handbrake: 0, lookBack: false };
    this.kbThrottle = 0;
    this.kbBrake = 0;
    this.kbSteer = 0;
    this.enabled = true;
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (!this.down.has(e.code)) this.edges.add(e.code);
      this.down.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && this.captureArrows) e.preventDefault();
      this.usingPad = false;
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
    this.captureArrows = true;
  }

  key(action) {
    return KEYMAP[action].some((k) => this.down.has(k));
  }

  // Front montant (une seule fois par appui) — clavier, manette ou écran tactile
  pressed(action) {
    const k = KEYMAP[action]?.some((c) => this.edges.has(c));
    const g = this.padEdges?.has(action);
    const t = this.touch?.edges.has(action);
    return !!(k || g || t);
  }

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    this.gp = gp;
    this.padEdges = new Set();
    if (!gp) return null;
    const b = gp.buttons.map((x) => x.pressed);
    const map = { shiftUp: 5, shiftDown: 4, camera: 3, pause: 9, reset: 8, handbrakeBtn: 0, lookBackBtn: 1, confirm: 0, back: 1 };
    for (const [act, idx] of Object.entries(map)) {
      if (b[idx] && !this.gpPrev[idx]) this.padEdges.add(act);
    }
    // croix directionnelle pour les menus
    if (b[12] && !this.gpPrev[12]) this.padEdges.add('menuUp');
    if (b[13] && !this.gpPrev[13]) this.padEdges.add('menuDown');
    if (b[14] && !this.gpPrev[14]) this.padEdges.add('menuLeft');
    if (b[15] && !this.gpPrev[15]) this.padEdges.add('menuRight');
    this.gpPrev = b;
    const any = gp.buttons.some((x) => x.value > 0.1) || gp.axes.some((a) => Math.abs(a) > 0.25);
    if (any) this.usingPad = true;
    return gp;
  }

  // À appeler une fois par image
  update(dt) {
    const gp = this.pollGamepad();
    const s = this.state;
    // Clavier : rampes douces
    const T = this.touch?.active ? this.touch.state : null;
    const kt = this.key('throttle') || T?.throttle ? 1 : 0;
    const kb = this.key('brake') || T?.brake ? 1 : 0;
    this.kbThrottle += clamp(kt - this.kbThrottle, -dt * 8, dt * 6);
    this.kbBrake += clamp(kb - this.kbBrake, -dt * 10, dt * 7);
    const ks = (this.key('right') || T?.right ? 1 : 0) - (this.key('left') || T?.left ? 1 : 0);
    s.keyboardSteer = ks;
    if (gp && this.usingPad) {
      const ax = gp.axes[0] || 0;
      const dead = 0.06;
      let st = Math.abs(ax) < dead ? 0 : (ax - Math.sign(ax) * dead) / (1 - dead);
      st = Math.sign(st) * Math.pow(Math.abs(st), 1.6);
      s.steer = st;
      s.analog = true;
      const rt = gp.buttons[7]?.value ?? 0;
      const lt = gp.buttons[6]?.value ?? 0;
      s.throttle = Math.max(rt, this.kbThrottle);
      s.brake = Math.max(lt, this.kbBrake);
      s.handbrake = gp.buttons[0]?.pressed || this.key('handbrake') ? 1 : 0;
      s.lookBack = !!gp.buttons[1]?.pressed || this.key('lookBack');
    } else {
      s.analog = false;
      s.steer = ks;
      s.throttle = this.kbThrottle;
      s.brake = this.kbBrake;
      s.handbrake = this.key('handbrake') ? 1 : 0;
      s.lookBack = this.key('lookBack');
    }
  }

  // Vide les fronts : à appeler en fin d'image
  endFrame() {
    this.edges.clear();
    this.touch?.edges.clear();
    if (this.padEdges) this.padEdges.clear();
  }
}

export const input = new Input();
