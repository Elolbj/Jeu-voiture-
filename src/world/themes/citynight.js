// Décor « ville de nuit » (Shinden, Tokyo) : îlots denses de tours aux fenêtres éclairées,
// enseignes néon verticales et horizontales, autoroute surélevée enjambant la piste avec sa
// circulation, lampadaires, grillages sur les murs, passerelle lumineuse, tour de télévision.
import * as THREE from 'three';
import { InstancedForest } from '../vegetation.js';
import * as TX from '../textures.js';
import { boxWorldUV, mat, frameAt, infieldSide, glassFacade, catchFence, textAtlas, atlasPlane, roadWash } from './common.js';

const NEON_WORDS = [
  ['SHINDEN', '#ff3b8d'], ['RAMEN', '#ffd23b'], ['KARAOKE', '#39d0ff'], ['PACHINKO', '#ff6a2b'],
  ['SUSHI BAR', '#39ff9a'], ['HOTEL', '#c45bff'], ['GAME CENTER', '#4fa3ff'], ['IZAKAYA', '#ff4040'],
  ['MANGA', '#ffe14f'], ['CAFÉ 24H', '#5bffea'], ['DENKI', '#ff7be0'], ['KAZE MOTORS', '#ff2a2a'],
  ['TOKYO NIGHT', '#8cf'], ['YAKITORI', '#ffb03b'], ['ARCADE', '#b5ff3b'], ['NEON', '#ff4fd8'],
];

