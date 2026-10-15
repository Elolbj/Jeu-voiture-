// Écrans principaux : titre, nouvelle partie, accueil, options, course rapide,
// chargement, pause, résultats, ralenti.
import { h, tile, btn, ICONS } from './ui.js';
import { CARS, CAR_BY_ID, CATEGORIES, DRIVE_LABEL, TIRES, buildSpec, carLabel } from '../data/cars.js';
import { TRACKS, TRACK_BY_ID, TIME_LABEL } from '../data/tracks.js';
import { DIFFICULTY, deleteProfile } from '../core/save.js';
import { formatCredits, formatTime, formatGap } from '../core/utils.js';
import { currentCar, specOf, chapterComplete, currentChapter, CHAPTERS, buildOpponents } from '../game/career.js';
import { QUALITY } from '../render/renderer.js';
import { music } from '../core/audio.js';
import { CAM_LABEL } from '../game/cameras.js';
import * as Story from './storyScreens.js';
import * as Shop from './shopScreens.js';

export const LOGO = `<div class="logo"><span class="logo-main">TRAJECTOIRE</span><span class="logo-sub">SIMULATION DE COURSE</span></div>`;

// ------------------------------------------------------------------ Titre
export function showTitle(app) {
  app.state = 'menu';
  app.displayCurrentCar();
  app.showroom.offsetX = 0;
  app.showroom.autoRotate = true;
  const start = () => {
    app.unlockAudio();
    if (!app.profile) showNewGame(app);
    else showHub(app);
  };
  const el = h('div', { class: 'title-screen', onclick: start },
    h('div', { class: 'title-center', html: LOGO }),
    h('div', { class: 'title-press blink' }, 'Appuyez sur Entrée ou cliquez pour commencer'),
    h('div', { class: 'title-foot' }, 'Clavier, souris ou manette · Casque recommandé'),
  );
  app.ui.show({ el, onConfirm: start });
}

// ------------------------------------------------------------------ Nouvelle partie
export function showNewGame(app) {
  let diff = 'normal';
  const nameInput = h('input', { class: 'text-input', maxlength: 18, placeholder: 'Votre nom de pilote', value: '' });
  const diffRow = h('div', { class: 'seg' });
  const renderDiff = () => {
    diffRow.innerHTML = '';
    for (const [k, d] of Object.entries(DIFFICULTY)) {
      diffRow.appendChild(h('button', { class: `seg-btn nav ${k === diff ? 'on' : ''}`, onclick: () => { diff = k; renderDiff(); } }, d.label));
    }
  };
  renderDiff();
  const go = () => {
    const name = nameInput.value.trim() || 'Pilote';
    nameInput.blur();
    app.newGame(name, diff);
    Story.showStory(app, 0);
  };
  const el = h('div', { class: 'panel-screen center' },
    h('div', { class: 'card wide' },
      h('div', { html: LOGO, class: 'logo-small' }),
      h('h2', {}, 'Nouvelle carrière'),
      h('p', { class: 'muted' }, "Vous arrivez à Beaune avec vos économies et un rêve : devenir pilote. Un vieil homme, Marc Delaunay, va peut-être vous donner votre chance."),
      h('label', { class: 'lbl' }, 'Nom du pilote'),
      nameInput,
      h('label', { class: 'lbl' }, 'Difficulté des adversaires'),
      diffRow,
      h('div', { class: 'row end' }, btn('Commencer l\'aventure', go, 'primary')),
    ),
  );
  app.ui.show({ el, captureKeys: false, back: () => showTitle(app), onShow: () => setTimeout(() => nameInput.focus(), 50) });
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); e.stopPropagation(); });
}

// ------------------------------------------------------------------ Barre supérieure
export function topBar(app, title) {
  const p = app.profile;
  return h('header', { class: 'topbar' },
    h('div', { class: 'tb-left' }, h('span', { class: 'tb-logo' }, 'TRAJECTOIRE'), title ? h('span', { class: 'tb-title' }, title) : null),
    p ? h('div', { class: 'tb-right' },
      h('span', { class: 'tb-name' }, p.name),
      h('span', { class: 'tb-credits' }, formatCredits(p.credits)),
    ) : null,
  );
}

