/**
 * E2E con Playwright (Chromium). Juega una partida completa de dos personas, comprueba
 * que el adivino no puede ver el objetivo, la navegación, los ajustes y el modo offline.
 * Uso: npm run test:e2e   (arranca su propio servidor estático).
 */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from '../../scripts/serve.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import('/opt/npm-tools/node_modules/playwright/index.mjs')); }

const SHOTS = process.env.SHOTS_DIR;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const shot = (page, name) => (SHOTS ? page.screenshot({ path: `${SHOTS}/${name}.png` }) : null);

const server = createServer();
await new Promise((r) => server.listen(0, r));
// E2E_FILE=1 → abre index.html por file:// (como al hacer doble clic), sin servidor.
const FILE_MODE = process.env.E2E_FILE === '1';
const base = FILE_MODE ? pathToFileURL(fileURLToPath(new URL('../../index.html', import.meta.url))).href
  : `http://localhost:${server.address().port}/index.html`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
let passed = 0;
const step = async (name, fn) => { await fn(); passed++; console.log('  ✓', name); };

async function newPage(opts = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-ES', hasTouch: true, ...opts });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  return { context, page };
}

/** Lee el objetivo de la aguja (solo existe en fase psychic/reveal). */
const readTarget = (page) => page.$eval('.needle--target', (el) => {
  const m = /rotate\((-?[\d.]+)deg\)/.exec(el.style.transform);
  return m ? Number(m[1]) / 1.8 + 50 : null;
});

/** Coloca la aguja haciendo clic en el ángulo correspondiente al valor v. */
async function clickValue(page, v) {
  const box = await page.$eval('.dial__svg', (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width }; });
  const k = box.w / 396;
  const cx = box.x + 198 * k, cy = box.y + 246 * k, r = 110 * k;
  const a = Math.PI * (1 - v / 100);
  await page.mouse.click(cx + r * Math.cos(a), cy - r * Math.sin(a));
  await page.waitForTimeout(60); // la aguja se pinta en requestAnimationFrame
}

const mainBtn = (page) => page.locator('.actions .btn--primary');
const pts = async (page) => page.$$eval('.score__pts', (els) => els.map((e) => Number(e.textContent)));

