// ContabilidadView.jsx
import React, { useState } from 'react';
import { 
  LayoutDashboard, FileText, Receipt, Wallet,
  FileSpreadsheet, Users, Building2, PieChart
} from 'lucide-react';

import DashboardContabilidad from '@/components/contabilidad/DashboardContabilidad';
import FacturasEmitidas from '@/components/contabilidad/FacturasEmitidas';
import FacturasRecibidas from '@/components/contabilidad/FacturasRecibidas';
import GastosContabilidad from '@/components/contabilidad/GastosContabilidad';
import PresupuestosContabilidad from '@/components/contabilidad/PresupuestosContabilidad';
import ClientesContabilidad from '@/components/contabilidad/ClientesContabilidad';
import ProveedoresContabilidad from '@/components/contabilidad/ProveedoresContabilidad';
import InformePL from '@/components/contabilidad/InformePL';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'facturas-emitidas', label: 'Facturas Emitidas', icon: FileText },
  { id: 'facturas-recibidas', label: 'Facturas Recibidas', icon: Receipt },
  { id: 'gastos', label: 'Gastos', icon: Wallet },
  { id: 'presupuestos', label: 'Presupuestos', icon: FileSpreadsheet },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'proveedores', label: 'Proveedores', icon: Building2 },
  { id: 'informes', label: 'Informes P&L', icon: PieChart },
];

export default function ContabilidadView({ navigate }) {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardContabilidad navigate={navigate} />;
      case 'facturas-emitidas': return <FacturasEmitidas navigate={navigate} />;
      case 'facturas-recibidas': return <FacturasRecibidas navigate={navigate} />;
      case 'gastos': return <GastosContabilidad navigate={navigate} />;
      case 'presupuestos': return <PresupuestosContabilidad navigate={navigate} />;
      case 'clientes': return <ClientesContabilidad navigate={navigate} />;
      case 'proveedores': return <ProveedoresContabilidad navigate={navigate} />;
      case 'informes': return <InformePL navigate={navigate} />;
      default: return <DashboardContabilidad navigate={navigate} />;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Contabilidad</h1>
          <p className="text-muted-foreground text-sm">Gestión financiera integrada con Contasimple</p>
        </div>
      </div>

      <div className="border-b border-border">
        <nav className="flex gap-1 overflow-x-auto pb-px scrollbar-hide">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors duration-200
                  ${isActive 
                    ? 'border-primary text-primary bg-primary/5' 
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="min-h-[60vh]">
        {renderContent()}
      </div>
    </div>
  );
}