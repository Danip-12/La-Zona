/** Tutorial interactivo de 3 pantallas y pantalla "Cómo se juega". */
import { h, clear } from './dom.js';
import { openModal } from './modal.js';
import { createDial } from './dial.js';
import { t } from '../i18n/index.js';

const DEMO = { target: 62, w: 2.5 };

function demoDial(mode, extra = {}) {
  const dial = createDial({});
  dial.render(mode, { ...DEMO, guess: 50, labels: { dial: t('tut.demoLabel') }, ...extra });
  return dial;
}

/** Tutorial de 3 pasos. Al terminar o saltar marca `onboarded`. */
export function openTutorial(ctx, { onDone } = {}) {
  let step = 1;
  const total = 3;
  return openModal({
    title: t('home.howTo'),
    onClose: () => { if (!ctx.settings.onboarded) ctx.setSetting('onboarded', true); onDone?.(); },
    build(body, api) {
      const render = () => {
        clear(body);
        const stage = h('div', { class: 'tut__stage' });
        if (step === 1) stage.append(demoDial('psychic').el);
        if (step === 2) {
          const d = demoDial('cover');
          stage.append(d.el, h('p', { class: 'tut__bubble', role: 'note' }, t('tut.2.example')));
        }
        if (step === 3) {
          const d = demoDial('demo', { labels: { dial: t('tut.demoLabel') } });
          stage.append(d.el);
        }
        const last = step === total;
        body.append(
          h('p', { class: 'tut__step' }, t('tut.step', { n: step, total })),
          stage,
          h('h3', { class: 'tut__title' }, t(`tut.${step}.title`)),
          h('p', { class: 'tut__body' }, t(`tut.${step}.body`)),
          h('div', { class: 'dots', 'aria-hidden': 'true' }, [1, 2, 3].map((n) => h('span', { class: n === step ? 'dot is-on' : 'dot' }))),
          h('div', { class: 'dialog__actions' },
            last || step > 1
              ? h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => { step -= 1; render(); } }, t('common.back'))
              : h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => api.close('skip') }, t('tut.skip')),
            h('button', { class: 'btn btn--primary', type: 'button', 'data-autofocus': '',
              onClick: () => { if (last) api.close('done'); else { step += 1; render(); } } }, last ? t('tut.done') : t('common.next'))));
        body.querySelector('[data-autofocus]')?.focus({ preventScroll: true });
      };
      render();
    },
  });
}

/** Pantalla "Cómo se juega", siempre accesible. */
export function openHowTo(ctx) {
  return openModal({
    title: t('howto.title'),
    build(body, api) {
      body.append(
        h('ol', { class: 'howto' }, [1, 2, 3, 4, 5, 6, 7].map((n) => h('li', null, t(`howto.${n}`)))),
        h('button', { class: 'btn btn--ghost btn--block', type: 'button',
          onClick: () => { api.close('replay'); api.done.then(() => openTutorial(ctx)); } }, t('howto.replay')));
    },
  });
}
