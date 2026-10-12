import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/customSupabaseClient';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ArrowLeft, Building, LayoutDashboard, Package, HardHat, Image as ImageIcon, FileText, View, ShieldAlert, Banknote, ListChecks, MessageSquare, Share2, Pencil, Ruler, Brain, FileImage, ChevronDown, ClipboardList, ClipboardCheck, Users, Timer } from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Helmet } from 'react-helmet';
import {
    TIPOS_PRINCIPALES_TRABAJO,
    OFICIOS_DOMINANTES,
    TAMANOS_OPERATIVOS,
    ESTADOS_VALIDEZ_ANALISIS,
    ETIQUETAS_RENTABILIDAD,
    labelFor,
    ESTADO_VALIDEZ_BADGE_CLASSES,
} from '@/lib/obraClasificacion';

// Import Tab Components
import ProjectDashboard from '@/components/ProjectDashboard';
import ProjectMaterialsView from '@/components/ProjectMaterialsView';
import ProjectLaborView from '@/components/ProjectLaborView';
import ProjectPhotosView from '@/components/ProjectPhotosView';
import ProjectDocuments from '@/components/ProjectDocuments';
import ProjectPhotos360 from '@/components/ProjectPhotos360';
import ProjectPayments from '@/components/ProjectPayments';
import ObraGanttTab from '@/components/ObraGanttTab';
import CommentsSection from '@/components/CommentsSection';
import SharedProjectSettlementTab from '@/components/SharedProjectSettlementTab';
import ProjectForm from '@/components/ProjectForm';
import PresupuestoScanner from '@/components/PresupuestoScanner';
import ReplanteoTab from '@/components/ReplanteoTab';
import PlanosTab from '@/components/PlanosTab';
import SeguimientoLeadTab from '@/components/SeguimientoLeadTab';
import ProjectPedidosView from '@/components/ProjectPedidosView';
import ProjectProductionView from '@/components/ProjectProductionView';
import ProjectTeamView from '@/components/ProjectTeamView';
import ProjectDailyWorkView from '@/components/ProjectDailyWorkView';

