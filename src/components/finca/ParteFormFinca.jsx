import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from 'lucide-react';

/**
 * ParteFormFinca
 * Formulario para crear/editar Partes de Trabajo (Finca).
 * Estados permitidos: contactado, agendada_visita, visitado, en_preparacion, presupuestado, aceptado.
 */
export default function ParteFormFinca({ onSubmit, initialData = {}, isSubmitting, projects = [] }) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      titulo: '',
      descripcion: '',
      propiedad_id: 'none',
      prioridad: 'media',
      estado: 'contactado', 
      fecha_seguimiento: '',
      ...initialData
    }
  });

  const currentEstado = watch('estado');

  useEffect(() => {
    if (initialData) {
      Object.keys(initialData).forEach(key => {
        if (key === 'fecha_seguimiento' && initialData[key]) {
            setValue(key, new Date(initialData[key]).toISOString().split('T')[0]);
        } else if (key === 'estado' && initialData[key]) {
            setValue(key, initialData[key].toLowerCase());
        } else {
            setValue(key, initialData[key]);
        }
      });
    }
  }, [initialData, setValue]);

  const onFormSubmit = (data) => {
    const payload = { ...data };
    
    // Normalize state to lowercase
    if (payload.estado) {
        payload.estado = payload.estado.toLowerCase();
    }

    if (payload.propiedad_id === 'none' || !payload.propiedad_id) {
        payload.propiedad_id = null;
    }

    if (!payload.fecha_seguimiento || payload.fecha_seguimiento.trim() === '') {
        payload.fecha_seguimiento = null;
    }

    onSubmit(payload);
  };

  const renderStateItem = (value, label, colorClass) => (
    <SelectItem value={value} className="cursor-pointer">
      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${colorClass} shadow-sm`}></span>
        <span className="font-medium">{label}</span>
      </div>
    </SelectItem>
  );

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="titulo">Título del Parte *</Label>
        <Input 
          id="titulo" 
          placeholder="Ej: Reparación cerradura portal" 
          {...register("titulo", { required: "El título es obligatorio" })} 
        />
        {errors.titulo && <span className="text-xs text-red-500">{errors.titulo.message}</span>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="descripcion">Descripción del Trabajo</Label>
        <Textarea 
          id="descripcion" 
          placeholder="Detalles técnicos..." 
          {...register("descripcion")} 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Propiedad / Obra</Label>
          <Select 
            onValueChange={(val) => setValue('propiedad_id', val)} 
            defaultValue={initialData?.propiedad_id || 'none'}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar propiedad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-- Ninguna --</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre_proyecto || 'Sin Nombre'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Fecha Seguimiento</Label>
          <Input 
            type="date" 
            id="fecha_seguimiento" 
            {...register("fecha_seguimiento")} 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Estado</Label>
          <Select 
            onValueChange={(val) => setValue('estado', val)} 
            value={currentEstado || (initialData?.estado ? initialData.estado.toLowerCase() : 'contactado')}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar estado" />
            </SelectTrigger>
            <SelectContent>
              {renderStateItem('contactado', 'CONTACTADO', 'bg-blue-500')}
              {renderStateItem('agendada_visita', 'AGENDADA VISITA', 'bg-indigo-500')}
              {renderStateItem('visitado', 'VISITADO', 'bg-purple-500')}
              {renderStateItem('en_preparacion', 'EN PREPARACION', 'bg-amber-500')}
              {renderStateItem('presupuestado', 'PRESUPUESTADO', 'bg-orange-500')}
              {renderStateItem('aceptado', 'ACEPTADO', 'bg-emerald-500')}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Prioridad</Label>
          <Select 
            onValueChange={(val) => setValue('prioridad', val)} 
            defaultValue={initialData?.prioridad || 'media'}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar prioridad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="baja">Baja</SelectItem>
              <SelectItem value="media">Media</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="pt-4 flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initialData?.id ? 'Guardar Cambios' : 'Crear Parte'}
        </Button>
      </div>
    </form>
  );
}