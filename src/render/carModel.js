// Modèles de voitures procéduraux : carrosserie par sections lissées (superellipses),
// habitacle vitré, passages de roues, optiques, ailerons, jantes détaillées, intérieur.
import * as THREE from 'three';
import { clamp, lerp, smoothstep, rng } from '../core/utils.js';
import { livery as liveryTexture, fabric, textTexture } from '../world/textures.js';
import { toCreasedNormals, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Profils par style. Hauteurs en fraction de la hauteur totale H ; abscisses t de 0 (avant) à 1 (arrière).
// Arrondis (en mètres) : noseR / noseRB = rayon du bord supérieur / inférieur de la face avant (vue de profil),
// cornerF = arrondi des coins en vue de dessus, w0F = largeur relative au bout du nez ; idem tail* à l'arrière.
// noseY / tailY : hauteur du point le plus saillant (entre garde au sol et bord du capot / du coffre).
const STYLES = {
  hatch: {
    overF: 0.58, nose: 0.5, hood: 0.65, belt: 0.69, deck: 0.72, tail: 0.68, roof: 1.0,
    ws: 0.33, roofF: 0.5, roofB: 0.8, rearB: 0.97, cabW: 0.9, roofW: 0.78, clear: 0.15,
    noseR: 0.16, noseRB: 0.14, noseY: 0.6, nosePow: 3, cornerF: 0.3, w0F: 0.66,
    tailR: 0.1, tailRB: 0.14, tailY: 0.42, tailPow: 3, cornerR: 0.26, w0R: 0.76,
    lights: 'round', tailLights: 'tall', grille: 'bar', spoiler: 'lip', doors: 2, shoulder: 0.78,
  },
  hatch2: {
    overF: 0.58, nose: 0.47, hood: 0.63, belt: 0.68, deck: 0.7, tail: 0.66, roof: 1.0,
    ws: 0.31, roofF: 0.49, roofB: 0.79, rearB: 0.96, cabW: 0.9, roofW: 0.78, clear: 0.14,
    noseR: 0.2, noseRB: 0.14, noseY: 0.6, nosePow: 2.8, cornerF: 0.34, w0F: 0.6,
    tailR: 0.1, tailRB: 0.14, tailY: 0.42, tailPow: 3, cornerR: 0.28, w0R: 0.74,
    lights: 'slim', tailLights: 'tall', grille: 'slot', spoiler: 'roof', doors: 2, shoulder: 0.78,
  },
  roadster: {
    overF: 0.52, nose: 0.43, hood: 0.58, belt: 0.66, deck: 0.7, tail: 0.66, roof: 1.0,
    ws: 0.42, roofF: 0.53, roofB: 0.64, rearB: 0.73, cabW: 0.86, roofW: 0.74, clear: 0.13,
    noseR: 0.26, noseRB: 0.16, noseY: 0.46, nosePow: 2.4, cornerF: 0.45, w0F: 0.5,
    tailR: 0.2, tailRB: 0.15, tailY: 0.45, tailPow: 2.3, cornerR: 0.45, w0R: 0.6,
    lights: 'oval', tailLights: 'oval', grille: 'mouth', spoiler: 'none', doors: 2, softTop: true, shoulder: 0.8,
  },
  coupe: {
    overF: 0.55, nose: 0.44, hood: 0.6, belt: 0.68, deck: 0.73, tail: 0.71, roof: 1.0,
    ws: 0.34, roofF: 0.48, roofB: 0.6, rearB: 0.85, cabW: 0.88, roofW: 0.72, clear: 0.13,
    noseR: 0.22, noseRB: 0.16, noseY: 0.44, nosePow: 2.6, cornerF: 0.42, w0F: 0.56,
    tailR: 0.14, tailRB: 0.15, tailY: 0.45, tailPow: 2.6, cornerR: 0.36, w0R: 0.68,
    lights: 'slim', tailLights: 'slim', grille: 'mouth', spoiler: 'duck', doors: 2, shoulder: 0.78, fenderGap: 0.06,
  },
  sedan: {
    overF: 0.52, nose: 0.47, hood: 0.63, belt: 0.67, deck: 0.71, tail: 0.7, roof: 1.0,
    ws: 0.3, roofF: 0.43, roofB: 0.67, rearB: 0.79, cabW: 0.9, roofW: 0.77, clear: 0.15,
    noseR: 0.16, noseRB: 0.12, noseY: 0.5, nosePow: 3, cornerF: 0.32, w0F: 0.72,
    tailR: 0.1, tailRB: 0.14, tailY: 0.45, tailPow: 3, cornerR: 0.26, w0R: 0.78,
    lights: 'slim', tailLights: 'block', grille: 'mouth', spoiler: 'wing', doors: 4, shoulder: 0.8,
  },
  sedan2: {
    overF: 0.5, nose: 0.45, hood: 0.62, belt: 0.67, deck: 0.71, tail: 0.7, roof: 1.0,
    ws: 0.31, roofF: 0.44, roofB: 0.64, rearB: 0.8, cabW: 0.89, roofW: 0.75, clear: 0.13,
    noseR: 0.2, noseRB: 0.14, noseY: 0.46, nosePow: 2.6, cornerF: 0.4, w0F: 0.64,
    tailR: 0.14, tailRB: 0.14, tailY: 0.45, tailPow: 2.6, cornerR: 0.3, w0R: 0.74,
    lights: 'twin', tailLights: 'block', grille: 'kidney', spoiler: 'lip', doors: 2, shoulder: 0.8, carbonRoof: true,
  },
  gtcoupe: {
    overF: 0.52, nose: 0.46, hood: 0.62, belt: 0.68, deck: 0.73, tail: 0.72, roof: 1.0,
    ws: 0.32, roofF: 0.46, roofB: 0.64, rearB: 0.81, cabW: 0.89, roofW: 0.76, clear: 0.13,
    noseR: 0.15, noseRB: 0.12, noseY: 0.5, nosePow: 3, cornerF: 0.3, w0F: 0.74,
    tailR: 0.08, tailRB: 0.12, tailY: 0.45, tailPow: 3.2, cornerR: 0.22, w0R: 0.8,
    lights: 'slim', tailLights: 'quad', grille: 'mouth', spoiler: 'wing', doors: 2, shoulder: 0.82,
  },
  rearengine: {
    overF: 0.47, nose: 0.42, hood: 0.6, belt: 0.67, deck: 0.74, tail: 0.68, roof: 1.0,
    ws: 0.3, roofF: 0.43, roofB: 0.56, rearB: 0.9, cabW: 0.84, roofW: 0.7, clear: 0.12,
    noseR: 0.32, noseRB: 0.16, noseY: 0.42, nosePow: 2.0, cornerF: 0.55, w0F: 0.48,
    tailR: 0.3, tailRB: 0.14, tailY: 0.5, tailPow: 2.1, cornerR: 0.5, w0R: 0.56,
    lights: 'frog', tailLights: 'bar', grille: 'triple', spoiler: 'wing', doors: 2, shoulder: 0.76, flare: 0.05, fenderGap: 0.05,
  },
  muscle: {
    overF: 0.5, nose: 0.47, hood: 0.63, belt: 0.69, deck: 0.73, tail: 0.71, roof: 1.0,
    ws: 0.44, roofF: 0.56, roofB: 0.66, rearB: 0.84, cabW: 0.84, roofW: 0.68, clear: 0.11,
    noseR: 0.22, noseRB: 0.14, noseY: 0.42, nosePow: 2.6, cornerF: 0.42, w0F: 0.52,
    tailR: 0.14, tailRB: 0.14, tailY: 0.5, tailPow: 2.6, cornerR: 0.4, w0R: 0.68,
    lights: 'slim', tailLights: 'bar', grille: 'mouth', spoiler: 'gtwing', doors: 2, shoulder: 0.82, flare: 0.05, hoodVents: true, fenderGap: 0.05,
  },
  supercar: {
    overF: 0.45, nose: 0.38, hood: 0.62, belt: 0.65, deck: 0.7, tail: 0.68, roof: 1.0,
    ws: 0.27, roofF: 0.42, roofB: 0.52, rearB: 0.82, cabW: 0.8, roofW: 0.64, clear: 0.1,
    noseR: 0.26, noseRB: 0.12, noseY: 0.4, nosePow: 2.5, cornerF: 0.5, w0F: 0.5,
    tailR: 0.12, tailRB: 0.14, tailY: 0.45, tailPow: 3, cornerR: 0.4, w0R: 0.72,
    lights: 'blade', tailLights: 'blade', grille: 'super', spoiler: 'lipwing', doors: 2, shoulder: 0.76, flare: 0.06, sideIntake: true, fenderGap: 0.045,
  },
  gt3: {
    overF: 0.5, nose: 0.42, hood: 0.6, belt: 0.67, deck: 0.73, tail: 0.72, roof: 1.0,
    ws: 0.33, roofF: 0.47, roofB: 0.62, rearB: 0.83, cabW: 0.84, roofW: 0.7, clear: 0.09,
    noseR: 0.22, noseRB: 0.1, noseY: 0.42, nosePow: 2.5, cornerF: 0.45, w0F: 0.6,
    tailR: 0.07, tailRB: 0.1, tailY: 0.5, tailPow: 3.4, cornerR: 0.28, w0R: 0.82,
    lights: 'slim', tailLights: 'bar', grille: 'race', spoiler: 'gtwing', doors: 2, shoulder: 0.8, flare: 0.1, splitter: true, race: true, fenderGap: 0.05,
  },
  proto: {
    overF: 0.5, nose: 0.3, hood: 0.5, belt: 0.6, deck: 0.66, tail: 0.66, roof: 1.0,
    ws: 0.26, roofF: 0.4, roofB: 0.5, rearB: 0.72, cabW: 0.52, roofW: 0.42, clear: 0.07,
    noseR: 0.32, noseRB: 0.1, noseY: 0.35, nosePow: 2.0, cornerF: 0.5, w0F: 0.56,
    tailR: 0.04, tailRB: 0.06, tailY: 0.5, tailPow: 3.5, cornerR: 0.16, w0R: 0.88,
    lights: 'blade', tailLights: 'bar', grille: 'race', spoiler: 'protowing', doors: 0, shoulder: 0.85, flare: 0.08, valley: 0.16, fin: true, splitter: true, race: true, fenderGap: 0.04,
  },
  gt1: {
    overF: 0.52, nose: 0.33, hood: 0.52, belt: 0.62, deck: 0.68, tail: 0.68, roof: 1.0,
    ws: 0.28, roofF: 0.42, roofB: 0.53, rearB: 0.78, cabW: 0.66, roofW: 0.54, clear: 0.08,
    noseR: 0.32, noseRB: 0.1, noseY: 0.36, nosePow: 2.0, cornerF: 0.5, w0F: 0.56,
    tailR: 0.05, tailRB: 0.06, tailY: 0.5, tailPow: 3.4, cornerR: 0.2, w0R: 0.86,
    lights: 'twinround', tailLights: 'round', grille: 'race', spoiler: 'protowing', doors: 2, shoulder: 0.84, flare: 0.08, valley: 0.08, splitter: true, race: true, roofScoop: true, fenderGap: 0.04,
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

// Arrondi en superellipse : 0 à l'extrémité, 1 à la distance R
function roundEase(d, R, p) {
  if (d >= R) return 1;
  const u = 1 - d / R;
  return Math.pow(Math.max(0, 1 - Math.pow(u, p)), 1 / p);
}

const MAT_CACHE = new Map();
function sharedMat(key, make) {
  if (!MAT_CACHE.has(key)) MAT_CACHE.set(key, make());
  return MAT_CACHE.get(key);
}

// Nid d'abeille (calandres, prises d'air)
let HONEY = null;
function honeycombTexture() {
  if (HONEY) return HONEY;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 112;
  const g = c.getContext('2d');
  g.fillStyle = '#020203';
  g.fillRect(0, 0, 64, 112);
  g.strokeStyle = '#3a3d44';
  g.lineWidth = 5;
  const hex = (cx, cy, r) => {
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.closePath();
    g.stroke();
  };
  for (const [x, y] of [[0, 0], [64, 0], [32, 56], [0, 112], [64, 112]]) hex(x, y, 34);
  HONEY = new THREE.CanvasTexture(c);
  HONEY.wrapS = HONEY.wrapT = THREE.RepeatWrapping;
  HONEY.colorSpace = THREE.SRGBColorSpace;
  HONEY.anisotropy = 4;
  return HONEY;
}

export function carMaterials() {
  const decal = (m) => { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2; return m; };
  return {
    glass: sharedMat('glass', () => new THREE.MeshPhysicalMaterial({ color: 0x0a0f14, metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.9, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.3 })),
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
    plate: sharedMat('plate', () => decal(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, map: textTexture('TR-998-AJ', { w: 256, h: 56, bg: '#f4f4f0', fg: '#111', font: 'bold 38px Arial' }) }))),
    lightLens: sharedMat('lightLens', () => decal(new THREE.MeshPhysicalMaterial({ color: 0xcfd6de, metalness: 0.85, roughness: 0.12, clearcoat: 1, emissive: 0xfff2dd, emissiveIntensity: 0.0 }))),
    housing: sharedMat('housing', () => decal(new THREE.MeshPhysicalMaterial({ color: 0x07080b, metalness: 0.4, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.5 }))),
    drl: sharedMat('drl', () => decal(new THREE.MeshStandardMaterial({ color: 0xe8eef8, roughness: 0.3, emissive: 0xe4ecff, emissiveIntensity: 1.6 }))),
    tailHousing: sharedMat('tailHousing', () => decal(new THREE.MeshPhysicalMaterial({ color: 0x2c0306, metalness: 0.2, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.3 }))),
    grille: sharedMat('grille', () => decal(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.3, map: honeycombTexture() }))),
    vent: sharedMat('vent', () => decal(new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.7, metalness: 0.1 }))),
    trimDecal: sharedMat('trimDecal', () => decal(new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.4, metalness: 0.4 }))),
  };
}

