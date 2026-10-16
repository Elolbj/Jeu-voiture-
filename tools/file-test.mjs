const pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { const t = m.text(); if (!/GL Driver|PCFSoft/.test(t)) logs.push(`[${m.type()}] ${t}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('file://' + process.cwd() + '/' + (process.argv[3] || 'dist/trajectoire.html'));
const steps = (process.argv[2] || 'wait:5000|shot:f1').split('|');
for (const step of steps) {
  const [cmd, ...rest] = step.split(':'); const arg = rest.join(':');
  if (cmd === 'wait') await page.waitForTimeout(+arg);
  else if (cmd === 'press') await page.keyboard.press(arg);
  else if (cmd === 'type') await page.keyboard.type(arg);
  else if (cmd === 'shot') await page.screenshot({ path: `tools/scratch/${arg}.png` });
  else if (cmd === 'eval') console.log('eval:', JSON.stringify(await page.evaluate(arg)));
}
await browser.close();
console.log(logs.slice(0, 30).join('\n'));
console.log('ok');
