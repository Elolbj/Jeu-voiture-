// Pilote IA : suit la trajectoire idéale (poursuite pure), régule sa vitesse sur le
// profil calculé, gère dépassements, évitement et sortie de piste.
import { Vector3 } from 'three';
import { clamp, lerp } from '../core/utils.js';
import { profileAt } from './racingLine.js';

const _proj = { i: 0, j: 0, t: 0, index: 0, s: 0, lateral: 0, cy: 0, slopeR: 0 };
const _tp = new Vector3();

export class AIDriver {
  constructor(vehicle, track, line, opts = {}) {
    this.v = vehicle;
    this.track = track;
    this.line = line;
    this.skill = opts.skill ?? 0.9; // 0..1
    this.aggression = opts.aggression ?? 0.5;
    this.name = opts.name || 'IA';
    // Adhérence exploitée : de 86 % à 99 % du potentiel
    const grip = lerp(0.86, 0.99, this.skill);
    this.profile = line.speedProfile(vehicle.spec, grip);
    this.hint = -1;
    this.s = 0;
    this.lateral = 0;
    this.avoid = 0; // décalage latéral d'évitement courant
    this.avoidTarget = 0;
    this.stuckTime = 0;
    this.offTime = 0;
    this.wrongTime = 0;
    this.lineBias = (opts.lineBias ?? 0) * 0.6;
    this.mistakeTimer = 5 + Math.random() * 20;
    this.mistake = 0;
    this.throttleLimit = 1;
    this.enabled = true;
    this.speedScale = 1; // ajustable (difficulté dynamique)
    this.wobble = Math.random() * 100;
  }

  update(dt, cars, raceTime) {
    const v = this.v;
    const t = this.track;
    const p = t.project(v.position.x, v.position.z, this.hint, _proj);
    this.hint = p.index;
    this.s = p.s;
    this.lateral = p.lateral;
    const speed = Math.max(0, v.speed);
    const ctl = v.controls;
    if (!this.enabled) {
      ctl.throttle = 0; ctl.brake = 1; ctl.steer = 0;
      return;
    }

    // --- Trafic : dépassements et évitement ---
    this.computeAvoidance(cars, speed);
    // En approche de freinage, on regagne la trajectoire (sauf si une voiture est à côté)
    const brakingAhead = profileAt(this.profile, t, p.s + 30 + speed * 1.2) < speed * 0.88;
    if (brakingAhead && !this.alongside) this.avoidTarget *= 0.25;
    const avoidRate = 2.2 + this.aggression * 1.5;
    this.avoid += clamp(this.avoidTarget - this.avoid, -avoidRate * dt, avoidRate * dt);

    // --- Point visé ---
    const look = clamp(5 + speed * 0.42, 7, 38);
    const sT = p.s + look;
    const hw = t.halfWidth - 1.2;
    let latT = this.line.offsetAt(sT) + this.avoid + this.lineBias;
    latT = clamp(latT, -hw, hw);
    t.pointAt(sT, latT, _tp);
    // Repère local de la voiture
    const dx = _tp.x - v.position.x, dz = _tp.z - v.position.z;
    const fx = v.forward.x, fz = v.forward.z;
    const fl = Math.hypot(fx, fz) || 1;
    const fwd = (dx * fx + dz * fz) / fl;
    const right = (dx * v.right.x + dz * v.right.z) / (Math.hypot(v.right.x, v.right.z) || 1);
    const Ld = Math.max(1, Math.hypot(fwd, right));
    const alpha = Math.atan2(right, Math.max(0.1, fwd));
    let delta = Math.atan((2 * v.wheelbase * Math.sin(alpha)) / Ld);
    // Amortissement en lacet (stabilité) et contre-braquage si glisse
    const yaw = v.angVel.y;
    const expectedYaw = (-speed * Math.tan(v.steerAngle)) / v.wheelbase;
    const yawErr = yaw - expectedYaw;
    // Survirage : on réduit le braquage (contre-braquage progressif)
    if (speed > 8 && yawErr * Math.sign(expectedYaw || yaw) > 0.05) delta += yawErr * 0.05;
    const beta = Math.atan2(v.velocity.dot(v.right), Math.max(1, Math.abs(v.velocity.dot(v.forward))));
    if (speed > 8 && Math.abs(beta) > 0.07) delta += (beta - Math.sign(beta) * 0.07) * 0.9;
    ctl.steer = clamp(delta / v.steerLock, -1, 1);

    // --- Vitesse ---
    const anticip = speed * 0.32;
    let vt = Math.min(profileAt(this.profile, t, p.s + anticip), profileAt(this.profile, t, p.s + anticip * 0.4));
    vt *= this.speedScale;
    // Petite erreur de pilotage occasionnelle
    this.mistakeTimer -= dt;
    if (this.mistakeTimer < 0) {
      this.mistake = (1 - this.skill) * (0.04 + Math.random() * 0.06);
      this.mistakeTimer = 8 + Math.random() * 25 * (0.5 + this.skill);
      this.mistakeDuration = 1.5 + Math.random() * 2;
    }
    if (this.mistakeDuration > 0) {
      this.mistakeDuration -= dt;
      vt *= 1 - this.mistake;
    }
    // Suivi d'un véhicule devant si pas de place pour dépasser
    if (this.followSpeed !== null) vt = Math.min(vt, this.followSpeed);
    // Ralentit si la voiture n'est pas alignée (après un tête-à-queue)
    const headingErr = Math.abs(Math.atan2(right, fwd));
    if (headingErr > 0.6) vt = Math.min(vt, 10);
    // Écart à la trajectoire visée : on lève le pied pour la retrouver
    const dev = Math.abs(p.lateral - (this.line.offsetAt(p.s) + this.avoid));
    if (dev > 1.8) vt *= Math.max(0.85, 1 - (dev - 1.8) * 0.025);
    // Hors piste : prudence
    const off = Math.abs(p.lateral) > t.halfWidth + 0.5;
    if (off) vt = Math.min(vt, 25);

    const err = vt - speed;
    if (err > 0) {
      ctl.throttle = clamp(0.4 + err * 0.4, 0, 1) * this.throttleLimit;
      ctl.brake = 0;
    } else {
      ctl.throttle = err > -0.4 ? clamp(0.4 + err, 0, 1) : 0;
      ctl.brake = clamp((-err - 0.3) * 0.5, 0, 1);
    }
    // Patinage excessif : levée de pied progressive
    const lat = Math.abs(beta);
    if (lat > 0.12 && speed > 10) ctl.throttle *= clamp(1 - (lat - 0.12) * 4, 0.2, 1);
    ctl.handbrake = 0;

    // --- Récupération ---
    if (raceTime > 3) {
      if (speed < 2) this.stuckTime += dt; else this.stuckTime = Math.max(0, this.stuckTime - dt * 2);
      if (off) this.offTime += dt; else this.offTime = 0;
      const trackHeading = Math.atan2(t.dx[p.index], -t.dz[p.index]);
      const carHeading = Math.atan2(fx, -fz);
      let dh = carHeading - trackHeading;
      while (dh > Math.PI) dh -= 2 * Math.PI;
      while (dh < -Math.PI) dh += 2 * Math.PI;
      if (Math.abs(dh) > 2.2 && speed < 15) this.wrongTime += dt; else this.wrongTime = 0;
      if (this.stuckTime > 3.5 || this.offTime > 9 || this.wrongTime > 2.5 || v.up.y < 0.3) {
        this.needsReset = true;
        this.stuckTime = 0; this.offTime = 0; this.wrongTime = 0;
      }
    }
  }

