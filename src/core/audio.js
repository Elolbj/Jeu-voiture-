// Audio synthétisé (Web Audio) : moteurs (couches d'impulsions de combustion par type de
// moteur), turbo, pneus, vent, chocs, bips de départ, musique d'ambiance générative.
import { clamp, lerp, rng } from './utils.js';

let ctx = null;
let master, sfxBus, musicBus, engineBus;
const settings = { master: 0.8, sfx: 0.9, music: 0.45 };

export function audioCtx() {
  return ctx;
}

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = settings.master;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  comp.attack.value = 0.005;
  comp.release.value = 0.2;
  master.connect(comp).connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = settings.sfx;
  sfxBus.connect(master);
  engineBus = ctx.createGain();
  engineBus.gain.value = 1;
  engineBus.connect(sfxBus);
  musicBus = ctx.createGain();
  musicBus.gain.value = settings.music;
  musicBus.connect(master);
  return ctx;
}

export function setVolumes(v) {
  Object.assign(settings, v);
  if (!ctx) return;
  master.gain.setTargetAtTime(settings.master, ctx.currentTime, 0.05);
  sfxBus.gain.setTargetAtTime(settings.sfx, ctx.currentTime, 0.05);
  musicBus.gain.setTargetAtTime(settings.music, ctx.currentTime, 0.05);
}

