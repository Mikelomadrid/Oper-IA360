import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Calendar as CalendarIcon, Calculator, Box, Edit, Plus, Scan, Camera, X } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { ProviderSelect } from '@/components/ProviderSelect';
import { format } from 'date-fns';
import { analyzeInvoice } from '@/lib/openaiService';

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
    material_id: 'custom', 
    descripcion: '',
    cantidad: 1,
    precio_unidad: 0,
    iva: 0.21,
    numero_factura: '',
    fecha_emision: format(new Date(), 'yyyy-MM-dd'),
    observaciones: '',
    providerName: '' // For pre-filling provider select label
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
                // Initialize with basic data
                let initialData = {
                    proveedor_id: expenseToEdit.proveedor_id || '',
                    providerName: expenseToEdit.proveedor?.nombre || '',
                    numero_factura: expenseToEdit.numero_factura || '',
                    fecha_emision: expenseToEdit.fecha_emision || format(new Date(), 'yyyy-MM-dd'),
                    descripcion: expenseToEdit.concepto || '',
                    iva: expenseToEdit.iva || 0.21,
                    // Defaults that will be overwritten if lines exist
                    cantidad: 1,
                    precio_unidad: expenseToEdit.monto_neto || 0, // Fallback to total base
                    material_id: 'custom',
                    observaciones: ''
                };

                // Fetch linked line items (partidas_gasto) to get detail qty/price
                const { data: lines, error } = await supabase
                    .from('partidas_gasto')
                    .select('*')
                    .eq('gasto_id', expenseToEdit.id)
                    .limit(1); // Assuming 1-to-1 mapping for simple material invoices in this UI

                if (!error && lines && lines.length > 0) {
                    const line = lines[0];
                    initialData.cantidad = line.cantidad || 1;
                    initialData.precio_unidad = line.precio_unidad || 0;
                    initialData.descripcion = line.descripcion_linea || initialData.descripcion;
                } else {
                    initialData.precio_unidad = expenseToEdit.monto_neto || 0;
                }

                setFormData(initialData);
            } catch (err) {
                console.error("Error loading details", err);
                toast({ title: "Error cargando detalles", variant: "destructive" });
            } finally {
                setFetchingDetails(false);
            }
        };
        loadExpenseDetails();
    } else if (isOpen && !expenseToEdit) {
        // Reset for create mode
        setFormData({
            proveedor_id: '',
            material_id: 'custom',
            descripcion: '',
            cantidad: 1,
            precio_unidad: 0,
            iva: 0.21,
            numero_factura: '',
            fecha_emision: format(new Date(), 'yyyy-MM-dd'),
            observaciones: '',
            providerName: ''
        });
    }
  }, [isOpen, expenseToEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => {
        const newData = { ...prev, [name]: value };
        
        // Auto-fill details if a material is selected
        if (name === 'material_id' && value !== 'custom') {
            const selectedMat = materials.find(m => m.id === value);
            if (selectedMat) {
                newData.descripcion = selectedMat.nombre;
                newData.precio_unidad = selectedMat.precio_coste || 0;
                if (selectedMat.proveedor_id) {
                    newData.proveedor_id = selectedMat.proveedor_id;
                }
            }
        }
        return newData;
    });
  };

  // Calculations
  const subtotal = parseFloat(formData.cantidad || 0) * parseFloat(formData.precio_unidad || 0);
  const importeIva = subtotal * parseFloat(formData.iva || 0);
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
    if (total <= 0) {
        toast({ variant: 'destructive', title: 'Importe inválido', description: 'El importe total debe ser mayor a 0.' });
        return;
    }

    setLoading(true);
    try {
      const gastoPayload = {
        proyecto_id: projectId,
        proveedor_id: formData.proveedor_id,
        numero_factura: formData.numero_factura,
        fecha_emision: formData.fecha_emision,
        concepto: formData.descripcion || 'Material de Obra',
        monto_bruto: subtotal, // Acts as Base
        iva: formData.iva,
        estado_pago: 'pendiente_pago',
        gasto_nave_taller: false
      };

      let savedGastoId;

      if (expenseToEdit) {
          // --- UPDATE ---
          const { error: updateError } = await supabase
              .from('gastos')
              .update(gastoPayload)
              .eq('id', expenseToEdit.id);
          
          if (updateError) throw updateError;
          savedGastoId = expenseToEdit.id;

          // Update linked line item (assuming single line for this view)
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

      // Create/Re-create Line Item
      if (savedGastoId) {
          const partidaPayload = {
              gasto_id: savedGastoId,
              proyecto_id: projectId,
              descripcion_linea: formData.descripcion,
              cantidad: formData.cantidad,
              precio_unidad: formData.precio_unidad,
              fecha_creacion: new Date().toISOString()
          };
          
          const { error: partidaError } = await supabase
            .from('partidas_gasto')
            .insert([partidaPayload]);
            
          if (partidaError) {
              console.warn("Could not save detail line", partidaError);
          }
      }

      toast({ 
        title: expenseToEdit ? 'Factura Actualizada' : 'Factura Guardada', 
        description: `Se ha ${expenseToEdit ? 'actualizado' : 'registrado'} la factura correctamente.` 
      });
      onSuccess();
      onClose();

    } catch (error) {
      console.error('Error saving material expense:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Error al guardar', 
        description: error.message || 'Ocurrió un error inesperado.' 
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

      // Buscar proveedor por nombre si se detectó
      if (result.proveedor_nombre) {
        const { data: provs } = await supabase
          .from('proveedores')
          .select('id, nombre')
          .ilike('nombre', `%${result.proveedor_nombre}%`)
          .limit(1);
        if (provs?.[0]) {
          setFormData(prev => ({ ...prev, proveedor_id: provs[0].id, providerName: provs[0].nombre }));
        }
      }

      // Rellenar campos de la cabecera
      setFormData(prev => ({
        ...prev,
        numero_factura: result.numero_factura || prev.numero_factura,
        fecha_emision: result.fecha || prev.fecha_emision,
        iva: result.iva_porcentaje ? result.iva_porcentaje / 100 : prev.iva,
        descripcion: result.proveedor_nombre
          ? `${result.proveedor_nombre}${result.lineas?.length ? ` — ${result.lineas.length} producto(s)` : ''}`
          : prev.descripcion,
        // Si hay una sola línea, rellenar cantidad y precio
        ...(result.lineas?.length === 1 ? {
          cantidad: result.lineas[0].cantidad || 1,
          precio_unidad: result.lineas[0].precio_unitario || 0,
        } : {}),
      }));

      const nLineas = result.lineas?.length || 0;
      toast({
        title: "Factura analizada",
        description: nLineas > 0
          ? `Se detectaron ${nLineas} producto(s). Revisa y completa los datos.`
          : "Datos de cabecera extraídos. Revisa y completa.",
      });
    } catch (err) {
      toast({ variant: "destructive", title: "Error al analizar", description: err.message });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {isEdit ? <Edit className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
              {isEdit ? 'Editar Factura' : 'Nueva Factura de Material'}
            </DialogTitle>
            {!isEdit && (
              <div className="flex gap-2 mr-6">
                {/* Cámara — móvil */}
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs"
                  onClick={() => scanInputRef.current?.click()} disabled={isScanning}>
                  {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  <span className="ml-1 hidden sm:inline">Foto</span>
                </Button>
                <input ref={scanInputRef} type="file" accept="image/*" capture="environment"
                  className="hidden" onChange={e => e.target.files?.[0] && handleScanFile(e.target.files[0])} />
                {/* Subir archivo */}
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
          {/* Preview de la imagen escaneada */}
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
                    <div className="relative">
                        <ProviderSelect 
                            value={formData.proveedor_id}
                            onValueChange={(val) => handleSelectChange('proveedor_id', val)}
                            placeholder="Buscar proveedor..."
                            initialLabel={formData.providerName}
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="fecha_emision">Fecha Factura</Label>
                    <div className="relative">
                        <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id="fecha_emision" 
                            name="fecha_emision" 
                            type="date"
                            value={formData.fecha_emision} 
                            onChange={handleChange} 
                            className="pl-9"
                            required 
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="numero_factura">Nº Factura / Referencia *</Label>
                    <Input 
                        id="numero_factura" 
                        name="numero_factura" 
                        value={formData.numero_factura} 
                        onChange={handleChange} 
                        placeholder="Ej: F-2024-001"
                        required 
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="material_id">Seleccionar Material (Opcional)</Label>
                    <Select 
                        value={formData.material_id} 
                        onValueChange={(val) => handleSelectChange('material_id', val)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Catálogo de materiales..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="custom">-- Introducir Manualmente --</SelectItem>
                            {materials.map(m => (
                                <SelectItem key={m.id} value={m.id}>
                                    {m.nombre} {m.precio_coste ? `(${m.precio_coste}€)` : ''}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="descripcion">Concepto / Descripción del Material *</Label>
                <Textarea 
                    id="descripcion" 
                    name="descripcion" 
                    value={formData.descripcion} 
                    onChange={handleChange} 
                    placeholder="Ej: 50 sacos de cemento cola..." 
                    required
                    rows={2}
                />
            </div>

            {/* Pricing Section */}
            <div className="bg-muted/30 p-4 rounded-lg border border-border/60">
                <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                    <Calculator className="w-4 h-4" /> Detalle Económico
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="cantidad" className="text-xs">Cantidad</Label>
                        <Input 
                            id="cantidad" 
                            name="cantidad" 
                            type="number" 
                            step="0.01" 
                            min="0"
                            value={formData.cantidad} 
                            onChange={handleChange} 
                            className="bg-background"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="precio_unidad" className="text-xs">Precio Unit. (€)</Label>
                        <Input 
                            id="precio_unidad" 
                            name="precio_unidad" 
                            type="number" 
                            step="0.01" 
                            min="0"
                            value={formData.precio_unidad} 
                            onChange={handleChange} 
                            className="bg-background"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="iva" className="text-xs">IVA</Label>
                        <Select 
                            value={formData.iva.toString()} 
                            onValueChange={(val) => handleSelectChange('iva', parseFloat(val))}
                        >
                            <SelectTrigger className="bg-background">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="0.21">21%</SelectItem>
                                <SelectItem value="0.10">10%</SelectItem>
                                <SelectItem value="0.04">4%</SelectItem>
                                <SelectItem value="0">0%</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                
                <div className="mt-4 pt-3 border-t flex justify-end items-end gap-6 text-sm">
                    <div className="text-right">
                        <span className="text-muted-foreground block text-xs">Base</span>
                        <span className="font-medium">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(subtotal)}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-muted-foreground block text-xs">IVA</span>
                        <span className="font-medium">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(importeIva)}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-muted-foreground block text-xs font-bold text-primary">Total</span>
                        <span className="font-bold text-lg text-primary">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(total)}</span>
                    </div>
                </div>
            </div>

            <DialogFooter className="mt-2">
                <Button variant="outline" type="button" onClick={onClose} disabled={loading}>Cancelar</Button>
                <Button type="submit" disabled={loading} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md">
                {loading ? (
                    <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                    </>
                ) : (
                    isEdit ? 'Actualizar Factura' : 'Guardar Factura'
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