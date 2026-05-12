# 3RPC Dashboard — Reporte Técnico de Arquitectura

**Versión:** 1.0  
**Fecha:** 2026-05-12  
**Stack:** Next.js 15 · TypeScript · SAP HANA Cloud · Gemini 2.5 Flash

---

## Índice

1. [Descripción general](#1-descripción-general)
2. [Estructura de directorios](#2-estructura-de-directorios)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Flujo de datos](#4-flujo-de-datos)
5. [Páginas y rutas](#5-páginas-y-rutas)
6. [API Routes](#6-api-routes)
7. [Componentes](#7-componentes)
8. [Capa de datos](#8-capa-de-datos)
9. [Integración con IA](#9-integración-con-ia)
10. [Generación de reportes PDF](#10-generación-de-reportes-pdf)
11. [Sistema de diseño](#11-sistema-de-diseño)
12. [Despliegue en Cloud Foundry](#12-despliegue-en-cloud-foundry)
13. [Variables de entorno](#13-variables-de-entorno)
14. [Tipos de datos](#14-tipos-de-datos)
15. [Dependencias](#15-dependencias)

---

## 1. Descripción general

**3RPC Dashboard** es el frontend de monitoreo del pipeline de detección de anomalías 3RPC. Consume los datos almacenados en SAP HANA Cloud por el pipeline Python (ETL + ML) y los presenta en una interfaz web oscura en tiempo cuasi-real.

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
│   ├── anomalias/
│   │   └── page.tsx              # Detección de anomalías ML
│   ├── system-logs/
│   │   └── page.tsx              # Logs de sistema SAP
│   ├── llm-logs/
│   │   └── page.tsx              # Logs de modelos LLM
│   ├── resumen/
│   │   └── page.tsx              # Vista consolidada
│   └── api/
│       ├── anomalias/route.ts    # GET anomalías desde HANA
│       ├── system-logs/route.ts  # GET system logs
│       ├── llm-logs/route.ts     # GET LLM logs
│       ├── volume/route.ts       # GET volumen agregado por minuto
│       ├── chat/route.ts         # POST chat con Gemini
│       └── report/route.ts       # POST generación de reporte estructurado
│
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx           # Navegación + selector de horas
│   ├── ui/
│   │   ├── ChatWidget.tsx        # Chat IA flotante (bottom-right)
│   │   ├── KpiCard.tsx           # Tarjeta KPI reutilizable
│   │   └── SeverityBadge.tsx     # Badges HIGH / MEDIUM / LOW
│   └── charts/
│       └── VolumeChart.tsx       # AreaChart + anomaly markers SVG
│
├── lib/
│   ├── hana.ts                   # Wrapper conexión SAP HANA Cloud
│   ├── queries.ts                # SQL parametrizado por ventana temporal
│   └── generatePdf.ts            # Generador PDF (jsPDF, A4 portrait)
│
├── types/
│   └── index.ts                  # Interfaces TypeScript centralizadas
│
├── next.config.ts                # serverExternalPackages + Turbopack
├── tailwind.config.ts            # Tema oscuro con colores brand
├── tsconfig.json                 # Strict mode + alias @/*
├── package.json
├── manifest.yml                  # Cloud Foundry deployment
└── .env.local                    # Credenciales (gitignored)
```

---

## 3. Stack tecnológico

| Categoría | Tecnología | Versión | Uso |
|---|---|---|---|
| Framework | Next.js | 15.3.0 | App Router, API Routes, SSR/CSR |
| UI | React | 18.3.1 | Client components con hooks |
| Lenguaje | TypeScript | 5 | Strict mode, alias `@/*` |
| Estilos | Tailwind CSS | 3.4.4 | Dark theme, utility-first |
| Gráficos | Recharts | 2.12.7 | ComposedChart, AreaChart, PieChart |
| Data fetching | SWR | 2.2.5 | Cache + revalidación automática 60s |
| IA | Google Gemini | 2.5 Flash | Chat y generación de reportes |
| Base de datos | SAP HANA Cloud | hana-client 2.21.31 | Driver nativo Node.js |
| PDF | jsPDF | 4.2.1 | Generación en cliente A4 |
| Iconos | lucide-react | 0.400.0 | SVG tree-shakeable |
| Bundler | Turbopack | (Next.js built-in) | Builds rápidos en dev |

---

## 4. Flujo de datos

```
Usuario (navegador)
        │
        ▼
Next.js App Router (React Client Components)
        │
        │ useSWR (refreshInterval: 60s)
        ▼
API Routes  (/api/anomalias, /api/volume, /api/system-logs, /api/llm-logs)
        │
        │ lib/hana.ts  →  lib/queries.ts
        ▼
SAP HANA Cloud (SYSTEM_LOGS, LLM_LOGS, ANOMALIES)
        │
        ▼
JSON normalizado (columnas lowercase)
        │
        ▼
React state → Recharts → UI

── Flujo IA ──
ChatWidget
        │ fetchDashboardContext(hours)  →  3 APIs en paralelo
        ▼
POST /api/chat  {messages, context}
        │
        ▼
Gemini 2.5 Flash  →  texto de respuesta

── Flujo PDF ──
ChatWidget "Generar PDF"
        │
        ▼
POST /api/report  {context, hours}
        │
        ▼
Gemini 2.5 Flash  →  ReportData (JSON estructurado)
        │
        ▼
lib/generatePdf.ts  →  jsPDF  →  Blob descargable
```

---

## 5. Páginas y rutas

### `/` — Raíz
Redirect automático a `/anomalias`.

### `/anomalias` — Detección de Anomalías ML

Sección principal del dashboard. Muestra el output del pipeline Python (IsolationForest + HalfSpaceTrees).

**Estructura visual:**
```
KPIs (5): total anomalías · HIGH · MEDIUM · LOW · peor score
    ↓
VolumeChart (timeline interactivo)
  · Volumen sistema + LLM como áreas
  · Anomalías como markers SVG (▲ SPIKE, ◆ MULTI_BUCKET, ● CATEGORIZATION)
  · Granularidad: 1 min / 5 min / 10 min / 30 min / 1 h
  · Drag-to-zoom + reset
    ↓
Distribución: categorías de ataque (bar) + tipo × severidad (stacked bar)
    ↓
Tabla detalle (AnomalyCard expandible)
  · Filtros severidad y tipo
  · Top 8 features desviadas con z-scores
  · Feature snapshot completo
  · IDs de logs relacionados (trazabilidad → HANA)
```

**Data:** `/api/anomalias?h=X` + `/api/volume?table=SYSTEM_LOGS&h=X` + `/api/volume?table=LLM_LOGS&h=X`

### `/system-logs` — Logs de Sistema SAP

**Estructura visual:**
```
KPIs (4): total · IPs únicas · security events · tipos de log
    ↓
VolumeChart por granularidad
    ↓
Charts: logtype (bar) · HTTP status codes (bar coloreado) · Top 10 IPs · App env (donut)
    ↓
Tabla paginada (100 filas/página)
  [Timestamp · IP · Logtype · Status · HTTP · Región · Env · Security flag]
```

### `/llm-logs` — Logs de Modelos LLM

**Estructura visual:**
```
KPIs (4): total requests · avg latency · total cost · tokens
    ↓
VolumeChart
    ↓
Charts: modelos LLM (donut) · finish reason (bar) · latencia avg+p95 por modelo · costo por región
    ↓
Tabla paginada + sección de prompts expandibles (primeros 50)
```

### `/resumen` — Vista Consolidada

Vista ejecutiva con datos combinados de sistema + LLM.

**Estructura visual:**
```
KPIs (5): system logs · llm logs · security events · costo total · tokens
    ↓
Timeline combinado (AreaChart: Sistema + LLM + Total)
    ↓
Charts: logtype sistema · logtype LLM · top 10 regiones · seguridad vs normal
```

---

## 6. API Routes

Todas las rutas GET cachean con `Cache-Control: max-age=55, stale-while-revalidate=5`.

| Ruta | Método | Params | Descripción |
|---|---|---|---|
| `/api/anomalias` | GET | `h` (horas, default 24) | Anomalías de HANA con fallback si columna no existe |
| `/api/system-logs` | GET | `h` | System logs SAP |
| `/api/llm-logs` | GET | `h` | LLM logs |
| `/api/volume` | GET | `h`, `table` | Volumen agrupado por minuto por logtype |
| `/api/chat` | POST | body `{messages, context}` | Chat con Gemini 2.5 Flash |
| `/api/report` | POST | body `{context, hours}` | Genera `ReportData` JSON via Gemini |

**Validaciones comunes:**
- Parámetro `h` limitado a `[1, 168]` — máximo 7 días
- `/api/volume` añade `+1h` al rango para cubrir bordes de ventana
- `/api/anomalias` usa `TRY/CATCH` en SQL si `attack_category` no existe en el schema

---

## 7. Componentes

### `Sidebar.tsx`

Navegación fija izquierda con selector de ventana temporal.

- Links a las 4 páginas con ícono coloreado cuando está activo
- Slider de horas (1–168) con debounce 500 ms
- Botones preset: **1h · 6h · 24h · 3d · 7d**
- Botón Refresh con animación spin (llama `router.refresh()`)
- Estado sincronizado con URL query param `?h=X` via `useSearchParams`

### `ChatWidget.tsx`

Panel de chat flotante (bottom-right, 390×580 px).

**Flujo de uso:**
1. Al abrir, carga contexto del dashboard automáticamente (`fetchDashboardContext`)
2. El usuario escribe; `Enter` envía, `Shift+Enter` nueva línea
3. Suggestion buttons iniciales para preguntas frecuentes
4. Botón **Generar PDF** — llama `/api/report` → `generatePdf()` → descarga

**Gestión del contexto:**
```typescript
fetchDashboardContext(hours) {
  // Fetch paralelo:
  GET /api/anomalias?h=X
  GET /api/system-logs?h=X
  GET /api/llm-logs?h=X
  // Concatena en string estructurado como contexto para Gemini
}
```

### `VolumeChart.tsx`

Gráfico principal de series de tiempo (Recharts `ComposedChart`).

- **Área:** volumen de logs por minuto/bucket
- **Markers SVG personalizados:**
  - `▲` Triángulo — SPIKE
  - `◆` Diamante — MULTI_BUCKET
  - `●` Círculo — CATEGORIZATION
  - Opacidad por severidad: HIGH=1.0, MEDIUM=0.7, LOW=0.4
- **Drag-to-zoom:** arrastra en eje X para hacer zoom; botón reset
- **Click en anomalía:** callback `onAnomalyClick(id)` → scroll a detalle en tabla
- **Colores dinámicos** según tabla fuente (azul=sistema, verde=LLM)

Funciones helper internas:
- `parseHanaUtc(str)` — parsea timestamps de HANA como UTC
- `fmtTick(ts, granularity)` — formatea labels del eje X
- `bucketData(rows, granularity)` — agrega filas a la granularidad elegida

### `KpiCard.tsx`

Tarjeta reutilizable con borde izquierdo de color, valor grande, label y subtítulo opcional.

### `SeverityBadge.tsx`

- `SeverityBadge` — HIGH (rojo) / MEDIUM (naranja) / LOW (amarillo)
- `TypeBadge` — SPIKE / MULTI_BUCKET / CATEGORIZATION con colores brand

---

## 8. Capa de datos

### `lib/hana.ts`

Wrapper minimalista sobre `@sap/hana-client`:

```typescript
async function query<T>(sql: string): Promise<T[]>
// 1. Crea conexión con credenciales de process.env
// 2. Ejecuta SQL
// 3. Normaliza keys a lowercase
// 4. Desconecta y retorna rows
```

Configuración de conexión:
- `encrypt: true`
- `sslValidateCertificate: false`
- Host / Port / User / Password desde variables de entorno

### `lib/queries.ts`

Plantillas SQL parametrizadas por ventana temporal:

```typescript
const sql = {
  volume(table: string, hours: number): string
  // GROUP BY SUBSTR(timestamp,0,17), logtype — 1 min resolution

  anomalies(hours: number): string
  // SELECT todas las columnas FROM ANOMALIES WHERE timestamp >= since

  systemLogs(hours: number): string
  // SELECT columnas FROM SYSTEM_LOGS WHERE timestamp >= since

  llmLogs(hours: number): string
  // SELECT columnas FROM LLM_LOGS WHERE timestamp >= since
}

function since(hours: number): string
// Retorna timestamp UTC formateado: "YYYY-MM-DD HH:MM:SS"
```

---

## 9. Integración con IA

### Chat (`/api/chat`)

**Modelo:** Gemini 2.5 Flash (`gemini-2.5-flash-preview-04-17`)

**System prompt resumido:**
- Experto en seguridad SAP
- Interpreta anomalías, logs, métricas
- Sugiere acciones concretas ante incidentes
- Responde en español
- Acceso al contexto completo del dashboard

**Estructura de la petición:**
```typescript
{
  messages: { role: 'user' | 'model', text: string }[],
  context?: string  // JSON de las 3 APIs
}
```

### Generación de reportes (`/api/report`)

Gemini genera un `ReportData` estructurado en JSON:

```typescript
interface ReportData {
  titulo: string
  periodo: string
  fecha_generacion: string
  nivel_riesgo: 'CRÍTICO' | 'ALTO' | 'MEDIO' | 'BAJO'
  resumen_ejecutivo: string[]     // Párrafos
  hallazgos: {
    titulo: string
    descripcion: string
    severidad: string
    tipo: string
  }[]
  estadisticas: {
    total_anomalias: number
    high_severity: number
    medium_severity: number
    total_logs: number
    security_events: number
  }
  recomendaciones: string[]
  conclusion: string
}
```

---

## 10. Generación de reportes PDF

### `lib/generatePdf.ts`

Usa jsPDF (A4 portrait) con diseño estructurado en secciones:

```
1. Header (fondo azul oscuro)
   ├─ Título "3RPC — Reporte de Seguridad SAP"
   ├─ Badge nivel de riesgo (color dinámico)
   └─ Período analizado

2. Meta info
   └─ Fecha y hora de generación

3. Estadísticas (grid 4×2)
   └─ 8 KPIs con colores según severidad

4. Resumen ejecutivo
   └─ Párrafos con texto wrapped automático

5. Hallazgos de seguridad
   └─ Bloques numerados (título + severidad badge + descripción)

6. Recomendaciones
   └─ Lista con bullet azul

7. Conclusión

8. Footer en cada página
   └─ Línea gris + "Generado por 3RPC — 3RPC-SAP-Security — Pág N"
```

**Nombre del archivo:** `reporte-seguridad-sap-YYYY-MM-DD.pdf`

**Saltos de página automáticos:** función `checkY(needed)` verifica espacio restante antes de cada bloque.

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

### `globals.css`

- Scrollbar personalizada (oscura, redondeada)
- Range input con thumb azul brand
- Tabla con header sticky

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

### `next.config.ts`

```typescript
{
  serverExternalPackages: ['@sap/hana-client'],
  turbopack: { root: path.resolve(__dirname) }
}
```

- `serverExternalPackages`: excluye el driver HANA del bundle (debe ser nativo Node.js)
- `turbopack`: bundler de desarrollo más rápido

### Comandos

```bash
# Desarrollo
npm run dev

# Build + producción
npm run build
npm start

# Deploy Cloud Foundry
cf push
```

---

## 13. Variables de entorno

Definidas en `.env.local` (desarrollo) o en CF environment (producción).

| Variable | Descripción | Requerida |
|---|---|---|
| `HANA_HOST` | Host SAP HANA Cloud | Sí |
| `HANA_PORT` | Puerto (default: 443) | No |
| `HANA_USER` | Usuario HANA | Sí |
| `HANA_PASS` | Contraseña HANA | Sí |
| `HANA_SCHEMA` | Schema (ej: `SOC_LOGS`) | Sí |
| `GEMINI_API_KEY` | API key Google Gemini | Sí (chat + PDF) |
| `CF_API` | Endpoint Cloud Foundry | Opcional |
| `CF_USER` / `CF_PASS` | Credenciales CF | Opcional |
| `CF_ORG` / `CF_SPACE` | Organización y espacio CF | Opcional |

---

## 14. Tipos de datos

Definidos en `types/index.ts`:

### `Anomaly`

```typescript
interface Anomaly {
  anomaly_id: string
  detected_at: string
  bucket_start: string
  anomaly_type: 'SPIKE' | 'MULTI_BUCKET' | 'CATEGORIZATION'
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  anomaly_score: number        // Más negativo = más anómalo
  n_requests: number
  n_unique_ips: number
  error_rate: number
  top_ip: string
  reason: string
  details_json: string         // JSON: top_deviations, feature_snapshot, log_ids
  attack_category: string
}
```

### `SystemLog`

```typescript
interface SystemLog {
  _id: string
  timestamp: string
  sourceip: string
  port_service: string
  event_description: string
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
  llm_model_id: string         // ej: "gemini-2.5-flash"
  llm_total_tokens: number
  llm_cost_usd: number
  llm_response_time_ms: number
  llm_status: string           // success | error | timeout
  llm_finish_reason: string    // stop | content_filter | length | ...
  llm_temperature: number
  llm_prompt: string
}
```

### `VolumeRow`

```typescript
interface VolumeRow {
  minute_str: string           // "2026-05-11 14:35"
  logtype: string
  cnt: number
}
```

---

## 15. Dependencias

| Paquete | Versión | Uso |
|---|---|---|
| `next` | 15.3.0 | Framework full-stack |
| `react` / `react-dom` | 18.3.1 | UI library |
| `typescript` | 5 | Type safety |
| `tailwindcss` | 3.4.4 | Utility-first CSS |
| `recharts` | 2.12.7 | Gráficos composables |
| `swr` | 2.2.5 | Data fetching + cache |
| `@google/generative-ai` | 0.24.1 | Gemini API client |
| `@sap/hana-client` | 2.21.31 | Driver SAP HANA Cloud |
| `jspdf` | 4.2.1 | Generación de PDF |
| `lucide-react` | 0.400.0 | Iconografía SVG |
| `clsx` | 2.1.1 | Composición de classnames |

---

*Generado a partir del código fuente del proyecto.*
