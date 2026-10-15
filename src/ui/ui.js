// Mini-framework d'interface : écrans, navigation clavier/manette spatiale, notifications.
import { uiClick, uiMove } from '../core/audio.js';

export function h(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return e;
}

export class UI {
  constructor(root, input) {
    this.root = root;
    this.input = input;
    this.layer = h('div', { class: 'ui-layer' });
    root.appendChild(this.layer);
    this.toastBox = h('div', { class: 'toasts' });
    root.appendChild(this.toastBox);
    this.current = null;
    this.stack = [];
    this.focused = null;
    this.navRepeat = 0;
    this.overlay = null;
    root.addEventListener('mouseover', (e) => {
      const n = e.target.closest?.('.nav');
      if (n && !n.classList.contains('disabled')) this.focus(n, false);
    });
  }

  // Affiche un écran (remplace l'écran courant)
  show(screen) {
    if (this.current) {
      this.current.destroy?.();
      this.current.el.remove();
    }
    this.current = screen;
    if (!screen) return;
    screen.el.classList.add('screen');
    this.layer.appendChild(screen.el);
    requestAnimationFrame(() => screen.el.classList.add('in'));
    this.focused = null;
    const first = screen.el.querySelector('.nav.default:not(.disabled)') || screen.el.querySelector('.nav:not(.disabled)');
    if (first) this.focus(first, false);
    screen.onShow?.();
  }

  // Calque modal (dialogues, pause, confirmation)
  pushOverlay(screen) {
    this.popOverlay();
    this.overlay = screen;
    screen.el.classList.add('overlay');
    this.root.appendChild(screen.el);
    requestAnimationFrame(() => screen.el.classList.add('in'));
    this.savedFocus = this.focused;
    this.focused = null;
    const first = screen.el.querySelector('.nav.default:not(.disabled)') || screen.el.querySelector('.nav:not(.disabled)');
    if (first) this.focus(first, false);
  }

  popOverlay() {
    if (!this.overlay) return;
    this.overlay.destroy?.();
    this.overlay.el.remove();
    this.overlay = null;
    this.focused = this.savedFocus && document.body.contains(this.savedFocus) ? this.savedFocus : null;
    if (this.focused) this.focused.classList.add('focus');
  }

  activeScreen() {
    return this.overlay || this.current;
  }

  focus(el, sound = true) {
    if (this.focused === el) return;
    if (this.focused) this.focused.classList.remove('focus');
    this.focused = el;
    if (el) {
      el.classList.add('focus');
      el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      if (sound) uiMove();
      this.activeScreen()?.onFocus?.(el);
    }
  }

  move(dx, dy) {
    const scr = this.activeScreen();
    if (!scr) return;
    const items = [...scr.el.querySelectorAll('.nav')].filter((n) => !n.classList.contains('disabled') && n.offsetParent !== null);
    if (!items.length) return;
    if (!this.focused || !items.includes(this.focused)) {
      this.focus(items[0]);
      return;
    }
    const r0 = this.focused.getBoundingClientRect();
    const cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
    let best = null, bestScore = Infinity;
    for (const it of items) {
      if (it === this.focused) continue;
      const r = it.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const vx = x - cx, vy = y - cy;
      const along = vx * dx + vy * dy;
      if (along <= 2) continue;
      const across = Math.abs(vx * dy - vy * dx);
      const score = along + across * 2.2;
      if (score < bestScore) { bestScore = score; best = it; }
    }
    if (best) this.focus(best);
  }

