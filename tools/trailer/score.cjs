// Renders the trailer's score (score.js) to tools/trailer/out/score.wav,
// timed to the cut in edit.json. Needs dist/index.html (node build.mjs --dev).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, 'out');

// beat start times, shared with assemble.py
function timeline() {
  const edit = JSON.parse(fs.readFileSync(path.join(__dirname, 'edit.json'), 'utf8'));
  let t = 0;
  const beats = edit.beats.map((b) => {
    const label = b.label || b.shot || b.card || (b.black ? 'black' : '?');
    const o = { ...b, label, start: t };
    t += b.dur;
    return o;
  });
  return { beats, total: t };
}

(async () => {
  const { beats, total } = timeline();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto('file://' + path.join(ROOT, 'dist/index.html'));
  await page.waitForFunction(() => window.__game);
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'score.js'), 'utf8') });
  const pcm = Buffer.from(await page.evaluate(([b, t]) => window.__score(b, t), [beats, total + 3]), 'base64');
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(48000, 24);
  h.writeUInt32LE(48000 * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'score.wav'), Buffer.concat([h, pcm]));
  console.log(`score.wav: ${total.toFixed(1)} s of cut, ${beats.length} beats`);
  await browser.close();
})();
