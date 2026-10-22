/** Panel de ajustes (hoja inferior en móvil, modal en escritorio). */
import { h, add, clear } from './dom.js';
import { openModal } from './modal.js';
import { segmented, toggle, palettePicker } from './controls.js';
import { t, availableLangs, langName } from '../i18n/index.js';
import { canVibrate } from '../services/feedback.js';
import { openStore } from './store.js';

export function openSettings(ctx) {
  return openModal({
    title: t('settings.title'),
    build(body, api) {
     const render = () => {
      clear(body);
      api.titleEl.textContent = t('settings.title');
      api.el.querySelector('.sheet__head .icon-btn')?.setAttribute('aria-label', t('common.close'));
      const S = ctx.settings;
      const set = (k) => (v) => ctx.setSetting(k, v);
      const section = (title, ...kids) => h('section', { class: 'group' }, h('h3', { class: 'group__title' }, title), ...kids);

      if (!ctx.storage.persistent) add(body, h('p', { class: 'notice', role: 'note' }, t('settings.storageWarn')));

      add(body, 
        section(t('settings.game'),
          segmented({ legend: t('settings.difficulty'), name: 'difficulty', value: S.difficulty, onChange: set('difficulty'),
            hint: t('settings.difficultyHint'),
            options: ['easy', 'normal', 'hard'].map((v) => ({ value: v, label: t(`settings.difficulty.${v}`) })) }),
          segmented({ legend: t('settings.target'), name: 'target', value: S.target, onChange: (v) => set('target')(Number(v)),
            options: [10, 15, 0].map((v) => ({ value: v, label: t(`settings.target.${v}`) })) }),
          toggle({ label: t('home.fair'), hint: t('home.fairHint'), checked: S.fairTurns, onChange: set('fairTurns') }),
          toggle({ label: t('settings.hints'), checked: S.hints, onChange: set('hints') })),

        section(t('settings.look'),
          segmented({ legend: t('settings.theme'), name: 'theme', value: S.theme, onChange: set('theme'),
            options: ['light', 'dark', 'auto'].map((v) => ({ value: v, label: t(`settings.theme.${v}`) })) }),
          palettePicker({ legend: t('settings.palette'), value: S.palette, onChange: set('palette'), hint: t('settings.paletteHint'),
            label: (id) => t(`settings.palette.${id}`) }),
          segmented({ legend: t('settings.language'), name: 'lang', value: S.lang, onChange: set('lang'),
            options: availableLangs().map((c) => ({ value: c, label: langName(c) })) }),
          toggle({ label: t('settings.reduceMotion'), checked: S.reduceMotion, onChange: set('reduceMotion') })),

        section(t('settings.feedback'),
          toggle({ label: t('settings.sound'), checked: S.sound, onChange: (v) => { set('sound')(v); if (v) { ctx.feedback.unlock(); ctx.feedback.sample(); } } }),
          canVibrate() ? toggle({ label: t('settings.vibration'), checked: S.vibration, onChange: (v) => { set('vibration')(v); if (v) navigator.vibrate?.(30); } }) : null),

        section(t('settings.legal'),
          toggle({ label: t('settings.analytics'), hint: t('settings.analyticsHint'), checked: S.analytics, onChange: set('analytics') }),
          h('div', { class: 'links' },
            h('a', { class: 'link', href: 'legal/privacy.html', target: '_blank', rel: 'noopener' }, t('settings.privacy')),
            h('a', { class: 'link', href: 'legal/terms.html', target: '_blank', rel: 'noopener' }, t('settings.terms')))),

        ctx.entitlements.enabled
          ? section(t('home.premium'),
              h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => openStore(ctx) }, t('home.unlock')),
              h('button', { class: 'btn btn--ghost', type: 'button', onClick: async () => { await ctx.entitlements.restore(); } }, t('settings.restore')))
          : null,

        h('button', { class: 'btn btn--ghost btn--block', type: 'button', onClick: () => { ctx.resetSettings(); api.close('reset'); } }, t('settings.reset')));
     };
     render();
     // Al cambiar de idioma el panel se vuelve a pintar en el idioma nuevo y conserva el foco.
     const onChange = (key) => { if (key === 'lang') { render(); body.querySelector('input[name="lang"]:checked')?.focus(); } };
     ctx.listeners.add(onChange);
     api.done.then(() => ctx.listeners.delete(onChange));
    },
  });
}

/** Atajo desde la pantalla de inicio: solo el selector de color. */
export function openPalette(ctx) {
  return openModal({
    title: t('settings.palette'),
    build(body) {
      add(body, palettePicker({ value: ctx.settings.palette, onChange: (v) => ctx.setSetting('palette', v),
        hint: t('settings.paletteHint'), label: (id) => t(`settings.palette.${id}`) }));
    },
  });
}
