// LIVE source — the real TxLINE feed (FR-R1, FR-R4, FR-R6).
//
// Subscribes to BOTH the scores and odds SSE streams for one fixture, feeds them through
// a single shared Normalizer (so a surge tick fuses odds `Pct` with live possession),
// tees every raw event to replay-<fixtureId>.jsonl for later REPLAY, and auto-reconnects
// with Last-Event-ID resume. Credentials stay server-side (NFR-3).

import fs from 'node:fs';
import type { Sink, Source } from '../types.js';
import { Normalizer } from '../normalize.js';
import { authHeaders, loadSession, type TxSession } from '../session.js';

const RECONNECT_MS = 3000;

export class LiveSource implements Source {
  readonly mode = 'live' as const;
  private readonly norm: Normalizer;
  private readonly session: TxSession;
  private readonly capture: fs.WriteStream | null;
  private controllers = new Set<AbortController>();
  private stopped = false;

  constructor(
    readonly fixtureId: number,
    opts: { session?: TxSession; capturePath?: string } = {},
  ) {
    this.norm = new Normalizer(fixtureId);
    this.session = opts.session ?? loadSession();
    const capturePath = opts.capturePath ?? `replay-${fixtureId}.jsonl`;
    this.capture = process.env.NO_CAPTURE ? null : fs.createWriteStream(capturePath, { flags: 'a' });
  }

  async run(sink: Sink): Promise<void> {
    // Both upstream streams run concurrently into the one sink; run() resolves when both end.
    await Promise.all([
      this.streamForever('scores', (raw) => this.norm.ingestScores(raw), sink),
      this.streamForever('odds', (raw) => this.norm.ingestOdds(raw), sink),
    ]);
    this.capture?.end();
  }

  private async streamForever(
    stream: 'scores' | 'odds',
    ingest: (raw: unknown) => ReturnType<Normalizer['ingestScores']>,
    sink: Sink,
  ): Promise<void> {
    let lastEventId: string | null = null;
    while (!this.stopped) {
      try {
        lastEventId = await this.streamOnce(stream, ingest, sink, lastEventId);
      } catch (err) {
        if (this.stopped) return;
        console.warn(`[live ${this.fixtureId}/${stream}] ${(err as Error).message}; reconnecting…`);
      }
      if (this.stopped) return;
      await sleep(RECONNECT_MS);
    }
  }

  private async streamOnce(
    stream: 'scores' | 'odds',
    ingest: (raw: unknown) => ReturnType<Normalizer['ingestScores']>,
    sink: Sink,
    lastEventId: string | null,
  ): Promise<string | null> {
    const ac = new AbortController();
    this.controllers.add(ac);
    const headers = authHeaders(this.session);
    if (lastEventId) headers['Last-Event-ID'] = lastEventId;
    const url = `${this.session.base}/api/${stream}/stream?fixtureId=${this.fixtureId}`;
    try {
      const res = await fetch(url, { headers, signal: ac.signal });
      if (!res.ok || !res.body) throw new Error(`${stream} stream HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let id = lastEventId;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return id;
        buf += dec.decode(value, { stream: true });
        let sep: number;
        while ((sep = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          const idLine = block.split('\n').find((l) => l.startsWith('id:'));
          if (idLine) id = idLine.slice(3).trim();
          const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
          const data = dataLine?.slice(5).trim();
          if (!data) continue;
          let raw: unknown;
          try {
            raw = JSON.parse(data);
          } catch {
            continue;
          }
          this.capture?.write(JSON.stringify({ t: Date.now(), stream, raw }) + '\n');
          for (const ev of ingest(raw)) sink(ev);
        }
      }
    } finally {
      this.controllers.delete(ac);
    }
  }

  stop(): void {
    this.stopped = true;
    for (const ac of this.controllers) ac.abort();
    this.controllers.clear();
    this.capture?.end();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
