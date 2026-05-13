# 3RPC Dashboard — Arquitectura Técnica

**Versión:** 2.0  
**Fecha:** 2026-05-12  
**Stack:** Next.js 15 · TypeScript · SAP HANA Cloud · Gemini 2.5 Flash

---

## Índice

1. [Descripción general](#1-descripción-general)
2. [Estructura de directorios](#2-estructura-de-directorios)
3. [Stack tecnológico — decisiones y tradeoffs](#3-stack-tecnológico--decisiones-y-tradeoffs)
4. [Pipeline de datos](#4-pipeline-de-datos)
5. [Páginas y rutas](#5-páginas-y-rutas)
6. [API Routes — implementación y diseño](#6-api-routes--implementación-y-diseño)
7. [Componentes clave](#7-componentes-clave)
8. [Capa de datos — lib/](#8-capa-de-datos--lib)
9. [Integración con IA — diseño y decisiones](#9-integración-con-ia--diseño-y-decisiones)
10. [Generación de reportes PDF](#10-generación-de-reportes-pdf)
11. [Sistema de diseño](#11-sistema-de-diseño)
12. [Despliegue en Cloud Foundry](#12-despliegue-en-cloud-foundry)
13. [Variables de entorno](#13-variables-de-entorno)
14. [Tipos de datos](#14-tipos-de-datos)
15. [Riesgos técnicos y mitigaciones](#15-riesgos-técnicos-y-mitigaciones)

---

## 1. Descripción general

**3RPC Dashboard** es el frontend de monitoreo del pipeline de detección de anomalías 3RPC. Consume los datos almacenados en SAP HANA Cloud por el pipeline Python (ETL + ML) y los presenta en una interfaz web en tiempo casi real, con un chat asistente impulsado por IA y generación de reportes PDF descargables.

<img width="1920" height="1080" alt="Arquitectura 3rpc" src="https://github.com/user-attachments/assets/d307b596-3a96-43d7-a06b-d85eed17f1cf" />

### Capacidades principales

| Capacidad | Descripción |
|---|---|
| Visualización de anomalías ML | Timeline interactivo con marcadores por tipo (SPIKE, MULTI_BUCKET, CATEGORIZATION) y drag-to-zoom |
| Análisis de System Logs | Distribuciones de HTTP status, IPs, logtypes, entornos SAP con tablas paginadas |
| Análisis de LLM Logs | Latencia, costo, modelos, finish reasons, prompts expandibles |
| Resumen ejecutivo | Vista consolidada multi-fuente con series de tiempo combinadas |
| Chat asistente IA | Widget flotante con Gemini 2.5 Flash, contexto automático del dashboard |
| Reportes PDF | Generación con IA de reportes técnicos descargables, estructurados en JSON → jsPDF |
| Selector de ventana temporal | Slider 1h–168h con presets, sincronizado por URL (`?h=X`) |

---

## 2. Estructura de directorios

```
dashboard-next/
├── app/                          # App Router Next.js 15
│   ├── layout.tsx                # Layout global: Sidebar + ChatWidget
│   ├── page.tsx                  # Raíz → redirect /anomalias
│   ├── globals.css               # Estilos globales + scrollbar + slider
│   ├── anomalias/page.tsx        # Detección de anomalías ML
│   ├── system-logs/page.tsx      # Logs de sistema SAP
│   ├── llm-logs/page.tsx         # Logs de modelos LLM
│   ├── resumen/page.tsx          # Vista consolidada
│   └── api/
│       ├── anomalias/route.ts    # GET anomalías desde HANA
│       ├── system-logs/route.ts  # GET system logs
│       ├── llm-logs/route.ts     # GET LLM logs
│       ├── volume/route.ts       # GET volumen agregado por minuto
│       ├── chat/route.ts         # POST chat con Gemini
│       └── report/route.ts       # POST generación de reporte estructurado
│
├── components/
│   ├── layout/Sidebar.tsx        # Navegación + selector de horas
│   ├── ui/
│   │   ├── ChatWidget.tsx        # Chat IA flotante (bottom-right)
│   │   ├── KpiCard.tsx           # Tarjeta KPI reutilizable
│   │   └── SeverityBadge.tsx     # Badges HIGH / MEDIUM / LOW
│   └── charts/VolumeChart.tsx    # AreaChart + anomaly markers SVG
│
├── lib/
│   ├── hana.ts                   # Wrapper conexión SAP HANA Cloud
│   ├── queries.ts                # SQL parametrizado por ventana temporal
│   └── generatePdf.ts            # Generador PDF (jsPDF, A4 portrait)
│
├── types/index.ts                # Interfaces TypeScript centralizadas
├── next.config.ts                # serverExternalPackages + Turbopack
├── tailwind.config.ts            # Tema oscuro con colores brand
├── manifest.yml                  # Cloud Foundry deployment
└── .env.local                    # Credenciales (gitignored)
```

---

## 3. Stack tecnológico — decisiones y tradeoffs

### Next.js 15 (App Router)

**Por qué:** Next.js permite colocar la lógica de acceso a HANA en API Routes del mismo proceso, sin desplegar un backend separado. Las credenciales HANA **nunca salen del servidor** — el cliente solo recibe JSON. Alternativas descartadas:

| Alternativa | Razón de descarte |
|---|---|
| React + Express separado | Dos deploys, configuración adicional de CORS, más superficie de ataque |
| Remix | Ecosistema más pequeño, menos integración con el stack Vercel/CF |
| SvelteKit | Curva de aprendizaje, menor madurez del ecosistema de componentes |

**Tradeoff aceptado:** El bundle de producción incluye el runtime de Node.js completo, pero en Cloud Foundry esto es irrelevante porque se despliega como proceso Node.js.

### SWR (data fetching)

**Por qué:** SWR provee revalidación automática configurable, deduplicación de requests y manejo de estados de carga/error con una sola línea (`useSWR`). El dashboard necesita refrescar datos sin recargar la página.

```typescript
// Cada página usa el mismo patrón — 60s de refresh
const { data, error, isLoading } = useSWR<AnomaliesResponse>(
  `/api/anomalias?h=${hours}`,
  fetcher,
  { refreshInterval: 60_000 }
);
```

**Parámetro clave:** `refreshInterval: 60_000` ms — sincronizado con el pipeline Python (ciclos cada 30 min) y el `Cache-Control: max-age=55` del servidor, para que el cliente nunca solicite datos más nuevos de los que HANA tiene.

**Alternativas descartadas:** `React Query` es equivalente pero más pesado; `useEffect + fetch` requiere gestión manual de estados de loading/error/stale.

### Recharts

**Por qué:** Librería de gráficos composable para React. Permite mezclar tipos de series (`ComposedChart` = AreaChart + ScatterChart para los markers de anomalías) sin configuración compleja. Tree-shakeable — solo se importa lo que se usa.

**Tradeoff aceptado:** Rendimiento con >5,000 puntos de datos puede degradarse. Mitigado con la función `bucketData()` que agrega datos antes de renderizar según la granularidad elegida (1min / 5min / 10min / 30min / 1h).

### Gemini 2.5 Flash

**Por qué:** El caso de uso principal es generar JSON estructurado (`ReportData`) a partir de contexto de seguridad en español. Gemini 2.5 Flash tiene razonamiento mejorado en tareas de análisis y siguió el schema JSON en >95% de las pruebas sin necesitar function calling. GPT-4o-mini fue descartado por mayor latencia y ausencia de cuenta GCP existente.

**Decisión de diseño clave:** el prompt de `/api/report` instruye al modelo a devolver *únicamente* JSON válido. Se añade un paso de limpieza por si el modelo agrega markdown fences:

```typescript
const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
const report = JSON.parse(clean);
```

### jsPDF

**Por qué:** Generación de PDF 100% en el cliente sin servidor adicional. El archivo se descarga directamente desde el browser sin pasar por el servidor, eliminando latencia de descarga y límites de tamaño de respuesta HTTP.

**Tradeoff aceptado:** `jsPDF` usa carga dinámica (`await import('jspdf')`) para evitar incluirlo en el bundle inicial. Solo se importa cuando el usuario pulsa "Generar PDF". Sin soporte para HTML-to-PDF — el layout se construye manualmente con coordenadas mm sobre A4 (210×297 mm).

### @sap/hana-client

**Por qué:** Driver oficial de SAP, con soporte TLS nativo y compatibilidad garantizada con SAP HANA Cloud. Las alternativas como `hdb` son no oficiales y con menor soporte. Requiere `serverExternalPackages: ['@sap/hana-client']` en `next.config.ts` para que Webpack no intente bundlearlo (es un módulo nativo Node.js con binarios compilados).

---

## 4. Pipeline de datos

### Esquema de entrada (HANA → API Routes)

Las tres tablas fuente son escritas por el pipeline Python 3RPC:

```
SYSTEM_LOGS:  _id, timestamp, sourceip, port_service, event_description,
              status, logtype, region_id, region_name, macro_region,
              sap_app_env, http_status_code, is_security_event, ...

LLM_LOGS:     _id, timestamp, llm_model_id, llm_total_tokens, llm_cost_usd,
              llm_response_time_ms, llm_status, llm_finish_reason,
              llm_temperature, llm_prompt, ...

ANOMALIES:    anomaly_id, detected_at, bucket_start, anomaly_type, severity,
              anomaly_score, n_requests, n_unique_ips, error_rate, top_ip,
              reason, details_json, attack_category
```

### Flujo de transformación

```
1. SAP HANA Cloud
   └─ SQL parametrizado (lib/queries.ts)
       WHERE timestamp >= NOW() - Nh
       ORDER BY timestamp DESC
           │
           ▼
2. lib/hana.ts — query()
   └─ Normaliza column names a lowercase
      (HANA devuelve columnas en el casing de definición)
           │
           ▼
3. API Route — NextResponse.json()
   └─ Cache-Control: max-age=55, stale-while-revalidate=5
   └─ Parámetro h validado: clamp [1, 168]
           │
           ▼
4. SWR (cliente) — refreshInterval: 60s
   └─ React state → Recharts / tablas
           │
           ▼
5. VolumeChart.tsx — bucketData()
   └─ Agrega filas a granularidad elegida (1min / 5min / 10min / 30min / 1h)
   └─ parseHanaUtc(): parsea timestamps como UTC para evitar
      desplazamiento de zona horaria en Date()
```

### Transformación de volumen (queries.ts)

```typescript
volume: (table: string, hours: number) => `
  SELECT
    TO_VARCHAR("timestamp", 'YYYY-MM-DD HH24:MI') AS minute_str,
    "logtype",
    COUNT(*) AS cnt
  FROM "${S}"."${table}"
  WHERE "timestamp" >= '${since(hours)}'
  GROUP BY TO_VARCHAR("timestamp", 'YYYY-MM-DD HH24:MI'), "logtype"
  ORDER BY minute_str
`
```

El agrupamiento `TO_VARCHAR(..., 'YYYY-MM-DD HH24:MI')` se hace en HANA (motor columnar) — mucho más eficiente que traer todas las filas y agrupar en JavaScript.

### Flujo IA — contexto y generación

```
ChatWidget
  └─ fetchDashboardContext(hours)
      ├─ GET /api/anomalias?h=X   ─┐
      ├─ GET /api/system-logs?h=X  ├─ Promise.all (paralelo)
      └─ GET /api/llm-logs?h=X   ─┘
            │
            ▼ string estructurado (JSON serializado)
POST /api/chat  {messages, context}
      │
      ▼
Gemini 2.5 Flash
  └─ systemInstruction: experto en seguridad SAP
  └─ history: mensajes previos (multi-turn)
  └─ userText: mensaje + contexto concatenado
            │
            ▼ texto → NextResponse.json({ text })

── Para PDF ──
POST /api/report  {context, hours}
      │
      ▼
Gemini 2.5 Flash (modo JSON puro)
  └─ ReportData JSON
            │
            ▼
lib/generatePdf.ts → jsPDF → Blob → descarga en browser
```

---

## 5. Páginas y rutas

### `/` — Raíz
Redirect automático a `/anomalias`.

### `/anomalias` — Detección de Anomalías ML

Sección principal. Muestra el output del pipeline Python (IsolationForest + HalfSpaceTrees).

```
KPIs (5): total · HIGH · MEDIUM · LOW · peor score
    ↓
VolumeChart
  · Áreas: volumen sistema + LLM
  · Markers SVG: ▲ SPIKE · ◆ MULTI_BUCKET · ● CATEGORIZATION
  · Opacidad: HIGH=1.0 · MEDIUM=0.7 · LOW=0.4
  · Granularidades: 1min / 5min / 10min / 30min / 1h
  · Drag-to-zoom + reset
    ↓
Distribución: categorías de ataque (bar) + tipo × severidad (stacked bar)
    ↓
Tabla detalle (AnomalyCard expandible)
  · Top 8 features desviadas con z-scores (from details_json)
  · Feature snapshot completo
  · IDs de logs relacionados → trazabilidad directa a HANA
```

**Data:** `/api/anomalias?h=X` + `/api/volume?table=SYSTEM_LOGS&h=X` + `/api/volume?table=LLM_LOGS&h=X`

### `/system-logs` — Logs de Sistema SAP

```
KPIs (4): total · IPs únicas · security events · tipos de log
    ↓
VolumeChart por granularidad
    ↓
Charts: logtype · HTTP status codes · Top 10 IPs · App env (donut)
    ↓
Tabla paginada (100 filas/página)
```

### `/llm-logs` — Logs de Modelos LLM

```
KPIs (4): total requests · avg latency · total cost · tokens
    ↓
VolumeChart
    ↓
Charts: modelos LLM (donut) · finish reason · latencia avg+p95 · costo por región
    ↓
Tabla paginada + prompts expandibles (primeros 50)
```

### `/resumen` — Vista Consolidada

```
KPIs (5): system logs · llm logs · security events · costo total · tokens
    ↓
Timeline combinado (AreaChart: Sistema + LLM + Total)
    ↓
Charts: logtype sistema · logtype LLM · top 10 regiones · seguridad vs normal
```

---

## 6. API Routes — implementación y diseño

### Validación de parámetros y cache

Todas las rutas GET aplican el mismo patrón:

```typescript
// /api/anomalias/route.ts
const h = Math.min(Math.max(Number(req.nextUrl.searchParams.get('h') ?? 24), 1), 168);

return NextResponse.json({ data, count: data.length }, {
  headers: { 'Cache-Control': 'public, max-age=55, stale-while-revalidate=5' },
});
```

**Por qué `max-age=55` y no 60:** El cliente revalida cada 60s. Con 55s de cache, hay una ventana de 5s de `stale-while-revalidate` en la que se sirve el dato viejo mientras se refresca en background. Evita que el 60s del cliente y el TTL del servidor expiren en el mismo instante, lo que causaría latencias pico.

### Fallback de compatibilidad de schema

La columna `attack_category` se añadió tardíamente al schema de HANA. Las rutas manejan schemas viejos:

```typescript
// Intento 1: query completa
let data = await query<Anomaly>(sql.anomalies(h));

// Intento 2: si falla (columna no existe), reintenta sin attack_category
const fallbackSql = sql.anomalies(h).replace('"attack_category",', '');
const data = (await query<Anomaly>(fallbackSql)).map((r) => ({
  ...r, attack_category: 'N/A',
}));
```

### Tabla de rutas

| Ruta | Método | Params | Descripción |
|---|---|---|---|
| `/api/anomalias` | GET | `h` (1–168, default 24) | Anomalías de HANA con fallback de schema |
| `/api/system-logs` | GET | `h` | System logs SAP |
| `/api/llm-logs` | GET | `h` | LLM logs |
| `/api/volume` | GET | `h`, `table` | Volumen agrupado por minuto por logtype |
| `/api/chat` | POST | `{messages, context}` | Chat multi-turn con Gemini 2.5 Flash |
| `/api/report` | POST | `{context, hours}` | Genera `ReportData` JSON via Gemini |

---

## 7. Componentes clave

### `Sidebar.tsx` — por qué URL state

El slider de horas usa `useSearchParams` y `router.push` para sincronizar el estado con la URL (`?h=X`). **Razón:** permite compartir links con una ventana temporal específica y que el botón "Atrás" del browser funcione correctamente. Alternativa descartada: estado en contexto React (no sobrevive a refresh ni es compartible por URL).

- Debounce de 500 ms antes de actualizar la URL para evitar navigations en cada tick del slider
- Botones preset: 1h · 6h · 24h · 3d · 7d

### `ChatWidget.tsx` — gestión del contexto

Al abrir el chat, se hace un fetch paralelo de las 3 APIs para construir el contexto:

```typescript
const [anomalias, systemLogs, llmLogs] = await Promise.all([
  fetch(`/api/anomalias?h=${hours}`).then(r => r.json()),
  fetch(`/api/system-logs?h=${hours}`).then(r => r.json()),
  fetch(`/api/llm-logs?h=${hours}`).then(r => r.json()),
]);
// Serializado como string → enviado en cada mensaje como contexto a Gemini
```

**Por qué enviar contexto en cada mensaje:** Gemini 2.5 Flash no tiene memoria persistente entre sesiones. El contexto se pasa dentro del `userText` del último mensaje. El historial de conversación se pasa en `history` para multi-turn.

### `VolumeChart.tsx` — markers SVG personalizados

Recharts no tiene tipo "marker en posición X" nativo. La solución es usar `<Scatter>` con `shape` custom:

```typescript
// Cada anomalía es un punto en el scatter
// renderizado como SVG custom según anomaly_type
const renderAnomalyDot = (props: DotProps) => {
  if (type === 'SPIKE')       return <polygon points="...▲" />;
  if (type === 'MULTI_BUCKET') return <polygon points="...◆" />;
  return <circle ... />;  // CATEGORIZATION
};
```

`parseHanaUtc(str)` — función interna crítica: HANA devuelve timestamps sin indicador de zona (`"2026-05-11 14:35:00"`). `new Date("2026-05-11 14:35:00")` en algunos browsers se interpreta como local time. La función lo normaliza a UTC explícitamente reemplazando el espacio por `T` y añadiendo `Z`.

### `KpiCard.tsx` y `SeverityBadge.tsx`

Componentes presentacionales puros. Sin lógica. `KpiCard` acepta `color` como token del sistema de diseño. `SeverityBadge` exporta también `TypeBadge` para los tipos de anomalía (SPIKE / MULTI_BUCKET / CATEGORIZATION).

---

## 8. Capa de datos — lib/

### `lib/hana.ts` — conexión nueva por query

```typescript
export function query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const conn = hana.createConnection();
    conn.connect(params, (connectErr) => {
      if (connectErr) { reject(connectErr); return; }
      conn.exec(sql, (execErr, rows) => {
        conn.disconnect();   // ← desconecta siempre, éxito o error
        if (execErr) { reject(execErr); return; }
        const normalised = rows.map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([k, v]) => [k.toLowerCase(), v])
          )
        ) as T[];
        resolve(normalised);
      });
    });
  });
}
```

**Decisión de diseño:** una conexión nueva por query, no pool. **Razón:** Cloud Foundry puede escalar a múltiples instancias; un pool persistente en cada instancia podría saturar los límites de conexiones de HANA Cloud. Las queries son infrecuentes (máximo 1 por ruta cada 55s), por lo que el overhead de conexión (~50ms) es aceptable.

**Configuración de seguridad:**
- `encrypt: 'true'` — TLS obligatorio
- `sslValidateCertificate: 'false'` — SAP HANA Cloud usa certificados internos no firmados por CA pública; la validación fallaría
- `sslCryptoProvider: 'openssl'` — requerido por el driver en Linux (CF)

### `lib/queries.ts` — SQL parametrizado

```typescript
function since(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
  // → "2026-05-11 10:30:00"
}
```

**Por qué no prepared statements:** `@sap/hana-client` soporta prepared statements, pero los parámetros aquí son enteros validados (`h` con clamp [1,168]) y nombres de tabla que provienen de una whitelist interna — no de input de usuario. El riesgo de SQL injection es nulo.

---

## 9. Integración con IA — diseño y decisiones

### Modelo: Gemini 2.5 Flash (`gemini-2.5-flash`)

**Por qué Flash sobre Pro:** El caso de uso es análisis de JSON estructurado y generación de texto en español. Flash tiene latencia ~2–4s vs ~8–15s de Pro, con resultados equivalentes para este dominio. El razonamiento extendido de Pro no aporta valor aquí.

### Chat — system prompt y multi-turn

```typescript
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: SYSTEM_PROMPT,   // experto en seguridad SAP
});

// Historia limpiada: solo desde el primer mensaje user
const history = messages.slice(0, -1)
  .slice(firstUserIdx)
  .map((m) => ({ role: m.role, parts: [{ text: m.text }] }));

const chat = model.startChat({ history });
const result = await chat.sendMessage(userText);
```

**Por qué se empieza desde el primer user message:** la API de Gemini requiere que la historia comience con un mensaje `role: 'user'`. Si hay mensajes de sistema o de modelo antes del primer user, la API retorna error.

### Reporte — JSON puro vs function calling

Se optó por instruir al modelo a devolver JSON puro en lugar de usar function calling (tool use). **Razón:** function calling requiere definir el schema en la llamada API, lo que duplica la definición ya existente en TypeScript (`ReportData`). El modelo siguió el schema en >95% de las pruebas; el 5% restante (markdown fences añadidas por el modelo) se maneja con limpieza de texto:

```typescript
const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
const report = JSON.parse(clean);  // falla explícitamente si el JSON es inválido
```

**Tradeoff aceptado:** `JSON.parse` puede lanzar excepción. El catch del route devuelve `500` con mensaje de error al cliente, que lo muestra en el chat.

---

## 10. Generación de reportes PDF

### `lib/generatePdf.ts` — layout manual A4

jsPDF construye el PDF como canvas de coordenadas mm (A4: 210×297mm, márgenes 18mm). La función clave es `checkY(needed)`:

```typescript
function checkY(needed: number) {
  if (y + needed > 275) addPage();
}
// Llamada antes de cada bloque para evitar overflow de página
```

**Carga diferida (lazy import):**

```typescript
export async function generatePdf(report: ReportData): Promise<void> {
  const { jsPDF } = await import('jspdf');  // no está en el bundle inicial
  ...
  doc.save(`reporte-seguridad-sap-${fecha}.pdf`);
  // doc.save() dispara descarga directa en el browser
}
```

### Estructura del PDF generado

```
1. Header (fondo #0f172a)      — Título + badge de riesgo (color dinámico por severidad)
2. Meta info                   — Período + fecha de generación
3. Estadísticas (grid 4×2)     — 8 KPIs con barra de color lateral por severidad
4. Resumen ejecutivo           — Texto con word-wrap automático (splitTextToSize)
5. Hallazgos de seguridad      — Bloques numerados con barra de color por severidad
6. Recomendaciones             — Lista con bullet azul brand
7. Conclusión                  — Párrafo de cierre
8. Footer (todas las páginas)  — "3RPC SAP Security Monitor · Confidencial · Pág. N"
```

---

## 11. Sistema de diseño

### Colores (`tailwind.config.ts`)

| Token | Hex | Uso |
|---|---|---|
| `brand.blue` | `#636EFA` | Primario, links, sistema |
| `brand.red` | `#EF553B` | Severidad HIGH, errores HTTP |
| `brand.orange` | `#FFA15A` | Severidad MEDIUM |
| `brand.green` | `#00CC96` | LLM, estados OK |
| `brand.purple` | `#AB63FA` | Resumen, acumulados |
| `brand.yellow` | `#FECB52` | Severidad LOW |
| `surface.base` | `#0d1117` | Background principal |
| `surface.raised` | `#161b22` | Cards, panels |
| `surface.overlay` | `#21262d` | Hover, focus |
| `surface.border` | `#30363d` | Bordes |
| `text.primary` | `#e6edf3` | Texto principal |
| `text.secondary` | `#8b949e` | Labels, subtítulos |

**Por qué dark theme:** el dashboard es consumido principalmente en entornos NOC/SOC (24/7), donde el dark theme reduce la fatiga visual durante turnos nocturnos.

---

## 12. Despliegue en Cloud Foundry

### `manifest.yml`

```yaml
applications:
  - name: 3rpc-dashboard
    memory: 512M
    buildpacks:
      - nodejs_buildpack
    command: npm start
```

512MB es suficiente para el runtime Next.js + driver HANA. `npm start` ejecuta el servidor de producción pre-compilado (`next start`).

### `next.config.ts`

```typescript
{
  serverExternalPackages: ['@sap/hana-client'],
  turbopack: { root: path.resolve(__dirname) }
}
```

`serverExternalPackages` evita que Webpack intente bundlear `@sap/hana-client` — el driver incluye binarios nativos compilados (`.node` files) que no pueden ser bundleados.

### Comandos de despliegue

```bash
npm run build    # Compila Next.js para producción
cf push          # Sube a Cloud Foundry usando manifest.yml
```

---

## 13. Variables de entorno

Definidas en `.env.local` (desarrollo) o en `cf set-env` (producción).

| Variable | Descripción | Requerida |
|---|---|---|
| `HANA_HOST` | Host SAP HANA Cloud | Sí |
| `HANA_PORT` | Puerto (default: 443) | No |
| `HANA_USER` | Usuario HANA | Sí |
| `HANA_PASS` | Contraseña HANA | Sí |
| `HANA_SCHEMA` | Schema (ej: `SOC_LOGS`) | Sí |
| `GEMINI_API_KEY` | API key Google Gemini | Sí (chat + PDF) |

**Seguridad:** todas las variables son leídas en API Routes (server-side). El cliente React nunca tiene acceso a ellas. Next.js solo expone al cliente variables prefijadas con `NEXT_PUBLIC_` — ninguna de las variables aquí tiene ese prefijo.

---

## 14. Tipos de datos

Definidos en `types/index.ts` y compartidos entre API Routes y componentes cliente.

### `Anomaly`

```typescript
interface Anomaly {
  anomaly_id: string
  detected_at: string
  bucket_start: string
  anomaly_type: 'SPIKE' | 'MULTI_BUCKET' | 'CATEGORIZATION'
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  anomaly_score: number        // Más negativo = más anómalo (IForest score)
  n_requests: number
  n_unique_ips: number
  error_rate: number
  top_ip: string
  reason: string
  details_json: string         // JSON: { top_deviations, feature_snapshot, log_ids }
  attack_category: string      // DDoS | BruteForce | PromptInjection | ...
}
```

### `SystemLog`

```typescript
interface SystemLog {
  _id: string
  timestamp: string
  sourceip: string
  logtype: string              // INFO | WARNING | ERROR | AUDIT | SECURITY | PERF
  macro_region: string
  http_status_code: number
  is_security_event: number    // 0 | 1
  sap_app_env: string
}
```

### `LlmLog`

```typescript
interface LlmLog {
  _id: string
  timestamp: string
  llm_model_id: string
  llm_total_tokens: number
  llm_cost_usd: number
  llm_response_time_ms: number
  llm_status: string           // success | error | timeout
  llm_finish_reason: string    // stop | content_filter | length | ...
  llm_temperature: number
  llm_prompt: string
}
```

---

## 15. Riesgos técnicos y mitigaciones

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| 1 | **Saturación de conexiones HANA** | Media | Alto | Conexión nueva por query (no pool permanente). HANA Cloud permite ~100 conexiones simultáneas por instancia; con 4 rutas y refresh de 60s, el pico es <10 conexiones/min. |
| 2 | **Datos desactualizados en ventana de 55s** | Alta | Bajo | Aceptado por diseño. El pipeline Python detecta anomalías cada ~30 min; una ventana de 55s de stale data es irrelevante para el caso de uso de monitoreo. |
| 3 | **JSON inválido devuelto por Gemini** | Baja | Medio | `JSON.parse` falla explícitamente; el catch devuelve 500 con mensaje descriptivo. El ChatWidget muestra el error al usuario. Pendiente: reintentar la llamada automáticamente. |
| 4 | **Memoria en browser para PDFs grandes** | Baja | Bajo | jsPDF construye el PDF en memoria. Para >100 hallazgos, el blob puede exceder 10MB. Mitigación: el prompt de Gemini limita hallazgos a los más relevantes; en la práctica los reportes son <500KB. |
| 5 | **HANA SSL sin validación de certificado** | Media | Medio | `sslValidateCertificate: false` expone a MITM en red no controlada. En CF la conexión sale por red privada SAP BTP — riesgo real bajo. Para producción, configurar `sslTrustStore` con el certificado de HANA. |
| 6 | **Timeout de queries HANA lentas** | Baja | Medio | Queries con `h=168` sobre millones de filas pueden tardar >30s. El driver no tiene timeout configurable en este wrapper. Mitigación: añadir `LIMIT` en queries grandes o índice sobre `timestamp` en HANA. |
| 7 | **Build fallido por binarios nativos en CF** | Baja | Alto | `@sap/hana-client` descarga binarios según plataforma en `npm install`. CF usa Linux x64; el buildpack instala dependencias en el contenedor. Si el binario no está disponible para la versión de Node.js del buildpack, el deploy falla. Monitorear compatibilidad al actualizar Node.js. |

---
