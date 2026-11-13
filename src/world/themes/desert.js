// Décor « désert » (Circuit des Dunes) : dunes et broussailles, palmeraies, tribunes
// modernes à voiles blanches, tour de contrôle, hôtel enjambant la piste sous une
// résille lumineuse, tour-voile au loin, mâts d'éclairage.
import * as THREE from 'three';
import { InstancedForest } from '../vegetation.js';
import { surfaceY } from '../trackMesh.js';
import * as TX from '../textures.js';
import { boxWorldUV, mat, frameAt, infieldSide, glassFacade, floodlightPoles, lightPools, catchFence, canvasTexture, makeCanvas, marshalPosts, bigScreen, roadWash } from './common.js';

export function buildDesert(sc) {
  const t = sc.track;
  const r = sc.r;
  const q = sc.quality.trees;
  const infield = infieldSide(t);
  const iStart = t.indexAt(t.startS);

  // ---------------------------------------------------------------- Végétation
  const f = sc.forest(InstancedForest, 13);
  // broussailles éparses dans le sable
  sc.scatter(f, Math.round(1500 * q), ['shrub'], { clump: 140, threshold: -0.2, minClear: 4, maxSlope: 0.6 });
  // palmeraies (bosquets denses)
  for (let k = 0; k < 26; k++) {
    const p = sc.findSpot(22, k < 12 ? 90 : 260, 30);
    if (!p) continue;
    const n = 8 + Math.floor(r() * 14);
    for (let j = 0; j < n; j++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 32;
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (sc.clearance(x, z) < 6) continue;
      f.add('datepalm', 3, x, sc.groundAt(x, z) - 0.2, z, 0.85 + r() * 0.35, r() * 6.3);
    }
  }
  // alignements de palmiers le long de la ligne droite des stands et de la section de l'hôtel
  const fr = {};
  for (let i = 0; i < t.count; i += 6) {
    const ds = Math.abs(t.sArr[i] - t.startS);
    const nearStart = Math.min(ds, t.length - ds) < 420;
    // ailleurs : alignements par tronçons (oasis le long des lignes droites)
    if (!nearStart && (Math.sin(t.sArr[i] / 170 + 0.7) < 0.35 || r() < 0.25)) continue;
    for (const side of [-1, 1]) {
      const wall = side > 0 ? t.wallR[i] : t.wallL[i];
      frameAt(t, i, side * (wall + 7 + r() * 3), fr);
      if (sc.clearance(fr.x, fr.z) < 5) continue;
      f.add('datepalm', 3, fr.x, sc.groundAt(fr.x, fr.z) - 0.2, fr.z, 1 + r() * 0.25, r() * 6.3);
    }
  }
  f.build(450, true, 300);

  // ---------------------------------------------------------------- Zone des stands
  sc.grandstand(iStart, -infield, 240, 15);
  sc.pitBuilding(iStart, infield, 280);
  sailCanopy(sc, iStart, -infield, 240);
  controlTower(sc, t.idx(iStart + Math.round(170 / t.spacing)), infield);
  // tribunes de virage : extérieur des quatre virages les plus serrés (loin des stands)
  const corners = [];
  for (let i = 0; i < t.count; i++) {
    const k = Math.abs(t.kappa[i]);
    if (k < 1 / 60) continue;
    const ds = Math.abs(t.sArr[i] - t.startS);
    if (Math.min(ds, t.length - ds) < 300) continue;
    const near = corners.find((c) => Math.abs(t.sArr[c] - t.sArr[i]) < 250);
    if (near === undefined) corners.push(i);
    else if (k > Math.abs(t.kappa[near])) corners[corners.indexOf(near)] = i;
  }
  corners.sort((a, b) => Math.abs(t.kappa[b]) - Math.abs(t.kappa[a]));
  for (const i of corners.slice(0, 4)) {
    // tribune décalée vers l'entrée du virage (zone de freinage)
    const j = t.idx(i - Math.round(40 / t.spacing));
    sc.grandstand(j, t.kappa[i] > 0 ? -1 : 1, 90, 10);
  }
  // écrans géants face aux tribunes de virage
  for (const i of corners.slice(0, 2)) bigScreen(sc, t.idx(i + Math.round(30 / t.spacing)), t.kappa[i] > 0 ? 1 : -1, { back: 18 });

  // ---------------------------------------------------------------- Hôtel enjambant la piste
  hotel(sc);

  // ---------------------------------------------------------------- Tour-voile (repère lointain)
  const b = t.bounds;
  sailTower(sc, b.maxX + 900, b.minZ - 700, -0.6);

  // ---------------------------------------------------------------- Éclairage, grillages, panneaux
  const lit = sc.night ? 1.2 : sc.env.preset.elev < 10 ? 0.8 : 0;
  const pools = floodlightPoles(sc, { step: 66, height: 17, offset: 3, lit, poolR: 20 });
  if (sc.night) {
    // circuit éclairé comme en plein jour : flaques sous les mâts et lumière diffuse
    lightPools(sc.group, pools, 'rgba(255,222,180,0.3)', 'poolDesert');
    roadWash(sc, () => [0.045, 0.042, 0.036]);
  }
  catchFence(sc, { sides: [-infield], fromH: 0.8, toH: 3.6, filter: (i) => { const d = Math.abs(t.sArr[i] - t.startS); return Math.min(d, t.length - d) < 300; } });
  marshalPosts(sc, { step: 300, offset: 5, skip: (i) => { const d = Math.abs(t.sArr[i] - t.startS); return Math.min(d, t.length - d) < 200; } });
  sc.buildBillboards();
}

