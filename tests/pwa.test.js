import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(path.join(root, f), 'utf8');
const walk = (d) => readdirSync(path.join(root, d)).flatMap((n) => {
  const rel = `${d}/${n}`;
  return statSync(path.join(root, rel)).isDirectory() ? walk(rel) : [rel];
});

test('manifest: standalone, vertical, iconos 192/512 y maskable', () => {
  const m = JSON.parse(read('manifest.json'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.orientation, 'portrait');
  const has = (size, purpose) => m.icons.some((i) => i.sizes === size && i.purpose === purpose);
  assert.ok(has('192x192', 'any') && has('512x512', 'any') && has('192x192', 'maskable') && has('512x512', 'maskable'));
  for (const i of m.icons) assert.ok(existsSync(path.join(root, i.src)), i.src);
});

test('el service worker precachea TODOS los archivos de la app y existen', () => {
  const sw = read('sw.js');
  const list = [...sw.matchAll(/'([^']+\.(?:js|css|html|json|png|svg)|\.\/)'/g)].map((m) => m[1]);
  for (const f of list) if (f !== './') assert.ok(existsSync(path.join(root, f)), `falta ${f}`);
  const shipped = ['js/theme-boot.js', 'app.js', ...walk('css'), ...walk('legal'), 'index.html', 'manifest.json']
    .concat(['icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-192.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png']);
  for (const f of shipped) assert.ok(list.includes(f), `no precacheado: ${f}`);
  assert.match(sw, /const VERSION = 'lazona-v[\w.-]+'/);
  assert.match(sw, /caches\.delete/);
});

test('index.html: CSP estricta, viewport-fit=cover y sin scripts/estilos en línea', () => {
  const html = read('index.html');
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /script-src 'self'/);
  assert.doesNotMatch(html, /unsafe-inline|unsafe-eval/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, 'script en línea');
  assert.doesNotMatch(html, /<style/);
});

test('seguridad: ningún módulo usa innerHTML, outerHTML, insertAdjacentHTML ni eval', () => {
  for (const f of walk('js')) {
    const src = read(f);
    assert.doesNotMatch(src, /\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write|\beval\(|new Function\(/, f);
  }
});
