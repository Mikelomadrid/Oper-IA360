import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Download, FileSpreadsheet } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, addDays, getMonth, getYear, isWithinInterval, areIntervalsOverlapping, differenceInMinutes, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const NIGHT_SHIFT_START_HOUR = 22;
const NIGHT_SHIFT_END_HOUR = 6;
const NIGHT_SHIFT_RATE = 1.80;

const EmployeeMonthlyReportModal = ({ isOpen, onClose }) => {
    const [month, setMonth] = useState(getMonth(new Date()).toString());
    const [year, setYear] = useState(getYear(new Date()).toString());
    const [loading, setLoading] = useState(false);
    const [includeInactive, setIncludeInactive] = useState(false);

    const years = Array.from({ length: 5 }, (_, i) => (getYear(new Date()) - 2 + i).toString());
    const months = [
        { value: '0', label: 'Enero' }, { value: '1', label: 'Febrero' }, { value: '2', label: 'Marzo' },
        { value: '3', label: 'Abril' }, { value: '4', label: 'Mayo' }, { value: '5', label: 'Junio' },
        { value: '6', label: 'Julio' }, { value: '7', label: 'Agosto' }, { value: '8', label: 'Septiembre' },
        { value: '9', label: 'Octubre' }, { value: '10', label: 'Noviembre' }, { value: '11', label: 'Diciembre' }
    ];

    const calculateNightHours = (entry, exit, pauses = []) => {
        if (!entry || !exit) return 0;
        const entryDate = new Date(entry);
        const exitDate = new Date(exit);
        
        let totalNightMinutes = 0;
        let current = new Date(entryDate);

        // Iterate minute by minute (simple and robust for crossing midnight and complex pauses)
        while (current < exitDate) {
            const nextMinute = new Date(current.getTime() + 60000);
            if (nextMinute > exitDate) break;

            // Check if this minute is within a pause
            const isPaused = pauses.some(p => {
                const pStart = new Date(p.hora_inicio_pausa);
                const pEnd = p.hora_fin_pausa ? new Date(p.hora_fin_pausa) : new Date(); // Treat open pause as ongoing
                return current >= pStart && current < pEnd;
            });

            if (!isPaused) {
                const hour = current.getHours();
                // Night shift: 22:00 (22) to 06:00 (6)
                if (hour >= NIGHT_SHIFT_START_HOUR || hour < NIGHT_SHIFT_END_HOUR) {
                    totalNightMinutes++;
                }
            }
            current = nextMinute;
        }

        return totalNightMinutes / 60;
    };

    const generateReport = async () => {
        setLoading(true);
        try {
            const startDate = startOfMonth(new Date(parseInt(year), parseInt(month)));
            const endDate = endOfMonth(startDate);

            // 0. Fetch Holidays for the period
            const { data: holidaysData, error: holError } = await supabase
                .from('calendario_festivos')
                .select('fecha')
                .gte('fecha', format(startDate, 'yyyy-MM-dd'))
                .lte('fecha', format(endDate, 'yyyy-MM-dd'));

            if (holError) throw holError;
            
            const holidaysSet = new Set(holidaysData?.map(h => h.fecha) || []);

            // Calculate Theoretical Hours per month based on schedule
            let standardMonthlyHours = 0;
            const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

            daysInMonth.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                
                // Skip weekends and holidays
                if (isWeekend(day) || holidaysSet.has(dateStr)) {
                    return;
                }

                const dayOfWeek = day.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
                
                // Friday (5): 08:30-14:30 (6h)
                if (dayOfWeek === 5) {
                    standardMonthlyHours += 6;
                } 
                // Monday-Thursday (1-4): 08:30-14:00 + 15:00-18:00 (8.5h)
                else if (dayOfWeek >= 1 && dayOfWeek <= 4) {
                    standardMonthlyHours += 8.5;
                }
            });

            // 1. Fetch Employees
            let empQuery = supabase.from('empleados').select('id, nombre, apellidos, dni_nie, costo_por_hora, activo, auth_user_id');
            if (!includeInactive) {
                empQuery = empQuery.eq('activo', true);
            }
            const { data: employees, error: empError } = await empQuery;
            if (empError) throw empError;

            // 2. Fetch Time Clock Data (Fichajes + Pausas)
            const { data: fichajes, error: fichError } = await supabase
                .from('control_horario')
                .select(`
                    *,
                    pausas (*)
                `)
                .gte('hora_entrada', startDate.toISOString())
                .lte('hora_entrada', endDate.toISOString()); // Assuming shift belongs to the day it started
            
            if (fichError) throw fichError;

            // 3. Fetch Absences
            const { data: ausencias, error: ausError } = await supabase
                .from('ausencias_empleados')
                .select('*')
                .lte('fecha_inicio', format(endDate, 'yyyy-MM-dd'))
                .gte('fecha_fin', format(startDate, 'yyyy-MM-dd'));

            if (ausError) throw ausError;

            // 4. Fetch Anticipos (Advances)
            const { data: anticipos, error: antError } = await supabase
                .from('anticipos_nomina')
                .select('*')
                .gte('fecha_solicitud', format(startDate, 'yyyy-MM-dd'))
                .lte('fecha_solicitud', format(endDate, 'yyyy-MM-dd'))
                .neq('estado', 'rechazado'); // Include pending and approved/descontado

            if (antError) throw antError;

            // 5. Fetch Active Embargos
            const { data: embargos, error: embError } = await supabase
                .from('embargos')
                .select('*')
                .eq('estado', 'activo'); 

            if (embError) throw embError;

            // 6. Process Data per Employee
            const reportData = employees.map(emp => {
                // --- Time Calculations ---
                const empFichajes = fichajes.filter(f => f.empleado_id === emp.id || f.empleado_id === emp.auth_user_id);
                
                let totalWorkedHours = 0;
                let totalNightHours = 0;

                empFichajes.forEach(f => {
                    if (f.hora_entrada && f.hora_salida) {
                        const start = new Date(f.hora_entrada);
                        const end = new Date(f.hora_salida);
                        
                        // Calculate total duration considering pauses
                        let pauseDurationMs = 0;
                        if (f.pausas && f.pausas.length > 0) {
                            f.pausas.forEach(p => {
                                if (p.hora_inicio_pausa && p.hora_fin_pausa) {
                                    pauseDurationMs += (new Date(p.hora_fin_pausa) - new Date(p.hora_inicio_pausa));
                                }
                            });
                        }
                        
                        const durationMs = (end - start) - pauseDurationMs;
                        totalWorkedHours += (durationMs / 1000 / 3600);

                        // Calculate Night Hours
                        totalNightHours += calculateNightHours(f.hora_entrada, f.hora_salida, f.pausas);
                    }
                });

                const overtimeHours = Math.max(0, totalWorkedHours - standardMonthlyHours);

                // --- Absences (Baja Logic) ---
                const empAusencias = ausencias.filter(a => a.empleado_id === emp.id);
                let totalSickDays = 0;
                let unpaidSickDays = 0; // First 3 days of common illness

                empAusencias.forEach(aus => {
                    const aStart = new Date(aus.fecha_inicio);
                    const aEnd = new Date(aus.fecha_fin);
                    
                    // Intersect with current month
                    const effStart = aStart < startDate ? startDate : aStart;
                    const effEnd = aEnd > endDate ? endDate : aEnd;

                    if (effStart <= effEnd) {
                        const daysInMonth = differenceInMinutes(addDays(effEnd, 1), effStart) / 1440; // Approx days
                        
                        if (aus.tipo === 'baja') {
                            totalSickDays += Math.round(daysInMonth);
                            
                            // Logic for first 3 days:
                            // We need to know if the first 3 days of THIS specific absence record fall within this month
                            // If the absence started before this month, the first 3 days are already passed.
                            if (aStart >= startDate) {
                                // Started this month
                                // We discount up to 3 days, but capped by how many days fall in this month
                                const daysToDiscount = Math.min(3, Math.round(daysInMonth));
                                unpaidSickDays += daysToDiscount;
                            }
                        }
                    }
                });

                // --- Financials ---
                const empAnticipos = anticipos.filter(a => a.empleado_id === emp.auth_user_id || a.empleado_id === emp.id); 
                const totalAnticipos = empAnticipos.reduce((sum, a) => sum + Number(a.cantidad), 0);

                const empEmbargos = embargos.filter(e => e.empleado_id === emp.auth_user_id || e.empleado_id === emp.id);
                const activeEmbargoInfo = empEmbargos.map(e => `${e.organismo} (${e.importe_pendiente}€ pdte)`).join(', ');

                // Penalties (Placeholder)
                const penalizaciones = 0; 

                return {
                    'ID Empleado': emp.id,
                    'Nombre Completo': `${emp.nombre} ${emp.apellidos || ''}`.trim(),
                    'DNI/NIE': emp.dni_nie || '-',
                    'Horas Trabajadas': Number(totalWorkedHours.toFixed(2)),
                    'Horas Teóricas': standardMonthlyHours,
                    'Horas Extras': Number(overtimeHours.toFixed(2)),
                    'Horas Nocturnas': Number(totalNightHours.toFixed(2)),
                    'Plus Nocturno (€)': Number((totalNightHours * NIGHT_SHIFT_RATE).toFixed(2)),
                    'Días Baja (Total)': totalSickDays,
                    'Días Baja (Desc. 3 primeros)': unpaidSickDays,
                    'Anticipos (€)': totalAnticipos,
                    'Embargos Activos': activeEmbargoInfo || 'No',
                    'Penalizaciones': penalizaciones
                };
            });

            // 7. Generate Excel
            const ws = XLSX.utils.json_to_sheet(reportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, `Nóminas ${months[parseInt(month)].label}`);
            
            // Auto-width
            const wscols = Object.keys(reportData[0] || {}).map(() => ({ wch: 20 }));
            ws['!cols'] = wscols;

            XLSX.writeFile(wb, `Reporte_Mensual_Empleados_${months[parseInt(month)].label}_${year}.xlsx`);
            
            toast({ title: 'Reporte Generado', description: 'La descarga comenzará automáticamente.' });
            onClose();

        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo generar el reporte: ' + error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        Reporte Mensual de Nóminas
                    </DialogTitle>
                    <DialogDescription>
                        Genera un archivo Excel con el resumen de horas, bajas, anticipos y pluses para el cálculo de nóminas.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Mes</Label>
                            <Select value={month} onValueChange={setMonth}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Año</Label>
                            <Select value={year} onValueChange={setYear}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="inactive" 
                            checked={includeInactive} 
                            onCheckedChange={setIncludeInactive} 
                        />
                        <Label htmlFor="inactive" className="text-sm font-normal text-muted-foreground cursor-pointer">
                            Incluir empleados inactivos
                        </Label>
                    </div>

                    <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-md border border-blue-100 space-y-1">
                        <p><strong>Cálculos automáticos:</strong></p>
                        <ul className="list-disc pl-4 space-y-0.5">
                            <li>Horario L-J: 8.5h (08:30-14:00 + 15:00-18:00)</li>
                            <li>Horario V: 6h (08:30-14:30)</li>
                            <li>Fines de semana y festivos excluidos</li>
                            <li>Plus nocturno (22:00 - 06:00) a {NIGHT_SHIFT_RATE.toFixed(2)}€/h</li>
                        </ul>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
                    <Button onClick={generateReport} disabled={loading} className="gap-2">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Generar Excel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default EmployeeMonthlyReportModal;