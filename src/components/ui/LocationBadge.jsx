import React from 'react';
import { Building2, Warehouse } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * LocationBadge Component
 * Displays a badge for a location (Project or Warehouse).
 * 
 * Rules:
 * - NAVE/TALLER/ALMACEN/CENTRAL: Always renders as "Taller / Nave Central" with Orange/Red style & Warehouse icon.
 * - GASTOS GENERALES: Also normalized to "Taller / Nave Central" logic if passed explicitly, 
 *   unless specific override requested (previously hidden, now standardized).
 * - Regular Locations: Blue style with Building icon.
 */
export const LocationBadge = ({ label, className, onClick }) => {
    // If explicitly null/undefined/empty, we might want to return "-" or handle it.
    // However, if the parent passed "Taller / Nave Central" due to missing project, we handle it here.
    if (!label) return <span className="text-muted-foreground">-</span>;
    
    // Normalize label for checking
    const upperLabel = label.trim().toUpperCase();

    // 1. NAVE/TALLER Check (Standardization)
    // Matches if it contains keywords indicating internal location.
    const isInternal = upperLabel.includes('NAVE') || 
                       upperLabel.includes('TALLER') || 
                       upperLabel.includes('ALMACEN') || 
                       upperLabel.includes('CENTRAL') ||
                       upperLabel === 'GASTOS GENERALES' ||
                       upperLabel === 'TALLER / NAVE CENTRAL'; // Self-match

    if (isInternal) {
        return (
            <div 
                onClick={(e) => {
                    if (onClick) {
                        e.stopPropagation();
                        onClick(e);
                    }
                }}
                className={cn(
                    "inline-flex items-center gap-2 whitespace-nowrap px-3 py-1 rounded-md text-xs font-medium border shadow-sm transition-colors select-none max-w-full",
                    "border-orange-200 bg-orange-50 text-orange-700", // Orange styling for Warehouse/Workshop
                    onClick ? "cursor-pointer hover:bg-orange-100 active:scale-95" : "",
                    className
                )} 
                title={label} // Original label in tooltip for debugging
            >
                <Warehouse className="w-3.5 h-3.5 flex-shrink-0" />
                {/* Task 1 & 3: Force standardize display text */}
                <span className="truncate max-w-[200px]">Taller / Nave Central</span>
            </div>
        );
    }

    // 2. Default: Regular Projects (Blue)
    return (
        <div 
            onClick={(e) => {
                if (onClick) {
                    e.stopPropagation();
                    onClick(e);
                }
            }}
            className={cn(
                "inline-flex items-center gap-2 whitespace-nowrap px-3 py-1 rounded-md text-xs font-medium border shadow-sm transition-colors select-none max-w-full",
                "border-blue-200 bg-blue-50 text-blue-700", // Blue styling for Projects
                onClick ? "cursor-pointer hover:bg-blue-100 active:scale-95" : "",
                className
            )} 
            title={label}
        >
            <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate max-w-[200px]">{label}</span>
        </div>
    );
};