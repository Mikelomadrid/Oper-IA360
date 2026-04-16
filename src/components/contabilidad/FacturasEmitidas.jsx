// FacturasEmitidas.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { FileText, RefreshCw, Search, Calendar, Building2, AlertCircle, ChevronDown, ChevronUp, Download, Eye } from 'lucide-react';
import { getFacturasEmitidas, formatters } from '@/services/contasimpleService';

const StatusBadge = ({ status }) => {
  const info = formatters.status(status);
  const colors = {
    green: 'bg-green-100 text-green-700 border-green-200',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    gray: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${colors[info.color] || colors.gray}`}>{info.label}</span>;
};

export default function FacturasEmitidas({ navigate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [facturas, setFacturas] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: 'all', fromDate: '2025-01-01' });

  const loadFacturas = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getFacturasEmitidas(filters.fromDate);
      if (response.success && response.data) {
        const data = response.data.invoices?.data || response.data.data || response.data || [];
        setFacturas(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFacturas(); }, [filters.fromDate]);

  const filteredFacturas = useMemo(() => {
    return facturas.filter((f) => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!f.number?.toLowerCase().includes(s) && !f.target?.organization?.toLowerCase().includes(s) && !f.target?.nif?.toLowerCase().includes(s)) return false;
      }
      if (filters.status !== 'all' && f.status !== filters.status) return false;
      return true;
    });
  }, [facturas, filters]);

  const totals = useMemo(() => filteredFacturas.reduce((acc, f) => ({
    count: acc.count + 1, total: acc.total + (f.totalAmount || 0), base: acc.base + (f.totalTaxableAmount || 0), iva: acc.iva + (f.totalVatAmount || 0),
  }), { count: 0, total: 0, base: 0, iva: 0 }), [filteredFacturas]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="w-8 h-8 animate-spin text-primary" /><span className="ml-3 text-muted-foreground">Cargando facturas...</span></div>;
  }

  if (error) {
    return <div className="flex flex-col items-center justify-center h-64 gap-4"><AlertCircle className="w-12 h-12 text-red-500" /><p className="text-red-600">{error}</p><button onClick={loadFacturas} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">Reintentar</button></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 bg-card border rounded-xl">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><FileText className="w-5 h-5 text-primary" />Facturas Emitidas</h2>
          <p className="text-sm text-muted-foreground">Sincronizado con Contasimple</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Filtrado</p>
            <p className="text-xl font-bold text-primary">{formatters.currency(totals.total)}</p>
          </div>
          <button onClick={loadFacturas} className="p-2 border rounded-lg hover:bg-muted"><RefreshCw className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 p-4 bg-muted/30 rounded-xl">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Buscar por nº, cliente o NIF..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="w-full pl-10 pr-4 py-2 bg-background border rounded-lg text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <input type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} className="px-3 py-2 bg-background border rounded-lg text-sm" />
        </div>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="px-3 py-2 bg-background border rounded-lg text-sm">
          <option value="all">Todos los estados</option>
          <option value="Pending">Pendientes</option>
          <option value="Paid">Pagadas</option>
        </select>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-4 p-4 bg-muted/50 text-sm font-medium text-muted-foreground border-b">
          <div className="col-span-2">Nº Factura</div>
          <div className="col-span-1">Fecha</div>
          <div className="col-span-4">Cliente</div>
          <div className="col-span-2 text-right">Importe</div>
          <div className="col-span-2 text-center">Estado</div>
          <div className="col-span-1"></div>
        </div>

        {filteredFacturas.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No se encontraron facturas</div>
        ) : (
          <div className="divide-y">
            {filteredFacturas.map((f) => (
              <div key={f.id}>
                <div className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/30 cursor-pointer" onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}>
                  <div className="col-span-6 md:col-span-2">
                    <span className="font-medium text-primary">{f.number}</span>
                    <p className="text-xs text-muted-foreground md:hidden">{formatters.date(f.invoiceDate)}</p>
                  </div>
                  <div className="hidden md:block col-span-1 text-sm">{formatters.date(f.invoiceDate)}</div>
                  <div className="hidden md:block col-span-4">
                    <p className="font-medium truncate">{f.target?.organization || '-'}</p>
                    <p className="text-xs text-muted-foreground">{f.target?.nif}</p>
                  </div>
                  <div className="col-span-3 md:col-span-2 text-right">
                    <p className="font-bold">{formatters.currency(f.totalAmount)}</p>
                    <p className="text-xs text-muted-foreground">Base: {formatters.currency(f.totalTaxableAmount)}</p>
                  </div>
                  <div className="col-span-2 text-center"><StatusBadge status={f.status} /></div>
                  <div className="col-span-1 flex justify-end">{expandedId === f.id ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}</div>
                </div>

                {expandedId === f.id && (
                  <div className="px-4 pb-4 bg-muted/20">
                    <div className="p-4 border rounded-lg bg-background space-y-4">
                      <div className="flex items-start gap-3">
                        <Building2 className="w-5 h-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium">{f.target?.organization}</p>
                          <p className="text-sm text-muted-foreground">{f.target?.nif} · {f.target?.address}, {f.target?.city}</p>
                        </div>
                      </div>
                      {f.lines?.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Líneas:</p>
                          <div className="space-y-2">
                            {f.lines.map((l, i) => (
                              <div key={l.id || i} className="flex justify-between text-sm p-2 bg-muted/30 rounded">
                                <div className="flex-1">
                                  <p className="line-clamp-2">{l.concept}</p>
                                  <p className="text-xs text-muted-foreground">{l.quantity} x {formatters.currency(l.unitTaxableAmount)} · IVA {l.vatPercentage}%</p>
                                </div>
                                <p className="font-medium ml-4">{formatters.currency(l.totalTaxableAmount + l.vatAmount)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex justify-end">
                        <div className="text-right space-y-1 text-sm">
                          <div className="flex justify-between gap-8"><span className="text-muted-foreground">Base:</span><span>{formatters.currency(f.totalTaxableAmount)}</span></div>
                          <div className="flex justify-between gap-8"><span className="text-muted-foreground">IVA:</span><span>{formatters.currency(f.totalVatAmount)}</span></div>
                          <div className="flex justify-between gap-8 font-bold border-t pt-1"><span>Total:</span><span>{formatters.currency(f.totalAmount)}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <div className="bg-card border rounded-xl p-4 text-sm">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            <span className="text-muted-foreground">Facturas:</span><span className="text-right font-medium">{totals.count}</span>
            <span className="text-muted-foreground">Base:</span><span className="text-right">{formatters.currency(totals.base)}</span>
            <span className="text-muted-foreground">IVA:</span><span className="text-right">{formatters.currency(totals.iva)}</span>
            <span className="font-medium pt-1 border-t">Total:</span><span className="text-right font-bold pt-1 border-t">{formatters.currency(totals.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}