console.log('LA ZONA e2e');
try {
  const { context, page } = await newPage();
  await page.goto(base);

  await step('el tutorial aparece la primera vez y se puede saltar', async () => {
    await page.getByRole('dialog').waitFor();
    assert.ok(await page.getByText('Paso 1 de 3').isVisible());
    await shot(page, '01-tutorial');
    await page.getByRole('button', { name: 'Saltar' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
  });

  await step('inicio: categoría propia obligatoria (enfoca el campo vacío)', async () => {
    await page.getByRole('tab', { name: 'Propia' }).click();
    await page.getByLabel('Nombre del jugador 1').fill('Ana');
    await page.getByLabel('Nombre del jugador 2').fill('ANA');
    await page.getByLabel('Extremo izquierdo').fill('Frío');
    await page.getByRole('button', { name: 'Empezar partida' }).click();
    assert.equal(await page.getByRole('alert').textContent(), 'Escribe los dos extremos de la categoría');
    assert.equal(await page.evaluate(() => document.activeElement.id !== '' && document.activeElement.labels[0].textContent), 'Extremo derecho');
    await shot(page, '02-home');
    await page.getByLabel('Extremo derecho').fill('Caliente');
    await page.getByRole('button', { name: 'Empezar partida' }).click();
  });

  await step('fase wait: dial tapado, sin zona ni objetivo en el DOM; nombres saneados', async () => {
    await page.locator('[data-phase="wait"]').waitFor();
    assert.equal(await page.locator('.dial__zone > *').count(), 0);
    assert.equal(await page.$eval('.needle--target', (e) => e.style.display), 'none');
    assert.equal(await page.$eval('.needle--target', (e) => e.style.transform), '');
    const names = await page.$$eval('.score__name', (e) => e.map((x) => x.textContent));
    assert.deepEqual(names.map((n) => n.toLowerCase()), ['ana', 'ana 2'].map((n) => n.toLowerCase()));
    assert.equal(await page.locator('.end--l').textContent(), 'Frío');
    await shot(page, '03-wait');
  });

  let roundsPlayed = 0;
  async function playRound({ viaKeyboard = false, miss = false, capture = '' } = {}) {
    const first = await page.locator('.score.is-psychic .score__name').textContent();
    await mainBtn(page).click();                                     // ver posición
    await page.locator('[data-phase="psychic"]').waitFor();
    const target = await readTarget(page);
    assert.ok(target >= 0 && target <= 100);
    if (capture) await shot(page, `${capture}-psychic`);
    await mainBtn(page).click();                                     // ocultar y pasar
    await page.locator('[data-phase="guess"]').waitFor();
    // El adivino no ve nada del psíquico:
    assert.equal(await page.locator('.zone').count(), 0, 'zona en el DOM durante guess');
    assert.equal(await page.locator('.zlabel').count(), 0);
    assert.equal(await page.locator('.pin').count(), 0);
    assert.equal(await page.$eval('.needle--target', (e) => e.style.transform), '', 'objetivo filtrado en el DOM');
    assert.equal(await page.getAttribute('.dial', 'role'), 'slider');
    assert.equal(await page.getAttribute('.dial', 'aria-valuenow'), '50');
    if (capture) await shot(page, `${capture}-guess`);
    const want = miss ? (target < 50 ? 100 : 0) : target;
    if (viaKeyboard) {
      await page.focus('.dial');
      for (let i = 0; i < 40; i++) await page.keyboard.press('Shift+ArrowRight');
      for (let i = 0; i < 40; i++) await page.keyboard.press('Shift+ArrowLeft');
      assert.equal(await page.getAttribute('.dial', 'aria-valuenow'), '0');
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.getAttribute('.dial', 'aria-valuenow'), '1.5');
      await clickValue(page, want);
    } else await clickValue(page, want);
    const now = Number(await page.getAttribute('.dial', 'aria-valuenow'));
    if (!miss) assert.ok(Math.abs(now - target) < 1.2, `aguja ${now} vs objetivo ${target}`);
    await page.keyboard.press('Enter');                              // confirma con teclado
    await page.locator('[data-phase="reveal"]').waitFor();
    roundsPlayed++;
    if (capture) await shot(page, `${capture}-reveal`);
    return { first, target, now };
  }

  await step('ronda 1: pista → adivinar con puntero → revelar 4 puntos al adivino', async () => {
    const before = await pts(page);
    const r = await playRound({ capture: '04' });
    const after = await pts(page);
    const psychicIdx = (await page.$$eval('.score', (e) => e.findIndex((x) => x.classList.contains('is-psychic'))));
    assert.equal(after[psychicIdx], before[psychicIdx], 'el psíquico no puntúa');
    assert.equal(after[1 - psychicIdx], before[1 - psychicIdx] + 4);
    assert.match(await page.locator('.verdict').textContent(), /¡Diana!/);
    assert.equal(await page.locator('.tag--target').count(), 1);
    assert.equal(await page.locator('.tag--guess').count(), 1);
    assert.equal(r.first.length > 0, true);
  });

  await step('el psíquico alterna estrictamente', async () => {
    const p1 = await page.locator('.score.is-psychic .score__name').textContent();
    await mainBtn(page).click();                                      // siguiente ronda
    await page.locator('[data-phase="wait"]').waitFor();
    const p2 = await page.locator('.score.is-psychic .score__name').textContent();
    assert.notEqual(p1, p2);
  });

  await step('fallar da 0 puntos; teclado Shift ×4 y Enter; pulsaciones repetidas no saltan fases', async () => {
    const before = await pts(page);
    await mainBtn(page).dblclick();                                    // doble toque
    await page.locator('[data-phase="psychic"]').waitFor();
    assert.equal(await page.locator('[data-phase="guess"]').count(), 0, 'el doble toque saltó una fase');
    await mainBtn(page).click();
    await page.locator('[data-phase="guess"]').waitFor();
    const target = await readTarget(page).catch(() => null);
    assert.equal(target, null);
    await page.focus('.dial');
    for (let i = 0; i < 40; i++) await page.keyboard.press('Shift+ArrowRight');
    assert.equal(await page.getAttribute('.dial', 'aria-valuenow'), '100');
    await page.keyboard.press('Enter');
    await page.locator('[data-phase="reveal"]').waitFor();
    roundsPlayed++;
    const after = await pts(page);
    const target2 = await readTarget(page);
    const d = Math.abs(100 - target2);
    const expected = d <= 1.75 ? 4 : d <= 5.25 ? 3 : d <= 8.75 ? 2 : 0;
    assert.equal(after.reduce((a, b) => a + b) - before.reduce((a, b) => a + b), expected);
  });

  await step('ajustes: abre, atrapa foco, Escape cierra y devuelve el foco', async () => {
    const gear = page.getByRole('button', { name: 'Abrir ajustes' });
    await gear.focus();
    await gear.press('Enter');
    await page.getByRole('dialog', { name: 'Ajustes' }).waitFor();
    for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => !!document.activeElement.closest('.sheet')), 'el foco salió del panel');
    await shot(page, '05-settings');
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Abrir ajustes');
  });

  await step('partida completa hasta 10 puntos con ganador y resumen', async () => {
    // Jugamos rondas perfectas hasta que termine la partida.
    for (let guard = 0; guard < 20; guard++) {
      const over = await page.getByText('Fin de la partida').count();
      if (over) break;
      await mainBtn(page).click();                                     // siguiente ronda
      await playRound();
    }
    await page.getByRole('heading', { name: 'Fin de la partida' }).waitFor();
    assert.match(await page.locator('.verdict').textContent(), /gana la partida/);
    const [a, b] = await pts(page);
    assert.ok(Math.max(a, b) >= 10 && a !== b);
    await shot(page, '06-final');
    await page.getByRole('button', { name: 'Ver resumen' }).click();
    await page.getByRole('dialog', { name: 'Resumen de la partida' }).waitFor();
    assert.ok(await page.getByText('Precisión media').isVisible());
    assert.ok((await page.locator('.table tbody tr').count()) >= roundsPlayed - 1);
    await shot(page, '07-summary');
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
  });

  await step('nueva partida: reinicia marcadores y mantiene jugadores', async () => {
    await page.getByRole('button', { name: 'Nueva partida' }).click();
    await page.locator('[data-phase="wait"]').waitFor();
    assert.deepEqual(await pts(page), [0, 0]);
    assert.equal((await page.$$eval('.score__name', (e) => e.length)), 2);
  });

  await step('volver al menú sin puntos no pregunta; con puntos pide confirmación', async () => {
    await mainBtn(page).click();
    await page.locator('[data-phase="psychic"]').waitFor();
    const tgt = await readTarget(page);
    await mainBtn(page).click();
    await page.locator('[data-phase="guess"]').waitFor();
    await clickValue(page, tgt); await page.keyboard.press('Enter');
    await page.locator('[data-phase="reveal"]').waitFor();
    assert.ok((await pts(page)).some((n) => n > 0));
    await page.getByRole('button', { name: 'Volver al menú' }).click();
    await page.getByRole('alertdialog').waitFor();
    assert.ok(await page.getByText('Se perderá la partida en curso. ¿Volver al inicio?').isVisible());
    await page.getByRole('button', { name: 'Seguir jugando' }).click();
    await page.getByRole('alertdialog').waitFor({ state: 'detached' });
    assert.equal(await page.locator('[data-phase="reveal"]').count(), 1, 'cancelar debe permanecer en la partida');
    await page.goBack();                                             // botón atrás del sistema
    await page.getByRole('alertdialog').waitFor();
    await page.getByRole('button', { name: 'Volver al inicio' }).click();
    await page.getByRole('heading', { name: 'Nueva partida' }).waitFor();
    assert.equal(await page.getByLabel('Nombre del jugador 1').inputValue(), '', 'el menú debe vaciar jugadores');
  });

  await step('sin errores de consola ni excepciones', async () => { assert.deepEqual(page.errors, []); });
  await context.close();

  // ---------- packs, 3+ jugadores, idioma ----------
  const g2 = await newPage();
  await g2.page.addInitScript(() => localStorage.setItem('lazona.settings.v1', JSON.stringify({ onboarded: true, lang: 'en' })));
  await g2.page.goto(base);
  await step('packs + 3 jugadores + "otra categoría" sin repetir + inglés', async () => {
    const p = g2.page;
    await p.getByRole('button', { name: 'Add player' }).click();
    assert.equal(await p.getByLabel(/Name of player/).count(), 3);
    await p.getByRole('button', { name: 'Start game' }).click();
    await p.locator('[data-phase="wait"]').waitFor();
    assert.equal(await p.locator('.score').count(), 3);
    const seen = new Set([await p.locator('.end--l').textContent() + '|' + await p.locator('.end--r').textContent()]);
    for (let i = 0; i < 8; i++) {
      await p.getByRole('button', { name: 'Another category' }).click();
      seen.add(await p.locator('.end--l').textContent() + '|' + await p.locator('.end--r').textContent());
    }
    assert.equal(seen.size, 9, 'categorías repetidas dentro de la partida');
    // La categoría NO cambia al pasar de ronda: solo con "Another category".
    const cat = () => p.locator('.end--l').textContent();
    const before = await cat();
    for (let r = 0; r < 2; r++) {
      await p.locator('.actions .btn--primary').click();
      await p.locator('[data-phase="psychic"]').waitFor();
      await p.locator('.actions .btn--primary').click();
      await p.locator('[data-phase="guess"]').waitFor();
      await p.keyboard.press('Enter');
      await p.locator('[data-phase="reveal"]').waitFor();
      await p.locator('.actions .btn--primary').click();
      await p.locator('[data-phase="wait"]').waitFor();
      assert.equal(await cat(), before, 'la categoría cambió al pasar de ronda');
    }
    await shot(p, '08-multiplayer');
  });
  await step('sin errores en la segunda sesión', async () => { assert.deepEqual(g2.page.errors, []); });
  await g2.context.close();

  // ---------- offline (el service worker no existe en file://) ----------
  if (!FILE_MODE) {
  const off = await newPage();
  await off.page.addInitScript(() => localStorage.setItem('lazona.settings.v1', JSON.stringify({ onboarded: true })));
  await off.page.goto(base);
  await step('PWA: el service worker precachea y la app funciona sin conexión', async () => {
    await off.page.evaluate(() => navigator.serviceWorker.ready);
    await off.page.waitForFunction(async () => (await caches.keys()).some((k) => k.startsWith('lazona-')));
    await off.page.reload();                       // ya controlada por el SW
    await off.context.setOffline(true);
    await off.page.reload();
    await off.page.getByRole('heading', { name: 'Nueva partida' }).waitFor();
    await off.page.getByRole('button', { name: 'Empezar partida' }).click();
    await off.page.locator('[data-phase="wait"]').waitFor();
    await off.page.getByRole('button', { name: /^Soy / }).click();
    await off.page.locator('[data-phase="psychic"]').waitFor();
    assert.deepEqual(off.page.errors.filter((e) => !/Failed to load resource|net::ERR/.test(e)), []);
  });
  await off.context.close();
  }

  console.log(`\n${passed} comprobaciones superadas`);
} catch (e) {
  console.error('\n✗ FALLO:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
