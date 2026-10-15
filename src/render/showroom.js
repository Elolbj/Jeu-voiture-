// Salle d'exposition 3D (menus, concession, garage) : sol brillant, éclairage studio,
// plateau tournant.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CarModel } from './carModel.js';
import { radialSprite } from '../world/textures.js';

export class Showroom {
  constructor(renderer) {
    this.renderer = renderer;
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.background = new THREE.Color(0x0b0d12);
    const pmrem = new THREE.PMREMGenerator(renderer.gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.7;
    scene.fog = new THREE.Fog(0x0b0d12, 14, 34);

    // Sol réfléchissant
    const floorMat = new THREE.MeshPhysicalMaterial({ color: 0x0d0f13, roughness: 0.35, metalness: 0.1, clearcoat: 0.5, clearcoatRoughness: 0.2 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    // Plateau tournant
    const tt = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.7, 0.08, 96), new THREE.MeshPhysicalMaterial({ color: 0x23262d, roughness: 0.35, metalness: 0.6, clearcoat: 0.8 }));
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
    scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x15161a, 0.5));
    const key = new THREE.SpotLight(0xffffff, 90, 30, 0.7, 0.7, 1.4);
    key.position.set(5, 9, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.02;
    scene.add(key);
    scene.add(key.target);
    const rim = new THREE.SpotLight(0x8fb8ff, 70, 30, 0.7, 0.8, 1.4);
    rim.position.set(-6, 6, -6);
    scene.add(rim);
    const fill = new THREE.PointLight(0xffe2c0, 30, 20, 1.8);
    fill.position.set(-5, 3, 6);
    scene.add(fill);
    // Rampe lumineuse au plafond (reflets sur la carrosserie)
    for (let i = -2; i <= 2; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      bar.position.set(i * 1.6, 7.5, 0);
      scene.add(bar);
    }

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
    this.renderer.render(this.scene, this.camera);
  }
}
