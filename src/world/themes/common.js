// Outils partagés par les décors de thème : fusion des géométries statiques, matrices de
// placement, repère local du circuit, textures procédurales propres aux nouveaux thèmes
// (sable, neige, grillage, néons, béton, vitrages…).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Noise2D } from '../../core/noise.js';
import { rng, clamp } from '../../core/utils.js';
import { radialSprite, asphalt } from '../textures.js';
import { surfaceY } from '../trackMesh.js';

// ------------------------------------------------------------------ Éclairage
// Flaques de lumière au sol (décalcomanies additives) : un seul appel de rendu.
// points : [[x, y, z, rayon], ...]
export function lightPools(group, points, color = 'rgba(255,200,130,0.55)', key = 'pool') {
  if (!points.length) return null;
  const pos = new Float32Array(points.length * 12), uv = new Float32Array(points.length * 8), idx = [];
  points.forEach(([x, y, z, R], k) => {
    pos.set([x - R, y, z - R, x + R, y, z - R, x + R, y, z + R, x - R, y, z + R], k * 12);
    uv.set([0, 0, 1, 0, 1, 1, 0, 1], k * 8);
    const n = k * 4;
    idx.push(n, n + 2, n + 1, n, n + 3, n + 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    map: radialSprite(key, color, color.replace(/[\d.]+\)$/, '0)'), 128),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  }));
  m.renderOrder = 2;
  group.add(m);
  return m;
}

// Lumière diffuse sur la chaussée (éclairage nocturne, lueur de la ville) : ruban additif
// le long du tracé, d'un mur à l'autre, modulé par le grain de l'enrobé pour ne pas
// l'aplatir. color(side, s) → [r, g, b] ajouté (≈ teinte moyenne). Un seul appel.
export function roadWash(sc, color) {
  const t = sc.track;
  const step = Math.max(1, Math.round(4 / t.spacing));
  const pos = [], col = [], uv = [], idx = [];
  const f = {};
  let n = 0;
  const last = t.closed ? t.count : t.count - 1;
  for (let i = 0; i <= last; i += step) {
    const ii = t.idx(Math.min(i, last));
    for (const side of [-1, 1]) {
      const lat = side * (side > 0 ? t.wallR[ii] : t.wallL[ii]);
      frameAt(t, ii, lat, f);
      pos.push(f.x, surfaceY(t, ii, lat) + 0.03, f.z);
      col.push(...color(side, t.sArr[ii]).map((c) => c * 2.4));
      uv.push(lat / 6, (i * t.spacing) / 6);
    }
    if (n > 0) idx.push(n - 2, n - 1, n, n - 1, n + 1, n); // face visible du dessus
    n += 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    map: asphalt().map,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  }));
  m.renderOrder = 1;
  m.frustumCulled = false;
  sc.group.add(m);
  return m;
}

