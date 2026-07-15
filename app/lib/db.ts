// Server-only Postgres pool. Reused across hot-reloads via a global so dev doesn't leak pools.
// Never imported into client components (it holds DB creds — NFR-3).

import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var _sixthSensePool: Pool | undefined;
}

export function hasDb(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool(): Pool {
  if (!global._sixthSensePool) {
    global._sixthSensePool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return global._sixthSensePool;
}
