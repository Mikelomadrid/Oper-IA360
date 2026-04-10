import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Clock, Inbox, Loader2, Send, ServerCrash, User, ChevronDown, GalleryHorizontal } from 'lucide-react';
import { fmtMadrid } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const DevolverTareaModal = ({ isOpen, onClose, onSubmit }) => {
    const [motivo, setMotivo] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!motivo.trim()) {
            toast({ variant: 'destructive', title: 'Motivo requerido', description: 'Debes explicar por qué devuelves la tarea.' });
            return;
        }
        setIsSubmitting(true);
        await onSubmit(motivo);
        setIsSubmitting(false);
        setMotivo('');
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Devolver Tarea</DialogTitle>
                    <DialogDescription>
                        Explica al técnico los motivos para devolver la tarea. Esto le ayudará a corregir lo necesario.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Textarea
                        placeholder="Ej: Faltan fotos de la instalación eléctrica terminada en la subtarea 2..."
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        rows={4}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Devolviendo...</> : 'Devolver Tarea'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const EvidenciasViewer = ({ tareaId, onImageClick }) => {
    const [evidencias, setEvidencias] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEvidencias = async () => {
            if (!tareaId) return;
            setLoading(true);
            const { data, error } = await supabase.rpc('get_evidencias_por_subtarea', { p_tarea_id: tareaId });

            if (error) {
                toast({ variant: 'destructive', title: 'Error al cargar evidencias', description: error.message });
                setEvidencias([]);
            } else {
                const grouped = data.reduce((acc, curr) => {
                    const key = curr.descripcion_subtarea;
                    if (!acc[key]) {
                        acc[key] = [];
                    }
                    if (curr.archivo_url) {
                        const { data: { publicUrl } } = supabase.storage.from('proyecto_fotos').getPublicUrl(curr.archivo_url);
                        acc[key].push({ ...curr, publicUrl });
                    }
                    return acc;
                }, {});
                setEvidencias(Object.entries(grouped));
            }
            setLoading(false);
        };
        fetchEvidencias();
    }, [tareaId]);

    if (loading) {
        return <div className="flex items-center gap-2 text-muted-foreground p-4"><Loader2 className="h-4 w-4 animate-spin" /> Cargando evidencias...</div>;
    }

    if (evidencias.length === 0) {
        return <div className="p-4 text-center text-muted-foreground">No se han subido evidencias para esta tarea.</div>
    }

    return (
        <div className="p-4 space-y-4 bg-muted/50 rounded-lg">
            {evidencias.map(([subtarea, archivos]) => (
                <div key={subtarea}>
                    <h4 className="font-semibold text-sm mb-2">{subtarea}</h4>
                    {archivos && archivos.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {archivos.map(ev => (
                                <div
                                    key={ev.archivo_url}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        onImageClick(ev.publicUrl);
                                    }}
                                    className="block relative aspect-square group rounded-md overflow-hidden cursor-pointer bg-slate-100"
                                >
                                    <img src={ev.publicUrl} alt={`Evidencia de ${subtarea}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />

                                    {/* Capa de hover forzada a ser siempre clickeable y visible encima de la imagen */}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 z-10 pointer-events-none">
                                        <GalleryHorizontal className="text-white w-8 h-8 mb-2" />
                                        <p className="text-white font-medium text-xs text-center">{fmtMadrid(ev.fecha_subida)}</p>
                                        <p className="text-white/80 font-semibold text-[10px] mt-1 bg-black/40 px-2 py-1 rounded-full uppercase tracking-wider">Ver Imagen</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-xs text-muted-foreground italic">No hay evidencias para esta subtarea.</p>}
                </div>
            ))}
        </div>
    );
};

const TareasRevision = () => {
    const [tareas, setTareas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modalState, setModalState] = useState({ isOpen: false, tarea: null });
    const [actionLoading, setActionLoading] = useState(null); // tareaId
    const [selectedImage, setSelectedImage] = useState(null);

    const fetchTareas = useCallback(async () => {
        setLoading(true);
        setError(null);
        const { data, error: fetchError } = await supabase.rpc('get_tareas_para_revision');
        if (fetchError) {
            setError(fetchError);
            toast({ variant: 'destructive', title: 'Error al cargar tareas', description: fetchError.message });
        } else {
            setTareas(data || []);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchTareas();
        const channel = supabase.channel('realtime:public:tareas_revision')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas', filter: 'estado=eq.pendiente_revision' }, () => fetchTareas())
            .subscribe();
        return () => { supabase.removeChannel(channel) };
    }, [fetchTareas]);

    const handleAction = async (tareaId, aprobada, comentario) => {
        setActionLoading(tareaId);
        const { error: rpcError } = await supabase.rpc('validar_tarea', {
            p_tarea_id: tareaId,
            p_aprobada: aprobada,
            p_comentario: comentario,
        });

        if (rpcError) {
            toast({ variant: 'destructive', title: `Error al ${aprobada ? 'validar' : 'devolver'}`, description: rpcError.message });
        } else {
            toast({ title: `Tarea ${aprobada ? 'validada' : 'devuelta'} con éxito` });
            setTareas(prev => prev.filter(t => t.tarea_id !== tareaId));
        }
        setActionLoading(null);
    };

    if (loading) {
        return <div className="flex items-center justify-center p-8 h-full"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>;
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg m-8 border-destructive/50">
                <ServerCrash className="w-16 h-16 text-destructive" />
                <h2 className="text-2xl font-bold">Error</h2>
                <p className="text-muted-foreground mb-4">{error.message}</p>
                <Button onClick={fetchTareas}>Reintentar</Button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-6">
                <CheckCircle className="w-8 h-8 text-primary" />
                <h1 className="text-3xl font-bold">Tareas Pendientes de Revisión</h1>
            </motion.div>

            <AnimatePresence>
                {tareas.length > 0 ? (
                    <div className="space-y-4">
                        {tareas.map((tarea) => (
                            <Collapsible key={tarea.tarea_id} asChild>
                                <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                    <Card>
                                        <CollapsibleTrigger className="w-full">
                                            <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50 rounded-t-lg p-4">
                                                <div className="text-left">
                                                    <CardTitle className="text-lg">{tarea.titulo}</CardTitle>
                                                    <div className="text-sm text-muted-foreground flex items-center gap-4 mt-1">
                                                        <span>{tarea.nombre_proyecto}</span>
                                                        <span className="flex items-center gap-1.5"><User className="h-3 w-3" /> {tarea.tecnico || 'N/A'}</span>
                                                        <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {fmtMadrid(tarea.fecha_completada)}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <Badge variant={tarea.hechas === tarea.total ? "default" : "secondary"}>{tarea.hechas}/{tarea.total} subtareas</Badge>
                                                    <ChevronDown className="h-5 w-5 transition-transform duration-300 [&[data-state=open]]:-rotate-180" />
                                                </div>
                                            </CardHeader>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent asChild>
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                                                <CardContent className="p-0">
                                                    <EvidenciasViewer
                                                        tareaId={tarea.tarea_id}
                                                        onImageClick={(url) => setSelectedImage(url)}
                                                    />
                                                </CardContent>
                                                <CardFooter className="bg-muted/20 p-2 justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => setModalState({ isOpen: true, tarea })}
                                                        disabled={actionLoading === tarea.tarea_id}
                                                    >
                                                        <Send className="h-4 w-4 mr-2 -rotate-90" /> Devolver
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleAction(tarea.tarea_id, true, null)}
                                                        disabled={actionLoading === tarea.tarea_id}
                                                    >
                                                        {actionLoading === tarea.tarea_id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                                                        Validar Tarea
                                                    </Button>
                                                </CardFooter>
                                            </motion.div>
                                        </CollapsibleContent>
                                    </Card>
                                </motion.div>
                            </Collapsible>
                        ))}
                    </div>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-lg border border-dashed mt-8">
                        <Inbox className="w-20 h-20 text-primary/50 mb-4" />
                        <h3 className="text-xl font-semibold">¡Bandeja vacía!</h3>
                        <p className="text-muted-foreground mt-2">No hay tareas pendientes de revisión por el momento.</p>
                    </motion.div>
                )}
            </AnimatePresence>

            <DevolverTareaModal
                isOpen={modalState.isOpen}
                onClose={() => setModalState({ isOpen: false, tarea: null })}
                onSubmit={(motivo) => handleAction(modalState.tarea.tarea_id, false, motivo)}
            />

            {/* Lightbox / Visor a pantalla completa extraído para evitar problemas de z-index y clipping */}
            <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
                <DialogContent className="max-w-5xl p-2 bg-black/95 border-none shadow-2xl overflow-hidden rounded-xl flex items-center justify-center z-[10000]">
                    <DialogTitle className="sr-only">Previsualización de Foto</DialogTitle>
                    {selectedImage && (
                        <img
                            src={selectedImage}
                            alt="Evidencia a tamaño completo"
                            className="w-full h-auto max-h-[85vh] object-contain rounded-lg pointer-events-none"
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default TareasRevision;