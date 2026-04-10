import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const SessionDiagnostic = () => {
    const { sessionRole } = useAuth();
    const [diagData, setDiagData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchDiagnosticData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: rpcError } = await supabase.rpc('whoami');

            if (rpcError) {
                throw rpcError;
            }
            setDiagData(data);
        } catch (err) {
            console.error("Error fetching whoami:", err);
            setError(err.message);
            toast({
                title: 'Error de Diagnóstico',
                description: err.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (sessionRole.rol === 'admin') {
            fetchDiagnosticData();
        }
    }, [sessionRole.rol, fetchDiagnosticData]);

    if (sessionRole.rol !== 'admin') {
        return null;
    }

    return (
        <Card className="mt-8 bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white">Diagnóstico Supabase (whoami)</CardTitle>
                <Button variant="outline" size="icon" onClick={fetchDiagnosticData} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
            </CardHeader>
            <CardContent>
                {loading && !diagData && !error && (
                     <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                     </div>
                )}
                {error && (
                    <pre className="bg-red-900/50 text-red-300 p-4 rounded-md text-xs overflow-x-auto">
                        {`Error: ${error}`}
                    </pre>
                )}
                {diagData && (
                    <pre className="bg-slate-950 text-green-300 p-4 rounded-md text-xs overflow-x-auto">
                        {JSON.stringify(diagData, null, 2)}
                    </pre>
                )}
            </CardContent>
        </Card>
    );
};

export default SessionDiagnostic;