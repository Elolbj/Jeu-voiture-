// Modèles de voitures procéduraux : assemblage (caisse, habitacle vitré, décalques, pièces, roues, intérieur,
// pilote), matériaux (peinture vernie / métallisée / nacrée / mate / satinée / chromée, carbone tissé…),
// personnalisation en direct (applyCustom), personnalisations aléatoires des adversaires (randomCustom),
// niveaux de détail automatiques et cache des géométries par modèle (lots fusionnés par matériau : carMerge.js).
import * as THREE from 'three';
import { rng } from '../core/utils.js';
import { STYLES, resolveStyle } from './carStyles.js';
import { BodyShape, Atlas, buildBodyGeometry, buildCabin, atlasUV, fixNormals } from './carBody.js';
import { buildDecals } from './carDecals.js';
import { buildWheel, buildWing, wingKind, buildBodyParts, wellsGeometry, lowWheelsGeometry, rimGeometry, rimRadius, RIM_STYLES, tireDiscGeometry, caliperGeometry } from './carParts.js';
import { buildInterior, buildDriver, gloveParts } from './carInterior.js';
import { paintLivery, releaseLivery, LIVERY_DESIGNS, contrast } from './livery.js';
import { flakeNormal, carbonTextures, honeycomb, barsGrille, meshGrille, plateTexture, badgeAtlas, gaugeTexture, seatTexture, wheelAtlas } from './carTextures.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Batch, CH, trimMaterial, wheelSetMaterial, shadowProxy } from './carMerge.js';

export { STYLES, resolveStyle, LIVERY_DESIGNS, RIM_STYLES };
export const PAINT_FINISHES = ['gloss', 'metallic', 'pearl', 'matte', 'satin', 'chrome'];
export const WING_TYPES = ['stock', 'none', 'lip', 'duck', 'gt'];

// ---------------------------------------------------------------------------
// Matériaux partagés
// ---------------------------------------------------------------------------
const MAT = new Map();
function shared(key, make) {
  let m = MAT.get(key);
  if (!m) { m = make(); MAT.set(key, m); }
  return m;
}
const decal = (m) => { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2; return m; };

export function carMaterials() {
  return {
    blk: shared('blk', () => decal(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.34, metalness: 0.2 }))),
    plastic: shared('plastic', () => new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.72, metalness: 0.05 })),
    chrome: shared('chrome', () => new THREE.MeshStandardMaterial({ color: 0xeef0f3, vertexColors: true, roughness: 0.06, metalness: 1 })),
    mirror: shared('mirror', () => new THREE.MeshStandardMaterial({ color: 0xd6dde3, roughness: 0.02, metalness: 1 })),
    carbon: shared('carbon', () => {
      const t = carbonTextures();
      t.map.repeat.set(22, 22);
      t.normalMap.repeat.set(22, 22);
      return new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.34, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04 });
    }),
    lp: shared('lp', () => decal(new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.85, roughness: 0.13, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.3 }))),
    drl: shared('drl', () => decal(new THREE.MeshStandardMaterial({ color: 0xe8eef8, roughness: 0.3, emissive: 0xe4ecff, emissiveIntensity: 1.6 }))),
    grille: shared('grille', () => decal(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.35, map: honeycomb() }))),
    grilleBars: shared('grilleBars', () => decal(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.7, map: barsGrille() }))),
    grilleMesh: shared('grilleMesh', () => decal(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.4, map: meshGrille() }))),
    badge: shared('badge', () => decal(new THREE.MeshStandardMaterial({ color: 0xffffff, map: badgeAtlas(), alphaTest: 0.35, metalness: 0.55, roughness: 0.28 }))),
    well: shared('well', () => new THREE.MeshStandardMaterial({ color: 0x060607, roughness: 1, metalness: 0, side: THREE.DoubleSide })),
    interior: shared('interior', () => new THREE.MeshStandardMaterial({ color: 0x1f2024, vertexColors: true, roughness: 0.82, metalness: 0.05, envMapIntensity: 0.35 })),
    interiorBack: shared('interiorBack', () => new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.92, side: THREE.BackSide })),
    seat: shared('seat', () => new THREE.MeshStandardMaterial({ color: 0xffffff, map: seatTexture(), roughness: 0.92, envMapIntensity: 0.35 })),
    seatRace: shared('seatRace', () => new THREE.MeshStandardMaterial({ color: 0xffffff, map: seatTexture('#8c1218'), roughness: 0.9, envMapIntensity: 0.35 })),
    gauge: shared('gauge', () => { const g = gaugeTexture(); return new THREE.MeshStandardMaterial({ color: 0xffffff, map: g, emissiveMap: g, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.35 }); }),
    cage: shared('cage', () => new THREE.MeshStandardMaterial({ color: 0x9a9da3, metalness: 0.8, roughness: 0.4 })),
    fabric: shared('fabric', () => new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.96, metalness: 0 })),
    lowWheel: shared('lowWheel', () => new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.6, metalness: 0.3 })),
    visor: shared('visor', () => new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.05, metalness: 0.7 })),
    // vitrage lointain : opaque (pas d'habitacle au niveau de détail 1, pas de tri des transparents)
    glassFar: shared('glassFar', () => new THREE.MeshStandardMaterial({ color: 0x0c1015, roughness: 0.06, metalness: 0.4, envMapIntensity: 1.3 })),
  };
}

function glassMaterial(tint) {
  const k = Math.round(Math.min(1, Math.max(0, tint)) * 20) / 20;
  return shared('glass' + k, () => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x0b1015).lerp(new THREE.Color(0x020304), k), metalness: 0.0, roughness: 0.03,
    transparent: true, opacity: 0.56 + 0.4 * k, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.5, depthWrite: false,
  }));
}
function plateMaterial(text) {
  return shared('plate|' + text, () => decal(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, map: plateTexture(text) })));
}
function wheelMaterial(kind) {
  return shared('wheel|' + kind, () => {
    const a = wheelAtlas(kind);
    return new THREE.MeshStandardMaterial({ color: 0xffffff, map: a.map, roughnessMap: a.orm, metalnessMap: a.orm, roughness: 1, metalness: 1 });
  });
}
function suitMaterial(color) {
  return shared('suit|' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05 }));
}
function helmetMaterial(color) {
  return shared('helmet|' + color, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }));
}

