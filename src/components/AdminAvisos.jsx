import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { 
    Loader2, 
    Plus, 
    Search, 
    Eye, 
    FileText, 
    Calendar, 
    User, 
    MapPin, 
    Briefcase,
    CheckCircle2,
    Clock,
    Paperclip,
    X,
    Download,
    Trash2,
    Image,
    Share2,
    UserPlus
} from 'lucide-react';
import { fmtMadrid } from '@/lib/utils';
import AvisoShareModal from '@/components/AvisoShareModal';
import { v4 as uuidv4 } from 'uuid';

// CAMBIO 1: El componente debe recibir la prop 'navigate'
const AdminAvisos = ({ navigate }) => {
    const { user, sessionRole } = useAuth();
    const [adminEmployeeId, setAdminEmployeeId] = useState(null); 
    const [avisos, setAvisos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Catalog State
    const [projects, setProjects] = useState([]);
    const [technicians, setTechnicians] = useState([]);

    // Modal State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    // ELIMINADO: const [isViewOpen, setIsViewOpen] = useState(false);
    // ELIMINADO: const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isAssignOpen, setIsAssignOpen] = useState(false); 
    
    const [selectedAviso, setSelectedAviso] = useState(null); // Mantenido para Modal de Asignación
    const [createLoading, setCreateLoading] = useState(false);
    const [assignLoading, setAssignLoading] = useState(false);
    
    // ELIMINADO: Files state and related refs (ya que la vista detallada maneja esto)
    // const [existingFiles, setExistingFiles] = useState([]);
    // const [comments, setComments] = useState([]);
    const [newFiles, setNewFiles] = useState([]); // Mantenido para Modal de Creación
    const fileInputRef = useRef(null); // Mantenido para Modal de Creación
    // const viewFileInputRef = useRef(null); // ELIMINADO

    // Form Data
    const [formData, setFormData] = useState({
        descripcion_solicitud: '',
        proyecto_id: '',
        tecnico_asignado_id: '',
        direccion_servicio: '',
        cliente_nombre: ''
    });

    const [assignTechnicianId, setAssignTechnicianId] = useState('');

    // Obtener ID del empleado logeado
    useEffect(() => {
        const loadAdminId = async () => {
            if (!user) return;
            const { data } = await supabase.from('empleados').select('id').eq('auth_user_id', user.id).single();
            if (data) setAdminEmployeeId(data.id);
        };
        loadAdminId();
    }, [user]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: avisosData, error: avisosError } = await supabase
                .from('avisos')
                .select(`
                    *,
                    tecnico:empleados!avisos_tecnico_asignado_id_fkey(id, nombre, apellidos, email),
                    proyecto:proyectos(id, nombre_proyecto),
                    creador_interno:empleados!avisos_creador_id_fkey(nombre, apellidos, rol)
                `)
                .order('created_at', { ascending: false });

            if (avisosError) throw avisosError;
            setAvisos(avisosData || []);

            const { data: projectsData } = await supabase
                .from('proyectos')
                .select('id, nombre_proyecto')
                .eq('estado', 'activo')
                .order('nombre_proyecto');
            setProjects(projectsData || []);

            const { data: techData } = await supabase
                .from('empleados')
                .select('id, nombre, apellidos')
                .eq('activo', true)
                .in('rol', ['tecnico', 'encargado', 'admin'])
                .order('nombre');
            setTechnicians(techData || []);

        } catch (error) {
            console.error('Error fetching data:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los datos.' });
        } finally {
            setLoading(false);
        }
    };

    // ELIMINADO: fetchDetails (Ya no se necesita aquí)
    // const fetchDetails = async (avisoId) => { ... };

    const handleFileSelect = (e, isView = false) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            if (isView) {
                // Se mantiene handleDirectUpload por si se usa en otro lugar, pero no es accesible desde aquí.
                handleDirectUpload(files);
            } else {
                // Add to state if in Create mode
                setNewFiles(prev => [...prev, ...files]);
            }
        }
    };

    const handleRemoveNewFile = (index) => {
        setNewFiles(prev => prev.filter((_, i) => i !== index));
    };

    // NOTA: handleDirectUpload y handleDeleteExistingFile se dejan por si se usan en la Modal de Creación.
    // Su funcionalidad principal en la Modal de Vista Detallada ha sido eliminada.
    const handleDirectUpload = async (filesToUpload) => { /* ... */ }; // (Sin cambios)
    const handleDeleteExistingFile = async (fileId, filePath) => { /* ... */ }; // (Sin cambios)

    const handleCreate = async () => {
        if (!formData.descripcion_solicitud || !formData.tecnico_asignado_id || !formData.direccion_servicio) {
            toast({ variant: 'destructive', title: 'Campos requeridos', description: 'Completa la descripción, técnico y dirección.' });
            return;
        }
        if (!adminEmployeeId) {
             toast({ variant: 'destructive', title: 'Error', description: 'Falta el ID del creador. Vuelve a cargar la página.' });
             return;
        }

        setCreateLoading(true);
        try {
            // 1. Insert Aviso (Sin cambios)
            const { data: newAviso, error } = await supabase
                .from('avisos')
                .insert([{
                    descripcion_solicitud: formData.descripcion_solicitud,
                    proyecto_id: formData.proyecto_id || null,
                    tecnico_asignado_id: formData.tecnico_asignado_id,
                    direccion_servicio: formData.direccion_servicio,
                    cliente_nombre: formData.cliente_nombre,
                    estado: 'pendiente', 
                    
                    creador_id: adminEmployeeId, 
                    creador_rol: sessionRole.rol === 'admin' ? 'Admin' : 'Encargado', 
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;

            // 2. Upload Files if any (Sin cambios)
            if (newFiles.length > 0) {
                const uploadPromises = newFiles.map(async (file) => {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `avisos/${newAviso.id}/${uuidv4()}.${fileExt}`;
                    
                    const { error: uploadFileError } = await supabase.storage
                        .from('avisos-files')
                        .upload(fileName, file);

                    if (uploadFileError) throw uploadFileError;

                    const { data: fileUrlData } = supabase.storage.from('avisos-files').getPublicUrl(fileName);
                    
                    return supabase.from('avisos_archivos').insert({
                        aviso_id: newAviso.id,
                        archivo_url: fileUrlData.publicUrl,
                        nombre_archivo: file.name,
                        tipo_archivo: file.type,
                        subido_por: adminEmployeeId
                    });
                });

                await Promise.all(uploadPromises);
            }

            toast({ title: 'Aviso creado', description: 'El aviso ha sido asignado al técnico correctamente.' });
            setIsCreateOpen(false);
            setFormData({
                descripcion_solicitud: '',
                proyecto_id: '',
                tecnico_asignado_id: '',
                direccion_servicio: '',
                cliente_nombre: ''
            });
            setNewFiles([]);
            fetchData();
        } catch (error) {
            console.error('Error creating aviso:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo crear el aviso.' });
        } finally {
            setCreateLoading(false);
        }
    };

    // CAMBIO 2: handleViewDetails ahora navega a la ruta detallada
    const handleViewDetails = (aviso) => {
        if (navigate) {
            // Usamos la misma ruta que FarmAdmin y Technician
            navigate(`/finca/avisos/detail/${aviso.id}`);
        } else {
            toast({ variant: 'destructive', title: 'Error de navegación', description: 'Falta la función navigate.' });
        }
    };

    const openAssignModal = (aviso) => {
        setSelectedAviso(aviso);
        setAssignTechnicianId(aviso.tecnico_asignado_id || '');
        setIsAssignOpen(true);
    };

    const handleAssignTechnician = async () => {
        if (!assignTechnicianId) return;
        setAssignLoading(true);
        try {
            const { error } = await supabase
                .from('avisos')
                .update({ 
                    tecnico_asignado_id: assignTechnicianId,
                    estado: 'en_curso' // Cuando se asigna, el estado pasa a En Curso
                })
                .eq('id', selectedAviso.id);

            if (error) throw error;

            toast({ title: 'Técnico Asignado', description: 'El aviso se ha actualizado correctamente.' });
            setIsAssignOpen(false);
            fetchData();
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo asignar el técnico.' });
        } finally {
            setAssignLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'cerrado':
                return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Cerrado</Badge>;
            case 'en_curso':
                return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200"><Clock className="w-3 h-3 mr-1" /> En Curso</Badge>;
            default:
                return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200">Pendiente</Badge>;
        }
    };
    
    // Función para obtener el nombre completo del creador
    const getCreatorDisplay = (aviso) => {
        // 1. Si es un creador interno (Admin/Encargado/Tecnico)
        if (aviso.creador_interno) {
            return `${aviso.creador_interno.nombre} ${aviso.creador_interno.apellidos} (${aviso.creador_interno.rol.charAt(0).toUpperCase()})`;
        }
        // 2. Si es un creador externo (Finca Admin, etc.)
        if (aviso.creador_rol) {
            // Utilizamos el creador_rol para mostrar el tipo de entidad que lo creó
            return aviso.creador_rol;
        }
        // 3. Si no hay información (podría ser un aviso antiguo o creado sin rol)
        return 'Sistema/Interno';
    };

    const filteredAvisos = avisos.filter(a => 
        a.descripcion_solicitud?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.cliente_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.tecnico?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.proyecto?.nombre_proyecto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getCreatorDisplay(a).toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <>
            <Helmet><title>Gestión de Avisos | Admin</title></Helmet>

            <div className="p-6 max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Briefcase className="w-8 h-8 text-primary" />
                            Gestión de Órdenes de Trabajo
                        </h1>
                        <p className="text-muted-foreground">Administra las órdenes de trabajo y asignaciones a técnicos.</p>
                    </div>
                    <Button onClick={() => setIsCreateOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" /> Nuevo Aviso
                    </Button>
                </div>

                <div className="flex items-center gap-2 bg-background p-2 rounded-lg border w-full md:w-96">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar por descripción, creador, técnico..." 
                        className="border-none shadow-none focus-visible:ring-0"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="rounded-md border bg-card shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Creador</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead>Técnico (Asignado)</TableHead>
                                <TableHead>Ubicación</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        <div className="flex justify-center items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" /> Cargando avisos...
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredAvisos.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        No se encontraron avisos.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredAvisos.map((aviso) => (
                                    <TableRow key={aviso.id} className="hover:bg-muted/50">
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col text-xs">
                                                <span>{fmtMadrid(aviso.created_at, 'date')}</span>
                                                <span className="text-muted-foreground">{fmtMadrid(aviso.created_at, 'time')}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-normal bg-muted/50">
                                                {getCreatorDisplay(aviso)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[200px]">
                                            <div className="truncate font-medium text-sm" title={aviso.descripcion_solicitud}>{aviso.descripcion_solicitud}</div>
                                        </TableCell>
                                        <TableCell>
                                            {aviso.tecnico ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary font-bold">
                                                        {aviso.tecnico.nombre.charAt(0)}
                                                    </div>
                                                    <span className="text-sm">{aviso.tecnico.nombre} {aviso.tecnico.apellidos}</span>
                                                </div>
                                            ) : (
                                                <Button variant="ghost" size="sm" className="h-6 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-2" onClick={() => openAssignModal(aviso)}>
                                                    <UserPlus className="w-3 h-3 mr-1" /> Asignar
                                                </Button>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-xs text-muted-foreground flex items-center gap-1 truncate max-w-[150px]" title={aviso.direccion_servicio}>
                                                <MapPin className="w-3 h-3 shrink-0" /> {aviso.direccion_servicio}
                                            </div>
                                        </TableCell>
                                        <TableCell>{getStatusBadge(aviso.estado)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                {aviso.tecnico && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openAssignModal(aviso)} title="Reasignar">
                                                        <UserPlus className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" onClick={() => handleViewDetails(aviso)}>
                                                    <Eye className="w-4 h-4 mr-2" /> Detalles
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Modal Crear Aviso (Mantenido) */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Crear Nuevo Aviso</DialogTitle>
                        <DialogDescription>Asigna una orden de trabajo a un técnico.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="desc">Descripción del trabajo</Label>
                            <Textarea 
                                id="desc" 
                                placeholder="Ej: Reparar fuga en baño principal..."
                                value={formData.descripcion_solicitud}
                                onChange={(e) => setFormData({ ...formData, descripcion_solicitud: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Técnico Asignado</Label>
                                <Select 
                                    onValueChange={(val) => setFormData({ ...formData, tecnico_asignado_id: val })}
                                    value={formData.tecnico_asignado_id}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {technicians.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.nombre} {t.apellidos}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Proyecto (Opcional)</Label>
                                <Select 
                                    onValueChange={(val) => setFormData({ ...formData, proyecto_id: val === 'none' ? null : val })}
                                    value={formData.proyecto_id || 'none'}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Sin proyecto..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Sin proyecto asociado</SelectItem>
                                        {projects.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.nombre_proyecto}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="dir">Dirección del Servicio</Label>
                            <Input 
                                id="dir" 
                                placeholder="Calle, Número, Piso..." 
                                value={formData.direccion_servicio}
                                onChange={(e) => setFormData({ ...formData, direccion_servicio: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="client">Cliente / Contacto (Nombre)</Label>
                            <Input 
                                id="client" 
                                placeholder="Nombre del cliente in-situ" 
                                value={formData.cliente_nombre}
                                onChange={(e) => setFormData({ ...formData, cliente_nombre: e.target.value })}
                            />
                        </div>
                        
                        <div className="grid gap-2">
                            <Label>Adjuntar Archivos (Fotos/PDF)</Label>
                            <div className="flex flex-wrap gap-2">
                                {newFiles.map((file, idx) => (
                                    <div key={idx} className="relative group border rounded p-1 bg-muted/30">
                                        <div className="w-12 h-12 flex items-center justify-center text-xs truncate" title={file.name}>
                                            {file.type.includes('image') ? <Image className="w-5 h-5 text-blue-500" /> : <FileText className="w-5 h-5 text-red-500" />}
                                        </div>
                                        <button onClick={() => handleRemoveNewFile(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="icon" className="w-12 h-12" onClick={() => fileInputRef.current?.click()}>
                                    <Paperclip className="w-4 h-4" />
                                </Button>
                            </div>
                            <input type="file" multiple className="hidden" ref={fileInputRef} onChange={e => handleFileSelect(e, false)} accept="image/*,application/pdf" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreate} disabled={createLoading}>
                            {createLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Crear Aviso
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal Asignar Técnico (Mantenido) */}
            <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Asignar Técnico</DialogTitle>
                        <DialogDescription>Selecciona el técnico responsable de este aviso.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="space-y-2">
                            <Label>Aviso Creado por: <span className='font-medium'>{selectedAviso ? getCreatorDisplay(selectedAviso) : '...'}</span></Label>
                            <Label>Técnico</Label>
                            <Select value={assignTechnicianId} onValueChange={setAssignTechnicianId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar técnico..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {technicians.map((tech) => (
                                        <SelectItem key={tech.id} value={tech.id}>
                                            {tech.nombre} {tech.apellidos}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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

            {/* ELIMINADO: Modal Ver Detalles (reemplazado por navegación) */}
            
            {/* ELIMINADO: AvisoShareModal (la lógica se debe mover a la vista detallada) */}
        </>
    );
};

export default AdminAvisos;