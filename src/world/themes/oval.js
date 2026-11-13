// Décor « ovale » (Lakeview Speedway, Floride) : immenses tribunes à deux étages avec loges
// vitrées, grillages de protection au-dessus des murs SAFER, lac dans l'infield, stands et
// garages, pylône des positions, pylônes d'éclairage de stade, parkings, palmiers, dirigeable.
import * as THREE from 'three';
import { InstancedForest } from '../vegetation.js';
import { surfaceY } from '../trackMesh.js';
import * as TX from '../textures.js';
import { boxWorldUV, mat, matR, frameAt, infieldSide, glassFacade, catchFence, lightPools, makeCanvas, canvasTexture, roadWash } from './common.js';

export function buildOval(sc) {
  const t = sc.track;
  const r = sc.r;
  const q = sc.quality.trees;
  const infield = infieldSide(t);
  const outside = -infield;
  const iStart = t.indexAt(t.startS);

  // ---------------------------------------------------------------- Tribunes
  bigStand(sc, iStart, outside, 820);
  // tribunes simples à l'entrée des virages 1 et 3
  for (const u of [0.3, 0.8]) sc.grandstand(t.indexAt(t.startS + u * t.length), outside, 180, 14);
  // tribune de la ligne opposée, plus basse
  sc.grandstand(t.indexAt(t.startS + 0.55 * t.length), outside, 300, 12);

  // grillage de protection (≈ 6 m) sur tout le mur extérieur
  catchFence(sc, { sides: [outside], fromH: 1.05, toH: 6.5, postStep: 5 });

  // ---------------------------------------------------------------- Infield
  sc.pitBuilding(iStart, infield, 480);
  garages(sc, iStart, infield);
  lake(sc);
  scoringPylon(sc, iStart, infield);
  infieldLogo(sc, iStart, infield);

  // ---------------------------------------------------------------- Éclairage de stade
  const pools = stadiumLights(sc, outside);
  if (sc.night) {
    lightPools(sc.group, pools, 'rgba(255,240,215,0.35)', 'poolOval');
    roadWash(sc, () => [0.05, 0.05, 0.047]);
  }

  // ---------------------------------------------------------------- Végétation, parkings
  const f = sc.forest(InstancedForest, 23);
  const L = sc.terrain.lake;
  if (L) {
    for (let k = 0; k < 90; k++) {
      const a = r() * Math.PI * 2, d = 1.08 + r() * 0.25;
      const x = L.cx + Math.cos(a) * L.rx * d, z = L.cz + Math.sin(a) * L.rz * d;
      if (sc.clearance(x, z) < 20) continue;
      f.add('palm', 3, x, sc.groundAt(x, z) - 0.2, z, 0.9 + r() * 0.4, r() * 6.3);
    }
  }
  sc.scatter(f, Math.round(900 * q), ['liveoak', 'pine', 'palm'], { clump: 260, threshold: 0.05, minClear: 70, filter: (x, y, z) => !L || sc.terrain.lakeDepth(x, z) === 0 });
  sc.scatter(f, Math.round(500 * q), ['palm', 'liveoak'], { clump: 200, threshold: -0.2, minClear: 35, nearTrack: 60 });
  // ceinture de pinèdes et de chênes au-delà des parkings (ligne d'horizon boisée)
  sc.scatter(f, Math.round(2600 * q), ['pine', 'pine', 'liveoak', 'palm'], { clump: 150, threshold: -0.3, minClear: 60, filter: (x, y, z) => { const o = sc.terrain.outside(x, z); return o > 170 && o < 480; } });
  f.build(450, true, 300);
  parking(sc, outside);
  blimp(sc);
  sc.buildBillboards();
}

