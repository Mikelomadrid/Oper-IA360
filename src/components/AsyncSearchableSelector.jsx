import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDebounce } from '@/hooks/useDebounce';

export function AsyncSearchableSelector({
  value,
  onSelect,
  fetcher,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  initialLabel = "",
  disabled = false,
  className,
  selected, // alias for value
  popoverProps, 
  modal = true // Default to true to ensure inputs work correctly inside Dialogs
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(initialLabel || "");

  const currentValue = value || selected;
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Sync internal label if initialLabel changes (e.g. when editing an existing item)
  useEffect(() => {
    if (initialLabel) {
        setSelectedLabel(initialLabel);
    }
  }, [initialLabel]);

  // Load options when popover opens or search term changes
  // We rely on debouncedSearchTerm to trigger fetches to avoid spamming the API
  useEffect(() => {
    if (open) {
      loadOptions(debouncedSearchTerm);
    } else {
        // Reset search term when closed so next open is fresh
        setSearchTerm("");
    }
  }, [open, debouncedSearchTerm]);

  const loadOptions = async (query) => {
    if (!fetcher) return;
    setLoading(true);
    try {
      const res = await fetcher(query);
      setOptions(res || []);
    } catch (e) {
      console.error("Error fetching options:", e);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (val, label, extra) => {
    // Update parent state
    onSelect(val, label, extra);
    setSelectedLabel(label);
    setOpen(false);
  };

  const clearSelection = (e) => {
      e.stopPropagation();
      onSelect(null, "", null);
      setSelectedLabel("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={modal} {...popoverProps}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !currentValue && "text-muted-foreground", className)}
          disabled={disabled}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          {currentValue && !disabled ? (
              <div 
                role="button"
                tabIndex={0}
                className="ml-2 h-6 w-6 shrink-0 z-10 cursor-pointer flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" 
                onClick={clearSelection}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    clearSelection(e);
                  }
                }}
                title="Limpiar selección"
              >
                <X className="h-3 w-3 opacity-50 hover:opacity-100" />
              </div>
          ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      
      {/* 
          Increased z-index to 9999 to ensure it floats above dialogs/modals.
          pointer-events-auto ensures interaction isn't blocked.
          Collision handling is managed by Radix automatically.
      */}
      <PopoverContent 
        className="w-[--radix-popover-trigger-width] p-0 z-[9999] pointer-events-auto" 
        align="start"
        onOpenAutoFocus={(e) => {
            // Prevent default focus behavior if it interferes with CommandInput autoFocus
            // But usually CommandInput gets it naturally.
        }}
      >
        {/* 
            shouldFilter={false} is CRITICAL for async search. 
            It prevents cmdk from filtering items locally, allowing the API results 
            (controlled by searchTerm) to be the source of truth.
        */}
        <Command shouldFilter={false} loop> 
          <CommandInput 
            placeholder={searchPlaceholder} 
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="border-none focus:ring-0" 
            autoFocus
          />
          <CommandList>
            {loading && (
               <div className="flex items-center justify-center p-4 text-xs text-muted-foreground">
                 <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando...
               </div>
            )}
            {!loading && options.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">No se encontraron resultados.</div>
            )}
            {!loading && options.length > 0 && (
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value} // Stable key using ID
                    value={option.value} // Use ID as value for uniqueness in cmdk selection
                    onSelect={() => handleSelect(option.value, option.label, option.extra)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        currentValue === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}