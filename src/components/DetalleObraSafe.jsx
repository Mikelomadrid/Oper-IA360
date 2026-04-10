import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ArrowLeft, RefreshCw, ServerCrash, FileText, User, Tag, Euro, FileCheck2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Helmet } from 'react-helmet';
import { fmtMadrid, formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const fetchDetalleObra = async (obraId) => {
    if (!obraId) return null;
    const { data, error } = await supabase
        .from('v_proyectos_con_cliente')
        .select('*')
        .eq('proyecto_id', obraId)
        .single();
    if (error) throw error;
    return data;
};

const StatCard = ({ icon, title, value, className }) => (
    <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

const DetalleObraSafe = ({ navigate, appState }) => {
    const { toast } = useToast();
    const obraId = appState?.selected_obra_id;

    const { data: obra, refetch, isFetching, isError, error } = useQuery({
        queryKey: ['ds_detalle_obra', obraId],
        queryFn: () => fetchDetalleObra(obraId),
        enabled: !!obraId,
        onError: (err) => {
            toast({ variant: 'destructive', title: 'Error al cargar el detalle', description: err.message });
            console.error(err);
        }
    });
    
    useEffect(() => {
        if(obraId) {
            refetch();
        }
    }, [obraId, refetch]);

    if (!obraId) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] text-center">
                <ServerCrash className="h-16 w-16 text-muted-foreground mb-4" />
                <h2 className="text-2xl font-semibold mb-2">No se ha seleccionado ninguna obra</h2>
                <p className="text-muted-foreground mb-6">Por favor, vuelve al listado y selecciona una obra para ver sus detalles.</p>
                <Button onClick={() => navigate('/ObrasSafe')}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver al listado
                </Button>
            </div>
        );
    }
    
    if (isFetching) {
        return <div className="flex justify-center items-center h-[calc(100vh-120px)]"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>;
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] text-center">
                 <ServerCrash className="h-16 w-16 text-destructive mb-4" />
                <h2 className="text-2xl font-semibold mb-2">Error al cargar la obra</h2>
                <p className="text-muted-foreground mb-6">{error.message}</p>
                <Button onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4"/>Reintentar</Button>
            </div>
        )
    }

    return (
        <>
            <Helmet>
                <title>Ficha de Obra: {obra?.nombre_proyecto || 'Cargando...'}</title>
                <meta name="description" content={`Detalles de la obra ${obra?.nombre_proyecto}.`} />
            </Helmet>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <Button variant="ghost" onClick={() => navigate('/ObrasSafe')} className="mb-2">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Volver al listado
                        </Button>
                        <h1 className="text-3xl font-bold">{obra?.nombre_proyecto}</h1>
                        <p className="text-muted-foreground">{obra?.cliente_nombre}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => refetch()} disabled={isFetching}>
                            {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Refrescar
                        </Button>
                         <Button onClick={() => toast({ title: '🚧 Funcionalidad no implementada' })}>Ver Facturas</Button>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard icon={<Tag className="h-4 w-4 text-muted-foreground" />} title="Estado" value={<Badge variant="outline" className="text-lg capitalize">{obra?.estado}</Badge>} />
                    <StatCard icon={<Euro className="h-4 w-4 text-muted-foreground" />} title="Presupuesto" value={formatCurrency(obra?.coste_base_imponible)} />
                    <StatCard icon={<FileCheck2 className="h-4 w-4 text-muted-foreground" />} title="Total con IVA" value={formatCurrency(obra?.total_con_iva)} />
                    <StatCard icon={<FileText className="h-4 w-4 text-muted-foreground" />} title="Nº Facturas" value={obra?.num_facturas || 0} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader><CardTitle>Información General</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between"><span>ID Proyecto:</span> <span className="font-mono text-sm">{obra?.proyecto_id}</span></div>
                            <div className="flex justify-between"><span>Cliente:</span> <strong>{obra?.cliente_nombre}</strong></div>
                             <div className="flex justify-between"><span>Fecha Creación:</span> <strong>{fmtMadrid(obra?.proyecto_fecha_creacion, 'date')}</strong></div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Estado de Pagos</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                             <div className="flex justify-between"><span>Facturas Pagadas:</span> <strong className="text-green-500">{obra?.pagadas || 0}</strong></div>
                             <div className="flex justify-between"><span>Facturas Pendientes:</span> <strong className="text-orange-500">{obra?.pendientes || 0}</strong></div>
                             <div className="flex justify-between"><span>Facturas Vencidas:</span> <strong className="text-red-500">{obra?.vencidas || 0}</strong></div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
};

export default DetalleObraSafe;