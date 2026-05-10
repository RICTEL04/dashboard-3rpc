import type { Severity, AnomalyType } from '@/types';

const SEV: Record<Severity, { color: string; bg: string; label: string }> = {
  HIGH:   { color: '#EF553B', bg: 'rgba(239,85,59,.12)',  label: 'ALTA' },
  MEDIUM: { color: '#FFA15A', bg: 'rgba(255,161,90,.12)', label: 'MEDIA' },
  LOW:    { color: '#FECB52', bg: 'rgba(254,203,82,.12)', label: 'BAJA' },
};

const TYPE: Record<AnomalyType, { color: string; bg: string }> = {
  SPIKE:          { color: '#EF553B', bg: 'rgba(239,85,59,.1)'  },
  MULTI_BUCKET:   { color: '#636EFA', bg: 'rgba(99,110,250,.1)' },
  CATEGORIZATION: { color: '#FFA15A', bg: 'rgba(255,161,90,.1)' },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const s = SEV[severity];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold
                 uppercase tracking-wider border"
      style={{ color: s.color, background: s.bg, borderColor: `${s.color}40` }}
    >
      {s.label}
    </span>
  );
}

export function TypeBadge({ type }: { type: AnomalyType }) {
  const t = TYPE[type];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold
                 border"
      style={{ color: t.color, background: t.bg, borderColor: `${t.color}40` }}
    >
      {type}
    </span>
  );
}
