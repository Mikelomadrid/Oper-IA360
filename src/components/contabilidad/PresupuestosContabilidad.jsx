// PresupuestosContabilidad.jsx
import React from 'react';
import { FileSpreadsheet, Construction } from 'lucide-react';

export default function PresupuestosContabilidad({ navigate }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="p-4 bg-blue-100 rounded-full">
        <Construction className="w-12 h-12 text-blue-600" />
      </div>
      <h3 className="text-lg font-semibold">Presupuestos - En construcción</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Aquí se mostrarán los presupuestos sincronizados con Contasimple.
      </p>
    </div>
  );
}