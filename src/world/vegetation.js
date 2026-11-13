// Végétation procédurale instanciée (feuillus, pins, cyprès, pins parasols, palmiers,
// dattiers, épicéas, sapins enneigés, bouleaux, chênes verts, buissons, vignes), découpée en
// tuiles pour l'élimination hors champ, avec un niveau de détail simplifié au loin.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Noise2D } from '../core/noise.js';
import { rng, lerp, clamp } from '../core/utils.js';

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
    const blobs = 5 + Math.floor(r() * 3);
    for (let i = 0; i < blobs; i++) {
      const rad = 1.7 + r() * 1.3;
      const s = new THREE.IcosahedronGeometry(rad, 0);
      displace(s, 0.6, r);
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
      const c = new THREE.ConeGeometry(rad, ch, 6, 1);
      displace(c, 0.35, r);
      c.translate(0, h * 0.3 + u * h * 0.62 + ch / 2, 0);
      parts.push(colorize(c, green, 0.15, r));
    }
  } else if (kind === 'cypress') {
    const h = 8 + r() * 5;
    const trunk = new THREE.CylinderGeometry(0.1, 0.18, 2, 5);
    parts.push(colorize(trunk, TRUNK, 0.1, r));
    const s = new THREE.SphereGeometry(1, 6, 6);
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
      const s = new THREE.IcosahedronGeometry(2.4 + r(), 0);
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
      const seg = new THREE.CylinderGeometry(0.2, 0.24, h / segs + 0.05, 6, 1, true);
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
    const s = new THREE.BoxGeometry(0.7, 1.2, 1.8, 1, 1, 1);
    displace(s, 0.25, r);
    s.translate(0, 0.6, 0);
    parts.push(colorize(s, [0.27, 0.36, 0.13], 0.2, r));
  } else if (kind === 'rock') {
    const s = new THREE.IcosahedronGeometry(1, 0);
    displace(s, 0.5, r);
    s.scale(1.4, 0.8, 1.1);
    s.translate(0, 0.2, 0);
    const g = 0.26 + r() * 0.1;
    parts.push(colorize(s, [g, g * 0.95, g * 0.88], 0.12, r));
  } else if (kind === 'snowrock') {
    // Rocher à demi enfoui avec calotte de neige
    const s = new THREE.IcosahedronGeometry(1, 1);
    displace(s, 0.45, r);
    s.scale(1.5, 0.75, 1.2);
    s.translate(0, 0.15, 0);
    const n = s.attributes.normal, col = new Float32Array(s.attributes.position.count * 3);
    for (let i = 0; i < n.count; i++) {
      const g = 0.3 + r() * 0.06;
      col.set(n.getY(i) > 0.55 ? [0.9, 0.92, 0.96] : [g, g * 0.97, g * 0.94], i * 3);
    }
    s.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(s);
  } else if (kind === 'spruce' || kind === 'snowspruce') {
    // Épicéa élancé à étages ; version enneigée : dessus des étages blanc
    const snowy = kind === 'snowspruce';
    const h = 15 + r() * 8;
    const trunk = new THREE.CylinderGeometry(0.14, 0.38, h * 0.55 + 1, 5);
    trunk.translate(0, (h * 0.55 + 1) / 2 - 1, 0);
    parts.push(colorize(trunk, [0.27, 0.2, 0.14], 0.1, r));
    const green = [0.022 + r() * 0.012, 0.055 + r() * 0.02, 0.03];
    const tiers = 6;
    for (let i = 0; i < tiers; i++) {
      const u = i / (tiers - 1);
      const rad = lerp(3.1, 0.55, Math.pow(u, 0.9)) * (0.9 + r() * 0.2);
      const ch = lerp(h * 0.26, h * 0.17, u);
      const c = new THREE.ConeGeometry(rad, ch, 7, 1, true);
      displace(c, 0.3, r);
      const pos = c.attributes.position;
      const col = new Float32Array(pos.count * 3);
      for (let k = 0; k < pos.count; k++) {
        const t = (pos.getY(k) + ch / 2) / ch; // 0 base, 1 sommet
        const j = 0.85 + r() * 0.3;
        let cc = [green[0] * j, green[1] * j, green[2] * j];
        if (snowy) {
          const sn = clamp(smooth01((t - 0.15) / 0.55) * 0.95 + (r() - 0.5) * 0.25, 0, 1);
          cc = [lerp(cc[0], 0.9, sn), lerp(cc[1], 0.93, sn), lerp(cc[2], 0.97, sn)];
        }
        col.set(cc, k * 3);
      }
      c.setAttribute('color', new THREE.BufferAttribute(col, 3));
      c.translate(0, h * 0.16 + u * h * 0.7 + ch / 2, 0);
      parts.push(c);
    }
  } else if (kind === 'beech') {
    // Hêtre de futaie : tronc gris élancé, houppier sombre et haut
    const h = 7 + r() * 3;
    const trunk = new THREE.CylinderGeometry(0.2, 0.36, h + 1, 6);
    trunk.translate(0, (h + 1) / 2 - 1, 0);
    parts.push(colorize(trunk, [0.32, 0.31, 0.28], 0.08, r));
    const green = [[0.045, 0.1, 0.025], [0.06, 0.115, 0.03], [0.04, 0.085, 0.025]][Math.floor(r() * 3)];
    for (let i = 0; i < 6; i++) {
      const rad = 2.0 + r() * 1.4;
      const s = new THREE.IcosahedronGeometry(rad, 0);
      s.scale(1, 1.15, 1);
      displace(s, 0.7, r);
      const a = r() * Math.PI * 2, d = i === 0 ? 0 : 1.3 + r() * 1.2;
      s.translate(Math.cos(a) * d, h + 1.5 + r() * 3, Math.sin(a) * d);
      parts.push(colorize(s, green, 0.2, r));
    }
  } else if (kind === 'hedge') {
    // Haie basse et touffue
    for (let i = 0; i < 4; i++) {
      const s = new THREE.IcosahedronGeometry(0.9 + r() * 0.4, 0);
      s.scale(1.3, 0.8, 1);
      displace(s, 0.35, r);
      s.translate((i - 1.5) * 1.1, 0.7 + r() * 0.3, (r() - 0.5) * 0.5);
      parts.push(colorize(s, [0.05, 0.1, 0.03], 0.2, r));
    }
  } else if (kind === 'birch') {
    const h = 9 + r() * 4;
    const trunk = new THREE.CylinderGeometry(0.1, 0.2, h, 6, 4);
    trunk.translate(0, h / 2 - 0.5, 0);
    // écorce blanche tachetée de noir
    const tp = trunk.attributes.position, tc = new Float32Array(tp.count * 3);
    for (let k = 0; k < tp.count; k++) tc.set(r() < 0.22 ? [0.18, 0.17, 0.15] : [0.86, 0.85, 0.8], k * 3);
    trunk.setAttribute('color', new THREE.BufferAttribute(tc, 3));
    parts.push(trunk);
    for (let i = 0; i < 4; i++) {
      const s = new THREE.IcosahedronGeometry(1.4 + r() * 0.8, 0);
      s.scale(0.85, 1.5, 0.85);
      displace(s, 0.4, r);
      const a = r() * Math.PI * 2, d = i === 0 ? 0 : 0.8 + r() * 0.6;
      s.translate(Math.cos(a) * d, h * 0.62 + r() * h * 0.3, Math.sin(a) * d);
      parts.push(colorize(s, [0.14 + r() * 0.04, 0.22, 0.05], 0.18, r));
    }
  } else if (kind === 'datepalm') {
    // Dattier : stipe annelé épais, couronne dense de palmes arquées
    const h = 8 + r() * 5;
    const segs = 8;
    let x = 0, y = 0;
    const lean = (r() - 0.5) * 0.12;
    for (let i = 0; i < segs; i++) {
      const seg = new THREE.CylinderGeometry(0.27 - i * 0.008, 0.3 - i * 0.008, h / segs + 0.04, 7, 1, true);
      seg.rotateZ(-lean);
      seg.translate(x, y + h / segs / 2, 0);
      const l = i % 2 ? 0.95 : 0.78;
      parts.push(colorize(seg, [0.46 * l, 0.36 * l, 0.25 * l], 0.06, r));
      x += Math.sin(lean) * (h / segs);
      y += h / segs;
    }
    const heart = new THREE.IcosahedronGeometry(0.55, 0);
    heart.translate(x, y + 0.1, 0);
    parts.push(colorize(heart, [0.35, 0.33, 0.16], 0.1, r));
    const fronds = 13;
    for (let i = 0; i < fronds; i++) {
      const a = (i / fronds) * Math.PI * 2 + r() * 0.25;
      const up = i % 3 === 0 ? 0.9 : 0.35 + r() * 0.35; // palmes hautes et retombantes
      parts.push(frond(x, y + 0.2, a, 4.2 + r() * 1.2, up, r, 4));
    }
  } else if (kind === 'shrub') {
    // Broussaille du désert : touffe basse et sèche
    for (let i = 0; i < 3; i++) {
      const s = new THREE.IcosahedronGeometry(0.55 + r() * 0.35, 0);
      s.scale(1.2, 0.6, 1.2);
      displace(s, 0.25, r);
      s.translate((r() - 0.5) * 0.9, 0.25 + r() * 0.2, (r() - 0.5) * 0.9);
      parts.push(colorize(s, [0.44 + r() * 0.06, 0.4, 0.24], 0.2, r));
    }
  } else if (kind === 'liveoak') {
    // Chêne vert de Floride : houppier large et bas, mousse espagnole pendante
    const h = 5 + r() * 2;
    const trunk = new THREE.CylinderGeometry(0.35, 0.6, h + 1, 7);
    trunk.translate(0, (h + 1) / 2 - 1, 0);
    parts.push(colorize(trunk, [0.3, 0.25, 0.2], 0.1, r));
    for (let i = 0; i < 7; i++) {
      const s = new THREE.IcosahedronGeometry(2.6 + r() * 1.2, 0);
      s.scale(1.25, 0.55, 1.25);
      displace(s, 0.6, r);
      const a = r() * Math.PI * 2, d = i === 0 ? 0 : 2.5 + r() * 2.5;
      s.translate(Math.cos(a) * d, h + 1 + r() * 1.5, Math.sin(a) * d);
      parts.push(colorize(s, [0.16, 0.25, 0.1], 0.15, r));
    }
    for (let i = 0; i < 6; i++) {
      const m = new THREE.ConeGeometry(0.35, 1.8 + r(), 4, 1, true);
      m.rotateX(Math.PI);
      const a = r() * Math.PI * 2, d = 2 + r() * 3;
      m.translate(Math.cos(a) * d, h - 0.2, Math.sin(a) * d);
      parts.push(colorize(m, [0.5, 0.52, 0.42], 0.15, r));
    }
  }
  const merged = mergeGeometries(parts.map(clean), false);
  return merged;
}

