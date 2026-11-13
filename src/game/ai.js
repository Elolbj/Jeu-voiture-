// Pilote IA : suit la trajectoire idéale (poursuite pure) et régule sa vitesse sur le profil
// calculé. Conduite en peloton : dépassement (de préférence par l'intérieur au freinage), défense
// en un seul changement de ligne, espace laissé à la voiture d'à côté, aspiration, anticipation du
// freinage de la voiture qui précède. Erreurs occasionnelles selon le niveau, rythme variable par tour.
import { Vector3 } from 'three';
import { clamp, lerp, rng } from '../core/utils.js';
import { TIRES } from '../data/cars.js';
import { G } from '../physics/vehicle.js';
import { profileAt } from './racingLine.js';

const _proj = { i: 0, j: 0, t: 0, index: 0, s: 0, lateral: 0, cy: 0, slopeR: 0 };
const _tp = new Vector3();

const SIDE_GAP = 2.6; // écart latéral minimal (centre à centre) entre deux voitures côte à côte (m)
const LANE_GAP = 2.2; // en deçà, la voiture qui précède est « dans ma ligne »
const EDGE = 1.05; // marge entre le centre de la voiture et le bord de la piste
const CORNER_K = 1 / 320; // courbure à partir de laquelle on considère être dans un virage

export class AIDriver {
  constructor(vehicle, track, line, opts = {}) {
    this.v = vehicle;
    this.track = track;
    this.line = line;
    this.skill = clamp(opts.skill ?? 0.9, 0.2, 1.05);
    this.aggression = clamp(opts.aggression ?? 0.5, 0, 1);
    this.name = opts.name || 'IA';
    this.grip = opts.grip ?? 1; // adhérence de la piste (pluie < 1)
    this.wet = this.grip < 0.97;
    this.rand = rng(opts.seed ?? Math.floor(Math.random() * 1e9));
    const spec = vehicle.spec;
    // Adhérence exploitée : de 86 % à 99 % du potentiel, marge supplémentaire sous la pluie
    const use = lerp(0.86, 0.99, clamp(this.skill, 0, 1)) * (this.wet ? 0.95 : 1);
    this.profile = line.speedProfile(spec, use, this.grip);
    this.vTop = line.topSpeed(spec);
    // Décélération jugée sûre pour suivre une voiture (m/s²)
    const brakeCap = G * (1.55 + (spec.aero.clF + spec.aero.clR) * 0.35) * (spec.brakeMul || 1) * 0.9;
    this.decel = Math.min(brakeCap, TIRES[spec.tires].mu * 0.93 * G) * this.grip * 0.9;
    this.anticipK = this.wet ? 0.4 : 0.32;
    // Variabilité du rythme d'un tour à l'autre (plus faible chez les meilleurs)
    this.paceVar = 0.003 + (1 - clamp(this.skill, 0, 1)) * 0.012;
    this.pace = 1;
    this.lapSeen = -1;
    this.hint = -1;
    this.s = 0;
    this.lateral = 0;
    this.off = 0; // décalage latéral courant par rapport à la trajectoire idéale (m)
    this.lineBias = (opts.lineBias ?? 0) * 0.6;
    this.stuckTime = 0;
    this.offTime = 0;
    this.wrongTime = 0;
    this.throttleLimit = 1;
    this.enabled = true;
    this.speedScale = 1; // ajustable (léger rattrapage selon la difficulté)
    this.needsReset = false;
    // Perception / décisions
    this.lane = null; this.laneDs = 0;
    this.side = null; this.sideDs = 0;
    this.attacker = null; this.attackDs = 0;
    this.leftLim = -1e9; this.rightLim = 1e9;
    this.nearTraffic = false;
    this.passCar = null; this.passSide = 0; this.passT = 0;
    this.passWas = null; this.passLast = null; this.passWhy = null; this.passCool = 0;
    this.defendSide = 0; this.defendLat = 0; this.defendCorner = -1; this.decidedCorner = -1;
    this.cornerDist = Infinity; this.cornerSign = 1; this.cornerId = -1; this.farCorner = Infinity;
    this.braking = false; this.brakeDist = Infinity; this.brakeIn = Infinity; this.brakeV = 0;
    this.followSpeed = null;
    this.heldUp = 0; this.heldT = 0;
    this.alongside = false;
    // Erreurs
    this.mistake = null; this.mistakeOn = false; this.mistakeT = 0; this.mistakeSev = 0; this.mistakeAmt = 0; this.mistakeCorner = -1; this.mistakeSign = 1;
    this.mistakeTimer = 10 + this.nextMistakeDelay() * 0.5;
  }

