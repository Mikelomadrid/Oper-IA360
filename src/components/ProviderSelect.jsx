// src/components/ProviderSelect.jsx
// ----------------------------------------------------------------------------
// Selector de proveedor con BÚSQUEDA INTELIGENTE.
// Calcado del patrón de ClientSelector (el buscador de clientes del modal de
// Nuevo Proyecto): input + búsqueda con debounce + dropdown + botón limpiar.
//
// Busca por NOMBRE y CIF en la tabla `proveedores`.
//
// Interfaz de props (idéntica a la que ya usa MaterialExpenseModal, NO cambiar):
//   - value:         proveedor_id seleccionado (uuid) | '' | null
//   - onValueChange: (id) => void         (se llama con el id del proveedor, o '' al limpiar)
//   - placeholder:   texto del input (por defecto "Buscar proveedor...")
//   - initialLabel:  nombre a mostrar al cargar (modo edición)
// ----------------------------------------------------------------------------

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, Search, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

export const ProviderSelect = ({ value, onValueChange, placeholder = 'Buscar proveedor...', initialLabel }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Mostrar el label inicial (modo edición)
  useEffect(() => {
    if (initialLabel) setInputValue(initialLabel);
  }, [initialLabel]);

  // Si el valor se limpia desde fuera, limpiar el input
  useEffect(() => {
    if (!value) {
      setInputValue('');
      setSearchTerm('');
    }
  }, [value]);

  // Si hay un value pero no tenemos label (p.ej. al autorrellenar proveedor
  // desde el catálogo de materiales), resolver el nombre del proveedor.
  useEffect(() => {
    let active = true;
    if (value && !inputValue && !initialLabel) {
      supabase
        .from('proveedores')
        .select('nombre')
        .eq('id', value)
        .maybeSingle()
        .then(({ data }) => {
          if (active && data?.nombre) setInputValue(data.nombre);
        });
    }
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Cerrar al hacer click fuera y restaurar el label
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        if (value && initialLabel) {
          setInputValue(initialLabel);
        } else if (!value) {
          setInputValue('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, initialLabel]);

  // Buscar proveedores (con debounce) — por NOMBRE y CIF
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('proveedores')
          .select('id, nombre, cif')
          .order('nombre')
          .limit(50);

        if (searchTerm) {
          // Sanear para no romper el filtro .or de PostgREST
          const term = searchTerm.replace(/[,()%]/g, ' ').trim();
          if (term) {
            query = query.or(`nombre.ilike.%${term}%,cif.ilike.%${term}%`);
          }
        }

        const { data, error } = await query;

        if (isMounted) {
          if (error) {
            console.error('Error fetching providers:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Error al buscar proveedores' });
          } else {
            setProviders(data || []);
          }
        }
      } catch (err) {
        console.error('Error in provider fetch:', err);
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

  const handleInputFocus = () => setIsOpen(true);

  const handleSelectProvider = (provider) => {
    onValueChange(provider.id);
    setInputValue(provider.nombre);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onValueChange('');
    setInputValue('');
    setSearchTerm('');
    setIsOpen(false);
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
          <Search className="h-4 w-4" />
        </div>

        <input
          ref={inputRef}
          type="text"
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-9 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            "cursor-text"
          )}
          placeholder={placeholder}
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

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute z-[9999] w-full mt-1 bg-popover text-popover-foreground rounded-md border shadow-md overflow-hidden animate-in fade-in-0 zoom-in-95"
          style={{ maxHeight: '300px' }}
        >
          <div className="max-h-[280px] overflow-y-auto p-1">
            {loading ? (
              <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Cargando...
              </div>
            ) : providers.length === 0 ? (
              <div className="p-4 text-sm text-center text-muted-foreground">
                No se encontraron proveedores.
              </div>
            ) : (
              providers.map((provider) => (
                <div
                  key={provider.id}
                  onClick={() => handleSelectProvider(provider)}
                  className={cn(
                    "relative flex flex-col cursor-pointer select-none rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    value === provider.id && "bg-accent/50 font-medium"
                  )}
                >
                  <span className="truncate">{provider.nombre}</span>
                  {provider.cif && (
                    <span className="text-xs text-muted-foreground truncate">CIF: {provider.cif}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderSelect;
