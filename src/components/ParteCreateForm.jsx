import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Loader2, Save, ArrowLeft, User, Phone, MapPin, Calendar, 
  Image as ImageIcon, Upload, X, UserCog, Building2, Briefcase
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const ParteCreateForm = ({ navigate, parteId, isEdit = false }) => {
  const { user, sessionRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [employees, setEmployees] = useState([]);
  const [activeObras, setActiveObras] = useState([]);
  
  // Image upload state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  
  const [formData, setFormData] = useState({
    cliente_nombre: '',
    telefono_contacto: '',
    direccion_servicio: '',
    descripcion_trabajo: '',
    tecnico_asignado_id: 'unassigned', 
    obra_id: 'none', 
    fecha_visita: '', 
    persona_contacto: '',
    es_garantia: false,
    estado: 'nuevo' // Default to 'nuevo' as requested
  });

  const isFincaAdmin = sessionRole?.rol === 'finca_admin';
  const canAssignTechnician = ['admin', 'encargado', 'finca_admin'].includes(sessionRole?.rol);

  useEffect(() => {
    fetchEmployees();
    fetchActiveObras();
    if (isEdit && parteId) {
      fetchParteData();
    }
    
    return () => {
      previews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [isEdit, parteId]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('empleados')
        .select('id, nombre, apellidos, rol')
        .eq('activo', true)
        .order('nombre');
      
      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los empleados para asignación.' });
    }
  };

  const fetchActiveObras = async () => {
    try {
      const { data, error } = await supabase
        .from('proyectos') 
        .select('id, nombre_proyecto, estado')
        .eq('estado', 'activo')
        .order('nombre_proyecto');
      
      if (error) throw error;
      setActiveObras(data || []);
    } catch (error) {
      console.error('Error fetching obras:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las obras activas.' });
    }
  };

  const fetchParteData = async () => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('partes')
        .select('*')
        .eq('id', parteId)
        .single();

      if (error) throw error;

      if (data) {
        let formattedDate = '';
        if (data.fecha_visita) {
          const date = new Date(data.fecha_visita);
          const offset = date.getTimezoneOffset() * 60000;
          formattedDate = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
        }

        setFormData({
          cliente_nombre: data.cliente_nombre || '',
          telefono_contacto: data.telefono_contacto || '',
          direccion_servicio: data.direccion_servicio || '',
          descripcion_trabajo: data.descripcion_trabajo || '',
          tecnico_asignado_id: data.tecnico_asignado_id || 'unassigned',
          obra_id: data.proyecto_id || 'none',
          fecha_visita: formattedDate,
          persona_contacto: data.persona_contacto || '',
          es_garantia: data.es_garantia || false,
          estado: data.estado || 'nuevo'
        });
      }
    } catch (error) {
      console.error('Error fetching parte:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el parte.' });
      navigate('/gestion/partes');
    } finally {
      setLoadingData(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTechnicianChange = (value) => {
    setFormData(prev => ({ ...prev, tecnico_asignado_id: value }));
  };

  const handleObraChange = (value) => {
    setFormData(prev => ({ ...prev, obra_id: value }));
  };

  const handleStateChange = (value) => {
    setFormData(prev => ({ ...prev, estado: value }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newFiles = [];
    const newPreviews = [];

    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        newFiles.push(file);
        newPreviews.push(URL.createObjectURL(file));
      } else {
        toast({
          variant: "destructive",
          title: "Archivo no válido",
          description: `El archivo ${file.name} no es una imagen válida.`
        });
      }
    });

    setSelectedFiles(prev => [...prev, ...newFiles]);
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

  const uploadImages = async (targetParteId) => {
    if (selectedFiles.length === 0) return;

    try {
      const uploadPromises = selectedFiles.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${targetParteId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('partes-data')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('partes-data')
          .getPublicUrl(filePath);

        return {
          parte_id: targetParteId,
          archivo_url: publicUrl,
          nombre_archivo: file.name,
          tipo_archivo: file.type,
          subido_por: sessionRole.empleadoId
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      
      const { error: dbError } = await supabase
        .from('partes_archivos')
        .insert(uploadedFiles);

      if (dbError) throw dbError;

    } catch (error) {
      console.error("Error uploading images:", error);
      toast({ 
        variant: "destructive", 
        title: "Error al subir imágenes", 
        description: "El parte se guardó, pero algunas imágenes pudieron fallar." 
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.cliente_nombre || !formData.direccion_servicio || !formData.descripcion_trabajo) {
      toast({ variant: 'destructive', title: 'Campos requeridos', description: 'Por favor completa los campos obligatorios.' });
      return;
    }

    if (isFincaAdmin) {
        if (!formData.persona_contacto || !formData.telefono_contacto) {
            toast({ variant: 'destructive', title: 'Campos requeridos', description: 'Para administradores de finca, la persona de contacto y el teléfono son obligatorios.' });
            return;
        }
    }

    setLoading(true);
    try {
      const creatorId = sessionRole?.empleadoId || null;
      const tecnicoId = formData.tecnico_asignado_id === 'unassigned' ? null : formData.tecnico_asignado_id;
      const proyectoId = formData.obra_id === 'none' ? null : formData.obra_id;

      const payload = {
        ...formData,
        tecnico_asignado_id: tecnicoId,
        proyecto_id: proyectoId,
        fecha_visita: formData.fecha_visita ? new Date(formData.fecha_visita).toISOString() : null,
        estado: formData.estado, // Ensure state is saved
        ...(isEdit ? {} : { 
            created_by: creatorId, 
            administrador_finca_id: isFincaAdmin ? creatorId : null 
        })
      };
      
      delete payload.obra_id;

      let targetId = parteId;
      
      if (isEdit) {
        const { error: updateError } = await supabase
          .from('partes')
          .update(payload)
          .eq('id', parteId);
        if (updateError) throw updateError;
      } else {
        const { data: insertData, error: insertError } = await supabase
          .from('partes')
          .insert(payload)
          .select()
          .single();
        
        if (insertError) throw insertError;
        targetId = insertData.id;
      }

      if (selectedFiles.length > 0) {
        if (!sessionRole?.empleadoId) {
          toast({ variant: 'destructive', title: 'Aviso', description: 'No se pueden subir imágenes: Usuario no vinculado a empleado.' });
        } else {
          await uploadImages(targetId);
        }
      }

      toast({ 
        title: isEdit ? 'Parte actualizado' : 'Parte creado', 
        description: isEdit ? 'Los cambios se han guardado correctamente.' : 'El nuevo parte de trabajo ha sido registrado.' 
      });
      
      navigate('/gestion/partes');
    } catch (error) {
      console.error('Error saving parte:', error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo guardar el parte.' });
    } finally {
      setLoading(false);
    }
  };

  const renderStateItem = (value, label, colorClass) => (
    <SelectItem value={value} className="cursor-pointer">
      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${colorClass} shadow-sm`}></span>
        <span className="font-medium">{label}</span>
      </div>
    </SelectItem>
  );

  if (loadingData) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full relative min-h-screen bg-muted/5">
        <Helmet>
            <title>{isEdit ? 'Editar Parte' : 'Nuevo Parte'} | Gestión</title>
        </Helmet>

        {/* Hero Header */}
        <div className="relative h-48 w-full overflow-hidden bg-slate-900">
            <div 
                className="absolute inset-0 bg-cover bg-center opacity-60"
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1559136656-3db4bf6c35f8')` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
            
            <div className="absolute bottom-0 left-0 p-6 md:p-8 w-full max-w-4xl mx-auto flex items-end justify-between">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-primary-foreground/80 mb-1">
                        <Briefcase className="w-4 h-4" />
                        <span className="text-sm font-medium uppercase tracking-wider">Gestión de Servicios</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-sm">
                        {isEdit ? 'Editar Parte de Trabajo' : 'Nuevo Parte de Trabajo'}
                    </h1>
                    <p className="text-slate-200 text-sm max-w-xl hidden md:block">
                        {isEdit 
                            ? 'Modifica los detalles, actualiza el estado o asigna técnicos al servicio.' 
                            : 'Registra una nueva solicitud, asigna recursos y notifica automáticamente al equipo.'}
                    </p>
                </div>
                <Button variant="secondary/20" size="sm" onClick={() => navigate('/gestion/partes')} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Volver
                </Button>
            </div>
        </div>

      <div className="w-full max-w-4xl mx-auto p-4 md:p-8 -mt-8 relative z-10">
        <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Cliente Card */}
            <Card className="border-t-4 border-t-primary shadow-lg">
            <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-primary" /> Información del Cliente
                </CardTitle>
                <CardDescription>Introduce los datos del cliente para este parte.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="cliente_nombre" className="text-base font-semibold">Cliente / Empresa (Texto Libre) <span className="text-primary">*</span></Label>
                    <div className="relative">
                        <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="cliente_nombre"
                            name="cliente_nombre"
                            value={formData.cliente_nombre}
                            onChange={handleChange}
                            placeholder="Nombre del cliente o empresa"
                            className="pl-9 bg-background"
                            required
                        />
                    </div>
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="persona_contacto">
                        Persona de Contacto {isFincaAdmin && <span className="text-destructive">*</span>}
                    </Label>
                    <div className="relative">
                        <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id="persona_contacto" 
                            name="persona_contacto" 
                            value={formData.persona_contacto} 
                            onChange={handleChange} 
                            className="pl-9"
                            placeholder="Ej. Juan Pérez (Presidente)" 
                            required={isFincaAdmin}
                        />
                    </div>
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="telefono_contacto">
                        Teléfono {isFincaAdmin && <span className="text-destructive">*</span>}
                    </Label>
                    <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id="telefono_contacto" 
                            name="telefono_contacto" 
                            value={formData.telefono_contacto} 
                            onChange={handleChange} 
                            className="pl-9"
                            placeholder="600 000 000" 
                            required={isFincaAdmin}
                        />
                    </div>
                </div>
                
                <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="direccion_servicio">Dirección del Servicio <span className="text-primary">*</span></Label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id="direccion_servicio" 
                            name="direccion_servicio" 
                            value={formData.direccion_servicio} 
                            onChange={handleChange} 
                            className="pl-9 bg-slate-50/50"
                            placeholder="Ej. C/ Ejemplo, 123, 4ºA" 
                            required 
                        />
                    </div>
                </div>
            </CardContent>
            </Card>

            {/* Detalle Trabajo Card */}
            <Card className="shadow-md">
            <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" /> Detalle del Trabajo
                </CardTitle>
                <CardDescription>Descripción técnica y asignación de recursos</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
                
                {/* Status Selection (Visible in Edit or Create) */}
                <div className="p-4 bg-muted/30 rounded-lg border flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                    <div className="space-y-1">
                        <Label htmlFor="estado" className="font-medium">Estado del Parte</Label>
                        <p className="text-xs text-muted-foreground">Define en qué fase se encuentra el trabajo.</p>
                    </div>
                    <div className="w-full md:w-auto min-w-[200px]">
                        <Select value={formData.estado} onValueChange={handleStateChange}>
                            <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Seleccionar estado" />
                            </SelectTrigger>
                            <SelectContent>
                            {renderStateItem('nuevo', 'NUEVO', 'bg-gray-400')}
                            {renderStateItem('contactado', 'CONTACTADO', 'bg-blue-500')}
                            {renderStateItem('agendada_visita', 'AGENDADA VISITA', 'bg-indigo-500')}
                            {renderStateItem('visitado', 'VISITADO', 'bg-purple-500')}
                            {renderStateItem('en_preparacion', 'EN PREPARACION', 'bg-amber-500')}
                            {renderStateItem('presupuestado', 'PRESUPUESTADO', 'bg-orange-500')}
                            {renderStateItem('aceptado', 'ACEPTADO', 'bg-emerald-500')}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex items-center space-x-2 bg-purple-50 dark:bg-purple-900/20 p-3 rounded-md border border-purple-100 dark:border-purple-800">
                    <Checkbox 
                        id="es_garantia" 
                        checked={formData.es_garantia} 
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, es_garantia: checked }))} 
                    />
                    <Label htmlFor="es_garantia" className="cursor-pointer font-medium text-purple-900 dark:text-purple-100">Trabajo en Garantía</Label>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="descripcion_trabajo">Descripción de la Solicitud <span className="text-primary">*</span></Label>
                    <Textarea 
                        id="descripcion_trabajo" 
                        name="descripcion_trabajo" 
                        value={formData.descripcion_trabajo} 
                        onChange={handleChange} 
                        placeholder="Describe detalladamente el problema, avería o trabajo a realizar..." 
                        className="min-h-[120px] resize-y"
                        required 
                    />
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                {canAssignTechnician && (
                    <>
                    <div className="space-y-2">
                        <Label htmlFor="tecnico_asignado_id" className="flex items-center gap-2">
                        <UserCog className="w-4 h-4 text-muted-foreground" />
                        Técnico Asignado
                        </Label>
                        <Select value={formData.tecnico_asignado_id} onValueChange={handleTechnicianChange}>
                        <SelectTrigger id="tecnico_asignado_id" className="bg-background">
                            <SelectValue placeholder="Sin asignar" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="unassigned">-- Sin asignar --</SelectItem>
                            {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                                {emp.nombre} {emp.apellidos} ({emp.rol})
                            </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="obra_id" className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        Asignar a Obra (Opcional)
                        </Label>
                        <Select value={formData.obra_id} onValueChange={handleObraChange}>
                        <SelectTrigger id="obra_id" className="bg-background">
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
                    </>
                )}
                
                <div className="space-y-2">
                    <Label htmlFor="fecha_visita">Fecha Prevista de Visita</Label>
                    <Input 
                        id="fecha_visita" 
                        name="fecha_visita" 
                        type="datetime-local" 
                        value={formData.fecha_visita} 
                        onChange={handleChange}
                        className="bg-background" 
                    />
                </div>
                </div>
            </CardContent>
            </Card>

            {/* Evidencias Card */}
            <Card className="shadow-md">
            <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-primary" /> Fotos / Evidencias Iniciales
                </CardTitle>
                <CardDescription>Añade imágenes para que el técnico visualice el problema antes de ir.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    {previews.map((url, idx) => (
                    <div key={idx} className="relative group aspect-square bg-muted rounded-xl overflow-hidden border shadow-sm">
                        <img src={url} alt={`Preview ${idx}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                        <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm hover:bg-red-500"
                        >
                        <X className="w-3 h-3" />
                        </button>
                    </div>
                    ))}
                    
                    <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-muted-foreground/20 rounded-xl hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all group">
                    <div className="p-3 rounded-full bg-muted group-hover:bg-background transition-colors mb-2">
                        <Upload className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground group-hover:text-primary text-center px-2">Subir fotos</span>
                    <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleFileChange}
                    />
                    </label>
                </div>
                {selectedFiles.length > 0 && (
                    <p className="text-xs text-muted-foreground text-center sm:text-left animate-in fade-in">
                    {selectedFiles.length} {selectedFiles.length === 1 ? 'archivo seleccionado' : 'archivos seleccionados'} para subir.
                    </p>
                )}
                </div>
            </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 pb-10">
                <Button type="button" variant="ghost" onClick={() => navigate('/gestion/partes')} className="text-muted-foreground hover:text-foreground">
                    Cancelar operación
                </Button>
                <div className="flex gap-3">
                    <Button type="submit" disabled={loading} size="lg" className="min-w-[150px] shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:-translate-y-0.5">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {isEdit ? 'Guardar Cambios' : 'Crear Parte'}
                    </Button>
                </div>
            </div>
        </form>
      </div>
    </div>
  );
};

export default ParteCreateForm;