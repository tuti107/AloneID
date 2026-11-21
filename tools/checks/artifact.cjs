// The claude.ai artifact build (dist/artifact.html) as the artifact page
// loads it: wrapped in a plain document, three.js fetched from the CDN
// (served here from node_modules), up to the title and into a room, with no
// errors. Screenshots go to tools/checks/out/.
//   node build.mjs && node tools/checks/artifact.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const THREE_V = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/three/package.json'), 'utf8')).version;
const CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_V}/`;
(async () => {
  const page0 = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}</style></head><body>';
  const doc = path.join(OUT, 'artifact-page.html');
  fs.writeFileSync(doc, page0 + fs.readFileSync(path.join(ROOT, 'dist/artifact.html'), 'utf8') + '</body></html>');
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [], cdn = [];
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`); });
  await page.route(CDN + '**', (route) => {
    const rel = route.request().url().replace(CDN, '');
    cdn.push(rel);
    route.fulfill({ path: path.join(ROOT, 'node_modules/three', rel), contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' } });
  });
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await page.goto('file://' + doc);
  await page.waitForTimeout(4000);
  const st = await page.evaluate(() => (window.__game ? { state: __game.state, modals: __game.modals.length } : null));
  console.log('game:', JSON.stringify(st), 'cdn files:', cdn.join(', '));
  await page.screenshot({ path: path.join(OUT, 'artifact_title.png') });
  await page.evaluate(() => __game.debugStart('hall', 'start'));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, 'artifact_hall.png') });
  console.log(errors.join('\n') || 'no errors');
  await browser.close();
  if (!st || st.state !== 'title' || errors.length) process.exitCode = 1;
})();
