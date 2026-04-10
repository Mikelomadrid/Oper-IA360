import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Building2, Activity, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval, isSameMonth, startOfYear, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ResumenFinancieroMeses from '@/components/ResumenFinancieroMeses';

const Dashboard = () => {
  const {
    sessionRole
  } = useAuth();
  const [loading, setLoading] = useState(true);

  const [kpiData, setKpiData] = useState({
    presupuestosPendientes: 0,
    gastosObraEnCurso: 0,
    gastosGeneralesMes: 0,
    margen: 0
  });
  const [chartData, setChartData] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Determine target year (2026 based on user request)
      // Note: We are explicitly setting 2026 to ensure the dashboard reflects the new fiscal year
      // regardless of the exact system time if it were slightly off, but system is 2026.
      const currentYear = 2026; 
      const now = new Date(); // Current date for month calculation (Jan 2026)
      
      // Define exact range for 2026 (Jan 1 to Dec 31)
      const startYearDate = startOfYear(new Date(currentYear, 0, 1));
      const endYearDate = endOfYear(new Date(currentYear, 11, 31));
      
      const startYearISO = startYearDate.toISOString();
      const endYearISO = endYearDate.toISOString();

      // ==========================================
      // 1. CARGAR DATOS HISTÓRICOS (CONTASIMPLE)
      // ==========================================
      // Filter strictly within the target year
      const {
        data: historicalData
      } = await supabase.from('datos_historicos').select('*')
        .gte('fecha', startYearISO)
        .lte('fecha', endYearISO)
        .order('fecha', { ascending: true });

      // ==========================================
      // 2. CARGAR DATOS REALES (LIVE - AÑO ACTUAL)
      // ==========================================

      const {
        data: allProjects,
        error: errProj
      } = await supabase.from('v_dashboard_proyectos').select('*');
      if (errProj) throw errProj;
      
      const {
        data: allGeneralExpenses
      } = await supabase.from('gastos_generales').select('importe, fecha')
        .gte('fecha', startYearISO)
        .lte('fecha', endYearISO);
        
      const {
        data: unassignedExpenses
      } = await supabase.from('gastos').select('total_con_iva, fecha_emision, concepto')
        .is('proyecto_id', null)
        .gte('fecha_emision', startYearISO)
        .lte('fecha_emision', endYearISO);
        
      const {
        data: allIndirectLabor
      } = await supabase.from('control_horario').select(`
          hora_entrada,
          hora_salida,
          empleado:empleados ( costo_por_hora )
        `)
        .is('proyecto_id', null)
        .gte('hora_entrada', startYearISO)
        .lte('hora_entrada', endYearISO)
        .not('hora_salida', 'is', null);

      // --- CÁLCULO DE KPIS (MES ACTUAL - SIEMPRE REAL) ---
      // We use 'now' which is correctly Jan 2026 based on system time provided in context
      const startCurrentMonth = startOfMonth(now);
      const endCurrentMonth = endOfMonth(now);

      const activeProjects = allProjects?.filter(p => {
        const estado = (p.estado || '').toLowerCase();
        return estado !== 'facturado' && estado !== 'rechazado';
      }) || [];
      
      const sumPresupuestosActivos = activeProjects.reduce((sum, p) => sum + Number(p.presupuesto_aceptado || 0), 0);
      const sumGastosObraActivos = activeProjects.reduce((sum, p) => sum + Number(p.coste_mano_obra || 0) + Number(p.coste_materiales || 0), 0);
      
      const generalExpensesMes = allGeneralExpenses?.filter(g => isWithinInterval(parseISO(g.fecha), {
        start: startCurrentMonth,
        end: endCurrentMonth
      })).reduce((sum, g) => sum + Number(g.importe || 0), 0) || 0;
      
      const unassignedExpensesMes = unassignedExpenses?.filter(g => isWithinInterval(parseISO(g.fecha_emision), {
        start: startCurrentMonth,
        end: endCurrentMonth
      }) && g.concepto && g.concepto.trim() !== '').reduce((sum, g) => sum + Number(g.total_con_iva || 0), 0) || 0;
      
      const indirectLaborMes = allIndirectLabor?.filter(f => isWithinInterval(parseISO(f.hora_entrada), {
        start: startCurrentMonth,
        end: endCurrentMonth
      })).reduce((sum, f) => {
        const entrada = new Date(f.hora_entrada);
        const salida = new Date(f.hora_salida);
        const horas = (salida - entrada) / (1000 * 60 * 60);
        const costo = Number(f.empleado?.costo_por_hora || 0);
        return sum + horas * costo;
      }, 0) || 0;
      
      const totalGastosGeneralesMes = generalExpensesMes + unassignedExpensesMes + indirectLaborMes;
      
      setKpiData({
        presupuestosPendientes: sumPresupuestosActivos,
        gastosObraEnCurso: sumGastosObraActivos,
        gastosGeneralesMes: totalGastosGeneralesMes,
        margen: sumPresupuestosActivos - sumGastosObraActivos - totalGastosGeneralesMes
      });

      // --- CÁLCULO DE GRÁFICA HÍBRIDA (ENERO - DICIEMBRE DEL AÑO ACTUAL) ---

      const chartHistory = [];
      let cumulativeProfit = 0; // Acumulador para la línea de beneficio

      // Iterate specifically from Month 0 (Jan) to 11 (Dec) of the current year (2026)
      for (let i = 0; i < 12; i++) {
        const d = new Date(currentYear, i, 1);
        const monthStart = startOfMonth(d);
        const monthEnd = endOfMonth(d);
        const monthLabel = format(d, 'MMM', {
          locale: es
        });
        let ingresos = 0;
        let gastosObra = 0;
        let gastosGenerales = 0;

        // A. BUSCAR SI HAY DATO HISTÓRICO MANUAL
        const manualData = historicalData?.find(h => isSameMonth(parseISO(h.fecha), d));
        if (manualData) {
          // -> USAR DATO DE CONTASIMPLE
          ingresos = Number(manualData.ingresos || 0);
          gastosObra = Number(manualData.gastos_obra || 0);
          gastosGenerales = Number(manualData.gastos_generales || 0);
        } else {
          // -> USAR CÁLCULO REAL (ERP)

          // 1. Proyectos Facturados
          const projectsInMonth = allProjects?.filter(p => {
            const esFacturado = (p.estado || '').toLowerCase() === 'facturado';
            const fechaFin = p.fecha_fin ? parseISO(p.fecha_fin) : null;
            return esFacturado && fechaFin && isWithinInterval(fechaFin, {
              start: monthStart,
              end: monthEnd
            });
          }) || [];
          ingresos = projectsInMonth.reduce((sum, p) => sum + Number(p.presupuesto_aceptado || 0), 0);
          gastosObra = projectsInMonth.reduce((sum, p) => sum + Number(p.coste_mano_obra || 0) + Number(p.coste_materiales || 0), 0);

          // 2. Gastos Generales
          const genExpMonth = allGeneralExpenses?.filter(g => isWithinInterval(parseISO(g.fecha), {
            start: monthStart,
            end: monthEnd
          })).reduce((sum, g) => sum + Number(g.importe || 0), 0) || 0;
          
          const unassignedExpMonth = unassignedExpenses?.filter(g => isWithinInterval(parseISO(g.fecha_emision), {
            start: monthStart,
            end: monthEnd
          }) && g.concepto && g.concepto.trim() !== '').reduce((sum, g) => sum + Number(g.total_con_iva || 0), 0) || 0;
          
          const indLabMonth = allIndirectLabor?.filter(f => isWithinInterval(parseISO(f.hora_entrada), {
            start: monthStart,
            end: monthEnd
          })).reduce((sum, f) => {
            const entrada = new Date(f.hora_entrada);
            const salida = new Date(f.hora_salida);
            const horas = (salida - entrada) / (1000 * 60 * 60);
            const costo = Number(f.empleado?.costo_por_hora || 0);
            return sum + horas * costo;
          }, 0) || 0;
          gastosGenerales = genExpMonth + unassignedExpMonth + indLabMonth;
        }

        // 3. Resetear acumulador en Enero (Inicio de ejercicio fiscal)
        if (i === 0) {
          // Enero (0-based) - Base profit starts at 0 for new year unless carrying over
          cumulativeProfit = 0; 
        }

        // Calcular resultado mensual y actualizar acumulado
        const resultadoMensual = ingresos - (gastosObra + gastosGenerales);
        cumulativeProfit += resultadoMensual;
        chartHistory.push({
          name: monthLabel,
          Ingresos: ingresos,
          GastosObra: gastosObra,
          GastosGenerales: gastosGenerales,
          Resultado: cumulativeProfit // Ahora muestra el acumulado
        });
      }
      setChartData(chartHistory);
    } catch (error) {
      console.error("Error Dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = val => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(val);
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return <div className="p-3 md:p-6 space-y-4 md:space-y-6 bg-background min-h-screen">

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Dashboard 2026</h1>
          <p className="text-sm md:text-base text-muted-foreground">Estado de obras en curso y evolución de facturación cerrada.</p>
        </div>
      </div>

      {/* TARJETAS KPI - 2x2 on Mobile, 4 cols on Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">

        <Card className="shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground break-words max-w-[80%]">Presupuestos (En Curso)</CardTitle>
            <Building2 className="h-4 w-4 text-blue-500 shrink-0" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-lg md:text-2xl font-bold break-all">{formatCurrency(kpiData.presupuestosPendientes)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Obras activas</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground break-words max-w-[80%]">Gastos Obra (En Curso)</CardTitle>
            <Wallet className="h-4 w-4 text-orange-500 shrink-0" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-lg md:text-2xl font-bold break-all">{formatCurrency(kpiData.gastosObraEnCurso)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Materiales + Personal</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground break-words max-w-[80%]">Gastos Generales (Mes)</CardTitle>
            <Activity className="h-4 w-4 text-purple-500 shrink-0" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-lg md:text-2xl font-bold break-all">{formatCurrency(kpiData.gastosGeneralesMes)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Estructurales + Nóminas</p>
          </CardContent>
        </Card>

        <Card className={`shadow-sm border-l-4 ${kpiData.margen >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground break-words max-w-[80%]">Margen Estimado</CardTitle>
            {kpiData.margen >= 0 ? <TrendingUp className="h-4 w-4 text-green-500 shrink-0" /> : <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />}
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className={`text-lg md:text-2xl font-bold break-all ${kpiData.margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(kpiData.margen)}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Beneficio proyectado</p>
          </CardContent>
        </Card>

      </div>

      {/* GRÁFICA */}
      <div className="grid grid-cols-1 gap-4 md:gap-6">
        <Card className="col-span-1 shadow-sm">
          <CardHeader className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg md:text-xl">Finanzas 2026 (Enero - Diciembre)</CardTitle>
              <p className="text-xs md:text-sm text-muted-foreground">Evolución real de obras finalizadas y gastos de empresa.</p>
            </div>
          </CardHeader>
          <CardContent className="h-[300px] md:h-[400px] p-2 md:p-6 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{
              top: 20,
              right: 10,
              left: -10,
              bottom: 5
            }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/30" />
                <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} tickFormatter={value => `${(value / 1000).toFixed(0)}k`} />
                <Tooltip formatter={value => formatCurrency(value)} contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                fontSize: '12px'
              }} />
                <Legend wrapperStyle={{
                fontSize: '10px',
                paddingTop: '10px'
              }} />
                <Bar dataKey="GastosObra" stackId="a" name="G. Obra" fill="#f97316" radius={[0, 0, 4, 4]} />
                <Bar dataKey="GastosGenerales" stackId="a" name="G. Generales" fill="#a855f7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Ingresos" name="Ingresos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="Resultado" name="Beneficio Acum." stroke="#10b981" strokeWidth={3} dot={{
                r: 3
              }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* RESUMEN FINANCIERO MENSUAL — solo admin y encargados */}
      {(sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado') && (
        <ResumenFinancieroMeses />
      )}

    </div>;
};
export default Dashboard;