import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Wrench, History, FileText, AlertTriangle, CheckCircle2, XCircle, ShoppingCart, Loader2, Package, Pencil, Trash2, ChevronDown, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import SolicitudHerramientaModal from '@/components/SolicitudHerramientaModal';
import ToolCrudModal from '@/components/ToolCrudModal';
import PhotoUploadModal from '@/components/PhotoUploadModal';
import ToolPendingAssignmentModal from '@/components/ToolPendingAssignmentModal';
import { fmtMadrid } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const ToolDetailView = ({ navigate, toolId }) => {
    let paramId = null;
    try {
        const params = useParams();
        paramId = params?.id;
    } catch (e) { }
    const id = toolId || paramId;

    const { sessionRole } = useAuth();
    const [tool, setTool] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSolicitudOpen, setIsSolicitudOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [history, setHistory] = useState([]);
    const [repairs, setRepairs] = useState([]);

    const canManage = ['admin', 'encargado'].includes(sessionRole?.rol);

    const fetchToolDetails = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase.from('herramientas').select(`*, proveedor:proveedores(nombre), categoria:categorias_herramienta(nombre)`).eq('id', id).single();
            if (error) throw error;
            setTool(data);
            if (canManage) {
                const { data: hData } = await supabase.from('herramienta_asignaciones').select('*, empleado:entregada_a(nombre, apellidos)').eq('herramienta_id', id).order('created_at', { ascending: false });
                setHistory(hData || []);
                const { data: rData } = await supabase.from('herramientas_reparacion_log').select('*').eq('herramienta_id', id).order('fecha_envio', { ascending: false });
                setRepairs(rData || []);
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "No se pudo cargar la herramienta." });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (id) fetchToolDetails(); }, [id]);

    const getPublicUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        const { data } = supabase.storage.from('herramientas_fotos').getPublicUrl(path);
        return data?.publicUrl;
    };

    const handleDelete = async () => {
        const { data } = await supabase.rpc('admin_delete_herramienta', { p_id: tool.id });
        if (data.ok) {
            toast({ title: 'Eliminada' });
            navigate('/inventario/catalogo');
        } else {
            toast({ variant: 'destructive', title: 'Error', description: data.motivo });
        }
        setDeleteAlertOpen(false);
    };

    const handlePhotoUpdate = async (files) => {
        setIsPhotoModalOpen(false);
        if (!files.length) return;
        const file = files[0];
        try {
            const fileName = `tools/${tool.id}_${Date.now()}.${file.name.split('.').pop()}`;
            const { error: upErr } = await supabase.storage.from('herramientas_fotos').upload(fileName, file);
            if (upErr) throw upErr;
            const { data: urlData } = supabase.storage.from('herramientas_fotos').getPublicUrl(fileName);
            await supabase.from('herramientas').update({ foto_url: urlData.publicUrl, foto_path: fileName }).eq('id', tool.id);
            toast({ title: "Foto actualizada" });
            fetchToolDetails();
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Fallo al subir foto." });
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8" /></div>;
    if (!tool) return <div className="p-8 text-center">Herramienta no encontrada</div>;

    const canSolicit = sessionRole?.rol === 'tecnico' && tool.unidades_disponibles > 0 && tool.activa && tool.estado !== 'baja';

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 pb-16">
            <div className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/inventario/catalogo')}><ArrowLeft /></Button>
                    <h1 className="text-2xl font-bold">{tool.nombre}</h1>
                </div>
                <div className="flex gap-2">
                    {canSolicit && <Button onClick={() => setIsSolicitudOpen(true)} className="bg-blue-600 text-white"><ShoppingCart className="mr-2 h-4 w-4" /> Solicitar</Button>}
                    {canManage && (
                        <>
                            {tool.unidades_disponibles > 0 && tool.activa && tool.estado !== 'baja' && (
                                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setIsAssignModalOpen(true)}>
                                    Asignar
                                </Button>
                            )}
                            <Button variant="outline" onClick={() => setIsEditModalOpen(true)}><Pencil className="mr-2 h-4 w-4" /> Editar</Button>
                            <Button variant="ghost" className="text-destructive" onClick={() => setDeleteAlertOpen(true)}><Trash2 className="h-4 w-4" /></Button>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-6">
                    <Card className="overflow-hidden rounded-xl shadow-md group relative">
                        <div className="aspect-square flex items-center justify-center bg-gray-100 dark:bg-gray-800 p-4">
                            {tool.foto_url ? <img src={getPublicUrl(tool.foto_url)} alt={tool.nombre} className="object-contain w-full h-full" /> : <Package className="w-16 h-16 text-muted-foreground/40" />}
                        </div>
                        {canManage && (
                            <Button size="icon" variant="secondary" className="absolute bottom-2 right-2 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setIsPhotoModalOpen(true)}>
                                <Camera className="h-4 w-4" />
                            </Button>
                        )}
                    </Card>
                    <Card><CardHeader><CardTitle>Detalles</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Categoría</span><span>{tool.categoria?.nombre}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Stock</span><span>{tool.unidades_disponibles}/{tool.unidades_totales}</span></div>
                    </CardContent></Card>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <Card><CardHeader><CardTitle>Descripción</CardTitle></CardHeader><CardContent><p className="text-sm">{tool.observaciones || "Sin descripción."}</p></CardContent></Card>

                    <Tabs defaultValue="history">
                        <TabsList>
                            <TabsTrigger value="history"><History className="mr-2 h-4 w-4" /> Historial</TabsTrigger>
                            <TabsTrigger value="repairs"><Wrench className="mr-2 h-4 w-4" /> Reparaciones</TabsTrigger>
                        </TabsList>
                        <TabsContent value="history">
                            <Card><CardContent className="pt-6 space-y-2">
                                {history.length === 0 ? <p className="text-center text-muted-foreground">Sin historial</p> : history.map(h => (
                                    <div
                                        key={h.id}
                                        className="flex justify-between border-b pb-2 p-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => navigate(`/inventario/solicitudes?tab=devoluciones&id=${h.id}`)}
                                        title={h.estado === 'cerrada' ? 'Ver detalles de devolución' : 'Ver asignación'}
                                    >
                                        <div className="flex-1">
                                            <p className="font-medium text-sm">{h.empleado?.nombre} {h.empleado?.apellidos}</p>
                                            <div className="text-xs text-muted-foreground flex flex-col gap-1 mt-1.5 bg-muted/30 p-2 rounded w-fit">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                    <span>Entrega: <span className="font-medium">{fmtMadrid(h.created_at)}</span></span>
                                                </div>
                                                {(h.estado === 'cerrada' || h.estado === 'pendiente_revision') && (h.fecha_recepcion || h.devuelta_at) && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                        <span>Devolución: <span className="font-medium">{fmtMadrid(h.devuelta_at || h.fecha_recepcion)}</span></span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-start items-center">
                                            <Badge variant="outline">{h.estado.replace(/_/g, ' ')}</Badge>
                                        </div>
                                    </div>
                                ))}
                            </CardContent></Card>
                        </TabsContent>
                        <TabsContent value="repairs">
                            <Card><CardContent className="pt-6">
                                {repairs.length === 0 ? <p className="text-center text-muted-foreground">Sin reparaciones</p> : repairs.map(r => <div key={r.id} className="border-b py-2">{r.motivo_falla}</div>)}
                            </CardContent></Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            <SolicitudHerramientaModal isOpen={isSolicitudOpen} onClose={() => setIsSolicitudOpen(false)} herramienta={{ ...tool, herramienta_id: tool.id }} onSuccess={fetchToolDetails} />
            <ToolCrudModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSuccess={() => { setIsEditModalOpen(false); fetchToolDetails(); }} toolId={tool.id} />
            <PhotoUploadModal isOpen={isPhotoModalOpen} onClose={() => setIsPhotoModalOpen(false)} onPhotosSelected={handlePhotoUpdate} title="Actualizar Foto" allowMultiple={false} />

            {canManage && isAssignModalOpen && (
                <ToolPendingAssignmentModal
                    isOpen={isAssignModalOpen}
                    onClose={() => setIsAssignModalOpen(false)}
                    tool={tool}
                    onSuccess={fetchToolDetails}
                />
            )}

            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Confirmar eliminación</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive">Eliminar</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default ToolDetailView;