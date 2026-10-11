// src/components/ClientSelector.jsx
// ----------------------------------------------------------------------------
// Selector de cliente con BÚSQUEDA + opción de CREAR cliente nuevo al vuelo.
//
// Compatible con el uso actual (mismos props):
//   - value:        cliente_id seleccionado (uuid) | null
//   - onChange:     (id, nombre) => void   (igual que antes)
//   - initialLabel: nombre a mostrar al cargar (edición)
//   - seed:         (opcional) datos para precargar el alta rápida de cliente.
//                   Úsalo en la conversión lead -> obra para arrastrar los datos
//                   del lead: { nombre, contacto, telefono, email, cif, direccion, municipio, provincia, codigo_postal }
//
// Al crear, inserta en `clientes`, selecciona el cliente nuevo y avisa por toast.
// ----------------------------------------------------------------------------

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, Search, X, ChevronDown, UserPlus, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import FichaContacto, { FICHA_CONTACTO_VACIA, validateFichaContacto } from '@/components/FichaContacto';

export const ClientSelector = ({ value, onChange, initialLabel, seed }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // --- NUEVO: estado del alta rápida de cliente ---
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ficha, setFicha] = useState(FICHA_CONTACTO_VACIA);
  const [createErrors, setCreateErrors] = useState({});

  // Sync initial label when provided
  useEffect(() => {
    if (initialLabel) {
      setInputValue(initialLabel);
    }
  }, [initialLabel]);

  // Sync when value is cleared externally
  useEffect(() => {
    if (!value) {
      setInputValue("");
      setSearchTerm("");
    }
  }, [value]);

  // Handle outside clicks to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        if (value && initialLabel) {
          setInputValue(initialLabel);
        } else if (!value) {
          setInputValue("");
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [value, initialLabel]);

  // Fetch clients
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('clientes')
          .select('id, nombre, contacto, telefono, email, cif, direccion, calle_numero, municipio, provincia, codigo_postal')
          .order('nombre')
          .limit(50);

        if (searchTerm) {
          query = query.ilike('nombre', `%${searchTerm}%`);
        }

        const { data, error } = await query;

        if (isMounted) {
          if (error) {
            console.error("Error fetching clients:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Error al buscar clientes' });
          } else {
            setClients(data || []);
          }
        }
      } catch (err) {
        console.error("Error in client fetch:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [searchTerm, isOpen]);

  const handleInputChange = (e) => {
    const newVal = e.target.value;
    setInputValue(newVal);
    setSearchTerm(newVal);
    if (!isOpen) setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleSelectClient = (client) => {
    onChange(client.id, client.nombre, client);
    setInputValue(client.nombre);
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null, "");
    setInputValue("");
    setSearchTerm("");
    setIsOpen(false);
    if (inputRef.current) inputRef.current.focus();
  };

  // --- NUEVO: abrir alta rápida (precarga lo que se estuviera buscando + seed) ---
  const openCreate = () => {
    setIsOpen(false);
    setCreateErrors({});
    setFicha({
      ...FICHA_CONTACTO_VACIA,
      nombre: (searchTerm || seed?.nombre || '').trim(),
      contacto: seed?.contacto || '',
      telefono: seed?.telefono || '',
      email: seed?.email || '',
      cif: seed?.cif || '',
      direccion: seed?.direccion || '',
      municipio: seed?.municipio || '',
      provincia: seed?.provincia || '',
      codigo_postal: seed?.codigo_postal || '',
    });
    setShowCreate(true);
  };

  // --- NUEVO: crear cliente en `clientes` y seleccionarlo ---
  const handleCreate = async () => {
    const { ok, errors } = validateFichaContacto(ficha, 'cliente_rapido');
    if (!ok) {
      setCreateErrors(errors);
      return;
    }
    setSaving(true);
    try {
      const limpio = (v) => {
        const t = String(v ?? '').trim();
        return t === '' ? null : t;
      };

      const payload = {
        nombre: ficha.nombre.trim(),
        contacto: limpio(ficha.contacto),
        cif: limpio(ficha.cif),
        email: limpio(ficha.email),
        telefono: limpio(ficha.telefono),
        direccion: limpio(ficha.direccion),
        calle_numero: limpio(ficha.direccion), // se mantiene sincronizado como en ClientForm
        municipio: limpio(ficha.municipio),
        provincia: limpio(ficha.provincia),
        codigo_postal: limpio(ficha.codigo_postal),
      };

      const { data, error } = await supabase
        .from('clientes')
        .insert(payload)
        .select('id, nombre, contacto, telefono, email, cif, direccion, calle_numero, municipio, provincia, codigo_postal')
        .single();

      if (error) {
        if (error.code === '23505') {
          toast({ variant: 'destructive', title: 'CIF/NIF duplicado', description: 'Ya existe un cliente con ese CIF/NIF.' });
        } else {
          toast({ variant: 'destructive', title: 'Error al crear cliente', description: error.message });
        }
        return;
      }

      // Seleccionar el cliente recién creado (con todos sus datos)
      onChange(data.id, data.nombre, data);
      setInputValue(data.nombre);
      setSearchTerm("");
      setShowCreate(false);
      toast({
        title: 'Cliente creado',
        description: `"${data.nombre}" se ha añadido y seleccionado.`,
        className: 'bg-green-50 border-green-200',
      });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="relative w-full" ref={containerRef}>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <Search className="h-4 w-4" />
          </div>

          <input
            ref={inputRef}
            type="text"
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-9 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              "cursor-text"
            )}
            placeholder="Buscar cliente..."
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            autoComplete="off"
          />

          {value ? (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <ChevronDown className="h-4 w-4 opacity-50" />
            </div>
          )}
        </div>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            className="absolute z-[9999] w-full mt-1 bg-popover text-popover-foreground rounded-md border shadow-md overflow-hidden animate-in fade-in-0 zoom-in-95"
            style={{ maxHeight: '300px' }}
          >
            <div className="max-h-[250px] overflow-y-auto p-1">
              {loading ? (
                <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Cargando...
                </div>
              ) : clients.length === 0 ? (
                <div className="p-4 text-sm text-center text-muted-foreground">
                  No se encontraron clientes.
                </div>
              ) : (
                clients.map((client) => (
                  <div
                    key={client.id}
                    onClick={() => handleSelectClient(client)}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      value === client.id && "bg-accent/50 font-medium"
                    )}
                  >
                    {client.nombre}
                  </div>
                ))
              )}
            </div>

            {/* NUEVO: crear cliente nuevo */}
            <div className="border-t p-1">
              <button
                type="button"
                onClick={openCreate}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm font-medium text-primary hover:bg-accent transition-colors"
              >
                <UserPlus className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  Crear cliente nuevo{searchTerm ? `: "${searchTerm}"` : ''}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* NUEVO: diálogo de alta rápida de cliente */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!saving) setShowCreate(o); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto z-[10000]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <UserPlus className="h-5 w-5 text-primary" />
              Nuevo cliente
            </DialogTitle>
            <DialogDescription>
              Se guardará en tu cartera de clientes y quedará seleccionado en la obra.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <FichaContacto
              value={ficha}
              onChange={setFicha}
              errors={createErrors}
              modo="cliente_rapido"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleCreate} disabled={saving} className="min-w-[160px]">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              {saving ? 'Guardando...' : 'Crear y seleccionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClientSelector;
