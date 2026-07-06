'use client';

import { NATIONS, useNation, type Nation } from '../lib/nation';

// FR-A3: pick nation/team in ≤2 taps; persisted (survives reload).
export function PickNation() {
  const { setNation } = useNation();

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-8 px-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Who are you feeling?</h2>
        <p className="text-neutral-400 text-sm">Follow your team from anywhere.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {NATIONS.map((n: Nation) => (
          <button
            key={n.code}
            onClick={() => setNation(n)}
            className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-4 text-left active:scale-[.97] transition hover:border-neutral-600"
          >
            <span className="text-3xl">{n.flag}</span>
            <span className="font-semibold">{n.name}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
