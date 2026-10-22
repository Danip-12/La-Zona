import test from 'node:test';
import assert from 'node:assert/strict';
import { listPacks, totalPairs, createCategoryDeck } from '../js/data/packs.js';
import { sanitizeText, LIMITS } from '../js/core/sanitize.js';

test('catálogo: 16 packs y 419 pares', () => {
  assert.equal(totalPairs(), 419);
  const ids = listPacks().map((p) => p.id);
  assert.equal(ids.length, 16);
  for (const id of ['nba', 'football', 'sports', 'food', 'screen', 'gaming', 'humor', 'music', 'celebs', 'daily', 'people', 'money', 'animals', 'philosophy', 'spain', 'extremes']) assert.ok(ids.includes(id), id);
});

test('todos los extremos son válidos (≤50, sin caracteres prohibidos) y sin duplicados dentro de cada pack', () => {
  for (const p of listPacks()) for (const lang of ['es', 'en']) {
    const seen = new Set();
    for (const pair of p.pairs) {
    assert.equal(pair[lang].length, 2);
    for (const t of pair[lang]) {
      assert.ok(t.length > 0 && Array.from(t).length <= LIMITS.packExtreme, `"${t}" (${p.id})`);
      assert.equal(sanitizeText(t, LIMITS.packExtreme), t, `"${t}" cambia al sanear`);
    }
    const key = pair[lang].join('|').toLowerCase();
    assert.ok(!seen.has(key), `duplicado ${key} (${p.id}/${lang})`);
    seen.add(key);
    }
  }
});

test('mazo sin repetición hasta agotar y luego reinicia', () => {
  const deck = createCategoryDeck(['humor'], 'en');
  const n = deck.size;
  const keys = new Set();
  for (let i = 0; i < n; i++) keys.add(deck.draw().key);
  assert.equal(keys.size, n);
  assert.ok(deck.draw());
  assert.equal(createCategoryDeck([], 'es').draw(), null);
});
