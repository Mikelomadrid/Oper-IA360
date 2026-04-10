import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, ServerCrash, Wrench, CheckCircle, XCircle, Search } from 'lucide-react';
import { fmtMadrid } from '@/lib/utils';
import ToolRequestApprovalModal from '@/components/ToolRequestApprovalModal';

const ToolRequestsView = () => {
    const { sessionRole, fetchPendingRequestsCount } = useAuth();
    const [requests, setRequests] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);

    const canManage = useMemo(() => ['admin', 'encargado'].includes(sessionRole.rol), [sessionRole.rol]);

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase
                .from('tool_requests')
                .select(`
                    id,
                    tecnico_id,
                    empleados!tool_requests_tecnico_id_fkey(nombre, apellidos),
                    tool_id,
                    tools(nombre),
                    categoria_id,
                    tool_categories(nombre),
                    descripcion,
                    proyecto_id,
                    proyectos(nombre_proyecto),
                    estado,
                    creada_at
                `)
                .order('creada_at', { ascending: false });

            if (statusFilter !== 'all') {
                query = query.eq('estado', statusFilter);
            }
            if (categoryFilter !== 'all') {
                query = query.eq('categoria_id', categoryFilter);
            }
            if (searchTerm) {
                query = query.ilike('descripcion', `%${searchTerm}%`);
            }

            const { data, error: requestsError } = await query;

            if (requestsError) throw requestsError;

            setRequests(data);
            fetchPendingRequestsCount(); // Update global pending count
        } catch (e) {
            setError(e);
            toast({ variant: 'destructive', title: 'Error al cargar solicitudes', description: e.message });
        } finally {
            setLoading(false);
        }
    }, [statusFilter, categoryFilter, searchTerm, fetchPendingRequestsCount]);

    const fetchCategories = useCallback(async () => {
        const { data, error: categoriesError } = await supabase.from('tool_categories').select('id, nombre');
        if (categoriesError) {
            console.error('Error fetching categories:', categoriesError);
        } else {
            setCategories(data);
        }
    }, []);

    useEffect(() => {
        if (canManage) {
            fetchRequests();
            fetchCategories();
        }
    }, [canManage, fetchRequests, fetchCategories]);

    const handleApproveRequest = (request) => {
        setSelectedRequest(request);
        setIsApprovalModalOpen(true);
    };

    const handleRejectRequest = async (requestId) => {
        setLoading(true);
        try {
            const { error: updateError } = await supabase
                .from('tool_requests')
                .update({
                    estado: 'rechazada',
                    gestionada_por: sessionRole.empleadoId,
                    gestionada_at: new Date().toISOString()
                })
                .eq('id', requestId);

            if (updateError) throw updateError;

            toast({ title: 'Solicitud rechazada', description: 'La solicitud ha sido marcada como rechazada.' });
            fetchRequests();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al rechazar', description: error.message });
            console.error('Error rejecting tool request:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'pendiente': return <Badge variant="secondary">Pendiente</Badge>;
            case 'aprobada': return <Badge className="bg-green-500 hover:bg-green-600">Aprobada</Badge>;
            case 'rechazada': return <Badge variant="destructive">Rechazada</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (!canManage) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-destructive">Acceso Denegado</h1>
                <p className="text-muted-foreground">No tienes permisos para ver esta sección.</p>
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <title>Solicitudes de Herramientas</title>
                <meta name="description" content="Gestiona las solicitudes de herramientas de los técnicos." />
            </Helmet>
            <div className="p-4 md:p-8">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <div className="flex items-center gap-3 mb-6">
                        <Wrench className="w-8 h-8 text-primary" />
                        <h1 className="text-3xl font-bold">Solicitudes de Herramientas</h1>
                    </div>

                    <div className="bg-card p-4 rounded-lg border shadow-sm mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger><SelectValue placeholder="Filtrar por estado..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los estados</SelectItem>
                                    <SelectItem value="pendiente">Pendiente</SelectItem>
                                    <SelectItem value="aprobada">Aprobada</SelectItem>
                                    <SelectItem value="rechazada">Rechazada</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger><SelectValue placeholder="Filtrar por categoría..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las categorías</SelectItem>
                                    {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.nombre}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por descripción..."
                                    className="pl-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
                        <AnimatePresence>
                            {loading ? (
                                <div className="flex justify-center items-center h-64">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : error ? (
                                <div className="p-8 text-center text-destructive">
                                    <ServerCrash className="mx-auto h-12 w-12" />
                                    <p className="mt-4">Error al cargar las solicitudes: {error.message}</p>
                                    <Button onClick={fetchRequests} className="mt-4">Reintentar</Button>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Técnico</TableHead>
                                            <TableHead>Categoría</TableHead>
                                            <TableHead>Herramienta</TableHead>
                                            <TableHead>Proyecto</TableHead>
                                            <TableHead>Descripción</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {requests.length > 0 ? (
                                            requests.map(req => (
                                                <TableRow key={req.id}>
                                                    <TableCell>{fmtMadrid(req.creada_at)}</TableCell>
                                                    <TableCell>{req.empleados?.nombre} {req.empleados?.apellidos}</TableCell>
                                                    <TableCell>{req.tool_categories?.nombre || 'N/A'}</TableCell>
                                                    <TableCell>{req.tools?.nombre || 'N/A'}</TableCell>
                                                    <TableCell>{req.proyectos?.nombre_proyecto || 'N/A'}</TableCell>
                                                    <TableCell className="text-muted-foreground">{req.descripcion}</TableCell>
                                                    <TableCell>{getStatusBadge(req.estado)}</TableCell>
                                                    <TableCell className="text-right">
                                                        {req.estado === 'pendiente' && (
                                                            <>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleApproveRequest(req)}
                                                                    className="text-green-600 hover:text-green-700"
                                                                    title="Aprobar Solicitud"
                                                                >
                                                                    <CheckCircle className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleRejectRequest(req.id)}
                                                                    className="text-red-600 hover:text-red-700"
                                                                    title="Rechazar Solicitud"
                                                                >
                                                                    <XCircle className="h-4 w-4" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={8} className="h-24 text-center">
                                                    No se encontraron solicitudes de herramientas con los filtros aplicados.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
                {isApprovalModalOpen && (
                    <ToolRequestApprovalModal
                        isOpen={isApprovalModalOpen}
                        onClose={() => setIsApprovalModalOpen(false)}
                        request={selectedRequest}
                        onApproved={fetchRequests}
                    />
                )}
            </div>
        </>
    );
};

export default ToolRequestsView;