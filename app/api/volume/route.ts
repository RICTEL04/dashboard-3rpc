import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/hana';
import { sql } from '@/lib/queries';
import { cached } from '@/lib/cache';
import type { VolumeRow } from '@/types';

const ALLOWED = new Set(['SYSTEM_LOGS', 'LLM_LOGS']);

export async function GET(req: NextRequest) {
  // +1 extra hour so recent logs beyond the nominal window edge are included,
  // ensuring anomaly bucket_start timestamps always have volume data to render against.
  const h     = Math.min(Math.max(Number(req.nextUrl.searchParams.get('h') ?? 24), 1), 168) + 1;
  const table = req.nextUrl.searchParams.get('table') ?? 'SYSTEM_LOGS';

  if (!ALLOWED.has(table)) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
  }

  try {
    const data = await cached(`volume-${table}-${h}`, () => query<VolumeRow>(sql.volume(table, h)));
    return NextResponse.json({ data }, {
      headers: { 'Cache-Control': 'public, max-age=55, stale-while-revalidate=5' },
    });
  } catch (err) {
    console.error('[/api/volume]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
