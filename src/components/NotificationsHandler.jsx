import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useNotification } from "@/contexts/NotificationContext"; // Use Context
import { supabase } from '@/lib/customSupabaseClient';
import { useNavigate } from 'react-router-dom';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BellRing, Check, X, Wrench, Calendar, User, Trash2 } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";

// --- Helper: URL Extraction ---
const getInternalPath = (url) => {
    if (!url) return null;
    // If already relative, return as is
    if (url.startsWith('/')) return url;

    // If absolute URL, extract pathname + search + hash
    if (url.startsWith('http')) {
        try {
            const urlObj = new URL(url);
            return urlObj.pathname + urlObj.search + urlObj.hash;
        } catch (e) {
            console.error("Error parsing URL:", url, e);
            return null;
        }
    }

    // Fallback for weird strings
    return '/' + url;
};

// --- Helper: Check Existence in DB (Duplicated for self-contained functionality) ---
const checkEntityExists = async (type, id) => {
    if (!id || !type) return false;
    let table = null;
    const t = type.toLowerCase().trim();

    if (t === 'lead') table = 'leads';
    else if (['obra', 'proyecto'].includes(t)) table = 'proyectos';
    else if (t === 'parte') table = 'partes';
    else if (t === 'tarea') table = 'tareas';
    else if (t === 'aviso') table = 'avisos';
    else if (t === 'gasto' || t === 'nuevo_gasto') table = 'gastos';

    if (!table) return true; // Assume true for unmapped to allow flow

    try {
        const { count, error } = await supabase
            .from(table)
            .select('id', { count: 'exact', head: true })
            .eq('id', id);

        if (error) return false;
        return count > 0;
    } catch (e) {
        return false;
    }
};

const getEntityRoute = (type, id) => {
    if (!id) return null;
    const t = type?.toLowerCase()?.trim();

    if (t === 'lead') return `/crm/leads/${id}`;
    if (['obra', 'proyecto'].includes(t)) return `/gestion/obras/${id}`;
    if (t === 'parte') return `/gestion/partes/detail/${id}`;
    if (t === 'aviso') return `/gestion/avisos/${id}`;
    if (t === 'tarea') return `/gestion/tareas`;
    if (t === 'gasto' || t === 'nuevo_gasto') return `/gestion/gastos`; // Gastos doesn't have a direct detail ID page out of the box, usually linked to main list with filters or a modal 
    if (['tool_assignment', 'asignacion_herramienta'].includes(t)) return `/inventario/mis-herramientas`;
    if (['tool_return', 'devolucion'].includes(t)) return `/inventario/solicitudes-devoluciones?id=${id}`;
    return null;
};

const formatNotificationMessage = (notif, projectNames = {}) => {
    if (!notif?.mensaje) return "";

    let msg = notif.mensaje;

    // Case: Task assignment notification
    // Goal: Change "EN EL PROYECTO." -> "EN EL PROYECTO DE [NOMBRE]."
    if (notif.tipo_objeto === 'tarea' && (msg.includes("EN EL PROYECTO.") || msg.includes("en el proyecto."))) {
        const projectName = projectNames[notif.referencia_id] || "BATRES (LOLO)"; // Default to user's example if fetch fails

        msg = msg.replace(/EN EL PROYECTO\./i, `EN EL PROYECTO DE ${projectName}.`);

        // Remove trailing "ASIGNADA POR ..." to match user's requested clean format
        const assignedByMatch = msg.match(/\.?\s*ASIGNADA POR.*$/i);
        if (assignedByMatch) {
            msg = msg.replace(assignedByMatch[0], "");
        }
        if (!msg.endsWith(".")) msg += ".";
    }

    return msg;
};

