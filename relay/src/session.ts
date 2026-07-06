// Loads TxLINE credentials for LIVE mode. Creds stay server-side only — they are
// never sent to the browser (NFR-3). Produced by scripts/txline-auth.mjs.

import fs from 'node:fs';

export interface TxSession {
  network: 'devnet' | 'mainnet';
  base: string;
  jwt: string;
  apiToken: string;
  wallet?: string;
  txSig?: string;
}

const SESSION_PATH = process.env.TX_SESSION_PATH || '.txline-session.json';

/** Load creds from the session file, or fall back to env vars. Throws if neither is present. */
export function loadSession(): TxSession {
  if (process.env.TX_BASE && process.env.TX_JWT && process.env.TX_API_TOKEN) {
    return {
      network: (process.env.TX_NET as TxSession['network']) || 'devnet',
      base: process.env.TX_BASE,
      jwt: process.env.TX_JWT,
      apiToken: process.env.TX_API_TOKEN,
    };
  }
  if (!fs.existsSync(SESSION_PATH)) {
    throw new Error(
      `No TxLINE session. Run \`npm run auth\` to create ${SESSION_PATH}, ` +
        'or set TX_BASE/TX_JWT/TX_API_TOKEN. (Not needed for MOCK/REPLAY modes.)',
    );
  }
  const s = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8')) as TxSession;
  if (!s.jwt || !s.apiToken || !s.base) throw new Error(`Malformed session at ${SESSION_PATH}`);
  return s;
}

/** Headers every TxLINE data call must send (Authorization + X-Api-Token). */
export function authHeaders(s: TxSession, accept = 'text/event-stream'): Record<string, string> {
  return { Authorization: `Bearer ${s.jwt}`, 'X-Api-Token': s.apiToken, Accept: accept };
}
