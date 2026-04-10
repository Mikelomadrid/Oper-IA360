// Evidence photo display in tool return modals/lists fixed. Admin/encargado can now review uploaded photos for pending tool returns.
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
    Loader2, Check, X, Wrench, Search, Calendar, User, Package, MessageSquare, ArrowRight, Eye
} from 'lucide-react';
import { toast } from "@/components/ui/use-toast";
import { Card } from "@/components/ui/card";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ToolRequests = ({ highlightId }) => {
    const [activeTab, setActiveTab] = useState('solicitudes'); // solicitudes | devoluciones
    const [requests, setRequests] = useState([]);
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchQuery] = useState('');
    
    // Actions State
    const [selectedItem, setSelectedItem] = useState(null);
    const [isActionOpen, setIsActionOpen] = useState(false);
    const [actionType, setActionType] = useState(null); // 'approve' | 'reject'
    const [actionNotes, setActionNotes] = useState('');
    const [processing, setProcessing] = useState(false);
    
    // Photo Viewer State
    const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
    const [evidencePhotos, setEvidencePhotos] = useState([]);

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        if (activeTab === 'solicitudes') {
            await fetchRequests();
        } else {
            await fetchReturns();
        }
        setLoading(false);
    };

    const fetchRequests = async () => {
        try {
            const { data, error } = await supabase
                .from('herramienta_solicitudes')
                .select(`
                    *,
                    herramientas ( nombre, ref_almacen, foto_url, unidades_disponibles ),
                    solicitante:empleados!herramienta_solicitudes_solicitada_por_fkey ( nombre, apellidos ),
                    proyecto:proyecto_id ( nombre_proyecto )
                `)
                .eq('estado', 'pendiente')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRequests(data || []);
        } catch (error) {
            console.error('Error fetching requests:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las solicitudes.' });
        }
    };

    const fetchReturns = async () => {
        try {
            // Using explicit constraint name for delivered_to relationship to handle ambiguity
            const { data, error } = await supabase
                .from('herramienta_asignaciones')
                .select(`
                    *,
                    herramientas ( nombre, ref_almacen, foto_url ),
                    empleado:empleados!herramienta_asignaciones_entregada_a_fkey ( nombre, apellidos ),
                    evidencias:herramienta_evidencias (*)
                `)
                .eq('estado', 'pendiente_revision')
                .order('devuelta_at', { ascending: false });

            if (error) throw error;
            setReturns(data || []);
        } catch (error) {
            console.error('Error fetching returns:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las devoluciones.' });
        }
    };

    const handleOpenAction = (item, type) => {
        setSelectedItem(item);
        setActionType(type);
        setActionNotes('');
        
        // If viewing a return, load its photos into viewer state just in case
        if (activeTab === 'devoluciones' && item.evidencias) {
            // Filter relevant evidences (e.g., 'devolucion' type) and ensure url is valid
            const photos = item.evidencias
                .filter(ev => ev.tipo === 'devolucion' && ev.url)
                .map(ev => ({
                    url: ev.url.startsWith('http') 
                        ? ev.url 
                        : supabase.storage.from('herramientas_fotos').getPublicUrl(ev.url).data.publicUrl,
                    notes: ev.notas
                }));
            setEvidencePhotos(photos);
        } else {
            setEvidencePhotos([]);
        }
        
        setIsActionOpen(true);
    };

    const processAction = async () => {
        if (!selectedItem) return;
        setProcessing(true);

        try {
            if (activeTab === 'solicitudes') {
                // ... Existing Request Logic ...
                if (actionType === 'reject') {
                    const { error } = await supabase.from('herramienta_solicitudes')
                        .update({ estado: 'rechazada', atendida_por: (await supabase.auth.getUser()).data.user.id, atendida_at: new Date().toISOString() })
                        .eq('id', selectedItem.id);
                    if (error) throw error;
                    toast({ title: 'Solicitud rechazada' });
                } else {
                    const { error } = await supabase.rpc('api_herramienta_reservar_y_asignar_v4', {
                        p_herramienta_id: selectedItem.herramienta_id, p_solicitud_id: selectedItem.id, p_proyecto_id: selectedItem.proyecto_id, p_cantidad: 1, p_observaciones: actionNotes || null
                    });
                    if (error) throw error;
                    toast({ title: 'Solicitud aprobada' });
                }
            } else {
                // ... Returns Logic ...
                // Use rpc 'revisar_devolucion'
                const { error } = await supabase.rpc('revisar_devolucion', {
                    p_asignacion_id: selectedItem.id,
                    p_aprobada: actionType === 'approve',
                    p_descripcion_incidencia: actionNotes || (actionType === 'reject' ? 'Rechazada sin comentarios' : null)
                });
                
                if (error) throw error;
                toast({ 
                    title: actionType === 'approve' ? 'Devolución aceptada' : 'Devolución rechazada',
                    description: actionType === 'approve' ? 'Stock actualizado.' : 'Se ha notificado al técnico.'
                });
            }

            setIsActionOpen(false);
            fetchData(); // Refresh current tab

        } catch (error) {
            console.error('Error processing:', error);
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Error desconocido' });
        } finally {
            setProcessing(false);
        }
    };

    const openPhotoViewer = (index = 0) => {
        setCurrentPhotoIndex(index);
        setIsPhotoViewerOpen(true);
    };

    // Filter Logic
    const filteredData = (activeTab === 'solicitudes' ? requests : returns).filter(item => {
        const term = searchTerm.toLowerCase();
        const toolName = item.herramientas?.nombre?.toLowerCase() || '';
        const empName = (activeTab === 'solicitudes' ? item.solicitante : item.empleado)?.nombre?.toLowerCase() || '';
        return toolName.includes(term) || empName.includes(term);
    });

    if (loading && !isActionOpen) {
        return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
                    <TabsList>
                        <TabsTrigger value="solicitudes" className="gap-2">
                            Solicitudes
                            {requests.length > 0 && <Badge variant="secondary" className="px-1 h-5 text-[10px]">{requests.length}</Badge>}
                        </TabsTrigger>
                        <TabsTrigger value="devoluciones" className="gap-2">
                            Devoluciones
                            {returns.length > 0 && <Badge variant="secondary" className="px-1 h-5 text-[10px]">{returns.length}</Badge>}
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
                
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Herramienta</TableHead>
                            <TableHead>{activeTab === 'solicitudes' ? 'Solicitante' : 'Devuelto por'}</TableHead>
                            <TableHead>Fecha</TableHead>
                            {activeTab === 'devoluciones' && <TableHead>Evidencias</TableHead>}
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={activeTab === 'devoluciones' ? 5 : 4} className="h-24 text-center text-muted-foreground">
                                    No hay {activeTab} pendientes.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredData.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            {item.herramientas?.foto_url ? (
                                                <img 
                                                    src={item.herramientas.foto_url} 
                                                    alt="Tool" 
                                                    className="w-10 h-10 rounded object-cover border"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                                                    <Wrench className="w-5 h-5 text-muted-foreground" />
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-medium">{item.herramientas?.nombre || 'Desconocida'}</p>
                                                {activeTab === 'solicitudes' && (
                                                    <div className="text-xs text-muted-foreground">
                                                        Stock: {item.herramientas?.unidades_disponibles ?? '?'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4 text-muted-foreground" />
                                            <span>
                                                {(activeTab === 'solicitudes' ? item.solicitante : item.empleado)?.nombre || 'Usuario'}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">
                                            {format(new Date(item.created_at || item.devuelta_at), 'dd MMM', { locale: es })}
                                            <span className="text-xs text-muted-foreground block">
                                                {format(new Date(item.created_at || item.devuelta_at), 'HH:mm')}
                                            </span>
                                        </div>
                                    </TableCell>
                                    
                                    {activeTab === 'devoluciones' && (
                                        <TableCell>
                                            {item.evidencias?.length > 0 ? (
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-8 gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                    onClick={() => handleOpenAction(item, 'approve')} // Open modal directly to see photos
                                                >
                                                    <div className="relative">
                                                        <div className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                                                        <Eye className="w-4 h-4" />
                                                    </div>
                                                    {item.evidencias.filter(e => e.tipo === 'devolucion').length} Fotos
                                                </Button>
                                            ) : (
                                                <span className="text-muted-foreground text-xs italic">Sin fotos</span>
                                            )}
                                        </TableCell>
                                    )}

                                    <TableCell className="text-right">
                                        <Button size="sm" onClick={() => handleOpenAction(item, 'approve')}>
                                            Gestionar
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            {/* ACTION DIALOG */}
            <Dialog open={isActionOpen} onOpenChange={setIsActionOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {activeTab === 'solicitudes' ? 'Gestionar Solicitud' : 'Revisar Devolución'}
                        </DialogTitle>
                        <DialogDescription>
                            {activeTab === 'solicitudes' 
                                ? `Solicitud de ${selectedItem?.solicitante?.nombre}`
                                : `Devolución de ${selectedItem?.empleado?.nombre}`
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Evidence Gallery for Returns */}
                        {activeTab === 'devoluciones' && evidencePhotos.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="font-medium flex items-center gap-2"><Check className="w-4 h-4"/> Evidencias del Estado</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {evidencePhotos.map((photo, idx) => (
                                        <div 
                                            key={idx} 
                                            className="relative aspect-square rounded-lg overflow-hidden border cursor-pointer hover:opacity-90 transition-opacity group"
                                            onClick={() => openPhotoViewer(idx)}
                                        >
                                            <img src={photo.url} alt="Evidencia" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                                <Eye className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Request/Return Message */}
                        {(selectedItem?.mensaje || selectedItem?.comentario_ultimo_reenvio) && (
                            <div className="bg-muted p-3 rounded-md text-sm italic border-l-4 border-primary">
                                <span className="font-semibold block mb-1 not-italic flex items-center gap-2">
                                    <MessageSquare className="w-3 h-3" /> Nota del técnico:
                                </span>
                                "{selectedItem.mensaje || selectedItem.comentario_ultimo_reenvio}"
                            </div>
                        )}

                        {/* Stock Check for Requests */}
                        {activeTab === 'solicitudes' && (
                            <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">Stock Disponible</p>
                                    <p className="text-2xl font-bold">{selectedItem?.herramientas?.unidades_disponibles}</p>
                                </div>
                                <Package className="w-8 h-8 text-muted-foreground opacity-20" />
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                {activeTab === 'solicitudes' ? 'Notas de gestión (Opcional)' : 'Motivo de rechazo / Observaciones'}
                            </label>
                            <Textarea 
                                placeholder={activeTab === 'solicitudes' ? "Observaciones..." : "Si rechazas, explica el motivo al técnico..."}
                                value={actionNotes}
                                onChange={(e) => setActionNotes(e.target.value)}
                                className={actionType === 'reject' ? 'border-red-300 focus:ring-red-200' : ''}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button 
                            variant="destructive" 
                            onClick={() => { setActionType('reject'); processAction(); }}
                            disabled={processing}
                            className="sm:mr-auto"
                        >
                            {processing && actionType === 'reject' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {activeTab === 'solicitudes' ? 'Rechazar' : 'Rechazar Devolución'}
                        </Button>
                        <Button variant="outline" onClick={() => setIsActionOpen(false)}>Cancelar</Button>
                        <Button 
                            onClick={() => { setActionType('approve'); processAction(); }}
                            disabled={processing || (activeTab === 'solicitudes' && selectedItem?.herramientas?.unidades_disponibles < 1)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            {processing && actionType === 'approve' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {activeTab === 'solicitudes' ? 'Aprobar y Asignar' : 'Aceptar y Cerrar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* FULLSCREEN PHOTO VIEWER */}
            <Dialog open={isPhotoViewerOpen} onOpenChange={setIsPhotoViewerOpen}>
                <DialogContent className="max-w-[95vw] h-[90vh] p-0 bg-black border-none flex flex-col justify-center items-center">
                    <div className="relative w-full h-full flex items-center justify-center">
                        <img 
                            src={evidencePhotos[currentPhotoIndex]?.url} 
                            alt="Full view" 
                            className="max-w-full max-h-full object-contain"
                        />
                        
                        {/* Navigation Controls */}
                        {evidencePhotos.length > 1 && (
                            <>
                                <Button 
                                    variant="ghost" 
                                    className="absolute left-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 rounded-full h-12 w-12"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentPhotoIndex((prev) => (prev - 1 + evidencePhotos.length) % evidencePhotos.length);
                                    }}
                                >
                                    ←
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 rounded-full h-12 w-12"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentPhotoIndex((prev) => (prev + 1) % evidencePhotos.length);
                                    }}
                                >
                                    →
                                </Button>
                            </>
                        )}
                        
                        <Button 
                            variant="ghost" 
                            className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full"
                            onClick={() => setIsPhotoViewerOpen(false)}
                        >
                            <X className="w-6 h-6" />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ToolRequests;