import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, AlertTriangle, MessageSquare, Info, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

// Definir las opciones explícitamente según requerimiento
const tipoOptions = [
  { label: "Observación", value: "observacion" },
  { label: "Petición", value: "peticion" },
  { label: "Incidencia", value: "incidencia" }
];

const ObraObservacionesTab = ({ obraId, userRole }) => {
  const { user, sessionRole } = useAuth();
  const [observaciones, setObservaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [limit, setLimit] = useState(20);
  const [hasMore, setHasMore] = useState(false);
  
  // Default form state defaults to "observacion"
  const [formData, setFormData] = useState({
    tipo: 'observacion',
    texto: ''
  });

  // Check if current user is admin for delete permissions
  const isAdmin = userRole === 'admin' || sessionRole?.rol === 'admin';

  const fetchObservaciones = useCallback(async (isLoadMore = false) => {
    try {
      if (!isLoadMore) setLoading(true);
      
      const { data, error, count } = await supabase
        .from('obra_observaciones')
        .select(`
          *,
          empleados:creado_por_empleado_id (
            nombre,
            apellidos
          )
        `, { count: 'exact' })
        .eq('obra_id', obraId)
        .order('creado_at', { ascending: false })
        .range(0, limit - 1);

      if (error) throw error;

      setObservaciones(data || []);
      setHasMore(count > limit);
    } catch (error) {
      console.error('Error fetching observaciones:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar las observaciones.'
      });
    } finally {
      setLoading(false);
    }
  }, [obraId, limit]);

  useEffect(() => {
    if (obraId) {
      fetchObservaciones();
    }
  }, [fetchObservaciones, obraId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.texto.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campo requerido',
        description: 'Por favor escribe un texto para la observación.'
      });
      return;
    }

    // Usar el valor del estado directamente, asegurando que sea válido
    let tipoToSend = formData.tipo;
    const allowedValues = tipoOptions.map(o => o.value);
    
    if (!allowedValues.includes(tipoToSend)) {
      console.warn(`Tipo inválido detectado: "${formData.tipo}". Reseteando a "observacion".`);
      tipoToSend = 'observacion';
    }

    setSubmitting(true);
    try {
      // Resolve employee ID first
      const { data: empData } = await supabase
        .from('empleados')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      const payload = {
        obra_id: obraId,
        tipo: tipoToSend, // Valor raw (ej: 'observacion')
        texto: formData.texto.trim(),
        creado_por_auth_user_id: user.id,
        creado_por_empleado_id: empData?.id || null,
        creado_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('obra_observaciones')
        .insert(payload);

      if (error) throw error;

      toast({
        title: 'Observación guardada',
        description: 'La observación se ha registrado correctamente.'
      });

      setFormData({ tipo: 'observacion', texto: '' });
      // Reset pagination to see the new item at the top
      if (limit > 20) setLimit(20); 
      fetchObservaciones(); 

    } catch (error) {
      console.error('Error saving observacion:', error);
      
      // Manejo específico de errores de restricción (CHECK constraint)
      if (error.code === '23514') { // check_violation
        toast({
          variant: 'destructive',
          title: 'Error de validación',
          description: `El tipo de nota "${formData.tipo}" no es válido para esta obra.`
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message || 'No se pudo guardar la observación.'
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (obsId) => {
    if (!isAdmin) return;
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta observación? Esta acción no se puede deshacer.')) return;

    setDeletingId(obsId);
    try {
      const { error } = await supabase
        .from('obra_observaciones')
        .delete()
        .eq('id', obsId);

      if (error) throw error;

      toast({
        title: 'Observación eliminada',
        description: 'El registro ha sido eliminado correctamente.'
      });

      // Remove from local state
      setObservaciones(prev => prev.filter(item => item.id !== obsId));

    } catch (error) {
      console.error('Error deleting observacion:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar la observación.'
      });
    } finally {
      setDeletingId(null);
    }
  };

  const getBadgeStyle = (tipo) => {
    const safeTipo = (tipo || '').toLowerCase();
    switch (safeTipo) {
      case 'observacion': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      case 'peticion': return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
      case 'incidencia': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getTypeIcon = (tipo) => {
    const safeTipo = (tipo || '').toLowerCase();
    switch (safeTipo) {
      case 'observacion': return <Info className="w-3 h-3 mr-1" />;
      case 'peticion': return <MessageSquare className="w-3 h-3 mr-1" />;
      case 'incidencia': return <AlertTriangle className="w-3 h-3 mr-1" />;
      default: return null;
    }
  };

  const getTypeLabel = (tipo) => {
    const safeTipo = (tipo || '').toLowerCase();
    const option = tipoOptions.find(o => o.value === safeTipo);
    return option ? option.label : (tipo || 'Nota');
  };

  const getEmoji = (val) => {
    switch(val) {
      case 'observacion': return '🔵 ';
      case 'peticion': return '🟠 ';
      case 'incidencia': return '🔴 ';
      default: return '';
    }
  };

  const getAuthorName = (obs) => {
    if (obs.empleados && obs.empleados.nombre) {
      return `${obs.empleados.nombre} ${obs.empleados.apellidos || ''}`;
    }
    return 'Usuario desconocido';
  };

  return (
    <div className="space-y-6">
      {/* Form Section */}
      <Card className="border-l-4 border-l-primary shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Nueva Observación
          </CardTitle>
          <CardDescription>
            Añade notas, peticiones o reporta incidencias sobre esta obra.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="w-full md:w-1/3">
              <Select 
                value={formData.tipo} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, tipo: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de nota" />
                </SelectTrigger>
                <SelectContent>
                  {tipoOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {getEmoji(option.value)}{option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Textarea 
              placeholder="Escribe aquí los detalles..." 
              value={formData.texto}
              onChange={(e) => setFormData(prev => ({ ...prev, texto: e.target.value }))}
              className="min-h-[100px] resize-y"
            />

            <div className="flex justify-end">
              <Button 
                onClick={handleSubmit} 
                disabled={submitting || !formData.texto.trim()}
                className="gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Guardar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground/80">
          <Info className="w-5 h-5" /> Historial de Observaciones
        </h3>

        {loading && observaciones.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : observaciones.length === 0 ? (
          <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
            <p className="text-muted-foreground">Aún no hay observaciones en esta obra.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {observaciones.map((obs) => (
              <Card key={obs.id} className="overflow-hidden transition-all hover:shadow-md group">
                <CardContent className="p-4 sm:p-6 relative">
                  {/* Delete Button (Admin Only) */}
                  {isAdmin && (
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(obs.id)}
                        disabled={deletingId === obs.id}
                      >
                        {deletingId === obs.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2 pr-8">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn("capitalize px-2 py-0.5", getBadgeStyle(obs.tipo))}>
                        {getTypeIcon(obs.tipo)}
                        {getTypeLabel(obs.tipo)}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        {format(new Date(obs.creado_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </span>
                    </div>
                    {/* Display Author */}
                    <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                      Por: {getAuthorName(obs)}
                    </span>
                  </div>
                  
                  <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed pl-1 mt-3">
                    {obs.texto}
                  </div>
                </CardContent>
              </Card>
            ))}

            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => setLimit(prev => prev + 20)}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Ver más observaciones
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ObraObservacionesTab;