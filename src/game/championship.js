// Championnats : définitions (manches, conditions d'accès, récompenses), plateau stable d'une
// manche à l'autre, barème de points façon F1, classement général et sauvegarde dans le profil.
//
// État sauvegardé : profile.championships = {
//   [id du championnat]: {
//     seed: 123456,        // graine du plateau : mêmes adversaires (voitures, livrées) à chaque manche
//     round: 1,            // nombre de manches courues (index de la prochaine manche)
//     points: { player: 43, d0: 25, … },   // points par pilote ('player' = le joueur, 'd0'… = IA)
//     wins: { player: 1, … },              // victoires (départage des ex aequo)
//     results: [ { track: 'autodrome', order: ['d3', 'player', …], player: 2, points: 18, credits: 4000 } ],
//     car: 'c…',           // identifiant (uid) de la voiture engagée à la dernière manche
//     done: false,         // toutes les manches courues
//     final: null,         // position finale du joueur au général (une fois terminé)
//     titles: 0,           // titres remportés (la voiture n'est offerte qu'au premier)
//     best: null,          // meilleure position finale obtenue
//   }
// }
// Un profil sans ce champ est migré par loadProfile (src/core/save.js) et par champState().
import { CAR_BY_ID, CATEGORIES, buildSpec, carLabel } from '../data/cars.js';
import { TRACK_BY_ID } from '../data/tracks.js';
import { buildOpponents, licenceOk, addCar, specOf, currentCar } from './career.js';
import { randomCustom } from '../render/carModel.js';
import { rng } from '../core/utils.js';

export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
// Part de la prime de manche selon la position
const ROUND_PRIZE = [1, 0.7, 0.5, 0.36, 0.26, 0.18, 0.12, 0.08, 0.05, 0.03];

export const WEATHER_LABEL = { sec: 'Sec', pluie: 'Pluie' };

