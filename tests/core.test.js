import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreGuess, getW, zoneBands, pointerToValue, valueToAngle, DIFFICULTY_W } from '../js/core/scoring.js';
import { sanitizeText, sanitizePlayers, sanitizeCategory } from '../js/core/sanitize.js';
import { validateSettings, loadSettings, createStorage, STORAGE_KEY, DEFAULT_SETTINGS } from '../js/core/settings.js';
import { createGame, checkWinner, nextPsychic, summarize } from '../js/core/game.js';

// ---------- Puntuación: límites exactos con las tres dificultades ----------
for (const [name, w] of Object.entries(DIFFICULTY_W)) {
  test(`puntos en límites exactos (${name}, w=${w})`, () => {
    const t = 50;
    assert.equal(scoreGuess(t, t, w).points, 4);
    assert.equal(scoreGuess(t + w, t, w).points, 4);          // d = w
    assert.equal(scoreGuess(t - w, t, w).points, 4);
    assert.equal(scoreGuess(t + w + 0.01, t, w).points, 3);
    assert.equal(scoreGuess(t + 3 * w, t, w).points, 3);      // d = 3w
    assert.equal(scoreGuess(t - 3 * w, t, w).points, 3);
    assert.equal(scoreGuess(t + 3 * w + 0.01, t, w).points, 2);
    assert.equal(scoreGuess(t + 5 * w, t, w).points, 2);      // d = 5w
    assert.equal(scoreGuess(t - 5 * w, t, w).points, 2);
    assert.equal(scoreGuess(t + 5 * w + 0.01, t, w).points, 0);
  });
}

test('veredictos', () => {
  const w = getW('normal');
  assert.equal(scoreGuess(50, 50, w).verdict, 'bullseye');
  assert.equal(scoreGuess(50 + 2 * w, 50, w).verdict, 'close');
  assert.equal(scoreGuess(50 + 4 * w, 50, w).verdict, 'near');
  assert.equal(scoreGuess(90, 50, w).verdict, 'far');
});

test('dificultad desconocida → normal', () => assert.equal(getW('xx'), 1.75));

test('extremos 0 y 100: la zona no se recorta y la puntuación es por distancia', () => {
  const w = 1.75;
  const bands = zoneBands(0, w);
  assert.equal(bands.length, 5);
  assert.deepEqual(bands.map((b) => b.points), [2, 3, 4, 3, 2]);
  assert.ok(bands[0].from < 0, 'sobresale por la izquierda');
  assert.equal(bands[2].from, -w);
  assert.equal(bands[4].to, 5 * w);
  for (const b of bands) assert.ok(b.labelAt >= 0 && b.labelAt <= 100, 'etiqueta dentro de la cara');
  assert.equal(scoreGuess(0, 0, w).points, 4);
  assert.equal(scoreGuess(5 * w, 0, w).points, 2);
  assert.equal(scoreGuess(100, 100, w).points, 4);
  assert.equal(scoreGuess(100 - 3 * w, 100, w).points, 3);
  const top = zoneBands(100, w);
  for (const b of top) assert.ok(b.labelAt >= 0 && b.labelAt <= 100);
});

test('franjas contiguas, ancho 2w, total ±5w', () => {
  const b = zoneBands(40, 2.5);
  for (let i = 1; i < b.length; i++) assert.equal(b[i].from, b[i - 1].to);
  assert.equal(b[0].from, 40 - 12.5);
  assert.equal(b[4].to, 40 + 12.5);
});

test('mapeo valor ↔ ángulo ↔ puntero', () => {
  assert.equal(valueToAngle(0), Math.PI);
  assert.ok(Math.abs(valueToAngle(50) - Math.PI / 2) < 1e-12);
  assert.equal(valueToAngle(100), 0);
  assert.ok(Math.abs(pointerToValue(0, -10) - 50) < 1e-9);
  assert.equal(pointerToValue(-10, 0.0001 - 0), 0);          // justo debajo → extremo izquierdo
  assert.equal(pointerToValue(10, 5), 100);                   // debajo a la derecha → 100
  assert.equal(pointerToValue(-10, 5), 0);
});

