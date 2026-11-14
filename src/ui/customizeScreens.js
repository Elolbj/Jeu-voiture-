// Atelier : personnalisation (peinture, livrée, jantes, détails) et réglages mécaniques gratuits, aperçu en direct
// dans le studio 3D (caméra orientée selon l'onglet ou l'élément survolé), devis payé à la validation, annulation.
import './customize.css';
import { h, btn } from './ui.js';
import { buildSpec, carLabel } from '../data/cars.js';
import { formatCredits, clamp, wrapAngle } from '../core/utils.js';
import { ownedCar, currentCar } from '../game/career.js';
import { effectiveCustom, LIVERY_DESIGNS, RIM_STYLES, PAINT_FINISHES } from '../render/carModel.js';
import {
  PAINT_COLORS, ACCENT_COLORS, RIM_COLORS, CALIPER_COLORS, PEARL_TINTS, FINISHES, LIVERIES, RIMS, RIM_FINISHES, WINGS, PRICES,
  wingChoices, customCost, randomPlate, priceScale,
} from '../data/customization.js';
import { setupFields, fieldValue, fieldRange, storeValue, applySetup, setupChanges, SETUP_GROUPS } from '../data/setup.js';
import { topBar } from './menuScreens.js';

export const CUSTOMIZE_ICON = '<svg viewBox="0 0 24 24"><path d="M4 4h13v5H4zM17 6.5h3V12h-8.5v3" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="10" y="15" width="3" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

const TABS = [['paint', 'Peinture'], ['livery', 'Livrée'], ['rims', 'Jantes'], ['details', 'Détails'], ['setup', 'Réglages']];
// Vues du studio : orientation du plateau (l'avant du modèle est en -Z), hauteur, distance relative, point visé
const VIEWS = {
  front: { yaw: Math.PI + 0.37, h: 1.5, d: 1.1, ty: 0.55 },
  side: { yaw: -Math.PI / 2 + 0.12, h: 1.15, d: 1.05, ty: 0.55 },
  wheel: { yaw: -Math.PI / 2 - 0.06, h: 0.5, d: 0.82, ty: 0.36 },
  rear: { yaw: 0.4, h: 1.6, d: 1.05, ty: 0.6 },
};
const TAB_VIEW = { paint: 'front', livery: 'side', rims: 'wheel', details: 'rear', setup: 'side' };
const HINTS = {
  paint: 'Aperçu gratuit : vous ne payez qu\'à la validation.',
  livery: 'Motif, couleurs, numéro et autocollants : le numéro s\'affiche aussi sans motif.',
  rims: 'Les jantes changent d\'aspect, pas de dimensions.',
  details: 'Survolez un élément pour orienter la caméra.',
  setup: 'Réglages gratuits, enregistrés avec la voiture et appliqués en course.',
};

// ---------------------------------------------------------------- Couleurs
const eq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
function hexToHsl(hex) {
  const v = parseInt(hex.slice(1), 16);
  const r = ((v >> 16) & 255) / 255, g = ((v >> 8) & 255) / 255, b = (v & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let hh = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    hh = 60 * (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4);
  }
  return [Math.round(hh) % 360, Math.round(s * 100), Math.round(l * 100)];
}
function hslToHex(hh, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + hh / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}
function contrastOf(hex) {
  const v = parseInt(hex.slice(1), 16);
  const l = 0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255);
  return l > 115 ? '#111418' : '#f4f5f2';
}
export function colorName(hex) {
  return PAINT_COLORS.find(([c]) => eq(c, hex))?.[1] || 'Teinte personnalisée';
}

// Personnalisation complète (toujours entière, cf. CarModel.applyCustom) d'une voiture possédée
export function fullCustom(spec, owned) {
  const cu = structuredClone(effectiveCustom(spec, { color: owned.color, custom: owned.custom || undefined }));
  delete cu.sponsorIdx;
  if (!cu.livery) cu.livery = { design: 'none', color: contrastOf(cu.paint.color), color2: null, number: null, sponsors: false };
  return cu;
}

