import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { 
    ArrowLeft, Save, Trash2, MapPin, User, FileText, 
    Briefcase, Calendar, Loader2, MessageSquare, Paperclip, 
    CheckCircle2, AlertCircle, Upload, X, Image as ImageIcon,
    Edit2, UserPlus, Phone, PenTool, Download, Camera
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import AvisoActivityLog from '@/components/AvisoActivityLog';
import { fmtMadrid } from '@/lib/utils';
import html2pdf from 'html2pdf.js';

// --- SIGNATURE PAD COMPONENT ---
const SignaturePad = ({ onEnd, onClear, canvasRef }) => {
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#000000';

        const resizeCanvas = () => {
            const parent = canvas.parentElement;
            if (parent) {
                canvas.width = parent.clientWidth;
                canvas.height = 200;
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = '#000000';
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, [canvasRef]);

    const getCoordinates = (event) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;
        if (event.touches && event.touches.length > 0) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDrawing = (e) => {
        e.preventDefault();
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            onEnd && onEnd();
        }
    };

    return (
        <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white touch-none relative">
            <canvas
                ref={canvasRef}
                className="w-full h-[200px] cursor-crosshair block"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
            <div className="absolute bottom-2 right-2">
                <Button variant="outline" size="sm" onClick={onClear} type="button">
                    Borrar Firma
                </Button>
            </div>
            <div className="absolute top-2 left-2 text-xs text-muted-foreground pointer-events-none select-none">
                Área de firma
            </div>
        </div>
    );
};
// --- FIN SIGNATURE PAD COMPONENT ---


const FarmAvisoDetail = ({ navigate, avisoId }) => {
    const { user, sessionRole } = useAuth(); 
    const [aviso, setAviso] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    
    // Mode State
    const [isEditing, setIsEditing] = useState(false);

    // Assign Modal State
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [assignLoading, setAssignLoading] = useState(false);
    const [selectedTechnician, setSelectedTechnician] = useState('none');

    // Closure State
    const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
    const [closureData, setClosureData] = useState({
        descripcion_tecnico: '',
        cliente_acepta_nombre: ''
    });
    const [closureFiles, setClosureFiles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const canvasRef = useRef(null);
    const closureFileInputRef = useRef(null);
    const closureCameraInputRef = useRef(null);
    
    // PDF Generation Ref
    const printRef = useRef(null);

    // Catalogs
    const [technicians, setTechnicians] = useState([]);
    const [files, setFiles] = useState([]);

    // Edit Form State
    const [formData, setFormData] = useState({
        descripcion_solicitud: '',
        direccion_servicio: '',
        cliente_nombre: '',
        telefono_contacto: '',
        tecnico_asignado_id: 'none',
        estado: 'pendiente'
    });

    // UUID Validation Helper
    const isValidUUID = (id) => {
        const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return regex.test(id);
    };

    useEffect(() => {
        if (avisoId) {
            if (isValidUUID(avisoId)) {
                fetchData();
                
                // Real-time subscription for main Aviso details
                const channel = supabase
                    .channel(`aviso-detail-${avisoId}`)
                    .on(
                        'postgres_changes',
                        {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'avisos',
                            filter: `id=eq.${avisoId}`,
                        },
                        (payload) => {
                            // Refresh data on update
                            fetchData(false); // false to avoid full loading spinner if desired
                        }
                    )
                    .subscribe();

                return () => {
                    supabase.removeChannel(channel);
                };
            } else {
                console.error("Invalid UUID for avisoId:", avisoId);
                setLoading(false);
                toast({ variant: 'destructive', title: 'Error', description: 'ID de aviso inválido.' });
                if (navigate) navigate(-1);
            }
        }
    }, [avisoId]);
    
    useEffect(() => {
        if (aviso?.cliente_nombre) {
            setClosureData(prev => ({ ...prev, cliente_acepta_nombre: aviso.cliente_nombre }));
        }
    }, [aviso?.cliente_nombre]);

    const fetchData = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const { data: avisoData, error } = await supabase
                .from('avisos')
                .select(`
                    *,
                    tecnico:empleados!avisos_tecnico_asignado_id_fkey(id, nombre, apellidos, telefono),
                    proyecto:proyectos(nombre_proyecto),
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

            setClosureData(prev => ({
                descripcion_tecnico: avisoData.descripcion_tecnico || '',
                cliente_acepta_nombre: avisoData.cliente_acepta_nombre || avisoData.cliente_nombre || ''
            }));

            const { data: filesData } = await supabase
                .from('avisos_archivos')
                .select('*')
                .eq('aviso_id', avisoId);
            setFiles(filesData || []);

            if (canManage() || sessionRole?.rol === 'finca_admin') {
                const { data: techData } = await supabase
                    .from('empleados')
                    .select('id, nombre, apellidos')
                    .in('rol', ['tecnico', 'encargado', 'admin'])
                    .eq('activo', true)
                    .order('nombre');
                setTechnicians(techData || []);
            }

        } catch (error) {
            console.error("Error loading detail:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el aviso.' });
            if (navigate) navigate(-1);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const isAdminOrEncargado = () => ['admin', 'encargado'].includes(sessionRole?.rol);
    const isFincaAdmin = () => sessionRole?.rol === 'finca_admin';
    const isCreator = () => sessionRole?.empleadoId === aviso?.creador_id;
    const isAssignedTechnician = () => sessionRole?.empleadoId === aviso?.tecnico_asignado_id && sessionRole?.rol === 'tecnico' && aviso?.estado !== 'cerrado';

    const canManage = () => isAdminOrEncargado() || isCreator();
    const canEditStatus = () => isAdminOrEncargado() || isFincaAdmin();
    const canAssign = () => isAdminOrEncargado() || isFincaAdmin();

    const handleSave = async () => {
        setSaving(true);
        try {
            const updates = {
                descripcion_solicitud: formData.descripcion_solicitud,
                direccion_servicio: formData.direccion_servicio,
                cliente_nombre: formData.cliente_nombre,
                telefono_contacto: formData.telefono_contacto,
            };

            if (canEditStatus()) {
                updates.estado = formData.estado;
                updates.tecnico_asignado_id = formData.tecnico_asignado_id === 'none' ? null : formData.tecnico_asignado_id;
            }

            const { error } = await supabase.from('avisos').update(updates).eq('id', avisoId);
            if (error) throw error;

            toast({ title: 'Guardado', description: 'Los cambios se han guardado correctamente.' });
            setIsEditing(false);
            fetchData();
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
            if (navigate) navigate(-1);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el aviso.' });
            setDeleting(false);
        }
    };

    const handleAssignTechnician = async () => {
        if (selectedTechnician === 'none') {
            toast({ variant: 'destructive', title: 'Error', description: 'Debes seleccionar un técnico.' });
            return;
        }
        setAssignLoading(true);
        try {
            const { error } = await supabase.from('avisos').update({
                tecnico_asignado_id: selectedTechnician,
                estado: 'en_curso'
            }).eq('id', avisoId);

            if (error) throw error;
            toast({ title: 'Asignación completada', description: 'Técnico asignado correctamente.' });
            setIsAssignOpen(false);
            fetchData();
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo asignar el técnico.' });
        } finally {
            setAssignLoading(false);
        }
    };

    const handleClearSignature = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const isCanvasEmpty = () => {
        const canvas = canvasRef.current;
        if (!canvas) return true;
        const ctx = canvas.getContext('2d');
        const pixelBuffer = new Uint32Array(
            ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer
        );
        return !pixelBuffer.some(color => color !== 0);
    };

    const handleSubmitClosure = async () => {
        if (!closureData.descripcion_tecnico.trim()) {
            toast({ variant: 'destructive', title: 'Falta información', description: 'Describe el trabajo realizado.' });
            return;
        }
        if (!closureData.cliente_acepta_nombre.trim()) {
            toast({ variant: 'destructive', title: 'Falta información', description: 'Indica el nombre de quien firma.' });
            return;
        }
        if (isCanvasEmpty()) {
            toast({ variant: 'destructive', title: 'Falta firma', description: 'El cliente debe firmar la conformidad.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const { data: empData } = await supabase.from('empleados').select('id').eq('auth_user_id', user.id).single();
            const employeeId = empData?.id;

            const canvas = canvasRef.current;
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            const sigFileName = `avisos/${avisoId}/signature_${Date.now()}.png`;
            const { error: uploadSigError } = await supabase.storage
                .from('firmas')
                .upload(sigFileName, blob, { contentType: 'image/png', upsert: true });

            if (uploadSigError) throw uploadSigError;
            const { data: urlData } = supabase.storage.from('firmas').getPublicUrl(sigFileName);
            const firmaUrl = urlData.publicUrl;

            const fileUploadPromises = closureFiles.map(async (file) => {
                const fileExt = file.name.split('.').pop();
                const fileName = `avisos/${avisoId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const { error: uploadFileError } = await supabase.storage
                    .from('avisos-files')
                    .upload(fileName, file, { upsert: false });
                if (uploadFileError) throw uploadFileError;
                const { data: fileUrlData } = supabase.storage.from('avisos-files').getPublicUrl(fileName);
                return supabase.from('avisos_archivos').insert({
                    aviso_id: avisoId,
                    archivo_url: fileUrlData.publicUrl,
                    nombre_archivo: file.name,
                    tipo_archivo: file.type,
                    subido_por: employeeId
                });
            });
            await Promise.all(fileUploadPromises);

            const { error: updateError } = await supabase.from('avisos').update({
                estado: 'cerrado',
                fecha_cierre: new Date().toISOString(),
                descripcion_tecnico: closureData.descripcion_tecnico,
                cliente_acepta_nombre: closureData.cliente_acepta_nombre,
                firma_url: firmaUrl
            }).eq('id', avisoId);

            if (updateError) throw updateError;

            toast({ title: 'Aviso cerrado', description: 'El trabajo ha sido registrado y firmado correctamente.' });
            setIsClosureModalOpen(false);
            fetchData();

        } catch (error) {
            console.error('Error cerrando aviso:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cerrar el aviso. Inténtalo de nuevo.' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleGeneratePdf = async () => {
        const element = printRef.current;
        if (!element) {
            toast({ variant: "destructive", title: "Error", description: "No se pudo encontrar el contenido para generar el PDF." });
            return;
        }

        // Configuración optimizada para legibilidad y encaje en A4
        const opt = {
            margin:       6, // 6mm margins para aprovechar espacio pero dejar aire
            filename:     `Aviso_${aviso.id.slice(0,8)}_${(aviso.fecha_cierre || aviso.created_at).split('T')[0]}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false, letterRendering: true }, 
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
        };

        toast({ title: "Generando PDF", description: "Preparando documento de alta legibilidad..." });

        try {
            await html2pdf().set(opt).from(element).save();
            toast({ title: "Éxito", description: "PDF descargado." });
        } catch (error) {
            console.error("PDF Generation Error:", error);
            toast({ variant: "destructive", title: "Error", description: "Error al generar el PDF." });
        }
    };

    const formatPhoneNumber = (phone) => {
        if (!phone) return '';
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 9) {
            return `${cleaned.slice(0,3)} ${cleaned.slice(3,6)} ${cleaned.slice(6,9)}`;
        }
        return phone;
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'cerrado': return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Completado</Badge>;
            case 'en_curso': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200"><Briefcase className="w-3 h-3 mr-1" /> En Curso</Badge>;
            default: return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200"><AlertCircle className="w-3 h-3 mr-1" /> Pendiente</Badge>;
        }
    };

    if (loading) return <div className="flex justify-center items-center h-96"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    if (!aviso) return <div className="p-8 text-center">Aviso no encontrado</div>;

    return (
        <div className="flex flex-col h-full bg-background">
            <Helmet><title>Detalle Aviso {aviso.id.slice(0,8)}</title></Helmet>

            {/* Header */}
            <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b bg-card sticky top-0 z-20">
                <div className="flex items-center gap-3 md:gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate && navigate(-1)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="min-w-0">
                        <h1 className="text-lg md:text-xl font-bold flex items-center gap-2 flex-wrap">
                            <span className="truncate">Aviso #{aviso.id.slice(0, 8)}</span>
                            {getStatusBadge(aviso.estado)}
                        </h1>
                        <div className="text-xs text-muted-foreground mt-1 flex gap-2 md:gap-3 flex-wrap">
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmtMadrid(aviso.created_at)}</span>
                            <span className="flex items-center gap-1 truncate"><User className="w-3 h-3" /> {aviso.creador_interno?.nombre || aviso.creador_rol || 'Sistema'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    
                    {/* MOBILE: Quick Call Button if phone exists */}
                    {aviso.telefono_contacto && (
                        <a href={`tel:${aviso.telefono_contacto}`}>
                            <Button size="icon" variant="outline" className="md:hidden h-9 w-9 rounded-full bg-green-50 text-green-600 border-green-200 mr-1">
                                <Phone className="w-4 h-4" />
                            </Button>
                        </a>
                    )}

                    {/* Botón Generar PDF */}
                    {aviso.estado === 'cerrado' && (isAdminOrEncargado() || isFincaAdmin()) && (
                        <Button size="sm" onClick={handleGeneratePdf} variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50 hidden md:flex">
                            <Download className="w-4 h-4 mr-2" /> Descargar PDF
                        </Button>
                    )}
                    {aviso.estado === 'cerrado' && (isAdminOrEncargado() || isFincaAdmin()) && (
                        <Button size="sm" onClick={handleGeneratePdf} variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50 md:hidden">
                            <Download className="w-4 h-4" />
                        </Button>
                    )}

                    {/* Botón Cerrar y Firmar */}
                    {isAssignedTechnician() && (
                        <Button size="sm" onClick={() => setIsClosureModalOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">
                            <PenTool className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Cerrar y Firmar</span> <span className="md:hidden">Cerrar</span>
                        </Button>
                    )}

                    {canManage() && (
                        <>
                            {!isEditing ? (
                                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} disabled={aviso.estado === 'cerrado' && !isAdminOrEncargado()}>
                                    <Edit2 className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Editar</span>
                                </Button>
                            ) : (
                                <>
                                    <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); fetchData(); }} disabled={saving} className="hidden md:inline-flex">
                                        Cancelar
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => { setIsEditing(false); fetchData(); }} disabled={saving} className="md:hidden">
                                        <X className="w-4 h-4" />
                                    </Button>
                                    <Button size="sm" onClick={handleSave} disabled={saving}>
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 md:mr-2" />}
                                        <span className="hidden md:inline">Guardar</span>
                                    </Button>
                                </>
                            )}
                            
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm" disabled={deleting} className="hidden md:flex">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Eliminar aviso?</AlertDialogTitle>
                                        <AlertDialogDescription>Esta acción es irreversible. Se borrarán todos los datos asociados.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </>
                    )}
                </div>
            </div>

            {/* Content Layout - Responsive 
                Changed order classes to ensure Details column is FIRST on mobile 
            */}
            <div className="flex-1 overflow-hidden flex flex-col lg:grid lg:grid-cols-3">
                
                {/* Left Column: Details - Scrollable on Desktop, Natural flow on Mobile (part of main scroll) 
                    On Mobile: order-1 (First)
                    On Desktop: order-1 (First column)
                */}
                <div className="lg:col-span-1 lg:h-full bg-muted/10 border-b lg:border-b-0 lg:border-r overflow-y-auto order-1">
                    <div className="p-4 md:p-6 space-y-6">
                        {/* Status & Assignment Card */}
                        <Card>
                            <CardHeader className="pb-3 pt-4">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Estado y Asignación</CardTitle>
                                    {canAssign() && !isEditing && aviso.estado !== 'cerrado' && (
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-6 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                            onClick={() => {
                                                setSelectedTechnician(aviso.tecnico_asignado_id || 'none');
                                                setIsAssignOpen(true);
                                            }}
                                        >
                                            <UserPlus className="w-3 h-3 mr-1" /> 
                                            {aviso.tecnico_asignado_id ? 'Reasignar' : 'Asignar'}
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {isEditing && canEditStatus() ? (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Estado</Label>
                                            <Select value={formData.estado} onValueChange={v => setFormData({...formData, estado: v})}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="pendiente">Pendiente</SelectItem>
                                                    <SelectItem value="en_curso">En Curso</SelectItem>
                                                    <SelectItem value="cerrado">Cerrado / Completado</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {/* Técnico asignado en modo edición */}
                                        <div className="space-y-2">
                                            <Label>Técnico (Edición)</Label>
                                            <Select value={formData.tecnico_asignado_id || 'none'} onValueChange={v => setFormData({...formData, tecnico_asignado_id: v === 'none' ? null : v})}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar técnico..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">-- Sin Asignar --</SelectItem>
                                                    {technicians.map((t) => (
                                                        <SelectItem key={t.id} value={t.id}>
                                                            {t.nombre} {t.apellidos}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex justify-between items-center py-1 border-b border-dashed">
                                            <span className="text-sm text-muted-foreground">Estado Actual</span>
                                            {getStatusBadge(aviso.estado)}
                                        </div>
                                        <div className="py-1 space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-muted-foreground">Técnico</span>
                                                <div className="flex items-center gap-2">
                                                    {aviso.tecnico ? (
                                                        <>
                                                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                                                {aviso.tecnico.nombre.charAt(0)}
                                                            </div>
                                                            <span className="text-sm font-medium truncate max-w-[150px]">{aviso.tecnico.nombre} {aviso.tecnico.apellidos}</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground italic">Sin asignar</span>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Phone Number Display */}
                                            {aviso.tecnico && aviso.tecnico.telefono ? (
                                                <div className="flex justify-end pt-1">
                                                    <a 
                                                        href={`tel:${aviso.tecnico.telefono}`} 
                                                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-blue-600 transition-colors px-2 py-1 rounded hover:bg-blue-50 border border-transparent hover:border-blue-100"
                                                    >
                                                        <Phone className="w-3 h-3" />
                                                        {formatPhoneNumber(aviso.tecnico.telefono)}
                                                    </a>
                                                </div>
                                            ) : (aviso.tecnico && (
                                                <div className="flex justify-end pt-1">
                                                    <span className="text-xs text-muted-foreground/50 italic flex items-center gap-1">
                                                        <Phone className="w-3 h-3" /> Sin teléfono
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Details Card */}
                        <Card>
                            <CardHeader className="pb-3 pt-4"><CardTitle className="text-sm font-bold uppercase text-muted-foreground">Información del Aviso</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Descripción</Label>
                                    {isEditing ? (
                                        <Textarea 
                                            value={formData.descripcion_solicitud} 
                                            onChange={e => setFormData({...formData, descripcion_solicitud: e.target.value})}
                                            className="min-h-[100px]"
                                        />
                                    ) : (
                                        <p className="text-sm whitespace-pre-wrap bg-background p-3 rounded border">{aviso.descripcion_solicitud}</p>
                                    )}
                                </div>

                                <div className="grid gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Ubicación</Label>
                                        {isEditing ? (
                                            <Input 
                                                value={formData.direccion_servicio} 
                                                onChange={e => setFormData({...formData,direccion_servicio: e.target.value})}
                                                prefix={<MapPin className="w-4 h-4" />}
                                            />
                                        ) : (
                                            <div className="flex items-start gap-2 text-sm">
                                                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                                <span>{aviso.direccion_servicio}</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Cliente / Contacto</Label>
                                        {isEditing ? (
                                            <div className="grid gap-2">
                                                <Input 
                                                    placeholder="Nombre"
                                                    value={formData.cliente_nombre} 
                                                    onChange={e => setFormData({...formData, cliente_nombre: e.target.value})}
                                                />
                                                <Input 
                                                    placeholder="Teléfono"
                                                    value={formData.telefono_contacto} 
                                                    onChange={e => setFormData({...formData, telefono_contacto: e.target.value})}
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
                                                        <a href={`tel:${aviso.telefono_contacto}`} className="text-blue-600 hover:underline font-medium">
                                                            {aviso.telefono_contacto}
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Technical Resolution (Read Only) */}
                        {aviso.estado === 'cerrado' && (
                            <Card className="border-green-200 bg-green-50/20">
                                <CardHeader className="pb-3 pt-4"><CardTitle className="text-sm font-bold uppercase text-green-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Resolución del Técnico</CardTitle></CardHeader>
                                <CardContent className="space-y-4 text-sm">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Trabajo Realizado</Label>
                                        <p className="italic text-foreground/80 whitespace-pre-wrap">{aviso.descripcion_tecnico || 'Sin comentarios del técnico'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Cliente Firmante</Label>
                                        <p className="font-semibold">{aviso.cliente_acepta_nombre || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Firma</Label>
                                        {aviso.firma_url ? (
                                            <img src={aviso.firma_url} alt="Firma del Cliente" className="w-full max-h-32 object-contain border rounded-md bg-white" />
                                        ) : (
                                            <p className="text-xs text-muted-foreground/50">No se adjuntó firma.</p>
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground pt-2 border-t mt-2">
                                        Fecha Cierre: {fmtMadrid(aviso.fecha_cierre)}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                    </div>
                </div>

                {/* Right Column: Activity & Files 
                    On Mobile: order-2 (Second/Bottom)
                    On Desktop: order-2 (Second/Right Column)
                */}
                <div className="lg:col-span-2 flex flex-col h-[600px] lg:h-full bg-background order-2 border-b-4 border-muted/20 lg:border-b-0">
                    <Tabs defaultValue="activity" className="flex flex-col h-full">
                        <div className="px-4 md:px-6 pt-2 border-b bg-card">
                            <TabsList className="w-full justify-start h-12 bg-transparent p-0 space-x-6">
                                <TabsTrigger value="activity" className="h-full rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:text-primary">
                                    <MessageSquare className="w-4 h-4 mr-2" /> Actividad y Comentarios
                                </TabsTrigger>
                                <TabsTrigger value="files" className="h-full rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:text-primary">
                                    <Paperclip className="w-4 h-4 mr-2" /> Adjuntos <Badge variant="secondary" className="ml-2">{files.length}</Badge>
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="activity" className="flex-1 p-0 m-0 overflow-hidden relative">
                            <div className="absolute inset-0 md:p-6 md:pb-0">
                                <AvisoActivityLog avisoId={avisoId} aviso={aviso} />
                            </div>
                        </TabsContent>

                        <TabsContent value="files" className="flex-1 p-0 m-0 overflow-hidden relative">
                            <ScrollArea className="h-full p-4 md:p-6">
                                {files.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/10">
                                        <Paperclip className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                                        <p>No hay archivos adjuntos.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {files.map(f => (
                                            <a key={f.id} href={f.archivo_url} target="_blank" rel="noreferrer" className="group relative aspect-square border rounded-lg overflow-hidden bg-muted/20 hover:shadow-md transition-all block">
                                                {f.tipo_archivo?.includes('image') ? (
                                                    <img src={f.archivo_url} className="w-full h-full object-cover" alt={f.nombre_archivo} />
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                                                        <FileText className="w-8 h-8 mb-2 text-muted-foreground" />
                                                        <span className="text-xs truncate w-full">{f.nombre_archivo}</span>
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs p-2 text-center">
                                                    <span className="truncate w-full">{f.nombre_archivo}</span>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Modal Asignación de Técnico */}
            <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Asignar Técnico</DialogTitle>
                        <DialogDescription>Selecciona el técnico responsable para este aviso.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>Técnico</Label>
                            <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar técnico..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">-- Sin Asignar --</SelectItem>
                                    {technicians.map((t) => (
                                        <SelectItem key={t.id} value={t.id}>
                                            {t.nombre} {t.apellidos}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            <p>ℹ️ Al asignar un técnico, el estado cambiará automáticamente a <strong>En Curso</strong>.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAssignOpen(false)}>Cancelar</Button>
                        <Button onClick={handleAssignTechnician} disabled={assignLoading}>
                            {assignLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Guardar Asignación
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* CLOSURE MODAL (SIGNATURE) */}
            <Dialog open={isClosureModalOpen} onOpenChange={setIsClosureModalOpen}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Cerrar Aviso de Trabajo</DialogTitle>
                        <DialogDescription>
                            Confirma la finalización del trabajo y recoge la firma del cliente.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="bg-muted/50 p-3 rounded-md text-sm border">
                            <span className="font-semibold block mb-1 text-xs uppercase text-muted-foreground">Solicitud Original</span>
                            {aviso?.descripcion_solicitud}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="desc">Descripción del trabajo realizado</Label>
                            <Textarea
                                id="desc"
                                placeholder="Describe brevemente la reparación o instalación..."
                                value={closureData.descripcion_tecnico}
                                onChange={(e) => setClosureData(prev => ({ ...prev, descripcion_tecnico: e.target.value }))}
                                className="min-h-[100px]"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Adjuntar Fotos / Documentos</Label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {closureFiles.map((file, idx) => (
                                    <div key={idx} className="relative group border rounded-md p-1 bg-muted/30">
                                        {file.type.startsWith('image/') ? (
                                            <img src={URL.createObjectURL(file)} alt="preview" className="w-16 h-16 object-cover rounded" />
                                        ) : (
                                            <div className="w-16 h-16 flex items-center justify-center bg-white rounded text-xs text-center break-all p-1">
                                                <FileText className="w-6 h-6 text-blue-500" />
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setClosureFiles(prev => prev.filter((_, i) => i !== idx))}
                                            className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5 shadow-sm hover:bg-destructive/90"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => closureFileInputRef.current?.click()}
                                    className="w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-md hover:bg-muted/50 transition-colors"
                                >
                                    <Paperclip className="w-6 h-6 text-muted-foreground" />
                                    <span className="text-[10px] text-muted-foreground">Añadir</span>
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => closureCameraInputRef.current?.click()}
                                    className="w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-md hover:bg-muted/50 transition-colors"
                                >
                                    <Camera className="w-6 h-6 text-muted-foreground" />
                                    <span className="text-[10px] text-muted-foreground">Foto</span>
                                </button>
                            </div>
                            <input
                                type="file"
                                ref={closureFileInputRef}
                                className="hidden"
                                multiple
                                accept="image/*,application/pdf"
                                onChange={(e) => { if (e.target.files) setClosureFiles(prev => [...prev, ...Array.from(e.target.files)]) }}
                            />
                            <input
                                type="file"
                                ref={closureCameraInputRef}
                                className="hidden"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => { 
                                    if (e.target.files) {
                                        setClosureFiles(prev => [...prev, ...Array.from(e.target.files)]);
                                    }
                                    if (closureCameraInputRef.current) closureCameraInputRef.current.value = '';
                                }}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="client">Nombre del firmante (Cliente)</Label>
                            <Input
                                id="client"
                                placeholder="Nombre y Apellidos"
                                value={closureData.cliente_acepta_nombre}
                                onChange={(e) => setClosureData(prev => ({ ...prev, cliente_acepta_nombre: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Firma del Cliente</Label>
                            <SignaturePad
                                canvasRef={canvasRef}
                                onClear={handleClearSignature}
                            />
                            <p className="text-xs text-muted-foreground">Firma dentro del recuadro.</p>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsClosureModalOpen(false)} disabled={isSubmitting}>Cancelar</Button>
                        <Button onClick={handleSubmitClosure} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white">
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Confirmar y Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* PDF Template (Hidden) */}
            <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                <div ref={printRef} className="w-[700px] bg-white p-8 text-black font-sans text-xs leading-normal">
                    {/* Header */}
                    <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4 break-inside-avoid">
                        <div>
                            <h1 className="text-2xl font-bold text-black">PARTE DE TRABAJO</h1>
                            <p className="text-black text-sm font-medium">Aviso #{aviso.id.slice(0,8)}</p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-lg font-bold text-black">OrkaRefor</h2>
                            <p className="text-black text-xs font-medium">Gestión de Mantenimiento</p>
                            <p className="text-black text-xs font-medium">{fmtMadrid(new Date())}</p>
                        </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6 break-inside-avoid">
                        <div>
                            <h3 className="text-[11px] font-bold uppercase text-black mb-1">Cliente / CCPP</h3>
                            <p className="font-bold text-sm bg-gray-50 p-2 rounded border border-gray-300 text-black">
                                {aviso.cliente_nombre || 'No especificado'}
                            </p>
                        </div>
                        <div>
                            <h3 className="text-[11px] font-bold uppercase text-black mb-1">Dirección</h3>
                            <p className="font-bold text-sm bg-gray-50 p-2 rounded border border-gray-300 text-black">
                                {aviso.direccion_servicio || 'No especificada'}
                            </p>
                        </div>
                        <div>
                            <h3 className="text-[11px] font-bold uppercase text-black mb-1">Fecha Solicitud</h3>
                            <p className="font-bold text-sm text-black border-b border-gray-200 pb-1">{fmtMadrid(aviso.created_at)}</p>
                        </div>
                        <div>
                            <h3 className="text-[11px] font-bold uppercase text-black mb-1">Estado</h3>
                            <p className="font-bold text-sm uppercase text-black border-b border-gray-200 pb-1">{aviso.estado}</p>
                        </div>
                        <div className="col-span-2">
                             <h3 className="text-[11px] font-bold uppercase text-black mb-1">Técnico Asignado</h3>
                             <p className="font-bold text-sm text-black border-b border-gray-200 pb-1">
                                {aviso.tecnico ? `${aviso.tecnico.nombre} ${aviso.tecnico.apellidos}` : 'Sin asignar'}
                            </p>
                        </div>
                    </div>

                    {/* Solicitud */}
                    <div className="mb-5 break-inside-avoid">
                        <h3 className="text-[11px] font-bold uppercase text-black mb-1 border-b border-black pb-1">Descripción de la Solicitud</h3>
                        <div className="bg-gray-50 p-3 rounded border border-gray-300 min-h-[60px] whitespace-pre-wrap text-sm font-medium text-black">
                            {aviso.descripcion_solicitud}
                        </div>
                    </div>

                    {/* Resolución */}
                    <div className="mb-5 break-inside-avoid">
                        <h3 className="text-[11px] font-bold uppercase text-black mb-1 border-b border-black pb-1">Resolución / Trabajo Realizado</h3>
                        <div className="bg-gray-50 p-3 rounded border border-gray-300 min-h-[80px] whitespace-pre-wrap text-sm font-medium text-black">
                            {aviso.descripcion_tecnico || 'Sin descripción del técnico.'}
                        </div>
                        {aviso.fecha_cierre && (
                            <p className="text-[11px] font-bold text-black mt-1 text-right">Fecha Cierre: {fmtMadrid(aviso.fecha_cierre)}</p>
                        )}
                    </div>

                    {/* Adjuntos List */}
                    {files.length > 0 && (
                        <div className="mb-5 break-inside-avoid">
                            <h3 className="text-[11px] font-bold uppercase text-black mb-1 border-b border-black pb-1">Archivos Adjuntos</h3>
                            <ul className="list-disc list-inside text-[11px] font-medium text-black grid grid-cols-2 gap-1">
                                {files.map(f => (
                                    <li key={f.id} className="truncate">{f.nombre_archivo}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Firmas */}
                    <div className="mt-8 flex break-inside-avoid align-bottom gap-8">
                        <div className="w-1/2">
                            <div className="border-t-2 border-black pt-2">
                                <p className="text-[11px] font-bold uppercase text-black mb-1">Firma del Técnico</p>
                                <p className="text-xs font-bold mb-2 text-black">{aviso.tecnico ? `${aviso.tecnico.nombre} ${aviso.tecnico.apellidos}` : ''}</p>
                            </div>
                        </div>
                        <div className="w-1/2">
                            <div className="border-t-2 border-black pt-2">
                                <p className="text-[11px] font-bold uppercase text-black mb-1">Conformidad Cliente</p>
                                <p className="text-xs font-bold mb-1 text-black">{aviso.cliente_acepta_nombre || 'Firma Cliente'}</p>
                                {aviso.firma_url ? (
                                    <img 
                                        src={aviso.firma_url} 
                                        alt="Firma" 
                                        className="h-20 object-contain border border-gray-300 bg-white p-1 max-w-full" 
                                        crossOrigin="anonymous" 
                                    />
                                ) : (
                                    <div className="h-20 border border-dashed border-gray-400 flex items-center justify-center text-black text-[10px] font-bold">
                                        Sin firma registrada
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-6 pt-2 text-center text-[10px] font-bold text-black border-t border-gray-200 break-inside-avoid">
                        <p>Documento generado automáticamente por OrkaRefor ERP. Ref: {aviso.id}</p>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default FarmAvisoDetail;