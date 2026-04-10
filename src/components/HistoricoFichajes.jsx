import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger
} from "@/components/ui/accordion";
import {
    Loader2,
    ServerCrash,
    Archive,
    Clock,
    Briefcase,
    CalendarClock,
    Filter,
    Search,
    User,
    X,
    Calendar as CalendarIcon,
    Building2,
    MapPin,
    BarChart3,
    ChevronLeft,
    ChevronRight,
    Play,
    Square,
    Eye,
    Utensils,
    Folder,
    FileSpreadsheet,
    FileText,
    Warehouse
} from 'lucide-react';
import { cn, normalizeSupabaseDate, safeFormat, formatSecondsToHoursMinutes, fmtMadrid } from '@/lib/utils';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths, subMonths, getYear, getMonth, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { utcToZonedTime } from 'date-fns-tz';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/components/ui/use-toast";
import TimeClockMap from '@/components/TimeClockMap';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import FichajeDetailModal from './FichajeDetailModal';

/**
 * DEVELOPER NOTE:
 * Pause status and duration are to be shown from 'pausas' table and 'v_fichajes_admin_neto_v5' only. 
 * No client-side pause calculation allowed. Do not infer 'pause' status from 'tipo' field.
 * Active pause = Record in 'pausas' table with hora_fin_pausa IS NULL.
 */

