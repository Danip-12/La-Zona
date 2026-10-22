/** Resumen de partida e historial de rondas (en hoja/modal). */
import { h, icon, add } from './dom.js';
import { ICONS } from './icons.js';
import { openModal } from './modal.js';
import { summarize } from '../core/game.js';
import { t, formatNumber } from '../i18n/index.js';

const fmt = (n) => formatNumber(n, { maximumFractionDigits: 1 });

function roundsTable(state) {
  const { history, players } = state;
  return h('div', { class: 'table-wrap' },
    h('table', { class: 'table' },
      h('caption', { class: 'sr-only' }, t('summary.perRound')),
      h('thead', null, h('tr', null,
        ['summary.colRound', 'summary.colGuesser', 'summary.colCategory', 'summary.colPoints'].map((k) => h('th', { scope: 'col' }, t(k))))),
      h('tbody', null, history.map((r) => h('tr', null,
        h('th', { scope: 'row' }, String(r.round)),
        h('td', null, players[r.guesser]),
        h('td', { class: 'td-cat' }, r.category ? `${r.category.left} ↔ ${r.category.right}` : '—'),
        h('td', null, h('span', { class: `pts pts--${r.points}` }, h('span', { class: 'pts__bar', style: { width: `${(r.points / 4) * 100}%` } }), h('span', { class: 'pts__n' }, String(r.points)))))))));
}

export function openHistory(ctx) {
  const st = ctx.game.state;
  return openModal({
    title: t('history.title'),
    build(body) {
      add(body, st.history.length ? roundsTable(st) : h('p', { class: 'empty' }, t('history.empty')));
    },
  });
}

export function openSummary(ctx) {
  const st = ctx.game.state;
  const sum = summarize(st.history, st.players.length);
  const max = Math.max(...st.scores);
  const leaders = st.scores.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0);
  return openModal({
    title: t('summary.title'),
    build(body, api) {
      add(body, 
        st.finished ? h('p', { class: 'summary__winner' }, icon(ICONS.trophy, 22), t('game.wins', { name: st.players[st.winner] })) : null,
        h('dl', { class: 'stats' },
          h('div', { class: 'stat' }, h('dt', null, t('summary.rounds')), h('dd', null, String(st.history.length))),
          h('div', { class: 'stat' }, h('dt', null, t('summary.best')),
            h('dd', null, sum.best ? t('summary.bestValue', { round: sum.best.round, name: st.players[sum.best.guesser], points: sum.best.points }) : '—')),
          h('div', { class: 'stat' }, h('dt', null, t('summary.avg')), h('dd', null, t('summary.avgValue', { n: fmt(sum.avgDistance) })))),
        h('h3', { class: 'group__title' }, t('summary.perPlayer')),
        h('ul', { class: 'plist' }, st.players.map((name, i) => h('li', { class: `plist__row${leaders.includes(i) ? ' is-lead' : ''}` },
          h('span', { class: 'plist__name' }, name),
          h('span', { class: 'plist__meta' }, `${t('summary.bullseyes')}: ${sum.perPlayer[i].bullseyes} · ${t('summary.avgValue', { n: fmt(sum.perPlayer[i].avgDistance) })}`),
          h('strong', { class: 'plist__pts' }, String(st.scores[i]))))),
        h('h3', { class: 'group__title' }, t('summary.perRound')),
        st.history.length ? roundsTable(st) : h('p', { class: 'empty' }, t('history.empty')),
        h('button', { class: 'btn btn--ghost btn--block', type: 'button', onClick: () => api.close('ok') }, t('common.close')));
    },
  });
}
