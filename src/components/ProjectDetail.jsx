import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/customSupabaseClient';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ArrowLeft, Building, LayoutDashboard, Package, HardHat, Image as ImageIcon, FileText, View, ShieldAlert, Banknote, ListChecks, MessageSquare, Share2, Pencil, Ruler, Brain } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Helmet } from 'react-helmet';

// Import Tab Components
import ProjectDashboard from '@/components/ProjectDashboard';
import ProjectMaterialsView from '@/components/ProjectMaterialsView';
import ProjectLaborView from '@/components/ProjectLaborView';
import ProjectPhotosView from '@/components/ProjectPhotosView';
import ProjectDocuments from '@/components/ProjectDocuments';
import ProjectPhotos360 from '@/components/ProjectPhotos360';
import ProjectPayments from '@/components/ProjectPayments';
import ObraProcesosTab from '@/components/ObraProcesosTab';
import ObraGanttTab from '@/components/ObraGanttTab';
import CommentsSection from '@/components/CommentsSection';
import SharedProjectSettlementTab from '@/components/SharedProjectSettlementTab';
import ProjectForm from '@/components/ProjectForm';
import PresupuestoScanner from '@/components/PresupuestoScanner';
import ReplanteoTab from '@/components/ReplanteoTab';

const ProjectDetail = ({ projectId: propProjectId }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { sessionRole } = useAuth();

    // Resolve Project ID
    const params = useParams();
    const location = useLocation();

    // Task: Sync activeTab with query parameter
    const searchParams = new URLSearchParams(location.search);
    const initialTab = searchParams.get('tab') || 'dashboard';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [presupuestoScannerOpen, setPresupuestoScannerOpen] = useState(false);

    const canManage = React.useMemo(() => sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado', [sessionRole]);

    // Ensure URL is updated when tab changes
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

    // Redirect if no ID
    useEffect(() => {
        if (!projectId) {
            console.warn('[ProjectDetail] No Project ID found, redirecting.');
            navigate('/gestion/obras', { replace: true });
        }
    }, [projectId, navigate]);

    // Fetch Project Basic Info
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

                <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b shadow-sm">
                    <div className="w-full p-4 md:p-6 pb-2 space-y-4">
                        {/* Breadcrumbs & Title */}
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
                                </div>
                            </div>
                        </div>

                        {/* Tabs Navigation */}
                        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                            <TabsList className="w-full justify-start overflow-x-auto bg-transparent p-0 h-auto rounded-none space-x-2 md:space-x-4 border-b border-border/50 no-scrollbar">
                                <ProjectTabTrigger value="dashboard" icon={<LayoutDashboard className="w-4 h-4" />} label="Dashboard" />
                                <ProjectTabTrigger value="cronograma" icon={<ListChecks className="w-4 h-4" />} label="Cronograma" />
                                <ProjectTabTrigger value="replanteo" icon={<Brain className="w-4 h-4" />} label="Replanteo IA" />
                                <ProjectTabTrigger value="procesos" icon={<ListChecks className="w-4 h-4" />} label="Procesos" />
                                <ProjectTabTrigger value="pagos" icon={<Banknote className="w-4 h-4" />} label="Pagos" />
                                <ProjectTabTrigger value="materiales" icon={<Package className="w-4 h-4" />} label="Materiales" />
                                <ProjectTabTrigger value="mano_obra" icon={<HardHat className="w-4 h-4" />} label="Mano de Obra" />
                                <ProjectTabTrigger value="fotos" icon={<ImageIcon className="w-4 h-4" />} label="Fotos" />
                                <ProjectTabTrigger value="documentacion" icon={<FileText className="w-4 h-4" />} label="Documentación" />
                                <ProjectTabTrigger value="fotos_360" icon={<View className="w-4 h-4" />} label="Fotos 360º" />
                                <ProjectTabTrigger value="comentarios" icon={<MessageSquare className="w-4 h-4" />} label="Comentarios" />
                                {project.es_compartida && (
                                    <ProjectTabTrigger value="liquidacion" icon={<Share2 className="w-4 h-4" />} label="Liquidación" />
                                )}
                            </TabsList>
                        </Tabs>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="w-full p-4 md:p-6 min-h-0 flex-1">
                    <Tabs value={activeTab} className="space-y-6">

                        <TabsContent value="dashboard" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <ProjectDashboard projectId={projectId} project={project} />
                        </TabsContent>

                        <TabsContent value="cronograma" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <ObraGanttTab obraId={projectId} />
                        </TabsContent>

                        <TabsContent value="replanteo" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <ReplanteoTab proyectoId={projectId} />
                        </TabsContent>

                        <TabsContent value="procesos" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <ObraProcesosTab obraId={projectId} />
                        </TabsContent>

                        <TabsContent value="pagos" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <ProjectPayments projectId={projectId} budget={project.presupuesto_aceptado || 0} />
                        </TabsContent>

                        <TabsContent value="materiales" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <ProjectMaterialsView projectId={projectId} />
                        </TabsContent>

                        <TabsContent value="mano_obra" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <ProjectLaborView projectId={projectId} />
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

                        <TabsContent value="fotos_360" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <ProjectPhotos360 projectId={projectId} />
                        </TabsContent>

                        <TabsContent value="comentarios" className="m-0 focus-visible:ring-0 focus-visible:outline-none animate-in slide-in-from-bottom-2 duration-300">
                            <div className="p-4 md:p-6 bg-card rounded-lg border shadow-sm max-w-4xl mx-auto w-full">
                                <CommentsSection obraId={projectId} isVisible={activeTab === 'comentarios'} />
                            </div>
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

            {/* Modal Escáner de Presupuesto */}
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

            {/* Edit Obra Modal */}
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

const ProjectTabTrigger = ({ value, icon, label }) => (
    <TabsTrigger
        value={value}
        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-3 font-semibold text-muted-foreground transition-all hover:text-foreground flex items-center gap-2"
    >
        {icon}
        <span className="hidden md:inline">{label}</span>
        <span className="md:hidden">{label}</span>
    </TabsTrigger>
);

export default ProjectDetail;
