import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import { Plus, Trash2, Loader2, Download, FileSignature, Send, ExternalLink } from 'lucide-react';
import { fmtMadrid } from '@/lib/utils';

const emptyItem = () => ({ nombre: '', cantidad: 1 });

export default function EntregasEmpleado() {
    const { sessionRole } = useAuth();
    const creadaPorId = sessionRole?.empleadoId || null;

    const [empleados, setEmpleados] = useState([]);
    const [entregas, setEntregas] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form state
    const [empleadoId, setEmpleadoId] = useState('');
    const [items, setItems] = useState([emptyItem()]);
    const [notas, setNotas] = useState('');
    const [saving, setSaving] = useState(false);
    const [entregaToDelete, setEntregaToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [{ data: empData, error: empError }, { data: entData, error: entError }] = await Promise.all([
                supabase.from('empleados').select('id, nombre, apellidos, dni_nie').eq('activo', true).order('nombre'),
                supabase.from('entregas_empleado')
                    .select('*, empleado:empleados!empleado_id(nombre, apellidos, dni_nie)')
                    .order('created_at', { ascending: false }),
            ]);

            if (empError) throw empError;
            if (entError) throw entError;

            setEmpleados(empData || []);
            setEntregas(entData || []);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al cargar', description: error.message });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const updateItem = (idx, field, value) => {
        setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
    };

    const addItemRow = () => setItems(prev => [...prev, emptyItem()]);

    const removeItemRow = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

    const resetForm = () => {
        setEmpleadoId('');
        setItems([emptyItem()]);
        setNotas('');
    };

    const handleCrearEntrega = async () => {
        const itemsLimpios = items
            .map(it => ({ nombre: it.nombre.trim(), cantidad: Number(it.cantidad) || 1 }))
            .filter(it => it.nombre.length > 0);

        if (!empleadoId) {
            toast({ variant: 'destructive', title: 'Falta el empleado', description: 'Elige a quién se le entrega.' });
            return;
        }
        if (itemsLimpios.length === 0) {
            toast({ variant: 'destructive', title: 'Falta la lista', description: 'Añade al menos un elemento a entregar.' });
            return;
        }

        setSaving(true);
        try {
            const { data: entrega, error: insertError } = await supabase
                .from('entregas_empleado')
                .insert([{
                    empleado_id: empleadoId,
                    items: itemsLimpios,
                    notas: notas.trim() || null,
                    creada_por: creadaPorId,
                }])
                .select()
                .single();

            if (insertError) throw insertError;

            // Aviso al empleado — sin prefijo "MIKELO:" para que el popup no se lo filtre.
            const { error: notifError } = await supabase.from('notificaciones').insert([{
                empleado_id: empleadoId,
                tipo_objeto: 'entrega_empleado',
                tipo_entidad: 'entrega_empleado',
                entidad_id: entrega.id,
                titulo: 'Entrega pendiente de firma',
                mensaje: 'Tienes una entrega de material pendiente de firmar. Pulsa para revisarla y firmar.',
                link: `/inventario/mis-entregas/${entrega.id}`,
                estado: 'no_leida',
            }]);

            if (notifError) {
                console.error('Error creando notificación:', notifError);
                toast({ variant: 'destructive', title: 'Entrega creada, pero sin aviso', description: 'No se pudo notificar al empleado. Avísale tú directamente.' });
            } else {
                toast({ title: 'Entrega creada', description: 'Se ha avisado al empleado para que firme.' });
            }

            resetForm();
            fetchData();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al crear la entrega', description: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleAbrirPDF = async (entrega) => {
        if (!entrega.pdf_url) return;
        try {
            const { data, error } = await supabase.storage
                .from('entregas_empleado')
                .createSignedUrl(entrega.pdf_url, 3600);
            if (error) throw error;
            window.open(data.signedUrl, '_blank');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al abrir', description: error.message });
        }
    };

    const handleDescargarPDF = async (entrega) => {
        if (!entrega.pdf_url) return;
        try {
            const { data, error } = await supabase.storage
                .from('entregas_empleado')
                .createSignedUrl(entrega.pdf_url, 3600);
            if (error) throw error;

            const response = await fetch(data.signedUrl);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `Entrega_${entrega.empleado?.nombre || entrega.id.slice(0, 8)}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al descargar', description: error.message });
        }
    };

    const handleEliminarEntrega = async () => {
        if (!entregaToDelete) return;
        setDeleting(true);
        try {
            const ent = entregaToDelete;

            // Borrar los ficheros del bucket propio (firma + pdf)
            const pathsToRemove = [ent.firma_url, ent.pdf_url].filter(Boolean);
            if (pathsToRemove.length > 0) {
                await supabase.storage.from('entregas_empleado').remove(pathsToRemove);
            }

            // Borrar la copia en la carpeta de documentación del empleado, si existe
            const docPath = `${ent.empleado_id}/ENTREGAS/acta_entrega_${ent.id}.pdf`;
            await supabase.storage.from('empleado_documentos').remove([docPath]);
            await supabase.from('empleado_archivos').delete().eq('url', docPath);

            // Borrar la notificación asociada, si sigue existiendo
            await supabase.from('notificaciones').delete().eq('entidad_id', ent.id).eq('tipo_entidad', 'entrega_empleado');

            // Borrar la propia entrega
            const { error } = await supabase.from('entregas_empleado').delete().eq('id', ent.id);
            if (error) throw error;

            toast({ title: 'Entrega eliminada' });
            setEntregaToDelete(null);
            fetchData();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al eliminar', description: error.message });
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Formulario de nueva entrega */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <FileSignature className="w-5 h-5" /> Nueva entrega
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Empleado</Label>
                        <Select value={empleadoId} onValueChange={setEmpleadoId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un empleado..." />
                            </SelectTrigger>
                            <SelectContent>
                                {empleados.map(e => (
                                    <SelectItem key={e.id} value={e.id}>
                                        {e.nombre} {e.apellidos || ''} {e.dni_nie ? `(${e.dni_nie})` : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Qué se entrega</Label>
                        {items.map((item, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                                <Input
                                    placeholder="Ej: Chaleco reflectante talla L"
                                    value={item.nombre}
                                    onChange={e => updateItem(idx, 'nombre', e.target.value)}
                                    className="flex-1"
                                />
                                <Input
                                    type="number"
                                    min="1"
                                    value={item.cantidad}
                                    onChange={e => updateItem(idx, 'cantidad', e.target.value)}
                                    className="w-20"
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeItemRow(idx)}
                                    disabled={items.length === 1}
                                >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={addItemRow} className="gap-1">
                            <Plus className="w-3 h-3" /> Añadir elemento
                        </Button>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Notas (opcional)</Label>
                        <Textarea
                            placeholder="Cualquier detalle adicional..."
                            value={notas}
                            onChange={e => setNotas(e.target.value)}
                            rows={2}
                        />
                    </div>

                    <Button onClick={handleCrearEntrega} disabled={saving} className="gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Crear y avisar al empleado
                    </Button>
                </CardContent>
            </Card>

            {/* Listado de entregas */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Entregas</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                    ) : entregas.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">Todavía no hay entregas creadas.</p>
                    ) : (
                        <ScrollArea className="max-h-[500px]">
                            <div className="space-y-2">
                                {entregas.map(ent => (
                                    <div key={ent.id} className="flex items-center justify-between border rounded-lg p-3 gap-3">
                                        <div className="min-w-0">
                                            <p className="font-medium text-sm truncate">
                                                {ent.empleado?.nombre} {ent.empleado?.apellidos || ''}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {ent.items?.length || 0} elemento(s) · {fmtMadrid(ent.created_at, 'date')}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge variant={ent.estado === 'firmado' ? 'default' : 'secondary'}>
                                                {ent.estado === 'firmado' ? 'Firmado' : 'Pendiente de firma'}
                                            </Badge>
                                            {ent.estado === 'firmado' && ent.pdf_url && (
                                                <>
                                                    <Button variant="outline" size="icon" onClick={() => handleAbrirPDF(ent)} title="Abrir">
                                                        <ExternalLink className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="outline" size="icon" onClick={() => handleDescargarPDF(ent)} title="Descargar">
                                                        <Download className="w-4 h-4" />
                                                    </Button>
                                                </>
                                            )}
                                            <Button variant="outline" size="icon" onClick={() => setEntregaToDelete(ent)} title="Eliminar">
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={!!entregaToDelete} onOpenChange={(open) => !open && setEntregaToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar esta entrega?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se borrará la entrega de <strong>{entregaToDelete?.empleado?.nombre} {entregaToDelete?.empleado?.apellidos || ''}</strong>,
                            junto con el justificante en PDF y la copia guardada en su carpeta de documentación. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleEliminarEntrega} disabled={deleting} className="bg-destructive text-destructive-foreground">
                            {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
