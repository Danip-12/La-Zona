/** Diálogo de compra (solo accesible con MONETIZATION_ENABLED = true). Nunca se muestra durante la partida. */
import { h } from './dom.js';
import { openModal } from './modal.js';
import { PRODUCTS } from '../services/monetization.js';
import { t, formatPrice } from '../i18n/index.js';

export function openStore(ctx) {
  return openModal({
    title: t('store.title'),
    build(body, api) {
      const msg = h('p', { class: 'notice', role: 'status', hidden: true });
      const buy = (product) => async () => {
        const r = await ctx.entitlements.purchase(product.id);
        if (r.ok) { api.close('purchased'); ctx.rerender(); }
        else { msg.hidden = false; msg.textContent = t('store.unavailable'); }
      };
      body.append(
        h('p', null, t('store.body')),
        h('button', { class: 'btn btn--primary btn--block', type: 'button', 'data-autofocus': '', onClick: buy(PRODUCTS.premiumPacks) },
          t('store.buy', { price: formatPrice(PRODUCTS.premiumPacks.price) })),
        h('button', { class: 'btn btn--ghost btn--block', type: 'button', onClick: buy(PRODUCTS.removeAds) },
          `${t('store.removeAds')} · ${formatPrice(PRODUCTS.removeAds.price)}`),
        h('button', { class: 'btn btn--ghost btn--block', type: 'button', onClick: async () => {
          const r = await ctx.entitlements.restore();
          if (r.ok) { api.close('restored'); ctx.rerender(); } else { msg.hidden = false; msg.textContent = t('store.unavailable'); }
        } }, t('store.restore')),
        msg);
    },
  });
}
