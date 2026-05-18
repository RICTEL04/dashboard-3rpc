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
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #636EFA 0%, #4148d4 100%)',
              boxShadow: '0 0 22px rgba(99,110,250,0.38), 0 2px 8px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
            }}
          >
            <ShieldAlert className="w-4 h-4 text-white" />
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
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200"
                style={active ? {
                  background: `linear-gradient(135deg, ${color}28, ${color}12)`,
                  boxShadow: `0 0 12px ${color}28, inset 0 1px 0 rgba(255,255,255,0.07)`,
                  border: `1px solid ${color}30`,
                } : {}}
              >
                <Icon
                  className="w-3.5 h-3.5 flex-shrink-0 transition-colors"
                  style={{ color: active ? color : undefined }}
                />
              </div>
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3 opacity-40" />}
            </Link>
          );
        })}
      </nav>

      {/* ── Hours slider + Refresh ── */}
      <div className="px-3 py-3 border-t border-surface-border space-y-2.5">

        {/* Card glassmorphism */}
        <div
          className="rounded-2xl p-4"
          style={{
            background: 'linear-gradient(145deg, rgba(99,110,250,0.07) 0%, rgba(13,17,28,0.85) 100%)',
            border: '1px solid rgba(99,110,250,0.14)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          {/* Label + valor actual */}
          <div className="flex items-center justify-between mb-4">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
              <Clock className="w-3 h-3" />
              Ventana de datos
            </span>
            <span
              className="text-base font-mono font-extrabold leading-none tabular-nums"
              style={{ color: '#636EFA', textShadow: '0 0 18px rgba(99,110,250,0.55)' }}
            >
              {sliderVal}h
            </span>
          </div>

          {/* Slider con fill dinámico */}
          <div className="mb-4">
            <input
              type="range"
              min={1} max={168} step={1}
              value={sliderVal}
              onChange={(e) => handleSliderChange(Number(e.target.value))}
              style={{
                background: `linear-gradient(to right,
                  #636EFA 0%,
                  #4148d4 ${(sliderVal - 1) / 167 * 100}%,
                  rgba(255,255,255,0.07) ${(sliderVal - 1) / 167 * 100}%,
                  rgba(255,255,255,0.07) 100%)`,
              }}
            />
          </div>

          {/* Chips de presets */}
          <div className="grid grid-cols-5 gap-1">
            {([
              { v: 1,   label: '1h'  },
              { v: 6,   label: '6h'  },
              { v: 24,  label: '24h' },
              { v: 72,  label: '3d'  },
              { v: 168, label: '7d'  },
            ]).map(({ v, label }) => {
              const active = sliderVal === v;
              return (
                <button
                  key={v}
                  onClick={() => setHours(v)}
                  className="py-1.5 rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer"
                  style={active ? {
                    background: 'linear-gradient(135deg, #636EFA, #4148d4)',
                    color: '#fff',
                    boxShadow: '0 0 14px rgba(99,110,250,0.45)',
                  } : {
                    background: 'rgba(255,255,255,0.04)',
                    color: '#6e7681',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Botón Refresh */}
        <button
          onClick={handleRefresh}
          disabled={spinning}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl
                     text-xs font-semibold transition-all duration-200 cursor-pointer
                     disabled:opacity-60"
          style={{
            background: 'linear-gradient(135deg, rgba(99,110,250,0.12), rgba(99,110,250,0.05))',
            border: '1px solid rgba(99,110,250,0.2)',
            color: '#636EFA',
          }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${spinning ? 'animate-spin' : ''}`} />
          Actualizar datos
        </button>
        <p className="text-[10px] text-text-muted text-center">
          Auto-refresco cada 60 s
        </p>
      </div>

    </aside>
  );
}
