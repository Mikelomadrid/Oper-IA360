import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Calendar, Euro, Clock, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const EmployeeHorasExtrasTab = ({ employeeId }) => {
    const [month, setMonth] = useState(new Date().getMonth() + 1); // 1-12
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    const months = [
        { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
        { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
        { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
        { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
    ];

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            if (!employeeId) return;
            
            setLoading(true);
            setError(null);
            
            try {
                const { data: result, error: rpcError } = await supabase.rpc('rpc_horas_extras_empleado_mes', {
                    p_empleado_id: employeeId,
                    p_mes: parseInt(month),
                    p_anio: parseInt(year)
                });

                if (rpcError) throw rpcError;

                if (isMounted) {
                    const record = Array.isArray(result) ? result[0] : result;
                    setData(record || {
                        horas_extra_laborable: 0,
                        horas_extra_festivo: 0,
                        importe_extra_laborable: 0,
                        importe_extra_festivo: 0,
                        total_importe: 0
                    });
                }
            } catch (err) {
                console.error("Error fetching overtime data:", err);
                if (isMounted) {
                    setError("No se pudieron cargar los datos de horas extras. Por favor, inténtalo de nuevo.");
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchData();

        return () => { isMounted = false; };
    }, [employeeId, month, year]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    };

    const formatHours = (hours) => {
        return `${Number(hours || 0).toFixed(2)} horas`;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <h3 className="text-lg font-medium flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    Resumen Mensual de Horas Extras
                </h3>
                
                <div className="flex gap-2">
                    {/* Task 3: Ensure Select options are valid and value is controlled properly */}
                    <Select 
                        value={String(month)} 
                        onValueChange={(v) => v && setMonth(parseInt(v))}
                    >
                        <SelectTrigger className="w-[140px]">
                            <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                            <SelectValue placeholder="Mes" />
                        </SelectTrigger>
                        <SelectContent>
                            {months.map(m => (
                                <SelectItem key={m.value} value={String(m.value)}>
                                    {m.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select 
                        value={String(year)} 
                        onValueChange={(v) => v && setYear(parseInt(v))}
                    >
                        <SelectTrigger className="w-[100px]">
                            <SelectValue placeholder="Año" />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map(y => (
                                <SelectItem key={y} value={String(y)}>
                                    {y}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {loading ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
                        <p>Calculando horas extras...</p>
                    </CardContent>
                </Card>
            ) : error ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : !data ? (
                <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                        No hay datos disponibles.
                    </CardContent>
                </Card>
            ) : (
                <>
                    {data.total_importe === 0 || data.total_importe === null ? (
                        <Card className="bg-slate-50 border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-slate-500">
                                <Clock className="w-12 h-12 mb-2 opacity-20" />
                                <p className="text-lg font-medium">No tienes horas extras acumuladas este mes.</p>
                                <p className="text-sm mt-1">Selecciona otro mes para ver el historial.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in zoom-in-95 duration-300">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                        Desglose de Horas
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                        <span className="text-sm font-medium">Laborables</span>
                                        <span className="font-mono font-bold text-lg text-slate-700">
                                            {formatHours(data.horas_extra_laborable)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg border border-amber-100">
                                        <span className="text-sm font-medium text-amber-900">Festivos / Fin de Sem.</span>
                                        <span className="font-mono font-bold text-lg text-amber-700">
                                            {formatHours(data.horas_extra_festivo)}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                        Valoración Económica
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                                        <span>Importe Laborables:</span>
                                        <span>{formatCurrency(data.importe_extra_laborable)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                                        <span>Importe Festivos:</span>
                                        <span>{formatCurrency(data.importe_extra_festivo)}</span>
                                    </div>
                                    
                                    <div className="pt-4 border-t mt-2">
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-lg">Total Acumulado Mes</span>
                                            <div className="flex items-center gap-2 text-primary font-bold text-2xl">
                                                <Euro className="w-6 h-6" />
                                                {formatCurrency(data.total_importe).replace('€', '').trim()} <span className="text-sm">€</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default EmployeeHorasExtrasTab;