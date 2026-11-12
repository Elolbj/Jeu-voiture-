// Décor « forêt » (Grünwald-Ring, Eifel) : rideaux serrés d'épicéas, de hêtres et de bouleaux
// le long de la piste, clairières de spectateurs et campings sur les talus, haies, panneaux
// kilométriques et noms de virages, passerelles piétonnes, dalles de béton du carrousel,
// ruine de château et villages au loin.
import * as THREE from 'three';
import { InstancedForest } from '../vegetation.js';
import { surfaceY } from '../trackMesh.js';
import * as TX from '../textures.js';
import { mat, matR, frameAt, infieldSide, textAtlas, atlasPlane, peopleTexture, concreteSlabs, boxWorldUV, marshalPosts } from './common.js';
import { rad } from '../../core/utils.js';

// Noms (fictifs) des lieux-dits, à la fraction du tour où se trouve le virage
const CORNERS = [
  [0.12, 'TANNENBOGEN'], [0.214, 'SPRUNGHÜGEL'], [0.245, 'ADLERKREUZ'], [0.334, 'STEINECK'],
  [0.37, 'FUCHSLOCH'], [0.42, 'FORSTHAUS'], [0.528, 'MÜHLENGRUND'], [0.555, 'HEXENKESSEL'],
  [0.626, 'SCHMIEDE'], [0.69, 'KESSELSTEIGE'], [0.785, 'KARUSSELL'], [0.81, 'HOHE WARTE'],
  [0.862, 'SCHWALBENNEST'], [0.9, 'GALGENHÜGEL'], [0.95, 'LANGE GERADE'],
];

