// Caméras de course : poursuite (proche/lointaine), capot, cockpit, pare-chocs,
// rétro, caméras TV pour les ralentis, orbite.
import * as THREE from 'three';
import { clamp, damp, lerp } from '../core/utils.js';

export const CAM_MODES = ['chase', 'chaseFar', 'cockpit', 'hood', 'bumper'];
export const CAM_LABEL = { chase: 'Poursuite', chaseFar: 'Poursuite lointaine', cockpit: 'Cockpit', hood: 'Capot', bumper: 'Pare-chocs', tv: 'Caméra TV', orbit: 'Orbite' };

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _f = new THREE.Vector3();

export class CameraRig {
  constructor(track) {
    this.track = track;
    this.camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.08, 30000);
    this.mode = 'chase';
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.yaw = 0;
    this.initialized = false;
    this.shake = 0;
    this.t = 0;
    this.tvSpots = this.buildTvSpots();
    this.tvIndex = -1;
    this.orbitAngle = 0;
  }

  buildTvSpots() {
    const t = this.track;
    const spots = [];
    const step = Math.round(110 / t.spacing);
    for (let i = 0; i < t.count; i += step) {
      const side = (i / step) % 2 ? 1 : -1;
      const wall = side > 0 ? t.wallR[i] : t.wallL[i];
      const hl = Math.hypot(t.rx[i], t.rz[i]) || 1;
      const off = wall + 5;
      spots.push({
        s: t.sArr[i],
        pos: new THREE.Vector3(t.px[i] + (t.rx[i] / hl) * off * side, t.py[i] + 3.5 + (i % 3) * 1.5, t.pz[i] + (t.rz[i] / hl) * off * side),
      });
    }
    return spots;
  }

  cycle() {
    const i = CAM_MODES.indexOf(this.mode);
    this.mode = CAM_MODES[(i + 1) % CAM_MODES.length];
    this.initialized = false;
    return this.mode;
  }

  reset() {
    this.initialized = false;
  }

  // Met à jour la caméra pour suivre `car` (objet Vehicle ou état de replay) et son modèle
  update(dt, v, model, opts = {}) {
    this.t += dt;
    const cam = this.camera;
    const speed = Math.abs(v.speed ?? 0);
    const mode = opts.mode || this.mode;
    const fwd = _f.set(0, 0, -1).applyQuaternion(v.quaternion);
    const heading = Math.atan2(fwd.x, -fwd.z);
    if (!this.initialized) {
      this.yaw = heading;
      this.initialized = true;
      this.pos.set(0, 0, 0);
      this.snap = true;
    }
    const lookBack = !!opts.lookBack;
    if (mode === 'chase' || mode === 'chaseFar') {
      const far = mode === 'chaseFar';
      // Lacet de la caméra : suit le cap avec retard, et la direction de la vitesse en glissade
      let target = heading;
      const vel = v.velocity;
      if (vel && speed > 4) {
        const vh = Math.atan2(vel.x, -vel.z);
        let dv = vh - heading;
        while (dv > Math.PI) dv -= 2 * Math.PI;
        while (dv < -Math.PI) dv += 2 * Math.PI;
        if (v.speed > 0) target = heading + dv * 0.55;
      }
      let dy = target - this.yaw;
      while (dy > Math.PI) dy -= 2 * Math.PI;
      while (dy < -Math.PI) dy += 2 * Math.PI;
      this.yaw += dy * (1 - Math.exp(-dt * (far ? 4.5 : 6)));
      const dist = (far ? 8.8 : 6.0) + speed * 0.012;
      const h = far ? 2.9 : 1.85;
      const dir = _v.set(Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const desired = _w.copy(v.position).addScaledVector(dir, lookBack ? dist : -dist);
      desired.y = v.position.y + h;
      if (this.snap) { this.pos.copy(desired); this.snap = false; }
      // ressort critique (lissage) + plancher au-dessus du sol
      this.pos.x = damp(this.pos.x, desired.x, 14, dt);
      this.pos.z = damp(this.pos.z, desired.z, 14, dt);
      this.pos.y = damp(this.pos.y, desired.y, 8, dt);
      const ground = opts.groundY ?? -Infinity;
      if (this.pos.y < ground + 0.6) this.pos.y = ground + 0.6;
      cam.position.copy(this.pos);
      this.look.copy(v.position).addScaledVector(dir, lookBack ? -4 : 4);
      this.look.y = v.position.y + (far ? 0.9 : 0.75);
      cam.lookAt(this.look);
      const fov = clamp(58 + speed * 0.09, 58, 74);
      cam.fov = damp(cam.fov, fov, 3, dt);
    } else {
      // Caméras embarquées
      const local = _v;
      if (mode === 'cockpit' && model?.driverEye) {
        local.copy(model.driverEye).add(model.body.position);
      } else if (mode === 'hood') {
        local.set(0, (model?.shape?.top(model.style.ws * 0.6) ?? 1) + model.body.position.y + 0.32, (model?.shape ? model.shape.zFront + model.style.ws * 0.75 * model.shape.L : -1));
      } else {
        local.set(0, model ? model.body.position.y + 0.45 : -0.1, model?.shape ? model.shape.zFront + 0.15 : -2);
      }
      cam.position.copy(local).applyQuaternion(v.quaternion).add(v.position);
      // Orientation : celle de la voiture, avec léger amortissement du roulis
      _q.copy(v.quaternion);
      cam.quaternion.copy(_q);
      if (lookBack) cam.rotateY(Math.PI);
      if (mode === 'cockpit') cam.rotateX(-0.06);
      const fov = mode === 'cockpit' ? 64 : clamp(62 + speed * 0.08, 62, 78);
      cam.fov = damp(cam.fov, fov, 3, dt);
      // Vibrations
      const shake = (opts.bump ?? 0) * 0.012 + clamp(speed / 90, 0, 1) * 0.0012;
      cam.position.y += Math.sin(this.t * 63) * shake;
      cam.rotation.z += Math.sin(this.t * 37) * shake * 0.3;
    }
    cam.updateProjectionMatrix();
    return cam;
  }

  // Caméra TV pour les ralentis : choisit le poste le plus proche devant la voiture
  updateTV(dt, v, s) {
    const cam = this.camera;
    const spots = this.tvSpots;
    const L = this.track.length;
    let best = -1, bestD = Infinity;
    for (let k = 0; k < spots.length; k++) {
      let ds = spots[k].s - s;
      if (this.track.closed) { if (ds < -L / 2) ds += L; if (ds > L / 2) ds -= L; }
      // privilégie les caméras légèrement devant
      const score = Math.abs(ds - 25);
      if (ds > -55 && score < bestD) { bestD = score; best = k; }
    }
    if (best !== this.tvIndex) {
      // ne change que si la voiture s'éloigne trop de la caméra courante
      if (this.tvIndex < 0 || spots[this.tvIndex].pos.distanceTo(v.position) > 70) this.tvIndex = best;
    }
    const spot = spots[Math.max(0, this.tvIndex)];
    cam.position.copy(spot.pos);
    this.look.lerp(_w.copy(v.position).add(_v.set(0, 0.6, 0)), this.lookInit ? 1 - Math.exp(-dt * 8) : 1);
    this.lookInit = true;
    cam.lookAt(this.look);
    const d = spot.pos.distanceTo(v.position);
    const fov = clamp((2 * Math.atan(5.5 / Math.max(d, 1)) * 180) / Math.PI, 8, 55);
    cam.fov = lerp(cam.fov, fov, 1 - Math.exp(-dt * 6));
    cam.updateProjectionMatrix();
    return cam;
  }

  updateOrbit(dt, center, radius = 8, height = 2.2) {
    this.orbitAngle += dt * 0.25;
    const cam = this.camera;
    cam.position.set(center.x + Math.cos(this.orbitAngle) * radius, center.y + height, center.z + Math.sin(this.orbitAngle) * radius);
    cam.lookAt(center.x, center.y + 0.6, center.z);
    cam.fov = 45;
    cam.updateProjectionMatrix();
    return cam;
  }
}
