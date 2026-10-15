// Sauvegarde locale (localStorage) : profil, garage, progression, réglages.
const KEY = 'trajectoire_save_v1';

export const DEFAULT_SETTINGS = {
  quality: 'haute',
  assists: { abs: true, tcs: true, stability: true, autoGear: true },
  steeringAssist: true,
  camera: 'chase',
  difficulty: 'normal',
  volumes: { master: 0.8, sfx: 0.9, music: 0.45 },
  music: true,
  rubberBand: 0.5,
};

export const DIFFICULTY = {
  facile: { label: 'Facile', mul: 0.86 },
  normal: { label: 'Normal', mul: 0.95 },
  difficile: { label: 'Difficile', mul: 1.03 },
  expert: { label: 'Expert', mul: 1.1 },
};

export function newProfile(name = 'Pilote') {
  return {
    version: 1,
    name,
    credits: 0,
    cars: [],
    currentCar: null,
    story: { started: false, chapter: 0, done: {}, seen: {}, finished: false },
    licences: {},
    stats: { races: 0, wins: 0, podiums: 0, distance: 0, earned: 0 },
    settings: structuredClone(DEFAULT_SETTINGS),
    created: Date.now(),
  };
}

let uidCounter = 0;
export function carUid() {
  uidCounter++;
  return 'c' + Date.now().toString(36) + uidCounter.toString(36) + Math.floor(Math.random() * 1e4).toString(36);
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    p.settings = { ...structuredClone(DEFAULT_SETTINGS), ...(p.settings || {}) };
    p.settings.assists = { ...DEFAULT_SETTINGS.assists, ...(p.settings.assists || {}) };
    p.settings.volumes = { ...DEFAULT_SETTINGS.volumes, ...(p.settings.volumes || {}) };
    p.story = { started: false, chapter: 0, done: {}, seen: {}, finished: false, ...(p.story || {}) };
    p.licences = p.licences || {};
    p.stats = { races: 0, wins: 0, podiums: 0, distance: 0, earned: 0, ...(p.stats || {}) };
    return p;
  } catch (e) {
    console.warn('Sauvegarde illisible', e);
    return null;
  }
}

export function saveProfile(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    return true;
  } catch (e) {
    console.warn('Sauvegarde impossible', e);
    return false;
  }
}

export function deleteProfile() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    void e;
  }
}
