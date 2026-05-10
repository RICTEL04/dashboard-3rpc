// eslint-disable-next-line @typescript-eslint/no-require-imports
const hana = require('@sap/hana-client') as {
  createConnection(): {
    connect(params: Record<string, unknown>, cb: (err: Error | null) => void): void;
    exec(sql: string, cb: (err: Error | null, rows: Record<string, unknown>[]) => void): void;
    disconnect(): void;
  };
};

export function query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const conn = hana.createConnection();
    const params: Record<string, unknown> = {
      host:                  process.env.HANA_HOST,
      port:                  Number(process.env.HANA_PORT ?? 443),
      uid:                   process.env.HANA_USER,
      pwd:                   process.env.HANA_PASS,
      encrypt:               'true',
      sslValidateCertificate:'false',
      sslCryptoProvider:     'openssl',
    };
    conn.connect(params, (connectErr) => {
      if (connectErr) { reject(connectErr); return; }
      conn.exec(sql, (execErr, rows) => {
        conn.disconnect();
        if (execErr) { reject(execErr); return; }
        // Normalise column names to lowercase (HANA returns them as stored)
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
