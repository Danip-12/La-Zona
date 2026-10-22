/**
 * Ruleta (dial) semicircular en SVG (viewBox fijo, escala con el contenedor).
 *
 * Modos:
 *  - 'cover'   (wait)    pantalla opaca con "?"; no hay zona ni objetivo en el DOM
 *  - 'guess'             cara limpia + aguja del adivino; el objetivo NO existe en el DOM
 *  - 'psychic'           zona + aguja fija en el objetivo
 *  - 'reveal'            zona + marcadores OBJETIVO / TU RESPUESTA
 *  - 'demo'              (tutorial) zona visible + aguja movible, sin marcadores
 *
 * Criterio de seguridad: en 'cover' y 'guess' nunca se crean los nodos de zona ni de objetivo,
 * así que no hay nada que inspeccionar ni que un lector de pantalla pueda leer.
 * (La "cortina" que se desvanece al salir de 'cover' solo contiene la tapa: nada del objetivo.)
 *
 * Movimiento: la aguja del adivino sigue al dedo con un muelle (inercia y pequeño rebote);
 * la revelación es una coreografía CSS (barrido de la aguja → franjas → marcadores → celebración)
 * que se activa con la clase `is-animated` y respeta "reducir animaciones".
 */
import { s, h, clear } from './dom.js';
import { zoneBands, scoreGuess, valueToAngle, pointerToValue, clamp, round1 } from '../core/scoring.js';

const CX = 200, CY = 232, R = 170, RING = 16, TICK_STEP = 2.5, MAJOR = 25;
const deg = (v) => (v - 50) * 1.8; // rotación de la aguja desde la vertical
const polar = (v, r) => { const a = valueToAngle(v); return [CX + r * Math.cos(a), CY - r * Math.sin(a)]; };
const f = (n) => n.toFixed(2);
const TAU = Math.PI * 2;
let uid = 0;

/** Sector circular entre dos valores (pueden estar fuera de 0–100). */
function sector(from, to, r) {
  const [x1, y1] = polar(from, r), [x2, y2] = polar(to, r);
  return `M${CX} ${CY}L${f(x1)} ${f(y1)}A${r} ${r} 0 0 1 ${f(x2)} ${f(y2)}Z`;
}
/** Arco abierto entre dos valores (para aros y marcas). */
function arc(from, to, r) {
  const [x1, y1] = polar(from, r), [x2, y2] = polar(to, r);
  return `M${f(x1)} ${f(y1)}A${r} ${r} 0 0 1 ${f(x2)} ${f(y2)}`;
}
/** Aguja cónica: ancha en el eje y fina en la punta. */
const taper = (len, w0, w1) => `M${CX - w0} ${CY}L${CX - w1} ${CY - len}L${CX + w1} ${CY - len}L${CX + w0} ${CY}Z`;

