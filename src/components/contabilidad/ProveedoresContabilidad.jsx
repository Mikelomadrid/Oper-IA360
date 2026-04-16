// ProveedoresContabilidad.jsx
import React from 'react';
import { Building2, Construction } from 'lucide-react';

export default function ProveedoresContabilidad({ navigate }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="p-4 bg-purple-100 rounded-full">
        <Construction className="w-12 h-12 text-purple-600" />
      </div>
      <h3 className="text-lg font-semibold">Proveedores - En construcción</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Sincronización de proveedores con Contasimple.
      </p>
      <button onClick={() => navigate && navigate('/crm/proveedores')} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
        Ir a Proveedores del ERP
      </button>
    </div>
  );
}