// Tribune principale à deux étages, loges vitrées et toit, extrudée le long du mur
function bigStand(sc, i0, side, length) {
  const t = sc.track;
  const crowd = sc.cachedMat('crowd', () => new THREE.MeshStandardMaterial({ map: TX.crowd(), roughness: 0.9, side: THREE.DoubleSide }));
  const conc = sc.cachedMat('gsConc', () => new THREE.MeshStandardMaterial({ map: TX.concrete(170), color: 0xd0d2d6, roughness: 0.9, side: THREE.DoubleSide }));
  const roofM = sc.cachedMat('gsRoof', () => new THREE.MeshStandardMaterial({ color: 0xf2f3f5, metalness: 0.2, roughness: 0.55, side: THREE.DoubleSide }));
  const glass = glassFacade(31, { night: sc.night, tint: [35, 55, 75], lit: 0.85, cols: 16, rows: 2, vary: 0.15, slab: 0.25, frame: '#d8dce0' });
  const glassM = sc.cachedMat('suites', () => new THREE.MeshStandardMaterial({ map: glass.map, emissiveMap: glass.emissiveMap, emissive: 0xffffff, emissiveIntensity: sc.night ? 1.3 : 0.15, roughness: 0.1, metalness: 0.6, side: THREE.DoubleSide }));
  const count = Math.round(length / t.spacing);
  const start = t.idx(i0 - Math.floor(count / 2));
  const steps = (d0, h0, rows) => {
    const prof = [[d0, h0 - 1.6], [d0, h0]];
    let d = d0, h = h0;
    for (let k = 0; k < rows; k++) {
      prof.push([d + 0.85, h]);
      d += 0.85;
      prof.push([d, h + 0.45]);
      h += 0.45;
    }
    return { prof, d, h };
  };
  const a = steps(4, 1.2, 20);
  sc.extrude(start, count, side, a.prof, crowd, { uS: 8.2, vS: 10.4, step: 2 });
  // loges vitrées entre les deux étages
  sc.extrude(start, count, side, [[a.d + 0.4, a.h], [a.d + 0.4, a.h + 6.5]], glassM, { uS: 32, vS: 6.5, step: 2 });
  const b = steps(a.d + 1.2, a.h + 7.5, 22);
  sc.extrude(start, count, side, [[a.d + 0.4, a.h + 6.5], [a.d + 1.2, a.h + 6.5], [a.d + 1.2, a.h + 7.5]], conc, { uS: 6, vS: 6, step: 2 });
  sc.extrude(start, count, side, b.prof.slice(1), crowd, { uS: 8.2, vS: 10.4, step: 2 });
  const back = b.d + 0.5;
  sc.extrude(start, count, side, [[back, -1], [back, b.h + 4.5]], conc, { uS: 6, vS: 6, step: 2 });
  sc.extrude(start, count, side, [[3.7, -0.5], [3.7, 1.2], [4, 1.2]], conc, { uS: 6, vS: 6, step: 2 });
  // toit en porte-à-faux au-dessus de l'étage supérieur
  sc.extrude(start, count, side, [[back + 0.5, b.h + 4.5], [a.d + 3, b.h + 6.5]], roofM, { uS: 10, vS: 10, step: 2 });
  // tours d'escaliers aux extrémités (ferment le profil)
  const f = {};
  for (const k of [0, count]) {
    const i = t.idx(start + k);
    const wall = side > 0 ? t.wallR[i] : t.wallL[i];
    frameAt(t, i, side * (wall + back / 2 + 2), f);
    const y = surfaceY(t, i, side * wall);
    sc.bin.add('gsConc', conc, boxWorldUV(back + 1, b.h + 7, 9, 6, 6), mat(f.x, y + (b.h + 7) / 2 - 1, f.z, f.rot));
  }
  // panneaux publicitaires sur le toit
  for (let k = 20; k < count - 20; k += 45) {
    const i = t.idx(start + k);
    const wall = side > 0 ? t.wallR[i] : t.wallL[i];
    frameAt(t, i, side * (wall + back - 2), f);
    const y = surfaceY(t, i, side * wall) + b.h + 8.8;
    const bi = (k / 45) % 10 | 0;
    const m = sc.cachedMat('bb' + bi, () => new THREE.MeshStandardMaterial({ map: TX.banner(bi), roughness: 0.55 }));
    sc.bin.add('bb' + bi, m, new THREE.PlaneGeometry(16, 3), mat(f.x, y, f.z, f.rot + (side > 0 ? -Math.PI / 2 : Math.PI / 2)));
  }
}

