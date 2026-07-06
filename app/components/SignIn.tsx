'use client';

import { useAuth } from '../lib/auth';

// FR-A1: one-tap sign-in. No crypto terminology, no seed phrase, no "buy SOL".
export function SignIn() {
  const { login, ready, devMode } = useAuth();

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="space-y-3">
        <div className="text-5xl">◎</div>
        <h1 className="text-3xl font-bold tracking-tight">SIXTH SENSE</h1>
        <p className="text-neutral-400 max-w-xs">
          Feel every match. See the goal coming.
        </p>
      </div>

      <button
        onClick={login}
        disabled={!ready}
        className="w-full max-w-xs rounded-full bg-white text-black font-semibold py-3.5 text-lg disabled:opacity-50 active:scale-[.98] transition"
      >
        {ready ? 'Continue' : 'Loading…'}
      </button>

      {devMode && (
        <p className="text-xs text-amber-500/80">
          dev mode — Privy not configured; continues with a local session
        </p>
      )}
    </main>
  );
}
