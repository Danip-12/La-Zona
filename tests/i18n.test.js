import test from 'node:test';
import assert from 'node:assert/strict';
import es from '../js/i18n/es.js';
import en from '../js/i18n/en.js';
import { t, tn, setLang, detectLang } from '../js/i18n/index.js';

test('es y en tienen exactamente las mismas claves', () => {
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
});

test('los marcadores {x} coinciden entre idiomas', () => {
  const ph = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join();
  for (const k of Object.keys(es)) assert.equal(ph(es[k]), ph(en[k]), k);
});

test('interpolación, plurales y detección', () => {
  setLang('es');
  assert.equal(t('game.sums', { name: 'Ana', n: 4 }), 'Ana suma 4');
  assert.equal(tn('home.packCount', 1), '1 categoría');
  assert.equal(tn('home.packCount', 5), '5 categorías');
  setLang('en');
  assert.equal(tn('home.packCount', 1), '1 category');
  assert.equal(t('no.such.key'), 'no.such.key');
  assert.equal(detectLang(['fr-FR', 'en-US']), 'en');
  assert.equal(detectLang(['fr']), 'es');
  setLang('es');
});