// Voile tendue blanche au-dessus de la tribune principale (profil en vague)
function sailCanopy(sc, i0, side, length) {
  const t = sc.track;
  const m = sc.cachedMat('sail', () => new THREE.MeshStandardMaterial({ color: 0xf6f4ef, roughness: 0.6, side: THREE.DoubleSide, emissive: 0xffe4c0, emissiveIntensity: sc.night ? 0.25 : 0 }));
  const count = Math.round(length / t.spacing);
  const start = t.idx(i0 - Math.floor(count / 2));
  const prof = [];
  for (let k = 0; k <= 8; k++) {
    const u = k / 8;
    prof.push([1 + u * 22, 13.5 + Math.sin(u * Math.PI) * 3.5 + u * 4]);
  }
  sc.extrude(start, count, side, prof, m, { uS: 20, vS: 20, step: 2 });
  // mâts obliques
  const pole = new THREE.CylinderGeometry(0.25, 0.35, 24, 6);
  const pm = sc.cachedMat('gsSteel', () => new THREE.MeshStandardMaterial({ color: 0x4a4e56, metalness: 0.6, roughness: 0.5 }));
  const f = {};
  for (let k = 0; k <= count; k += 16) {
    const i = t.idx(start + k);
    const wall = side > 0 ? t.wallR[i] : t.wallL[i];
    frameAt(t, i, side * (wall + 24), f);
    const y = surfaceY(t, i, side * wall);
    sc.bin.add('gsSteel', pm, pole, mat(f.x, y + 11, f.z));
  }
}

// Tour de contrôle : fût élancé, coursive vitrée et coiffe en disque
function controlTower(sc, i, side) {
  const t = sc.track;
  const f = frameAt(t, i, side * ((side > 0 ? t.wallR[i] : t.wallL[i]) + 36), {});
  if (sc.clearance(f.x, f.z) < 14) return;
  const y = sc.groundAt(f.x, f.z);
  const white = sc.cachedMat('towerWhite', () => new THREE.MeshStandardMaterial({ map: TX.concrete(235), color: 0xffffff, roughness: 0.55 }));
  const glass = glassFacade(3, { night: sc.night, tint: [30, 60, 80], lit: 0.8, cols: 12, rows: 3 });
  const glassM = sc.cachedMat('towerGlass', () => new THREE.MeshStandardMaterial({ map: glass.map, emissiveMap: glass.emissiveMap, emissive: 0xffffff, emissiveIntensity: sc.night ? 1.2 : 0, roughness: 0.15, metalness: 0.6 }));
  sc.bin.add('towerWhite', white, new THREE.CylinderGeometry(3.2, 4.2, 38, 16), mat(f.x, y + 19, f.z));
  sc.bin.add('towerGlass', glassM, new THREE.CylinderGeometry(8, 6.5, 6, 20, 1), mat(f.x, y + 41, f.z));
  sc.bin.add('towerWhite', white, new THREE.CylinderGeometry(11, 8, 1.6, 24), mat(f.x, y + 44.8, f.z));
  sc.bin.add('towerWhite', white, new THREE.CylinderGeometry(0.3, 0.5, 12, 6), mat(f.x, y + 51, f.z));
}

