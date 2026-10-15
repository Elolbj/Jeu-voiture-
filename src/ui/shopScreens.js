// Concession, garage et préparateur.
import { h, btn } from './ui.js';
import { CAR_BY_ID, CATEGORIES, DRIVE_LABEL, TIRES, UPGRADES, UPGRADE_BY_ID, buildSpec, upgradePrice, carLabel } from '../data/cars.js';
import { formatCredits } from '../core/utils.js';
import { currentCar, specOf, addCar, carValue, dealerCars } from '../game/career.js';
import { topBar, showHub } from './menuScreens.js';

function statBar(label, value, max, unit = '') {
  const pct = Math.max(2, Math.min(100, (value / max) * 100));
  return h('div', { class: 'stat' },
    h('div', { class: 'stat-top' }, h('span', {}, label), h('b', {}, `${value}${unit}`)),
    h('div', { class: 'stat-bar' }, h('div', { style: { width: pct + '%' } })),
  );
}

export function specPanel(spec, base = null) {
  const diff = (a, b, unit = '', inv = false) => (base && a !== b ? h('span', { class: `delta ${(a > b) !== inv ? 'up' : 'down'}` }, ` ${a > b ? '+' : ''}${Math.round(a - b)}${unit}`) : null);
  return h('div', { class: 'spec-panel' },
    h('div', { class: 'sp-brand' }, `${spec.brand} · ${spec.country} · ${spec.year}`),
    h('div', { class: 'sp-model' }, spec.model),
    h('div', { class: 'sp-pp' }, h('span', {}, 'PP'), h('b', {}, String(spec.pp)), diff(spec.pp, base?.pp)),
    h('div', { class: 'sp-grid' },
      h('div', {}, h('small', {}, 'Puissance'), h('b', {}, `${spec.engine.hp} ch`), diff(spec.engine.hp, base?.engine.hp, ' ch')),
      h('div', {}, h('small', {}, 'Couple'), h('b', {}, `${spec.engine.torque} N·m`)),
      h('div', {}, h('small', {}, 'Masse'), h('b', {}, `${spec.mass} kg`), diff(spec.mass, base?.mass, ' kg', true)),
      h('div', {}, h('small', {}, 'Transmission'), h('b', {}, spec.drive)),
      h('div', {}, h('small', {}, 'Moteur'), h('b', {}, `${spec.engine.layout} ${spec.engine.displacement.toFixed(1)} L${spec.engine.turbo ? ' turbo' : ''}`)),
      h('div', {}, h('small', {}, 'Pneus'), h('b', {}, TIRES[spec.tires].label)),
    ),
    statBar('Rapport poids/puissance', Math.round((spec.mass / spec.engine.hp) * 10) / 10, 10, ' kg/ch'),
    h('p', { class: 'sp-desc' }, spec.desc),
  );
}

// ------------------------------------------------------------------ Concession
export function showDealer(app, brandSel = null, carSel = null) {
  const p = app.profile;
  const cars = dealerCars(p);
  const brands = [...new Set(cars.map((c) => c.brand))];
  const brand = brandSel || brands[0];
  const list = cars.filter((c) => c.brand === brand);
  const car = carSel ? CAR_BY_ID[carSel] : list[0];
  let color = car.paints[0];
  const spec = buildSpec(car.id);
  app.displayCar(car.id, color);
  app.showroom.offsetX = 0.6;
  const owned = p.cars.filter((o) => o.id === car.id).length;
  const swatches = h('div', { class: 'swatches' }, ...car.paints.map((c, i) => h('button', { class: `swatch nav ${i === 0 ? 'on' : ''}`, style: { background: c }, title: c, onclick: (e) => {
    color = c;
    app.displayCar(car.id, color);
    swatches.querySelectorAll('.swatch').forEach((s) => s.classList.remove('on'));
    e.currentTarget.classList.add('on');
  } })));
  const canBuy = p.credits >= car.price;
  const buy = () => {
    if (!canBuy) return app.ui.toast('Crédits insuffisants', 'bad');
    app.ui.confirm(`Acheter la ${carLabel(car)} ?`, `Prix : ${formatCredits(car.price)}. Vos crédits après achat : ${formatCredits(p.credits - car.price)}.`, () => {
      p.credits -= car.price;
      const o = addCar(p, car.id, color);
      p.currentCar = o.uid;
      app.save();
      app.ui.toast(`${carLabel(car)} ajoutée à votre garage !`, 'good');
      showDealer(app, brand, car.id);
    }, 'Acheter');
  };
  const el = h('div', { class: 'panel-screen side' },
    topBar(app, 'Concession'),
    h('div', { class: 'sidebar' },
      h('h3', {}, 'Marques'),
      h('div', { class: 'seg wrap' }, ...brands.map((b) => h('button', { class: `seg-btn nav ${b === brand ? 'on' : ''}`, onclick: () => showDealer(app, b) }, b))),
      h('h3', {}, 'Modèles'),
      h('div', { class: 'list' }, ...list.map((c) => h('button', { class: `item nav ${c.id === car.id ? 'on default' : ''}`, onclick: () => showDealer(app, brand, c.id) },
        h('b', {}, c.model), h('small', {}, `${CATEGORIES[c.category]} · PP ${buildSpec(c.id).pp} · ${formatCredits(c.price)}`)))),
    ),
    h('div', { class: 'sidebar right' },
      specPanel(spec),
      h('h3', {}, 'Couleur'),
      swatches,
      h('div', { class: 'price' }, formatCredits(car.price)),
      owned ? h('div', { class: 'muted' }, `Vous possédez déjà ${owned} exemplaire${owned > 1 ? 's' : ''}.`) : null,
      btn(canBuy ? 'Acheter' : 'Crédits insuffisants', buy, `primary big ${canBuy ? '' : 'disabled'}`),
    ),
  );
  app.ui.show({ el, back: () => showHub(app) });
}

