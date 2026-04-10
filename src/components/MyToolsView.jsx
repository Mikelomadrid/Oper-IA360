import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, UploadCloud, Package, Calendar, Wrench, AlertCircle, X, Eye, CheckCircle2, Clock, ArrowRightLeft } from 'lucide-react';
import { fmtMadrid } from '@/lib/utils';
import ReassignToolModal from '@/components/ReassignToolModal';

const MyToolsView = ({ navigate }) => {
    const { user, sessionRole } = useAuth();
    const [tools, setTools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTool, setSelectedTool] = useState(null);

    // Modal Form State
    const [comment, setComment] = useState('');
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);

    // Reassign Modal State
    const [reassignModalOpen, setReassignModalOpen] = useState(false);

    const fetchTools = async () => {
        // Need valid employee ID
        if (!sessionRole?.empleadoId) return;

        // Only set loading if list is empty (first load)
        if (tools.length === 0) setLoading(true);

        try {
            const { data, error } = await supabase
                .from('herramienta_asignaciones')
                .select(`
                    *,
                    herramientas (
                        id,
                        nombre,
                        marca,
                        modelo,
                        foto_url,
                        ref_almacen
                    )
                `)
                .eq('entregada_a', sessionRole.empleadoId)
                // Filter active assignments. 
                // We show 'en_uso', 'pendiente_aceptacion', 'pendiente_revision', 'rechazada_en_revision'
                // We EXCLUDE 'devuelta', 'cerrada', 'devuelta_aceptada' etc.
                .in('estado', ['en_uso', 'pendiente_aceptacion', 'pendiente_revision', 'rechazada_en_revision'])
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Transform data to flat structure for easier rendering
            const transformedData = (data || []).map(item => ({
                asignacion_id: item.id,
                herramienta_id: item.herramienta_id,
                estado_asignacion: item.estado,
                created_at: item.created_at,
                comentario_ultimo_reenvio: item.comentario_ultimo_reenvio,
                // Flatten tool details
                tool_nombre: item.herramientas?.nombre || 'Herramienta desconocida',
                marca: item.herramientas?.marca,
                modelo: item.herramientas?.modelo,
                foto_url: item.herramientas?.foto_url,
                ref_almacen: item.herramientas?.ref_almacen
            }));

            setTools(transformedData);
        } catch (error) {
            console.error('Error fetching tools:', error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar tus herramientas." });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Fetch only when auth is ready and we have an employee ID
        if (user && sessionRole?.loaded && sessionRole?.empleadoId) {
            fetchTools();

            // Realtime subscription for my tools
            const sub = supabase
                .channel(`my_tools_changes_${sessionRole.empleadoId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'herramienta_asignaciones',
                    filter: `entregada_a=eq.${sessionRole.empleadoId}`
                }, (payload) => {
                    fetchTools();
                })
                .subscribe();

            return () => sub.unsubscribe();
        }
    }, [user, sessionRole]);

    const handleAcceptTool = async (tool) => {
        setActionLoading(tool.asignacion_id);
        try {
            // First fetch the assignment to know which tool to update
            const { data: assignmentData, error: fetchError } = await supabase
                .from('herramienta_asignaciones')
                .select('herramienta_id')
                .eq('id', tool.asignacion_id)
                .single();

            if (fetchError) throw fetchError;

            const { error } = await supabase.rpc('aceptar_herramienta', {
                p_asignacion_id: tool.asignacion_id
            });

            if (error) throw error;

            // 2. Decrement the stock since the tool is now officially moving to the technician
            if (assignmentData?.herramienta_id) {
                // Fetch current stock to decrement safely
                const { data: toolData } = await supabase
                    .from('herramientas')
                    .select('unidades_disponibles')
                    .eq('id', assignmentData.herramienta_id)
                    .single();

                if (toolData && toolData.unidades_disponibles > 0) {
                    await supabase
                        .from('herramientas')
                        .update({ unidades_disponibles: toolData.unidades_disponibles - 1 })
                        .eq('id', assignmentData.herramienta_id);
                }
            }

            toast({
                title: "Herramienta aceptada",
                description: "Has confirmado la recepción de la herramienta.",
                className: "bg-green-50 border-green-200"
            });
            fetchTools();
        } catch (error) {
            console.error('Error accepting tool:', error);
            toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo aceptar la herramienta." });
        } finally {
            setActionLoading(null);
        }
    };

    const handleRejectTool = async (tool) => {
        setActionLoading(tool.asignacion_id);
        try {
            const { error } = await supabase
                .from('herramienta_asignaciones')
                .delete()
                .eq('id', tool.asignacion_id);

            if (error) throw error;

            toast({
                title: "Asignación rechazada",
                description: "Has rechazado la asignación de la herramienta.",
            });
            fetchTools();
        } catch (error) {
            console.error('Error rejecting tool:', error);
            toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo rechazar la herramienta." });
        } finally {
            setActionLoading(null);
        }
    };

    const handleOpenModal = (tool) => {
        setSelectedTool(tool);
        setComment('');
        setFiles([]);
        setModalOpen(true);
    };

    const handleFileChange = (e) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    const handleSubmitDevolucion = async () => {
        if (!selectedTool) return;
        setUploading(true);

        try {
            const assignmentId = selectedTool.asignacion_id;

            // 1. Upload photos
            if (files.length > 0) {
                for (const file of files) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${assignmentId}/${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
                    const uploadPath = `devoluciones/${fileName}`;

                    const { error: uploadError } = await supabase.storage
                        .from('herramienta_fotos')
                        .upload(uploadPath, file);

                    if (uploadError) throw uploadError;

                    // Register evidence RPC
                    const { error: evidenceError } = await supabase.rpc('rpc_registrar_evidencia_devolucion', {
                        p_asignacion_id: assignmentId,
                        p_url: uploadPath,
                        p_notas: 'Evidencia de devolución'
                    });

                    if (evidenceError) throw evidenceError;
                }
            }

            // 2. Call return RPC
            const { error: returnError } = await supabase.rpc('rpc_tecnico_devuelve_herramienta', {
                p_asignacion_id: assignmentId,
                p_comentario: comment || null
            });

            if (returnError) throw returnError;

            toast({ title: "Éxito", description: "Solicitud de devolución enviada correctamente." });
            setModalOpen(false);

            // Refresh list to remove returned tool or update status
            fetchTools();

        } catch (error) {
            console.error('Error returning tool:', error);
            toast({ variant: "destructive", title: "Error", description: error.message || "Falló el proceso de devolución." });
        } finally {
            setUploading(false);
        }
    };

    const getPublicUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        const { data } = supabase.storage.from('herramienta_fotos').getPublicUrl(path);
        return data?.publicUrl || null;
    };

    const handleViewDetails = (toolId) => {
        navigate(`/inventario/herramientas/${toolId}`);
    };

    const renderStatusBadge = (estado) => {
        switch (estado) {
            case 'pendiente_revision':
                return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200"><Clock className="w-3 h-3 mr-1" /> Devolución Pendiente</Badge>;
            case 'rechazada_en_revision':
                return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Devolución Rechazada</Badge>;
            case 'pendiente_aceptacion':
                return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Clock className="w-3 h-3 mr-1" /> Por Aceptar</Badge>;
            case 'en_uso':
            default:
                return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" /> En Uso</Badge>;
        }
    };

    return (
        <>
            <Helmet><title>Mis Herramientas | Inventario</title></Helmet>

            <div className="p-4 md:p-8 w-full space-y-6 pb-16">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Wrench className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold">Mis Herramientas</h1>
                        <p className="text-muted-foreground">Gestiona las herramientas que tienes asignadas actualmente.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    </div>
                ) : tools.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed rounded-xl bg-muted/30">
                        <Package className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                        <h3 className="text-xl font-medium text-muted-foreground">No tienes herramientas asignadas</h3>
                        <p className="text-sm text-muted-foreground mt-2">
                            Las herramientas asignadas por el encargado aparecerán aquí.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {tools.map((item) => (
                            <Card key={item.asignacion_id} className={`overflow-hidden flex flex-col shadow-md hover:shadow-lg transition-shadow rounded-xl ${item.estado_asignacion === 'rechazada_en_revision' ? 'border-red-300 dark:border-red-900' : ''} ${item.estado_asignacion === 'pendiente_aceptacion' ? 'border-blue-300 dark:border-blue-800 ring-1 ring-blue-100' : ''}`}>
                                <div className="relative h-48 w-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                                    {item.foto_url ? (
                                        <img
                                            src={getPublicUrl(item.foto_url)}
                                            alt={item.tool_nombre}
                                            className="max-h-full max-w-full object-contain p-4 mix-blend-multiply dark:mix-blend-normal"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center text-muted-foreground/40">
                                            <Package className="w-12 h-12 mb-2" />
                                            <span className="text-xs">Sin imagen</span>
                                        </div>
                                    )}
                                    <div className="absolute top-3 right-3">
                                        {renderStatusBadge(item.estado_asignacion)}
                                    </div>
                                </div>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg truncate pr-2" title={item.tool_nombre}>
                                            <button
                                                onClick={() => handleViewDetails(item.herramienta_id)}
                                                className="font-bold hover:text-primary transition-colors text-left"
                                            >
                                                {item.tool_nombre}
                                            </button>
                                        </CardTitle>
                                    </div>
                                    <p className="text-sm text-muted-foreground font-medium">
                                        {item.marca} {item.modelo}
                                    </p>
                                </CardHeader>
                                <CardContent className="flex-grow pb-2 space-y-3">
                                    <div className="text-xs text-muted-foreground space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-3 h-3" />
                                            <span>Asignada: {fmtMadrid(item.created_at, 'date')}</span>
                                        </div>
                                        <div className="font-mono bg-muted/50 inline-block px-1 rounded">
                                            Ref: {item.ref_almacen || 'N/A'}
                                        </div>
                                    </div>

                                    {item.estado_asignacion === 'rechazada_en_revision' && (
                                        <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-100 dark:border-red-900/50">
                                            <p className="text-xs font-bold text-red-700 dark:text-red-400 flex items-center gap-1 mb-1">
                                                <AlertCircle className="w-3 h-3" /> Motivo del rechazo:
                                            </p>
                                            <p className="text-xs text-red-600 dark:text-red-300 italic">
                                                "{item.comentario_ultimo_reenvio || 'Sin motivo especificado'}"
                                            </p>
                                        </div>
                                    )}

                                    {item.estado_asignacion === 'pendiente_aceptacion' && (
                                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-100 dark:border-blue-900/50">
                                            <p className="text-xs text-blue-700 dark:text-blue-300 leading-tight">
                                                Debes confirmar la recepción de esta herramienta para poder operar con ella.
                                            </p>
                                        </div>
                                    )}

                                    {item.estado_asignacion === 'pendiente_revision' && (
                                        <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-md border border-yellow-100 dark:border-yellow-900/50">
                                            <p className="text-xs text-yellow-700 dark:text-yellow-300 leading-tight">
                                                Solicitud de devolución enviada. Esperando aprobación del encargado.
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter className="pt-2 flex flex-col gap-2 mt-auto pb-4 px-4">
                                    {item.estado_asignacion === 'pendiente_aceptacion' && (
                                        <div className="flex gap-2 w-full">
                                            <Button
                                                className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white shadow-sm px-1 text-sm"
                                                onClick={() => handleAcceptTool(item)}
                                                disabled={actionLoading === item.asignacion_id}
                                            >
                                                {actionLoading === item.asignacion_id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                                                Confirmar
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                className="flex-1 h-10 shadow-sm px-1 text-sm"
                                                onClick={() => handleRejectTool(item)}
                                                disabled={actionLoading === item.asignacion_id}
                                            >
                                                Rechazar
                                            </Button>
                                        </div>
                                    )}

                                    {(item.estado_asignacion === 'en_uso' || item.estado_asignacion === 'rechazada_en_revision') && (
                                        <Button
                                            className="w-full h-10"
                                            variant={item.estado_asignacion === 'rechazada_en_revision' ? "destructive" : "secondary"}
                                            onClick={() => handleOpenModal(item)}
                                        >
                                            {item.estado_asignacion === 'rechazada_en_revision' ? 'Reintentar devolución' : 'Devolver herramienta'}
                                        </Button>
                                    )}

                                    {item.estado_asignacion === 'pendiente_revision' && (
                                        <Button className="w-full h-10 opacity-80 cursor-not-allowed" disabled variant="outline">
                                            <Clock className="w-4 h-4 mr-2" /> Pendiente aprobación
                                        </Button>
                                    )}

                                    <Button
                                        className="w-full h-10"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleViewDetails(item.herramienta_id)}
                                    >
                                        <Eye className="w-4 h-4 mr-2" /> Ver detalles
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedTool?.estado_asignacion === 'rechazada_en_revision'
                                ? 'Reintentar Devolución'
                                : 'Devolver Herramienta'}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedTool?.estado_asignacion === 'rechazada_en_revision'
                                ? 'Por favor, corrige las incidencias indicadas y adjunta nuevas evidencias.'
                                : 'Adjunta fotos del estado actual de la herramienta para procesar la devolución.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Herramienta</Label>
                            <div className="p-3 bg-muted rounded-md text-sm font-medium flex items-center gap-2">
                                <Package className="w-4 h-4 text-muted-foreground" />
                                {selectedTool?.tool_nombre} - {selectedTool?.marca}
                            </div>
                        </div>

                        {selectedTool?.estado_asignacion === 'rechazada_en_revision' && (
                            <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-100 dark:border-red-900 text-sm text-red-700 dark:text-red-400">
                                <strong>Motivo rechazo:</strong> {selectedTool.comentario_ultimo_reenvio}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Fotos de evidencia {selectedTool?.estado_asignacion === 'rechazada_en_revision' ? '(Opcional si ya enviaste)' : '(Requerido)'}</Label>
                            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors relative cursor-pointer bg-muted/10">
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={handleFileChange}
                                />
                                <UploadCloud className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground font-medium">
                                    {files.length > 0
                                        ? `${files.length} archivos seleccionados`
                                        : "Haz clic o arrastra fotos aquí"}
                                </p>
                                <p className="text-xs text-muted-foreground/70 mt-1">Formatos: JPG, PNG</p>
                            </div>
                            {files.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {files.map((f, i) => (
                                        <Badge key={i} variant="secondary" className="text-xs pl-2 pr-1 py-1 flex items-center gap-1">
                                            <span className="truncate max-w-[120px] inline-block">{f.name}</span>
                                            <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="ml-1 hover:text-destructive rounded-full p-0.5 hover:bg-background">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="comment">Comentario / Correcciones</Label>
                            <Textarea
                                id="comment"
                                placeholder={selectedTool?.estado_asignacion === 'rechazada_en_revision'
                                    ? "Describe cómo has solucionado el problema..."
                                    : "Observaciones sobre el estado, incidencias, etc."}
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                className="resize-none"
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex sm:justify-between gap-2">
                        {/* Reassign Button - shown if tool is not rejected (standard return) */}
                        {selectedTool?.estado_asignacion !== 'rechazada_en_revision' && (
                            <div className="flex-1 flex justify-start">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="text-xs px-3"
                                    onClick={() => { setModalOpen(false); setReassignModalOpen(true); }}
                                >
                                    <ArrowRightLeft className="w-3 h-3 mr-2" /> Reasignar
                                </Button>
                            </div>
                        )}
                        <div className="flex gap-2 justify-end w-full sm:w-auto">
                            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={uploading}>Cancelar</Button>
                            <Button onClick={handleSubmitDevolucion} disabled={uploading || (selectedTool?.estado_asignacion !== 'rechazada_en_revision' && files.length === 0)}>
                                {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {selectedTool?.estado_asignacion === 'rechazada_en_revision' ? 'Reenviar' : 'Enviar devolución'}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reassign Modal */}
            <ReassignToolModal
                isOpen={reassignModalOpen}
                onClose={() => setReassignModalOpen(false)}
                toolId={selectedTool?.herramienta_id}
                toolName={selectedTool?.tool_nombre}
                currentEmployeeId={sessionRole?.empleadoId}
            />
        </>
    );
};

export default MyToolsView;