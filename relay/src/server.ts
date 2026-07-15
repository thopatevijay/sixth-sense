// The relay HTTP server — SSE fan-out to browsers (FR-R1, FR-R3).
//
// GET /stream?fixtureId=<n>&mode=live|replay|mock  → SSE of the union (mode-agnostic client)
// GET /health                                      → JSON status + active streams
// GET /                                            → bare browser test page (Gate 1)
//
// TxLINE credentials never cross this boundary — only normalized union events do (NFR-3).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FixtureHub } from './hub.js';
import type { Mode, UnionEvent } from './types.js';

const PORT = Number(process.env.PORT) || 8787;
const DEFAULT_MODE = (process.env.RELAY_DEFAULT_MODE as Mode) || 'mock';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const KEEPALIVE_MS = 15_000;
const VALID_MODES: Mode[] = ['live', 'replay', 'mock'];

const hub = new FixtureHub();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_PAGE = path.resolve(__dirname, '../public/test.html');

function cors(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function handleStream(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
  const fixtureId = Number(url.searchParams.get('fixtureId'));
  const mode = (url.searchParams.get('mode') as Mode) || DEFAULT_MODE;
  if (!Number.isFinite(fixtureId) || fixtureId <= 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'fixtureId query param required' }));
    return;
  }
  if (!VALID_MODES.includes(mode)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `mode must be one of ${VALID_MODES.join('|')}` }));
    return;
  }

  cors(res);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable proxy buffering (nginx/CloudFront)
  });
  res.write(`retry: 3000\n\n`);
  res.write(`event: ready\ndata: ${JSON.stringify({ mode, fixtureId })}\n\n`);

  const send = (ev: UnionEvent) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
  // A source that fails to start (e.g. missing session for LIVE) must NOT crash the server.
  let unsubscribe: () => void = () => {};
  try {
    unsubscribe = hub.subscribe(mode, fixtureId, send);
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ message: (err as Error).message })}\n\n`);
    res.end();
    return;
  }
  const keepalive = setInterval(() => res.write(`:ka\n\n`), KEEPALIVE_MS);

  const cleanup = () => {
    clearInterval(keepalive);
    unsubscribe();
  };
  req.on('close', cleanup);
  req.on('error', cleanup);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === '/stream') return handleStream(req, res, url);

  if (url.pathname === '/health') {
    cors(res);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, defaultMode: DEFAULT_MODE, streams: hub.stats() }));
    return;
  }

  if (url.pathname === '/' || url.pathname === '/test') {
    if (fs.existsSync(TEST_PAGE)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      fs.createReadStream(TEST_PAGE).pipe(res);
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  console.log(`SIXTH SENSE relay on http://localhost:${PORT}  (default mode: ${DEFAULT_MODE})`);
  console.log(`  test page:  http://localhost:${PORT}/`);
  console.log(`  stream:     http://localhost:${PORT}/stream?fixtureId=18198205&mode=mock`);
});
