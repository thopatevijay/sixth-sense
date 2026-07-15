'use client';

// SURGE (FR-S1..S4): a directional, number-free momentum bar that is NEVER static.
// - Odds ticks set the target; we ease toward it so a swing lurches within ~2s (FR-S1).
// - Between ticks the bar breathes, driven by PossessionType, so it always feels alive (FR-S2).
// - A sharp swing pulses colour + haptic + sound (FR-S3).
// - One line of plain microcopy, zero numbers (FR-S4 / grandma test).
//
// Runs on requestAnimationFrame and writes styles straight to refs — no React re-render per frame.

import { useEffect, useRef } from 'react';
import type { SurgeTick } from '../lib/relay';
import { playSwing, vibrate } from '../lib/feedback';

interface Props {
  tick: SurgeTick | null;
  names: { 1: string; 2: string };
  /** Live score — leans the bar when the feed has no odds `Pct` (scores-only capture). */
  score?: { p1: number; p2: number };
}

const DANGER: Record<string, number> = { Safe: 0.1, Attack: 0.4, Danger: 0.75, HighDanger: 1 };
const SWING_THRESHOLD = 0.045; // change in p1 share that reads as a momentum swing
const EASE = 0.1; // how fast the bar chases the target (per frame)

export function SurgeBar({ tick, names, score }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const p1 = useRef<HTMLDivElement>(null);
  const micro = useRef<HTMLParagraphElement>(null);

  // Animation state kept in refs so the rAF loop never triggers React renders.
  const target = useRef(0.5);
  const display = useRef(0.5);
  const possession = useRef<1 | 2 | null>(null);
  const intensity = useRef(0.1);
  const phase = useRef(0);
  const swing = useRef(0); // decaying pulse magnitude
  const swingDir = useRef<1 | 2 | null>(null);
  const prevTarget = useRef(0.5);

  // Ingest a new tick → recompute the momentum TARGET.
  // Momentum = odds when the feed has them, else the score baseline, always nudged toward
  // whoever is attacking dangerously right now. So a scores-only replay still leans + surges.
  useEffect(() => {
    if (!tick) return;
    const oddsShare = tick.p1Pct + tick.p2Pct > 0 ? tick.p1Pct / (tick.p1Pct + tick.p2Pct) : 0.5;
    const hasOdds = Math.abs(oddsShare - 0.5) > 0.005;
    const diff = (score?.p1 ?? 0) - (score?.p2 ?? 0);
    const scoreShare = 0.5 + Math.tanh(diff * 0.6) * 0.22; // 1-goal lead ≈ .62, 2 ≈ .68
    const base = hasOdds ? oddsShare : scoreShare;
    const dangerI = DANGER[tick.possessionType ?? 'Safe'] ?? 0.1;
    const posLean = (tick.possession === 1 ? 1 : tick.possession === 2 ? -1 : 0) * dangerI * 0.16;
    const t = clamp(base + posLean, 0.08, 0.92);

    const delta = t - prevTarget.current;
    if (Math.abs(delta) >= SWING_THRESHOLD) {
      swing.current = Math.min(1, Math.abs(delta) * 6);
      swingDir.current = delta > 0 ? 1 : 2;
      vibrate([0, 40, 30, 60]);
      playSwing(swingDir.current, Math.abs(delta));
    }
    prevTarget.current = t;
    target.current = t;
    possession.current = tick.possession;
    intensity.current = dangerI;

    if (micro.current) {
      const danger = tick.possessionType && tick.possessionType !== 'Safe' ? tick.possessionType : '';
      const presser = dangerI >= 0.75 && tick.possession ? names[tick.possession] : null;
      const leader = t > 0.53 ? names[1] : t < 0.47 ? names[2] : null;
      micro.current.innerHTML = presser
        ? `<span class="font-semibold text-neutral-100">${presser} pressing</span> <span class="text-amber-400">· ${danger}</span>`
        : leader
          ? `<span class="font-semibold text-neutral-100">${leader} surging</span>${danger ? ` <span class="text-amber-400">· ${danger}</span>` : ''}`
          : `<span class="text-neutral-500">End to end</span>`;
    }
  }, [tick, names, score]);

  // The animation loop.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(64, now - last) / 1000;
      last = now;

      display.current += (target.current - display.current) * EASE;
      phase.current += dt * (2 + intensity.current * 6);
      swing.current *= 0.94;

      // Breathe: a small oscillation biased toward the side in possession, scaled by danger.
      const amp = 0.004 + intensity.current * 0.018 + swing.current * 0.03;
      const bias = (possession.current === 1 ? 1 : possession.current === 2 ? -1 : 0) * intensity.current * 0.006;
      const frac = clamp(display.current + bias + Math.sin(phase.current) * amp, 0.04, 0.96);

      if (p1.current) {
        p1.current.style.width = `${frac * 100}%`;
        const glow = 8 + intensity.current * 22 + swing.current * 40;
        const lead = frac >= 0.5;
        p1.current.style.boxShadow = `0 0 ${glow}px ${lead ? 'rgba(59,130,246,.6)' : 'rgba(239,68,68,.5)'}`;
      }
      if (wrap.current) {
        wrap.current.style.transform = `scale(${1 + swing.current * 0.012})`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={wrap}
        className="relative h-16 rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 will-change-transform"
      >
        {/* away side is the whole track; the p1 fill overlays it, so the split is the boundary */}
        <div className="absolute inset-0 bg-gradient-to-l from-red-700 to-red-500" />
        <div
          ref={p1}
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-700 to-blue-500"
          style={{ width: '50%' }}
        />
        {/* center seam */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/15" />
      </div>
      <p ref={micro} className="text-center text-neutral-300 min-h-6">
        <span className="text-neutral-500">Reading the match…</span>
      </p>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
