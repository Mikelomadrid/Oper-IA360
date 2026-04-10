import React, { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from "@/lib/utils";

/**
 * Enhanced ProviderSelect
 * - Fetches providers from Supabase if not passed in props.
 * - Handles z-index for Modals using strict layering.
 * - Supports initialLabel for pre-filled states (edit mode).
 * - Returns (value, providerObject) on change.
 */
export function ProviderSelect({ 
    value, 
    onValueChange, 
    onChange, // Compatibilidad con formularios que usan onChange
    providers, 
    placeholder = "Seleccionar proveedor...", 
    disabled = false,
    className,
    initialLabel 
}) {
    const [internalProviders, setInternalProviders] = useState([]);
    const [loading, setLoading] = useState(false);

    // Determinar si usamos proveedores externos o fetch interno
    // Si providers es un array (incluso vacío), se usa. Si es undefined/null, se hace fetch.
    const isManagedExternally = Array.isArray(providers); 
    const displayProviders = isManagedExternally ? providers : internalProviders;
    
    // Auto-fetch si no es gestionado externamente
    useEffect(() => {
        if (isManagedExternally) return;

        let mounted = true;

        const fetchProviders = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('proveedores')
                    .select('id, nombre')
                    .eq('activo', true)
                    .order('nombre');
                
                if (error) throw error;
                if (mounted) {
                    setInternalProviders(data || []);
                }
            } catch (error) {
                console.error("Error loading providers:", error);
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        fetchProviders();

        return () => {
            mounted = false;
        };
    }, [isManagedExternally]);

    // Manejo unificado de cambios
    const handleValueChange = (val) => {
        const selectedProvider = displayProviders.find(p => String(p.id) === val);
        
        if (onValueChange) {
            onValueChange(val, selectedProvider);
        }
        
        if (onChange) {
            onChange(val, selectedProvider);
        }
    };

    // Safe value handling
    const safeValue = value ? String(value) : undefined;
    const hasProviders = displayProviders && displayProviders.length > 0;

    return (
        <Select 
            value={safeValue} 
            onValueChange={handleValueChange} 
            disabled={disabled || (loading && !hasProviders && !isManagedExternally)}
        >
            <SelectTrigger className={cn("w-full bg-background", className)}>
                <SelectValue placeholder={loading ? "Cargando..." : placeholder} />
            </SelectTrigger>
            
            {/* z-[9999] ensures it is above any Modal/Dialog/Sheet */}
            <SelectContent className="max-h-[300px] overflow-y-auto z-[9999]">
                
                {/* Hidden Item Strategy for Initial Label when value exists but list isn't loaded or doesn't contain it */}
                {initialLabel && safeValue && !displayProviders.some(p => String(p.id) === safeValue) && (
                    <SelectItem value={safeValue} className="hidden">
                        {initialLabel}
                    </SelectItem>
                )}

                {hasProviders ? (
                    displayProviders.map((provider) => (
                        <SelectItem key={provider.id} value={String(provider.id)}>
                            {provider.name || provider.nombre || "Sin Nombre"}
                        </SelectItem>
                    ))
                ) : (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                        {loading ? "Cargando..." : "No hay proveedores disponibles"}
                    </div>
                )}
            </SelectContent>
        </Select>
    );
}