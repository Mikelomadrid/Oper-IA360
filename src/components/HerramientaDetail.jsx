import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ServerCrash, ArrowLeft, FileText, Pencil, Wrench, UploadCloud, Send, UserPlus, Package, Clock, CheckCircle2, Calendar, Euro, Box, History } from 'lucide-react';
import { fmtMadrid } from '@/lib/utils';

// Modals
import SolicitudHerramientaModal from '@/components/SolicitudHerramientaModal';
import ToolCrudModal from '@/components/ToolCrudModal';
import RepairToolModal from '@/components/RepairToolModal';
import RepairHistoryModal from '@/components/RepairHistoryModal';
import ToolAssignmentModal from '@/components/ToolAssignmentModal';

// --- HELPERS PARA IMÁGENES ---
const normalizeHerramientaPath = (foto_path) => {
  if (!foto_path) return null;
  const pref = 'herramienta_fotos/';
  return foto_path.startsWith(pref) ? foto_path.slice(pref.length) : foto_path;
};

const signedFotoUrl = async (foto_path) => {
  const p = normalizeHerramientaPath(foto_path);
  if (!p) return null;
  const { data, error } = await supabase.storage
    .from('herramienta_fotos')
    .createSignedUrl(p, 3600);
  if (error) {
      console.warn(`Could not get signed URL for ${p}:`, error.message);
      return null;
  }
  return data.signedUrl;
};

// --- COMPONENTE SUBIDA FOTOS ---
const FotoUploader = ({ herramientaId, onUploadComplete }) => {
    const [isUploading, setIsUploading] = useState(false);
    const inputRef = useRef(null);

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            toast({ variant: 'destructive', title: 'La imagen supera 10 MB' });
            return;
        }

        setIsUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${herramientaId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        try {
            const { error: upErr } = await supabase.storage
                .from('herramientas_fotos')
                .upload(fileName, file, { cacheControl: '3600', upsert: true });
            
            if (upErr) throw upErr;

            const { data } = supabase.storage.from('herramientas_fotos').getPublicUrl(fileName);
            const publicUrl = data.publicUrl;

            const { error: updateErr } = await supabase
                .from('herramientas')
                .update({ foto_url: publicUrl, foto_path: null }) 
                .eq('id', herramientaId);

            if (updateErr) throw updateErr;

            toast({ title: 'Foto actualizada correctamente' });
            onUploadComplete();
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error al subir foto', description: error.message });
        } finally {
            setIsUploading(false);
            if (inputRef.current) {
                inputRef.current.value = "";
            }
        }
    };

    return (
        <>
            <input type="file" ref={inputRef} onChange={handleFileChange} accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" />
            <Button onClick={() => inputRef.current?.click()} disabled={isUploading} variant="secondary" className="w-full mt-2">
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                Cambiar Foto
            </Button>
        </>
    );
};

