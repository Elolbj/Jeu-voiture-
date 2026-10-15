// Mode histoire : personnages, dialogues, chapitres, épreuves, permis.
// {nom} est remplacé par le nom du joueur.

export const CHARACTERS = {
  doc: { name: 'Marc « Doc » Delaunay', role: 'Mentor, ancien pilote d\'endurance', color: '#c9a74a', skin: '#e2b896', hair: '#d9d9d9', hairStyle: 'short', beard: true, clothes: '#34495e', glasses: true },
  ines: { name: 'Inès Moreau', role: 'Ingénieure de course', color: '#3d8bff', skin: '#c99a76', hair: '#2a1c14', hairStyle: 'bun', clothes: '#1d3f8f' },
  viktor: { name: 'Viktor Sorel', role: 'Pilote, Sorel Motorsport', color: '#ff3b3b', skin: '#f0cfb2', hair: '#e8c46a', hairStyle: 'slick', clothes: '#b3121b' },
  antoine: { name: 'Antoine Sorel', role: 'Patron de Sorel Motorsport', color: '#8d98aa', skin: '#e8c3a4', hair: '#6d6d6d', hairStyle: 'side', clothes: '#22252b', tie: true },
  lucie: { name: 'Lucie Ferrand', role: 'Journaliste, Auto Hebdo', color: '#2ee59d', skin: '#8a5a3c', hair: '#141010', hairStyle: 'long', clothes: '#2f7a5a' },
  speaker: { name: 'Speaker du circuit', role: '', color: '#ffb627', skin: '#d8a982', hair: '#3a2a1c', hairStyle: 'short', clothes: '#444', headset: true },
  player: { name: '{nom}', role: 'Pilote', color: '#ffffff', skin: '#d9a982', hair: '#3b2a20', hairStyle: 'short', clothes: '#0b1f3a' },
};

