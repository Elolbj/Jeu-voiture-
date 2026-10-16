// Banc d'essai physique en ligne de commande : accélérations (0-100, 0-200, 400 m et 1 000 m départ arrêté),
// vitesse maximale, freinage 100-0, accélération latérale stabilisée (90 et 160 km/h), progression PP / prix.
//
// Usage : node tools/physics-test.mjs [id …] [--ref] [--table] [--upg=eng1,tire_semi] [--notcs] [--json]
//   id …      voitures à tester (toutes par défaut ; un préfixe comme « kaze » sélectionne toute une marque)
//   --ref     affiche à côté de chaque mesure la référence réelle comparable (REFS ci-dessous)
//   --table   tableau de progression PP / prix trié par PP (sans simulation)
//   --upg=…   applique des améliorations du préparateur avant le test
//   --notcs   désactive l'antipatinage (départs arrêtés)
//   --json    sortie JSON (une ligne par voiture)
import { Vector3 } from 'three';
import { Vehicle, SURFACES } from '../src/physics/vehicle.js';
import { CARS, CAR_BY_ID, CATEGORIES, buildSpec, engineLabel } from '../src/data/cars.js';

// Références réelles comparables (chiffres constructeur ou essais presse, arrondis).
// t100 / t200 en s, q400 / k1000 en s (départ arrêté), vmax en km/h (« lim. » = bridée électroniquement).
const REFS = {
  kaze_r3: { ref: 'Toyota Corolla G6 1.6 (1998)', t100: 10.2, vmax: 195 },
  miyabi_rs: { ref: 'Mazda MX-5 NB 1.8 (1999)', t100: 8.4, vmax: 205 },
  valette_rallye: { ref: 'Peugeot 205 Rallye (1988)', t100: 9.6, q400: 16.9, k1000: 31.5, vmax: 190 },
  valette_sprint: { ref: 'Renault Clio RS 197 (2006)', t100: 6.9, k1000: 27.1, vmax: 215 },
  hoshi_civica: { ref: 'Honda Civic Type R EP3 (2001)', t100: 6.8, vmax: 235 },
  kaze_86: { ref: 'Toyota GT86 (2016)', t100: 7.6, vmax: 226 },
  marlin_gt: { ref: 'Toyota 2000GT (1967) / Fiat Dino 2.0 coupé (1968)', t100: 8.5, q400: 16.2, vmax: 215 },
  vortex_428: { ref: 'Ford Mustang Mach 1 428 Cobra Jet (1969)', t100: 6.0, q400: 14.1, vmax: 200 },
  hoshi_nxr: { ref: 'Honda NSX NA1 (1992)', t100: 5.7, q400: 13.9, vmax: 270 },
  kaze_wrx: { ref: 'Subaru Impreza WRX STI GRB (2008)', t100: 5.0, q400: 13.4, vmax: 255 },
  kaze_sora: { ref: 'Toyota Supra RZ JZA80 (1997)', t100: 5.1, q400: 13.4, vmax: 285 },
  hoshi_raijin: { ref: 'Mitsubishi Lancer Evolution IX (2006)', t100: 5.0, q400: 13.5, vmax: 250 },
  falco_gtr: { ref: 'Nissan Skyline GT-R V-spec R34 (2000)', t100: 5.0, q400: 13.3, vmax: 270 },
  strauss_m3: { ref: 'BMW M3 CSL E46 (2004)', t100: 4.9, t200: 16.8, vmax: 280 },
  strauss_avant: { ref: 'Audi RS6 Avant C8 (2020)', t100: 3.6, t200: 12.0, vmax: 305 },
  stellan_rs: { ref: 'Porsche 911 GT3 RS 3.8 (2010)', t100: 4.0, t200: 12.3, vmax: 310 },
  vortex_acr: { ref: 'Dodge Viper ACR (2016)', t100: 3.5, vmax: 285 },
  falco_gt4: { ref: 'Toyota GR Supra GT4 / Nissan Z GT4 (2020-23)', t100: 4.2, vmax: 270 },
  aurelia_tempesta: { ref: 'Ferrari F8 Tributo (2019)', t100: 2.9, t200: 7.8, vmax: 340 },
  falco_gt3: { ref: 'Nissan GT-R Nismo GT3 (2018)', t100: 3.4, vmax: 285 },
  aurelia_veloce: { ref: 'Ferrari LaFerrari (2013)', t100: 2.6, t200: 6.9, vmax: 350 },
  aurelia_lmp: { ref: 'LMP2 Oreca 07 (2017)', t100: 3.0, vmax: 330 },
  stellan_962: { ref: 'Porsche 962C (1987, config. sprint)', t100: 3.0, vmax: 340 },
  delaunay_dl98: { ref: 'Toyota GT-One / Mercedes CLK-LR (1998)', t100: 3.0, vmax: 340 },
};

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
const args = process.argv.slice(2);
const flag = (name) => args.includes('--' + name);
const opt = (name) => args.find((a) => a.startsWith('--' + name + '='))?.split('=')[1];
const ids = args.filter((a) => !a.startsWith('--'));
const upgrades = opt('upg') ? opt('upg').split(',') : [];
const showRef = flag('ref');
const json = flag('json');

function settle(v) {
  v.frozen = false;
  for (let i = 0; i < 240; i++) v.step(DT, flat);
}

