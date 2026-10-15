// Décor par thème : végétation, bâtiments, tribunes, stands, mer, port, éclairage urbain,
// panneaux publicitaires, rochers…
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, clamp, lerp, smoothstep } from '../core/utils.js';
import { Noise2D } from '../core/noise.js';
import * as TX from './textures.js';
import { InstancedForest, cullForest } from './vegetation.js';
import { surfaceY } from './trackMesh.js';

// Regroupe les géométries statiques par matériau pour limiter les appels de rendu
class MergeBin {
  constructor() {
    this.bins = new Map();
  }
  add(key, material, geometry, matrix) {
    if (!this.bins.has(key)) this.bins.set(key, { material, geos: [] });
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (matrix) g.applyMatrix4(matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    this.bins.get(key).geos.push(g);
  }
  flush(group, { cast = true, receive = true } = {}) {
    for (const { material, geos } of this.bins.values()) {
      if (!geos.length) continue;
      const merged = mergeGeometries(geos, false);
      const m = new THREE.Mesh(merged, material);
      m.castShadow = cast;
      m.receiveShadow = receive;
      group.add(m);
    }
    this.bins.clear();
  }
}

// Boîte avec UV en mètres (textures répétées à l'échelle)
function boxWorldUV(w, h, d, uScale = 8, vScale = 8) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (ny > 0.5) uv.setXY(i, x / uScale, z / uScale);
    else if (nx > 0.5) uv.setXY(i, (z + d / 2) / uScale, (y + h / 2) / vScale);
    else uv.setXY(i, (x + w / 2) / uScale, (y + h / 2) / vScale);
  }
  return g;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);
function mat(x, y, z, rotY = 0, sx = 1, sy = 1, sz = 1) {
  _q.setFromAxisAngle(UP, rotY);
  _v.set(x, y, z);
  _s.set(sx, sy, sz);
  return _m.clone().compose(_v, _q, _s);
}

export class Scenery {
  constructor(scene, track, terrain, env, quality) {
    this.scene = scene;
    this.track = track;
    this.terrain = terrain;
    this.env = env;
    this.quality = quality;
    this.theme = track.def.theme;
    this.night = env.night;
    this.group = new THREE.Group();
    this.group.name = 'scenery';
    scene.add(this.group);
    this.bin = new MergeBin();
    this.r = rng(track.id.length * 977 + 13);
    this.noise = new Noise2D(31);
    this.water = null;
    this.animated = [];
    this.lampLights = [];
    this.build();
  }

  // Distance au bord extérieur (mur) du circuit le plus proche (≈)
  clearance(x, z) {
    const t = this.track;
    let best = Infinity;
    t.forEachNear(x, z, 90, (i) => {
      const hl = Math.hypot(t.rx[i], t.rz[i]) || 1;
      const lat = ((x - t.px[i]) * t.rx[i] + (z - t.pz[i]) * t.rz[i]) / hl;
      const along = Math.abs((x - t.px[i]) * t.dx[i] + (z - t.pz[i]) * t.dz[i]);
      if (along > 6) return;
      const wall = lat > 0 ? t.wallR[i] : t.wallL[i];
      best = Math.min(best, Math.abs(lat) - wall);
    });
    if (best === Infinity) {
      // loin de tout échantillon : distance euclidienne grossière
      return 90;
    }
    return best;
  }

  groundAt(x, z) {
    return this.terrain.sampleGrid(x, z);
  }

  build() {
    switch (this.theme) {
      case 'countryside': this.buildCountryside(); break;
      case 'coast': this.buildCoast(); break;
      case 'mountain': this.buildMountain(); break;
      case 'city': this.buildCity(); break;
      case 'gp': this.buildGP(); break;
    }
    if (this.track.closed && this.theme !== 'city') this.buildStartArea();
    this.buildBillboards();
    this.bin.flush(this.group);
  }

