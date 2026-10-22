/**
 * Vista de partida: una sola estructura DOM que se actualiza por fase
 * (wait → psychic → guess → reveal). El dial se crea una vez.
 */
import { h, clear, icon, announce } from './dom.js';
import { ICONS } from './icons.js';
import { createDial } from './dial.js';
import { isModalOpen } from './modal.js';
import { openSettings } from './settings-panel.js';
import { openHistory, openSummary } from './summary.js';
import { t } from '../i18n/index.js';

export function mountGame(ctx, root) {
  const g = ctx.game;
  let lastKey = '';                     // evita dobles toques: una sola acción por fase y ronda
  let lastPhase = null;
  const guard = (fn) => () => {
    const key = `${g.state.phase}:${g.state.round}`;
    if (key === lastKey) return;
    lastKey = key;
    ctx.feedback.unlock();              // primer gesto del usuario: desbloquea AudioContext
    fn();
  };

  const dial = createDial({
    onStep: (d) => { g.nudge(d); dial.setGuess(g.state.guess, true); ctx.feedback.tick(); },
    onChange: (v) => { g.setGuess(v); },
    onCommit: guard(() => lock()),
  });

  // ---- esqueleto ----
  const scoreboard = h('div', { class: 'scoreboard', role: 'group', 'aria-label': t('aria.score') });
  const roundChip = h('span', { class: 'chip' });
  const title = h('h2', { class: 'stage__title', tabindex: '-1' });
  const sub = h('p', { class: 'stage__sub' });
  const endL = h('span', { class: 'end end--l' });
  const endR = h('span', { class: 'end end--r' });
  const verdictBox = h('div', { class: 'verdict', hidden: true });
  const legend = h('p', { class: 'legend', hidden: true });
  const mainBtn = h('button', { class: 'btn btn--primary btn--block btn--big', type: 'button' });
  const secBtn = h('button', { class: 'btn btn--ghost btn--block', type: 'button' });
  const altBtn = h('button', { class: 'btn btn--ghost btn--block', type: 'button' });
  const hint = h('p', { class: 'hint' });

  root.append(h('main', { class: 'screen screen--game' },
    h('header', { class: 'gamebar' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('game.back'), onClick: () => ctx.exitGame() }, icon(ICONS.back)),
      h('div', { class: 'gamebar__center' }, h('span', { class: 'gamebar__name' }, t('app.name')), roundChip),
      h('div', { class: 'topbar__actions' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('game.history'), onClick: () => openHistory(ctx) }, icon(ICONS.history)),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('aria.settings'), onClick: () => openSettings(ctx) }, icon(ICONS.gear)))),
    scoreboard,
    h('section', { class: 'stage' }, title, sub, dial.el,
      h('div', { class: 'ends' }, endL, endR), legend, verdictBox),
    h('div', { class: 'actions' }, mainBtn, secBtn, altBtn, hint)));

  mainBtn.addEventListener('click', guard(() => primary()));

  // ---- acciones ----
  function primary() {
    const { phase, finished } = g.state;
    if (phase === 'wait') g.showPsychic();
    else if (phase === 'psychic') g.hidePsychic();
    else if (phase === 'guess') return lock();
    else if (phase === 'reveal') return finished ? ctx.rematch() : ctx.nextRound();
    update();
  }

  function lock() {
    const r = g.lock({ target: ctx.settings.target, fairTurns: ctx.settings.fairTurns });
    if (!r) return;
    const st = g.state;
    // El sonido y la vibración coinciden con el momento en que la ruleta revela (≈1,1 s), salvo con movimiento reducido.
    const calm = document.documentElement.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm) ctx.feedback.reveal(r.points, st.finished); else setTimeout(() => ctx.feedback.reveal(r.points, st.finished), 1100);
    ctx.analytics.track('round_end', { points: r.points, round: st.round });
    if (st.finished) ctx.analytics.track('game_end', { rounds: st.round });
    update(true);
    const name = st.players[st.guesser];
    announce(`${t(`game.verdict.${r.verdict}`)} ${r.points ? t('game.sums', { name, n: r.points }) : t('game.sumsNone', { name })}${st.finished ? `. ${t('game.wins', { name: st.players[st.winner] })}` : ''}`);
  }

  // Teclado global en la fase de adivinar (se ignora con un panel abierto).
  function onKey(e) {
    if (isModalOpen() || g.state.phase !== 'guess') return;
    if (document.activeElement !== document.body && document.activeElement !== dial.el) return;
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'];
    if (!keys.includes(e.key) || e.defaultPrevented) return;
    dial.focus();
    dial.el.dispatchEvent(new KeyboardEvent('keydown', { key: e.key, shiftKey: e.shiftKey, bubbles: true, cancelable: true }));
    e.preventDefault();
  }
  document.addEventListener('keydown', onKey);

  // ---- pintado ----
  function drawScores() {
    const st = g.state;
    clear(scoreboard);
    scoreboard.dataset.count = String(st.players.length);
    st.players.forEach((name, i) => {
      const role = st.phase === 'setup' ? '' : i === st.psychic ? t('game.psychic') : i === st.guesser ? t('game.guesser') : t('game.waiting');
      const active = (st.phase === 'wait' || st.phase === 'psychic') ? i === st.psychic : i === st.guesser;
      scoreboard.append(h('div', { class: `score${active ? ' is-active' : ''}${i === st.psychic ? ' is-psychic' : ''}`,
        'aria-label': t('game.score', { name, n: st.scores[i], role }), role: 'group' },
        h('span', { class: 'score__name' }, name),
        h('span', { class: 'score__role' }, role),
        h('strong', { class: 'score__pts', 'aria-hidden': 'true' }, String(st.scores[i]))));
    });
  }

  function update(animate = false) {
    const st = g.state;
    const psy = st.players[st.psychic], gue = st.players[st.guesser];
    const cat = st.category ?? { left: '', right: '' };
    const labels = {
      covered: t('game.covered'), dial: t('game.dialLabel', { left: cat.left, right: cat.right }),
      slider: t('game.sliderLabel', { left: cat.left, right: cat.right }), target: t('game.target'), answer: t('game.yourAnswer'),
    };
    root.dataset.phase = st.phase;
    root.classList.toggle('is-revealing', animate && st.phase === 'reveal');
    roundChip.textContent = t('game.round', { n: st.round });
    endL.textContent = cat.left; endR.textContent = cat.right;
    drawScores();

    verdictBox.hidden = st.phase !== 'reveal';
    legend.hidden = st.phase !== 'reveal';
    secBtn.hidden = true; altBtn.hidden = true;
    clear(verdictBox);
    let hintText = '';

    if (st.phase === 'wait') {
      title.textContent = t('game.turnOf', { name: psy });
      sub.textContent = t('game.lookAway', { name: gue });
      mainBtn.textContent = t('game.iAm', { name: psy });
      dial.render('cover', { labels });
      if (ctx.canChangeCategory()) {
        altBtn.hidden = false; altBtn.textContent = t('game.anotherCategory'); altBtn.onclick = () => ctx.anotherCategory();
      }
    } else if (st.phase === 'psychic') {
      title.textContent = t('game.memorize');
      sub.textContent = psy;
      mainBtn.textContent = t('game.hideAndPass', { name: gue });
      dial.render('psychic', { target: st.target, w: st.w, labels });
      hintText = t('game.hintPsychic');
    } else if (st.phase === 'guess') {
      title.textContent = t('game.whereIs', { name: gue });
      sub.textContent = '';
      mainBtn.textContent = t('game.lockGuess');
      dial.render('guess', { guess: st.guess, labels });
      hintText = t('game.hintGuess');
    } else if (st.phase === 'reveal') {
      const r = st.result;
      title.textContent = st.finished ? t('game.over') : t('game.result');
      sub.textContent = '';
      dial.render('reveal', { target: st.target, guess: st.guess, w: st.w, labels, animate });
      verdictBox.append(
        h('strong', { class: `verdict__main v-${r.verdict}` }, st.finished ? t('game.wins', { name: st.players[st.winner] }) : t(`game.verdict.${r.verdict}`)),
        h('span', { class: 'verdict__sub' }, r.points ? t('game.sums', { name: gue, n: r.points }) : t('game.sumsNone', { name: gue })),
        ...(st.finished ? [h('span', { class: 'verdict__sub' }, t(`game.verdict.${r.verdict}`))] : []));
      legend.textContent = t('game.legend');
      mainBtn.textContent = st.finished ? t('game.rematch') : t('game.nextRound');
      if (st.finished) {
        secBtn.hidden = false; secBtn.textContent = t('game.seeSummary'); secBtn.onclick = () => openSummary(ctx);
      }
    }
    hint.textContent = ctx.settings.hints ? hintText : '';
    hint.hidden = !hint.textContent;

    // Foco: al cambiar de fase, a donde está la acción.
    if (st.phase !== lastPhase) {
      lastPhase = st.phase;
      if (!isModalOpen()) (st.phase === 'guess' ? dial.el : mainBtn).focus({ preventScroll: true });
    }
  }

  update();
  return { update, destroy: () => document.removeEventListener('keydown', onKey) };
}
