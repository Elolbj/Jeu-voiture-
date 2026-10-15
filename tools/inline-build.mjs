// Après `vite build` :
//  - dist/trajectoire.html : fichier unique (JS et CSS intégrés), jouable en l'ouvrant directement ;
//  - dist/artifact.html : même contenu sans squelette <html>/<head>/<body> (publication en page web).
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet"[^>]*href="\.?\/?(assets\/[^"]+\.css)"[^>]*>/g, (_, href) => {
  const css = fs.readFileSync(path.join(dist, href), 'utf8');
  return `<style>\n${css}\n</style>`;
});
let js = '';
html = html.replace(/<script type="module"[^>]*src="\.?\/?(assets\/[^"]+\.js)"[^>]*><\/script>\s*/g, (_, src) => {
  js = fs.readFileSync(path.join(dist, src), 'utf8').replace(/<\/script/g, '<\\/script');
  return '';
});
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '');
// le script en fin de corps (après #app)
const withScript = html.replace('</body>', `<script type="module">\n${js}\n</script>\n</body>`);
fs.writeFileSync(path.join(dist, 'trajectoire.html'), withScript);

// Version « page » : contenu de <head> (titre, polices, styles) + contenu de <body>
const head = (withScript.match(/<head>([\s\S]*?)<\/head>/) || [])[1] || '';
const body = (withScript.match(/<body>([\s\S]*?)<\/body>/) || [])[1] || '';
const headClean = head.replace(/<meta charset[^>]*>/i, '').replace(/<meta name="viewport"[^>]*>/i, '');
fs.writeFileSync(path.join(dist, 'artifact.html'), `${headClean.trim()}\n${body.trim()}\n`);

for (const f of ['trajectoire.html', 'artifact.html']) {
  console.log(`dist/${f} (${Math.round(fs.statSync(path.join(dist, f)).size / 1024)} Ko)`);
}
