import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2, UserPlus, MapPin, Phone, Building2, History } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce'; // Assuming hook exists, if not I'll implement internal logic

/**
 * ClientAutocomplete Component
 * 
 * A full-featured autocomplete for searching clients in the database.
 * Supports debounced search, keyboard navigation, recent searches, and creating new clients.
 * 
 * Props:
 * - onClientSelect (function): Callback when a client is selected from list. Receives full client object.
 * - onClientCreate (function): Callback when "Create new" is clicked. Receives the input string.
 * - initialValue (string): Initial text to display (e.g. when editing).
 * - placeholder (string): Input placeholder.
 * - className (string): Additional classes for the container.
 * - error (boolean): Visual error state.
 * 
 * Integration Pattern:
 * const handleSelect = (client) => {
 *   setFormData(prev => ({
 *     ...prev,
 *     cliente_nombre: client.nombre,
 *     direccion: client.direccion,
 *     telefono: client.telefono
 *   }));
 * };
 */
const ClientAutocomplete = ({ 
    onClientSelect, 
    onClientCreate, 
    initialValue = '', 
    placeholder = "Buscar cliente...", 
    className,
    error = false
}) => {
    const [inputValue, setInputValue] = useState(initialValue);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [recentClients, setRecentClients] = useState([]);
    
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);
    const debouncedSearchTerm = useDebounce(inputValue, 300);

    // Load recent selections on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem('recent_clients');
            if (saved) {
                setRecentClients(JSON.parse(saved));
            }
        } catch (e) {
            console.error("Error loading recent clients", e);
        }
    }, []);

    // Sync initial value if it changes externally
    useEffect(() => {
        setInputValue(initialValue || '');
    }, [initialValue]);

    // Save recent selection
    const saveToRecents = (client) => {
        try {
            const newRecents = [client, ...recentClients.filter(c => c.id !== client.id)].slice(0, 5);
            setRecentClients(newRecents);
            localStorage.setItem('recent_clients', JSON.stringify(newRecents));
        } catch (e) {
            console.error("Error saving recent client", e);
        }
    };

    // Search logic
    useEffect(() => {
        const searchClients = async () => {
            if (!debouncedSearchTerm || debouncedSearchTerm.trim().length < 2) {
                setResults([]);
                return;
            }

            setIsLoading(true);
            try {
                // Prioritize exact matches by ordering logic if possible, simplified here
                const { data, error } = await supabase
                    .from('clientes')
                    .select('*')
                    .or(`nombre.ilike.%${debouncedSearchTerm}%,email.ilike.%${debouncedSearchTerm}%,telefono.ilike.%${debouncedSearchTerm}%`)
                    .limit(15);

                if (error) throw error;
                
                // Sort locally to put name matches first
                const sorted = (data || []).sort((a, b) => {
                    const aName = a.nombre?.toLowerCase() || '';
                    const bName = b.nombre?.toLowerCase() || '';
                    const term = debouncedSearchTerm.toLowerCase();
                    if (aName.startsWith(term) && !bName.startsWith(term)) return -1;
                    if (!aName.startsWith(term) && bName.startsWith(term)) return 1;
                    return 0;
                });

                setResults(sorted);
            } catch (err) {
                console.error("Error searching clients:", err);
                setResults([]);
            } finally {
                setIsLoading(false);
            }
        };

        if (isOpen) {
            searchClients();
        }
    }, [debouncedSearchTerm, isOpen]);

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target) && 
                inputRef.current && !inputRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleKeyDown = (e) => {
        // Allow navigation even if showing recents
        const list = (inputValue.length < 2 && recentClients.length > 0) ? recentClients : results;
        const hasCreateOption = inputValue.length > 0;
        const totalItems = list.length + (hasCreateOption ? 1 : 0);

        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') setIsOpen(true);
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev => (prev + 1) % totalItems);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => (prev - 1 + totalItems) % totalItems);
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0) {
                    if (highlightedIndex < list.length) {
                        handleSelect(list[highlightedIndex]);
                    } else {
                        handleCreateNew();
                    }
                }
                break;
            case 'Escape':
                setIsOpen(false);
                inputRef.current?.blur();
                break;
            case 'Tab':
                setIsOpen(false);
                break;
        }
    };

    const handleSelect = (client) => {
        setInputValue(client.nombre);
        onClientSelect(client);
        saveToRecents(client);
        setIsOpen(false);
        setHighlightedIndex(-1);
    };

    const handleCreateNew = () => {
        onClientCreate(inputValue);
        setIsOpen(false);
        setHighlightedIndex(-1);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        setInputValue('');
        onClientCreate(''); // Reset parent
        setResults([]);
        setIsOpen(false); // keep open or closed? usually closed on clear
        inputRef.current?.focus();
    };

    const highlightText = (text, highlight) => {
        if (!text) return '';
        if (!highlight || highlight.length < 2) return text;
        const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
        return parts.map((part, i) => 
            part.toLowerCase() === highlight.toLowerCase() 
                ? <span key={i} className="bg-yellow-100 text-yellow-900 font-medium rounded-sm px-0.5">{part}</span> 
                : part
        );
    };

    const showRecents = isOpen && inputValue.length < 2 && recentClients.length > 0;
    const showResults = isOpen && inputValue.length >= 2;
    const activeList = showRecents ? recentClients : results;

    return (
        <div className={cn("relative w-full group", className)}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        if (!isOpen) setIsOpen(true);
                        setHighlightedIndex(-1); // Reset highlight on type
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className={cn(
                        "w-full h-11 pl-10 pr-10 rounded-lg border bg-background text-sm transition-all outline-none",
                        "placeholder:text-muted-foreground",
                        "border-input hover:border-accent-foreground/30 focus:border-primary focus:ring-2 focus:ring-primary/20",
                        error && "border-destructive focus:ring-destructive/20"
                    )}
                    autoComplete="off"
                />
                {inputValue && (
                    <button 
                        type="button"
                        onClick={handleClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Limpiar búsqueda"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {isOpen && (
                <div 
                    ref={dropdownRef}
                    className="absolute z-50 w-full mt-2 bg-popover rounded-xl border shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 origin-top"
                >
                    <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20">
                        
                        {isLoading && (
                            <div className="p-4 flex items-center justify-center text-muted-foreground gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-sm">Buscando...</span>
                            </div>
                        )}

                        {/* Recent Searches */}
                        {showRecents && !isLoading && (
                            <div className="py-1">
                                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <History className="w-3 h-3" /> Recientes
                                </div>
                                {recentClients.map((client, index) => (
                                    <SearchResultItem 
                                        key={client.id}
                                        client={client}
                                        isHighlighted={index === highlightedIndex}
                                        onClick={() => handleSelect(client)}
                                        searchTerm=""
                                    />
                                ))}
                            </div>
                        )}

                        {/* Search Results */}
                        {showResults && !isLoading && results.length > 0 && (
                            <div className="py-1">
                                {results.map((client, index) => (
                                    <SearchResultItem 
                                        key={client.id}
                                        client={client}
                                        isHighlighted={index === highlightedIndex}
                                        onClick={() => handleSelect(client)}
                                        searchTerm={inputValue}
                                        highlightFunc={highlightText}
                                    />
                                ))}
                            </div>
                        )}

                        {/* No Results & Create Option */}
                        {!isLoading && (
                            <div className="p-1 border-t bg-muted/30">
                                {showResults && results.length === 0 && (
                                    <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                                        No se encontraron resultados.
                                    </div>
                                )}
                                
                                {inputValue.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleCreateNew}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-3 text-sm rounded-lg transition-colors text-left",
                                            (highlightedIndex === (activeList.length)) ? "bg-primary text-primary-foreground" : "hover:bg-primary/10 text-primary"
                                        )}
                                    >
                                        <div className={cn(
                                            "flex items-center justify-center w-8 h-8 rounded-full",
                                            (highlightedIndex === (activeList.length)) ? "bg-primary-foreground/20" : "bg-primary/10"
                                        )}>
                                            <UserPlus className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1">
                                            <span className="font-semibold">Crear nuevo cliente:</span>
                                            <span className="ml-1 opacity-90 truncate block max-w-[200px] md:max-w-xs italic">
                                                "{inputValue}"
                                            </span>
                                        </div>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const SearchResultItem = ({ client, isHighlighted, onClick, searchTerm, highlightFunc }) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            "w-full flex items-start gap-3 px-3 py-3 text-sm transition-colors text-left border-b border-border/40 last:border-0",
            isHighlighted ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
        )}
    >
        <div className={cn(
            "flex-shrink-0 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center bg-muted",
            isHighlighted ? "bg-background/20" : "bg-muted"
        )}>
            <Building2 className="w-4 h-4 opacity-70" />
        </div>
        <div className="flex-1 min-w-0">
            <div className="font-medium truncate">
                {highlightFunc ? highlightFunc(client.nombre, searchTerm) : client.nombre}
            </div>
            <div className="flex flex-col gap-0.5 mt-1 text-xs text-muted-foreground">
                {(client.direccion || client.municipio) && (
                    <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {[client.direccion, client.municipio].filter(Boolean).join(', ')}
                    </span>
                )}
                {client.telefono && (
                    <span className="flex items-center gap-1 truncate">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        {client.telefono}
                    </span>
                )}
            </div>
        </div>
    </button>
);

export default ClientAutocomplete;