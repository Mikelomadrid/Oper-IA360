import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, FileText, Construction, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDebounce } from '@/hooks/useDebounce';
import { AsyncSearchableSelector } from './AsyncSearchableSelector';

const ProjectSelectionForCertificate = ({ navigate }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 350);
  
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedProjectLabel, setSelectedProjectLabel] = useState('');

  // Fetch projects for the main table list, ONLY ACTIVE ONES
  const fetchProjects = useCallback(async (searchQuery = '') => {
    setLoading(true);
    let query = supabase
      .from('proyectos')
      .select(`id, nombre_proyecto, estado, fecha_creacion, cliente:clientes(nombre)`)
      .eq('estado', 'activo') // Filter for active projects
      .order('fecha_creacion', { ascending: false });

    if (searchQuery) {
      query = query.ilike('nombre_proyecto', `%${searchQuery}%`);
    }

    const { data, error } = await query;

    if (error) {
      toast({ variant: 'destructive', title: 'Error al cargar los proyectos', description: error.message });
      setProjects([]);
    } else if (data) {
      setProjects(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects(debouncedSearchTerm);
  }, [debouncedSearchTerm, fetchProjects]);

  const handleSelectProject = (projectId, projectName) => {
    setSelectedProjectId(projectId);
    setSelectedProjectLabel(projectName);
  };

  const handleGenerateCertificate = () => {
    if (selectedProjectId) {
      navigate(`/gestion/obras/${selectedProjectId}/acta-final`);
    } else {
      toast({ variant: 'destructive', title: 'Selección requerida', description: 'Por favor, selecciona un proyecto para generar el acta.' });
    }
  };

  // Fetcher for the AsyncSearchableSelector, ONLY ACTIVE PROJECTS
  const fetchProjectsForSelector = useCallback(async (text) => {
    let query = supabase
        .from('proyectos')
        .select(`id, nombre_proyecto`)
        .eq('estado', 'activo') // Filter for active projects
        .order('nombre_proyecto');

    if (text) {
        query = query.ilike('nombre_proyecto', `%${text}%`);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching projects:", error);
        return [];
    }

    return data.map(project => ({
        value: project.id,
        label: project.nombre_proyecto
    }));
  }, []);

  return (
    <div className="p-3 md:p-8 space-y-6 max-w-6xl mx-auto">
      <Helmet>
        <title>Acta de Finalización | OrkaRefor ERP</title>
        <meta name="description" content="Generador de Acta de Finalización de Obra." />
      </Helmet>

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate('/gestion/obras')}>
                <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Acta de Finalización de Obra</h1>
                <p className="text-sm text-muted-foreground">Selecciona un proyecto para generar su acta de finalización.</p>
            </div>
        </div>
      </motion.div>

      {/* New Select-based UI */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-card p-6 rounded-lg border shadow-sm">
        <div className="w-full sm:flex-1 space-y-1">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Buscar Proyecto (Select)
            </label>
            <AsyncSearchableSelector
                fetcher={fetchProjectsForSelector}
                value={selectedProjectId}
                onSelect={(value, label) => handleSelectProject(value, label)}
                placeholder="Buscar y seleccionar proyecto..."
                searchPlaceholder="Escribe para filtrar proyectos..."
                initialLabel={selectedProjectLabel}
            />
        </div>
        <div className="sm:self-end">
            <Button 
              onClick={handleGenerateCertificate} 
              disabled={!selectedProjectId} 
              className="w-full sm:w-auto min-w-[200px]"
            >
              <FileText className="mr-2 h-4 w-4" /> Generar Acta
            </Button>
        </div>
      </div>

      {/* List View for quick selection */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="rounded-md border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Proyecto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha Creación</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    <div className="flex flex-col items-center gap-2">
                        <Construction className="h-10 w-10 text-muted-foreground/40" />
                        <p>No se encontraron proyectos activos.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((project) => (
                  <TableRow 
                    key={project.id} 
                    className={`cursor-pointer transition-colors ${selectedProjectId === project.id ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'}`}
                    onClick={() => handleSelectProject(project.id, project.nombre_proyecto)}
                  >
                    <TableCell className="font-medium">{project.nombre_proyecto}</TableCell>
                    <TableCell>{project.cliente?.nombre || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {project.estado === 'en_curso' ? 'Activo' : project.estado}
                      </Badge>
                    </TableCell>
                    <TableCell>{project.fecha_creacion ? format(parseISO(project.fecha_creacion), 'dd/MM/yyyy', { locale: es }) : 'N/A'}</TableCell>
                    <TableCell>
                        {selectedProjectId === project.id && <CheckCircle2 className="h-5 w-5 text-primary" />}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </motion.div>
      )}
    </div>
  );
};

export default ProjectSelectionForCertificate;