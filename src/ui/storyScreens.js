// Mode histoire : carte des chapitres, dialogues (machine à écrire), préparation et lancement des épreuves,
// réactions après course, fins de chapitre et épilogue, permis, courses à la carte.
import './story.css';
import { h, btn, ICONS } from './ui.js';
import { portraitSVG } from './portraits.js';
import { CHARACTERS, DIALOGS, REACTIONS, CHAPTERS, LICENCES, FREE_SERIES, fillText } from '../data/story.js';
import { TRACK_BY_ID, TRACKS, TIME_LABEL } from '../data/tracks.js';
import { CAR_BY_ID, buildSpec, carLabel } from '../data/cars.js';
import { formatCredits, formatTime } from '../core/utils.js';
import { getTrack } from '../world/world.js';
import * as C from '../game/career.js';
import { topBar, showHub } from './menuScreens.js';
import { showGarage } from './shopScreens.js';

const MEDAL_ICON = { or: '🥇', argent: '🥈', bronze: '🥉' };
const SVG = (d) => `<svg viewBox="0 0 24 24"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const MINI = {
  rain: SVG('M7 15a4 4 0 0 1 .5-8 5 5 0 0 1 9.6 1.4A3.5 3.5 0 0 1 17 15H7zM8 18l-1 2M12 18l-1 2M16 18l-1 2'),
  night: SVG('M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z'),
  key: SVG('M14 10a4 4 0 1 0-3.5 4L9 15.5V18H6.5v2.5H4V18l6.5-6.5M15.5 8.5h.01'),
  versus: SVG('M4 4l7 8-7 8M20 4l-7 8 7 8'),
  clock: SVG('M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z'),
  flag: SVG('M5 21V4M5 4h12l-2 4 2 4H5'),
  gift: SVG('M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0'),
  skip: SVG('M5 5l8 7-8 7zM14 5l6 7-6 7'),
};

// ------------------------------------------------------------------ Dialogues
// Contexte des variables de texte : nom du pilote, voiture courante, prochaine épreuve
function dialogContext(app, extra = {}) {
  const p = app.profile;
  const ctx = { nom: p?.name, ...extra };
  if (p && !ctx.voiture) {
    const car = C.currentCar(p);
    if (car) ctx.voiture = carLabel(CAR_BY_ID[car.id]);
  }
  if (p && !ctx.suivante) {
    const nx = C.nextEvent(p, C.currentChapter(p).id);
    if (nx) ctx.suivante = `« ${nx.title} »`;
  }
  return ctx;
}

// id : identifiant de DIALOGS ou liste de répliques. done() est appelé à la fin (ou quand on passe).
export function playDialog(app, id, done, extraCtx = {}) {
  const lines = Array.isArray(id) ? id : DIALOGS[id];
  const p = app.profile;
  if (!lines?.length) return done?.();
  if (p && !Array.isArray(id)) {
    p.story.seen[id] = true;
    app.save();
  }
  const ctx = dialogContext(app, extraCtx);
  const queue = lines.slice();
  let played = 0;
  const portrait = h('div', { class: 'dlg-portrait' });
  const nameEl = h('div', { class: 'dlg-name' });
  const roleEl = h('div', { class: 'dlg-role' });
  const textOn = h('span', { class: 'on' });
  const textOff = h('span', { class: 'off' });
  const textEl = h('div', { class: 'dlg-text' }, textOn, textOff);
  const choicesEl = h('div', { class: 'dlg-choices' });
  const nextEl = h('span', { class: 'dlg-next' }, '▼');
  const fill = h('div', { class: 'dlg-fill' });
  const box = h('div', { class: 'dlg-box' }, portrait,
    h('div', { class: 'dlg-body' },
      h('div', { class: 'dlg-head' }, nameEl, roleEl),
      textEl, choicesEl,
      h('div', { class: 'dlg-foot' },
        h('div', { class: 'dlg-progress' }, fill),
        h('span', { class: 'dlg-hint' }, h('span', { class: 'kb' }, 'Entrée, Espace ou clic : continuer · Échap : passer'), h('span', { class: 'tp' }, 'Touchez pour continuer')),
        nextEl,
      ),
    ),
  );
  // bouton « Passer » sans classe nav : il ne prend jamais le focus clavier (Entrée ne le déclenche pas)
  const skipBtn = h('button', { class: 'dlg-skip', onclick: (e) => { e.stopPropagation(); skip(); } }, h('span', { html: MINI.skip }), 'Passer');
  const el = h('div', { class: 'dialog-screen', onclick: (e) => { if (!e.target.closest('.dlg-choice')) advance(); } }, skipBtn, box);
  let full = '', shown = 0, budget = 0, typing = false, current = null, who = null;
  const setPortrait = (key, ch, mood) => {
    portrait.innerHTML = portraitSVG(ch, 180, mood);
    if (key !== who) {
      portrait.classList.remove('enter');
      void portrait.offsetWidth; // relance l'animation d'entrée
      portrait.classList.add('enter');
    }
    who = key;
    box.style.setProperty('--pc', ch.color || '#fff');
  };
  const render = () => {
    textOn.textContent = full.slice(0, shown);
    textOff.textContent = full.slice(shown);
  };
  const finishLine = () => {
    shown = full.length;
    typing = false;
    render();
    nextEl.classList.add('show');
  };
  const show = (line) => {
    current = line;
    played++;
    fill.style.width = `${Math.round((played / (played + queue.length)) * 100)}%`;
    choicesEl.innerHTML = '';
    nextEl.classList.remove('show');
    if (line.choice) {
      full = '';
      shown = 0;
      render();
      nameEl.textContent = p?.name || 'Vous';
      nameEl.style.color = '#fff';
      roleEl.textContent = 'Votre réponse';
      setPortrait('player', CHARACTERS.player, '');
      box.classList.add('right');
      line.choice.forEach((c, i) => choicesEl.appendChild(h('button', { class: `dlg-choice nav ${i === 0 ? 'default' : ''}`, onclick: (e) => { e.stopPropagation(); app.ui.focus(null, false); queue.unshift(...c.next); next(); } }, fillText(c.text, ctx))));
      const first = choicesEl.querySelector('.nav');
      if (first) app.ui.focus(first, false);
      typing = false;
      return;
    }
    const ch = CHARACTERS[line.who] || CHARACTERS.speaker;
    nameEl.textContent = fillText(ch.name, ctx);
    nameEl.style.color = ch.color;
    roleEl.textContent = ch.role;
    setPortrait(line.who, ch, line.mood || '');
    box.classList.toggle('right', line.who === 'player');
    full = fillText(line.text, ctx);
    shown = 0;
    budget = 0;
    typing = true;
    render();
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
    if (typing) finishLine();
    else next();
  };
  // Passer : jusqu'au prochain choix éventuel, sinon jusqu'à la fin
  const skip = () => {
    if (current?.choice) return;
    while (queue.length && !queue[0].choice) queue.shift();
    next();
  };
  app.ui.pushOverlay({
    el,
    update: (dt) => {
      if (!typing) return;
      budget += dt * 52;
      while (budget >= 1 && shown < full.length) {
        const c = full[shown++];
        budget -= 1;
        // petites pauses sur la ponctuation
        if ('.!?…'.includes(c) && full[shown] === ' ') budget -= 9;
        else if (',;:'.includes(c)) budget -= 3;
      }
      render();
      if (shown >= full.length) finishLine();
    },
    onConfirm: advance,
    back: skip,
  });
  next();
}

// Enchaîne plusieurs dialogues (identifiants ou listes), puis done()
function playDialogs(app, list, done, ctx) {
  const items = list.filter(Boolean);
  const step = () => (items.length ? playDialog(app, items.shift(), step, ctx) : done?.());
  step();
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

// ------------------------------------------------------------------ Histoire : carte des chapitres
const TYPE_LABEL = { race: 'Course', timetrial: 'Contre-la-montre', licence: 'Permis' };

function eventKind(ev) {
  if (ev.type !== 'race') return TYPE_LABEL[ev.type];
  const n = (ev.opponents?.count || 0) + (ev.opponents?.rival ? 1 : 0);
  if (n === 1) return 'Duel';
  return TRACK_BY_ID[ev.track]?.closed === false ? 'Course de côte' : 'Course';
}

// Étiquettes d'une épreuve : pluie, nuit, voiture prêtée, Viktor, limite de PP
function eventChips(ev) {
  const chips = [];
  const chip = (icon, text, cls = '') => h('span', { class: `chip ${cls}` }, icon ? h('i', { html: icon }) : null, text);
  if (ev.weather === 'pluie') chips.push(chip(MINI.rain, 'Pluie', 'rain'));
  const time = ev.time || TRACK_BY_ID[ev.track]?.time;
  if (ev.track && time === 'night') chips.push(chip(MINI.night, 'Nuit', 'night'));
  if (ev.provided) chips.push(chip(MINI.key, `Prêt : ${CAR_BY_ID[ev.provided.car].model}`, 'loan'));
  if (ev.opponents?.rival) chips.push(chip(MINI.versus, 'Viktor', 'rival'));
  if (ev.restrict?.carId) chips.push(chip('', CAR_BY_ID[ev.restrict.carId].model));
  else if (ev.restrict?.ppMax && !ev.provided) chips.push(chip('', `PP ≤ ${ev.restrict.ppMax}`));
  if (ev.type !== 'licence' && ev.track) chips.push(chip('', TRACK_BY_ID[ev.track].closed === false ? 'Montée' : `${ev.laps} tour${ev.laps > 1 ? 's' : ''}`));
  return chips;
}

function rewardText(chap) {
  const parts = [];
  if (chap.bonus) parts.push(`${chap.bonusText || 'Prime'} : ${formatCredits(chap.bonus)}`);
  if (chap.giftCar) parts.push(carLabel(CAR_BY_ID[chap.giftCar.car]));
  if (chap.reward?.car) parts.push(carLabel(CAR_BY_ID[chap.reward.car.car]));
  if (chap.reward?.credits) parts.push(formatCredits(chap.reward.credits));
  if (chap.final) parts.push('les prototypes en concession');
  return parts.join(' · ');
}

// Récompenses de chapitres terminés avant cette version (conclusion déjà vue) : versées à l'ouverture
function claimLegacyRewards(app) {
  const p = app.profile;
  for (const ch of CHAPTERS) {
    if (!ch.reward || !p.story.seen[ch.outro]) continue;
    const r = C.claimChapterReward(p, ch);
    if (!r) continue;
    app.ui.toast(`${ch.title} terminé : ${r.car ? carLabel(CAR_BY_ID[r.car.id]) + ' offerte' : '+ ' + formatCredits(r.credits)}`, 'good');
    app.save();
  }
}

// opts.quiet : n'enchaîne ni introduction ni récompense (écran de fond pendant les réactions d'après course)
export function showStory(app, chapterId = null, opts = {}) {
  const p = app.profile;
  if (!opts.quiet) claimLegacyRewards(app);
  const cur = C.currentChapter(p);
  const chap = CHAPTERS[chapterId ?? cur.id] || cur;
  if (!C.chapterUnlocked(p, chap)) return showStory(app, cur.id, opts);
  app.displayCurrentCar();
  app.showroom.offsetX = 2.4;

  // Frise des chapitres
  const furthest = CHAPTERS.reduce((m, c) => (C.chapterUnlocked(p, c) ? c.id : m), 0);
  const map = h('nav', { class: 'story-map' },
    h('div', { class: 'sm-rail' }, h('div', { class: 'sm-fill', style: { width: `${(furthest / (CHAPTERS.length - 1)) * 100}%` } })),
    ...CHAPTERS.map((c) => {
      const un = C.chapterUnlocked(p, c);
      const done = C.chapterComplete(p, c);
      const pr = C.chapterProgress(p, c);
      return h('button', { class: `sm-node nav ${c.id === chap.id ? 'on' : ''} ${done ? 'done' : ''} ${un ? '' : 'disabled'} ${c.id === cur.id && !done ? 'current' : ''}`, onclick: () => un && showStory(app, c.id) },
        h('span', { class: 'sm-dot', html: done ? ICONS.check : un ? '' : ICONS.lock }, done || !un ? null : c.id === 0 ? 'P' : String(c.id)),
        h('span', { class: 'sm-label' }, h('small', {}, c.id === 0 ? 'Prologue' : `Ch. ${c.id}`), h('b', {}, un ? c.name : '???')),
        un ? h('span', { class: 'sm-prog' }, `${pr.done}/${pr.total}`) : null,
      );
    }),
  );

  // Épreuves du chapitre
  let firstOpen = null;
  const events = chap.events.map((ev, i) => {
    const e = { ...ev, chapter: chap.id };
    const un = C.eventUnlocked(p, e);
    const rec = p.story.done[ev.id];
    if (un && !rec?.ok && !firstOpen) firstOpen = ev.id;
    let status = '';
    if (rec?.ok) status = ev.type === 'race' ? (rec.position ? `Meilleur : ${rec.position}${rec.position === 1 ? 'er' : 'e'}` : 'Réussie') : ev.type === 'timetrial' ? formatTime(rec.best) : 'Obtenue';
    else if (rec) status = ev.type === 'race' ? `Objectif manqué (${rec.position}e)` : 'Objectif manqué';
    const prize = ev.type === 'race' ? `1er : ${formatCredits(ev.prizes[0])}` : ev.type === 'timetrial' ? `Or : ${formatCredits(ev.prizes.gold)}` : '';
    const lockWhy = !un && ev.requires?.length ? `Après : ${ev.requires.map((r) => chap.events.find((x) => x.id === r)?.title).filter(Boolean).join(', ')}` : 'Verrouillée';
    return h('button', { class: `event-card nav ${un ? '' : 'disabled'} ${rec?.ok ? 'done' : ''} ${firstOpen === ev.id ? 'default' : ''}`, onclick: () => un && openEvent(app, e) },
      h('div', { class: 'ev-num' }, rec?.medal ? h('span', { class: 'ev-medal' }, MEDAL_ICON[rec.medal]) : String(i + 1)),
      h('div', { class: 'ev-main' },
        h('div', { class: 'ev-type' }, eventKind(ev), ev.track ? ` · ${TRACK_BY_ID[ev.track].name}` : ''),
        h('div', { class: 'ev-title' }, ev.title),
        h('div', { class: 'ev-desc' }, ev.desc),
        h('div', { class: 'ev-chips' }, ...eventChips(ev)),
      ),
      h('div', { class: 'ev-status' },
        un ? (rec?.ok ? h('span', { class: 'ok', html: ICONS.check }) : null) : h('span', { class: 'lock', html: ICONS.lock }),
        h('small', {}, un ? status : lockWhy),
        prize && un ? h('em', { class: 'ev-prize' }, prize) : null,
      ),
    );
  });

  const complete = C.chapterComplete(p, chap);
  const nextCh = CHAPTERS[chap.id + 1];
  const pr = C.chapterProgress(p, chap);
  const def = TRACK_BY_ID[chap.track];
  const others = [...new Set(chap.events.map((e) => e.track).filter((t) => t && t !== chap.track))];
  const medals = ['or', 'argent', 'bronze'].filter((m) => pr[m]).map((m) => h('span', {}, `${MEDAL_ICON[m]} ${pr[m]}`));
  const rw = rewardText(chap);
  const el = h('div', { class: 'panel-screen story chapters' },
    topBar(app, 'Mode Histoire'),
    map,
    h('div', { class: 'story-body' },
      h('div', { class: 'story-head' },
        h('div', { class: 'sh-title' },
          h('small', {}, chap.title, ' · ', def.location),
          h('h1', {}, chap.name),
          h('div', { class: 'sh-tracks' }, def.name, others.length ? ` · ${others.map((t) => TRACK_BY_ID[t].name).join(' · ')}` : ''),
          h('div', { class: 'sh-progress' },
            h('div', { class: 'sh-bar' }, h('div', { style: { width: `${(pr.done / pr.total) * 100}%` } })),
            h('span', {}, `${pr.done} / ${pr.total} épreuve${pr.total > 1 ? 's' : ''}`),
            pr.wins ? h('span', {}, `🏁 ${pr.wins}`) : null,
            ...medals,
          ),
          rw ? h('div', { class: `sh-reward ${complete ? 'got' : ''}` }, h('i', { html: MINI.gift }), complete ? 'Obtenu : ' : 'Récompense : ', rw) : null,
        ),
        h('div', { class: 'sh-thumb', html: trackThumb(chap.track, 260, 170) }),
      ),
      h('div', { class: 'events' }, ...events),
      h('div', { class: 'row' },
        chap.intro ? btn('Revoir l\'introduction', () => playDialog(app, chap.intro, () => showStory(app, chap.id))) : null,
        complete && chap.outro ? btn(chap.final ? 'Revoir l\'épilogue' : 'Revoir la conclusion', () => playDialog(app, chap.outro, () => (chap.final ? showEnding(app) : showStory(app, chap.id)))) : null,
        complete && nextCh && C.chapterUnlocked(p, nextCh) ? btn(`${nextCh.title} : ${nextCh.name} →`, () => showStory(app, nextCh.id), `primary ${firstOpen ? '' : 'default'}`) : null,
      ),
    ),
  );
  app.ui.show({ el, back: () => showHub(app) });
  if (opts.quiet) return;
  // Introduction du chapitre (une fois), puis prime de sponsor ou voiture offerte
  if (chap.intro && !p.story.seen[chap.intro]) {
    playDialog(app, chap.intro, () => {
      if (chap.bonus && !p.story.done['bonus_' + chap.key]) {
        p.credits += chap.bonus;
        p.stats.earned += chap.bonus;
        p.story.done['bonus_' + chap.key] = { ok: true };
        app.ui.toast(`${chap.bonusText || 'Prime'} : + ${formatCredits(chap.bonus)}`, 'good');
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
}

// Fin d'épreuve : conclusion du chapitre, récompense, écran de fin. then() sinon.
function afterStoryEvent(app, chapId, ctx = {}, then = null) {
  const p = app.profile;
  const chap = CHAPTERS[chapId];
  const fallback = then || (() => showStory(app, chap.id));
  if (!C.chapterComplete(p, chap)) return fallback();
  const needOutro = chap.outro && !p.story.seen[chap.outro];
  const reward = C.claimChapterReward(p, chap);
  if (!needOutro && !reward) return fallback();
  if (chap.final) p.story.finished = true;
  app.save();
  const end = () => (chap.final ? showEnding(app) : showChapterEnd(app, chap, reward));
  if (needOutro) playDialog(app, chap.outro, end, ctx);
  else end();
}

// Écran de fin de chapitre : bilan des épreuves, récompense, chapitre suivant
export function showChapterEnd(app, chap, reward) {
  const p = app.profile;
  const pr = C.chapterProgress(p, chap);
  const nextCh = CHAPTERS[chap.id + 1];
  if (reward?.car) app.displayCar(reward.car.id, reward.car.color, reward.car.upgrades);
  else app.displayCurrentCar();
  app.showroom.offsetX = 2.4;
  const rows = chap.events.map((ev) => {
    const rec = p.story.done[ev.id];
    const res = ev.type === 'licence' ? 'Obtenue' : ev.type === 'timetrial' ? `${MEDAL_ICON[rec?.medal] || ''} ${formatTime(rec?.best)}` : rec?.position ? `${rec.position}${rec.position === 1 ? 'er' : 'e'}` : '—';
    return h('div', { class: 'ce-row' }, h('span', {}, ev.title), h('b', {}, res));
  });
  const nextDef = nextCh ? TRACK_BY_ID[nextCh.track] : null;
  const go = () => showStory(app, nextCh ? nextCh.id : chap.id);
  const el = h('div', { class: 'chapter-end' },
    h('div', { class: 'ce-box' },
      h('div', { class: 'ce-kicker' }, chap.id === 0 ? 'Prologue terminé' : `${chap.title} terminé`),
      h('h1', {}, chap.name),
      h('div', { class: 'ce-stats' },
        h('span', {}, `${pr.done} épreuve${pr.done > 1 ? 's' : ''}`),
        pr.wins ? h('span', {}, `🏁 ${pr.wins} victoire${pr.wins > 1 ? 's' : ''}`) : null,
        ...['or', 'argent', 'bronze'].filter((m) => pr[m]).map((m) => h('span', {}, `${MEDAL_ICON[m]} ${pr[m]}`)),
      ),
      h('div', { class: 'ce-rows' }, ...rows),
      reward ? h('div', { class: 'ce-reward' },
        h('i', { html: MINI.gift }),
        h('div', {},
          h('small', {}, 'Récompense'),
          reward.car ? h('b', {}, carLabel(CAR_BY_ID[reward.car.id])) : null,
          reward.credits ? h('b', { class: 'cr' }, `+ ${formatCredits(reward.credits)}`) : null,
          reward.text ? h('p', {}, reward.text) : null,
        ),
      ) : null,
      nextCh ? h('div', { class: 'ce-next' }, h('small', {}, 'Chapitre suivant'), h('b', {}, `${nextCh.title} — ${nextCh.name}`), h('span', {}, `${nextDef.name}, ${nextDef.location}`)) : null,
      h('div', { class: 'row end' }, btn(nextCh ? 'Continuer' : 'Retour à l\'histoire', go, 'primary default')),
    ),
  );
  app.ui.show({ el, back: go });
}

// Épilogue : générique, bilan de carrière
export function showEnding(app) {
  const p = app.profile;
  const st = p.stats;
  const cast = ['doc', 'ines', 'gunther', 'aiko', 'lucie', 'viktor'].map((k) => {
    const ch = CHARACTERS[k];
    return h('div', { class: 'end-cast-item' }, h('div', { class: 'end-face', html: portraitSVG(ch, 84, k === 'viktor' ? 'smirk' : 'smile') }), h('b', {}, ch.name), h('small', {}, ch.role));
  });
  app.displayCar('delaunay_dl98', '#0b2e6b');
  app.showroom.offsetX = 0;
  const el = h('div', { class: 'ending' },
    h('div', { class: 'end-title' }, 'FIN'),
    h('div', { class: 'end-sub' }, `${p.name} remporte le Trophée Trajectoire`),
    h('div', { class: 'end-stats' },
      h('div', {}, h('b', {}, String(st.wins)), h('small', {}, 'victoires')),
      h('div', {}, h('b', {}, String(st.podiums)), h('small', {}, 'podiums')),
      h('div', {}, h('b', {}, String(st.races)), h('small', {}, 'courses')),
      h('div', {}, h('b', {}, `${Math.round((st.distance || 0) / 1000).toLocaleString('fr-FR')} km`), h('small', {}, 'parcourus')),
      h('div', {}, h('b', {}, formatCredits(st.earned)), h('small', {}, 'gagnés')),
    ),
    h('div', { class: 'end-cast' }, ...cast),
    h('p', {}, 'La concession propose désormais les prototypes. Les courses à la carte et les championnats restent ouverts : à vous d\'écrire la suite de la légende.'),
    h('div', { class: 'row' },
      btn('Revoir l\'épilogue', () => playDialog(app, 'epilogue', () => showEnding(app))),
      btn('Retour à l\'accueil', () => showHub(app), 'primary default'),
    ),
  );
  app.ui.show({ el, back: () => showHub(app) });
}

// ------------------------------------------------------------------ Réactions d'après course
function reactionKind(ev, res) {
  if (ev.type === 'timetrial') return res.ok ? (res.medal === 'or' ? 'gold' : 'medal') : 'failTT';
  if (res.rivalAhead) return 'rival';
  if (!res.ok) return 'fail';
  if (res.rivalAhead === false && (ev.opponents?.count || 0) > 0) return 'beatRival';
  return res.position === 1 ? 'win' : 'podium';
}

// Dialogue joué après une épreuve de l'histoire : dédié (after / fail) ou réaction courte
function aftermath(p, ev, res) {
  const seen = p.story.seen;
  if (res.newlyCompleted && ev.after && !seen[ev.after] && res.rivalAhead !== true) return ev.after;
  if (!res.ok && ev.fail && !seen[ev.fail]) return ev.fail;
  if (res.ok && !res.firstTime) return null; // épreuve rejouée : pas de commentaire
  if (!res.ok && res.tries > 3) return null; // pas de sermon à chaque nouvel essai
  const kind = reactionKind(ev, res);
  const list = REACTIONS.filter((r) => r.kind === kind && (r.from ?? 0) <= ev.chapter && ev.chapter <= (r.to ?? 99));
  if (!list.length) return null;
  let hsh = res.tries || 0;
  for (const c of ev.id) hsh = (hsh * 31 + c.charCodeAt(0)) % 9973;
  return list[hsh % list.length].lines;
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
  if (r.ppMax && !provided) cond.push(`PP max ${r.ppMax}`);
  if (r.carId) cond.push(`Voiture : ${carLabel(CAR_BY_ID[r.carId])}`);
  if (provided) cond.push(`Voiture prêtée : ${carLabel(provided)}`);
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
  const rival = ev.opponents?.rival;
  const rec = !opts.free && p.story.done[ev.id];
  const start = () => {
    if (!elig.ok) return app.ui.toast(elig.reason, 'bad');
    launchEvent(app, ev, spec, provided ? ev.provided.color : owned.color, provided ? null : owned, opts);
  };
  const el = h('div', { class: 'panel-screen side event-detail' },
    topBar(app, opts.free ? 'Courses à la carte' : 'Mode Histoire'),
    h('div', { class: 'sidebar wide' },
      h('div', { class: 'ed-type' }, isTT ? 'Contre-la-montre' : nOpp === 1 ? 'Duel' : 'Course'),
      h('h1', {}, ev.title),
      h('p', { class: 'muted' }, ev.desc),
      h('div', { class: 'ev-chips' }, ...eventChips(ev)),
      h('div', { class: 'ed-track' },
        h('div', { html: trackThumb(ev.track, 220, 150) }),
        h('div', {},
          h('b', {}, def.name), h('div', { class: 'muted' }, def.location),
          h('div', {}, `${TIME_LABEL[ev.time || def.time]}${ev.weather === 'pluie' ? ' · Pluie' : ''} · ${def.closed === false ? 'Course de côte' : `${ev.laps} tour${ev.laps > 1 ? 's' : ''}`}`),
          h('div', {}, nOpp ? `${nOpp} adversaire${nOpp > 1 ? 's' : ''}` : 'Seul en piste'),
          rival ? h('div', { class: 'ed-rival' }, `Viktor Sorel · ${carLabel(CAR_BY_ID[rival.car])}`) : null,
          cond.length ? h('div', { class: 'cond' }, cond.join(' · ')) : null,
        ),
      ),
      goalTxt ? h('div', { class: 'goal-line' }, goalTxt) : null,
      rec?.ok ? h('div', { class: 'muted small' }, 'Épreuve déjà réussie : les gains sont réduits de moitié.') : null,
      h('h3', {}, isTT ? 'Objectifs' : 'Gains'),
      prizes,
    ),
    h('div', { class: 'sidebar right' },
      h('h3', {}, provided ? 'Voiture prêtée' : 'Votre voiture'),
      spec ? h('div', { class: 'ed-car' }, h('b', {}, carLabel(spec)), h('div', {}, `PP ${spec.pp} · ${spec.engine.hp} ch · ${spec.mass} kg`)) : null,
      h('div', { class: `elig ${elig.ok ? 'ok' : 'ko'}` }, elig.ok ? (provided ? 'Fournie pour l\'épreuve' : 'Voiture éligible') : elig.reason),
      !provided ? btn('Changer de voiture', () => showGarage(app, owned?.uid, (c) => showEventDetail(app, ev, { ...opts, owned: c || owned }))) : null,
      btn('Lancer l\'épreuve', start, `primary big default ${elig.ok ? '' : 'disabled'}`),
    ),
  );
  app.ui.show({ el, back: () => (opts.free ? showFreeEvents(app) : showStory(app, ev.chapter)) });
}

function launchEvent(app, ev, spec, color, owned, opts) {
  const p = app.profile;
  const opponents = opts.opponents || C.buildOpponents(ev);
  const grid = C.gridPosition(ev, p, opponents.length);
  const isTT = ev.type === 'timetrial';
  const back = () => (opts.free ? showFreeEvents(app) : showStory(app, ev.chapter));
  const cfg = {
    trackId: ev.track,
    time: ev.time,
    weather: ev.weather,
    laps: TRACK_BY_ID[ev.track].closed === false ? 1 : ev.laps,
    mode: isTT ? 'timetrial' : 'race',
    title: ev.title,
    player: { spec, color, name: p.name, short: p.name.slice(0, 3).toUpperCase(), custom: owned?.custom || null },
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
    if (res.ok && res.rivalAhead === false && ev.opponents?.rival) extra.push('Devant Viktor Sorel !');
    return {
      credits: res.credits,
      ok: res.ok,
      medal: res.medal,
      message,
      extra,
      onContinue: () => {
        const nx = C.nextEvent(p, ev.chapter);
        const ctx = { voiture: carLabel(spec), position: res.position, suivante: nx ? `« ${nx.title} »` : null };
        // la carte de l'histoire sert de fond aux dialogues
        showStory(app, ev.chapter, { quiet: true });
        playDialogs(app, [aftermath(p, ev, res)], () => afterStoryEvent(app, ev.chapter, ctx), ctx);
      },
    };
  });
}

// ------------------------------------------------------------------ Permis
function licenceChapter(id) {
  return CHAPTERS.find((c) => c.events.some((e) => e.type === 'licence' && e.licence === id));
}

// Un permis se passe dès que le chapitre qui le demande est ouvert
function licenceUnlocked(p, L) {
  if (C.licenceOk(p, L.id)) return true;
  const ch = licenceChapter(L.id);
  return !ch || C.chapterUnlocked(p, ch);
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
      h('small', {}, un ? (C.licenceOk(p, L.id) ? 'Obtenue' : `Récompense : ${formatCredits(L.reward)}`) : `Verrouillée (${licenceChapter(L.id)?.title || ''})`),
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
  const el = h('div', { class: 'panel-screen story lic' },
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
        // si la licence termine un chapitre : conclusion et fin de chapitre
        const ch = licenceChapter(L.id);
        back();
        if (ch && C.licenceOk(p, L.id)) afterStoryEvent(app, ch.id, {}, () => {});
      },
    };
  });
}

// ------------------------------------------------------------------ Courses à la carte
const SERIES_LICENCE = { f_compact: null, f_sport: 'A', f_gt: 'IA', f_super: 'S', f_proto: 'S' };
const FREE_LAPS = { autodrome: 4, ovale: 4, dunes: 2, glacier: 2, grunwald: 1 };

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
      h('p', { class: 'muted' }, unlocked(series) ? `Gains : jusqu'à ${formatCredits(series.base)} par victoire sur 10 km (plus sur les courses longues). Rejouable à volonté.` : `Nécessite la licence ${SERIES_LICENCE[series.id]}.`),
      h('div', { class: 'events grid' }, ...TRACKS.map((t, i) => {
        const ev = makeFreeEvent(series, t);
        return h('button', { class: `event-card nav ${unlocked(series) ? '' : 'disabled'} ${i === 0 ? 'default' : ''}`, onclick: () => unlocked(series) && showEventDetail(app, ev, { free: true }) },
          h('div', { class: 'ev-thumb', html: trackThumb(t.id, 120, 80) }),
          h('div', { class: 'ev-main' },
            h('div', { class: 'ev-type' }, `${TIME_LABEL[t.time]} · ${t.closed === false ? 'Côte' : ev.laps + (ev.laps > 1 ? ' tours' : ' tour')}`),
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
  const open = t.closed === false;
  const laps = open ? 1 : FREE_LAPS[t.id] || 3;
  // gains proportionnels à la distance (référence : 10 km)
  const km = open ? 3.3 : (laps * getTrack(t).track.length) / 1000;
  const mul = Math.min(1.8, Math.max(0.6, km / 10));
  const count = open ? 5 : 7;
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
