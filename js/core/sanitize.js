/**
 * Saneamiento de texto de usuario. Elimina < > & " ' ` , colapsa espacios,
 * recorta y trunca. Aun así, la UI nunca usa innerHTML con estos datos.
 */
// extreme = categoría propia escrita por el jugador; packExtreme = textos de los packs incluidos.
export const LIMITS = Object.freeze({ player: 14, extreme: 18, packExtreme: 50, maxPlayers: 8, minPlayers: 2 });

const FORBIDDEN = /[<>&"'`]/g;

export function sanitizeText(value, max) {
  if (typeof value !== 'string') return '';
  const clean = value.replace(FORBIDDEN, '').replace(/\s+/g, ' ').trim();
  // Array.from respeta emojis y pares sustitutos al truncar.
  return Array.from(clean).slice(0, max).join('').trim();
}

/**
 * Normaliza la lista de nombres: vacíos → "Jugador N", y los duplicados
 * (sin distinguir mayúsculas) reciben sufijo " 2", " 3"… sin superar el límite.
 * @param {string[]} names
 * @param {(n:number)=>string} defaultName
 */
export function sanitizePlayers(names, defaultName = (n) => `Jugador ${n}`) {
  const seen = new Map();
  return names.map((raw, i) => {
    let name = sanitizeText(raw, LIMITS.player) || defaultName(i + 1);
    const key = name.toLowerCase();
    if (seen.has(key)) {
      let n = seen.get(key) + 1;
      let candidate;
      do {
        const suffix = ` ${n}`;
        candidate = Array.from(name).slice(0, LIMITS.player - suffix.length).join('').trimEnd() + suffix;
        n++;
      } while (seen.has(candidate.toLowerCase()));
      seen.set(key, n - 1);
      seen.set(candidate.toLowerCase(), 1);
      return candidate;
    }
    seen.set(key, 1);
    return name;
  });
}

/** Valida y sanea un par de extremos; devuelve null si falta alguno. */
export function sanitizeCategory(left, right) {
  const l = sanitizeText(left, LIMITS.extreme);
  const r = sanitizeText(right, LIMITS.extreme);
  return l && r ? { left: l, right: r } : null;
}
