// Calcule les temps de référence (or/argent/bronze) des permis et contre-la-montre
// en simulant le pilote IA (et un freinage optimal pour les épreuves d'arrêt).
// Écrit src/data/targets.js
import fs from 'node:fs';
import { Vector3 } from 'three';
import { Track } from '../src/world/track.js';
import { TRACK_BY_ID } from '../src/data/tracks.js';
import { buildSpec } from '../src/data/cars.js';
import { RaceSim, PHYS_DT } from '../src/game/raceSim.js';
import { RacingLine } from '../src/game/racingLine.js';
import { LICENCES, ALL_EVENTS } from '../src/data/story.js';

const tracks = new Map();
function getTrack(id) {
  if (!tracks.has(id)) {
    const t = new Track(TRACK_BY_ID[id]);
    tracks.set(id, { track: t, line: new RacingLine(t) });
  }
  return tracks.get(id);
}

function aiRun(trackId, carId, upgrades, startS, startSpeed, distance, skill = 1) {
  const { track, line } = getTrack(trackId);
  const sim = new RaceSim(track, [{ name: 'IA', spec: buildSpec(carId, upgrades), ai: { skill } }], { laps: 99, line });
  const c = sim.cars[0];
  sim.placeCar(c, startS, line.offsetAt(startS), startSpeed / 3.6);
  c.distance = 0;
  c.prevS = ((startS % track.length) + track.length) % track.length;
  sim.phase = 'racing';
  c.vehicle.frozen = false;
  let t = 0;
  while (t < 400) {
    sim.fixedStep(PHYS_DT, Math.round(t / PHYS_DT));
    t += PHYS_DT;
    if (c.distance >= distance) return t;
  }
  return null;
}

function stopRun(trackId, carId, startS, startSpeed, brakeAt) {
  const { track, line } = getTrack(trackId);
  const sim = new RaceSim(track, [{ name: 'P', spec: buildSpec(carId), player: true }], { laps: 99, line });
  const c = sim.cars[0];
  sim.placeCar(c, startS, 0, startSpeed / 3.6);
  c.distance = 0;
  c.prevS = startS;
  sim.phase = 'racing';
  c.vehicle.frozen = false;
  let t = 0;
  const v = c.vehicle;
  while (t < 120) {
    const s = startS + c.distance;
    // maintien de cap : écart latéral + erreur d'orientation
    const th = track.headingAt(c.s);
    let he = Math.atan2(v.forward.x, -v.forward.z) - th;
    while (he > Math.PI) he -= 2 * Math.PI;
    while (he < -Math.PI) he += 2 * Math.PI;
    v.controls.steer = Math.max(-1, Math.min(1, (-c.lateral * 0.03 - he * 1.2) / v.steerLock * 0.5));
    if (s < brakeAt) { v.controls.throttle = 1; v.controls.brake = 0; }
    else { v.controls.throttle = 0; v.controls.brake = 1; }
    sim.fixedStep(PHYS_DT, Math.round(t / PHYS_DT));
    t += PHYS_DT;
    if (s > brakeAt && Math.abs(v.speed) < 0.25) return { t, s: startS + c.distance };
  }
  return { t, s: startS + c.distance };
}

const out = { licences: {}, events: {} };
const r2 = (x) => Math.round(x * 100) / 100;

for (const L of LICENCES) {
  for (const T of L.tests) {
    const { track } = getTrack(T.track);
    let ref;
    if (T.kind === 'stop') {
      const goal = T.zone[1] - 3;
      let lo = T.startS + 10, hi = T.zone[1];
      for (let k = 0; k < 30; k++) {
        const mid = (lo + hi) / 2;
        const r = stopRun(T.track, T.car, T.startS, T.startSpeed, mid);
        if (r.s > goal) hi = mid; else lo = mid;
      }
      const r = stopRun(T.track, T.car, T.startS, T.startSpeed, lo);
      ref = r.t;
      out.licences[T.id] = { gold: r2(ref * 1.05), silver: r2(ref * 1.12), bronze: r2(ref * 1.22), ref: r2(ref), stopAt: Math.round(r.s) };
    } else {
      const dist = T.kind === 'gate' ? T.endS - T.startS : track.length;
      ref = aiRun(T.track, T.car, [], T.startS, T.startSpeed, dist, 1);
      out.licences[T.id] = { gold: r2(ref * 1.01), silver: r2(ref * 1.05), bronze: r2(ref * 1.11), ref: r2(ref) };
    }
    console.log(T.id, JSON.stringify(out.licences[T.id]));
  }
}

for (const e of ALL_EVENTS) {
  if (e.type !== 'timetrial') continue;
  const { track } = getTrack(e.track);
  let ref;
  if (track.closed) {
    // tour lancé : on mesure le 2e tour
    const startS = track.startS - 150;
    const t2 = aiRun(e.track, e.ref, e.refUpgrades || [], startS, 0, track.length * 2 + 150, 1);
    const t1 = aiRun(e.track, e.ref, e.refUpgrades || [], startS, 0, track.length + 150, 1);
    ref = t2 - t1;
  } else {
    ref = aiRun(e.track, e.ref, e.refUpgrades || [], track.startS, 0, track.length - track.startS - 30, 1);
  }
  out.events[e.id] = { gold: r2(ref * 0.995), silver: r2(ref * 1.03), bronze: r2(ref * 1.07), ref: r2(ref) };
  console.log(e.id, JSON.stringify(out.events[e.id]));
}

fs.writeFileSync('src/data/targets.js', `// Généré par tools/compute-targets.mjs — temps de référence (s)\nexport const TARGETS = ${JSON.stringify(out, null, 2)};\n`);
console.log('écrit src/data/targets.js');
