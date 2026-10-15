// Moteur de rendu : WebGLRenderer + post-traitements (bloom, anti-crénelage), qualité.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { setMaxAnisotropy } from '../world/textures.js';

export const QUALITY = {
  basse: { pixelRatio: 0.75, shadows: false, shadowMap: 1024, bloom: false, fxaa: true, msaa: 0, trees: 0.4, terrainRes: 10, maxDpr: 1 },
  moyenne: { pixelRatio: 1, shadows: true, shadowMap: 1024, bloom: true, fxaa: true, msaa: 0, trees: 0.7, terrainRes: 7, maxDpr: 1.25 },
  haute: { pixelRatio: 1, shadows: true, shadowMap: 2048, bloom: true, fxaa: false, msaa: 4, trees: 1, terrainRes: 5.5, maxDpr: 1.5 },
  ultra: { pixelRatio: 1, shadows: true, shadowMap: 4096, bloom: true, fxaa: false, msaa: 4, trees: 1.3, terrainRes: 4, maxDpr: 2 },
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
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    setMaxAnisotropy(Math.min(8, r.capabilities.getMaxAnisotropy()));
    this.composer = null;
    this.scene = null;
    this.camera = null;
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
    if (q.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.55, 0.92);
      this.composer.addPass(this.bloom);
    } else this.bloom = null;
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
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
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.composer.render();
  }
}
