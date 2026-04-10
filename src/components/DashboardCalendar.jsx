import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, cn, safeFormat } from '@/lib/utils';
import { Loader2, Calendar as CalendarIcon, AlertCircle, FileSpreadsheet, Filter, Calculator, List } from 'lucide-react';
import { format, isSameDay, parseISO, startOfMonth, endOfMonth, isValid, addMonths, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button, buttonVariants } from '@/components/ui/button';
import { DateRangePicker } from '@/components/DateRangePicker';
import * as XLSX from 'xlsx';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { filterEventsByRole } from '@/utils/calendarPermissions';

const DashboardCalendar = ({ allowedEmails = [] }) => {
    const { sessionRole } = useAuth();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [month, setMonth] = useState(new Date());
    const [expenses, setExpenses] = useState([]);
    const [leadsVisits, setLeadsVisits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUserEmail, setCurrentUserEmail] = useState(null);
    
    const [dateRange, setDateRange] = useState(undefined); 
    const [isCustomRange, setIsCustomRange] = useState(false);

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUserEmail(user?.email);
        };
        fetchUser();
    }, []);

    const canView = useMemo(() => {
        if (!currentUserEmail) return false;
        if (allowedEmails.length === 0) return true;
        return allowedEmails.includes(currentUserEmail);
    }, [currentUserEmail, allowedEmails]);

    const fetchRange = useMemo(() => {
        if (isCustomRange && dateRange?.from) {
            return {
                start: format(dateRange.from, 'yyyy-MM-dd'),
                end: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : format(dateRange.from, 'yyyy-MM-dd')
            };
        }
        return {
            start: format(startOfMonth(month), 'yyyy-MM-dd'),
            end: format(endOfMonth(addMonths(month, 1)), 'yyyy-MM-dd')
        };
    }, [month, dateRange, isCustomRange]);

    useEffect(() => {
        if (!canView) return;
        if (!sessionRole?.rol) return; 

        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Expenses
                const { data: expensesData, error: expensesError } = await supabase
                    .from('gastos')
                    .select('id, fecha_vencimiento, total_con_iva, monto_bruto, iva, numero_factura, estado_pago, proveedor:proveedores(nombre)')
                    .not('fecha_vencimiento', 'is', null)
                    .gte('fecha_vencimiento', fetchRange.start)
                    .lte('fecha_vencimiento', fetchRange.end)
                    .order('fecha_vencimiento', { ascending: true });

                if (expensesError) throw expensesError;
                setExpenses(expensesData || []);

                // 2. Fetch Lead Visits with Owner Info + Auth ID for Mikelo Check
                const { data: leadsData, error: leadsError } = await supabase
                    .from('leads')
                    .select('id, nombre_contacto, nombre_empresa, fecha_visita, direccion, empleado_asignado_id, empleados:empleado_asignado_id(id, rol, auth_user_id)')
                    .not('fecha_visita', 'is', null)
                    .gte('fecha_visita', fetchRange.start + 'T00:00:00')
                    .lte('fecha_visita', fetchRange.end + 'T23:59:59');

                if (leadsError) console.error("Error fetching leads:", leadsError);
                else {
                    // Enrich objects with 'owner' property expected by filter utility
                    const enrichedLeads = (leadsData || []).map(l => ({
                        ...l,
                        owner: l.empleados // { id, rol, auth_user_id }
                    }));
                    
                    // Apply Role-Based Filtering (Includes Mikelo Check)
                    const filteredLeads = filterEventsByRole(enrichedLeads, sessionRole);
                    setLeadsVisits(filteredLeads);
                }

            } catch (error) {
                console.error("Error fetching data for calendar:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [fetchRange, canView, sessionRole]);

    const aggregatedExpenses = useMemo(() => {
        const agg = {};
        expenses.forEach(exp => {
            const dateKey = exp.fecha_vencimiento;
            if (!agg[dateKey]) {
                agg[dateKey] = {
                    total: 0,
                    count: 0,
                    items: [],
                    visits: []
                };
            }
            agg[dateKey].total += (exp.total_con_iva || 0);
            agg[dateKey].count += 1;
            agg[dateKey].items.push(exp);
        });
        
        leadsVisits.forEach(visit => {
            if (!visit.fecha_visita) return;
            const d = parseISO(visit.fecha_visita);
            if (!isValid(d)) return;
            
            const dateKey = format(d, 'yyyy-MM-dd');
            if (!agg[dateKey]) {
                agg[dateKey] = { total: 0, count: 0, items: [], visits: [] };
            }
            agg[dateKey].visits.push(visit);
        });

        return agg;
    }, [expenses, leadsVisits]);

    const totalAmountInRange = useMemo(() => {
        return expenses.reduce((sum, item) => sum + (item.total_con_iva || 0), 0);
    }, [expenses]);

    const expensesGroupedByDate = useMemo(() => {
        if (!isCustomRange) return null;
        const sortedKeys = Object.keys(aggregatedExpenses).sort();
        return sortedKeys.map(dateKey => ({
            date: dateKey,
            ...aggregatedExpenses[dateKey]
        }));
    }, [aggregatedExpenses, isCustomRange]);

    const handleRangeSelect = (range) => {
        setDateRange(range);
        if (range?.from) {
            setIsCustomRange(true);
            setMonth(range.from);
        } else {
            setIsCustomRange(false);
        }
    };

    const handleClearRange = () => {
        setDateRange(undefined);
        setIsCustomRange(false);
        setMonth(new Date());
    };

    const handleMonthChange = (newMonth) => {
        setMonth(newMonth);
    };

    const handleExportExcel = () => {
        try {
            if (expenses.length === 0) {
                toast({ title: "Sin datos", description: "No hay facturas para exportar en el rango seleccionado.", variant: "warning" });
                return;
            }

            const exportData = expenses.map(item => ({
                'Fecha Vencimiento': safeFormat(item.fecha_vencimiento, 'dd/MM/yyyy'),
                'Proveedor': item.proveedor?.nombre || 'Desconocido',
                'Nº Factura': item.numero_factura,
                'Estado': item.estado_pago,
                'Base Imponible': item.monto_bruto,
                'IVA': (item.iva * 100) + '%',
                'Total': item.total_con_iva
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Vencimientos");
            
            const colWidths = [
                { wch: 15 },
                { wch: 30 },
                { wch: 20 },
                { wch: 15 },
                { wch: 15 },
                { wch: 10 },
                { wch: 15 },
            ];
            ws['!cols'] = colWidths;

            const fileName = `Vencimientos_${fetchRange.start}_al_${fetchRange.end}.xlsx`;
            XLSX.writeFile(wb, fileName);

            toast({ title: "Exportación Exitosa", description: `Archivo ${fileName} descargado.` });
        } catch (error) {
            console.error("Export error:", error);
            toast({ title: "Error", description: "Fallo al exportar excel.", variant: "destructive" });
        }
    };

    const activeDates = Object.keys(aggregatedExpenses).map(d => parseISO(d)).filter(d => isValid(d));
    
    const modifiers = {
        hasData: activeDates,
        inRange: (date) => {
            if (!isCustomRange || !dateRange?.from) return false;
            const start = startOfDay(dateRange.from);
            const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
            return isWithinInterval(date, { start, end });
        }
    };

    const modifiersStyles = {
        hasData: { 
            fontWeight: 'bold',
        }
    };

    const modifiersClassNames = {
        inRange: "bg-red-50 text-red-900 rounded-none first:rounded-l-md last:rounded-r-md border-y border-red-100"
    };

    const dayContent = (day) => {
        if (!isValid(day)) return null;
        const dateKey = format(day, 'yyyy-MM-dd');
        const data = aggregatedExpenses[dateKey];

        return (
            <div className="w-full h-full flex flex-col items-center justify-start pt-1 relative z-10 min-h-[40px]">
                <span>{format(day, 'd')}</span>
                {data && (
                    <div className="flex gap-1 mt-1 justify-center items-center flex-wrap max-w-full px-1">
                        {data.total > 0 && (
                            <span className="text-[10px] font-bold text-red-600 bg-white/80 px-1 rounded border border-red-100 shadow-sm leading-tight">
                                {formatCurrency(data.total)}
                            </span>
                        )}
                        {data.visits.length > 0 && (
                            <span className="h-2 w-2 rounded-full bg-blue-500 ring-1 ring-white" title={`${data.visits.length} Visitas`} />
                        )}
                    </div>
                )}
            </div>
        );
    };

    if (!canView) return null;

    const selectedDayData = selectedDate && isValid(selectedDate) ? aggregatedExpenses[format(selectedDate, 'yyyy-MM-dd')] : null;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="flex items-center gap-2 flex-1">
                    <Filter className="w-5 h-5 text-muted-foreground" />
                    <DateRangePicker 
                        date={dateRange}
                        setDate={handleRangeSelect}
                        onClear={handleClearRange}
                        className="w-full md:w-[300px]"
                    />
                    {isCustomRange && (
                        <Badge variant="secondary" className="hidden md:inline-flex">Filtro Activo</Badge>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-md">
                        <Calculator className="w-4 h-4 text-red-600 dark:text-red-400" />
                        <span className="text-sm font-medium text-red-800 dark:text-red-300">Total en rango:</span>
                        <span className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(totalAmountInRange)}</span>
                    </div>
                    
                    <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-green-600" />
                        Exportar Excel
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <Card className="lg:col-span-8 shadow-md border-t-4 border-t-red-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-red-700">
                            <CalendarIcon className="w-5 h-5" />
                            Calendario de Vencimientos
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center p-4">
                        {loading && expenses.length === 0 ? (
                            <div className="h-64 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-red-500" />
                            </div>
                        ) : (
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={setSelectedDate}
                                month={month}
                                onMonthChange={handleMonthChange}
                                locale={es}
                                numberOfMonths={2}
                                className="rounded-md border shadow-sm p-4 w-full"
                                classNames={{
                                    months: "flex flex-col xl:flex-row space-y-4 xl:space-x-4 xl:space-y-0 w-full",
                                    month: "space-y-4 w-full",
                                    table: "w-full border-collapse space-y-1",
                                    head_row: "flex w-full",
                                    head_cell: "text-muted-foreground rounded-md w-full font-normal text-[0.8rem]",
                                    row: "flex w-full mt-2",
                                    cell: "h-auto w-full text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                                    day: cn(
                                        buttonVariants({ variant: "ghost" }),
                                        "h-auto min-h-[50px] w-full p-1 font-normal aria-selected:opacity-100 hover:bg-red-100 hover:text-red-900"
                                    ),
                                    caption: "flex justify-center pt-1 relative items-center w-full",
                                }}
                                modifiers={modifiers}
                                modifiersStyles={modifiersStyles}
                                modifiersClassNames={modifiersClassNames}
                                components={{
                                    DayContent: ({ date: d }) => dayContent(d)
                                }}
                            />
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-4 shadow-md flex flex-col h-full max-h-[600px]">
                    <CardHeader className="bg-red-50/50 pb-4 border-b">
                        <CardTitle className="text-lg flex justify-between items-center">
                            {isCustomRange ? (
                                <span className="flex items-center gap-2">
                                    <List className="w-5 h-5" />
                                    Resumen del Rango
                                </span>
                            ) : (
                                <span>{safeFormat(selectedDate, "d 'de' MMMM")}</span>
                            )}
                            
                            {!isCustomRange && selectedDate && isSameDay(selectedDate, new Date()) && <Badge variant="outline" className="ml-2 bg-background">Hoy</Badge>}
                        </CardTitle>
                        {isCustomRange && dateRange?.from && (
                            <div className="text-xs text-muted-foreground mt-1">
                                {safeFormat(dateRange.from, 'dd/MM/yyyy')} - {safeFormat(dateRange.to || dateRange.from, 'dd/MM/yyyy')}
                            </div>
                        )}
                    </CardHeader>
                    <ScrollArea className="flex-1">
                        <CardContent className="p-4 space-y-4">
                            {isCustomRange ? (
                                expensesGroupedByDate && expensesGroupedByDate.length > 0 ? (
                                    <div className="space-y-6">
                                        {expensesGroupedByDate.map((group) => (
                                            <div key={group.date} className="space-y-2">
                                                <div className="flex items-center gap-2 border-b pb-1">
                                                    <span className="text-sm font-bold text-red-700">
                                                        {safeFormat(group.date, "dd/MM/yyyy")}
                                                    </span>
                                                    <Badge variant="secondary" className="text-[10px] h-5 px-1">{formatCurrency(group.total)}</Badge>
                                                </div>
                                                <div className="space-y-2 pl-2">
                                                    {group.items.map((item) => (
                                                        <div key={item.id} className="flex justify-between items-center text-sm p-2 bg-card border rounded hover:bg-accent/50 transition">
                                                            <div className="flex flex-col overflow-hidden">
                                                                <span className="font-medium truncate pr-2">{item.proveedor?.nombre || 'Proveedor Desconocido'}</span>
                                                                <span className="text-xs text-muted-foreground">{item.numero_factura}</span>
                                                            </div>
                                                            <span className="font-bold text-red-600 whitespace-nowrap">{formatCurrency(item.total_con_iva)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-10 text-muted-foreground">
                                        <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                        <p>No hay facturas en este rango.</p>
                                    </div>
                                )
                            ) : (
                                <>
                                    {!selectedDate ? (
                                        <div className="text-center py-10 text-muted-foreground">
                                            <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                            <p>Selecciona un día para ver los vencimientos.</p>
                                        </div>
                                    ) : (!selectedDayData || (selectedDayData.items.length === 0 && selectedDayData.visits.length === 0)) ? (
                                        <div className="text-center py-10 text-muted-foreground">
                                            <p>No hay eventos para este día.</p>
                                        </div>
                                    ) : (
                                        <>
                                            {selectedDayData.total > 0 && (
                                                <div className="p-3 bg-red-100 rounded-lg border border-red-200 flex justify-between items-center mb-4">
                                                    <span className="text-sm font-medium text-red-800">Total Día:</span>
                                                    <span className="text-lg font-bold text-red-700">{formatCurrency(selectedDayData.total)}</span>
                                                </div>
                                            )}

                                            {selectedDayData.visits.length > 0 && (
                                                <div className="mb-4">
                                                    <h4 className="text-xs font-semibold text-blue-600 mb-2 uppercase tracking-wider">Visitas ({selectedDayData.visits.length})</h4>
                                                    <div className="space-y-2">
                                                        {selectedDayData.visits.map((visit) => (
                                                            <div key={visit.id} className="p-2 border border-blue-200 bg-blue-50 rounded text-sm flex flex-col gap-1">
                                                                <span className="font-bold text-blue-800">{visit.nombre_contacto || visit.nombre_empresa}</span>
                                                                <div className="flex justify-between text-xs text-blue-700/70">
                                                                    <span className="truncate">{visit.direccion}</span>
                                                                    <span>{safeFormat(visit.fecha_visita, 'HH:mm')}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {selectedDayData.items.length > 0 && (
                                                <div className="space-y-3">
                                                    {selectedDayData.items.map((item) => (
                                                        <div key={item.id} className="p-3 rounded-lg border bg-card hover:bg-accent/10 transition-colors flex flex-col gap-1">
                                                            <div className="flex justify-between items-start">
                                                                <span className="font-semibold text-sm truncate pr-2">{item.proveedor?.nombre || 'Proveedor Desconocido'}</span>
                                                                <span className="font-bold text-red-600 text-sm">{formatCurrency(item.total_con_iva)}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                                                <span>Factura: {item.numero_factura}</span>
                                                                <Badge variant="outline" className="text-[10px] h-5">{item.estado_pago}</Badge>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </ScrollArea>
                </Card>
            </div>
        </div>
    );
};

export default DashboardCalendar;