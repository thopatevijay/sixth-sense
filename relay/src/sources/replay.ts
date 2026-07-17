// REPLAY source — deterministic playback of a captured match (FR-R4).
//
// Reads replay-<fixtureId>.jsonl and re-emits it through the SAME normalizer as LIVE,
// preserving the original inter-arrival timing. A file captured in LIVE therefore
// replays byte-for-byte-equivalently — the browser can't tell the difference (FR-R3).
//
// Two line formats are supported:
//   1. Envelope  {"t": <recvMs>, "raw": {...}, "stream": "scores"|"odds"}  (relay capture)
//   2. Bare raw  {...}  possibly carrying "Ts" (epoch seconds)             (scripts/txline-capture.mjs)

import fs from 'node:fs';
import readline from 'node:readline';
import type { Sink, Source } from '../types.js';
import { Normalizer } from '../normalize.js';

interface Line {
  gapMs: number; // delay after the previous line
  raw: unknown;
  stream: 'scores' | 'odds';
}

const DEFAULT_GAP_MS = 800;

export class ReplaySource implements Source {
  readonly mode = 'replay' as const;
  private norm: Normalizer;
  private readonly path: string;
  private readonly speed: number;
  private readonly maxGapMs: number;
  private readonly loop: boolean;
  private stopped = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    readonly fixtureId: number,
    opts: { path?: string; speed?: number; maxGapMs?: number; loop?: boolean } = {},
  ) {
    this.norm = new Normalizer(fixtureId);
    this.path = opts.path ?? process.env.REPLAY_PATH ?? `replay-${fixtureId}.jsonl`;
    this.speed = opts.speed ?? (Number(process.env.REPLAY_SPEED) || 1);
    // Clamp long dead gaps (e.g. 15s heartbeat spacing) so demos stay watchable.
    this.maxGapMs = opts.maxGapMs ?? (Number(process.env.REPLAY_MAX_GAP_MS) || 4000);
    // Loop the arc so a deployed demo link never dead-ends (FR-D1).
    this.loop = opts.loop ?? (process.env.REPLAY_LOOP === '1' || process.env.REPLAY_LOOP === 'true');
  }

  private async load(): Promise<Line[]> {
    if (!fs.existsSync(this.path)) {
      throw new Error(`REPLAY file not found: ${this.path} (capture one in LIVE mode first)`);
    }
    const lines: Line[] = [];
    let prevT: number | null = null;
    const rl = readline.createInterface({ input: fs.createReadStream(this.path), crlfDelay: Infinity });
    for await (const line of rl) {
      const s = line.trim();
      if (!s) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(s);
      } catch {
        continue;
      }
      const env = parsed as { t?: number; raw?: unknown; stream?: 'scores' | 'odds' };
      const isEnvelope = env && typeof env === 'object' && 'raw' in env;
      const raw = isEnvelope ? env.raw : parsed;
      const stream = isEnvelope && env.stream === 'odds' ? 'odds' : 'scores';

      // Timing: prefer the envelope receive-time; else the payload's Ts.
      // Ts may be epoch ms (13 digits) or seconds (10 digits) — detect, don't assume.
      const rawTs = (raw as { Ts?: number })?.Ts;
      const tMs = isEnvelope && typeof env.t === 'number'
        ? env.t
        : typeof rawTs === 'number'
          ? (rawTs > 1e12 ? rawTs : rawTs * 1000)
          : null;

      let gapMs = DEFAULT_GAP_MS;
      if (tMs !== null && prevT !== null) gapMs = Math.max(0, tMs - prevT);
      if (tMs !== null) prevT = tMs;
      lines.push({ gapMs, raw, stream });
    }
    return lines;
  }

  async run(sink: Sink): Promise<void> {
    const lines = await this.load();
    do {
      for (let i = 0; i < lines.length; i++) {
        if (this.stopped) return;
        const line = lines[i]!;
        if (i > 0) await this.wait(Math.min(line.gapMs, this.maxGapMs) / this.speed);
        if (this.stopped) return;
        const events = line.stream === 'odds' ? this.norm.ingestOdds(line.raw) : this.norm.ingestScores(line.raw);
        for (const ev of events) sink(ev);
      }
      if (this.loop && !this.stopped) {
        await this.wait(2500); // brief breath, then replay the arc from a clean slate
        this.norm = new Normalizer(this.fixtureId);
      }
    } while (this.loop && !this.stopped);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.timer = setTimeout(resolve, ms);
    });
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }
}
