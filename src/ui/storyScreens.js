// Mode histoire : chapitres, dialogues, préparation et lancement des épreuves,
// permis, courses à la carte.
import { h, btn, ICONS } from './ui.js';
import { portraitSVG } from './portraits.js';
import { CHARACTERS, DIALOGS, CHAPTERS, LICENCES, FREE_SERIES, fillName } from '../data/story.js';
import { TRACK_BY_ID, TRACKS, TIME_LABEL } from '../data/tracks.js';
import { CAR_BY_ID, buildSpec, carLabel } from '../data/cars.js';
import { formatCredits, formatTime } from '../core/utils.js';
import { getTrack } from '../world/world.js';
import * as C from '../game/career.js';
import { topBar, showHub } from './menuScreens.js';
import { showGarage } from './shopScreens.js';

const MEDAL_ICON = { or: '🥇', argent: '🥈', bronze: '🥉' };

// ------------------------------------------------------------------ Dialogues
export function playDialog(app, id, done) {
  const lines = DIALOGS[id];
  const p = app.profile;
  if (!lines) return done?.();
  if (p) {
    p.story.seen[id] = true;
    app.save();
  }
  const queue = lines.slice();
  const portrait = h('div', { class: 'dlg-portrait' });
  const nameEl = h('div', { class: 'dlg-name' });
  const roleEl = h('div', { class: 'dlg-role' });
  const textEl = h('div', { class: 'dlg-text' });
  const choicesEl = h('div', { class: 'dlg-choices' });
  const hint = h('div', { class: 'dlg-hint' }, 'Entrée / clic pour continuer · Échap pour passer');
  let full = '', shown = 0, typing = false, current = null;
  const box = h('div', { class: 'dlg-box' }, portrait, h('div', { class: 'dlg-body' }, nameEl, roleEl, textEl, choicesEl, hint));
  const el = h('div', { class: 'dialog-screen', onclick: (e) => { if (!e.target.closest('.dlg-choice')) advance(); } }, box);
  const show = (line) => {
    current = line;
    choicesEl.innerHTML = '';
    if (line.choice) {
      textEl.textContent = '';
      nameEl.textContent = p?.name || 'Vous';
      roleEl.textContent = 'Votre réponse';
      portrait.innerHTML = portraitSVG(CHARACTERS.player, 180);
      line.choice.forEach((c, i) => choicesEl.appendChild(h('button', { class: `dlg-choice nav ${i === 0 ? 'default' : ''}`, onclick: () => { queue.unshift(...c.next); next(); } }, c.text)));
      const first = choicesEl.querySelector('.nav');
      if (first) app.ui.focus(first, false);
      typing = false;
      return;
    }
    const ch = CHARACTERS[line.who] || CHARACTERS.speaker;
    nameEl.textContent = fillName(ch.name, p?.name);
    nameEl.style.color = ch.color;
    roleEl.textContent = ch.role;
    portrait.innerHTML = portraitSVG(ch, 180);
    box.classList.toggle('right', line.who === 'player');
    full = fillName(line.text, p?.name);
    shown = 0;
    typing = true;
    textEl.textContent = '';
  };
  const next = () => {
    if (!queue.length) {
      app.ui.popOverlay();
      done?.();
      return;
    }
    show(queue.shift());
  };
  const advance = () => {
    if (current?.choice) return;
    if (typing) {
      shown = full.length;
      textEl.textContent = full;
      typing = false;
    } else next();
  };
  app.ui.pushOverlay({
    el,
    update: (dt) => {
      if (typing) {
        shown = Math.min(full.length, shown + dt * 55);
        textEl.textContent = full.slice(0, Math.floor(shown));
        if (shown >= full.length) typing = false;
      }
    },
    onConfirm: advance,
    back: () => {
      // passer : on saute jusqu'au prochain choix éventuel
      while (queue.length && !queue[0].choice) queue.shift();
      if (current?.choice) return;
      next();
    },
  });
  next();
}

