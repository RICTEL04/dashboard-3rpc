import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/hana';
import { sql } from '@/lib/queries';
import { cached } from '@/lib/cache';

const PAGE_SIZE = 100;

type Row = Record<string, unknown>;

async function sc(key: string, fetcher: () => Promise<Row[]>): Promise<Row[]> {
  try { return await cached(key, fetcher); }
  catch (err) { console.error(`[llm-logs] ${key}:`, err); return []; }
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
    // Fetch p95 separately — PERCENTILE_CONT may not be available in all HANA versions
    const [
      totalRows, costRows, tokensRows, latencyRows,
      modelDist, avgByModel, p95ByModel,
      costByRegion, finishDist, regionDist, prompts,
      rows,
    ] = await Promise.all([
      sc(`llm-total-${h}`,   () => query<Row>(sql.llmLogsTotal(h))),
      sc(`llm-cost-${h}`,    () => query<Row>(sql.llmLogsTotalCost(h))),
      sc(`llm-tokens-${h}`,  () => query<Row>(sql.llmLogsTotalTokens(h))),
      sc(`llm-lat-${h}`,     () => query<Row>(sql.llmLogsAvgLatency(h))),
      sc(`llm-model-${h}`,   () => query<Row>(sql.llmLogsModelDist(h))),
      sc(`llm-avg-${h}`,     () => query<Row>(sql.llmLogsAvgByModel(h))),
      sc(`llm-p95-${h}`,     () => query<Row>(sql.llmLogsP95ByModel(h))),
      sc(`llm-cregion-${h}`, () => query<Row>(sql.llmLogsCostByRegion(h))),
      sc(`llm-finish-${h}`,  () => query<Row>(sql.llmLogsFinishDist(h))),
      sc(`llm-region-${h}`,  () => query<Row>(sql.llmLogsRegionDist(h))),
      sc(`llm-prompts-${h}`, () => query<Row>(sql.llmLogsPrompts(h, 50))),
      query<Row>(sql.llmLogsPage(h, offset, PAGE_SIZE)).catch(err => {
        console.error('[llm-logs] page:', err); return [] as Row[];
      }),
    ]);

    const total      = val(totalRows);
    const total_cost = val(costRows);
    const total_tok  = val(tokensRows);
    const total_pages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1;

    // Merge avg and p95 by model name
    const p95Map = new Map<string, number>();
    for (const r of p95ByModel) {
      const name = String(r.name ?? r.NAME ?? '');
      p95Map.set(name, Number(r.p95 ?? r.P95 ?? 0));
    }
    const latByModel = avgByModel.map(r => ({
      name:  String(r.name  ?? r.NAME  ?? ''),
      avg:   Number(r.avg   ?? r.AVG   ?? 0),
      count: Number(r.count ?? r.COUNT ?? 0),
      p95:   p95Map.get(String(r.name ?? r.NAME ?? '')) ?? 0,
    }));

    // avg_latency: use dedicated query, fall back to weighted avg across models
    const directAvg = val(latencyRows);
    const totalLatCount = latByModel.reduce((s, r) => s + r.count, 0);
    const weightedAvg   = totalLatCount > 0
      ? latByModel.reduce((s, r) => s + r.avg * r.count, 0) / totalLatCount
      : 0;
    const avg_latency = directAvg > 0 ? directAvg : weightedAvg;

    return NextResponse.json({
      stats: {
        total, total_cost, total_tokens: total_tok, avg_latency,
        model_dist: modelDist, lat_by_model: latByModel,
        cost_by_region: costByRegion, finish_dist: finishDist,
        region_dist: regionDist,
        has_prompts: prompts.length > 0,
        prompts,
      },
      data: rows, count: total, page, total_pages,
    }, { headers: { 'Cache-Control': 'public, max-age=55, stale-while-revalidate=5' } });

  } catch (err) {
    console.error('[/api/llm-logs]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
