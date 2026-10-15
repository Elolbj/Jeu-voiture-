// Effets : traces de pneus, fumée / poussière, étincelles.
import * as THREE from 'three';
import { smokeSprite, radialSprite } from '../world/textures.js';
import { clamp } from '../core/utils.js';

export class SkidMarks {
  constructor(scene, capacity = 4000) {
    this.cap = capacity;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(capacity * 4 * 3);
    this.col = new Float32Array(capacity * 4 * 4);
    const idx = new Uint32Array(capacity * 6);
    for (let i = 0; i < capacity; i++) {
      const a = i * 4;
      idx.set([a, a + 1, a + 2, a + 2, a + 1, a + 3], i * 6);
    }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
    this.next = 0;
    this.last = new Map();
    this.dirty = false;
  }

  // Ajoute un segment pour la roue `key` du point courant (contact) avec une intensité
  add(key, p, side, width, intensity, dark = [0.03, 0.03, 0.03]) {
    const prev = this.last.get(key);
    if (!prev || intensity <= 0) {
      this.last.set(key, intensity > 0 ? { x: p.x, y: p.y, z: p.z, sx: side.x, sz: side.z, a: intensity } : null);
      return;
    }
    const dx = p.x - prev.x, dz = p.z - prev.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 0.09) return; // segments d'au moins 30 cm
    if (d2 > 9) { this.last.set(key, { x: p.x, y: p.y, z: p.z, sx: side.x, sz: side.z, a: intensity }); return; }
    const i = this.next;
    this.next = (this.next + 1) % this.cap;
    const hw = width / 2;
    const P = this.pos, C = this.col;
    const o = i * 12;
    const y0 = prev.y + 0.015, y1 = p.y + 0.015;
    P[o] = prev.x - prev.sx * hw; P[o + 1] = y0; P[o + 2] = prev.z - prev.sz * hw;
    P[o + 3] = prev.x + prev.sx * hw; P[o + 4] = y0; P[o + 5] = prev.z + prev.sz * hw;
    P[o + 6] = p.x - side.x * hw; P[o + 7] = y1; P[o + 8] = p.z - side.z * hw;
    P[o + 9] = p.x + side.x * hw; P[o + 10] = y1; P[o + 11] = p.z + side.z * hw;
    const oc = i * 16;
    for (let k = 0; k < 4; k++) {
      const a = clamp((k < 2 ? prev.a : intensity) * 0.55, 0, 0.6);
      C[oc + k * 4] = dark[0]; C[oc + k * 4 + 1] = dark[1]; C[oc + k * 4 + 2] = dark[2]; C[oc + k * 4 + 3] = a;
    }
    this.last.set(key, { x: p.x, y: p.y, z: p.z, sx: side.x, sz: side.z, a: intensity });
    this.dirty = true;
  }

  update() {
    if (!this.dirty) return;
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
    this.dirty = false;
  }

  clear() {
    this.pos.fill(0);
    this.col.fill(0);
    this.last.clear();
    this.dirty = true;
  }
}

const PARTICLE_VS = `
attribute float size;
attribute float alpha;
attribute vec3 tint;
varying float vAlpha;
varying vec3 vTint;
uniform float scale;
#include <fog_pars_vertex>
void main() {
  vAlpha = alpha;
  vTint = tint;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const PARTICLE_FS = `
