import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, RefreshCw, PlusCircle, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ObrasProcesosList from '@/components/ObrasProcesosList';
import ProjectForm from '@/components/ProjectForm';

const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
};

const ObrasSafe = () => {
    const { toast } = useToast();
    const { sessionRole } = useAuth();
    const [obras, setObras] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);

    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    // Check permissions
    const canCreate = ['admin', 'encargado'].includes(sessionRole?.rol);

    const fetchObras = useCallback(async () => {
        setLoading(true);

        // Fetch from v_obras_procesos_tablero_v2 to get the process data
        let query = supabase
            .from('v_obras_procesos_tablero_v2')
            .select('*')
            .order('fecha_inicio', { ascending: false, nulls: 'last' });

        if (debouncedSearchTerm) {
            query = query.ilike('nombre', `%${debouncedSearchTerm}%`);
        }

        const { data, error } = await query;
        if (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error cargando obras', description: error.message });
        } else {
            setObras(data || []);
        }
        setLoading(false);
    }, [debouncedSearchTerm, toast]);

    useEffect(() => {
        fetchObras();
    }, [fetchObras]);

    // Al guardar desde ProjectForm: cerrar modal y refrescar la lista.
    const handleCreated = () => {
        setCreateModalOpen(false);
        fetchObras();
    };

    return (
        <>
            <Helmet>
                <title>Gestión de Obras y Procesos</title>
                <meta name="description" content="Gestión de obras y proyectos con seguimiento de procesos." />
            </Helmet>
            <div className="space-y-6 p-4 md:p-8 min-h-screen bg-slate-50/50 dark:bg-slate-950/50">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight">Obras y Procesos</h1>
                        <p className="text-muted-foreground mt-1">Supervisión en tiempo real de proyectos y ejecuciones.</p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <Button variant="outline" size="sm" onClick={() => fetchObras()} disabled={loading} className="flex-1 md:flex-none">
                            {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                            Actualizar
                        </Button>
                        {canCreate && (
                            <Button size="sm" onClick={() => setCreateModalOpen(true)} className="flex-1 md:flex-none bg-primary hover:bg-primary/90 shadow-sm">
                                <PlusCircle className="mr-2 h-3 w-3" />
                                Nueva Obra
                            </Button>
                        )}
                    </div>
                </div>

                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar obra por nombre..."
                        className="pl-9 h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* New Card List Component */}
                <ObrasProcesosList obras={obras} loading={loading} />

                {/* Create Modal -> usa el formulario completo (con cliente obligatorio) */}
                <Dialog open={isCreateModalOpen} onOpenChange={setCreateModalOpen}>
                    <DialogContent className="sm:max-w-[725px] p-0 overflow-hidden rounded-xl">
                        <DialogHeader className="px-6 pt-6 pb-2">
                            <DialogTitle>Crear Nueva Obra</DialogTitle>
                            <DialogDescription>Registra una nueva obra en el sistema.</DialogDescription>
                        </DialogHeader>
                        <div className="px-6 pb-6 max-h-[80vh] overflow-y-auto">
                            <ProjectForm
                                project={null}
                                onSave={handleCreated}
                                onCancel={() => setCreateModalOpen(false)}
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
};

export default ObrasSafe;
