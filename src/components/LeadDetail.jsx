/**
 * LeadDetail.jsx
 * 
 * NAVIGATION LOGIC:
 * - Supports explicit "Back to List" navigation that restores previous filters.
 * - Checks `location.search` for incoming query params (filters from Leads list).
 * - If filters exist, the Back button uses them to construct the return URL.
 * - If accessed directly (no filters), Back button defaults to clean list view.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation } from 'react-router-dom'; // Ensure useLocation is imported
import {
  ArrowLeft, Edit, Trash2, Loader2, User, Phone, Mail, MapPin, Briefcase, CalendarDays,
  MessageSquare, Check, Megaphone, HardHat, PlusCircle,
  Clock, AlertCircle, View, FileText, Users, File, Camera, Tag
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import EditLeadModal from '@/components/EditLeadModal';
import EditLeadTechnicianModal from '@/components/EditLeadTechnicianModal';
import LeadPhotos360View from '@/components/LeadPhotos360View';
import LeadAssignmentManager from '@/components/LeadAssignmentManager';
import LeadDocuments from '@/components/LeadDocuments';
import LeadPhotoGallery from '@/components/LeadPhotoGallery';
import LeadStatusSelector from '@/components/LeadStatusSelector';

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleDateString('es-ES', options);
};

const LeadComment = ({ comment, onDelete }) => {
  const [showFullComment, setShowFullComment] = useState(false);
  const isLongComment = comment.comentario.length > 200;
  let authorName = '';
  let authorRole = '';
  if (comment.autor_id) {
    authorName = `${comment.autor_nombre || ''} ${comment.autor_apellidos || ''}`.trim();
    if (!authorName) authorName = 'Usuario';
    authorRole = comment.autor_rol || comment.autor_tipo;
  } else {
    authorName = 'Sistema';
    authorRole = 'sistema';
  }

  return (
    <div className="flex items-start space-x-3 text-sm group animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Avatar className="h-8 w-8">
        <AvatarFallback>{authorName ? authorName.charAt(0).toUpperCase() : 'S'}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex justify-between items-center">
          <div>
            <span className="font-semibold">{authorName}</span>
            {authorRole && <span className="ml-2 text-xs text-muted-foreground capitalize">({authorRole})</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => onDelete(comment.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <p className="text-gray-700 mt-1 whitespace-pre-wrap">
          {isLongComment && !showFullComment
            ? `${comment.comentario.substring(0, 200)}...`
            : comment.comentario}
          {isLongComment && (
            <Button variant="link" size="sm" onClick={() => setShowFullComment(!showFullComment)} className="px-1 py-0 h-auto">
              {showFullComment ? 'Ver menos' : 'Ver más'}
            </Button>
          )}
        </p>
      </div>
    </div>
  );
};

export default function LeadDetail({ leadId, navigate }) {
  const { user, sessionRole, empleadoId } = useAuth();
  const location = useLocation();

  const [lead, setLead] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newComment, setNewComment] = useState('');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTechEditModalOpen, setIsTechEditModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);

  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [activeTab, setActiveTab] = useState('info');
  const [isAssigned, setIsAssigned] = useState(false);

  // Admin Categories for Assignment
  const [categories, setCategories] = useState([]);
  const [isAssigningCategory, setIsAssigningCategory] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const isMounted = useRef(false);

  const isAdminOrEncargado = sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado';
  const isAdmin = sessionRole?.rol === 'admin';
  const isTechnician = sessionRole?.rol === 'tecnico';
  const isOwner = lead?.owner_user_id === user?.id || (lead?.created_by === user?.id);

  // Permission Logic
  const canEdit = isAdminOrEncargado || isOwner || isAssigned;
  const canDeleteLead = isAdminOrEncargado || isOwner;

  // For sub-resources
  const canUploadMedia = canEdit;

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Fetch admin categories if user is admin
  useEffect(() => {
    const fetchCategories = async () => {
      if (!isAdmin) return;
      setLoadingCategories(true);
      try {
        const { data, error } = await supabase.rpc('admin_list_categorias_all');
        if (error) throw error;
        if (isMounted.current) setCategories(data || []);
      } catch (error) {
        console.error("Error fetching categories:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las categorías.' });
      } finally {
        if (isMounted.current) setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, [isAdmin]);

  const groupedCategories = React.useMemo(() => {
    return categories.reduce((groups, cat) => {
      const type = cat.tipo || 'Otros';
      if (!groups[type]) groups[type] = [];
      groups[type].push(cat);
      return groups;
    }, {});
  }, [categories]);

  const fetchAssignmentStatus = useCallback(async () => {
    if (!user?.id || !leadId) return;
    if (isAdminOrEncargado) {
      setIsAssigned(true);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('leads_asignaciones')
        .select('id')
        .eq('lead_id', leadId)
        .eq('usuario_id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (isMounted.current) setIsAssigned(!!data);
    } catch (err) {
      if (isMounted.current) setIsAssigned(false);
    }
  }, [user, leadId, isAdminOrEncargado]);

  const fetchComments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('v_lead_comentarios_extended')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (isMounted.current) setComments(data || []);
    } catch (error) { console.error("Error fetching comments", error); }
  }, [leadId]);

  const fetchLeadData = useCallback(async () => {
    setLoading(prev => !lead ? true : prev);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          empleado_asignado:empleados!leads_empleado_asignado_id_fkey(id, nombre, apellidos),
          colaborador:empleados!leads_colaborador_id_fkey(id, nombre, apellidos),
          proyecto:proyectos(id, nombre_proyecto),
          categoria:categorias(codigo)
        `)
        .eq('id', leadId)
        .maybeSingle();

      if (error) throw error;

      if (isMounted.current) {
        if (!data) {
          toast({ variant: 'destructive', title: 'Acceso Denegado', description: 'Lead no encontrado o no tienes permiso.' });
          navigate('/crm/leads');
          return;
        }

        setLead(data);
        fetchComments();
        fetchAssignmentStatus();
      }
    } catch (error) {
      console.error('Error fetching lead:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el lead.' });
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [leadId, navigate, fetchComments, fetchAssignmentStatus, lead]);

  useEffect(() => {
    if (leadId) {
      fetchLeadData();
      const channel = supabase.channel(`lead-detail-${leadId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads', filter: `id=eq.${leadId}` }, () => { fetchLeadData(); toast({ title: "Lead Actualizado" }); })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lead_comentarios', filter: `lead_id=eq.${leadId}` }, () => fetchComments())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [leadId, fetchLeadData, fetchComments]);

  const handleStatusChangeCallback = (newStatus, baseImponible = null) => {
    setLead(prev => {
      const updatedLead = { ...prev, estado: newStatus };
      if (baseImponible !== null) updatedLead.base_imponible = baseImponible;
      return updatedLead;
    });
  };

  const handleCategoryChange = async (newCode) => {
    if (!newCode || newCode === 'none') return;
    setIsAssigningCategory(true);
    try {
      const { error } = await supabase.rpc('admin_set_lead_categoria', {
        p_lead_id: leadId,
        p_categoria_codigo: newCode
      });
      if (error) throw error;

      const selectedCat = categories.find(c => c.codigo === newCode);
      const name = selectedCat ? selectedCat.nombre : newCode;

      toast({ title: `Lead asignado a ${name}` });

      // Re-fetch to confirm update
      await fetchLeadData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error al asignar', description: error.message });
    } finally {
      if (isMounted.current) setIsAssigningCategory(false);
    }
  };

  const handleDeleteLead = async () => {
    setSaving(true);
    try {
      await supabase.from('lead_fotos').delete().eq('lead_id', leadId);
      await supabase.from('lead_comentarios').delete().eq('lead_id', leadId);
      const { error } = await supabase.from('leads').delete().eq('id', leadId);
      if (error) throw error;
      toast({ title: 'Lead eliminado', description: 'El lead ha sido eliminado correctamente.' });
      navigate('/crm/leads');
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el lead.' });
    } finally {
      if (isMounted.current) {
        setSaving(false);
        setIsDeleteAlertOpen(false);
      }
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setSaving(true);

    try {
      const { error } = await supabase.rpc('add_lead_comentario_auto', {
        p_lead_id: leadId,
        p_comentario: newComment
      });

      if (error) throw error;

      if (isMounted.current) setNewComment('');
      toast({ title: 'Comentario añadido', className: 'bg-green-600 text-white' });
      fetchComments();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al añadir comentario',
        description: error.message
      });
    } finally {
      if (isMounted.current) setSaving(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("¿Borrar comentario?")) return;
    try {
      const { error } = await supabase.from('lead_comentarios').delete().eq('id', commentId);
      if (error) throw error;
      toast({ title: 'Comentario eliminado' });
      fetchComments();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const handleApproveLead = async () => {
    setSaving(true);
    try {
      // Use the new v2 RPC that handles full data migration and deduplication
      // Explicitly passing p_cliente_id as null to match function signature more strictly
      const { data, error } = await supabase.rpc('approve_lead_to_proyecto_v2', {
        p_lead_id: leadId,
        p_proyecto_descripcion: newProjectDescription,
        p_cliente_id: null
      });
      if (error) throw error;

      toast({ title: 'Lead Aprobado y Proyecto Creado' });
      if (isMounted.current) setIsApprovalModalOpen(false);

      if (data && data.proyecto_id) {
        navigate(`/gestion/obras/${data.proyecto_id}`);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'No se recibió el ID del proyecto.' });
      }
    } catch (error) {
      console.error('Approval error:', error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo aprobar el lead.' });
    } finally {
      if (isMounted.current) setSaving(false);
    }
  };

  const handleEditClick = () => {
    if (isTechnician) setIsTechEditModalOpen(true);
    else setIsEditModalOpen(true);
  };

  // Back navigation: Restores filters if present in URL
  const handleBack = () => {
    if (location.search) {
      navigate(`/crm/leads${location.search}`);
    } else {
      navigate('/crm/leads');
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  if (!lead) return <div className="p-8 text-center"><AlertCircle className="w-10 h-10 text-red-500 mx-auto" /><h2 className="text-xl font-semibold">Lead no encontrado</h2><Button onClick={() => navigate('/crm/leads')}><ArrowLeft className="w-4 h-4 mr-2" /> Volver</Button></div>;

  return (
    <div className="flex flex-col h-full bg-background">
      <Helmet><title>{lead.nombre_contacto} | Detalle de Lead</title></Helmet>

      <div className="flex flex-col border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between px-4 md:px-6 py-4">
          <div className="flex items-center gap-4 overflow-hidden">

            {/* Back button logic */}
            <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0" title="Volver al listado">
              <ArrowLeft className="w-5 h-5" />
            </Button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-bold flex items-center gap-2 truncate">{lead.nombre_contacto} <span className="text-muted-foreground ml-1">({lead.nombre_empresa})</span></h1>

                {/* Updated Status Selector Component: Visible for Admins, Badge for others */}
                <LeadStatusSelector
                  currentStatus={lead.estado}
                  leadId={lead.id}
                  userRole={sessionRole?.rol}
                  onStatusChange={handleStatusChangeCallback}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3"><span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Creado: {formatDate(lead.fecha_creacion)}</span>{lead.empleado_asignado && (<span className="flex items-center gap-1"><User className="w-3 h-3" /> Asignado a: {lead.empleado_asignado.nombre} {lead.empleado_asignado.apellidos}</span>)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">

            {canEdit && (
              <Button variant="outline" size="icon" onClick={handleEditClick}><Edit className="w-4 h-4" /></Button>
            )}

            {canDeleteLead && lead.estado !== 'aceptado' && (
              <Button variant="destructive" size="icon" onClick={() => setIsDeleteAlertOpen(true)}><Trash2 className="w-4 h-4" /></Button>
            )}

            {isAdminOrEncargado && lead.estado !== 'aceptado' && (
              <>
                <Button onClick={() => setIsApprovalModalOpen(true)} className="bg-green-600 hover:bg-green-700 hidden sm:flex"><Check className="w-4 h-4 mr-2" /> Aprobar Lead</Button>
                <Button onClick={() => setIsApprovalModalOpen(true)} className="bg-green-600 hover:bg-green-700 sm:hidden" size="icon"><Check className="w-4 h-4" /></Button>
              </>
            )}

            {lead.estado === 'aceptado' && lead.proyecto_id && (
              <Button onClick={() => navigate(`/gestion/obras/${lead.proyecto_id}`)} className="bg-purple-600 hover:bg-purple-700"><Briefcase className="w-4 h-4 mr-2" /> Ver Proyecto</Button>
            )}
          </div>
        </div>

        <div className="px-4 md:px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto bg-transparent p-0 h-auto rounded-none space-x-4 border-none no-scrollbar">
              <TabsTrigger
                value="info"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-3 font-semibold text-muted-foreground transition-all hover:text-foreground flex items-center gap-2"
              >
                <FileText className="w-4 h-4" /> Información
              </TabsTrigger>

              <TabsTrigger
                value="photos"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-3 font-semibold text-muted-foreground transition-all hover:text-foreground flex items-center gap-2"
              >
                <Camera className="w-4 h-4" /> FOTOS
              </TabsTrigger>

              <TabsTrigger
                value="docs"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-3 font-semibold text-muted-foreground transition-all hover:text-foreground flex items-center gap-2"
              >
                <File className="w-4 h-4" /> Documentos
              </TabsTrigger>
              <TabsTrigger
                value="assignments"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-3 font-semibold text-muted-foreground transition-all hover:text-foreground flex items-center gap-2"
              >
                <Users className="w-4 h-4" /> Asignaciones
              </TabsTrigger>
              <TabsTrigger
                value="fotos360"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-3 font-semibold text-muted-foreground transition-all hover:text-foreground flex items-center gap-2"
              >
                <View className="w-4 h-4" /> Fotos 360º
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-slate-50/50 dark:bg-background/50">
        <Tabs value={activeTab} className="h-full">
          <TabsContent value="info" className="h-full mt-0">
            <ScrollArea className="h-full p-4 md:p-6">
              <div className="space-y-6 pb-10">
                <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Megaphone className="w-5 h-5" /> Información General</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><Label className="text-xs text-muted-foreground">Nombre de Contacto</Label><p className="font-medium">{lead.nombre_contacto}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Nombre de Empresa</Label><p className="font-medium">{lead.nombre_empresa || 'N/A'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Teléfono</Label><a href={`tel:${lead.telefono}`} className="flex items-center gap-2 text-primary hover:underline"><Phone className="w-4 h-4" /> {lead.telefono || 'N/A'}</a></div>
                    <div><Label className="text-xs text-muted-foreground">Email</Label><a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-primary hover:underline"><Mail className="w-4 h-4" /> {lead.email || 'N/A'}</a></div>
                    <div><Label className="text-xs text-muted-foreground">CIF</Label><p>{lead.cif || 'N/A'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Estado</Label>
                      {/* Legacy simple badge fallback, but we use the Selector in Header */}
                      <div className="mt-1"><Badge className="capitalize">{lead.estado}</Badge></div>
                    </div>
                    {lead.base_imponible !== null && lead.base_imponible !== undefined && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Presupuesto</Label>
                        <p className="font-semibold text-lg text-emerald-600">
                          {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(lead.base_imponible)}
                        </p>
                      </div>
                    )}

                    {/* Origen Field */}
                    {lead.origen && <div><Label className="text-xs text-muted-foreground">Origen</Label><p className="font-medium">{lead.origen}</p></div>}

                    {/* Asignar a (Category Selector) - Only for Admin */}
                    {isAdmin && (
                      <div className="mt-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                          <Tag className="w-3 h-3" /> Asignar a (Categoría)
                        </Label>
                        <Select
                          value={categories.some(c => c.codigo === lead?.categoria?.codigo) ? lead.categoria.codigo : ""}
                          onValueChange={handleCategoryChange}
                          disabled={isAssigningCategory || loadingCategories}
                        >
                          <SelectTrigger className="h-8 text-sm w-full md:max-w-[250px]">
                            <SelectValue placeholder={loadingCategories ? "Cargando..." : "Sin asignar"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">-- Sin asignar --</SelectItem>
                            {/* Grouping Logic */}
                            {Object.entries(groupedCategories).map(([type, groupCats]) => (
                              <SelectGroup key={type}>
                                <SelectLabel className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 capitalize">
                                  {type === 'persona' ? 'Personas' : type === 'origen' ? 'Orígenes' : type}
                                </SelectLabel>
                                {groupCats.map((cat) => (
                                  <SelectItem key={cat.codigo} value={cat.codigo}>
                                    {cat.nombre}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {lead.proyecto && <div><Label className="text-xs text-muted-foreground">Proyecto Asociado</Label><p className="font-medium flex items-center gap-2"><Briefcase className="w-4 h-4 text-purple-500" />{lead.proyecto.nombre_proyecto}</p></div>}
                    <div className="md:col-span-2"><Label className="text-xs text-muted-foreground">Descripción/Comentario</Label><p className="whitespace-pre-wrap">{lead.comentario || 'Sin comentario'}</p></div>
                    {lead.created_by_name && <div><Label className="text-xs text-muted-foreground">Creador</Label><p className="font-medium">{lead.created_by_name}</p></div>}
                  </CardContent>
                </Card>

                <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><MapPin className="w-5 h-5" /> Ubicación y Asignación</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><Label className="text-xs text-muted-foreground">Dirección</Label><p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary shrink-0" /> {lead.direccion || 'N/A'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Código Postal</Label><p>{lead.codigo_postal || 'N/A'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Municipio</Label><p>{lead.municipio || 'N/A'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Partida de Trabajo</Label><p className="capitalize">{lead.partida || 'N/A'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Responsable Principal</Label><p className="flex items-center gap-2"><HardHat className="w-4 h-4 text-primary shrink-0" />{lead.empleado_asignado ? `${lead.empleado_asignado.nombre} ${lead.empleado_asignado.apellidos || ''}` : 'Sin asignar'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Colaborador</Label><p className="flex items-center gap-2"><User className="w-4 h-4 text-primary shrink-0" />{lead.colaborador ? `${lead.colaborador.nombre} ${lead.colaborador.apellidos || ''}` : 'N/A'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Fecha de Visita</Label><p className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-primary shrink-0" />{lead.fecha_visita ? formatDate(lead.fecha_visita) : 'N/A'}</p></div>
                  </CardContent>
                </Card>

                <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Historial de Actividad y Comentarios</CardTitle></CardHeader>
                  <CardContent className="flex flex-col">
                    <div className="space-y-6">
                      {comments.length === 0 ? (
                        <div className="text-center text-muted-foreground italic">No hay comentarios aún.</div>
                      ) : (
                        comments.map(comment => (
                          <LeadComment
                            key={comment.id}
                            comment={comment}
                            onDelete={(isAdminOrEncargado || comment.autor_id === empleadoId) ? handleDeleteComment : null}
                          />
                        ))
                      )}
                    </div>
                    <div className="flex gap-2 items-end shrink-0 mt-6">
                      <Textarea placeholder="Escribe un nuevo comentario..." value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={1} className="min-h-[40px] flex-1 resize-none focus:min-h-[80px] transition-all" disabled={saving} />
                      <Button onClick={handleAddComment} disabled={!newComment.trim() || saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                        <span className="sr-only">Añadir Comentario</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="photos" className="h-full mt-0">
            <ScrollArea className="h-full p-4 md:p-6">
              <LeadPhotoGallery leadId={leadId} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="docs" className="h-full mt-0">
            <ScrollArea className="h-full p-4 md:p-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <File className="w-5 h-5" /> Documentación y Presupuestos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <LeadDocuments
                    leadId={leadId}
                    canEdit={canUploadMedia}
                    canDelete={canEdit}
                  />
                </CardContent>
              </Card>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="assignments" className="h-full mt-0">
            <ScrollArea className="h-full p-4 md:p-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5" /> Gestión de Asignaciones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <LeadAssignmentManager
                    leadId={leadId}
                    currentUserId={user?.id}
                    isAdmin={isAdminOrEncargado}
                  />
                </CardContent>
              </Card>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="fotos360" className="h-full mt-0">
            <ScrollArea className="h-full p-4 md:p-6">
              <LeadPhotos360View leadId={leadId} />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      <EditLeadModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        leadId={leadId}
        onLeadUpdated={() => {
          if (isMounted.current) {
            setIsEditModalOpen(false);
            fetchLeadData();
          }
        }}
        navigate={navigate}
      />

      <EditLeadTechnicianModal
        isOpen={isTechEditModalOpen}
        onClose={() => setIsTechEditModalOpen(false)}
        leadId={leadId}
        onLeadUpdated={() => {
          if (isMounted.current) {
            setIsTechEditModalOpen(false);
            fetchLeadData();
          }
        }}
      />

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Estás seguro de eliminar este lead?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer. Se eliminarán todos los datos asociados al lead, incluyendo comentarios y fotos.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteLead} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}<span className="ml-2">Sí, eliminar</span></AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <Dialog open={isApprovalModalOpen} onOpenChange={setIsApprovalModalOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Aprobar Lead y Convertir a Proyecto</DialogTitle><DialogDescription>Confirma la aprobación del lead. Se creará un nuevo proyecto y el estado del lead cambiará a "Aceptado".</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><div className="space-y-2"><Label htmlFor="project-description">Descripción del Proyecto (opcional)</Label><Textarea id="project-description" placeholder="Añade una descripción para el nuevo proyecto..." value={newProjectDescription} onChange={(e) => setNewProjectDescription(e.target.value)} rows={4} /></div></div><DialogFooter><Button variant="outline" onClick={() => setIsApprovalModalOpen(false)}>Cancelar</Button><Button onClick={handleApproveLead} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="w-4 h-4" />}<span className="ml-2">Confirmar Aprobación</span></Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}