let noiseBuf = null;
function noiseBuffer() {
  if (noiseBuf) return noiseBuf;
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function noiseSource() {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer();
  s.loop = true;
  s.start(0, Math.random() * 1.5);
  return s;
}

// ------------------------------------------------------------------ Moteur
// Profil acoustique par architecture : intervalles d'allumage et amplitudes par cylindre
const LAYOUTS = {
  L4: { pattern: [1, 0.93, 0.97, 0.9], res: [190, 420, 1150], noise: 0.18, rasp: 0.5 },
  B4: { pattern: [1, 0.62, 0.95, 0.68], res: [150, 330, 900], noise: 0.22, rasp: 0.35, uneven: 0.08 },
  L6: { pattern: [1, 0.95, 0.97, 0.93, 0.98, 0.94], res: [230, 520, 1500], noise: 0.12, rasp: 0.55 },
  V6: { pattern: [1, 0.78, 0.94, 0.84, 0.97, 0.8], res: [190, 460, 1300], noise: 0.16, rasp: 0.6, uneven: 0.05 },
  B6: { pattern: [1, 0.88, 0.95, 0.84, 0.97, 0.86], res: [260, 600, 1800], noise: 0.15, rasp: 0.75 },
  V8: { pattern: [1, 0.55, 0.9, 1, 0.6, 0.95, 0.58, 0.62], res: [120, 290, 820], noise: 0.2, rasp: 0.45, uneven: 0.12 },
  V10: { pattern: [1, 0.85, 0.95, 0.8, 0.92, 0.88, 0.97, 0.83, 0.9, 0.86], res: [300, 700, 2000], noise: 0.14, rasp: 0.8 },
  V12: { pattern: [1, 0.96, 0.98, 0.95, 0.97, 0.94, 0.99, 0.95, 0.97, 0.96, 0.98, 0.94], res: [340, 820, 2300], noise: 0.1, rasp: 0.7 },
};

const bufferCache = new Map();
// Génère un buffer bouclable contenant `cycles` cycles moteur (2 tours) au régime baseRpm
function engineBuffer(layout, baseRpm, cylinders, seed) {
  const key = `${layout}-${baseRpm}-${cylinders}`;
  if (bufferCache.has(key)) return bufferCache.get(key);
  const L = LAYOUTS[layout] || LAYOUTS.L4;
  const sr = ctx.sampleRate;
  const cycles = 8;
  const cycleLen = 120 / baseRpm; // s
  const n = Math.round(cycleLen * cycles * sr);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  const r = rng(seed);
  const pulses = cylinders;
  const res = L.res;
  // Durée d'amortissement des résonances
  const tau = [0.012, 0.006, 0.0025];
  let lp = 0;
  for (let c = 0; c < cycles; c++) {
    for (let p = 0; p < pulses; p++) {
      const jitter = (L.uneven || 0) * (r() - 0.5) * 0.5;
      const t0 = (c + (p + jitter) / pulses) * cycleLen;
      const amp = L.pattern[p % L.pattern.length] * (0.88 + r() * 0.24);
      const start = Math.floor(t0 * sr);
      const len = Math.floor(Math.min(cycleLen / pulses * 2.2, 0.05) * sr);
      for (let k = 0; k < len; k++) {
        const t = k / sr;
        let v = 0;
        for (let m = 0; m < 3; m++) v += Math.exp(-t / tau[m]) * Math.sin(2 * Math.PI * res[m] * t + m) * (m === 0 ? 1 : m === 1 ? 0.55 : 0.25 * L.rasp);
        // impulsion de pression initiale
        v += Math.exp(-t / 0.0015) * 0.8;
        v += (r() * 2 - 1) * L.noise * Math.exp(-t / 0.006);
        const idx = (start + k) % n;
        d[idx] += v * amp;
      }
    }
  }
  // Filtrage passe-bas léger + normalisation
  let max = 0;
  for (let i = 0; i < n; i++) {
    lp += (d[i] - lp) * 0.35;
    d[i] = lp;
    max = Math.max(max, Math.abs(d[i]));
  }
  // retrait de la composante continue
  let mean = 0;
  for (let i = 0; i < n; i++) mean += d[i];
  mean /= n;
  for (let i = 0; i < n; i++) d[i] = (d[i] - mean) / (max || 1);
  bufferCache.set(key, buf);
  return buf;
}

function distortionCurve(k) {
  const n = 1024;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    c[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return c;
}

export class EngineSound {
  constructor(spec, opts = {}) {
    this.ok = !!ctx;
    if (!ctx) return;
    const e = spec.engine;
    this.spec = spec;
    this.layout = e.layout || 'L4';
    this.cyl = e.cyl || 4;
    this.redline = e.redline;
    this.idle = e.idle;
    this.turbo = !!e.turbo;
    this.race = spec.category === 'course' || spec.category === 'proto';
    this.player = !!opts.player;
    const out = ctx.createGain();
    out.gain.value = 0;
    this.out = out;
    if (opts.panner) {
      const p = ctx.createPanner();
      p.panningModel = 'equalpower';
      p.distanceModel = 'inverse';
      p.refDistance = 6;
      p.maxDistance = 400;
      p.rolloffFactor = 1.4;
      out.connect(p).connect(engineBus);
      this.panner = p;
    } else out.connect(engineBus);

    // Chaîne : couches -> mélange -> saturation -> filtre -> sortie
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 0.7;
    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = distortionCurve(this.race ? 6 : 3);
    this.shaper.oversample = '2x';
    this.pre = ctx.createGain();
    this.pre.gain.value = 0.6;
    this.pre.connect(this.shaper).connect(this.filter).connect(out);
    // Couches à différents régimes de référence
    const bases = this.player ? [1200, 3600, 6800] : [3000];
    this.layers = bases.map((b, i) => {
      const src = ctx.createBufferSource();
      src.buffer = engineBuffer(this.layout, b, this.cyl, 7 + i * 13 + this.cyl);
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(g).connect(this.pre);
      src.start(0, Math.random() * 0.5);
      return { src, g, base: b };
    });
    // Fondamentale (corps du son)
    this.osc = ctx.createOscillator();
    this.osc.type = 'sawtooth';
    this.oscG = ctx.createGain();
    this.oscG.gain.value = 0;
    const oscF = ctx.createBiquadFilter();
    oscF.type = 'lowpass';
    oscF.frequency.value = 600;
    this.osc.connect(oscF).connect(this.oscG).connect(this.pre);
    this.osc.start();
    // Admission (souffle)
    if (this.player) {
      this.intake = noiseSource();
      this.intakeF = ctx.createBiquadFilter();
      this.intakeF.type = 'bandpass';
      this.intakeF.Q.value = 1.4;
      this.intakeG = ctx.createGain();
      this.intakeG.gain.value = 0;
      this.intake.connect(this.intakeF).connect(this.intakeG).connect(out);
    }
    // Turbo : sifflement + décharge
    if (this.turbo && this.player) {
      this.whistle = ctx.createOscillator();
      this.whistle.type = 'sine';
      this.whistleG = ctx.createGain();
      this.whistleG.gain.value = 0;
      this.whistle.connect(this.whistleG).connect(out);
      this.whistle.start();
    }
    this.lastThrottle = 0;
    this.popTimer = 0;
    this.prevBoost = 0;
  }

  update(rpm, load, opts = {}) {
    if (!this.ok) return;
    const t = ctx.currentTime;
    const rpmC = Math.max(this.idle * 0.8, rpm);
    const u = clamp(rpmC / this.redline, 0, 1.15);
    // Couches : fondu enchaîné selon le régime
    const n = this.layers.length;
    for (let i = 0; i < n; i++) {
      const L = this.layers[i];
      L.src.playbackRate.setTargetAtTime(rpmC / L.base, t, 0.02);
      let w = 1;
      if (n > 1) {
        const prev = i > 0 ? this.layers[i - 1].base : 0;
        const next = i < n - 1 ? this.layers[i + 1].base : Infinity;
        if (rpmC < L.base) w = i === 0 ? 1 : clamp((rpmC - prev) / (L.base - prev), 0, 1);
        else w = i === n - 1 ? 1 : clamp((next - rpmC) / (next - L.base), 0, 1);
      }
      L.g.gain.setTargetAtTime(w * 0.75, t, 0.03);
    }
    const fire = (rpmC / 60) * (this.cyl / 2);
    this.osc.frequency.setTargetAtTime(fire * 0.5, t, 0.02);
    this.oscG.gain.setTargetAtTime(0.08 + load * 0.12, t, 0.05);
    // Charge : ouverture du filtre et saturation
    const cutoff = 500 + u * (this.race ? 5200 : 3600) * (0.45 + load * 0.55);
    this.filter.frequency.setTargetAtTime(cutoff, t, 0.04);
    this.pre.gain.setTargetAtTime(0.35 + load * 0.55 + u * 0.15, t, 0.05);
    const vol = (opts.volume ?? 1) * (0.32 + load * 0.38 + u * 0.18);
    this.out.gain.setTargetAtTime(vol, t, 0.05);
    if (this.intakeG) {
      this.intakeF.frequency.setTargetAtTime(400 + u * 2200, t, 0.05);
      this.intakeG.gain.setTargetAtTime(load * u * 0.12, t, 0.05);
    }
    if (this.whistleG) {
      const b = opts.boost ?? 0;
      this.whistle.frequency.setTargetAtTime(2200 + b * 4200 + u * 800, t, 0.05);
      this.whistleG.gain.setTargetAtTime(b * b * 0.035, t, 0.06);
      // Soupape de décharge au lever de pied
      if (this.prevBoost > 0.55 && b < this.prevBoost - 0.25) blowOff(this.out, 0.25 * this.prevBoost);
      this.prevBoost = b;
    }
    // Pétarades au lever de pied à haut régime
    if (this.player && this.lastThrottle > 0.6 && load < 0.05 && u > 0.6) this.popTimer = 0.6;
    if (this.popTimer > 0 && opts.dt) {
      this.popTimer -= opts.dt;
      if (Math.random() < opts.dt * (this.race ? 16 : 9)) pop(this.out, 0.3 + Math.random() * 0.4);
    }
    this.lastThrottle = load;
  }

  setPosition(x, y, z) {
    if (this.panner) {
      const t = ctx.currentTime;
      if (this.panner.positionX) {
        this.panner.positionX.setTargetAtTime(x, t, 0.03);
        this.panner.positionY.setTargetAtTime(y, t, 0.03);
        this.panner.positionZ.setTargetAtTime(z, t, 0.03);
      } else this.panner.setPosition(x, y, z);
    }
  }

  stop() {
    if (!this.ok) return;
    const t = ctx.currentTime;
    this.out.gain.setTargetAtTime(0, t, 0.05);
    setTimeout(() => {
      try {
        this.layers.forEach((l) => l.src.stop());
        this.osc.stop();
        this.intake?.stop();
        this.whistle?.stop();
        this.out.disconnect();
      } catch (e) {
        void e;
      }
    }, 300);
  }
}

function pop(dest, amp) {
  const t = ctx.currentTime;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer();
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 300 + Math.random() * 500;
  f.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(amp, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  s.connect(f).connect(g).connect(dest);
  s.start(t, Math.random());
  s.stop(t + 0.08);
}

function blowOff(dest, amp) {
  const t = ctx.currentTime;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer();
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.setValueAtTime(2500, t);
  f.frequency.exponentialRampToValueAtTime(800, t + 0.35);
  const g = ctx.createGain();
  g.gain.setValueAtTime(amp, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  s.connect(f).connect(g).connect(dest);
  s.start(t, Math.random());
  s.stop(t + 0.45);
}

// ------------------------------------------------------------------ Pneus, vent, surfaces
export class CarAmbience {
  constructor() {
    this.ok = !!ctx;
    if (!ctx) return;
    // Crissement
    this.sq = noiseSource();
    this.sqF = ctx.createBiquadFilter();
    this.sqF.type = 'bandpass';
    this.sqF.Q.value = 9;
    this.sqF.frequency.value = 900;
    this.sqG = ctx.createGain();
    this.sqG.gain.value = 0;
    this.sq.connect(this.sqF).connect(this.sqG).connect(sfxBus);
    this.sqTone = ctx.createOscillator();
    this.sqTone.type = 'triangle';
    this.sqTone.frequency.value = 1050;
    this.sqToneG = ctx.createGain();
    this.sqToneG.gain.value = 0;
    this.sqTone.connect(this.sqToneG).connect(sfxBus);
    this.sqTone.start();
    // Vent
    this.wind = noiseSource();
    this.windF = ctx.createBiquadFilter();
    this.windF.type = 'lowpass';
    this.windG = ctx.createGain();
    this.windG.gain.value = 0;
    this.wind.connect(this.windF).connect(this.windG).connect(sfxBus);
    // Roulement / graviers
    this.road = noiseSource();
    this.roadF = ctx.createBiquadFilter();
    this.roadF.type = 'lowpass';
    this.roadF.frequency.value = 180;
    this.roadG = ctx.createGain();
    this.roadG.gain.value = 0;
    this.road.connect(this.roadF).connect(this.roadG).connect(sfxBus);
    this.rough = noiseSource();
    this.roughF = ctx.createBiquadFilter();
    this.roughF.type = 'bandpass';
    this.roughF.frequency.value = 700;
    this.roughF.Q.value = 0.6;
    this.roughG = ctx.createGain();
    this.roughG.gain.value = 0;
    this.rough.connect(this.roughF).connect(this.roughG).connect(sfxBus);
    this.curbPh = 0;
  }

  update(dt, v, curbing) {
    if (!this.ok) return;
    const t = ctx.currentTime;
    const speed = Math.abs(v.speed);
    let slip = 0, offRoad = 0, curb = 0;
    for (const w of v.wheels) {
      if (!w.contact) continue;
      const s = w.surface.name;
      if (s === 'asphalt' || s === 'curb') slip = Math.max(slip, w.slipVel);
      if (s === 'grass' || s === 'gravel' || s === 'sand') offRoad += 0.25;
      if (s === 'curb') curb += 0.25;
    }
    const sq = clamp((slip - 2.2) / 7, 0, 1) * clamp(speed / 4, 0, 1);
    this.sqG.gain.setTargetAtTime(sq * 0.22, t, 0.04);
    this.sqToneG.gain.setTargetAtTime(sq * 0.03, t, 0.05);
    this.sqF.frequency.setTargetAtTime(700 + sq * 500 + Math.sin(t * 7) * 40, t, 0.05);
    this.sqTone.frequency.setTargetAtTime(950 + sq * 250 + Math.sin(t * 11) * 25, t, 0.05);
    this.windF.frequency.setTargetAtTime(250 + speed * 12, t, 0.1);
    this.windG.gain.setTargetAtTime(clamp(speed * speed / 9000, 0, 0.25), t, 0.1);
    this.roadG.gain.setTargetAtTime(clamp(speed / 60, 0, 0.18) + curb * 0.25 * clamp(speed / 20, 0, 1) * (0.6 + 0.4 * Math.sin(t * speed * 3)), t, 0.03);
    this.roughG.gain.setTargetAtTime(offRoad * clamp(speed / 25, 0, 1) * 0.3, t, 0.05);
    void dt;
    void curbing;
  }

  stop() {
    if (!this.ok) return;
    for (const g of [this.sqG, this.windG, this.roadG, this.roughG, this.sqToneG]) g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    setTimeout(() => {
      try {
        [this.sq, this.wind, this.road, this.rough, this.sqTone].forEach((s) => s.stop());
      } catch (e) {
        void e;
      }
    }, 300);
  }
}

// ------------------------------------------------------------------ Effets ponctuels
export function sfxImpact(strength) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const a = clamp(strength, 0.05, 1);
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900 + a * 1500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(a * 0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25 + a * 0.3);
  s.connect(f).connect(g).connect(sfxBus);
  s.start(t, Math.random());
  s.stop(t + 0.6);
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
  const og = ctx.createGain();
  og.gain.setValueAtTime(a * 0.8, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  o.connect(og).connect(sfxBus);
  o.start(t);
  o.stop(t + 0.3);
}

export function sfxShift() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer();
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1800;
  f.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.06, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  s.connect(f).connect(g).connect(sfxBus);
  s.start(t, Math.random());
  s.stop(t + 0.06);
}

export function beep(freq = 660, dur = 0.18, vol = 0.25) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function uiClick() {
  beep(1400, 0.05, 0.05);
}
export function uiMove() {
  beep(900, 0.035, 0.03);
}

// ------------------------------------------------------------------ Musique d'ambiance (lounge générative)
export class Music {
  constructor() {
    this.playing = false;
    this.timer = null;
  }

  start() {
    if (!ctx || this.playing) return;
    this.playing = true;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.gain.setTargetAtTime(0.9, ctx.currentTime, 1.5);
    // Réverbération
    const conv = ctx.createConvolver();
    const len = ctx.sampleRate * 2.6;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    conv.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.out.connect(musicBus);
    this.out.connect(conv).connect(wet).connect(musicBus);
    this.bpm = 88;
    this.beat = 60 / this.bpm;
    this.step = 0;
    this.next = ctx.currentTime + 0.1;
    // Progression : Fmaj9 – Em7 – Dm9 – G13 – Cmaj9 – Am9 – Dm7 – G7sus
    this.chords = [
      [53, 57, 60, 64, 67], [52, 55, 59, 62, 66], [50, 53, 57, 60, 64], [43, 53, 57, 59, 64],
      [48, 52, 55, 59, 62], [45, 48, 52, 55, 59], [50, 53, 57, 60, 65], [43, 48, 53, 55, 58],
    ];
    this.r = rng(11);
    this.timer = setInterval(() => this.schedule(), 50);
  }

  note(midi, t, dur, vel, type = 'epiano') {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const g = ctx.createGain();
    g.connect(this.out);
    if (type === 'epiano') {
      const car = ctx.createOscillator();
      car.type = 'sine';
      car.frequency.value = f;
      const mod = ctx.createOscillator();
      mod.frequency.value = f * 2;
      const mg = ctx.createGain();
      mg.gain.setValueAtTime(f * 1.4, t);
      mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.8);
      mod.connect(mg).connect(car.frequency);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel * 0.07, t + 0.008);
      g.gain.exponentialRampToValueAtTime(vel * 0.02, t + 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      car.connect(g);
      car.start(t); mod.start(t);
      car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
    } else if (type === 'bass') {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 400;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel * 0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(lp).connect(g);
      o.start(t);
      o.stop(t + dur + 0.05);
    } else if (type === 'hat') {
      const s = ctx.createBufferSource();
      s.buffer = noiseBuffer();
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 7000;
      g.gain.setValueAtTime(vel * 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      s.connect(hp).connect(g);
      s.start(t, Math.random());
      s.stop(t + 0.06);
    } else if (type === 'kick') {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(vel * 0.25, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.3);
    }
  }

  schedule() {
    if (!this.playing) return;
    while (this.next < ctx.currentTime + 0.25) {
      const st = this.step;
      const t = this.next;
      const bar = Math.floor(st / 8) % this.chords.length;
      const ch = this.chords[bar];
      const pos = st % 8; // croches
      if (pos === 0) {
        ch.slice(1).forEach((m, i) => this.note(m, t + i * 0.012, this.beat * 3.6, 0.8));
        this.note(ch[0] - 12, t, this.beat * 1.6, 1, 'bass');
        this.note(0, t, 0, 1, 'kick');
      }
      if (pos === 3) this.note(ch[0] - 12 + 7, t, this.beat * 0.9, 0.7, 'bass');
      if (pos === 4) {
        this.note(ch[0] - 12, t, this.beat * 1.4, 0.8, 'bass');
        if (this.r() < 0.5) this.note(0, t, 0, 0.6, 'kick');
      }
      if (pos === 6 && this.r() < 0.6) ch.slice(2).forEach((m, i) => this.note(m, t + i * 0.01, this.beat * 1.2, 0.45));
      if (pos % 2 === 1) this.note(0, t, 0, pos === 3 || pos === 7 ? 1 : 0.6, 'hat');
      // Mélodie clairsemée
      if (this.r() < 0.22) {
        const m = ch[1 + Math.floor(this.r() * (ch.length - 1))] + 12 + (this.r() < 0.3 ? 12 : 0);
        this.note(m, t, this.beat * 1.5, 0.55);
      }
      // swing léger
      this.next += this.beat * (pos % 2 === 0 ? 0.56 : 0.44);
      this.step++;
    }
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    const o = this.out;
    o.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
    setTimeout(() => o.disconnect(), 3000);
  }
}

export const music = new Music();
export { lerp };
