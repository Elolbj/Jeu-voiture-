// Catalogue de l'atelier de personnalisation : teintes proposées, finitions, motifs de livrée, jantes, ailerons,
// contraintes par voiture (classiques et voitures de course) et prix des modifications (aperçu gratuit).
import { resolveStyle } from '../render/carStyles.js';
import { clamp } from '../core/utils.js';

export const PAINT_COLORS = [
  ['#c8102e', 'Rouge course'], ['#8a1538', 'Bordeaux'], ['#e05a00', 'Orange'], ['#f2b705', 'Jaune'],
  ['#e3b505', 'Or'], ['#7fb800', 'Vert acide'], ['#1f5f3a', 'Vert anglais'], ['#00a3e0', 'Bleu ciel'],
  ['#1d3f8f', 'Bleu roi'], ['#0b2e6b', 'Bleu nuit'], ['#5b2a86', 'Violet'], ['#f2f2ee', 'Blanc'],
  ['#c9ccd1', 'Argent'], ['#6b7078', 'Gris titane'], ['#202326', 'Noir'], ['#b9a06a', 'Champagne'],
];
export const ACCENT_COLORS = ['#f4f5f2', '#111418', '#d4001a', '#ffcc00', '#00a3e0', '#ff6a00', '#2ee59d', '#0b2e6b', '#c9ccd1', '#8a1538'];
export const RIM_COLORS = ['#c9ccd1', '#e2e4e8', '#8d9096', '#3b3e45', '#2a2c30', '#1b1c1f', '#b9a06a', '#d4a017', '#c8102e', '#f4f5f2'];
export const CALIPER_COLORS = ['#c8102e', '#d4a017', '#e05a00', '#2453a4', '#2ee59d', '#1b1c1f', '#9a9da3', '#3a3c40', '#f4f5f2'];
export const PEARL_TINTS = ['#c9e4ff', '#ffd6f0', '#d8ffd6', '#fff1c4', '#e0d0ff'];

export const FINISHES = {
  gloss: { label: 'Vernie', price: 0 },
  metallic: { label: 'Métallisée', price: 600 },
  pearl: { label: 'Nacrée', price: 1500 },
  satin: { label: 'Satinée', price: 1200 },
  matte: { label: 'Mate', price: 1800 },
  chrome: { label: 'Chromée', price: 6000 },
};
export const LIVERIES = {
  none: { label: 'Aucune', price: 0 },
  stripes: { label: 'Double bande', price: 900 },
  side: { label: 'Filets latéraux', price: 700 },
  racing: { label: 'Livrée course', price: 2600 },
  split: { label: 'Bicolore', price: 1600 },
  gradient: { label: 'Dégradé', price: 2000 },
  chevron: { label: 'Chevrons', price: 1800 },
  retro: { label: 'Rétro', price: 1500 },
};
export const RIMS = {
  five: { label: 'Cinq branches', price: 1400 },
  six: { label: 'Six branches', price: 1500 },
  ten: { label: 'Dix rayons', price: 1600 },
  split: { label: 'Branches doubles', price: 1900 },
  mesh: { label: 'Croisillons', price: 2100 },
  race: { label: 'Monobloc course', price: 2800 },
  turbine: { label: 'Turbine', price: 1800 },
  classic: { label: 'Classique', price: 1300 },
  multi: { label: 'Multirayons', price: 2000 },
};
export const RIM_FINISHES = {
  gloss: { label: 'Brillante', price: 0 },
  matte: { label: 'Mate', price: 300 },
  chrome: { label: 'Chromée', price: 1400 },
};
export const WINGS = {
  stock: { label: 'D\'origine', price: 0 },
  none: { label: 'Sans aileron', price: 300 },
  lip: { label: 'Becquet', price: 900 },
  duck: { label: 'Queue de canard', price: 1300 },
  gt: { label: 'Aileron GT', price: 3800 },
};
export const PRICES = { paint: 800, liveryOff: 250, number: 300, sponsors: 600, rimPaint: 450, caliper: 350, tint: 400, plate: 150 };