// ------------------------------------------------------------------ Carte du circuit (vignette)
export function trackThumb(trackId, w = 300, hgt = 200) {
  const { track } = getTrack(TRACK_BY_ID[trackId]);
  const b = track.bounds;
  const pad = 14;
  const s = Math.min((w - pad * 2) / (b.maxX - b.minX), (hgt - pad * 2) / (b.maxZ - b.minZ));
  const ox = (w - (b.maxX - b.minX) * s) / 2, oz = (hgt - (b.maxZ - b.minZ) * s) / 2;
  let d = '';
  for (let i = 0; i < track.count; i += 3) d += `${i ? 'L' : 'M'}${(ox + (track.px[i] - b.minX) * s).toFixed(1)},${(oz + (track.pz[i] - b.minZ) * s).toFixed(1)}`;
  if (track.closed) d += 'Z';
  const st = track.pointAt(track.startS, 0);
  return `<svg viewBox="0 0 ${w} ${hgt}" class="thumb"><path d="${d}" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="8" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/><circle cx="${ox + (st.x - b.minX) * s}" cy="${oz + (st.z - b.minZ) * s}" r="5" fill="#ffb627"/></svg>`;
}

// ------------------------------------------------------------------ Histoire
export function showStory(app, chapterId = null) {
  const p = app.profile;
  const cur = C.currentChapter(p);
  const chap = CHAPTERS[chapterId ?? cur.id];
  if (!C.chapterUnlocked(p, chap)) return showStory(app, cur.id);
  app.displayCurrentCar();
  app.showroom.offsetX = 2.4;
  // Introduction du chapitre (une fois)
  if (!p.story.seen[chap.intro] && chap.intro) {
    return playDialog(app, chap.intro, () => {
      if (chap.bonus && !p.story.done['bonus_' + chap.id]) {
        p.credits += chap.bonus;
        p.story.done['bonus_' + chap.id] = { ok: true };
        app.ui.toast(`Sponsor Huile Mistral : + ${formatCredits(chap.bonus)}`, 'good');
      }
      if (chap.giftCar && !p.cars.some((c) => c.id === chap.giftCar.car)) {
        const o = C.addCar(p, chap.giftCar.car, chap.giftCar.color);
        p.currentCar = o.uid;
        app.ui.toast(`${carLabel(CAR_BY_ID[chap.giftCar.car])} ajoutée à votre garage !`, 'good');
      }
      app.save();
      showStory(app, chap.id);
    });
  }
  const tabs = h('div', { class: 'chapter-tabs' }, ...CHAPTERS.map((c) => {
    const un = C.chapterUnlocked(p, c);
    const done = C.chapterComplete(p, c);
    return h('button', { class: `ctab nav ${c.id === chap.id ? 'on' : ''} ${un ? '' : 'disabled'}`, onclick: () => un && showStory(app, c.id) },
      h('small', {}, c.title), h('b', {}, un ? c.name : '???'), done ? h('span', { class: 'ctab-done', html: ICONS.check }) : !un ? h('span', { class: 'ctab-lock', html: ICONS.lock }) : null);
  }));
  const events = chap.events.map((ev, i) => {
    const e = { ...ev, chapter: chap.id };
    const un = C.eventUnlocked(p, e);
    const rec = p.story.done[ev.id];
    let status = '';
    if (rec?.ok) status = ev.type === 'race' ? `${rec.position ? 'Meilleur : ' + rec.position + 'e' : 'Réussi'}` : ev.type === 'timetrial' ? `${MEDAL_ICON[rec.medal] || ''} ${formatTime(rec.best)}` : 'Obtenue';
    else if (rec) status = ev.type === 'race' ? `Objectif non atteint (${rec.position}e)` : 'Objectif non atteint';
    const typeLbl = { race: 'Course', timetrial: 'Contre-la-montre', licence: 'Permis' }[ev.type];
    return h('button', { class: `event-card nav ${un ? '' : 'disabled'} ${rec?.ok ? 'done' : ''} ${i === 0 ? 'default' : ''}`, onclick: () => un && openEvent(app, e) },
      h('div', { class: 'ev-num' }, String(i + 1)),
      h('div', { class: 'ev-main' },
        h('div', { class: 'ev-type' }, typeLbl, ev.track ? ` · ${TRACK_BY_ID[ev.track].name}` : ''),
        h('div', { class: 'ev-title' }, ev.title),
        h('div', { class: 'ev-desc' }, ev.desc),
      ),
      h('div', { class: 'ev-status' }, un ? (rec?.ok ? h('span', { class: 'ok', html: ICONS.check }) : null) : h('span', { class: 'lock', html: ICONS.lock }), h('small', {}, un ? status : 'Verrouillée')),
    );
  });
  const complete = C.chapterComplete(p, chap);
  const nextCh = CHAPTERS[chap.id + 1];
  const el = h('div', { class: 'panel-screen story' },
    topBar(app, 'Mode Histoire'),
    tabs,
    h('div', { class: 'story-body' },
      h('div', { class: 'story-head' },
        h('div', { class: 'sh-title' }, h('small', {}, chap.title), h('h1', {}, chap.name)),
        h('div', { class: 'sh-thumb', html: trackThumb(chap.track, 260, 170) }),
      ),
      h('div', { class: 'events' }, ...events),
      h('div', { class: 'row' },
        btn('Revoir l\'introduction', () => playDialog(app, chap.intro, () => showStory(app, chap.id))),
        complete && chap.outro ? btn(chap.id === 5 ? 'Revoir l\'épilogue' : 'Revoir la conclusion', () => playDialog(app, chap.outro, () => showStory(app, chap.id))) : null,
        complete && nextCh ? btn(`${nextCh.title} : ${nextCh.name} →`, () => showStory(app, nextCh.id), 'primary') : null,
      ),
    ),
  );
  app.ui.show({ el, back: () => showHub(app) });
}

