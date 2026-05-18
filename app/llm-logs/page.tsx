'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Bot, ChevronDown, ChevronUp } from 'lucide-react';
import { KpiCard } from '@/components/ui/KpiCard';
import { VolumeChart } from '@/components/charts/VolumeChart';
import type { LlmLog, VolumeRow } from '@/types';

const GRANS  = ['5min', '10min', '30min', '1h'] as const;
const COLORS = ['#00CC96','#636EFA','#FFA15A','#AB63FA','#19D3F3','#FECB52'];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function LlmLogsContent() {
  const sp    = useSearchParams();
  const hours = Math.max(Number(sp.get('h') ?? 24), 1);
  const [gran, setGran] = useState('10min');
  const [page, setPage] = useState(0);
  const [showPrompts, setShowPrompts] = useState(false);

  const [lastH, setLastH] = useState(hours);
  if (lastH !== hours) { setLastH(hours); setPage(0); }

  const { data: logsRes, isLoading } =
    useSWR(`/api/llm-logs?h=${hours}&page=${page}`, fetcher, { refreshInterval: 60_000 });
  const { data: volRes } =
    useSWR(`/api/volume?table=LLM_LOGS&h=${hours}`, fetcher, { refreshInterval: 60_000 });

  const stats      = logsRes?.stats ?? {};
  const rows: LlmLog[]   = logsRes?.data ?? [];
  const vol: VolumeRow[] = volRes?.data  ?? [];

  const total       = Number(stats.total        ?? 0);
  const totalCost   = Number(stats.total_cost   ?? 0);
  const totalTok    = Number(stats.total_tokens ?? 0);
  const avgLatency  = Number(stats.avg_latency  ?? 0);
  const modelDist   = stats.model_dist     ?? [];
  const latByModel  = stats.lat_by_model   ?? [];
  const costByRegion= stats.cost_by_region ?? [];
  const finishDist  = stats.finish_dist    ?? [];
  const hasPrompts  = stats.has_prompts    ?? false;
  const prompts     = stats.prompts        ?? [];
  const totalPages  = logsRes?.total_pages ?? 1;

  if (isLoading && page === 0) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-text-secondary">
        <span className="w-5 h-5 rounded-full border-2 border-brand-green border-t-transparent animate-spin" />
        Cargando LLM Logs…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #00CC96 0%, #008f68 100%)',
            boxShadow: '0 0 26px rgba(0,204,150,0.38), 0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.14)',
            border: '1px solid rgba(0,204,150,0.45)',
          }}
        >
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-text-primary">LLM Logs</h1>
          <p className="text-xs text-text-secondary">Logs de modelos LLM · últimas {hours}h</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total peticiones"  value={total.toLocaleString()}              accent="#00CC96" />
        <KpiCard label="Latencia promedio" value={`${avgLatency.toFixed(0)} ms`}       accent="#19D3F3" />
        <KpiCard label="Costo total"       value={`$${totalCost.toFixed(4)}`}          accent="#FFA15A" />
        <KpiCard label="Tokens consumidos" value={totalTok.toLocaleString()}           accent="#AB63FA" />
      </div>

      {/* Volume timeline */}
      <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Volumen de peticiones LLM
          </h2>
          <div className="flex gap-1">
            {GRANS.map((g) => (
              <button key={g} onClick={() => setGran(g)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors
                            ${gran === g ? 'bg-brand-green text-white'
                              : 'text-text-secondary hover:bg-surface-overlay'}`}>
                {g}
              </button>
            ))}
          </div>
        </div>
        <VolumeChart rows={vol} gran={gran} color="#00CC96" height={250} />
      </div>

      {/* Distribution charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Model distribution donut */}
        <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            Distribución de modelos LLM
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={modelDist} dataKey="value" nameKey="name"
                   cx="50%" cy="50%" innerRadius="40%" outerRadius="68%" paddingAngle={2}>
                {modelDist.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#8b949e' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Finish reason */}
        <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            Finish Reason
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={finishDist} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,110,250,.06)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {finishDist.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Latency avg+p95 by model */}
        <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            Latencia por modelo (avg · p95) ms
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={latByModel} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,110,250,.06)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [`${Number(v).toFixed(0)} ms`]} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#8b949e' }} />
              <Bar dataKey="avg" name="Promedio" fill="#00CC96" radius={[4, 4, 0, 0]} />
              <Bar dataKey="p95" name="p95"      fill="#FFA15A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cost by region */}
        <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            Costo acumulado por región (USD)
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={costByRegion} layout="vertical" margin={{ top: 0, right: 10, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,110,250,.06)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `$${Number(v).toFixed(3)}`} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#8b949e', fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [`$${Number(v).toFixed(4)}`, 'Costo']} />
              <Bar dataKey="value" fill="#FFA15A" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data table */}
      <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Datos crudos — {total.toLocaleString()} registros
          </h2>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="px-2 py-1 rounded bg-surface-overlay disabled:opacity-30 hover:bg-surface-border transition-colors">←</button>
              <span>{page + 1} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="px-2 py-1 rounded bg-surface-overlay disabled:opacity-30 hover:bg-surface-border transition-colors">→</button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto max-h-96 rounded-lg">
          <table className="data-table">
            <thead>
              <tr>
                {['Timestamp', 'Modelo', 'Latencia (ms)', 'Costo (USD)', 'Tokens', 'Finish', 'Región', 'Status'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l._id}>
                  <td className="font-mono text-xs">{l.timestamp?.slice(0, 19)}</td>
                  <td className="font-mono text-xs">{l.llm_model_id}</td>
                  <td>{Number(l.llm_response_time_ms).toFixed(0)}</td>
                  <td>${Number(l.llm_cost_usd).toFixed(5)}</td>
                  <td>{Number(l.llm_total_tokens).toLocaleString()}</td>
                  <td>{l.llm_finish_reason}</td>
                  <td>{l.macro_region}</td>
                  <td>{l.llm_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Prompts section */}
      {hasPrompts && (
        <div className="bg-surface-raised border border-surface-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowPrompts((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-overlay transition-colors"
          >
            <span className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
              llm_prompt — muestra de {Math.min(50, prompts.length)} registros
            </span>
            {showPrompts ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
          </button>
          {showPrompts && (
            <div className="border-t border-surface-border overflow-x-auto max-h-80">
              <table className="data-table">
                <thead>
                  <tr><th>Timestamp</th><th>Modelo</th><th>Prompt</th></tr>
                </thead>
                <tbody>
                  {prompts.map((l: { _id: string; timestamp: string; llm_model_id: string; llm_prompt: string }) => (
                    <tr key={l._id}>
                      <td className="font-mono text-xs">{l.timestamp?.slice(0, 19)}</td>
                      <td className="font-mono text-xs">{l.llm_model_id}</td>
                      <td style={{ maxWidth: 500, whiteSpace: 'pre-wrap', overflow: 'hidden' }}>
                        {String(l.llm_prompt).slice(0, 200)}
                        {String(l.llm_prompt).length > 200 && '…'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default function LlmLogsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64 gap-3 text-text-secondary">
        <span className="w-5 h-5 rounded-full border-2 border-brand-green border-t-transparent animate-spin" />
        Cargando LLM Logs…
      </div>
    }>
      <LlmLogsContent />
    </Suspense>
  );
}
