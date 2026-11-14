// Mode histoire : personnages, dialogues, réactions, chapitres, épreuves, permis, séries libres.
// Variables remplacées dans les textes : {nom} (pilote), {voiture} (voiture engagée), {suivante} (prochaine épreuve),
// {position} (classement de la dernière course).

export const CHARACTERS = {
  doc: { name: 'Marc « Doc » Delaunay', role: 'Mentor, ancien pilote d\'endurance', color: '#c9a74a', skin: '#e2b896', hair: '#d9d9d9', hairStyle: 'short', beard: true, clothes: '#34495e', glasses: true },
  ines: { name: 'Inès Moreau', role: 'Ingénieure de course', color: '#3d8bff', skin: '#c99a76', hair: '#2a1c14', hairStyle: 'bun', clothes: '#1d3f8f', earrings: '#d8dde6' },
  viktor: { name: 'Viktor Sorel', role: 'Pilote, Sorel Motorsport', color: '#ff3b3b', skin: '#f0cfb2', hair: '#e8c46a', hairStyle: 'slick', clothes: '#b3121b', suit: '#ffffff' },
  antoine: { name: 'Antoine Sorel', role: 'Patron de Sorel Motorsport', color: '#8d98aa', skin: '#e8c3a4', hair: '#6d6d6d', hairStyle: 'side', clothes: '#22252b', tie: true },
  lucie: { name: 'Lucie Ferrand', role: 'Journaliste, Auto Hebdo', color: '#2ee59d', skin: '#8a5a3c', hair: '#141010', hairStyle: 'long', clothes: '#2f7a5a' },
  gunther: { name: 'Günther Krämer', role: 'Ancien chef mécanicien de la DL-98', color: '#8fc04f', skin: '#eac3a2', hair: '#b4b4b0', hairStyle: 'bald', mustache: true, cap: '#2f4a2c', clothes: '#46523f' },
  aiko: { name: 'Aiko Tachibana', role: 'Pilote d\'usine, Falco Works', color: '#b07cff', skin: '#f0d2b6', hair: '#121318', hairStyle: 'bob', clothes: '#4a2276', suit: '#d4001a', earrings: '#f3c14b' },
  speaker: { name: 'Speaker du circuit', role: '', color: '#ffb627', skin: '#d8a982', hair: '#3a2a1c', hairStyle: 'short', clothes: '#444', headset: true },
  player: { name: '{nom}', role: 'Pilote', color: '#ffffff', skin: '#d9a982', hair: '#3b2a20', hairStyle: 'short', clothes: '#0b1f3a', suit: '#3d8bff' },
};

