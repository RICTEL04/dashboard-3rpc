import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/hana';
import { sql } from '@/lib/queries';
import { cached } from '@/lib/cache';

const PAGE_SIZE = 100;

type Row = Record<string, unknown>;

async function sc(key: string, fetcher: () => Promise<Row[]>): Promise<Row[]> {
  try { return await cached(key, fetcher); }
  catch (err) { console.error(`[sys-logs] ${key}:`, err); return []; }
}

function val(rows: Row[]): number {
  if (!rows.length) return 0;
  const r = rows[0];
  return Number(r.v ?? r.V ?? 0);
}

export async function GET(req: NextRequest) {
  const h      = Math.min(Math.max(Number(req.nextUrl.searchParams.get('h')    ?? 24), 1), 168);
  const page   = Math.max(Number(req.nextUrl.searchParams.get('page') ?? 0), 0);
  const offset = page * PAGE_SIZE;

  try {
    const [
      totalRows, uniqueIpsRows, secEventsRows,
      logtypeDist, httpStatusDist, topIps, envDist, regionDist,
      rows,
    ] = await Promise.all([
      sc(`sys-total-${h}`,   () => query<Row>(sql.systemLogsTotal(h))),
      sc(`sys-uniq-${h}`,    () => query<Row>(sql.systemLogsUniqueIps(h))),
      sc(`sys-sec-${h}`,     () => query<Row>(sql.systemLogsSecEvents(h))),
      sc(`sys-logtype-${h}`, () => query<Row>(sql.systemLogsLogtypeDist(h))),
      sc(`sys-http-${h}`,    () => query<Row>(sql.systemLogsHttpStatusDist(h))),
      sc(`sys-topips-${h}`,  () => query<Row>(sql.systemLogsTopIps(h))),
      sc(`sys-env-${h}`,     () => query<Row>(sql.systemLogsEnvDist(h))),
      sc(`sys-region-${h}`,  () => query<Row>(sql.systemLogsRegionDist(h))),
      query<Row>(sql.systemLogsPage(h, offset, PAGE_SIZE)).catch(err => {
        console.error('[sys-logs] page:', err); return [] as Row[];
      }),
    ]);

    const total      = val(totalRows);
    const unique_ips = val(uniqueIpsRows);
    const sec_events = val(secEventsRows);
    const total_pages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1;

    return NextResponse.json({
      stats: {
        total, unique_ips, security_events: sec_events,
        logtype_dist: logtypeDist, http_status_dist: httpStatusDist,
        top_ips: topIps, env_dist: envDist, region_dist: regionDist,
      },
      data: rows, count: total, page, total_pages,
    }, { headers: { 'Cache-Control': 'public, max-age=55, stale-while-revalidate=5' } });

  } catch (err) {
    console.error('[/api/system-logs]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
