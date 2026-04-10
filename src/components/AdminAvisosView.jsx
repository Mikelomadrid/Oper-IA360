import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { 
    Briefcase, Plus, Search, Loader2, MapPin, Calendar, 
    User, Filter, X, Paperclip, Image as ImageIcon, 
    CheckCircle2, AlertCircle, Clock, FileText, HardHat, FileArchive
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
    Card, CardContent, CardHeader, CardTitle, CardFooter
} from '@/components/ui/card';
import { fmtMadrid } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

const AdminAvisosView = ({ navigate }) => {
    const { user } = useAuth();
    const [avisos, setAvisos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Filters
    const [statusFilter, setStatusFilter] = useState('all');
    const [creatorFilter, setCreatorFilter] = useState('all');
    const [technicianFilter, setTechnicianFilter] = useState('all');

    const [technicians, setTechnicians] = useState([]);
    
    // Create Modal State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newFiles, setNewFiles] = useState([]);
    const fileInputRef = useRef(null);
    
    // Form Data
    const [formData, setFormData] = useState({
        descripcion: '',
        direccion: '', // This will hold the CCPP
        cliente_nombre: '',
        telefono: '',
        tecnico_id: 'none',
    });

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            await Promise.all([fetchAvisos(), fetchCatalogs()]);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Error al cargar datos iniciales.' });
        } finally {
            setLoading(false);
        }
    };

    const fetchCatalogs = async () => {
        const { data: techData } = await supabase
            .from('empleados')
            .select('id, nombre, apellidos')
            .in('rol', ['tecnico', 'encargado', 'admin'])
            .eq('activo', true)
            .order('nombre');
        setTechnicians(techData || []);
    };

    const fetchAvisos = async () => {
        const { data, error } = await supabase
            .from('avisos')
            .select(`
                *,
                tecnico:empleados!avisos_tecnico_asignado_id_fkey(id, nombre, apellidos),
                proyecto:proyectos(id, nombre_proyecto),
                creador_interno:empleados!avisos_creador_id_fkey(nombre, apellidos, rol),
                archivos:avisos_archivos(count)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        setAvisos(data || []);
    };

    const handleCreate = async () => {
        if (!formData.descripcion.trim() || !formData.direccion.trim() || formData.tecnico_id === 'none') {
            toast({ variant: 'destructive', title: 'Faltan datos', description: 'Comunidad, descripción y técnico asignado son obligatorios.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const { data: empData } = await supabase.from('empleados').select('id, rol, nombre').eq('auth_user_id', user.id).single();
            if (!empData) throw new Error("No se encontró perfil de empleado");

            const { data: avisoData, error: avisoError } = await supabase
                .from('avisos')
                .insert({
                    descripcion_solicitud: formData.descripcion,
                    direccion_servicio: formData.direccion,
                    cliente_nombre: formData.cliente_nombre || empData.nombre,
                    telefono_contacto: formData.telefono,
                    tecnico_asignado_id: formData.tecnico_id,
                    proyecto_id: null,
                    estado: 'en_curso',
                    creador_id: empData.id,
                    creador_rol: empData.rol === 'admin' ? 'Admin' : 'Encargado',
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (avisoError) throw avisoError;

            if (newFiles.length > 0) {
                const uploadPromises = newFiles.map(async (file) => {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `avisos/${avisoData.id}/${uuidv4()}.${fileExt}`;
                    const { error: upError } = await supabase.storage.from('avisos-files').upload(fileName, file);
                    if (upError) throw upError;
                    const { data: urlData } = supabase.storage.from('avisos-files').getPublicUrl(fileName);
                    
                    return supabase.from('avisos_archivos').insert({
                        aviso_id: avisoData.id,
                        archivo_url: urlData.publicUrl,
                        nombre_archivo: file.name,
                        tipo_archivo: file.type,
                        subido_por: empData.id
                    });
                });
                await Promise.all(uploadPromises);
            }

            toast({ title: 'Aviso creado', description: 'El aviso se ha registrado correctamente.' });
            setIsCreateOpen(false);
            resetForm();
            fetchAvisos();

        } catch (error) {
            console.error('Error creating aviso:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo crear el aviso.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({ descripcion: '', direccion: '', cliente_nombre: '', telefono: '', tecnico_id: 'none' });
        setNewFiles([]);
    };

    const handleFileSelect = (e) => {
        if (e.target.files) setNewFiles(prev => [...prev, ...Array.from(e.target.files)]);
    };

    const getStatusBadge = (status) => {
        const s = status?.toLowerCase() || 'pendiente';
        switch (s) {
            case 'cerrado': return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Completado</Badge>;
            case 'en_curso': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200"><Clock className="w-3 h-3 mr-1" /> En Curso</Badge>;
            default: return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200"><AlertCircle className="w-3 h-3 mr-1" /> Pendiente</Badge>;
        }
    };

    const getCreatorShortName = (aviso) => {
        if (aviso.creador_interno) {
            if (aviso.creador_interno.nombre === 'Administracion') {
                return 'ATC';
            }
            return aviso.creador_interno.nombre || 'N/A';
        }
        return aviso.creador_rol || 'Sistema';
    };

    const uniqueCreators = useMemo(() => {
        const map = new Map();
        avisos.forEach(a => {
            const id = a.creador_id || 'system';
            const name = getCreatorShortName(a);
            if (!map.has(id)) {
                map.set(id, { id, name });
            }
        });
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [avisos]);

    const uniqueTechnicians = useMemo(() => {
        const map = new Map();
        avisos.forEach(a => {
            if (a.tecnico) {
                const id = a.tecnico.id;
                const name = `${a.tecnico.nombre} ${a.tecnico.apellidos || ''}`.trim();
                if (!map.has(id)) {
                    map.set(id, { id, name });
                }
            }
        });
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [avisos]);

    const filteredAvisos = avisos.filter(a => {
        const matchesSearch = 
            a.descripcion_solicitud?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.direccion_servicio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.cliente_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            getCreatorShortName(a).toLowerCase().includes(searchTerm.toLowerCase()) ||
            (a.tecnico?.nombre && a.tecnico.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesStatus = statusFilter === 'all' || a.estado === statusFilter;

        const matchesCreator = creatorFilter === 'all' || 
            (creatorFilter === 'system' && !a.creador_id) ||
            (a.creador_id === creatorFilter);

        const matchesTechnician = technicianFilter === 'all' || 
            (technicianFilter === 'unassigned' && !a.tecnico) ||
            (a.tecnico && a.tecnico.id === technicianFilter);

        return matchesSearch && matchesStatus && matchesCreator && matchesTechnician;
    });

    const handleNavigate = (path) => {
        if (navigate) {
            navigate(path);
        }
    }

    return (
        <>
            <Helmet><title>Gestión de Avisos | Admin</title></Helmet>

            <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                            <Briefcase className="w-8 h-8 text-primary" />
                            Gestión de Avisos
                        </h1>
                        <p className="text-muted-foreground mt-1">Administra todas las órdenes de trabajo y asignaciones.</p>
                    </div>
                    <Button onClick={() => setIsCreateOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" /> Nuevo Aviso
                    </Button>
                </div>

                <div className="flex flex-col lg:flex-row gap-4 items-end lg:items-center">
                    <div className="relative flex-1 w-full lg:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar por descripción, C.P., creador..." 
                            className="pl-9 w-full"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[150px] min-w-[150px]">
                                <div className="flex items-center gap-2 truncate">
                                    <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
                                    <span className="truncate">{statusFilter === 'all' ? 'Estado' : 'Estado'}</span>
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los estados</SelectItem>
                                <SelectItem value="pendiente">Pendiente</SelectItem>
                                <SelectItem value="en_curso">En Curso</SelectItem>
                                <SelectItem value="cerrado">Completado</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                            <SelectTrigger className="w-[150px] min-w-[150px]">
                                <div className="flex items-center gap-2 truncate">
                                    <User className="w-4 h-4 text-muted-foreground shrink-0" />
                                    <span className="truncate">{creatorFilter === 'all' ? 'Creador' : 'Creador'}</span>
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los creadores</SelectItem>
                                {uniqueCreators.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                            <SelectTrigger className="w-[150px] min-w-[150px]">
                                <div className="flex items-center gap-2 truncate">
                                    <HardHat className="w-4 h-4 text-muted-foreground shrink-0" />
                                    <span className="truncate">{technicianFilter === 'all' ? 'Técnico' : 'Técnico'}</span>
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los técnicos</SelectItem>
                                <SelectItem value="unassigned">Sin asignar</SelectItem>
                                {uniqueTechnicians.map(t => (
                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* DESKTOP VIEW - TABLE */}
                <div className="hidden md:block rounded-md border bg-card shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-[120px]">Fecha</TableHead>
                                <TableHead className="w-[120px]">Creador</TableHead>
                                <TableHead>Nombre de C.P.</TableHead>
                                <TableHead className="w-[150px]">Estado</TableHead>
                                <TableHead className="w-[180px]">Técnico Asignado</TableHead>
                                <TableHead className="w-[120px]">Archivos</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                        <div className="flex items-center justify-center gap-2"><Loader2 className="animate-spin w-4 h-4" /> Cargando...</div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredAvisos.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No se encontraron avisos.</TableCell>
                                </TableRow>
                            ) : (
                                filteredAvisos.map((aviso) => (
                                    <TableRow 
                                        key={aviso.id} 
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => handleNavigate(`/gestion/avisos-admin/detail/${aviso.id}`)}
                                    >
                                        <TableCell>
                                            <div className="flex flex-col text-xs">
                                                <span className="font-medium">{fmtMadrid(aviso.created_at, 'date')}</span>
                                                <span className="text-muted-foreground">{fmtMadrid(aviso.created_at, 'time')}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-sm">
                                                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground">
                                                    {getCreatorShortName(aviso).charAt(0)}
                                                </div>
                                                <span>{getCreatorShortName(aviso)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium max-w-[250px] truncate" title={aviso.direccion_servicio}>
                                                {aviso.direccion_servicio}
                                            </div>
                                        </TableCell>
                                        <TableCell>{getStatusBadge(aviso.estado)}</TableCell>
                                        <TableCell>
                                            {aviso.tecnico ? (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <HardHat className="w-4 h-4 text-primary" />
                                                    <span>{aviso.tecnico.nombre}</span>
                                                </div>
                                            ) : (
                                                <Badge variant="outline" className="text-muted-foreground font-normal">Sin asignar</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                                <FileArchive className="w-4 h-4" />
                                                <span>{aviso.archivos[0]?.count || 0}</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
                
                {/* MOBILE VIEW - CARDS */}
                <div className="md:hidden space-y-4">
                    {loading ? (
                         <div className="h-32 text-center text-muted-foreground flex items-center justify-center gap-2">
                            <Loader2 className="animate-spin w-4 h-4" /> Cargando...
                         </div>
                    ) : filteredAvisos.length === 0 ? (
                        <div className="h-32 text-center text-muted-foreground flex items-center justify-center">
                            No se encontraron avisos.
                        </div>
                    ) : (
                        filteredAvisos.map((aviso) => (
                            <Card key={aviso.id} className="cursor-pointer" onClick={() => handleNavigate(`/gestion/avisos-admin/detail/${aviso.id}`)}>
                                <CardHeader className="flex-row justify-between items-start pb-2">
                                     <CardTitle className="text-sm font-medium">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-primary"/>
                                            <span>{fmtMadrid(aviso.created_at, 'datetime')}</span>
                                        </div>
                                     </CardTitle>
                                     {getStatusBadge(aviso.estado)}
                                </CardHeader>
                                <CardContent className="p-4 pt-2 space-y-3">
                                    <p className="font-semibold text-foreground pr-2">{aviso.direccion_servicio}</p>
                                    <div className="text-sm text-muted-foreground space-y-2">
                                        <div className="flex items-center gap-2 pt-2 border-t">
                                            <User className="w-4 h-4 text-primary/70"/>
                                            <span>Creado por: <span className="font-medium text-foreground/80">{getCreatorShortName(aviso)}</span></span>
                                        </div>
                                         {aviso.tecnico && (
                                             <div className="flex items-center gap-2">
                                                <HardHat className="w-4 h-4 text-green-600"/>
                                                <span>Asignado a: <span className="font-medium text-foreground/80">{aviso.tecnico.nombre}</span></span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <FileArchive className="w-4 h-4 text-muted-foreground" />
                                            <span>{aviso.archivos[0]?.count || 0} archivos adjuntos</span>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="hidden">
                                     {/* Footer remains for structure but is hidden to make whole card clickable */}
                                </CardFooter>
                            </Card>
                        ))
                    )}
                </div>
            </div>

            {/* Create Modal */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Crear Nuevo Aviso</DialogTitle>
                        <DialogDescription>Registra una nueva orden de trabajo.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="comunidad">CCPP (Comunidad de Propietarios) *</Label>
                            <Input 
                                id="comunidad"
                                placeholder="Ej: Comunidad del Edificio Las Flores, Calle Principal 123"
                                value={formData.direccion}
                                onChange={(e) => setFormData(p => ({ ...p, direccion: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="contact">Persona de Contacto</Label>
                                <Input 
                                    id="contact"
                                    placeholder="Nombre"
                                    value={formData.cliente_nombre}
                                    onChange={(e) => setFormData(p => ({ ...p, cliente_nombre: e.target.value }))}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="phone">Teléfono</Label>
                                <Input 
                                    id="phone"
                                    placeholder="Número de contacto"
                                    value={formData.telefono}
                                    onChange={(e) => setFormData(p => ({ ...p, telefono: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="desc">Descripción del problema *</Label>
                            <Textarea 
                                id="desc" 
                                placeholder="Detalla la incidencia..." 
                                value={formData.descripcion}
                                onChange={e => setFormData({...formData, descripcion: e.target.value})}
                                className="min-h-[100px]"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Asignar Técnico *</Label>
                            <Select value={formData.tecnico_id} onValueChange={v => setFormData({...formData, tecnico_id: v})}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">-- Sin asignar --</SelectItem>
                                    {technicians.map(t => (
                                        <SelectItem key={t.id} value={t.id}>{t.nombre} {t.apellidos}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Adjuntar Archivos</Label>
                            <div className="flex flex-wrap items-center gap-2">
                                {newFiles.map((f, i) => (
                                    <div key={i} className="relative group border rounded-md p-2 bg-muted/20 flex items-center gap-2 pr-8">
                                        {f.type.includes('image') ? <ImageIcon className="w-4 h-4 text-blue-500" /> : <FileText className="w-4 h-4 text-orange-500" />}
                                        <span className="text-xs max-w-[100px] truncate">{f.name}</span>
                                        <button onClick={() => setNewFiles(prev => prev.filter((_, idx) => idx !== i))} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-red-100 text-red-500 rounded-full transition-colors"><X className="w-3 h-3" /></button>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => fileInputRef.current?.click()}>
                                    <Paperclip className="w-4 h-4 mr-2" /> Añadir
                                </Button>
                                <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>Cancelar</Button>
                        <Button onClick={handleCreate} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Crear Aviso
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default AdminAvisosView;