const reducedMotion = () => {
  try { return document.documentElement.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export function createDial({ onChange, onCommit, onStep } = {}) {
  const id = `d${++uid}`;
  const halfDisc = (r) => `M${CX - r} ${CY}A${r} ${r} 0 0 1 ${CX + r} ${CY}Z`;
  const url = (n) => `url(#${id}-${n})`;

  // ---- definiciones: degradados (los colores salen de CSS, así siguen tema y paleta) ----
  const stop = (offset, cls) => s('stop', { offset, class: cls });
  const radial = (name, r, ...stops) => s('radialGradient', { id: `${id}-${name}`, gradientUnits: 'userSpaceOnUse', cx: CX, cy: CY, r }, ...stops);
  const defs = s('defs', null,
    s('clipPath', { id: `${id}-clip` }, s('path', { d: halfDisc(R) })),
    radial('face', R * 1.05, stop(0, 'gs-face-0'), stop(0.62, 'gs-face-1'), stop(1, 'gs-face-2')),
    radial('shade', R, stop(0, 'gs-shade-0'), stop(0.5, 'gs-shade-1'), stop(1, 'gs-shade-2')),
    s('linearGradient', { id: `${id}-ring`, x1: 0, y1: 0, x2: 1, y2: 1 }, stop(0, 'gs-ring-0'), stop(0.55, 'gs-ring-1'), stop(1, 'gs-ring-2')),
    s('linearGradient', { id: `${id}-base`, x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, 'gs-ring-0'), stop(1, 'gs-ring-2')),
    s('linearGradient', { id: `${id}-gloss`, x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, 'gs-gloss-0'), stop(1, 'gs-gloss-1')),
    s('linearGradient', { id: `${id}-sheen`, x1: 0, y1: 0, x2: 1, y2: 0 }, stop(0, 'gs-sheen-0'), stop(0.5, 'gs-sheen-1'), stop(1, 'gs-sheen-0')),
    s('radialGradient', { id: `${id}-hub`, cx: 0.35, cy: 0.3, r: 0.8 }, stop(0, 'gs-ring-0'), stop(1, 'gs-ring-2')),
    s('radialGradient', { id: `${id}-floor`, cx: 0.5, cy: 0.5, r: 0.5 }, stop(0, 'gs-floor-0'), stop(1, 'gs-floor-1')));

  // ---- capas ----
  const zoneLayer = s('g', { class: 'dial__zone' });
  const labelLayer = s('g', { class: 'dial__zlabels' });
  const coverLayer = s('g', { class: 'dial__cover' });
  const ghostLayer = s('g', { class: 'dial__ghost' });
  const pinLayer = s('g', { class: 'dial__pins' });
  const fxLayer = s('g', { class: 'dial__fx' });

  const targetNeedle = s('g', { class: 'needle needle--target' },
    s('path', { class: 'needle__body', d: taper(R * 0.66, 4.2, 1.6) }),
    s('path', { class: 'needle__tip', d: `M${CX} ${CY - R * 0.74}l-8 15h16z` }));
  const guessNeedle = s('g', { class: 'needle needle--guess' },
    s('path', { class: 'needle__body', d: taper(R - 16, 4.4, 1.3) }),
    s('circle', { class: 'needle__ping', cx: CX, cy: CY - R + 12, r: 9 }),
    s('circle', { class: 'needle__knob', cx: CX, cy: CY - R + 12, r: 9 }),
    s('circle', { class: 'needle__eye', cx: CX, cy: CY - R + 12, r: 3.2 }));

  // Marcas: se guardan para poder "encender" las más cercanas a la aguja.
  const ticks = s('g', { class: 'dial__ticks' });
  const tickEls = [];
  for (let v = 0; v <= 100.001; v += TICK_STEP) {
    const major = Math.abs(v % MAJOR) < 1e-6 || Math.abs((v % MAJOR) - MAJOR) < 1e-6;
    const [x1, y1] = polar(v, R - 1), [x2, y2] = polar(v, R - (major ? 14 : 7));
    const line = s('line', { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2), class: major ? 'tick tick--major' : 'tick' });
    tickEls.push(line);
    ticks.append(line);
  }

  // Cara: aros concéntricos tenues (efecto instrumento) y brillo de cristal.
  const rings = s('g', { class: 'dial__rings' },
    s('path', { d: arc(0, 100, R * 0.78) }), s('path', { d: arc(0, 100, R * 0.56) }), s('path', { d: arc(0, 100, R * 0.34) }));
  const [g0x, g0y] = polar(9, R - 5), [g1x, g1y] = polar(91, R - 5);
  const gloss = s('path', { class: 'dial__gloss', fill: url('gloss'),
    d: `M${f(g0x)} ${f(g0y)}A${R - 5} ${R - 5} 0 0 1 ${f(g1x)} ${f(g1y)}A${(R - 5) * 1.02} ${(R - 5) * 0.62} 0 0 0 ${f(g0x)} ${f(g0y)}Z` });

  // Aro exterior: marfil con bisel y tornillos en la base.
  const ringPath = `M${CX - R - RING} ${CY}A${R + RING} ${R + RING} 0 0 1 ${CX + R + RING} ${CY}L${CX + R} ${CY}A${R} ${R} 0 0 0 ${CX - R} ${CY}Z`;
  const bw = 2 * (R + RING + 6), bx = CX - R - RING - 6;
  const ringNotches = s('g', { class: 'dial__notches' });
  [0, 25, 50, 75, 100].forEach((v) => { const [x, y] = polar(v, R + RING / 2); ringNotches.append(s('circle', { cx: f(x), cy: f(y), r: v === 50 ? 2.6 : 1.8 })); });

  const svg = s('svg', { class: 'dial__svg', viewBox: '2 -14 396 276', 'aria-hidden': 'true', focusable: 'false' },
    defs,
    s('ellipse', { class: 'dial__floor', cx: CX, cy: CY + 26, rx: R + RING + 18, ry: 22, fill: url('floor') }),
    s('path', { class: 'dial__face', d: halfDisc(R), fill: url('face') }),
    s('g', { 'clip-path': url('clip') }, rings, zoneLayer, s('path', { class: 'dial__shade', d: halfDisc(R), fill: url('shade') }), gloss),
    ticks,
    coverLayer,
    ghostLayer,
    // Aro exterior y base: se dibujan ENCIMA de la zona y tapan lo que sobresale en los extremos.
    s('path', { class: 'dial__ring', d: ringPath, fill: url('ring') }),
    s('path', { class: 'dial__groove', d: arc(0, 100, R + 1.5) }),
    ringNotches,
    s('rect', { class: 'dial__base', x: bx, y: CY - 1, width: bw, height: 24, rx: 7, fill: url('base') }),
    s('circle', { class: 'dial__screw', cx: bx + 14, cy: CY + 11, r: 3.4 }), s('circle', { class: 'dial__screw', cx: bx + bw - 14, cy: CY + 11, r: 3.4 }),
    pinLayer,
    targetNeedle, guessNeedle,
    labelLayer,
    fxLayer,
    s('circle', { class: 'dial__hub', cx: CX, cy: CY, r: 15, fill: url('hub') }),
    s('circle', { class: 'dial__hub2', cx: CX, cy: CY, r: 8.5 }),
    s('circle', { class: 'dial__hub3', cx: CX, cy: CY, r: 3.2 }),
  );

  const el = h('div', { class: 'dial' }, svg);

  // ---- estado ----
  let mode = 'cover';
  let guess = 50;            // valor lógico (lo que se confirma)
  let shown = 50;            // valor pintado: sigue a `guess` con un muelle
  let vel = 0;
  let raf = 0, last = 0;
  let dragging = false;
  let litIdx = -1;

  /** Enciende las marcas cercanas a la aguja (solo cuando hay aguja visible). */
  function lightTicks(v) {
    const idx = mode === 'guess' || mode === 'demo' || mode === 'reveal' ? Math.round(clamp(v) / TICK_STEP) : -1;
    if (idx === litIdx) return;
    tickEls.forEach((t, i) => {
      const d = litIdx < 0 ? 9 : Math.abs(i - litIdx);
      if (d <= 2) t.classList.remove('is-lit', 'is-lit-s');
    });
    litIdx = idx;
    if (idx < 0) return;
    tickEls[idx]?.classList.add('is-lit');
    tickEls[idx - 1]?.classList.add('is-lit-s');
    tickEls[idx + 1]?.classList.add('is-lit-s');
  }

  function paint(v) {
    guessNeedle.style.transform = `rotate(${deg(clamp(v, -1.5, 101.5))}deg)`;
    lightTicks(v);
  }

  /** Muelle amortiguado (ζ ≈ 0,7): la aguja tiene peso, llega con un leve rebote. */
  function step(ts) {
    const dt = Math.min(0.032, Math.max(0.001, (ts - (last || ts - 16)) / 1000));
    last = ts;
    const K = 380, C = 28;
    vel += (K * (guess - shown) - C * vel) * dt;
    shown += vel * dt;
    if (Math.abs(guess - shown) < 0.015 && Math.abs(vel) < 0.08) { shown = guess; vel = 0; raf = 0; last = 0; paint(shown); return; }
    paint(shown);
    raf = requestAnimationFrame(step);
  }
  function follow() {
    if (reducedMotion()) { shown = guess; vel = 0; paint(shown); return; }
    if (!raf) raf = requestAnimationFrame(step);
  }
  function snap() { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; shown = guess; vel = 0; paint(shown); }

  function setGuess(v, silent = false) {
    guess = clamp(v);
    if (mode === 'guess') el.setAttribute('aria-valuenow', String(round1(guess)));
    follow();
    if (!silent) onChange?.(guess);
  }

  // ---- entrada: puntero con captura ----
  function fromPointer(e) {
    const m = svg.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    setGuess(pointerToValue(p.x - CX, p.y - CY));
  }
  svg.addEventListener('pointerdown', (e) => {
    if ((mode !== 'guess' && mode !== 'demo') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    dragging = true;
    try { svg.setPointerCapture(e.pointerId); } catch { /* noop */ }
    el.classList.add('is-dragging', 'has-moved');
    el.focus({ preventScroll: true });
    fromPointer(e);
    e.preventDefault();
  });
  svg.addEventListener('pointermove', (e) => { if (dragging) fromPointer(e); });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    try { svg.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('lostpointercapture', end);

  // ---- entrada: teclado (flechas ±1.5, Mayús ×4, Enter confirma) ----
  el.addEventListener('keydown', (e) => {
    if (mode !== 'guess') return;
    const stepBy = (e.shiftKey ? 4 : 1) * 1.5;
    const dir = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
    if (dir) { e.preventDefault(); el.classList.add('has-moved'); onStep?.(dir * stepBy); }
    else if (e.key === 'Enter') { e.preventDefault(); onCommit?.(); }
  });

  // ---- dibujo según modo ----
  function drawPin(v, cls, extra = '') {
    const [x, y] = polar(v, R + RING / 2);
    return s('g', { class: `pin ${cls}${extra}` },
      s('circle', { class: 'pin__halo', cx: f(x), cy: f(y), r: 14 }),
      s('circle', { class: 'pin__dot', cx: f(x), cy: f(y), r: 8 }));
  }
  function drawTag(v, row, cls, text) {
    const [px, py] = polar(v, R + RING + 2);
    const w = Math.max(70, text.length * 7.6 + 18);
    const x = clamp(polar(v, R)[0], 2 + w / 2 + 2, 398 - w / 2 - 2);
    const y = row === 0 ? 2 : 26;
    return s('g', { class: `tag ${cls}` },
      s('line', { x1: f(x), y1: y + 10, x2: f(px), y2: f(py), class: 'tag__leader' }),
      s('rect', { x: f(x - w / 2), y: y - 10, width: f(w), height: 20, rx: 10 }),
      s('text', { x: f(x), y: y + 4.5, 'text-anchor': 'middle' }, text));
  }
  /** Confeti de acierto: puntos que salen del marcador del objetivo. */
  function burst(v) {
    const [x, y] = polar(v, R + RING / 2);
    const g = s('g', { class: 'burst' });
    const N = 16;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU + (i % 2 ? 0.2 : 0);
      const dist = 34 + (i % 3) * 14;
      const dot = s('circle', { class: `burst__dot b${i % 4}`, cx: f(x), cy: f(y), r: i % 3 === 0 ? 3.2 : 2.2 });
      dot.style.setProperty('--dx', `${f(Math.cos(a) * dist)}px`);
      dot.style.setProperty('--dy', `${f(Math.sin(a) * dist)}px`);
      g.append(dot);
    }
    g.append(s('circle', { class: 'burst__ring', cx: f(x), cy: f(y), r: 10 }));
    return g;
  }

  /** La tapa sale como una cortina que se desvanece (no contiene nada del objetivo). */
  function dropCover() {
    clear(ghostLayer);
    if (!coverLayer.firstChild || reducedMotion()) return;
    while (coverLayer.firstChild) ghostLayer.append(coverLayer.firstChild);
    ghostLayer.classList.add('is-leaving');
    setTimeout(() => { clear(ghostLayer); ghostLayer.classList.remove('is-leaving'); }, 520);
  }

  function render(nextMode, d = {}) {
    const prev = mode;
    mode = nextMode;
    const L = d.labels ?? {};
    const entering = prev !== mode;
    el.dataset.mode = mode;
    if (prev === 'cover' && mode !== 'cover') dropCover(); else clear(ghostLayer);
    [zoneLayer, labelLayer, coverLayer, pinLayer, fxLayer].forEach(clear);
    el.classList.remove('is-dragging', 'is-animated', 'is-revealing', 'is-win', 'is-miss');
    dragging = false;
    litIdx = -1; tickEls.forEach((t) => t.classList.remove('is-lit', 'is-lit-s'));

    // Atributos de accesibilidad según modo
    ['aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext', 'aria-orientation'].forEach((a) => el.removeAttribute(a));
    if (mode === 'guess') {
      el.setAttribute('role', 'slider');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', L.slider ?? '');
      el.setAttribute('aria-valuemin', '0');
      el.setAttribute('aria-valuemax', '100');
      el.setAttribute('aria-valuenow', String(round1(d.guess ?? 50)));
    } else {
      el.setAttribute('role', 'img');
      el.removeAttribute('tabindex');
      el.setAttribute('aria-label', mode === 'cover' ? L.covered ?? '' : L.dial ?? '');
    }

    // Agujas
    targetNeedle.style.display = mode === 'psychic' || mode === 'reveal' ? '' : 'none';
    // Nada del objetivo debe quedar en el DOM fuera de psychic/reveal (ni siquiera la rotación de la aguja).
    if (mode !== 'psychic' && mode !== 'reveal') targetNeedle.style.transform = '';
    guessNeedle.style.display = mode === 'guess' || mode === 'reveal' || mode === 'demo' ? '' : 'none';
    if (mode === 'guess' || mode === 'demo') {
      guess = d.guess ?? 50;
      snap();                                   // nueva ronda: la aguja empieza quieta
      el.classList.remove('has-moved');         // y vuelve a sugerir que se puede agarrar
    } else if (mode === 'reveal') {
      guess = d.guess;
      if (prev !== 'guess') snap(); else follow();   // si aún se asienta el muelle, termina solo
    } else snap();
    if (mode === 'reveal') el.setAttribute('aria-valuenow', String(round1(d.guess)));

    if (mode === 'cover') {
      const [h0x, h0y] = polar(0, R), [h1x, h1y] = polar(100, R);
      const spokes = s('g', { class: 'cover__spokes' });
      for (let v = 5; v < 100; v += 5) { const [x1, y1] = polar(v, R * 0.3), [x2, y2] = polar(v, R * 0.97); spokes.append(s('line', { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2) })); }
      coverLayer.append(
        s('path', { class: 'cover', d: halfDisc(R) }),
        s('g', { 'clip-path': url('clip') }, spokes,
          s('rect', { class: 'cover__sheen', x: CX - R - 120, y: CY - R - 10, width: 70, height: R + 20, fill: url('sheen'), transform: 'skewX(-18)' })),
        s('path', { class: 'cover__arc', d: arc(0, 100, R * 0.82) }),
        s('path', { class: 'cover__arc', d: arc(0, 100, R * 0.5) }),
        s('circle', { class: 'cover__disc', cx: CX, cy: CY - 62, r: 46 }),
        s('text', { class: 'cover__q', x: CX, y: CY - 36, 'text-anchor': 'middle' }, '?'));
      void h0x; void h0y; void h1x; void h1y;
      if (entering && prev !== null) coverLayer.classList.add('is-in');
    }

    if (mode === 'psychic' || mode === 'reveal' || mode === 'demo') {
      const bands = zoneBands(d.target, d.w);
      const revealing = mode === 'reveal' && !!d.animate;
      const animate = revealing || (mode === 'psychic' && entering);
      const outcome = mode === 'reveal' ? scoreGuess(d.guess, d.target, d.w) : null;
      // Franja que contiene la respuesta (solo se resalta al revelar).
      const hit = outcome && outcome.points > 0 ? bands.findIndex((b) => d.guess >= b.from && d.guess <= b.to) : -1;
      const order = [0, 1, 2, 1, 0];            // de fuera hacia dentro: la franja de 4 puntos "cae" la última

      bands.forEach((b, i) => {
        const p = s('path', { class: `zone z${b.points}${i === hit ? ' is-hit' : ''}`, d: sector(b.from, b.to, R) });
        p.style.setProperty('--i', String(order[i]));
        zoneLayer.append(p);
      });
      bands.forEach((b, i) => {
        const [x, y] = polar(b.labelAt, R * 0.8);
        const arcLen = 2 * d.w * (Math.PI / 100) * R * 0.8;
        const t = s('text', { class: `zlabel${i === hit ? ' is-hit' : ''}`, x: f(x), y: f(y + 5), 'text-anchor': 'middle',
          'font-size': f(clamp(arcLen * 0.85, 9, 16)) }, String(b.points));
        t.style.setProperty('--i', String(order[i]));
        labelLayer.append(t);
      });

      // Aguja del objetivo: apunta al centro exacto. En la revelación barre desde la respuesta hasta su sitio.
      if (revealing) {
        targetNeedle.style.transition = 'none';
        targetNeedle.style.transform = `rotate(${deg(d.guess)}deg)`;
        void targetNeedle.getBoundingClientRect();
        targetNeedle.style.transition = '';
      }
      if (mode === 'demo') targetNeedle.style.display = 'none';
      else targetNeedle.style.transform = `rotate(${deg(d.target)}deg)`;

      if (animate) el.classList.add('is-animated');
      if (revealing) {
        el.classList.add('is-revealing');
        if (outcome.points === 4) el.classList.add('is-win');
        if (outcome.points === 0) el.classList.add('is-miss');
        el.dataset.points = String(outcome.points);
        if (outcome.points === 4) fxLayer.append(burst(d.target));
      }
    }

    if (mode === 'psychic') pinLayer.append(drawPin(d.target, 'pin--target', ' pin--pulse'));
    if (mode === 'reveal') {
      pinLayer.append(
        drawPin(d.target, 'pin--target'), drawPin(d.guess, 'pin--guess'),
        drawTag(d.target, 0, 'tag--target', L.target ?? ''),
        drawTag(d.guess, 1, 'tag--guess', L.answer ?? ''));
    }
  }

  return { el, render, setGuess, focus: () => el.focus({ preventScroll: true }), get guess() { return guess; } };
}
