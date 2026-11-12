// Décor « neige » (Circuit du Glacier, Alpes bernoises) : sapins chargés de neige, congères
// le long des glissières, jalons à neige, chalets aux toits enneigés, télésiège animé avec
// ses gares, rochers affleurants, petite zone des stands.
import * as THREE from 'three';
import { InstancedForest } from '../vegetation.js';
import { surfaceY } from '../trackMesh.js';
import * as TX from '../textures.js';
import { boxWorldUV, mat, frameAt, infieldSide, snowDetail } from './common.js';

export function buildSnow(sc) {
  const t = sc.track;
  const r = sc.r;
  const q = sc.quality.trees;
  const infield = infieldSide(t);
  const iStart = t.indexAt(t.startS);
  const L = t.length;
  const dS = (a, b) => { const d = Math.abs(a - b); return Math.min(d, L - d); };

  // ---------------------------------------------------------------- Forêt enneigée
  const f = sc.forest(InstancedForest, 29);
  const fr = {};
  for (let i = 0; i < t.count; i += 4) {
    if (dS(t.sArr[i], t.startS) < 220) continue;
    for (const side of [-1, 1]) {
      if (sc.r() < 0.35) continue;
      const wall = side > 0 ? t.wallR[i] : t.wallL[i];
      for (let row = 0; row < 2; row++) {
        frameAt(t, i, side * (wall + 8 + row * 9 + r() * 6), fr);
        const x = fr.x + (r() - 0.5) * 4, z = fr.z + (r() - 0.5) * 4;
        if (sc.clearance(x, z) < 7) continue;
        f.add('snowspruce', 3, x, sc.groundAt(x, z) - 0.4, z, 0.75 + r() * 0.5, r() * 6.28);
      }
    }
  }
  const treeline = sc.terrain.pa + 420;
  sc.scatter(f, Math.round(5200 * q), ['snowspruce'], { clump: 280, threshold: -0.12, minClear: 14, maxY: treeline, maxSlope: 0.85, nearTrack: 140 });
  sc.scatter(f, Math.round(700), ['snowrock'], { scale: 2.4, threshold: -0.5, maxSlope: 3, nearTrack: 60, minClear: 6 });
  f.build(450, true, 280);

  // ---------------------------------------------------------------- Congères et jalons
  snowbanks(sc);
  snowPoles(sc);

  // ---------------------------------------------------------------- Stands, tribune
  sc.grandstand(iStart, -infield, 70, 8);
  sc.pitBuilding(iStart, infield, 160);
  sc.buildBillboards();

  // ---------------------------------------------------------------- Chalets
  for (let k = 0; k < 16; k++) {
    const p = sc.findSpot(22, 200, 16);
    if (p) snowChalet(sc, p.x, p.z, r() * Math.PI * 2);
  }

  // ---------------------------------------------------------------- Télésiège
  chairlift(sc, iStart, -infield);
}

