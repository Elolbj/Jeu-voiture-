import { App } from './app.js';
import { buildSpec } from './data/cars.js';

const hash = new URLSearchParams(location.hash.slice(1));
const app = new App();
window.__app = app;

if (hash.has('race')) {
  // Accès direct à une course (développement / tests) : #race=collines&car=kaze_86&opp=5
  app.unlockAudio();
  const spec = buildSpec(hash.get('car') || 'kaze_86');
  const n = parseInt(hash.get('opp') || '5', 10);
  const pool = ['kaze_86', 'miyabi_rs', 'hoshi_civica', 'valette_sprint', 'kaze_r3'];
  const opponents = Array.from({ length: n }, (_, i) => {
    const s = buildSpec(pool[i % pool.length]);
    return { name: 'IA ' + (i + 1), short: 'IA' + (i + 1), spec: s, color: s.paints[i % s.paints.length], skill: 0.7 + i * 0.03 };
  });
  app.state = 'menu';
  requestAnimationFrame((t) => app.loop(t));
  app.startRace({
    trackId: hash.get('race') || 'collines',
    time: hash.get('time') || undefined,
    laps: parseInt(hash.get('laps') || '2', 10),
    mode: 'race',
    title: 'Test',
    player: { spec, color: spec.paints[0], name: 'Testeur' },
    opponents,
    playerGrid: parseInt(hash.get('grid') || String(n), 10),
    autopilot: hash.has('auto'),
  }, null);
  if (hash.has('cam')) app.settings.camera = hash.get('cam');
} else if (hash.has('showroom')) {
  // Vitrine de développement : #showroom=kaze_86&angle=0.7&h=1.9
  const id = hash.get('showroom');
  app.state = 'menu';
  app.displayCar(id, hash.get('color') || buildSpec(id).paints[0]);
  app.showroom.autoRotate = false;
  app.showroom.camAngle = parseFloat(hash.get('angle') || '0.7');
  app.showroom.camHeight = parseFloat(hash.get('h') || '1.9');
  if (hash.has('dist')) app.showroom.camDist = parseFloat(hash.get('dist'));
  requestAnimationFrame((t) => app.loop(t));
} else {
  app.start();
}
