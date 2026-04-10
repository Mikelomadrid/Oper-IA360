import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus, Users, User, CheckCircle2, Circle, AlertCircle, Briefcase } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import AssignmentModal from '@/components/AssignmentModal';
import { cn } from '@/lib/utils';

const EjecucionesAsignacionesView = ({ obraId }) => {
    const { user, sessionRole } = useAuth();
    const { toast } = useToast();
    
    // Data State
    const [executions, setExecutions] = useState([]);
    const [myAssignments, setMyAssignments] = useState([]); // Array of execution IDs assigned to current user
    const [loading, setLoading] = useState(true);
    
    // UI State
    const [filterAssignedToMe, setFilterAssignedToMe] = useState(false);
    const [filterUnassigned, setFilterUnassigned] = useState(false);
    
    // Modal State
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [selectedExecution, setSelectedExecution] = useState(null);

    // Permission check
    const canManage = sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado' || sessionRole?.rol === 'manager';

    useEffect(() => {
        if (obraId) {
            fetchData();
        }
    }, [obraId, user]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Executions View
            const { data: execs, error: execError } = await supabase
                .from('v_ejecuciones_obra_ui_v4')
                .select('*')
                .eq('obra_id', obraId)
                .order('created_at', { ascending: false });

            if (execError) throw execError;
            setExecutions(execs || []);

            // 2. Fetch My Assignments if user is logged in
            if (user) {
                const { data: myAssigns, error: myAssignError } = await supabase
                    .from('ejecucion_asignaciones_v2')
                    .select('ejecucion_id')
                    .eq('user_id', user.id);
                
                if (myAssignError) {
                    console.warn("Could not fetch my assignments", myAssignError);
                } else {
                    setMyAssignments(myAssigns.map(a => a.ejecucion_id));
                }
            }

        } catch (error) {
            console.error("Error loading executions:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las ejecuciones.' });
        } finally {
            setLoading(false);
        }
    };

    const handleAssignClick = (exec) => {
        setSelectedExecution(exec);
        setAssignModalOpen(true);
    };

    const filteredExecutions = useMemo(() => {
        return executions.filter(exec => {
            // Filter: Assigned to me
            if (filterAssignedToMe && !myAssignments.includes(exec.ejecucion_id)) {
                return false;
            }
            // Filter: Unassigned (No encargado AND no technicians)
            // Note: v4 view has tecnicos_count and encargado_uid
            if (filterUnassigned) {
                const isUnassigned = !exec.encargado_uid && (exec.tecnicos_count === 0 || exec.tecnicos_count === null);
                if (!isUnassigned) return false;
            }
            return true;
        });
    }, [executions, filterAssignedToMe, filterUnassigned, myAssignments]);

    return (
        <div className="space-y-6 relative min-h-[400px]">
            {/* Background Hero Accent */}
            <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-blue-900/20 to-transparent rounded-t-3xl -z-10 pointer-events-none" />
            <div 
                className="absolute top-0 right-0 w-full h-64 opacity-5 bg-no-repeat bg-cover bg-right-top rounded-t-3xl -z-10 pointer-events-none mix-blend-overlay"
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1608403810239-ac22e2c3bac7')` }}
            />

            {/* Controls Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-xl border shadow-sm sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg text-blue-600 dark:text-blue-300">
                        <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Gestión de Equipos</h2>
                        <p className="text-xs text-muted-foreground hidden sm:block">Asigna técnicos y encargados a los procesos</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-full border">
                        <Switch 
                            id="filter-me" 
                            checked={filterAssignedToMe} 
                            onCheckedChange={setFilterAssignedToMe} 
                        />
                        <Label htmlFor="filter-me" className="text-xs cursor-pointer font-medium">Asignado a mí</Label>
                    </div>
                    <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-full border">
                        <Switch 
                            id="filter-unassigned" 
                            checked={filterUnassigned} 
                            onCheckedChange={setFilterUnassigned} 
                        />
                        <Label htmlFor="filter-unassigned" className="text-xs cursor-pointer font-medium text-orange-600 dark:text-orange-400">Sin asignar</Label>
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
                <AnimatePresence>
                    {loading ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                            <Loader2 className="w-10 h-10 animate-spin text-primary" />
                            <p>Cargando procesos...</p>
                        </div>
                    ) : filteredExecutions.length === 0 ? (
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-xl bg-slate-50/50 dark:bg-slate-900/50"
                        >
                            <AlertCircle className="w-12 h-12 mb-2 opacity-20" />
                            <p className="text-lg font-medium">No se encontraron procesos</p>
                            <p className="text-sm opacity-70">Intenta cambiar los filtros</p>
                        </motion.div>
                    ) : (
                        filteredExecutions.map((exec) => (
                            <motion.div
                                key={exec.ejecucion_id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Card className={cn(
                                    "border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-slate-950 overflow-hidden relative group h-full flex flex-col",
                                    !exec.encargado_uid ? "ring-1 ring-orange-200 dark:ring-orange-900/30" : ""
                                )}>
                                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-indigo-600 opacity-80" />
                                    
                                    <CardContent className="p-5 flex-1 flex flex-col gap-4">
                                        {/* Header */}
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="space-y-1">
                                                <h3 className="font-bold text-base leading-tight text-slate-800 dark:text-slate-100 line-clamp-2" title={exec.procedimiento_titulo}>
                                                    {exec.procedimiento_titulo}
                                                </h3>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={exec.estado === 'en_progreso' ? 'default' : 'secondary'} className="capitalize text-[10px] px-2 h-5">
                                                        {exec.estado?.replace('_', ' ') || 'Desconocido'}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground font-mono">
                                                        {exec.procedimiento_codigo}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="shrink-0 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg text-slate-500">
                                                {exec.estado === 'completado' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Circle className="w-5 h-5 text-blue-500 animate-pulse" />}
                                            </div>
                                        </div>

                                        {/* Stats / Info */}
                                        <div className="grid grid-cols-2 gap-3 mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                                    <User className="w-3 h-3" /> Encargado
                                                </span>
                                                <div className="flex items-center gap-1.5 h-6">
                                                    {exec.encargado_uid ? (
                                                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] pl-1 pr-2 truncate max-w-full">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1.5 shrink-0" />
                                                            Asignado
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-xs text-orange-500 font-medium flex items-center">
                                                            <AlertCircle className="w-3 h-3 mr-1" /> Sin asignar
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                                    <Users className="w-3 h-3" /> Técnicos
                                                </span>
                                                <div className="flex items-center gap-1.5 h-6">
                                                    {exec.tecnicos_count > 0 ? (
                                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] pl-1 pr-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                                                            {exec.tecnicos_count} {exec.tecnicos_count === 1 ? 'Persona' : 'Personas'}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">Ninguno</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Button - Only for Managers */}
                                        {canManage && (
                                            <Button 
                                                className="w-full mt-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-blue-600 dark:hover:bg-blue-200 transition-colors shadow-md group-hover:shadow-lg"
                                                size="sm"
                                                onClick={() => handleAssignClick(exec)}
                                            >
                                                <UserPlus className="w-4 h-4 mr-2" />
                                                {exec.encargado_uid || exec.tecnicos_count > 0 ? 'Editar Equipo' : 'Asignar Equipo'}
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            <AssignmentModal 
                isOpen={assignModalOpen} 
                onClose={() => setAssignModalOpen(false)}
                executionId={selectedExecution?.ejecucion_id}
                executionTitle={selectedExecution?.procedimiento_titulo}
                onAssignmentComplete={fetchData}
            />
        </div>
    );
};

export default EjecucionesAsignacionesView;