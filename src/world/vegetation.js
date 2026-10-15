// Végétation procédurale instanciée (feuillus, pins, cyprès, pins parasols, palmiers,
// buissons, vignes), découpée en tuiles pour l'élimination hors champ.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Noise2D } from '../core/noise.js';
import { rng, lerp } from '../core/utils.js';

function colorize(g, c, jitter = 0.08, r = Math.random) {
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const k = 1 - jitter + r() * jitter * 2;
    col[i * 3] = c[0] * k;
    col[i * 3 + 1] = c[1] * k;
    col[i * 3 + 2] = c[2] * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function displace(g, amt, r) {
  const p = g.attributes.position;
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!map.has(key)) map.set(key, [(r() - 0.5) * amt, (r() - 0.5) * amt, (r() - 0.5) * amt]);
    const d = map.get(key);
    p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
  }
  g.computeVertexNormals();
  return g;
}

function clean(g) {
  // Uniformise les attributs pour la fusion
  const out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) if (!['position', 'normal', 'color'].includes(k)) out.deleteAttribute(k);
  if (!out.attributes.normal) out.computeVertexNormals();
  return out;
}

const TRUNK = [0.32, 0.23, 0.15];

export function treeGeometry(kind, seed = 1) {
  const r = rng(seed);
  const parts = [];
  if (kind === 'deciduous') {
    const h = 3 + r() * 1.5;
    const trunk = new THREE.CylinderGeometry(0.16, 0.28, h + 1, 6);
    trunk.translate(0, (h + 1) / 2 - 1, 0);
    parts.push(colorize(trunk, TRUNK, 0.1, r));
    const green = [[0.2, 0.33, 0.1], [0.25, 0.37, 0.12], [0.18, 0.3, 0.12], [0.3, 0.38, 0.13]][Math.floor(r() * 4)];
    const blobs = 4 + Math.floor(r() * 3);
    for (let i = 0; i < blobs; i++) {
      const rad = 1.8 + r() * 1.4;
      const s = new THREE.IcosahedronGeometry(rad, 1);
      displace(s, 0.7, r);
      const a = r() * Math.PI * 2, d = i === 0 ? 0 : 1.2 + r() * 1.0;
      s.translate(Math.cos(a) * d, h + 1.6 + r() * 2.2, Math.sin(a) * d);
      parts.push(colorize(s, green, 0.18, r));
    }
  } else if (kind === 'pine') {
    const h = 10 + r() * 6;
    const trunk = new THREE.CylinderGeometry(0.12, 0.3, h * 0.5 + 1, 5);
    trunk.translate(0, (h * 0.5 + 1) / 2 - 1, 0);
    parts.push(colorize(trunk, TRUNK, 0.1, r));
    const green = [0.12 + r() * 0.04, 0.22 + r() * 0.05, 0.1];
    const tiers = 4;
    for (let i = 0; i < tiers; i++) {
      const u = i / tiers;
      const rad = lerp(2.8, 0.9, u) * (0.9 + r() * 0.2);
      const ch = lerp(5, 3.2, u);
      const c = new THREE.ConeGeometry(rad, ch, 7, 1);
      displace(c, 0.35, r);
      c.translate(0, h * 0.3 + u * h * 0.62 + ch / 2, 0);
      parts.push(colorize(c, green, 0.15, r));
    }
  } else if (kind === 'cypress') {
    const h = 8 + r() * 5;
    const trunk = new THREE.CylinderGeometry(0.1, 0.18, 2, 5);
    parts.push(colorize(trunk, TRUNK, 0.1, r));
    const s = new THREE.SphereGeometry(1, 8, 8);
    s.scale(1.1, h / 2, 1.1);
    displace(s, 0.25, r);
    s.translate(0, h / 2 + 0.6, 0);
    parts.push(colorize(s, [0.13, 0.22, 0.11], 0.15, r));
  } else if (kind === 'umbrella') {
    const h = 8 + r() * 4;
    const trunk = new THREE.CylinderGeometry(0.18, 0.32, h + 1, 6);
    trunk.translate(0.4, (h + 1) / 2 - 1, 0);
    trunk.rotateZ(-0.06);
    parts.push(colorize(trunk, [0.36, 0.26, 0.18], 0.1, r));
    for (let i = 0; i < 5; i++) {
      const s = new THREE.IcosahedronGeometry(2.4 + r(), 1);
      s.scale(1.3, 0.42, 1.3);
      displace(s, 0.5, r);
      const a = r() * Math.PI * 2, d = i === 0 ? 0 : 2 + r() * 1.5;
      s.translate(Math.cos(a) * d, h + r() * 0.8, Math.sin(a) * d);
      parts.push(colorize(s, [0.2, 0.3, 0.13], 0.15, r));
    }
  } else if (kind === 'palm') {
    const h = 7 + r() * 4;
    const segs = 6;
    let x = 0, y = 0;
    const lean = 0.06 + r() * 0.1;
    for (let i = 0; i < segs; i++) {
      const seg = new THREE.CylinderGeometry(0.2, 0.24, h / segs + 0.05, 6);
      seg.rotateZ(-lean * (i / segs) * 2);
      seg.translate(x, y + h / segs / 2, 0);
      parts.push(colorize(seg, [0.42, 0.34, 0.24], 0.12, r));
      x += Math.sin(lean * (i / segs) * 2) * (h / segs);
      y += h / segs;
    }
    const fronds = 9;
    for (let i = 0; i < fronds; i++) {
      const a = (i / fronds) * Math.PI * 2 + r() * 0.3;
      const f = new THREE.ConeGeometry(0.5, 4.2, 3, 1);
      f.scale(1, 1, 0.18);
      f.rotateX(Math.PI / 2);
      f.translate(0, 0, 2.1);
      f.rotateX(0.55 + r() * 0.3); // retombée
      f.rotateY(a);
      f.translate(x, y + 0.1, 0);
      parts.push(colorize(f, [0.24, 0.36, 0.12], 0.15, r));
    }
  } else if (kind === 'bush') {
    for (let i = 0; i < 3; i++) {
      const s = new THREE.IcosahedronGeometry(0.8 + r() * 0.5, 0);
      displace(s, 0.3, r);
      s.translate((r() - 0.5) * 1.2, 0.5 + r() * 0.3, (r() - 0.5) * 1.2);
      parts.push(colorize(s, [0.22, 0.32, 0.12], 0.2, r));
    }
  } else if (kind === 'vine') {
    const s = new THREE.BoxGeometry(0.7, 1.2, 1.8, 1, 2, 2);
    displace(s, 0.25, r);
    s.translate(0, 0.6, 0);
    parts.push(colorize(s, [0.27, 0.36, 0.13], 0.2, r));
  } else if (kind === 'rock') {
    const s = new THREE.IcosahedronGeometry(1, 1);
    displace(s, 0.6, r);
    s.scale(1.4, 0.8, 1.1);
    s.translate(0, 0.2, 0);
    const g = 0.26 + r() * 0.1;
    parts.push(colorize(s, [g, g * 0.95, g * 0.88], 0.12, r));
  }
  const merged = mergeGeometries(parts.map(clean), false);
  return merged;
}

