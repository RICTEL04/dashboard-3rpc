import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/hana';
import { sql } from '@/lib/queries';

export async function GET(req: NextRequest) {
  const h = Math.min(Math.max(Number(req.nextUrl.searchParams.get('h') ?? 24), 1), 168);

  async function test(name: string, sqlStr: string) {
    try {
      const rows = await query(sqlStr);
      return { name, ok: true, sample: rows.slice(0, 2), total: rows.length };
    } catch (err) {
      return { name, ok: false, error: String(err) };
    }
  }

  const results = await Promise.all([
    test('sys_total',         sql.systemLogsTotal(h)),
    test('sys_unique_ips',    sql.systemLogsUniqueIps(h)),
    test('sys_sec_events',    sql.systemLogsSecEvents(h)),
    test('sys_logtype',       sql.systemLogsLogtypeDist(h)),
    test('sys_http_status',   sql.systemLogsHttpStatusDist(h)),
    test('sys_top_ips',       sql.systemLogsTopIps(h)),
    test('sys_env',           sql.systemLogsEnvDist(h)),
    test('sys_region',        sql.systemLogsRegionDist(h)),
    test('sys_page_0',        sql.systemLogsPage(h, 0, 5)),
    test('llm_total',         sql.llmLogsTotal(h)),
    test('llm_cost',          sql.llmLogsTotalCost(h)),
    test('llm_tokens',        sql.llmLogsTotalTokens(h)),
    test('llm_avg_latency',   sql.llmLogsAvgLatency(h)),
    test('llm_model',         sql.llmLogsModelDist(h)),
    test('llm_avg_by_model',  sql.llmLogsAvgByModel(h)),
    test('llm_p95_by_model',  sql.llmLogsP95ByModel(h)),
    test('llm_cost_region',   sql.llmLogsCostByRegion(h)),
    test('llm_finish',        sql.llmLogsFinishDist(h)),
    test('llm_region',        sql.llmLogsRegionDist(h)),
    test('llm_page_0',        sql.llmLogsPage(h, 0, 5)),
    test('llm_prompts',       sql.llmLogsPrompts(h, 3)),
  ]);

  return NextResponse.json({ h, results }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