// Résumé de la personnalisation (garage)
export function customSummary(owned) {
  const spec = buildSpec(owned.id, owned.upgrades || []);
  const cu = fullCustom(spec, owned);
  const L = cu.livery;
  const nSet = setupChanges(owned.setup);
  const rows = [
    ['Peinture', h('b', {}, h('i', { style: { background: cu.paint.color } }), `${colorName(cu.paint.color)} · ${FINISHES[cu.paint.finish].label.toLowerCase()}`)],
    ['Livrée', [L.design !== 'none' ? LIVERIES[L.design].label : 'Aucune', L.number !== null ? `n° ${L.number}` : null, L.sponsors ? 'sponsors' : null].filter(Boolean).join(' · ')],
    ['Jantes', `${RIMS[cu.rims.style].label} · ${RIM_FINISHES[cu.rims.finish].label.toLowerCase()}`],
    ['Aileron', WINGS[cu.wing].label],
    ['Plaque', cu.plate],
    ['Réglages', nSet ? `${nSet} réglage${nSet > 1 ? 's' : ''} modifié${nSet > 1 ? 's' : ''}` : 'D\'origine'],
  ];
  return h('div', { class: 'cz-mini' }, ...rows.flatMap(([k, v]) => [h('span', {}, k), typeof v === 'string' ? h('b', {}, v) : v]));
}