// Finitions de peinture
const FINISH = {
  gloss: { metalness: 0.02, roughness: 0.3, clearcoat: 1, ccr: 0.03, flakes: 0 },
  metallic: { metalness: 0.55, roughness: 0.34, clearcoat: 1, ccr: 0.03, flakes: 0.13 },
  pearl: { metalness: 0.35, roughness: 0.3, clearcoat: 1, ccr: 0.03, flakes: 0.09, sheen: 0.35, iridescence: 0.25 },
  matte: { metalness: 0.12, roughness: 0.66, clearcoat: 0, ccr: 0.5, flakes: 0 },
  satin: { metalness: 0.3, roughness: 0.46, clearcoat: 0.35, ccr: 0.38, flakes: 0.06 },
  chrome: { metalness: 1, roughness: 0.07, clearcoat: 0.5, ccr: 0.02, flakes: 0 },
};
const CALIPER = { compacte: '#3a3c40', sport: '#b01515', gt: '#d4a017', supercar: '#d4a017', course: '#c81010', proto: '#1a1a1c' };
const DISC = { compacte: 'slotted', sport: 'drilled', gt: 'drilled', supercar: 'carbon', course: 'slotted', proto: 'slotted' };
const RIM_FINISH = {
  gloss: { metalness: 0.75, roughness: 0.24 },
  matte: { metalness: 0.45, roughness: 0.62 },
  chrome: { metalness: 1, roughness: 0.04 },
};

// ---------------------------------------------------------------------------
// Cache des géométries par modèle (les voitures identiques d'une grille les partagent)
// ---------------------------------------------------------------------------
const GEO_CACHE = new Map();
function modelKey(spec) {
  return [spec.id, spec.style, JSON.stringify(spec.body || {}), spec.lowered || 0, spec.wheel.radius, spec.wheel.width, spec.weightFront, Object.values(spec.dims).join(',')].join('|');
}

// Géométrie partagée (jamais libérée par une voiture) ; normales nulles corrigées (évite les NaN du rendu)
function markShared(g) {
  if (!g) return g;
  g.__shared = true;
  if (g.attributes.normal) fixNormals(g);
  return g;
}