// Garages et motorhomes de l'infield derrière les stands
function garages(sc, i0, side) {
  const t = sc.track;
  const r = sc.r;
  const white = sc.cachedMat('garage', () => new THREE.MeshStandardMaterial({ map: TX.concrete(225), color: 0xf2f2f2, roughness: 0.8 }));
  const roofM = sc.cachedMat('garageRoof', () => new THREE.MeshStandardMaterial({ color: 0x5d6570, metalness: 0.4, roughness: 0.6 }));
  const camp = sc.cachedMat('camp', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
  const f = {};
  for (let k = -200; k <= 200; k += 34) {
    const i = t.idx(i0 + Math.round(k / t.spacing));
    const wall = side > 0 ? t.wallR[i] : t.wallL[i];
    for (const row of [48, 78]) {
      frameAt(t, i, side * (wall + row), f);
      if (sc.clearance(f.x, f.z) < 30) continue;
      const y = sc.groundAt(f.x, f.z);
      sc.bin.add('garage', white, boxWorldUV(16, 5, 28, 6, 6), mat(f.x, y + 2.3, f.z, f.rot));
      sc.bin.add('garageRoof', roofM, new THREE.BoxGeometry(17, 0.5, 29), mat(f.x, y + 5, f.z, f.rot));
    }
    // motorhomes (blanc avec bandeau de couleur)
    frameAt(t, i, side * (wall + 106), f);
    if (sc.clearance(f.x, f.z) < 30) continue;
    const y = sc.groundAt(f.x, f.z);
    const col = [[0.8, 0.1, 0.1], [0.1, 0.3, 0.75], [0.95, 0.75, 0.1], [0.1, 0.1, 0.12]][Math.floor(r() * 4)];
    sc.bin.add('camp', camp, new THREE.BoxGeometry(2.6, 3.4, 13), mat(f.x, y + 1.9, f.z, f.rot), [0.92, 0.92, 0.94]);
    sc.bin.add('camp', camp, new THREE.BoxGeometry(2.65, 0.6, 13.05), mat(f.x, y + 1.5, f.z, f.rot), col);
  }
}

// Lac de l'infield : plan d'eau elliptique (le terrain est creusé dessous)
function lake(sc) {
  const L = sc.terrain.lake;
  if (!L) return;
  const y = sc.terrain.natural(L.cx, L.cz) + 3.6;
  const g = new THREE.CircleGeometry(1, 72);
  g.rotateX(-Math.PI / 2);
  const nmap = TX.waterNormal();
  nmap.repeat.set(40, 20);
  const m = new THREE.MeshStandardMaterial({ color: sc.night ? 0x061018 : 0x1d4a55, roughness: 0.1, metalness: 0, normalMap: nmap, normalScale: new THREE.Vector2(0.25, 0.25), envMapIntensity: 1.3 });
  const water = new THREE.Mesh(g, m);
  water.scale.set(L.rx * 1.02, 1, L.rz * 1.02);
  water.position.set(L.cx, y, L.cz);
  water.receiveShadow = true;
  sc.group.add(water);
  sc.water = { mesh: water, map: nmap };
  // petit ponton et barques
  const wood = sc.cachedMat('wood', () => new THREE.MeshStandardMaterial({ color: 0x6b4428, roughness: 0.85 }));
  const hull = sc.cachedMat('hull', () => new THREE.MeshStandardMaterial({ color: 0xf5f5f2, roughness: 0.4 }));
  sc.bin.add('wood', wood, new THREE.BoxGeometry(3, 0.3, 30), mat(L.cx, y + 0.4, L.cz + L.rz * 0.9));
  for (let k = 0; k < 4; k++) {
    const b = new THREE.SphereGeometry(1, 8, 4);
    b.scale(1.1, 0.45, 3);
    sc.bin.add('hull', hull, b, mat(L.cx + (k - 1.5) * 60 + sc.r() * 20, y + 0.1, L.cz + (sc.r() - 0.5) * L.rz, sc.r() * 3));
  }
}

// Pylône des positions (classement lumineux) dans l'infield, face à la tribune
function scoringPylon(sc, i0, side) {
  const t = sc.track;
  const i = t.idx(i0 + Math.round(120 / t.spacing));
  const wall = side > 0 ? t.wallR[i] : t.wallL[i];
  const f = frameAt(t, i, side * (wall + 40), {});
  const y = sc.groundAt(f.x, f.z);
  const c = makeCanvas(256, 1024);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0, 0, 256, 1024);
  ctx.fillStyle = '#1e5bd8';
  ctx.fillRect(0, 0, 256, 120);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 54px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LAKEVIEW', 128, 78, 236);
  const nums = [7, 24, 11, 3, 48, 19, 88, 5, 31, 22];
  ctx.font = 'bold 74px Arial, Helvetica, sans-serif';
  nums.forEach((n, k) => {
    const yy = 200 + k * 86;
    ctx.fillStyle = '#ffb627';
    ctx.textAlign = 'left';
    ctx.fillText(String(k + 1), 20, yy);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(String(n), 236, yy);
  });
  const tex = canvasTexture(c, { repeat: false });
  const panelM = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: sc.night ? 1.6 : 0.9, roughness: 0.5 });
  const steel = sc.cachedMat('pylonSteel', () => new THREE.MeshStandardMaterial({ color: 0x2c2f35, metalness: 0.6, roughness: 0.5 }));
  sc.bin.add('pylonSteel', steel, new THREE.BoxGeometry(2.5, 18, 2.5), mat(f.x, y + 9, f.z, f.rot));
  sc.bin.add('pylonSteel', steel, new THREE.BoxGeometry(9.4, 34, 1.6), mat(f.x, y + 18 + 17, f.z, f.rot));
  for (const s of [1, -1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 32), panelM);
    // panneaux tournés vers la tribune (de part et d'autre)
    const n = side > 0 ? -1 : 1;
    p.position.set(f.x + f.rx * n * 0.82 * s, y + 35, f.z + f.rz * n * 0.82 * s);
    p.rotation.y = f.rot + (n * s > 0 ? Math.PI / 2 : -Math.PI / 2);
    sc.group.add(p);
  }
}

