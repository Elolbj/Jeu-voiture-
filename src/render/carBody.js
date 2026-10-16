// Carrosserie procédurale : profils (BodyShape), caisse en sections lissées avec UV d'atlas de livrée,
// habitacle (montants peints, vitrages découpés, encadrements arrondis) et projection de décalques
// (optiques, calandres, plaques…) qui épousent exactement la surface.
import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../core/utils.js';
import { toCreasedNormals, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { resolveStyle } from './carStyles.js';

// Interpolation par morceaux avec lissage (C1) entre clés [[t, v], ...]
function keyInterp(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t <= b[0]) {
      const u = (t - a[0]) / (b[0] - a[0] || 1);
      const s = u * u * (3 - 2 * u);
      return a[1] + (b[1] - a[1]) * s;
    }
  }
  return keys[keys.length - 1][1];
}

// Arrondi en superellipse : 0 à l'extrémité, 1 à la distance R
function roundEase(d, R, p) {
  if (d >= R) return 1;
  const u = 1 - d / R;
  return Math.pow(Math.max(0, 1 - Math.pow(u, p)), 1 / p);
}

// ---------------------------------------------------------------------------
// Profils de la caisse
// ---------------------------------------------------------------------------
export class BodyShape {
  constructor(spec) {
    const st = resolveStyle(spec);
    this.st = st;
    const d = spec.dims;
    this.L = d.length;
    this.H = d.height;
    this.Wmax = d.width / 2;
    this.wb = d.wheelbase;
    const over = d.length - d.wheelbase;
    const a = d.wheelbase * (1 - spec.weightFront);
    this.overF = over * (st.overF ?? 0.52);
    this.zFront = -a - this.overF;
    this.zRear = this.zFront + this.L;
    this.zAxleF = -a;
    this.zAxleR = d.wheelbase - a;
    this.r = spec.wheel.radius;
    this.wheelW = spec.wheel.width;
    this.archR = this.r + 0.04;
    this.clear = st.clear - (spec.lowered || 0) * 0.5;
    this.track = d.track;
    const H = this.H;
    this.tAxleF = (this.zAxleF - this.zFront) / this.L;
    this.tAxleR = (this.zAxleR - this.zFront) / this.L;
    // hauteur minimale des ailes au-dessus des roues
    this.fenderNeed = this.r * 2 + 0.045 + (st.fenderGap ?? 0.065);
    this.topKeys = [
      [0, st.nose * H],
      [st.ws * 0.55, lerp(st.nose, st.hood, 0.72) * H],
      [st.ws, st.hood * H],
      [st.ws + 0.03, st.belt * H],
      [st.rearB - 0.02, st.belt * H],
      [st.rearB, st.deck * H],
      [1, st.tail * H],
    ];
    this.yNose = lerp(this.clear, st.nose * H, st.noseY);
    this.yTail = lerp(this.clear, st.tail * H, st.tailY);
    this.belt = st.belt * H;
    this._p = {};
    this._secCache = new Map();
  }

  // Profil de la section en t : dessus au centre (top), dessus des ailes (topF), dessous (bot),
  // demi-largeur (W), ligne d'épaule (ys) et facteur d'arrondi des extrémités (e)
  profile(t, out = this._p) {
    const st = this.st;
    const z = this.zFront + t * this.L;
    const dF = t * this.L, dR = (1 - t) * this.L;
    let top = keyInterp(this.topKeys, t);
    let topF = top;
    if (this.fenderNeed > top) {
      const R = this.archR;
      const ramp = (a, b) => { const u = clamp((z - a) / (b - a), 0, 1); return 1 - Math.pow(1 - u, 1.35); };
      const kF = ramp(this.zFront + 0.04, this.zAxleF - R * 0.25) * (1 - smoothstep(this.zAxleF + R * 1.4, this.zAxleF + R * 3.2, z));
      const kR = smoothstep(this.zAxleR - R * 3.2, this.zAxleR - R * 1.4, z) * ramp(this.zRear - 0.04, this.zAxleR + R * 0.5);
      const k = Math.max(kF, kR);
      if (k > 0) topF = lerp(top, this.fenderNeed, k);
    }
    let bot = this.clear;
    for (const za of [this.zAxleF, this.zAxleR]) {
      const dz = z - za;
      const R = this.archR;
      if (Math.abs(dz) < R) bot = Math.max(bot, this.r + Math.sqrt(R * R - dz * dz) * 0.97);
    }
    const eT = roundEase(dF, st.noseR, st.nosePow) * roundEase(dR, st.tailR, st.tailPow);
    const eB = roundEase(dF, st.noseRB, 2.2) * roundEase(dR, st.tailRB, 2.2);
    const yC = dF < dR ? this.yNose : this.yTail;
    top = yC + (top - yC) * eT;
    topF = yC + (topF - yC) * eT;
    bot = yC - (yC - bot) * eB;
    const e = Math.min(eT, eB);
    bot = Math.min(bot, top - 0.06 * e);
    const W = this.halfWidth(t, z);
    let ys = bot + (topF - bot) * st.shoulder;
    for (const za of [this.zAxleF, this.zAxleR]) {
      const dz = Math.abs(z - za);
      if (dz < this.archR + 0.25) {
        const need = this.r * 2 + 0.07;
        const k = 1 - smoothstep(this.archR - 0.05, this.archR + 0.25, dz);
        ys = Math.max(ys, lerp(ys, need, k));
      }
    }
    ys = clamp(ys, bot + 0.03 * e, topF - 0.025 * e);
    out.z = z; out.top = top; out.topF = topF; out.bot = bot; out.W = W; out.ys = ys; out.e = e;
    return out;
  }

  top(t) { return this.profile(t).top; }
  bottom(t) { return this.profile(t).bot; }

