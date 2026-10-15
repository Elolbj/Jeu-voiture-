import { Renderer } from './render/renderer.js';
import { Showroom } from './render/showroom.js';
import { buildSpec, CARS } from './data/cars.js';

const viewport = document.getElementById('viewport');
const hash0 = new URLSearchParams(location.hash.slice(1));
const renderer = new Renderer(viewport, hash0.get('q') || 'haute');
const hash = new URLSearchParams(location.hash.slice(1));

if (hash.has('showroom')) {
  const show = new Showroom(renderer);
  const id = hash.get('showroom') || 'kaze_86';
  const spec = buildSpec(id);
  show.setCar(spec, hash.get('color') || spec.paints[0]);
  show.autoRotate = false;
  show.camAngle = parseFloat(hash.get('angle') || '0.7');
  show.camHeight = parseFloat(hash.get('h') || '1.9');
  if (hash.has('ortho')) {
    const THREE = await import('three');
    const o = hash.get('ortho');
    const cam = new THREE.OrthographicCamera(-3, 3, 1.7, -1.7, 0.1, 100);
    if (o === 'side') cam.position.set(20, 0.8, 0);
    if (o === 'front') cam.position.set(0, 0.8, -20);
    if (o === 'rear') cam.position.set(0, 0.8, 20);
    if (o === 'top') cam.position.set(0, 20, 0.001);
    cam.lookAt(0, 0.8, 0);
    show.camera = cam;
    show.update = () => {};
    show.scene.fog = null;
    show.scene.background = new THREE.Color(0x8899aa);
  }
  let last = performance.now();
  const loop = (t) => {
    const dt = (t - last) / 1000;
    last = t;
    show.update(dt);
    show.render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.__ready = true;
}
if (hash.has('track')) {
  const THREE = await import('three');
  const { World } = await import('./world/world.js');
  const { TRACK_BY_ID } = await import('./data/tracks.js');
  const { CarModel } = await import('./render/carModel.js');
  const def = TRACK_BY_ID[hash.get('track')];
  const t0 = performance.now();
  const world = new World(renderer, def, { time: hash.get('time') || undefined });
  console.log('world built in', Math.round(performance.now() - t0), 'ms');
  const tr = world.track;
  const s = parseFloat(hash.get('s') || String(tr.startS - 30));
  const lat = parseFloat(hash.get('lat') || '0');
  const p = tr.pointAt(s, lat);
  const h = tr.headingAt(s);
  const dir = new THREE.Vector3(Math.sin(h), 0, -Math.cos(h));
  const cam = new THREE.PerspectiveCamera(parseFloat(hash.get('fov') || '60'), 16 / 9, 0.1, 30000);
  const back = parseFloat(hash.get('back') || '7');
  const up = parseFloat(hash.get('up') || '2.4');
  cam.position.copy(p).addScaledVector(dir, -back);
  cam.position.y += up;
  const look = p.clone().addScaledVector(dir, 12);
  look.y += 0.8;
  cam.lookAt(look);
  // quelques voitures
  const carIds = ['kaze_86', 'aurelia_tempesta', 'falco_gt3', 'hoshi_civica'];
  carIds.forEach((id, k) => {
    const spec = buildSpec(id);
    const m = new CarModel(spec, { color: spec.paints[k % spec.paints.length] });
    const cp = tr.pointAt(s + 6 + k * 9, (k % 2 ? 1 : -1) * 2.2);
    m.root.position.copy(cp);
    m.root.position.y += spec.cgHeight;
    m.root.rotation.y = -h;
    m.setStatic();
    if (world.env.night) m.setLights(true);
    world.scene.add(m.root);
  });
  world.update(0, p);
  let frames = 0;
  const loop = () => {
    world.update(0.016, p);
    renderer.render(world.scene, cam);
    if (++frames === 2) console.log('draw calls', renderer.gl.info.render.calls, 'tris', renderer.gl.info.render.triangles);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
window.__CARS = CARS;
