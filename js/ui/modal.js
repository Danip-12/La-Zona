/**
 * Modales y navegación con History API.
 *  - Hoja inferior en móvil (con gesto de deslizar para cerrar) / modal centrado en escritorio (CSS).
 *  - Foco atrapado, Escape, clic en el fondo, botón atrás del sistema y retorno del foco.
 *  - Cada modal añade una entrada al historial para que "atrás" lo cierre en vez de salir de la partida.
 */
import { h, icon } from './dom.js';
import { ICONS } from './icons.js';
import { t } from '../i18n/index.js';

const stack = [];            // modales abiertos (el último está arriba)
let ignorePops = 0;          // popstate provocados por nuestro propio history.back()
let routeHandler = null;     // lo registra main.js: qué hacer con "atrás" sin modales
let uid = 0;

export const isModalOpen = () => stack.length > 0;
export const onRouteBack = (fn) => { routeHandler = fn; };

/** history.back() que resuelve cuando el navegador ha terminado (con salvaguarda). */
export function backAndWait() {
  return new Promise((resolve) => {
    ignorePops += 1;
    const done = () => { window.removeEventListener('popstate', done); clearTimeout(timer); resolve(); };
    const timer = setTimeout(() => { ignorePops = Math.max(0, ignorePops - 1); done(); }, 400);
    window.addEventListener('popstate', done);
    history.back();
  });
}

window.addEventListener('popstate', () => {
  if (ignorePops > 0) { ignorePops -= 1; return; }
  if (stack.length) { stack[stack.length - 1].close('system-back', true); return; }
  routeHandler?.();
});

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * @param {{title:string, build:(body:HTMLElement, api:any)=>void, variant?:'sheet'|'dialog', onClose?:()=>void}} opts
 */
export function openModal({ title, build, variant = 'sheet', onClose }) {
  const id = `modal-${++uid}`;
  const opener = document.activeElement;
  const app = document.getElementById('app');
  let closed = false;
  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });

  const titleEl = h('h2', { id: `${id}-title`, class: 'sheet__title' }, title);
  const closeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('common.close'), onClick: () => api.close('button') }, icon(ICONS.close));
  const grab = h('div', { class: 'sheet__grab', 'aria-hidden': 'true' });
  const head = h('header', { class: 'sheet__head' }, grab, titleEl, closeBtn);
  const body = h('div', { class: 'sheet__body' });
  const sheet = h('div', { class: `sheet sheet--${variant}`, role: variant === 'dialog' ? 'alertdialog' : 'dialog',
    'aria-modal': 'true', 'aria-labelledby': titleEl.id, tabindex: '-1' }, head, body);
  const overlay = h('div', { class: 'overlay', onPointerdown: (e) => { if (e.target === overlay) api.close('backdrop'); } }, sheet);

  // ---- gesto de deslizar hacia abajo (solo hoja) ----
  if (variant === 'sheet') {
    let startY = 0, dy = 0, dragging = false, startT = 0;
    head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      dragging = true; startY = e.clientY; dy = 0; startT = e.timeStamp;
      head.setPointerCapture(e.pointerId);
      sheet.style.transition = 'none';
    });
    head.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      dy = Math.max(0, e.clientY - startY);
      sheet.style.transform = `translateY(${dy}px)`;
    });
    const release = (e) => {
      if (!dragging) return;
      dragging = false;
      sheet.style.transition = '';
      const v = dy / Math.max(1, e.timeStamp - startT); // px/ms
      if (dy > 110 || (dy > 30 && v > 0.6)) api.close('swipe');
      else sheet.style.transform = '';
    };
    head.addEventListener('pointerup', release);
    head.addEventListener('pointercancel', release);
  }

  // ---- teclado: Escape y trampa de foco ----
  overlay.addEventListener('keydown', (e) => {
    if (stack[stack.length - 1] !== api) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); api.close('escape'); return; }
    if (e.key !== 'Tab') return;
    const items = [...sheet.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement);
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  const api = {
    el: sheet, body, done, titleEl,
    /** fromPop: el navegador ya retiró la entrada del historial. */
    close(reason = 'api', fromPop = false) {
      if (closed) return;
      closed = true;
      const i = stack.indexOf(api);
      if (i >= 0) stack.splice(i, 1);
      overlay.classList.add('is-closing');
      const finish = () => {
        overlay.remove();
        if (!stack.length) { app?.removeAttribute('inert'); app?.removeAttribute('aria-hidden'); }
        if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
        onClose?.(reason);
        resolveDone(reason);
      };
      const reduce = document.documentElement.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) finish(); else setTimeout(finish, 180);
      if (!fromPop) { ignorePops += 1; history.back(); }
    },
  };

  stack.push(api);
  history.pushState({ lz: 'modal', id }, '');
  app?.setAttribute('inert', '');
  app?.setAttribute('aria-hidden', 'true');
  document.body.append(overlay);
  build(body, api);
  const firstFocus = sheet.querySelector('[data-autofocus]') ?? sheet.querySelector(FOCUSABLE.replace('a[href],', '')) ?? sheet;
  (firstFocus === closeBtn ? (sheet.querySelector('.sheet__body ' + FOCUSABLE) ?? closeBtn) : firstFocus).focus({ preventScroll: true });
  return api;
}

/** Confirmación accesible: devuelve Promise<boolean>. */
export function confirmDialog({ title, message, confirmLabel, cancelLabel }) {
  return new Promise((resolve) => {
    let answer = false;
    const m = openModal({
      title, variant: 'dialog',
      build(body, api) {
        body.append(
          h('p', { class: 'dialog__msg' }, message),
          h('div', { class: 'dialog__actions' },
            h('button', { class: 'btn btn--ghost', type: 'button', 'data-autofocus': '', onClick: () => api.close('cancel') }, cancelLabel ?? t('common.cancel')),
            h('button', { class: 'btn btn--primary', type: 'button', onClick: () => { answer = true; api.close('confirm'); } }, confirmLabel ?? t('common.accept'))));
      },
    });
    m.done.then(() => resolve(answer));
  });
}
