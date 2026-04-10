import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Clock, FileText, User } from 'lucide-react';
import { formatCurrency, fmtMadrid } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const ProcesosAprobacionesBlock = ({ obraId }) => {
    const { toast } = useToast();
    const { sessionRole } = useAuth();
    const [aprobaciones, setAprobaciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const isManager = ['admin', 'encargado'].includes(sessionRole?.rol);

    const fetchAprobaciones = async () => {
        setLoading(true);
        try {
            // WORKAROUND: Removed !solicitado_por join due to missing FK relationship.
            // Fetching raw data and manually joining employees.
            const { data, error } = await supabase
                .from('aprobaciones_v2')
                .select('*')
                .eq('entidad_tipo', 'obra')
                .eq('entidad_id', obraId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            let enrichedData = data || [];
            
            // Collect user IDs for manual join
            const userIds = new Set();
            enrichedData.forEach(a => {
                if (a.solicitado_por) userIds.add(a.solicitado_por);
                if (a.aprobado_por) userIds.add(a.aprobado_por);
            });

            if (userIds.size > 0) {
                const { data: employees } = await supabase
                    .from('empleados')
                    .select('auth_user_id, nombre, apellidos')
                    .in('auth_user_id', Array.from(userIds));
                
                const empMap = {};
                employees?.forEach(emp => {
                    empMap[emp.auth_user_id] = emp;
                });

                enrichedData = enrichedData.map(item => ({
                    ...item,
                    solicitante: empMap[item.solicitado_por] || { nombre: 'Desconocido' },
                    aprobador: empMap[item.aprobado_por] || null
                }));
            }

            setAprobaciones(enrichedData);
        } catch (err) {
            console.error("Error fetching aprobaciones:", err);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las aprobaciones.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (obraId) fetchAprobaciones();
    }, [obraId]);

    const handleAction = async (id, status) => {
        try {
            const { error } = await supabase.rpc('rpc_resolver_aprobacion_v2', {
                p_aprobacion_id: id,
                p_estado: status
            });
            if (error) throw error;
            toast({ title: `Aprobación ${status}` });
            fetchAprobaciones();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        }
    };

    if (loading && aprobaciones.length === 0) return <div className="p-4 text-center text-muted-foreground">Cargando aprobaciones...</div>;
    if (!loading && aprobaciones.length === 0) return null; // Hide if empty

    return (
        <Card className="border-0 bg-white/5 backdrop-blur-md shadow-xl">
            <CardHeader className="pb-2 border-b border-white/10">
                <CardTitle className="text-lg text-white font-bold flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-400" /> Aprobaciones y Extras
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
                {aprobaciones.map(aprob => (
                    <div key={aprob.id} className="flex flex-col gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-semibold text-white text-sm">{aprob.tipo}</h4>
                                <p className="text-xs text-white/60 mt-1">{aprob.descripcion}</p>
                            </div>
                            <Badge className={`capitalize ${
                                aprob.estado === 'aprobado' ? 'bg-green-500/20 text-green-300' :
                                aprob.estado === 'rechazado' ? 'bg-red-500/20 text-red-300' :
                                'bg-amber-500/20 text-amber-300'
                            }`}>
                                {aprob.estado}
                            </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-white/50">
                            {aprob.importe && (
                                <span className="flex items-center gap-1 text-white/80 font-mono">
                                    {formatCurrency(aprob.importe)}
                                </span>
                            )}
                            <span className="flex items-center gap-1">
                                <User className="w-3 h-3" /> {aprob.solicitante?.nombre}
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {fmtMadrid(aprob.created_at, 'date')}
                            </span>
                        </div>

                        {aprob.estado === 'solicitado' && isManager && (
                            <div className="flex gap-2 mt-1 justify-end">
                                <Button size="xs" variant="destructive" className="h-7" onClick={() => handleAction(aprob.id, 'rechazado')}>
                                    <XCircle className="w-3 h-3 mr-1" /> Rechazar
                                </Button>
                                <Button size="xs" className="h-7 bg-green-600 hover:bg-green-700 text-white" onClick={() => handleAction(aprob.id, 'aprobado')}>
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Aprobar
                                </Button>
                            </div>
                        )}
                    </div>
                ))}
            </CardContent>
        </Card>
    );
};

export default ProcesosAprobacionesBlock;