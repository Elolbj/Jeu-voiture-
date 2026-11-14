// Réglages mécaniques (gratuits) : pont, freins, aéro, suspensions, hauteur, différentiel.
// Chaque champ ne touche qu'une donnée réellement lue par la physique (src/physics/vehicle.js).
// Sauvegarde relative à la voiture préparée (owned.setup) : 'mul' → rapport à la valeur d'origine,
// 'add' → écart ; un champ absent (ou neutre) laisse la spécification strictement identique.
// Pas de carrossage ni de pression des pneus : le modèle de pneu ne les simule pas.
import { computePP } from './cars.js';
import { clamp } from '../core/utils.js';

const RHO = 1.225, G = 9.81, DRIVER_MASS = 75;
// seuil de vehicle.js : au-delà, débattement « course » (on ne le franchit pas avec un réglage)
const RACE_FREQ = 2.6;

const num = (v, d = 0) => v.toFixed(d).replace('.', ',');
const signed = (v, d = 0) => (v > 0 ? '+' : v < 0 ? '−' : '±') + num(Math.abs(v), d);

// Raideur à la roue (N/m) d'un ressort de fréquence f, comme dans vehicle.js
function wheelRate(s, f, front) {
  const corner = ((s.mass + DRIVER_MASS) * (front ? s.weightFront : 1 - s.weightFront)) / 2;
  return Math.pow(2 * Math.PI * f, 2) * corner * 0.9;
}
function cornerMass(s, front) {
  return ((s.mass + DRIVER_MASS) * (front ? s.weightFront : 1 - s.weightFront)) / 2;
}
// Appui en kg à 200 km/h pour un coefficient donné (vehicle.js : 0,5·ρ·Cl·v²)
const downKg = (cl) => (0.5 * RHO * cl * (200 / 3.6) ** 2) / G;
// Vitesse au rupteur sur le dernier rapport
function gearTop(s, final) {
  const g = s.gearbox.ratios[s.gearbox.ratios.length - 1];
  return (s.engine.limiter * Math.PI / 30) * s.wheel.radius / (g * final) * 3.6;
}

// Voiture dotée d'un aileron réglable : kit aéro installé ou appui d'origine significatif
export const hasAero = (s) => !!s.aeroKit || s.aero.clF + s.aero.clR >= 0.4;
const aeroSpan = (b) => {
  const d = Math.max(0.12, b * 0.28);
  return [Math.max(0, b - d), b + d];
};

