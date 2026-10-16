// Pilote le jeu dans Chromium headless : node tools/play.mjs "<hash>" "<script>" [w h]
// script : suite d'actions séparées par '|' — wait:ms, down:Key, up:Key, press:Key, shot:nom, eval:code
import { spawn } from 'node:child_process';
const [hash = '', script = 'wait:3000|shot:a', w = '1280', h = '720'] = process.argv.slice(2);
const pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
// Port propre à chaque copie de travail (plusieurs serveurs Vite peuvent tourner en parallèle)
const port = +process.env.PLAY_PORT || 5200 + [...process.cwd()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 700, 7);
async function up() {
  try { const r = await fetch(`http://localhost:${port}/`); return r.ok; } catch { return false; }
}
if (!(await up())) {
  spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 250));
}
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => { const t = m.text(); if (!/vite|GL Driver|PCFSoft/.test(t)) logs.push(`[${m.type()}] ${t}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack?.split('\n').slice(0, 4).join('\n')}`));
await page.goto(`http://localhost:${port}/#${hash}`);
for (const step of script.split('|')) {
  const [cmd, ...rest] = step.split(':');
  const arg = rest.join(':');
  if (cmd === 'wait') await page.waitForTimeout(+arg);
  else if (cmd === 'down') await page.keyboard.down(arg);
  else if (cmd === 'up') await page.keyboard.up(arg);
  else if (cmd === 'press') await page.keyboard.press(arg);
  else if (cmd === 'click') await page.mouse.click(+arg.split(',')[0], +arg.split(',')[1]);
  else if (cmd === 'type') await page.keyboard.type(arg);
  else if (cmd === 'shot') await page.screenshot({ path: `tools/scratch/${arg}.png` });
  else if (cmd === 'eval') console.log('eval:', JSON.stringify(await page.evaluate(arg)));
  else if (cmd === 'evalfile') console.log('eval:', JSON.stringify(await page.evaluate((await import('node:fs')).readFileSync(arg, 'utf8'))));
}
await browser.close();
if (logs.length) console.log(logs.slice(0, 40).join('\n'));
console.log('ok');
process.exit(0);
