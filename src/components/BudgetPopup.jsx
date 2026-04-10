import React, { useState } from 'react';
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

const BudgetPopup = ({ isOpen, onClose, onConfirm, isSubmitting }) => {
  const [budget, setBudget] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    const numericValue = parseFloat(budget.replace(',', '.'));
    
    if (isNaN(numericValue) || numericValue < 0) {
      setError('Por favor, introduce un importe válido (ej. 1500.50)');
      return;
    }

    setError('');
    onConfirm(numericValue);
  };

  // Reset state when opened
  React.useEffect(() => {
    if (isOpen) {
      setBudget('');
      setError('');
    }
  }, [isOpen]);


  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (!isSubmitting) onClose();
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Importe del Presupuesto</DialogTitle>
          <DialogDescription>
            El estado se cambiará a "PRESUPUESTADO". Por favor, indica la Base Imponible del presupuesto enviado.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="budget" className="text-right">
              Importe (€)
            </Label>
            <Input
              id="budget"
              type="number"
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className={`col-span-3 ${error ? 'border-red-500' : ''}`}
              placeholder="0.00"
              autoFocus
              onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirm();
              }}
            />
          </div>
          {error && (
             <div className="text-red-500 text-sm text-right pr-4">{error}</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting || !budget}>
            {isSubmitting ? 'Guardando...' : 'Confirmar Cambio'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BudgetPopup;