// Vérifie la fin de chapitre après une épreuve, joue la conclusion
function afterStoryEvent(app, chapId, then) {
  const p = app.profile;
  const chap = CHAPTERS[chapId];
  if (C.chapterComplete(p, chap) && !p.story.seen[chap.outro]) {
    if (chap.id === CHAPTERS.length - 1) p.story.finished = true;
    app.save();
    return playDialog(app, chap.outro, () => {
      if (chap.id === CHAPTERS.length - 1) return showEnding(app);
      const nx = CHAPTERS[chap.id + 1];
      showStory(app, nx ? nx.id : chap.id);
    });
  }
  then();
}

function showEnding(app) {
  const el = h('div', { class: 'ending' },
    h('div', { class: 'end-title' }, 'FIN'),
    h('div', { class: 'end-sub' }, 'Merci d\'avoir joué à TRAJECTOIRE'),
    h('p', {}, 'La concession propose désormais les prototypes. Les courses à la carte restent ouvertes : à vous de devenir une légende.'),
    btn('Retour à l\'accueil', () => showHub(app), 'primary default'),
  );
  app.ui.show({ el, back: () => showHub(app) });
}

// ------------------------------------------------------------------ Préparation d'une épreuve
export function openEvent(app, ev) {
  if (ev.type === 'licence') return showLicence(app, ev.licence, () => showStory(app, ev.chapter));
  const run = () => showEventDetail(app, ev);
  if (ev.before && !app.profile.story.seen[ev.before]) return playDialog(app, ev.before, run);
  run();
}

