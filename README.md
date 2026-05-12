# 3RPC Dashboard

Frontend de monitoreo del pipeline de detección de anomalías 3RPC. Visualiza en tiempo casi real los datos almacenados en SAP HANA Cloud: anomalías ML, logs de sistema SAP, logs de modelos LLM y un resumen ejecutivo consolidado. Incluye un chat asistente con IA (Gemini 2.5 Flash) y generación de reportes técnicos descargables en PDF.

---

## ¿Qué contiene?

| Página | Descripción |
|---|---|
| `/anomalias` | Timeline interactivo de anomalías detectadas por IsolationForest + HalfSpaceTrees, con filtros y detalle por bucket |
| `/system-logs` | Distribuciones de HTTP status, IPs, logtypes y entornos SAP |
| `/llm-logs` | Latencia, costo, modelos y finish reasons de llamadas LLM |
| `/resumen` | Vista ejecutiva consolidada con series de tiempo combinadas |
| Chat IA | Widget flotante con Gemini 2.5 Flash — análisis contextual y generación de reportes PDF |

> Para la arquitectura técnica completa (API routes, componentes, tipos, flujo de datos), ver [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## Requisitos previos

- **Node.js** ≥ 18
- Acceso a **SAP HANA Cloud** con las tablas `SYSTEM_LOGS`, `LLM_LOGS` y `ANOMALIES` (generadas por el pipeline Python 3RPC)
- **API key de Google Gemini** (para chat y reportes PDF)

---

## Instalación

### 1. Instalar dependencias

```bash
cd dashboard-next
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.local.example .env.local   # si existe, o crear el archivo manualmente
```

Edita `.env.local` con tus credenciales:

```env
# SAP HANA Cloud
HANA_HOST=tu-instancia.hna1.prod-us10.hanacloud.ondemand.com
HANA_PORT=443
HANA_USER=DBADMIN
HANA_PASS=tu_password
HANA_SCHEMA=SOC_LOGS

# Google Gemini (chat + reportes PDF)
GEMINI_API_KEY=tu_api_key
```

**Nunca commitees `.env.local`** — ya está en `.gitignore`.

### 3. Correr en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con Turbopack |
| `npm run build` | Build de producción |
| `npm start` | Servidor de producción (puerto `$PORT` o 3000) |
| `npm run lint` | ESLint |

---

## Despliegue en Cloud Foundry

```bash
npm run build
cf push
```

El `manifest.yml` ya está configurado con el buildpack Node.js y el comando `npm start`.

---

## Dependencias principales

| Paquete | Uso |
|---|---|
| Next.js 15 | Framework full-stack (App Router) |
| Recharts | Gráficos interactivos |
| SWR | Data fetching con cache y revalidación 60s |
| `@google/generative-ai` | Gemini 2.5 Flash (chat + PDF) |
| `@sap/hana-client` | Driver nativo SAP HANA Cloud |
| jsPDF | Generación de reportes PDF |