// ---------------------------------------------------------------------------
// Génération de la carrosserie
// ---------------------------------------------------------------------------
export class BodyShape {
  constructor(spec) {
    const st = STYLES[spec.style] || STYLES.coupe;
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
    this.zAxleF = -a;
    this.zAxleR = d.wheelbase - a;
    this.r = spec.wheel.radius;
    this.archR = this.r + 0.045;
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
    this._p = {};
  }

  // Profil de la section en t : dessus au centre (top), dessus des ailes (topF), dessous (bot),
  // demi-largeur (W), ligne d'épaule (ys) et facteur d'arrondi des extrémités (e)
  profile(t, out = this._p) {
    const st = this.st;
    const z = this.zFront + t * this.L;
    const dF = t * this.L, dR = (1 - t) * this.L;
    let top = keyInterp(this.topKeys, t);
    // ligne d'ailes : plateau au-dessus des roues (du phare au pare-brise, et de la porte au feu arrière)
    let topF = top;
    if (this.fenderNeed > top) {
      const R = this.archR;
      // montée rapide depuis le phare puis plateau (profil d'aile réel)
      const ramp = (a, b) => { const u = clamp((z - a) / (b - a), 0, 1); return 1 - Math.pow(1 - u, 1.35); };
      const zEnd = this.zFront + this.L;
      const kF = ramp(this.zFront + 0.04, this.zAxleF - R * 0.25) * (1 - smoothstep(this.zAxleF + R * 1.4, this.zAxleF + R * 3.2, z));
      const kR = smoothstep(this.zAxleR - R * 3.2, this.zAxleR - R * 1.4, z) * ramp(zEnd - 0.04, this.zAxleR + R * 0.5);
      const k = Math.max(kF, kR);
      if (k > 0) topF = lerp(top, this.fenderNeed, k);
    }
    let bot = this.clear;
    for (const za of [this.zAxleF, this.zAxleR]) {
      const dz = z - za;
      const R = this.archR;
      if (Math.abs(dz) < R) bot = Math.max(bot, this.r + Math.sqrt(R * R - dz * dz) * 0.97);
    }
    // arrondis avant / arrière (profil et vue en plan)
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

  // Altitude du dessus (centre) de la caisse inférieure
  top(t) {
    return this.profile(t).top;
  }

  bottom(t) {
    return this.profile(t).bot;
  }

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
    // creux central entre les ailes avant (prototypes), s'estompe vers l'habitacle
    return this.st.valley * (1 - smoothstep(this.st.ws - 0.08, this.st.ws + 0.04, t)) +
      this.st.valley * 0.6 * smoothstep(this.st.rearB - 0.05, this.st.rearB + 0.05, t);
  }

