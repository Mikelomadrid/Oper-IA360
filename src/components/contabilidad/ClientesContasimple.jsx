// ClientesContasimple.jsx
//
// Subsección "Clientes" dentro de la pestaña Contasimple.
// Lee EXCLUSIVAMENTE v_contasimple_clientes_resumen. Al ser ~133 registros agregados
// (no facturas individuales), se carga completa una vez y se filtra/ordena en cliente,
// tal como se acordó explícitamente para esta vista.
// No llama a la API de Contasimple, no usa swift-function, no expone claves.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw, AlertTriangle, Search, ChevronDown, ChevronUp, ArrowUpDown, Layers, FileText
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { supabase } from '@/lib/customSupabaseClient';

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

const SORT_OPTIONS = [
  { value: 'total_facturado', label: 'Total facturado' },
  { value: 'facturas_emitidas', label: 'Nº facturas' },
  { value: 'ultima_factura', label: 'Última factura' },
];

export default function ClientesContasimple({ onVerFacturas }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('total_facturado');
  const [sortDesc, setSortDesc] = useState(true);
  const [filtroPeriodo, setFiltroPeriodo] = useState('all');
  const [expandedKeys, setExpandedKeys] = useState(() => new Set());

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.from('v_contasimple_clientes_resumen').select('*');
      if (err) throw err;
      setRows(data || []);
    } catch (err) {
      console.error('Error cargando clientes Contasimple:', err);
      setError(err?.message || 'No se pudieron cargar los clientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const periodosDisponibles = useMemo(() => {
    const set = new Set(rows.map(r => r.ultimo_periodo).filter(Boolean));
    return Array.from(set).sort().reverse();
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (search) {
      list = list.filter(c =>
        (c.cliente_nombre || '').toLowerCase().includes(search) ||
        (c.cliente_nif || '').toLowerCase().includes(search)
      );
    }
    if (filtroPeriodo !== 'all') {
      list = list.filter(c => c.ultimo_periodo === filtroPeriodo);
    }
    const sorted = [...list].sort((a, b) => {
      let av = a[sortBy]; let bv = b[sortBy];
      if (sortBy === 'ultima_factura') { av = av ? new Date(av).getTime() : 0; bv = bv ? new Date(bv).getTime() : 0; }
      else { av = Number(av) || 0; bv = Number(bv) || 0; }
      return sortDesc ? bv - av : av - bv;
    });
    return sorted;
  }, [rows, search, filtroPeriodo, sortBy, sortDesc]);

  const toggleExpand = (key) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const totales = useMemo(() => ({
    clientes: filtered.length,
    facturas: filtered.reduce((s, c) => s + (c.facturas_emitidas || 0), 0),
    total: filtered.reduce((s, c) => s + (Number(c.total_facturado) || 0), 0),
  }), [filtered]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="shadow-sm border-slate-200"><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Clientes</p>
          <p className="text-lg font-bold text-slate-900">{totales.clientes}</p>
        </CardContent></Card>
        <Card className="shadow-sm border-slate-200"><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Facturas emitidas</p>
          <p className="text-lg font-bold text-slate-900">{totales.facturas}</p>
        </CardContent></Card>
        <Card className="shadow-sm border-slate-200"><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Total facturado</p>
          <p className="text-lg font-bold text-slate-900">{formatCurrency(totales.total)}</p>
        </CardContent></Card>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Cliente o NIF..." className="pl-8 h-9 text-xs" />
            </div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-background border rounded-lg px-2.5 py-1.5 text-xs">
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setSortDesc(v => !v)}>
              <ArrowUpDown className="w-3.5 h-3.5" /> {sortDesc ? 'Desc.' : 'Asc.'}
            </Button>
            {periodosDisponibles.length > 0 && (
              <select value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)} className="bg-background border rounded-lg px-2.5 py-1.5 text-xs">
                <option value="all">Todos los periodos</option>
                {periodosDisponibles.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
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
        ) : filtered.length === 0 ? (
          <Card><CardContent className="h-24 flex items-center justify-center text-muted-foreground text-sm">No hay clientes para este filtro.</CardContent></Card>
        ) : (
          filtered.map((c) => {
            const expanded = expandedKeys.has(c.cliente_key);
            return (
              <Card key={c.cliente_key} className="shadow-sm border-slate-200">
                <CardContent className="p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-slate-800 truncate">{c.cliente_nombre || '—'}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.cliente_nif || '—'}</p>
                    </div>
                    {c.fichas_contasimple > 1 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200 shrink-0">Varias fichas</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-xs text-slate-500">{c.facturas_emitidas} facturas</span>
                    <span className="font-bold text-slate-900">{formatCurrency(c.total_facturado)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <button onClick={() => toggleExpand(c.cliente_key)} className="text-xs text-primary flex items-center gap-1">
                      {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {expanded ? 'Ocultar detalle' : 'Ver detalle'}
                    </button>
                    {onVerFacturas && c.cliente_nif && (
                      <Button variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1" onClick={() => onVerFacturas(c.cliente_nif)}>
                        <FileText className="w-3.5 h-3.5" /> Ver facturas
                      </Button>
                    )}
                  </div>
                  {expanded && (
                    <div className="pt-2 border-t text-xs space-y-1">
                      <div><span className="text-muted-foreground">Primera factura:</span> {formatDateEs(c.primera_factura)}</div>
                      <div><span className="text-muted-foreground">Última factura:</span> {formatDateEs(c.ultima_factura)}</div>
                      <div><span className="text-muted-foreground">Pendiente cobro est.:</span> {formatCurrency(c.pendiente_cobro_estimado)}</div>
                      <div><span className="text-muted-foreground">Nombres detectados:</span> {(c.nombres_detectados || []).join(', ') || '—'}</div>
                      <div><span className="text-muted-foreground">IDs Contasimple:</span> {(c.clientes_contasimple_ids || []).join(', ') || '—'}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
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
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="w-[19%]">Cliente</TableHead>
                  <TableHead className="w-[10%]">NIF</TableHead>
                  <TableHead className="w-[7%] text-right">Nº fact.</TableHead>
                  <TableHead className="w-[7%] text-right">Fichas</TableHead>
                  <TableHead className="w-[9%]">1ª factura</TableHead>
                  <TableHead className="w-[9%]">Última</TableHead>
                  <TableHead className="w-[9%] text-right">Base</TableHead>
                  <TableHead className="w-[10%] text-right">Total</TableHead>
                  <TableHead className="w-[10%] text-right">Pdte. cobro</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white">
                {loading ? (
                  <TableRow><TableCell colSpan={11} className="h-24 text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="h-24 text-center text-muted-foreground">No hay clientes para este filtro.</TableCell></TableRow>
                ) : (
                  filtered.map((c) => {
                    const expanded = expandedKeys.has(c.cliente_key);
                    return (
                      <React.Fragment key={c.cliente_key}>
                        <TableRow className="hover:bg-slate-50 cursor-pointer" onClick={() => toggleExpand(c.cliente_key)}>
                          <TableCell>{expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}</TableCell>
                          <TableCell className="font-medium text-slate-800 truncate" title={c.cliente_nombre || ''}>
                            <div className="flex items-center gap-1.5">
                              <span className="truncate">{c.cliente_nombre || '—'}</span>
                              {c.fichas_contasimple > 1 && (
                                <span title="Varias fichas en Contasimple"><Layers className="w-3.5 h-3.5 text-purple-500 shrink-0" /></span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-500 truncate">{c.cliente_nif || '—'}</TableCell>
                          <TableCell className="text-right">{c.facturas_emitidas ?? 0}</TableCell>
                          <TableCell className="text-right">{c.fichas_contasimple ?? 0}</TableCell>
                          <TableCell className="whitespace-nowrap text-slate-600">{formatDateEs(c.primera_factura)}</TableCell>
                          <TableCell className="whitespace-nowrap text-slate-600">{formatDateEs(c.ultima_factura)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(c.base_total)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(c.total_facturado)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(c.pendiente_cobro_estimado)}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {onVerFacturas && c.cliente_nif && (
                              <Button variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1" onClick={() => onVerFacturas(c.cliente_nif)}>
                                <FileText className="w-3.5 h-3.5" /> Ver facturas
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        {expanded && (
                          <TableRow className="bg-slate-50/60">
                            <TableCell colSpan={11} className="py-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
                                <div><span className="text-muted-foreground">IVA total:</span> {formatCurrency(c.iva_total)}</div>
                                <div><span className="text-muted-foreground">Total cobrado est.:</span> {formatCurrency(c.total_cobrado_estimado)}</div>
                                <div><span className="text-muted-foreground">Último periodo:</span> {c.ultimo_periodo || '—'}</div>
                                <div><span className="text-muted-foreground">Última sincronización:</span> {formatDateEs(c.last_seen_at)}</div>
                                <div className="sm:col-span-2"><span className="text-muted-foreground">Nombres detectados:</span> {(c.nombres_detectados || []).join(', ') || '—'}</div>
                                <div className="sm:col-span-2"><span className="text-muted-foreground">IDs Contasimple:</span> {(c.clientes_contasimple_ids || []).join(', ') || '—'}</div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