// Hôtel de luxe à cheval sur la piste : deux ailes vitrées, une passerelle au-dessus de la
// chaussée et une grande résille en losanges, illuminée au crépuscule.
function hotel(sc) {
  const t = sc.track;
  // emplacement donné par le circuit, sinon la ligne droite la plus calme du dernier tiers
  const at = t.def.decor?.hotel;
  const i = at ? t.nearestGlobal(at[0], at[1]) : calmestStraight(t, 0.66, 1);
  const f = frameAt(t, i, 0, {});
  const y0 = t.py[i];
  const wl = t.wallL[i], wr = t.wallR[i];
  const glass = glassFacade(7, { night: sc.night || sc.env.preset.elev < 10, tint: [62, 92, 108], lit: 0.5, cols: 10, rows: 9, vary: 0.12, slab: 0.2, frame: '#e9ecef' });
  const gm = sc.cachedMat('hotelGlass', () => new THREE.MeshStandardMaterial({ map: glass.map, emissiveMap: glass.emissiveMap, emissive: 0xffffff, emissiveIntensity: sc.night ? 1.4 : 0.6, roughness: 0.12, metalness: 0.65 }));
  const white = sc.cachedMat('towerWhite', () => new THREE.MeshStandardMaterial({ map: TX.concrete(235), color: 0xffffff, roughness: 0.55 }));
  const L = 120, D = 24, H = 28;
  for (const side of [-1, 1]) {
    const off = (side > 0 ? wr : wl) + 9 + D / 2;
    const cx = f.x + f.rx * off * side, cz = f.z + f.rz * off * side;
    // façade : un motif = 10 travées de 3,2 m x 9 étages de 3,1 m
    const g = boxWorldUV(D, H, L, 32, 28);
    sc.bin.add('hotelGlass', gm, g, mat(cx, y0 + H / 2 - 0.5, cz, f.rot));
    sc.bin.add('towerWhite', white, new THREE.BoxGeometry(D + 1.5, 1.2, L + 1.5), mat(cx, y0 + H + 0.1, cz, f.rot));
  }
  // passerelle au-dessus de la piste
  const span = wl + wr + 18;
  const bx = f.x + f.rx * (wr - wl) / 2, bz = f.z + f.rz * (wr - wl) / 2;
  const bridge = boxWorldUV(span, 5, 18, 32, 28);
  sc.bin.add('hotelGlass', gm, bridge, mat(bx, y0 + 14.5, bz, f.rot + Math.PI / 2));
  sc.bin.add('towerWhite', white, new THREE.BoxGeometry(span, 0.8, 19), mat(bx, y0 + 11.6, bz, f.rot + Math.PI / 2));
  // résille (coque en losanges) couvrant l'ensemble
  const W = Math.max(wl, wr) + 9 + D + 8;
  const NU = 30, NV = 22;
  const pos = [], uvs = [], idx = [];
  for (let a = 0; a <= NU; a++) {
    const u = a / NU * 2 - 1; // le long de la piste
    for (let b2 = 0; b2 <= NV; b2++) {
      const v = b2 / NV * 2 - 1; // en travers
      const along = u * (L / 2 + 22);
      const across = v * W;
      // coque : bombée au centre, retombe sur les bords et aux extrémités
      const hh = 18 + 20 * Math.pow(Math.cos((v * Math.PI) / 2), 0.7) * (1 - Math.pow(Math.abs(u), 5)) - 6 * Math.pow(Math.abs(u), 3);
      const x = bx + f.dx * along + f.rx * across, z = bz + f.dz * along + f.rz * across;
      pos.push(x, y0 + Math.max(hh, 12), z);
      uvs.push(along / 6, across / 6 + along / 6);
    }
  }
  for (let a = 0; a < NU; a++)
    for (let b2 = 0; b2 < NV; b2++) {
      const k = a * (NV + 1) + b2;
      idx.push(k, k + 1, k + NV + 1, k + 1, k + NV + 2, k + NV + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const lattice = latticeTexture();
  const glow = sc.night ? 1.6 : sc.env.preset.elev < 10 ? 0.9 : 0;
  const lm = new THREE.MeshStandardMaterial({ map: lattice, emissiveMap: lattice, emissive: new THREE.Color(0.55, 0.45, 1.0), emissiveIntensity: glow, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.3, metalness: 0.5 });
  const shell = new THREE.Mesh(g, lm);
  shell.renderOrder = 3;
  sc.group.add(shell);
  // animation lente des couleurs de la résille (crépuscule / nuit)
  if (glow > 0) {
    let time = 0;
    const c1 = new THREE.Color(0.55, 0.4, 1.0), c2 = new THREE.Color(0.2, 0.6, 1.0);
    sc.animated.push((dt) => {
      time += dt;
      lm.emissive.copy(c1).lerp(c2, 0.5 + 0.5 * Math.sin(time * 0.35));
    });
  }
}

// Échantillon le plus éloigné des virages entre les fractions u0 et u1 du tour
function calmestStraight(t, u0, u1) {
  let best = 0, bestScore = -1;
  for (let i = Math.floor(u0 * t.count); i < Math.floor(u1 * t.count); i += 2) {
    let d = 0;
    while (d < 200 && Math.abs(t.kappa[t.idx(i + d)]) < 1 / 400 && Math.abs(t.kappa[t.idx(i - d)]) < 1 / 400) d++;
    if (d > bestScore) { bestScore = d; best = i; }
  }
  return best;
}

// Texture de la résille : armature claire, panneaux vitrés semi-transparents
function latticeTexture() {
  const N = 128;
  const c = makeCanvas(N, N);
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(150,170,190,0.18)';
  ctx.fillRect(0, 0, N, N);
  ctx.strokeStyle = 'rgba(235,238,242,1)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(N, N);
  ctx.moveTo(N, 0); ctx.lineTo(0, N);
  ctx.stroke();
  ctx.strokeRect(0, 0, N, N);
  return canvasTexture(c);
}

// Tour en forme de voile (silhouette repère à l'horizon)
function sailTower(sc, x, z, rot) {
  const y = sc.groundAt(x, z) - 2;
  const H = 260;
  const white = sc.cachedMat('sailTower', () => new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.35, metalness: 0.2, emissive: 0xc8d8ff, emissiveIntensity: sc.night ? 0.35 : 0 }));
  const NV = 24, NU = 10;
  const pos = [], idx = [];
  // deux nappes (avant / arrière) entre le mât et le bord d'attaque courbe
  for (const sideZ of [1, -1]) {
    const base = pos.length / 3;
    for (let a = 0; a <= NV; a++) {
      const tY = a / NV;
      const lead = 85 * Math.pow(Math.sin((Math.PI / 2) * (1 - tY)), 0.75);
      for (let b = 0; b <= NU; b++) {
        const u = b / NU;
        const px = u * lead;
        const pz = sideZ * 16 * Math.sin(Math.PI * u) * (1 - tY * 0.6);
        pos.push(px, tY * H, pz);
      }
    }
    for (let a = 0; a < NV; a++)
      for (let b = 0; b < NU; b++) {
        const k = base + a * (NU + 1) + b;
        if (sideZ > 0) idx.push(k, k + 1, k + NU + 1, k + 1, k + NU + 2, k + NU + 1);
        else idx.push(k, k + NU + 1, k + 1, k + 1, k + NU + 1, k + NU + 2);
      }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  sc.bin.add('sailTower', white, g, mat(x, y, z, rot));
  // mât arrière et héliport
  sc.bin.add('sailTower', white, new THREE.CylinderGeometry(3, 5, H + 20, 8), mat(x, y + (H + 20) / 2, z, rot));
  sc.bin.add('sailTower', white, new THREE.CylinderGeometry(12, 12, 1.2, 16), mat(x - Math.cos(rot) * 14, y + H * 0.82, z + Math.sin(rot) * 14, rot));
}
