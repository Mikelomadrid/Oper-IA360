/**
 * LeadInheritedInfo.jsx
 *
 * Muestra, dentro de una obra/proyecto, la información heredada del lead
 * del que nació la obra. Replica fielmente las dos tarjetas del detalle del lead:
 *   1. "Información General y Ubicación" (solo lectura)
 *   2. "Historial de Actividad y Comentarios" (funcional: añadir/borrar)
 *
 * Reutiliza las mismas queries y RPCs que LeadDetail.jsx, por lo que los datos
 * y comentarios son los mismos que se introdujeron en el lead.
 *
 * Props:
 *   - leadId: UUID del lead de origen (proyectos.lead_id)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Megaphone, MapPin, MessageSquare, Phone, Mail, HardHat, User,
  CalendarDays, Trash2, PlusCircle, Loader2
} from 'lucide-react';

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

export default function LeadInheritedInfo({ leadId }) {
  const { user, sessionRole, empleadoId } = useAuth();

  const [lead, setLead] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newComment, setNewComment] = useState('');

  const isMounted = useRef(false);
  const isAdminOrEncargado = sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado';

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchComments = useCallback(async () => {
    if (!leadId) return;
    try {
      const { data, error } = await supabase
        .from('v_lead_comentarios_extended')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (isMounted.current) setComments(data || []);
    } catch (error) {
      console.error('Error fetching lead comments (inherited):', error);
    }
  }, [leadId]);

  const fetchLead = useCallback(async () => {
    if (!leadId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          empleado_asignado:empleados!leads_empleado_asignado_id_fkey(id, nombre, apellidos),
          colaborador:empleados!leads_colaborador_id_fkey(id, nombre, apellidos)
        `)
        .eq('id', leadId)
        .maybeSingle();
      if (error) throw error;
      if (isMounted.current) {
        setLead(data);
        fetchComments();
      }
    } catch (error) {
      console.error('Error fetching inherited lead:', error);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [leadId, fetchComments]);

  useEffect(() => { fetchLead(); }, [fetchLead]);

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
      toast({ variant: 'destructive', title: 'Error al añadir comentario', description: error.message });
    } finally {
      if (isMounted.current) setSaving(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('¿Borrar comentario?')) return;
    try {
      const { error } = await supabase.from('lead_comentarios').delete().eq('id', commentId);
      if (error) throw error;
      toast({ title: 'Comentario eliminado' });
      fetchComments();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  // Si la obra no proviene de un lead, no se muestra nada.
  if (!leadId) return null;

  if (loading) {
    return (
      <Card className="mt-4 md:mt-6">
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!lead) return null;

  return (
    <div className="space-y-4 md:space-y-6 mt-4 md:mt-6">

      {/* ===================================================================== */}
      {/* Información General y Ubicación (heredada del lead) — solo lectura     */}
      {/* ===================================================================== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Megaphone className="w-5 h-5" /> Información General y Ubicación
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
          <div><Label className="text-xs text-muted-foreground">Nombre de Contacto</Label><p className="font-medium">{lead.nombre_contacto || 'N/A'}</p></div>
          <div><Label className="text-xs text-muted-foreground">Nombre de Empresa</Label><p className="font-medium">{lead.nombre_empresa || 'N/A'}</p></div>
          <div><Label className="text-xs text-muted-foreground">Teléfono</Label><a href={`tel:${lead.telefono}`} className="flex items-center gap-2 text-primary hover:underline"><Phone className="w-4 h-4" /> {lead.telefono || 'N/A'}</a></div>
          <div><Label className="text-xs text-muted-foreground">Email</Label><a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-primary hover:underline"><Mail className="w-4 h-4" /> {lead.email || 'N/A'}</a></div>
          <div><Label className="text-xs text-muted-foreground">CIF</Label><p>{lead.cif || 'N/A'}</p></div>
          {lead.base_imponible !== null && lead.base_imponible !== undefined && (
            <div>
              <Label className="text-xs text-muted-foreground">Presupuesto</Label>
              <p className="font-semibold text-lg text-emerald-600">
                {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(lead.base_imponible)}
              </p>
            </div>
          )}
          {lead.origen && <div><Label className="text-xs text-muted-foreground">Origen</Label><p className="font-medium">{lead.origen}</p></div>}

          {/* Ubicación y Asignación (mismo grid) */}
          <div><Label className="text-xs text-muted-foreground">Dirección</Label><p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary shrink-0" /> {lead.direccion || 'N/A'}</p></div>
          <div><Label className="text-xs text-muted-foreground">Código Postal</Label><p>{lead.codigo_postal || 'N/A'}</p></div>
          <div><Label className="text-xs text-muted-foreground">Municipio</Label><p>{lead.municipio || 'N/A'}</p></div>
          <div><Label className="text-xs text-muted-foreground">Partida de Trabajo</Label><p className="capitalize">{lead.partida || 'N/A'}</p></div>
          <div><Label className="text-xs text-muted-foreground">Responsable Principal</Label><p className="flex items-center gap-2"><HardHat className="w-4 h-4 text-primary shrink-0" />{lead.empleado_asignado ? `${lead.empleado_asignado.nombre} ${lead.empleado_asignado.apellidos || ''}` : 'Sin asignar'}</p></div>
          <div><Label className="text-xs text-muted-foreground">Colaborador</Label><p className="flex items-center gap-2"><User className="w-4 h-4 text-primary shrink-0" />{lead.colaborador ? `${lead.colaborador.nombre} ${lead.colaborador.apellidos || ''}` : 'N/A'}</p></div>
          <div><Label className="text-xs text-muted-foreground">Fecha de Visita</Label><p className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-primary shrink-0" />{lead.fecha_visita ? formatDate(lead.fecha_visita) : 'N/A'}</p></div>

          {/* Descripción ocupa fila completa al final */}
          <div className="col-span-full"><Label className="text-xs text-muted-foreground">Descripción/Comentario</Label><p className="whitespace-pre-wrap">{lead.comentario || 'Sin comentario'}</p></div>
          {lead.created_by_name && <div><Label className="text-xs text-muted-foreground">Creador</Label><p className="font-medium">{lead.created_by_name}</p></div>}
        </CardContent>
      </Card>

      {/* ===================================================================== */}
      {/* Historial de Actividad y Comentarios (heredado del lead) — funcional  */}
      {/* ===================================================================== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5" /> Historial de Actividad y Comentarios
          </CardTitle>
        </CardHeader>
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
              <Button onClick={handleAddComment} disabled={!newComment.trim() || saving} className="min-w-[160px]">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                Añadir Comentario
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
