import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  PlayCircle,
  PauseCircle,
  AlertTriangle,
  ClipboardList,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

const MOTIVOS_PAUSA = [
  { value: 'descarga_material', label: 'Descarga de material' },
  { value: 'ayudar_companero', label: 'Ayudar a compañero' },
  { value: 'imprevisto', label: 'Imprevisto / Urgencia' },
  { value: 'otro', label: 'Otro motivo' }
];

const SeleccionTareaModal = ({ 
  isOpen, 
  onClose, 
  proyectoId, 
  empleadoId,
  onTareaSeleccionada 
}) => {
  const [loading, setLoading] = useState(true);
  const [tareaActiva, setTareaActiva] = useState(null);
  const [tareasDisponibles, setTareasDisponibles] = useState([]);
  const [modo, setModo] = useState('normal'); // 'normal' | 'pausar' | 'seleccionar'
  const [motivoPausa, setMotivoPausa] = useState('');
  const [motivoOtro, setMotivoOtro] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (isOpen && proyectoId && empleadoId) {
      fetchTareas();
    }
  }, [isOpen, proyectoId, empleadoId]);

  const fetchTareas = async () => {
    setLoading(true);
    try {
      // 1. Buscar si tiene tarea activa (en_curso) en esta obra
      const { data: activa, error: errorActiva } = await supabase
        .from('tareas')
        .select(`
          id,
          titulo,
          descripcion,
          estado,
          fecha_inicio_real,
          tipo_tarea_medible_id,
          cantidad_medible,
          unidad_medible,
          tipos_tarea_medible(nombre, unidad)
        `)
        .eq('proyecto_id', proyectoId)
        .eq('estado', 'en_progreso')
        .not('fecha_inicio_real', 'is', null)
        .limit(1)
        .maybeSingle();

      if (errorActiva) throw errorActiva;

      // Verificar si la tarea activa está asignada a este empleado
      if (activa) {
        const { data: asignacion } = await supabase
          .from('tarea_empleados')
          .select('id')
          .eq('tarea_id', activa.id)
          .eq('empleado_id', empleadoId)
          .maybeSingle();

        if (asignacion) {
          setTareaActiva(activa);
          setModo('normal');
        } else {
          setTareaActiva(null);
        }
      } else {
        setTareaActiva(null);
      }

      // 2. Buscar tareas pendientes asignadas a este empleado en esta obra
      const { data: asignaciones, error: errorAsig } = await supabase
        .from('tarea_empleados')
        .select('tarea_id')
        .eq('empleado_id', empleadoId);

      if (errorAsig) throw errorAsig;

      const tareasIds = asignaciones?.map(a => a.tarea_id) || [];

      if (tareasIds.length > 0) {
        const { data: disponibles, error: errorDisp } = await supabase
          .from('tareas')
          .select(`
            id,
            titulo,
            descripcion,
            estado,
            fecha_limite,
            tipo_tarea_medible_id,
            cantidad_medible,
            unidad_medible,
            tipos_tarea_medible(nombre, unidad)
          `)
          .eq('proyecto_id', proyectoId)
          .in('id', tareasIds)
          .in('estado', ['pendiente', 'en_progreso'])
          .is('fecha_inicio_real', null)
          .order('orden', { ascending: true });

        if (errorDisp) throw errorDisp;
        setTareasDisponibles(disponibles || []);
      } else {
        setTareasDisponibles([]);
      }

      // Si no hay tarea activa, ir directo a seleccionar
      if (!activa) {
        setModo('seleccionar');
      }

    } catch (err) {
      console.error('Error fetching tareas:', err);
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: 'No se pudieron cargar las tareas.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleContinuarTarea = () => {
    // Simplemente cerrar el modal, la tarea sigue activa
    toast({
      title: 'Continuando tarea',
      description: `Sigues trabajando en: ${tareaActiva.titulo}`,
      className: 'bg-green-600 text-white'
    });
    onTareaSeleccionada?.(tareaActiva);
    onClose();
  };

  const handlePausarTarea = async () => {
    if (!motivoPausa) {
      toast({ variant: 'destructive', title: 'Selecciona un motivo de pausa' });
      return;
    }

    const motivoFinal = motivoPausa === 'otro' ? motivoOtro : 
      MOTIVOS_PAUSA.find(m => m.value === motivoPausa)?.label;

    if (motivoPausa === 'otro' && !motivoOtro.trim()) {
      toast({ variant: 'destructive', title: 'Escribe el motivo de la pausa' });
      return;
    }

    setActionLoading(true);
    try {
      // Pausar la tarea actual
      const { error } = await supabase
        .from('tareas')
        .update({
          motivo_pausa: motivoFinal,
          fecha_pausa: new Date().toISOString()
        })
        .eq('id', tareaActiva.id);

      if (error) throw error;

      toast({
        title: 'Tarea pausada',
        description: motivoFinal,
        className: 'bg-orange-600 text-white'
      });

      // Mostrar lista de tareas para elegir nueva
      setTareaActiva(null);
      setModo('seleccionar');
      setMotivoPausa('');
      setMotivoOtro('');

    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSeleccionarTarea = async (tarea) => {
    setActionLoading(true);
    try {
      // Marcar tarea como iniciada
      const { error } = await supabase
        .from('tareas')
        .update({
          estado: 'en_progreso',
          fecha_inicio_real: new Date().toISOString(),
          motivo_pausa: null,
          fecha_pausa: null
        })
        .eq('id', tarea.id);

      if (error) throw error;

      toast({
        title: 'Tarea iniciada',
        description: tarea.titulo,
        className: 'bg-green-600 text-white'
      });

      onTareaSeleccionada?.(tarea);
      onClose();

    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Render según el modo
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }

    // Modo: Tiene tarea activa
    if (tareaActiva && modo === 'normal') {
      return (
        <div className="space-y-6">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-start gap-3">
              <PlayCircle className="w-6 h-6 text-green-600 mt-1" />
              <div className="flex-1">
                <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                  Tienes una tarea en curso:
                </p>
                <h3 className="text-lg font-bold text-green-900 dark:text-green-100 mt-1">
                  {tareaActiva.titulo}
                </h3>
                {tareaActiva.tipos_tarea_medible && (
                  <p className="text-sm text-green-600 mt-1">
                    {tareaActiva.tipos_tarea_medible.nombre} • {tareaActiva.cantidad_medible} {tareaActiva.unidad_medible}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Button
              size="lg"
              className="h-14 text-lg bg-green-600 hover:bg-green-700"
              onClick={handleContinuarTarea}
              disabled={actionLoading}
            >
              <PlayCircle className="mr-2 h-5 w-5" />
              Continuar con esta tarea
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="h-14 text-lg border-orange-500 text-orange-700 hover:bg-orange-50"
              onClick={() => setModo('pausar')}
              disabled={actionLoading}
            >
              <PauseCircle className="mr-2 h-5 w-5" />
              Pausar y hacer otra
            </Button>
          </div>
        </div>
      );
    }

    // Modo: Pausar tarea
    if (modo === 'pausar') {
      return (
        <div className="space-y-6">
          <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-orange-600 mt-1" />
              <div>
                <p className="text-sm text-orange-700 dark:text-orange-300 font-medium">
                  Vas a pausar la tarea:
                </p>
                <h3 className="font-bold text-orange-900 dark:text-orange-100">
                  {tareaActiva?.titulo}
                </h3>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>¿Por qué pausas esta tarea?</Label>
              <Select value={motivoPausa} onValueChange={setMotivoPausa}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS_PAUSA.map(m => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {motivoPausa === 'otro' && (
              <div className="space-y-2">
                <Label>Describe el motivo</Label>
                <Textarea
                  value={motivoOtro}
                  onChange={(e) => setMotivoOtro(e.target.value)}
                  placeholder="Escribe aquí el motivo..."
                  rows={2}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => setModo('normal')}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700"
              onClick={handlePausarTarea}
              disabled={actionLoading || !motivoPausa}
            >
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              Pausar y continuar
            </Button>
          </div>
        </div>
      );
    }

    // Modo: Seleccionar tarea
    if (modo === 'seleccionar') {
      if (tareasDisponibles.length === 0) {
        return (
          <div className="space-y-6">
            <div className="p-8 text-center">
              <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No tienes tareas asignadas</h3>
              <p className="text-muted-foreground text-sm mt-2">
                No hay tareas pendientes para ti en esta obra. Contacta con tu encargado.
              </p>
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selecciona la tarea en la que vas a trabajar:
          </p>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {tareasDisponibles.map((tarea) => (
              <div
                key={tarea.id}
                onClick={() => !actionLoading && handleSeleccionarTarea(tarea)}
                className={cn(
                  "p-4 border rounded-lg cursor-pointer transition-all",
                  "hover:border-primary hover:bg-primary/5",
                  "active:scale-[0.98]",
                  actionLoading && "opacity-50 pointer-events-none"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold">{tarea.titulo}</h4>
                    {tarea.descripcion && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {tarea.descripcion}
                      </p>
                    )}
                    {tarea.tipos_tarea_medible && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                          {tarea.tipos_tarea_medible.nombre}
                        </span>
                        {tarea.cantidad_medible && (
                          <span className="text-xs text-muted-foreground">
                            {tarea.cantidad_medible} {tarea.unidad_medible}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <PlayCircle className="w-6 h-6 text-primary shrink-0" />
                </div>
              </div>
            ))}
          </div>

        </div>
      );
    }
  };

  // ✅ El modal no se puede cerrar si hay tareas disponibles (obligatorio elegir)
  const canClose = tareasDisponibles.length === 0 || tareaActiva !== null;

  return (
    <Dialog open={isOpen} onOpenChange={canClose ? onClose : undefined}>
      <DialogContent 
        className="sm:max-w-[500px]"
        onPointerDownOutside={(e) => !canClose && e.preventDefault()}
        onEscapeKeyDown={(e) => !canClose && e.preventDefault()}
        hideCloseButton={!canClose}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            {modo === 'pausar' ? 'Pausar tarea' : 
             tareaActiva ? 'Tarea en curso' : 
             '¿Qué tarea vas a hacer?'}
          </DialogTitle>
          <DialogDescription>
            {modo === 'pausar' 
              ? 'Indica el motivo de la pausa'
              : tareaActiva 
                ? 'Continúa con tu tarea o selecciona otra'
                : 'Selecciona la tarea en la que trabajarás hoy'
            }
          </DialogDescription>
        </DialogHeader>

        {renderContent()}

      </DialogContent>
    </Dialog>
  );
};

export default SeleccionTareaModal;
