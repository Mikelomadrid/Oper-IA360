import { useCallback } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Constantes de color ────────────────────────────────────────────────────
const ORKALED_COLOR  = [30, 64, 175];
const DARK_COLOR     = [15, 23, 42];
const MUTED_COLOR    = [100, 116, 139];
const GREEN_COLOR    = [22, 163, 74];
const RED_COLOR      = [220, 38, 38];
const ORANGE_COLOR   = [234, 88, 12];
const LIGHT_BG       = [248, 250, 252];
const BORDER_COLOR   = [226, 232, 240];
const WHITE          = [255, 255, 255];
const PURPLE_COLOR   = [124, 58, 237];
const BLUE_LIGHT     = [239, 246, 255];

// ─── Tarifas horarias reales ────────────────────────────────────────────────
const TARIFA_NORMAL       = 27;    // €/h jornada normal
const TARIFA_EXTRA_DIARIO = 14.19; // €/h extra entre semana (Oficial 1ª)
const TARIFA_EXTRA_FINDE  = 16.73; // €/h extra festivo/fin de semana (Oficial 1ª)

// ─── Helpers de formato ─────────────────────────────────────────────────────
const fmtEur = (val) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val || 0);

const fmtPct = (val) =>
  `${Number(val || 0).toFixed(2)}%`;

const fmtH = (h) => {
  const hNum = Number(h || 0);
  return `${Math.floor(hNum)}h ${Math.round((hNum % 1) * 60)}min`;
};

const fmtFecha = (str) => {
  if (!str) return '—';
  try { return format(new Date(str), 'dd/MM/yyyy', { locale: es }); }
  catch { return str; }
};