// ------------------------------------------------------------------ Garage
export function showGarage(app, selUid = null, onPick = null) {
  const p = app.profile;
  const sel = p.cars.find((c) => c.uid === selUid) || currentCar(p);
  if (!sel) return showHub(app);
  const spec = specOf(sel);
  app.displayCar(sel.id, sel.color, sel.upgrades);
  app.showroom.offsetX = 0.6;
  const isCurrent = p.currentCar === sel.uid;
  const sell = () => {
    if (p.cars.length <= 1) return app.ui.toast('Impossible de vendre votre seule voiture', 'bad');
    if (CAR_BY_ID[sel.id].storyOnly) return app.ui.toast('Cette voiture n\'est pas à vendre. Doc ne vous le pardonnerait pas.', 'bad');
    const val = carValue(sel);
    app.ui.confirm(`Vendre la ${carLabel(spec)} ?`, `Vous recevrez ${formatCredits(val)}.`, () => {
      p.credits += val;
      p.cars = p.cars.filter((c) => c !== sel);
      if (p.currentCar === sel.uid) p.currentCar = p.cars[0].uid;
      app.save();
      showGarage(app, null, onPick);
    }, 'Vendre');
  };
  const choose = () => {
    p.currentCar = sel.uid;
    app.save();
    app.ui.toast(`${carLabel(spec)} sélectionnée`, 'good');
    if (onPick) onPick(sel);
    else showGarage(app, sel.uid);
  };
  const el = h('div', { class: 'panel-screen side' },
    topBar(app, 'Garage'),
    h('div', { class: 'sidebar' },
      h('h3', {}, `Vos voitures (${p.cars.length})`),
      h('div', { class: 'list tall' }, ...p.cars.map((c) => {
        const s = specOf(c);
        return h('button', { class: `item nav ${c === sel ? 'on default' : ''}`, onclick: () => showGarage(app, c.uid, onPick) },
          h('span', { class: 'sw', style: { background: c.color } }),
          h('b', {}, carLabel(s)), h('small', {}, `PP ${s.pp} · ${s.engine.hp} ch${c.uid === p.currentCar ? ' · Actuelle' : ''}${c.upgrades.length ? ` · ${c.upgrades.length} amélioration${c.upgrades.length > 1 ? 's' : ''}` : ''}`));
      })),
    ),
    h('div', { class: 'sidebar right' },
      specPanel(spec),
      h('div', { class: 'row' },
        btn(isCurrent && !onPick ? 'Voiture actuelle' : onPick ? 'Choisir pour cette épreuve' : 'Choisir cette voiture', choose, `primary ${isCurrent && !onPick ? 'disabled' : ''}`),
        btn('Préparer', () => showTuning(app, sel.uid)),
        btn(`Vendre (${formatCredits(carValue(sel))})`, sell, 'danger'),
      ),
    ),
  );
  app.ui.show({ el, back: () => (onPick ? onPick(null) : showHub(app)) });
}

// ------------------------------------------------------------------ Préparateur
export function showTuning(app, uid = null) {
  const p = app.profile;
  const sel = p.cars.find((c) => c.uid === uid) || currentCar(p);
  const base = CAR_BY_ID[sel.id];
  const spec = specOf(sel);
  app.displayCar(sel.id, sel.color, sel.upgrades);
  app.showroom.offsetX = 0.6;
  const groups = [...new Set(UPGRADES.map((u) => u.group))];
  const items = [];
  for (const g of groups) {
    items.push(h('h4', {}, g));
    for (const u of UPGRADES.filter((x) => x.group === g)) {
      if (u.turboOnly && !base.engine.turbo) continue;
      const has = sel.upgrades.includes(u.id);
      const locked = u.requires && !sel.upgrades.includes(u.requires);
      const price = upgradePrice(base, u);
      const preview = buildSpec(sel.id, [...sel.upgrades, u.id]);
      const buy = () => {
        if (has) return;
        if (locked) return app.ui.toast(`Nécessite : ${UPGRADE_BY_ID[u.requires].name}`, 'bad');
        if (p.credits < price) return app.ui.toast('Crédits insuffisants', 'bad');
        app.ui.confirm(u.name, `${u.desc}. Prix : ${formatCredits(price)}. PP : ${spec.pp} → ${preview.pp}.`, () => {
          p.credits -= price;
          sel.upgrades.push(u.id);
          app.save();
          app.ui.toast(`${u.name} installé`, 'good');
          showTuning(app, sel.uid);
        }, 'Installer');
      };
      items.push(h('button', { class: `upg nav ${has ? 'has' : ''} ${locked ? 'locked' : ''}`, onclick: buy },
        h('span', { class: 'upg-name' }, u.name),
        h('span', { class: 'upg-desc' }, u.desc),
        h('span', { class: 'upg-price' }, has ? 'Installé' : locked ? 'Verrouillé' : formatCredits(price)),
        !has && !locked ? h('span', { class: 'upg-pp' }, `PP ${preview.pp}`) : null,
      ));
    }
  }
  const el = h('div', { class: 'panel-screen side' },
    topBar(app, 'Préparateur'),
    h('div', { class: 'sidebar wide' },
      h('div', { class: 'row between' },
        h('h3', {}, carLabel(spec)),
        btn('Changer de voiture', () => showGarage(app, sel.uid, (c) => showTuning(app, c ? c.uid : sel.uid))),
      ),
      h('div', { class: 'upg-list' }, ...items),
    ),
    h('div', { class: 'sidebar right' }, specPanel(spec, buildSpec(sel.id))),
  );
  app.ui.show({ el, back: () => showHub(app) });
}

export { DRIVE_LABEL };
