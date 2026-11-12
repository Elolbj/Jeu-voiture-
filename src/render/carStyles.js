// Styles de carrosserie : proportions et équipements de chaque famille de voitures.
// Une voiture peut surcharger partiellement son style via spec.body (mêmes clés) :
// le style effectif est { ...DEFAULTS, ...STYLES[spec.style], ...spec.body }.
//
// Profil (fractions de la hauteur totale H ; abscisses t de 0 = avant à 1 = arrière) :
//   nose / hood / belt / deck / tail : hauteurs du nez, du capot au pare-brise, de la ceinture de caisse,
//   de la plage arrière et de la poupe ; roof : toit. ws / roofF / roofB / rearB : bas du pare-brise,
//   haut du pare-brise, fin du pavillon, bas de la lunette. overF : part du porte-à-faux à l'avant.
//   cabW / roofW : largeur de l'habitacle à la ceinture / au toit (fraction de la demi-largeur).
//   noseR / noseRB : rayon du bord supérieur / inférieur de la face avant (m), noseY : hauteur du point
//   le plus saillant, nosePow : forme de l'arrondi, cornerF : arrondi des coins en vue de dessus,
//   w0F : largeur relative au bout du nez ; idem tail* à l'arrière. shoulder : hauteur de la ligne d'épaule.
//   nL / nU : exposants des superellipses de section (bas / haut ; plus grand = plus carré), tuck : rentré du bas de caisse.
//   beltR / beltPow : hauteur de ceinture au pied de la lunette (ceinture montante) et forme de la montée ;
//   wsFillet / rwFillet : congés pare-brise / lunette ↔ pavillon ; roofDrop : pavillon plongeant ; sideEnd : fin des vitres latérales.
// Équipements :
//   lights / tailLights / grille : dessins des optiques et calandres (voir carBody.js), spoiler : aileron d'origine,
//   doors : 0 / 2 / 4, frame : 'black' | 'chrome' (encadrements de vitres), bPillar : 'black' | 'body',
//   quarter : vitre de custode, bumpers : 'chrome', exhaust : 'twin' | 'dual' | 'quad' | 'center' | 'oval' | 'single',
//   diffuser : 'small' | 'big' | 'race', skirt / lip : bas de caisse et lame avant ('black' | 'carbon' | 'body'),
//   mirrors : 'door' | 'fender' | 'race', antenna : 'fin' | 'whip', roofRails, hoodScoop, hoodVents, louvers,
//   sideIntake, splitter, canards, fin, roofScoop, softTop, carbonRoof, race (voiture de course).

export const DEFAULTS = {
  roof: 1.0, nL: 6, nU: 4.5, tuck: 0.035, lean: 0.022, tumble: 0.05, rTop: 0.08, rRock: 0.05, crown: 0.02, crease: 0.14, shoulder: 0.78, fenderGap: 0.065, flare: 0.02,
  frame: 'black', frameW: 0.03, railF: 0.045, railR: 0.07, pillarA: 0.055, pillarC: 0.11, bPillar: 'black', quarter: true, bumpers: null, exhaust: null,
  diffuser: null, skirt: null, lip: null, mirrors: 'door', antenna: null, roofRails: false, hoodScoop: false,
  fog: true, wipers: 2, badge: true, tailPanel: null, cowl: true, canards: false, louvers: false,
};