function carInfoPanel(app) {
  const c = currentCar(app.profile);
  if (!c) return h('div');
  const s = specOf(c);
  return h('div', { class: 'car-info' },
    h('div', { class: 'ci-brand' }, s.brand),
    h('div', { class: 'ci-model' }, s.model),
    h('div', { class: 'ci-stats' },
      h('span', { class: 'pp' }, `PP ${s.pp}`),
      h('span', {}, `${s.engine.hp} ch`),
      h('span', {}, `${s.mass} kg`),
      h('span', {}, s.drive),
      h('span', {}, TIRES[s.tires].label),
    ),
  );
}

// ------------------------------------------------------------------ Accueil (hub)
export function showHub(app) {
  app.state = 'menu';
  app.displayCurrentCar();
  app.showroom.offsetX = -2.2;
  app.showroom.autoRotate = true;
  const p = app.profile;
  const ch = currentChapter(p);
  const storySub = p.story.finished ? 'Histoire terminée — rejouer' : `${ch.title} · ${ch.name}`;
  const el = h('div', { class: 'hub' },
    topBar(app),
    h('nav', { class: 'hub-menu' },
      tile('Mode Histoire', storySub, () => Story.showStory(app, ch.id), { icon: ICONS.story, cls: 'big', default: true }),
      tile('Courses à la carte', 'Séries libres, gains en crédits', () => Story.showFreeEvents(app), { icon: ICONS.race }),
      tile('Course rapide', 'Toutes les voitures, tous les circuits', () => showQuickRace(app), { icon: ICONS.quick }),
      tile('Permis', 'Épreuves de pilotage', () => Story.showLicences(app), { icon: ICONS.licence }),
      tile('Concession', 'Acheter une voiture', () => Shop.showDealer(app), { icon: ICONS.dealer }),
      tile('Garage', `${p.cars.length} voiture${p.cars.length > 1 ? 's' : ''}`, () => Shop.showGarage(app), { icon: ICONS.garage }),
      tile('Préparateur', 'Améliorations', () => Shop.showTuning(app), { icon: ICONS.tune }),
      tile('Options', 'Graphismes, aides, son', () => showOptions(app, () => showHub(app)), { icon: ICONS.options }),
    ),
    carInfoPanel(app),
    h('div', { class: 'hub-stats' },
      h('span', {}, `Courses ${p.stats.races}`),
      h('span', {}, `Victoires ${p.stats.wins}`),
      h('span', {}, `Podiums ${p.stats.podiums}`),
      h('span', {}, `${Math.round(p.stats.distance / 1000)} km parcourus`),
    ),
  );
  app.ui.show({ el, back: () => showTitle(app) });
}

