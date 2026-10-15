// Géométrie de circuit : tracé « tortue » (lignes droites + arcs), lissage de courbure
// (raccordements progressifs type clothoïde), fermeture exacte de la boucle, profil
// d'altitude, dévers, zones de dégagement, murs, vibreurs, requêtes de sol.
// Module pur (sans rendu) : utilisé par la physique, l'IA, le rendu et les tests.

import { Vector3 } from 'three';
import { SURFACES } from '../physics/vehicle.js';
import { clamp, lerp, sampleKeys, smoothstep, rad } from '../core/utils.js';

const FINE = 0.5; // pas d'intégration (m)
export const SPACING = 2; // pas des échantillons finaux (m)

function boxFilter(arr, half, closed) {
  const n = arr.length;
  const out = new Float64Array(n);
  const width = half * 2 + 1;
  if (closed) {
    let acc = 0;
    for (let k = -half; k <= half; k++) acc += arr[((k % n) + n) % n];
    for (let i = 0; i < n; i++) {
      out[i] = acc / width;
      acc += arr[(i + half + 1) % n] - arr[(((i - half) % n) + n) % n];
    }
  } else {
    for (let i = 0; i < n; i++) {
      let acc = 0, c = 0;
      for (let k = Math.max(0, i - half); k <= Math.min(n - 1, i + half); k++) { acc += arr[k]; c++; }
      out[i] = acc / c;
    }
  }
  return out;
}

