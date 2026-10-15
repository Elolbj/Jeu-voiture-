// Maillages du circuit : chaussée, marquages, vibreurs, dégagements, glissières / murs,
// ligne de départ, cases de grille, portique de départ.
import * as THREE from 'three';
import { clamp, lerp } from '../core/utils.js';
import * as TX from './textures.js';

const CURB_W_DEFAULT = 1.1;

// Hauteur de la surface (identique à Track.sample) au décalage latéral `lat` de l'échantillon i
export function surfaceY(track, i, lat, withCurb = true) {
  const hw = track.halfWidth;
  const curbW = track.def.curbWidth ?? CURB_W_DEFAULT;
  const hl = Math.hypot(track.rx[i], track.rz[i]) || 1;
  const slope = track.ry[i] / hl;
  const al = Math.abs(lat);
  let y = track.py[i] + slope * clamp(lat, -hw - curbW, hw + curbW);
  if (al > hw) {
    const curb = lat > 0 ? track.curbR[i] : track.curbL[i];
    if (curb && al < hw + curbW && withCurb) {
      const u = (al - hw) / curbW;
      y += 0.035 * Math.sin(u * Math.PI * 0.9);
    } else {
      const edge = hw + (curb ? curbW : 0);
      const run = lat > 0 ? track.runR[i] : track.runL[i];
      y -= (al - edge) * 0.02;
      if (run !== 2) y -= 0.04;
    }
  }
  return y;
}

function worldPoint(track, i, lat, y, out) {
  const hl = Math.hypot(track.rx[i], track.rz[i]) || 1;
  out[0] = track.px[i] + (track.rx[i] / hl) * lat;
  out[1] = y;
  out[2] = track.pz[i] + (track.rz[i] / hl) * lat;
  return out;
}