const ProjectDetail = ({ projectId: propProjectId }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { sessionRole } = useAuth();

    const params = useParams();
    const location = useLocation();

    const searchParams = new URLSearchParams(location.search);
    const initialTab = searchParams.get('tab') || 'dashboard';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [presupuestoScannerOpen, setPresupuestoScannerOpen] = useState(false);

    const canManage = React.useMemo(() => sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado', [sessionRole]);

    useEffect(() => {
        if (!canManage && ['cronograma', 'jornada', 'equipo'].includes(activeTab)) {
            setActiveTab('dashboard');
            const params = new URLSearchParams(location.search);
            params.set('tab', 'dashboard');
            navigate({ search: params.toString() }, { replace: true });
        }
    }, [activeTab, canManage, location.search, navigate]);

    const handleTabChange = (val) => {
        setActiveTab(val);
        const params = new URLSearchParams(location.search);
        params.set('tab', val);
        navigate({ search: params.toString() }, { replace: true });
    };

    let projectId = propProjectId || params.id;

    if (!projectId) {
        const match = location.pathname.match(/\/gestion\/obras\/([a-fA-F0-9-]+)/);
        if (match) projectId = match[1];
    }

    useEffect(() => {
        if (!projectId) {
            console.warn('[ProjectDetail] No Project ID found, redirecting.');
            navigate('/gestion/obras', { replace: true });
        }
    }, [projectId, navigate]);

    const { data: project, isLoading, error } = useQuery({
        queryKey: ['project_basic', projectId],
        queryFn: async () => {
            if (!projectId) return null;
            const { data, error } = await supabase
                .from('proyectos')
                .select('*, cliente:clientes(nombre, id)')
                .eq('id', projectId)
                .maybeSingle();

            if (error) throw error;
            return data;
        },
        enabled: !!projectId,
        retry: 1
    });

    useEffect(() => {
        if (error) {
            toast({
                variant: 'destructive',
                title: 'Error de acceso',
                description: 'No se pudo cargar el proyecto. Verifique permisos.'
            });
        }
    }, [error, toast]);

    if (!projectId) return null;

    if (isLoading) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground text-sm animate-pulse">Cargando proyecto...</p>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center p-8 text-center bg-background">
                <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
                <h2 className="text-2xl font-bold text-foreground mb-2">Proyecto no disponible</h2>
                <p className="text-muted-foreground max-w-md mb-8">
                    Es posible que haya sido eliminado o que no tenga permisos de visualización.
                </p>
                <Button variant="outline" onClick={() => navigate('/gestion/obras')}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver a Obras
                </Button>
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <title>{project.nombre_proyecto || 'Detalle Proyecto'} - ERP</title>
            </Helmet>

            <div className="flex flex-col h-full min-h-screen bg-background/50 animate-in fade-in duration-500">

                <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b shadow-sm" style={{ overflow: 'visible' }}>
                    <div className="w-full p-4 md:p-6 pb-2 space-y-4">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-muted-foreground text-xs md:text-sm">
                                <span
                                    className="hover:underline cursor-pointer hover:text-primary transition-colors flex items-center"
                                    onClick={() => navigate(-1)}
                                >
                                    <ArrowLeft className="w-3 h-3 mr-1" />
                                    Obras
                                </span>
                                <span className="opacity-30">/</span>
                                <span className="truncate font-medium text-foreground">{project.nombre_proyecto}</span>
                            </div>

                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{project.nombre_proyecto}</h1>
                                        {canManage && (
                                            <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(true)}>
                                                <Pencil className="w-4 h-4 mr-2" />
                                                Editar Obra
                                            </Button>
                                        )}
                                        <Badge variant={project.estado === 'activo' ? 'default' : 'secondary'} className="capitalize px-3">
                                            {project.estado?.replace('_', ' ') || 'Sin Estado'}
                                        </Badge>
                                    </div>
                                    {project.cliente && (
                                        <div className="flex items-center gap-2 text-muted-foreground text-sm mt-1">
                                            <Building className="w-3.5 h-3.5" />
                                            <span>{project.cliente.nombre}</span>
                                        </div>
                                    )}
                                    <ClasificacionBadges project={project} />
                                </div>
                            </div>
                        </div>

                        <GroupedNav
                            activeTab={activeTab}
                            onTabChange={handleTabChange}
                            esCompartida={project.es_compartida}
                            tieneLeadId={!!project.lead_id}
                            canManage={canManage}
                        />
                    </div>
                </div>

                <div className="w-full p-4 md:p-6 min-h-0 flex-1">
                    <Tabs value={activeTab} className="space-y-6">

                        <TabsContent value="dashboard" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <ProjectDashboard projectId={projectId} project={project} />
                        </TabsContent>

                        <TabsContent value="cronograma" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <ObraGanttTab obraId={projectId} />
                        </TabsContent>

                        <TabsContent value="jornada" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <ProjectDailyWorkView projectId={projectId} canManage={canManage} />
                        </TabsContent>

                        <TabsContent value="equipo" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <ProjectTeamView projectId={projectId} canManage={canManage} />
                        </TabsContent>

                        <TabsContent value="replanteo" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <ReplanteoTab proyectoId={projectId} />
                        </TabsContent>

                        <TabsContent value="pagos" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <ProjectPayments projectId={projectId} budget={project.presupuesto_aceptado || 0} />
                        </TabsContent>

                        <TabsContent value="materiales" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <ProjectMaterialsView projectId={projectId} canManage={canManage} />
                        </TabsContent>

                        <TabsContent value="mano_obra" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <ProjectLaborView projectId={projectId} />
                        </TabsContent>

                        <TabsContent value="produccion" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <ProjectProductionView projectId={projectId} canManage={canManage} />
                        </TabsContent>

                        <TabsContent value="fotos" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <ProjectPhotosView projectId={projectId} canManage={canManage} canUpload={true} />
                        </TabsContent>

                        <TabsContent value="documentacion" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            {canManage && (
                                <div className="flex justify-end mb-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPresupuestoScannerOpen(true)}
                                        className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300"
                                    >
                                        <Ruler className="w-4 h-4 mr-2" />
                                        Extraer mediciones del presupuesto
                                    </Button>
                                </div>
                            )}
                            <ProjectDocuments projectId={projectId} canManage={canManage} canUpload={true} />
                        </TabsContent>

                        {/* NUEVO: subsección "Pedidos" dentro del grupo Documentación */}
                        <TabsContent value="pedidos" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <ProjectPedidosView projectId={projectId} />
                        </TabsContent>

                        <TabsContent value="fotos_360" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <ProjectPhotos360 projectId={projectId} />
                        </TabsContent>

                        <TabsContent value="comentarios" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <div className="p-4 md:p-6 bg-card rounded-lg border shadow-sm max-w-4xl mx-auto w-full">
                                <CommentsSection obraId={projectId} isVisible={activeTab === 'comentarios'} />
                            </div>
                        </TabsContent>

                        <TabsContent value="seguimiento" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <SeguimientoLeadTab projectId={projectId} />
                        </TabsContent>

                        <TabsContent value="planos" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <PlanosTab proyectoId={projectId} />
                        </TabsContent>

                        {project.es_compartida && (
                            <TabsContent value="liquidacion" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                                <SharedProjectSettlementTab
                                    projectId={projectId}
                                    budget={project.presupuesto_aceptado || 0}
                                    sharingModel={project.tipo_reparto || 'fijo'}
                                />
                            </TabsContent>
                        )}

                    </Tabs>
                </div>
            </div>

            {canManage && (
                <Dialog open={presupuestoScannerOpen} onOpenChange={setPresupuestoScannerOpen}>
                    <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-y-auto p-0">
                        <PresupuestoScanner
                            proyectoId={projectId}
                            onClose={() => setPresupuestoScannerOpen(false)}
                            onSaved={() => setPresupuestoScannerOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            )}

            {canManage && (
                <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-11/12 p-0 border-0 bg-transparent shadow-none">
                        <ProjectForm
                            project={project}
                            onSave={() => {
                                setIsEditModalOpen(false);
                                window.location.reload();
                            }}
                            onCancel={() => setIsEditModalOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
};

// ─── Badges de clasificación (tipo de trabajo, oficio, tamaño, validez, etiquetas) ────
// Solo lectura: la edición se hace desde el modal "Editar Obra" (ProjectForm).
const ClasificacionBadges = ({ project }) => {
    const tieneClasificacion = project.tipo_principal_trabajo || project.oficio_dominante || project.tamano_operativo;
    const etiquetas = project.etiquetas_rentabilidad || [];

    if (!tieneClasificacion && etiquetas.length === 0 && !project.estado_validez_analisis) return null;

    return (
        <div className="flex flex-wrap items-center gap-2 mt-2">
            {project.tipo_principal_trabajo && (
                <Badge variant="outline">{labelFor(TIPOS_PRINCIPALES_TRABAJO, project.tipo_principal_trabajo)}</Badge>
            )}
            {project.oficio_dominante && (
                <Badge variant="outline">{labelFor(OFICIOS_DOMINANTES, project.oficio_dominante)}</Badge>
            )}
            {project.tamano_operativo && (
                <Badge variant="outline">{labelFor(TAMANOS_OPERATIVOS, project.tamano_operativo)}</Badge>
            )}
            {project.estado_validez_analisis && (
                <Badge className={ESTADO_VALIDEZ_BADGE_CLASSES[project.estado_validez_analisis] || 'bg-muted text-muted-foreground border-border'}>
                    {labelFor(ESTADOS_VALIDEZ_ANALISIS, project.estado_validez_analisis)}
                </Badge>
            )}
            {etiquetas.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                    {labelFor(ETIQUETAS_RENTABILIDAD, tag)}
                </Badge>
            ))}
        </div>
    );
};

// ─── Grupos de navegación ─────────────────────────────────────────────────────
const NAV_GROUPS = (esCompartida, tieneLeadId) => [
    {
        id: 'dashboard',
        label: 'Dashboard',
        icon: <LayoutDashboard className="w-4 h-4" />,
        children: [
            { value: 'dashboard',   label: 'Dashboard',     icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
            { value: 'cronograma',  label: 'Cronograma',    icon: <ListChecks className="w-3.5 h-3.5" /> },
            { value: 'jornada',     label: 'Trabajo diario', icon: <Timer className="w-3.5 h-3.5" /> },
            { value: 'equipo',      label: 'Equipo de obra', icon: <Users className="w-3.5 h-3.5" /> },
            { value: 'replanteo',   label: 'Replanteo IA',  icon: <Brain className="w-3.5 h-3.5" /> },
            ...(esCompartida ? [{ value: 'liquidacion', label: 'Liquidación', icon: <Share2 className="w-3.5 h-3.5" /> }] : []),
        ],
    },
    {
        id: 'documentacion',
        label: 'Documentación',
        icon: <FileText className="w-4 h-4" />,
        children: [
            { value: 'planos',        label: 'Planos',        icon: <FileImage className="w-3.5 h-3.5" /> },
            { value: 'fotos',         label: 'Fotos',         icon: <ImageIcon className="w-3.5 h-3.5" /> },
            { value: 'fotos_360',     label: 'Fotos 360º',    icon: <View className="w-3.5 h-3.5" /> },
            { value: 'documentacion', label: 'Documentación', icon: <FileText className="w-3.5 h-3.5" /> },
            { value: 'pedidos',       label: 'Pedidos',       icon: <ClipboardList className="w-3.5 h-3.5" /> },
        ],
    },
    {
        id: 'costes',
        label: 'Costes',
        icon: <Banknote className="w-4 h-4" />,
        children: [
            { value: 'produccion', label: 'Producción',    icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
            { value: 'pagos',      label: 'Pagos',         icon: <Banknote className="w-3.5 h-3.5" /> },
            { value: 'materiales', label: 'Materiales',    icon: <Package className="w-3.5 h-3.5" /> },
            { value: 'mano_obra',  label: 'Mano de Obra',  icon: <HardHat className="w-3.5 h-3.5" /> },
        ],
    },
    {
        id: 'informacion',
        label: 'Información',
        icon: <MessageSquare className="w-4 h-4" />,
        children: [
            { value: 'comentarios',  label: 'Comentarios',  icon: <MessageSquare className="w-3.5 h-3.5" /> },
            { value: 'seguimiento',  label: 'Seguimiento',  icon: <ClipboardList className="w-3.5 h-3.5" /> },
        ],
    },
];

// ─── Componente de navegación agrupada ────────────────────────────────────────
// Navegación basada en click/tap (funciona igual en desktop y móvil).
// No depende de hover (mouseEnter/mouseLeave no existen de forma fiable en táctil).
const GroupedNav = ({ activeTab, onTabChange, esCompartida, tieneLeadId, canManage }) => {
    const [openGroup, setOpenGroup] = useState(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
    const navRef = useRef(null);
    const groups = NAV_GROUPS(esCompartida, tieneLeadId)
        .map((group) => ({
            ...group,
            children: canManage
                ? group.children
                : group.children.filter((item) => !['cronograma', 'jornada', 'equipo'].includes(item.value)),
        }));
    const activeGroup = groups.find(g => g.children.some(c => c.value === activeTab))?.id;
    const openGroupData = groups.find(g => g.id === openGroup);

    const DROPDOWN_WIDTH = 220;

    const handleGroupClick = (group, el) => {
        if (openGroup === group.id) {
            setOpenGroup(null);
            return;
        }
        const rect = el.getBoundingClientRect();
        // Clamp horizontal para que no se salga por la derecha en pantallas estrechas (móvil)
        const maxLeft = window.scrollX + window.innerWidth - DROPDOWN_WIDTH - 8;
        const left = Math.max(window.scrollX + 8, Math.min(rect.left + window.scrollX, maxLeft));
        setDropdownPos({ top: rect.bottom + window.scrollY + 4, left });
        setOpenGroup(group.id);
    };

    // Cerrar al tocar/clicar fuera. Imprescindible en móvil, donde no se dispara mouseLeave.
    useEffect(() => {
        if (!openGroup) return;
        const handlePointerDown = (e) => {
            if (navRef.current && navRef.current.contains(e.target)) return;
            if (e.target.closest && e.target.closest('[data-grouped-nav-dropdown]')) return;
            setOpenGroup(null);
        };
        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [openGroup]);

    return (
        <div ref={navRef} style={{ borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                {groups.map((group) => {
                    const isActive = activeGroup === group.id;
                    const isOpen = openGroup === group.id;

                    return (
                        <div key={group.id} style={{ flexShrink: 0 }}>
                            <button
                                type="button"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '12px 16px', fontSize: 14, fontWeight: 600,
                                    whiteSpace: 'nowrap', border: 'none', background: 'transparent',
                                    cursor: 'pointer',
                                    borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                                    color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
                                }}
                                onClick={(e) => handleGroupClick(group, e.currentTarget)}
                            >
                                {group.icon}
                                <span>{group.label}</span>
                                <ChevronDown style={{ width: 12, height: 12, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                            </button>
                        </div>
                    );
                })}
            </div>

            {openGroup && openGroupData && createPortal(
                <div
                    data-grouped-nav-dropdown
                    style={{
                        position: 'absolute',
                        top: dropdownPos.top,
                        left: dropdownPos.left,
                        zIndex: 99999,
                        minWidth: DROPDOWN_WIDTH,
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                        padding: '4px 0',
                    }}
                >
                    {openGroupData.children.map((item) => {
                        const isItemActive = activeTab === item.value;
                        return (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => { onTabChange(item.value); setOpenGroup(null); }}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center',
                                    gap: 10, padding: '12px 16px', fontSize: 14,
                                    border: 'none', cursor: 'pointer', textAlign: 'left',
                                    backgroundColor: isItemActive ? 'hsl(var(--primary) / 0.1)' : 'transparent',
                                    color: isItemActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                                    fontWeight: isItemActive ? 600 : 400,
                                }}
                                onMouseEnter={e => { if (!isItemActive) { e.currentTarget.style.backgroundColor = 'hsl(var(--muted))'; e.currentTarget.style.color = 'hsl(var(--foreground))'; }}}
                                onMouseLeave={e => { if (!isItemActive) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'hsl(var(--muted-foreground))'; }}}
                            >
                                {item.icon}
                                {item.label}
                            </button>
                        );
                    })}
                </div>,
                document.body
            )}
        </div>
    );
};

export default ProjectDetail;
