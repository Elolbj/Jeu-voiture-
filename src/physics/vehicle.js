// Simulation physique d'une voiture : corps rigide 6 DDL, 4 suspensions,
// modèle de pneus à glissement combiné, moteur / embrayage / boîte / différentiels,
// aérodynamique, ABS / antipatinage. Pas de temps fixe recommandé : 1/240 s.

import { Vector3, Quaternion, Matrix3, Matrix4 } from 'three';
import { TIRES, makeTorqueCurve, torqueAt } from '../data/cars.js';
import { clamp, lerp } from '../core/utils.js';

export const G = 9.81;
const RHO = 1.225;
const DRIVER_MASS = 75;

export const SURFACES = {
  asphalt: { id: 0, name: 'asphalt', mu: 1.0, rr: 0.013, drag: 0 },
  curb: { id: 1, name: 'curb', mu: 0.95, rr: 0.02, drag: 0 },
  grass: { id: 2, name: 'grass', mu: 0.6, rr: 0.06, drag: 0.4 },
  gravel: { id: 3, name: 'gravel', mu: 0.58, rr: 0.3, drag: 2.2 },
  sand: { id: 4, name: 'sand', mu: 0.5, rr: 0.4, drag: 3 },
};

// Courbe normalisée d'effort du pneu en fonction du glissement combiné normalisé.
function tireShape(rho, slide) {
  if (rho <= 1) return 1.5 * rho - 0.5 * rho * rho * rho;
  const d = rho - 1;
  return slide + (1 - slide) * Math.exp(-d * d * 0.9);
}
function tireShapeSlope(rho) {
  return rho < 1 ? 1.5 - 1.5 * rho * rho : 0.04;
}

const _v = new Vector3();
const _p = new Vector3();
const _r = new Vector3();
const _f = new Vector3();
const _t = new Vector3();
const _n = new Vector3();
const _fw = new Vector3();
const _sw = new Vector3();
const _vc = new Vector3();
const _q = new Quaternion();
const _m3 = new Matrix3();
const _m3b = new Matrix3();
const _tmpM4 = new Matrix4();
const _ground = { y: 0, normal: new Vector3(0, 1, 0), surface: SURFACES.asphalt, hint: -1, bump: 0 };