// Congères : bourrelets de neige déblayée juste derrière les glissières (deux maillages)
function snowbanks(sc) {
  const t = sc.track;
  const det = snowDetail();
  const m = sc.cachedMat('snowbank', () => new THREE.MeshStandardMaterial({ map: det.map, normalMap: det.normalMap, color: 0xf2f5fa, roughness: 0.78 }));
  const prof = [[0.35, -0.6], [0.6, 0.45], [1.2, 1.05], [2.2, 1.35], [3.4, 1.05], [4.6, 0.35], [5.6, -0.6]];
  const pos = [], uv = [], idx = [];
  let nv = 0;
  const f = {};
  for (const side of [-1, 1]) {
    let prev = -1;
    for (let i = 0; i <= t.count; i++) {
      const ii = t.idx(i);
      const wall = side > 0 ? t.wallR[ii] : t.wallL[ii];
      frameAt(t, ii, side * (wall + 5.6), f);
      // interrompu là où une autre portion du circuit est trop proche
      if (sc.clearance(f.x, f.z) < 4.5) { prev = -1; continue; }
      const y0 = surfaceY(t, ii, side * wall);
      const n = 0.25 * Math.sin(i * 0.37) + 0.2 * Math.sin(i * 0.11 + side);
      const base = nv;
      for (const [d, h] of prof) {
        frameAt(t, ii, side * (wall + d), f);
        pos.push(f.x, y0 + h * (1 + n), f.z);
        uv.push(d / 3, (i * t.spacing) / 3);
        nv++;
      }
      if (prev >= 0) {
        for (let k = 0; k < prof.length - 1; k++) {
          if (side > 0) idx.push(prev + k, prev + k + 1, base + k, prev + k + 1, base + k + 1, base + k);
          else idx.push(prev + k, base + k, prev + k + 1, prev + k + 1, base + k, base + k + 1);
        }
      }
      prev = base;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true;
  sc.group.add(mesh);
}

// Jalons à neige orange (tous les 25 m, en quinconce)
function snowPoles(sc) {
  const t = sc.track;
  const m = sc.cachedMat('camp', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
  const pole = new THREE.CylinderGeometry(0.035, 0.035, 2.2, 5);
  const tip = new THREE.CylinderGeometry(0.036, 0.036, 0.35, 5);
  const n = Math.round(25 / t.spacing);
  const f = {};
  for (let i = 0, k = 0; i < t.count; i += n, k++) {
    const side = k % 2 ? 1 : -1;
    const wall = side > 0 ? t.wallR[i] : t.wallL[i];
    frameAt(t, i, side * (wall + 0.9), f);
    if (sc.clearance(f.x, f.z) < 0.5) continue;
    const y = surfaceY(t, i, side * wall);
    sc.bin.add('camp', m, pole, mat(f.x, y + 1.1, f.z), [0.95, 0.38, 0.05]);
    sc.bin.add('camp', m, tip, mat(f.x, y + 2.3, f.z), [0.05, 0.05, 0.05]);
  }
  sc.bin.noShadow('camp');
}

// Chalet de montagne : soubassement en pierre, bois, toit couvert de neige
function snowChalet(sc, x, z, rot) {
  const y = sc.groundAt(x, z);
  const wood = sc.cachedMat('wood', () => new THREE.MeshStandardMaterial({ color: 0x6b4428, roughness: 0.85 }));
  const stone = sc.cachedMat('stone', () => new THREE.MeshStandardMaterial({ map: TX.concrete(150), color: 0xc8c2b8, roughness: 0.95 }));
  const roofM = sc.cachedMat('chaletRoof', () => new THREE.MeshStandardMaterial({ color: 0x3a3532, roughness: 0.8 }));
  const snowM = sc.cachedMat('roofSnow', () => new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.8 }));
  const w = 10 + sc.r() * 4, d = 8 + sc.r() * 3;
  const big = Math.max(w, d);
  sc.bin.add('stone', stone, boxWorldUV(w, 4, d, 4, 4), mat(x, y + 0.5, z, rot));
  sc.bin.add('wood', wood, boxWorldUV(w, 3, d, 4, 4), mat(x, y + 4, z, rot));
  const roof = (k) => {
    const g = new THREE.CylinderGeometry(0.01, big * 0.8 * k, 3.2 * k, 4, 1);
    g.rotateY(Math.PI / 4);
    g.scale((w / big) * 1.1, 1, (d / big) * 1.1);
    return g;
  };
  sc.bin.add('chaletRoof', roofM, roof(1), mat(x, y + 7.1, z, rot));
  // couche de neige légèrement en retrait des avant-toits
  sc.bin.add('roofSnow', snowM, roof(0.96), mat(x, y + 7.25, z, rot));
  // balcon
  sc.bin.add('wood', wood, new THREE.BoxGeometry(w * 0.8, 0.2, 1.4), mat(x + Math.sin(rot) * (d / 2 + 0.7), y + 3.6, z + Math.cos(rot) * (d / 2 + 0.7), rot));
}

// Télésiège : gare aval près des stands, pylônes, câble et sièges en mouvement
function chairlift(sc, i0, side) {
  const t = sc.track;
  const r = sc.r;
  // départ derrière la tribune, direction : vers le relief le plus haut
  const base = frameAt(t, i0, 0, {});
  const wall = side > 0 ? t.wallR[i0] : t.wallL[i0];
  let best = null;
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2;
    const dx = Math.sin(ang), dz = Math.cos(ang);
    const x0 = base.x + base.rx * side * (wall + 70), z0 = base.z + base.rz * side * (wall + 70);
    let ok = sc.clearance(x0, z0) > 30;
    for (let d = 0; d <= 900 && ok; d += 30) ok = sc.clearance(x0 + dx * d, z0 + dz * d) > 25;
    if (!ok) continue;
    const rise = sc.groundAt(x0 + dx * 900, z0 + dz * 900) - sc.groundAt(x0, z0);
    if (!best || rise > best.rise) best = { x0, z0, dx, dz, rise };
  }
  if (!best) return;
  const { x0, z0, dx, dz } = best;
  const LEN = 900;
  const steel = sc.cachedMat('liftSteel', () => new THREE.MeshStandardMaterial({ color: 0x6f757d, metalness: 0.6, roughness: 0.45 }));
  const station = sc.cachedMat('liftStation', () => new THREE.MeshStandardMaterial({ map: TX.concrete(200), color: 0xe8e2d8, roughness: 0.85 }));
  const roofM = sc.cachedMat('chaletRoof', () => new THREE.MeshStandardMaterial({ color: 0x3a3532, roughness: 0.8 }));
  const rot = Math.atan2(dx, dz);
  const H = 11;
  const tops = [];
  for (let d = 0; d <= LEN; d += 75) {
    const x = x0 + dx * d, z = z0 + dz * d;
    const y = sc.groundAt(x, z);
    tops.push(new THREE.Vector3(x, y + H, z));
    if (d === 0 || d + 75 > LEN) {
      // gares aval / amont
      sc.bin.add('liftStation', station, boxWorldUV(12, 6, 16, 4, 4), mat(x, y + 2.6, z, rot));
      sc.bin.add('chaletRoof', roofM, new THREE.BoxGeometry(14, 0.6, 18), mat(x, y + 5.9, z, rot));
      continue;
    }
    sc.bin.add('liftSteel', steel, new THREE.CylinderGeometry(0.35, 0.5, H, 8), mat(x, y + H / 2, z));
    sc.bin.add('liftSteel', steel, new THREE.BoxGeometry(5.5, 0.35, 0.35), mat(x, y + H, z, rot));
  }
  // câbles (aller et retour, écartés de ±2,5 m)
  const ox = dz * 2.5, oz = -dx * 2.5;
  const path = (s) => {
    const k = Math.min(tops.length - 2, Math.floor(s / 75));
    const u = Math.min(1, (s - k * 75) / 75);
    return [tops[k].x + (tops[k + 1].x - tops[k].x) * u, tops[k].y + (tops[k + 1].y - tops[k].y) * u - 0.2 - Math.sin(u * Math.PI) * 1.2, tops[k].z + (tops[k + 1].z - tops[k].z) * u];
  };
  for (const s of [-1, 1]) {
    for (let k = 0; k < tops.length - 1; k++) {
      const a = tops[k], b = tops[k + 1];
      const len = a.distanceTo(b);
      const o = new THREE.Object3D();
      o.position.set((a.x + b.x) / 2 + ox * s, (a.y + b.y) / 2 - 0.6, (a.z + b.z) / 2 + oz * s);
      o.lookAt(b.x + ox * s, b.y - 0.6, b.z + oz * s);
      o.updateMatrix();
      sc.bin.add('liftSteel', steel, new THREE.BoxGeometry(0.05, 0.05, len), o.matrix);
    }
  }
  sc.bin.noShadow('liftSteel');
  // sièges : montent sur un brin, redescendent sur l'autre
  const N = 26;
  const seatG = new THREE.BoxGeometry(1.6, 0.9, 0.7);
  seatG.translate(0, -1.6, 0);
  const seats = new THREE.InstancedMesh(seatG, new THREE.MeshStandardMaterial({ color: 0x2b5cb8, roughness: 0.6 }), N);
  seats.frustumCulled = false;
  sc.group.add(seats);
  const ph = Array.from({ length: N }, (_, k) => (k / N) * 2 * LEN + r() * 4);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const update = (dt) => {
    for (let k = 0; k < N; k++) {
      ph[k] = (ph[k] + dt * 2.4) % (2 * LEN);
      const up = ph[k] < LEN;
      const sAlong = up ? ph[k] : 2 * LEN - ph[k];
      const p = path(Math.min(LEN - 1, sAlong));
      const s = up ? 1 : -1;
      v.set(p[0] + ox * s, p[1], p[2] + oz * s);
      m4.compose(v, q, one);
      seats.setMatrixAt(k, m4);
    }
    seats.instanceMatrix.needsUpdate = true;
  };
  update(0);
  sc.animated.push(update);
}
