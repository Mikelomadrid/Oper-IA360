import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Loader2, Clock, Download, RefreshCw, Users, User, Eye, Check } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';
import * as XLSX from 'xlsx';
import { DateRangePicker } from '@/components/DateRangePicker';
import { Badge } from '@/components/ui/badge';
import { cn, toMadridTime } from '@/lib/utils';
import { LocationBadge } from '@/components/ui/LocationBadge';

// Helper to format decimal hours to "X h Y min"
const formatDecimalToTime = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '';
    const num = Number(val);
    if (num === 0) return '';

    const h = Math.floor(Math.abs(num));
    const m = Math.round((Math.abs(num) - h) * 60);

    if (m === 60) return `${h + 1} h 0 min`;
    return `${h} h ${m} min`;
};

// Helper to extract HH:MM from timestamp (Madrid)
const extractTime = (ts) => {
    return toMadridTime(ts);
};

const MyExtrasView = () => {
    const { sessionRole, empleadoId } = useAuth();
    const navigate = useNavigate();

    // States
    const [loadingTable, setLoadingTable] = useState(true);
    const [loadingEmployees, setLoadingEmployees] = useState(false);

    const [records, setRecords] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [employeeFetchError, setEmployeeFetchError] = useState(null);

    const [dateRange, setDateRange] = useState({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date())
    });

    // State for employee selection: '' means "Todos los usuarios", otherwise UUID
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

    const canViewAll = sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado';

    // 1. Initialize selection based on role
    useEffect(() => {
        if (!canViewAll && empleadoId) {
            setSelectedEmployeeId(empleadoId);
        }
    }, [canViewAll, empleadoId]);

    // 2. Fetch Employee List (Only for admin/encargado)
    useEffect(() => {
        if (!canViewAll) return;

        const fetchEmployees = async () => {
            setLoadingEmployees(true);
            setEmployeeFetchError(null);
            try {
                const { data, error } = await supabase
                    .from('empleados')
                    .select('id, nombre, apellidos')
                    .in('rol', ['tecnico', 'encargado'])
                    .eq('activo', true)
                    .order('nombre');

                if (error) throw error;
                setEmployees(data || []);
            } catch (err) {
                console.error("Error fetching employees:", err);
                setEmployeeFetchError("No se pudo cargar la lista de empleados.");
                toast({ variant: "destructive", title: "Error", description: "Fallo al cargar empleados." });
            } finally {
                setLoadingEmployees(false);
            }
        };

        fetchEmployees();
    }, [canViewAll]);

    // 3. Fetch Table Records (Main Table) AND Compute Stats locally
    const fetchRecords = useCallback(async () => {
        setLoadingTable(true);
        try {
            const targetId = canViewAll ? (selectedEmployeeId || null) : empleadoId;

            // Updated View with timestamps
            let query = supabase.from('v_control_horas_extra_ui_nombre_20260125_v7_hhmm_nulls').select('*');

            if (targetId) {
                query = query.eq('empleado_id', targetId);
            }

            if (dateRange?.from) query = query.gte('dia', format(dateRange.from, 'yyyy-MM-dd'));
            if (dateRange?.to) query = query.lte('dia', format(dateRange.to, 'yyyy-MM-dd'));

            const { data: mainData, error } = await query;
            if (error) throw error;

            if (!mainData || mainData.length === 0) {
                setRecords([]);
                setLoadingTable(false);
                return;
            }

            // Fetch employee names if needed
            let employeesMap = new Map();
            const uniqueEmpIds = [...new Set(mainData.map(d => d.empleado_id).filter(Boolean))];

            if (uniqueEmpIds.length > 0) {
                const { data: employeesData } = await supabase
                    .from('empleados')
                    .select('id, nombre, apellidos')
                    .in('id', uniqueEmpIds);
                employeesMap = new Map((employeesData || []).map(e => [e.id, e]));
            }

            const processed = mainData.map(record => {
                const emp = employeesMap.get(record.empleado_id);
                const empName = emp ? `${emp.nombre} ${emp.apellidos || ''}`.trim() : (record.empleado_nombre || 'Desconocido');

                // Values come directly from the view (calculated via DB trigger v4 logic)
                let hTotal = Number(record.horas_total || 0);
                let hExtra = Number(record.horas_extras || 0);
                let hFestivo = Number(record.horas_festivo || 0);
                let hNormal = Number(record.horas_normales || 0);

                let locationLabel = "Taller / Nave Central";
                if (record.proyecto_id) {
                    locationLabel = record.ubicacion_nombre || 'Proyecto sin nombre';
                }

                const tipoDia = record.tipo_dia || 'LABORAL';
                const isFestivo = tipoDia === 'FESTIVO';
                const isWeekend = tipoDia === 'FIN_SEMANA';

                return {
                    ...record,
                    empleado_nombre: empName,
                    horas_normales: hNormal,
                    horas_extra: hExtra,
                    horas_festivo: hFestivo,
                    horas_total: hTotal,
                    es_fin_semana: isWeekend,
                    es_festivo: isFestivo,
                    ubicacion_label: locationLabel,
                    // Prefer raw timestamps if available in view, or parse from 'horario' text
                    hora_entrada: record.hora_entrada_madrid || (record.horario?.split(' - ')[0]?.replace('IN: ', '')) || null,
                    hora_salida: record.hora_salida_madrid || (record.horario?.split(' - ')[1]?.replace('OUT: ', '')) || null
                };
            });

            // Sort descending by date
            processed.sort((a, b) => new Date(b.dia) - new Date(a.dia));
            setRecords(processed);

        } catch (error) {
            console.error("Records Error:", error);
            toast({
                variant: "destructive",
                title: "Error al cargar registros",
                description: error.message
            });
            setRecords([]);
        } finally {
            setLoadingTable(false);
        }
    }, [dateRange, selectedEmployeeId, canViewAll, empleadoId]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    const computedStats = useMemo(() => {
        const stats = {
            normal: 0,
            extra: 0,
            festivo: 0,
            total: 0
        };

        records.forEach(r => {
            stats.normal += r.horas_normales || 0;
            stats.extra += r.horas_extra || 0;
            stats.festivo += r.horas_festivo || 0;
            stats.total += r.horas_total || 0;
        });

        return stats;
    }, [records]);

    const handleExport = () => {
        const exportData = records.map(r => ({
            Fecha: format(new Date(r.dia), 'dd/MM/yyyy'),
            Empleado: r.empleado_nombre,
            'Obra / Ubicación': r.ubicacion_label,
            'Entrada': extractTime(r.hora_entrada),
            'Salida': extractTime(r.hora_salida),
            'Horas Normales': r.horas_normales,
            'Horas Extra': r.horas_extra,
            'Horas Festivas': r.horas_festivo,
            'Total Horas': r.horas_total,
            'Tipo': r.es_festivo ? 'Festivo' : (r.es_fin_semana ? 'Fin de Semana' : 'Laboral')
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Horas");
        XLSX.writeFile(wb, `Horas_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    const handleVerTodos = () => {
        if (selectedEmployeeId === '') return;
        setSelectedEmployeeId('');
        toast({
            title: "Filtro eliminado",
            description: "Mostrando registros de todos los empleados.",
        });
    };

    const handleRowClick = (record) => {
        const params = new URLSearchParams();
        if (record.empleado_nombre) params.set('empleado_search', record.empleado_nombre);
        else if (record.empleado_id) params.set('empleado_id', record.empleado_id);

        if (record.dia) params.set('fecha', record.dia);

        if (record.fichaje_ids && Array.isArray(record.fichaje_ids) && record.fichaje_ids.length > 0) {
            params.set('fichaje_ids', record.fichaje_ids.join(','));
        }

        navigate(`/personal/fichajes-admin?${params.toString()}`);
    };

    return (
        <div className="p-6 w-full">
            <div className="w-full space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Clock className="w-8 h-8 text-primary" />
                        Control de Horas
                    </h1>
                    <div className="flex gap-2">
                        <Button onClick={() => fetchRecords()} variant="outline" size="sm">
                            <RefreshCw className="w-4 h-4 mr-2" /> Actualizar
                        </Button>
                        <Button onClick={handleExport} variant="outline" size="sm">
                            <Download className="w-4 h-4 mr-2" /> Exportar
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border">
                    <div className="flex-1 max-w-sm">
                        <DateRangePicker
                            date={dateRange}
                            setDate={setDateRange}
                        />
                    </div>

                    {/* Employee Selector & VER TODOS (Admin Only) */}
                    {canViewAll && (
                        <div className="flex-1 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center max-w-lg">
                            <div className="flex-1">
                                <Select
                                    value={selectedEmployeeId}
                                    onValueChange={setSelectedEmployeeId}
                                    disabled={loadingEmployees}
                                >
                                    <SelectTrigger className="w-full bg-white">
                                        {loadingEmployees ? (
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span>Cargando empleados...</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                {selectedEmployeeId === '' ? <Users className="h-4 w-4 text-muted-foreground" /> : <User className="h-4 w-4 text-muted-foreground" />}
                                                <SelectValue placeholder="Seleccionar empleado" />
                                            </div>
                                        )}
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">
                                            <span className="font-medium">Todos los usuarios</span>
                                        </SelectItem>
                                        {employees.map((emp) => (
                                            <SelectItem key={emp.id} value={emp.id}>
                                                {emp.nombre} {emp.apellidos}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {employeeFetchError && (
                                    <p className="text-xs text-red-500 mt-1 ml-1">{employeeFetchError}</p>
                                )}
                            </div>

                            <Button
                                onClick={handleVerTodos}
                                variant={selectedEmployeeId === '' ? "secondary" : "default"}
                                className={cn(
                                    "whitespace-nowrap font-bold shadow-sm transition-all min-w-[120px]",
                                    selectedEmployeeId === ''
                                        ? "opacity-60 cursor-default"
                                        : "bg-primary hover:bg-primary/90 text-primary-foreground ring-2 ring-primary/20"
                                )}
                                disabled={selectedEmployeeId === ''}
                                title={selectedEmployeeId === '' ? "Mostrando todos los registros" : "Click para ver todos los empleados"}
                            >
                                {selectedEmployeeId === '' ? (
                                    <>
                                        <Check className="w-4 h-4 mr-2" />
                                        TODOS
                                    </>
                                ) : (
                                    <>
                                        <Eye className="w-4 h-4 mr-2" />
                                        VER TODOS
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </div>

                {/* Summary Statistics - Computed Locally */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="border-l-4 border-l-blue-500">
                        <CardHeader className="pb-2">
                            <CardDescription>Horas Normales</CardDescription>
                            <CardTitle className="text-2xl flex items-baseline gap-2">
                                {formatDecimalToTime(computedStats.normal)}
                            </CardTitle>
                        </CardHeader>
                    </Card>

                    <Card className="border-l-4 border-l-amber-500">
                        <CardHeader className="pb-2">
                            <CardDescription>Horas Extra</CardDescription>
                            <CardTitle className="text-2xl flex items-baseline gap-2">
                                {formatDecimalToTime(computedStats.extra)}
                            </CardTitle>
                        </CardHeader>
                    </Card>

                    <Card className="border-l-4 border-l-purple-500">
                        <CardHeader className="pb-2">
                            <CardDescription>Horas Festivo</CardDescription>
                            <CardTitle className="text-2xl flex items-baseline gap-2">
                                {formatDecimalToTime(computedStats.festivo)}
                            </CardTitle>
                        </CardHeader>
                    </Card>

                    <Card className="border-l-4 border-l-slate-500 bg-slate-50/20">
                        <CardHeader className="pb-2">
                            <CardDescription>Total Periodo</CardDescription>
                            <CardTitle className="text-3xl text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                {formatDecimalToTime(computedStats.total)}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </div>

                {/* Records Table (Main) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Detalle de Registros</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[140px]">Fecha</TableHead>
                                    {canViewAll && <TableHead>Empleado</TableHead>}
                                    <TableHead>Obra / Ubicación</TableHead>
                                    <TableHead className="w-[100px]">Horario (Madrid)</TableHead>
                                    <TableHead className="text-right bg-blue-50 dark:bg-blue-900/10 font-bold text-blue-700 dark:text-blue-400">Horas Normales</TableHead>
                                    <TableHead className="text-right bg-amber-50 dark:bg-amber-900/10 font-bold text-amber-700 dark:text-amber-400">Horas Extra</TableHead>
                                    <TableHead className="text-right bg-purple-50 dark:bg-purple-900/10 font-bold text-purple-700 dark:text-purple-400">Horas Festivo</TableHead>
                                    <TableHead className="text-right font-bold">Total Horas</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingTable ? (
                                    <TableRow>
                                        <TableCell colSpan={canViewAll ? 8 : 7} className="h-32 text-center">
                                            <Loader2 className="w-8 h-8 animate-spin inline text-primary" />
                                            <span className="ml-2">Cargando registros...</span>
                                        </TableCell>
                                    </TableRow>
                                ) : records.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={canViewAll ? 8 : 7} className="h-32 text-center text-muted-foreground">
                                            No se encontraron registros para este filtro.
                                        </TableCell>
                                    </TableRow>
                                ) : records.map((r, idx) => (
                                    <TableRow
                                        key={idx}
                                        className={cn(
                                            "cursor-pointer hover:bg-muted/50 transition-colors",
                                            r.es_festivo ? "bg-purple-50/30 dark:bg-purple-900/5" : (r.es_fin_semana ? "bg-slate-50/50 dark:bg-slate-900/10" : "")
                                        )}
                                        onClick={() => handleRowClick(r)}
                                    >
                                        <TableCell className="font-medium">
                                            {format(new Date(r.dia), 'dd MMM yyyy', { locale: es })}
                                        </TableCell>
                                        {canViewAll && <TableCell>{r.empleado_nombre}</TableCell>}
                                        <TableCell>
                                            <LocationBadge
                                                label={r.ubicacion_label}
                                                onClick={r.proyecto_id ? (e) => {
                                                    e.stopPropagation();
                                                    navigate(`/gestion/obras/${r.proyecto_id}`);
                                                } : undefined}
                                            />
                                        </TableCell>

                                        {/* Horario Column with Madrid Formatting */}
                                        <TableCell className="text-xs">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-green-600 font-bold whitespace-nowrap">
                                                    IN: {extractTime(r.hora_entrada)}
                                                </span>
                                                <span className="text-red-500 font-medium whitespace-nowrap">
                                                    OUT: {extractTime(r.hora_salida)}
                                                </span>
                                            </div>
                                        </TableCell>

                                        <TableCell className="text-right font-mono bg-blue-50/30 dark:bg-blue-900/5 text-blue-700 dark:text-blue-300">
                                            {formatDecimalToTime(r.horas_normales)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono bg-amber-50/30 dark:bg-amber-900/5 text-amber-700 dark:text-amber-300">
                                            {formatDecimalToTime(r.horas_extra)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono bg-purple-50/30 dark:bg-purple-900/5 text-purple-700 dark:text-purple-300">
                                            {formatDecimalToTime(r.horas_festivo)}
                                        </TableCell>
                                        <TableCell className="text-right font-bold font-mono">
                                            {formatDecimalToTime(r.horas_total)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default MyExtrasView;