export class Track {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.closed = def.closed !== false;
    this.width = def.width;
    this.halfWidth = def.width / 2;
    this.build();
  }

  // ------------------------------------------------------------------
  integrate(segs) {
    const def = this.def;
    const kap = [], bank = [], segStart = [];
    for (let si = 0; si < segs.length; si++) {
      const sg = segs[si];
      segStart.push(kap.length);
      if (sg.s !== undefined) {
        const n = Math.max(1, Math.round(sg.s / FINE));
        for (let i = 0; i < n; i++) { kap.push(0); bank.push(0); }
      } else {
        const ang = rad(sg.a);
        const len = sg.r * Math.abs(ang);
        const n = Math.max(1, Math.round(len / FINE));
        const k = ang / (n * FINE);
        const b = rad(sg.bank || 0) * Math.sign(ang);
        for (let i = 0; i < n; i++) { kap.push(k); bank.push(b); }
      }
    }
    const half = Math.round((def.smooth ?? 24) / FINE / 2);
    let ks = boxFilter(kap, half, this.closed);
    ks = boxFilter(ks, half, this.closed);
    let bs = boxFilter(bank, half * 2, this.closed);
    bs = boxFilter(bs, half, this.closed);
    const n = ks.length;
    const xs = new Float64Array(n + 1), zs = new Float64Array(n + 1), th = new Float64Array(n + 1);
    xs[0] = def.start?.x ?? 0;
    zs[0] = def.start?.z ?? 0;
    th[0] = rad(def.start?.heading ?? 0);
    for (let i = 0; i < n; i++) {
      const tm = th[i] + ks[i] * FINE * 0.5;
      xs[i + 1] = xs[i] + Math.sin(tm) * FINE;
      zs[i + 1] = zs[i] - Math.cos(tm) * FINE;
      th[i + 1] = th[i] + ks[i] * FINE;
    }
    return { xs, zs, th, ks, bs, n, segStart };
  }

  // Convertit un polygone [[x, z, rayon, dévers?], ...] en segments droites + arcs.
  static polygonToSegments(points, closed) {
    const n = points.length;
    const P = points.map((p) => ({ x: p[0], z: p[1], r: p[2] || 0, bank: p[3] || 0 }));
    const head = (a, b) => Math.atan2(b.x - a.x, -(b.z - a.z));
    const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a <= -Math.PI) a += 2 * Math.PI; return a; };
    const turn = new Array(n).fill(0), tlen = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      if (!closed && (i === 0 || i === n - 1)) continue;
      const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n];
      turn[i] = wrap(head(b, c) - head(a, b));
      tlen[i] = b.r * Math.tan(Math.abs(turn[i]) / 2);
    }
    const segs = [];
    const edges = closed ? n : n - 1;
    for (let e = 0; e < edges; e++) {
      const a = P[e], b = P[(e + 1) % n];
      const len = Math.hypot(b.x - a.x, b.z - a.z) - tlen[e] - tlen[(e + 1) % n];
      segs.push({ s: len });
      const v = (e + 1) % n;
      if (Math.abs(turn[v]) > 1e-6) segs.push({ a: (turn[v] * 180) / Math.PI, r: P[v].r, bank: P[v].bank });
    }
    const a0 = P[0], a1 = P[1 % n];
    const h0 = head(a0, a1);
    const start = {
      x: a0.x + Math.sin(h0) * tlen[0],
      z: a0.z - Math.cos(h0) * tlen[0],
      heading: (h0 * 180) / Math.PI,
    };
    // Deux plus longues droites non parallèles pour la fermeture exacte
    const straights = segs.map((s, i) => ({ i, s: s.s })).filter((x) => x.s !== undefined).sort((p, q) => q.s - p.s);
    return { segs, start, straights };
  }

  build() {
    const def = this.def;
    if (def.polygon) {
      const res = Track.polygonToSegments(def.polygon, this.closed);
      def.segments = res.segs;
      def.start = res.start;
      if (this.closed && !def.adjust) {
        // Cherche deux droites longues d'orientations différentes
        const hd = [];
        let th = res.start.heading;
        for (const sg of res.segs) { hd.push(th); if (sg.a !== undefined) th += sg.a; }
        const cand = res.straights;
        let pair = null;
        for (let x = 0; x < cand.length && !pair; x++)
          for (let y = x + 1; y < cand.length && !pair; y++) {
            const d = Math.abs(Math.sin(((hd[cand[x].i] - hd[cand[y].i]) * Math.PI) / 180));
            if (d > 0.5) pair = [cand[x].i, cand[y].i];
          }
        def.adjust = pair;
      }
      if (res.segs.some((sg) => sg.s !== undefined && sg.s < 0)) {
        this.polygonError = res.segs.map((sg, i) => [i, sg.s]).filter((x) => x[1] !== undefined && x[1] < 0);
      }
    }
    const segs = def.segments.map((s) => ({ ...s }));
    let r = this.integrate(segs);
    if (this.closed && def.adjust) {
      for (let iter = 0; iter < 3; iter++) {
        const gx = r.xs[r.n] - r.xs[0];
        const gz = r.zs[r.n] - r.zs[0];
        const [i1, i2] = def.adjust;
        const t1 = r.th[r.segStart[i1]], t2 = r.th[r.segStart[i2]];
        const d1x = Math.sin(t1), d1z = -Math.cos(t1);
        const d2x = Math.sin(t2), d2z = -Math.cos(t2);
        const det = d1x * d2z - d1z * d2x;
        if (Math.abs(det) < 1e-3) throw new Error(`${def.id}: lignes droites d'ajustement parallèles`);
        // a*d1 + b*d2 = -g
        const a = (-gx * d2z + gz * d2x) / det;
        const b = (-d1x * gz + d1z * gx) / det;
        segs[i1].s += a;
        segs[i2].s += b;
        if (segs[i1].s < 5 || segs[i2].s < 5) {
          this.closureError = { a, b, s1: segs[i1].s, s2: segs[i2].s };
        }
        r = this.integrate(segs);
      }
    }
    this.segments = segs;
    const totalFine = r.n * FINE;
    const N = Math.max(8, Math.round(totalFine / SPACING));
    const sp = totalFine / N;
    this.length = totalFine;
    this.spacing = sp;
    const count = this.closed ? N : N + 1;
    this.count = count;

    const A = (len) => new Float32Array(len);
    this.px = A(count); this.py = A(count); this.pz = A(count);
    this.dx = A(count); this.dz = A(count); // tangente horizontale
    this.rx = A(count); this.ry = A(count); this.rz = A(count); // droite (avec dévers)
    this.ux = A(count); this.uy = A(count); this.uz = A(count);
    this.kappa = A(count); this.bank = A(count); this.heading = A(count);
    this.sArr = A(count);
    this.wallL = A(count); this.wallR = A(count);
    this.curbL = new Uint8Array(count); this.curbR = new Uint8Array(count);
    this.runL = new Uint8Array(count); this.runR = new Uint8Array(count); // 0 herbe, 1 graviers, 2 asphalte
    this.grade = A(count);

    for (let i = 0; i < count; i++) {
      const s = i * sp;
      const f = s / FINE;
      const j = Math.min(Math.floor(f), r.n - 1);
      const t = f - j;
      this.px[i] = lerp(r.xs[j], r.xs[j + 1], t);
      this.pz[i] = lerp(r.zs[j], r.zs[j + 1], t);
      this.heading[i] = lerp(r.th[j], r.th[j + 1], t);
      this.kappa[i] = r.ks[Math.min(j, r.n - 1)];
      this.bank[i] = r.bs[Math.min(j, r.n - 1)];
      this.sArr[i] = s;
      const u = this.closed ? s / totalFine : s / totalFine;
      this.py[i] = (def.baseHeight || 0) + (def.elevation ? sampleKeys(def.elevation, u, this.closed) : 0);
    }

    // Repères locaux
    const tg = new Vector3(), rh = new Vector3(), up0 = new Vector3(), rb = new Vector3(), up = new Vector3();
    for (let i = 0; i < count; i++) {
      const ip = this.idx(i + 1), im = this.idx(i - 1);
      tg.set(this.px[ip] - this.px[im], this.py[ip] - this.py[im], this.pz[ip] - this.pz[im]).normalize();
      const th = this.heading[i];
      this.dx[i] = Math.sin(th);
      this.dz[i] = -Math.cos(th);
      rh.set(Math.cos(th), 0, Math.sin(th));
      up0.crossVectors(rh, tg).normalize();
      const b = this.bank[i];
      rb.copy(rh).multiplyScalar(Math.cos(b)).addScaledVector(up0, -Math.sin(b)).normalize();
      up.crossVectors(rb, tg).normalize();
      this.rx[i] = rb.x; this.ry[i] = rb.y; this.rz[i] = rb.z;
      this.ux[i] = up.x; this.uy[i] = up.y; this.uz[i] = up.z;
      this.grade[i] = tg.y;
    }

    this.buildGrid();
    this.buildWalls();
    this.buildCurbs();
    this.startS = def.startLine ?? 0;
  }

  idx(i) {
    if (this.closed) return ((i % this.count) + this.count) % this.count;
    return clamp(i, 0, this.count - 1);
  }

  // Grille spatiale des échantillons (requêtes globales)
  buildGrid() {
    const cell = 25;
    this.cell = cell;
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < this.count; i++) {
      minX = Math.min(minX, this.px[i]); maxX = Math.max(maxX, this.px[i]);
      minZ = Math.min(minZ, this.pz[i]); maxZ = Math.max(maxZ, this.pz[i]);
    }
    this.bounds = { minX, minZ, maxX, maxZ };
    const pad = 200;
    this.gx0 = minX - pad; this.gz0 = minZ - pad;
    this.gw = Math.ceil((maxX - minX + 2 * pad) / cell);
    this.gh = Math.ceil((maxZ - minZ + 2 * pad) / cell);
    const cells = new Array(this.gw * this.gh);
    for (let i = 0; i < this.count; i++) {
      const cx = Math.floor((this.px[i] - this.gx0) / cell);
      const cz = Math.floor((this.pz[i] - this.gz0) / cell);
      const k = cz * this.gw + cx;
      (cells[k] || (cells[k] = [])).push(i);
    }
    this.grid = cells;
  }

  // Appelle fn(i) pour chaque échantillon dans un rayon approximatif
  forEachNear(x, z, radius, fn) {
    const c = this.cell;
    const x0 = Math.floor((x - radius - this.gx0) / c), x1 = Math.floor((x + radius - this.gx0) / c);
    const z0 = Math.floor((z - radius - this.gz0) / c), z1 = Math.floor((z + radius - this.gz0) / c);
    for (let cz = Math.max(0, z0); cz <= Math.min(this.gh - 1, z1); cz++) {
      for (let cx = Math.max(0, x0); cx <= Math.min(this.gw - 1, x1); cx++) {
        const list = this.grid[cz * this.gw + cx];
        if (list) for (let k = 0; k < list.length; k++) fn(list[k]);
      }
    }
  }

  nearestGlobal(x, z) {
    let best = -1, bd = Infinity;
    for (let radius = 30; best < 0 && radius < 5000; radius *= 2) {
      this.forEachNear(x, z, radius, (i) => {
        const d = (this.px[i] - x) ** 2 + (this.pz[i] - z) ** 2;
        if (d < bd) { bd = d; best = i; }
      });
    }
    return best < 0 ? 0 : best;
  }

  // Recherche locale par descente à partir d'un indice connu.
  nearestIndex(x, z, hint) {
    if (hint < 0 || hint >= this.count) return this.nearestGlobal(x, z);
    let i = hint;
    const d2 = (k) => (this.px[k] - x) ** 2 + (this.pz[k] - z) ** 2;
    let d = d2(i);
    if (d > 60 * 60) return this.nearestGlobal(x, z);
    for (let iter = 0; iter < 400; iter++) {
      const a = this.idx(i + 1), b = this.idx(i - 1);
      const da = d2(a), db = d2(b);
      if (da < d && da <= db) { i = a; d = da; }
      else if (db < d) { i = b; d = db; }
      else break;
    }
    return i;
  }

  // Projection : renvoie indice, paramètre t sur [i, i+1], abscisse s et décalage latéral.
  project(x, z, hint, out) {
    let i = this.nearestIndex(x, z, hint);
    // Choisit le segment [i, i+1] ou [i-1, i]
    let a = i, b = this.idx(i + 1);
    let ax = this.px[a], az = this.pz[a];
    let sx = this.px[b] - ax, sz = this.pz[b] - az;
    let t = ((x - ax) * sx + (z - az) * sz) / (sx * sx + sz * sz || 1);
    if (t < 0 && (this.closed || i > 0)) {
      a = this.idx(i - 1); b = i;
      ax = this.px[a]; az = this.pz[a];
      sx = this.px[b] - ax; sz = this.pz[b] - az;
      t = ((x - ax) * sx + (z - az) * sz) / (sx * sx + sz * sz || 1);
    }
    t = clamp(t, 0, 1);
    // Vecteur droite interpolé (horizontal)
    const rxh = lerp(this.rx[a], this.rx[b], t), rzh = lerp(this.rz[a], this.rz[b], t);
    const hl = Math.hypot(rxh, rzh) || 1;
    const cx = ax + sx * t, cz = az + sz * t;
    const lat = ((x - cx) * rxh + (z - cz) * rzh) / hl;
    out.i = a;
    out.j = b;
    out.t = t;
    out.index = i;
    out.s = this.sArr[a] + t * this.spacing;
    if (this.closed && out.s >= this.length) out.s -= this.length;
    out.lateral = lat;
    out.cy = lerp(this.py[a], this.py[b], t);
    out.slopeR = lerp(this.ry[a], this.ry[b], t) / hl; // pente latérale (dévers)
    return out;
  }

  // Hauteur et nature du sol (utilisé par la physique des roues).
  sample(x, z, hint, out) {
    const p = this.project(x, z, hint, _proj);
    const hw = this.halfWidth;
    const lat = p.lateral;
    const al = Math.abs(lat);
    const a = p.i, b = p.j, t = p.t;
    const right = lat >= 0;
    const curb = right ? this.curbR[a] || this.curbR[b] : this.curbL[a] || this.curbL[b];
    const curbW = this.def.curbWidth ?? 1.1;
    let y = p.cy + p.slopeR * clamp(lat, -hw - curbW, hw + curbW);
    let surf = SURFACES.asphalt;
    let bump = 0;
    const nx = lerp(this.ux[a], this.ux[b], t), ny = lerp(this.uy[a], this.uy[b], t), nz = lerp(this.uz[a], this.uz[b], t);
    out.normal.set(nx, ny, nz).normalize();
    if (al > hw) {
      if (curb && al < hw + curbW) {
        surf = SURFACES.curb;
        const u = (al - hw) / curbW;
        // profil du vibreur : rampe douce + ondulations
        y += 0.035 * Math.sin(u * Math.PI * 0.9) + 0.008 * Math.sin(p.s * 6.0);
        bump = 1;
      } else {
        const edge = hw + (curb ? curbW : 0);
        const run = right ? this.runR[a] : this.runL[a];
        surf = run === 1 ? SURFACES.gravel : run === 2 ? SURFACES.asphalt : SURFACES.grass;
        y -= (al - edge) * 0.02;
        if (run !== 2) {
          y -= 0.04;
          bump = 0.5;
          y += 0.015 * Math.sin(p.s * 1.7 + lat * 2.1) * Math.sin(lat * 1.3 + p.s * 0.6);
        }
        // normale « à plat » hors piste
        out.normal.set(0, 1, 0);
      }
    }
    out.y = y;
    out.surface = surf;
    out.hint = p.index;
    out.bump = bump;
    out.lateral = lat;
    out.s = p.s;
    return out;
  }

  // Point monde à l'abscisse s et décalage latéral donnés.
  pointAt(s, lateral, out = new Vector3()) {
    const L = this.length;
    if (this.closed) s = ((s % L) + L) % L;
    else s = clamp(s, 0, L);
    const f = s / this.spacing;
    const i = Math.min(Math.floor(f), this.count - 1);
    const j = this.idx(i + 1);
    const t = f - i;
    const x = lerp(this.px[i], this.px[j], t), y = lerp(this.py[i], this.py[j], t), z = lerp(this.pz[i], this.pz[j], t);
    const rx = lerp(this.rx[i], this.rx[j], t), ry = lerp(this.ry[i], this.ry[j], t), rz = lerp(this.rz[i], this.rz[j], t);
    return out.set(x + rx * lateral, y + ry * lateral, z + rz * lateral);
  }

  headingAt(s) {
    const L = this.length;
    if (this.closed) s = ((s % L) + L) % L;
    const f = clamp(s / this.spacing, 0, this.count - 1);
    const i = Math.floor(f);
    const j = this.idx(i + 1);
    const t = f - i;
    let a = this.heading[i], b = this.heading[j];
    return lerp(a, b, t);
  }

  indexAt(s) {
    const L = this.length;
    if (this.closed) s = ((s % L) + L) % L;
    return this.idx(Math.round(s / this.spacing));
  }

  // ------------------------------------------------------------------
  buildWalls() {
    const def = this.def;
    const n = this.count;
    const hw = this.halfWidth;
    const runoff = def.runoff ?? 7;
    const extra = def.runoffExtra ?? 10;
    const outsideExtra = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const k = Math.abs(this.kappa[i]);
      outsideExtra[i] = clamp(k * 150 - 0.3, 0, 1) * extra;
    }
    // Étend vers l'aval (les sorties larges se font après le virage)
    const ext = new Float32Array(n);
    const sideOf = new Int8Array(n);
    for (let i = 0; i < n; i++) {
      let m = 0, sd = 0;
      for (let k = -8; k <= 30; k++) {
        const j = this.idx(i - k);
        if (outsideExtra[j] > m) { m = outsideExtra[j]; sd = Math.sign(this.kappa[j]); }
      }
      ext[i] = m;
      sideOf[i] = sd; // >0 : virage à droite -> extérieur à gauche
    }
    const L = new Float32Array(n), R = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let l = hw + runoff, r = hw + runoff;
      if (sideOf[i] > 0) l += ext[i];
      else if (sideOf[i] < 0) r += ext[i];
      // côté intérieur : ne pas dépasser le centre de courbure
      const k = this.kappa[i];
      if (Math.abs(k) > 1e-4) {
        const lim = 0.8 / Math.abs(k);
        if (k > 0) r = Math.min(r, lim); else l = Math.min(l, lim);
      }
      L[i] = l; R[i] = r;
      this.runL[i] = def.runoffSurface ?? (sideOf[i] > 0 && ext[i] > 2 && def.gravel !== false ? 1 : 0);
      this.runR[i] = def.runoffSurface ?? (sideOf[i] < 0 && ext[i] > 2 && def.gravel !== false ? 1 : 0);
    }
    // Proximité d'autres portions du circuit
    const minSep = 40; // m le long du tracé
    for (let i = 0; i < n; i++) {
      const x = this.px[i], z = this.pz[i];
      const rxh = this.rx[i], rzh = this.rz[i];
      const hl = Math.hypot(rxh, rzh);
      this.forEachNear(x, z, 70, (j) => {
        let ds = Math.abs(this.sArr[j] - this.sArr[i]);
        if (this.closed) ds = Math.min(ds, this.length - ds);
        if (ds < minSep) return;
        const vx = this.px[j] - x, vz = this.pz[j] - z;
        const lat = (vx * rxh + vz * rzh) / hl;
        const fwd = vx * this.dx[i] + vz * this.dz[i];
        if (Math.abs(fwd) > Math.abs(lat) * 0.6 + 6) return;
        const half = Math.abs(lat) * 0.5 - 0.6;
        if (lat > 0) R[i] = Math.min(R[i], Math.max(hw + 0.8, half));
        else L[i] = Math.min(L[i], Math.max(hw + 0.8, half));
      });
    }
    // Lissage (min glissant puis moyenne)
    const smoothSide = (arr) => {
      const m = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let v = Infinity;
        for (let k = -6; k <= 6; k++) v = Math.min(v, arr[this.idx(i + k)]);
        m[i] = v;
      }
      const sm = boxFilter(m, 5, this.closed);
      for (let i = 0; i < n; i++) arr[i] = Math.max(hw + 0.6, Math.min(sm[i], arr[i] + 0.5));
    };
    smoothSide(L);
    smoothSide(R);
    this.wallL = L;
    this.wallR = R;
    for (let i = 0; i < n; i++) {
      if (L[i] < hw + 3) this.runL[i] = def.runoffSurface ?? 0;
      if (R[i] < hw + 3) this.runR[i] = def.runoffSurface ?? 0;
    }
  }

  buildCurbs() {
    const def = this.def;
    if (def.curbs === false) return;
    const n = this.count;
    const thr = def.curbThreshold ?? 1 / 220;
    const curbW = def.curbWidth ?? 1.1;
    for (let i = 0; i < n; i++) {
      const k = this.kappa[i];
      if (Math.abs(k) < thr) continue;
      // intérieur toujours ; extérieur pour les virages serrés
      if (k > 0) {
        this.curbR[i] = 1;
        if (Math.abs(k) > thr * 1.6) this.curbL[i] = 1;
      } else {
        this.curbL[i] = 1;
        if (Math.abs(k) > thr * 1.6) this.curbR[i] = 1;
      }
    }
    // Pas de vibreurs collés au mur
    for (let i = 0; i < n; i++) {
      if (this.wallL[i] < this.halfWidth + curbW + 0.5) this.curbL[i] = 0;
      if (this.wallR[i] < this.halfWidth + curbW + 0.5) this.curbR[i] = 0;
    }
    // Supprime les fragments trop courts
    const clean = (arr) => {
      let start = -1;
      for (let i = 0; i <= n; i++) {
        const v = i < n ? arr[i] : 0;
        if (v && start < 0) start = i;
        if (!v && start >= 0) {
          if (i - start < 6) for (let k = start; k < i; k++) arr[k] = 0;
          start = -1;
        }
      }
    };
    clean(this.curbL);
    clean(this.curbR);
  }

  // Abscisse curviligne relative à la ligne de départ.
  progressFromStart(s) {
    if (!this.closed) return s - this.startS;
    let d = s - this.startS;
    if (d < 0) d += this.length;
    return d;
  }

  stats() {
    let maxK = 0, maxGrade = 0, minY = Infinity, maxY = -Infinity, maxBank = 0;
    for (let i = 0; i < this.count; i++) {
      maxK = Math.max(maxK, Math.abs(this.kappa[i]));
      maxGrade = Math.max(maxGrade, Math.abs(this.grade[i]));
      minY = Math.min(minY, this.py[i]);
      maxY = Math.max(maxY, this.py[i]);
      maxBank = Math.max(maxBank, Math.abs(this.bank[i]));
    }
    // Distance minimale entre portions non adjacentes
    let minDist = Infinity, at = null;
    for (let i = 0; i < this.count; i += 2) {
      this.forEachNear(this.px[i], this.pz[i], 60, (j) => {
        let ds = Math.abs(this.sArr[j] - this.sArr[i]);
        if (this.closed) ds = Math.min(ds, this.length - ds);
        if (ds < 120) return;
        const d = Math.hypot(this.px[j] - this.px[i], this.pz[j] - this.pz[i]);
        if (d < minDist) { minDist = d; at = [Math.round(this.sArr[i]), Math.round(this.sArr[j])]; }
      });
    }
    return {
      length: Math.round(this.length),
      minRadius: maxK > 0 ? Math.round(1 / maxK) : Infinity,
      maxGradePct: +(maxGrade * 100).toFixed(1),
      elev: [+minY.toFixed(1), +maxY.toFixed(1)],
      maxBankDeg: +((maxBank * 180) / Math.PI).toFixed(1),
      minSeparation: minDist === Infinity ? null : +minDist.toFixed(1),
      at,
      closureError: this.closureError || null,
      polygonError: this.polygonError || null,
      segments: this.segments.map((s) => (s.s !== undefined ? Math.round(s.s) : `${s.a}@${s.r}`)),
    };
  }
}

const _proj = { i: 0, j: 0, t: 0, index: 0, s: 0, lateral: 0, cy: 0, slopeR: 0 };
