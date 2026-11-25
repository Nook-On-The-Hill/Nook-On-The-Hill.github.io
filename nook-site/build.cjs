// Builds dist/nook-site.js from src/. Run: node build.cjs   (node build.cjs --check fails if dist is out of date)
const fs = require('fs'), path = require('path');
const r = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const js = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n\s*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, '');
const consent = r('consent.js')
  .replace("'__NOOK_CSS__'", () => "'" + js(r('banner.css')) + "'")
  .replace("'__NOOK_HTML__'", () => "'" + js(r('banner.html')) + "'");
const out = [
  '/* Nook On The Hill website scripts. Built from src/ by build.cjs: edit the files in src/, not this one. */',
  '(function () {',
  '  if (window.__nookSite) return;',
  "  if (document.getElementById('nook-cookie-banner')) { console.warn('Nook: old cookie banner code is still pasted in Showit; remove it so only the loader line remains.'); return; }",
  '  window.__nookSite = 6;', '',
  consent, '', r('gift.js'), '', r('clickid.js'), '', r('events.js'),
  '})();', ''
].join('\n');
const file = path.join(__dirname, 'dist', 'nook-site.js');
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (cur !== out) { console.error('dist/nook-site.js is out of date: run node build.cjs'); process.exit(1); }
  console.log('dist is up to date'); process.exit(0);
}
fs.writeFileSync(file, out); console.log('built', out.length, 'bytes');
