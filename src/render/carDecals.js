// Décalques projetés sur la caisse : optiques (boîtiers, réflecteurs, projecteurs, feux à LED, clignotants),
// calandres, prises d'air, logos, plaques, poignées, grille d'auvent ; points d'ancrage des échappements.
// Tout est regroupé par matériau (un seul objet par matériau et par voiture).
import * as THREE from 'three';
import { lerp } from '../core/utils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SurfaceProjector, decalGeometry, mirrorGeometry } from './carBody.js';
import { brandCell, TOW_CELL } from './carTextures.js';

// clé d'élément → [matériau, couleur de sommet]
const KEYMAP = {
  house: ['lp', [0.035, 0.04, 0.046]],
  chrome: ['lp', [0.9, 0.91, 0.93]],
  amber: ['lp', [1.0, 0.4, 0.03]],
  red: ['lp', [0.36, 0.012, 0.018]],
  smoke: ['lp', [0.08, 0.012, 0.016]],
  white: ['lp', [0.84, 0.85, 0.88]],
  lens: ['lens'], drl: ['drl'], led: ['led'],
  grille: ['grille'], grille2: ['grille2'],
  vent: ['blk', [0.016, 0.016, 0.018]], trim: ['blk', [0.045, 0.046, 0.05]], blk: ['blk', [0.028, 0.028, 0.031]],
  plate: ['plate'], badge: ['badge'],
};