// ---------- Saneamiento ----------
test('saneamiento de texto', () => {
  assert.equal(sanitizeText('  a<b>c&d"e\'f`g  ', 20), 'abcdefg');
  assert.equal(sanitizeText('a    b \n c', 20), 'a b c');
  assert.equal(sanitizeText('abcdefghijklmnopqrstuvwxyz', 18), 'abcdefghijklmnopqr');
  assert.equal(sanitizeText(null, 5), '');
  assert.equal(sanitizeText('😀😀😀', 2), '😀😀');
});

test('nombres: vacíos y duplicados', () => {
  assert.deepEqual(sanitizePlayers(['', '']), ['Jugador 1', 'Jugador 2']);
  assert.deepEqual(sanitizePlayers(['Ana', 'ANA']), ['Ana', 'ANA 2']);
  assert.deepEqual(sanitizePlayers(['Ana', 'ana', 'Ana']), ['Ana', 'ana 2', 'Ana 3']);
  const long = 'x'.repeat(14);
  const [a, b] = sanitizePlayers([long, long]);
  assert.ok(b.length <= 14 && b.endsWith(' 2') && a !== b);
});

test('categoría: ambos extremos obligatorios', () => {
  assert.equal(sanitizeCategory('Frío', ''), null);
  assert.deepEqual(sanitizeCategory(' Frío ', 'Caliente'), { left: 'Frío', right: 'Caliente' });
});