export function buildCityNight(sc) {
  const t = sc.track;
  const r = sc.r;
  const night = sc.night;
  const infield = infieldSide(t);
  const iStart = t.indexAt(t.startS);

  // Zones réservées (stands, tribune, autoroute) : pas d'immeuble dessus
  const reserved = [];
  const fr = {};
  for (let k = -55; k <= 55; k += 5) {
    const i = t.idx(iStart + k);
    frameAt(t, i, infield * ((infield > 0 ? t.wallR[i] : t.wallL[i]) + 13), fr);
    reserved.push([fr.x, fr.z, 17]);
    if (Math.abs(k) <= 25) {
      frameAt(t, i, -infield * ((infield > 0 ? t.wallL[i] : t.wallR[i]) + 8), fr);
      reserved.push([fr.x, fr.z, 12]);
    }
  }
  const via = t.def.decor?.viaduct;
  if (via) {
    const [[ax, az], [bx, bz]] = via;
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 15);
    for (let k = 0; k <= n; k++) reserved.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n, 16]);
  }
  const isFree = (x, z, rad) => reserved.every(([rx, rz, rr]) => Math.hypot(rx - x, rz - z) > rr + rad);

  // ---------------------------------------------------------------- Immeubles
  const facades = [];
  for (let k = 0; k < 6; k++) {
    const fx = TX.facade(k + 10, night);
    facades.push(new THREE.MeshStandardMaterial({ map: fx.map, emissiveMap: fx.emissiveMap, emissive: 0xffffff, emissiveIntensity: night ? 1.4 : 0, roughness: 0.7, metalness: 0.1 }));
  }
  for (let k = 0; k < 3; k++) {
    const g = glassFacade(20 + k, { night, tint: [[30, 50, 70], [45, 45, 60], [25, 55, 60]][k], lit: 0.45, cols: 8, rows: 16, vary: 0.3, slab: 0.15, frame: '#8d939b' });
    facades.push(new THREE.MeshStandardMaterial({ map: g.map, emissiveMap: g.emissiveMap, emissive: 0xffffff, emissiveIntensity: night ? 1.3 : 0, roughness: 0.15, metalness: 0.7 }));
  }
  const roofMat = sc.cachedMat('cityRoof', () => new THREE.MeshStandardMaterial({ color: 0x26272b, roughness: 0.9 }));
  const redM = sc.cachedMat('aviation', () => new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.2), toneMapped: false }));
  const beacon = new THREE.SphereGeometry(0.6, 6, 4);
  const placed = [];
  const tryBuilding = (x, z, w, d, h, rot, front) => {
    for (const p of placed) if (Math.hypot(p.x - x, p.z - z) < (p.size + Math.max(w, d)) * 0.5) return false;
    if (!isFree(x, z, Math.max(w, d) * 0.5)) return false;
    const c = Math.cos(rot), s = Math.sin(rot);
    for (const [lx, lz] of [[w / 2, d / 2], [-w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2], [0, 0]]) {
      if (sc.clearance(x + c * lx + s * lz, z - s * lx + c * lz) < 3.5) return false;
    }
    const y = sc.groundAt(x, z) - 0.5;
    const fi = h > 70 && r() < 0.6 ? 6 + Math.floor(r() * 3) : Math.floor(r() * 6);
    sc.bin.add('cfac' + fi, facades[fi], boxWorldUV(w, h, d, 32, 36), mat(x, y + h / 2, z, rot));
    sc.bin.add('cityRoof', roofMat, new THREE.BoxGeometry(w + 0.4, 0.8, d + 0.4), mat(x, y + h + 0.4, z, rot));
    // locaux techniques en toiture
    if (r() < 0.6) sc.bin.add('cityRoof', roofMat, new THREE.BoxGeometry(w * 0.35, 3, d * 0.3), mat(x, y + h + 2, z, rot + 0.01));
    if (h > 60) sc.bin.add('aviation', redM, beacon, mat(x, y + h + 1.5, z));
    placed.push({ x, z, w, d, h, rot, size: Math.max(w, d), front, y });
    return true;
  };
  for (let i = 0; i < t.count; i += 5) {
    for (const side of [-1, 1]) {
      if (r() < 0.08) continue;
      const wall = side > 0 ? t.wallR[i] : t.wallL[i];
      frameAt(t, i, 0, fr);
      const w = 14 + r() * 14, d = 14 + r() * 12;
      const off = wall + 6 + d / 2;
      const x = fr.x + fr.rx * off * side, z = fr.z + fr.rz * off * side;
      tryBuilding(x, z, w, d, 16 + r() * 34, fr.rot, { side, i });
      if (r() < 0.55) {
        const off2 = off + d / 2 + 14 + r() * 26;
        tryBuilding(fr.x + fr.rx * off2 * side, fr.z + fr.rz * off2 * side, 18 + r() * 14, 18 + r() * 14, 45 + r() * 110, fr.rot, null);
      }
    }
  }
  // skyline lointaine
  const b = t.bounds;
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  for (let k = 0; k < 170; k++) {
    const a = r() * Math.PI * 2;
    const rad = 420 + r() * 900;
    tryBuilding(cx + Math.cos(a) * rad, cz + Math.sin(a) * rad, 20 + r() * 26, 20 + r() * 26, 40 + r() * 170, r() * 3, null);
  }

  // ---------------------------------------------------------------- Enseignes néon (un atlas)
  neonSigns(sc, placed);

  // ---------------------------------------------------------------- Autoroute surélevée
  if (via) viaduct(sc, via);

  // ---------------------------------------------------------------- Stands, tribune
  sc.pitBuilding(iStart, infield, 200);
  sc.grandstand(iStart, -infield, 90, 8);

  // ---------------------------------------------------------------- Rue : lampadaires, grillages
  sc.buildStreetLights({ step: 21, R: 10.5, color: 'rgba(255,196,135,0.12)', key: 'poolNeon' });
  // lueur des enseignes et vitrines : violacée à droite, orangée à gauche
  if (night) roadWash(sc, (side, u) => { const v = 0.45 + 0.15 * Math.sin(u / 37) + 0.08 * Math.sin(u / 11.3); return side > 0 ? [0.1 * v, 0.08 * v, 0.12 * v] : [0.13 * v, 0.085 * v, 0.06 * v]; });
  catchFence(sc, { fromH: 1.05, toH: 3.9, postStep: 4 });

  // passerelle lumineuse au-dessus de la ligne droite des stands
  neonBridge(sc, t.idx(iStart + Math.round(140 / t.spacing)));

  // arbres d'alignement des squares
  const f = sc.forest(InstancedForest, 19);
  sc.scatter(f, Math.round(260 * sc.quality.trees), ['deciduous'], { nearTrack: 8, minClear: 3, threshold: 0.15, filter: (x, y, z) => isFree(x, z, 3) && placed.every((p) => Math.hypot(p.x - x, p.z - z) > p.size * 0.75) });
  f.build(450, true, 260);

  // tour de télévision (repère lointain)
  tvTower(sc, b.maxX + 700, b.minZ - 650);
}