export function showEventDetail(app, ev, opts = {}) {
  const p = app.profile;
  const def = TRACK_BY_ID[ev.track];
  const provided = ev.provided ? buildSpec(ev.provided.car, ev.provided.upgrades || []) : null;
  let owned = opts.owned || C.currentCar(p);
  // Choisit automatiquement une voiture éligible si l'actuelle ne l'est pas
  if (!provided && owned && !C.eligibility(ev, C.specOf(owned)).ok) {
    const ok = p.cars.find((c) => C.eligibility(ev, C.specOf(c)).ok);
    if (ok) owned = ok;
  }
  const spec = provided || (owned ? C.specOf(owned) : null);
  const elig = provided ? { ok: true } : spec ? C.eligibility(ev, spec) : { ok: false, reason: 'Aucune voiture' };
  if (provided) app.displayCar(ev.provided.car, ev.provided.color, ev.provided.upgrades);
  else if (owned) app.displayCar(owned.id, owned.color, owned.upgrades);
  app.showroom.offsetX = 2.2;
  const r = ev.restrict || {};
  const cond = [];
  if (r.ppMax) cond.push(`PP max ${r.ppMax}`);
  if (r.carId) cond.push(`Voiture : ${carLabel(CAR_BY_ID[r.carId])}`);
  if (provided) cond.push(`Voiture fournie : ${carLabel(provided)}`);
  const isTT = ev.type === 'timetrial';
  const tg = isTT ? C.eventTargets(ev) : null;
  const prizes = isTT
    ? h('div', { class: 'prizes' },
      h('div', {}, h('span', {}, '🥇 Or'), h('b', {}, formatTime(tg?.gold)), h('em', {}, formatCredits(ev.prizes.gold))),
      h('div', {}, h('span', {}, '🥈 Argent'), h('b', {}, formatTime(tg?.silver)), h('em', {}, formatCredits(ev.prizes.silver))),
      h('div', {}, h('span', {}, '🥉 Bronze'), h('b', {}, formatTime(tg?.bronze)), h('em', {}, formatCredits(ev.prizes.bronze))))
    : h('div', { class: 'prizes' }, ...(ev.prizes || []).slice(0, 6).map((v, i) => h('div', {}, h('span', {}, `${i + 1}${i === 0 ? 'er' : 'e'}`), h('em', {}, formatCredits(v)))));
  const goalTxt = ev.goal?.position ? (ev.goal.position === 1 ? 'Objectif : gagner la course' : `Objectif : terminer dans les ${ev.goal.position} premiers`) : ev.goal?.medal ? `Objectif : médaille ${C.MEDAL_KEY[ev.goal.medal]} minimum` : '';
  const nOpp = (ev.opponents?.count || 0) + (ev.opponents?.rival ? 1 : 0);
  const start = () => {
    if (!elig.ok) return app.ui.toast(elig.reason, 'bad');
    launchEvent(app, ev, spec, provided ? ev.provided.color : owned.color, opts);
  };
  const el = h('div', { class: 'panel-screen side event-detail' },
    topBar(app, opts.free ? 'Courses à la carte' : 'Mode Histoire'),
    h('div', { class: 'sidebar wide' },
      h('div', { class: 'ed-type' }, isTT ? 'Contre-la-montre' : nOpp === 1 ? 'Duel' : 'Course'),
      h('h1', {}, ev.title),
      h('p', { class: 'muted' }, ev.desc),
      h('div', { class: 'ed-track' },
        h('div', { html: trackThumb(ev.track, 220, 150) }),
        h('div', {},
          h('b', {}, def.name), h('div', { class: 'muted' }, def.location),
          h('div', {}, `${TIME_LABEL[ev.time || def.time]} · ${def.closed === false ? 'Course de côte' : `${ev.laps} tour${ev.laps > 1 ? 's' : ''}`}`),
          h('div', {}, nOpp ? `${nOpp} adversaire${nOpp > 1 ? 's' : ''}` : 'Seul en piste'),
          cond.length ? h('div', { class: 'cond' }, cond.join(' · ')) : null,
        ),
      ),
      goalTxt ? h('div', { class: 'goal-line' }, goalTxt) : null,
      h('h3', {}, isTT ? 'Objectifs' : 'Gains'),
      prizes,
    ),
    h('div', { class: 'sidebar right' },
      h('h3', {}, 'Votre voiture'),
      spec ? h('div', { class: 'ed-car' }, h('b', {}, carLabel(spec)), h('div', {}, `PP ${spec.pp} · ${spec.engine.hp} ch · ${spec.mass} kg`)) : null,
      h('div', { class: `elig ${elig.ok ? 'ok' : 'ko'}` }, elig.ok ? 'Voiture éligible' : elig.reason),
      !provided ? btn('Changer de voiture', () => showGarage(app, owned?.uid, (c) => showEventDetail(app, ev, { ...opts, owned: c || owned }))) : null,
      btn('Lancer l\'épreuve', start, `primary big default ${elig.ok ? '' : 'disabled'}`),
    ),
  );
  app.ui.show({ el, back: () => (opts.free ? showFreeEvents(app) : showStory(app, ev.chapter)) });
}

