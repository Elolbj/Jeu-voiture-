// Collisions : voiture / murs du circuit et voiture / voiture.
import { Vector3 } from 'three';
import { clamp, lerp } from '../core/utils.js';

const _P = new Vector3();
const _n = new Vector3();
const _vp = new Vector3();
const _t = new Vector3();
const _J = new Vector3();
const _local = new Vector3();
const _proj = { i: 0, j: 0, t: 0, index: 0, s: 0, lateral: 0, cy: 0, slopeR: 0 };

const RESTITUTION = 0.25;
const FRICTION = 0.35;

function testPoints(v) {
  if (v._testPts) return v._testPts;
  const hw = v.halfWidth * 0.97, hl = v.halfLength * 0.97;
  const y = -v.cgHeight + 0.35;
  v._testPts = [
    new Vector3(-hw * 0.85, y, -hl), new Vector3(hw * 0.85, y, -hl),
    new Vector3(-hw * 0.85, y, hl), new Vector3(hw * 0.85, y, hl),
    new Vector3(-hw, y, -hl * 0.5), new Vector3(hw, y, -hl * 0.5),
    new Vector3(-hw, y, hl * 0.5), new Vector3(hw, y, hl * 0.5),
    new Vector3(-hw, y, 0), new Vector3(hw, y, 0),
    new Vector3(0, y, -hl), new Vector3(0, y, hl),
  ];
  return v._testPts;
}

// Résout le contact entre la voiture et les murs. Renvoie l'intensité de l'impact (N·s).
export function collideWalls(v, track) {
  const pts = testPoints(v);
  let best = 0, bestPen = 0;
  let bx = 0, by = 0, bz = 0, nx = 0, nz = 0;
  if (v.wallHint === undefined) v.wallHint = -1;
  for (let k = 0; k < pts.length; k++) {
    _P.copy(pts[k]).applyQuaternion(v.quaternion).add(v.position);
    const p = track.project(_P.x, _P.z, v.wallHint, _proj);
    v.wallHint = p.index;
    const a = p.i, b = p.j, t = p.t;
    const wr = lerp(track.wallR[a], track.wallR[b], t);
    const wl = lerp(track.wallL[a], track.wallL[b], t);
    const rx = lerp(track.rx[a], track.rx[b], t), rz = lerp(track.rz[a], track.rz[b], t);
    const hl = Math.hypot(rx, rz) || 1;
    let pen = 0, sx = 0, sz = 0;
    if (p.lateral > wr) { pen = p.lateral - wr; sx = -rx / hl; sz = -rz / hl; }
    else if (p.lateral < -wl) { pen = -wl - p.lateral; sx = rx / hl; sz = rz / hl; }
    // Extrémités d'un tracé ouvert
    if (!track.closed) {
      const dxs = track.dx[0], dzs = track.dz[0];
      const back = -((_P.x - track.px[0]) * dxs + (_P.z - track.pz[0]) * dzs);
      if (back > 4 && back - 4 > pen) { pen = back - 4; sx = dxs; sz = dzs; }
      const e = track.count - 1;
      const fwd = (_P.x - track.px[e]) * track.dx[e] + (_P.z - track.pz[e]) * track.dz[e];
      if (fwd > 60 && fwd - 60 > pen) { pen = fwd - 60; sx = -track.dx[e]; sz = -track.dz[e]; }
    }
    if (pen > bestPen) {
      bestPen = pen;
      bx = _P.x; by = _P.y; bz = _P.z;
      nx = sx; nz = sz;
    }
  }
  if (bestPen <= 0) return 0;
  // Correction de position
  v.position.x += nx * bestPen;
  v.position.z += nz * bestPen;
  _P.set(bx + nx * bestPen, by, bz + nz * bestPen);
  _n.set(nx, 0, nz);
  v.pointVelocity(_P, _vp);
  const vn = _vp.dot(_n);
  if (vn >= 0) return 0;
  const im = v.invMassAt(_P, _n);
  const j = (-(1 + RESTITUTION) * vn) / im;
  _J.copy(_n).multiplyScalar(j);
  // Frottement tangentiel
  _t.copy(_vp).addScaledVector(_n, -vn);
  _t.y = 0;
  const vt = _t.length();
  if (vt > 1e-3) {
    _t.multiplyScalar(1 / vt);
    const imt = v.invMassAt(_P, _t);
    const jt = Math.min(FRICTION * j, vt / imt);
    _J.addScaledVector(_t, -jt);
  }
  v.applyImpulse(_P, _J);
  // Empêche une rotation verticale excessive au contact
  v.angVel.x *= 0.85;
  v.angVel.z *= 0.85;
  return j;
}