// Dialogues : listes de répliques { who, text, mood? } ou { choice: [{ text, next: [...] }] }
// mood : 'smile' | 'angry' | 'sad' | 'smirk' (expression du portrait)
export const DIALOGS = {
  // ------------------------------------------------------------ Prologue
  prologue: [
    { who: 'doc', text: "Alors c'est toi, {nom} ? Ça fait des semaines que je te vois traîner autour du circuit des Collines, les yeux qui brillent." },
    { who: 'player', text: "On m'a dit que le Garage Delaunay cherchait quelqu'un. Je ne demande pas grand-chose : juste une chance de piloter." },
    { who: 'doc', text: "Une chance… Tout le monde veut une chance. Moi, j'ai couru vingt ans en endurance. J'ai même failli gagner Le Mans, en 98." },
    { who: 'doc', text: "Failli. C'est le mot le plus cruel du sport automobile. Retiens-le.", mood: 'sad' },
    { who: 'doc', text: "Au fond de l'atelier, il y a une vieille Kaze R3. 118 chevaux, une boîte qui craque en troisième, mais un châssis honnête." },
    { who: 'player', text: "Vous… vous me la donnez ?", mood: 'smile' },
    { who: 'doc', text: "Je te la prête, disons. Le jour où tu gagneras une vraie course, on en reparlera. Mais d'abord, il te faut ta Licence Nationale B." },
    { who: 'doc', text: "Trois épreuves : partir et s'arrêter pile où il faut, passer un virage proprement, boucler un tour. Sans la base, rien ne tient." },
    { who: 'doc', text: "Et écoute-moi bien : la vitesse vient de la régularité. Pas l'inverse." },
  ],
  prologue_done: [
    { who: 'doc', text: "Licence B en poche. Pas mal, pour une première fois. Pas mal du tout.", mood: 'smile' },
    { who: 'doc', text: "Dimanche, il y a la Coupe du Club aux Collines. Des amateurs, des passionnés… et quelques fils à papa. On y va." },
  ],

  // ------------------------------------------------------------ Chapitre 1 : le Club
  c1_intro: [
    { who: 'speaker', text: "Bienvenue au Circuit des Collines pour la Coupe du Dimanche ! Belle affluence aujourd'hui, et le soleil est de la partie !" },
    { who: 'viktor', text: "Tiens, tiens. C'est quoi, ça ? Une {voiture} ? Tu l'as trouvée dans une décharge ?", mood: 'smirk' },
    { who: 'player', text: "On verra bien sur la piste ce qu'elle vaut." },
    { who: 'viktor', text: "Viktor Sorel. Retiens ce nom, tu le verras souvent… dans tes rétroviseurs. Enfin, pas longtemps.", mood: 'smirk' },
    { who: 'doc', text: "Laisse-le parler. Les Sorel ont toujours eu la bouche plus rapide que les pieds. Concentre-toi sur tes points de freinage." },
    { who: 'doc', text: "Et passe voir le préparateur avant le départ : des pneus sport, ce n'est pas du luxe." },
  ],
  c1_coupe_ok: [
    { who: 'doc', text: "Un podium dès ta première course. Ne prends pas la grosse tête : la moitié du plateau roulait avec des pneus de supermarché." },
    { who: 'doc', text: "Mais tu as tenu tes trajectoires du premier au dernier tour. Ça, ça ne s'achète pas.", mood: 'smile' },
  ],
  c1_rain: [
    { who: 'doc', text: "Tu entends ? La pluie sur la tôle. Le meilleur professeur du monde." },
    { who: 'doc', text: "Sous la pluie, tout se joue avant le virage : freine plus tôt, en ligne droite, et ne brusque rien. Ni le volant, ni l'accélérateur." },
    { who: 'player', text: "Et si je glisse ?" },
    { who: 'doc', text: "Tu glisseras. Le tout, c'est de glisser moins que les autres.", mood: 'smirk' },
  ],
  c1_rain_ok: [
    { who: 'doc', text: "Propre. Les autres pataugeaient, toi tu pilotais. Tu commences à me plaire, {nom}.", mood: 'smile' },
  ],
  c1_mid: [
    { who: 'doc', text: "Le Trophée Régional, maintenant. Plus de tours, plus de concurrents, et le petit Sorel au volant d'une Hoshi Civica préparée." },
    { who: 'doc', text: "Il est rapide, mais il pilote avec son ego. Mets-lui la pression en fin de course : il fera une erreur." },
  ],
  c1_trophee_ko: [
    { who: 'viktor', text: "Tu vois ? Une bonne voiture, un bon pilote, un bon nom. Rentre chez toi, {nom}.", mood: 'smirk' },
    { who: 'doc', text: "Ignore-le. Il vient de te montrer où il freine. La prochaine fois, tu freineras deux mètres plus loin." },
  ],
  c1_outro: [
    { who: 'speaker', text: "Incroyable ! {nom}, une recrue du Garage Delaunay, s'impose au Trophée Régional au volant d'une {voiture} ! Le public est debout !" },
    { who: 'viktor', text: "C'était… de la chance. Mon différentiel a lâché. La prochaine fois, je t'écrase.", mood: 'angry' },
    { who: 'antoine', text: "Viktor, ça suffit. Monte dans la voiture." },
    { who: 'antoine', text: "Marc Delaunay… Je te croyais à la retraite. Tu ressors tes vieux fantômes ?" },
    { who: 'doc', text: "Bonjour Antoine. Toujours aussi aimable. Je forme un pilote, c'est tout." },
    { who: 'antoine', text: "Un pilote. Comme en 98 ? On sait tous comment ça s'est terminé.", mood: 'smirk' },
    { who: 'player', text: "Doc… qui était cet homme ?" },
    { who: 'doc', text: "Une vieille histoire. Pas aujourd'hui, {nom}. Pas aujourd'hui.", mood: 'sad' },
    { who: 'ines', text: "Excusez-moi… Inès Moreau. J'étais ingénieure chez Sorel Motorsport jusqu'au mois dernier. J'ai vu ta course, {nom}." },
    { who: 'ines', text: "Tu as freiné plus tard que tout le monde au virage 1, à chaque tour, au mètre près. Ça ne s'apprend pas. Je veux travailler avec vous." },
    { who: 'doc', text: "Une transfuge de chez Sorel ? … Bon. On a besoin de quelqu'un qui sait lire une télémétrie. Bienvenue au garage." },
  ],

  // ------------------------------------------------------------ Chapitre 2 : la Corniche
  c2_intro: [
    { who: 'ines', text: "Prochaine étape : la Corniche, sur la Côte d'Azur. Un ruban étroit accroché aux falaises, et des courses au coucher du soleil." },
    { who: 'ines', text: "Les compactes, c'est fini. Il te faut une vraie sportive : Kaze 86, Hoshi Raijin, Miyabi Roadster… Passe à la concession, puis chez le préparateur." },
    { who: 'ines', text: "Il te faudra aussi la Licence Nationale A. Les vitesses montent, les erreurs coûtent plus cher." },
    { who: 'doc', text: "Et n'oublie pas : une voiture bien réglée vaut mieux que cent chevaux de plus." },
  ],
  c2_minuit: [
    { who: 'doc', text: "Un vieil ami collectionneur organise une course de légendes sur la Corniche. De nuit, phares allumés, comme dans les années 60." },
    { who: 'doc', text: "Il te prête sa Marlin 2000 GT de 1968. 170 chevaux et des pneus fins comme des boyaux de vélo. Respecte-la : elle vaut plus cher que le garage." },
    { who: 'ines', text: "Les Vortex Stallion ont deux fois plus de puissance. Ne les suis pas en ligne droite : c'est dans les virages que la Marlin respire." },
  ],
  c2_minuit_ok: [
    { who: 'doc', text: "Le vieux comte a eu les larmes aux yeux en voyant sa Marlin revenir entière… et sur le podium.", mood: 'smile' },
    { who: 'doc', text: "Il m'a dit : « Ce pilote a des mains d'horloger. » Venant de lui, c'est une décoration." },
  ],
  c2_duel: [
    { who: 'viktor', text: "Alors comme ça, tu t'es fait remarquer à la Riviera ? Avec une voiture que tu ne mérites pas.", mood: 'smirk' },
    { who: 'viktor', text: "Je te propose un duel. Toi et moi, trois tours, au crépuscule. Si je gagne, tu quittes le circuit. Pour de bon." },
    { choice: [
      { text: "J'accepte. Et si je gagne, tu arrêtes de parler.", next: [{ who: 'viktor', text: "Marché conclu. Profite de tes derniers tours.", mood: 'smirk' }] },
      { text: "Je n'ai rien à te prouver… mais je ne fuis jamais un duel.", next: [{ who: 'viktor', text: "Belles paroles. On verra si tes freins sont aussi courageux que toi." }] },
    ] },
    { who: 'ines', text: "Sa Raijin Evo est une quatre roues motrices turbo. Il va te lâcher en sortie de virage lent. Reprends-le au freinage et dans les courbes rapides." },
  ],
  c2_duel_ko: [
    { who: 'viktor', text: "Je t'avais prévenu. Mais je suis beau joueur : reviens quand tu veux, j'adore gagner deux fois.", mood: 'smirk' },
    { who: 'ines', text: "Il t'a repris à chaque sortie d'épingle. Garde de la vitesse au point de corde et il n'aura plus rien à se mettre sous la dent." },
  ],
  c2_outro: [
    { who: 'lucie', text: "Lucie Ferrand, Auto Hebdo. Viktor Sorel battu en duel sur la Corniche… Les lecteurs veulent savoir qui vous êtes, {nom}." },
    { who: 'player', text: "Un pilote du Garage Delaunay. C'est tout ce qu'il y a à savoir." },
    { who: 'lucie', text: "Delaunay ? Comme Marc Delaunay, le pilote du prototype DL-98 ? L'abandon du Mans 1998, en tête à deux heures de l'arrivée ?" },
    { who: 'lucie', text: "À l'époque, on a parlé d'une pompe à essence. D'autres ont parlé… d'autre chose. Son associé s'appelait Antoine Sorel." },
    { who: 'doc', text: "Mademoiselle Ferrand, je crois que l'interview est terminée.", mood: 'angry' },
  ],

  // ------------------------------------------------------------ Chapitre 3 : la montagne
  c3_intro: [
    { who: 'doc', text: "Le Col de l'Aigle. C'est ici que j'ai appris à conduire, dans la camionnette de mon père. Des épingles à n'en plus finir et pas le droit à l'erreur." },
    { who: 'doc', text: "Ici, pas de bac à graviers : une glissière, un ravin, et la montagne qui te regarde." },
    { who: 'ines', text: "En course de côte, chaque dixième compte. Ménage les freins dans les épingles et réaccélère tôt : la pente t'aide à freiner, pas à relancer." },
    { who: 'ines', text: "Ensuite, on passe la frontière : la Coupe des Neiges, au Circuit du Glacier." },
  ],
  c3_neige: [
    { who: 'ines', text: "Circuit du Glacier, presque 1 600 mètres d'altitude. L'asphalte est sec, mais l'air glacé refroidit les pneus dans chaque descente." },
    { who: 'viktor', text: "Encore toi ? Mon père m'a offert une Kaze Impulse pour l'hiver. Quatre roues motrices. Tu vas adorer la regarder s'éloigner.", mood: 'smirk' },
    { who: 'doc', text: "Trois épingles pour monter, une longue descente pour redescendre. Sois patient en montée : c'est en bas que tu le reprendras." },
  ],
  c3_neige_ok: [
    { who: 'viktor', text: "… Tu as eu de la chance avec la neige.", mood: 'angry' },
    { who: 'ines', text: "Il n'a pas neigé, Viktor.", mood: 'smirk' },
  ],
  c3_record: [
    { who: 'doc', text: "En 1985, j'ai signé le record de la montée en voiture de série. Un petit roadster d'une tonne, et beaucoup d'inconscience." },
    { who: 'doc', text: "Ce temps n'a jamais été battu dans sa catégorie. Prends le Miyabi Roadster que j'ai préparé, et montre-moi ce que tu vaux." },
  ],
  c3_outro: [
    { who: 'doc', text: "… Tu as battu mon record. Près de quarante ans. Il aura fallu près de quarante ans.", mood: 'smile' },
    { who: 'doc', text: "Tu mérites de savoir. Le Mans, 1998. Ma DL-98 menait avec trois tours d'avance. Antoine Sorel était mon associé : son argent, mes plans, notre rêve." },
    { who: 'doc', text: "La nuit d'avant, un constructeur lui a proposé de racheter l'équipe… à condition que la DL-98 ne gagne pas. Je ne l'ai su que des années plus tard.", mood: 'sad' },
    { who: 'doc', text: "À deux heures de l'arrivée, le moteur s'est tu. La pompe à essence, a-t-on dit. Sorel a vendu l'équipe le lendemain. Moi, j'ai tout perdu." },
    { who: 'player', text: "Et la voiture ?" },
    { who: 'doc', text: "La voiture ? … Elle dort sous une bâche, au fond du garage. Depuis plus de vingt-cinq ans, j'y travaille la nuit. Pièce par pièce." },
    { who: 'ines', text: "Pour la remettre en piste, il faudra de l'argent. Beaucoup d'argent." },
    { who: 'doc', text: "On m'a parlé d'une course dans le désert, aux Émirats. Les primes y sont aussi grosses que les dunes. Et le Miyabi, garde-le : il a trouvé son pilote." },
  ],

  // ------------------------------------------------------------ Chapitre 4 : le désert
  du_intro: [
    { who: 'ines', text: "Bienvenue au Circuit des Dunes. Cinq kilomètres de bitume tout neuf au milieu du sable, et des primes à la hauteur." },
    { who: 'doc', text: "Je n'aime pas le sable. Il rentre partout : dans les filtres, dans les freins, dans les chaussures.", mood: 'angry' },
    { who: 'ines', text: "Première épreuve : le Raid de Liwa. L'organisation fournit les voitures, des Kaze Impulse WRX toutes identiques. Que le meilleur pilote gagne." },
    { who: 'lucie', text: "{nom} ! Auto Hebdo m'envoie couvrir la course… et j'ai deux ou trois questions sur 1998 qui ne peuvent pas attendre." },
    { who: 'doc', text: "Mademoiselle Ferrand. Vous ne lâchez jamais, vous." },
    { who: 'lucie', text: "Jamais. C'est pour ça qu'on me paie.", mood: 'smile' },
  ],
  du_raid_ok: [
    { who: 'ines', text: "Même voiture que les autres, et devant les autres. Plus personne ne pourra dire que c'est la mécanique.", mood: 'smile' },
  ],
  du_sprint: [
    { who: 'lucie', text: "J'ai fouillé les registres de 1998. Le constructeur qui a racheté l'équipe de Sorel au lendemain du Mans… c'était Aurelia." },
    { who: 'doc', text: "Aurelia. Évidemment.", mood: 'sad' },
    { who: 'lucie', text: "Et depuis, Sorel Motorsport ne court qu'en Aurelia. Le fils compris." },
    { who: 'ines', text: "Concentre-toi sur la course, {nom}. Grand Prix du Désert : 520 PP maximum, deux tours, et des lignes droites interminables." },
  ],
  du_mirage: [
    { who: 'ines', text: "Contre-la-montre au crépuscule. Le soleil rasant transforme la piste en miroir : fie-toi à tes repères, pas à l'horizon." },
    { who: 'doc', text: "Le premier tour, c'est pour chauffer les pneus. Le chrono, c'est le deuxième. Ne gaspille pas tout au premier virage." },
  ],
  du_duel: [
    { who: 'viktor', text: "Le désert, toi et moi. Pas de public, pas de journalistes. Juste deux voitures et le soleil qui se couche." },
    { who: 'viktor', text: "Mon père dit que tu es un accident. Et que les accidents, ça se corrige." },
    { choice: [
      { text: "« Et toi, qu'est-ce que tu en penses ? »", next: [{ who: 'viktor', text: "… Moi, je pense qu'on parle trop. Monte dans ta voiture.", mood: 'sad' }] },
      { text: "« Ton père parle beaucoup, pour quelqu'un qui ne pilote pas. »", next: [{ who: 'viktor', text: "Fais attention à ce que tu dis sur lui. Rendez-vous sur la ligne.", mood: 'angry' }] },
    ] },
    { who: 'ines', text: "Sa Falco GT-R est préparée jusqu'aux dents. Il sera intouchable en ligne droite : tout se jouera à l'épingle." },
  ],
  du_duel_ko: [
    { who: 'viktor', text: "Même dans le désert, le sable s'écarte devant moi.", mood: 'smirk' },
    { who: 'doc', text: "Il s'est servi de ton aspiration dans la ligne droite. Ne reste pas dans son sillage : décale-toi avant le freinage." },
  ],
  du_outro: [
    { who: 'viktor', text: "Belle course. … Ne répète à personne que j'ai dit ça." },
    { who: 'viktor', text: "Mon père m'appelle tous les soirs pour savoir pourquoi je ne t'ai pas encore écrasé. Je commence à ne plus avoir de réponse.", mood: 'sad' },
    { who: 'lucie', text: "Viktor Sorel qui félicite son rival ? Je ne vais même pas l'écrire, personne ne me croirait." },
    { who: 'ines', text: "Avec les primes du désert, on peut commander les pièces de la DL-98. Toutes, sauf une : le système d'alimentation." },
    { who: 'doc', text: "Le seul homme qui le connaissait aussi bien que moi, c'était Günther Krämer, mon chef mécanicien. On ne s'est plus parlé depuis 1998." },
    { who: 'doc', text: "Il vit en Allemagne, au bord du Grünwald-Ring. Faites vos valises." },
  ],

  // ------------------------------------------------------------ Chapitre 5 : l'Enfer vert
  gw_intro: [
    { who: 'doc', text: "Le Grünwald-Ring. Huit kilomètres d'arbres, de bosses et de virages aveugles. Les Allemands l'appellent l'Enfer vert. Ils sont modestes." },
    { who: 'gunther', text: "Marc Delaunay. Vingt-cinq ans sans un coup de fil, et tu débarques chez moi avec un pilote.", mood: 'angry' },
    { who: 'doc', text: "Günther. Tu as vieilli." },
    { who: 'gunther', text: "Toi aussi. Tu n'as jamais su mentir, alors ne commence pas aujourd'hui." },
    { who: 'gunther', text: "Ici, on ne parle pas, on roule. Si tu veux me demander quelque chose, montre-moi d'abord ce que vaut ton pilote sur mon circuit." },
  ],
  gw_eifel: [
    { who: 'ines', text: "Un seul tour, mais huit kilomètres. Personne ne connaît vraiment ce circuit avant cent tours : apprends-le en roulant, sans forcer." },
    { who: 'gunther', text: "Et quand une bosse te fait décoller, tu gardes les roues droites. Sinon, c'est l'arbre qui t'arrête." },
  ],
  gw_kramer: [
    { who: 'gunther', text: "Voilà ma Falco GT4. Elle court pour mon écurie depuis trois saisons. Elle n'a jamais gagné ici." },
    { who: 'gunther', text: "Gagne avec elle, et je te raconte ce que j'ai vu la nuit du Mans 1998." },
    { who: 'doc', text: "Günther…" },
    { who: 'gunther', text: "Pas maintenant, Marc. D'abord la course." },
  ],
  gw_kramer_ok: [
    { who: 'gunther', text: "Gut. Très bien. Assieds-toi, Marc. Toi aussi, {nom}." },
    { who: 'gunther', text: "Cette nuit-là, vers quatre heures, j'ai vu un technicien que je ne connaissais pas sortir de notre stand. Le lendemain, la DL-98 s'arrêtait." },
    { who: 'gunther', text: "Après l'abandon, j'ai démonté la pompe moi-même. Il y avait ça, caché sous le réservoir : un petit boîtier électronique, avec une antenne." },
    { who: 'doc', text: "… Pourquoi tu ne m'as rien dit ?", mood: 'sad' },
    { who: 'gunther', text: "Tu ne voulais plus parler à personne, Marc. Et Sorel m'a fait comprendre que j'avais une famille.", mood: 'sad' },
  ],
  gw_enfer: [
    { who: 'ines', text: "La pluie arrive sur toute la boucle. Seize kilomètres sur le mouillé : c'est une course d'endurance, pas un sprint." },
    { who: 'gunther', text: "Sous la pluie, l'Enfer vert devient noir. Reste loin des vibreurs et ne crois jamais un virage aveugle." },
    { who: 'viktor', text: "Mon père m'a envoyé ici pour te battre sur le circuit le plus dur du monde. Pour une fois, je suis d'accord avec lui." },
  ],
  gw_outro: [
    { who: 'gunther', text: "Seize kilomètres sous l'eau sans une faute. Marc, ce pilote-là, tu ne le mérites pas.", mood: 'smile' },
    { who: 'doc', text: "Je sais." },
    { who: 'gunther', text: "Prends le boîtier. Et le système d'alimentation de la DL-98 : je l'ai refait de mémoire il y a dix ans. Je savais qu'un jour tu reviendrais." },
    { who: 'ines', text: "Si ce boîtier a reçu un ordre, il en reste une trace quelque part. Dans les archives de télémétrie de Sorel, par exemple…" },
    { who: 'doc', text: "Direction Port-Lumière. Et cette fois, on ne vient pas seulement pour courir." },
  ],

  // ------------------------------------------------------------ Chapitre 6 : Port-Lumière
  c4_intro: [
    { who: 'ines', text: "Bonne nouvelle : Huile Mistral veut nous sponsoriser ! 30 000 crédits, et ton nom sur les ailes. Le public suit tes courses, {nom}.", mood: 'smile' },
    { who: 'ines', text: "Prochaine étape : Port-Lumière, un circuit urbain nocturne. Catégorie Grand Tourisme. Il te faut une GT et la Licence Internationale A." },
    { who: 'ines', text: "Les murs sont à cinquante centimètres de la piste. Et de nuit, les points de freinage se devinent plus qu'ils ne se voient." },
    { who: 'ines', text: "Pendant ce temps, je m'occupe du boîtier de Günther. J'ai gardé une copie des archives de Sorel en partant. Chiffrée, malheureusement." },
  ],
  c4_offer: [
    { who: 'antoine', text: "{nom}. Asseyez-vous, je vous en prie. Vous avez du talent, beaucoup de talent. Gâché dans un garage de province." },
    { who: 'antoine', text: "Sorel Motorsport vous offre un contrat d'usine. Une GT3, un salaire, une équipe de vingt ingénieurs. Il suffit de signer." },
    { who: 'antoine', text: "Une seule condition : vous ne courrez plus pour Delaunay. Ce vieil homme vit dans le passé.", mood: 'smirk' },
    { choice: [
      { text: "Refuser poliment.", next: [{ who: 'player', text: "Merci pour l'offre, monsieur Sorel. Mais je cours pour ceux qui m'ont donné ma chance." }, { who: 'antoine', text: "Comme vous voudrez. Les sentiments n'ont jamais gagné de course." }] },
      { text: "Refuser… sans politesse.", next: [{ who: 'player', text: "Je sais ce que vous avez fait en 98. Gardez votre contrat.", mood: 'angry' }, { who: 'antoine', text: "Vous ne savez rien du tout. Faites attention, {nom}. Les murs de Port-Lumière sont très… durs.", mood: 'angry' }] },
    ] },
  ],
  c4_deluge: [
    { who: 'speaker', text: "Un orage s'abat sur Port-Lumière ! La direction de course maintient le départ : la piste ressemble à un miroir !" },
    { who: 'ines', text: "Entre les murs et sous la pluie, chaque freinage est un pari. Ne parie pas trop gros." },
  ],
  c4_endurance: [
    { who: 'viktor', text: "Il paraît que tu as refusé le contrat de mon père. Personne ne refuse mon père." },
    { who: 'viktor', text: "… Je crois que je t'envie un peu, {nom}.", mood: 'sad' },
    { who: 'doc', text: "Sept tours, de nuit, entre les murs. Économise tes pneus pendant les quatre premiers. Ensuite, tu pourras attaquer." },
  ],
  c4_outro: [
    { who: 'ines', text: "{nom}, regarde ça. Le numéro de série du boîtier de Günther… c'était la clé des archives de Sorel." },
    { who: 'ines', text: "La pression d'essence n'a pas chuté progressivement, comme une pompe qui casse. Elle a été coupée net, par une commande radio envoyée depuis le stand Sorel." },
    { who: 'lucie', text: "Avec le boîtier et ces données, c'est la plus grande affaire de l'histoire du Mans. Je publie dès demain." },
    { who: 'viktor', text: "… Je n'étais pas au courant. Je te le jure. Mon père… Peu importe. On règle ça sur la piste. Trophée Trajectoire, à l'Autodrome.", mood: 'sad' },
    { who: 'doc', text: "La DL-98 sera prête. Presque. Il lui manque un cerveau : une électronique moderne, et nous n'avons ni les moyens ni le savoir-faire." },
    { who: 'ines', text: "Moi, je connais quelqu'un. Falco Works, à Tokyo. Ils cherchent un pilote invité pour la course de nuit de Shinden." },
  ],

  // ------------------------------------------------------------ Chapitre 7 : Shinden
  sh_intro: [
    { who: 'ines', text: "Tokyo. Le circuit de Shinden serpente entre les tours et passe sous l'autoroute. Bienvenue dans la ville la plus lumineuse du monde." },
    { who: 'aiko', text: "Tachibana Aiko, pilote d'usine Falco Works. Moreau-san m'a beaucoup parlé de vous." },
    { who: 'aiko', text: "Chez Falco, on ne confie pas une voiture d'usine à un inconnu. Montrez-moi d'abord ce que vous faites avec la vôtre." },
    { who: 'doc', text: "Elle me plaît, celle-là.", mood: 'smirk' },
    { who: 'aiko', text: "Je vous entends, Delaunay-san.", mood: 'smirk' },
  ],
  sh_essai: [
    { who: 'aiko', text: "Voici la Falco GT3 Corsa. V6 biturbo, 550 chevaux, et plus d'appui que tout ce que vous avez piloté jusqu'ici." },
    { who: 'aiko', text: "Mon meilleur tour est dans la mémoire du chrono. Approchez-le, et nous parlerons sérieusement." },
    { who: 'ines', text: "Avec autant d'appui, les courbes rapides passent bien plus vite que tu ne le crois. Fais confiance à la voiture." },
  ],
  sh_essai_ok: [
    { who: 'aiko', text: "… Intéressant. Vous freinez comme un pilote d'endurance. Delaunay-san vous a bien appris.", mood: 'smile' },
    { who: 'doc', text: "Je n'ai rien appris du tout. J'ai juste évité de tout gâcher." },
  ],
  sh_typhon: [
    { who: 'speaker', text: "Alerte typhon sur la baie de Tokyo ! La course est maintenue, mais quel déluge, mesdames et messieurs !" },
    { who: 'aiko', text: "Sous la pluie, les néons se reflètent sur la piste. Ne regardez pas les lumières : regardez les murs." },
  ],
  sh_works: [
    { who: 'aiko', text: "Ce soir, vous courez pour Falco Works. Si vous gagnez, nos ingénieurs installeront notre électronique dans votre DL-98." },
    { who: 'viktor', text: "Une voiture d'usine japonaise, maintenant ? Tu changes d'écurie plus vite que de pneus.", mood: 'smirk' },
    { who: 'aiko', text: "Et vous, Sorel-san, vous parlez plus vite que vous ne roulez.", mood: 'smirk' },
    { who: 'viktor', text: "… Elle est toujours comme ça ?" },
    { who: 'ines', text: "Toujours. Quatre tours, {nom}. Viktor a une Aurelia Tempesta : elle sera plus rapide en ligne droite, la GT3 plus rapide partout ailleurs." },
  ],
  sh_works_ko: [
    { who: 'aiko', text: "Ce n'est pas grave. Chez nous, on dit : tombe sept fois, relève-toi huit." },
    { who: 'viktor', text: "Chez nous, on dit : deuxième, c'est le premier des perdants.", mood: 'smirk' },
  ],
  sh_outro: [
    { who: 'aiko', text: "Falco Works tient parole. Nos ingénieurs partent demain pour la France, avec le calculateur." },
    { who: 'aiko', text: "Et la direction vous offre une GT4 aux couleurs de l'usine. Ne la rayez pas.", mood: 'smile' },
    { who: 'aiko', text: "Je serai au départ du Trophée Trajectoire. Ne croyez pas que je vous laisserai gagner." },
    { who: 'doc', text: "Alors il est temps. Rentrez au garage. Tous. J'ai quelque chose à vous montrer." },
  ],

  // ------------------------------------------------------------ Chapitre 8 : le Trophée Trajectoire
  c5_intro: [
    { who: 'doc', text: "Je vous présente la Delaunay DL-98. V12 de six litres, 790 chevaux, 960 kilos. Elle n'a jamais terminé une course." },
    { who: 'gunther', text: "Avec mon alimentation et le calculateur de Falco. Cette fois, elle ira jusqu'au bout." },
    { who: 'doc', text: "Elle est à toi, {nom}. Termine ce que nous avons commencé.", mood: 'smile' },
    { who: 'ines', text: "D'abord la Super Licence. Ensuite, un détour par Lakeview, en Floride : il faut savoir si le V12 tient à fond pendant des tours entiers." },
    { who: 'ines', text: "Viktor courra sur l'Aurelia LMP-01 de son père. Plus d'appui que nous, mais notre V12 a plus d'allonge. Tout se jouera dans la grande ligne droite." },
  ],
  ov_essais: [
    { who: 'ines', text: "Lakeview Speedway. Un tri-ovale de quatre kilomètres, relevé à 24 degrés. Ici, on ne freine presque jamais." },
    { who: 'gunther', text: "Écoute le moteur. Au moindre cliquetis, tu lèves le pied et tu rentres." },
    { who: 'doc', text: "Il ne cliquettera pas." },
  ],
  ov_500: [
    { who: 'speaker', text: "Bienvenue à Lakeview ! Cent mille spectateurs pour la Lakeview 500, et une voiture française venue d'un autre temps !" },
    { who: 'ines', text: "Sur l'ovale, l'aspiration fait tout. Reste dans le sillage, et ne déboîte qu'au dernier moment pour dépasser." },
  ],
  ov_500_ok: [
    { who: 'gunther', text: "Pas un cliquetis. Marc, ton V12 chante encore mieux qu'en 98.", mood: 'smile' },
    { who: 'doc', text: "Il a eu le temps de répéter." },
  ],
  c5_final: [
    { who: 'speaker', text: "Mesdames et messieurs, bienvenue à l'Autodrome International pour la finale du Trophée Trajectoire ! Dix voitures, cinq tours, une seule légende !" },
    { who: 'viktor', text: "Pas de coups bas aujourd'hui. Que le meilleur gagne, {nom}." },
    { who: 'aiko', text: "Le meilleur, ou la meilleure. Bonne course à tous les deux.", mood: 'smirk' },
    { who: 'doc', text: "Plus de vingt-cinq ans que j'attends ce moment. Ne pense pas à moi. Pense au prochain virage. Toujours au prochain virage." },
  ],
  c5_finale_ko: [
    { who: 'doc', text: "Ce n'est rien. J'ai attendu plus de vingt-cinq ans, je peux bien attendre une course de plus." },
    { who: 'ines', text: "On regarde la télémétrie, on corrige, et on y retourne. La DL-98 a le potentiel. Toi aussi." },
  ],
  epilogue: [
    { who: 'speaker', text: "La DL-98 franchit la ligne en vainqueur ! Plus d'un quart de siècle après Le Mans, la Delaunay gagne enfin ! Quelle histoire, quelle course !" },
    { who: 'viktor', text: "Bravo. Vraiment. Tu étais plus rapide aujourd'hui… Je reviendrai. Mais à la loyale, cette fois.", mood: 'smile' },
    { who: 'aiko', text: "Falco Works aimerait vous revoir à Tokyo l'an prochain. En adversaire, de préférence." },
    { who: 'lucie', text: "Antoine Sorel vient d'annoncer sa démission. La fédération rouvre l'enquête sur Le Mans 1998." },
    { who: 'gunther', text: "Vingt-cinq ans que j'attendais de voir cette voiture passer la ligne. Je peux prendre ma retraite." },
    { who: 'doc', text: "Tu sais, {nom}… « failli » n'est plus le mot le plus cruel du sport automobile.", mood: 'smile' },
    { who: 'doc', text: "Le plus beau, c'est « encore ». On remet ça la saison prochaine ?" },
    { who: 'ines', text: "J'ai déjà quelques idées de réglages.", mood: 'smile' },
  ],
};

