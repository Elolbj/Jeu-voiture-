// Ciel physique, soleil/lune, lumières, brouillard et carte d'environnement selon l'heure et la météo (pluie).
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { rng } from '../core/utils.js';
import { radialSprite } from './textures.js';

const _c = new THREE.Vector3();
const _d = new THREE.Vector3();

export const TIME_PRESETS = {
  day: {
    elev: 50, azim: 145, sun: 0xfff3e2, sunI: 3.1, sky: 0xbfd8ff, ground: 0x6b6450, hemiI: 0.9,
    turbidity: 2.6, rayleigh: 1.1, mie: 0.004, mieG: 0.8, exposure: 0.62, fog: 0.00026, clouds: 0.35, bloom: 0.1,
  },
  morning: {
    elev: 13, azim: 100, sun: 0xffd2a8, sunI: 2.7, sky: 0xb0c8f0, ground: 0x5d5546, hemiI: 0.75,
    turbidity: 4.5, rayleigh: 1.6, mie: 0.006, mieG: 0.82, exposure: 0.62, fog: 0.00035, clouds: 0.3, bloom: 0.14,
  },
  afternoon: {
    elev: 33, azim: 235, sun: 0xffe9cc, sunI: 3.0, sky: 0xb8d0f5, ground: 0x655d48, hemiI: 0.85,
    turbidity: 3.2, rayleigh: 1.25, mie: 0.005, mieG: 0.8, exposure: 0.6, fog: 0.0003, clouds: 0.4, bloom: 0.12,
  },
  sunset: {
    elev: 4.5, azim: 255, sun: 0xff9a50, sunI: 2.4, sky: 0x9ab0dd, ground: 0x4a3c34, hemiI: 0.6,
    turbidity: 7, rayleigh: 2.6, mie: 0.009, mieG: 0.88, exposure: 0.72, fog: 0.0004, clouds: 0.45, bloom: 0.2,
  },
  night: {
    elev: 38, azim: 200, sun: 0x9db4ff, sunI: 0.32, sky: 0x1a2440, ground: 0x0a0b10, hemiI: 0.22,
    turbidity: 1, rayleigh: 0.3, mie: 0.002, mieG: 0.8, exposure: 0.95, fog: 0.0007, clouds: 0.2, bloom: 0.55, night: true,
  },
};

// Ciel couvert : assombrit et désature la sortie du shader de ciel (pluie)
function overcast(sky, mul, sat) {
  sky.material.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('gl_FragColor = vec4( texColor, 1.0 );',
      `float skyL = dot(texColor, vec3(0.2126, 0.7152, 0.0722));
      gl_FragColor = vec4(mix(vec3(skyL), texColor, ${sat.toFixed(3)}) * ${mul.toFixed(3)}, 1.0);`);
  };
  sky.material.customProgramCacheKey = () => 'skyOvercast';
}

export class Environment {
  constructor(renderer, scene, timeName = 'day', opts = {}) {
    this.renderer = renderer;
    this.scene = scene;
    const base = TIME_PRESETS[timeName] || TIME_PRESETS.day;
    // Pluie : ciel couvert, soleil voilé, lumière diffuse, brume
    this.rain = opts.weather === 'pluie';
    const P = this.rain ? {
      ...base, sunI: base.sunI * 0.22, hemiI: base.hemiI * (base.night ? 1.2 : 1.5), sky: base.night ? 0x1c2230 : 0x9aa3ae, ground: base.night ? 0x0a0b0e : 0x4a4c4e,
      turbidity: 10, rayleigh: base.night ? 0.3 : 0.7, mie: 0.012, mieG: 0.7, clouds: 0.98, fog: base.fog * 4.5 + 0.0006,
      exposure: base.exposure * (base.night ? 1.0 : 1.12), bloom: base.bloom * 0.8,
    } : base;
    this.preset = P;
    this.night = !!P.night;
    const q = renderer.quality;

    // Direction du soleil (ou de la lune la nuit)
    const phi = THREE.MathUtils.degToRad(90 - P.elev);
    const theta = THREE.MathUtils.degToRad(P.azim);
    this.sunDir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);

