import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2, Droplets, Euro } from 'lucide-react';
import { format } from 'date-fns';

const TARIFA_FONTANERIA = 15;

/**
 * FontaneriaModal
 * Aparece tras el cierre de fichaje (salida) si el usuario es fran@orkaled.com.
 * Permite registrar horas de fontanería por obra.
 */
export default function FontaneriaModal({ isOpen, onClose, fecha }) {
  const [proyectos, setProyectos] = useState([]);
  const [filas, setFilas] = useState([{ obra_id: '', horas: '' }]);
  const [saving, setSaving] = useState(false);
  const [loadingProyectos, setLoadingProyectos] = useState(false);

  // Cargar obras activas al abrir
  useEffect(() => {
    if (isOpen) {
      cargarProyectos();
      setFilas([{ obra_id: '', horas: '' }]);
    }
  }, [isOpen]);

  const cargarProyectos = async () => {
    setLoadingProyectos(true);
    try {
      const { data, error } = await supabase
        .from('proyectos')
        .select('id, nombre_proyecto')
        .eq('estado', 'activo')
        .order('nombre_proyecto');
      if (error) throw error;
      setProyectos(data || []);
    } catch (err) {
      console.error('Error cargando proyectos:', err);
    } finally {
      setLoadingProyectos(false);
    }
  };

  const handleAddFila = () => {
    setFilas(prev => [...prev, { obra_id: '', horas: '' }]);
  };

  const handleRemoveFila = (index) => {
    setFilas(prev => prev.filter((_, i) => i !== index));
  };

  const handleChangeObra = (index, value) => {
    setFilas(prev => prev.map((f, i) => i === index ? { ...f, obra_id: value } : f));
  };

  const handleChangeHoras = (index, value) => {
    // Solo números positivos con hasta 1 decimal
    if (value === '' || /^\d{0,2}(\.\d{0,1})?$/.test(value)) {
      setFilas(prev => prev.map((f, i) => i === index ? { ...f, horas: value } : f));
    }
  };

  const totalHoras = filas.reduce((acc, f) => acc + (parseFloat(f.horas) || 0), 0);
  const totalEuros = totalHoras * TARIFA_FONTANERIA;

  const handleSaltar = () => {
    onClose();
  };

  const handleGuardar = async () => {
    // Validar que todas las filas tengan obra y horas
    const filasValidas = filas.filter(f => f.obra_id && parseFloat(f.horas) > 0);
    if (filasValidas.length === 0) {
      toast({
        title: 'Datos incompletos',
        description: 'Añade al menos una obra con horas para guardar.',
        variant: 'destructive',
      });
      return;
    }

    // Validar filas incompletas
    const filasIncompletas = filas.filter(f => (f.obra_id && !f.horas) || (!f.obra_id && f.horas));
    if (filasIncompletas.length > 0) {
      toast({
        title: 'Filas incompletas',
        description: 'Completa o elimina las filas que tienen datos a medias.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // Obtener el empleado actual
      const { data: { user } } = await supabase.auth.getUser();
      const { data: empData } = await supabase
        .from('empleados')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      const fechaRegistro = fecha || format(new Date(), 'yyyy-MM-dd');

      // Insertar cada fila
      const inserts = filasValidas.map(f => ({
        fecha: fechaRegistro,
        obra_id: f.obra_id,
        horas: parseFloat(f.horas),
        user_id: user.id,
        empleado_id: empData?.id || null,
      }));

      const { error } = await supabase
        .from('fontaneria_horas')
        .insert(inserts);

      if (error) throw error;

      toast({
        title: '✅ Horas de fontanería guardadas',
        description: `${totalHoras}h registradas → ${totalEuros.toFixed(2)}€ extra`,
        className: 'bg-blue-600 text-white',
      });

      onClose();
    } catch (err) {
      console.error('Error guardando fontanería:', err);
      toast({
        title: 'Error al guardar',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-700">
            <Droplets className="w-5 h-5 text-blue-500" />
            Horas de Fontanería — {fecha ? format(new Date(fecha), 'dd/MM/yyyy') : format(new Date(), 'dd/MM/yyyy')}
          </DialogTitle>
          <DialogDescription>
            ¿Has realizado trabajos de fontanería hoy? Registra las horas por obra.
            Cada hora se abona a <strong>{TARIFA_FONTANERIA}€</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Cabecera de columnas */}
          <div className="grid grid-cols-[1fr_100px_32px] gap-2 px-1">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Obra</Label>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider text-center">Horas</Label>
            <div />
          </div>

          {/* Filas dinámicas */}
          <div className="space-y-2">
            {filas.map((fila, index) => (
              <div key={index} className="grid grid-cols-[1fr_100px_32px] gap-2 items-center">
                {/* Selector de obra */}
                <Select
                  value={fila.obra_id}
                  onValueChange={(val) => handleChangeObra(index, val)}
                  disabled={loadingProyectos}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecciona obra..." />
                  </SelectTrigger>
                  <SelectContent>
                    {proyectos.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre_proyecto}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Input horas */}
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={fila.horas}
                    onChange={(e) => handleChangeHoras(index, e.target.value)}
                    className="h-9 text-center pr-7"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">h</span>
                </div>

                {/* Botón eliminar fila */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50"
                  onClick={() => handleRemoveFila(index)}
                  disabled={filas.length === 1}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Botón añadir fila */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddFila}
            className="w-full border-dashed text-muted-foreground hover:text-foreground"
          >
            <Plus className="w-4 h-4 mr-2" />
            Añadir otra obra
          </Button>

          {/* Resumen económico */}
          {totalHoras > 0 && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-700">
                <Droplets className="w-4 h-4" />
                <span className="text-sm font-medium">Total horas: <strong>{totalHoras}h</strong></span>
              </div>
              <div className="flex items-center gap-1 text-blue-800 font-bold">
                <Euro className="w-4 h-4" />
                <span>{totalEuros.toFixed(2)} €</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            onClick={handleSaltar}
            disabled={saving}
            className="text-muted-foreground"
          >
            Saltar — hoy no hice fontanería
          </Button>
          <Button
            onClick={handleGuardar}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
            ) : (
              <><Droplets className="w-4 h-4 mr-2" /> Guardar horas</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
