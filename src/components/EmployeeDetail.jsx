import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    ArrowLeft,
    Mail,
    Briefcase,
    Calendar,
    AlertTriangle,
    Loader2,
    Wrench,
    PackageOpen,
    CheckCircle2,
    XCircle,
    Building2,
    Smartphone,
    CreditCard,
    Plus,
    Pencil,
    Trash2,
    Euro,
    Clock,
    Palmtree,
    Gavel
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EmployeeHabilidadesTab from '@/components/EmployeeHabilidadesTab';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FileManager from '@/components/FileManager';
import EmployeeAnticiposTab from '@/components/EmployeeAnticiposTab';
import EmployeeEmbargosTab from '@/components/EmployeeEmbargosTab';
import EmployeeHistoryTab from '@/components/EmployeeHistoryTab';
// Removed: EmployeeHorasExtrasTab
import HorasExtras2View from '@/components/HorasExtras2View';
import EmployeeToolAssignmentModal from '@/components/EmployeeToolAssignmentModal';
import EditToolAssignmentModal from '@/components/EditToolAssignmentModal';
import EmployeeEditModal from '@/components/EmployeeEditModal';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, differenceInYears, differenceInMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { useLocation } from 'react-router-dom';

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
    if (error) return null;
    return data.signedUrl;
};

const EmployeeToolCard = ({ assignment, navigate, canManage, onEdit, onDelete }) => {
    const tool = assignment.herramienta;
    const [imgUrl, setImgUrl] = useState(tool?.foto_url);

    useEffect(() => {
        if (!imgUrl && tool?.foto_path) {
            signedFotoUrl(tool.foto_path).then(url => {
                if (url) setImgUrl(url);
            });
        }
    }, [tool, imgUrl]);

    if (!tool) return null;

    const handleCardClick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (tool.id) {
            const cleanId = String(tool.id).trim();
            navigate(`/inventario/herramientas/${cleanId}`);
        }
    };

    return (
        <Card
            className="overflow-hidden hover:shadow-lg transition-all border-l-4 border-l-primary/20 cursor-pointer group relative rounded-xl"
            onClick={handleCardClick}
        >
            {canManage && (
                <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7 bg-white/90 hover:bg-white shadow-sm border border-gray-200"
                        onClick={(e) => { e.stopPropagation(); onEdit(assignment); }}
                        title="Editar asignación"
                    >
                        <Pencil className="h-3.5 w-3.5 text-gray-700" />
                    </Button>
                    <Button
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7 bg-white/90 hover:bg-red-50 shadow-sm border border-gray-200"
                        onClick={(e) => { e.stopPropagation(); onDelete(assignment); }}
                        title="Eliminar asignación (Devolver al stock)"
                    >
                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                </div>
            )}

            <div className="flex h-28">
                <div className="w-28 min-w-[7rem] bg-muted/30 flex items-center justify-center overflow-hidden relative">
                    {imgUrl ? (
                        <img src={imgUrl} alt={tool.nombre || 'Herramienta'} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    ) : (
                        <Wrench className="w-8 h-8 text-muted-foreground/40" />
                    )}
                </div>
                <div className="p-3 flex flex-col justify-between w-full overflow-hidden">
                    <div>
                        <div className="flex justify-between items-start gap-2">
                            <h4 className="font-bold text-sm truncate w-full text-foreground" title={tool.nombre}>{tool.nombre}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">Ref: {tool.ref_almacen || 'S/R'}</p>
                    </div>

                    <div className="flex items-end justify-between mt-1">
                        <div className="flex flex-col items-end text-[10px] text-muted-foreground w-full">
                            <div className="flex items-center mb-1" title="Fecha de asignación">
                                <Calendar className="w-3 h-3 mr-1" />
                                {assignment.created_at ? new Date(assignment.created_at).toLocaleDateString() : '-'}
                            </div>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-gray-200 bg-gray-50 text-gray-600 w-fit ml-auto">
                                {assignment.estado?.replace('_', ' ').toUpperCase()}
                            </Badge>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
};

