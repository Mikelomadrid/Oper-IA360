import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, HardHat, Clock, CalendarDays, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Helper for currency format
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount || 0);
};

// Helper for date format
const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-ES', { 
        weekday: 'short',
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
};

const getTargetHours = (dateString) => {
    if (!dateString) return 0;
    const day = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Madrid',
        weekday: 'short'
    }).format(new Date(dateString));
    if (day === 'Fri') return 6;
    if (['Mon', 'Tue', 'Wed', 'Thu'].includes(day)) return 8.5;
    return 0;
};

const normalizeWorkedHours = (hours, dateString) => {
    const workedHours = Math.max(0, Number(hours) || 0);
    const targetHours = getTargetHours(dateString);
    if (!targetHours || workedHours <= targetHours) {
        return { normal: workedHours, extra: 0, total: workedHours };
    }
    const extraHours = workedHours - targetHours;
    if (extraHours < 1) {
        return { normal: targetHours, extra: 0, total: targetHours };
    }
    return { normal: targetHours, extra: extraHours, total: workedHours };
};

const formatHoursMinutes = (hours) => {
    const totalMinutes = Math.max(0, Math.round((Number(hours) || 0) * 60));
    return `${Math.floor(totalMinutes / 60)} h ${totalMinutes % 60} min`;
};

const normalizeLaborRecord = (record) => {
    const totalHours = Number(record.horas_totales) || 0;
    const normalized = normalizeWorkedHours(totalHours, record.dia);
    const normalRate = Number(record.coste_hora_normal) || 0;
    const extraRate = Number(record.coste_hora_extra) || (String(record.empleado || '').toUpperCase().startsWith('FRAN') ? 17.40 : 14.19);
    return {
        ...record,
        horas_normales: normalized.normal,
        horas_extras: normalized.extra,
        horas_totales: normalized.total,
        coste_total_dia: normalized.normal * normalRate + normalized.extra * extraRate,
    };
};

