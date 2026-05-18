'use client';

import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, Cell, PieChart, Pie,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { KpiCard } from '@/components/ui/KpiCard';
import type { VolumeRow } from '@/types';

const COLORS  = ['#636EFA','#00CC96','#FFA15A','#AB63FA','#19D3F3','#FECB52'];
const GRANS   = ['5min', '10min', '30min', '1h'] as const;
const GRAN_MS: Record<string, number> = {
  '5min': 300_000, '10min': 600_000, '30min': 1_800_000, '1h': 3_600_000,
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function buildCombinedVolume(sys: VolumeRow[], llm: VolumeRow[], gran: string) {
  const ms = GRAN_MS[gran] ?? GRAN_MS['10min'];
  const sysB = new Map<number, number>();
  const llmB = new Map<number, number>();
  for (const r of sys) {
    const b = Math.floor(new Date(r.minute_str + ':00Z').getTime() / ms) * ms;
    sysB.set(b, (sysB.get(b) ?? 0) + Number(r.cnt));
  }
  for (const r of llm) {
    const b = Math.floor(new Date(r.minute_str + ':00Z').getTime() / ms) * ms;
    llmB.set(b, (llmB.get(b) ?? 0) + Number(r.cnt));
  }
  const all = new Set([...sysB.keys(), ...llmB.keys()]);
  return [...all].sort().map((t) => ({
    time:    t,
    Sistema: sysB.get(t) ?? 0,
    LLM:     llmB.get(t) ?? 0,
    Total:   (sysB.get(t) ?? 0) + (llmB.get(t) ?? 0),
  }));
}

function fmtTick(t: number) {
  return new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}
function fmtLabel(t: number) {
  return new Date(t).toLocaleString('es', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const CHART_STYLE = {
  background: '#0d1117', border: '1px solid rgba(99,110,250,0.18)', borderRadius: 10, fontSize: 12,
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)', color: '#e6edf3',
};
const CURSOR_BAR  = { fill: 'rgba(255,255,255,0.04)' };
const CURSOR_LINE = { stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 };

export default function ResumenPage() {
  const sp    = useSearchParams();
  const hours = Math.max(Number(sp.get('h') ?? 24), 1);
  const [gran, setGran] = useState('10min');

  // Use page=0 to get stats + first page. Only stats matter here (no raw rows needed).
  const { data: sysRes, isLoading: loadSys } =
    useSWR(`/api/system-logs?h=${hours}&page=0`, fetcher, { refreshInterval: 60_000 });
  const { data: llmRes, isLoading: loadLlm } =
    useSWR(`/api/llm-logs?h=${hours}&page=0`,    fetcher, { refreshInterval: 60_000 });
  const { data: volSysRes } =
    useSWR(`/api/volume?table=SYSTEM_LOGS&h=${hours}`, fetcher, { refreshInterval: 60_000 });
  const { data: volLlmRes } =
    useSWR(`/api/volume?table=LLM_LOGS&h=${hours}`,    fetcher, { refreshInterval: 60_000 });

  const sysStats = sysRes?.stats ?? {};
  const llmStats = llmRes?.stats ?? {};
  const volSys: VolumeRow[] = volSysRes?.data ?? [];
  const volLlm: VolumeRow[] = volLlmRes?.data ?? [];

  // KPI values directly from pre-aggregated stats
  const sysTotal    = Number(sysStats.total           ?? 0);
  const llmTotal    = Number(llmStats.total           ?? 0);
  const secEvents   = Number(sysStats.security_events ?? 0);
  const totalCost   = Number(llmStats.total_cost      ?? 0);
  const totalTok    = Number(llmStats.total_tokens    ?? 0);

  // Distribution charts from stats
  const sysTypeDist = sysStats.logtype_dist ?? [];
  const llmTypeDist = llmStats.model_dist   ?? [];

  // Combined top 10 regions: merge sys + llm region distributions
  const topRegions = useMemo(() => {
    const sysReg: { name: string; value: number }[] = sysStats.region_dist ?? [];
    const llmReg: { name: string; value: number }[] = llmStats.region_dist ?? [];
    const map = new Map<string, number>();
    for (const r of [...sysReg, ...llmReg]) {
      if (r.name) map.set(r.name, (map.get(r.name) ?? 0) + Number(r.value));
    }
    return [...map.entries()].sort(([, a], [, b]) => b - a).slice(0, 10)
      .map(([name, value]) => ({ name, value }));
  }, [sysStats.region_dist, llmStats.region_dist]);

  const secPie = useMemo(() => [
    { name: 'Seguridad', value: secEvents,              fill: '#EF553B' },
    { name: 'Normal',    value: sysTotal - secEvents,   fill: '#00CC96' },
  ], [sysTotal, secEvents]);

  const combinedVol = useMemo(() => buildCombinedVolume(volSys, volLlm, gran), [volSys, volLlm, gran]);

  const loading = loadSys || loadLlm;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-text-secondary">
        <span className="w-5 h-5 rounded-full border-2 border-brand-purple border-t-transparent animate-spin" />
        Cargando datos…
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
            background: 'linear-gradient(135deg, #AB63FA 0%, #7c35d4 100%)',
            boxShadow: '0 0 26px rgba(171,99,250,0.38), 0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.14)',
            border: '1px solid rgba(171,99,250,0.45)',
          }}
        >
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-text-primary">Resumen General</h1>
          <p className="text-xs text-text-secondary">Vista consolidada · últimas {hours}h</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <KpiCard label="Logs de Sistema"       value={sysTotal.toLocaleString()}    accent="#636EFA" />
        <KpiCard label="Logs LLM"              value={llmTotal.toLocaleString()}    accent="#00CC96" />
        <KpiCard label="Eventos de Seguridad"  value={secEvents.toLocaleString()}
                 sub={sysTotal ? `${(secEvents / sysTotal * 100).toFixed(1)}% del total` : undefined}
                 accent="#EF553B" />
        <KpiCard label="Costo LLM Total"       value={`$${totalCost.toFixed(4)}`}  accent="#FFA15A" />
        <KpiCard label="Tokens consumidos"     value={totalTok.toLocaleString()}   accent="#AB63FA" />
      </div>

      {/* Combined volume timeline */}
      <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Volumen total de logs
          </h2>
          <div className="flex gap-1">
            {GRANS.map((g) => (
              <button key={g} onClick={() => setGran(g)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors
                            ${gran === g ? 'bg-brand-purple text-white'
                              : 'text-text-secondary hover:bg-surface-overlay'}`}>
                {g}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={combinedVol} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#636EFA" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#636EFA" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,110,250,.06)" vertical={false} />
            <XAxis dataKey="time" type="number" scale="time" domain={['auto', 'auto']}
                   tickFormatter={fmtTick} tick={{ fill: '#8b949e', fontSize: 11 }}
                   axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip cursor={CURSOR_LINE} contentStyle={CHART_STYLE} labelFormatter={(t) => fmtLabel(t as number)} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#8b949e' }} />
            <Area type="monotone" dataKey="Total"   stroke="#636EFA" strokeWidth={1.5} fill="url(#gradTotal)" dot={false} />
            <Area type="monotone" dataKey="Sistema" stroke="#EF553B" strokeWidth={1.5} fill="none"            dot={false} />
            <Area type="monotone" dataKey="LLM"     stroke="#00CC96" strokeWidth={1.5} fill="none"            dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Distribution charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* System logtype */}
        <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            Tipo de log — Sistema
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sysTypeDist} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,110,250,.06)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={CURSOR_BAR} contentStyle={CHART_STYLE} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {sysTypeDist.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* LLM model donut */}
        <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            Distribución de modelos — LLM
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={llmTypeDist} dataKey="value" nameKey="name"
                   cx="50%" cy="50%" innerRadius="40%" outerRadius="65%" paddingAngle={2}>
                {llmTypeDist.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip cursor={CURSOR_BAR} contentStyle={CHART_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#8b949e' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top regions */}
        <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            Top 10 regiones — actividad total
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topRegions} layout="vertical" margin={{ top: 0, right: 10, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,110,250,.06)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#8b949e', fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
              <Tooltip cursor={CURSOR_BAR} contentStyle={CHART_STYLE} />
              <Bar dataKey="value" fill="#636EFA" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Security vs Normal donut */}
        <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            Seguridad vs Normal — Sistema
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={secPie} dataKey="value" nameKey="name"
                   cx="50%" cy="50%" innerRadius="42%" outerRadius="68%" paddingAngle={3}
                   label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                   labelLine={false}>
                {secPie.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip cursor={CURSOR_BAR} contentStyle={CHART_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#8b949e' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}
