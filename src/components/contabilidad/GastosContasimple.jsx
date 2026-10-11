// GastosContasimple.jsx
//
// Subsección "Gastos" dentro de la pestaña Contasimple.
// Lee EXCLUSIVAMENTE v_contasimple_gastos_listado, paginada server-side.
// No llama a la API de Contasimple, no usa swift-function, no expone claves.

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

export default function GastosContasimple() {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);

  const [year, setYear] = useState('all');
  const [period, setPeriod] = useState('all');
  const [claseInput, setClaseInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(0); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('v_contasimple_gastos_listado').select('*', { count: 'exact' });

      if (period !== 'all') {
        query = query.eq('period', period);
      } else if (year !== 'all') {
        query = query.gte('fecha', `${year}-01-01`).lt('fecha', `${Number(year) + 1}-01-01`);
      }
      const claseNum = claseInput.trim() === '' ? null : Number(claseInput.trim());
      if (claseNum !== null && !Number.isNaN(claseNum)) {
        query = query.eq('expense_class', claseNum);
      }
      if (search) {
        const t = search.replace(/[%,]/g, '');
        query = query.or(`proveedor_nombre.ilike.%${t}%,proveedor_nif.ilike.%${t}%,concept.ilike.%${t}%,numero_gasto.ilike.%${t}%`);
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.order('fecha', { ascending: false }).range(from, to);

      const { data, error: err, count: c } = await query;
      if (err) throw err;
      setRows(data || []);
      setCount(c ?? 0);
    } catch (err) {
      console.error('Error cargando gastos Contasimple:', err);
      setError(err?.message || 'No se pudieron cargar los gastos.');
    } finally {
      setLoading(false);
    }
  }, [year, period, claseInput, search, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Proveedor, NIF, concepto o nº gasto..." className="pl-8 h-9 text-xs" />
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
            <Input
              value={claseInput}
              onChange={(e) => { setClaseInput(e.target.value); setPage(0); }}
              placeholder="Clase (ej. 640)"
              className="h-9 text-xs w-[110px]"
            />
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
          <Card><CardContent className="h-24 flex items-center justify-center text-muted-foreground text-sm">No hay gastos para este filtro.</CardContent></Card>
        ) : (
          rows.map((g) => (
            <Card key={g.id} className="shadow-sm border-slate-200">
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-slate-800 truncate" title={g.concept || ''}>{g.concept || '—'}</p>
                    <p className="text-xs text-muted-foreground truncate">{g.proveedor_nombre || '—'} · {formatDateEs(g.fecha)}</p>
                  </div>
                  <span className="text-[11px] text-slate-500 shrink-0">Clase {g.expense_class ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-xs text-slate-500">{g.numero_gasto || '—'}</span>
                  <span className="font-bold text-slate-900">{formatCurrency(g.total)}</span>
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
                  <TableHead className="w-[10%]">Nº gasto</TableHead>
                  <TableHead className="w-[22%]">Concepto</TableHead>
                  <TableHead className="w-[15%]">Proveedor</TableHead>
                  <TableHead className="w-[9%]">NIF</TableHead>
                  <TableHead className="w-[7%]">Clase</TableHead>
                  <TableHead className="w-[10%] text-right">Total</TableHead>
                  <TableHead className="w-[8%]">ID Contasimple</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white">
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">No hay gastos para este filtro.</TableCell></TableRow>
                ) : (
                  rows.map((g) => (
                    <TableRow key={g.id} className="hover:bg-slate-50">
                      <TableCell className="text-slate-600 whitespace-nowrap">{formatDateEs(g.fecha)}</TableCell>
                      <TableCell className="text-slate-500 whitespace-nowrap">{g.period || '—'}</TableCell>
                      <TableCell className="text-slate-700 truncate" title={g.numero_gasto || ''}>{g.numero_gasto || '—'}</TableCell>
                      <TableCell className="text-slate-700 truncate" title={g.concept || ''}>{g.concept || '—'}</TableCell>
                      <TableCell className="font-medium text-slate-800 truncate" title={g.proveedor_nombre || ''}>{g.proveedor_nombre || '—'}</TableCell>
                      <TableCell className="text-slate-500 truncate">{g.proveedor_nif || '—'}</TableCell>
                      <TableCell className="text-slate-500">{g.expense_class ?? '—'}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(g.total)}</TableCell>
                      <TableCell className="text-slate-500 truncate">{g.contasimple_id ?? '—'}</TableCell>
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
        <span>{count} gastos · página {page + 1} de {totalPages}</span>
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
