/**
 * Ajustes persistentes: validación estricta al cargar + almacenamiento seguro.
 */
import { DIFFICULTIES } from './scoring.js';
import { PALETTE_IDS, DEFAULT_PALETTE } from './palettes.js';

export const STORAGE_KEY = 'lazona.settings.v1';
export const THEMES = ['light', 'dark', 'auto'];
export const TARGETS = [10, 15, 0]; // 0 = infinito
export const LANGS = ['es', 'en'];

export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'auto',
  palette: DEFAULT_PALETTE,
  reduceMotion: false,
  difficulty: 'normal',
  target: 10,
  hints: true,
  sound: true,
  vibration: true,
  lang: 'es',
  fairTurns: false,
  adultPack: false,
  onboarded: false,
  analytics: false, // opt‑in, anónimo
  analyticsAsked: false,
});

const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const oneOf = (v, list, d) => (list.includes(v) ? v : d);

/** Devuelve siempre un objeto de ajustes completo y válido, venga lo que venga. */
export function validateSettings(raw) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;
  return {
    theme: oneOf(o.theme, THEMES, d.theme),
    palette: oneOf(o.palette, PALETTE_IDS, d.palette),
    reduceMotion: bool(o.reduceMotion, d.reduceMotion),
    difficulty: oneOf(o.difficulty, DIFFICULTIES, d.difficulty),
    target: oneOf(o.target, TARGETS, d.target),
    hints: bool(o.hints, d.hints),
    sound: bool(o.sound, d.sound),
    vibration: bool(o.vibration, d.vibration),
    lang: oneOf(o.lang, LANGS, d.lang),
    fairTurns: bool(o.fairTurns, d.fairTurns),
    adultPack: bool(o.adultPack, d.adultPack),
    onboarded: bool(o.onboarded, d.onboarded),
    analytics: bool(o.analytics, d.analytics),
    analyticsAsked: bool(o.analyticsAsked, d.analyticsAsked),
  };
}

/** localStorage puede lanzar (modo privado, bloqueado): se cae a memoria sin romper. */
export function createStorage(getBackend = () => globalThis.localStorage) {
  const mem = new Map();
  let backend = null;
  try {
    backend = getBackend() ?? null;
    if (backend) { backend.setItem('__t', '1'); backend.removeItem('__t'); }
  } catch { backend = null; }
  return {
    persistent: !!backend,
    get(key) {
      try { return backend ? backend.getItem(key) : mem.get(key) ?? null; } catch { return mem.get(key) ?? null; }
    },
    set(key, value) {
      mem.set(key, value);
      try { backend?.setItem(key, value); } catch { /* cuota o bloqueo: ya está en memoria */ }
    },
    remove(key) {
      mem.delete(key);
      try { backend?.removeItem(key); } catch { /* noop */ }
    },
  };
}

export function loadSettings(storage) {
  try {
    const text = storage.get(STORAGE_KEY);
    return validateSettings(text ? JSON.parse(text) : null);
  } catch {
    return validateSettings(null); // JSON corrupto
  }
}

export function saveSettings(storage, settings) {
  storage.set(STORAGE_KEY, JSON.stringify(validateSettings(settings)));
}
