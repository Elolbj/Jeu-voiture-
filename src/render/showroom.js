// Salle d'exposition 3D (menus, concession, garage) : sol brillant, éclairage studio,
// plateau tournant.
import * as THREE from 'three';
import { CarModel } from './carModel.js';
import { radialSprite } from '../world/textures.js';

export class Showroom {
  constructor(renderer) {
    this.renderer = renderer;
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.background = new THREE.Color(0x0b0d12);
    // Environnement de studio : pièce sombre et grandes boîtes à lumière (reflets nets sur la carrosserie)
    const pmrem = new THREE.PMREMGenerator(renderer.gl);
    const studio = new THREE.Scene();
    studio.add(new THREE.Mesh(new THREE.BoxGeometry(60, 30, 60), new THREE.MeshBasicMaterial({ color: 0x0c0e12, side: THREE.BackSide })));
    const panel = (w, h, x, y, z, rx, ry, intensity, color = 0xffffff) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, 0);
      studio.add(m);
    };
    panel(14, 6, 0, 13, 0, Math.PI / 2, 0, 3.2);
    panel(2, 10, -16, 5, 0, 0, Math.PI / 2, 2.2);
    panel(2, 10, 16, 5, 0, 0, -Math.PI / 2, 1.6, 0xcfe0ff);
    panel(12, 3, 0, 4, -20, 0, 0, 1.4);
    panel(8, 2.4, 0, 3, 20, 0, Math.PI, 1.1, 0xffe6cc);
    const floorRefl = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: 0x15171c }));
    floorRefl.rotation.x = -Math.PI / 2;
    floorRefl.position.y = -0.5;
    studio.add(floorRefl);
    const env = pmrem.fromScene(studio, 0.02).texture;
    scene.environment = env;
    scene.environmentIntensity = 1.0;
    scene.fog = new THREE.Fog(0x0b0d12, 14, 34);

    // Sol réfléchissant
    const floorMat = new THREE.MeshPhysicalMaterial({ color: 0x0d0f13, roughness: 0.5, metalness: 0.0, clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 0.35 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    // Plateau tournant
    const tt = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.7, 0.08, 96), new THREE.MeshPhysicalMaterial({ color: 0x1a1c21, roughness: 0.4, metalness: 0.5, clearcoat: 0.7, envMapIntensity: 0.5 }));
    tt.position.y = 0.04;
    tt.receiveShadow = true;
    scene.add(tt);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.66, 0.02, 8, 128), new THREE.MeshBasicMaterial({ color: 0x5fa8ff }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.085;
    scene.add(ring);
    this.turntable = new THREE.Group();
    this.turntable.position.y = 0.08;
    scene.add(this.turntable);
    // Halo au sol
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ map: radialSprite('halo', 'rgba(90,140,255,0.22)', 'rgba(90,140,255,0)'), transparent: true, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.01;
    scene.add(halo);

    // Éclairage studio
    scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x15161a, 0.35));
    const key = new THREE.SpotLight(0xffffff, 42, 30, 0.75, 0.8, 1.4);
    key.position.set(5, 9, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.02;
    scene.add(key);
    scene.add(key.target);
    const rim = new THREE.SpotLight(0x8fb8ff, 45, 30, 0.7, 0.8, 1.4);
    rim.position.set(-6, 6, -6);
    scene.add(rim);
    const fill = new THREE.PointLight(0xffe2c0, 14, 20, 1.8);
    fill.position.set(-5, 3, 6);
    scene.add(fill);
    this.camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 200);
    this.camAngle = 0.7;
    this.camDist = 9;
    this.camHeight = 1.9;
    this.targetY = 0.6;
    this.autoRotate = true;
    this.car = null;
    this.offsetX = 0;
  }

  setCar(spec, color, opts = {}) {
    if (this.car) {
      this.turntable.remove(this.car.root);
      this.car.dispose();
    }
    this.car = new CarModel(spec, { color, ...opts });
    this.car.root.position.y = spec.cgHeight - (spec.lowered || 0);
    this.car.setStatic(0.25);
    this.turntable.add(this.car.root);
    this.camDist = 5.2 + spec.dims.length * 0.9;
    return this.car;
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
      this.renderer.setBloom(0.16, 3.2, 0.4);
      this.renderer.gl.toneMappingExposure = 0.9;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
