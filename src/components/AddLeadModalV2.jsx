import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Upload, Image as ImageIcon, Loader2,
    User, Building2, MapPin, Phone, Mail, FileText, Calendar as CalendarIcon, Trash2, CheckCircle2, Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { FORM_STATUS_OPTIONS } from '@/utils/leadStatus';

const AddLeadModalV2 = ({ isOpen, onClose, onLeadAdded }) => {
    const { user, sessionRole } = useAuth();
    const [clientType, setClientType] = useState('particular'); // particular | empresa
    const [loading, setLoading] = useState(false);
    const [technicians, setTechnicians] = useState([]);
    const [partidas, setPartidas] = useState([]);
    const [categories, setCategories] = useState([]); // State for dynamic categories

    // Form State
    const [formData, setFormData] = useState({
        nombre_contacto: '',
        nombre_empresa: '',
        cif: '',
        telefono: '',
        email: '',
        direccion: '',
        municipio: '',
        codigo_postal: '',
        estado: 'nuevo', // Default to 'nuevo' as requested
        partida: '',
        comentario: '',
        empleado_asignado_id: 'unassigned',
        fecha_visita: '',
        categoria: '', // Stores category code for the select value
    });

    const isAdminOrEncargado = sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado';

    // Image Upload State
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [previews, setPreviews] = useState([]);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            fetchDependencies();
            resetForm();
        }
        return () => {
            previews.forEach(url => URL.revokeObjectURL(url));
        };
    }, [isOpen]);

    // Auto-update status to 'visita_agendada' if a date is selected and current status is 'nuevo'
    useEffect(() => {
        if (formData.fecha_visita && formData.estado === 'nuevo') {
            setFormData(prev => ({ ...prev, estado: 'visita_agendada' }));
            toast({ description: "Estado cambiado a 'Visita Agendada' al asignar fecha." });
        }
    }, [formData.fecha_visita]);

    const fetchDependencies = async () => {
        try {
            // Fetch employees (Only needed if admin/encargado)
            if (isAdminOrEncargado) {
                const { data: emps } = await supabase
                    .from('empleados')
                    .select('id, auth_user_id, nombre, apellidos, rol')
                    .eq('activo', true)
                    .order('nombre');
                setTechnicians(emps || []);
            }

            // Fetch partidas from DB
            const { data: cats } = await supabase
                .from('partidas_catalogo')
                .select('key, label')
                .eq('activo', true)
                .order('label');

            // Define mandatory options - AÑADIDO: Aire Acondicionado e Impermeabilizaciones
            const mandatoryOptions = [
                { key: 'aire_acondicionado', label: 'Aire Acondicionado' },
                { key: 'albanileria', label: 'Albañilería' },
                { key: 'electricidad', label: 'Electricidad' },
                { key: 'fontaneria', label: 'Fontanería' },
                { key: 'impermeabilizaciones', label: 'Impermeabilizaciones' },
                { key: 'pintura', label: 'Pintura' },
                { key: 'pladur', label: 'Pladur' },
                { key: 'proyecto_licencia', label: 'Proyecto/Licencia' },
                { key: 'reforma_bano', label: 'Reforma Baño' },
                { key: 'reforma_cocina', label: 'Reforma Cocina' },
                { key: 'reforma_integral', label: 'Reforma Integral' },
                { key: 'otros', label: 'Otros' }
            ];

            // Deduplication Logic (Normalized Map)
            const normalizedMap = new Map();

            const setItem = (item) => {
                if (!item || !item.label) return;
                const k = item.label.trim().toLowerCase();
                if (!normalizedMap.has(k)) {
                    // Ensure key is present, fallback to slugified label if missing
                    const safeItem = {
                        ...item,
                        key: item.key || k.replace(/\s+/g, '_')
                    };
                    normalizedMap.set(k, safeItem);
                }
            };

            // Feed Mandatory First (Ensures correct spelling)
            mandatoryOptions.forEach(setItem);

            // Feed DB items
            if (cats && cats.length > 0) {
                cats.forEach(setItem);
            }

            const finalPartidas = Array.from(normalizedMap.values())
                .sort((a, b) => a.label.localeCompare(b.label));

            setPartidas(finalPartidas);

            const { data: categoriasData, error: categoriesError } = await supabase
                .from('categorias')
                .select('id, codigo, nombre, tipo')
                .eq('activo', true) // Only active categories
                .order('tipo', { ascending: false }) // Sort 'persona' first
                .order('codigo', { ascending: true }); // Then by code/name

            if (categoriesError) throw categoriesError;
            setCategories(categoriasData || []);

        } catch (error) {
            // Silent error logging for production
            toast({ variant: "destructive", title: "Error de conexión", description: "No se pudieron cargar los datos auxiliares." });
        }
    };

    const resetForm = () => {
        setFormData({
            nombre_contacto: '',
            nombre_empresa: '',
            cif: '',
            telefono: '',
            email: '',
            direccion: '',
            municipio: '',
            codigo_postal: '',
            estado: 'nuevo', // Reset to 'nuevo'
            partida: '',
            comentario: '',
            empleado_asignado_id: 'unassigned',
            fecha_visita: '',
            categoria: '', // Reset categoria
        });
        setClientType('particular');
        setSelectedFiles([]);
        setPreviews([]);
    };

    const handleFileSelect = (e) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const newFiles = Array.from(e.target.files);
        const validFiles = newFiles.filter(file => file.type.startsWith('image/'));

        if (validFiles.length < newFiles.length) {
            toast({
                variant: 'destructive',
                title: 'Archivos inválidos',
                description: 'Solo se permiten archivos de imagen.'
            });
        }

        setSelectedFiles(prev => [...prev, ...validFiles]);

        const newPreviews = validFiles.map(file => URL.createObjectURL(file));
        setPreviews(prev => [...prev, ...newPreviews]);
    };

    const removeFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => {
            const newPreviews = prev.filter((_, i) => i !== index);
            URL.revokeObjectURL(prev[index]);
            return newPreviews;
        });
    };

    const uploadImages = async (leadId) => {
        if (selectedFiles.length === 0) return;

        const uploadPromises = selectedFiles.map(async (file) => {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${leadId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('lead_fotos')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('lead_fotos')
                .getPublicUrl(filePath);

            const { error: rpcError } = await supabase.rpc('insertar_lead_foto', {
                p_lead_id: leadId,
                p_url: publicUrl,
                p_descripcion: file.name,
                p_tipo: 'imagen',
                p_usuario_id: user.id
            });

            if (rpcError) throw rpcError;
        });

        await Promise.all(uploadPromises);
    };

    // Función para crear la asignación en leads_asignaciones
    const createLeadAssignment = async (leadId, empleadoId) => {
        try {
            // Buscar el auth_user_id del empleado seleccionado
            const selectedTech = technicians.find(t => t.id === empleadoId);
            if (!selectedTech || !selectedTech.auth_user_id) {
                console.warn('No se encontró auth_user_id para el empleado:', empleadoId);
                return;
            }

            const { error } = await supabase
                .from('leads_asignaciones')
                .insert({
                    lead_id: leadId,
                    usuario_id: selectedTech.auth_user_id,
                    asignado_por: user?.id || null
                });

            if (error) {
                // Si es error de duplicado, ignorar (ya estaba asignado)
                if (error.code === '23505') {
                    console.log('Asignación ya existente, ignorando duplicado');
                    return;
                }
                throw error;
            }

            console.log('[ASSIGNMENT] Creada asignación en leads_asignaciones para lead:', leadId, 'usuario:', selectedTech.auth_user_id);
        } catch (error) {
            console.error('Error creando asignación:', error);
            // No lanzamos el error para no interrumpir la creación del lead
            // La asignación se puede hacer manualmente después
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (clientType === 'empresa' && !formData.nombre_empresa) {
                throw new Error('El nombre de la empresa es obligatorio.');
            }
            if (!formData.nombre_contacto) {
                throw new Error('El nombre de contacto es obligatorio.');
            }
            if (!formData.telefono && !formData.email) {
                throw new Error('Debes indicar al menos teléfono o email.');
            }

            // Find selected category ID based on code from the fetched categories list
            const selectedCat = categories.find(c => c.codigo === formData.categoria);

            // Determinar si hay técnico asignado
            const hasAssignedTech = isAdminOrEncargado && formData.empleado_asignado_id !== 'unassigned';

            // [NOTIFICATION DEBUG] Log for Task 1, 2, 3
            if (hasAssignedTech) {
                console.log('[NOTIFICATION DEBUG] Creating notification from: [AddLeadModalV2.jsx].[handleSubmit]', {
                    action: 'insert leads (with initial assignment)',
                    assignee: formData.empleado_asignado_id,
                    trigger_context: 'User created Lead with assignment'
                });
            }

            const payload = {
                nombre_contacto: formData.nombre_contacto,
                nombre_empresa: clientType === 'empresa' ? formData.nombre_empresa : null,
                cif: clientType === 'empresa' ? formData.cif : null,
                telefono: formData.telefono,
                email: formData.email,
                direccion: formData.direccion,
                municipio: formData.municipio,
                codigo_postal: formData.codigo_postal,
                estado: formData.estado,
                partida: formData.partida || null,
                comentario: formData.comentario,
                empleado_asignado_id: hasAssignedTech ? formData.empleado_asignado_id : null,
                created_by: sessionRole?.empleadoId, // Stores Employee ID
                owner_user_id: user?.id,             // Stores Auth ID
                categoria: formData.categoria || null, // Stores Code
                categoria_id: selectedCat ? selectedCat.id : null, // Stores ID for relation
                proyecto_id: formData.proyecto_id || null,
            };

            const { data, error } = await supabase
                .from('leads')
                .insert(payload)
                .select()
                .single();

            if (error) throw error;

            // NUEVO: Si hay técnico asignado, crear también el registro en leads_asignaciones
            if (data && hasAssignedTech) {
                await createLeadAssignment(data.id, formData.empleado_asignado_id);
            }

            if (selectedFiles.length > 0 && data) {
                await uploadImages(data.id);
            }

            toast({ title: 'Lead creado correctamente' });
            if (onLeadAdded) onLeadAdded();
            onClose();
        } catch (error) {
            // Silent error logging for production
            toast({
                variant: 'destructive',
                title: 'Error al crear lead',
                description: error.message || 'Hubo un problema al guardar.'
            });
        } finally {
            setLoading(false);
        }
    };

    // Filter categories into 'Personas' and 'Orígenes' as in EditLeadModal
    const personas = categories.filter(c => c.tipo === 'persona');
    const origenes = categories.filter(c => c.tipo !== 'persona');

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="w-full max-w-4xl bg-background border rounded-xl shadow-2xl flex flex-col max-h-[90vh] md:max-h-[85vh]"
                    >
                        <div className="flex items-center justify-between p-6 border-b shrink-0 bg-background rounded-t-xl z-10">
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight">Nuevo Lead</h2>
                                <p className="text-muted-foreground mt-1">Registra un nuevo prospecto o cliente potencial.</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted">
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            {/* Tipo de Cliente Selector */}
                            <div className="space-y-3">
                                <Label className="text-base font-medium">Tipo de Cliente</Label>
                                <RadioGroup
                                    defaultValue="particular"
                                    value={clientType}
                                    onValueChange={setClientType}
                                    className="flex gap-4"
                                >
                                    <div
                                        onClick={() => setClientType('particular')}
                                        className={`flex items-center space-x-2 border p-4 rounded-lg flex-1 cursor-pointer transition-all ${clientType === 'particular' ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'hover:bg-muted/50'}`}
                                    >
                                        <RadioGroupItem value="particular" id="r-particular" />
                                        <Label htmlFor="r-particular" className="flex items-center gap-2 cursor-pointer w-full font-semibold pointer-events-none">
                                            <User className="w-4 h-4" /> Particular
                                        </Label>
                                    </div>
                                    <div
                                        onClick={() => setClientType('empresa')}
                                        className={`flex items-center space-x-2 border p-4 rounded-lg flex-1 cursor-pointer transition-all ${clientType === 'empresa' ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'hover:bg-muted/50'}`}
                                    >
                                        <RadioGroupItem value="empresa" id="r-empresa" />
                                        <Label htmlFor="r-empresa" className="flex items-center gap-2 cursor-pointer w-full font-semibold pointer-events-none">
                                            <Building2 className="w-4 h-4" /> CDAD PROPIETARIOS
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h3 className="font-semibold flex items-center gap-2 pb-2 border-b text-primary">
                                        <User className="w-4 h-4" /> Datos de Contacto
                                    </h3>

                                    <AnimatePresence>
                                        {clientType === 'empresa' && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="space-y-4 overflow-hidden"
                                            >
                                                <div className="space-y-2">
                                                    <Label htmlFor="nombre_empresa">
                                                        {clientType === 'empresa' ? 'Nombre Cdad Propietarios' : 'Nombre Empresa'} <span className="text-red-500">*</span>
                                                    </Label>
                                                    <Input
                                                        id="nombre_empresa"
                                                        placeholder={clientType === 'empresa' ? "Ej. Comunidad de Propietarios..." : "Ej. Construcciones SL"}
                                                        value={formData.nombre_empresa}
                                                        onChange={e => setFormData({ ...formData, nombre_empresa: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="cif">CIF / NIF</Label>
                                                    <Input
                                                        id="cif"
                                                        placeholder="B12345678"
                                                        value={formData.cif}
                                                        onChange={e => setFormData({ ...formData, cif: e.target.value })}
                                                    />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="space-y-2">
                                        <Label htmlFor="nombre_contacto">
                                            {clientType === 'particular' ? 'Nombre' : 'Nombre de Contacto'} <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="nombre_contacto"
                                            placeholder="Ej. Juan Pérez"
                                            value={formData.nombre_contacto}
                                            onChange={e => setFormData({ ...formData, nombre_contacto: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="telefono">Teléfono <span className="text-red-500">*</span></Label>
                                            <div className="relative">
                                                <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="telefono"
                                                    className="pl-9"
                                                    placeholder="600 000 000"
                                                    value={formData.telefono}
                                                    onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="email">Email</Label>
                                            <div className="relative">
                                                <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="email"
                                                    className="pl-9"
                                                    type="email"
                                                    placeholder="cliente@email.com"
                                                    value={formData.email}
                                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="font-semibold flex items-center gap-2 pb-2 border-b text-primary">
                                        <MapPin className="w-4 h-4" /> Ubicación del Servicio
                                    </h3>

                                    <div className="space-y-2">
                                        <Label htmlFor="direccion">Dirección Completa</Label>
                                        <Input
                                            id="direccion"
                                            placeholder="C/ Ejemplo, 123, 4ºA"
                                            value={formData.direccion}
                                            onChange={e => setFormData({ ...formData, direccion: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="municipio">Municipio</Label>
                                            <Input
                                                id="municipio"
                                                placeholder="Madrid"
                                                value={formData.municipio}
                                                onChange={e => setFormData({ ...formData, municipio: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="codigo_postal">C. Postal</Label>
                                            <Input
                                                id="codigo_postal"
                                                placeholder="28001"
                                                value={formData.codigo_postal}
                                                onChange={e => setFormData({ ...formData, codigo_postal: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-semibold flex items-center gap-2 pb-2 border-b text-primary">
                                    <FileText className="w-4 h-4" /> Detalles del Lead
                                </h3>

                                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                        <Label>Tipo de Trabajo / Partida</Label>
                                        <Select value={formData.partida} onValueChange={(v) => setFormData({ ...formData, partida: v })}>
                                            <SelectTrigger><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
                                            <SelectContent>
                                                {partidas.map((p) => (
                                                    // Guarantee unique key: use p.key if available, else fallback to label
                                                    <SelectItem key={p.key || p.label} value={p.key || "unknown"}>{p.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>


                                    {isAdminOrEncargado && (
                                        <div className="space-y-2">
                                            <Label>Asignar Técnico</Label>
                                            <Select value={formData.empleado_asignado_id} onValueChange={(v) => setFormData({ ...formData, empleado_asignado_id: v })}>
                                                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="unassigned">-- Sin asignar --</SelectItem>
                                                    {technicians.map(tech => (
                                                        <SelectItem key={tech.id} value={tech.id || "unknown"}>{tech.nombre} {tech.apellidos}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label>Estado Inicial</Label>
                                        <Select value={formData.estado} onValueChange={(v) => setFormData({ ...formData, estado: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {FORM_STATUS_OPTIONS.map(opt => (
                                                    <SelectItem key={opt.value} value={opt.value || "unknown"}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="fecha_visita">Agendar Visita (Opcional)</Label>
                                        <div className="relative">
                                            <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="fecha_visita"
                                                type="datetime-local"
                                                className="pl-9"
                                                value={formData.fecha_visita}
                                                onChange={e => setFormData({ ...formData, fecha_visita: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Procedencia</Label>
                                        <Select
                                            value={formData.categoria}
                                            onValueChange={(v) => setFormData({ ...formData, categoria: v })}
                                        >
                                            <SelectTrigger id="categoria">
                                                <SelectValue placeholder="Selecciona procedencia..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {personas.length > 0 && (
                                                    <SelectGroup>
                                                        <SelectLabel>Personas</SelectLabel>
                                                        {personas.map(cat => (
                                                            <SelectItem key={cat.id} value={cat.codigo}>
                                                                {cat.nombre}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                )}
                                                {origenes.length > 0 && (
                                                    <SelectGroup>
                                                        <SelectLabel>Orígenes</SelectLabel>
                                                        {origenes.map(cat => (
                                                            <SelectItem key={cat.id} value={cat.codigo}>
                                                                {cat.nombre}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="comentario">Descripción / Comentarios</Label>
                                    <Textarea
                                        id="comentario"
                                        placeholder="Describe las necesidades del cliente, detalles del trabajo, observaciones..."
                                        className="min-h-[100px]"
                                        value={formData.comentario}
                                        onChange={e => setFormData({ ...formData, comentario: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 pb-4">
                                <h3 className="font-semibold flex items-center gap-2 pb-2 border-b text-primary">
                                    <ImageIcon className="w-4 h-4" /> Fotos y Archivos
                                </h3>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {previews.map((url, idx) => (
                                        <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
                                            <img src={url} alt="Preview" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                            <button
                                                type="button"
                                                onClick={() => removeFile(idx)}
                                                className="absolute top-1 right-1 p-1.5 bg-destructive/90 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}

                                    <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-muted-foreground/25 rounded-lg hover:border-primary/50 hover:bg-muted/50 cursor-pointer transition-all group">
                                        <div className="p-3 rounded-full bg-muted group-hover:bg-background transition-colors mb-2">
                                            <Upload className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                                        </div>
                                        <span className="text-xs text-muted-foreground font-medium text-center px-2">
                                            Subir fotos
                                        </span>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            multiple
                                            accept="image/*"
                                            onChange={handleFileSelect}
                                        />
                                    </label>
                                </div>
                                {selectedFiles.length > 0 && (
                                    <p className="text-xs text-muted-foreground text-right">
                                        {selectedFiles.length} archivos seleccionados
                                    </p>
                                )}
                            </div>

                        </div>

                        <div className="p-6 border-t bg-muted/10 flex justify-end gap-3 shrink-0 rounded-b-xl mt-auto bg-background z-10">
                            <Button variant="outline" type="button" onClick={onClose}>
                                Cancelar
                            </Button>
                            <Button onClick={handleSubmit} disabled={loading} className="min-w-[140px]">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                Crear Lead
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default AddLeadModalV2;
