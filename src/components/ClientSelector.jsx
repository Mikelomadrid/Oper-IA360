import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, Search, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

export const ClientSelector = ({ value, onChange, initialLabel }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

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
        // On blur, revert input to selected label if exists, or clear if nothing selected
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
    // Only fetch if open to save resources
    if (!isOpen) return;

    let isMounted = true;
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('clientes')
          .select('id, nombre')
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
    }, 300); // Debounce

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
    // Optional: clear input on focus to allow fresh search? 
    // Usually better to keep text. 
    // If we want to show all clients immediately, we can clear searchTerm but keep inputValue visually?
    // For now, simpler: keep standard behavior.
  };

  const handleSelectClient = (client) => {
    onChange(client.id, client.nombre);
    setInputValue(client.nombre);
    setSearchTerm(""); // Clear search logic
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null, "");
    setInputValue("");
    setSearchTerm("");
    setIsOpen(false); // Optionally keep open? Usually clear implies reset.
    if(inputRef.current) inputRef.current.focus();
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
            "flex h-10 w-full rounded-md border border-input bg-background px-9 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            "cursor-text" // Ensure cursor indicates text input
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
            style={{ maxHeight: '250px' }}
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
        </div>
      )}
    </div>
  );
};