const EmployeeDetail = ({ employeeId, navigate }) => {
    const { sessionRole, user } = useAuth();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const defaultTab = searchParams.get('tab') || 'datos';
    const returnUrl = searchParams.get('returnUrl');
    const taskIdString = searchParams.get('taskId');

    const [employee, setEmployee] = useState(null);
    const [tools, setTools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingTools, setLoadingTools] = useState(true);
    const [isUpdatingState, setIsUpdatingState] = useState(false);

    // CRUD State for Tools
    const [isAssignModalOpen, setAssignModalOpen] = useState(false);
    const [isEditAssignmentModalOpen, setEditAssignmentModalOpen] = useState(false);
    const [isDeleteAssignmentDialogOpen, setDeleteAssignmentDialogOpen] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [isProcessingDelete, setProcessingDelete] = useState(false);
    const [isEditEmployeeModalOpen, setIsEditEmployeeModalOpen] = useState(false);

    const fileInputRef = useRef(null);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

    const isAdminOrEncargado = sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado';

    const fetchEmployeeData = useCallback(async () => {
        setLoading(true);
        if (!employeeId) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se ha proporcionado un ID de empleado.' });
            setLoading(false);
            return;
        }

        const { data, error } = await supabase.from('empleados').select('*').eq('id', employeeId).single();

        if (error) {
            toast({ variant: 'destructive', title: 'Error al cargar empleado', description: error.message });
            setEmployee(null);
        } else {
            setEmployee(data);
        }
        setLoading(false);
    }, [employeeId]);

    const fetchAssignedTools = useCallback(async () => {
        setLoadingTools(true);

        const { data, error } = await supabase
            .from('herramienta_asignaciones')
            .select(`
                id,
                created_at,
                estado,
                devuelta_at,
                proyecto_id,
                observaciones,
                herramienta:herramientas (
                    id,
                    nombre,
                    foto_url,
                    foto_path,
                    ref_almacen
                )
            `)
            .eq('entregada_a', employeeId)
            .in('estado', ['en_uso', 'pendiente_aceptacion', 'pendiente_revision', 'rechazada_en_revision']) // Only active
            .is('devuelta_at', null) // Ensure not returned
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching tools:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las herramientas.' });
        } else {
            setTools(data || []);
        }
        setLoadingTools(false);
    }, [employeeId]);

    useEffect(() => {
        fetchEmployeeData();
        fetchAssignedTools();
    }, [fetchEmployeeData, fetchAssignedTools]);

    const handlePhotoUpload = async (file) => {
        if (!employeeId) return;

        setIsUploadingPhoto(true);
        const fileExt = file.name.split('.').pop();
        const filePath = `avatares/${employeeId}-${Date.now()}.${fileExt}`;

        try {
            const { error: uploadError } = await supabase.storage
                .from('perfiles')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('perfiles')
                .getPublicUrl(filePath);

            const publicUrl = publicUrlData.publicUrl;

            const { error: updateError } = await supabase
                .from('empleados')
                .update({ foto_url: publicUrl })
                .eq('id', employeeId);

            if (updateError) throw updateError;

            toast({ title: 'Foto actualizada', description: 'La foto de perfil se ha guardado correctamente.' });

            fetchEmployeeData();

        } catch (error) {
            console.error('Error uploading photo:', error);
            toast({ variant: 'destructive', title: 'Error al subir foto', description: error.message || 'No se pudo subir la foto de perfil.' });
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleSetState = async (newState) => {
        setIsUpdatingState(true);
        const { error } = await supabase.rpc('api_empleado_cambiar_estado', {
            p_empleado_id: employeeId,
            p_estado: newState
        });
        if (error) {
            toast({ variant: 'destructive', title: 'Error al cambiar estado', description: error.message });
        } else {
            toast({ title: 'Estado actualizado' });
            await fetchEmployeeData();
        }
        setIsUpdatingState(false);
    }

    // --- Tool CRUD Handlers ---

    const handleEditAssignment = (assignment) => {
        setSelectedAssignment(assignment);
        setEditAssignmentModalOpen(true);
    };

    const handleDeleteAssignmentClick = (assignment) => {
        setSelectedAssignment(assignment);
        setDeleteAssignmentDialogOpen(true);
    };

    const handleConfirmDeleteAssignment = async () => {
        if (!selectedAssignment) return;
        setProcessingDelete(true);
        try {
            const { error } = await supabase.rpc('admin_eliminar_asignacion_restaurar_stock', {
                p_asignacion_id: selectedAssignment.id
            });

            if (error) throw error;

            toast({ title: 'Asignación eliminada', description: 'La herramienta ha sido desvinculada y el stock restaurado.' });
            fetchAssignedTools();
        } catch (error) {
            console.error("Error deleting assignment:", error);
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo eliminar la asignación.' });
        } finally {
            setProcessingDelete(false);
            setDeleteAssignmentDialogOpen(false);
            setSelectedAssignment(null);
        }
    };

    const getCurrentStateValue = (emp) => {
        if (!emp) return 'activo';
        if (emp.baja) return 'baja';
        if (emp.vacaciones) return 'vacaciones';
        return 'activo';
    };

    const getSeniorityText = (dateString) => {
        if (!dateString) return null;
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return null;

        const now = new Date();
        const years = differenceInYears(now, date);
        const months = differenceInMonths(now, date) % 12;

        let text = format(date, 'dd/MM/yyyy', { locale: es });
        if (years > 0 || months > 0) {
            const parts = [];
            if (years > 0) parts.push(`${years} año${years !== 1 ? 's' : ''}`);
            if (months > 0) parts.push(`${months} mes${months !== 1 ? 'es' : ''}`);
            text += ` (${parts.join(', ')})`;
        }
        return text;
    };

    const getStatusBadge = (emp) => {
        if (!emp) return null;
        if (emp.baja) return <Badge variant="destructive" className="bg-red-500/20 text-red-700 border-red-500/30">De Baja</Badge>;
        if (emp.vacaciones) return <Badge variant="secondary" className="bg-orange-500/20 text-orange-700 border-orange-500/30">De Vacaciones</Badge>;
        if (emp.activo) return <Badge variant="default" className="bg-green-500/20 text-green-700 border-green-500/30">Activo</Badge>;
        return <Badge variant="secondary">Inactivo</Badge>
    };

    if (loading && !employee) {
        return <div className="flex items-center justify-center h-full p-8"><Loader2 className="w-16 h-16 animate-spin text-primary" /></div>;
    }

    if (!employee) {
        return (
            <div className="p-8 text-center text-destructive">
                <AlertTriangle className="mx-auto h-12 w-12" />
                <h2 className="mt-4 text-xl font-semibold">Empleado no encontrado</h2>
                <p>No se pudo cargar la información del empleado o no tienes permiso para verlo.</p>
                <Button onClick={() => navigate('/personal/empleados')} className="mt-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver a la lista
                </Button>
            </div>
        );
    }

    const isOwnProfile = user?.id === employee.auth_user_id;
    const canEditPhoto = isAdminOrEncargado || isOwnProfile;

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 pb-16">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div className="flex gap-3 items-center">
                        <Button variant="ghost" onClick={() => navigate('/personal/empleados')}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Empleados
                        </Button>
                        {returnUrl && taskIdString && (
                            <Button
                                variant="outline"
                                className="border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-100 hover:text-blue-800 shadow-sm"
                                onClick={() => {
                                    const sep = returnUrl.includes('?') ? '&' : '?';
                                    navigate(`${returnUrl}${sep}openTask=${taskIdString}`);
                                }}
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" /> Volver a la Tarea
                            </Button>
                        )}
                    </div>
                </div>

                <Card className="mb-8 shadow-lg border-t-4 border-t-primary rounded-xl">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start flex-wrap gap-4">

                            <div className="flex items-center gap-4">
                                <div className="relative group">
                                    {employee.foto_url ? (
                                        <img
                                            src={employee.foto_url}
                                            alt={`Foto de ${employee.nombre}`}
                                            className="w-20 h-20 rounded-full object-cover border-4 border-primary/20 shadow-md"
                                        />
                                    ) : (
                                        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary border-4 border-primary/20 shadow-md">
                                            {employee.nombre.charAt(0)}
                                        </div>
                                    )}

                                    {canEditPhoto && (
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploadingPhoto}
                                            className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-xs font-semibold"
                                        >
                                            {isUploadingPhoto ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Cambiar'}
                                        </button>
                                    )}
                                </div>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            handlePhotoUpload(e.target.files[0]);
                                        }
                                    }}
                                />

                                <div>
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-2xl font-bold text-foreground">{employee.nombre} {employee.apellidos}</CardTitle>
                                        {isAdminOrEncargado && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 hover:bg-slate-100 rounded-full"
                                                onClick={() => setIsEditEmployeeModalOpen(true)}
                                                title="Editar datos del empleado"
                                            >
                                                <Pencil className="h-4 w-4 text-slate-500" />
                                            </Button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-sm">
                                        <Briefcase className="w-3 h-3 text-muted-foreground" />
                                        <span className="capitalize text-muted-foreground">{employee.rol}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">{getStatusBadge(employee)}</div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue={defaultTab} className="mt-6">
                            <TabsList className="relative bg-muted/50 p-1 rounded-lg w-full md:w-auto">
                                <div className="flex items-center justify-start overflow-x-auto pb-1 md:pb-0">
                                    <TabsTrigger value="datos">Datos</TabsTrigger>
                                    <TabsTrigger value="herramientas">Herramientas</TabsTrigger>
                                    <TabsTrigger value="documentacion">Documentación</TabsTrigger>
                                    <TabsTrigger value="historial">Ausencias</TabsTrigger>
                                    <TabsTrigger value="extras">Horas Extras</TabsTrigger>
                                    <TabsTrigger value="habilidades">Habilidades</TabsTrigger>
                                    {isAdminOrEncargado && (
                                        <>
                                            <TabsTrigger value="anticipos">
                                                <CreditCard className="w-4 h-4 mr-2 text-green-600" />
                                                Anticipos
                                            </TabsTrigger>
                                            <TabsTrigger value="embargos">
                                                <Gavel className="w-4 h-4 mr-2 text-amber-600" />
                                                Embargos
                                            </TabsTrigger>
                                        </>
                                    )}
                                </div>
                            </TabsList>

                            <TabsContent value="datos" className="pt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <Card className="border shadow-sm rounded-lg">
                                    <CardContent className="pt-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Contacto</Label>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Mail className="w-4 h-4 text-primary/70" />
                                                    <a href={`mailto:${employee.email}`} className="text-sm hover:underline font-medium text-foreground">{employee.email}</a>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Smartphone className="w-4 h-4 text-primary/70" />
                                                    <span className="text-xs text-muted-foreground w-16">Personal:</span>
                                                    <a href={`tel:${employee.telefono}`} className="text-sm hover:underline font-medium text-foreground">{employee.telefono || '—'}</a>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Building2 className="w-4 h-4 text-primary/70" />
                                                    <span className="text-xs text-muted-foreground w-16">Empresa:</span>
                                                    <a href={`tel:${employee.telefono_empresa}`} className="text-sm hover:underline font-medium text-foreground">{employee.telefono_empresa || '—'}</a>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Información Laboral</Label>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Briefcase className="w-4 h-4 text-primary/70" />
                                                    <span className="text-sm font-medium capitalize text-foreground">{employee.rol}</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Euro className="w-4 h-4 text-primary/70" />
                                                    <span className="text-sm font-medium text-foreground">{employee.costo_por_hora != null ? `${employee.costo_por_hora} € / hora` : '—'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Clock className="w-4 h-4 text-primary/70" />
                                                    <span className="text-sm font-medium text-foreground">{getSeniorityText(employee.fecha_incorporacion) || '—'}</span>
                                                </div>
                                            </div>
                                            {isAdminOrEncargado && (
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Gestión de Estado</Label>
                                                    <Select
                                                        id="estado-empleado"
                                                        value={getCurrentStateValue(employee)}
                                                        onValueChange={handleSetState}
                                                        disabled={isUpdatingState}
                                                    >
                                                        <SelectTrigger className="w-full md:w-[200px]">
                                                            {isUpdatingState ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                                            <SelectValue placeholder="Cambiar estado..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="activo">
                                                                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Activo</div>
                                                            </SelectItem>
                                                            <SelectItem value="vacaciones">
                                                                <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-yellow-500" /> Vacaciones</div>
                                                            </SelectItem>
                                                            <SelectItem value="baja">
                                                                <div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-red-500" /> Baja</div>
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="herramientas" className="pt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {isAdminOrEncargado && (
                                    <div className="mb-4 flex justify-end">
                                        <Button onClick={() => setAssignModalOpen(true)} size="sm" className="shadow-sm">
                                            <Plus className="w-4 h-4 mr-2" />
                                            Asignar Herramienta
                                        </Button>
                                    </div>
                                )}

                                {loadingTools ? (
                                    <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                                ) : tools.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {tools.map((assignment) => (
                                            <EmployeeToolCard
                                                key={assignment.id}
                                                assignment={assignment}
                                                navigate={navigate}
                                                canManage={isAdminOrEncargado}
                                                onEdit={handleEditAssignment}
                                                onDelete={handleDeleteAssignmentClick}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center p-12 bg-muted/30 border rounded-xl border-dashed flex flex-col items-center justify-center">
                                        <div className="bg-muted p-4 rounded-full mb-4">
                                            <PackageOpen className="h-8 w-8 text-muted-foreground/50" />
                                        </div>
                                        <h3 className="text-lg font-medium text-foreground">Sin herramientas asignadas</h3>
                                        <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs">Este empleado no tiene ninguna herramienta asignada actualmente.</p>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="documentacion" className="pt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <FileManager bucketName="empleados_docs" prefix={employee.id} canEdit={isAdminOrEncargado} />
                            </TabsContent>

                            <TabsContent value="historial" className="pt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <Card className="mb-6 bg-blue-50/50 border-blue-100 dark:bg-blue-950/10 dark:border-blue-900 shadow-sm rounded-lg">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-blue-100 dark:bg-blue-900 p-2.5 rounded-full">
                                                <Palmtree className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Días de Vacaciones Pendientes</p>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                                                        {employee.dias_vacaciones_restantes ?? 0}
                                                    </span>
                                                    <span className="text-sm text-muted-foreground">días</span>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <EmployeeHistoryTab employeeId={employee.id} />
                            </TabsContent>

                            <TabsContent value="extras" className="pt-6 animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
                                {/* Only HorasExtras2View embedded here, replacing previous duplicate logic */}
                                <HorasExtras2View employeeId={employee.id} isEmbedded={true} />
                            </TabsContent>
                            <TabsContent value="habilidades" className="pt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <EmployeeHabilidadesTab employeeId={employee.id} isAdminOrEncargado={isAdminOrEncargado} />
                            </TabsContent>
                            {isAdminOrEncargado && (
                                <>
                                    <TabsContent value="anticipos" className="pt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <EmployeeAnticiposTab employee={employee} sessionRole={sessionRole} currentUser={user} />
                                    </TabsContent>
                                    <TabsContent value="embargos" className="pt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <EmployeeEmbargosTab employee={employee} sessionRole={sessionRole} navigate={navigate} />
                                    </TabsContent>
                                </>
                            )}
                        </Tabs>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Modals */}
            {isAssignModalOpen && (
                <EmployeeToolAssignmentModal
                    isOpen={isAssignModalOpen}
                    onClose={() => setAssignModalOpen(false)}
                    employeeId={employeeId}
                    onSuccess={fetchAssignedTools}
                />
            )}

            {isEditAssignmentModalOpen && (
                <EditToolAssignmentModal
                    isOpen={isEditAssignmentModalOpen}
                    onClose={() => {
                        setEditAssignmentModalOpen(false);
                        setSelectedAssignment(null);
                    }}
                    assignment={selectedAssignment}
                    onSuccess={fetchAssignedTools}
                />
            )}

            {isEditEmployeeModalOpen && (
                <EmployeeEditModal
                    isOpen={isEditEmployeeModalOpen}
                    onClose={() => setIsEditEmployeeModalOpen(false)}
                    employee={employee}
                    onSuccess={fetchEmployeeData}
                />
            )}

            <AlertDialog open={isDeleteAssignmentDialogOpen} onOpenChange={setDeleteAssignmentDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar asignación?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Estás a punto de desvincular la herramienta <strong>{selectedAssignment?.herramienta?.nombre}</strong>.
                            <br /><br />
                            Esta acción eliminará el registro de asignación y <strong>restaurará el stock</strong> de la herramienta en +1 unidad.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isProcessingDelete}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); handleConfirmDeleteAssignment(); }}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                            disabled={isProcessingDelete}
                        >
                            {isProcessingDelete ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Eliminar y Restaurar Stock
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
};

export default EmployeeDetail;