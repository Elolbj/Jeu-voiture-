// Catalogue des voitures. Marques et modèles fictifs, caractéristiques réalistes.
// Unités : masse en kg, puissance en ch, couple en N·m, longueurs en m.

import { sampleKeys, clamp } from '../core/utils.js';

export const TIRES = {
  confort: { label: 'Pneus confort', mu: 0.95, alphaPeak: 0.125, kappaPeak: 0.12, slide: 0.8, loadSens: 0.09 },
  sport: { label: 'Pneus sport', mu: 1.05, alphaPeak: 0.115, kappaPeak: 0.11, slide: 0.78, loadSens: 0.09 },
  semi: { label: 'Semi-slicks', mu: 1.17, alphaPeak: 0.105, kappaPeak: 0.1, slide: 0.76, loadSens: 0.1 },
  course: { label: 'Slicks de course', mu: 1.36, alphaPeak: 0.095, kappaPeak: 0.095, slide: 0.72, loadSens: 0.11 },
};

export const CATEGORIES = {
  compacte: 'Compacte',
  sport: 'Sportive',
  gt: 'Grand Tourisme',
  supercar: 'Supercar',
  course: 'Voiture de course',
  proto: 'Prototype',
};

export const DRIVE_LABEL = {
  FF: 'Traction (FF)',
  FR: 'Propulsion (FR)',
  MR: 'Moteur central (MR)',
  RR: 'Moteur arrière (RR)',
  '4WD': 'Intégrale (4WD)',
};

const C = (id, o) => ({ id, ...o });