// Les prix suivent la gamme de la voiture (comme le préparateur)
export const priceScale = (spec) => clamp((spec.price || 30000) / 30000, 0.6, 2.5);
const scaled = (spec, p) => Math.round((p * priceScale(spec)) / 50) * 50;

// Contraintes reprises de randomCustom (carModel.js) : jamais d'aileron sur une classique ni sur une
// voiture de course (aéro homologuée) ; becquets seulement sur les compactes et les supercars.
export function carTraits(spec) {
  const st = resolveStyle(spec);
  return { race: !!spec.livery || !!st.race, classic: st.bumpers === 'chrome' || (spec.year || 2000) < 1975, style: st };
}

export function wingChoices(spec) {
  const t = carTraits(spec);
  if (t.race || t.classic) return { list: ['stock'], reason: t.race ? 'Aérodynamique homologuée : aileron non modifiable.' : 'Voiture classique : aucun aileron proposé.' };
  const cat = spec.category;
  const list = cat === 'compacte' ? ['stock', 'lip', 'duck'] : cat === 'supercar' ? ['stock', 'lip'] : ['stock', 'lip', 'duck', 'gt'];
  // retirer l'aileron d'origine n'a de sens que s'il y en a un
  if (t.style.spoiler && t.style.spoiler !== 'none') list.splice(1, 0, 'none');
  return { list, reason: null };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Coût d'une personnalisation par rapport à l'état enregistré (revenir à l'état d'avant est gratuit)
export function customCost(spec, before, after) {
  const lines = [];
  const add = (label, p) => lines.push({ label, price: scaled(spec, p) });
  const pa = after.paint, pb = before.paint;
  if (pa.color !== pb.color || pa.finish !== pb.finish || (pa.finish === 'pearl' && pa.pearl !== pb.pearl)) {
    add(`Peinture ${FINISHES[pa.finish]?.label.toLowerCase() || ''}`, PRICES.paint + (FINISHES[pa.finish]?.price || 0));
  }
  const la = after.livery, lb = before.livery;
  if (!same(la, lb)) {
    const onA = la && la.design !== 'none', onB = lb && lb.design !== 'none';
    if (onA && (!onB || la.design !== lb.design || la.color !== lb.color || la.color2 !== lb.color2)) add(`Livrée « ${LIVERIES[la.design].label} »`, LIVERIES[la.design].price);
    else if (!onA && onB) add('Retrait de la livrée', PRICES.liveryOff);
    if (la?.number !== null && la?.number !== undefined && la.number !== lb?.number) add(`Numéro ${la.number}`, PRICES.number);
    if (la?.sponsors && !lb?.sponsors) add('Autocollants sponsors', PRICES.sponsors);
  }
  const ra = after.rims, rb = before.rims;
  if (ra.style !== rb.style) add(`Jantes ${RIMS[ra.style].label.toLowerCase()}`, RIMS[ra.style].price + RIM_FINISHES[ra.finish].price);
  else if (ra.color !== rb.color || ra.finish !== rb.finish) add(`Jantes ${RIM_FINISHES[ra.finish].label.toLowerCase()}s`, PRICES.rimPaint + RIM_FINISHES[ra.finish].price);
  if (after.caliper !== before.caliper) add('Étriers de frein', PRICES.caliper);
  if (after.tint !== before.tint) add('Teinte des vitres', PRICES.tint);
  if (after.wing !== before.wing) add(WINGS[after.wing].label, WINGS[after.wing].price);
  if (after.plate !== before.plate) add('Plaque d\'immatriculation', PRICES.plate);
  return { lines, total: lines.reduce((s, l) => s + l.price, 0) };
}

// Plaque aléatoire au format de la maison (AB-123-CD)
export function randomPlate() {
  const L = 'ABCDEFGHJKLMNPRSTVWXYZ';
  const r = (n) => Math.floor(Math.random() * n);
  return `${L[r(22)]}${L[r(22)]}-${100 + r(900)}-${L[r(22)]}${L[r(22)]}`;
}
