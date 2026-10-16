// Salle d'exposition 3D (menus, concession, garage, personnalisation) : studio à boîtes à lumière,
// éclairage trois points, sol brillant avec reflet de la voiture, ombre de contact douce, plateau tournant.
import * as THREE from 'three';
import { CarModel } from './carModel.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';

const BG = 0x0a0c10;

// Fond : dégradé vertical sombre
function backdrop() {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#07090d');
  gr.addColorStop(0.45, '#141922');
  gr.addColorStop(0.62, '#10141b');
  gr.addColorStop(1, '#050608');
  g.fillStyle = gr;
  g.fillRect(0, 0, 8, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Environnement de studio pour les reflets : coupole en dégradé + boîtes à lumière
function studioEnvironment(gl) {
  const studio = new THREE.Scene();
  const dome = new THREE.SphereGeometry(30, 32, 16);
  const col = [];
  const p = dome.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 30;
    // sol sombre, horizon gris, voûte un peu plus claire : la « ligne d'horizon » des studios auto
    const v = y < -0.02 ? 0.012 : y < 0.12 ? 0.05 + y * 0.6 : 0.12 + (y - 0.12) * 0.12;
    col.push(v, v * 1.02, v * 1.08);
  }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  studio.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (w, h, x, y, z, rx, ry, intensity, color = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    studio.add(m);
  };
  panel(16, 5, 0, 13, 0, Math.PI / 2, 0, 2.6); // plafonnier
  panel(1.6, 9, -15, 5, -3, 0, Math.PI / 2, 2.4); // bandeau gauche
  panel(1.6, 9, 15, 5, 3, 0, -Math.PI / 2, 1.8, 0xd8e6ff); // bandeau droit
  panel(14, 2.2, 0, 4.5, -19, 0, 0, 1.3); // fond
  panel(10, 2, 0, 3.2, 19, 0, Math.PI, 0.9, 0xffe9d2); // face
  const pmrem = new THREE.PMREMGenerator(gl);
  const env = pmrem.fromScene(studio, 0.035).texture;
  pmrem.dispose();
  return env;
}

export class Showroom {
  constructor(renderer) {
    this.renderer = renderer;
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.background = backdrop();
    scene.environment = studioEnvironment(renderer.gl);
    scene.environmentIntensity = 1.0;
    scene.fog = new THREE.Fog(BG, 13, 36);

    // Sol brillant (semi-transparent : laisse voir le reflet de la voiture placé dessous)
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 96), new THREE.MeshStandardMaterial({
      color: 0x0b0c0f, roughness: 0.58, metalness: 0.0, transparent: true, opacity: 0.88, envMapIntensity: 0.45, depthWrite: false,
    }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.renderOrder = -1;
    scene.add(floor);
    this.floor = floor;
    // Plateau tournant (liseré lumineux) et voiture
    this.turntable = new THREE.Group();
    scene.add(this.turntable);
    const disc = new THREE.Mesh(new THREE.RingGeometry(3.5, 3.56, 128), new THREE.MeshBasicMaterial({ color: 0x3f86e0, transparent: true, opacity: 0.85, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.003;
    this.turntable.add(disc);
    const plate = new THREE.Mesh(new THREE.CircleGeometry(3.5, 96), new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.45, metalness: 0.2, transparent: true, opacity: 0.35, depthWrite: false }));
    plate.rotation.x = -Math.PI / 2;
    plate.position.y = 0.002;
    plate.receiveShadow = true;
    this.turntable.add(plate);

    // Éclairage trois points : principale (ombres douces), contre-jour, débouchage + ciel
    scene.add(new THREE.HemisphereLight(0xe2ebff, 0x0c0d10, 0.45));
    const key = new THREE.DirectionalLight(0xfff8f0, 1.7);
    key.position.set(3.5, 8, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = key.shadow.camera.bottom = -4.5;
    key.shadow.camera.right = key.shadow.camera.top = 4.5;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 20;
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.02;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xc6dbff, 1.25);
    rim.position.set(-5, 3.5, -6.5);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffe6cf, 0.45);
    fill.position.set(-4.5, 2, 5);
    scene.add(fill);

    this.camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 200);
    this.camAngle = 0.7;
    this.camDist = 9;
    this.camHeight = 1.9;
    this.targetY = 0.6;
    this.autoRotate = true;
    this.car = null;
    this.refl = null;
    this.offsetX = 0;
    this.shadowPlane = null;
  }

  setCar(spec, color, opts = {}) {
    if (this.car) {
      this.turntable.remove(this.car.root);
      this.car.dispose();
    }
    this.car = new CarModel(spec, { color, liveryRes: 2048, ...opts });
    this.car.root.position.y = spec.cgHeight - (spec.lowered || 0);
    this.car.setStatic(0.25);
    this.turntable.add(this.car.root);
    this.bakeContactShadow(spec);
    this.updateReflection();
    this.camDist = 5.2 + spec.dims.length * 0.9;
    return this.car;
  }

  // Aperçu en direct d'une personnalisation (contrat C)
  applyCustom(custom) {
    if (!this.car) return;
    this.car.applyCustom(custom);
    this.updateReflection();
  }

  // Reflet : copie de la voiture retournée sous le sol (géométries et matériaux partagés)
  updateReflection() {
    if (this.refl) this.turntable.remove(this.refl);
    this.refl = null;
    if (!this.car) return;
    const r = this.car.root.clone();
    r.scale.y = -1;
    r.position.y = -this.car.root.position.y;
    r.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
    this.turntable.add(r);
    this.refl = r;
  }

  // Ombre de contact : hauteur des surfaces vues depuis le sol, floutée, posée sous la voiture
  bakeContactShadow(spec) {
    const gl = this.renderer.gl;
    const W = spec.dims.width + 0.9, L = spec.dims.length + 0.9;
    const rw = 256, rh = Math.round(256 * L / W);
    if (!this._cs) {
      const mk = () => new THREE.WebGLRenderTarget(rw, rh, { type: THREE.HalfFloatType });
      this._cs = {
        a: mk(), b: mk(),
        mat: new THREE.ShaderMaterial({
          uniforms: { uMax: { value: 0.55 } },
          vertexShader: 'varying float vH; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vH = wp.y; gl_Position = projectionMatrix * viewMatrix * wp; }',
          fragmentShader: 'uniform float uMax; varying float vH; void main(){ float k = 1.0 - clamp(vH / uMax, 0.0, 1.0); gl_FragColor = vec4(0.0, 0.0, 0.0, k * k * 0.92); }',
          side: THREE.DoubleSide,
        }),
        h: new FullScreenQuad(new THREE.ShaderMaterial(HorizontalBlurShader)),
        v: new FullScreenQuad(new THREE.ShaderMaterial(VerticalBlurShader)),
      };
    }
    const cs = this._cs;
    cs.a.setSize(rw, rh); cs.b.setSize(rw, rh);
    const cam = new THREE.OrthographicCamera(-W / 2, W / 2, L / 2, -L / 2, 0, 1.5);
    cam.up.set(0, 0, 1);
    cam.position.set(0, -0.01, 0);
    cam.lookAt(0, 1, 0);
    const tmp = new THREE.Scene();
    const car = this.car.root;
    const parent = car.parent;
    tmp.add(car);
    tmp.overrideMaterial = cs.mat;
    const prevRT = gl.getRenderTarget(), prevClear = gl.getClearColor(new THREE.Color()), prevAlpha = gl.getClearAlpha();
    const prevShadow = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    gl.setClearColor(0x000000, 0);
    gl.setRenderTarget(cs.a);
    gl.clear();
    gl.render(tmp, cam);
    // flou en deux passes aller-retour
    for (let k = 0; k < 3; k++) {
      cs.h.material.uniforms.tDiffuse.value = cs.a.texture;
      cs.h.material.uniforms.h.value = (1.6 + k) / rw;
      gl.setRenderTarget(cs.b); gl.clear(); cs.h.render(gl);
      cs.v.material.uniforms.tDiffuse.value = cs.b.texture;
      cs.v.material.uniforms.v.value = (1.6 + k) / rh;
      gl.setRenderTarget(cs.a); gl.clear(); cs.v.render(gl);
    }
    gl.setRenderTarget(prevRT);
    gl.setClearColor(prevClear, prevAlpha);
    gl.shadowMap.autoUpdate = prevShadow;
    tmp.overrideMaterial = null;
    parent.add(car);
    if (!this.shadowPlane) {
      this.shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false, map: cs.a.texture }));
      this.shadowPlane.rotation.x = -Math.PI / 2;
      this.shadowPlane.renderOrder = 1;
      this.turntable.add(this.shadowPlane);
    }
    this.shadowPlane.material.map = cs.a.texture;
    this.shadowPlane.scale.set(W, -L, 1);
    this.shadowPlane.position.y = 0.004;
  }

  update(dt) {
    if (this.autoRotate) this.turntable.rotation.y += dt * 0.22;
    const a = this.camAngle;
    this.camera.position.set(Math.cos(a) * this.camDist + this.offsetX, this.camHeight, Math.sin(a) * this.camDist);
    this.camera.lookAt(this.offsetX * 0.6, this.targetY, 0);
  }

  render() {
    if (this.renderer.bloomOwner !== 'showroom') {
      // réglages propres au studio (la course les redéfinit)
      this.renderer.bloomOwner = 'showroom';
      this.renderer.setBloom(0.14, 3.2, 0.4);
      this.renderer.gl.toneMappingExposure = 0.95;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
