import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, ArrowUpDown, Calendar, Clock, MapPin } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDecimalHoursToHoursMinutes, formatSecondsToHoursMinutes, toMadridTime } from '@/lib/utils';

export default function EmployeeFichajesTable({ employeeId }) {
    const [fichajes, setFichajes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'

    useEffect(() => {
        let isMounted = true;

        const fetchFichajes = async () => {
            if (!employeeId) return;
            setLoading(true);
            setError(null);

            try {
                // Fetch basic data from the view
                const { data, error } = await supabase
                    .from('v_fichajes_admin_neto_v5')
                    .select('*')
                    .eq('empleado_id', employeeId)
                    .order('fecha', { ascending: sortOrder === 'asc' })
                    .order('hora_entrada', { ascending: sortOrder === 'asc' }) // Secondary sort by time
                    .limit(100); // Limit to last 100 records for performance

                if (error) throw error;

                if (isMounted) {
                    setFichajes(data || []);
                }
            } catch (err) {
                console.error("Error fetching fichajes:", err);
                if (isMounted) setError("No se pudieron cargar los fichajes.");
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchFichajes();

        return () => {
            isMounted = false;
        };
    }, [employeeId, sortOrder]);

    const toggleSort = () => {
        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    };

    // Use utils helper for consistent Madrid Time
    const formatTime = (timeStr) => {
        return toMadridTime(timeStr);
    };

    const formatDateSafe = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return isValid(date) ? format(date, 'dd/MM/yyyy', { locale: es }) : '-';
    };

    const getStatusBadge = (row) => {
        if (!row.hora_salida) {
            return <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200">En curso</Badge>;
        }
        return <Badge variant="outline" className="text-gray-500 font-normal">Cerrado</Badge>;
    };

    const formatDuration = (seconds) => {
        if (!seconds && seconds !== 0) return '-';
        return formatSecondsToHoursMinutes(seconds);
    };

    if (loading) {
        return (
            <Card className="w-full shadow-sm border rounded-xl">
                <CardContent className="p-8 flex justify-center items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                    <span className="ml-3 text-muted-foreground">Cargando historial de fichajes...</span>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="w-full shadow-sm border rounded-xl border-red-100 bg-red-50/20">
                <CardContent className="p-6 flex items-center text-red-600">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    {error}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full shadow-md border rounded-xl overflow-hidden mt-6">
            <CardHeader className="bg-muted/30 border-b pb-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <Clock className="h-5 w-5 text-primary" />
                            Detalle de Fichajes
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Historial reciente de entradas y salidas del empleado
                        </p>
                    </div>
                    <Badge variant="outline" className="bg-background">
                        {fichajes.length} registros
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="max-h-[500px] overflow-auto">
                    <Table>
                        <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                            <TableRow>
                                <TableHead className="w-[140px]">
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={toggleSort}
                                        className="-ml-3 h-8 text-xs font-bold hover:bg-muted"
                                    >
                                        Fecha
                                        <ArrowUpDown className="ml-2 h-3 w-3" />
                                    </Button>
                                </TableHead>
                                <TableHead className="min-w-[180px]">Ubicación / Proyecto</TableHead>
                                <TableHead className="w-[100px] text-center">Horario (Madrid)</TableHead>
                                <TableHead className="w-[100px] text-right">Duración</TableHead>
                                <TableHead className="w-[100px] text-right bg-blue-50/30 dark:bg-blue-900/10" title="Total diario de horas normales">
                                    Normal (Día)
                                </TableHead>
                                <TableHead className="w-[100px] text-right bg-amber-50/30 dark:bg-amber-900/10" title="Total diario de horas extra">
                                    Extra (Día)
                                </TableHead>
                                <TableHead className="w-[100px] text-right bg-purple-50/30 dark:bg-purple-900/10" title="Total diario de horas festivas">
                                    Festivo (Día)
                                </TableHead>
                                <TableHead className="w-[100px] text-center">Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fichajes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                        No hay registros de fichajes disponibles.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                fichajes.map((f) => (
                                    <TableRow key={f.id} className="hover:bg-muted/50 transition-colors">
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                {formatDateSafe(f.fecha)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-start gap-2 max-w-[250px]">
                                                <MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                                                <span className="truncate text-sm" title={f.nombre_proyecto || f.nombre_centro_coste}>
                                                    {f.nombre_proyecto || f.nombre_centro_coste || 'Sin ubicación'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center text-xs">
                                            <div className="flex flex-col items-center">
                                                <span className="text-green-600 font-medium">{formatTime(f.hora_entrada)}</span>
                                                <span className="text-muted-foreground text-[10px]">a</span>
                                                <span className={f.hora_salida ? "text-red-500 font-medium" : "text-muted-foreground"}>
                                                    {f.hora_salida ? formatTime(f.hora_salida) : '...'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                            {formatDuration(f.duracion_neta_segundos)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm text-blue-600 bg-blue-50/10">
                                            {formatDecimalHoursToHoursMinutes(f.horas_normales_dia)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm text-amber-600 bg-amber-50/10 font-medium">
                                            {formatDecimalHoursToHoursMinutes(f.horas_extra_dia)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm text-purple-600 bg-purple-50/10 font-medium">
                                            {formatDecimalHoursToHoursMinutes(f.horas_festivo_dia)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {getStatusBadge(f)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}