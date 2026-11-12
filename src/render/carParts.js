// Pièces des voitures : roues (pneu à flanc inscrit, 9 styles de jantes creusées avec écrous, disque, étrier),
// ailerons, rétroviseurs, essuie-glaces, échappements, lèvres d'ailes, bas de caisse, lames, diffuseurs,
// barres de toit, écope, antenne, ailettes, pare-chocs chromés. Géométries mises en cache et fusionnables.
import * as THREE from 'three';
import { clamp, lerp } from '../core/utils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TIRE_V } from './carTextures.js';
import { fixNormals } from './carBody.js';

export const RIM_STYLES = ['five', 'six', 'ten', 'split', 'mesh', 'race', 'turbine', 'classic', 'multi'];
const GEO = new Map();
function cachedGeo(key, make) {
  let g = GEO.get(key);
  if (!g) { g = make(); g.__shared = true; if (g.attributes.normal) fixNormals(g); GEO.set(key, g); }
  return g;
}

// ---------------------------------------------------------------------------
// Outils de géométrie
// ---------------------------------------------------------------------------
// Normalise une géométrie pour la fusion : non indexée, normales, uv, couleur de sommet
export function prep(g, col = [1, 1, 1]) {
  if (g.index) g = g.toNonIndexed();
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.attributes.color || col !== null) {
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}

// Supprime les triangles d'une géométrie non indexée dont la normale (moyenne) vérifie test(nx, ny, nz)
export function dropFaces(g, test) {
  const keep = [];
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i += 3) {
    const nx = n.getX(i) + n.getX(i + 1) + n.getX(i + 2), ny = n.getY(i) + n.getY(i + 1) + n.getY(i + 2), nz = n.getZ(i) + n.getZ(i + 1) + n.getZ(i + 2);
    const l = Math.hypot(nx, ny, nz) || 1;
    if (!test(nx / l, ny / l, nz / l)) keep.push(i);
  }
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name], sz = a.itemSize;
    const arr = new a.array.constructor(keep.length * 3 * sz);
    keep.forEach((v, k) => arr.set(a.array.subarray(v * sz, (v + 3) * sz), k * 3 * sz));
    g.setAttribute(name, new THREE.BufferAttribute(arr, sz));
  }
  g.clearGroups();
  return g;
}

