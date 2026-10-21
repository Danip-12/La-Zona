/**
 * Helpers DOM seguros. NUNCA se usa innerHTML: el texto va siempre como nodo de texto.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

function apply(el, props) {
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v); // CSSOM: permitido por la CSP
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden') el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** h('button', {class:'btn', onClick}, 'Texto') */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  apply(el, props);
  append(el, children);
  return el;
}

/** Elemento SVG: s('circle', {cx: 1, r: 4}) */
export function s(tag, props, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  apply(el, props);
  append(el, children);
  return el;
}

export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
export const $ = (sel, root = document) => root.querySelector(sel);

/** Anuncio en la región viva global (lectores de pantalla). */
export function announce(text) {
  const live = document.getElementById('live');
  if (!live) return;
  live.textContent = '';
  // Pequeño retardo para que el cambio se detecte aunque el texto se repita.
  setTimeout(() => { live.textContent = text; }, 30);
}

/** Icono SVG a partir de datos de trazo (ver icons.js). */
export function icon(paths, size = 22) {
  const svg = s('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
    'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' });
  for (const d of paths) svg.append(s('path', { d }));
  return svg;
}

/** Como parent.append pero ignora null/false (append nativo escribiría "null"). */
export function add(parent, ...children) { append(parent, children); return parent; }