  // Point de la section (côté droit) pour un angle θ ∈ [-π/2, π/2]
  sectionPoint(t, theta, out) {
    const P = this.profile(t, out);
    const { top, topF, bot, W, ys } = P;
    let x, y;
    const c = Math.abs(Math.abs(theta) - Math.PI / 2) < 1e-9 ? 0 : Math.cos(theta), s = Math.sin(theta);
    if (theta < 0) {
      const n = this.st.nL ?? 6;
      x = W * Math.pow(Math.abs(c), 2 / n);
      y = ys - (ys - bot) * Math.pow(Math.abs(s), 2 / n);
      // flanc légèrement creusé sous la ligne de caractère
      x -= W * 0.016 * Math.sin(Math.min(1, -theta / 0.9) * Math.PI);
    } else {
      const n = this.st.nU ?? 4.5;
      x = W * Math.pow(Math.abs(c), 2 / n);
      y = ys + (topF - ys) * Math.pow(Math.abs(s), 2 / n);
      // capot plus bas que les ailes (+ creux des prototypes)
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
      const k = st.rearB > 0.95 ? Math.pow(u, 2.2) : 1 - Math.pow(1 - u, 1.4);
      return roofH * 0.975 + (end - roofH * 0.975) * k;
    }
    return st.deck * H;
  }
}