// UV métriques (projection selon l'axe dominant de la normale) : carbone, plastiques texturés
export function metricUV(g, scale = 1) {
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); } else if (ay >= az) { u = p.getX(i); v = p.getZ(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// Collecteur de géométries par matériau, fusionnées en un seul objet chacune
export class Buckets {
  constructor() { this.b = {}; }
  add(key, g, col) {
    if (!g) return;
    // matériau noir à couleurs de sommet (garnitures) : teinte par défaut sombre
    if (col === undefined) col = key === 'blk' ? [0.035, 0.036, 0.04] : [1, 1, 1];
    (this.b[key] || (this.b[key] = [])).push(prep(g, col));
  }
  merge() {
    const out = {};
    for (const [k, list] of Object.entries(this.b)) if (list.length) out[k] = mergeGeometries(list, false);
    return out;
  }
}

// Balayage d'un profil 2D (x latéral, y vertical) le long d'une polyligne 3D
export function sweep(path, profile, closed = true, up = new THREE.Vector3(0, 1, 0)) {
  const pos = [], idx = [];
  const T = new THREE.Vector3(), S = new THREE.Vector3(), U = new THREE.Vector3();
  const m = profile.length;
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    T.subVectors(b, a).normalize();
    S.crossVectors(T, up);
    if (S.lengthSq() < 1e-8) S.set(1, 0, 0);
    S.normalize();
    U.crossVectors(S, T).normalize();
    for (const [px, py] of profile) {
      const p = path[i];
      pos.push(p.x + S.x * px + U.x * py, p.y + S.y * px + U.y * py, p.z + S.z * px + U.z * py);
    }
    if (i > 0) {
      const a0 = (i - 1) * m, b0 = i * m;
      for (let k = 0; k < (closed ? m : m - 1); k++) {
        const k1 = (k + 1) % m;
        idx.push(a0 + k, b0 + k, a0 + k1, a0 + k1, b0 + k, b0 + k1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function flipGeometry(g) {
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}

function setColor(g, col) {
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

// ---------------------------------------------------------------------------
// Roues
// ---------------------------------------------------------------------------
// Atlas de roue : pneu en haut (v ∈ [2/3, 1]), disque en bas à gauche (u ∈ [0, 0.25], v ∈ [0, 2/3])
export const WHEEL_ATLAS = { tireV0: 2 / 3, discU1: 0.25 };

// Rayon visible de la jante (rebord compris) : diamètre en pouces de la fiche, sinon proportion type
export function rimRadius(wheel) {
  const R = wheel.radius;
  const rr = wheel.rimInch ? wheel.rimInch * 0.0127 + 0.014 : R * 0.69;
  return clamp(rr, R * 0.56, R * 0.8);
}

// Pneu : profil en révolution (axe X, flanc extérieur vers +X). mirrorUV : roues gauches (texte lisible)
export function tireGeometry(R, w, mirrorUV = false, rr = R * 0.69) {
  return cachedGeo(`tire${R.toFixed(3)}|${w.toFixed(3)}|${rr.toFixed(3)}|${mirrorUV}`, () => {
    const rim = rr;
    const sh = Math.min(0.03, w * 0.16);
    const hw = w / 2;
    // profil de l'extérieur (+y) vers l'intérieur (-y), x = rayon
    const pts = [];
    const vk = [];
    const side = (s, from, to) => {
      const prof = [[rim + 0.003, hw * 0.86], [lerp(rim, R, 0.22), hw * 0.99], [lerp(rim, R, 0.5), hw * 1.03], [lerp(rim, R, 0.78), hw * 1.0], [R - sh, hw * 0.96]];
      const list = s > 0 ? prof : prof.slice().reverse();
      list.forEach(([x, y], i) => { pts.push(new THREE.Vector2(x, y * s)); vk.push(lerp(from, to, i / (list.length - 1))); });
    };
    side(1, 0, TIRE_V.sideOut1 + 0.04);
    // épaule extérieure + bande de roulement (légèrement bombée) + épaule intérieure
    for (let i = 1; i <= 3; i++) {
      const a = (i / 3) * (Math.PI / 2);
      pts.push(new THREE.Vector2(R - sh + Math.sin(a) * sh, hw * 0.96 - sh + Math.cos(a) * sh));
      vk.push(lerp(TIRE_V.sideOut1 + 0.04, TIRE_V.tread0, i / 3));
    }
    for (let i = 1; i < 4; i++) {
      const y = lerp(hw * 0.96 - sh, -(hw * 0.96 - sh), i / 4);
      pts.push(new THREE.Vector2(R + 0.004 * (1 - Math.pow(y / hw, 2)), y));
      vk.push(lerp(TIRE_V.tread0, TIRE_V.tread1, i / 4));
    }
    for (let i = 0; i < 3; i++) {
      const a = (1 - i / 3) * (Math.PI / 2);
      pts.push(new THREE.Vector2(R - sh + Math.sin(a) * sh, -(hw * 0.96 - sh + Math.cos(a) * sh)));
      vk.push(lerp(TIRE_V.tread1, TIRE_V.sideIn0, i / 3));
    }
    side(-1, TIRE_V.sideIn0, 1);
    // ordre de l'intérieur vers l'extérieur : normales de révolution tournées vers l'extérieur
    pts.reverse();
    vk.reverse();
    const seg = 30;
    const g = new THREE.LatheGeometry(pts, seg);
    // v = position dans l'atlas (bande du pneu)
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const j = i % pts.length;
      let u = Math.floor(i / pts.length) / seg;
      if (mirrorUV) u = 1 - u;
      uv.setXY(i, u, lerp(1, WHEEL_ATLAS.tireV0, vk[j]));
    }
    g.rotateZ(-Math.PI / 2); // axe de révolution → X, flanc extérieur vers +X
    return g;
  });
}

// Disque de frein (face texturée) + bol
export function discGeometry(rOut) {
  return cachedGeo('disc' + rOut.toFixed(3), () => {
    const th = 0.026;
    const face = new THREE.CircleGeometry(rOut, 32);
    // le disque occupe un carré de 256 px de l'atlas (u 0..0.25, v 0..2/3 sur 1024 x 384)
    const uv = face.attributes.uv, fp = face.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (fp.getX(i) / rOut * 0.5 + 0.5) * WHEEL_ATLAS.discU1, (fp.getY(i) / rOut * 0.5 + 0.5) * WHEEL_ATLAS.tireV0);
    }
    face.rotateY(Math.PI / 2);
    face.translate(th / 2, 0, 0);
    const back = face.clone();
    back.rotateY(Math.PI);
    const edge = new THREE.CylinderGeometry(rOut, rOut, th, 32, 1, true);
    edge.rotateZ(Math.PI / 2);
    const bell = new THREE.CylinderGeometry(rOut * 0.46, rOut * 0.5, 0.045, 20, 1, true);
    bell.rotateZ(-Math.PI / 2);
    bell.translate(th / 2 + 0.022, 0, 0);
    const bellCap = new THREE.CircleGeometry(rOut * 0.46, 20);
    bellCap.rotateY(Math.PI / 2);
    bellCap.translate(th / 2 + 0.045, 0, 0);
    // bords et bol : zone sombre de l'atlas (centre du disque)
    for (const g of [edge, bell, bellCap]) {
      const u = g.attributes.uv;
      for (let i = 0; i < u.count; i++) u.setXY(i, 0.125, 1 / 3);
    }
    return mergeGeometries([face, back, edge, bell, bellCap].map((g) => prep(g)), false);
  });
}

// Étrier : secteur annulaire extrudé aux arêtes arrondies
export function caliperGeometry(rDisc, w) {
  return cachedGeo('cal' + rDisc.toFixed(3) + w.toFixed(3), () => {
    const r0 = rDisc - 0.05, r1 = rDisc + 0.014, a0 = -0.42, a1 = 0.42;
    const s = new THREE.Shape();
    const n = 10;
    for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r1, Math.sin(a) * r1); }
    for (let i = n; i >= 0; i--) { const a = lerp(a0, a1, i / n); s.lineTo(Math.cos(a) * r0, Math.sin(a) * r0); }
    const depth = Math.min(0.07, w * 0.28);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 4 });
    g.translate(0, 0, -depth / 2);
    // secteur centré en haut-arrière de la roue (axe d'extrusion → X)
    g.rotateZ(Math.PI / 2 - 0.65);
    g.rotateY(Math.PI / 2);
    g.translate(0.008, 0, 0);
    return g;
  });
}

// Jante : voile ajouré creusé (dish), lèvre, fût, cache-moyeu et écrous ; couleur de sommet = ombrage
const RIM_DEF = {
  five: { n: 5, hwIn: 0.024, hwOut: 0.014, dish: 0.03 },
  six: { n: 6, hwIn: 0.021, hwOut: 0.013, dish: 0.028 },
  ten: { n: 10, hwIn: 0.012, hwOut: 0.008, dish: 0.024 },
  split: { n: 10, hwIn: 0.008, hwOut: 0.008, dish: 0.03, split: true },
  mesh: { n: 10, hwIn: 0.008, hwOut: 0.006, dish: 0.034, mesh: true },
  race: { n: 6, hwIn: 0.026, hwOut: 0.019, dish: 0.045, centerlock: true },
  turbine: { n: 14, dish: 0.014, turbine: true },
  classic: { n: 8, hwIn: 0.018, hwOut: 0.018, dish: 0.012, classic: true },
  multi: { n: 15, hwIn: 0.0065, hwOut: 0.005, dish: 0.03 },
};

