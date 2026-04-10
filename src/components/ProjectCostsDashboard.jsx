import React, { useState, useEffect, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { supabase } from '@/lib/customSupabaseClient';
    import { toast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
    import { Label } from '@/components/ui/label';
    import { Badge } from '@/components/ui/badge';
    import { FileText, PlusCircle, Search, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, AlertTriangle, Eye } from 'lucide-react';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    };
    
    const AddExpenseModal = ({ isOpen, onOpenChange, onExpenseAdded, projectId, projectName }) => {
        const initialFormState = {
            proveedor_id: null,
            numero_factura: '',
            fecha_emision: new Date().toISOString().split('T')[0],
            fecha_vencimiento: '',
            monto_bruto: '',
            iva: 0.21,
            concepto: ''
        };
        const [formData, setFormData] = useState(initialFormState);
        const [isSubmitting, setIsSubmitting] = useState(false);
        const [providers, setProviders] = useState([]);
        
        useEffect(() => {
            const fetchProviders = async () => {
                const { data, error } = await supabase.from('proveedores').select('id, nombre');
                if (!error) setProviders(data);
            };
            if (isOpen) {
              fetchProviders();
            }
        }, [isOpen]);

        const handleSubmit = async (e) => {
            e.preventDefault();
            
            if (formData.monto_bruto <= 0) {
                toast({ variant: 'destructive', title: 'Error de validación', description: 'El monto bruto debe ser mayor que 0.'});
                return;
            }

            setIsSubmitting(true);
            const total_con_iva = parseFloat(formData.monto_bruto) * (1 + parseFloat(formData.iva));
            
            const { error } = await supabase.from('gastos').insert([{
                ...formData,
                proyecto_id: projectId,
                monto_bruto: parseFloat(formData.monto_bruto),
                iva: parseFloat(formData.iva),
                total_con_iva: total_con_iva,
                estado_pago: 'pendiente', 
            }]);

            if (error) {
                toast({ variant: 'destructive', title: 'Error al añadir gasto', description: error.message });
            } else {
                toast({ title: '¡Éxito!', description: 'Nuevo gasto añadido correctamente.' });
                setFormData(initialFormState);
                onExpenseAdded();
                onOpenChange(false);
            }
            setIsSubmitting(false);
        };

        return (
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[625px]">
                    <DialogHeader>
                        <DialogTitle>Nuevo Gasto para: {projectName}</DialogTitle>
                        <DialogDescription>Añade una nueva factura de gasto para este proyecto.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="proveedor_id">Proveedor</Label>
                                <select id="proveedor_id" name="proveedor_id" value={formData.proveedor_id || ''} onChange={(e) => setFormData({...formData, proveedor_id: e.target.value})} required className="w-full mt-1 flex h-10 rounded-md border border-input bg-gray-700 text-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                    <option value="" disabled>Selecciona un proveedor</option>
                                    {providers.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                </select>
                            </div>
                            <div><Label htmlFor="numero_factura">Nº Factura</Label><Input id="numero_factura" name="numero_factura" value={formData.numero_factura} onChange={(e) => setFormData({...formData, numero_factura: e.target.value})} required /></div>
                            <div><Label htmlFor="monto_bruto">Monto Bruto (€)</Label><Input id="monto_bruto" name="monto_bruto" type="number" step="0.01" value={formData.monto_bruto} onChange={(e) => setFormData({...formData, monto_bruto: e.target.value})} required /></div>
                            <div><Label htmlFor="iva">IVA</Label><Input id="iva" name="iva" type="number" step="0.01" min="0" max="1" value={formData.iva} onChange={(e) => setFormData({...formData, iva: e.target.value})} required /></div>
                            <div><Label htmlFor="fecha_emision">Fecha Emisión</Label><Input id="fecha_emision" name="fecha_emision" type="date" value={formData.fecha_emision} onChange={(e) => setFormData({...formData, fecha_emision: e.target.value})} required /></div>
                            <div><Label htmlFor="fecha_vencimiento">Fecha Vencimiento</Label><Input id="fecha_vencimiento" name="fecha_vencimiento" type="date" value={formData.fecha_vencimiento} onChange={(e) => setFormData({...formData, fecha_vencimiento: e.target.value})} /></div>
                             <div className="md:col-span-2"><Label htmlFor="concepto">Concepto</Label><Input id="concepto" name="concepto" value={formData.concepto} onChange={(e) => setFormData({...formData, concepto: e.target.value})} /></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Guardar Gasto'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        );
    };

    const ProjectCostsDashboard = () => {
        const { userRole } = useAuth();
        const [projects, setProjects] = useState([]);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);
        const [filter, setFilter] = useState('');
        const [statusFilter, setStatusFilter] = useState('all');
        const [page, setPage] = useState(0);
        const [totalCount, setTotalCount] = useState(0);
        const [isModalOpen, setIsModalOpen] = useState(false);
        const [selectedProject, setSelectedProject] = useState(null);

        const ITEMS_PER_PAGE = 20;

        const fetchData = useCallback(async () => {
            setLoading(true);

            let query = supabase.from('v_proyectos_costes_y_pagos').select('*', { count: 'exact' });

            if (filter) {
                query = query.ilike('nombre_proyecto', `%${filter}%`);
            }
            
            if (statusFilter !== 'all') {
                query = query.gt(statusFilter, 0);
            }

            const from = page * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;
            
            query = query.range(from, to).order('total_con_iva', { ascending: false, nullsFirst: false });

            const { data, error: queryError, count } = await query;
            
            if (queryError) {
                setError(queryError.message);
                toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el resumen de proyectos.' });
                setProjects([]);
            } else {
                setProjects(data);
                setTotalCount(count);
                setError(null);
            }
            setLoading(false);
        }, [filter, statusFilter, page]);

        useEffect(() => {
            fetchData();
        }, [fetchData]);
        
        const openAddExpenseModal = (project) => {
            setSelectedProject(project);
            setIsModalOpen(true);
        };

        const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

        if (userRole !== 'admin' && userRole !== 'encargado') {
             return (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <AlertTriangle className="w-16 h-16 text-yellow-400 mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Acceso Denegado</h2>
                    <p className="text-gray-400">No tienes permisos para ver este resumen financiero.</p>
                </div>
            );
        }

        return (
            <div className="p-4 md:p-8">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="flex justify-between items-start mb-8 flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                            <FileText className="w-8 h-8 text-purple-400" />
                            <h1 className="text-3xl md:text-4xl font-bold gradient-text">Resumen Proyectos (Costes y Pagos)</h1>
                        </div>
                        <div className="flex gap-2 items-center flex-wrap">
                            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"/><Input placeholder="Filtrar por nombre..." value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }} className="pl-10 w-full sm:w-64"/></div>
                             <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }} className="w-full sm:w-auto h-10 rounded-md border border-input bg-gray-700 text-white px-3 py-2 text-sm">
                                <option value="all">Todos los estados</option>
                                <option value="pendientes">Con Pendientes</option>
                                <option value="parciales">Con Parciales</option>
                                <option value="pagadas">Pagadas</option>
                                <option value="vencidas">Con Vencidas</option>
                            </select>
                        </div>
                    </div>
                    
                    {selectedProject && <AddExpenseModal isOpen={isModalOpen} onOpenChange={setIsModalOpen} onExpenseAdded={fetchData} projectId={selectedProject.proyecto_id} projectName={selectedProject.nombre_proyecto} />}
                    
                    {loading ? (
                         <div className="text-center py-10">Cargando datos de proyectos...</div>
                    ) : error ? (
                        <div className="bg-red-500/20 text-red-300 p-4 rounded-lg text-center">{error}</div>
                    ) : projects.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">No se encontraron proyectos con los filtros actuales.</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {projects.map((p, i) => (
                                <motion.div key={p.proyecto_id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="glass-effect rounded-2xl border border-white/10 flex flex-col justify-between">
                                    <div className="p-6">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h2 className="text-xl font-bold text-white mb-1">{p.nombre_proyecto}</h2>
                                                <p className="text-sm text-gray-400">Facturas: {p.num_facturas || 0}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                {p.pendientes > 0 && <Badge variant="warning">Pendientes: {p.pendientes}</Badge>}
                                                {p.parciales > 0 && <Badge variant="info">Parciales: {p.parciales}</Badge>}
                                                {p.pagadas > 0 && <Badge variant="success">Pagadas: {p.pagadas}</Badge>}
                                                {p.vencidas > 0 && <Badge variant="destructive">Vencidas: {p.vencidas}</Badge>}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 mt-6 text-center">
                                            <div><p className="text-sm text-gray-400">Coste base (sin IVA)</p><p className="text-2xl font-semibold text-white">{formatCurrency(p.coste_base_imponible)}</p></div>
                                            <div><p className="text-sm text-gray-400">Total con IVA</p><p className="text-2xl font-semibold text-purple-400">{formatCurrency(p.total_con_iva)}</p></div>
                                        </div>
                                    </div>
                                    <div className="bg-white/5 p-4 flex gap-2 border-t border-white/10 rounded-b-2xl">
                                        <Button variant="outline" className="w-full" onClick={() => toast({ title: '🚧 No implementado', description: "Esta función estará disponible pronto. Puedes pedirla en tu próximo prompt. 🚀" })}><Eye className="mr-2 h-4 w-4"/>Ver Gastos</Button>
                                        <Button className="w-full" onClick={() => openAddExpenseModal(p)}><PlusCircle className="mr-2 h-4 w-4"/>Nuevo Gasto</Button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}

                    {totalCount > ITEMS_PER_PAGE && (
                        <div className="flex items-center justify-between mt-8 text-sm text-gray-400">
                           <p>Página {page + 1} de {totalPages}</p>
                           <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={() => setPage(0)} disabled={page === 0}><ChevronsLeft className="h-4 w-4"/></Button>
                                <Button variant="outline" size="icon" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}><ChevronLeft className="h-4 w-4"/></Button>
                                <Button variant="outline" size="icon" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}><ChevronRight className="h-4 w-4"/></Button>
                                <Button variant="outline" size="icon" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}><ChevronsRight className="h-4 w-4"/></Button>
                           </div>
                           <p>Total de proyectos: {totalCount}</p>
                        </div>
                    )}
                </motion.div>
            </div>
        )
    };

    export default ProjectCostsDashboard;