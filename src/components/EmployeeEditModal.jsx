import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const EmployeeEditModal = ({ employee, isOpen, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        nombre: '',
        apellidos: '',
        email: '',
        telefono: '',
        telefono_empresa: '',
        costo_por_hora: '',
        fecha_incorporacion: ''
    });

    useEffect(() => {
        if (employee) {
            setFormData({
                nombre: employee.nombre || '',
                apellidos: employee.apellidos || '',
                email: employee.email || '',
                telefono: employee.telefono || '',
                telefono_empresa: employee.telefono_empresa || '',
                costo_por_hora: employee.costo_por_hora || '',
                fecha_incorporacion: employee.fecha_incorporacion || ''
            });
        }
    }, [employee, isOpen]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDateChange = (date) => {
        setFormData(prev => ({
            ...prev,
            fecha_incorporacion: date ? format(date, 'yyyy-MM-dd') : ''
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const updates = {
                nombre: formData.nombre,
                apellidos: formData.apellidos,
                email: formData.email,
                telefono: formData.telefono,
                telefono_empresa: formData.telefono_empresa,
                costo_por_hora: formData.costo_por_hora ? parseFloat(formData.costo_por_hora) : null,
                fecha_incorporacion: formData.fecha_incorporacion || null
            };

            const { error } = await supabase
                .from('empleados')
                .update(updates)
                .eq('id', employee.id);

            if (error) throw error;

            toast({ title: 'Empleado actualizado', description: 'Los datos se han guardado correctamente.' });
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error updating employee:', error);
            toast({ 
                variant: 'destructive', 
                title: 'Error', 
                description: error.message || 'No se pudo actualizar el empleado.' 
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !loading && onClose()}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Editar Datos del Empleado</DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="nombre">Nombre</Label>
                            <Input 
                                id="nombre" 
                                name="nombre" 
                                value={formData.nombre} 
                                onChange={handleInputChange} 
                                required 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="apellidos">Apellidos</Label>
                            <Input 
                                id="apellidos" 
                                name="apellidos" 
                                value={formData.apellidos} 
                                onChange={handleInputChange} 
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input 
                            id="email" 
                            name="email" 
                            type="email" 
                            value={formData.email} 
                            onChange={handleInputChange} 
                            required 
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="telefono">Teléfono Personal</Label>
                            <Input 
                                id="telefono" 
                                name="telefono" 
                                value={formData.telefono} 
                                onChange={handleInputChange} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="telefono_empresa">Teléfono Empresa</Label>
                            <Input 
                                id="telefono_empresa" 
                                name="telefono_empresa" 
                                value={formData.telefono_empresa} 
                                onChange={handleInputChange} 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="costo_por_hora">Coste Hora (€)</Label>
                            <Input 
                                id="costo_por_hora" 
                                name="costo_por_hora" 
                                type="number" 
                                step="0.01" 
                                value={formData.costo_por_hora} 
                                onChange={handleInputChange} 
                            />
                        </div>
                        <div className="space-y-2 flex flex-col">
                            <Label htmlFor="fecha_incorporacion" className="mb-2">Fecha de Alta (Antigüedad)</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !formData.fecha_incorporacion && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {formData.fecha_incorporacion ? (
                                            format(new Date(formData.fecha_incorporacion), "P", { locale: es })
                                        ) : (
                                            <span>Seleccionar fecha</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={formData.fecha_incorporacion ? new Date(formData.fecha_incorporacion) : undefined}
                                        onSelect={handleDateChange}
                                        initialFocus
                                        locale={es}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <DialogFooter className="mt-6">
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar Cambios
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default EmployeeEditModal;