// ---------------------------------------------------------------- Réactions après une épreuve
// Répliques courtes jouées après une course ou un chrono sans dialogue dédié.
// kind : win, podium, fail, rival (battu par Viktor), beatRival (devant Viktor), gold, medal, failTT.
// from/to : chapitres où la réaction est possible (Inès rejoint l'équipe à la fin du chapitre 1).
export const REACTIONS = [
  { kind: 'win', to: 1, lines: [{ who: 'doc', text: "Victoire ! Et avec la manière. La {voiture} n'a jamais aussi bien tourné.", mood: 'smile' }] },
  { kind: 'win', lines: [{ who: 'doc', text: "Je t'ai regardé depuis le muret. Tu as gagné au freinage, pas en ligne droite. C'est comme ça que gagnent les grands.", mood: 'smile' }] },
  { kind: 'win', from: 2, lines: [{ who: 'ines', text: "P1, et des temps au tour réglés comme un métronome. Je n'ai rien à redire… pour une fois.", mood: 'smile' }] },
  { kind: 'win', from: 2, lines: [{ who: 'ines', text: "Victoire ! Prochaine étape : {suivante}. Je prépare déjà les réglages.", mood: 'smile' }] },
  { kind: 'win', from: 5, to: 5, lines: [{ who: 'gunther', text: "Sur mon circuit, devant tout le monde. Marc, il faudra me le prêter.", mood: 'smile' }] },
  { kind: 'win', from: 7, to: 7, lines: [{ who: 'aiko', text: "Une victoire à Shinden. Au Japon, cela mérite un bol de ramen. Le meilleur de la ville.", mood: 'smile' }] },
  { kind: 'podium', lines: [{ who: 'doc', text: "Un podium, c'est bien. Mais regarde la marche du dessus : elle n'est pas si haute." }] },
  { kind: 'podium', lines: [{ who: 'doc', text: "La {voiture} a donné tout ce qu'elle avait. La prochaine fois, donne un peu plus qu'elle." }] },
  { kind: 'podium', from: 2, lines: [{ who: 'ines', text: "Podium. Tu perds du temps à la réaccélération dans les virages lents : on en reparle devant la télémétrie." }] },
  { kind: 'podium', from: 2, lines: [{ who: 'ines', text: "{position}e, objectif rempli. On garde ça en tête et on passe à {suivante}." }] },
  { kind: 'gold', lines: [{ who: 'doc', text: "Ça, c'est un tour. Je n'aurais pas fait mieux… enfin, à ton âge, peut-être.", mood: 'smirk' }] },
  { kind: 'gold', from: 2, lines: [{ who: 'ines', text: "Médaille d'or ! Tu as battu la référence. Je vais devoir revoir tous mes calculs.", mood: 'smile' }] },
  { kind: 'medal', lines: [{ who: 'doc', text: "Le chrono est bon. Pas parfait, mais bon. Le parfait, on le garde pour plus tard." }] },
  { kind: 'medal', from: 2, lines: [{ who: 'ines', text: "Objectif atteint. Il reste quelques dixièmes dans les freinages, si tu veux revenir chercher l'or." }] },
  { kind: 'fail', lines: [{ who: 'doc', text: "Pas cette fois. Bois un verre d'eau, repense à chaque virage, et on y retourne." }] },
  { kind: 'fail', lines: [{ who: 'doc', text: "Tu as voulu aller trop vite, trop tôt. La vitesse vient de la régularité, tu te souviens ?" }] },
  { kind: 'fail', from: 2, lines: [{ who: 'ines', text: "{position}e. Ce n'est ni la voiture ni la malchance : on perd trop de temps dans les gros freinages. On réessaie ?" }] },
  { kind: 'fail', from: 2, lines: [{ who: 'ines', text: "Si la {voiture} est à court, passe chez le préparateur. Sinon, c'est le pilote qu'il faut régler.", mood: 'smirk' }] },
  { kind: 'fail', from: 5, to: 5, lines: [{ who: 'gunther', text: "L'Enfer vert ne se dompte pas en un jour. Moi, il m'a fallu dix ans." }] },
  { kind: 'fail', from: 7, to: 7, lines: [{ who: 'aiko', text: "Les murs de Shinden ne pardonnent rien. Mais ils ne bougent pas non plus : apprenez-les." }] },
  { kind: 'failTT', lines: [{ who: 'doc', text: "Le chrono ne ment jamais. C'est pour ça que je l'aime, et que je le déteste." }] },
  { kind: 'failTT', from: 2, lines: [{ who: 'ines', text: "Pas de médaille. Il faut un tour propre, sans sortie de piste : la régularité d'abord, la vitesse ensuite." }] },
  { kind: 'rival', lines: [{ who: 'viktor', text: "Encore derrière moi, {nom} ? Tu devrais t'habituer à la vue.", mood: 'smirk' }, { who: 'doc', text: "Laisse-le savourer. Ça ne durera pas." }] },
  { kind: 'rival', from: 2, lines: [{ who: 'viktor', text: "Tu as bien vu mes feux arrière ? Profites-en, ce sont les plus beaux du plateau.", mood: 'smirk' }, { who: 'ines', text: "Il a été plus rapide aujourd'hui. Sur la télémétrie, l'écart se fait en sortie de virage. Ça se comble." }] },
  { kind: 'rival', from: 3, lines: [{ who: 'viktor', text: "Mon père avait raison : tu n'es qu'un feu de paille.", mood: 'smirk' }, { who: 'doc', text: "Un feu de paille, ça brûle vite. Montre-lui que tu brûles longtemps." }] },
  { kind: 'beatRival', lines: [{ who: 'viktor', text: "… La prochaine fois.", mood: 'angry' }, { who: 'doc', text: "Il dit ça à chaque fois. C'est bon signe.", mood: 'smirk' }] },
  { kind: 'beatRival', from: 2, lines: [{ who: 'viktor', text: "Tch. Profite bien. Ça n'arrivera pas deux fois.", mood: 'angry' }, { who: 'ines', text: "C'est déjà arrivé plusieurs fois, Viktor.", mood: 'smirk' }] },
];

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
// Les identifiants d'épreuves et de dialogues des sauvegardes antérieures sont conservés (c1_…, c5_…).
// key : identifiant stable du chapitre (primes, récompenses). id : rang dans la liste.
// goal : { position: n } (finir dans les n premiers), { medal: 'bronze' } (contre-la-montre)
// Champs d'épreuve : weather ('pluie'), time (heure imposée), provided (voiture prêtée), before/after/fail (dialogues),
// requires (épreuves préalables du même chapitre), grid ('last' | 'qualif'), qualif (épreuve de qualification).
// reward : récompense de fin de chapitre { credits, car: { car, color, upgrades }, text }.
export const CHAPTERS = [
  {
    id: 0, key: 'prologue', title: 'Prologue', name: 'Le garage Delaunay', track: 'collines',
    intro: 'prologue', outro: 'prologue_done',
    events: [
      { id: 'p_licB', type: 'licence', licence: 'B', title: 'Licence Nationale B', desc: 'Les trois épreuves de base pour obtenir le droit de courir.' },
    ],
  },
  {
    id: 1, key: 'club', title: 'Chapitre 1', name: 'Le Club', track: 'collines',
    intro: 'c1_intro', outro: 'c1_outro',
    reward: { credits: 5000, text: 'Prime du club des Collines pour la victoire au Trophée Régional.' },
    events: [
      { id: 'c1_coupe', type: 'race', title: 'Coupe du Dimanche', desc: 'Course de club pour compactes et petites sportives. Une bonne entrée en matière.', track: 'collines', laps: 3, restrict: { ppMax: 330 }, opponents: { count: 6, pool: ['kaze_r3', 'miyabi_rs', 'valette_rallye'], skill: [0.5, 0.7], fit: [0.8, 0.92] }, grid: 'last', prizes: [6000, 4000, 3000, 1800, 1200, 900, 600], goal: { position: 3 }, after: 'c1_coupe_ok' },
      { id: 'c1_chrono', type: 'timetrial', title: 'Défi du chrono', desc: 'Signez le meilleur temps au tour possible en 3 tours. Objectif : médaille de bronze.', track: 'collines', laps: 3, restrict: { ppMax: 330 }, ref: 'kaze_r3', prizes: { gold: 3000, silver: 1800, bronze: 1000 }, goal: { medal: 'bronze' } },
      { id: 'c1_averse', type: 'race', title: 'L\'averse du dimanche', desc: 'La pluie s\'invite aux Collines. Freinages en ligne droite et gestes doux.', track: 'collines', laps: 3, weather: 'pluie', restrict: { ppMax: 340 }, opponents: { count: 7, pool: ['valette_rallye', 'kaze_r3', 'miyabi_rs'], skill: [0.52, 0.72], fit: [0.82, 0.94] }, grid: 'last', prizes: [8000, 5000, 3500, 2200, 1500, 1000, 700, 500], goal: { position: 3 }, before: 'c1_rain', after: 'c1_rain_ok', requires: ['c1_coupe'] },
      { id: 'c1_trophee', type: 'race', title: 'Trophée Régional des Collines', desc: 'Le grand rendez-vous régional. Viktor Sorel est au départ.', track: 'collines', laps: 4, restrict: { ppMax: 360 }, opponents: { count: 7, pool: ['valette_sprint', 'miyabi_rs', 'kaze_r3', 'hoshi_civica'], skill: [0.55, 0.74], fit: [0.82, 0.94], rival: { car: 'hoshi_civica', skill: 0.8 } }, grid: 'last', prizes: [12000, 7000, 5000, 3000, 2000, 1500, 1000, 800, 600], goal: { position: 1 }, before: 'c1_mid', fail: 'c1_trophee_ko', requires: ['c1_averse', 'c1_chrono'] },
    ],
  },
  {
    id: 2, key: 'corniche', title: 'Chapitre 2', name: 'La Corniche', track: 'corniche',
    intro: 'c2_intro', outro: 'c2_outro',
    reward: { credits: 8000, text: 'Prime de l\'Automobile-Club de la Riviera.' },
    events: [
      { id: 'c2_licA', type: 'licence', licence: 'A', title: 'Licence Nationale A', desc: 'Freinages appuyés et enchaînements rapides.' },
      { id: 'c2_riviera', type: 'race', title: 'Coupe de la Riviera', desc: 'Sportives jusqu\'à 430 PP sur le ruban de la Corniche, au coucher du soleil.', track: 'corniche', laps: 3, restrict: { ppMax: 430 }, opponents: { count: 7, pool: ['kaze_86', 'miyabi_rs', 'valette_sprint', 'hoshi_civica', 'hoshi_raijin', 'kaze_wrx'], skill: [0.62, 0.82] }, grid: 'last', prizes: [15000, 9000, 6000, 4000, 2500, 1800, 1200, 900], goal: { position: 3 }, requires: ['c2_licA'] },
      { id: 'c2_minuit', type: 'race', title: 'Les Lacets de minuit', desc: 'Course de légendes, de nuit, au volant d\'une Marlin 2000 GT de 1968 prêtée par un collectionneur.', track: 'corniche', laps: 3, time: 'night', provided: { car: 'marlin_gt', upgrades: ['eng1', 'tire_sport', 'susp1'], color: '#a8141c' }, restrict: { ppMax: 380 }, opponents: { count: 6, pool: ['vortex_428', 'marlin_gt', 'valette_rallye'], skill: [0.58, 0.78], fit: [0.86, 0.97] }, grid: 'last', prizes: [14000, 8000, 5000, 3000, 2000, 1500, 1000], goal: { position: 3 }, before: 'c2_minuit', after: 'c2_minuit_ok', requires: ['c2_riviera'] },
      { id: 'c2_duel', type: 'race', title: 'Duel au crépuscule', desc: 'Toi contre Viktor Sorel. Trois tours. Le perdant quitte le circuit.', track: 'corniche', laps: 3, restrict: { ppMax: 450 }, opponents: { count: 0, rival: { car: 'hoshi_raijin', skill: 0.9, upgrades: ['eng1', 'tire_sport'] } }, grid: 'last', prizes: [20000, 3000], goal: { position: 1 }, before: 'c2_duel', fail: 'c2_duel_ko', requires: ['c2_riviera'] },
    ],
  },
  {
    id: 3, key: 'col', title: 'Chapitre 3', name: "Le Col de l'Aigle", track: 'col',
    intro: 'c3_intro', outro: 'c3_outro',
    reward: { car: { car: 'miyabi_rs', upgrades: ['eng1', 'tire_sport', 'susp1'], color: '#0e5a3c' }, text: 'Le Miyabi Roadster RS préparé par Doc rejoint votre garage.' },
    events: [
      { id: 'c3_montee', type: 'timetrial', title: 'Montée historique', desc: 'Contre-la-montre jusqu\'au sommet. Voitures jusqu\'à 480 PP.', track: 'col', laps: 1, restrict: { ppMax: 480 }, ref: 'kaze_86', prizes: { gold: 8000, silver: 5000, bronze: 3000 }, goal: { medal: 'bronze' } },
      { id: 'c3_alpes', type: 'race', title: 'Coupe des Alpes', desc: 'Course de côte en peloton : six voitures, une route étroite, aucune marge.', track: 'col', laps: 1, restrict: { ppMax: 480 }, opponents: { count: 5, pool: ['kaze_86', 'hoshi_raijin', 'miyabi_rs', 'hoshi_civica', 'valette_sprint'], skill: [0.68, 0.85] }, grid: 'last', prizes: [18000, 11000, 7000, 4500, 3000, 2000], goal: { position: 3 } },
      { id: 'c3_neige', type: 'race', title: 'Coupe des Neiges', desc: 'Deux tours entre les congères du Circuit du Glacier. Viktor a sorti sa Kaze Impulse.', track: 'glacier', laps: 2, restrict: { ppMax: 480 }, opponents: { count: 6, pool: ['kaze_wrx', 'hoshi_raijin', 'falco_gtr', 'kaze_sora', 'hoshi_nxr', 'kaze_86'], skill: [0.66, 0.84], rival: { car: 'kaze_wrx', skill: 0.86, upgrades: ['eng1', 'tire_semi', 'susp1'] } }, grid: 'last', prizes: [22000, 13000, 8000, 5000, 3500, 2500, 1800, 1200], goal: { position: 3 }, before: 'c3_neige', after: 'c3_neige_ok', requires: ['c3_alpes'] },
      { id: 'c3_record', type: 'timetrial', title: 'Le record de 1985', desc: 'Battez le record de Doc au volant du Miyabi Roadster RS préparé par ses soins.', track: 'col', laps: 1, provided: { car: 'miyabi_rs', upgrades: ['eng1', 'tire_sport', 'susp1'], color: '#0e5a3c' }, ref: 'miyabi_rs', refUpgrades: ['eng1', 'tire_sport', 'susp1'], prizes: { gold: 20000, silver: 12000, bronze: 8000 }, goal: { medal: 'silver' }, before: 'c3_record', requires: ['c3_montee', 'c3_neige'] },
    ],
  },
  {
    id: 4, key: 'dunes', title: 'Chapitre 4', name: 'Le Mirage', track: 'dunes',
    intro: 'du_intro', outro: 'du_outro',
    reward: { credits: 20000, text: 'Prime des organisateurs du Raid de Liwa.' },
    events: [
      { id: 'du_raid', type: 'race', title: 'Raid de Liwa', desc: 'Monotype : huit Kaze Impulse WRX identiques fournies par l\'organisation. Seul le pilotage compte.', track: 'dunes', laps: 2, provided: { car: 'kaze_wrx', upgrades: [], color: '#f2f2ef' }, opponents: { count: 7, pool: ['kaze_wrx'], skill: [0.64, 0.84] }, grid: 'last', prizes: [24000, 14000, 9000, 6000, 4000, 3000, 2000, 1500], goal: { position: 3 }, after: 'du_raid_ok' },
      { id: 'du_sprint', type: 'race', title: 'Grand Prix du Désert', desc: 'GT et sportives jusqu\'à 520 PP. Deux lignes droites interminables et une épingle serrée.', track: 'dunes', laps: 2, restrict: { ppMax: 520 }, opponents: { count: 7, pool: ['strauss_m3', 'falco_gtr', 'kaze_sora', 'hoshi_raijin', 'strauss_avant', 'hoshi_nxr'], skill: [0.68, 0.86] }, grid: 'last', prizes: [30000, 18000, 12000, 8000, 5000, 3500, 2500, 1800], goal: { position: 3 }, before: 'du_sprint', requires: ['du_raid'] },
      { id: 'du_mirage', type: 'timetrial', title: 'Le Mirage', desc: 'Contre-la-montre au soleil couchant : un tour de chauffe, puis un tour lancé. Voitures jusqu\'à 520 PP.', track: 'dunes', laps: 2, restrict: { ppMax: 520 }, ref: 'strauss_m3', refUpgrades: ['tire_semi'], prizes: { gold: 16000, silver: 10000, bronze: 6000 }, goal: { medal: 'bronze' }, before: 'du_mirage', requires: ['du_raid'] },
      { id: 'du_duel', type: 'race', title: 'Duel des sables', desc: 'Viktor Sorel, sa Falco GT-R préparée et deux tours dans le désert.', track: 'dunes', laps: 2, restrict: { ppMax: 520 }, opponents: { count: 0, rival: { car: 'falco_gtr', skill: 0.9, upgrades: ['eng1', 'eng2', 'tire_semi', 'susp1'] } }, grid: 'last', prizes: [35000, 5000], goal: { position: 1 }, before: 'du_duel', fail: 'du_duel_ko', requires: ['du_sprint', 'du_mirage'] },
    ],
  },
  {
    id: 5, key: 'grunwald', title: 'Chapitre 5', name: 'L\'Enfer vert', track: 'grunwald',
    intro: 'gw_intro', outro: 'gw_outro',
    reward: { credits: 25000, text: 'Günther vous confie le boîtier de 1998, et son écurie vous verse une prime.' },
    events: [
      { id: 'gw_eifel', type: 'race', title: 'Coupe de l\'Eifel', desc: 'Un seul tour, mais huit kilomètres de Grünwald-Ring. Voitures jusqu\'à 560 PP.', track: 'grunwald', laps: 1, restrict: { ppMax: 560 }, opponents: { count: 7, pool: ['strauss_m3', 'falco_gtr', 'kaze_sora', 'hoshi_nxr', 'strauss_avant', 'kaze_wrx'], skill: [0.7, 0.86] }, grid: 'last', prizes: [36000, 21000, 14000, 9000, 6000, 4500, 3000, 2000], goal: { position: 3 }, before: 'gw_eifel' },
      { id: 'gw_kramer', type: 'race', title: 'La Falco de Krämer', desc: 'Au volant de la Falco GT4 de l\'écurie Krämer, qui n\'a jamais gagné ici. Seule la victoire compte.', track: 'grunwald', laps: 1, provided: { car: 'falco_gt4', upgrades: [], color: '#f5b800' }, restrict: { ppMax: 640 }, opponents: { count: 6, pool: ['stellan_rs', 'falco_gt4', 'strauss_m3', 'strauss_avant'], skill: [0.66, 0.84], fit: [0.88, 0.97] }, grid: 'last', prizes: [30000, 16000, 10000, 6000, 4000, 3000, 2000], goal: { position: 1 }, before: 'gw_kramer', after: 'gw_kramer_ok', requires: ['gw_eifel'] },
      { id: 'gw_enfer', type: 'race', title: 'Les Seize Kilomètres de l\'Enfer', desc: 'Endurance sous la pluie : deux tours complets du Grünwald-Ring, jusqu\'à 580 PP. Viktor est au départ.', track: 'grunwald', laps: 2, weather: 'pluie', restrict: { ppMax: 580 }, opponents: { count: 8, pool: ['stellan_rs', 'strauss_m3', 'falco_gtr', 'strauss_avant', 'kaze_sora'], skill: [0.72, 0.87], rival: { car: 'stellan_rs', skill: 0.9 } }, grid: 'last', prizes: [60000, 34000, 22000, 14000, 9000, 6500, 4500, 3000, 2000, 1500], goal: { position: 3 }, before: 'gw_enfer', requires: ['gw_kramer'] },
    ],
  },
  {
    id: 6, key: 'ville', title: 'Chapitre 6', name: 'Les Lumières de la Ville', track: 'portlumiere',
    intro: 'c4_intro', outro: 'c4_outro', bonus: 30000, bonusText: 'Sponsor Huile Mistral',
    reward: { credits: 40000, text: 'Prime de victoire Huile Mistral.' },
    events: [
      { id: 'c4_licIA', type: 'licence', licence: 'IA', title: 'Licence Internationale A', desc: 'Précision chirurgicale entre les murs, de nuit.' },
      { id: 'c4_gpn', type: 'race', title: 'Grand Prix Nocturne', desc: 'Grand Tourisme jusqu\'à 620 PP dans les rues illuminées de Port-Lumière.', track: 'portlumiere', laps: 4, restrict: { ppMax: 620 }, opponents: { count: 7, pool: ['strauss_m3', 'falco_gtr', 'stellan_rs', 'hoshi_raijin', 'strauss_avant'], skill: [0.66, 0.84] }, grid: 'last', prizes: [32000, 19000, 12000, 8000, 5000, 3500, 2500, 1800], goal: { position: 3 }, requires: ['c4_licIA'], after: 'c4_offer' },
      { id: 'c4_deluge', type: 'race', title: 'Le Déluge du port', desc: 'Un orage sur Port-Lumière : quatre tours entre les murs, sur une piste détrempée.', track: 'portlumiere', laps: 4, weather: 'pluie', restrict: { ppMax: 620 }, opponents: { count: 7, pool: ['stellan_rs', 'strauss_m3', 'strauss_avant', 'falco_gtr', 'kaze_sora'], skill: [0.68, 0.86] }, grid: 'last', prizes: [38000, 22000, 14000, 9000, 6000, 4000, 3000, 2000], goal: { position: 3 }, before: 'c4_deluge', requires: ['c4_gpn'] },
      { id: 'c4_endurance', type: 'race', title: 'Les 30 minutes de Port-Lumière', desc: 'Course longue sur 7 tours : régularité et sang-froid. Viktor est là.', track: 'portlumiere', laps: 7, restrict: { ppMax: 620 }, opponents: { count: 9, pool: ['strauss_m3', 'falco_gtr', 'stellan_rs', 'strauss_avant'], skill: [0.7, 0.86], rival: { car: 'stellan_rs', skill: 0.92, upgrades: ['eng1'] } }, grid: 'last', prizes: [45000, 26000, 17000, 11000, 8000, 6000, 4000, 3000, 2000, 1500], goal: { position: 1 }, before: 'c4_endurance', requires: ['c4_deluge'] },
    ],
  },
  {
    id: 7, key: 'shinden', title: 'Chapitre 7', name: 'Les Néons de Shinden', track: 'neon',
    intro: 'sh_intro', outro: 'sh_outro',
    reward: { car: { car: 'falco_gt4', color: '#4a2276' }, text: 'Falco Works vous offre une Falco GT4 Clubsport aux couleurs de l\'usine.' },
    events: [
      { id: 'sh_cup', type: 'race', title: 'Shinden Night Cup', desc: 'Votre première course à Tokyo, avec votre voiture. GT jusqu\'à 700 PP entre les tours.', track: 'neon', laps: 3, restrict: { ppMax: 700 }, opponents: { count: 7, pool: ['vortex_acr', 'falco_gt4', 'stellan_rs', 'strauss_m3', 'strauss_avant'], skill: [0.72, 0.88] }, grid: 'last', prizes: [50000, 28000, 18000, 12000, 8000, 5500, 4000, 3000], goal: { position: 3 } },
      { id: 'sh_essai', type: 'timetrial', title: 'Le chrono de Tachibana', desc: 'Falco Works vous confie sa GT3 Corsa : approchez le meilleur tour d\'Aiko. Objectif : argent.', track: 'neon', laps: 2, provided: { car: 'falco_gt3', upgrades: [], color: '#f0f0ed' }, ref: 'falco_gt3', prizes: { gold: 30000, silver: 18000, bronze: 12000 }, goal: { medal: 'silver' }, before: 'sh_essai', after: 'sh_essai_ok', requires: ['sh_cup'] },
      { id: 'sh_typhon', type: 'race', title: 'Typhon sur Shinden', desc: 'Pluie battante et néons sur l\'asphalte. Voitures jusqu\'à 760 PP.', track: 'neon', laps: 3, weather: 'pluie', restrict: { ppMax: 760 }, opponents: { count: 7, pool: ['aurelia_tempesta', 'vortex_acr', 'falco_gt4', 'stellan_rs'], skill: [0.72, 0.88] }, grid: 'last', prizes: [60000, 34000, 22000, 14000, 9000, 6500, 4500, 3000], goal: { position: 3 }, before: 'sh_typhon', requires: ['sh_cup'] },
      { id: 'sh_works', type: 'race', title: 'Les Quatre Tours de Falco Works', desc: 'Au volant de la Falco GT3 d\'usine, face aux supercars et à l\'Aurelia de Viktor. Victoire exigée.', track: 'neon', laps: 4, provided: { car: 'falco_gt3', upgrades: [], color: '#f0f0ed' }, restrict: { ppMax: 780 }, opponents: { count: 7, pool: ['falco_gt3', 'aurelia_tempesta', 'vortex_acr', 'falco_gt4'], skill: [0.74, 0.9], rival: { car: 'aurelia_tempesta', skill: 0.92, upgrades: ['eng1'] } }, grid: 'last', prizes: [80000, 45000, 28000, 18000, 12000, 8000, 6000, 4000, 3000], goal: { position: 1 }, before: 'sh_works', fail: 'sh_works_ko', requires: ['sh_essai', 'sh_typhon'] },
    ],
  },
  {
    id: 8, key: 'finale', title: 'Chapitre 8', name: 'Le Trophée Trajectoire', track: 'autodrome', final: true,
    intro: 'c5_intro', outro: 'epilogue', giftCar: { car: 'delaunay_dl98', color: '#0b2e6b' },
    events: [
      { id: 'c5_licS', type: 'licence', licence: 'S', title: 'Super Licence', desc: 'Les épreuves ultimes, au volant de la DL-98.' },
      { id: 'ov_essais', type: 'timetrial', title: 'Essais à Lakeview', desc: 'Deux tours pied au plancher sur l\'ovale relevé : le V12 doit tenir. Objectif : bronze.', track: 'ovale', laps: 2, restrict: { carId: 'delaunay_dl98' }, ref: 'delaunay_dl98', prizes: { gold: 20000, silver: 12000, bronze: 8000 }, goal: { medal: 'bronze' }, before: 'ov_essais', requires: ['c5_licS'] },
      { id: 'ov_500', type: 'race', title: 'Lakeview 500', desc: 'Cinq tours d\'ovale au soleil couchant face aux prototypes et aux hypercars. L\'aspiration décide de tout.', track: 'ovale', laps: 5, time: 'sunset', restrict: { carId: 'delaunay_dl98' }, opponents: { count: 7, pool: ['aurelia_lmp', 'stellan_962', 'aurelia_veloce', 'falco_gt3'], skill: [0.74, 0.9] }, grid: 'last', prizes: [60000, 34000, 22000, 14000, 9000, 6500, 4500, 3000], goal: { position: 3 }, before: 'ov_500', after: 'ov_500_ok', requires: ['ov_essais'] },
      { id: 'c5_qualif', type: 'timetrial', title: 'Qualifications', desc: 'Deux tours lancés pour la grille de la finale : or = pole position, argent = 3e, bronze = 5e.', track: 'autodrome', laps: 2, restrict: { carId: 'delaunay_dl98' }, ref: 'delaunay_dl98', prizes: { gold: 15000, silver: 10000, bronze: 6000 }, goal: { medal: 'bronze' }, requires: ['ov_500'] },
      { id: 'c5_finale', type: 'race', title: 'Trophée Trajectoire — Finale', desc: 'La finale : GT3, prototypes et Viktor Sorel sur l\'Aurelia LMP-01. Cinq tours pour l\'histoire.', track: 'autodrome', laps: 5, restrict: { carId: 'delaunay_dl98' }, opponents: { count: 8, pool: ['falco_gt3', 'stellan_962', 'falco_gt3', 'aurelia_lmp'], skill: [0.72, 0.86], rival: { car: 'aurelia_lmp', skill: 0.92 } }, grid: 'qualif', qualif: 'c5_qualif', prizes: [100000, 50000, 30000, 18000, 12000, 9000, 7000, 5000, 4000, 3000], goal: { position: 1 }, before: 'c5_final', fail: 'c5_finale_ko', requires: ['c5_qualif'] },
    ],
  },
];

