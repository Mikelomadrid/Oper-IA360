import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Calendar as CalendarIcon, Calculator, Edit, Plus, Scan, Camera, X, RotateCcw, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { ProviderSelect } from '@/components/ProviderSelect';
import { format } from 'date-fns';
import { analyzeInvoice } from '@/lib/openaiService';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount || 0);

// Genera un id local único para cada línea del formulario (no se guarda en BD, solo para React keys)
const genUid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const emptyItem = () => ({
  uid: genUid(),
  material_id: 'custom',
  descripcion: '',
  cantidad: 1,
  precio_unidad: 0,
  iva: 0.21,
});

const MaterialExpenseModal = ({ isOpen, onClose, onSuccess, projectId, expenseToEdit = null }) => {
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanPreview, setScanPreview] = useState(null);
  const scanInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    proveedor_id: '',
    providerName: '',
    numero_factura: '',
    fecha_emision: format(new Date(), 'yyyy-MM-dd'),
    observaciones: '',
    es_abono: false, // factura de abono / devolución -> el importe se resta del total
    items: [emptyItem()],
  });

  // Load available materials for quick selection
  useEffect(() => {
    if (isOpen) {
      const fetchMaterials = async () => {
        const { data } = await supabase
          .from('materiales')
          .select('id, nombre, precio_coste, proveedor_id, unidad_medida')
          .order('nombre');
        setMaterials(data || []);
      };
      fetchMaterials();
    }
  }, [isOpen]);

  // Load expense data when editing
  useEffect(() => {
    if (isOpen && expenseToEdit) {
      const loadExpenseDetails = async () => {
        setFetchingDetails(true);
        try {
          let initialData = {
            proveedor_id: expenseToEdit.proveedor_id || '',
            providerName: expenseToEdit.proveedor?.nombre || '',
            numero_factura: expenseToEdit.numero_factura || '',
            fecha_emision: expenseToEdit.fecha_emision || format(new Date(), 'yyyy-MM-dd'),
            observaciones: '',
            es_abono: false,
            items: [],
          };

          // Traer TODAS las líneas del gasto (antes solo se traía una con .limit(1))
          const { data: lines, error } = await supabase
            .from('partidas_gasto')
            .select('*')
            .eq('gasto_id', expenseToEdit.id)
            .order('fecha_creacion', { ascending: true });

          if (!error && lines && lines.length > 0) {
            // El signo del abono se guarda en precio_unidad de cada línea (puede venir negativo).
            const esAbono = lines.some((l) => (l.precio_unidad || 0) < 0);
            initialData.es_abono = esAbono;
            initialData.items = lines.map((l) => ({
              uid: genUid(),
              material_id: 'custom',
              descripcion: l.descripcion_linea || '',
              cantidad: l.cantidad || 1,
              precio_unidad: Math.abs(l.precio_unidad || 0),
              iva: l.iva ?? (expenseToEdit.iva || 0.21),
            }));
          } else {
            // Factura antigua sin líneas detalladas: se reconstruye un único artículo con los datos de cabecera
            const montoRaw = expenseToEdit.monto_neto || 0;
            initialData.es_abono = montoRaw < 0;
            initialData.items = [
              {
                uid: genUid(),
                material_id: 'custom',
                descripcion: expenseToEdit.concepto || '',
                cantidad: 1,
                precio_unidad: Math.abs(montoRaw),
                iva: expenseToEdit.iva || 0.21,
              },
            ];
          }

          setFormData(initialData);
        } catch (err) {
          console.error('Error loading details', err);
          toast({ title: 'Error cargando detalles', variant: 'destructive' });
        } finally {
          setFetchingDetails(false);
        }
      };
      loadExpenseDetails();
    } else if (isOpen && !expenseToEdit) {
      // Reset for create mode
      setFormData({
        proveedor_id: '',
        providerName: '',
        numero_factura: '',
        fecha_emision: format(new Date(), 'yyyy-MM-dd'),
        observaciones: '',
        es_abono: false,
        items: [emptyItem()],
      });
    }
  }, [isOpen, expenseToEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleAbono = (checked) => {
    setFormData((prev) => ({ ...prev, es_abono: checked }));
  };

  // --- Gestión de artículos ---
  const addItem = () => {
    setFormData((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }));
  };

  const removeItem = (uid) => {
    setFormData((prev) => ({ ...prev, items: prev.items.filter((it) => it.uid !== uid) }));
  };

  const updateItem = (uid, field, value) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.uid === uid ? { ...it, [field]: value } : it)),
    }));
  };

  const handleItemMaterialChange = (uid, materialId) => {
    setFormData((prev) => {
      const selectedMat = materialId !== 'custom' ? materials.find((m) => m.id === materialId) : null;
      const items = prev.items.map((it) => {
        if (it.uid !== uid) return it;
        if (!selectedMat) return { ...it, material_id: 'custom' };
        return {
          ...it,
          material_id: materialId,
          descripcion: selectedMat.nombre,
          precio_unidad: selectedMat.precio_coste || 0,
        };
      });
      return {
        ...prev,
        items,
        // Solo autocompleta el proveedor de cabecera si aún no hay uno elegido
        proveedor_id: !prev.proveedor_id && selectedMat?.proveedor_id ? selectedMat.proveedor_id : prev.proveedor_id,
      };
    });
  };

  // --- Cálculos ---
  // Cantidad y precio se introducen siempre en positivo; "es_abono" aplica el signo global.
  const itemCalcs = formData.items.map((it) => {
    const cant = parseFloat(it.cantidad || 0);
    const precio = parseFloat(it.precio_unidad || 0);
    const ivaRate = parseFloat(it.iva || 0);
    const sub = cant * precio;
    const ivaAmt = sub * ivaRate;
    return { ...it, cant, precio, ivaRate, sub, ivaAmt };
  });

  const signo = formData.es_abono ? -1 : 1;
  const subtotalSum = itemCalcs.reduce((acc, it) => acc + it.sub, 0);
  const ivaSum = itemCalcs.reduce((acc, it) => acc + it.ivaAmt, 0);

  const subtotal = signo * subtotalSum;
  const importeIva = signo * ivaSum;
  const total = subtotal + importeIva;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.proveedor_id) {
      toast({ variant: 'destructive', title: 'Falta Proveedor', description: 'Por favor selecciona un proveedor.' });
      return;
    }
    if (!formData.numero_factura) {
      toast({ variant: 'destructive', title: 'Falta Nº Factura', description: 'El número de factura es obligatorio.' });
      return;
    }
    if (formData.items.length === 0) {
      toast({ variant: 'destructive', title: 'Faltan artículos', description: 'Añade al menos un artículo.' });
      return;
    }
    const itemSinDescripcion = formData.items.find((it) => !it.descripcion?.trim());
    if (itemSinDescripcion) {
      toast({ variant: 'destructive', title: 'Falta descripción', description: 'Todos los artículos necesitan una descripción.' });
      return;
    }
    if (total === 0) {
      toast({ variant: 'destructive', title: 'Importe inválido', description: 'El importe no puede ser 0.' });
      return;
    }

    setLoading(true);
    try {
      // Tasa de IVA "efectiva" para la factura (media ponderada por base de cada artículo).
      // Se guarda en gastos.iva solo a efectos informativos/listados; el importe real con IVA
      // se manda ya calculado en total_con_iva para que no dependa de una única tasa.
      const ivaEfectivo = subtotalSum !== 0 ? ivaSum / subtotalSum : (formData.items[0]?.iva || 0.21);

      const gastoPayload = {
        proyecto_id: projectId,
        proveedor_id: formData.proveedor_id,
        numero_factura: formData.numero_factura,
        fecha_emision: formData.fecha_emision,
        concepto: formData.items.map((it) => it.descripcion).filter(Boolean).join(', ') || 'Material de Obra',
        monto_bruto: subtotal,
        iva: ivaEfectivo,
        estado_pago: 'pendiente_pago',
        gasto_nave_taller: false,
      };

      let savedGastoId;

      if (expenseToEdit) {
        // --- UPDATE ---
        const { error: updateError } = await supabase.from('gastos').update(gastoPayload).eq('id', expenseToEdit.id);
        if (updateError) throw updateError;
        savedGastoId = expenseToEdit.id;

        // Se borran las líneas anteriores y se recrean con los artículos actuales
        await supabase.from('partidas_gasto').delete().eq('gasto_id', savedGastoId);
      } else {
        // --- CREATE ---
        const { data: gastoData, error: gastoError } = await supabase
          .from('gastos')
          .insert([{ ...gastoPayload, fecha_creacion: new Date().toISOString() }])
          .select()
          .single();

        if (gastoError) throw gastoError;
        savedGastoId = gastoData.id;
      }

      if (savedGastoId) {
        const partidasPayload = itemCalcs.map((it) => ({
          gasto_id: savedGastoId,
          proyecto_id: projectId,
          descripcion_linea: it.descripcion,
          cantidad: it.cant,
          // El signo del abono se guarda aquí para poder reconstruirlo al editar
          precio_unidad: signo * it.precio,
          iva: it.ivaRate,
          fecha_creacion: new Date().toISOString(),
        }));

        const { error: partidaError } = await supabase.from('partidas_gasto').insert(partidasPayload);
        if (partidaError) {
          console.warn('Could not save detail lines', partidaError);
        }
      }

      toast({
        title: expenseToEdit
          ? (formData.es_abono ? 'Abono Actualizado' : 'Factura Actualizada')
          : (formData.es_abono ? 'Abono Guardado' : 'Factura Guardada'),
        description: `Se ha ${expenseToEdit ? 'actualizado' : 'registrado'} ${formData.es_abono ? 'el abono' : 'la factura'} correctamente.`,
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving material expense:', error);
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: error.message || 'Ocurrió un error inesperado.',
      });
    } finally {
      setLoading(false);
    }
  };

  const isEdit = !!expenseToEdit;

  const handleScanFile = async (file) => {
    if (!file) return;
    setScanPreview(URL.createObjectURL(file));
    setIsScanning(true);
    try {
      const result = await analyzeInvoice(file);

      if (result.proveedor_nombre) {
        const { data: provs } = await supabase
          .from('proveedores')
          .select('id, nombre')
          .ilike('nombre', `%${result.proveedor_nombre}%`)
          .limit(1);
        if (provs?.[0]) {
          setFormData((prev) => ({ ...prev, proveedor_id: provs[0].id, providerName: provs[0].nombre }));
        }
      }

      const ivaDetectado = result.iva_porcentaje ? result.iva_porcentaje / 100 : 0.21;

      setFormData((prev) => {
        const newItems =
          result.lineas && result.lineas.length > 0
            ? result.lineas.map((l) => ({
                uid: genUid(),
                material_id: 'custom',
                descripcion: l.descripcion || l.concepto || '',
                cantidad: l.cantidad || 1,
                precio_unidad: l.precio_unitario || 0,
                iva: ivaDetectado,
              }))
            : prev.items;

        return {
          ...prev,
          numero_factura: result.numero_factura || prev.numero_factura,
          fecha_emision: result.fecha || prev.fecha_emision,
          items: newItems,
        };
      });

      const nLineas = result.lineas?.length || 0;
      toast({
        title: 'Factura analizada',
        description:
          nLineas > 0
            ? `Se detectaron ${nLineas} producto(s). Revisa y completa los datos.`
            : 'Datos de cabecera extraídos. Revisa y completa.',
      });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error al analizar', description: err.message });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {isEdit ? <Edit className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
              {isEdit ? (formData.es_abono ? 'Editar Abono' : 'Editar Factura') : 'Nueva Factura de Material'}
            </DialogTitle>
            {!isEdit && (
              <div className="flex gap-2 mr-6">
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs"
                  onClick={() => scanInputRef.current?.click()} disabled={isScanning}>
                  {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  <span className="ml-1 hidden sm:inline">Foto</span>
                </Button>
                <input ref={scanInputRef} type="file" accept="image/*" capture="environment"
                  className="hidden" onChange={e => e.target.files?.[0] && handleScanFile(e.target.files[0])} />
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs"
                  onClick={() => fileInputRef.current?.click()} disabled={isScanning}>
                  <Scan className="w-3.5 h-3.5" />
                  <span className="ml-1 hidden sm:inline">Escanear</span>
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*,application/pdf"
                  className="hidden" onChange={e => e.target.files?.[0] && handleScanFile(e.target.files[0])} />
              </div>
            )}
          </div>
          {scanPreview && (
            <div className="relative mt-2 rounded-lg overflow-hidden bg-muted max-h-24 flex items-center justify-center">
              <img src={scanPreview} alt="Factura" className="max-h-24 object-contain" />
              {isScanning && (
                <div className="absolute inset-0 bg-background/70 flex items-center justify-center gap-2 text-sm font-medium">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  Analizando con Claude...
                </div>
              )}
              <button type="button" onClick={() => setScanPreview(null)}
                className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </DialogHeader>

        {fetchingDetails ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-6 py-4">

            {/* Header Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="proveedor">Proveedor *</Label>
                <ProviderSelect
                  value={formData.proveedor_id}
                  onValueChange={(val) => handleSelectChange('proveedor_id', val)}
                  placeholder="Buscar proveedor..."
                  initialLabel={formData.providerName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha_emision">Fecha Factura</Label>
                <div className="relative">
                  <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fecha_emision" name="fecha_emision" type="date"
                    value={formData.fecha_emision} onChange={handleChange}
                    className="pl-9" required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="numero_factura">Nº Factura / Referencia *</Label>
              <Input
                id="numero_factura" name="numero_factura"
                value={formData.numero_factura} onChange={handleChange}
                placeholder="Ej: F-2024-001" required
              />
            </div>

            {/* Artículos */}
            <div className={`p-4 rounded-lg border transition-colors ${formData.es_abono ? 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-900/50' : 'bg-muted/30 border-border/60'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Calculator className="w-4 h-4" /> Artículos
                </div>
                <label htmlFor="es_abono" className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox" id="es_abono" checked={formData.es_abono}
                    onChange={(e) => toggleAbono(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-red-600 cursor-pointer"
                  />
                  <span className={`text-xs font-medium flex items-center gap-1 ${formData.es_abono ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                    <RotateCcw className="w-3.5 h-3.5" />
                    Es un abono / devolución
                  </span>
                </label>
              </div>

              <div className="space-y-3">
                {formData.items.map((item, idx) => (
                  <div key={item.uid} className="border rounded-lg p-3 bg-background/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Artículo {idx + 1}</span>
                      {formData.items.length > 1 && (
                        <button type="button" onClick={() => removeItem(item.uid)}
                          className="text-muted-foreground hover:text-red-600 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Material (Opcional)</Label>
                        <Select value={item.material_id} onValueChange={(val) => handleItemMaterialChange(item.uid, val)}>
                          <SelectTrigger className="bg-background"><SelectValue placeholder="Catálogo..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="custom">-- Introducir Manualmente --</SelectItem>
                            {materials.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.nombre} {m.precio_coste ? `(${m.precio_coste}€)` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Descripción *</Label>
                        <Input
                          value={item.descripcion}
                          onChange={(e) => updateItem(item.uid, 'descripcion', e.target.value)}
                          placeholder="Ej: 50 sacos de cemento cola"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">Cantidad</Label>
                        <Input
                          type="number" step="0.01" min="0"
                          value={item.cantidad}
                          onChange={(e) => updateItem(item.uid, 'cantidad', e.target.value)}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Precio Unit. (€)</Label>
                        <Input
                          type="number" step="0.01"
                          value={item.precio_unidad}
                          onChange={(e) => updateItem(item.uid, 'precio_unidad', e.target.value)}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">IVA</Label>
                        <Select
                          value={String(Math.round((item.iva || 0) * 100))}
                          onValueChange={(val) => updateItem(item.uid, 'iva', parseFloat(val) / 100)}
                        >
                          <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="21">21%</SelectItem>
                            <SelectItem value="10">10%</SelectItem>
                            <SelectItem value="4">4%</SelectItem>
                            <SelectItem value="0">0%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="text-right pb-2">
                        <span className="text-muted-foreground block text-[11px]">Subtotal línea</span>
                        <span className="font-medium text-sm">{formatCurrency(itemCalcs[idx]?.sub || 0)}</span>
                      </div>
                    </div>
                  </div>
                ))}

                <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full border-dashed">
                  <Plus className="w-4 h-4 mr-2" /> Añadir artículo
                </Button>
              </div>

              {formData.es_abono && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-3">
                  Introduce cantidades y precios en positivo — el importe total se restará automáticamente del total de la obra.
                </p>
              )}

              <div className="mt-4 pt-3 border-t flex justify-end items-end gap-6 text-sm">
                <div className="text-right">
                  <span className="text-muted-foreground block text-xs">Base</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground block text-xs">IVA</span>
                  <span className="font-medium">{formatCurrency(importeIva)}</span>
                </div>
                <div className="text-right">
                  <span className={`block text-xs font-bold ${formData.es_abono ? 'text-red-600 dark:text-red-400' : 'text-primary'}`}>Total</span>
                  <span className={`font-bold text-lg ${formData.es_abono ? 'text-red-600 dark:text-red-400' : 'text-primary'}`}>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-2">
              <Button variant="outline" type="button" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button type="submit" disabled={loading} className={formData.es_abono ? "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-md" : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"}>
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
                ) : (
                  isEdit ? (formData.es_abono ? 'Actualizar Abono' : 'Actualizar Factura') : (formData.es_abono ? 'Guardar Abono' : 'Guardar Factura')
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MaterialExpenseModal;