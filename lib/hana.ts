// eslint-disable-next-line @typescript-eslint/no-require-imports
const hana = require('@sap/hana-client') as { createConnection(): HanaConnection };

interface HanaConnection {
  connect(params: Record<string, unknown>, cb: (err: Error | null) => void): void;
  exec(sql: string, cb: (err: Error | null, rows: Record<string, unknown>[]) => void): void;
  prepare(sql: string, cb: (err: Error | null, stmt: HanaStatement) => void): void;
  disconnect(): void;
}
interface HanaStatement {
  execQuery(cb: (err: Error | null, rs: HanaResultSet) => void): void;
}
interface HanaResultSet {
  getColumnInfo(): Array<{ columnName: string }>;
  getValues(): unknown[];
  next(cb: (err: Error | null, hasMore: boolean) => void): void;
  close(cb?: (err: Error | null) => void): void;
}

function connParams(): Record<string, unknown> {
  return {
    host:                  process.env.HANA_HOST,
    port:                  Number(process.env.HANA_PORT ?? 443),
    uid:                   process.env.HANA_USER,
    pwd:                   process.env.HANA_PASS,
    encrypt:               'true',
    sslValidateCertificate:'false',
    sslCryptoProvider:     'openssl',
  };
}

/** Load all rows into memory at once. Use only for small/aggregated queries. */
export function query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const conn = hana.createConnection();
    conn.connect(connParams(), (connectErr) => {
      if (connectErr) { reject(connectErr); return; }
      conn.exec(sql, (execErr, rows) => {
        conn.disconnect();
        if (execErr) { reject(execErr); return; }
        const normalised = rows.map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([k, v]) => [k.toLowerCase(), v])
          )
        ) as T[];
        resolve(normalised);
      });
    });
  });
}

/**
 * Stream rows one-by-one from HANA.
 *
 * This is the memory-safe alternative to query() for large tables
 * (system-logs, llm-logs). The Node.js heap never holds more than a single
 * row at a time regardless of how many rows HANA returns, so the dataset
 * size does not affect memory consumption.
 *
 * Pass `signal` from the incoming Request so the generator stops early if
 * the client disconnects before all rows are delivered.
 */
export async function* queryStream<T = Record<string, unknown>>(
  sqlStr: string,
  signal?: AbortSignal,
): AsyncGenerator<T> {
  const conn = hana.createConnection();

  await new Promise<void>((res, rej) =>
    conn.connect(connParams(), (err) => (err ? rej(err) : res()))
  );

  const stmt = await new Promise<HanaStatement>((res, rej) =>
    conn.prepare(sqlStr, (err, s) => (err ? rej(err) : res(s)))
  );

  const rs = await new Promise<HanaResultSet>((res, rej) =>
    stmt.execQuery((err, r) => (err ? rej(err) : res(r)))
  );

  // Column names resolved once — reused for every row
  const cols = rs.getColumnInfo().map((c) => c.columnName.toLowerCase());

  try {
    while (!signal?.aborted) {
      const hasMore = await new Promise<boolean>((res, rej) =>
        rs.next((err, more) => (err ? rej(err) : res(more)))
      );
      if (!hasMore) break;

      const vals = rs.getValues();
      yield Object.fromEntries(cols.map((c, i) => [c, vals[i]])) as T;
    }
  } finally {
    try { rs.close(); } catch { /* ignore */ }
    conn.disconnect();
  }
}
