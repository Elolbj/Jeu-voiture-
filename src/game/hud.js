// Interface de course : compte-tours, vitesse, rapport, position, chronos, classement,
// mini-carte, messages, aides actives.
import { formatTime, formatGap, clamp } from '../core/utils.js';

function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

export class HUD {
  constructor(root, track, opts = {}) {
    this.track = track;
    this.root = el('div', 'hud', root);
    this.opts = opts;
    // Haut gauche : position et tours
    const tl = el('div', 'hud-tl', this.root);
    this.posEl = el('div', 'hud-pos', tl);
    this.lapEl = el('div', 'hud-lap', tl);
    // Tour de classement
    this.tower = el('div', 'hud-tower', this.root);
    // Haut droite : chronos
    const tr = el('div', 'hud-tr', this.root);
    this.timeEl = el('div', 'hud-time', tr);
    this.lastEl = el('div', 'hud-sub', tr);
    this.bestEl = el('div', 'hud-sub', tr);
    this.deltaEl = el('div', 'hud-delta', tr);
    // Message central
    this.msgEl = el('div', 'hud-msg', this.root);
    this.bigEl = el('div', 'hud-big', this.root);
    this.subMsgEl = el('div', 'hud-submsg', this.root);
    // Compte-tours (canvas)
    const br = el('div', 'hud-br', this.root);
    this.tach = el('canvas', 'hud-tach', br);
    this.tach.width = 280;
    this.tach.height = 280;
    this.tctx = this.tach.getContext('2d');
    this.pedals = el('div', 'hud-pedals', br);
    this.thrBar = el('div', 'bar thr', el('div', 'pedal', this.pedals));
    this.brkBar = el('div', 'bar brk', el('div', 'pedal', this.pedals));
    // Mini-carte
    this.map = el('canvas', 'hud-map', this.root);
    this.map.width = 230;
    this.map.height = 230;
    this.mctx = this.map.getContext('2d');
    this.buildMapBg();
    // Aides
    this.aids = el('div', 'hud-aids', this.root);
    this.aidEls = {};
    for (const k of ['ABS', 'TCS', 'ESP']) this.aidEls[k] = el('span', 'aid', this.aids, k);
    this.camLabel = el('div', 'hud-cam', this.root);
    this.msgTimer = 0;
    this.subTimer = 0;
    this.visible = true;
  }

