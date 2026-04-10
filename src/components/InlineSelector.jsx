import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { ChevronDown, Loader2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';

const InlineSelector = ({ 
    value, 
    onChange, 
    onBlur, 
    rpcName, 
    tableName, 
    placeholder, 
    error,
    valueField = 'value', // Default value field
    isAllOption = false,
    className = '',
    searchEnabled = true
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef(null);
    const listRef = useRef(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const PAGE_SIZE = 20;

    const getFormattedData = (item) => {
        let itemValue, itemLabel, itemSubLabel;

        if (rpcName === 'api_empleados_para_fichaje') {
            itemValue = item.empleado_id;
            itemLabel = `${item.nombre || ''} ${item.apellidos || ''}`.trim();
            itemSubLabel = `${item.rol || ''} · ${item.email || ''}`;
        } else if (rpcName === 'sel_proyectos') {
            itemValue = item.id ?? item.value;
            itemLabel = item.nombre ?? item.nombre_proyecto ?? item.name ?? item.label ?? 'Proyecto sin nombre';
            itemSubLabel = null;
        } else {
            // Default behavior
            itemValue = item[valueField];
            itemLabel = item.label;
            itemSubLabel = item.subLabel || null;
        }
        return { value: itemValue, label: itemLabel, subLabel: itemSubLabel };
    };

    const fetchOptions = useCallback(async (currentOffset, currentSearchTerm) => {
        setLoading(true);
        let data, error;
        
        const rpcParams = { 
            p_search: searchEnabled ? (currentSearchTerm || null) : null,
            p_limit: PAGE_SIZE, 
            p_offset: currentOffset 
        };

        if (rpcName) {
            const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, rpcParams);
            data = rpcData;
            error = rpcError;
        } else if (tableName) {
            let queryBuilder = supabase.from(tableName).select('*').limit(PAGE_SIZE).range(currentOffset, currentOffset + PAGE_SIZE - 1);
            if (currentSearchTerm && searchEnabled) {
                queryBuilder = queryBuilder.ilike('label', `%${currentSearchTerm}%`); // Assumes 'label' field for search
            }
            const { data: tableData, error: tableError } = await queryBuilder;
            data = tableData;
            error = tableError;
        }

        if (error) {
            console.error(`Error fetching options from ${rpcName || tableName}:`, error);
            toast({ variant: 'destructive', title: 'Error al cargar datos', description: error.message });
            setOptions(currentOffset === 0 ? [] : options);
        } else {
             const formattedData = data.map(getFormattedData);
            
            if (currentOffset === 0) {
                setOptions(formattedData);
            } else {
                setOptions(prev => [...prev, ...formattedData]);
            }
            setHasMore(data.length === PAGE_SIZE);
        }
        setLoading(false);
    }, [rpcName, tableName, searchEnabled]);
    
    useEffect(() => {
        if (isOpen) {
            setOffset(0);
            fetchOptions(0, searchTerm);
        }
    }, [isOpen, searchTerm, fetchOptions]);

    const handleScroll = () => {
        if (listRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = listRef.current;
            if (scrollHeight - scrollTop - clientHeight < 5 && hasMore && !loading) {
                const newOffset = offset + PAGE_SIZE;
                setOffset(newOffset);
                fetchOptions(newOffset, searchTerm);
            }
        }
    };
    
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);
    
    const selectedOption = useMemo(() => {
        if (!value) return null;
        if (options.length > 0) {
            return options.find(opt => opt.value === value);
        }
        return null;
    }, [value, options]);

    const displayLabel = selectedOption ? selectedOption.label : placeholder;

    const handleSelect = (optionValue) => {
        onChange(optionValue);
        setIsOpen(false);
    };
    
    const handleKeyDown = (e) => {
        if (!isOpen) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        switch (e.key) {
            case 'Escape':
                setIsOpen(false);
                break;
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev => (prev + 1) % options.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => (prev - 1 + options.length) % options.length);
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0 && options[highlightedIndex]) {
                    handleSelect(options[highlightedIndex].value);
                }
                break;
            default:
                break;
        }
    };
    
    useEffect(() => {
      if (isOpen && highlightedIndex >= 0) {
        const element = listRef.current?.querySelector(`[data-index="${highlightedIndex}"]`);
        element?.scrollIntoView({ block: 'nearest' });
      }
    }, [highlightedIndex, isOpen]);


    return (
        <div className={cn("relative", className)} ref={wrapperRef} onKeyDown={handleKeyDown}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                onBlur={onBlur}
                className={cn(
                    "flex items-center justify-between w-full p-2 text-left bg-background border rounded-md h-10",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    error ? "border-destructive" : "border-input",
                    isOpen ? "ring-2 ring-ring" : ""
                )}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className={cn("truncate capitalize", !value && "text-muted-foreground")}>{displayLabel || placeholder}</span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 5 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-50 w-full mt-1 bg-card border rounded-md shadow-lg"
                    >
                        {searchEnabled && (
                            <div className="p-2 border-b">
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="text"
                                        placeholder="Buscar..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-8 h-9"
                                        autoFocus
                                    />
                                </div>
                            </div>
                        )}
                        <ul ref={listRef} onScroll={handleScroll} className="max-h-60 overflow-y-auto">
                            {loading && options.length === 0 ? (
                                <div className="flex items-center justify-center p-4">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : options.length > 0 ? (
                                options.map((option, index) => (
                                    <li
                                        key={option.value}
                                        data-index={index}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleSelect(option.value);
                                        }}
                                        onMouseEnter={() => setHighlightedIndex(index)}
                                        className={cn(
                                            "px-3 py-2 cursor-pointer hover:bg-accent",
                                            highlightedIndex === index ? "bg-accent" : "",
                                            option.value === value ? "font-bold bg-accent/50" : ""
                                        )}
                                    >
                                        <div className="font-medium capitalize">{option.label}</div>
                                        {option.subLabel && <div className="text-xs text-muted-foreground">{option.subLabel}</div>}
                                    </li>
                                ))
                            ) : (
                                <p className="p-4 text-sm text-center text-muted-foreground">
                                    Sin opciones disponibles
                                </p>
                            )}
                            {loading && options.length > 0 && (
                                <li className="flex justify-center p-2"><Loader2 className="h-4 w-4 animate-spin"/></li>
                            )}
                        </ul>
                    </motion.div>
                )}
            </AnimatePresence>
             {error && <p className="text-destructive text-xs mt-1">{error}</p>}
        </div>
    );
};

export default InlineSelector;