// Construit un ensemble d'instances réparties en tuiles
export class InstancedForest {
  constructor(scene, seed = 1) {
    this.scene = scene;
    this.rand = rng(seed);
    this.group = new THREE.Group();
    this.group.name = 'vegetation';
    scene.add(this.group);
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, flatShading: false });
    this.lists = new Map();
  }

  add(kind, variants, x, y, z, scale, rot) {
    const v = Math.floor(this.rand() * variants);
    const key = kind + ':' + v;
    if (!this.lists.has(key)) this.lists.set(key, { kind, seed: v * 31 + kind.length * 7, items: [] });
    this.lists.get(key).items.push([x, y, z, scale, rot]);
  }

  build(tile = 350, castShadow = true) {
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (const { kind, seed, items } of this.lists.values()) {
      const geo = treeGeometry(kind, seed);
      const tiles = new Map();
      for (const it of items) {
        const k = Math.floor(it[0] / tile) + ',' + Math.floor(it[2] / tile);
        if (!tiles.has(k)) tiles.set(k, []);
        tiles.get(k).push(it);
      }
      for (const list of tiles.values()) {
        const im = new THREE.InstancedMesh(geo, this.mat, list.length);
        list.forEach((it, i) => {
          q.setFromAxisAngle(up, it[4]);
          v.set(it[0], it[1], it[2]);
          s.set(it[3], it[3] * (0.9 + ((i * 7) % 5) * 0.05), it[3]);
          m4.compose(v, q, s);
          im.setMatrixAt(i, m4);
        });
        im.castShadow = castShadow && kind !== 'vine';
        im.receiveShadow = true;
        im.computeBoundingSphere();
        this.group.add(im);
      }
    }
  }
}

export { Noise2D };
