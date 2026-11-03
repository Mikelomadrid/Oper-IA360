import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const money = (value) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0);
const date = (value) => value ? new Intl.DateTimeFormat('es-ES').format(new Date(value)) : '—';
const reportOptions = [
  ['resultados', 'Pérdidas y ganancias'],
  ['balance', 'Balance provisional'],
  ['mayor', 'Mayor por cuenta'],
  ['iva', 'IVA provisional'],
  ['terceros', 'Clientes y proveedores'],
  ['tesoreria', 'Tesorería'],
  ['rentabilidad', 'Rentabilidad por obra'],
];

function styleWorksheet(sheet, columns, rows) {
  const endColumn = XLSX.utils.encode_col(columns.length - 1);
  const endRow = rows.length + 1;
  sheet['!cols'] = columns.map((column, index) => ({ wch: Math.min(38, Math.max(column.length + 2, ...rows.map((row) => String(row[index] ?? '').length + 2))) }));
  sheet['!autofilter'] = { ref: `A1:${endColumn}${endRow}` };
  columns.forEach((_, index) => {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: index })];
    if (cell) cell.s = { fill: { fgColor: { rgb: '6D28D9' } }, font: { bold: true, color: { rgb: 'FFFFFF' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: { bottom: { style: 'thin', color: { rgb: '4C1D95' } } } };
  });
  sheet['!rows'] = [{ hpt: 24 }];
  for (let row = 1; row <= rows.length; row += 1) {
    for (let column = 0; column < columns.length; column += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell) {
        cell.s = { fill: row % 2 === 0 ? { fgColor: { rgb: 'F5F3FF' } } : { fgColor: { rgb: 'FFFFFF' } }, border: { bottom: { style: 'hair', color: { rgb: 'D9DCE5' } } } };
        if (typeof cell.v === 'number') cell.z = '#,##0.00 [$€-es-ES]';
      }
    }
  }
}