export class Vehicle {
  constructor(spec, opts = {}) {
    this.spec = spec;
    this.name = opts.name || '';
    this.isAI = !!opts.ai;
    this.assists = Object.assign({ abs: true, tcs: true, stability: true, autoGear: true }, opts.assists || {});

    const tire = TIRES[spec.tires];
    this.tire = tire;
    this.mass = spec.mass + DRIVER_MASS;
    const d = spec.dims;
    const wb = d.wheelbase;
    const tr = d.track;
    const wf = spec.weightFront;
    this.wheelbase = wb;
    this.trackWidth = tr;
    this.cgHeight = spec.cgHeight - (spec.lowered || 0);
    this.halfLength = d.length / 2;
    this.halfWidth = d.width / 2;
    this.height = d.height;

    // Tenseur d'inertie (approximation d'un pavé, réduite car masse concentrée)
    const L = d.length, W = d.width, H = d.height * 0.8;
    const m = this.mass;
    this.inertia = new Vector3(
      (m / 12) * (H * H + L * L) * 0.8, // tangage (axe X)
      (m / 12) * (W * W + L * L) * 0.85, // lacet (axe Y)
      (m / 12) * (W * W + H * H) * 0.75 // roulis (axe Z)
    );
    this.invInertia = new Vector3(1 / this.inertia.x, 1 / this.inertia.y, 1 / this.inertia.z);

    // Moteur
    this.torqueTable = makeTorqueCurve(spec.engine);
    this.torqueMul = spec.engine.powerMul || 1;
    this.engineInertia = spec.engine.inertia;
    this.idle = spec.engine.idle;
    this.redline = spec.engine.redline;
    this.limiter = spec.engine.limiter;
    let tmax = 0;
    for (const t of this.torqueTable) tmax = Math.max(tmax, t);
    this.maxTorque = tmax * this.torqueMul;
    this.turbo = spec.engine.turbo || 0;

    // Roues : 0 AVG, 1 AVD, 2 ARG, 3 ARD (avant = -Z, droite = +X)
    const a = wb * (1 - wf); // CdG -> essieu avant
    const b = wb * wf; // CdG -> essieu arrière
    const r = spec.wheel.radius;
    const drive = spec.drive;
    const frontDriven = drive === 'FF' || drive === '4WD';
    const rearDriven = drive !== 'FF';
    this.frontSplit = drive === '4WD' ? spec.frontSplit ?? 0.4 : drive === 'FF' ? 1 : 0;
    const suspK = (freq, cornerMass) => Math.pow(2 * Math.PI * freq, 2) * cornerMass;
    const isRace = spec.susp.freqF >= 2.6;
    this.wheels = [];
    for (let i = 0; i < 4; i++) {
      const front = i < 2;
      const left = i % 2 === 0;
      const cornerMass = (m * (front ? wf : 1 - wf)) / 2;
      const k = suspK(front ? spec.susp.freqF : spec.susp.freqR, cornerMass * 0.9);
      const c = 2 * spec.susp.zeta * Math.sqrt(k * cornerMass * 0.9);
      const staticComp = (cornerMass * G) / k;
      const Lstatic = isRace ? 0.09 : 0.13;
      const Lrest = Lstatic + staticComp;
      const wheel = {
        index: i,
        front,
        left,
        driven: front ? frontDriven : rearDriven,
        radius: r,
        width: spec.wheel.width,
        mount: new Vector3((left ? -1 : 1) * tr * 0.5, r - this.cgHeight + Lstatic, front ? -a : b),
        k,
        cBump: c * 0.85,
        cRebound: c * 1.25,
        arb: (front ? spec.susp.arbF : spec.susp.arbR) * k,
        Lrest,
        Lmin: Lstatic - (isRace ? 0.035 : 0.075),
        Lstatic,
        L: Lstatic,
        Lprev: Lstatic,
        compression: staticComp,
        contact: false,
        Fz: cornerMass * G,
        Fz0: cornerMass * G,
        omega: 0,
        spin: 0,
        steer: 0,
        inertia: 0.6 + r * r * 9, // jante + pneu
        driveTorque: 0,
        brakeTorque: 0,
        slipRatio: 0,
        slipAngle: 0,
        slipVel: 0,
        Fx: 0,
        Fy: 0,
        surface: SURFACES.asphalt,
        hint: -1,
        contactPoint: new Vector3(),
        groundNormal: new Vector3(0, 1, 0),
        groundBump: 0,
        worldPos: new Vector3(),
        lockTimer: 0,
      };
      this.wheels.push(wheel);
    }
    this.axleFront = -a;
    this.axleRear = b;

    // Freins (capacité suffisante pour bloquer les roues)
    const brakeTotal = m * G * 1.55 * r * (spec.brakeMul || 1);
    this.brakeBias = spec.brakeBias;
    this.brakeFront = (brakeTotal * this.brakeBias) / 2;
    this.brakeRear = (brakeTotal * (1 - this.brakeBias)) / 2;
    this.handbrakeTorque = this.brakeRear * 2.2;

    // Boîte
    this.gears = spec.gearbox.ratios.slice();
    this.final = spec.gearbox.final;
    this.reverseRatio = spec.gearbox.reverse;
    this.shiftTime = spec.gearbox.shiftTime;
    this.lsd = spec.lsd || 0;
    this.steerLock = (spec.steerLock * Math.PI) / 180;

    // Aéro
    const aero = spec.aero;
    this.dragK = 0.5 * RHO * aero.cd * aero.area;
    this.downF = 0.5 * RHO * aero.clF;
    this.downR = 0.5 * RHO * aero.clR;

    // État
    this.position = new Vector3();
    this.quaternion = new Quaternion();
    this.velocity = new Vector3();
    this.accel = new Vector3();
    this.angVel = new Vector3();
    this.forward = new Vector3(0, 0, -1);
    this.right = new Vector3(1, 0, 0);
    this.up = new Vector3(0, 1, 0);
    this.rot = new Matrix3();
    this.force = new Vector3();
    this.torque = new Vector3();

    this.controls = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
    this.steerAngle = 0;
    this.gear = 1;
    this.rpm = this.idle;
    this.engineOmega = (this.idle * Math.PI) / 30;
    this.shiftTimer = 0;
    this.pendingGear = null;
    this.clutchEngaged = true;
    this.limiterCut = false;
    this.tcsFactor = 1;
    this.tcsActive = false;
    this.absActive = false;
    this.boost = 0;
    this.engineLoad = 0;
    this.speed = 0; // m/s, signé (vers l'avant)
    this.lastShiftUp = 0;
    this.time = 0;
    this.airborne = false;
    this.collisionImpulse = 0;
    this.surfaceDrag = 0;
    this.frozen = false; // immobilisée (départ)
    this.ground = null;
    this.odometer = 0;
  }