// Mâts d'éclairage le long du circuit (alternés gauche / droite), tête lumineuse tournée
// vers la piste. Renvoie les points des flaques de lumière (pour la nuit).
export function floodlightPoles(sc, { step = 70, height = 16, offset = 2.5, lit = 1, color = 0xfff1d6, skip = null, poolR = 13 } = {}) {
  const t = sc.track;
  const poleMat = sc.cachedMat('flPole', () => new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.7, roughness: 0.4 }));
  const headMat = sc.cachedMat('flHead' + color + lit, () => new THREE.MeshStandardMaterial({ color: 0xdedede, emissive: color, emissiveIntensity: lit * 5, roughness: 0.4 }));
  const pole = new THREE.CylinderGeometry(0.14, 0.24, height, 6);
  const arm = new THREE.BoxGeometry(0.16, 0.16, 3.2);
  const head = new THREE.BoxGeometry(1.6, 0.35, 0.9);
  const pools = [];
  const n = Math.max(1, Math.round(step / t.spacing));
  const f = {};
  let k = 0;
  for (let i = 0; i < t.count; i += n, k++) {
    const side = k % 2 ? 1 : -1;
    const wall = side > 0 ? t.wallR[i] : t.wallL[i];
    frameAt(t, i, side * (wall + offset), f);
    if (sc.clearance(f.x, f.z) < offset - 0.5) continue;
    if (skip && skip(i, side)) continue;
    const y = surfaceY(t, i, side * wall);
    sc.bin.add('flPole', poleMat, pole, mat(f.x, y + height / 2, f.z));
    const ax = f.x - f.rx * side * 1.4, az = f.z - f.rz * side * 1.4;
    sc.bin.add('flPole', poleMat, arm, mat(ax, y + height, az, f.rot + Math.PI / 2));
    const hx = f.x - f.rx * side * 2.8, hz = f.z - f.rz * side * 2.8;
    sc.bin.add('flHead' + color + lit, headMat, head, matR(hx, y + height - 0.2, hz, f.rot + Math.PI / 2, 0, side * 0.35));
    const cl = Math.max(0, wall - 6);
    const pf = frameAt(t, i, side * cl, {});
    pools.push([pf.x, surfaceY(t, i, side * cl) + 0.05, pf.z, poolR]);
  }
  sc.bin.noShadow('flHead' + color + lit);
  return pools;
}

// Grillage de protection posé sur le mur (ou au bord du dégagement) d'un côté du circuit,
// avec poteaux. sides : [-1, 1] ; fromH / toH : hauteurs relatives au pied du mur.
export function catchFence(sc, { sides = [-1, 1], fromH = 1.05, toH = 4.2, inset = 0.05, filter = null, postStep = 4 } = {}) {
  const t = sc.track;
  const tex = chainLink();
  const fenceMat = sc.cachedMat('fence', () => new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.35, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.5, color: 0xc9cdd2 }));
  const postMat = sc.cachedMat('fencePost', () => new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.7, roughness: 0.4 }));
  const post = new THREE.CylinderGeometry(0.05, 0.05, toH - fromH + 0.2, 5);
  const pos = [], uv = [];
  const f = {};
  for (const side of sides) {
    let prev = null;
    for (let i = 0; i <= t.count - (t.closed ? 0 : 1); i++) {
      const ii = t.idx(i);
      const ok = !filter || filter(ii, side);
      if (!ok) { prev = null; continue; }
      const wall = (side > 0 ? t.wallR[ii] : t.wallL[ii]) - inset;
      frameAt(t, ii, side * wall, f);
      const y = surfaceY(t, ii, side * wall);
      const cur = { x: f.x, z: f.z, y0: y + fromH, y1: y + toH, s: i * t.spacing };
      if (prev) {
        const u0 = prev.s / 3, u1 = cur.s / 3, v1 = (toH - fromH) / 3;
        pos.push(prev.x, prev.y0, prev.z, cur.x, cur.y0, cur.z, prev.x, prev.y1, prev.z);
        pos.push(prev.x, prev.y1, prev.z, cur.x, cur.y0, cur.z, cur.x, cur.y1, cur.z);
        uv.push(u0, 0, u1, 0, u0, v1, u0, v1, u1, 0, u1, v1);
      }
      prev = cur;
      if (i % Math.max(1, Math.round(postStep / t.spacing)) === 0) sc.bin.add('fencePost', postMat, post, mat(f.x, (cur.y0 + cur.y1) / 2, f.z));
    }
  }
  if (!pos.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, fenceMat);
  m.castShadow = false;
  m.receiveShadow = true;
  sc.group.add(m);
  sc.bin.noShadow('fencePost');
}

