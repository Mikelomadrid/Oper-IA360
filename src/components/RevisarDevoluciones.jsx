import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, User, Briefcase, CalendarDays, Image as ImageIcon, PackageOpen, Wrench, RefreshCw, ExternalLink, AlertTriangle, ArrowRight } from 'lucide-react';
import { fmtMadrid } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';
import { useViewMode } from '@/hooks/useViewMode';
import { ViewToggle } from '@/components/ui/ViewToggle';

const EvidenceImage = ({ pathOrUrl, alt, className, onClick }) => {
    const [src, setSrc] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const resolve = async () => {
            if (!pathOrUrl) {
                if (isMounted) { setSrc(null); setLoading(false); }
                return;
            }

            if (pathOrUrl.startsWith('blob:') || pathOrUrl.startsWith('data:')) {
                if (isMounted) { setSrc(pathOrUrl); setLoading(false); }
                return;
            }

            setLoading(true);
            setError(false);

            try {
                let finalUrl = pathOrUrl;
                const BUCKET_NAME = 'herramientas_fotos';

                // Simple heuristic to check if it's a storage path or full URL
                if (!pathOrUrl.startsWith('http')) {
                    // Remove bucket name if present in path to avoid duplication
                    let cleanPath = pathOrUrl.replace(/^\/+/, '').replace(new RegExp(`^${BUCKET_NAME}/`), '');

                    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(cleanPath);
                    if (data?.publicUrl) finalUrl = data.publicUrl;
                }

                if (isMounted) setSrc(finalUrl);
            } catch (e) {
                console.error("Error resolving image:", e);
                if (isMounted) setSrc(pathOrUrl);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        resolve();
        return () => { isMounted = false; };
    }, [pathOrUrl]);

    if (loading) {
        return (
            <div className={`flex items-center justify-center bg-muted animate-pulse rounded-md ${className}`}>
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/50" />
            </div>
        );
    }

    if ((error || !src) && !loading) {
        return (
            <div className={`flex items-center justify-center bg-destructive/5 border border-destructive/20 rounded-md ${className}`} title="Error cargando imagen">
                <ImageIcon className="w-4 h-4 text-destructive/40" />
            </div>
        );
    }

    return (
        <div className="relative group w-full h-full overflow-hidden rounded-md">
            <img
                src={src}
                alt={alt || "Evidencia"}
                className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer ${className}`}
                onClick={() => onClick && onClick(src)}
                onError={() => setError(true)}
            />
        </div>
    );
};

const RevisarDevoluciones = () => {
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(true);
    const { viewMode, setViewMode } = useViewMode('revisar_devoluciones', 'list');

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedReturn, setSelectedReturn] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [processing, setProcessing] = useState(false);
    const [zoomImage, setZoomImage] = useState(null);

    const [searchParams, setSearchParams] = useSearchParams();

    const fetchReturns = async () => {
        setLoading(true);
        try {
            // We fetch from the table directly to get nested relations easily
            const { data, error } = await supabase
                .from('herramienta_asignaciones')
                .select(`
                    *,
                    herramientas (
                        nombre, marca, modelo, foto_url, ref_almacen
                    ),
                    empleados!entregada_a (
                        nombre, apellidos
                    ),
                    proyectos (
                        nombre_proyecto
                    ),
                    herramienta_evidencias (
                        id, url, tipo, created_at, notas
                    )
                `)
                .eq('estado', 'pendiente_revision')
                .order('devuelta_at', { ascending: false });

            if (error) throw error;
            setReturns(data || []);
        } catch (error) {
            console.error("Error fetching returns:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar las devoluciones." });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReturns();
    }, []);

    // Effect to auto-open modal based on URL param
    useEffect(() => {
        const idFromUrl = searchParams.get('id');
        if (idFromUrl && returns.length > 0 && !modalOpen && !selectedReturn) {
            const target = returns.find(r => r.id === idFromUrl);
            if (target) {
                handleReviewClick(target);
            }
        }
    }, [returns, searchParams, modalOpen, selectedReturn]);

    const handleReviewClick = (ret) => {
        setSelectedReturn(ret);
        setRejectReason('');
        setModalOpen(true);
    };

    const handleAccept = async () => {
        if (!selectedReturn) return;
        if (!window.confirm("¿Aceptar devolución y retornar herramienta al stock?")) return;

        setProcessing(true);
        try {
            const { error } = await supabase.rpc('rpc_encargado_acepta_devolucion', {
                p_asignacion_id: selectedReturn.id
            });

            if (error) throw error;

            // Increment stock
            if (selectedReturn.herramienta_id) {
                const { data: toolData } = await supabase
                    .from('herramientas')
                    .select('unidades_disponibles')
                    .eq('id', selectedReturn.herramienta_id)
                    .single();

                if (toolData) {
                    await supabase
                        .from('herramientas')
                        .update({ unidades_disponibles: toolData.unidades_disponibles + 1 })
                        .eq('id', selectedReturn.herramienta_id);
                }
            }

            toast({ title: "Devolución aceptada", description: "Herramienta retornada al stock.", className: "bg-green-600 text-white" });
            setModalOpen(false);

            // Clear URL param if we just processed that specific return
            if (searchParams.get('id') === selectedReturn.id) {
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('id');
                newParams.delete('empleado_id');
                setSearchParams(newParams);
            }

            fetchReturns();
        } catch (error) {
            console.error("Error accepting:", error);
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!selectedReturn) return;
        if (!rejectReason.trim()) {
            toast({ variant: "destructive", title: "Falta motivo", description: "Indica el motivo del rechazo." });
            return;
        }

        setProcessing(true);
        try {
            const { error } = await supabase.rpc('rpc_encargado_rechaza_devolucion', {
                p_asignacion_id: selectedReturn.id,
                p_motivo: rejectReason
            });

            if (error) throw error;

            toast({ title: "Devolución rechazada", description: "Se ha notificado al técnico." });
            setModalOpen(false);

            // Clear URL param
            if (searchParams.get('id') === selectedReturn.id) {
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('id');
                newParams.delete('empleado_id');
                setSearchParams(newParams);
            }

            fetchReturns();
        } catch (error) {
            console.error("Error rejecting:", error);
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setProcessing(false);
        }
    };

    const getEvidences = (ret, type) => {
        if (!ret) return [];
        const list = ret.herramienta_evidencias || [];
        const filtered = list.filter(e => e.tipo === type);

        // Fallback for legacy paths if no evidence records exist
        if (type === 'devolucion' && filtered.length === 0 && ret.foto_devolucion_path) {
            return [{ url: ret.foto_devolucion_path, notes: 'Foto Devolución (Legacy)' }];
        }
        if (type === 'entrega' && filtered.length === 0 && ret.foto_entrega_path) {
            return [{ url: ret.foto_entrega_path, notes: 'Foto Entrega (Legacy)' }];
        }
        return filtered;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight">Devoluciones Pendientes</h2>
                    <p className="text-sm text-muted-foreground">Revisión de evidencias y validación de retorno al stock.</p>
                </div>
                <div className="flex items-center gap-3">
                    <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                    <Button variant="outline" size="sm" onClick={fetchReturns} disabled={loading} className="gap-2">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : returns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/10">
                    <CheckCircle className="w-12 h-12 mb-3 text-green-500/50" />
                    <h3 className="text-lg font-medium">Todo al día</h3>
                    <p className="text-muted-foreground">No hay devoluciones pendientes de revisión.</p>
                </div>
            ) : viewMode === 'list' ? (
                <div className="border rounded-md bg-card shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Herramienta</TableHead>
                                    <TableHead>Técnico</TableHead>
                                    <TableHead>Proyecto</TableHead>
                                    <TableHead>Fecha Devolución</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {returns.map((ret) => (
                                    <TableRow key={ret.id} className={searchParams.get('id') === ret.id ? "bg-muted/50" : ""}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded bg-muted border shrink-0 overflow-hidden">
                                                    {ret.herramientas?.foto_url ? (
                                                        <img src={ret.herramientas.foto_url} className="h-full w-full object-cover" alt="Tool" />
                                                    ) : (
                                                        <div className="h-full w-full flex items-center justify-center"><Wrench className="w-4 h-4 text-muted-foreground" /></div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-medium">{ret.herramientas?.nombre}</div>
                                                    <div className="text-xs text-muted-foreground">{ret.herramientas?.marca} {ret.herramientas?.modelo}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <User className="w-3 h-3 text-muted-foreground" />
                                                <span>{ret.empleados?.nombre} {ret.empleados?.apellidos}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Briefcase className="w-3 h-3" />
                                                <span className="truncate max-w-[150px]">{ret.proyectos?.nombre_proyecto || 'General'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <CalendarDays className="w-3 h-3" />
                                                <span>{fmtMadrid(ret.devuelta_at)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                size="sm"
                                                onClick={() => handleReviewClick(ret)}
                                                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                                            >
                                                <ImageIcon className="w-4 h-4" />
                                                Revisar
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {returns.map((ret) => (
                        <Card key={ret.id} className={`overflow-hidden hover:shadow-lg transition-shadow cursor-pointer ${searchParams.get('id') === ret.id ? "ring-2 ring-primary" : ""}`} onClick={() => handleReviewClick(ret)}>
                            <div className="aspect-video w-full bg-muted relative">
                                {ret.herramientas?.foto_url ? (
                                    <img src={ret.herramientas.foto_url} className="h-full w-full object-cover" alt="Tool" />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center flex-col gap-2 text-muted-foreground">
                                        <Wrench className="w-8 h-8" />
                                        <span className="text-xs">Sin imagen</span>
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 bg-black/70 text-white text-[10px] px-2 py-1 rounded-full">
                                    {ret.herramientas?.ref_almacen}
                                </div>
                            </div>
                            <CardHeader className="p-4 pb-2">
                                <h3 className="font-semibold text-sm truncate" title={ret.herramientas?.nombre}>{ret.herramientas?.nombre}</h3>
                                <p className="text-xs text-muted-foreground">{ret.herramientas?.marca} {ret.herramientas?.modelo}</p>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 space-y-2 text-sm">
                                <div className="flex items-center gap-2 pt-2">
                                    <User className="w-3 h-3 text-muted-foreground" />
                                    <span className="truncate">{ret.empleados?.nombre} {ret.empleados?.apellidos}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <CalendarDays className="w-3 h-3" />
                                    <span>{fmtMadrid(ret.devuelta_at)}</span>
                                </div>
                            </CardContent>
                            <CardFooter className="p-3 bg-muted/20 border-t flex justify-end">
                                <Button size="sm" className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                                    <ImageIcon className="w-3 h-3" /> Revisar Evidencias
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Validar Devolución</DialogTitle>
                        <DialogDescription>
                            Revisa las fotos de entrega y devolución para asegurar el estado de la herramienta.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedReturn && (
                        <div className="space-y-6 py-4 flex-1">

                            <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3 rounded border">
                                <div>
                                    <Label className="text-xs text-muted-foreground">Herramienta</Label>
                                    <p className="font-medium text-sm">{selectedReturn.herramientas?.nombre}</p>
                                    <p className="text-xs text-muted-foreground">{selectedReturn.herramientas?.marca} - {selectedReturn.herramientas?.ref_almacen}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Devuelto por</Label>
                                    <p className="font-medium text-sm">{selectedReturn.empleados?.nombre} {selectedReturn.empleados?.apellidos}</p>
                                    <p className="text-xs text-muted-foreground">{fmtMadrid(selectedReturn.devuelta_at)}</p>
                                </div>
                            </div>

                            {selectedReturn.comentario_ultimo_reenvio && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-3 rounded text-sm">
                                    <span className="font-semibold text-blue-700 dark:text-blue-300 block text-xs mb-1">Nota del Técnico:</span>
                                    "{selectedReturn.comentario_ultimo_reenvio}"
                                </div>
                            )}

                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2 text-muted-foreground font-semibold border-b pb-1">
                                        <span className="w-2 h-2 rounded-full bg-gray-400"></span> Estado Original (Entrega)
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2 min-h-[100px] content-start">
                                        {getEvidences(selectedReturn, 'entrega').length > 0 ? (
                                            getEvidences(selectedReturn, 'entrega').map((ev, i) => (
                                                <div key={i} className="aspect-square rounded border bg-muted">
                                                    <EvidenceImage pathOrUrl={ev.url} onClick={setZoomImage} />
                                                </div>
                                            ))
                                        ) : (
                                            <div className="col-span-2 h-24 flex items-center justify-center text-xs text-muted-foreground bg-muted/20 rounded border border-dashed">
                                                Sin fotos de entrega
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2 text-primary font-semibold border-b pb-1">
                                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span> Estado Actual (Devolución)
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2 min-h-[100px] content-start">
                                        {getEvidences(selectedReturn, 'devolucion').length > 0 ? (
                                            getEvidences(selectedReturn, 'devolucion').map((ev, i) => (
                                                <div key={i} className="aspect-square rounded border ring-2 ring-primary/20 bg-muted">
                                                    <EvidenceImage pathOrUrl={ev.url} onClick={setZoomImage} />
                                                </div>
                                            ))
                                        ) : (
                                            <div className="col-span-2 h-24 flex items-center justify-center text-xs text-destructive font-medium bg-destructive/5 rounded border border-dashed border-destructive/30">
                                                <AlertTriangle className="w-4 h-4 mr-2" /> Sin fotos de devolución
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t space-y-4">
                                <div className="space-y-2">
                                    <Label>Motivo de rechazo (Solo si rechazas)</Label>
                                    <Textarea
                                        placeholder="Ej: La herramienta está muy sucia o dañada..."
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <Button
                                        variant="destructive"
                                        className="flex-1 gap-2"
                                        onClick={handleReject}
                                        disabled={processing || !rejectReason.trim()}
                                    >
                                        <XCircle className="w-4 h-4" /> Rechazar Devolución
                                    </Button>
                                    <Button
                                        className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
                                        onClick={handleAccept}
                                        disabled={processing}
                                    >
                                        {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                        Aceptar y Cerrar
                                    </Button>
                                </div>
                            </div>

                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={processing}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
                <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/90 border-none">
                    <div className="relative flex items-center justify-center w-full h-full min-h-[50vh]">
                        {zoomImage && (
                            <>
                                <img src={zoomImage} className="max-w-full max-h-[90vh] object-contain" alt="Zoom" />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 text-white hover:bg-white/20 rounded-full"
                                    onClick={() => setZoomImage(null)}
                                >
                                    <XCircle className="w-8 h-8" />
                                </Button>
                                <a
                                    href={zoomImage}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="absolute bottom-4 right-4 text-white/70 text-xs hover:text-white flex items-center gap-1 bg-black/50 px-3 py-1 rounded-full"
                                >
                                    <ExternalLink className="w-3 h-3" /> Abrir original
                                </a>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default RevisarDevoluciones;