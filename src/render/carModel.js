// Modèles de voitures procéduraux : carrosserie par sections lissées (superellipses),
// habitacle vitré, passages de roues, optiques, ailerons, jantes détaillées, intérieur.
import * as THREE from 'three';
import { clamp, lerp, smoothstep, rng } from '../core/utils.js';
import { livery as liveryTexture, fabric, textTexture } from '../world/textures.js';

// Profils par style (hauteurs en fraction de la hauteur totale, abscisses t de 0 = avant à 1 = arrière)
const STYLES = {
  hatch: {
    overF: 0.58, nose: 0.47, hood: 0.66, belt: 0.69, deck: 0.8, tail: 0.74, roof: 1.0,
    ws: 0.34, roofF: 0.5, roofB: 0.8, rearB: 0.97, cabW: 0.9, roofW: 0.78, clear: 0.15,
    noseLen: 0.1, tailLen: 0.05, lights: 'round', tailLights: 'tall', spoiler: 'lip', doors: 2, shoulder: 0.8,
  },
  hatch2: {
    overF: 0.58, nose: 0.45, hood: 0.64, belt: 0.68, deck: 0.78, tail: 0.72, roof: 1.0,
    ws: 0.32, roofF: 0.49, roofB: 0.79, rearB: 0.96, cabW: 0.9, roofW: 0.78, clear: 0.14,
    noseLen: 0.11, tailLen: 0.06, lights: 'slim', tailLights: 'tall', spoiler: 'roof', doors: 2, shoulder: 0.8,
  },
  roadster: {
    overF: 0.52, nose: 0.42, hood: 0.6, belt: 0.67, deck: 0.7, tail: 0.66, roof: 1.0,
    ws: 0.42, roofF: 0.53, roofB: 0.64, rearB: 0.73, cabW: 0.86, roofW: 0.74, clear: 0.13,
    noseLen: 0.13, tailLen: 0.08, lights: 'oval', tailLights: 'oval', spoiler: 'none', doors: 2, softTop: true, shoulder: 0.82,
  },
  coupe: {
    overF: 0.55, nose: 0.42, hood: 0.6, belt: 0.68, deck: 0.73, tail: 0.7, roof: 1.0,
    ws: 0.34, roofF: 0.48, roofB: 0.6, rearB: 0.85, cabW: 0.88, roofW: 0.72, clear: 0.13,
    noseLen: 0.12, tailLen: 0.06, lights: 'slim', tailLights: 'slim', spoiler: 'duck', doors: 2, shoulder: 0.8,
  },
  sedan: {
    overF: 0.52, nose: 0.46, hood: 0.63, belt: 0.67, deck: 0.71, tail: 0.69, roof: 1.0,
    ws: 0.3, roofF: 0.43, roofB: 0.67, rearB: 0.79, cabW: 0.9, roofW: 0.77, clear: 0.15,
    noseLen: 0.1, tailLen: 0.06, lights: 'slim', tailLights: 'block', spoiler: 'wing', doors: 4, shoulder: 0.8,
  },
  sedan2: {
    overF: 0.5, nose: 0.44, hood: 0.62, belt: 0.67, deck: 0.71, tail: 0.69, roof: 1.0,
    ws: 0.31, roofF: 0.44, roofB: 0.64, rearB: 0.8, cabW: 0.89, roofW: 0.75, clear: 0.13,
    noseLen: 0.1, tailLen: 0.06, lights: 'twin', tailLights: 'block', spoiler: 'lip', doors: 2, shoulder: 0.8, carbonRoof: true,
  },
  gtcoupe: {
    overF: 0.52, nose: 0.45, hood: 0.63, belt: 0.68, deck: 0.73, tail: 0.71, roof: 1.0,
    ws: 0.32, roofF: 0.46, roofB: 0.64, rearB: 0.81, cabW: 0.89, roofW: 0.76, clear: 0.13,
    noseLen: 0.09, tailLen: 0.04, lights: 'slim', tailLights: 'quad', spoiler: 'wing', doors: 2, shoulder: 0.82,
  },
  rearengine: {
    overF: 0.47, nose: 0.4, hood: 0.6, belt: 0.67, deck: 0.74, tail: 0.66, roof: 1.0,
    ws: 0.3, roofF: 0.43, roofB: 0.56, rearB: 0.9, cabW: 0.84, roofW: 0.7, clear: 0.12,
    noseLen: 0.14, tailLen: 0.07, lights: 'frog', tailLights: 'bar', spoiler: 'wing', doors: 2, shoulder: 0.76, flare: 0.05,
  },
  muscle: {
    overF: 0.5, nose: 0.48, hood: 0.66, belt: 0.7, deck: 0.73, tail: 0.71, roof: 1.0,
    ws: 0.44, roofF: 0.56, roofB: 0.66, rearB: 0.84, cabW: 0.84, roofW: 0.68, clear: 0.11,
    noseLen: 0.08, tailLen: 0.05, lights: 'slim', tailLights: 'bar', spoiler: 'gtwing', doors: 2, shoulder: 0.84, flare: 0.05, hoodVents: true,
  },
  supercar: {
    overF: 0.45, nose: 0.3, hood: 0.52, belt: 0.64, deck: 0.7, tail: 0.68, roof: 1.0,
    ws: 0.25, roofF: 0.42, roofB: 0.52, rearB: 0.82, cabW: 0.8, roofW: 0.64, clear: 0.1,
    noseLen: 0.12, tailLen: 0.04, lights: 'blade', tailLights: 'blade', spoiler: 'lipwing', doors: 2, shoulder: 0.78, flare: 0.05, sideIntake: true,
  },
  gt3: {
    overF: 0.5, nose: 0.4, hood: 0.6, belt: 0.67, deck: 0.73, tail: 0.71, roof: 1.0,
    ws: 0.33, roofF: 0.47, roofB: 0.62, rearB: 0.83, cabW: 0.84, roofW: 0.7, clear: 0.09,
    noseLen: 0.08, tailLen: 0.03, lights: 'slim', tailLights: 'bar', spoiler: 'gtwing', doors: 2, shoulder: 0.8, flare: 0.1, splitter: true, race: true,
  },
  proto: {
    overF: 0.5, nose: 0.28, hood: 0.5, belt: 0.6, deck: 0.66, tail: 0.66, roof: 1.0,
    ws: 0.26, roofF: 0.4, roofB: 0.5, rearB: 0.72, cabW: 0.52, roofW: 0.42, clear: 0.07,
    noseLen: 0.1, tailLen: 0.02, lights: 'blade', tailLights: 'bar', spoiler: 'protowing', doors: 0, shoulder: 0.85, flare: 0.06, valley: 0.16, fin: true, splitter: true, race: true,
  },
  gt1: {
    overF: 0.52, nose: 0.32, hood: 0.52, belt: 0.62, deck: 0.68, tail: 0.68, roof: 1.0,
    ws: 0.28, roofF: 0.42, roofB: 0.53, rearB: 0.78, cabW: 0.66, roofW: 0.54, clear: 0.08,
    noseLen: 0.1, tailLen: 0.02, lights: 'round', tailLights: 'round', spoiler: 'protowing', doors: 2, shoulder: 0.84, flare: 0.07, valley: 0.08, splitter: true, race: true, roofScoop: true,
  },
};

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

