// Logique de carrière : progression de l'histoire, éligibilité, adversaires, gains.
import { CARS, CAR_BY_ID, buildSpec, carLabel } from '../data/cars.js';
import { CHAPTERS, EVENT_BY_ID, LICENCES, LICENCE_BY_ID, DRIVERS, RIVAL } from '../data/story.js';
import { TARGETS } from '../data/targets.js';
import { rng, lerp } from '../core/utils.js';
import { carUid } from '../core/save.js';

export const MEDAL_RANK = { or: 3, argent: 2, bronze: 1 };
export const MEDAL_KEY = { gold: 'or', silver: 'argent', bronze: 'bronze' };

export function ownedCar(profile, uid) {
  return profile.cars.find((c) => c.uid === uid) || null;
}

export function currentCar(profile) {
  return ownedCar(profile, profile.currentCar) || profile.cars[0] || null;
}

export function specOf(owned) {
  return buildSpec(owned.id, owned.upgrades || []);
}

export function addCar(profile, id, color, upgrades = []) {
  const car = { uid: carUid(), id, color: color || CAR_BY_ID[id].paints[0], upgrades: [...upgrades], bought: Date.now() };
  profile.cars.push(car);
  if (!profile.currentCar) profile.currentCar = car.uid;
  return car;
}

export function carValue(owned) {
  const base = CAR_BY_ID[owned.id].price;
  return Math.round((base * 0.55) / 100) * 100;
}

// ---------------------------------------------------------------- Histoire
export function eventDone(profile, id) {
  return !!profile.story.done[id]?.ok;
}

export function licenceOk(profile, id) {
  return !!profile.licences[id + '_ok'];
}

export function chapterComplete(profile, ch) {
  return ch.events.every((e) => eventDone(profile, e.id));
}

export function chapterUnlocked(profile, ch) {
  if (ch.id === 0) return true;
  return chapterComplete(profile, CHAPTERS[ch.id - 1]);
}

export function eventUnlocked(profile, ev) {
  const ch = CHAPTERS[ev.chapter];
  if (!chapterUnlocked(profile, ch)) return false;
  return (ev.requires || []).every((r) => eventDone(profile, r));
}

export function currentChapter(profile) {
  for (const ch of CHAPTERS) if (!chapterComplete(profile, ch)) return ch;
  return CHAPTERS[CHAPTERS.length - 1];
}

// Vérifie si une voiture possédée peut participer à l'épreuve
export function eligibility(ev, spec) {
  const r = ev.restrict || {};
  if (r.carId && spec.id !== r.carId) return { ok: false, reason: `Voiture imposée : ${carLabel(CAR_BY_ID[r.carId])}` };
  if (r.ppMax && spec.pp > r.ppMax) return { ok: false, reason: `PP trop élevés (${spec.pp} > ${r.ppMax})` };
  if (r.categories && !r.categories.includes(spec.category)) return { ok: false, reason: 'Catégorie non autorisée' };
  return { ok: true };
}

export function eventTargets(ev) {
  return TARGETS.events[ev.id] || null;
}

export function licenceTargets(test) {
  return TARGETS.licences[test.id] || null;
}

// Améliorations appliquées aux adversaires pour approcher la limite de PP (plateaux équilibrés)
const AI_UPGRADE_ORDER = ['tire_sport', 'eng1', 'w1', 'susp1', 'eng2', 'tire_semi', 'w2', 'lsd'];
function fitToCap(id, cap, target) {
  let ups = [];
  let spec = buildSpec(id, ups);
  if (!cap) return spec;
  for (const u of AI_UPGRADE_ORDER) {
    const next = buildSpec(id, [...ups, u]);
    if (next.pp > target || next.pp === spec.pp) continue;
    ups = [...ups, u];
    spec = next;
  }
  return spec;
}

// Génère le plateau adverse d'une épreuve (voitures respectant la limite de PP)
export function buildOpponents(ev, seedExtra = 0) {
  const o = ev.opponents || { count: 0 };
  const cap = ev.restrict?.ppMax || null;
  const r = rng(ev.id.length * 131 + ev.id.charCodeAt(0) * 7 + seedExtra);
  const names = DRIVERS.slice();
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  const list = [];
  let pool = (o.pool || []).filter((id) => !cap || buildSpec(id).pp <= cap);
  if (!pool.length) pool = o.pool || [];
  const [s0, s1] = o.skill || [0.6, 0.8];
  for (let i = 0; i < o.count; i++) {
    const id = pool[i % pool.length];
    const car = CAR_BY_ID[id];
    const [f0, f1] = o.fit || [0.84, 0.97];
    const target = cap ? cap * (f0 + r() * (f1 - f0)) : null;
    const spec = fitToCap(id, cap, target);
    const skill = lerp(s0, s1, o.count > 1 ? i / (o.count - 1) : 0.5) * (0.97 + r() * 0.06);
    list.push({
      name: names[i][0],
      short: names[i][1],
      spec,
      color: car.paints[Math.floor(r() * car.paints.length)],
      skill,
      aggression: 0.3 + r() * 0.5,
      lineBias: (r() - 0.5) * 1.2,
    });
  }
  if (o.rival) {
    let spec = buildSpec(o.rival.car, o.rival.upgrades || []);
    if (cap && spec.pp > cap) spec = fitToCap(o.rival.car, cap, cap);
    list.push({ name: RIVAL.name, short: RIVAL.short, spec, color: RIVAL.color, skill: o.rival.skill, aggression: 0.75, lineBias: 0 });
  }
  // Grille : les plus rapides devant
  list.sort((a, b) => b.skill * b.spec.pp - a.skill * a.spec.pp);
  return list;
}

