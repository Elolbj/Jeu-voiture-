// Commandes tactiles (téléphones / tablettes) : direction, pédales, pause, caméra.
export class TouchControls {
  constructor(root) {
    this.active = false;
    this.state = { left: false, right: false, throttle: false, brake: false };
    this.edges = new Set();
    this.enabled = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (!this.enabled) return;
    const el = document.createElement('div');
    el.className = 'touch-ui';
    el.innerHTML = `
      <div class="tz tz-steer">
        <button class="tb" data-k="left" aria-label="Gauche">◀</button>
        <button class="tb" data-k="right" aria-label="Droite">▶</button>
      </div>
      <div class="tz tz-pedals">
        <button class="tb brake" data-k="brake" aria-label="Frein">FREIN</button>
        <button class="tb gas" data-k="throttle" aria-label="Accélérateur">GAZ</button>
      </div>
      <div class="tz tz-top">
        <button class="tb small" data-e="camera" aria-label="Caméra">CAM</button>
        <button class="tb small" data-e="pause" aria-label="Pause">II</button>
      </div>`;
    root.appendChild(el);
    this.el = el;
    const pointers = new Map();
    const refresh = () => {
      for (const k of Object.keys(this.state)) this.state[k] = false;
      for (const k of pointers.values()) if (k) this.state[k] = true;
      el.querySelectorAll('[data-k]').forEach((b) => b.classList.toggle('on', this.state[b.dataset.k]));
    };
    el.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.tb');
      if (!b) return;
      e.preventDefault();
      if (b.dataset.e) { this.edges.add(b.dataset.e); return; }
      pointers.set(e.pointerId, b.dataset.k);
      b.setPointerCapture?.(e.pointerId);
      refresh();
    });
    const end = (e) => { pointers.delete(e.pointerId); refresh(); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.show(false);
  }

  show(v) {
    this.active = v && this.enabled;
    if (this.el) this.el.style.display = this.active ? '' : 'none';
  }
}