// ------------------------------------------------------------------ Options
export function showOptions(app, onBack) {
  const s = app.settings;
  const build = () => {
    const row = (label, control) => h('div', { class: 'opt-row' }, h('span', { class: 'opt-label' }, label), control);
    const seg = (options, cur, set) => h('div', { class: 'seg' }, ...options.map(([k, l]) => h('button', { class: `seg-btn nav ${k === cur ? 'on' : ''}`, onclick: () => { set(k); app.save(); refresh(); } }, l)));
    const onoff = (val, set) => seg([[true, 'Activé'], [false, 'Désactivé']], val, set);
    const slider = (val, set) => {
      const inp = h('input', { type: 'range', min: 0, max: 100, value: Math.round(val * 100), class: 'slider nav' });
      inp.addEventListener('input', () => { set(inp.value / 100); app.applyVolumes(); app.save(); });
      return inp;
    };
    return h('div', { class: 'panel-screen' },
      topBar(app, 'Options'),
      h('div', { class: 'options' },
        h('h3', {}, 'Graphismes'),
        row('Qualité', seg(Object.keys(QUALITY).map((k) => [k, k[0].toUpperCase() + k.slice(1)]), s.quality, (k) => { s.quality = k; app.renderer.setQuality(k); app.ui.toast('Qualité appliquée (prise en compte complète à la prochaine course)'); })),
        h('h3', {}, 'Aides au pilotage'),
        row('ABS', onoff(s.assists.abs, (v) => (s.assists.abs = v))),
        row('Antipatinage (TCS)', onoff(s.assists.tcs, (v) => (s.assists.tcs = v))),
        row('Contrôle de stabilité (ESP)', onoff(s.assists.stability, (v) => (s.assists.stability = v))),
        row('Boîte automatique', onoff(s.assists.autoGear, (v) => (s.assists.autoGear = v))),
        row('Assistance de direction', onoff(s.steeringAssist, (v) => (s.steeringAssist = v))),
        row('Difficulté', seg(Object.entries(DIFFICULTY).map(([k, d]) => [k, d.label]), s.difficulty, (k) => (s.difficulty = k))),
        row('Caméra par défaut', seg(['chase', 'chaseFar', 'cockpit', 'hood', 'bumper'].map((k) => [k, CAM_LABEL[k]]), s.camera, (k) => (s.camera = k))),
        h('h3', {}, 'Son'),
        row('Volume général', slider(s.volumes.master, (v) => (s.volumes.master = v))),
        row('Effets', slider(s.volumes.sfx, (v) => (s.volumes.sfx = v))),
        row('Musique', slider(s.volumes.music, (v) => (s.volumes.music = v))),
        row('Musique des menus', onoff(s.music, (v) => { s.music = v; app.applyVolumes(); if (v) music.start(); else music.stop(); })),
        h('h3', {}, 'Commandes'),
        h('div', { class: 'controls-help', html: CONTROLS_HTML }),
        app.profile ? h('div', { class: 'row' }, btn('Effacer la sauvegarde', () => app.ui.confirm('Effacer la sauvegarde ?', 'Toute votre progression sera perdue définitivement.', () => { deleteProfile(); app.profile = null; showTitle(app); }, 'Effacer'), 'danger')) : null,
        h('div', { class: 'row end' }, btn('Retour', onBack, 'primary')),
      ),
    );
  };
  let scr;
  const refresh = () => {
    const focusedText = app.ui.focused?.textContent;
    scr = { el: build(), back: onBack };
    app.ui.show(scr);
    if (focusedText) {
      const again = [...scr.el.querySelectorAll('.nav')].find((n) => n.textContent === focusedText && n.classList.contains('on'));
      if (again) app.ui.focus(again, false);
    }
  };
  refresh();
}

export const CONTROLS_HTML = `
<div class="keys">
<div><b>Accélérer</b><span>↑ / Z (W)</span><span class="pad">RT</span></div>
<div><b>Freiner / Marche AR</b><span>↓ / S</span><span class="pad">LT</span></div>
<div><b>Diriger</b><span>← → / Q D (A D)</span><span class="pad">Stick gauche</span></div>
<div><b>Frein à main</b><span>Espace</span><span class="pad">A</span></div>
<div><b>Rapport + / −</b><span>Maj / Ctrl (ou E / A)</span><span class="pad">RB / LB</span></div>
<div><b>Caméra</b><span>C</span><span class="pad">Y</span></div>
<div><b>Regarder derrière</b><span>X</span><span class="pad">B</span></div>
<div><b>Replacer la voiture</b><span>R</span><span class="pad">Select</span></div>
<div><b>Pause</b><span>Échap / P</span><span class="pad">Start</span></div>
<div><b>Masquer l'interface</b><span>H</span><span class="pad">—</span></div>
</div>`;