uniform sampler2D map;
varying float vAlpha;
varying vec3 vTint;
#include <fog_pars_fragment>
void main() {
  vec4 t = texture2D(map, gl_PointCoord);
  gl_FragColor = vec4(vTint * t.rgb, t.a * vAlpha);
  #include <fog_fragment>
}`;

export class Particles {
  constructor(scene, capacity, { additive = false, texture = smokeSprite() } = {}) {
    this.cap = capacity;
    this.p = new Float32Array(capacity * 3);
    this.v = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size0 = new Float32Array(capacity);
    this.grow = new Float32Array(capacity);
    this.a0 = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.tint = new Float32Array(capacity * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('tint', new THREE.BufferAttribute(this.tint, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: texture }, scale: { value: 600 } }]),
      vertexShader: PARTICLE_VS,
      fragmentShader: PARTICLE_FS,
      transparent: true,
      depthWrite: false,
      fog: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    scene.add(this.points);
    this.next = 0;
  }

  emit(x, y, z, vx, vy, vz, life, size, grow, alpha, r, g, b, gravity = 0) {
    const i = this.next;
    this.next = (this.next + 1) % this.cap;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size0[i] = size;
    this.grow[i] = grow;
    this.a0[i] = alpha;
    this.gravity[i] = gravity;
    this.tint[i * 3] = r; this.tint[i * 3 + 1] = g; this.tint[i * 3 + 2] = b;
  }

  // scale = hauteur du viewport / (2·tan(fov/2)) : taille en mètres -> pixels
  update(dt, viewportH = 720, fov = 60) {
    this.mat.uniforms.scale.value = viewportH / (2 * Math.tan(((fov * Math.PI) / 180) / 2));
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = i * 3;
      this.v[k + 1] -= this.gravity[i] * dt;
      const drag = Math.exp(-dt * 1.6);
      this.v[k] *= drag; this.v[k + 2] *= drag;
      if (this.gravity[i] === 0) this.v[k + 1] = this.v[k + 1] * drag + dt * 0.6;
      this.p[k] += this.v[k] * dt;
      this.p[k + 1] += this.v[k + 1] * dt;
      this.p[k + 2] += this.v[k + 2] * dt;
      const u = 1 - this.life[i] / this.maxLife[i];
      this.size[i] = this.size0[i] + this.grow[i] * u;
      this.alpha[i] = this.a0[i] * Math.sin(Math.min(1, u * 4) * Math.PI * 0.5) * (1 - u);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
    g.attributes.alpha.needsUpdate = true;
    g.attributes.tint.needsUpdate = true;
  }
}

const _side = new THREE.Vector3();
const _pt = new THREE.Vector3();

export class CarEffects {
  constructor(scene, quality) {
    this.skids = new SkidMarks(scene, quality.qualityName === 'basse' ? 1500 : 4000);
    this.smoke = new Particles(scene, quality.qualityName === 'basse' ? 250 : 700);
    this.sparks = new Particles(scene, 300, { additive: true, texture: radialSprite('spark', 'rgba(255,230,160,1)', 'rgba(255,120,20,0)', 32) });
    this.acc = new Map();
  }

  // Effets d'une voiture (pneus)
  updateCar(dt, v, id, near = true) {
    for (let i = 0; i < 4; i++) {
      const w = v.wheels[i];
      const key = id * 4 + i;
      if (!w.contact) { this.skids.add(key, w.contactPoint, _side, 0, 0); continue; }
      const surf = w.surface.name;
      const slip = w.slipVel;
      const lockOrSpin = Math.abs(w.slipRatio) > 0.25;
      const sliding = slip > 3.2 || (lockOrSpin && Math.abs(v.speed) > 3);
      _side.copy(v.right);
      _side.y = 0;
      _side.normalize();
      if (surf === 'asphalt' || surf === 'curb') {
        const inten = sliding ? clamp((slip - 2.5) / 9, 0.15, 1) : 0;
        this.skids.add(key, w.contactPoint, _side, w.width * 0.95, inten);
        if (near && sliding && slip > 5) {
          let a = (this.acc.get(key) || 0) + dt * clamp(slip * 3, 0, 40);
          while (a > 1) {
            a -= 1;
            const cp = w.contactPoint;
            this.smoke.emit(cp.x + (Math.random() - 0.5) * 0.3, cp.y + 0.15, cp.z + (Math.random() - 0.5) * 0.3,
              v.velocity.x * 0.15 + (Math.random() - 0.5), 0.5 + Math.random() * 0.6, v.velocity.z * 0.15 + (Math.random() - 0.5),
              1.6 + Math.random() * 1.2, 0.8, 4.2, 0.32 * clamp(slip / 14, 0.3, 1), 0.86, 0.86, 0.88);
          }
          this.acc.set(key, a);
        }
      } else {
        this.skids.add(key, w.contactPoint, _side, w.width, 0);
        // poussière / herbe projetée
        const sp = Math.abs(v.speed);
        if (near && sp > 4) {
          let a = (this.acc.get(key) || 0) + dt * clamp(sp * 0.8, 0, 30);
          while (a > 1) {
            a -= 1;
            const cp = w.contactPoint;
            const col = surf === 'gravel' || surf === 'sand' ? [0.62, 0.55, 0.42] : [0.42, 0.4, 0.28];
            this.smoke.emit(cp.x, cp.y + 0.2, cp.z, -v.velocity.x * 0.1 + (Math.random() - 0.5) * 2, 0.8 + Math.random(), -v.velocity.z * 0.1 + (Math.random() - 0.5) * 2,
              1.2 + Math.random(), 0.6, 3.2, surf === 'grass' ? 0.25 : 0.45, col[0], col[1], col[2]);
          }
          this.acc.set(key, a);
        }
      }
    }
  }

  impact(p, strength, vel) {
    const n = Math.round(clamp(strength / 300, 3, 40));
    for (let k = 0; k < n; k++) {
      this.sparks.emit(p.x, p.y + 0.3, p.z,
        vel.x * 0.4 + (Math.random() - 0.5) * 6, 1 + Math.random() * 4, vel.z * 0.4 + (Math.random() - 0.5) * 6,
        0.3 + Math.random() * 0.4, 0.12, -0.06, 1, 1, 0.8, 0.5, 9.81);
    }
  }

  update(dt, h, fov) {
    this.skids.update();
    this.smoke.update(dt, h, fov);
    this.sparks.update(dt, h, fov);
  }
}

export { _pt };
