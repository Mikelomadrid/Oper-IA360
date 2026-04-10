import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Calendar as CalendarIcon, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

export default function OvertimeCrudModal({ isOpen, onClose, onSave, initialData = null, employeesMap = {}, projects = [] }) {
    const isEdit = !!initialData;
    const [isLoading, setLoading] = useState(false);
    
    // Form State
    const [formData, setFormData] = useState({
        empleado_id: '',
        dia: new Date(),
        horas_trabajadas: '',
        proyecto_id: 'no_project',
        nota: ''
    });

    // Reset or Load Data
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Edit Mode
                setFormData({
                    empleado_id: initialData.empleado_id,
                    dia: initialData.dia ? new Date(initialData.dia) : new Date(),
                    horas_trabajadas: initialData.horas_total || initialData.horas_trabajadas || 0, // Prefer total or raw worked
                    proyecto_id: initialData.proyecto_id || 'no_project',
                    nota: '' // Note is usually separate, fetch if needed or keep empty for new note
                });
                
                // Fetch existing note if editing (optional, good UX)
                if (initialData.empleado_id && initialData.dia) {
                    supabase.from('horas_extras_notas')
                        .select('nota')
                        .eq('empleado_id', initialData.empleado_id)
                        .eq('dia', initialData.dia)
                        .single()
                        .then(({ data }) => {
                            if (data) setFormData(prev => ({ ...prev, nota: data.nota }));
                        });
                }
            } else {
                // Create Mode
                setFormData({
                    empleado_id: '',
                    dia: new Date(),
                    horas_trabajadas: '',
                    proyecto_id: 'no_project',
                    nota: ''
                });
            }
        }
    }, [isOpen, initialData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Validation
            if (!formData.empleado_id) throw new Error("Debes seleccionar un empleado.");
            if (!formData.dia) throw new Error("Debes seleccionar una fecha.");
            if (!formData.horas_trabajadas || isNaN(formData.horas_trabajadas) || Number(formData.horas_trabajadas) < 0) {
                throw new Error("Las horas trabajadas deben ser un número positivo.");
            }

            const hoursVal = Number(formData.horas_trabajadas);
            const dateStr = format(formData.dia, 'yyyy-MM-dd');
            const projectId = formData.proyecto_id === 'no_project' ? null : formData.proyecto_id;

            // 1. Calculate overtime logic (Client-side mirror of DB logic for immediate feedback/validation, 
            // but effectively we let the DB trigger 'fn_recalc_extras_dia' handle the split if we insert into control_horario_extras directly,
            // OR we insert/update directly if that's the pattern. 
            // The prompt implies saving to 'control_horario_extras'.)
            
            // However, inserting directly into 'control_horario_extras' might bypass the daily calculation from fichajes.
            // Assuming this is a manual override or manual entry.
            
            // Check for duplicates if creating
            if (!isEdit) {
                const { data: dup } = await supabase
                    .from('control_horario_extras')
                    .select('dia')
                    .eq('empleado_id', formData.empleado_id)
                    .eq('dia', dateStr)
                    .single();
                
                if (dup) {
                    throw new Error("Ya existe un registro de horas extras para este empleado y día. Edítalo en su lugar.");
                }
            }

            // Determine if weekend/holiday for calculation (Basic JS logic to prep fields if needed, 
            // though the DB trigger usually handles this if we call the recalculation function. 
            // Let's insert raw 'horas_trabajadas' and let the DB trigger handle the split if it exists, 
            // OR manually calculate if we are bypassing triggers. 
            // Best practice: The Trigger `fn_recalc_extras_dia` recalculates based on `control_horario` (fichajes).
            // Direct edits to `control_horario_extras` are allowed but might be overwritten by fichajes recalculation.
            // If we want this to PERSIST, we should probably ensure it respects the manual entry.
            
            // Strategy: Upsert into `control_horario_extras`.
            // We need to calculate `es_festivo`, `es_fin_semana`, etc. locally to ensure the row is valid immediately.
            
            const dow = formData.dia.getDay(); // 0 Sun, 6 Sat
            const isWeekend = dow === 0 || dow === 6;
            
            // Check holiday
            const { data: holiday } = await supabase.from('calendario_festivos').select('id').eq('fecha', dateStr).single();
            const isFestivo = !!holiday;

            let normal = 0;
            let extra = 0;
            let festivo = 0;
            let target = 0;

            if (isWeekend || isFestivo) {
                // All hours are festivo/special
                festivo = hoursVal; // Or extra, depending on how view interprets it. Usually stored in horas_extra_dia or horas_festivo_dia
                // Based on view `v_control_horas_extra_ui...` usually maps `horas_festivo` from `horas_festivo_dia`
                target = 0;
            } else {
                // Laborable
                // Standard day: Fri=6h, else 8.5h
                target = (dow === 5) ? 6.0 : 8.5;
                if (hoursVal > target) {
                    normal = target;
                    extra = hoursVal - target;
                } else {
                    normal = hoursVal;
                }
            }

            // Upsert Data
            const payload = {
                empleado_id: formData.empleado_id,
                dia: dateStr,
                horas_trabajadas: hoursVal,
                proyecto_id: projectId,
                es_fin_semana: isWeekend,
                es_festivo: isFestivo,
                horas_objetivo_dia: target,
                horas_normales_dia: normal,
                horas_extra_dia: extra,
                horas_festivo_dia: festivo, // Putting weekend/holiday hours here explicitly
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('control_horario_extras')
                .upsert(payload, { onConflict: 'empleado_id,dia' });

            if (error) throw error;

            // Handle Note
            if (formData.nota && formData.nota.trim() !== '') {
                const { error: noteError } = await supabase
                    .from('horas_extras_notas')
                    .upsert({
                        empleado_id: formData.empleado_id,
                        dia: dateStr,
                        nota: formData.nota,
                        proyecto_id: projectId,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'empleado_id,dia' });
                
                if (noteError) console.error("Error saving note:", noteError);
            }

            toast({
                title: isEdit ? "Registro actualizado" : "Registro creado",
                description: `Se han guardado correctamente las horas para el ${format(formData.dia, 'dd/MM/yyyy')}.`,
            });

            if (onSave) onSave();
            onClose();

        } catch (err) {
            console.error("Error saving overtime:", err);
            toast({
                variant: "destructive",
                title: "Error al guardar",
                description: err.message || "Ha ocurrido un error inesperado."
            });
        } finally {
            setLoading(false);
        }
    };

    const employeeOptions = Object.entries(employeesMap).map(([id, emp]) => ({
        id,
        name: emp.name || 'Sin Nombre'
    })).sort((a, b) => a.name.localeCompare(b.name));

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? 'Editar Registro de Horas' : 'Nuevo Registro de Horas'}</DialogTitle>
                    <DialogDescription>
                        {isEdit ? 'Modifica los detalles del registro existente.' : 'Añade horas extras o festivas manualmente.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    {/* Employee Select */}
                    <div className="space-y-2">
                        <Label htmlFor="empleado">Empleado</Label>
                        <Select 
                            value={formData.empleado_id} 
                            onValueChange={(val) => setFormData(prev => ({ ...prev, empleado_id: val }))}
                            disabled={isEdit || isLoading}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar empleado..." />
                            </SelectTrigger>
                            <SelectContent>
                                {employeeOptions.map(emp => (
                                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Date Picker */}
                    <div className="space-y-2">
                        <Label>Fecha</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !formData.dia && "text-muted-foreground"
                                    )}
                                    disabled={isEdit || isLoading}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {formData.dia ? format(formData.dia, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={formData.dia}
                                    onSelect={(d) => d && setFormData(prev => ({ ...prev, dia: d }))}
                                    initialFocus
                                    locale={es}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Project Select */}
                    <div className="space-y-2">
                        <Label htmlFor="proyecto">Proyecto / Obra (Opcional)</Label>
                        <Select 
                            value={formData.proyecto_id} 
                            onValueChange={(val) => setFormData(prev => ({ ...prev, proyecto_id: val }))}
                            disabled={isLoading}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar proyecto..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="no_project">-- Sin Proyecto (Taller/General) --</SelectItem>
                                {projects.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.nombre_proyecto}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Hours Input */}
                    <div className="space-y-2">
                        <Label htmlFor="hours">Horas Trabajadas (Total del día)</Label>
                        <div className="relative">
                            <Input
                                id="hours"
                                type="number"
                                step="0.1"
                                min="0"
                                placeholder="Ej: 9.5"
                                value={formData.horas_trabajadas}
                                onChange={(e) => setFormData(prev => ({ ...prev, horas_trabajadas: e.target.value }))}
                                disabled={isLoading}
                                className="pl-10"
                            />
                            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                <span className="text-gray-500 font-bold">h</span>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Introduce el total de horas. El sistema calculará las extras automáticamente según el día (Laborable/Festivo).
                        </p>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label htmlFor="nota">Observaciones / Detalles</Label>
                        <Textarea 
                            id="nota" 
                            placeholder="Motivo de las horas extras..." 
                            value={formData.nota}
                            onChange={(e) => setFormData(prev => ({ ...prev, nota: e.target.value }))}
                            disabled={isLoading}
                            className="resize-none h-20"
                        />
                    </div>
                </form>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isEdit ? 'Guardar Cambios' : 'Crear Registro'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}