  // Vue en plan : coins arrondis + ailes élargies aux roues
  halfWidth(t, z = this.zFront + t * this.L) {
    const st = this.st;
    const dF = t * this.L, dR = (1 - t) * this.L;
    const f = (st.w0F + (1 - st.w0F) * roundEase(dF, st.cornerF, 2.2)) * (st.w0R + (1 - st.w0R) * roundEase(dR, st.cornerR, 2.2));
    const flare = st.flare || 0.02;
    let w = (this.Wmax - flare) * f;
    for (const za of [this.zAxleF, this.zAxleR]) {
      const dz = (z - za) / (this.archR * 1.35);
      w += flare * Math.exp(-dz * dz * dz * dz) * f;
    }
    return Math.max(0.0005, Math.min(w, this.Wmax));
  }

  valley(t) {
    if (!this.st.valley) return 0;
    // creux central entre les ailes (prototypes, hypercars, GT classiques)
    return this.st.valley * (1 - smoothstep(this.st.ws - 0.08, this.st.ws + 0.04, t)) +
      this.st.valley * 0.6 * smoothstep(this.st.rearB - 0.05, this.st.rearB + 0.05, t);
  }

  // Point de la section (côté droit) pour un angle θ ∈ [-π/2, π/2]
  sectionPoint(t, theta, out) {
    const P = this.profile(t, out);
    const { top, topF, bot, W, ys } = P;
    const st = this.st;
    let x, y;
    const c = Math.abs(Math.abs(theta) - Math.PI / 2) < 1e-9 ? 0 : Math.cos(theta), s = Math.sin(theta);
    if (theta < 0) {
      const n = st.nL;
      x = W * Math.pow(Math.abs(c), 2 / n);
      const as = Math.pow(Math.abs(s), 2 / n);
      y = ys - (ys - bot) * as;
      // flanc légèrement creusé sous la ligne de caractère + bas de caisse rentré
      x -= W * 0.016 * Math.sin(Math.min(1, -theta / 0.9) * Math.PI);
      x -= W * st.tuck * smoothstep(0.55, 1, as) * P.e;
    } else {
      const n = st.nU;
      x = W * Math.pow(Math.abs(c), 2 / n);
      y = ys + (topF - ys) * Math.pow(Math.abs(s), 2 / n);
      const v = (topF - top) + this.valley(t) * P.e;
      if (v > 0) {
        const u = x / (W * 0.72);
        if (u < 1) { const q = 1 - u * u * u * u; y -= v * q * q; }
      }
    }
    out.x = x;
    out.y = y;
    return out;
  }

  // Hauteur du toit (habitacle) en t
  roof(t) {
    const st = this.st, H = this.H;
    const belt = st.belt * H, roofH = st.roof * H;
    if (t <= st.ws) return belt;
    if (t < st.roofF) {
      const u = (t - st.ws) / (st.roofF - st.ws);
      return belt + (roofH - belt) * (1 - Math.pow(1 - u, 1.7));
    }
    if (t <= st.roofB) {
      const u = (t - st.roofF) / (st.roofB - st.roofF);
      return roofH * (1 - 0.025 * Math.pow(2 * u - 1, 2));
    }
    if (t < st.rearB) {
      const u = (t - st.roofB) / (st.rearB - st.roofB);
      const end = st.deck * H;
      const k = st.rearB > 0.95 ? Math.pow(u, st.rearPow ?? 1.5) : 1 - Math.pow(1 - u, 1.4);
      return roofH * 0.975 + (end - roofH * 0.975) * k;
    }
    return st.deck * H;
  }

  tOf(z) { return (z - this.zFront) / this.L; }
  zOf(t) { return this.zFront + t * this.L; }

  // Section de l'habitacle (côté droit) : polyligne de la ceinture au centre du toit, abscisses curvilignes.
  // sR = abscisse du bord de pavillon (montant), S = longueur totale.
  cabSection(t) {
    const key = Math.round(t * 1e6);
    const c = this._secCache.get(key);
    if (c) return c;
    const st = this.st, belt = this.belt;
    const z = this.zOf(t);
    const W = this.halfWidth(t, z);
    const h = Math.max(0, this.roof(t) - belt);
    const wc = W * st.cabW * (0.94 + 0.06 * smoothstep(st.ws, st.roofF, t));
    const kr = st.roofW / st.cabW;
    const wr = wc * kr + (1 - smoothstep(0, 0.35, h)) * (wc - wc * kr);
    const rr = Math.min(h * 0.22, 0.09);
    const pts = [];
    const bx = wc, by = belt - 0.03, rx = wr, ry = belt + h - rr;
    const dx = rx - bx, dy = ry - by, l = Math.hypot(dx, dy) || 1;
    const nx = dy / l, ny = -dx / l;
    const bulge = Math.min(0.014, l * 0.05);
    for (let i = 0; i <= 5; i++) {
      const u = i / 5, b = bulge * 4 * u * (1 - u);
      pts.push([bx + dx * u + nx * b, by + dy * u + ny * b]);
    }
    const nA = 12, pw = 2 / 3.2;
    for (let i = 1; i <= nA; i++) {
      const a = (i / nA) * (Math.PI / 2);
      pts.push([wr * Math.pow(Math.cos(a), pw), ry + rr * Math.pow(Math.sin(a), pw)]);
    }
    pts[pts.length - 1][0] = 0;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const sec = { t, z, pts, cum, sR: cum[5], S: cum[cum.length - 1], h, wc, wr };
    if (this._secCache.size > 4000) this._secCache.clear();
    this._secCache.set(key, sec);
    return sec;
  }

  // Point de l'habitacle à l'abscisse curviligne s (côté droit)
  cabPoint(sec, s, out) {
    const { pts, cum } = sec;
    s = clamp(s, 0, sec.S);
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const a = cum[i - 1], b = cum[i];
    const u = b > a ? (s - a) / (b - a) : 0;
    out.x = lerp(pts[i - 1][0], pts[i][0], u);
    out.y = lerp(pts[i - 1][1], pts[i][1], u);
    out.z = sec.z;
    return out;
  }
}

// ---------------------------------------------------------------------------
// Atlas de livrée : flanc droit (haut de l'image), flanc gauche, dessus (moitié basse).
// Coordonnées métriques : un motif dessiné dans l'atlas garde ses proportions sur la voiture.
// ---------------------------------------------------------------------------
export const ATLAS = { right: [0.75, 1], left: [0.5, 0.75], top: [0, 0.5], pad: 4 / 1024 };
// Pastilles de couleur unie (colonne libre du bord gauche) : teinte de base, seconde couleur, noir
export const SWATCH = { base: [0.004, 0.06], color2: [0.004, 0.16], dark: [0.004, 0.26] };

