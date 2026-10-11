import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ClipboardList, Package, Wrench, Calendar, User, UserCheck, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';

// Estados normalizados del pedido: pendiente / retirado_nave / entregado / cancelado
const ESTADO_STYLES = {
    pendiente:     { label: 'PENDIENTE',       bg: '#fef3c7', text: '#b45309', br: '#fcd34d' },
    retirado_nave: { label: 'RETIRADO DE NAVE',bg: '#dbeafe', text: '#1d4ed8', br: '#93c5fd' },
    entregado:     { label: 'ENTREGADO',       bg: '#dcfce7', text: '#15803d', br: '#86efac' },
    cancelado:     { label: 'CANCELADO',       bg: '#f1f5f9', text: '#475569', br: '#cbd5e1' },
};

const getEstadoStyle = (estado) => ESTADO_STYLES[estado] || ESTADO_STYLES.pendiente;

// Mismo criterio de estado que en la vista SQL, pero a nivel de ITEM individual
// (para pintar el badge de cada línea dentro del modal).
const ITEM_ESTADO_LABELS = {
    pendiente: 'Pendiente',
    aprobada: 'Retirado de nave',
    gestionada: 'Retirado de nave',
    entregada: 'Entregado',
    cancelada: 'Cancelado',
    atendida: 'Entregado',
    rechazada: 'Rechazado',
};

const formatFecha = (dateStr) => {
    if (!dateStr) return '-';
    try {
        return format(parseISO(dateStr), 'dd MMM yyyy', { locale: es });
    } catch (e) {
        return dateStr;
    }
};

const ProjectPedidosView = ({ projectId }) => {
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal de detalle
    const [selectedPedido, setSelectedPedido] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(false);

    const fetchPedidos = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('v_proyecto_pedidos_agrupados')
                .select('*')
                .eq('proyecto_id', projectId)
                .order('fecha', { ascending: false });

            if (error) throw error;
            setPedidos(data || []);
        } catch (error) {
            console.error('Error fetching pedidos:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los pedidos de esta obra.' });
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { fetchPedidos(); }, [fetchPedidos]);

    const openPedidoModal = async (pedido) => {
        setSelectedPedido(pedido);
        setModalOpen(true);
        setLoadingItems(true);
        try {
            const [{ data: materiales, error: errMat }, { data: herramientas, error: errHerr }] = await Promise.all([
                supabase
                    .from('v_pedido_material_items')
                    .select('*')
                    .eq('proyecto_id', pedido.proyecto_id)
                    .eq('empleado_solicitante_id', pedido.empleado_solicitante_id)
                    .eq('fecha', pedido.fecha),
                supabase
                    .from('v_pedido_herramienta_items')
                    .select('*')
                    .eq('proyecto_id', pedido.proyecto_id)
                    .eq('empleado_solicitante_id', pedido.empleado_solicitante_id)
                    .eq('fecha', pedido.fecha),
            ]);

            if (errMat) throw errMat;
            if (errHerr) throw errHerr;

            const combined = [
                ...(materiales || []).map(m => ({ ...m, tipo: 'material' })),
                ...(herramientas || []).map(h => ({ ...h, tipo: 'herramienta' })),
            ];
            setItems(combined);
        } catch (error) {
            console.error('Error fetching pedido items:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el detalle del pedido.' });
        } finally {
            setLoadingItems(false);
        }
    };

    const closeModal = () => {
        setModalOpen(false);
        setSelectedPedido(null);
        setItems([]);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-foreground">
                <ClipboardList className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold">Pedidos de esta obra</h3>
            </div>

            {pedidos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-xl bg-muted/5">
                    <ClipboardList className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground">Todavía no se han pedido materiales ni herramientas para esta obra.</p>
                </div>
            ) : (
                <Card className="shadow-sm border-border/60 overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/40">
                                <TableHead>Fecha</TableHead>
                                <TableHead>Técnico</TableHead>
                                <TableHead className="text-center">Materiales</TableHead>
                                <TableHead className="text-center">Herramientas</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Atendido</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pedidos.map((p, idx) => {
                                const style = getEstadoStyle(p.estado_normalizado);
                                return (
                                    <TableRow
                                        key={`${p.empleado_solicitante_id}-${p.fecha}-${idx}`}
                                        className="cursor-pointer hover:bg-muted/40"
                                        onClick={() => openPedidoModal(p)}
                                    >
                                        <TableCell className="text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5" /> {formatFecha(p.fecha)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-medium text-sm">
                                            <span className="flex items-center gap-1.5">
                                                <User className="w-3.5 h-3.5 text-muted-foreground" />
                                                {p.tecnico_nombre || 'Desconocido'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary" className="gap-1.5 font-mono">
                                                <Package className="w-3 h-3" /> {p.cantidad_materiales}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary" className="gap-1.5 font-mono">
                                                <Wrench className="w-3 h-3" /> {p.cantidad_herramientas}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className="uppercase text-[10px] font-bold border"
                                                style={{ backgroundColor: style.bg, color: style.text, borderColor: style.br }}
                                            >
                                                {style.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {p.atendido_por_nombre
                                                ? <span className="flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5" /> {p.atendido_por_nombre}</span>
                                                : <span className="italic">Sin atender</span>}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </Card>
            )}

            {/* Modal de detalle del pedido */}
            <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) closeModal(); }}>
                <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ClipboardList className="w-5 h-5 text-primary" />
                            Detalle del pedido
                        </DialogTitle>
                        <DialogDescription>
                            {selectedPedido && (
                                <>
                                    {selectedPedido.tecnico_nombre || 'Técnico'} · {formatFecha(selectedPedido.fecha)}
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {loadingItems ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    ) : items.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">Sin ítems en este pedido.</p>
                    ) : (
                        <div className="space-y-2">
                            {items.map((item) => (
                                <div
                                    key={`${item.tipo}-${item.item_id}`}
                                    className="flex items-center justify-between gap-3 p-3 border rounded-lg bg-card"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`p-2 rounded-full shrink-0 ${item.tipo === 'material' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                            {item.tipo === 'material' ? <Package className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-medium text-sm truncate">{item.descripcion}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {item.cantidad} {item.unidad || ''}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="shrink-0 text-[10px] uppercase font-semibold">
                                        {ITEM_ESTADO_LABELS[item.estado] || item.estado}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ProjectPedidosView;