// Dialogues : listes de répliques { who, text } ou { choice: [{ text, next: [...] }] }
export const DIALOGS = {
  prologue: [
    { who: 'doc', text: "Alors c'est toi, {nom} ? Le gamin qui traîne depuis des semaines autour du circuit des Collines avec les yeux qui brillent ?" },
    { who: 'player', text: "On m'a dit que le Garage Delaunay cherchait quelqu'un. Je ne demande pas grand-chose : juste une chance de piloter." },
    { who: 'doc', text: "Une chance… Tout le monde veut une chance. Moi, j'ai couru vingt ans en endurance. J'ai même failli gagner Le Mans, en 98." },
    { who: 'doc', text: "Failli. C'est le mot le plus cruel du sport automobile. Retiens-le." },
    { who: 'doc', text: "Au fond de l'atelier, il y a une vieille Kaze R3. 118 chevaux, une boîte qui craque en troisième, mais un châssis honnête. Elle est à toi." },
    { who: 'player', text: "Vous… vous me la donnez ?" },
    { who: 'doc', text: "Je te la prête, disons. Le jour où tu gagneras une vraie course, on en reparlera. Mais avant tout, il te faut ta Licence Nationale B." },
    { who: 'doc', text: "Trois épreuves : démarrer et s'arrêter pile où il faut, passer un virage proprement, boucler un tour. La base. Sans la base, rien ne tient." },
    { who: 'doc', text: "Et écoute-moi bien : la vitesse vient de la régularité. Pas l'inverse." },
  ],
  prologue_done: [
    { who: 'doc', text: "Licence B en poche. Pas mal, pour un débutant. Pas mal du tout." },
    { who: 'doc', text: "Dimanche, il y a la Coupe du Club aux Collines. Des amateurs, des passionnés… et quelques fils à papa. On y va." },
  ],
  c1_intro: [
    { who: 'speaker', text: "Bienvenue au Circuit des Collines pour la Coupe du Dimanche ! Belle affluence aujourd'hui, le soleil est de la partie !" },
    { who: 'viktor', text: "Tiens, tiens. Une Kaze R3 de 1998 ? Tu l'as trouvée dans une décharge ?" },
    { who: 'player', text: "On verra bien sur la piste ce qu'elle vaut." },
    { who: 'viktor', text: "Viktor Sorel. Retiens ce nom, tu le verras souvent… dans tes rétroviseurs. Enfin, pas longtemps." },
    { who: 'doc', text: "Laisse-le parler. Les Sorel ont toujours eu la bouche plus rapide que les pieds. Concentre-toi sur tes points de freinage." },
  ],
  c1_mid: [
    { who: 'doc', text: "Le Trophée Régional, maintenant. Plus de tours, plus de concurrents, et le petit Sorel au volant d'une Hoshi Civica préparée." },
    { who: 'doc', text: "Il est rapide, mais il pilote avec son ego. Mets-lui la pression en fin de course : il fera une erreur." },
  ],
  c1_outro: [
    { who: 'speaker', text: "Incroyable ! Un nouveau venu au volant d'une vieille Kaze s'impose au Trophée Régional ! Le public est debout !" },
    { who: 'viktor', text: "C'était… de la chance. Mon différentiel a lâché. La prochaine fois, je t'écrase." },
    { who: 'antoine', text: "Viktor, ça suffit. Monte dans la voiture." },
    { who: 'antoine', text: "Marc Delaunay… Je te croyais à la retraite. Tu ressors tes vieux fantômes ?" },
    { who: 'doc', text: "Bonjour Antoine. Toujours aussi aimable. Je forme un pilote, c'est tout." },
    { who: 'antoine', text: "Un pilote. Comme en 98 ? On sait tous comment ça s'est terminé." },
    { who: 'player', text: "Doc… qui était cet homme ?" },
    { who: 'doc', text: "Une vieille histoire. Pas aujourd'hui, petit. Pas aujourd'hui." },
    { who: 'ines', text: "Excusez-moi… Inès Moreau. J'étais ingénieure chez Sorel Motorsport jusqu'au mois dernier. J'ai vu ta course, {nom}." },
    { who: 'ines', text: "Tu as freiné plus tard que tout le monde au virage 1, à chaque tour, au centimètre. Ça ne s'apprend pas. Je veux travailler avec vous." },
    { who: 'doc', text: "Une transfuge de chez Sorel ? … Bon. On a besoin de quelqu'un qui sait lire une télémétrie. Bienvenue au garage." },
  ],
  c2_intro: [
    { who: 'ines', text: "Prochaine étape : la Corniche, sur la Côte d'Azur. Un circuit étroit, accroché aux falaises. Les courses s'y disputent au coucher du soleil." },
    { who: 'ines', text: "Ta Kaze R3 a fait son temps. Il te faut une vraie sportive : Kaze 86, Miyabi Roadster… et une préparation adaptée. Passe à la concession et chez le préparateur." },
    { who: 'ines', text: "Il te faudra aussi la Licence Nationale A. Les vitesses montent, les erreurs coûtent plus cher." },
    { who: 'doc', text: "Et n'oublie pas : une voiture bien réglée vaut mieux que cent chevaux de plus." },
  ],
  c2_duel: [
    { who: 'viktor', text: "Alors comme ça tu as gagné à la Riviera ? Avec une voiture que tu ne mérites pas." },
    { who: 'viktor', text: "Je te propose un duel. Toi et moi, trois tours, au crépuscule. Si je gagne, tu quittes le circuit. Pour de bon." },
    { choice: [
      { text: "J'accepte. Et si je gagne, tu arrêtes de parler.", next: [{ who: 'viktor', text: "Marché conclu. Profite de tes derniers tours." }] },
      { text: "Je n'ai rien à te prouver… mais je ne fuis jamais un duel.", next: [{ who: 'viktor', text: "Belles paroles. On verra si tes freins sont aussi courageux que toi." }] },
    ] },
    { who: 'ines', text: "Sa Raijin Evo est une quatre roues motrices turbo. Il va te lâcher en sortie de virage lent. Reprends-le au freinage et dans les courbes rapides." },
  ],
  c2_outro: [
    { who: 'lucie', text: "Lucie Ferrand, Auto Hebdo. Deux victoires d'affilée dont une devant Viktor Sorel… Les lecteurs veulent savoir qui vous êtes." },
    { who: 'player', text: "Un pilote du Garage Delaunay. C'est tout ce qu'il y a à savoir." },
    { who: 'lucie', text: "Delaunay ? Comme Marc Delaunay, le pilote du prototype DL-98 ? L'abandon du Mans 1998, en tête à deux heures de l'arrivée ?" },
    { who: 'lucie', text: "À l'époque, on a parlé d'une rupture de pompe à essence. D'autres ont parlé… d'autre chose. Son associé de l'époque s'appelait Antoine Sorel." },
    { who: 'doc', text: "Mademoiselle Ferrand, je crois que l'interview est terminée." },
  ],
  c3_intro: [
    { who: 'doc', text: "Le Col de l'Aigle. C'est ici que j'ai appris à conduire, avec la camionnette de mon père. Quatorze épingles, cinq kilomètres, pas le droit à l'erreur." },
    { who: 'doc', text: "Ici, pas de bac à graviers : une glissière, un ravin, et la montagne qui te regarde." },
    { who: 'ines', text: "Sur la course de côte, chaque dixième compte. Ménage les freins dans les épingles, et réaccélère tôt : la pente aide à freiner, pas à relancer." },
  ],
  c3_record: [
    { who: 'doc', text: "En 1985, j'ai signé le record de la montée en voiture de série. Un roadster de rien du tout, 1 tonne, et beaucoup d'inconscience." },
    { who: 'doc', text: "Mon temps n'a jamais été battu dans cette catégorie. Prends le Miyabi Roadster que j'ai préparé, et montre-moi ce que tu vaux." },
  ],
  c3_outro: [
    { who: 'doc', text: "… Tu as battu mon record. Quarante ans. Il aura fallu quarante ans." },
    { who: 'doc', text: "Tu mérites de savoir. Le Mans, 1998. Ma DL-98 menait avec trois tours d'avance. Antoine Sorel était mon associé : son argent, mes plans, notre rêve." },
    { who: 'doc', text: "La nuit d'avant, un constructeur lui a proposé de racheter l'équipe… à condition que la DL-98 ne gagne pas. Je ne l'ai su que des années plus tard." },
    { who: 'doc', text: "À deux heures de l'arrivée, le moteur s'est tu. La pompe à essence, a-t-on dit. Sorel a vendu l'équipe le lendemain. Moi, j'ai tout perdu." },
    { who: 'player', text: "Et la voiture ?" },
    { who: 'doc', text: "La voiture ? … Elle dort sous une bâche, au fond du garage. Depuis vingt-cinq ans, j'y travaille la nuit. Pièce par pièce." },
  ],
  c4_intro: [
    { who: 'ines', text: "Bonne nouvelle : Huile Mistral veut nous sponsoriser ! 30 000 crédits, et ton nom sur les ailes. Le public suit tes courses, {nom}." },
    { who: 'ines', text: "Prochaine étape : Port-Lumière, un circuit urbain nocturne. Catégorie Grand Tourisme. Il te faut une GT et la Licence Internationale A." },
    { who: 'ines', text: "Les murs sont à cinquante centimètres de la piste. La moindre erreur se paie. Et de nuit, les points de freinage se devinent plus qu'ils ne se voient." },
  ],
  c4_offer: [
    { who: 'antoine', text: "{nom}. Asseyez-vous, je vous en prie. Vous avez du talent, beaucoup de talent. Gâché dans un garage de province." },
    { who: 'antoine', text: "Sorel Motorsport vous offre un contrat d'usine. Une GT3, un salaire, une équipe de vingt ingénieurs. Il suffit de signer." },
    { who: 'antoine', text: "Une seule condition : vous ne courrez plus pour Delaunay. Ce vieil homme vit dans le passé." },
    { choice: [
      { text: "Refuser poliment.", next: [{ who: 'player', text: "Merci pour l'offre, monsieur Sorel. Mais je cours pour ceux qui m'ont donné ma chance." }, { who: 'antoine', text: "Comme vous voudrez. Les sentiments n'ont jamais gagné de course." }] },
      { text: "Refuser… sans politesse.", next: [{ who: 'player', text: "Je sais ce que vous avez fait en 98. Gardez votre contrat." }, { who: 'antoine', text: "Vous ne savez rien du tout. Faites attention, {nom}. Les virages de Port-Lumière sont très… durs." }] },
    ] },
  ],
  c4_outro: [
    { who: 'ines', text: "{nom}, regarde ça. J'ai retrouvé les archives de télémétrie de la DL-98 dans les serveurs de Sorel avant de partir." },
    { who: 'ines', text: "La pression d'essence n'a pas chuté progressivement, comme une pompe qui casse. Elle a été coupée net. Par une commande électronique, depuis le stand." },
    { who: 'lucie', text: "Si ces données sont authentiques, c'est la plus grande affaire de l'histoire du Mans. Je publie dès demain." },
    { who: 'viktor', text: "… Je n'étais pas au courant. Je te le jure. Mon père… Peu importe. On règle ça sur la piste. Trophée Trajectoire, à l'Autodrome." },
    { who: 'doc', text: "Alors il est temps. Venez au garage. Tous les deux." },
  ],
  c5_intro: [
    { who: 'doc', text: "Je vous présente la Delaunay DL-98. V12 de six litres, 700 chevaux, une tonne tout mouillé. Elle n'a jamais terminé une course." },
    { who: 'doc', text: "Elle est à toi, {nom}. Termine ce que nous avons commencé." },
    { who: 'ines', text: "Avant la finale, il te faut la Super Licence. Puis les qualifications : ta position sur la grille en dépendra." },
    { who: 'ines', text: "Viktor courra sur l'Aurelia LMP-01 de son père. Plus d'appui que nous, mais notre V12 a plus d'allonge. Tout se jouera dans la grande ligne droite." },
  ],
  c5_final: [
    { who: 'speaker', text: "Mesdames et messieurs, bienvenue à l'Autodrome International pour la finale du Trophée Trajectoire ! Dix voitures, cinq tours, une seule légende !" },
    { who: 'viktor', text: "Pas de coups bas aujourd'hui. Que le meilleur gagne, {nom}." },
    { who: 'doc', text: "Vingt-cinq ans que j'attends ce moment. Ne pense pas à moi. Pense à ton prochain virage. Toujours au prochain virage." },
  ],
  epilogue: [
    { who: 'speaker', text: "La DL-98 franchit la ligne en vainqueur ! Vingt-cinq ans après Le Mans, la Delaunay gagne enfin ! Quelle histoire, quelle course !" },
    { who: 'viktor', text: "Bravo. Vraiment. Tu étais plus rapide aujourd'hui… Je reviendrai. Mais à la loyale, cette fois." },
    { who: 'lucie', text: "Antoine Sorel vient d'annoncer sa démission. La fédération rouvre l'enquête sur Le Mans 1998." },
    { who: 'doc', text: "Tu sais, {nom}… « failli » n'est plus le mot le plus cruel du sport automobile." },
    { who: 'doc', text: "Le plus beau, c'est « encore ». On recommence la saison prochaine ?" },
    { who: 'ines', text: "J'ai déjà quelques idées de réglages." },
  ],
};