// ---------- Ajustes ----------
test('validación de ajustes corruptos', () => {
  assert.deepEqual(validateSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(validateSettings('x'), DEFAULT_SETTINGS);
  const v = validateSettings({ theme: 'neon', difficulty: 'insane', target: 99, sound: 'yes', lang: 'xx', hints: false });
  assert.equal(v.theme, 'auto'); assert.equal(v.difficulty, 'normal'); assert.equal(v.target, 10);
  assert.equal(v.sound, true); assert.equal(v.lang, 'es'); assert.equal(v.hints, false);
  assert.equal(validateSettings({ target: 0 }).target, 0);
});

test('carga con JSON corrupto y con localStorage que lanza', () => {
  const bad = createStorage(() => ({ getItem: () => '{no json', setItem() {}, removeItem() {} }));
  assert.deepEqual(loadSettings(bad), DEFAULT_SETTINGS);
  const throwing = createStorage(() => { throw new Error('blocked'); });
  assert.equal(throwing.persistent, false);
  throwing.set(STORAGE_KEY, '{"theme":"dark"}');
  assert.equal(loadSettings(throwing).theme, 'dark');
});

// ---------- Partida ----------
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test('psíquico: aleatorio al inicio y alternancia estricta', () => {
  assert.equal(nextPsychic(null, 2, () => 0.9), 1);
  assert.equal(nextPsychic(null, 2, () => 0.1), 0);
  assert.equal(nextPsychic(0, 2), 1);
  assert.equal(nextPsychic(1, 2), 0);
  assert.equal(nextPsychic(2, 3), 0);
});

test('victoria y empate', () => {
  assert.equal(checkWinner([10, 8], 10), 0);
  assert.equal(checkWinner([10, 10], 10), null);        // empate: continúa
  assert.equal(checkWinner([12, 10], 10), 0);
  assert.equal(checkWinner([9, 9], 10), null);
  assert.equal(checkWinner([99, 0], 0), null);          // infinito
  assert.equal(checkWinner([10, 8], 10, 3, true), null); // equidad: rondas desiguales (n=2)
  assert.equal(checkWinner([10, 8], 10, 4, true), 0);
});

test('flujo completo, guardas de fase y dificultad en la ronda siguiente', () => {
  const g = createGame({ rng: seq(0, 0.3) }); // psíquico 0, target 30
  g.newMatch(['Ana', 'Bea']);
  assert.equal(g.state.phase, 'setup');
  assert.ok(g.beginRound({ category: { left: 'a', right: 'b' }, difficulty: 'easy' }));
  assert.equal(g.state.psychic, 0); assert.equal(g.state.guesser, 1);
  assert.equal(g.state.w, 2.5); assert.equal(g.state.guess, 50);
  assert.equal(g.setGuess(10), false, 'no se mueve fuera de la fase guess');
  assert.equal(g.hidePsychic(), false);
  assert.ok(g.showPsychic()); assert.equal(g.showPsychic(), false, 'doble toque');
  assert.ok(g.hidePsychic());
  g.setGuess(30);
  const r = g.lock({ target: 10 });
  assert.equal(r.points, 4);
  assert.equal(g.lock({ target: 10 }), null, 'doble confirmación ignorada');
  assert.deepEqual(g.state.scores, [0, 4], 'solo puntúa el adivino');
  g.beginRound({ category: null, difficulty: 'hard' });
  assert.equal(g.state.psychic, 1, 'alterna'); assert.equal(g.state.w, 1.25);
});

test('partida hasta 10 puntos con empate que se prolonga', () => {
  const g = createGame({ rng: () => 0.5 });
  g.newMatch(['A', 'B']);
  const play = (guess) => {
    g.beginRound({ category: null, difficulty: 'normal' });
    g.showPsychic(); g.hidePsychic();
    g.setGuess(guess === 'hit' ? g.state.target : (g.state.target + 50) % 100 > 0 ? (g.state.target < 50 ? 100 : 0) : 0);
    return g.lock({ target: 10 });
  };
  // 3 rondas acertadas por el mismo adivino alternando psíquico → ambos suman 4 por turno
  for (let i = 0; i < 4; i++) play('hit');
  assert.deepEqual(g.state.scores, [8, 8]);
  assert.equal(g.state.finished, false);
  play('hit'); // suma 4 al adivino de la ronda 5 → 12 vs 8
  assert.equal(g.state.finished, true);
  assert.equal(g.beginRound({ category: null, difficulty: 'normal' }), false);
  g.rematch();
  assert.deepEqual(g.state.scores, [0, 0]); assert.equal(g.state.finished, false);
  assert.deepEqual(g.state.players, ['A', 'B']);
});

test('multijugador 3–8 rota y resumen', () => {
  const g = createGame({ rng: () => 0 });
  g.newMatch(['A', 'B', 'C']);
  const order = [];
  for (let i = 0; i < 4; i++) {
    g.beginRound({ category: null, difficulty: 'normal' });
    order.push(g.state.psychic);
    g.showPsychic(); g.hidePsychic(); g.setGuess(g.state.target); g.lock({ target: 0 });
  }
  assert.deepEqual(order, [0, 1, 2, 0]);
  const s = summarize(g.state.history, 3);
  assert.equal(s.best.points, 4);
  assert.equal(s.perPlayer[0].rounds + s.perPlayer[1].rounds + s.perPlayer[2].rounds, 4);
  assert.ok(s.avgDistance < 1e-9);
});

// ---------- Paletas de color ----------
import { PALETTE_IDS, DEFAULT_PALETTE, themeColor } from '../js/core/palettes.js';
import { readFileSync } from 'node:fs';

test('ajustes: paleta válida, por defecto y valores corruptos', () => {
  assert.equal(DEFAULT_SETTINGS.palette, DEFAULT_PALETTE);
  assert.equal(validateSettings({ palette: 'violet' }).palette, 'violet');
  assert.equal(validateSettings({ palette: 'neon' }).palette, DEFAULT_PALETTE);
  assert.equal(validateSettings({ palette: 42 }).palette, DEFAULT_PALETTE);
});

test('cada paleta tiene su bloque y su muestra en CSS y sus nombres en es/en', async () => {
  const css = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
  const es = (await import('../js/i18n/es.js')).default;
  const en = (await import('../js/i18n/en.js')).default;
  assert.ok(PALETTE_IDS.length >= 6);
  for (const id of PALETTE_IDS) {
    assert.match(css, new RegExp(`:root\\[data-palette="${id}"\\]`), `css ${id}`);
    assert.match(css, new RegExp(`\\.swatch\\[data-swatch="${id}"\\]`), `muestra ${id}`);
    assert.ok(es[`settings.palette.${id}`] && en[`settings.palette.${id}`], `i18n ${id}`);
  }
});

test('theme-color: hex válido y el tema oscuro es más oscuro que el claro', () => {
  for (const id of PALETTE_IDS) {
    const l = themeColor(id, 'light'), d = themeColor(id, 'dark');
    assert.match(l, /^#[0-9A-F]{6}$/); assert.match(d, /^#[0-9A-F]{6}$/);
    assert.ok(parseInt(l.slice(1, 3), 16) > parseInt(d.slice(1, 3), 16), id);
  }
});