export function gridPosition(ev, profile, nOpp) {
  if (ev.grid === 'qualif') {
    const q = profile.story.done.c5_qualif;
    const m = q?.medal;
    return Math.min(nOpp, m === 'or' ? 0 : m === 'argent' ? 2 : m === 'bronze' ? 4 : nOpp);
  }
  if (ev.grid === 'last') return nOpp;
  return Math.floor(nOpp / 2);
}

// Applique le résultat d'une épreuve de l'histoire. Renvoie un récapitulatif.
export function applyEventResult(profile, ev, result) {
  const prev = profile.story.done[ev.id];
  const firstTime = !prev?.ok;
  let ok = false, credits = 0, medal = null;
  if (ev.type === 'race') {
    const pos = result.position;
    ok = pos <= (ev.goal.position || 1);
    credits = ev.prizes[pos - 1] || 0;
    profile.stats.races++;
    if (pos === 1) profile.stats.wins++;
    if (pos <= 3) profile.stats.podiums++;
  } else if (ev.type === 'timetrial') {
    const t = result.bestLap ?? result.time;
    const tg = eventTargets(ev);
    if (t && tg) medal = t <= tg.gold ? 'or' : t <= tg.silver ? 'argent' : t <= tg.bronze ? 'bronze' : null;
    const need = MEDAL_KEY[ev.goal.medal] || 'bronze';
    ok = !!medal && MEDAL_RANK[medal] >= MEDAL_RANK[need];
    if (medal) credits = ev.prizes[{ or: 'gold', argent: 'silver', bronze: 'bronze' }[medal]] || 0;
  }
  if (!firstTime) credits = Math.round(credits * 0.5 / 100) * 100; // épreuve rejouée
  // Meilleur résultat conservé
  const rec = { ok: ok || !!prev?.ok, position: result.position, time: result.time, best: result.bestLap, medal };
  if (prev) {
    if (prev.position && (!rec.position || prev.position < rec.position)) rec.position = prev.position;
    if (prev.medal && (!medal || MEDAL_RANK[prev.medal] > MEDAL_RANK[medal])) rec.medal = prev.medal;
    if (prev.best && (!rec.best || prev.best < rec.best)) rec.best = prev.best;
  }
  profile.story.done[ev.id] = rec;
  profile.credits += credits;
  profile.stats.earned += credits;
  return { ok, credits, medal, firstTime, newlyCompleted: ok && firstTime };
}

export function applyLicenceResult(profile, test, res) {
  const key = 'test_' + test.id;
  const prev = profile.licences[key];
  if (res.medal && (!prev || MEDAL_RANK[res.medal] > MEDAL_RANK[prev.medal] || (res.medal === prev.medal && res.time < prev.time))) {
    profile.licences[key] = { medal: res.medal, time: res.time };
  }
  // Licence obtenue ?
  const L = LICENCES.find((l) => l.tests.includes(test));
  let gained = null;
  if (L && !profile.licences[L.id + '_ok'] && L.tests.every((t) => profile.licences['test_' + t.id]?.medal)) {
    profile.licences[L.id + '_ok'] = true;
    profile.credits += L.reward;
    gained = L;
    // L'épreuve « licence » du chapitre correspondant est validée
    for (const ch of CHAPTERS) for (const e of ch.events) if (e.type === 'licence' && e.licence === L.id) profile.story.done[e.id] = { ok: true };
  }
  // bonus or
  let bonus = 0;
  if (res.medal === 'or' && (!prev || prev.medal !== 'or')) {
    bonus = 1000;
    profile.credits += bonus;
  }
  return { gained, bonus };
}

export function licenceStatus(profile, L) {
  return L.tests.map((t) => profile.licences['test_' + t.id] || null);
}

// Voiture prêtée pour un permis / une épreuve spéciale
export function providedSpec(carId, upgrades = []) {
  return buildSpec(carId, upgrades);
}

export function dealerCars(profile) {
  const storyDone = profile.story.finished;
  return CARS.filter((c) => !c.storyOnly && (c.category !== 'proto' || storyDone || profile.credits > 1000000));
}

export { CHAPTERS, EVENT_BY_ID, LICENCES, LICENCE_BY_ID };
