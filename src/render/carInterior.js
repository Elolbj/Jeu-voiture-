// Intérieur visible des voitures : baquet(s), planche de bord avec combiné d'instruments, console,
// volant, garnitures, banquette arrière, arceau cage (course) ; pilote casqué simple pour les courses.
import * as THREE from 'three';
import { lerp } from '../core/utils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Buckets, prep } from './carParts.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Tube entre deux points (arceau, bras)
function tube(a, b, r, seg = 8) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, false);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

function rbox(w, h, d, r, x, y, z, rx = 0) {
  const g = new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  g.rotateX(rx);
  g.translate(x, y, z);
  return g;
}

// Repères communs (sièges, yeux du pilote, volant)
export function cockpitFrame(shape) {
  const st = shape.st, H = shape.H;
  const belt = shape.belt;
  // siège : yeux à ~0,55 m derrière le haut du pare-brise, sous le pavillon
  const zSeat = Math.min(shape.zOf(st.roofF) + 0.6, shape.zOf(st.roofB) + 0.05);
  const tSeat = shape.tOf(zSeat);
  const driverX = -shape.Wmax * st.cabW * 0.42;
  const roofY = st.roof * H;
  const eye = new THREE.Vector3(driverX, belt + (roofY - belt) * 0.55, zSeat - 0.05);
  const floor = shape.clear + (roofY < 1.2 ? 0.05 : 0.1);
  const wheel = new THREE.Vector3(driverX, belt + 0.02, zSeat - 0.42);
  return { belt, zSeat, driverX, roofY, eye, floor, wheel, tSeat };
}

// Baquet : assise, dossier incliné, flancs de maintien, appui-tête ; hauteur limitée sous le pavillon (maxTop)
function bucketSeat(B, x, floor, z, race, maxTop) {
  const hip = floor + 0.12;
  const k = Math.min(1, Math.max(0.55, (maxTop - hip) / (race ? 0.74 : 0.86)));
  const tilt = -0.26 - (1 - k) * 0.5;
  B.add('seat', rbox(0.46, 0.09, 0.48, 0.03, x, hip, z + 0.02));
  const bh = 0.66 * k;
  const backY = hip + bh * 0.55, backZ = z + 0.26 + (1 - k) * 0.1;
  B.add('seat', rbox(0.46, bh, 0.09, 0.03, x, backY, backZ, tilt));
  for (const s of [-1, 1]) {
    B.add('seat', rbox(0.08, bh * (race ? 0.94 : 0.76), 0.17, 0.03, x + s * 0.23, backY - 0.04 * k, backZ - 0.06, tilt));
    B.add('seat', rbox(0.08, 0.11, 0.44, 0.03, x + s * 0.22, hip + 0.045, z + 0.02));
  }
  if (!race) B.add('seat', rbox(0.25, 0.16 * k, 0.09, 0.03, x, backY + bh * 0.58, backZ + 0.11 + (1 - k) * 0.1, tilt));
}