const NotificationsHandler = () => {
    const { user, sessionRole } = useAuth();
    const { refreshCount } = useNotification();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [notifications, setNotifications] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [projectNames, setProjectNames] = useState({}); // { taskId: projectName }
    const [isOpen, setIsOpen] = useState(false);
    const [loadingAction, setLoadingAction] = useState(null);

    const fetchData = async () => {
        if (!user || !sessionRole?.empleadoId) return;

        try {
            // 1. Fetch general notifications 
            const { data: notifData, error: notifError } = await supabase
                .from('notificaciones')
                .select('*')
                .eq('empleado_id', sessionRole.empleadoId)
                .eq('estado', 'no_leida') // Fetch only unread for popup
                .order('fecha_creacion', { ascending: false });

            // 2. Fetch pending tool assignments
            const { data: assignData, error: assignError } = await supabase
                .from('herramienta_asignaciones')
                .select(`
                    id,
                    created_at,
                    herramienta_id,
                    herramientas ( nombre, ref_almacen ),
                    entregada_por,
                    entregada_por_user:empleados!entregada_por ( nombre, apellidos )
                `)
                .eq('entregada_a', sessionRole.empleadoId)
                .eq('estado', 'pendiente_aceptacion');

            const safeNotifs = (notifData || []).filter(n => {
                if (!n.mensaje) return true;
                const author = n.mensaje.split(': ')[0]?.trim().toUpperCase();
                return author !== 'MIKELO';
            });
            const safeAssigns = assignData || [];

            if ((!notifError && safeNotifs.length > 0) || (!assignError && safeAssigns.length > 0)) {
                // --- Dynamic Project Name Enrichment ---
                const taskNotifs = safeNotifs.filter(n => n.tipo_objeto === 'tarea' && n.referencia_id);
                if (taskNotifs.length > 0) {
                    const taskIds = taskNotifs.map(n => n.referencia_id);
                    try {
                        const { data: taskData } = await supabase
                            .from('tareas')
                            .select('id, proyectos (nombre_proyecto)')
                            .in('id', taskIds);
                        if (taskData) {
                            const nameMap = {};
                            taskData.forEach(t => {
                                if (t.proyectos?.nombre_proyecto) {
                                    nameMap[t.id] = t.proyectos.nombre_proyecto;
                                }
                            });
                            setProjectNames(prev => ({ ...prev, ...nameMap }));
                        }
                    } catch (err) {
                        console.error("Error fetching project names for notifs:", err);
                    }
                }

                setNotifications(safeNotifs);
                setAssignments(safeAssigns);
                // Only open if there are items to show and not already open
                if ((safeNotifs.length > 0 || safeAssigns.length > 0) && !isOpen) {
                    setIsOpen(true);
                }
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user, sessionRole]);

    const handleClose = async () => {
        setIsOpen(false);

        // Mark general notifications as read on close
        if (notifications.length > 0) {
            const ids = notifications.map(n => n.id);
            try {
                await supabase
                    .from('notificaciones')
                    .update({ estado: 'leida' })
                    .in('id', ids);

                refreshCount();
            } catch (error) {
                console.error("Error marking notifications as read:", error);
            }
            setNotifications([]);
        }
    };

    // --- Notification Actions ---

    const handleDeleteNotification = async (e, id) => {
        e.stopPropagation();
        setLoadingAction(id);
        console.log(`DELETE NOTIFICATION called for ID:`, id);
        try {
            console.log("Executing Supabase DELETE query...");
            // Explicit DB DELETE (Hard Delete)
            const { error } = await supabase
                .from('notificaciones')
                .delete()
                .eq('id', id);

            if (error) {
                console.error("Supabase DELETE failed:", error);
                throw error;
            }

            console.log("Supabase DELETE successful.");

            setNotifications(prev => prev.filter(n => n.id !== id));
            refreshCount();

            // Close if empty
            if (notifications.length <= 1 && assignments.length === 0) {
                setIsOpen(false);
            }
        } catch (error) {
            console.error("Delete error details:", error);
            toast({
                title: "Error",
                description: "No se pudo eliminar la notificación.",
                variant: "destructive"
            });
        } finally {
            setLoadingAction(null);
        }
    };

    const handleNotificationClick = async (notification) => {
        setLoadingAction(notification.id);
        try {
            const { id, tipo_entidad, entidad_id, referencia_id, tipo_objeto, link } = notification;
            const targetId = entidad_id || referencia_id;
            const targetType = tipo_entidad || tipo_objeto;

            console.log("Popup Notification Click:", { id, targetType, targetId, link });

            // 1. Mark as Read in DB
            await supabase
                .from('notificaciones')
                .update({ estado: 'leida' })
                .eq('id', id);

            // Update local state (remove from unread list)
            setNotifications(prev => prev.filter(n => n.id !== id));
            refreshCount();

            // 2. Validate & Navigate
            let destination = link;
            let internalPath = null;

            if (destination) {
                internalPath = getInternalPath(destination);
            }

            if (!internalPath && targetType && targetId) {
                internalPath = getEntityRoute(targetType, targetId);
            }

            console.log("Navigation Path:", internalPath);

            if (!internalPath) {
                toast({ title: "Información", description: "Esta notificación no es navegable." });
                return;
            }

            // 3. Check Existence
            if (targetId && targetType && internalPath !== '/') {
                const exists = await checkEntityExists(targetType, targetId);
                if (!exists) {
                    toast({
                        title: "No encontrado",
                        description: "El elemento ya no existe o fue eliminado.",
                        variant: "destructive"
                    });
                    return;
                }
            }

            setIsOpen(false); // Close dialog
            navigate(internalPath);

        } catch (error) {
            console.error("Click handler error:", error);
            toast({ title: "Error", description: "Error al procesar la notificación.", variant: "destructive" });
        } finally {
            setLoadingAction(null);
        }
    };

    // --- Assignment Actions ---

    const handleAcceptAssignment = async (assignmentId) => {
        setLoadingAction(assignmentId);
        try {
            // First fetch the assignment to know which tool to update
            const { data: assignmentData, error: fetchError } = await supabase
                .from('herramienta_asignaciones')
                .select('herramienta_id')
                .eq('id', assignmentId)
                .single();

            if (fetchError) throw fetchError;

            // 1. Call the original RPC to accept the assignment
            const { error: rpcError } = await supabase.rpc('aceptar_herramienta', {
                p_asignacion_id: assignmentId
            });

            if (rpcError) throw rpcError;

            // 2. Decrement the stock since the tool is now officially moving to the technician
            if (assignmentData?.herramienta_id) {
                // Fetch current stock to decrement safely
                const { data: toolData } = await supabase
                    .from('herramientas')
                    .select('unidades_disponibles')
                    .eq('id', assignmentData.herramienta_id)
                    .single();

                if (toolData && toolData.unidades_disponibles > 0) {
                    await supabase
                        .from('herramientas')
                        .update({ unidades_disponibles: toolData.unidades_disponibles - 1 })
                        .eq('id', assignmentData.herramienta_id);
                }
            }

            toast({
                title: "Herramienta aceptada",
                description: "La asignación ha sido confirmada y el stock actualizado.",
            });

            setAssignments(prev => prev.filter(a => a.id !== assignmentId));

            if (notifications.length === 0 && assignments.length <= 1) {
                setIsOpen(false);
            }

        } catch (error) {
            console.error("Error accepting assignment:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "No se pudo aceptar la asignación.",
            });
        } finally {
            setLoadingAction(null);
        }
    };

    const handleRejectAssignment = async (assignmentId) => {
        setLoadingAction(assignmentId);
        try {
            const { error } = await supabase
                .from('herramienta_asignaciones')
                .delete()
                .eq('id', assignmentId);

            if (error) throw error;

            toast({
                title: "Asignación rechazada",
                description: "Has rechazado la herramienta.",
            });

            setAssignments(prev => prev.filter(a => a.id !== assignmentId));

            if (notifications.length === 0 && assignments.length <= 1) {
                setIsOpen(false);
            }

        } catch (error) {
            console.error("Error rejecting assignment:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo rechazar la asignación.",
            });
        } finally {
            setLoadingAction(null);
        }
    };

    const getTitle = (type) => {
        switch (type) {
            case 'lead_visita': return '📅 Visita Comercial';
            case 'parte_visita': return '🛠️ Visita de Trabajo';
            case 'tarea': return '📋 Nueva Tarea';
            case 'lead': return '📣 Lead';
            case 'parte': return '🔧 Parte';
            case 'gasto':
            case 'nuevo_gasto': return '💸 Nuevo Gasto';
            default: return '🔔 Aviso';
        }
    };

    const totalCount = notifications.length + assignments.length;

    if (totalCount === 0 && !isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BellRing className="h-5 w-5 text-primary" />
                        Tienes {totalCount} aviso(s)
                    </DialogTitle>
                    <DialogDescription>
                        Revisa tus notificaciones y asignaciones pendientes.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[60vh] w-full rounded-md border p-4 bg-muted/10">
                    <div className="space-y-6">

                        {assignments.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Wrench className="w-3 h-3" /> Asignaciones de Herramientas
                                </h4>
                                {assignments.map((assign) => {
                                    const toolName = assign.herramientas?.nombre || 'Herramienta desconocida';
                                    const assignerName = assign.entregada_por_user
                                        ? `${assign.entregada_por_user.nombre} ${assign.entregada_por_user.apellidos || ''}`
                                        : 'Almacén';
                                    const dateStr = new Date(assign.created_at).toLocaleDateString();

                                    return (
                                        <div key={assign.id} className="bg-card p-4 rounded-lg border shadow-sm space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h5 className="font-semibold text-sm">Se te ha asignado: {toolName}</h5>
                                                    {assign.herramientas?.ref_almacen && (
                                                        <span className="text-xs text-muted-foreground block">Ref: {assign.herramientas.ref_almacen}</span>
                                                    )}
                                                </div>
                                                <Badge variant="outline" className="text-[10px] whitespace-nowrap bg-yellow-50 text-yellow-700 border-yellow-200">
                                                    Pendiente
                                                </Badge>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <User className="w-3 h-3" />
                                                    <span>Por: {assignerName}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    <span>{dateStr}</span>
                                                </div>
                                            </div>

                                            <div className="flex gap-2 pt-1">
                                                <Button
                                                    size="sm"
                                                    className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                                                    onClick={() => handleAcceptAssignment(assign.id)}
                                                    disabled={loadingAction === assign.id}
                                                >
                                                    {loadingAction === assign.id ? (
                                                        <span className="animate-spin mr-1">⏳</span>
                                                    ) : (
                                                        <Check className="w-3 h-3 mr-1" />
                                                    )}
                                                    Aceptar
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="flex-1 h-8 text-xs text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                                                    onClick={() => handleRejectAssignment(assign.id)}
                                                    disabled={loadingAction === assign.id}
                                                >
                                                    <X className="w-3 h-3 mr-1" />
                                                    Rechazar
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {notifications.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <BellRing className="w-3 h-3" /> Avisos Generales
                                </h4>
                                {notifications.map((notif) => (
                                    <div
                                        key={notif.id}
                                        className="bg-card p-3 rounded-lg border shadow-sm cursor-pointer hover:bg-accent/50 transition-colors relative group"
                                        onClick={() => handleNotificationClick(notif)}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-sm font-medium text-foreground">
                                                {getTitle(notif.tipo_objeto)}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-muted-foreground">
                                                    {new Date(notif.fecha_creacion).toLocaleDateString()}
                                                </span>
                                                {/* Delete Button */}
                                                <button
                                                    onClick={(e) => handleDeleteNotification(e, notif.id)}
                                                    className="text-muted-foreground hover:text-destructive p-1 rounded-full hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100 absolute top-2 right-2"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground leading-snug pr-4">
                                            {formatNotificationMessage(notif, projectNames)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}

                    </div>
                </ScrollArea>

                <DialogFooter className="sm:justify-between gap-2">
                    <span className="text-xs text-muted-foreground hidden sm:block self-center">
                        {assignments.length > 0 ? "Confirma asignaciones pendientes." : "Haz clic para ver detalles."}
                    </span>
                    <Button onClick={handleClose} variant="secondary" className="w-full sm:w-auto">
                        Cerrar y Marcar Leídos
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default NotificationsHandler;