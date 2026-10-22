/**
 * Analítica opcional, anónima y con consentimiento (desactivada por defecto).
 * Sin identificadores, sin cookies, sin nombres ni categorías escritas por el usuario.
 * Solo envía si: el ajuste está activo Y hay un endpoint configurado (ANALYTICS_ENDPOINT).
 */
export const ANALYTICS_ENDPOINT = ''; // p. ej. 'https://stats.example.com/e' — vacío = nunca se envía nada

const ALLOWED = new Set(['game_start', 'round_end', 'game_end', 'tutorial_done', 'pack_selected']);

export function createAnalytics(getSettings, endpoint = ANALYTICS_ENDPOINT, send = defaultSend) {
  return {
    track(name, data = {}) {
      if (!getSettings().analytics || !endpoint || !ALLOWED.has(name)) return false;
      // Solo valores numéricos o enumerados: nunca texto libre.
      const safe = {};
      for (const [k, v] of Object.entries(data)) if (typeof v === 'number' || typeof v === 'boolean') safe[k] = v;
      try { send(endpoint, JSON.stringify({ e: name, d: safe, v: 1 })); return true; } catch { return false; }
    },
  };
}

function defaultSend(url, body) {
  if (navigator.sendBeacon) navigator.sendBeacon(url, body);
}