export class Atlas {
  constructor(shape) {
    this.zMin = shape.zFront - 0.06;
    this.zMax = shape.zRear + 0.06;
    this.yMax = shape.H + 0.1;
    this.xMax = shape.Wmax + 0.08;
  }
  side(z, y, right, out = [0, 0]) {
    const span = this.zMax - this.zMin, P = ATLAS.pad;
    const [v0, v1] = right ? ATLAS.right : ATLAS.left;
    out[0] = right ? (this.zMax - z) / span : (z - this.zMin) / span;
    out[1] = v0 + P + clamp(y / this.yMax, 0, 1) * (v1 - v0 - 2 * P);
    return out;
  }
  top(z, x, out = [0, 0]) {
    const span = this.zMax - this.zMin, P = ATLAS.pad;
    out[0] = (this.zMax - z) / span;
    out[1] = P + clamp((this.xMax - x) / (2 * this.xMax), 0, 1) * (0.5 - 2 * P);
    return out;
  }
  // Choix de la zone selon la normale (pièces rapportées : rétroviseurs, ailerons, lèvres…)
  auto(x, y, z, nx, ny, nz, out = [0, 0]) {
    if (ny > 0.62) return this.top(z, x, out);
    return this.side(z, y, x > 0 || (Math.abs(x) < 1e-4 && nx >= 0), out);
  }
  // Pixels du canevas de livrée (origine en haut à gauche)
  px(u, v, W, H) { return [u * W, (1 - v) * H]; }
}

// UV d'atlas pour une géométrie quelconque (selon position et normale de chaque sommet)
export function atlasUV(geo, atlas, uvAttr = 'uv') {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  const o = [0, 0];
  for (let i = 0; i < p.count; i++) {
    atlas.auto(p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i), o);
    uv[i * 2] = o[0]; uv[i * 2 + 1] = o[1];
  }
  geo.setAttribute(uvAttr, new THREE.BufferAttribute(uv, 2));
  return geo;
}

function pushQuad(idx, a, b, c, d) {
  idx.push(a, b, d, b, c, d);
}

export function fixNormals(g) {
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) {
    const l = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
    if (!(l > 1e-6) || !isFinite(l)) n.setXYZ(i, 0, 1, 0);
  }
  n.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// Caisse : tube de sections, découpé en trois zones d'atlas (flanc droit, dessus, flanc gauche)
// ---------------------------------------------------------------------------
export function buildBodyGeometry(shape, atlas, lod = 0) {
  const ts = [];
  const N = lod ? 26 : 76;
  for (let i = 0; i <= N; i++) ts.push(0.5 - 0.5 * Math.cos((i / N) * Math.PI));
  const nArch = lod ? 3 : 7;
  for (const ta of [shape.tAxleF, shape.tAxleR]) {
    const dt = shape.archR / shape.L;
    for (let k = -nArch; k <= nArch; k++) ts.push(ta + (k / nArch) * dt * 1.02);
  }
  ts.sort((a, b) => a - b);
  const stations = ts.filter((t, i) => i === 0 || t - ts[i - 1] > 1e-4);
  const nLow = lod ? 4 : 10, nUp = lod ? 6 : 14, kS = nUp / 2; // couture à θ = π/4
  const thetas = [];
  for (let k = 0; k <= nLow; k++) thetas.push(-Math.PI / 2 + (k / nLow) * (Math.PI / 2));
  for (let k = 1; k <= nUp; k++) thetas.push((k / nUp) * (Math.PI / 2));
  const top = thetas.length - 1, seam = nLow + kS;
  // anneau complet : indices dans thetas + côté
  const ringR = [], ringT = [], ringL = [];
  for (let k = 0; k <= seam; k++) ringR.push([k, 1]);
  for (let k = seam; k <= top; k++) ringT.push([k, 1]);
  for (let k = top - 1; k >= seam; k--) ringT.push([k, -1]);
  for (let k = seam; k >= 0; k--) ringL.push([k, -1]);
  const pos = [], uv = [], col = [], idx = [];
  const p = {}, o = [0, 0];
  // découpe sous l'habitacle (détail complet seulement) : demi-largeur limite par station
  const st = shape.st;
  const cut = lod ? null : stations.map((t) => (t > st.ws + 0.025 && t < st.rearB - 0.02 ? shape.cabSection(t).wc - 0.045 : 0));
  // positions par station (calculées une fois)
  const grid = stations.map((t) => thetas.map((th) => {
    shape.sectionPoint(t, th, p);
    return [p.x, p.y, p.z, p.bot, th];
  }));
  const patch = (ring, region) => {
    const base = pos.length / 3, M = ring.length;
    stations.forEach((t, si) => {
      for (const [k, side] of ring) {
        const [x, y, z, bot, th] = grid[si][k];
        pos.push(x * side, y, z);
        if (region === 'top') atlas.top(z, x * side, o);
        else atlas.side(z, y, side > 0, o);
        uv.push(o[0], o[1]);
        let c = 1;
        if (y < bot + 0.05 && th < -0.9) c = 0.1; // dessous
        else if (y < bot + 0.025) c = 0.35;
        col.push(c, c, c);
      }
      if (si > 0) {
        const a0 = base + (si - 1) * M, b0 = base + si * M;
        const cutRow = region === 'top' && cut && cut[si - 1] && cut[si];
        for (let k = 0; k < M - 1; k++) {
          // dessus de caisse sous l'habitacle : ouvert (on voit l'intérieur à travers les vitres)
          if (cutRow) {
            const lim = Math.min(cut[si - 1], cut[si]);
            const xa = Math.abs(grid[si][ring[k][0]][0]), xb = Math.abs(grid[si][ring[k + 1][0]][0]);
            const xc = Math.abs(grid[si - 1][ring[k][0]][0]), xd = Math.abs(grid[si - 1][ring[k + 1][0]][0]);
            if (Math.max(xa, xb, xc, xd) < lim) continue;
          }
          pushQuad(idx, a0 + k, a0 + k + 1, b0 + k + 1, b0 + k);
        }
      }
    });
  };
  patch(ringR, 'right');
  patch(ringT, 'top');
  patch(ringL, 'left');
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  // Arêtes vives (ligne d'épaule, bords de capot) : normales lissées sous 26°
  const creased = toCreasedNormals(g, (26 * Math.PI) / 180);
  fixNormals(creased);
  return creased;
}

