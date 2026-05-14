'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { ShieldAlert } from 'lucide-react';
import { KpiCard } from '@/components/ui/KpiCard';
import { VolumeChart } from '@/components/charts/VolumeChart';
import type { SystemLog, VolumeRow } from '@/types';

const GRANS  = ['5min', '10min', '30min', '1h'] as const;
const COLORS = ['#636EFA','#00CC96','#FFA15A','#AB63FA','#19D3F3','#FECB52'];
const STATUS_COLOR = (code: number) =>
  code >= 500 ? '#EF553B' : code >= 400 ? '#FFA15A' : '#00CC96';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function SystemLogsPage() {
  const sp    = useSearchParams();
  const hours = Math.max(Number(sp.get('h') ?? 24), 1);
  const [gran, setGran] = useState('10min');
  const [page, setPage] = useState(0);

  // When h changes, reset to page 0
  const [lastH, setLastH] = useState(hours);
  if (lastH !== hours) { setLastH(hours); setPage(0); }

  const { data: logsRes, isLoading } =
    useSWR(`/api/system-logs?h=${hours}&page=${page}`, fetcher, { refreshInterval: 60_000 });
  const { data: volRes } =
    useSWR(`/api/volume?table=SYSTEM_LOGS&h=${hours}`, fetcher, { refreshInterval: 60_000 });

  // Stats come pre-computed from HANA — no client-side aggregation needed
  const stats      = logsRes?.stats ?? {};
  const rows: SystemLog[] = logsRes?.data ?? [];
  const vol: VolumeRow[]  = volRes?.data  ?? [];

  const total       = stats.total          ?? 0;
  const uniqIps     = stats.unique_ips     ?? 0;
  const secEvents   = stats.security_events ?? 0;
  const logtypeDist = stats.logtype_dist   ?? [];
  const statusDist  = (stats.http_status_dist ?? []).map(
    (d: { name: string; value: number }) => ({ ...d, color: STATUS_COLOR(Number(d.name)) })
  );
  const topIps      = stats.top_ips   ?? [];
  const envDist     = stats.env_dist  ?? [];

  const totalPages  = logsRes?.total_pages ?? 1;

  if (isLoading && page === 0) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-text-secondary">
        <span className="w-5 h-5 rounded-full border-2 border-brand-blue border-t-transparent animate-spin" />
        Cargando System Logs…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-blue/10 border border-brand-blue/20
                        flex items-center justify-center">
          <ShieldAlert className="w-5 h-5 text-brand-blue" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-text-primary">System Logs</h1>
          <p className="text-xs text-text-secondary">Logs de sistema SAP · últimas {hours}h</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total registros"      value={Number(total).toLocaleString()}    accent="#636EFA" />
        <KpiCard label="IPs únicas"           value={Number(uniqIps).toLocaleString()} accent="#19D3F3" />
        <KpiCard label="Eventos de seguridad" value={Number(secEvents).toLocaleString()}
                 sub={total ? `${(Number(secEvents) / Number(total) * 100).toFixed(1)}% del total` : undefined}
                 accent="#EF553B" />
        <KpiCard label="Tipo de logs"         value={logtypeDist.length} accent="#AB63FA" />
      </div>

      {/* Volume timeline */}
      <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Volumen de logs
          </h2>
          <div className="flex gap-1">
            {GRANS.map((g) => (
              <button key={g} onClick={() => setGran(g)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors
                            ${gran === g ? 'bg-brand-blue text-white'
                              : 'text-text-secondary hover:bg-surface-overlay'}`}>
                {g}
              </button>
            ))}
          </div>
        </div>
        <VolumeChart rows={vol} gran={gran} color="#636EFA" height={250} />
      </div>

      {/* Distribution charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Logtype bar */}
        <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            Logs por tipo
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={logtypeDist} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,110,250,.06)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {logtypeDist.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* HTTP Status */}
        <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            HTTP Status Codes
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusDist} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,110,250,.06)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {statusDist.map((d: { color: string }, i: number) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top IPs */}
        <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            Top 10 IPs por actividad
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topIps} layout="vertical" margin={{ top: 0, right: 10, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,110,250,.06)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#8b949e', fontSize: 10 }} axisLine={false} tickLine={false} width={120} />
              <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" fill="#EF553B" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* App env donut */}
        <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            Actividad por entorno (sap_app_env)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={envDist} dataKey="value" nameKey="name"
                   cx="50%" cy="50%" innerRadius="45%" outerRadius="70%" paddingAngle={2}>
                {envDist.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#8b949e' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data table */}
      <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Datos crudos — {Number(total).toLocaleString()} registros
          </h2>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2 py-1 rounded bg-surface-overlay disabled:opacity-30 hover:bg-surface-border transition-colors">
                ←
              </button>
              <span>{page + 1} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-2 py-1 rounded bg-surface-overlay disabled:opacity-30 hover:bg-surface-border transition-colors">
                →
              </button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto max-h-96 rounded-lg">
          <table className="data-table">
            <thead>
              <tr>
                {['Timestamp', 'Source IP', 'Log Type', 'Status', 'HTTP', 'Región', 'Env', 'Seg.'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l._id}>
                  <td className="font-mono text-xs">{l.timestamp?.slice(0, 19)}</td>
                  <td className="font-mono">{l.sourceip}</td>
                  <td>{l.logtype}</td>
                  <td>{l.status}</td>
                  <td style={{ color: STATUS_COLOR(l.http_status_code) }}>{l.http_status_code}</td>
                  <td>{l.macro_region}</td>
                  <td>{l.sap_app_env}</td>
                  <td>
                    {l.is_security_event ? (
                      <span className="text-brand-red font-bold">✓</span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
