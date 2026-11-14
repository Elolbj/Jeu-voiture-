// Portraits vectoriels stylisés des personnages (SVG) : coiffure, accessoires et expression (mood).
const HAIR = {
  bun: (h) => `<circle cx="100" cy="38" r="20" fill="${h}"/><path d="M52 88 Q50 40 100 36 Q150 40 148 88 Q140 62 100 58 Q60 62 52 88Z" fill="${h}"/>`,
  slick: (h) => `<path d="M54 84 Q52 36 104 34 Q152 38 148 80 Q138 56 112 54 Q84 50 54 84Z" fill="${h}"/>`,
  side: (h) => `<path d="M54 86 Q54 40 100 38 Q148 40 148 86 L140 70 Q120 52 70 60Z" fill="${h}"/>`,
  long: (h) => `<path d="M48 150 Q40 40 100 36 Q160 40 152 150 L140 150 Q146 70 100 60 Q56 70 62 150Z" fill="${h}"/>`,
  // carré court à frange droite
  bob: (h) => `<path d="M46 128 Q40 38 100 34 Q160 38 154 128 Q150 136 140 132 L142 96 Q140 78 132 74 L68 74 Q60 78 58 96 L60 132 Q50 136 46 128Z" fill="${h}"/><path d="M58 76 Q60 50 100 46 Q140 50 142 76 Q122 70 100 72 Q78 70 58 76Z" fill="${h}"/><path d="M70 50 Q96 42 128 52" stroke="rgba(255,255,255,0.18)" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  // crâne dégarni, couronne sur les côtés
  bald: (h) => `<path d="M54 100 Q50 70 62 60 Q58 80 62 98Z" fill="${h}"/><path d="M146 100 Q150 70 138 60 Q142 80 138 98Z" fill="${h}"/><path d="M78 52 Q92 46 106 48" stroke="rgba(255,255,255,0.35)" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  short: (h) => `<path d="M54 84 Q54 40 100 38 Q146 40 146 84 Q138 60 100 58 Q62 60 54 84Z" fill="${h}"/>`,
};

