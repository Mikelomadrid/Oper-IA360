import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Camera, X, ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

// --- Helpers de marca de agua ---

const formatWatermarkLabel = (date) => {
    const fecha = date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return `${fecha}  ${hora}`;
};

// Dibuja la imagen original en un canvas y estampa fecha/hora en la esquina inferior derecha.
// Devuelve un Blob JPEG listo para subir.
const addWatermarkToImage = (file, label) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('No se pudo procesar la imagen en este dispositivo.'));
                    return;
                }
                ctx.drawImage(img, 0, 0);

                // Tamaño de fuente proporcional a la imagen para que se lea bien en cualquier resolución
                const fontSize = Math.max(28, Math.round(canvas.width * 0.032));
                ctx.font = `bold ${fontSize}px sans-serif`;
                const paddingX = fontSize * 0.6;
                const paddingY = fontSize * 0.45;
                const margin = fontSize * 0.5;

                const textWidth = ctx.measureText(label).width;
                const boxWidth = textWidth + paddingX * 2;
                const boxHeight = fontSize + paddingY * 2;
                const boxX = canvas.width - boxWidth - margin;
                const boxY = canvas.height - boxHeight - margin;

                // Fondo semitransparente para legibilidad sobre cualquier foto
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

                ctx.fillStyle = '#ffffff';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, boxX + paddingX, boxY + boxHeight / 2);

                canvas.toBlob(
                    (blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('No se pudo generar la imagen con marca de agua.'));
                    },
                    'image/jpeg',
                    0.88
                );
            };
            img.onerror = () => reject(new Error('No se pudo cargar la imagen seleccionada.'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
        reader.readAsDataURL(file);
    });
};

// Recalcula vehiculos.km_actuales como el máximo de los registros existentes.
// Necesario tras editar o eliminar un registro, ya que la columna es un valor guardado, no calculado.
const recalcVehicleKmActuales = async (vehiculoId) => {
    const { data } = await supabase
        .from('vehiculo_km_registro')
        .select('km')
        .eq('vehiculo_id', vehiculoId)
        .order('km', { ascending: false })
        .limit(1)
        .maybeSingle();

    await supabase.from('vehiculos').update({ km_actuales: data?.km ?? 0 }).eq('id', vehiculoId);
};

