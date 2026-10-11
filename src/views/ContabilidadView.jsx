// ContabilidadView.jsx
//
// Simplificado: la navegación superior antigua (Dashboard, Facturas Emitidas,
// Facturas Recibidas, Gastos, Presupuestos, Clientes, Proveedores, Informes P&L,
// Contasimple) ya NO se renderiza — esos componentes placeholder se dejan
// importados/intactos por si se reutilizan en otro sitio, simplemente no se pintan
// aquí. La pantalla /contabilidad ahora muestra directamente la navegación interna
// de Contasimple (General, Facturas emitidas, Facturas recibidas, Gastos, Clientes,
// Proveedores, Comparador, Bandeja administración), que es la que lee datos reales.

import React from 'react';
import ContasimpleContabilidad from '@/components/contabilidad/ContasimpleContabilidad';

// NOTA: los componentes de la antigua navegación (DashboardContabilidad vía tab,
// FacturasEmitidas, FacturasRecibidas, GastosContabilidad, PresupuestosContabilidad,
// ClientesContabilidad, ProveedoresContabilidad, InformePL) y el array TABS que los
// listaba se han retirado de este archivo porque ya no se usan aquí. Sus ficheros
// fuente NO se han tocado ni eliminado, por si se reutilizan en otro sitio.

export default function ContabilidadView({ navigate }) {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Contabilidad</h1>
          <p className="text-muted-foreground text-sm">Gestión financiera integrada con Contasimple</p>
        </div>
      </div>

      <div className="min-h-[60vh]">
        <ContasimpleContabilidad navigate={navigate} />
      </div>
    </div>
  );
}
