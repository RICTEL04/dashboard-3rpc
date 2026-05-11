'use client';

import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { Bot, ChevronDown, ChevronUp } from 'lucide-react';
import { KpiCard } from '@/components/ui/KpiCard';
import { VolumeChart } from '@/components/charts/VolumeChart';
import type { LlmLog, VolumeRow } from '@/types';

const GRANS  = ['5min', '10min', '30min', '1h'] as const;
const COLORS = ['#00CC96','#636EFA','#FFA15A','#AB63FA','#19D3F3','#FECB52'];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function counts<T>(arr: T[], key: keyof T) {
  const map = new Map<string, number>();
  for (const item of arr) {
    const k = String(item[key] ?? '(vacío)');
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, value]) => ({ name, value }));
}

function groupAvg<T>(arr: T[], groupKey: keyof T, valueKey: keyof T) {
  const groups = new Map<string, number[]>();
  for (const item of arr) {
    const g = String(item[groupKey] ?? '');
    const v = Number(item[valueKey]);
    if (!isNaN(v)) {
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(v);
    }
  }
  return [...groups.entries()].map(([name, vals]) => ({
    name,
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    p95: vals.sort((a, b) => a - b)[Math.floor(vals.length * 0.95)] ?? 0,
    count: vals.length,
  }));
}

function groupSum<T>(arr: T[], groupKey: keyof T, valueKey: keyof T) {
  const map = new Map<string, number>();
  for (const item of arr) {
    const k = String(item[groupKey] ?? '');
    const v = Number(item[valueKey]);
    if (!isNaN(v)) map.set(k, (map.get(k) ?? 0) + v);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

import { Suspense } from 'react';

function LlmLogsContent() {
  const sp    = useSearchParams();
  const hours = Math.max(Number(sp.get('h') ?? 24), 1);
  const [gran, setGran] = useState('10min');
  const [page, setPage] = useState(0);
  const [showPrompts, setShowPrompts] = useState(false);
  const PAGE_SIZE = 100;

  const { data: logsRes, isLoading } =
    useSWR(`/api/llm-logs?h=${hours}`, fetcher, { refreshInterval: 60_000 });
  const { data: volRes } =
    useSWR(`/api/volume?table=LLM_LOGS&h=${hours}`, fetcher, { refreshInterval: 60_000 });

  const logs: LlmLog[] = logsRes?.data ?? [];
  const vol:  VolumeRow[] = volRes?.data  ?? [];

  const totalCost  = useMemo(() => logs.reduce((s, l) => s + (Number(l.llm_cost_usd)     || 0), 0), [logs]);
  const totalTok   = useMemo(() => logs.reduce((s, l) => s + (Number(l.llm_total_tokens) || 0), 0), [logs]);
  const avgLatency = useMemo(() => {
    const vals = logs.map((l) => Number(l.llm_response_time_ms)).filter((v) => !isNaN(v) && v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [logs]);

  const modelDist    = useMemo(() => counts(logs, 'llm_model_id'),                      [logs]);
  const latByModel   = useMemo(() => groupAvg(logs, 'llm_model_id', 'llm_response_time_ms'), [logs]);
  const costByRegion = useMemo(() => groupSum(logs, 'macro_region', 'llm_cost_usd'),    [logs]);
  const finishDist   = useMemo(() => counts(logs, 'llm_finish_reason'),                 [logs]);

  const pageLogs  = logs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(logs.length / PAGE_SIZE);
  const withPrompt = logs.filter((l) => l.llm_prompt);

  if (isLoading) {
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
        <div className="w-9 h-9 rounded-lg bg-brand-green/10 border border-brand-green/20
                        flex items-center justify-center">
          <Bot className="w-5 h-5 text-brand-green" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-text-primary">LLM Logs</h1>
          <p className="text-xs text-text-secondary">Logs de modelos LLM · últimas {hours}h</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total peticiones"  value={logs.length.toLocaleString()}          accent="#00CC96" />
        <KpiCard label="Latencia promedio" value={`${avgLatency.toFixed(0)} ms`}         accent="#19D3F3" />
        <KpiCard label="Costo total"       value={`$${totalCost.toFixed(4)}`}            accent="#FFA15A" />
        <KpiCard label="Tokens consumidos" value={totalTok.toLocaleString()}             accent="#AB63FA" />
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
                {modelDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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
                {finishDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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
                formatter={(v: number) => [`${v.toFixed(0)} ms`]} />
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
                tickFormatter={(v) => `$${v.toFixed(3)}`} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#8b949e', fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [`$${v.toFixed(4)}`, 'Costo']} />
              <Bar dataKey="value" fill="#FFA15A" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data table */}
      <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Datos crudos — {logs.length.toLocaleString()} registros
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
              {pageLogs.map((l) => (
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
      {withPrompt.length > 0 && (
        <div className="bg-surface-raised border border-surface-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowPrompts((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-overlay transition-colors"
          >
            <span className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
              llm_prompt — muestra de {Math.min(50, withPrompt.length)} registros
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
                  {withPrompt.slice(0, 50).map((l) => (
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