const smooth01 = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

// Palme arquée (bande effilée en V, visible des deux côtés) partant de (x0, y0, 0) vers l'angle a
function frond(x0, y0, a, len, up, r, N = 6) {
  const pos = [], col = [], pts = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    // montée puis retombée (parabole), largeur en fuseau
    pts.push([t * len, up * len * 0.5 * t - len * 0.55 * t * t, 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.05)) + 0.05]);
  }
  const c = [0.22 + r() * 0.06, 0.34 + r() * 0.06, 0.12];
  const ca = Math.cos(a), sa = Math.sin(a);
  const P = (d, yy, side) => [x0 + ca * d - sa * side, y0 + yy, sa * d + ca * side];
  for (let k = 0; k < N; k++) {
    const [d0, ya, w0] = pts[k], [d1, yb, w1] = pts[k + 1];
    const A = P(d0, ya, 0), B = P(d1, yb, 0);
    const L0 = P(d0, ya - w0 * 0.25, -w0), L1 = P(d1, yb - w1 * 0.25, -w1);
    const R0 = P(d0, ya - w0 * 0.25, w0), R1 = P(d1, yb - w1 * 0.25, w1);
    for (const tri of [[A, L0, B], [B, L0, L1], [A, B, R0], [B, R1, R0]]) {
      pos.push(...tri[0], ...tri[1], ...tri[2]);
      pos.push(...tri[0], ...tri[2], ...tri[1]); // face arrière
      for (let q = 0; q < 6; q++) col.push(...c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// Version simplifiée (lointaine) d'une essence ; null si l'essence n'en a pas
export function treeLowGeometry(kind, seed = 1) {
  const r = rng(seed + 5);
  const parts = [];
  if (kind === 'pine' || kind === 'spruce' || kind === 'snowspruce' || kind === 'cypress') {
    const h = kind === 'pine' ? 13 : kind === 'cypress' ? 10 : 19;
    const rad = kind === 'cypress' ? 1.2 : kind === 'pine' ? 2.6 : 2.9;
    const c = new THREE.ConeGeometry(rad, h * (kind === 'pine' ? 0.7 : 0.88), 6, 1, true);
    c.translate(0, h * (kind === 'pine' ? 0.62 : 0.5), 0);
    if (kind === 'snowspruce') {
      const pos = c.attributes.position, col = new Float32Array(pos.count * 3);
      for (let k = 0; k < pos.count; k++) {
        const sn = 0.35 + clamp((pos.getY(k) - h * 0.06) / (h * 0.88), 0, 1) * 0.5;
        col.set([lerp(0.035, 0.9, sn), lerp(0.075, 0.92, sn), lerp(0.04, 0.96, sn)], k * 3);
      }
      c.setAttribute('color', new THREE.BufferAttribute(col, 3));
      parts.push(c);
    } else {
      parts.push(colorize(c, kind === 'pine' ? [0.12, 0.22, 0.1] : kind === 'cypress' ? [0.13, 0.22, 0.11] : [0.035, 0.075, 0.04], 0.1, r));
    }
  } else if (kind === 'deciduous' || kind === 'umbrella' || kind === 'birch' || kind === 'liveoak' || kind === 'beech') {
    const s = new THREE.IcosahedronGeometry(kind === 'birch' ? 1.9 : kind === 'liveoak' ? 4.5 : kind === 'beech' ? 3.6 : 3, 0);
    s.scale(1, kind === 'umbrella' || kind === 'liveoak' ? 0.5 : kind === 'birch' ? 1.6 : 1, 1);
    s.translate(0, kind === 'umbrella' ? 9 : kind === 'liveoak' ? 6.5 : kind === 'birch' ? 9 : kind === 'beech' ? 10 : 5.6, 0);
    const col = { deciduous: [0.22, 0.34, 0.11], umbrella: [0.2, 0.3, 0.13], birch: [0.2, 0.3, 0.08], liveoak: [0.16, 0.25, 0.1], beech: [0.05, 0.1, 0.03] }[kind];
    parts.push(colorize(s, col, 0.12, r));
    const t = new THREE.CylinderGeometry(0.2, 0.3, 4, 4, 1, true);
    t.translate(0, 1.5, 0);
    parts.push(colorize(t, kind === 'birch' ? [0.8, 0.8, 0.76] : TRUNK, 0.05, r));
  } else if (kind === 'palm' || kind === 'datepalm') {
    // stipe à 5 pans et couronne de 6 palmes en V (deux faces)
    const date = kind === 'datepalm';
    const h = date ? 10.5 : 9;
    const t = new THREE.CylinderGeometry(date ? 0.24 : 0.18, date ? 0.3 : 0.24, h, 5, 1, true);
    t.translate(0, h / 2, 0);
    parts.push(colorize(t, date ? [0.4, 0.31, 0.21] : [0.42, 0.34, 0.24], 0.05, r));
    for (let i = 0; i < 6; i++) parts.push(frond(0, h, (i / 6) * Math.PI * 2 + r() * 0.3, date ? 4.8 : 4.2, i % 2 ? 0.8 : 0.4, r, 2));
  } else {
    return null;
  }
  return mergeGeometries(parts.map(clean), false);
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

  // tile : taille des tuiles (m) ; lodDist : au-delà de cette distance (au bord de la tuile),
  // les essences qui en ont une utilisent leur version simplifiée (sans ombre portée)
  build(tile = 450, castShadow = true, lodDist = 260) {
    lodDist *= this.lodScale ?? 1;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    const tileKey = (it) => Math.floor(it[0] / tile) + ',' + Math.floor(it[2] / tile);
    const fill = (im, list) => {
      list.forEach((it, i) => {
        q.setFromAxisAngle(up, it[4]);
        v.set(it[0], it[1], it[2]);
        s.set(it[3], it[3] * (0.9 + ((i * 7) % 5) * 0.05), it[3]);
        m4.compose(v, q, s);
        im.setMatrixAt(i, m4);
      });
      im.computeBoundingSphere();
    };
    const sets = new Map(); // tuile -> { full: [], low: [], center, radius }
    const setOf = (k) => {
      if (!sets.has(k)) sets.set(k, { full: [], low: [], center: new THREE.Vector3(), radius: 0, state: -1 });
      return sets.get(k);
    };
    const lowItems = new Map(); // essence -> tuile -> instances (toutes variantes confondues)
    for (const { kind, seed, items } of this.lists.values()) {
      const geo = treeGeometry(kind, seed);
      const tiles = new Map();
      for (const it of items) {
        const k = tileKey(it);
        if (!tiles.has(k)) tiles.set(k, []);
        tiles.get(k).push(it);
      }
      const hasLow = lodDist > 0 && LOW_KINDS.has(kind);
      for (const [k, list] of tiles) {
        const im = new THREE.InstancedMesh(geo, this.mat, list.length);
        fill(im, list);
        im.castShadow = castShadow && kind !== 'vine' && kind !== 'shrub';
        im.receiveShadow = true;
        // 'low' : remplacée au loin par la version simplifiée ; 'small' : masquée au loin
        im.userData.lod = hasLow ? 'low' : SMALL_KINDS.has(kind) ? 'small' : '';
        setOf(k).full.push(im);
        this.group.add(im);
        if (hasLow) {
          if (!lowItems.has(kind)) lowItems.set(kind, new Map());
          const lm = lowItems.get(kind);
          if (!lm.has(k)) lm.set(k, []);
          for (const it of list) lm.get(k).push(it);
        }
      }
    }
    for (const [kind, byTile] of lowItems) {
      const geo = treeLowGeometry(kind, kind.length * 13);
      for (const [k, list] of byTile) {
        const im = new THREE.InstancedMesh(geo, this.mat, list.length);
        fill(im, list);
        im.castShadow = false;
        im.receiveShadow = false;
        im.visible = false;
        setOf(k).low.push(im);
        this.group.add(im);
      }
    }
    // Sphère englobante de chaque tuile
    const box = new THREE.Box3();
    for (const st of sets.values()) {
      box.makeEmpty();
      for (const im of st.full) box.union(im.boundingSphere.getBoundingBox(new THREE.Box3()));
      box.getCenter(st.center);
      st.radius = box.getSize(v).length() / 2;
    }
    this.tileSets = [...sets.values()];
    this.lodDist = lodDist;
  }
}

const LOW_KINDS = new Set(['pine', 'spruce', 'snowspruce', 'cypress', 'deciduous', 'umbrella', 'birch', 'liveoak', 'beech', 'palm', 'datepalm']);
const SMALL_KINDS = new Set(['rock', 'snowrock', 'bush', 'shrub', 'hedge', 'vine']);

// Masque les tuiles lointaines (au-delà du brouillard utile) et choisit le niveau de détail
export function cullForest(forest, cam, maxDist) {
  if (!forest?.tileSets) return;
  const lod = forest.lodDist;
  for (const st of forest.tileSets) {
    const d = st.center.distanceTo(cam) - st.radius;
    // 0 : masquée, 1 : détaillée, 2 : simplifiée
    const state = d >= maxDist ? 0 : d < lod ? 1 : 2;
    if (state === st.state) continue;
    st.state = state;
    for (const im of st.full) im.visible = state === 1 || (state === 2 && !im.userData.lod);
    for (const im of st.low) im.visible = state === 2;
  }
}

export { Noise2D };