// Construit l'intérieur : renvoie { buckets, wheelGeo, wheelPos } (le volant est animé à part)
export function buildInterior(shape, spec) {
  const st = shape.st;
  const f = cockpitFrame(shape);
  const B = new Buckets();
  const race = !!st.race;
  const sec = shape.cabSection(f.tSeat);
  let wc = sec.wc - 0.03;
  const zWS = shape.zOf(st.ws);
  const zBack = Math.min(shape.zOf(st.rearB) - 0.05, f.zSeat + (st.doors === 4 || st.rearB > 0.95 ? 1.15 : 0.62));
  // baignoire : plancher, contre-portes, tablier, cloison arrière (faces tournées vers l'intérieur)
  const yb = f.floor, yt = f.belt - 0.02;
  const quad = (a, b, c, d) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
    g.computeVertexNormals();
    return g;
  };
  // planche de bord : assez reculée pour rester sous le pare-brise
  let zDash = zWS + 0.03;
  while (zDash < f.wheel.z - 0.62 && shape.roof(shape.tOf(zDash + 0.36)) - f.belt < 0.09) zDash += 0.01;
  zDash = Math.min(zDash, f.wheel.z - 0.6);
  const z0 = zDash, z1 = zBack;
  // largeur intérieure : jamais au-delà de la caisse ni de l'habitacle (épaules arrondies, coupés étroits)
  let wIn = wc;
  for (let i = 0; i <= 6; i++) {
    const t = shape.tOf(lerp(z0, z1, i / 6));
    const xs = shape.xAt(t, f.belt - 0.02);
    if (xs > 0) wIn = Math.min(wIn, xs - 0.035);
    if (t > st.ws && t < st.rearB) wIn = Math.min(wIn, shape.cabSection(t).wc - 0.03);
  }
  wc = Math.max(0.3, wIn);
  B.add('interior', quad([-wc, yb, z0], [-wc, yb, z1], [wc, yb, z1], [wc, yb, z0]), [0.5, 0.5, 0.5]);
  B.add('interior', quad([wc, yb, z0], [wc, yb, z1], [wc, yt, z1], [wc, yt, z0]));
  B.add('interior', quad([-wc, yb, z1], [-wc, yb, z0], [-wc, yt, z0], [-wc, yt, z1]));
  B.add('interior', quad([-wc, yb, z1], [-wc, yt, z1], [wc, yt, z1], [wc, yb, z1]));
  B.add('interior', quad([wc, yb, z0], [wc, yt, z0], [-wc, yt, z0], [-wc, yb, z0]));
  // accoudoirs de portes
  for (const s of [-1, 1]) B.add('interior', rbox(0.06, 0.05, 0.6, 0.015, s * (wc - 0.03), f.belt - 0.16, f.zSeat - 0.1), [0.8, 0.8, 0.82]);
  // planche de bord : profil extrudé sur la largeur
  const prof = new THREE.Shape();
  const P = [[0, 0.01], [0.36, 0.03], [0.47, -0.01], [0.5, -0.12], [0.44, -0.24], [0.3, -0.3], [0.05, -0.22]];
  P.forEach(([z, y], i) => prof[i ? 'lineTo' : 'moveTo'](z, y));
  prof.closePath();
  const dash = new THREE.ExtrudeGeometry(prof, { depth: wc * 2, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 });
  dash.translate(0, 0, -wc);
  dash.rotateY(-Math.PI / 2);
  dash.translate(0, f.belt - 0.03, zDash);
  B.add('interior', dash);
  // casquette du combiné + console centrale + levier
  const hood = new THREE.CylinderGeometry(0.14, 0.14, 0.15, 14, 1, true, -Math.PI / 2, Math.PI);
  hood.rotateX(Math.PI / 2);
  hood.rotateZ(-Math.PI / 2 + Math.PI / 2);
  hood.translate(f.driverX, f.belt - 0.0, zDash + 0.46);
  B.add('interior', hood, [0.7, 0.7, 0.72]);
  B.add('interior', rbox(0.24, 0.3, 0.12, 0.02, 0, f.belt - 0.2, zDash + 0.46), [0.85, 0.85, 0.88]);
  B.add('interior', rbox(0.2, 0.14, 0.7, 0.02, 0, f.floor + 0.12, f.zSeat - 0.12));
  B.add('interior', tube(V(0, f.floor + 0.18, f.zSeat - 0.2), V(0, f.floor + 0.33, f.zSeat - 0.24), 0.008), [0.4, 0.4, 0.42]);
  B.add('interior', new THREE.SphereGeometry(0.025, 10, 8).translate(0, f.floor + 0.34, f.zSeat - 0.245), [0.25, 0.25, 0.27]);
  // combiné d'instruments
  const gauge = new THREE.PlaneGeometry(0.3, 0.15);
  gauge.rotateY(Math.PI);
  gauge.rotateX(0.35);
  gauge.translate(f.driverX, f.belt - 0.02, zDash + 0.49);
  B.add('gauge', gauge);
  // sièges
  const maxTop = Math.min(f.roofY, shape.roof(shape.tOf(f.zSeat + 0.3))) - 0.07;
  bucketSeat(B, f.driverX, f.floor, f.zSeat, race, maxTop);
  if (!race && st.doors !== 0) bucketSeat(B, -f.driverX, f.floor, f.zSeat, false, maxTop);
  // banquette arrière (berlines, breaks, compactes)
  if (!race && (st.doors === 4 || st.rearB > 0.95) && zBack - f.zSeat > 0.9) {
    const zr = f.zSeat + 0.78;
    B.add('seat', rbox(wc * 1.7, 0.1, 0.42, 0.03, 0, f.floor + 0.14, zr));
    B.add('seat', rbox(wc * 1.7, 0.5, 0.1, 0.03, 0, f.floor + 0.42, zr + 0.24, -0.3));
  }
  // arceau cage
  if (race) {
    const r = 0.021;
    const sR = shape.cabSection(Math.min(st.roofB, f.tSeat + 0.08));
    const zH = f.zSeat + 0.36;
    const yTop = f.roofY - 0.07;
    const xB = wc - 0.04, xT = sR.wr * 0.85;
    const hoop = [V(-xB, f.floor, zH), V(-xT, yTop, zH), V(xT, yTop, zH), V(xB, f.floor, zH)];
    for (let i = 0; i < 3; i++) B.add('cage', tube(hoop[i], hoop[i + 1], r));
    const zA = shape.zOf(st.roofF) + 0.08;
    const secA = shape.cabSection(st.roofF);
    for (const s of [-1, 1]) {
      const base = V(s * (wc - 0.06), f.floor, zWS + 0.25);
      const top = V(s * secA.wr * 0.82, yTop, zA);
      B.add('cage', tube(base, top, r));
      B.add('cage', tube(top, V(s * xT, yTop, zH), r));
      // barres de porte en X
      B.add('cage', tube(V(s * xB, f.floor + 0.08, zH), V(s * (wc - 0.06), f.belt - 0.08, zWS + 0.35), r));
      B.add('cage', tube(V(s * xB, f.belt - 0.08, zH), V(s * (wc - 0.06), f.floor + 0.1, zWS + 0.3), r));
      // jambes de force arrière
      B.add('cage', tube(V(s * xT, yTop, zH), V(s * xB * 0.8, f.floor + 0.05, Math.min(zBack - 0.05, zH + 0.6)), r));
    }
    B.add('cage', tube(V(-xB, f.floor + 0.04, zH), V(xT, yTop, zH), r));
  }
  // volant (géométrie locale : jante dans le plan XY, colonne vers +Z)
  const wl = [];
  wl.push(prep(new THREE.TorusGeometry(0.175, 0.021, 8, 28), [0.03, 0.03, 0.033]));
  const spoke = (a, len) => {
    const g = new THREE.BoxGeometry(0.03, len, 0.016);
    g.translate(0, len / 2, 0);
    g.rotateZ(a);
    return prep(g, [0.16, 0.16, 0.17]);
  };
  wl.push(spoke(Math.PI / 2, 0.17), spoke(-Math.PI / 2, 0.17), spoke(Math.PI, 0.17));
  const hubG = new THREE.CylinderGeometry(0.055, 0.06, 0.045, 16);
  hubG.rotateX(Math.PI / 2);
  wl.push(prep(hubG, [0.12, 0.12, 0.13]));
  const col = new THREE.CylinderGeometry(0.03, 0.035, 0.3, 8);
  col.rotateX(Math.PI / 2);
  col.translate(0, 0, -0.16); // la colonne plonge vers la planche de bord
  wl.push(prep(col, [0.08, 0.08, 0.085]));
  if (race) {
    const disp = new THREE.BoxGeometry(0.1, 0.05, 0.012);
    disp.translate(0, 0.03, -0.022);
    wl.push(prep(disp, [0.02, 0.06, 0.1]));
  }
  return { buckets: B, wheelParts: wl, frame: f };
}

