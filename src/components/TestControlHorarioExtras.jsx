import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const TestControlHorarioExtras = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Reading strictly from control_horario_extras view as requested
        const { data: rows, error: err } = await supabase
          .from('control_horario_extras')
          .select('dia, empleado_id, horas_trabajadas, horas_objetivo_dia, horas_normales_dia, horas_extra_dia, horas_festivo_dia, saldo_dia')
          .order('dia', { ascending: false });
        
        if (err) throw err;
        setData(rows || []);
      } catch (err) {
        console.error("Error fetching extras:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600">
        <h2 className="text-xl font-bold mb-2">Error cargando datos</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-100 text-blue-700 rounded-lg">
            <Calendar className="w-6 h-6" />
        </div>
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Prueba Control Horario Extras (Temporal)</h1>
            <p className="text-muted-foreground text-sm">Vista de solo lectura para validación de horas extra y saldos diarios.</p>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Datos: control_horario_extras</CardTitle>
          <CardDescription>Mostrando {data.length} registros. (Filtrado por RLS)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[120px]">Día</TableHead>
                  <TableHead>Empleado ID</TableHead>
                  <TableHead className="text-right">H. Trab.</TableHead>
                  <TableHead className="text-right">H. Obj.</TableHead>
                  <TableHead className="text-right">H. Norm.</TableHead>
                  <TableHead className="text-right font-bold text-blue-700 bg-blue-50/50">H. Extra</TableHead>
                  <TableHead className="text-right text-orange-700">H. Fest.</TableHead>
                  <TableHead className="text-right font-bold">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      No hay datos disponibles para mostrar.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((row, i) => (
                    <TableRow key={`${row.empleado_id}-${row.dia}-${i}`} className="hover:bg-muted/5">
                      <TableCell className="font-medium">
                        {row.dia ? format(new Date(row.dia), 'yyyy-MM-dd') : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-[150px] truncate" title={row.empleado_id}>
                        {row.empleado_id}
                      </TableCell>
                      <TableCell className="text-right">{Number(row.horas_trabajadas).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{Number(row.horas_objetivo_dia).toFixed(2)}</TableCell>
                      <TableCell className="text-right">{Number(row.horas_normales_dia).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold text-blue-600 bg-blue-50/30">
                        {Number(row.horas_extra_dia) > 0 ? `+${Number(row.horas_extra_dia).toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right text-orange-600">
                        {Number(row.horas_festivo_dia) > 0 ? Number(row.horas_festivo_dia).toFixed(2) : '-'}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-bold", 
                        Number(row.saldo_dia) < 0 ? "text-red-500" : (Number(row.saldo_dia) > 0 ? "text-green-600" : "text-muted-foreground")
                      )}>
                        {Number(row.saldo_dia).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestControlHorarioExtras;