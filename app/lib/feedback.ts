'use client';

// Momentum-swing feedback (FR-S3): haptic buzz (Android) + a short synthesized tone.
// iOS Safari has no Vibration API, so visual + audio carry there (NFR-5). No audio assets —
// a tiny Web Audio blip keeps the bundle lean and works offline.

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* unsupported / blocked — visual+audio carry */
    }
  }
}

let ctx: AudioContext | null = null;

/** A brief rising/falling blip whose pitch encodes swing direction. Fails silently. */
export function playSwing(direction: 1 | 2 | null, magnitude: number): void {
  if (typeof window === 'undefined') return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    // Side 1 sweeps up, side 2 sweeps down — a subliminal "who" cue.
    const base = 320 + Math.min(magnitude, 0.2) * 900;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(direction === 2 ? base * 0.6 : base * 1.6, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  } catch {
    /* audio blocked before a gesture — fine */
  }
}
