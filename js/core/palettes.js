/**
 * Paletas de color de la interfaz (color predominante). Lógica pura, sin DOM.
 * Los valores reales de color viven en css/styles.css ([data-palette="…"]); aquí solo está
 * el catálogo, el tono base (para calcular <meta theme-color>) y la validación.
 * Si añades una paleta: id aquí + bloque en styles.css + muestra en styles.css + claves i18n.
 */
export const PALETTES = Object.freeze([
  { id: 'indigo',   hue: 226, sat: 1 },
  { id: 'blue',     hue: 211, sat: 1 },
  { id: 'teal',     hue: 188, sat: 1 },
  { id: 'green',    hue: 152, sat: .9 },
  { id: 'orange',   hue: 24,  sat: 1 },
  { id: 'coral',    hue: 352, sat: 1 },
  { id: 'fuchsia',  hue: 322, sat: 1 },
  { id: 'violet',   hue: 265, sat: 1 },
  { id: 'graphite', hue: 220, sat: .2 },
]);
export const PALETTE_IDS = Object.freeze(PALETTES.map((p) => p.id));
export const DEFAULT_PALETTE = 'indigo';

/** Mismas fórmulas que el fondo en styles.css (claro: 38 % · 94 %, oscuro: 45 % · 10 %). */
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** Color de fondo de la paleta para la barra del sistema (<meta name="theme-color">). */
export function themeColor(paletteId, mode) {
  const p = PALETTES.find((x) => x.id === paletteId) ?? PALETTES[0];
  return mode === 'dark' ? hslToHex(p.hue, 45 * p.sat, 10) : hslToHex(p.hue, 38 * p.sat, 94);
}
