import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Loader2, Check, ChevronsUpDown, X } from "lucide-react";
import { supabase } from "@/lib/customSupabaseClient";
import { toast } from "@/components/ui/use-toast";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/SupabaseAuthContext";

const RequestMaterialModal = ({ isOpen, onClose, onSuccess, availableMaterials = [] }) => {
  const { user } = useAuth();
  const [destinations, setDestinations] = useState({ obras: [], partes: [] });
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  // destination value format: "type:id:extra"
  // e.g. "obra:123-abc", "parte:456-def:789-ghi", "nave:0"
  const [selectedDestination, setSelectedDestination] = useState("");
  const [notes, setNotes] = useState("");
  // Items now have a unique local ID for React keys
  const [items, setItems] = useState([
    { id: `init-${Date.now()}`, materialId: "", description: "", quantity: 1, unit: "ud" }
  ]);

  useEffect(() => {
    if (isOpen) {
      fetchDestinations();
      // Reset form
      setSelectedDestination("");
      setNotes("");
      setItems([{ id: `init-${Date.now()}`, materialId: "", description: "", quantity: 1, unit: "ud" }]);
    }
  }, [isOpen, user]);

  const fetchDestinations = async () => {
    setLoadingData(true);
    try {
      // 1. Get Employee ID
      const { data: empleadoId, error: empError } = await supabase.rpc('get_user_id');
      if (empError) throw empError;

      // 2. Fetch Obras (Active Projects)
      const { data: obras, error: obrasError } = await supabase
        .from('proyectos')
        .select('id, nombre_proyecto')
        .eq('estado', 'activo')
        .order('nombre_proyecto');
      
      if (obrasError) throw obrasError;

      // 3. Fetch Partes (Active Work Orders for this user)
      // FIX: Removed 'proyecto_id' from selection as it doesn't exist in 'partes' table
      const { data: partes, error: partesError } = await supabase
        .from('partes')
        .select('id, custom_id, cliente_nombre') 
        .eq('tecnico_asignado_id', empleadoId)
        .neq('estado', 'cerrado')
        .order('created_at', { ascending: false });

      if (partesError) throw partesError;

      setDestinations({
        obras: obras || [],
        partes: partes || []
      });

    } catch (error) {
      console.error("Error loading destinations:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los destinos (obras/partes)." });
    } finally {
      setLoadingData(false);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { id: `item-${Date.now()}-${Math.random()}`, materialId: "", description: "", quantity: 1, unit: "ud" }]);
  };

  const handleRemoveItem = (index) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleMaterialSelect = (index, material) => {
    const newItems = [...items];
    newItems[index].materialId = material.id;
    newItems[index].description = material.nombre || material.descripcion;
    // Auto-fill unit if available
    newItems[index].unit = material.unidad_medida || 'ud';
    setItems(newItems);
  };

  const handleManualEntry = (index, text) => {
    const newItems = [...items];
    newItems[index].materialId = null; // Unlink if manual entry
    newItems[index].description = text; 
    if (!newItems[index].unit) newItems[index].unit = 'ud'; 
    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (!selectedDestination) {
      toast({ variant: "destructive", title: "Falta destino", description: "Debes seleccionar una Obra, Parte o Nave/Taller." });
      return;
    }
    if (items.length === 0) {
      toast({ variant: "destructive", title: "Sin ítems", description: "Agrega al menos un material." });
      return;
    }
    // Validate items
    for (const item of items) {
      if (!item.description) {
        toast({ variant: "destructive", title: "Datos incompletos", description: "Todos los ítems deben tener descripción." });
        return;
      }
      if (item.quantity <= 0) {
        toast({ variant: "destructive", title: "Datos incompletos", description: "La cantidad debe ser mayor a 0." });
        return;
      }
    }

    setSubmitting(true);
    try {
        const { data: empleadoId, error: empError } = await supabase.rpc('get_user_id');
        if (empError || !empleadoId) throw new Error("No se pudo identificar el empleado.");

        // Parse selected destination
        // Format: "type:id:extra"
        const [type, id, extraId] = selectedDestination.split(':');
        
        let proyectoId = null;
        let parteId = null;

        if (type === 'obra') {
            proyectoId = id;
        } else if (type === 'parte') {
            parteId = id;
            // Link to project if available (extraId might be null/undefined string)
            proyectoId = extraId && extraId !== 'null' && extraId !== 'undefined' ? extraId : null;
        } else if (type === 'nave') {
            // Both null
        }

      // 1. Insert Request Header
      const { data: reqData, error: reqError } = await supabase
        .from('solicitudes_material')
        .insert({
          empleado_solicitante_id: empleadoId,
          proyecto_id: proyectoId,
          parte_id: parteId,
          fecha_solicitud: new Date(),
          estado_solicitud: 'pendiente',
          tipo: 'material',
          notas: notes || null
        })
        .select()
        .single();

      if (reqError) throw reqError;

      // 2. Insert Items
      const itemsToInsert = items.map(item => ({
        solicitud_id: reqData.id,
        material_id: item.materialId || null, // Link to inventory if selected
        descripcion_personalizada: item.description,
        cantidad_solicitada: item.quantity,
        unidad: item.unit,
        preparada: false
      }));

      const { error: itemsError } = await supabase
        .from('detalles_solicitud')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast({ title: "Solicitud creada", description: "La solicitud de material se ha registrado correctamente." });
      if (onSuccess) onSuccess();
      onClose();

    } catch (error) {
      console.error("Error submitting request:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo crear la solicitud." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Solicitar Material</DialogTitle>
          <DialogDescription>
            Selecciona el destino (Obra, Parte o Taller) y lista los materiales necesarios.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Destination Selection */}
          <div className="space-y-2">
            <Label>Destino del Material</Label>
            <Select value={selectedDestination} onValueChange={setSelectedDestination} disabled={loadingData}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={loadingData ? "Cargando destinos..." : "Selecciona Obra, Parte o Taller"} />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {/* OBRAS */}
                {destinations.obras.length > 0 && (
                    <SelectGroup>
                        <SelectLabel>Obras / Proyectos</SelectLabel>
                        {destinations.obras.map(obra => (
                            <SelectItem key={`obra-${obra.id}`} value={`obra:${obra.id}`}>
                                🏗️ {obra.nombre_proyecto}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                )}
                
                {/* NAVE */}
                <SelectGroup>
                    <SelectLabel>Interno</SelectLabel>
                    <SelectItem value="nave:0">🏢 Nave / Taller (Stock Interno)</SelectItem>
                </SelectGroup>

                {/* PARTES */}
                {destinations.partes.length > 0 && (
                    <SelectGroup>
                        <SelectLabel>Mis Partes de Trabajo</SelectLabel>
                        {destinations.partes.map(parte => (
                            <SelectItem key={`parte-${parte.id}`} value={`parte:${parte.id}:null`}>
                                📋 {parte.custom_id || 'Parte'} - {parte.cliente_nombre || 'Sin cliente'}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Items List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Listado de Materiales</Label>
              <Button variant="outline" size="sm" onClick={handleAddItem} type="button">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Ítem
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                // Use unique local ID for key instead of index to prevent issues with dynamic lists
                <div key={item.id} className="flex flex-col sm:flex-row gap-3 items-start p-3 border rounded-md bg-muted/20">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-3 w-full">
                    
                    {/* Autocomplete Description Field */}
                    <div className="sm:col-span-8 space-y-1">
                      <Label className="text-xs">Descripción / Material</Label>
                      <MaterialAutocomplete 
                        materials={availableMaterials} 
                        selectedId={item.materialId}
                        currentText={item.description}
                        onSelect={(mat) => handleMaterialSelect(index, mat)} 
                        onManual={(text) => handleManualEntry(index, text)}
                      />
                    </div>

                    {/* Quantity */}
                    <div className="sm:col-span-2 space-y-1">
                        <Label className="text-xs">Cant.</Label>
                        <Input 
                            type="number" 
                            min="0" 
                            step="any"
                            value={item.quantity} 
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            className="no-spinner"
                        />
                    </div>

                    {/* Unit */}
                    <div className="sm:col-span-2 space-y-1">
                        <Label className="text-xs">Unidad</Label>
                        <Input 
                            value={item.unit} 
                            onChange={(e) => handleItemChange(index, 'unit', e.target.value)} 
                        />
                    </div>
                  </div>

                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="mt-0 sm:mt-6 self-end sm:self-start text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => handleRemoveItem(index)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notas / Observaciones (Opcional)</Label>
            <Textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              placeholder="Instrucciones adicionales, urgencia, etc."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar Solicitud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Robust Autocomplete Component
const MaterialAutocomplete = ({ materials, selectedId, currentText, onSelect, onManual }) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  // When opening, reset filter but keep if user is typing
  useEffect(() => {
    if (!open) {
        setInputValue(""); 
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal text-left px-3 h-10", // Ensure height for touch targets
            !currentText && "text-muted-foreground"
          )}
        >
          <span className="truncate block">
            {currentText || "Buscar en catálogo o escribir..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      
      {/* 
         pointer-events-auto ensures clicks work on mobile overlays.
         max-h-[300px] + overflow-y-auto ensures scrolling works.
      */}
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 pointer-events-auto" align="start">
        <Command 
            filter={(value, search) => {
                if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                return 0;
            }}
            shouldFilter={true}
        >
          <CommandInput 
            placeholder="Buscar material..." 
            value={inputValue}
            onValueChange={setInputValue}
            className="h-11" // Larger touch target
          />
          <CommandList className="max-h-[250px] overflow-y-auto">
            <CommandEmpty className="py-3 px-3 text-center text-sm">
              <p className="text-muted-foreground mb-3">No encontrado en inventario.</p>
              <Button 
                variant="secondary" 
                size="sm" 
                className="w-full h-9 border border-input shadow-sm"
                onClick={() => {
                    onManual(inputValue);
                    setOpen(false);
                }}
              >
                <Plus className="mr-2 h-3 w-3" />
                Usar "{inputValue}" como texto manual
              </Button>
            </CommandEmpty>
            <CommandGroup heading="Opciones">
              {/* Option to clear selection if one exists */}
              {selectedId && (
                  <CommandItem
                      value="manual_entry_override_clear"
                      onSelect={() => {
                          onManual(currentText); // Keep text but clear ID
                          setOpen(false);
                      }}
                      className="text-muted-foreground italic border-b mb-1 cursor-pointer data-[disabled]:opacity-100 data-[disabled]:pointer-events-auto"
                  >
                      <X className="mr-2 h-4 w-4" />
                      Desvincular del catálogo (texto libre)
                  </CommandItem>
              )}

              {materials.map((material) => (
                <CommandItem
                  key={material.id}
                  value={`${material.nombre || ''} ${material.descripcion || ''} ${material.codigo || ''}`}
                  onSelect={() => {
                    onSelect(material);
                    setOpen(false);
                  }}
                  disabled={false} // Explicitly enabled
                  className="cursor-pointer py-2 data-[disabled]:opacity-100 data-[disabled]:pointer-events-auto" // Force enable visually and interaction
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedId === material.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col overflow-hidden w-full">
                      <span className="font-medium truncate">{material.nombre || material.descripcion}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {material.codigo && <span className="font-mono bg-muted px-1 rounded">{material.codigo}</span>}
                        {material.stock_actual !== undefined && (
                            <span className="whitespace-nowrap">Stock: {material.stock_actual} {material.unidad_medida}</span>
                        )}
                      </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default RequestMaterialModal;