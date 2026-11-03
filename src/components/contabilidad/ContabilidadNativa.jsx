import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ArrowDownToLine, BarChart3, BookOpen, Building2, Calculator, ChevronRight,
  FileCheck2, Landmark, ListChecks, Loader2, RefreshCw, Scale, Settings2,
  WalletCards, Receipt,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import InformesContables from './InformesContables';

const tabs = [
  { id: 'resumen', label: 'Resumen', icon: BarChart3 },
  { id: 'facturas-emitidas', label: 'Facturas emitidas', icon: Receipt },
  { id: 'plan-cuentas', label: 'Plan de cuentas', icon: BookOpen },
  { id: 'subcuentas', label: 'Subcuentas', icon: ListChecks },
  { id: 'reglas', label: 'Reglas de imputación', icon: Settings2 },
  { id: 'asientos', label: 'Asientos contables', icon: FileCheck2 },
  { id: 'diario', label: 'Libro diario', icon: BookOpen },
  { id: 'sumas-saldos', label: 'Sumas y saldos', icon: Scale },
  { id: 'informes', label: 'Informes', icon: BarChart3 },
  { id: 'tesoreria', label: 'Tesorería y conciliación', icon: Landmark },
  { id: 'cierres', label: 'Cierres e impuestos', icon: Calculator },
];

const money = (value) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0);
const date = (value) => value ? new Intl.DateTimeFormat('es-ES').format(new Date(value)) : '—';

function SectionTitle({ title, subtitle, onRefresh, loading }) {
  return (
    <div className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <button type="button" onClick={onRefresh} disabled={loading} className="inline-flex items-center gap-2 self-start rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
        <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Actualizar
      </button>
    </div>
  );
}

function Empty({ text }) {
  return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{text}</div>;
}