// ---------------------------------------------------------------- Pilotes adverses
export const DRIVERS = [
  ['Léa Garnier', 'GAR'], ['Hugo Bernard', 'BER'], ['Yuki Tanaka', 'TAN'], ['Marco Bellini', 'BEL'],
  ['Sofia Alvarez', 'ALV'], ['Tom Becker', 'BEC'], ['Nadia Haddad', 'HAD'], ['Lars Nyberg', 'NYB'],
  ['Chloé Martin', 'MAR'], ['Kenji Mori', 'MOR'], ['Paul Lefèvre', 'LEF'], ['Ana Costa', 'COS'],
  ['Jonas Weber', 'WEB'], ['Emma Dubois', 'DUB'], ['Rafael Ortiz', 'ORT'], ['Mila Novak', 'NOV'],
  ['Idris Benali', 'BEN'], ['Aoife Byrne', 'BYR'], ['Jules Perrin', 'PER'], ['Sven Larsen', 'LAR'],
];

export const RIVAL = { name: 'Viktor Sorel', short: 'SOR', color: '#d4001a' };

// ---------------------------------------------------------------- Permis
// kind : stop (s'arrêter dans la zone), gate (franchir la ligne), lap (tour complet)
export const LICENCES = [
  {
    id: 'B', name: 'Licence Nationale B', short: 'B', color: '#3fbf6a',
    tests: [
      { id: 'B1', title: 'Démarrage et freinage', desc: "Partez arrêté, accélérez puis immobilisez la voiture dans la zone jaune.", track: 'collines', car: 'kaze_r3', kind: 'stop', startS: 300, startSpeed: 0, zone: [600, 620] },
      { id: 'B2', title: 'Premier virage', desc: "Abordez le virage 1 à 100 km/h et franchissez la ligne rouge le plus vite possible sans quitter la piste.", track: 'collines', car: 'kaze_r3', kind: 'gate', startS: 560, startSpeed: 100, endS: 900 },
      { id: 'B3', title: 'Le tour du club', desc: "Bouclez un tour complet du Circuit des Collines, départ lancé. Interdiction de couper les virages.", track: 'collines', car: 'kaze_r3', kind: 'lap', startS: 250, startSpeed: 80 },
    ],
    reward: 3000,
  },
  {
    id: 'A', name: 'Licence Nationale A', short: 'A', color: '#3d8bff',
    tests: [
      { id: 'A1', title: 'Freinage appuyé', desc: "Départ arrêté. Atteignez votre vitesse maximale, puis arrêtez-vous dans la zone.", track: 'corniche', car: 'kaze_86', kind: 'stop', startS: 40, startSpeed: 0, zone: [520, 538] },
      { id: 'A2', title: 'Le serpentin', desc: "Enchaînez les deux gauches de la Corniche, départ lancé à 110 km/h.", track: 'corniche', car: 'kaze_86', kind: 'gate', startS: 940, startSpeed: 110, endS: 1360 },
      { id: 'A3', title: 'Tour de la Corniche', desc: "Un tour complet au coucher du soleil. La falaise ne pardonne rien.", track: 'corniche', car: 'kaze_86', kind: 'lap', startS: 200, startSpeed: 100 },
    ],
    reward: 6000,
  },
  {
    id: 'IA', name: 'Licence Internationale A', short: 'IA', color: '#ffb627',
    tests: [
      { id: 'IA1', title: 'Freinage de nuit', desc: "Départ arrêté, freinage précis entre les murs de Port-Lumière.", track: 'portlumiere', car: 'falco_gtr', kind: 'stop', startS: 20, startSpeed: 0, zone: [585, 603] },
      { id: 'IA2', title: 'La chicane du port', desc: "Lancé à 130 km/h, traversez la chicane du port sans toucher les murs.", track: 'portlumiere', car: 'falco_gtr', kind: 'gate', startS: 1860, startSpeed: 130, endS: 2200 },
      { id: 'IA3', title: 'Tour de Port-Lumière', desc: "Un tour complet du circuit urbain, de nuit.", track: 'portlumiere', car: 'falco_gtr', kind: 'lap', startS: 200, startSpeed: 100 },
    ],
    reward: 10000,
  },
  {
    id: 'S', name: 'Super Licence', short: 'S', color: '#ff3b3b',
    tests: [
      { id: 'S1', title: 'Freinage à haute vitesse', desc: "Lancé à 200 km/h dans la grande ligne droite, arrêtez le prototype dans la zone.", track: 'autodrome', car: 'delaunay_dl98', kind: 'stop', startS: 250, startSpeed: 200, zone: [880, 900] },
      { id: 'S2', title: 'L\'épingle', desc: "Freinage de 250 à 80 km/h dans l'épingle relevée, puis relance.", track: 'autodrome', car: 'delaunay_dl98', kind: 'gate', startS: 1650, startSpeed: 220, endS: 2120 },
      { id: 'S3', title: 'Tour de l\'Autodrome', desc: "Un tour complet de l'Autodrome International au volant de la DL-98.", track: 'autodrome', car: 'delaunay_dl98', kind: 'lap', startS: 400, startSpeed: 160 },
    ],
    reward: 20000,
  },
];

