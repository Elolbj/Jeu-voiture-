import { App } from './app.js';
import { buildSpec } from './data/cars.js';

const hash = new URLSearchParams(location.hash.replace(/^#+/, ''));
const app = new App();
window.__app = app;

if (hash.has('race')) {
  // Accès direct à une course (développement / tests) : #race=collines&car=kaze_86&opp=5
  // (opp jusqu'à 15, weather=pluie, champ pour afficher une manche de championnat)
  app.unlockAudio();
  const spec = buildSpec(hash.get('car') || 'kaze_86');
  const n = Math.min(15, parseInt(hash.get('opp') || '5', 10));
  const pool = ['kaze_86', 'miyabi_rs', 'hoshi_civica', 'valette_sprint', 'kaze_r3'];
  const opponents = Array.from({ length: n }, (_, i) => {
    const s = buildSpec(pool[i % pool.length]);
    return { name: 'IA ' + (i + 1), short: 'IA' + (i + 1), spec: s, color: s.paints[i % s.paints.length], skill: 0.7 + (i / Math.max(1, n - 1)) * 0.25, aggression: 0.3 + (i % 5) * 0.1, seed: i + 1 };
  });
  app.state = 'menu';
  requestAnimationFrame((t) => app.loop(t));
  app.startRace({
    trackId: hash.get('race') || 'collines',
    time: hash.get('time') || undefined,
    weather: hash.get('weather') || undefined,
    championship: hash.has('champ') ? { id: 'test', name: 'Championnat test', round: 2, rounds: 4 } : undefined,
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
