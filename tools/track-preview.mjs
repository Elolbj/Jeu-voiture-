// Génère un aperçu SVG (et PNG via Chromium si disponible) de chaque circuit + statistiques.
import fs from 'node:fs';
import path from 'node:path';
import { Track } from '../src/world/track.js';
import { TRACKS } from '../src/data/tracks.js';

const outDir = path.resolve('tools/scratch');
fs.mkdirSync(outDir, { recursive: true });
const only = process.argv[2];

const svgs = [];
for (const def of TRACKS) {
  if (only && def.id !== only) continue;
  const t = new Track(def);
  const st = t.stats();
  console.log(def.id, JSON.stringify(st));
  const { minX, minZ, maxX, maxZ } = t.bounds;
  const pad = 60;
  const w = maxX - minX + pad * 2, h = maxZ - minZ + pad * 2;
  const sc = 700 / Math.max(w, h);
  const P = (x, z) => `${((x - minX + pad) * sc).toFixed(1)},${((z - minZ + pad) * sc).toFixed(1)}`;
  let center = '', wl = '', wr = '', el = '', er = '', curbs = '';
  for (let i = 0; i < t.count; i++) {
    const x = t.px[i], z = t.pz[i];
    const hl = Math.hypot(t.rx[i], t.rz[i]);
    const rx = t.rx[i] / hl, rz = t.rz[i] / hl;
    center += P(x, z) + ' ';
    wl += P(x - rx * t.wallL[i], z - rz * t.wallL[i]) + ' ';
    wr += P(x + rx * t.wallR[i], z + rz * t.wallR[i]) + ' ';
    el += P(x - rx * t.halfWidth, z - rz * t.halfWidth) + ' ';
    er += P(x + rx * t.halfWidth, z + rz * t.halfWidth) + ' ';
    if (t.curbL[i]) curbs += `<circle cx="${P(x - rx * (t.halfWidth + 0.5), z - rz * (t.halfWidth + 0.5)).split(',')[0]}" cy="${P(x - rx * (t.halfWidth + 0.5), z - rz * (t.halfWidth + 0.5)).split(',')[1]}" r="1.2" fill="red"/>`;
    if (t.curbR[i]) curbs += `<circle cx="${P(x + rx * (t.halfWidth + 0.5), z + rz * (t.halfWidth + 0.5)).split(',')[0]}" cy="${P(x + rx * (t.halfWidth + 0.5), z + rz * (t.halfWidth + 0.5)).split(',')[1]}" r="1.2" fill="red"/>`;
  }
  const sp = t.pointAt(t.startS, 0);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w * sc)}" height="${Math.ceil(h * sc)}" style="background:#1d2a1d">
<polyline points="${wl}" fill="none" stroke="#c96" stroke-width="1"/>
<polyline points="${wr}" fill="none" stroke="#69c" stroke-width="1"/>
<polyline points="${el}" fill="none" stroke="#ddd" stroke-width="1"/>
<polyline points="${er}" fill="none" stroke="#ddd" stroke-width="1"/>
<polyline points="${center}" fill="none" stroke="#555" stroke-width="0.6" stroke-dasharray="3 3"/>
${curbs}
<circle cx="${P(sp.x, sp.z).split(',')[0]}" cy="${P(sp.x, sp.z).split(',')[1]}" r="5" fill="yellow"/>
<circle cx="${P(t.px[20], t.pz[20]).split(',')[0]}" cy="${P(t.px[20], t.pz[20]).split(',')[1]}" r="3" fill="lime"/>
<text x="10" y="20" fill="white" font-family="sans-serif" font-size="14">${def.name} — ${st.length} m — Rmin ${st.minRadius} m — pente max ${st.maxGradePct}% — sép. min ${st.minSeparation} m</text>
</svg>`;
  fs.writeFileSync(path.join(outDir, `${def.id}.svg`), svg);
  svgs.push([def.id, svg]);
}

// Rendu PNG via Playwright si disponible
try {
  const pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 760, height: 760 } });
  for (const [id, svg] of svgs) {
    await page.setContent(`<html><body style="margin:0;background:#000">${svg}</body></html>`);
    await page.locator('svg').screenshot({ path: path.join(outDir, `${id}.png`), timeout: 15000 });
  }
  await browser.close();
  console.log('PNG ok');
} catch (e) {
  console.log('PNG indisponible:', e.message);
}
