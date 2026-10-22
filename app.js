/* GENERADO por scripts/bundle.js a partir de js/ — no editar a mano. */
(() => {
  // js/core/scoring.js
  var DIFFICULTY_W = Object.freeze({ easy: 2.5, normal: 1.75, hard: 1.25 });
  var DIFFICULTIES = Object.freeze(["easy", "normal", "hard"]);
  var DEFAULT_DIFFICULTY = "normal";
  var EPS = 1e-9;
  var clamp = (v, min = 0, max = 100) => Math.min(max, Math.max(min, v));
  function getW(difficulty) {
    return DIFFICULTY_W[difficulty] ?? DIFFICULTY_W[DEFAULT_DIFFICULTY];
  }
  function scoreGuess(guess, target, w) {
    const d = Math.abs(guess - target);
    if (d <= w + EPS) return { points: 4, verdict: "bullseye", distance: d };
    if (d <= 3 * w + EPS) return { points: 3, verdict: "close", distance: d };
    if (d <= 5 * w + EPS) return { points: 2, verdict: "near", distance: d };
    return { points: 0, verdict: "far", distance: d };
  }
  function zoneBands(target, w) {
    const pattern = [2, 3, 4, 3, 2];
    return pattern.map((points, i) => {
      const from = target + (i - 2.5) * 2 * w;
      const to = from + 2 * w;
      return { points, from, to, labelAt: visibleCenter(from, to) };
    });
  }
  function visibleCenter(from, to, margin = 1.2) {
    const lo = Math.max(from, 0);
    const hi = Math.min(to, 100);
    if (lo >= hi) return clamp(from < 0 ? margin : 100 - margin, margin, 100 - margin);
    return clamp((lo + hi) / 2, margin, 100 - margin);
  }
  function valueToAngle(v) {
    return Math.PI * (1 - v / 100);
  }
  function pointerToValue(dx, dy) {
    if (dy > 0) return dx < 0 ? 0 : 100;
    const angle = Math.atan2(-dy, dx);
    return clamp((1 - angle / Math.PI) * 100);
  }
  var round1 = (v) => Math.round(v * 10) / 10;

  // js/core/sanitize.js
  var LIMITS = Object.freeze({ player: 14, extreme: 18, packExtreme: 50, maxPlayers: 8, minPlayers: 2 });
  var FORBIDDEN = /[<>&"'`]/g;
  function sanitizeText(value, max) {
    if (typeof value !== "string") return "";
    const clean = value.replace(FORBIDDEN, "").replace(/\s+/g, " ").trim();
    return Array.from(clean).slice(0, max).join("").trim();
  }
  function sanitizePlayers(names, defaultName = (n) => `Jugador ${n}`) {
    const seen = /* @__PURE__ */ new Map();
    return names.map((raw, i) => {
      let name = sanitizeText(raw, LIMITS.player) || defaultName(i + 1);
      const key = name.toLowerCase();
      if (seen.has(key)) {
        let n = seen.get(key) + 1;
        let candidate;
        do {
          const suffix = ` ${n}`;
          candidate = Array.from(name).slice(0, LIMITS.player - suffix.length).join("").trimEnd() + suffix;
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
  function sanitizeCategory(left, right) {
    const l = sanitizeText(left, LIMITS.extreme);
    const r = sanitizeText(right, LIMITS.extreme);
    return l && r ? { left: l, right: r } : null;
  }

  // js/core/game.js
  var PHASES = Object.freeze(["setup", "wait", "psychic", "guess", "reveal"]);
  function nextPsychic(lastPsychic, n, rng = Math.random) {
    if (lastPsychic == null) return Math.min(n - 1, Math.floor(rng() * n));
    return (lastPsychic + 1) % n;
  }
  function checkWinner(scores, target, rounds = 0, fair = false) {
    if (!(target > 0)) return null;
    const n = scores.length;
    if (fair && rounds % n !== 0) return null;
    const max = Math.max(...scores);
    if (max < target) return null;
    const leaders = scores.reduce((acc, s2, i) => s2 === max ? [...acc, i] : acc, []);
    return leaders.length === 1 ? leaders[0] : null;
  }
  function summarize(history2, playerCount) {
    const perPlayer = Array.from({ length: playerCount }, () => ({ points: 0, rounds: 0, dist: 0, bullseyes: 0 }));
    let best = null;
    let totalDist = 0;
    for (const r of history2) {
      const p = perPlayer[r.guesser];
      p.points += r.points;
      p.rounds += 1;
      p.dist += r.distance;
      if (r.points === 4) p.bullseyes += 1;
      totalDist += r.distance;
      if (!best || r.points > best.points || r.points === best.points && r.distance < best.distance) best = r;
    }
    return {
      best,
      avgDistance: history2.length ? totalDist / history2.length : 0,
      perPlayer: perPlayer.map((p) => ({ ...p, avgDistance: p.rounds ? p.dist / p.rounds : 0 }))
    };
  }
  function createGame({ rng = Math.random } = {}) {
    let s2 = blank();
    function blank() {
      return {
        phase: "setup",
        players: [],
        scores: [],
        psychic: null,
        lastPsychic: null,
        guesser: null,
        guess: 50,
        target: 50,
        w: getW("normal"),
        category: null,
        history: [],
        round: 0,
        finished: false,
        winner: null,
        result: null
      };
    }
    const api = {
      get state() {
        return s2;
      },
      /** Nueva partida: reinicia marcador y elige psíquico al azar en la primera ronda. */
      newMatch(names, defaultName) {
        const players = sanitizePlayers(
          names.slice(0, LIMITS.maxPlayers),
          defaultName
        );
        s2 = { ...blank(), players, scores: players.map(() => 0) };
        return s2;
      },
      /** Reinicia marcadores manteniendo jugadores (botón "Nueva partida" tras el final). */
      rematch() {
        s2 = { ...blank(), players: s2.players, scores: s2.players.map(() => 0) };
        return s2;
      },
      /** Prepara una ronda. La dificultad se lee AQUÍ: no afecta a la ronda en curso. */
      beginRound({ category, difficulty }) {
        if (s2.phase !== "setup" && s2.phase !== "reveal") return false;
        if (s2.finished) return false;
        const n = s2.players.length;
        const psychic = nextPsychic(s2.lastPsychic, n, rng);
        s2 = {
          ...s2,
          phase: "wait",
          psychic,
          lastPsychic: psychic,
          guesser: (psychic + 1) % n,
          guess: 50,
          target: rng() * 100,
          w: getW(difficulty),
          category,
          round: s2.round + 1,
          result: null
        };
        return true;
      },
      /** Cambia la categoría de la ronda ("otra categoría"): solo antes de ver la posición. */
      setCategory(category) {
        if (s2.phase !== "wait") return false;
        s2 = { ...s2, category };
        return true;
      },
      showPsychic() {
        if (s2.phase !== "wait") return false;
        s2 = { ...s2, phase: "psychic" };
        return true;
      },
      hidePsychic() {
        if (s2.phase !== "psychic") return false;
        s2 = { ...s2, phase: "guess" };
        return true;
      },
      setGuess(v) {
        if (s2.phase !== "guess" || !Number.isFinite(v)) return false;
        s2 = { ...s2, guess: clamp(v) };
        return true;
      },
      nudge(delta) {
        return api.setGuess(s2.guess + delta);
      },
      /** Fija la respuesta, puntúa al adivino y comprueba el fin de partida. */
      lock({ target, fairTurns = false }) {
        if (s2.phase !== "guess") return null;
        const r = scoreGuess(s2.guess, s2.target, s2.w);
        const scores = s2.scores.slice();
        scores[s2.guesser] += r.points;
        const entry = {
          round: s2.round,
          psychic: s2.psychic,
          guesser: s2.guesser,
          guess: s2.guess,
          target: s2.target,
          w: s2.w,
          points: r.points,
          verdict: r.verdict,
          distance: r.distance,
          category: s2.category
        };
        const winner = checkWinner(scores, target, s2.round, fairTurns);
        s2 = {
          ...s2,
          phase: "reveal",
          scores,
          history: [...s2.history, entry],
          result: entry,
          winner,
          finished: winner != null
        };
        return entry;
      }
    };
    return api;
  }

  // js/core/palettes.js
  var PALETTES = Object.freeze([
    { id: "indigo", hue: 226, sat: 1 },
    { id: "blue", hue: 211, sat: 1 },
    { id: "teal", hue: 188, sat: 1 },
    { id: "green", hue: 152, sat: 0.9 },
    { id: "orange", hue: 24, sat: 1 },
    { id: "coral", hue: 352, sat: 1 },
    { id: "fuchsia", hue: 322, sat: 1 },
    { id: "violet", hue: 265, sat: 1 },
    { id: "graphite", hue: 220, sat: 0.2 }
  ]);
  var PALETTE_IDS = Object.freeze(PALETTES.map((p) => p.id));
  var DEFAULT_PALETTE = "indigo";
  function hslToHex(h2, s2, l) {
    s2 /= 100;
    l /= 100;
    const k = (n) => (n + h2 / 30) % 12;
    const a = s2 * Math.min(l, 1 - l);
    const f2 = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return `#${[f2(0), f2(8), f2(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
  }
  function themeColor(paletteId, mode) {
    const p = PALETTES.find((x) => x.id === paletteId) ?? PALETTES[0];
    return mode === "dark" ? hslToHex(p.hue, 45 * p.sat, 10) : hslToHex(p.hue, 38 * p.sat, 94);
  }

  // js/core/settings.js
  var STORAGE_KEY = "lazona.settings.v1";
  var THEMES = ["light", "dark", "auto"];
  var TARGETS = [10, 15, 0];
  var LANGS = ["es", "en"];
  var DEFAULT_SETTINGS = Object.freeze({
    theme: "auto",
    palette: DEFAULT_PALETTE,
    reduceMotion: false,
    difficulty: "normal",
    target: 10,
    hints: true,
    sound: true,
    vibration: true,
    lang: "es",
    fairTurns: false,
    adultPack: false,
    onboarded: false,
    analytics: false,
    // opt‑in, anónimo
    analyticsAsked: false
  });
  var bool = (v, d) => typeof v === "boolean" ? v : d;
  var oneOf = (v, list, d) => list.includes(v) ? v : d;
  function validateSettings(raw) {
    const o = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const d = DEFAULT_SETTINGS;
    return {
      theme: oneOf(o.theme, THEMES, d.theme),
      palette: oneOf(o.palette, PALETTE_IDS, d.palette),
      reduceMotion: bool(o.reduceMotion, d.reduceMotion),
      difficulty: oneOf(o.difficulty, DIFFICULTIES, d.difficulty),
      target: oneOf(o.target, TARGETS, d.target),
      hints: bool(o.hints, d.hints),
      sound: bool(o.sound, d.sound),
      vibration: bool(o.vibration, d.vibration),
      lang: oneOf(o.lang, LANGS, d.lang),
      fairTurns: bool(o.fairTurns, d.fairTurns),
      adultPack: bool(o.adultPack, d.adultPack),
      onboarded: bool(o.onboarded, d.onboarded),
      analytics: bool(o.analytics, d.analytics),
      analyticsAsked: bool(o.analyticsAsked, d.analyticsAsked)
    };
  }
  function createStorage(getBackend = () => globalThis.localStorage) {
    const mem = /* @__PURE__ */ new Map();
    let backend = null;
    try {
      backend = getBackend() ?? null;
      if (backend) {
        backend.setItem("__t", "1");
        backend.removeItem("__t");
      }
    } catch {
      backend = null;
    }
    return {
      persistent: !!backend,
      get(key) {
        try {
          return backend ? backend.getItem(key) : mem.get(key) ?? null;
        } catch {
          return mem.get(key) ?? null;
        }
      },
      set(key, value) {
        mem.set(key, value);
        try {
          backend?.setItem(key, value);
        } catch {
        }
      },
      remove(key) {
        mem.delete(key);
        try {
          backend?.removeItem(key);
        } catch {
        }
      }
    };
  }
  function loadSettings(storage2) {
    try {
      const text = storage2.get(STORAGE_KEY);
      return validateSettings(text ? JSON.parse(text) : null);
    } catch {
      return validateSettings(null);
    }
  }
  function saveSettings(storage2, settings2) {
    storage2.set(STORAGE_KEY, JSON.stringify(validateSettings(settings2)));
  }

  // js/data/categories.js
  var NBA = [
    ["Jugador sobrevalorado", "Jugador infravalorado", "Overrated player", "Underrated player"],
    ["Peor jugador de la liga", "Mejor jugador de la liga", "Worst player in the league", "Best player in the league"],
    ["Rookie decepcionante", "Rookie generacional", "Disappointing rookie", "Generational rookie"],
    ["Suplente normalito", "Sexto hombre legendario", "Average bench player", "Legendary sixth man"],
    ["Equipo en reconstrucci\xF3n", "Aspirante al anillo", "Rebuilding team", "Title contender"],
    ["Temporada decepcionante", "Temporada hist\xF3rica", "Disappointing season", "Historic season"],
    ["Traspaso desastroso", "Traspaso que cambia la NBA", "Disastrous trade", "League-changing trade"],
    ["Entrenador mediocre", "Entrenador legendario", "Mediocre coach", "Legendary coach"],
    ["Canasta f\xE1cil", "Canasta imposible", "Easy bucket", "Impossible bucket"],
    ["Jugador ego\xEDsta", "Compa\xF1ero perfecto", "Selfish player", "Perfect teammate"],
    ["Defensa inexistente", "Defensa impenetrable", "Nonexistent defense", "Impenetrable defense"],
    ["Triple mal tirado", "Triple espectacular", "Badly taken three", "Spectacular three"],
    ["Jugador fr\xE1gil", "Jugador indestructible", "Fragile player", "Indestructible player"],
    ["Contrato regalado", "Contrato t\xF3xico", "Giveaway contract", "Toxic contract"],
    ["Derrota digna", "Paliza hist\xF3rica", "Honorable loss", "Historic blowout"],
    ["Rivalidad olvidable", "Rivalidad legendaria", "Forgettable rivalry", "Legendary rivalry"],
    ["All-Star discutible", "All-Star indiscutible", "Debatable All-Star", "Undeniable All-Star"],
    ["Jugador de temporada regular", "Jugador de playoffs", "Regular-season player", "Playoff player"],
    ["Carrera decepcionante", "Carrera de Hall of Fame", "Disappointing career", "Hall of Fame career"],
    ["Anillo poco merecido", "Anillo legendario", "Undeserved ring", "Legendary ring"],
    ["Jugador que desaparece en playoffs", "Jugador decisivo en playoffs", "Vanishes in the playoffs", "Clutch in the playoffs"],
    ["Equipo que nadie teme", "Equipo que todos temen", "Team nobody fears", "Team everyone fears"],
    ["Jugador que vive del f\xEDsico", "Jugador que vive de la t\xE9cnica", "Lives off athleticism", "Lives off technique"],
    ["Mala elecci\xF3n del draft", "Robo hist\xF3rico del draft", "Bad draft pick", "Historic draft steal"],
    ["Partido irrelevante", "Partido que define una era", "Irrelevant game", "Era-defining game"],
    ["Celebraci\xF3n discreta", "Celebraci\xF3n ic\xF3nica", "Quiet celebration", "Iconic celebration"],
    ["Jugador que necesita un sistema", "Jugador que es el sistema", "Needs a system", "Is the system"],
    ["Estrella local", "\xCDdolo mundial", "Local star", "Global icon"],
    ["Jugador f\xE1cil de defender", "Jugador imposible de defender", "Easy to defend", "Impossible to defend"],
    ["Dinast\xEDa sobrevalorada", "Dinast\xEDa irrepetible", "Overrated dynasty", "Unrepeatable dynasty"]
  ];
  var FOOTBALL = [
    ["Jugador sobrevalorado", "Jugador infravalorado", "Overrated player", "Underrated player"],
    ["Delantero fall\xF3n", "Delantero letal", "Wasteful striker", "Lethal striker"],
    ["Portero inseguro", "Portero decisivo", "Shaky goalkeeper", "Decisive goalkeeper"],
    ["Defensa despistado", "Defensa imperial", "Absent-minded defender", "Imperial defender"],
    ["Entrenador desastroso", "Entrenador legendario", "Disastrous manager", "Legendary manager"],
    ["Fichaje in\xFAtil", "Fichaje hist\xF3rico", "Useless signing", "Historic signing"],
    ["Gol de rebote", "Golazo", "Scrappy goal", "Screamer"],
    ["Partido aburrido", "Partido \xE9pico", "Boring match", "Epic match"],
    ["Derrota digna", "Humillaci\xF3n hist\xF3rica", "Honorable defeat", "Historic humiliation"],
    ["Equipo peque\xF1o", "Gigante europeo", "Small club", "European giant"],
    ["Afici\xF3n tranquila", "Afici\xF3n ensordecedora", "Quiet fans", "Deafening fans"],
    ["Cantera desaprovechada", "Cantera legendaria", "Wasted academy", "Legendary academy"],
    ["Penalti dudoso", "Penalti clar\xEDsimo", "Dubious penalty", "Clear-cut penalty"],
    ["\xC1rbitro permisivo", "\xC1rbitro protagonista", "Lenient referee", "Main-character referee"],
    ["Celebraci\xF3n rid\xEDcula", "Celebraci\xF3n ic\xF3nica", "Ridiculous celebration", "Iconic celebration"],
    ["Jugador de highlights", "Jugador decisivo", "Highlights player", "Decisive player"],
    ["Promesa incumplida", "Futuro Bal\xF3n de Oro", "Failed prospect", "Future Golden Ball"],
    ["Victoria por suerte", "Victoria merecida", "Lucky win", "Deserved win"],
    ["Rivalidad amistosa", "Enemigos eternos", "Friendly rivalry", "Eternal enemies"],
    ["Equipo defensivo", "Equipo ofensivo", "Defensive team", "Attacking team"],
    ["Gol intrascendente", "Gol que vale una temporada", "Meaningless goal", "Season-defining goal"],
    ["F\xFAtbol de posesi\xF3n", "F\xFAtbol de contraataque", "Possession football", "Counter-attack football"],
    ["Jugador que se borra", "Jugador que aparece en las finales", "Player who disappears", "Player who shows up in finals"],
    ["Bal\xF3n de Oro discutible", "Bal\xF3n de Oro indiscutible", "Debatable Golden Ball", "Undeniable Golden Ball"],
    ["Leyenda de un club", "Leyenda del f\xFAtbol mundial", "Club legend", "World football legend"],
    ["Entrar desde el banquillo", "Ser titular indiscutible", "Coming off the bench", "Undisputed starter"],
    ["Partido de liga normal", "Final de Champions", "Regular league match", "Champions League final"],
    ["Traspaso barato", "Fichaje gal\xE1ctico", "Cheap transfer", "Galactic signing"],
    ["Equipo que juega sin presi\xF3n", "Equipo obligado a ganar", "Team playing without pressure", "Team that must win"],
    ["Penalti en el minuto 90", "Penalti en una tanda decisiva", "Penalty in the 90th minute", "Penalty in a decisive shootout"]
  ];
  var SPORTS = [
    ["Deporte aburrido", "Deporte espectacular", "Boring sport", "Spectacular sport"],
    ["Deportista sobrevalorado", "Deportista infravalorado", "Overrated athlete", "Underrated athlete"],
    ["Victoria f\xE1cil", "Victoria milagrosa", "Easy win", "Miracle win"],
    ["Competici\xF3n secundaria", "Competici\xF3n legendaria", "Minor competition", "Legendary competition"],
    ["Favorito decepcionante", "Sorpresa hist\xF3rica", "Disappointing favorite", "Historic upset"],
    ["Entrenamiento suave", "Entrenamiento brutal", "Light training", "Brutal training"],
    ["Error insignificante", "Error que cuesta el campeonato", "Insignificant mistake", "Mistake that costs the title"],
    ["\xC1rbitro justo", "\xC1rbitro pol\xE9mico", "Fair referee", "Controversial referee"],
    ["Talento natural", "Esfuerzo constante", "Natural talent", "Constant effort"],
    ["Lesi\xF3n leve", "Lesi\xF3n que cambia una carrera", "Minor injury", "Career-changing injury"],
    ["R\xE9cord f\xE1cil de batir", "R\xE9cord pr\xE1cticamente imposible", "Easy record to break", "Nearly unbreakable record"],
    ["Deporte individual", "Deporte de equipo", "Individual sport", "Team sport"],
    ["Deporte t\xE9cnico", "Deporte f\xEDsico", "Technical sport", "Physical sport"],
    ["Competici\xF3n limpia", "Competici\xF3n llena de pol\xE9micas", "Clean competition", "Competition full of scandals"],
    ["Medalla de bronce", "Medalla de oro", "Bronze medal", "Gold medal"],
    ["Derrota ajustada", "Derrota humillante", "Narrow defeat", "Humiliating defeat"],
    ["Rivalidad normal", "Rivalidad hist\xF3rica", "Normal rivalry", "Historic rivalry"],
    ["Aficionado casual", "Fan\xE1tico absoluto", "Casual fan", "Absolute fanatic"],
    ["Atleta desconocido", "Leyenda mundial", "Unknown athlete", "World legend"],
    ["Carrera prometedora", "Carrera legendaria", "Promising career", "Legendary career"],
    ["Victoria por estrategia", "Victoria por fuerza bruta", "Win by strategy", "Win by brute force"],
    ["Competici\xF3n de resistencia", "Competici\xF3n explosiva", "Endurance event", "Explosive event"],
    ["Deporte de precisi\xF3n", "Deporte de contacto", "Precision sport", "Contact sport"],
    ["R\xE9cord nacional", "R\xE9cord mundial", "National record", "World record"],
    ["Deportista bajo presi\xF3n", "Deportista que se crece bajo presi\xF3n", "Athlete under pressure", "Athlete who thrives under pressure"],
    ["Equipo bien coordinado", "Equipo lleno de estrellas", "Well-coordinated team", "Team full of stars"],
    ["Una final cualquiera", "La final de tu vida", "Just any final", "The final of your life"],
    ["Deporte barato de practicar", "Deporte car\xEDsimo de practicar", "Cheap sport to play", "Very expensive sport to play"],
    ["Un segundo de ventaja", "Una victoria aplastante", "One second ahead", "Crushing victory"],
    ["Retirarse en la cima", "Volver despu\xE9s de una ca\xEDda", "Retire at the top", "Comeback after a fall"]
  ];
  var FOOD = [
    ["Pizza mala", "Pizza perfecta", "Bad pizza", "Perfect pizza"],
    ["Comida ins\xEDpida", "Comida espectacular", "Bland food", "Spectacular food"],
    ["Desayuno triste", "Desayuno de lujo", "Sad breakfast", "Luxury breakfast"],
    ["Comida barata", "Comida car\xEDsima", "Cheap food", "Very expensive food"],
    ["Hamburguesa mediocre", "Hamburguesa legendaria", "Mediocre burger", "Legendary burger"],
    ["Dulce", "Salado", "Sweet", "Savory"],
    ["Comida saludable", "Comida basura", "Healthy food", "Junk food"],
    ["Tortilla sin cebolla", "Tortilla con cebolla", "Omelette without onion", "Omelette with onion"],
    ["Caf\xE9 horrible", "Caf\xE9 perfecto", "Horrible coffee", "Perfect coffee"],
    ["Tapear solo", "Banquete con amigos", "Tapas alone", "Feast with friends"],
    ["Comida de hospital", "Comida de estrella Michelin", "Hospital food", "Michelin-star food"],
    ["Plato que nadie pedir\xEDa", "Plato que pedir\xEDa todo el mundo", "Dish nobody would order", "Dish everyone would order"],
    ["Chocolate blanco", "Chocolate negro", "White chocolate", "Dark chocolate"],
    ["Kebab de madrugada", "Cena de lujo", "Late-night kebab", "Fancy dinner"],
    ["Comida horrible", "Comida espectacular", "Horrible food", "Spectacular food"],
    ["Plato barato", "Plato car\xEDsimo", "Cheap dish", "Very expensive dish"],
    ["Comida ins\xEDpida", "Comida llena de sabor", "Bland food", "Food full of flavor"],
    ["Comida r\xE1pida", "Alta cocina", "Fast food", "Haute cuisine"],
    ["Combinaci\xF3n asquerosa", "Combinaci\xF3n sorprendentemente buena", "Disgusting combo", "Surprisingly good combo"],
    ["Postre decepcionante", "Postre inolvidable", "Disappointing dessert", "Unforgettable dessert"],
    ["Comida de supervivencia", "Banquete de reyes", "Survival food", "Royal banquet"],
    ["Aperitivo insignificante", "Aperitivo imprescindible", "Insignificant appetizer", "Essential appetizer"],
    ["Comida sobrevalorada", "Comida infravalorada", "Overrated food", "Underrated food"],
    ["Caf\xE9 solo", "Caf\xE9 con leche", "Black coffee", "Coffee with milk"],
    ["Comida que da verg\xFCenza pedir", "Comida que pedir\xEDas delante de cualquiera", "Food you are embarrassed to order", "Food you would order in front of anyone"],
    ["Plato que preparar\xEDas en cinco minutos", "Plato que requiere todo el d\xEDa", "Dish ready in five minutes", "Dish that takes all day"],
    ["Comida de gasolinera", "Comida de restaurante de lujo", "Gas station food", "Luxury restaurant food"],
    ["Helado mediocre", "Helado perfecto", "Mediocre ice cream", "Perfect ice cream"],
    ["Salsa innecesaria", "Salsa que mejora cualquier plato", "Unnecessary sauce", "Sauce that improves any dish"],
    ["Comida que llena", "Comida que deja con hambre", "Food that fills you up", "Food that leaves you hungry"],
    ["Cena improvisada", "Cena preparada por un chef", "Improvised dinner", "Dinner cooked by a chef"],
    ["Aperitivo normal", "Aperitivo adictivo", "Ordinary appetizer", "Addictive appetizer"],
    ["Comida que probar\xEDas por curiosidad", "Comida que no probar\xEDas jam\xE1s", "Food you would try out of curiosity", "Food you would never try"]
  ];
  var SCREEN = [
    ["Pel\xEDcula aburrida", "Obra maestra", "Boring movie", "Masterpiece"],
    ["Villano in\xFAtil", "Villano legendario", "Useless villain", "Legendary villain"],
    ["Final decepcionante", "Final perfecto", "Disappointing ending", "Perfect ending"],
    ["Serie olvidable", "Serie inolvidable", "Forgettable series", "Unforgettable series"],
    ["Remake innecesario", "Remake que supera al original", "Unnecessary remake", "Remake that beats the original"],
    ["Actor mediocre", "Actor espectacular", "Mediocre actor", "Spectacular actor"],
    ["Pel\xEDcula para dormir", "Pel\xEDcula que te deja pensando", "Movie to fall asleep to", "Movie that stays with you"],
    ["Personaje insoportable", "Personaje favorito", "Unbearable character", "Favorite character"],
    ["Efectos especiales cutres", "Efectos especiales incre\xEDbles", "Cheap special effects", "Incredible special effects"],
    ["Spoiler insignificante", "Spoiler que arruina todo", "Harmless spoiler", "Spoiler that ruins everything"],
    ["Reality absurdo", "Reality adictivo", "Absurd reality show", "Addictive reality show"],
    ["Pel\xEDcula de domingo por la tarde", "Pel\xEDcula que cambia tu vida", "Sunday afternoon movie", "Life-changing movie"],
    ["Secuela innecesaria", "Secuela imprescindible", "Unnecessary sequel", "Essential sequel"],
    ["Comedia que no hace gracia", "Comedia desternillante", "Comedy that is not funny", "Hilarious comedy"],
    ["Cine de culto", "\xC9xito comercial masivo", "Cult cinema", "Massive commercial hit"],
    ["Pel\xEDcula infravalorada", "Pel\xEDcula sobrevalorada", "Underrated movie", "Overrated movie"],
    ["Protagonista olvidable", "Protagonista ic\xF3nico", "Forgettable lead", "Iconic lead"],
    ["Temporada de relleno", "Temporada perfecta", "Filler season", "Perfect season"],
    ["Adaptaci\xF3n desastrosa", "Adaptaci\xF3n magistral", "Disastrous adaptation", "Masterful adaptation"],
    ["Final abierto frustrante", "Final abierto brillante", "Frustrating open ending", "Brilliant open ending"],
    ["Pel\xEDcula de bajo presupuesto", "Superproducci\xF3n de Hollywood", "Low-budget film", "Hollywood blockbuster"],
    ["Personaje secundario", "Protagonista absoluto", "Supporting character", "Absolute lead"],
    ["Serie que abandonas al segundo cap\xEDtulo", "Serie que ves del tir\xF3n", "Series you drop after episode two", "Series you binge"],
    ["Escena innecesaria", "Escena inolvidable", "Unnecessary scene", "Unforgettable scene"],
    ["Tr\xE1iler enga\xF1oso", "Tr\xE1iler que te vende la pel\xEDcula", "Misleading trailer", "Trailer that sells the movie"],
    ["Giro previsible", "Giro imposible de adivinar", "Predictable twist", "Impossible-to-guess twist"],
    ["Actor encasillado", "Actor que puede interpretar cualquier papel", "Typecast actor", "Actor who can play anything"],
    ["Pel\xEDcula que envejeci\xF3 mal", "Pel\xEDcula atemporal", "Movie that aged badly", "Timeless movie"],
    ["Doblaje horrible", "Doblaje perfecto", "Horrible dubbing", "Perfect dubbing"],
    ["Episodio de transici\xF3n", "Episodio que cambia toda la serie", "Filler episode", "Episode that changes the whole series"],
    ["Personaje que nadie recuerda", "Personaje que todos imitan", "Character nobody remembers", "Character everyone imitates"],
    ["Pel\xEDcula que da sue\xF1o", "Pel\xEDcula que te mantiene en tensi\xF3n", "Movie that bores you to sleep", "Movie that keeps you on edge"],
    ["Final feliz", "Final devastador", "Happy ending", "Devastating ending"]
  ];
  var GAMING = [
    ["Juego aburrido", "Juego al que dedicar\xEDas mil horas", "Boring game", "Game you would sink a thousand hours into"],
    ["Rage quit", "Victoria \xE9pica", "Rage quit", "Epic victory"],
    ["NPC in\xFAtil", "NPC inolvidable", "Useless NPC", "Unforgettable NPC"],
    ["Bug insignificante", "Bug que rompe el juego", "Harmless bug", "Game-breaking bug"],
    ["Gr\xE1ficos horribles", "Gr\xE1ficos hiperrealistas", "Horrible graphics", "Hyper-realistic graphics"],
    ["Jugador casual", "Jugador profesional", "Casual player", "Pro player"],
    ["Partida f\xE1cil", "Partida imposible", "Easy match", "Impossible match"],
    ["M\xF3vil anticuado", "M\xF3vil futurista", "Outdated phone", "Futuristic phone"],
    ["Internet lent\xEDsimo", "Internet instant\xE1neo", "Painfully slow internet", "Instant internet"],
    ["V\xEDdeo con 10 visitas", "V\xEDdeo viral mundial", "Video with 10 views", "Worldwide viral video"],
    ["Meme malo", "Meme hist\xF3rico", "Bad meme", "Historic meme"],
    ["Aplicaci\xF3n in\xFAtil", "Aplicaci\xF3n imprescindible", "Useless app", "Essential app"],
    ["Hacker de pel\xEDcula", "Hacker de verdad", "Movie hacker", "Real hacker"],
    ["Juego pay-to-win", "Juego basado en habilidad", "Pay-to-win game", "Skill-based game"],
    ["Perder una partida", "Perder toda la cuenta", "Losing a match", "Losing the whole account"],
    ["Spoiler tolerable", "Spoiler imperdonable", "Tolerable spoiler", "Unforgivable spoiler"],
    ["Tutorial innecesario", "Tutorial que te salva", "Unnecessary tutorial", "Tutorial that saves you"],
    ["Juego que se olvida en un d\xEDa", "Juego que recuerdas toda la vida", "Game forgotten in a day", "Game you remember for life"],
    ["Consola decepcionante", "Consola legendaria", "Disappointing console", "Legendary console"],
    ["Partida en solitario", "Partida con amigos", "Solo game", "Game with friends"],
    ["Actualizaci\xF3n in\xFAtil", "Actualizaci\xF3n revolucionaria", "Useless update", "Revolutionary update"],
    ["Juego indie desconocido", "Superproducci\xF3n mundial", "Unknown indie game", "Worldwide blockbuster"],
    ["Mando inc\xF3modo", "Mando perfecto", "Uncomfortable controller", "Perfect controller"],
    ["Ordenador de oficina", "PC gaming de gama alta", "Office computer", "High-end gaming PC"],
    ["Inteligencia artificial mediocre", "Inteligencia artificial incre\xEDble", "Mediocre AI", "Incredible AI"],
    ["Perder una partida igualada", "Perder una final mundial", "Losing a close match", "Losing a world final"]
  ];
  var HUMOR = [
    ["Chiste de padre", "Humor negr\xEDsimo", "Dad joke", "Pitch-black humor"],
    ["Verg\xFCenza ajena leve", "Verg\xFCenza ajena insoportable", "Mild secondhand embarrassment", "Unbearable secondhand embarrassment"],
    ["Situaci\xF3n inc\xF3moda", "Situaci\xF3n para desaparecer", "Awkward situation", "Situation to disappear from"],
    ["Persona normal", "Persona completamente random", "Normal person", "Completely random person"],
    ["Mentira piadosa", "Mentira imperdonable", "White lie", "Unforgivable lie"],
    ["Fracaso discreto", "Fracaso hist\xF3rico", "Quiet failure", "Historic failure"],
    ["Hacer el rid\xEDculo en casa", "Hacer el rid\xEDculo delante de todos", "Embarrassing yourself at home", "Embarrassing yourself in front of everyone"],
    ["Excusa cre\xEDble", "Excusa surrealista", "Believable excuse", "Surreal excuse"],
    ["Mala suerte", "Maldici\xF3n divina", "Bad luck", "Divine curse"],
    ["Discusi\xF3n absurda", "Guerra mundial", "Silly argument", "World war"],
    ["Persona pesada", "Persona que cae genial", "Annoying person", "Person everyone loves"],
    ["Comentario innecesario", "Comentario que arruina la noche", "Unnecessary comment", "Comment that ruins the night"],
    ["Broma inofensiva", "Broma que termina en pelea", "Harmless joke", "Joke that ends in a fight"],
    ["Momento inc\xF3modo de cinco segundos", "Momento inc\xF3modo eterno", "Awkward five-second moment", "Endless awkward moment"],
    ["Idea est\xFApida", "Idea tan est\xFApida que funciona", "Stupid idea", "Idea so stupid it works"],
    ["Fracaso normal", "Fracaso legendario", "Normal failure", "Legendary failure"],
    ["Silencio inc\xF3modo", "Confesi\xF3n inesperada", "Awkward silence", "Unexpected confession"],
    ["Ca\xEDda sin consecuencias", "Ca\xEDda viral", "Harmless fall", "Viral fall"],
    ["Momento gracioso", "Momento que te hace llorar de risa", "Funny moment", "Moment that makes you cry laughing"],
    ["Persona ligeramente pesada", "Persona insoportable", "Slightly annoying person", "Unbearable person"],
    ["Hacer el rid\xEDculo entre amigos", "Hacer el rid\xEDculo ante millones", "Embarrassing yourself among friends", "Embarrassing yourself in front of millions"],
    ["Plan que sale mal", "Cat\xE1strofe absoluta", "Plan that goes wrong", "Absolute catastrophe"],
    ["Chiste malo", "Chiste que se recuerda durante a\xF1os", "Bad joke", "Joke remembered for years"],
    ["Excusa desesperada", "Excusa que convence a todo el mundo", "Desperate excuse", "Excuse that convinces everyone"],
    ["Comentario fuera de lugar", "Comentario que salva la conversaci\xF3n", "Out-of-place comment", "Comment that saves the conversation"],
    ["Situaci\xF3n absurda", "Situaci\xF3n que parece inventada", "Absurd situation", "Situation that seems made up"]
  ];
  var MUSIC = [
    ["Canci\xF3n insoportable", "Canci\xF3n perfecta", "Unbearable song", "Perfect song"],
    ["M\xFAsica para relajarse", "M\xFAsica para volverse loco", "Music to relax", "Music to go crazy"],
    ["Artista sobrevalorado", "Artista infravalorado", "Overrated artist", "Underrated artist"],
    ["Concierto aburrido", "Concierto legendario", "Boring concert", "Legendary concert"],
    ["Canci\xF3n de verano", "Canci\xF3n para llorar", "Summer song", "Song to cry to"],
    ["Voz desagradable", "Voz espectacular", "Unpleasant voice", "Spectacular voice"],
    ["Letra sin sentido", "Letra profunda", "Meaningless lyrics", "Deep lyrics"],
    ["\xC9xito de un d\xEDa", "Cl\xE1sico eterno", "One-day hit", "Eternal classic"],
    ["Reguet\xF3n comercial", "M\xFAsica experimental", "Commercial reggaeton", "Experimental music"],
    ["Canci\xF3n que da verg\xFCenza admitir que te gusta", "Canci\xF3n que presumes de escuchar", "Song you are embarrassed to like", "Song you brag about listening to"],
    ["\xC1lbum olvidable", "\xC1lbum hist\xF3rico", "Forgettable album", "Historic album"],
    ["DJ mediocre", "DJ que incendia la fiesta", "Mediocre DJ", "DJ who sets the party on fire"],
    ["Intro innecesaria", "Intro legendaria", "Unnecessary intro", "Legendary intro"],
    ["M\xFAsica de ascensor", "M\xFAsica \xE9pica", "Elevator music", "Epic music"],
    ["Canci\xF3n para conducir", "Canci\xF3n para una despedida", "Song for driving", "Song for a farewell"],
    ["Canci\xF3n que cansa r\xE1pido", "Canci\xF3n que nunca cansa", "Song that gets old fast", "Song that never gets old"],
    ["Artista de nicho", "Estrella mundial", "Niche artist", "Global star"],
    ["Canci\xF3n desconocida", "Himno generacional", "Unknown song", "Generational anthem"],
    ["Concierto \xEDntimo", "Festival multitudinario", "Intimate concert", "Massive festival"],
    ["Videoclip barato", "Videoclip cinematogr\xE1fico", "Cheap music video", "Cinematic music video"],
    ["Canci\xF3n que nadie conoce", "Canci\xF3n que todo el mundo canta", "Song nobody knows", "Song everyone sings"],
    ["\xC1lbum con relleno", "\xC1lbum sin una sola canci\xF3n mala", "Album with filler", "Album without one bad song"],
    ["Colaboraci\xF3n innecesaria", "Colaboraci\xF3n hist\xF3rica", "Unnecessary collaboration", "Historic collaboration"],
    ["Voz buena en estudio", "Voz espectacular en directo", "Good voice in the studio", "Spectacular voice live"],
    ["Canci\xF3n pegadiza", "Canci\xF3n art\xEDsticamente brillante", "Catchy song", "Artistically brilliant song"],
    ["M\xFAsica para entrenar", "M\xFAsica para dormir", "Workout music", "Music to sleep to"]
  ];
  var CELEBS = [
    ["Celebridad desconocida", "Celebridad mundial", "Unknown celebrity", "World-famous celebrity"],
    ["Influencer sin talento", "Influencer imprescindible", "Talentless influencer", "Essential influencer"],
    ["Pol\xE9mica irrelevante", "Esc\xE1ndalo hist\xF3rico", "Irrelevant controversy", "Historic scandal"],
    ["Famoso que cae mal", "Famoso que cae bien a todo el mundo", "Disliked celebrity", "Celebrity everyone likes"],
    ["Personaje secundario", "Protagonista absoluto", "Supporting character", "Absolute lead"],
    ["Superh\xE9roe in\xFAtil", "Superh\xE9roe invencible", "Useless superhero", "Invincible superhero"],
    ["Villano rid\xEDculo", "Villano aterrador", "Ridiculous villain", "Terrifying villain"],
    ["Famoso que envejeci\xF3 mal", "Famoso que parece no envejecer", "Celebrity who aged badly", "Celebrity who never seems to age"],
    ["Reality de bajo presupuesto", "Reality de producci\xF3n millonaria", "Low-budget reality show", "Million-dollar reality show"],
    ["Meme pasajero", "Meme inmortal", "Passing meme", "Immortal meme"],
    ["Famoso sobrevalorado", "Famoso infravalorado", "Overrated celebrity", "Underrated celebrity"],
    ["Personaje que morir\xEDa primero", "Personaje que sobrevivir\xEDa a todo", "Character who would die first", "Character who would survive anything"],
    ["Celebridad que ser\xEDa buen presidente", "Celebridad que ser\xEDa un desastre como presidente", "Celebrity who would be a good president", "Celebrity who would be a disaster as president"],
    ["Persona famosa por talento", "Persona famosa por pol\xE9micas", "Famous for talent", "Famous for scandals"],
    ["Tendencia de una semana", "Fen\xF3meno cultural", "One-week trend", "Cultural phenomenon"],
    ["Frase olvidable", "Frase que todo el mundo conoce", "Forgettable quote", "Quote everyone knows"],
    ["Personaje querido", "Personaje odiado", "Beloved character", "Hated character"],
    ["Famoso de un solo \xE9xito", "Estrella que domina durante d\xE9cadas", "One-hit wonder", "Star who dominates for decades"],
    ["Celebridad que nadie reconoce por la calle", "Celebridad rodeada de fans", "Celebrity nobody recognizes on the street", "Celebrity surrounded by fans"],
    ["Pol\xE9mica olvidada al d\xEDa siguiente", "Pol\xE9mica que marca una carrera", "Controversy forgotten next day", "Controversy that defines a career"],
    ["Famoso con buena imagen p\xFAblica", "Famoso con reputaci\xF3n desastrosa", "Celebrity with a good public image", "Celebrity with a disastrous reputation"],
    ["Personaje que nadie imita", "Personaje que todo el mundo imita", "Character nobody imitates", "Character everyone imitates"],
    ["Fama local", "Fama mundial", "Local fame", "Global fame"],
    ["\xCDdolo de una generaci\xF3n", "\xCDdolo de todas las generaciones", "Idol of one generation", "Idol of every generation"],
    ["Persona famosa por accidente", "Persona famosa por su talento excepcional", "Famous by accident", "Famous for exceptional talent"]
  ];
  var DAILY = [
    ["Madrugar", "Trasnochar", "Waking up early", "Staying up late"],
    ["Plan tranquilo", "Plan inolvidable", "Quiet plan", "Unforgettable plan"],
    ["D\xEDa perdido", "D\xEDa aprovechado al m\xE1ximo", "Wasted day", "Day made the most of"],
    ["Tarea de cinco minutos", "Tarea de todo el d\xEDa", "Five-minute task", "All-day task"],
    ["Casa ordenada", "Casa ca\xF3tica", "Tidy house", "Chaotic house"],
    ["Persona puntual", "Persona que siempre llega tarde", "Punctual person", "Person always late"],
    ["Ahorrar dinero", "Gastar sin control", "Saving money", "Spending recklessly"],
    ["Lunes horrible", "Viernes perfecto", "Terrible Monday", "Perfect Friday"],
    ["Vacaciones en casa", "Viaje de ensue\xF1o", "Vacation at home", "Dream trip"],
    ["Comprar por necesidad", "Comprar por capricho", "Buying out of need", "Buying on impulse"],
    ["Levantarse con energ\xEDa", "Levantarse destruido", "Waking up full of energy", "Waking up wrecked"],
    ["Mensaje f\xE1cil de responder", "Mensaje imposible de responder", "Easy message to answer", "Impossible message to answer"],
    ["Vecino silencioso", "Vecino insoportable", "Quiet neighbor", "Unbearable neighbor"],
    ["Tener mucho tiempo libre", "No tener ni un segundo", "Lots of free time", "Not a single second"],
    ["Plan improvisado", "Plan organizado al mil\xEDmetro", "Improvised plan", "Meticulously organized plan"],
    ["Siesta de diez minutos", "Siesta de tres horas", "Ten-minute nap", "Three-hour nap"],
    ["Hacer cola cinco minutos", "Hacer cola tres horas", "Five-minute queue", "Three-hour queue"],
    ["Domingo relajado", "Domingo de estr\xE9s", "Relaxed Sunday", "Stressful Sunday"],
    ["Habitaci\xF3n peque\xF1a", "Mansi\xF3n", "Tiny room", "Mansion"],
    ["Transporte p\xFAblico vac\xEDo", "Transporte p\xFAblico abarrotado", "Empty public transport", "Packed public transport"],
    ["Compra necesaria", "Capricho absurdo", "Necessary purchase", "Absurd splurge"],
    ["Casa en silencio", "Casa llena de gente", "Silent house", "House full of people"],
    ["Recado sencillo", "D\xEDa entero haciendo recados", "Simple errand", "Whole day of errands"],
    ["Cocinar para uno", "Organizar una comida para veinte", "Cooking for one", "Hosting a meal for twenty"],
    ["Rutina predecible", "Vida llena de sorpresas", "Predictable routine", "Life full of surprises"]
  ];
  var PEOPLE = [
    ["Persona t\xEDmida", "Persona extrovertida", "Shy person", "Outgoing person"],
    ["Amigo de conveniencia", "Amigo de verdad", "Convenience friend", "True friend"],
    ["Persona confiable", "Persona que no guardar\xEDas un secreto", "Trustworthy person", "Person you would not tell a secret"],
    ["Coqueteo sutil", "Coqueteo descarado", "Subtle flirting", "Blatant flirting"],
    ["Primera cita desastrosa", "Primera cita perfecta", "Disastrous first date", "Perfect first date"],
    ["Persona dram\xE1tica", "Persona que nunca se altera", "Dramatic person", "Person who never gets upset"],
    ["Sinceridad brutal", "Diplomacia absoluta", "Brutal honesty", "Absolute diplomacy"],
    ["Amigo que escucha", "Amigo que siempre da consejos", "Friend who listens", "Friend who always gives advice"],
    ["Persona misteriosa", "Persona que cuenta todo", "Mysterious person", "Person who tells everything"],
    ["Relaci\xF3n aburrida", "Relaci\xF3n apasionante", "Boring relationship", "Passionate relationship"],
    ["Celos inexistentes", "Celos extremos", "No jealousy at all", "Extreme jealousy"],
    ["Conversaci\xF3n superficial", "Conversaci\xF3n profunda", "Superficial conversation", "Deep conversation"],
    ["Persona humilde", "Persona cre\xEDda", "Humble person", "Conceited person"],
    ["Pedir perd\xF3n f\xE1cilmente", "No reconocer nunca un error", "Apologizing easily", "Never admitting a mistake"],
    ["Amigo que siempre cancela", "Amigo que nunca falla", "Friend who always cancels", "Friend who never fails"],
    ["Cita inc\xF3moda", "Qu\xEDmica instant\xE1nea", "Awkward date", "Instant chemistry"],
    ["Perdonar enseguida", "Guardar rencor para siempre", "Forgiving right away", "Holding a grudge forever"],
    ["Introvertido total", "Extrovertido total", "Total introvert", "Total extrovert"],
    ["Relaci\xF3n a distancia", "Estar juntos todo el tiempo", "Long-distance relationship", "Being together all the time"],
    ["Amistad reciente", "Amistad de toda la vida", "Recent friendship", "Lifelong friendship"],
    ["Persona que habla demasiado", "Persona que nunca habla", "Person who talks too much", "Person who never talks"],
    ["Saber escuchar", "Saber dar buenos consejos", "Knowing how to listen", "Knowing how to give good advice"],
    ["Persona que evita los conflictos", "Persona que siempre los afronta", "Person who avoids conflict", "Person who always faces it"],
    ["Primeras impresiones enga\xF1osas", "Amor a primera vista", "Misleading first impressions", "Love at first sight"],
    ["Amigo competitivo", "Amigo que se alegra de tus \xE9xitos", "Competitive friend", "Friend who celebrates your wins"],
    ["Relaci\xF3n espont\xE1nea", "Relaci\xF3n perfectamente planificada", "Spontaneous relationship", "Perfectly planned relationship"]
  ];
  var MONEY = [
    ["Trabajo de ensue\xF1o", "Trabajo de pesadilla", "Dream job", "Nightmare job"],
    ["Sueldo insuficiente", "Sueldo de millonario", "Insufficient salary", "Millionaire salary"],
    ["Casa humilde", "Mansi\xF3n de lujo", "Humble home", "Luxury mansion"],
    ["Coche destartalado", "Superdeportivo", "Beat-up car", "Supercar"],
    ["Compra innecesaria", "Mejor inversi\xF3n de tu vida", "Unnecessary purchase", "Best investment of your life"],
    ["Vacaciones low cost", "Vacaciones de multimillonario", "Low-cost vacation", "Billionaire vacation"],
    ["Jefe insoportable", "Jefe ideal", "Unbearable boss", "Ideal boss"],
    ["Trabajar por dinero", "Trabajar por pasi\xF3n", "Working for money", "Working for passion"],
    ["Regalo barato", "Regalo inolvidable", "Cheap gift", "Unforgettable gift"],
    ["Persona taca\xF1a", "Persona que invita a todo", "Stingy person", "Person who pays for everything"],
    ["Tener \xE9xito con 20 a\xF1os", "Tener \xE9xito con 60 a\xF1os", "Succeeding at 20", "Succeeding at 60"],
    ["Pobreza absoluta", "Riqueza absurda", "Absolute poverty", "Absurd wealth"],
    ["Oficina deprimente", "Oficina futurista", "Depressing office", "Futuristic office"],
    ["Gastar 10 \u20AC sin pensarlo", "Gastar 10.000 \u20AC sin pensarlo", "Spending \u20AC10 without thinking", "Spending \u20AC10,000 without thinking"],
    ["Un mill\xF3n de euros ahora", "Diez millones dentro de veinte a\xF1os", "One million euros now", "Ten million in twenty years"],
    ["Trabajo rutinario", "Trabajo apasionante", "Routine job", "Exciting job"],
    ["Casa en un pueblo", "\xC1tico de lujo en Nueva York", "House in a village", "Luxury penthouse in New York"],
    ["Producto barato", "Producto que vale cada c\xE9ntimo", "Cheap product", "Product worth every cent"],
    ["Comprar una marca blanca", "Comprar la marca m\xE1s cara", "Buying the store brand", "Buying the priciest brand"],
    ["Ser tu propio jefe", "Tener un empleo estable", "Being your own boss", "Having a stable job"],
    ["Ascenso insignificante", "Ascenso que cambia tu vida", "Insignificant promotion", "Life-changing promotion"],
    ["Ahorrar cada c\xE9ntimo", "Gastar como un millonario", "Saving every cent", "Spending like a millionaire"],
    ["Regalo pr\xE1ctico", "Regalo extravagante", "Practical gift", "Extravagant gift"],
    ["Jubilaci\xF3n tranquila", "Retirarse siendo una leyenda", "Quiet retirement", "Retiring as a legend"]
  ];
  var ANIMALS = [
    ["Animal adorable", "Animal aterrador", "Adorable animal", "Terrifying animal"],
    ["Mascota f\xE1cil", "Mascota imposible", "Easy pet", "Impossible pet"],
    ["Animal lento", "Animal rapid\xEDsimo", "Slow animal", "Lightning-fast animal"],
    ["Animal inteligente", "Animal poco espabilado", "Smart animal", "Not-so-bright animal"],
    ["Animal inofensivo", "Animal peligros\xEDsimo", "Harmless animal", "Deadly animal"],
    ["Paisaje aburrido", "Paisaje espectacular", "Boring landscape", "Spectacular landscape"],
    ["Playa tranquila", "Playa abarrotada", "Quiet beach", "Crowded beach"],
    ["Fr\xEDo agradable", "Fr\xEDo insoportable", "Pleasant cold", "Unbearable cold"],
    ["Lluvia relajante", "Tormenta apocal\xEDptica", "Relaxing rain", "Apocalyptic storm"],
    ["Excursi\xF3n sencilla", "Aventura de supervivencia", "Easy hike", "Survival adventure"],
    ["Perro peque\xF1o", "Perro gigante", "Small dog", "Giant dog"],
    ["Animal que querr\xEDas abrazar", "Animal al que no te acercar\xEDas", "Animal you would want to hug", "Animal you would not go near"],
    ["Jard\xEDn bonito", "Selva salvaje", "Pretty garden", "Wild jungle"],
    ["Ver un animal com\xFAn", "Ver una criatura extraordinaria", "Seeing a common animal", "Seeing an extraordinary creature"],
    ["Acampar con comodidad", "Sobrevivir en mitad de la nada", "Comfortable camping", "Surviving in the middle of nowhere"],
    ["Ping\xFCino adorable", "Ping\xFCino que impone respeto", "Adorable penguin", "Penguin that commands respect"],
    ["Animal f\xE1cil de cuidar", "Animal que requiere un experto", "Easy-care animal", "Animal that needs an expert"],
    ["Mascota tranquila", "Mascota que destroza la casa", "Calm pet", "Pet that wrecks the house"],
    ["D\xEDa de sol perfecto", "Tormenta que lo arruina todo", "Perfect sunny day", "Storm that ruins everything"],
    ["Bosque silencioso", "Selva llena de sonidos", "Silent forest", "Jungle full of sounds"],
    ["Excursi\xF3n con vistas bonitas", "Paisaje que parece de otro planeta", "Hike with pretty views", "Landscape from another planet"]
  ];
  var PHILOSOPHY = [
    ["Blanco y negro", "Zona gris", "Black and white", "Gray area"],
    ["Suerte", "Habilidad", "Luck", "Skill"],
    ["Libertad", "Seguridad", "Freedom", "Security"],
    ["Tradici\xF3n", "Innovaci\xF3n", "Tradition", "Innovation"],
    ["Ser querido", "Ser respetado", "Being loved", "Being respected"],
    ["Inteligencia", "Sabidur\xEDa", "Intelligence", "Wisdom"],
    ["\xC9xito personal", "\xC9xito colectivo", "Personal success", "Collective success"],
    ["Mentira aceptable", "Verdad cruel", "Acceptable lie", "Cruel truth"],
    ["Vivir el presente", "Planificar el futuro", "Living in the present", "Planning for the future"],
    ["Problema insignificante", "Problema existencial", "Insignificant problem", "Existential problem"],
    ["Decisi\xF3n racional", "Decisi\xF3n emocional", "Rational decision", "Emotional decision"],
    ["Talento natural", "Esfuerzo constante", "Natural talent", "Constant effort"],
    ["Ser famoso", "Ser feliz", "Being famous", "Being happy"],
    ["Tener raz\xF3n", "Llevarse bien", "Being right", "Getting along"],
    ["Utop\xEDa", "Distop\xEDa", "Utopia", "Dystopia"],
    ["Algo moralmente correcto", "Algo legalmente correcto", "Morally right", "Legally right"],
    ["Sacrificarte por otros", "Priorizarte a ti mismo", "Sacrificing yourself for others", "Putting yourself first"],
    ["Cambio necesario", "Estabilidad necesaria", "Necessary change", "Necessary stability"]
  ];
  var SPAIN = [
    ["Siesta de diez minutos", "Siesta de tres horas", "Ten-minute nap", "Three-hour nap"],
    ["Caf\xE9 solo", "Caf\xE9 con leche", "Black coffee", "Coffee with milk"],
    ["Tapeo improvisado", "Comida familiar de cuatro horas", "Improvised tapas", "Four-hour family lunch"],
    ["Pueblo tranquilo", "Centro de Madrid un s\xE1bado", "Quiet village", "Central Madrid on a Saturday"],
    ["Llegar cinco minutos tarde", "Llegar una hora tarde", "Five minutes late", "An hour late"],
    ["Fiesta de pueblo", "Festival multitudinario", "Village fiesta", "Massive festival"],
    ["Sobremesa corta", "Sobremesa interminable", "Short post-meal chat", "Endless post-meal chat"],
    ["Grupo de WhatsApp tranquilo", "Grupo de WhatsApp ca\xF3tico", "Quiet WhatsApp group", "Chaotic WhatsApp group"],
    ["Vacaciones en agosto", "Vacaciones en noviembre", "August vacation", "November vacation"],
    ["Bar de toda la vida", "Restaurante moderno", "Old-school bar", "Trendy restaurant"],
    ["Hacer cola cinco minutos", "Hacer cola tres horas", "Five-minute queue", "Three-hour queue"],
    ["Excusa espa\xF1ola cre\xEDble", "Excusa espa\xF1ola legendaria", "Believable Spanish excuse", "Legendary Spanish excuse"],
    ["Plan de domingo", "Plan de Nochevieja", "Sunday plan", "Plan for New Years Eve"],
    ["Persona que paga una ronda", "Persona que desaparece cuando toca pagar", "Person who buys a round", "Person who vanishes when it is time to pay"],
    ["Discusi\xF3n futbolera amistosa", "Discusi\xF3n futbolera sin retorno", "Friendly football debate", "Football debate with no return"],
    ["Siesta reparadora", "Siesta que te destroza el d\xEDa", "Restorative nap", "Nap that wrecks your day"],
    ["Turismo de playa", "Turismo de monta\xF1a", "Beach tourism", "Mountain tourism"],
    ["Ver una serie doblada", "Verla en versi\xF3n original", "Dubbed series", "Original version"],
    ["Desayuno r\xE1pido", "Almuerzo de varias horas", "Quick breakfast", "Multi-hour lunch"],
    ["Conversaci\xF3n de ascensor", "Debate de sobremesa que dura toda la tarde", "Elevator small talk", "Afternoon-long table debate"]
  ];
  var EXTREMES = [
    ["Casi imposible", "Pr\xE1cticamente garantizado", "Almost impossible", "Practically guaranteed"],
    ["Cero riesgo", "Riesgo absurdo", "Zero risk", "Absurd risk"],
    ["Un poco inc\xF3modo", "Socialmente devastador", "A bit awkward", "Socially devastating"],
    ["Mala decisi\xF3n", "Decisi\xF3n que arruina tu vida", "Bad decision", "Life-ruining decision"],
    ["Famoso durante un d\xEDa", "Recordado durante siglos", "Famous for a day", "Remembered for centuries"],
    ["Un peque\xF1o inconveniente", "Cat\xE1strofe mundial", "Minor inconvenience", "Global catastrophe"],
    ["Poco atractivo", "Irresistible", "Unattractive", "Irresistible"],
    ["Un poco sospechoso", "Claramente culpable", "A bit suspicious", "Clearly guilty"],
    ["Persona que sobrevivir\xEDa un d\xEDa", "Persona que sobrevivir\xEDa un apocalipsis", "Would survive a day", "Would survive an apocalypse"],
    ["Una tonter\xEDa", "Una genialidad incomprendida", "Nonsense", "Misunderstood genius"],
    ["Normal en p\xFAblico", "Inconfesable", "Normal in public", "Unmentionable"],
    ["Un lujo innecesario", "Una necesidad absoluta", "Needless luxury", "Absolute necessity"],
    ["Perd\xF3n inmediato", "Enemistad eterna", "Instant forgiveness", "Eternal enmity"],
    ["Un problema de 1 \u20AC", "Un problema de un mill\xF3n de euros", "A \u20AC1 problem", "A \u20AC1 million problem"],
    ["Mala suerte normal", "Mala suerte legendaria", "Ordinary bad luck", "Legendary bad luck"],
    ["Un poco vergonzoso", "No volver a salir de casa", "A bit embarrassing", "Never leaving home again"],
    ["Una discusi\xF3n cualquiera", "Una pelea hist\xF3rica", "Any old argument", "Historic fight"],
    ["Una sorpresa agradable", "La mejor noticia de tu vida", "Pleasant surprise", "Best news of your life"],
    ["Error sin consecuencias", "Error irreversible", "Harmless mistake", "Irreversible mistake"],
    ["Un fracaso cualquiera", "Fracaso que pasa a la historia", "Any old failure", "Failure that goes down in history"],
    ["Algo ligeramente sospechoso", "Algo claramente ilegal", "Slightly suspicious", "Clearly illegal"],
    ["Una apuesta segura", "Una apuesta suicida", "Safe bet", "Reckless bet"],
    ["Un problema de cinco minutos", "Un problema para toda la vida", "Five-minute problem", "Lifelong problem"],
    ["Una persona algo rara", "La persona m\xE1s extra\xF1a del mundo", "Slightly odd person", "Strangest person in the world"],
    ["Un secreto sin importancia", "Un secreto que cambiar\xEDa todo", "Unimportant secret", "Secret that would change everything"],
    ["Un d\xEDa malo", "El peor d\xEDa de la historia", "Bad day", "Worst day in history"]
  ];

  // js/data/packs.js
  var toPairs = (rows) => rows.map(([esL, esR, enL, enR]) => ({ es: [esL, esR], en: [enL, enR] }));
  var registry = /* @__PURE__ */ new Map();
  function registerPack(pack) {
    registry.set(pack.id, { tier: "free", age: 0, adult: false, ...pack });
  }
  registerPack({ id: "nba", tier: "free", age: 0, pairs: toPairs(NBA) });
  registerPack({ id: "football", tier: "free", age: 0, pairs: toPairs(FOOTBALL) });
  registerPack({ id: "sports", tier: "free", age: 0, pairs: toPairs(SPORTS) });
  registerPack({ id: "food", tier: "free", age: 0, pairs: toPairs(FOOD) });
  registerPack({ id: "screen", tier: "free", age: 0, pairs: toPairs(SCREEN) });
  registerPack({ id: "gaming", tier: "free", age: 0, pairs: toPairs(GAMING) });
  registerPack({ id: "humor", tier: "free", age: 0, pairs: toPairs(HUMOR) });
  registerPack({ id: "music", tier: "free", age: 0, pairs: toPairs(MUSIC) });
  registerPack({ id: "celebs", tier: "free", age: 0, pairs: toPairs(CELEBS) });
  registerPack({ id: "daily", tier: "free", age: 0, pairs: toPairs(DAILY) });
  registerPack({ id: "people", tier: "free", age: 0, pairs: toPairs(PEOPLE) });
  registerPack({ id: "money", tier: "free", age: 0, pairs: toPairs(MONEY) });
  registerPack({ id: "animals", tier: "free", age: 0, pairs: toPairs(ANIMALS) });
  registerPack({ id: "philosophy", tier: "free", age: 0, pairs: toPairs(PHILOSOPHY) });
  registerPack({ id: "spain", tier: "free", age: 0, pairs: toPairs(SPAIN) });
  registerPack({ id: "extremes", tier: "free", age: 0, pairs: toPairs(EXTREMES) });
  var listPacks = () => [...registry.values()];
  function createCategoryDeck(packIds, lang = "es", rng = Math.random) {
    const pool = [];
    for (const id of packIds) {
      const p = registry.get(id);
      if (p) p.pairs.forEach((pair, i) => pool.push(`${id}:${i}`));
    }
    const used = /* @__PURE__ */ new Set();
    return {
      size: pool.length,
      remaining: () => pool.length - used.size,
      /** Devuelve {left,right,key} o null si no hay packs. Reinicia el mazo al agotarlo. */
      draw(l = lang) {
        if (!pool.length) return null;
        if (used.size >= pool.length) used.clear();
        let key;
        do {
          key = pool[Math.floor(rng() * pool.length)];
        } while (used.has(key));
        used.add(key);
        const [id, i] = key.split(":");
        const pair = registry.get(id).pairs[Number(i)];
        const [left, right] = pair[l] ?? pair.es;
        return { left, right, key };
      }
    };
  }

  // js/i18n/es.js
  var es_default = {
    "meta.locale": "es-ES",
    "meta.title": "LA ZONA \u2014 juego de adivinar para jugar en un m\xF3vil",
    "app.name": "LA ZONA",
    "app.tagline": "Da una pista. Que adivinen d\xF3nde cae.",
    "common.close": "Cerrar",
    "common.cancel": "Cancelar",
    "common.accept": "Aceptar",
    "common.back": "Atr\xE1s",
    "common.next": "Siguiente",
    "home.title": "Nueva partida",
    "home.players": "Jugadores",
    "home.player": "Jugador {n}",
    "home.playerField": "Nombre del jugador {n}",
    "home.addPlayer": "A\xF1adir jugador",
    "home.removePlayer": "Quitar a {name}",
    "home.playersHint": "De 2 a 8 jugadores. Con m\xE1s de 2, el m\xF3vil rota por turnos.",
    "home.category": "Categor\xEDa",
    "home.packs": "Packs",
    "home.custom": "Propia",
    "home.leftEnd": "Extremo izquierdo",
    "home.rightEnd": "Extremo derecho",
    "home.leftPh": "Ej. Fr\xEDo",
    "home.rightPh": "Ej. Caliente",
    "home.customNote": "Lo que escribas aqu\xED es lo \xFAnico que se mostrar\xE1 en cada lado de la ruleta",
    "home.start": "Empezar partida",
    "home.missingEnd": "Escribe los dos extremos de la categor\xEDa",
    "home.noPacks": "Elige al menos un pack",
    "home.packCount_one": "{n} categor\xEDa",
    "home.packCount_other": "{n} categor\xEDas",
    "home.fair": "Equidad de turnos",
    "home.fairHint": "Todos juegan las mismas rondas antes de declarar ganador",
    "home.howTo": "C\xF3mo se juega",
    "home.settings": "Ajustes",
    "home.premium": "Premium",
    "home.unlock": "Desbloquear",
    "packs.nba": "NBA \u{1F3C0}",
    "packs.football": "F\xFAtbol \u26BD",
    "packs.sports": "Deportes en general \u{1F3C6}",
    "packs.food": "Comida y bebida \u{1F355}",
    "packs.screen": "Cine, series y televisi\xF3n \u{1F3AC}",
    "packs.gaming": "Videojuegos y tecnolog\xEDa \u{1F3AE}",
    "packs.humor": "Humor y situaciones absurdas \u{1F602}",
    "packs.music": "M\xFAsica y artistas \u{1F3B5}",
    "packs.celebs": "Cultura popular y famosos \u{1F31F}",
    "packs.daily": "Vida cotidiana \u{1F3E0}",
    "packs.people": "Personalidad y relaciones \u2764\uFE0F",
    "packs.money": "Dinero, lujo y trabajo \u{1F4B8}",
    "packs.animals": "Animales y naturaleza \u{1F427}",
    "packs.philosophy": "Filosof\xEDa y dilemas \u{1F9E0}",
    "packs.spain": "Espa\xF1a y costumbres \u{1F1EA}\u{1F1F8}",
    "packs.extremes": "Extremos y situaciones competitivas \u{1F525}",
    "packs.ageGate": "Este pack incluye humor para adultos. \xBFConfirmas que tienes 18 a\xF1os o m\xE1s?",
    "packs.ageYes": "Tengo 18 o m\xE1s",
    "game.back": "Volver al men\xFA",
    "game.psychic": "ps\xEDquico",
    "game.guesser": "adivina",
    "game.waiting": "espera",
    "game.score": "{name}: {n} puntos, {role}",
    "game.round": "Ronda {n}",
    "game.turnOf": "Turno de {name}",
    "game.lookAway": "{name}, aparta la vista",
    "game.iAm": "Soy {name}: ver posici\xF3n",
    "game.covered": "Dial tapado. La posici\xF3n secreta est\xE1 oculta.",
    "game.memorize": "Memoriza la posici\xF3n",
    "game.hintPsychic": "Di tu pista en voz alta, sin n\xFAmeros ni posiciones",
    "game.hideAndPass": "Ocultar y pasar a {name}",
    "game.whereIs": "{name}, \xBFd\xF3nde est\xE1?",
    "game.lockGuess": "Fijar respuesta",
    "game.hintGuess": "Arrastra la aguja o usa las flechas. May\xFAs para pasos grandes, Enter para fijar.",
    "game.sliderLabel": "Posici\xF3n de tu respuesta entre {left} y {right}",
    "game.dialLabel": "Dial entre {left} y {right}",
    "game.result": "Resultado",
    "game.target": "OBJETIVO",
    "game.yourAnswer": "TU RESPUESTA",
    "game.legend": "Las franjas valen 2, 3 o 4 puntos seg\xFAn cercan\xEDa al objetivo",
    "game.sums": "{name} suma {n}",
    "game.sumsNone": "{name} no suma",
    "game.verdict.bullseye": "\xA1Diana!",
    "game.verdict.close": "Muy cerca",
    "game.verdict.near": "Casi",
    "game.verdict.far": "Lejos. Sin puntos.",
    "game.nextRound": "Siguiente ronda",
    "game.seeSummary": "Ver resumen",
    "game.over": "Fin de la partida",
    "game.wins": "{name} gana la partida",
    "game.rematch": "Nueva partida",
    "game.anotherCategory": "Otra categor\xEDa",
    "game.history": "Historial",
    "game.confirmLeave": "Se perder\xE1 la partida en curso. \xBFVolver al inicio?",
    "game.leave": "Volver al inicio",
    "game.stay": "Seguir jugando",
    "history.title": "Historial de rondas",
    "history.empty": "A\xFAn no hay rondas jugadas.",
    "history.row": "Ronda {round}: {guesser} \xB7 {left} \u2194 {right} \xB7 {points}",
    "summary.title": "Resumen de la partida",
    "summary.rounds": "Rondas jugadas",
    "summary.best": "Mejor ronda",
    "summary.bestValue": "Ronda {round}: {name} con {points} puntos",
    "summary.avg": "Precisi\xF3n media",
    "summary.avgValue": "{n} puntos de distancia",
    "summary.perRound": "Puntos por ronda",
    "summary.perPlayer": "Por jugador",
    "summary.bullseyes": "Dianas",
    "summary.colRound": "Ronda",
    "summary.colGuesser": "Adivina",
    "summary.colCategory": "Categor\xEDa",
    "summary.colPoints": "Puntos",
    "summary.menu": "Volver al men\xFA",
    "settings.title": "Ajustes",
    "settings.theme": "Tema",
    "settings.theme.light": "Claro",
    "settings.theme.dark": "Oscuro",
    "settings.theme.auto": "Auto",
    "settings.palette": "Color",
    "settings.paletteHint": "Elige el color principal de la app",
    "settings.palette.indigo": "\xCDndigo",
    "settings.palette.blue": "Azul",
    "settings.palette.teal": "Turquesa",
    "settings.palette.green": "Verde",
    "settings.palette.orange": "Naranja",
    "settings.palette.coral": "Coral",
    "settings.palette.fuchsia": "Fucsia",
    "settings.palette.violet": "Violeta",
    "settings.palette.graphite": "Grafito",
    "settings.reduceMotion": "Reducir animaciones",
    "settings.difficulty": "Dificultad",
    "settings.difficulty.easy": "F\xE1cil",
    "settings.difficulty.normal": "Normal",
    "settings.difficulty.hard": "Dif\xEDcil",
    "settings.difficultyHint": "Se aplica desde la siguiente ronda",
    "settings.target": "Puntos para ganar",
    "settings.target.10": "10",
    "settings.target.15": "15",
    "settings.target.0": "Infinito",
    "settings.hints": "Mostrar ayudas",
    "settings.sound": "Sonidos",
    "settings.vibration": "Vibraci\xF3n",
    "settings.language": "Idioma",
    "settings.reset": "Restablecer ajustes",
    "settings.analytics": "Estad\xEDsticas an\xF3nimas",
    "settings.analyticsHint": "Opcional. Sin datos personales ni identificadores.",
    "settings.privacy": "Pol\xEDtica de privacidad",
    "settings.terms": "T\xE9rminos de uso",
    "settings.restore": "Restaurar compras",
    "settings.game": "Partida",
    "settings.look": "Aspecto",
    "settings.feedback": "Sonido y tacto",
    "settings.legal": "Legal",
    "settings.storageWarn": "Este navegador no permite guardar ajustes: se perder\xE1n al cerrar.",
    "tut.step": "Paso {n} de {total}",
    "tut.1.title": "Una escala y una posici\xF3n secreta",
    "tut.1.body": "Entre dos extremos hay un punto oculto. Cuanto m\xE1s cerca lo marques, m\xE1s puntos sumas.",
    "tut.2.title": "Uno da la pista, otro adivina",
    "tut.2.body": "El ps\xEDquico ve la posici\xF3n y dice una pista en voz alta, sin n\xFAmeros. El otro no mira.",
    "tut.3.title": "Prueba a colocar la aguja",
    "tut.3.body": "Arrastra sobre el dial. El centro de la zona vale 4, luego 3 y 2.",
    "tut.2.example": "\u201CCaliente, pero no tanto como un caf\xE9\u201D",
    "tut.skip": "Saltar",
    "tut.done": "Empezar a jugar",
    "tut.demoLabel": "Dial de prueba",
    "howto.title": "C\xF3mo se juega",
    "howto.1": "Elegid una categor\xEDa: dos extremos opuestos, como Fr\xEDo y Caliente.",
    "howto.2": "El ps\xEDquico mira la posici\xF3n secreta y piensa una pista.",
    "howto.3": "Dice la pista en voz alta. Nada de n\xFAmeros ni posiciones.",
    "howto.4": "Pasa el m\xF3vil. El adivino mueve la aguja y la fija.",
    "howto.5": "Se revela la zona: 4 puntos en el centro, 3 y 2 a los lados.",
    "howto.6": "Solo punt\xFAa quien adivina. Los papeles se alternan cada ronda.",
    "howto.7": "Gana quien llegue primero a los puntos elegidos, sin empate.",
    "howto.replay": "Ver el tutorial",
    "store.title": "Desbloquea m\xE1s packs",
    "store.body": "Compra \xFAnica. Sin suscripciones. Nunca hay anuncios al adivinar ni al revelar.",
    "store.buy": "Comprar por {price}",
    "store.removeAds": "Quitar anuncios",
    "store.restore": "Restaurar compras",
    "store.unavailable": "Las compras no est\xE1n disponibles en este dispositivo.",
    "pwa.install": "Instalar app",
    "pwa.offlineReady": "Lista para jugar sin conexi\xF3n",
    "pwa.update": "Hay una versi\xF3n nueva",
    "pwa.reload": "Actualizar",
    "aria.palette": "Cambiar color",
    "aria.settings": "Abrir ajustes",
    "aria.score": "Marcador",
    "aria.verdict": "Resultado de la ronda",
    "aria.sheetHandle": "Desliza hacia abajo para cerrar",
    "aria.remove": "Quitar",
    "aria.loading": "Cargando"
  };

  // js/i18n/en.js
  var en_default = {
    "meta.locale": "en-GB",
    "meta.title": "LA ZONA \u2014 the guessing game for one phone",
    "app.name": "LA ZONA",
    "app.tagline": "Give a clue. Make them guess where it lands.",
    "common.close": "Close",
    "common.cancel": "Cancel",
    "common.accept": "OK",
    "common.back": "Back",
    "common.next": "Next",
    "home.title": "New game",
    "home.players": "Players",
    "home.player": "Player {n}",
    "home.playerField": "Name of player {n}",
    "home.addPlayer": "Add player",
    "home.removePlayer": "Remove {name}",
    "home.playersHint": "2 to 8 players. With more than 2, the phone rotates turn by turn.",
    "home.category": "Category",
    "home.packs": "Packs",
    "home.custom": "Your own",
    "home.leftEnd": "Left end",
    "home.rightEnd": "Right end",
    "home.leftPh": "E.g. Cold",
    "home.rightPh": "E.g. Hot",
    "home.customNote": "What you type here is the only thing shown on each side of the dial",
    "home.start": "Start game",
    "home.missingEnd": "Write both ends of the category",
    "home.noPacks": "Pick at least one pack",
    "home.packCount_one": "{n} category",
    "home.packCount_other": "{n} categories",
    "home.fair": "Equal turns",
    "home.fairHint": "Everyone plays the same number of rounds before a winner is declared",
    "home.howTo": "How to play",
    "home.settings": "Settings",
    "home.premium": "Premium",
    "home.unlock": "Unlock",
    "packs.nba": "NBA \u{1F3C0}",
    "packs.football": "Football \u26BD",
    "packs.sports": "Sports in general \u{1F3C6}",
    "packs.food": "Food and drink \u{1F355}",
    "packs.screen": "Movies, series and TV \u{1F3AC}",
    "packs.gaming": "Video games and tech \u{1F3AE}",
    "packs.humor": "Humor and absurd situations \u{1F602}",
    "packs.music": "Music and artists \u{1F3B5}",
    "packs.celebs": "Pop culture and celebrities \u{1F31F}",
    "packs.daily": "Everyday life \u{1F3E0}",
    "packs.people": "Personality and relationships \u2764\uFE0F",
    "packs.money": "Money, luxury and work \u{1F4B8}",
    "packs.animals": "Animals and nature \u{1F427}",
    "packs.philosophy": "Philosophy and dilemmas \u{1F9E0}",
    "packs.spain": "Spain and customs \u{1F1EA}\u{1F1F8}",
    "packs.extremes": "Extremes and competitive situations \u{1F525}",
    "packs.ageGate": "This pack contains adult humour. Do you confirm you are 18 or older?",
    "packs.ageYes": "I am 18 or older",
    "game.back": "Back to menu",
    "game.psychic": "psychic",
    "game.guesser": "guessing",
    "game.waiting": "waiting",
    "game.score": "{name}: {n} points, {role}",
    "game.round": "Round {n}",
    "game.turnOf": "{name}\u2019s turn",
    "game.lookAway": "{name}, look away",
    "game.iAm": "I\u2019m {name}: show position",
    "game.covered": "Dial covered. The secret position is hidden.",
    "game.memorize": "Memorise the position",
    "game.hintPsychic": "Say your clue out loud, with no numbers or positions",
    "game.hideAndPass": "Hide and pass to {name}",
    "game.whereIs": "{name}, where is it?",
    "game.lockGuess": "Lock answer",
    "game.hintGuess": "Drag the needle or use the arrow keys. Shift for big steps, Enter to lock.",
    "game.sliderLabel": "Your answer position between {left} and {right}",
    "game.dialLabel": "Dial between {left} and {right}",
    "game.result": "Result",
    "game.target": "TARGET",
    "game.yourAnswer": "YOUR ANSWER",
    "game.legend": "Bands are worth 2, 3 or 4 points depending on how close you are to the target",
    "game.sums": "{name} scores {n}",
    "game.sumsNone": "{name} scores nothing",
    "game.verdict.bullseye": "Bullseye!",
    "game.verdict.close": "Very close",
    "game.verdict.near": "Almost",
    "game.verdict.far": "Far off. No points.",
    "game.nextRound": "Next round",
    "game.seeSummary": "See summary",
    "game.over": "Game over",
    "game.wins": "{name} wins the game",
    "game.rematch": "New game",
    "game.anotherCategory": "Another category",
    "game.history": "History",
    "game.confirmLeave": "The current game will be lost. Go back to the start?",
    "game.leave": "Go to start",
    "game.stay": "Keep playing",
    "history.title": "Round history",
    "history.empty": "No rounds played yet.",
    "history.row": "Round {round}: {guesser} \xB7 {left} \u2194 {right} \xB7 {points}",
    "summary.title": "Game summary",
    "summary.rounds": "Rounds played",
    "summary.best": "Best round",
    "summary.bestValue": "Round {round}: {name} with {points} points",
    "summary.avg": "Average accuracy",
    "summary.avgValue": "{n} points away",
    "summary.perRound": "Points per round",
    "summary.perPlayer": "By player",
    "summary.bullseyes": "Bullseyes",
    "summary.colRound": "Round",
    "summary.colGuesser": "Guesser",
    "summary.colCategory": "Category",
    "summary.colPoints": "Points",
    "summary.menu": "Back to menu",
    "settings.title": "Settings",
    "settings.theme": "Theme",
    "settings.theme.light": "Light",
    "settings.theme.dark": "Dark",
    "settings.theme.auto": "Auto",
    "settings.palette": "Color",
    "settings.paletteHint": "Pick the main color of the app",
    "settings.palette.indigo": "Indigo",
    "settings.palette.blue": "Blue",
    "settings.palette.teal": "Teal",
    "settings.palette.green": "Green",
    "settings.palette.orange": "Orange",
    "settings.palette.coral": "Coral",
    "settings.palette.fuchsia": "Fuchsia",
    "settings.palette.violet": "Violet",
    "settings.palette.graphite": "Graphite",
    "settings.reduceMotion": "Reduce motion",
    "settings.difficulty": "Difficulty",
    "settings.difficulty.easy": "Easy",
    "settings.difficulty.normal": "Normal",
    "settings.difficulty.hard": "Hard",
    "settings.difficultyHint": "Applies from the next round",
    "settings.target": "Points to win",
    "settings.target.10": "10",
    "settings.target.15": "15",
    "settings.target.0": "Endless",
    "settings.hints": "Show tips",
    "settings.sound": "Sounds",
    "settings.vibration": "Vibration",
    "settings.language": "Language",
    "settings.reset": "Reset settings",
    "settings.analytics": "Anonymous statistics",
    "settings.analyticsHint": "Optional. No personal data or identifiers.",
    "settings.privacy": "Privacy policy",
    "settings.terms": "Terms of use",
    "settings.restore": "Restore purchases",
    "settings.game": "Game",
    "settings.look": "Look",
    "settings.feedback": "Sound and touch",
    "settings.legal": "Legal",
    "settings.storageWarn": "This browser cannot save settings: they will be lost on close.",
    "tut.step": "Step {n} of {total}",
    "tut.1.title": "A scale and a secret position",
    "tut.1.body": "There is a hidden point between two extremes. The closer you place it, the more points you score.",
    "tut.2.title": "One gives the clue, one guesses",
    "tut.2.body": "The psychic sees the position and says a clue out loud, with no numbers. The other player looks away.",
    "tut.3.title": "Try placing the needle",
    "tut.3.body": "Drag across the dial. The centre of the zone is worth 4, then 3 and 2.",
    "tut.2.example": "\u201CHot, but not as hot as a coffee\u201D",
    "tut.skip": "Skip",
    "tut.done": "Start playing",
    "tut.demoLabel": "Practice dial",
    "howto.title": "How to play",
    "howto.1": "Pick a category: two opposite ends, like Cold and Hot.",
    "howto.2": "The psychic looks at the secret position and thinks of a clue.",
    "howto.3": "They say the clue out loud. No numbers or positions.",
    "howto.4": "Pass the phone. The guesser moves the needle and locks it in.",
    "howto.5": "The zone is revealed: 4 points in the middle, 3 and 2 on the sides.",
    "howto.6": "Only the guesser scores. Roles swap every round.",
    "howto.7": "First to the chosen score wins, with no tie.",
    "howto.replay": "Watch the tutorial",
    "store.title": "Unlock more packs",
    "store.body": "One-time purchase. No subscriptions. Never any ads while guessing or revealing.",
    "store.buy": "Buy for {price}",
    "store.removeAds": "Remove ads",
    "store.restore": "Restore purchases",
    "store.unavailable": "Purchases are not available on this device.",
    "pwa.install": "Install app",
    "pwa.offlineReady": "Ready to play offline",
    "pwa.update": "A new version is available",
    "pwa.reload": "Update",
    "aria.palette": "Change color",
    "aria.settings": "Open settings",
    "aria.score": "Scoreboard",
    "aria.verdict": "Round result",
    "aria.sheetHandle": "Swipe down to close",
    "aria.remove": "Remove",
    "aria.loading": "Loading"
  };

  // js/i18n/index.js
  var DICTS = { es: es_default, en: en_default };
  var current = "es";
  function setLang(lang) {
    current = DICTS[lang] ? lang : "es";
    return current;
  }
  var locale = () => DICTS[current]["meta.locale"];
  function t(key, params = {}) {
    let str = DICTS[current][key] ?? DICTS.es[key] ?? key;
    for (const [k, v] of Object.entries(params)) str = str.replaceAll(`{${k}}`, String(v));
    return str;
  }
  function tn(key, n, params = {}) {
    const rule = new Intl.PluralRules(locale()).select(n);
    const k = DICTS[current][`${key}_${rule}`] ? `${key}_${rule}` : `${key}_other`;
    return t(k, { n: formatNumber(n), ...params });
  }
  var formatNumber = (n, opts) => new Intl.NumberFormat(locale(), opts).format(n);
  var formatPrice = (amount, currency = "EUR") => new Intl.NumberFormat(locale(), { style: "currency", currency }).format(amount);
  var availableLangs = () => Object.keys(DICTS);
  var langName = (code) => new Intl.DisplayNames([code], { type: "language" }).of(code);
  function detectLang(navLangs = globalThis.navigator?.languages ?? []) {
    for (const l of navLangs) {
      const c = l.slice(0, 2).toLowerCase();
      if (DICTS[c]) return c;
    }
    return "es";
  }

  // js/services/feedback.js
  var NOTE = { A3: 220, C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5 };
  function notesFor(points, finalWin = false) {
    if (finalWin) return [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6];
    if (points >= 4) return [NOTE.C5, NOTE.E5, NOTE.G5];
    if (points === 3) return [NOTE.C5, NOTE.E5];
    if (points === 2) return [NOTE.C5];
    return [NOTE.A3];
  }
  function vibrationFor(points, finalWin = false) {
    if (finalWin) return [60, 40, 60, 40, 140];
    if (points >= 4) return [50, 30, 50];
    if (points === 3) return [40];
    if (points === 2) return [25];
    return [15];
  }
  var canVibrate = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  function createFeedback(getSettings) {
    let ctx2 = null;
    function unlock() {
      try {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC) return null;
        ctx2 ?? (ctx2 = new AC());
        if (ctx2.state === "suspended") ctx2.resume().catch(() => {
        });
        return ctx2;
      } catch {
        return null;
      }
    }
    function playNotes(freqs) {
      const c = unlock();
      if (!c || c.state === "closed") return;
      const t0 = c.currentTime + 0.02;
      freqs.forEach((f2, i) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        const start = t0 + i * 0.14;
        osc.type = "sine";
        osc.frequency.value = f2;
        gain.gain.setValueAtTime(1e-4, start);
        gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(1e-4, start + 0.32);
        osc.connect(gain).connect(c.destination);
        osc.start(start);
        osc.stop(start + 0.36);
      });
    }
    return {
      unlock,
      /** Sonido + vibración del resultado según los ajustes actuales. */
      reveal(points, finalWin = false) {
        const s2 = getSettings();
        if (s2.sound) playNotes(notesFor(points, finalWin));
        if (s2.vibration && canVibrate()) {
          try {
            navigator.vibrate(vibrationFor(points, finalWin));
          } catch {
          }
        }
      },
      /** Muestra breve al activar el interruptor de sonido. */
      sample() {
        playNotes([NOTE.C5, NOTE.E5]);
      },
      tick() {
        if (getSettings().vibration && canVibrate()) {
          try {
            navigator.vibrate(8);
          } catch {
          }
        }
      }
    };
  }

  // js/services/monetization.js
  var MONETIZATION_ENABLED = false;
  var PRODUCTS = Object.freeze({
    premiumPacks: { id: "premium_packs", type: "one-time", price: 2.99, unlocks: [] },
    removeAds: { id: "remove_ads", type: "one-time", price: 1.99 }
  });
  var KEY = "lazona.entitlements.v1";
  var ADS_ALLOWED_PHASES = /* @__PURE__ */ new Set(["setup"]);
  var nullProvider = {
    async purchase() {
      return { ok: false, reason: "unavailable" };
    },
    async restore() {
      return { ok: false, reason: "unavailable", owned: [] };
    }
  };
  function createEntitlements(storage2, { enabled = MONETIZATION_ENABLED } = {}) {
    let provider = nullProvider;
    let owned = /* @__PURE__ */ new Set();
    try {
      owned = new Set(JSON.parse(storage2.get(KEY) ?? "[]").filter((x) => typeof x === "string"));
    } catch {
    }
    const persist = () => storage2.set(KEY, JSON.stringify([...owned]));
    const packProduct = (packId) => Object.values(PRODUCTS).find((p) => p.unlocks?.includes(packId));
    return {
      enabled,
      setProvider(p) {
        provider = p;
      },
      isPremiumPack(pack) {
        return pack.tier === "premium";
      },
      hasPack(pack) {
        if (!enabled || pack.tier !== "premium") return true;
        const prod = packProduct(pack.id);
        return !!prod && owned.has(prod.id);
      },
      adsRemoved: () => !enabled || owned.has(PRODUCTS.removeAds.id),
      /** Los anuncios solo pueden aparecer fuera de la partida. */
      canShowAds(phase) {
        return enabled && !owned.has(PRODUCTS.removeAds.id) && ADS_ALLOWED_PHASES.has(phase);
      },
      async purchase(productId) {
        const r = await provider.purchase(productId);
        if (r.ok) {
          owned.add(productId);
          persist();
        }
        return r;
      },
      async restore() {
        const r = await provider.restore();
        if (r.ok) {
          r.owned.forEach((id) => owned.add(id));
          persist();
        }
        return r;
      }
    };
  }

  // js/services/analytics.js
  var ANALYTICS_ENDPOINT = "";
  var ALLOWED = /* @__PURE__ */ new Set(["game_start", "round_end", "game_end", "tutorial_done", "pack_selected"]);
  function createAnalytics(getSettings, endpoint = ANALYTICS_ENDPOINT, send = defaultSend) {
    return {
      track(name, data = {}) {
        if (!getSettings().analytics || !endpoint || !ALLOWED.has(name)) return false;
        const safe = {};
        for (const [k, v] of Object.entries(data)) if (typeof v === "number" || typeof v === "boolean") safe[k] = v;
        try {
          send(endpoint, JSON.stringify({ e: name, d: safe, v: 1 }));
          return true;
        } catch {
          return false;
        }
      }
    };
  }
  function defaultSend(url, body) {
    if (navigator.sendBeacon) navigator.sendBeacon(url, body);
  }

  // js/ui/dom.js
  var SVG_NS = "http://www.w3.org/2000/svg";
  function apply(el, props) {
    for (const [k, v] of Object.entries(props ?? {})) {
      if (v === false || v == null) continue;
      if (k === "class") el.setAttribute("class", v);
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "value" || k === "checked" || k === "disabled" || k === "hidden") el[k] = v;
      else el.setAttribute(k, v === true ? "" : String(v));
    }
  }
  function append(el, children) {
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
  }
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    apply(el, props);
    append(el, children);
    return el;
  }
  function s(tag, props, ...children) {
    const el = document.createElementNS(SVG_NS, tag);
    apply(el, props);
    append(el, children);
    return el;
  }
  var clear = (el) => {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  };
  function announce(text) {
    const live = document.getElementById("live");
    if (!live) return;
    live.textContent = "";
    setTimeout(() => {
      live.textContent = text;
    }, 30);
  }
  function icon(paths, size = 22) {
    const svg = s("svg", {
      viewBox: "0 0 24 24",
      width: size,
      height: size,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
      focusable: "false"
    });
    for (const d of paths) svg.append(s("path", { d }));
    return svg;
  }
  function add(parent, ...children) {
    append(parent, children);
    return parent;
  }

  // js/ui/icons.js
  var ICONS = {
    back: ["M15 18l-6-6 6-6"],
    gear: [
      "M12 15a3 3 0 100-6 3 3 0 000 6z",
      "M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"
    ],
    help: ["M12 22a10 10 0 100-20 10 10 0 000 20z", "M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3", "M12 17h.01"],
    palette: ["M12 22a10 10 0 110-20c5.5 0 10 3.6 10 8.5 0 3-2.2 4.5-4.5 4.5H15a2 2 0 00-1.4 3.4c.5.6.6 1.1.6 1.6 0 1.2-1 2-2.2 2z", "M7.5 11.5h.01", "M10.5 7.5h.01", "M15 8h.01"],
    plus: ["M12 5v14", "M5 12h14"],
    close: ["M18 6L6 18", "M6 6l12 12"],
    history: ["M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8", "M3 3v5h5", "M12 7v5l4 2"],
    lock: ["M5 11h14v10H5z", "M8 11V7a4 4 0 118 0v4"],
    refresh: ["M21 12a9 9 0 11-3-6.7L21 8", "M21 3v5h-5"],
    check: ["M20 6L9 17l-5-5"],
    trophy: ["M8 21h8", "M12 17v4", "M7 4h10v5a5 5 0 01-10 0V4z", "M17 5h3v2a3 3 0 01-3 3", "M7 5H4v2a3 3 0 003 3"]
  };

  // js/ui/controls.js
  var uid = 0;
  function segmented({ legend, name, options, value, onChange, hint }) {
    const gid = `seg-${++uid}`;
    const hintEl = hint ? h("p", { class: "field__hint", id: `${gid}-h` }, hint) : null;
    return h(
      "fieldset",
      { class: "field", "aria-describedby": hint ? `${gid}-h` : null },
      h("legend", { class: "field__label" }, legend),
      h(
        "div",
        { class: "seg" },
        options.map((o) => {
          const input = h("input", {
            type: "radio",
            name: name ?? gid,
            value: String(o.value),
            checked: o.value === value,
            onChange: () => onChange(o.value)
          });
          return h("label", { class: "seg__opt" }, input, h("span", null, o.label));
        })
      ),
      hintEl
    );
  }
  function toggle({ label, hint, checked, onChange, disabled }) {
    const gid = `tg-${++uid}`;
    const input = h("input", {
      type: "checkbox",
      role: "switch",
      id: gid,
      class: "switch__input",
      checked: !!checked,
      disabled: !!disabled,
      "aria-describedby": hint ? `${gid}-h` : null,
      onChange: (e) => onChange(e.target.checked)
    });
    return h(
      "div",
      { class: "row-switch" },
      h(
        "label",
        { class: "row-switch__text", for: gid },
        h("span", { class: "row-switch__label" }, label),
        hint ? h("span", { class: "field__hint", id: `${gid}-h` }, hint) : null
      ),
      h("span", { class: "switch" }, input, h("span", { class: "switch__track", "aria-hidden": "true" }))
    );
  }
  function textField({ label, value = "", placeholder = "", maxLength, name, autocomplete = "off", onInput, id }) {
    const gid = id ?? `tf-${++uid}`;
    const input = h("input", {
      class: "input",
      id: gid,
      name,
      type: "text",
      value,
      placeholder,
      maxlength: maxLength,
      autocomplete,
      autocapitalize: "sentences",
      spellcheck: "false",
      enterkeyhint: "next",
      onInput: (e) => onInput?.(e.target.value)
    });
    return { input, el: h("div", { class: "field" }, h("label", { class: "field__label", for: gid }, label), input) };
  }
  function palettePicker({ legend, value, onChange, hint, label }) {
    const gid = `pal-${++uid}`;
    return h(
      "fieldset",
      { class: "field", "aria-describedby": hint ? `${gid}-h` : null },
      legend ? h("legend", { class: "field__label" }, legend) : null,
      h(
        "div",
        { class: "swatches" },
        PALETTE_IDS.map((id) => {
          const input = h("input", { type: "radio", name: "palette", value: id, checked: id === value, onChange: () => onChange(id) });
          return h(
            "label",
            { class: "swatch", "data-swatch": id },
            input,
            h("span", { class: "swatch__dot", "aria-hidden": "true" }, icon(ICONS.check, 16)),
            h("span", { class: "swatch__name" }, label(id))
          );
        })
      ),
      hint ? h("p", { class: "field__hint", id: `${gid}-h` }, hint) : null
    );
  }

  // js/ui/modal.js
  var stack = [];
  var ignorePops = 0;
  var routeHandler = null;
  var uid2 = 0;
  var isModalOpen = () => stack.length > 0;
  var onRouteBack = (fn) => {
    routeHandler = fn;
  };
  function backAndWait() {
    return new Promise((resolve) => {
      ignorePops += 1;
      const done = () => {
        window.removeEventListener("popstate", done);
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        ignorePops = Math.max(0, ignorePops - 1);
        done();
      }, 400);
      window.addEventListener("popstate", done);
      history.back();
    });
  }
  window.addEventListener("popstate", () => {
    if (ignorePops > 0) {
      ignorePops -= 1;
      return;
    }
    if (stack.length) {
      stack[stack.length - 1].close("system-back", true);
      return;
    }
    routeHandler?.();
  });
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function openModal({ title, build, variant = "sheet", onClose }) {
    const id = `modal-${++uid2}`;
    const opener = document.activeElement;
    const app = document.getElementById("app");
    let closed = false;
    let resolveDone;
    const done = new Promise((r) => {
      resolveDone = r;
    });
    const titleEl = h("h2", { id: `${id}-title`, class: "sheet__title" }, title);
    const closeBtn = h("button", { class: "icon-btn", type: "button", "aria-label": t("common.close"), onClick: () => api.close("button") }, icon(ICONS.close));
    const grab = h("div", { class: "sheet__grab", "aria-hidden": "true" });
    const head = h("header", { class: "sheet__head" }, grab, titleEl, closeBtn);
    const body = h("div", { class: "sheet__body" });
    const sheet = h("div", {
      class: `sheet sheet--${variant}`,
      role: variant === "dialog" ? "alertdialog" : "dialog",
      "aria-modal": "true",
      "aria-labelledby": titleEl.id,
      tabindex: "-1"
    }, head, body);
    const overlay = h("div", { class: "overlay", onPointerdown: (e) => {
      if (e.target === overlay) api.close("backdrop");
    } }, sheet);
    if (variant === "sheet") {
      let startY = 0, dy = 0, dragging = false, startT = 0;
      head.addEventListener("pointerdown", (e) => {
        if (e.target.closest("button")) return;
        dragging = true;
        startY = e.clientY;
        dy = 0;
        startT = e.timeStamp;
        head.setPointerCapture(e.pointerId);
        sheet.style.transition = "none";
      });
      head.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        dy = Math.max(0, e.clientY - startY);
        sheet.style.transform = `translateY(${dy}px)`;
      });
      const release = (e) => {
        if (!dragging) return;
        dragging = false;
        sheet.style.transition = "";
        const v = dy / Math.max(1, e.timeStamp - startT);
        if (dy > 110 || dy > 30 && v > 0.6) api.close("swipe");
        else sheet.style.transform = "";
      };
      head.addEventListener("pointerup", release);
      head.addEventListener("pointercancel", release);
    }
    overlay.addEventListener("keydown", (e) => {
      if (stack[stack.length - 1] !== api) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        api.close("escape");
        return;
      }
      if (e.key !== "Tab") return;
      const items = [...sheet.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement);
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
    const api = {
      el: sheet,
      body,
      done,
      titleEl,
      /** fromPop: el navegador ya retiró la entrada del historial. */
      close(reason = "api", fromPop = false) {
        if (closed) return;
        closed = true;
        const i = stack.indexOf(api);
        if (i >= 0) stack.splice(i, 1);
        overlay.classList.add("is-closing");
        const finish = () => {
          overlay.remove();
          if (!stack.length) {
            app?.removeAttribute("inert");
            app?.removeAttribute("aria-hidden");
          }
          if (opener && opener.isConnected && typeof opener.focus === "function") opener.focus({ preventScroll: true });
          onClose?.(reason);
          resolveDone(reason);
        };
        const reduce = document.documentElement.dataset.motion === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce) finish();
        else setTimeout(finish, 180);
        if (!fromPop) {
          ignorePops += 1;
          history.back();
        }
      }
    };
    stack.push(api);
    history.pushState({ lz: "modal", id }, "");
    app?.setAttribute("inert", "");
    app?.setAttribute("aria-hidden", "true");
    document.body.append(overlay);
    build(body, api);
    const firstFocus = sheet.querySelector("[data-autofocus]") ?? sheet.querySelector(FOCUSABLE.replace("a[href],", "")) ?? sheet;
    (firstFocus === closeBtn ? sheet.querySelector(".sheet__body " + FOCUSABLE) ?? closeBtn : firstFocus).focus({ preventScroll: true });
    return api;
  }
  function confirmDialog({ title, message, confirmLabel, cancelLabel }) {
    return new Promise((resolve) => {
      let answer = false;
      const m = openModal({
        title,
        variant: "dialog",
        build(body, api) {
          body.append(
            h("p", { class: "dialog__msg" }, message),
            h(
              "div",
              { class: "dialog__actions" },
              h("button", { class: "btn btn--ghost", type: "button", "data-autofocus": "", onClick: () => api.close("cancel") }, cancelLabel ?? t("common.cancel")),
              h("button", { class: "btn btn--primary", type: "button", onClick: () => {
                answer = true;
                api.close("confirm");
              } }, confirmLabel ?? t("common.accept"))
            )
          );
        }
      });
      m.done.then(() => resolve(answer));
    });
  }

  // js/ui/store.js
  function openStore(ctx2) {
    return openModal({
      title: t("store.title"),
      build(body, api) {
        const msg = h("p", { class: "notice", role: "status", hidden: true });
        const buy = (product) => async () => {
          const r = await ctx2.entitlements.purchase(product.id);
          if (r.ok) {
            api.close("purchased");
            ctx2.rerender();
          } else {
            msg.hidden = false;
            msg.textContent = t("store.unavailable");
          }
        };
        body.append(
          h("p", null, t("store.body")),
          h(
            "button",
            { class: "btn btn--primary btn--block", type: "button", "data-autofocus": "", onClick: buy(PRODUCTS.premiumPacks) },
            t("store.buy", { price: formatPrice(PRODUCTS.premiumPacks.price) })
          ),
          h(
            "button",
            { class: "btn btn--ghost btn--block", type: "button", onClick: buy(PRODUCTS.removeAds) },
            `${t("store.removeAds")} \xB7 ${formatPrice(PRODUCTS.removeAds.price)}`
          ),
          h("button", { class: "btn btn--ghost btn--block", type: "button", onClick: async () => {
            const r = await ctx2.entitlements.restore();
            if (r.ok) {
              api.close("restored");
              ctx2.rerender();
            } else {
              msg.hidden = false;
              msg.textContent = t("store.unavailable");
            }
          } }, t("store.restore")),
          msg
        );
      }
    });
  }

  // js/ui/settings-panel.js
  function openSettings(ctx2) {
    return openModal({
      title: t("settings.title"),
      build(body, api) {
        const render = () => {
          clear(body);
          api.titleEl.textContent = t("settings.title");
          api.el.querySelector(".sheet__head .icon-btn")?.setAttribute("aria-label", t("common.close"));
          const S = ctx2.settings;
          const set = (k) => (v) => ctx2.setSetting(k, v);
          const section = (title, ...kids) => h("section", { class: "group" }, h("h3", { class: "group__title" }, title), ...kids);
          if (!ctx2.storage.persistent) add(body, h("p", { class: "notice", role: "note" }, t("settings.storageWarn")));
          add(
            body,
            section(
              t("settings.game"),
              segmented({
                legend: t("settings.difficulty"),
                name: "difficulty",
                value: S.difficulty,
                onChange: set("difficulty"),
                hint: t("settings.difficultyHint"),
                options: ["easy", "normal", "hard"].map((v) => ({ value: v, label: t(`settings.difficulty.${v}`) }))
              }),
              segmented({
                legend: t("settings.target"),
                name: "target",
                value: S.target,
                onChange: (v) => set("target")(Number(v)),
                options: [10, 15, 0].map((v) => ({ value: v, label: t(`settings.target.${v}`) }))
              }),
              toggle({ label: t("home.fair"), hint: t("home.fairHint"), checked: S.fairTurns, onChange: set("fairTurns") }),
              toggle({ label: t("settings.hints"), checked: S.hints, onChange: set("hints") })
            ),
            section(
              t("settings.look"),
              segmented({
                legend: t("settings.theme"),
                name: "theme",
                value: S.theme,
                onChange: set("theme"),
                options: ["light", "dark", "auto"].map((v) => ({ value: v, label: t(`settings.theme.${v}`) }))
              }),
              palettePicker({
                legend: t("settings.palette"),
                value: S.palette,
                onChange: set("palette"),
                hint: t("settings.paletteHint"),
                label: (id) => t(`settings.palette.${id}`)
              }),
              segmented({
                legend: t("settings.language"),
                name: "lang",
                value: S.lang,
                onChange: set("lang"),
                options: availableLangs().map((c) => ({ value: c, label: langName(c) }))
              }),
              toggle({ label: t("settings.reduceMotion"), checked: S.reduceMotion, onChange: set("reduceMotion") })
            ),
            section(
              t("settings.feedback"),
              toggle({ label: t("settings.sound"), checked: S.sound, onChange: (v) => {
                set("sound")(v);
                if (v) {
                  ctx2.feedback.unlock();
                  ctx2.feedback.sample();
                }
              } }),
              canVibrate() ? toggle({ label: t("settings.vibration"), checked: S.vibration, onChange: (v) => {
                set("vibration")(v);
                if (v) navigator.vibrate?.(30);
              } }) : null
            ),
            section(
              t("settings.legal"),
              toggle({ label: t("settings.analytics"), hint: t("settings.analyticsHint"), checked: S.analytics, onChange: set("analytics") }),
              h(
                "div",
                { class: "links" },
                h("a", { class: "link", href: "legal/privacy.html", target: "_blank", rel: "noopener" }, t("settings.privacy")),
                h("a", { class: "link", href: "legal/terms.html", target: "_blank", rel: "noopener" }, t("settings.terms"))
              )
            ),
            ctx2.entitlements.enabled ? section(
              t("home.premium"),
              h("button", { class: "btn btn--ghost", type: "button", onClick: () => openStore(ctx2) }, t("home.unlock")),
              h("button", { class: "btn btn--ghost", type: "button", onClick: async () => {
                await ctx2.entitlements.restore();
              } }, t("settings.restore"))
            ) : null,
            h("button", { class: "btn btn--ghost btn--block", type: "button", onClick: () => {
              ctx2.resetSettings();
              api.close("reset");
            } }, t("settings.reset"))
          );
        };
        render();
        const onChange = (key) => {
          if (key === "lang") {
            render();
            body.querySelector('input[name="lang"]:checked')?.focus();
          }
        };
        ctx2.listeners.add(onChange);
        api.done.then(() => ctx2.listeners.delete(onChange));
      }
    });
  }
  function openPalette(ctx2) {
    return openModal({
      title: t("settings.palette"),
      build(body) {
        add(body, palettePicker({
          value: ctx2.settings.palette,
          onChange: (v) => ctx2.setSetting("palette", v),
          hint: t("settings.paletteHint"),
          label: (id) => t(`settings.palette.${id}`)
        }));
      }
    });
  }

  // js/ui/dial.js
  var CX = 200;
  var CY = 232;
  var R = 170;
  var RING = 16;
  var TICK_STEP = 2.5;
  var MAJOR = 25;
  var deg = (v) => (v - 50) * 1.8;
  var polar = (v, r) => {
    const a = valueToAngle(v);
    return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
  };
  var f = (n) => n.toFixed(2);
  var TAU = Math.PI * 2;
  var uid3 = 0;
  function sector(from, to, r) {
    const [x1, y1] = polar(from, r), [x2, y2] = polar(to, r);
    return `M${CX} ${CY}L${f(x1)} ${f(y1)}A${r} ${r} 0 0 1 ${f(x2)} ${f(y2)}Z`;
  }
  function arc(from, to, r) {
    const [x1, y1] = polar(from, r), [x2, y2] = polar(to, r);
    return `M${f(x1)} ${f(y1)}A${r} ${r} 0 0 1 ${f(x2)} ${f(y2)}`;
  }
  var taper = (len, w0, w1) => `M${CX - w0} ${CY}L${CX - w1} ${CY - len}L${CX + w1} ${CY - len}L${CX + w0} ${CY}Z`;
  var reducedMotion = () => {
    try {
      return document.documentElement.dataset.motion === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  };
  function createDial({ onChange, onCommit, onStep } = {}) {
    const id = `d${++uid3}`;
    const halfDisc = (r) => `M${CX - r} ${CY}A${r} ${r} 0 0 1 ${CX + r} ${CY}Z`;
    const url = (n) => `url(#${id}-${n})`;
    const stop = (offset, cls) => s("stop", { offset, class: cls });
    const radial = (name, r, ...stops) => s("radialGradient", { id: `${id}-${name}`, gradientUnits: "userSpaceOnUse", cx: CX, cy: CY, r }, ...stops);
    const defs = s(
      "defs",
      null,
      s("clipPath", { id: `${id}-clip` }, s("path", { d: halfDisc(R) })),
      radial("face", R * 1.05, stop(0, "gs-face-0"), stop(0.62, "gs-face-1"), stop(1, "gs-face-2")),
      radial("shade", R, stop(0, "gs-shade-0"), stop(0.5, "gs-shade-1"), stop(1, "gs-shade-2")),
      s("linearGradient", { id: `${id}-ring`, x1: 0, y1: 0, x2: 1, y2: 1 }, stop(0, "gs-ring-0"), stop(0.55, "gs-ring-1"), stop(1, "gs-ring-2")),
      s("linearGradient", { id: `${id}-base`, x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, "gs-ring-0"), stop(1, "gs-ring-2")),
      s("linearGradient", { id: `${id}-gloss`, x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, "gs-gloss-0"), stop(1, "gs-gloss-1")),
      s("linearGradient", { id: `${id}-sheen`, x1: 0, y1: 0, x2: 1, y2: 0 }, stop(0, "gs-sheen-0"), stop(0.5, "gs-sheen-1"), stop(1, "gs-sheen-0")),
      s("radialGradient", { id: `${id}-hub`, cx: 0.35, cy: 0.3, r: 0.8 }, stop(0, "gs-ring-0"), stop(1, "gs-ring-2")),
      s("radialGradient", { id: `${id}-floor`, cx: 0.5, cy: 0.5, r: 0.5 }, stop(0, "gs-floor-0"), stop(1, "gs-floor-1"))
    );
    const zoneLayer = s("g", { class: "dial__zone" });
    const labelLayer = s("g", { class: "dial__zlabels" });
    const coverLayer = s("g", { class: "dial__cover" });
    const ghostLayer = s("g", { class: "dial__ghost" });
    const pinLayer = s("g", { class: "dial__pins" });
    const fxLayer = s("g", { class: "dial__fx" });
    const targetNeedle = s(
      "g",
      { class: "needle needle--target" },
      s("path", { class: "needle__body", d: taper(R * 0.66, 4.2, 1.6) }),
      s("path", { class: "needle__tip", d: `M${CX} ${CY - R * 0.74}l-8 15h16z` })
    );
    const guessNeedle = s(
      "g",
      { class: "needle needle--guess" },
      s("path", { class: "needle__body", d: taper(R - 16, 4.4, 1.3) }),
      s("circle", { class: "needle__ping", cx: CX, cy: CY - R + 12, r: 9 }),
      s("circle", { class: "needle__knob", cx: CX, cy: CY - R + 12, r: 9 }),
      s("circle", { class: "needle__eye", cx: CX, cy: CY - R + 12, r: 3.2 })
    );
    const ticks = s("g", { class: "dial__ticks" });
    const tickEls = [];
    for (let v = 0; v <= 100.001; v += TICK_STEP) {
      const major = Math.abs(v % MAJOR) < 1e-6 || Math.abs(v % MAJOR - MAJOR) < 1e-6;
      const [x1, y1] = polar(v, R - 1), [x2, y2] = polar(v, R - (major ? 14 : 7));
      const line = s("line", { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2), class: major ? "tick tick--major" : "tick" });
      tickEls.push(line);
      ticks.append(line);
    }
    const rings = s(
      "g",
      { class: "dial__rings" },
      s("path", { d: arc(0, 100, R * 0.78) }),
      s("path", { d: arc(0, 100, R * 0.56) }),
      s("path", { d: arc(0, 100, R * 0.34) })
    );
    const [g0x, g0y] = polar(9, R - 5), [g1x, g1y] = polar(91, R - 5);
    const gloss = s("path", {
      class: "dial__gloss",
      fill: url("gloss"),
      d: `M${f(g0x)} ${f(g0y)}A${R - 5} ${R - 5} 0 0 1 ${f(g1x)} ${f(g1y)}A${(R - 5) * 1.02} ${(R - 5) * 0.62} 0 0 0 ${f(g0x)} ${f(g0y)}Z`
    });
    const ringPath = `M${CX - R - RING} ${CY}A${R + RING} ${R + RING} 0 0 1 ${CX + R + RING} ${CY}L${CX + R} ${CY}A${R} ${R} 0 0 0 ${CX - R} ${CY}Z`;
    const bw = 2 * (R + RING + 6), bx = CX - R - RING - 6;
    const ringNotches = s("g", { class: "dial__notches" });
    [0, 25, 50, 75, 100].forEach((v) => {
      const [x, y] = polar(v, R + RING / 2);
      ringNotches.append(s("circle", { cx: f(x), cy: f(y), r: v === 50 ? 2.6 : 1.8 }));
    });
    const svg = s(
      "svg",
      { class: "dial__svg", viewBox: "2 -14 396 276", "aria-hidden": "true", focusable: "false" },
      defs,
      s("ellipse", { class: "dial__floor", cx: CX, cy: CY + 26, rx: R + RING + 18, ry: 22, fill: url("floor") }),
      s("path", { class: "dial__face", d: halfDisc(R), fill: url("face") }),
      s("g", { "clip-path": url("clip") }, rings, zoneLayer, s("path", { class: "dial__shade", d: halfDisc(R), fill: url("shade") }), gloss),
      ticks,
      coverLayer,
      ghostLayer,
      // Aro exterior y base: se dibujan ENCIMA de la zona y tapan lo que sobresale en los extremos.
      s("path", { class: "dial__ring", d: ringPath, fill: url("ring") }),
      s("path", { class: "dial__groove", d: arc(0, 100, R + 1.5) }),
      ringNotches,
      s("rect", { class: "dial__base", x: bx, y: CY - 1, width: bw, height: 24, rx: 7, fill: url("base") }),
      s("circle", { class: "dial__screw", cx: bx + 14, cy: CY + 11, r: 3.4 }),
      s("circle", { class: "dial__screw", cx: bx + bw - 14, cy: CY + 11, r: 3.4 }),
      pinLayer,
      targetNeedle,
      guessNeedle,
      labelLayer,
      fxLayer,
      s("circle", { class: "dial__hub", cx: CX, cy: CY, r: 15, fill: url("hub") }),
      s("circle", { class: "dial__hub2", cx: CX, cy: CY, r: 8.5 }),
      s("circle", { class: "dial__hub3", cx: CX, cy: CY, r: 3.2 })
    );
    const el = h("div", { class: "dial" }, svg);
    let mode = "cover";
    let guess = 50;
    let shown = 50;
    let vel = 0;
    let raf = 0, last = 0;
    let dragging = false;
    let litIdx = -1;
    function lightTicks(v) {
      const idx = mode === "guess" || mode === "demo" || mode === "reveal" ? Math.round(clamp(v) / TICK_STEP) : -1;
      if (idx === litIdx) return;
      tickEls.forEach((t2, i) => {
        const d = litIdx < 0 ? 9 : Math.abs(i - litIdx);
        if (d <= 2) t2.classList.remove("is-lit", "is-lit-s");
      });
      litIdx = idx;
      if (idx < 0) return;
      tickEls[idx]?.classList.add("is-lit");
      tickEls[idx - 1]?.classList.add("is-lit-s");
      tickEls[idx + 1]?.classList.add("is-lit-s");
    }
    function paint(v) {
      guessNeedle.style.transform = `rotate(${deg(clamp(v, -1.5, 101.5))}deg)`;
      lightTicks(v);
    }
    function step(ts) {
      const dt = Math.min(0.032, Math.max(1e-3, (ts - (last || ts - 16)) / 1e3));
      last = ts;
      const K = 380, C = 28;
      vel += (K * (guess - shown) - C * vel) * dt;
      shown += vel * dt;
      if (Math.abs(guess - shown) < 0.015 && Math.abs(vel) < 0.08) {
        shown = guess;
        vel = 0;
        raf = 0;
        last = 0;
        paint(shown);
        return;
      }
      paint(shown);
      raf = requestAnimationFrame(step);
    }
    function follow() {
      if (reducedMotion()) {
        shown = guess;
        vel = 0;
        paint(shown);
        return;
      }
      if (!raf) raf = requestAnimationFrame(step);
    }
    function snap() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      shown = guess;
      vel = 0;
      paint(shown);
    }
    function setGuess(v, silent = false) {
      guess = clamp(v);
      if (mode === "guess") el.setAttribute("aria-valuenow", String(round1(guess)));
      follow();
      if (!silent) onChange?.(guess);
    }
    function fromPointer(e) {
      const m = svg.getScreenCTM();
      if (!m) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      setGuess(pointerToValue(p.x - CX, p.y - CY));
    }
    svg.addEventListener("pointerdown", (e) => {
      if (mode !== "guess" && mode !== "demo" || e.pointerType === "mouse" && e.button !== 0) return;
      dragging = true;
      try {
        svg.setPointerCapture(e.pointerId);
      } catch {
      }
      el.classList.add("is-dragging", "has-moved");
      el.focus({ preventScroll: true });
      fromPointer(e);
      e.preventDefault();
    });
    svg.addEventListener("pointermove", (e) => {
      if (dragging) fromPointer(e);
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove("is-dragging");
      try {
        svg.releasePointerCapture(e.pointerId);
      } catch {
      }
    };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
    svg.addEventListener("lostpointercapture", end);
    el.addEventListener("keydown", (e) => {
      if (mode !== "guess") return;
      const stepBy = (e.shiftKey ? 4 : 1) * 1.5;
      const dir = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
      if (dir) {
        e.preventDefault();
        el.classList.add("has-moved");
        onStep?.(dir * stepBy);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onCommit?.();
      }
    });
    function drawPin(v, cls, extra = "") {
      const [x, y] = polar(v, R + RING / 2);
      return s(
        "g",
        { class: `pin ${cls}${extra}` },
        s("circle", { class: "pin__halo", cx: f(x), cy: f(y), r: 14 }),
        s("circle", { class: "pin__dot", cx: f(x), cy: f(y), r: 8 })
      );
    }
    function drawTag(v, row, cls, text) {
      const [px, py] = polar(v, R + RING + 2);
      const w = Math.max(70, text.length * 7.6 + 18);
      const x = clamp(polar(v, R)[0], 2 + w / 2 + 2, 398 - w / 2 - 2);
      const y = row === 0 ? 2 : 26;
      return s(
        "g",
        { class: `tag ${cls}` },
        s("line", { x1: f(x), y1: y + 10, x2: f(px), y2: f(py), class: "tag__leader" }),
        s("rect", { x: f(x - w / 2), y: y - 10, width: f(w), height: 20, rx: 10 }),
        s("text", { x: f(x), y: y + 4.5, "text-anchor": "middle" }, text)
      );
    }
    function burst(v) {
      const [x, y] = polar(v, R + RING / 2);
      const g = s("g", { class: "burst" });
      const N = 16;
      for (let i = 0; i < N; i++) {
        const a = i / N * TAU + (i % 2 ? 0.2 : 0);
        const dist = 34 + i % 3 * 14;
        const dot = s("circle", { class: `burst__dot b${i % 4}`, cx: f(x), cy: f(y), r: i % 3 === 0 ? 3.2 : 2.2 });
        dot.style.setProperty("--dx", `${f(Math.cos(a) * dist)}px`);
        dot.style.setProperty("--dy", `${f(Math.sin(a) * dist)}px`);
        g.append(dot);
      }
      g.append(s("circle", { class: "burst__ring", cx: f(x), cy: f(y), r: 10 }));
      return g;
    }
    function dropCover() {
      clear(ghostLayer);
      if (!coverLayer.firstChild || reducedMotion()) return;
      while (coverLayer.firstChild) ghostLayer.append(coverLayer.firstChild);
      ghostLayer.classList.add("is-leaving");
      setTimeout(() => {
        clear(ghostLayer);
        ghostLayer.classList.remove("is-leaving");
      }, 520);
    }
    function render(nextMode, d = {}) {
      const prev = mode;
      mode = nextMode;
      const L = d.labels ?? {};
      const entering = prev !== mode;
      el.dataset.mode = mode;
      if (prev === "cover" && mode !== "cover") dropCover();
      else clear(ghostLayer);
      [zoneLayer, labelLayer, coverLayer, pinLayer, fxLayer].forEach(clear);
      el.classList.remove("is-dragging", "is-animated", "is-revealing", "is-win", "is-miss");
      dragging = false;
      litIdx = -1;
      tickEls.forEach((t2) => t2.classList.remove("is-lit", "is-lit-s"));
      ["aria-valuemin", "aria-valuemax", "aria-valuenow", "aria-valuetext", "aria-orientation"].forEach((a) => el.removeAttribute(a));
      if (mode === "guess") {
        el.setAttribute("role", "slider");
        el.setAttribute("tabindex", "0");
        el.setAttribute("aria-label", L.slider ?? "");
        el.setAttribute("aria-valuemin", "0");
        el.setAttribute("aria-valuemax", "100");
        el.setAttribute("aria-valuenow", String(round1(d.guess ?? 50)));
      } else {
        el.setAttribute("role", "img");
        el.removeAttribute("tabindex");
        el.setAttribute("aria-label", mode === "cover" ? L.covered ?? "" : L.dial ?? "");
      }
      targetNeedle.style.display = mode === "psychic" || mode === "reveal" ? "" : "none";
      if (mode !== "psychic" && mode !== "reveal") targetNeedle.style.transform = "";
      guessNeedle.style.display = mode === "guess" || mode === "reveal" || mode === "demo" ? "" : "none";
      if (mode === "guess" || mode === "demo") {
        guess = d.guess ?? 50;
        snap();
        el.classList.remove("has-moved");
      } else if (mode === "reveal") {
        guess = d.guess;
        if (prev !== "guess") snap();
        else follow();
      } else snap();
      if (mode === "reveal") el.setAttribute("aria-valuenow", String(round1(d.guess)));
      if (mode === "cover") {
        const [h0x, h0y] = polar(0, R), [h1x, h1y] = polar(100, R);
        const spokes = s("g", { class: "cover__spokes" });
        for (let v = 5; v < 100; v += 5) {
          const [x1, y1] = polar(v, R * 0.3), [x2, y2] = polar(v, R * 0.97);
          spokes.append(s("line", { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2) }));
        }
        coverLayer.append(
          s("path", { class: "cover", d: halfDisc(R) }),
          s(
            "g",
            { "clip-path": url("clip") },
            spokes,
            s("rect", { class: "cover__sheen", x: CX - R - 120, y: CY - R - 10, width: 70, height: R + 20, fill: url("sheen"), transform: "skewX(-18)" })
          ),
          s("path", { class: "cover__arc", d: arc(0, 100, R * 0.82) }),
          s("path", { class: "cover__arc", d: arc(0, 100, R * 0.5) }),
          s("circle", { class: "cover__disc", cx: CX, cy: CY - 62, r: 46 }),
          s("text", { class: "cover__q", x: CX, y: CY - 36, "text-anchor": "middle" }, "?")
        );
        void h0x;
        void h0y;
        void h1x;
        void h1y;
        if (entering && prev !== null) coverLayer.classList.add("is-in");
      }
      if (mode === "psychic" || mode === "reveal" || mode === "demo") {
        const bands = zoneBands(d.target, d.w);
        const revealing = mode === "reveal" && !!d.animate;
        const animate = revealing || mode === "psychic" && entering;
        const outcome = mode === "reveal" ? scoreGuess(d.guess, d.target, d.w) : null;
        const hit = outcome && outcome.points > 0 ? bands.findIndex((b) => d.guess >= b.from && d.guess <= b.to) : -1;
        const order = [0, 1, 2, 1, 0];
        bands.forEach((b, i) => {
          const p = s("path", { class: `zone z${b.points}${i === hit ? " is-hit" : ""}`, d: sector(b.from, b.to, R) });
          p.style.setProperty("--i", String(order[i]));
          zoneLayer.append(p);
        });
        bands.forEach((b, i) => {
          const [x, y] = polar(b.labelAt, R * 0.8);
          const arcLen = 2 * d.w * (Math.PI / 100) * R * 0.8;
          const t2 = s("text", {
            class: `zlabel${i === hit ? " is-hit" : ""}`,
            x: f(x),
            y: f(y + 5),
            "text-anchor": "middle",
            "font-size": f(clamp(arcLen * 0.85, 9, 16))
          }, String(b.points));
          t2.style.setProperty("--i", String(order[i]));
          labelLayer.append(t2);
        });
        if (revealing) {
          targetNeedle.style.transition = "none";
          targetNeedle.style.transform = `rotate(${deg(d.guess)}deg)`;
          void targetNeedle.getBoundingClientRect();
          targetNeedle.style.transition = "";
        }
        if (mode === "demo") targetNeedle.style.display = "none";
        else targetNeedle.style.transform = `rotate(${deg(d.target)}deg)`;
        if (animate) el.classList.add("is-animated");
        if (revealing) {
          el.classList.add("is-revealing");
          if (outcome.points === 4) el.classList.add("is-win");
          if (outcome.points === 0) el.classList.add("is-miss");
          el.dataset.points = String(outcome.points);
          if (outcome.points === 4) fxLayer.append(burst(d.target));
        }
      }
      if (mode === "psychic") pinLayer.append(drawPin(d.target, "pin--target", " pin--pulse"));
      if (mode === "reveal") {
        pinLayer.append(
          drawPin(d.target, "pin--target"),
          drawPin(d.guess, "pin--guess"),
          drawTag(d.target, 0, "tag--target", L.target ?? ""),
          drawTag(d.guess, 1, "tag--guess", L.answer ?? "")
        );
      }
    }
    return { el, render, setGuess, focus: () => el.focus({ preventScroll: true }), get guess() {
      return guess;
    } };
  }

  // js/ui/tutorial.js
  var DEMO = { target: 62, w: 2.5 };
  function demoDial(mode, extra = {}) {
    const dial = createDial({});
    dial.render(mode, { ...DEMO, guess: 50, labels: { dial: t("tut.demoLabel") }, ...extra });
    return dial;
  }
  function openTutorial(ctx2, { onDone } = {}) {
    let step = 1;
    const total = 3;
    return openModal({
      title: t("home.howTo"),
      onClose: () => {
        if (!ctx2.settings.onboarded) ctx2.setSetting("onboarded", true);
        onDone?.();
      },
      build(body, api) {
        const render = () => {
          clear(body);
          const stage = h("div", { class: "tut__stage" });
          if (step === 1) stage.append(demoDial("psychic").el);
          if (step === 2) {
            const d = demoDial("cover");
            stage.append(d.el, h("p", { class: "tut__bubble", role: "note" }, t("tut.2.example")));
          }
          if (step === 3) {
            const d = demoDial("demo", { labels: { dial: t("tut.demoLabel") } });
            stage.append(d.el);
          }
          const last = step === total;
          body.append(
            h("p", { class: "tut__step" }, t("tut.step", { n: step, total })),
            stage,
            h("h3", { class: "tut__title" }, t(`tut.${step}.title`)),
            h("p", { class: "tut__body" }, t(`tut.${step}.body`)),
            h("div", { class: "dots", "aria-hidden": "true" }, [1, 2, 3].map((n) => h("span", { class: n === step ? "dot is-on" : "dot" }))),
            h(
              "div",
              { class: "dialog__actions" },
              last || step > 1 ? h("button", { class: "btn btn--ghost", type: "button", onClick: () => {
                step -= 1;
                render();
              } }, t("common.back")) : h("button", { class: "btn btn--ghost", type: "button", onClick: () => api.close("skip") }, t("tut.skip")),
              h("button", {
                class: "btn btn--primary",
                type: "button",
                "data-autofocus": "",
                onClick: () => {
                  if (last) api.close("done");
                  else {
                    step += 1;
                    render();
                  }
                }
              }, last ? t("tut.done") : t("common.next"))
            )
          );
          body.querySelector("[data-autofocus]")?.focus({ preventScroll: true });
        };
        render();
      }
    });
  }
  function openHowTo(ctx2) {
    return openModal({
      title: t("howto.title"),
      build(body, api) {
        body.append(
          h("ol", { class: "howto" }, [1, 2, 3, 4, 5, 6, 7].map((n) => h("li", null, t(`howto.${n}`)))),
          h("button", {
            class: "btn btn--ghost btn--block",
            type: "button",
            onClick: () => {
              api.close("replay");
              api.done.then(() => openTutorial(ctx2));
            }
          }, t("howto.replay"))
        );
      }
    });
  }

  // js/ui/home.js
  var form = null;
  var resetHomeForm = () => {
    form = null;
  };
  var freshForm = () => ({
    players: ["", ""],
    mode: "packs",
    packs: /* @__PURE__ */ new Set(),
    left: "",
    right: ""
  });
  function brandMark(size = 44) {
    const arc2 = (a, b, r) => {
      const p = (ang) => [24 + r * Math.cos(ang), 40 - r * Math.sin(ang)];
      const [x1, y1] = p(a), [x2, y2] = p(b);
      return `M24 40L${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}Z`;
    };
    const d = Math.PI / 180;
    return s(
      "svg",
      { class: "brand__mark", viewBox: "0 0 48 48", width: size, height: size, "aria-hidden": "true" },
      s("path", { d: "M3 40a21 21 0 0142 0z", class: "mark-face" }),
      s("path", { d: arc2(122 * d, 106 * d, 19), class: "z2" }),
      s("path", { d: arc2(106 * d, 90 * d, 19), class: "z3" }),
      s("path", { d: arc2(90 * d, 74 * d, 19), class: "z4" }),
      s("path", { d: arc2(74 * d, 58 * d, 19), class: "z3" }),
      s("path", { d: "M24 40L24 18", class: "mark-needle" }),
      s("circle", { cx: 24, cy: 40, r: 3, class: "mark-hub" })
    );
  }
  function renderHome(ctx2, root2) {
    form ?? (form = freshForm());
    const f2 = form;
    clear(root2);
    const err = h("p", { class: "form__error", role: "alert", hidden: true });
    const showError = (msg, focusEl) => {
      err.hidden = false;
      err.textContent = msg;
      announce(msg);
      focusEl?.focus();
    };
    const playersBox = h("div", { class: "players" });
    const addBtn = h(
      "button",
      { class: "btn btn--ghost btn--small", type: "button", onClick: () => {
        f2.players.push("");
        drawPlayers(f2.players.length - 1);
      } },
      icon(ICONS.plus, 18),
      t("home.addPlayer")
    );
    function drawPlayers(focusIdx) {
      clear(playersBox);
      f2.players.forEach((val, i) => {
        const tf = textField({
          label: t("home.playerField", { n: i + 1 }),
          value: val,
          placeholder: t("home.player", { n: i + 1 }),
          maxLength: LIMITS.player,
          onInput: (v) => {
            f2.players[i] = v;
          }
        });
        const row = h("div", { class: "players__row" }, tf.el);
        if (f2.players.length > 2) {
          const name = val || t("home.player", { n: i + 1 });
          row.append(h("button", {
            class: "icon-btn",
            type: "button",
            "aria-label": t("home.removePlayer", { name }),
            onClick: () => {
              f2.players.splice(i, 1);
              drawPlayers(Math.max(0, i - 1));
            }
          }, icon(ICONS.close)));
        }
        playersBox.append(row);
        if (i === focusIdx) setTimeout(() => tf.input.focus(), 0);
      });
      addBtn.hidden = f2.players.length >= LIMITS.maxPlayers;
    }
    const catBox = h("div", { class: "cat" });
    let leftField, rightField;
    function drawCategory() {
      clear(catBox);
      const tabs = h(
        "div",
        { class: "tabs", role: "tablist", "aria-label": t("home.category") },
        ["packs", "custom"].map((m) => h(
          "button",
          {
            class: "tab",
            type: "button",
            role: "tab",
            "aria-selected": String(f2.mode === m),
            tabindex: f2.mode === m ? "0" : "-1",
            onClick: () => {
              f2.mode = m;
              drawCategory();
            },
            onKeydown: (e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                f2.mode = f2.mode === "packs" ? "custom" : "packs";
                drawCategory();
                catBox.querySelector('[aria-selected="true"]').focus();
              }
            }
          },
          t(m === "packs" ? "home.packs" : "home.custom")
        ))
      );
      catBox.append(tabs);
      if (f2.mode === "packs") {
        const list = h("div", { class: "packs", role: "group", "aria-label": t("home.packs") });
        for (const p of listPacks()) {
          const locked = !ctx2.entitlements.hasPack(p);
          const on = f2.packs.has(p.id) && !locked;
          const input = h("input", {
            type: "checkbox",
            class: "pack__input",
            checked: on,
            onChange: async (e) => {
              if (locked) {
                e.target.checked = false;
                openStore(ctx2);
                return;
              }
              if (e.target.checked && p.adult && !ctx2.settings.adultPack) {
                const ok = await confirmDialog({ title: t(`packs.${p.id}`), message: t("packs.ageGate"), confirmLabel: t("packs.ageYes") });
                if (!ok) {
                  e.target.checked = false;
                  return;
                }
                ctx2.setSetting("adultPack", true);
              }
              e.target.checked ? f2.packs.add(p.id) : f2.packs.delete(p.id);
            }
          });
          list.append(h(
            "label",
            { class: `pack${locked ? " is-locked" : ""}` },
            input,
            h(
              "span",
              { class: "pack__body" },
              h("span", { class: "pack__name" }, t(`packs.${p.id}`), p.age >= 12 ? h("span", { class: "pack__age" }, `${p.age}+`) : null),
              h("span", { class: "pack__count" }, tn("home.packCount", p.pairs.length))
            ),
            locked ? h("span", { class: "pack__lock" }, icon(ICONS.lock, 16), h("span", { class: "sr-only" }, t("home.premium"))) : null
          ));
        }
        catBox.append(list);
      } else {
        leftField = textField({ label: t("home.leftEnd"), value: f2.left, placeholder: t("home.leftPh"), maxLength: LIMITS.extreme, onInput: (v) => {
          f2.left = v;
        } });
        rightField = textField({ label: t("home.rightEnd"), value: f2.right, placeholder: t("home.rightPh"), maxLength: LIMITS.extreme, onInput: (v) => {
          f2.right = v;
        } });
        catBox.append(h("div", { class: "ends" }, leftField.el, rightField.el), h("p", { class: "field__hint" }, t("home.customNote")));
      }
    }
    function start(e) {
      e.preventDefault();
      err.hidden = true;
      if (f2.mode === "custom") {
        const cat = sanitizeCategory(f2.left, f2.right);
        if (!cat) {
          const empty = !sanitizeCategory(f2.left, "x") ? leftField.input : rightField.input;
          return showError(t("home.missingEnd"), empty);
        }
        return ctx2.startGame({ names: f2.players, source: { mode: "custom", category: cat } });
      }
      const ids = [...f2.packs].filter((id) => ctx2.entitlements.hasPack(listPacks().find((p) => p.id === id)));
      if (!ids.length) return showError(t("home.noPacks"), catBox.querySelector("input"));
      ctx2.startGame({ names: f2.players, source: { mode: "packs", packIds: ids } });
    }
    drawPlayers();
    drawCategory();
    root2.append(h(
      "main",
      { class: "screen screen--home" },
      h(
        "header",
        { class: "topbar" },
        h(
          "div",
          { class: "brand" },
          brandMark(),
          h("div", null, h("h1", { class: "brand__name" }, t("app.name")), h("p", { class: "brand__tag" }, t("app.tagline")))
        ),
        h(
          "div",
          { class: "topbar__actions" },
          h("button", { class: "icon-btn", type: "button", "aria-label": t("aria.palette"), onClick: () => openPalette(ctx2) }, icon(ICONS.palette)),
          h("button", { class: "icon-btn", type: "button", "aria-label": t("home.howTo"), onClick: () => openHowTo(ctx2) }, icon(ICONS.help)),
          h("button", { class: "icon-btn", type: "button", "aria-label": t("aria.settings"), onClick: () => openSettings(ctx2) }, icon(ICONS.gear))
        )
      ),
      h(
        "form",
        { class: "form", novalidate: true, onSubmit: start },
        h("h2", { class: "section-title" }, t("home.title")),
        h(
          "section",
          { class: "card", "aria-labelledby": "players-h" },
          h("h3", { class: "card__title", id: "players-h" }, t("home.players")),
          playersBox,
          addBtn,
          h("p", { class: "field__hint" }, t("home.playersHint"))
        ),
        h(
          "section",
          { class: "card", "aria-labelledby": "cat-h" },
          h("h3", { class: "card__title", id: "cat-h" }, t("home.category")),
          catBox
        ),
        h(
          "div",
          { class: "card card--flat" },
          toggle({ label: t("home.fair"), hint: t("home.fairHint"), checked: ctx2.settings.fairTurns, onChange: (v) => ctx2.setSetting("fairTurns", v, { silent: true }) })
        ),
        err,
        h("button", { class: "btn btn--primary btn--block btn--big", type: "submit" }, t("home.start")),
        ctx2.canInstall() ? h("button", { class: "btn btn--ghost btn--block", type: "button", onClick: () => ctx2.install() }, t("pwa.install")) : null
      )
    ));
  }

  // js/ui/summary.js
  var fmt = (n) => formatNumber(n, { maximumFractionDigits: 1 });
  function roundsTable(state) {
    const { history: history2, players } = state;
    return h(
      "div",
      { class: "table-wrap" },
      h(
        "table",
        { class: "table" },
        h("caption", { class: "sr-only" }, t("summary.perRound")),
        h("thead", null, h(
          "tr",
          null,
          ["summary.colRound", "summary.colGuesser", "summary.colCategory", "summary.colPoints"].map((k) => h("th", { scope: "col" }, t(k)))
        )),
        h("tbody", null, history2.map((r) => h(
          "tr",
          null,
          h("th", { scope: "row" }, String(r.round)),
          h("td", null, players[r.guesser]),
          h("td", { class: "td-cat" }, r.category ? `${r.category.left} \u2194 ${r.category.right}` : "\u2014"),
          h("td", null, h("span", { class: `pts pts--${r.points}` }, h("span", { class: "pts__bar", style: { width: `${r.points / 4 * 100}%` } }), h("span", { class: "pts__n" }, String(r.points))))
        )))
      )
    );
  }
  function openHistory(ctx2) {
    const st = ctx2.game.state;
    return openModal({
      title: t("history.title"),
      build(body) {
        add(body, st.history.length ? roundsTable(st) : h("p", { class: "empty" }, t("history.empty")));
      }
    });
  }
  function openSummary(ctx2) {
    const st = ctx2.game.state;
    const sum = summarize(st.history, st.players.length);
    const max = Math.max(...st.scores);
    const leaders = st.scores.map((v, i) => v === max ? i : -1).filter((i) => i >= 0);
    return openModal({
      title: t("summary.title"),
      build(body, api) {
        add(
          body,
          st.finished ? h("p", { class: "summary__winner" }, icon(ICONS.trophy, 22), t("game.wins", { name: st.players[st.winner] })) : null,
          h(
            "dl",
            { class: "stats" },
            h("div", { class: "stat" }, h("dt", null, t("summary.rounds")), h("dd", null, String(st.history.length))),
            h(
              "div",
              { class: "stat" },
              h("dt", null, t("summary.best")),
              h("dd", null, sum.best ? t("summary.bestValue", { round: sum.best.round, name: st.players[sum.best.guesser], points: sum.best.points }) : "\u2014")
            ),
            h("div", { class: "stat" }, h("dt", null, t("summary.avg")), h("dd", null, t("summary.avgValue", { n: fmt(sum.avgDistance) })))
          ),
          h("h3", { class: "group__title" }, t("summary.perPlayer")),
          h("ul", { class: "plist" }, st.players.map((name, i) => h(
            "li",
            { class: `plist__row${leaders.includes(i) ? " is-lead" : ""}` },
            h("span", { class: "plist__name" }, name),
            h("span", { class: "plist__meta" }, `${t("summary.bullseyes")}: ${sum.perPlayer[i].bullseyes} \xB7 ${t("summary.avgValue", { n: fmt(sum.perPlayer[i].avgDistance) })}`),
            h("strong", { class: "plist__pts" }, String(st.scores[i]))
          ))),
          h("h3", { class: "group__title" }, t("summary.perRound")),
          st.history.length ? roundsTable(st) : h("p", { class: "empty" }, t("history.empty")),
          h("button", { class: "btn btn--ghost btn--block", type: "button", onClick: () => api.close("ok") }, t("common.close"))
        );
      }
    });
  }

  // js/ui/game-view.js
  function mountGame(ctx2, root2) {
    const g = ctx2.game;
    let lastKey = "";
    let lastPhase = null;
    const guard = (fn) => () => {
      const key = `${g.state.phase}:${g.state.round}`;
      if (key === lastKey) return;
      lastKey = key;
      ctx2.feedback.unlock();
      fn();
    };
    const dial = createDial({
      onStep: (d) => {
        g.nudge(d);
        dial.setGuess(g.state.guess, true);
        ctx2.feedback.tick();
      },
      onChange: (v) => {
        g.setGuess(v);
      },
      onCommit: guard(() => lock())
    });
    const scoreboard = h("div", { class: "scoreboard", role: "group", "aria-label": t("aria.score") });
    const roundChip = h("span", { class: "chip" });
    const title = h("h2", { class: "stage__title", tabindex: "-1" });
    const sub = h("p", { class: "stage__sub" });
    const endL = h("span", { class: "end end--l" });
    const endR = h("span", { class: "end end--r" });
    const verdictBox = h("div", { class: "verdict", hidden: true });
    const legend = h("p", { class: "legend", hidden: true });
    const mainBtn = h("button", { class: "btn btn--primary btn--block btn--big", type: "button" });
    const secBtn = h("button", { class: "btn btn--ghost btn--block", type: "button" });
    const altBtn = h("button", { class: "btn btn--ghost btn--block", type: "button" });
    const hint = h("p", { class: "hint" });
    root2.append(h(
      "main",
      { class: "screen screen--game" },
      h(
        "header",
        { class: "gamebar" },
        h("button", { class: "icon-btn", type: "button", "aria-label": t("game.back"), onClick: () => ctx2.exitGame() }, icon(ICONS.back)),
        h("div", { class: "gamebar__center" }, h("span", { class: "gamebar__name" }, t("app.name")), roundChip),
        h(
          "div",
          { class: "topbar__actions" },
          h("button", { class: "icon-btn", type: "button", "aria-label": t("game.history"), onClick: () => openHistory(ctx2) }, icon(ICONS.history)),
          h("button", { class: "icon-btn", type: "button", "aria-label": t("aria.settings"), onClick: () => openSettings(ctx2) }, icon(ICONS.gear))
        )
      ),
      scoreboard,
      h(
        "section",
        { class: "stage" },
        title,
        sub,
        dial.el,
        h("div", { class: "ends" }, endL, endR),
        legend,
        verdictBox
      ),
      h("div", { class: "actions" }, mainBtn, secBtn, altBtn, hint)
    ));
    mainBtn.addEventListener("click", guard(() => primary()));
    function primary() {
      const { phase, finished } = g.state;
      if (phase === "wait") g.showPsychic();
      else if (phase === "psychic") g.hidePsychic();
      else if (phase === "guess") return lock();
      else if (phase === "reveal") return finished ? ctx2.rematch() : ctx2.nextRound();
      update();
    }
    function lock() {
      const r = g.lock({ target: ctx2.settings.target, fairTurns: ctx2.settings.fairTurns });
      if (!r) return;
      const st = g.state;
      const calm = document.documentElement.dataset.motion === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (calm) ctx2.feedback.reveal(r.points, st.finished);
      else setTimeout(() => ctx2.feedback.reveal(r.points, st.finished), 1100);
      ctx2.analytics.track("round_end", { points: r.points, round: st.round });
      if (st.finished) ctx2.analytics.track("game_end", { rounds: st.round });
      update(true);
      const name = st.players[st.guesser];
      announce(`${t(`game.verdict.${r.verdict}`)} ${r.points ? t("game.sums", { name, n: r.points }) : t("game.sumsNone", { name })}${st.finished ? `. ${t("game.wins", { name: st.players[st.winner] })}` : ""}`);
    }
    function onKey(e) {
      if (isModalOpen() || g.state.phase !== "guess") return;
      if (document.activeElement !== document.body && document.activeElement !== dial.el) return;
      const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"];
      if (!keys.includes(e.key) || e.defaultPrevented) return;
      dial.focus();
      dial.el.dispatchEvent(new KeyboardEvent("keydown", { key: e.key, shiftKey: e.shiftKey, bubbles: true, cancelable: true }));
      e.preventDefault();
    }
    document.addEventListener("keydown", onKey);
    function drawScores() {
      const st = g.state;
      clear(scoreboard);
      scoreboard.dataset.count = String(st.players.length);
      st.players.forEach((name, i) => {
        const role = st.phase === "setup" ? "" : i === st.psychic ? t("game.psychic") : i === st.guesser ? t("game.guesser") : t("game.waiting");
        const active = st.phase === "wait" || st.phase === "psychic" ? i === st.psychic : i === st.guesser;
        scoreboard.append(h(
          "div",
          {
            class: `score${active ? " is-active" : ""}${i === st.psychic ? " is-psychic" : ""}`,
            "aria-label": t("game.score", { name, n: st.scores[i], role }),
            role: "group"
          },
          h("span", { class: "score__name" }, name),
          h("span", { class: "score__role" }, role),
          h("strong", { class: "score__pts", "aria-hidden": "true" }, String(st.scores[i]))
        ));
      });
    }
    function update(animate = false) {
      const st = g.state;
      const psy = st.players[st.psychic], gue = st.players[st.guesser];
      const cat = st.category ?? { left: "", right: "" };
      const labels = {
        covered: t("game.covered"),
        dial: t("game.dialLabel", { left: cat.left, right: cat.right }),
        slider: t("game.sliderLabel", { left: cat.left, right: cat.right }),
        target: t("game.target"),
        answer: t("game.yourAnswer")
      };
      root2.dataset.phase = st.phase;
      root2.classList.toggle("is-revealing", animate && st.phase === "reveal");
      roundChip.textContent = t("game.round", { n: st.round });
      endL.textContent = cat.left;
      endR.textContent = cat.right;
      drawScores();
      verdictBox.hidden = st.phase !== "reveal";
      legend.hidden = st.phase !== "reveal";
      secBtn.hidden = true;
      altBtn.hidden = true;
      clear(verdictBox);
      let hintText = "";
      if (st.phase === "wait") {
        title.textContent = t("game.turnOf", { name: psy });
        sub.textContent = t("game.lookAway", { name: gue });
        mainBtn.textContent = t("game.iAm", { name: psy });
        dial.render("cover", { labels });
        if (ctx2.canChangeCategory()) {
          altBtn.hidden = false;
          altBtn.textContent = t("game.anotherCategory");
          altBtn.onclick = () => ctx2.anotherCategory();
        }
      } else if (st.phase === "psychic") {
        title.textContent = t("game.memorize");
        sub.textContent = psy;
        mainBtn.textContent = t("game.hideAndPass", { name: gue });
        dial.render("psychic", { target: st.target, w: st.w, labels });
        hintText = t("game.hintPsychic");
      } else if (st.phase === "guess") {
        title.textContent = t("game.whereIs", { name: gue });
        sub.textContent = "";
        mainBtn.textContent = t("game.lockGuess");
        dial.render("guess", { guess: st.guess, labels });
        hintText = t("game.hintGuess");
      } else if (st.phase === "reveal") {
        const r = st.result;
        title.textContent = st.finished ? t("game.over") : t("game.result");
        sub.textContent = "";
        dial.render("reveal", { target: st.target, guess: st.guess, w: st.w, labels, animate });
        verdictBox.append(
          h("strong", { class: `verdict__main v-${r.verdict}` }, st.finished ? t("game.wins", { name: st.players[st.winner] }) : t(`game.verdict.${r.verdict}`)),
          h("span", { class: "verdict__sub" }, r.points ? t("game.sums", { name: gue, n: r.points }) : t("game.sumsNone", { name: gue })),
          ...st.finished ? [h("span", { class: "verdict__sub" }, t(`game.verdict.${r.verdict}`))] : []
        );
        legend.textContent = t("game.legend");
        mainBtn.textContent = st.finished ? t("game.rematch") : t("game.nextRound");
        if (st.finished) {
          secBtn.hidden = false;
          secBtn.textContent = t("game.seeSummary");
          secBtn.onclick = () => openSummary(ctx2);
        }
      }
      hint.textContent = ctx2.settings.hints ? hintText : "";
      hint.hidden = !hint.textContent;
      if (st.phase !== lastPhase) {
        lastPhase = st.phase;
        if (!isModalOpen()) (st.phase === "guess" ? dial.el : mainBtn).focus({ preventScroll: true });
      }
    }
    update();
    return { update, destroy: () => document.removeEventListener("keydown", onKey) };
  }

  // js/main.js
  var root = document.getElementById("app");
  var storage = createStorage();
  var firstRun = storage.get(STORAGE_KEY) == null;
  var settings = loadSettings(storage);
  if (firstRun) settings = validateSettings({ ...settings, lang: detectLang() });
  var game = createGame();
  var feedback = createFeedback(() => settings);
  var entitlements = createEntitlements(storage);
  var analytics = createAnalytics(() => settings);
  var view = "home";
  var gameView = null;
  var source = null;
  var deck = null;
  var installEvent = null;
  function applySettings() {
    const el = document.documentElement;
    setLang(settings.lang);
    el.setAttribute("lang", settings.lang);
    el.setAttribute("data-theme", settings.theme);
    el.setAttribute("data-palette", settings.palette);
    if (settings.reduceMotion) el.setAttribute("data-motion", "reduce");
    else el.removeAttribute("data-motion");
    document.title = t("meta.title");
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    [["light", "(prefers-color-scheme: light)"], ["dark", "(prefers-color-scheme: dark)"]].forEach(([mode, media], i) => {
      const m = metas[i];
      if (!m) return;
      const fixed = settings.theme === "auto" ? mode : settings.theme;
      m.setAttribute("content", themeColor(settings.palette, fixed));
      if (settings.theme === "auto") m.setAttribute("media", media);
      else m.removeAttribute("media");
    });
  }
  var ctx = {
    get settings() {
      return settings;
    },
    storage,
    game,
    feedback,
    entitlements,
    analytics,
    listeners: /* @__PURE__ */ new Set(),
    setSetting(key, value, { silent = false } = {}) {
      settings = validateSettings({ ...settings, [key]: value });
      saveSettings(storage, settings);
      applySettings();
      if (!silent && (key === "lang" || key === "hints")) ctx.rerender();
      ctx.listeners.forEach((fn) => fn(key));
    },
    resetSettings() {
      const keep = { onboarded: settings.onboarded, analyticsAsked: settings.analyticsAsked };
      settings = validateSettings({ ...keep, lang: detectLang() });
      saveSettings(storage, settings);
      applySettings();
      ctx.rerender();
    },
    rerender() {
      if (view === "home") renderHome(ctx, root);
      else mountGameView();
    },
    // ---- partida ----
    startGame({ names, source: src }) {
      game.newMatch(names, (n) => t("home.player", { n }));
      source = src;
      deck = src.mode === "packs" ? createCategoryDeck(src.packIds, settings.lang) : null;
      view = "game";
      history.pushState({ lz: "game" }, "");
      analytics.track("game_start", { players: game.state.players.length, packs: src.packIds?.length ?? 0 });
      ctx.nextRound();
      mountGameView();
      announce(t("game.turnOf", { name: game.state.players[game.state.psychic] }));
    },
    /** La categoría se mantiene entre rondas; solo cambia con "Otra categoría" (o al empezar). */
    drawCategory(current2 = game.state.category) {
      if (source.mode === "custom") return source.category;
      return current2 ?? deck.draw(settings.lang);
    },
    nextRound(current2) {
      game.beginRound({ category: ctx.drawCategory(current2), difficulty: settings.difficulty });
      gameView?.update();
      announce(t("game.turnOf", { name: game.state.players[game.state.psychic] }));
    },
    rematch() {
      const keep = game.state.category;
      game.rematch();
      ctx.nextRound(keep);
    },
    canChangeCategory: () => source?.mode === "packs",
    anotherCategory() {
      if (game.setCategory(deck.draw(settings.lang))) gameView.update();
    },
    // ---- navegación ----
    async exitGame() {
      if (view !== "game") return;
      if (hasPoints() && !await confirmDialog({
        title: t("game.leave"),
        message: t("game.confirmLeave"),
        confirmLabel: t("game.leave"),
        cancelLabel: t("game.stay")
      })) return;
      await backAndWait();
      showHome();
    },
    canInstall: () => !!installEvent,
    async install() {
      if (!installEvent) return;
      installEvent.prompt();
      await installEvent.userChoice.catch(() => {
      });
      installEvent = null;
      ctx.rerender();
    }
  };
  var hasPoints = () => game.state.scores.some((n) => n > 0);
  function mountGameView() {
    gameView?.destroy();
    clear(root);
    gameView = mountGame(ctx, root);
  }
  function showHome() {
    gameView?.destroy();
    gameView = null;
    game.newMatch([], () => "");
    source = null;
    deck = null;
    resetHomeForm();
    view = "home";
    renderHome(ctx, root);
  }
  onRouteBack(async () => {
    if (view !== "game") return;
    if (!hasPoints()) {
      showHome();
      return;
    }
    history.pushState({ lz: "game" }, "");
    if (await confirmDialog({
      title: t("game.leave"),
      message: t("game.confirmLeave"),
      confirmLabel: t("game.leave"),
      cancelLabel: t("game.stay")
    })) {
      await backAndWait();
      showHome();
    }
  });
  function toast(message, action) {
    const el = h(
      "div",
      { class: "toast", role: "status" },
      h("span", null, message),
      action ? h("button", { class: "toast__btn", type: "button", onClick: () => {
        action.run();
        el.remove();
      } }, action.label) : null,
      h("button", { class: "toast__x", type: "button", "aria-label": t("common.close"), onClick: () => el.remove() }, "\xD7")
    );
    document.body.append(el);
    if (!action) setTimeout(() => el.remove(), 4e3);
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installEvent = e;
    if (view === "home") ctx.rerender();
  });
  window.addEventListener("appinstalled", () => {
    installEvent = null;
    if (view === "home") ctx.rerender();
  });
  async function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const hadController = !!navigator.serviceWorker.controller;
      const reg = await navigator.serviceWorker.register("sw.js");
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        nw?.addEventListener("statechange", () => {
          if (nw.state !== "installed") return;
          if (hadController) toast(t("pwa.update"), { label: t("pwa.reload"), run: () => location.reload() });
          else toast(t("pwa.offlineReady"));
        });
      });
    } catch {
    }
  }
  applySettings();
  history.replaceState({ lz: "home" }, "");
  renderHome(ctx, root);
  root.removeAttribute("aria-busy");
  if (!settings.onboarded) openTutorial(ctx);
  registerSW();
  window.__lazona = Object.freeze({ version: "1.0.0" });
})();