const MAT_CACHE = new Map();
function sharedMat(key, make) {
  if (!MAT_CACHE.has(key)) MAT_CACHE.set(key, make());
  return MAT_CACHE.get(key);
}

export function carMaterials() {
  return {
    glass: sharedMat('glass', () => new THREE.MeshPhysicalMaterial({ color: 0x0c1218, metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.78, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.3 })),
    black: sharedMat('black', () => new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.65, metalness: 0.1 })),
    trim: sharedMat('trim', () => new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.45, metalness: 0.3 })),
    carbon: sharedMat('carbon', () => new THREE.MeshPhysicalMaterial({ color: 0x15161a, roughness: 0.3, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.05 })),
    chrome: sharedMat('chrome', () => new THREE.MeshStandardMaterial({ color: 0xd8dadf, roughness: 0.12, metalness: 1 })),
    rubber: sharedMat('rubber', () => new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.88, metalness: 0 })),
    tread: sharedMat('tread', () => new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.95, metalness: 0 })),
    disc: sharedMat('disc', () => new THREE.MeshStandardMaterial({ color: 0x55575c, roughness: 0.35, metalness: 0.9 })),
    well: sharedMat('well', () => new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 1, metalness: 0, side: THREE.DoubleSide })),
    interior: sharedMat('interior', () => new THREE.MeshStandardMaterial({ color: 0x1e1f23, roughness: 0.85, metalness: 0.05 })),
    seat: sharedMat('seat', () => new THREE.MeshStandardMaterial({ color: 0x2b2c31, roughness: 0.9, map: fabric() })),
    plate: sharedMat('plate', () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, map: textTexture('TR-998-AJ', { w: 256, h: 56, bg: '#f4f4f0', fg: '#111', font: 'bold 38px Arial' }) })),
    lightLens: sharedMat('lightLens', () => new THREE.MeshPhysicalMaterial({ color: 0xcfd6de, metalness: 0.85, roughness: 0.12, clearcoat: 1, emissive: 0xfff2dd, emissiveIntensity: 0.0 })),
  };
}

// ---------------------------------------------------------------------------
// Génération de la carrosserie
// ---------------------------------------------------------------------------
class BodyShape {
  constructor(spec) {
    const st = STYLES[spec.style] || STYLES.coupe;
    this.st = st;
    const d = spec.dims;
    this.L = d.length;
    this.H = d.height;
    this.Wmax = d.width / 2;
    this.wb = d.wheelbase;
    const over = d.length - d.wheelbase;
    this.overF = over * st.overF;
    const a = d.wheelbase * (1 - spec.weightFront);
    this.zFront = -a - this.overF; // avant de la voiture
    this.zAxleF = -a;
    this.zAxleR = d.wheelbase - a;
    this.r = spec.wheel.radius;
    this.archR = this.r + 0.045;
    this.clear = st.clear - (spec.lowered || 0) * 0.5;
    this.track = d.track;
    const H = this.H;
    this.tAxleF = (this.zAxleF - this.zFront) / this.L;
    this.tAxleR = (this.zAxleR - this.zFront) / this.L;
    this.topKeys = [
      [0, st.nose * H * 0.8],
      [0.03, st.nose * H],
      [st.ws * 0.55, lerp(st.nose, st.hood, 0.75) * H],
      [st.ws, st.hood * H],
      [st.ws + 0.03, st.belt * H],
      [st.rearB - 0.02, st.belt * H],
      [st.rearB, st.deck * H],
      [0.975, st.tail * H],
      [1, st.tail * H * 0.88],
    ];
  }

  // Altitude du dessus (centre) de la caisse inférieure
  top(t) {
    return keyInterp(this.topKeys, t);
  }

  bottom(t, z) {
    let b = this.clear;
    if (t < 0.06) b += (0.06 - t) * 1.6 * this.H * 0.4;
    if (t > 0.93) b += (t - 0.93) * 1.4 * this.H * 0.35;
    // passages de roues
    for (const za of [this.zAxleF, this.zAxleR]) {
      const dz = z - za;
      const R = this.archR;
      if (Math.abs(dz) < R) {
        const archY = this.r + Math.sqrt(R * R - dz * dz) * 0.97;
        b = Math.max(b, archY);
      }
    }
    return b;
  }

  halfWidth(t, z) {
    const st = this.st;
    let w = this.Wmax * (0.8 + 0.2 * smoothstep(0, st.noseLen, t)) * (0.92 + 0.08 * smoothstep(1, 1 - st.tailLen - 0.03, t));
    if (st.flare) {
      for (const za of [this.zAxleF, this.zAxleR]) {
        const dz = (z - za) / (this.archR * 1.5);
        w += st.flare * Math.exp(-dz * dz) - st.flare * 0.35;
      }
    }
    return Math.min(w, this.Wmax);
  }

  shoulder(t, z, bot, top) {
    let ys = bot + (top - bot) * this.st.shoulder;
    // Au-dessus des roues, l'épaule (aile) doit dominer le passage de roue
    for (const za of [this.zAxleF, this.zAxleR]) {
      const dz = Math.abs(z - za);
      if (dz < this.archR + 0.25) {
        const need = this.r * 2 + 0.07;
        const k = 1 - smoothstep(this.archR - 0.05, this.archR + 0.25, dz);
        ys = Math.max(ys, lerp(ys, need, k));
      }
    }
    return Math.min(ys, top - 0.04);
  }

  valley(t) {
    if (!this.st.valley) return 0;
    // creux central entre les ailes avant (prototypes), s'estompe vers l'habitacle
    return this.st.valley * (1 - smoothstep(this.st.ws - 0.08, this.st.ws + 0.04, t)) +
      this.st.valley * 0.6 * smoothstep(this.st.rearB - 0.05, this.st.rearB + 0.05, t);
  }