  buildMapBg() {
    const t = this.track;
    const b = t.bounds;
    const W = this.map.width, H = this.map.height;
    const pad = 16;
    const sx = (W - pad * 2) / (b.maxX - b.minX), sz = (H - pad * 2) / (b.maxZ - b.minZ);
    const s = Math.min(sx, sz);
    const ox = (W - (b.maxX - b.minX) * s) / 2, oz = (H - (b.maxZ - b.minZ) * s) / 2;
    this.mapT = (x, z) => [ox + (x - b.minX) * s, oz + (z - b.minZ) * s];
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const c = off.getContext('2d');
    c.lineJoin = 'round';
    c.lineCap = 'round';
    const path = () => {
      c.beginPath();
      for (let i = 0; i < t.count; i++) {
        const [x, y] = this.mapT(t.px[i], t.pz[i]);
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      if (t.closed) c.closePath();
    };
    c.strokeStyle = 'rgba(0,0,0,0.55)';
    c.lineWidth = 9;
    path();
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 4;
    path();
    c.stroke();
    // ligne de départ
    const p = t.pointAt(t.startS, 0);
    const [sx0, sy0] = this.mapT(p.x, p.z);
    c.fillStyle = '#ffb627';
    c.fillRect(sx0 - 4, sy0 - 4, 8, 8);
    this.mapBg = off;
  }

  setVisible(v) {
    this.visible = v;
    this.root.style.display = v ? '' : 'none';
  }

  message(text, dur = 2, cls = '') {
    this.msgEl.textContent = text;
    this.msgEl.className = 'hud-msg show ' + cls;
    this.msgTimer = dur;
  }

  sub(text, dur = 2.5) {
    this.subMsgEl.textContent = text;
    this.subMsgEl.classList.add('show');
    this.subTimer = dur;
  }

  big(text, cls = '') {
    this.bigEl.textContent = text;
    this.bigEl.className = 'hud-big ' + (text ? 'show ' : '') + cls;
  }

  setCamLabel(text) {
    this.camLabel.textContent = text;
    this.camLabel.classList.add('show');
    clearTimeout(this._camT);
    this._camT = setTimeout(() => this.camLabel.classList.remove('show'), 1500);
  }

  update(dt, sim, car, extra = {}) {
    if (!this.visible) return;
    const v = car.vehicle;
    // Messages
    if (this.msgTimer > 0) {
      this.msgTimer -= dt;
      if (this.msgTimer <= 0) this.msgEl.classList.remove('show');
    }
    if (this.subTimer > 0) {
      this.subTimer -= dt;
      if (this.subTimer <= 0) this.subMsgEl.classList.remove('show');
    }
    const standings = extra.standings || sim.standings();
    const n = sim.cars.length;
    if (n > 1) this.posEl.innerHTML = `<span class="p">${car.position}</span><span class="n">/${n}</span>`;
    else this.posEl.innerHTML = extra.title ? `<span class="t">${extra.title}</span>` : '';
    if (extra.licence) {
      const tg = extra.licence.targets;
      this.lapEl.innerHTML = tg ? `<span class="m">🥇 ${formatTime(tg.gold)}</span> <span class="m">🥈 ${formatTime(tg.silver)}</span> <span class="m">🥉 ${formatTime(tg.bronze)}</span>` : '';
    } else if (sim.track.closed) {
      const lapShown = clamp(car.lap + 1, 1, sim.laps);
      this.lapEl.innerHTML = sim.mode === 'free' ? `TOUR <b>${car.lap + 1}</b>` : `TOUR <b>${lapShown}</b>/${sim.laps}`;
    } else {
      const pr = Math.round(sim.lapProgress(car) * 100);
      this.lapEl.innerHTML = `PROGRESSION <b>${pr}%</b>`;
    }
    let cur = 0;
    if (extra.licence) cur = sim.time;
    else if (car.finished) cur = car.lastLap;
    else if (sim.phase === 'racing' || sim.phase === 'finishing') cur = sim.time - car.lapStart;
    this.timeEl.textContent = formatTime(cur);
    this.timeEl.classList.toggle('invalid', !car.currentLapValid && !car.finished);
    this.lastEl.innerHTML = `<span>DERNIER</span> ${formatTime(car.lastLap)}`;
    this.bestEl.innerHTML = `<span>MEILLEUR</span> ${formatTime(car.bestLap)}`;
    if (extra.delta !== undefined && extra.delta !== null && isFinite(extra.delta)) {
      this.deltaEl.textContent = formatGap(extra.delta);
      this.deltaEl.className = 'hud-delta ' + (extra.delta <= 0 ? 'good' : 'bad');
    } else this.deltaEl.textContent = '';

    // Classement (8 premiers)
    if (n > 1) {
      if (!this._towerT || (this._towerT -= dt) <= 0) {
        this._towerT = 0.25;
        const leader = standings[0];
        let html = '';
        standings.slice(0, 10).forEach((c) => {
          let gap = '';
          if (c !== leader) {
            if (c.finished && leader.finished) gap = '+' + (c.finishTime - leader.finishTime).toFixed(1);
            else {
              const g = sim.gapBetween(leader, c);
              gap = g > 0 ? '+' + g.toFixed(1) : '';
              const lapsDown = Math.floor((leader.distance - c.distance) / sim.track.length);
              if (sim.track.closed && lapsDown >= 1) gap = `+${lapsDown} T`;
            }
          } else gap = sim.phase === 'finishing' && c.finished ? 'ARRIVÉ' : 'TÊTE';
          html += `<div class="row ${c.isPlayer ? 'me' : ''}"><span class="rp">${c.position}</span><span class="sw" style="background:${c.color}"></span><span class="rn">${c.short || c.name}</span><span class="rg">${gap}</span></div>`;
        });
        this.tower.innerHTML = html;
      }
    } else this.tower.innerHTML = '';

    this.drawTach(v);
    this.thrBar.style.height = `${clamp(v.controls.throttle, 0, 1) * 100}%`;
    this.brkBar.style.height = `${clamp(v.controls.brake, 0, 1) * 100}%`;
    this.aidEls.ABS.classList.toggle('on', v.absActive);
    this.aidEls.TCS.classList.toggle('on', v.tcsActive);
    this.aidEls.ESP.classList.toggle('on', !!v.stabilityActive);
    this.drawMap(sim, car);
  }

  drawTach(v) {
    const c = this.tctx;
    const W = 280, cx = 140, cy = 140, R = 112;
    c.clearRect(0, 0, W, W);
    const maxRpm = Math.ceil((v.limiter + 500) / 1000) * 1000;
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    const ang = (r) => a0 + (a1 - a0) * clamp(r / maxRpm, 0, 1);
    // fond
    c.fillStyle = 'rgba(8,12,18,0.62)';
    c.beginPath();
    c.arc(cx, cy, R + 18, 0, Math.PI * 2);
    c.fill();
    // zone rouge
    c.strokeStyle = 'rgba(255,60,60,0.85)';
    c.lineWidth = 8;
    c.beginPath();
    c.arc(cx, cy, R, ang(v.redline), a1);
    c.stroke();
    // graduations
    c.strokeStyle = 'rgba(255,255,255,0.75)';
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.font = '600 15px Barlow Condensed, Arial';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let r = 0; r <= maxRpm; r += 500) {
      const a = ang(r);
      const major = r % 1000 === 0;
      c.lineWidth = major ? 3 : 1.5;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * (R - (major ? 14 : 8)), cy + Math.sin(a) * (R - (major ? 14 : 8)));
      c.lineTo(cx + Math.cos(a) * (R - 2), cy + Math.sin(a) * (R - 2));
      c.stroke();
      if (major) c.fillText(String(r / 1000), cx + Math.cos(a) * (R - 28), cy + Math.sin(a) * (R - 28));
    }
    // arc actif
    const rpm = v.rpm;
    const shift = rpm > v.redline * 0.94;
    const grad = c.createLinearGradient(0, W, W, 0);
    grad.addColorStop(0, '#3d8bff');
    grad.addColorStop(1, shift ? '#ff4040' : '#7fd3ff');
    c.strokeStyle = grad;
    c.lineWidth = 10;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(cx, cy, R + 10, a0, ang(rpm));
    c.stroke();
    c.lineCap = 'butt';
    // aiguille
    const a = ang(rpm);
    c.strokeStyle = '#ff5a3a';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30);
    c.lineTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4));
    c.stroke();
    // rapport
    const g = v.shiftTimer > 0 && v.pendingGear !== null ? v.pendingGear : v.gear;
    c.fillStyle = shift && Math.floor(performance.now() / 80) % 2 ? '#ff4040' : '#ffffff';
    c.font = '700 64px Barlow Condensed, Arial';
    c.fillText(g === -1 ? 'R' : g === 0 ? 'N' : String(g), cx, cy - 8);
    // vitesse
    c.fillStyle = '#ffffff';
    c.font = '700 40px Barlow Condensed, Arial';
    c.fillText(String(Math.round(v.speedKmh)), cx, cy + 52);
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.font = '500 13px Barlow, Arial';
    c.fillText('km/h', cx, cy + 76);
    c.fillText('× 1000 tr/min', cx, cy + 96);
  }

  drawMap(sim, me) {
    const c = this.mctx;
    c.clearRect(0, 0, 230, 230);
    c.globalAlpha = 0.9;
    c.drawImage(this.mapBg, 0, 0);
    c.globalAlpha = 1;
    for (const car of sim.cars) {
      const p = car.vehicle.position;
      const [x, y] = this.mapT(p.x, p.z);
      c.fillStyle = car === me ? '#ffb627' : car.color || '#5fa8ff';
      c.strokeStyle = 'rgba(0,0,0,0.8)';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(x, y, car === me ? 6 : 4.5, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
  }

  destroy() {
    this.root.remove();
  }
}
