// Branded first-load splash — shown while auth/nation state hydrates, so the very
// first paint is the identity (not a bare glyph on black). Matches SignIn's layout
// so the hand-off to the landing is seamless.
export function Splash() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="space-y-3 animate-pulse">
        <div className="text-5xl">◎</div>
        <h1 className="text-3xl font-bold tracking-tight">SIXTH SENSE</h1>
        <p className="text-neutral-500 max-w-xs">Feel every match. See the goal coming.</p>
      </div>
    </main>
  );
}
