import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  Loader2, 
  Calendar as CalendarIcon, 
  Table2, 
  BarChart3, 
  LineChart as LineChartIcon,
  Wallet,
  DollarSign,
  Activity,
  Briefcase,
  Users,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, subMonths, parseISO, startOfYear, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';

const CuentaResultadosChart = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('current_year'); // 'current_year', '3m', '6m', '12m', 'custom_year'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [availableYears, setAvailableYears] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch exclusively from the specified view
      const { data: result, error } = await supabase
        .from('v_cuenta_resultados_real_por_mes_v1')
        .select('mes, anio, ingresos, gastos_proveedores, gastos_mano_obra, resultado_real')
        .order('mes', { ascending: false });

      if (error) throw error;

      setData(result || []);
      
      // Extract unique years dynamically from the view
      const years = [...new Set(result.map(r => r.anio))].sort((a, b) => b - a);
      setAvailableYears(years.map(String));
      
      // Set default year logic
      const currentYearStr = new Date().getFullYear().toString();
      if (years.length > 0 && !years.includes(Number(selectedYear))) {
          if (years.includes(Number(currentYearStr))) {
              setSelectedYear(currentYearStr);
          } else {
              setSelectedYear(years[0].toString());
          }
      }

    } catch (error) {
      console.error('Error fetching cuenta resultados:', error);
      setError("No se pudieron cargar los datos financieros.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    if (!data.length) return [];

    const now = new Date();
    const currentYear = now.getFullYear();

    // Pure UI filtering logic without recalculation
    switch (filterType) {
      case 'current_year':
        return data.filter(d => d.anio === currentYear);
      case '3m': {
        const threeMonthsAgo = subMonths(now, 3);
        // Include strictly last 3 months
        return data.filter(d => parseISO(d.mes) >= threeMonthsAgo);
      }
      case '6m': {
        const sixMonthsAgo = subMonths(now, 6);
        return data.filter(d => parseISO(d.mes) >= sixMonthsAgo);
      }
      case '12m': {
        const twelveMonthsAgo = subMonths(now, 12);
        return data.filter(d => parseISO(d.mes) >= twelveMonthsAgo);
      }
      case 'custom_year':
        return data.filter(d => d.anio === Number(selectedYear));
      default:
        return data;
    }
  }, [data, filterType, selectedYear]);

  // Prepared data for charts (chronological order)
  const chartData = useMemo(() => {
    return [...filteredData]
      .sort((a, b) => new Date(a.mes) - new Date(b.mes))
      .map(item => ({
        ...item,
        mesLabel: format(parseISO(item.mes), 'MMM', { locale: es }).toUpperCase(),
        fullLabel: format(parseISO(item.mes), 'MMMM yyyy', { locale: es }),
        // Calculate total costs for the bar chart comparison (Bar 2)
        total_costes: (item.gastos_proveedores || 0) + (item.gastos_mano_obra || 0)
      }));
  }, [filteredData]);

  // Totals for summary cards
  const totals = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      ingresos: acc.ingresos + (curr.ingresos || 0),
      gastos_proveedores: acc.gastos_proveedores + (curr.gastos_proveedores || 0),
      gastos_mano_obra: acc.gastos_mano_obra + (curr.gastos_mano_obra || 0),
      resultado_real: acc.resultado_real + (curr.resultado_real || 0),
    }), { ingresos: 0, gastos_proveedores: 0, gastos_mano_obra: 0, resultado_real: 0 });
  }, [filteredData]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-ES', { 
      style: 'currency', 
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const handleYearChange = (val) => {
      setSelectedYear(val);
      setFilterType('custom_year');
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3 text-xs">
          <p className="font-bold mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 mb-1" style={{ color: entry.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
              <span className="capitalize">{entry.name}:</span>
              <span className="font-mono font-medium ml-auto">
                {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header & Controls */}
      <Card className="rounded-xl shadow-sm bg-card border-none">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
                      <Activity className="h-6 w-6" />
                  </div>
                  <div>
                      <h2 className="text-xl font-bold tracking-tight">Cuenta de Resultados</h2>
                      <p className="text-sm text-muted-foreground">Análisis de ingresos, costes y beneficio real</p>
                  </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                  {/* Quick Filters */}
                  <div className="flex p-1 bg-muted rounded-lg gap-1 overflow-x-auto no-scrollbar">
                      {[
                          { id: 'current_year', label: 'Año en curso' },
                          { id: '3m', label: 'Últimos 3 meses' },
                          { id: '6m', label: 'Últimos 6 meses' },
                          { id: '12m', label: 'Últimos 12 meses' },
                      ].map((f) => (
                          <Button
                              key={f.id}
                              variant={filterType === f.id ? "secondary" : "ghost"}
                              size="sm"
                              className={cn(
                                  "text-xs h-9 px-3 whitespace-nowrap rounded-md transition-all",
                                  filterType === f.id && "bg-background shadow-sm font-semibold text-foreground"
                              )}
                              onClick={() => setFilterType(f.id)}
                          >
                              {f.label}
                          </Button>
                      ))}
                  </div>

                  {/* Year Selector */}
                  <div className="w-[120px] shrink-0">
                      <Select value={selectedYear} onValueChange={handleYearChange}>
                          <SelectTrigger className="h-11 text-sm bg-background border-input">
                              <SelectValue placeholder="Año" />
                          </SelectTrigger>
                          <SelectContent>
                              {availableYears.map(y => (
                                  <SelectItem key={y} value={y}>{y}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>
              </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-red-500 bg-red-50/50 rounded-xl border border-red-100">
            <AlertTriangle className="h-10 w-10 mb-2" />
            <p className="font-medium">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData} className="mt-4">Reintentar</Button>
        </div>
      ) : filteredData.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/10">
              <CalendarIcon className="mx-auto h-12 w-12 mb-4 opacity-20" />
              <p className="font-medium text-lg">No hay datos disponibles para este periodo</p>
              <p className="text-sm mt-1">Intenta seleccionar otro rango de fechas o año.</p>
          </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Ingresos */}
            <Card className="rounded-xl shadow-sm border-l-4 border-l-emerald-500 overflow-hidden relative">
              <div className="absolute right-0 top-0 p-4 opacity-5">
                <TrendingUp className="w-24 h-24" />
              </div>
              <CardContent className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ingresos Totales</p>
                    <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {formatCurrency(totals.ingresos)}
                    </h3>
                  </div>
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. Gastos Proveedores */}
            <Card className="rounded-xl shadow-sm border-l-4 border-l-orange-500 overflow-hidden relative">
              <div className="absolute right-0 top-0 p-4 opacity-5">
                <Briefcase className="w-24 h-24" />
              </div>
              <CardContent className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Gastos Proveedores</p>
                    <h3 className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                      {formatCurrency(totals.gastos_proveedores)}
                    </h3>
                  </div>
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400">
                    <Briefcase className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. Gastos Mano Obra */}
            <Card className="rounded-xl shadow-sm border-l-4 border-l-red-500 overflow-hidden relative">
              <div className="absolute right-0 top-0 p-4 opacity-5">
                <Users className="w-24 h-24" />
              </div>
              <CardContent className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Mano de Obra</p>
                    <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                      {formatCurrency(totals.gastos_mano_obra)}
                    </h3>
                  </div>
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 4. Resultado Real */}
            <Card className="rounded-xl shadow-sm border-l-4 border-l-blue-500 overflow-hidden relative">
              <div className="absolute right-0 top-0 p-4 opacity-5">
                <Wallet className="w-24 h-24" />
              </div>
              <CardContent className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Resultado Real</p>
                    <h3 className={cn(
                      "text-2xl font-bold mt-1",
                      totals.resultado_real >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600"
                    )}>
                      {formatCurrency(totals.resultado_real)}
                    </h3>
                  </div>
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Line Chart: Evolution (4 Series) */}
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <LineChartIcon className="w-5 h-5 text-muted-foreground" />
                    Evolución Financiera
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Comparativa de las 4 métricas principales</p>
                </div>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="mesLabel" 
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                      axisLine={false} 
                      tickLine={false}
                      dy={10}
                    />
                    <YAxis 
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} 
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    
                    {/* Series: 4 Lines */}
                    <Line 
                      type="monotone" 
                      dataKey="ingresos" 
                      name="Ingresos" 
                      stroke="#10b981" 
                      strokeWidth={3} 
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="gastos_proveedores" 
                      name="Proveedores" 
                      stroke="#f59e0b" 
                      strokeWidth={2} 
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="gastos_mano_obra" 
                      name="Mano de Obra" 
                      stroke="#ef4444" 
                      strokeWidth={2} 
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="resultado_real" 
                      name="Resultado" 
                      stroke="#3b82f6" 
                      strokeWidth={3} 
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }} 
                    />
                    <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Bar Chart: Comparison (Ingresos vs Total Costes) */}
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-muted-foreground" />
                    Ingresos vs Costes Totales
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Costes = Proveedores + Mano de Obra</p>
                </div>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: 0 }} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="mesLabel" 
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                      axisLine={false} 
                      tickLine={false}
                      dy={10}
                    />
                    <YAxis 
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} 
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar 
                      dataKey="ingresos" 
                      name="Ingresos" 
                      fill="#10b981" 
                      radius={[4, 4, 0, 0]}
                      maxBarSize={60}
                    />
                    <Bar 
                      dataKey="total_costes" 
                      name="Costes Totales" 
                      fill="#f97316" 
                      radius={[4, 4, 0, 0]}
                      maxBarSize={60}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Table */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="flex flex-row items-center gap-3 pb-2 border-b">
                <div className="p-2 bg-muted/50 rounded-lg">
                    <Table2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                    <CardTitle className="text-lg">Detalle de Operaciones</CardTitle>
                    <p className="text-xs text-muted-foreground">Desglose de cuenta de resultados por mes</p>
                </div>
            </CardHeader>
            <div className="overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[180px]">Mes</TableHead>
                    <TableHead className="text-right">Ingresos</TableHead>
                    <TableHead className="text-right">Gastos Prov.</TableHead>
                    <TableHead className="text-right">Gastos M.O.</TableHead>
                    <TableHead className="text-right">Resultado Real</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((row, idx) => {
                      const isProfit = row.resultado_real >= 0;
                      return (
                          <TableRow key={`${row.anio}-${row.mes}-${idx}`} className="group hover:bg-muted/50 transition-colors">
                              <TableCell className="font-medium capitalize text-foreground/80">
                                  {format(parseISO(row.mes), 'MMMM yyyy', { locale: es })}
                              </TableCell>
                              <TableCell className="text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(row.ingresos)}
                              </TableCell>
                              <TableCell className="text-right font-mono font-medium text-orange-600 dark:text-orange-400">
                                  {formatCurrency(row.gastos_proveedores)}
                              </TableCell>
                              <TableCell className="text-right font-mono font-medium text-red-600 dark:text-red-400">
                                  {formatCurrency(row.gastos_mano_obra)}
                              </TableCell>
                              <TableCell className="text-right">
                                  <div className={cn(
                                      "inline-flex items-center justify-end gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold font-mono min-w-[120px] transition-colors",
                                      isProfit 
                                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" 
                                          : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                                  )}>
                                      {isProfit ? (
                                          <TrendingUp className="h-3.5 w-3.5" />
                                      ) : (
                                          <TrendingDown className="h-3.5 w-3.5" />
                                      )}
                                      <span>
                                          {isProfit ? '+' : ''}{formatCurrency(row.resultado_real)}
                                      </span>
                                  </div>
                              </TableCell>
                          </TableRow>
                      );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </motion.div>
  );
};

export default CuentaResultadosChart;