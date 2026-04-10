import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, CalendarClock, Info } from 'lucide-react';

const EmployeeHistoryTab = ({ employeeId }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!employeeId) return;
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('ausencias_empleados')
                    .select(`
                        *,
                        admin:admin_id (nombre, apellidos)
                    `)
                    .eq('empleado_id', employeeId)
                    .order('fecha_inicio', { ascending: false });

                if (error) throw error;
                setHistory(data || []);
            } catch (error) {
                console.error('Error fetching history:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [employeeId]);

    const getBadgeVariant = (type) => {
        const t = type?.toLowerCase() || '';
        if (t.includes('vacaciones')) return 'success';
        if (t.includes('baja')) return 'destructive';
        if (t.includes('permiso')) return 'info';
        return 'secondary';
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (history.length === 0) {
        return (
            <div className="text-center p-12 bg-muted/30 border rounded-xl flex flex-col items-center justify-center">
                <div className="bg-muted p-4 rounded-full mb-4">
                    <CalendarClock className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-medium text-foreground">Sin historial de ausencias</h3>
                <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs">
                    No hay registros de vacaciones, bajas u otras ausencias para este empleado.
                </p>
            </div>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <CalendarClock className="w-5 h-5" />
                    Historial de Ausencias
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="w-[140px]">Tipo</TableHead>
                                <TableHead className="w-[200px]">Periodo</TableHead>
                                <TableHead className="w-[100px]">Duración</TableHead>
                                <TableHead>Notas</TableHead>
                                <TableHead className="text-right">Registrado por</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {history.map((item) => {
                                const start = new Date(item.fecha_inicio);
                                const end = new Date(item.fecha_fin);
                                const days = differenceInCalendarDays(end, start) + 1;
                                
                                return (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <Badge variant={getBadgeVariant(item.tipo)} className="uppercase text-[10px] px-2">
                                                {item.tipo.replace(/_/g, ' ')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-medium text-sm">
                                            <div className="flex flex-col">
                                                <span>{format(start, 'dd MMM yyyy', { locale: es })}</span>
                                                <span className="text-xs text-muted-foreground">hasta {format(end, 'dd MMM yyyy', { locale: es })}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <span className="font-bold">{days}</span>
                                                <span className="text-xs text-muted-foreground">días</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {item.notas ? (
                                                <span className="text-sm text-muted-foreground">{item.notas}</span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">- Sin notas -</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className="font-medium text-foreground">
                                                    {item.admin ? `${item.admin.nombre} ${item.admin.apellidos || ''}` : 'Sistema/Admin'}
                                                </span>
                                                <span>{format(new Date(item.created_at), 'dd/MM/yy HH:mm')}</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
                <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground bg-blue-50/50 p-3 rounded-md border border-blue-100">
                    <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                    <p>Este listado muestra el historial completo de ausencias registradas (vacaciones, bajas, permisos). Los días mostrados son naturales.</p>
                </div>
            </CardContent>
        </Card>
    );
};

export default EmployeeHistoryTab;