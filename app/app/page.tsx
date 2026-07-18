'use client';

import { useAuth } from '@/lib/auth';
import { useNation } from '@/lib/nation';
import { SignIn } from '@/components/SignIn';
import { PickNation } from '@/components/PickNation';
import { SurgeHome } from '@/components/SurgeHome';
import { Splash } from '@/components/Splash';

// Core-loop gate: sign in → pick nation → SURGE home.
export default function Home() {
  const { ready, authenticated } = useAuth();
  const { nation, loaded } = useNation();

  if (!ready || !loaded) return <Splash />;
  if (!authenticated) return <SignIn />;
  if (!nation) return <PickNation />;
  return <SurgeHome />;
}