// Optiques avant : [clé, fx (fraction de la demi-largeur), fy (fraction de la face avant), a, b (demi-axes, m), options]
// Les couches successives sont décollées un peu plus (off) pour s'empiler.
const L1 = 0.0052, L2 = 0.0066, L3 = 0.0078;
export const HEAD = {
  // années 90 : blocs rectangulaires à deux réflecteurs ronds, clignotant d'angle
  round: [
    ['house', 0.68, 0.74, 0.17, 0.08, { n: 4, yaw: 0.3 }],
    ['chrome', 0.74, 0.745, 0.07, 0.062, { n: 2.2, yaw: 0.3, off: L1 }],
    ['chrome', 0.58, 0.745, 0.055, 0.05, { n: 2.2, yaw: 0.3, off: L1 }],
    ['lens', 0.74, 0.745, 0.036, 0.036, { yaw: 0.3, off: L2 }],
    ['lens', 0.58, 0.745, 0.026, 0.026, { yaw: 0.3, off: L2 }],
    ['amber', 0.9, 0.74, 0.04, 0.06, { n: 4, yaw: 0.7, off: L1 }],
  ],
  twinround: [
    ['house', 0.62, 0.8, 0.17, 0.075, { n: 2.4, rot: 0.12, yaw: 0.25 }],
    ['chrome', 0.72, 0.82, 0.058, 0.058, { yaw: 0.25, off: L1 }], ['chrome', 0.53, 0.79, 0.058, 0.058, { yaw: 0.25, off: L1 }],
    ['lens', 0.72, 0.82, 0.034, 0.034, { yaw: 0.25, off: L2 }], ['lens', 0.53, 0.79, 0.034, 0.034, { yaw: 0.25, off: L2 }],
  ],
  // ovales inclinés (roadster, coupé des années 90)
  oval: [
    ['house', 0.66, 0.76, 0.18, 0.075, { n: 2.3, rot: 0.16, yaw: 0.35 }],
    ['chrome', 0.69, 0.765, 0.13, 0.056, { n: 2.3, rot: 0.16, yaw: 0.35, off: L1 }],
    ['lens', 0.74, 0.775, 0.042, 0.038, { yaw: 0.35, off: L2 }],
    ['lens', 0.6, 0.75, 0.03, 0.028, { yaw: 0.35, off: L2 }],
    ['amber', 0.88, 0.74, 0.04, 0.026, { n: 2.4, rot: 0.16, yaw: 0.6, off: L2 }],
  ],
  // phares effilés modernes : boîtier en coin, deux projecteurs, signature LED
  slim: [
    ['house', 0.72, 0.8, 0.25, 0.072, { n: 3.2, rot: 0.12, taper: -0.45, yaw: 0.4 }],
    ['chrome', 0.8, 0.83, 0.07, 0.046, { n: 2.6, yaw: 0.4, off: L1 }],
    ['chrome', 0.64, 0.8, 0.06, 0.04, { n: 2.6, yaw: 0.4, off: L1 }],
    ['lens', 0.8, 0.83, 0.034, 0.032, { yaw: 0.4, off: L2 }],
    ['lens', 0.64, 0.8, 0.029, 0.027, { yaw: 0.4, off: L2 }],
    ['drl', 0.71, 0.745, 0.22, 0.009, { n: 4, rot: 0.12, yaw: 0.4, off: L3 }],
    ['amber', 0.93, 0.8, 0.04, 0.02, { n: 4, rot: 0.12, yaw: 0.55, off: L2 }],
  ],
  // berline allemande : doubles phares ronds à anneaux lumineux
  twin: [
    ['house', 0.66, 0.76, 0.21, 0.068, { n: 4.5, taper: -0.15, yaw: 0.35 }],
    ['chrome', 0.76, 0.765, 0.058, 0.058, { yaw: 0.35, off: L1 }], ['chrome', 0.57, 0.755, 0.058, 0.058, { yaw: 0.35, off: L1 }],
    ['drl', 0.76, 0.765, 0.053, 0.053, { hole: 0.8, yaw: 0.35, off: L3 }], ['drl', 0.57, 0.755, 0.053, 0.053, { hole: 0.8, yaw: 0.35, off: L3 }],
    ['lens', 0.76, 0.765, 0.026, 0.026, { yaw: 0.35, off: L2 }], ['lens', 0.57, 0.755, 0.026, 0.026, { yaw: 0.35, off: L2 }],
    ['amber', 0.9, 0.74, 0.035, 0.018, { n: 4, yaw: 0.6, off: L2 }],
  ],
  // lames fines (supercars, prototypes)
  blade: [
    ['house', 0.72, 1.0, 0.25, 0.048, { n: 3, rot: 0.2, taper: -0.55, yaw: 0.45 }],
    ['chrome', 0.8, 1.03, 0.07, 0.03, { n: 3, rot: 0.2, yaw: 0.45, off: L1 }],
    ['drl', 0.7, 0.97, 0.22, 0.0085, { n: 4, rot: 0.2, yaw: 0.45, off: L3 }],
    ['lens', 0.8, 1.03, 0.034, 0.02, { rot: 0.2, yaw: 0.45, off: L2 }],
    ['lens', 0.68, 1.0, 0.026, 0.016, { rot: 0.2, yaw: 0.45, off: L2 }],
  ],
  classic: [
    ['chrome', 0.64, 0.72, 0.1, 0.1, { hole: 0.8, yaw: 0.2, off: 0.0062 }],
    ['chrome', 0.64, 0.72, 0.084, 0.084, { yaw: 0.2, off: 0.004 }],
    ['lens', 0.64, 0.72, 0.03, 0.03, { yaw: 0.2, off: 0.0052 }],
    ['amber', 0.62, 0.36, 0.05, 0.024, { n: 2.6, yaw: 0.2, off: L1 }],
  ],
  quadround: [
    ['chrome', 0.8, 0.6, 0.075, 0.075, { hole: 0.76, off: 0.0074 }], ['chrome', 0.58, 0.6, 0.07, 0.07, { hole: 0.76, off: 0.0074 }],
    ['chrome', 0.8, 0.6, 0.06, 0.06, { off: 0.006 }], ['chrome', 0.58, 0.6, 0.055, 0.055, { off: 0.006 }],
    ['lens', 0.8, 0.6, 0.024, 0.024, { off: 0.0072 }], ['lens', 0.58, 0.6, 0.022, 0.022, { off: 0.0072 }],
    ['amber', 0.62, 0.2, 0.06, 0.02, { n: 4, off: L1 }],
  ],
  // phares escamotables (repliés) : contour sur le capot, feux de position et clignotants dans le bouclier
  popup: [
    ['trim', 0.6, 0.085, 0.22, 0.09, { face: 'top', n: 6, hole: 0.95, off: 0.0035 }],
    ['house', 0.68, 0.64, 0.2, 0.036, { n: 4, rot: 0.04, yaw: 0.35 }],
    ['white', 0.6, 0.64, 0.1, 0.022, { n: 4, yaw: 0.35, off: L1 }],
    ['amber', 0.82, 0.64, 0.06, 0.022, { n: 4, yaw: 0.35, off: L1 }],
  ],
  // matrice à LED (break moderne) : boîtier en coin, rangée de modules, signature en L
  led: [
    ['house', 0.7, 0.83, 0.24, 0.06, { n: 4, rot: 0.08, taper: -0.4, yaw: 0.4 }],
    ['chrome', 0.6, 0.84, 0.03, 0.022, { n: 3, yaw: 0.4, off: L1 }], ['chrome', 0.68, 0.845, 0.03, 0.022, { n: 3, yaw: 0.4, off: L1 }],
    ['chrome', 0.76, 0.85, 0.03, 0.022, { n: 3, yaw: 0.4, off: L1 }], ['chrome', 0.84, 0.855, 0.03, 0.022, { n: 3, yaw: 0.4, off: L1 }],
    ['lens', 0.6, 0.84, 0.016, 0.013, { yaw: 0.4, off: L2 }], ['lens', 0.68, 0.845, 0.016, 0.013, { yaw: 0.4, off: L2 }],
    ['lens', 0.76, 0.85, 0.016, 0.013, { yaw: 0.4, off: L2 }], ['lens', 0.84, 0.855, 0.016, 0.013, { yaw: 0.4, off: L2 }],
    ['drl', 0.7, 0.785, 0.22, 0.008, { n: 6, rot: 0.08, yaw: 0.4, off: L3 }],
    ['drl', 0.5, 0.82, 0.008, 0.04, { n: 6, yaw: 0.4, off: L3 }],
  ],
  frog: [['house', 0, 0, 0.1, 0.1, { n: 2 }], ['chrome', 0, 0, 0.082, 0.082, { n: 2, off: L1 }], ['lens', 0, 0, 0.04, 0.04, { off: L2 }], ['drl', 0, 0, 0.09, 0.09, { hole: 0.9, off: L3 }]],
};

