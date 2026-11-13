// Logique de course indépendante du rendu : véhicules, IA, collisions, aspiration, météo,
// chronométrage (écarts réels au leader), classement. Utilisée par le jeu et par les tests
// de simulation en ligne de commande.
import { Vector3 } from 'three';
import { Vehicle } from '../physics/vehicle.js';
import { collideWalls, collideCars } from '../physics/collisions.js';
import { AIDriver } from './ai.js';
import { RacingLine } from './racingLine.js';
import { clamp } from '../core/utils.js';

export const PHYS_DT = 1 / 240;
// Adhérence sous la pluie selon le type de pneus (les voitures de course chaussent des pneus pluie)
export const WET_GRIP = { confort: 0.84, sport: 0.81, semi: 0.77, course: 0.8 };
const DRAFT_RANGE = 25; // portée de l'aspiration (m)
const DRAFT_MAX = 0.36; // réduction maximale de la traînée (à moins d'une longueur)
const MARK = 10; // pas des repères de chronométrage (m)

function byRank(a, b) {
  if (a.finished && b.finished) return a.finishTime - b.finishTime;
  if (a.finished) return -1;
  if (b.finished) return 1;
  return b.distance - a.distance;
}
const _proj = { i: 0, j: 0, t: 0, index: 0, s: 0, lateral: 0, cy: 0, slopeR: 0 };

export class RaceSim {
  constructor(track, entries, opts = {}) {
    this.track = track;
    this.laps = opts.laps ?? 3;
    this.mode = opts.mode || 'race'; // race | timetrial | licence | free
    this.line = opts.line || new RacingLine(track);
    this.time = 0; // temps de course (après le départ)
    this.clock = 0; // temps total
    this.phase = 'grid';
    this.countdown = opts.countdown ?? 4;
    this.acc = 0;
    this.cars = [];
    this.events = [];
    this.rollingStart = !!opts.rollingStart;
    this.weather = opts.weather === 'pluie' ? 'pluie' : 'sec';
    // Temps de passage du premier en tête à chaque repère de distance (écarts en secondes)
    this.marks = [0];
    this.leadDist = 0;
    entries.forEach((e, idx) => {
      const veh = new Vehicle(e.spec, { ai: !!e.ai, assists: e.assists, name: e.name });
      veh.gripMul = this.gripFor(e.spec);
      const car = {
        id: idx,
        name: e.name,
        team: e.team || '',
        isPlayer: !!e.player,
        vehicle: veh,
        spec: e.spec,
        color: e.color,
        ai: null,
        gridPos: idx,
        distance: 0,
        lap: 0,
        lapStart: 0,
        lapTimes: [],
        bestLap: null,
        lastLap: null,
        finished: false,
        finishTime: null,
        hint: -1,
        s: 0,
        lateral: 0,
        position: idx + 1,
        resetTimer: 0,
        offTrack: false,
        wrongWay: false,
        impact: 0,
        currentLapValid: true,
        sectorTimes: [],
        draft: 0,
        resetWait: 0,
      };
      if (e.ai) {
        car.ai = new AIDriver(veh, track, this.line, { seed: idx * 7919 + 13, ...e.ai, name: e.name, grip: veh.gripMul });
        car.ai.car = car;
        veh.assists = { abs: true, tcs: true, stability: true, autoGear: true };
      }
      this.cars.push(car);
    });
    this.placeOnGrid(opts.gridOrder);
    // Voitures immobilisées jusqu'au départ
    for (const c of this.cars) c.vehicle.frozen = true;
  }

  // Adhérence de la piste pour une voiture (1 sur le sec)
  gripFor(spec) {
    return this.weather === 'pluie' ? WET_GRIP[spec.tires] ?? 0.8 : 1;
  }

  // Crée un pilote IA pour une voiture (pilote automatique, tour de décélération)
  makeAI(car, opts = {}) {
    const ai = new AIDriver(car.vehicle, this.track, this.line, { grip: car.vehicle.gripMul, ...opts });
    ai.car = car;
    ai.hint = car.hint;
    return ai;
  }

  get player() {
    return this.cars.find((c) => c.isPlayer);
  }

  gridSlot(k) {
    const t = this.track;
    const row = Math.floor(k / 2);
    const s = t.startS - 6 - row * 9 - (k % 2) * 4.5;
    const lat = (k % 2 === 0 ? -1 : 1) * t.halfWidth * 0.42;
    return { s, lat };
  }

  placeOnGrid(order) {
    const t = this.track;
    const list = order ? order.map((i) => this.cars[i]) : this.cars;
    list.forEach((car, k) => {
      const { s, lat } = this.gridSlot(k);
      this.placeCar(car, s, lat, this.rollingStart ? 30 : 0);
      car.gridPos = k;
      car.distance = s - t.startS; // négatif : derrière la ligne
      car.prevS = ((s % t.length) + t.length) % t.length;
      car.lapStart = 0;
    });
  }

