// Petits utilitaires mathématiques partagés (physique, rendu, IA).

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const sign = (v) => (v < 0 ? -1 : 1);
export const deg = (r) => (r * 180) / Math.PI;
export const rad = (d) => (d * Math.PI) / 180;
export const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
// Approche exponentielle indépendante du pas de temps.
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));
export const moveTowards = (cur, target, maxDelta) =>
  Math.abs(target - cur) <= maxDelta ? target : cur + Math.sign(target - cur) * maxDelta;

// Générateur pseudo-aléatoire déterministe (mulberry32).
export function rng(seed = 1) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (a0, b0) => a0 + (b0 - a0) * r();
  r.int = (a0, b0) => Math.floor(a0 + (b0 - a0 + 1) * r());
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  return r;
}

// Interpolation de Catmull-Rom sur une table [[x, y], ...] triée par x.
export function sampleKeys(keys, x, periodic = false) {
  const n = keys.length;
  if (n === 0) return 0;
  if (n === 1) return keys[0][1];
  if (!periodic) {
    if (x <= keys[0][0]) return keys[0][1];
    if (x >= keys[n - 1][0]) return keys[n - 1][1];
  } else {
    x = ((x % 1) + 1) % 1;
  }
  let i = 0;
  while (i < n - 1 && keys[i + 1][0] <= x) i++;
  const get = (k) => {
    if (periodic) {
      const m = ((k % n) + n) % n;
      const wrap = Math.floor(k / n);
      return [keys[m][0] + wrap, keys[m][1]];
    }
    return keys[clamp(k, 0, n - 1)];
  };
  const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
  const span = p2[0] - p1[0];
  const t = span > 1e-9 ? (x - p1[0]) / span : 0;
  // Tangentes de Catmull-Rom non uniformes (pondérées par l'espacement)
  const m1 = ((p2[1] - p0[1]) / Math.max(1e-9, p2[0] - p0[0])) * span;
  const m2 = ((p3[1] - p1[1]) / Math.max(1e-9, p3[0] - p1[0])) * span;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
}

// Interpolation linéaire dans une table [[x, y]] (courbes moteur, etc.)
export function sampleLinear(keys, x) {
  const n = keys.length;
  if (x <= keys[0][0]) return keys[0][1];
  if (x >= keys[n - 1][0]) return keys[n - 1][1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (keys[mid][0] <= x) lo = mid; else hi = mid;
  }
  const t = (x - keys[lo][0]) / (keys[hi][0] - keys[lo][0]);
  return keys[lo][1] + (keys[hi][1] - keys[lo][1]) * t;
}

export function formatTime(t, showMs = true) {
  if (t == null || !isFinite(t)) return '--:--.---';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  const ss = Math.floor(s).toString().padStart(2, '0');
  const ms = Math.floor((s - Math.floor(s)) * 1000).toString().padStart(3, '0');
  return showMs ? `${m}:${ss}.${ms}` : `${m}:${ss}`;
}

export function formatGap(t) {
  if (t == null || !isFinite(t)) return '';
  const s = t >= 0 ? '+' : '−';
  return `${s}${Math.abs(t).toFixed(3)}`;
}

export function formatCredits(n) {
  return Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ') + ' Cr.';
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}