// Manches : track (identifiant du circuit), time (heure), weather ('sec' | 'pluie'), laps.
// Les circuits absents de cette version sont ignorés à l'exécution (voir rounds()).
export const CHAMPIONSHIPS = [
  {
    id: 'ch_sportives',
    name: 'Coupe des sportives',
    desc: 'Petites sportives et compactes affûtées sur trois circuits très différents. Le premier pas vers les championnats.',
    level: 1,
    restrict: { ppMax: 360, categories: ['compacte', 'sport'] },
    licence: null,
    opponents: { count: 9, pool: ['kaze_r3', 'valette_sprint', 'hoshi_civica', 'kaze_86', 'miyabi_rs', 'valette_rallye'], skill: [0.6, 0.8] },
    roundPrize: 3000,
    prize: 15000,
    giftCar: { car: 'kaze_86', color: '#f2f2f0' },
    rounds: [
      { track: 'collines', time: 'day', weather: 'sec', laps: 3 },
      { track: 'portlumiere', time: 'night', weather: 'sec', laps: 3 },
      { track: 'dunes', time: 'afternoon', weather: 'sec', laps: 3 },
      { track: 'corniche', time: 'morning', weather: 'pluie', laps: 3 },
    ],
  },
  {
    id: 'ch_classiques',
    name: 'Trophée classiques',
    desc: 'Chromes, carburateurs et pneus étroits : réservé aux voitures construites avant 1993.',
    level: 2,
    restrict: { ppMax: 420, yearMax: 1992 },
    licence: null,
    opponents: { count: 9, pool: ['marlin_gt', 'vortex_428', 'hoshi_nxr', 'valette_rallye'], skill: [0.62, 0.82] },
    roundPrize: 4500,
    prize: 25000,
    giftCar: { car: 'vortex_428', color: '#1d3b2a' },
    rounds: [
      { track: 'corniche', time: 'sunset', weather: 'sec', laps: 3 },
      { track: 'grunwald', time: 'morning', weather: 'sec', laps: 2 },
      { track: 'collines', time: 'afternoon', weather: 'pluie', laps: 3 },
      { track: 'autodrome', time: 'day', weather: 'sec', laps: 3 },
    ],
  },
  {
    id: 'ch_gt',
    name: 'GT Européen',
    desc: 'Le plateau des grandes routières sportives, des circuits de vitesse aux forêts détrempées.',
    level: 3,
    restrict: { ppMax: 520, categories: ['sport', 'gt'] },
    licence: 'A',
    opponents: { count: 11, pool: ['strauss_m3', 'falco_gtr', 'kaze_sora', 'hoshi_raijin', 'kaze_wrx', 'hoshi_nxr', 'strauss_avant'], skill: [0.66, 0.86] },
    roundPrize: 8000,
    prize: 45000,
    giftCar: { car: 'strauss_avant', color: '#2b3a55' },
    rounds: [
      { track: 'autodrome', time: 'afternoon', weather: 'sec', laps: 3 },
      { track: 'grunwald', time: 'morning', weather: 'pluie', laps: 2 },
      { track: 'corniche', time: 'sunset', weather: 'sec', laps: 3 },
      { track: 'ovale', time: 'day', weather: 'sec', laps: 6 },
      { track: 'collines', time: 'day', weather: 'sec', laps: 3 },
    ],
  },
  {
    id: 'ch_nuit',
    name: 'Endurance nocturne',
    desc: 'Courses longues sous les projecteurs : régularité, gestion du trafic et averses en pleine nuit.',
    level: 4,
    restrict: { ppMax: 700 },
    licence: 'IA',
    opponents: { count: 11, pool: ['stellan_rs', 'vortex_acr', 'falco_gt4', 'strauss_avant', 'strauss_m3'], skill: [0.7, 0.88] },
    roundPrize: 14000,
    prize: 90000,
    giftCar: { car: 'falco_gt4', color: '#0b0d12' },
    rounds: [
      { track: 'portlumiere', time: 'night', weather: 'sec', laps: 5 },
      { track: 'neon', time: 'night', weather: 'sec', laps: 5 },
      { track: 'autodrome', time: 'night', weather: 'pluie', laps: 4 },
      { track: 'glacier', time: 'night', weather: 'sec', laps: 4 },
    ],
  },
  {
    id: 'ch_supercar',
    name: 'Coupe des supercars',
    desc: 'Supercars et GT3 dans les grandes courbes rapides : l\'aspiration y fait la différence.',
    level: 5,
    restrict: { ppMax: 820, categories: ['supercar', 'course', 'gt'] },
    licence: 'S',
    opponents: { count: 13, pool: ['aurelia_tempesta', 'falco_gt3', 'vortex_acr', 'falco_gt4'], skill: [0.74, 0.9] },
    roundPrize: 25000,
    prize: 160000,
    giftCar: { car: 'falco_gt3', color: '#f2f2f0' },
    rounds: [
      { track: 'ovale', time: 'afternoon', weather: 'sec', laps: 8 },
      { track: 'corniche', time: 'day', weather: 'sec', laps: 4 },
      { track: 'dunes', time: 'sunset', weather: 'sec', laps: 3 },
      { track: 'collines', time: 'morning', weather: 'pluie', laps: 4 },
    ],
  },
  {
    id: 'ch_hypercar',
    name: 'Grand Prix Hypercar',
    desc: 'Le sommet : prototypes et hypercars, seize voitures, cinq manches de jour comme de nuit.',
    level: 6,
    restrict: { ppMax: 1200, categories: ['supercar', 'course', 'proto'] },
    licence: 'S',
    opponents: { count: 15, pool: ['aurelia_lmp', 'stellan_962', 'aurelia_veloce'], skill: [0.78, 0.95] },
    roundPrize: 50000,
    prize: 350000,
    giftCar: { car: 'aurelia_lmp', color: '#c8102e' },
    rounds: [
      { track: 'autodrome', time: 'day', weather: 'sec', laps: 4 },
      { track: 'glacier', time: 'morning', weather: 'sec', laps: 3 },
      { track: 'neon', time: 'night', weather: 'pluie', laps: 4 },
      { track: 'ovale', time: 'sunset', weather: 'sec', laps: 10 },
      { track: 'corniche', time: 'night', weather: 'sec', laps: 4 },
    ],
  },
];

export const CHAMPIONSHIP_BY_ID = Object.fromEntries(CHAMPIONSHIPS.map((c) => [c.id, c]));

// Manches jouables dans cette version (circuits existants, tracés fermés)
export function rounds(champ) {
  return champ.rounds.filter((r) => TRACK_BY_ID[r.track] && TRACK_BY_ID[r.track].closed !== false);
}

// État d'un championnat dans le profil (créé au besoin)
export function champState(profile, id) {
  if (!profile.championships || typeof profile.championships !== 'object') profile.championships = {};
  return profile.championships[id] || null;
}