export const CHAPTER_BY_KEY = Object.fromEntries(CHAPTERS.map((c) => [c.key, c]));
export const ALL_EVENTS = CHAPTERS.flatMap((c) => c.events.map((e) => ({ ...e, chapter: c.id })));
export const EVENT_BY_ID = Object.fromEntries(ALL_EVENTS.map((e) => [e.id, e]));

// ---------------------------------------------------------------- Courses à la carte (hors histoire)
export const FREE_SERIES = [
  { id: 'f_compact', title: 'Coupe des Compactes', ppMax: 360, pool: ['kaze_r3', 'valette_rallye', 'valette_sprint', 'hoshi_civica'], skill: [0.6, 0.8], base: 5000 },
  { id: 'f_sport', title: 'Challenge Sport', ppMax: 450, pool: ['kaze_86', 'miyabi_rs', 'hoshi_raijin', 'valette_sprint', 'kaze_wrx', 'hoshi_nxr'], skill: [0.65, 0.85], base: 9000 },
  { id: 'f_gt', title: 'Série Grand Tourisme', ppMax: 620, pool: ['strauss_m3', 'falco_gtr', 'stellan_rs', 'strauss_avant', 'kaze_sora'], skill: [0.7, 0.88], base: 18000 },
  { id: 'f_super', title: 'Supercar Masters', ppMax: 800, pool: ['aurelia_tempesta', 'vortex_acr', 'stellan_rs', 'falco_gt3', 'falco_gt4'], skill: [0.74, 0.9], base: 35000 },
  { id: 'f_proto', title: 'Endurance Prototypes', ppMax: 1300, pool: ['aurelia_lmp', 'stellan_962', 'falco_gt3', 'aurelia_tempesta'], skill: [0.78, 0.94], base: 60000 },
];

// Remplace les variables d'un texte ({nom}, {voiture}, {suivante}, {position})
export function fillText(text, ctx = {}) {
  return text.replace(/\{(nom|voiture|suivante|position)\}/g, (m, k) => {
    if (k === 'nom') return ctx.nom || 'Pilote';
    if (k === 'voiture') return ctx.voiture || 'voiture';
    if (k === 'suivante') return ctx.suivante || 'la prochaine épreuve';
    return ctx.position != null ? String(ctx.position) : '?';
  });
}

export function fillName(text, name) {
  return fillText(text, { nom: name });
}