function accelTest(spec) {
  const v = new Vehicle(spec, { assists: { tcs: !flag('notcs') } });
  v.reset(new Vector3(0, 0, 0), 0, 0);
  settle(v);
  let t = 0, t100 = null, t200 = null, vmax = 0, q400 = null, k1000 = null, dist = 0, t98 = null;
  let minY = 1e9, maxY = -1e9;
  const samples = [];
  v.controls.throttle = 1;
  while (t < 120) {
    v.step(DT, flat);
    t += DT;
    const kmh = v.speedKmh;
    dist += Math.abs(v.speed) * DT;
    if (t100 === null && kmh >= 100) t100 = t;
    if (t200 === null && kmh >= 200) t200 = t;
    if (q400 === null && dist >= 402.3) q400 = { t, v: kmh };
    if (k1000 === null && dist >= 1000) k1000 = { t, v: kmh };
    vmax = Math.max(vmax, kmh);
    if ((samples.length + 1) * 0.5 <= t) samples.push(kmh);
    minY = Math.min(minY, v.position.y);
    maxY = Math.max(maxY, v.position.y);
    if (!isFinite(v.position.x)) return { error: 'NaN' };
  }
  // Temps pour atteindre 98 % de la vitesse max (indique si la Vmax est atteinte « franchement »)
  for (let i = 0; i < samples.length; i++) if (samples[i] >= vmax * 0.98) { t98 = (i + 1) * 0.5; break; }
  return { t100, t200, q400, k1000, vmax, t98, gear: v.gear, rpm: Math.round(v.rpm), y: [minY, maxY] };
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
  return { dist: v.position.distanceTo(p0), t, lateral: v.position.x };
}

const _side = new Vector3();
function skidpad(spec, speed) {
  // Vitesse constante, braquage croissant lentement : accélération latérale max stabilisée (horizontale, mesurée
  // tant que la vitesse reste à ±10 % de la consigne). « perdu » = la caisse dépasse 20° de dérive (tête-à-queue).
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
    _side.set(v.right.x, 0, v.right.z).normalize();
    const latAcc = Math.abs(v.accel.dot(_side)) / 9.81;
    acc += (latAcc - acc) * 0.01;
    if (acc > best && Math.abs(v.speed - speed) < speed * 0.1) best = acc;
    const beta = Math.atan2(v.velocity.dot(v.right), Math.abs(v.velocity.dot(v.forward)));
    if (Math.abs(beta) > 0.35) { spun = true; break; }
    if (v.speed < speed * 0.8) break; // la voiture ne tient plus la vitesse : limite atteinte (sous-virage / puissance)
  }
  return { latG: best, lost: spun };
}

const fmt = (x, d = 2) => (x == null ? '--' : x.toFixed(d));
const cmp = (mine, real, d = 1) => (showRef && real != null ? ` (réel ${real.toFixed(d)})` : '');

function selected() {
  if (!ids.length) return CARS;
  return CARS.filter((c) => ids.some((id) => c.id === id || (!CAR_BY_ID[id] && c.id.startsWith(id))));
}

if (flag('table')) {
  // Progression PP / prix (sans simulation)
  const rows = CARS.map((c) => ({ c, pp: buildSpec(c.id).pp })).sort((a, b) => a.pp - b.pp);
  for (const { c, pp } of rows) {
    console.log(
      `${String(pp).padStart(5)} PP  ${(c.brand + ' ' + c.model).padEnd(28)} ${String(c.year).padEnd(5)} ${CATEGORIES[c.category].padEnd(18)} ` +
        `${c.storyOnly ? 'histoire'.padStart(11) : String(c.price).padStart(11)} cr  ${engineLabel(c).padEnd(30)} ${c.engine.hp} ch / ${c.mass} kg`
    );
  }
  process.exit(0);
}

const list = selected();
if (!list.length) {
  console.error(`Aucune voiture ne correspond à : ${ids.join(', ')}`);
  process.exit(1);
}
for (const car of list) {
  const spec = buildSpec(car.id, upgrades);
  const a = accelTest(spec);
  if (a.error) {
    console.log(`${car.id}: ERREUR ${a.error}`);
    continue;
  }
  const b = brakeTest(spec);
  const s1 = skidpad(spec, 25);
  const s2 = skidpad(spec, 160 / 3.6);
  const r = REFS[car.id] || {};
  if (json) {
    console.log(JSON.stringify({ id: car.id, pp: spec.pp, t100: a.t100, t200: a.t200, q400: a.q400?.t, k1000: a.k1000?.t, vmax: a.vmax, brake: b.dist, lat90: s1.latG, lat160: s2.latG, ref: r }));
    continue;
  }
  console.log(
    `${(car.brand + ' ' + car.model).padEnd(28)} PP${String(spec.pp).padStart(5)}  ${spec.engine.hp} ch ${spec.mass} kg ${spec.drive}` +
      (showRef && r.ref ? `   ~ ${r.ref}` : '')
  );
  console.log(
    `   0-100 ${fmt(a.t100)}s${cmp(a.t100, r.t100)}  0-200 ${fmt(a.t200, 1)}s${cmp(a.t200, r.t200)}  ` +
      `400m DA ${fmt(a.q400?.t)}s à ${fmt(a.q400?.v, 0)}${cmp(a.q400?.t, r.q400)}  1000m DA ${fmt(a.k1000?.t)}s à ${fmt(a.k1000?.v, 0)}${cmp(a.k1000?.t, r.k1000)}`
  );
  console.log(
    `   Vmax ${a.vmax.toFixed(0)} km/h${cmp(a.vmax, r.vmax, 0)} (rapport ${a.gear}, ${a.rpm} tr/min, 98 % en ${fmt(a.t98, 0)}s)  ` +
      `100-0 ${b.dist.toFixed(1)} m  lat ${s1.latG.toFixed(2)} g à 90${s1.lost ? ' (perdu)' : ''} / ${s2.latG.toFixed(2)} g à 160${s2.lost ? ' (perdu)' : ''}  ` +
      `assiette ${a.y[0].toFixed(3)}-${a.y[1].toFixed(3)} m`
  );
}
