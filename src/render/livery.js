// Livrées : peinture de l'atlas de la carrosserie (flancs droit / gauche, dessus) en coordonnées métriques,
// donc sans déformation. Motifs du contrat (stripes, side, racing, split, gradient, chevron, retro), numéro dans
// un cartouche lisible des deux côtés, sponsors, lignes d'ouvrants (portes, capot, coffre, trappe à carburant).
import * as THREE from 'three';
import { clamp, lerp } from '../core/utils.js';
import { ATLAS, SWATCH } from './carBody.js';
import { SPONSORS } from '../world/textures.js';

export const LIVERY_DESIGNS = ['none', 'stripes', 'side', 'racing', 'split', 'gradient', 'chevron', 'retro'];

const cache = new Map();
const CACHE_MAX = 24;

// Couleur lisible sur un fond donné
export function contrast(hex) {
  const c = new THREE.Color(hex);
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return l > 0.45 ? '#111418' : '#f4f5f2';
}

// Peint la texture d'une voiture. layout : géométrie utile (voir CarModel.liveryLayout) ;
// opts : { color, design, color2, color3, number, sponsors, sponsorIdx, base: true pour une texture neutre }
export function paintLivery(layout, opts, res = 1024) {
  const design = opts.base ? 'base' : opts.design || 'none';
  const key = [layout.key, res, design, opts.color, opts.color2, opts.color3, opts.number, opts.sponsors, opts.sponsorIdx].join('|');
  let t = cache.get(key);
  if (t) return t;
  const W = res, H = res;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const A = layout.atlas;
  const P = ATLAS.pad;
  const span = A.zMax - A.zMin;
  // conversions métriques → pixels
  const sx = (z, right) => (right ? (A.zMax - z) / span : (z - A.zMin) / span) * W;
  const sy = (y, right) => {
    const [v0, v1] = right ? ATLAS.right : ATLAS.left;
    return (1 - (v0 + P + clamp(y / A.yMax, -0.2, 1.2) * (v1 - v0 - 2 * P))) * H;
  };
  const tx = (z) => ((A.zMax - z) / span) * W;
  const ty = (x) => (1 - (P + ((A.xMax - x) / (2 * A.xMax)) * (0.5 - 2 * P))) * H;
  const pxPerM = W / span;
  const base = opts.base ? '#ffffff' : opts.color || '#c00';
  const c1 = opts.color2 || contrast(base);
  const c2 = opts.color3 || (opts.color2 ? contrast(opts.color2) : '#d4001a');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  const prof = layout.prof; // [{ z, W, top, topF, bot, ys }]
  const at = (z) => {
    let i = 0;
    while (i < prof.length - 2 && prof[i + 1].z < z) i++;
    const a = prof[i], b = prof[i + 1];
    const u = clamp((z - a.z) / (b.z - a.z || 1), 0, 1);
    return { W: lerp(a.W, b.W, u), top: lerp(a.top, b.top, u), topF: lerp(a.topF, b.topF, u), bot: lerp(a.bot, b.bot, u), ys: lerp(a.ys, b.ys, u) };
  };
  // tracé d'un polygone métrique sur les deux flancs
  const sidePoly = (pts, fill) => {
    for (const right of [true, false]) {
      g.beginPath();
      pts.forEach(([z, y], i) => g[i ? 'lineTo' : 'moveTo'](sx(z, right), sy(y, right)));
      g.closePath();
      g.fillStyle = fill;
      g.fill();
    }
  };
  const topPoly = (pts, fill) => {
    g.beginPath();
    pts.forEach(([z, x], i) => g[i ? 'lineTo' : 'moveTo'](tx(z), ty(x)));
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  // bande longitudinale sur les flancs entre deux hauteurs (fonctions de z)
  const sideBand = (z0, z1, yLo, yHi, fill, n = 48) => {
    const pts = [];
    for (let i = 0; i <= n; i++) { const z = lerp(z0, z1, i / n); pts.push([z, yHi(z)]); }
    for (let i = n; i >= 0; i--) { const z = lerp(z0, z1, i / n); pts.push([z, yLo(z)]); }
    sidePoly(pts, fill);
  };
  const L = layout;
  const zF = L.zF, zR = L.zR;
  const doorMid = (L.panel.z0 + L.panel.z1) / 2;
  const sideMidY = (L.sill + L.belt) / 2;

  // ------------------------------------------------------------ motifs
  if (design === 'stripes') {
    const w = 0.13, gap = 0.035;
    for (const s of [-1, 1]) {
      const xa = s * gap, xb = s * (gap + w);
      topPoly([[A.zMin, xa], [A.zMax, xa], [A.zMax, xb], [A.zMin, xb]], c1);
      const xp = s * (gap + w + 0.012);
      topPoly([[A.zMin, xb + s * 0.004], [A.zMax, xb + s * 0.004], [A.zMax, xp], [A.zMin, xp]], c2 === c1 ? base : c2);
    }
  } else if (design === 'side') {
    const yHi = (z) => at(z).ys - 0.03 - (z - zF) * 0.012, yLo = (z) => yHi(z) - 0.09;
    sideBand(zF + 0.1, zR - 0.15, yLo, yHi, c1);
    sideBand(zF + 0.1, zR - 0.15, (z) => yLo(z) - 0.03, (z) => yLo(z) - 0.018, c2);
  } else if (design === 'split') {
    sideBand(A.zMin, A.zMax, () => -0.1, (z) => Math.min(at(z).ys - 0.02, L.belt - 0.08), c1);
    sideBand(A.zMin, A.zMax, (z) => Math.min(at(z).ys - 0.02, L.belt - 0.08), (z) => Math.min(at(z).ys - 0.006, L.belt - 0.066), c2);
  } else if (design === 'gradient') {
    for (const right of [true, false]) {
      const gr = g.createLinearGradient(sx(zF, right), 0, sx(zR, right), 0);
      gr.addColorStop(0, c1); gr.addColorStop(0.35, c1); gr.addColorStop(0.8, hexA(c1, 0));
      g.fillStyle = gr;
      const [v0, v1] = right ? ATLAS.right : ATLAS.left;
      g.fillRect(0, (1 - v1) * H, W, (v1 - v0) * H);
    }
    const gr = g.createLinearGradient(tx(zF), 0, tx(L.zWS), 0);
    gr.addColorStop(0, c1); gr.addColorStop(1, hexA(c1, 0));
    g.fillStyle = gr;
    g.fillRect(0, H * 0.5, W, H * 0.5);
  } else if (design === 'chevron') {
    const zc = lerp(L.zAxleF, L.zAxleR, 0.42), hh = (L.belt - L.sill) * 0.5;
    for (const [dz, col] of [[0, c1], [0.32, c2]]) {
      const z0 = zc + dz;
      sidePoly([[z0 - 0.38, sideMidY], [z0 + 0.05, sideMidY + hh], [z0 + 0.25, sideMidY + hh], [z0 - 0.18, sideMidY], [z0 + 0.25, sideMidY - hh], [z0 + 0.05, sideMidY - hh]], col);
    }
    const zh = lerp(zF, L.zWS, 0.45), wh = L.W * 0.55;
    topPoly([[zh - 0.3, 0], [zh + 0.1, wh], [zh + 0.28, wh], [zh - 0.12, 0], [zh + 0.28, -wh], [zh + 0.1, -wh]], c1);
  } else if (design === 'retro') {
    // trois filets qui remontent sur l'aile arrière
    const yb = (z) => {
      const u = clamp((z - L.zAxleR + L.archR * 2.2) / (L.archR * 2.5), 0, 1);
      return lerp(sideMidY - 0.02, at(z).ys - 0.02, u * u * (3 - 2 * u));
    };
    const bands = [[0, 0.07, c1], [0.085, 0.11, c2], [0.125, 0.145, c1]];
    for (const [a, b, col] of bands) sideBand(zF + 0.05, zR - 0.05, (z) => yb(z) - b, (z) => yb(z) - a, col);
    topPoly([[A.zMin, 0.16], [A.zMax, 0.16], [A.zMax, -0.16], [A.zMin, -0.16]], c1);
    for (const s of [-1, 1]) topPoly([[A.zMin, s * 0.18], [A.zMax, s * 0.18], [A.zMax, s * 0.205], [A.zMin, s * 0.205]], c2);
  } else if (design === 'racing') {
    // bas de caisse et face avant colorés avec une diagonale montante, filet d'accent, bande centrale
    const yEdge = (z) => {
      const u = clamp((z - zF) / (zR - zF), 0, 1);
      return lerp(at(z).topF + 0.1, L.sill + 0.05, Math.pow(u, 0.75));
    };
    sideBand(A.zMin, A.zMax, () => -0.1, yEdge, c1, 64);
    sideBand(A.zMin, A.zMax, (z) => yEdge(z), (z) => yEdge(z) + 0.035, c2, 64);
    topPoly([[A.zMin, 0.22], [A.zMax, 0.22], [A.zMax, -0.22], [A.zMin, -0.22]], c1);
    for (const s of [-1, 1]) topPoly([[A.zMin, s * 0.235], [A.zMax, s * 0.235], [A.zMax, s * 0.26], [A.zMin, s * 0.26]], c2);
    // nez coloré
    topPoly([[A.zMin, -A.xMax], [zF + 0.35, -A.xMax], [zF + 0.2, 0], [zF + 0.35, A.xMax], [A.zMin, A.xMax]], c1);
  }

  // ------------------------------------------------------------ sponsors
  if (opts.sponsors) {
    const k0 = opts.sponsorIdx ?? 0;
    const sponsorAt = (k, zc, yc, w, h, right) => {
      const [text, bg, fg] = SPONSORS[(k0 + k) % SPONSORS.length];
      const x = sx(zc, right), y = sy(yc, right);
      const pw = w * pxPerM, ph = h * pxPerM * 0.94;
      g.fillStyle = bg;
      g.fillRect(x - pw / 2, y - ph / 2, pw, ph);
      g.fillStyle = fg;
      g.font = `bold ${Math.round(ph * 0.7)}px Arial, Helvetica, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, x, y + ph * 0.04, pw * 0.92);
    };
    for (const right of [true, false]) {
      // aile avant (derrière la roue), bas de caisse, aile arrière
      const zFe = L.zAxleF + L.archR + 0.2;
      if (zFe + 0.18 < L.panel.z0 + 0.15) sponsorAt(1, zFe, at(zFe).ys - 0.1, 0.34, 0.09, right);
      sponsorAt(2, doorMid, L.sill + 0.06, Math.min(1.2, (L.panel.z1 - L.panel.z0) * 0.8), 0.07, right);
      const zRe = L.zAxleR + L.archR * 0.2;
      sponsorAt(3, zRe, at(zRe).ys - 0.08, 0.32, 0.08, right);
    }
    // capot : grand sponsor lisible depuis l'avant
    const [text, bg, fg] = SPONSORS[(k0 + 4) % SPONSORS.length];
    const zh = lerp(zF, L.zWS, 0.55);
    g.save();
    g.translate(tx(zh), ty(0));
    g.rotate(-Math.PI / 2);
    const pw = Math.min(L.W * 1.1, 0.95) * pxPerM, ph = 0.16 * pxPerM;
    g.fillStyle = bg;
    g.fillRect(-pw / 2, -ph / 2, pw, ph);
    g.fillStyle = fg;
    g.font = `bold ${Math.round(ph * 0.66)}px Arial, Helvetica, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 0, ph * 0.04, pw * 0.92);
    g.restore();
  }

  // ------------------------------------------------------------ numéro (portes + toit)
  if (opts.number !== null && opts.number !== undefined && design !== 'base') {
    const num = String(opts.number);
    const roundel = (x, y, w, h, rot = 0) => {
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      g.fillStyle = '#f7f7f4';
      g.strokeStyle = '#121212';
      g.lineWidth = Math.max(2, h * 0.05);
      roundRect(g, -w / 2, -h / 2, w, h, h * 0.18);
      g.fill();
      g.stroke();
      g.fillStyle = '#121212';
      g.font = `bold ${Math.round(h * 0.78)}px 'Arial Black', Arial, Helvetica, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(num, 0, h * 0.04, w * 0.86);
      g.restore();
    };
    const hM = clamp((L.belt - L.sill) * 0.6, 0.2, 0.32);
    const wM = hM * (num.length > 1 ? 1.2 : 0.9);
    for (const right of [true, false]) roundel(sx(doorMid, right), sy(sideMidY + 0.02, right), wM * pxPerM, hM * pxPerM);
    // toit (lisible depuis le côté droit)
    const zRoof = (L.zRoofF + L.zRoofB) / 2;
    roundel(tx(zRoof), ty(0), 0.34 * pxPerM, Math.min(0.3, L.roofW * 0.9) * pxPerM);
  }

  // ------------------------------------------------------------ lignes d'ouvrants
  const lineW = Math.max(1.6, pxPerM * 0.006);
  const dark = opts.base ? 'rgba(0,0,0,0.62)' : 'rgba(0,0,0,0.55)';
  const sideLine = (pts) => {
    for (const right of [true, false]) {
      g.beginPath();
      pts.forEach(([z, y], i) => g[i ? 'lineTo' : 'moveTo'](sx(z, right), sy(y, right)));
      g.strokeStyle = dark;
      g.lineWidth = lineW;
      g.stroke();
    }
  };
  const topLine = (pts) => {
    g.beginPath();
    pts.forEach(([z, x], i) => g[i ? 'lineTo' : 'moveTo'](tx(z), ty(x)));
    g.strokeStyle = dark;
    g.lineWidth = lineW;
    g.stroke();
  };
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // portes
  for (const d of L.doors) {
    const yb = L.sill + 0.045;
    sideLine([[d.z0, L.belt - 0.005], [d.z0, yb + 0.03], [d.z0 + 0.03, yb], [d.z1 - 0.03, yb], [d.z1, yb + 0.03], [d.z1, L.belt - 0.005]]);
  }
  // jonctions bouclier / ailes
  if (!L.race) {
    const zA = L.zAxleF - L.archR * 0.92, zB = zF + 0.24;
    sideLine([[zB, at(zB).topF - 0.06], [lerp(zA, zB, 0.5), lerp(L.archTopF, at(zB).topF - 0.06, 0.55)], [zA, L.archTopF - 0.05]]);
    const zC = L.zAxleR + L.archR * 0.92, zD = zR - 0.24;
    sideLine([[zD, at(zD).topF - 0.07], [lerp(zC, zD, 0.5), lerp(L.archTopR, at(zD).topF - 0.07, 0.55)], [zC, L.archTopR - 0.05]]);
  }
  // trappe à carburant (flanc droit)
  if (L.fuel) {
    const { z, y, r } = L.fuel;
    g.beginPath();
    roundRect(g, sx(z, true) - r * pxPerM, sy(y, true) - r * pxPerM, 2 * r * pxPerM, 2 * r * pxPerM, r * pxPerM * 0.35);
    g.strokeStyle = dark;
    g.lineWidth = lineW;
    g.stroke();
  }
  // capot
  if (L.hood) {
    const { z0, z1 } = L.hood;
    const pts = [];
    const n = 14;
    for (let i = n; i >= 0; i--) { const z = lerp(z0 + 0.06, z1, i / n); pts.push([z, -at(z).W * L.hoodK]); }
    for (let i = 0; i <= n; i++) { const x = lerp(-1, 1, i / n); pts.push([z0 + 0.06 - 0.05 * (1 - x * x), x * at(z0 + 0.06).W * L.hoodK]); }
    for (let i = 0; i <= n; i++) { const z = lerp(z0 + 0.06, z1, i / n); pts.push([z, at(z).W * L.hoodK]); }
    topLine(pts);
  }
  // coffre / capot moteur
  if (L.trunk) {
    const { z0, z1 } = L.trunk;
    topLine([[z1, at(z1).W * 0.74], [z0, at(z0).W * 0.74], [z0, -at(z0).W * 0.74], [z1, -at(z1).W * 0.74]]);
  }
  // ombre au ras du sol (occlusion le long du bas de caisse)
  for (const right of [true, false]) {
    const step = 6;
    for (let px = 0; px < W; px += step) {
      const u = (px + step / 2) / W;
      const z = right ? A.zMax - u * span : A.zMin + u * span;
      if (z < zF || z > zR) continue;
      const b = at(z).bot;
      const y0 = sy(b + 0.1, right), y1 = sy(b - 0.02, right);
      const gr = g.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,0,0.3)');
      g.fillStyle = gr;
      g.fillRect(px, y0, step, y1 - y0);
    }
  }
  // pastilles de couleur unie (pièces rapportées)
  const sw = (uv, col) => { g.fillStyle = col; g.fillRect(0, (1 - uv[1]) * H - 0.035 * H, 0.009 * W, 0.07 * H); };
  sw(SWATCH.base, base);
  sw(SWATCH.color2, opts.base ? '#ffffff' : c1);
  sw(SWATCH.dark, '#0b0c0e');

  t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  if (cache.size >= CACHE_MAX) {
    const k = cache.keys().next().value;
    const old = cache.get(k);
    cache.delete(k);
    if (old.__users === 0) old.dispose();
  }
  t.__users = 0;
  cache.set(key, t);
  return t;
}

// Libère une texture de livrée (compteur d'utilisateurs ; détruite si elle n'est plus en cache)
export function releaseLivery(t) {
  if (!t) return;
  t.__users = Math.max(0, (t.__users || 0) - 1);
  if (t.__users === 0 && ![...cache.values()].includes(t)) t.dispose();
}

function hexA(hex, a) {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}
