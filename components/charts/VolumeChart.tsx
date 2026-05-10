'use client';

import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Scatter, Legend, ResponsiveContainer,
} from 'recharts';
import type { VolumeRow, Severity } from '@/types';

const SEV_COLOR: Record<Severity, string> = {
  HIGH:   '#EF553B',
  MEDIUM: '#FFA15A',
  LOW:    '#FECB52',
};

const TYPE_COLOR: Record<string, string> = {
  SPIKE:          '#EF553B',
  MULTI_BUCKET:   '#636EFA',
  CATEGORIZATION: '#FFA15A',
};

const SEV_OPACITY: Record<Severity, number> = {
  HIGH: 1.0, MEDIUM: 0.75, LOW: 0.5,
};

const GRAN_MS: Record<string, number> = {
  '1min':  1  * 60_000,
  '5min':  5  * 60_000,
  '10min': 10 * 60_000,
  '30min': 30 * 60_000,
  '1h':    60 * 60_000,
};

// How far apart X-axis ticks should be, per granularity
const TICK_STEP: Record<string, number> = {
  '1min':  5  * 60_000,
  '5min':  15 * 60_000,
  '10min': 30 * 60_000,
  '30min': 2  * 3_600_000,
  '1h':    4  * 3_600_000,
};

interface AnomalyMarker {
  anomaly_id?:      string;
  bucket_start:     string;
  severity:         Severity;
  anomaly_type:     string;
  attack_category?: string;
  anomaly_score?:   number;
  n_requests?:      number;
  error_rate?:      number;
  n_unique_ips?:    number;
  reason?:          string;
}

interface VolumeChartProps {
  rows:             VolumeRow[];
  gran?:            string;
  color?:           string;
  height?:          number;
  anomalies?:       AnomalyMarker[];
  onAnomalyClick?:  (anomalyId: string) => void;
}

// HANA returns timestamps as "YYYY-MM-DD HH:MI:SS.nnnnnnnnn" with no timezone marker.
// JS parses space-separated dates without 'Z' as local time — force UTC.
function parseHanaUtc(ts: string): number {
  const s = ts.trim().replace(' ', 'T').replace(/(\.\d{3})\d*/, '$1');
  return new Date(s.includes('Z') || s.includes('+') ? s : s + 'Z').getTime();
}

function fmtTick(t: number) {
  return new Date(t).toLocaleTimeString('es', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });
}

