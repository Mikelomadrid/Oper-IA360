import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
    Plus, Search, Loader2, Archive, ChevronsUpDown, Calendar, Construction,
    MoreVertical, Edit, Trash2, LayoutGrid, List as ListIcon, Columns, GripVertical,
    CheckCircle2, ChevronDown, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ProjectForm from '@/components/ProjectForm';
import { Helmet } from 'react-helmet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { fetchProjectMaterialNetTotals } from '@/lib/projectMaterialCosts';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

const formatCurrency = amount => {
    if (typeof amount !== 'number') return 'N/A';
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
};

const formatDate = dateString => {
    if (!dateString) return '-';
    try {
        const date = parseISO(dateString);
        return format(date, 'dd MMM yyyy', { locale: es });
    } catch (e) {
        return '-';
    }
};

// ============================================================
// Configuración del tablero Kanban de obras
// Las obras COBRADAS no aparecen como tarjetas sueltas en el tablero:
// la columna COBRADO muestra el Historial de Cobradas agrupado por mes.
// Marcar una obra como cobrada se hace desde el menú ⋮ de su tarjeta.
// ============================================================
const KANBAN_COLUMNS = ['en_espera', 'activo', 'terminado', 'facturado', 'cobrado'];
const KANBAN_DROP_COLUMNS = KANBAN_COLUMNS.filter(c => c !== 'cobrado');

const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return isMobile;
};

const KANBAN_STYLES = {
    activo:     { label: 'ACTIVO',       bg: '#dcfce7', text: '#15803d', br: '#86efac' },
    en_espera:  { label: 'PENDIENTE',     bg: '#fef3c7', text: '#b45309', br: '#fcd34d' },
    terminado:  { label: 'TERMINADO',    bg: '#dbeafe', text: '#1d4ed8', br: '#93c5fd' },
    facturado:  { label: 'FACTURADO',    bg: '#ede9fe', text: '#6d28d9', br: '#c4b5fd' },
    cobrado:    { label: 'HISTORIAL',    bg: '#d1fae5', text: '#047857', br: '#6ee7b7' },
};

