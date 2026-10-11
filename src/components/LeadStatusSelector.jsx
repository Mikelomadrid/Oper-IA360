/**
 * LeadStatusSelector.jsx
 * 
 * ROLE BEHAVIOR:
 * - El padre (LeadDetail) decide quién puede editar mediante el prop `canEdit`.
 *   Actualmente: admin, encargado, y técnico asignado al lead (por empleado_asignado_id
 *   o por leads_asignaciones) pueden interactuar con el desplegable.
 * - Cualquier otro caso: vista de solo lectura. El estado se muestra como badge de color.
 * 
 * Implementation Details:
 * - Fetches status options from @/utils/leadStatus.js
 * - Updates 'leads' table 'estado' field via Supabase directly.
 * - Uses STATUS_COLORS for synchronization with charts.
 * 
 * CONFIRMATION: 
 * (a) Status selector is visible in detail view.
 * (b) Status colors are synchronized with donut chart (STATUS_COLORS).
 * (c) Color consistency maintained across views.
 *
 * NUEVO (visita agendada):
 * - Al pasar el estado a 'visita_agendada' desde este selector, se abre un popup que
 *   pide la fecha y hora de la visita y guarda `estado` + `fecha_visita` a la vez.
 * - Si el lead ya tenía `fecha_visita`, se precarga en el popup.
 * - Esto evita que un lead quede en 'visita_agendada' sin fecha (caso que dejaba la
 *   ficha en "N/A" y la visita fuera del calendario).
 */

import React, { useState } from 'react';
import { Loader2, Check, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { EstadoBadge } from '@/components/LeadStatusBadge';
import { FORM_STATUS_OPTIONS, STATUS_COLORS } from '@/utils/leadStatus';
import BudgetPopup from '@/components/BudgetPopup';

// Convierte un ISO/timestamptz a string compatible con <input type="datetime-local">
const toDatetimeLocal = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
};

