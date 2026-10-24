// Builds the game into single-file HTML pages:
//   docs/index.html     — everything inlined (works offline / on GitHub Pages)
//   dist/artifact.html  — page fragment for a claude.ai artifact; three.js is
//                         loaded from a pinned CDN via an import map
// With --dev an unminified docs-style build goes to dist/index.html instead.
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const dev = process.argv.includes('--dev');

function fill(template, js) {
  const tpl = readFileSync(template, 'utf8');
  const css = readFileSync('src/style.css', 'utf8');
  // Guard against "</script" sequences inside the bundle.
  const safe = js.replace(/<\/script/gi, '<\\/script');
  return tpl.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => safe);
}

function target({ format, external = [], template, out }) {
  return {
    entryPoints: ['src/main.js'],
    bundle: true,
    format,
    external,
    target: ['es2020'],
    minify: !dev,
    write: false,
    legalComments: 'none',
    plugins: [{
      name: 'inline-html',
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length) return;
          const js = result.outputFiles[0].text;
          mkdirSync(out.split('/')[0], { recursive: true });
          writeFileSync(out, fill(template, js));
          console.log(`[build] ${out} (${(Buffer.byteLength(js) / 1024).toFixed(0)} KB js)`);
        });
      },
    }],
  };
}

const targets = dev
  ? [target({ format: 'iife', template: 'src/index.template.html', out: 'dist/index.html' })]
  : [
      target({ format: 'iife', template: 'src/index.template.html', out: 'docs/index.html' }),
      target({ format: 'esm', external: ['three', 'three/*'], template: 'src/artifact.template.html', out: 'dist/artifact.html' }),
    ];

if (watch) {
  for (const t of targets) await (await esbuild.context(t)).watch();
  console.log('[build] watching…');
} else {
  for (const t of targets) await esbuild.build(t);
}
