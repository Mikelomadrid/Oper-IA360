import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Save, FileText, DollarSign, Search, Wrench, UploadCloud, CheckCircle2, XCircle, AlertTriangle, Eye, Image as ImageIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { fmtMadrid } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import FotoEvidencia from '@/components/FotoEvidencia';
import { useAuth } from '@/contexts/SupabaseAuthContext';

/* 
   FIX NOTE: 
   Logic updated to ensure ALL tools with status 'en_reparacion' appear in the list, 
   even if they are missing a corresponding entry in 'herramientas_reparacion_log' (orphaned state).
   
   The fetchRepairs function now:
   1. Fetches standard repairs from 'v_taller_reparacion_pendientes' view.
   2. Fetches all tools from 'herramientas' table where status is 'en_reparacion'.
   3. Merges them, identifying orphans (tools physically in repair but missing log).
   4. Orphaned items auto-generate a repair log when "Gestionar" is clicked to restore data consistency.
*/

// --- COMPONENTE: LISTADO DE REPARACIONES PENDIENTES ---
const RepairListView = ({ onSelect }) => {
    const [repairs, setRepairs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [processingOrphan, setProcessingOrphan] = useState(false);

    const fetchRepairs = async () => {
        setLoading(true);
        try {
            // 1. Fetch valid repairs from view (Normal case)
            const { data: viewData, error: viewError } = await supabase
                .from('v_taller_reparacion_pendientes')
                .select('*');

            if (viewError) throw viewError;

            // 2. Fetch ALL tools marked as 'en_reparacion' (To catch orphans like ALB-011)
            const { data: toolsData, error: toolsError } = await supabase
                .from('herramientas')
                .select('id, nombre, ref_almacen, estado, updated_at')
                .eq('estado', 'en_reparacion');

            if (toolsError) throw toolsError;

            // 3. Identify orphans: Tools in 'en_reparacion' but not present in the viewData (by tool ID)
            const validToolIds = new Set(viewData.map(r => r.herramienta_id));
            const orphanedTools = toolsData.filter(t => !validToolIds.has(t.id));

            // 4. Map orphans to match view structure
            const orphanedMapped = orphanedTools.map(t => {
                const daysDiff = t.updated_at
                    ? Math.floor((new Date() - new Date(t.updated_at)) / (1000 * 60 * 60 * 24))
                    : 0;

                return {
                    log_id: `orphan_${t.id}`, // Temporary ID
                    herramienta_id: t.id,
                    nombre_herramienta: t.nombre,
                    ref_almacen: t.ref_almacen,
                    fecha_envio: t.updated_at || new Date().toISOString(),
                    motivo_falla: '⚠️ Estado inconsistente (Sin registro de entrada)',
                    dias_en_taller: daysDiff,
                    is_orphaned: true // Flag to handle click specially
                };
            });

            // 5. Merge and Sort
            const combined = [...viewData, ...orphanedMapped].sort((a, b) =>
                new Date(a.fecha_envio) - new Date(b.fecha_envio)
            );

            setRepairs(combined);
        } catch (error) {
            console.error('Error fetching repairs:', error);
            toast({ variant: 'destructive', title: 'Error al cargar reparaciones', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRepairs();
    }, []);

    const handleManageClick = async (item) => {
        if (!item.is_orphaned) {
            onSelect(item.log_id);
            return;
        }

        // --- HANDLE ORPHAN REPAIR ---
        // Creates a log on the fly to allow management
        setProcessingOrphan(true);
        try {
            toast({ title: "Corrigiendo datos...", description: "Generando registro de reparación para herramienta huérfana." });

            // Get Current Employee ID
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No hay sesión de usuario activa");

            const { data: emp } = await supabase.from('empleados').select('id').eq('auth_user_id', user.id).single();
            if (!emp) throw new Error("Usuario no vinculado a un empleado");

            // Create Log
            const { data: newLog, error: insertError } = await supabase
                .from('herramientas_reparacion_log')
                .insert({
                    herramienta_id: item.herramienta_id,
                    sent_by_empleado_id: emp.id,
                    fecha_envio: new Date().toISOString(), // Assume now for log creation
                    motivo_falla: 'Corrección de estado inconsistente (Auto-generado)',
                    fotos_evidencia: []
                })
                .select()
                .single();

            if (insertError) throw insertError;

            // Proceed with new valid Log ID
            toast({ title: "Registro creado", description: "Se ha normalizado el estado de la herramienta." });
            onSelect(newLog.id);

        } catch (error) {
            console.error("Error creating orphan log:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo generar el log de reparación: " + error.message });
        } finally {
            setProcessingOrphan(false);
        }
    };

    const filteredRepairs = repairs.filter(r =>
        (r.nombre_herramienta || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.ref_almacen || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.motivo_falla || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Taller de Reparación</h2>
                    <p className="text-muted-foreground">Gestión de herramientas en estado de reparación o mantenimiento.</p>
                </div>
                <Button variant="outline" onClick={fetchRepairs} disabled={loading || processingOrphan}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wrench className="mr-2 h-4 w-4" />}
                    Actualizar Lista
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre, ref o motivo..."
                                className="pl-8"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0 sm:p-6 pt-0">
                    <div className="rounded-md border overflow-hidden">
                        <Table className="table-auto w-full">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-4">Herramienta</TableHead>
                                    <TableHead className="hidden md:table-cell">Referencia</TableHead>
                                    <TableHead className="hidden md:table-cell">Motivo Falla</TableHead>
                                    <TableHead className="hidden md:table-cell whitespace-nowrap">En Taller Desde</TableHead>
                                    <TableHead className="text-right">Días</TableHead>
                                    <TableHead className="text-right pr-4">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredRepairs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            No hay reparaciones pendientes.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRepairs.map((r) => (
                                        <TableRow key={r.log_id} className="group hover:bg-muted/50 transition-colors">
                                            <TableCell className="font-medium pl-4">
                                                <div className="flex items-center gap-2">
                                                    <Wrench className={`h-4 w-4 shrink-0 ${r.is_orphaned ? 'text-red-500' : 'text-orange-500'}`} />
                                                    <span className="truncate max-w-[120px] sm:max-w-none">
                                                        {r.nombre_herramienta}
                                                    </span>
                                                    {r.is_orphaned && (
                                                        <Badge variant="destructive" className="text-[10px] h-5 px-1">Sin Log</Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">{r.ref_almacen || 'N/A'}</TableCell>
                                            <TableCell className="hidden md:table-cell max-w-[200px] truncate" title={r.motivo_falla}>
                                                {r.motivo_falla || 'Sin especificar'}
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell whitespace-nowrap">{fmtMadrid(r.fecha_envio, 'date')}</TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant={r.dias_en_taller > 30 ? "destructive" : "secondary"}>
                                                    {r.dias_en_taller} días
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-4">
                                                <Button size="sm" onClick={() => handleManageClick(r)} disabled={processingOrphan}>
                                                    {processingOrphan && r.is_orphaned ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gestionar'}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

// --- COMPONENTE: DETALLE Y CIERRE DE REPARACIÓN ---
const RepairDetailView = ({ logId, onBack, onComplete }) => {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [detail, setDetail] = useState(null);
    const [proveedores, setProveedores] = useState([]);

    // Form state
    const [descripcion, setDescripcion] = useState('');
    const [costePiezas, setCostePiezas] = useState('');
    const [totalFactura, setTotalFactura] = useState('');
    const [proveedorId, setProveedorId] = useState('');
    const [facturaUrl, setFacturaUrl] = useState('');

    // Reparacion Foto State
    const [fotoReparacionUrl, setFotoReparacionUrl] = useState('');
    const [isUploadingFoto, setIsUploadingFoto] = useState(false);

    // Upload state (factura)
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // Cargar detalle del log
                const { data: logData, error: logError } = await supabase
                    .from('v_detalle_reparacion_log')
                    .select('*')
                    .eq('log_id', logId)
                    .single();

                if (logError) throw logError;
                setDetail(logData);

                // Cargar proveedores para el select
                const { data: provData, error: provError } = await supabase
                    .from('proveedores')
                    .select('id, nombre')
                    .eq('activo', true)
                    .order('nombre');

                if (provError) console.error('Error loading providers:', provError);
                else setProveedores(provData || []);

            } catch (err) {
                console.error(err);
                toast({ variant: 'destructive', title: 'Error cargando detalles', description: err.message });
                onBack();
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [logId, onBack]);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `reparaciones/${logId}_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('herramientas_docs')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('herramientas_docs')
                .getPublicUrl(fileName);

            setFacturaUrl(urlData.publicUrl);
            toast({ title: 'Factura subida correctamente' });
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Error subiendo factura', description: err.message });
        } finally {
            setIsUploading(false);
        }
    };

    const handleFotoReparacion = async (file) => {
        if (!file) {
            setFotoReparacionUrl('');
            return;
        }

        setIsUploadingFoto(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `reparaciones/final_${logId}_${Date.now()}.${fileExt}`;

            // Usamos el bucket 'herramientas_fotos' para la evidencia visual
            const { error: uploadError } = await supabase.storage
                .from('herramientas_fotos')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('herramientas_fotos')
                .getPublicUrl(fileName);

            setFotoReparacionUrl(urlData.publicUrl);
            toast({ title: 'Foto de reparación subida correctamente' });
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Error subiendo foto', description: err.message });
        } finally {
            setIsUploadingFoto(false);
        }
    };

    const handleSubmit = async () => {
        if (!descripcion.trim()) {
            toast({ variant: 'destructive', title: 'Falta descripción', description: 'Indica qué trabajos se realizaron.' });
            return;
        }

        setSubmitting(true);
        try {
            // Llamada al RPC para cerrar reparación
            const { error } = await supabase.rpc('rpc_complete_tool_repair', {
                p_log_id: logId,
                p_descripcion_reparacion: descripcion,
                p_coste_piezas: parseFloat(costePiezas) || 0,
                p_proveedor_id: proveedorId || null,
                p_factura_url: facturaUrl || null,
                p_total_factura: parseFloat(totalFactura) || 0,
                p_foto_reparacion_url: fotoReparacionUrl || null
            });

            if (error) throw error;

            toast({
                title: 'Reparación completada',
                description: 'La herramienta ha vuelto a estar operativa en stock.'
            });
            onComplete(); // Volver a la lista y refrescar
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Error al completar', description: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
        );
    }

    if (!detail) return null;

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Button variant="ghost" onClick={onBack} className="pl-0 hover:pl-2 transition-all">
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver al listado
            </Button>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* COLUMNA IZQ: INFO DE LA HERRAMIENTA */}
                <Card className="md:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle className="text-lg">Detalles Herramienta</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {detail.imagen_herramienta ? (
                            <div className="rounded-lg overflow-hidden border aspect-square bg-muted">
                                <img src={detail.imagen_herramienta} alt={detail.nombre_herramienta} className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="rounded-lg border aspect-square bg-muted flex items-center justify-center">
                                <Wrench className="w-16 h-16 text-muted-foreground/30" />
                            </div>
                        )}
                        <div>
                            <p className="text-sm text-muted-foreground font-semibold">Nombre</p>
                            <p className="text-lg font-bold">{detail.nombre_herramienta}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground font-semibold">Referencia</p>
                            <p>{detail.ref_almacen || 'Sin referencia'}</p>
                        </div>

                        {/* SECCIÓN DE LA INCIDENCIA / REPORTE */}
                        <div className="pt-4 border-t space-y-4">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm text-muted-foreground font-semibold">Motivo Reportado</p>
                                    <p className="text-sm italic">"{detail.motivo_falla}"</p>
                                </div>
                            </div>

                            {/* --- EVIDENCIA VISUAL (IMAGEN) --- */}
                            {detail.foto_evidencia_url && (
                                <div className="mt-2">
                                    <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                                        <ImageIcon className="w-3 h-3" /> Evidencia Visual:
                                    </p>
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <div className="relative group cursor-pointer rounded-lg overflow-hidden border border-border bg-muted/50 shadow-sm hover:ring-2 hover:ring-primary/50 transition-all">
                                                <img
                                                    src={detail.foto_evidencia_url}
                                                    alt="Evidencia de la avería"
                                                    className="w-full h-40 object-cover transition-transform duration-500 group-hover:scale-105"
                                                />
                                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200 backdrop-blur-[1px]">
                                                    <div className="bg-background/90 text-foreground px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 shadow-md transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                                        <Eye className="w-3.5 h-3.5" /> Ver completa
                                                    </div>
                                                </div>
                                            </div>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 border-none bg-transparent shadow-2xl">
                                            <div className="relative w-full h-full flex items-center justify-center bg-black/80 rounded-lg overflow-hidden">
                                                <img
                                                    src={detail.foto_evidencia_url}
                                                    alt="Evidencia completa"
                                                    className="max-w-full max-h-[85vh] object-contain"
                                                />
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            )}

                            <div className="space-y-1 pt-2">
                                <p className="text-xs text-muted-foreground">
                                    Enviada el: <span className="font-medium text-foreground">{fmtMadrid(detail.fecha_envio, 'datetime')}</span>
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Por: <span className="font-medium text-foreground">{detail.enviado_por || 'Desconocido'}</span>
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* COLUMNA DER: FORMULARIO DE CIERRE */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Completar Reparación</CardTitle>
                        <CardDescription>
                            Rellena los datos de la reparación para reincorporar la herramienta al stock operativo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        <div className="space-y-2">
                            <Label htmlFor="desc">Descripción de trabajos realizados <span className="text-red-500">*</span></Label>
                            <Textarea
                                id="desc"
                                placeholder="Ej: Se cambió el rodamiento principal y se engrasó..."
                                rows={4}
                                value={descripcion}
                                onChange={e => setDescripcion(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="prov">Proveedor / Taller</Label>
                                <Select value={proveedorId} onValueChange={setProveedorId}>
                                    <SelectTrigger id="prov">
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {proveedores.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="factura">Subir Factura / Albarán</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        onChange={handleFileUpload}
                                        accept="application/pdf,image/*"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full"
                                        disabled={isUploading}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UploadCloud className="w-4 h-4 mr-2" />}
                                        {facturaUrl ? 'Cambiar Archivo' : 'Subir Archivo'}
                                    </Button>
                                </div>
                                {facturaUrl && (
                                    <a href={facturaUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline block mt-1 truncate">
                                        Ver documento adjunto
                                    </a>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border">
                            <div className="space-y-2">
                                <Label htmlFor="coste_piezas" className="flex items-center gap-1">
                                    <DollarSign className="w-3 h-3" /> Coste Piezas
                                </Label>
                                <Input
                                    id="coste_piezas"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={costePiezas}
                                    onChange={e => setCostePiezas(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="total_factura" className="flex items-center gap-1">
                                    <DollarSign className="w-3 h-3" /> Total Factura
                                </Label>
                                <Input
                                    id="total_factura"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={totalFactura}
                                    onChange={e => setTotalFactura(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2 pt-2">
                            <FotoEvidencia
                                label="Foto de la Reparación (Opcional)"
                                onFotoCapturada={handleFotoReparacion}
                                currentFile={fotoReparacionUrl}
                                loading={isUploadingFoto}
                            />
                        </div>

                        <div className="pt-4 flex justify-end gap-3">
                            <Button variant="outline" onClick={onBack} disabled={submitting}>Cancelar</Button>
                            <Button onClick={handleSubmit} disabled={submitting || !descripcion.trim() || isUploadingFoto} className="bg-green-600 hover:bg-green-700 text-white">
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                Finalizar y Retornar a Stock
                            </Button>
                        </div>

                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---
const RepairWorkshopView = ({ navigate }) => {
    const [selectedLogId, setSelectedLogId] = useState(null);

    // Manejo del refresco automático al completar una reparación
    const handleComplete = () => {
        setSelectedLogId(null);
        // RepairListView se volverá a montar y fetching data de nuevo
    };

    return (
        <div className="p-6 w-full min-h-screen bg-background">
            {selectedLogId ? (
                <RepairDetailView
                    logId={selectedLogId}
                    onBack={() => setSelectedLogId(null)}
                    onComplete={handleComplete}
                />
            ) : (
                <RepairListView onSelect={setSelectedLogId} />
            )}
        </div>
    );
};

export default RepairWorkshopView;