function launchEvent(app, ev, spec, color, opts) {
  const p = app.profile;
  const opponents = opts.opponents || C.buildOpponents(ev);
  const grid = C.gridPosition(ev, p, opponents.length);
  const isTT = ev.type === 'timetrial';
  const back = () => (opts.free ? showFreeEvents(app) : showStory(app, ev.chapter));
  const cfg = {
    trackId: ev.track,
    time: ev.time,
    laps: TRACK_BY_ID[ev.track].closed === false ? 1 : ev.laps,
    mode: isTT ? 'timetrial' : 'race',
    title: ev.title,
    player: { spec, color, name: p.name, short: p.name.slice(0, 3).toUpperCase() },
    opponents: isTT ? [] : opponents,
    playerGrid: grid,
    onQuit: back,
  };
  app.startRace(cfg, (result) => {
    if (opts.free) {
      const credits = ev.prizes[result.position - 1] || 0;
      p.credits += credits;
      p.stats.races++;
      p.stats.earned += credits;
      if (result.position === 1) p.stats.wins++;
      if (result.position <= 3) p.stats.podiums++;
      app.save();
      return { credits, ok: true, message: result.position <= 3 ? 'Podium !' : null, onContinue: back };
    }
    const res = C.applyEventResult(p, ev, result);
    app.save();
    let message;
    if (ev.type === 'race') message = res.ok ? 'Objectif atteint !' : `Objectif non atteint : ${ev.goal.position === 1 ? 'il faut gagner' : `terminer dans les ${ev.goal.position} premiers`}.`;
    else message = res.ok ? 'Objectif atteint !' : `Objectif non atteint : médaille ${C.MEDAL_KEY[ev.goal.medal]} requise.`;
    const extra = [];
    if (res.firstTime === false && res.credits) extra.push('Épreuve déjà réussie : gains réduits de moitié');
    return {
      credits: res.credits,
      ok: res.ok,
      medal: res.medal,
      message,
      extra,
      onContinue: () => {
        const go = () => afterStoryEvent(app, ev.chapter, back);
        if (res.newlyCompleted && ev.after && !p.story.seen[ev.after]) return playDialog(app, ev.after, go);
        go();
      },
    };
  });
}

// ------------------------------------------------------------------ Permis
function licenceUnlocked(p, L) {
  const need = { B: 0, A: 1, IA: 3, S: 4 }[L.id];
  return need === 0 || C.chapterComplete(p, CHAPTERS[need]) || C.licenceOk(p, L.id);
}

