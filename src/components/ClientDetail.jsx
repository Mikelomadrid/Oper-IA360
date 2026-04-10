import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeft, Loader2, User, Mail, Phone, MapPin, Briefcase, Euro, TrendingUp, ChevronRight, Pencil, Trash2, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ClientForm } from './Clients';

const formatCurrency = (value) => {
    if (value === undefined || value === null) return '0,00 €';
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
};

const formatPercent = (value) => {
    if (value === undefined || value === null) return '0.0%';
    return `${Number(value).toFixed(1)}%`;
};

const statusColors = {
    activo: 'bg-green-500/20 text-green-700 border-green-500/30',
    en_espera: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
    terminado: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
    facturado: 'bg-purple-500/20 text-purple-700 border-purple-500/30',
    cobrado: 'bg-green-500/20 text-green-700 border-green-500/30',
    garantia: 'bg-gray-500/20 text-gray-700 border-gray-500/30',
    default: 'bg-gray-200 text-gray-800'
};

const KpiCard = ({ title, value, icon, isLoading }) => (
    <Card className="bg-card/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="h-8 bg-muted rounded animate-pulse w-3/4"></div>
            ) : (
                <div className="text-2xl font-bold">{value}</div>
            )}
        </CardContent>
    </Card>
);

const ClientDetail = ({ clientId, navigate }) => {
    const { sessionRole } = useAuth();
    const [client, setClient] = useState(null);
    const [projects, setProjects] = useState([]);
    const [kpis, setKpis] = useState({ projectCount: 0, totalRevenue: 0, totalMargin: 0 });
    const [loading, setLoading] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const canEdit = ['admin', 'encargado'].includes(sessionRole?.rol);

    const fetchClientData = useCallback(async () => {
        setLoading(true);
        
        // 1. Fetch Client Basic Info
        const { data: clientData, error: clientError } = await supabase
            .from('clientes')
            .select('*')
            .eq('id', clientId)
            .single();

        if (clientError) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el cliente.' });
            setClient(null);
            setLoading(false);
            return;
        }
        setClient(clientData);

        // 2. Fetch Projects Info (Base Table)
        const { data: projectsData, error: projectsError } = await supabase
            .from('proyectos')
            .select('id, nombre_proyecto, estado, presupuesto_aceptado')
            .eq('cliente_id', clientId)
            .order('fecha_creacion', { ascending: false });
        
        if (projectsError) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los proyectos del cliente.' });
            setLoading(false);
            return;
        }

        if (projectsData && projectsData.length > 0) {
            // 3. Fetch Real KPIs (Costes y Margen) from View
            const projectIds = projectsData.map(p => p.id);
            const { data: kpisData, error: kpisError } = await supabase
                .from('v_proyecto_kpis')
                .select('proyecto_id, costo_total, margen, rentabilidad_real_pct')
                .in('proyecto_id', projectIds);

            if (kpisError) {
                console.error("Error fetching KPIs", kpisError);
            }

            // 4. Merge Data
            const mergedProjects = projectsData.map(p => {
                const kpi = kpisData?.find(k => k.proyecto_id === p.id) || {};
                return {
                    proyecto_id: p.id,
                    nombre_proyecto: p.nombre_proyecto,
                    estado: p.estado,
                    // Revenue = Presupuesto Aceptado (Ingresos)
                    total_ingresos: p.presupuesto_aceptado || 0,
                    // Costs = Coste Total (Materiales + Mano de Obra)
                    total_costes: kpi.costo_total || 0,
                    // Margin = Beneficio
                    margen: kpi.margen || 0,
                    rentabilidad_pct: kpi.rentabilidad_real_pct || 0
                };
            });

            setProjects(mergedProjects);

            // 5. Calculate Client Totals
            const projectCount = mergedProjects.length;
            const totalRevenue = mergedProjects.reduce((sum, p) => sum + p.total_ingresos, 0);
            const totalMargin = mergedProjects.reduce((sum, p) => sum + p.margen, 0);
            setKpis({ projectCount, totalRevenue, totalMargin });

        } else {
            setProjects([]);
            setKpis({ projectCount: 0, totalRevenue: 0, totalMargin: 0 });
        }

        setLoading(false);
    }, [clientId]);

    useEffect(() => {
        fetchClientData();
    }, [fetchClientData]);

    const handleEdit = () => {
        if (!canEdit) {
            toast({ variant: 'destructive', title: 'No autorizado', description: 'No tienes permisos para editar clientes.' });
            return;
        }
        setIsEditModalOpen(true);
    };

    const handleUpdateClient = async (formData) => {
        const { data, error } = await supabase
            .from('clientes')
            .update(formData)
            .eq('id', client.id)
            .select()
            .single();

        if (error) {
            let description = error.message;
            if (error.code === '23505') {
                description = 'El CIF/NIF ya existe para otro cliente.';
            }
            toast({
                title: 'Error al actualizar cliente',
                description,
                variant: 'destructive'
            });
        } else {
            toast({
                title: 'Cliente actualizado',
                description: `${data.nombre} ha sido actualizado correctamente.`,
                className: "bg-green-50 border-green-200"
            });
            setClient(data); // Optimistic update / update local state
            setIsEditModalOpen(false);
        }
    };

    const handleDelete = async () => {
        if (!canEdit) {
            toast({ variant: 'destructive', title: 'No autorizado', description: 'No tienes permisos para eliminar clientes.' });
            return;
        }
        
        // Simple confirmation before delete
        if (!window.confirm("¿Estás seguro de eliminar este cliente? Esta acción no se puede deshacer.")) {
            return;
        }

        const { error } = await supabase
            .from('clientes')
            .delete()
            .eq('id', clientId);

        if (error) {
            toast({
                title: 'Error al eliminar cliente',
                description: "Es posible que el cliente tenga proyectos asociados.",
                variant: 'destructive'
            });
        } else {
            toast({
                title: 'Cliente eliminado',
                description: 'El cliente ha sido eliminado correctamente.'
            });
            navigate('/crm/clientes');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!client) {
        return (
            <div className="p-8 text-center">
                <p className="text-xl text-destructive">Cliente no encontrado.</p>
                <Button onClick={() => navigate('/crm/clientes')} className="mt-4">Volver a Clientes</Button>
            </div>
        );
    }

    const fullAddress = [client.calle_numero, client.municipio, client.provincia, client.codigo_postal].filter(Boolean).join(', ');

    return (
        <div className="p-4 md:p-8 space-y-6">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{client.nombre ? client.nombre.toUpperCase() : ''}</h1>
                            <p className="text-muted-foreground">CIF/NIF: {client.cif || 'No especificado'}</p>
                        </div>
                    </div>
                    {canEdit && (
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleEdit}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Editar
                            </Button>
                            <Button variant="destructive" size="sm" onClick={handleDelete}>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Eliminar
                            </Button>
                        </div>
                    )}
                </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <div className="grid gap-4 md:grid-cols-3">
                    <KpiCard title="Proyectos" value={kpis.projectCount} icon={<Briefcase className="h-4 w-4 text-muted-foreground" />} isLoading={loading} />
                    <KpiCard title="Ingresos Totales (Presupuestado)" value={formatCurrency(kpis.totalRevenue)} icon={<Euro className="h-4 w-4 text-muted-foreground" />} isLoading={loading} />
                    <KpiCard title="Margen Total" value={formatCurrency(kpis.totalMargin)} icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />} isLoading={loading} />
                </div>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
                <motion.div className="md:col-span-1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Datos de Contacto</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="flex items-start">
                                <User className="w-4 h-4 mr-3 mt-1 text-muted-foreground" />
                                <div className="flex flex-col">
                                    <span className="font-semibold text-foreground">Nombre / Razón Social</span>
                                    <span>{client.nombre || 'No especificado'}</span>
                                </div>
                            </div>
                            
                            {(client.contacto || client.nombre_contacto || client.persona_contacto) && (
                                <div className="flex items-start">
                                    <User className="w-4 h-4 mr-3 mt-1 text-muted-foreground" />
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-foreground">Persona de Contacto</span>
                                        <span>{client.contacto || client.nombre_contacto || client.persona_contacto}</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-start">
                                <Mail className="w-4 h-4 mr-3 mt-1 text-muted-foreground" />
                                <div className="flex flex-col">
                                    <span className="font-semibold text-foreground">Email</span>
                                    {client.email ? <a href={`mailto:${client.email}`} className="text-primary hover:underline">{client.email}</a> : 'No especificado'}
                                </div>
                            </div>
                            <div className="flex items-start">
                                <Phone className="w-4 h-4 mr-3 mt-1 text-muted-foreground" />
                                <div className="flex flex-col">
                                    <span className="font-semibold text-foreground">Teléfono</span>
                                    {client.telefono ? <a href={`tel:${client.telefono}`} className="text-primary hover:underline">{client.telefono}</a> : 'No especificado'}
                                </div>
                            </div>
                            <div className="flex items-start">
                                <MapPin className="w-4 h-4 mr-3 mt-1 text-muted-foreground" />
                                <div className="flex flex-col">
                                    <span className="font-semibold text-foreground">Dirección</span>
                                    <span>{fullAddress || 'No especificada'}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div className="md:col-span-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Proyectos Asociados</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Proyecto</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead className="text-right">Presupuesto / Gastos</TableHead>
                                            <TableHead className="text-right">Beneficio</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow><TableCell colSpan="5" className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                                        ) : projects.length > 0 ? (
                                            projects.map(project => (
                                                <TableRow key={project.proyecto_id} onClick={() => navigate(`/gestion/obras/${project.proyecto_id}`)} className="cursor-pointer hover:bg-muted/50">
                                                    <TableCell className="font-medium">{project.nombre_proyecto}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={`${statusColors[project.estado] || statusColors.default} capitalize`}>
                                                            {project.estado.replace(/_/g, ' ')}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex flex-col items-end gap-0.5">
                                                            <span className="font-bold text-foreground" title="Presupuesto Aceptado">{formatCurrency(project.total_ingresos)}</span>
                                                            <span className="text-xs text-muted-foreground" title="Gastos Totales">
                                                                {formatCurrency(project.total_costes)}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex flex-col items-end gap-0.5">
                                                            <span className={`font-bold ${project.margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {formatCurrency(project.margen)}
                                                            </span>
                                                            <span className={`text-xs ${project.rentabilidad_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {formatPercent(project.rentabilidad_pct)}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan="5" className="text-center h-24 text-muted-foreground">No hay proyectos para este cliente.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl flex items-center gap-2">
                            <Building2 className="h-6 w-6 text-primary" />
                            Editar Cliente
                        </DialogTitle>
                        <DialogDescription>
                            Modifica los datos del cliente seleccionado.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <ClientForm
                            client={client}
                            onSave={handleUpdateClient}
                            onCancel={() => setIsEditModalOpen(false)}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ClientDetail;