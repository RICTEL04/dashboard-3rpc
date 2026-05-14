import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/hana';
import { sql } from '@/lib/queries';
import { cached } from '@/lib/cache';
import type { Anomaly, VolumeRow } from '@/types';

/**
 * Warm-up endpoint: pre-loads small/aggregated datasets (anomalies + volume)
 * into the server-side cache so every subsequent SWR call gets an instant
 * cache hit with zero additional HANA connections.
 *
 * system-logs and llm-logs are intentionally excluded: they can hold tens of
 * thousands of rows and storing them all in the Node.js heap simultaneously
 * with the other datasets causes an OOM crash on CF (1.5 GB limit).
 * Those endpoints still benefit from request coalescing — only one HANA query
 * runs even if multiple SWR hooks fire at the same time — but the result is
 * not retained in the in-process cache after the response is sent.
 *
 * Called once by the Sidebar whenever the time-window (h) changes.
 */
export async function GET(req: NextRequest) {
  const h    = Math.min(Math.max(Number(req.nextUrl.searchParams.get('h') ?? 24), 1), 168);
  const hVol = h + 1; // volume route adds +1 to include logs beyond the window edge

  try {
    await Promise.all([
      cached(`anomalies-${h}`,              () => query<Anomaly>(sql.anomalies(h))),
      cached(`volume-SYSTEM_LOGS-${hVol}`,  () => query<VolumeRow>(sql.volume('SYSTEM_LOGS', hVol))),
      cached(`volume-LLM_LOGS-${hVol}`,     () => query<VolumeRow>(sql.volume('LLM_LOGS', hVol))),
    ]);

    return NextResponse.json({ ok: true, h }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[/api/prefetch]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
