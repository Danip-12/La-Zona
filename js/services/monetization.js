/**
 * Capa de abstracción de pagos y derechos (entitlements).
 * El juego solo pregunta `hasPack(id)`; el proveedor real (StoreKit/Play Billing vía
 * Capacitor, RevenueCat…) se enchufa con `setProvider`. Con MONETIZATION_ENABLED = false
 * todo está desbloqueado y no se muestra ningún candado.
 * Regla de producto: NUNCA se muestran anuncios en las fases guess y reveal.
 */
export const MONETIZATION_ENABLED = false;

export const PRODUCTS = Object.freeze({
  premiumPacks: { id: 'premium_packs', type: 'one-time', price: 2.99, unlocks: [] },
  removeAds: { id: 'remove_ads', type: 'one-time', price: 1.99 },
});

const KEY = 'lazona.entitlements.v1';
const ADS_ALLOWED_PHASES = new Set(['setup']); // solo en menú, jamás durante la partida

/** Proveedor por defecto: sin tienda disponible. */
const nullProvider = {
  async purchase() { return { ok: false, reason: 'unavailable' }; },
  async restore() { return { ok: false, reason: 'unavailable', owned: [] }; },
};

export function createEntitlements(storage, { enabled = MONETIZATION_ENABLED } = {}) {
  let provider = nullProvider;
  let owned = new Set();
  try { owned = new Set(JSON.parse(storage.get(KEY) ?? '[]').filter((x) => typeof x === 'string')); } catch { /* vacío */ }
  const persist = () => storage.set(KEY, JSON.stringify([...owned]));
  const packProduct = (packId) => Object.values(PRODUCTS).find((p) => p.unlocks?.includes(packId));

  return {
    enabled,
    setProvider(p) { provider = p; },
    isPremiumPack(pack) { return pack.tier === 'premium'; },
    hasPack(pack) {
      if (!enabled || pack.tier !== 'premium') return true;
      const prod = packProduct(pack.id);
      return !!prod && owned.has(prod.id);
    },
    adsRemoved: () => !enabled || owned.has(PRODUCTS.removeAds.id),
    /** Los anuncios solo pueden aparecer fuera de la partida. */
    canShowAds(phase) { return enabled && !owned.has(PRODUCTS.removeAds.id) && ADS_ALLOWED_PHASES.has(phase); },
    async purchase(productId) {
      const r = await provider.purchase(productId);
      if (r.ok) { owned.add(productId); persist(); }
      return r;
    },
    async restore() {
      const r = await provider.restore();
      if (r.ok) { r.owned.forEach((id) => owned.add(id)); persist(); }
      return r;
    },
  };
}