// Atlas de textes (panneaux) : une seule texture pour toutes les inscriptions d'un thème.
// entries : [{ text, bg, fg, font? }] → { texture, rect(i) : [u0, v0, u1, v1] }
export function textAtlas(key, entries, { cellW = 256, cellH = 96, font = 'bold 56px Arial, Helvetica, sans-serif', border = null } = {}) {
  return cached('atlas' + key, () => {
    const cols = Math.ceil(Math.sqrt(entries.length));
    const rows = Math.ceil(entries.length / cols);
    const c = makeCanvas(cols * cellW, rows * cellH);
    const ctx = c.getContext('2d');
    entries.forEach((e, i) => {
      const x = (i % cols) * cellW, y = Math.floor(i / cols) * cellH;
      ctx.fillStyle = e.bg;
      ctx.fillRect(x, y, cellW, cellH);
      if (e.border || border) {
        ctx.strokeStyle = e.border || border;
        ctx.lineWidth = 6;
        ctx.strokeRect(x + 5, y + 5, cellW - 10, cellH - 10);
      }
      ctx.fillStyle = e.fg;
      ctx.font = e.font || font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (e.glow) {
        ctx.shadowColor = e.fg;
        ctx.shadowBlur = 14;
      }
      ctx.fillText(e.text, x + cellW / 2, y + cellH / 2 + 3, cellW - 18);
      ctx.shadowBlur = 0;
    });
    const texture = canvasTexture(c, { repeat: false });
    const W = cols * cellW, H = rows * cellH;
    return {
      texture,
      rect: (i) => {
        const x = (i % cols) * cellW, y = Math.floor(i / cols) * cellH;
        return [x / W, 1 - (y + cellH) / H, (x + cellW) / W, 1 - y / H];
      },
    };
  });
}

// Postes de commissaires : cabine blanche sur pilotis, bandeau orange et mât à drapeau,
// tous les `step` m en alternant les côtés ; skip(i, side) écarte un emplacement.
export function marshalPosts(sc, { step = 320, offset = 4, skip = null } = {}) {
  const t = sc.track;
  const white = sc.cachedMat('marshalWhite', () => new THREE.MeshStandardMaterial({ color: 0xeef0f2, roughness: 0.6 }));
  const orange = sc.cachedMat('marshalOrange', () => new THREE.MeshStandardMaterial({ color: 0xff6a10, roughness: 0.5, emissive: 0xff4a00, emissiveIntensity: sc.night ? 0.6 : 0.05 }));
  const dark = sc.cachedMat('marshalDark', () => new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.5, metalness: 0.4 }));
  const cabin = new THREE.BoxGeometry(2.2, 2.1, 2.2);
  const band = new THREE.BoxGeometry(2.26, 0.35, 2.26);
  const roof = new THREE.BoxGeometry(2.9, 0.18, 2.9);
  const leg = new THREE.BoxGeometry(0.16, 1.5, 0.16);
  const pole = new THREE.CylinderGeometry(0.04, 0.04, 3.2, 4);
  const flag = new THREE.BoxGeometry(0.03, 0.62, 0.9);
  const win = new THREE.BoxGeometry(0.06, 0.7, 1.7);
  const n = Math.max(1, Math.round(step / t.spacing));
  const f = {};
  let k = 0;
  for (let i = Math.floor(n / 2); i < t.count; i += n, k++) {
    const side = k % 2 ? 1 : -1;
    if (skip && skip(i, side)) continue;
    const wall = side > 0 ? t.wallR[i] : t.wallL[i];
    frameAt(t, i, side * (wall + offset), f);
    if (sc.clearance(f.x, f.z) < offset - 1.5) continue;
    const y = Math.max(sc.groundAt(f.x, f.z), surfaceY(t, i, side * wall) - 0.3);
    const P = (a, b) => [f.x + f.rx * a * side + f.dx * b, f.z + f.rz * a * side + f.dz * b];
    for (const [a, b] of [[-0.9, -0.9], [-0.9, 0.9], [0.9, -0.9], [0.9, 0.9]]) {
      const [x, z] = P(a, b);
      sc.bin.add('marshalDark', dark, leg, mat(x, y + 0.75, z, f.rot));
    }
    sc.bin.add('marshalWhite', white, cabin, mat(f.x, y + 2.55, f.z, f.rot));
    sc.bin.add('marshalOrange', orange, band, mat(f.x, y + 3.3, f.z, f.rot));
    sc.bin.add('marshalWhite', white, roof, mat(f.x, y + 3.7, f.z, f.rot));
    // vitre côté piste
    const [wx, wz] = P(-1.12, 0);
    sc.bin.add('marshalDark', dark, win, mat(wx, y + 2.75, wz, f.rot));
    const [px, pz] = P(-1.2, 1.2);
    sc.bin.add('marshalDark', dark, pole, mat(px, y + 4.6, pz));
    sc.bin.add('marshalOrange', orange, flag, mat(px + f.dx * 0.45, y + 5.85, pz + f.dz * 0.45, f.rot));
  }
  sc.bin.noShadow('marshalDark');
}

