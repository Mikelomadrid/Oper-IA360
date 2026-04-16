// InformePL.jsx
import React, { useState, useEffect } from 'react';
import { PieChart, RefreshCw, AlertCircle, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { getResumenFinanciero, formatters } from '@/services/contasimpleService';

export default function InformePL({ navigate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [periodo, setPeriodo] = useState('2025');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const fromDate = periodo === '2025' ? '2025-01-01' : '2026-01-01';
      const response = await getResumenFinanciero(fromDate);
      if (response.success) setData(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [periodo]);

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-8 h-8 animate-spin text-primary" /><span className="ml-3">Generando informe...</span></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><AlertCircle className="w-12 h-12 text-red-500" /><p className="text-red-600">{error}</p><button onClick={loadData} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">Reintentar</button></div>;

  const ingresos = data?.invoices?.total || 0;
  const gastos = data?.expenses?.total || 0;
  const resultado = ingresos - gastos;
  const margen = ingresos > 0 ? ((resultado / ingresos) * 100).toFixed(2) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-card border rounded-xl">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><PieChart className="w-5 h-5 text-primary" />Informe de Pérdidas y Ganancias</h2>
          <p className="text-sm text-muted-foreground">Resumen financiero del ejercicio</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="bg-background border rounded-lg px-3 py-1.5 text-sm">
            <option value="2025">Año 2025</option>
            <option value="2026">Año 2026</option>
          </select>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-6 border-b bg-muted/30 text-center">
          <h3 className="text-xl font-bold">ORKALED INSTALACIONES SLU</h3>
          <p className="text-sm text-muted-foreground">NIF: B88219837</p>
          <p className="text-sm font-medium mt-2">Cuenta de Pérdidas y Ganancias - Ejercicio {periodo}</p>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-5 h-5 text-green-600" /><h4 className="font-semibold text-green-700">INGRESOS</h4></div>
            <div className="ml-7 py-2 border-b border-dashed flex justify-between">
              <span>Ventas ({data?.invoices?.count || 0} facturas)</span>
              <span className="font-medium">{formatters.currency(ingresos)}</span>
            </div>
            <div className="flex justify-between py-3 mt-2 bg-green-50 dark:bg-green-950/20 px-4 rounded-lg font-semibold">
              <span>TOTAL INGRESOS</span>
              <span className="text-green-700">{formatters.currency(ingresos)}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3"><TrendingDown className="w-5 h-5 text-red-600" /><h4 className="font-semibold text-red-700">GASTOS</h4></div>
            <div className="ml-7 py-2 border-b border-dashed flex justify-between">
              <span>Compras y servicios ({data?.expenses?.count || 0} facturas)</span>
              <span className="font-medium">{formatters.currency(gastos)}</span>
            </div>
            <div className="flex justify-between py-3 mt-2 bg-red-50 dark:bg-red-950/20 px-4 rounded-lg font-semibold">
              <span>TOTAL GASTOS</span>
              <span className="text-red-700">({formatters.currency(gastos)})</span>
            </div>
          </div>

          <div className="pt-4 border-t-2 border-dashed">
            <div className={`flex justify-between py-4 px-4 rounded-xl ${resultado >= 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              <div>
                <span className="font-bold text-lg">RESULTADO DEL EJERCICIO</span>
                <p className="text-sm text-muted-foreground">Margen: {margen}%</p>
              </div>
              <span className={`font-bold text-2xl ${resultado >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatters.currency(resultado)}</span>
            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-muted/30 text-center text-xs text-muted-foreground">
          Datos sincronizados con Contasimple · {new Date().toLocaleDateString('es-ES')}
        </div>
      </div>
    </div>
  );
}