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
  Clock, AlertCircle, View, FileText, Users, File, Camera, Tag, ChevronDown
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
import LeadVisitBudget from '@/components/LeadVisitBudget';

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

  // Quién puede cambiar el estado del lead desde el selector: admin, encargado,
  // o el técnico asignado a este lead (por empleado_asignado_id o por
  // leads_asignaciones, vía isAssigned). Refleja lo que ya permite la RLS
  // (leads_update_policy_v2), solo faltaba habilitarlo en el frontend.
  const canEditLeadStatus = isAdminOrEncargado || isAssigned || (lead?.empleado_asignado_id === empleadoId);

  // For sub-resources
  const canUploadMedia = canEdit;

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // La lectura es individual: abrir el detalle deja este lead leído solo
  // para el usuario actual, sin modificar la actividad del lead.
  useEffect(() => {
    if (!leadId || !user?.id) return;
    supabase
      .from('lead_lecturas')
      .upsert(
        { lead_id: leadId, usuario_id: user.id, visto_at: new Date().toISOString() },
        { onConflict: 'lead_id,usuario_id' }
      )
      .then(({ error }) => {
        if (error) console.error('Error marcando lectura del lead:', error);
      });
  }, [leadId, user?.id]);

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
          categoria:categorias(codigo, nombre)
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

  const handleConvertToParte = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('convert_lead_to_parte', {
        p_lead_id: leadId
      });
      if (error) throw error;

      if (data && data.parte_id) {
        toast({
          title: data.already_existed ? 'Parte ya existente' : 'Parte de trabajo creado',
          description: data.custom_id ? `Nº ${data.custom_id}` : undefined,
        });
        navigate(`/gestion/partes/detail/${data.parte_id}`);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'No se recibió el ID del parte.' });
      }
    } catch (error) {
      console.error('Convert to parte error:', error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo convertir el lead a parte.' });
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

  const companyName = lead.nombre_empresa ? String(lead.nombre_empresa).trim() : '';
  const contactName = lead.nombre_contacto ? String(lead.nombre_contacto).trim() : '';
  const mobileTitle = companyName || contactName || 'Lead sin nombre';

  return (
    <div className="flex flex-col h-full bg-background">
      <Helmet><title>{mobileTitle} | Detalle de Lead</title></Helmet>

      <div className="flex flex-col border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="flex flex-col gap-3 px-4 md:px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4 w-full min-w-0">

            {/* Back button logic */}
            <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0" title="Volver al listado">
              <ArrowLeft className="w-5 h-5" />
            </Button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="hidden md:flex text-xl font-bold items-center gap-2 truncate">{contactName || mobileTitle} {companyName && <span className="text-muted-foreground ml-1">({companyName})</span>}</h1>
                <h1 className="md:hidden flex-1 min-w-0 text-xl font-bold leading-tight whitespace-nowrap overflow-x-auto no-scrollbar">{mobileTitle}</h1>

                <div className="w-full md:contents">
                  {/* Updated Status Selector Component: editable para admin, encargado y técnico asignado */}
                  <LeadStatusSelector
                    currentStatus={lead.estado}
                    leadId={lead.id}
                    userRole={sessionRole?.rol}
                    canEdit={canEditLeadStatus}
                    onStatusChange={handleStatusChangeCallback}
                  />

                  {/* El selector de procedencia/categoría solo se muestra en escritorio. */}
                  {isAdmin && (
                    <div className="hidden md:block">
                      <Select
                        value={categories.some(c => c.codigo === lead?.categoria?.codigo) ? lead.categoria.codigo : ""}
                        onValueChange={handleCategoryChange}
                        disabled={isAssigningCategory || loadingCategories}
                      >
                        <SelectTrigger className="h-8 text-sm w-auto min-w-[140px] max-w-[220px] shrink-0">
                          <span className="flex items-center gap-1 truncate">
                            <Tag className="w-3.5 h-3.5 shrink-0" />
                            <SelectValue placeholder={loadingCategories ? "Cargando..." : "Sin categoría"} />
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- Sin asignar --</SelectItem>
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
                </div>
              </div>
              <div className="hidden md:flex text-xs text-muted-foreground mt-1 flex-wrap gap-3"><span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Creado: {formatDate(lead.fecha_creacion)}</span>{lead.empleado_asignado && (<span className="flex items-center gap-1"><User className="w-3 h-3" /> Asignado a: {lead.empleado_asignado.nombre} {lead.empleado_asignado.apellidos}</span>)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full justify-end md:w-auto">

            {canEdit && (
              <Button variant="outline" size="icon" onClick={handleEditClick}><Edit className="w-4 h-4" /></Button>
            )}

            {canDeleteLead && lead.estado !== 'aceptado' && (
              <Button variant="destructive" size="icon" onClick={() => setIsDeleteAlertOpen(true)}><Trash2 className="w-4 h-4" /></Button>
            )}

            {/* Convertir a Parte de Trabajo: técnico/encargado/admin o asignado, si no está finalizado/aceptado */}
            {(isAdminOrEncargado || isTechnician || isAssigned || isOwner) && lead.estado !== 'aceptado' && lead.estado !== 'finalizado' && (
              <>
                <Button onClick={handleConvertToParte} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white hidden sm:flex"><HardHat className="w-4 h-4 mr-2" /> Convertir a Parte</Button>
                <Button onClick={handleConvertToParte} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white sm:hidden" size="icon" title="Convertir a Parte de Trabajo"><HardHat className="w-4 h-4" /></Button>
              </>
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
            <TabsList className="hidden w-full justify-start overflow-x-auto bg-transparent p-0 h-auto rounded-none space-x-4 border-none no-scrollbar md:flex">
              <TabsTrigger
                value="info"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-3 font-semibold text-muted-foreground transition-all hover:text-foreground flex items-center gap-2"
              >
                <FileText className="w-4 h-4" /> Información
              </TabsTrigger>

              <TabsTrigger
                value="visit-budget"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-3 font-semibold text-muted-foreground transition-all hover:text-foreground flex items-center gap-2"
              >
                <FileText className="w-4 h-4" /> Visita y presupuesto
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50/50 dark:bg-background/50">
        {/* En móvil cada cabecera se coloca justo antes del contenido que abre. */}
        <div className="contents md:hidden">
          {[
            { value: 'info', label: 'Información', icon: FileText },
            { value: 'photos', label: 'Fotos', icon: Camera },
            { value: 'docs', label: 'Documentos', icon: File },
            { value: 'fotos360', label: 'Fotos 360º', icon: View },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(activeTab === value ? '' : value)}
              style={{ order: activeTab === value ? 0 : activeTab ? 2 : 1 }}
              className={`mx-3 flex w-auto shrink-0 items-center justify-between rounded-lg border px-3 py-3 text-left transition-colors ${
                activeTab === value
                  ? 'border-primary/40 bg-primary/5 text-primary'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="h-4 w-4" /> {label}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${activeTab === value ? 'rotate-180' : ''}`} />
            </button>
          ))}
        </div>

        <Tabs value={activeTab} className={`min-h-0 h-full ${activeTab ? 'order-1' : 'order-2'}`}>
          <TabsContent value="info" className="h-full mt-0">
            <ScrollArea className="h-full p-3 md:p-6">
              <div className="space-y-6 pb-10">

                {/* ====================================================================== */}
                {/* SECCIÓN 1: Información General + Ubicación y Asignación (UNIFICADAS)    */}
                {/* ====================================================================== */}
                <Card>
                  <CardHeader className="p-4 md:p-6">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Megaphone className="w-5 h-5" /> Información General y Ubicación
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-x-6 md:gap-y-3 md:p-6 [&>div]:min-w-0 [&>div]:rounded-lg [&>div]:bg-slate-50/70 [&>div]:p-2.5 md:[&>div]:rounded-none md:[&>div]:bg-transparent md:[&>div]:p-0">
                    {lead.nombre_contacto?.trim() && <div><Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Nombre de Contacto</Label><p className="mt-1 break-words font-medium">{lead.nombre_contacto}</p></div>}
                    {lead.nombre_empresa?.trim() && <div><Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Nombre de Empresa</Label><p className="mt-1 break-words font-medium">{lead.nombre_empresa}</p></div>}
                    {lead.telefono?.trim() && <div><Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Teléfono</Label><a href={`tel:${lead.telefono}`} className="mt-1 flex items-center gap-2 break-all text-primary hover:underline"><Phone className="h-4 w-4 shrink-0" /> {lead.telefono}</a></div>}
                    {lead.email?.trim() && <div><Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Email</Label><a href={`mailto:${lead.email}`} className="mt-1 flex items-center gap-2 break-all text-primary hover:underline"><Mail className="h-4 w-4 shrink-0" /> {lead.email}</a></div>}
                    {lead.cif?.trim() && <div><Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">CIF</Label><p className="mt-1 break-words">{lead.cif}</p></div>}
                    {lead.base_imponible !== null && lead.base_imponible !== undefined && (
                      <div>
                        <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Presupuesto</Label>
                        <p className="mt-1 text-lg font-semibold text-emerald-600">
                          {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(lead.base_imponible)}
                        </p>
                      </div>
                    )}

                    {/* Campos de Ubicación y Asignación (fundidos en el mismo grid) */}
                    {lead.direccion?.trim() && <div><Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Dirección</Label><p className="mt-1 flex items-start gap-2 break-words"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {lead.direccion}</p></div>}
                    {lead.codigo_postal?.trim() && <div><Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Código Postal</Label><p className="mt-1 break-words">{lead.codigo_postal}</p></div>}
                    {lead.municipio?.trim() && <div><Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Municipio</Label><p className="mt-1 break-words">{lead.municipio}</p></div>}
                    {lead.partida?.trim() && <div><Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Partida de Trabajo</Label><p className="mt-1 capitalize break-words">{lead.partida}</p></div>}
                    {lead.empleado_asignado && <div><Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Responsable Principal</Label><p className="mt-1 flex items-start gap-2 break-words"><HardHat className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{`${lead.empleado_asignado.nombre} ${lead.empleado_asignado.apellidos || ''}`.trim()}</p></div>}
                    {lead.colaborador && <div><Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Colaborador</Label><p className="mt-1 flex items-start gap-2 break-words"><User className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{`${lead.colaborador.nombre} ${lead.colaborador.apellidos || ''}`.trim()}</p></div>}
                    {lead.fecha_visita && <div><Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fecha de Visita</Label><p className="mt-1 flex items-center gap-2 break-words"><CalendarDays className="h-4 w-4 shrink-0 text-primary" />{formatDate(lead.fecha_visita)}</p></div>}

                    {/* Descripción ocupa fila completa al final */}
                    {lead.comentario?.trim() && <div className="col-span-full"><Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Descripción/Comentario</Label><p className="mt-1 whitespace-pre-wrap break-words">{lead.comentario}</p></div>}
                  </CardContent>
                </Card>

                {/* ====================================================================== */}
                {/* SECCIÓN 2: Historial de Actividad y Comentarios                        */}
                {/* ====================================================================== */}
                <Card>
                  <CardHeader className="p-4 md:p-6">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" /> Historial de Actividad y Comentarios
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col p-4 md:p-6">
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
                    
                    {/* MODIFICADO: Textarea más grande y mejor distribuido */}
                    <div className="flex flex-col gap-3 shrink-0 mt-6 pt-4 border-t">
                      <Textarea 
                        placeholder="Escribe un nuevo comentario..." 
                        value={newComment} 
                        onChange={(e) => setNewComment(e.target.value)} 
                        rows={3} 
                        className="min-h-[80px] flex-1 resize-y focus:min-h-[180px] focus:ring-2 focus:ring-primary/20 transition-all duration-300" 
                        disabled={saving} 
                      />
                      <div className="flex justify-end">
                        <Button onClick={handleAddComment} disabled={!newComment.trim() || saving} className="w-full sm:w-auto sm:min-w-[160px]">
                          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                          Añadir Comentario
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="photos" className="h-full mt-0">
            <ScrollArea className="h-full p-3 md:p-6">
              <LeadPhotoGallery leadId={leadId} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="visit-budget" className="h-full mt-0">
            <ScrollArea className="h-full p-3 md:p-6">
              <LeadVisitBudget leadId={leadId} canEdit={canEdit} lead={lead} navigate={navigate} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="docs" className="h-full mt-0">
            <ScrollArea className="h-full p-3 md:p-6">
              <Card>
                <CardHeader className="p-4 md:p-6">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <File className="w-5 h-5" /> Documentación y Presupuestos
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 md:p-6">
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
            <ScrollArea className="h-full p-3 md:p-6">
              <Card>
                <CardHeader className="p-4 md:p-6">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5" /> Gestión de Asignaciones
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 md:p-6">
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
            <ScrollArea className="h-full p-3 md:p-6">
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
