import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Helmet } from 'react-helmet';
import {
  ArrowLeft, Loader2, HardHat, FileText,
  MessageSquare, Camera, FolderOpen, User, Phone, Mail, MapPin, Calendar,
  LayoutDashboard, ListChecks, StickyNote, Pencil, Ruler
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Import Tabs Components
import ObraDashboardSafe from './ObraDashboardSafe';
import ObraProcesosTab from './ObraProcesosTab';
import ObraNotasTab from './ObraNotasTab';
import ProjectPhotosView from './ProjectPhotosView';
import ProjectDocuments from './ProjectDocuments';
import ProjectForm from './ProjectForm';
import PresupuestoScanner from '@/components/PresupuestoScanner';

const ObraDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { sessionRole } = useAuth();
  const [obra, setObra] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isClientNotesOpen, setIsClientNotesOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // ✅ Estado para el escáner de presupuesto
  const [presupuestoScannerOpen, setPresupuestoScannerOpen] = useState(false);

  const canManage = React.useMemo(() => sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado', [sessionRole]);

  useEffect(() => {
    if (id) fetchObra();
  }, [id]);

  const fetchObra = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('obras')
        .select('*, cliente:clientes(*)')
        .eq('id', id)
        .single();
      if (error) throw error;
      setObra(data);
    } catch (error) {
      console.error('Error fetching obra:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar la información de la obra.' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Cargando detalles de la obra...</p>
      </div>
    );
  }

  if (!obra) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-destructive">Obra no encontrada</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/gestion/obras')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver al listado
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-7xl animate-in fade-in duration-500">
      <Helmet>
        <title>{obra.nombre || 'Detalle Obra'} | ERP</title>
      </Helmet>

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/gestion/obras')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <HardHat className="w-6 h-6 text-primary" />
              {obra.nombre}
            </h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
              {obra.direccion || 'Sin dirección registrada'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(true)} className="mr-2">
              <Pencil className="w-4 h-4 mr-2" /> Editar Obra
            </Button>
          )}
          <Badge variant={obra.activo ? "default" : "secondary"} className="text-sm px-3 py-1">
            {obra.activo ? 'Activa' : 'Inactiva'}
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1 capitalize">
            {obra.estado || 'Estado desconocido'}
          </Badge>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full overflow-x-auto justify-start flex flex-nowrap h-auto p-1 bg-muted/50 gap-1 rounded-lg no-scrollbar">

          <TabsTrigger value="dashboard" className="gap-2 py-2 px-4 flex-none data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </TabsTrigger>

          <TabsTrigger value="notas" className="gap-2 py-2 px-4 flex-none data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <StickyNote className="w-4 h-4" />
            Notas
          </TabsTrigger>

          <TabsTrigger value="procesos" className="gap-2 py-2 px-4 flex-none data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <ListChecks className="w-4 h-4" />
            Procesos
          </TabsTrigger>

          <TabsTrigger value="info" className="gap-2 py-2 px-4 flex-none data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FileText className="w-4 h-4" />
            Información
          </TabsTrigger>

          <TabsTrigger value="documentacion" className="gap-2 py-2 px-4 flex-none data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FolderOpen className="w-4 h-4" />
            Documentos
          </TabsTrigger>

        </TabsList>

        <div className="mt-6">

          <TabsContent value="dashboard" className="animate-in fade-in slide-in-from-bottom-2 focus-visible:outline-none">
            <ObraDashboardSafe obra={obra} obraId={obra.id} />
          </TabsContent>

          <TabsContent value="notas" className="animate-in fade-in slide-in-from-bottom-2 focus-visible:outline-none">
            <ObraNotasTab obraId={obra.id} />
          </TabsContent>

          <TabsContent value="procesos" className="animate-in fade-in slide-in-from-bottom-2 focus-visible:outline-none">
            <ObraProcesosTab obraId={obra.id} />
          </TabsContent>

          <TabsContent value="info" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 focus-visible:outline-none">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold border-b pb-2">Datos Generales</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Nombre del Proyecto</span>
                    <span className="font-medium text-base">{obra.nombre}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Dirección</span>
                    <span className="font-medium">{obra.direccion || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Presupuesto</span>
                    <span className="font-medium font-mono">
                      {obra.presupuesto
                        ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(obra.presupuesto)
                        : '0,00 €'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Descripción</span>
                    <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed">
                      {obra.descripcion || 'Sin descripción detallada.'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold border-b pb-2 uppercase tracking-wider">Información del Cliente</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {obra.cliente && (
                    <Button variant="outline" onClick={() => setIsClientNotesOpen(true)} className="w-full sm:w-auto self-start mb-2">
                      <FileText className="w-4 h-4 mr-2" />
                      Notas del Cliente
                    </Button>
                  )}
                  <div className="grid grid-cols-1 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Cliente</span>
                      <span className="font-medium text-base flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        {obra.cliente?.nombre || 'Cliente no asignado'}
                      </span>
                    </div>
                    {obra.cliente?.contacto && (
                      <div>
                        <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Contacto</span>
                        <span className="font-medium">{obra.cliente.contacto}</span>
                      </div>
                    )}
                    {obra.cliente?.telefono && (
                      <div>
                        <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Teléfono</span>
                        <span className="font-medium flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          {obra.cliente.telefono}
                        </span>
                      </div>
                    )}
                    {obra.cliente?.email && (
                      <div>
                        <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Email</span>
                        <span className="font-medium flex items-center gap-2 break-all">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          {obra.cliente.email}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="pt-4 border-t">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" /> Galería de Fotos
              </h3>
              <ProjectPhotosView projectId={obra.id} canManage={canManage} canUpload={true} />
            </div>
          </TabsContent>

          {/* ✅ TAB DOCUMENTACIÓN con botón Extraer Mediciones */}
          <TabsContent value="documentacion" className="animate-in fade-in slide-in-from-bottom-2 focus-visible:outline-none">

            {/* Botón Extraer Mediciones — solo para admin/encargado */}
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

            <ProjectDocuments projectId={obra.id} canManage={canManage} canUpload={true} />
          </TabsContent>

        </div>
      </Tabs>

      {/* Client Notes Modal */}
      {obra.cliente && (
        <Dialog open={isClientNotesOpen} onOpenChange={setIsClientNotesOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Notas del Cliente</DialogTitle>
              <DialogDescription>{obra.cliente.nombre}</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="whitespace-pre-wrap text-sm text-gray-700 bg-muted/30 p-4 rounded-md border">
                {obra.cliente.notas || "No hay notas registradas para este cliente."}
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Obra Modal */}
      {canManage && (
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-11/12 p-0 border-0 bg-transparent shadow-none">
            <ProjectForm
              project={obra}
              onSave={() => { setIsEditModalOpen(false); fetchObra(); }}
              onCancel={() => setIsEditModalOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* ✅ Modal Escáner de Presupuesto */}
      {canManage && (
        <Dialog open={presupuestoScannerOpen} onOpenChange={setPresupuestoScannerOpen}>
          <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-y-auto p-0">
            <PresupuestoScanner
              proyectoId={obra.id}
              onClose={() => setPresupuestoScannerOpen(false)}
              onSaved={() => {
                setPresupuestoScannerOpen(false);
                toast({
                  title: '✅ Mediciones guardadas',
                  description: 'Las mediciones del presupuesto han sido extraídas y guardadas.',
                });
              }}
            />
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
};

export default ObraDetail;