// Logo peint sur la pelouse de l'infield
function infieldLogo(sc, i0, side) {
  const t = sc.track;
  const wall = side > 0 ? t.wallR[i0] : t.wallL[i0];
  const f = frameAt(t, i0, side * (wall + 70), {});
  if (sc.clearance(f.x, f.z) < 50) return;
  const c = makeCanvas(1024, 256);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 1024, 256);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = 'bold 190px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LAKEVIEW', 512, 135, 1000);
  const g = new THREE.PlaneGeometry(130, 32);
  g.rotateX(-Math.PI / 2);
  let ymax = -Infinity;
  for (let a = -65; a <= 65; a += 10) for (let b = -16; b <= 16; b += 8) ymax = Math.max(ymax, sc.groundAt(f.x + f.dx * a + f.rx * b, f.z + f.dz * a + f.rz * b));
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: canvasTexture(c, { repeat: false }), transparent: true, depthWrite: false, roughness: 0.9 }));
  m.position.set(f.x, ymax + 0.06, f.z);
  // lisible depuis la tribune (de l'autre côté de la piste)
  m.rotation.y = f.rot + (side > 0 ? Math.PI : 0);
  m.renderOrder = 1;
  m.receiveShadow = true;
  sc.group.add(m);
}

// Pylônes d'éclairage de stade répartis autour de l'anneau (côté extérieur)
function stadiumLights(sc, side) {
  const t = sc.track;
  const steel = sc.cachedMat('pylonSteel', () => new THREE.MeshStandardMaterial({ color: 0x2c2f35, metalness: 0.6, roughness: 0.5 }));
  const lampM = sc.cachedMat('stadiumLamp', () => new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xfff4e0, emissiveIntensity: sc.night ? 5 : 0, roughness: 0.4 }));
  const pools = [];
  const n = Math.round(240 / t.spacing);
  const f = {};
  for (let i = 0; i < t.count; i += n) {
    const wall = side > 0 ? t.wallR[i] : t.wallL[i];
    frameAt(t, i, side * (wall + 62), f);
    if (sc.clearance(f.x, f.z) < 50) continue;
    const y = sc.groundAt(f.x, f.z);
    sc.bin.add('pylonSteel', steel, new THREE.CylinderGeometry(0.6, 1, 46, 8), mat(f.x, y + 23, f.z));
    // rampe de projecteurs inclinée vers la piste
    sc.bin.add('pylonSteel', steel, new THREE.BoxGeometry(12, 6, 0.8), mat(f.x - f.rx * side * 1.2, y + 46, f.z - f.rz * side * 1.2, f.rot + Math.PI / 2));
    for (let a = -2; a <= 2; a++) {
      for (let b2 = 0; b2 < 2; b2++) {
        const lx = f.x - f.rx * side * 1.7 + f.dx * a * 2.3, lz = f.z - f.rz * side * 1.7 + f.dz * a * 2.3;
        sc.bin.add('stadiumLamp', lampM, new THREE.BoxGeometry(1.8, 1.8, 0.3), matR(lx, y + 44.2 + b2 * 2.6, lz, f.rot + (side > 0 ? -Math.PI / 2 : Math.PI / 2), -0.35, 0));
      }
    }
    const pf = frameAt(t, i, 0, {});
    pools.push([pf.x, t.py[i] + 0.1, pf.z, 30]);
  }
  sc.bin.noShadow('stadiumLamp');
  return pools;
}

