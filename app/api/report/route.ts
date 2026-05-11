import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const REPORT_PROMPT = `Eres un experto en seguridad SAP. Analiza los datos del dashboard y genera un reporte técnico estructurado en formato JSON.

Devuelve ÚNICAMENTE un objeto JSON válido, sin markdown, sin backticks, sin texto adicional. La estructura debe ser exactamente:

{
  "titulo": "Reporte Técnico de Seguridad SAP - 3RPC",
  "periodo": "<descripción del período analizado>",
  "fecha_generacion": "<fecha y hora actual>",
  "nivel_riesgo": "<HIGH|MEDIUM|LOW según las anomalías encontradas>",
  "resumen_ejecutivo": "<2-3 párrafos con el estado general de seguridad>",
  "hallazgos": [
    {
      "titulo": "<título corto del hallazgo>",
      "descripcion": "<explicación técnica detallada>",
      "severidad": "<HIGH|MEDIUM|LOW>",
      "tipo": "<tipo de anomalía o log>"
    }
  ],
  "estadisticas": {
    "total_anomalias": <número>,
    "high": <número>,
    "medium": <número>,
    "low": <número>,
    "total_system_logs": <número>,
    "eventos_seguridad": <número>,
    "total_llm_logs": <número>,
    "costo_llm_usd": <número>
  },
  "recomendaciones": [
    "<acción concreta recomendada 1>",
    "<acción concreta recomendada 2>"
  ],
  "conclusion": "<párrafo de cierre con el resumen del estado y próximos pasos>"
}

Basa todos los valores en los datos reales del contexto. Si no hay datos suficientes para algún campo numérico, usa 0.`;

export async function POST(req: NextRequest) {
  try {
    const { context, hours } = await req.json() as {
      context: string;
      hours: number;
    };

    if (!context) {
      return NextResponse.json({ error: 'context requerido' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: REPORT_PROMPT,
    });

    const prompt = `Genera el reporte técnico basándote en los siguientes datos del dashboard (últimas ${hours}h):\n\n${context}`;
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();

    // Strip markdown fences if Gemini adds them anyway
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const report = JSON.parse(clean);

    return NextResponse.json({ report });
  } catch (err) {
    console.error('[report/route]', err);
    return NextResponse.json({ error: 'Error al generar el reporte' }, { status: 500 });
  }
}