// ---------------------------------------------------------------------------
// Habitacle : grille (stations × rangées) dont les rangées suivent la ceinture, le bas et le haut
// des vitres, le montant et le bord du vitrage central. Les vitres sont des blocs exacts de la grille ;
// les encadrements (bandes aux coins arrondis) recouvrent les bords.
// ---------------------------------------------------------------------------
const SB = 0.04, G_TOP = 0.022, G_ARC = 0.03;

// Rangées (abscisses curvilignes) du côté droit pour une section
function cabRows(sec, nSide, nArc) {
  const { sR, S } = sec;
  const gb = Math.min(SB, sR * 0.3);
  const gt = Math.max(gb, sR - G_TOP);
  const ae = Math.min(sR + G_ARC, sR + (S - sR) * 0.4);
  const rows = [0, gb];
  for (let i = 1; i < nSide; i++) rows.push(lerp(gb, gt, i / nSide));
  rows.push(gt, sR, ae);
  for (let i = 1; i < nArc; i++) {
    const u = i / nArc;
    rows.push(lerp(ae, S, 1 - Math.cos(u * Math.PI / 2) * 0.15 - (1 - u) * 0.85));
  }
  rows.push(S);
  return rows;
}

// Disposition des vitrages d'un style (intervalles en t)
export function windowLayout(shape) {
  const st = shape.st, L = shape.L;
  const hAt = (t) => Math.max(0, shape.roof(t) - shape.belt);
  const tm = (m) => m / L;
  let tA = st.ws;
  while (tA < st.roofF && hAt(tA) < 0.11) tA += 0.002;
  let tC = st.rearB;
  while (tC > st.roofB && hAt(tC) < 0.1) tC -= 0.002;
  const scale = L / 4.4;
  const zDoor = shape.zOf(st.ws) - 0.06;
  const blackB = st.bPillar !== 'body';
  const gapB = tm(blackB ? 0.03 : 0.075);
  const side = [];
  if (st.doors === 4) {
    let tB = shape.tOf(zDoor + 1.02 * scale);
    tB = clamp(tB, st.roofF + 0.05, st.roofB - 0.08);
    side.push({ t0: tA, t1: tB - gapB / 2, r: [0.012, 0.03, 0.025, 0.012] });
    let tRD = Math.min(tC, shape.tOf(shape.zOf(tB) + 0.92 * scale));
    side.push({ t0: tB + gapB / 2, t1: tRD - (tRD < tC - 0.03 ? tm(0.004) : 0), r: [0.012, 0.025, 0.06, 0.012] });
    if (st.quarter && tC - tRD > tm(0.16)) side.push({ t0: tRD + gapB, t1: tC, r: [0.012, 0.02, 0.09, 0.015] });
  } else {
    let tB = shape.tOf(zDoor + (st.doors === 0 ? 0.9 : 1.18) * scale);
    tB = clamp(tB, st.roofF + 0.04, Math.min(st.roofB - 0.01, tC));
    const quarter = st.quarter && !st.softTop && tC - tB > tm(0.2);
    side.push({ t0: tA, t1: quarter ? tB : Math.min(tB, tC), r: [0.012, 0.03, quarter ? 0.03 : 0.07, 0.012] });
    if (quarter) side.push({ t0: tB + gapB, t1: tC, r: [0.012, 0.03, 0.1, 0.015] });
  }
  const shield = { t0: st.ws + 0.001, t1: st.roofF - tm(0.012) };
  let back = null;
  if (!st.softTop && st.doors !== 0) back = { t0: st.roofB + tm(0.015), t1: st.rearB - tm(st.rearB > 0.95 ? 0.02 : 0.012) };
  if (st.doors === 0) back = null;
  let roofPanel = null;
  if (st.carbonRoof) roofPanel = { t0: st.roofF + tm(0.03), t1: st.roofB - tm(0.03), kind: 'carbon' };
  return { side, shield, back, roofPanel, tA, tC };
}

