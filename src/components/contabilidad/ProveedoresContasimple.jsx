// ProveedoresContasimple.jsx
//
// Subsección "Proveedores" dentro de la pestaña Contasimple.
// 1) Cards de resumen: v_contasimple_proveedores_resumen (estado_match/total)
// 2) Tabla paginada y filtrable: v_contasimple_proveedores_match
//    (7 columnas reales: erp_proveedor_id, erp_nombre, erp_cif, contasimple_id,
//     contasimple_nombre, contasimple_nif, estado_match — no trae recomendación,
//     así que se deriva en el frontend a partir de estado_match).
// No llama a la API de Contasimple, no usa swift-function, no expone claves.

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, AlertTriangle, CheckCircle2, Building2, Users, Search, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { supabase } from '@/lib/customSupabaseClient';

const PAGE_SIZE = 50;

const ESTADO_MATCH_INFO = {
  erp_y_contasimple: {
    label: 'ERP + Contasimple',
    classes: 'bg-green-100 text-green-700 border-green-200',
    recomendacion: 'Proveedor ya cruzado correctamente entre ERP y Contasimple.',
  },
  solo_contasimple: {
    label: 'Solo Contasimple',
    classes: 'bg-amber-100 text-amber-700 border-amber-200',
    recomendacion: 'Existe en Contasimple pero no en el ERP: revisar si falta darlo de alta.',
  },
  solo_erp: {
    label: 'Solo ERP',
    classes: 'bg-blue-100 text-blue-700 border-blue-200',
    recomendacion: 'Existe en el ERP pero no en Contasimple: revisar si falta sincronizar.',
  },
};
const estadoMatchInfo = (v) => ESTADO_MATCH_INFO[v] || { label: v || 'Desconocido', classes: 'bg-slate-100 text-slate-600 border-slate-200', recomendacion: '—' };

