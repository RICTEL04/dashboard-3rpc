export interface ReportData {
  titulo: string;
  periodo: string;
  fecha_generacion: string;
  nivel_riesgo: 'HIGH' | 'MEDIUM' | 'LOW';
  resumen_ejecutivo: string;
  hallazgos: {
    titulo: string;
    descripcion: string;
    severidad: 'HIGH' | 'MEDIUM' | 'LOW';
    tipo: string;
  }[];
  estadisticas: {
    total_anomalias: number;
    high: number;
    medium: number;
    low: number;
    total_system_logs: number;
    eventos_seguridad: number;
    total_llm_logs: number;
    costo_llm_usd: number;
  };
  recomendaciones: string[];
  conclusion: string;
}

const RISK_COLORS: Record<string, [number, number, number]> = {
  HIGH:   [220, 38,  38],
  MEDIUM: [234, 179, 8],
  LOW:    [34,  197, 94],
};

const SEV_LABEL: Record<string, string> = {
  HIGH: 'ALTO', MEDIUM: 'MEDIO', LOW: 'BAJO',
};

export async function generatePdf(report: ReportData): Promise<void> {
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const MARGIN = 18;
  const CONTENT_W = W - MARGIN * 2;
  let y = 0;

  // ── helpers ──────────────────────────────────────────────────────────────
  const rgb = (r: number, g: number, b: number) => doc.setTextColor(r, g, b);
  const fill = (r: number, g: number, b: number) => doc.setFillColor(r, g, b);

  function addPage() {
    doc.addPage();
    y = MARGIN;
    drawFooter();
  }

  function checkY(needed: number) {
    if (y + needed > 275) addPage();
  }

  function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
    doc.setFontSize(fontSize);
    return doc.splitTextToSize(text, maxWidth) as string[];
  }

  function drawFooter() {
    const page = doc.getCurrentPageInfo().pageNumber;
    doc.setFontSize(8);
    rgb(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text('3RPC SAP Security Monitor — Reporte generado con IA · Confidencial', MARGIN, 290);
    doc.text(`Pág. ${page}`, W - MARGIN, 290, { align: 'right' });
  }

  // ── HEADER ────────────────────────────────────────────────────────────────
  fill(15, 23, 42);
  doc.rect(0, 0, W, 38, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  rgb(255, 255, 255);
  doc.text('3RPC SAP Security Monitor', MARGIN, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  rgb(148, 163, 184);
  doc.text('Reporte Técnico de Seguridad', MARGIN, 23);

  // Risk badge
  const riskColor = RISK_COLORS[report.nivel_riesgo] ?? RISK_COLORS.LOW;
  fill(...riskColor);
  doc.roundedRect(W - MARGIN - 36, 10, 36, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  rgb(255, 255, 255);
  doc.text(`RIESGO ${SEV_LABEL[report.nivel_riesgo]}`, W - MARGIN - 18, 18, { align: 'center' });

  y = 46;

  // ── META INFO ─────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  rgb(100, 116, 139);
  doc.text(`Período: ${report.periodo}`, MARGIN, y);
  doc.text(`Generado: ${report.fecha_generacion}`, W - MARGIN, y, { align: 'right' });
  y += 3;

  fill(226, 232, 240);
  doc.rect(MARGIN, y, CONTENT_W, 0.3, 'F');
  y += 7;

  // ── ESTADÍSTICAS ─────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  rgb(15, 23, 42);
  doc.text('ESTADÍSTICAS DEL PERÍODO', MARGIN, y);
  y += 5;

  const stats = [
    { label: 'Anomalías totales', value: String(report.estadisticas.total_anomalias), color: [99, 102, 241] as [number,number,number] },
    { label: 'Alta severidad',    value: String(report.estadisticas.high),            color: RISK_COLORS.HIGH },
    { label: 'Media severidad',   value: String(report.estadisticas.medium),          color: RISK_COLORS.MEDIUM },
    { label: 'Baja severidad',    value: String(report.estadisticas.low),             color: RISK_COLORS.LOW },
    { label: 'System Logs',       value: String(report.estadisticas.total_system_logs), color: [99, 102, 241] as [number,number,number] },
    { label: 'Eventos seguridad', value: String(report.estadisticas.eventos_seguridad), color: RISK_COLORS.HIGH },
    { label: 'LLM Logs',          value: String(report.estadisticas.total_llm_logs),    color: [99, 102, 241] as [number,number,number] },
    { label: 'Costo LLM (USD)',   value: `$${Number(report.estadisticas.costo_llm_usd).toFixed(4)}`, color: [16, 185, 129] as [number,number,number] },
  ];

  const BOX_W = (CONTENT_W - 6) / 4;
  const BOX_H = 18;

  stats.forEach((s, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const bx = MARGIN + col * (BOX_W + 2);
    const by = y + row * (BOX_H + 3);

    fill(248, 250, 252);
    doc.roundedRect(bx, by, BOX_W, BOX_H, 2, 2, 'F');

    // color accent bar
    fill(...s.color);
    doc.roundedRect(bx, by, 3, BOX_H, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    rgb(...s.color);
    doc.text(s.value, bx + BOX_W / 2 + 1.5, by + 9, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    rgb(100, 116, 139);
    doc.text(s.label, bx + BOX_W / 2 + 1.5, by + 14.5, { align: 'center' });
  });

  y += (BOX_H + 3) * 2 + 5;

  // ── RESUMEN EJECUTIVO ─────────────────────────────────────────────────────
  fill(226, 232, 240);
  doc.rect(MARGIN, y, CONTENT_W, 0.3, 'F');
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  rgb(15, 23, 42);
  doc.text('RESUMEN EJECUTIVO', MARGIN, y);
  y += 5;

  const summaryLines = wrapText(report.resumen_ejecutivo, CONTENT_W, 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  rgb(51, 65, 85);
  summaryLines.forEach((line) => {
    checkY(5);
    doc.text(line, MARGIN, y);
    y += 4.8;
  });
  y += 4;

  // ── HALLAZGOS ─────────────────────────────────────────────────────────────
  checkY(16);
  fill(226, 232, 240);
  doc.rect(MARGIN, y, CONTENT_W, 0.3, 'F');
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  rgb(15, 23, 42);
  doc.text('HALLAZGOS DE SEGURIDAD', MARGIN, y);
  y += 6;

  report.hallazgos.forEach((h, i) => {
    const descLines = wrapText(h.descripcion, CONTENT_W - 8, 8.5);
    const blockH = 10 + descLines.length * 4.5 + 4;
    checkY(blockH);

    const sevColor = RISK_COLORS[h.severidad] ?? RISK_COLORS.LOW;

    fill(248, 250, 252);
    doc.roundedRect(MARGIN, y, CONTENT_W, blockH, 2, 2, 'F');
    fill(...sevColor);
    doc.roundedRect(MARGIN, y, 3, blockH, 1, 1, 'F');

    // Finding number + title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    rgb(15, 23, 42);
    doc.text(`${i + 1}. ${h.titulo}`, MARGIN + 6, y + 6);

    // Severity + type badge
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    rgb(...sevColor);
    doc.text(`[${SEV_LABEL[h.severidad]}]  ${h.tipo}`, W - MARGIN, y + 6, { align: 'right' });

    // Description
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    rgb(51, 65, 85);
    let dy = y + 11;
    descLines.forEach((line) => {
      doc.text(line, MARGIN + 6, dy);
      dy += 4.5;
    });

    y += blockH + 3;
  });

  // ── RECOMENDACIONES ───────────────────────────────────────────────────────
  checkY(16);
  fill(226, 232, 240);
  doc.rect(MARGIN, y, CONTENT_W, 0.3, 'F');
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  rgb(15, 23, 42);
  doc.text('RECOMENDACIONES', MARGIN, y);
  y += 6;

  report.recomendaciones.forEach((rec, i) => {
    const recLines = wrapText(`${i + 1}.  ${rec}`, CONTENT_W - 4, 9);
    const blockH = recLines.length * 4.8 + 5;
    checkY(blockH);

    fill(239, 246, 255);
    doc.roundedRect(MARGIN, y, CONTENT_W, blockH, 2, 2, 'F');
    fill(99, 102, 241);
    doc.roundedRect(MARGIN, y, 3, blockH, 1, 1, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    rgb(30, 41, 59);
    let dy = y + 5;
    recLines.forEach((line) => {
      doc.text(line, MARGIN + 6, dy);
      dy += 4.8;
    });

    y += blockH + 3;
  });

  // ── CONCLUSIÓN ────────────────────────────────────────────────────────────
  checkY(20);
  fill(226, 232, 240);
  doc.rect(MARGIN, y, CONTENT_W, 0.3, 'F');
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  rgb(15, 23, 42);
  doc.text('CONCLUSIÓN', MARGIN, y);
  y += 5;

  const conclusionLines = wrapText(report.conclusion, CONTENT_W, 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  rgb(51, 65, 85);
  conclusionLines.forEach((line) => {
    checkY(5);
    doc.text(line, MARGIN, y);
    y += 4.8;
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter();
  }

  const fecha = new Date().toISOString().slice(0, 10);
  doc.save(`reporte-seguridad-sap-${fecha}.pdf`);
}