// Écran géant sur pylônes, tourné vers la piste et vers les voitures qui arrivent
export function bigScreen(sc, i, side, { w = 16, h = 9, lift = 7, back = 14 } = {}) {
  const t = sc.track;
  const wall = side > 0 ? t.wallR[i] : t.wallL[i];
  const f = frameAt(t, i, side * (wall + back), {});
  if (sc.clearance(f.x, f.z) < back - 3) return false;
  const y = sc.groundAt(f.x, f.z);
  // normale de l'écran : vers la piste, inclinée vers l'arrivée des voitures
  let nx = -side * f.rx - f.dx * 0.7, nz = -side * f.rz - f.dz * 0.7;
  const nl = Math.hypot(nx, nz);
  nx /= nl; nz /= nl;
  const rot = Math.atan2(nx, nz);
  const tex = screenTexture();
  const scr = sc.cachedMat('bigScreen', () => new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: sc.night ? 1.3 : 0.85, roughness: 0.4 }));
  const dark = sc.cachedMat('marshalDark', () => new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.5, metalness: 0.4 }));
  sc.bin.add('bigScreen', scr, new THREE.PlaneGeometry(w, h), mat(f.x + nx * 0.5, y + lift + h / 2, f.z + nz * 0.5, rot));
  sc.bin.add('marshalDark', dark, new THREE.BoxGeometry(w + 0.8, h + 0.8, 0.6), mat(f.x, y + lift + h / 2, f.z, rot));
  const c = Math.cos(rot), s = Math.sin(rot);
  for (const o of [-w * 0.3, w * 0.3]) sc.bin.add('marshalDark', dark, new THREE.BoxGeometry(0.7, lift, 0.7), mat(f.x + c * o, y + lift / 2, f.z - s * o, rot));
  return true;
}

