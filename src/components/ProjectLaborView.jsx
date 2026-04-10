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

const ProjectLaborView = ({ projectId }) => {
    // Fetch data from 'ui_v_proyecto_mano_obra_detalle_v2'
    // This view is highly detailed and fits the requirement perfectly.
    const { data: laborDetails, isLoading, error } = useQuery({
        queryKey: ['project_labor_grouped', projectId],
        queryFn: async () => {
            if (!projectId) return [];
            
            const { data, error } = await supabase
                .from('ui_v_proyecto_mano_obra_detalle_v2')
                .select('*')
                .eq('proyecto_id', projectId)
                .order('empleado', { ascending: true }) // First group by employee name
                .order('dia', { ascending: false });    // Then sort by date
            
            if (error) throw error;
            return data || [];
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
                            <p className="text-2xl font-bold text-foreground">{globalTotalHours.toFixed(2)} h</p>
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
                                <span className="font-bold">{data.totalHours.toFixed(2)}h</span>
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
                                                    <span>{Number(record.horas_normales).toFixed(2)}</span>
                                                ) : <span className="text-muted-foreground/30">-</span>}
                                            </TableCell>
                                            <TableCell className="text-right text-sm">
                                                {Number(record.horas_extras || 0) > 0 ? (
                                                    <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200">
                                                        +{Number(record.horas_extras).toFixed(2)}
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