const cleanSetup = (s) => Object.fromEntries(Object.entries(s || {}).filter(([k, v]) => setupChanges({ [k]: v })));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------------- Écran
export function showCustomize(app, uid = null, onBack = null, tab = 'paint') {
  const p = app.profile;
  const owned = (uid && ownedCar(p, uid)) || currentCar(p);
  const goBack = onBack || (() => {});
  if (!owned) return goBack();
  const base = buildSpec(owned.id, owned.upgrades || []); // voiture préparée, avant réglages
  const saved = fullCustom(base, owned);
  const savedSetup = cleanSetup(owned.setup);
  const st = {
    tab, view: TAB_VIEW[tab] || 'front', target: 'color',
    custom: structuredClone(saved), setup: { ...savedSetup }, modelSetup: { ...savedSetup },
    dirty: false, applyT: 0,
  };
  const scale = priceScale(base);
  const money = (x) => formatCredits(Math.round((x * scale) / 50) * 50);
  const wings = wingChoices(base);
  const sr = app.showroom;
  const prev = { camAngle: sr.camAngle, camHeight: sr.camHeight, camDist: sr.camDist, offsetX: sr.offsetX, targetY: sr.targetY, autoRotate: sr.autoRotate };
  app.displayCar(owned.id, owned.color, owned.upgrades, owned.custom, savedSetup);
  sr.autoRotate = false;
  const baseDist = 5.2 + base.dims.length * 0.9;
  const cam = { yaw: sr.turntable.rotation.y, angle: sr.camAngle, h: sr.camHeight, d: sr.camDist, ty: sr.targetY, off: sr.offsetX };

  const schedule = () => { st.dirty = true; };
  const preview = () => app.displayCar(owned.id, st.custom.paint.color, owned.upgrades, st.custom, st.modelSetup);

  // ------------------------------------------------ éléments génériques
  const opt = (k, label, price, on, onClick, current = false) => h('button', { class: `cz-opt nav ${on ? 'on' : ''}`, 'data-k': k, onclick: onClick },
    h('b', {}, label),
    current ? h('small', { class: 'free' }, 'Actuel') : price ? h('small', {}, '+' + money(price)) : h('small', { class: 'free' }, 'Gratuit'));
  const seg = (k, options, cur, set) => h('div', { class: 'seg' }, ...options.map(([v, l]) => h('button', { class: `seg-btn nav ${v === cur ? 'on' : ''}`, 'data-k': `${k}:${v}`, onclick: () => set(v) }, l)));
  const range = (k, min, max, value, kstep = 1) => {
    const r = h('input', { type: 'range', class: 'cz-range nav', min, max, step: 1, value, 'data-k': k, 'data-kstep': kstep });
    r.addEventListener('change', () => r.blur());
    return r;
  };
  // Couleurs proposées + teinte / saturation / luminosité ; set(hex, final) (final = faux pendant le glissement)
  const colorPicker = (key, value, presets, set) => {
    let [hh, ss, ll] = hexToHsl(value);
    const sw = h('div', { class: 'cz-swatches' }, ...presets.map((c) => h('button', { class: `swatch nav ${eq(c, value) ? 'on' : ''}`, 'data-k': `${key}:${c}`, style: { background: c }, title: c, onclick: () => set(c, true) })));
    const chipI = h('i', { style: { background: value } }), chipT = h('span', {}, value.toUpperCase());
    const sh = range(`${key}:h`, 0, 359, hh, 8), sS = range(`${key}:s`, 0, 100, ss, 4), sL = range(`${key}:l`, 0, 100, ll, 4);
    const tracks = () => {
      sh.style.background = 'linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)';
      sS.style.background = `linear-gradient(90deg, hsl(${hh},0%,${ll}%), hsl(${hh},100%,${ll}%))`;
      sL.style.background = `linear-gradient(90deg, #000, hsl(${hh},${ss}%,50%), #fff)`;
    };
    tracks();
    const onInput = () => {
      hh = +sh.value; ss = +sS.value; ll = +sL.value;
      const hex = hslToHex(hh, ss, ll);
      tracks();
      chipI.style.background = hex;
      chipT.textContent = hex.toUpperCase();
      sw.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('on', eq(s.title, hex)));
      set(hex, false);
    };
    for (const s of [sh, sS, sL]) s.addEventListener('input', onInput);
    return h('div', {}, sw,
      h('div', { class: 'cz-color' }, h('label', {}, 'Teinte'), sh, h('label', {}, 'Saturation'), sS, h('label', {}, 'Luminosité'), sL),
      h('div', { class: 'cz-chip' }, chipI, chipT));
  };
  const changed = (final) => {
    schedule();
    updateSummary();
    if (final) refresh();
  };

  // ------------------------------------------------ onglets
  const paintTab = () => {
    const c = st.custom.paint;
    return [
      h('h3', {}, 'Couleur', h('small', {}, colorName(c.color))),
      colorPicker('paint', c.color, PAINT_COLORS.map((x) => x[0]), (hex, fin) => { c.color = hex; changed(fin); }),
      h('h3', {}, 'Finition', h('small', {}, 'repeinte comprise')),
      h('div', { class: 'cz-grid three' }, ...PAINT_FINISHES.map((f) => opt(`fin:${f}`, FINISHES[f].label, PRICES.paint + FINISHES[f].price, c.finish === f,
        () => { c.finish = f; if (f === 'pearl' && !c.pearl) c.pearl = PEARL_TINTS[0]; changed(true); }, f === saved.paint.finish && eq(c.color, saved.paint.color)))),
      c.finish === 'pearl' ? h('h3', {}, 'Reflet nacré') : null,
      c.finish === 'pearl' ? h('div', { class: 'cz-swatches' }, ...PEARL_TINTS.map((t) => h('button', { class: `swatch nav ${eq(t, c.pearl) ? 'on' : ''}`, 'data-k': `pearl:${t}`, style: { background: t }, title: t, onclick: () => { c.pearl = t; changed(true); } }))) : null,
    ];
  };

  const liveryTab = () => {
    const L = st.custom.livery;
    const on = L.design !== 'none';
    const tgt = st.target;
    const cur = L[tgt] || (tgt === 'color' ? contrastOf(st.custom.paint.color) : '#d4001a');
    const num = h('small', {}, L.number === null ? 'Aucun' : `n° ${L.number}`);
    const numR = range('number', -1, 99, L.number ?? -1, 1);
    numR.addEventListener('input', () => {
      const v = +numR.value;
      L.number = v < 0 ? null : v;
      num.textContent = L.number === null ? 'Aucun' : `n° ${L.number}`;
      changed(false);
    });
    return [
      h('h3', {}, 'Motif'),
      h('div', { class: 'cz-grid' }, ...LIVERY_DESIGNS.map((d) => opt(`liv:${d}`, LIVERIES[d].label, d === 'none' ? PRICES.liveryOff : LIVERIES[d].price, L.design === d, () => {
        L.design = d;
        if (d !== 'none') {
          L.color = L.color || contrastOf(st.custom.paint.color);
          L.color2 = L.color2 || ACCENT_COLORS.find((x) => !eq(x, L.color) && !eq(x, st.custom.paint.color));
        }
        changed(true);
      }, d === saved.livery.design))),
      on ? h('h3', {}, 'Couleurs du motif') : null,
      on ? seg('livtgt', [['color', 'Principale'], ['color2', 'Secondaire']], tgt, (v) => { st.target = v; refresh(); }) : null,
      on ? h('div', { style: { marginTop: '10px' } }, colorPicker(`liv-${tgt}`, cur, ACCENT_COLORS, (hex, fin) => { L[tgt] = hex; changed(fin); })) : null,
      h('h3', {}, 'Numéro de course', num),
      numR,
      h('h3', {}, 'Autocollants'),
      seg('spons', [[false, 'Sans sponsors'], [true, 'Avec sponsors']], L.sponsors, (v) => { L.sponsors = v; changed(true); }),
    ];
  };

  const rimsTab = () => {
    const R = st.custom.rims;
    return [
      h('h3', {}, 'Modèle'),
      h('div', { class: 'cz-grid' }, ...RIM_STYLES.map((s) => opt(`rim:${s}`, RIMS[s].label, RIMS[s].price + RIM_FINISHES[R.finish].price, R.style === s, () => { R.style = s; changed(true); }, s === saved.rims.style))),
      h('h3', {}, 'Couleur'),
      colorPicker('rimc', R.color, RIM_COLORS, (hex, fin) => { R.color = hex; changed(fin); }),
      h('h3', {}, 'Finition'),
      h('div', { class: 'cz-grid three' }, ...Object.keys(RIM_FINISHES).map((f) => opt(`rimf:${f}`, RIM_FINISHES[f].label, PRICES.rimPaint + RIM_FINISHES[f].price, R.finish === f,
        () => { R.finish = f; changed(true); }, f === saved.rims.finish && R.style === saved.rims.style))),
    ];
  };

  const detailsTab = () => {
    const c = st.custom;
    const tintL = h('small', {}, `${Math.round(c.tint * 100)} %`);
    const tintR = range('tint', 0, 20, Math.round(c.tint * 20), 1);
    tintR.addEventListener('input', () => { c.tint = +tintR.value / 20; tintL.textContent = `${Math.round(c.tint * 100)} %`; changed(false); });
    const plate = h('input', { class: 'text-input nav', maxlength: 9, value: c.plate, 'data-k': 'plate', spellcheck: 'false' });
    plate.addEventListener('click', () => plate.focus());
    plate.addEventListener('input', () => {
      const v = plate.value.toUpperCase().replace(/[^A-Z0-9 -]/g, '').slice(0, 9);
      if (v !== plate.value) plate.value = v;
      c.plate = v || saved.plate;
      changed(false);
    });
    plate.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'Escape') plate.blur(); e.stopPropagation(); });
    plate.addEventListener('blur', () => { plate.value = c.plate; });
    return [
      h('div', { 'data-view': 'wheel' }, h('h3', {}, 'Étriers de frein'), colorPicker('cal', c.caliper, CALIPER_COLORS, (hex, fin) => { c.caliper = hex; changed(fin); })),
      h('div', { 'data-view': 'side' }, h('h3', {}, 'Teinte des vitres', tintL), tintR),
      h('div', { 'data-view': 'rear' }, h('h3', {}, 'Aileron'),
        wings.reason ? h('div', { class: 'cz-note' }, wings.reason)
          : h('div', { class: 'cz-grid' }, ...wings.list.map((w) => opt(`wing:${w}`, WINGS[w].label, WINGS[w].price, c.wing === w, () => { c.wing = w; changed(true); }, w === saved.wing)))),
      h('div', { 'data-view': 'rear' }, h('h3', {}, 'Plaque d\'immatriculation', h('small', {}, '+' + money(PRICES.plate))),
        h('div', { class: 'cz-plate' }, plate, btn('Aléatoire', () => { c.plate = randomPlate(); changed(true); }))),
    ];
  };

  const setupTab = () => {
    const fields = setupFields(base);
    const ups = [];
    const pp = h('span', { class: 'cz-pp' });
    const refreshValues = () => {
      const spec = applySetup(buildSpec(owned.id, owned.upgrades || []), st.setup);
      pp.replaceChildren(`PP ${spec.pp}`, spec.pp !== base.pp ? h('span', { class: `delta ${spec.pp > base.pp ? 'up' : 'down'}` }, ` (origine ${base.pp})`) : '');
      for (const u of ups) u(spec);
    };
    const row = (f) => {
      const b = f.base(base);
      const [lo, hi] = fieldRange(f, base);
      const n0 = -Math.floor((b - lo) / f.step + 1e-6), n1 = Math.floor((hi - b) / f.step + 1e-6);
      const inv = f.invert ? -1 : 1;
      const min = inv > 0 ? n0 : -n1, max = inv > 0 ? n1 : -n0;
      const n = Math.round((fieldValue(f, base, st.setup) - b) / f.step);
      const r = range(`set:${f.id}`, min, max, n * inv, 1);
      r.dataset.hint = f.hint || '';
      const val = h('b'), info = h('em');
      ups.push((spec) => {
        const v = fieldValue(f, base, st.setup);
        val.textContent = f.fmt(v, spec);
        val.classList.toggle('mod', Math.abs(v - b) > 1e-9);
        info.textContent = f.info ? f.info(v, spec) : '';
      });
      r.addEventListener('input', () => {
        const k = +r.value * inv;
        const v = k === 0 ? b : clamp(b + k * f.step, lo, hi);
        const s = storeValue(f, base, v);
        if (setupChanges({ [f.id]: s })) st.setup[f.id] = s;
        else delete st.setup[f.id];
        refreshValues();
        updateSummary();
      });
      if (f.id === 'ride') r.addEventListener('change', () => { st.modelSetup = { ...st.setup }; schedule(); });
      const pct = ((0 - min) / Math.max(1, max - min)) * 100;
      return h('div', { class: 'cz-set' },
        h('div', { class: 'cz-set-top' }, h('span', {}, f.label), val),
        h('div', { class: 'cz-track' }, r, h('div', { class: 'cz-origin', style: { left: `calc(9px + (100% - 18px) * ${pct / 100})` }, title: 'Valeur d\'origine' })),
        h('div', { class: 'cz-set-bot' }, h('span', {}, f.ends?.[0] || ''), info, h('span', {}, f.ends?.[1] || '')));
    };
    const out = [
      h('div', { class: 'cz-row' }, pp, btn('Valeurs d\'origine', () => { st.setup = {}; st.modelSetup = {}; schedule(); updateSummary(); refresh(); }, 'small')),
    ];
    for (const g of SETUP_GROUPS) {
      const fs = fields.filter((f) => f.group === g);
      if (!fs.length) continue;
      out.push(h('h3', {}, g), ...fs.map(row));
    }
    if (!fields.some((f) => f.group === 'Aérodynamique')) out.push(h('p', { class: 'cz-note' }, 'Appui aérodynamique réglable avec un aileron : installez le kit aéro au préparateur.'));
    if (!fields.some((f) => f.id === 'lsd')) out.push(h('p', { class: 'cz-note' }, 'Différentiel ouvert : le tarage se règle une fois l\'autobloquant installé.'));
    refreshValues();
    return out;
  };

  const TAB_BUILD = { paint: paintTab, livery: liveryTab, rims: rimsTab, details: detailsTab, setup: setupTab };

  // ------------------------------------------------ structure
  const tabsEl = h('div', { class: 'cz-tabs' });
  const body = h('div', { class: 'cz-body' });
  const hint = h('div', { class: 'cz-hint' });
  const sumLines = h('div', { class: 'cz-lines' });
  const sumTotal = h('b');
  const sumAfter = h('div', { class: 'cz-after' });
  const okBtn = btn('Valider', () => validate(), 'primary');
  const renderTabs = () => {
    tabsEl.replaceChildren(...TABS.map(([id, label]) => h('button', { class: `cz-tab nav ${id === st.tab ? 'on default' : ''}`, 'data-k': `tab:${id}`, onclick: () => setTab(id) }, label)));
  };
  const renderBody = () => {
    body.replaceChildren(...TAB_BUILD[st.tab]().flat().filter(Boolean));
    hint.textContent = HINTS[st.tab];
  };
  const refresh = () => {
    const f = app.ui.focused;
    const k = f?.dataset?.k;
    const inBody = !!f && body.contains(f);
    const scrollTop = body.scrollTop;
    renderBody();
    body.scrollTop = scrollTop;
    if (inBody) {
      const again = body.querySelector(`[data-k="${CSS.escape(k)}"]`) || body.querySelector('.nav');
      if (again) app.ui.focus(again, false);
    }
  };
  const setTab = (id) => {
    st.tab = id;
    st.view = TAB_VIEW[id];
    renderTabs();
    renderBody();
    body.scrollTop = 0;
    const t = tabsEl.querySelector(`[data-k="tab:${id}"]`);
    if (t) app.ui.focus(t, false);
  };
  const switchTab = (dir) => {
    const i = TABS.findIndex(([id]) => id === st.tab);
    setTab(TABS[(i + dir + TABS.length) % TABS.length][0]);
  };

  const setupDirty = () => !same(cleanSetup(st.setup), savedSetup);
  const lookDirty = () => !same(st.custom, saved);
  const hasChanges = () => lookDirty() || setupDirty();
  function updateSummary() {
    const cost = customCost(base, saved, st.custom);
    const lines = cost.lines.map((l) => h('div', {}, h('span', {}, l.label), h('b', {}, formatCredits(l.price))));
    if (setupDirty()) lines.push(h('div', {}, h('span', {}, 'Réglages mécaniques'), h('b', {}, 'Gratuit')));
    if (!lines.length) lines.push(h('div', {}, h('span', {}, lookDirty() ? 'Modifications gratuites' : 'Aucune modification')));
    sumLines.replaceChildren(...lines);
    sumTotal.textContent = formatCredits(cost.total);
    const left = p.credits - cost.total;
    sumAfter.textContent = `Crédits : ${formatCredits(p.credits)} → ${formatCredits(left)}`;
    sumAfter.classList.toggle('bad', left < 0);
    okBtn.textContent = cost.total ? 'Payer' : 'Valider';
    okBtn.classList.toggle('disabled', left < 0);
  }

  const leave = () => {
    Object.assign(sr, prev);
    goBack();
  };
  const validate = () => {
    if (!hasChanges()) return leave();
    const cost = customCost(base, saved, st.custom);
    if (cost.total > p.credits) return app.ui.toast('Crédits insuffisants', 'bad');
    const commit = () => {
      p.credits -= cost.total;
      if (lookDirty()) {
        owned.custom = structuredClone(st.custom);
        owned.color = st.custom.paint.color;
      }
      const s = cleanSetup(st.setup);
      if (Object.keys(s).length) owned.setup = s;
      else delete owned.setup;
      app.save();
      app.displayCar(owned.id, owned.color, owned.upgrades, owned.custom, owned.setup);
      app.ui.toast(cost.total ? `Atelier : ${formatCredits(cost.total)} réglés, modifications enregistrées` : 'Modifications enregistrées', 'good');
      leave();
    };
    if (!cost.total) return commit();
    app.ui.confirm('Valider les modifications ?', `${cost.lines.length} prestation${cost.lines.length > 1 ? 's' : ''} pour ${formatCredits(cost.total)} — crédits après paiement : ${formatCredits(p.credits - cost.total)}`, commit, 'Payer');
  };
  const restore = () => {
    st.custom = structuredClone(saved);
    st.setup = { ...savedSetup };
    st.modelSetup = { ...savedSetup };
    schedule();
    updateSummary();
    refresh();
  };
  const cancel = () => {
    const quit = () => {
      app.displayCar(owned.id, owned.color, owned.upgrades, owned.custom, owned.setup);
      leave();
    };
    if (!hasChanges()) return quit();
    app.ui.confirm('Abandonner les modifications ?', 'La voiture retrouve son apparence et ses réglages enregistrés. Rien ne vous sera facturé.', quit, 'Abandonner', 'Continuer');
  };

  renderTabs();
  renderBody();
  updateSummary();
  const el = h('div', { class: 'panel-screen cz-screen' },
    topBar(app, 'Atelier'),
    h('div', { class: 'cz-panel' },
      h('div', { class: 'cz-head' },
        h('div', { class: 'cz-car' }, h('small', {}, `${base.brand} · ${base.year}`), base.model),
        tabsEl),
      body,
      hint),
    h('div', { class: 'cz-summary' },
      h('h3', {}, 'Devis'),
      sumLines,
      h('div', { class: 'cz-total' }, h('span', {}, 'Total'), sumTotal),
      sumAfter,
      h('div', { class: 'row' }, okBtn, btn('Rétablir', restore), btn('Annuler', cancel))),
  );
  app.ui.show({
    el,
    back: cancel,
    update(dt) {
      const inp = app.input;
      if (inp.padEdges?.has('shiftUp') || inp.edges.has('KeyE')) switchTab(1);
      else if (inp.padEdges?.has('shiftDown') || inp.edges.has('KeyQ')) switchTab(-1);
      // aperçu en direct, limité à une douzaine de mises à jour par seconde
      st.applyT -= dt;
      if (st.dirty && st.applyT <= 0) {
        st.dirty = false;
        st.applyT = 0.08;
        preview();
      }
      // caméra : approche douce de la vue demandée
      const v = VIEWS[st.view] || VIEWS.front;
      const k = 1 - Math.exp(-4 * Math.min(dt, 0.1));
      cam.yaw += wrapAngle(v.yaw - cam.yaw) * k;
      cam.angle += wrapAngle(Math.PI / 2 - cam.angle) * k;
      cam.h += (v.h - cam.h) * k;
      cam.d += (baseDist * v.d - cam.d) * k;
      cam.ty += (v.ty - cam.ty) * k;
      cam.off += (-0.33 * baseDist * v.d - cam.off) * k;
      sr.turntable.rotation.y = cam.yaw;
      Object.assign(sr, { camAngle: cam.angle, camHeight: cam.h, camDist: cam.d, targetY: cam.ty, offsetX: cam.off });
    },
    onArrow(dx, dy, f) {
      if (!dx || !f?.matches?.('input[type=range]')) return false;
      const v = clamp(+f.value + dx * (+f.dataset.kstep || 1), +f.min, +f.max);
      if (v !== +f.value) {
        f.value = v;
        f.dispatchEvent(new Event('input'));
        f.dispatchEvent(new Event('change'));
      }
      return true;
    },
    onFocus(e) {
      const sec = e.closest?.('[data-view]');
      if (body.contains(e)) st.view = sec?.dataset.view || TAB_VIEW[st.tab];
      hint.textContent = e.dataset?.hint || HINTS[st.tab];
    },
  });
}