// Enseignes : verticales sur les angles des façades côté piste, horizontales en attique
function neonSigns(sc, placed) {
  const r = sc.r;
  const entries = NEON_WORDS.map(([text, fg]) => ({ text, fg, bg: '#08080b', border: fg, glow: true, font: 'bold 54px Arial, Helvetica, sans-serif' }));
  const atlas = textAtlas('neon', entries, { cellW: 320, cellH: 96 });
  const vEntries = NEON_WORDS.map(([text, fg]) => ({ text: text.split(' ')[0], fg, bg: '#08080b', border: fg, glow: true, font: 'bold 60px Arial, Helvetica, sans-serif' }));
  const vAtlas = textAtlas('neonV', vEntries, { cellW: 320, cellH: 96 });
  const k = sc.night ? 2.4 : 1.2;
  const hm = sc.cachedMat('neonH', () => new THREE.MeshBasicMaterial({ map: atlas.texture, color: new THREE.Color(k, k, k), toneMapped: false }));
  const vm = sc.cachedMat('neonV', () => new THREE.MeshBasicMaterial({ map: vAtlas.texture, color: new THREE.Color(k, k, k), toneMapped: false }));
  let n = 0;
  for (const p of placed) {
    if (!p.front || r() < 0.35) continue;
    const { side } = p.front;
    // façade côté piste (axe X local du bâtiment = droite de la piste)
    const c = Math.cos(p.rot), s = Math.sin(p.rot);
    const fx = p.x - side * c * (p.w / 2 + 0.3), fz = p.z + side * s * (p.w / 2 + 0.3);
    const rotFace = p.rot + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
    const tx = Math.cos(rotFace), tz = -Math.sin(rotFace); // horizontale le long de la façade
    const idx = Math.floor(r() * NEON_WORDS.length);
    if (r() < 0.55) {
      // enseigne verticale (texte tourné) près d'un angle
      const along = (r() < 0.5 ? -1 : 1) * Math.max(0, p.d / 2 - 1.6);
      const g = atlasPlane(9, 2.2, vAtlas.rect(idx));
      g.rotateZ(Math.PI / 2);
      const hy = p.y + 7 + r() * Math.max(1, p.h - 18);
      sc.bin.add('neonV', vm, g, mat(fx + tx * along, hy, fz + tz * along, rotFace));
    } else {
      const w = Math.min(p.d * 0.8, 12);
      const g = atlasPlane(w, w * 0.3, atlas.rect(idx));
      sc.bin.add('neonH', hm, g, mat(fx, p.y + Math.min(p.h - 2, 6 + r() * 10), fz, rotFace));
    }
    n++;
  }
  sc.bin.noShadow('neonH');
  sc.bin.noShadow('neonV');
  return n;
}