function freshState(prev) {
  return {
    seed: Math.floor(Math.random() * 1e6) + 1,
    round: 0,
    points: {},
    wins: {},
    results: [],
    car: null,
    done: false,
    final: null,
    titles: prev?.titles || 0,
    best: prev?.best ?? null,
  };
}

// Démarre (ou redémarre) un championnat : nouveau plateau, points remis à zéro
export function startChampionship(profile, id) {
  champState(profile, id);
  const st = freshState(profile.championships[id]);
  profile.championships[id] = st;
  return st;
}

// Conditions d'accès lisibles
export function conditionsText(champ) {
  const r = champ.restrict || {};
  const out = [];
  if (r.ppMax) out.push(`PP ≤ ${r.ppMax}`);
  if (r.categories) out.push(r.categories.map((c) => CATEGORIES[c]).join(', '));
  if (r.yearMax) out.push(`Voitures d'avant ${r.yearMax + 1}`);
  if (champ.licence) out.push(`Licence ${champ.licence}`);
  return out;
}

export function champUnlocked(profile, champ) {
  return !champ.licence || licenceOk(profile, champ.licence);
}

// Une voiture du garage peut-elle participer ?
export function champEligibility(champ, spec) {
  const r = champ.restrict || {};
  if (!spec) return { ok: false, reason: 'Aucune voiture' };
  if (r.ppMax && spec.pp > r.ppMax) return { ok: false, reason: `PP trop élevés (${spec.pp} > ${r.ppMax})` };
  if (r.categories && !r.categories.includes(spec.category)) return { ok: false, reason: `Catégorie non autorisée (${CATEGORIES[spec.category]})` };
  if (r.yearMax && (CAR_BY_ID[spec.id]?.year || 2000) > r.yearMax) return { ok: false, reason: `Voiture trop récente (${CAR_BY_ID[spec.id]?.year})` };
  return { ok: true };
}

// Voiture engagée : la voiture actuelle si elle est éligible, sinon la première éligible du garage
export function pickCar(profile, champ) {
  const cur = currentCar(profile);
  if (cur && champEligibility(champ, specOf(cur)).ok) return cur;
  return profile.cars.find((c) => champEligibility(champ, specOf(c)).ok) || cur || null;
}

// Plateau du championnat (identique à chaque manche pour une même graine) : voitures adaptées à
// la limite de PP, livrées tirées au sort et numéros de course distincts et fixes.
export function roster(champ, st) {
  const ev = { id: champ.id, restrict: { ppMax: champ.restrict?.ppMax }, opponents: { ...champ.opponents, fit: [0.86, 0.98] } };
  const list = buildOpponents(ev, st.seed);
  const r = rng(st.seed * 31 + 7);
  const nums = [];
  for (let n = 2; n < 100; n++) nums.push(n);
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  let k = 0;
  for (const o of list) {
    const cu = randomCustom(o.spec, o.seed, o.color);
    if (o.spec.livery || cu.livery?.number != null) cu.livery = { ...(cu.livery || { design: 'racing', sponsors: true }), number: nums[k++ % nums.length] };
    o.custom = cu;
  }
  return list;
}

// Classement général : [{ id, name, short, color, car, points, wins, isPlayer }], trié
export function standings(champ, st, profile, list = roster(champ, st)) {
  const rows = list.map((o) => ({ id: o.id, name: o.name, short: o.short, color: o.color, car: carLabel(o.spec), points: st.points[o.id] || 0, wins: st.wins[o.id] || 0, isPlayer: false }));
  const owned = profile.cars.find((c) => c.uid === st.car) || pickCar(profile, champ);
  rows.push({
    id: 'player', name: profile.name, short: profile.name.slice(0, 3).toUpperCase(), color: owned?.color || '#3d8bff',
    car: owned ? carLabel(buildSpec(owned.id)) : '—', points: st.points.player || 0, wins: st.wins.player || 0, isPlayer: true,
  });
  // Départage : points, victoires, puis meilleure position lors de la dernière manche courue
  const lastOrder = st.results.length ? st.results[st.results.length - 1].order : [];
  rows.sort((a, b) => b.points - a.points || b.wins - a.wins || idx(lastOrder, a.id) - idx(lastOrder, b.id));
  rows.forEach((r, i) => (r.position = i + 1));
  return rows;
}

