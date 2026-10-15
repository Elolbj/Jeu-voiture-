// Textures procédurales (canvas) : asphalte, vibreurs, herbe, graviers, façades, foules,
// bannières publicitaires, damier, eau, fumée… Mises en cache.
import * as THREE from 'three';
import { Noise2D } from '../core/noise.js';
import { rng, clamp } from '../core/utils.js';

const cache = new Map();
let maxAniso = 8;
export function setMaxAnisotropy(a) {
  maxAniso = a;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function tex(c, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  t.needsUpdate = true;
  return t;
}

function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

// Bruit périodique (tuilable) sur une grille w×h
function tileNoise(noise, x, y, w, h, scale) {
  // Mélange de 4 échantillons pour obtenir une texture répétable
  const u = x / w, v = y / h;
  const a = noise.noise(x * scale, y * scale);
  const b = noise.noise((x - w) * scale, y * scale);
  const c = noise.noise(x * scale, (y - h) * scale);
  const d = noise.noise((x - w) * scale, (y - h) * scale);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function heightToNormal(height, w, h, strength = 2) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const xl = height[y * w + ((x - 1 + w) % w)], xr = height[y * w + ((x + 1) % w)];
      const yu = height[((y - 1 + h) % h) * w + x], yd = height[((y + 1) % h) * w + x];
      let nx = (xl - xr) * strength, ny = (yu - yd) * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const k = (y * w + x) * 4;
      img.data[k] = (nx * 0.5 + 0.5) * 255;
      img.data[k + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[k + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// --------------------------------------------------------------------------------
export function asphalt() {
  return cached('asphalt', () => {
    const N = 512;
    const noise = new Noise2D(11);
    const r = rng(5);
    const h = new Float32Array(N * N);
    const c = canvas(N, N);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(N, N);
    const rough = canvas(N, N);
    const rctx = rough.getContext('2d');
    const rimg = rctx.createImageData(N, N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const big = tileNoise(noise, x, y, N, N, 0.012);
        const mid = tileNoise(noise, x + 100, y + 50, N, N, 0.06);
        const grain = r() - 0.5;
        let v = 0.25 + big * 0.035 + mid * 0.03 + grain * 0.09;
        // granulats clairs
        if (r() < 0.035) v += 0.12 + r() * 0.12;
        if (r() < 0.02) v -= 0.08;
        v = clamp(v, 0.05, 0.75);
        h[y * N + x] = grain * 0.6 + (r() < 0.035 ? 0.8 : 0) + mid * 0.3;
        const k = (y * N + x) * 4;
        const base = v * 255;
        img.data[k] = base * 0.98;
        img.data[k + 1] = base * 0.99;
        img.data[k + 2] = base * 1.03;
        img.data[k + 3] = 255;
        const ro = clamp(0.82 + big * 0.1 - mid * 0.05 + grain * 0.1, 0.55, 1) * 255;
        rimg.data[k] = rimg.data[k + 1] = rimg.data[k + 2] = ro;
        rimg.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    rctx.putImageData(rimg, 0, 0);
    // Fissures et raccords fins
    ctx.strokeStyle = 'rgba(15,15,16,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      let x = r() * N, y = r() * N;
      ctx.moveTo(x, y);
      for (let k = 0; k < 12; k++) {
        x += (r() - 0.5) * 30;
        y += (r() - 0.5) * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    return {
      map: tex(c),
      normalMap: tex(heightToNormal(h, N, N, 1.6), { srgb: false }),
      roughnessMap: tex(rough, { srgb: false }),
    };
  });
}

export function curb(colA = '#c8102e', colB = '#f2f2ef') {
  return cached('curb' + colA + colB, () => {
    const c = canvas(64, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = colA;
    ctx.fillRect(0, 0, 64, 128);
    ctx.fillStyle = colB;
    ctx.fillRect(0, 128, 64, 128);
    // salissures / gomme
    const r = rng(3);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(30,30,30,${r() * 0.15})`;
      ctx.fillRect(r() * 64, r() * 256, 2 + r() * 4, 2 + r() * 6);
    }
    const t = tex(c);
    return t;
  });
}

export function grass(tint = [0.32, 0.45, 0.2]) {
  const key = 'grass' + tint.join(',');
  return cached(key, () => {
    const N = 512;
    const c = canvas(N, N);
    const ctx = c.getContext('2d');
    const noise = new Noise2D(7);
    const r = rng(9);
    const img = ctx.createImageData(N, N);
    const h = new Float32Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const n = tileNoise(noise, x, y, N, N, 0.02) * 0.5 + tileNoise(noise, x + 37, y + 91, N, N, 0.08) * 0.3;
        const g = r();
        const k = (y * N + x) * 4;
        const l = 0.75 + n * 0.35 + (g - 0.5) * 0.35;
        img.data[k] = clamp(tint[0] * l, 0, 1) * 255;
        img.data[k + 1] = clamp(tint[1] * l, 0, 1) * 255;
        img.data[k + 2] = clamp(tint[2] * l, 0, 1) * 255;
        img.data[k + 3] = 255;
        h[y * N + x] = g * 0.8 + n;
      }
    }
    ctx.putImageData(img, 0, 0);
    // brins
    for (let i = 0; i < 9000; i++) {
      const x = r() * N, y = r() * N;
      const l = 0.6 + r() * 0.7;
      ctx.strokeStyle = `rgba(${(tint[0] * l * 255) | 0},${(tint[1] * l * 255) | 0},${(tint[2] * l * 255) | 0},0.7)`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 4);
      ctx.stroke();
    }
    return { map: tex(c), normalMap: tex(heightToNormal(h, N, N, 1.2), { srgb: false }) };
  });
}

export function gravel() {
  return cached('gravel', () => {
    const N = 512;
    const c = canvas(N, N);
    const ctx = c.getContext('2d');
    const r = rng(21);
    const h = new Float32Array(N * N);
    ctx.fillStyle = '#9b8d76';
    ctx.fillRect(0, 0, N, N);
    for (let i = 0; i < 26000; i++) {
      const x = r() * N, y = r() * N, s = 1 + r() * 3.2;
      const l = 120 + r() * 110;
      ctx.fillStyle = `rgb(${l | 0},${(l * 0.93) | 0},${(l * 0.8) | 0})`;
      ctx.beginPath();
      ctx.ellipse(x, y, s, s * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2);
      ctx.fill();
      const ix = x | 0, iy = y | 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const xx = (ix + dx + N) % N, yy = (iy + dy + N) % N;
          h[yy * N + xx] = Math.max(h[yy * N + xx], 1 - Math.hypot(dx, dy) / 3);
        }
    }
    return { map: tex(c), normalMap: tex(heightToNormal(h, N, N, 2.5), { srgb: false }) };
  });
}

// Texture de détail générique (niveaux de gris) pour le terrain : multipliée par les couleurs.
export function terrainDetail() {
  return cached('terrainDetail', () => {
    const N = 512;
    const c = canvas(N, N);
    const ctx = c.getContext('2d');
    const noise = new Noise2D(33);
    const r = rng(4);
    const img = ctx.createImageData(N, N);
    const h = new Float32Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const n = tileNoise(noise, x, y, N, N, 0.03) * 0.5 + tileNoise(noise, x, y, N, N, 0.12) * 0.25;
        const g = r() - 0.5;
        const v = clamp(0.82 + n * 0.25 + g * 0.22, 0.3, 1);
        const k = (y * N + x) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = v * 255;
        img.data[k + 3] = 255;
        h[y * N + x] = n + g * 0.5;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { map: tex(c, { srgb: false }), normalMap: tex(heightToNormal(h, N, N, 1.5), { srgb: false }) };
  });
}

export function concrete(base = 178) {
  return cached('concrete' + base, () => {
    const N = 256;
    const c = canvas(N, N);
    const ctx = c.getContext('2d');
    const noise = new Noise2D(8);
    const r = rng(77);
    const img = ctx.createImageData(N, N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const n = tileNoise(noise, x, y, N, N, 0.05);
        const v = base + n * 18 + (r() - 0.5) * 14;
        const k = (y * N + x) * 4;
        img.data[k] = v; img.data[k + 1] = v; img.data[k + 2] = v * 0.98; img.data[k + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    // coulures
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(60,55,50,${r() * 0.12})`;
      const x = r() * N;
      ctx.fillRect(x, 0, 2 + r() * 4, N * r());
    }
    return tex(c);
  });
}

export function checker() {
  return cached('checker', () => {
    const c = canvas(256, 64);
    const ctx = c.getContext('2d');
    const s = 16;
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 16; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4';
        ctx.fillRect(x * s, y * s, s, s);
      }
    return tex(c);
  });
}

// Façade d'immeuble : fenêtres (couleur + carte émissive pour la nuit)
export function facade(seed, night) {
  return cached('facade' + seed + night, () => {
    const W = 256, H = 512;
    const c = canvas(W, H);
    const e = canvas(W, H);
    const ctx = c.getContext('2d');
    const ectx = e.getContext('2d');
    const r = rng(seed * 13 + 1);
    const tones = [[196, 190, 178], [150, 152, 158], [120, 108, 98], [210, 205, 196], [90, 96, 108], [170, 150, 120]];
    const tone = tones[seed % tones.length];
    ctx.fillStyle = `rgb(${tone[0]},${tone[1]},${tone[2]})`;
    ctx.fillRect(0, 0, W, H);
    ectx.fillStyle = '#000';
    ectx.fillRect(0, 0, W, H);
    const cols = 6 + (seed % 3), rows = 14;
    const cw = W / cols, rh = H / rows;
    const glassy = seed % 4 === 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = x * cw + cw * 0.15, py = y * rh + rh * 0.18, pw = cw * 0.7, ph = rh * 0.6;
        const g = 30 + r() * 30;
        ctx.fillStyle = glassy ? `rgb(${g + 20},${g + 35},${g + 50})` : `rgb(${g},${g + 6},${g + 14})`;
        ctx.fillRect(px, py, glassy ? cw : pw, ph);
        if (r() < (night ? 0.42 : 0)) {
          const warm = r() < 0.75;
          const l = 160 + r() * 95;
          ectx.fillStyle = warm ? `rgb(${l},${l * 0.78},${l * 0.45})` : `rgb(${l * 0.7},${l * 0.85},${l})`;
          ectx.fillRect(px, py, glassy ? cw : pw, ph);
        }
      }
    }
    return { map: tex(c), emissiveMap: tex(e) };
  });
}

export function crowd() {
  return cached('crowd', () => {
    // 8 rangées : chaque rangée = une contremarche + une marche (≈1,3 m de profil)
    const W = 512, H = 512;
    const c = canvas(W, H);
    const ctx = c.getContext('2d');
    const r = rng(12);
    const rowH = H / 8;
    const shirts = ['#d33', '#eee', '#36c', '#fc3', '#2a2', '#f80', '#222', '#c5c', '#9cf', '#e44', '#147', '#fff'];
    for (let row = 0; row < 8; row++) {
      const y0 = row * rowH;
      // béton (contremarche) puis sièges
      ctx.fillStyle = '#5b5e66';
      ctx.fillRect(0, y0, W, rowH);
      ctx.fillStyle = '#24418a';
      for (let x = 0; x < W; x += 16) ctx.fillRect(x + 2, y0 + rowH * 0.42, 12, rowH * 0.3);
      for (let x = 0; x < W; x += 16) {
        if (r() < 0.18) continue;
        const px = x + 3 + r() * 3;
        // buste et tête (vus de face)
        ctx.fillStyle = shirts[(r() * shirts.length) | 0];
        ctx.fillRect(px, y0 + rowH * 0.36, 10, rowH * 0.34);
        ctx.fillStyle = r() < 0.6 ? '#e3b996' : r() < 0.5 ? '#9a6a48' : '#5a3a28';
        ctx.beginPath();
        ctx.arc(px + 5, y0 + rowH * 0.27, 4.2, 0, Math.PI * 2);
        ctx.fill();
        if (r() < 0.15) {
          // drapeau / bras levé
          ctx.fillStyle = shirts[(r() * shirts.length) | 0];
          ctx.fillRect(px + 7, y0 + rowH * 0.05, 7, 5);
        }
      }
    }
    return tex(c);
  });
}

export function garageDoors() {
  return cached('garageDoors', () => {
    const W = 256, H = 128;
    const c = canvas(W, H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2a2d33';
    ctx.fillRect(16, 18, W - 32, H - 18);
    ctx.strokeStyle = '#3b3f47';
    ctx.lineWidth = 2;
    for (let y = 26; y < H; y += 10) {
      ctx.beginPath();
      ctx.moveTo(16, y);
      ctx.lineTo(W - 16, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#d4001a';
    ctx.fillRect(16, 6, W - 32, 8);
    return tex(c);
  });
}

export const SPONSORS = [
  ['TRAJECTOIRE', '#0b1f3a', '#ffffff'],
  ['PNEUS ARGOS', '#ffd400', '#111111'],
  ['HUILE MISTRAL', '#d4001a', '#ffffff'],
  ['ÉLAN ÉNERGIE', '#00843d', '#ffffff'],
  ['LUMEN', '#111111', '#ffcc00'],
  ['AUBERT', '#ffffff', '#003da5'],
  ['VELOCE', '#ff6a00', '#ffffff'],
  ['NORDIQUE', '#1b1b1b', '#e8e8e8'],
  ['CAFÉ DU PADDOCK', '#5b3a29', '#f3e3c3'],
  ['KAZE MOTORS', '#e60012', '#ffffff'],
];

export function banner(i) {
  const [text, bg, fg] = SPONSORS[i % SPONSORS.length];
  return cached('banner' + i, () => {
    const c = canvas(512, 96);
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = fg;
    ctx.font = 'bold 62px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 52, 480);
    const t = tex(c);
    return t;
  });
}

export function textTexture(text, { w = 512, h = 128, bg = '#111', fg = '#fff', font = 'bold 72px Arial' } = {}) {
  return cached('txt' + text + w + h + bg + fg + font, () => {
    const c = canvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 4, w - 20);
    return tex(c, { repeat: false });
  });
}

export function waterNormal() {
  return cached('water', () => {
    const N = 256;
    const noise = new Noise2D(99);
    const h = new Float32Array(N * N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        h[y * N + x] = tileNoise(noise, x, y, N, N, 0.04) * 0.6 + tileNoise(noise, x + 9, y + 3, N, N, 0.11) * 0.3;
      }
    return tex(heightToNormal(h, N, N, 3), { srgb: false });
  });
}

export function radialSprite(key, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  return cached('sprite' + key, () => {
    const c = canvas(size, size);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return tex(c, { repeat: false });
  });
}

export function smokeSprite() {
  return cached('smoke', () => {
    const S = 128;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    const noise = new Noise2D(5);
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const dx = (x - S / 2) / (S / 2), dy = (y - S / 2) / (S / 2);
        const d = Math.sqrt(dx * dx + dy * dy);
        const n = noise.fbm(x * 0.05, y * 0.05, 4) * 0.5 + 0.5;
        const a = clamp((1 - d) * 1.3, 0, 1) * (0.55 + n * 0.45);
        const k = (y * S + x) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = 235;
        img.data[k + 3] = a * a * 255;
      }
    ctx.putImageData(img, 0, 0);
    return tex(c, { repeat: false });
  });
}

// Tissu pour les sièges / intérieur
export function fabric() {
  return cached('fabric', () => {
    const c = canvas(64, 64);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2a2a2e';
    ctx.fillRect(0, 0, 64, 64);
    const r = rng(2);
    for (let i = 0; i < 600; i++) {
      ctx.fillStyle = `rgba(${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},0.04)`;
      ctx.fillRect(r() * 64, r() * 64, 1, 1);
    }
    return tex(c);
  });
}

// Livrée de voiture : couleur de base + bandes + numéro (coordonnées u = longueur, v = tour de section)
export function livery({ color, stripe = null, number = null, sponsor = null, style = 0 }) {
  const key = `livery${color}${stripe}${number}${sponsor}${style}`;
  return cached(key, () => {
    const W = 1024, H = 512;
    const c = canvas(W, H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    // v : 0 = bas centre, 0.25 = flanc droit, 0.5 = toit/capot centre, 0.75 = flanc gauche
    if (stripe) {
      ctx.fillStyle = stripe;
      if (style === 0) {
        // doubles bandes centrales (capot/toit/coffre)
        ctx.fillRect(0, H * 0.465, W, H * 0.022);
        ctx.fillRect(0, H * 0.513, W, H * 0.022);
      } else if (style === 1) {
        // bande latérale
        ctx.fillRect(W * 0.08, H * 0.2, W * 0.84, H * 0.03);
        ctx.fillRect(W * 0.08, H * 0.77, W * 0.84, H * 0.03);
      } else {
        // livrée course : flancs bicolores
        ctx.beginPath();
        ctx.moveTo(W * 0.15, H * 0.12); ctx.lineTo(W * 0.85, H * 0.18); ctx.lineTo(W * 0.85, H * 0.27); ctx.lineTo(W * 0.15, H * 0.3);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(W * 0.15, H * 0.88); ctx.lineTo(W * 0.85, H * 0.82); ctx.lineTo(W * 0.85, H * 0.73); ctx.lineTo(W * 0.15, H * 0.7);
        ctx.fill();
        ctx.fillRect(0, H * 0.47, W, H * 0.06);
      }
    }
    // Flanc droit (v≈0.25) : texte tourné de 180° pour être lisible de l'extérieur
    const drawNumber = (cx, cy, flip) => {
      ctx.save();
      ctx.translate(cx, cy);
      if (flip) ctx.scale(-1, -1);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, 0, 46, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = 'bold 44px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(number), 0, 3);
      ctx.restore();
    };
    if (number !== null) {
      drawNumber(W * 0.47, H * 0.205, true);
      drawNumber(W * 0.47, H * 0.795, false);
    }
    if (sponsor !== null) {
      const [text, bg, fg] = SPONSORS[sponsor % SPONSORS.length];
      for (const [cy, flip] of [[H * 0.25, true], [H * 0.75, false]]) {
        ctx.save();
        ctx.translate(W * 0.68, cy);
        if (flip) ctx.scale(-1, -1);
        ctx.fillStyle = bg;
        ctx.fillRect(-90, -13, 180, 26);
        ctx.fillStyle = fg;
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 0, 1, 170);
        ctx.restore();
      }
    }
    const t = tex(c, { repeat: false });
    return t;
  });
}

export function clearTextureCache() {
  for (const v of cache.values()) {
    if (v && v.dispose) v.dispose();
  }
  cache.clear();
}