export const STYLES = {
  hatch: {
    overF: 0.58, nose: 0.52, hood: 0.64, belt: 0.67, deck: 0.71, tail: 0.69,
    ws: 0.3, roofF: 0.49, roofB: 0.82, rearB: 0.955, cabW: 0.92, roofW: 0.76, clear: 0.15, rearPow: 1.5, nU: 6,
    noseR: 0.1, noseRB: 0.08, noseY: 0.6, nosePow: 3.2, cornerF: 0.22, w0F: 0.74,
    tailR: 0.06, tailRB: 0.12, tailY: 0.42, tailPow: 3.2, cornerR: 0.18, w0R: 0.84,
    lights: 'round', tailLights: 'tall', grille: 'bar', spoiler: 'lip', doors: 2, shoulder: 0.76,
    antenna: 'whip', skirt: null,
    beltR: 0.7,
    sideEnd: 0.84,
    roofDrop: 0.025,
  },
  hatch2: {
    overF: 0.58, nose: 0.5, hood: 0.625, belt: 0.66, deck: 0.7, tail: 0.66,
    ws: 0.27, roofF: 0.47, roofB: 0.76, rearB: 0.96, cabW: 0.92, roofW: 0.75, clear: 0.14, rearPow: 1.35, nU: 5.5,
    noseR: 0.12, noseRB: 0.09, noseY: 0.58, nosePow: 3, cornerF: 0.26, w0F: 0.68,
    tailR: 0.06, tailRB: 0.12, tailY: 0.42, tailPow: 3.2, cornerR: 0.2, w0R: 0.8,
    lights: 'slim', tailLights: 'tall', grille: 'slot', spoiler: 'roof', doors: 2, shoulder: 0.78,
    skirt: 'body', lip: 'black',
    beltR: 0.7,
    roof: 0.985,
    sideEnd: 0.86,
    roofDrop: 0.03,
  },
  roadster: {
    overF: 0.52, nose: 0.43, hood: 0.625, belt: 0.66, deck: 0.7, tail: 0.66,
    ws: 0.42, roofF: 0.53, roofB: 0.64, rearB: 0.73, cabW: 0.88, roofW: 0.7, clear: 0.13,
    noseR: 0.26, noseRB: 0.16, noseY: 0.46, nosePow: 2.4, cornerF: 0.45, w0F: 0.5,
    tailR: 0.2, tailRB: 0.15, tailY: 0.45, tailPow: 2.3, cornerR: 0.45, w0R: 0.6,
    lights: 'oval', tailLights: 'oval', grille: 'mouth', spoiler: 'none', doors: 2, softTop: true, shoulder: 0.8,
    nU: 3.6, quarter: false, bPillar: 'body', antenna: 'whip',
    beltR: 0.68,
  },
  coupe: {
    overF: 0.55, nose: 0.48, hood: 0.65, belt: 0.665, deck: 0.74, tail: 0.72,
    ws: 0.41, roofF: 0.57, roofB: 0.7, rearB: 0.85, cabW: 0.9, roofW: 0.7, clear: 0.13, nU: 5,
    noseR: 0.16, noseRB: 0.14, noseY: 0.46, nosePow: 2.8, cornerF: 0.36, w0F: 0.6,
    tailR: 0.13, tailRB: 0.14, tailY: 0.45, tailPow: 2.8, cornerR: 0.3, w0R: 0.72,
    lights: 'slim', tailLights: 'slim', grille: 'mouth', spoiler: 'duck', doors: 2, shoulder: 0.78, fenderGap: 0.06,
    lip: 'black', antenna: 'fin',
    beltR: 0.72,
  },
  sedan: {
    overF: 0.49, nose: 0.55, hood: 0.65, belt: 0.65, deck: 0.71, tail: 0.69,
    ws: 0.345, roofF: 0.5, roofB: 0.72, rearB: 0.83, cabW: 0.91, roofW: 0.73, clear: 0.15, nU: 5.5,
    noseR: 0.1, noseRB: 0.075, noseY: 0.6, nosePow: 3, cornerF: 0.22, w0F: 0.8,
    tailR: 0.13, tailRB: 0.16, tailY: 0.45, tailPow: 3, cornerR: 0.26, w0R: 0.8,
    lights: 'slim', tailLights: 'block', grille: 'mouth', spoiler: 'wing', doors: 4, shoulder: 0.8,
    skirt: 'body', antenna: 'fin', hoodScoop: true,
    beltR: 0.69,
    roofDrop: 0.012,
  },
  sedan2: {
    overF: 0.5, nose: 0.5, hood: 0.65, belt: 0.67, deck: 0.73, tail: 0.71,
    ws: 0.37, roofF: 0.52, roofB: 0.7, rearB: 0.82, cabW: 0.9, roofW: 0.72, clear: 0.13, nU: 5,
    noseR: 0.14, noseRB: 0.1, noseY: 0.55, nosePow: 2.8, cornerF: 0.34, w0F: 0.66,
    tailR: 0.16, tailRB: 0.14, tailY: 0.45, tailPow: 2.6, cornerR: 0.3, w0R: 0.74,
    lights: 'twin', tailLights: 'block', grille: 'kidney', spoiler: 'lip', doors: 2, shoulder: 0.8, carbonRoof: true,
    lip: 'carbon', skirt: 'body', diffuser: 'small', exhaust: 'quad', flare: 0.035,
    beltR: 0.71,
    roofDrop: 0.01,
  },
  gtcoupe: {
    overF: 0.52, nose: 0.5, hood: 0.66, belt: 0.68, deck: 0.75, tail: 0.74,
    ws: 0.35, roofF: 0.5, roofB: 0.69, rearB: 0.83, cabW: 0.9, roofW: 0.72, clear: 0.13, nU: 6,
    noseR: 0.1, noseRB: 0.09, noseY: 0.56, nosePow: 3.2, cornerF: 0.25, w0F: 0.78,
    tailR: 0.12, tailRB: 0.14, tailY: 0.45, tailPow: 3.2, cornerR: 0.22, w0R: 0.8,
    lights: 'slim', tailLights: 'quad', grille: 'mouth', spoiler: 'wing', doors: 2, shoulder: 0.82,
    skirt: 'body', lip: 'black', exhaust: 'twin',
    beltR: 0.72,
  },
  rearengine: {
    overF: 0.47, nose: 0.4, hood: 0.625, belt: 0.66, deck: 0.73, tail: 0.69,
    ws: 0.31, roofF: 0.46, roofB: 0.55, rearB: 0.88, cabW: 0.86, roofW: 0.68, clear: 0.12,
    noseR: 0.32, noseRB: 0.16, noseY: 0.42, nosePow: 2.0, cornerF: 0.55, w0F: 0.48,
    tailR: 0.3, tailRB: 0.14, tailY: 0.5, tailPow: 2.1, cornerR: 0.5, w0R: 0.56,
    lights: 'frog', tailLights: 'bar', grille: 'triple', spoiler: 'wing', doors: 2, shoulder: 0.76, flare: 0.05, fenderGap: 0.05,
    nU: 3.8, exhaust: 'center', lip: 'black', fog: false,
    rearPow: 1.25,
    beltR: 0.69,
    rwFillet: 0.85,
    wsFillet: 0.5,
  },
  muscle: {
    overF: 0.5, nose: 0.45, hood: 0.66, belt: 0.69, deck: 0.73, tail: 0.71,
    ws: 0.45, roofF: 0.57, roofB: 0.66, rearB: 0.81, cabW: 0.86, roofW: 0.68, clear: 0.11,
    noseR: 0.22, noseRB: 0.14, noseY: 0.42, nosePow: 2.6, cornerF: 0.42, w0F: 0.52,
    tailR: 0.14, tailRB: 0.14, tailY: 0.5, tailPow: 2.6, cornerR: 0.4, w0R: 0.68,
    lights: 'slim', tailLights: 'bar', grille: 'mouth', spoiler: 'gtwing', doors: 2, shoulder: 0.82, flare: 0.05, hoodVents: true, fenderGap: 0.05,
    quarter: false, skirt: 'carbon', lip: 'carbon', canards: true, diffuser: 'big', exhaust: 'twin',
    beltR: 0.71,
    rwFillet: 0.6,
  },
  supercar: {
    overF: 0.45, nose: 0.36, hood: 0.62, belt: 0.65, deck: 0.7, tail: 0.68,
    ws: 0.27, roofF: 0.43, roofB: 0.53, rearB: 0.8, cabW: 0.84, roofW: 0.64, clear: 0.1,
    noseR: 0.26, noseRB: 0.12, noseY: 0.4, nosePow: 2.5, cornerF: 0.5, w0F: 0.5,
    tailR: 0.12, tailRB: 0.14, tailY: 0.45, tailPow: 3, cornerR: 0.4, w0R: 0.72,
    lights: 'blade', tailLights: 'blade', grille: 'super', spoiler: 'lipwing', doors: 2, shoulder: 0.76, flare: 0.06, sideIntake: true, fenderGap: 0.045,
    quarter: false, lip: 'carbon', skirt: 'carbon', diffuser: 'big', exhaust: 'quad', fog: false,
    beltR: 0.68,
    rwFillet: 0.6,
  },
  gt3: {
    overF: 0.5, nose: 0.42, hood: 0.635, belt: 0.67, deck: 0.73, tail: 0.72,
    ws: 0.34, roofF: 0.49, roofB: 0.64, rearB: 0.83, cabW: 0.86, roofW: 0.68, clear: 0.09,
    noseR: 0.22, noseRB: 0.1, noseY: 0.42, nosePow: 2.5, cornerF: 0.45, w0F: 0.6,
    tailR: 0.12, tailRB: 0.13, tailY: 0.5, tailPow: 3.4, cornerR: 0.28, w0R: 0.82,
    lights: 'slim', tailLights: 'bar', grille: 'race', spoiler: 'gtwing', doors: 2, shoulder: 0.8, flare: 0.1, splitter: true, race: true, fenderGap: 0.05,
    quarter: true, skirt: 'carbon', diffuser: 'race', exhaust: 'side', canards: true, louvers: true, mirrors: 'race', wipers: 1, fog: false, antenna: null,
    beltR: 0.7,
  },
  proto: {
    overF: 0.5, nose: 0.3, hood: 0.5, belt: 0.6, deck: 0.66, tail: 0.66,
    ws: 0.26, roofF: 0.4, roofB: 0.5, rearB: 0.72, cabW: 0.52, roofW: 0.42, clear: 0.07,
    noseR: 0.32, noseRB: 0.1, noseY: 0.35, nosePow: 2.0, cornerF: 0.5, w0F: 0.56,
    tailR: 0.04, tailRB: 0.06, tailY: 0.5, tailPow: 3.5, cornerR: 0.16, w0R: 0.88,
    lights: 'blade', tailLights: 'bar', grille: 'race', spoiler: 'protowing', doors: 0, shoulder: 0.85, flare: 0.08, valley: 0.16, fin: true, splitter: true, race: true, fenderGap: 0.04,
    nU: 3.6, quarter: false, diffuser: 'race', exhaust: 'center', mirrors: 'fender', wipers: 1, fog: false, frameW: 0.025,
  },
  gt1: {
    overF: 0.52, nose: 0.33, hood: 0.52, belt: 0.62, deck: 0.68, tail: 0.68,
    ws: 0.28, roofF: 0.42, roofB: 0.53, rearB: 0.78, cabW: 0.66, roofW: 0.54, clear: 0.08,
    noseR: 0.32, noseRB: 0.1, noseY: 0.36, nosePow: 2.0, cornerF: 0.5, w0F: 0.56,
    tailR: 0.05, tailRB: 0.06, tailY: 0.5, tailPow: 3.4, cornerR: 0.2, w0R: 0.86,
    lights: 'twinround', tailLights: 'round', grille: 'race', spoiler: 'protowing', doors: 2, shoulder: 0.84, flare: 0.08, valley: 0.08, splitter: true, race: true, roofScoop: true, fenderGap: 0.04,
    nU: 3.8, quarter: false, diffuser: 'race', exhaust: 'side', mirrors: 'race', wipers: 1, fog: false, canards: true,
  },
  // --- Nouveaux styles ---
  // GT classique des années 60 : long capot, ailes galbées au-dessus du capot, pavillon fastback, chromes.
  classic: {
    overF: 0.5, nose: 0.44, hood: 0.6, belt: 0.62, deck: 0.67, tail: 0.62,
    ws: 0.43, roofF: 0.56, roofB: 0.7, rearB: 0.86, cabW: 0.92, roofW: 0.77, clear: 0.13,
    noseR: 0.3, noseRB: 0.2, noseY: 0.45, nosePow: 2.2, cornerF: 0.5, w0F: 0.52,
    tailR: 0.22, tailRB: 0.18, tailY: 0.45, tailPow: 2.3, cornerR: 0.42, w0R: 0.62,
    lights: 'classic', tailLights: 'classic', grille: 'oval', spoiler: 'none', doors: 2, shoulder: 0.7,
    fenderGap: 0.075, flare: 0.03, nU: 3.2, nL: 4, tuck: 0.07, valley: 0.03,
    frame: 'chrome', frameW: 0.012, bPillar: 'body', quarter: false, bumpers: 'chrome', exhaust: 'twin',
    fog: false, mirrors: 'fender', antenna: 'whip', cowl: false,
    pillarA: 0.04,
    railF: 0.035,
    railR: 0.05,
    pillarC: 0.08,
    beltR: 0.64,
    rwFillet: 0.7,
    wsFillet: 0.45,
  },
  // Muscle car fastback de 1969 : faces avant / arrière verticales, calandre pleine largeur à phares ronds.
  classicmuscle: {
    overF: 0.52, nose: 0.56, hood: 0.63, belt: 0.67, deck: 0.7, tail: 0.69,
    ws: 0.42, roofF: 0.55, roofB: 0.66, rearB: 0.88, cabW: 0.9, roofW: 0.74, clear: 0.13,
    noseR: 0.08, noseRB: 0.12, noseY: 0.6, nosePow: 3.6, cornerF: 0.16, w0F: 0.88,
    tailR: 0.07, tailRB: 0.12, tailY: 0.52, tailPow: 3.6, cornerR: 0.15, w0R: 0.9,
    lights: 'quadround', tailLights: 'triple', grille: 'wide', spoiler: 'duck', doors: 2, shoulder: 0.8,
    fenderGap: 0.06, flare: 0.02, nU: 6.5, nL: 7, tuck: 0.05,
    frame: 'chrome', frameW: 0.014, bPillar: 'body', quarter: false, bumpers: 'chrome', hoodScoop: true,
    exhaust: 'dual', tailPanel: 'black', fog: false, mirrors: 'door', antenna: 'whip', cowl: false,
    pillarA: 0.045,
    railF: 0.035,
    railR: 0.06,
    pillarC: 0.12,
    beltR: 0.69,
  },
  // Moteur central des années 90 : nez plongeant, habitacle avancé, capot moteur long, prises d'air latérales.
  midship: {
    overF: 0.46, nose: 0.37, hood: 0.59, belt: 0.62, deck: 0.7, tail: 0.69,
    ws: 0.28, roofF: 0.45, roofB: 0.58, rearB: 0.77, cabW: 0.86, roofW: 0.68, clear: 0.12,
    noseR: 0.24, noseRB: 0.12, noseY: 0.4, nosePow: 2.5, cornerF: 0.42, w0F: 0.55,
    tailR: 0.07, tailRB: 0.12, tailY: 0.5, tailPow: 3.3, cornerR: 0.24, w0R: 0.84,
    lights: 'popup', tailLights: 'bar', grille: 'slot', spoiler: 'tailwing', doors: 2, shoulder: 0.76,
    fenderGap: 0.05, flare: 0.04, nU: 4, sideIntake: true, quarter: true, exhaust: 'twin', lip: 'black',
    tailPanel: 'black', fog: false,
    beltR: 0.66,
    rwFillet: 0.55,
  },
  // Break sportif : pavillon long, hayon presque vertical, barres de toit, ailes élargies.
  wagon: {
    overF: 0.55, nose: 0.53, hood: 0.62, belt: 0.665, deck: 0.71, tail: 0.69,
    ws: 0.33, roofF: 0.48, roofB: 0.88, rearB: 0.975, cabW: 0.91, roofW: 0.74, clear: 0.13, rearPow: 1.1,
    noseR: 0.15, noseRB: 0.08, noseY: 0.6, nosePow: 3, cornerF: 0.3, w0F: 0.74,
    tailR: 0.07, tailRB: 0.12, tailY: 0.45, tailPow: 3.2, cornerR: 0.22, w0R: 0.82,
    lights: 'led', tailLights: 'wide', grille: 'single', spoiler: 'roof', doors: 4, shoulder: 0.8,
    flare: 0.05, fenderGap: 0.055, roofRails: true, exhaust: 'oval', antenna: 'fin', diffuser: 'small',
    skirt: 'black', lip: 'black',
    beltR: 0.69,
    sideEnd: 0.935,
    roofDrop: 0.018,
  },
  // Hypercar : très basse, cockpit en bulle, ailes saillantes, gros diffuseur, échappement central.
  hypercar: {
    overF: 0.44, nose: 0.3, hood: 0.5, belt: 0.6, deck: 0.66, tail: 0.66,
    ws: 0.27, roofF: 0.41, roofB: 0.51, rearB: 0.69, cabW: 0.68, roofW: 0.5, clear: 0.09,
    noseR: 0.3, noseRB: 0.1, noseY: 0.32, nosePow: 2.2, cornerF: 0.5, w0F: 0.6,
    tailR: 0.05, tailRB: 0.08, tailY: 0.55, tailPow: 3.4, cornerR: 0.22, w0R: 0.86,
    lights: 'blade', tailLights: 'ring', grille: 'aero', spoiler: 'duck', doors: 2, shoulder: 0.82,
    flare: 0.08, valley: 0.1, fenderGap: 0.04, nU: 3.6, sideIntake: true, quarter: false,
    diffuser: 'big', exhaust: 'center', lip: 'carbon', skirt: 'carbon', fog: false,
  },
};

// Style effectif d'une voiture (style de base + surcharges de la fiche)
export function resolveStyle(spec) {
  return { ...DEFAULTS, ...(STYLES[spec.style] || STYLES.coupe), ...(spec.body || {}) };
}