  // Point de la section (côté droit) pour un angle θ ∈ [-π/2, π/2]
  sectionPoint(t, theta, out) {
    const z = this.zFront + t * this.L;
    const top = this.top(t);
    const bot = Math.min(this.bottom(t, z), top - 0.06);
    const W = this.halfWidth(t, z);
    const ys = clamp(this.shoulder(t, z, bot, top), bot + 0.03, top - 0.02);
    let x, y;
    const c = Math.cos(theta), s = Math.sin(theta);
    if (theta < 0) {
      const n = 2.4;
      x = W * Math.pow(Math.abs(c), 2 / n);
      y = ys - (ys - bot) * Math.pow(Math.abs(s), 2 / n);
    } else {
      const n = 3.6;
      x = W * Math.pow(Math.abs(c), 2 / n);
      y = ys + (top - ys) * Math.pow(Math.abs(s), 2 / n);
      const v = this.valley(t);
      if (v > 0) {
        const u = x / (W * 0.62);
        if (u < 1) y -= v * (1 - u * u) * (1 - u * u);
      }
    }
    out.x = x;
    out.y = y;
    out.z = z;
    out.W = W;
    out.top = top;
    out.bot = bot;
    out.ys = ys;
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
      return roofH * (1 - 0.025 * Math.pow(2 * u - 1, 2)) + 0.025 * roofH * 0;
    }
    if (t < st.rearB) {
      const u = (t - st.roofB) / (st.rearB - st.roofB);
      const end = st.deck * H;
      const k = st.rearB > 0.95 ? Math.pow(u, 2.2) : 1 - Math.pow(1 - u, 1.4);
      return roofH * 0.975 + (end - roofH * 0.975) * k;
    }
    return st.deck * H;
  }
}

function pushQuad(idx, a, b, c, d) {
  idx.push(a, b, d, b, c, d);
}

// Normales robustes : les sommets dégénérés (sections de hauteur nulle) reçoivent une normale valide.
function safeNormals(g, fallback = [0, 1, 0]) {
  g.computeVertexNormals();
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) {
    const x = n.getX(i), y = n.getY(i), z = n.getZ(i);
    const l = Math.hypot(x, y, z);
    if (!(l > 1e-6) || !isFinite(l)) n.setXYZ(i, fallback[0], fallback[1], fallback[2]);
  }
  n.needsUpdate = true;
}

function buildBodyGeometry(shape, spec) {
  const st = shape.st;
  // Stations le long de la voiture (plus denses aux extrémités et aux arches), + lignes de portes
  const ts = [];
  const N = 64;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    ts.push(0.5 - 0.5 * Math.cos(u * Math.PI)); // resserré aux extrémités
  }
  for (const ta of [shape.tAxleF, shape.tAxleR]) {
    const dt = shape.archR / shape.L;
    for (let k = -6; k <= 6; k++) ts.push(ta + (k / 6) * dt * 1.02);
  }
  const doorLines = [];
  if (st.doors >= 2) {
    doorLines.push(st.ws + 0.012, st.doors === 4 ? lerp(st.roofF, st.roofB, 0.48) : st.roofB - 0.02);
    if (st.doors === 4) doorLines.push(st.roofB + 0.03);
  }
  const eps = 0.0025;
  for (const dl of doorLines) ts.push(dl - eps, dl, dl + eps);
  ts.sort((a, b) => a - b);
  const stations = ts.filter((t, i) => i === 0 || t - ts[i - 1] > 1e-4);
  const nLow = 9, nUp = 13;
  const ringRight = [];
  for (let k = 0; k <= nLow; k++) ringRight.push(-Math.PI / 2 + (k / nLow) * (Math.PI / 2));
  for (let k = 1; k <= nUp; k++) ringRight.push((k / nUp) * (Math.PI / 2));
  // anneau : droite de bas vers haut, puis gauche de haut vers bas (sans doublons haut), + couture
  const ring = [];
  for (let k = 0; k < ringRight.length; k++) ring.push({ th: ringRight[k], side: 1 });
  for (let k = ringRight.length - 2; k >= 0; k--) ring.push({ th: ringRight[k], side: -1 });
  const M = ring.length; // dernier = couture (bas, côté gauche)
  const pos = [], uv = [], col = [], idx = [];
  const p = {};
  stations.forEach((t, si) => {
    const isDoor = doorLines.some((dl) => Math.abs(t - dl) < 1e-4);
    for (let k = 0; k < M; k++) {
      const r = ring[k];
      shape.sectionPoint(t, r.th, p);
      pos.push(p.x * r.side, p.y, p.z);
      // v : 0 bas -> 0.5 sommet -> 1 bas
      const v = r.side > 0 ? (r.th + Math.PI / 2) / (2 * Math.PI) : 0.5 + (Math.PI / 2 - r.th) / (2 * Math.PI);
      uv.push(t, 1 - v);
      let c = 1;
      if (p.y < p.bot + 0.05 && r.th < -0.9) c = 0.08; // dessous
      else if (p.y < p.bot + 0.02) c = 0.25;
      if (isDoor && p.x > p.W * 0.82 && p.y > p.bot + 0.04 && p.y < shape.top(t) - 0.03) c = 0.12;
      col.push(c, c, c);
    }
    if (si > 0) {
      const a0 = (si - 1) * M, b0 = si * M;
      for (let k = 0; k < M - 1; k++) pushQuad(idx, a0 + k, a0 + k + 1, b0 + k + 1, b0 + k);
    }
  });
  // Bouchons avant / arrière
  // Bouchons avant / arrière : sommets dupliqués pour une arête nette (normales propres)
  const capFan = (si, flip) => {
    const base = si * M;
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < M - 1; k++) { cx += pos[(base + k) * 3]; cy += pos[(base + k) * 3 + 1]; cz += pos[(base + k) * 3 + 2]; }
    cx /= M - 1; cy /= M - 1; cz /= M - 1;
    const start = pos.length / 3;
    for (let k = 0; k < M; k++) {
      pos.push(pos[(base + k) * 3], pos[(base + k) * 3 + 1], pos[(base + k) * 3 + 2]);
      uv.push(uv[(base + k) * 2], uv[(base + k) * 2 + 1]);
      const c = col[(base + k) * 3];
      col.push(c, c, c);
    }
    const ci = pos.length / 3;
    pos.push(cx, cy, cz + (flip ? 0.012 : -0.012));
    uv.push(flip ? 1 : 0, 0.5);
    col.push(0.9, 0.9, 0.9);
    for (let k = 0; k < M - 1; k++) {
      if (flip) idx.push(start + k, start + k + 1, ci);
      else idx.push(start + k + 1, start + k, ci);
    }
  };
  capFan(0, false);
  capFan(stations.length - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  safeNormals(g);
  return g;
}

