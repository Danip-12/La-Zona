/** Pantalla de inicio / "Nueva partida". */
import { h, s, clear, icon, announce } from './dom.js';
import { ICONS } from './icons.js';
import { textField, toggle } from './controls.js';
import { confirmDialog } from './modal.js';
import { listPacks } from '../data/packs.js';
import { sanitizeCategory, LIMITS } from '../core/sanitize.js';
import { t, tn } from '../i18n/index.js';
import { openSettings, openPalette } from './settings-panel.js';
import { openHowTo } from './tutorial.js';
import { openStore } from './store.js';

/** Estado del formulario: vive mientras la app está abierta, pero se vacía al salir de una partida. */
let form = null;
export const resetHomeForm = () => { form = null; };
const freshForm = () => ({
  players: ['', ''], mode: 'packs', packs: new Set(listPacks().map((p) => p.id)), left: '', right: '',
});

/** Marca: medio dial con las tres franjas de puntuación. */
export function brandMark(size = 44) {
  const arc = (a, b, r) => {
    const p = (ang) => [24 + r * Math.cos(ang), 40 - r * Math.sin(ang)];
    const [x1, y1] = p(a), [x2, y2] = p(b);
    return `M24 40L${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}Z`;
  };
  const d = Math.PI / 180;
  return s('svg', { class: 'brand__mark', viewBox: '0 0 48 48', width: size, height: size, 'aria-hidden': 'true' },
    s('path', { d: 'M3 40a21 21 0 0142 0z', class: 'mark-face' }),
    s('path', { d: arc(122 * d, 106 * d, 19), class: 'z2' }), s('path', { d: arc(106 * d, 90 * d, 19), class: 'z3' }),
    s('path', { d: arc(90 * d, 74 * d, 19), class: 'z4' }), s('path', { d: arc(74 * d, 58 * d, 19), class: 'z3' }),
    s('path', { d: 'M24 40L24 18', class: 'mark-needle' }), s('circle', { cx: 24, cy: 40, r: 3, class: 'mark-hub' }));
}

