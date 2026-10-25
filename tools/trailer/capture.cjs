// Renders the trailer's shots straight out of the game (tools/trailer/shots.js):
// PNG frames for each shot plus a WAV of its sound effects and ambience.
//
//   node build.mjs --dev                      # the game, unminified, in dist/
//   node tools/trailer/capture.cjs [S01 S02 ...] [--preview]
//
// Output: tools/trailer/out/shots/<id>/0000.png… and <id>.wav (out/ is not
// committed). --preview renders 6 fps at half size into out/preview/ to check
// timing and framing quickly. Uses the Playwright + Chromium of the
// environment; WebGL runs on SwiftShader.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const args = process.argv.slice(2);
const preview = args.includes('--preview');
const want = args.filter((a) => !a.startsWith('--'));
const FPS = preview ? 6 : 24;
const SUB = Math.round(48 / FPS); // the game always steps at about 1/48 s
const [W, H] = preview ? [480, 270] : [960, 540];
const OUT = path.join(__dirname, 'out', preview ? 'preview' : 'shots');

function writeWav(file, pcm, rate, ch) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(ch, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * ch * 2, 28);
  h.writeUInt16LE(ch * 2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, pcm]));
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  await page.addInitScript(() => {
    // the game must not run on its own: every frame is stepped by the capture
    window.requestAnimationFrame = () => 0;
    // and it rolls the same dice on every run
    let s = 20241025;
    Math.random = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(ROOT, 'dist/index.html'));
  await page.waitForFunction(() => window.__game);
  for (const f of ['runtime.js', 'shots.js']) await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, f), 'utf8') });
  const ids = await page.evaluate(() => Object.keys(window.__SHOTS));
  fs.mkdirSync(OUT, { recursive: true });
  for (const id of ids) {
    if (want.length && !want.includes(id)) continue;
    const t0 = Date.now();
    const dir = path.join(OUT, id);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const len = await page.evaluate((i) => window.__T.setup(i), id);
    await page.evaluate(([i, o]) => window.__T.begin(i, o), [id, { fps: FPS, sub: SUB, w: W, h: H }]);
    const n = Math.round(len * FPS);
    for (let i = 0; i < n; i++) {
      const url = await page.evaluate((k) => window.__T.step(k), i);
      fs.writeFileSync(path.join(dir, String(i).padStart(4, '0') + '.png'), Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    }
    const pcm = await page.evaluate(() => window.__T.end());
    writeWav(path.join(OUT, id + '.wav'), Buffer.from(pcm, 'base64'), 48000, 2);
    console.log(`${id}: ${n} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  console.log(errors.length ? errors.join('\n') : 'no page errors');
  await browser.close();
})();