// Image de l'écran géant : retransmission stylisée (piste, voitures, classement, logo)
function screenTexture() {
  return cached('bigScreen', () => {
    const W = 512, H = 288;
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    let g = ctx.createLinearGradient(0, 0, 0, H * 0.45);
    g.addColorStop(0, '#3b7fd0');
    g.addColorStop(1, '#bcd8f0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#5a7a3a';
    ctx.fillRect(0, H * 0.45, W, H * 0.55);
    // piste en perspective
    ctx.fillStyle = '#3c3f44';
    ctx.beginPath();
    ctx.moveTo(W * 0.47, H * 0.45); ctx.lineTo(W * 0.53, H * 0.45); ctx.lineTo(W * 0.95, H); ctx.lineTo(W * 0.05, H);
    ctx.fill();
    ctx.strokeStyle = '#f2f2f2';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W * 0.47, H * 0.45); ctx.lineTo(W * 0.08, H); ctx.moveTo(W * 0.53, H * 0.45); ctx.lineTo(W * 0.92, H);
    ctx.stroke();
    // voitures
    for (const [x, y, s, col] of [[0.44, 0.78, 1, '#d01c2a'], [0.58, 0.62, 0.62, '#1c5ad0']]) {
      const cw = 90 * s, ch = 34 * s;
      ctx.fillStyle = col;
      ctx.fillRect(W * x - cw / 2, H * y - ch / 2, cw, ch);
      ctx.fillStyle = '#111';
      ctx.fillRect(W * x - cw * 0.3, H * y - ch * 0.75, cw * 0.6, ch * 0.4);
      ctx.fillRect(W * x - cw * 0.45, H * y + ch * 0.35, cw * 0.18, ch * 0.3);
      ctx.fillRect(W * x + cw * 0.27, H * y + ch * 0.35, cw * 0.18, ch * 0.3);
    }
    // classement
    ctx.fillStyle = 'rgba(10,14,22,0.85)';
    ctx.fillRect(14, 40, 120, 150);
    ctx.font = 'bold 20px Arial, Helvetica, sans-serif';
    ['1  KAZE', '2  VEGA', '3  ORSO', '4  LUMA', '5  ARGO'].forEach((txt, k) => {
      ctx.fillStyle = k === 0 ? '#ffd23b' : '#ffffff';
      ctx.fillText(txt, 24, 66 + k * 28);
    });
    // bandeaux
    ctx.fillStyle = '#d0102a';
    ctx.fillRect(14, 12, 104, 24);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial, Helvetica, sans-serif';
    ctx.fillText('EN DIRECT', 22, 30);
    ctx.fillStyle = 'rgba(10,14,22,0.85)';
    ctx.fillRect(W - 210, H - 44, 196, 32);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px Arial, Helvetica, sans-serif';
    ctx.fillText('TRAJECTOIRE', W - 194, H - 20);
    return canvasTexture(c, { repeat: false });
  });
}

// Plan rectangulaire (w × h) dont les UV couvrent la case `r` d'un atlas
export function atlasPlane(w, h, r, doubleSided = false) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? r[2] : r[0], uv.getY(i) ? r[3] : r[1]);
  if (!doubleSided) return g;
  const back = g.clone();
  back.rotateY(Math.PI);
  return mergeGeometries([g, back], false);
}