export default function InformesContables({ data }) {
  const [reportType, setReportType] = useState('resultados');
  const [accountId, setAccountId] = useState('');
  const accounts = useMemo(() => new Map((data.accounts || []).map((account) => [account.id, account])), [data.accounts]);
  const seats = useMemo(() => new Map((data.seats || []).map((seat) => [seat.id, seat])), [data.seats]);
  const rows = useMemo(() => {
    const totals = new Map();
    (data.lines || []).forEach((line) => {
      const account = accounts.get(line.cuenta_id);
      const row = totals.get(line.cuenta_id) || { cuenta_id: line.cuenta_id, cuenta: account, debe: 0, haber: 0 };
      row.debe += Number(line.debe || 0);
      row.haber += Number(line.haber || 0);
      totals.set(line.cuenta_id, row);
    });
    return [...totals.values()].sort((a, b) => String(a.cuenta?.codigo || '').localeCompare(String(b.cuenta?.codigo || '')));
  }, [accounts, data.lines]);
  const resultRows = rows.filter((row) => /^[67]/.test(String(row.cuenta?.codigo || '')));
  const balanceRows = rows.filter((row) => /^[1-5]/.test(String(row.cuenta?.codigo || '')));
  const selectedAccountId = accountId || data.accounts?.[0]?.id || '';
  const mayorRows = (data.lines || []).filter((line) => line.cuenta_id === selectedAccountId).map((line) => ({ ...line, asiento: seats.get(line.asiento_id) }));
  const ivaRows = rows.filter((row) => /^(472|477)/.test(String(row.cuenta?.codigo || '')));
  const tercerosRows = rows.filter((row) => /^(400|430)/.test(String(row.cuenta?.codigo || '')));
  const treasuryRows = (data.movements || []).map((movement) => [date(movement.fecha), movement.concepto || '—', money(movement.importe), movement.estado || '—', movement.referencia || '—']);
  const projectRows = (data.projects || []).map((project) => [project.nombre_proyecto || project.nombre || project.proyecto_nombre || project.proyecto_id, money(project.presupuesto_aceptado), money(project.coste_total_materiales), money(project.coste_mano_obra), money(Number(project.presupuesto_aceptado || 0) - Number(project.coste_total_materiales || 0) - Number(project.coste_mano_obra || 0))]);
  const ingresos = resultRows.filter((row) => String(row.cuenta?.codigo || '').startsWith('7')).reduce((sum, row) => sum + row.haber - row.debe, 0);
  const gastos = resultRows.filter((row) => String(row.cuenta?.codigo || '').startsWith('6')).reduce((sum, row) => sum + row.debe - row.haber, 0);
  const columns = reportType === 'resultados'
    ? ['Código', 'Cuenta', 'Tipo', 'Importe']
    : reportType === 'balance'
      ? ['Código', 'Cuenta', 'Debe', 'Haber', 'Saldo']
      : reportType === 'mayor'
        ? ['Fecha', 'Asiento', 'Concepto', 'Debe', 'Haber', 'Saldo']
        : reportType === 'iva'
          ? ['Código', 'Cuenta', 'IVA']
          : reportType === 'terceros'
            ? ['Código', 'Tercero', 'Debe', 'Haber', 'Saldo']
            : reportType === 'tesoreria'
              ? ['Fecha', 'Concepto', 'Importe', 'Estado', 'Referencia']
              : ['Obra', 'Presupuesto', 'Materiales', 'Mano de obra', 'Margen'];
  const tableRows = reportType === 'resultados'
    ? resultRows.map((row) => [row.cuenta?.codigo || '—', row.cuenta?.nombre || row.cuenta_id, String(row.cuenta?.codigo || '').startsWith('6') ? 'Gasto' : 'Ingreso', money(String(row.cuenta?.codigo || '').startsWith('6') ? row.debe - row.haber : row.haber - row.debe)])
    : reportType === 'balance'
      ? balanceRows.map((row) => [row.cuenta?.codigo || '—', row.cuenta?.nombre || row.cuenta_id, money(row.debe), money(row.haber), money(row.debe - row.haber)])
      : reportType === 'mayor'
        ? mayorRows.map((row) => [date(row.asiento?.fecha_contable), row.asiento?.numero || '—', row.asiento?.concepto || '—', money(row.debe), money(row.haber), money(Number(row.debe || 0) - Number(row.haber || 0))])
        : reportType === 'iva'
          ? ivaRows.map((row) => [row.cuenta?.codigo || '—', row.cuenta?.nombre || row.cuenta_id, money(row.haber - row.debe)])
          : reportType === 'terceros'
            ? tercerosRows.map((row) => [row.cuenta?.codigo || '—', row.cuenta?.nombre || row.cuenta_id, money(row.debe), money(row.haber), money(row.debe - row.haber)])
            : reportType === 'tesoreria' ? treasuryRows : projectRows;
  const exportExcel = () => {
    const sheet = XLSX.utils.aoa_to_sheet([columns, ...tableRows]);
    styleWorksheet(sheet, columns, tableRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Informe');
    XLSX.writeFile(workbook, `Informe_${reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFontSize(16);
    doc.text(reportOptions.find(([id]) => id === reportType)?.[1] || 'Informe contable', 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(`Informe provisional · ${new Date().toLocaleDateString('es-ES')}`, 14, 21);
    doc.setTextColor(0);
    autoTable(doc, { startY: 28, head: [columns], body: tableRows, styles: { fontSize: 8 } });
    doc.save(`Informe_${reportType}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };
  return <div className="space-y-6"><div className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between"><div><h2 className="text-2xl font-semibold tracking-tight">Informes contables</h2><p className="mt-1 text-sm text-muted-foreground">Solo se utilizan asientos confirmados.</p></div><div className="flex flex-wrap gap-2"><select value={reportType} onChange={(event) => setReportType(event.target.value)} className="rounded-lg border bg-background px-3 py-2 text-sm">{reportOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>{reportType === 'mayor' && <select value={selectedAccountId} onChange={(event) => setAccountId(event.target.value)} className="rounded-lg border bg-background px-3 py-2 text-sm">{(data.accounts || []).map((account) => <option key={account.id} value={account.id}>{account.codigo} · {account.nombre}</option>)}</select>}<button type="button" onClick={exportExcel} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">Exportar Excel</button><button type="button" onClick={exportPdf} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">Exportar PDF</button></div></div>{reportType === 'resultados' && <div className="grid gap-4 md:grid-cols-3"><Metric title="Ingresos" value={money(ingresos)} /><Metric title="Gastos" value={money(gastos)} /><Metric title="Resultado" value={money(ingresos - gastos)} /></div>}<SimpleTable columns={columns} rows={tableRows} empty={reportType === 'rentabilidad' ? 'No hay obras accesibles para este informe.' : 'No hay movimientos confirmados para este informe.'} /></div>;
}

function Metric({ title, value }) { return <div className="rounded-lg border bg-muted/20 p-4"><span className="text-sm text-muted-foreground">{title}</span><p className="mt-2 text-2xl font-semibold">{value}</p></div>; }
function SimpleTable({ columns, rows, empty }) { if (!rows.length) return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{empty}</div>; return <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[680px] text-sm"><thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr>{columns.map((column) => <th key={column} className="px-4 py-3 font-medium">{column}</th>)}</tr></thead><tbody className="divide-y">{rows.map((row, index) => <tr key={index} className="hover:bg-muted/30">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3">{cell}</td>)}</tr>)}</tbody></table></div>; }
