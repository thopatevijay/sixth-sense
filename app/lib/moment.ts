'use client';

// Tracks the standout moment a fan witnessed this session and their evolving level.
// A "witnessed moment" = a goal they saw live; the biggest odds swing is the card's headline.
// Level (and rarity) accumulate across sessions via the shared persistent store — one evolving
// collectible, not N static cards (system-design §D).

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MatchEvent, SurgeTick } from './relay';
import type { Nation } from './nation';
import { usePersistentRaw } from './store';

export interface Moment {
  level: number;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  swingPct: number; // biggest momentum swing witnessed, in points
  swingDesc: string;
  nation: string;
  flag: string;
  match: string;
  witnessedGoals: number;
}

const KEY = 'sixthsense.witnessedGoals';
const SWING_STANDOUT = 6; // points of swing that make a moment "standout"

function rarityFor(level: number): Moment['rarity'] {
  if (level >= 7) return 'Legendary';
  if (level >= 4) return 'Epic';
  if (level >= 2) return 'Rare';
  return 'Common';
}

function describe(swingPct: number, nation: string, favouredUser: boolean): string {
  if (swingPct < SWING_STANDOUT) return `Felt ${nation}'s momentum shift`;
  return favouredUser ? `Witnessed ${nation}'s ${swingPct}% surge` : `Survived a ${swingPct}% swing`;
}

/** Live moment view-model. `standout` flips true once a swing crosses the threshold. */
export function useMomentTracker(
  surge: SurgeTick | null,
  lastEvent: MatchEvent | null,
  nation: Nation | null,
): { moment: Moment; standout: boolean } {
  const { value, set } = usePersistentRaw(KEY);
  const witnessedGoals = Number(value ?? '0') || 0;

  // Session swing range (min/max of p1 share) → biggest swing magnitude.
  const minShare = useRef(1);
  const maxShare = useRef(0);
  const [swingPct, setSwingPct] = useState(0);
  const lastGoal = useRef<MatchEvent | null>(null);

  useEffect(() => {
    if (!surge) return;
    const share = surge.p1Pct + surge.p2Pct > 0 ? surge.p1Pct / (surge.p1Pct + surge.p2Pct) : 0.5;
    minShare.current = Math.min(minShare.current, share);
    maxShare.current = Math.max(maxShare.current, share);
    const pct = Math.round((maxShare.current - minShare.current) * 100);
    setSwingPct((p) => (pct > p ? pct : p));
  }, [surge]);

  // A newly-witnessed goal increments the persistent level.
  useEffect(() => {
    if (!lastEvent || lastEvent.kind !== 'goal' || lastEvent === lastGoal.current) return;
    lastGoal.current = lastEvent;
    set(String(witnessedGoals + 1));
  }, [lastEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  const moment = useMemo<Moment>(() => {
    const level = Math.max(1, witnessedGoals);
    const userSide = nation?.side ?? 1;
    const favouredUser = userSide === 1 ? maxShare.current > 0.5 : minShare.current < 0.5;
    return {
      level,
      rarity: rarityFor(level),
      swingPct,
      swingDesc: describe(swingPct, nation?.name ?? 'your team', favouredUser),
      nation: nation?.name ?? 'World',
      flag: nation?.flag ?? '🌍',
      match: 'France v Brazil',
      witnessedGoals,
    };
  }, [witnessedGoals, swingPct, nation]);

  return { moment, standout: swingPct >= SWING_STANDOUT };
}