  reset(pos, heading, speed = 0) {
    this.position.copy(pos);
    this.quaternion.setFromAxisAngle(new Vector3(0, 1, 0), heading);
    this.updateFrame();
    this.velocity.copy(this.forward).multiplyScalar(speed);
    this.angVel.set(0, 0, 0);
    // Pose à la hauteur d'équilibre
    this.position.y += this.cgHeight;
    for (const w of this.wheels) {
      w.omega = speed / w.radius;
      w.L = w.Lstatic;
      w.Lprev = w.Lstatic;
      w.hint = -1;
    }
    this.gear = 1;
    if (speed > 0) {
      // Choisit un rapport cohérent avec la vitesse
      for (let g = 1; g <= this.gears.length; g++) {
        this.gear = g;
        const rpm = this.wheelRpmFor(g, speed / this.wheels[0].radius);
        if (rpm < this.redline * 0.82) break;
      }
    }
    this.shiftTimer = 0;
    this.rpm = Math.max(this.idle, this.wheelRpmFor(this.gear, speed / this.wheels[0].radius));
    this.engineOmega = (this.rpm * Math.PI) / 30;
    this.tcsFactor = 1;
  }

  wheelRpmFor(gear, omega) {
    return Math.abs(omega * this.gearRatio(gear) * this.final * 30 / Math.PI);
  }

  gearRatio(g) {
    if (g > 0) return this.gears[g - 1];
    if (g < 0) return -this.reverseRatio;
    return 0;
  }

  updateFrame() {
    this.rot.setFromMatrix4(_tmpM4.makeRotationFromQuaternion(this.quaternion));
    const e = this.rot.elements; // colonne-majeure
    this.right.set(e[0], e[1], e[2]);
    this.up.set(e[3], e[4], e[5]);
    this.forward.set(-e[6], -e[7], -e[8]);
  }

  localToWorld(local, out) {
    return out.copy(local).applyQuaternion(this.quaternion).add(this.position);
  }

  shiftUp() {
    if (this.shiftTimer > 0) return;
    if (this.gear < this.gears.length) {
      this.pendingGear = this.gear === -1 ? 0 : this.gear + 1;
      if (this.gear === -1) this.pendingGear = 1;
      this.shiftTimer = this.gear <= 0 ? 0.1 : this.shiftTime;
      this.lastShiftUp = this.time;
    }
  }

  shiftDown() {
    if (this.shiftTimer > 0) return;
    if (this.gear > 1) {
      this.pendingGear = this.gear - 1;
      this.shiftTimer = this.shiftTime;
    } else if (this.gear === 1 && this.speed < 1.5) {
      this.pendingGear = -1;
      this.shiftTimer = 0.25;
    }
  }

  setGear(g) {
    this.gear = g;
    this.shiftTimer = 0;
    this.pendingGear = null;
  }

  fullTorque(rpm) {
    const tFull = torqueAt(this.torqueTable, rpm) * this.torqueMul;
    return this.turbo ? tFull * (0.72 + 0.28 * this.boost) : tFull;
  }

  engineBrakeTorque(rpm) {
    return this.maxTorque * (0.05 + 0.15 * clamp(rpm / this.redline, 0, 1.2));
  }

  engineTorque(rpm, throttle) {
    return throttle * this.fullTorque(rpm) - (1 - throttle) * this.engineBrakeTorque(rpm);
  }

  autoGearbox(dt) {
    if (this.shiftTimer > 0 || this.gear <= 0) return;
    const thr = this.controls.throttle;
    const n = this.gears.length;
    // Décisions basées sur la vitesse réelle (pas sur les roues qui patinent)
    const drivenOmega = Math.abs(this.speed) / this.wheels[0].radius;
    const rpm = this.wheelRpmFor(this.gear, drivenOmega);
    // Ne pas changer en plein patinage massif
    const upRpm = thr > 0.6 ? this.redline * 0.985 : lerp(this.redline * 0.55, this.redline * 0.9, thr / 0.6);
    if (this.gear < n && rpm > upRpm && this.time - this.lastShiftUp > 0.6) {
      const next = this.wheelRpmFor(this.gear + 1, drivenOmega);
      if (next > this.idle * 1.15) this.shiftUp();
      return;
    }
    if (this.gear > 1) {
      const lower = this.wheelRpmFor(this.gear - 1, drivenOmega);
      const brakingDown = this.controls.brake > 0.2 && lower < this.redline * 0.86;
      const lowDown = rpm < this.redline * (thr > 0.6 ? 0.55 : 0.4) && lower < this.redline * 0.9;
      if ((brakingDown || lowDown) && this.time - this.lastShiftUp > 0.5) this.shiftDown();
    }
  }