// Habitacle : groupes 0 = peinture (montants/toit), 1 = vitrage, 2 = noir (toit souple / carbone)
function buildCabinGeometry(shape) {
  const st = shape.st, H = shape.H;
  const belt = st.belt * H;
  const nS = 40;
  const ts = [];
  for (let i = 0; i <= nS; i++) ts.push(lerp(st.ws, st.rearB, i / nS));
  const nRoof = 7;
  // points de section côté droit : base, milieu vitre, bord de toit, puis toit vers le centre
  const sec = (t, out) => {
    const z = shape.zFront + t * shape.L;
    const W = shape.halfWidth(t, z);
    const yr = shape.roof(t);
    const h = Math.max(0, yr - belt);
    const wc = W * st.cabW * (0.94 + 0.06 * smoothstep(st.ws, st.roofF, t));
    const wr = wc * (st.roofW / st.cabW) + (1 - smoothstep(0, 0.35, h)) * (wc - wc * (st.roofW / st.cabW));
    const rr = Math.min(h * 0.22, 0.09);
    out.length = 0;
    out.push([wc, belt - 0.03]);
    out.push([lerp(wc, wr, 0.5), belt + (h - rr) * 0.5]);
    out.push([wr, belt + h - rr]);
    for (let k = 1; k <= nRoof; k++) {
      const a = (k / nRoof) * (Math.PI / 2);
      const x = wr * Math.pow(Math.cos(a), 2 / 3.2);
      const y = belt + h - rr + rr * Math.pow(Math.sin(a), 2 / 3.2);
      out.push([x, y]);
    }
    return { z, h };
  };
  const right = [];
  const ringPts = 3 + nRoof; // côté droit inclus sommet
  const M = ringPts * 2 - 1;
  const pos = [], idx = [], groups = [], uv = [];
  const quads = { 0: [], 1: [], 2: [] };
  ts.forEach((t) => {
    const info = sec(t, right);
    for (let k = 0; k < ringPts; k++) pos.push(right[k][0], right[k][1], info.z);
    for (let k = ringPts - 2; k >= 0; k--) pos.push(-right[k][0], right[k][1], info.z);
    for (let k = 0; k < M; k++) uv.push(t, k / (M - 1));
  });
  const bPillar = st.doors === 4 ? lerp(st.roofF, st.roofB, 0.48) : null;
  for (let si = 1; si < ts.length; si++) {
    const t = (ts[si] + ts[si - 1]) / 2;
    const a0 = (si - 1) * M, b0 = si * M;
    for (let k = 0; k < M - 1; k++) {
      // k : 0-1 vitre latérale droite, 2..: toit, symétrique à gauche
      const kk = k < ringPts - 1 ? k : M - 2 - k; // index miroir
      const side = kk <= 1; // bande latérale
      const edge = kk === 2 || kk === 3; // bord du toit (montant)
      let g = 0;
      if (t < st.roofF) {
        // pare-brise
        if (!side && !edge) g = 1;
        if (side && t > st.ws + (st.roofF - st.ws) * 0.55 && st.doors !== 0) g = 1;
      } else if (t <= st.roofB) {
        if (side) {
          g = 1;
          if (bPillar && Math.abs(t - bPillar) < 0.018) g = 2;
          if (st.doors !== 4 && t > st.roofB - 0.03) g = 0;
        } else g = st.softTop ? 2 : st.carbonRoof && !edge ? 2 : 0;
      } else {
        // lunette arrière / custode
        if (!side && !edge) g = st.softTop ? 2 : 1;
        if (side && st.rearB > 0.95 && t < lerp(st.roofB, st.rearB, 0.5)) g = 1;
        if (st.softTop) g = 2;
      }
      if (st.softTop && t > st.roofF) g = 2;
      quads[g].push([a0 + k, a0 + k + 1, b0 + k + 1, b0 + k]);
    }
  }
  let start = 0;
  for (const g of [0, 1, 2]) {
    for (const q of quads[g]) pushQuad(idx, q[0], q[1], q[2], q[3]);
    const count = quads[g].length * 6;
    groups.push({ start, count, materialIndex: g });
    start += count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  for (const gr of groups) geo.addGroup(gr.start, gr.count, gr.materialIndex);
  safeNormals(geo);
  return geo;
}

// ---------------------------------------------------------------------------
// Roues
// ---------------------------------------------------------------------------
const WHEEL_GEO = new Map();
function tireGeometry(R, w) {
  const key = `tire${R.toFixed(3)}${w.toFixed(3)}`;
  if (WHEEL_GEO.has(key)) return WHEEL_GEO.get(key);
  const rim = R * 0.68;
  const pts = [];
  const sh = Math.min(0.035, w * 0.2);
  // profil (x = rayon, y = position axiale)
  pts.push(new THREE.Vector2(rim, -w * 0.42));
  pts.push(new THREE.Vector2(rim + (R - rim) * 0.35, -w * 0.5));
  pts.push(new THREE.Vector2(R - sh, -w * 0.5));
  for (let i = 1; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    pts.push(new THREE.Vector2(R - sh + Math.sin(a) * sh, -w * 0.5 + sh - Math.cos(a) * sh));
  }
  pts.push(new THREE.Vector2(R, w * 0.5 - sh));
  for (let i = 1; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    pts.push(new THREE.Vector2(R - sh + Math.cos(a) * sh, w * 0.5 - sh + Math.sin(a) * sh));
  }
  pts.push(new THREE.Vector2(rim + (R - rim) * 0.35, w * 0.5));
  pts.push(new THREE.Vector2(rim, w * 0.42));
  const g = new THREE.LatheGeometry(pts, 28);
  g.rotateZ(Math.PI / 2); // axe de révolution -> X
  WHEEL_GEO.set(key, g);
  return g;
}

function rimGeometry(R, w, style) {
  const key = `rim${R.toFixed(3)}${w.toFixed(3)}${style}`;
  if (WHEEL_GEO.has(key)) return WHEEL_GEO.get(key);
  const rr = R * 0.68;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rr * 0.97, 0, Math.PI * 2, false);
  const spokes = { five: 5, six: 6, ten: 10, split: 5, mesh: 12, race: 10 }[style] || 5;
  const hubR = rr * 0.24;
  const holeIn = hubR + rr * 0.06, holeOut = rr * 0.86;
  const holes = [];
  const makeHole = (a0, a1, rin, rout) => {
    const h = new THREE.Path();
    h.moveTo(Math.cos(a0) * rin, Math.sin(a0) * rin);
    h.lineTo(Math.cos(a0) * rout, Math.sin(a0) * rout);
    h.absarc(0, 0, rout, a0, a1, false);
    h.lineTo(Math.cos(a1) * rin, Math.sin(a1) * rin);
    h.absarc(0, 0, rin, a1, a0, true);
    holes.push(h);
  };
  const sector = (Math.PI * 2) / spokes;
  const spokeW = style === 'mesh' ? 0.36 : style === 'ten' || style === 'race' ? 0.4 : style === 'split' ? 0.5 : 0.36;
  for (let i = 0; i < spokes; i++) {
    const a = i * sector;
    const half = (sector * (1 - spokeW)) / 2;
    const mid = a + sector / 2;
    if (style === 'split') {
      makeHole(mid - half, mid - 0.04, holeIn, holeOut);
      makeHole(mid + 0.04, mid + half, holeIn, holeOut);
    } else if (style === 'mesh') {
      makeHole(mid - half, mid + half, holeIn, (holeIn + holeOut) / 2 - 0.006);
      makeHole(mid - half, mid + half, (holeIn + holeOut) / 2 + 0.006, holeOut);
    } else {
      makeHole(mid - half, mid + half, holeIn, holeOut);
    }
  }
  shape.holes = holes;
  const face = new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.008, bevelSegments: 1, curveSegments: 5 });
  face.rotateY(Math.PI / 2); // face orientée vers +X
  face.translate(w * 0.32, 0, 0);
  // Jante (fût)
  const barrel = new THREE.CylinderGeometry(rr, rr, w * 0.82, 20, 1, true);
  barrel.rotateZ(Math.PI / 2);
  // Moyeu
  const hub = new THREE.CylinderGeometry(hubR * 0.55, hubR * 0.7, 0.05, 16);
  hub.rotateZ(-Math.PI / 2);
  hub.translate(w * 0.37, 0, 0);
  const res = { face, barrel, hub };
  WHEEL_GEO.set(key, res);
  return res;
}