export const CARS = [
  C('kaze_r3', {
    brand: 'Kaze', model: 'R3 1.6', year: 1998, country: 'Japon', category: 'compacte', price: 11500,
    desc: "Une petite citadine japonaise, légère et fiable. Moteur atmosphérique qui aime monter dans les tours : l'école idéale du pilotage.",
    style: 'hatch', dims: { length: 3.95, width: 1.69, height: 1.39, wheelbase: 2.45, track: 1.47 },
    wheel: { radius: 0.288, width: 0.185, rim: 'five', rimColor: '#b8bcc2' },
    mass: 1040, cgHeight: 0.52, weightFront: 0.62, drive: 'FF',
    engine: { layout: 'L4', cyl: 4, displacement: 1.6, hp: 118, hpRpm: 6600, torque: 147, torqueRpm: 4800, idle: 850, redline: 7200, limiter: 7400, inertia: 0.13 },
    gearbox: { ratios: [3.31, 1.83, 1.31, 1.03, 0.82], final: 4.06, reverse: 3.25, shiftTime: 0.28 },
    tires: 'confort', susp: { freqF: 1.45, freqR: 1.6, zeta: 0.32, arbF: 0.5, arbR: 0.25 },
    aero: { cd: 0.33, area: 1.95, clF: 0.0, clR: 0.0 }, steerLock: 36, lsd: 0, brakeBias: 0.68,
    paints: ['#c8102e', '#f2f2ee', '#1d3f8f', '#202326', '#e3b505'],
  }),
  C('miyabi_rs', {
    brand: 'Miyabi', model: 'Roadster RS', year: 1999, country: 'Japon', category: 'sport', price: 22000,
    desc: "Le petit roadster propulsion par excellence : 1 030 kg, une répartition parfaite et un châssis d'une pureté rare.",
    style: 'roadster', dims: { length: 3.95, width: 1.68, height: 1.23, wheelbase: 2.27, track: 1.42 },
    wheel: { radius: 0.29, width: 0.195, rim: 'six', rimColor: '#c9ccd1' },
    mass: 1030, cgHeight: 0.46, weightFront: 0.51, drive: 'FR',
    engine: { layout: 'L4', cyl: 4, displacement: 1.8, hp: 146, hpRpm: 7000, torque: 168, torqueRpm: 5000, idle: 850, redline: 7200, limiter: 7400, inertia: 0.14 },
    gearbox: { ratios: [3.14, 1.89, 1.33, 1.0, 0.81], final: 4.3, reverse: 3.4, shiftTime: 0.24 },
    tires: 'sport', susp: { freqF: 1.6, freqR: 1.7, zeta: 0.34, arbF: 0.45, arbR: 0.3 },
    aero: { cd: 0.36, area: 1.75, clF: 0.0, clR: 0.0 }, steerLock: 34, lsd: 35, brakeBias: 0.64,
    paints: ['#b0131c', '#0e5a3c', '#f4f4ef', '#1b2c5c', '#c0c3c8'],
  }),
  C('valette_sprint', {
    brand: 'Valette', model: 'Sprint 2.0 RS', year: 2006, country: 'France', category: 'compacte', price: 24000,
    desc: "La petite bombe française. Châssis vif, train avant incisif, boîte six rapports bien étagée.",
    style: 'hatch', dims: { length: 3.99, width: 1.77, height: 1.42, wheelbase: 2.58, track: 1.52 },
    wheel: { radius: 0.31, width: 0.215, rim: 'split', rimColor: '#2b2d31' },
    mass: 1210, cgHeight: 0.53, weightFront: 0.62, drive: 'FF',
    engine: { layout: 'L4', cyl: 4, displacement: 2.0, hp: 200, hpRpm: 7150, torque: 215, torqueRpm: 5550, idle: 850, redline: 7350, limiter: 7500, inertia: 0.14 },
    gearbox: { ratios: [3.45, 2.13, 1.52, 1.21, 1.0, 0.84], final: 4.0, reverse: 3.5, shiftTime: 0.22 },
    tires: 'sport', susp: { freqF: 1.75, freqR: 1.95, zeta: 0.36, arbF: 0.45, arbR: 0.45 },
    aero: { cd: 0.34, area: 2.05, clF: 0.0, clR: 0.05 }, steerLock: 34, lsd: 0, brakeBias: 0.68,
    paints: ['#f2b705', '#1a49a8', '#e8e8e4', '#d1221f', '#3b3e43'],
  }),
  C('hoshi_civica', {
    brand: 'Hoshi', model: 'Civica Type-S', year: 2001, country: 'Japon', category: 'compacte', price: 27500,
    desc: "Le moteur 2 litres atmosphérique hurle jusqu'à 8 600 tr/min. Une traction redoutable entre des mains expertes.",
    style: 'hatch2', dims: { length: 4.14, width: 1.70, height: 1.44, wheelbase: 2.57, track: 1.48 },
    wheel: { radius: 0.3, width: 0.205, rim: 'ten', rimColor: '#d8d9db' },
    mass: 1190, cgHeight: 0.53, weightFront: 0.61, drive: 'FF',
    engine: { layout: 'L4', cyl: 4, displacement: 2.0, hp: 205, hpRpm: 8000, torque: 196, torqueRpm: 7000, idle: 900, redline: 8600, limiter: 8800, inertia: 0.12 },
    gearbox: { ratios: [3.27, 2.13, 1.52, 1.15, 0.92, 0.74], final: 4.76, reverse: 3.58, shiftTime: 0.2 },
    tires: 'sport', susp: { freqF: 1.8, freqR: 2.0, zeta: 0.36, arbF: 0.4, arbR: 0.55 },
    aero: { cd: 0.33, area: 2.0, clF: 0.0, clR: 0.05 }, steerLock: 34, lsd: 25, brakeBias: 0.67,
    paints: ['#f5f5f2', '#c8102e', '#111111', '#2453a4', '#8a8d91'],
  }),
  C('kaze_86', {
    brand: 'Kaze', model: '86 GT', year: 2016, country: 'Japon', category: 'sport', price: 31000,
    desc: "Moteur boxer, centre de gravité très bas, propulsion : un coupé pensé pour le plaisir de glisser.",
    style: 'coupe', dims: { length: 4.24, width: 1.78, height: 1.29, wheelbase: 2.57, track: 1.53 },
    wheel: { radius: 0.31, width: 0.215, rim: 'ten', rimColor: '#2a2c30' },
    mass: 1250, cgHeight: 0.46, weightFront: 0.55, drive: 'FR',
    engine: { layout: 'B4', cyl: 4, displacement: 2.0, hp: 207, hpRpm: 7000, torque: 212, torqueRpm: 6600, idle: 800, redline: 7400, limiter: 7600, inertia: 0.13 },
    gearbox: { ratios: [3.63, 2.19, 1.54, 1.21, 1.0, 0.77], final: 4.1, reverse: 3.44, shiftTime: 0.22 },
    tires: 'sport', susp: { freqF: 1.7, freqR: 1.8, zeta: 0.36, arbF: 0.5, arbR: 0.35 },
    aero: { cd: 0.29, area: 2.0, clF: 0.0, clR: 0.05 }, steerLock: 34, lsd: 45, brakeBias: 0.62,
    paints: ['#e04e1a', '#f4f4f1', '#1b1c1e', '#3e74c4', '#9aa0a6'],
  }),
  C('hoshi_raijin', {
    brand: 'Hoshi', model: 'Raijin Evo IX', year: 2006, country: 'Japon', category: 'sport', price: 46000,
    desc: "Née en rallye : 4 roues motrices, turbo, différentiels actifs. Une arme absolue sur routes sinueuses.",
    style: 'sedan', dims: { length: 4.49, width: 1.77, height: 1.45, wheelbase: 2.62, track: 1.52 },
    wheel: { radius: 0.32, width: 0.235, rim: 'six', rimColor: '#c9a74a' },
    mass: 1400, cgHeight: 0.54, weightFront: 0.59, drive: '4WD', frontSplit: 0.45,
    engine: { layout: 'L4', cyl: 4, displacement: 2.0, hp: 290, hpRpm: 6500, torque: 400, torqueRpm: 3500, idle: 850, redline: 7000, limiter: 7200, inertia: 0.15, turbo: 1.2 },
    gearbox: { ratios: [2.79, 1.95, 1.41, 1.03, 0.72], final: 4.53, reverse: 3.42, shiftTime: 0.24 },
    tires: 'sport', susp: { freqF: 1.8, freqR: 1.9, zeta: 0.38, arbF: 0.45, arbR: 0.4 },
    aero: { cd: 0.36, area: 2.15, clF: 0.05, clR: 0.15 }, steerLock: 33, lsd: 60, brakeBias: 0.64,
    paints: ['#d7d8da', '#c0121d', '#1c3d8b', '#1a1a1a', '#e6c200'],
  }),
  C('strauss_m3', {
    brand: 'Strauss', model: 'M3 CSL', year: 2004, country: 'Allemagne', category: 'gt', price: 64000,
    desc: "Six cylindres en ligne atmosphérique, toit en carbone, boîte séquentielle. Le coupé allemand radical.",
    style: 'sedan2', dims: { length: 4.49, width: 1.78, height: 1.37, wheelbase: 2.73, track: 1.51 },
    wheel: { radius: 0.33, width: 0.255, rim: 'mesh', rimColor: '#8d9096' },
    mass: 1385, cgHeight: 0.5, weightFront: 0.51, drive: 'FR',
    engine: { layout: 'L6', cyl: 6, displacement: 3.2, hp: 360, hpRpm: 7900, torque: 370, torqueRpm: 4900, idle: 800, redline: 8000, limiter: 8200, inertia: 0.17 },
    gearbox: { ratios: [4.23, 2.53, 1.67, 1.23, 1.0, 0.83], final: 3.62, reverse: 3.75, shiftTime: 0.15 },
    tires: 'sport', susp: { freqF: 1.85, freqR: 2.0, zeta: 0.38, arbF: 0.5, arbR: 0.4 },
    aero: { cd: 0.32, area: 2.1, clF: 0.05, clR: 0.1 }, steerLock: 33, lsd: 70, brakeBias: 0.63,
    paints: ['#2b2f36', '#c2c5ca', '#0f2a66', '#f3f3f0', '#a50f15'],
  }),
  C('falco_gtr', {
    brand: 'Falco', model: 'GT-R V-spec', year: 2000, country: 'Japon', category: 'gt', price: 78000,
    desc: "Le « Godzilla » : six cylindres biturbo, transmission intégrale intelligente. Une légende du Japon.",
    style: 'gtcoupe', dims: { length: 4.6, width: 1.79, height: 1.36, wheelbase: 2.67, track: 1.48 },
    wheel: { radius: 0.335, width: 0.245, rim: 'six', rimColor: '#b9bcc2' },
    mass: 1560, cgHeight: 0.5, weightFront: 0.55, drive: '4WD', frontSplit: 0.3,
    engine: { layout: 'L6', cyl: 6, displacement: 2.6, hp: 330, hpRpm: 6800, torque: 400, torqueRpm: 4400, idle: 850, redline: 7500, limiter: 7800, inertia: 0.18, turbo: 1.0 },
    gearbox: { ratios: [3.83, 2.36, 1.69, 1.31, 1.0, 0.79], final: 3.55, reverse: 3.13, shiftTime: 0.2 },
    tires: 'sport', susp: { freqF: 1.9, freqR: 2.0, zeta: 0.38, arbF: 0.5, arbR: 0.4 },
    aero: { cd: 0.34, area: 2.1, clF: 0.05, clR: 0.15 }, steerLock: 33, lsd: 60, brakeBias: 0.63,
    paints: ['#2f4fa8', '#e9e9e6', '#151515', '#7d8086', '#5b2a86'],
  }),
  C('stellan_rs', {
    brand: 'Stellan', model: 'Carrera RS 3.8', year: 2010, country: 'Allemagne', category: 'gt', price: 135000,
    desc: "Six cylindres à plat porte-à-faux arrière : une motricité phénoménale et un caractère exigeant au lever de pied.",
    style: 'rearengine', dims: { length: 4.46, width: 1.85, height: 1.28, wheelbase: 2.35, track: 1.52 },
    wheel: { radius: 0.335, width: 0.265, rim: 'five', rimColor: '#2a2c30' },
    mass: 1370, cgHeight: 0.46, weightFront: 0.38, drive: 'RR',
    engine: { layout: 'B6', cyl: 6, displacement: 3.8, hp: 450, hpRpm: 8500, torque: 430, torqueRpm: 6250, idle: 900, redline: 8500, limiter: 8800, inertia: 0.15 },
    gearbox: { ratios: [3.82, 2.26, 1.64, 1.29, 1.08, 0.88], final: 3.44, reverse: 3.55, shiftTime: 0.12 },
    tires: 'semi', susp: { freqF: 2.1, freqR: 2.3, zeta: 0.4, arbF: 0.55, arbR: 0.35 },
    aero: { cd: 0.32, area: 2.0, clF: 0.15, clR: 0.3 }, steerLock: 32, lsd: 80, brakeBias: 0.58,
    paints: ['#e6e6e1', '#f1ad00', '#24262a', '#2b6d3c', '#b51b1b'],
  }),
  C('vortex_acr', {
    brand: 'Vortex', model: 'Serpent ACR', year: 2016, country: 'États-Unis', category: 'gt', price: 120000,
    desc: "V10 de 8,4 litres, 645 ch, aileron géant. Brutale, viscérale, sans aucune concession.",
    style: 'muscle', dims: { length: 4.46, width: 1.95, height: 1.25, wheelbase: 2.51, track: 1.6 },
    wheel: { radius: 0.35, width: 0.295, rim: 'five', rimColor: '#1d1e21' },
    mass: 1520, cgHeight: 0.47, weightFront: 0.5, drive: 'FR',
    engine: { layout: 'V10', cyl: 10, displacement: 8.4, hp: 645, hpRpm: 6200, torque: 813, torqueRpm: 5000, idle: 750, redline: 6400, limiter: 6600, inertia: 0.24 },
    gearbox: { ratios: [2.26, 1.58, 1.19, 1.0, 0.77, 0.63], final: 3.55, reverse: 2.9, shiftTime: 0.2 },
    tires: 'semi', susp: { freqF: 2.1, freqR: 2.2, zeta: 0.4, arbF: 0.55, arbR: 0.45 },
    aero: { cd: 0.4, area: 2.1, clF: 0.35, clR: 0.6 }, steerLock: 32, lsd: 90, brakeBias: 0.6,
    paints: ['#1a1a1d', '#c41421', '#0d6b45', '#f2f2ee', '#4a6fd3'],
  }),
  C('aurelia_tempesta', {
    brand: 'Aurelia', model: 'Tempesta', year: 2019, country: 'Italie', category: 'supercar', price: 285000,
    desc: "V8 biturbo de 720 ch en position centrale arrière, carbone partout. La quintessence de la supercar italienne.",
    style: 'supercar', dims: { length: 4.57, width: 1.97, height: 1.2, wheelbase: 2.65, track: 1.66 },
    wheel: { radius: 0.345, width: 0.305, rim: 'split', rimColor: '#1b1c1f' },
    mass: 1420, cgHeight: 0.43, weightFront: 0.42, drive: 'MR',
    engine: { layout: 'V8', cyl: 8, displacement: 4.0, hp: 720, hpRpm: 7500, torque: 770, torqueRpm: 5500, idle: 900, redline: 8100, limiter: 8300, inertia: 0.16, turbo: 1.3 },
    gearbox: { ratios: [3.08, 2.19, 1.63, 1.29, 1.03, 0.84, 0.69], final: 4.44, reverse: 3.0, shiftTime: 0.08 },
    tires: 'semi', susp: { freqF: 2.2, freqR: 2.4, zeta: 0.42, arbF: 0.55, arbR: 0.4 },
    aero: { cd: 0.36, area: 2.0, clF: 0.3, clR: 0.5 }, steerLock: 31, lsd: 90, brakeBias: 0.6,
    paints: ['#c00d0d', '#f5c400', '#f1f1ee', '#141416', '#2a5bd7'],
  }),
  C('falco_gt3', {
    brand: 'Falco', model: 'GT3 Corsa', year: 2021, country: 'Japon', category: 'course', price: 420000,
    desc: "Voiture de course homologuée GT3 : slicks, appui aérodynamique, boîte séquentielle. Réservée aux pilotes licenciés.",
    style: 'gt3', dims: { length: 4.7, width: 2.04, height: 1.22, wheelbase: 2.78, track: 1.68 },
    wheel: { radius: 0.34, width: 0.31, rim: 'race', rimColor: '#202124' },
    mass: 1285, cgHeight: 0.4, weightFront: 0.47, drive: 'FR',
    engine: { layout: 'V8', cyl: 8, displacement: 3.8, hp: 550, hpRpm: 7000, torque: 640, torqueRpm: 5000, idle: 1100, redline: 7600, limiter: 7800, inertia: 0.13, turbo: 1.0 },
    gearbox: { ratios: [3.0, 2.15, 1.7, 1.4, 1.18, 1.02], final: 3.3, reverse: 3.0, shiftTime: 0.05 },
    tires: 'course', susp: { freqF: 2.8, freqR: 3.0, zeta: 0.5, arbF: 0.5, arbR: 0.35 },
    aero: { cd: 0.42, area: 2.05, clF: 1.0, clR: 1.6 }, steerLock: 28, lsd: 100, brakeBias: 0.58,
    paints: ['#f0f0ed', '#d4001a', '#0f4dbc', '#121212', '#ff8a00'], livery: true,
  }),
  C('aurelia_lmp', {
    brand: 'Aurelia', model: 'LMP-01', year: 2022, country: 'Italie', category: 'proto', price: 1250000,
    desc: "Prototype d'endurance : 930 kg, appui colossal, freinage carbone. Au-delà de 250 km/h, il colle à la piste.",
    style: 'proto', dims: { length: 4.75, width: 1.9, height: 1.05, wheelbase: 3.0, track: 1.6 },
    wheel: { radius: 0.335, width: 0.31, rim: 'race', rimColor: '#151517' },
    mass: 930, cgHeight: 0.33, weightFront: 0.46, drive: 'MR',
    engine: { layout: 'V8', cyl: 8, displacement: 4.5, hp: 680, hpRpm: 8500, torque: 600, torqueRpm: 6500, idle: 1300, redline: 9000, limiter: 9200, inertia: 0.1 },
    gearbox: { ratios: [2.9, 2.15, 1.72, 1.43, 1.22, 1.06], final: 3.2, reverse: 3.0, shiftTime: 0.04 },
    tires: 'course', susp: { freqF: 3.4, freqR: 3.6, zeta: 0.55, arbF: 0.5, arbR: 0.4 },
    aero: { cd: 0.45, area: 1.85, clF: 1.7, clR: 2.4 }, steerLock: 26, lsd: 100, brakeBias: 0.57,
    paints: ['#d6001c', '#f2f2f2', '#0a0a0a', '#00a3e0', '#ffcc00'], livery: true,
  }),
  C('delaunay_dl98', {
    brand: 'Delaunay', model: 'DL-98 Le Mans', year: 1998, country: 'France', category: 'proto', price: 0,
    desc: "Le prototype construit à la main par Marc Delaunay en 1998, privé de victoire au Mans. Restauré pour toi.",
    style: 'gt1', dims: { length: 4.85, width: 1.98, height: 1.12, wheelbase: 2.85, track: 1.64 },
    wheel: { radius: 0.34, width: 0.31, rim: 'race', rimColor: '#c9a74a' },
    mass: 1000, cgHeight: 0.36, weightFront: 0.44, drive: 'MR',
    engine: { layout: 'V12', cyl: 12, displacement: 6.0, hp: 700, hpRpm: 8000, torque: 680, torqueRpm: 6000, idle: 1100, redline: 8600, limiter: 8800, inertia: 0.13 },
    gearbox: { ratios: [2.85, 2.1, 1.68, 1.4, 1.2, 1.04], final: 3.25, reverse: 3.0, shiftTime: 0.05 },
    tires: 'course', susp: { freqF: 3.2, freqR: 3.4, zeta: 0.55, arbF: 0.5, arbR: 0.4 },
    aero: { cd: 0.43, area: 1.9, clF: 1.5, clR: 2.2 }, steerLock: 27, lsd: 100, brakeBias: 0.57,
    paints: ['#0b2e6b', '#f2f2f2', '#c8102e'], livery: true, storyOnly: true,
  }),
];

