import React, { useState, useCallback } from 'react';
import { useSafeMode } from '@/contexts/SafeModeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, ShieldAlert, Zap, RefreshCw, List, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fmtMadrid } from '@/lib/utils';

const Diagnostics = () => {
  const { isSafeMode, setIsSafeMode, lastError, handleDataError } = useSafeMode();
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const handleHealthCheck = async () => {
    const { error } = await supabase.from('app_ok').select('status').limit(1);
    if (error) {
      handleDataError(error, 'app_ok_manual_check');
    } else {
      toast({ title: 'Chequeo de salud exitoso', description: 'La conexión con la API es estable.' });
    }
  };

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    const { data, error } = await supabase
      .from('app_events')
      .select('created_at,origin,level,payload')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      handleDataError(error, 'fetch_app_logs');
    } else {
      setLogs(data);
    }
    setLoadingLogs(false);
  }, [handleDataError]);

  return (
    <div className="p-4 md:p-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">Diagnóstico</h1>
        <p className="text-muted-foreground">Monitoriza y controla el estado de la aplicación.</p>
      </motion.div>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                {isSafeMode ? <ShieldAlert className="w-6 h-6 text-yellow-400" /> : <Shield className="w-6 h-6 text-green-500" />}
                Modo Seguro
              </CardTitle>
              <CardDescription>
                Activa o desactiva las cargas automáticas de datos para prevenir errores.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-2 p-4 bg-muted/50 rounded-lg">
                <Switch
                  id="safe-mode-toggle"
                  checked={isSafeMode}
                  onCheckedChange={setIsSafeMode}
                />
                <Label htmlFor="safe-mode-toggle" className="text-lg">
                  {isSafeMode ? 'Modo Seguro ACTIVADO' : 'Modo Seguro DESACTIVADO'}
                </Label>
              </div>
              
              <Alert variant={isSafeMode ? 'default' : 'destructive'} className={isSafeMode ? 'border-yellow-400/50' : 'border-green-500/50'}>
                {isSafeMode ? <Zap className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                <AlertTitle>{isSafeMode ? 'Protección activa' : 'Rendimiento normal'}</AlertTitle>
                <AlertDescription>
                  {isSafeMode
                    ? 'La carga automática de datos está pausada. La aplicación es más estable pero podría no mostrar la información más reciente.'
                    : 'La aplicación funciona con normalidad. Los datos se cargarán según la configuración de cada componente (actualmente manual).'}
                </AlertDescription>
              </Alert>
              
              {lastError.message && (
                <Alert variant="destructive">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>Último Error Capturado</AlertTitle>
                  <AlertDescription>
                    <p><strong>Origen:</strong> {lastError.origin}</p>
                    <p><strong>Mensaje:</strong> <code className="text-xs bg-destructive-foreground/10 p-1 rounded">{lastError.message}</code></p>
                  </AlertDescription>
                </Alert>
              )}

              <Button onClick={handleHealthCheck}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Realizar Chequeo de Salud
              </Button>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <Card>
                <CardHeader>
                    <CardTitle>Registro de Eventos</CardTitle>
                    <CardDescription>Últimos 30 eventos registrados en la aplicación.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={fetchLogs} disabled={loadingLogs}>
                        {loadingLogs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <List className="mr-2 h-4 w-4" />}
                        Ver Logs
                    </Button>
                    <ScrollArea className="h-80 mt-4 border rounded-md p-4 bg-muted/50">
                        {loadingLogs && <div className="flex justify-center items-center h-full"><Loader2 className="w-8 h-8 animate-spin" /></div>}
                        {!loadingLogs && logs.length === 0 && <p className="text-sm text-muted-foreground text-center">No hay logs para mostrar. Pulsa "Ver Logs" para cargarlos.</p>}
                        <div className="space-y-4">
                            {logs.map((log, i) => (
                                <div key={i} className="text-xs font-mono">
                                    <p className="font-semibold">
                                        <span className={log.level === 'error' ? 'text-destructive' : 'text-foreground'}>[{log.level?.toUpperCase()}]</span> {fmtMadrid(log.created_at)}
                                    </p>
                                    <p className="text-muted-foreground">Origen: <span className="text-foreground">{log.origin}</span></p>
                                    <p className="text-muted-foreground">Msg: <span className="text-foreground">{log.payload?.message}</span></p>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Diagnostics;