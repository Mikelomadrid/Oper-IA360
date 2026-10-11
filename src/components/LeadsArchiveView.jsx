import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Archive, CalendarDays, Edit, MapPin, Folder, ChevronLeft, Search, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

// Quita acentos para que la búsqueda encuentre "garcia" aunque el dato tenga "García".
const normalize = (str) => (str || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const STATUS_STYLES = {
  nuevo: 'bg-blue-100 text-blue-800 border-blue-200',
  contactado: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  visita_agendada: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  visitado: 'bg-purple-100 text-purple-800 border-purple-200',
  presupuestado: 'bg-orange-100 text-orange-800 border-orange-200',
  aceptado: 'bg-green-100 text-green-800 border-green-200',
  rechazado: 'bg-red-100 text-red-800 border-red-200',
  convertido: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelado: 'bg-gray-100 text-gray-800 border-gray-200',
  parte: 'bg-indigo-100 text-indigo-800 border-indigo-300',
};

const getStatusBadge = (status) => (
  <Badge variant="outline" className={`${STATUS_STYLES[status] || 'bg-gray-100 text-gray-800'} border uppercase text-xs font-semibold`}>
    {status?.replace('_', ' ')}
  </Badge>
);

// Tabla reutilizable: se usa tanto para el listado de un mes como para los
// resultados de búsqueda (que mezclan leads de todos los meses).
const LeadsTable = ({ leads, onEditLead, showArchivedDate = true }) => (
  <div className="rounded-md">
    <Table>
      <TableHeader className="bg-slate-50">
        <TableRow>
          <TableHead className="font-semibold text-slate-700 w-[30%]">Nombre / Cliente</TableHead>
          <TableHead className="font-semibold text-slate-700 hidden md:table-cell">Partida</TableHead>
          <TableHead className="font-semibold text-slate-700 hidden sm:table-cell">Teléfono</TableHead>
          <TableHead className="font-semibold text-slate-700">Estado Final</TableHead>
          <TableHead className="font-semibold text-slate-700 hidden lg:table-cell">Creación</TableHead>
          {showArchivedDate && <TableHead className="font-semibold text-slate-700">Archivado El</TableHead>}
          <TableHead className="text-right font-semibold text-slate-700">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="bg-white">
        {leads.map((lead) => (
          <TableRow key={lead.id} className="hover:bg-slate-50 transition-colors group">
            <TableCell className="align-top py-4">
              <div className="flex flex-col gap-0.5">
                {lead.nombre_empresa ? (
                  <>
                    <span className="font-bold text-slate-900 leading-tight">
                      {lead.nombre_empresa}
                    </span>
                    <span className="text-xs text-slate-500 font-medium leading-tight">
                      {lead.nombre_contacto}
                    </span>
                  </>
                ) : (
                  <span className="font-bold text-slate-900 leading-tight">
                    {lead.nombre_contacto || 'Sin nombre'}
                  </span>
                )}
                <div className="sm:hidden mt-2 space-y-1">
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {lead.municipio || lead.direccion || '-'}
                  </span>
                </div>
              </div>
            </TableCell>

            <TableCell className="hidden md:table-cell align-top py-4">
              <span className="capitalize text-sm text-slate-700">
                {lead.partida || '-'}
              </span>
            </TableCell>

            <TableCell className="hidden sm:table-cell align-top py-4 text-sm text-slate-600">
              {lead.telefono || '-'}
            </TableCell>

            <TableCell className="align-top py-4">
              {getStatusBadge(lead.estado)}
            </TableCell>

            <TableCell className="hidden lg:table-cell align-top py-4 text-sm text-slate-500">
              {formatDate(lead.created_at)}
            </TableCell>

            {showArchivedDate && (
              <TableCell className="align-top py-4 text-sm text-slate-600 font-medium">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                  {lead.archivado_at
                    ? new Date(lead.archivado_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : '-'
                  }
                </div>
              </TableCell>
            )}

            <TableCell className="text-right align-top py-4">
              <Button variant="ghost" size="sm" className="h-8 gap-2 hover:text-blue-600" onClick={() => onEditLead(lead.id)}>
                <Edit className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only sm:inline-block">Ver / Editar</span>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

const LeadsArchiveView = ({ onEditLead }) => {
  const { toast } = useToast();
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [archivedLeads, setArchivedLeads] = useState([]);
  const [allGroupedLeads, setAllGroupedLeads] = useState({});
  // Lista plana de TODOS los leads archivados (todos los meses), solo para búsqueda.
  const [allLeadsFlat, setAllLeadsFlat] = useState([]);
  const [loadingMonths, setLoadingMonths] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchArchiveData = async () => {
    setLoadingMonths(true);
    setLoadingLeads(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('archivado', true)
        .order('archivado_at', { ascending: false });

      if (error) throw error;

      setAllLeadsFlat(data || []);

      const computedMonths = [];
      const leadsByMonthMap = {};

      (data || []).forEach(lead => {
        const dateStr = lead.archivado_at || lead.created_at || new Date().toISOString();
        const date = new Date(dateStr);

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const monthKey = `${year}-${month}`;

        const monthName = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        const capitalizedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);

        if (!leadsByMonthMap[monthKey]) {
          leadsByMonthMap[monthKey] = [];
          computedMonths.push({
            mes_key: monthKey,
            mes_nombre: capitalizedMonthName,
            mes_inicio: monthKey + '-01',
            total: 0
          });
        }

        leadsByMonthMap[monthKey].push(lead);
      });

      computedMonths.forEach(m => {
        m.total = leadsByMonthMap[m.mes_key].length;
      });

      computedMonths.sort((a, b) => b.mes_inicio.localeCompare(a.mes_inicio));

      setMonths(computedMonths);
      setAllGroupedLeads(leadsByMonthMap);

      if (computedMonths.length === 0) {
        setArchivedLeads([]);
      }
    } catch (error) {
      console.error('Error fetching archive data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los leads archivados.'
      });
    } finally {
      setLoadingMonths(false);
      setLoadingLeads(false);
    }
  };

  useEffect(() => {
    fetchArchiveData();
  }, []);

  useEffect(() => {
    if (selectedMonth && allGroupedLeads[selectedMonth]) {
      setArchivedLeads(allGroupedLeads[selectedMonth]);
    } else {
      setArchivedLeads([]);
    }
  }, [selectedMonth, allGroupedLeads]);

  // Resultados de búsqueda: se calculan sobre TODOS los leads archivados,
  // sin importar el mes, buscando en cliente/empresa/dirección/municipio/teléfono.
  const searchResults = useMemo(() => {
    const q = normalize(searchQuery.trim());
    if (!q) return null;
    return allLeadsFlat.filter(lead => {
      const haystack = normalize([
        lead.nombre_contacto,
        lead.nombre_empresa,
        lead.direccion,
        lead.municipio,
        lead.telefono
      ].filter(Boolean).join(' '));
      return haystack.includes(q);
    });
  }, [searchQuery, allLeadsFlat]);

  const isSearching = searchQuery.trim().length > 0;

  if (loadingMonths) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Buscador: busca en TODOS los meses a la vez, no solo en el mes abierto */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por cliente, empresa, dirección o teléfono en todo el archivo..."
              className="pl-9 pr-9"
            />
            {isSearching && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                title="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {isSearching ? (
        // --- VISTA DE RESULTADOS DE BÚSQUEDA (todos los meses mezclados) ---
        <Card className="shadow-md border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} para "{searchQuery}"
            </span>
          </div>
          {searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-white">
              <Search className="h-12 w-12 opacity-20 mb-3" />
              <p>No se ha encontrado ningún lead archivado que coincida.</p>
            </div>
          ) : (
            <LeadsTable leads={searchResults} onEditLead={onEditLead} />
          )}
        </Card>
      ) : !selectedMonth ? (
        // --- VISTA DE CARPETAS POR MES (comportamiento original) ---
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-slate-700 mb-6">
              <Archive className="h-6 w-6 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Archivo Histórico</h2>
            </div>

            {months.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Folder className="h-12 w-12 opacity-20 mb-3" />
                <p>No hay mensajes archivados.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {months.map((m) => (
                  <Card
                    key={m.mes_key}
                    className="cursor-pointer hover:bg-slate-50 transition-colors hover:border-blue-300 group"
                    onClick={() => setSelectedMonth(m.mes_key)}
                  >
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                      <div className="relative mb-3">
                        <Folder className="w-16 h-16 text-blue-400 fill-blue-100 group-hover:scale-105 transition-transform duration-300" />
                      </div>
                      <span className="font-semibold text-sm text-slate-800 line-clamp-2">{m.mes_nombre}</span>
                      <Badge variant="secondary" className="mt-2 text-xs bg-slate-100 text-slate-600">
                        {m.total} leads
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => setSelectedMonth(null)} className="gap-2">
                <ChevronLeft className="w-4 h-4" />
                Carpetas
              </Button>
              <div className="flex items-center gap-2">
                <Folder className="w-5 h-5 text-blue-500 fill-blue-100" />
                <h2 className="text-xl font-bold text-slate-800">
                  {months.find(m => m.mes_key === selectedMonth)?.mes_nombre}
                </h2>
              </div>
            </div>
          </div>

          {/* Leads Table */}
          <Card className="shadow-md border-slate-200 overflow-hidden">
            {loadingLeads ? (
              <div className="flex justify-center items-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : archivedLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-white">
                <Archive className="h-12 w-12 opacity-20 mb-3" />
                <p>No hay leads archivados para este mes.</p>
              </div>
            ) : (
              <LeadsTable leads={archivedLeads} onEditLead={onEditLead} />
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default LeadsArchiveView;