// ------------------------------------------------------------------ Course rapide
export function showQuickRace(app) {
  const p = app.profile;
  const cur = currentCar(p);
  const st = app._quick || (app._quick = { carId: cur?.id || 'kaze_86', useOwned: true, track: 'collines', time: null, laps: 3, opp: 7 });
  const allCars = CARS.filter((c) => !c.storyOnly || p.cars.some((o) => o.id === c.id));
  const refresh = () => {
    const spec = buildSpec(st.carId, st.useOwned && cur?.id === st.carId ? cur.upgrades : []);
    app.displayCar(st.carId, st.useOwned && cur?.id === st.carId ? cur.color : CAR_BY_ID[st.carId].paints[0], spec.upgrades);
    const def = TRACK_BY_ID[st.track];
    const times = ['day', 'morning', 'afternoon', 'sunset', 'night'];
    const el = h('div', { class: 'panel-screen side' },
      topBar(app, 'Course rapide'),
      h('div', { class: 'sidebar' },
        h('h3', {}, 'Circuit'),
        h('div', { class: 'list' }, ...TRACKS.map((t) => h('button', { class: `item nav ${t.id === st.track ? 'on' : ''}`, onclick: () => { st.track = t.id; st.time = null; refresh(); } }, h('b', {}, t.name), h('small', {}, `${t.location} · ${TIME_LABEL[t.time]}`)))),
        h('h3', {}, 'Heure'),
        h('div', { class: 'seg wrap' }, ...[null, ...times].map((k) => h('button', { class: `seg-btn nav ${k === st.time ? 'on' : ''}`, onclick: () => { st.time = k; refresh(); } }, k ? TIME_LABEL[k] : 'Par défaut'))),
        h('h3', {}, def.closed === false ? 'Course de côte' : 'Tours'),
        def.closed === false ? h('p', { class: 'muted' }, 'Montée unique de 3,2 km') : h('div', { class: 'seg' }, ...[1, 2, 3, 5, 8].map((n) => h('button', { class: `seg-btn nav ${n === st.laps ? 'on' : ''}`, onclick: () => { st.laps = n; refresh(); } }, String(n)))),
        h('h3', {}, 'Adversaires'),
        h('div', { class: 'seg' }, ...[0, 3, 5, 7, 9].map((n) => h('button', { class: `seg-btn nav ${n === st.opp ? 'on' : ''}`, onclick: () => { st.opp = n; refresh(); } }, n === 0 ? 'Seul' : String(n)))),
      ),
      h('div', { class: 'sidebar right' },
        h('h3', {}, 'Voiture'),
        h('div', { class: 'list tall' }, ...allCars.map((c) => {
          const owned = p.cars.find((o) => o.id === c.id);
          return h('button', { class: `item nav ${c.id === st.carId ? 'on' : ''}`, onclick: () => { st.carId = c.id; st.useOwned = !!owned; refresh(); } },
            h('b', {}, carLabel(c)), h('small', {}, `PP ${buildSpec(c.id).pp} · ${CATEGORIES[c.category]}${owned ? ' · Garage' : ' · Essai'}`));
        })),
        h('div', { class: 'spec-mini' }, `${spec.engine.hp} ch · ${spec.mass} kg · ${DRIVE_LABEL[spec.drive]} · PP ${spec.pp}`),
        btn('Lancer la course', () => launch(spec), 'primary big'),
      ),
    );
    app.ui.show({ el, back: () => showHub(app) });
  };
  const launch = (spec) => {
    const owned = st.useOwned ? p.cars.find((o) => o.id === st.carId) : null;
    // Plateau : voitures de PP proches
    const near = CARS.filter((c) => !c.storyOnly).map((c) => buildSpec(c.id)).filter((s) => Math.abs(s.pp - spec.pp) < 90);
    const pool = (near.length ? near : [spec]).map((s) => s.id);
    const ev = { id: 'quick_' + st.track + st.carId, opponents: { count: st.opp, pool, skill: [0.62, 0.86] } };
    const opponents = buildOpponents(ev, Math.floor(Math.random() * 1000));
    app.startRace({
      trackId: st.track,
      time: st.time || undefined,
      laps: TRACK_BY_ID[st.track].closed === false ? 1 : st.laps,
      mode: 'race',
      title: 'Course rapide',
      player: { spec, color: owned?.color || CAR_BY_ID[st.carId].paints[0], name: p.name },
      opponents,
      playerGrid: Math.floor(opponents.length / 2),
    }, null);
  };
  refresh();
}

// ------------------------------------------------------------------ Chargement
const TIPS = [
  'Freinez en ligne droite, relâchez progressivement en entrant dans le virage.',
  'Une sortie de virage propre vaut mieux qu\'une entrée héroïque.',
  'Les vibreurs extérieurs déstabilisent la voiture : utilisez-les avec parcimonie.',
  'Désactivez l\'antipatinage pour gagner quelques dixièmes… si vous avez le pied léger.',
  'Les pneus semi-slicks transforment le comportement d\'une voiture : essayez-les !',
  'Au clavier, de petites impulsions sur la direction suffisent souvent.',
  'Appuyez sur C pour changer de caméra, X pour regarder derrière vous.',
  'Une propulsion se pilote à l\'accélérateur : dosez en sortie de virage.',
  'Les prototypes génèrent un appui énorme : plus vous allez vite, plus ils collent.',
];

