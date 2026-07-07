'use client';

// The Verified Moment sheet: shows the client-rendered share card (always works), lets the fan
// share it one-tap (FR-M4), and optionally verify it on Solana. The verified stamp only appears
// after a real mint (FR-M3/M5) — otherwise the card is honestly "witnessed live".

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Moment } from '../lib/moment';
import { renderShareCard } from '../lib/shareCard';
import { mintMoment, type MintStatus } from '../lib/mint';
import { vibrate } from '../lib/feedback';

interface Props {
  moment: Moment;
  walletAddress: string | null;
  onClose: () => void;
}

export function MomentSheet({ moment, walletAddress, onClose }: Props) {
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const [verified, setVerified] = useState(false);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [status, setStatus] = useState<MintStatus | null>(null);

  // Render (and re-render once verified) the card.
  useEffect(() => {
    let alive = true;
    renderShareCard(moment, { verified, assetId }).then(({ blob, dataUrl }) => {
      if (!alive) return;
      blobRef.current = blob;
      setCardUrl(dataUrl);
    });
    return () => {
      alive = false;
    };
  }, [moment, verified, assetId]);

  const share = useCallback(async () => {
    const blob = blobRef.current;
    if (!blob) return;
    const file = new File([blob], 'sixth-sense-moment.png', { type: 'image/png' });
    vibrate(20);
    if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'My SIXTH SENSE moment' });
        return;
      } catch {
        /* user cancelled — fall through to download */
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sixth-sense-moment.png';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const verify = useCallback(async () => {
    setMinting(true);
    const res = await mintMoment(moment, walletAddress);
    setStatus(res.status);
    if (res.verified) {
      setVerified(true);
      setAssetId(res.assetId ?? null);
      vibrate([0, 40, 30, 80]);
    }
    setMinting(false);
  }, [moment, walletAddress]);

  return (
    <div className="fixed inset-0 z-[60] bg-neutral-950/95 backdrop-blur flex flex-col items-center justify-center gap-6 px-6 py-8 overflow-y-auto">
      <button onClick={onClose} className="absolute top-4 right-5 text-neutral-500 hover:text-neutral-200 text-2xl">×</button>

      {cardUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cardUrl} alt="Your SIXTH SENSE moment" className="max-h-[62vh] w-auto rounded-2xl border border-neutral-800 shadow-2xl" />
      ) : (
        <div className="h-[62vh] w-[50vh] max-w-full rounded-2xl bg-neutral-900 animate-pulse" />
      )}

      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        <button
          onClick={share}
          className="w-full rounded-full bg-white text-black font-semibold py-3.5 active:scale-[.98] transition"
        >
          Share your moment
        </button>

        {!verified ? (
          <button
            onClick={verify}
            disabled={minting}
            className="w-full rounded-full border border-neutral-700 text-neutral-200 py-3 disabled:opacity-50 active:scale-[.98] transition"
          >
            {minting ? 'Verifying…' : 'Verify on Solana'}
          </button>
        ) : (
          <p className="text-emerald-400 text-sm">✓ Verified on Solana</p>
        )}

        {status === 'unconfigured' && (
          <p className="text-neutral-500 text-xs text-center">
            On-chain verification isn&apos;t configured yet — your card is still fully shareable.
          </p>
        )}
        {status === 'error' && !verified && (
          <p className="text-neutral-500 text-xs text-center">Couldn&apos;t verify right now — the card still works.</p>
        )}
      </div>
    </div>
  );
}
