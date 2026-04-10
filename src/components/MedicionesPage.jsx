import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, AlertTriangle, Ruler, Maximize2, Columns, Layers, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import MedicionCreateModal from './MedicionCreateModal';

export default function MedicionesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mediciones, setMediciones] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetching from the view as requested originally, assuming create updates base table 'mediciones' 
      // and view 'v_mediciones_validas' reflects it.
      const { data, error } = await supabase
        .from('v_mediciones_validas')
        .select('*')
        .order('estancia', { ascending: true });

      if (error) throw error;
      setMediciones(data || []);
    } catch (err) {
      console.error("Error al cargar mediciones:", err);
      setError("Error al cargar los datos. Por favor, inténtelo de nuevo más tarde.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateSuccess = () => {
    fetchData();
  };

  if (loading && mediciones.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-10 bg-background/50">
        <Loader2 className="h-10 w-10 animate-spin text-primary/70 mb-4" />
        <p className="text-muted-foreground animate-pulse">Cargando mediciones...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-10">
        <div className="bg-destructive/10 p-6 rounded-full mb-6">
          <AlertTriangle className="h-12 w-12 text-destructive" />
        </div>
        <h3 className="text-xl font-bold text-destructive mb-2">Error de Carga</h3>
        <p className="text-muted-foreground max-w-md text-center">{error}</p>
        <Button variant="outline" className="mt-4" onClick={fetchData}>Reintentar</Button>
      </div>
    );
  }

  // Calculate totals for quick stats
  const totalM2Suelo = mediciones.reduce((acc, curr) => acc + (parseFloat(curr.m2_suelo) || 0), 0);
  const totalM2Paredes = mediciones.reduce((acc, curr) => acc + (parseFloat(curr.m2_paredes) || 0), 0);

  return (
    <div className="w-full flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-muted/5">
      {/* Hero Section */}
      <div className="relative w-full h-48 sm:h-56 bg-zinc-900 shrink-0 overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1489512093541-ffa415651a9c" 
          alt="Mediciones Banner" 
          className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent via-black/40" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8 md:p-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 w-full">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/20 backdrop-blur-sm rounded-lg border border-primary/30">
                  <Ruler className="w-6 h-6 text-primary-foreground" />
                </div>
                <Badge variant="outline" className="bg-black/30 text-white border-white/20 backdrop-blur-md">
                  Módulo de Lectura
                </Badge>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight drop-shadow-lg">
                Mediciones de Obra
              </h1>
              <p className="text-zinc-300 max-w-2xl text-sm sm:text-base mt-2 drop-shadow-md">
                Registro detallado de superficies y perímetros por estancia. Información consolidada para estimaciones y presupuestos.
              </p>
            </div>
            
            <Button 
              size="lg" 
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-white text-black hover:bg-zinc-200 shadow-lg font-semibold shrink-0"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nueva medición
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
        
        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/50 backdrop-blur-sm shadow-sm border-muted">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Estancias</p>
                <h3 className="text-2xl font-bold text-foreground mt-1">{mediciones.length}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Columns className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50 backdrop-blur-sm shadow-sm border-muted">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Suelo</p>
                <h3 className="text-2xl font-bold text-foreground mt-1">{totalM2Suelo.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">m²</span></h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <Maximize2 className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm shadow-sm border-muted">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Paredes</p>
                <h3 className="text-2xl font-bold text-foreground mt-1">{totalM2Paredes.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">m²</span></h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Layers className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <Card className="shadow-md border-muted/60 overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Ruler className="w-5 h-5 text-primary" />
                Listado de Mediciones
              </CardTitle>
            </div>
          </CardHeader>
          <div className="relative overflow-x-auto">
            {mediciones.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-4">
                <p>No hay registros de mediciones disponibles.</p>
                <Button variant="outline" onClick={() => setIsCreateModalOpen(true)}>
                  Crear primera medición
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/10">
                    <TableHead className="w-[30%] min-w-[200px] font-semibold">Estancia</TableHead>
                    <TableHead className="text-right font-semibold text-primary/80">Suelo (m²)</TableHead>
                    <TableHead className="text-right font-semibold text-primary/80">Techo (m²)</TableHead>
                    <TableHead className="text-right font-semibold text-primary/80">Paredes (m²)</TableHead>
                    <TableHead className="text-right font-semibold text-primary/80">Rodapié (ml)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mediciones.map((row, index) => (
                    <TableRow key={row.medicion_id || index} className="group hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {row.estancia || 'Sin nombre'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.m2_suelo ? Number(row.m2_suelo).toFixed(2) : '-'} <span className="text-xs text-muted-foreground ml-0.5">m²</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.m2_techo ? Number(row.m2_techo).toFixed(2) : '-'} <span className="text-xs text-muted-foreground ml-0.5">m²</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.m2_paredes ? Number(row.m2_paredes).toFixed(2) : '-'} <span className="text-xs text-muted-foreground ml-0.5">m²</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.ml_rodapie ? Number(row.ml_rodapie).toFixed(2) : '-'} <span className="text-xs text-muted-foreground ml-0.5">ml</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>
      </div>

      <MedicionCreateModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}