  // ------------------------------------------------------------------ Végétation
  scatter(forest, count, kinds, opts = {}) {
    const t = this.track;
    const b = this.terrain.grid;
    const x0 = b.x0 + 20, z0 = b.z0 + 20;
    const x1 = b.x0 + (b.nx - 1) * b.res - 20, z1 = b.z0 + (b.nz - 1) * b.res - 20;
    const r = this.r;
    const N = this.noise;
    let placed = 0, tries = 0;
    const minClear = opts.minClear ?? 6;
    while (placed < count && tries < count * 12) {
      tries++;
      let x, z;
      if (opts.nearTrack && r() < 0.6) {
        // concentration le long du circuit (au-delà des murs)
        const i = Math.floor(r() * t.count);
        const side = r() < 0.5 ? -1 : 1;
        const wall = side > 0 ? t.wallR[i] : t.wallL[i];
        const lat = side * (wall + minClear + r() * opts.nearTrack);
        const hl = Math.hypot(t.rx[i], t.rz[i]) || 1;
        x = t.px[i] + (t.rx[i] / hl) * lat + (r() - 0.5) * 8;
        z = t.pz[i] + (t.rz[i] / hl) * lat + (r() - 0.5) * 8;
      } else {
        x = lerp(x0, x1, r());
        z = lerp(z0, z1, r());
      }
      const dens = N.fbm(x / (opts.clump ?? 260), z / (opts.clump ?? 260), 3);
      if (dens < (opts.threshold ?? -0.05)) continue;
      if (this.clearance(x, z) < minClear) continue;
      const y = this.groundAt(x, z);
      if (opts.minY !== undefined && y < opts.minY) continue;
      if (opts.maxY !== undefined && y > opts.maxY) continue;
      if (opts.filter && !opts.filter(x, y, z)) continue;
      // pente
      const dx = this.groundAt(x + 2, z) - this.groundAt(x - 2, z);
      const dz = this.groundAt(x, z + 2) - this.groundAt(x, z - 2);
      if (Math.hypot(dx, dz) / 4 > (opts.maxSlope ?? 0.7)) continue;
      const kind = kinds[Math.floor(r() * kinds.length)];
      const sc = (opts.scale ?? 1) * (0.75 + r() * 0.5);
      forest.add(kind, 2, x, y - 0.3, z, sc, r() * Math.PI * 2);
      placed++;
    }
    return placed;
  }

  // ------------------------------------------------------------------ Campagne
  buildCountryside() {
    const q = this.quality.trees;
    const f = this.forest(InstancedForest, 3);
    this.scatter(f, Math.round(2600 * q), ['deciduous', 'deciduous', 'deciduous', 'pine'], { clump: 220, threshold: 0.0, nearTrack: 70 });
    this.scatter(f, Math.round(1200 * q), ['deciduous'], { clump: 900, threshold: -0.6 });
    this.scatter(f, Math.round(600 * q), ['bush'], { nearTrack: 30, minClear: 3, threshold: -0.4 });
    // Vignes en rangs sur les coteaux
    const r = this.r;
    const t = this.track;
    for (let p = 0; p < 6 * q; p++) {
      const i = Math.floor(r() * t.count);
      const side = r() < 0.5 ? -1 : 1;
      const hl = Math.hypot(t.rx[i], t.rz[i]) || 1;
      const off = (side > 0 ? t.wallR[i] : t.wallL[i]) + 40 + r() * 60;
      const cx = t.px[i] + (t.rx[i] / hl) * off * side, cz = t.pz[i] + (t.rz[i] / hl) * off * side;
      const ang = r() * Math.PI;
      for (let row = -6; row <= 6; row++) {
        for (let k = -12; k <= 12; k++) {
          const lx = row * 2.6, lz = k * 2.0;
          const x = cx + Math.cos(ang) * lx - Math.sin(ang) * lz;
          const z = cz + Math.sin(ang) * lx + Math.cos(ang) * lz;
          if (this.clearance(x, z) < 8) continue;
          f.add('vine', 1, x, this.groundAt(x, z), z, 1, ang);
        }
      }
    }
    f.build();
    // Fermes
    for (let k = 0; k < 7; k++) {
      const p = this.findSpot(60, 260, 30);
      if (p) this.farmhouse(p.x, p.z, r() * Math.PI);
    }
    // Bottes de foin
    const hayMat = new THREE.MeshStandardMaterial({ color: 0xc9a65a, roughness: 1 });
    const hay = new THREE.CylinderGeometry(0.75, 0.75, 1.3, 12);
    hay.rotateZ(Math.PI / 2);
    for (let k = 0; k < 60; k++) {
      const p = this.findSpot(50, 300, 5);
      if (!p) continue;
      this.bin.add('hay', hayMat, hay, mat(p.x, this.groundAt(p.x, p.z) + 0.7, p.z, r() * 3));
    }
  }

  farmhouse(x, z, rot) {
    const y = this.groundAt(x, z);
    const wallMat = this.cachedMat('farmWall', () => new THREE.MeshStandardMaterial({ map: TX.concrete(205), color: 0xefe6d6, roughness: 0.9 }));
    const roofMat = this.cachedMat('farmRoof', () => new THREE.MeshStandardMaterial({ color: 0x8e4a32, roughness: 0.8 }));
    const w = 10 + this.r() * 6, d = 8 + this.r() * 3, h = 5 + this.r() * 2;
    this.bin.add('farmWall', wallMat, boxWorldUV(w, h, d, 6, 6), mat(x, y + h / 2 - 0.5, z, rot));
    const roof = new THREE.CylinderGeometry(0.01, d * 0.72, w + 0.6, 4, 1);
    roof.rotateY(Math.PI / 4);
    roof.rotateZ(Math.PI / 2);
    roof.scale(1, 0.55, 1);
    this.bin.add('farmRoof', roofMat, roof, mat(x, y + h - 0.5 + d * 0.2, z, rot));
  }