function idx(order, id) {
  const i = order.indexOf(id);
  return i < 0 ? 999 : i;
}

// Configuration de course de la prochaine manche (à passer à app.startRace)
export function roundConfig(profile, champ, st, owned, onQuit) {
  const rs = rounds(champ);
  const rd = rs[st.round];
  if (!rd || !owned) return null;
  const list = roster(champ, st);
  const spec = specOf(owned);
  // Grille : 1re manche selon le niveau des pilotes, ensuite selon le classement général
  let order = list;
  let playerGrid = Math.floor(list.length * 0.6);
  if (st.round > 0) {
    const table = standings(champ, st, profile, list);
    const byId = Object.fromEntries(list.map((o) => [o.id, o]));
    order = table.filter((r) => !r.isPlayer).map((r) => byId[r.id]);
    playerGrid = table.findIndex((r) => r.isPlayer);
  }
  const n = rs.length;
  return {
    trackId: rd.track,
    time: rd.time,
    weather: rd.weather,
    laps: rd.laps,
    mode: 'race',
    title: `${champ.name} — Manche ${st.round + 1}/${n}`,
    player: { spec, color: owned.color, name: profile.name, short: profile.name.slice(0, 3).toUpperCase(), custom: owned.custom || undefined },
    opponents: order,
    playerGrid,
    championship: { id: champ.id, name: champ.name, round: st.round + 1, rounds: n },
    onQuit,
  };
}

// Enregistre le résultat d'une manche. Renvoie un récapitulatif pour l'écran de résultats.
export function applyRoundResult(profile, champ, result, owned) {
  const st = champState(profile, champ.id);
  const rs = rounds(champ);
  const rd = rs[st.round];
  const before = standings(champ, st, profile).map((r) => r.id);
  const order = result.standings.map((s) => (s.isPlayer ? 'player' : s.id || s.name));
  order.forEach((id, i) => {
    st.points[id] = (st.points[id] || 0) + (POINTS[i] || 0);
    if (i === 0) st.wins[id] = (st.wins[id] || 0) + 1;
  });
  const pos = order.indexOf('player') + 1;
  const credits = Math.round(((champ.roundPrize || 0) * (ROUND_PRIZE[pos - 1] || 0)) / 100) * 100;
  st.results.push({ track: rd?.track, order, player: pos, points: POINTS[pos - 1] || 0, credits });
  st.round++;
  st.car = owned?.uid || st.car;
  profile.credits += credits;
  profile.stats.races++;
  profile.stats.earned += credits;
  if (pos === 1) profile.stats.wins++;
  if (pos <= 3) profile.stats.podiums++;
  const table = standings(champ, st, profile);
  const me = table.find((r) => r.isPlayer);
  const out = { position: pos, points: POINTS[pos - 1] || 0, credits, standing: me.position, before, finished: false, title: false, prize: 0, giftCar: null };
  if (st.round >= rs.length) {
    st.done = true;
    st.final = me.position;
    if (st.best === null || me.position < st.best) st.best = me.position;
    out.finished = true;
    if (me.position === 1) {
      out.title = true;
      const first = !st.titles;
      st.titles = (st.titles || 0) + 1;
      out.prize = first ? champ.prize : Math.round((champ.prize * 0.3) / 100) * 100;
      profile.credits += out.prize;
      profile.stats.earned += out.prize;
      if (first && champ.giftCar && CAR_BY_ID[champ.giftCar.car]) {
        addCar(profile, champ.giftCar.car, champ.giftCar.color);
        out.giftCar = champ.giftCar.car;
      }
    } else if (me.position <= 3) {
      // podium au général : petite prime
      out.prize = Math.round((champ.prize * (me.position === 2 ? 0.25 : 0.12)) / 100) * 100;
      profile.credits += out.prize;
      profile.stats.earned += out.prize;
    }
  }
  return out;
}

// Résumé d'état pour la liste
export function statusText(profile, champ) {
  const st = champState(profile, champ.id);
  const n = rounds(champ).length;
  if (!st) return 'Non commencé';
  if (st.done) return st.final === 1 ? 'Champion !' : `Terminé · ${st.final}e au général`;
  if (st.round === 0) return 'Inscrit · manche 1 à courir';
  const me = standings(champ, st, profile).find((r) => r.isPlayer);
  return `Manche ${st.round + 1}/${n} · ${me.position}e au général (${me.points} pts)`;
}
