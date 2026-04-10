import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
    Loader2, UploadCloud, Package, Wrench, CheckCircle2, List, LayoutGrid, Plus, Search, ArrowRightLeft, Camera, Clock
} from 'lucide-react';
import ReassignToolModal from '@/components/ReassignToolModal';
import ToolCrudModal from '@/components/ToolCrudModal';
import PhotoUploadModal from '@/components/PhotoUploadModal';

const MisHerramientas = ({ navigate }) => {
    const { sessionRole, empleadoId } = useAuth();

    const [tools, setTools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const canManage = useMemo(() => ['admin', 'encargado'].includes(sessionRole?.rol), [sessionRole]);
    const [actionLoading, setActionLoading] = useState(null);

    const [returnModalOpen, setReturnModalOpen] = useState(false);
    const [selectedToolForReturn, setSelectedToolForReturn] = useState(null);
    const [returnComment, setReturnComment] = useState('');

    // Photo Upload State for Returns
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState([]);

    const [reassignModalOpen, setReassignModalOpen] = useState(false);
    const [selectedToolForReassign, setSelectedToolForReassign] = useState(null);
    const [crudModalOpen, setCrudModalOpen] = useState(false);
    const [editingToolId, setEditingToolId] = useState(null);

    const fetchTools = useCallback(async () => {
        if (!sessionRole?.loaded || !empleadoId) { if (!empleadoId) { setLoading(false); setTools([]); } return; }
        setLoading(true);
        try {
            const { data, error } = await supabase.from('herramienta_asignaciones')
                .select(`*, herramientas (id, nombre, marca, modelo, foto_url, ref_almacen, categoria_id, estado)`)
                .eq('entregada_a', empleadoId)
                .in('estado', ['en_uso', 'pendiente_aceptacion', 'pendiente_revision', 'rechazada_en_revision'])
                .order('created_at', { ascending: false });
            if (error) throw error;
            setTools(data.map(item => ({
                asignacion_id: item.id,
                herramienta_id: item.herramienta_id,
                estado_asignacion: item.estado,
                created_at: item.created_at,
                comentario_ultimo_reenvio: item.comentario_ultimo_reenvio,
                proyecto_id: item.proyecto_id,
                devuelta_at: item.devuelta_at,
                tool_nombre: item.herramientas?.nombre || 'Desconocida',
                marca: item.herramientas?.marca,
                modelo: item.herramientas?.modelo,
                foto_url: item.herramientas?.foto_url,
                ref_almacen: item.herramientas?.ref_almacen,
                tool_estado: item.herramientas?.estado,
                categoria_id: item.herramientas?.categoria_id
            })));
        } catch (error) { toast({ variant: "destructive", title: "Error", description: "Fallo al cargar herramientas." }); }
        finally { setLoading(false); }
    }, [empleadoId, sessionRole?.loaded]);

    useEffect(() => { fetchTools(); }, [fetchTools, empleadoId]);

    const filteredTools = useMemo(() => tools.filter(t => t.tool_nombre.toLowerCase().includes(searchTerm.toLowerCase())), [tools, searchTerm]);

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

            const { error } = await supabase.rpc('aceptar_herramienta', { p_asignacion_id: tool.asignacion_id });
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

            toast({ title: "Aceptada", description: "Herramienta confirmada y stock actualizado." });
            fetchTools();
        } catch (e) { toast({ variant: "destructive", title: "Error", description: e.message }); }
        finally { setActionLoading(null); }
    };

    const handleRejectTool = async (tool) => {
        setActionLoading(tool.asignacion_id);
        try {
            const { error } = await supabase
                .from('herramienta_asignaciones')
                .delete()
                .eq('id', tool.asignacion_id);
            if (error) throw error;
            toast({ title: "Rechazada", description: "Asignación rechazada correctamente." });
            fetchTools();
        } catch (e) { toast({ variant: "destructive", title: "Error", description: e.message }); }
        finally { setActionLoading(null); }
    };

    const handleReturnClick = (tool) => {
        setSelectedToolForReturn(tool);
        setReturnComment('');
        setUploadedFiles([]);
        setReturnModalOpen(true);
    };

    const handleReturnPhotosSelected = (files) => {
        setUploadedFiles(prev => [...prev, ...files]);
        setIsUploadModalOpen(false);
    };

    const handleSubmitReturn = async () => {
        if (!selectedToolForReturn) return;

        // Enforce at least one photo
        if (uploadedFiles.length === 0) {
            toast({ variant: "destructive", title: "Fotos requeridas", description: "Debes subir al menos una foto del estado de la herramienta." });
            return;
        }

        setActionLoading(true);
        try {
            const assignmentId = selectedToolForReturn.asignacion_id;

            // 1. Upload Photos and Register Evidence
            for (const file of uploadedFiles) {
                const fileExt = file.name.split('.').pop();
                // Structured path: devoluciones/{assignmentId}/{timestamp}_{random}.{ext}
                const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
                const uploadPath = `devoluciones/${assignmentId}/${fileName}`;

                const { error: upErr } = await supabase.storage.from('herramientas_fotos').upload(uploadPath, file);
                if (upErr) throw upErr;

                // Save evidence record linking to assignment
                const { error: evidErr } = await supabase.rpc('rpc_registrar_evidencia_devolucion', {
                    p_asignacion_id: assignmentId,
                    p_url: uploadPath,
                    p_notas: 'Foto de devolución'
                });
                if (evidErr) throw evidErr;
            }

            // 2. Execute Return RPC (Updates status to 'pendiente_revision')
            const { error: rpcErr } = await supabase.rpc('rpc_tecnico_devuelve_herramienta', {
                p_asignacion_id: assignmentId,
                p_comentario: returnComment || null
            });
            if (rpcErr) throw rpcErr;

            toast({ title: "Solicitud Enviada", description: "La devolución ha sido enviada para revisión." });
            setReturnModalOpen(false);
            fetchTools();
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "Error", description: "Fallo al procesar devolución: " + e.message });
        } finally {
            setActionLoading(false);
        }
    };

    const getPublicUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        const { data } = supabase.storage.from('herramientas_fotos').getPublicUrl(path);
        return data?.publicUrl;
    };

    const renderStatusBadge = (estado) => (
        <Badge className={estado === 'en_uso' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-secondary text-secondary-foreground'}>
            {estado.replace(/_/g, ' ')}
        </Badge>
    );

    return (
        <div className="p-6 w-full space-y-6">
            <Helmet><title>Mis Herramientas | App</title></Helmet>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold flex items-center gap-2"><Wrench className="h-6 w-6" /> Mis Herramientas</h1>
                <div className="flex gap-2 w-full md:w-auto">
                    {canManage && <Button onClick={() => { setEditingToolId(null); setCrudModalOpen(true); }} className="flex-1 md:flex-none"><Plus className="mr-2 h-4 w-4" /> Nueva</Button>}
                    <div className="flex bg-muted rounded-lg p-1">
                        <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('grid')} className="h-8"><LayoutGrid className="h-4 w-4" /></Button>
                        <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('table')} className="h-8"><List className="h-4 w-4" /></Button>
                    </div>
                </div>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar herramienta..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>

            {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div> :
                tools.length === 0 ? <div className="text-center py-12 text-muted-foreground">No tienes herramientas asignadas.</div> :
                    viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredTools.map(item => (
                                <Card key={item.asignacion_id} className="flex flex-col overflow-hidden hover:shadow-md transition-shadow">
                                    <div className="h-48 bg-muted/30 flex items-center justify-center p-4 relative border-b">
                                        {item.foto_url ? (
                                            <img src={getPublicUrl(item.foto_url)} alt={item.tool_nombre} className="h-full w-full object-contain mix-blend-multiply" />
                                        ) : (
                                            <Package className="h-16 w-16 text-muted-foreground/30" />
                                        )}
                                        <div className="absolute top-2 right-2">{renderStatusBadge(item.estado_asignacion)}</div>
                                    </div>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="truncate text-lg">{item.tool_nombre}</CardTitle>
                                        <p className="text-xs text-muted-foreground truncate">{item.marca} {item.modelo}</p>
                                    </CardHeader>
                                    <CardContent className="py-2 flex-grow">
                                        <div className="text-xs text-muted-foreground space-y-1">
                                            <p>Ref: {item.ref_almacen || 'N/A'}</p>
                                            {item.comentario_ultimo_reenvio && (
                                                <p className="text-red-500 font-medium mt-2 bg-red-50 p-2 rounded">
                                                    ⚠️ Nota rechazo: {item.comentario_ultimo_reenvio}
                                                </p>
                                            )}
                                        </div>
                                    </CardContent>
                                    <CardFooter className="pt-2 gap-2 border-t bg-muted/10 p-4">
                                        {item.estado_asignacion === 'pendiente_aceptacion' ? (
                                            <div className="flex gap-2 w-full">
                                                <Button className="flex-1 px-2" onClick={() => handleAcceptTool(item)} disabled={actionLoading === item.asignacion_id}>
                                                    {actionLoading === item.asignacion_id ? <Loader2 className="animate-spin mr-1 h-4 w-4" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
                                                    Confirmar
                                                </Button>
                                                <Button variant="destructive" className="flex-1 px-2" onClick={() => handleRejectTool(item)} disabled={actionLoading === item.asignacion_id}>
                                                    Rechazar
                                                </Button>
                                            </div>
                                        ) : item.estado_asignacion === 'en_uso' || item.estado_asignacion === 'rechazada_en_revision' ? (
                                            <>
                                                <Button className="flex-1" variant="secondary" onClick={() => handleReturnClick(item)}>
                                                    Devolver
                                                </Button>
                                                <Button className="w-10 px-0" variant="outline" title="Traspasar" onClick={() => { setSelectedToolForReassign(item); setReassignModalOpen(true); }}>
                                                    <ArrowRightLeft className="h-4 w-4" />
                                                </Button>
                                            </>
                                        ) : (
                                            <Button disabled variant="outline" className="w-full opacity-70">
                                                <Clock className="mr-2 h-4 w-4" /> En Revisión
                                            </Button>
                                        )}
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="border rounded-md overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Herramienta</TableHead>
                                        <TableHead>Marca/Modelo</TableHead>
                                        <TableHead>Ref</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredTools.map(item => (
                                        <TableRow key={item.asignacion_id}>
                                            <TableCell className="font-medium">{item.tool_nombre}</TableCell>
                                            <TableCell>{item.marca} {item.modelo}</TableCell>
                                            <TableCell>{item.ref_almacen}</TableCell>
                                            <TableCell>{renderStatusBadge(item.estado_asignacion)}</TableCell>
                                            <TableCell className="text-right">
                                                {item.estado_asignacion === 'pendiente_aceptacion' ? (
                                                    <div className="flex justify-end gap-2">
                                                        <Button size="sm" onClick={() => handleAcceptTool(item)} disabled={actionLoading === item.asignacion_id}>
                                                            Aceptar
                                                        </Button>
                                                        <Button size="sm" variant="destructive" onClick={() => handleRejectTool(item)} disabled={actionLoading === item.asignacion_id}>
                                                            Rechazar
                                                        </Button>
                                                    </div>
                                                ) : item.estado_asignacion === 'en_uso' || item.estado_asignacion === 'rechazada_en_revision' ? (
                                                    <div className="flex justify-end gap-2">
                                                        <Button size="sm" variant="secondary" onClick={() => handleReturnClick(item)}>Devolver</Button>
                                                        <Button size="sm" variant="ghost" onClick={() => { setSelectedToolForReassign(item); setReassignModalOpen(true); }}><ArrowRightLeft className="h-4 w-4" /></Button>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground italic">En proceso</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )
            }

            {/* Return Modal */}
            <Dialog open={returnModalOpen} onOpenChange={setReturnModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Devolver Herramienta</DialogTitle>
                        <DialogDescription>
                            Para completar la devolución de <strong>{selectedToolForReturn?.tool_nombre}</strong>, debes subir fotos del estado actual.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div
                            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${uploadedFiles.length > 0 ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-muted-foreground/30 hover:bg-muted/50'}`}
                            onClick={() => setIsUploadModalOpen(true)}
                        >
                            {uploadedFiles.length > 0 ? (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="h-12 w-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                        <CheckCircle2 className="h-6 w-6" />
                                    </div>
                                    <p className="font-medium text-green-700 dark:text-green-400">{uploadedFiles.length} foto(s) lista(s)</p>
                                    <p className="text-xs text-muted-foreground">Clic para añadir más</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                                        <Camera className="h-6 w-6" />
                                    </div>
                                    <p className="font-medium">Subir Fotos (Obligatorio)</p>
                                    <p className="text-xs">Cámara o Galería</p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Observaciones (Opcional)</Label>
                            <Textarea
                                placeholder="Indica si hay desperfectos o incidencias..."
                                value={returnComment}
                                onChange={e => setReturnComment(e.target.value)}
                                className="resize-none"
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setReturnModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSubmitReturn} disabled={actionLoading || uploadedFiles.length === 0}>
                            {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Solicitar Devolución
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <PhotoUploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onPhotosSelected={handleReturnPhotosSelected}
                title="Evidencia de Devolución"
            />

            <ReassignToolModal
                isOpen={reassignModalOpen}
                onClose={() => setReassignModalOpen(false)}
                toolId={selectedToolForReassign?.herramienta_id}
                toolName={selectedToolForReassign?.tool_nombre}
                currentEmployeeId={empleadoId}
            />

            <ToolCrudModal
                isOpen={crudModalOpen}
                onClose={() => setCrudModalOpen(false)}
                onSuccess={fetchTools}
                toolId={editingToolId}
            />
        </div>
    );
};

export default MisHerramientas;