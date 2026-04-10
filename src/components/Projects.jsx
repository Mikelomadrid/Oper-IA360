import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
    Plus, Search, Loader2, Archive, ChevronsUpDown, Calendar, Construction,
    MoreVertical, Edit, Trash2, LayoutGrid, List as ListIcon
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ProjectForm from '@/components/ProjectForm';
import { Helmet } from 'react-helmet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
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
    const [projects, setProjects] = useState([]);
    const [facturadoProjects, setFacturadoProjects] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

    // Recordar qué mes del historial estaba abierto al volver
    const [openMonth, setOpenMonth] = useState(() => {
        try { return localStorage.getItem('historial_mes_abierto') || null; } catch { return null; }
    });

    // Delete confirmation state
    const [deleteId, setDeleteId] = useState(null);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const debouncedSearchTerm = useDebounce(searchTerm, 350);

    const groupFacturadoProjects = (projects) => {
        return projects.reduce((acc, project) => {
            // Usar fecha real de finalización, luego estimada, luego creación como fallback
            const dateStr = project.fecha_fin_real || project.fecha_finalizacion_estimada || project.fecha_creacion;
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
            // 1. Fetch project KPIs (currently missing labor in the view's costo_total)
            let query = supabase
                .from('v_proyecto_kpis_con_estado')
                .select('*');

            if (debouncedSearchTerm) {
                query = query.ilike('nombre_proyecto', `%${debouncedSearchTerm}%`);
            }

            const { data: projectsData, error: projectsError } = await query;

            if (projectsError) throw projectsError;

            if (projectsData) {
                // 1.5 Targeted fetch for labor to avoid RLS/limits issues
                const projectIds = projectsData.map(p => p.proyecto_id).filter(Boolean);

                const { data: laborData, error: laborError } = await supabase
                    .from('ui_v_proyecto_mano_obra_totales_v2')
                    .select('proyecto_id, coste_total_mano_obra')
                    .in('proyecto_id', projectIds);

                if (laborError) {
                    console.error("[Projects] Labor fetch error:", laborError);
                }

                // 3. Merge and recalculate
                const processedData = projectsData.map(project => {
                    const laborEntry = laborData?.find(l => String(l.proyecto_id) === String(project.proyecto_id));
                    const laborCost = laborEntry ? parseFloat(laborEntry.coste_total_mano_obra || 0) : 0;

                    const materialCost = project.costo_total || 0;
                    const totalCostUpdated = materialCost + laborCost;
                    const margenUpdated = (project.presupuesto_aceptado || 0) - totalCostUpdated;

                    return {
                        ...project,
                        costo_total: totalCostUpdated,
                        margen: margenUpdated,
                        coste_mano_obra: laborCost
                    };
                });

                // 4. Fetch fechas min/max del cronograma por proyecto
                const activeIds = processedData
                    .filter(p => p.estado !== 'facturado' && p.estado !== 'cerrado' && p.estado !== 'cobrado')
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
                    .filter(p => p.estado !== 'facturado' && p.estado !== 'cerrado' && p.estado !== 'cobrado')
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

                const facturado = processedData.filter(p => p.estado === 'facturado' || p.estado === 'cerrado' || p.estado === 'cobrado');

                // Asegurar que tenemos fecha_fin_real para el historial
                const facturadoIds = facturado.map(p => p.proyecto_id).filter(Boolean);
                let fechasFinReal = {};
                if (facturadoIds.length > 0) {
                    const { data: fechasData } = await supabase
                        .from('proyectos')
                        .select('id, fecha_fin_real')
                        .in('id', facturadoIds);
                    if (fechasData) {
                        fechasData.forEach(p => { fechasFinReal[p.id] = p.fecha_fin_real; });
                    }
                }
                const facturadoConFecha = facturado.map(p => ({
                    ...p,
                    fecha_fin_real: fechasFinReal[p.proyecto_id] || p.fecha_fin_real || null
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
                        placeholder="Buscar proyecto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-10 text-sm bg-card"
                    />
                </div>
                <div className="flex items-center gap-2 self-end md:self-auto">
                    <ToggleGroup type="single" value={viewMode} onValueChange={(val) => { if (val) setViewMode(val) }} className="justify-end">
                        <ToggleGroupItem value="grid" aria-label="Vista de cuadrícula">
                            <LayoutGrid className="h-4 w-4" />
                        </ToggleGroupItem>
                        <ToggleGroupItem value="list" aria-label="Vista de lista">
                            <ListIcon className="h-4 w-4" />
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
                                key={viewMode}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                transition={{ duration: 0.2 }}
                            >
                                {viewMode === 'grid' ? (
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
                                    <h3 className="text-lg font-medium text-foreground">Sin proyectos activos</h3>
                                    <p className="text-sm text-muted-foreground mt-1">No hay obras activas en este momento.</p>
                                </motion.div>
                            )
                        )}
                    </AnimatePresence>

                    {Object.keys(facturadoProjects).length > 0 && (
                        <div className="mt-8 md:mt-12">
                            <h2 className="text-lg md:text-xl font-bold text-foreground mb-4 flex items-center gap-2 opacity-80">
                                <Archive className="w-5 h-5" />
                                Historial de Facturados
                            </h2>
                            <div className="space-y-2 md:space-y-4">
                                {Object.entries(facturadoProjects).sort((a, b) => new Date(b[0]) - new Date(a[0])).map(([month, monthProjects]) => (
                                    <Collapsible
                                        key={month}
                                        defaultOpen={openMonth === month}
                                        onOpenChange={(isOpen) => {
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
                                                {viewMode === 'grid' ? (
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
                                                ) : (
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