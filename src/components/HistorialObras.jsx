import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, FileText, Calendar, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const HistorialObras = ({ selectedMonth }) => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!selectedMonth) return;

        const fetchProjects = async () => {
            setLoading(true);
            const { ano, mes } = selectedMonth;
            
            const startStr = `${ano}-${String(mes).padStart(2, '0')}-01`;
            const lastDay = new Date(ano, mes, 0).getDate();
            const endStr = `${ano}-${String(mes).padStart(2, '0')}-${lastDay}`;

            const { data, error } = await supabase
                .from('proyectos')
                .select('id, nombre_proyecto, fecha_cierre_real, presupuesto_aceptado, clientes(nombre)')
                .eq('estado', 'facturado')
                .not('fecha_cierre_real', 'is', null)
                .gte('fecha_cierre_real', startStr)
                .lte('fecha_cierre_real', endStr)
                .order('fecha_cierre_real', { ascending: false });

            if (error) {
                console.error('Error fetching projects:', error);
                setProjects([]);
            } else {
                setProjects(data || []);
            }
            setLoading(false);
        };

        fetchProjects();
    }, [selectedMonth]);

    if (!selectedMonth) return null;

    const monthLabel = format(new Date(selectedMonth.ano, selectedMonth.mes - 1), 'MMMM yyyy', { locale: es });

    return (
        <Card className="mt-6 md:mt-8 border-border/60 shadow-sm">
            <CardHeader className="p-4 md:p-6 pb-2 md:pb-4">
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                    <FileText className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                    Facturado en <span className="capitalize text-primary">{monthLabel}</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0 md:p-6 md:pt-0">
                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="w-6 h-6 md:w-8 md:h-8 animate-spin text-primary" />
                    </div>
                ) : projects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-muted-foreground bg-muted/20 m-4 rounded-lg border border-dashed">
                        <AlertCircle className="w-6 h-6 mb-2 opacity-50" />
                        <p className="text-sm">No hay obras facturadas en este mes.</p>
                    </div>
                ) : (
                    <div className="border-t md:border md:rounded-md overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/40">
                                <TableRow className="h-9 md:h-11">
                                    <TableHead className="text-xs font-semibold h-auto py-2">Proyecto</TableHead>
                                    <TableHead className="hidden md:table-cell text-xs font-semibold h-auto py-2">Cliente</TableHead>
                                    <TableHead className="text-xs font-semibold h-auto py-2">Fecha</TableHead>
                                    <TableHead className="text-right text-xs font-semibold h-auto py-2">Importe</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {projects.map((project) => (
                                    <TableRow key={project.id} className="hover:bg-muted/30 transition-colors h-auto border-b border-border/50 last:border-0">
                                        <TableCell className="py-3 font-medium text-xs md:text-sm max-w-[120px] truncate">
                                            {project.nombre_proyecto}
                                            <div className="md:hidden text-[10px] text-muted-foreground font-normal truncate">
                                                {project.clientes?.nombre || 'Sin cliente'}
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell py-3 text-sm text-muted-foreground">
                                            {project.clientes?.nombre || 'Sin cliente'}
                                        </TableCell>
                                        <TableCell className="py-3 text-xs text-muted-foreground whitespace-nowrap">
                                            {project.fecha_cierre_real ? format(parseISO(project.fecha_cierre_real), 'dd/MM/yyyy') : '-'}
                                        </TableCell>
                                        <TableCell className="py-3 text-right font-bold text-xs md:text-sm text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(project.presupuesto_aceptado || 0)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default HistorialObras;