  avgDrivenOmega() {
    const w = this.wheels;
    if (this.frontSplit >= 1) return (w[0].omega + w[1].omega) * 0.5;
    if (this.frontSplit <= 0) return (w[2].omega + w[3].omega) * 0.5;
    return (w[0].omega + w[1].omega + w[2].omega + w[3].omega) * 0.25;
  }

  // ----------------------------------------------------------------------------
  // Pas de simulation
  // ----------------------------------------------------------------------------
  step(dt, ground) {
    this.time += dt;
    this.updateFrame();
    const ctl = this.controls;
    const m = this.mass;
    const F = this.force.set(0, -m * G, 0);
    const T = this.torque.set(0, 0, 0);
    const fwd = this.forward, up = this.up, right = this.right;
    const pos = this.position, vel = this.velocity, w = this.angVel;

    this.speed = vel.dot(fwd);
    const absSpeed = Math.abs(this.speed);

    // ---- Direction (angle de braquage avec vitesse limitée) ----
    const targetSteer = clamp(ctl.steer, -1, 1) * this.steerLock;
    const steerRate = 2.6 * this.steerLock * (this.isAI ? 1.4 : 1);
    this.steerAngle += clamp(targetSteer - this.steerAngle, -steerRate * dt, steerRate * dt);
    // Ackermann
    const st = this.steerAngle;
    let steerL = st, steerR = st;
    if (Math.abs(st) > 1e-4) {
      const R = this.wheelbase / Math.tan(Math.abs(st));
      const inner = Math.atan(this.wheelbase / (R - this.trackWidth / 2));
      const outer = Math.atan(this.wheelbase / (R + this.trackWidth / 2));
      // st > 0 = braquage à droite : la roue droite est intérieure
      if (st > 0) { steerR = inner; steerL = outer; } else { steerL = -inner; steerR = -outer; }
    }
    this.wheels[0].steer = steerL;
    this.wheels[1].steer = steerR;

    // ---- Suspensions ----
    let contacts = 0;
    for (const wh of this.wheels) {
      this.localToWorld(wh.mount, wh.worldPos);
      const mp = wh.worldPos;
      // Échantillonne le sol sous le point de contact estimé
      const gx = mp.x - up.x * (wh.L + wh.radius);
      const gz = mp.z - up.z * (wh.L + wh.radius);
      const gr = ground.sample(gx, gz, wh.hint, _ground);
      wh.hint = gr.hint;
      wh.surface = gr.surface;
      const n = gr.normal;
      // Distance du point d'ancrage au plan du sol le long de l'axe « bas » de la caisse
      const distN = n.x * (mp.x - gx) + n.y * (mp.y - gr.y) + n.z * (mp.z - gz);
      const cosA = Math.max(0.2, n.x * up.x + n.y * up.y + n.z * up.z);
      const L = (distN - wh.radius) / cosA;
      wh.Lprev = wh.L;
      if (L < wh.Lrest) {
        wh.contact = true;
        contacts++;
        wh.L = Math.max(L, wh.Lmin - 0.05);
        wh.compression = wh.Lrest - L;
        const compVel = (wh.Lprev - wh.L) / dt;
        let fs = wh.k * wh.compression;
        fs += compVel > 0 ? wh.cBump * compVel : wh.cRebound * compVel;
        if (L < wh.Lmin) {
          // Butée de suspension
          const pen = wh.Lmin - L;
          fs += wh.k * 12 * pen + wh.cBump * 3 * Math.max(0, compVel);
        }
        wh.Fz = clamp(fs, 0, wh.Fz0 * 12);
        wh.groundNormal.copy(n);
        wh.contactPoint.set(mp.x - up.x * (L + wh.radius), mp.y - up.y * (L + wh.radius), mp.z - up.z * (L + wh.radius));
        wh.groundBump = gr.bump || 0;
      } else {
        wh.contact = false;
        wh.L = Math.min(wh.Lrest, wh.L + dt * 2.5);
        wh.compression = 0;
        wh.Fz = 0;
      }
    }
    this.airborne = contacts === 0;

    // Barres antiroulis
    for (let axle = 0; axle < 2; axle++) {
      const l = this.wheels[axle * 2], r = this.wheels[axle * 2 + 1];
      const diff = (l.contact ? l.compression : 0) - (r.contact ? r.compression : 0);
      const fa = l.arb * diff;
      if (l.contact) l.Fz = Math.max(0, l.Fz + fa);
      if (r.contact) r.Fz = Math.max(0, r.Fz - fa);
    }

    // Adhérence maximale disponible par roue (sensibilité à la charge incluse)
    const tireM = this.tire;
    for (const wh of this.wheels) {
      if (!wh.contact) { wh.Fmax = 0; continue; }
      const Fz = Math.min(wh.Fz, wh.Fz0 * 3.5);
      const loadMu = clamp(1 - tireM.loadSens * (Fz / wh.Fz0 - 1), 0.7, 1.12);
      wh.mu = tireM.mu * wh.surface.mu * loadMu;
      wh.Fmax = wh.mu * Fz;
    }

    // ---- Moteur / transmission ----
    if (this.shiftTimer > 0) {
      this.shiftTimer -= dt;
      if (this.shiftTimer <= 0) {
        this.shiftTimer = 0;
        if (this.pendingGear !== null) this.gear = this.pendingGear;
        this.pendingGear = null;
      }
    }
    if (this.assists.autoGear && !this.frozen) this.autoGearbox(dt);

    let throttle = clamp(ctl.throttle, 0, 1);
    const totalRatio = this.gearRatio(this.gear) * this.final;

    // Antipatinage : limite le couple au maximum transmissible par les pneus moteurs,
    // plus une boucle de régulation douce sur le glissement mesuré.
    this.tcsActive = false;
    if (this.assists.tcs && this.gear !== 0 && this.shiftTimer <= 0 && !this.frozen) {
      let grip = 0, maxSlip = 0;
      for (const wh of this.wheels) {
        if (!wh.driven) continue;
        grip += wh.Fmax * wh.radius;
        maxSlip = Math.max(maxSlip, wh.slipRatio * Math.sign(this.gear));
      }
      const kp = this.tire.kappaPeak;
      if (maxSlip > kp * 1.1 && absSpeed > 0.3) this.tcsFactor = Math.max(0.2, this.tcsFactor - dt * 5);
      else this.tcsFactor = Math.min(1, this.tcsFactor + dt * 2);
      // Couple utile = adhérence (avec marge) + couple pour accélérer les masses tournantes
      const aLong = Math.max(0, this.accel.dot(fwd) * Math.sign(this.gear));
      const rr = this.wheels[0].radius;
      const reflected = this.clutchEngaged ? this.engineInertia * totalRatio * totalRatio : 0;
      const inertiaT = (reflected + 4 * this.wheels[0].inertia) * (aLong / rr);
      const tAllowed = (grip * 0.96 + inertiaT) / (Math.abs(totalRatio) * 0.9);
      const eb = this.engineBrakeTorque(this.rpm);
      const thrMax = clamp((tAllowed + eb) / (this.fullTorque(this.rpm) + eb), 0, 1);
      const before = throttle;
      throttle = Math.min(throttle * this.tcsFactor, thrMax);
      if (before - throttle > 0.03) this.tcsActive = true;
    }

    // Turbo : temps de réponse dépendant du régime
    if (this.turbo) {
      const target = this.rpm > this.idle * 1.3 ? clamp(ctl.throttle, 0, 1) : 0;
      const rate = target > this.boost ? 0.6 + 3.2 * clamp(this.rpm / this.redline, 0, 1) : 6;
      this.boost += (target - this.boost) * clamp(dt * rate, 0, 1);
    }

    const drivenOmega = this.avgDrivenOmega();
    const wheelRpm = drivenOmega * totalRatio * 30 / Math.PI; // signé
    const nDriven = this.frontSplit > 0 && this.frontSplit < 1 ? 4 : 2;
    let clutchTorque = 0; // couple en sortie d'embrayage
    let engaged = false;
    const efficiency = 0.9;

    // Coupure du rupteur avec hystérésis
    if (this.rpm > this.limiter) this.limiterCut = true;
    else if (this.rpm < this.limiter - 220) this.limiterCut = false;
    const effThrottle = this.limiterCut ? 0 : throttle;
    this.engineLoad = effThrottle;

    if (this.shiftTimer > 0 || this.gear === 0 || this.frozen) {
      // Embrayage débrayé : le moteur tourne librement
      const blip = this.frozen ? effThrottle : (this.pendingGear !== null && this.pendingGear < this.gear ? 0.35 : 0);
      const te = this.engineTorque(this.rpm, Math.max(effThrottle * (this.frozen ? 1 : 0), blip));
      this.engineOmega += (te / this.engineInertia) * dt * 0.5;
      this.engineOmega = clamp(this.engineOmega, (this.idle * Math.PI) / 30, (this.limiter + 200) * Math.PI / 30);
      this.rpm = this.engineOmega * 30 / Math.PI;
    } else {
      const absWheelRpm = Math.abs(wheelRpm);
      const biteRpm = Math.min(this.idle + 1800 + this.maxTorque * 2, this.redline * 0.6);
      const launchRpm = this.idle + effThrottle * (biteRpm - this.idle);
      if (absWheelRpm < launchRpm && (absWheelRpm < this.idle * 1.05 || effThrottle > 0.05) ) {
        // Embrayage patinant (démarrage)
        const target = Math.max(absWheelRpm, launchRpm);
        this.rpm += (target - this.rpm) * clamp(dt * 8, 0, 1);
        const te = this.engineTorque(this.rpm, effThrottle);
        clutchTorque = Math.max(0, te) * (absWheelRpm < this.idle * 0.5 && effThrottle < 0.05 ? 0 : 1);
      } else {
        engaged = true;
        this.rpm = Math.max(absWheelRpm, this.idle * 0.92);
        clutchTorque = this.engineTorque(this.rpm, effThrottle);
      }
      this.engineOmega = this.rpm * Math.PI / 30;
    }
    this.clutchEngaged = engaged;

    // Répartition du couple aux roues motrices
    const axleTorque = clutchTorque * totalRatio * efficiency;
    for (const wh of this.wheels) wh.driveTorque = 0;
    const lsdLimit = (absT) => (this.lsd / 100) * (60 + 0.5 * absT) + 12;
    const distribute = (wl, wr, Tax) => {
      const diffW = wl.omega - wr.omega;
      const lim = lsdLimit(Math.abs(Tax));
      const bias = clamp(diffW * (this.lsd > 0 ? 60 : 4), -lim, lim);
      wl.driveTorque += Tax * 0.5 - bias;
      wr.driveTorque += Tax * 0.5 + bias;
    };
    const ws = this.wheels;
    if (this.frontSplit >= 1) distribute(ws[0], ws[1], axleTorque);
    else if (this.frontSplit <= 0) distribute(ws[2], ws[3], axleTorque);
    else {
      // Différentiel central piloté
      const fo = (ws[0].omega + ws[1].omega) * 0.5, ro = (ws[2].omega + ws[3].omega) * 0.5;
      const lim = 40 + 0.35 * Math.abs(axleTorque);
      const bias = clamp((fo - ro) * 80, -lim, lim);
      distribute(ws[0], ws[1], axleTorque * this.frontSplit - bias);
      distribute(ws[2], ws[3], axleTorque * (1 - this.frontSplit) + bias);
    }
    const reflectedInertia = engaged ? (this.engineInertia * totalRatio * totalRatio) / nDriven : 0;

    // ---- Pneumatiques ----
    const tire = this.tire;
    const kp = tire.kappaPeak;
    const ap = Math.tan(tire.alphaPeak);
    let brakeIn = clamp(ctl.brake, 0, 1);
    this.absActive = false;
    let surfDrag = 0;
    for (const wh of this.wheels) {
      const r = wh.radius;
      let Tb = brakeIn * (wh.front ? this.brakeFront : this.brakeRear);
      if (!wh.front && ctl.handbrake > 0) Tb += ctl.handbrake * this.handbrakeTorque;
      if (this.frozen) Tb = Math.max(Tb, this.brakeFront * 2);

      if (!wh.contact) {
        // Roue en l'air : seules les forces internes agissent
        let om = wh.omega + (wh.driveTorque / (wh.inertia + reflectedInertia)) * dt;
        const dB = (Tb + 2) / (wh.inertia + reflectedInertia) * dt;
        om = om > 0 ? Math.max(0, om - dB) : Math.min(0, om + dB);
        wh.omega = om;
        wh.Fx = wh.Fy = 0;
        wh.slipVel = 0;
        wh.slipRatio = 0;
        wh.slipAngle = 0;
        wh.spin += wh.omega * dt;
        continue;
      }
      const n = wh.groundNormal;
      // Repère de la roue projeté sur le sol
      _fw.copy(fwd);
      if (wh.steer !== 0) _fw.applyAxisAngle(up, -wh.steer);
      _fw.addScaledVector(n, -_fw.dot(n)).normalize();
      _sw.crossVectors(_fw, n).normalize();
      // Vitesse du point de contact
      _r.subVectors(wh.contactPoint, pos);
      _vc.crossVectors(w, _r).add(vel);
      const vLong = _vc.dot(_fw);
      const vLat = _vc.dot(_sw);
      const denom = Math.max(Math.abs(vLong), 2.2);
      const surf = wh.surface;
      const Fz = Math.min(wh.Fz, wh.Fz0 * 3.5);
      const Fmax = wh.Fmax;

      // ABS idéalisé : le couple de freinage ne dépasse pas l'adhérence disponible
      if (this.assists.abs && Tb > 0 && absSpeed > 2) {
        const lim = Fmax * r * 0.98 + wh.inertia * 15;
        if (Tb > lim) { Tb = lim; this.absActive = true; }
        if (wh.slipRatio < -kp * 1.6) { Tb *= 0.5; this.absActive = true; }
      }
      Tb += surf.rr * Fz * r + 3; // résistance au roulement

      const slip = (wh.omega * r - vLong) / denom;
      const tanA = vLat / denom;
      const sx = slip / kp;
      const sy = tanA / ap;
      const rho = Math.sqrt(sx * sx + sy * sy);
      let fx = 0, fy = 0, dFdk = 0;
      if (rho > 1e-6) {
        const f = tireShape(rho, tire.slide) * Fmax;
        fx = (f * sx) / rho;
        fy = (-f * sy) / rho;
        dFdk = (Fmax * tireShapeSlope(rho)) / kp;
      } else {
        dFdk = (Fmax * 1.5) / kp;
      }
      wh.Fx = fx;
      wh.Fy = fy;
      wh.slipRatio = slip;
      wh.slipAngle = Math.atan(tanA);
      wh.slipVel = Math.sqrt((wh.omega * r - vLong) ** 2 + vLat * vLat);

      // Intégration implicite de la vitesse de rotation de la roue
      // On anticipe la variation de vitesse de la caisse pendant le pas (sinon la roue
      // libre « traîne » d'un pas et crée un faux glissement à basse vitesse).
      const I = wh.inertia + (wh.driven ? reflectedInertia : 0);
      const kOmega = (dFdk * r) / denom;
      const denomI = I + dt * r * kOmega;
      const dvPred = this.accel.dot(_fw) * dt;
      let om = wh.omega + (dt * (wh.driveTorque - r * fx + kOmega * dvPred)) / denomI;
      const dB = (dt * Tb) / denomI;
      if (om > 0) om = Math.max(0, om - dB);
      else om = Math.min(0, om + dB);
      wh.omega = om;
      wh.spin += om * dt;

      // Force appliquée à la caisse
      _f.copy(up).multiplyScalar(wh.Fz);
      _f.addScaledVector(_fw, fx).addScaledVector(_sw, fy);
      F.add(_f);
      // Application des efforts latéraux légèrement au-dessus du sol (centre de roulis)
      _p.copy(wh.contactPoint).addScaledVector(up, wh.front ? 0.08 : 0.12);
      _r.subVectors(_p, pos);
      _t.crossVectors(_r, _f);
      T.add(_t);
      surfDrag += surf.drag * Fz / (m * G);
    }
    this.surfaceDrag = surfDrag;

    // ---- Aérodynamique ----
    const v2 = vel.lengthSq();
    if (v2 > 0.01) {
      const vmag = Math.sqrt(v2);
      F.addScaledVector(vel, -this.dragK * vmag);
      // Traînée des surfaces meubles (herbe, graviers)
      if (surfDrag > 0) F.addScaledVector(vel, -surfDrag * m * 0.35 / Math.max(vmag, 3));
      const vf2 = this.speed * this.speed;
      const dfF = this.downF * vf2, dfR = this.downR * vf2;
      if (dfF + dfR > 0) {
        _f.copy(up).multiplyScalar(-dfF);
        F.add(_f);
        _p.copy(fwd).multiplyScalar(-this.axleFront); // point avant (axe -Z => forward)
        _t.crossVectors(_p, _f);
        T.add(_t);
        _f.copy(up).multiplyScalar(-dfR);
        F.add(_f);
        _p.copy(fwd).multiplyScalar(-this.axleRear);
        _t.crossVectors(_p, _f);
        T.add(_t);
      }
    }

    // ---- Aide à la stabilité : limite le survirage (lacet supérieur au lacet cinématique) ----
    this.stabilityActive = false;
    if (this.assists.stability && absSpeed > 5 && contacts >= 3) {
      const yawRate = w.dot(up);
      // lacet positif = rotation vers la gauche ; braquage positif = droite
      const expected = (-this.speed * Math.tan(this.steerAngle)) / this.wheelbase;
      const margin = 0.1 + Math.abs(expected) * 0.15;
      const sameDir = Math.sign(yawRate) === Math.sign(expected) || Math.abs(expected) < 0.02;
      const excess = Math.abs(yawRate) - (sameDir ? Math.abs(expected) : 0) - margin;
      if (excess > 0) {
        const corr = -Math.sign(yawRate) * Math.min(excess, 1.2) * this.inertia.y * 3.0;
        T.addScaledVector(up, corr);
        this.stabilityActive = true;
      }
    }

    // ---- Intégration ----
    this.accel.copy(F).multiplyScalar(1 / m);
    vel.addScaledVector(F, dt / m);
    // Couple -> accélération angulaire dans le repère local
    _t.copy(T);
    const e = this.rot.elements;
    // tl = R^T * T
    const tlx = e[0] * _t.x + e[1] * _t.y + e[2] * _t.z;
    const tly = e[3] * _t.x + e[4] * _t.y + e[5] * _t.z;
    const tlz = e[6] * _t.x + e[7] * _t.y + e[8] * _t.z;
    const ax = tlx * this.invInertia.x, ay = tly * this.invInertia.y, az = tlz * this.invInertia.z;
    // retour au repère monde : R * a
    w.x += (e[0] * ax + e[3] * ay + e[6] * az) * dt;
    w.y += (e[1] * ax + e[4] * ay + e[7] * az) * dt;
    w.z += (e[2] * ax + e[5] * ay + e[8] * az) * dt;
    w.multiplyScalar(1 - 0.15 * dt);
    if (this.frozen) {
      vel.x *= 0.9; vel.z *= 0.9;
      w.multiplyScalar(0.9);
    }
    pos.addScaledVector(vel, dt);
    // Intégration du quaternion
    const q = this.quaternion;
    _q.set(w.x * dt * 0.5, w.y * dt * 0.5, w.z * dt * 0.5, 0).multiply(q);
    q.x += _q.x; q.y += _q.y; q.z += _q.z; q.w += _q.w;
    q.normalize();
    this.odometer += Math.abs(this.speed) * dt;
  }

