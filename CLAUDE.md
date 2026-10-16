# Trajectoire — notes pour le développement

Jeu de course 3D réaliste façon Gran Turismo, en JavaScript (ES modules) + Three.js 0.186, construit avec Vite.
Tout est procédural : aucun fichier image/son/modèle externe (seules les polices Google Fonts sont chargées).

## Conventions
- Interface, textes du jeu, commentaires de code et messages de commit **en français**.
- Code : ES2022, 2 espaces, guillemets simples, pas de TypeScript, pas de nouvelle dépendance npm.
- Chaque fichier commence par un court commentaire décrivant son rôle. Densité de commentaires modérée, comme le code existant.
- Le jeu final est publié en **fichier unique** (`npm run build` → `dist/trajectoire.html` et `dist/artifact.html`) et tourne dans un
  cadre restreint : pas de `alert/confirm/prompt`, pas de `window.open`, pas de requêtes réseau, `localStorage` toujours dans un `try/catch`,
  le son ne démarre qu'après une interaction. Les CSS peuvent être importées depuis un module JS (`import './x.css'`) : Vite les regroupe.
- Performances : viser 60 i/s sur un portable avec GPU intégré en qualité « moyenne ». Éviter les allocations dans les boucles par image
  (réutiliser des `Vector3` temporaires), limiter les appels de dessin (fusionner / instancier les géométries statiques).

## Architecture
- `src/physics/` : véhicule (240 Hz, pneus, suspensions, transmission, aides), collisions.
- `src/data/` : voitures (`cars.js`, `buildSpec`), circuits (`tracks.js`), histoire (`story.js`), cibles chronométriques générées (`targets.js`).
- `src/world/` : géométrie du circuit (`track.js`), maillages (`trackMesh.js`), terrain, végétation, décors par thème (`scenery.js`), ciel/lumière (`environment.js`), textures procédurales.
- `src/render/` : moteur de rendu + post-traitement (`renderer.js`), modèles de voitures procéduraux (`carModel.js`), studio (`showroom.js`), effets.
- `src/game/` : IA, trajectoire idéale, simulation de course, scène de course, caméras, HUD, ralenti, carrière.
- `src/ui/` : petit framework d'écrans (`ui.js`, fonction `h()`), menus, concession/garage, histoire.
- `src/app.js` : boucle principale, états, lancement des courses.

## Outils de test (Chromium headless avec WebGL logiciel, lent : ~2-5 i/s)
- `node tools/play.mjs "<hash>" "<script>" [w h]` : lance Vite (port propre à la copie de travail) et pilote la page.
  Script = actions séparées par `|` : `wait:ms`, `press:Key`, `down:Key`, `up:Key`, `type:texte`, `click:x,y`, `shot:nom` (→ `tools/scratch/nom.png`), `eval:code`, `evalfile:chemin`.
  Hashes de développement : `#showroom=<carId>&angle=-0.75&h=1.35&dist=5.6&q=haute`,
  `#race=<trackId>&car=<carId>&opp=5&auto&maxdt=0.05&timescale=2&time=night&laps=1` (`auto` = pilote automatique, `norender` = sans rendu).
  `window.__app` expose l'application dans la page.
- `tools/car-shots.sh sortie.png id1 id2 …` : planche avant 3/4, profil, arrière 3/4 de chaque voiture.
- `node tools/file-test.mjs "<script>"` : teste le fichier unique `dist/trajectoire.html` (après `npm run build`).
- `npm test` : tours d'IA sur chaque circuit (simulation sans rendu). `node tools/physics-test.mjs` : mesures physiques (0-100, vitesse max…).
- `node tools/compute-targets.mjs` : recalcule `src/data/targets.js` (temps cibles des permis et contre-la-montre).
- Les fichiers de travail vont dans `tools/scratch/` (ignoré par git). Python 3 + PIL est disponible pour assembler des captures.
- Ne pas utiliser `pkill -f` avec un motif qui correspond à sa propre ligne de commande.