export default function KilometrajeModal({ isOpen, onClose, vehicle, onSave, editingRecord = null }) {
    const isEditing = !!editingRecord;

    const [formData, setFormData] = useState({
        fecha: new Date().toISOString().split('T')[0],
        km: '',
        observacion: ''
    });
    const [loading, setLoading] = useState(false);

    // Foto nueva seleccionada por el usuario (pendiente de subir)
    const [fotoBlob, setFotoBlob] = useState(null);
    const [fotoPreviewUrl, setFotoPreviewUrl] = useState(null);
    // Foto ya existente en el registro (modo edición)
    const [existingFotoUrl, setExistingFotoUrl] = useState(null);
    const [processingFoto, setProcessingFoto] = useState(false);
    const fileInputRef = useRef(null);

    const displayFotoUrl = fotoPreviewUrl || existingFotoUrl;

    useEffect(() => {
        if (isOpen) {
            if (editingRecord) {
                setFormData({
                    fecha: editingRecord.fecha ? String(editingRecord.fecha).split('T')[0] : new Date().toISOString().split('T')[0],
                    km: String(editingRecord.km ?? ''),
                    observacion: editingRecord.observacion || ''
                });
                setExistingFotoUrl(editingRecord.foto_contador || null);
            } else {
                setFormData({
                    fecha: new Date().toISOString().split('T')[0],
                    km: '',
                    observacion: ''
                });
                setExistingFotoUrl(null);
            }
            setFotoBlob(null);
            setFotoPreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return null;
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, editingRecord]);

    // Limpieza del object URL al desmontar
    useEffect(() => {
        return () => {
            if (fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleFotoChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setProcessingFoto(true);
        try {
            const label = formatWatermarkLabel(new Date());
            const blob = await addWatermarkToImage(file, label);
            setFotoBlob(blob);
            setFotoPreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return URL.createObjectURL(blob);
            });
        } catch (err) {
            toast({ title: 'Error al procesar la foto', description: err.message, variant: 'destructive' });
        } finally {
            setProcessingFoto(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveFoto = () => {
        setFotoBlob(null);
        setFotoPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
        });
        setExistingFotoUrl(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.km) {
            toast({ title: "Error", description: "Debes ingresar los kilómetros.", variant: "destructive" });
            return;
        }

        if (!displayFotoUrl && !fotoBlob) {
            toast({ title: "Falta la foto del contador", description: "Debes adjuntar una foto del contador para registrar el kilometraje.", variant: "destructive" });
            return;
        }

        const newKm = parseInt(formData.km);
        const currentKm = vehicle?.km_actuales || 0;

        if (!isEditing && vehicle && newKm < currentKm) {
             toast({ title: "Error", description: `El kilometraje (${newKm}) no puede ser menor al actual (${currentKm}).`, variant: "destructive" });
             return;
        }

        setLoading(true);
        try {
            let fotoUrl = existingFotoUrl;

            if (fotoBlob) {
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
                const filePath = `${vehicle.id}/km/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('vehiculos')
                    .upload(filePath, fotoBlob, { contentType: 'image/jpeg' });

                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('vehiculos').getPublicUrl(filePath);
                fotoUrl = data.publicUrl;
            }

            if (isEditing) {
                const { error } = await supabase
                    .from('vehiculo_km_registro')
                    .update({
                        fecha: formData.fecha,
                        km: newKm,
                        observacion: formData.observacion,
                        foto_contador: fotoUrl
                    })
                    .eq('id', editingRecord.id);

                if (error) throw error;

                await recalcVehicleKmActuales(vehicle.id);
                toast({ title: "Registro actualizado correctamente" });
            } else {
                const { error } = await supabase.rpc('rpc_registrar_km_vehiculo', {
                    p_vehiculo_id: vehicle.id,
                    p_km: newKm,
                    p_observacion: formData.observacion,
                    p_fecha: formData.fecha,
                    p_foto_contador: fotoUrl
                });

                if (error) throw error;
                toast({ title: "Kilometraje registrado correctamente" });
            }

            if (onSave) onSave();
            onClose();
        } catch (error) {
            console.error(error);
            toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Editar Registro de Kilometraje' : 'Registrar Kilometraje'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Vehículo</Label>
                        <Input value={`${vehicle?.marca || ''} ${vehicle?.modelo || ''} - ${vehicle?.matricula || ''}`} disabled className="bg-muted" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Fecha</Label>
                            <Input 
                                type="date" 
                                value={formData.fecha} 
                                onChange={(e) => setFormData({...formData, fecha: e.target.value})} 
                                required 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Kilómetros</Label>
                            <Input 
                                type="number" 
                                value={formData.km} 
                                onChange={(e) => setFormData({...formData, km: e.target.value})} 
                                placeholder={`Actual: ${vehicle?.km_actuales || 0}`}
                                required 
                                min={isEditing ? undefined : (vehicle?.km_actuales || 0)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Observación (Opcional)</Label>
                        <Textarea 
                            value={formData.observacion} 
                            onChange={(e) => setFormData({...formData, observacion: e.target.value})} 
                            placeholder="Ej: Repostaje, viaje a obra, etc."
                            className="resize-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Foto del contador <span className="text-destructive">*</span></Label>
                        {displayFotoUrl ? (
                            <div className="relative w-full rounded-md overflow-hidden border">
                                <img src={displayFotoUrl} alt="Foto del contador con fecha" className="w-full h-48 object-cover" />
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    className="absolute top-2 right-2 h-7 w-7"
                                    onClick={handleRemoveFoto}
                                    disabled={loading}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <div className="relative">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={handleFotoChange}
                                    disabled={processingFoto || loading}
                                />
                                <Button type="button" variant="outline" className="w-full" disabled={processingFoto || loading}>
                                    {processingFoto ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando foto...</>
                                    ) : (
                                        <><Camera className="mr-2 h-4 w-4" /> Hacer / Subir foto del contador</>
                                    )}
                                </Button>
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" /> Obligatoria. Se marcará automáticamente con la fecha y hora actuales.
                        </p>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading || processingFoto || !displayFotoUrl}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isEditing ? 'Guardar cambios' : 'Guardar registro'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