const LeadStatusSelector = ({ currentStatus, leadId, userRole, canEdit = false, onStatusChange }) => {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [isBudgetPopupOpen, setIsBudgetPopupOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);

  // Popup de fecha de visita
  const [isVisitPopupOpen, setIsVisitPopupOpen] = useState(false);
  const [visitDate, setVisitDate] = useState('');
  const [loadingVisitPrefill, setLoadingVisitPrefill] = useState(false);

  // Sync internal state if prop changes
  React.useEffect(() => {
    setStatus(currentStatus);
  }, [currentStatus]);

  const executeStatusUpdate = async (newStatus, baseImponible = null, fechaVisita = undefined) => {
    setIsUpdating(true);
    try {
      const updatePayload = { estado: newStatus };
      if (baseImponible !== null) {
        updatePayload.base_imponible = baseImponible;
      }
      // Si se pasa fechaVisita (incluido null explícito), se actualiza la fecha.
      // Al agendar visita guardamos también el estado previo para poder restaurarlo
      // si más adelante se elimina la fecha desde el modal de edición.
      if (fechaVisita !== undefined) {
        updatePayload.fecha_visita = fechaVisita;
        updatePayload.previous_status = status;
      }

      const { error } = await supabase
        .from('leads')
        .update(updatePayload)
        .eq('id', leadId);

      if (error) throw error;

      setStatus(newStatus);
      toast({
        title: 'Estado actualizado',
        description: `El estado ha cambiado a ${newStatus.toUpperCase()}`,
        className: 'bg-green-600 text-white'
      });

      if (onStatusChange) {
        onStatusChange(newStatus, baseImponible);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar el estado centralizado.'
      });
      // Revert select visual
      setStatus(currentStatus);
    } finally {
      setIsUpdating(false);
      setIsBudgetPopupOpen(false);
      setIsVisitPopupOpen(false);
      setPendingStatus(null);
    }
  };

  // Abre el popup de visita y precarga la fecha existente (si la hubiera)
  const openVisitPopup = async () => {
    setPendingStatus('visita_agendada');
    setVisitDate('');
    setIsVisitPopupOpen(true);
    setLoadingVisitPrefill(true);
    try {
      const { data } = await supabase
        .from('leads')
        .select('fecha_visita')
        .eq('id', leadId)
        .single();
      if (data?.fecha_visita) {
        setVisitDate(toDatetimeLocal(data.fecha_visita));
      }
    } catch (e) {
      // Si falla la precarga, simplemente se deja vacío.
    } finally {
      setLoadingVisitPrefill(false);
    }
  };

  const handleUpdateStatus = (newStatus) => {
    if (newStatus === status) return;

    if (newStatus === 'presupuestado') {
      setPendingStatus(newStatus);
      setIsBudgetPopupOpen(true);
    } else if (newStatus === 'visita_agendada') {
      openVisitPopup();
    } else {
      executeStatusUpdate(newStatus);
    }
  };

  const handleBudgetConfirm = (amount) => {
    executeStatusUpdate(pendingStatus || 'presupuestado', amount);
  };

  const handleBudgetClose = () => {
    setIsBudgetPopupOpen(false);
    setPendingStatus(null);
    // Reset select visual to current state since operation was cancelled
    setStatus(currentStatus);
  };

  const handleVisitConfirm = () => {
    if (!visitDate) return;
    const iso = new Date(visitDate).toISOString();
    executeStatusUpdate('visita_agendada', null, iso);
  };

  const handleVisitClose = () => {
    setIsVisitPopupOpen(false);
    setPendingStatus(null);
    setVisitDate('');
    // El cambio se cancela: restauramos el select al estado actual
    setStatus(currentStatus);
  };

  // Render Logic - Read Only
  if (!canEdit) {
    return (
      <div title="No tienes permiso para cambiar el estado de este lead">
        <EstadoBadge estado={status} />
      </div>
    );
  }

  // Editable View (admin, encargado, o técnico asignado a este lead)
  return (
    <>
      <div className="flex items-center">
        <Select
          value={status}
          onValueChange={handleUpdateStatus}
          disabled={isUpdating}
        >
          <SelectTrigger
            className="h-8 w-auto min-w-[140px] px-2 text-xs border-transparent bg-transparent hover:bg-muted/50 focus:ring-0 shadow-none data-[placeholder]:text-muted-foreground"
          >
            {isUpdating ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Actualizando...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {/* Display as Badge when closed for consistent look */}
                <SelectValue>
                  <EstadoBadge estado={status} />
                </SelectValue>
              </div>
            )}
          </SelectTrigger>
          <SelectContent>
            {FORM_STATUS_OPTIONS.map((opt) => {
              const color = STATUS_COLORS[opt.value] || STATUS_COLORS.default;
              return (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center justify-between w-full gap-3">
                    <div className="flex items-center gap-2">
                      {/* Colored Dot Indicator matching chart */}
                      <div
                        className="w-2.5 h-2.5 rounded-full shadow-sm"
                        style={{ backgroundColor: color }}
                      />
                      <span className="capitalize">{opt.label}</span>
                    </div>
                    {status === opt.value && <Check className="h-3 w-3 opacity-50" />}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <BudgetPopup
        isOpen={isBudgetPopupOpen}
        onClose={handleBudgetClose}
        onConfirm={handleBudgetConfirm}
        isSubmitting={isUpdating}
      />

      {/* Popup de fecha y hora de la visita */}
      <Dialog open={isVisitPopupOpen} onOpenChange={(open) => { if (!open) handleVisitClose(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Agendar visita
            </DialogTitle>
            <DialogDescription>
              Indica la fecha y la hora de la visita. Se guardará junto con el estado
              "Visita Agendada" y aparecerá en el calendario del técnico asignado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="visit-date">Fecha y hora de la visita</Label>
            <Input
              id="visit-date"
              type="datetime-local"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              disabled={loadingVisitPrefill || isUpdating}
            />
            {loadingVisitPrefill && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Cargando fecha previa...
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleVisitClose} disabled={isUpdating}>
              Cancelar
            </Button>
            <Button onClick={handleVisitConfirm} disabled={!visitDate || isUpdating}>
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarDays className="h-4 w-4 mr-2" />}
              Agendar visita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LeadStatusSelector;