function buildWheel(spec, isLeft, mats, rimMat, caliperMat) {
  const R = spec.wheel.radius;
  const w = spec.wheel.width;
  const steer = new THREE.Group();
  const spin = new THREE.Group();
  steer.add(spin);
  const tire = new THREE.Mesh(tireGeometry(R, w), mats.tread);
  tire.castShadow = true;
  spin.add(tire);
  const rg = rimGeometry(R, w, spec.wheel.rim);
  const face = new THREE.Mesh(rg.face, rimMat);
  face.castShadow = true;
  spin.add(face);
  const barrel = new THREE.Mesh(rg.barrel, mats.trim);
  spin.add(barrel);
  const hub = new THREE.Mesh(rg.hub, rimMat);
  spin.add(hub);
  const details = [barrel, hub];
  // Disque + étrier
  const discR = R * 0.68 * 0.82;
  const discGeo = WHEEL_GEO.get('disc' + discR.toFixed(3)) || new THREE.CylinderGeometry(discR, discR, 0.028, 28);
  if (!WHEEL_GEO.has('disc' + discR.toFixed(3))) { discGeo.rotateZ(Math.PI / 2); WHEEL_GEO.set('disc' + discR.toFixed(3), discGeo); }
  const disc = new THREE.Mesh(discGeo, mats.disc);
  disc.position.x = w * 0.08;
  spin.add(disc);
  const cal = new THREE.Mesh(new THREE.BoxGeometry(0.06, discR * 0.55, discR * 0.95), caliperMat);
  cal.position.set(w * 0.16, discR * 0.55, discR * 0.35);
  steer.add(cal);
  details.push(disc, cal);
  if (isLeft) {
    // miroir : la face de jante doit regarder vers l'extérieur
    steer.rotation.order = 'YXZ';
    spin.scale.x = -1;
    cal.position.x *= -1;
  }
  // Les faces en miroir inversent l'ordre des sommets : corriger via le côté du matériau
  return { steer, spin, isLeft, details, face };
}

// ---------------------------------------------------------------------------
// Ailerons et accessoires
// ---------------------------------------------------------------------------
function airfoilGeometry(chord, thick, span) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(chord * 0.15, thick * 1.1, chord * 0.55, thick * 0.9, chord, thick * 0.15);
  s.lineTo(chord, -thick * 0.05);
  s.bezierCurveTo(chord * 0.6, thick * 0.05, chord * 0.2, -thick * 0.35, 0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: span, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -span / 2);
  g.rotateY(Math.PI / 2); // corde le long de Z, envergure le long de X
  return g;
}

function headlightMesh(kind, mat, size) {
  let g;
  if (kind === 'round' || kind === 'frog') {
    g = new THREE.SphereGeometry(size * 0.55, 20, 12);
    g.scale(1, 1, 0.55);
  } else if (kind === 'oval') {
    g = new THREE.SphereGeometry(size * 0.55, 20, 12);
    g.scale(1.4, 0.75, 0.5);
  } else if (kind === 'twin') {
    g = new THREE.SphereGeometry(size * 0.45, 16, 10);
    g.scale(1.9, 0.85, 0.5);
  } else if (kind === 'blade') {
    g = new THREE.SphereGeometry(size * 0.55, 20, 10);
    g.scale(2.4, 0.42, 0.45);
  } else {
    g = new THREE.SphereGeometry(size * 0.55, 20, 10);
    g.scale(2.0, 0.6, 0.5);
  }
  return new THREE.Mesh(g, mat);
}

