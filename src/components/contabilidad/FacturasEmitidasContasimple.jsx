// FacturasEmitidasContasimple.jsx
//
// Subsección "Facturas emitidas" dentro de la pestaña Contasimple.
// Lee EXCLUSIVAMENTE v_contasimple_facturas_emitidas_listado, paginada server-side
// (nunca se descarga la tabla completa). No llama a la API de Contasimple, no usa
// swift-function, no expone claves.

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { supabase } from '@/lib/customSupabaseClient';

const PAGE_SIZE = 50;
const AVAILABLE_YEARS = ['2026', '2025', '2024'];
const QUARTERS = ['1T', '2T', '3T', '4T'];

const formatCurrency = (v) => {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  return Number.isNaN(n) ? '—' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
};
const formatDateEs = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
};

const ESTADOS = [
  { value: 'cobrada', label: 'Cobrada', classes: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'pendiente', label: 'Pendiente', classes: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
];
const estadoInfo = (v) => ESTADOS.find(e => e.value === v) || { value: v, label: v || 'Desconocido', classes: 'bg-slate-100 text-slate-600 border-slate-200' };
const EstadoBadge = ({ value }) => {
  const i = estadoInfo(value);
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${i.classes}`}>{i.label}</span>;
};

export default function FacturasEmitidasContasimple({ initialSearch = '' }) {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);

  const [year, setYear] = useState('all');
  const [period, setPeriod] = useState('all');
  const [estado, setEstado] = useState('all');
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);

  useEffect(() => { setSearchInput(initialSearch); setSearch(initialSearch); }, [initialSearch]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(0); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('v_contasimple_facturas_emitidas_listado').select('*', { count: 'exact' });

      if (period !== 'all') {
        query = query.eq('period', period);
      } else if (year !== 'all') {
        query = query.gte('fecha', `${year}-01-01`).lt('fecha', `${Number(year) + 1}-01-01`);
      }
      if (estado !== 'all') query = query.eq('estado_normalizado', estado);
      if (search) {
        const t = search.replace(/[%,]/g, '');
        query = query.or(`cliente_nombre.ilike.%${t}%,cliente_nif.ilike.%${t}%,numero_factura.ilike.%${t}%`);
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.order('fecha', { ascending: false }).range(from, to);

      const { data, error: err, count: c } = await query;
      if (err) throw err;
      setRows(data || []);
      setCount(c ?? 0);
    } catch (err) {
      console.error('Error cargando facturas emitidas Contasimple:', err);
      setError(err?.message || 'No se pudieron cargar las facturas emitidas.');
    } finally {
      setLoading(false);
    }
  }, [year, period, estado, search, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Cliente, NIF o nº factura..." className="pl-8 h-9 text-xs" />
            </div>
            <select value={year} onChange={(e) => { setYear(e.target.value); setPeriod('all'); setPage(0); }} className="bg-background border rounded-lg px-2.5 py-1.5 text-xs">
              <option value="all">Todos los años</option>
              {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {year !== 'all' && (
              <select value={period} onChange={(e) => { setPeriod(e.target.value); setPage(0); }} className="bg-background border rounded-lg px-2.5 py-1.5 text-xs">
                <option value="all">Todo el año</option>
                {QUARTERS.map(q => <option key={q} value={`${year}-${q}`}>{`${year}-${q}`}</option>)}
              </select>
            )}
            <select value={estado} onChange={(e) => { setEstado(e.target.value); setPage(0); }} className="bg-background border rounded-lg px-2.5 py-1.5 text-xs">
              <option value="all">Todos los estados</option>
              {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
            <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={load}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ---------- Móvil: cards ---------- */}
      <div className="md:hidden space-y-2">
        {loading ? (
          <Card><CardContent className="h-24 flex items-center justify-center text-muted-foreground text-sm">Cargando...</CardContent></Card>
        ) : error ? (
          <Card className="border-red-200"><CardContent className="h-24 flex flex-col items-center justify-center gap-2 text-center px-4">
            <AlertTriangle className="w-5 h-5 text-red-500" /><p className="text-sm text-red-700">{error}</p>
          </CardContent></Card>
        ) : rows.length === 0 ? (
          <Card><CardContent className="h-24 flex items-center justify-center text-muted-foreground text-sm">No hay facturas para este filtro.</CardContent></Card>
        ) : (
          rows.map((f) => (
            <Card key={f.id} className="shadow-sm border-slate-200">
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-slate-800 truncate">{f.cliente_nombre || '—'}</p>
                    <p className="text-xs text-muted-foreground truncate">{f.numero_factura || '—'} · {formatDateEs(f.fecha)}</p>
                  </div>
                  <EstadoBadge value={f.estado_normalizado} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-xs text-slate-500">Base {formatCurrency(f.base_imponible)} + IVA {formatCurrency(f.iva_importe)}</span>
                  <span className="font-bold text-slate-900">{formatCurrency(f.total)}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* ---------- Escritorio: tabla ---------- */}
      <Card className="hidden md:block shadow-sm border-slate-200 overflow-hidden">
        {error ? (
          <div className="p-6 text-center text-sm text-red-600">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="w-full table-fixed">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[8%]">Fecha</TableHead>
                  <TableHead className="w-[8%]">Periodo</TableHead>
                  <TableHead className="w-[11%]">Nº factura</TableHead>
                  <TableHead className="w-[19%]">Cliente</TableHead>
                  <TableHead className="w-[10%]">NIF</TableHead>
                  <TableHead className="w-[10%] text-right">Base</TableHead>
                  <TableHead className="w-[9%] text-right">IVA</TableHead>
                  <TableHead className="w-[10%] text-right">Total</TableHead>
                  <TableHead className="w-[9%]">Estado</TableHead>
                  <TableHead className="w-[8%]">ID Contasimple</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white">
                {loading ? (
                  <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">No hay facturas para este filtro.</TableCell></TableRow>
                ) : (
                  rows.map((f) => (
                    <TableRow key={f.id} className="hover:bg-slate-50">
                      <TableCell className="text-slate-600 whitespace-nowrap">{formatDateEs(f.fecha)}</TableCell>
                      <TableCell className="text-slate-500 whitespace-nowrap">{f.period || '—'}</TableCell>
                      <TableCell className="text-slate-700 truncate" title={f.numero_factura || ''}>{f.numero_factura || '—'}</TableCell>
                      <TableCell className="font-medium text-slate-800 truncate" title={f.cliente_nombre || ''}>{f.cliente_nombre || '—'}</TableCell>
                      <TableCell className="text-slate-500 truncate">{f.cliente_nif || '—'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(f.base_imponible)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(f.iva_importe)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(f.total)}</TableCell>
                      <TableCell><EstadoBadge value={f.estado_normalizado} /></TableCell>
                      <TableCell className="text-slate-500 truncate">{f.contasimple_id ?? '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* ---------- Paginación ---------- */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>{count} facturas · página {page + 1} de {totalPages}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} className="gap-1">
            <ChevronLeft className="w-3.5 h-3.5" /> Anterior
          </Button>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)} className="gap-1">
            Siguiente <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
