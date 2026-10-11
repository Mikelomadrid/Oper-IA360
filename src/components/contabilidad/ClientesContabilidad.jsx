// ClientesContabilidad.jsx
import React from 'react';
import { Users, Construction } from 'lucide-react';

export default function ClientesContabilidad({ navigate }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="p-4 bg-green-100 rounded-full">
        <Construction className="w-12 h-12 text-green-600" />
      </div>
      <h3 className="text-lg font-semibold">Clientes - En construcción</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Sincronización de clientes con Contasimple.
      </p>
      <button onClick={() => navigate && navigate('/crm/clientes')} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
        Ir a Clientes del ERP
      </button>
    </div>
  );
}