  placeCar(car, s, lat, speed = 0) {
    const t = this.track;
    const p = t.pointAt(s, lat, new Vector3());
    const h = t.headingAt(s);
    // heading piste : direction (sin h, -cos h) ; la voiture regarde vers -Z localement
    car.vehicle.reset(p, -h, speed);
    car.hint = t.indexAt(s);
    car.vehicle.wallHint = car.hint;
    for (const w of car.vehicle.wheels) w.hint = car.hint;
    if (car.ai) { car.ai.hint = car.hint; car.ai.off = 0; }
  }

  start() {
    this.phase = 'countdown';
    this.countdownLeft = this.countdown;
    for (const c of this.cars) c.vehicle.frozen = true;
  }

  // Avance la simulation de `frameDt` secondes (pas fixes internes).
  update(frameDt) {
    this.acc += Math.min(frameDt, this.maxFrame || 0.1);
    let steps = 0;
    while (this.acc >= PHYS_DT) {
      this.acc -= PHYS_DT;
      this.fixedStep(PHYS_DT, steps);
      steps++;
    }
    return steps;
  }

  fixedStep(dt, stepIndex) {
    this.clock += dt;
    if (this.phase === 'countdown') {
      this.countdownLeft -= dt;
      if (this.countdownLeft <= 0) {
        this.phase = 'racing';
        this.time = 0;
        for (const c of this.cars) c.vehicle.frozen = false;
        this.events.push({ type: 'go' });
      }
    } else if (this.phase === 'racing' || this.phase === 'finishing') {
      this.time += dt;
    }
    const aiTick = stepIndex % 4 === 0;
    const allCars = this.cars;
    if (aiTick) this.updateDraft();
    for (const c of allCars) {
      if (c.ai && aiTick && this.phase !== 'grid') {
        c.ai.update(dt * 4, allCars, this.time);
      }
    }
    for (const c of allCars) c.vehicle.step(dt, this.track);
    // Collisions murs
    for (const c of allCars) {
      const imp = collideWalls(c.vehicle, this.track);
      if (imp > 0) {
        c.impact = Math.max(c.impact, imp);
        if (imp > 1500) this.events.push({ type: 'wall', car: c, impulse: imp });
      }
    }
    // Collisions entre voitures
    for (let i = 0; i < allCars.length; i++) {
      for (let j = i + 1; j < allCars.length; j++) {
        const imp = collideCars(allCars[i].vehicle, allCars[j].vehicle);
        if (imp > 0) {
          allCars[i].impact = Math.max(allCars[i].impact, imp);
          allCars[j].impact = Math.max(allCars[j].impact, imp);
          if (imp > 800) this.events.push({ type: 'car', a: allCars[i], b: allCars[j], impulse: imp });
        }
      }
    }
    // Progression / chronométrage
    for (const c of allCars) this.track_(c);
    // Réinitialisations demandées (différées tant que du trafic arrive)
    for (const c of allCars) {
      if (c.ai && c.ai.needsReset) {
        c.resetWait += dt;
        if (aiTick && (c.resetWait > 6 || !this.trafficNear(c, 70))) {
          c.ai.needsReset = false;
          c.resetWait = 0;
          this.resetCar(c);
        }
      }
    }
  }

  // Aspiration : traînée réduite derrière une voiture proche et alignée
  updateDraft() {
    const cars = this.cars;
    const t = this.track;
    const L = t.length;
    for (let i = 0; i < cars.length; i++) {
      const a = cars[i];
      let best = 0;
      for (let j = 0; j < cars.length; j++) {
        if (j === i) continue;
        const b = cars[j];
        let ds = b.s - a.s;
        if (t.closed) { if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L; }
        if (ds < 3 || ds > DRAFT_RANGE) continue;
        const dl = Math.abs(b.lateral - a.lateral);
        if (dl > 3) continue;
        const f = (1 - (ds - 3) / (DRAFT_RANGE - 3)) * Math.min(1, 1.25 - dl / 2.4);
        if (f > best) best = f;
      }
      a.draft = best;
      a.vehicle.dragMul = 1 - DRAFT_MAX * best;
    }
  }

  // Une voiture arrive-t-elle derrière (ou se trouve-t-elle près de) la voiture c ?
  trafficNear(c, back) {
    const t = this.track;
    const L = t.length;
    for (const o of this.cars) {
      if (o === c) continue;
      let ds = o.s - c.s;
      if (t.closed) { if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L; }
      if (ds > -back && ds < 12) return true;
    }
    return false;
  }

  resetCar(c) {
    const t = this.track;
    // Replace la voiture au centre de la piste un peu en arrière, à l'arrêt
    let s = c.s - 5;
    // Évite de réapparaître sur une autre voiture
    for (let k = 0; k < 6; k++) {
      const p = t.pointAt(s, 0);
      const busy = this.cars.some((o) => o !== c && o.vehicle.position.distanceTo(p) < 7);
      if (!busy) break;
      s -= 10;
    }
    const keepDist = c.distance;
    this.placeCar(c, s, t.closed ? this.line.offsetAt(s) * 0.5 : 0, 8);
    c.distance = keepDist;
    c.prevS = ((s % t.length) + t.length) % t.length;
    c.vehicle.frozen = this.phase === 'countdown' || this.phase === 'grid';
    this.events.push({ type: 'reset', car: c });
  }

