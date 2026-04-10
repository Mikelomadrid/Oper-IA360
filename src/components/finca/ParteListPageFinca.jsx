import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Search, RefreshCw, Loader2, Wrench, PieChart
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import ParteFormFinca from './ParteFormFinca';
import PartesStatisticsFinca from './PartesStatisticsFinca';

/**
 * ParteListPageFinca
 * Listado de Partes de Trabajo para Finca Admin.
 * Usa tabla 'finca_partes_trabajo'.
 */
export default function ParteListPageFinca() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const [partes, setPartes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [currentUserEmployeeId, setCurrentUserEmployeeId] = useState(null);
  
  // Statistics state
  const [showStats, setShowStats] = useState(() => {
    return localStorage.getItem('showPartesStatsFinca') === 'true';
  });
  const [statsPartes, setStatsPartes] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);
  
  // Filters state
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get('priority') || 'all');
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (statusFilter !== 'all') params.status = statusFilter;
    if (priorityFilter !== 'all') params.priority = priorityFilter;
    setSearchParams(params, { replace: true });
  }, [search, statusFilter, priorityFilter, setSearchParams]);

  // Fetch Employee ID for current user
  useEffect(() => {
    const fetchEmp = async () => {
      if (!user) return;
      const { data } = await supabase.from('empleados').select('id').eq('auth_user_id', user.id).single();
      if (data) setCurrentUserEmployeeId(data.id);
    };
    fetchEmp();
  }, [user]);

  const fetchPartes = async () => {
    if (!user || !currentUserEmployeeId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('finca_partes_trabajo')
        .select('*')
        .eq('created_by', currentUserEmployeeId)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.ilike('titulo', `%${search}%`);
      }
      if (statusFilter !== 'all') {
        query = query.eq('estado', statusFilter.toLowerCase());
      }
      if (priorityFilter !== 'all') {
        query = query.eq('prioridad', priorityFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setPartes(data || []);
    } catch (error) {
      console.error('Error fetching partes:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los partes de trabajo.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchStatsPartes = async () => {
    if (!user || !currentUserEmployeeId) return;
    setLoadingStats(true);
    try {
      const { data, error } = await supabase
        .from('finca_partes_trabajo')
        .select('*')
        .eq('created_by', currentUserEmployeeId);
        
      if (error) throw error;
      setStatsPartes(data || []);
    } catch (error) {
      console.error('Error fetching stats partes:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchProjects = async () => {
      const { data } = await supabase.from('proyectos').select('id, nombre_proyecto').order('nombre_proyecto');
      setProjects(data || []);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (currentUserEmployeeId) {
        fetchPartes();
    }
  }, [currentUserEmployeeId, search, statusFilter, priorityFilter]); 

  useEffect(() => {
    localStorage.setItem('showPartesStatsFinca', showStats);
    if (showStats && currentUserEmployeeId) {
        fetchStatsPartes();
    }
  }, [showStats, currentUserEmployeeId]);

  const handleCreate = async (formData) => {
    if (!currentUserEmployeeId) return;
    setIsSubmitting(true);
    try {
        const { error } = await supabase.from('finca_partes_trabajo').insert([{
            ...formData,
            estado: formData.estado ? formData.estado.toLowerCase() : 'contactado',
            created_by: currentUserEmployeeId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }]);

        if (error) throw error;

        toast({ title: "Parte creado", description: "El parte de trabajo se ha registrado correctamente." });
        setIsCreateOpen(false);
        fetchPartes(); 
        if (showStats) fetchStatsPartes(); 
    } catch (error) {
        console.error(error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo crear el parte." });
    } finally {
        setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = status ? status.toLowerCase() : 'desconocido';
    const map = {
        contactado: "bg-blue-100 text-blue-800 border-blue-200",
        agendada_visita: "bg-indigo-100 text-indigo-800 border-indigo-200",
        visitado: "bg-purple-100 text-purple-800 border-purple-200",
        en_preparacion: "bg-amber-100 text-amber-800 border-amber-200",
        presupuestado: "bg-orange-100 text-orange-800 border-orange-200",
        aceptado: "bg-emerald-100 text-emerald-800 border-emerald-200",
    };
    
    const label = s.replace(/_/g, ' ').toUpperCase();
    const className = map[s] || "bg-gray-100 text-gray-800 border-gray-200";
    
    return <Badge variant="outline" className={className}>{label}</Badge>;
  };

  const getPriorityBadge = (priority) => {
      const map = {
          baja: "bg-gray-50 text-gray-600 border-gray-200",
          media: "bg-orange-50 text-orange-600 border-orange-200",
          alta: "bg-red-50 text-red-600 border-red-200",
      };
      return <Badge variant="outline" className={map[priority]}>{priority}</Badge>;
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Wrench className="h-8 w-8 text-primary" />
            Gestión de Partes
          </h1>
          <p className="text-muted-foreground">Administra partes de trabajo e incidencias de propiedades.</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex items-center space-x-2 bg-card p-2 rounded-md border shadow-sm">
                <Switch 
                    id="show-stats-partes" 
                    checked={showStats} 
                    onCheckedChange={setShowStats} 
                />
                <Label htmlFor="show-stats-partes" className="text-sm cursor-pointer flex items-center gap-1">
                    <PieChart className="h-4 w-4" />
                    <span className="hidden sm:inline">Estadísticas</span>
                </Label>
            </div>
            <Button onClick={() => setIsCreateOpen(true)} className="flex-1 md:flex-none">
              <Plus className="mr-2 h-4 w-4" /> Nuevo Parte
            </Button>
        </div>
      </div>

      {showStats && (
          <PartesStatisticsFinca partes={statsPartes} />
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-lg border shadow-sm items-center">
        <div className="flex-1 relative w-full">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por título..." 
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="contactado">CONTACTADO</SelectItem>
                    <SelectItem value="agendada_visita">AGENDADA VISITA</SelectItem>
                    <SelectItem value="visitado">VISITADO</SelectItem>
                    <SelectItem value="en_preparacion">EN PREPARACION</SelectItem>
                    <SelectItem value="presupuestado">PRESUPUESTADO</SelectItem>
                    <SelectItem value="aceptado">ACEPTADO</SelectItem>
                </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Prioridad" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => { fetchPartes(); if(showStats) fetchStatsPartes(); }}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
        </div>
      </div>

      {/* List */}
      {loading && partes.length === 0 ? (
          <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : partes.length === 0 ? (
          <div className="text-center p-12 border-2 border-dashed rounded-lg bg-muted/10">
              <p className="text-muted-foreground">No se encontraron partes de trabajo.</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-500">
              {partes.map((parte) => {
                  const project = projects.find(p => p.id === parte.propiedad_id);
                  const projectName = project ? project.nombre_proyecto : null;

                  return (
                    <Card key={parte.id} className="hover:shadow-md transition-all cursor-pointer border-l-4 border-l-transparent hover:border-l-primary group" onClick={() => navigate(`/gestion/partes-finca/detail/${parte.id}`)}>
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                {getStatusBadge(parte.estado)}
                                {getPriorityBadge(parte.prioridad)}
                            </div>
                            <CardTitle className="text-lg pt-2 line-clamp-1 group-hover:text-primary transition-colors">{parte.titulo}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm text-muted-foreground space-y-1">
                                {projectName && (
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-foreground">Propiedad:</span> {projectName}
                                    </div>
                                )}
                                {parte.fecha_seguimiento && (
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-foreground">Seguimiento:</span> {format(new Date(parte.fecha_seguimiento), 'dd/MM/yyyy')}
                                    </div>
                                )}
                                <div className="pt-2 text-xs opacity-70">
                                    Creado: {format(new Date(parte.created_at), 'dd MMM yyyy', { locale: es })}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                  );
              })}
          </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Parte</DialogTitle>
          </DialogHeader>
          <ParteFormFinca onSubmit={handleCreate} isSubmitting={isSubmitting} projects={projects} />
        </DialogContent>
      </Dialog>
    </div>
  );
}