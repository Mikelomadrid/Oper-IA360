import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { toast } from '@/components/ui/use-toast';
import {
    Loader2, Palmtree, ShieldAlert, BookOpen, UserCheck, UserX,
    AlertTriangle, Calendar as CalendarIcon, Plus, Pencil, Trash2
} from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

/**
 * Pestaña "Ausencias" dentro de la ficha de un empleado.
 * Pensada para uso del admin/encargado: permite crear, editar y eliminar
 * ausencias del empleado concreto que se está viendo.
 *
 * Props:
 *  - employeeId     (uuid, requerido): empleado dueño de las ausencias.
 *  - empleadoNombre (string, opcional): solo para textos.
 *  - onChange       (fn, opcional): se llama tras crear/editar/eliminar por si
 *                   la ficha necesita refrescar otros datos (p.ej. saldo).
 */
const FichaEmpleadoAusencias = ({ employeeId, empleadoNombre, onChange, mostrarSaldo = true }) => {
    const empleadoId = employeeId; // alias interno
    const { sessionRole } = useAuth();
    const puedeGestionar = ['admin', 'encargado'].includes(sessionRole?.rol);

    const [loading, setLoading] = useState(true);
    const [ausencias, setAusencias] = useState([]);
    const [saldoVacaciones, setSaldoVacaciones] = useState(null);

    // Modal crear/editar
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState(null); // null = crear, objeto = editar
    const [submitting, setSubmitting] = useState(false);
    const [modalData, setModalData] = useState({ range: { from: undefined, to: undefined }, notas: '', tipo: 'vacaciones' });

    // Confirmación de borrado
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // ── Carga de datos ──
    const fetchData = useCallback(async () => {
        if (!empleadoId) return;
        setLoading(true);
        try {
            const { data: emp } = await supabase
                .from('empleados')
                .select('dias_vacaciones_restantes')
                .eq('id', empleadoId)
                .single();
            if (emp) setSaldoVacaciones(emp.dias_vacaciones_restantes ?? 30);

            const { data } = await supabase
                .from('ausencias_empleados')
                .select('*')
                .eq('empleado_id', empleadoId)
                .order('fecha_inicio', { ascending: false });
            setAusencias(data || []);
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las ausencias.' });
        } finally {
            setLoading(false);
        }
    }, [empleadoId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Helpers ──
    const diasDe = (inicio, fin) => differenceInDays(new Date(fin), new Date(inicio)) + 1;

    const getBadgeConfig = (tipo) => {
        switch (tipo) {
            case 'vacaciones':         return { label: 'Vacaciones',     icon: Palmtree,      className: 'bg-blue-100 text-blue-700 border-blue-200' };
            case 'vacaciones_empresa': return { label: 'Cierre empresa', icon: ShieldAlert,   className: 'bg-orange-100 text-orange-700 border-orange-200' };
            case 'baja':               return { label: 'Baja Médica',    icon: ShieldAlert,   className: 'bg-red-100 text-red-700 border-red-200' };
            case 'permiso_admin':      return { label: 'Permiso',        icon: UserCheck,     className: 'bg-purple-100 text-purple-700 border-purple-200' };
            case 'formacion':          return { label: 'Formación',      icon: BookOpen,      className: 'bg-cyan-100 text-cyan-700 border-cyan-200' };
            case 'sin_justificar':     return { label: 'Sin Justificar', icon: AlertTriangle, className: 'bg-amber-100 text-amber-700 border-amber-200' };
            default:                   return { label: tipo,             icon: UserX,         className: 'bg-gray-100 text-gray-700 border-gray-200' };
        }
    };

    const diasSeleccionados = modalData.range?.from
        ? (modalData.range?.to ? differenceInDays(modalData.range.to, modalData.range.from) + 1 : 1)
        : 0;

    // ── Abrir modal crear ──
    const abrirCrear = () => {
        setEditing(null);
        setModalData({ range: { from: undefined, to: undefined }, notas: '', tipo: 'vacaciones' });
        setIsModalOpen(true);
    };

    // ── Abrir modal editar ──
    const abrirEditar = (a) => {
        // 'vacaciones_empresa' son cierres automáticos: no se editan a mano.
        if (a.tipo === 'vacaciones_empresa') {
            toast({ variant: 'destructive', title: 'No editable', description: 'Los cierres de empresa se gestionan desde Vacaciones de empresa.' });
            return;
        }
        setEditing(a);
        setModalData({
            range: { from: parseISO(a.fecha_inicio), to: parseISO(a.fecha_fin) },
            notas: a.notas || '',
            tipo: a.tipo,
        });
        setIsModalOpen(true);
    };

    // ── Guardar (crear o editar) ──
    const handleGuardar = async () => {
        if (!modalData.range?.from) {
            toast({ variant: 'destructive', title: 'Faltan datos', description: 'Selecciona las fechas.' });
            return;
        }
        const from = modalData.range.from;
        const to = modalData.range.to || from;
        const newDays = differenceInDays(to, from) + 1;
        if (newDays <= 0) { toast({ variant: 'destructive', title: 'Rango inválido' }); return; }

        setSubmitting(true);
        try {
            // Ajuste de saldo: devolvemos los días de vacaciones antiguos y restamos los nuevos.
            const oldVacDays = editing && editing.tipo === 'vacaciones' ? diasDe(editing.fecha_inicio, editing.fecha_fin) : 0;
            const newVacDays = modalData.tipo === 'vacaciones' ? newDays : 0;
            const delta = oldVacDays - newVacDays; // >0 devuelve saldo, <0 lo descuenta

            if (delta !== 0) {
                await supabase.rpc('increment_vacation_balance', { p_empleado_id: empleadoId, p_days: delta });
            }

            const payload = {
                empleado_id: empleadoId,
                tipo: modalData.tipo,
                fecha_inicio: format(from, 'yyyy-MM-dd'),
                fecha_fin: format(to, 'yyyy-MM-dd'),
                notas: modalData.notas || null,
            };

            if (editing) {
                const { error } = await supabase.from('ausencias_empleados').update(payload).eq('id', editing.id);
                if (error) throw error;
                toast({ title: 'Ausencia actualizada' });
            } else {
                const { error } = await supabase.from('ausencias_empleados').insert({ ...payload, admin_id: sessionRole?.id || null });
                if (error) throw error;
                toast({ title: 'Ausencia registrada' });
            }

            setIsModalOpen(false);
            setEditing(null);
            await fetchData();
            onChange?.();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    // ── Eliminar ──
    const handleEliminar = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            // Si eran vacaciones, devolvemos los días al saldo.
            if (deleteTarget.tipo === 'vacaciones') {
                const dias = diasDe(deleteTarget.fecha_inicio, deleteTarget.fecha_fin);
                await supabase.rpc('increment_vacation_balance', { p_empleado_id: empleadoId, p_days: dias });
            }
            const { error } = await supabase.from('ausencias_empleados').delete().eq('id', deleteTarget.id);
            if (error) throw error;
            toast({ title: 'Ausencia eliminada' });
            setDeleteTarget(null);
            await fetchData();
            onChange?.();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setDeleting(false);
        }
    };

    if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

    return (
        <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Palmtree className="w-5 h-5 text-primary" />
                        Ausencias
                    </CardTitle>
                    <CardDescription>
                        Vacaciones, bajas y permisos de {empleadoNombre?.trim() || 'este empleado'}.
                        {mostrarSaldo && saldoVacaciones != null && (
                            <span className="ml-1">Saldo de vacaciones: <strong>{saldoVacaciones} días</strong>.</span>
                        )}
                    </CardDescription>
                </div>
                {puedeGestionar && (
                    <Button onClick={abrirCrear} className="shrink-0">
                        <Plus className="w-4 h-4 mr-2" /> Nueva ausencia
                    </Button>
                )}
            </CardHeader>

            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Fechas</TableHead>
                            <TableHead className="text-center">Días</TableHead>
                            <TableHead>Notas</TableHead>
                            {puedeGestionar && <TableHead className="text-right">Acciones</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {ausencias.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={puedeGestionar ? 5 : 4} className="h-32 text-center text-muted-foreground">
                                    No hay ausencias registradas todavía.
                                </TableCell>
                            </TableRow>
                        ) : (
                            ausencias.map(a => {
                                const badge = getBadgeConfig(a.tipo);
                                const Icon = badge.icon;
                                const days = diasDe(a.fecha_inicio, a.fecha_fin);
                                const esCierre = a.tipo === 'vacaciones_empresa';
                                return (
                                    <TableRow key={a.id} className={esCierre ? 'bg-orange-50/40 dark:bg-orange-900/10' : ''}>
                                        <TableCell>
                                            <Badge variant="outline" className={cn("flex w-fit items-center gap-1", badge.className)}>
                                                <Icon className="w-3 h-3" /> {badge.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            <div className="flex items-center gap-2">
                                                <CalendarIcon className="w-3 h-3 text-muted-foreground" />
                                                {format(new Date(a.fecha_inicio), 'dd/MM/yyyy')} – {format(new Date(a.fecha_fin), 'dd/MM/yyyy')}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center font-semibold">{days} días</TableCell>
                                        <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">{a.notas || '–'}</TableCell>
                                        {puedeGestionar && (
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost" size="icon" className="h-8 w-8"
                                                        onClick={() => abrirEditar(a)}
                                                        disabled={esCierre}
                                                        title={esCierre ? 'Cierre de empresa (no editable)' : 'Editar'}
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => setDeleteTarget(a)}
                                                        disabled={esCierre}
                                                        title={esCierre ? 'Cierre de empresa (no eliminable)' : 'Eliminar'}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </CardContent>

            {/* ── MODAL CREAR / EDITAR ── */}
            <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if (!open) setEditing(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing ? '✏️ Editar ausencia' : '📅 Registrar ausencia'}</DialogTitle>
                        <DialogDescription>
                            {editing ? 'Modifica los datos de la ausencia.' : `Se registra directamente para ${empleadoNombre?.trim() || 'el empleado'}.`}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Tipo de ausencia</Label>
                            <Select value={modalData.tipo} onValueChange={v => setModalData(p => ({ ...p, tipo: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="vacaciones">Vacaciones</SelectItem>
                                    <SelectItem value="baja">Baja Médica</SelectItem>
                                    <SelectItem value="permiso_admin">Permiso</SelectItem>
                                    <SelectItem value="formacion">Formación</SelectItem>
                                    <SelectItem value="sin_justificar">Sin Justificar</SelectItem>
                                </SelectContent>
                            </Select>
                            {modalData.tipo === 'vacaciones' && (
                                <p className="text-xs text-amber-600 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    Se ajustará el saldo de vacaciones del empleado automáticamente.
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Fechas</Label>
                            <div className="border rounded-md p-2 flex justify-center">
                                <Calendar
                                    mode="range"
                                    selected={modalData.range}
                                    onSelect={(range) => setModalData(p => ({ ...p, range: range || { from: undefined, to: undefined } }))}
                                    numberOfMonths={1}
                                    locale={es}
                                />
                            </div>
                            {diasSeleccionados > 0 && (
                                <p className="text-sm text-center font-medium text-primary">
                                    {modalData.range?.from && format(modalData.range.from, 'd MMM', { locale: es })}
                                    {modalData.range?.to && modalData.range.to !== modalData.range.from && ` – ${format(modalData.range.to, 'd MMM yyyy', { locale: es })}`}
                                    {' · '}<strong>{diasSeleccionados} día{diasSeleccionados !== 1 ? 's' : ''}</strong>
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Comentario (opcional)</Label>
                            <Textarea placeholder="Notas internas..." value={modalData.notas} onChange={(e) => setModalData(p => ({ ...p, notas: e.target.value }))} />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsModalOpen(false); setEditing(null); }}>Cancelar</Button>
                        <Button onClick={handleGuardar} disabled={submitting || !modalData.range?.from} className="bg-green-600 hover:bg-green-700">
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editing ? 'Guardar cambios' : 'Registrar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── CONFIRMAR BORRADO ── */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>🗑 Eliminar ausencia</DialogTitle>
                        <DialogDescription>
                            {deleteTarget && (
                                <>
                                    Vas a eliminar <strong>{getBadgeConfig(deleteTarget.tipo).label}</strong> del{' '}
                                    {format(new Date(deleteTarget.fecha_inicio), 'dd/MM/yyyy')} al {format(new Date(deleteTarget.fecha_fin), 'dd/MM/yyyy')}.
                                    {deleteTarget.tipo === 'vacaciones' && ' Los días se devolverán al saldo del empleado.'}
                                    {' '}Esta acción no se puede deshacer.
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleEliminar} disabled={deleting}>
                            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Eliminar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
};

export default FichaEmpleadoAusencias;
