// Scène de course : assemble monde, simulation, modèles, caméras, HUD, audio, effets,
// enregistrement du ralenti, épreuves de permis et contre-la-montre.
import * as THREE from 'three';
import { World } from '../world/world.js';
import { TRACK_BY_ID } from '../data/tracks.js';
import { RaceSim } from './raceSim.js';
import { AIDriver } from './ai.js';
import { CarModel } from '../render/carModel.js';
import { CameraRig, CAM_LABEL } from './cameras.js';
import { HUD } from './hud.js';
import { CarEffects } from '../render/effects.js';
import { ReplayRecorder, ReplayPlayer } from './replay.js';
import { EngineSound, CarAmbience, sfxImpact, sfxShift, beep, audioCtx } from '../core/audio.js';
import { clamp, formatTime, lerp } from '../core/utils.js';
import { TIRES } from '../data/cars.js';

const _v = new THREE.Vector3();
const _fwd = new THREE.Vector3();

export class RaceScene {
  constructor(app, cfg) {
    this.app = app;
    this.cfg = cfg;
    this.def = TRACK_BY_ID[cfg.trackId];
    this.phase = 'loading';
    this.paused = false;
    this.timeScale = 1;
    this.outroTime = 0;
    this.licence = cfg.licence || null;
    this.result = null;
  }

  build() {
    const app = this.app;
    const cfg = this.cfg;
    const world = new World(app.renderer, this.def, { time: cfg.time });
    this.world = world;
    this.track = world.track;
    const scene = world.scene;
    this.scene = scene;
    const settings = app.settings;

    // ------------------------------------------------ Participants
    const entries = [];
    const opp = cfg.opponents || [];
    opp.forEach((o) => entries.push({ name: o.name, short: o.short, spec: o.spec, color: o.color, ai: { skill: o.skill * settings.difficultyMul, aggression: o.aggression ?? 0.5, lineBias: o.lineBias ?? 0 } }));
    const playerEntry = {
      name: cfg.player.name || 'Vous',
      short: cfg.player.short || 'VOUS',
      spec: cfg.player.spec,
      color: cfg.player.color,
      player: true,
      assists: { ...settings.assists },
    };
    const gp = clamp(cfg.playerGrid ?? entries.length, 0, entries.length);
    entries.splice(gp, 0, playerEntry);
    const mode = cfg.mode || 'race';
    const sim = new RaceSim(this.track, entries, { laps: cfg.laps ?? 3, mode: mode === 'race' ? 'race' : mode === 'free' ? 'free' : 'race', line: world.line });
    sim.cars.forEach((c, i) => {
      c.short = entries[i].short || c.name.slice(0, 3).toUpperCase();
      c.color = entries[i].color;
    });
    this.sim = sim;
    sim.maxFrame = app.maxDt;
    if (cfg.autopilot) {
      const pc = sim.player;
      pc.ai = new AIDriver(pc.vehicle, this.track, world.line, { skill: 0.9 });
      pc.ai.car = pc;
      this.autopilot = true;
    }
    this.player = sim.player;
    this.playerIndex = sim.cars.indexOf(this.player);

    // Épreuve de permis : placement spécifique
    if (this.licence) {
      const L = this.licence;
      const s0 = L.startS ?? this.track.startS;
      sim.placeCar(this.player, s0, L.lat ?? 0, (L.startSpeed ?? 0) / 3.6);
      this.player.distance = 0;
      this.player.prevS = ((s0 % this.track.length) + this.track.length) % this.track.length;
      this.licenceStartS = s0;
      this.licenceHold = true; // simulation figée jusqu'au top départ
      this.player.vehicle.frozen = false;
      this.buildLicenceMarks();
    }

    // ------------------------------------------------ Modèles 3D
    this.models = sim.cars.map((c, i) => {
      const m = new CarModel(c.spec, {
        color: c.color,
        number: c.spec.livery ? (i + 3) * 7 % 99 : undefined,
        sponsor: c.spec.livery ? i : undefined,
      });
      if (world.env.night) m.setLights(true);
      scene.add(m.root);
      m.syncFromVehicle(c.vehicle);
      return m;
    });
    // Phares du joueur la nuit (vraies sources lumineuses)
    if (world.env.night) {
      const pm = this.models[this.playerIndex];
      for (const side of [-0.6, 0.6]) {
        const l = new THREE.SpotLight(0xfff2dd, 140, 140, 0.42, 0.55, 1.4);
        l.position.set(side, 0.1, -2);
        l.target.position.set(side * 1.5, -1.5, -30);
        pm.root.add(l);
        pm.root.add(l.target);
      }
    }

    // ------------------------------------------------ Caméra, HUD, effets
    this.rig = new CameraRig(this.track);
    this.rig.mode = settings.camera || 'chase';
    this.hud = new HUD(app.uiRoot, this.track);
    this.effects = new CarEffects(scene, app.renderer);
    this.recorder = new ReplayRecorder(sim.cars.length);

    // ------------------------------------------------ Audio
    this.engineSounds = sim.cars.map((c) => new EngineSound(c.spec, { player: c.isPlayer, panner: !c.isPlayer }));
    this.ambience = new CarAmbience();

    // Pré-calcul : meilleur tour de référence pour le delta
    this.refLap = null;
    this.curLapTrace = [];
    this.lastPlayerS = 0;

    this.phase = 'intro';
    this.introT = 0;
    this.countdownStep = -1;
    this.applyGantry(0, false);
    const title = cfg.title || this.def.name;
    this.hud.big('');
    this.hud.message(title, 3.2, 'title');
    const lapsTxt = this.track.closed && !this.licence ? `${cfg.laps ?? 3} tour${(cfg.laps ?? 3) > 1 ? 's' : ''}` : this.licence ? this.licence.desc || '' : 'Course de côte';
    this.hud.sub(`${this.def.name} · ${lapsTxt}`, 3.2);
    this.hud.setVisible(true);
    world.update(0, this.player.vehicle.position);
  }

