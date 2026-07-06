'use client';

import { useAuth } from '@/lib/auth';
import { useNation } from '@/lib/nation';
import { SignIn } from '@/components/SignIn';
import { PickNation } from '@/components/PickNation';
import { SurgeHome } from '@/components/SurgeHome';

// Core-loop gate: sign in → pick nation → SURGE home.
export default function Home() {
  const { ready, authenticated } = useAuth();
  const { nation, loaded } = useNation();

  if (!ready || !loaded) {
    return <main className="min-h-dvh flex items-center justify-center text-neutral-600">◎</main>;
  }
  if (!authenticated) return <SignIn />;
  if (!nation) return <PickNation />;
  return <SurgeHome />;
}