  // Applique une impulsion au point P (monde).
  applyImpulse(P, J) {
    this.velocity.addScaledVector(J, 1 / this.mass);
    _r.subVectors(P, this.position);
    _t.crossVectors(_r, J);
    this.angVel.add(this.worldInvInertiaMul(_t, _t));
  }

  worldInvInertiaMul(v, out) {
    const e = this.rot.elements;
    const lx = e[0] * v.x + e[1] * v.y + e[2] * v.z;
    const ly = e[3] * v.x + e[4] * v.y + e[5] * v.z;
    const lz = e[6] * v.x + e[7] * v.y + e[8] * v.z;
    const ax = lx * this.invInertia.x, ay = ly * this.invInertia.y, az = lz * this.invInertia.z;
    return out.set(e[0] * ax + e[3] * ay + e[6] * az, e[1] * ax + e[4] * ay + e[7] * az, e[2] * ax + e[5] * ay + e[8] * az);
  }

  // Masse effective au point P dans la direction n (pour la résolution des chocs).
  invMassAt(P, n) {
    _r.subVectors(P, this.position);
    _v.crossVectors(_r, n);
    this.worldInvInertiaMul(_v, _v);
    _n.crossVectors(_v, _r);
    return 1 / this.mass + n.dot(_n);
  }

  pointVelocity(P, out) {
    _r.subVectors(P, this.position);
    return out.crossVectors(this.angVel, _r).add(this.velocity);
  }

  get speedKmh() {
    return Math.abs(this.speed) * 3.6;
  }

  maxSlip() {
    let s = 0;
    for (const wh of this.wheels) if (wh.contact) s = Math.max(s, wh.slipVel);
    return s;
  }
}
