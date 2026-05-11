'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Bot, X, Send, Loader2, ChevronDown, Sparkles, RefreshCw } from 'lucide-react';

interface Message {
  role: 'user' | 'model';
  text: string;
}

const SUGGESTIONS = [
  'Explícame las anomalías activas',
  '¿Cuál es la más crítica?',
  '¿Qué acciones debo tomar?',
  'Resume el estado de seguridad',
];

async function fetchDashboardContext(hours: number): Promise<string> {
  const [anomRes, sysRes, llmRes] = await Promise.allSettled([
    fetch(`/api/anomalias?h=${hours}`).then((r) => r.json()),
    fetch(`/api/system-logs?h=${hours}&limit=10`).then((r) => r.json()),
    fetch(`/api/llm-logs?h=${hours}&limit=10`).then((r) => r.json()),
  ]);

  const parts: string[] = [`=== DATOS DEL DASHBOARD 3RPC (últimas ${hours}h) ===\n`];

  if (anomRes.status === 'fulfilled' && anomRes.value?.data?.length) {
    const anomalies = anomRes.value.data;
    parts.push(`ANOMALÍAS DETECTADAS: ${anomalies.length} total`);
    anomalies.slice(0, 15).forEach((a: Record<string, unknown>, i: number) => {
      parts.push(
        `${i + 1}. [${a.severity}] Tipo: ${a.anomaly_type} | Score: ${Number(a.anomaly_score).toFixed(4)} | ` +
        `Requests: ${a.n_requests} | IPs únicas: ${a.n_unique_ips} | ` +
        `Error rate: ${(Number(a.error_rate) * 100).toFixed(1)}% | ` +
        `IP top: ${a.top_ip || 'N/A'} | Categoría: ${a.attack_category || 'N/A'} | ` +
        `Razón: ${a.reason} | Inicio: ${a.bucket_start}`
      );
    });
  } else {
    parts.push('ANOMALÍAS: Ninguna detectada en este período.');
  }

  if (sysRes.status === 'fulfilled' && sysRes.value?.data?.length) {
    const logs = sysRes.value.data;
    parts.push(`\nSYSTEM LOGS RECIENTES (${logs.length} entradas):`);
    logs.slice(0, 8).forEach((l: Record<string, unknown>) => {
      parts.push(
        `- ${l.timestamp} | IP: ${l.sourceip} | ${l.event_description} | ` +
        `HTTP ${l.http_status_code} | Seguridad: ${l.is_security_event ? 'SÍ' : 'NO'} | ` +
        `Región: ${l.region_name || l.region_id}`
      );
    });
  } else {
    parts.push('\nSYSTEM LOGS: Sin datos en este período.');
  }

  if (llmRes.status === 'fulfilled' && llmRes.value?.data?.length) {
    const logs = llmRes.value.data;
    parts.push(`\nLLM LOGS RECIENTES (${logs.length} entradas):`);
    logs.slice(0, 8).forEach((l: Record<string, unknown>) => {
      parts.push(
        `- ${l.timestamp} | Modelo: ${l.llm_model_id} | Tokens: ${l.llm_total_tokens} | ` +
        `Costo: $${Number(l.llm_cost_usd).toFixed(5)} | Status: ${l.llm_status} | ` +
        `Finish: ${l.llm_finish_reason}`
      );
    });
  } else {
    parts.push('\nLLM LOGS: Sin datos en este período.');
  }

  return parts.join('\n');
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-brand-blue/20 border border-brand-blue/30
                        flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="w-3 h-3 text-brand-blue" />
        </div>
      )}
      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap
          ${isUser
            ? 'bg-brand-blue text-white rounded-tr-sm'
            : 'bg-surface-raised border border-surface-border text-text-primary rounded-tl-sm'
          }`}
      >
        {msg.text}
      </div>
    </div>
  );
}

export function ChatWidget() {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [context, setContext]   = useState<string>('');
  const [ctxLoading, setCtxLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const searchParams = useSearchParams();
  const hours = Number(searchParams.get('h') ?? 24);

  // Auto-load context and greet when chat opens
  const initChat = useCallback(async () => {
    setCtxLoading(true);
    setMessages([{ role: 'model', text: 'Cargando datos del dashboard…' }]);

    let ctx = '';
    try {
      ctx = await fetchDashboardContext(hours);
      setContext(ctx);
    } catch {
      ctx = '';
    }
    setCtxLoading(false);

    // Ask Gemini for an opening summary with the loaded context
    try {
      const initMsg: Message = { role: 'user', text: 'Dame un resumen breve del estado de seguridad actual basándote en los datos del dashboard.' };
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [initMsg], context: ctx }),
      });
      const data = await res.json();
      setMessages([{ role: 'model', text: data.text ?? '¡Hola! ¿En qué te puedo ayudar?' }]);
    } catch {
      setMessages([{ role: 'model', text: '¡Hola! Datos cargados. ¿Qué quieres saber sobre las anomalías o logs?' }]);
    }
  }, [hours]);

  useEffect(() => {
    if (open && messages.length === 0) {
      initChat();
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', text: text.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, context }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, {
        role: 'model',
        text: data.text ?? data.error ?? 'Error al obtener respuesta.',
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: 'model',
        text: 'Error de conexión. Verifica tu red e intenta de nuevo.',
      }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, context]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const refresh = () => {
    setMessages([]);
    setContext('');
    initChat();
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 rounded-full
                   bg-brand-blue shadow-lg shadow-brand-blue/30
                   flex items-center justify-center
                   hover:bg-brand-blue/90 transition-all duration-200
                   hover:scale-105 active:scale-95"
        style={{ width: 52, height: 52 }}
        aria-label="Abrir asistente IA"
      >
        {open
          ? <ChevronDown className="w-5 h-5 text-white" />
          : <Bot className="w-5 h-5 text-white" />
        }
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-[76px] right-6 z-50 w-[390px] max-h-[580px]
                        flex flex-col rounded-2xl overflow-hidden
                        bg-surface-base border border-surface-border
                        shadow-2xl shadow-black/40">

          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3
                          bg-surface-raised border-b border-surface-border flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-brand-blue/15 border border-brand-blue/30
                            flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-brand-blue" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-primary">Asistente SAP Security</p>
              <p className="text-[10px] text-text-muted">
                {ctxLoading ? 'Cargando datos…' : context ? `Datos cargados · últimas ${hours}h` : 'Powered by Gemini'}
              </p>
            </div>
            <button
              onClick={refresh}
              disabled={ctxLoading || loading}
              title="Recargar datos del dashboard"
              className="text-text-muted hover:text-brand-blue transition-colors disabled:opacity-40 mr-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${ctxLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
            {loading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-brand-blue/20 border border-brand-blue/30
                                flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3 h-3 text-brand-blue" />
                </div>
                <div className="bg-surface-raised border border-surface-border rounded-xl rounded-tl-sm px-3 py-2">
                  <Loader2 className="w-4 h-4 text-text-muted animate-spin" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions — show after init message loads */}
          {messages.length === 1 && !ctxLoading && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-[11px] px-2.5 py-1 rounded-full
                             bg-brand-blue/10 border border-brand-blue/20
                             text-brand-blue hover:bg-brand-blue/20 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 flex-shrink-0">
            <div className="flex gap-2 items-end bg-surface-raised border border-surface-border
                            rounded-xl px-3 py-2 focus-within:border-brand-blue/50 transition-colors">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Pregunta sobre anomalías o logs…"
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted
                           resize-none outline-none max-h-28"
                style={{ minHeight: '1.25rem' }}
              />
              <button
                onClick={() => send(input)}
                disabled={!input.trim() || loading || ctxLoading}
                className="flex-shrink-0 w-7 h-7 rounded-lg bg-brand-blue
                           flex items-center justify-center
                           hover:bg-brand-blue/80 transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            <p className="text-[10px] text-text-muted text-center mt-1.5">
              Enter para enviar · Shift+Enter nueva línea
            </p>
          </div>
        </div>
      )}
    </>
  );
}
