import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Loader2, ArrowLeft, Edit, Trash2, FileText, Calculator, Receipt,
    Package, Search, Layers, CalendarClock, AlertCircle, ClipboardList, Ban
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const ProveedorFormModal = ({ isOpen, onOpenChange, proveedor, onSave }) => {
    const { user } = useAuth();
    const isEditing = !!proveedor;
    const [formData, setFormData] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData(isEditing ? { ...proveedor, activo: proveedor.activo ? 'Activo' : 'Inactivo' } : { activo: 'Activo' });
        }
    }, [isOpen, proveedor, isEditing]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (value) => {
        setFormData(prev => ({ ...prev, activo: value }));
    };

    const handleSubmit = async () => {
        if (!formData.nombre) {
            toast({ title: "Nombre requerido", description: "El nombre del proveedor es obligatorio.", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        const { error } = await supabase
            .from('proveedores')
            .update({
                nombre: formData.nombre,
                telefono: formData.telefono,
                email: formData.email,
                direccion: formData.direccion,
                cif: formData.cif,
                activo: formData.activo === 'Activo',
                cp: formData.cp,
                ciudad: formData.ciudad,
                provincia: formData.provincia,
                pais: formData.pais,
                contacto: formData.contacto,
            })
            .eq('id', proveedor.id);

        setIsSaving(false);
        if (error) {
            toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Proveedor actualizado", description: "Los datos se han guardado correctamente." });
            onSave();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Proveedor</DialogTitle>
                    <DialogDescription>Modifica los datos del proveedor.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-2">
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="nombre" className="text-right">Nombre</Label><Input id="nombre" name="nombre" value={formData.nombre || ''} onChange={handleInputChange} className="col-span-3" /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="cif" className="text-right">CIF/NIF</Label><Input id="cif" name="cif" value={formData.cif || ''} onChange={handleInputChange} className="col-span-3" /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="email" className="text-right">Email</Label><Input id="email" name="email" type="email" value={formData.email || ''} onChange={handleInputChange} className="col-span-3" /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="telefono" className="text-right">Teléfono</Label><Input id="telefono" name="telefono" value={formData.telefono || ''} onChange={handleInputChange} className="col-span-3" /></div>
                     <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="contacto" className="text-right">Contacto</Label><Input id="contacto" name="contacto" value={formData.contacto || ''} onChange={handleInputChange} className="col-span-3" /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="direccion" className="text-right">Dirección</Label><Textarea id="direccion" name="direccion" value={formData.direccion || ''} onChange={handleInputChange} className="col-span-3" /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="cp" className="text-right">CP</Label><Input id="cp" name="cp" value={formData.cp || ''} onChange={handleInputChange} className="col-span-3" /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="ciudad" className="text-right">Ciudad</Label><Input id="ciudad" name="ciudad" value={formData.ciudad || ''} onChange={handleInputChange} className="col-span-3" /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="provincia" className="text-right">Provincia</Label><Input id="provincia" name="provincia" value={formData.provincia || ''} onChange={handleInputChange} className="col-span-3" /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="pais" className="text-right">País</Label><Input id="pais" name="pais" value={formData.pais || ''} onChange={handleInputChange} className="col-span-3" /></div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="estado" className="text-right">Estado</Label>
                        <Select value={formData.activo} onValueChange={handleSelectChange}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Selecciona un estado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Activo">Activo</SelectItem>
                                <SelectItem value="Inactivo">Inactivo</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// --- Formato compartido ---
const formatCurrency = (amount) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount || 0);
const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-ES');
};
const formatNumber = (value) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value || 0);

// --- Pestaña Catálogo ---
const ProveedorCatalogoTab = ({ proveedorId, refreshKey }) => {
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [categoriaFiltro, setCategoriaFiltro] = useState('todas');

    const fetchCatalogo = useCallback(async () => {
        setLoading(true);
        setError(null);
        const { data, error: fetchError } = await supabase.rpc(
            'api_proveedor_catalogo_productos_v1',
            { p_proveedor_id: proveedorId }
        );

        if (fetchError) {
            console.error('Error fetching catálogo proveedor:', fetchError);
            setError(fetchError.message);
            setProductos([]);
        } else {
            setProductos(data || []);
        }
        setLoading(false);
    }, [proveedorId]);

    useEffect(() => {
        fetchCatalogo();
    }, [fetchCatalogo, refreshKey]);

    const categorias = useMemo(() => {
        const set = new Set(productos.map(p => p.categoria).filter(Boolean));
        return Array.from(set).sort();
    }, [productos]);

    const kpis = useMemo(() => {
        const numProductos = productos.length;
        const numCategorias = categorias.length;
        const ultimaCompra = productos.reduce((max, p) => {
            if (!p.ultima_compra) return max;
            return (!max || p.ultima_compra > max) ? p.ultima_compra : max;
        }, null);
        const totalComprado = productos.reduce((sum, p) => sum + (Number(p.total_comprado) || 0), 0);
        return { numProductos, numCategorias, ultimaCompra, totalComprado };
    }, [productos, categorias]);

    const productosFiltrados = useMemo(() => {
        let result = productos;
        if (categoriaFiltro !== 'todas') {
            result = result.filter(p => p.categoria === categoriaFiltro);
        }
        if (search.trim()) {
            const term = search.trim().toLowerCase();
            result = result.filter(p =>
                (p.referencia || '').toLowerCase().includes(term) ||
                (p.nombre || '').toLowerCase().includes(term) ||
                (p.categoria || '').toLowerCase().includes(term)
            );
        }
        return result;
    }, [productos, search, categoriaFiltro]);

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <AlertCircle className="w-8 h-8 text-destructive" />
                <p className="text-sm text-muted-foreground">No se ha podido cargar el catálogo.</p>
                <p className="text-xs text-muted-foreground/70">{error}</p>
                <Button variant="outline" size="sm" onClick={fetchCatalogo}>Reintentar</Button>
            </div>
        );
    }

    if (productos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                <Package className="w-8 h-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground max-w-md">
                    Este proveedor aún no tiene productos en catálogo. El catálogo se alimenta desde líneas de factura validadas.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-muted/20 border shadow-none">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-blue-100 text-blue-700 rounded-full"><Package className="w-5 h-5" /></div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Nº Productos</p>
                            <p className="text-2xl font-bold">{kpis.numProductos}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-muted/20 border shadow-none">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-indigo-100 text-indigo-700 rounded-full"><Layers className="w-5 h-5" /></div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Nº Categorías</p>
                            <p className="text-2xl font-bold">{kpis.numCategorias}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-muted/20 border shadow-none">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-amber-100 text-amber-700 rounded-full"><CalendarClock className="w-5 h-5" /></div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Última Compra</p>
                            <p className="text-2xl font-bold">{formatDate(kpis.ultimaCompra)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-muted/20 border shadow-none">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-green-100 text-green-700 rounded-full"><Calculator className="w-5 h-5" /></div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Total Comprado</p>
                            <p className="text-2xl font-bold">{formatCurrency(kpis.totalComprado)}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Buscador y filtro */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por referencia, nombre o categoría..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                {categorias.length > 0 && (
                    <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                        <SelectTrigger className="sm:w-64">
                            <SelectValue placeholder="Todas las categorías" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todas">Todas las categorías</SelectItem>
                            {categorias.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {/* Tabla */}
            <div className="border rounded-md overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Referencia</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead className="text-right">Último Precio</TableHead>
                            <TableHead className="text-center">Veces Comprado</TableHead>
                            <TableHead>Última Compra</TableHead>
                            <TableHead className="text-center">Compras Registradas</TableHead>
                            <TableHead className="text-right">Total Comprado</TableHead>
                            <TableHead className="text-right">Cantidad Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {productosFiltrados.length > 0 ? (
                            productosFiltrados.map((p) => (
                                <TableRow key={p.producto_id}>
                                    <TableCell className="font-mono text-sm">{p.referencia || '-'}</TableCell>
                                    <TableCell className="font-medium">{p.nombre || '-'}</TableCell>
                                    <TableCell>
                                        {p.categoria ? <Badge variant="outline">{p.categoria}</Badge> : '-'}
                                    </TableCell>
                                    <TableCell className="text-right">{formatCurrency(p.ultimo_precio)}</TableCell>
                                    <TableCell className="text-center">{p.veces_comprado ?? '-'}</TableCell>
                                    <TableCell>{formatDate(p.ultima_compra)}</TableCell>
                                    <TableCell className="text-center">{p.compras_registradas ?? '-'}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(p.total_comprado)}</TableCell>
                                    <TableCell className="text-right">{formatNumber(p.cantidad_total)}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                    No se han encontrado productos con ese criterio de búsqueda.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

// --- Pestaña Líneas pendientes ---
const getLineaEstadoBadge = (linea) => {
    const { validacion_estado, es_material } = linea;
    if (validacion_estado === 'rechazada') {
        return <Badge className="bg-red-100 text-red-800 border-red-200">Rechazada</Badge>;
    }
    if (validacion_estado === 'pendiente_revision') {
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Revisar</Badge>;
    }
    if (validacion_estado === 'no_material' || es_material === false) {
        return <Badge className="bg-slate-100 text-slate-700 border-slate-200">No material</Badge>;
    }
    if (validacion_estado === 'ocr_extraido' && es_material === true) {
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendiente validar</Badge>;
    }
    return <Badge variant="outline">{validacion_estado || '-'}</Badge>;
};

const ProveedorLineasPendientesTab = ({ proveedorId, onCatalogoUpdated }) => {
    const [lineas, setLineas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [filtro, setFiltro] = useState('todos');
    const [validatingId, setValidatingId] = useState(null);

    const fetchLineas = useCallback(async () => {
        setLoading(true);
        setError(null);
        const { data, error: fetchError } = await supabase
            .from('v_flopy_catalogo_lineas_candidatas')
            .select('*')
            .eq('proveedor_id', proveedorId)
            .eq('estado_catalogo', 'pendiente_validacion')
            .order('fecha_factura', { ascending: false })
            .order('numero_linea', { ascending: true });

        if (fetchError) {
            console.error('Error fetching líneas pendientes:', fetchError);
            setError(fetchError.message);
            setLineas([]);
        } else {
            setLineas(data || []);
        }
        setLoading(false);
    }, [proveedorId]);

    useEffect(() => {
        fetchLineas();
    }, [fetchLineas]);

    const handleValidar = useCallback(async (linea) => {
        if (validatingId) return; // evita doble click / validaciones simultáneas
        setValidatingId(linea.linea_id);

        const { data, error: rpcError } = await supabase.rpc('flopy_validar_y_alimentar_linea_catalogo', {
            p_linea_id: linea.linea_id
        });

        if (rpcError) {
            toast({ title: 'Error al validar', description: rpcError.message, variant: 'destructive' });
            setValidatingId(null);
            return;
        }

        if (data?.ok) {
            toast({ title: 'Línea validada y añadida al catálogo' });
            setLineas(prev => prev.filter(l => l.linea_id !== linea.linea_id));
            onCatalogoUpdated?.();
        } else {
            toast({
                title: 'No se pudo validar la línea',
                description: data?.mensaje || data?.error || 'Error desconocido al validar la línea.',
                variant: 'destructive'
            });
        }
        setValidatingId(null);
    }, [validatingId, onCatalogoUpdated]);

    const kpis = useMemo(() => {
        const numLineas = lineas.length;
        const totalPendiente = lineas.reduce((sum, l) => sum + (Number(l.total_linea) || 0), 0);
        const numFacturas = new Set(lineas.map(l => l.factura_id).filter(Boolean)).size;
        const numMateriales = lineas.filter(l => l.es_material === true).length;
        const numNoMaterial = lineas.filter(l => l.es_material === false).length;
        return { numLineas, totalPendiente, numFacturas, numMateriales, numNoMaterial };
    }, [lineas]);

    const lineasFiltradas = useMemo(() => {
        let result = lineas;
        if (filtro === 'materiales') {
            result = result.filter(l => l.validacion_estado === 'ocr_extraido' && l.es_material === true);
        } else if (filtro === 'no_material') {
            result = result.filter(l => l.validacion_estado === 'no_material' || l.es_material === false);
        } else if (filtro === 'revision') {
            result = result.filter(l => l.validacion_estado === 'pendiente_revision');
        }
        if (search.trim()) {
            const term = search.trim().toLowerCase();
            result = result.filter(l =>
                (l.referencia || '').toLowerCase().includes(term) ||
                (l.descripcion || '').toLowerCase().includes(term) ||
                (l.categoria || '').toLowerCase().includes(term) ||
                (l.numero_factura || '').toLowerCase().includes(term)
            );
        }
        return result;
    }, [lineas, search, filtro]);

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <AlertCircle className="w-8 h-8 text-destructive" />
                <p className="text-sm text-muted-foreground">No se han podido cargar las líneas pendientes.</p>
                <p className="text-xs text-muted-foreground/70">{error}</p>
                <Button variant="outline" size="sm" onClick={fetchLineas}>Reintentar</Button>
            </div>
        );
    }

    if (lineas.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                <ClipboardList className="w-8 h-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground max-w-md">
                    Este proveedor no tiene líneas pendientes de validar para catálogo.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="bg-muted/20 border shadow-none">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-yellow-100 text-yellow-700 rounded-full"><ClipboardList className="w-5 h-5" /></div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Líneas Pendientes</p>
                            <p className="text-2xl font-bold">{kpis.numLineas}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-muted/20 border shadow-none">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-green-100 text-green-700 rounded-full"><Calculator className="w-5 h-5" /></div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Total Pendiente</p>
                            <p className="text-2xl font-bold">{formatCurrency(kpis.totalPendiente)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-muted/20 border shadow-none">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-blue-100 text-blue-700 rounded-full"><FileText className="w-5 h-5" /></div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Facturas Afectadas</p>
                            <p className="text-2xl font-bold">{kpis.numFacturas}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-muted/20 border shadow-none">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-indigo-100 text-indigo-700 rounded-full"><Package className="w-5 h-5" /></div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Materiales Detectados</p>
                            <p className="text-2xl font-bold">{kpis.numMateriales}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-muted/20 border shadow-none">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-slate-100 text-slate-700 rounded-full"><Ban className="w-5 h-5" /></div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">No Material</p>
                            <p className="text-2xl font-bold">{kpis.numNoMaterial}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Buscador y filtro */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por referencia, descripción, categoría o nº factura..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Select value={filtro} onValueChange={setFiltro}>
                    <SelectTrigger className="sm:w-56">
                        <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="materiales">Materiales pendientes</SelectItem>
                        <SelectItem value="no_material">No material</SelectItem>
                        <SelectItem value="revision">Revisión</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Tabla */}
            <div className="border rounded-md overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Factura</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead className="text-center">Nº Línea</TableHead>
                            <TableHead>Referencia</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                            <TableHead>Unidad</TableHead>
                            <TableHead className="text-right">Precio Unitario</TableHead>
                            <TableHead className="text-right">Total Línea</TableHead>
                            <TableHead className="text-center">Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {lineasFiltradas.length > 0 ? (
                            lineasFiltradas.map((l) => {
                                const isNoMaterial = l.es_material === false || l.validacion_estado === 'no_material';
                                const missingRef = !l.referencia || !l.referencia.trim();
                                const isValidating = validatingId === l.linea_id;
                                return (
                                <TableRow key={l.linea_id}>
                                    <TableCell className="font-medium">{l.numero_factura || '-'}</TableCell>
                                    <TableCell>{formatDate(l.fecha_factura)}</TableCell>
                                    <TableCell className="text-center">{l.numero_linea ?? '-'}</TableCell>
                                    <TableCell className="font-mono text-sm">{l.referencia || '-'}</TableCell>
                                    <TableCell>{l.descripcion || '-'}</TableCell>
                                    <TableCell>
                                        {l.categoria ? <Badge variant="outline">{l.categoria}</Badge> : '-'}
                                    </TableCell>
                                    <TableCell className="text-right">{formatNumber(l.cantidad)}</TableCell>
                                    <TableCell>{l.unidad || '-'}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(l.precio_unitario)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(l.total_linea)}</TableCell>
                                    <TableCell className="text-center">{getLineaEstadoBadge(l)}</TableCell>
                                    <TableCell className="text-right">
                                        {isNoMaterial ? (
                                            <Badge className="bg-slate-100 text-slate-700 border-slate-200">No material</Badge>
                                        ) : missingRef ? (
                                            <Button size="sm" variant="outline" disabled title="Falta referencia">
                                                Validar
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={isValidating}
                                                onClick={() => handleValidar(l)}
                                            >
                                                {isValidating ? (
                                                    <>
                                                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                                        Validando…
                                                    </>
                                                ) : 'Validar'}
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                                    No se han encontrado líneas con ese criterio de búsqueda.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};


const ProveedorDetail = ({ proveedorId, navigate }) => {
    const { sessionRole } = useAuth();
    const [generalData, setGeneralData] = useState(null);
    const [gastos, setGastos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingGastos, setLoadingGastos] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [catalogoRefreshKey, setCatalogoRefreshKey] = useState(0);

    const canManage = useMemo(() => sessionRole.rol === 'admin' || sessionRole.rol === 'encargado', [sessionRole]);

    const fetchGeneralData = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('proveedores')
            .select('*')
            .eq('id', proveedorId)
            .single();

        if (error || !data) {
            toast({ title: 'Error al cargar proveedor', description: error?.message || 'El proveedor no fue encontrado.', variant: 'destructive' });
            navigate('/crm/proveedores');
        } else {
            setGeneralData(data);
        }
        setLoading(false);
    }, [proveedorId, navigate]);

    const fetchGastos = useCallback(async () => {
        setLoadingGastos(true);
        const { data, error } = await supabase
            .from('gastos')
            .select('*')
            .eq('proveedor_id', proveedorId)
            .order('fecha_emision', { ascending: false });

        if (!error) {
            setGastos(data || []);
        } else {
            console.error("Error fetching gastos:", error);
        }
        setLoadingGastos(false);
    }, [proveedorId]);

    useEffect(() => {
        fetchGeneralData();
        fetchGastos();
    }, [fetchGeneralData, fetchGastos]);

    const handleDelete = async () => {
        const { error } = await supabase.from('proveedores').delete().eq('id', proveedorId);
        if (error) {
            toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Proveedor eliminado" });
            navigate('/crm/proveedores');
        }
    };

    const summary = useMemo(() => {
        const totalInvoices = gastos.length;
        const totalBase = gastos.reduce((sum, g) => sum + (Number(g.monto_bruto) || 0), 0);
        const averageTicket = totalInvoices > 0 ? totalBase / totalInvoices : 0;
        return { totalInvoices, totalBase, averageTicket };
    }, [gastos]);

    const getStatusBadge = (status) => {
        const s = status?.toLowerCase() || 'pendiente';
        switch (s) {
            case 'pagada': return <Badge className="bg-green-100 text-green-800 border-green-200">Pagada</Badge>;
            case 'pendiente': return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendiente</Badge>;
            case 'vencida': return <Badge className="bg-red-100 text-red-800 border-red-200">Vencida</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };
    
    if (loading) {
        return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!generalData) {
        return <div className="p-8 text-center">Proveedor no encontrado.</div>;
    }

    return (
        <div className="p-4 md:p-8">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex justify-between items-center mb-6">
                    <Button variant="ghost" onClick={() => navigate('/crm/proveedores')}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Proveedores
                    </Button>
                    {canManage && (
                        <div className="flex gap-2">
                             <Button onClick={() => setIsFormModalOpen(true)}><Edit className="mr-2 h-4 w-4" /> Editar</Button>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Eliminar</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Seguro que quieres eliminar este proveedor?</AlertDialogTitle>
                                        <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(generalData.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    )}
                </div>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{generalData.nombre ? generalData.nombre.toUpperCase() : 'Proveedor'}</CardTitle>
                        <CardDescription>
                            <span className="font-mono">{generalData.cif || '-'}</span> · {generalData.email || '-'} · {generalData.telefono || '-'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Nombre</p><p>{generalData.nombre ? generalData.nombre.toUpperCase() : '-'}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">CIF</p><p>{generalData.cif || '-'}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Email</p><p>{generalData.email || '-'}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Teléfono</p><p>{generalData.telefono || '-'}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Persona de Contacto</p><p>{generalData.contacto || '-'}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Dirección</p><p>{generalData.direccion || '-'}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Código Postal</p><p>{generalData.cp || '-'}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Ciudad</p><p>{generalData.ciudad || '-'}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Provincia</p><p>{generalData.provincia || '-'}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">País</p><p>{generalData.pais || '-'}</p></div>
                             <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Estado</p><p>{generalData.activo ? 'Activo' : 'Inactivo'}</p></div>
                            <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground">Fecha de Creación</p><p>{new Date(generalData.fecha_creacion).toLocaleDateString()}</p></div>
                        </div>
                    </CardContent>
                </Card>

                {/* Pestañas: Historial de Gastos / Catálogo */}
                <Card>
                    <CardContent className="pt-6">
                        <Tabs defaultValue="gastos" className="w-full">
                            <TabsList>
                                <TabsTrigger value="gastos" className="flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> Historial de Gastos
                                </TabsTrigger>
                                <TabsTrigger value="catalogo" className="flex items-center gap-2">
                                    <Package className="w-4 h-4" /> Catálogo
                                </TabsTrigger>
                                <TabsTrigger value="lineas_pendientes" className="flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4" /> Líneas Pendientes
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="gastos" className="mt-6">
                                {loadingGastos ? (
                                    <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Summary Block */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <Card className="bg-muted/20 border shadow-none">
                                                <CardContent className="p-4 flex items-center gap-4">
                                                    <div className="p-3 bg-blue-100 text-blue-700 rounded-full">
                                                        <Receipt className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-muted-foreground">Total Facturas</p>
                                                        <p className="text-2xl font-bold">{summary.totalInvoices}</p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                            <Card className="bg-muted/20 border shadow-none">
                                                <CardContent className="p-4 flex items-center gap-4">
                                                    <div className="p-3 bg-green-100 text-green-700 rounded-full">
                                                        <Calculator className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-muted-foreground">Total Base (Sin IVA)</p>
                                                        <p className="text-2xl font-bold">{formatCurrency(summary.totalBase)}</p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                            <Card className="bg-muted/20 border shadow-none">
                                                <CardContent className="p-4 flex items-center gap-4">
                                                    <div className="p-3 bg-purple-100 text-purple-700 rounded-full">
                                                        <span className="font-bold text-lg">Avg</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-muted-foreground">Ticket Medio</p>
                                                        <p className="text-2xl font-bold">{formatCurrency(summary.averageTicket)}</p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>

                                        {/* Table */}
                                        <div className="border rounded-md">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Nº Factura</TableHead>
                                                        <TableHead>Fecha Emisión</TableHead>
                                                        <TableHead className="text-right">Base Imponible</TableHead>
                                                        <TableHead className="text-right">Total (con IVA)</TableHead>
                                                        <TableHead className="text-center">Estado</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {gastos.length > 0 ? (
                                                        gastos.map((gasto) => (
                                                            <TableRow key={gasto.id}>
                                                                <TableCell className="font-medium">{gasto.numero_factura || '-'}</TableCell>
                                                                <TableCell>{formatDate(gasto.fecha_emision)}</TableCell>
                                                                <TableCell className="text-right">{formatCurrency(gasto.monto_bruto)}</TableCell>
                                                                <TableCell className="text-right">{formatCurrency(gasto.total_con_iva)}</TableCell>
                                                                <TableCell className="text-center">{getStatusBadge(gasto.estado_pago)}</TableCell>
                                                            </TableRow>
                                                        ))
                                                    ) : (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                                No hay gastos registrados para este proveedor.
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="catalogo" className="mt-6">
                                <ProveedorCatalogoTab proveedorId={proveedorId} refreshKey={catalogoRefreshKey} />
                            </TabsContent>

                            <TabsContent value="lineas_pendientes" className="mt-6">
                                <ProveedorLineasPendientesTab
                                    proveedorId={proveedorId}
                                    onCatalogoUpdated={() => setCatalogoRefreshKey(k => k + 1)}
                                />
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                 {canManage && <ProveedorFormModal isOpen={isFormModalOpen} onOpenChange={setIsFormModalOpen} proveedor={generalData} onSave={() => { setIsFormModalOpen(false); fetchGeneralData(); }} />}
            </motion.div>
        </div>
    );
};

export default ProveedorDetail;
