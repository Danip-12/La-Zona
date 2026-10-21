/**
 * Controles accesibles basados en elementos nativos (radio y checkbox),
 * con estilo propio. Teclado y lectores de pantalla funcionan sin trabajo extra.
 */
import { h, icon } from './dom.js';
import { ICONS } from './icons.js';
import { PALETTE_IDS } from '../core/palettes.js';

let uid = 0;

/** Grupo segmentado (radios nativos). */
export function segmented({ legend, name, options, value, onChange, hint }) {
  const gid = `seg-${++uid}`;
  const hintEl = hint ? h('p', { class: 'field__hint', id: `${gid}-h` }, hint) : null;
  return h('fieldset', { class: 'field', 'aria-describedby': hint ? `${gid}-h` : null },
    h('legend', { class: 'field__label' }, legend),
    h('div', { class: 'seg' },
      options.map((o) => {
        const input = h('input', { type: 'radio', name: name ?? gid, value: String(o.value), checked: o.value === value,
          onChange: () => onChange(o.value) });
        return h('label', { class: 'seg__opt' }, input, h('span', null, o.label));
      })),
    hintEl);
}

/** Interruptor (checkbox con role=switch). */
export function toggle({ label, hint, checked, onChange, disabled }) {
  const gid = `tg-${++uid}`;
  const input = h('input', { type: 'checkbox', role: 'switch', id: gid, class: 'switch__input', checked: !!checked,
    disabled: !!disabled, 'aria-describedby': hint ? `${gid}-h` : null, onChange: (e) => onChange(e.target.checked) });
  return h('div', { class: 'row-switch' },
    h('label', { class: 'row-switch__text', for: gid },
      h('span', { class: 'row-switch__label' }, label),
      hint ? h('span', { class: 'field__hint', id: `${gid}-h` }, hint) : null),
    h('span', { class: 'switch' }, input, h('span', { class: 'switch__track', 'aria-hidden': 'true' })));
}

/** Campo de texto con etiqueta visible. */
export function textField({ label, value = '', placeholder = '', maxLength, name, autocomplete = 'off', onInput, id }) {
  const gid = id ?? `tf-${++uid}`;
  const input = h('input', { class: 'input', id: gid, name, type: 'text', value, placeholder, maxlength: maxLength,
    autocomplete, autocapitalize: 'sentences', spellcheck: 'false', enterkeyhint: 'next', onInput: (e) => onInput?.(e.target.value) });
  return { input, el: h('div', { class: 'field' }, h('label', { class: 'field__label', for: gid }, label), input) };
}

/** Selector de color principal: radios nativos con muestra visual + nombre escrito (no solo color). */
export function palettePicker({ legend, value, onChange, hint, label }) {
  const gid = `pal-${++uid}`;
  return h('fieldset', { class: 'field', 'aria-describedby': hint ? `${gid}-h` : null },
    legend ? h('legend', { class: 'field__label' }, legend) : null,
    h('div', { class: 'swatches' },
      PALETTE_IDS.map((id) => {
        const input = h('input', { type: 'radio', name: 'palette', value: id, checked: id === value, onChange: () => onChange(id) });
        return h('label', { class: 'swatch', 'data-swatch': id }, input,
          h('span', { class: 'swatch__dot', 'aria-hidden': 'true' }, icon(ICONS.check, 16)),
          h('span', { class: 'swatch__name' }, label(id)));
      })),
    hint ? h('p', { class: 'field__hint', id: `${gid}-h` }, hint) : null);
}