  forest(Cls, seed) {
    const f = new Cls(this.group, seed);
    this.forests = this.forests || [];
    this.forests.push(f);
    return f;
  }

  cachedMat(key, make) {
    this._mats = this._mats || new Map();
    if (!this._mats.has(key)) this._mats.set(key, make());
    return this._mats.get(key);
  }

  findSpot(minClear, maxClear, size) {
    const t = this.track;
    const r = this.r;
    for (let tries = 0; tries < 40; tries++) {
      const i = Math.floor(r() * t.count);
      const side = r() < 0.5 ? -1 : 1;
      const hl = Math.hypot(t.rx[i], t.rz[i]) || 1;
      const off = (side > 0 ? t.wallR[i] : t.wallL[i]) + minClear + r() * (maxClear - minClear);
      const x = t.px[i] + (t.rx[i] / hl) * off * side, z = t.pz[i] + (t.rz[i] / hl) * off * side;
      if (this.clearance(x, z) < minClear * 0.8 + size * 0.5) continue;
      return { x, z, i, side };
    }
    return null;
  }

  // ------------------------------------------------------------------ Côte
  buildCoast() {
    const q = this.quality.trees;
    const f = this.forest(InstancedForest, 5);
    this.scatter(f, Math.round(900 * q), ['palm'], { nearTrack: 25, minClear: 5, threshold: -0.3, minY: 2.5 });
    this.scatter(f, Math.round(1300 * q), ['umbrella', 'umbrella', 'cypress'], { clump: 300, threshold: -0.1, minY: 3, nearTrack: 90 });
    this.scatter(f, Math.round(900 * q), ['bush', 'cypress'], { clump: 150, threshold: -0.2, minY: 3 });
    this.scatter(f, Math.round(350), ['rock'], { minY: -1, maxY: 6, scale: 2.5, threshold: -0.5, maxSlope: 3 });
    f.build();
    // Mer
    this.addWater(0, this.terrain.coastZ - 260);
    // Villas
    const r = this.r;
    for (let k = 0; k < 45; k++) {
      const p = this.findSpot(30, 340, 18);
      if (!p) continue;
      const y = this.groundAt(p.x, p.z);
      if (y < 4) continue;
      this.villa(p.x, p.z, r() * Math.PI * 2);
    }
    // Phare sur la falaise
    const b = this.track.bounds;
    const lx = b.maxX + 80, lz = this.terrain.coastZ - 40;
    const ly = this.groundAt(lx, lz);
    const white = this.cachedMat('lhWhite', () => new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.6 }));
    const red = this.cachedMat('lhRed', () => new THREE.MeshStandardMaterial({ color: 0xb3241c, roughness: 0.6 }));
    for (let k = 0; k < 6; k++) {
      const g = new THREE.CylinderGeometry(2.4 - k * 0.2, 2.6 - k * 0.2, 4, 16);
      this.bin.add(k % 2 ? 'lhRed' : 'lhWhite', k % 2 ? red : white, g, mat(lx, ly + 2 + k * 4, lz));
    }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8), new THREE.MeshStandardMaterial({ color: 0xfff4c0, emissive: 0xffe9a0, emissiveIntensity: 2.5 }));
    lamp.position.set(lx, ly + 26, lz);
    this.group.add(lamp);
    // Voiliers
    const hullMat = this.cachedMat('hull', () => new THREE.MeshStandardMaterial({ color: 0xf5f5f2, roughness: 0.4 }));
    const sailMat = this.cachedMat('sail', () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide }));
    for (let k = 0; k < 14; k++) {
      const x = lerp(b.minX - 600, b.maxX + 600, r());
      const z = this.terrain.coastZ + 150 + r() * 900;
      const rot = r() * Math.PI * 2;
      const hull = new THREE.SphereGeometry(1, 10, 6);
      hull.scale(1.6, 0.7, 5);
      this.bin.add('hull', hullMat, hull, mat(x, 0.1, z, rot));
      const sail = new THREE.BufferGeometry();
      sail.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, -1.5, 0, 11, 0, 0, 1, 3], 3));
      sail.computeVertexNormals();
      this.bin.add('sail', sailMat, sail, mat(x, 0, z, rot));
    }
  }

  villa(x, z, rot) {
    const y = this.groundAt(x, z);
    const wall = this.cachedMat('villaWall', () => new THREE.MeshStandardMaterial({ map: TX.concrete(232), color: 0xfbf3e4, roughness: 0.85 }));
    const roofM = this.cachedMat('villaRoof', () => new THREE.MeshStandardMaterial({ color: 0xc0623a, roughness: 0.75 }));
    const win = this.cachedMat('villaWin', () => new THREE.MeshStandardMaterial({ color: 0x2b3a44, roughness: 0.2, metalness: 0.4 }));
    const w = 11 + this.r() * 8, d = 9 + this.r() * 5, h = 6 + this.r() * 3;
    this.bin.add('villaWall', wall, boxWorldUV(w, h + 3, d, 6, 6), mat(x, y + h / 2 - 1.5, z, rot));
    const roof = new THREE.CylinderGeometry(0.01, Math.max(w, d) * 0.72, 3, 4, 1);
    roof.rotateY(Math.PI / 4);
    roof.scale(w / Math.max(w, d), 1, d / Math.max(w, d));
    this.bin.add('villaRoof', roofM, roof, mat(x, y + h + 1.5, z, rot));
    for (let k = -1; k <= 1; k++) {
      const wg = new THREE.BoxGeometry(1.4, 1.8, 0.1);
      const lx = k * w * 0.28, lz = d / 2 + 0.02;
      const c = Math.cos(rot), s = Math.sin(rot);
      this.bin.add('villaWin', win, wg, mat(x + c * lx + s * lz, y + h * 0.55, z - s * lx + c * lz, rot));
    }
  }

  addWater(level, fromZ) {
    const t = this.track.bounds;
    const w = 20000;
    const geo = new THREE.PlaneGeometry(w, 12000, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const nmap = TX.waterNormal();
    nmap.repeat.set(220, 130);
    const m = new THREE.MeshStandardMaterial({ color: this.night ? 0x061018 : 0x0d3550, roughness: 0.12, metalness: 0.0, normalMap: nmap, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.4 });
    const water = new THREE.Mesh(geo, m);
    water.position.set((t.minX + t.maxX) / 2, level, fromZ + 6000);
    water.receiveShadow = true;
    this.group.add(water);
    this.water = { mesh: water, map: nmap };
  }

  // ------------------------------------------------------------------ Montagne
  buildMountain() {
    const q = this.quality.trees;
    const f = this.forest(InstancedForest, 7);
    this.scatter(f, Math.round(5500 * q), ['pine', 'pine', 'pine', 'deciduous'], { clump: 260, threshold: -0.15, nearTrack: 120, maxY: 1420, maxSlope: 0.9 });
    this.scatter(f, Math.round(900), ['rock'], { scale: 2.2, threshold: -0.6, maxSlope: 3, nearTrack: 40, minClear: 2 });
    f.build();
    // Chalets
    for (let k = 0; k < 10; k++) {
      const p = this.findSpot(20, 160, 14);
      if (p) this.chalet(p.x, p.z, this.r() * Math.PI * 2);
    }
  }

  chalet(x, z, rot) {
    const y = this.groundAt(x, z);
    const wood = this.cachedMat('wood', () => new THREE.MeshStandardMaterial({ color: 0x6b4428, roughness: 0.85 }));
    const stone = this.cachedMat('stone', () => new THREE.MeshStandardMaterial({ map: TX.concrete(150), color: 0xc8c2b8, roughness: 0.95 }));
    const roofM = this.cachedMat('chaletRoof', () => new THREE.MeshStandardMaterial({ color: 0x3a3532, roughness: 0.8 }));
    const w = 10 + this.r() * 4, d = 8 + this.r() * 3;
    this.bin.add('stone', stone, boxWorldUV(w, 4, d, 4, 4), mat(x, y + 0.5, z, rot));
    this.bin.add('wood', wood, boxWorldUV(w, 3, d, 4, 4), mat(x, y + 4, z, rot));
    const roof = new THREE.CylinderGeometry(0.01, Math.max(w, d) * 0.8, 3.2, 4, 1);
    roof.rotateY(Math.PI / 4);
    roof.scale(w / Math.max(w, d) * 1.1, 1, d / Math.max(w, d) * 1.1);
    this.bin.add('chaletRoof', roofM, roof, mat(x, y + 7.1, z, rot));
  }

  // ------------------------------------------------------------------ Ville de nuit
  buildCity() {
    const t = this.track;
    const r = this.r;
    const facades = [];
    for (let k = 0; k < 6; k++) {
      const fx = TX.facade(k, this.night);
      fx.map.repeat.set(1, 1);
      facades.push(new THREE.MeshStandardMaterial({ map: fx.map, emissiveMap: fx.emissiveMap, emissive: 0xffffff, emissiveIntensity: this.night ? 1.3 : 0, roughness: 0.7, metalness: 0.1 }));
    }
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2c2d31, roughness: 0.9 });
    const placed = [];
    const tryBuilding = (x, z, w, d, h, rot) => {
      // évite les recouvrements grossiers
      for (const p of placed) if (Math.hypot(p[0] - x, p[1] - z) < (p[2] + Math.max(w, d)) * 0.5) return false;
      const corners = [[w / 2, d / 2], [-w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2], [0, 0]];
      const c = Math.cos(rot), s = Math.sin(rot);
      for (const [lx, lz] of corners) {
        if (this.clearance(x + c * lx + s * lz, z - s * lx + c * lz) < 4) return false;
      }
      const y = this.groundAt(x, z);
      const fi = Math.floor(r() * facades.length);
      // façades (UV en mètres : fenêtres de 4 m × 3,6 m)
      const g = boxWorldUV(w, h, d, 32, 36);
      // retire les faces haut/bas (toit séparé)
      this.bin.add('facade' + fi, facades[fi], g, mat(x, y + h / 2, z, rot));
      this.bin.add('roof', roofMat, new THREE.BoxGeometry(w + 0.4, 0.6, d + 0.4), mat(x, y + h + 0.3, z, rot));
      placed.push([x, z, Math.max(w, d)]);
      return true;
    };
    // Rangées d'immeubles le long du tracé
    for (let i = 0; i < t.count; i += 6) {
      for (const side of [-1, 1]) {
        if (r() < 0.12) continue;
        const wall = side > 0 ? t.wallR[i] : t.wallL[i];
        const hl = Math.hypot(t.rx[i], t.rz[i]) || 1;
        const rx = t.rx[i] / hl, rz = t.rz[i] / hl;
        const w = 14 + r() * 16, d = 14 + r() * 14;
        const off = wall + 7 + d / 2;
        const x = t.px[i] + rx * off * side, z = t.pz[i] + rz * off * side;
        const rot = -t.heading[i];
        tryBuilding(x, z, w, d, 14 + r() * 26, rot);
        // Seconde rangée : tours
        if (r() < 0.45) {
          const off2 = off + d / 2 + 20 + r() * 30;
          tryBuilding(t.px[i] + rx * off2 * side, t.pz[i] + rz * off2 * side, 18 + r() * 12, 18 + r() * 12, 40 + r() * 90, rot);
        }
      }
    }
    // Tours lointaines (silhouette de la ville)
    const b = t.bounds;
    for (let k = 0; k < 120; k++) {
      const a = r() * Math.PI * 2;
      const rad = 500 + r() * 900;
      const x = (b.minX + b.maxX) / 2 + Math.cos(a) * rad, z = (b.minZ + b.maxZ) / 2 + Math.sin(a) * rad;
      if (z > b.maxZ + 60) continue; // le port au sud
      tryBuilding(x, z, 20 + r() * 25, 20 + r() * 25, 30 + r() * 130, r() * 3);
    }
    // Arbres de parc
    const f = this.forest(InstancedForest, 9);
    this.scatter(f, Math.round(300 * this.quality.trees), ['deciduous'], { nearTrack: 8, minClear: 3, threshold: 0.1 });
    f.build();
    // Port : eau + grues + conteneurs
    this.addWater(-1.6, b.maxZ + 90);
    const quay = new THREE.Mesh(new THREE.BoxGeometry(b.maxX - b.minX + 800, 3, 40), new THREE.MeshStandardMaterial({ map: TX.concrete(140), roughness: 0.9 }));
    quay.position.set((b.minX + b.maxX) / 2, -0.4, b.maxZ + 75);
    quay.receiveShadow = true;
    this.group.add(quay);
    const contCols = [0xb23a2a, 0x2a5fa8, 0xd8a02a, 0x2f7a46, 0x8d8f94, 0xe06a1d];
    const contMats = contCols.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.3 }));
    for (let k = 0; k < 160; k++) {
      const x = lerp(b.minX - 200, b.maxX + 200, r());
      const z = b.maxZ + 20 + r() * 40;
      if (this.clearance(x, z) < 6) continue;
      const lvl = Math.floor(r() * 3);
      const mi = Math.floor(r() * contMats.length);
      this.bin.add('cont' + mi, contMats[mi], new THREE.BoxGeometry(2.5, 2.6, 12), mat(x, this.groundAt(x, z) + 1.3 + lvl * 2.6, z, Math.PI / 2 + (r() < 0.5 ? 0 : 0.02)));
    }
    const craneMat = new THREE.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.6, metalness: 0.4 });
    for (let k = 0; k < 5; k++) {
      const x = lerp(b.minX, b.maxX, (k + 0.5) / 5);
      const z = b.maxZ + 80;
      for (const dx of [-6, 6]) for (const dz of [-5, 5]) this.bin.add('crane', craneMat, new THREE.BoxGeometry(0.8, 30, 0.8), mat(x + dx, 15, z + dz));
      this.bin.add('crane', craneMat, new THREE.BoxGeometry(14, 2, 70), mat(x, 31, z + 20));
      // feux d'obstacle
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
      l.position.set(x, 33, z + 55);
      this.group.add(l);
    }
    // Lampadaires + flaques de lumière
    this.buildStreetLights();
    // Enseignes lumineuses
    this.buildNeons(placed);
  }

  buildStreetLights() {
    const t = this.track;
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.6, roughness: 0.5 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe6c0, emissive: 0xffd9a0, emissiveIntensity: 6 });
    const pole = new THREE.CylinderGeometry(0.1, 0.16, 9, 6);
    const arm = new THREE.BoxGeometry(0.12, 0.12, 2.6);
    const head = new THREE.BoxGeometry(0.5, 0.15, 0.9);
    const poolPos = [], poolUV = [], poolIdx = [];
    const step = Math.max(1, Math.round(26 / t.spacing));
    let n = 0;
    for (let i = 0; i < t.count; i += step) {
      for (const side of [-1, 1]) {
        if ((i / step + (side > 0 ? 1 : 0)) % 2) continue; // en quinconce
        const wall = side > 0 ? t.wallR[i] : t.wallL[i];
        const hl = Math.hypot(t.rx[i], t.rz[i]) || 1;
        const rx = t.rx[i] / hl, rz = t.rz[i] / hl;
        const x = t.px[i] + rx * (wall + 0.9) * side, z = t.pz[i] + rz * (wall + 0.9) * side;
        const y = surfaceY(t, i, side * wall);
        const rot = -t.heading[i] + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
        this.bin.add('pole', poleMat, pole, mat(x, y + 4.5, z));
        const ax = x - rx * side * 1.2, az = z - rz * side * 1.2;
        this.bin.add('pole', poleMat, arm, mat(ax, y + 8.9, az, rot));
        const hx = x - rx * side * 2.4, hz = z - rz * side * 2.4;
        this.bin.add('lamp', lampMat, head, mat(hx, y + 8.8, hz, rot));
        // flaque lumineuse au sol
        const cx = x - rx * side * 4.5, cz = z - rz * side * 4.5;
        const cy = surfaceY(t, i, side * Math.max(0, wall - 4.5)) + 0.04;
        const R = 9;
        poolPos.push(cx - R, cy, cz - R, cx + R, cy, cz - R, cx + R, cy, cz + R, cx - R, cy, cz + R);
        poolUV.push(0, 0, 1, 0, 1, 1, 0, 1);
        poolIdx.push(n, n + 2, n + 1, n, n + 3, n + 2);
        n += 4;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(poolPos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(poolUV, 2));
    g.setIndex(poolIdx);
    const poolMat = new THREE.MeshBasicMaterial({
      map: TX.radialSprite('pool', 'rgba(255,200,130,0.55)', 'rgba(255,170,90,0)', 128),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: true,
    });
    const pools = new THREE.Mesh(g, poolMat);
    pools.renderOrder = 2;
    this.group.add(pools);
  }

  buildNeons(placed) {
    const words = [['HÔTEL', '#ff3b6b'], ['CAFÉ', '#ffd23b'], ['BAR', '#39d0ff'], ['CINÉMA', '#ff6a2b'], ['PHARMACIE', '#39ff7a'], ['BOWLING', '#c45bff'], ['PIZZA', '#ff4040'], ['JAZZ CLUB', '#4fa3ff']];
    const r = this.r;
    for (let k = 0; k < Math.min(26, placed.length); k++) {
      const p = placed[Math.floor(r() * placed.length)];
      const [txt, col] = words[k % words.length];
      const tex = TX.textTexture(txt, { w: 512, h: 128, bg: '#050505', fg: col, font: 'bold 80px Arial' });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(2.2, 2.2, 2.2) }));
      // orientée vers le circuit le plus proche
      const t = this.track;
      const i = t.nearestGlobal(p[0], p[1]);
      const ang = Math.atan2(t.px[i] - p[0], t.pz[i] - p[1]);
      const off = p[2] * 0.5 + 0.3;
      m.position.set(p[0] + Math.sin(ang) * off, this.groundAt(p[0], p[1]) + 7 + r() * 6, p[1] + Math.cos(ang) * off);
      m.rotation.y = ang;
      this.group.add(m);
    }
  }

  // ------------------------------------------------------------------ Grand Prix
  buildGP() {
    const q = this.quality.trees;
    const f = this.forest(InstancedForest, 11);
    this.scatter(f, Math.round(1500 * q), ['deciduous', 'deciduous', 'pine'], { clump: 300, threshold: 0.05, minClear: 25 });
    this.scatter(f, Math.round(900 * q), ['deciduous', 'pine'], { clump: 700, threshold: -0.4, minClear: 60 });
    f.build();
    // Tribunes supplémentaires dans les virages
    const t = this.track;
    for (let i = 0; i < t.count; i += 3) {
      if (Math.abs(t.kappa[i]) > 1 / 60 && this.r() < 0.06) {
        const side = t.kappa[i] > 0 ? -1 : 1; // extérieur du virage
        this.grandstand(i, side, 50, 8);
        i += 60;
      }
    }
  }

  // Zone départ/arrivée : tribune principale, stands, tour de contrôle
  buildStartArea() {
    const t = this.track;
    const iStart = t.indexAt(t.startS);
    // infield : côté de la courbure moyenne du tour (horaire -> droite)
    let sumK = 0;
    for (let i = 0; i < t.count; i++) sumK += t.kappa[i];
    const infield = sumK > 0 ? 1 : -1;
    const big = this.theme === 'gp';
    this.grandstand(iStart, -infield, big ? 220 : 90, big ? 14 : 9);
    if (big || this.theme === 'coast' || this.theme === 'countryside') this.pitBuilding(iStart, infield, big ? 260 : 120);
  }

  // Extrusion continue d'un profil [[décalage depuis le mur, hauteur], ...] le long du circuit
  extrude(i0, count, side, profile, material, opts = {}) {
    const t = this.track;
    const pos = [], uv = [];
    const step = opts.step || 1;
    const rows = [];
    for (let k = 0; k <= count; k += step) {
      const i = t.idx(i0 + k);
      const wall = (side > 0 ? t.wallR[i] : t.wallL[i]) + (opts.offset || 0);
      const hl = Math.hypot(t.rx[i], t.rz[i]) || 1;
      const rx = (t.rx[i] / hl) * side, rz = (t.rz[i] / hl) * side;
      const y0 = opts.baseY !== undefined ? opts.baseY : surfaceY(t, i, side * wall);
      rows.push({ s: k * t.spacing, pts: profile.map(([d, hh]) => [t.px[i] + rx * (wall + d), y0 + hh, t.pz[i] + rz * (wall + d)]) });
    }
    const vLen = [0];
    for (let j = 1; j < profile.length; j++) vLen.push(vLen[j - 1] + Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]));
    for (let r = 0; r < rows.length - 1; r++) {
      const A = rows[r], B = rows[r + 1];
      for (let j = 0; j < profile.length - 1; j++) {
        if (opts.skip && opts.skip(j)) continue;
        const a0 = A.pts[j], a1 = A.pts[j + 1], b0 = B.pts[j], b1 = B.pts[j + 1];
        const u0 = A.s / (opts.uS || 6), u1 = B.s / (opts.uS || 6);
        const v0 = vLen[j] / (opts.vS || 4), v1 = vLen[j + 1] / (opts.vS || 4);
        pos.push(...a0, ...b0, ...a1, ...a1, ...b0, ...b1);
        uv.push(u0, v0, u1, v0, u0, v1, u0, v1, u1, v0, u1, v1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material);
    m.castShadow = opts.cast !== false;
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }

  grandstand(i0, side, length, rows) {
    const t = this.track;
    const crowdMat = this.cachedMat('crowd', () => new THREE.MeshStandardMaterial({ map: TX.crowd(), roughness: 0.9, side: THREE.DoubleSide }));
    const concM = this.cachedMat('gsConc', () => new THREE.MeshStandardMaterial({ map: TX.concrete(170), color: 0xd0d2d6, roughness: 0.9, side: THREE.DoubleSide }));
    const roofM = this.cachedMat('gsRoof', () => new THREE.MeshStandardMaterial({ color: 0xf2f3f5, metalness: 0.2, roughness: 0.55, side: THREE.DoubleSide }));
    const steelM = this.cachedMat('gsSteel', () => new THREE.MeshStandardMaterial({ color: 0x4a4e56, metalness: 0.6, roughness: 0.5 }));
    const count = Math.round(length / t.spacing);
    const start = t.idx(i0 - Math.floor(count / 2));
    // Gradins : contremarche 0,45 m + marche 0,85 m
    const prof = [[3.2, -0.5], [3.2, 0.9]];
    let d = 3.2, hh = 0.9;
    for (let r = 0; r < rows; r++) {
      prof.push([d + 0.85, hh]);
      d += 0.85;
      prof.push([d, hh + 0.45]);
      hh += 0.45;
    }
    this.extrude(start, count, side, prof, crowdMat, { uS: 8.2, vS: 10.4, step: 2 });
    // Mur arrière et façade
    const back = d + 0.3;
    this.extrude(start, count, side, [[back, -0.5], [back, hh + 3.2]], concM, { uS: 6, vS: 6, step: 2 });
    this.extrude(start, count, side, [[2.9, -0.5], [2.9, 1.0], [3.2, 1.0]], concM, { uS: 6, vS: 6, step: 2 });
    // Toit en porte-à-faux
    this.extrude(start, count, side, [[back + 0.5, hh + 3.2], [2.2, hh + 4.0]], roofM, { uS: 10, vS: 10, step: 2 });
    // Poteaux
    for (let k = 0; k <= count; k += 12) {
      const i = t.idx(start + k);
      const wall = side > 0 ? t.wallR[i] : t.wallL[i];
      const hl = Math.hypot(t.rx[i], t.rz[i]) || 1;
      const off = wall + back;
      const y0 = surfaceY(t, i, side * wall);
      this.bin.add('gsSteel', steelM, new THREE.BoxGeometry(0.35, hh + 3.8, 0.35), mat(t.px[i] + (t.rx[i] / hl) * off * side, y0 + (hh + 3.8) / 2 - 0.3, t.pz[i] + (t.rz[i] / hl) * off * side));
    }
  }

  pitBuilding(i0, side, length) {
    const t = this.track;
    const wallM = this.cachedMat('pitWall', () => new THREE.MeshStandardMaterial({ map: TX.concrete(228), color: 0xf4f4f4, roughness: 0.8, side: THREE.DoubleSide }));
    const glassM = this.cachedMat('pitGlass', () => new THREE.MeshStandardMaterial({ color: 0x1b2833, roughness: 0.08, metalness: 0.7, side: THREE.DoubleSide }));
    const doorM = this.cachedMat('pitDoor', () => new THREE.MeshStandardMaterial({ map: TX.garageDoors(), roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide }));
    const laneM = this.cachedMat('pitLane', () => new THREE.MeshStandardMaterial({ map: TX.asphalt().map, color: 0x8f8f92, roughness: 0.9 }));
    const count = Math.round(length / t.spacing);
    const start = t.idx(i0 - Math.floor(count / 2));
    // voie des stands (sol)
    this.extrude(start, count, side, [[0.6, 0.02], [9.5, 0.02]], laneM, { uS: 7, vS: 7, cast: false });
    // façade : portes de garage (rez-de-chaussée) + baie vitrée (étage) + toit
    this.extrude(start, count, side, [[9.5, 0], [9.5, 4.2]], doorM, { uS: 6, vS: 4.2 });
    this.extrude(start, count, side, [[9.5, 4.2], [9.5, 4.8], [9.0, 4.8]], wallM, { uS: 6, vS: 6 });
    this.extrude(start, count, side, [[9.0, 4.8], [9.0, 7.6]], glassM, { uS: 6, vS: 6 });
    this.extrude(start, count, side, [[8.4, 7.6], [9.0, 7.6], [9.0, 8.4], [24, 8.4], [24, 0]], wallM, { uS: 6, vS: 6 });
  }

  // Panneaux publicitaires sur poteaux
  buildBillboards() {
    const t = this.track;
    if (this.theme === 'city' || this.theme === 'mountain') return;
    const r = this.r;
    const legM = this.cachedMat('bbLeg', () => new THREE.MeshStandardMaterial({ color: 0x55585e, metalness: 0.6, roughness: 0.5 }));
    let k = 0;
    for (let i = 10; i < t.count; i += 40 + Math.floor(r() * 30)) {
      const side = r() < 0.5 ? -1 : 1;
      const wall = side > 0 ? t.wallR[i] : t.wallL[i];
      const hl = Math.hypot(t.rx[i], t.rz[i]) || 1;
      const rx = t.rx[i] / hl, rz = t.rz[i] / hl;
      const off = wall + 2.5;
      const x = t.px[i] + rx * off * side, z = t.pz[i] + rz * off * side;
      if (this.clearance(x, z) < 1.5) continue;
      const y = surfaceY(t, i, side * wall);
      const bi = k++ % 10;
      const m = this.cachedMat('bb' + bi, () => new THREE.MeshStandardMaterial({ map: TX.banner(bi), roughness: 0.55 }));
      const rot = -t.heading[i] + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
      const panel = new THREE.PlaneGeometry(10, 1.9);
      this.bin.add('bb' + bi, m, panel, mat(x, y + 2.6, z, rot));
      const back = new THREE.PlaneGeometry(10, 1.9);
      back.rotateY(Math.PI);
      this.bin.add('bbLeg', legM, back, mat(x, y + 2.6, z, rot));
      for (const dx of [-4, 4]) {
        const c = Math.cos(rot), s = Math.sin(rot);
        this.bin.add('bbLeg', legM, new THREE.CylinderGeometry(0.07, 0.07, 2.4, 5), mat(x + c * dx, y + 1.0, z - s * dx));
      }
    }
  }

  update(dt, cam) {
    if (cam && this.forests) {
      const far = this.theme === 'mountain' ? 1400 : 950;
      for (const f of this.forests) cullForest(f, cam, far);
    }
    if (this.water) {
      this.water.map.offset.x += dt * 0.004;
      this.water.map.offset.y += dt * 0.0025;
    }
  }
}

export { clamp, smoothstep };