// --- COMPONENTE PRINCIPAL ---
const HerramientaDetail = ({ herramientaId, navigate, categoryId }) => {
    const [tool, setTool] = useState(null);
    const [historial, setHistorial] = useState([]);
    const [fotoUrl, setFotoUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [historialError, setHistorialError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Modales
    const [isSolicitudModalOpen, setIsSolicitudModalOpen] = useState(false);
    const [isCrudModalOpen, setIsCrudModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
    const [isRepairHistoryModalOpen, setIsRepairHistoryModalOpen] = useState(false);

    const { sessionRole } = useAuth();
    
    const canManage = useMemo(() => sessionRole.rol === 'admin' || sessionRole.rol === 'encargado', [sessionRole.rol]);
    const isTecnico = useMemo(() => sessionRole.rol === 'tecnico', [sessionRole.rol]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        setHistorialError(null);
        try {
            const toolPromise = supabase
                .from('herramientas')
                .select('*, categoria:categorias_herramienta(nombre)')
                .eq('id', herramientaId)
                .single();

            const historyPromise = supabase.rpc('get_herramienta_asignaciones_historial', {
                p_herramienta_id: herramientaId
            });

            const [toolResult, historyResult] = await Promise.all([toolPromise, historyPromise]);

            const { data: toolData, error: toolError } = toolResult;
            if (toolError) throw toolError;
            if (!toolData) throw new Error('Herramienta no encontrada.');
            setTool(toolData);

            let finalImageUrl = toolData.foto_url;
            if (!finalImageUrl && toolData.foto_path) {
                 finalImageUrl = await signedFotoUrl(toolData.foto_path);
            }
            setFotoUrl(finalImageUrl);
            
            const { data: historyData, error: historyError } = historyResult;
            if (historyError) {
                console.error("Error fetching history:", historyError);
                setHistorialError(historyError);
            } else {
                setHistorial(historyData || []);
            }

        } catch (err) {
            setError(err);
            toast({ variant: 'destructive', title: 'Error al cargar la herramienta', description: err.message });
        } finally {
            setLoading(false);
        }
    }, [herramientaId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const openFichaTecnica = async () => {
        if (!tool?.ficha_tecnica_path) return;
        setIsProcessing(true);
        try {
            if (tool.ficha_tecnica_path.startsWith('http')) {
                 window.open(tool.ficha_tecnica_path, '_blank');
                 return;
            }
            const cleanPath = tool.ficha_tecnica_path.replace('herramienta_fotos/', '').replace('herramientas_docs/', '');
            const { data, error } = await supabase.storage.from('herramienta_fotos').createSignedUrl(cleanPath, 3600);
            if (!error && data?.signedUrl) {
                 window.open(data.signedUrl, '_blank');
            } else {
                 const { data: data2, error: error2 } = await supabase.storage.from('herramientas_docs').createSignedUrl(cleanPath, 3600);
                 if(error2) throw error2;
                 window.open(data2.signedUrl, '_blank');
            }
        } catch (err) {
             if (tool.ficha_tecnica_path.includes('/')) {
                  const { data } = supabase.storage.from('herramientas_docs').getPublicUrl(tool.ficha_tecnica_path);
                  if(data.publicUrl) window.open(data.publicUrl, '_blank');
             } else {
                 toast({ variant: 'destructive', title: 'Error', description: 'No se pudo abrir la ficha técnica.' });
             }
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleReturnFromRepair = async () => {
        if (!canManage) return;
        setIsProcessing(true);
        try {
            const { error } = await supabase.rpc('rpc_return_unit_from_repair', { p_herramienta_id: tool.id });
            if (error) throw error;
            
            toast({ title: 'Retornada de reparación', description: 'La herramienta está operativa de nuevo.' });
            await fetchData();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error al retornar', description: err.message });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBackClick = useCallback(() => {
        if (categoryId) {
            navigate(`/inventario/catalogo?cat=${categoryId}`); 
        } else {
            navigate('/inventario/catalogo'); 
        }
    }, [navigate, categoryId]);

    const isSinStock = (tool?.unidades_disponibles ?? 0) <= 0;
    
    // Helper to check operative status broadly
    const isOperative = tool && ['operativa', 'disponible'].includes(tool.estado);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full p-8">
                <Loader2 className="w-16 h-16 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8">
                <Button variant="outline" onClick={handleBackClick} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Catálogo
                </Button>
                <Card className="p-8 text-center border-destructive">
                    <ServerCrash className="w-12 h-12 mx-auto text-destructive mb-4" />
                    <h2 className="text-2xl font-bold text-destructive">Error al cargar la herramienta</h2>
                    <p className="text-muted-foreground mt-2">{error.message}</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* HEADER */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex items-start gap-4">
                    <Button variant="ghost" size="icon" onClick={handleBackClick} className="-ml-2">
                        <ArrowLeft className="w-6 h-6 text-muted-foreground" />
                    </Button>
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold tracking-tight text-foreground uppercase">{tool.nombre}</h1>
                            <Badge variant={tool.estado === 'operativa' ? 'default' : 'secondary'} 
                                   className={`text-sm px-3 py-0.5 ${tool.estado === 'operativa' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200' : ''}`}>
                                {tool.estado === 'operativa' ? 'Operativa' : tool.estado?.replace('_', ' ')}
                            </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="outline" className="font-mono bg-blue-50 text-blue-700 border-blue-200 px-2">{tool.ref_almacen}</Badge>
                            <span className="uppercase text-xs font-medium text-muted-foreground">{tool.marca} {tool.modelo}</span>
                            {tool.categoria && (
                                <>
                                    <span className="text-muted-foreground/40">•</span>
                                    <span className="text-primary font-medium">{tool.categoria.nombre}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* HEADER ACTIONS */}
                {canManage && (
                    <div className="flex flex-wrap items-center gap-3">
                        <Button variant="outline" onClick={() => setIsRepairHistoryModalOpen(true)} className="border-primary/20 hover:border-primary/50">
                            <History className="w-4 h-4 mr-2 text-muted-foreground" />
                            Historial Reparaciones
                        </Button>
                        
                        {/* ASSIGN BUTTON - Visible in Header */}
                        {isOperative && (
                            <Button 
                                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" 
                                onClick={() => setIsAssignModalOpen(true)}
                                disabled={isProcessing || isSinStock}
                            >
                                <UserPlus className="mr-2 h-4 w-4" /> 
                                Asignar Herramienta
                            </Button>
                        )}

                        {/* REPAIR BUTTON - Visible in Header */}
                        {isOperative && (
                            <Button variant="destructive" onClick={() => setIsRepairModalOpen(true)} className="shadow-sm">
                                <Wrench className="w-4 h-4 mr-2" />
                                Enviar a Taller
                            </Button>
                        )}

                        {tool.estado === 'en_reparacion' && (
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm" onClick={handleReturnFromRepair}>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Retornar de Taller
                            </Button>
                        )}

                        <Button className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm" onClick={() => setIsCrudModalOpen(true)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar Herramienta
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* COLUMNA IZQUIERDA: FOTO & STOCK */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="overflow-hidden border-none shadow-md bg-card/50">
                        <div className="w-full aspect-square flex items-center justify-center bg-white p-4 relative group">
                            {fotoUrl ? (
                                <img src={fotoUrl} alt={tool.nombre} className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105" />
                            ) : (
                                <div className="flex flex-col items-center text-muted-foreground/30">
                                    <Wrench className="w-24 h-24 mb-2" />
                                    <p className="text-sm font-medium">Sin imagen</p>
                                </div>
                            )}
                        </div>
                        {canManage && (
                            <div className="p-4 bg-background border-t">
                                <FotoUploader herramientaId={tool.id} onUploadComplete={fetchData} />
                            </div>
                        )}
                    </Card>

                    {/* STOCK SUMMARY */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-medium flex items-center gap-2 text-muted-foreground">
                                <Box className="w-4 h-4" />
                                Resumen de Inventario
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                                <span className="text-sm font-medium">Disponibles</span>
                                <span className={`text-xl font-bold ${tool.unidades_disponibles > 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                                    {tool.unidades_disponibles}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                                <span className="text-sm font-medium">Total Unidades</span>
                                <span className="text-xl font-bold text-foreground">
                                    {tool.unidades_totales}
                                </span>
                            </div>
                            
                            {isTecnico && (
                                <Button 
                                    variant="outline" 
                                    className="w-full mt-2" 
                                    onClick={() => setIsSolicitudModalOpen(true)}
                                    disabled={isProcessing || isSinStock}
                                >
                                    <Send className="mr-2 h-4 w-4" /> 
                                    Solicitar Herramienta
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* COLUMNA DERECHA: INFORMACIÓN Y HISTORIAL SIN TABS */}
                <div className="lg:col-span-2 space-y-6">
                    {/* SPECIFICATIONS */}
                    <Card>
                        <CardHeader className="border-b bg-muted/10 pb-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="w-5 h-5 text-purple-600" />
                                Especificaciones y Descripción
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {tool.observaciones ? (
                                <div className="text-sm text-muted-foreground space-y-3 leading-relaxed">
                                    {tool.observaciones.split('\n').map((line, i) => {
                                        const trimmed = line.trim();
                                        if (!trimmed) return null;
                                        const cleanLine = trimmed.replace(/^[-*•]\s*/, '');
                                        return (
                                            <div key={i} className="flex items-start gap-2">
                                                <div className="mt-2 w-1 h-1 rounded-full bg-primary/60 shrink-0" />
                                                <span>{cleanLine}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">Sin descripción detallada.</p>
                            )}
                            
                            {tool.ficha_tecnica_path && (
                                <div className="mt-6 pt-4 border-t">
                                    <Button variant="outline" size="sm" onClick={openFichaTecnica} disabled={isProcessing}>
                                        <FileText className="mr-2 h-4 w-4" />
                                        Ver Ficha Técnica Original
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* PURCHASE & WARRANTY */}
                    <Card>
                        <CardHeader className="border-b bg-muted/10 pb-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Badge variant="outline" className="h-6 w-6 p-0 flex items-center justify-center border-primary text-primary rounded-full bg-primary/10">
                                    <CheckCircle2 className="w-3 h-3" />
                                </Badge>
                                Garantía y Compra
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> Fecha de Compra
                                </p>
                                <p className="font-medium text-foreground">
                                    {tool.fecha_compra ? fmtMadrid(tool.fecha_compra, 'date') : '-'}
                                </p>
                            </div>
                            
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-orange-500" /> Vencimiento Garantía
                                </p>
                                <p className={`font-medium ${tool.fecha_garantia && new Date(tool.fecha_garantia) < new Date() ? 'text-destructive' : 'text-foreground'}`}>
                                    {tool.fecha_garantia ? fmtMadrid(tool.fecha_garantia, 'date') : 'VENCIMIENTO GARANTÍA'}
                                </p>
                            </div>

                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                    <Euro className="w-3 h-3" /> Precio de Compra
                                </p>
                                <p className="font-medium text-foreground">
                                    {tool.precio_compra ? `${Number(tool.precio_compra).toFixed(2)} €` : '-'}
                                </p>
                            </div>

                            {tool.proveedor && (
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                        Proveedor
                                    </p>
                                    <p className="font-medium text-foreground truncate">
                                        {tool.proveedor}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* HISTORIAL DE ASIGNACIONES */}
                    <Card>
                        <CardHeader className="border-b bg-muted/10 pb-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Clock className="w-5 h-5 text-muted-foreground" />
                                Historial de Asignaciones
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            {historialError && <p className="text-sm text-destructive">Error al cargar historial: {historialError.message}</p>}
                            {!historialError && historial.length > 0 ? (
                                <ul className="space-y-4">
                                    {historial.map(h => (
                                        <li key={h.asignacion_id} className="flex items-start justify-between pb-4 border-b last:border-0 last:pb-0">
                                            <div>
                                                <p className="font-medium text-sm">{h.empleado || 'Usuario desconocido'}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                                                    <Badge variant={h.estado_asignacion === 'cerrada' ? 'secondary' : 'outline'} className="capitalize text-[10px] h-5 px-1.5">
                                                        {h.estado_asignacion?.replace(/_/g, ' ')}
                                                    </Badge>
                                                    <span>Entrega: {fmtMadrid(h.fecha_entrega, 'date')}</span>
                                                </p>
                                            </div>
                                            {h.fecha_recepcion ? (
                                                <div className="text-right">
                                                    <span className="text-xs text-muted-foreground block">Devolución</span>
                                                    <span className="text-xs font-medium">{fmtMadrid(h.fecha_recepcion, 'date')}</span>
                                                </div>
                                            ) : (
                                                <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-200 text-[10px]">Activa</Badge>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            ) : !historialError && (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Package className="w-12 h-12 mx-auto mb-3 opacity-10" />
                                    <p className="text-sm">Esta herramienta aún no ha sido asignada.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* --- MODALES --- */}
            
            {isTecnico && tool && (
                <SolicitudHerramientaModal
                    isOpen={isSolicitudModalOpen}
                    onClose={() => setIsSolicitudModalOpen(false)}
                    herramienta={{...tool, herramienta_id: tool.id}}
                    onSuccess={() => { toast({ title: 'Solicitud enviada' }); fetchData(); }}
                />
            )}
            
            {canManage && isCrudModalOpen && (
                <ToolCrudModal
                    isOpen={isCrudModalOpen}
                    onClose={() => setIsCrudModalOpen(false)}
                    onSuccess={fetchData}
                    toolId={tool.id}
                />
            )}

            {/* MODAL DE ASIGNACIÓN DIRECTA */}
            {canManage && isAssignModalOpen && (
                <ToolAssignmentModal 
                    isOpen={isAssignModalOpen}
                    onClose={() => setIsAssignModalOpen(false)}
                    tool={tool}
                    onSuccess={fetchData}
                />
            )}

            {/* MODAL DE REPARACIÓN */}
            {canManage && isRepairModalOpen && (
                <RepairToolModal
                    isOpen={isRepairModalOpen}
                    onClose={() => setIsRepairModalOpen(false)}
                    tool={tool}
                    onSuccess={fetchData}
                />
            )}

            {/* MODAL DE HISTORIAL DE REPARACIONES */}
            {canManage && isRepairHistoryModalOpen && tool && (
                <RepairHistoryModal
                    isOpen={isRepairHistoryModalOpen}
                    onClose={() => setIsRepairHistoryModalOpen(false)}
                    toolId={tool.id}
                    toolName={tool.nombre}
                />
            )}
        </div>
    );
};

export default HerramientaDetail;