import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, RefreshCw, PlusCircle, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext'; 
import ObrasProcesosList from '@/components/ObrasProcesosList';

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
    const [newObra, setNewObra] = useState({ nombre: '', descripcion: '', presupuesto: '', estado: 'activo' });

    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    // Check permissions
    const canCreate = ['admin', 'encargado'].includes(sessionRole?.rol);

    const fetchObras = useCallback(async () => {
        setLoading(true);

        // Fetch from v_obras_procesos_tablero_v2 to get the process data
        let query = supabase
            .from('v_obras_procesos_tablero_v2')
            .select('*')
            .order('fecha_inicio', { ascending: false, nulls: 'last' }); // Assuming fecha_inicio is a good sort
        
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
    
    const createMutation = async (newObra) => {
        const { error } = await supabase.rpc('proyecto_create_v1', {
            p_nombre: newObra.nombre,
            p_descripcion: newObra.descripcion || null,
            p_presupuesto: Number(newObra.presupuesto) || 0,
            p_estado: newObra.estado || 'activo',
        });
        if (error) throw error;
    };

    const handleCreateSubmit = async () => {
        if (!newObra.nombre.trim()) {
            toast({ variant: 'destructive', title: 'El nombre es requerido' });
            return;
        }
        try {
            await createMutation(newObra);
            toast({ title: '¡Obra creada!', description: 'La nueva obra ha sido registrada.' });
            setCreateModalOpen(false);
            setNewObra({ nombre: '', descripcion: '', presupuesto: '', estado: 'activo' });
            fetchObras();
        } catch(err) {
            toast({ variant: 'destructive', title: 'Error creando la obra', description: err.message });
        }
    };

    const estadoOptions = ['activo', 'pendiente', 'en curso', 'facturado', 'completada'];

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

                {/* Create Modal */}
                <Dialog open={isCreateModalOpen} onOpenChange={setCreateModalOpen}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Crear Nueva Obra</DialogTitle>
                            <DialogDescription>Rellena los datos para registrar un nuevo proyecto.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                             <div className="grid gap-2">
                                <Label htmlFor="nombre">Nombre*</Label>
                                <Input id="nombre" value={newObra.nombre} onChange={(e) => setNewObra({ ...newObra, nombre: e.target.value })} placeholder="Ej: Reforma Baño Principal" />
                            </div>
                             <div className="grid gap-2">
                                <Label htmlFor="descripcion">Descripción</Label>
                                <Textarea id="descripcion" value={newObra.descripcion} onChange={(e) => setNewObra({ ...newObra, descripcion: e.target.value })} placeholder="Detalles de la obra..." rows={3} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="presupuesto">Presupuesto (€)</Label>
                                <Input id="presupuesto" type="number" value={newObra.presupuesto} onChange={(e) => setNewObra({ ...newObra, presupuesto: e.target.value })} placeholder="0.00" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="estado">Estado</Label>
                                <Select value={newObra.estado} onValueChange={(value) => setNewObra({ ...newObra, estado: value })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {estadoOptions.map(opt => <SelectItem key={opt} value={opt} className="capitalize">{opt}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleCreateSubmit} disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Crear Obra
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
};

export default ObrasSafe;