// Autoroute urbaine sur piliers, parapets, éclairage au sodium et circulation animée
function viaduct(sc, [[ax, az], [bx, bz]]) {
  const len = Math.hypot(bx - ax, bz - az);
  const dx = (bx - ax) / len, dz = (bz - az) / len;
  const rot = Math.atan2(dx, dz);
  const conc = sc.cachedMat('viaConc', () => new THREE.MeshStandardMaterial({ map: TX.concrete(160), color: 0xb8b8b8, roughness: 0.9 }));
  const lampM = sc.cachedMat('sodium', () => new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffa040, emissiveIntensity: sc.night ? 6 : 0.5 }));
  const H = 12.5, W = 17;
  // hauteur du tablier : au-dessus du point le plus haut du sol sous l'ouvrage
  let gmax = -Infinity;
  for (let d = 0; d <= len; d += 10) gmax = Math.max(gmax, sc.groundAt(ax + dx * d, az + dz * d));
  const y = gmax + H;
  const seg = 40;
  for (let d = 0; d < len; d += seg) {
    const cx = ax + dx * (d + seg / 2), cz = az + dz * (d + seg / 2);
    sc.bin.add('viaConc', conc, boxWorldUV(W, 1.6, seg + 0.05, 6, 6), mat(cx, y, cz, rot));
    for (const s of [-1, 1]) {
      const px = cx + dz * s * (W / 2 - 0.3), pz = cz - dx * s * (W / 2 - 0.3);
      sc.bin.add('viaConc', conc, boxWorldUV(0.5, 1.2, seg + 0.05, 6, 6), mat(px, y + 1.4, pz, rot));
    }
    // pilier en T (évite la piste)
    const px = ax + dx * d, pz = az + dz * d;
    if (sc.clearance(px, pz) > 3 && sc.clearance(px + dz * 4, pz - dx * 4) > 3 && sc.clearance(px - dz * 4, pz + dx * 4) > 3) {
      const g0 = sc.groundAt(px, pz);
      sc.bin.add('viaConc', conc, boxWorldUV(3, y - g0, 3, 6, 6), mat(px, (y + g0) / 2 - 0.8, pz, rot));
      sc.bin.add('viaConc', conc, boxWorldUV(W - 3, 1.8, 3, 6, 6), mat(px, y - 1.6, pz, rot));
    }
    // lampadaires sodium
    for (const s of [-1, 1]) {
      const lx = cx + dz * s * (W / 2 - 0.6), lz = cz - dx * s * (W / 2 - 0.6);
      sc.bin.add('viaConc', conc, new THREE.BoxGeometry(0.2, 7, 0.2), mat(lx, y + 4.3, lz));
      sc.bin.add('sodium', lampM, new THREE.BoxGeometry(1.4, 0.25, 0.5), mat(lx - dz * s * 0.7, y + 7.8, lz + dx * s * 0.7, rot + Math.PI / 2));
    }
  }
  sc.bin.noShadow('sodium');
  // circulation : feux avant (blancs) sur une voie, feux arrière (rouges) sur l'autre
  const N = 36;
  const g = new THREE.BoxGeometry(1.8, 0.6, 0.3);
  const white = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.4, 2.1), toneMapped: false });
  const red = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.15, 0.1), toneMapped: false });
  const lanes = [
    { m: new THREE.InstancedMesh(g, white, N), off: -4, dir: 1, speed: 24 },
    { m: new THREE.InstancedMesh(g, red, N), off: 4, dir: -1, speed: 27 },
  ];
  const pos = [];
  const m4 = new THREE.Matrix4();
  for (const L of lanes) {
    const arr = [];
    for (let k = 0; k < N; k++) arr.push(sc.r() * len);
    pos.push(arr);
    L.m.frustumCulled = false;
    sc.group.add(L.m);
  }
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot);
  const v = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1);
  sc.animated.push((dt) => {
    lanes.forEach((L, li) => {
      const arr = pos[li];
      for (let k = 0; k < N; k++) {
        arr[k] = (arr[k] + L.dir * L.speed * dt + len) % len;
        v.set(ax + dx * arr[k] + dz * L.off, y + 1.5, az + dz * arr[k] - dx * L.off);
        m4.compose(v, q, s1);
        L.m.setMatrixAt(k, m4);
      }
      L.m.instanceMatrix.needsUpdate = true;
    });
  });
}

