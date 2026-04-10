import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SessionDebugCard = () => {
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSessionData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('session_snapshot');
      
      if (rpcError) {
        throw rpcError;
      }
      
      setSessionData(data[0] || null);

    } catch (err) {
      console.error("Error fetching session snapshot:", err);
      setError(`No se pudo obtener la sesión: ${err.statusText || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionData();
  }, []);

  return (
    <Card className="bg-card/60 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Terminal className="w-4 h-4 text-muted-foreground" />
          Sesión actual (debug)
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={fetchSessionData} disabled={loading} className="h-7 w-7">
           <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center p-6 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Cargando datos...</span>
          </div>
        ) : error ? (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : sessionData ? (
          <div className="font-mono text-xs space-y-1 text-muted-foreground break-all">
            <div className="grid grid-cols-[110px_1fr] gap-x-2">
              <span className="font-semibold text-foreground">UID:</span>
              <span>{sessionData.me_uid || 'N/A'}</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-x-2">
              <span className="font-semibold text-foreground">JWT role:</span>
              <span>{sessionData.jwt_role || 'N/A'}</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-x-2">
              <span className="font-semibold text-foreground">Empleado ID:</span>
              <span>{sessionData.empleado_id || 'N/A'}</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-x-2">
              <span className="font-semibold text-foreground">Empleado email:</span>
              <span>{sessionData.empleado_email || 'N/A'}</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-x-2">
              <span className="font-semibold text-foreground">Empleado rol:</span>
              <span>{sessionData.empleado_rol || 'N/A'}</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-x-2">
              <span className="font-semibold text-foreground">Empleado activo:</span>
              <span>{sessionData.empleado_activo === true ? 'Sí' : sessionData.empleado_activo === false ? 'No' : 'N/A'}</span>
            </div>
          </div>
        ) : (
           <p className="text-sm text-muted-foreground">No se encontraron datos de sesión.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default SessionDebugCard;