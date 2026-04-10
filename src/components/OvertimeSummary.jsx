import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Loader2, Clock, CalendarDays, Coins, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function OvertimeSummary({ dateRange }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    horasExtra: 0,
    horasFestivo: 0,
    importeTotal: 0
  });

  useEffect(() => {
    let isMounted = true;

    const fetchSummary = async () => {
      // 1. Validation: Ensure user and dates exist
      if (!user || !dateRange?.from || !dateRange?.to) {
        if(isMounted) setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      console.log("OvertimeSummary: Fetching for user:", user.id, "Range:", dateRange);

      try {
        // 2. Get Employee ID linked to current Auth User
        const { data: empData, error: empError } = await supabase
          .from('empleados')
          .select('id, nombre, apellidos')
          .eq('auth_user_id', user.id)
          .single();

        if (empError) throw new Error(`Error fetching employee: ${empError.message}`);
        if (!empData) {
          console.warn("OvertimeSummary: No employee profile found for current user.");
          if(isMounted) setLoading(false);
          return;
        }

        const employeeId = empData.id;
        const fromStr = format(dateRange.from, 'yyyy-MM-dd');
        const toStr = format(dateRange.to, 'yyyy-MM-dd');

        // 3. Fetch HOURS from 'control_horario_extras' (Base table, most accurate for hours)
        const { data: hoursData, error: hoursError } = await supabase
            .from('control_horario_extras')
            .select('horas_extra_dia, horas_festivo_dia')
            .eq('empleado_id', employeeId)
            .gte('dia', fromStr)
            .lte('dia', toStr);

        if (hoursError) {
            console.error("OvertimeSummary: Error fetching hours", hoursError);
            throw hoursError;
        }

        // 4. Fetch EARNINGS from 'v_horas_extras_app_v2' (View with calculated costs)
        // This view applies the rate logic (coste_hora * horas)
        const { data: moneyData, error: moneyError } = await supabase
            .from('v_horas_extras_app_v2')
            .select('importe')
            .eq('empleado_id', employeeId)
            .gte('dia', fromStr)
            .lte('dia', toStr);

        if (moneyError) {
             console.error("OvertimeSummary: Error fetching earnings view", moneyError);
             // We continue without throwing to show at least hours if money view fails
        }

        // 5. Calculate Totals
        let totalExtra = 0;
        let totalFestivo = 0;
        let totalImporte = 0;

        if (hoursData) {
            hoursData.forEach(row => {
                totalExtra += Number(row.horas_extra_dia) || 0;
                totalFestivo += Number(row.horas_festivo_dia) || 0;
            });
        }

        if (moneyData) {
            moneyData.forEach(row => {
                totalImporte += Number(row.importe) || 0;
            });
        }

        console.log("OvertimeSummary: Calculated Results ->", { totalExtra, totalFestivo, totalImporte });

        if (isMounted) {
          setStats({
            horasExtra: totalExtra,
            horasFestivo: totalFestivo,
            importeTotal: totalImporte
          });
          setLoading(false);
        }

      } catch (err) {
        console.error('OvertimeSummary: Unexpected error:', err);
        if (isMounted) {
            setError(err.message || 'Error calculando resumen');
            setLoading(false);
        }
      }
    };

    fetchSummary();
    
    // 6. Realtime subscription for live updates
    const channel = supabase
      .channel('overtime_summary_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'control_horario_extras' }, () => {
        console.log("OvertimeSummary: Data changed, refreshing...");
        fetchSummary();
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [user, dateRange]);

  if (!user) return null;

  // Format helpers
  const formatHours = (val) => {
    if (!val) return '0h';
    const h = Math.floor(val);
    const m = Math.round((val - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val || 0);
  };

  if (error) {
      return (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 text-sm mb-6">
            <AlertCircle className="w-4 h-4" />
            <span>No se pudo cargar el resumen: {error}</span>
        </div>
      );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
      
      {/* Card 1: Horas Extra Laborables */}
      <Card className="bg-white dark:bg-card border-l-4 border-l-blue-500 shadow-lg rounded-xl overflow-hidden hover:translate-y-[-2px] transition-all">
        <CardContent className="p-6">
          <div className="flex items-center justify-between pb-2">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Extras (Laborables)</p>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="mt-2">
            {loading ? (
              <div className="h-9 w-24 bg-gray-200 dark:bg-gray-800 animate-pulse rounded" />
            ) : (
              <span className="text-4xl font-extrabold text-gray-900 dark:text-gray-50 tracking-tight">
                {formatHours(stats.horasExtra)}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2 font-medium">Acumulado días laborables</p>
        </CardContent>
      </Card>

      {/* Card 2: Horas Extra Festivos */}
      <Card className="bg-white dark:bg-card border-l-4 border-l-purple-500 shadow-lg rounded-xl overflow-hidden hover:translate-y-[-2px] transition-all">
        <CardContent className="p-6">
          <div className="flex items-center justify-between pb-2">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Extras (Festivos)</p>
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                <CalendarDays className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="mt-2">
            {loading ? (
              <div className="h-9 w-24 bg-gray-200 dark:bg-gray-800 animate-pulse rounded" />
            ) : (
              <span className="text-4xl font-extrabold text-gray-900 dark:text-gray-50 tracking-tight">
                {formatHours(stats.horasFestivo)}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2 font-medium">Fines de semana y festivos</p>
        </CardContent>
      </Card>

      {/* Card 3: Total Ingresos */}
      <Card className="bg-white dark:bg-card border-l-4 border-l-emerald-500 shadow-lg rounded-xl overflow-hidden hover:translate-y-[-2px] transition-all">
        <CardContent className="p-6">
          <div className="flex items-center justify-between pb-2">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total Estimado</p>
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                <Coins className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <div className="mt-2">
            {loading ? (
              <div className="h-9 w-32 bg-gray-200 dark:bg-gray-800 animate-pulse rounded" />
            ) : (
              <span className="text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                {formatCurrency(stats.importeTotal)}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2 font-medium">Compensación económica total</p>
        </CardContent>
      </Card>
    </div>
  );
}