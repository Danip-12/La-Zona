/**
 * Arranque y orquestación. Aquí vive el "contexto" que comparten las vistas:
 * ajustes, juego (estado), servicios y navegación. La lógica de reglas está en core/.
 */
import { createGame } from './core/game.js';
import { createStorage, loadSettings, saveSettings, validateSettings, STORAGE_KEY } from './core/settings.js';
import { createCategoryDeck } from './data/packs.js';
import { themeColor } from './core/palettes.js';
import { setLang, t, detectLang } from './i18n/index.js';
import { createFeedback } from './services/feedback.js';
import { createEntitlements } from './services/monetization.js';
import { createAnalytics } from './services/analytics.js';
import { h, clear, announce } from './ui/dom.js';
import { renderHome, resetHomeForm } from './ui/home.js';
import { mountGame } from './ui/game-view.js';
import { confirmDialog, backAndWait, onRouteBack } from './ui/modal.js';
import { openTutorial } from './ui/tutorial.js';

const root = document.getElementById('app');
const storage = createStorage();
const firstRun = storage.get(STORAGE_KEY) == null;
let settings = loadSettings(storage);
if (firstRun) settings = validateSettings({ ...settings, lang: detectLang() });

const game = createGame();
const feedback = createFeedback(() => settings);
const entitlements = createEntitlements(storage);
const analytics = createAnalytics(() => settings);

let view = 'home';          // 'home' | 'game'
let gameView = null;
let source = null;          // { mode:'packs', packIds } | { mode:'custom', category }
let deck = null;
let installEvent = null;

// ---------------- ajustes → DOM ----------------
function applySettings() {
  const el = document.documentElement;
  setLang(settings.lang);
  el.setAttribute('lang', settings.lang);
  el.setAttribute('data-theme', settings.theme);
  el.setAttribute('data-palette', settings.palette);
  if (settings.reduceMotion) el.setAttribute('data-motion', 'reduce'); else el.removeAttribute('data-motion');
  document.title = t('meta.title');
  // Barra del sistema: en "auto" cada meta sigue al sistema; con tema fijo, los dos usan el mismo color.
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  [['light', '(prefers-color-scheme: light)'], ['dark', '(prefers-color-scheme: dark)']].forEach(([mode, media], i) => {
    const m = metas[i];
    if (!m) return;
    const fixed = settings.theme === 'auto' ? mode : settings.theme;
    m.setAttribute('content', themeColor(settings.palette, fixed));
    if (settings.theme === 'auto') m.setAttribute('media', media); else m.removeAttribute('media');
  });
}

