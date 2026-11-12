// Textures procédurales des voitures : paillettes de peinture, carbone tissé, flancs de pneus,
// disques de frein, calandres, plaques, logos de marque, combiné d'instruments, sellerie.
import * as THREE from 'three';
import { rng } from '../core/utils.js';

const cache = new Map();
function cached(key, fn) {
  let v = cache.get(key);
  if (!v) { v = fn(); cache.set(key, v); }
  return v;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function tex(c, { srgb = true, repeat = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

// Carte de normales à partir d'un champ de hauteurs (périodique)
function normalsFromHeight(h, w, hh, strength) {
  const c = canvas(w, hh);
  const g = c.getContext('2d');
  const img = g.createImageData(w, hh);
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      const xl = h[y * w + ((x - 1 + w) % w)], xr = h[y * w + ((x + 1) % w)];
      const yu = h[((y - 1 + hh) % hh) * w + x], yd = h[((y + 1) % hh) * w + x];
      let nx = (xl - xr) * strength, ny = (yd - yu) * strength;
      const l = Math.hypot(nx, ny, 1);
      const k = (y * w + x) * 4;
      img.data[k] = (nx / l * 0.5 + 0.5) * 255;
      img.data[k + 1] = (ny / l * 0.5 + 0.5) * 255;
      img.data[k + 2] = (1 / l * 0.5 + 0.5) * 255;
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// Paillettes (peinture métallisée / nacrée) : micro-facettes orientées au hasard
export function flakeNormal() {
  return cached('flakes', () => {
    const N = 256;
    const c = canvas(N, N);
    const g = c.getContext('2d');
    const img = g.createImageData(N, N);
    const r = rng(97);
    for (let y = 0; y < N; y += 2) {
      for (let x = 0; x < N; x += 2) {
        const a = r() * Math.PI * 2, s = Math.pow(r(), 0.6) * 0.42;
        const nx = Math.cos(a) * s, ny = Math.sin(a) * s, nz = Math.sqrt(1 - s * s);
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const k = ((y + dy) * N + x + dx) * 4;
            img.data[k] = (nx * 0.5 + 0.5) * 255;
            img.data[k + 1] = (ny * 0.5 + 0.5) * 255;
            img.data[k + 2] = (nz * 0.5 + 0.5) * 255;
            img.data[k + 3] = 255;
          }
        }
      }
    }
    g.putImageData(img, 0, 0);
    const t = tex(c, { srgb: false, repeat: true });
    t.repeat.set(90, 90);
    return t;
  });
}

// Carbone sergé 2x2 : couleur + relief du tissage
export function carbonTextures() {
  return cached('carbon', () => {
    const N = 128, cell = 16;
    const c = canvas(N, N);
    const g = c.getContext('2d');
    const h = new Float32Array(N * N);
    const img = g.createImageData(N, N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
        // sergé : la trame passe dessus 2, dessous 2, décalée d'une case par rang
        const warp = ((cx + cy) >> 1) % 2 === 0;
        const fx = (x % cell) / cell, fy = (y % cell) / cell;
        const along = warp ? fy : fx, across = warp ? fx : fy;
        const bulge = Math.sin(across * Math.PI);
        const fib = 0.5 + 0.5 * Math.sin(along * Math.PI * 9 + across * 2);
        h[y * N + x] = bulge * 0.8 + fib * 0.08;
        const v = 18 + bulge * 34 + fib * 10 + (warp ? 6 : 0);
        const k = (y * N + x) * 4;
        img.data[k] = v * 0.92; img.data[k + 1] = v * 0.95; img.data[k + 2] = v * 1.05; img.data[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const map = tex(c, { repeat: true });
    const nmap = tex(normalsFromHeight(h, N, N, 2.2), { srgb: false, repeat: true });
    return { map, normalMap: nmap };
  });
}

// Nid d'abeille (calandres, prises d'air)
export function honeycomb() {
  return cached('honey', () => {
    const c = canvas(64, 112);
    const g = c.getContext('2d');
    g.fillStyle = '#020203';
    g.fillRect(0, 0, 64, 112);
    g.strokeStyle = '#41454d';
    g.lineWidth = 5;
    const hex = (cx, cy, r) => {
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
        g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      g.closePath();
      g.stroke();
    };
    for (const [x, y] of [[0, 0], [64, 0], [32, 56], [0, 112], [64, 112]]) hex(x, y, 34);
    return tex(c, { repeat: true });
  });
}

// Calandre à lamelles horizontales (voitures anciennes) ou maillage losange
export function barsGrille() {
  return cached('bars', () => {
    const c = canvas(32, 64);
    const g = c.getContext('2d');
    g.fillStyle = '#030304';
    g.fillRect(0, 0, 32, 64);
    const gr = g.createLinearGradient(0, 0, 0, 16);
    gr.addColorStop(0, '#9a9ea6'); gr.addColorStop(0.5, '#e6e8ec'); gr.addColorStop(1, '#5d6168');
    for (let y = 0; y < 64; y += 16) {
      g.fillStyle = gr;
      g.save(); g.translate(0, y); g.fillRect(0, 2, 32, 7); g.restore();
    }
    return tex(c, { repeat: true });
  });
}

export function meshGrille() {
  return cached('meshg', () => {
    const c = canvas(64, 64);
    const g = c.getContext('2d');
    g.fillStyle = '#020203';
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = '#3c4048';
    g.lineWidth = 6;
    g.beginPath();
    for (const o of [-64, 0, 64]) {
      g.moveTo(o, 0); g.lineTo(o + 64, 64);
      g.moveTo(o + 64, 0); g.lineTo(o, 64);
    }
    g.stroke();
    return tex(c, { repeat: true });
  });
}

// Pneu : bande de roulement à rainures + flanc extérieur avec inscriptions en relief.
// Disposition (v de 0 à 1 le long du profil) : voir tireGeometry dans carParts.js.
export const TIRE_V = { sideOut0: 0.04, sideOut1: 0.3, tread0: 0.38, tread1: 0.62, sideIn0: 0.7 };
export function tireTexture(label = 'TRAJECTOIRE', size = 'SPORT CONTACT') {
  return cached('tire' + label + size, () => {
    const W = 1024, H = 128;
    const c = canvas(W, H);
    const g = c.getContext('2d');
    // lignes du canevas de haut en bas = profil du pneu (talon extérieur → bande → talon intérieur)
    g.fillStyle = '#1b1b1d';
    g.fillRect(0, 0, W, H);
    const y0 = TIRE_V.tread0 * H, y1 = TIRE_V.tread1 * H;
    g.fillStyle = '#141416';
    g.fillRect(0, y0, W, y1 - y0);
    g.fillStyle = '#09090a';
    for (const f of [0.26, 0.5, 0.74]) g.fillRect(0, y0 + (y1 - y0) * f - 1.5, W, 3);
    g.fillStyle = '#0f0f11';
    for (let x = 0; x < W; x += 8) { g.fillRect(x, y0, 2, (y1 - y0) * 0.18); g.fillRect(x + 4, y1 - (y1 - y0) * 0.18, 2, (y1 - y0) * 0.18); }
    // flanc extérieur : léger dégradé, filet de protection de jante, inscriptions en relief
    const s0 = TIRE_V.sideOut0 * H, s1 = TIRE_V.sideOut1 * H;
    const grad = g.createLinearGradient(0, s0, 0, s1);
    grad.addColorStop(0, '#19191b'); grad.addColorStop(0.5, '#232327'); grad.addColorStop(1, '#1c1c1f');
    g.fillStyle = grad;
    g.fillRect(0, s0, W, s1 - s0);
    g.fillStyle = '#2b2b30';
    g.fillRect(0, s0 + 2, W, 2);
    const cy = (s0 + s1) / 2 + 2;
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    // texte tourné de 180° : le haut des lettres vers la bande de roulement, lecture dans le sens horaire
    const write = (txt, x, font, col) => {
      g.save();
      g.translate(x, cy);
      g.rotate(Math.PI);
      g.font = font;
      g.fillStyle = col;
      g.fillText(txt, 0, 0);
      g.restore();
    };
    for (let k = 0; k < 2; k++) {
      const off = k * W / 2;
      write(label, off + W * 0.14, 'bold 16px Arial, Helvetica, sans-serif', '#8e9096');
      write(size, off + W * 0.3, 'bold 11px Arial, Helvetica, sans-serif', '#606268');
      write('RADIAL TUBELESS', off + W * 0.4, '9px Arial, Helvetica, sans-serif', '#55575c');
    }
    return tex(c, { repeat: true });
  });
}

// Atlas de roue (pneu + disque, un seul matériau) : couleur + carte rugosité (G) / métal (B)
export function wheelAtlas(discKind = 'drilled') {
  return cached('wheelAtlas' + discKind, () => {
    const W = 1024, H = 384;
    const c = canvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#18181a';
    g.fillRect(0, 0, W, H);
    g.drawImage(tireTexture().image, 0, 0, W, 128);
    g.drawImage(discTexture(discKind).image, 0, 128, 256, 256);
    const o = canvas(W, H), go = o.getContext('2d');
    go.fillStyle = 'rgb(255,230,0)'; // pneu : rugueux, non métallique
    go.fillRect(0, 0, W, 128);
    go.fillStyle = 'rgb(255,110,215)'; // disque : métal usiné
    go.fillRect(0, 128, W, 256);
    const map = tex(c);
    const orm = tex(o, { srgb: false });
    return { map, orm };
  });
}
// Disque de frein (face) : piste usinée, perçages / rainures, bol central plus sombre.
export function discTexture(kind = 'drilled') {
  return cached('disc' + kind, () => {
    const N = 256, c = canvas(N, N), g = c.getContext('2d');
    const R = N / 2;
    g.fillStyle = '#2a2b2e';
    g.fillRect(0, 0, N, N);
    // piste
    for (let r = R; r > R * 0.5; r -= 1) {
      const v = 120 + Math.sin(r * 1.7) * 10 + Math.sin(r * 0.37) * 14;
      g.strokeStyle = `rgb(${v},${v + 2},${v + 6})`;
      g.beginPath(); g.arc(R, R, r, 0, Math.PI * 2); g.stroke();
    }
    if (kind === 'carbon') {
      g.fillStyle = 'rgba(30,30,34,0.85)';
      g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.arc(R, R, R * 0.5, 0, Math.PI * 2, true); g.fill();
    }
    g.fillStyle = '#121214';
    if (kind === 'drilled') {
      for (let k = 0; k < 3; k++) {
        const rr = R * (0.62 + k * 0.12);
        const n = 18 + k * 4;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + k * 0.21;
          g.beginPath(); g.arc(R + Math.cos(a) * rr, R + Math.sin(a) * rr, 3.2, 0, Math.PI * 2); g.fill();
        }
      }
    } else {
      g.strokeStyle = '#18181a';
      g.lineWidth = 2.4;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.beginPath();
        g.arc(R + Math.cos(a) * R * 0.2, R + Math.sin(a) * R * 0.2, R * 0.62, a + 0.5, a + 0.95);
        g.stroke();
      }
    }
    // bol (moyeu) et vis
    g.fillStyle = '#3a3c40';
    g.beginPath(); g.arc(R, R, R * 0.48, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#232427';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.beginPath(); g.arc(R + Math.cos(a) * R * 0.42, R + Math.sin(a) * R * 0.42, 2.5, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#18191b';
    g.beginPath(); g.arc(R, R, R * 0.2, 0, Math.PI * 2); g.fill();
    return tex(c);
  });
}

// Plaque d'immatriculation (bandeau bleu à gauche, caractères noirs)
export function plateTexture(text = 'TR-998-AJ') {
  text = String(text || '').toUpperCase().slice(0, 9);
  return cached('plate' + text, () => {
    const W = 512, H = 112;
    const c = canvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#f5f5f0';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#1f3e9c';
    g.fillRect(0, 0, 44, H);
    g.fillStyle = '#ffd400';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath(); g.arc(22 + Math.cos(a) * 13, 34 + Math.sin(a) * 13, 2, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#fff';
    g.font = 'bold 30px Arial, Helvetica, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('T', 22, 82);
    g.fillStyle = '#111';
    g.font = 'bold 84px Arial Narrow, Arial, Helvetica, sans-serif';
    g.fillText(text, 44 + (W - 44) / 2, H / 2 + 5, W - 64);
    g.strokeStyle = '#222';
    g.lineWidth = 4;
    g.strokeRect(2, 2, W - 4, H - 4);
    return tex(c);
  });
}

// Logos de marque : atlas de 8 x 2 cases (+ sangle de remorquage)
const BRANDS = ['Kaze', 'Miyabi', 'Valette', 'Hoshi', 'Strauss', 'Falco', 'Stellan', 'Vortex', 'Aurelia', 'Delaunay', 'Marlin'];
export const TOW_CELL = 15;
export function brandCell(brand) {
  const i = BRANDS.indexOf(brand);
  return i < 0 ? 14 : i;
}
export function badgeAtlas() {
  return cached('badges', () => {
    const S = 128, c = canvas(S * 8, S * 2), g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    const chrome = (x0, y0) => {
      const gr = g.createLinearGradient(x0, y0, x0, y0 + S);
      gr.addColorStop(0, '#f4f6f8'); gr.addColorStop(0.45, '#9ba1a8'); gr.addColorStop(0.55, '#dfe3e7'); gr.addColorStop(1, '#6e737a');
      return gr;
    };
    const shapes = ['circle', 'oval', 'shield', 'star', 'diamond', 'wing', 'circle', 'shield', 'oval', 'circle', 'oval'];
    for (let i = 0; i < 16; i++) {
      const x0 = (i % 8) * S, y0 = Math.floor(i / 8) * S;
      const cx = x0 + S / 2, cy = y0 + S / 2;
      g.save();
      if (i === TOW_CELL) {
        // sangle de remorquage rouge
        g.fillStyle = '#d11a1a';
        g.fillRect(x0 + 20, y0 + 8, S - 40, S - 16);
        g.fillStyle = '#ffffff';
        g.font = 'bold 26px Arial';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.translate(cx, cy);
        g.rotate(-Math.PI / 2);
        g.fillText('TOW', 0, 0);
        g.restore();
        continue;
      }
      const name = BRANDS[i] || '';
      const shape = shapes[i] || 'circle';
      g.fillStyle = chrome(x0, y0);
      g.beginPath();
      if (shape === 'circle') g.arc(cx, cy, S * 0.46, 0, Math.PI * 2);
      else if (shape === 'oval') g.ellipse(cx, cy, S * 0.48, S * 0.3, 0, 0, Math.PI * 2);
      else if (shape === 'shield') {
        g.moveTo(x0 + S * 0.12, y0 + S * 0.1); g.lineTo(x0 + S * 0.88, y0 + S * 0.1);
        g.quadraticCurveTo(x0 + S * 0.9, y0 + S * 0.7, cx, y0 + S * 0.95);
        g.quadraticCurveTo(x0 + S * 0.1, y0 + S * 0.7, x0 + S * 0.12, y0 + S * 0.1);
      } else if (shape === 'diamond') {
        g.moveTo(cx, y0 + 6); g.lineTo(x0 + S - 6, cy); g.lineTo(cx, y0 + S - 6); g.lineTo(x0 + 6, cy);
      } else if (shape === 'star') {
        for (let k = 0; k < 10; k++) {
          const a = -Math.PI / 2 + (k / 10) * Math.PI * 2, rr = k % 2 ? S * 0.22 : S * 0.47;
          g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
      } else if (shape === 'wing') {
        g.ellipse(cx, cy, S * 0.48, S * 0.24, 0, 0, Math.PI * 2);
      }
      g.closePath();
      g.fill();
      // fond émaillé + initiale
      g.fillStyle = ['#b3001b', '#101418', '#1a3d8f', '#c8102e', '#0b2a55', '#202020', '#111111', '#7a0010', '#9e0b0b', '#0b2e6b', '#1d4d2b'][i] || '#222';
      g.beginPath();
      if (shape === 'oval' || shape === 'wing') g.ellipse(cx, cy, S * 0.4, S * (shape === 'wing' ? 0.17 : 0.22), 0, 0, Math.PI * 2);
      else if (shape === 'star') g.arc(cx, cy, S * 0.18, 0, Math.PI * 2);
      else g.arc(cx, cy - (shape === 'shield' ? S * 0.06 : 0), S * 0.34, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#f2f3f5';
      g.font = `bold ${shape === 'star' ? 30 : shape === 'oval' || shape === 'wing' ? 40 : 58}px Georgia, 'Times New Roman', serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(name[0] || '', cx, cy + (shape === 'shield' ? -S * 0.05 : 2));
      g.restore();
    }
    return tex(c);
  });
}

// Combiné d'instruments (compte-tours + compteur), légèrement lumineux
export function gaugeTexture() {
  return cached('gauges', () => {
    const W = 256, H = 128, c = canvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#050506';
    g.fillRect(0, 0, W, H);
    for (const [cx, big] of [[78, true], [186, false]]) {
      const R = big ? 54 : 46, cy = 66;
      g.fillStyle = '#0d0e10';
      g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#d9dde3';
      g.lineWidth = 2;
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * R * 0.82, cy + Math.sin(a) * R * 0.82);
        g.lineTo(cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95);
        g.stroke();
      }
      if (big) {
        g.strokeStyle = '#e0261b';
        g.lineWidth = 4;
        g.beginPath(); g.arc(cx, cy, R * 0.89, Math.PI * 1.95, Math.PI * 2.25); g.stroke();
      }
      g.strokeStyle = '#ff5a1f';
      g.lineWidth = 3;
      const a = Math.PI * 0.85;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8); g.stroke();
      g.fillStyle = '#2a2c30';
      g.beginPath(); g.arc(cx, cy, 6, 0, Math.PI * 2); g.fill();
    }
    return tex(c);
  });
}

// Sellerie : tissu / alcantara avec surpiqûres
export function seatTexture(accent = '#2b2c31') {
  return cached('seat' + accent, () => {
    const N = 128, c = canvas(N, N), g = c.getContext('2d');
    g.fillStyle = '#1c1d21';
    g.fillRect(0, 0, N, N);
    g.fillStyle = accent;
    g.fillRect(N * 0.3, 0, N * 0.4, N);
    const r = rng(5);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},0.035)`;
      g.fillRect(r() * N, r() * N, 1, 1);
    }
    g.strokeStyle = 'rgba(160,160,170,0.35)';
    g.setLineDash([3, 3]);
    g.lineWidth = 1;
    for (const x of [N * 0.3, N * 0.7]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, N); g.stroke(); }
    for (let y = 16; y < N; y += 32) { g.beginPath(); g.moveTo(N * 0.3, y); g.lineTo(N * 0.7, y); g.stroke(); }
    return tex(c, { repeat: true });
  });
}
