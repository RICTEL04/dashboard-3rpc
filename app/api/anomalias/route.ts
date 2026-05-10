import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/hana';
import { sql } from '@/lib/queries';
import type { Anomaly } from '@/types';

export async function GET(req: NextRequest) {
  const h = Math.min(Math.max(Number(req.nextUrl.searchParams.get('h') ?? 24), 1), 168);

  try {
    let data = await query<Anomaly>(sql.anomalies(h));

    // Fallback: if attack_category column doesn't exist in the schema yet
    if (data.length > 0 && !('attack_category' in data[0])) {
      data = data.map((r) => ({ ...r, attack_category: 'N/A' }));
    }

    return NextResponse.json({ data, count: data.length }, {
      headers: { 'Cache-Control': 'public, max-age=55, stale-while-revalidate=5' },
    });
  } catch (err) {
    // Retry without attack_category column if schema is old
    try {
      const fallbackSql = sql.anomalies(h).replace('"attack_category",', '');
      const data = (await query<Anomaly>(fallbackSql)).map((r) => ({
        ...r, attack_category: 'N/A',
      }));
      return NextResponse.json({ data, count: data.length });
    } catch (err2) {
      console.error('[/api/anomalias]', err2);
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }
}
