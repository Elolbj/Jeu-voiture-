// Vérifie la cohérence du mode histoire : circuits, voitures, limites de PP, dépendances,
// dialogues et personnages référencés, temps cibles, chapitres réalisables.
// Usage : node tools/story-check.mjs  (code de sortie 1 en cas d'erreur)
import { CHAPTERS, DIALOGS, REACTIONS, CHARACTERS, LICENCE_BY_ID, FREE_SERIES, EVENT_BY_ID } from '../src/data/story.js';
import { CAR_BY_ID, CARS, buildSpec, UPGRADE_BY_ID } from '../src/data/cars.js';
import { TRACK_BY_ID } from '../src/data/tracks.js';
import { TARGETS } from '../src/data/targets.js';

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);
const carOk = (id, where) => CAR_BY_ID[id] || err(`${where} : voiture inconnue ${id}`);
const upsOk = (ups = [], where) => ups.forEach((u) => UPGRADE_BY_ID[u] || err(`${where} : amélioration inconnue ${u}`));
const dlgOk = (id, where) => !id || DIALOGS[id] || err(`${where} : dialogue inconnu ${id}`);

// Dialogues : personnages connus, choix bien formés
const checkLines = (lines, where) => {
  for (const l of lines) {
    if (l.choice) {
      if (!l.choice.length) err(`${where} : choix vide`);
      for (const c of l.choice) checkLines(c.next || [], where);
    } else {
      if (!CHARACTERS[l.who]) err(`${where} : personnage inconnu ${l.who}`);
      if (!l.text) err(`${where} : réplique vide`);
      for (const m of l.text.matchAll(/\{(\w+)\}/g)) if (!['nom', 'voiture', 'suivante', 'position'].includes(m[1])) err(`${where} : variable inconnue {${m[1]}}`);
    }
  }
};
for (const [id, lines] of Object.entries(DIALOGS)) checkLines(lines, `dialogue ${id}`);
REACTIONS.forEach((r, i) => checkLines(r.lines, `réaction ${i} (${r.kind})`));

// Voitures achetables (hors histoire) et leur PP de base
const buyable = CARS.filter((c) => !c.storyOnly).map((c) => ({ id: c.id, pp: buildSpec(c.id).pp, price: c.price }));
const used = new Set();
const ids = new Set();
let gifted = new Set(['kaze_r3']);