// Sourcils et bouche selon l'expression
function face(mood, h) {
  let browL = 'M72 82 Q82 77 92 82', browR = 'M108 82 Q118 77 128 82';
  let mouth = '<path d="M86 128 Q100 134 114 128" stroke="#8a3a34" stroke-width="3" fill="none" stroke-linecap="round"/>';
  if (mood === 'smile') {
    mouth = '<path d="M84 124 Q100 140 116 124 Q100 132 84 124Z" fill="#7a2e2a" stroke="#8a3a34" stroke-width="2.5" stroke-linejoin="round"/>';
  } else if (mood === 'angry') {
    browL = 'M72 78 Q84 80 93 86';
    browR = 'M107 86 Q116 80 128 78';
    mouth = '<path d="M88 131 Q100 127 112 131" stroke="#8a3a34" stroke-width="3" fill="none" stroke-linecap="round"/>';
  } else if (mood === 'sad') {
    browL = 'M72 84 Q82 80 92 76';
    browR = 'M108 76 Q118 80 128 84';
    mouth = '<path d="M88 132 Q100 125 112 132" stroke="#8a3a34" stroke-width="3" fill="none" stroke-linecap="round"/>';
  } else if (mood === 'smirk') {
    browR = 'M108 78 Q118 73 128 79';
    mouth = '<path d="M88 129 Q104 131 116 122" stroke="#8a3a34" stroke-width="3" fill="none" stroke-linecap="round"/>';
  }
  const brow = (d) => `<path d="${d}" stroke="${h}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  return brow(browL) + brow(browR) + mouth;
}

export function portraitSVG(ch, size = 220, mood = '') {
  const s = ch.skin || '#d9a982';
  const h = ch.hair || '#3b2a20';
  const c = ch.clothes || '#333';
  const acc = ch.color || '#3d8bff';
  const gid = 'g' + acc.slice(1);
  const hair = (HAIR[ch.hairStyle] || HAIR.short)(h);
  const beard = ch.beard ? `<path d="M62 104 Q66 150 100 152 Q134 150 138 104 Q128 128 100 130 Q72 128 62 104Z" fill="${h}" opacity="0.92"/>` : '';
  const mustache = ch.mustache ? `<path d="M80 120 Q90 112 100 117 Q110 112 120 120 Q122 126 112 124 Q104 121 100 122 Q96 121 88 124 Q78 126 80 120Z" fill="${h}"/>` : '';
  const glasses = ch.glasses ? `<g fill="none" stroke="#222" stroke-width="3"><circle cx="82" cy="94" r="11"/><circle cx="118" cy="94" r="11"/><path d="M93 94 H107"/></g>` : '';
  const tie = ch.tie ? `<path d="M96 168 L104 168 L108 210 L100 220 L92 210Z" fill="#7a1c1c"/>` : '';
  // combinaison de pilote : col montant et bande de couleur
  const suit = ch.suit ? `<path d="M80 160 L100 176 L120 160 L122 170 L100 186 L78 170Z" fill="${ch.suit}"/><path d="M40 204 Q70 194 100 200 Q130 194 160 204 L162 214 Q130 204 100 210 Q70 204 38 214Z" fill="${ch.suit}" opacity="0.85"/><rect x="126" y="184" width="18" height="10" rx="2" fill="${acc}"/>` : '';
  const earrings = ch.earrings ? `<circle cx="56" cy="114" r="3.2" fill="${ch.earrings}"/><circle cx="144" cy="114" r="3.2" fill="${ch.earrings}"/>` : '';
  const cap = ch.cap ? `<path d="M54 76 Q54 34 100 32 Q146 34 146 76 Q124 66 100 66 Q76 66 54 76Z" fill="${ch.cap}"/><path d="M54 76 Q100 62 150 74 Q170 78 172 86 Q130 78 100 78 Q72 78 54 82Z" fill="${ch.cap}" stroke="rgba(0,0,0,0.25)" stroke-width="2"/><circle cx="100" cy="36" r="3" fill="rgba(0,0,0,0.3)"/><path d="M84 50 Q100 44 116 50" stroke="${acc}" stroke-width="5" fill="none" stroke-linecap="round"/>` : '';
  const headset = ch.headset ? `<path d="M54 92 Q54 34 100 34 Q146 34 146 92" fill="none" stroke="#222" stroke-width="6"/><rect x="44" y="84" width="14" height="24" rx="5" fill="#222"/><path d="M50 106 Q60 130 84 128" fill="none" stroke="#222" stroke-width="3"/>` : '';
  return `<svg viewBox="0 0 200 220" width="${size}" height="${Math.round(size * 1.1)}" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="${gid}" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${acc}" stop-opacity="0.45"/><stop offset="1" stop-color="${acc}" stop-opacity="0"/></radialGradient></defs>
  <rect width="200" height="220" fill="url(#${gid})"/>
  <path d="M28 220 Q32 168 100 160 Q168 168 172 220Z" fill="${c}"/>
  <path d="M84 150 L116 150 L112 172 Q100 180 88 172Z" fill="${s}"/>
  ${suit}${tie}
  <ellipse cx="100" cy="96" rx="44" ry="54" fill="${s}"/>
  <ellipse cx="56" cy="100" rx="7" ry="12" fill="${s}"/><ellipse cx="144" cy="100" rx="7" ry="12" fill="${s}"/>
  ${hair}${earrings}
  <ellipse cx="82" cy="94" rx="5" ry="4" fill="#1d1d22"/><ellipse cx="118" cy="94" rx="5" ry="4" fill="#1d1d22"/>
  <circle cx="83.6" cy="92.6" r="1.3" fill="#fff" opacity="0.8"/><circle cx="119.6" cy="92.6" r="1.3" fill="#fff" opacity="0.8"/>
  <path d="M100 98 Q96 112 100 116 Q104 117 106 114" stroke="rgba(0,0,0,0.25)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  ${face(mood, h)}
  ${beard}${mustache}${glasses}${cap}${headset}
</svg>`;
}