export function buildForest(sc) {
  const t = sc.track;
  const r = sc.r;
  const q = sc.quality.trees;
  const T = sc.terrain;
  const infield = infieldSide(t);
  const iStart = t.indexAt(t.startS);
  const L = t.length;
  const dS = (a, b) => { const d = Math.abs(a - b); return Math.min(d, L - d); };

  // Clairières de spectateurs (campings) : régulièrement, hors de la zone des stands
  const clearings = [];
  for (let s = t.startS + 700; s < t.startS + L - 500; s += 650 + r() * 450) {
    clearings.push({ s: s % L, side: r() < 0.5 ? -1 : 1, len: 70 + r() * 50 });
  }
  const inClearing = (i, side, margin = 0) => clearings.some((c) => c.side === side && dS(t.sArr[i], c.s) < c.len / 2 + margin);
  const nearStart = (i, d) => dS(t.sArr[i], t.startS) < d;
  // emplacements des postes de commissaires (voir marshalPosts) : laissés libres
  const POST_STEP = 380, nPost = Math.max(1, Math.round(POST_STEP / t.spacing)), i0Post = Math.floor(nPost / 2);
  const nearPost = (i, side) => {
    const k = Math.round((i - i0Post) / nPost);
    return k >= 0 && Math.abs(i - i0Post - k * nPost) * t.spacing < 7 && (k % 2 ? 1 : -1) === side;
  };

  // ---------------------------------------------------------------- Forêt
  const f = sc.forest(InstancedForest, 17);
  const fr = {};
  const rows = q < 0.6 ? 2 : 3;
  for (let i = 0; i < t.count; i += 3) {
    for (const side of [-1, 1]) {
      if (nearStart(i, side === infield ? 200 : 170)) continue;
      const clear = inClearing(i, side, 10);
      const wall = side > 0 ? t.wallR[i] : t.wallL[i];
      const post = nearPost(i, side);
      for (let row = clear ? 2 : 0; row < rows + (clear ? 1 : 0); row++) {
        if (r() > 0.92 || (post && row < 2)) continue;
        const lat = side * (wall + 4.5 + row * 6.5 + r() * 4);
        frameAt(t, i, lat, fr);
        const x = fr.x + (r() - 0.5) * 3, z = fr.z + (r() - 0.5) * 3;
        if (sc.clearance(x, z) < 3.5) continue;
        const u = r();
        const kind = u < 0.62 ? 'spruce' : u < 0.9 ? 'beech' : 'birch';
        f.add(kind, 2, x, sc.groundAt(x, z) - 0.3, z, 0.8 + r() * 0.45, r() * 6.28);
      }
    }
  }
  // massifs forestiers plus loin (densité donnée par le terrain)
  sc.scatter(f, Math.round(4200 * q), ['spruce', 'spruce', 'beech'], {
    clump: 300, threshold: -1, minClear: 30, maxSlope: 0.9,
    filter: (x, y, z) => T.forestMask(x, z) > 0.45,
  });
  sc.scatter(f, Math.round(500 * q), ['beech', 'birch'], { clump: 200, threshold: 0.1, minClear: 30 });
  // haies basses devant certains rideaux d'arbres
  for (let i = 0; i < t.count; i += 2) {
    const blk = Math.floor(t.sArr[i] / 160);
    if ((blk * 7919) % 5 > 1 || nearStart(i, 220)) continue;
    const side = (blk % 2) * 2 - 1;
    if (inClearing(i, side, 5) || nearPost(i, side)) continue;
    const wall = side > 0 ? t.wallR[i] : t.wallL[i];
    frameAt(t, i, side * (wall + 1.8), fr);
    if (sc.clearance(fr.x, fr.z) < 1.5) continue;
    f.add('hedge', 2, fr.x, sc.groundAt(fr.x, fr.z) - 0.2, fr.z, 0.9 + r() * 0.3, fr.rot + (r() - 0.5) * 0.3);
  }
  f.build(380, true, 230);

  // ---------------------------------------------------------------- Zone des stands
  sc.grandstand(iStart, -infield, 200, 12);
  sc.pitBuilding(iStart, infield, 240);

  // ---------------------------------------------------------------- Campings et spectateurs
  for (const c of clearings) campsite(sc, t.indexAt(c.s), c.side, c.len);

  // ---------------------------------------------------------------- Panneaux, postes de commissaires
  signs(sc);
  marshalPosts(sc, { step: POST_STEP, offset: 4.5, skip: (i) => { const d = Math.abs(t.sArr[i] - t.startS); return Math.min(d, L - d) < 220; } });

  // ---------------------------------------------------------------- Passerelles piétonnes
  const bridges = [0.07, 0.47, 0.73];
  for (const u of bridges) {
    // ligne droite la plus proche
    let i = t.indexAt(u * L);
    for (let k = 0; k < 120 && Math.abs(t.kappa[i]) > 1 / 500; k++) i = t.idx(i + 1);
    footbridge(sc, i);
  }

  // ---------------------------------------------------------------- Carrousel en béton
  karussellSlabs(sc);

  // ---------------------------------------------------------------- Ruine, villages
  const b = t.bounds;
  castle(sc, b.minX - 320, (b.minZ + b.maxZ) / 2 - 300);
  for (const [vx, vz] of [[b.maxX + 420, b.minZ + 300], [(b.minX + b.maxX) / 2, b.maxZ + 380]]) village(sc, vx, vz);

  sc.buildBillboards();
}