const EstadoMatchBadge = ({ value }) => {
  const info = estadoMatchInfo(value);
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${info.classes}`}>{info.label}</span>;
};

export default function ProveedoresContasimple() {
  // ---------- Resumen (cards) ----------
  const [resumen, setResumen] = useState([]);
  const [loadingResumen, setLoadingResumen] = useState(true);
  const [errorResumen, setErrorResumen] = useState(null);

  const loadResumen = useCallback(async () => {
    setLoadingResumen(true);
    setErrorResumen(null);
    try {
      const { data, error: err } = await supabase.from('v_contasimple_proveedores_resumen').select('*');
      if (err) throw err;
      setResumen(data || []);
    } catch (err) {
      console.error('Error cargando resumen de proveedores Contasimple:', err);
      setErrorResumen(err?.message || 'No se pudo cargar el resumen de proveedores.');
    } finally {
      setLoadingResumen(false);
    }
  }, []);

  useEffect(() => { loadResumen(); }, [loadResumen]);

  const getValue = (estadoMatch) => {
    const row = resumen.find(r => r.estado_match === estadoMatch);
    return row ? Number(row.total) || 0 : 0;
  };

  // ---------- Tabla (listado paginado y filtrable) ----------
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [loadingTabla, setLoadingTabla] = useState(true);
  const [errorTabla, setErrorTabla] = useState(null);
  const [page, setPage] = useState(0);

  const [filtroEstado, setFiltroEstado] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(0); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadTabla = useCallback(async () => {
    setLoadingTabla(true);
    setErrorTabla(null);
    try {
      let query = supabase.from('v_contasimple_proveedores_match').select('*', { count: 'exact' });

      if (filtroEstado !== 'all') {
        query = query.eq('estado_match', filtroEstado);
      }
      if (search) {
        const t = search.replace(/[%,]/g, '');
        query = query.or(
          `erp_nombre.ilike.%${t}%,erp_cif.ilike.%${t}%,contasimple_nombre.ilike.%${t}%,contasimple_nif.ilike.%${t}%`
        );
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.order('estado_match', { ascending: true }).range(from, to);

      const { data, error: err, count: c } = await query;
      if (err) throw err;
      setRows(data || []);
      setCount(c ?? 0);
    } catch (err) {
      console.error('Error cargando tabla de proveedores Contasimple:', err);
      setErrorTabla(err?.message || 'No se pudo cargar el listado de proveedores.');
    } finally {
      setLoadingTabla(false);
    }
  }, [filtroEstado, search, page]);

  useEffect(() => { loadTabla(); }, [loadTabla]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const refrescarTodo = () => { loadResumen(); loadTabla(); };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-slate-900">Proveedores: ERP vs Contasimple</h3>
        <p className="text-xs text-muted-foreground">
          Para el detalle documento a documento del cruce, consulta la subpestaña "Comparador".
        </p>
      </div>

      {/* ---------- Resumen (cards) ---------- */}
      {loadingResumen ? (
        <Card className="shadow-sm border-slate-200">
          <CardContent className="h-24 flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" /> Cargando resumen...
          </CardContent>
        </Card>
      ) : errorResumen ? (
        <Card className="shadow-sm border-red-200">
          <CardContent className="h-24 flex flex-col items-center justify-center gap-2 text-center px-4">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-700">{errorResumen}</p>
            <Button variant="outline" size="sm" onClick={loadResumen}>Reintentar</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100"><CheckCircle2 className="w-4 h-4 text-green-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Coinciden ERP + Contasimple</p>
                <p className="text-lg font-bold text-slate-900">{getValue('erp_y_contasimple')}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100"><Building2 className="w-4 h-4 text-blue-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Solo en Contasimple</p>
                <p className="text-lg font-bold text-slate-900">{getValue('solo_contasimple')}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-200"><Users className="w-4 h-4 text-slate-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Solo en ERP</p>
                <p className="text-lg font-bold text-slate-900">{getValue('solo_erp')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---------- Filtros de la tabla ---------- */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Nombre o NIF/CIF (ERP o Contasimple)..."
                className="pl-8 h-9 text-xs"
              />
            </div>
            <select
              value={filtroEstado}
              onChange={(e) => { setFiltroEstado(e.target.value); setPage(0); }}
              className="bg-background border rounded-lg px-2.5 py-1.5 text-xs"
            >
              <option value="all">Todos los estados</option>
              <option value="erp_y_contasimple">ERP + Contasimple</option>
              <option value="solo_contasimple">Solo Contasimple</option>
              <option value="solo_erp">Solo ERP</option>
            </select>
            <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={refrescarTodo}>
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTabla ? 'animate-spin' : ''}`} /> Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ---------- Móvil: cards ---------- */}
      <div className="md:hidden space-y-2">
        {loadingTabla ? (
          <Card><CardContent className="h-24 flex items-center justify-center text-muted-foreground text-sm">Cargando...</CardContent></Card>
        ) : errorTabla ? (
          <Card className="border-red-200"><CardContent className="h-24 flex flex-col items-center justify-center gap-2 text-center px-4">
            <AlertTriangle className="w-5 h-5 text-red-500" /><p className="text-sm text-red-700">{errorTabla}</p>
          </CardContent></Card>
        ) : rows.length === 0 ? (
          <Card><CardContent className="h-24 flex items-center justify-center text-muted-foreground text-sm">No hay proveedores para este filtro.</CardContent></Card>
        ) : (
          rows.map((p) => {
            const key = p.erp_proveedor_id || p.contasimple_id;
            const info = estadoMatchInfo(p.estado_match);
            return (
              <Card key={key} className="shadow-sm border-slate-200">
                <CardContent className="p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-slate-800 truncate">{p.erp_nombre || p.contasimple_nombre || '—'}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.erp_cif || p.contasimple_nif || '—'}</p>
                    </div>
                    <EstadoMatchBadge value={p.estado_match} />
                  </div>
                  {p.estado_match === 'erp_y_contasimple' && (
                    <div className="text-xs text-slate-500 grid grid-cols-2 gap-x-2">
                      <span>ERP: {p.erp_nombre || '—'}</span>
                      <span>Contasimple: {p.contasimple_nombre || '—'}</span>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500">{info.recomendacion}</p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* ---------- Escritorio: tabla ---------- */}
      <Card className="hidden md:block shadow-sm border-slate-200 overflow-hidden">
        {errorTabla ? (
          <div className="p-6 text-center text-sm text-red-600">{errorTabla}</div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="w-full table-fixed">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[11%]">Estado</TableHead>
                  <TableHead className="w-[19%]">Proveedor ERP</TableHead>
                  <TableHead className="w-[10%]">NIF ERP</TableHead>
                  <TableHead className="w-[19%]">Proveedor Contasimple</TableHead>
                  <TableHead className="w-[10%]">NIF Contasimple</TableHead>
                  <TableHead className="w-[9%]">ID ERP</TableHead>
                  <TableHead className="w-[7%]">ID CS</TableHead>
                  <TableHead className="w-[15%]">Recomendación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white">
                {loadingTabla ? (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No hay proveedores para este filtro.</TableCell></TableRow>
                ) : (
                  rows.map((p) => {
                    const key = p.erp_proveedor_id || p.contasimple_id;
                    const info = estadoMatchInfo(p.estado_match);
                    return (
                      <TableRow key={key} className="hover:bg-slate-50">
                        <TableCell><EstadoMatchBadge value={p.estado_match} /></TableCell>
                        <TableCell className="font-medium text-slate-800 truncate" title={p.erp_nombre || ''}>{p.erp_nombre || '—'}</TableCell>
                        <TableCell className="text-slate-500 truncate">{p.erp_cif || '—'}</TableCell>
                        <TableCell className="text-slate-700 truncate" title={p.contasimple_nombre || ''}>{p.contasimple_nombre || '—'}</TableCell>
                        <TableCell className="text-slate-500 truncate">{p.contasimple_nif || '—'}</TableCell>
                        <TableCell className="text-slate-400 text-xs truncate" title={p.erp_proveedor_id || ''}>{p.erp_proveedor_id ? p.erp_proveedor_id.slice(0, 8) + '…' : '—'}</TableCell>
                        <TableCell className="text-slate-500 text-xs">{p.contasimple_id ?? '—'}</TableCell>
                        <TableCell className="text-xs text-slate-500 truncate" title={info.recomendacion}>{info.recomendacion}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* ---------- Paginación ---------- */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>{count} proveedores · página {page + 1} de {totalPages}</span>
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
