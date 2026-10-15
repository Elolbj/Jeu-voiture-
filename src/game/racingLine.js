// Trajectoire idéale (courbure minimale) et profil de vitesse associé.
import { clamp } from '../core/utils.js';
import { TIRES } from '../data/cars.js';
import { G } from '../physics/vehicle.js';

export class RacingLine {
  constructor(track, margin = 1.5) {
    this.track = track;
    const n = track.count;
    this.n = n;
    this.offset = new Float32Array(n);
    this.x = new Float32Array(n);
    this.z = new Float32Array(n);
    this.kappa = new Float32Array(n);
    this.margin = margin;
    this.compute();
  }

  lim(i) {
    return this.track.halfWidth - this.margin;
  }

  pos(i) {
    const t = this.track;
    const hl = Math.hypot(t.rx[i], t.rz[i]) || 1;
    return [t.px[i] + (t.rx[i] / hl) * this.offset[i], t.pz[i] + (t.rz[i] / hl) * this.offset[i]];
  }

  compute() {
    const t = this.track;
    const n = this.n;
    const o = this.offset;
    const idx = (i) => t.idx(i);
    const passes = [
      [18, 120],
      [9, 150],
      [4, 150],
    ];
    for (const [k, iters] of passes) {
      for (let it = 0; it < iters; it++) {
        for (let i = 0; i < n; i++) {
          if (!t.closed && (i < k || i >= n - k)) continue;
          const a = idx(i - k), b = idx(i + k);
          const pa = this.pos(a), pb = this.pos(b);
          const mx = (pa[0] + pb[0]) * 0.5, mz = (pa[1] + pb[1]) * 0.5;
          const hl = Math.hypot(t.rx[i], t.rz[i]) || 1;
          const target = ((mx - t.px[i]) * t.rx[i] + (mz - t.pz[i]) * t.rz[i]) / hl;
          const l = this.lim(i);
          o[i] += (clamp(target, -l, l) - o[i]) * 0.55;
        }
      }
    }
    // Léger lissage final
    const tmp = new Float32Array(n);
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < n; i++) tmp[i] = (o[idx(i - 1)] + 2 * o[i] + o[idx(i + 1)]) / 4;
      o.set(tmp);
    }
    for (let i = 0; i < n; i++) {
      const p = this.pos(i);
      this.x[i] = p[0];
      this.z[i] = p[1];
    }
    // Courbure signée (cercle passant par 3 points)
    const k = 3;
    for (let i = 0; i < n; i++) {
      const a = idx(i - k), b = idx(i + k);
      if (!t.closed && (i < k || i >= n - k)) { this.kappa[i] = t.kappa[i]; continue; }
      const ax = this.x[a], az = this.z[a], bx = this.x[i], bz = this.z[i], cx = this.x[b], cz = this.z[b];
      const cross = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
      const d1 = Math.hypot(bx - ax, bz - az), d2 = Math.hypot(cx - bx, cz - bz), d3 = Math.hypot(cx - ax, cz - az);
      this.kappa[i] = (2 * cross) / (d1 * d2 * d3 || 1);
    }
  }

  offsetAt(s) {
    const t = this.track;
    const L = t.length;
    if (t.closed) s = ((s % L) + L) % L;
    const f = clamp(s / t.spacing, 0, t.count - 1);
    const i = Math.floor(f);
    const j = t.idx(i + 1);
    const u = f - i;
    return this.offset[i] * (1 - u) + this.offset[j] * u;
  }

  // Profil de vitesse pour une voiture donnée (spec) et un niveau d'adhérence exploité.
  speedProfile(spec, gripFactor = 0.95) {
    const t = this.track;
    const n = this.n;
    const tire = TIRES[spec.tires];
    const mass = spec.mass + 75;
    const mu = tire.mu * 0.93 * gripFactor;
    const aeroK = (0.5 * 1.225 * (spec.aero.clF + spec.aero.clR)) / mass;
    const dragK = (0.5 * 1.225 * spec.aero.cd * spec.aero.area) / mass;
    const power = spec.engine.hp * 735.5 * 0.86;
    const driveFrac = spec.drive === '4WD' ? 1 : spec.drive === 'FF' ? spec.weightFront * 0.92 : (1 - spec.weightFront) * 1.08;
    const vTop = this.topSpeed(spec);
    const v = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const k = Math.abs(this.kappa[i]);
      // Prise en compte de la pente (bosses / compressions) de façon simple
      const denom = k - mu * aeroK;
      let vm = denom > 1e-5 ? Math.sqrt((mu * G) / denom) : vTop;
      v[i] = Math.min(vm, vTop);
    }
    const ds = t.spacing;
    const loops = t.closed ? 2 : 1;
    // Freinage (passe arrière)
    for (let l = 0; l < loops; l++) {
      for (let i = n - 2 + (t.closed ? 1 : 0); i >= 0; i--) {
        const j = t.idx(i + 1);
        const vj = v[j];
        const lat = vj * vj * Math.abs(this.kappa[j]);
        const gripTot = mu * (G + aeroK * vj * vj);
        const longAvail = Math.sqrt(Math.max(0, gripTot * gripTot - lat * lat)) * 0.95 + dragK * vj * vj;
        const grade = t.grade[i] * G;
        const vi = Math.sqrt(vj * vj + 2 * Math.max(1, longAvail + grade) * ds);
        if (vi < v[i]) v[i] = vi;
      }
    }
    // Accélération (passe avant)
    for (let l = 0; l < loops; l++) {
      for (let i = t.closed ? 0 : 1; i < n; i++) {
        const p = t.idx(i - 1);
        const vp = Math.max(v[p], 1);
        const lat = vp * vp * Math.abs(this.kappa[p]);
        const gripTot = mu * (G + aeroK * vp * vp) * driveFrac;
        const traction = Math.sqrt(Math.max(0, gripTot * gripTot - lat * lat));
        const acc = Math.min(power / (mass * vp), traction) - dragK * vp * vp - 0.15 - t.grade[p] * G;
        const vi = Math.sqrt(Math.max(0, vp * vp + 2 * acc * ds));
        if (vi < v[i]) v[i] = vi;
      }
    }
    return v;
  }

  topSpeed(spec) {
    // Vitesse max : équilibre puissance / (traînée + roulement), bornée par la démultiplication
    const mass = spec.mass + 75;
    const power = spec.engine.hp * 735.5 * 0.86;
    const cdA = 0.5 * 1.225 * spec.aero.cd * spec.aero.area;
    const res = (v) => cdA * v * v * v + 0.013 * mass * G * v - power;
    let lo = 5, hi = 150;
    for (let k = 0; k < 50; k++) {
      const mid = (lo + hi) / 2;
      if (res(mid) > 0) hi = mid; else lo = mid;
    }
    const gb = spec.gearbox;
    const gearMax = ((spec.engine.limiter * Math.PI) / 30 / (gb.ratios[gb.ratios.length - 1] * gb.final)) * spec.wheel.radius;
    return Math.min(lo, gearMax * 0.98);
  }
}

export function profileAt(profile, track, s) {
  const L = track.length;
  if (track.closed) s = ((s % L) + L) % L;
  const f = clamp(s / track.spacing, 0, track.count - 1);
  const i = Math.floor(f);
  const j = track.idx(i + 1);
  const u = f - i;
  return profile[i] * (1 - u) + profile[j] * u;
}