export function rimGeometry(R, w, style, rr = R * 0.69) {
  if (!RIM_DEF[style]) style = 'five';
  return cachedGeo(`rim${R.toFixed(3)}|${w.toFixed(3)}|${rr.toFixed(3)}|${style}`, () => {
    const d = RIM_DEF[style];
    const rFace = rr * 0.965;
    const hub = rr * 0.24;
    const rin = d.classic ? rr * 0.4 : hub + 0.018, rout = rr * (d.classic ? 0.8 : 0.86);
    const shape = new THREE.Shape();
    const nO = 40;
    for (let i = 0; i <= nO; i++) { const a = (i / nO) * Math.PI * 2; shape[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rFace, Math.sin(a) * rFace); }
    const holes = [];
    const hw = (r) => lerp(d.hwIn ?? 0.01, d.hwOut ?? 0.01, clamp((r - rin) / (rout - rin), 0, 1));
    // fenêtre entre deux rayons (côtés parallèles aux rayons, coins adoucis)
    const windowPath = (aL, aR, r0, r1) => {
      const pts = [];
      // finesse des contours selon le nombre de fenêtres (budget de triangles)
      const nArc = d.mesh ? 2 : d.n >= 10 ? 3 : 4, nSide = d.mesh || d.n >= 14 ? 1 : 2;
      const angAt = (a, r, s) => a + s * Math.asin(clamp(hw(r) / r, 0, 0.9));
      for (let i = 0; i <= nArc; i++) {
        const u = i / nArc;
        const a = lerp(angAt(aL, r1, 1), angAt(aR, r1, -1), u);
        const rr1 = r1 - 0.006 * Math.pow(Math.abs(2 * u - 1), 6);
        pts.push([Math.cos(a) * rr1, Math.sin(a) * rr1]);
      }
      for (let i = 1; i < nSide; i++) { const r = lerp(r1, r0, i / nSide); const a = angAt(aR, r, -1); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      for (let i = 0; i <= 3; i++) {
        const u = i / 3;
        const a = lerp(angAt(aR, r0, -1), angAt(aL, r0, 1), u);
        pts.push([Math.cos(a) * r0, Math.sin(a) * r0]);
      }
      for (let i = 1; i < nSide; i++) { const r = lerp(r0, r1, i / nSide); const a = angAt(aL, r, 1); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      const p = new THREE.Path();
      pts.forEach(([x, y], i) => p[i ? 'lineTo' : 'moveTo'](x, y));
      p.closePath();
      holes.push(p);
    };
    const sector = (Math.PI * 2) / d.n;
    if (d.turbine) {
      // fentes courbes en hélice
      for (let i = 0; i < d.n; i++) {
        const a0 = i * sector;
        const pts = [];
        const nn = 4, twist = 0.55, wA = sector * 0.42;
        for (let k = 0; k <= nn; k++) { const u = k / nn, r = lerp(rin + 0.01, rout, u); pts.push([r, a0 + twist * u]); }
        for (let k = nn; k >= 0; k--) { const u = k / nn, r = lerp(rin + 0.01, rout, u); pts.push([r, a0 + twist * u + wA * (0.35 + 0.65 * u)]); }
        const p = new THREE.Path();
        pts.forEach(([r, a], k) => p[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r));
        p.closePath();
        holes.push(p);
      }
    } else {
      for (let i = 0; i < d.n; i++) {
        const aL = i * sector, aR = (i + 1) * sector;
        if (d.split) {
          // rayons doubles en V : petite fenêtre entre les branches, grande entre les paires
          const r0 = i % 2 === 0 ? rr * 0.5 : rin;
          windowPath(aL, aR, r0, rout);
        } else if (d.mesh) {
          const rm = lerp(rin, rout, 0.48);
          windowPath(aL, aR, rin, rm - 0.006);
          const am = (aL + aR) / 2;
          windowPath(aL, am, rm + 0.006, rout);
          windowPath(am, aR, rm + 0.006, rout);
        } else {
          windowPath(aL, aR, rin, rout);
        }
      }
    }
    shape.holes = holes;
    const depth = 0.016;
    // voiles très ajourés (nid d'abeille, multibranches, turbine) : sans chanfrein (budget de triangles)
    const dense = d.mesh || d.turbine || d.n >= 14;
    const face = new THREE.ExtrudeGeometry(shape, { depth: dense ? depth + 0.005 : depth, bevelEnabled: !dense, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 1, curveSegments: 4 });
    face.rotateY(Math.PI / 2); // face orientée vers +X
    dropFaces(face, (nx) => nx < -0.9); // face arrière invisible (côté moyeu)
    const xFace = w * 0.36 - depth - 0.006;
    face.translate(xFace, 0, 0);
    // creusement : le centre recule vers l'intérieur, normales inclinées en conséquence
    const p = face.attributes.position, nrm = face.attributes.normal;
    const dish = d.dish;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), z = p.getZ(i);
      const r = Math.hypot(y, z), u = clamp(1 - r / rFace, 0, 1);
      p.setX(i, p.getX(i) - dish * Math.pow(u, 1.25));
      const nx = nrm.getX(i);
      if (nx > 0.7 && r > 1e-4) {
        const slope = dish * 1.25 * Math.pow(Math.max(u, 1e-3), 0.25) / rFace;
        const v = new THREE.Vector3(1, -slope * y / r, -slope * z / r).normalize();
        nrm.setXYZ(i, v.x, v.y, v.z);
      }
    }
    const parts = [prep(face, [1, 1, 1])];
    // lèvre (bord poli) + fût intérieur sombre
    const xl = w * 0.36;
    const lip = new THREE.LatheGeometry([
      new THREE.Vector2(rFace - 0.004, xl - 0.024), new THREE.Vector2(rFace - 0.002, xl - 0.004), new THREE.Vector2(rr + 0.002, xl + 0.003),
      new THREE.Vector2(rr + 0.011, xl - 0.002), new THREE.Vector2(rr + 0.012, xl - 0.014),
    ].reverse(), 36);
    lip.rotateZ(-Math.PI / 2);
    parts.push(prep(lip, [1.05, 1.05, 1.05]));
    const barrel = new THREE.CylinderGeometry(rr * 0.985, rr * 0.985, w * 0.78, 24, 1, true);
    barrel.rotateZ(Math.PI / 2);
    barrel.translate(-w * 0.03, 0, 0);
    parts.push(prep(flipGeometry(barrel), [0.22, 0.22, 0.23]));
    // moyeu : cache central + écrous (ou écrou central de course)
    const xHub = xFace + depth + 0.006 - dish;
    if (d.centerlock) {
      const nut = new THREE.CylinderGeometry(0.034, 0.038, 0.04, 6);
      nut.rotateZ(-Math.PI / 2);
      nut.translate(xHub + 0.012, 0, 0);
      parts.push(prep(nut, [0.75, 0.75, 0.78]));
      const pin = new THREE.CylinderGeometry(0.012, 0.012, 0.05, 10);
      pin.rotateZ(-Math.PI / 2);
      pin.translate(xHub + 0.02, 0, 0);
      parts.push(prep(pin, [0.9, 0.2, 0.15]));
    } else {
      const capR = d.classic ? hub * 0.95 : hub * 0.55;
      const cap = d.classic
        ? new THREE.SphereGeometry(capR, 16, 6, 0, Math.PI * 2, 0, Math.PI * 0.32)
        : new THREE.CylinderGeometry(capR, capR * 1.08, 0.012, 20);
      cap.rotateZ(-Math.PI / 2);
      cap.translate(xHub + (d.classic ? -capR * 0.86 : 0.004), 0, 0);
      parts.push(prep(cap, d.classic ? [1.1, 1.1, 1.1] : [0.55, 0.56, 0.6]));
      const nN = 5, rN = hub * 0.72;
      if (!d.classic) {
        for (let i = 0; i < nN; i++) {
          const a = (i / nN) * Math.PI * 2 + 0.3;
          const nut = new THREE.CylinderGeometry(0.0095, 0.0095, 0.018, 6);
          nut.rotateZ(-Math.PI / 2);
          nut.translate(xHub + 0.004, Math.cos(a) * rN, Math.sin(a) * rN);
          parts.push(prep(nut, [0.85, 0.86, 0.9]));
        }
      }
    }
    return mergeGeometries(parts, false);
  });
}