// Champs : base(spec) = valeur d'origine ; range(base, spec) = bornes absolues ; set(spec, v, base) écrit la valeur.
export const SETUP_FIELDS = [
  {
    id: 'final', group: 'Transmission', label: 'Rapport de pont', mode: 'mul', step: 0.01,
    base: (s) => s.gearbox.final,
    range: (b) => [b * 0.85, b * 1.15],
    set: (s, v) => { s.gearbox.final = v; },
    fmt: (v, s) => `${num(v, 2)} : 1`,
    info: (v, s) => `Rupteur en ${s.gearbox.ratios.length}e à ${Math.round(gearTop(s, v))} km/h`,
    hint: 'Court : reprises vives. Long : vitesse de pointe.',
    ends: ['Long', 'Court'],
  },
  {
    id: 'brakeBias', group: 'Freinage', label: 'Répartition du freinage', mode: 'add', step: 0.01,
    base: (s) => s.brakeBias,
    range: (b) => [Math.max(0.45, b - 0.12), Math.min(0.8, b + 0.1)],
    set: (s, v) => { s.brakeBias = v; },
    fmt: (v) => `${Math.round(v * 100)} % AV · ${100 - Math.round(v * 100)} % AR`,
    hint: 'Vers l\'arrière : la voiture pivote au freinage, mais peut se dérober.',
    ends: ['Arrière', 'Avant'],
  },
  {
    id: 'aeroF', group: 'Aérodynamique', label: 'Appui avant', mode: 'add', step: 0.01, visible: hasAero,
    base: (s) => s.aero.clF,
    range: aeroSpan,
    set: (s, v, b) => { s.aero.cd = Math.max(0.2, s.aero.cd + 0.035 * (v - b)); s.aero.clF = v; },
    fmt: (v) => `${Math.round(downKg(v))} kg à 200 km/h`,
    info: (v) => `Cz ${num(v, 2)}`,
    hint: 'Plus d\'appui avant : meilleure direction en courbe rapide.',
    ends: ['Faible', 'Fort'],
  },
  {
    id: 'aeroR', group: 'Aérodynamique', label: 'Appui arrière', mode: 'add', step: 0.01, visible: hasAero,
    base: (s) => s.aero.clR,
    range: aeroSpan,
    set: (s, v, b) => { s.aero.cd = Math.max(0.2, s.aero.cd + 0.05 * (v - b)); s.aero.clR = v; },
    fmt: (v) => `${Math.round(downKg(v))} kg à 200 km/h`,
    info: (v, s) => `Cz ${num(v, 2)} · Cx ${num(s.aero.cd, 3)}`,
    hint: 'Plus d\'appui arrière : stabilité, au prix de la traînée.',
    ends: ['Faible', 'Fort'],
  },
  {
    id: 'springF', group: 'Suspensions', label: 'Ressorts avant', mode: 'mul', step: 0.05,
    base: (s) => s.susp.freqF,
    range: (b) => (b < RACE_FREQ ? [b * 0.8, Math.min(RACE_FREQ - 0.01, b * 1.35)] : [Math.max(RACE_FREQ, b * 0.8), b * 1.35]),
    set: (s, v) => { s.susp.freqF = v; },
    fmt: (v, s) => `${Math.round(wheelRate(s, v, true) / 1000)} N/mm`,
    info: (v) => `${num(v, 2)} Hz`,
    hint: 'Raide : réactions vives, moins de roulis ; souple : plus de motricité sur les bosses.',
    ends: ['Souple', 'Raide'],
  },
  {
    id: 'springR', group: 'Suspensions', label: 'Ressorts arrière', mode: 'mul', step: 0.05,
    base: (s) => s.susp.freqR,
    range: (b) => [b * 0.8, b * 1.35],
    set: (s, v) => { s.susp.freqR = v; },
    fmt: (v, s) => `${Math.round(wheelRate(s, v, false) / 1000)} N/mm`,
    info: (v) => `${num(v, 2)} Hz`,
    ends: ['Souple', 'Raide'],
  },
  {
    id: 'damp', group: 'Suspensions', label: 'Amortisseurs', mode: 'mul', step: 0.01,
    base: (s) => s.susp.zeta,
    range: (b) => [b * 0.7, Math.min(0.85, b * 1.45)],
    set: (s, v) => { s.susp.zeta = v; },
    fmt: (v, s) => {
      const k = wheelRate(s, s.susp.freqF, true), m = cornerMass(s, true) * 0.9;
      return `${num((2 * v * Math.sqrt(k * m)) / 1000, 1)} kN·s/m (av.)`;
    },
    info: (v) => `${Math.round(v * 100)} % de l'amortissement critique`,
    hint: 'Contrôle des mouvements de caisse (avant et arrière).',
    ends: ['Souples', 'Fermes'],
  },
  {
    id: 'arbF', group: 'Barres antiroulis', label: 'Barre avant', mode: 'mul', step: 0.05,
    base: (s) => s.susp.arbF,
    range: (b) => [b * 0.3, b * 2.2],
    set: (s, v) => { s.susp.arbF = v; },
    fmt: (v, s) => `${Math.round((v * wheelRate(s, s.susp.freqF, true)) / 1000)} N/mm`,
    hint: 'Durcir l\'avant accentue le sous-virage.',
    ends: ['Souple', 'Raide'],
  },
  {
    id: 'arbR', group: 'Barres antiroulis', label: 'Barre arrière', mode: 'mul', step: 0.05,
    base: (s) => s.susp.arbR,
    range: (b) => [b * 0.3, b * 2.2],
    set: (s, v) => { s.susp.arbR = v; },
    fmt: (v, s) => `${Math.round((v * wheelRate(s, s.susp.freqR, false)) / 1000)} N/mm`,
    hint: 'Durcir l\'arrière accentue le survirage.',
    ends: ['Souple', 'Raide'],
  },
  {
    // abaissement (m) : positif = caisse plus basse (centre de gravité abaissé d'autant)
    id: 'ride', group: 'Châssis', label: 'Hauteur de caisse', mode: 'add', step: 0.005, invert: true,
    base: (s) => s.lowered || 0,
    range: (b) => [b - 0.03, b + 0.015],
    set: (s, v) => { s.lowered = v; },
    fmt: (v) => `${signed(-v * 1000)} mm`,
    info: (v, s) => `Centre de gravité à ${Math.round((s.cgHeight - v) * 1000)} mm`,
    hint: 'Plus bas : moins de transfert de charge.',
    ends: ['Basse', 'Haute'],
  },
  {
    id: 'lsd', group: 'Différentiel', label: 'Tarage de l\'autobloquant', mode: 'add', step: 5, visible: (s) => s.lsd > 0,
    base: (s) => s.lsd,
    range: () => [10, 100],
    set: (s, v) => { s.lsd = v; },
    fmt: (v) => `${Math.round(v)} %`,
    info: (v) => `Blocage ${Math.round((v / 100) * 60 + 12)} N·m + ${num(v / 200, 2)} × couple`,
    hint: 'Fort : motricité en sortie de virage ; faible : la voiture s\'inscrit mieux.',
    ends: ['Libre', 'Bloqué'],
  },
];