for (const ch of CHAPTERS) {
  const where0 = `chapitre ${ch.id} (${ch.key})`;
  if (CHAPTERS.indexOf(ch) !== ch.id) err(`${where0} : id ≠ rang`);
  if (!TRACK_BY_ID[ch.track]) err(`${where0} : circuit inconnu ${ch.track}`);
  dlgOk(ch.intro, where0);
  dlgOk(ch.outro, where0);
  if (ch.giftCar) { carOk(ch.giftCar.car, where0); gifted.add(ch.giftCar.car); }
  if (ch.reward?.car) { carOk(ch.reward.car.car, where0); upsOk(ch.reward.car.upgrades, where0); }
  if (ch.id > 0 && (ch.events.length < 3 || ch.events.length > 5)) warn(`${where0} : ${ch.events.length} épreuves`);
  const local = new Set(ch.events.map((e) => e.id));
  for (const e of ch.events) {
    const w = `${e.id}`;
    if (ids.has(e.id)) err(`${w} : identifiant en double`);
    ids.add(e.id);
    dlgOk(e.before, w); dlgOk(e.after, w); dlgOk(e.fail, w);
    for (const r of e.requires || []) {
      if (!local.has(r)) err(`${w} : requires ${r} hors du chapitre`);
      if (r === e.id) err(`${w} : dépend de lui-même`);
    }
    if (e.type === 'licence') {
      if (!LICENCE_BY_ID[e.licence]) err(`${w} : licence inconnue ${e.licence}`);
      continue;
    }
    const tr = TRACK_BY_ID[e.track];
    if (!tr) { err(`${w} : circuit inconnu ${e.track}`); continue; }
    used.add(e.track);
    if (tr.closed === false && e.laps !== 1) err(`${w} : tracé ouvert, laps doit valoir 1`);
    if (tr.closed === false && e.type === 'race' && (e.opponents?.count || 0) > 6) warn(`${w} : peloton nombreux sur route étroite`);
    if (e.weather && !['sec', 'pluie'].includes(e.weather)) err(`${w} : météo inconnue ${e.weather}`);
    if (e.time && !['day', 'morning', 'afternoon', 'sunset', 'night'].includes(e.time)) err(`${w} : heure inconnue ${e.time}`);
    if (e.provided) { carOk(e.provided.car, w); upsOk(e.provided.upgrades, w); if (!e.provided.color) err(`${w} : couleur de la voiture prêtée manquante`); }
    const cap = e.restrict?.ppMax;
    if (e.restrict?.carId) {
      carOk(e.restrict.carId, w);
      if (!gifted.has(e.restrict.carId) && CAR_BY_ID[e.restrict.carId]?.storyOnly) err(`${w} : voiture imposée ${e.restrict.carId} non encore offerte`);
    }
    // Le joueur doit pouvoir engager une voiture : prêtée, imposée (offerte) ou achetable sous la limite
    if (!e.provided && !e.restrict?.carId && cap && !buyable.some((c) => c.pp <= cap)) err(`${w} : aucune voiture achetable sous ${cap} PP`);
    if (e.type === 'race') {
      const o = e.opponents || {};
      for (const id of o.pool || []) {
        if (!carOk(id, w)) continue;
        const pp = buildSpec(id).pp;
        if (cap && pp > cap) err(`${w} : ${id} (${pp} PP) dépasse la limite ${cap}`);
      }
      if (o.count && !(o.pool || []).length) err(`${w} : plateau sans voitures`);
      if (o.rival) { carOk(o.rival.car, w); upsOk(o.rival.upgrades, w); }
      const n = (o.count || 0) + (o.rival ? 1 : 0) + 1;
      if (!e.goal?.position || e.goal.position > n) err(`${w} : objectif de position impossible (${e.goal?.position} / ${n})`);
      if (!e.prizes || e.prizes.length < Math.min(n, 10)) warn(`${w} : ${e.prizes?.length} primes pour ${n} pilotes`);
      if (e.grid === 'qualif' && !EVENT_BY_ID[e.qualif || 'c5_qualif']) err(`${w} : qualification inconnue`);
      if (!e.laps) err(`${w} : nombre de tours manquant`);
    } else if (e.type === 'timetrial') {
      if (!TARGETS.events[e.id]) err(`${w} : temps cibles absents (lancer node tools/compute-targets.mjs)`);
      if (!e.ref) err(`${w} : voiture de référence manquante`);
      else carOk(e.ref, w);
      upsOk(e.refUpgrades, w);
      if (tr.closed !== false && e.laps < 2) err(`${w} : contre-la-montre en circuit fermé : 2 tours minimum (tour lancé)`);
      if (!e.goal?.medal) err(`${w} : objectif de médaille manquant`);
      // référence cohérente avec la limite de PP
      const refPP = buildSpec(e.ref, e.refUpgrades || []).pp;
      if (cap && refPP > cap) err(`${w} : référence ${e.ref} (${refPP} PP) au-dessus de la limite ${cap}`);
    } else err(`${w} : type inconnu ${e.type}`);
  }
  // Ordre de déblocage : toutes les épreuves atteignables (pas de cycle)
  const done = new Set();
  let progress = true;
  while (progress) {
    progress = false;
    for (const e of ch.events) if (!done.has(e.id) && (e.requires || []).every((r) => done.has(r))) { done.add(e.id); progress = true; }
  }
  if (done.size !== ch.events.length) err(`${where0} : épreuves inaccessibles (${ch.events.filter((e) => !done.has(e.id)).map((e) => e.id).join(', ')})`);
  if (ch.reward?.car) gifted.add(ch.reward.car.car);
}

for (const s of FREE_SERIES) for (const id of s.pool) if (carOk(id, s.id) && buildSpec(id).pp > s.ppMax) err(`${s.id} : ${id} dépasse ${s.ppMax} PP`);
for (const t of Object.keys(TRACK_BY_ID)) if (!used.has(t)) warn(`circuit ${t} absent de l'histoire`);

// Bilan économique indicatif (gains maximaux à la première réussite)
let total = 8000;
const eco = [];
for (const ch of CHAPTERS) {
  let sum = (ch.bonus || 0) + (ch.reward?.credits || 0);
  for (const e of ch.events) {
    if (e.type === 'race') sum += e.prizes[0];
    else if (e.type === 'timetrial') sum += e.prizes.gold;
    else if (e.type === 'licence') sum += LICENCE_BY_ID[e.licence].reward + 3000;
  }
  total += sum;
  const caps = ch.events.map((e) => e.restrict?.ppMax).filter(Boolean);
  eco.push(`${String(ch.id).padStart(2)} ${ch.name.padEnd(26)} ${ch.events.length} ép. · PP ${caps.length ? Math.min(...caps) + '-' + Math.max(...caps) : '—'.padEnd(7)} · gains max ${String(sum).padStart(7)} · cumul ${String(total).padStart(8)}`);
}
console.log(eco.join('\n'));
console.log(`${ids.size} épreuves, ${Object.keys(DIALOGS).length} dialogues, ${REACTIONS.length} réactions`);
if (warns.length) console.log('Avertissements :\n  ' + warns.join('\n  '));
if (errors.length) {
  console.log('ERREURS :\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log('Histoire cohérente.');