function withColor(g, col) {
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

function liveryLayout(shape, atlas, cab, key) {
  const st = shape.st;
  const prof = [];
  for (let i = 0; i <= 90; i++) {
    const P = shape.profile(i / 90, {});
    prof.push({ z: P.z, W: P.W, top: P.top, topF: P.topF, bot: P.bot, ys: P.ys });
  }
  const zWS = shape.zOf(st.ws);
  const archF = shape.zAxleF + shape.archR + 0.07, archR0 = shape.zAxleR - shape.archR - 0.06;
  const doors = [];
  if (st.doors > 0) {
    const d0 = Math.max(zWS - 0.06, archF);
    if (st.doors === 4 && cab.side.length > 1) {
      const zB = shape.zOf(cab.side[0].t1) + 0.012;
      doors.push({ z0: d0, z1: zB });
      doors.push({ z0: zB + 0.006, z1: Math.min(shape.zOf(cab.side[1].t1) + 0.01, archR0) });
    } else {
      doors.push({ z0: d0, z1: Math.min(shape.zOf(cab.side[0].t1) + 0.02, archR0) });
    }
  } else {
    doors.push({ z0: archF, z1: archR0 });
  }
  const archTop = shape.r + shape.archR * 0.97;
  const secR = shape.cabSection((st.roofF + st.roofB) / 2);
  return {
    key, atlas, prof, doors: st.doors > 0 ? doors : [], panel: { z0: doors[0].z0, z1: doors[doors.length - 1].z1 },
    zF: shape.zFront, zR: shape.zRear, zAxleF: shape.zAxleF, zAxleR: shape.zAxleR, archR: shape.archR,
    archTopF: archTop, archTopR: archTop, W: shape.Wmax, L: shape.L,
    sill: shape.clear + 0.02, belt: shape.belt, zWS, zRoofF: shape.zOf(st.roofF), zRoofB: shape.zOf(st.roofB), roofW: secR.wr * 2,
    race: !!st.race,
    fuel: st.race || st.doors === 0 ? null : { z: shape.zAxleR - shape.archR * 0.1, y: (archTop + 0.05 + shape.belt) / 2, r: 0.05 },
    hood: st.doors === 0 ? null : { z0: shape.zFront + shape.overF * 0.3, z1: zWS - 0.04 },
    hoodK: st.valley ? 0.62 : 0.8,
    trunk: st.rearB < 0.95 && st.doors !== 0 ? { z0: shape.zOf(st.rearB) + 0.03, z1: shape.zRear - 0.12 } : null,
  };
}

function getCache(spec) {
  const key = modelKey(spec);
  let C = GEO_CACHE.get(key);
  if (C) return C;
  const shape = new BodyShape(spec);
  const atlas = new Atlas(shape);
  const body = markShared(buildBodyGeometry(shape, atlas, 0));
  const cab = buildCabin(shape, atlas, 0);
  const cabLow = buildCabin(shape, atlas, 1);
  for (const c of [cab, cabLow]) {
    for (const k of ['paint', 'special', 'fabric']) if (c[k]) markShared(withColor(c[k], [1, 1, 1]));
    if (c.glass) markShared(c.glass);
  }
  if (cab.frames) markShared(withColor(cab.frames, shape.st.frame === 'chrome' ? [1, 1, 1] : [0.018, 0.018, 0.02]));
  const decals = buildDecals(shape, spec, body, 0);
  const bodyLow = markShared(buildBodyGeometry(shape, atlas, 1));
  const decalsLow = buildDecals(shape, spec, body, 1);
  delete body.__proj;
  for (const g of Object.values(decals.geos)) markShared(g);
  for (const g of Object.values(decalsLow.geos)) markShared(g);
  const parts = buildBodyParts(shape, spec, decals.exhaust).merge();
  if (parts.paint) atlasUV(parts.paint, atlas);
  for (const g of Object.values(parts)) markShared(g);
  C = {
    key, shape, atlas, body, bodyLow, cab, cabLow, decals, decalsLow, parts,
    wells: markShared(wellsGeometry(shape, spec)),
    lowWheels: markShared(lowWheelsGeometry(spec, shape)),
    layout: liveryLayout(shape, atlas, cab.layout, key),
    wings: new Map(),
    interior: null,
    driver: null,
  };
  GEO_CACHE.set(key, C);
  return C;
}

function wingGeos(C, spec, kind) {
  let w = C.wings.get(kind);
  if (!w) {
    w = buildWing(kind, C.shape, spec).merge();
    if (w.paint) atlasUV(w.paint, C.atlas);
    for (const g of Object.values(w)) markShared(g);
    C.wings.set(kind, w);
  }
  return w;
}

function interiorGeos(C, spec) {
  if (!C.interior) {
    const it = buildInterior(C.shape, spec);
    const geos = it.buckets.merge();
    for (const g of Object.values(geos)) markShared(g);
    C.interior = { geos, wheel: markShared(mergeGeometries(it.wheelParts, false)), gloves: markShared(mergeGeometries(gloveParts(), false)), frame: it.frame };
  }
  return C.interior;
}

function driverGeos(C) {
  if (!C.driver) {
    const d = buildDriver(C.shape);
    for (const g of Object.values(d)) markShared(g);
    C.driver = d;
  }
  return C.driver;
}

// ---------------------------------------------------------------------------
// Personnalisation effective (contrat C) : champs absents = d'origine
// ---------------------------------------------------------------------------
const RACE_ACCENTS = ['#f4f5f2', '#111418', '#d4001a', '#ffcc00', '#0f4dbc', '#00a37a', '#ff6a00'];
function pickContrasting(base, pool, r) {
  const cb = new THREE.Color(base);
  const cands = pool.filter((c) => {
    const cc = new THREE.Color(c);
    return Math.abs(cc.r - cb.r) + Math.abs(cc.g - cb.g) + Math.abs(cc.b - cb.b) > 0.6;
  });
  const list = cands.length ? cands : pool;
  return list[Math.floor((r ? r() : 0) * list.length) % list.length];
}

export function effectiveCustom(spec, opts = {}) {
  const c = opts.custom || {};
  const st = resolveStyle(spec);
  const raceLiv = !!spec.livery;
  const color = c.paint?.color || opts.color || spec.paints?.[0] || '#c8102e';
  const paint = { color, finish: FINISH[c.paint?.finish] ? c.paint.finish : raceLiv ? 'gloss' : 'metallic', pearl: c.paint?.pearl || null };
  let livery = null;
  if (c.livery) {
    livery = {
      design: LIVERY_DESIGNS.includes(c.livery.design) ? c.livery.design : 'none',
      color: c.livery.color || contrast(color), color2: c.livery.color2 || null,
      number: c.livery.number ?? null, sponsors: !!c.livery.sponsors,
    };
  } else if (raceLiv) {
    livery = { design: 'racing', color: contrast(color) === '#111418' ? '#0b2e6b' : '#f4f5f2', color2: pickContrasting(color, ['#d4001a', '#ffcc00', '#00a3e0', '#ff6a00']), number: opts.number ?? 7, sponsors: true };
  } else if (opts.number !== undefined && opts.number !== null) {
    livery = { design: 'none', color: contrast(color), color2: null, number: opts.number, sponsors: false };
  }
  const rims = {
    style: RIM_STYLES.includes(c.rims?.style) ? c.rims.style : spec.wheel.rim || 'five',
    color: c.rims?.color || spec.wheel.rimColor || '#b8bcc2',
    finish: RIM_FINISH[c.rims?.finish] ? c.rims.finish : 'gloss',
  };
  return {
    paint, livery, rims,
    caliper: c.caliper || CALIPER[spec.category] || '#333333',
    tint: Math.min(1, Math.max(0, c.tint ?? (st.race ? 0.15 : 0.35))),
    wing: WING_TYPES.includes(c.wing) ? c.wing : 'stock',
    plate: String(c.plate || 'TR-998-AJ').toUpperCase().slice(0, 9),
    sponsorIdx: opts.sponsor ?? 0,
  };
}

// Personnalisation plausible pour un adversaire (déterministe selon la graine et le modèle) :
// voitures de course en livrée complète, classiques sobres, sportives parfois préparées.
export function randomCustom(spec, seed = 1, color) {
  let h = (Math.imul((seed | 0) + 1, 2654435761) ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < spec.id.length; i++) h = Math.imul(h ^ spec.id.charCodeAt(i), 16777619) >>> 0;
  const r = rng(h || 7);
  const st = resolveStyle(spec);
  const race = !!spec.livery || !!st.race;
  const classic = st.bumpers === 'chrome' || (spec.year || 2000) < 1975;
  const cat = spec.category;
  const base = color || r.pick(spec.paints || ['#c8102e']);
  const finish = race ? r.pick(['gloss', 'gloss', 'gloss', 'metallic', 'pearl', 'satin'])
    : classic ? r.pick(['gloss', 'gloss', 'metallic'])
      : r.pick(['metallic', 'metallic', 'metallic', 'gloss', 'gloss', 'pearl', 'satin', cat === 'supercar' || cat === 'gt' ? 'matte' : 'metallic']);
  const paint = { color: base, finish };
  if (finish === 'pearl') paint.pearl = r.pick(['#c9e4ff', '#ffd6f0', '#d8ffd6', '#fff1c4', '#e0d0ff']);
  const c1 = pickContrasting(base, RACE_ACCENTS, r);
  const c2 = pickContrasting(c1, RACE_ACCENTS.filter((x) => x !== c1), r);
  const out = { paint };
  if (race) {
    out.livery = { design: r.pick(['racing', 'racing', 'racing', 'stripes', 'split', 'chevron', 'retro', 'gradient', 'side']), color: c1, color2: c2, number: r.int(2, 99), sponsors: true };
  } else {
    // routières : livrée discrète et rare (bandes, filets latéraux), numéro et sponsors pour les amateurs de piste
    const pLiv = classic ? 0.18 : cat === 'supercar' ? 0.15 : 0.28;
    if (r() < pLiv) {
      const designs = classic ? ['stripes', 'retro', 'stripes'] : ['stripes', 'side', 'side', 'split', 'retro', 'gradient', 'chevron'];
      const trackDay = !classic && r() < 0.3;
      out.livery = { design: r.pick(designs), color: c1, color2: c2, number: trackDay || (classic && r() < 0.4) ? r.int(1, 99) : null, sponsors: trackDay };
    }
  }
  const pools = {
    compacte: ['five', 'six', 'ten', 'split', 'multi'],
    sport: ['five', 'six', 'ten', 'split', 'mesh', 'turbine', 'multi'],
    gt: ['five', 'split', 'mesh', 'multi', 'turbine', 'six'],
    supercar: ['split', 'five', 'turbine', 'multi', 'race'],
    course: ['race', 'mesh', 'ten', 'six'],
    proto: ['race', 'mesh', 'ten'],
  };
  const pool = classic ? ['classic', 'five', 'mesh', 'classic'] : pools[cat] || RIM_STYLES;
  const rimFinish = classic ? r.pick(['chrome', 'chrome', 'gloss']) : r.pick(['gloss', 'gloss', 'gloss', 'matte', race ? 'gloss' : 'chrome']);
  const rimColors = classic ? ['#d3d6da', '#c9ccd1', '#e2e4e8'] : ['#c9ccd1', '#2a2c30', '#1b1c1f', '#b9a06a', '#e2e4e8', '#3b3e45', '#8d9096'];
  out.rims = {
    style: r() < 0.4 ? spec.wheel.rim || 'five' : r.pick(pool),
    color: rimFinish === 'chrome' ? '#e6e8ec' : r.pick(rimColors),
    finish: rimFinish,
  };
  out.caliper = classic ? r.pick(['#3a3c40', '#2a2b2e']) : r.pick(['#c8102e', '#d4a017', '#1b1c1f', '#2453a4', '#e05a00', '#9a9da3', '#c8102e']);
  out.tint = race ? 0.15 : classic ? Math.round(r.range(0.1, 0.3) * 20) / 20 : Math.round(r.range(0.2, 0.8) * 20) / 20;
  // aileron : jamais sur les classiques ni les voitures de course (aéro homologuée)
  const wings = race || classic ? ['stock']
    : cat === 'compacte' ? ['stock', 'stock', 'stock', 'stock', 'lip', 'duck']
      : cat === 'supercar' ? ['stock', 'stock', 'stock', 'lip']
        : ['stock', 'stock', 'stock', 'stock', 'lip', 'duck', 'gt'];
  out.wing = r.pick(wings);
  const L = 'ABCDEFGHJKLMNPRSTVWXYZ';
  out.plate = `${L[r.int(0, 21)]}${L[r.int(0, 21)]}-${r.int(100, 999)}-${L[r.int(0, 21)]}${L[r.int(0, 21)]}`;
  return out;
}

// ---------------------------------------------------------------------------
// Lots fusionnés par matériau (cache par modèle) : un appel de dessin par matériau au lieu d'un par pièce
// ---------------------------------------------------------------------------
const RM = {
  blk: [0.34, 0.2], chrome: [0.06, 1], mirror: [0.02, 1], plastic: [0.72, 0.05], lp: [0.13, 0.85], well: [1, 0],
  fabric: [0.96, 0], cage: [0.4, 0.8], visor: [0.05, 0.7], suit: [0.75, 0.05], helmet: [0.25, 0.2], interior: [0.82, 0.05],
  back: [0.92, 0], glass: [0.06, 0.4], low: [0.6, 0.3], carbon: [0.34, 0.3],
};
const tr = (k, ch = 0) => [RM[k][0], RM[k][1], ch];
// pièces (carrosserie, ailerons) : matériau d'origine → apparence dans le lot des garnitures
const PART_TRIM = {
  blk: { trim: tr('blk') }, chrome: { tint: 0xeef0f3, trim: tr('chrome') }, mirror: { solid: 0xd6dde3, trim: tr('mirror') },
  plastic: { solid: 0x121316, trim: tr('plastic') },
};
const DECAL_TRIM = {
  lp: { trim: tr('lp') }, lens: { solid: 0xcfd6de, trim: [0.12, 0.85, CH.head] }, drl: { solid: 0xe8eef8, trim: [0.3, 0, CH.drl] },
  led: { solid: 0x5a0007, trim: [0.15, 0.1, CH.tail] }, blk: { trim: tr('blk') },
};
const DECAL_TEX = ['grille', 'grille2', 'badge', 'plate'];

function carBatches(C, spec, st, wingK, driver, showroom) {
  const key = `${wingK}|${driver ? 1 : 0}|${showroom ? 1 : 0}`;
  C.batches = C.batches || new Map();
  let B = C.batches.get(key);
  if (B) return B;
  const W = wingGeos(C, spec, wingK);
  const IT = interiorGeos(C, spec);
  // Carrosserie peinte (livrée)
  const paint = new Batch({ uv: true });
  paint.add(C.body).add(C.cab.paint).add(W.paint);
  // Carbone (textures)
  const carbon = new Batch({ uv: true, color: false });
  carbon.add(C.cab.special).add(W.carbon);
  // Garnitures : vitrage de cadre, joints, feux, chromes, passages de roues, arceau, pilote
  const trim = new Batch({ trim: true });
  const chromeF = st.frame === 'chrome';
  trim.add(C.cab.frames, chromeF ? { tint: 0xeef0f3, trim: tr('chrome') } : { trim: tr('blk') });
  trim.add(C.cab.fabric, { solid: 0x151517, trim: tr('fabric') });
  for (const [k, g] of Object.entries(C.decals.geos)) if (!DECAL_TEX.includes(k)) trim.add(g, DECAL_TRIM[k] || DECAL_TRIM.blk);
  for (const [k, g] of Object.entries(C.parts)) {
    if (k === 'paint') paint.add(g);
    else if (k === 'carbon') carbon.add(g);
    else trim.add(g, PART_TRIM[k] || PART_TRIM.blk);
  }
  trim.add(W.blk, PART_TRIM.blk);
  // passages de roues (double face) ; en vitrine, maillage à part (masqué dans le reflet)
  if (!showroom) {
    trim.add(C.wells, { solid: 0x060607, trim: tr('well') });
    trim.add(C.wells, { solid: 0x060607, trim: tr('well'), flip: true });
  }
  if (IT.geos.cage) trim.add(IT.geos.cage, { solid: 0x9a9da3, trim: tr('cage') });
  if (driver) {
    const D = driverGeos(C);
    trim.add(D.suit, { solid: 0xffffff, trim: tr('suit', CH.suit) });
    trim.add(D.helmet, { solid: 0xffffff, trim: tr('helmet', CH.helmet) });
    trim.add(D.visor, { solid: 0x0b0d10, trim: tr('visor') });
  }
  // Niveau lointain : caisse simplifiée + garnitures et roues simplifiées en un seul lot
  const paintLow = new Batch({ uv: true });
  paintLow.add(C.bodyLow).add(C.cabLow.paint).add(W.paint);
  const trimLow = new Batch({ trim: true });
  trimLow.add(C.cabLow.glass, { solid: 0x0c1015, trim: tr('glass') });
  trimLow.add(C.cabLow.fabric, { solid: 0x151517, trim: tr('fabric') });
  for (const [k, g] of Object.entries(C.decalsLow.geos)) if (!DECAL_TEX.includes(k)) trimLow.add(g, DECAL_TRIM[k] || DECAL_TRIM.blk);
  trimLow.add(C.lowWheels, { trim: tr('low') });
  trimLow.add(W.blk, PART_TRIM.blk);
  trimLow.add(W.carbon, { solid: 0x1a1a1c, trim: tr('carbon') });
  // Proxy d'ombre portée (silhouette simplifiée, roues comprises)
  const proxy = new Batch({ color: false });
  proxy.add(C.bodyLow).add(C.cabLow.paint).add(W.paint).add(W.blk).add(W.carbon).add(C.lowWheels);
  B = { paint: paint.build(), carbon: carbon.build(), trim: trim.build(), paintLow: paintLow.build(), trimLow: trimLow.build(), proxy: proxy.build() };
  C.batches.set(key, B);
  return B;
}

// Habitacle : garnissage + envers du pavillon (un lot), volant (+ gants)
function interiorBatches(C, spec) {
  if (C.intBatch) return C.intBatch;
  const IT = interiorGeos(C, spec);
  const b = new Batch({ trim: true });
  for (const [k, g] of Object.entries(IT.geos)) {
    if (k === 'interior') b.add(g, { tint: 0x1f2024, trim: tr('interior') });
    else if (!['seat', 'gauge', 'cage'].includes(k)) b.add(g, { tint: 0x1f2024, trim: tr('interior') });
  }
  b.add(C.cab.paint, { solid: 0x17181b, trim: tr('back'), flip: true });
  const sw = (gloves) => new Batch({ trim: true }).add(IT.wheel, { trim: tr('blk') }).add(gloves ? IT.gloves : null, { trim: tr('blk') }).build();
  C.intBatch = { trim: b.build(), wheel: sw(false), wheelGloves: sw(true) };
  return C.intBatch;
}

// Les quatre roues (pneu + disque, jante, étrier) dans un seul maillage à squelette : 8 os (rotation, braquage)
function wheelSetGeometry(C, spec, rimStyle) {
  C.wheelSets = C.wheelSets || new Map();
  let g = C.wheelSets.get(rimStyle);
  if (g) return g;
  const R = spec.wheel.radius, w = spec.wheel.width, rr = rimRadius(spec.wheel);
  const b = new Batch({ uv: true, skin: true, sel: true });
  const M = new THREE.Matrix4(), S = new THREE.Matrix4();
  for (let i = 0; i < 4; i++) {
    const p = wheelRest(C.shape, spec, i);
    M.makeTranslation(p.x, p.y, p.z);
    if (i % 2 === 0) M.multiply(S.makeScale(-1, 1, 1));
    b.add(tireDiscGeometry(R, w, i % 2 === 0, rr), { matrix: M, bone: i, sel: 0, white: true });
    b.add(rimGeometry(R, w, rimStyle, rr), { matrix: M, bone: i, sel: 1 });
    b.add(caliperGeometry(rr * 0.84, w), { matrix: M, bone: 4 + i, sel: 2, white: true });
  }
  g = b.build();
  C.wheelSets.set(rimStyle, g);
  return g;
}
function wheelRest(shape, spec, i) {
  return new THREE.Vector3((i % 2 === 0 ? -1 : 1) * spec.dims.track * 0.5, spec.wheel.radius, i < 2 ? shape.zAxleF : shape.zAxleR);
}

// ---------------------------------------------------------------------------
// Niveaux de détail automatiques : le moteur de rendu appelle updateCarLods(caméra) avant chaque image.
// Seuils en « mètres équivalents » à 60° de champ (la taille à l'écran compte, pas la distance brute).
// ---------------------------------------------------------------------------
const LIVE = new Set();
const LOD_FAR = 55, LOD_DETAIL = 14, LOD_INTERIOR = 16;
const _cp = new THREE.Vector3();
const TAN30 = Math.tan(Math.PI / 6);
export function updateCarLods(camera) {
  if (!LIVE.size) return;
  if (camera.parent) _cp.setFromMatrixPosition(camera.matrixWorld); else _cp.copy(camera.position);
  const fk = camera.isPerspectiveCamera ? Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2 / (camera.zoom || 1)) / TAN30 : 1;
  for (const m of LIVE) m.autoLod(_cp, fk);
}

