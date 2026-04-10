import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Upload, Image as ImageIcon, Loader2,
    User, Building2, MapPin, FileText, Save, Trash2, AlertCircle, Archive, Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { FORM_STATUS_OPTIONS } from '@/utils/leadStatus';
import { useLeadAssignment } from '@/hooks/useLeadAssignment';
import BudgetPopup from '@/components/BudgetPopup';

const EditLeadModal = ({ isOpen, onClose, leadId, onLeadUpdated }) => {
    const { user, sessionRole } = useAuth();
    const { assignLead } = useLeadAssignment();
    const [clientType, setClientType] = useState('particular');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [technicians, setTechnicians] = useState([]);
    const [partidas, setPartidas] = useState([]);
    const [categories, setCategories] = useState([]);

    // Status Change Confirmation Logic
    const [showStatusConfirm, setShowStatusConfirm] = useState(false);
    const [pendingData, setPendingData] = useState(null);
    const [originalLead, setOriginalLead] = useState(null);
    const [confirmType, setConfirmType] = useState(null); // 'set_visit' | 'restore_status'
    const [restoreTargetStatus, setRestoreTargetStatus] = useState(null);

    // Image Upload State
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [previews, setPreviews] = useState([]);
    const fileInputRef = useRef(null);

    // Archive State
    const [archiving, setArchiving] = useState(false);

    // Initial Category Code (to check changes)
    const [originalCategoryCode, setOriginalCategoryCode] = useState(null);

    const [formData, setFormData] = useState({
        nombre_contacto: '',
        nombre_empresa: '',
        cif: '',
        telefono: '',
        email: '',
        direccion: '',
        municipio: '',
        codigo_postal: '',
        estado: '',
        partida: '',
        comentario: '',
        empleado_asignado_id: 'none',
        fecha_visita: '',
        categoria_codigo: '', // New field for Category selector
        archivado: false,
        archivado_at: null
    });

    useEffect(() => {
        if (isOpen) {
            fetchDependencies();
            if (leadId) fetchLeadData();
            setSelectedFiles([]);
            setPreviews([]);
            setPendingData(null);
            setShowStatusConfirm(false);
            setConfirmType(null);
        }
        return () => {
            previews.forEach(url => URL.revokeObjectURL(url));
        };
    }, [isOpen, leadId]);

    const fetchDependencies = async () => {
        try {
            // Fetch Technicians
            const { data: emps } = await supabase
                .from('empleados')
                .select('id, auth_user_id, nombre, apellidos, rol')
                .eq('activo', true)
                .order('nombre');
            setTechnicians(emps || []);

            // Fetch Partidas (simplified logic for stability)
            const { data: cats } = await supabase
                .from('partidas_catalogo')
                .select('key, label')
                .eq('activo', true)
                .order('label');

            const mandatoryOptions = [
                { key: 'albanileria', label: 'Albañilería' },
                { key: 'electricidad', label: 'Electricidad' },
                { key: 'pladur', label: 'Pladur' },
                { key: 'fontaneria', label: 'Fontanería' },
                { key: 'pintura', label: 'Pintura' },
                { key: 'reforma_integral', label: 'Reforma Integral' },
                { key: 'reforma_bano', label: 'Reforma Baño' },
                { key: 'reforma_cocina', label: 'Reforma Cocina' },
                { key: 'otros', label: 'Otros' }
            ];

            const combinedPartidas = [...mandatoryOptions];
            if (cats) {
                cats.forEach(c => {
                    if (!combinedPartidas.find(p => p.key === c.key)) {
                        combinedPartidas.push(c);
                    }
                });
            }
            combinedPartidas.sort((a, b) => a.label.localeCompare(b.label));
            setPartidas(combinedPartidas);

            const { data: categoriasData } = await supabase
                .from('categorias')
                .select('id, codigo, nombre, tipo')
                .eq('activo', true)
                .order('tipo', { ascending: false })
                .order('codigo', { ascending: true });
            setCategories(categoriasData || []);

        } catch (error) {
            // Silent error logging
            toast({ variant: "destructive", title: "Error de conexión", description: "No se pudieron cargar los datos auxiliares." });
        }
    };

    const fetchLeadData = async () => {
        setLoading(true);
        try {
            // Also fetch linked categoria to get its codigo
            const { data, error } = await supabase
                .from('leads')
                .select('*, categoria:categoria_id(codigo)')
                .eq('id', leadId)
                .single();

            if (error) throw error;

            if (data) {
                setOriginalLead(data);

                let fechaVisitaFormatted = '';
                if (data.fecha_visita) {
                    const date = new Date(data.fecha_visita);
                    const offset = date.getTimezoneOffset() * 60000;
                    fechaVisitaFormatted = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
                }

                const currentCatCodigo = data.categoria?.codigo || '';
                setOriginalCategoryCode(currentCatCodigo);

                setFormData({
                    nombre_contacto: data.nombre_contacto || '',
                    nombre_empresa: data.nombre_empresa || '',
                    cif: data.cif || '',
                    telefono: data.telefono || '',
                    email: data.email || '',
                    direccion: data.direccion || '',
                    municipio: data.municipio || '',
                    codigo_postal: data.codigo_postal || '',
                    estado: data.estado || 'nuevo',
                    partida: data.partida || '',
                    comentario: data.comentario || '',
                    empleado_asignado_id: data.empleado_asignado_id || 'none',
                    fecha_visita: fechaVisitaFormatted,
                    categoria_codigo: currentCatCodigo, // Map loaded category
                    archivado: data.archivado || false,
                    archivado_at: data.archivado_at || null
                });

                setClientType(data.nombre_empresa ? 'empresa' : 'particular');
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
            onClose();
        } finally {
            setLoading(false);
        }
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

    const uploadImages = async (targetLeadId) => {
        if (selectedFiles.length === 0) return;

        const uploadPromises = selectedFiles.map(async (file) => {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${targetLeadId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('lead_fotos')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('lead_fotos')
                .getPublicUrl(filePath);

            const { error: rpcError } = await supabase.rpc('insertar_lead_foto', {
                p_lead_id: targetLeadId,
                p_url: publicUrl,
                p_descripcion: file.name
            });

            if (rpcError) throw rpcError;
        });

        await Promise.all(uploadPromises);
    };

    const toggleArchive = async (checked) => {
        setArchiving(true);
        try {
            setFormData(prev => ({ ...prev, archivado: checked }));

            const { error } = await supabase
                .from('leads')
                .update({
                    archivado: checked,
                    archivado_at: checked ? new Date().toISOString() : null
                })
                .eq('id', leadId);

            if (error) throw error;

            toast({
                title: checked ? 'Lead archivado' : 'Lead recuperado',
                description: checked ? 'El lead se ha movido al archivo.' : 'El lead se ha restaurado a activos.',
            });

            if (onLeadUpdated) onLeadUpdated();
            fetchLeadData();

        } catch (error) {
            // Silent error log
            setFormData(prev => ({ ...prev, archivado: !checked }));
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudo cambiar el estado de archivo.',
            });
        } finally {
            setArchiving(false);
        }
    };

    const performSave = async (dataToSave) => {
        setSaving(true);
        try {
            // [NOTIFICATION DEBUG] Log for Task 1, 2, 3
            if (originalLead && dataToSave.empleado_asignado_id !== originalLead.empleado_asignado_id) {
                console.log('[NOTIFICATION DEBUG] Creating notification from: [EditLeadModal.jsx].[performSave]', {
                    action: 'update leads (assignment change)',
                    leadId: leadId,
                    old_assignee: originalLead.empleado_asignado_id,
                    new_assignee: dataToSave.empleado_asignado_id,
                    trigger_context: 'User changed assignment dropdown in EditLeadModal'
                });

                // Tarea de Asignaciones: Registrar explícitamente en leads_asignaciones
                if (dataToSave.empleado_asignado_id && dataToSave.empleado_asignado_id !== 'none') {
                    const assignedTech = technicians.find(t => t.id === dataToSave.empleado_asignado_id);
                    if (assignedTech && assignedTech.auth_user_id) {
                        try {
                            await assignLead(leadId, assignedTech.auth_user_id, user?.id);
                        } catch (assignErr) {
                            console.error('Error auto-assigning lead globally:', assignErr);
                        }
                    }
                }
            }

            // 1. Update basic fields
            const { error } = await supabase.from('leads').update(dataToSave).eq('id', leadId);
            if (error) throw error;

            // 2. Task 2: Update Category via RPC if changed and user is admin
            if (sessionRole?.rol === 'admin' && formData.categoria_codigo !== originalCategoryCode) {
                const { error: rpcError } = await supabase.rpc('admin_set_lead_categoria', {
                    p_lead_id: leadId,
                    p_categoria_codigo: formData.categoria_codigo
                });

                if (rpcError) {
                    // Silent error log
                    toast({
                        variant: 'destructive',
                        title: 'Error al actualizar categoría',
                        description: rpcError.message
                    });
                } else {
                    toast({
                        title: 'Categoría actualizada',
                        description: 'La categoría del lead ha sido modificada correctamente.'
                    });
                }
            }

            // 3. Upload images
            if (selectedFiles.length > 0) {
                await uploadImages(leadId);
            }

            toast({ title: 'Lead actualizado', description: 'Los cambios se han guardado correctamente.' });
            if (onLeadUpdated) onLeadUpdated();
            onClose();
        } catch (error) {
            // Silent error log
            let msg = error.message;
            if (msg && (msg.includes('row-level security') || msg.includes('policy'))) {
                msg = 'No tienes permisos suficientes para modificar este lead.';
            }
            toast({ variant: 'destructive', title: 'Error al actualizar', description: msg });
        } finally {
            setSaving(false);
            setShowStatusConfirm(false);
            setPendingData(null);
            setConfirmType(null);
        }
    };

    const confirmAction = (amount = null) => {
        if (!pendingData) return;
        if (confirmType === 'presupuestado') {
            const newData = { ...pendingData };
            if (amount !== null) {
                newData.base_imponible = amount;
            }
            performSave(newData);
        } else if (confirmType === 'set_visit') {
            const newData = { ...pendingData, estado: 'visita_agendada', previous_status: originalLead.estado };
            performSave(newData);
        } else if (confirmType === 'restore_status') {
            const newData = { ...pendingData, estado: restoreTargetStatus, previous_status: null };
            performSave(newData);
        }
    };

    const cancelAction = () => {
        if (!pendingData) return;
        const newData = { ...pendingData };
        if (confirmType === 'set_visit') {
            newData.previous_status = originalLead.previous_status;
        }
        performSave(newData);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (clientType === 'empresa' && !formData.nombre_empresa) {
            toast({ variant: 'destructive', title: 'Faltan datos', description: 'El nombre de la empresa es obligatorio.' });
            return;
        }
        if (!formData.nombre_contacto) {
            toast({ variant: 'destructive', title: 'Faltan datos', description: 'El nombre de contacto es obligatorio.' });
            return;
        }

        const updateData = {
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
            fecha_visita: formData.fecha_visita ? new Date(formData.fecha_visita).toISOString() : null,
            empleado_asignado_id: formData.empleado_asignado_id === 'none' ? null : formData.empleado_asignado_id,
            // 'origen' is deprecated in UI, we don't update it to avoid overwriting legacy data if not needed
            // If you want to clear it, uncomment: origen: null 
            previous_status: originalLead.previous_status,
            archivado: formData.archivado,
        };

        // Status transition logic
        const currentStatus = updateData.estado;
        const hasVisitDate = !!updateData.fecha_visita;
        const hadVisitDate = !!originalLead.fecha_visita;
        const terminalStatuses = ['aceptado', 'rechazado', 'cancelado', 'anulado'];

        if (hasVisitDate && !hadVisitDate) {
            if (currentStatus !== 'visita_agendada') {
                if (terminalStatuses.includes(currentStatus)) {
                    setPendingData(updateData);
                    setConfirmType('set_visit');
                    setShowStatusConfirm(true);
                    return;
                } else if (currentStatus === 'presupuestado') {
                    // Si se puso fecha_visita Y se puso a presupuestado a la vez
                    updateData.previous_status = originalLead.estado;
                    setPendingData(updateData);
                    setConfirmType('presupuestado');
                    setShowStatusConfirm(true);
                    return;
                } else {
                    updateData.previous_status = originalLead.estado;
                    updateData.estado = 'visita_agendada';
                    toast({ title: "Estado actualizado", description: "Estado cambiado a 'Visita Agendada' autom." });
                }
            }
        } else if (!hasVisitDate && hadVisitDate) {
            updateData.previous_status = null;
            if (currentStatus === 'visita_agendada') {
                if (originalLead.previous_status) {
                    updateData.estado = originalLead.previous_status;
                } else {
                    updateData.estado = 'nuevo';
                }
                toast({ title: "Estado restaurado", description: `Estado restaurado a: ${updateData.estado.toUpperCase()}` });
            } else if (terminalStatuses.includes(currentStatus) && originalLead.previous_status) {
                setRestoreTargetStatus(originalLead.previous_status);
                setPendingData(updateData);
                setConfirmType('restore_status');
                setShowStatusConfirm(true);
                return;
            } else if (currentStatus === 'presupuestado') {
                setPendingData(updateData);
                setConfirmType('presupuestado');
                setShowStatusConfirm(true);
                return;
            }
        } else if (currentStatus === 'presupuestado' && originalLead.estado !== 'presupuestado') {
            // Normal transition to presupuestado without date changes
            setPendingData(updateData);
            setConfirmType('presupuestado');
            setShowStatusConfirm(true);
            return;
        }

        await performSave(updateData);
    };

    const isAdmin = sessionRole?.rol === 'admin';

    // Filter categories into 'Personas' and 'Orígenes'
    const personas = categories.filter(c => c.tipo === 'persona');
    const origenes = categories.filter(c => c.tipo !== 'persona');

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="w-full max-w-4xl bg-background border rounded-xl shadow-2xl flex flex-col max-h-[95vh]"
                    >
                        <div className="flex items-center justify-between p-6 border-b shrink-0">
                            <h2 className="text-2xl font-bold">Editar Lead</h2>
                            <Button variant="ghost" size="icon" onClick={onClose}><X /></Button>
                        </div>

                        {loading ? (
                            <div className="p-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                <div className="space-y-3">
                                    <Label className="text-base font-medium">Tipo de Cliente</Label>
                                    <RadioGroup value={clientType} onValueChange={setClientType} className="flex gap-4">
                                        <div onClick={() => setClientType('particular')} className={`flex items-center space-x-2 border p-4 rounded-lg flex-1 cursor-pointer transition-all ${clientType === 'particular' ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'hover:bg-muted/50'}`}>
                                            <RadioGroupItem value="particular" id="edit-particular" />
                                            <Label htmlFor="edit-particular" className="flex items-center gap-2 cursor-pointer w-full font-semibold pointer-events-none"><User className="w-4 h-4" /> Particular</Label>
                                        </div>
                                        <div onClick={() => setClientType('empresa')} className={`flex items-center space-x-2 border p-4 rounded-lg flex-1 cursor-pointer transition-all ${clientType === 'empresa' ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'hover:bg-muted/50'}`}>
                                            <RadioGroupItem value="empresa" id="edit-empresa" />
                                            <Label htmlFor="edit-empresa" className="flex items-center gap-2 cursor-pointer w-full font-semibold pointer-events-none"><Building2 className="w-4 h-4" /> CDAD PROPIETARIOS</Label>
                                        </div>
                                    </RadioGroup>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <h3 className="font-semibold flex items-center gap-2 pb-2 border-b text-primary"><User className="w-4 h-4" /> Datos de Contacto</h3>
                                        <AnimatePresence>
                                            {clientType === 'empresa' && (
                                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
                                                    <div className="space-y-2">
                                                        <Label>Nombre Cdad Propietarios</Label>
                                                        <Input value={formData.nombre_empresa} onChange={e => setFormData({ ...formData, nombre_empresa: e.target.value })} placeholder="Comunidad de Propietarios..." />
                                                    </div>
                                                    <div className="space-y-2"><Label>CIF / NIF</Label><Input value={formData.cif} onChange={e => setFormData({ ...formData, cif: e.target.value })} placeholder="B12345678" /></div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        <div className="space-y-2">
                                            <Label>{clientType === 'particular' ? 'Nombre' : 'Nombre de Contacto'}</Label>
                                            <Input value={formData.nombre_contacto} onChange={e => setFormData({ ...formData, nombre_contacto: e.target.value })} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2"><Label>Teléfono</Label><Input value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value })} /></div>
                                            <div className="space-y-2"><Label>Email</Label><Input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="font-semibold flex items-center gap-2 pb-2 border-b text-primary"><MapPin className="w-4 h-4" /> Ubicación</h3>
                                        <div className="space-y-2"><Label>Dirección Completa</Label><Input value={formData.direccion} onChange={e => setFormData({ ...formData, direccion: e.target.value })} /></div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2"><Label>Municipio</Label><Input value={formData.municipio} onChange={e => setFormData({ ...formData, municipio: e.target.value })} /></div>
                                            <div className="space-y-2"><Label>C. Postal</Label><Input value={formData.codigo_postal} onChange={e => setFormData({ ...formData, codigo_postal: e.target.value })} /></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="font-semibold flex items-center gap-2 pb-2 border-b text-primary"><FileText className="w-4 h-4" /> Detalles y Estado</h3>
                                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="space-y-2"><Label>Partida</Label>
                                            <Select value={formData.partida} onValueChange={v => setFormData({ ...formData, partida: v })}>
                                                <SelectTrigger><SelectValue placeholder="Partida" /></SelectTrigger>
                                                <SelectContent>
                                                    {partidas.map(p => (
                                                        <SelectItem key={p.key || p.label} value={p.key || "unknown"}>{p.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2"><Label>Técnico</Label>
                                            <Select value={formData.empleado_asignado_id} onValueChange={v => setFormData({ ...formData, empleado_asignado_id: v })}>
                                                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                                                <SelectContent><SelectItem value="none">-- Sin asignar --</SelectItem>{technicians.map(t => <SelectItem key={t.id} value={t.id || "unknown"}>{t.nombre} {t.apellidos}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2"><Label>Estado</Label>
                                            <Select value={formData.estado} onValueChange={v => setFormData({ ...formData, estado: v })}>
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

                                    {/* Archivo Toggle Row */}
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-secondary/20 p-3 rounded-lg border">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="archive-lead"
                                                checked={formData.archivado}
                                                onCheckedChange={toggleArchive}
                                                disabled={archiving}
                                            />
                                            <Label htmlFor="archive-lead" className="cursor-pointer font-medium flex items-center gap-2">
                                                {archiving && <Loader2 className="h-3 w-3 animate-spin" />}
                                                Archivar lead
                                            </Label>
                                        </div>
                                        {formData.archivado_at && (
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Archive className="h-3 w-3" />
                                                Archivado el: {new Date(formData.archivado_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label>Fecha Visita</Label><Input type="datetime-local" value={formData.fecha_visita} onChange={e => setFormData({ ...formData, fecha_visita: e.target.value })} /></div>

                                        {/* Categoria Selector */}
                                        <div className="space-y-2">
                                            <Label className="flex items-center gap-2">
                                                Procedencia
                                                {!isAdmin && <span className="text-[10px] text-muted-foreground font-normal ml-auto">(Solo admin)</span>}
                                            </Label>
                                            <Select
                                                value={formData.categoria_codigo}
                                                onValueChange={(v) => setFormData({ ...formData, categoria_codigo: v })}
                                                disabled={!isAdmin}
                                            >
                                                <SelectTrigger className={!isAdmin ? "bg-muted/50 opacity-80" : ""}>
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
                                    <div className="space-y-2"><Label>Comentarios</Label><Textarea value={formData.comentario} onChange={e => setFormData({ ...formData, comentario: e.target.value })} className="min-h-[100px]" /></div>
                                </div>

                                <div className="space-y-4 pb-4">
                                    <h3 className="font-semibold flex items-center gap-2 pb-2 border-b text-primary">
                                        <ImageIcon className="w-4 h-4" /> Añadir Fotos y Archivos
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
                                                    <Trash2 className="h-4 w-4" />
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
                                            {selectedFiles.length} archivos nuevos seleccionados para subir
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="p-6 border-t bg-muted/10 flex justify-end gap-3 shrink-0">
                            <Button variant="outline" onClick={onClose}>Cancelar</Button>
                            <Button onClick={handleSubmit} disabled={saving || loading}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Guardar Cambios</Button>
                        </div>
                    </motion.div>

                    <AlertDialog open={showStatusConfirm} onOpenChange={setShowStatusConfirm}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5 text-orange-500" />
                                    <AlertDialogTitle>
                                        {confirmType === 'set_visit' ? 'Cambio de Estado Automático' : 'Restaurar Estado Anterior'}
                                    </AlertDialogTitle>
                                </div>
                                <AlertDialogDescription>
                                    {confirmType === 'set_visit' ? (
                                        <>
                                            Has asignado una fecha de visita, pero el lead está en estado <strong>{pendingData?.estado?.toUpperCase()}</strong>.
                                            <br /><br />
                                            ¿Deseas cambiar el estado automáticamente a <strong>AGENDADA VISITA</strong>?
                                        </>
                                    ) : (
                                        <>
                                            Has eliminado la fecha de visita. El lead tenía un estado previo de <strong>{restoreTargetStatus?.toUpperCase()}</strong>.
                                            <br /><br />
                                            ¿Deseas restaurar este estado o mantener el actual ({pendingData?.estado?.toUpperCase()})?
                                        </>
                                    )}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={cancelAction}>
                                    {confirmType === 'set_visit' ? 'No, mantener estado actual' : 'No, mantener estado actual'}
                                </AlertDialogCancel>
                                <AlertDialogAction onClick={confirmAction}>
                                    {confirmType === 'set_visit' ? 'Sí, cambiar a Agendada Visita' : `Sí, restaurar a ${restoreTargetStatus?.toUpperCase()}`}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <BudgetPopup
                        isOpen={showStatusConfirm && confirmType === 'presupuestado'}
                        onClose={() => setShowStatusConfirm(false)}
                        onConfirm={(amount) => confirmAction(amount)}
                        isSubmitting={saving}
                    />
                </div>
            )}
        </AnimatePresence>
    );
};

export default EditLeadModal;