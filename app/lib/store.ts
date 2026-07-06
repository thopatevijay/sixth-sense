'use client';

// A tiny localStorage-backed store shared across ALL hook instances. Component-local
// useState would let one screen's write go unseen by another (e.g. sign-in advancing the
// gate in page.tsx); useSyncExternalStore + a listener registry keeps every consumer in sync.

import { useCallback, useSyncExternalStore } from 'react';

const listeners = new Map<string, Set<() => void>>();

function subscribeKey(key: string, cb: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(cb);
  return () => set!.delete(cb);
}

function emit(key: string): void {
  listeners.get(key)?.forEach((l) => l());
}

/** Raw string value at `key`, synced across instances + across tabs. `null` when unset/SSR. */
export function usePersistentRaw(key: string): {
  value: string | null;
  set: (v: string | null) => void;
  mounted: boolean;
} {
  const subscribe = useCallback(
    (cb: () => void) => {
      const un = subscribeKey(key, cb);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) cb();
      };
      window.addEventListener('storage', onStorage);
      return () => {
        un();
        window.removeEventListener('storage', onStorage);
      };
    },
    [key],
  );

  const getSnapshot = useCallback(
    () => (typeof localStorage === 'undefined' ? null : localStorage.getItem(key)),
    [key],
  );
  const getServerSnapshot = useCallback(() => null as string | null, []);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // `mounted` flips true once we're on the client (server snapshot is always null).
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const set = useCallback(
    (v: string | null) => {
      if (v === null) localStorage.removeItem(key);
      else localStorage.setItem(key, v);
      emit(key);
    },
    [key],
  );

  return { value, set, mounted };
}
