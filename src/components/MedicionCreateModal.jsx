import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from "@/components/ui/use-toast";

export default function MedicionCreateModal({ isOpen, onClose, onSuccess }) {
  const [nombre, setNombre] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!nombre.trim()) return;

    try {
      setIsSaving(true);

      const { data, error } = await supabase
        .from('mediciones')
        .insert([
          { 
            nombre: nombre.trim(),
            origen_tipo: 'libre',
            origen_id: null,
            created_at: new Date().toISOString()
          }
        ])
        .select();

      if (error) throw error;

      toast({
        title: "Medición creada",
        description: `La estancia "${nombre}" ha sido creada correctamente.`,
      });

      setNombre('');
      onSuccess();
      onClose();

    } catch (err) {
      console.error("Error creating medicion:", err);
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: "No se pudo crear la medición. Por favor, inténtelo de nuevo.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nueva Medición</DialogTitle>
          <DialogDescription>
            Crea una nueva estancia para empezar a registrar medidas.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre de la estancia <span className="text-destructive">*</span></Label>
            <Input
              id="nombre"
              placeholder="Ej. Salón Principal, Cocina..."
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={isSaving}
              autoFocus
              className="col-span-3"
            />
          </div>
          
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={!nombre.trim() || isSaving}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}