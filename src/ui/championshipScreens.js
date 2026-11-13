// Écrans des championnats : liste (état, conditions, récompenses), détail (manches, classement
// général, voiture engagée), lancement d'une manche et classement après la manche.
import { h, btn, ICONS } from './ui.js';
import { TRACK_BY_ID, TIME_LABEL } from '../data/tracks.js';
import { CAR_BY_ID, carLabel } from '../data/cars.js';
import { formatCredits } from '../core/utils.js';
import { specOf } from '../game/career.js';
import * as CH from '../game/championship.js';
import { topBar, showHub } from './menuScreens.js';
import { showGarage } from './shopScreens.js';
import './championship.css';

const ord = (n) => (n === 1 ? '1er' : `${n}e`);

export const TROPHY_ICON = '<svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1.5A3.5 3.5 0 0 0 8.5 11M16 6h3v1.5A3.5 3.5 0 0 1 15.5 11M12 13v4M8.5 20h7M10 17h4v3h-4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

// Sous-titre de la tuile de l'accueil
export function champHubSub(p) {
  const run = CH.CHAMPIONSHIPS.find((ch) => { const st = CH.champState(p, ch.id); return st && !st.done && st.round > 0; });
  if (run) return `${run.name} · manche ${CH.champState(p, run.id).round + 1}`;
  const titles = CH.CHAMPIONSHIPS.filter((ch) => CH.champState(p, ch.id)?.titles).length;
  return titles ? `${titles} titre${titles > 1 ? 's' : ''} sur ${CH.CHAMPIONSHIPS.length}` : 'Saisons de plusieurs manches';
}

function rewardText(ch) {
  const gift = ch.giftCar && CAR_BY_ID[ch.giftCar.car];
  return `Titre : ${formatCredits(ch.prize)}${gift ? ` + ${carLabel(gift)}` : ''}`;
}

// ------------------------------------------------------------------ Liste
export function showChampionships(app) {
  const p = app.profile;
  app.state = 'menu';
  app.displayCurrentCar();
  app.showroom.offsetX = 2.4;
  const cards = CH.CHAMPIONSHIPS.map((ch, i) => {
    const un = CH.champUnlocked(p, ch);
    const st = CH.champState(p, ch.id);
    const n = CH.rounds(ch).length;
    const champion = st?.titles > 0;
    return h('button', { class: `event-card champ-card nav ${un ? '' : 'disabled'} ${champion ? 'done' : ''} ${i === 0 ? 'default' : ''}`, onclick: () => un && showChampionship(app, ch.id) },
      h('div', { class: 'ev-num' }, String(ch.level)),
      h('div', { class: 'ev-main' },
        h('div', { class: 'ev-type' }, `Championnat · ${n} manche${n > 1 ? 's' : ''} · ${ch.opponents.count + 1} pilotes`),
        h('div', { class: 'ev-title' }, ch.name),
        h('div', { class: 'ev-desc' }, ch.desc),
        h('div', { class: 'champ-cond' }, CH.conditionsText(ch).join(' · ')),
        h('div', { class: 'champ-reward' }, rewardText(ch)),
      ),
      h('div', { class: 'ev-status' },
        un ? (champion ? h('span', { class: 'ok', html: ICONS.check }) : null) : h('span', { class: 'lock', html: ICONS.lock }),
        h('small', {}, un ? CH.statusText(p, ch) : `Licence ${ch.licence} requise`),
      ),
    );
  });
  const el = h('div', { class: 'panel-screen story' },
    topBar(app, 'Championnats'),
    h('div', { class: 'story-body' },
      h('div', { class: 'sh-title' }, h('small', {}, 'Saison'), h('h1', {}, 'Championnats')),
      h('p', { class: 'muted' }, 'Plusieurs manches, les mêmes adversaires, des points à chaque course (25-18-15-12-10-8-6-4-2-1). Le champion remporte une prime et une voiture.'),
      h('div', { class: 'events' }, ...cards),
    ),
  );
  app.ui.show({ el, back: () => showHub(app) });
}

