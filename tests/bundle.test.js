import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { options } from '../scripts/bundle.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('app.js (el bundle para abrir con doble clic) está al día con js/', async () => {
  const out = await build({ ...options, outfile: path.join(root, 'app.js'), write: false, logLevel: 'silent' });
  const fresh = out.outputFiles[0].text;
  assert.equal(readFileSync(path.join(root, 'app.js'), 'utf8'), fresh, 'app.js desfasado: ejecuta `npm run bundle`');
});

test('index.html carga app.js como script clásico (compatible con file://)', () => {
  const html = readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /<script src="app\.js" defer><\/script>/);
  assert.doesNotMatch(html, /type="module"/);
  assert.doesNotMatch(readFileSync(path.join(root, 'app.js'), 'utf8'), /^\s*(import|export)\s/m);
});
