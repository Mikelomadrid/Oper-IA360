import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Loader2, FileText, Plus, Trash2, Pencil, Clock,
    AlertCircle, ArrowRight, PlayCircle, CheckCircle2,
    Users, User, UserPlus
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import EjecucionCrudModal from '@/components/EjecucionCrudModal';
import EjecucionDetailModal from '@/components/EjecucionDetailModal';
import PersonnelAssignmentModal from '@/components/PersonnelAssignmentModal';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';

const ObraProcesosTab = ({ obraId }) => {
    const { sessionRole } = useAuth();
    const { toast } = useToast();

    // State
    const [executions, setExecutions] = useState([]);
    const [employeesMap, setEmployeesMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('activos');

    // Modals State
    const [isCrudOpen, setIsCrudOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isAssignOpen, setIsAssignOpen] = useState(false);

    const [editingItem, setEditingItem] = useState(null);
    const [managingItem, setManagingItem] = useState(null);
    const [assigningItem, setAssigningItem] = useState(null);

    const [itemToDelete, setItemToDelete] = useState(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Permission check
    const canEdit = sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado' || sessionRole?.rol === 'manager';

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Executions View
            const { data: execData, error: execError } = await supabase
                .from('v_ejecuciones_obra_ui_v4')
                .select('*')
                .eq('obra_id', obraId)
                .order('created_at', { ascending: false });

            if (execError) throw execError;
            setExecutions(execData || []);

            // 2. Fetch Employees to resolve names (encargado_uid is auth_user_id)
            const { data: empData, error: empError } = await supabase
                .from('empleados')
                .select('auth_user_id, nombre, apellidos');

            if (!empError && empData) {
                const map = {};
                empData.forEach(e => {
                    if (e.auth_user_id) {
                        map[e.auth_user_id] = `${e.nombre} ${e.apellidos || ''}`.trim();
                    }
                });
                setEmployeesMap(map);
            }

        } catch (err) {
            console.error("Error fetching data:", err);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los datos." });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (obraId) fetchData();
    }, [obraId]);

    // --- FILTERS ---
    const filteredExecutions = useMemo(() => {
        return executions.filter(ex => {
            const status = (ex.estado || '').toLowerCase();
            if (activeTab === 'activos') return ['en_progreso', 'pendiente', 'en_curso'].includes(status);
            if (activeTab === 'completados') return status === 'completado';
            if (activeTab === 'historico') return ['completado', 'cancelado', 'archivado', 'omitido'].includes(status);
            return true;
        });
    }, [executions, activeTab]);

    // --- HANDLERS ---
    const handleCreate = () => { setEditingItem(null); setIsCrudOpen(true); };
    const handleEdit = (item) => { setEditingItem(item); setIsCrudOpen(true); };
    const handleManage = (item) => { setManagingItem(item); setIsDetailOpen(true); };
    const handleAssign = (item) => { setAssigningItem(item); setIsAssignOpen(true); };
    const handleDeleteClick = (item) => { setItemToDelete(item); setIsDeleteOpen(true); };

    const handleConfirmDelete = async () => {
        if (!itemToDelete) return;
        setDeleting(true);
        try {
            const { error } = await supabase.rpc('rpc_admin_eliminar_ejecucion', { p_ejecucion_id: itemToDelete.ejecucion_id });
            if (error) throw error;
            toast({ title: "Eliminado", description: "El proceso ha sido eliminado correctamente." });
            await fetchData();
        } catch (err) {
            toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el registro." });
        } finally {
            setDeleting(false); setIsDeleteOpen(false); setItemToDelete(null);
        }
    };

    // --- SUBCOMPONENT: Execution Card ---
    const ExecutionCard = ({ item }) => {
        const encargadoName = employeesMap[item.encargado_uid];

        return (
            <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group h-full"
            >
                <Card className="rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border-0 bg-white dark:bg-slate-950 overflow-hidden relative h-full flex flex-col ring-1 ring-slate-200 dark:ring-slate-800">
                    {/* Status Stripe */}
                    <div className={cn(
                        "absolute top-0 left-0 w-1.5 h-full transition-colors duration-300",
                        item.estado === 'completado' ? "bg-emerald-500" :
                            item.estado === 'en_progreso' ? "bg-blue-600" :
                                item.estado === 'cancelado' ? "bg-slate-400" : "bg-amber-500"
                    )} />

                    <CardContent className="p-5 pl-7 flex flex-col h-full">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-3">
                            <div className="space-y-1.5">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 leading-tight line-clamp-2" title={item.procedimiento_titulo}>
                                    {item.procedimiento_titulo}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200">
                                        {item.procedimiento_codigo}
                                    </Badge>
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {format(new Date(item.created_at), "d MMM yy", { locale: es })}
                                    </span>
                                </div>
                            </div>

                            {canEdit && (
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm p-1 rounded-full shadow-sm z-10">
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-blue-600 hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); handleEdit(item); }}>
                                        <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-red-600 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); handleDeleteClick(item); }}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Status Badge */}
                        <div className="mb-4">
                            <Badge className={cn(
                                "capitalize shadow-none px-2.5 py-0.5",
                                item.estado === 'completado' ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                    item.estado === 'en_progreso' ? "bg-blue-100 text-blue-700 border-blue-200" :
                                        "bg-amber-100 text-amber-700 border-amber-200"
                            )}>
                                {item.estado === 'en_progreso' && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
                                {item.estado === 'completado' && <CheckCircle2 className="w-3 h-3 mr-1.5" />}
                                {item.estado?.replace('_', ' ')}
                            </Badge>
                        </div>

                        {/* Personnel Section (New Task Requirement) */}
                        <div className="mt-auto mb-4 space-y-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <Avatar className="w-6 h-6 border border-white dark:border-slate-700">
                                        <AvatarFallback className="text-[9px] bg-blue-100 text-blue-700">
                                            {encargadoName ? encargadoName.substring(0, 2).toUpperCase() : '?'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[10px] text-muted-foreground font-semibold uppercase">Responsable</span>
                                        <span className="text-xs font-medium truncate w-full" title={encargadoName || 'Sin asignar'}>
                                            {encargadoName || 'Sin asignar'}
                                        </span>
                                    </div>
                                </div>

                                {canEdit && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700" onClick={(e) => { e.stopPropagation(); handleAssign(item); }}>
                                                    <UserPlus className="w-3.5 h-3.5 text-slate-500" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Asignar personal</p></TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/50">
                                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                    Técnicos asignados: <span className="font-semibold text-slate-700 dark:text-slate-300">{item.tecnicos_count || 0}</span>
                                </span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            <Button
                                className={cn(
                                    "flex-1 shadow-sm transition-all duration-300 group-hover:translate-y-0",
                                    item.estado === 'completado'
                                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                        : "bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900"
                                )}
                                onClick={() => handleManage(item)}
                            >
                                {item.estado === 'completado' ? 'Ver Detalles' : 'Gestionar'}
                                {item.estado === 'completado' ? <FileText className="w-4 h-4 ml-2" /> : <ArrowRight className="w-4 h-4 ml-2" />}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        );
    };

    return (
        <div className="space-y-6 py-6 animate-in fade-in duration-500 min-h-[500px]">
            {/* Header & Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        <PlayCircle className="w-5 h-5 text-blue-600" />
                        Procesos y Ejecuciones
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gestiona el ciclo de vida, checklists y validaciones de la obra.</p>
                </div>
                {canEdit && (
                    <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-blue-500/25 transition-all">
                        <Plus className="w-4 h-4 mr-2" />
                        Nueva Ejecución
                    </Button>
                )}
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 lg:w-[400px] mb-6 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <TabsTrigger value="activos" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-md transition-all font-medium">
                        En Curso
                    </TabsTrigger>
                    <TabsTrigger value="completados" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm rounded-md transition-all font-medium">
                        Completados
                    </TabsTrigger>
                    <TabsTrigger value="historico" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-600 dark:data-[state=active]:text-slate-300 data-[state=active]:shadow-sm rounded-md transition-all font-medium">
                        Histórico
                    </TabsTrigger>
                </TabsList>

                <div className="min-h-[300px]">
                    <AnimatePresence mode="wait">
                        {loading ? (
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center py-24 text-muted-foreground"
                            >
                                <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
                                <p className="text-sm font-medium">Cargando datos...</p>
                            </motion.div>
                        ) : filteredExecutions.length === 0 ? (
                            <motion.div
                                key="empty"
                                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center py-24 text-muted-foreground border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/30 dark:bg-slate-900/30"
                            >
                                <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-4">
                                    <FileText className="w-8 h-8 text-slate-400" />
                                </div>
                                <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">No hay ejecuciones en esta sección</p>
                                <p className="text-sm text-slate-500">Crea una nueva ejecución para comenzar.</p>
                            </motion.div>
                        ) : (
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                            >
                                {filteredExecutions.map(item => (
                                    <ExecutionCard key={item.ejecucion_id} item={item} />
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </Tabs>

            {/* Modals */}
            <EjecucionCrudModal
                isOpen={isCrudOpen}
                onClose={() => setIsCrudOpen(false)}
                onSave={fetchData}
                obraId={obraId}
                initialData={editingItem}
            />

            <EjecucionDetailModal
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                executionId={managingItem?.ejecucion_id}
                executionTitle={managingItem?.procedimiento_titulo}
                onUpdate={fetchData}
            />

            {/* New Personnel Assignment Modal */}
            <PersonnelAssignmentModal
                isOpen={isAssignOpen}
                onClose={() => setIsAssignOpen(false)}
                executionId={assigningItem?.ejecucion_id}
                executionTitle={assigningItem?.procedimiento_titulo}
                onAssignmentComplete={fetchData}
            />

            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" /> Confirmar eliminación
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Estás a punto de eliminar el proceso <strong>{itemToDelete?.procedimiento_titulo}</strong>.
                            Esta acción eliminará todos los pasos, evidencias y asignaciones relacionadas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); handleConfirmDelete(); }}
                            disabled={deleting}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default ObraProcesosTab;