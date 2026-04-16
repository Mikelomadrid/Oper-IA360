// GastosContabilidad.jsx
import React from 'react';
import { Wallet, Construction } from 'lucide-react';

export default function GastosContabilidad({ navigate }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="p-4 bg-yellow-100 rounded-full">
        <Construction className="w-12 h-12 text-yellow-600" />
      </div>
      <h3 className="text-lg font-semibold">Gastos - En construcción</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Este módulo unificará los gastos del ERP con Contasimple.<br />
        Los gastos asignados a obra se crearán aquí y se sincronizarán automáticamente.
      </p>
      <button onClick={() => navigate && navigate('/administracion/gastos')} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
        Ir a Gastos actuales
      </button>
    </div>
  );
}