// Parkings de spectateurs autour de l'anneau
function parking(sc, side) {
  const t = sc.track;
  const r = sc.r;
  const lotM = sc.cachedMat('lot', () => new THREE.MeshStandardMaterial({ map: TX.asphalt().map, color: 0x8c8c8e, roughness: 0.95 }));
  const camp = sc.cachedMat('camp', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
  const carCols = [[0.75, 0.1, 0.1], [0.08, 0.08, 0.1], [0.85, 0.85, 0.86], [0.15, 0.3, 0.6], [0.5, 0.52, 0.55], [0.6, 0.6, 0.62], [0.2, 0.4, 0.25]];
  const body = new THREE.BoxGeometry(1.8, 1.0, 4.4);
  const f = {};
  for (let i = 0; i < t.count; i += Math.round(200 / t.spacing)) {
    if (r() < 0.35) continue;
    const wall = side > 0 ? t.wallR[i] : t.wallL[i];
    frameAt(t, i, side * (wall + 140), f);
    if (sc.clearance(f.x, f.z) < 85) continue; // (clearance plafonne à 90 m)
    // dalle d'enrobé épousant le terrain
    const W = 90, D = 60, NX = 9, NZ = 6;
    const pos = [], uv = [], idx = [];
    for (let a = 0; a <= NX; a++)
      for (let b = 0; b <= NZ; b++) {
        const lx = (a / NX - 0.5) * W, lz = (b / NZ - 0.5) * D;
        const x = f.x + f.dx * lx + f.rx * lz, z = f.z + f.dz * lx + f.rz * lz;
        pos.push(x, sc.groundAt(x, z) + 0.08, z);
        uv.push(lx / 8, lz / 8);
      }
    for (let a = 0; a < NX; a++)
      for (let b = 0; b < NZ; b++) {
        const k = a * (NZ + 1) + b;
        idx.push(k, k + 1, k + NZ + 1, k + 1, k + NZ + 2, k + NZ + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    sc.bin.add('lot', lotM, g, null);
    for (let a = -40; a <= 40; a += 2.8) {
      for (let b = -24; b <= 24; b += 8) {
        if (r() < 0.3) continue;
        const x = f.x + f.dx * a + f.rx * b, z = f.z + f.dz * a + f.rz * b;
        sc.bin.add('camp', camp, body, mat(x, sc.groundAt(x, z) + 0.6, z, f.rot + Math.PI / 2), carCols[Math.floor(r() * carCols.length)]);
      }
    }
  }
  sc.bin.noShadow('camp');
}

// Dirigeable publicitaire tournant lentement au-dessus du circuit
function blimp(sc) {
  const b = sc.track.bounds;
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const R = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 0.45;
  const grp = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xe9eaec, roughness: 0.5, metalness: 0.2 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), skin);
  body.scale.set(9, 9, 36);
  grp.add(body);
  const fin = new THREE.BoxGeometry(0.4, 7, 6);
  for (let k = 0; k < 4; k++) {
    const m = new THREE.Mesh(fin, new THREE.MeshStandardMaterial({ color: 0x1e5bd8, roughness: 0.5 }));
    m.position.set(Math.sin((k * Math.PI) / 2) * 6, Math.cos((k * Math.PI) / 2) * 6, -30);
    m.rotation.z = (k * Math.PI) / 2;
    grp.add(m);
  }
  const gondola = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 9), new THREE.MeshStandardMaterial({ color: 0x2c2f35, roughness: 0.5 }));
  gondola.position.set(0, -9.6, 4);
  grp.add(gondola);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(40, 7), new THREE.MeshStandardMaterial({ map: TX.textTexture('LAKEVIEW', { w: 512, h: 96, bg: '#1e5bd8', fg: '#ffffff', font: 'bold 70px Arial' }), roughness: 0.5 }));
  label.position.set(9.05, 1, 0);
  label.rotation.y = Math.PI / 2;
  grp.add(label);
  const label2 = label.clone();
  label2.position.x = -9.05;
  label2.rotation.y = -Math.PI / 2;
  grp.add(label2);
  sc.group.add(grp);
  let a = 0;
  const h = sc.terrain.pa + 220;
  sc.animated.push((dt) => {
    a += dt * 0.012;
    grp.position.set(cx + Math.cos(a) * R, h, cz + Math.sin(a) * R * 0.6);
    grp.rotation.y = Math.atan2(-Math.sin(a), 0.6 * Math.cos(a)); // nez dans le sens du déplacement
  });
  grp.position.set(cx + R, h, cz);
}
