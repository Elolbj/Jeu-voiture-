// Enregistrement et relecture des courses (ralentis TV).
import * as THREE from 'three';

const STRIDE = 22; // floats par voiture et par image
export const REPLAY_HZ = 30;

export class ReplayRecorder {
  constructor(nCars) {
    this.n = nCars;
    this.frames = [];
    this.times = [];
    this.acc = 0;
    this.maxFrames = REPLAY_HZ * 60 * 25; // 25 minutes
  }

  record(dt, time, cars) {
    this.acc += dt;
    if (this.acc < 1 / REPLAY_HZ) return;
    this.acc = 0;
    if (this.frames.length >= this.maxFrames) return;
    const f = new Float32Array(this.n * STRIDE);
    cars.forEach((c, k) => {
      const v = c.vehicle;
      const o = k * STRIDE;
      f[o] = v.position.x; f[o + 1] = v.position.y; f[o + 2] = v.position.z;
      f[o + 3] = v.quaternion.x; f[o + 4] = v.quaternion.y; f[o + 5] = v.quaternion.z; f[o + 6] = v.quaternion.w;
      for (let i = 0; i < 4; i++) {
        const w = v.wheels[i];
        f[o + 7 + i] = w.L;
        f[o + 11 + i] = w.spin;
      }
      f[o + 15] = v.wheels[0].steer;
      f[o + 16] = v.wheels[1].steer;
      f[o + 17] = v.rpm;
      f[o + 18] = v.controls.brake;
      f[o + 19] = v.speed;
      f[o + 20] = c.s;
      f[o + 21] = v.engineLoad;
    });
    this.frames.push(f);
    this.times.push(time);
  }

  get duration() {
    return this.frames.length / REPLAY_HZ;
  }
}

// Objet compatible avec CarModel.syncFromVehicle
export class GhostState {
  constructor(vehicle) {
    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.velocity = new THREE.Vector3();
    this.wheels = vehicle.wheels.map((w) => ({ radius: w.radius, Lstatic: w.Lstatic, L: w.L, steer: 0, spin: 0 }));
    this.steerAngle = 0;
    this.controls = { brake: 0, throttle: 0 };
    this.speed = 0;
    this.rpm = 0;
    this.s = 0;
    this.load = 0;
  }
}

const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();

export class ReplayPlayer {
  constructor(rec, cars) {
    this.rec = rec;
    this.ghosts = cars.map((c) => new GhostState(c.vehicle));
    this.t = 0;
    this.speed = 1;
    this.playing = true;
  }

  get duration() {
    return this.rec.duration;
  }

  update(dt) {
    if (this.playing) this.t += dt * this.speed;
    const max = this.rec.frames.length - 1;
    if (this.t >= max / REPLAY_HZ) this.t = 0; // boucle
    if (this.t < 0) this.t = 0;
    const f = this.t * REPLAY_HZ;
    const i = Math.min(Math.floor(f), max - 1);
    const u = f - i;
    const A = this.rec.frames[Math.max(0, i)], B = this.rec.frames[Math.min(max, i + 1)];
    if (!A || !B) return;
    this.ghosts.forEach((g, k) => {
      const o = k * STRIDE;
      const px = g.position.x, pz = g.position.z;
      g.position.set(A[o] + (B[o] - A[o]) * u, A[o + 1] + (B[o + 1] - A[o + 1]) * u, A[o + 2] + (B[o + 2] - A[o + 2]) * u);
      _qa.set(A[o + 3], A[o + 4], A[o + 5], A[o + 6]);
      _qb.set(B[o + 3], B[o + 4], B[o + 5], B[o + 6]);
      g.quaternion.copy(_qa).slerp(_qb, u);
      for (let w = 0; w < 4; w++) {
        g.wheels[w].L = A[o + 7 + w] + (B[o + 7 + w] - A[o + 7 + w]) * u;
        g.wheels[w].spin = A[o + 11 + w] + (B[o + 11 + w] - A[o + 11 + w]) * u;
      }
      g.wheels[0].steer = A[o + 15];
      g.wheels[1].steer = A[o + 16];
      g.steerAngle = (A[o + 15] + A[o + 16]) / 2;
      g.rpm = A[o + 17] + (B[o + 17] - A[o + 17]) * u;
      g.controls.brake = A[o + 18];
      g.speed = A[o + 19];
      g.s = A[o + 20];
      g.load = A[o + 21];
      if (dt > 0) g.velocity.set((g.position.x - px) / (dt * this.speed || 1), 0, (g.position.z - pz) / (dt * this.speed || 1));
    });
  }
}
