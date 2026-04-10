import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Users } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { formatCurrency, convertDecimalHoursToDisplay } from '@/lib/utils';

const LaborCostDetail = ({ projectId }) => {
    const [breakdownData, setBreakdownData] = useState([]);
    const [loading, setLoading] = useState(true);
    const { session } = useAuth();

    useEffect(() => {
        const fetchData = async () => {
            if (!projectId) return;
            setLoading(true);

            try {
                // 1. Fetch aggregated hours from view
                const hoursPromise = supabase
                    .from('v_mano_obra_proyecto_ui_v5')
                    .select('empleado_id, empleado_nombre, horas_normales, horas_extras, horas_festivo, total_horas')
                    .eq('proyecto_id', projectId)
                    .order('empleado_nombre', { ascending: true });

                // 2. Fetch employees to get their roles
                const empsPromise = supabase
                    .from('empleados')
                    .select('id, rol');

                // 3. Fetch rates configuration
                const ratesPromise = supabase
                    .from('tarifas_horas_roles')
                    .select('rol, tipo, precio');

                const [hoursRes, empsRes, ratesRes] = await Promise.all([hoursPromise, empsPromise, ratesPromise]);

                if (hoursRes.error) throw hoursRes.error;

                const rawData = hoursRes.data || [];
                const employees = empsRes.data || [];
                const ratesDB = ratesRes.data || [];

                // Helper to get hourly rate based on role and hour type
                const getRate = (rol, type) => {
                    const r = (rol || 'tecnico').toLowerCase();
                    
                    // Map generic types to DB types if necessary
                    // Expected types in DB: 'normal', 'extra_laborable', 'extra_festivo'
                    let dbType = type;
                    if (type === 'extra') dbType = 'extra_laborable';
                    if (type === 'festivo') dbType = 'extra_festivo';
                    if (type === 'normal') dbType = 'normal'; // usually implicit or cost_per_hour, but we check rates table first

                    const found = ratesDB.find(x => x.rol === r && x.tipo === dbType);
                    if (found) return Number(found.precio);

                    // Fallback Defaults (Precomputed/Hardcoded as requested)
                    const defaults = {
                        tecnico: { normal: 27, extra: 35, festivo: 45 },
                        encargado: { normal: 32, extra: 40, festivo: 50 },
                        admin: { normal: 35, extra: 45, festivo: 55 },
                        default: { normal: 25, extra: 30, festivo: 40 }
                    };
                    
                    const roleRates = defaults[r] || defaults['default'];
                    return roleRates[type] || 0;
                };

                // Calculate costs for each row
                const processed = rawData.map(row => {
                    const emp = employees.find(e => e.id === row.empleado_id);
                    const role = emp ? emp.rol : 'tecnico'; // fallback role

                    const rateNormal = getRate(role, 'normal');
                    const rateExtra = getRate(role, 'extra');
                    const rateFestivo = getRate(role, 'festivo');

                    const hNormal = Number(row.horas_normales) || 0;
                    const hExtra = Number(row.horas_extras) || 0;
                    const hFestivo = Number(row.horas_festivo) || 0;

                    const costNormal = hNormal * rateNormal;
                    const costExtra = hExtra * rateExtra;
                    const costFestivo = hFestivo * rateFestivo;
                    const costTotal = costNormal + costExtra + costFestivo;

                    return {
                        ...row,
                        role,
                        costNormal,
                        costExtra,
                        costFestivo,
                        costTotal
                    };
                });

                setBreakdownData(processed);

            } catch (error) {
                console.error("Error fetching labor details:", error);
                setBreakdownData([]);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [projectId, session]);

    // Calculate totals for footer
    const totals = useMemo(() => {
        return breakdownData.reduce((acc, curr) => ({
            horas_normales: acc.horas_normales + (Number(curr.horas_normales) || 0),
            coste_normales: acc.coste_normales + curr.costNormal,
            
            horas_extras: acc.horas_extras + (Number(curr.horas_extras) || 0),
            coste_extras: acc.coste_extras + curr.costExtra,
            
            horas_festivo: acc.horas_festivo + (Number(curr.horas_festivo) || 0),
            coste_festivo: acc.coste_festivo + curr.costFestivo,
            
            total_horas: acc.total_horas + (Number(curr.total_horas) || 0),
            total_coste: acc.total_coste + curr.costTotal
        }), {
            horas_normales: 0, coste_normales: 0,
            horas_extras: 0, coste_extras: 0,
            horas_festivo: 0, coste_festivo: 0,
            total_horas: 0, total_coste: 0
        });
    }, [breakdownData]);

    // Responsive card for mobile
    const LaborCostCard = ({ item, index }) => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
        >
            <Card className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                        <span className="font-bold text-primary">{item.empleado_nombre}</span>
                        <span className="text-xs text-muted-foreground uppercase">{item.role}</span>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="block text-[10px] text-muted-foreground uppercase">Normales</span>
                                <div className="flex justify-between items-baseline">
                                    <span>{convertDecimalHoursToDisplay(item.horas_normales)}</span>
                                    <span className="font-medium text-green-700 dark:text-green-400">{formatCurrency(item.costNormal)}</span>
                                </div>
                            </div>
                            <div>
                                <span className="block text-[10px] text-muted-foreground uppercase">Extras</span>
                                <div className="flex justify-between items-baseline">
                                    <span>{convertDecimalHoursToDisplay(item.horas_extras)}</span>
                                    <span className="font-medium text-orange-700 dark:text-orange-400">{formatCurrency(item.costExtra)}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="block text-[10px] text-muted-foreground uppercase text-purple-600">Festivo</span>
                                <div className="flex justify-between items-baseline">
                                    <span className="text-purple-700">{convertDecimalHoursToDisplay(item.horas_festivo)}</span>
                                    <span className="font-medium text-purple-700 dark:text-purple-400">{formatCurrency(item.costFestivo)}</span>
                                </div>
                            </div>
                            <div>
                                <span className="block text-[10px] text-muted-foreground uppercase font-bold">Total Coste</span>
                                <div className="flex justify-between items-baseline">
                                    <span className="font-bold">{convertDecimalHoursToDisplay(item.total_horas)}</span>
                                    <span className="font-bold text-foreground bg-gray-100 dark:bg-gray-800 px-1 rounded">{formatCurrency(item.costTotal)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );

    if (loading) {
        return <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
    }

    if (breakdownData.length === 0) {
        return (
            <div className="text-center py-6 bg-card rounded-xl border border-dashed">
                <Users className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Sin registros de mano de obra para esta obra.</p>
            </div>
        );
    }

    return (
        <div>
            {/* Mobile View */}
            <div className="md:hidden space-y-3">
                {breakdownData.map((item, index) => (
                    <LaborCostCard key={index} item={item} index={index} />
                ))}
                {/* Mobile Totals */}
                <Card className="bg-primary/5 mt-4 border-t-2 border-primary/20 shadow-md">
                    <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-center font-bold text-lg text-primary">
                            <span>TOTALES</span>
                            <span>{formatCurrency(totals.total_coste)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs text-center pt-2 border-t border-primary/10">
                             <div>
                                <span className="block text-muted-foreground">Normales</span>
                                <span className="font-semibold">{formatCurrency(totals.coste_normales)}</span>
                            </div>
                            <div>
                                <span className="block text-muted-foreground">Extras</span>
                                <span className="font-semibold">{formatCurrency(totals.coste_extras)}</span>
                            </div>
                            <div>
                                <span className="block text-muted-foreground">Festivo</span>
                                <span className="font-semibold">{formatCurrency(totals.coste_festivo)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            {/* Desktop View */}
            <div className="hidden md:block rounded-md border overflow-hidden bg-card shadow-sm">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="min-w-[150px]">Empleado</TableHead>
                                <TableHead className="text-right whitespace-nowrap">Horas Normales</TableHead>
                                <TableHead className="text-right text-green-700 dark:text-green-400 bg-green-50/30 whitespace-nowrap">Coste Normales</TableHead>
                                <TableHead className="text-right whitespace-nowrap">Horas Extra</TableHead>
                                <TableHead className="text-right text-orange-700 dark:text-orange-400 bg-orange-50/30 whitespace-nowrap">Coste Extra</TableHead>
                                <TableHead className="text-right text-purple-600 whitespace-nowrap">Horas Festivo</TableHead>
                                <TableHead className="text-right text-purple-700 dark:text-purple-400 bg-purple-50/30 whitespace-nowrap">Coste Festivo</TableHead>
                                <TableHead className="text-right font-bold whitespace-nowrap">Total Horas</TableHead>
                                <TableHead className="text-right font-bold bg-gray-50/50 dark:bg-gray-900/50 whitespace-nowrap">Total Coste</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {breakdownData.map((item, index) => (
                                <TableRow key={index} className="hover:bg-muted/20">
                                    <TableCell className="font-medium">
                                        {item.empleado_nombre}
                                    </TableCell>
                                    
                                    {/* Normales */}
                                    <TableCell className="text-right text-muted-foreground font-mono">{convertDecimalHoursToDisplay(item.horas_normales)}</TableCell>
                                    <TableCell className="text-right font-medium text-green-700 dark:text-green-400 bg-green-50/10 font-mono">{formatCurrency(item.costNormal)}</TableCell>
                                    
                                    {/* Extras */}
                                    <TableCell className="text-right text-muted-foreground font-mono">{convertDecimalHoursToDisplay(item.horas_extras)}</TableCell>
                                    <TableCell className="text-right font-medium text-orange-700 dark:text-orange-400 bg-orange-50/10 font-mono">{formatCurrency(item.costExtra)}</TableCell>
                                    
                                    {/* Festivo */}
                                    <TableCell className="text-right font-medium text-purple-600 font-mono">{convertDecimalHoursToDisplay(item.horas_festivo)}</TableCell>
                                    <TableCell className="text-right font-medium text-purple-700 dark:text-purple-400 bg-purple-50/10 font-mono">{formatCurrency(item.costFestivo)}</TableCell>
                                    
                                    {/* Totales */}
                                    <TableCell className="text-right font-bold font-mono">{convertDecimalHoursToDisplay(item.total_horas)}</TableCell>
                                    <TableCell className="text-right font-bold text-foreground bg-gray-50/30 dark:bg-gray-900/30 font-mono">{formatCurrency(item.costTotal)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter className="bg-muted/80 border-t-2 border-muted">
                            <TableRow>
                                <TableCell className="font-bold text-base">TOTALES</TableCell>
                                <TableCell className="text-right font-bold">{convertDecimalHoursToDisplay(totals.horas_normales)}</TableCell>
                                <TableCell className="text-right font-bold text-green-700 dark:text-green-400">{formatCurrency(totals.coste_normales)}</TableCell>
                                
                                <TableCell className="text-right font-bold">{convertDecimalHoursToDisplay(totals.horas_extras)}</TableCell>
                                <TableCell className="text-right font-bold text-orange-700 dark:text-orange-400">{formatCurrency(totals.coste_extras)}</TableCell>
                                
                                <TableCell className="text-right font-bold text-purple-700 dark:text-purple-400">{convertDecimalHoursToDisplay(totals.horas_festivo)}</TableCell>
                                <TableCell className="text-right font-bold text-purple-700 dark:text-purple-400">{formatCurrency(totals.coste_festivo)}</TableCell>
                                
                                <TableCell className="text-right font-bold text-lg">{convertDecimalHoursToDisplay(totals.total_horas)}</TableCell>
                                <TableCell className="text-right font-bold text-lg text-primary bg-primary/5">{formatCurrency(totals.total_coste)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </div>
        </div>
    );
};

export default LaborCostDetail;