import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRightLeft, ArrowDownLeft, ArrowUpRight, Check, X } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { fmtMadrid } from '@/lib/utils';

const ToolTransfersView = () => {
    const { user } = useAuth();
    const [incoming, setIncoming] = useState([]);
    const [outgoing, setOutgoing] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);

    const fetchTransfers = async () => {
        setLoading(true);
        try {
            // Fetch Incoming (I am the receiver)
            const { data: inData, error: inError } = await supabase
                .from('herramienta_traspasos')
                .select(`
                    *,
                    herramientas (id, nombre, marca, modelo, foto_url),
                    sender:empleados!herramienta_traspasos_desde_empleado_fkey(nombre, apellidos)
                `)
                .eq('hacia_empleado', user.id)
                .order('creado_en', { ascending: false });

            if (inError) throw inError;
            setIncoming(inData || []);

            // Fetch Outgoing (I am the sender)
            const { data: outData, error: outError } = await supabase
                .from('herramienta_traspasos')
                .select(`
                    *,
                    herramientas (id, nombre, marca, modelo, foto_url),
                    receiver:empleados!herramienta_traspasos_hacia_empleado_fkey(nombre, apellidos)
                `)
                .eq('desde_empleado', user.id)
                .order('creado_en', { ascending: false });

            if (outError) throw outError;
            setOutgoing(outData || []);

        } catch (error) {
            console.error("Error fetching transfers:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los traspasos." });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchTransfers();
        }
    }, [user]);

    const handleAccept = async (id) => {
        setProcessingId(id);
        try {
            const { error } = await supabase.rpc('api_aceptar_traspaso', { p_traspaso_id: id });
            if (error) throw error;

            toast({ title: "Traspaso aceptado", description: "La herramienta ahora está asignada a ti." });
            fetchTransfers();
        } catch (error) {
            console.error("Error accepting transfer:", error);
            toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo aceptar el traspaso." });
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (id) => {
        setProcessingId(id);
        try {
            // Direct update as rejection doesn't require complex logic other than status change
            const { error } = await supabase
                .from('herramienta_traspasos')
                .update({ estado: 'rechazado' })
                .eq('id', id);

            if (error) throw error;

            toast({ title: "Traspaso rechazado", description: "La solicitud ha sido cancelada." });
            fetchTransfers();
        } catch (error) {
            console.error("Error rejecting transfer:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo rechazar el traspaso." });
        } finally {
            setProcessingId(null);
        }
    };

    const TransferCard = ({ transfer, type }) => {
        const isIncoming = type === 'incoming';
        const isPending = transfer.estado === 'pendiente';

        return (
            <Card className={`overflow-hidden border-l-4 ${isPending ? 'border-l-blue-500' : transfer.estado === 'aceptado' ? 'border-l-green-500' : 'border-l-red-500'}`}>
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-background">
                                {isIncoming ? <ArrowDownLeft className="w-3 h-3 mr-1 text-green-600" /> : <ArrowUpRight className="w-3 h-3 mr-1 text-blue-600" />}
                                {isIncoming ? 'Recibido de' : 'Enviado a'}
                            </Badge>
                            <span className="text-sm font-medium text-muted-foreground">
                                {isIncoming
                                    ? `${transfer.sender?.nombre} ${transfer.sender?.apellidos}`
                                    : `${transfer.receiver?.nombre} ${transfer.receiver?.apellidos}`}
                            </span>
                        </div>
                        <Badge className={
                            transfer.estado === 'pendiente' ? 'bg-blue-100 text-blue-800' :
                                transfer.estado === 'aceptado' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }>
                            {transfer.estado}
                        </Badge>
                    </div>
                    <CardTitle className="text-lg mt-2">{transfer.herramientas?.nombre}</CardTitle>
                    <CardDescription>{transfer.herramientas?.marca} {transfer.herramientas?.modelo}</CardDescription>
                </CardHeader>
                <CardContent className="pb-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <span>Solicitado: {fmtMadrid(transfer.creado_en)}</span>
                    </div>
                </CardContent>
                {isIncoming && isPending && (
                    <CardFooter className="flex gap-2 pt-2 pb-4">
                        <Button
                            className="w-full bg-green-600 hover:bg-green-700"
                            size="sm"
                            onClick={() => handleAccept(transfer.id)}
                            disabled={processingId === transfer.id}
                        >
                            {processingId === transfer.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                            Aceptar
                        </Button>
                        <Button
                            variant="destructive"
                            className="w-full"
                            size="sm"
                            onClick={() => handleReject(transfer.id)}
                            disabled={processingId === transfer.id}
                        >
                            {processingId === transfer.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
                            Rechazar
                        </Button>
                    </CardFooter>
                )}
            </Card>
        );
    };

    return (
        <>
            <Helmet><title>Traspasos | Inventario</title></Helmet>
            <div className="p-6 w-full space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <ArrowRightLeft className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold">Traspasos de Herramientas</h1>
                        <p className="text-muted-foreground">Gestiona las transferencias de herramientas entre compañeros.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    </div>
                ) : (
                    <Tabs defaultValue="incoming" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="incoming" className="relative">
                                Solicitudes Recibidas
                                {incoming.filter(i => i.estado === 'pendiente').length > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">
                                        {incoming.filter(i => i.estado === 'pendiente').length}
                                    </span>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="outgoing">Mis Envíos</TabsTrigger>
                        </TabsList>

                        <TabsContent value="incoming" className="space-y-4">
                            {incoming.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed rounded-xl">
                                    <p className="text-muted-foreground">No tienes solicitudes de traspaso.</p>
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2">
                                    {incoming.map(t => <TransferCard key={t.id} transfer={t} type="incoming" />)}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="outgoing" className="space-y-4">
                            {outgoing.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed rounded-xl">
                                    <p className="text-muted-foreground">No has iniciado ningún traspaso.</p>
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2">
                                    {outgoing.map(t => <TransferCard key={t.id} transfer={t} type="outgoing" />)}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                )}
            </div>
        </>
    );
};

export default ToolTransfersView;