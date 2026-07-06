'use client';

// Privy → invisible Solana wallet, gasless (FR-A1, FR-A4). Google/email login creates an
// embedded Solana wallet for users without one — no seed phrase, no "buy SOL" prompt.
//
// If NEXT_PUBLIC_PRIVY_APP_ID is not set yet (Phase 0 pending), we render a passthrough so
// the app still runs against the MOCK relay; useAuth() then exposes a local dev bypass.

import { PrivyProvider } from '@privy-io/react-auth';
import type { ReactNode } from 'react';

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
export const privyConfigured = Boolean(PRIVY_APP_ID);

export function Providers({ children }: { children: ReactNode }) {
  if (!privyConfigured) return <>{children}</>;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID as string}
      config={{
        loginMethods: ['google', 'email'],
        embeddedWallets: {
          solana: { createOnLogin: 'users-without-wallets' },
        },
        appearance: {
          walletChainType: 'solana-only',
          showWalletLoginFirst: false, // mainstream fans see Google first, not a wallet grid
          theme: 'dark',
          accentColor: '#3b82f6',
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
