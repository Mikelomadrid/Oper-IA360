import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, X, Search, ServerCrash } from 'lucide-react';

const PartidaSelector = ({ isOpen, onClose, onSelect, selectedValue }) => {
  const [partidas, setPartidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPartidas = useCallback(async (query) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('sel_partidas', { p_q: query || null });
      if (rpcError) throw rpcError;
      setPartidas(data || []);
    } catch (err) {
      setError('No se pudieron cargar las partidas.');
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

  const handleSelect = (partida) => {
    onSelect(partida.value);
    onClose();
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-lg h-full max-h-[90vh] bg-card rounded-2xl flex flex-col shadow-2xl border border-border"
      >
        <div className="flex-shrink-0 p-6 flex justify-between items-center border-b">
          <h2 className="text-xl font-bold text-foreground">Seleccionar Partida</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="flex-shrink-0 p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar partida..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 text-base"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-grow overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-full text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando...
            </div>
          ) : error ? (
            <div className="flex flex-col justify-center items-center h-full text-destructive p-4 text-center">
              <ServerCrash className="h-10 w-10 mb-2"/>
              <p className="font-semibold">{error}</p>
              <Button variant="link" onClick={() => fetchPartidas(searchTerm)}>Reintentar</Button>
            </div>
          ) : partidas.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p>No se encontraron partidas.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {partidas.map((partida) => (
                <li
                  key={partida.value}
                  onClick={() => handleSelect(partida)}
                  className={`px-6 py-4 cursor-pointer hover:underline transition-all text-foreground ${
                    selectedValue === partida.value ? 'font-bold text-primary' : ''
                  }`}
                >
                  {partida.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default PartidaSelector;