// ---------------------------------------------------------------------------
export class CarModel {
  constructor(spec, opts = {}) {
    this.spec = spec;
    this.opts = opts;
    const st = resolveStyle(spec);
    this.style = st;
    const M = carMaterials();
    this.mats = M;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.body.position.y = -(spec.cgHeight - (spec.lowered || 0));
    this.root.add(this.body);
    const C = getCache(spec);
    this.cache = C;
    const shape = C.shape;
    this.shape = shape;
    this.liveryRes = opts.liveryRes || 1024;
    this.showroom = !!opts.showroom;

    // Matériaux propres à cette voiture
    this.paint = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.15 });
    this.trimMat = trimMaterial();
    this.intMat = shared('intTrim', () => trimMaterial({ envMapIntensity: 0.35, polygonOffset: false }));

    this.lod0 = new THREE.Group();
    this.lod1 = new THREE.Group();
    this.body.add(this.lod0, this.lod1);
    const mesh = (parent, geo, mat, order = 0) => {
      const m = new THREE.Mesh(geo || EMPTY, mat);
      m.receiveShadow = true;
      if (order) m.renderOrder = order;
      m.visible = !!geo;
      parent.add(m);
      return m;
    };
    // --- Lots fusionnés (géométries affectées par setBatches) ---
    this.bodyMesh = mesh(this.lod0, null, this.paint);
    this.trimMesh = mesh(this.lod0, null, this.trimMat, 1);
    this.carbonMesh = mesh(this.lod0, null, M.carbon);
    this.paintLowMesh = mesh(this.lod1, null, this.paint);
    this.trimLowMesh = mesh(this.lod1, null, this.trimMat, 1);
    this.proxy = shadowProxy(null);
    this.body.add(this.proxy);
    // --- Vitrage (transparent de près, opaque quand l'habitacle n'est pas dessiné) ---
    this.glassNear = glassMaterial(0.35);
    this.glassMesh = mesh(this.lod0, C.cab.glass, this.glassNear, 2);
    this.glassMesh.receiveShadow = false;
    this.glassMeshes = [this.glassMesh];
    // --- Décalques texturés (calandres, logos, plaques) : seulement de près ---
    this.details = new THREE.Group();
    this.lod0.add(this.details);
    this.plateMeshes = [];
    const decalMat = { grille: M.grille, grille2: st.grille === 'wide' ? M.grilleMesh : M.grilleBars, badge: M.badge, plate: plateMaterial('TR-998-AJ') };
    for (const k of DECAL_TEX) {
      const g = C.decals.geos[k];
      if (!g) continue;
      const m = mesh(this.details, g, decalMat[k], 1);
      if (k === 'plate') this.plateMeshes.push(m);
    }
    if (this.showroom) mesh(this.lod0, C.wells, M.well);
    // --- Roues ---
    this.wheels = [];
    if (this.showroom) {
      // vitrine : une roue = un groupe (reflet par clonage, pose statique)
      this.rimMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.75, roughness: 0.24 });
      this.caliperMat = new THREE.MeshStandardMaterial({ color: 0xb01515, metalness: 0.25, roughness: 0.35 });
      const wheelMat = wheelMaterial(DISC[spec.category] || 'drilled');
      for (let i = 0; i < 4; i++) {
        const wh = buildWheel(spec, i % 2 === 0, { wheel: wheelMat, rim: this.rimMat, caliper: this.caliperMat, rimStyle: spec.wheel.rim });
        wh.steer.position.copy(wheelRest(shape, spec, i));
        wh.baseY = spec.wheel.radius;
        this.lod0.add(wh.steer);
        this.wheels.push(wh);
      }
    } else {
      // course : un seul maillage à squelette pour les quatre roues
      const atlas = wheelAtlasFor(spec);
      this.wheelMat = wheelSetMaterial(atlas);
      const ws = new THREE.SkinnedMesh(wheelSetGeometry(C, spec, spec.wheel.rim || 'five'), this.wheelMat);
      ws.receiveShadow = true;
      const bones = [];
      for (let i = 0; i < 8; i++) {
        const b = new THREE.Bone();
        b.position.copy(wheelRest(shape, spec, i % 4));
        b.rotation.order = 'YXZ';
        ws.add(b);
        bones.push(b);
      }
      ws.updateMatrixWorld(true);
      ws.bind(new THREE.Skeleton(bones), new THREE.Matrix4());
      ws.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, spec.wheel.radius, (shape.zAxleF + shape.zAxleR) / 2),
        Math.hypot(spec.dims.track / 2 + spec.wheel.width, (shape.zAxleR - shape.zAxleF) / 2 + spec.wheel.radius) + 0.2);
      this.lod0.add(ws);
      this.wheelSet = ws;
      this.bones = bones;
      for (let i = 0; i < 4; i++) this.wheels.push({ bone: bones[i], cal: bones[4 + i], baseY: spec.wheel.radius });
    }
    // --- Intérieur et volant ---
    const IT = interiorGeos(C, spec);
    const IB = interiorBatches(C, spec);
    this.interior = new THREE.Group();
    this.lod0.add(this.interior);
    mesh(this.interior, IB.trim, this.intMat);
    const seatMat = st.race ? M.seatRace : M.seat;
    if (IT.geos.seat) mesh(this.interior, IT.geos.seat, seatMat);
    if (IT.geos.gauge) mesh(this.interior, IT.geos.gauge, M.gauge);
    const sw = new THREE.Group();
    sw.position.copy(IT.frame.wheel);
    sw.rotation.x = -0.42;
    this.wheelMesh = mesh(sw, IB.wheel, this.intMat);
    this.interior.add(sw);
    this.steeringWheel = sw;
    this.driverEye = IT.frame.eye.clone();
    // --- Aileron (fusionné dans les lots ; groupe conservé pour compatibilité) ---
    this.wingGroup = new THREE.Group();
    this.body.add(this.wingGroup);

    this.driverOn = false;
    this.brake = 0;
    this.lightsOn = false;
    this.cur = null;
    this.applyCustom(opts.custom || null);
    // Pilote : en course par défaut, jamais en vitrine
    if (opts.driver ?? !opts.showroom) this.buildDriver();
    this.setLights(false);
    this.lod = -1;
    this.view = '';
    this.setLod(0);
    LIVE.add(this);
  }

  // Affecte les géométries fusionnées selon l'aileron et la présence du pilote
  setBatches() {
    const B = carBatches(this.cache, this.spec, this.style, this.wingKind, this.driverOn, this.showroom);
    const set = (m, g) => { m.geometry = g || EMPTY; m.visible = !!g; };
    set(this.bodyMesh, B.paint);
    set(this.trimMesh, B.trim);
    set(this.carbonMesh, B.carbon);
    set(this.paintLowMesh, B.paintLow);
    set(this.trimLowMesh, B.trimLow);
    set(this.proxy, B.proxy);
    this.wheelMesh.geometry = this.driverOn ? this.cache.intBatch.wheelGloves : this.cache.intBatch.wheel;
  }

  buildDriver() {
    if (this.driverOn) return;
    this.driverOn = true;
    this.driver = this.trimMesh;
    this.setBatches();
    this.applyDriverColors();
  }

  applyDriverColors() {
    const cu = this.cur || effectiveCustom(this.spec, this.opts);
    const suitCol = cu.livery?.color && cu.livery.design !== 'none' ? cu.livery.color : cu.paint.color;
    const helmCol = cu.livery?.color2 || contrast(suitCol);
    const U = this.trimMat.userData.u;
    U.uSuit.value.set(suitCol);
    U.uHelmet.value.set(helmCol);
  }

  // Applique une personnalisation complète (contrat C) sans reconstruire la voiture
  applyCustom(custom) {
    const prev = this.cur;
    const cu = effectiveCustom(this.spec, { ...this.opts, custom: custom || undefined });
    this.cur = cu;
    this.custom = custom || null;
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    // peinture + livrée
    if (!prev || !same(prev.paint, cu.paint) || !same(prev.livery, cu.livery)) this.applyPaint(cu);
    // jantes
    if (!prev || prev.rims.style !== cu.rims.style) {
      if (this.wheelSet) this.wheelSet.geometry = wheelSetGeometry(this.cache, this.spec, cu.rims.style);
      else {
        const g = rimGeometry(this.spec.wheel.radius, this.spec.wheel.width, cu.rims.style, rimRadius(this.spec.wheel));
        for (const w of this.wheels) w.rim.geometry = g;
      }
    }
    const f = RIM_FINISH[cu.rims.finish];
    if (this.wheelSet) {
      const U = this.wheelMat.userData.u;
      U.uRim.value.set(cu.rims.color);
      U.uRimRM.value.set(f.roughness, f.metalness);
      U.uCal.value.set(cu.caliper);
    } else {
      this.rimMat.color.set(cu.rims.color);
      this.rimMat.metalness = f.metalness;
      this.rimMat.roughness = f.roughness;
      this.caliperMat.color.set(cu.caliper);
    }
    // vitres
    if (!prev || prev.tint !== cu.tint) {
      const near = this.glassMesh.material === this.glassNear;
      this.glassNear = glassMaterial(cu.tint);
      if (near) this.glassMesh.material = this.glassNear;
    }
    // plaques
    if (!prev || prev.plate !== cu.plate) for (const m of this.plateMeshes) m.material = plateMaterial(cu.plate);
    // aileron
    const kind = wingKind(this.style, this.spec, cu.wing);
    if (kind !== this.wingKind) {
      this.wingKind = kind;
      this.setBatches();
    }
    // pilote : couleurs de combinaison / casque
    if (this.driverOn) this.applyDriverColors();
    return this;
  }

  applyPaint(cu) {
    const p = cu.paint, f = FINISH[p.finish] || FINISH.metallic;
    const m = this.paint;
    const liv = cu.livery;
    const hasLivery = !!liv && (liv.design !== 'none' || liv.number !== null || liv.sponsors);
    const tex = paintLivery(this.cache.layout, hasLivery
      ? { color: p.color, design: liv.design, color2: liv.color, color3: liv.color2, number: liv.number, sponsors: liv.sponsors, sponsorIdx: cu.sponsorIdx }
      : { base: true }, this.liveryRes);
    if (tex !== this.liveryTex) {
      tex.__users = (tex.__users || 0) + 1;
      if (this.liveryTex) releaseLivery(this.liveryTex);
      this.liveryTex = tex;
    }
    m.map = tex;
    m.color.set(hasLivery ? 0xffffff : p.color);
    m.metalness = f.metalness;
    m.roughness = f.roughness;
    m.clearcoat = f.clearcoat;
    m.clearcoatRoughness = f.ccr;
    m.normalMap = f.flakes ? flakeNormal() : null;
    m.normalScale.set(f.flakes, f.flakes);
    m.sheen = f.sheen || 0;
    if (f.sheen) {
      m.sheenColor.set(p.pearl || '#ffffff');
      m.sheenRoughness = 0.35;
    }
    m.iridescence = f.iridescence || 0;
    if (f.iridescence) { m.iridescenceIOR = 1.45; m.iridescenceThicknessRange = [180, 520]; }
    m.envMapIntensity = p.finish === 'chrome' ? 1.4 : 1.15;
    m.needsUpdate = true;
  }

  // Compatibilité : changement de couleur seule
  setColor(hex) {
    const c = this.custom ? { ...this.custom, paint: { ...(this.custom.paint || {}), color: hex } } : { paint: { color: hex } };
    this.applyCustom(c);
  }

  // Compatibilité : ancienne API de livrée ({ stripe, number, sponsor, style })
  setLivery(o = {}) {
    const design = o.style === 1 ? 'side' : o.style === 2 ? 'racing' : o.stripe ? 'stripes' : 'none';
    this.applyCustom({ ...(this.custom || {}), livery: { design, color: o.stripe || '#ffffff', number: o.number ?? null, sponsors: o.sponsor !== null && o.sponsor !== undefined } });
  }

  // Niveau de détail demandé : 0 = complet, 1 = lointain (affiné ensuite par autoLod selon la taille à l'écran)
  setLod(level) {
    this.lodWanted = level;
    const far = level >= 1;
    this.applyView(far, !far, !far && this.interiorWanted !== false);
  }

  // Choix automatique (appelé par le moteur de rendu) : k = distance équivalente à 60° de champ
  autoLod(camPos, fk) {
    const e = this.root.matrixWorld.elements;
    const dx = e[12] - camPos.x, dy = e[13] - camPos.y, dz = e[14] - camPos.z;
    const k = Math.sqrt(dx * dx + dy * dy + dz * dz) * fk;
    const far = this.lod === 1 ? k > LOD_FAR * 0.94 : k > LOD_FAR;
    this.applyView(far, k < LOD_DETAIL, k < LOD_INTERIOR && this.interiorWanted !== false);
  }

  applyView(far, details, interior) {
    const v = (far ? 4 : 0) + (details ? 2 : 0) + (interior ? 1 : 0);
    // l'intérieur peut avoir été masqué de l'extérieur (raceScene) : on réimpose l'état voulu
    if (v === this.view && this.interior.visible === interior) return;
    this.view = v;
    this.lod = far ? 1 : 0;
    this.lod0.visible = !far;
    this.lod1.visible = far;
    this.details.visible = details;
    this.interior.visible = interior;
    this.glassMesh.material = interior ? this.glassNear : this.mats.glassFar;
  }

  setLights(on) {
    this.lightsOn = on;
    this.trimMat.userData.u.uHead.value.setHex(0xfff2dd).multiplyScalar(on ? 4 : 0);
    this.trimMat.userData.u.uDrl.value.setHex(0xe4ecff).multiplyScalar(1.6);
    this.updateTail();
  }

  setBrake(b) {
    if (Math.abs(b - this.brake) < 0.02) return;
    this.brake = b;
    this.updateTail();
  }

  updateTail() {
    this.trimMat.userData.u.uTail.value.setHex(0xff1a10).multiplyScalar((this.lightsOn ? 1.6 : 0.45) + this.brake * 3.2);
  }

  // Met à jour la pose à partir de l'état physique (ou d'un enregistrement de replay).
  syncFromVehicle(v) {
    this.root.position.copy(v.position);
    this.root.quaternion.copy(v.quaternion);
    for (let i = 0; i < 4; i++) {
      const w = v.wheels[i];
      const m = this.wheels[i];
      const y = w.radius + w.Lstatic - w.L;
      if (m.bone) {
        m.bone.position.y = y;
        m.bone.rotation.y = -w.steer;
        m.bone.rotation.x = -w.spin;
        m.cal.position.y = y;
        m.cal.rotation.y = -w.steer;
      } else {
        m.steer.position.y = y;
        m.steer.rotation.y = -w.steer;
        m.spin.rotation.x = -w.spin;
      }
    }
    if (this.steeringWheel) this.steeringWheel.rotation.z = -v.steerAngle * 12;
    this.setBrake(Math.min(1, Math.max(0, v.controls.brake * 1.2)));
  }

  // Pose « statique » (vitrine)
  setStatic(steer = 0, spin = 0) {
    for (let i = 0; i < 4; i++) {
      const m = this.wheels[i];
      const st = i < 2 ? -steer : 0;
      if (m.bone) {
        m.bone.position.y = m.cal.position.y = m.baseY;
        m.bone.rotation.y = m.cal.rotation.y = st;
        m.bone.rotation.x = -spin;
      } else {
        m.steer.position.y = m.baseY;
        m.steer.rotation.y = st;
        m.spin.rotation.x = -spin;
      }
    }
  }

  // Compte de triangles / appels de dessin visibles (outil de mesure) ; shadows = appels de la passe d'ombre
  stats() {
    let tris = 0, draws = 0, shadows = 0;
    this.root.traverseVisible((o) => {
      if (!o.isMesh) return;
      if (o.userData.shadowProxy) { shadows++; return; }
      const g = o.geometry;
      const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
      tris += n;
      draws += Array.isArray(o.material) ? g.groups.length : 1;
      if (o.castShadow) shadows++;
    });
    return { tris: Math.round(tris), draws, shadows };
  }

  dispose() {
    LIVE.delete(this);
    this.root.traverse((o) => {
      if (o.geometry && !o.geometry.__shared) o.geometry.dispose?.();
    });
    this.wheelSet?.skeleton.dispose();
    if (this.liveryTex) releaseLivery(this.liveryTex);
    this.liveryTex = null;
    for (const m of [this.paint, this.trimMat, this.wheelMat, this.rimMat, this.caliperMat]) m?.dispose();
  }
}

const EMPTY = new THREE.BufferGeometry();
EMPTY.__shared = true;
function wheelAtlasFor(spec) {
  return wheelAtlas(DISC[spec.category] || 'drilled');
}