export const CAR_BY_ID = Object.fromEntries(CARS.map((c) => [c.id, c]));

// --------- Améliorations (préparateur) ---------
export const UPGRADES = [
  { id: 'eng1', group: 'Moteur', name: 'Admission & échappement sport', desc: '+6 % de puissance', base: 1600, power: 1.06 },
  { id: 'eng2', group: 'Moteur', name: 'Reprogrammation & arbres à cames', desc: '+14 % de puissance', base: 5200, power: 1.14, requires: 'eng1' },
  { id: 'eng3', group: 'Moteur', name: 'Préparation moteur Stage 3', desc: '+26 % de puissance', base: 16000, power: 1.26, requires: 'eng2' },
  { id: 'turbo', group: 'Moteur', name: 'Kit turbo grand débit', desc: '+35 % de puissance (moteurs turbo)', base: 19000, power: 1.35, turboOnly: true },
  { id: 'flywheel', group: 'Transmission', name: 'Volant moteur allégé', desc: 'Moteur plus vif (-35 % d\'inertie)', base: 1900, inertia: 0.65 },
  { id: 'lsd', group: 'Transmission', name: 'Différentiel autobloquant', desc: 'Meilleure motricité en sortie de virage', base: 3200, lsd: 90 },
  { id: 'gears', group: 'Transmission', name: 'Rapport de pont court', desc: 'Accélérations plus franches (-6 % de vitesse max)', base: 1800, final: 1.07 },
  { id: 'w1', group: 'Châssis', name: 'Allègement Stage 1', desc: '-5 % de masse', base: 2600, mass: 0.95 },
  { id: 'w2', group: 'Châssis', name: 'Allègement Stage 2', desc: '-10 % de masse', base: 7800, mass: 0.9, requires: 'w1' },
  { id: 'w3', group: 'Châssis', name: 'Allègement Stage 3 (carbone)', desc: '-15 % de masse', base: 19000, mass: 0.85, requires: 'w2' },
  { id: 'susp1', group: 'Châssis', name: 'Suspensions sport', desc: 'Ressorts +25 %, caisse abaissée', base: 2500, susp: 1.25, lower: 0.02 },
  { id: 'susp2', group: 'Châssis', name: 'Combinés filetés course', desc: 'Ressorts +60 %, caisse très basse', base: 7200, susp: 1.6, lower: 0.035, requires: 'susp1' },
  { id: 'brakes', group: 'Châssis', name: 'Freins sport', desc: 'Disques et plaquettes haute performance', base: 1900, brake: 1.2 },
  { id: 'aero', group: 'Aérodynamique', name: 'Kit aéro & aileron', desc: 'Appui accru (+traînée)', base: 4800, aero: true },
  { id: 'tire_sport', group: 'Pneumatiques', name: 'Pneus sport', desc: 'Adhérence +10 %', base: 1200, tires: 'sport' },
  { id: 'tire_semi', group: 'Pneumatiques', name: 'Pneus semi-slicks', desc: 'Adhérence +23 %', base: 3600, tires: 'semi' },
  { id: 'tire_course', group: 'Pneumatiques', name: 'Slicks de course', desc: 'Adhérence maximale', base: 9500, tires: 'course' },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export function upgradePrice(car, up) {
  const scale = clamp(car.price / 30000, 0.6, 3.2);
  return Math.round((up.base * scale) / 50) * 50;
}

const TIRE_ORDER = ['confort', 'sport', 'semi', 'course'];

// Construit la spécification physique effective d'une voiture (base + améliorations).
export function buildSpec(carId, upgrades = []) {
  const base = CAR_BY_ID[carId];
  const s = structuredClone(base);
  s.engine.powerMul = 1;
  s.upgrades = [...upgrades];
  for (const uid of upgrades) {
    const u = UPGRADE_BY_ID[uid];
    if (!u) continue;
    if (u.turboOnly && !base.engine.turbo) continue;
    if (u.power) s.engine.powerMul *= u.power;
    if (u.inertia) s.engine.inertia *= u.inertia;
    if (u.lsd) s.lsd = Math.max(s.lsd, u.lsd);
    if (u.final) s.gearbox.final *= u.final;
    if (u.mass) s.massMul = Math.min(s.massMul ?? 1, u.mass);
    if (u.susp) {
      s.susp.freqF = Math.max(s.susp.freqF, base.susp.freqF * u.susp);
      s.susp.freqR = Math.max(s.susp.freqR, base.susp.freqR * u.susp);
      s.susp.zeta = Math.max(s.susp.zeta, 0.42);
      s.lowered = Math.max(s.lowered ?? 0, u.lower);
    }
    if (u.brake) s.brakeMul = u.brake;
    if (u.aero) {
      s.aero.clF += 0.35;
      s.aero.clR += 0.6;
      s.aero.cd += 0.03;
      s.aeroKit = true;
    }
    if (u.tires && TIRE_ORDER.indexOf(u.tires) > TIRE_ORDER.indexOf(s.tires)) s.tires = u.tires;
  }
  // Les montées en pneus ne sont pas cumulatives : on garde le meilleur.
  if (s.massMul) s.mass = Math.round(base.mass * s.massMul);
  s.engine.hp = Math.round(base.engine.hp * s.engine.powerMul);
  s.engine.torque = Math.round(base.engine.torque * s.engine.powerMul);
  s.pp = computePP(s);
  return s;
}

// Courbe de couple (N·m) à pleine charge, construite à partir des points caractéristiques.
export function makeTorqueCurve(e) {
  const pkW = e.hp * 0.7355; // ch -> kW
  const tAtPower = (pkW * 1000) / ((e.hpRpm * Math.PI) / 30);
  const tMax = Math.max(e.torque, tAtPower * 1.02);
  const keys = [];
  const turbo = !!e.turbo;
  keys.push([0, tMax * 0.4]);
  keys.push([e.idle, tMax * (turbo ? 0.42 : 0.6)]);
  if (turbo) {
    keys.push([e.torqueRpm * 0.6, tMax * 0.62]);
    keys.push([e.torqueRpm * 0.85, tMax * 0.97]);
    keys.push([e.torqueRpm, tMax]);
    keys.push([(e.torqueRpm + e.hpRpm) * 0.5, Math.max(tMax * 0.96, (tAtPower + tMax) * 0.5)]);
  } else {
    keys.push([(e.idle + e.torqueRpm) * 0.5, tMax * 0.82]);
    keys.push([e.torqueRpm, tMax]);
    keys.push([(e.torqueRpm + e.hpRpm) * 0.5, (tMax + tAtPower) * 0.5 * 1.01]);
  }
  keys.push([e.hpRpm, tAtPower]);
  keys.push([e.limiter, tAtPower * (e.limiter > e.hpRpm ? Math.pow(e.hpRpm / e.limiter, 1.6) : 1)]);
  keys.push([e.limiter + 1500, tAtPower * 0.4]);
  // Table échantillonnée tous les 100 tr/min
  const table = [];
  for (let r = 0; r <= e.limiter + 1500; r += 100) {
    table.push(Math.max(0, sampleKeys(keys, r)));
  }
  return table;
}

export function torqueAt(table, rpm) {
  const f = rpm / 100;
  const i = Math.floor(f);
  if (i < 0) return table[0];
  if (i >= table.length - 1) return table[table.length - 1];
  const t = f - i;
  return table[i] * (1 - t) + table[i + 1] * t;
}

// Indice de performance façon « PP ».
export function computePP(s) {
  const pw = s.engine.hp / (s.mass / 1000);
  const tire = TIRES[s.tires];
  let pp = 120 + 2.05 * Math.pow(pw, 0.9);
  pp += (tire.mu - 0.95) * 260;
  pp += (s.aero.clF + s.aero.clR) * 22;
  if (s.drive === '4WD') pp += 12;
  return Math.round(pp);
}

export function carLabel(c) {
  return `${c.brand} ${c.model}`;
}