// ---------------- contexto compartido ----------------
const ctx = {
  get settings() { return settings; },
  storage, game, feedback, entitlements, analytics,
  listeners: new Set(),

  setSetting(key, value, { silent = false } = {}) {
    settings = validateSettings({ ...settings, [key]: value });
    saveSettings(storage, settings);
    applySettings();
    // Solo se repinta la vista cuando el ajuste cambia su contenido (no con el tema ni el movimiento).
    if (!silent && (key === 'lang' || key === 'hints')) ctx.rerender();
    ctx.listeners.forEach((fn) => fn(key));
  },
  resetSettings() {
    const keep = { onboarded: settings.onboarded, analyticsAsked: settings.analyticsAsked };
    settings = validateSettings({ ...keep, lang: detectLang() });
    saveSettings(storage, settings);
    applySettings();
    ctx.rerender();
  },
  rerender() {
    if (view === 'home') renderHome(ctx, root);
    else mountGameView();
  },

  // ---- partida ----
  startGame({ names, source: src }) {
    game.newMatch(names, (n) => t('home.player', { n }));
    source = src;
    deck = src.mode === 'packs' ? createCategoryDeck(src.packIds, settings.lang) : null;
    view = 'game';
    history.pushState({ lz: 'game' }, '');
    analytics.track('game_start', { players: game.state.players.length, packs: src.packIds?.length ?? 0 });
    ctx.nextRound();
    mountGameView();
    announce(t('game.turnOf', { name: game.state.players[game.state.psychic] }));
  },
  /** La categoría se mantiene entre rondas; solo cambia con "Otra categoría" (o al empezar). */
  drawCategory(current = game.state.category) {
    if (source.mode === 'custom') return source.category;
    return current ?? deck.draw(settings.lang);
  },
  nextRound(current) {
    game.beginRound({ category: ctx.drawCategory(current), difficulty: settings.difficulty });
    gameView?.update();
    announce(t('game.turnOf', { name: game.state.players[game.state.psychic] }));
  },
  rematch() { const keep = game.state.category; game.rematch(); ctx.nextRound(keep); },
  canChangeCategory: () => source?.mode === 'packs',
  anotherCategory() {
    if (game.setCategory(deck.draw(settings.lang))) gameView.update();
  },

  // ---- navegación ----
  async exitGame() {
    if (view !== 'game') return;
    if (hasPoints() && !(await confirmDialog({ title: t('game.leave'), message: t('game.confirmLeave'),
      confirmLabel: t('game.leave'), cancelLabel: t('game.stay') }))) return;
    await backAndWait();      // retira la entrada 'game' del historial
    showHome();
  },
  canInstall: () => !!installEvent,
  async install() { if (!installEvent) return; installEvent.prompt(); await installEvent.userChoice.catch(() => {}); installEvent = null; ctx.rerender(); },
};

const hasPoints = () => game.state.scores.some((n) => n > 0);

function mountGameView() {
  gameView?.destroy();
  clear(root);
  gameView = mountGame(ctx, root);
}

function showHome() {
  gameView?.destroy(); gameView = null;
  game.newMatch([], () => '');   // vacía jugadores, categoría y marcador
  source = null; deck = null;
  resetHomeForm();
  view = 'home';
  renderHome(ctx, root);
}

// Botón/gesto "atrás" del sistema estando en la partida (sin modales abiertos).
onRouteBack(async () => {
  if (view !== 'game') return;
  if (!hasPoints()) { showHome(); return; }
  history.pushState({ lz: 'game' }, '');   // se queda en la partida mientras se pregunta
  if (await confirmDialog({ title: t('game.leave'), message: t('game.confirmLeave'),
    confirmLabel: t('game.leave'), cancelLabel: t('game.stay') })) {
    await backAndWait();
    showHome();
  }
});

// ---------------- avisos (toast) ----------------
function toast(message, action) {
  const el = h('div', { class: 'toast', role: 'status' }, h('span', null, message),
    action ? h('button', { class: 'toast__btn', type: 'button', onClick: () => { action.run(); el.remove(); } }, action.label) : null,
    h('button', { class: 'toast__x', type: 'button', 'aria-label': t('common.close'), onClick: () => el.remove() }, '×'));
  document.body.append(el);
  if (!action) setTimeout(() => el.remove(), 4000);
}

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; if (view === 'home') ctx.rerender(); });
window.addEventListener('appinstalled', () => { installEvent = null; if (view === 'home') ctx.rerender(); });

// ---------------- service worker ----------------
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const hadController = !!navigator.serviceWorker.controller;
    const reg = await navigator.serviceWorker.register('sw.js');
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state !== 'installed') return;
        if (hadController) toast(t('pwa.update'), { label: t('pwa.reload'), run: () => location.reload() });
        else toast(t('pwa.offlineReady'));
      });
    });
  } catch { /* sin SW (p. ej. file://): la app sigue funcionando en línea */ }
}

// ---------------- arranque ----------------
applySettings();
history.replaceState({ lz: 'home' }, '');
renderHome(ctx, root);
root.removeAttribute('aria-busy');
if (!settings.onboarded) openTutorial(ctx);
registerSW();

// Útil para depurar y para los tests e2e: solo lectura de versión.
window.__lazona = Object.freeze({ version: '1.0.0' });
