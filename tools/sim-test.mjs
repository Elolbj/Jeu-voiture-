// Test de simulation : tours chronométrés de l'IA sur chaque circuit + course à 8.
import { Track } from '../src/world/track.js';
import { TRACKS } from '../src/data/tracks.js';
import { buildSpec } from '../src/data/cars.js';
import { RaceSim } from '../src/game/raceSim.js';
import { formatTime } from '../src/core/utils.js';

const args = process.argv.slice(2);
const onlyTrack = args.find((a) => !a.startsWith('--') && !a.includes('_'));
const carId = args.find((a) => a.includes('_')) || 'kaze_86';
const full = args.includes('--race');

for (const def of TRACKS) {
  if (onlyTrack && def.id !== onlyTrack) continue;
  const track = new Track(def);
  // 1) Tour solo
  const spec = buildSpec(carId);
  const sim = new RaceSim(track, [{ name: 'IA', spec, ai: { skill: 1 } }], { laps: def.closed === false ? 1 : 2 });
  sim.start();
  let walls = 0, resets = 0, maxT = 400;
  while (sim.clock < maxT && !sim.allFinished()) {
    sim.update(1 / 60);
    for (const e of sim.events) { if (e.type === 'wall') walls++; if (e.type === 'reset') resets++; }
    sim.events.length = 0;
  }
  const c = sim.cars[0];
  console.log(`${def.id.padEnd(12)} ${carId}: tours ${c.lapTimes.map((l) => formatTime(l.time)).join(' / ')}  murs:${walls} resets:${resets}  vmoy ${(track.length / (c.lapTimes[c.lapTimes.length - 1]?.time || 1) * 3.6).toFixed(0)} km/h`);

  if (full) {
    const ids = ['kaze_86', 'miyabi_rs', 'hoshi_civica', 'valette_sprint', 'kaze_86', 'miyabi_rs', 'hoshi_civica', 'valette_sprint'];
    const entries = ids.map((id, i) => ({ name: 'IA' + i, spec: buildSpec(id), ai: { skill: 0.6 + i * 0.05, aggression: Math.random() } }));
    const race = new RaceSim(track, entries, { laps: def.closed === false ? 1 : 3 });
    race.start();
    let w = 0, cc = 0, rs = 0;
    while (race.clock < 900 && !race.allFinished()) {
      race.update(1 / 60);
      for (const e of race.events) { if (e.type === 'wall') w++; if (e.type === 'car') cc++; if (e.type === 'reset') rs++; }
      race.events.length = 0;
    }
    const st = race.standings();
    console.log('   course:', st.map((x) => `${x.name}(${x.spec.id.split('_')[0]})${x.finished ? formatTime(x.finishTime) : 'DNF'}`).join(' '), `murs:${w} contacts:${cc} resets:${rs}`);
  }
}
