import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_PROMPT = `Eres un asistente experto en seguridad SAP integrado en el dashboard 3RPC SAP Security Monitor.
Tu misión es explicar anomalías de seguridad y logs de manera clara y comprensible para usuarios que pueden no ser expertos técnicos.

Cuando el usuario te comparta datos de anomalías o logs, debes:
1. Explicar en lenguaje sencillo qué significa cada anomalía o log
2. Indicar el nivel de riesgo y por qué es importante
3. Describir qué pudo haber causado esa anomalía (SPIKE de tráfico, acceso inusual, etc.)
4. Sugerir acciones concretas que el equipo de seguridad debería tomar
5. Contextualizar dentro del entorno SAP (transacciones, servicios LLM SAP, etc.)

Tipos de anomalías que puedes encontrar:
- SPIKE: Pico anormal de requests en una ventana de tiempo
- MULTI_BUCKET: Anomalía que persiste en múltiples ventanas de tiempo consecutivas
- CATEGORIZATION: El ML detectó un patrón de comportamiento inusual en las categorías de tráfico

Severidades:
- HIGH: Acción inmediata requerida, posible ataque activo
- MEDIUM: Investigar en las próximas horas
- LOW: Monitorear, puede ser falso positivo

Responde siempre en español, de forma concisa y estructurada. Usa bullets o secciones cortas cuando sea útil.`;

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json() as {
      messages: { role: 'user' | 'model'; text: string }[];
      context?: string;
    };

    if (!messages?.length) {
      return NextResponse.json({ error: 'messages requeridos' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT,
    });

    const historyRaw = messages.slice(0, -1);
    const firstUserIdx = historyRaw.findIndex((m) => m.role === 'user');
    const history = (firstUserIdx === -1 ? [] : historyRaw.slice(firstUserIdx)).map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    const chat = model.startChat({ history });

    const lastMsg = messages[messages.length - 1];
    const userText = context
      ? `${lastMsg.text}\n\n--- Contexto actual del dashboard ---\n${context}`
      : lastMsg.text;

    const result = await chat.sendMessage(userText);
    const text = result.response.text();

    return NextResponse.json({ text });
  } catch (err) {
    console.error('[chat/route]', err);
    return NextResponse.json({ error: 'Error al conectar con Gemini' }, { status: 500 });
  }
}