  track_(c) {
    const t = this.track;
    const v = c.vehicle;
    const p = t.project(v.position.x, v.position.z, c.hint, _proj);
    c.hint = p.index;
    let ds = p.s - c.prevS;
    if (t.closed) {
      if (ds > t.length / 2) ds -= t.length;
      if (ds < -t.length / 2) ds += t.length;
    }
    if (Math.abs(ds) > 25) ds = 0; // saut (réinitialisation)
    c.prevS = p.s;
    c.s = p.s;
    c.lateral = p.lateral;
    c.offTrack = Math.abs(p.lateral) > t.halfWidth + 0.6;
    // Limites de piste : seul le joueur voit ses tours invalidés
    if (c.isPlayer && c.offTrack && Math.abs(p.lateral) > t.halfWidth + 1.4) c.currentLapValid = false;
    if (this.phase !== 'racing' && this.phase !== 'finishing') return;
    if (c.finished) { c.distance += ds; return; }
    c.distance += ds;
    if (c.distance > this.leadDist) this.leadDist = c.distance;
    if (c.distance > 0) {
      const k = Math.floor(c.distance / MARK);
      while (this.marks.length <= k) this.marks.push(this.time);
    }
    // Sens interdit
    const trackHeading = Math.atan2(t.dx[p.index], -t.dz[p.index]);
    const carHeading = Math.atan2(v.forward.x, -v.forward.z);
    let dh = carHeading - trackHeading;
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    c.wrongWay = Math.abs(dh) > 2.0 && v.speed > 3;

    const L = t.closed ? t.length : t.length - t.startS - 30;
    if (t.closed) {
      const lapNow = Math.floor(c.distance / L);
      if (lapNow > c.lap && c.distance > 0) {
        const lapTime = this.time - c.lapStart;
        c.lap = lapNow;
        c.lapStart = this.time;
        c.lastLap = lapTime;
        c.lapTimes.push({ time: lapTime, valid: c.currentLapValid });
        if (c.currentLapValid && (c.bestLap === null || lapTime < c.bestLap)) c.bestLap = lapTime;
        this.events.push({ type: 'lap', car: c, time: lapTime, lap: lapNow, valid: c.currentLapValid });
        c.currentLapValid = true;
        if (this.mode !== 'free' && c.lap >= this.laps) this.finishCar(c);
      }
    } else if (c.distance >= L && !c.finished) {
      c.lap = 1;
      c.lastLap = this.time;
      c.bestLap = this.time;
      c.lapTimes.push({ time: this.time, valid: true });
      this.finishCar(c);
    }
  }

  finishCar(c) {
    c.finished = true;
    c.finishTime = this.time;
    c.finishOrder = this.cars.filter((x) => x.finished).length;
    this.events.push({ type: 'finish', car: c, time: this.time });
    if (c.ai) c.ai.speedScale = 0.75;
    if (this.phase === 'racing') this.phase = 'finishing';
  }

  // Classement courant (tableau réutilisé d'un appel à l'autre : à copier pour le conserver)
  standings() {
    const list = this._order || (this._order = []);
    list.length = 0;
    for (const c of this.cars) list.push(c);
    list.sort(byRank);
    for (let i = 0; i < list.length; i++) list[i].position = i + 1;
    return list;
  }

  // Écart en secondes au premier en tête (temps écoulé depuis son passage au même endroit).
  gapToLeader(c) {
    if (c.finished) {
      const first = this.cars.reduce((m, x) => (x.finished && x.finishTime < m ? x.finishTime : m), Infinity);
      return c.finishTime - first;
    }
    const d = c.distance;
    if (d <= 0) return 0;
    const f = d / MARK;
    const k = Math.floor(f);
    const m = this.marks;
    if (k >= m.length) return 0;
    // entre deux repères (le dernier est la position actuelle du premier)
    let t1 = this.time, d1 = this.leadDist;
    if (k + 1 < m.length) { t1 = m[k + 1]; d1 = (k + 1) * MARK; }
    const u = d1 > k * MARK ? (d - k * MARK) / (d1 - k * MARK) : 1;
    return Math.max(0, this.time - (m[k] + (t1 - m[k]) * clamp(u, 0, 1)));
  }

  // Écart (en secondes) entre deux voitures : > 0 si a est devant b.
  gapBetween(a, b) {
    if (a.finished && b.finished) return b.finishTime - a.finishTime;
    if (this.phase === 'racing' || this.phase === 'finishing') return this.gapToLeader(b) - this.gapToLeader(a);
    const d = a.distance - b.distance;
    const sp = Math.max(10, (Math.abs(a.vehicle.speed) + Math.abs(b.vehicle.speed)) / 2);
    return d / sp;
  }

  allFinished() {
    return this.cars.every((c) => c.finished);
  }

  lapProgress(c) {
    const t = this.track;
    if (!t.closed) return clamp(c.distance / (t.length - t.startS - 30), 0, 1);
    const L = t.length;
    return (((c.distance % L) + L) % L) / L;
  }
}