export function loadingScreen(app, cfg) {
  const def = TRACK_BY_ID[cfg.trackId];
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  const el = h('div', { class: 'loading-screen' },
    h('div', { class: 'ld-track' }, def.name),
    h('div', { class: 'ld-loc' }, `${def.location} · ${TIME_LABEL[cfg.time || def.time]}`),
    h('div', { class: 'ld-title' }, cfg.title || ''),
    h('div', { class: 'spinner' }),
    h('div', { class: 'ld-tip' }, h('b', {}, 'Conseil : '), tip),
  );
  return { el };
}

// ------------------------------------------------------------------ Pause
export function pauseScreen(app, race) {
  const s = app.settings;
  const v = race.player.vehicle;
  const toggles = h('div', { class: 'pause-assists' });
  const renderToggles = () => {
    toggles.innerHTML = '';
    for (const [k, label] of [['abs', 'ABS'], ['tcs', 'TCS'], ['stability', 'ESP'], ['autoGear', 'Boîte auto']]) {
      toggles.appendChild(h('button', { class: `seg-btn nav ${v.assists[k] ? 'on' : ''}`, onclick: () => { v.assists[k] = !v.assists[k]; s.assists[k] = v.assists[k]; app.save(); renderToggles(); } }, label));
    }
  };
  renderToggles();
  const el = h('div', { class: 'pause' },
    h('div', { class: 'pause-box' },
      h('h2', {}, 'Pause'),
      h('div', { class: 'pause-sub' }, `${race.def.name} · ${race.cfg.title || ''}`),
      btn('Reprendre', () => race.togglePause(), 'primary default'),
      btn('Recommencer', () => app.restartRace()),
      btn(`Caméra : ${CAM_LABEL[race.rig.mode]}`, (e) => { const m = race.rig.cycle(); s.camera = m; e.target.textContent = `Caméra : ${CAM_LABEL[m]}`; }),
      h('div', { class: 'lbl' }, 'Aides au pilotage'),
      toggles,
      btn('Abandonner', () => app.ui.confirm('Abandonner la course ?', 'La course ne sera pas comptabilisée.', () => app.exitRace(app.raceCfg.onQuit)), 'danger'),
      h('div', { class: 'controls-help small', html: CONTROLS_HTML }),
    ),
  );
  return { el, back: () => race.togglePause() };
}

