import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/hana';
import { sql } from '@/lib/queries';
import type { LlmLog } from '@/types';

export async function GET(req: NextRequest) {
  const h = Math.min(Math.max(Number(req.nextUrl.searchParams.get('h') ?? 24), 1), 168);

  try {
    const data = await query<LlmLog>(sql.llmLogs(h));
    return NextResponse.json({ data, count: data.length }, {
      headers: { 'Cache-Control': 'public, max-age=55, stale-while-revalidate=5' },
    });
  } catch (err) {
    console.error('[/api/llm-logs]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
