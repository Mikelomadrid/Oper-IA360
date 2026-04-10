import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, Wrench, Calendar, FileText, DollarSign, ExternalLink, Image as ImageIcon, ArrowRight, CheckCircle2, Clock, Filter } from 'lucide-react';
import { fmtMadrid } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const RepairHistoryModal = ({ isOpen, onClose, toolId, toolName }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterStatus, setFilterStatus] = useState('all'); // all, pending, completed
    const [dateStart, setDateStart] = useState('');
    const [dateEnd, setDateEnd] = useState('');

    useEffect(() => {
        if (isOpen && toolId) {
            fetchHistory();
        }
    }, [isOpen, toolId]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('herramientas_reparacion_log')
                .select(`
                    *,
                    sent_by:empleados!sent_by_empleado_id(nombre, apellidos),
                    reparado_por:empleados!reparado_por_empleado_id(nombre, apellidos),
                    proveedor:proveedores(nombre)
                `)
                .eq('herramienta_id', toolId)
                .order('fecha_envio', { ascending: false });

            if (error) throw error;
            setLogs(data || []);
        } catch (err) {
            console.error('Error fetching repair history:', err);
        } finally {
            setLoading(false);
        }
    };

    // Filter logic
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const isCompleted = !!log.fecha_retorno;
            
            // Status filter
            if (filterStatus === 'pending' && isCompleted) return false;
            if (filterStatus === 'completed' && !isCompleted) return false;

            // Date filter (by fecha_envio)
            if (dateStart && new Date(log.fecha_envio) < new Date(dateStart)) return false;
            if (dateEnd) {
                const end = new Date(dateEnd);
                end.setHours(23, 59, 59);
                if (new Date(log.fecha_envio) > end) return false;
            }

            return true;
        });
    }, [logs, filterStatus, dateStart, dateEnd]);

    // Summary stats
    const stats = useMemo(() => {
        const totalRepairs = filteredLogs.length;
        const totalCost = filteredLogs.reduce((acc, log) => acc + (Number(log.total_factura) || 0), 0);
        const completedCount = filteredLogs.filter(l => !!l.fecha_retorno).length;
        
        return { totalRepairs, totalCost, completedCount };
    }, [filteredLogs]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle className="flex items-center gap-2">
                        <Wrench className="w-5 h-5 text-primary" />
                        Historial de Reparaciones
                    </DialogTitle>
                    <DialogDescription>
                        Registro completo de mantenimiento y reparaciones para <span className="font-semibold text-foreground">{toolName}</span>.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
                    {/* Filters & Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <Card className="md:col-span-3 shadow-sm">
                            <CardContent className="p-4 flex flex-wrap gap-4 items-end">
                                <div className="space-y-1.5 min-w-[140px]">
                                    <Label className="text-xs text-muted-foreground">Estado</Label>
                                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                                        <SelectTrigger className="h-8">
                                            <SelectValue placeholder="Todos" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos</SelectItem>
                                            <SelectItem value="pending">En Taller (Pendientes)</SelectItem>
                                            <SelectItem value="completed">Completadas</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Desde</Label>
                                    <Input 
                                        type="date" 
                                        className="h-8 w-auto" 
                                        value={dateStart} 
                                        onChange={e => setDateStart(e.target.value)} 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Hasta</Label>
                                    <Input 
                                        type="date" 
                                        className="h-8 w-auto" 
                                        value={dateEnd} 
                                        onChange={e => setDateEnd(e.target.value)} 
                                    />
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-muted-foreground h-8"
                                    onClick={() => { setFilterStatus('all'); setDateStart(''); setDateEnd(''); }}
                                >
                                    Limpiar
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm bg-primary/5 border-primary/20">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Coste Total (Filtrado)</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold text-primary">
                                    {stats.totalCost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {stats.completedCount} reparaciones finalizadas
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Timeline List */}
                    <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-[19px] before:w-px before:bg-border">
                        {loading ? (
                            <div className="flex justify-center py-12 pl-10">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : filteredLogs.length === 0 ? (
                            <div className="text-center py-12 pl-10 text-muted-foreground">
                                No se encontraron registros de reparación con los filtros actuales.
                            </div>
                        ) : (
                            filteredLogs.map((log) => {
                                const isCompleted = !!log.fecha_retorno;
                                return (
                                    <div key={log.id} className="relative pl-10 group">
                                        {/* Timeline Dot */}
                                        <div className={`absolute left-2 top-4 w-5 h-5 rounded-full border-4 border-background z-10 ${isCompleted ? 'bg-green-500' : 'bg-orange-500 animate-pulse'}`} />
                                        
                                        <Card className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-transparent hover:border-l-primary/50">
                                            <CardHeader className="pb-3">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant={isCompleted ? "outline" : "secondary"} className={isCompleted ? "border-green-500 text-green-600 bg-green-50" : "bg-orange-100 text-orange-700"}>
                                                                {isCompleted ? <><CheckCircle2 className="w-3 h-3 mr-1"/> Finalizada</> : <><Clock className="w-3 h-3 mr-1"/> En Taller</>}
                                                            </Badge>
                                                            <span className="text-sm font-medium text-muted-foreground">
                                                                {fmtMadrid(log.fecha_envio, 'date')}
                                                            </span>
                                                            {isCompleted && (
                                                                <>
                                                                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                                                    <span className="text-sm font-medium text-muted-foreground">
                                                                        {fmtMadrid(log.fecha_retorno, 'date')}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                        <CardTitle className="text-base font-semibold leading-none pt-1">
                                                            {log.motivo_falla || "Mantenimiento Preventivo"}
                                                        </CardTitle>
                                                    </div>
                                                    {log.total_factura > 0 && (
                                                        <div className="text-right">
                                                            <span className="block text-lg font-bold text-foreground">
                                                                {Number(log.total_factura).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">Coste Total</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </CardHeader>
                                            
                                            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                                {/* Left: Details */}
                                                <div className="space-y-4">
                                                    <div className="bg-muted/30 p-3 rounded-md space-y-2">
                                                        <div>
                                                            <span className="text-xs font-semibold text-muted-foreground uppercase block">Descripción Reparación</span>
                                                            <p className="mt-1 whitespace-pre-wrap text-foreground/90">
                                                                {log.descripcion_reparacion || <span className="italic text-muted-foreground">Sin descripción de cierre.</span>}
                                                            </p>
                                                        </div>
                                                        {log.proveedor && (
                                                            <div>
                                                                <span className="text-xs font-semibold text-muted-foreground uppercase block mt-3">Proveedor / Taller</span>
                                                                <p className="font-medium">{log.proveedor.nombre}</p>
                                                            </div>
                                                        )}
                                                        {(log.coste_piezas > 0) && (
                                                            <div>
                                                                <span className="text-xs font-semibold text-muted-foreground uppercase block mt-3">Desglose Costes</span>
                                                                <p>Piezas: {Number(log.coste_piezas).toFixed(2)} €</p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                                        <div className="flex items-center gap-1">
                                                            <span className="font-semibold">Enviado por:</span>
                                                            <span>{log.sent_by?.nombre || 'Desconocido'}</span>
                                                        </div>
                                                        {log.reparado_por && (
                                                            <div className="flex items-center gap-1">
                                                                <span className="font-semibold">Gestionado por:</span>
                                                                <span>{log.reparado_por?.nombre}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    {log.factura_url && (
                                                        <Button variant="outline" size="sm" className="h-8" asChild>
                                                            <a href={log.factura_url} target="_blank" rel="noreferrer">
                                                                <FileText className="w-3.5 h-3.5 mr-2" /> Ver Factura / Albarán
                                                            </a>
                                                        </Button>
                                                    )}
                                                </div>

                                                {/* Right: Photos */}
                                                <div className="space-y-3">
                                                    {/* Foto Evidencia (Fallo) */}
                                                    {log.foto_evidencia_url && (
                                                        <div>
                                                            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                                                                <ImageIcon className="w-3 h-3" /> Evidencia (Antes)
                                                            </p>
                                                            <a href={log.foto_evidencia_url} target="_blank" rel="noreferrer" className="block group/img relative overflow-hidden rounded-md border w-full max-w-[200px] aspect-video bg-muted">
                                                                <img 
                                                                    src={log.foto_evidencia_url} 
                                                                    alt="Evidencia fallo" 
                                                                    className="w-full h-full object-cover" // Removed mix-blend-multiply
                                                                />
                                                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                                                                    <ExternalLink className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-md" />
                                                                </div>
                                                            </a>
                                                        </div>
                                                    )}

                                                    {/* Foto Reparación (Después) */}
                                                    {log.foto_reparacion_url && (
                                                        <div className={log.foto_evidencia_url ? "mt-4" : ""}>
                                                            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1 text-green-600">
                                                                <ImageIcon className="w-3 h-3" /> Reparación (Después)
                                                            </p>
                                                            <a href={log.foto_reparacion_url} target="_blank" rel="noreferrer" className="block group/img relative overflow-hidden rounded-md border w-full max-w-[200px] aspect-video bg-muted border-green-200">
                                                                <img 
                                                                    src={log.foto_reparacion_url} 
                                                                    alt="Evidencia reparación" 
                                                                    className="w-full h-full object-cover" // Removed mix-blend-multiply
                                                                />
                                                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                                                                    <ExternalLink className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-md" />
                                                                </div>
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
                <DialogFooter className="p-4 border-t bg-muted/20">
                    <Button onClick={onClose}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default RepairHistoryModal;