// Passerelle piétonne couverte d'écrans lumineux au-dessus de la ligne droite
function neonBridge(sc, i) {
  const t = sc.track;
  const f = frameAt(t, i, 0, {});
  const wl = t.wallL[i], wr = t.wallR[i];
  const span = wl + wr + 10;
  const cx = f.x + f.rx * (wr - wl) / 2, cz = f.z + f.rz * (wr - wl) / 2;
  const y0 = t.py[i] + 7;
  const steel = sc.cachedMat('nbSteel', () => new THREE.MeshStandardMaterial({ color: 0x2b2e35, metalness: 0.6, roughness: 0.45 }));
  sc.bin.add('nbSteel', steel, new THREE.BoxGeometry(span, 0.6, 4), mat(cx, y0, cz, f.rot));
  sc.bin.add('nbSteel', steel, new THREE.BoxGeometry(span, 0.3, 4.4), mat(cx, y0 + 3.2, cz, f.rot));
  for (const side of [-1, 1]) {
    const w = side > 0 ? wr : wl;
    for (const e of [-1.8, 1.8]) {
      const px = f.x + f.rx * side * (w + 3) + f.dx * e, pz = f.z + f.rz * side * (w + 3) + f.dz * e;
      const g0 = sc.groundAt(px, pz);
      sc.bin.add('nbSteel', steel, new THREE.BoxGeometry(0.5, y0 + 3.2 - g0, 0.5), mat(px, (y0 + 3.2 + g0) / 2, pz));
    }
  }
  // bandeaux lumineux des deux faces (atlas néon)
  const atlas = textAtlas('neon', NEON_WORDS.map(([text, fg]) => ({ text, fg, bg: '#08080b', border: fg, glow: true, font: 'bold 54px Arial, Helvetica, sans-serif' })), { cellW: 320, cellH: 96 });
  const k = sc.night ? 2.4 : 1.2;
  const hm = sc.cachedMat('neonH', () => new THREE.MeshBasicMaterial({ map: atlas.texture, color: new THREE.Color(k, k, k), toneMapped: false }));
  for (const side of [-1, 1]) {
    const g = atlasPlane(Math.min(span - 4, 20), 2.6, atlas.rect(0));
    sc.bin.add('neonH', hm, g, mat(cx + f.dx * side * 2.25, y0 + 1.7, cz + f.dz * side * 2.25, f.rot + (side > 0 ? Math.PI : 0)));
  }
}

// Tour de télévision en treillis rouge et blanc, illuminée la nuit
function tvTower(sc, x, z) {
  const y = sc.groundAt(x, z);
  const redW = sc.cachedMat('tvRed', () => new THREE.MeshStandardMaterial({ color: 0xd8401c, emissive: 0xff6a20, emissiveIntensity: sc.night ? 0.9 : 0, roughness: 0.5, metalness: 0.4 }));
  const whiteW = sc.cachedMat('tvWhite', () => new THREE.MeshStandardMaterial({ color: 0xf2f2f2, emissive: 0xfff0d0, emissiveIntensity: sc.night ? 0.7 : 0, roughness: 0.5, metalness: 0.4 }));
  const H = 300;
  const legs = 4;
  const levels = 12;
  for (let l = 0; l < levels; l++) {
    const u0 = l / levels, u1 = (l + 1) / levels;
    const w0 = 42 * Math.pow(1 - u0 * 0.92, 1.6) + 2, w1 = 42 * Math.pow(1 - u1 * 0.92, 1.6) + 2;
    const y0 = y + u0 * H * 0.85, y1 = y + u1 * H * 0.85;
    const m = l % 2 ? whiteW : redW;
    const key = l % 2 ? 'tvWhite' : 'tvRed';
    for (let k = 0; k < legs; k++) {
      const a = (k / legs) * Math.PI * 2 + Math.PI / 4;
      const x0 = x + Math.cos(a) * w0 / 2, z0 = z + Math.sin(a) * w0 / 2, x1 = x + Math.cos(a) * w1 / 2, z1 = z + Math.sin(a) * w1 / 2;
      const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
      // montant orienté du bas vers le haut du tronçon (axe Y du cylindre vers la cible)
      const o = new THREE.Object3D();
      o.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      o.lookAt(x1, y1, z1);
      o.rotateX(Math.PI / 2);
      o.updateMatrix();
      sc.bin.add(key, m, new THREE.CylinderGeometry(0.7, 0.9, len, 5), o.matrix);
    }
    // anneau horizontal
    sc.bin.add(key, m, new THREE.CylinderGeometry(w1 / 2, w1 / 2, 1.2, 4, 1, true), mat(x, y1, z, Math.PI / 4));
    if (l === 5 || l === 9) sc.bin.add('tvWhite', whiteW, new THREE.CylinderGeometry(w1 * 0.75, w1 * 0.7, 8, 8), mat(x, y1 + 4, z));
  }
  sc.bin.add('tvRed', redW, new THREE.CylinderGeometry(0.6, 1.4, H * 0.18, 6), mat(x, y + H * 0.85 + H * 0.09, z));
}
