# TRAJECTOIRE — simulation de course automobile 3D

Jeu de course réaliste dans l'esprit de *Gran Turismo*, jouable dans le navigateur, avec un
**mode histoire** complet, une concession, un garage, un préparateur, des permis et des
courses à la carte. Tout (voitures, circuits, décors, sons, musique) est généré
procéduralement : aucun fichier externe n'est nécessaire.

## Lancer le jeu

```bash
npm install
npm run dev        # puis ouvrir http://localhost:5173
```

Version autonome (un seul fichier HTML, jouable hors ligne) :

```bash
npm run build      # produit dist/index.html et dist/trajectoire.html (fichier unique)
```

Ouvrez `dist/trajectoire.html` directement dans Chrome, Edge ou Firefox.
Un GPU dédié est recommandé ; baissez la qualité dans *Options* si besoin.

## Commandes

| Action | Clavier | Manette |
|---|---|---|
| Accélérer | ↑ ou Z (W en QWERTY) | RT |
| Freiner / marche arrière | ↓ ou S | LT |
| Diriger | ← → ou Q / D | Stick gauche |
| Frein à main | Espace | A |
| Rapport + / − (boîte manuelle) | Maj / Ctrl (ou E / A) | RB / LB |
| Changer de caméra | C | Y |
| Regarder derrière | X | B |
| Replacer la voiture | R | Select |
| Pause | Échap / P | Start |
| Masquer l'interface | H | — |

## Le mode histoire

Vous arrivez au **Garage Delaunay**, à Beaune. Marc « Doc » Delaunay, ancien pilote
d'endurance privé de victoire au Mans en 1998, vous confie une vieille Kaze R3.
Licences, courses de club, duels au crépuscule sur la Corniche, course de côte dans les
Alpes, Grand Prix nocturne en ville… jusqu'à la finale du Trophée Trajectoire où vous
piloterez le prototype restauré de Doc face à Viktor Sorel.

- **Prologue** — Le garage Delaunay (Licence B)
- **Chapitre 1** — Le Club (Circuit des Collines)
- **Chapitre 2** — La Corniche (Côte d'Azur, coucher de soleil)
- **Chapitre 3** — Le Col de l'Aigle (course de côte en montagne)
- **Chapitre 4** — Les Lumières de la Ville (circuit urbain de nuit)
- **Chapitre 5** — Le Grand Prix (Autodrome International)

## Ce qui est simulé

- **Physique** : corps rigide 6 degrés de liberté, quatre suspensions (ressorts,
  amortisseurs, barres antiroulis, butées), pneus à glissement combiné avec sensibilité
  à la charge, transfert de masse, moteur avec courbe de couple réelle, turbo avec
  temps de réponse, embrayage, boîte de vitesses, différentiels autobloquants,
  transmission intégrale, aérodynamique (traînée et appui), surfaces (asphalte,
  vibreurs, herbe, graviers), ABS, antipatinage et contrôle de stabilité désactivables.
- **14 voitures** fictives aux caractéristiques réalistes (citadines, sportives, GT,
  supercar, GT3, prototypes), indice de performance « PP », 17 améliorations.
- **5 circuits** : tracés avec raccordements progressifs, dénivelé, dévers, bacs à
  graviers, glissières, murs, vibreurs.
- **IA** : trajectoire idéale à courbure minimale, profil de vitesse, dépassements,
  évitement, erreurs de pilotage.
- **Rendu** : ciel physique selon l'heure (jour, matin, après-midi, coucher de soleil,
  nuit étoilée), ombres, reflets d'environnement sur la peinture vernie, bloom,
  traces de pneus, fumée, étincelles, ralentis avec caméras TV.
- **Son** : moteurs synthétisés selon l'architecture (4 cylindres, flat-6, V8, V10, V12),
  turbo, pétarades, pneus, vent, effet Doppler, musique d'ambiance générative.

## Outils de développement

```bash
node tools/physics-test.mjs     # banc d'essai : 0-100, vitesse max, freinage, g latéral
node tools/sim-test.mjs --race  # courses IA complètes sur chaque circuit
node tools/track-preview.mjs    # aperçu des tracés
node tools/compute-targets.mjs  # recalcule les temps des permis et contre-la-montre
```

Accès direct à une course de test : `http://localhost:5173/#race=corniche&car=aurelia_tempesta&opp=7`.