  buildLicenceMarks() {
    const L = this.licence;
    const t = this.track;
    const mk = (s, color, width = 0.5) => {
      const g = new THREE.BufferGeometry();
      const pts = [];
      for (const [ds, lat] of [[-width / 2, -t.halfWidth], [-width / 2, t.halfWidth], [width / 2, -t.halfWidth], [width / 2, t.halfWidth]]) {
        const p = t.pointAt(s + ds, lat);
        pts.push(p.x, p.y + 0.03, p.z);
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      g.setIndex([0, 2, 1, 1, 2, 3]);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6 }));
      this.scene.add(m);
    };
    if (L.kind === 'stop') {
      const [a, b] = L.zone;
      mk(a, 0xffcc00, 0.4);
      mk(b, 0xffcc00, 0.4);
      // remplissage translucide
      const g = new THREE.BufferGeometry();
      const pts = [];
      const N = 12;
      for (let k = 0; k <= N; k++) {
        const s = a + ((b - a) * k) / N;
        for (const lat of [-t.halfWidth, t.halfWidth]) {
          const p = t.pointAt(s, lat);
          pts.push(p.x, p.y + 0.02, p.z);
        }
      }
      const idx = [];
      for (let k = 0; k < N; k++) idx.push(k * 2, k * 2 + 2, k * 2 + 1, k * 2 + 1, k * 2 + 2, k * 2 + 3);
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5 }));
      this.scene.add(m);
    } else if (L.kind === 'gate') {
      mk(L.endS, 0xff3030, 0.6);
    }
  }

  applyGantry(n, green) {
    this.world.gantry?.setLights(n, green);
  }

  // ------------------------------------------------------------------------
  update(dt) {
    const app = this.app;
    const input = app.input;
    if (this.phase === 'loading') return;
    if (this.phase === 'replay') return this.updateReplay(dt);

    // Pause
    if (input.pressed('pause') && this.phase !== 'results') {
      this.togglePause();
    }
    if (this.paused) {
      this.renderFrame(0);
      return;
    }
    if (input.pressed('camera')) {
      const m = this.rig.cycle();
      app.settings.camera = m;
      this.hud.setCamLabel(CAM_LABEL[m]);
    }
    if (input.pressed('hud')) this.hud.setVisible(!this.hud.visible);

    const sim = this.sim;
    const pc = this.player;
    const pv = pc.vehicle;

    // ---- Phases ----
    if (this.phase === 'intro') {
      this.introT += dt;
      if (this.introT > 3.0 || input.pressed('confirm')) {
        this.phase = 'countdown';
        this.cdT = 0;
        if (this.licence) {
          // départ lancé / arrêté pour les permis : compte à rebours, simulation figée
          this.licenceHold = true;
        } else {
          sim.start();
        }
        this.rig.reset();
      }
    }
    if (this.phase === 'countdown') {
      this.cdT += dt;
      const steps = this.licence ? [0.5, 1.2, 1.9] : [0.6, 1.4, 2.2];
      const goT = this.licence ? 2.6 : 3.0;
      let k = 0;
      for (const st of steps) if (this.cdT >= st) k++;
      if (k !== this.countdownStep) {
        this.countdownStep = k;
        if (k > 0) {
          beep(560, 0.16, 0.22);
          this.hud.big(String(4 - k), 'count');
          this.applyGantry(k * 2 - 1, false);
        }
      }
      if (this.licence) {
        if (this.cdT >= goT) this.startRacing();
      } else if (sim.phase === 'racing') this.startRacing();
      // pendant le compte à rebours non-permis, la simulation tourne (voitures freinées)
      if (!this.licence) {
        // sim.countdown géré dans RaceSim : on synchronise son minuteur sur le nôtre
        sim.countdownLeft = Math.max(0, goT - this.cdT);
      }
    }

    // ---- Contrôles du joueur ----
    if ((!pc.finished || this.phase === 'countdown') && !this.autopilot) this.playerControls(dt);

    // ---- Simulation ----
    const runSim = !(this.licence && this.licenceHold);
    const simDt = dt * this.timeScale;
    if (runSim) {
      // Difficulté dynamique légère
      this.adaptiveAI(dt);
      sim.update(simDt);
    }
    if (input.pressed('reset') && (this.phase === 'racing') && !pc.finished) {
      sim.resetCar(pc);
      this.hud.sub('Voiture replacée sur la piste', 1.5);
    }

    // ---- Événements ----
    for (const e of sim.events) this.handleEvent(e);
    sim.events.length = 0;

    if (this.phase === 'racing') {
      if (this.licence) this.checkLicence(dt);
      if (pc.wrongWay) this.hud.message('SENS INTERDIT', 0.3, 'warn');
      // delta vs meilleur tour
      this.traceLap();
    }
    if (this.phase === 'outro') {
      this.outroTime += dt;
      const allDone = sim.cars.every((c) => c.finished);
      if (this.outroTime > (allDone ? 3 : 14) || (this.outroTime > 2 && this.app.input.pressed('confirm'))) this.finishRace();
    }

    // ---- Enregistrement du ralenti ----
    if (this.phase === 'racing' || this.phase === 'outro') this.recorder.record(simDt, sim.time, sim.cars);

    this.renderFrame(dt);
  }

  startRacing() {
    this.phase = 'racing';
    this.licenceHold = false;
    beep(1120, 0.45, 0.28);
    this.hud.big('GO', 'go');
    this.applyGantry(0, true);
    setTimeout(() => {
      this.hud.big('');
      this.applyGantry(0, false);
    }, 900);
    this.sim.phase = 'racing';
    this.sim.time = 0;
    for (const c of this.sim.cars) c.vehicle.frozen = false;
    this.licenceT = 0;
  }

  togglePause() {
    this.paused = !this.paused;
    for (const s of this.engineSounds) if (s.ok) s.out.gain.setTargetAtTime(this.paused ? 0 : 0.5, audioCtx().currentTime, 0.05);
    if (this.paused) this.ambience.update(0, { speed: 0, wheels: [] });
    this.app.showPause?.(this.paused, this);
  }

  playerControls(dt) {
    const input = this.app.input;
    const st = input.state;
    const pc = this.player;
    const v = pc.vehicle;
    const ctl = v.controls;
    const settings = this.app.settings;
    const speed = v.speed;
    // Direction avec assistance (clavier)
    const tire = TIRES[v.spec.tires];
    const sp = Math.max(4, Math.abs(speed));
    const maxAngle = Math.atan((v.wheelbase * tire.mu * 9.81) / (sp * sp)) + tire.alphaPeak * 1.35;
    const limit = clamp(maxAngle / v.steerLock, 0.1, 1);
    let steer;
    if (st.analog) {
      steer = st.steer * (settings.steeringAssist ? lerp(1, limit, 0.75) : 1);
    } else {
      const target = st.keyboardSteer * limit;
      const cur = this.kbSteer || 0;
      const returning = Math.sign(target) !== Math.sign(cur) || Math.abs(target) < Math.abs(cur);
      const rate = (returning ? 4.5 : 2.4) * (1.15 - clamp(sp / 80, 0, 0.6));
      this.kbSteer = cur + clamp(target - cur, -rate * dt, rate * dt);
      steer = this.kbSteer;
    }
    // Contre-braquage automatique
    if (settings.steeringAssist && sp > 6) {
      const beta = Math.atan2(v.velocity.dot(v.right), Math.max(1, Math.abs(v.velocity.dot(v.forward))));
      if (Math.abs(beta) > 0.04) steer += ((beta - Math.sign(beta) * 0.04) * 0.9) / v.steerLock;
    }
    ctl.steer = clamp(steer, -1, 1);

    let thr = st.throttle, brk = st.brake;
    // Marche arrière automatique
    if (v.assists.autoGear && this.phase === 'racing') {
      if (v.gear === -1) {
        if (thr > 0.2 && Math.abs(speed) < 1) v.setGear(1);
        else { const t = thr; thr = brk; brk = t; }
      } else if (brk > 0.5 && thr < 0.1 && Math.abs(speed) < 0.6) {
        this.revT = (this.revT || 0) + dt;
        if (this.revT > 0.35) { v.setGear(-1); this.revT = 0; }
      } else this.revT = 0;
    }
    ctl.throttle = thr;
    ctl.brake = brk;
    ctl.handbrake = st.handbrake;
    if (!v.assists.autoGear) {
      if (input.pressed('shiftUp')) { v.shiftUp(); sfxShift(); }
      if (input.pressed('shiftDown')) { v.shiftDown(); sfxShift(); }
    }
  }

  adaptiveAI(dt) {
    this._adT = (this._adT || 0) - dt;
    if (this._adT > 0 || this.sim.phase !== 'racing') return;
    this._adT = 1;
    const pc = this.player;
    const strength = this.app.settings.rubberBand ?? 0.5;
    for (const c of this.sim.cars) {
      if (!c.ai || c.finished) continue;
      const gap = this.sim.gapBetween(c, pc); // >0 : l'IA est devant
      let k = 1;
      if (gap > 4) k = 1 - Math.min(0.05, (gap - 4) * 0.006) * strength;
      else if (gap < -6) k = 1 + Math.min(0.03, (-gap - 6) * 0.004) * strength;
      c.ai.speedScale = k;
    }
  }

  handleEvent(e) {
    const pc = this.player;
    switch (e.type) {
      case 'lap':
        if (e.car === pc) {
          const isBest = e.valid && pc.bestLap === e.time;
          this.hud.message(formatTime(e.time), 2.5, isBest ? 'best' : '');
          if (isBest) this.hud.sub('MEILLEUR TOUR', 2.5);
          else if (!e.valid) this.hud.sub('Tour invalidé (sortie de piste)', 2.5);
          if (!pc.finished && this.track.closed && pc.lap === this.sim.laps - 1) this.hud.sub('DERNIER TOUR', 2.5);
          if (isBest) this.refLap = this.curLapTrace.slice();
          this.curLapTrace = [];
        }
        break;
      case 'finish':
        if (e.car === pc) this.onPlayerFinish();
        break;
      case 'wall':
        if (e.car === pc) {
          sfxImpact(clamp(e.impulse / 9000, 0, 1));
          this.rig.shake = clamp(e.impulse / 8000, 0, 1);
        }
        this.effects.impact(e.car.vehicle.position, e.impulse, e.car.vehicle.velocity);
        break;
      case 'car':
        if (e.a === pc || e.b === pc) sfxImpact(clamp(e.impulse / 7000, 0, 0.8));
        break;
      case 'reset':
        break;
    }
  }

  traceLap() {
    const pc = this.player;
    const t = this.sim.time - pc.lapStart;
    const d = this.track.closed ? ((pc.distance % this.track.length) + this.track.length) % this.track.length : pc.distance;
    const tr = this.curLapTrace;
    if (!tr.length || d - tr[tr.length - 1][0] > 10) tr.push([d, t]);
    if (this.refLap && this.refLap.length > 2) {
      // interpolation du temps de référence à la même distance
      const ref = this.refLap;
      let lo = 0, hi = ref.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (ref[mid][0] <= d) lo = mid; else hi = mid;
      }
      const a = ref[lo], b = ref[hi];
      const u = b[0] > a[0] ? clamp((d - a[0]) / (b[0] - a[0]), 0, 1) : 0;
      this.delta = t - (a[1] + (b[1] - a[1]) * u);
    } else this.delta = null;
  }

  onPlayerFinish() {
    const pc = this.player;
    if (this.licence) return;
    this.phase = 'outro';
    this.outroTime = 0;
    const n = this.sim.cars.length;
    if (n > 1) {
      const pos = this.sim.standings().indexOf(pc) + 1;
      this.hud.big(pos === 1 ? 'VICTOIRE !' : `${pos}${pos === 1 ? 'er' : 'e'}`, pos <= 3 ? 'win' : 'finish');
    } else this.hud.big('ARRIVÉE', 'finish');
    // Tour de décélération : l'IA prend le volant
    const ai = new AIDriver(pc.vehicle, this.track, this.world.line, { skill: 0.5 });
    ai.speedScale = 0.7;
    ai.car = pc;
    ai.hint = pc.hint;
    pc.ai = ai;
    pc.vehicle.assists = { abs: true, tcs: true, stability: true, autoGear: true };
    if (pc.vehicle.gear < 1) pc.vehicle.setGear(1);
    this.rig.mode = 'chaseFar';
    this.rig.reset();
  }

  checkLicence(dt) {
    const L = this.licence;
    const pc = this.player;
    const v = pc.vehicle;
    const t = this.track;
    this.licenceT = this.sim.time; // temps simulé (indépendant de la fréquence d'affichage)
    const s = t.closed ? this.licenceStartS + pc.distance : pc.s;
    const fail = (reason) => this.endLicence(false, reason);
    if (Math.abs(pc.lateral) > t.halfWidth + 1.2 && L.kind !== 'lap') return fail('Sortie de piste');
    if (pc.impact > 2500) return fail('Contact avec le mur');
    if (pc.wrongWay) return fail('Mauvais sens');
    if (L.kind === 'stop') {
      const [a, b] = L.zone;
      if (s > b + 3) return fail('Zone d\'arrêt dépassée');
      if (Math.abs(v.speed) < 0.25 && s > this.licenceStartS + 8) {
        this.stopT = (this.stopT || 0) + dt;
        if (this.stopT > 0.4) {
          if (s >= a && s <= b) return this.endLicence(true, null, this.licenceT - this.stopT);
          return fail('Arrêt hors de la zone');
        }
      } else this.stopT = 0;
    } else if (L.kind === 'gate') {
      if (s >= L.endS) return this.endLicence(true, null, this.licenceT);
    } else if (L.kind === 'lap') {
      if (pc.lapTimes.length > 0) {
        const lt = pc.lapTimes[0];
        if (!lt.valid) return fail('Tour invalidé (sortie de piste)');
        return this.endLicence(true, null, lt.time);
      }
    }
    if (this.licenceT > (L.timeLimit ?? 240)) return fail('Temps écoulé');
  }

  endLicence(ok, reason, time) {
    if (this.phase === 'outro' || this.result) return;
    const L = this.licence;
    let medal = null;
    if (ok) {
      const tg = L.targets;
      medal = time <= tg.gold ? 'or' : time <= tg.silver ? 'argent' : time <= tg.bronze ? 'bronze' : null;
      this.hud.big(medal ? medal.toUpperCase() : 'RÉUSSI', medal ? 'medal-' + medal : 'finish');
      this.hud.message(formatTime(time), 4);
      if (!medal) this.hud.sub(`Objectif bronze : ${formatTime(tg.bronze)}`, 4);
    } else {
      this.hud.big('ÉCHEC', 'fail');
      this.hud.sub(reason, 4);
    }
    this.licenceResult = { ok: ok && !!medal, medal, time: ok ? time : null, reason: ok ? (medal ? null : 'Temps insuffisant') : reason };
    this.phase = 'outro';
    this.outroTime = 9; // court
    this.player.vehicle.controls.throttle = 0;
    setTimeout(() => this.finishRace(), 2600);
  }

  finishRace() {
    if (this.result) return;
    const sim = this.sim;
    // Temps estimés pour les voitures non arrivées
    const finished = sim.cars.filter((c) => c.finished);
    const avg = finished.length ? finished.reduce((a, c) => a + c.finishTime, 0) / finished.length : sim.time;
    const totalLen = sim.track.closed ? sim.track.length * sim.laps : sim.track.length - sim.track.startS - 30;
    for (const c of sim.cars) {
      if (!c.finished) {
        const remain = Math.max(0, totalLen - c.distance);
        const sp = Math.max(15, c.distance / Math.max(1, sim.time));
        c.finishTime = sim.time + remain / sp;
        c.estimated = true;
      }
    }
    const order = sim.cars.slice().sort((a, b) => a.finishTime - b.finishTime);
    const winnerT = order[0].finishTime;
    const standings = order.map((c, i) => ({
      position: i + 1,
      name: c.name,
      car: `${c.spec.brand} ${c.spec.model}`,
      color: c.color,
      time: c.finishTime,
      gap: c.finishTime - winnerT,
      best: c.bestLap,
      isPlayer: c.isPlayer,
      estimated: !!c.estimated,
    }));
    const me = standings.find((s) => s.isPlayer);
    this.result = {
      mode: this.cfg.mode || 'race',
      position: me.position,
      total: standings.length,
      time: this.player.finished ? this.player.finishTime : null,
      bestLap: this.player.bestLap,
      lapTimes: this.player.lapTimes,
      standings,
      licence: this.licenceResult || null,
      avg,
    };
    this.phase = 'results';
    this.hud.setVisible(false);
    this.app.touch?.show(false);
    for (const s of this.engineSounds) if (s.ok) s.out.gain.setTargetAtTime(0.15, audioCtx().currentTime, 0.4);
    this.app.onRaceFinished?.(this.result, this);
  }

  // ------------------------------------------------------------------------ Ralenti
  startReplay() {
    if (this.recorder.frames.length < 10) return false;
    this.phase = 'replay';
    this.replay = new ReplayPlayer(this.recorder, this.sim.cars);
    this.replayFocus = this.playerIndex;
    this.replayCam = 'tv';
    this.hud.setVisible(false);
    this.effects.skids.clear();
    return true;
  }

  stopReplay() {
    this.phase = 'results';
  }

  updateReplay(dt) {
    const input = this.app.input;
    const rp = this.replay;
    rp.update(dt);
    if (input.pressed('camera')) this.replayCam = this.replayCam === 'tv' ? 'chase' : this.replayCam === 'chase' ? 'cockpit' : 'tv';
    const ghosts = rp.ghosts;
    ghosts.forEach((g, i) => this.models[i].syncFromVehicle(g));
    const g = ghosts[this.replayFocus];
    const model = this.models[this.replayFocus];
    let cam;
    if (this.replayCam === 'tv') cam = this.rig.updateTV(dt * rp.speed, g, g.s);
    else cam = this.rig.update(dt, g, model, { mode: this.replayCam === 'chase' ? 'chase' : 'cockpit' });
    // effets visuels des glissades rejoués (fumée légère)
    this.world.update(dt, g.position, cam.position);
    // son du moteur suivi
    this.engineSounds.forEach((s, i) => {
      const gg = ghosts[i];
      if (!s.ok) return;
      if (s.panner) s.setPosition(gg.position.x, gg.position.y, gg.position.z);
      s.update(gg.rpm, gg.load, { volume: i === this.replayFocus ? 0.8 : 0.5, dt });
    });
    this.setListener(cam);
    this.models.forEach((m) => m.root.visible = true);
    if (this.replayCam === 'cockpit') this.models[this.replayFocus].bodyMesh.visible = true;
    this.app.renderer.render(this.scene, cam);
    this.app.onReplayFrame?.(rp);
  }

  // ------------------------------------------------------------------------ Rendu
  renderFrame(dt) {
    const sim = this.sim;
    const pc = this.player;
    const pv = pc.vehicle;
    const input = this.app.input;
    sim.cars.forEach((c, i) => {
      this.models[i].syncFromVehicle(c.vehicle);
      if (dt > 0) {
        const d2 = c.vehicle.position.distanceToSquared(pv.position);
        this.effects.updateCar(dt, c.vehicle, i, d2 < 150 * 150);
      }
    });
    const r = this.app.renderer;
    // Caméra
    let cam;
    if (this.phase === 'intro') {
      const center = _v.copy(pv.position);
      cam = this.rig.updateOrbit(dt, center, 7.5 + this.introT * 0.4, 1.4 + this.introT * 0.25);
    } else {
      const bump = pv.wheels.reduce((a, w) => a + (w.contact ? w.groundBump || (w.surface.name === 'curb' ? 1 : 0) : 0), 0) / 4;
      cam = this.rig.update(dt, pv, this.models[this.playerIndex], {
        lookBack: input.state.lookBack,
        bump: bump + this.rig.shake,
        groundY: this.track.sample(this.rig.pos.x, this.rig.pos.z, pc.hint, this._gs || (this._gs = { normal: new THREE.Vector3() })).y,
      });
      this.rig.shake = Math.max(0, this.rig.shake - dt * 3);
    }
    // Carrosserie masquée en vue cockpit ? (on la garde pour voir le capot)
    const pm = this.models[this.playerIndex];
    // Niveaux de détail selon la distance à la caméra
    this.models.forEach((m, i) => {
      const d = m.root.position.distanceTo(cam.position);
      m.interiorWanted = d < 30;
      m.setLod(d > 70 ? 1 : 0);
      m.interior.visible = d < 30;
    });
    void pm;
    this.world.update(dt, pv.position, cam.position);
    this.effects.update(dt, r.gl.domElement.height, cam.fov);

    // Audio
    if (dt > 0) {
      this.engineSounds.forEach((s, i) => {
        if (!s.ok) return;
        const c = sim.cars[i];
        const v = c.vehicle;
        if (c.isPlayer) {
          s.update(v.rpm, v.engineLoad, { boost: v.boost, dt, volume: 0.9 });
        } else {
          const d = v.position.distanceTo(cam.position);
          if (d > 220) { s.update(v.rpm, 0, { volume: 0 }); return; }
          // effet Doppler
          _fwd.subVectors(cam.position, v.position).normalize();
          const vr = v.velocity.dot(_fwd) - (pv.velocity.dot(_fwd));
          const doppler = clamp(343 / (343 - vr), 0.7, 1.4);
          s.setPosition(v.position.x, v.position.y, v.position.z);
          s.update(v.rpm * doppler, v.engineLoad, { volume: 0.75 });
        }
      });
      this.ambience.update(dt, pv);
    }
    this.setListener(cam);

    // HUD
    if (this.phase !== 'results') this.hud.update(dt, sim, pc, { delta: this.delta, title: this.licence ? this.licence.title : null, licence: this.licence });
    if (!this.app.noRender) r.render(this.scene, cam);
  }

  setListener(cam) {
    const ctx = audioCtx();
    if (!ctx) return;
    const L = ctx.listener;
    const f = _fwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const t = ctx.currentTime;
    if (L.positionX) {
      L.positionX.setTargetAtTime(cam.position.x, t, 0.02);
      L.positionY.setTargetAtTime(cam.position.y, t, 0.02);
      L.positionZ.setTargetAtTime(cam.position.z, t, 0.02);
      L.forwardX.setTargetAtTime(f.x, t, 0.02);
      L.forwardY.setTargetAtTime(f.y, t, 0.02);
      L.forwardZ.setTargetAtTime(f.z, t, 0.02);
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else {
      L.setPosition(cam.position.x, cam.position.y, cam.position.z);
      L.setOrientation(f.x, f.y, f.z, 0, 1, 0);
    }
  }

  destroy() {
    for (const s of this.engineSounds) s.stop();
    this.ambience.stop();
    this.hud.destroy();
    this.models.forEach((m) => m.dispose());
    this.world.dispose();
  }
}
