'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend,
} from 'recharts';
import { Activity, AlertTriangle } from 'lucide-react';
import { KpiCard } from '@/components/ui/KpiCard';
import { SeverityBadge, TypeBadge } from '@/components/ui/SeverityBadge';
import { VolumeChart } from '@/components/charts/VolumeChart';
import type { Anomaly, AnomalyDetails, VolumeRow, Severity, AnomalyType } from '@/types';

const SEV_COLOR: Record<Severity, string> = {
  HIGH: '#EF553B', MEDIUM: '#FFA15A', LOW: '#FECB52',
};
const TYPE_COLOR: Record<AnomalyType, string> = {
  SPIKE: '#EF553B', MULTI_BUCKET: '#636EFA', CATEGORIZATION: '#FFA15A',
};
const GRANS = ['1min', '5min', '10min', '30min', '1h'] as const;

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function fmt(ts: string) {
  return new Date(ts).toLocaleString('es', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function AnomalyCard({ a, isSelected }: { a: Anomaly; isSelected?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSelected) return;
    setOpen(true);
    setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }, [isSelected]);
  let details: AnomalyDetails = {};
  try { details = JSON.parse(a.details_json || '{}'); } catch { /* empty */ }
  const devs = details.top_deviations ?? [];

  return (
    <div
      ref={ref}
      className={`border rounded-xl overflow-hidden mb-2 transition-colors
                  ${isSelected
                    ? 'border-brand-blue ring-1 ring-brand-blue/40'
                    : 'border-surface-border hover:border-surface-overlay'}`}
    >
      {/* Header row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex flex-wrap items-center gap-2 px-4 py-3 text-left
                   hover:bg-surface-raised/60 transition-colors"
      >
        <SeverityBadge severity={a.severity} />
        <TypeBadge type={a.anomaly_type as AnomalyType} />
        <span className="text-xs text-text-secondary font-mono">{fmt(a.bucket_start)}</span>
        {a.attack_category && a.attack_category !== 'N/A' && (
          <span className="text-xs text-brand-orange bg-brand-orange/10 border border-brand-orange/20
                           px-2 py-0.5 rounded font-medium">
            {a.attack_category}
          </span>
        )}
        <span className="ml-auto text-xs font-mono text-text-muted">
          score {Number(a.anomaly_score ?? 0).toFixed(4)}
        </span>
        <span className="text-text-muted text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-surface-border bg-surface-base px-4 py-4 space-y-4">
          <p className="text-sm text-text-secondary">
            <span className="text-text-muted font-semibold uppercase text-[10px] tracking-wider mr-2">
              Razón
            </span>
            {a.reason}
          </p>

          {/* KPI row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Requests',   value: a.n_requests.toLocaleString() },
              { label: 'IPs únicas', value: String(a.n_unique_ips) },
              { label: 'Error rate', value: (a.error_rate * 100).toFixed(1) + '%' },
              { label: 'IP top',     value: a.top_ip || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-surface-raised rounded-lg px-3 py-2">
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{label}</div>
                <div className="text-sm font-mono font-semibold text-text-primary truncate">{value}</div>
              </div>
            ))}
          </div>

          {/* Top deviations */}
          {devs.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
                Features más desviadas del baseline
              </p>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      {['Feature', 'Valor', 'Baseline', 'Z-Score', 'Dir'].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {devs.slice(0, 8).map((d, i) => (
                      <tr key={i}>
                        <td className="font-mono">{d.label}</td>
                        <td>{typeof d.value === 'number' ? d.value.toFixed(4) : String(d.value)}</td>
                        <td>{typeof d.baseline === 'number' ? d.baseline.toFixed(4) : String(d.baseline)}</td>
                        <td style={{ color: d.z_score > 0 ? '#EF553B' : '#636EFA' }}>
                          {d.z_score > 0 ? '+' : ''}{d.z_score.toFixed(2)}
                        </td>
                        <td className="text-text-muted">{d.direction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Z-score mini bar */}
              <div className="mt-3" style={{ height: Math.max(120, devs.slice(0, 8).length * 28) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={devs.slice(0, 8).map((d) => ({
                      name: d.label.slice(0, 30),
                      z: Math.abs(d.z_score),
                      dir: d.direction,
                    }))}
                    layout="vertical"
                    margin={{ top: 0, right: 10, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,110,250,.06)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#8b949e', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#8b949e', fontSize: 10 }} axisLine={false} tickLine={false} width={140} />
                    <Tooltip
                      contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, fontSize: 11 }}
                      formatter={(v) => [(v as number).toFixed(2), '|Z-Score|']}
                    />
                    <Bar dataKey="z" radius={[0, 3, 3, 0]}>
                      {devs.slice(0, 8).map((d, i) => (
                        <Cell key={i} fill={d.direction.includes('alto') ? '#EF553B' : '#636EFA'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Feature snapshot for CATEGORIZATION */}
          {a.anomaly_type === 'CATEGORIZATION' && details.feature_snapshot && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
                Feature snapshot
              </p>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Feature</th><th>Valor en ventana</th></tr></thead>
                  <tbody>
                    {Object.entries(details.feature_snapshot)
                      .filter(([, v]) => v !== null)
                      .map(([k, v]) => (
                        <tr key={k}>
                          <td className="font-mono">{k}</td>
                          <td>{String(v)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnomaliesPage() {
  const sp    = useSearchParams();
  const hours = Math.max(Number(sp.get('h') ?? 24), 1);

  const [gran, setGran]             = useState<string>('10min');
  const [sevFilter, setSevFilter]   = useState<Severity[]>(['HIGH', 'MEDIUM', 'LOW']);
  const [typeFilter, setTypeFilter] = useState<AnomalyType[]>(['SPIKE', 'MULTI_BUCKET', 'CATEGORIZATION']);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleAnomalyClick = useCallback((anomalyId: string) => {
    setSelectedId(anomalyId);
  }, []);

  const { data: anomRes, isLoading: loadAnom, error: errAnom } =
    useSWR(`/api/anomalias?h=${hours}`, fetcher, { refreshInterval: 60_000 });
  const { data: volSysRes } =
    useSWR(`/api/volume?table=SYSTEM_LOGS&h=${hours}`, fetcher, { refreshInterval: 60_000 });
  const { data: volLlmRes } =
    useSWR(`/api/volume?table=LLM_LOGS&h=${hours}`, fetcher, { refreshInterval: 60_000 });

  const anomalies: Anomaly[]   = anomRes?.data   ?? [];
  const volSys:    VolumeRow[] = volSysRes?.data  ?? [];
  const volLlm:    VolumeRow[] = volLlmRes?.data  ?? [];
  const volAll = [...volSys, ...volLlm];

  const toggleSev  = useCallback((s: Severity) =>
    setSevFilter((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]), []);
  const toggleType = useCallback((t: AnomalyType) =>
    setTypeFilter((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t]), []);

  const filtered = anomalies.filter(
    (a) => sevFilter.includes(a.severity) && typeFilter.includes(a.anomaly_type as AnomalyType)
  );

  const high   = anomalies.filter((a) => a.severity === 'HIGH').length;
  const medium = anomalies.filter((a) => a.severity === 'MEDIUM').length;
  const low    = anomalies.filter((a) => a.severity === 'LOW').length;
  const worst  = anomalies.length ? Math.min(...anomalies.map((a) => a.anomaly_score)) : 0;

  // Chart data: attack categories
  const catData = Object.entries(
    anomalies.reduce<Record<string, number>>((acc, a) => {
      const k = a.attack_category || 'Desconocido';
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {})
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Chart data: type + severity pivot
  const pivotData = Object.entries(
    anomalies.reduce<Record<string, Record<string, number>>>((acc, a) => {
      if (!acc[a.anomaly_type]) acc[a.anomaly_type] = { HIGH: 0, MEDIUM: 0, LOW: 0 };
      acc[a.anomaly_type][a.severity] = (acc[a.anomaly_type][a.severity] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([type, counts]) => ({ type, ...counts }));

  if (loadAnom) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-text-secondary">
        <span className="w-5 h-5 rounded-full border-2 border-brand-blue border-t-transparent animate-spin" />
        Cargando anomalías…
      </div>
    );
  }

  if (errAnom) {
    return (
      <div className="p-6">
        <div className="bg-brand-red/10 border border-brand-red/30 rounded-xl p-4 text-brand-red text-sm">
          Error al conectar con HANA Cloud: {String(errAnom)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-red/10 border border-brand-red/20
                        flex items-center justify-center">
          <Activity className="w-5 h-5 text-brand-red" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-text-primary">Detección de Anomalías</h1>
          <p className="text-xs text-text-secondary">Pipeline ML · últimas {hours}h</p>
        </div>
      </div>

      {anomalies.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-text-secondary">
          <AlertTriangle className="w-10 h-10 opacity-30" />
          <p className="text-sm">No hay anomalías en las últimas {hours} horas.</p>
          <p className="text-xs text-text-muted">Ejecuta ml_pipeline.py para generar detecciones.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <KpiCard label="Total anomalías" value={anomalies.length} accent="#636EFA" />
            <KpiCard label="Alta severidad"  value={high}   accent="#EF553B" />
            <KpiCard label="Media severidad" value={medium} accent="#FFA15A" />
            <KpiCard label="Baja severidad"  value={low}    accent="#FECB52" />
            <KpiCard label="Peor score"      value={worst.toFixed(4)} accent="#AB63FA" />
          </div>

          {/* Volume + anomaly timeline */}
          <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                Timeline de actividad y anomalías
              </h2>
              <div className="flex gap-1">
                {GRANS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGran(g)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors
                                ${gran === g
                                  ? 'bg-brand-blue text-white'
                                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay'
                                }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <VolumeChart
              rows={volAll} gran={gran} color="#636EFA" height={280}
              anomalies={anomalies} onAnomalyClick={handleAnomalyClick}
            />
          </div>

          {/* Category + severity charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
                Categorías de ataque
              </h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={catData}
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,110,250,.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} width={130} />
                  <Tooltip
                    contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [v, 'Anomalías']}
                  />
                  <Bar dataKey="value" fill="#EF553B" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
                Distribución por tipo y severidad
              </h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={pivotData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,110,250,.06)" vertical={false} />
                  <XAxis dataKey="type" tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#8b949e' }} />
                  {(['HIGH', 'MEDIUM', 'LOW'] as Severity[]).map((s) => (
                    <Bar key={s} dataKey={s} stackId="a" fill={SEV_COLOR[s]} radius={s === 'LOW' ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Anomaly detail table */}
          <div className="bg-surface-raised border border-surface-border rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                Detalle de anomalías ({filtered.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {(['HIGH', 'MEDIUM', 'LOW'] as Severity[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSev(s)}
                    className="px-2.5 py-1 rounded text-xs font-semibold border transition-colors"
                    style={{
                      color:       sevFilter.includes(s) ? SEV_COLOR[s] : '#484f58',
                      background:  sevFilter.includes(s) ? `${SEV_COLOR[s]}15` : 'transparent',
                      borderColor: sevFilter.includes(s) ? `${SEV_COLOR[s]}40` : '#30363d',
                    }}
                  >
                    {s}
                  </button>
                ))}
                {(['SPIKE', 'MULTI_BUCKET', 'CATEGORIZATION'] as AnomalyType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleType(t)}
                    className="px-2.5 py-1 rounded text-xs font-semibold border transition-colors"
                    style={{
                      color:       typeFilter.includes(t) ? TYPE_COLOR[t] : '#484f58',
                      background:  typeFilter.includes(t) ? `${TYPE_COLOR[t]}15` : 'transparent',
                      borderColor: typeFilter.includes(t) ? `${TYPE_COLOR[t]}40` : '#30363d',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="text-sm text-text-secondary text-center py-8">
                Ninguna anomalía coincide con los filtros.
              </p>
            ) : (
              <div className="space-y-1">
                {filtered
                  .sort((a, b) => a.anomaly_score - b.anomaly_score)
                  .map((a) => (
                    <AnomalyCard key={a.anomaly_id} a={a} isSelected={a.anomaly_id === selectedId} />
                  ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
