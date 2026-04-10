import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, X, Search, ChevronDown, ServerCrash } from 'lucide-react';
import { cn } from '@/lib/utils';

const InlinePartidaSelector = ({ value, onChange, error, onBlur }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [partidas, setPartidas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  const fetchPartidas = useCallback(async (query) => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('sel_partidas', { p_q: query || null });
      if (rpcError) throw rpcError;
      setPartidas(data || []);
    } catch (err) {
      setFetchError('No se pudieron cargar las partidas.');
      console.error("Error fetching partidas:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchPartidas(searchTerm);
    }
  }, [isOpen, searchTerm, fetchPartidas]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        if (onBlur) onBlur();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef, onBlur]);

  const handleSelect = (partida) => {
    onChange(partida.value);
    setIsOpen(false);
  };
  
  const handleToggleOpen = () => {
    setIsOpen(!isOpen);
    if(isOpen && onBlur) onBlur();
  }

  return (
    <div className="relative" ref={wrapperRef}>
        <Button
            type="button"
            variant="outline"
            className={cn("w-full justify-between text-left font-normal h-11", !value && "text-muted-foreground", error && "border-destructive")}
            onClick={handleToggleOpen}
        >
            <span className="truncate">{value ? value : 'Selecciona partida...'}</span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
        </Button>
        {error && <p className="text-destructive text-xs mt-1">{error}</p>}
        
        <AnimatePresence>
        {isOpen && (
            <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="mt-2 w-full bg-card rounded-lg border border-border shadow-md overflow-hidden z-10"
            >
                <div className="p-2 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-9"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="max-h-60 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center p-4 text-muted-foreground">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando...
                        </div>
                    ) : fetchError ? (
                        <div className="flex flex-col justify-center items-center h-full text-destructive p-4 text-center">
                            <ServerCrash className="h-8 w-8 mb-2"/>
                            <p className="font-semibold text-sm">{fetchError}</p>
                            <Button variant="link" size="sm" onClick={() => fetchPartidas(searchTerm)}>Reintentar</Button>
                        </div>
                    ) : partidas.length === 0 ? (
                        <div className="text-center p-4 text-muted-foreground text-sm">
                            <p>No se encontraron partidas.</p>
                        </div>
                    ) : (
                        <ul className="">
                            {partidas.map((partida) => (
                                <li
                                    key={partida.value}
                                    onClick={() => handleSelect(partida)}
                                    className={`px-4 py-2.5 cursor-pointer hover:underline text-foreground text-sm ${
                                        value === partida.value ? 'font-bold text-primary' : ''
                                    }`}
                                >
                                    {partida.label}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </motion.div>
        )}
        </AnimatePresence>
    </div>
  );
};

export default InlinePartidaSelector;