function fmtLabel(t: number) {
  return new Date(t).toLocaleString('es', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }) + ' UTC';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;

  // Area and Scatter both emit payloads — scan all entries for anomaly data
  const anomEntry = payload.find((p) => Boolean(p?.payload?.anomaly_type));
  const first     = anomEntry ?? payload[0];
  const d         = first?.payload ?? {};
  const isAnom    = Boolean(d.anomaly_type);

  const base: React.CSSProperties = {
    background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
    fontSize: 12, padding: '8px 12px', maxWidth: 300,
    boxShadow: '0 4px 16px rgba(0,0,0,.4)',
  };

  if (!isAnom) {
    return (
      <div style={base}>
        <div style={{ color: '#8b949e', marginBottom: 4 }}>{fmtLabel(d.time)}</div>
        <div style={{ color: '#e6edf3' }}><b>{d.count}</b> logs</div>
      </div>
    );
  }

  const typeColor  = TYPE_COLOR[d.anomaly_type] ?? '#888';
  const bucketMs   = d.bucket_start ? parseHanaUtc(d.bucket_start) : (d.time as number);
  const localDate  = isNaN(bucketMs) ? '—' : new Date(bucketMs).toLocaleString('es', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const utcDate    = isNaN(bucketMs) ? '—' : new Date(bucketMs).toLocaleString('es', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC',
  }) + ' UTC';

  return (
    <div style={base}>
      {/* Dates */}
      <div style={{ color: '#8b949e', fontSize: 10, marginBottom: 6, lineHeight: 1.6 }}>
        <div>{localDate}</div>
        <div style={{ color: '#484f58' }}>{utcDate}</div>
      </div>

      {/* Type */}
      <div style={{ color: typeColor, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
        {d.anomaly_type}
      </div>

      {/* Category */}
      <div style={{ color: '#8b949e', fontSize: 11, marginBottom: 3 }}>
        Categoría:&nbsp;
        <span style={{ color: '#e6edf3' }}>
          {d.attack_category && d.attack_category !== 'N/A' ? d.attack_category : '—'}
        </span>
      </div>

      {/* Score + logs */}
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#8b949e', marginBottom: 6 }}>
        <span>
          Score:&nbsp;
          <span style={{ color: '#e6edf3', fontFamily: 'monospace' }}>
            {Number(d.anomaly_score ?? 0).toFixed(4)}
          </span>
        </span>
        {d.n_requests != null && (
          <span>
            Logs:&nbsp;<span style={{ color: '#e6edf3', fontWeight: 600 }}>{Number(d.n_requests).toLocaleString()}</span>
          </span>
        )}
      </div>

      <div style={{ color: '#636EFA', fontSize: 10, fontWeight: 600 }}>
        🖱 Clic para ver detalle completo
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AnomalyShape(props: any) {
  const { cx, cy, payload, onAnomalyClick } = props;
  if (cx == null || cy == null) return null;

  const type   = payload?.anomaly_type ?? '';
  const sev    = payload?.severity as Severity;
  const c      = TYPE_COLOR[type] ?? '#888';
  const op     = SEV_OPACITY[sev] ?? 0.8;
  const stroke = '#0d1117';
  const sw     = 1.5;

  const handleClick = () => {
    if (onAnomalyClick && payload?.anomaly_id) {
      onAnomalyClick(payload.anomaly_id);
    }
  };

  let shape: React.ReactElement;

  if (type === 'SPIKE') {
    shape = (
      <polygon
        points={`${cx},${cy - 8} ${cx + 7},${cy + 5} ${cx - 7},${cy + 5}`}
        fill={c} fillOpacity={op} stroke={stroke} strokeWidth={sw}
      />
    );
  } else if (type === 'MULTI_BUCKET') {
    shape = (
      <polygon
        points={`${cx},${cy - 8} ${cx + 7},${cy} ${cx},${cy + 8} ${cx - 7},${cy}`}
        fill={c} fillOpacity={op} stroke={stroke} strokeWidth={sw}
      />
    );
  } else {
    shape = (
      <polygon
        points={`${cx},${cy - 8} ${cx + 7},${cy + 5} ${cx - 7},${cy + 5}`}
        fill={c} fillOpacity={op} stroke={stroke} strokeWidth={sw}
      />
    );
  }

  return (
    <g
      onClick={handleClick}
      style={{ cursor: onAnomalyClick && payload?.anomaly_id ? 'pointer' : 'default' }}
    >
      {/* Invisible hit area so small shapes are easy to click */}
      <circle cx={cx} cy={cy} r={12} fill="transparent" />
      {shape}
    </g>
  );
}

export function VolumeChart({
  rows,
  gran = '10min',
  color = '#636EFA',
  height = 280,
  anomalies = [],
  onAnomalyClick,
}: VolumeChartProps) {
  const granMs = GRAN_MS[gran] ?? GRAN_MS['10min'];

  const buckets = new Map<number, number>();
  for (const r of rows) {
    const t = new Date(r.minute_str.trim() + ':00Z').getTime();
    if (isNaN(t)) continue;
    const b = Math.floor(t / granMs) * granMs;
    buckets.set(b, (buckets.get(b) ?? 0) + Number(r.cnt));
  }

  // Snap each anomaly bucket_start to the current granularity
  const anomalyBuckets = anomalies
    .map((a) => {
      const t = parseHanaUtc(a.bucket_start);
      return isNaN(t) ? null : Math.floor(t / granMs) * granMs;
    })
    .filter((v): v is number => v !== null);

  const volTs = [...buckets.keys()];
  const volDomainStart = volTs.length > 0 ? Math.min(...volTs) : 0;
  const volDomainEnd   = volTs.length > 0 ? Math.max(...volTs) : 0;

  // Extend domain to cover the latest anomaly bucket so edge anomalies are never clipped
  const maxAnomalyBucket = anomalyBuckets.length > 0 ? Math.max(...anomalyBuckets) : 0;
  const domainEnd = Math.max(volDomainEnd, maxAnomalyBucket);

  // Gap-fill within the full display domain (0-count for buckets beyond last volume point)
  if (volTs.length > 0) {
    for (let b = volDomainStart; b <= domainEnd; b += granMs) {
      if (!buckets.has(b)) buckets.set(b, 0);
    }
  }

  // Map each bucket to its worst anomaly (lowest score = most anomalous).
  // Merging into the area data lets the Area's tooltip show anomaly info
  // when the cursor lands on a bucket that has an anomaly marker.
  const anomByBucket = new Map<number, AnomalyMarker>();
  for (const a of anomalies) {
    const t = parseHanaUtc(a.bucket_start);
    if (isNaN(t)) continue;
    const b = Math.floor(t / granMs) * granMs;
    const existing = anomByBucket.get(b);
    if (!existing || (a.anomaly_score ?? 0) < (existing.anomaly_score ?? 0)) {
      anomByBucket.set(b, a);
    }
  }

  const data = [...buckets.entries()]
    .filter(([t]) => !isNaN(t))
    .sort(([a], [b]) => a - b)
    .map(([time, count]) => ({ time, count, ...anomByBucket.get(time) }));

  // Nearest non-zero volume count for anomaly marker Y position
  const nearestCount = (t: number): number => {
    if (buckets.has(t) && buckets.get(t)! > 0) return buckets.get(t)!;
    let best = 0, bestDist = Infinity;
    for (const [bt, bc] of buckets) {
      if (bc <= 0) continue;
      const d = Math.abs(bt - t);
      if (d < bestDist) { best = bc; bestDist = d; }
    }
    return best;
  };

  const anomalyTypes = [...new Set(anomalies.map((a) => a.anomaly_type))].sort();
  const scatterByType = anomalyTypes.map((type) => ({
    type,
    points: anomalies
      .filter((a) => a.anomaly_type === type)
      .map((a) => {
        const t = parseHanaUtc(a.bucket_start);
        if (isNaN(t)) return null;
        const b = Math.floor(t / granMs) * granMs;
        // Only drop markers before the volume domain start (too old); allow beyond volDomainEnd up to domainEnd
        if (volDomainStart > 0 && b < volDomainStart) return null;
        return { time: b, count: nearestCount(b), ...a };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null),
  }));

  // Build explicit UTC-aligned ticks so marks fall on clean time boundaries
  const tickStep = TICK_STEP[gran] ?? granMs * 3;
  const ticks: number[] = [];
  if (volDomainStart > 0) {
    const firstTick = Math.ceil(volDomainStart / tickStep) * tickStep;
    for (let t = firstTick; t <= domainEnd; t += tickStep) ticks.push(t);
  }

  const gradId = `vol-${color.replace('#', '')}`;

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-text-secondary text-sm" style={{ height }}>
        Sin datos en la ventana seleccionada
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 30, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,110,250,.06)" vertical={false} />

        <XAxis
          dataKey="time"
          type="number"
          scale="time"
          domain={volDomainStart > 0 ? [volDomainStart, domainEnd] : ['auto', 'auto']}
          ticks={ticks.length > 0 ? ticks : undefined}
          tickFormatter={fmtTick}
          tick={{ fill: '#8b949e', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          label={{ value: 'UTC', position: 'insideBottomRight', offset: 0, fill: '#484f58', fontSize: 10 }}
        />
        <YAxis
          tick={{ fill: '#8b949e', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />

        <Tooltip
          content={<CustomTooltip />}
          cursor={{ stroke: 'rgba(99,110,250,.15)', strokeWidth: 1 }}
        />

        <Legend wrapperStyle={{ fontSize: 11, color: '#8b949e', paddingTop: 8 }} />

        <Area
          type="monotone"
          dataKey="count"
          name="Volumen"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradId})`}
          dot={false}
          activeDot={{ r: 4, fill: color, stroke: '#0d1117', strokeWidth: 2 }}
          legendType="line"
        />

        {scatterByType.map(({ type, points }) => (
          <Scatter
            key={type}
            name={type}
            data={points}
            dataKey="count"
            fill={TYPE_COLOR[type] ?? '#888'}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            shape={(p: any) => <AnomalyShape {...p} onAnomalyClick={onAnomalyClick} />}
            legendType="diamond"
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
