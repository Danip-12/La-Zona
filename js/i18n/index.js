/**
 * i18n mínimo y sin dependencias. Los textos viven en archivos por idioma.
 * Para añadir un idioma: crear js/i18n/<código>.js, registrarlo en LOADERS y en LANGS (settings.js).
 */
import es from './es.js';
import en from './en.js';

const DICTS = { es, en };
let current = 'es';

export function setLang(lang) {
  current = DICTS[lang] ? lang : 'es';
  return current;
}
export const getLang = () => current;
export const locale = () => DICTS[current]['meta.locale'];

/** t('clave', {name}) — cae al español y, como último recurso, a la propia clave. */
export function t(key, params = {}) {
  let str = DICTS[current][key] ?? DICTS.es[key] ?? key;
  for (const [k, v] of Object.entries(params)) str = str.replaceAll(`{${k}}`, String(v));
  return str;
}

/** Plurales con Intl.PluralRules: usa key_one / key_other. */
export function tn(key, n, params = {}) {
  const rule = new Intl.PluralRules(locale()).select(n);
  const k = DICTS[current][`${key}_${rule}`] ? `${key}_${rule}` : `${key}_other`;
  return t(k, { n: formatNumber(n), ...params });
}

export const formatNumber = (n, opts) => new Intl.NumberFormat(locale(), opts).format(n);
export const formatPrice = (amount, currency = 'EUR') =>
  new Intl.NumberFormat(locale(), { style: 'currency', currency }).format(amount);

export const availableLangs = () => Object.keys(DICTS);
export const langName = (code) => new Intl.DisplayNames([code], { type: 'language' }).of(code);

/** Detecta el idioma del dispositivo entre los disponibles. */
export function detectLang(navLangs = globalThis.navigator?.languages ?? []) {
  for (const l of navLangs) { const c = l.slice(0, 2).toLowerCase(); if (DICTS[c]) return c; }
  return 'es';
}