// ---------------------------------------------------------------------------
export class CarModel {
  constructor(spec, opts = {}) {
    this.spec = spec;
    const st = STYLES[spec.style] || STYLES.coupe;
    this.style = st;
    const mats = carMaterials();
    this.mats = mats;
    this.color = opts.color || spec.paints?.[0] || '#c00';
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.body.position.y = -(spec.cgHeight - (spec.lowered || 0));
    this.root.add(this.body);
    const shape = new BodyShape(spec);
    this.shape = shape;

    // Peinture (livrée)
    const metallic = opts.metallic ?? true;
    const liv = liveryTexture({
      color: this.color,
      stripe: opts.stripe ?? (spec.livery ? '#ffffff' : null),
      number: opts.number ?? (spec.livery ? 7 : null),
      sponsor: opts.sponsor ?? (spec.livery ? 2 : null),
      style: opts.liveryStyle ?? (spec.livery ? 2 : 0),
    });
    this.paint = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: liv,
      vertexColors: true,
      metalness: metallic ? 0.55 : 0.05,
      roughness: metallic ? 0.33 : 0.42,
      clearcoat: 1,
      clearcoatRoughness: 0.035,
      envMapIntensity: 1.15,
    });
    this.cabinPaint = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: liv,
      metalness: this.paint.metalness,
      roughness: this.paint.roughness,
      clearcoat: 1,
      clearcoatRoughness: 0.035,
      envMapIntensity: 1.15,
    });
    const bodyGeo = buildBodyGeometry(shape, spec);
    const bodyMesh = new THREE.Mesh(bodyGeo, this.paint);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.body.add(bodyMesh);
    this.bodyMesh = bodyMesh;

    const cabGeo = buildCabinGeometry(shape);
    const cab = new THREE.Mesh(cabGeo, [this.cabinPaint, mats.glass, st.softTop ? mats.black : mats.carbon]);
    cab.castShadow = true;
    this.body.add(cab);
    // Intérieur de l'habitacle (vu de l'intérieur)
    const inner = new THREE.Mesh(cabGeo, [mats.interior, sharedMat('invisible', () => new THREE.MeshBasicMaterial({ visible: false })), mats.interior]);
    inner.material = inner.material.map((m) => m);
    inner.material[0] = sharedMat('interiorBack', () => new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.9, side: THREE.BackSide }));
    inner.material[2] = inner.material[0];
    this.body.add(inner);

    this.buildDetails(shape, spec, mats);
    this.buildWheels(spec, mats, opts);
    this.buildInterior(shape, spec, mats);

    this.brake = 0;
    this.lightsOn = false;
  }

  buildDetails(shape, spec, mats) {
    const st = this.style;
    const H = shape.H;
    const p = {};
    this.detailMeshes = [];
    const add = (mesh, x, y, z, detail = false) => {
      mesh.position.set(x, y, z);
      mesh.castShadow = !detail;
      this.body.add(mesh);
      if (detail) this.detailMeshes.push(mesh);
      return mesh;
    };
    // --- Optiques avant ---
    this.headMat = mats.lightLens.clone();
    const tH = 0.04;
    shape.sectionPoint(tH, 0.25, p);
    const lightSize = st.lights === 'round' || st.lights === 'frog' ? 0.2 : 0.16;
    for (const side of [-1, 1]) {
      const m = headlightMesh(st.lights, this.headMat, lightSize);
      const x = p.W * (st.lights === 'frog' ? 0.62 : 0.66) * side;
      const tt = st.lights === 'frog' ? 0.075 : tH;
      shape.sectionPoint(tt, 0.3, p);
      const y = st.lights === 'frog' ? shape.top(tt) - 0.02 : lerp(p.ys, shape.top(tt), 0.35);
      add(m, x, y, p.z + 0.03);
      m.rotation.y = side * 0.35;
      m.rotation.x = st.lights === 'frog' ? -0.6 : -0.15;
    }
    // --- Feux arrière (sur la face arrière réelle de la carrosserie) ---
    this.tailMat = new THREE.MeshPhysicalMaterial({ color: 0x6a0008, emissive: 0xff1a10, emissiveIntensity: 0.5, roughness: 0.15, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 });
    const tT = 0.992;
    shape.sectionPoint(tT, 0.3, p);
    const zR = shape.zFront + shape.L + 0.004;
    const topR = shape.top(tT);
    const yT = lerp(p.ys, topR, 0.5);
    const Wr = p.W;
    const lens = (w, hgt, x, y, z) => {
      const g = new THREE.SphereGeometry(0.5, 18, 8);
      g.scale(w, hgt, 0.07);
      return add(new THREE.Mesh(g, this.tailMat), x, y, z);
    };
    if (st.tailLights === 'bar' || st.tailLights === 'blade') {
      const bh = st.tailLights === 'blade' ? 0.045 : 0.075;
      lens(Wr * 1.78, bh, 0, yT, zR);
      for (const side of [-1, 1]) lens(0.36, bh * 1.8, side * Wr * 0.72, yT, zR + 0.005);
    } else if (st.tailLights === 'round' || st.tailLights === 'quad') {
      for (const side of [-1, 1]) {
        lens(0.17, 0.17, side * Wr * 0.7, yT, zR);
        if (st.tailLights === 'quad') lens(0.17, 0.17, side * Wr * 0.42, yT, zR);
      }
    } else if (st.tailLights === 'tall') {
      for (const side of [-1, 1]) lens(0.14, 0.32, side * Wr * 0.7, yT + 0.06, zR - 0.025);
    } else if (st.tailLights === 'oval') {
      for (const side of [-1, 1]) lens(0.3, 0.13, side * Wr * 0.66, yT, zR);
    } else {
      // block / slim : larges optiques horizontales
      for (const side of [-1, 1]) lens(st.tailLights === 'slim' ? 0.46 : 0.4, st.tailLights === 'slim' ? 0.09 : 0.14, side * Wr * 0.64, yT, zR);
    }
    // Jupe arrière noire (pare-chocs bas / diffuseur)
    const botR = shape.bottom(0.99, zR);
    const valH = Math.min(0.14, Math.max(0.07, (p.ys - botR) * 0.3));
    const val = new THREE.Mesh(new THREE.BoxGeometry(Wr * 1.5, valH, 0.06), mats.trim);
    add(val, 0, botR + valH / 2 + 0.03, zR - 0.05);
    // --- Calandre / entrée d'air avant ---
    shape.sectionPoint(0.01, -0.3, p);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(p.W * 1.3, 0.12, 0.08), mats.black);
    add(grille, 0, shape.clear + 0.12 + (st.race ? 0 : 0.05), shape.zFront + 0.05);
    // Plaques d'immatriculation (voitures de route)
    if (!st.race) {
      const plateGeo = new THREE.PlaneGeometry(0.52, 0.11);
      const front = new THREE.Mesh(plateGeo, mats.plate);
      front.rotation.y = Math.PI;
      add(front, 0, shape.clear + 0.24, shape.zFront - 0.012, true);
      const rear = new THREE.Mesh(plateGeo, mats.plate);
      shape.sectionPoint(0.995, 0, p);
      add(rear, 0, lerp(shape.bottom(0.99, p.z), shape.top(0.99), 0.45), shape.zFront + shape.L + 0.012, true);
    }
    // --- Rétroviseurs ---
    if (st.doors !== 0) {
      const tm = st.ws + 0.035;
      shape.sectionPoint(tm, 0.6, p);
      for (const side of [-1, 1]) {
        const mg = new THREE.SphereGeometry(0.075, 12, 8);
        mg.scale(1.1, 0.75, 0.6);
        const m = new THREE.Mesh(mg, this.paint);
        add(m, side * (p.W * st.cabW + 0.1), st.belt * H + 0.06, p.z + 0.05, true);
      }
    }
    // --- Échappements ---
    const exN = spec.engine.cyl >= 8 ? 4 : 2;
    const exG = new THREE.CylinderGeometry(0.045, 0.05, 0.16, 14, 1, true);
    exG.rotateX(Math.PI / 2);
    for (let i = 0; i < exN; i++) {
      const x = exN === 2 ? (i === 0 ? -0.45 : 0.45) * shape.Wmax * 0.9 : (i - 1.5) * 0.14 + (i < 2 ? -0.25 : 0.25);
      add(new THREE.Mesh(exG, mats.chrome), x, shape.clear + 0.1, shape.zFront + shape.L - 0.02, true);
    }
    // --- Aileron ---
    const deckT = (st.rearB + 1) / 2;
    const zDeck = shape.zFront + deckT * shape.L;
    const yDeck = shape.top(deckT);
    if (st.spoiler === 'lip' || st.spoiler === 'duck') {
      const lip = new THREE.Mesh(airfoilGeometry(st.spoiler === 'duck' ? 0.2 : 0.12, 0.04, shape.Wmax * 1.6), this.paint);
      lip.rotation.x = -0.25;
      add(lip, 0, shape.top(0.985) + 0.01, shape.zFront + shape.L * 0.975);
    } else if (st.spoiler === 'roof') {
      const w = new THREE.Mesh(airfoilGeometry(0.22, 0.04, shape.Wmax * st.roofW * 2), this.paint);
      add(w, 0, shape.roof(st.rearB - 0.04) + 0.02, shape.zFront + (st.rearB - 0.03) * shape.L);
    } else if (st.spoiler === 'wing' || st.spoiler === 'lipwing' || this.spec.aeroKit) {
      const span = shape.Wmax * 1.7;
      const w = new THREE.Mesh(airfoilGeometry(0.26, 0.05, span), st.spoiler === 'lipwing' ? mats.carbon : this.paint);
      w.rotation.x = -0.12;
      const hgt = st.spoiler === 'lipwing' ? 0.08 : 0.2;
      add(w, 0, yDeck + hgt, zDeck + 0.05);
      for (const side of [-1, 1]) {
        const stand = new THREE.Mesh(new THREE.BoxGeometry(0.03, hgt + 0.02, 0.12), mats.black);
        add(stand, side * span * 0.32, yDeck + hgt / 2, zDeck + 0.12);
      }
    } else if (st.spoiler === 'gtwing' || st.spoiler === 'protowing') {
      const span = shape.Wmax * (st.spoiler === 'protowing' ? 1.95 : 1.85);
      const hgt = st.spoiler === 'protowing' ? 0.3 : 0.32;
      const zW = shape.zFront + shape.L * 0.93;
      const w = new THREE.Mesh(airfoilGeometry(0.34, 0.06, span), mats.carbon);
      w.rotation.x = -0.2;
      add(w, 0, yDeck + hgt, zW);
      const w2 = new THREE.Mesh(airfoilGeometry(0.16, 0.03, span), mats.carbon);
      w2.rotation.x = -0.55;
      add(w2, 0, yDeck + hgt + 0.06, zW + 0.26);
      for (const side of [-1, 1]) {
        const eps = new THREE.Shape();
        eps.moveTo(-0.1, -0.12); eps.lineTo(0.42, -0.06); eps.lineTo(0.46, 0.14); eps.lineTo(-0.04, 0.12); eps.closePath();
        const epg = new THREE.ExtrudeGeometry(eps, { depth: 0.012, bevelEnabled: false });
        epg.rotateY(-Math.PI / 2);
        const ep = new THREE.Mesh(epg, mats.carbon);
        add(ep, side * span / 2 + 0.006, yDeck + hgt + 0.03, zW - 0.05);
        const stand = new THREE.Mesh(new THREE.BoxGeometry(0.02, hgt + 0.06, 0.16), mats.black);
        add(stand, side * span * 0.28, yDeck + hgt / 2, zW + 0.16);
      }
    }
    // --- Lame avant / diffuseur (course) ---
    if (st.splitter) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(shape.Wmax * 1.9, 0.025, 0.3), mats.carbon);
      add(sp, 0, shape.clear + 0.01, shape.zFront + 0.08);
      for (let i = -3; i <= 3; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.14, 0.42), mats.carbon);
        add(fin, i * 0.18, shape.clear + 0.07, shape.zFront + shape.L - 0.15);
      }
    }
    // --- Dérive (prototype) ---
    if (st.fin) {
      // Dérive dorsale : suit la ligne du toit jusqu'à l'aileron
      const z0 = shape.zFront + st.roofB * shape.L, y0 = shape.roof(st.roofB) - 0.02;
      const z1 = shape.zFront + shape.L * 0.93, y1 = shape.top(0.93);
      const fs = new THREE.Shape();
      fs.moveTo(0, 0);
      fs.lineTo(z1 - z0, y1 - y0 - 0.02);
      fs.lineTo(z1 - z0, y1 - y0 + 0.36);
      fs.quadraticCurveTo((z1 - z0) * 0.4, 0.12, 0, 0.03);
      const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.012, bevelEnabled: false });
      fg.rotateY(-Math.PI / 2);
      const fin = new THREE.Mesh(fg, this.cabinPaint);
      add(fin, 0.006, y0, z0);
    }
    if (st.roofScoop) {
      const sc = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.5), mats.black);
      add(sc, 0, shape.roof(st.roofB) + 0.03, shape.zFront + (st.roofB - 0.02) * shape.L);
    }
    // --- Prises d'air latérales (supercar) ---
    if (st.sideIntake) {
      for (const side of [-1, 1]) {
        const tI = st.roofB + 0.06;
        shape.sectionPoint(tI, -0.05, p);
        const g = new THREE.SphereGeometry(0.2, 16, 10);
        g.scale(0.18, 0.55, 1.5);
        add(new THREE.Mesh(g, mats.black), side * (p.W - 0.03), p.ys - 0.08, p.z + 0.1);
      }
    }
    if (st.hoodVents) {
      for (const side of [-1, 1]) {
        const g = new THREE.BoxGeometry(0.22, 0.03, 0.4);
        add(new THREE.Mesh(g, mats.black), side * 0.32, shape.top(st.ws * 0.6) + 0.005, shape.zFront + st.ws * 0.6 * shape.L);
      }
    }
    // --- Passages de roues (fonds noirs) ---
    for (const za of [shape.zAxleF, shape.zAxleR]) {
      for (const side of [-1, 1]) {
        const g = new THREE.CylinderGeometry(shape.archR, shape.archR, this.spec.wheel.width + 0.14, 20, 1, true, -Math.PI / 2, Math.PI);
        g.rotateZ(Math.PI / 2);
        const m = new THREE.Mesh(g, mats.well);
        m.position.set(side * (shape.track / 2), this.spec.wheel.radius, za);
        this.body.add(m);
      }
    }
  }

  buildWheels(spec, mats, opts) {
    const rimMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(spec.wheel.rimColor), metalness: 0.9, roughness: 0.28 });
    const calCols = { compacte: 0x333333, sport: 0xb01515, gt: 0xd4a017, supercar: 0xd4a017, course: 0xc81010, proto: 0x111111 };
    const caliperMat = new THREE.MeshStandardMaterial({ color: calCols[spec.category] ?? 0x333333, metalness: 0.3, roughness: 0.4 });
    const shape = this.shape;
    this.wheels = [];
    for (let i = 0; i < 4; i++) {
      const front = i < 2, left = i % 2 === 0;
      const wh = buildWheel(spec, left, mats, rimMat, caliperMat);
      const x = (left ? -1 : 1) * spec.dims.track * 0.5;
      const z = front ? shape.zAxleF : shape.zAxleR;
      wh.steer.position.set(x, spec.wheel.radius, z);
      wh.baseY = spec.wheel.radius;
      this.body.add(wh.steer);
      this.wheels.push(wh);
    }
    void opts;
  }

  buildInterior(shape, spec, mats) {
    const st = this.style;
    const H = shape.H;
    const belt = st.belt * H;
    const g = new THREE.Group();
    this.interior = g;
    this.body.add(g);
    const tSeat = lerp(st.roofF, st.roofB, 0.45);
    const zSeat = shape.zFront + tSeat * shape.L;
    const driverX = -shape.Wmax * st.cabW * 0.42;
    this.driverEye = new THREE.Vector3(driverX, belt + (st.roof * H - belt) * 0.55, zSeat - 0.05);
    for (const side of [-1, 1]) {
      if (st.doors === 0 && side > 0) continue;
      const sx = side * Math.abs(driverX);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.5), mats.seat);
      base.position.set(sx, shape.clear + 0.25, zSeat + 0.15);
      g.add(base);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.12), mats.seat);
      back.position.set(sx, shape.clear + 0.58, zSeat + 0.42);
      back.rotation.x = -0.22;
      g.add(back);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.1), mats.seat);
      head.position.set(sx, shape.clear + 0.98, zSeat + 0.53);
      head.rotation.x = -0.22;
      g.add(head);
    }
    // Planche de bord
    const tDash = st.ws + 0.04;
    const zDash = shape.zFront + tDash * shape.L;
    const dash = new THREE.Mesh(new THREE.BoxGeometry(shape.Wmax * st.cabW * 1.85, 0.2, 0.42), mats.interior);
    dash.position.set(0, belt - 0.02, zDash + 0.12);
    g.add(dash);
    // Combiné d'instruments
    const cluster = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.06), mats.black);
    cluster.position.set(driverX, belt + 0.1, zDash + 0.28);
    cluster.rotation.x = -0.4;
    g.add(cluster);
    // Volant
    const wheelZ = zSeat - 0.42;
    const sw = new THREE.Group();
    sw.position.set(driverX, belt + 0.02, wheelZ);
    sw.rotation.x = -0.35 + Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 10, 32), mats.black);
    sw.add(ring);
    const spokeG = new THREE.BoxGeometry(0.34, 0.03, 0.02);
    const sp1 = new THREE.Mesh(spokeG, mats.trim);
    sw.add(sp1);
    const sp2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.02), mats.trim);
    sp2.position.y = -0.09;
    sw.add(sp2);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 16), mats.trim);
    hub.rotation.x = Math.PI / 2;
    sw.add(hub);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), mats.interior);
    col.position.set(0, 0, 0.15);
    col.rotation.x = Math.PI / 2;
    sw.add(col);
    g.add(sw);
    this.steeringWheel = sw;
    // Console centrale
    const cons = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.7), mats.interior);
    cons.position.set(0, shape.clear + 0.3, zSeat - 0.1);
    g.add(cons);
    // Arceau (voitures de course)
    if (st.race) {
      const tubeMat = sharedMat('cage', () => new THREE.MeshStandardMaterial({ color: 0x9a9da3, metalness: 0.8, roughness: 0.4 }));
      const tube = new THREE.CylinderGeometry(0.022, 0.022, 1, 8);
      const roofY = st.roof * H - 0.06;
      for (const side of [-1, 1]) {
        const a = new THREE.Mesh(tube, tubeMat);
        a.scale.y = roofY - shape.clear - 0.2;
        a.position.set(side * shape.Wmax * st.roofW * 0.85, (roofY + shape.clear + 0.2) / 2, zSeat + 0.55);
        g.add(a);
      }
    }
  }

  setColor(hex) {
    this.color = hex;
    // nouvelle livrée
    const liv = liveryTexture({ color: hex, stripe: this.spec.livery ? '#ffffff' : null, number: this.spec.livery ? 7 : null, sponsor: this.spec.livery ? 2 : null, style: this.spec.livery ? 2 : 0 });
    this.paint.map = liv;
    this.cabinPaint.map = liv;
    this.paint.needsUpdate = true;
    this.cabinPaint.needsUpdate = true;
  }

  setLivery(opts) {
    const liv = liveryTexture({ color: this.color, ...opts });
    this.paint.map = liv;
    this.cabinPaint.map = liv;
    this.paint.needsUpdate = this.cabinPaint.needsUpdate = true;
  }

  // Niveau de détail : 0 = complet, 1 = lointain
  setLod(level) {
    if (level === this.lod) return;
    this.lod = level;
    const far = level >= 1;
    for (const w of this.wheels) for (const d of w.details) d.visible = !far;
    if (this.interior) this.interior.visible = !far && this.interiorWanted !== false;
    for (const d of this.detailMeshes || []) d.visible = !far;
  }

  setLights(on) {
    this.lightsOn = on;
    this.headMat.emissiveIntensity = on ? 4 : 0.0;
  }

  setBrake(b) {
    if (Math.abs(b - this.brake) < 0.02) return;
    this.brake = b;
    this.tailMat.emissiveIntensity = (this.lightsOn ? 0.9 : 0.25) + b * 3.2;
  }

  // Met à jour la pose à partir de l'état physique (ou d'un enregistrement de replay).
  syncFromVehicle(v) {
    this.root.position.copy(v.position);
    this.root.quaternion.copy(v.quaternion);
    for (let i = 0; i < 4; i++) {
      const w = v.wheels[i];
      const m = this.wheels[i];
      const y = w.radius + w.Lstatic - w.L;
      m.steer.position.y = y;
      m.steer.rotation.y = -w.steer;
      m.spin.rotation.x = -w.spin;
    }
    if (this.steeringWheel) this.steeringWheel.rotation.z = -v.steerAngle * 12;
    this.setBrake(clamp(v.controls.brake * 1.2, 0, 1));
  }

  // Pose « statique » (vitrine)
  setStatic(steer = 0, spin = 0) {
    for (let i = 0; i < 4; i++) {
      const m = this.wheels[i];
      m.steer.position.y = m.baseY;
      m.steer.rotation.y = i < 2 ? -steer : 0;
      m.spin.rotation.x = -spin;
    }
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.geometry && !o.geometry.__shared) o.geometry.dispose?.();
    });
    this.paint.dispose();
    this.cabinPaint.dispose();
  }
}

export { STYLES };