export function renderHome(ctx, root) {
  form ??= freshForm();
  const f = form;
  clear(root);

  const err = h('p', { class: 'form__error', role: 'alert', hidden: true });
  const showError = (msg, focusEl) => { err.hidden = false; err.textContent = msg; announce(msg); focusEl?.focus(); };

  // ---- jugadores ----
  const playersBox = h('div', { class: 'players' });
  const addBtn = h('button', { class: 'btn btn--ghost btn--small', type: 'button', onClick: () => { f.players.push(''); drawPlayers(f.players.length - 1); } },
    icon(ICONS.plus, 18), t('home.addPlayer'));
  function drawPlayers(focusIdx) {
    clear(playersBox);
    f.players.forEach((val, i) => {
      const tf = textField({ label: t('home.playerField', { n: i + 1 }), value: val, placeholder: t('home.player', { n: i + 1 }),
        maxLength: LIMITS.player, onInput: (v) => { f.players[i] = v; } });
      const row = h('div', { class: 'players__row' }, tf.el);
      if (f.players.length > 2) {
        const name = val || t('home.player', { n: i + 1 });
        row.append(h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('home.removePlayer', { name }),
          onClick: () => { f.players.splice(i, 1); drawPlayers(Math.max(0, i - 1)); } }, icon(ICONS.close)));
      }
      playersBox.append(row);
      if (i === focusIdx) setTimeout(() => tf.input.focus(), 0);
    });
    addBtn.hidden = f.players.length >= LIMITS.maxPlayers;
  }

  // ---- categoría: packs / propia ----
  const catBox = h('div', { class: 'cat' });
  let leftField, rightField;
  function drawCategory() {
    clear(catBox);
    const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': t('home.category') },
      ['packs', 'custom'].map((m) => h('button', { class: 'tab', type: 'button', role: 'tab', 'aria-selected': String(f.mode === m),
        tabindex: f.mode === m ? '0' : '-1', onClick: () => { f.mode = m; drawCategory(); },
        onKeydown: (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { f.mode = f.mode === 'packs' ? 'custom' : 'packs'; drawCategory(); catBox.querySelector('[aria-selected="true"]').focus(); } } },
        t(m === 'packs' ? 'home.packs' : 'home.custom'))));
    catBox.append(tabs);

    if (f.mode === 'packs') {
      const list = h('div', { class: 'packs', role: 'group', 'aria-label': t('home.packs') });
      for (const p of listPacks()) {
        const locked = !ctx.entitlements.hasPack(p);
        const on = f.packs.has(p.id) && !locked;
        const input = h('input', { type: 'checkbox', class: 'pack__input', checked: on,
          onChange: async (e) => {
            if (locked) { e.target.checked = false; openStore(ctx); return; }
            if (e.target.checked && p.adult && !ctx.settings.adultPack) {
              const ok = await confirmDialog({ title: t(`packs.${p.id}`), message: t('packs.ageGate'), confirmLabel: t('packs.ageYes') });
              if (!ok) { e.target.checked = false; return; }
              ctx.setSetting('adultPack', true);
            }
            e.target.checked ? f.packs.add(p.id) : f.packs.delete(p.id);
          } });
        list.append(h('label', { class: `pack${locked ? ' is-locked' : ''}` }, input,
          h('span', { class: 'pack__body' },
            h('span', { class: 'pack__name' }, t(`packs.${p.id}`), p.age >= 12 ? h('span', { class: 'pack__age' }, `${p.age}+`) : null),
            h('span', { class: 'pack__count' }, tn('home.packCount', p.pairs.length))),
          locked ? h('span', { class: 'pack__lock' }, icon(ICONS.lock, 16), h('span', { class: 'sr-only' }, t('home.premium'))) : null));
      }
      catBox.append(list);
    } else {
      leftField = textField({ label: t('home.leftEnd'), value: f.left, placeholder: t('home.leftPh'), maxLength: LIMITS.extreme, onInput: (v) => { f.left = v; } });
      rightField = textField({ label: t('home.rightEnd'), value: f.right, placeholder: t('home.rightPh'), maxLength: LIMITS.extreme, onInput: (v) => { f.right = v; } });
      catBox.append(h('div', { class: 'ends' }, leftField.el, rightField.el), h('p', { class: 'field__hint' }, t('home.customNote')));
    }
  }

  function start(e) {
    e.preventDefault();
    err.hidden = true;
    if (f.mode === 'custom') {
      const cat = sanitizeCategory(f.left, f.right);
      if (!cat) {
        const empty = !sanitizeCategory(f.left, 'x') ? leftField.input : rightField.input;
        return showError(t('home.missingEnd'), empty);
      }
      return ctx.startGame({ names: f.players, source: { mode: 'custom', category: cat } });
    }
    const ids = [...f.packs].filter((id) => ctx.entitlements.hasPack(listPacks().find((p) => p.id === id)));
    if (!ids.length) return showError(t('home.noPacks'), catBox.querySelector('input'));
    ctx.startGame({ names: f.players, source: { mode: 'packs', packIds: ids } });
  }

  drawPlayers();
  drawCategory();

  root.append(h('main', { class: 'screen screen--home' },
    h('header', { class: 'topbar' },
      h('div', { class: 'brand' }, brandMark(),
        h('div', null, h('h1', { class: 'brand__name' }, t('app.name')), h('p', { class: 'brand__tag' }, t('app.tagline')))),
      h('div', { class: 'topbar__actions' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('aria.palette'), onClick: () => openPalette(ctx) }, icon(ICONS.palette)),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('home.howTo'), onClick: () => openHowTo(ctx) }, icon(ICONS.help)),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('aria.settings'), onClick: () => openSettings(ctx) }, icon(ICONS.gear)))),
    h('form', { class: 'form', novalidate: true, onSubmit: start },
      h('h2', { class: 'section-title' }, t('home.title')),
      h('section', { class: 'card', 'aria-labelledby': 'players-h' },
        h('h3', { class: 'card__title', id: 'players-h' }, t('home.players')),
        playersBox, addBtn, h('p', { class: 'field__hint' }, t('home.playersHint'))),
      h('section', { class: 'card', 'aria-labelledby': 'cat-h' },
        h('h3', { class: 'card__title', id: 'cat-h' }, t('home.category')), catBox),
      h('div', { class: 'card card--flat' },
        toggle({ label: t('home.fair'), hint: t('home.fairHint'), checked: ctx.settings.fairTurns, onChange: (v) => ctx.setSetting('fairTurns', v, { silent: true }) })),
      err,
      h('button', { class: 'btn btn--primary btn--block btn--big', type: 'submit' }, t('home.start')),
      ctx.canInstall() ? h('button', { class: 'btn btn--ghost btn--block', type: 'button', onClick: () => ctx.install() }, t('pwa.install')) : null)));
}
