// Petits sons synthétisés (Web Audio) : aucun fichier à charger, fonctionne hors ligne.

let ctx: AudioContext | null = null;

function note(freq: number, start: number, dur: number, vol: number, type: OscillatorType) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function play(notes: [number, number, number][], vol: number, type: OscillatorType) {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    for (const [freq, start, dur] of notes) note(freq, start, dur, vol, type);
  } catch {
    // Audio indisponible : on ignore silencieusement.
  }
}

/** Nouvelle carte : petit arpège joyeux (do-mi-sol-do). */
export function playNewCard() {
  play(
    [
      [523.25, 0, 0.18],
      [659.25, 0.09, 0.18],
      [783.99, 0.18, 0.18],
      [1046.5, 0.27, 0.4],
    ],
    0.22,
    'triangle',
  );
}

/** Carte déjà possédée : deux notes douces et calmes. */
export function playOwnedCard() {
  play(
    [
      [392, 0, 0.2],
      [329.63, 0.14, 0.32],
    ],
    0.2,
    'sine',
  );
}