// Collision entre deux voitures : approximation par 3 cercles alignés sur l'axe longitudinal.
const _ca = [new Vector3(), new Vector3(), new Vector3()];
const _cb = [new Vector3(), new Vector3(), new Vector3()];
function circles(v, out) {
  const r = v.halfWidth;
  const off = Math.max(0, v.halfLength - r);
  const fx = v.forward.x, fz = v.forward.z;
  const fl = Math.hypot(fx, fz) || 1;
  out[0].set(v.position.x + (fx / fl) * off, v.position.y, v.position.z + (fz / fl) * off);
  out[1].set(v.position.x, v.position.y, v.position.z);
  out[2].set(v.position.x - (fx / fl) * off, v.position.y, v.position.z - (fz / fl) * off);
  return r;
}

export function collideCars(a, b) {
  const dx0 = a.position.x - b.position.x, dz0 = a.position.z - b.position.z;
  const reach = a.halfLength + b.halfLength + 0.5;
  if (dx0 * dx0 + dz0 * dz0 > reach * reach) return 0;
  if (Math.abs(a.position.y - b.position.y) > 2.5) return 0;
  const ra = circles(a, _ca);
  const rb = circles(b, _cb);
  let bestPen = 0, bi = 0, bj = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const dx = _cb[j].x - _ca[i].x, dz = _cb[j].z - _ca[i].z;
      const d = Math.hypot(dx, dz);
      const pen = ra + rb - d;
      if (pen > bestPen) { bestPen = pen; bi = i; bj = j; }
    }
  }
  if (bestPen <= 0) return 0;
  const ca = _ca[bi], cb = _cb[bj];
  _n.set(cb.x - ca.x, 0, cb.z - ca.z);
  const d = _n.length();
  if (d < 1e-4) _n.set(1, 0, 0); else _n.multiplyScalar(1 / d);
  // Correction de position proportionnelle aux masses
  const wa = b.mass / (a.mass + b.mass), wb = 1 - wa;
  a.position.addScaledVector(_n, -bestPen * wa);
  b.position.addScaledVector(_n, bestPen * wb);
  _P.set((ca.x + cb.x) * 0.5, (a.position.y + b.position.y) * 0.5, (ca.z + cb.z) * 0.5);
  const va = a.pointVelocity(_P, new Vector3());
  const vb = b.pointVelocity(_P, _vp);
  const rel = va.sub(vb); // vitesse de A par rapport à B
  const vn = rel.dot(_n);
  if (vn <= 0) return 0; // déjà en séparation
  const im = a.invMassAt(_P, _n) + b.invMassAt(_P, _n);
  const j = ((1 + 0.2) * vn) / im;
  _J.copy(_n).multiplyScalar(-j);
  _t.copy(rel).addScaledVector(_n, -vn);
  _t.y = 0;
  const vt = _t.length();
  if (vt > 1e-3) {
    _t.multiplyScalar(1 / vt);
    const imt = a.invMassAt(_P, _t) + b.invMassAt(_P, _t);
    const jt = Math.min(0.25 * j, vt / imt);
    _J.addScaledVector(_t, -jt);
  }
  a.applyImpulse(_P, _J);
  _J.negate();
  b.applyImpulse(_P, _J);
  a.angVel.x *= 0.9; a.angVel.z *= 0.9;
  b.angVel.x *= 0.9; b.angVel.z *= 0.9;
  return j;
}

export { clamp };
