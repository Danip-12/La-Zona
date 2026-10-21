/**
 * Catálogo de packs. Estructura escalable: un pack es un objeto con metadatos y
 * filas; los packs descargables/de pago pueden registrarse con `registerPack`.
 * `tier`: 'free' | 'premium'. `age`: edad mínima recomendada.
 */
import { GENERAL, FAMILY, PARTY, SPORTS } from './packs-a.js';
import { MOVIES, CULTURE, ADULT } from './packs-b.js';

const toPairs = (rows) => rows.map(([esL, esR, enL, enR]) => ({ es: [esL, esR], en: [enL, enR] }));

const registry = new Map();

/** Registra o reemplaza un pack (útil para contenido descargable). */
export function registerPack(pack) {
  registry.set(pack.id, { tier: 'free', age: 0, adult: false, ...pack });
}

registerPack({ id: 'general', tier: 'free', age: 0, pairs: toPairs(GENERAL) });
registerPack({ id: 'family', tier: 'free', age: 0, pairs: toPairs(FAMILY) });
registerPack({ id: 'party', tier: 'free', age: 12, pairs: toPairs(PARTY) });
registerPack({ id: 'sports', tier: 'free', age: 0, pairs: toPairs(SPORTS) });
registerPack({ id: 'movies', tier: 'premium', age: 0, pairs: toPairs(MOVIES) });
registerPack({ id: 'culture', tier: 'premium', age: 0, pairs: toPairs(CULTURE) });
registerPack({ id: 'adult', tier: 'premium', age: 18, adult: true, pairs: toPairs(ADULT) });

export const listPacks = () => [...registry.values()];
export const getPack = (id) => registry.get(id);
export const totalPairs = () => listPacks().reduce((n, p) => n + p.pairs.length, 0);

/**
 * Selector aleatorio SIN repetición dentro de la partida.
 * @param {string[]} packIds packs activos
 * @param {string} lang
 * @param {() => number} rng
 */
export function createCategoryDeck(packIds, lang = 'es', rng = Math.random) {
  const pool = [];
  for (const id of packIds) {
    const p = registry.get(id);
    if (p) p.pairs.forEach((pair, i) => pool.push(`${id}:${i}`));
  }
  const used = new Set();
  return {
    size: pool.length,
    remaining: () => pool.length - used.size,
    /** Devuelve {left,right,key} o null si no hay packs. Reinicia el mazo al agotarlo. */
    draw(l = lang) {
      if (!pool.length) return null;
      if (used.size >= pool.length) used.clear();
      let key;
      do { key = pool[Math.floor(rng() * pool.length)]; } while (used.has(key));
      used.add(key);
      const [id, i] = key.split(':');
      const pair = registry.get(id).pairs[Number(i)];
      const [left, right] = pair[l] ?? pair.es;
      return { left, right, key };
    },
  };
}