// Gants (restent sur la jante du volant)
export function gloveParts() {
  const list = [];
  for (const s of [-1, 1]) {
    const g = new THREE.SphereGeometry(0.038, 10, 8);
    g.scale(1, 1.25, 0.9);
    g.translate(s * 0.172, 0.01, -0.012);
    list.push(prep(g, [0.05, 0.05, 0.055]));
  }
  return list;
}

// Pilote assis : combinaison + casque + visière. Renvoie { suit, helmet, visor } (géométries)
export function buildDriver(shape) {
  const f = cockpitFrame(shape);
  const x = f.driverX;
  const suit = new Buckets();
  const head = f.eye.clone().add(V(0, 0.03, 0.07));
  const shoulderY = f.eye.y - 0.24;
  const shZ = f.zSeat + 0.14;
  // buste incliné, cou
  const torso = new THREE.CapsuleGeometry(0.15, 0.3, 4, 10);
  torso.scale(1.15, 1, 0.8);
  torso.rotateX(-0.3);
  torso.translate(x, (f.floor + 0.2 + shoulderY) / 2 + 0.02, shZ + 0.05);
  suit.add('suit', torso);
  suit.add('suit', tube(V(x, shoulderY, shZ), V(x, head.y - 0.06, head.z), 0.05));
  // bras : épaule → coude → main sur la jante (9 h 15)
  for (const s of [-1, 1]) {
    const sh = V(x + s * 0.2, shoulderY, shZ);
    const hand = V(x + s * 0.17, f.wheel.y + 0.01, f.wheel.z + 0.02);
    const elbow = V(x + s * 0.27, (sh.y + hand.y) / 2 - 0.08, (sh.z + hand.z) / 2 + 0.03);
    suit.add('suit', tube(sh, elbow, 0.048));
    suit.add('suit', tube(elbow, hand, 0.042));
    suit.add('suit', new THREE.SphereGeometry(0.06, 10, 8).translate(sh.x, sh.y, sh.z));
  }
  // cuisses
  for (const s of [-1, 1]) suit.add('suit', tube(V(x + s * 0.1, f.floor + 0.2, f.zSeat + 0.05), V(x + s * 0.11, f.floor + 0.27, f.zSeat - 0.38), 0.07));
  const helmet = new THREE.SphereGeometry(0.135, 22, 16);
  helmet.scale(1, 1.06, 1.14);
  helmet.translate(head.x, head.y, head.z);
  // visière : calotte frontale légèrement plus grande
  const visor = new THREE.SphereGeometry(0.138, 18, 8, Math.PI * 1.12, Math.PI * 0.76, Math.PI * 0.36, Math.PI * 0.22);
  visor.scale(1, 1.06, 1.14);
  visor.translate(head.x, head.y, head.z);
  return { suit: suit.merge().suit, helmet: prep(helmet), visor: prep(visor) };
}