// Feux arrière (aW : demi-largeur en fraction de la caisse ; center : décalque unique centré)
export const TAIL = {
  // compactes : blocs verticaux d'angle
  tall: [
    ['red', 0.85, 0.74, 0.08, 0.14, { n: 3.5, yaw: 0.55 }],
    ['led', 0.85, 0.79, 0.055, 0.06, { n: 3, yaw: 0.55, off: L1 }],
    ['white', 0.85, 0.645, 0.05, 0.024, { n: 3, yaw: 0.55, off: L1 }],
    ['amber', 0.85, 0.7, 0.05, 0.016, { n: 3, yaw: 0.55, off: L1 }],
  ],
  // coupé : feux effilés qui enveloppent l'aile
  slim: [
    ['red', 0.76, 0.82, 0.23, 0.058, { n: 3, rot: -0.06, taper: -0.35, yaw: 0.5 }],
    ['led', 0.78, 0.82, 0.19, 0.011, { n: 4, rot: -0.06, yaw: 0.5, off: L1 }],
    ['led', 0.84, 0.8, 0.06, 0.03, { n: 2.4, yaw: 0.5, hole: 0.7, off: L1 }],
    ['white', 0.6, 0.8, 0.05, 0.02, { n: 4, rot: -0.06, yaw: 0.5, off: L1 }],
  ],
  oval: [
    ['red', 0.74, 0.74, 0.15, 0.07, { n: 2.3, yaw: 0.5 }],
    ['led', 0.74, 0.74, 0.12, 0.054, { n: 2.3, hole: 0.62, yaw: 0.5, off: L1 }],
    ['white', 0.74, 0.74, 0.036, 0.02, { yaw: 0.5, off: L1 }],
  ],
  // berlines : blocs rectangulaires sur l'aile et le coffre
  block: [
    ['red', 0.74, 0.77, 0.21, 0.08, { n: 4, taper: -0.15, yaw: 0.45 }],
    ['led', 0.8, 0.79, 0.11, 0.036, { n: 4, yaw: 0.45, off: L1 }],
    ['white', 0.6, 0.75, 0.055, 0.026, { n: 4, yaw: 0.45, off: L1 }],
    ['amber', 0.88, 0.73, 0.04, 0.024, { n: 4, yaw: 0.45, off: L1 }],
  ],
  quad: [
    ['red', 0.8, 0.74, 0.078, 0.078, { yaw: 0.35 }], ['red', 0.56, 0.74, 0.078, 0.078, { yaw: 0.35 }],
    ['led', 0.8, 0.74, 0.068, 0.068, { hole: 0.62, yaw: 0.35, off: L1 }], ['led', 0.56, 0.74, 0.068, 0.068, { hole: 0.62, yaw: 0.35, off: L1 }],
    ['white', 0.56, 0.74, 0.03, 0.03, { yaw: 0.35, off: L1 }],
  ],
  bar: [
    ['red', 0, 0.8, 0, 0.034, { n: 8, aW: 0.86, center: true }],
    ['led', 0, 0.8, 0, 0.009, { n: 6, aW: 0.84, center: true, off: L1 }],
    ['red', 0.8, 0.8, 0.16, 0.052, { n: 4, yaw: 0.4, off: 0.0045 }],
    ['led', 0.82, 0.8, 0.12, 0.02, { n: 4, yaw: 0.4, off: L2 }],
    ['white', 0.66, 0.8, 0.035, 0.016, { n: 4, yaw: 0.4, off: L2 }],
  ],
  blade: [
    ['red', 0.77, 0.84, 0.22, 0.036, { n: 3, rot: -0.1, taper: -0.5, yaw: 0.5 }],
    ['led', 0.77, 0.84, 0.2, 0.009, { n: 4, rot: -0.1, yaw: 0.5, off: L1 }],
    ['led', 0, 0.84, 0, 0.006, { n: 6, aW: 0.5, center: true, off: 0.006 }],
  ],
  round: [
    ['red', 0.77, 0.76, 0.075, 0.075, { yaw: 0.35 }], ['red', 0.53, 0.76, 0.068, 0.068, { yaw: 0.35 }],
    ['led', 0.77, 0.76, 0.048, 0.048, { yaw: 0.35, off: L1 }], ['led', 0.53, 0.76, 0.042, 0.042, { yaw: 0.35, off: L1 }],
  ],
  classic: [
    ['chrome', 0.74, 0.7, 0.075, 0.075, { hole: 0.78, yaw: 0.25, off: 0.0062 }],
    ['red', 0.74, 0.7, 0.062, 0.062, { yaw: 0.25 }],
    ['led', 0.74, 0.7, 0.04, 0.04, { yaw: 0.25, off: L1 }],
    ['chrome', 0.5, 0.7, 0.05, 0.05, { hole: 0.74, yaw: 0.25, off: 0.0062 }],
    ['amber', 0.5, 0.7, 0.04, 0.04, { yaw: 0.25 }],
  ],
  triple: [
    ['red', 0.32, 0.7, 0.085, 0.072, { n: 7 }], ['red', 0.55, 0.7, 0.085, 0.072, { n: 7 }], ['red', 0.78, 0.7, 0.085, 0.072, { n: 7 }],
    ['led', 0.32, 0.7, 0.07, 0.056, { n: 7, off: L1 }], ['led', 0.55, 0.7, 0.07, 0.056, { n: 7, off: L1 }], ['led', 0.78, 0.7, 0.07, 0.056, { n: 7, off: L1 }],
    ['chrome', 0, 0.7, 0, 0.09, { n: 10, aW: 0.92, center: true, hole: 0.9, off: 0.0045 }],
  ],
  wide: [
    ['red', 0, 0.83, 0, 0.022, { n: 8, aW: 0.86, center: true }],
    ['led', 0, 0.83, 0, 0.006, { n: 8, aW: 0.84, center: true, off: L1 }],
    ['red', 0.78, 0.8, 0.17, 0.058, { n: 4, taper: -0.35, yaw: 0.45 }],
    ['led', 0.8, 0.8, 0.13, 0.042, { n: 4, taper: -0.35, hole: 0.82, yaw: 0.45, off: L1 }],
    ['white', 0.72, 0.79, 0.04, 0.016, { n: 4, yaw: 0.45, off: L1 }],
  ],
  ring: [
    ['house', 0.8, 0.78, 0.075, 0.075, { yaw: 0.3 }], ['house', 0.58, 0.78, 0.068, 0.068, { yaw: 0.3 }],
    ['led', 0.8, 0.78, 0.069, 0.069, { hole: 0.66, yaw: 0.3, off: L1 }], ['led', 0.58, 0.78, 0.062, 0.062, { hole: 0.66, yaw: 0.3, off: L1 }],
  ],
};

