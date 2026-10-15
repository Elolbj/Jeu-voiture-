// Capture d'écran du jeu via Chromium headless (WebGL logiciel) : node tools/shot.mjs "<hash>" out.png [w h wait]
import { spawn } from 'node:child_process';
const [hash = '', out = 'tools/scratch/shot.png', w = '1280', h = '720', wait = '2500'] = process.argv.slice(2);
const pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const port = 5199;
let server = null;
async function up() {
  try { const r = await fetch(`http://localhost:${port}/`); return r.ok; } catch { return false; }
}
if (!(await up())) {
  server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 250));
}
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(`http://localhost:${port}/#${hash}`);
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
await browser.close();
if (logs.length) console.log(logs.slice(0, 30).join('\n'));
console.log('ok', out);
process.exit(0);
