interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  icon?: React.ReactNode;
}

export function KpiCard({
  label,
  value,
  sub,
  accent = '#636EFA',
  icon,
}: KpiCardProps) {
  return (
    <div
      className="rounded-xl p-4 flex items-start justify-between gap-3"
      style={{
        background: 'linear-gradient(135deg, rgba(22,26,45,.95), rgba(13,17,32,.9))',
        border: `1px solid ${accent}22`,
        borderLeft: `3px solid ${accent}`,
        boxShadow: '0 2px 12px rgba(0,0,0,.2)',
      }}
    >
      <div className="min-w-0">
        <p
          className="text-[10px] font-semibold uppercase tracking-widest mb-1.5 truncate"
          style={{ color: '#8b949e' }}
        >
          {label}
        </p>
        <p className="text-2xl font-bold leading-none text-[#e6f1ff] truncate">
          {value}
        </p>
        {sub && (
          <p className="text-xs mt-1.5 truncate" style={{ color: '#8b949e' }}>
            {sub}
          </p>
        )}
      </div>
      {icon && (
        <div className="opacity-25 flex-shrink-0 mt-1" style={{ color: accent }}>
          {icon}
        </div>
      )}
    </div>
  );
}
