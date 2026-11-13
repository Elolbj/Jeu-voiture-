// Moteur de rendu : WebGLRenderer + post-traitements (bloom plafonné, exposition adaptative, tone mapping,
// vignettage, effet de vitesse, gouttes à l'écran, anti-crénelage), qualité, niveaux de détail des voitures.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { setMaxAnisotropy } from '../world/textures.js';
import { updateCarLods } from './carModel.js';
import { GradePass } from './postfx.js';

export const QUALITY = {
  basse: { pixelRatio: 0.75, shadows: false, shadowMap: 1024, bloom: false, fxaa: true, msaa: 0, trees: 0.4, terrainRes: 14, maxDpr: 1, speedFx: false, rain: 1500 },
  moyenne: { pixelRatio: 1, shadows: true, shadowMap: 1024, bloom: true, fxaa: true, msaa: 0, trees: 0.7, terrainRes: 10, maxDpr: 1.25, speedFx: true, rain: 3000 },
  haute: { pixelRatio: 1, shadows: true, shadowMap: 2048, bloom: true, fxaa: false, msaa: 4, trees: 1, terrainRes: 8, maxDpr: 1.5, speedFx: true, rain: 6000 },
  ultra: { pixelRatio: 1, shadows: true, shadowMap: 4096, bloom: true, fxaa: false, msaa: 4, trees: 1.3, terrainRes: 6, maxDpr: 2, speedFx: true, rain: 9000 },
};

export class Renderer {
  constructor(container, qualityName = 'haute') {
    this.container = container;
    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    container.appendChild(canvas);
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    const r = this.gl;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    setMaxAnisotropy(Math.min(8, r.capabilities.getMaxAnisotropy()));
    this.composer = null;
    this.scene = null;
    this.camera = null;
    this.lastTime = 0;
    this.lastScene = null;
    this.setQuality(qualityName);
    window.addEventListener('resize', () => this.resize());
  }

  setQuality(name) {
    this.qualityName = QUALITY[name] ? name : 'haute';
    this.quality = QUALITY[this.qualityName];
    this.gl.shadowMap.enabled = this.quality.shadows;
    this.buildComposer();
    this.resize();
  }

  buildComposer() {
    const q = this.quality;
    if (this.composer) {
      this.composer.renderTarget1.dispose();
      this.composer.renderTarget2.dispose();
    }
    const size = this.gl.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
      type: THREE.HalfFloatType,
      samples: q.msaa,
    });
    this.composer = new EffectComposer(this.gl, rt);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.composer.addPass(this.renderPass);
    this.grade?.dispose();
    this.grade = new GradePass();
    if (q.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.55, 0.92);
      this.grade.patchBloom(this.bloom);
      this.composer.addPass(this.bloom);
    } else this.bloom = null;
    this.composer.addPass(this.grade);
    if (q.fxaa) {
      this.fxaa = new FXAAPass();
      this.composer.addPass(this.fxaa);
    }
  }

  setBloom(strength, threshold = 0.92, radius = 0.55) {
    if (!this.bloom) return;
    this.bloom.strength = strength;
    this.bloom.threshold = threshold;
    this.bloom.radius = radius;
    // seuil doux et contribution plafonnée (un soleil bas ne doit pas blanchir toute l'image)
    this.bloom.highPassUniforms.smoothWidth.value = threshold * 0.6;
    this.bloom.highPassUniforms.uCap.value = Math.max(2, threshold * 0.6);
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality.maxDpr) * this.quality.pixelRatio;
    this.gl.setPixelRatio(dpr);
    this.gl.setSize(w, h, false);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    if (this.composer) {
      this.composer.setPixelRatio(dpr);
      this.composer.setSize(w, h);
      this.grade.setSize(w, h);
    }
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    this.width = w;
    this.height = h;
  }

  render(scene, camera) {
    if (this.camera !== camera) {
      this.camera = camera;
      camera.aspect = this.width / this.height;
      camera.updateProjectionMatrix();
    }
    updateCarLods(camera);
    // post-traitement : pas de temps réel, adaptation remise à zéro à chaque nouvelle scène,
    // effet de vitesse et gouttes fournis par la caméra (cameras.js) et la météo (scene.userData)
    const now = performance.now();
    const g = this.grade;
    g.dt = this.lastTime ? Math.min(0.1, (now - this.lastTime) / 1000) : 1 / 60;
    this.lastTime = now;
    if (scene !== this.lastScene) { g.reset = true; this.lastScene = scene; }
    g.adaptive = this.bloomOwner !== 'showroom';
    const ud = camera.userData;
    g.speed = this.quality.speedFx ? ud.speedFx || 0 : 0;
    g.drops = (scene.userData.rain || 0) * (ud.drops || 0);
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.composer.render();
  }
}