export const LICENCE_BY_ID = Object.fromEntries(LICENCES.map((l) => [l.id, l]));

// ---------------------------------------------------------------- Chapitres et épreuves
// goal : { position: n } (finir dans les n premiers), { medal: 'bronze' } (contre-la-montre), { licence: 'B' }
export const CHAPTERS = [
  {
    id: 0, title: 'Prologue', name: 'Le garage Delaunay', track: 'collines', image: 'collines',
    intro: 'prologue', outro: 'prologue_done',
    events: [
      { id: 'p_licB', type: 'licence', licence: 'B', title: 'Licence Nationale B', desc: 'Les trois épreuves de base pour obtenir le droit de courir.' },
    ],
  },
  {
    id: 1, title: 'Chapitre 1', name: 'Le Club', track: 'collines', image: 'collines',
    intro: 'c1_intro', outro: 'c1_outro',
    events: [
      { id: 'c1_coupe', type: 'race', title: 'Coupe du Dimanche', desc: 'Course de club pour compactes et petites sportives. Une bonne entrée en matière.', track: 'collines', laps: 3, restrict: { ppMax: 330 }, opponents: { count: 6, pool: ['kaze_r3', 'miyabi_rs', 'kaze_r3'], skill: [0.5, 0.7], fit: [0.8, 0.92] }, grid: 'last', prizes: [6000, 4000, 3000, 1800, 1200, 900, 600], goal: { position: 3 } },
      { id: 'c1_chrono', type: 'timetrial', title: 'Défi du chrono', desc: 'Signez le meilleur temps au tour possible en 3 tours. Objectif : médaille de bronze.', track: 'collines', laps: 3, restrict: { ppMax: 330 }, ref: 'kaze_r3', prizes: { gold: 3000, silver: 1800, bronze: 1000 }, goal: { medal: 'bronze' } },
      { id: 'c1_trophee', type: 'race', title: 'Trophée Régional des Collines', desc: 'Le grand rendez-vous régional. Viktor Sorel est au départ.', track: 'collines', laps: 4, restrict: { ppMax: 360 }, opponents: { count: 7, pool: ['valette_sprint', 'miyabi_rs', 'kaze_r3', 'hoshi_civica'], skill: [0.55, 0.74], fit: [0.82, 0.94], rival: { car: 'hoshi_civica', skill: 0.8 } }, grid: 'last', prizes: [12000, 7000, 5000, 3000, 2000, 1500, 1000, 800], goal: { position: 1 }, before: 'c1_mid', requires: ['c1_coupe'] },
    ],
  },
  {
    id: 2, title: 'Chapitre 2', name: 'La Corniche', track: 'corniche', image: 'corniche',
    intro: 'c2_intro', outro: 'c2_outro',
    events: [
      { id: 'c2_licA', type: 'licence', licence: 'A', title: 'Licence Nationale A', desc: 'Freinages appuyés et enchaînements rapides.' },
      { id: 'c2_riviera', type: 'race', title: 'Coupe de la Riviera', desc: 'Sportives jusqu\'à 430 PP sur le ruban de la Corniche, au coucher du soleil.', track: 'corniche', laps: 3, restrict: { ppMax: 430 }, opponents: { count: 7, pool: ['kaze_86', 'miyabi_rs', 'valette_sprint', 'hoshi_civica', 'hoshi_raijin'], skill: [0.62, 0.82] }, grid: 'last', prizes: [15000, 9000, 6000, 4000, 2500, 1800, 1200, 900], goal: { position: 3 }, requires: ['c2_licA'] },
      { id: 'c2_duel', type: 'race', title: 'Duel au crépuscule', desc: 'Toi contre Viktor Sorel. Trois tours. Le perdant quitte le circuit.', track: 'corniche', laps: 3, restrict: { ppMax: 450 }, opponents: { count: 0, rival: { car: 'hoshi_raijin', skill: 0.9, upgrades: ['eng1', 'tire_sport'] } }, grid: 'last', prizes: [20000, 3000], goal: { position: 1 }, before: 'c2_duel', requires: ['c2_riviera'] },
    ],
  },
  {
    id: 3, title: 'Chapitre 3', name: "Le Col de l'Aigle", track: 'col', image: 'col',
    intro: 'c3_intro', outro: 'c3_outro',
    events: [
      { id: 'c3_montee', type: 'timetrial', title: 'Montée historique', desc: 'Contre-la-montre jusqu\'au sommet. Voitures jusqu\'à 480 PP.', track: 'col', laps: 1, restrict: { ppMax: 480 }, ref: 'kaze_86', prizes: { gold: 8000, silver: 5000, bronze: 3000 }, goal: { medal: 'bronze' } },
      { id: 'c3_alpes', type: 'race', title: 'Coupe des Alpes', desc: 'Course de côte en peloton : six voitures, une route étroite, aucune marge.', track: 'col', laps: 1, restrict: { ppMax: 480 }, opponents: { count: 5, pool: ['kaze_86', 'hoshi_raijin', 'miyabi_rs', 'hoshi_civica', 'valette_sprint'], skill: [0.68, 0.85] }, grid: 'last', prizes: [18000, 11000, 7000, 4500, 3000, 2000], goal: { position: 3 } },
      { id: 'c3_record', type: 'timetrial', title: 'Le record de 1985', desc: 'Battez le record de Doc au volant du Miyabi Roadster RS préparé par ses soins.', track: 'col', laps: 1, provided: { car: 'miyabi_rs', upgrades: ['eng1', 'tire_sport', 'susp1'], color: '#0e5a3c' }, ref: 'miyabi_rs', refUpgrades: ['eng1', 'tire_sport', 'susp1'], prizes: { gold: 20000, silver: 12000, bronze: 8000 }, goal: { medal: 'silver' }, before: 'c3_record', requires: ['c3_montee'] },
    ],
  },
  {
    id: 4, title: 'Chapitre 4', name: 'Les Lumières de la Ville', track: 'portlumiere', image: 'portlumiere',
    intro: 'c4_intro', outro: 'c4_outro', bonus: 30000,
    events: [
      { id: 'c4_licIA', type: 'licence', licence: 'IA', title: 'Licence Internationale A', desc: 'Précision chirurgicale entre les murs, de nuit.' },
      { id: 'c4_gpn', type: 'race', title: 'Grand Prix Nocturne', desc: 'Grand Tourisme jusqu\'à 620 PP dans les rues illuminées de Port-Lumière.', track: 'portlumiere', laps: 4, restrict: { ppMax: 620 }, opponents: { count: 7, pool: ['strauss_m3', 'falco_gtr', 'stellan_rs', 'hoshi_raijin', 'vortex_acr'], skill: [0.66, 0.84] }, grid: 'last', prizes: [32000, 19000, 12000, 8000, 5000, 3500, 2500, 1800], goal: { position: 3 }, requires: ['c4_licIA'], after: 'c4_offer' },
      { id: 'c4_endurance', type: 'race', title: 'Les 30 minutes de Port-Lumière', desc: 'Course longue sur 7 tours : régularité et sang-froid. Viktor est là.', track: 'portlumiere', laps: 7, restrict: { ppMax: 620 }, opponents: { count: 9, pool: ['strauss_m3', 'falco_gtr', 'stellan_rs', 'vortex_acr'], skill: [0.7, 0.86], rival: { car: 'stellan_rs', skill: 0.92, upgrades: ['eng1'] } }, grid: 'last', prizes: [45000, 26000, 17000, 11000, 8000, 6000, 4000, 3000, 2000, 1500], goal: { position: 1 }, requires: ['c4_gpn'] },
    ],
  },
  {
    id: 5, title: 'Chapitre 5', name: 'Le Grand Prix', track: 'autodrome', image: 'autodrome',
    intro: 'c5_intro', outro: 'epilogue', giftCar: { car: 'delaunay_dl98', color: '#0b2e6b' },
    events: [
      { id: 'c5_licS', type: 'licence', licence: 'S', title: 'Super Licence', desc: 'Les épreuves ultimes, au volant de la DL-98.' },
      { id: 'c5_qualif', type: 'timetrial', title: 'Qualifications', desc: 'Deux tours lancés pour la grille de la finale : or = pole position, argent = 3e, bronze = 5e.', track: 'autodrome', laps: 2, restrict: { carId: 'delaunay_dl98' }, ref: 'delaunay_dl98', prizes: { gold: 15000, silver: 10000, bronze: 6000 }, goal: { medal: 'bronze' }, requires: ['c5_licS'] },
      { id: 'c5_finale', type: 'race', title: 'Trophée Trajectoire — Finale', desc: 'La finale : GT3, prototypes et Viktor Sorel sur l\'Aurelia LMP-01. Cinq tours pour l\'histoire.', track: 'autodrome', laps: 5, restrict: { carId: 'delaunay_dl98' }, opponents: { count: 9, pool: ['falco_gt3', 'falco_gt3', 'falco_gt3', 'aurelia_lmp'], skill: [0.72, 0.86], rival: { car: 'aurelia_lmp', skill: 0.92 } }, grid: 'qualif', prizes: [100000, 50000, 30000, 18000, 12000, 9000, 7000, 5000, 4000, 3000], goal: { position: 1 }, before: 'c5_final', requires: ['c5_qualif'] },
    ],
  },
];