  // Appelé à chaque image
  update(dt) {
    const inp = this.input;
    const scr = this.activeScreen();
    if (!scr) return;
    if (scr.update) scr.update(dt);
    if (scr !== this.activeScreen() || scr.captureKeys) return;
    // Navigation (clavier + manette avec répétition)
    let dx = 0, dy = 0;
    const k = (code) => inp.edges.has(code);
    if (k('ArrowUp') || inp.padEdges?.has('menuUp')) dy = -1;
    if (k('ArrowDown') || inp.padEdges?.has('menuDown')) dy = 1;
    if (k('ArrowLeft') || inp.padEdges?.has('menuLeft')) dx = -1;
    if (k('ArrowRight') || inp.padEdges?.has('menuRight')) dx = 1;
    const gp = inp.gp;
    if (gp && !dx && !dy) {
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (Math.abs(ax) > 0.6 || Math.abs(ay) > 0.6) {
        this.navRepeat -= dt;
        if (this.navRepeat <= 0) {
          if (Math.abs(ax) > Math.abs(ay)) dx = Math.sign(ax); else dy = Math.sign(ay);
          this.navRepeat = 0.22;
        }
      } else this.navRepeat = 0;
    }
    if (dx || dy) {
      if (scr.onArrow && scr.onArrow(dx, dy, this.focused)) return;
      this.move(dx, dy);
    }
    if (inp.pressed('confirm') || k('Space')) {
      if (this.focused && !this.focused.classList.contains('disabled')) {
        uiClick();
        this.focused.click();
      } else scr.onConfirm?.();
      return;
    }
    if (k('Escape') || k('Backspace') || inp.padEdges?.has('back')) {
      if (scr.back) {
        uiClick();
        scr.back();
      }
    }
  }

  toast(text, kind = '') {
    const t = h('div', { class: 'toast ' + kind }, text);
    this.toastBox.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => {
      t.classList.remove('in');
      setTimeout(() => t.remove(), 400);
    }, 2800);
  }

  confirm(title, text, onYes, yesLabel = 'Confirmer', noLabel = 'Annuler') {
    const el = h('div', { class: 'modal' },
      h('div', { class: 'modal-box' },
        h('h2', {}, title),
        h('p', {}, text),
        h('div', { class: 'row end' },
          h('button', { class: 'btn nav', onclick: () => this.popOverlay() }, noLabel),
          h('button', { class: 'btn primary nav default', onclick: () => { this.popOverlay(); onYes(); } }, yesLabel),
        ),
      ),
    );
    this.pushOverlay({ el, back: () => this.popOverlay() });
  }
}

// Bouton-tuile standard
export function tile(label, sub, onClick, opts = {}) {
  return h('button', { class: `tile nav ${opts.cls || ''} ${opts.disabled ? 'disabled' : ''} ${opts.default ? 'default' : ''}`, onclick: opts.disabled ? null : onClick, style: opts.style },
    opts.icon ? h('span', { class: 'tile-icon', html: opts.icon }) : null,
    h('span', { class: 'tile-label' }, label),
    sub ? h('span', { class: 'tile-sub' }, sub) : null,
    opts.badge ? h('span', { class: 'tile-badge' }, opts.badge) : null,
  );
}

export function btn(label, onClick, cls = '') {
  return h('button', { class: `btn nav ${cls}`, onclick: onClick }, label);
}

export const ICONS = {
  story: '<svg viewBox="0 0 24 24"><path d="M4 4h10l6 6v10H4z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M14 4v6h6M7 14h10M7 17h7" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>',
  race: '<svg viewBox="0 0 24 24"><path d="M5 21V4M5 4h12l-2 4 2 4H5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  quick: '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  dealer: '<svg viewBox="0 0 24 24"><path d="M3 15l2-5c.5-1.3 1.6-2 3-2h8c1.4 0 2.5.7 3 2l2 5v3H3z M6 18v2M18 18v2M3 15h18" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="7" cy="15" r="1.2" fill="currentColor"/><circle cx="17" cy="15" r="1.2" fill="currentColor"/></svg>',
  garage: '<svg viewBox="0 0 24 24"><path d="M3 10 12 4l9 6v10H3z M7 20v-6h10v6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  tune: '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  licence: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="11" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5.5 16.5c.8-1.8 2-2.6 3.5-2.6s2.7.8 3.5 2.6M14 10h5M14 13h4" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>',
  options: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="1.6"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
};
