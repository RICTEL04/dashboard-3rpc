'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ShieldAlert, Activity, Bot, BarChart3, RefreshCw, Clock, ChevronRight,
} from 'lucide-react';

const NAV = [
  { href: '/anomalias',    label: 'Anomalías ML',    icon: Activity,    color: '#EF553B' },
  { href: '/system-logs',  label: 'System Logs',     icon: ShieldAlert, color: '#636EFA' },
  { href: '/llm-logs',     label: 'LLM Logs',        icon: Bot,         color: '#00CC96' },
  { href: '/resumen',      label: 'Resumen General', icon: BarChart3,   color: '#AB63FA' },
];

export function Sidebar() {
  const pathname     = usePathname();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const hours        = Number(searchParams.get('h') ?? 24);
  const [sliderVal, setSliderVal] = useState(hours);
  const [spinning, setSpinning] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local slider in sync when URL changes (e.g. preset buttons, nav)
  useEffect(() => { setSliderVal(hours); }, [hours]);

  // Pre-warm the server cache for the selected time window.
  // One request triggers all 5 HANA queries in parallel; every SWR hook
  // on any dashboard section then gets an instant cache hit.
  useEffect(() => {
    fetch(`/api/prefetch?h=${hours}`).catch(() => {/* silent — individual routes will retry */});
  }, [hours]);

  const pushHours = useCallback((h: number) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('h', String(h));
    router.push(`${pathname}?${p.toString()}`);
  }, [router, pathname, searchParams]);

  const setHours = useCallback((h: number) => {
    pushHours(h);
  }, [pushHours]);

  const handleSliderChange = useCallback((h: number) => {
    setSliderVal(h);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushHours(h), 500);
  }, [pushHours]);

  const handleRefresh = () => {
    setSpinning(true);
    router.refresh();
    setTimeout(() => setSpinning(false), 1200);
  };

  return (
    <aside className="fixed inset-y-0 left-0 w-64 flex flex-col z-30
                      bg-surface-base border-r border-surface-border">

      {/* ── Logo ── */}
      <div className="px-5 py-5 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-blue/15 border border-brand-blue/30
                          flex items-center justify-center">
            <ShieldAlert className="w-4 h-4 text-brand-blue" />
          </div>
          <div>
            <div className="font-bold text-text-primary text-sm tracking-wide">3RPC</div>
            <div className="text-[10px] text-text-secondary uppercase tracking-widest">
              SAP Security Monitor
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon, color }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={`${href}?${searchParams.toString()}`}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                          transition-all duration-150
                          ${active
                            ? 'bg-brand-blue/12 text-text-primary border border-brand-blue/20'
                            : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay'
                          }`}
            >
              <Icon
                className="w-4 h-4 flex-shrink-0 transition-colors"
                style={{ color: active ? color : undefined }}
              />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3 opacity-40" />}
            </Link>
          );
        })}
      </nav>

      {/* ── Hours slider ── */}
      <div className="px-4 py-4 border-t border-surface-border">
        <div className="flex items-center justify-between mb-3">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold
                           uppercase tracking-widest text-text-secondary">
            <Clock className="w-3 h-3" />
            Ventana de datos
          </span>
          <span className="text-sm font-mono font-bold text-brand-blue">{sliderVal}h</span>
        </div>

        <input
          type="range"
          min={1} max={168} step={1}
          value={sliderVal}
          onChange={(e) => handleSliderChange(Number(e.target.value))}
        />

        <div className="flex justify-between mt-1.5">
          {[1, 6, 24, 72, 168].map((v) => (
            <button
              key={v}
              onClick={() => setHours(v)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors
                          ${sliderVal === v
                            ? 'text-brand-blue font-bold'
                            : 'text-text-muted hover:text-text-secondary'
                          }`}
            >
              {v === 168 ? '7d' : v === 72 ? '3d' : v === 24 ? '24h' : v === 6 ? '6h' : '1h'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Refresh ── */}
      <div className="px-4 pb-5">
        <button
          onClick={handleRefresh}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                     bg-surface-overlay text-text-secondary text-xs font-medium
                     hover:bg-surface-border hover:text-text-primary transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${spinning ? 'animate-spin' : ''}`} />
          Actualizar datos
        </button>
        <p className="text-[10px] text-text-muted text-center mt-2">
          Auto-refresco cada 60 s
        </p>
      </div>

    </aside>
  );
}