// Calandres et entrées d'air
export const GRILLE = {
  bar: [['grille', 0, 0.74, 0.29, 0.05, { n: 6, center: true }], ['vent', 0, 0.26, 0.5, 0.055, { n: 5, center: true }]],
  slot: [['grille', 0, 0.8, 0.26, 0.028, { n: 5, center: true }], ['grille', 0, 0.3, 0.46, 0.075, { n: 4, center: true }]],
  mouth: [['grille', 0, 0.38, 0.42, 0.1, { n: 3.4, center: true }]],
  kidney: [
    ['chrome', 0.13, 0.74, 0.095, 0.07, { n: 3, hole: 0.86, off: L1 }],
    ['grille2', 0.13, 0.74, 0.085, 0.06, { n: 3 }],
    ['grille', 0, 0.3, 0.44, 0.07, { n: 4, center: true }], ['vent', 0.68, 0.3, 0.1, 0.04, { n: 3 }],
  ],
  triple: [['grille', 0, 0.3, 0.2, 0.05, { n: 4, center: true }], ['grille', 0.64, 0.32, 0.13, 0.06, { n: 3 }]],
  super: [['grille', 0, 0.36, 0.3, 0.07, { n: 3, center: true }], ['grille', 0.66, 0.36, 0.15, 0.085, { n: 3, rot: -0.15 }]],
  race: [['grille', 0, 0.42, 0.4, 0.095, { n: 4, center: true }], ['vent', 0.72, 0.42, 0.12, 0.07, { n: 3 }]],
  oval: [
    ['chrome', 0, 0.42, 0.3, 0.12, { n: 2.4, center: true, hole: 0.86, off: L1 }],
    ['grille2', 0, 0.42, 0.27, 0.105, { n: 2.4, center: true }],
  ],
  wide: [
    ['chrome', 0, 0.6, 0, 0.13, { aW: 0.93, n: 9, center: true, hole: 0.9, off: L1 }],
    ['grille2', 0, 0.6, 0, 0.12, { aW: 0.91, n: 9, center: true }],
    ['vent', 0, 0.22, 0.3, 0.035, { n: 6, center: true }],
  ],
  single: [
    ['chrome', 0, 0.5, 0.3, 0.15, { center: true, pts: [[-0.78, 1], [0.78, 1], [1, 0.25], [0.74, -1], [-0.74, -1], [-1, 0.25]], seg: 48, hole: 0.93 }],
    ['grille', 0, 0.5, 0.285, 0.14, { center: true, off: L1, pts: [[-0.78, 1], [0.78, 1], [1, 0.25], [0.74, -1], [-0.74, -1], [-1, 0.25]], seg: 48 }],
    ['vent', 0.74, 0.3, 0.13, 0.075, { n: 3, rot: 0.2 }],
  ],
  aero: [
    ['grille', 0, 0.3, 0.3, 0.06, { n: 4, center: true }],
    ['grille', 0.68, 0.38, 0.17, 0.1, { n: 3, rot: -0.22, taper: -0.3 }],
    ['vent', 0, 0.62, 0.1, 0.03, { n: 4, center: true }],
  ],
};
// hauteur du logo (fraction de la face avant) selon la calandre
const BADGE_FY = { bar: 0.74, slot: 0.8, mouth: 0.62, kidney: 0.9, triple: 0.56, super: 0.62, race: 0.66, oval: 0.42, wide: 0.6, single: 0.53, aero: 0.55 };