const ProjectCard = ({ project, onClick, onEdit, onDelete, canManage }) => {
    const budget = project.presupuesto_aceptado || 0;
    const expenses = project.costo_total || 0;
    const margin = project.margen || 0;
    const marginColor = margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={onClick}
            className="bg-card rounded-lg md:rounded-xl border border-border/40 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden active:scale-[0.98] group relative"
        >
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div className="p-2 md:p-5 relative z-10 h-full flex flex-col">
                <div className="flex justify-between items-start gap-2 mb-2 md:mb-4">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-xs sm:text-sm md:text-lg font-bold text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors break-words">
                            {project.nombre_proyecto}
                        </h3>
                        <div className="flex items-center text-[10px] md:text-xs text-muted-foreground gap-1 mt-1">
                            <Calendar className="w-3 h-3 hidden sm:block" />
                            <span className="truncate">{formatDate(project.fecha_creacion)}</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-1">
                        {project.estado && (
                            <Badge variant="outline" className="text-[9px] md:text-[10px] px-1 md:px-1.5 py-0 h-4 md:h-5 uppercase tracking-wider bg-muted/50 text-muted-foreground border-border/50 shrink-0">
                                {project.estado === 'en_curso' ? 'Activo' : project.estado === 'facturado' ? 'Fact.' : project.estado === 'cobrado' ? 'Cobrado' : project.estado === 'cerrado' ? 'Cerrado' : project.estado}
                            </Badge>
                        )}
                        {canManage && (
                            <div onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-1 hover:bg-muted rounded-full">
                                            <MoreVertical className="h-3.5 w-3.5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => onEdit(project.proyecto_id)}>
                                            <Edit className="mr-2 h-4 w-4" /> Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDelete(project.proyecto_id)} className="text-destructive focus:text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2 pt-2 md:pt-3 border-t border-dashed border-border/60">
                        <div className="flex sm:flex-col justify-between sm:justify-start items-center sm:items-start">
                            <span className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wide">Presup.</span>
                            <span className="text-[10px] md:text-sm font-medium text-foreground truncate ml-2 sm:ml-0">{formatCurrency(budget)}</span>
                        </div>
                        <div className="flex sm:flex-col justify-between sm:justify-start items-center sm:items-start sm:text-left">
                            <span className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wide">Gastos</span>
                            <span className="text-[10px] md:text-sm font-medium text-red-500/90 truncate ml-2 sm:ml-0">{formatCurrency(expenses)}</span>
                        </div>
                        <div className="flex sm:flex-col justify-between sm:justify-end items-center sm:items-end sm:text-right">
                            <span className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wide">Margen</span>
                            <span className={`text-[10px] md:text-sm font-bold ${marginColor} truncate ml-2 sm:ml-0`}>{formatCurrency(margin)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const ProjectList = ({ projects, onClick, onEdit, onDelete, canManage }) => {
    return (
        <div className="rounded-md border bg-card">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[40%]">Proyecto</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right hidden md:table-cell">Presupuesto</TableHead>
                        <TableHead className="text-right hidden md:table-cell">Gastos</TableHead>
                        <TableHead className="text-right hidden md:table-cell">Margen</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {projects.map((project) => {
                        const margin = project.margen || 0;
                        const marginColor = margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';

                        return (
                            <TableRow
                                key={project.proyecto_id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => onClick(project)}
                            >
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium line-clamp-1">{project.nombre_proyecto}</span>
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {formatDate(project.fecha_creacion)}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {project.estado && (
                                        <Badge variant="outline" className="capitalize font-normal bg-muted/50">
                                            {project.estado === 'en_curso' ? 'Activo' : project.estado === 'facturado' ? 'Facturado' : project.estado === 'cobrado' ? 'Cobrado' : project.estado === 'cerrado' ? 'Cerrado' : project.estado}
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right hidden md:table-cell font-medium">
                                    {formatCurrency(project.presupuesto_aceptado || 0)}
                                </TableCell>
                                <TableCell className="text-right hidden md:table-cell text-red-500/90">
                                    {formatCurrency(project.costo_total || 0)}
                                </TableCell>
                                <TableCell className={`text-right hidden md:table-cell font-bold ${marginColor}`}>
                                    {formatCurrency(margin)}
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                    {canManage && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => onEdit(project.proyecto_id)}>
                                                    <Edit className="mr-2 h-4 w-4" /> Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onDelete(project.proyecto_id)} className="text-destructive focus:text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
};


const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
};


const Projects = ({ navigate }) => {
    const { sessionRole, loadingAuth } = useAuth();
    const isMobile = useIsMobile();
    const [projects, setProjects] = useState([]);
    const [facturadoProjects, setFacturadoProjects] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProject, setEditingProject] = useState(null);

    // ACTUALIZADO: 'grid' | 'list' | 'kanban' (persistido). Por defecto: kanban.
    const [viewMode, setViewMode] = useState(() => {
        try { return localStorage.getItem('projects_view_mode') || 'kanban'; } catch { return 'kanban'; }
    });

    useEffect(() => {
        try { localStorage.setItem('projects_view_mode', viewMode); } catch {}
    }, [viewMode]);

    // NUEVO: Estados para drag & drop del Kanban
    const [draggedProjectId, setDraggedProjectId] = useState(null);
    const [dragOverColumn, setDragOverColumn] = useState(null);
    const justDraggedRef = useRef(false);
    const [openMobileKanbanColumn, setOpenMobileKanbanColumn] = useState(null);
    const effectiveViewMode = isMobile ? 'kanban' : viewMode;

    // Recordar qué mes del historial estaba abierto al volver (vistas grid/list)
    const [openMonth, setOpenMonth] = useState(() => {
        try { return localStorage.getItem('historial_mes_abierto') || null; } catch { return null; }
    });

    // NUEVO: Qué mes está abierto dentro de la columna COBRADO del Kanban
    const [kanbanHistorialMonth, setKanbanHistorialMonth] = useState(() => {
        try { return localStorage.getItem('kanban_historial_mes_abierto') || null; } catch { return null; }
    });

    // Delete confirmation state
    const [deleteId, setDeleteId] = useState(null);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const debouncedSearchTerm = useDebounce(searchTerm, 350);
    // Buscando activamente: se usa para auto-expandir TODOS los meses del
    // Historial de Cobradas (antes había que abrir mes a mes a ciegas).
    const isSearching = debouncedSearchTerm.trim().length > 0;

    const groupFacturadoProjects = (projects) => {
        return projects.reduce((acc, project) => {
            // Prioridad: fecha_cobrado (cuando pasó a COBRADO) > fecha_fin_real >
            // fecha_finalizacion_estimada > fecha_creacion como último fallback.
            const dateStr = project.fecha_cobrado || project.fecha_fin_real || project.fecha_finalizacion_estimada || project.fecha_creacion;
            const date = parseISO(dateStr);
            const key = format(date, 'MMMM yyyy', { locale: es });
            const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
            if (!acc[capitalizedKey]) {
                acc[capitalizedKey] = [];
            }
            acc[capitalizedKey].push(project);
            return acc;
        }, {});
    };

    const fetchProjects = useCallback(async () => {
        setLoading(true);
        try {
            const { error: activationError } = await supabase.rpc('activar_obras_por_fecha_inicio');
            if (activationError) console.warn('[Projects] No se pudo sincronizar el inicio automático:', activationError);

            // 1. Fetch project KPIs (currently missing labor in the view's costo_total)
            let query = supabase
                .from('v_proyecto_kpis_con_estado')
                .select('*');

            if (debouncedSearchTerm) {
                // Búsqueda ampliada: nombre de obra, cliente/contacto, dirección y teléfono
                // (antes solo buscaba por nombre_proyecto).
                const term = debouncedSearchTerm.replace(/[%,]/g, '');
                query = query.or(
                    `nombre_proyecto.ilike.%${term}%,contacto_nombre.ilike.%${term}%,direccion_obra.ilike.%${term}%,contacto_telefono.ilike.%${term}%`
                );
            }

            let { data: projectsData, error: projectsError } = await query;

            // Compatibilidad con instalaciones antiguas: algunas bases no tienen
            // actualizada la vista de KPIs o la vista devuelve 0 filas por RLS.
            // En ese caso recuperamos las obras directamente desde proyectos para
            // que el tablero no aparezca vacío después de publicar una compilación.
            if (projectsError || !projectsData?.length) {
                console.warn('[Projects] Fallback a tabla proyectos:', projectsError || 'vista sin filas');
                let fallbackQuery = supabase
                    .from('proyectos')
                    .select('*')
                    .order('fecha_creacion', { ascending: true });

                const { data: fallbackData, error: fallbackError } = await fallbackQuery;
                if (fallbackError) throw (projectsError || fallbackError);

                projectsData = (fallbackData || []).map(project => ({
                    ...project,
                    proyecto_id: project.proyecto_id || project.id,
                    margen: Number(project.presupuesto_aceptado || 0) - Number(project.costo_total || 0),
                }));
                projectsError = null;
            }

            if (projectsData) {
                // 1.5 Targeted fetch for labor to avoid RLS/limits issues
                const projectIds = projectsData.map(p => p.proyecto_id).filter(Boolean);

                const [laborResult, materialBaseTotals] = await Promise.all([
                    supabase
                        .from('ui_v_proyecto_mano_obra_totales_v2')
                        .select('proyecto_id, coste_total_mano_obra')
                        .in('proyecto_id', projectIds),
                    fetchProjectMaterialNetTotals(projectIds),
                ]);

                const { data: laborData, error: laborError } = laborResult;

                if (laborError) {
                    console.error("[Projects] Labor fetch error:", laborError);
                }

                // 3. Merge and recalculate
                const processedData = projectsData.map(project => {
                    const laborEntry = laborData?.find(l => String(l.proyecto_id) === String(project.proyecto_id));
                    const laborCost = laborEntry ? parseFloat(laborEntry.coste_total_mano_obra || 0) : 0;

                    // El presupuesto está sin IVA, por lo que el material debe usar base imponible.
                    const materialCost = materialBaseTotals[String(project.proyecto_id)] || 0;
                    const totalCostUpdated = materialCost + laborCost;
                    const margenUpdated = (project.presupuesto_aceptado || 0) - totalCostUpdated;

                    return {
                        ...project,
                        costo_total: totalCostUpdated,
                        margen: margenUpdated,
                        coste_mano_obra: laborCost,
                        coste_total_materiales: materialCost,
                        coste_materiales: materialCost
                    };
                });

                // ============================================================
                // Las FACTURADAS permanecen en el tablero/listado activo.
                // Solo COBRADAS y CERRADAS pasan al historial mensual.
                // ============================================================
                const HISTORIAL_STATES = ['cobrado', 'cerrado'];

                // 4. Fetch fechas min/max del cronograma por proyecto
                const activeIds = processedData
                    .filter(p => !HISTORIAL_STATES.includes(p.estado))
                    .map(p => p.proyecto_id).filter(Boolean);

                let cronogramaMap = {};
                if (activeIds.length > 0) {
                    const { data: tareasData } = await supabase
                        .from('tareas')
                        .select('proyecto_id, fecha_inicio, fecha_limite')
                        .in('proyecto_id', activeIds)
                        .not('fecha_inicio', 'is', null)
                        .not('fecha_limite', 'is', null);

                    if (tareasData) {
                        tareasData.forEach(t => {
                            if (!cronogramaMap[t.proyecto_id]) {
                                cronogramaMap[t.proyecto_id] = { min: t.fecha_inicio, max: t.fecha_limite };
                            } else {
                                if (t.fecha_inicio < cronogramaMap[t.proyecto_id].min) cronogramaMap[t.proyecto_id].min = t.fecha_inicio;
                                if (t.fecha_limite > cronogramaMap[t.proyecto_id].max) cronogramaMap[t.proyecto_id].max = t.fecha_limite;
                            }
                        });
                    }
                }

                const active = processedData
                    .filter(p => !HISTORIAL_STATES.includes(p.estado))
                    .map(p => ({
                        ...p,
                        cronograma_inicio: cronogramaMap[p.proyecto_id]?.min || null,
                        cronograma_fin: cronogramaMap[p.proyecto_id]?.max || null,
                    }))
                    .sort((a, b) => {
                        // 1. Prioritize state: 'en_espera' goes last
                        const isAWaiting = a.estado === 'en_espera' || a.estado === 'pendiente';
                        const isBWaiting = b.estado === 'en_espera' || b.estado === 'pendiente';

                        if (isAWaiting && !isBWaiting) return 1;
                        if (!isAWaiting && isBWaiting) return -1;

                        // 2. Both are in same status group (Active or Waiting)
                        // Use fecha_inicio if available, otherwise fallback to fecha_creacion
                        // This ensures consistent "Oldest First" (Ascending) sorting within groups
                        const dateA = new Date(a.fecha_inicio || a.fecha_creacion);
                        const dateB = new Date(b.fecha_inicio || b.fecha_creacion);

                        if (dateA < dateB) return -1;
                        if (dateA > dateB) return 1;

                        // 3. Absolute fallback
                        return 0;
                    });

                const facturado = processedData.filter(p => HISTORIAL_STATES.includes(p.estado));

                // Asegurar que tenemos fecha_fin_real y fecha_cobrado para el historial
                const facturadoIds = facturado.map(p => p.proyecto_id).filter(Boolean);
                let fechasExtra = {};
                if (facturadoIds.length > 0) {
                    const { data: fechasData } = await supabase
                        .from('proyectos')
                        .select('id, fecha_fin_real, fecha_cobrado')
                        .in('id', facturadoIds);
                    if (fechasData) {
                        fechasData.forEach(p => { fechasExtra[p.id] = p; });
                    }
                }
                const facturadoConFecha = facturado.map(p => ({
                    ...p,
                    fecha_fin_real: fechasExtra[p.proyecto_id]?.fecha_fin_real || p.fecha_fin_real || null,
                    fecha_cobrado: fechasExtra[p.proyecto_id]?.fecha_cobrado || null,
                }));

                setProjects(active);
                setFacturadoProjects(groupFacturadoProjects(facturadoConFecha));
            } else {
                setProjects([]);
                setFacturadoProjects({});
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al cargar los proyectos', description: error.message });
        } finally {
            setLoading(false);
        }
    }, [debouncedSearchTerm]);


    useEffect(() => {
        // Safe check for loadingAuth instead of just sessionRole.loaded to prevent hangs
        if (!loadingAuth && sessionRole) {
            fetchProjects();
        }
    }, [debouncedSearchTerm, loadingAuth, sessionRole, fetchProjects]);

    const handleFormSuccess = () => {
        setIsFormOpen(false);
        setEditingProject(null);
        fetchProjects();
    };

    const handleOpenCreate = () => {
        setEditingProject(null);
        setIsFormOpen(true);
    };

    const handleEditProject = async (projectId) => {
        setLoading(true);
        const { data, error } = await supabase
            .from('proyectos')
            .select('*')
            .eq('id', projectId)
            .single();

        setLoading(false);

        if (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el proyecto para editar.' });
            console.error(error);
        } else {
            setEditingProject(data);
            setIsFormOpen(true);
        }
    };

    const handleDeleteClick = (id) => {
        setDeleteId(id);
        setIsDeleteAlertOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('proyectos')
                .delete()
                .eq('id', deleteId);

            if (error) throw error;

            toast({ title: 'Proyecto eliminado', description: 'El proyecto ha sido eliminado correctamente.' });
            fetchProjects();
        } catch (error) {
            console.error('Error deleting project:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el proyecto. Puede tener datos relacionados.' });
        } finally {
            setIsDeleting(false);
            setIsDeleteAlertOpen(false);
            setDeleteId(null);
        }
    };

    const canManage = useMemo(() => sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado', [sessionRole]);

    // ============================================================
    // LÓGICA DRAG & DROP DEL KANBAN DE OBRAS
    // (COBRADO ya no es una columna de destino: se marca desde el
    // menú ⋮ de la tarjeta con handleMarkAsCobrado)
    // ============================================================

    const kanbanGroups = useMemo(() => {
        const groups = {};
        KANBAN_COLUMNS.forEach(col => { groups[col] = []; });
        projects.forEach(p => {
            if (groups[p.estado]) groups[p.estado].push(p);
        });
        return groups;
    }, [projects]);

    const handleDragStart = (e, projectId) => {
        setDraggedProjectId(projectId);
        e.dataTransfer.setData('text/plain', projectId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragEnd = () => {
        setDraggedProjectId(null);
        setDragOverColumn(null);
        justDraggedRef.current = true;
        setTimeout(() => { justDraggedRef.current = false; }, 150);
    };

    const handleColumnDragOver = (e, columnStatus) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverColumn !== columnStatus) {
            setDragOverColumn(columnStatus);
        }
    };

    const handleColumnDragLeave = (e, columnStatus) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        if (dragOverColumn === columnStatus) {
            setDragOverColumn(null);
        }
    };

    const handleColumnDrop = async (e, newStatus) => {
        e.preventDefault();
        const projectId = e.dataTransfer.getData('text/plain') || draggedProjectId;
        setDragOverColumn(null);
        setDraggedProjectId(null);

        if (!projectId) return;

        const project = projects.find(p => String(p.proyecto_id) === String(projectId));
        if (!project || project.estado === newStatus) return;

        // Actualización optimista local
        setProjects(prev => prev.map(p =>
            String(p.proyecto_id) === String(projectId) ? { ...p, estado: newStatus } : p
        ));

        try {
            const { error } = await supabase
                .from('proyectos')
                .update({ estado: newStatus })
                .eq('id', projectId);

            if (error) throw error;

            toast({
                title: 'Estado actualizado',
                description: `"${project.nombre_proyecto}" movida a ${KANBAN_STYLES[newStatus]?.label || newStatus}.`,
                duration: 2500,
            });
        } catch (error) {
            console.error('Error updating project status:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudo actualizar el estado de la obra.',
            });
            // Revertir recargando datos reales
            fetchProjects();
        }
    };

    // NUEVO: marcar como cobrada desde el menú ⋮ de la tarjeta.
    // fecha_cobrado se rellena sola en BD (trigger trg_set_fecha_cobrado).
    const handleMarkAsCobrado = async (project) => {
        setProjects(prev => prev.filter(p => String(p.proyecto_id) !== String(project.proyecto_id)));

        try {
            const { error } = await supabase
                .from('proyectos')
                .update({ estado: 'cobrado' })
                .eq('id', project.proyecto_id);

            if (error) throw error;

            toast({
                title: 'Obra cobrada',
                description: `"${project.nombre_proyecto}" ha pasado al historial de cobradas.`,
                duration: 2500,
            });

            // Refrescar para regenerar el historial mensual correctamente
            fetchProjects();
        } catch (error) {
            console.error('Error marcando como cobrada:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudo marcar la obra como cobrada.',
            });
            fetchProjects();
        }
    };

    const handleKanbanCardClick = (projectId) => {
        if (justDraggedRef.current) return;
        navigate(`/gestion/obras/${projectId}`);
    };

    const renderMobileKanbanProjectRow = (project) => (
        <button
            key={project.proyecto_id}
            type="button"
            onClick={() => handleKanbanCardClick(project.proyecto_id)}
            className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2.5 text-left shadow-sm transition-colors hover:border-primary/30"
        >
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{project.nombre_proyecto}</span>
                <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span className="truncate">{formatDate(project.fecha_creacion)}</span>
                </span>
            </span>
            <span className="shrink-0 text-right">
                <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Presupuesto</span>
                <span className="block text-xs font-semibold text-foreground">{formatCurrency(project.presupuesto_aceptado || 0)}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
    );

    const renderKanbanCard = (project) => {
        const isDragging = String(draggedProjectId) === String(project.proyecto_id);
        const margin = project.margen || 0;
        const marginColor = margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';

        return (
            <div
                key={project.proyecto_id}
                draggable
                onDragStart={(e) => handleDragStart(e, project.proyecto_id)}
                onDragEnd={handleDragEnd}
                onClick={() => handleKanbanCardClick(project.proyecto_id)}
                className={`group bg-card rounded-lg border border-border/60 shadow-sm p-3 cursor-grab active:cursor-grabbing
                    hover:shadow-md hover:border-primary/30 transition-all select-none
                    ${isDragging ? 'opacity-40 ring-2 ring-primary/40' : ''}`}
            >
                <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-foreground leading-tight line-clamp-2 min-w-0 flex-1 group-hover:text-primary transition-colors">
                        {project.nombre_proyecto}
                    </h3>
                    <div className="flex items-center gap-0.5 shrink-0">
                        {canManage && (
                            <div onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/50 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreVertical className="h-3.5 w-3.5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleMarkAsCobrado(project)}>
                                            <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar como cobrado
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleEditProject(project.proyecto_id)}>
                                            <Edit className="mr-2 h-4 w-4" /> Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDeleteClick(project.proyecto_id)} className="text-destructive focus:text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}
                        <GripVertical className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 shrink-0" />
                    </div>
                </div>

                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Calendar className="w-3 h-3 shrink-0" />
                    <span>{formatDate(project.fecha_creacion)}</span>
                </div>

                <div className="mt-3 pt-2 border-t border-dashed border-border/60 grid grid-cols-3 gap-1">
                    <div className="flex flex-col min-w-0">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wide">Presup.</span>
                        <span className="text-[11px] font-medium text-foreground truncate">{formatCurrency(project.presupuesto_aceptado || 0)}</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wide">Gastos</span>
                        <span className="text-[11px] font-medium text-red-500/90 truncate">{formatCurrency(project.costo_total || 0)}</span>
                    </div>
                    <div className="flex flex-col items-end min-w-0">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wide">Margen</span>
                        <span className={`text-[11px] font-bold ${marginColor} truncate`}>{formatCurrency(margin)}</span>
                    </div>
                </div>
            </div>
        );
    };

    // NUEVO: tarjeta de obra dentro del Historial de Cobradas (columna COBRADO
    // del Kanban). Mismo formato visual que renderKanbanCard, pero sin drag.
    const renderHistorialCard = (project) => {
        const margin = project.margen || 0;
        const marginColor = margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';
        const fecha = project.fecha_cobrado || project.fecha_fin_real || project.fecha_creacion;

        return (
            <div
                key={project.proyecto_id}
                onClick={() => {
                    try { localStorage.setItem('kanban_historial_mes_abierto', kanbanHistorialMonth || ''); } catch {}
                    navigate(`/gestion/obras/${project.proyecto_id}`);
                }}
                className="group bg-card rounded-lg border border-border/60 shadow-sm p-3 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all select-none"
            >
                <h3 className="text-sm font-bold text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                    {project.nombre_proyecto}
                </h3>
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Calendar className="w-3 h-3 shrink-0" />
                    <span>{formatDate(fecha)}</span>
                </div>
                <div className="mt-3 pt-2 border-t border-dashed border-border/60 grid grid-cols-3 gap-1">
                    <div className="flex flex-col min-w-0">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wide">Presup.</span>
                        <span className="text-[11px] font-medium text-foreground truncate">{formatCurrency(project.presupuesto_aceptado || 0)}</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wide">Gastos</span>
                        <span className="text-[11px] font-medium text-red-500/90 truncate">{formatCurrency(project.costo_total || 0)}</span>
                    </div>
                    <div className="flex flex-col items-end min-w-0">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wide">Margen</span>
                        <span className={`text-[11px] font-bold ${marginColor} truncate`}>{formatCurrency(margin)}</span>
                    </div>
                </div>
            </div>
        );
    };

    // NUEVO: contenido de la columna COBRADO — o bien la lista de meses,
    // o bien (si hay un mes seleccionado) las tarjetas de ese mes.
    const renderCobradoColumnContent = () => {
        const monthEntries = Object.entries(facturadoProjects).sort((a, b) => {
            try { return parseISO(a[1][0]?.fecha_cobrado || a[1][0]?.fecha_fin_real || a[1][0]?.fecha_creacion) < parseISO(b[1][0]?.fecha_cobrado || b[1][0]?.fecha_fin_real || b[1][0]?.fecha_creacion) ? 1 : -1; }
            catch { return 0; }
        });

        if (kanbanHistorialMonth && facturadoProjects[kanbanHistorialMonth]) {
            const monthProjects = facturadoProjects[kanbanHistorialMonth];
            return (
                <div className="space-y-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 -ml-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => {
                            setKanbanHistorialMonth(null);
                            try { localStorage.removeItem('kanban_historial_mes_abierto'); } catch {}
                        }}
                    >
                        <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Volver al historial
                    </Button>
                    <div className="text-xs font-semibold capitalize text-muted-foreground px-0.5">
                        {kanbanHistorialMonth} · {monthProjects.length}
                    </div>
                    {monthProjects.map(p => renderHistorialCard(p))}
                </div>
            );
        }

        if (monthEntries.length === 0) {
            return (
                <div className="h-32 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-xs text-center px-3 text-muted-foreground">
                    <Archive className="w-5 h-5 opacity-60" />
                    Aún no hay obras cobradas
                </div>
            );
        }

        return (
            <div className="space-y-1.5">
                {monthEntries.map(([month, monthProjects]) => (
                    <button
                        key={month}
                        onClick={() => {
                            setKanbanHistorialMonth(month);
                            try { localStorage.setItem('kanban_historial_mes_abierto', month); } catch {}
                        }}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-card border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                    >
                        <span className="text-sm font-medium capitalize truncate">{month}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{monthProjects.length}</Badge>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                    </button>
                ))}
            </div>
        );
    };

    const renderKanbanColumn = (status) => {
        const columnProjects = kanbanGroups[status] || [];
        const style = KANBAN_STYLES[status];
        const isOver = dragOverColumn === status;
        const isCobradoColumn = status === 'cobrado';
        const totalHistorial = Object.values(facturadoProjects).reduce((sum, arr) => sum + arr.length, 0);
        const isOpenOnMobile = openMobileKanbanColumn === status;

        return (
            <div
                key={status}
                onDragOver={isCobradoColumn ? undefined : (e) => handleColumnDragOver(e, status)}
                onDragLeave={isCobradoColumn ? undefined : (e) => handleColumnDragLeave(e, status)}
                onDrop={isCobradoColumn ? undefined : (e) => handleColumnDrop(e, status)}
                className={`flex w-full min-w-0 flex-col rounded-xl border transition-colors md:min-w-[260px] md:w-[260px] md:flex-1
                    ${isOver ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'border-border/60 bg-muted/40'}`}
            >
                {/* Cabecera de columna */}
                <button
                    type="button"
                    onClick={() => setOpenMobileKanbanColumn(isOpenOnMobile ? null : status)}
                    className="w-full px-3 py-2.5 rounded-t-xl border-b flex items-center justify-between gap-2 text-left md:cursor-default"
                    style={{ backgroundColor: style.bg, borderColor: style.br }}
                >
                    <span className="flex min-w-0 items-center gap-2">
                        <span className="uppercase text-xs font-bold tracking-wide flex items-center gap-1.5" style={{ color: style.text }}>
                            {isCobradoColumn && <Archive className="w-3.5 h-3.5" />}
                            {style.label}
                        </span>
                        <ChevronDown className={`h-4 w-4 transition-transform md:hidden ${isOpenOnMobile ? 'rotate-180' : ''}`} style={{ color: style.text }} />
                    </span>
                    <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/70"
                        style={{ color: style.text }}
                    >
                        {isCobradoColumn ? totalHistorial : columnProjects.length}
                    </span>
                </button>

                {/* Contenido */}
                <div className={`flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)] min-h-[140px] ${isOpenOnMobile ? 'block' : 'hidden'} md:block`}>
                    {isCobradoColumn ? (
                        renderCobradoColumnContent()
                    ) : columnProjects.length === 0 ? (
                        <div className={`h-24 flex items-center justify-center rounded-lg border-2 border-dashed text-xs
                            ${isOver ? 'border-primary/40 text-primary' : 'border-border text-muted-foreground'}`}>
                            {isOver ? 'Suelta aquí' : 'Sin obras'}
                        </div>
                    ) : (
                        columnProjects.map(p => isMobile ? renderMobileKanbanProjectRow(p) : renderKanbanCard(p))
                    )}
                </div>
            </div>
        );
    };

    const renderKanbanBoard = () => (
        <div className="flex flex-col items-stretch gap-3 pb-4 md:flex-row md:overflow-x-auto">
            {KANBAN_COLUMNS.map(status => renderKanbanColumn(status))}
        </div>
    );

    if (loadingAuth) {
        return (
            <div className="flex justify-center items-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (sessionRole?.rol === 'colaborador') {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Construction className="w-16 h-16 text-yellow-400 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Acceso Denegado</h2>
                <p className="text-sm text-muted-foreground">No tienes permisos para ver los proyectos.</p>
            </div>
        );
    }

    return (
        <div className="p-3 md:p-8 space-y-4 md:space-y-8">
            <Helmet>
                <title>Proyectos | OrkaRefor ERP</title>
                <meta name="description" content="Gestión y listado de proyectos y obras en Horizons ERP." />
            </Helmet>

            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4"
            >
                <div>
                    <h1 className="text-2xl md:text-4xl font-bold text-foreground tracking-tight">Obras y Proyectos</h1>
                    <p className="text-xs md:text-sm text-muted-foreground">Gestión de obras activas y facturadas.</p>
                </div>
                {canManage && (
                    <Button onClick={handleOpenCreate} className="w-full md:w-auto shadow-sm">
                        <Plus className="mr-2 h-4 w-4" /> Nueva Obra
                    </Button>
                )}
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-auto md:flex-1 md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por obra, cliente, dirección o teléfono..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-10 text-sm bg-card"
                    />
                </div>
                <div className="hidden items-center gap-2 self-end md:flex md:self-auto">
                    <ToggleGroup type="single" value={effectiveViewMode} onValueChange={(val) => { if (val) setViewMode(val) }} className="justify-end">
                        <ToggleGroupItem value="grid" aria-label="Vista de cuadrícula">
                            <LayoutGrid className="h-4 w-4" />
                        </ToggleGroupItem>
                        <ToggleGroupItem value="list" aria-label="Vista de lista">
                            <ListIcon className="h-4 w-4" />
                        </ToggleGroupItem>
                        <ToggleGroupItem value="kanban" aria-label="Vista Kanban">
                            <Columns className="h-4 w-4" />
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>
            </motion.div>

            {loading && !isFormOpen ? (
                <div className="flex justify-center items-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : (
                <>
                    <AnimatePresence mode="wait">
                        {projects.length > 0 ? (
                            <motion.div
                                key={effectiveViewMode}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                transition={{ duration: 0.2 }}
                            >
                                {effectiveViewMode === 'kanban' ? (
                                    renderKanbanBoard()
                                ) : effectiveViewMode === 'grid' ? (
                                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-6">
                                        {projects.map((project) => (
                                            <ProjectCard
                                                key={project.proyecto_id}
                                                project={project}
                                                onClick={() => navigate(`/gestion/obras/${project.proyecto_id}`)}
                                                onEdit={handleEditProject}
                                                onDelete={handleDeleteClick}
                                                canManage={canManage}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <ProjectList
                                        projects={projects}
                                        onClick={(project) => navigate(`/gestion/obras/${project.proyecto_id}`)}
                                        onEdit={handleEditProject}
                                        onDelete={handleDeleteClick}
                                        canManage={canManage}
                                    />
                                )}
                            </motion.div>
                        ) : (
                            !loading && Object.keys(facturadoProjects).length === 0 && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12 bg-card/50 rounded-xl border border-dashed">
                                    <Archive className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                                    <h3 className="text-lg font-medium text-foreground">
                                        {isSearching ? 'Sin resultados para tu búsqueda' : 'Sin proyectos activos'}
                                    </h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {isSearching ? 'Prueba con otro nombre, cliente, dirección o teléfono.' : 'No hay obras activas en este momento.'}
                                    </p>
                                </motion.div>
                            )
                        )}
                    </AnimatePresence>

                    {/* El Historial de Cobradas en vista Kanban vive DENTRO de la columna
                        COBRADO (renderCobradoColumnContent). En grid/list se muestra aquí
                        debajo, como antes, para no perder esa vista agrupada por mes. */}
                    {effectiveViewMode !== 'kanban' && Object.keys(facturadoProjects).length > 0 && (
                        <div className="mt-8 md:mt-12">
                            <h2 className="text-lg md:text-xl font-bold text-foreground mb-4 flex items-center gap-2 opacity-80">
                                <Archive className="w-5 h-5" />
                                Historial de Cobradas
                            </h2>
                            <div className="space-y-2 md:space-y-4">
                                {Object.entries(facturadoProjects).sort((a, b) => new Date(b[0]) - new Date(a[0])).map(([month, monthProjects]) => (
                                    <Collapsible
                                        key={month}
                                        // Al buscar, se fuerzan TODOS los meses abiertos (controlado) para no
                                        // tener que adivinar en qué mes está el resultado. Sin búsqueda activa,
                                        // se respeta el comportamiento manual de siempre (recordando el último abierto).
                                        open={isSearching ? true : openMonth === month}
                                        onOpenChange={(isOpen) => {
                                            if (isSearching) return;
                                            if (isOpen) {
                                                setOpenMonth(month);
                                                try { localStorage.setItem('historial_mes_abierto', month); } catch {}
                                            } else if (openMonth === month) {
                                                setOpenMonth(null);
                                                try { localStorage.removeItem('historial_mes_abierto'); } catch {}
                                            }
                                        }}
                                        className="border rounded-lg bg-card/50 overflow-hidden"
                                    >
                                        <CollapsibleTrigger asChild>
                                            <Button variant="ghost" className="w-full justify-between h-12 px-4 hover:bg-muted/50 font-medium text-sm md:text-base">
                                                <span className="capitalize">{month}</span>
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{monthProjects.length}</Badge>
                                                    <ChevronsUpDown className="h-4 w-4" />
                                                </div>
                                            </Button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="border-t border-border/50">
                                            <div className="p-2 md:p-4 bg-muted/10">
                                                {effectiveViewMode === 'list' ? (
                                                    <ProjectList
                                                        projects={monthProjects}
                                                        onClick={(project) => {
                                                            try { localStorage.setItem('historial_mes_abierto', month); } catch {}
                                                            navigate(`/gestion/obras/${project.proyecto_id}`);
                                                        }}
                                                        onEdit={handleEditProject}
                                                        onDelete={handleDeleteClick}
                                                        canManage={canManage}
                                                    />
                                                ) : (
                                                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-6">
                                                        {monthProjects.map(project => (
                                                            <ProjectCard
                                                                key={project.proyecto_id}
                                                                project={project}
                                                                onClick={() => {
                                                                    try { localStorage.setItem('historial_mes_abierto', month); } catch {}
                                                                    navigate(`/gestion/obras/${project.proyecto_id}`);
                                                                }}
                                                                onEdit={handleEditProject}
                                                                onDelete={handleDeleteClick}
                                                                canManage={canManage}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-[725px] p-0 overflow-hidden rounded-xl">
                    <DialogHeader className="px-6 pt-6 pb-2">
                        <DialogTitle>{editingProject ? 'Editar Proyecto' : 'Nuevo Proyecto'}</DialogTitle>
                        <DialogDescription>
                            {editingProject ? 'Actualiza los detalles.' : 'Registra una nueva obra en el sistema.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="px-6 pb-6 max-h-[80vh] overflow-y-auto">
                        <ProjectForm
                            project={editingProject}
                            onSave={handleFormSuccess}
                            onCancel={() => setIsFormOpen(false)}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará el proyecto permanentemente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default Projects;