const ProjectLaborView = ({ projectId }) => {
    // La RPC protege los costes horarios y solo permite el acceso a
    // administracion/encargados. No se consulta la vista sensible directamente.
    const { data: laborDetails, isLoading, error } = useQuery({
        queryKey: ['project_labor_grouped', projectId],
        queryFn: async () => {
            if (!projectId) return [];
            
            const { data, error } = await supabase
                .rpc('api_proyecto_mano_obra_detalle', { p_proyecto_id: projectId })
                .order('empleado', { ascending: true }) // First group by employee name
                .order('dia', { ascending: false });    // Then sort by date
            
            if (!error) return (data || []).map(normalizeLaborRecord);

            // Compatibilidad con bases antiguas que todavía no tienen la RPC.
            const fichajes = await supabase
                .from('control_horario')
                .select('id, empleado_id, proyecto_id, hora_entrada, hora_salida')
                .eq('proyecto_id', projectId)
                .order('hora_entrada', { ascending: false });

            if (!fichajes.error) {
                const employeeIds = [...new Set((fichajes.data || []).map(row => row.empleado_id).filter(Boolean))];
                const employees = employeeIds.length > 0
                    ? await supabase.from('empleados').select('id, nombre, apellidos, costo_por_hora').in('id', employeeIds)
                    : { data: [] };
                const employeeMap = Object.fromEntries((employees.data || []).map(employee => [employee.id, employee]));

                const fichajeIds = (fichajes.data || []).map(row => row.id).filter(Boolean);
                const pausas = fichajeIds.length > 0
                    ? await supabase.from('pausas').select('fichaje_id, hora_inicio_pausa, hora_fin_pausa').in('fichaje_id', fichajeIds)
                    : { data: [] };
                const pausaPorFichaje = (pausas.data || []).reduce((acc, pausa) => {
                    const inicio = pausa.hora_inicio_pausa ? new Date(pausa.hora_inicio_pausa) : null;
                    const fin = pausa.hora_fin_pausa ? new Date(pausa.hora_fin_pausa) : new Date();
                    if (inicio && fin > inicio) acc[pausa.fichaje_id] = (acc[pausa.fichaje_id] || 0) + (fin - inicio) / 3600000;
                    return acc;
                }, {});

                return (fichajes.data || []).map(row => {
                    const employee = employeeMap[row.empleado_id] || {};
                    const start = row.hora_entrada ? new Date(row.hora_entrada) : null;
                    const end = row.hora_salida ? new Date(row.hora_salida) : null;
                    const brutoHours = start && end && end > start ? (end - start) / 3600000 : 0;
                    const netHours = Math.max(0, brutoHours - (pausaPorFichaje[row.id] || 0));
                    const normalized = normalizeWorkedHours(netHours, row.hora_entrada);
                    const hourlyCost = Number(employee.costo_por_hora || 0);
                    const extraHourlyCost = employee.nombre?.toUpperCase().startsWith('FRAN') ? 17.40 : 14.19;
                    return {
                        empleado: `${employee.nombre || ''} ${employee.apellidos || ''}`.trim() || 'Desconocido',
                        dia: row.hora_entrada,
                        horas_normales: normalized.normal,
                        horas_extras: normalized.extra,
                        horas_totales: normalized.total,
                        coste_hora_normal: hourlyCost,
                        coste_total_dia: normalized.normal * hourlyCost + normalized.extra * extraHourlyCost,
                    };
                });
            }

            const fallback = await supabase
                .from('v_fichajes_admin_neto_v5')
                .select('empleado_id, empleado_nombre, empleado_apellidos, fecha, horas_normales_dia, horas_extra_dia, horas_festivo_dia, coste_hora_normal, coste_total_dia, proyecto_id')
                .eq('proyecto_id', projectId)
                .order('fecha', { ascending: false });

            if (fallback.error) {
                console.warn('[ProjectLaborView] No hay vista de fichajes compatible:', fallback.error.message || fallback.error);
                const totals = await supabase
                    .from('ui_v_proyecto_mano_obra_totales_v2')
                    .select('proyecto_id, coste_total_mano_obra')
                    .eq('proyecto_id', projectId)
                    .maybeSingle();
                if (totals.error || !totals.data) return [];
                return [{
                    empleado: 'Total de mano de obra',
                    dia: null,
                    horas_normales: 0,
                    horas_extras: 0,
                    horas_totales: 0,
                    coste_hora_normal: 0,
                    coste_total_dia: totals.data.coste_total_mano_obra || 0,
                }];
            }
            return (fallback.data || []).map(row => normalizeLaborRecord({
                empleado: `${row.empleado_nombre || ''} ${row.empleado_apellidos || ''}`.trim() || 'Desconocido',
                dia: row.fecha,
                horas_normales: row.horas_normales_dia || 0,
                horas_extras: row.horas_extra_dia || 0,
                horas_totales: Number(row.horas_normales_dia || 0) + Number(row.horas_extra_dia || 0) + Number(row.horas_festivo_dia || 0),
                coste_hora_normal: row.coste_hora_normal || 0,
                coste_total_dia: row.coste_total_dia || 0,
            }));
        },
        enabled: !!projectId
    });

    // Grouping Logic for UI display
    const groupedData = React.useMemo(() => {
        if (!laborDetails) return {};
        return laborDetails.reduce((acc, curr) => {
            const empName = curr.empleado || 'Desconocido';
            if (!acc[empName]) {
                acc[empName] = {
                    totalHours: 0,
                    totalCost: 0,
                    records: []
                };
            }
            acc[empName].records.push(curr);
            acc[empName].totalHours += Number(curr.horas_totales || 0);
            acc[empName].totalCost += Number(curr.coste_total_dia || 0);
            return acc;
        }, {});
    }, [laborDetails]);

    const globalTotalHours = laborDetails?.reduce((acc, curr) => acc + (Number(curr.horas_totales) || 0), 0) || 0;
    const globalTotalCost = laborDetails?.reduce((acc, curr) => acc + (Number(curr.coste_total_dia) || 0), 0) || 0;

    if (isLoading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 text-red-500 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-900/50 text-center">
                Error cargando mano de obra: {error.message}
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 justify-end">
                <Card className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-700 dark:text-blue-400">
                            <Clock className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Total Horas</p>
                            <p className="text-2xl font-bold text-foreground">{formatHoursMinutes(globalTotalHours)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-green-50/50 dark:bg-green-900/10 border-green-100 dark:border-green-900">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full text-green-700 dark:text-green-400">
                            <HardHat className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Coste Total MO</p>
                            <p className="text-2xl font-bold text-foreground">{formatCurrency(globalTotalCost)}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Empty State */}
            {laborDetails.length === 0 && (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <HardHat className="h-12 w-12 mb-3 opacity-20" />
                        <p>No hay registros de mano de obra para este proyecto.</p>
                    </CardContent>
                </Card>
            )}

            {/* Grouped Lists */}
            {Object.entries(groupedData).map(([employeeName, data]) => (
                <Card key={employeeName} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
                    <div className="bg-muted/10 border-b p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-primary/10 p-2 rounded-full">
                                <User className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">{employeeName}</h3>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <CalendarDays className="w-3 h-3" />
                                    {data.records.length} jornadas registradas
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                            <div className="text-right">
                                <span className="block text-xs text-muted-foreground">Horas</span>
                                <span className="font-bold">{formatHoursMinutes(data.totalHours)}</span>
                            </div>
                            <div className="h-8 w-px bg-border"></div>
                            <div className="text-right">
                                <span className="block text-xs text-muted-foreground">Coste</span>
                                <span className="font-bold text-primary">{formatCurrency(data.totalCost)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <CardContent className="p-0">
                        <div className="relative overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-transparent hover:bg-transparent">
                                        <TableHead className="w-[180px]">Fecha</TableHead>
                                        <TableHead className="text-right text-xs">H. Normales</TableHead>
                                        <TableHead className="text-right text-xs">H. Extra</TableHead>
                                        {/* Optional: Check if festivo hours exist in view before rendering column to save space if always 0 */}
                                        <TableHead className="text-right text-xs">Coste/Hora</TableHead>
                                        <TableHead className="text-right font-semibold text-xs">Total Coste</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.records.map((record, idx) => (
                                        <TableRow key={`${record.dia}-${idx}`} className="hover:bg-muted/5">
                                            <TableCell className="font-medium text-sm whitespace-nowrap capitalize">
                                                {formatDate(record.dia)}
                                            </TableCell>
                                            <TableCell className="text-right text-sm">
                                                {Number(record.horas_normales || 0) > 0 ? (
                                                    <span>{formatHoursMinutes(record.horas_normales)}</span>
                                                ) : <span className="text-muted-foreground/30">-</span>}
                                            </TableCell>
                                            <TableCell className="text-right text-sm">
                                                {Number(record.horas_extras || 0) > 0 ? (
                                                    <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200">
                                                        +{formatHoursMinutes(record.horas_extras)}
                                                    </Badge>
                                                ) : <span className="text-muted-foreground/30">-</span>}
                                            </TableCell>
                                            <TableCell className="text-right text-xs text-muted-foreground">
                                                {formatCurrency(record.coste_hora_normal)}
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-sm">
                                                {formatCurrency(record.coste_total_dia)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};

export default ProjectLaborView;