// Construit les géométries de l'habitacle : coque peinte, vitrages, partie spéciale (carbone / capote), encadrements
export function buildCabin(shape, atlas, lod = 0) {
  const st = shape.st, L = shape.L;
  const lay = windowLayout(shape);
  const nSide = lod ? 1 : 3, nArc = lod ? 3 : 6;
  // stations : base régulière + limites des vitrages
  const tset = [];
  const nS = lod ? 14 : 40;
  for (let i = 0; i <= nS; i++) tset.push(lerp(st.ws, st.rearB, i / nS));
  const marks = [lay.shield.t0, lay.shield.t1, st.roofF, st.roofB];
  for (const w of lay.side) marks.push(w.t0, w.t1);
  if (lay.back) marks.push(lay.back.t0, lay.back.t1);
  if (lay.roofPanel) marks.push(lay.roofPanel.t0, lay.roofPanel.t1);
  for (const m of marks) tset.push(m);
  tset.sort((a, b) => a - b);
  const ts = tset.filter((t, i) => i === 0 || t - tset[i - 1] > 0.0015);
  const jRows = cabRows(shape.cabSection(ts[0]), nSide, nArc).length;
  const jGB = 1, jGT = 1 + nSide, jRail = jGT + 1, jAE = jRail + 1, jC = jRows - 1;
  const nJ = 2 * jC + 1; // rangées de l'anneau complet
  // positions de la grille
  const P = new Float32Array(ts.length * nJ * 3);
  const tmp = {};
  ts.forEach((t, i) => {
    const sec = shape.cabSection(t);
    const rows = cabRows(sec, nSide, nArc);
    for (let J = 0; J < nJ; J++) {
      const j = J <= jC ? J : 2 * jC - J;
      shape.cabPoint(sec, rows[j], tmp);
      const o = (i * nJ + J) * 3;
      P[o] = J <= jC ? tmp.x : -tmp.x; P[o + 1] = tmp.y; P[o + 2] = tmp.z;
    }
  });
  // normales par différences centrées sur la grille
  const Nn = new Float32Array(P.length);
  const at = (i, J, c) => P[(i * nJ + J) * 3 + c];
  for (let i = 0; i < ts.length; i++) {
    for (let J = 0; J < nJ; J++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(ts.length - 1, i + 1);
      const J0 = Math.max(0, J - 1), J1 = Math.min(nJ - 1, J + 1);
      const ax = at(i1, J, 0) - at(i0, J, 0), ay = at(i1, J, 1) - at(i0, J, 1), az = at(i1, J, 2) - at(i0, J, 2);
      const bx = at(i, J1, 0) - at(i, J0, 0), by = at(i, J1, 1) - at(i, J0, 1), bz = at(i, J1, 2) - at(i, J0, 2);
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      // vers l'extérieur
      const px = at(i, J, 0), py = at(i, J, 1) - shape.belt + 0.4;
      if (nx * px + ny * py < 0) { nx = -nx; ny = -ny; nz = -nz; }
      let l = Math.hypot(nx, ny, nz);
      // sommet dégénéré (section écrasée) : normale vers l'extérieur
      if (!(l > 1e-10)) { nx = px; ny = py; nz = 0; l = Math.hypot(nx, ny) || 1; }
      const o = (i * nJ + J) * 3;
      Nn[o] = nx / l; Nn[o + 1] = ny / l; Nn[o + 2] = nz / l;
    }
  }
  // classement des cellules
  const inSide = (tm) => lay.side.some((w) => tm > w.t0 && tm < w.t1);
  const inC = (r, tm) => r && tm > r.t0 && tm < r.t1;
  const cellKind = (i, J) => {
    const tm = (ts[i] + ts[i + 1]) / 2;
    const j = J < jC ? J : 2 * jC - J - 1; // rangée basse (côté droit) de la cellule
    const central = j >= jAE;
    if (j >= jGB && j < jGT && inSide(tm)) return 'glass';
    if (st.softTop && tm > lay.side[0].t1 + 0.004 && j >= jGB) return 'fabric';
    if (central) {
      if (inC(lay.shield, tm) || inC(lay.back, tm)) return 'glass';
      if (inC(lay.roofPanel, tm)) return 'special';
    }
    return 'paint';
  };
  const region = (J) => (J < jRail ? 'right' : J < 2 * jC - jRail ? 'top' : 'left');
  const buckets = {};
  const o2 = [0, 0];
  const emit = (kind, i, J, reg, off) => {
    const b = buckets[kind] || (buckets[kind] = { pos: [], nor: [], uv: [], idx: [], map: new Map() });
    const key = i * 4096 + J * 4 + (reg === 'right' ? 0 : reg === 'top' ? 1 : 2);
    let v = b.map.get(key);
    if (v !== undefined) return v;
    const o = (i * nJ + J) * 3;
    const nx = Nn[o], ny = Nn[o + 1], nz = Nn[o + 2];
    const x = P[o] + nx * off, y = P[o + 1] + ny * off, z = P[o + 2] + nz * off;
    b.pos.push(x, y, z);
    b.nor.push(nx, ny, nz);
    if (reg === 'top') atlas.top(z, x, o2); else atlas.side(z, y, reg === 'right', o2);
    b.uv.push(o2[0], o2[1]);
    v = b.pos.length / 3 - 1;
    b.map.set(key, v);
    return v;
  };
  for (let i = 0; i < ts.length - 1; i++) {
    for (let J = 0; J < nJ - 1; J++) {
      const kind = cellKind(i, J);
      const reg = region(J);
      const off = kind === 'glass' ? -0.004 : 0;
      const a = emit(kind, i, J, reg, off), b = emit(kind, i, J + 1, reg, off);
      const c = emit(kind, i + 1, J + 1, reg, off), d = emit(kind, i + 1, J, reg, off);
      buckets[kind].idx.push(a, b, d, b, c, d);
    }
  }
  const out = {};
  for (const [k, b] of Object.entries(buckets)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    g.setIndex(b.idx);
    out[k] = g;
  }
  out.layout = lay;
  if (!lod) out.frames = buildFrames(shape, lay, nSide, nArc);
  return out;
}