export const SETUP_BY_ID = Object.fromEntries(SETUP_FIELDS.map((f) => [f.id, f]));
export const SETUP_GROUPS = [...new Set(SETUP_FIELDS.map((f) => f.group))];

// Champs proposés pour cette voiture (spec : voiture préparée, avant réglages)
export function setupFields(spec) {
  return SETUP_FIELDS.filter((f) => (!f.visible || f.visible(spec)) && !(f.mode === 'mul' && !(f.base(spec) > 0)));
}

const neutral = (f) => (f.mode === 'mul' ? 1 : 0);

// Bornes absolues (toujours encadrant la valeur d'origine)
export function fieldRange(f, spec) {
  const b = f.base(spec);
  const [lo, hi] = f.range(b, spec);
  return [Math.min(lo, b), Math.max(hi, b)];
}

// Valeur absolue (unités physiques) d'un champ selon le réglage enregistré
export function fieldValue(f, spec, setup) {
  const b = f.base(spec);
  const r = setup?.[f.id];
  if (typeof r !== 'number' || !isFinite(r) || r === neutral(f)) return b;
  const [lo, hi] = fieldRange(f, spec);
  return clamp(f.mode === 'mul' ? b * r : b + r, lo, hi);
}

// Valeur à enregistrer pour une valeur absolue (neutre si égale à l'origine)
export function storeValue(f, spec, v) {
  const b = f.base(spec);
  if (Math.abs(v - b) < 1e-9) return neutral(f);
  return Math.round((f.mode === 'mul' ? v / b : v - b) * 1e4) / 1e4;
}

// Réglage d'origine : tous les champs proposés à leur valeur neutre
export function defaultSetup(spec) {
  return Object.fromEntries(setupFields(spec).map((f) => [f.id, neutral(f)]));
}

// Nombre de champs modifiés
export function setupChanges(setup) {
  if (!setup) return 0;
  return Object.entries(setup).filter(([k, v]) => SETUP_BY_ID[k] && typeof v === 'number' && v !== neutral(SETUP_BY_ID[k])).length;
}

// Applique un réglage à une spécification issue de buildSpec (modifiée et renvoyée).
// Réglage absent ou neutre : la spécification est renvoyée telle quelle, sans aucune modification.
export function applySetup(spec, setup) {
  if (!setup || !setupChanges(setup)) return spec;
  const todo = [];
  for (const f of setupFields(spec)) {
    const r = setup[f.id];
    if (typeof r !== 'number' || !isFinite(r) || r === neutral(f)) continue;
    todo.push([f, fieldValue(f, spec, setup), f.base(spec)]);
  }
  if (!todo.length) return spec;
  for (const [f, v, b] of todo) f.set(spec, v, b);
  spec.pp = computePP(spec);
  return spec;
}