const HistoricoFichajes = () => {
    const { user, sessionRole } = useAuth();
    const [fichajes, setFichajes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [employees, setEmployees] = useState([]);

    // Filters
    const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });
    const [selectedEmployee, setSelectedEmployee] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);

    // Summary Modal
    const [showSummary, setShowSummary] = useState(false);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [weeklySummary, setWeeklySummary] = useState([]);
    const [summaryDate, setSummaryDate] = useState(new Date());
    const [summaryEmployeeId, setSummaryEmployeeId] = useState(null);

    // Detail Modal
    const [detailOpen, setDetailOpen] = useState(false);
    const [selectedFichaje, setSelectedFichaje] = useState(null);

    const isAdminOrEncargado = ['admin', 'encargado'].includes(sessionRole?.rol);

    // Fetch employees for the filter dropdown
    useEffect(() => {
        if (isAdminOrEncargado) {
            const fetchEmployees = async () => {
                try {
                    const { data } = await supabase
                        .from('empleados')
                        .select('id, nombre, apellidos')
                        .eq('activo', true)
                        .order('nombre');
                    setEmployees(data || []);
                } catch (e) {
                    console.error("Error loading employees:", e);
                }
            };
            fetchEmployees();
        }
    }, [isAdminOrEncargado]);

    const getBadgeVariant = (item) => {
        if (item.is_active_pause) return 'warning';
        return item.hora_salida ? 'secondary' : 'default';
    };

    const getStatusLabel = (item) => {
        if (item.is_active_pause) return 'En Pausa';
        return item.hora_salida ? 'Finalizado' : 'En curso';
    };

    // Main List Fetch (Lists RAW punches)
    const fetchFichajes = useCallback(async () => {
        if (!sessionRole.loaded) return;

        setLoading(true);
        setError(null);
        try {
            // Using v5 view for consistent data
            let query = supabase
                .from('v_fichajes_admin_neto_v5')
                .select('*')
                .order('hora_entrada', { ascending: false });

            if (dateRange?.from) {
                query = query.gte('hora_entrada', dateRange.from.toISOString());
            }
            if (dateRange?.to) {
                const endDate = new Date(dateRange.to);
                endDate.setHours(23, 59, 59, 999);
                query = query.lte('hora_entrada', endDate.toISOString());
            }

            if (isAdminOrEncargado) {
                if (selectedEmployee && selectedEmployee !== 'all') {
                    query = query.eq('empleado_id', selectedEmployee);
                }
            } else {
                if (sessionRole.empleadoId) {
                    query = query.eq('empleado_id', sessionRole.empleadoId);
                } else {
                    setFichajes([]);
                    setLoading(false);
                    return;
                }
            }

            if (!isAdminOrEncargado) {
                query = query.limit(500);
            }

            const { data, error: fetchError } = await query;

            if (fetchError) throw fetchError;

            // Check for active pauses (where hora_fin_pausa is null)
            // This is the only way to accurately determine "Active Pause" state
            const fichajeIds = data?.map(f => f.id) || [];
            let pausesMap = new Map();

            if (fichajeIds.length > 0) {
                const { data: pauses, error: pausesError } = await supabase
                    .from('pausas')
                    .select('fichaje_id, hora_fin_pausa')
                    .in('fichaje_id', fichajeIds)
                    .is('hora_fin_pausa', null);

                if (!pausesError && pauses) {
                    pauses.forEach(p => pausesMap.set(p.fichaje_id, true));
                }
            }

            let filteredData = (data || []).map(f => ({
                ...f,
                is_active_pause: pausesMap.has(f.id)
            }));

            if (searchTerm) {
                const lowerTerm = searchTerm.toLowerCase();
                filteredData = filteredData.filter(item =>
                    item.nombre_proyecto?.toLowerCase().includes(lowerTerm) ||
                    (isAdminOrEncargado && item.empleado_email?.toLowerCase().includes(lowerTerm))
                );
            }

            setFichajes(filteredData);

        } catch (err) {
            console.error("Error fetching fichajes:", err);
            setError("No se pudo cargar el historial. Verifica tu conexión.");
        } finally {
            setLoading(false);
        }
    }, [dateRange, selectedEmployee, searchTerm, isAdminOrEncargado, sessionRole]);

    useEffect(() => {
        if (sessionRole.loaded) {
            fetchFichajes();
        }
    }, [fetchFichajes, sessionRole.loaded]);

    // Grouping Logic
    const groupedFichajes = useMemo(() => {
        const groups = {};
        fichajes.forEach(f => {
            const date = normalizeSupabaseDate(f.hora_entrada);
            if (!date || !isValid(date)) return;

            const year = getYear(date);
            const monthNum = getMonth(date);
            const monthName = format(date, 'MMMM', { locale: es });

            if (!groups[year]) groups[year] = {};
            if (!groups[year][monthNum]) {
                groups[year][monthNum] = {
                    name: monthName,
                    data: []
                };
            }
            groups[year][monthNum].data.push(f);
        });
        return groups;
    }, [fichajes]);

    const RenderFichajeList = ({ data }) => (
        <div className="rounded-md border shadow-sm overflow-hidden mt-2 bg-card">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="w-[40%] md:w-[120px] pl-4">Fichaje</TableHead>
                        {isAdminOrEncargado && <TableHead className="hidden md:table-cell w-[200px]">Empleado</TableHead>}
                        <TableHead className="hidden lg:table-cell">Ubicación</TableHead>
                        <TableHead className="hidden sm:table-cell w-[100px]">Entrada</TableHead>
                        <TableHead className="hidden sm:table-cell w-[100px]">Salida</TableHead>
                        <TableHead className="hidden xl:table-cell w-[100px]">Duración</TableHead>
                        <TableHead className="w-[120px]">Estado</TableHead>
                        <TableHead className="w-[50px] text-right pr-4"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((item) => (
                        <TableRow
                            key={item.id}
                            className="hover:bg-muted/50 cursor-pointer group"
                            onClick={() => handleRowClick(item)}
                        >
                            <TableCell className="font-medium py-3 pl-4 align-top">
                                <div className="whitespace-nowrap">{fmtMadrid(item.hora_entrada, 'date')}</div>
                                <div className="md:hidden flex flex-col gap-0.5 mt-1 text-xs text-muted-foreground">
                                    {isAdminOrEncargado && (
                                        <div className="flex items-center gap-1 text-primary font-medium mb-0.5">
                                            <User className="h-3 w-3" />
                                            <span className="truncate max-w-[150px]">{item.empleado_email}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        <span>{fmtMadrid(item.hora_entrada, 'time')} - {item.hora_salida ? fmtMadrid(item.hora_salida, 'time') : '...'}</span>
                                    </div>
                                    <div className={cn("truncate max-w-[180px] font-medium", item.tipo === 'nave_taller' ? "text-orange-600" : "text-foreground/80")}>
                                        {item.nombre_proyecto || (item.tipo === 'nave_taller' ? 'Nave / Taller' : '-')}
                                    </div>
                                </div>
                            </TableCell>
                            {isAdminOrEncargado && (
                                <TableCell className="hidden md:table-cell font-medium text-primary py-3 align-middle">
                                    {item.empleado_email}
                                </TableCell>
                            )}
                            <TableCell className="hidden lg:table-cell py-3 align-middle">
                                <div className="flex items-center gap-2">
                                    {item.proyecto_id ? (
                                        <Briefcase className="h-3 w-3 text-muted-foreground shrink-0" />
                                    ) : item.tipo === 'nave_taller' ? (
                                        <Warehouse className="h-3 w-3 text-orange-600 shrink-0" />
                                    ) : (
                                        <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                                    )}
                                    <span className={cn("truncate max-w-[200px]", item.tipo === 'nave_taller' ? "text-orange-600 font-medium" : "")} title={item.nombre_proyecto}>
                                        {item.nombre_proyecto || (item.tipo === 'nave_taller' ? 'Nave / Taller' : '-')}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell py-3 align-middle">
                                {fmtMadrid(item.hora_entrada, 'time')}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell py-3 align-middle">
                                {item.hora_salida ? fmtMadrid(item.hora_salida, 'time') : <span className="text-muted-foreground italic">-</span>}
                            </TableCell>
                            <TableCell className="hidden xl:table-cell py-3 align-middle font-mono text-xs font-bold text-gray-700 dark:text-gray-300">
                                {formatSecondsToHoursMinutes(item.duracion_neta_segundos)}
                            </TableCell>
                            <TableCell className="py-3 align-middle">
                                <Badge variant={getBadgeVariant(item)} className={cn("whitespace-nowrap text-[10px] h-5 px-2", item.is_active_pause && "animate-pulse bg-amber-100 text-amber-800 border-amber-300")}>
                                    {getStatusLabel(item)}
                                </Badge>
                            </TableCell>
                            <TableCell className="py-3 text-right pr-4 align-middle">
                                <Eye className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <ServerCrash className="w-12 h-12 text-destructive mb-4" />
                    <p className="font-semibold text-lg">Error al cargar historial</p>
                    <p className="text-muted-foreground">{error}</p>
                    <Button variant="outline" onClick={fetchFichajes} className="mt-4">Reintentar</Button>
                </div>
            );
        }

        if (fichajes.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <Archive className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="font-semibold text-lg">No se encontraron registros</p>
                    <p className="text-muted-foreground">Intenta ajustar los filtros de búsqueda.</p>
                    {(dateRange.from || searchTerm || selectedEmployee !== 'all') && (
                        <Button variant="link" onClick={clearFilters} className="mt-2">Limpiar filtros</Button>
                    )}
                </div>
            );
        }

        const sortedYears = Object.keys(groupedFichajes).sort((a, b) => b - a);

        return (
            <div className="space-y-4">
                {sortedYears.map(year => (
                    <Accordion type="multiple" className="w-full border rounded-lg bg-card shadow-sm" key={year} defaultValue={[year]}>
                        <AccordionItem value={year} className="border-none">
                            <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 hover:no-underline">
                                <div className="flex items-center gap-3">
                                    <div className="bg-primary/10 p-2 rounded-md">
                                        <Folder className="w-5 h-5 text-primary" />
                                    </div>
                                    <span className="text-lg font-semibold">{year}</span>
                                    <Badge variant="secondary" className="ml-2">
                                        {Object.values(groupedFichajes[year]).reduce((acc, curr) => acc + curr.data.length, 0)} registros
                                    </Badge>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 pt-0 border-t">
                                <Accordion type="multiple" className="mt-4 space-y-2" defaultValue={Object.keys(groupedFichajes[year]).sort((a, b) => b - a).map(m => `${year}-${m}`).slice(0, 1)}>
                                    {Object.keys(groupedFichajes[year]).sort((a, b) => b - a).map(monthIndex => {
                                        const monthData = groupedFichajes[year][monthIndex];
                                        return (
                                            <AccordionItem
                                                value={`${year}-${monthIndex}`}
                                                key={monthIndex}
                                                className="border rounded-md bg-background/50 overflow-hidden"
                                            >
                                                <AccordionTrigger className="px-4 py-2 hover:bg-muted/50 text-sm font-medium hover:no-underline">
                                                    <div className="flex items-center gap-2 capitalize">
                                                        <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                                                        {monthData.name}
                                                        <span className="text-muted-foreground font-normal ml-1 text-xs">
                                                            ({monthData.data.length})
                                                        </span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="px-0 pb-0 md:px-2 md:pb-2 border-t bg-card">
                                                    <RenderFichajeList data={monthData.data} />
                                                </AccordionContent>
                                            </AccordionItem>
                                        );
                                    })}
                                </Accordion>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                ))}
            </div>
        );
    };

    // --- REFACTORED SUMMARY FETCH: Uses backend aggregates now ---
    const fetchSummaryData = useCallback(async () => {
        if (!showSummary || !summaryEmployeeId) return;
        setSummaryLoading(true);
        try {
            const startOfMonthDate = startOfMonth(summaryDate);
            const endOfMonthDate = endOfMonth(summaryDate);
            const queryStart = startOfWeek(startOfMonthDate, { weekStartsOn: 1 });
            const queryEnd = endOfWeek(endOfMonthDate, { weekStartsOn: 1 });

            // Using the daily aggregates view (v4 based)
            const { data, error } = await supabase
                .from('v_control_horario_extras_diarias')
                .select('*')
                .eq('empleado_id', summaryEmployeeId)
                .gte('dia', format(queryStart, 'yyyy-MM-dd'))
                .lte('dia', format(queryEnd, 'yyyy-MM-dd'));

            if (error) throw error;

            // Process data into weekly summaries manually (since backend gives daily)
            const weeks = {};
            (data || []).forEach(day => {
                const dateObj = new Date(day.dia);
                const weekStart = startOfWeek(dateObj, { weekStartsOn: 1 });
                const weekKey = weekStart.toISOString();

                if (!weeks[weekKey]) {
                    weeks[weekKey] = {
                        weekStart: weekStart,
                        weekEnd: endOfWeek(dateObj, { weekStartsOn: 1 }),
                        weekNumber: format(weekStart, 'w'),
                        secondsWorked: 0,
                        overtimeSeconds: 0,
                        daysWorked: 0
                    };
                }

                // Convert aggregated hours to seconds for display formatting
                // Backend provides hours (numeric) -> * 3600 -> seconds
                weeks[weekKey].secondsWorked += (Number(day.horas_trabajadas) || 0) * 3600;
                weeks[weekKey].overtimeSeconds += (Number(day.horas_extras) || 0) * 3600;
                weeks[weekKey].daysWorked += 1;
            });

            const summaryArray = Object.values(weeks).map(w => ({
                ...w,
                formattedDuration: formatSecondsToHoursMinutes(w.secondsWorked),
                formattedOvertime: formatSecondsToHoursMinutes(w.overtimeSeconds)
            })).sort((a, b) => a.weekStart - b.weekStart);

            setWeeklySummary(summaryArray);

        } catch (error) {
            console.error('Error fetching summary:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el resumen.' });
        } finally {
            setSummaryLoading(false);
        }
    }, [showSummary, summaryEmployeeId, summaryDate]);

    useEffect(() => {
        if (showSummary) {
            fetchSummaryData();
        }
    }, [showSummary, fetchSummaryData]);

    const openSummaryModal = () => {
        if (selectedEmployee !== 'all') { setSummaryEmployeeId(selectedEmployee); }
        else if (employees.length > 0) { setSummaryEmployeeId(employees[0].id); }
        setSummaryDate(new Date());
        setShowSummary(true);
    };

    const handleRowClick = (fichaje) => { setSelectedFichaje(fichaje); setDetailOpen(true); };
    const clearFilters = () => { setDateRange({ from: undefined, to: undefined }); setSelectedEmployee('all'); setSearchTerm(''); };

    const handleExportExcel = () => {
        if (!fichajes || fichajes.length === 0) { toast({ title: 'No hay datos para exportar', variant: 'destructive' }); return; }
        const dataToExport = fichajes.map(f => ({
            'Fecha': fmtMadrid(f.hora_entrada, 'date'),
            'Empleado': f.empleado_email,
            'Rol': f.empleado_rol,
            'Ubicación': f.nombre_proyecto || (f.tipo === 'nave_taller' ? 'Nave / Taller' : '-'),
            'Hora Entrada': fmtMadrid(f.hora_entrada, 'time'),
            'Hora Salida': f.hora_salida ? fmtMadrid(f.hora_salida, 'time') : '-',
            'Duración Total': f.duracion_neta_segundos ? formatSecondsToHoursMinutes(f.duracion_neta_segundos) : '-',
            'Estado': f.is_active_pause ? 'En Pausa' : (f.hora_salida ? 'Finalizado' : 'Abierto')
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Fichajes");
        XLSX.writeFile(wb, `Historico_Fichajes_${safeFormat(new Date(), 'yyyy-MM-dd')}.xlsx`);
        toast({ title: 'Exportación a Excel completada' });
    };

    const handleExportPDF = () => {
        if (!fichajes || fichajes.length === 0) { toast({ title: 'No hay datos para exportar', variant: 'destructive' }); return; }
        const element = document.createElement('div');
        element.style.padding = '20px'; element.style.fontFamily = 'Arial, sans-serif'; element.style.backgroundColor = '#FFFFFF'; element.style.color = '#000000';
        element.innerHTML = `<h2 style="text-align: center; color: #000000;">Reporte Histórico de Jornadas</h2><p style="text-align: center; font-size: 12px; color: #333333;">Generado el: ${safeFormat(new Date(), 'dd/MM/yyyy HH:mm')}</p><table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px; color: #000000;"><thead><tr style="background-color: #f0f0f0;"><th style="border: 1px solid #cccccc; padding: 8px; text-align: left;">Fecha</th><th style="border: 1px solid #cccccc; padding: 8px; text-align: left;">Empleado</th><th style="border: 1px solid #cccccc; padding: 8px; text-align: left;">Ubicación</th><th style="border: 1px solid #cccccc; padding: 8px; text-align: center;">Entrada</th><th style="border: 1px solid #cccccc; padding: 8px; text-align: center;">Salida</th><th style="border: 1px solid #cccccc; padding: 8px; text-align: center;">Duración</th></tr></thead><tbody>${fichajes.map(f => `<tr><td style="border: 1px solid #cccccc; padding: 6px;">${fmtMadrid(f.hora_entrada, 'date')}</td><td style="border: 1px solid #cccccc; padding: 6px;">${f.empleado_email}</td><td style="border: 1px solid #cccccc; padding: 6px;">${f.nombre_proyecto || (f.tipo === 'nave_taller' ? 'Nave / Taller' : '-')}</td><td style="border: 1px solid #cccccc; padding: 6px; text-align: center;">${fmtMadrid(f.hora_entrada, 'time')}</td><td style="border: 1px solid #cccccc; padding: 6px; text-align: center;">${f.hora_salida ? fmtMadrid(f.hora_salida, 'time') : '-'}</td><td style="border: 1px solid #cccccc; padding: 6px; text-align: center;">${f.duracion_neta_segundos ? formatSecondsToHoursMinutes(f.duracion_neta_segundos) : '-'}</td></tr>`).join('')}</tbody></table>`;
        const opt = { margin: 10, filename: `Historico_Fichajes_${safeFormat(new Date(), 'yyyy-MM-dd')}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
        html2pdf().set(opt).from(element).save().then(() => { toast({ title: 'Exportación a PDF completada' }); }).catch(err => { console.error(err); toast({ title: 'Error al exportar PDF', description: err.message, variant: 'destructive' }); });
    };

    return (
        <div className="p-4 md:p-8 w-full space-y-6">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <CalendarClock className="h-8 w-8 text-primary" />
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Histórico de Jornadas</h1>
                            <p className="text-muted-foreground">
                                {isAdminOrEncargado ? "Consulta y filtra las jornadas laborales del personal." : "Consulta tu historial de jornadas y ubicaciones."}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        {isAdminOrEncargado && (
                            <>
                                <Button variant="outline" size="sm" onClick={handleExportExcel}>
                                    <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" /> Excel
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleExportPDF}>
                                    <FileText className="w-4 h-4 mr-2 text-red-600" /> PDF
                                </Button>
                                <Button variant="outline" size="sm" onClick={openSummaryModal}>
                                    <BarChart3 className="w-4 h-4 mr-2" /> Resumen
                                </Button>
                            </>
                        )}
                        <Button variant="outline" size="sm" className="md:hidden w-full" onClick={() => setIsFiltersOpen(!isFiltersOpen)}>
                            <Filter className="w-4 h-4 mr-2" /> {isFiltersOpen ? 'Ocultar Filtros' : 'Mostrar Filtros'}
                        </Button>
                    </div>
                </div>
            </motion.div>

            <motion.div className={cn("grid gap-4 p-4 bg-card border rounded-lg shadow-sm", isFiltersOpen ? "block" : "hidden md:grid")} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-4 space-y-2">
                        <Label>Rango de Fechas</Label>
                        <div className="flex gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !dateRange.from && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateRange.from ? (dateRange.to ? (<>{safeFormat(dateRange.from, "dd/MM/y")} - {safeFormat(dateRange.to, "dd/MM/y")}</>) : (safeFormat(dateRange.from, "dd/MM/y"))) : (<span>Seleccionar fechas</span>)}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar initialFocus mode="range" defaultMonth={dateRange.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={es} />
                                </PopoverContent>
                            </Popover>
                            {(dateRange.from || dateRange.to) && (<Button variant="ghost" size="icon" onClick={() => setDateRange({ from: undefined, to: undefined })}><X className="h-4 w-4" /></Button>)}
                        </div>
                    </div>
                    {isAdminOrEncargado && (
                        <div className="md:col-span-3 space-y-2">
                            <Label>Empleado</Label>
                            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                                <SelectTrigger><SelectValue placeholder="Todos los empleados" /></SelectTrigger>
                                <SelectContent><SelectItem value="all">Todos los empleados</SelectItem>{employees.map((emp) => (<SelectItem key={emp.id} value={emp.id}>{emp.nombre} {emp.apellidos}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className={cn("space-y-2", isAdminOrEncargado ? "md:col-span-3" : "md:col-span-6")}>
                        <Label>Buscar</Label>
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Buscar ubicación..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                    <div className="md:col-span-2 flex gap-2">
                        <Button className="w-full" onClick={fetchFichajes}>Aplicar</Button>
                        <Button variant="ghost" size="icon" onClick={clearFilters} title="Limpiar todo"><X className="h-4 w-4" /></Button>
                    </div>
                </div>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                {renderContent()}
            </motion.div>

            {/* Summary Modal */}
            <Dialog open={showSummary} onOpenChange={setShowSummary}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader><DialogTitle>Resumen Semanal de Horas</DialogTitle></DialogHeader>
                    <div className="flex flex-col sm:flex-row gap-4 py-2 items-end border-b pb-4">
                        <div className="space-y-1 flex-1">
                            <Label className="text-xs">Empleado</Label>
                            <Select value={summaryEmployeeId || ''} onValueChange={setSummaryEmployeeId}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar empleado..." /></SelectTrigger>
                                <SelectContent>{employees.map((emp) => (<SelectItem key={emp.id} value={emp.id}>{emp.nombre} {emp.apellidos}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Mes</Label>
                            <div className="flex items-center gap-1 border rounded-md p-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSummaryDate(subMonths(summaryDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                                <div className="w-32 text-center font-medium text-sm">{safeFormat(summaryDate, 'MMMM yyyy')}</div>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSummaryDate(addMonths(summaryDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto py-4">
                        {summaryLoading ? (<div className="flex justify-center py-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>) : !summaryEmployeeId ? (<p className="text-muted-foreground text-center py-8">Selecciona un empleado para ver su resumen.</p>) : weeklySummary.length === 0 ? (<p className="text-muted-foreground text-center py-8">No hay registros de horas para este empleado en {safeFormat(summaryDate, 'MMMM')}.</p>) : (
                            <div className="space-y-3">
                                {weeklySummary.map((week, idx) => (
                                    <div key={idx} className="bg-muted/30 p-4 rounded-lg border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div>
                                            <div className="text-sm font-bold uppercase text-muted-foreground">Semana {week.weekNumber}</div>
                                            <div className="text-base font-medium">{safeFormat(week.weekStart, 'd MMM')} - {safeFormat(week.weekEnd, 'd MMM')}</div>
                                        </div>
                                        <div className="flex gap-6 text-right w-full sm:w-auto">
                                            <div>
                                                <div className="text-xs text-muted-foreground">Trabajado</div>
                                                <div className="text-xl font-bold">{week.formattedDuration}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-muted-foreground">Extras</div>
                                                <div className={cn("text-xl font-bold", week.overtimeSeconds > 0 ? "text-green-600" : "text-gray-500")}>
                                                    {week.overtimeSeconds > 0 ? '+' : ''}{week.formattedOvertime}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div className="mt-4 pt-4 border-t flex justify-end">
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 inline-flex gap-8">
                                        <div className="text-right">
                                            <div className="text-xs text-blue-600 uppercase font-bold">Total Horas</div>
                                            <div className="text-lg font-bold text-blue-900">
                                                {formatSecondsToHoursMinutes(weeklySummary.reduce((acc, w) => acc + w.secondsWorked, 0))}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-blue-600 uppercase font-bold">Balance Extras</div>
                                            <div className="text-lg font-bold text-blue-900">
                                                {formatSecondsToHoursMinutes(weeklySummary.reduce((acc, w) => acc + w.overtimeSeconds, 0))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Detail Modal */}
            <FichajeDetailModal
                fichaje={selectedFichaje}
                isOpen={detailOpen}
                onClose={() => setDetailOpen(false)}
            />
        </div>
    );
};

export default HistoricoFichajes;