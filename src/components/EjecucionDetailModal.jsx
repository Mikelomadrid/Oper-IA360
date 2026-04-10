import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { 
    Loader2, CheckCircle2, Circle, AlertCircle, FileText, Upload, X, 
    ChevronRight, ChevronDown, CheckSquare, Save, Image as ImageIcon,
    Users, UserPlus, Shield
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import PersonnelAssignmentModal from '@/components/PersonnelAssignmentModal';

// --- HELPER: Personnel Sidebar Item ---
const PersonnelItem = ({ employee, role }) => (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
        <Avatar className="w-8 h-8 border border-slate-200">
            <AvatarImage src={employee?.foto_url} />
            <AvatarFallback className={cn(
                "text-xs",
                role === 'encargado' ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
            )}>
                {employee?.nombre?.substring(0,2).toUpperCase() || '??'}
            </AvatarFallback>
        </Avatar>
        <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium truncate">
                {employee?.nombre || 'Usuario'} {employee?.apellidos || ''}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                {role === 'encargado' ? <Shield className="w-3 h-3 text-blue-500" /> : <Users className="w-3 h-3 text-emerald-500" />}
                {role}
            </span>
        </div>
    </div>
);

// --- HELPER COMPONENT: Step Item ---
const StepItem = ({ step, onComplete, onSaveNote, onUploadEvidence, isReadOnly }) => {
    const [isExpanded, setIsExpanded] = useState(step.estado !== 'hecho');
    const [note, setNote] = useState(step.notas || '');
    const [savingNote, setSavingNote] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Sync local state if prop updates
    useEffect(() => setNote(step.notas || ''), [step.notas]);

    const handleSaveNote = async () => {
        setSavingNote(true);
        await onSaveNote(step.id, note);
        setSavingNote(false);
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setIsUploading(true);
        await onUploadEvidence(step.id, file);
        setIsUploading(false);
        e.target.value = ''; 
    };

    const isDone = step.estado === 'hecho';

    return (
        <div className={cn(
            "border rounded-lg mb-3 overflow-hidden transition-all duration-300",
            isDone ? "bg-slate-50 dark:bg-slate-900/50 border-emerald-200 dark:border-emerald-900/30" : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm"
        )}>
            {/* Step Header / Trigger */}
            <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors",
                        isDone 
                            ? "bg-emerald-500 border-emerald-500 text-white" 
                            : "border-slate-300 text-transparent"
                    )}>
                        <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className={cn(
                            "font-medium text-sm leading-tight",
                            isDone ? "text-slate-600 dark:text-slate-400 line-through decoration-slate-400" : "text-slate-900 dark:text-slate-100"
                        )}>
                            {step.titulo}
                        </h4>
                        {step.obligatorio && !isDone && (
                            <span className="text-[10px] text-red-500 font-semibold tracking-wide uppercase mt-0.5 block">Obligatorio</span>
                        )}
                    </div>
                </div>
                {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </div>

            {/* Step Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-800 space-y-4">
                            {/* Description */}
                            {step.descripcion && (
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 italic">
                                    {step.descripcion}
                                </p>
                            )}

                            {/* Evidences List */}
                            {step.evidencias && step.evidencias.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase text-slate-500 flex items-center gap-1">
                                        <ImageIcon className="w-3 h-3" /> Evidencias Adjuntas
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {step.evidencias.map((ev, idx) => (
                                            <a 
                                                key={idx} 
                                                href={ev.signed_url || '#'} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 text-xs bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-md hover:bg-slate-200 transition-colors text-blue-600 hover:underline"
                                            >
                                                <FileText className="w-3 h-3" />
                                                {ev.object_path?.split('/').pop() || `Archivo ${idx + 1}`}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Actions Area (only if editable) */}
                            {!isReadOnly && (
                                <div className="space-y-3 pt-2">
                                    {/* Notes */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-500">Notas / Observaciones</label>
                                        <div className="flex gap-2">
                                            <Textarea 
                                                value={note}
                                                onChange={(e) => setNote(e.target.value)}
                                                placeholder="Escribe observaciones aquí..."
                                                className="min-h-[60px] text-sm resize-none bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                            />
                                            {note !== step.notas && (
                                                <Button size="icon" variant="outline" onClick={handleSaveNote} disabled={savingNote} className="h-auto w-10 shrink-0">
                                                    {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                        {/* Upload Evidence */}
                                        {step.requiere_evidencia && (
                                            <div className="relative">
                                                <input 
                                                    type="file" 
                                                    id={`upload-${step.id}`} 
                                                    className="hidden" 
                                                    onChange={handleFileChange}
                                                    disabled={isUploading}
                                                />
                                                <Button variant="outline" size="sm" className="gap-2 h-8" disabled={isUploading} asChild>
                                                    <label htmlFor={`upload-${step.id}`} className="cursor-pointer">
                                                        {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                                        Subir Evidencia
                                                    </label>
                                                </Button>
                                            </div>
                                        )}

                                        {/* Mark as Done */}
                                        <Button 
                                            size="sm" 
                                            className={cn(
                                                "gap-2 ml-auto h-8 shadow-sm transition-all", 
                                                isDone 
                                                    ? "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" 
                                                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                            )}
                                            onClick={() => onComplete(step.id, !isDone)}
                                        >
                                            {isDone ? (
                                                <>Desmarcar <Circle className="w-3.5 h-3.5" /></>
                                            ) : (
                                                <>Completar Paso <CheckSquare className="w-3.5 h-3.5" /></>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- MAIN MODAL COMPONENT ---
const EjecucionDetailModal = ({ isOpen, onClose, executionId, executionTitle, onUpdate }) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [steps, setSteps] = useState([]);
    const [execution, setExecution] = useState(null);
    const [assignments, setAssignments] = useState([]);
    
    // Sub-modal state
    const [personnelModalOpen, setPersonnelModalOpen] = useState(false);

    useEffect(() => {
        if (isOpen && executionId) {
            fetchDetails();
        } else {
            setSteps([]);
            setExecution(null);
            setAssignments([]);
        }
    }, [isOpen, executionId]);

    const fetchDetails = async () => {
        setLoading(true);
        try {
            // 1. Get Execution Data
            const { data: execData, error: execError } = await supabase
                .from('ejecuciones_v2')
                .select('*')
                .eq('id', executionId)
                .single();
            
            if (execError) throw execError;
            setExecution(execData);

            // 2. Get Assignments (Join with employees)
            const { data: assignData, error: assignError } = await supabase
                .from('ejecucion_asignaciones_v2')
                .select('rol, user_id')
                .eq('ejecucion_id', executionId);
            
            if (assignError) console.warn("Error fetching assignments", assignError);

            if (assignData && assignData.length > 0) {
                // Fetch employee details for these user_ids
                const userIds = assignData.map(a => a.user_id);
                const { data: empData } = await supabase
                    .from('empleados')
                    .select('auth_user_id, nombre, apellidos, foto_url')
                    .in('auth_user_id', userIds);
                
                // Map back
                const mappedAssignments = assignData.map(a => ({
                    ...a,
                    employee: empData?.find(e => e.auth_user_id === a.user_id)
                }));
                setAssignments(mappedAssignments);
            } else {
                setAssignments([]);
            }

            // 3. Get Steps Data
            const { data: stepsData, error: stepsError } = await supabase
                .from('ejecucion_pasos_v2')
                .select(`
                    id, estado, notas, evidencias, completado_at,
                    procedimiento_pasos_v2 (
                        titulo, descripcion, obligatorio, requiere_evidencia, orden
                    )
                `)
                .eq('ejecucion_id', executionId)
                .order('procedimiento_pasos_v2(orden)', { ascending: true });

            if (stepsError) throw stepsError;

            // Flatten structure
            const formattedSteps = (stepsData || []).map(s => ({
                id: s.id,
                estado: s.estado,
                notas: s.notas,
                evidencias: s.evidencias || [], 
                completado_at: s.completado_at,
                titulo: s.procedimiento_pasos_v2?.titulo,
                descripcion: s.procedimiento_pasos_v2?.descripcion,
                obligatorio: s.procedimiento_pasos_v2?.obligatorio,
                requiere_evidencia: s.procedimiento_pasos_v2?.requiere_evidencia,
                orden: s.procedimiento_pasos_v2?.orden
            })).sort((a, b) => a.orden - b.orden);

            setSteps(formattedSteps);

        } catch (error) {
            console.error("Error fetching detail:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los detalles.' });
        } finally {
            setLoading(false);
        }
    };

    const handleCompleteStep = async (stepId, isCompleting) => {
        try {
            setSteps(prev => prev.map(s => 
                s.id === stepId ? { ...s, estado: isCompleting ? 'hecho' : 'pendiente' } : s
            ));

            if (isCompleting) {
                const { error } = await supabase.rpc('rpc_completar_paso_v2', {
                    p_ejecucion_paso_id: stepId
                });
                if (error) throw error;
                toast({ title: "Paso completado", duration: 1500 });
            } else {
                const { error } = await supabase
                    .from('ejecucion_pasos_v2')
                    .update({ estado: 'pendiente', completado_at: null })
                    .eq('id', stepId);
                if (error) throw error;
            }

            setTimeout(() => {
                fetchDetails();
                if (onUpdate) onUpdate();
            }, 500);

        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error al actualizar paso' });
            fetchDetails();
        }
    };

    const handleSaveNote = async (stepId, text) => {
        try {
            const { error } = await supabase
                .from('ejecucion_pasos_v2')
                .update({ notas: text })
                .eq('id', stepId);
            
            if (error) throw error;
            
            setSteps(prev => prev.map(s => s.id === stepId ? { ...s, notas: text } : s));
            toast({ title: "Nota guardada" });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al guardar nota' });
        }
    };

    const handleUploadEvidence = async (stepId, file) => {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
            const filePath = `ejecuciones/${executionId}/pasos/${stepId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('tarea_evidencias')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { error: rpcError } = await supabase.rpc('rpc_registrar_evidencia_archivo_v2', {
                p_ejecucion_paso_id: stepId,
                p_bucket_id: 'tarea_evidencias',
                p_object_path: filePath,
                p_mime_type: file.type,
                p_size_bytes: file.size
            });

            if (rpcError) throw rpcError;

            toast({ title: "Evidencia subida correctamente" });
            fetchDetails();

        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error al subir archivo', description: error.message });
        }
    };

    const isReadOnly = execution?.estado === 'completado' || execution?.estado === 'cancelado';

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl h-[90vh] md:h-[85vh] p-0 gap-0 overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950">
                
                {/* Header */}
                <DialogHeader className="p-6 pb-4 bg-white dark:bg-slate-900 border-b shrink-0 z-10 flex flex-row items-center justify-between">
                    <div className="flex-1 pr-8">
                        <div className="flex items-center gap-3">
                            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white leading-snug">
                                {executionTitle || 'Detalle del Proceso'}
                            </DialogTitle>
                            <Badge className={cn(
                                "capitalize text-xs px-2 py-0.5", 
                                execution?.estado === 'completado' ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                                execution?.estado === 'en_progreso' ? "bg-blue-100 text-blue-800 border-blue-200" :
                                "bg-slate-100 text-slate-800"
                            )}>
                                {execution?.estado?.replace('_', ' ') || 'Cargando...'}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                            ID: <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">{executionId?.slice(0, 8)}</span>
                        </p>
                    </div>
                    <Button 
                        variant="ghost" size="icon" className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 -mr-2" 
                        onClick={onClose}
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </DialogHeader>

                {/* Content Layout (Sidebar + Main) */}
                <div className="flex-1 overflow-hidden relative flex flex-col md:flex-row">
                    
                    {/* Left Sidebar: Team & Info */}
                    <div className="w-full md:w-80 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex flex-col overflow-y-auto">
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wider">Equipo</h3>
                                {!isReadOnly && (
                                    <Button size="xs" variant="ghost" className="h-7 w-7 p-0" onClick={() => setPersonnelModalOpen(true)}>
                                        <UserPlus className="w-4 h-4 text-blue-600" />
                                    </Button>
                                )}
                            </div>
                            
                            {loading ? (
                                <div className="space-y-3">
                                    <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                                    <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                                </div>
                            ) : assignments.length > 0 ? (
                                <div className="space-y-2">
                                    {assignments.sort((a,b) => (a.rol === 'encargado' ? -1 : 1)).map((a, i) => (
                                        <PersonnelItem key={i} employee={a.employee} role={a.rol} />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4 border border-dashed rounded-lg border-slate-200">
                                    <p className="text-xs text-muted-foreground">Sin personal asignado</p>
                                    {!isReadOnly && (
                                        <Button variant="link" className="text-xs h-auto p-0 mt-1" onClick={() => setPersonnelModalOpen(true)}>
                                            Asignar ahora
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main Content: Steps */}
                    <div className="flex-1 overflow-hidden relative bg-slate-50 dark:bg-slate-950/50">
                        {loading ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Loader2 className="w-10 h-10 animate-spin text-primary/50" />
                            </div>
                        ) : (
                            <ScrollArea className="h-full">
                                <div className="p-6 max-w-3xl mx-auto">
                                    {/* Progress Bar */}
                                    <div className="mb-8 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center justify-between text-sm font-medium mb-2 text-slate-600 dark:text-slate-400">
                                            <span>Progreso del Proceso</span>
                                            <span className="text-slate-900 dark:text-white font-bold">
                                                {steps.filter(s => s.estado === 'hecho').length} / {steps.length}
                                            </span>
                                        </div>
                                        <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out relative"
                                                style={{ width: `${(steps.filter(s => s.estado === 'hecho').length / (steps.length || 1)) * 100}%` }}
                                            >
                                                <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/30" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Steps List */}
                                    <div className="space-y-4 pb-10">
                                        {steps.map((step) => (
                                            <StepItem 
                                                key={step.id} 
                                                step={step} 
                                                onComplete={handleCompleteStep}
                                                onSaveNote={handleSaveNote}
                                                onUploadEvidence={handleUploadEvidence}
                                                isReadOnly={isReadOnly}
                                            />
                                        ))}
                                    </div>

                                    {steps.length === 0 && !loading && (
                                        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                                            <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                            <p>No hay pasos definidos para este proceso.</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t bg-white dark:bg-slate-900 shrink-0 flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>
                        Cerrar
                    </Button>
                </div>
            </DialogContent>

            {/* Personnel Modal */}
            <PersonnelAssignmentModal 
                isOpen={personnelModalOpen}
                onClose={() => setPersonnelModalOpen(false)}
                executionId={executionId}
                executionTitle={executionTitle}
                onAssignmentComplete={() => {
                    fetchDetails(); 
                    if (onUpdate) onUpdate();
                }}
            />
        </Dialog>
    );
};

export default EjecucionDetailModal;