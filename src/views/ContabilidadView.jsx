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
import ContabilidadNativa from '@/components/contabilidad/ContabilidadNativa';

export default function ContabilidadView({ navigate }) {
  return <div className="p-4 md:p-6"><ContabilidadNativa navigate={navigate} /></div>;
}