// Assemblage d'une roue : groupe de braquage (étrier fixe) > groupe de rotation (pneu + disque, jante)
export function buildWheel(spec, isLeft, mats) {
  const R = spec.wheel.radius, w = spec.wheel.width;
  const steer = new THREE.Group();
  const spin = new THREE.Group();
  steer.add(spin);
  const rr = rimRadius(spec.wheel);
  const tire = new THREE.Mesh(tireDiscGeometry(R, w, isLeft, rr), mats.wheel);
  tire.castShadow = true;
  spin.add(tire);
  const rim = new THREE.Mesh(rimGeometry(R, w, mats.rimStyle, rr), mats.rim);
  spin.add(rim);
  const discR = rr * 0.84;
  const cal = new THREE.Mesh(caliperGeometry(discR, w), mats.caliper);
  steer.add(cal);
  if (isLeft) {
    steer.rotation.order = 'YXZ';
    spin.scale.x = -1;
    cal.scale.x = -1;
  }
  return { steer, spin, isLeft, tire, rim, cal, details: [cal] };
}

// Pneu + disque fusionnés (un seul matériau : atlas de roue)
export function tireDiscGeometry(R, w, mirrorUV, rr = R * 0.69) {
  return cachedGeo(`td${R.toFixed(3)}|${w.toFixed(3)}|${rr.toFixed(3)}|${mirrorUV}`, () => {
    const discR = rr * 0.84;
    const disc = discGeometry(discR).clone();
    disc.translate(-w * 0.06, 0, 0);
    return mergeGeometries([prep(tireGeometry(R, w, mirrorUV, rr).clone()), disc], false);
  });
}

// Roues simplifiées (lointain) : pneu + voile plein, fusion des quatre roues
export function lowWheelsGeometry(spec, shape) {
  const R = spec.wheel.radius, w = spec.wheel.width;
  const list = [];
  for (let i = 0; i < 4; i++) {
    const front = i < 2, left = i % 2 === 0;
    const x = (left ? -1 : 1) * spec.dims.track * 0.5;
    const z = front ? shape.zAxleF : shape.zAxleR;
    const t = new THREE.CylinderGeometry(R, R, w, 14, 1, false);
    t.rotateZ(Math.PI / 2);
    t.translate(x, R, z);
    list.push(setColor(prep(t), [0.06, 0.06, 0.065]));
    const f = new THREE.CircleGeometry(rimRadius(spec.wheel) * 0.97, 12);
    f.rotateY(left ? -Math.PI / 2 : Math.PI / 2);
    f.translate(x + (left ? -1 : 1) * (w / 2 + 0.002), R, z);
    list.push(setColor(prep(f), [0.55, 0.56, 0.58]));
  }
  return mergeGeometries(list, false);
}

