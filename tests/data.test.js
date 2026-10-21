import test from 'node:test';
import assert from 'node:assert/strict';
import { listPacks, totalPairs, createCategoryDeck } from '../js/data/packs.js';
import { sanitizeText, LIMITS } from '../js/core/sanitize.js';

test('al menos 200 pares y packs requeridos', () => {
  assert.ok(totalPairs() >= 200, `hay ${totalPairs()}`);
  const ids = listPacks().map((p) => p.id);
  for (const id of ['general', 'family', 'party', 'sports', 'movies', 'culture', 'adult']) assert.ok(ids.includes(id), id);
});

test('todos los extremos son válidos (≤18, sin caracteres prohibidos) y sin duplicados', () => {
  const seen = new Set();
  for (const p of listPacks()) for (const pair of p.pairs) for (const lang of ['es', 'en']) {
    assert.equal(pair[lang].length, 2);
    for (const t of pair[lang]) {
      assert.ok(t.length > 0 && Array.from(t).length <= LIMITS.extreme, `"${t}" (${p.id})`);
      assert.equal(sanitizeText(t, LIMITS.extreme), t, `"${t}" cambia al sanear`);
    }
    const key = pair[lang].join('|').toLowerCase() + lang;
    assert.ok(!seen.has(key), `duplicado ${key}`);
    seen.add(key);
  }
});

test('mazo sin repetición hasta agotar y luego reinicia', () => {
  const deck = createCategoryDeck(['family'], 'en');
  const n = deck.size;
  const keys = new Set();
  for (let i = 0; i < n; i++) keys.add(deck.draw().key);
  assert.equal(keys.size, n);
  assert.ok(deck.draw());
  assert.equal(createCategoryDeck([], 'es').draw(), null);
});