  nextMistakeDelay() {
    return lerp(35, 170, clamp(this.skill, 0, 1)) * (0.5 + this.rand()) * (this.wet ? 0.6 : 1);
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
    // Nouveau tour : rythme légèrement différent
    const lap = this.car ? this.car.lap : 0;
    if (lap !== this.lapSeen) {
      this.lapSeen = lap;
      this.pace = 1 + (this.rand() * 2 - 1) * this.paceVar;
    }

    this.scanCorner(p.s, speed);
    this.perceive(cars, speed);
    this.updateMistake(dt, raceTime);
    const hw = t.halfWidth - EDGE;

    // --- Décisions : défense, dépassement ---
    this.decide(dt, speed, raceTime, hw);

    // --- Point visé ---
    const look = clamp(5 + speed * 0.42, 7, 38);
    const sT = p.s + look;
    const lineT = this.line.offsetAt(sT);
    let desired;
    if (this.passCar) desired = this.latOf(this.passCar, sT, hw) + this.passSide * SIDE_GAP * 1.12;
    else if (this.defendSide) desired = this.defendLat;
    else desired = lineT + this.lineBias;
    let edge = this.passCar ? hw + 0.45 : hw;
    if (this.mistake === 'wide' && this.mistakeOn) {
      desired -= this.mistakeSign * this.mistakeAmt;
      edge = hw + 1.9; // petite sortie : roues dans l'herbe
    }
    const rate = (1.5 + this.aggression * 1.3) * (this.defendSide ? 0.8 : 1);
    this.off += clamp(desired - lineT - this.off, -rate * dt, rate * dt);
    let latT = lineT + this.off;
    // Espace laissé aux voitures côte à côte
    const lo = Math.max(this.leftLim, -edge), hi = Math.min(this.rightLim, edge);
    this.squeezed = lo > hi;
    if (this.squeezed) latT = (Math.max(this.leftLim, -edge - 0.8) + Math.min(this.rightLim, edge + 0.8)) * 0.5;
    else latT = clamp(latT, lo, hi);
    // Retour en piste : on longe le bord tant qu'une voiture arrive, sans traverser devant elle
    const outSide = p.lateral > t.halfWidth + 0.3 ? 1 : p.lateral < -t.halfWidth - 0.3 ? -1 : 0;
    this.rejoining = outSide !== 0 && this.trafficBack;
    if (this.rejoining) latT = outSide * (t.halfWidth - 0.2);
    this.off = latT - lineT;
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
    if (speed > 8 && yawErr * Math.sign(expectedYaw || yaw) > 0.05) delta += yawErr * 0.05;
    const beta = Math.atan2(v.velocity.dot(v.right), Math.max(1, Math.abs(v.velocity.dot(v.forward))));
    if (speed > 8 && Math.abs(beta) > 0.07) delta += (beta - Math.sign(beta) * 0.07) * 0.9;
    ctl.steer = clamp(delta / v.steerLock, -1, 1);

    // --- Vitesse ---
    const vt = this.targetSpeed(p.s, speed, latT, lineT);
    const headingErr = Math.abs(Math.atan2(right, fwd));
    let target = vt;
    // Ralentit si la voiture n'est pas alignée (après un tête-à-queue)
    if (headingErr > 0.6) target = Math.min(target, 10);
    // Écart à la trajectoire visée : on lève le pied pour la retrouver
    const dev = Math.abs(p.lateral - (this.line.offsetAt(p.s) + this.off));
    if (dev > 1.8) target *= Math.max(0.85, 1 - (dev - 1.8) * 0.025);
    // Hors piste : prudence
    const off = Math.abs(p.lateral) > t.halfWidth + 0.5;
    if (off) target = Math.min(target, this.rejoining ? 18 : 25);

    const err = target - speed;
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
    if (raceTime > 3 && !(this.car?.finished && !t.closed)) {
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
        this.resetReason = this.stuckTime > 3.5 ? 'bloquée' : this.offTime > 9 ? 'hors piste' : this.wrongTime > 2.5 ? 'à contresens' : 'retournée';
        this.stuckTime = 0; this.offTime = 0; this.wrongTime = 0;
      }
    }
  }

  // Prochaine zone de freinage (premier minimum du profil précédé d'une baisse marquée) et
  // prochain virage (courbure de l'axe), avec son côté intérieur.
  scanCorner(s, speed) {
    const t = this.track;
    const prof = this.profile;
    const L = t.length;
    const range = Math.min(330, 50 + speed * 4.5);
    let runMax = profileAt(prof, t, s), minV = Infinity, minD = -1;
    let cD = -1, cS = 0;
    const k0 = t.kappa[t.indexAt(s)];
    if (Math.abs(k0) > CORNER_K) { cD = 0; cS = k0; }
    for (let d = 4; d <= range; d += 4) {
      if (cD < 0) {
        const kk = t.kappa[t.indexAt(s + d)];
        if (Math.abs(kk) > CORNER_K) { cD = d; cS = kk; }
      }
      const vv = profileAt(prof, t, s + d);
      if (minD < 0) {
        if (vv > runMax) runMax = vv;
        else if (runMax - vv > 4) { minV = vv; minD = d; }
      } else if (vv < minV) { minV = vv; minD = d; }
      else if (vv > minV + 6 && cD >= 0) break;
    }
    // Freinage imminent : la distance de freinage nécessaire approche la distance au virage
    if (minD >= 0) {
      const need = (speed * speed - minV * minV) / (2 * this.decel);
      this.brakeIn = minV < speed - 2 ? minD - need : Infinity; // distance avant le point de freinage
      this.braking = this.brakeIn < 25 + speed * 0.5;
      this.brakeDist = minD;
      this.brakeV = minV;
    } else {
      this.braking = false;
      this.brakeIn = Infinity;
      this.brakeDist = Infinity;
      this.brakeV = this.vTop;
    }
    if (cD < 0) {
      // virage hors de portée : on cherche plus loin son côté (choix du côté de dépassement)
      this.cornerDist = Infinity;
      this.cornerId = -1;
      this.farCorner = Infinity;
      for (let d = range; d < 800; d += 8) {
        const kk = t.kappa[t.indexAt(s + d)];
        if (Math.abs(kk) > CORNER_K) { this.cornerSign = kk >= 0 ? 1 : -1; this.farCorner = d; break; }
      }
      return;
    }
    this.farCorner = cD;
    // Repère du virage : l'indice exact de son entrée (stable d'une image à l'autre)
    let ei = t.indexAt(s + cD);
    const sg = Math.sign(t.kappa[ei]);
    for (let k = 0; k < 300; k++) {
      const pi = t.idx(ei - 1);
      if (pi === ei || Math.abs(t.kappa[pi]) <= CORNER_K || Math.sign(t.kappa[pi]) !== sg) break;
      ei = pi;
    }
    this.cornerDist = cD;
    this.cornerSign = cS >= 0 ? 1 : -1;
    this.cornerId = ei;
  }

  perceive(cars, speed) {
    const t = this.track;
    const L = t.length;
    const me = this.car;
    const myHalf = this.v.halfLength;
    const hw = t.halfWidth - EDGE;
    this.leftLim = -1e9; this.rightLim = 1e9;
    this.lane = null; this.laneDs = 1e9;
    this.attacker = null; this.attackDs = 1e9;
    this.side = null; this.sideDs = 0;
    this.nearTraffic = false;
    this.trafficBack = false;
    this.closeTraffic = false;
    let sideLat = 1e9;
    for (let k = 0; k < cars.length; k++) {
      const c = cars[k];
      if (c === me) continue;
      let ds = c.s - this.s;
      if (t.closed) { if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L; }
      if (ds > 90 || ds < -35) continue;
      const dLat = c.lateral - this.lateral;
      const adl = Math.abs(dLat);
      const len = myHalf + c.vehicle.halfLength;
      if (Math.abs(ds) < 30 && adl < 9) this.nearTraffic = true;
      if (ds > -35 && ds < 10) this.trafficBack = true;
      if (ds > -15 && ds < 20 && adl < 6) this.closeTraffic = true;
      // Côte à côte : on laisse l'espace d'une voiture
      if ((Math.abs(ds) < len + 0.8 && adl > 1.0) || Math.abs(ds) < len * 0.7) {
        if (adl < SIDE_GAP + 2) {
          // on lui laisse aussi la place de rester sur la piste
          if (dLat >= 0) this.rightLim = Math.min(this.rightLim, c.lateral - SIDE_GAP, hw - SIDE_GAP);
          else this.leftLim = Math.max(this.leftLim, c.lateral + SIDE_GAP, -hw + SIDE_GAP);
          if (adl < sideLat) { sideLat = adl; this.side = c; this.sideDs = ds; }
        }
        continue;
      }
      if (ds > 0) {
        // Où serai-je à son abscisse ? (mélange position actuelle / trajectoire prévue)
        const plan = this.line.offsetAt(c.s) + this.off;
        const u = clamp(ds / 18, 0, 1);
        const myLat = this.lateral + (plan - this.lateral) * u;
        if (Math.abs(c.lateral - myLat) < LANE_GAP && ds < this.laneDs) { this.lane = c; this.laneDs = ds; }
      } else if (-ds < this.attackDs && adl < 6) {
        this.attacker = c;
        this.attackDs = -ds;
      }
    }
    this.alongside = !!this.side;
    void speed;
  }

  // Défense de la position et dépassements.
  decide(dt, speed, raceTime, hw) {
    const t = this.track;
    const L = t.length;
    const me = this.car;
    const start = raceTime < 6;
    // ---- Défense : un seul changement de ligne vers l'intérieur du prochain virage ----
    if (this.defendSide) {
      if (this.cornerId !== this.defendCorner || this.cornerDist < 12 || (!this.attacker && !this.side)) this.defendSide = 0;
    } else if (!start && this.attacker && !this.side && this.cornerId >= 0 && this.cornerId !== this.decidedCorner
      && this.cornerDist > 45 && this.cornerDist < 240 && this.attackDs < 16) {
      const a = this.attacker;
      const closing = a.vehicle.speed - speed;
      const lapping = me && t.closed && Math.abs(a.distance - me.distance) > L * 0.5;
      if (!lapping && (closing > 0.3 || this.attackDs < 9)) {
        this.decidedCorner = this.cornerId; // une seule décision par virage
        // l'attaquant n'est pas déjà décalé vers l'intérieur (sinon on lui couperait la route)
        const attIn = (a.lateral - this.lateral) * this.cornerSign > 1.2;
        if (!attIn && this.rand() < 0.2 + this.aggression * 0.6) {
          this.defendSide = this.cornerSign;
          this.defendLat = this.cornerSign * (hw - 0.7);
          this.defendCorner = this.cornerId;
        }
      }
    }

    // ---- Dépassement en cours ----
    if (this.passCool > 0) this.passCool -= dt;
    this.heldT = this.heldUp > 0.6 ? this.heldT + dt : Math.max(0, this.heldT - dt * 0.5);
    if (this.passCar) {
      const c = this.passCar;
      let ds = c.s - this.s;
      if (t.closed) { if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L; }
      const len = this.v.halfLength + c.vehicle.halfLength;
      this.passT += dt;
      const room = hw + 0.45 - this.passSide * c.lateral; // en dépassement, on s'autorise le bord de piste
      this.doorT = room < SIDE_GAP - 0.45 ? (this.doorT || 0) + dt : 0;
      const outside = this.passSide !== this.cornerSign;
      this.loseT = ds > len + 6 && speed < c.vehicle.speed - 0.3 ? (this.loseT || 0) + dt : 0;
      if (ds < -(len + 1.5) || ds > 55 || this.passT > 14 || this.loseT > 1.5) { this.passCar = null; this.passWhy = ds < 0 ? 'réussi' : 'abandon'; }
      else if (outside && ds > len * 0.6 && (this.braking || this.cornerDist < 50)) { this.passCar = null; this.passWhy = 'extérieur'; } // pas assez avancé : on renonce
      else if (!outside && this.braking && ds > len + 3 + speed * 0.12) { this.passCar = null; this.passWhy = 'trop loin'; } // trop loin pour plonger
      else if (this.doorT > 0.4 && ds > len * 0.5) { this.passCar = null; this.passWhy = 'fermé'; } // la porte s'est fermée
    }
    // ---- Nouveau dépassement ----
    if (this.passWhy && !this.passCar && this.passWas) {
      // après un abandon, on patiente un peu avant de retenter sur la même voiture
      if (this.passWhy !== 'réussi') this.passCool = 2;
      this.passWas = null;
    }
    if (!this.passCar && this.lane && !start && (this.passCool <= 0 || this.lane !== this.passLast)) {
      const c = this.lane;
      const ds = this.laneDs;
      const vo = Math.max(0, c.vehicle.speed);
      const closing = speed - vo;
      const myPot = profileAt(this.profile, t, c.s + 15) * this.pace;
      const hisPot = c.ai ? profileAt(c.ai.profile, t, c.s + 15) * c.ai.pace : vo + 0.5;
      const len = this.v.halfLength + c.vehicle.halfLength;
      const straight = !this.braking && this.cornerDist > 70;
      const lapping = me && t.closed && me.distance - c.distance > L * 0.5;
      const intoBraking = this.brakeIn < 45 + speed * 0.6 && this.brakeDist > 15;
      // sortie d'aspiration une fois dans ses roues, plongée au freinage, voiture nettement plus lente
      // retenu derrière elle (on irait plus vite sans elle)
      const held = this.heldT > 0.8 && this.heldUp > 0.4;
      const want = (straight && ds < len + 4 && ((held && (this.heldUp > 1.5 || closing > 0.2)) || closing > 0.4 || (me && me.draft > 0.55 && closing > -0.2 && this.brakeDist < 220)))
        || (intoBraking && ds < len + 3 + speed * 0.22 && closing > -0.5 && (held || closing > 0.8 || myPot > hisPot * 1.01))
        || (held && this.heldUp > 2 && ds < len + 6)
        || (closing > 2.5 && ds < 30)
        || ((lapping || c.finished) && ds < 30);
      if (ds < 30 && want) {
        // côté : l'intérieur du prochain virage s'il est proche, sinon le côté le plus large ;
        // jamais par l'extérieur à l'approche d'un virage. Place mesurée là où elle sera bientôt.
        const cs = this.cornerSign;
        // place minimale de chaque côté sur sa trajectoire probable des 60 prochains mètres
        let inMax = cs * c.lateral, inMin = inMax;
        for (let d = 20; d <= 60; d += 20) {
          const pl = cs * this.latOf(c, c.s + d, hw);
          if (pl > inMax) inMax = pl;
          if (pl < inMin) inMin = pl;
        }
        const roomIn = hw - inMax, roomOut = hw + inMin;
        // par l'extérieur seulement si l'on peut arriver à sa hauteur avant le freinage
        const gain = Math.max(0.3, closing + Math.min(this.heldUp, 3) * 0.3);
        const brakeIn = Math.min(this.brakeIn, this.farCorner - 40);
        const outsideOk = this.cornerDist > 110 && !this.braking && (ds + len * 0.6) / gain < (brakeIn / Math.max(speed, 5)) * 0.8;
        let side = 0;
        if (outsideOk && this.cornerDist > 220 && roomOut > roomIn + 1 && roomOut >= SIDE_GAP + 0.15 && this.sideFree(-cs, c, hw)) side = -cs;
        else if (roomIn >= SIDE_GAP + 0.15 && this.sideFree(cs, c, hw) && (this.cornerDist > 25 || roomIn > SIDE_GAP + 1)) side = cs;
        else if (outsideOk && roomOut >= SIDE_GAP + 0.15 && this.sideFree(-cs, c, hw)) side = -cs;
        if (side) {
          this.passCar = c; this.passSide = side; this.passT = 0;
          this.passWas = c; this.passLast = c; this.passWhy = null;
          if (this.defendSide) this.defendSide = 0;
        }
      }
    }
  }

  // Position latérale probable d'une voiture à l'abscisse sx (sa trajectoire + son décalage actuel)
  latOf(c, sx, hw) {
    const off = c.ai ? c.ai.off + c.ai.lineBias : c.lateral - this.line.offsetAt(c.s);
    return clamp(this.line.offsetAt(sx) + off, -hw - 0.5, hw + 0.5);
  }

  // Le côté visé n'est-il pas occupé par une voiture côte à côte ?
  sideFree(side, c, hw) {
    const want = c.lateral + side * SIDE_GAP;
    if (side > 0) return want <= this.rightLim + 0.3 && want <= hw + 0.2;
    return want >= this.leftLim - 0.3 && want >= -hw - 0.2;
  }

  targetSpeed(s, speed, latT, lineT) {
    const t = this.track;
    const prof = this.profile;
    // dans l'aspiration, moins de traînée pour aider au freinage : on anticipe un peu
    const anticip = speed * (this.anticipK + (this.car ? this.car.draft * 0.08 : 0));
    const late = this.mistake === 'late' ? this.mistakeAmt : 0;
    const s1 = s + anticip + late, s2 = s + anticip * 0.4 + late * 0.5;
    let vt = Math.min(profileAt(prof, t, s1), profileAt(prof, t, s2));
    // Phase d'accélération (le profil n'est limité que par la motricité) : pied au plancher,
    // ce qui permet de profiter de l'aspiration
    const lim = Math.min(profileAt(prof.limit, t, s1), profileAt(prof.limit, t, s2));
    const vProf = vt;
    if (lim > vt + 1 && this.cornerDist > 15) vt = lim;
    if (vt >= this.vTop * 0.985) vt = this.vTop * 1.3;
    else vt *= this.pace * this.speedScale;
    if (this.mistake === 'lift') vt *= 1 - this.mistakeSev * 0.25;
    // Tracé ouvert : arrêt dans la zone de dégagement après l'arrivée
    if (!t.closed) {
      // chaque arrivant s'arrête un peu avant le précédent
      const stopS = t.length + 40 - ((this.car?.finishOrder || 1) - 1) * 9;
      vt = Math.min(vt, Math.sqrt(2 * this.decel * Math.max(0, stopS - s)));
    }
    // Hors de la trajectoire idéale en virage : vitesse de passage réduite
    const devPlan = Math.abs(latT - lineT);
    const cornering = this.braking || this.cornerDist < 30;
    if (devPlan > 1 && cornering) {
      const inside = (latT - lineT) * this.cornerSign > 0;
      vt *= 1 - Math.min(0.08, (devPlan - 1) * (inside ? 0.006 : 0.012));
    }
    // Roue contre roue au freinage : la voiture en retard (ou à l'extérieur à hauteur égale) cède
    if (this.side && cornering) {
      const c = this.side;
      const len = this.v.halfLength + c.vehicle.halfLength;
      const otherInside = (c.lateral - this.lateral) * this.cornerSign > 0;
      if (this.sideDs > len * 0.4 || (Math.abs(this.sideDs) <= len * 0.4 && otherInside)) vt *= 0.95;
    }
    // Plus de place (bord de piste) : on se replace derrière, sauf si on est nettement devant
    if (this.side) {
      const lenS = this.v.halfLength + this.side.vehicle.halfLength;
      const pinned = this.squeezed || (this.side.lateral > this.lateral ? this.rightLim < -this.track.halfWidth + EDGE + 0.4 : this.leftLim > this.track.halfWidth - EDGE - 0.4);
      if (pinned && this.sideDs > -lenS * 0.5) vt *= 0.9;
    }
    // Voiture qui va nous prendre un tour : on lui facilite le passage
    const me = this.car;
    if (this.attacker && me && t.closed && this.attackDs < 25 && this.attacker.distance - me.distance > t.length * 0.5) vt *= 0.97;
    // Suivi de la voiture qui précède, en anticipant son freinage
    this.followSpeed = null;
    this.heldUp = 0;
    if (this.lane) {
      const c = this.lane;
      const vo = Math.max(0, c.vehicle.speed);
      // dans l'aspiration, en ligne droite, on colle davantage pour préparer le dépassement
      const tight = !this.braking && this.cornerDist > 70 && vo > 15;
      const gap = this.laneDs - this.v.halfLength - c.vehicle.halfLength - (tight ? 0.8 + speed * 0.035 : 0.7 + speed * 0.065);
      // Distance de sécurité à décélération égale ; on anticipe dès que ses feux stop s'allument
      const vEff = c.vehicle.controls.brake > 0.3 ? Math.max(0, vo - 2) : vo;
      const b = this.decel;
      const vs = gap > 0 ? Math.sqrt(vEff * vEff + 2 * b * gap) : Math.max(0, vEff + gap * 1.5);
      this.followSpeed = vs;
      // retenu : seulement là où notre propre profil nous limite (pas en pleine accélération)
      if (vs < vt) { this.heldUp = Math.max(0, Math.min(vt, vProf * this.pace) - vs); vt = vs; }
    }
    return vt;
  }

  // Erreurs occasionnelles (jamais au contact d'une autre voiture).
  updateMistake(dt, raceTime) {
    if (this.mistake) {
      this.mistakeT += dt;
      if (this.mistake === 'late') {
        if (this.cornerId !== this.mistakeCorner || this.mistakeT > 10) this.mistake = null;
      } else if (this.mistake === 'wide') {
        // s'active au passage du virage visé, puis dure ~2,5 s
        if (!this.mistakeOn) {
          if (this.cornerId !== this.mistakeCorner) { this.mistakeOn = true; this.mistakeT = 0; }
          else if (this.mistakeT > 18) this.mistake = null;
        } else if (this.mistakeT > 2.5) this.mistake = null;
      } else if (this.mistakeT > 2) this.mistake = null;
      return;
    }
    this.mistakeTimer -= dt;
    if (this.mistakeTimer > 0) return;
    if (this.closeTraffic || raceTime < 15 || this.cornerId < 0 || this.braking || this.cornerDist < 60) {
      this.mistakeTimer = 2;
      return;
    }
    this.mistakeTimer = this.nextMistakeDelay();
    const r = this.rand();
    const sev = clamp(1.08 - this.skill, 0.05, 0.6) * (0.6 + this.rand() * 0.8);
    this.mistakeSev = sev;
    this.mistakeCorner = this.cornerId;
    this.mistakeSign = this.cornerSign;
    this.mistakeT = 0;
    if (r < 0.45) {
      // freinage tardif : on vise le profil comme si le virage était plus loin
      this.mistake = 'late';
      this.mistakeAmt = 6 + 40 * sev;
    } else if (r < 0.75) {
      // élargit en sortie de virage
      this.mistake = 'wide';
      this.mistakeAmt = 1 + 4.5 * sev;
    } else this.mistake = 'lift';
    this.mistakeOn = this.mistake !== 'wide';
  }
}