export function showLicences(app) {
  const p = app.profile;
  const cards = LICENCES.map((L) => {
    const un = licenceUnlocked(p, L);
    const st = C.licenceStatus(p, L);
    return h('button', { class: `lic-card nav ${un ? '' : 'disabled'} ${C.licenceOk(p, L.id) ? 'done' : ''}`, style: { '--lc': L.color }, onclick: () => un && showLicence(app, L.id, () => showLicences(app)) },
      h('div', { class: 'lic-badge' }, L.short),
      h('div', { class: 'lic-name' }, L.name),
      h('div', { class: 'lic-medals' }, ...st.map((s) => h('span', {}, s ? MEDAL_ICON[s.medal] : '○'))),
      h('small', {}, un ? (C.licenceOk(p, L.id) ? 'Obtenue' : `Récompense : ${formatCredits(L.reward)}`) : 'Verrouillée'),
    );
  });
  const el = h('div', { class: 'panel-screen' },
    topBar(app, 'Permis'),
    h('div', { class: 'lic-grid' }, ...cards),
    h('p', { class: 'muted center' }, 'Obtenez une médaille (bronze minimum) dans les trois épreuves pour décrocher la licence. Chaque médaille d\'or rapporte 1 000 Cr.'),
  );
  app.ui.show({ el, back: () => showHub(app) });
}

export function showLicence(app, id, onBack) {
  const p = app.profile;
  const L = LICENCES.find((l) => l.id === id);
  const tests = L.tests.map((t, i) => {
    const rec = p.licences['test_' + t.id];
    const tg = C.licenceTargets(t);
    return h('button', { class: `event-card nav ${rec ? 'done' : ''} ${i === 0 ? 'default' : ''}`, onclick: () => runLicenceTest(app, L, t, () => showLicence(app, id, onBack)) },
      h('div', { class: 'ev-num' }, t.id),
      h('div', { class: 'ev-main' },
        h('div', { class: 'ev-type' }, `${TRACK_BY_ID[t.track].name} · ${carLabel(CAR_BY_ID[t.car])}`),
        h('div', { class: 'ev-title' }, t.title),
        h('div', { class: 'ev-desc' }, t.desc),
        tg ? h('div', { class: 'ev-targets' }, `🥇 ${formatTime(tg.gold)}  🥈 ${formatTime(tg.silver)}  🥉 ${formatTime(tg.bronze)}`) : null,
      ),
      h('div', { class: 'ev-status' }, rec ? h('span', { class: 'medal' }, MEDAL_ICON[rec.medal]) : null, h('small', {}, rec ? formatTime(rec.time) : 'À tenter')),
    );
  });
  app.displayCar(L.tests[0].car, CAR_BY_ID[L.tests[0].car].paints[0]);
  app.showroom.offsetX = 2.4;
  const el = h('div', { class: 'panel-screen story' },
    topBar(app, L.name),
    h('div', { class: 'story-body' },
      h('div', { class: 'sh-title' }, h('small', {}, 'Permis'), h('h1', {}, L.name)),
      h('div', { class: 'events' }, ...tests),
      h('p', { class: 'muted' }, C.licenceOk(p, L.id) ? 'Licence obtenue. Vous pouvez améliorer vos médailles.' : `Récompense à l'obtention : ${formatCredits(L.reward)}`),
    ),
  );
  app.ui.show({ el, back: onBack });
}

function runLicenceTest(app, L, test, back) {
  const p = app.profile;
  const tg = C.licenceTargets(test);
  const car = CAR_BY_ID[test.car];
  const spec = buildSpec(test.car, []);
  app.startRace({
    trackId: test.track,
    mode: 'licence',
    laps: 1,
    title: `${test.id} — ${test.title}`,
    player: { spec, color: car.paints[0], name: p.name },
    opponents: [],
    licence: { kind: test.kind, startS: test.startS, startSpeed: test.startSpeed, zone: test.zone, endS: test.endS, targets: tg, desc: test.desc, title: test.id },
    onQuit: back,
  }, (result) => {
    const lr = result.licence;
    const extra = [];
    let credits = 0;
    if (lr?.ok) {
      const before = p.credits;
      const r = C.applyLicenceResult(p, test, lr);
      credits = p.credits - before;
      if (r.gained) extra.push(`${r.gained.name} obtenue !`);
      if (r.bonus) extra.push('Bonus médaille d\'or');
      app.save();
    }
    return {
      credits,
      ok: !!lr?.ok,
      medal: lr?.medal,
      message: lr?.ok ? `Médaille ${lr.medal} — ${formatTime(lr.time)}` : `Échec : ${lr?.reason || ''}`,
      extra,
      onContinue: () => {
        // si la licence débloque la fin d'un chapitre
        const ch = CHAPTERS.find((c) => c.events.some((e) => e.type === 'licence' && e.licence === L.id));
        if (ch && C.licenceOk(p, L.id)) return afterStoryEvent(app, ch.id, back);
        back();
      },
    };
  });
}

