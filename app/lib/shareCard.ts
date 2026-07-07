'use client';

// Renders the shareable Moment card to a PNG entirely client-side (FR-M1) — it NEVER depends
// on the chain, so it works every time. The "Verified on Solana ✓" stamp only appears when a
// mint is actually confirmed (FR-M3/M5): no chain claim is ever faked.

import type { Moment } from './moment';

export interface CardOptions {
  verified: boolean;
  assetId?: string | null;
}

const W = 1080;
const H = 1350;

const RARITY_COLOR: Record<Moment['rarity'], string> = {
  Common: '#94a3b8',
  Rare: '#38bdf8',
  Epic: '#a78bfa',
  Legendary: '#fbbf24',
};

export async function renderShareCard(moment: Moment, opts: CardOptions): Promise<{ blob: Blob; dataUrl: string }> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unavailable');

  // Background: deep vertical gradient with a rarity-tinted glow.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b0f1a');
  bg.addColorStop(1, '#05070d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const accent = RARITY_COLOR[moment.rarity];
  const glow = ctx.createRadialGradient(W / 2, 470, 40, W / 2, 470, 620);
  glow.addColorStop(0, hexA(accent, 0.22));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  // Wordmark
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '600 40px ui-monospace, Menlo, monospace';
  ctx.fillText('◎  SIXTH SENSE', W / 2, 130);

  // Flag + nation
  ctx.font = '120px "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  ctx.fillText(moment.flag, W / 2, 340);
  ctx.fillStyle = '#9ca3af';
  ctx.font = '500 38px system-ui, sans-serif';
  ctx.fillText(moment.nation.toUpperCase(), W / 2, 400);

  // The moment headline (wrapped)
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 76px system-ui, sans-serif';
  wrapText(ctx, moment.swingDesc, W / 2, 560, W - 160, 84);

  // Big swing number
  if (moment.swingPct > 0) {
    ctx.fillStyle = accent;
    ctx.font = '900 220px system-ui, sans-serif';
    ctx.fillText(`${moment.swingPct}%`, W / 2, 900);
    ctx.fillStyle = '#6b7280';
    ctx.font = '500 34px system-ui, sans-serif';
    ctx.fillText('momentum swing witnessed live', W / 2, 950);
  }

  // Rarity + level pill
  roundRect(ctx, W / 2 - 210, 1010, 420, 76, 38);
  ctx.fillStyle = hexA(accent, 0.16);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.font = '700 38px system-ui, sans-serif';
  ctx.fillText(`${moment.rarity.toUpperCase()} · LVL ${moment.level}`, W / 2, 1060);

  // Match label
  ctx.fillStyle = '#6b7280';
  ctx.font = '400 34px system-ui, sans-serif';
  ctx.fillText(moment.match + ' · World Cup 2026', W / 2, 1160);

  // Verification stamp — honest: only when actually on-chain.
  if (opts.verified) {
    ctx.fillStyle = '#34d399';
    ctx.font = '600 40px system-ui, sans-serif';
    ctx.fillText('✓ Verified on Solana', W / 2, 1250);
    if (opts.assetId) {
      ctx.fillStyle = '#4b5563';
      ctx.font = '400 26px ui-monospace, monospace';
      ctx.fillText(shorten(opts.assetId), W / 2, 1292);
    }
  } else {
    ctx.fillStyle = '#4b5563';
    ctx.font = '400 34px system-ui, sans-serif';
    ctx.fillText('witnessed live', W / 2, 1250);
  }

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  );
  return { blob, dataUrl: canvas.toDataURL('image/png') };
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' ');
  let line = '';
  const lines: string[] = [];
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  const startY = y - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lh));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function shorten(id: string): string {
  return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id;
}
