import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import TimeClockMap from '@/components/TimeClockMap';
import { AlarmClock as UserClock, MapPin } from 'lucide-react';
import { Button } from './ui/button';
import { formatDecimalHoursToHoursMinutes } from '@/lib/utils';

const TimeClockReport = () => {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEntry, setSelectedEntry] = useState(null);

    const fetchReportData = useCallback(async () => {
        setLoading(true);
        // Ensure we rely on database views that compute duration using madrid columns if possible,
        // or calculate it safely. `control_horario_diario` view likely needs updating on DB side
        // to use madrid columns, but here we just consume it. 
        // We will assume the VIEW is or will be updated to be consistent.
        // For now, we fetch and display.
        const { data, error } = await supabase.from('control_horario_diario').select('*');
        
        if (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el reporte de fichajes.' });
        } else {
            // We need to join with empleados to get the name
            const employeeIds = [...new Set(data.map(d => d.empleado_id))];
            if (employeeIds.length > 0) {
                const { data: employees, error: empError } = await supabase
                    .from('empleados')
                    .select('auth_user_id, nombre, apellidos')
                    .in('auth_user_id', employeeIds);

                if (empError) {
                    toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar los nombres de los empleados.' });
                    setReportData(data); // show data without names
                } else {
                    const employeeMap = new Map(employees.map(e => [e.auth_user_id, `${e.nombre} ${e.apellidos}`.trim()]));
                    const enrichedData = data.map(d => ({
                        ...d,
                        nombre_empleado: employeeMap.get(d.empleado_id) || 'Desconocido'
                    }));
                    setReportData(enrichedData);
                }
            } else {
                setReportData([]);
            }
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    const handleOpenMap = (row) => {
        setSelectedEntry(row);
    };

    return (
        <div className="p-4 md:p-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div className="flex items-center gap-3 mb-8">
                    <UserClock className="w-8 h-8 text-purple-400"/>
                    <h1 className="text-3xl md:text-4xl font-bold gradient-text">Reporte de Control Horario</h1>
                </div>

                <div className="glass-effect p-4 rounded-2xl border border-white/10">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Empleado</TableHead>
                                <TableHead>Horas Trabajadas</TableHead>
                                <TableHead>Horas de Pausa</TableHead>
                                <TableHead>Costo Total</TableHead>
                                <TableHead className="text-right">GPS</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan="6" className="text-center">Cargando reporte...</TableCell></TableRow>
                            ) : (
                                reportData.map((row, index) => (
                                    <TableRow key={`${row.dia}-${row.empleado_id}-${index}`}>
                                        <TableCell>{new Date(row.dia).toLocaleDateString('es-ES')}</TableCell>
                                        <TableCell>{row.nombre_empleado}</TableCell>
                                        <TableCell>{formatDecimalHoursToHoursMinutes(row.total_horas_trabajadas)}</TableCell>
                                        <TableCell>{formatDecimalHoursToHoursMinutes(row.total_horas_pausa)}</TableCell>
                                        <TableCell>€{row.costo_total_proyecto?.toFixed(2) || '0.00'}</TableCell>
                                        <TableCell className="text-right">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" onClick={() => handleOpenMap(row)}>
                                                        <MapPin className="h-4 w-4 text-blue-400" />
                                                    </Button>
                                                </DialogTrigger>
                                                {selectedEntry && selectedEntry.dia === row.dia && selectedEntry.empleado_id === row.empleado_id &&
                                                    <DialogContent className="sm:max-w-[825px]">
                                                        <DialogHeader>
                                                            <DialogTitle>Mapa de Fichaje - {selectedEntry.nombre_empleado} ({new Date(selectedEntry.dia).toLocaleDateString('es-ES')})</DialogTitle>
                                                        </DialogHeader>
                                                        <TimeClockMap employeeId={selectedEntry.empleado_id} date={selectedEntry.dia} />
                                                    </DialogContent>
                                                }
                                            </Dialog>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </motion.div>
        </div>
    );
};

export default TimeClockReport;