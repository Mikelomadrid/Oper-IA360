import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const ScheduleVisitModal = ({ isOpen, onClose, parteId, onSave }) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset fields on open
      setDate('');
      setTime('');
      setError('');
      setIsSaving(false);
    }
  }, [isOpen]);

  const handleSave = async () => {
    setError('');
    
    if (!date) {
      setError('Por favor selecciona una fecha.');
      return;
    }
    if (!time) {
      setError('Por favor selecciona una hora.');
      return;
    }

    try {
      setIsSaving(true);
      
      // Construct ISO timestamp (local time input to ISO)
      const dateTimeString = `${date}T${time}:00`;
      const visitDate = new Date(dateTimeString);
      
      if (isNaN(visitDate.getTime())) {
        throw new Error("Fecha u hora inválida.");
      }

      await onSave(visitDate);
      // Modal closing is handled by parent after successful save or manually if kept open
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al guardar la visita.');
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSaving && onClose(open)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Agendar Visita
          </DialogTitle>
          <DialogDescription>
            Programa la fecha y hora de la visita técnica. 
            El estado del parte pasará a <span className="font-semibold text-indigo-600">VISITA AGENDADA</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive" className="py-2 px-3 text-sm">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="visit-date" className="text-sm font-medium">
              Fecha de la visita
            </Label>
            <div className="relative">
              <Input
                id="visit-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="pl-10 h-12 text-base touch-manipulation" // Larger touch target
                required
              />
              <Calendar className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visit-time" className="text-sm font-medium">
              Hora estimada
            </Label>
            <div className="relative">
              <Input
                id="visit-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="pl-10 h-12 text-base touch-manipulation" // Larger touch target
                required
              />
              <Clock className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground italic text-center mt-2">
            Asegúrate de confirmar la disponibilidad con el cliente antes de guardar.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onClose(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !date || !time}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar y Agendar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleVisitModal;