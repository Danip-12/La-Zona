/**
 * Sonido (Web Audio, ondas sinusoidales) y vibración. Todo falla en silencio:
 * AudioContext bloqueado hasta un gesto del usuario, navegador sin vibrate, etc.
 */
const NOTE = { A3: 220, C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5 };

/** Notas que suenan al revelar (puro, testeable). */
export function notesFor(points, finalWin = false) {
  if (finalWin) return [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6];
  if (points >= 4) return [NOTE.C5, NOTE.E5, NOTE.G5];
  if (points === 3) return [NOTE.C5, NOTE.E5];
  if (points === 2) return [NOTE.C5];
  return [NOTE.A3];
}

/** Patrón de vibración (puro, testeable). */
export function vibrationFor(points, finalWin = false) {
  if (finalWin) return [60, 40, 60, 40, 140];
  if (points >= 4) return [50, 30, 50];
  if (points === 3) return [40];
  if (points === 2) return [25];
  return [15];
}

export const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function createFeedback(getSettings) {
  let ctx = null;

  /** Crear/reanudar el contexto SOLO dentro de un gesto del usuario. */
  function unlock() {
    try {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return null;
      ctx ??= new AC();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    } catch { return null; }
  }

  function playNotes(freqs) {
    const c = unlock();
    if (!c || c.state === 'closed') return;
    const t0 = c.currentTime + 0.02;
    freqs.forEach((f, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      const start = t0 + i * 0.14;
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
      osc.connect(gain).connect(c.destination);
      osc.start(start);
      osc.stop(start + 0.36);
    });
  }

  return {
    unlock,
    /** Sonido + vibración del resultado según los ajustes actuales. */
    reveal(points, finalWin = false) {
      const s = getSettings();
      if (s.sound) playNotes(notesFor(points, finalWin));
      if (s.vibration && canVibrate()) { try { navigator.vibrate(vibrationFor(points, finalWin)); } catch { /* noop */ } }
    },
    /** Muestra breve al activar el interruptor de sonido. */
    sample() { playNotes([NOTE.C5, NOTE.E5]); },
    tick() { if (getSettings().vibration && canVibrate()) { try { navigator.vibrate(8); } catch { /* noop */ } } },
  };
}
