/**
 * Máquina de estados de la partida. Sin DOM ni audio: solo reglas.
 * Fases: setup → wait → psychic → guess → reveal → (wait de la siguiente ronda) | over
 *
 * Cada transición comprueba la fase de origen, así que un doble toque o una
 * pulsación repetida del botón principal no puede saltarse pasos.
 */
import { scoreGuess, getW, clamp } from './scoring.js';
import { sanitizePlayers, LIMITS } from './sanitize.js';

export const PHASES = Object.freeze(['setup', 'wait', 'psychic', 'guess', 'reveal']);

/** Índice del psíquico: aleatorio la primera vez, después alternancia estricta. */
export function nextPsychic(lastPsychic, n, rng = Math.random) {
  if (lastPsychic == null) return Math.min(n - 1, Math.floor(rng() * n));
  return (lastPsychic + 1) % n;
}

/**
 * ¿Ha terminado la partida? Requiere objetivo > 0, que alguien lo alcance
 * y que el líder sea único. Con equidad, además, todos han jugado las mismas rondas.
 */
export function checkWinner(scores, target, rounds = 0, fair = false) {
  if (!(target > 0)) return null;
  const n = scores.length;
  if (fair && rounds % n !== 0) return null;
  const max = Math.max(...scores);
  if (max < target) return null;
  const leaders = scores.reduce((acc, s, i) => (s === max ? [...acc, i] : acc), []);
  return leaders.length === 1 ? leaders[0] : null;
}

/** Estadísticas del resumen final a partir del historial. */
export function summarize(history, playerCount) {
  const perPlayer = Array.from({ length: playerCount }, () => ({ points: 0, rounds: 0, dist: 0, bullseyes: 0 }));
  let best = null;
  let totalDist = 0;
  for (const r of history) {
    const p = perPlayer[r.guesser];
    p.points += r.points; p.rounds += 1; p.dist += r.distance;
    if (r.points === 4) p.bullseyes += 1;
    totalDist += r.distance;
    if (!best || r.points > best.points || (r.points === best.points && r.distance < best.distance)) best = r;
  }
  return {
    best,
    avgDistance: history.length ? totalDist / history.length : 0,
    perPlayer: perPlayer.map((p) => ({ ...p, avgDistance: p.rounds ? p.dist / p.rounds : 0 })),
  };
}

export function createGame({ rng = Math.random } = {}) {
  /** @type {any} */
  let s = blank();

  function blank() {
    return {
      phase: 'setup', players: [], scores: [], psychic: null, lastPsychic: null, guesser: null,
      guess: 50, target: 50, w: getW('normal'), category: null, history: [], round: 0,
      finished: false, winner: null, result: null,
    };
  }

  const api = {
    get state() { return s; },

    /** Nueva partida: reinicia marcador y elige psíquico al azar en la primera ronda. */
    newMatch(names, defaultName) {
      const players = sanitizePlayers(
        names.slice(0, LIMITS.maxPlayers), defaultName);
      s = { ...blank(), players, scores: players.map(() => 0) };
      return s;
    },

    /** Reinicia marcadores manteniendo jugadores (botón "Nueva partida" tras el final). */
    rematch() {
      s = { ...blank(), players: s.players, scores: s.players.map(() => 0) };
      return s;
    },

    /** Prepara una ronda. La dificultad se lee AQUÍ: no afecta a la ronda en curso. */
    beginRound({ category, difficulty }) {
      if (s.phase !== 'setup' && s.phase !== 'reveal') return false;
      if (s.finished) return false;
      const n = s.players.length;
      const psychic = nextPsychic(s.lastPsychic, n, rng);
      s = {
        ...s, phase: 'wait', psychic, lastPsychic: psychic, guesser: (psychic + 1) % n,
        guess: 50, target: rng() * 100, w: getW(difficulty), category, round: s.round + 1, result: null,
      };
      return true;
    },

    /** Cambia la categoría de la ronda ("otra categoría"): solo antes de ver la posición. */
    setCategory(category) { if (s.phase !== 'wait') return false; s = { ...s, category }; return true; },

    showPsychic() { if (s.phase !== 'wait') return false; s = { ...s, phase: 'psychic' }; return true; },
    hidePsychic() { if (s.phase !== 'psychic') return false; s = { ...s, phase: 'guess' }; return true; },

    setGuess(v) {
      if (s.phase !== 'guess' || !Number.isFinite(v)) return false;
      s = { ...s, guess: clamp(v) }; return true;
    },
    nudge(delta) { return api.setGuess(s.guess + delta); },

    /** Fija la respuesta, puntúa al adivino y comprueba el fin de partida. */
    lock({ target, fairTurns = false }) {
      if (s.phase !== 'guess') return null;
      const r = scoreGuess(s.guess, s.target, s.w);
      const scores = s.scores.slice();
      scores[s.guesser] += r.points;
      const entry = {
        round: s.round, psychic: s.psychic, guesser: s.guesser, guess: s.guess, target: s.target,
        w: s.w, points: r.points, verdict: r.verdict, distance: r.distance, category: s.category,
      };
      const winner = checkWinner(scores, target, s.round, fairTurns);
      s = { ...s, phase: 'reveal', scores, history: [...s.history, entry], result: entry,
        winner, finished: winner != null };
      return entry;
    },
  };
  return api;
}