// Regroupe les géométries statiques par matériau pour limiter les appels de rendu.
// Si le matériau utilise les couleurs par sommet, `color` ([r, g, b]) teinte la pièce.
export class MergeBin {
  constructor() {
    this.bins = new Map();
  }
  add(key, material, geometry, matrix, color) {
    if (!this.bins.has(key)) this.bins.set(key, { material, geos: [], cast: undefined });
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (matrix) g.applyMatrix4(matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (material.vertexColors) {
      const n = g.attributes.position.count;
      const c = color || [1, 1, 1];
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = c[0]; arr[i * 3 + 1] = c[1]; arr[i * 3 + 2] = c[2]; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    this.bins.get(key).geos.push(g);
  }
  // Ombres portées réglables par groupe (petits objets : pas d'ombre)
  noShadow(key) {
    if (this.bins.has(key)) this.bins.get(key).cast = false;
  }
  flush(group, { cast = true, receive = true } = {}) {
    for (const bin of this.bins.values()) {
      const { material, geos } = bin;
      if (!geos.length) continue;
      const merged = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      const m = new THREE.Mesh(merged, material);
      m.castShadow = bin.cast ?? cast;
      m.receiveShadow = receive;
      group.add(m);
    }
    this.bins.clear();
  }
}

// Boîte avec UV en mètres (textures répétées à l'échelle)
export function boxWorldUV(w, h, d, uScale = 8, vScale = 8) {
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
const _e = new THREE.Euler();
export const UP = new THREE.Vector3(0, 1, 0);

// Matrice de placement : position, rotation autour de Y, échelle
export function mat(x, y, z, rotY = 0, sx = 1, sy = 1, sz = 1) {
  _q.setFromAxisAngle(UP, rotY);
  _v.set(x, y, z);
  _s.set(sx, sy, sz);
  return _m.clone().compose(_v, _q, _s);
}

// Matrice avec rotation complète (ordre YXZ : cap, tangage, roulis)
export function matR(x, y, z, rotY = 0, rotX = 0, rotZ = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rotX, rotY, rotZ, 'YXZ');
  _q.setFromEuler(_e);
  _v.set(x, y, z);
  _s.set(sx, sy, sz);
  return _m.clone().compose(_v, _q, _s);
}

// Repère horizontal du circuit à l'échantillon i : point au décalage latéral `lat`
// (> 0 à droite) et cap de la piste. `out` est réutilisé.
export function frameAt(track, i, lat, out = {}) {
  const hl = Math.hypot(track.rx[i], track.rz[i]) || 1;
  out.rx = track.rx[i] / hl;
  out.rz = track.rz[i] / hl;
  out.x = track.px[i] + out.rx * lat;
  out.z = track.pz[i] + out.rz * lat;
  out.dx = track.dx[i];
  out.dz = track.dz[i];
  // rotation Y d'un objet dont l'axe -Z suit la piste
  out.rot = -track.heading[i];
  return out;
}

// Côté intérieur de la boucle (+1 : droite)
export function infieldSide(track) {
  let sumK = 0;
  for (let i = 0; i < track.count; i++) sumK += track.kappa[i];
  return sumK > 0 ? 1 : -1;
}

// ------------------------------------------------------------------ Textures procédurales
const cache = new Map();
function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function canvasTexture(c, { srgb = true, repeat = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

// Bruit tuilable
function tileNoise(noise, x, y, w, h, scale) {
  const u = x / w, v = y / h;
  const a = noise.noise(x * scale, y * scale);
  const b = noise.noise((x - w) * scale, y * scale);
  const c = noise.noise(x * scale, (y - h) * scale);
  const d = noise.noise((x - w) * scale, (y - h) * scale);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function heightToNormal(height, w, h, strength = 2) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const xl = height[y * w + ((x - 1 + w) % w)], xr = height[y * w + ((x + 1) % w)];
      const yu = height[((y - 1 + h) % h) * w + x], yd = height[((y + 1) % h) * w + x];
      let nx = (xl - xr) * strength, ny = (yu - yd) * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const k = (y * w + x) * 4;
      img.data[k] = (nx / l * 0.5 + 0.5) * 255;
      img.data[k + 1] = (ny / l * 0.5 + 0.5) * 255;
      img.data[k + 2] = (nz / l * 0.5 + 0.5) * 255;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Détail de terrain : sable ridé par le vent (gris clair multiplié par les couleurs)
export function sandDetail() {
  return cached('sandDetail', () => {
    const N = 512;
    const c = makeCanvas(N, N);
    const ctx = c.getContext('2d');
    const noise = new Noise2D(61);
    const r = rng(8);
    const img = ctx.createImageData(N, N);
    const h = new Float32Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const warp = tileNoise(noise, x, y, N, N, 0.015) * 18;
        // rides : sinusoïde déformée (période 16 px = 1,7 m sur le terrain)
        const ripple = Math.sin(((y + warp) / N) * Math.PI * 2 * 32 + Math.sin((x / N) * Math.PI * 2 * 3) * 2);
        const n = tileNoise(noise, x + 50, y + 20, N, N, 0.04);
        const g = r() - 0.5;
        const v = clamp(0.88 + ripple * 0.05 + n * 0.12 + g * 0.1, 0.5, 1);
        const k = (y * N + x) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = v * 255;
        img.data[k + 3] = 255;
        h[y * N + x] = ripple * 0.6 + g * 0.3;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { map: canvasTexture(c, { srgb: false }), normalMap: canvasTexture(heightToNormal(h, N, N, 1.4), { srgb: false }) };
  });
}

// Détail de terrain : neige poudreuse (très peu contrastée, légères vagues de vent)
export function snowDetail() {
  return cached('snowDetail', () => {
    const N = 512;
    const c = makeCanvas(N, N);
    const ctx = c.getContext('2d');
    const noise = new Noise2D(71);
    const r = rng(15);
    const img = ctx.createImageData(N, N);
    const h = new Float32Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const n = tileNoise(noise, x, y, N, N, 0.02) * 0.6 + tileNoise(noise, x + 7, y + 3, N, N, 0.07) * 0.4;
        const g = r() - 0.5;
        const v = clamp(0.94 + n * 0.06 + g * 0.03, 0.7, 1);
        const k = (y * N + x) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = v * 255;
        img.data[k + 3] = 255;
        h[y * N + x] = n + g * 0.15;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { map: canvasTexture(c, { srgb: false }), normalMap: canvasTexture(heightToNormal(h, N, N, 2.2), { srgb: false }) };
  });
}

// Grillage (maille losange) avec transparence : clôtures, grillages de protection
export function chainLink() {
  return cached('chainLink', () => {
    const N = 128;
    const c = makeCanvas(N, N);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, N, N);
    ctx.strokeStyle = 'rgba(200,205,210,1)';
    ctx.lineWidth = 2.2;
    const s = 16;
    for (let k = -N; k < N * 2; k += s) {
      ctx.beginPath();
      ctx.moveTo(k, 0);
      ctx.lineTo(k + N, N);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(k, N);
      ctx.lineTo(k + N, 0);
      ctx.stroke();
    }
    const t = canvasTexture(c);
    return t;
  });
}

// Façade vitrée moderne (hôtels, tours) : grille de vitrages + carte émissive
export function glassFacade(seed = 0, { night = false, tint = [40, 70, 95], lit = 0.35, cols = 8, rows = 16, vary = 0.5, slab = 0.12, frame = '#c8ccd2' } = {}) {
  return cached('glass' + seed + night + tint.join(',') + lit + cols + rows + vary + slab + frame, () => {
    const W = 256, H = 512;
    const c = makeCanvas(W, H), e = makeCanvas(W, H);
    const ctx = c.getContext('2d'), ectx = e.getContext('2d');
    const r = rng(seed * 7 + 3);
    ctx.fillStyle = frame;
    ctx.fillRect(0, 0, W, H);
    ectx.fillStyle = '#000';
    ectx.fillRect(0, 0, W, H);
    const cw = W / cols, rh = H / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const l = 1 - vary / 2 + r() * vary;
        ctx.fillStyle = `rgb(${(tint[0] * l) | 0},${(tint[1] * l) | 0},${(tint[2] * l) | 0})`;
        ctx.fillRect(x * cw + 1.5, y * rh + rh * slab, cw - 3, rh * (1 - slab) - 1);
        // reflet du ciel en haut de chaque vitre
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x * cw + 1.5, y * rh + rh * slab, cw - 3, rh * (1 - slab) * 0.35);
        if (night && r() < lit) {
          const v = 150 + r() * 105;
          const warm = r() < 0.7;
          ectx.fillStyle = warm ? `rgb(${v},${(v * 0.8) | 0},${(v * 0.52) | 0})` : `rgb(${(v * 0.75) | 0},${(v * 0.88) | 0},${v})`;
          ectx.fillRect(x * cw + 1.5, y * rh + rh * slab, cw - 3, rh * (1 - slab) - 1);
        }
      }
    }
    return { map: canvasTexture(c), emissiveMap: canvasTexture(e) };
  });
}

// Enseigne lumineuse : texte néon avec halo (carte de couleur = carte émissive)
export function neonTexture(text, color, { w = 512, h = 128, vertical = false, font = 'bold 84px Arial, Helvetica, sans-serif', frame = true } = {}) {
  return cached('neon' + text + color + w + h + vertical + font + frame, () => {
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#070709';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    if (vertical) {
      ctx.translate(w / 2, h / 2);
      ctx.rotate(Math.PI / 2);
      ctx.translate(-h / 2, -w / 2);
    }
    const W = vertical ? h : w, H = vertical ? w : h;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.fillText(text, W / 2, H / 2 + 4, W - 24);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = font.replace(/\d+px/, (m) => Math.round(parseInt(m, 10) * 0.98) + 'px');
    ctx.globalAlpha = 0.55;
    ctx.fillText(text, W / 2, H / 2 + 4, W - 24);
    ctx.globalAlpha = 1;
    if (frame) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.strokeRect(8, 8, W - 16, H - 16);
    }
    ctx.restore();
    return canvasTexture(c, { repeat: false });
  });
}

