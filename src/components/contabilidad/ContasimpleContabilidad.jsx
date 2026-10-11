// ContasimpleContabilidad.jsx
//
// Pestaña "Contasimple" dentro del módulo de Contabilidad.
// Lee EXCLUSIVAMENTE vistas de Supabase ya sincronizadas por el backend
// (nada de llamadas directas a la API de Contasimple ni a /functions/v1/swift-function).
// No expone claves ni raw_json en la interfaz.
//
// Subpestañas:
//   General               -> reutiliza DashboardContabilidad.jsx (v_contasimple_dashboard_anual, sin recalcular en React)
//   Facturas emitidas    -> FacturasEmitidasContasimple.jsx (v_contasimple_facturas_emitidas_listado, paginada)
//   Facturas recibidas   -> FacturasRecibidasContasimple.jsx (v_contasimple_facturas_recibidas_listado, paginada)
//   Gastos               -> GastosContasimple.jsx (v_contasimple_gastos_listado, paginada)
//   Clientes              -> ClientesContasimple.jsx (v_contasimple_clientes_resumen, carga completa ~133 filas)
//   Proveedores           -> ProveedoresContasimple.jsx (v_contasimple_proveedores_resumen)
//   Comparador            -> ComparadorContasimple.jsx (comparador ERP vs Contasimple)
//   Bandeja administración -> BandejaAdminContasimple.jsx (RPC flopy_marcar_factura_contasimple_estado)

import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Receipt, Wallet, Users, Building2, GitCompare, Inbox
} from 'lucide-react';
import DashboardContabilidad from '@/components/contabilidad/DashboardContabilidad';
import FacturasEmitidasContasimple from '@/components/contabilidad/FacturasEmitidasContasimple';
import FacturasRecibidasContasimple from '@/components/contabilidad/FacturasRecibidasContasimple';
import GastosContasimple from '@/components/contabilidad/GastosContasimple';
import ClientesContasimple from '@/components/contabilidad/ClientesContasimple';
import ProveedoresContasimple from '@/components/contabilidad/ProveedoresContasimple';
import ComparadorContasimple from '@/components/contabilidad/ComparadorContasimple';
import BandejaAdminContasimple from '@/components/contabilidad/BandejaAdminContasimple';

const SUBTABS = [
  { id: 'general', label: 'General', icon: LayoutDashboard },
  { id: 'facturas-emitidas', label: 'Facturas emitidas', icon: FileText },
  { id: 'facturas-recibidas', label: 'Facturas recibidas', icon: Receipt },
  { id: 'gastos', label: 'Gastos', icon: Wallet },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'proveedores', label: 'Proveedores', icon: Building2 },
  { id: 'comparador', label: 'Comparador', icon: GitCompare },
  { id: 'bandeja', label: 'Bandeja administración', icon: Inbox },
];

export default function ContasimpleContabilidad({ navigate }) {
  const location = useLocation();
  const requestedSubTab = new URLSearchParams(location.search).get('subtab');
  const validRequestedSubTab = SUBTABS.some((tab) => tab.id === requestedSubTab) ? requestedSubTab : null;
  const [activeSubTab, setActiveSubTab] = useState(validRequestedSubTab || 'general');
  // Cuando desde Clientes se pulsa "Ver facturas", guardamos el NIF y saltamos
  // a Facturas emitidas con ese filtro ya aplicado.
  const [facturasEmitidasNif, setFacturasEmitidasNif] = useState('');

  useEffect(() => {
    if (validRequestedSubTab) setActiveSubTab(validRequestedSubTab);
  }, [validRequestedSubTab]);

  const handleVerFacturas = (nif) => {
    setFacturasEmitidasNif(nif || '');
    setActiveSubTab('facturas-emitidas');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {SUBTABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors duration-200
                ${isActive
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeSubTab === 'general' && <DashboardContabilidad navigate={navigate} />}
      {activeSubTab === 'facturas-emitidas' && <FacturasEmitidasContasimple initialSearch={facturasEmitidasNif} />}
      {activeSubTab === 'facturas-recibidas' && <FacturasRecibidasContasimple />}
      {activeSubTab === 'gastos' && <GastosContasimple />}
      {activeSubTab === 'clientes' && <ClientesContasimple onVerFacturas={handleVerFacturas} />}
      {activeSubTab === 'proveedores' && <ProveedoresContasimple />}
      {activeSubTab === 'comparador' && <ComparadorContasimple />}
      {activeSubTab === 'bandeja' && <BandejaAdminContasimple />}
    </div>
  );
}
