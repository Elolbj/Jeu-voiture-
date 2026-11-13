// Assemble le monde d'un circuit : environnement, piste, terrain, décor, météo (sec / pluie).
import * as THREE from 'three';
import { Track } from './track.js';
import { Environment } from './environment.js';
import { buildTrackMeshes } from './trackMesh.js';
import { Terrain } from './terrain.js';
import { Scenery } from './scenery.js';
import { RacingLine } from '../game/racingLine.js';
import { Rain } from './rain.js';

const TRACK_CACHE = new Map();

export function getTrack(def) {
  if (!TRACK_CACHE.has(def.id)) {
    const track = new Track(def);
    const line = new RacingLine(track);
    TRACK_CACHE.set(def.id, { track, line });
  }
  return TRACK_CACHE.get(def.id);
}

export class World {
  constructor(renderer, def, opts = {}) {
    this.renderer = renderer;
    this.def = def;
    const { track, line } = getTrack(def);
    this.track = track;
    this.line = line;
    const scene = new THREE.Scene();
    this.scene = scene;
    const time = opts.time || def.time || 'day';
    this.time = time;
    // Météo : 'sec' ou 'pluie' (lue aussi par les effets et le post-traitement via scene.userData)
    this.weather = opts.weather === 'pluie' ? 'pluie' : 'sec';
    const wet = this.weather === 'pluie' ? 1 : 0;
    scene.userData.weather = this.weather;
    scene.userData.rain = wet;
    const groundCol = { countryside: 0x4d5a2c, coast: 0x6b6648, mountain: 0x46503a, city: 0x2a2a2e, gp: 0x4a5a2c, desert: 0x9a7a52, forest: 0x3a4a26, citynight: 0x1e1e24, oval: 0x4d5e2c, snow: 0xc9ced8 }[def.theme];
    this.env = new Environment(renderer, scene, time, { groundColor: groundCol, weather: this.weather });
    const tm = buildTrackMeshes(track, { line, wet });
    scene.add(tm.group);
    this.trackMeshes = tm;
    this.gantry = tm.gantry;
    this.terrain = new Terrain(track, def.theme, renderer.quality);
    scene.add(this.terrain.mesh);
    this.backdrop = this.terrain.buildBackdrop(this.env.preset.sky, this.env.fogColor);
    scene.add(this.backdrop);
    this.scenery = new Scenery(scene, track, this.terrain, this.env, renderer.quality);
    scene.userData.night = this.env.night;
    this.rain = wet ? new Rain(scene, renderer.quality.rain || 3000, { night: this.env.night }) : null;
    this.focus = new THREE.Vector3();
  }

  update(dt, focus, camPos) {
    this.focus.copy(focus);
    this.env.update(focus, camPos);
    this.scenery.update(dt, camPos || focus);
    this.rain?.update(dt, camPos || focus);
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) m.dispose?.();
      }
    });
    this.env.dispose();
  }
}
