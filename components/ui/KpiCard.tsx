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
      className="relative rounded-2xl p-5 overflow-hidden flex items-start justify-between gap-3"
      style={{
        background: 'linear-gradient(145deg, rgba(22,27,42,0.85) 0%, rgba(13,17,28,0.92) 100%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${accent}22`,
        boxShadow: `0 0 0 1px ${accent}0a, 0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 ${accent}18`,
      }}
    >
      {/* Top accent bar con shimmer */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(90deg, transparent 0%, ${accent}bb 50%, transparent 100%)` }}
        />
        <div
          className="kpi-shimmer absolute top-0 bottom-0 w-1/2"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}ff, transparent)` }}
        />
      </div>

      {/* Glow radial en esquina superior derecha */}
      <div
        className="absolute -top-6 -right-6 w-32 h-32 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${accent}20 0%, transparent 70%)`,
        }}
      />

      {/* Contenido */}
      <div className="min-w-0 relative z-10 flex-1">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2.5 flex items-center gap-1.5"
          style={{ color: `${accent}90` }}
        >
          {label}
        </p>

        <p
          className="text-[1.85rem] font-extrabold leading-none tracking-tight tabular-nums"
          style={{
            color: '#f0f6ff',
            textShadow: `0 0 24px ${accent}40`,
          }}
        >
          {value}
        </p>

        {sub && (
          <p
            className="text-[11px] mt-2 font-medium"
            style={{ color: `${accent}75` }}
          >
            {sub}
          </p>
        )}
      </div>

      {/* Icono con glow */}
      {icon && (
        <div
          className="relative flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center z-10 mt-0.5"
          style={{
            background: `linear-gradient(135deg, ${accent}20, ${accent}08)`,
            border: `1px solid ${accent}30`,
            color: accent,
            boxShadow: `0 0 16px ${accent}25, inset 0 1px 0 ${accent}20`,
          }}
        >
          {icon}
        </div>
      )}
    </div>
  );
}
