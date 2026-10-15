// Portraits vectoriels stylisés des personnages (SVG).
export function portraitSVG(ch, size = 220) {
  const s = ch.skin || '#d9a982';
  const h = ch.hair || '#3b2a20';
  const c = ch.clothes || '#333';
  const acc = ch.color || '#3d8bff';
  let hair = '';
  switch (ch.hairStyle) {
    case 'bun':
      hair = `<circle cx="100" cy="38" r="20" fill="${h}"/><path d="M52 88 Q50 40 100 36 Q150 40 148 88 Q140 62 100 58 Q60 62 52 88Z" fill="${h}"/>`;
      break;
    case 'slick':
      hair = `<path d="M54 84 Q52 36 104 34 Q152 38 148 80 Q138 56 112 54 Q84 50 54 84Z" fill="${h}"/>`;
      break;
    case 'side':
      hair = `<path d="M54 86 Q54 40 100 38 Q148 40 148 86 L140 70 Q120 52 70 60Z" fill="${h}"/>`;
      break;
    case 'long':
      hair = `<path d="M48 150 Q40 40 100 36 Q160 40 152 150 L140 150 Q146 70 100 60 Q56 70 62 150Z" fill="${h}"/>`;
      break;
    default:
      hair = `<path d="M54 84 Q54 40 100 38 Q146 40 146 84 Q138 60 100 58 Q62 60 54 84Z" fill="${h}"/>`;
  }
  const beard = ch.beard ? `<path d="M62 104 Q66 150 100 152 Q134 150 138 104 Q128 128 100 130 Q72 128 62 104Z" fill="${h}" opacity="0.92"/>` : '';
  const glasses = ch.glasses ? `<g fill="none" stroke="#222" stroke-width="3"><circle cx="82" cy="94" r="11"/><circle cx="118" cy="94" r="11"/><path d="M93 94 H107"/></g>` : '';
  const tie = ch.tie ? `<path d="M96 168 L104 168 L108 210 L100 220 L92 210Z" fill="#7a1c1c"/>` : '';
  const headset = ch.headset ? `<path d="M54 92 Q54 34 100 34 Q146 34 146 92" fill="none" stroke="#222" stroke-width="6"/><rect x="44" y="84" width="14" height="24" rx="5" fill="#222"/><path d="M50 106 Q60 130 84 128" fill="none" stroke="#222" stroke-width="3"/>` : '';
  return `<svg viewBox="0 0 200 220" width="${size}" height="${size * 1.1}" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="g${acc.slice(1)}" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${acc}" stop-opacity="0.45"/><stop offset="1" stop-color="${acc}" stop-opacity="0"/></radialGradient></defs>
  <rect width="200" height="220" fill="url(#g${acc.slice(1)})"/>
  <path d="M28 220 Q32 168 100 160 Q168 168 172 220Z" fill="${c}"/>
  <path d="M84 150 L116 150 L112 172 Q100 180 88 172Z" fill="${s}"/>
  ${tie}
  <ellipse cx="100" cy="96" rx="44" ry="54" fill="${s}"/>
  <ellipse cx="56" cy="100" rx="7" ry="12" fill="${s}"/><ellipse cx="144" cy="100" rx="7" ry="12" fill="${s}"/>
  ${hair}
  <ellipse cx="82" cy="94" rx="5" ry="4" fill="#1d1d22"/><ellipse cx="118" cy="94" rx="5" ry="4" fill="#1d1d22"/>
  <path d="M72 82 Q82 77 92 82" stroke="${h}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <path d="M108 82 Q118 77 128 82" stroke="${h}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <path d="M100 98 Q96 112 100 116 Q104 117 106 114" stroke="rgba(0,0,0,0.25)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M86 128 Q100 134 114 128" stroke="#8a3a34" stroke-width="3" fill="none" stroke-linecap="round"/>
  ${beard}${glasses}${headset}
</svg>`;
}