  computeAvoidance(cars, speed) {
    const t = this.track;
    const L = t.length;
    let target = 0;
    this.followSpeed = null;
    this.alongside = false;
    let blocking = null, blockDist = Infinity;
    for (const c of cars) {
      if (c === this.car) continue;
      let ds = c.s - this.s;
      if (t.closed) { if (ds > L / 2) ds -= L; if (ds < -L / 2) ds += L; }
      const dLat = c.lateral - this.lateral;
      // Voiture à côté : garder l'écart
      if (Math.abs(ds) < 6 && Math.abs(dLat) < 3) {
        target += dLat > 0 ? -1.6 : 1.6;
        this.alongside = true;
      }
      // Voiture juste devant dans ma ligne : freinage anticipé pour ne pas l'emboutir
      if (ds > 0 && ds < 35 && Math.abs(dLat) < 2.3) {
        const otherSpeed = Math.max(0, c.vehicle.speed);
        const closing = speed - otherSpeed;
        const gap = Math.max(0.5, ds - 5.5);
        if (closing > 0 && (closing * closing) / (2 * gap) > 2.5) {
          const fs = otherSpeed + Math.sqrt(2 * 2.5 * gap) * 0.5;
          this.followSpeed = this.followSpeed === null ? fs : Math.min(this.followSpeed, fs);
        }
      }
      if (ds > 0 && ds < 45) {
        const otherSpeed = Math.max(0, c.vehicle.speed);
        const closing = speed - otherSpeed;
        const myLatAtThem = this.line.offsetAt(c.s) + this.avoid;
        if (Math.abs(c.lateral - myLatAtThem) < 2.6 && (closing > 0.5 || ds < 12)) {
          if (ds < blockDist) { blockDist = ds; blocking = { c, ds, closing, otherSpeed }; }
        }
      }
    }
    if (blocking) {
      const { c, ds, otherSpeed } = blocking;
      const hw = t.halfWidth - 1.3;
      const roomLeft = c.lateral + hw; // place à gauche de l'autre
      const roomRight = hw - c.lateral;
      const side = this.passSide ?? (roomRight > roomLeft ? 1 : -1);
      const room = side > 0 ? roomRight : roomLeft;
      if (room > 2.4) {
        this.passSide = side;
        const desired = c.lateral + side * 2.9;
        target += clamp(desired - this.line.offsetAt(this.s), -2 * hw, 2 * hw);
      } else {
        this.passSide = null;
      }
      // Pas de place ou trop près : on suit
      if (room <= 2.4 || ds < 9) {
        const fs = otherSpeed + (ds > 14 ? 3 : ds > 8 ? 0.5 : -1.5);
        this.followSpeed = this.followSpeed === null ? fs : Math.min(this.followSpeed, fs);
      }
    } else {
      this.passSide = null;
    }
    this.avoidTarget = target;
  }
}
