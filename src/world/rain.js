// Pluie : gouttes en traînées autour de la caméra, entièrement animées sur le GPU (un seul appel de dessin,
// aucune mise à jour de tampon par image). La traînée suit la vitesse relative goutte / caméra.
import * as THREE from 'three';

const VS = `
attribute vec4 aOff;
uniform vec3 uCam, uCamVel, uWind;
uniform float uTime, uBox, uHeight;
varying float vA;
varying float vT;
#include <fog_pars_vertex>
void main() {
  float speed = 8.5 + aOff.w * 2.5;
  vec3 size = vec3(uBox, uHeight, uBox);
  vec3 p = aOff.xyz * size;
  p.y -= uTime * speed;
  p.xz += uWind.xz * uTime;
  vec3 base = uCam - vec3(uBox * 0.5, uHeight * 0.35, uBox * 0.5);
  vec3 wp = base + mod(p - base, size);
  vec3 rel = vec3(uWind.x, -speed, uWind.z) - uCamVel;
  float rl = length(rel);
  vec3 dir = rel / max(rl, 1e-3);
  float len = clamp(rl * 0.03, 0.25, 1.6);
  vec3 toCam = normalize(cameraPosition - wp);
  vec3 side = normalize(cross(dir, toCam)) * 0.012;
  vec3 v = wp - dir * len * position.y + side * position.x;
  // estompe près de la caméra et au loin
  float d = length(wp - uCam);
  vA = smoothstep(0.6, 2.5, d) * (1.0 - smoothstep(uBox * 0.3, uBox * 0.5, d));
  vT = position.y;
  vec4 mvPosition = viewMatrix * vec4(v, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FS = `
uniform vec3 uColor;
uniform float uOpacity;
varying float vA;
varying float vT;
#include <fog_pars_fragment>
void main() {
  gl_FragColor = vec4(uColor, uOpacity * vA * (1.0 - vT) * vT * 4.0);
  #include <fog_fragment>
}`;

export class Rain {
  constructor(scene, count = 3000, { night = false } = {}) {
    const base = new THREE.InstancedBufferGeometry();
    base.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3));
    base.setIndex([0, 2, 1, 1, 2, 3]);
    const off = new Float32Array(count * 4);
    for (let i = 0; i < off.length; i++) off[i] = Math.random();
    base.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
    base.instanceCount = count;
    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uCam: { value: new THREE.Vector3() }, uCamVel: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector3(1.2, 0, 0.6) },
      uTime: { value: 0 }, uBox: { value: 36 }, uHeight: { value: 18 },
      uColor: { value: new THREE.Color(night ? 0x8090a8 : 0xc8d0da) }, uOpacity: { value: night ? 0.35 : 0.42 },
    }]);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VS, fragmentShader: FS,
      transparent: true, depthWrite: false, fog: true,
    });
    this.mesh = new THREE.Mesh(base, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    scene.add(this.mesh);
    this.prev = new THREE.Vector3();
    this.hasPrev = false;
    this._v = new THREE.Vector3();
  }

  update(dt, camPos) {
    const U = this.uniforms;
    U.uTime.value = (U.uTime.value + dt) % 1000;
    if (this.hasPrev && dt > 0) {
      // vitesse de la caméra lissée (pour l'inclinaison des traînées)
      this._v.subVectors(camPos, this.prev).divideScalar(dt);
      if (this._v.lengthSq() > 120 * 120) this._v.set(0, 0, 0);
      U.uCamVel.value.lerp(this._v, 1 - Math.exp(-dt * 8));
    }
    this.prev.copy(camPos);
    this.hasPrev = true;
    U.uCam.value.copy(camPos);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
