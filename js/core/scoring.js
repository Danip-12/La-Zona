/**
 * LA ZONA — núcleo puro de puntuación y zonas.
 * Sin DOM, sin estado: se puede probar de forma aislada (ver tests/scoring.test.js).
 */

/** Semiancho `w` de la franja central según dificultad (unidades del dial 0–100). */
export const DIFFICULTY_W = Object.freeze({ easy: 2.5, normal: 1.75, hard: 1.25 });
export const DIFFICULTIES = Object.freeze(['easy', 'normal', 'hard']);
export const DEFAULT_DIFFICULTY = 'normal';

const EPS = 1e-9; // tolerancia para comparaciones en coma flotante

export const clamp = (v, min = 0, max = 100) => Math.min(max, Math.max(min, v));

/** Devuelve `w` para una dificultad; valores desconocidos caen en "normal". */
export function getW(difficulty) {
  return DIFFICULTY_W[difficulty] ?? DIFFICULTY_W[DEFAULT_DIFFICULTY];
}

/**
 * Puntos y clave de veredicto para una respuesta.
 * d ≤ w → 4 · d ≤ 3w → 3 · d ≤ 5w → 2 · resto → 0
 * Los extremos no alteran la regla: solo cuenta la distancia.
 */
export function scoreGuess(guess, target, w) {
  const d = Math.abs(guess - target);
  if (d <= w + EPS) return { points: 4, verdict: 'bullseye', distance: d };
  if (d <= 3 * w + EPS) return { points: 3, verdict: 'close', distance: d };
  if (d <= 5 * w + EPS) return { points: 2, verdict: 'near', distance: d };
  return { points: 0, verdict: 'far', distance: d };
}

/**
 * Cinco franjas contiguas 2‑3‑4‑3‑2 centradas en `target`.
 * NO se recortan a [0,100]: pueden sobresalir del dial (ruleta física).
 * `labelAt` es el punto donde se coloca la etiqueta numérica, ya recortado
 * para quedar siempre dentro de la cara visible.
 */
export function zoneBands(target, w) {
  const pattern = [2, 3, 4, 3, 2];
  return pattern.map((points, i) => {
    const from = target + (i - 2.5) * 2 * w;
    const to = from + 2 * w;
    return { points, from, to, labelAt: visibleCenter(from, to) };
  });
}

/** Centro de la parte visible de una franja; si queda fuera, el borde más cercano (con margen). */
export function visibleCenter(from, to, margin = 1.2) {
  const lo = Math.max(from, 0);
  const hi = Math.min(to, 100);
  if (lo >= hi) return clamp(from < 0 ? margin : 100 - margin, margin, 100 - margin);
  return clamp((lo + hi) / 2, margin, 100 - margin);
}

/** Valor del dial (0–100) → ángulo en radianes: 0 = izquierda (π), 50 = arriba (π/2), 100 = derecha (0). */
export function valueToAngle(v) {
  return Math.PI * (1 - v / 100);
}

/**
 * Posición del puntero respecto al centro del semicírculo → valor 0–100.
 * dx a la derecha, dy hacia ABAJO (coordenadas de pantalla).
 * Por debajo de la horizontal se ajusta al extremo más cercano.
 */
export function pointerToValue(dx, dy) {
  if (dy > 0) return dx < 0 ? 0 : 100;
  const angle = Math.atan2(-dy, dx); // 0..π por encima de la horizontal
  return clamp((1 - angle / Math.PI) * 100);
}

/** Redondeo para mostrar sin ruido de coma flotante. */
export const round1 = (v) => Math.round(v * 10) / 10;
