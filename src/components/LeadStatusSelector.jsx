/**
 * LeadStatusSelector.jsx
 * 
 * ROLE BEHAVIOR:
 * - Admin ('admin'): Can interact with the dropdown to change the lead status.
 * - Non-Admin (Encargado, Tecnico, Colaborador): Read-only view. The status is displayed as a colored badge.
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
 */

import React, { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EstadoBadge } from '@/components/LeadStatusBadge';
import { FORM_STATUS_OPTIONS, STATUS_COLORS } from '@/utils/leadStatus';
import BudgetPopup from '@/components/BudgetPopup';

const LeadStatusSelector = ({ currentStatus, leadId, userRole, onStatusChange }) => {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [isBudgetPopupOpen, setIsBudgetPopupOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);

  // Sync internal state if prop changes
  React.useEffect(() => {
    setStatus(currentStatus);
  }, [currentStatus]);

  const isAdmin = userRole === 'admin';

  const executeStatusUpdate = async (newStatus, baseImponible = null) => {
    setIsUpdating(true);
    try {
      const updatePayload = { estado: newStatus };
      if (baseImponible !== null) {
        updatePayload.base_imponible = baseImponible;
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
      setPendingStatus(null);
    }
  };

  const handleUpdateStatus = (newStatus) => {
    console.log("=== handleUpdateStatus TRIGGERED ===", newStatus, "Current Status:", status);
    if (newStatus === status) return;

    if (newStatus === 'presupuestado') {
      console.log("Opening Budget Popup for PRESUPUESTADO");
      setPendingStatus(newStatus);
      setIsBudgetPopupOpen(true);
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


  // Render Logic - Read Only
  if (!isAdmin) {
    return (
      <div title="Solo administradores pueden cambiar el estado">
        <EstadoBadge estado={status} />
      </div>
    );
  }

  // Admin Editable View
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
    </>
  );
};

export default LeadStatusSelector;