// ---------------------------------------------------------------------------
// Ailerons
// ---------------------------------------------------------------------------
function airfoil(chord, thick, span) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(chord * 0.15, thick * 1.1, chord * 0.55, thick * 0.9, chord, thick * 0.15);
  s.lineTo(chord, -thick * 0.05);
  s.bezierCurveTo(chord * 0.6, thick * 0.05, chord * 0.2, -thick * 0.35, 0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: span, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -span / 2);
  g.rotateY(Math.PI / 2); // corde le long de -Z… → voir rotations d'appel
  return g;
}

// Plaque profilée (dérive, flasque, col de cygne) extrudée en épaisseur selon X
function plate(pts, thick) {
  const s = new THREE.Shape();
  pts.forEach(([z, y], i) => s[i ? 'lineTo' : 'moveTo'](z, y));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -thick / 2);
  g.rotateY(-Math.PI / 2); // forme dans le plan (z, y)
  return g;
}

// Renvoie un collecteur { paint, carbon, blk } d'un aileron donné ; kind : style d'aileron effectif
export function buildWing(kind, shape, spec) {
  const st = shape.st;
  const out = new Buckets();
  const deckT = (st.rearB + 1) / 2;
  const zDeck = shape.zOf(deckT);
  const yDeck = shape.top(deckT);
  const W = shape.Wmax;
  const place = (g, x, y, z, rx = 0) => { g.rotateX(rx); g.translate(x, y, z); return g; };
  if (kind === 'none') return out;
  if (kind === 'lip' || kind === 'duck') {
    const duck = kind === 'duck';
    const tEdge = st.rearB > 0.95 ? 0.985 : 0.988;
    const y = shape.top(tEdge);
    const g = airfoil(duck ? 0.2 : 0.12, duck ? 0.05 : 0.035, shape.halfWidth(tEdge) * 1.75);
    out.add('paint', place(g, 0, y - 0.004, shape.zOf(tEdge) - (duck ? 0.13 : 0.08), duck ? -0.32 : -0.22));
  } else if (kind === 'roof') {
    const t = st.rearB - 0.035;
    const y = shape.roof(st.roofB) - 0.01;
    const span = shape.cabSection(st.roofB).wr * 2.05;
    out.add('paint', place(airfoil(0.24, 0.035, span), 0, y, shape.zOf(t) - 0.02 - (st.rearB - st.roofB) * shape.L * 0.6, 0.12));
  } else if (kind === 'wing' || kind === 'lipwing' || kind === 'tailwing') {
    const span = W * (kind === 'tailwing' ? 1.86 : 1.7);
    const hgt = kind === 'lipwing' ? 0.08 : kind === 'tailwing' ? 0.13 : 0.2;
    const key = kind === 'lipwing' ? 'carbon' : 'paint';
    out.add(key, place(airfoil(0.26, 0.05, span), 0, yDeck + hgt, zDeck + 0.0, -0.12));
    for (const side of [-1, 1]) {
      if (kind === 'tailwing') {
        // supports pleins dans le prolongement des ailes
        const g = plate([[-0.12, -hgt], [0.2, -hgt], [0.24, 0.02], [-0.02, 0.03]], 0.05);
        out.add('paint', place(g, side * span / 2 * 0.97, yDeck + hgt, zDeck + 0.05));
      } else {
        const g = plate([[-0.06, -hgt], [0.09, -hgt], [0.06, 0.02], [-0.04, 0.02]], 0.022);
        out.add('blk', place(g, side * span * 0.32, yDeck + hgt, zDeck + 0.08));
      }
    }
  } else if (kind === 'gtwing' || kind === 'protowing') {
    const proto = kind === 'protowing';
    const span = W * (proto ? 1.95 : 1.86);
    const hgt = proto ? 0.3 : 0.33;
    const zW = shape.zOf(0.935);
    const yW = yDeck + hgt;
    const main = airfoil(0.34, 0.055, span);
    out.add('carbon', place(main, 0, yW, zW, -0.2));
    const flap = airfoil(0.15, 0.03, span);
    out.add('carbon', place(flap, 0, yW + 0.07, zW + 0.27, -0.6));
    // flasques
    for (const side of [-1, 1]) {
      const ep = plate([[-0.12, -0.16], [0.46, -0.08], [0.5, 0.2], [-0.06, 0.13]], 0.012);
      out.add('carbon', place(ep, side * (span / 2 + 0.007), yW, zW - 0.02));
      if (proto) {
        const stand = plate([[-0.1, -hgt - 0.05], [0.12, -hgt - 0.05], [0.08, 0.0], [-0.06, 0.0]], 0.016);
        out.add('carbon', place(stand, side * span * 0.26, yW - 0.01, zW + 0.15));
      } else {
        // col de cygne : fixation par-dessus le profil
        const sn = plate([[-0.04, -hgt - 0.04], [0.08, -hgt - 0.04], [0.16, 0.06], [0.1, 0.11], [0.02, 0.1], [0.06, 0.05], [0.0, -hgt + 0.05]], 0.014);
        out.add('blk', place(sn, side * span * 0.24, yW, zW + 0.05));
      }
    }
  }
  return out;
}

// Style d'aileron effectif selon la personnalisation
export function wingKind(st, spec, wing) {
  if (wing === 'none') return 'none';
  if (wing === 'lip') return 'lip';
  if (wing === 'duck') return 'duck';
  if (wing === 'gt') return st.doors === 0 ? 'protowing' : 'gtwing';
  if (spec.aeroKit && ['none', 'lip', 'duck', 'roof'].includes(st.spoiler)) return st.race ? 'gtwing' : 'wing';
  return st.spoiler || 'none';
}