function DataTable({ columns, rows, rowKey }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) return <Empty text="No hay datos para mostrar." />;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[680px] text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>{columns.map((column) => <th key={column.key} className="px-4 py-3 font-medium">{column.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y">
          {safeRows.map((row, index) => (
            <tr key={rowKey ? rowKey(row) : row.id || index} className="hover:bg-muted/30">
              {columns.map((column) => <td key={column.key} className="px-4 py-3 align-top">{column.render ? column.render(row) : row[column.key] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ContabilidadNativa({ navigate }) {
  const location = useLocation();
  const requested = new URLSearchParams(location.search).get('subtab');
  const [active, setActive] = useState(tabs.some((tab) => tab.id === requested) ? requested : 'resumen');
  const [year] = useState(new Date().getFullYear());
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [action, setAction] = useState({ id: null, error: null, success: null });
  const [collection, setCollection] = useState(null);
  const [invoiceModal, setInvoiceModal] = useState(null);
  const [reportType, setReportType] = useState('resultados');
  const [reportAccountId, setReportAccountId] = useState('');

  useEffect(() => {
    if (tabs.some((tab) => tab.id === requested)) setActive(requested);
  }, [requested]);

  const load = useCallback(async () => {
    setState({ loading: true, error: null, data: null });
    try {
      const result = await loadTab(active, year);
      setState({ loading: false, error: null, data: result });
    } catch (error) {
      setState({ loading: false, error: error.message || 'No se pudo cargar la sección.', data: null });
    }
  }, [active, year]);

  useEffect(() => { load(); }, [load]);

  const choose = (id) => {
    setActive(id);
    if (navigate) navigate(`/contabilidad?subtab=${id}`);
  };
  const prepareInvoice = async (invoiceId) => {
    setAction({ id: invoiceId, error: null, success: null });
    const { error } = await supabase.rpc('contabilidad_preparar_asiento_factura_emitida', { p_factura_id: invoiceId });
    if (error) {
      setAction({ id: null, error: error.message || 'No se pudo preparar el asiento.', success: null });
      return;
    }
    setAction({ id: null, error: null, success: 'Asiento preparado y pendiente de confirmación.' });
    await load();
  };
  const confirmSeat = async (seatId) => {
    setAction({ id: seatId, error: null, success: null });
    const { error } = await supabase.rpc('contabilidad_confirmar_asiento', { p_asiento_id: seatId });
    if (error) {
      setAction({ id: null, error: error.message || 'No se pudo confirmar el asiento.', success: null });
      return;
    }
    setAction({ id: null, error: null, success: 'Asiento confirmado correctamente.' });
    await load();
  };
  const openCollection = async (invoice) => {
    setAction({ id: invoice.id, error: null, success: null });
    const { data: accounts, error } = await supabase.rpc('contabilidad_listar_cuentas_bancarias_activas');
    if (error) {
      setAction({ id: null, error: error.message || 'No se pudieron cargar las cuentas bancarias.', success: null });
      return;
    }
    setAction({ id: null, error: null, success: null });
    setCollection({ invoice, accounts: accounts || [] });
  };
  const openInvoiceModal = async () => {
    setAction({ id: 'new-invoice', error: null, success: null });
    const { data: clients, error } = await supabase.from('clientes').select('id,nombre').order('nombre').limit(500);
    if (error) {
      setAction({ id: null, error: error.message || 'No se pudieron cargar los clientes.', success: null });
      return;
    }
    setAction({ id: null, error: null, success: null });
    setInvoiceModal({ clients: clients || [] });
  };
  const createInvoice = async (values) => {
    const base = Number(values.base);
    const iva = Math.round(base * Number(values.ivaPorcentaje) / 100 * 100) / 100;
    setAction({ id: 'new-invoice', error: null, success: null });
    const { error } = await supabase.rpc('contabilidad_crear_factura_emitida', {
      p_cliente_id: values.cliente,
      p_numero_factura: values.numero,
      p_fecha_emision: values.emision,
      p_fecha_vencimiento: values.vencimiento,
      p_base_imponible: base,
      p_iva_importe: iva,
      p_iva_porcentaje: Number(values.ivaPorcentaje),
    });
    if (error) {
      setAction({ id: null, error: error.message || 'No se pudo crear la factura.', success: null });
      return;
    }
    setInvoiceModal(null);
    setAction({ id: null, error: null, success: 'Factura emitida creada correctamente.' });
    await load();
  };
  const registerCollection = async (values) => {
    setAction({ id: collection.invoice.id, error: null, success: null });
    const { error } = await supabase.rpc('contabilidad_registrar_cobro_factura_emitida', {
      p_factura_emitida_id: collection.invoice.id,
      p_fecha_cobro: values.fecha,
      p_importe: Number(values.importe),
      p_medio_pago: values.medio,
      p_cuenta_bancaria_id: values.cuenta || null,
      p_referencia: values.referencia || null,
      p_notas: values.notas || null,
    });
    if (error) {
      setAction({ id: null, error: error.message || 'No se pudo registrar el cobro.', success: null });
      return;
    }
    setCollection(null);
    setAction({ id: null, error: null, success: 'Cobro registrado correctamente.' });
    await load();
  };
  const changePeriodStatus = async (period, nextStatus) => {
    setAction({ id: period.id, error: null, success: null });
    const payload = nextStatus === 'cerrado'
      ? { estado: 'cerrado', cerrado_at: new Date().toISOString() }
      : { estado: 'abierto', cerrado_at: null };
    const { error } = await supabase.from('contabilidad_periodos').update(payload).eq('id', period.id);
    if (error) {
      setAction({ id: null, error: error.message || 'No se pudo actualizar el periodo.', success: null });
      return;
    }
    setAction({ id: null, error: null, success: nextStatus === 'cerrado' ? 'Periodo cerrado correctamente.' : 'Periodo reabierto correctamente.' });
    await load();
  };
  const current = tabs.find((tab) => tab.id === active) || tabs[0];
  const Icon = current.icon;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Área contable</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Circuito financiero</h1>
        <p className="mt-1 text-sm text-muted-foreground">Contabilidad propia de NEWERP: facturas, asientos, tesorería y cierres.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
        <aside className="h-fit rounded-xl border bg-card p-2">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const selected = tab.id === active;
            return (
              <button key={tab.id} type="button" onClick={() => choose(tab.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${selected ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                <TabIcon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{tab.label}</span>
                {selected && <ChevronRight className="h-4 w-4" />}
              </button>
            );
          })}
        </aside>

        <main className="min-w-0 rounded-xl border bg-card p-5 md:p-6">
          <div className="mb-6 flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div><span className="text-sm font-medium text-muted-foreground">Ejercicio {year}</span></div>
          {state.loading && <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Cargando datos contables…</div>}
          {!state.loading && state.error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p className="font-medium">No se pudo cargar esta sección</p><p className="mt-1">{state.error}</p></div>}
          {action.error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{action.error}</div>}
          {action.success && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{action.success}</div>}
          {!state.loading && !state.error && state.data && <NativeContent tab={active} data={state.data} onRefresh={load} onPrepareInvoice={prepareInvoice} onConfirmSeat={confirmSeat} onOpenCollection={openCollection} onOpenInvoice={openInvoiceModal} onChangePeriodStatus={changePeriodStatus} actionId={action.id} reportType={reportType} onReportTypeChange={setReportType} reportAccountId={reportAccountId} onReportAccountChange={setReportAccountId} />}
          {collection && <CollectionModal collection={collection} onClose={() => setCollection(null)} onSubmit={registerCollection} />}
          {invoiceModal && <InvoiceModal clients={invoiceModal.clients} onClose={() => setInvoiceModal(null)} onSubmit={createInvoice} />}
        </main>
      </div>
    </div>
  );
}

async function loadTab(tab, year) {
  if (tab === 'plan-cuentas') return query('contabilidad_plan_cuentas', '*', 'codigo');
  if (tab === 'facturas-emitidas') {
    const { data, error } = await supabase.rpc('contabilidad_listar_facturas_emitidas');
    if (error) throw error;
    return data || [];
  }
  if (tab === 'subcuentas') return query('contabilidad_terceros_cuentas', '*', 'tercero_tipo');
  if (tab === 'reglas') {
    const [rules, accounts] = await Promise.all([
      query('contabilidad_reglas_imputacion', '*', 'created_at'),
      query('contabilidad_plan_cuentas', 'id,codigo,nombre', 'codigo'),
    ]);
    return { rules, accounts };
  }
  if (tab === 'asientos' || tab === 'diario') return query('contabilidad_asientos', '*', 'fecha_contable', false, 200);
  if (tab === 'sumas-saldos') {
    const [seats, lines, accounts] = await Promise.all([
      query('contabilidad_asientos', '*', 'fecha_contable', false, 500),
      query('contabilidad_asiento_lineas', '*', 'asiento_id', true, 2000),
      query('contabilidad_plan_cuentas', '*', 'codigo'),
    ]);
    const confirmed = new Set(seats.filter((seat) => seat.estado === 'confirmado').map((seat) => seat.id));
    return { lines: lines.filter((line) => confirmed.has(line.asiento_id)), accounts, seats: seats.filter((seat) => confirmed.has(seat.id)) };
  }
  if (tab === 'informes') {
    const [seats, lines, accounts, movements, projects] = await Promise.all([
      query('contabilidad_asientos', '*', 'fecha_contable', false, 500),
      query('contabilidad_asiento_lineas', '*', 'asiento_id', true, 2000),
      query('contabilidad_plan_cuentas', '*', 'codigo'),
      query('contabilidad_movimientos_bancarios', '*', 'fecha', false, 500),
      query('proyectos', 'id,nombre_proyecto,presupuesto_aceptado', 'nombre_proyecto', true, 500),
    ]);
    const projectIds = projects.map((project) => project.id).filter(Boolean);
    const [materialRows, laborRows] = projectIds.length ? await Promise.all([
      supabase.from('v_obra_materiales_balance').select('obra_id,coste_neto').in('obra_id', projectIds),
      supabase.from('ui_v_proyecto_mano_obra_totales_v2').select('proyecto_id,coste_total_mano_obra').in('proyecto_id', projectIds),
    ]) : [{ data: [], error: null }, { data: [], error: null }];
    const materialTotals = (materialRows.data || []).reduce((totals, row) => ({ ...totals, [row.obra_id]: Number(totals[row.obra_id] || 0) + Number(row.coste_neto || 0) }), {});
    const laborTotals = (laborRows.data || []).reduce((totals, row) => ({ ...totals, [row.proyecto_id]: Number(row.coste_total_mano_obra || 0) }), {});
    const projectsWithCosts = projects.map((project) => ({ ...project, coste_total_materiales: materialTotals[project.id] || 0, coste_mano_obra: laborTotals[project.id] || 0 }));
    const confirmed = new Set(seats.filter((seat) => seat.estado === 'confirmado').map((seat) => seat.id));
    return { lines: lines.filter((line) => confirmed.has(line.asiento_id)), accounts, seats: seats.filter((seat) => confirmed.has(seat.id)), movements, projects: projectsWithCosts };
  }
  if (tab === 'tesoreria') {
    const [accounts, movements] = await Promise.all([query('contabilidad_cuentas_bancarias', '*', 'nombre'), query('contabilidad_movimientos_bancarios', '*', 'fecha', false, 200)]);
    return { accounts, movements };
  }
  if (tab === 'cierres') {
    const [periods, seats, lines, accounts] = await Promise.all([
      query('contabilidad_periodos', '*', 'ejercicio'),
      query('contabilidad_asientos', '*', 'fecha_contable', false, 1000),
      query('contabilidad_asiento_lineas', '*', 'asiento_id', true, 5000),
      query('contabilidad_plan_cuentas', 'id,codigo,nombre', 'codigo'),
    ]);
    const confirmedIds = new Set(seats.filter((seat) => seat.estado === 'confirmado').map((seat) => seat.id));
    return { periods, seats: seats.filter((seat) => confirmedIds.has(seat.id)), lines: lines.filter((line) => confirmedIds.has(line.asiento_id)), accounts };
  }
  if (tab === 'resumen') {
    const [seats, periods] = await Promise.all([query('contabilidad_asientos', '*', 'fecha_contable', false, 500), query('contabilidad_periodos', '*', 'mes')]);
    const yearSeats = seats.filter((seat) => Number(String(seat.fecha_contable || '').slice(0, 4)) === Number(year));
    return { seats: yearSeats, periods };
  }
  return [];
}

async function query(table, select, order, ascending = true, limit = 500) {
  let request = supabase.from(table).select(select);
  if (order) request = request.order(order, { ascending });
  const { data, error } = await request.limit(limit);
  if (error) throw error;
  return data || [];
}

function NativeContent({ tab, data, onRefresh, onPrepareInvoice, onConfirmSeat, onOpenCollection, onOpenInvoice, onChangePeriodStatus, actionId, reportType, onReportTypeChange, reportAccountId, onReportAccountChange }) {
  if (tab === 'resumen') {
    const seats = data.seats || [];
    const debit = seats.reduce((sum, row) => sum + Number(row.total_debe || 0), 0);
    const credit = seats.reduce((sum, row) => sum + Number(row.total_haber || 0), 0);
    return <div className="space-y-6"><SectionTitle title="Resumen contable" subtitle="Visión general de los asientos y periodos del ejercicio." /><div className="grid gap-4 md:grid-cols-3"><Metric title="Asientos" value={seats.length} icon={FileCheck2} /><Metric title="Total debe" value={money(debit)} icon={ArrowDownToLine} /><Metric title="Total haber" value={money(credit)} icon={WalletCards} /></div><div><h3 className="mb-3 font-semibold">Periodos contables</h3><DataTable columns={[{ key: 'mes', label: 'Mes' }, { key: 'estado', label: 'Estado' }, { key: 'observaciones', label: 'Observaciones' }]} rows={data.periods || []} /></div></div>;
  }
  if (tab === 'plan-cuentas') return <><SectionTitle title="Plan de cuentas" subtitle="Catálogo contable nativo de NEWERP." /><DataTable columns={[{ key: 'codigo', label: 'Código' }, { key: 'nombre', label: 'Cuenta' }, { key: 'tipo', label: 'Tipo' }, { key: 'naturaleza', label: 'Naturaleza' }, { key: 'permite_movimientos', label: 'Movimientos', render: (r) => r.permite_movimientos ? 'Sí' : 'No' }, { key: 'activa', label: 'Estado', render: (r) => r.activa ? 'Activa' : 'Inactiva' }]} rows={data} /></>;
  if (tab === 'facturas-emitidas') return <><SectionTitle title="Facturas emitidas" subtitle="Facturación de clientes, cobros y estado contable nativo." onRefresh={onRefresh} loading={Boolean(actionId)} /><div className="mb-4 flex justify-end"><button type="button" onClick={onOpenInvoice} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Nueva factura</button></div><DataTable columns={[{ key: 'numero_factura', label: 'Factura' }, { key: 'cliente_nombre', label: 'Cliente' }, { key: 'fecha_emision', label: 'Emisión', render: (r) => date(r.fecha_emision) }, { key: 'fecha_vencimiento', label: 'Vencimiento', render: (r) => date(r.fecha_vencimiento) }, { key: 'monto_total', label: 'Total', render: (r) => money(r.monto_total) }, { key: 'estado', label: 'Estado' }, { key: 'contabilidad_nativa_estado', label: 'Contabilidad', render: (r) => r.contabilidad_nativa_estado === 'confirmado' ? 'Confirmado' : r.contabilidad_nativa_asiento_id ? 'Pendiente de confirmación' : 'Sin preparar' }, { key: 'acciones', label: 'Acciones', render: (r) => <div className="flex flex-wrap gap-2">{!['cobrada', 'pagada'].includes(r.estado) && <button type="button" onClick={() => onOpenCollection(r)} className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">Registrar cobro</button>}{r.contabilidad_nativa_estado === 'confirmado' ? 'Confirmado' : r.contabilidad_nativa_asiento_id ? 'Revisar en Asientos' : <button type="button" onClick={() => onPrepareInvoice(r.id)} disabled={actionId === r.id} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{actionId === r.id ? 'Preparando…' : 'Preparar asiento'}</button>}</div> }]} rows={data} /></>;
  if (tab === 'subcuentas') return <><SectionTitle title="Subcuentas" subtitle="Relación contable de clientes y proveedores." /><DataTable columns={[{ key: 'tercero_tipo', label: 'Tipo' }, { key: 'proveedor_id', label: 'Proveedor' }, { key: 'cliente_id', label: 'Cliente' }, { key: 'cuenta_id', label: 'Cuenta' }, { key: 'activa', label: 'Estado', render: (r) => r.activa ? 'Activa' : 'Inactiva' }]} rows={data} /></>;
  if (tab === 'reglas') {
    const accounts = new Map((data.accounts || []).map((account) => [account.id, account]));
    return <><SectionTitle title="Reglas de imputación" subtitle="Reglas para asignar cuentas a los movimientos del ERP." /><DataTable columns={[{ key: 'nombre', label: 'Regla' }, { key: 'tipo_documento', label: 'Documento' }, { key: 'cuenta_id', label: 'Cuenta', render: (r) => { const account = accounts.get(r.cuenta_id); return account ? `${account.codigo} · ${account.nombre}` : '—'; } }, { key: 'activa', label: 'Estado', render: (r) => r.activa ? 'Activa' : 'Inactiva' }]} rows={data.rules || []} /></>;
  }
  if (tab === 'asientos' || tab === 'diario') {
    const seats = Array.isArray(data) ? data : [];
    return <><SectionTitle title={tab === 'diario' ? 'Libro diario' : 'Asientos contables'} subtitle={tab === 'diario' ? 'Asientos confirmados del circuito contable nativo.' : 'Revisión de asientos preparados y confirmados.'} /><DataTable columns={[{ key: 'numero', label: 'Nº' }, { key: 'fecha_contable', label: 'Fecha', render: (r) => date(r.fecha_contable) }, { key: 'concepto', label: 'Concepto' }, { key: 'origen', label: 'Origen' }, { key: 'total_debe', label: 'Debe', render: (r) => money(r.total_debe) }, { key: 'total_haber', label: 'Haber', render: (r) => money(r.total_haber) }, { key: 'estado', label: 'Estado' }, { key: 'acciones', label: 'Acciones', render: (r) => tab === 'asientos' && r.estado === 'pendiente_revision' ? <button type="button" onClick={() => onConfirmSeat(r.id)} disabled={actionId === r.id} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{actionId === r.id ? 'Confirmando…' : 'Confirmar'}</button> : r.estado === 'confirmado' ? 'Confirmado' : '—' }]} rows={seats.filter((row) => tab !== 'diario' || row.estado === 'confirmado')} /></>;
  }
  if (tab === 'sumas-saldos') {
    const accounts = new Map((data.accounts || []).map((account) => [account.id, account]));
    const totals = (data.lines || []).reduce((result, line) => {
      const current = result.get(line.cuenta_id) || { cuenta_id: line.cuenta_id, debe: 0, haber: 0 };
      current.debe += Number(line.debe || 0);
      current.haber += Number(line.haber || 0);
      result.set(line.cuenta_id, current);
      return result;
    }, new Map());
    const rows = [...totals.values()].map((row) => ({ ...row, cuenta: accounts.get(row.cuenta_id) })).sort((a, b) => (a.cuenta?.codigo || '').localeCompare(b.cuenta?.codigo || ''));
    return <><SectionTitle title="Sumas y saldos" subtitle="Movimientos confirmados agrupados por cuenta." /><DataTable columns={[{ key: 'codigo', label: 'Código', render: (r) => r.cuenta?.codigo || '—' }, { key: 'nombre', label: 'Cuenta', render: (r) => r.cuenta?.nombre || r.cuenta_id }, { key: 'debe', label: 'Debe', render: (r) => money(r.debe) }, { key: 'haber', label: 'Haber', render: (r) => money(r.haber) }, { key: 'saldo', label: 'Saldo', render: (r) => money(r.debe - r.haber) }]} rows={rows} rowKey={(row) => row.cuenta_id} /></>;
  }
  if (tab === 'informes') {
    return <InformesContables data={data} />;
  }
  if (tab === 'informes-antiguo') {
    const accounts = new Map((data.accounts || []).map((account) => [account.id, account]));
    const totals = (data.lines || []).reduce((result, line) => {
      const account = accounts.get(line.cuenta_id);
      const codigo = String(account?.codigo || '');
      const current = result.get(line.cuenta_id) || { cuenta_id: line.cuenta_id, cuenta: account, debe: 0, haber: 0 };
      current.debe += Number(line.debe || 0);
      current.haber += Number(line.haber || 0);
      result.set(line.cuenta_id, current);
      return result;
    }, new Map());
    const allRows = [...totals.values()].sort((a, b) => String(a.cuenta?.codigo || '').localeCompare(String(b.cuenta?.codigo || '')));
    const rows = allRows.filter((row) => /^[67]/.test(String(row.cuenta?.codigo || '')));
    const balanceRows = allRows.filter((row) => /^[1-5]/.test(String(row.cuenta?.codigo || '')));
    const gastos = rows.filter((row) => String(row.cuenta?.codigo || '').startsWith('6')).reduce((sum, row) => sum + row.debe - row.haber, 0);
    const ingresos = rows.filter((row) => String(row.cuenta?.codigo || '').startsWith('7')).reduce((sum, row) => sum + row.haber - row.debe, 0);
    const exportExcel = () => {
      const resultRows = rows.map((row) => ({ Código: row.cuenta?.codigo || '', Cuenta: row.cuenta?.nombre || row.cuenta_id, Tipo: String(row.cuenta?.codigo || '').startsWith('6') ? 'Gasto' : 'Ingreso', Importe: Number(String(row.cuenta?.codigo || '').startsWith('6') ? row.debe - row.haber : row.haber - row.debe) }));
      const balanceExportRows = balanceRows.map((row) => ({ Código: row.cuenta?.codigo || '', Cuenta: row.cuenta?.nombre || row.cuenta_id, Debe: Number(row.debe), Haber: Number(row.haber), Saldo: Number(row.debe - row.haber) }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(resultRows), 'Resultados');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(balanceExportRows), 'Balance');
      XLSX.writeFile(workbook, `Informes_contables_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };
    return <div className="space-y-6"><div className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between"><div><h2 className="text-2xl font-semibold tracking-tight">Informes contables</h2><p className="mt-1 text-sm text-muted-foreground">Informes provisionales calculados solo con asientos confirmados.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={exportExcel} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">Exportar Excel</button><button type="button" onClick={() => window.print()} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">Imprimir / PDF</button></div></div><div className="grid gap-4 md:grid-cols-3"><Metric title="Ingresos" value={money(ingresos)} icon={ArrowDownToLine} /><Metric title="Gastos" value={money(gastos)} icon={WalletCards} /><Metric title="Resultado" value={money(ingresos - gastos)} icon={BarChart3} /></div><div><h3 className="mb-3 text-lg font-semibold">Cuenta de resultados provisional</h3><DataTable columns={[{ key: 'codigo', label: 'Código', render: (r) => r.cuenta?.codigo || '—' }, { key: 'nombre', label: 'Cuenta', render: (r) => r.cuenta?.nombre || r.cuenta_id }, { key: 'tipo', label: 'Tipo', render: (r) => String(r.cuenta?.codigo || '').startsWith('6') ? 'Gasto' : 'Ingreso' }, { key: 'importe', label: 'Importe', render: (r) => money(String(r.cuenta?.codigo || '').startsWith('6') ? r.debe - r.haber : r.haber - r.debe) }]} rows={rows} rowKey={(row) => row.cuenta_id} /></div><div><h3 className="mb-3 text-lg font-semibold">Balance provisional</h3><DataTable columns={[{ key: 'codigo', label: 'Código', render: (r) => r.cuenta?.codigo || '—' }, { key: 'nombre', label: 'Cuenta', render: (r) => r.cuenta?.nombre || r.cuenta_id }, { key: 'debe', label: 'Debe', render: (r) => money(r.debe) }, { key: 'haber', label: 'Haber', render: (r) => money(r.haber) }, { key: 'saldo', label: 'Saldo', render: (r) => money(r.debe - r.haber) }]} rows={balanceRows} rowKey={(row) => row.cuenta_id} /></div><p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Informes provisionales. No sustituyen el cierre fiscal ni la presentación de impuestos.</p></div>;
  }
  if (tab === 'tesoreria') return <div className="space-y-6"><SectionTitle title="Tesorería y conciliación" subtitle="Cuentas bancarias y movimientos propios de NEWERP." /><div><h3 className="mb-3 font-semibold">Cuentas bancarias</h3><DataTable columns={[{ key: 'nombre', label: 'Cuenta' }, { key: 'entidad', label: 'Entidad' }, { key: 'iban_mascara', label: 'IBAN' }, { key: 'activa', label: 'Estado', render: (r) => r.activa ? 'Activa' : 'Inactiva' }]} rows={data.accounts || []} /></div><div><h3 className="mb-3 font-semibold">Movimientos recientes</h3><DataTable columns={[{ key: 'fecha', label: 'Fecha', render: (r) => date(r.fecha) }, { key: 'concepto', label: 'Concepto' }, { key: 'importe', label: 'Importe', render: (r) => money(r.importe) }, { key: 'estado', label: 'Estado' }, { key: 'referencia', label: 'Referencia' }]} rows={data.movements || []} /></div></div>;
  if (tab === 'cierres') return <CierresContent data={data} onRefresh={onRefresh} onChangePeriodStatus={onChangePeriodStatus} actionId={actionId} />;
  return null;
}

function CierresContent({ data, onRefresh, onChangePeriodStatus, actionId }) {
  const periods = Array.isArray(data) ? data : (data?.periods || []);
  const seats = data?.seats || [];
  const lines = data?.lines || [];
  const accounts = new Map((data?.accounts || []).map((account) => [account.id, account]));
  const [exerciseFilter, setExerciseFilter] = useState('todos');
  const [monthFilter, setMonthFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const exercises = [...new Set(periods.map((period) => period.ejercicio).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
  const statuses = [...new Set(periods.map((period) => String(period.estado || '').toLowerCase()).filter(Boolean))].sort();
  const filteredPeriods = useMemo(() => periods.filter((period) => {
    const matchesExercise = exerciseFilter === 'todos' || String(period.ejercicio) === exerciseFilter;
    const matchesMonth = monthFilter === 'todos' || String(period.mes).padStart(2, '0') === monthFilter;
    const matchesStatus = statusFilter === 'todos' || String(period.estado || '').toLowerCase() === statusFilter;
    return matchesExercise && matchesMonth && matchesStatus;
  }), [exerciseFilter, monthFilter, periods, statusFilter]);
  const closedCount = filteredPeriods.filter((period) => String(period.estado || '').toLowerCase() === 'cerrado').length;
  const openCount = filteredPeriods.length - closedCount;
  const selectedYear = exerciseFilter === 'todos' ? null : Number(exerciseFilter);
  const selectedMonth = monthFilter === 'todos' ? null : Number(monthFilter);
  const hasPeriodFilter = exerciseFilter !== 'todos' || monthFilter !== 'todos' || statusFilter !== 'todos';
  const selectedPeriodKeys = new Set(filteredPeriods.map((period) => `${period.ejercicio}-${String(period.mes).padStart(2, '0')}`));
  const visibleSeats = seats.filter((seat) => {
    const fecha = String(seat.fecha_contable || '');
    const matchesDate = (!selectedYear || Number(fecha.slice(0, 4)) === selectedYear) && (!selectedMonth || Number(fecha.slice(5, 7)) === selectedMonth);
    const matchesPeriod = !hasPeriodFilter || selectedPeriodKeys.has(`${fecha.slice(0, 4)}-${fecha.slice(5, 7)}`);
    return matchesDate && matchesPeriod;
  });
  const visibleSeatIds = new Set(visibleSeats.map((seat) => seat.id));
  const fiscalLines = lines.filter((line) => visibleSeatIds.has(line.asiento_id));
  const supported = fiscalLines.filter((line) => accounts.get(line.cuenta_id)?.codigo === '472').reduce((sum, line) => sum + Number(line.debe || 0) - Number(line.haber || 0), 0);
  const repercuted = fiscalLines.filter((line) => accounts.get(line.cuenta_id)?.codigo === '477').reduce((sum, line) => sum + Number(line.haber || 0) - Number(line.debe || 0), 0);
  const fiscalRows = visibleSeats.map((seat) => {
    const seatLines = fiscalLines.filter((line) => line.asiento_id === seat.id);
    const supportedLine = seatLines.find((line) => accounts.get(line.cuenta_id)?.codigo === '472');
    const repercutedLine = seatLines.find((line) => accounts.get(line.cuenta_id)?.codigo === '477');
    const base = seatLines
      .filter((line) => ['3', '6', '7'].some((prefix) => String(accounts.get(line.cuenta_id)?.codigo || '').startsWith(prefix)))
      .reduce((sum, line) => {
        const signedBase = Number(line.debe || 0) - Number(line.haber || 0);
        return sum + (supportedLine ? signedBase : -signedBase);
      }, 0);
    if (!supportedLine && !repercutedLine) return null;
    return { id: seat.id, fecha: seat.fecha_contable, asiento: seat.numero, tipo: supportedLine ? 'IVA soportado' : 'IVA repercutido', concepto: seat.concepto, base, cuota: supportedLine ? Number(supportedLine.debe || 0) - Number(supportedLine.haber || 0) : Number(repercutedLine.haber || 0) - Number(repercutedLine.debe || 0) };
  }).filter(Boolean);
  const filterDescription = `Ejercicio: ${exerciseFilter === 'todos' ? 'todos' : exerciseFilter} · Mes: ${monthFilter === 'todos' ? 'todos' : monthFilter} · Estado: ${statusFilter === 'todos' ? 'todos' : statusFilter}`;
  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();
    const summaryRows = [
      { Concepto: 'IVA soportado', Importe: Number(supported.toFixed(2)) },
      { Concepto: 'IVA repercutido', Importe: Number(repercuted.toFixed(2)) },
      { Concepto: 'Saldo provisional', Importe: Number((repercuted - supported).toFixed(2)) },
    ];
    const periodRows = filteredPeriods.map((period) => ({
      Periodo: `${String(period.mes || '').padStart(2, '0')} / ${period.ejercicio || ''}`,
      Estado: period.estado || '',
      Observaciones: period.observaciones || '',
      'Fecha de cierre': period.cerrado_at ? date(period.cerrado_at) : '',
    }));
    const detailRows = fiscalRows.map((row) => ({ Fecha: date(row.fecha), Asiento: row.asiento || '', Tipo: row.tipo, Concepto: row.concepto || '', Base: Number(row.base.toFixed(2)), Cuota: Number(row.cuota.toFixed(2)) }));
    const addSheet = (rows, name, widths) => {
      const sheet = XLSX.utils.json_to_sheet(rows);
      sheet['!cols'] = widths.map((wch) => ({ wch }));
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
      for (let column = range.s.c; column <= range.e.c; column += 1) {
        const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: column })];
        if (cell) cell.s = { fill: { fgColor: { rgb: '6D28D9' } }, font: { color: { rgb: 'FFFFFF' }, bold: true }, alignment: { horizontal: 'center' } };
      }
      for (let row = 1; row <= range.e.r; row += 1) {
        for (let column = range.s.c; column <= range.e.c; column += 1) {
          const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
          if (cell) cell.s = { fill: { fgColor: { rgb: row % 2 ? 'F8F7FF' : 'FFFFFF' } }, border: { bottom: { style: 'thin', color: { rgb: 'E5E7EB' } } } };
        }
      }
      if (sheet['!ref']) sheet['!autofilter'] = { ref: sheet['!ref'] };
      XLSX.utils.book_append_sheet(workbook, sheet, name);
    };
    addSheet(summaryRows, 'Resumen fiscal', [24, 16]);
    addSheet(periodRows, 'Periodos', [18, 16, 52, 20]);
    addSheet(detailRows, 'Movimientos fiscales', [14, 12, 20, 48, 16, 16]);
    XLSX.writeFile(workbook, `Cierres_fiscales_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const exportPdf = () => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    pdf.setFontSize(16);
    pdf.text('Cierres e impuestos', 14, 16);
    pdf.setFontSize(9);
    pdf.setTextColor(90, 90, 90);
    pdf.text(filterDescription, 14, 23);
    autoTable(pdf, { startY: 30, head: [['Resumen fiscal', 'Importe']], body: [['IVA soportado', money(supported)], ['IVA repercutido', money(repercuted)], ['Saldo provisional', money(repercuted - supported)]], theme: 'grid', headStyles: { fillColor: [109, 40, 217] }, styles: { fontSize: 9 } });
    autoTable(pdf, { startY: (pdf.lastAutoTable?.finalY || 30) + 8, head: [['Periodo', 'Estado', 'Observaciones', 'Cierre']], body: filteredPeriods.map((period) => [`${String(period.mes || '').padStart(2, '0')} / ${period.ejercicio || ''}`, period.estado || '', period.observaciones || '', period.cerrado_at ? date(period.cerrado_at) : '—']), theme: 'grid', headStyles: { fillColor: [109, 40, 217] }, styles: { fontSize: 8 } });
    autoTable(pdf, { startY: (pdf.lastAutoTable?.finalY || 30) + 8, head: [['Fecha', 'Asiento', 'Tipo', 'Concepto', 'Base', 'Cuota']], body: fiscalRows.map((row) => [date(row.fecha), row.asiento || '—', row.tipo, row.concepto || '—', money(row.base), money(row.cuota)]), theme: 'grid', headStyles: { fillColor: [109, 40, 217] }, styles: { fontSize: 7 } });
    pdf.save(`Cierres_fiscales_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6">
      <SectionTitle title="Cierres e impuestos" subtitle="Consulta y filtra los periodos contables antes de revisar el IVA y cerrar un mes." onRefresh={onRefresh} />
      <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={exportExcel} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">Exportar Excel</button><button type="button" onClick={exportPdf} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">Exportar PDF</button></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-muted/20 p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Periodos mostrados</p><p className="mt-1 text-2xl font-semibold">{filteredPeriods.length}</p></div>
        <div className="rounded-lg border bg-emerald-50/60 p-4"><p className="text-xs font-medium uppercase tracking-wide text-emerald-700">No cerrados</p><p className="mt-1 text-2xl font-semibold text-emerald-800">{openCount}</p></div>
        <div className="rounded-lg border bg-slate-50 p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-600">Cerrados</p><p className="mt-1 text-2xl font-semibold text-slate-800">{closedCount}</p></div>
      </div>
      <div className="rounded-lg border bg-muted/20 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><h3 className="font-semibold">Filtrar periodos</h3><p className="text-sm text-muted-foreground">Combina los filtros para localizar rápidamente el mes que necesitas.</p></div>
          {(exerciseFilter !== 'todos' || monthFilter !== 'todos' || statusFilter !== 'todos') && <button type="button" onClick={() => { setExerciseFilter('todos'); setMonthFilter('todos'); setStatusFilter('todos'); }} className="text-sm font-medium text-primary hover:underline">Limpiar filtros</button>}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm font-medium">Ejercicio<select value={exerciseFilter} onChange={(event) => setExerciseFilter(event.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 font-normal"><option value="todos">Todos los ejercicios</option>{exercises.map((exercise) => <option key={exercise} value={String(exercise)}>{exercise}</option>)}</select></label>
          <label className="text-sm font-medium">Mes<select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 font-normal"><option value="todos">Todos los meses</option>{Array.from({ length: 12 }, (_, index) => { const month = String(index + 1).padStart(2, '0'); return <option key={month} value={month}>{month}</option>; })}</select></label>
          <label className="text-sm font-medium">Estado<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 font-normal"><option value="todos">Todos los estados</option>{statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border bg-blue-50/60 p-4"><p className="text-xs font-medium uppercase tracking-wide text-blue-700">IVA soportado</p><p className="mt-1 text-xl font-semibold text-blue-900">{money(supported)}</p></div>
        <div className="rounded-lg border bg-violet-50/60 p-4"><p className="text-xs font-medium uppercase tracking-wide text-violet-700">IVA repercutido</p><p className="mt-1 text-xl font-semibold text-violet-900">{money(repercuted)}</p></div>
        <div className={`rounded-lg border p-4 ${repercuted - supported >= 0 ? 'bg-amber-50/70' : 'bg-emerald-50/70'}`}><p className="text-xs font-medium uppercase tracking-wide text-foreground">Saldo provisional</p><p className="mt-1 text-xl font-semibold">{money(repercuted - supported)}</p></div>
      </div>
      <div><div className="mb-3 flex items-end justify-between gap-3"><div><h3 className="font-semibold">Periodos contables</h3><p className="text-sm text-muted-foreground">Cerrar un periodo impedirá preparar nuevos asientos con fechas dentro de ese mes.</p></div><span className="text-sm text-muted-foreground">{filteredPeriods.length} resultado(s)</span></div><DataTable columns={[{ key: 'mes', label: 'Periodo', render: (period) => `${String(period.mes || '').padStart(2, '0')} / ${period.ejercicio || '—'}` }, { key: 'estado', label: 'Estado', render: (period) => <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${String(period.estado || '').toLowerCase() === 'cerrado' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-700'}`}>{period.estado || 'Sin estado'}</span> }, { key: 'observaciones', label: 'Observaciones' }, { key: 'cerrado_at', label: 'Fecha de cierre', render: (period) => date(period.cerrado_at) }, { key: 'acciones', label: 'Acciones', render: (period) => String(period.estado || '').toLowerCase() === 'cerrado' ? <button type="button" onClick={() => onChangePeriodStatus(period, 'abierto')} disabled={actionId === period.id} className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50">Reabrir</button> : <button type="button" onClick={() => { if (window.confirm(`¿Cerrar el periodo ${String(period.mes).padStart(2, '0')}/${period.ejercicio}? No se podrán preparar nuevos asientos con esa fecha.`)) onChangePeriodStatus(period, 'cerrado'); }} disabled={actionId === period.id} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Cerrar periodo</button> }]} rows={filteredPeriods} /></div>
      <div><div className="mb-3 flex items-end justify-between gap-3"><div><h3 className="font-semibold">Detalle de movimientos fiscales</h3><p className="text-sm text-muted-foreground">Solo incluye asientos confirmados y respeta los filtros seleccionados.</p></div><span className="text-sm text-muted-foreground">{fiscalRows.length} movimiento(s)</span></div><DataTable columns={[{ key: 'fecha', label: 'Fecha', render: (row) => date(row.fecha) }, { key: 'asiento', label: 'Asiento' }, { key: 'tipo', label: 'Tipo' }, { key: 'concepto', label: 'Concepto' }, { key: 'base', label: 'Base', render: (row) => money(row.base) }, { key: 'cuota', label: 'Cuota', render: (row) => money(row.cuota) }]} rows={fiscalRows} /></div>
    </div>
  );
}

function InformesContent({ data, reportType, onReportTypeChange, reportAccountId, onReportAccountChange }) {
  const accounts = new Map((data.accounts || []).map((account) => [account.id, account]));
  const seats = new Map((data.seats || []).map((seat) => [seat.id, seat]));
  const totals = (data.lines || []).reduce((result, line) => {
    const account = accounts.get(line.cuenta_id);
    const current = result.get(line.cuenta_id) || { cuenta_id: line.cuenta_id, cuenta: account, debe: 0, haber: 0 };
    current.debe += Number(line.debe || 0);
    current.haber += Number(line.haber || 0);
    result.set(line.cuenta_id, current);
    return result;
  }, new Map());
  const allRows = [...totals.values()].sort((a, b) => String(a.cuenta?.codigo || '').localeCompare(String(b.cuenta?.codigo || '')));
  const resultRows = allRows.filter((row) => /^[67]/.test(String(row.cuenta?.codigo || '')));
  const balanceRows = allRows.filter((row) => /^[1-5]/.test(String(row.cuenta?.codigo || '')));
  const selectedAccountId = reportAccountId || data.accounts?.[0]?.id || '';
  const mayorRows = (data.lines || []).filter((line) => line.cuenta_id === selectedAccountId).map((line) => ({ ...line, asiento: seats.get(line.asiento_id) }));
  const gastos = resultRows.filter((row) => String(row.cuenta?.codigo || '').startsWith('6')).reduce((sum, row) => sum + row.debe - row.haber, 0);
  const ingresos = resultRows.filter((row) => String(row.cuenta?.codigo || '').startsWith('7')).reduce((sum, row) => sum + row.haber - row.debe, 0);
  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();
    if (reportType === 'resultados') {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(resultRows.map((row) => ({ Código: row.cuenta?.codigo || '', Cuenta: row.cuenta?.nombre || row.cuenta_id, Tipo: String(row.cuenta?.codigo || '').startsWith('6') ? 'Gasto' : 'Ingreso', Importe: Number(String(row.cuenta?.codigo || '').startsWith('6') ? row.debe - row.haber : row.haber - row.debe) }))), 'Resultados');
    } else if (reportType === 'mayor') {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(mayorRows.map((row) => ({ Fecha: row.asiento?.fecha_contable || '', Asiento: row.asiento?.numero || '', Concepto: row.asiento?.concepto || '', Debe: Number(row.debe || 0), Haber: Number(row.haber || 0), Saldo: Number(row.debe || 0) - Number(row.haber || 0) }))), 'Mayor');
    } else {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(balanceRows.map((row) => ({ Código: row.cuenta?.codigo || '', Cuenta: row.cuenta?.nombre || row.cuenta_id, Debe: Number(row.debe), Haber: Number(row.haber), Saldo: Number(row.debe - row.haber) }))), 'Balance');
    }
    XLSX.writeFile(workbook, `${reportType === 'resultados' ? 'Perdidas_y_ganancias' : reportType === 'mayor' ? 'Mayor_por_cuenta' : 'Balance_provisional'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const printReport = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const title = reportType === 'resultados' ? 'Cuenta de resultados provisional' : reportType === 'mayor' ? `Mayor · ${accounts.get(selectedAccountId)?.codigo || ''} ${accounts.get(selectedAccountId)?.nombre || ''}` : 'Balance provisional';
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(`Informe provisional · ${new Date().toLocaleDateString('es-ES')}`, 14, 21);
    doc.setTextColor(0);
    const printableRows = reportType === 'resultados'
      ? resultRows.map((row) => [row.cuenta?.codigo || '—', row.cuenta?.nombre || row.cuenta_id, String(row.cuenta?.codigo || '').startsWith('6') ? 'Gasto' : 'Ingreso', money(String(row.cuenta?.codigo || '').startsWith('6') ? row.debe - row.haber : row.haber - row.debe)])
      : reportType === 'mayor'
        ? mayorRows.map((row) => [row.asiento?.fecha_contable || '—', row.asiento?.numero || '—', row.asiento?.concepto || '—', money(row.debe), money(row.haber), money(Number(row.debe || 0) - Number(row.haber || 0))])
      : balanceRows.map((row) => [row.cuenta?.codigo || '—', row.cuenta?.nombre || row.cuenta_id, money(row.debe), money(row.haber), money(row.debe - row.haber)]);
    if (reportType === 'resultados') {
      doc.text(`Ingresos: ${money(ingresos)}    Gastos: ${money(gastos)}    Resultado: ${money(ingresos - gastos)}`, 14, 29);
      autoTable(doc, { startY: 35, head: [['Código', 'Cuenta', 'Tipo', 'Importe']], body: printableRows });
    } else if (reportType === 'mayor') {
      autoTable(doc, { startY: 29, head: [['Fecha', 'Asiento', 'Concepto', 'Debe', 'Haber', 'Saldo']], body: printableRows });
    } else {
      autoTable(doc, { startY: 29, head: [['Código', 'Cuenta', 'Debe', 'Haber', 'Saldo']], body: printableRows });
    }
    doc.save(`${reportType === 'resultados' ? 'Perdidas_y_ganancias' : reportType === 'mayor' ? 'Mayor_por_cuenta' : 'Balance_provisional'}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };
  return <div className="report-print-area space-y-6"><style>{'@media print { .report-print-area { display: none !important; } }'}</style><div className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between"><div><h2 className="text-2xl font-semibold tracking-tight">Informes contables</h2><p className="mt-1 text-sm text-muted-foreground">Selecciona el informe que quieres consultar o exportar.</p></div><div className="report-print-actions flex flex-wrap gap-2"><select value={reportType} onChange={(event) => onReportTypeChange(event.target.value)} className="rounded-lg border bg-background px-3 py-2 text-sm"><option value="resultados">Pérdidas y ganancias</option><option value="balance">Balance provisional</option></select><button type="button" onClick={exportExcel} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">Exportar Excel</button><button type="button" onClick={printReport} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">Imprimir / PDF</button></div></div>{reportType === 'resultados' ? <><div className="grid gap-4 md:grid-cols-3"><Metric title="Ingresos" value={money(ingresos)} icon={ArrowDownToLine} /><Metric title="Gastos" value={money(gastos)} icon={WalletCards} /><Metric title="Resultado" value={money(ingresos - gastos)} icon={BarChart3} /></div><div><h3 className="mb-3 text-lg font-semibold">Cuenta de resultados provisional</h3><DataTable columns={[{ key: 'codigo', label: 'Código', render: (r) => r.cuenta?.codigo || '—' }, { key: 'nombre', label: 'Cuenta', render: (r) => r.cuenta?.nombre || r.cuenta_id }, { key: 'tipo', label: 'Tipo', render: (r) => String(r.cuenta?.codigo || '').startsWith('6') ? 'Gasto' : 'Ingreso' }, { key: 'importe', label: 'Importe', render: (r) => money(String(r.cuenta?.codigo || '').startsWith('6') ? r.debe - r.haber : r.haber - r.debe) }]} rows={resultRows} rowKey={(row) => row.cuenta_id} /></div></> : <div><h3 className="mb-3 text-lg font-semibold">Balance provisional</h3><DataTable columns={[{ key: 'codigo', label: 'Código', render: (r) => r.cuenta?.codigo || '—' }, { key: 'nombre', label: 'Cuenta', render: (r) => r.cuenta?.nombre || r.cuenta_id }, { key: 'debe', label: 'Debe', render: (r) => money(r.debe) }, { key: 'haber', label: 'Haber', render: (r) => money(r.haber) }, { key: 'saldo', label: 'Saldo', render: (r) => money(r.debe - r.haber) }]} rows={balanceRows} rowKey={(row) => row.cuenta_id} /></div>}<p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Informe provisional. No sustituye el cierre fiscal ni la presentación de impuestos.</p></div>;
}

function Metric({ title, value, icon: Icon }) {
  return <div className="rounded-lg border bg-muted/20 p-4"><div className="flex items-center justify-between text-sm text-muted-foreground"><span>{title}</span><Icon className="h-4 w-4 text-primary" /></div><p className="mt-2 text-2xl font-semibold">{value}</p></div>;
}

function CollectionModal({ collection, onClose, onSubmit }) {
  const [values, setValues] = useState({ fecha: new Date().toISOString().slice(0, 10), importe: collection.invoice.monto_total || '', medio: 'transferencia', cuenta: '', referencia: '', notas: '' });
  const update = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-semibold">Registrar cobro</h3><p className="mt-1 text-sm text-muted-foreground">Factura {collection.invoice.numero_factura} · {money(collection.invoice.monto_total)}</p></div><button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted" aria-label="Cerrar">×</button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm">Fecha<input name="fecha" type="date" value={values.fecha} onChange={update} className="mt-1 w-full rounded-md border bg-background px-3 py-2" /></label><label className="text-sm">Importe<input name="importe" type="number" min="0.01" step="0.01" value={values.importe} onChange={update} className="mt-1 w-full rounded-md border bg-background px-3 py-2" /></label><label className="text-sm">Medio de pago<select name="medio" value={values.medio} onChange={update} className="mt-1 w-full rounded-md border bg-background px-3 py-2"><option value="transferencia">Transferencia</option><option value="domiciliacion">Domiciliación</option><option value="tarjeta">Tarjeta</option><option value="efectivo">Efectivo</option><option value="otro">Otro</option></select></label><label className="text-sm">Cuenta bancaria<select name="cuenta" value={values.cuenta} onChange={update} className="mt-1 w-full rounded-md border bg-background px-3 py-2"><option value="">Sin cuenta</option>{collection.accounts.map((account) => <option key={account.id} value={account.id}>{account.nombre} · {account.iban_mascara || account.entidad}</option>)}</select></label><label className="text-sm sm:col-span-2">Referencia<input name="referencia" value={values.referencia} onChange={update} placeholder="Ej. COB-001" className="mt-1 w-full rounded-md border bg-background px-3 py-2" /></label><label className="text-sm sm:col-span-2">Notas<textarea name="notas" value={values.notas} onChange={update} rows="2" className="mt-1 w-full rounded-md border bg-background px-3 py-2" /></label></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm">Cancelar</button><button type="button" onClick={() => onSubmit(values)} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Guardar cobro</button></div></div></div>;
}

function InvoiceModal({ clients, onClose, onSubmit }) {
  const defaultEmission = new Date();
  const defaultDue = new Date(defaultEmission);
  defaultDue.setDate(defaultDue.getDate() + 30);
  const [values, setValues] = useState({ cliente: clients[0]?.id || '', numero: 'V-TEST-NOV-001', emision: defaultEmission.toISOString().slice(0, 10), vencimiento: defaultDue.toISOString().slice(0, 10), base: '100', ivaPorcentaje: '21' });
  const update = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  const iva = Math.round(Number(values.base || 0) * Number(values.ivaPorcentaje || 0)) / 100;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-semibold">Nueva factura emitida</h3><p className="mt-1 text-sm text-muted-foreground">Alta nativa para pruebas y facturación operativa.</p></div><button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted" aria-label="Cerrar">×</button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm sm:col-span-2">Cliente<select name="cliente" value={values.cliente} onChange={update} className="mt-1 w-full rounded-md border bg-background px-3 py-2">{clients.map((client) => <option key={client.id} value={client.id}>{client.nombre}</option>)}</select></label><label className="text-sm">Nº factura<input name="numero" value={values.numero} onChange={update} className="mt-1 w-full rounded-md border bg-background px-3 py-2" /></label><label className="text-sm">Base imponible<input name="base" type="number" min="0" step="0.01" value={values.base} onChange={update} className="mt-1 w-full rounded-md border bg-background px-3 py-2" /></label><label className="text-sm">Fecha emisión<input name="emision" type="date" value={values.emision} onChange={update} className="mt-1 w-full rounded-md border bg-background px-3 py-2" /></label><label className="text-sm">Vencimiento<input name="vencimiento" type="date" value={values.vencimiento} onChange={update} className="mt-1 w-full rounded-md border bg-background px-3 py-2" /></label><label className="text-sm">IVA (%)<input name="ivaPorcentaje" type="number" min="0" step="0.01" value={values.ivaPorcentaje} onChange={update} className="mt-1 w-full rounded-md border bg-background px-3 py-2" /></label></div><p className="mt-4 rounded-md bg-muted/40 p-3 text-sm">IVA: {money(iva)} · Total: {money(Number(values.base || 0) + iva)}</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm">Cancelar</button><button type="button" disabled={!values.cliente || !values.numero || Number(values.base) <= 0} onClick={() => onSubmit(values)} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Crear factura</button></div></div></div>;
}
