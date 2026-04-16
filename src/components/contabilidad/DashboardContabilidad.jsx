// DashboardContabilidad.jsx
import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Wallet, Receipt, FileText,
  RefreshCw, Calendar, AlertCircle, Clock
} from 'lucide-react';
import { getResumenFinanciero, formatters } from '@/services/contasimpleService';

const KPICard = ({ title, value, subtitle, icon: Icon, color = 'primary' }) => {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    green: 'bg-green-500/10 text-green-600',
    red: 'bg-red-500/10 text-red-600',
    yellow: 'bg-yellow-500/10 text-yellow-600',
  };
  return (
    <div className="bg-card border rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

export default function DashboardContabilidad({ navigate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    ingresos: { total: 0, count: 0, pending: 0, pendingAmount: 0 },
    gastos: { total: 0, count: 0 },
    balance: 0,
    facturas: [],
  });
  const [periodo, setPeriodo] = useState('2025');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const fromDate = periodo === '2025' ? '2025-01-01' : '2026-01-01';
      const resumen = await getResumenFinanciero(fromDate);
      
      if (resumen.success && resumen.data) {
        const { invoices, expenses } = resumen.data;
        const facturasPendientes = invoices?.data?.filter(f => f.status === 'Pending') || [];
        const montoPendiente = facturasPendientes.reduce((sum, f) => sum + (f.totalAmount || 0), 0);

        setData({
          ingresos: {
            total: invoices?.total || 0,
            count: invoices?.count || 0,
            pending: facturasPendientes.length,
            pendingAmount: montoPendiente,
          },
          gastos: { total: expenses?.total || 0, count: expenses?.count || 0 },
          balance: (invoices?.total || 0) - (expenses?.total || 0),
          facturas: invoices?.data?.slice(0, 5) || [],
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [periodo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Cargando datos de Contasimple...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-red-600 font-medium">Error al cargar datos</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <button onClick={loadData} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="bg-background border rounded-lg px-3 py-1.5 text-sm">
            <option value="2025">Año 2025</option>
            <option value="2026">Año 2026</option>
          </select>
        </div>
        <button onClick={loadData} disabled={loading} className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-muted">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Ingresos Totales" value={formatters.currency(data.ingresos.total)} subtitle={`${data.ingresos.count} facturas emitidas`} icon={TrendingUp} color="green" />
        <KPICard title="Gastos Totales" value={formatters.currency(data.gastos.total)} subtitle={`${data.gastos.count} facturas recibidas`} icon={TrendingDown} color="red" />
        <KPICard title="Balance" value={formatters.currency(data.balance)} subtitle={data.balance >= 0 ? 'Beneficio' : 'Pérdida'} icon={Wallet} color={data.balance >= 0 ? 'green' : 'red'} />
        <KPICard title="Pendiente de Cobro" value={formatters.currency(data.ingresos.pendingAmount)} subtitle={`${data.ingresos.pending} facturas pendientes`} icon={Clock} color="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border rounded-xl p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4" /> Últimas Facturas
          </h3>
          <div className="space-y-3">
            {data.facturas.map((f) => (
              <div key={f.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <span className="font-medium text-sm">{f.number}</span>
                  <p className="text-sm text-muted-foreground truncate">{f.target?.organization || '-'}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatters.currency(f.totalAmount)}</p>
                  <p className="text-xs text-muted-foreground">{formatters.date(f.invoiceDate)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border rounded-xl p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <Receipt className="w-4 h-4" /> Resumen
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <span>Ingresos</span>
              <span className="font-bold text-green-600">{formatters.currency(data.ingresos.total)}</span>
            </div>
            <div className="flex justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
              <span>Gastos</span>
              <span className="font-bold text-red-600">{formatters.currency(data.gastos.total)}</span>
            </div>
            <div className={`flex justify-between p-3 rounded-lg ${data.balance >= 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              <span className="font-semibold">Resultado</span>
              <span className={`font-bold text-lg ${data.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatters.currency(data.balance)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}