// ---------------------------------------------------------------------------
// Pièces fixes de carrosserie (rétroviseurs, essuie-glaces, échappements, lèvres, bas de caisse…)
// ---------------------------------------------------------------------------
// Point extérieur bas de la section (bord de caisse) en t, juste au-dessus de la hauteur y0
function lowerEdge(shape, t, dy = 0.01) {
  const p = {};
  const P = shape.profile(t, {});
  for (let k = 0; k <= 40; k++) {
    const th = -Math.PI / 2 + (k / 40) * (Math.PI / 2);
    shape.sectionPoint(t, th, p);
    if (p.y >= P.bot + dy) return { x: p.x, y: p.y, z: p.z };
  }
  return { x: P.W, y: P.bot + dy, z: P.z };
}

// Largeur de caisse à la hauteur y (balayage de la section)
function widthAtHeight(shape, t, y) {
  const p = {};
  let best = 0;
  for (let k = 0; k <= 48; k++) {
    const th = -Math.PI / 2 + (k / 48) * Math.PI;
    shape.sectionPoint(t, th, p);
    if (Math.abs(p.y - y) < 0.03) best = Math.max(best, p.x);
  }
  return best;
}

export function buildBodyParts(shape, spec, exhaust) {
  const st = shape.st;
  const B = new Buckets();
  const W = shape.Wmax, H = shape.H, L = shape.L;
  const belt = shape.belt;
  const roundRect = (w, h, r, n = 3) => {
    const pts = [];
    const cs = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2], [-w / 2 + r, -h / 2 + r, Math.PI], [w / 2 - r, -h / 2 + r, 1.5 * Math.PI]];
    for (const [cx, cy, a0] of cs) for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (Math.PI / 2); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return pts;
  };
  // --- Rétroviseurs ---
  if (st.mirrors !== 'none') {
    const fender = st.mirrors === 'fender';
    const race = st.mirrors === 'race' || st.race;
    for (const side of [-1, 1]) {
      const s = race ? 0.82 : fender ? 0.62 : 1;
      const hw = 0.088 * s, hh = 0.05 * s, df = 0.085 * s, db = 0.02 * s;
      let x, y, z, xa = 0;
      if (fender) {
        const t = st.doors === 0 ? st.ws - 0.03 : st.ws * 0.72;
        const P = shape.profile(t, {});
        x = side * P.W * 0.86; y = P.topF + 0.06; z = P.z;
      } else {
        // sur la porte, au pied du montant A
        const t = st.ws + 0.04;
        const sec = shape.cabSection(t);
        xa = sec.wc;
        x = side * (xa + 0.035 + hw); y = shape.belt + 0.07; z = sec.z + 0.03;
      }
      // coque : superellipsoïde, nez arrondi vers l'avant, dos plat portant le miroir
      const housing = new THREE.SphereGeometry(1, 18, 12);
      const hp = housing.attributes.position;
      const se = (v) => Math.sign(v) * Math.pow(Math.abs(v), 0.5);
      for (let i = 0; i < hp.count; i++) {
        const hx = se(hp.getX(i)), hy = se(hp.getY(i)), hz = hp.getZ(i);
        const zz = hz > 0 ? se(hz) * db : hz * df;
        hp.setXYZ(i, hx * hw * (1 - 0.12 * Math.max(0, -hz)), hy * hh * (1 - 0.1 * Math.max(0, -hz)), zz);
      }
      housing.computeVertexNormals();
      housing.translate(x, y, z);
      B.add(race ? 'carbon' : fender ? 'chrome' : 'paint', housing);
      const glass = new THREE.CircleGeometry(1, 24);
      const gp = glass.attributes.position;
      for (let i = 0; i < gp.count; i++) gp.setXY(i, se(gp.getX(i)) * hw * 0.86, se(gp.getY(i)) * hh * 0.78);
      glass.translate(x, y, z + db + 0.0015);
      B.add('mirror', glass);
      // pied
      if (fender) {
        const foot = new THREE.CylinderGeometry(0.006, 0.009, 0.06, 6);
        foot.translate(x, y - 0.045, z + 0.005);
        B.add('chrome', foot);
      } else {
        const x0 = side * (xa - 0.01), x1 = x - side * hw * 0.6;
        const foot = new THREE.BoxGeometry(Math.abs(x1 - x0), 0.022 * s, 0.05 * s);
        foot.translate((x0 + x1) / 2, y - hh * 0.55, z + 0.01);
        B.add('blk', foot);
      }
    }
  }
  // --- Essuie-glaces (posés sur le pare-brise) ---
  if (st.doors !== 0 || st.wipers) {
    const nW = st.wipers || 2;
    const t0 = st.ws + 0.012 / L * 4;
    const q = {};
    const pt = (t, sig) => {
      const sec = shape.cabSection(t);
      shape.cabPoint(sec, sec.S - Math.abs(sig), q);
      return new THREE.Vector3(sig >= 0 ? q.x : -q.x, q.y + 0.012, q.z);
    };
    const S0 = shape.cabSection(t0).S;
    const wipers = nW === 1 ? [[0, -0.9]] : [[-0.62, 0.2], [0.18, 0.95]];
    for (const [a, b] of wipers) {
      const path = [];
      for (let i = 0; i <= 6; i++) {
        const u = i / 6;
        const sig = lerp(a, b, u) * S0 * 0.9;
        const t = t0 + (0.012 + 0.02 * u * u) * (st.roofF - st.ws);
        path.push(pt(t, sig));
      }
      B.add('blk', sweep(path, roundRect(0.014, 0.01, 0.003, 1)));
    }
  }
  // --- Échappements ---
  for (const e of exhaust) {
    const rx = e.rx, ry = e.ry;
    const prof = [
      new THREE.Vector2(rx * 0.86, -0.14), new THREE.Vector2(rx * 0.86, -0.002), new THREE.Vector2(rx * 0.95, 0.004),
      new THREE.Vector2(rx + 0.003, 0.002), new THREE.Vector2(rx + 0.005, -0.012), new THREE.Vector2(rx + 0.003, -0.14),
    ].reverse(); // de l'extérieur vers l'intérieur : normales correctes
    const g = new THREE.LatheGeometry(prof, 20);
    // intérieur sombre (suie)
    const c = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < g.attributes.position.count; i++) {
      const j = i % prof.length;
      const v = j >= prof.length - 2 ? 0.08 : 1;
      c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g.scale(1, 1, ry / rx);
    g.rotateX(Math.PI / 2); // axe → +Z (sortie vers l'arrière)
    if (e.side) {
      g.rotateY(e.x > 0 ? Math.PI / 2 : -Math.PI / 2);
      g.translate(e.x + (e.x > 0 ? 0.012 : -0.012), e.y, e.z);
    } else {
      g.translate(e.x, e.y, e.z + 0.018);
    }
    B.add('chrome', g, null); // couleurs de sommet conservées
  }
  // --- Lèvres d'ailes (bord roulé des passages de roues) ---
  for (const za of [shape.zAxleF, shape.zAxleR]) {
    const path = [];
    const R = shape.archR;
    const yMin = shape.clear + 0.03;
    for (let i = 0; i <= 28; i++) {
      const a = lerp(-1.75, 1.75, i / 28);
      const z = za + Math.sin(a) * R * 1.004, y = shape.r + Math.cos(a) * R * 1.004;
      if (y < yMin) continue;
      const x = shape.xAt(shape.tOf(z), y);
      if (x > 0.1) path.push(new THREE.Vector3(x - 0.006, y, z));
    }
    const rad = st.flare >= 0.06 ? 0.012 : 0.009;
    const prof = [];
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; prof.push([Math.cos(a) * rad, Math.sin(a) * rad * 0.8]); }
    const g = sweep(path, prof);
    B.add('paint', g);
    B.add('paint', mirrorX(g.clone()));
  }
  // --- Bas de caisse ---
  if (st.skirt) {
    const z0 = shape.zAxleF + shape.archR + 0.04, z1 = shape.zAxleR - shape.archR - 0.04;
    const path = [];
    for (let i = 0; i <= 10; i++) {
      const z = lerp(z0, z1, i / 10);
      const e = lowerEdge(shape, shape.tOf(z), 0.02);
      path.push(new THREE.Vector3(e.x + 0.004, shape.clear + 0.035, z));
    }
    const g = sweep(path, roundRect(0.04, 0.055, 0.012, 2).map(([x, y]) => [x - 0.008, y]));
    const key = st.skirt === 'body' ? 'paint' : st.skirt === 'carbon' ? 'carbon' : 'plastic';
    B.add(key, g);
    B.add(key, mirrorX(g.clone()));
  }
  // --- Lame avant / répartiteur : suit le contour du bouclier à faible hauteur ---
  if (st.lip || st.splitter) {
    const big = st.splitter;
    const yLip = shape.clear + (big ? 0.03 : 0.045);
    const tEnd = shape.tOf(shape.zAxleF - shape.archR - 0.03);
    const line = [];
    const n = 22;
    for (let i = 0; i <= n; i++) {
      const t = lerp(tEnd, 0.002, Math.pow(i / n, 0.8));
      const x = widthAtHeight(shape, t, yLip);
      if (x > 0.08) line.push([x, shape.zOf(t)]);
    }
    if (line.length > 3) {
      // fermeture par l'avant (miroir) puis décalage vers l'extérieur / l'intérieur
      const full = [...line, ...line.slice().reverse().map(([x, z]) => [-x, z])];
      const ext = big ? 0.07 : 0.022, inn = big ? 0.09 : 0.045;
      const outer = [], inner = [];
      for (let i = 0; i < full.length; i++) {
        const a = full[Math.max(0, i - 1)], b = full[Math.min(full.length - 1, i + 1)];
        let nx = b[1] - a[1], nz = -(b[0] - a[0]);
        const l = Math.hypot(nx, nz) || 1;
        nx /= l; nz /= l;
        if (nx * full[i][0] < 0 || (Math.abs(full[i][0]) < 0.3 && nz > 0)) { nx = -nx; nz = -nz; }
        const k = Math.min(1, (full[i][1] - shape.zFront) / 0.25 + 0.15);
        outer.push([full[i][0] + nx * ext * (big ? 1 : k), full[i][1] + nz * ext]);
        inner.push([full[i][0] - nx * inn, full[i][1] - nz * inn]);
      }
      const s = new THREE.Shape();
      [...outer, ...inner.reverse()].forEach(([x, z], i) => s[i ? 'lineTo' : 'moveTo'](x, z));
      const th = big ? 0.016 : 0.01;
      const g = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 });
      g.rotateX(Math.PI / 2);
      g.translate(0, yLip - (big ? 0.02 : 0.012), 0);
      const key = big || st.lip === 'carbon' ? 'carbon' : st.lip === 'body' ? 'paint' : 'plastic';
      B.add(key, key === 'carbon' ? metricUV(g, 1) : g);
    }
  }
  // --- Diffuseur ---
  if (st.diffuser) {
    const big = st.diffuser !== 'small';
    const nF = st.diffuser === 'race' ? 7 : st.diffuser === 'big' ? 6 : 4;
    const span = W * (big ? 1.25 : 0.95);
    for (let i = 0; i < nF; i++) {
      const x = lerp(-span / 2, span / 2, nF === 1 ? 0.5 : i / (nF - 1));
      const h0 = big ? 0.16 : 0.09;
      const g = plate([[-0.42, 0], [0.0, 0], [0.0, h0], [-0.1, h0 * 0.8]], 0.008);
      g.translate(x, shape.clear - 0.01, shape.zRear - 0.03);
      B.add(big ? 'carbon' : 'plastic', metricUV(g, 1));
    }
  }
  // --- Barres de toit ---
  if (st.roofRails) {
    const q = {};
    for (const side of [-1, 1]) {
      const path = [];
      for (let i = 0; i <= 12; i++) {
        const t = lerp(st.roofF + 0.02, st.roofB - 0.005, i / 12);
        const sec = shape.cabSection(t);
        shape.cabPoint(sec, sec.sR + (sec.S - sec.sR) * 0.12, q);
        path.push(new THREE.Vector3(side * q.x * 0.97, q.y + 0.035, q.z));
      }
      B.add('blk', sweep(path, roundRect(0.026, 0.02, 0.008, 2)));
    }
  }
  // --- Écope de capot ---
  if (st.hoodScoop) {
    const t0 = st.ws * 0.42, t1 = st.ws * 0.82;
    const z0 = shape.zOf(t0), z1 = shape.zOf(t1);
    const y0 = shape.top(t0), y1 = shape.top(t1);
    const len = z1 - z0, hgt = 0.065;
    const g = plate([[0, 0], [len, y1 - y0 - 0.005], [len, y1 - y0 + 0.01], [len * 0.2, hgt], [0, hgt * 0.95]], W * 0.5);
    g.translate(0, y0 - 0.015, z0);
    B.add('paint', g);
    const mouth = new THREE.BoxGeometry(W * 0.44, hgt * 0.62, 0.012);
    mouth.translate(0, y0 + hgt * 0.45 - 0.012, z0 - 0.003);
    B.add('blk', mouth, [0.02, 0.02, 0.022]);
  }
  // --- Antenne ---
  if (st.antenna === 'fin') {
    const t = st.roofB - 0.03;
    const y = shape.roof(t), z = shape.zOf(t);
    B.add('paint', plate([[0, 0], [0.16, 0], [0.13, 0.05], [0.09, 0.062]], 0.04).translate(0, y - 0.004, z - 0.06));
  } else if (st.antenna === 'whip') {
    if (st.bumpers === 'chrome') {
      // antenne fouet chromée sur l'aile arrière (voitures anciennes)
      const t = Math.min(0.95, st.rearB + 0.04);
      const P = shape.profile(t, {});
      const g = new THREE.CylinderGeometry(0.0018, 0.003, 0.42, 5);
      g.rotateX(0.12);
      g.translate(-P.W * 0.74, P.topF + 0.21, P.z);
      B.add('chrome', g);
    } else {
      // courte antenne de toit inclinée vers l'arrière
      const t = st.roofB - 0.02;
      const g = new THREE.CylinderGeometry(0.0022, 0.0035, 0.3, 5);
      g.translate(0, 0.15, 0);
      g.rotateX(0.95);
      g.translate(0, shape.roof(t) - 0.005, shape.zOf(t));
      B.add('blk', g);
      B.add('blk', new THREE.CylinderGeometry(0.012, 0.016, 0.02, 8).translate(0, shape.roof(t), shape.zOf(t)));
    }
  }
  // --- Ailettes (canards) sur le bouclier avant ---
  if (st.canards) {
    for (const side of [-1, 1]) {
      for (const [k, y] of [[0, 0.28], [1, 0.42]]) {
        const t = 0.03 + k * 0.012;
        const P = shape.profile(t, {});
        const yy = lerp(shape.clear, st.nose * H, y);
        const x = widthAtHeight(shape, t, yy) || P.W * 0.9;
        const g = plate([[-0.02, 0], [0.16, 0.0], [0.16, 0.012], [0.02, 0.05]], 0.005);
        g.rotateZ(side * 0.08);
        g.rotateY(Math.PI / 2 * side);
        g.translate(side * (x - 0.02), yy, P.z + 0.1);
        B.add('carbon', metricUV(g, 1));
      }
    }
  }
  // --- Pare-chocs chromés ---
  if (st.bumpers === 'chrome') {
    for (const front of [true, false]) {
      const yB = front ? lerp(shape.clear, st.nose * H, 0.32) : lerp(shape.clear, st.tail * H, 0.34);
      const tEnd = front ? shape.tOf(shape.zAxleF - shape.archR - 0.03) : shape.tOf(shape.zAxleR + shape.archR + 0.03);
      const half = [];
      const n = 14;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const t = front ? tEnd * (1 - u) + 0.004 * u : tEnd + (1 - 0.004 - tEnd) * u;
        const x = widthAtHeight(shape, t, yB);
        half.push(new THREE.Vector3(x + 0.018, yB, shape.zOf(t) + (front ? -0.018 : 0.018) * u));
      }
      const path = [...half, ...half.slice(0, -1).reverse().map((v) => new THREE.Vector3(-v.x, v.y, v.z))];
      const g = sweep(path, roundRect(0.03, 0.055, 0.012, 2), true);
      B.add('chrome', g);
    }
  }
  return B;
}

export function mirrorX(g) {
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) { p.setX(i, -p.getX(i)); if (n) n.setX(i, -n.getX(i)); }
  if (g.index) {
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  }
  return g;
}

// Fonds de passages de roues (les quatre fusionnés)
export function wellsGeometry(shape, spec) {
  const list = [];
  for (const za of [shape.zAxleF, shape.zAxleR]) {
    for (const side of [-1, 1]) {
      const wBody = shape.halfWidth(shape.tOf(za), za) - 0.03;
      const inner = shape.track / 2 - spec.wheel.width / 2 - 0.08;
      const len = Math.max(0.1, wBody - inner);
      const g = new THREE.CylinderGeometry(shape.archR, shape.archR, len, 20, 1, true, -0.12, Math.PI + 0.24);
      g.rotateZ(Math.PI / 2);
      g.translate(side * (inner + len / 2), spec.wheel.radius, za);
      list.push(prep(g));
    }
  }
  return mergeGeometries(list, false);
}
