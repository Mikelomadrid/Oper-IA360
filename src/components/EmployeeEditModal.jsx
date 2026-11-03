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
        nombre_completo: '',
        categoria: '',
        dni_nie: '',
        fecha_nacimiento: '',
        numero_seguridad_social: '',
        email: '',
        telefono: '',
        telefono_empresa: '',
        costo_por_hora: '',
        fecha_incorporacion: '',
        direccion: '',
        codigo_postal: '',
        ciudad: '',
        provincia: '',
        numero_cuenta: ''
    });

    useEffect(() => {
        if (employee) {
            setFormData({
                nombre: employee.nombre || '',
                apellidos: employee.apellidos || '',
                nombre_completo: employee.nombre_completo || '',
                categoria: employee.categoria || '',
                dni_nie: employee.dni_nie || '',
                fecha_nacimiento: employee.fecha_nacimiento || '',
                numero_seguridad_social: employee.numero_seguridad_social || '',
                email: employee.email || '',
                telefono: employee.telefono || '',
                telefono_empresa: employee.telefono_empresa || '',
                costo_por_hora: employee.costo_por_hora || '',
                fecha_incorporacion: employee.fecha_incorporacion || '',
                direccion: employee.direccion || '',
                codigo_postal: employee.codigo_postal || '',
                ciudad: employee.ciudad || '',
                provincia: employee.provincia || '',
                numero_cuenta: employee.numero_cuenta || ''
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

    const handleFechaNacimientoChange = (date) => {
        setFormData(prev => ({
            ...prev,
            fecha_nacimiento: date ? format(date, 'yyyy-MM-dd') : ''
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const updates = {
                nombre: formData.nombre,
                apellidos: formData.apellidos,
                nombre_completo: formData.nombre_completo || null,
                categoria: formData.categoria || null,
                dni_nie: formData.dni_nie || null,
                fecha_nacimiento: formData.fecha_nacimiento || null,
                numero_seguridad_social: formData.numero_seguridad_social || null,
                email: formData.email,
                telefono: formData.telefono,
                telefono_empresa: formData.telefono_empresa,
                costo_por_hora: formData.costo_por_hora ? parseFloat(formData.costo_por_hora) : null,
                fecha_incorporacion: formData.fecha_incorporacion || null,
                direccion: formData.direccion || null,
                codigo_postal: formData.codigo_postal || null,
                ciudad: formData.ciudad || null,
                provincia: formData.provincia || null,
                numero_cuenta: formData.numero_cuenta || null
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
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Editar Datos del Empleado</DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    {/* Datos personales */}
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

                    {/* Datos personales legales */}
                    <div className="pt-2">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-1 mb-3">
                            Datos Personales
                        </h3>
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <Label htmlFor="nombre_completo">Nombre completo (legal)</Label>
                                <Input
                                    id="nombre_completo"
                                    name="nombre_completo"
                                    value={formData.nombre_completo}
                                    onChange={handleInputChange}
                                    placeholder="Ej: Francisco Javier García López"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="categoria">Categoría</Label>
                                <Input
                                    id="categoria"
                                    name="categoria"
                                    value={formData.categoria}
                                    onChange={handleInputChange}
                                    placeholder="Ej: Oficial de 1ª, Técnico especialista"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="dni_nie">DNI / NIE</Label>
                                    <Input
                                        id="dni_nie"
                                        name="dni_nie"
                                        value={formData.dni_nie}
                                        onChange={(e) => setFormData(prev => ({ ...prev, dni_nie: e.target.value.toUpperCase() }))}
                                        placeholder="12345678A"
                                        maxLength={9}
                                        className="font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="numero_seguridad_social">Nº Seguridad Social</Label>
                                    <Input
                                        id="numero_seguridad_social"
                                        name="numero_seguridad_social"
                                        value={formData.numero_seguridad_social}
                                        onChange={handleInputChange}
                                        placeholder="28/12345678/90"
                                        className="font-mono"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2 flex flex-col">
                                <Label className="mb-2">Fecha de Nacimiento</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !formData.fecha_nacimiento && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {formData.fecha_nacimiento ? (
                                                format(new Date(formData.fecha_nacimiento), "P", { locale: es })
                                            ) : (
                                                <span>Seleccionar fecha</span>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={formData.fecha_nacimiento ? new Date(formData.fecha_nacimiento) : undefined}
                                            onSelect={handleFechaNacimientoChange}
                                            captionLayout="dropdown-buttons"
                                            fromYear={1950}
                                            toYear={new Date().getFullYear()}
                                            initialFocus
                                            locale={es}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
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

                    {/* Dirección */}
                    <div className="pt-2">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-1 mb-3">
                            Dirección
                        </h3>
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <Label htmlFor="direccion">Calle y número</Label>
                                <Input 
                                    id="direccion" 
                                    name="direccion" 
                                    value={formData.direccion} 
                                    onChange={handleInputChange}
                                    placeholder="Ej: Calle Mayor 12, 3º B"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="codigo_postal">C.P.</Label>
                                    <Input 
                                        id="codigo_postal" 
                                        name="codigo_postal" 
                                        value={formData.codigo_postal} 
                                        onChange={handleInputChange}
                                        placeholder="28001"
                                        maxLength={5}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ciudad">Ciudad</Label>
                                    <Input 
                                        id="ciudad" 
                                        name="ciudad" 
                                        value={formData.ciudad} 
                                        onChange={handleInputChange}
                                        placeholder="Madrid"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="provincia">Provincia</Label>
                                    <Input 
                                        id="provincia" 
                                        name="provincia" 
                                        value={formData.provincia} 
                                        onChange={handleInputChange}
                                        placeholder="Madrid"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Datos bancarios */}
                    <div className="pt-2">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-1 mb-3">
                            Datos Bancarios
                        </h3>
                        <div className="space-y-2">
                            <Label htmlFor="numero_cuenta">Número de Cuenta (IBAN)</Label>
                            <Input 
                                id="numero_cuenta" 
                                name="numero_cuenta" 
                                value={formData.numero_cuenta} 
                                onChange={(e) => setFormData(prev => ({ ...prev, numero_cuenta: e.target.value.toUpperCase() }))}
                                placeholder="ES00 0000 0000 0000 0000 0000"
                                maxLength={34}
                                className="font-mono"
                            />
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
