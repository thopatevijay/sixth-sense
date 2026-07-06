// FixtureHub — one upstream connection per (mode, fixture), fanned out to many
// browser clients (FR-R5). The first subscriber starts the source; the last to leave
// stops it. Late joiners immediately get the last known SURGE so their bar isn't blank.

import type { Mode, Sink, Source, SurgeTick, UnionEvent } from './types.js';
import { MockSource } from './sources/mock.js';
import { ReplaySource } from './sources/replay.js';
import { LiveSource } from './sources/live.js';

interface StreamEntry {
  source: Source;
  subscribers: Set<Sink>;
  lastSurge?: SurgeTick;
}

export class FixtureHub {
  private streams = new Map<string, StreamEntry>();

  private key(mode: Mode, fixtureId: number): string {
    return `${mode}:${fixtureId}`;
  }

  private createSource(mode: Mode, fixtureId: number): Source {
    switch (mode) {
      case 'mock':
        return new MockSource(fixtureId);
      case 'replay':
        return new ReplaySource(fixtureId);
      case 'live':
        return new LiveSource(fixtureId);
    }
  }

  /** Attach a client. Returns an unsubscribe fn. Starts the upstream on first subscriber. */
  subscribe(mode: Mode, fixtureId: number, sink: Sink): () => void {
    const key = this.key(mode, fixtureId);
    let entry = this.streams.get(key);

    if (!entry) {
      const source = this.createSource(mode, fixtureId);
      entry = { source, subscribers: new Set() };
      this.streams.set(key, entry);
      const fanout: Sink = (ev: UnionEvent) => {
        if (ev.type === 'surge') entry!.lastSurge = ev;
        for (const s of entry!.subscribers) s(ev);
      };
      source
        .run(fanout)
        .catch((err) => console.error(`[hub ${key}] source error:`, (err as Error).message))
        .finally(() => this.streams.delete(key));
    }

    entry.subscribers.add(sink);
    if (entry.lastSurge) sink(entry.lastSurge); // prime the late joiner

    return () => {
      const e = this.streams.get(key);
      if (!e) return;
      e.subscribers.delete(sink);
      if (e.subscribers.size === 0) {
        e.source.stop();
        this.streams.delete(key);
      }
    };
  }

  /** Live diagnostics for the health endpoint. */
  stats(): Array<{ key: string; clients: number }> {
    return [...this.streams.entries()].map(([key, e]) => ({ key, clients: e.subscribers.size }));
  }
}