// Disposition des échappements : [{ x, y, rx, ry, side }]
export function exhaustLayout(shape, spec) {
  const st = shape.st, W = shape.Wmax;
  let kind = st.exhaust;
  if (!kind) kind = spec.engine.cyl >= 8 ? 'quad' : spec.engine.cyl >= 6 ? 'twin' : 'single';
  const y = shape.clear + 0.1;
  const r = 0.042;
  switch (kind) {
    case 'quad': return [-1, 1].flatMap((s) => [{ x: s * W * 0.5, y, rx: r, ry: r }, { x: s * (W * 0.5 - 0.105), y, rx: r, ry: r }]);
    case 'dual': return [-1, 1].map((s) => ({ x: s * W * 0.68, y: y - 0.01, rx: 0.038, ry: 0.038 }));
    case 'center': return st.race ? [{ x: 0, y: shape.clear + 0.18, rx: 0.06, ry: 0.06 }] : [-1, 1].map((s) => ({ x: s * 0.075, y: shape.clear + 0.24, rx: 0.052, ry: 0.052 }));
    case 'oval': return [-1, 1].map((s) => ({ x: s * W * 0.6, y, rx: 0.085, ry: 0.045 }));
    case 'side': return [-1, 1].map((s) => ({ x: s, y: shape.clear + 0.07, rx: 0.045, ry: 0.045, side: true }));
    case 'twin': return [-1, 1].map((s) => ({ x: s * W * 0.55, y, rx: r, ry: r }));
    default: return [{ x: W * 0.55, y, rx: r, ry: r }];
  }
}

