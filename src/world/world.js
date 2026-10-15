// Assemble le monde d'un circuit : environnement, piste, terrain, décor.
import * as THREE from 'three';
import { Track } from './track.js';
import { Environment } from './environment.js';
import { buildTrackMeshes } from './trackMesh.js';
import { Terrain } from './terrain.js';
import { Scenery } from './scenery.js';
import { RacingLine } from '../game/racingLine.js';

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
    const groundCol = { countryside: 0x4d5a2c, coast: 0x6b6648, mountain: 0x46503a, city: 0x2a2a2e, gp: 0x4a5a2c }[def.theme];
    this.env = new Environment(renderer, scene, time, { groundColor: groundCol });
    const tm = buildTrackMeshes(track, { line });
    scene.add(tm.group);
    this.trackMeshes = tm;
    this.gantry = tm.gantry;
    this.terrain = new Terrain(track, def.theme, renderer.quality);
    scene.add(this.terrain.mesh);
    this.backdrop = this.terrain.buildBackdrop(this.env.preset.sky, this.env.fogColor);
    scene.add(this.backdrop);
    this.scenery = new Scenery(scene, track, this.terrain, this.env, renderer.quality);
    this.focus = new THREE.Vector3();
  }

  update(dt, focus) {
    this.focus.copy(focus);
    this.env.update(focus);
    this.scenery.update(dt);
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
