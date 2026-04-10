import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Pencil, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

/**
 * EmployeeHabilidadesTab
 * -------------------------------------------------
 * UI para gestionar las habilidades de un empleado.
 * Sólo usuarios con rol "admin" o "encargado" pueden crear, editar o eliminar.
 * Los técnicos solo ven la lista (si se muestra) pero no pueden modificar.
 */
export default function EmployeeHabilidadesTab({ employeeId, isAdminOrEncargado }) {
    const { sessionRole } = useAuth();
    const [skills, setSkills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingSkill, setEditingSkill] = useState(null); // skill object o null
    const [form, setForm] = useState({ nombre: '', descripcion: '', nivel: 'medio', puede_ayudar: true });

    // ---------------------------------------------------------------------
    // Cargar habilidades desde Supabase
    // ---------------------------------------------------------------------
    const fetchSkills = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('empleado_habilidades')
            .select('*')
            .eq('empleado_id', employeeId)
            .order('created_at', { ascending: false });
        if (error) {
            toast({ variant: 'destructive', title: 'Error al cargar habilidades', description: error.message });
        } else {
            setSkills(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSkills();
    }, [employeeId]);

    // ---------------------------------------------------------------------
    // Handlers de creación / edición
    // ---------------------------------------------------------------------
    const resetForm = () => {
        setForm({ nombre: '', descripcion: '', nivel: 'medio', puede_ayudar: true });
        setEditingSkill(null);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        const payload = {
            empleado_id: employeeId,
            nombre: form.nombre,
            descripcion: form.descripcion,
            nivel: form.nivel,
            puede_ayudar: form.puede_ayudar,
        };
        let result;
        if (editingSkill) {
            // UPDATE
            const { data, error } = await supabase
                .from('empleado_habilidades')
                .update(payload)
                .eq('id', editingSkill.id)
                .single();
            result = { data, error };
        } else {
            // INSERT
            const { data, error } = await supabase.from('empleado_habilidades').insert(payload).single();
            result = { data, error };
        }
        if (result.error) {
            toast({ variant: 'destructive', title: 'Error al guardar habilidad', description: result.error.message });
        } else {
            toast({ title: editingSkill ? 'Habilidad actualizada' : 'Habilidad creada' });
            fetchSkills();
            resetForm();
        }
        setSaving(false);
    };

    const handleEdit = (skill) => {
        setEditingSkill(skill);
        setForm({
            nombre: skill.nombre,
            descripcion: skill.descripcion,
            nivel: skill.nivel,
            puede_ayudar: skill.puede_ayudar,
        });
    };

    const handleDelete = async (skill) => {
        if (!window.confirm('¿Eliminar esta habilidad?')) return;
        const { error } = await supabase.from('empleado_habilidades').delete().eq('id', skill.id);
        if (error) {
            toast({ variant: 'destructive', title: 'Error al eliminar', description: error.message });
        } else {
            toast({ title: 'Habilidad eliminada' });
            fetchSkills();
        }
    };

    // ---------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------
    return (
        <Card className="border shadow-sm rounded-lg">
            <CardHeader>
                <CardTitle>Habilidades</CardTitle>
            </CardHeader>
            <CardContent>
                {/* Lista de habilidades */}
                {loading ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {skills.length === 0 && <p className="text-muted-foreground">No hay habilidades registradas.</p>}
                        {skills.map((skill) => (
                            <div key={skill.id} className="flex items-start justify-between p-2 border rounded-md bg-muted/30">
                                <div className="flex flex-col">
                                    <h4 className="font-medium text-sm">{skill.nombre}</h4>
                                    {skill.descripcion && <p className="text-xs text-muted-foreground">{skill.descripcion}</p>}
                                    <div className="flex items-center gap-2 mt-1 text-xs">
                                        <Badge variant="outline" className="capitalize">{skill.nivel}</Badge>
                                        <Badge variant={skill.puede_ayudar ? 'default' : 'secondary'}>
                                            {skill.puede_ayudar ? 'Puede ayudar' : 'No puede ayudar'}
                                        </Badge>
                                    </div>
                                </div>
                                {isAdminOrEncargado && (
                                    <div className="flex gap-2 opacity-80">
                                        <Button size="icon" variant="secondary" onClick={() => handleEdit(skill)} title="Editar">
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="destructive" onClick={() => handleDelete(skill)} title="Eliminar">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Formulario de creación / edición (solo admin/encargado) */}
                {isAdminOrEncargado && (
                    <form onSubmit={handleSubmit} className="mt-6 space-y-4 border-t pt-4">
                        <h5 className="font-medium">{editingSkill ? 'Editar habilidad' : 'Agregar nueva habilidad'}</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                name="nombre"
                                placeholder="Nombre de la habilidad"
                                value={form.nombre}
                                onChange={handleChange}
                                required
                            />
                            <Select name="nivel" value={form.nivel} onValueChange={(v) => setForm((p) => ({ ...p, nivel: v }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Nivel" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="alto">Alto</SelectItem>
                                    <SelectItem value="medio">Medio</SelectItem>
                                    <SelectItem value="bajo">Bajo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Input
                            name="descripcion"
                            placeholder="Descripción (opcional)"
                            value={form.descripcion}
                            onChange={handleChange}
                        />
                        <div className="flex items-center space-x-2">
                            <label className="flex items-center space-x-1">
                                <input
                                    type="checkbox"
                                    name="puede_ayudar"
                                    checked={form.puede_ayudar}
                                    onChange={handleChange}
                                />
                                <span className="text-sm">Puede ayudar</span>
                            </label>
                        </div>
                        <div className="flex gap-2">
                            <Button type="submit" disabled={saving}>
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                {editingSkill ? 'Actualizar' : 'Crear'}
                            </Button>
                            {editingSkill && (
                                <Button type="button" variant="secondary" onClick={resetForm} disabled={saving}>
                                    Cancelar
                                </Button>
                            )}
                        </div>
                    </form>
                )}
            </CardContent>
        </Card>
    );
}