// ------------------------------------------------------------------ Détail
export function showChampionship(app, id, opts = {}) {
  const p = app.profile;
  const ch = CH.CHAMPIONSHIP_BY_ID[id];
  if (!ch) return showChampionships(app);
  const st = CH.champState(p, id);
  const rs = CH.rounds(ch);
  let owned = opts.owned || CH.pickCar(p, ch);
  const spec = owned ? specOf(owned) : null;
  const elig = CH.champEligibility(ch, spec);
  if (owned) app.displayCar(owned.id, owned.color, owned.upgrades);
  app.showroom.offsetX = 0.2;
  const next = st && !st.done ? st.round : 0;
  const roundsEl = rs.map((r, i) => {
    const def = TRACK_BY_ID[r.track];
    const res = st?.results[i];
    const isNext = (!st || !st.done) && i === next;
    return h('div', { class: `champ-round ${res ? 'done' : ''} ${isNext ? 'next' : ''}` },
      h('div', { class: 'cr-num' }, String(i + 1)),
      h('div', { class: 'cr-main' },
        h('b', {}, def.name),
        h('small', {}, `${TIME_LABEL[r.time || def.time]} · ${CH.WEATHER_LABEL[r.weather] || 'Sec'} · ${r.laps} tour${r.laps > 1 ? 's' : ''}`),
      ),
      h('div', { class: `cr-res ${r.weather === 'pluie' ? 'wet' : ''}` }, res ? `${ord(res.player)} · +${res.points} pts` : isNext ? 'À courir' : r.weather === 'pluie' ? 'Pluie' : ''),
    );
  });
  const table = st ? CH.standings(ch, st, p) : [];
  const started = !!st && st.round > 0 && !st.done;
  const standingsEl = st ? h('table', { class: 'results champ-table' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Pos'), h('th', {}, 'Pilote'), h('th', {}, 'V.'), h('th', {}, 'Pts'))),
    h('tbody', {}, ...table.map((r) => h('tr', { class: r.isPlayer ? 'me' : '' },
      h('td', {}, String(r.position)),
      h('td', {}, h('span', { class: 'sw', style: { background: r.color } }), r.name, h('small', { class: 'car' }, r.car)),
      h('td', {}, r.wins ? String(r.wins) : ''),
      h('td', { class: 'pts' }, String(r.points)),
    ))),
  ) : h('p', { class: 'muted' }, 'Le plateau sera tiré au sort à l\'inscription : les mêmes adversaires vous affronteront à chaque manche.');
  const launch = () => {
    if (!owned) return app.ui.toast('Aucune voiture dans le garage', 'bad');
    if (!elig.ok) return app.ui.toast(elig.reason, 'bad');
    let s = CH.champState(p, id);
    if (!s || s.done) s = CH.startChampionship(p, id);
    app.save();
    launchRound(app, ch, s, owned);
  };
  const restart = () => app.ui.confirm('Recommencer le championnat ?', 'Les points seront remis à zéro et un nouveau plateau sera tiré au sort.', () => {
    CH.startChampionship(p, id);
    app.save();
    showChampionship(app, id, { owned });
  }, 'Recommencer');
  let status = 'Non commencé';
  if (st?.done) status = st.final === 1 ? 'Champion !' : `Terminé · ${ord(st.final)} au général`;
  else if (st) status = `Manche ${st.round + 1} sur ${rs.length}`;
  const el = h('div', { class: 'panel-screen side champ-detail' },
    topBar(app, 'Championnats'),
    h('div', { class: 'sidebar wide' },
      h('div', { class: 'ed-type' }, `Championnat · niveau ${ch.level}`),
      h('h1', {}, ch.name),
      h('p', { class: 'muted' }, ch.desc),
      h('div', { class: 'cond' }, CH.conditionsText(ch).join(' · ')),
      h('div', { class: 'goal-line' }, `${status}${st?.titles ? ` · ${st.titles} titre${st.titles > 1 ? 's' : ''}` : ''}`),
      h('h3', {}, 'Manches'),
      h('div', { class: 'champ-rounds' }, ...roundsEl),
      h('h3', {}, 'Récompenses'),
      h('div', { class: 'prizes' },
        h('div', {}, h('span', {}, 'Titre'), h('em', {}, formatCredits(ch.prize))),
        h('div', {}, h('span', {}, 'Voiture offerte'), h('b', { class: 'gift' }, ch.giftCar ? carLabel(CAR_BY_ID[ch.giftCar.car]) : '—')),
        h('div', {}, h('span', {}, 'Victoire de manche'), h('em', {}, formatCredits(ch.roundPrize))),
      ),
      st?.titles ? h('p', { class: 'muted small' }, 'Titre déjà remporté : prime réduite, voiture déjà offerte.') : null,
    ),
    h('div', { class: 'sidebar right' },
      h('h3', {}, 'Classement général'),
      standingsEl,
      h('h3', {}, 'Votre voiture'),
      spec ? h('div', { class: 'ed-car' }, h('b', {}, carLabel(spec)), h('div', {}, `PP ${spec.pp} · ${spec.engine.hp} ch · ${spec.mass} kg`)) : null,
      h('div', { class: `elig ${elig.ok ? 'ok' : 'ko'}` }, elig.ok ? 'Voiture éligible' : elig.reason),
      btn('Changer de voiture', () => showGarage(app, owned?.uid, (c) => showChampionship(app, id, { owned: c || owned }))),
      btn(st?.done ? 'Nouvelle saison' : `Lancer la manche ${next + 1}`, launch, `primary big default ${elig.ok ? '' : 'disabled'}`),
      started ? btn('Recommencer le championnat', restart, 'danger') : null,
    ),
  );
  app.ui.show({ el, back: () => showChampionships(app) });
}

// ------------------------------------------------------------------ Manche
function launchRound(app, ch, st, owned) {
  const p = app.profile;
  const back = () => showChampionship(app, ch.id);
  const cfg = CH.roundConfig(p, ch, st, owned, back);
  if (!cfg) return back();
  const roundIdx = st.round;
  app.startRace(cfg, (result) => {
    const s = CH.champState(p, ch.id);
    // « Recommencer » depuis l'écran de résultats : la manche est déjà comptée
    if (!s || s.round !== roundIdx || s.done) return { ok: false, message: 'Manche déjà comptabilisée au championnat.', onContinue: back };
    const before = CH.standings(ch, s, p);
    const rec = CH.applyRoundResult(p, ch, result, owned);
    app.save();
    const extra = [`${rec.points} point${rec.points > 1 ? 's' : ''} · ${ord(rec.standing)} au général`];
    if (rec.finished) extra.push(rec.title ? `Champion : ${ch.name} !` : `Championnat terminé : ${ord(rec.standing)} au général`);
    return {
      credits: rec.credits + rec.prize,
      ok: true,
      message: `Manche ${roundIdx + 1} : ${ord(rec.position)}`,
      extra,
      onContinue: () => showRoundStandings(app, ch, before, rec),
    };
  });
}

// ------------------------------------------------------------------ Classement après la manche
export function showRoundStandings(app, ch, before, rec) {
  const p = app.profile;
  const st = CH.champState(p, ch.id);
  const table = CH.standings(ch, st, p);
  const prevPos = Object.fromEntries(before.map((r) => [r.id, r.position]));
  const lastRes = st.results[st.results.length - 1];
  const gained = {};
  lastRes?.order.forEach((id, i) => (gained[id] = CH.POINTS[i] || 0));
  const n = CH.rounds(ch).length;
  const move = (r) => {
    const d = (prevPos[r.id] || r.position) - r.position;
    if (!st.results.length || st.results.length === 1 || d === 0) return h('span', { class: 'mv same' }, '–');
    return h('span', { class: `mv ${d > 0 ? 'up' : 'down'}` }, `${d > 0 ? '▲' : '▼'}${Math.abs(d)}`);
  };
  let head = `Après la manche ${st.results.length}/${n}`;
  let sub = `${ord(rec.position)} de la manche · ${ord(rec.standing)} au général`;
  let cls = '';
  if (rec.finished) {
    head = rec.title ? 'Champion !' : `Classement final : ${ord(rec.standing)}`;
    cls = rec.title ? 'win' : '';
    sub = rec.title ? `Vous remportez le ${ch.name}` : `${ch.name} terminé`;
  }
  const extra = [];
  if (rec.prize) extra.push(h('div', { class: 'gain' }, `+ ${formatCredits(rec.prize)}`));
  if (rec.giftCar) extra.push(h('div', { class: 'goal ok' }, `${carLabel(CAR_BY_ID[rec.giftCar])} ajoutée à votre garage !`));
  const cont = () => showChampionship(app, ch.id);
  const el = h('div', { class: 'results-screen' },
    h('div', { class: 'res-box' },
      h('div', { class: 'res-title' }, ch.name),
      h('div', { class: `res-head ${cls}` }, head),
      h('div', { class: 'res-sub' }, sub),
      ...extra,
      h('table', { class: 'results champ-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Pos'), h('th', {}, ''), h('th', {}, 'Pilote'), h('th', {}, 'Voiture'), h('th', {}, 'Manche'), h('th', {}, 'Victoires'), h('th', {}, 'Points'))),
        h('tbody', {}, ...table.map((r) => h('tr', { class: r.isPlayer ? 'me' : '' },
          h('td', {}, String(r.position)),
          h('td', {}, move(r)),
          h('td', {}, h('span', { class: 'sw', style: { background: r.color } }), r.name),
          h('td', {}, r.car),
          h('td', {}, gained[r.id] ? `+${gained[r.id]}` : ''),
          h('td', {}, r.wins ? String(r.wins) : ''),
          h('td', { class: 'pts' }, String(r.points)),
        ))),
      ),
      h('div', { class: 'row end' }, btn('Continuer', cont, 'primary default')),
    ),
  );
  app.ui.show({ el, back: cont });
}
