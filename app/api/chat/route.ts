import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Cadena de modelos con cuota independiente. Si uno se agota, prueba el siguiente.
const MODEL_FALLBACK_CHAIN = [
  'gemini-2.5-flash',          // primario, mejor calidad
  'gemini-2.5-flash-lite',     // fallback 1, más rápido, cuota propia
  'gemini-flash-latest',       // fallback 2, alias dinámico
  'gemini-2.5-pro',            // fallback 3, calidad alta
];

const SYSTEM_PROMPT = `Eres un asistente experto en seguridad SAP integrado en el dashboard 3RPC SAP Security Monitor.
Tu ÚNICO propósito es explicar anomalías de seguridad, logs SAP, eventos del dashboard y temas relacionados con ciberseguridad/monitoreo de sistemas SAP.

REGLA DE SALUDOS CASUALES (PRIORIDAD MÁXIMA):
Si el usuario solo saluda o hace small talk ("hola", "buenos días", "qué tal", "hey", "gracias", "ok"), responde SIEMPRE de forma breve (1-2 oraciones) y pregunta en qué puedes ayudarle con el dashboard.
Ejemplo: "¡Hola! Soy tu asistente de seguridad SAP. ¿Quieres que te explique alguna anomalía activa, los logs recientes, o tienes alguna otra duda sobre el dashboard?"

NO inicies un análisis automático ante un saludo. Espera a que el usuario pregunte algo concreto.

REGLA DE SCOPE:
Si la pregunta NO es un saludo Y NO está relacionada con:
- Anomalías del modelo ML (SPIKE, MULTI_BUCKET, CATEGORIZATION)
- System logs o LLM logs del dashboard
- Seguridad SAP, ataques, IPs sospechosas, eventos de seguridad
- Métricas, severidades, acciones de respuesta a incidentes
- Funcionamiento del dashboard 3RPC

Responde EXACTAMENTE así:
"Solo puedo ayudarte con temas de seguridad SAP, anomalías del modelo ML y análisis de logs del dashboard 3RPC. ¿Sobre qué aspecto de la seguridad de tu sistema te gustaría que te explique?"

NO respondas sobre: recetas, política, programación general, matemáticas, entretenimiento, deportes, vida personal, ni cualquier tema fuera del dashboard.

CUANDO LA PREGUNTA SÍ ES DEL SCOPE:
Si el usuario te comparte datos de anomalías o logs, debes:
1. Explicar en lenguaje sencillo qué significa cada anomalía o log
2. Indicar el nivel de riesgo y por qué es importante
3. Describir qué pudo haber causado esa anomalía
4. Sugerir acciones concretas que el equipo de seguridad debería tomar
5. Contextualizar dentro del entorno SAP

Tipos de anomalías:
- SPIKE: Pico anormal de requests en una ventana de tiempo
- MULTI_BUCKET: Anomalía que persiste en múltiples ventanas consecutivas
- CATEGORIZATION: El ML detectó un patrón inusual

Severidades:
- HIGH: Acción inmediata, posible ataque activo
- MEDIUM: Investigar en próximas horas
- LOW: Monitorear, puede ser falso positivo

FORMATO:
- Responde siempre en español.
- Estructura con **subtítulos en negrita** y bullets.
- Resalta con **negritas** lo crítico: severidad, IPs, scores, acciones.
- Cita datos específicos del contexto (IPs, scores, números reales).
- Sin preámbulos ("¡Claro!", "Por supuesto") ni cierres ("¿algo más?").`;

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

async function tryModel(
  modelId: string,
  history: { role: string; parts: { text: string }[] }[],
  userText: string,
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      maxOutputTokens: 3072,
      temperature: 0.7,
    },
  });
  const chat = model.startChat({ history });
  const result = await chat.sendMessage(userText);
  return result.response.text();
}

function isQuotaOr404Error(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  return e?.status === 429 || e?.status === 404
    || (e?.message?.includes('quota') ?? false)
    || (e?.message?.includes('not found') ?? false);
}

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json() as {
      messages: ChatMessage[];
      context?: string;
    };

    if (!messages?.length) {
      return NextResponse.json({ error: 'messages requeridos' }, { status: 400 });
    }

    const historyRaw = messages.slice(0, -1);
    const firstUserIdx = historyRaw.findIndex((m) => m.role === 'user');
    const history = (firstUserIdx === -1 ? [] : historyRaw.slice(firstUserIdx)).map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    const lastMsg = messages[messages.length - 1];
    const userText = context
      ? `${lastMsg.text}\n\n--- Contexto actual del dashboard ---\n${context}`
      : lastMsg.text;

    // Intenta cada modelo en orden hasta que uno responda
    let lastError: unknown = null;
    for (const modelId of MODEL_FALLBACK_CHAIN) {
      try {
        const text = await tryModel(modelId, history, userText);
        console.log(`[chat/route] OK con modelo: ${modelId}`);
        return NextResponse.json({ text, model: modelId });
      } catch (err) {
        lastError = err;
        if (isQuotaOr404Error(err)) {
          console.warn(`[chat/route] ${modelId} sin cuota o no disponible, probando siguiente…`);
          continue;
        }
        // error no recuperable
        throw err;
      }
    }

    console.error('[chat/route] Todos los modelos fallaron', lastError);
    return NextResponse.json({
      error: 'Todos los modelos de Gemini están sin cuota. Espera unos minutos o crea una nueva API key.',
    }, { status: 503 });
  } catch (err) {
    console.error('[chat/route]', err);
    return NextResponse.json({ error: 'Error al conectar con Gemini' }, { status: 500 });
  }
}