// ---------------------------------------------------------------------------
// Projection sur la carrosserie : optiques, calandres, plaques… épousent exactement la surface
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
    const P = this.P, bb = new Float32Array(this.n * 4);
    for (let i = 0; i < this.n; i++) {
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (let k = 0; k < 3; k++) {
        const o = i * 9 + k * 3;
        const pu = P[o] * u.x + P[o + 1] * u.y + P[o + 2] * u.z;
        const pv = P[o] * v.x + P[o + 1] * v.y + P[o + 2] * v.z;
        if (pu < u0) u0 = pu; if (pu > u1) u1 = pu;
        if (pv < v0) v0 = pv; if (pv > v1) v1 = pv;
      }
      bb[i * 4] = u0 - 1e-5; bb[i * 4 + 1] = u1 + 1e-5; bb[i * 4 + 2] = v0 - 1e-5; bb[i * 4 + 3] = v1 + 1e-5;
    }
    f = { d: d.clone(), u, v, bb };
    this.frames.set(key, f);
    return f;
  }

  // Premier impact du rayon (o, f.d) : position et normale lissée
  cast(o, f, out) {
    const { d, u, v, bb } = f, P = this.P;
    const ou = o.x * u.x + o.y * u.y + o.z * u.z, ov = o.x * v.x + o.y * v.y + o.z * v.z;
    let best = Infinity, bi = -1, bu = 0, bv = 0;
    for (let i = 0; i < this.n; i++) {
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

// Décalque projeté : contour en superellipse (demi-axes a, b, exposant n, rotation, effilement)
// centré en c dans le plan (a1, a2), projeté selon dir puis décollé de « off » le long de la normale.
function decalGeometry(proj, o) {
  const f = proj.frame(o.dir);
  const n = o.n ?? 2, rot = o.rot ?? 0, taper = o.taper ?? 0, off = o.off ?? 0.004;
  const rings = o.rings ?? 4, seg = o.seg ?? 36;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const shape2 = (phi, s) => {
    const c = Math.cos(phi), si = Math.sin(phi);
    let x = o.a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * s;
    let y = o.b * Math.sign(si) * Math.pow(Math.abs(si), 2 / n) * s;
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
  const pushV = (x, y, xr, yr) => {
    if (!castAt(xr, yr)) return false;
    pos.push(hit.p.x + hit.n.x * off, hit.p.y + hit.n.y * off, hit.p.z + hit.n.z * off);
    nor.push(hit.n.x, hit.n.y, hit.n.z);
    if (o.uvScale) uv.push(xr * o.uvScale, yr * o.uvScale);
    else uv.push(0.5 + x / (2 * o.a), 0.5 + y / (2 * o.b));
    return true;
  };
  if (!pushV(0, 0, 0, 0)) return null;
  // portée radiale par direction (le contour peut déborder de la silhouette)
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
    for (let r = 1; r <= rings; r++) {
      q = shape2(phi, (sMax * r) / rings);
      if (!pushV(q[0], q[1], q[2], q[3])) {
        pos.push(...pos.slice(-3)); nor.push(...nor.slice(-3)); uv.push(...uv.slice(-2));
      }
    }
  }
  const vid = (j, r) => 1 + (j % seg) * rings + (r - 1);
  const flip = new THREE.Vector3().crossVectors(o.a1, o.a2).dot(o.dir) > 0;
  const tri = (a, b, c) => (flip ? idx.push(a, c, b) : idx.push(a, b, c));
  for (let j = 0; j < seg; j++) {
    tri(0, vid(j, 1), vid(j + 1, 1));
    for (let r = 1; r < rings; r++) {
      const a = vid(j, r), b = vid(j + 1, r), c = vid(j + 1, r + 1), d = vid(j, r + 1);
      tri(a, d, c);
      tri(a, c, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
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

export function buildBodyGeometry(shape, spec) {
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
  void capFan;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  safeNormals(g);
  // Arêtes vives (ligne d'épaule, bords de capot) : normales lissées sous 24°
  const creased = toCreasedNormals(g, (24 * Math.PI) / 180);
  safeNormals2(creased);
  return creased;
}

function safeNormals2(g) {
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) {
    const l = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
    if (!(l > 1e-6) || !isFinite(l)) n.setXYZ(i, 0, 1, 0);
  }
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

// ---------------------------------------------------------------------------
const GEO_CACHE = new Map();
function markShared(g) {
  g.__shared = true;
  return g;
}

function mirrorGeometry(g) {
  const m = g.clone();
  const pa = m.attributes.position, na = m.attributes.normal;
  for (let i = 0; i < pa.count; i++) {
    pa.setX(i, -pa.getX(i));
    na.setX(i, -na.getX(i));
  }
  const idx = m.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  return m;
}

// Optiques avant : [matériau, fx (fraction de la demi-largeur), fy (fraction de la face avant), a, b (demi-axes, m), options]
const HEAD = {
  round: [['housing', 0.66, 0.74, 0.13, 0.075, { n: 3.2 }], ['lens', 0.69, 0.74, 0.085, 0.052, { n: 3, off: 0.007 }], ['lens', 0.5, 0.74, 0.03, 0.03, { off: 0.007 }]],
  twinround: [['housing', 0.62, 0.8, 0.16, 0.07, { n: 2.4, rot: 0.12 }], ['lens', 0.72, 0.82, 0.05, 0.05, { off: 0.007 }], ['lens', 0.53, 0.79, 0.05, 0.05, { off: 0.007 }]],
  oval: [['housing', 0.63, 0.74, 0.15, 0.07, { n: 2.2, rot: 0.14 }], ['lens', 0.62, 0.74, 0.105, 0.045, { n: 2.2, rot: 0.14, off: 0.007 }]],
  slim: [['housing', 0.66, 0.8, 0.22, 0.064, { n: 3, rot: 0.1, taper: -0.35 }], ['lens', 0.75, 0.83, 0.055, 0.04, { off: 0.007 }], ['lens', 0.6, 0.8, 0.045, 0.032, { off: 0.007 }], ['drl', 0.65, 0.74, 0.19, 0.009, { n: 4, rot: 0.1, off: 0.0085 }]],
  twin: [['housing', 0.64, 0.75, 0.19, 0.062, { n: 4.5 }], ['lens', 0.73, 0.75, 0.052, 0.052, { off: 0.007 }], ['lens', 0.55, 0.75, 0.052, 0.052, { off: 0.007 }], ['drl', 0.64, 0.7, 0.17, 0.008, { n: 4, off: 0.0085 }]],
  blade: [['housing', 0.7, 1.02, 0.23, 0.042, { n: 3, rot: 0.2, taper: -0.55 }], ['drl', 0.69, 0.99, 0.2, 0.0075, { n: 4, rot: 0.2, off: 0.0085 }], ['lens', 0.78, 1.05, 0.05, 0.022, { rot: 0.2, off: 0.007 }]],
  frog: [['housing', 0, 0, 0.1, 0.1, { n: 2 }], ['lens', 0, 0, 0.078, 0.078, { n: 2, off: 0.007 }], ['drl', 0, 0, 0.024, 0.024, { off: 0.0085 }]],
};
// Feux arrière (aW : demi-largeur en fraction de la caisse ; center : décalque unique centré)
const TAIL = {
  tall: [['tail', 0.84, 0.74, 0.065, 0.13, { n: 3 }], ['tailLed', 0.84, 0.77, 0.04, 0.085, { n: 3, off: 0.007 }]],
  slim: [['tail', 0.74, 0.8, 0.2, 0.05, { n: 3, rot: -0.06, taper: -0.3 }], ['tailLed', 0.75, 0.8, 0.17, 0.013, { n: 4, rot: -0.06, off: 0.007 }]],
  oval: [['tail', 0.72, 0.74, 0.14, 0.065, { n: 2.3 }], ['tailLed', 0.72, 0.74, 0.09, 0.035, { n: 2.3, off: 0.007 }]],
  block: [['tail', 0.72, 0.76, 0.19, 0.075, { n: 4 }], ['tailLed', 0.76, 0.78, 0.11, 0.035, { n: 4, off: 0.007 }]],
  quad: [['tail', 0.8, 0.74, 0.075, 0.075, {}], ['tail', 0.56, 0.74, 0.075, 0.075, {}], ['tailLed', 0.8, 0.74, 0.05, 0.05, { off: 0.007 }], ['tailLed', 0.56, 0.74, 0.05, 0.05, { off: 0.007 }]],
  bar: [['tail', 0, 0.8, 0, 0.034, { n: 8, aW: 0.86, center: true }], ['tailLed', 0, 0.8, 0, 0.01, { n: 6, aW: 0.84, center: true, off: 0.007 }], ['tail', 0.78, 0.8, 0.15, 0.05, { n: 4, off: 0.005 }], ['tailLed', 0.8, 0.8, 0.12, 0.022, { n: 4, off: 0.0075 }]],
  blade: [['tail', 0.76, 0.84, 0.2, 0.034, { n: 3, rot: -0.1, taper: -0.5 }], ['tailLed', 0.76, 0.84, 0.18, 0.009, { n: 4, rot: -0.1, off: 0.007 }], ['tailLed', 0, 0.84, 0, 0.006, { n: 6, aW: 0.5, center: true, off: 0.006 }]],
  round: [['tail', 0.76, 0.76, 0.07, 0.07, {}], ['tail', 0.52, 0.76, 0.065, 0.065, {}], ['tailLed', 0.76, 0.76, 0.045, 0.045, { off: 0.007 }], ['tailLed', 0.52, 0.76, 0.04, 0.04, { off: 0.007 }]],
};
// Calandres et entrées d'air
const GRILLE = {
  bar: [['grille', 0, 0.74, 0.29, 0.05, { n: 6, center: true }], ['vent', 0, 0.26, 0.5, 0.055, { n: 5, center: true }]],
  slot: [['grille', 0, 0.8, 0.26, 0.028, { n: 5, center: true }], ['grille', 0, 0.3, 0.46, 0.075, { n: 4, center: true }]],
  mouth: [['grille', 0, 0.38, 0.42, 0.1, { n: 3.4, center: true }]],
  kidney: [['grille', 0.13, 0.74, 0.085, 0.06, { n: 3 }], ['grille', 0, 0.3, 0.44, 0.07, { n: 4, center: true }], ['vent', 0.68, 0.3, 0.1, 0.04, { n: 3 }]],
  triple: [['grille', 0, 0.3, 0.2, 0.05, { n: 4, center: true }], ['grille', 0.64, 0.32, 0.13, 0.06, { n: 3 }]],
  super: [['grille', 0, 0.36, 0.3, 0.07, { n: 3, center: true }], ['grille', 0.66, 0.36, 0.15, 0.085, { n: 3, rot: -0.15 }]],
  race: [['grille', 0, 0.42, 0.4, 0.095, { n: 4, center: true }], ['vent', 0.72, 0.42, 0.12, 0.07, { n: 3 }]],
};

// Construit tous les décalques d'une voiture, regroupés par matériau (un seul objet par matériau)
function buildDecals(shape, spec, bodyGeo) {
  const st = shape.st, H = shape.H, W = shape.Wmax;
  const proj = new SurfaceProjector(bodyGeo);
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Zp = new THREE.Vector3(0, 0, 1);
  const nX = X.clone().negate(), nY = Y.clone().negate(), nZ = Zp.clone().negate();
  const zF = shape.zFront, zR = shape.zFront + shape.L;
  const fLow = shape.clear + 0.04, fTop = st.nose * H;
  const rLow = shape.clear + 0.04, rTop = st.tail * H;
  const groups = {};
  const put = (key, g, mirror) => {
    if (!g) return;
    (groups[key] || (groups[key] = [])).push(g);
    if (mirror) groups[key].push(mirrorGeometry(g));
  };
  const place = (list, face) => {
    for (const [key, fx, fy, a, b, o] of list) {
      const aa = o.aW ? o.aW * W : a;
      let c, a1, a2, dir;
      if (face === 'front') {
        c = new THREE.Vector3(fx * W, lerp(fLow, fTop, fy), zF - 0.05);
        a1 = o.center ? nX : X; a2 = Y; dir = Zp;
      } else {
        c = new THREE.Vector3(fx * W, lerp(rLow, rTop, fy), zR + 0.05);
        a1 = X; a2 = Y; dir = nZ;
      }
      const g = decalGeometry(proj, { c, a1, a2, dir, a: aa, b, ...o, uvScale: key === 'grille' ? 25 : o.uvScale });
      put(key, g, !o.center);
    }
  };
  // optiques avant
  if (st.lights === 'frog') {
    // phares ronds sur le dessus des ailes (regard vers l'avant et le haut)
    const dir = new THREE.Vector3(0, -0.5, 0.866);
    const a2 = Y.clone().addScaledVector(dir, -Y.dot(dir)).normalize();
    const zc = zF + 0.3;
    const yc = shape.profile((zc - zF) / shape.L).topF + 0.3;
    for (const [key, , , a, b, o] of HEAD.frog) {
      const c = new THREE.Vector3(W * 0.66, yc, zc).addScaledVector(dir, -0.6);
      put(key, decalGeometry(proj, { c, a1: X, a2, dir, a, b, ...o }), true);
    }
  } else place(HEAD[st.lights] || HEAD.slim, 'front');
  place(GRILLE[st.grille] || GRILLE.mouth, 'front');
  place(TAIL[st.tailLights] || TAIL.slim, 'rear');
  // jupe arrière / diffuseur
  place([['vent', 0, 0.1, 0, st.race ? 0.11 : 0.075, { n: 6, aW: st.race ? 0.9 : 0.78, center: true }]], 'rear');
  // plaques d'immatriculation (voitures de route)
  if (!st.race) {
    place([['plate', 0, st.grille === 'bar' || st.grille === 'kidney' || st.grille === 'slot' ? 0.5 : 0.3, 0.26, 0.056, { n: 12, center: true, off: 0.009 }]], 'front');
    place([['plate', 0, 0.44, 0.26, 0.056, { n: 12, center: true, off: 0.006 }]], 'rear');
  }
  // prises d'air latérales (supercar)
  if (st.sideIntake) {
    const z = shape.zAxleR - shape.archR - 0.42;
    const P = shape.profile((z - zF) / shape.L);
    put('grille', decalGeometry(proj, { c: new THREE.Vector3(W + 0.1, P.ys - 0.13, z), a1: nZ, a2: Y, dir: nX, a: 0.3, b: 0.1, n: 3, rot: 0.14, taper: -0.5, uvScale: 25 }), true);
  }
  // ouïes de capot (muscle)
  if (st.hoodVents) {
    const t = st.ws * 0.5, z = zF + t * shape.L;
    put('vent', decalGeometry(proj, { c: new THREE.Vector3(0.3, H + 0.3, z), a1: X, a2: nZ, dir: nY, a: 0.1, b: 0.2, n: 4 }), true);
  }
  // poignées de portes
  if (st.doors > 0) {
    const tD = st.doors === 4 ? lerp(st.roofF, st.roofB, 0.48) : st.roofB - 0.02;
    const z = zF + tD * shape.L - 0.16;
    const P = shape.profile(tD - 0.035);
    put('trim', decalGeometry(proj, { c: new THREE.Vector3(W + 0.1, P.ys - 0.06, z), a1: nZ, a2: Y, dir: nX, a: 0.07, b: 0.013, n: 4, off: 0.005 }), true);
    if (st.doors === 4) {
      const z2 = zF + (st.roofB + 0.03) * shape.L - 0.16;
      put('trim', decalGeometry(proj, { c: new THREE.Vector3(W + 0.1, P.ys - 0.06, z2), a1: nZ, a2: Y, dir: nX, a: 0.07, b: 0.013, n: 4, off: 0.005 }), true);
    }
  }
  const geos = {};
  for (const [key, list] of Object.entries(groups)) geos[key] = markShared(mergeGeometries(list, false));
  // extrémité des échappements : juste derrière le bouclier
  const exhaustZ = [];
  const f = proj.frame(nZ);
  const hit = { p: new THREE.Vector3(), n: new THREE.Vector3() };
  const exN = spec.engine.cyl >= 8 ? 4 : 2;
  for (let i = 0; i < exN; i++) {
    const x = exN === 2 ? (i === 0 ? -0.45 : 0.45) * W * 0.9 : (i - 1.5) * 0.14 + (i < 2 ? -0.25 : 0.25);
    const h = proj.cast(new THREE.Vector3(x, shape.clear + 0.1, zR + 2), f, hit);
    exhaustZ.push(h ? Math.min(zR, h.p.z + 0.03) : zR - 0.12);
  }
  return { geos, exhaustZ };
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
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.15,
    });
    this.cabinPaint = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: liv,
      metalness: this.paint.metalness,
      roughness: this.paint.roughness,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.15,
    });
    // Géométries partagées entre les voitures identiques (grilles de départ)
    const key = `${spec.id}|${spec.style}|${spec.lowered || 0}|${spec.wheel.radius}|${spec.weightFront}|${Object.values(spec.dims).join(',')}`;
    if (!GEO_CACHE.has(key)) GEO_CACHE.set(key, {});
    this.cache = GEO_CACHE.get(key);
    const bodyGeo = this.cache.body || (this.cache.body = markShared(buildBodyGeometry(shape, spec)));
    const bodyMesh = new THREE.Mesh(bodyGeo, this.paint);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.body.add(bodyMesh);
    this.bodyMesh = bodyMesh;

    const cabGeo = this.cache.cab || (this.cache.cab = markShared(buildCabinGeometry(shape)));
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
    // --- Optiques, calandres, plaques, prises d'air : décalques projetés sur la caisse ---
    this.headMat = mats.lightLens.clone();
    this.tailMat = new THREE.MeshPhysicalMaterial({ color: 0x5a0007, emissive: 0xff1a10, emissiveIntensity: 0.5, roughness: 0.15, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    const dec = this.cache.decals || (this.cache.decals = buildDecals(shape, spec, this.bodyMesh.geometry));
    const matOf = { housing: mats.housing, lens: this.headMat, drl: mats.drl, tail: mats.tailHousing, tailLed: this.tailMat, grille: mats.grille, vent: mats.vent, plate: mats.plate, trim: mats.trimDecal };
    for (const [key, g] of Object.entries(dec.geos)) {
      const m = new THREE.Mesh(g, matOf[key]);
      m.renderOrder = 1;
      const detail = key === 'plate' || key === 'trim';
      add(m, 0, 0, 0, detail);
      m.castShadow = false;
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
      const zEnd = dec.exhaustZ[i] ?? shape.zFront + shape.L - 0.05;
      add(new THREE.Mesh(exG, mats.chrome), x, shape.clear + 0.1, zEnd - 0.07, true);
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
      const sp = new THREE.Mesh(new THREE.BoxGeometry(shape.Wmax * 1.62, 0.025, 0.3), mats.carbon);
      add(sp, 0, shape.clear + 0.01, shape.zFront + 0.12);
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
    // --- Passages de roues (fonds noirs) ---
    for (const za of [shape.zAxleF, shape.zAxleR]) {
      for (const side of [-1, 1]) {
        // fond de passage de roue : reste à l'intérieur de la carrosserie
        const wBody = shape.halfWidth((za - shape.zFront) / shape.L, za) - 0.03;
        const inner = shape.track / 2 - this.spec.wheel.width / 2 - 0.08;
        const len = Math.max(0.1, wBody - inner);
        const g = new THREE.CylinderGeometry(shape.archR, shape.archR, len, 20, 1, true, -0.12, Math.PI + 0.24);
        g.rotateZ(Math.PI / 2);
        const m = new THREE.Mesh(g, mats.well);
        m.position.set(side * (inner + len / 2), this.spec.wheel.radius, za);
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