export const ALL_EVENTS = CHAPTERS.flatMap((c) => c.events.map((e) => ({ ...e, chapter: c.id })));
export const EVENT_BY_ID = Object.fromEntries(ALL_EVENTS.map((e) => [e.id, e]));

// ---------------------------------------------------------------- Courses à la carte (hors histoire)
export const FREE_SERIES = [
  { id: 'f_compact', title: 'Coupe des Compactes', ppMax: 360, pool: ['kaze_r3', 'valette_sprint', 'hoshi_civica'], skill: [0.6, 0.8], base: 5000 },
  { id: 'f_sport', title: 'Challenge Sport', ppMax: 450, pool: ['kaze_86', 'miyabi_rs', 'hoshi_raijin', 'valette_sprint'], skill: [0.65, 0.85], base: 9000 },
  { id: 'f_gt', title: 'Série Grand Tourisme', ppMax: 620, pool: ['strauss_m3', 'falco_gtr', 'stellan_rs', 'vortex_acr'], skill: [0.7, 0.88], base: 18000 },
  { id: 'f_super', title: 'Supercar Masters', ppMax: 800, pool: ['aurelia_tempesta', 'vortex_acr', 'stellan_rs', 'falco_gt3'], skill: [0.74, 0.9], base: 35000 },
  { id: 'f_proto', title: 'Endurance Prototypes', ppMax: 1300, pool: ['aurelia_lmp', 'falco_gt3', 'aurelia_tempesta'], skill: [0.78, 0.94], base: 60000 },
];

export function fillName(text, name) {
  return text.replaceAll('{nom}', name || 'Pilote');
}