// ------------------------------------------------------------------ Résultats
export function resultsScreen(app, result, race, summary) {
  const L = result.licence;
  const isTT = race.cfg.mode === 'timetrial';
  let headline, sub = '';
  if (L) {
    headline = L.ok ? `Médaille ${L.medal}` : 'Épreuve échouée';
    sub = L.ok ? formatTime(L.time) : L.reason || '';
  } else if (isTT) {
    headline = summary?.medal ? `Médaille ${summary.medal}` : 'Contre-la-montre';
    sub = `Meilleur tour : ${formatTime(result.bestLap ?? result.time)}`;
  } else if (result.total > 1) {
    headline = result.position === 1 ? 'Victoire !' : `${result.position}e place`;
    sub = `sur ${result.total} pilotes`;
  } else {
    headline = 'Arrivée';
    sub = formatTime(result.time);
  }
  const table = result.total > 1 && !L ? h('table', { class: 'results' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Pos'), h('th', {}, 'Pilote'), h('th', {}, 'Voiture'), h('th', {}, 'Temps'), h('th', {}, 'Écart'), h('th', {}, 'Meilleur tour'))),
    h('tbody', {}, ...result.standings.map((s) => h('tr', { class: s.isPlayer ? 'me' : '' },
      h('td', {}, String(s.position)),
      h('td', {}, h('span', { class: 'sw', style: { background: s.color } }), s.name),
      h('td', {}, s.car),
      h('td', {}, s.estimated ? '—' : formatTime(s.time)),
      h('td', {}, s.position === 1 ? '' : s.estimated ? 'Non classé' : '+' + s.gap.toFixed(3)),
      h('td', {}, formatTime(s.best)),
    ))),
  ) : null;
  const laps = (result.lapTimes || []).length > 0 && !L ? h('div', { class: 'laps' }, ...result.lapTimes.map((l, i) => h('span', { class: `lapchip ${l.valid ? '' : 'invalid'} ${l.time === result.bestLap ? 'best' : ''}` }, `T${i + 1} ${formatTime(l.time)}`))) : null;
  const msgs = [];
  if (summary?.credits) msgs.push(h('div', { class: 'gain' }, `+ ${formatCredits(summary.credits)}`));
  if (summary?.message) msgs.push(h('div', { class: `goal ${summary.ok ? 'ok' : 'ko'}` }, summary.message));
  if (summary?.extra) for (const x of summary.extra) msgs.push(h('div', { class: 'goal ok' }, x));
  const next = () => {
    const cont = summary?.onContinue;
    app.exitRace(cont || app.raceCfg.onQuit);
  };
  const el = h('div', { class: 'results-screen' },
    h('div', { class: 'res-box' },
      h('div', { class: 'res-title' }, race.cfg.title || race.def.name),
      h('div', { class: `res-head ${(L ? L.ok : result.position === 1 && result.total > 1) || summary?.medal ? 'win' : L ? 'fail' : ''}` }, headline),
      h('div', { class: 'res-sub' }, sub),
      ...msgs,
      table,
      laps,
      h('div', { class: 'row end' },
        race.recorder.frames.length > 30 ? btn('Revoir le ralenti', () => showReplay(app, race, result, summary)) : null,
        btn('Recommencer', () => app.restartRace()),
        btn('Continuer', next, 'primary default'),
      ),
    ),
  );
  return { el, back: next };
}

// ------------------------------------------------------------------ Ralenti
export function showReplay(app, race, result, summary) {
  if (!race.startReplay()) return;
  const bar = h('div', { class: 'rp-progress' }, h('div', { class: 'rp-fill' }));
  const focusName = h('span', { class: 'rp-focus' }, race.sim.cars[race.replayFocus].name);
  const camName = h('span', { class: 'rp-cam' }, 'Caméra TV');
  const speedBtn = btn('Vitesse ×1', () => {
    const r = race.replay;
    r.speed = r.speed === 1 ? 0.5 : r.speed === 0.5 ? 0.25 : r.speed === 0.25 ? 2 : 1;
    speedBtn.textContent = `Vitesse ×${r.speed}`;
  });
  const back = () => {
    race.stopReplay();
    app.ui.show(resultsScreen(app, result, race, summary));
  };
  const el = h('div', { class: 'replay-ui' },
    h('div', { class: 'rp-top' }, h('span', { class: 'rp-badge' }, 'RALENTI'), focusName, camName),
    h('div', { class: 'rp-bottom' },
      bar,
      h('div', { class: 'row' },
        btn('⏯ Lecture / pause', () => (race.replay.playing = !race.replay.playing)),
        speedBtn,
        btn('Caméra suivante (C)', () => {
          race.replayCam = race.replayCam === 'tv' ? 'chase' : race.replayCam === 'chase' ? 'cockpit' : 'tv';
        }),
        btn('◀ Pilote', () => { race.replayFocus = (race.replayFocus - 1 + race.sim.cars.length) % race.sim.cars.length; race.rig.tvIndex = -1; }),
        btn('Pilote ▶', () => { race.replayFocus = (race.replayFocus + 1) % race.sim.cars.length; race.rig.tvIndex = -1; }),
        btn('Quitter le ralenti', back, 'primary'),
      ),
    ),
  );
  app.ui.show({
    el,
    back,
    onReplay: (rp) => {
      bar.firstChild.style.width = `${(rp.t / rp.duration) * 100}%`;
      focusName.textContent = race.sim.cars[race.replayFocus].name;
      camName.textContent = { tv: 'Caméra TV', chase: 'Poursuite', cockpit: 'Cockpit' }[race.replayCam];
    },
  });
}

export { CHAPTERS, chapterComplete, formatGap, TIRES };