class StripBuilder {
  constructor() {
    this.pos = [];
    this.uv = [];
    this.col = [];
    this.idx = [];
    this.nv = 0;
  }
  // Ajoute une rangée de sommets (une section) ; renvoie l'indice de départ
  row(points, uvs, cols) {
    const start = this.nv;
    for (let k = 0; k < points.length; k++) {
      this.pos.push(points[k][0], points[k][1], points[k][2]);
      this.uv.push(uvs[k][0], uvs[k][1]);
      if (cols) this.col.push(cols[k], cols[k], cols[k]);
      this.nv++;
    }
    return start;
  }
  // Normale = (sens des indices k) × (sens de la rangée a vers b)
  connect(a, b, n, flip = false) {
    for (let k = 0; k < n - 1; k++) {
      if (!flip) this.idx.push(a + k, a + k + 1, b + k, a + k + 1, b + k + 1, b + k);
      else this.idx.push(a + k, b + k, a + k + 1, a + k + 1, b + k, b + k + 1);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    return g;
  }
}

export function buildTrackMeshes(track, opts = {}) {
  const group = new THREE.Group();
  group.name = 'track';
  const theme = track.def.theme;
  const n = track.count;
  const segs = track.closed ? n : n - 1;
  const hw = track.halfWidth;
  const curbW = track.def.curbWidth ?? CURB_W_DEFAULT;
  const line = opts.line; // trajectoire (pour la gomme sur la chaussée)
  const tmp = [0, 0, 0];

  // ------------------------------------------------------------ Chaussée
  const asph = TX.asphalt();
  const roadMat = new THREE.MeshStandardMaterial({
    map: asph.map,
    normalMap: asph.normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughnessMap: asph.roughnessMap,
    roughness: 1,
    metalness: 0,
    vertexColors: true,
    color: theme === 'city' ? 0xb8b8bc : 0xffffff,
  });
  const road = new StripBuilder();
  const NL = 12;
  let prev = -1;
  for (let i = 0; i <= segs; i++) {
    const ii = track.idx(i);
    const s = i * track.spacing;
    const pts = [], uvs = [], cols = [];
    const lineOff = line ? line.offset[ii] : 0;
    for (let k = 0; k <= NL; k++) {
      const lat = -hw + (2 * hw * k) / NL;
      pts.push(worldPoint(track, ii, lat, surfaceY(track, ii, lat), [0, 0, 0]));
      uvs.push([lat / 7, s / 7]);
      // gomme sur la trajectoire + bords plus clairs
      const d = (lat - lineOff) / 1.7;
      let c = 1 - 0.2 * Math.exp(-d * d);
      c *= 1 + 0.06 * Math.min(1, Math.abs(Math.abs(lat) - hw) < 1 ? 1 : 0);
      cols.push(c);
    }
    const st = road.row(pts, uvs, cols);
    if (prev >= 0) road.connect(prev, st, NL + 1);
    prev = st;
  }
  const roadMesh = new THREE.Mesh(road.geometry(), roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // ------------------------------------------------------------ Marquages
  const paintMat = new THREE.MeshStandardMaterial({ color: 0xe9e9e4, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const lines = new StripBuilder();
  const addLine = (latC, width, dashed = false) => {
    let prevL = -1;
    for (let i = 0; i <= segs; i++) {
      const ii = track.idx(i);
      const s = i * track.spacing;
      if (dashed) {
        const ph = (s % 12) / 12;
        if (ph > 0.5) { prevL = -1; continue; }
      }
      const pts = [];
      for (const lat of [latC - width / 2, latC + width / 2]) pts.push(worldPoint(track, ii, lat, surfaceY(track, ii, lat) + 0.004, [0, 0, 0]));
      const st = lines.row(pts, [[0, 0], [1, 0]]);
      if (prevL >= 0) lines.connect(prevL, st, 2);
      prevL = st;
    }
  };
  addLine(-hw + 0.25, 0.22);
  addLine(hw - 0.25, 0.22);
  if (theme === 'mountain') addLine(0, 0.14, true);
  const lineMesh = new THREE.Mesh(lines.geometry(), paintMat);
  lineMesh.receiveShadow = true;
  group.add(lineMesh);

  // ------------------------------------------------------------ Vibreurs
  const curbTex = theme === 'city' ? TX.curb('#d6b400', '#1a1a1a') : TX.curb();
  const curbMat = new THREE.MeshStandardMaterial({ map: curbTex, roughness: 0.6, metalness: 0 });
  const curbs = new StripBuilder();
  for (const side of [-1, 1]) {
    const arr = side > 0 ? track.curbR : track.curbL;
    let prevC = -1;
    for (let i = 0; i <= segs; i++) {
      const ii = track.idx(i);
      const iPrev = track.idx(i - 1);
      if (!arr[ii] && !(i > 0 && arr[iPrev])) { prevC = -1; continue; }
      const s = i * track.spacing;
      const pts = [], uvs = [];
      const NK = 5;
      for (let k = 0; k <= NK; k++) {
        const lat = side * (hw + (curbW * k) / NK);
        const y = arr[ii] ? surfaceY(track, ii, lat) : surfaceY(track, ii, side * hw);
        pts.push(worldPoint(track, ii, lat, y + 0.003, [0, 0, 0]));
        uvs.push([k / NK, s / 3]);
      }
      if (side < 0) { pts.reverse(); uvs.reverse(); }
      const st = curbs.row(pts, uvs);
      if (prevC >= 0) curbs.connect(prevC, st, NK + 1);
      prevC = st;
    }
  }
  if (curbs.nv) {
    const cm = new THREE.Mesh(curbs.geometry(), curbMat);
    cm.receiveShadow = true;
    group.add(cm);
  }

  // ------------------------------------------------------------ Dégagements
  const grassT = TX.grass(theme === 'coast' ? [0.36, 0.42, 0.2] : theme === 'mountain' ? [0.3, 0.4, 0.2] : [0.3, 0.46, 0.18]);
  const gravelT = TX.gravel();
  const runMats = [
    new THREE.MeshStandardMaterial({ map: grassT.map, normalMap: grassT.normalMap, roughness: 0.95, color: 0xffffff }),
    new THREE.MeshStandardMaterial({ map: gravelT.map, normalMap: gravelT.normalMap, roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ map: asph.map, normalMap: asph.normalMap, roughnessMap: asph.roughnessMap, roughness: 1, color: theme === 'city' ? 0x9a9aa0 : 0xc8c8c8 }),
  ];
  const runB = [new StripBuilder(), new StripBuilder(), new StripBuilder()];
  for (const side of [-1, 1]) {
    const runArr = side > 0 ? track.runR : track.runL;
    const wallArr = side > 0 ? track.wallR : track.wallL;
    const curbArr = side > 0 ? track.curbR : track.curbL;
    for (let i = 0; i < segs; i++) {
      const a = track.idx(i), b = track.idx(i + 1);
      const type = runArr[a];
      const B = runB[type];
      const sec = (ii, sIdx) => {
        const edge = hw + (curbArr[ii] ? curbW : 0);
        const outer = wallArr[ii] + 2.5;
        const lats = [edge, lerp(edge, outer, 0.33), lerp(edge, outer, 0.66), outer];
        const pts = [], uvs = [];
        for (const l of lats) {
          const lat = side * l;
          pts.push(worldPoint(track, ii, lat, surfaceY(track, ii, lat), [0, 0, 0]));
          uvs.push([lat / 6, (sIdx * track.spacing) / 6]);
        }
        // jupe verticale (masque les raccords avec le terrain)
        const last = pts[pts.length - 1];
        pts.push([last[0], last[1] - 2, last[2]]);
        uvs.push([(side * (outer + 1)) / 6, (sIdx * track.spacing) / 6]);
        if (side < 0) { pts.reverse(); uvs.reverse(); }
        return { pts, uvs };
      };
      const A = sec(a, i), Bs = sec(b, i + 1);
      const s0 = B.row(A.pts, A.uvs);
      const s1 = B.row(Bs.pts, Bs.uvs);
      B.connect(s0, s1, A.pts.length);
    }
  }
  runB.forEach((B, k) => {
    if (!B.nv) return;
    const m = new THREE.Mesh(B.geometry(), runMats[k]);
    m.receiveShadow = true;
    group.add(m);
  });

  // ------------------------------------------------------------ Glissières / murs
  const barrierType = track.def.barrier || (theme === 'city' ? 'concrete' : 'armco');
  buildBarriers(track, group, barrierType, segs);

  // ------------------------------------------------------------ Ligne de départ / grille
  const startS = track.startS;
  const chk = TX.checker();
  const lineMat = new THREE.MeshStandardMaterial({ map: chk, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const quadAcross = (s, len, mat, lat0 = -hw, lat1 = hw, lift = 0.006) => {
    const b = new StripBuilder();
    for (const ds of [-len / 2, len / 2]) {
      const ii = track.indexAt(s + ds);
      const pts = [];
      for (const lat of [lat0, lat1]) {
        const p = track.pointAt(s + ds, lat);
        pts.push([p.x, surfaceY(track, ii, lat) + lift, p.z]);
      }
      b.row(pts, ds < 0 ? [[0, 0], [1, 0]] : [[0, 1], [1, 1]]);
    }
    b.connect(0, 2, 2);
    const m = new THREE.Mesh(b.geometry(), mat);
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  chk.repeat.set(1, 1);
  quadAcross(startS, 1.6, lineMat);
  // Cases de grille
  for (let k = 0; k < 16; k++) {
    const row = Math.floor(k / 2);
    const s = startS - 6 - row * 9 - (k % 2) * 4.5;
    const lat = (k % 2 === 0 ? -1 : 1) * hw * 0.42;
    quadAcross(s + 2.6, 0.18, paintMat, lat - 1.3, lat + 1.3, 0.005);
  }
  if (!track.closed) {
    // Ligne d'arrivée de la course de côte
    quadAcross(track.length - 30, 1.6, lineMat);
  }

  // Portique de départ (feux)
  const gantry = buildGantry(track, startS, theme);
  group.add(gantry.group);
  if (!track.closed) {
    const fin = buildGantry(track, track.length - 30, theme, 'ARRIVÉE');
    group.add(fin.group);
  }

  return { group, gantry, roadMesh };
}

// ----------------------------------------------------------------------------
function buildBarriers(track, group, type, segs) {
  const hw = track.halfWidth;
  if (type === 'concrete') {
    const conc = TX.concrete(185);
    const mat = new THREE.MeshStandardMaterial({ map: conc, roughness: 0.9, color: 0xdddddd });
    const bannerMats = [];
    for (let k = 0; k < 6; k++) bannerMats.push(new THREE.MeshStandardMaterial({ map: TX.banner(k), roughness: 0.6, emissive: 0xffffff, emissiveMap: TX.banner(k), emissiveIntensity: 0.25 }));
    const B = new StripBuilder();
    const banners = bannerMats.map(() => new StripBuilder());
    for (const side of [-1, 1]) {
      const wallArr = side > 0 ? track.wallR : track.wallL;
      let prev = -1;
      // profil type « New Jersey » (latéral relatif au mur, hauteur)
      const prof = [[0.35, 0], [0.25, 0.22], [0.1, 0.42], [0.08, 1.05], [-0.08, 1.05], [-0.1, 0.42], [-0.25, 0.22], [-0.35, 0]];
      for (let i = 0; i <= segs; i++) {
        const ii = track.idx(i);
        const w = wallArr[ii];
        const baseY = surfaceY(track, ii, side * w);
        const pts = [], uvs = [];
        for (const [o, h] of prof) {
          const lat = side * (w - o + 0.1);
          pts.push(worldPoint(track, ii, lat, baseY + h, [0, 0, 0]));
          uvs.push([h / 2, (i * track.spacing) / 4]);
        }
        if (side < 0) { pts.reverse(); uvs.reverse(); }
        const st = B.row(pts, uvs);
        if (prev >= 0) B.connect(prev, st, prof.length);
        prev = st;
        // Panneaux publicitaires sur la face intérieure
        if (i < segs && i % 10 === 0) {
          const bi = (Math.floor(i / 10) + (side > 0 ? 3 : 0)) % bannerMats.length;
          const bb = banners[bi];
          const len = 9;
          const r0 = [], r1 = [];
          for (const [lat, h] of [[w - 0.11, 0.42], [w - 0.09, 1.0]]) {
            r0.push(worldPoint(track, ii, side * lat, baseY + h, [0, 0, 0]));
            const jj = track.idx(i + Math.round(len / track.spacing));
            const bY = surfaceY(track, jj, side * wallArr[jj]);
            r1.push(worldPoint(track, jj, side * (wallArr[jj] - (lat === w - 0.11 ? 0.11 : 0.09)), bY + h, [0, 0, 0]));
          }
          // Sens de lecture : de gauche à droite pour un spectateur sur la piste
          const flip = side > 0;
          const u0 = flip ? 1 : 0, u1 = flip ? 0 : 1;
          const a = bb.row(r0, [[u0, 0], [u0, 1]]);
          const c = bb.row(r1, [[u1, 0], [u1, 1]]);
          bb.connect(a, c, 2, !flip);
        }
      }
    }
    const m = new THREE.Mesh(B.geometry(), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    banners.forEach((bb, k) => {
      if (!bb.nv) return;
      const mm = new THREE.Mesh(bb.geometry(), bannerMats[k]);
      group.add(mm);
    });
    return;
  }
  // Glissière métallique (armco) + poteaux
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9bec4, metalness: 0.85, roughness: 0.35 });
  const B = new StripBuilder();
  const posts = [];
  const prof = [[0, 0.42], [0.06, 0.5], [0.0, 0.58], [0.06, 0.66], [0.0, 0.76]];
  for (const side of [-1, 1]) {
    const wallArr = side > 0 ? track.wallR : track.wallL;
    let prev = -1;
    for (let i = 0; i <= segs; i++) {
      const ii = track.idx(i);
      const w = wallArr[ii];
      const baseY = surfaceY(track, ii, side * w);
      const pts = [], uvs = [];
      for (const [o, h] of prof) {
        pts.push(worldPoint(track, ii, side * (w - o), baseY + h, [0, 0, 0]));
        uvs.push([h, i * 0.5]);
      }
      if (side > 0) { pts.reverse(); uvs.reverse(); }
      const st = B.row(pts, uvs);
      if (prev >= 0) B.connect(prev, st, prof.length, true);
      prev = st;
      if (i % 2 === 0 && i < segs) {
        const p = worldPoint(track, ii, side * (w + 0.12), baseY + 0.38, [0, 0, 0]);
        posts.push(p);
      }
    }
  }
  const g = B.geometry();
  const mesh = new THREE.Mesh(g, steel);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.material.side = THREE.DoubleSide;
  group.add(mesh);
  const postGeo = new THREE.BoxGeometry(0.1, 0.8, 0.12);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x8e9399, metalness: 0.7, roughness: 0.5 });
  const im = new THREE.InstancedMesh(postGeo, postMat, posts.length);
  const m4 = new THREE.Matrix4();
  posts.forEach((p, k) => {
    m4.makeTranslation(p[0], p[1], p[2]);
    im.setMatrixAt(k, m4);
  });
  im.castShadow = true;
  group.add(im);
  // Piles de pneus devant les bacs à graviers
  const tires = [];
  for (const side of [-1, 1]) {
    const runArr = side > 0 ? track.runR : track.runL;
    const wallArr = side > 0 ? track.wallR : track.wallL;
    for (let i = 0; i < segs; i += 1) {
      const ii = track.idx(i);
      if (runArr[ii] !== 1) continue;
      const w = wallArr[ii];
      const baseY = surfaceY(track, ii, side * w);
      for (let lvl = 0; lvl < 3; lvl++) {
        const p = worldPoint(track, ii, side * (w - 0.45), baseY + 0.12 + lvl * 0.24, [0, 0, 0]);
        tires.push(p);
      }
    }
  }
  if (tires.length) {
    const tg = new THREE.TorusGeometry(0.3, 0.13, 6, 12);
    tg.rotateX(Math.PI / 2);
    const tm = new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.9 });
    const ti = new THREE.InstancedMesh(tg, tm, tires.length);
    tires.forEach((p, k) => {
      m4.makeTranslation(p[0], p[1], p[2]);
      ti.setMatrixAt(k, m4);
    });
    ti.castShadow = true;
    ti.receiveShadow = true;
    group.add(ti);
  }
  void hw;
}

// Portique de départ avec feux rouges
function buildGantry(track, s, theme, label = 'DÉPART') {
  const group = new THREE.Group();
  const hw = track.halfWidth;
  const ii = track.indexAt(s);
  const L = track.wallL[ii], R = track.wallR[ii];
  const span = L + R + 1;
  const center = track.pointAt(s, (R - L) / 2);
  const h = track.heading[ii];
  group.position.copy(center);
  group.rotation.y = -h;
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.6, roughness: 0.45 });
  const height = 7;
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.5, height, 0.5), metal);
    pillar.position.set(side * span / 2, height / 2, 0);
    pillar.castShadow = true;
    group.add(pillar);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(span, 2.6, 0.6), metal);
  beam.position.y = height + 0.6;
  beam.castShadow = true;
  group.add(beam);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(span * 0.6, 12), 1.0), new THREE.MeshStandardMaterial({ map: TX.textTexture(label, { w: 512, h: 64, bg: '#0b1f3a', fg: '#ffffff', font: 'bold 44px Arial' }), roughness: 0.6, emissive: 0xffffff, emissiveMap: TX.textTexture(label, { w: 512, h: 64, bg: '#0b1f3a', fg: '#ffffff', font: 'bold 44px Arial' }), emissiveIntensity: theme === 'city' ? 0.6 : 0.15 }));
  // Face aux pilotes (qui arrivent du côté +Z local)
  sign.position.set(0, height + 1.2, 0.31);
  group.add(sign);
  const sign2 = sign.clone();
  sign2.rotation.y = Math.PI;
  sign2.position.z = -0.31;
  group.add(sign2);
  // Feux : 5 paires
  const lights = [];
  const lightGeo = new THREE.CircleGeometry(0.17, 16);
  for (let k = 0; k < 5; k++) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1a1a, emissiveIntensity: 0 });
    for (const dy of [0.25, -0.25]) {
      const m = new THREE.Mesh(lightGeo, mat);
      m.position.set((k - 2) * 0.55, height + dy, 0.32);
      group.add(m);
    }
    lights.push(mat);
  }
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x002200, emissive: 0x22ff44, emissiveIntensity: 0 });
  for (const x of [-1.9, 1.9]) {
    const m = new THREE.Mesh(lightGeo, greenMat);
    m.position.set(x, height, 0.32);
    group.add(m);
  }
  return {
    group,
    setLights(nRed, green) {
      lights.forEach((m, k) => (m.emissiveIntensity = k < nRed ? 6 : 0));
      greenMat.emissiveIntensity = green ? 6 : 0;
    },
  };
  void hw;
}