// Camping de spectateurs : tentes, voitures, drapeaux et une rangée de spectateurs
function campsite(sc, i0, side, len) {
  const t = sc.track;
  const r = sc.r;
  const campM = sc.cachedMat('camp', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
  const tentCols = [[0.85, 0.2, 0.15], [0.15, 0.4, 0.8], [0.95, 0.75, 0.1], [0.2, 0.6, 0.25], [0.9, 0.5, 0.1], [0.7, 0.7, 0.72]];
  const carCols = [[0.75, 0.1, 0.1], [0.1, 0.12, 0.15], [0.85, 0.85, 0.86], [0.15, 0.3, 0.6], [0.5, 0.52, 0.55]];
  const tent = new THREE.ConeGeometry(1.7, 1.9, 4);
  tent.rotateY(Math.PI / 4);
  const dome = new THREE.SphereGeometry(1.5, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const body = new THREE.BoxGeometry(1.8, 0.8, 4.3);
  const cabin = new THREE.BoxGeometry(1.6, 0.6, 2.2);
  const f = {};
  const n = 2 * Math.round(len / t.spacing / 2);
  for (let k = -n / 2; k < n / 2; k += 4) {
    const i = t.idx(i0 + k);
    const wall = side > 0 ? t.wallR[i] : t.wallL[i];
    for (let row = 0; row < 3; row++) {
      if (r() < 0.35) continue;
      frameAt(t, i, side * (wall + 9 + row * 6 + r() * 3), f);
      if (sc.clearance(f.x, f.z) < 6) continue;
      const y = sc.groundAt(f.x, f.z);
      const rot = r() * 6.28;
      if (r() < 0.55) {
        const big = r() < 0.5;
        sc.bin.add('camp', campM, big ? dome : tent, mat(f.x, y + (big ? 0 : 0.9), f.z, rot), tentCols[Math.floor(r() * tentCols.length)]);
      } else {
        const cc = carCols[Math.floor(r() * carCols.length)];
        sc.bin.add('camp', campM, body, mat(f.x, y + 0.6, f.z, f.rot + (r() - 0.5) * 0.6), cc);
        sc.bin.add('camp', campM, cabin, mat(f.x, y + 1.25, f.z, f.rot + (r() - 0.5) * 0.6), [cc[0] * 0.5, cc[1] * 0.5, cc[2] * 0.55]);
      }
    }
  }
  // rangée de spectateurs face à la piste
  const pm = sc.cachedMat('people', () => new THREE.MeshStandardMaterial({ map: peopleTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }));
  for (let k = -n / 2 + 4; k < n / 2 - 4; k += 9) {
    const i = t.idx(i0 + k);
    const wall = side > 0 ? t.wallR[i] : t.wallL[i];
    frameAt(t, i, side * (wall + 3 + r() * 1.5), f);
    if (sc.clearance(f.x, f.z) < 2) continue;
    const y = sc.groundAt(f.x, f.z);
    const plane = new THREE.PlaneGeometry(16, 1.8);
    plane.attributes.uv.array.forEach((v, j, a) => { if (j % 2 === 0) a[j] = v * 2 + (k % 3) * 0.3; });
    sc.bin.add('people', pm, plane, mat(f.x, y + 0.85, f.z, f.rot + (side > 0 ? -Math.PI / 2 : Math.PI / 2)));
  }
  // drapeaux sur mâts
  const pole = new THREE.CylinderGeometry(0.04, 0.05, 6, 4);
  const flag = new THREE.BoxGeometry(0.05, 1.1, 1.7);
  for (let j = 0; j < 4; j++) {
    const i = t.idx(i0 + Math.round((r() - 0.5) * n));
    const wall = side > 0 ? t.wallR[i] : t.wallL[i];
    frameAt(t, i, side * (wall + 8 + r() * 10), f);
    if (sc.clearance(f.x, f.z) < 5) continue;
    const y = sc.groundAt(f.x, f.z);
    sc.bin.add('camp', campM, pole, mat(f.x, y + 3, f.z), [0.8, 0.8, 0.8]);
    sc.bin.add('camp', campM, flag, mat(f.x, y + 5.3, f.z + 0.9, 0), tentCols[j % tentCols.length]);
  }
}

// Panneaux kilométriques (tous les 1000 m) et noms des virages : un seul atlas de textures
function signs(sc) {
  const t = sc.track;
  const L = t.length;
  const entries = [];
  const kms = Math.floor(L / 1000);
  for (let k = 1; k <= kms; k++) entries.push({ text: String(k), bg: '#f4f4f0', fg: '#111', border: '#111', font: 'bold 70px Arial, Helvetica, sans-serif' });
  for (const [, name] of CORNERS) entries.push({ text: name, bg: '#1d4f2a', fg: '#ffffff', border: '#f4f4f0', font: 'bold 34px Arial, Helvetica, sans-serif' });
  const atlas = textAtlas('forestSigns', entries, { cellW: 256, cellH: 96 });
  const m = sc.cachedMat('forestSigns', () => new THREE.MeshStandardMaterial({ map: atlas.texture, roughness: 0.6 }));
  const postM = sc.cachedMat('signPost', () => new THREE.MeshStandardMaterial({ color: 0x6d7076, metalness: 0.5, roughness: 0.6 }));
  const post = new THREE.CylinderGeometry(0.05, 0.05, 2.2, 5);
  const f = {};
  const place = (s, idx, w, h, side) => {
    const i = t.indexAt(s);
    const wall = side > 0 ? t.wallR[i] : t.wallL[i];
    frameAt(t, i, side * (wall + 1.2), f);
    const y = surfaceY(t, i, side * wall);
    sc.bin.add('forestSigns', m, atlasPlane(w, h, atlas.rect(idx)), mat(f.x, y + 2.1, f.z, f.rot));
    // poteaux le long de l'axe X local du panneau (= vecteur droite de la piste)
    for (const dx of [-w * 0.35, w * 0.35]) sc.bin.add('signPost', postM, post, mat(f.x + f.rx * dx, y + 1.0, f.z + f.rz * dx));
  };
  for (let k = 1; k <= kms; k++) place((t.startS + k * 1000) % L, k - 1, 1.0, 0.6, 1);
  CORNERS.forEach(([u, ], j) => place(u * L - 110, kms + j, 3.2, 1.2, -1));
  sc.bin.noShadow('forestSigns');
  sc.bin.noShadow('signPost');
}

// Passerelle piétonne métallique au-dessus de la piste (bandeau publicitaire)
function footbridge(sc, i) {
  const t = sc.track;
  const f = frameAt(t, i, 0, {});
  const wl = t.wallL[i], wr = t.wallR[i];
  const span = wl + wr + 6;
  const cx = f.x + f.rx * (wr - wl) / 2, cz = f.z + f.rz * (wr - wl) / 2;
  const y0 = Math.max(surfaceY(t, i, -wl), surfaceY(t, i, wr), t.py[i]) + 6.2;
  const steel = sc.cachedMat('bridgeSteel', () => new THREE.MeshStandardMaterial({ color: 0x3f6b4a, metalness: 0.5, roughness: 0.55 }));
  const rot = f.rot + Math.PI / 2; // axe X local = travers de la piste
  const along = (d) => [cx + f.rx * d, cz + f.rz * d];
  sc.bin.add('bridgeSteel', steel, new THREE.BoxGeometry(span, 0.35, 2.6), mat(cx, y0, cz, f.rot));
  for (const side of [-1, 1]) {
    // garde-corps (treillis simplifié) et bandeaux
    const ox = f.dx * side * 1.25, oz = f.dz * side * 1.25;
    sc.bin.add('bridgeSteel', steel, new THREE.BoxGeometry(span, 0.12, 0.12), mat(cx + ox, y0 + 1.25, cz + oz, f.rot));
    for (let d = -span / 2; d <= span / 2; d += 2.5) {
      const [px, pz] = along(d);
      sc.bin.add('bridgeSteel', steel, new THREE.BoxGeometry(0.1, 1.1, 0.1), mat(px + ox, y0 + 0.7, pz + oz));
    }
    // piles et escaliers de part et d'autre
    const wallS = side > 0 ? wr : wl;
    const [px, pz] = along(side * (wallS + 2.2));
    const yg = sc.groundAt(px, pz);
    for (const e of [-0.9, 0.9]) sc.bin.add('bridgeSteel', steel, new THREE.BoxGeometry(0.3, y0 - yg, 0.3), mat(px + f.dx * e, (y0 + yg) / 2, pz + f.dz * e));
    const [sx, sz] = along(side * (wallS + 5.5));
    const stair = new THREE.BoxGeometry(1.4, 0.3, Math.hypot(y0 - yg, 7));
    sc.bin.add('bridgeSteel', steel, stair, matR(sx, (y0 + yg) / 2, sz, rot + (side > 0 ? 0 : Math.PI), Math.atan2(y0 - yg, 7)));
  }
  // bandeau publicitaire des deux côtés
  const bi = (i * 7) % 10;
  const bm = sc.cachedMat('bb' + bi, () => new THREE.MeshStandardMaterial({ map: TX.banner(bi), roughness: 0.55 }));
  for (const side of [-1, 1]) {
    // côté -1 : face aux pilotes qui arrivent ; côté +1 : visible dans le rétroviseur
    const g = new THREE.PlaneGeometry(Math.min(span - 2, 22), 1.1);
    sc.bin.add('bb' + bi, bm, g, mat(cx + f.dx * side * 1.32, y0 - 0.65, cz + f.dz * side * 1.32, f.rot + (side > 0 ? Math.PI : 0)));
  }
}

// Dalles de béton sur la portion relevée du carrousel
function karussellSlabs(sc) {
  const t = sc.track;
  const thr = rad(6);
  const hw = t.halfWidth;
  const pos = [], uv = [], idx = [];
  let prev = -1, n = 0;
  for (let i = 0; i < t.count; i++) {
    if (Math.abs(t.bank[i]) < thr) { prev = -1; continue; }
    const base = n;
    for (let k = 0; k <= 4; k++) {
      const lat = -hw + (2 * hw * k) / 4;
      const f = frameAt(t, i, lat, {});
      pos.push(f.x, surfaceY(t, i, lat) + 0.012, f.z);
      uv.push(lat / 3.5, t.sArr[i] / 3.5);
      n++;
    }
    if (prev >= 0) for (let k = 0; k < 4; k++) idx.push(prev + k, prev + k + 1, base + k, prev + k + 1, base + k + 1, base + k);
    prev = base;
  }
  if (!idx.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: concreteSlabs(), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.receiveShadow = true;
  sc.group.add(m);
}

// Ruine de château fort sur une hauteur
function castle(sc, x, z) {
  const y = sc.groundAt(x, z);
  const stone = sc.cachedMat('castleStone', () => new THREE.MeshStandardMaterial({ map: TX.concrete(150), color: 0xb9b0a2, roughness: 0.95 }));
  sc.bin.add('castleStone', stone, boxWorldUV(12, 30, 12, 4, 4), mat(x, y + 13, z, 0.3));
  for (let k = 0; k < 4; k++) {
    const a = 0.3 + (k * Math.PI) / 2;
    for (let j = -2; j <= 2; j++) {
      const ox = Math.cos(a) * 6 - Math.sin(a) * j * 2.3, oz = -Math.sin(a) * 6 - Math.cos(a) * j * 2.3;
      if ((j + k) % 2) sc.bin.add('castleStone', stone, new THREE.BoxGeometry(1.4, 1.6, 1.4), mat(x + ox, y + 28.6, z + oz, a));
    }
  }
  // enceinte en ruine
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    const h = 4 + ((k * 37) % 5);
    const px = x + Math.cos(a) * 26, pz = z + Math.sin(a) * 26;
    sc.bin.add('castleStone', stone, boxWorldUV(20, h, 2.5, 4, 4), mat(px, sc.groundAt(px, pz) + h / 2 - 1, pz, -a + Math.PI / 2));
  }
  sc.bin.add('castleStone', stone, new THREE.CylinderGeometry(4, 4.5, 18, 12), mat(x + 22, sc.groundAt(x + 22, z - 12) + 8, z - 12));
}

// Village de l'Eifel : maisons à toits d'ardoise et clocher
function village(sc, x, z) {
  const r = sc.r;
  for (let k = 0; k < 12; k++) {
    const px = x + (r() - 0.5) * 220, pz = z + (r() - 0.5) * 160;
    if (sc.clearance(px, pz) < 40) continue;
    sc.farmhouse(px, pz, r() * Math.PI);
  }
  if (sc.clearance(x, z) < 40) return;
  const y = sc.groundAt(x, z);
  const wall = sc.cachedMat('farmWall', () => new THREE.MeshStandardMaterial({ map: TX.concrete(205), color: 0xefe6d6, roughness: 0.9 }));
  const slate = sc.cachedMat('slate', () => new THREE.MeshStandardMaterial({ color: 0x3a3f48, roughness: 0.7 }));
  sc.bin.add('farmWall', wall, boxWorldUV(6, 22, 6, 6, 6), mat(x, y + 10, z));
  const spire = new THREE.ConeGeometry(4.4, 12, 4);
  spire.rotateY(Math.PI / 4);
  sc.bin.add('slate', slate, spire, mat(x, y + 27, z));
  sc.bin.add('farmWall', wall, boxWorldUV(9, 10, 20, 6, 6), mat(x, y + 4, z + 12));
}