// Encadrements des vitrages : bandes posées sur la surface de l'habitacle. Contour extérieur légèrement
// hors de la vitre (cache la jonction peinture / verre), contour intérieur aux coins arrondis.
// Coordonnées locales (a = t·L en mètres, λ ∈ [0, 1] en travers de la vitre).
function buildFrames(shape, lay, nSide, nArc) {
  const st = shape.st, L = shape.L;
  const wF = st.frameW;
  const rowsAt = (t) => {
    const sec = shape.cabSection(t);
    return { sec, rows: cabRows(sec, nSide, nArc) };
  };
  // Hauteur (m) en travers de la vitre et point de surface
  const hgtAt = (kind, t) => {
    const { sec, rows } = rowsAt(clamp(t, st.ws, st.rearB));
    if (kind === 'side') return Math.max(0.005, rows[1 + nSide] - rows[1]);
    return Math.max(0.005, 2 * (sec.S - rows[nSide + 3]));
  };
  const q = {};
  const surf = (kind, t, lam) => {
    const { sec, rows } = rowsAt(clamp(t, st.ws, st.rearB));
    if (kind === 'side') {
      shape.cabPoint(sec, rows[1] + lam * (rows[1 + nSide] - rows[1]), q);
      return [q.x, q.y, q.z];
    }
    const sigE = sec.S - rows[nSide + 3];
    const sig = sigE * (2 * lam - 1);
    shape.cabPoint(sec, sec.S - Math.abs(sig), q);
    return [sig >= 0 ? q.x : -q.x, q.y, q.z];
  };
  const build = (bands) => {
    const pos = [], nor = [], idx = [];
    const push = (kind, a, lam, off) => {
      const t = a / L;
      const p = surf(kind, t, lam);
      const pa = surf(kind, t + 0.002, lam), pb = surf(kind, t - 0.002, lam);
      const pc = surf(kind, t, lam + 0.01), pd = surf(kind, t, lam - 0.01);
      const ax = pa[0] - pb[0], ay = pa[1] - pb[1], az = pa[2] - pb[2];
      const bx = pc[0] - pd[0], by = pc[1] - pd[1], bz = pc[2] - pd[2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      if (nx * p[0] + ny * (p[1] - shape.belt + 0.4) < 0) { nx = -nx; ny = -ny; nz = -nz; }
      let l = Math.hypot(nx, ny, nz);
      if (!(l > 1e-10)) { nx = p[0]; ny = p[1] - shape.belt + 0.4; nz = 0; l = Math.hypot(nx, ny) || 1; }
      nx /= l; ny /= l; nz /= l;
      pos.push(p[0] + nx * off, p[1] + ny * off, p[2] + nz * off);
      nor.push(nx, ny, nz);
    };
    for (const { kind, t0, t1, ins, rad } of bands) {
      const A0 = t0 * L, A1 = t1 * L;
      // nombre de points par bord (identique pour les deux contours)
      const nA = Math.max(2, Math.round((A1 - A0) / 0.05));
      const nL0 = Math.max(2, Math.round(hgtAt(kind, t0) / 0.05)), nL1 = Math.max(2, Math.round(hgtAt(kind, t1) / 0.05));
      const contour = (inset, radii, nC) => {
        const a0 = A0 + inset[1], a1 = A1 - inset[3];
        const lam0 = (a) => inset[0] / hgtAt(kind, a / L);
        const lam1 = (a) => 1 - inset[2] / hgtAt(kind, a / L);
        const span = Math.max(0.01, a1 - a0);
        // coins dans l'ordre (a0,λ0) → (a0,λ1) → (a1,λ1) → (a1,λ0), arcs décroissants de π/2
        const C = [
          { a: a0, hi: false, sa: 1, r: radii[0], g: [1.5 * Math.PI, Math.PI] },
          { a: a0, hi: true, sa: 1, r: radii[1], g: [Math.PI, 0.5 * Math.PI] },
          { a: a1, hi: true, sa: -1, r: radii[2], g: [0.5 * Math.PI, 0] },
          { a: a1, hi: false, sa: -1, r: radii[3], g: [0, -0.5 * Math.PI] },
        ];
        const nEdge = [nL0, nA, nL1, nA];
        const pts = [];
        const arcPt = (c, g) => {
          const hg = hgtAt(kind, c.a / L);
          const ra = Math.min(c.r, span * 0.45);
          const lamC = c.hi ? lam1(c.a) : lam0(c.a);
          const rl = Math.min(c.r / hg, Math.abs(lam1(c.a) - lam0(c.a)) * 0.45);
          const ca = c.a + c.sa * ra, cl = lamC + (c.hi ? -rl : rl);
          return [ca + Math.cos(g) * ra, cl + Math.sin(g) * rl];
        };
        for (let k = 0; k < 4; k++) {
          const c = C[k], cn = C[(k + 1) % 4];
          for (let i = 0; i <= nC; i++) pts.push(arcPt(c, lerp(c.g[0], c.g[1], i / nC)));
          const e0 = arcPt(c, c.g[1]), e1 = arcPt(cn, cn.g[0]);
          const ne = nEdge[k];
          for (let i = 1; i < ne; i++) {
            const u = i / ne;
            const a = lerp(e0[0], e1[0], u);
            let lam = lerp(e0[1], e1[1], u);
            if (k === 1) lam = lam1(a); else if (k === 3) lam = lam0(a);
            pts.push([a, lam]);
          }
        }
        return pts;
      };
      const inner = contour(ins, rad, 5);
      const outer = contour([-0.008, -0.008, -0.008, -0.008], [0.004, 0.004, 0.004, 0.004], 5);
      const n = inner.length;
      const base = pos.length / 3;
      for (const [a, lam] of outer) push(kind, a, lam, 0.0022);
      for (const [a, lam] of inner) push(kind, a, lam, 0.003);
      const tris = [];
      for (let i = 0; i < n; i++) {
        const i1 = (i + 1) % n;
        tris.push([base + i, base + i1, base + n + i]);
        tris.push([base + i1, base + n + i1, base + n + i]);
      }
      // orientation : la normale géométrique doit suivre la normale de surface
      const [a, b, c] = tris[0];
      const P = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
      const pa = P(a), pb = P(b), pc = P(c);
      const ux = pb[0] - pa[0], uy = pb[1] - pa[1], uz = pb[2] - pa[2];
      const vx = pc[0] - pa[0], vy = pc[1] - pa[1], vz = pc[2] - pa[2];
      const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
      const flip = gx * nor[a * 3] + gy * nor[a * 3 + 1] + gz * nor[a * 3 + 2] < 0;
      for (const [x, y, z] of tris) flip ? idx.push(x, z, y) : idx.push(x, y, z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
  };
  const sides = build(lay.side.map((w) => ({ kind: 'side', t0: w.t0, t1: w.t1, ins: [0.012, wF * 0.9, wF, wF], rad: w.r })));
  const centers = [{ kind: 'center', t0: lay.shield.t0, t1: lay.shield.t1, ins: [wF * 1.1, 0.02, wF * 1.1, wF * 1.7], rad: [0.02, 0.02, 0.05, 0.05] }];
  if (lay.back) centers.push({ kind: 'center', t0: lay.back.t0, t1: lay.back.t1, ins: [wF * 1.1, wF * 1.4, wF * 1.1, wF * 1.2], rad: [0.05, 0.05, 0.04, 0.04] });
  return mergeGeometries([sides, mirrorGeometry(sides), build(centers)], false);
}

// ---------------------------------------------------------------------------
// Projection sur la carrosserie : décalques qui épousent exactement la surface
// (grille d'accélération par direction de projection)
// ---------------------------------------------------------------------------
export class SurfaceProjector {
  constructor(geo) {
    const pos = geo.attributes.position.array, nrm = geo.attributes.normal.array;
    const idx = geo.index ? geo.index.array : null;
    const n = (idx ? idx.length : pos.length / 3) / 3;
    this.n = n;
    this.P = new Float32Array(n * 9);
    this.N = new Float32Array(n * 9);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 3; k++) {
        const vi = idx ? idx[i * 3 + k] : i * 3 + k;
        for (let c = 0; c < 3; c++) {
          this.P[i * 9 + k * 3 + c] = pos[vi * 3 + c];
          this.N[i * 9 + k * 3 + c] = nrm[vi * 3 + c];
        }
      }
    }
    this.frames = new Map();
  }

  frame(d) {
    const key = `${d.x.toFixed(3)},${d.y.toFixed(3)},${d.z.toFixed(3)}`;
    let f = this.frames.get(key);
    if (f) return f;
    const u = Math.abs(d.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0).cross(d);
    u.addScaledVector(d, -u.dot(d)).normalize();
    const v = new THREE.Vector3().crossVectors(d, u).normalize();
    const P = this.P, n = this.n;
    const bb = new Float32Array(n * 4);
    let U0 = Infinity, U1 = -Infinity, V0 = Infinity, V1 = -Infinity;
    for (let i = 0; i < n; i++) {
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (let k = 0; k < 3; k++) {
        const o = i * 9 + k * 3;
        const pu = P[o] * u.x + P[o + 1] * u.y + P[o + 2] * u.z;
        const pv = P[o] * v.x + P[o + 1] * v.y + P[o + 2] * v.z;
        if (pu < u0) u0 = pu; if (pu > u1) u1 = pu;
        if (pv < v0) v0 = pv; if (pv > v1) v1 = pv;
      }
      bb[i * 4] = u0 - 1e-5; bb[i * 4 + 1] = u1 + 1e-5; bb[i * 4 + 2] = v0 - 1e-5; bb[i * 4 + 3] = v1 + 1e-5;
      if (u0 < U0) U0 = u0; if (u1 > U1) U1 = u1; if (v0 < V0) V0 = v0; if (v1 > V1) V1 = v1;
    }
    // grille : liste des triangles par case
    const cs = 0.05;
    const gw = Math.max(1, Math.ceil((U1 - U0) / cs)), gh = Math.max(1, Math.ceil((V1 - V0) / cs));
    const counts = new Uint32Array(gw * gh + 1);
    const span = (i) => [
      clamp(Math.floor((bb[i * 4] - U0) / cs), 0, gw - 1), clamp(Math.floor((bb[i * 4 + 1] - U0) / cs), 0, gw - 1),
      clamp(Math.floor((bb[i * 4 + 2] - V0) / cs), 0, gh - 1), clamp(Math.floor((bb[i * 4 + 3] - V0) / cs), 0, gh - 1),
    ];
    for (let i = 0; i < n; i++) {
      const [x0, x1, y0, y1] = span(i);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) counts[y * gw + x + 1]++;
    }
    for (let c = 1; c <= gw * gh; c++) counts[c] += counts[c - 1];
    const items = new Uint32Array(counts[gw * gh]);
    const fill = counts.slice(0, gw * gh);
    for (let i = 0; i < n; i++) {
      const [x0, x1, y0, y1] = span(i);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) items[fill[y * gw + x]++] = i;
    }
    f = { d: d.clone(), u, v, bb, U0, V0, cs, gw, gh, start: counts, items };
    this.frames.set(key, f);
    return f;
  }

  // Premier impact du rayon (o, f.d) : position et normale lissée
  cast(o, f, out) {
    const { d, u, v, bb } = f, P = this.P;
    const ou = o.x * u.x + o.y * u.y + o.z * u.z, ov = o.x * v.x + o.y * v.y + o.z * v.z;
    const cx = Math.floor((ou - f.U0) / f.cs), cy = Math.floor((ov - f.V0) / f.cs);
    if (cx < 0 || cy < 0 || cx >= f.gw || cy >= f.gh) return null;
    const c = cy * f.gw + cx;
    let best = Infinity, bi = -1, bu = 0, bv = 0;
    for (let q = f.start[c], qe = f.start[c + 1]; q < qe; q++) {
      const i = f.items[q];
      const b = i * 4;
      if (ou < bb[b] || ou > bb[b + 1] || ov < bb[b + 2] || ov > bb[b + 3]) continue;
      const o0 = i * 9;
      const ax = P[o0], ay = P[o0 + 1], az = P[o0 + 2];
      const e1x = P[o0 + 3] - ax, e1y = P[o0 + 4] - ay, e1z = P[o0 + 5] - az;
      const e2x = P[o0 + 6] - ax, e2y = P[o0 + 7] - ay, e2z = P[o0 + 8] - az;
      const px = d.y * e2z - d.z * e2y, py = d.z * e2x - d.x * e2z, pz = d.x * e2y - d.y * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-14) continue;
      const inv = 1 / det;
      const tx = o.x - ax, ty = o.y - ay, tz = o.z - az;
      const uu = (tx * px + ty * py + tz * pz) * inv;
      if (uu < -1e-7 || uu > 1 + 1e-7) continue;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
      const vv = (d.x * qx + d.y * qy + d.z * qz) * inv;
      if (vv < -1e-7 || uu + vv > 1 + 1e-7) continue;
      const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (tt > 0 && tt < best) { best = tt; bi = i; bu = uu; bv = vv; }
    }
    if (bi < 0) return null;
    out.p.copy(o).addScaledVector(d, best);
    const N = this.N, o0 = bi * 9, w0 = 1 - bu - bv;
    out.n.set(
      N[o0] * w0 + N[o0 + 3] * bu + N[o0 + 6] * bv,
      N[o0 + 1] * w0 + N[o0 + 4] * bu + N[o0 + 7] * bv,
      N[o0 + 2] * w0 + N[o0 + 5] * bu + N[o0 + 8] * bv,
    ).normalize();
    if (out.n.dot(d) > 0) out.n.negate();
    return out;
  }
}

