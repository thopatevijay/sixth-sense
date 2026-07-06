'use client';

// One auth surface for the app, whether Privy is configured or not. When Privy is live it
// wraps usePrivy + useSolanaWallets; before Phase 0 keys land it falls back to a localStorage
// dev bypass so the SURGE loop is buildable/demoable against MOCK. Components never branch on it.

import { useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import { privyConfigured } from '../providers';
import { usePersistentRaw } from './store';

export interface AuthState {
  ready: boolean;
  authenticated: boolean;
  /** Solana wallet pubkey (invisible embedded wallet), if any. */
  walletAddress: string | null;
  devMode: boolean;
  login: () => void;
  logout: () => void;
}

const DEV_KEY = 'sixthsense.devSignedIn';

/** Dev bypass used only when Privy isn't configured yet. Shared across all screens. */
function useDevAuth(): AuthState {
  const { value, set, mounted } = usePersistentRaw(DEV_KEY);
  const signedIn = value === '1';
  const login = useCallback(() => set('1'), [set]);
  const logout = useCallback(() => set(null), [set]);
  // A deterministic fake pubkey so wallet-dependent UI has something to show in dev.
  const walletAddress = signedIn ? 'Dev1111111111111111111111111111111111111111' : null;
  return { ready: mounted, authenticated: signedIn, walletAddress, devMode: true, login, logout };
}

/** Privy-backed auth (real embedded Solana wallet). */
function usePrivyAuth(): AuthState {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useSolanaWallets();
  return {
    ready,
    authenticated,
    walletAddress: wallets[0]?.address ?? null,
    devMode: false,
    login,
    logout,
  };
}

export function useAuth(): AuthState {
  // Hook order is stable across renders because privyConfigured is a module constant.
  return privyConfigured ? usePrivyAuth() : useDevAuth();
}
