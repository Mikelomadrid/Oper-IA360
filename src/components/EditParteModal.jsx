import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Upload, Image as ImageIcon, Loader2, 
  User, Building2, MapPin, Briefcase, Save, Trash2, ShieldCheck, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { 
  PARTE_UI_STATES, 
  mapInternalToUI, 
  mapUIToInternal 
} from '@/utils/parteEstadoUIMap';

const EditParteModal = ({ isOpen, onClose, parteId, onParteUpdated }) => {
    const { sessionRole } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [technicians, setTechnicians] = useState([]);
    const [activeObras, setActiveObras] = useState([]);
    const [fetchError, setFetchError] = useState(null);
    
    // Image Upload State
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [previews, setPreviews] = useState([]);
    const fileInputRef = useRef(null);
    
    // UI State holds the UI string (e.g., "VISITA AGENDADA"), not raw DB value
    const [formData, setFormData] = useState({
        cliente_nombre: '',
        persona_contacto: '',
        telefono_contacto: '',
        direccion_servicio: '',
        es_garantia: false,
        descripcion_trabajo: '',
        tecnico_asignado_id: 'none',
        obra_id: 'none',
        fecha_visita: '',
        estado: 'NUEVO' // Default UI state
    });

    useEffect(() => {
        if (isOpen) {
            console.log("DEBUG: Modal opened for parteId:", parteId);
            fetchDependencies();
            if (parteId) fetchParteData();
            // Reset upload state on open
            setSelectedFiles([]);
            setPreviews([]);
        }
        return () => {
            previews.forEach(url => URL.revokeObjectURL(url));
        };
    }, [isOpen, parteId]);

    const fetchDependencies = async () => {
        try {
            const [empsResponse, obrasResponse] = await Promise.all([
                supabase
                    .from('empleados')
                    .select('id, nombre, apellidos, rol')
                    .eq('activo', true)
                    .order('nombre'),
                supabase
                    .from('proyectos')
                    .select('id, nombre_proyecto')
                    .eq('estado', 'activo')
                    .order('nombre_proyecto')
            ]);
            
            if (empsResponse.error) {
                console.error("DEBUG: Error fetching employees:", empsResponse.error);
                setFetchError("No se pudieron cargar los técnicos.");
                throw empsResponse.error;
            }

            setTechnicians(empsResponse.data || []);
            setActiveObras(obrasResponse.data || []);
        } catch (error) {
            console.error("Error loading dependencies", error);
            toast({ variant: 'destructive', title: 'Error de carga', description: 'No se pudieron cargar las dependencias.' });
        }
    };

    const fetchParteData = async () => {
        setLoading(true);
        try {
            console.log("DEBUG: Fetching parte data for:", parteId);
            const { data, error } = await supabase.from('partes').select('*').eq('id', parteId).single();
            if (error) throw error;
            
            if (data) {
                let fechaVisitaFormatted = '';
                if (data.fecha_visita) {
                    const date = new Date(data.fecha_visita);
                    const offset = date.getTimezoneOffset() * 60000;
                    fechaVisitaFormatted = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
                }

                // Map DB internal state to UI state for display
                const uiState = mapInternalToUI(data.estado);

                setFormData({
                    cliente_nombre: data.cliente_nombre || '',
                    persona_contacto: data.persona_contacto || '',
                    telefono_contacto: data.telefono_contacto || '',
                    direccion_servicio: data.direccion_servicio || '',
                    es_garantia: data.es_garantia || false,
                    descripcion_trabajo: data.descripcion_trabajo || '',
                    tecnico_asignado_id: data.tecnico_asignado_id || 'none',
                    obra_id: data.proyecto_id || 'none',
                    fecha_visita: fechaVisitaFormatted,
                    estado: uiState
                });
            }
        } catch (error) {
            console.error("DEBUG: Error fetching parte:", error);
            toast({ variant: 'destructive', title: 'Error', description: error.message });
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = (e) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const newFiles = Array.from(e.target.files);
        setSelectedFiles(prev => [...prev, ...newFiles]);

        const newPreviews = newFiles.map(file => {
            if (file.type.startsWith('image/')) {
                return URL.createObjectURL(file);
            }
            return null; 
        });
        setPreviews(prev => [...prev, ...newPreviews]);
    };

    const removeFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => {
            const newPreviews = prev.filter((_, i) => i !== index);
            if (prev[index]) URL.revokeObjectURL(prev[index]);
            return newPreviews;
        });
    };

    const uploadFiles = async (targetParteId) => {
        if (selectedFiles.length === 0) return;

        const uploadPromises = selectedFiles.map(async (file) => {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `archivos/${targetParteId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('partes-data')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            await supabase.from('partes_archivos').insert({
                parte_id: targetParteId,
                archivo_url: filePath,
                nombre_archivo: file.name,
                tipo_archivo: file.type,
                subido_por: sessionRole?.empleadoId
            });
            
            await supabase.from('partes_actividad').insert({
                parte_id: targetParteId,
                usuario_id: sessionRole?.empleadoId,
                contenido: JSON.stringify({
                    path: filePath,
                    name: file.name,
                    type: file.type,
                    comment: 'Adjunto añadido durante la edición.'
                }),
                tipo: 'archivo',
                fecha_creacion: new Date().toISOString()
            });
        });

        await Promise.all(uploadPromises);
    };

    const handleStateChange = (val) => {
        setFormData(prev => ({ ...prev, estado: val }));
        // Warning for PRESUPUESTADO removed as it is now a standard supported state
    };

    const handleTechnicianChange = (value) => {
        setFormData(prev => ({ ...prev, tecnico_asignado_id: value }));
    };

    const handleObraChange = (value) => {
        setFormData(prev => ({ ...prev, obra_id: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);

        try {
            if (!formData.cliente_nombre) throw new Error('El nombre del cliente es obligatorio.');
            if (!formData.descripcion_trabajo) throw new Error('La descripción es obligatoria.');

            const tecnicoIdPayload = formData.tecnico_asignado_id === 'none' ? null : formData.tecnico_asignado_id;
            const proyectoIdPayload = formData.obra_id === 'none' ? null : formData.obra_id;

            // Map UI state back to internal DB value
            const internalState = mapUIToInternal(formData.estado);

            const updateData = {
                cliente_nombre: formData.cliente_nombre,
                persona_contacto: formData.persona_contacto,
                telefono_contacto: formData.telefono_contacto,
                direccion_servicio: formData.direccion_servicio,
                es_garantia: formData.es_garantia,
                descripcion_trabajo: formData.descripcion_trabajo,
                tecnico_asignado_id: tecnicoIdPayload,
                proyecto_id: proyectoIdPayload,
                fecha_visita: formData.fecha_visita ? new Date(formData.fecha_visita).toISOString() : null,
                estado: internalState // Saving mapped value
            };

            const { error } = await supabase.from('partes').update(updateData).eq('id', parteId);
            if (error) throw error;

            if (selectedFiles.length > 0) {
                await uploadFiles(parteId);
            }

            toast({ title: 'Parte actualizado', description: 'Los cambios se han guardado correctamente.' });
            if (onParteUpdated) onParteUpdated();
            onClose();
        } catch (error) {
            console.error("Submit error:", error);
            toast({ variant: 'destructive', title: 'Error al actualizar', description: error.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ scale: 0.95, opacity: 0 }} 
                        animate={{ scale: 1, opacity: 1 }} 
                        exit={{ scale: 0.95, opacity: 0 }} 
                        className="w-full max-w-3xl bg-background border rounded-xl shadow-2xl flex flex-col max-h-[95vh]"
                    >
                        <div className="flex items-center justify-between p-6 border-b shrink-0">
                            <h2 className="text-2xl font-bold">Editar Parte de Trabajo</h2>
                            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
                        </div>

                        {loading ? (
                            <div className="p-10 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                
                                {/* Client Info */}
                                <div className="space-y-4 border p-4 rounded-lg bg-card">
                                    <h3 className="font-semibold flex items-center gap-2 pb-2 border-b text-primary">
                                        <User className="w-4 h-4" /> Información del Cliente
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <Label htmlFor="cliente_nombre">Nombre del Cliente / Empresa *</Label>
                                            <Input id="cliente_nombre" value={formData.cliente_nombre} onChange={e => setFormData({...formData, cliente_nombre: e.target.value})} />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label htmlFor="persona_contacto">Persona de Contacto</Label>
                                                <Input id="persona_contacto" value={formData.persona_contacto} onChange={e => setFormData({...formData, persona_contacto: e.target.value})} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="telefono_contacto">Teléfono</Label>
                                                <Input id="telefono_contacto" value={formData.telefono_contacto} onChange={e => setFormData({...formData, telefono_contacto: e.target.value})} />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="direccion_servicio">Dirección del Servicio *</Label>
                                            <Input id="direccion_servicio" value={formData.direccion_servicio} onChange={e => setFormData({...formData, direccion_servicio: e.target.value})} />
                                        </div>
                                    </div>
                                </div>

                                {/* Job Detail */}
                                <div className="space-y-4 border p-4 rounded-lg bg-card">
                                    <h3 className="font-semibold flex items-center gap-2 pb-2 border-b text-primary">
                                        <Briefcase className="w-4 h-4" /> Detalle del Trabajo
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center space-x-2 bg-purple-50 p-2 rounded border border-purple-100 dark:bg-purple-900/20 dark:border-purple-800">
                                            <Checkbox 
                                                id="es_garantia" 
                                                checked={formData.es_garantia} 
                                                onCheckedChange={(checked) => setFormData({...formData, es_garantia: checked})}
                                            />
                                            <Label htmlFor="es_garantia" className="cursor-pointer font-medium text-purple-900 dark:text-purple-300 flex items-center gap-2">
                                                <ShieldCheck className="w-4 h-4" /> Trabajo en Garantía
                                            </Label>
                                        </div>

                                        <div className="space-y-1">
                                            <Label htmlFor="descripcion_trabajo">Descripción de la Solicitud *</Label>
                                            <Textarea 
                                                id="descripcion_trabajo" 
                                                value={formData.descripcion_trabajo} 
                                                onChange={e => setFormData({...formData, descripcion_trabajo: e.target.value})} 
                                                className="min-h-[100px]"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label>Técnico Asignado</Label>
                                                {fetchError ? (
                                                    <div className="text-sm text-destructive border border-destructive/20 bg-destructive/10 p-2 rounded">
                                                        {fetchError} <Button variant="link" className="h-auto p-0 text-destructive" onClick={fetchDependencies}>Reintentar</Button>
                                                    </div>
                                                ) : (
                                                    <Select value={formData.tecnico_asignado_id} onValueChange={handleTechnicianChange}>
                                                        <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">-- Sin asignar --</SelectItem>
                                                            {technicians.map(t => (
                                                                <SelectItem key={t.id} value={t.id}>
                                                                    {t.nombre} {t.apellidos} <span className="text-xs text-muted-foreground ml-1">({t.rol})</span>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="fecha_visita">Fecha Prevista de Visita</Label>
                                                <Input 
                                                    id="fecha_visita" 
                                                    type="datetime-local" 
                                                    value={formData.fecha_visita} 
                                                    onChange={e => setFormData({...formData, fecha_visita: e.target.value})} 
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <Label htmlFor="obra_id" className="flex items-center gap-2">
                                                <Building2 className="w-4 h-4" />
                                                Asignar a Obra (Opcional)
                                            </Label>
                                            <Select value={formData.obra_id} onValueChange={handleObraChange}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar obra..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">-- Sin obra / Ninguna --</SelectItem>
                                                    {activeObras.length > 0 ? (
                                                        activeObras.map((obra) => (
                                                            <SelectItem key={obra.id} value={obra.id}>
                                                                {obra.nombre_proyecto}
                                                            </SelectItem>
                                                        ))
                                                    ) : (
                                                        <SelectItem value="none" disabled>No hay obras activas</SelectItem>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1 pt-2">
                                            <Label className="text-base font-semibold text-blue-700 dark:text-blue-400">
                                                Estado Actual (UI)
                                            </Label>
                                            <Select 
                                                value={formData.estado} 
                                                onValueChange={handleStateChange}
                                            >
                                                <SelectTrigger className="w-full bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800 font-medium">
                                                    <SelectValue placeholder="Selecciona estado" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PARTE_UI_STATES.map(status => (
                                                        <SelectItem key={status} value={status}>
                                                            {status}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                Selecciona el estado visual. Se guardará el valor interno correspondiente.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Files */}
                                <div className="space-y-4 border p-4 rounded-lg bg-card">
                                    <h3 className="font-semibold flex items-center gap-2 pb-2 border-b text-primary">
                                        <ImageIcon className="w-4 h-4" /> Fotos / Evidencias
                                    </h3>
                                    
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                        {previews.map((url, idx) => (
                                            <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
                                                {url ? (
                                                    <img src={url} alt="Preview" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gray-100 text-xs text-gray-500">
                                                        <FileText className="w-8 h-8 mb-1" />
                                                        <span className="block w-full text-center px-1 truncate">{selectedFiles[idx]?.name}</span>
                                                    </div>
                                                )}
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
                                                accept="image/*,application/pdf"
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
                            <Button onClick={handleSubmit} disabled={saving || loading} className="bg-primary text-primary-foreground hover:bg-primary/90">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} 
                                Guardar Cambios
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default EditParteModal;