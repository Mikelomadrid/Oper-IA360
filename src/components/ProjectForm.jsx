import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Loader2, Share2, Calculator, Tag } from 'lucide-react';
import { ClientSelector } from '@/components/ClientSelector';
import {
    TIPOS_PRINCIPALES_TRABAJO,
    OFICIOS_DOMINANTES,
    OFICIOS_SECUNDARIOS,
    TAMANOS_OPERATIVOS,
    ESTADOS_VALIDEZ_ANALISIS,
    ETIQUETAS_RENTABILIDAD,
    defaultEstadoValidezAnalisis,
} from '@/lib/obraClasificacion';

const projectStatusEnum = ['activo', 'en_espera', 'terminado', 'facturado', 'cobrado', 'garantia', 'cerrado'];

// Selector múltiple sencillo basado en "chips" toggle. Sin librerías externas,
// pensado para listas cortas (oficios_secundarios, etiquetas_rentabilidad).
const MultiSelectToggle = ({ options, value = [], onChange }) => {
    const toggle = (val) => {
        if (value.includes(val)) {
            onChange(value.filter((v) => v !== val));
        } else {
            onChange([...value, val]);
        }
    };
    return (
        <div className="flex flex-wrap gap-2">
            {options.map((opt) => {
                const active = value.includes(opt.value);
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggle(opt.value)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${active
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted/30 text-muted-foreground border-border hover:border-primary/50'
                            }`}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
};

const buildFormState = (project) => {
    if (project) {
        return {
            nombre_proyecto: project.nombre_proyecto || '',
            cliente_id: project.cliente_id || '',
            contacto_nombre: project.contacto_nombre || '',
            contacto_telefono: project.contacto_telefono || '',
            direccion_obra: project.direccion_obra || '',
            descripcion: project.descripcion || '',
            estado: project.estado || 'activo',
            fecha_inicio: project.fecha_inicio ? (typeof project.fecha_inicio === 'string' ? project.fecha_inicio.split('T')[0] : project.fecha_inicio) : '',
            fecha_fin_estimada: project.fecha_fin_estimada ? (typeof project.fecha_fin_estimada === 'string' ? project.fecha_fin_estimada.split('T')[0] : project.fecha_fin_estimada) : '',
            fecha_cierre_real: project.fecha_cierre_real ? (typeof project.fecha_cierre_real === 'string' ? project.fecha_cierre_real.split('T')[0] : project.fecha_cierre_real) : '',
            presupuesto_aceptado: project.presupuesto_aceptado || 0,
            objetivo_margen_pct: project.objetivo_margen_pct || 15,
            gastos_generales_estimados: project.gastos_generales_estimados || 0,
            es_compartida: project.es_compartida || false,
            tipo_reparto: project.tipo_reparto || 'fijo',
            // Clasificación de rentabilidad
            tipo_principal_trabajo: project.tipo_principal_trabajo || '',
            oficio_dominante: project.oficio_dominante || '',
            oficios_secundarios: project.oficios_secundarios || [],
            tamano_operativo: project.tamano_operativo || '',
            estado_validez_analisis: project.estado_validez_analisis || defaultEstadoValidezAnalisis(project.estado || 'activo'),
            etiquetas_rentabilidad: project.etiquetas_rentabilidad || [],
        };
    }
    return {
        nombre_proyecto: '',
        cliente_id: '',
        contacto_nombre: '',
        contacto_telefono: '',
        direccion_obra: '',
        descripcion: '',
        estado: 'activo',
        fecha_inicio: '',
        fecha_fin_estimada: '',
        fecha_cierre_real: '',
        presupuesto_aceptado: 0,
        objetivo_margen_pct: 15,
        gastos_generales_estimados: 0,
        es_compartida: false,
        tipo_reparto: 'fijo',
        // Clasificación de rentabilidad
        tipo_principal_trabajo: '',
        oficio_dominante: '',
        oficios_secundarios: [],
        tamano_operativo: '',
        estado_validez_analisis: defaultEstadoValidezAnalisis('activo'),
        etiquetas_rentabilidad: [],
    };
};

const ProjectForm = ({ project, onSave, onCancel }) => {
    // Use useRef to track the current project ID being edited to prevent overwriting form state on parent re-renders
    const currentProjectIdRef = useRef(project ? project.id : 'new');

    const [formData, setFormData] = useState(() => buildFormState(project));

    // Initialize label from prop if available
    const [initialClientLabel, setInitialClientLabel] = useState(() => {
        if (project && project.cliente && project.cliente.nombre) {
            return project.cliente.nombre;
        }
        return '';
    });

    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(!!project);

    useEffect(() => {
        const incomingId = project ? project.id : 'new';

        if (incomingId !== currentProjectIdRef.current) {
            currentProjectIdRef.current = incomingId;

            if (project) {
                setIsEditing(true);
                setFormData(buildFormState(project));

                if (project.cliente && project.cliente.nombre) {
                    setInitialClientLabel(project.cliente.nombre);
                } else if (project.cliente_id) {
                    const fetchClientName = async () => {
                        const { data } = await supabase.from('clientes').select('nombre').eq('id', project.cliente_id).single();
                        if (data) setInitialClientLabel(data.nombre);
                    };
                    fetchClientName();
                } else {
                    setInitialClientLabel('');
                }
            } else {
                setIsEditing(false);
                setFormData(buildFormState(null));
                setInitialClientLabel('');
            }
        }
    }, [project]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        let processedValue = value;
        if (['presupuesto_aceptado', 'objetivo_margen_pct', 'gastos_generales_estimados'].includes(name)) {
            processedValue = value === '' ? '' : parseFloat(value);
        }
        setFormData(prev => ({ ...prev, [name]: processedValue }));
    };

    const handleSelectChange = (name, value, label) => {
        setFormData(prev => ({ ...prev, [name]: value }));
        if (name === 'cliente_id') {
            setInitialClientLabel(label);
        }
    };

    // NUEVO: al elegir/crear un cliente, autocompletar los datos de la obra desde su ficha.
    // Quedan EDITABLES: el contacto y la dirección de la OBRA pueden diferir de los del cliente
    // (la obra puede estar en otra dirección distinta a la fiscal del cliente).
    const handleClienteChange = (value, label, cliente) => {
        setFormData(prev => {
            const next = { ...prev, cliente_id: value || '' };
            if (cliente) {
                next.contacto_nombre = cliente.contacto || cliente.nombre || prev.contacto_nombre;
                next.contacto_telefono = cliente.telefono || prev.contacto_telefono;
                const dir = cliente.direccion || cliente.calle_numero;
                if (dir) next.direccion_obra = dir;
            }
            return next;
        });
        setInitialClientLabel(label || '');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.nombre_proyecto) {
            toast({ variant: 'destructive', title: 'Error de validación', description: 'Nombre del proyecto es obligatorio.' });
            return;
        }
        // NUEVO: el cliente es obligatorio en la obra (regla de unificación).
        // Si el cliente no existe todavía, créalo desde el propio selector ("Crear cliente nuevo").
        if (!formData.cliente_id) {
            toast({ variant: 'destructive', title: 'Falta el cliente', description: 'Toda obra debe tener un cliente asignado. Búscalo o créalo en el selector de Cliente.' });
            return;
        }
        if (!formData.contacto_nombre) {
            toast({ variant: 'destructive', title: 'Error de validación', description: 'Nombre de contacto es obligatorio.' });
            return;
        }
        if (!formData.contacto_telefono) {
            toast({ variant: 'destructive', title: 'Error de validación', description: 'Teléfono de contacto es obligatorio.' });
            return;
        }
        if (!formData.direccion_obra) {
            toast({ variant: 'destructive', title: 'Error de validación', description: 'Dirección de la obra es obligatoria.' });
            return;
        }

        if (formData.presupuesto_aceptado < 0 || formData.gastos_generales_estimados < 0) {
            toast({ variant: 'destructive', title: 'Error de validación', description: 'Los valores monetarios no pueden ser negativos.' });
            return;
        }
        if (formData.objetivo_margen_pct < 0 || formData.objetivo_margen_pct > 100) {
            toast({ variant: 'destructive', title: 'Error de validación', description: 'El margen objetivo debe estar entre 0 y 100.' });
            return;
        }

        if (formData.estado === 'facturado' && !formData.fecha_cierre_real) {
            toast({ variant: 'destructive', title: 'Error de validación', description: 'La Fecha Cierre Real es obligatoria para proyectos facturados.' });
            return;
        }
        if (formData.estado === 'cerrado' && !formData.fecha_cierre_real) {
            toast({ variant: 'destructive', title: 'Error de validación', description: 'La Fecha Cierre Real es obligatoria para proyectos cerrados.' });
            return;
        }

        // Clasificación mínima obligatoria SOLO al crear una obra nueva.
        // Las obras antiguas pueden quedarse sin clasificar hasta que se revisen.
        if (!isEditing) {
            if (!formData.tipo_principal_trabajo) {
                toast({ variant: 'destructive', title: 'Falta clasificar la obra', description: 'Selecciona el Tipo Principal de Trabajo.' });
                return;
            }
            if (!formData.oficio_dominante) {
                toast({ variant: 'destructive', title: 'Falta clasificar la obra', description: 'Selecciona el Oficio Dominante.' });
                return;
            }
            if (!formData.tamano_operativo) {
                toast({ variant: 'destructive', title: 'Falta clasificar la obra', description: 'Selecciona el Tamaño Operativo.' });
                return;
            }
        }

        setLoading(true);

        const submissionData = {
            nombre_proyecto: formData.nombre_proyecto,
            cliente_id: formData.cliente_id || null,
            contacto_nombre: formData.contacto_nombre,
            contacto_telefono: formData.contacto_telefono,
            direccion_obra: formData.direccion_obra,
            descripcion: formData.descripcion || null,
            estado: formData.estado,
            presupuesto_aceptado: parseFloat(formData.presupuesto_aceptado) || 0,
            objetivo_margen_pct: parseFloat(formData.objetivo_margen_pct) || 0,
            gastos_generales_estimados: parseFloat(formData.gastos_generales_estimados) || 0,
            fecha_inicio: formData.fecha_inicio || null,
            fecha_fin_estimada: formData.fecha_fin_estimada || null,
            fecha_cierre_real: formData.fecha_cierre_real || null,
            es_compartida: formData.es_compartida || false,
            tipo_reparto: formData.tipo_reparto || 'fijo',
            // Clasificación de rentabilidad
            tipo_principal_trabajo: formData.tipo_principal_trabajo || null,
            oficio_dominante: formData.oficio_dominante || null,
            oficios_secundarios: formData.oficios_secundarios || [],
            tamano_operativo: formData.tamano_operativo || null,
            estado_validez_analisis: formData.estado_validez_analisis || 'revisar',
            etiquetas_rentabilidad: formData.etiquetas_rentabilidad || [],
        };

        let error;
        if (isEditing && project && project.id) {
            const { error: updateError } = await supabase.from('proyectos').update(submissionData).eq('id', project.id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase.from('proyectos').insert(submissionData);
            error = insertError;
        }

        setLoading(false);

        if (error) {
            let description = error.message;
            if (error.code === '22P02') {
                description = 'Estado no válido. Selecciona un estado permitido.';
            } else if (error.code === '23514') {
                description = 'Uno de los valores de clasificación no es válido.';
            } else if (error.code === '42501') {
                description = 'No tienes permisos para realizar esta acción.';
            }
            toast({ variant: 'destructive', title: 'Error al guardar', description });
        } else {
            toast({ title: '¡Éxito!', description: `Proyecto ${isEditing ? 'actualizado' : 'creado'} correctamente.` });
            onSave();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="nombre_proyecto">Nombre del Proyecto *</Label>
                    <Input id="nombre_proyecto" name="nombre_proyecto" value={formData.nombre_proyecto} onChange={handleChange} required />
                </div>
                <div>
                    <Label htmlFor="cliente_id">Cliente *</Label>
                    <ClientSelector
                        value={formData.cliente_id}
                        onChange={(value, label, cliente) => handleClienteChange(value, label, cliente)}
                        initialLabel={initialClientLabel}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="contacto_nombre">Contacto *</Label>
                    <Input id="contacto_nombre" name="contacto_nombre" value={formData.contacto_nombre} onChange={handleChange} required />
                </div>
                <div>
                    <Label htmlFor="contacto_telefono">Teléfono *</Label>
                    <Input id="contacto_telefono" name="contacto_telefono" value={formData.contacto_telefono} onChange={handleChange} required />
                </div>
            </div>

            <div>
                <Label htmlFor="direccion_obra">Dirección de la obra *</Label>
                <Textarea id="direccion_obra" name="direccion_obra" value={formData.direccion_obra} onChange={handleChange} required />
            </div>

            <div>
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea id="descripcion" name="descripcion" value={formData.descripcion} onChange={handleChange} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="estado">Estado</Label>
                    <Select name="estado" onValueChange={(value) => handleSelectChange('estado', value)} value={formData.estado}>
                        <SelectTrigger id="estado">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[9999]">
                            {projectStatusEnum.map(status => (
                                <SelectItem key={status} value={status} className="capitalize">
                                    {status.replace('_', ' ')}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="presupuesto_aceptado">Presupuesto Aceptado (€)</Label>
                    <Input id="presupuesto_aceptado" name="presupuesto_aceptado" type="number" step="0.01" value={formData.presupuesto_aceptado} onChange={handleChange} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                    <Label htmlFor="fecha_inicio">Fecha de Inicio</Label>
                    <Input id="fecha_inicio" name="fecha_inicio" type="date" value={formData.fecha_inicio} onChange={handleChange} />
                </div>
                <div>
                    <Label htmlFor="fecha_fin_estimada">Fecha Fin Estimada</Label>
                    <Input id="fecha_fin_estimada" name="fecha_fin_estimada" type="date" value={formData.fecha_fin_estimada} onChange={handleChange} />
                </div>
                <div>
                    <Label htmlFor="fecha_cierre_real" className={formData.estado === 'facturado' || formData.estado === 'cerrado' ? 'text-destructive font-medium' : ''}>
                        Fecha Cierre Real
                    </Label>
                    <Input
                        id="fecha_cierre_real"
                        name="fecha_cierre_real"
                        type="date"
                        value={formData.fecha_cierre_real}
                        onChange={handleChange}
                        required={formData.estado === 'facturado' || formData.estado === 'cerrado'}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="objetivo_margen_pct">Margen Objetivo (%)</Label>
                    <Input id="objetivo_margen_pct" name="objetivo_margen_pct" type="number" step="0.1" value={formData.objetivo_margen_pct} onChange={handleChange} />
                </div>
                <div>
                    <Label htmlFor="gastos_generales_estimados">Gastos Generales Estimados (€)</Label>
                    <Input id="gastos_generales_estimados" name="gastos_generales_estimados" type="number" step="0.01" value={formData.gastos_generales_estimados} onChange={handleChange} />
                </div>
            </div>

            {/* ─── Clasificación de rentabilidad ─────────────────────────────── */}
            <div className="p-4 rounded-xl border bg-muted/10 space-y-4">
                <div className="flex items-center gap-2 text-foreground">
                    <Tag className="w-4 h-4" />
                    <Label className="font-bold">Clasificación de la obra</Label>
                    {!isEditing && <span className="text-xs text-muted-foreground">(obligatoria para obras nuevas)</span>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <Label htmlFor="tipo_principal_trabajo">Tipo Principal de Trabajo {!isEditing && '*'}</Label>
                        <Select
                            value={formData.tipo_principal_trabajo}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, tipo_principal_trabajo: value }))}
                        >
                            <SelectTrigger id="tipo_principal_trabajo">
                                <SelectValue placeholder="Selecciona..." />
                            </SelectTrigger>
                            <SelectContent className="z-[9999]">
                                {TIPOS_PRINCIPALES_TRABAJO.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="oficio_dominante">Oficio Dominante {!isEditing && '*'}</Label>
                        <Select
                            value={formData.oficio_dominante}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, oficio_dominante: value }))}
                        >
                            <SelectTrigger id="oficio_dominante">
                                <SelectValue placeholder="Selecciona..." />
                            </SelectTrigger>
                            <SelectContent className="z-[9999]">
                                {OFICIOS_DOMINANTES.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="tamano_operativo">Tamaño Operativo {!isEditing && '*'}</Label>
                        <Select
                            value={formData.tamano_operativo}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, tamano_operativo: value }))}
                        >
                            <SelectTrigger id="tamano_operativo">
                                <SelectValue placeholder="Selecciona..." />
                            </SelectTrigger>
                            <SelectContent className="z-[9999]">
                                {TAMANOS_OPERATIVOS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div>
                    <Label htmlFor="estado_validez_analisis">Estado de Validez para Análisis</Label>
                    <Select
                        value={formData.estado_validez_analisis}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, estado_validez_analisis: value }))}
                    >
                        <SelectTrigger id="estado_validez_analisis" className="md:w-1/3">
                            <SelectValue placeholder="Selecciona..." />
                        </SelectTrigger>
                        <SelectContent className="z-[9999]">
                            {ESTADOS_VALIDEZ_ANALISIS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label className="mb-2 block">Oficios Secundarios</Label>
                    <MultiSelectToggle
                        options={OFICIOS_SECUNDARIOS}
                        value={formData.oficios_secundarios}
                        onChange={(vals) => setFormData(prev => ({ ...prev, oficios_secundarios: vals }))}
                    />
                </div>

                <div>
                    <Label className="mb-2 block">Etiquetas de Rentabilidad</Label>
                    <MultiSelectToggle
                        options={ETIQUETAS_RENTABILIDAD}
                        value={formData.etiquetas_rentabilidad}
                        onChange={(vals) => setFormData(prev => ({ ...prev, etiquetas_rentabilidad: vals }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Puede dejarse vacío y completarse al cerrar o analizar la obra.</p>
                </div>
            </div>

            {/* Obra Compartida Toggle */}
            <div
                className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.es_compartida
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'
                    : 'border-border bg-muted/20 hover:border-muted-foreground/30'
                    }`}
                onClick={() => setFormData(prev => ({ ...prev, es_compartida: !prev.es_compartida }))}
            >
                <div className={`p-2.5 rounded-lg ${formData.es_compartida
                    ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600'
                    : 'bg-muted text-muted-foreground'
                    }`}>
                    <Share2 className="w-5 h-5" />
                </div>
                <div className="flex-1">
                    <p className={`font-semibold text-sm ${formData.es_compartida ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'
                        }`}>
                        Obra Compartida
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Activa esta opción si esta obra se realiza conjuntamente con otra empresa
                    </p>
                </div>
                <div className={`w-11 h-6 rounded-full transition-colors relative ${formData.es_compartida ? 'bg-amber-500' : 'bg-muted-foreground/30'
                    }`}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${formData.es_compartida ? 'translate-x-[22px]' : 'translate-x-0.5'
                        }`} />
                </div>
            </div>

            {/* Modelo de Reparto (Solo si es compartida) */}
            {formData.es_compartida && (
                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/10 space-y-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <Calculator className="w-4 h-4" />
                        <Label className="font-bold">Modelo de Reparto de Beneficios</Label>
                    </div>

                    <Select
                        value={formData.tipo_reparto}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, tipo_reparto: value }))}
                    >
                        <SelectTrigger className="bg-white dark:bg-slate-950 border-amber-200 dark:border-amber-800">
                            <SelectValue placeholder="Selecciona el modelo" />
                        </SelectTrigger>
                        <SelectContent className="z-[9999]">
                            <SelectItem value="fijo">
                                <div className="flex flex-col gap-1">
                                    <span className="font-semibold text-foreground">Reparto Fijo (50/50)</span>
                                    <span className="text-[11px] text-muted-foreground">El margen se divide a partes iguales entre las empresas.</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="mixto">
                                <div className="flex flex-col gap-1">
                                    <span className="font-semibold text-foreground">Reparto Mixto (50/50 + Proporcional)</span>
                                    <span className="text-[11px] text-muted-foreground">50% fijo y 50% según el peso de los costes de cada empresa.</span>
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
                <Button type="submit" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {loading ? 'Guardando...' : 'Guardar Proyecto'}
                </Button>
            </div>
        </form>
    );
};

export default ProjectForm;