// ------------------------------------------------------------------ Courses à la carte
const SERIES_LICENCE = { f_compact: null, f_sport: 'A', f_gt: 'IA', f_super: 'S', f_proto: 'S' };

export function showFreeEvents(app, seriesId = null) {
  const p = app.profile;
  const series = FREE_SERIES.find((s) => s.id === seriesId) || FREE_SERIES[0];
  const unlocked = (s) => !SERIES_LICENCE[s.id] || C.licenceOk(p, SERIES_LICENCE[s.id]);
  app.displayCurrentCar();
  app.showroom.offsetX = 2.4;
  const el = h('div', { class: 'panel-screen story' },
    topBar(app, 'Courses à la carte'),
    h('div', { class: 'chapter-tabs' }, ...FREE_SERIES.map((s) => h('button', { class: `ctab nav ${s.id === series.id ? 'on' : ''} ${unlocked(s) ? '' : 'disabled'}`, onclick: () => unlocked(s) && showFreeEvents(app, s.id) },
      h('small', {}, `PP ≤ ${s.ppMax}`), h('b', {}, s.title), unlocked(s) ? null : h('span', { class: 'ctab-lock', html: ICONS.lock })))),
    h('div', { class: 'story-body' },
      h('p', { class: 'muted' }, unlocked(series) ? `Gains : jusqu'à ${formatCredits(series.base)} par victoire. Rejouable à volonté.` : `Nécessite la licence ${SERIES_LICENCE[series.id]}.`),
      h('div', { class: 'events grid' }, ...TRACKS.map((t, i) => {
        const ev = makeFreeEvent(series, t);
        return h('button', { class: `event-card nav ${unlocked(series) ? '' : 'disabled'} ${i === 0 ? 'default' : ''}`, onclick: () => unlocked(series) && showEventDetail(app, ev, { free: true }) },
          h('div', { class: 'ev-thumb', html: trackThumb(t.id, 120, 80) }),
          h('div', { class: 'ev-main' },
            h('div', { class: 'ev-type' }, `${TIME_LABEL[t.time]} · ${t.closed === false ? 'Côte' : ev.laps + ' tours'}`),
            h('div', { class: 'ev-title' }, t.name),
            h('div', { class: 'ev-desc' }, `${ev.opponents.count} adversaires · 1er : ${formatCredits(ev.prizes[0])}`),
          ),
        );
      })),
    ),
  );
  app.ui.show({ el, back: () => showHub(app) });
}

function makeFreeEvent(series, t) {
  const laps = t.closed === false ? 1 : t.id === 'autodrome' ? 4 : 3;
  const mul = t.closed === false ? 0.6 : laps / 3;
  const count = t.closed === false ? 5 : 7;
  const prizes = [1, 0.6, 0.4, 0.25, 0.18, 0.12, 0.08, 0.05].slice(0, count + 1).map((f) => Math.round((series.base * mul * f) / 100) * 100);
  return {
    id: `${series.id}_${t.id}`,
    type: 'race',
    title: `${series.title} — ${t.name}`,
    desc: `${series.title} sur le ${t.name}. Voitures jusqu'à ${series.ppMax} PP.`,
    track: t.id,
    laps,
    restrict: { ppMax: series.ppMax },
    opponents: { count, pool: series.pool, skill: series.skill },
    grid: 'last',
    prizes,
    goal: { position: 3 },
  };
}