const capitalize = (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ') : '—';

export function useInformeObraPDF() {

  const generarPDF = useCallback(async ({ info, kpis, gastos = [], horasData = [], fichajes = [], partidas = [] }) => {

    let jsPDF;
    try {
      const mod = await import('jspdf');
      jsPDF = mod.default || mod.jsPDF;
    } catch (e) {
      alert('Error: jsPDF no está instalado. Ejecuta: npm install jspdf');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PW = 210, PH = 297, ML = 14, MR = 14;
    const CW = PW - ML - MR;
    let y = 0;

    // ─── Helpers PDF ─────────────────────────────────────────────────────────
    const setFont = (style = 'normal', size = 10) => { doc.setFont('helvetica', style); doc.setFontSize(size); };
    const setColor = (rgb) => doc.setTextColor(...rgb);
    const line = (x1, y1, x2, y2, rgb = BORDER_COLOR, lw = 0.3) => { doc.setDrawColor(...rgb); doc.setLineWidth(lw); doc.line(x1, y1, x2, y2); };
    const rect = (x, yr, w, h, fillRgb, strokeRgb = null) => {
      if (fillRgb) doc.setFillColor(...fillRgb);
      if (strokeRgb) doc.setDrawColor(...strokeRgb);
      doc.rect(x, yr, w, h, fillRgb && strokeRgb ? 'FD' : fillRgb ? 'F' : 'D');
    };
    const text = (txt, x, yt, opts = {}) => doc.text(String(txt ?? '—'), x, yt, opts);

    const checkPageBreak = (needed = 20) => {
      if (y + needed > PH - 18) { doc.addPage(); y = 20; drawFooter(); }
    };

    const drawFooter = () => {
      const pg = doc.internal.getNumberOfPages();
      setFont('normal', 7.5);
      setColor(MUTED_COLOR);
      text(`Orkaled Instalaciones SLU — Informe generado el ${format(new Date(), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}`, ML, PH - 8);
      text(`Pág. ${pg}`, PW - MR, PH - 8, { align: 'right' });
      line(ML, PH - 12, PW - MR, PH - 12);
    };

    const drawSectionTitle = (title) => {
      checkPageBreak(16);
      rect(ML, y - 4, CW, 10, ORKALED_COLOR);
      setFont('bold', 9.5);
      setColor(WHITE);
      text(title, ML + 3, y + 2.5);
      y += 10;
    };

    const drawTableHeader = (cols) => {
      rect(ML, y, CW, 8, DARK_COLOR);
      setFont('bold', 7.5);
      setColor(WHITE);
      cols.forEach(col => text(col.label, col.x, y + 5.5, { align: col.align || 'left' }));
      y += 8;
    };

    const drawTableRow = (cols, idx, bold = false) => {
      checkPageBreak(9);
      rect(ML, y, CW, 8, idx % 2 === 0 ? WHITE : LIGHT_BG, BORDER_COLOR);
      cols.forEach(col => {
        setFont(bold ? 'bold' : 'normal', col.size || 8);
        setColor(col.color || (bold ? DARK_COLOR : MUTED_COLOR));
        text(col.value, col.x, y + 5.5, { align: col.align || 'left' });
      });
      y += 8;
    };

    // ═══════════════════════════════════════════════════════════════════════
    // PÁGINA 1 — CABECERA
    // ═══════════════════════════════════════════════════════════════════════

    rect(0, 0, PW, 40, ORKALED_COLOR);

    setFont('bold', 20);
    setColor(WHITE);
    text('INFORME DE OBRA', ML, 17);

    setFont('normal', 9);
    setColor([147, 197, 253]);
    text('Orkaled Instalaciones SLU', ML, 25);

    setFont('normal', 8);
    setColor([203, 213, 225]);
    text(`Generado: ${format(new Date(), "dd 'de' MMMM yyyy, HH:mm", { locale: es })}`, ML, 32);

    // Badge estado
    const estadoLabel = capitalize(info?.estado || 'activo');
    const estadoColor = ['terminado','facturado','cobrado','completada'].includes(info?.estado)
      ? [34, 197, 94] : info?.estado === 'en_espera' ? [234, 179, 8] : [96, 165, 250];
    rect(PW - MR - 38, 8, 38, 11, estadoColor);
    setFont('bold', 8.5);
    setColor(WHITE);
    text(estadoLabel.toUpperCase(), PW - MR - 38 + 19, 14.5, { align: 'center' });

    y = 50;

    // Nombre obra
    setFont('bold', 17);
    setColor(DARK_COLOR);
    const splitNombre = doc.splitTextToSize(info?.nombre_proyecto || 'Sin nombre', CW);
    doc.text(splitNombre, ML, y);
    y += splitNombre.length * 7 + 2;

    if (info?.descripcion) {
      setFont('normal', 8.5);
      setColor(MUTED_COLOR);
      const splitDesc = doc.splitTextToSize(info.descripcion, CW);
      doc.text(splitDesc, ML, y);
      y += splitDesc.length * 5 + 3;
    }

    line(ML, y, PW - MR, y, ORKALED_COLOR, 0.6);
    y += 8;

    // ─── DATOS GENERALES ────────────────────────────────────────────────────
    drawSectionTitle('1. DATOS GENERALES DE LA OBRA');

    const cliente = info?.cliente;
    const generalData = [
      ['Cliente', cliente?.nombre || '—', 'Contacto', info?.contacto_nombre || cliente?.contacto || '—'],
      ['Teléfono', info?.contacto_telefono || cliente?.telefono || '—', 'Estado', capitalize(info?.estado)],
      ['Dirección obra', info?.direccion_obra || '—', 'Inicio', fmtFecha(info?.fecha_inicio)],
      ['Fin estimado', fmtFecha(info?.fecha_fin_estimada), 'Fin real', info?.fecha_fin_real ? fmtFecha(info.fecha_fin_real) : 'En curso'],
    ];

    generalData.forEach((row, i) => {
      checkPageBreak(10);
      rect(ML, y, CW, 9, i % 2 === 0 ? WHITE : LIGHT_BG, BORDER_COLOR);
      setFont('normal', 7.5); setColor(MUTED_COLOR);
      text(row[0], ML + 2, y + 6);
      setFont('bold', 8.5); setColor(DARK_COLOR);
      text(row[1], ML + CW * 0.25, y + 6);
      setFont('normal', 7.5); setColor(MUTED_COLOR);
      text(row[2], ML + CW * 0.52, y + 6);
      setFont('bold', 8.5); setColor(DARK_COLOR);
      text(row[3], ML + CW * 0.75, y + 6);
      y += 9;
    });
    y += 6;

    // ─── KPIs ECONÓMICOS (4 tarjetas) ───────────────────────────────────────
    drawSectionTitle('2. RESUMEN ECONÓMICO');

    const presupuesto  = Number(kpis?.presupuesto_aceptado || 0);
    const costeMat     = Number(kpis?.coste_total_materiales || 0);
    const costeMO      = Number(kpis?.coste_total_mano_obra || 0);
    const costeTotal   = Number(kpis?.costo_total || 0);
    const margen       = Number(kpis?.margen || 0);
    const rentabilidad = Number(kpis?.rentabilidad_real_pct || 0);
    const objMargen    = Number(kpis?.objetivo_margen_pct || 0);

    const kpiCards = [
      { label: 'PRESUPUESTO ACEPTADO', value: fmtEur(presupuesto), color: ORKALED_COLOR },
      { label: 'COSTE TOTAL',          value: fmtEur(costeTotal),  color: ORANGE_COLOR },
      { label: 'MARGEN BRUTO',         value: fmtEur(margen),      color: margen >= 0 ? GREEN_COLOR : RED_COLOR },
      { label: 'RENTABILIDAD REAL',    value: fmtPct(rentabilidad), color: rentabilidad >= 0 ? GREEN_COLOR : RED_COLOR },
    ];

    const cardW = (CW - 6) / 2;
    const cardH = 24;
    kpiCards.forEach((card, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const xC = ML + col * (cardW + 6), yC = y + row * (cardH + 4);
      rect(xC, yC, cardW, cardH, LIGHT_BG, BORDER_COLOR);
      rect(xC, yC, 3, cardH, card.color);
      setFont('normal', 7); setColor(MUTED_COLOR);
      text(card.label, xC + 6, yC + 9);
      setFont('bold', 14); setColor(card.color);
      text(card.value, xC + cardW - 4, yC + 20, { align: 'right' });
    });
    y += 2 * (cardH + 4) + 6;

    // Tabla desglose costes
    checkPageBreak(45);
    drawTableHeader([
      { label: 'CONCEPTO',        x: ML + 3 },
      { label: 'IMPORTE',         x: ML + CW * 0.52, align: 'right' },
      { label: '% S/PRESUPUESTO', x: ML + CW * 0.75, align: 'right' },
      { label: 'BARRA',           x: ML + CW - 2,    align: 'right' },
    ]);

    const costesRows = [
      { label: 'Materiales',   val: costeMat,  pct: presupuesto > 0 ? costeMat / presupuesto * 100 : 0,  color: [59, 130, 246] },
      { label: 'Mano de Obra', val: costeMO,   pct: presupuesto > 0 ? costeMO / presupuesto * 100 : 0,   color: ORANGE_COLOR },
      { label: 'TOTAL COSTES', val: costeTotal, pct: presupuesto > 0 ? costeTotal / presupuesto * 100 : 0, color: DARK_COLOR, bold: true },
    ];

    costesRows.forEach((c, i) => {
      checkPageBreak(9);
      rect(ML, y, CW, 8, c.bold ? [241, 245, 249] : i % 2 === 0 ? WHITE : LIGHT_BG, BORDER_COLOR);
      setFont(c.bold ? 'bold' : 'normal', 8.5); setColor(c.bold ? DARK_COLOR : MUTED_COLOR);
      text(c.label, ML + 3, y + 5.5);
      setFont(c.bold ? 'bold' : 'normal', 8.5); setColor(c.color);
      text(fmtEur(c.val), ML + CW * 0.52, y + 5.5, { align: 'right' });
      setFont('normal', 8); setColor(MUTED_COLOR);
      text(fmtPct(c.pct), ML + CW * 0.75, y + 5.5, { align: 'right' });
      if (!c.bold && presupuesto > 0) {
        const bX = ML + CW * 0.79, bW = CW * 0.19, bH = 3, bY = y + 2.5;
        rect(bX, bY, bW, bH, BORDER_COLOR);
        const fill = Math.min(c.pct / 100, 1) * bW;
        if (fill > 0) rect(bX, bY, fill, bH, c.color);
      }
      y += 8;
    });
    y += 5;

    // Análisis rentabilidad
    checkPageBreak(35);
    drawSectionTitle('3. ANÁLISIS DE RENTABILIDAD');

    const analisisRows = [
      { l: 'Presupuesto aceptado',    v: fmtEur(presupuesto),               c: ORKALED_COLOR },
      { l: 'Total costes',             v: fmtEur(costeTotal),                c: ORANGE_COLOR },
      { l: 'Margen bruto (€)',         v: fmtEur(margen),                    c: margen >= 0 ? GREEN_COLOR : RED_COLOR },
      { l: 'Rentabilidad real (%)',    v: fmtPct(rentabilidad),               c: rentabilidad >= 0 ? GREEN_COLOR : RED_COLOR },
      { l: 'Objetivo de margen (%)',   v: fmtPct(objMargen),                 c: MUTED_COLOR },
      { l: 'Desviación vs objetivo',  v: fmtPct(rentabilidad - objMargen),  c: rentabilidad >= objMargen ? GREEN_COLOR : RED_COLOR },
    ];

    const halfW = CW / 2 - 2;
    analisisRows.forEach((row, i) => {
      const isLeft = i % 2 === 0;
      const xP = isLeft ? ML : ML + CW / 2 + 2;
      if (isLeft) { checkPageBreak(10); rect(ML, y - 3, CW, 10, i % 4 < 2 ? WHITE : LIGHT_BG); }
      setFont('normal', 7.5); setColor(MUTED_COLOR); text(row.l, xP, y);
      setFont('bold', 9); setColor(row.c); text(row.v, xP + halfW, y, { align: 'right' });
      if (!isLeft || i === analisisRows.length - 1) y += 10;
    });
    y += 4;

    // Alertas
    const alertas = [];
    if (margen < 0) alertas.push({ tipo: 'CRÍTICO', msg: 'Margen negativo: costes superan el presupuesto.', color: RED_COLOR });
    if (rentabilidad < objMargen && rentabilidad >= 0) alertas.push({ tipo: 'AVISO', msg: `Rentabilidad por debajo del objetivo (${fmtPct(objMargen)}).`, color: ORANGE_COLOR });
    if (presupuesto === 0) alertas.push({ tipo: 'AVISO', msg: 'No hay presupuesto registrado.', color: ORANGE_COLOR });

    if (alertas.length > 0) {
      checkPageBreak(12 + alertas.length * 12);
      drawSectionTitle('⚠  ALERTAS');
      alertas.forEach(a => {
        checkPageBreak(12);
        rect(ML, y, CW, 10, [...a.color.map(c => Math.min(255, c + 190))], a.color);
        rect(ML, y, 3, 10, a.color);
        setFont('bold', 8); setColor(a.color); text(`[${a.tipo}]`, ML + 5, y + 6.5);
        setFont('normal', 8); setColor(DARK_COLOR); text(a.msg, ML + 24, y + 6.5);
        y += 12;
      });
      y += 2;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECCIÓN: MANO DE OBRA — JORNADAS Y HORAS
    // ═══════════════════════════════════════════════════════════════════════

    if (horasData && horasData.length > 0) {
      checkPageBreak(40);
      drawSectionTitle('4. RESUMEN DE MANO DE OBRA POR EMPLEADO');

      // Cabecera tabla empleados
      drawTableHeader([
        { label: 'EMPLEADO',       x: ML + 3 },
        { label: 'JORNADAS',       x: ML + CW * 0.38, align: 'right' },
        { label: 'H. NORMALES',    x: ML + CW * 0.52, align: 'right' },
        { label: 'H. EXTRA DIAR.', x: ML + CW * 0.65, align: 'right' },
        { label: 'H. EXTRA F/S',   x: ML + CW * 0.78, align: 'right' },
        { label: 'COSTE TOTAL',    x: ML + CW - 2,    align: 'right' },
      ]);

      let totalJornadas = 0, totalHNorm = 0, totalHExtraDiario = 0, totalHExtraFinde = 0, totalCoste = 0;

      horasData.forEach((h, i) => {
        checkPageBreak(9);
        const costeNormal      = (h.horas_normales || 0) * TARIFA_NORMAL;
        const costeExtraDiario = (h.horas_extra_diario || 0) * TARIFA_EXTRA_DIARIO;
        const costeExtraFinde  = (h.horas_extra_finde || 0) * TARIFA_EXTRA_FINDE;
        const costeTotalEmp    = costeNormal + costeExtraDiario + costeExtraFinde;

        totalJornadas      += h.jornadas || 0;
        totalHNorm         += h.horas_normales || 0;
        totalHExtraDiario  += h.horas_extra_diario || 0;
        totalHExtraFinde   += h.horas_extra_finde || 0;
        totalCoste         += costeTotalEmp;

        rect(ML, y, CW, 8, i % 2 === 0 ? WHITE : LIGHT_BG, BORDER_COLOR);
        setFont('normal', 8); setColor(DARK_COLOR); text(h.nombre || '—', ML + 3, y + 5.5);
        setFont('normal', 8); setColor(MUTED_COLOR);
        text(String(h.jornadas || 0), ML + CW * 0.38, y + 5.5, { align: 'right' });
        text(fmtH(h.horas_normales), ML + CW * 0.52, y + 5.5, { align: 'right' });
        text(fmtH(h.horas_extra_diario), ML + CW * 0.65, y + 5.5, { align: 'right' });
        text(fmtH(h.horas_extra_finde), ML + CW * 0.78, y + 5.5, { align: 'right' });
        setFont('bold', 8); setColor(ORANGE_COLOR);
        text(fmtEur(costeTotalEmp), ML + CW - 2, y + 5.5, { align: 'right' });
        y += 8;
      });

      // Fila totales
      checkPageBreak(10);
      rect(ML, y, CW, 9, [241, 245, 249], BORDER_COLOR);
      setFont('bold', 8.5); setColor(DARK_COLOR);
      text('TOTAL', ML + 3, y + 6);
      text(String(totalJornadas), ML + CW * 0.38, y + 6, { align: 'right' });
      text(fmtH(totalHNorm), ML + CW * 0.52, y + 6, { align: 'right' });
      text(fmtH(totalHExtraDiario), ML + CW * 0.65, y + 6, { align: 'right' });
      text(fmtH(totalHExtraFinde), ML + CW * 0.78, y + 6, { align: 'right' });
      setColor(ORANGE_COLOR);
      text(fmtEur(totalCoste), ML + CW - 2, y + 6, { align: 'right' });
      y += 13;

      // Leyenda tarifas
      checkPageBreak(20);
      rect(ML, y, CW, 16, BLUE_LIGHT, [191, 219, 254]);
      setFont('bold', 7.5); setColor(ORKALED_COLOR);
      text('TARIFAS APLICADAS:', ML + 3, y + 5);
      setFont('normal', 7.5); setColor(DARK_COLOR);
      text(`• Hora normal: ${fmtEur(TARIFA_NORMAL)}/h`, ML + 3, y + 11);
      text(`• Hora extra entre semana: ${fmtEur(TARIFA_EXTRA_DIARIO)}/h`, ML + CW * 0.35, y + 11);
      text(`• Hora extra fin de semana/festivo: ${fmtEur(TARIFA_EXTRA_FINDE)}/h`, ML + CW * 0.68, y + 11);
      y += 20;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECCIÓN: DETALLE DE FICHAJES POR DÍA
    // ═══════════════════════════════════════════════════════════════════════

    if (fichajes && fichajes.length > 0) {
      checkPageBreak(40);
      drawSectionTitle('5. DETALLE DE JORNADAS TRABAJADAS');

      drawTableHeader([
        { label: 'FECHA',         x: ML + 3 },
        { label: 'EMPLEADO',      x: ML + CW * 0.22 },
        { label: 'ENTRADA',       x: ML + CW * 0.52, align: 'right' },
        { label: 'SALIDA',        x: ML + CW * 0.63, align: 'right' },
        { label: 'H. NORM.',      x: ML + CW * 0.73, align: 'right' },
        { label: 'H. EXTRA',      x: ML + CW * 0.84, align: 'right' },
        { label: 'TIPO',          x: ML + CW - 2,    align: 'right' },
      ]);

      fichajes.slice(0, 200).forEach((f, i) => {
        checkPageBreak(8);
        const esFinde = f.es_fin_semana || f.es_festivo;
        rect(ML, y, CW, 7, esFinde ? [255, 251, 235] : i % 2 === 0 ? WHITE : LIGHT_BG, BORDER_COLOR);

        const entrada = f.hora_entrada ? format(new Date(f.hora_entrada), 'HH:mm') : '—';
        const salida  = f.hora_salida  ? format(new Date(f.hora_salida),  'HH:mm') : '—';
        const tipoLabel = f.es_festivo ? 'FESTIVO' : f.es_fin_semana ? 'F/S' : 'NORMAL';
        const tipoColor = f.es_festivo || f.es_fin_semana ? ORANGE_COLOR : GREEN_COLOR;

        setFont('normal', 7.5); setColor(MUTED_COLOR);
        text(fmtFecha(f.fecha), ML + 3, y + 5);
        setColor(DARK_COLOR);
        text(`${f.empleado_nombre || ''} ${f.empleado_apellidos || ''}`.trim().substring(0, 22), ML + CW * 0.22, y + 5);
        setColor(MUTED_COLOR);
        text(entrada, ML + CW * 0.52, y + 5, { align: 'right' });
        text(salida,  ML + CW * 0.63, y + 5, { align: 'right' });
        text(fmtH(f.horas_normales_dia),  ML + CW * 0.73, y + 5, { align: 'right' });
        text(fmtH((f.horas_extra_laborable_ui || 0) + (f.horas_festivo_ui || 0)), ML + CW * 0.84, y + 5, { align: 'right' });
        setFont('bold', 7); setColor(tipoColor);
        text(tipoLabel, ML + CW - 2, y + 5, { align: 'right' });
        y += 7;
      });

      if (fichajes.length > 200) {
        checkPageBreak(10);
        setFont('italic', 7.5); setColor(MUTED_COLOR);
        text(`(Mostrando 200 de ${fichajes.length} fichajes totales)`, ML, y + 5);
        y += 10;
      }
      y += 4;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECCIÓN: GASTOS DE MATERIALES
    // ═══════════════════════════════════════════════════════════════════════

    if (gastos && gastos.length > 0) {
      checkPageBreak(40);
      drawSectionTitle('6. DETALLE DE GASTOS DE MATERIALES');

      drawTableHeader([
        { label: 'CONCEPTO / PROVEEDOR', x: ML + 3 },
        { label: 'FECHA',                x: ML + CW * 0.62, align: 'right' },
        { label: 'IMPORTE',              x: ML + CW - 2,    align: 'right' },
      ]);

      let totalGastos = 0;
      gastos.forEach((g, i) => {
        checkPageBreak(8);
        rect(ML, y, CW, 7.5, i % 2 === 0 ? WHITE : LIGHT_BG, BORDER_COLOR);
        const concepto = doc.splitTextToSize(g.concepto || g.descripcion || 'Sin descripción', CW * 0.57);
        setFont('normal', 7.5); setColor(DARK_COLOR);
        text(concepto[0], ML + 3, y + 5);
        setColor(MUTED_COLOR);
        text(fmtFecha(g.fecha || g.created_at), ML + CW * 0.62, y + 5, { align: 'right' });
        setFont('bold', 8); setColor(DARK_COLOR);
        text(fmtEur(g.importe || g.total || 0), ML + CW - 2, y + 5, { align: 'right' });
        totalGastos += Number(g.importe || g.total || 0);
        y += 7.5;
      });

      // Total
      checkPageBreak(10);
      rect(ML, y, CW, 9, [241, 245, 249], BORDER_COLOR);
      setFont('bold', 9); setColor(DARK_COLOR);
      text('TOTAL GASTOS MATERIALES', ML + 3, y + 6);
      setColor(ORANGE_COLOR);
      text(fmtEur(totalGastos), ML + CW - 2, y + 6, { align: 'right' });
      y += 13;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECCIÓN: PRESUPUESTO — PARTIDAS COMPLETAS
    // ═══════════════════════════════════════════════════════════════════════

    if (partidas && partidas.length > 0) {
      checkPageBreak(40);
      drawSectionTitle('7. PRESUPUESTO — PARTIDAS DE OBRA');

      // Cabecera tabla
      drawTableHeader([
        { label: 'CÓD.',        x: ML + 2 },
        { label: 'DESCRIPCIÓN', x: ML + 16 },
        { label: 'UD.',         x: ML + CW * 0.60, align: 'right' },
        { label: 'CANT.',       x: ML + CW * 0.68, align: 'right' },
        { label: 'P. UNIT.',    x: ML + CW * 0.79, align: 'right' },
        { label: 'TOTAL',       x: ML + CW - 2,    align: 'right' },
      ]);

      let totalPresupuesto = 0;
      let totalBaseImponible = 0;
      const IVA_PCT = 21;

      partidas.forEach((p, i) => {
        const cantNum   = Number(p.cantidad_total || p.cantidad || 1);
        const precioNum = Number(p.precio_unitario || 0);
        const totalLinea = Number(p.total_partida || p.total || (cantNum * precioNum));
        totalPresupuesto  += totalLinea;
        totalBaseImponible += totalLinea;

        // Calcular altura necesaria para descripción
        const descLines = doc.splitTextToSize(p.descripcion || '—', CW * 0.44);
        const rowH = Math.max(8, descLines.length * 4.5 + 4);

        checkPageBreak(rowH + 2);
        rect(ML, y, CW, rowH, i % 2 === 0 ? WHITE : LIGHT_BG, BORDER_COLOR);

        // Código
        setFont('normal', 7); setColor(MUTED_COLOR);
        text(p.codigo || '—', ML + 2, y + 5.5);

        // Descripción (multilínea)
        setFont('normal', 7.5); setColor(DARK_COLOR);
        descLines.forEach((line, li) => {
          text(line, ML + 16, y + 5 + li * 4.5);
        });

        // Unidad
        setFont('normal', 7.5); setColor(MUTED_COLOR);
        text(p.unidad || '—', ML + CW * 0.60, y + 5.5, { align: 'right' });

        // Cantidad
        text(Number(cantNum).toFixed(2), ML + CW * 0.68, y + 5.5, { align: 'right' });

        // Precio unitario
        setColor(ORKALED_COLOR);
        text(fmtEur(precioNum), ML + CW * 0.79, y + 5.5, { align: 'right' });

        // Total línea
        setFont('bold', 8); setColor(DARK_COLOR);
        text(fmtEur(totalLinea), ML + CW - 2, y + 5.5, { align: 'right' });

        y += rowH;
      });

      // Totales con IVA
      const ivaImporte = totalBaseImponible * (IVA_PCT / 100);
      const totalConIva = totalBaseImponible + ivaImporte;

      const totalesRows = [
        { label: 'BASE IMPONIBLE',           value: fmtEur(totalBaseImponible), color: DARK_COLOR },
        { label: `IVA (${IVA_PCT}%)`,         value: fmtEur(ivaImporte),         color: ORANGE_COLOR },
        { label: 'TOTAL PRESUPUESTO (c/IVA)', value: fmtEur(totalConIva),        color: ORKALED_COLOR },
      ];

      totalesRows.forEach((row, i) => {
        checkPageBreak(10);
        const bgColor = i === totalesRows.length - 1 ? [239, 246, 255] : [241, 245, 249];
        rect(ML, y, CW, 9, bgColor, BORDER_COLOR);
        setFont(i === totalesRows.length - 1 ? 'bold' : 'normal', 8.5);
        setColor(row.color);
        text(row.label, ML + 3, y + 6);
        setFont('bold', i === totalesRows.length - 1 ? 10 : 8.5);
        text(row.value, ML + CW - 2, y + 6, { align: 'right' });
        y += 9;
      });
      y += 6;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PÁGINA FINAL — CONCLUSIÓN
    // ═══════════════════════════════════════════════════════════════════════

    checkPageBreak(50);
    drawSectionTitle('8. CONCLUSIÓN FINANCIERA');

    const conclusion = [
      { l: 'Presupuesto total',          v: fmtEur(presupuesto),    c: ORKALED_COLOR },
      { l: 'Coste materiales',           v: fmtEur(costeMat),       c: ORANGE_COLOR },
      { l: 'Coste mano de obra (real)',   v: fmtEur(costeMO),        c: ORANGE_COLOR },
      { l: 'Coste total',                v: fmtEur(costeTotal),     c: RED_COLOR },
      { l: 'Margen bruto',               v: fmtEur(margen),         c: margen >= 0 ? GREEN_COLOR : RED_COLOR },
      { l: 'Rentabilidad final',         v: fmtPct(rentabilidad),   c: rentabilidad >= 0 ? GREEN_COLOR : RED_COLOR },
    ];

    conclusion.forEach((row, i) => {
      checkPageBreak(11);
      rect(ML, y, CW, 10, i % 2 === 0 ? WHITE : LIGHT_BG, BORDER_COLOR);
      setFont('normal', 8.5); setColor(MUTED_COLOR);
      text(row.l, ML + 3, y + 7);
      setFont('bold', 10); setColor(row.c);
      text(row.v, ML + CW - 3, y + 7, { align: 'right' });
      y += 10;
    });

    y += 6;

    // Veredicto final
    checkPageBreak(20);
    const veredictoColor = margen >= 0 ? GREEN_COLOR : RED_COLOR;
    const veredictoText  = margen >= 0
      ? `Obra rentable con un margen de ${fmtEur(margen)} (${fmtPct(rentabilidad)})`
      : `Obra con pérdidas de ${fmtEur(Math.abs(margen))} (${fmtPct(rentabilidad)})`;
    rect(ML, y, CW, 14, [...veredictoColor.map(c => Math.min(255, c + 200))], veredictoColor);
    rect(ML, y, 4, 14, veredictoColor);
    setFont('bold', 10); setColor(veredictoColor);
    text(veredictoText, ML + CW / 2 + 2, y + 9, { align: 'center' });
    y += 18;

    drawFooter();

    // Descarga
    const nombre = `Informe_${(info?.nombre_proyecto || 'Obra').replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
    doc.save(nombre);

  }, []);

  return { generarPDF };
}