    // Ciel
    const sky = new Sky();
    sky.scale.setScalar(20000);
    if (this.rain) overcast(sky, this.night ? 0.8 : 0.5, 0.3);
    const u = sky.material.uniforms;
    u.turbidity.value = P.turbidity;
    u.rayleigh.value = P.rayleigh;
    u.mieCoefficient.value = P.mie;
    u.mieDirectionalG.value = P.mieG;
    if (u.cloudCoverage) {
      u.cloudCoverage.value = P.clouds;
      u.cloudDensity.value = this.rain ? 0.95 : 0.5;
      u.cloudScale.value = this.rain ? 0.00011 : 0.00018;
    }
    if (this.rain && u.showSunDisc) u.showSunDisc.value = 0;
    const skySun = this.night ? new THREE.Vector3(0.2, -0.25, -1).normalize() : this.sunDir;
    u.sunPosition.value.copy(skySun).multiplyScalar(450000);
    this.sky = sky;
    scene.add(sky);

    // Étoiles + lune la nuit (cachées par les nuages sous la pluie)
    if (this.night && !this.rain) {
      const r = rng(42);
      const n = 2500;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const y = 0.05 + r() * 0.95;
        const a = r() * Math.PI * 2;
        const rr = Math.sqrt(1 - y * y);
        pos.set([Math.cos(a) * rr * 9000, y * 9000, Math.sin(a) * rr * 9000], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
      stars.renderOrder = -1;
      scene.add(stars);
      this.stars = stars;
      const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialSprite('moon', 'rgba(255,255,250,1)', 'rgba(200,215,255,0)', 128), fog: false, depthWrite: false }));
      moon.scale.setScalar(420);
      moon.position.copy(this.sunDir).multiplyScalar(8500);
      scene.add(moon);
      this.moon = moon;
    }

    // Lumières
    this.hemi = new THREE.HemisphereLight(P.sky, P.ground, P.hemiI);
    scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(P.sun, P.sunI);
    sun.castShadow = q.shadows;
    sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    const sc = sun.shadow.camera;
    const ext = 42;
    this.shadowExt = ext;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
    sc.near = 50; sc.far = 420;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 1.5;
    // repère de la caméra d'ombre (axes x/y de la projection orthographique)
    const lx = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), this.sunDir).normalize();
    this.lightBasis = { x: lx, y: new THREE.Vector3().crossVectors(this.sunDir, lx).normalize() };
    this.shadowFwd = new THREE.Vector3(0, 0, -1);
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;

    renderer.gl.toneMappingExposure = P.exposure;
    renderer.bloomOwner = 'race';
    // Le ciel est en HDR (≈ 2 à 4) : seuil élevé de jour pour ne faire briller que le soleil et les reflets
    renderer.setBloom(P.bloom, this.night ? 1.4 : 9.0, 0.45);

    // Carte d'environnement (réflexions) + couleur du brouillard prise à l'horizon
    this.groundColor = new THREE.Color(opts.groundColor ?? P.ground);
    this.buildEnvMap();
    scene.fog = new THREE.FogExp2(this.fogColor, P.fog * (opts.fogMul ?? 1));
    scene.background = null;
  }

  buildEnvMap() {
    const gl = this.renderer.gl;
    const envScene = new THREE.Scene();
    const sky2 = new Sky();
    sky2.scale.setScalar(1000);
    if (this.rain) overcast(sky2, this.night ? 0.8 : 0.5, 0.3);
    sky2.material.uniforms = THREE.UniformsUtils.clone(this.sky.material.uniforms);
    if (sky2.material.uniforms.showSunDisc) sky2.material.uniforms.showSunDisc.value = 0;
    envScene.add(sky2);
    // Sol (réflexions du bas de caisse)
    const gcol = this.groundColor.clone().multiplyScalar(this.night ? 0.15 : 0.55);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 32), new THREE.MeshBasicMaterial({ color: gcol }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -20;
    envScene.add(ground);
    if (this.night) {
      // Lueur urbaine / projecteurs à l'horizon
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(220, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.9, 0.6), side: THREE.DoubleSide }));
        glow.position.set(Math.cos(a) * 600, 20, Math.sin(a) * 600);
        glow.lookAt(0, 20, 0);
        envScene.add(glow);
      }
    }
    // Lecture de la couleur d'horizon
    const cubeRT = new THREE.WebGLCubeRenderTarget(32, { type: THREE.HalfFloatType });
    const cubeCam = new THREE.CubeCamera(1, 2000, cubeRT);
    const prevTM = gl.toneMapping;
    gl.toneMapping = THREE.NoToneMapping;
    cubeCam.update(gl, envScene);
    const buf = new Uint16Array(4);
    const acc = [0, 0, 0];
    let cnt = 0;
    for (const face of [0, 1, 4, 5]) {
      for (const x of [8, 16, 24]) {
        try {
          gl.readRenderTargetPixels(cubeRT, x, 15, 1, 1, buf, face);
          for (let k = 0; k < 3; k++) acc[k] += THREE.DataUtils.fromHalfFloat(buf[k]);
          cnt++;
        } catch (e) {
          void e;
        }
      }
    }
    gl.toneMapping = prevTM;
    if (cnt > 0 && acc.every((v) => isFinite(v))) {
      this.fogColor = new THREE.Color(acc[0] / cnt, acc[1] / cnt, acc[2] / cnt);
      // Le ciel est en HDR : on ramène dans une gamme raisonnable
      const m = Math.max(this.fogColor.r, this.fogColor.g, this.fogColor.b);
      if (m > 1.4) this.fogColor.multiplyScalar(1.4 / m);
    } else {
      this.fogColor = new THREE.Color(this.preset.sky);
    }
    if (this.night) this.fogColor.setRGB(0.035, 0.045, 0.075);
    if (this.rain) {
      // brume grise, désaturée
      const l = this.fogColor.r * 0.2126 + this.fogColor.g * 0.7152 + this.fogColor.b * 0.0722;
      this.fogColor.lerp(new THREE.Color(l, l * 1.02, l * 1.06), 0.8).multiplyScalar(this.night ? 1.4 : 1);
    }
    cubeRT.dispose();
    const pmrem = new THREE.PMREMGenerator(gl);
    this.envMap = pmrem.fromScene(envScene, 0, 0.1, 3000).texture;
    pmrem.dispose();
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = this.night ? 0.6 : 1.0;
  }

  // Fait suivre la zone d'ombre portée à la voiture suivie, décalée vers l'avant de la caméra,
  // et l'aligne sur la grille des texels dans le repère de la lumière (ombres stables, sans scintillement)
  update(focus, camPos) {
    const s = this.sun;
    const ext = this.shadowExt;
    if (camPos) {
      _d.set(focus.x - camPos.x, 0, focus.z - camPos.z);
      const l = _d.length();
      if (l > 0.5) this.shadowFwd.lerp(_d.multiplyScalar(1 / l), 0.2).normalize();
    }
    _c.copy(focus).addScaledVector(this.shadowFwd, ext * 0.45);
    const texel = (2 * ext) / s.shadow.mapSize.x;
    const L = this.lightBasis;
    const u = Math.round(_c.dot(L.x) / texel) * texel, v = Math.round(_c.dot(L.y) / texel) * texel, w = _c.dot(this.sunDir);
    _c.copy(L.x).multiplyScalar(u).addScaledVector(L.y, v).addScaledVector(this.sunDir, w);
    s.target.position.copy(_c);
    s.position.copy(_c).addScaledVector(this.sunDir, 250);
    s.target.updateMatrixWorld();
    this.sky.position.copy(focus);
    if (this.stars) this.stars.position.copy(focus);
    if (this.moon) this.moon.position.copy(focus).addScaledVector(this.sunDir, 8500);
  }

  dispose() {
    this.envMap?.dispose();
  }
}
