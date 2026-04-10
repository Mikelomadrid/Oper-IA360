import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import {
    ArrowLeft, Save, Trash2, MapPin, User,
    Briefcase, Calendar, Loader2, MessageSquare,
    CheckCircle2, AlertCircle, Phone
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import AvisoActivityLog from '@/components/AvisoActivityLog';
import { fmtMadrid } from '@/lib/utils';
// Eliminados: Tabs, Paperclip y FileText de los imports

const AdminAvisoDetail = ({ navigate, avisoId }) => {
    // This component is no longer directly reachable via navigation,
    // but its code is kept as it might be used by other parts of the application
    // or as a template for other detail views.
    const { user } = useAuth();
    const [aviso, setAviso] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Catalogs
    const [technicians, setTechnicians] = useState([]);
    // const [projects, setProjects] = useState([]); // Removed as it's not used in this context anymore

    // Edit Form State
    const [formData, setFormData] = useState({
        descripcion_solicitud: '',
        direccion_servicio: '',
        cliente_nombre: '',
        telefono_contacto: '',
        tecnico_asignado_id: 'none',
        // proyecto_id: 'none', // Removed
        estado: 'pendiente'
    });

    useEffect(() => {
        if (avisoId) fetchData();
    }, [avisoId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Aviso Details
            const { data: avisoData, error } = await supabase
                .from('avisos')
                .select(`
                    *,
                    tecnico:empleados!avisos_tecnico_asignado_id_fkey(nombre, apellidos),
                    creador_interno:empleados!avisos_creador_id_fkey(nombre, apellidos, rol)
                `)
                .eq('id', avisoId)
                .single();

            if (error) throw error;
            setAviso(avisoData);
            setFormData({
                descripcion_solicitud: avisoData.descripcion_solicitud || '',
                direccion_servicio: avisoData.direccion_servicio || '',
                cliente_nombre: avisoData.cliente_nombre || '',
                telefono_contacto: avisoData.telefono_contacto || '',
                tecnico_asignado_id: avisoData.tecnico_asignado_id || 'none',
                estado: avisoData.estado || 'pendiente'
            });

            // 2. Fetch Technicians
            const { data: techData } = await supabase.from('empleados').select('id, nombre, apellidos').in('rol', ['tecnico', 'encargado', 'admin']).eq('activo', true);
            setTechnicians(techData || []);

        } catch (error) {
            console.error("Error loading detail:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el aviso.' });
            navigate(-1); // Changed to go back instead of a specific admin route
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updates = {
                descripcion_solicitud: formData.descripcion_solicitud,
                direccion_servicio: formData.direccion_servicio,
                cliente_nombre: formData.cliente_nombre,
                telefono_contacto: formData.telefono_contacto,
                tecnico_asignado_id: formData.tecnico_asignado_id === 'none' ? null : formData.tecnico_asignado_id,
                estado: formData.estado
            };

            const { error } = await supabase
                .from('avisos')
                .update(updates)
                .eq('id', avisoId);

            if (error) throw error;

            toast({ title: 'Guardado', description: 'Los cambios se han guardado correctamente.' });
            setIsEditing(false);
            fetchData(); // Refresh
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron guardar los cambios.' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const { error } = await supabase.from('avisos').delete().eq('id', avisoId);
            if (error) throw error;

            toast({ title: 'Aviso eliminado' });
            navigate(-1); // Changed to go back
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el aviso. Puede tener dependencias.' });
            setDeleting(false);
        }
    };

    if (loading) return <div className="flex justify-center items-center h-96"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    if (!aviso) return <div className="p-8 text-center">Aviso no encontrado</div>;

    return (
        <div className="flex flex-col h-full bg-background">
            <Helmet><title>Detalle Aviso | Admin</title></Helmet>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-card sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            Aviso #{aviso.id.slice(0, 8)}
                            <Badge variant={aviso.estado === 'cerrado' ? 'success' : aviso.estado === 'en_curso' ? 'info' : 'warning'} className="ml-2 uppercase">
                                {aviso.estado.replace('_', ' ')}
                            </Badge>
                        </h1>
                        <div className="text-xs text-muted-foreground mt-1 flex gap-3">
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmtMadrid(aviso.created_at)}</span>
                            <span className="flex items-center gap-1"><User className="w-3 h-3" /> Creado por: {aviso.creador_interno?.nombre || aviso.creador_rol || 'Sistema'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={deleting}>
                                <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará el aviso y sus archivos asociados.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {isEditing ? (
                        <>
                            <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancelar</Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                Guardar
                            </Button>
                        </>
                    ) : (
                        <Button onClick={() => setIsEditing(true)}>Editar</Button>
                    )}
                </div>
            </div>

            {/* Content Grid */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3">

                {/* Left: Edit Forms */}
                <ScrollArea className="lg:col-span-1 border-r bg-muted/10 p-6">
                    <div className="space-y-6">

                        {/* Status & Assignment */}
                        <Card>
                            <CardHeader className="pb-3 pt-4"><CardTitle className="text-sm font-bold uppercase text-muted-foreground">Estado y Asignación</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Estado del Aviso</Label>
                                    <Select value={formData.estado} onValueChange={v => setFormData({ ...formData, estado: v })} disabled={!isEditing}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pendiente">Pendiente</SelectItem>
                                            <SelectItem value="en_curso">En Curso</SelectItem>
                                            <SelectItem value="cerrado">Cerrado / Completado</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Técnico Responsable</Label>
                                    <Select value={formData.tecnico_asignado_id} onValueChange={v => setFormData({ ...formData, tecnico_asignado_id: v })} disabled={!isEditing}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Sin asignar" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">-- Sin Asignar --</SelectItem>
                                            {technicians.map(t => (
                                                <SelectItem key={t.id} value={t.id}>{t.nombre} {t.apellidos}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {/* Removed project assignment as per request (not in sidebar anymore) */}
                                {/* <div className="space-y-2">
                                    <Label>Proyecto (Opcional)</Label>
                                    <Select value={formData.proyecto_id} onValueChange={v => setFormData({ ...formData, proyecto_id: v })} disabled={!isEditing}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Sin proyecto" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">-- Ninguno --</SelectItem>
                                            {projects.map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.nombre_proyecto}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div> */}
                            </CardContent>
                        </Card>

                        {/* Details Form */}
                        <Card>
                            <CardHeader className="pb-3 pt-4"><CardTitle className="text-sm font-bold uppercase text-muted-foreground">Detalles de la Solicitud</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Descripción del Trabajo</Label>
                                    <Textarea
                                        className="min-h-[120px]"
                                        value={formData.descripcion_solicitud}
                                        onChange={e => setFormData({ ...formData, descripcion_solicitud: e.target.value })}
                                        disabled={!isEditing}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Ubicación / Dirección</Label>
                                    <Input
                                        value={formData.direccion_servicio}
                                        onChange={e => setFormData({ ...formData, direccion_servicio: e.target.value })}
                                        prefix={<MapPin className="w-4 h-4" />}
                                        disabled={!isEditing}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Cliente / Contacto</Label>
                                    {isEditing ? (
                                        <div className="grid gap-2">
                                            <Input
                                                placeholder="Nombre"
                                                value={formData.cliente_nombre}
                                                onChange={e => setFormData({ ...formData, cliente_nombre: e.target.value })}
                                            />
                                            <Input
                                                placeholder="Teléfono"
                                                value={formData.telefono_contacto}
                                                onChange={e => setFormData({ ...formData, telefono_contacto: e.target.value })}
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-sm">
                                                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                                                <span>{aviso.cliente_nombre || 'No especificado'}</span>
                                            </div>
                                            {aviso.telefono_contacto && (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                                                    <a href={`tel:${aviso.telefono_contacto}`} className="text-blue-600 hover:underline">
                                                        {aviso.telefono_contacto}
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Resolution Preview (ReadOnly) */}
                        {aviso.estado === 'cerrado' && (
                            <Card className="border-green-200 bg-green-50/20">
                                <CardHeader className="pb-3 pt-4"><CardTitle className="text-sm font-bold uppercase text-green-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Resolución Técnica</CardTitle></CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <p className="italic text-foreground/80">"{aviso.descripcion_tecnico || 'Sin comentarios del técnico'}"</p>
                                    <div className="text-xs text-muted-foreground pt-2 border-t mt-2">
                                        Cerrado el: {fmtMadrid(aviso.fecha_cierre)}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                    </div>
                </ScrollArea>

                {/* Right: Activity Log (Bitácora) */}
                <div className="lg:col-span-2 flex flex-col h-full">
                    <AvisoActivityLog avisoId={avisoId} />
                </div>
            </div>
        </div>
    );
};

export default AdminAvisoDetail;