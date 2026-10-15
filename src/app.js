// Application : boucle principale, états (menus / course), profil, lancement des épreuves.
import { Renderer } from './render/renderer.js';
import { Showroom } from './render/showroom.js';
import { input } from './core/input.js';
import { initAudio, setVolumes, music } from './core/audio.js';
import { loadProfile, saveProfile, newProfile, DIFFICULTY } from './core/save.js';
import { UI } from './ui/ui.js';
import { RaceScene } from './game/raceScene.js';
import { currentCar, specOf, addCar } from './game/career.js';
import { CAR_BY_ID } from './data/cars.js';
import { TRACK_BY_ID } from './data/tracks.js';
import * as Menus from './ui/menuScreens.js';
import { TouchControls } from './core/touch.js';

export class App {
  constructor() {
    this.viewport = document.getElementById('viewport');
    this.uiRoot = document.getElementById('ui');
    this.profile = loadProfile();
    const settings = this.profile?.settings;
    const devQ = new URLSearchParams(location.hash.slice(1)).get('q');
    this.renderer = new Renderer(this.viewport, devQ || settings?.quality || 'haute');
    this.input = input;
    this.ui = new UI(this.uiRoot, input);
    this.showroom = new Showroom(this.renderer);
    this.touch = new TouchControls(this.uiRoot);
    input.touch = this.touch;
    const devHash = new URLSearchParams(location.hash.slice(1));
    this.noRender = devHash.has('norender');
    // Pause automatique quand la fenêtre perd le focus
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.race && this.race.phase === 'racing' && !this.race.paused) this.race.togglePause();
    });
    this.race = null;
    this.state = 'menu';
    this.last = performance.now();
    this.showroomCarKey = null;
    this.fps = 60;
    // Pas de temps maximal par image (le mode test peut l'augmenter)
    this.maxDt = parseFloat(new URLSearchParams(location.hash.slice(1)).get('maxdt') || '0.1');
    this.timeScale = parseFloat(new URLSearchParams(location.hash.slice(1)).get('timescale') || '1');
  }

  get settings() {
    const s = this.profile ? this.profile.settings : (this._tmpSettings ||= newProfile().settings);
    s.difficultyMul = DIFFICULTY[s.difficulty]?.mul ?? 0.95;
    return s;
  }

  start() {
    Menus.showTitle(this);
    requestAnimationFrame((t) => this.loop(t));
  }

  // Démarre l'audio au premier geste de l'utilisateur
  unlockAudio() {
    initAudio();
    this.applyVolumes();
    if (this.settings.music && this.state === 'menu') music.start();
  }

  applyVolumes() {
    const v = this.settings.volumes;
    setVolumes({ master: v.master, sfx: v.sfx, music: this.settings.music ? v.music : 0 });
  }

  save() {
    if (this.profile) saveProfile(this.profile);
  }

  newGame(name, difficulty) {
    this.profile = newProfile(name);
    this.profile.settings.difficulty = difficulty;
    this.profile.credits = 8000;
    addCar(this.profile, 'kaze_r3', '#c8102e');
    this.profile.story.started = true;
    this.save();
  }

  // Voiture affichée dans la salle d'exposition
  displayCar(id, color, upgrades = []) {
    const key = id + color + upgrades.join(',');
    if (key === this.showroomCarKey) return;
    this.showroomCarKey = key;
    const spec = specOf({ id, upgrades });
    this.showroom.setCar(spec, color);
  }

  displayCurrentCar() {
    const c = this.profile && currentCar(this.profile);
    if (c) this.displayCar(c.id, c.color, c.upgrades);
    else this.displayCar('kaze_86', '#e04e1a');
  }

  loop(t) {
    const dt = Math.min(this.maxDt, (t - this.last) / 1000) * this.timeScale;
    this.last = t;
    this.fps = this.fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
    input.update(dt);
    try {
      if (this.state === 'race' && this.race) {
        this.race.update(dt);
        this.watchPerformance(dt);
        if (this.race.phase === 'results' || this.race.phase === 'replay' || this.race.paused) this.ui.update(dt);
      } else {
        this.ui.update(dt);
        this.showroom.update(dt);
        this.showroom.render();
      }
    } catch (e) {
      console.error(e);
      this.ui.toast('Erreur : ' + e.message, 'bad');
    }
    input.endFrame();
    requestAnimationFrame((tt) => this.loop(tt));
  }

  // ---------------------------------------------------------------- Courses
  // cfg : voir RaceScene ; after(result) appelé à la fin (écran de résultats)
  startRace(cfg, after) {
    this.raceCfg = cfg;
    this.raceAfter = after;
    music.stop();
    const loading = Menus.loadingScreen(this, cfg);
    this.ui.show(loading);
    this.state = 'loading';
    // laisse le navigateur afficher l'écran de chargement
    setTimeout(() => {
      try {
        if (this.race) this.race.destroy();
        const race = new RaceScene(this, cfg);
        race.build();
        this.race = race;
        this.ui.show(null);
        this.state = 'race';
        this.touch.show(true);
        this.perfT = 0;
        this.perfFrames = 0;
        this.perfWarned = false;
        input.captureArrows = true;
      } catch (e) {
        console.error(e);
        this.ui.toast('Impossible de lancer la course : ' + e.message, 'bad');
        this.exitRace();
      }
    }, 60);
  }

  restartRace() {
    const cfg = this.raceCfg, after = this.raceAfter;
    this.ui.popOverlay();
    this.disposeRace();
    this.startRace(cfg, after);
  }

  disposeRace() {
    this.touch.show(false);
    if (this.race) {
      this.race.destroy();
      this.race = null;
    }
  }

  exitRace(nextScreen) {
    this.ui.popOverlay();
    this.disposeRace();
    this.state = 'menu';
    this.showroomCarKey = null;
    this.displayCurrentCar();
    if (this.settings.music) music.start();
    if (nextScreen) nextScreen();
    else Menus.showHub(this);
  }

  // Suggère une qualité plus basse si la fluidité est insuffisante en course
  watchPerformance(dt) {
    if (this.perfWarned || this.race.phase !== 'racing') return;
    this.perfT += dt;
    this.perfFrames++;
    if (this.perfT > 6) {
      const fps = this.perfFrames / this.perfT;
      this.perfT = 0;
      this.perfFrames = 0;
      const order = ['ultra', 'haute', 'moyenne', 'basse'];
      const q = this.settings.quality;
      const i = order.indexOf(q);
      if (fps < 40 && i >= 0 && i < order.length - 1) {
        this.perfWarned = true;
        const next = order[i + 1];
        this.settings.quality = next;
        this.save();
        this.ui.toast(`Fluidité insuffisante (${Math.round(fps)} i/s) : qualité « ${next} » appliquée à la prochaine course.`);
      }
    }
  }

  showPause(paused, race) {
    if (paused) this.ui.pushOverlay(Menus.pauseScreen(this, race));
    else this.ui.popOverlay();
  }

  onRaceFinished(result, race) {
    if (this.profile) {
      this.profile.stats.distance += race.player.vehicle.odometer;
      this.save();
    }
    const after = this.raceAfter;
    const summary = after ? after(result) : null;
    this.ui.show(Menus.resultsScreen(this, result, race, summary));
  }

  onReplayFrame(rp) {
    this.ui.current?.onReplay?.(rp);
  }

  trackName(id) {
    return TRACK_BY_ID[id]?.name || id;
  }

  carName(id) {
    const c = CAR_BY_ID[id];
    return c ? `${c.brand} ${c.model}` : id;
  }
}