// Construit les décalques regroupés par matériau ; renvoie aussi les points d'ancrage des échappements
export function buildDecals(shape, spec, bodyGeo, lod = 0) {
  const st = shape.st, H = shape.H, W = shape.Wmax;
  // projecteur partagé entre les niveaux de détail (libéré par l'appelant : delete bodyGeo.__proj)
  const proj = bodyGeo.__proj || (bodyGeo.__proj = new SurfaceProjector(bodyGeo));
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Zp = new THREE.Vector3(0, 0, 1);
  const nX = X.clone().negate(), nY = Y.clone().negate(), nZ = Zp.clone().negate();
  const zF = shape.zFront, zR = shape.zRear;
  const fLow = shape.clear + 0.04, fTop = st.nose * H;
  const rLow = shape.clear + 0.04, rTop = st.tail * H;
  const groups = {};
  const low = lod > 0;
  const put = (mat, g, mirror) => {
    if (!g) return;
    (groups[mat] || (groups[mat] = [])).push(g);
    if (mirror) groups[mat].push(mirrorGeometry(g));
  };
  const make = (key, o) => {
    let [mat, col] = KEYMAP[key] || ['blk', [0.03, 0.03, 0.03]];
    if (low) {
      // version lointaine : moins de segments, calandres en noir, sans plaques ni logos
      if (mat === 'plate' || mat === 'badge' || mat === 'chrome') return null;
      if (mat === 'grille' || mat === 'grille2') { mat = 'blk'; col = [0.02, 0.02, 0.022]; }
      if (mat === 'drl') mat = 'lens';
      o = { ...o, seg: 12, rings: 1 };
      if (o.hole) o.rings = 1;
    }
    if (key === 'chrome' && st.frame !== 'chrome' && o.hole && (st.lights === 'twin')) col = KEYMAP.chrome[1];
    const g = decalGeometry(proj, { ...o, col: col || o.col, uvScale: mat === 'grille' || mat === 'grille2' ? 25 : o.uvScale });
    return g ? [mat, g] : null;
  };
  const place = (list, face0) => {
    for (const [key, fx, fy, a, b, o0] of list) {
      const o = { ...o0 };
      const face = o.face || face0;
      const aa = o.aW ? o.aW * W : a;
      let c, a1, a2, dir;
      if (face === 'front') {
        c = new THREE.Vector3(fx * W, lerp(fLow, fTop, fy), zF - 0.05);
        a1 = o.center ? nX : X; a2 = Y; dir = Zp;
        // yaw : projection oblique depuis l'extérieur (optiques qui enveloppent le coin de caisse)
        if (o.yaw) { dir = Zp.clone().applyAxisAngle(Y, -o.yaw); a1 = X.clone().applyAxisAngle(Y, -o.yaw); }
      } else if (face === 'rear') {
        c = new THREE.Vector3(fx * W, lerp(rLow, rTop, fy), zR + 0.05);
        a1 = X; a2 = Y; dir = nZ;
        if (o.yaw) { dir = nZ.clone().applyAxisAngle(Y, o.yaw); a1 = X.clone().applyAxisAngle(Y, o.yaw); }
      } else if (face === 'top') {
        c = new THREE.Vector3(fx * W, H + 0.4, zF + fy * shape.L);
        a1 = X; a2 = nZ; dir = nY;
      } else {
        // flanc : fx = position en t, fy = hauteur absolue (m)
        c = new THREE.Vector3(W + 0.3, fy, zF + fx * shape.L);
        a1 = nZ; a2 = Y; dir = nX;
      }
      const r = make(key, { c, a1, a2, dir, a: aa, b, ...o });
      if (r) put(r[0], r[1], !o.center);
    }
  };
  // --- optiques avant ---
  if (st.lights === 'frog') {
    // phares ronds à l'avant des ailes (regard vers l'avant et un peu vers le haut)
    const dir = new THREE.Vector3(0, -0.42, 0.907).normalize();
    const a2 = Y.clone().addScaledVector(dir, -Y.dot(dir)).normalize();
    const zc = zF + 0.2;
    const yc = shape.profile((zc - zF) / shape.L).topF - 0.06;
    for (const [key, , , a, b, o] of HEAD.frog) {
      const c = new THREE.Vector3(W * 0.66, yc, zc).addScaledVector(dir, -1.2);
      const r = make(key, { c, a1: X, a2, dir, a, b, ...o });
      if (r) put(r[0], r[1], true);
    }
    place([['amber', 0.66, 0.42, 0.06, 0.025, { n: 3 }], ['house', 0.66, 0.42, 0.075, 0.035, { n: 3, off: 0.003 }]], 'front');
  } else place(HEAD[st.lights] || HEAD.slim, 'front');
  place(GRILLE[st.grille] || GRILLE.mouth, 'front');
  if (st.tailPanel === 'black') place([['blk', 0, st.tailLights === 'triple' ? 0.7 : 0.8, 0, st.tailLights === 'triple' ? 0.1 : 0.05, { n: 8, aW: 0.9, center: true, off: 0.0032 }]], 'rear');
  place(TAIL[st.tailLights] || TAIL.slim, 'rear');
  // antibrouillards
  if (st.fog) place([['house', 0.74, 0.2, 0.052, 0.04, { n: 2.6 }], ['chrome', 0.74, 0.2, 0.038, 0.03, { n: 2.4, off: L1 }], ['lens', 0.74, 0.2, 0.02, 0.018, { off: L2 }]], 'front');
  // jupe arrière / diffuseur (fond sombre)
  place([['vent', 0, 0.12, 0, st.race ? 0.13 : st.diffuser ? 0.11 : 0.085, { n: 6, aW: st.race || st.diffuser === 'big' ? 0.9 : 0.8, center: true }]], 'rear');
  // catadioptres aux coins du bouclier arrière
  if (!st.race && st.bumpers !== 'chrome') place([['red', 0.8, 0.3, 0.05, 0.011, { n: 4, yaw: 0.45, off: 0.004 }]], 'rear');
  if (!low) {
    // logos de marque
    if (st.badge && !st.race) {
      const cell = brandCell(spec.brand);
      const ur = [(cell % 8) / 8, 1 - (Math.floor(cell / 8) + 1) / 2, (cell % 8 + 1) / 8, 1 - Math.floor(cell / 8) / 2];
      place([['badge', 0, BADGE_FY[st.grille] ?? 0.6, 0.042, 0.042, { center: true, uvRect: ur, off: 0.0085, seg: 20, rings: 2 }]], 'front');
      place([['badge', 0, 0.66, 0.036, 0.036, { center: true, uvRect: ur, off: 0.006, seg: 20, rings: 2 }]], 'rear');
    }
    if (st.race) {
      const ur = [(TOW_CELL % 8) / 8, 0, (TOW_CELL % 8 + 1) / 8, 0.5];
      place([['badge', -0.62, 0.22, 0.03, 0.05, { center: true, n: 8, uvRect: ur, off: 0.006, seg: 16, rings: 1 }]], 'front');
    }
    // plaques d'immatriculation (voitures de route) + support noir
    if (!st.race) {
      const fyP = st.grille === 'bar' || st.grille === 'kidney' || st.grille === 'slot' ? 0.5 : st.grille === 'wide' ? 0.36 : st.grille === 'single' ? 0.4 : 0.3;
      place([['blk', 0, fyP, 0.27, 0.064, { n: 10, center: true, off: 0.006 }], ['plate', 0, fyP, 0.255, 0.054, { n: 12, center: true, off: 0.0085 }]], 'front');
      place([['blk', 0, 0.44, 0.27, 0.064, { n: 10, center: true, off: 0.0045 }], ['plate', 0, 0.44, 0.255, 0.054, { n: 12, center: true, off: 0.0065 }]], 'rear');
    }
    // répétiteurs de clignotant sur les ailes avant
    if (!st.race && st.doors > 0) {
      const tz = (shape.zAxleF + shape.archR + 0.16 - zF) / shape.L;
      const P = shape.profile(tz);
      place([['amber', tz, P.ys - 0.04, 0.03, 0.011, { face: 'side', n: 3, off: 0.004 }]], 'side');
    }
    // grille d'auvent au pied du pare-brise
    if (st.cowl && st.doors !== 0) {
      const t = st.ws - 0.07 / shape.L;
      place([['vent', 0, t, 0, 0.055, { face: 'top', aW: st.cabW * 0.92, n: 6, center: true, off: 0.003 }]], 'top');
    }
    // poignées de portes
    if (st.doors > 0) {
      const tD = st.doors === 4 ? lerp(st.roofF, st.roofB, 0.48) : Math.min(st.roofB - 0.02, (shape.zOf(st.ws) - 0.06 + 1.18 * shape.L / 4.4 - zF) / shape.L);
      const P = shape.profile(tD - 0.035);
      const key = st.frame === 'chrome' ? 'chrome' : 'trim';
      place([[key, tD - 0.16 / shape.L, P.ys - 0.05, 0.07, 0.012, { face: 'side', n: 4, off: 0.005 }]], 'side');
      if (st.doors === 4) {
        const t2 = Math.min(st.roofB + 0.03, tD + 0.92 * shape.L / 4.4 / shape.L);
        place([[key, t2 - 0.14 / shape.L, P.ys - 0.05, 0.07, 0.012, { face: 'side', n: 4, off: 0.005 }]], 'side');
      }
    }
    // ouïes de capot / persiennes au-dessus des roues avant (course)
    if (st.hoodVents) {
      const t = st.ws * 0.5, z = zF + t * shape.L;
      put('blk', decalGeometry(proj, { c: new THREE.Vector3(0.3, H + 0.3, z), a1: X, a2: nZ, dir: nY, a: 0.1, b: 0.2, n: 4, col: KEYMAP.vent[1] }), true);
    }
    if (st.louvers) {
      const t = shape.tAxleF;
      put('grille', decalGeometry(proj, { c: new THREE.Vector3(W * 0.7, H + 0.3, zF + t * shape.L), a1: X, a2: nZ, dir: nY, a: 0.12, b: 0.16, n: 5, uvScale: 25 }), true);
    }
  }
  // prises d'air latérales
  if (st.sideIntake) {
    const z = shape.zAxleR - shape.archR - 0.42;
    const P = shape.profile((z - zF) / shape.L);
    const r = make('grille', { c: new THREE.Vector3(W + 0.1, P.ys - 0.13, z), a1: nZ, a2: Y, dir: nX, a: 0.3, b: 0.1, n: 3, rot: 0.14, taper: -0.5 });
    if (r) put(r[0], r[1], true);
  }
  // échappements : ouvertures dans le bouclier + ancrages
  const exh = exhaustLayout(shape, spec);
  const hit = { p: new THREE.Vector3(), n: new THREE.Vector3() };
  const fR = proj.frame(nZ), fS = proj.frame(nX);
  for (const e of exh) {
    if (e.side) {
      const z = shape.zAxleR - shape.archR - 0.14;
      const h = proj.cast(new THREE.Vector3(W + 2, e.y, z), fS, hit);
      e.z = z;
      e.xs = h ? Math.max(h.p.x, W * 0.8) : W;
      e.x = e.x > 0 ? e.xs : -e.xs;
    } else {
      const h = proj.cast(new THREE.Vector3(e.x, e.y, zR + 2), fR, hit);
      e.z = h ? Math.min(zR, h.p.z) : zR - 0.12;
      if (!low) {
        const g = decalGeometry(proj, { c: new THREE.Vector3(e.x, e.y, zR + 0.05), a1: X, a2: Y, dir: nZ, a: e.rx + 0.016, b: e.ry + 0.016, n: e.rx > e.ry ? 3 : 2, col: KEYMAP.vent[1], off: 0.005, seg: 20, rings: 1 });
        put('blk', g, false);
      }
    }
  }
  const geos = {};
  for (const [key, list] of Object.entries(groups)) {
    // attributs homogènes avant fusion
    for (const g of list) {
      if (!g.attributes.color) {
        const c = new Float32Array(g.attributes.position.count * 3).fill(1);
        g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      }
    }
    geos[key] = mergeGeometries(list, false);
  }
  return { geos, exhaust: exh };
}