// Panneau d'information (kilométrage, noms de virages) : fond uni + texte
export function signTexture(text, { bg = '#f2f2f0', fg = '#111', w = 256, h = 128, font = 'bold 70px Arial, Helvetica, sans-serif', border = '#111' } = {}) {
  return cached('sign' + text + bg + fg + w + h + font + border, () => {
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    if (border) {
      ctx.strokeStyle = border;
      ctx.lineWidth = 8;
      ctx.strokeRect(6, 6, w - 12, h - 12);
    }
    ctx.fillStyle = fg;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 4, w - 28);
    return canvasTexture(c, { repeat: false });
  });
}

// Dalles de béton (virage relevé, murs) : joints réguliers + taches
export function concreteSlabs() {
  return cached('slabs', () => {
    const N = 256;
    const c = makeCanvas(N, N);
    const ctx = c.getContext('2d');
    const noise = new Noise2D(19);
    const r = rng(23);
    const img = ctx.createImageData(N, N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const n = tileNoise(noise, x, y, N, N, 0.06);
        const v = 150 + n * 22 + (r() - 0.5) * 18;
        const k = (y * N + x) * 4;
        img.data[k] = v; img.data[k + 1] = v * 0.99; img.data[k + 2] = v * 0.96; img.data[k + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = 'rgba(40,38,36,0.55)';
    for (let k = 0; k < N; k += 64) {
      ctx.fillRect(k, 0, 2, N);
      ctx.fillRect(0, k, N, 2);
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(30,30,30,${0.05 + r() * 0.1})`;
      ctx.beginPath();
      ctx.ellipse(r() * N, r() * N, 4 + r() * 16, 2 + r() * 8, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    return canvasTexture(c);
  });
}

// Petits personnages vus de loin (spectateurs sur les talus) : silhouettes colorées
export function peopleTexture() {
  return cached('people', () => {
    const W = 512, H = 64;
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const r = rng(31);
    const shirts = ['#d33', '#eee', '#36c', '#fc3', '#2a2', '#f80', '#222', '#c5c', '#9cf', '#e44', '#147', '#fff', '#7a5', '#b52'];
    for (let x = 4; x < W - 10; x += 9 + r() * 10) {
      const hgt = 40 + r() * 14;
      const top = H - hgt;
      ctx.fillStyle = r() < 0.5 ? '#2b3140' : '#4a4a52';
      ctx.fillRect(x + 1, H - hgt * 0.45, 3, hgt * 0.45);
      ctx.fillRect(x + 5, H - hgt * 0.45, 3, hgt * 0.45);
      ctx.fillStyle = shirts[(r() * shirts.length) | 0];
      ctx.fillRect(x, top + hgt * 0.18, 9, hgt * 0.4);
      ctx.fillStyle = r() < 0.6 ? '#e3b996' : r() < 0.5 ? '#9a6a48' : '#5a3a28';
      ctx.beginPath();
      ctx.arc(x + 4.5, top + hgt * 0.1, 4, 0, Math.PI * 2);
      ctx.fill();
      if (r() < 0.12) {
        ctx.fillStyle = shirts[(r() * shirts.length) | 0];
        ctx.fillRect(x + 8, top - 4, 10, 7);
      }
    }
    return canvasTexture(c);
  });
}