// Décalque projeté : contour (superellipse, trapèze ou polygone étoilé) centré en c dans le plan (a1, a2),
// projeté selon dir puis décollé de « off » le long de la normale. hole > 0 : anneau.
export function decalGeometry(proj, o) {
  const f = proj.frame(o.dir);
  const n = o.n ?? 2, rot = o.rot ?? 0, taper = o.taper ?? 0, off = o.off ?? 0.004;
  const hole = o.hole ?? 0;
  const rings = o.rings ?? (hole ? 2 : 4), seg = o.seg ?? 36;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const outline = (phi) => {
    const c = Math.cos(phi), si = Math.sin(phi);
    if (o.pts) {
      // polygone étoilé (coordonnées normalisées) : intersection du rayon avec le contour
      const pts = o.pts;
      let best = 1;
      for (let k = 0; k < pts.length; k++) {
        const [x0, y0] = pts[k], [x1, y1] = pts[(k + 1) % pts.length];
        const ex = x1 - x0, ey = y1 - y0;
        const den = c * ey - si * ex;
        if (Math.abs(den) < 1e-9) continue;
        const s = (x0 * ey - y0 * ex) / den;
        const w = (x0 * si - y0 * c) / den;
        if (s > 0 && w >= -1e-6 && w <= 1 + 1e-6) { best = s; break; }
      }
      return [c * best, si * best];
    }
    let x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    let y = Math.sign(si) * Math.pow(Math.abs(si), 2 / n);
    if (o.top !== undefined && y > 0) x *= lerp(1, o.top, y);
    return [x, y];
  };
  const shape2 = (phi, s) => {
    const [ux, uy] = outline(phi);
    let x = o.a * ux * s, y = o.b * uy * s;
    y *= 1 + taper * (x / o.a);
    return [x, y, x * cr - y * sr, x * sr + y * cr];
  };
  const origin = new THREE.Vector3();
  const hit = { p: new THREE.Vector3(), n: new THREE.Vector3() };
  const castAt = (xr, yr) => {
    origin.copy(o.c).addScaledVector(o.a1, xr).addScaledVector(o.a2, yr).addScaledVector(o.dir, -2.5);
    return proj.cast(origin, f, hit);
  };
  const pos = [], nor = [], uv = [], idx = [];
  const ur = o.uvRect;
  const pushV = (x, y, xr, yr) => {
    if (!castAt(xr, yr)) return false;
    pos.push(hit.p.x + hit.n.x * off, hit.p.y + hit.n.y * off, hit.p.z + hit.n.z * off);
    nor.push(hit.n.x, hit.n.y, hit.n.z);
    if (o.uvScale) uv.push(xr * o.uvScale, yr * o.uvScale);
    else {
      let uu = 0.5 + x / (2 * o.a), vv = 0.5 + y / (2 * o.b);
      if (o.flipU) uu = 1 - uu;
      if (ur) { uu = lerp(ur[0], ur[2], uu); vv = lerp(ur[1], ur[3], vv); }
      uv.push(uu, vv);
    }
    return true;
  };
  if (!hole && !pushV(0, 0, 0, 0)) return null;
  if (hole && !castAt(0, 0)) return null;
  const s0 = hole || 0;
  for (let j = 0; j < seg; j++) {
    const phi = (j / seg) * Math.PI * 2;
    let sMax = 1;
    let q = shape2(phi, 1);
    if (!castAt(q[2], q[3])) {
      let lo = 0, hi = 1;
      for (let k = 0; k < 8; k++) {
        const mid = (lo + hi) / 2;
        q = shape2(phi, mid);
        if (castAt(q[2], q[3])) lo = mid; else hi = mid;
      }
      sMax = lo;
    }
    for (let r = hole ? 0 : 1; r <= rings; r++) {
      const s = hole ? lerp(s0, 1, r / rings) * sMax : (sMax * r) / rings;
      q = shape2(phi, s);
      if (!pushV(q[0], q[1], q[2], q[3])) {
        if (pos.length < 3) return null;
        pos.push(...pos.slice(-3)); nor.push(...nor.slice(-3)); uv.push(...uv.slice(-2));
      }
    }
  }
  const flip = new THREE.Vector3().crossVectors(o.a1, o.a2).dot(o.dir) > 0;
  const tri = (a, b, c) => (flip ? idx.push(a, c, b) : idx.push(a, b, c));
  if (hole) {
    const R = rings + 1;
    const vid = (j, r) => (j % seg) * R + r;
    for (let j = 0; j < seg; j++) {
      for (let r = 0; r < rings; r++) {
        const a = vid(j, r), b = vid(j + 1, r), c = vid(j + 1, r + 1), d = vid(j, r + 1);
        tri(a, d, c);
        tri(a, c, b);
      }
    }
  } else {
    const vid = (j, r) => 1 + (j % seg) * rings + (r - 1);
    for (let j = 0; j < seg; j++) {
      tri(0, vid(j, 1), vid(j + 1, 1));
      for (let r = 1; r < rings; r++) {
        const a = vid(j, r), b = vid(j + 1, r), c = vid(j + 1, r + 1), d = vid(j, r + 1);
        tri(a, d, c);
        tri(a, c, b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (o.col) {
    const cc = new Float32Array(pos.length);
    for (let i = 0; i < cc.length; i += 3) { cc[i] = o.col[0]; cc[i + 1] = o.col[1]; cc[i + 2] = o.col[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  }
  g.setIndex(idx);
  return g;
}

export function mirrorGeometry(g) {
  const m = g.clone();
  const pa = m.attributes.position, na = m.attributes.normal;
  for (let i = 0; i < pa.count; i++) {
    pa.setX(i, -pa.getX(i));
    if (na) na.setX(i, -na.getX(i));
  }
  if (m.index) {
    const idx = m.index.array;
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  } else {
    // non indexée : permuter les sommets 2 et 3 de chaque triangle
    for (const name of Object.keys(m.attributes)) {
      const a = m.attributes[name], s = a.itemSize, arr = a.array;
      for (let i = 0; i < a.count; i += 3) {
        for (let c = 0; c < s; c++) { const t = arr[(i + 1) * s + c]; arr[(i + 1) * s + c] = arr[(i + 2) * s + c]; arr[(i + 2) * s + c] = t; }
      }
    }
  }
  return m;
}
