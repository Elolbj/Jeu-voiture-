// Banc d'essai physique en ligne de commande : 0-100, vitesse max, freinage, accélération latérale.
import { Vector3 } from 'three';
import { Vehicle, SURFACES } from '../src/physics/vehicle.js';
import { CARS, buildSpec } from '../src/data/cars.js';

const flat = {
  sample(x, z, hint, out) {
    out.y = 0;
    out.normal.set(0, 1, 0);
    out.surface = SURFACES.asphalt;
    out.hint = 0;
    out.bump = 0;
    return out;
  },
};

const DT = 1 / 240;
const only = process.argv[2];

function settle(v) {
  v.frozen = false;
  for (let i = 0; i < 240; i++) v.step(DT, flat);
}

function accelTest(spec) {
  const v = new Vehicle(spec);
  v.reset(new Vector3(0, 0, 0), 0, 0);
  settle(v);
  let t = 0, t100 = null, t200 = null, vmax = 0, d400 = null, dist = 0;
  let minY = 1e9, maxY = -1e9;
  v.controls.throttle = 1;
  while (t < 120) {
    v.step(DT, flat);
    t += DT;
    const kmh = v.speedKmh;
    dist += Math.abs(v.speed) * DT;
    if (t100 === null && kmh >= 100) t100 = t;
    if (t200 === null && kmh >= 200) t200 = t;
    if (d400 === null && dist >= 402) d400 = t;
    vmax = Math.max(vmax, kmh);
    minY = Math.min(minY, v.position.y);
    maxY = Math.max(maxY, v.position.y);
    if (!isFinite(v.position.x)) return { error: 'NaN' };
  }
  return { t100, t200, d400, vmax, gear: v.gear, rpm: Math.round(v.rpm), heading: v.forward.x.toFixed(3), y: [minY.toFixed(3), maxY.toFixed(3)] };
}

function brakeTest(spec, abs = true) {
  const v = new Vehicle(spec, { assists: { abs } });
  v.reset(new Vector3(0, 0, 0), 0, 100 / 3.6);
  for (let i = 0; i < 60; i++) v.step(DT, flat);
  v.reset(new Vector3(0, 0, 0), 0, 100 / 3.6);
  const p0 = v.position.clone();
  v.controls.brake = 1;
  let t = 0;
  while (v.speedKmh > 0.5 && t < 20) {
    v.step(DT, flat);
    t += DT;
  }
  return { dist: v.position.distanceTo(p0), t, lateral: v.position.x.toFixed(2) };
}

function skidpad(spec, speed = 25) {
  // Vitesse constante, braquage croissant lentement : on mesure l'accélération latérale max stabilisée.
  const v = new Vehicle(spec, { assists: { stability: false } });
  v.reset(new Vector3(0, 0, 0), 0, speed);
  let t = 0, best = 0, spun = false;
  let acc = 0;
  while (t < 40) {
    v.controls.steer = Math.min(1, Math.max(0, (t - 1) * 0.012));
    v.controls.throttle = Math.max(0, Math.min(1, (speed - v.speed) * 0.6));
    v.controls.brake = 0;
    v.step(DT, flat);
    t += DT;
    const latAcc = Math.abs(v.speed * v.angVel.y) / 9.81;
    acc += (latAcc - acc) * 0.01;
    if (acc > best) best = acc;
    const beta = Math.atan2(v.velocity.dot(v.right), Math.abs(v.velocity.dot(v.forward)));
    if (Math.abs(beta) > 0.35) { spun = true; break; }
  }
  return { latG: best.toFixed(2), atKmh: (speed * 3.6).toFixed(0), lost: spun };
}

for (const car of CARS) {
  if (only && car.id !== only) continue;
  const spec = buildSpec(car.id);
  const a = accelTest(spec);
  const b = brakeTest(spec);
  const s = skidpad(spec);
  console.log(
    `${(car.brand + ' ' + car.model).padEnd(26)} PP${String(spec.pp).padStart(4)} ` +
      `0-100: ${a.t100?.toFixed(2) ?? '--'}s  0-200: ${a.t200?.toFixed(1) ?? '--'}s  400m: ${a.d400?.toFixed(2) ?? '--'}s  ` +
      `Vmax: ${a.vmax.toFixed(0)} km/h (g${a.gear} ${a.rpm}rpm)  ` +
      `100-0: ${b.dist.toFixed(1)}m  lat: ${s.latG}g@${s.atKmh}${s.lost ? ' (perdu)' : ''}  y:${a.y}`
  );
}
