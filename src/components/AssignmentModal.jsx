import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, User, Users, Loader2, X, Plus, Briefcase, Search, ChevronRight, ArrowLeft, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { ScrollArea } from "@/components/ui/scroll-area";

const AssignmentModal = ({ isOpen, onClose, executionId, executionTitle, onAssignmentComplete }) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [employees, setEmployees] = useState([]);
    
    // Selection state
    const [selectedEncargado, setSelectedEncargado] = useState(null);
    const [selectedTecnicos, setSelectedTecnicos] = useState([]);

    // UI State
    const [pickerMode, setPickerMode] = useState(null); // null (summary), 'encargado', 'tecnico'
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchInitialData();
            setPickerMode(null);
            setSearchQuery('');
        } else {
            setTimeout(() => {
                setSelectedEncargado(null);
                setSelectedTecnicos([]);
                setPickerMode(null);
            }, 200);
        }
    }, [isOpen, executionId]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const { data: emps, error: empError } = await supabase
                .from('empleados')
                .select('id, nombre, apellidos, rol, foto_url, auth_user_id')
                .eq('activo', true)
                .order('nombre');

            if (empError) throw empError;
            setEmployees(emps || []);

            if (executionId) {
                const { data: assignments, error: assignError } = await supabase
                    .from('ejecucion_asignaciones_v2')
                    .select('user_id, rol')
                    .eq('ejecucion_id', executionId);

                if (assignError) throw assignError;

                const currentEncargado = assignments.find(a => a.rol === 'encargado');
                const currentTecnicos = assignments.filter(a => a.rol === 'tecnico');

                if (currentEncargado && emps) {
                    const emp = emps.find(e => e.auth_user_id === currentEncargado.user_id);
                    if (emp) setSelectedEncargado(emp.id);
                }

                const tecIds = [];
                if (currentTecnicos && emps) {
                    currentTecnicos.forEach(t => {
                        const emp = emps.find(e => e.auth_user_id === t.user_id);
                        if (emp) tecIds.push(emp.id);
                    });
                }
                setSelectedTecnicos(tecIds);
            }

        } catch (error) {
            console.error("AssignmentModal Error:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los datos.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const encargadoUser = selectedEncargado 
                ? employees.find(e => e.id === selectedEncargado)?.auth_user_id 
                : null;
            
            const tecnicosUsers = selectedTecnicos.map(tId => {
                const emp = employees.find(e => e.id === tId);
                return emp ? emp.auth_user_id : null;
            }).filter(Boolean);

            const { error } = await supabase.rpc('rpc_asignar_ejecucion_v2', {
                p_ejecucion_id: executionId,
                p_tecnicos: tecnicosUsers,
                p_encargado: encargadoUser
            });

            if (error) throw error;

            toast({ title: 'Asignación guardada', description: 'Los cambios se han aplicado correctamente.' });
            if (onAssignmentComplete) onAssignmentComplete();
            onClose();

        } catch (error) {
            console.error("AssignmentModal Save Error:", error);
            toast({ variant: 'destructive', title: 'Error al guardar', description: error.message });
        } finally {
            setSaving(false);
        }
    };

    // --- Helpers ---

    const getInitials = (name, surname) => {
        return `${name?.charAt(0) || ''}${surname?.charAt(0) || ''}`.toUpperCase();
    };

    const getEmployeeFullName = (emp) => {
        if (!emp) return '';
        return `${emp.nombre} ${emp.apellidos || ''}`.trim();
    };

    const toggleTecnico = (empId) => {
        setSelectedTecnicos(prev => {
            const isSelected = prev.includes(empId);
            if (isSelected) {
                return prev.filter(id => id !== empId);
            } else {
                return [...prev, empId];
            }
        });
    };

    const removeTecnico = (empId, e) => {
        if(e) e.stopPropagation();
        setSelectedTecnicos(prev => prev.filter(id => id !== empId));
    };

    // --- Filter Logic ---

    const filteredEmployees = useMemo(() => {
        // Step 1: Filter by strict Role/User rules
        // Allowed: 
        // - Role 'encargado'
        // - Role 'tecnico'
        // - Admin ONLY if name is 'Mikelo' (case insensitive check)
        const allowed = employees.filter(emp => {
            const r = (emp.rol || '').toLowerCase();
            const n = (emp.nombre || '').toLowerCase();

            if (r === 'encargado' || r === 'tecnico') return true;
            
            // Check specifically for Admin Mikelo
            if (r === 'admin' && n.includes('mikelo')) return true;
            
            return false;
        });

        // Step 2: Search query
        if (!searchQuery) return allowed;
        const lowerQ = searchQuery.toLowerCase();
        return allowed.filter(emp => 
            getEmployeeFullName(emp).toLowerCase().includes(lowerQ) ||
            (emp.rol && emp.rol.toLowerCase().includes(lowerQ))
        );
    }, [employees, searchQuery]);

    // --- Render Components ---

    const EmployeeRow = ({ emp, isSelected, onClick }) => (
        <div 
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border select-none",
                isSelected 
                    ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800" 
                    : "bg-white dark:bg-slate-900 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-200"
            )}
        >
            <Avatar className="h-10 w-10 border border-slate-200 dark:border-slate-700">
                <AvatarImage src={emp.foto_url} />
                <AvatarFallback className="bg-slate-100 text-slate-600 font-bold">
                    {getInitials(emp.nombre, emp.apellidos)}
                </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <p className={cn("font-medium text-sm truncate", isSelected ? "text-indigo-700 dark:text-indigo-300" : "text-slate-900 dark:text-slate-100")}>
                    {getEmployeeFullName(emp)}
                </p>
                <p className="text-xs text-muted-foreground capitalize">{emp.rol}</p>
            </div>
            {isSelected && (
                <div className="h-6 w-6 bg-indigo-600 rounded-full flex items-center justify-center shadow-sm animate-in zoom-in-50 duration-200">
                    <Check className="h-3.5 w-3.5 text-white" />
                </div>
            )}
        </div>
    );

    const renderPickerView = () => (
        <div className="flex flex-col h-full bg-slate-50/50 dark:bg-black/20">
            {/* Picker Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 flex gap-2 items-center flex-none">
                <Button variant="ghost" size="icon" onClick={() => setPickerMode(null)} className="h-8 w-8 -ml-2">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex-1">
                    <h3 className="font-semibold text-sm">
                        {pickerMode === 'encargado' ? 'Seleccionar Encargado' : 'Añadir Técnicos'}
                    </h3>
                </div>
            </div>

            {/* Search Bar */}
            <div className="p-4 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-10 flex-none">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                        autoFocus
                    />
                </div>
            </div>

            {/* List - Wrapped in div with overflow-y-auto and max-height as requested */}
            {/* Max height set to 300px (or similar equivalent in vh for responsive) as requested */}
            <div className="flex-1 overflow-y-auto p-4 max-h-[300px] min-h-[200px]">
                <div className="space-y-2 pb-4">
                    {filteredEmployees.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            No se encontraron empleados con los criterios seleccionados.
                        </div>
                    ) : (
                        filteredEmployees.map(emp => {
                            const isSelected = pickerMode === 'encargado' 
                                ? selectedEncargado === emp.id 
                                : selectedTecnicos.includes(emp.id);
                            
                            return (
                                <EmployeeRow 
                                    key={emp.id} 
                                    emp={emp} 
                                    isSelected={isSelected}
                                    onClick={() => {
                                        if (pickerMode === 'encargado') {
                                            setSelectedEncargado(emp.id);
                                            setPickerMode(null); // Close immediately
                                        } else {
                                            toggleTecnico(emp.id);
                                        }
                                    }}
                                />
                            );
                        })
                    )}
                </div>
            </div>

            {/* Footer for Picker */}
            {pickerMode === 'tecnico' && (
                <div className="p-4 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex-none">
                    <Button className="w-full" onClick={() => setPickerMode(null)}>
                        Listo ({selectedTecnicos.length} seleccionados)
                    </Button>
                </div>
            )}
        </div>
    );

    const renderSummaryView = () => {
        const encargadoDisplay = employees.find(e => e.id === selectedEncargado);

        return (
            <ScrollArea className="flex-1 h-full">
                <div className="p-6 space-y-8">
                    
                    {/* Encargado Selection */}
                    <div className="space-y-3">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <User className="w-3.5 h-3.5" /> Encargado / Responsable
                        </Label>
                        
                        <div 
                            onClick={() => {
                                setSearchQuery('');
                                setPickerMode('encargado');
                            }}
                            className={cn(
                                "group relative flex items-center gap-4 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all active:scale-[0.99]",
                                selectedEncargado 
                                    ? "bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-900 shadow-sm" 
                                    : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-indigo-300 hover:bg-indigo-50/30"
                            )}
                        >
                            {encargadoDisplay ? (
                                <>
                                    <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                                        <AvatarImage src={encargadoDisplay.foto_url} />
                                        <AvatarFallback className="bg-indigo-100 text-indigo-700">
                                            {getInitials(encargadoDisplay.nombre, encargadoDisplay.apellidos)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <p className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                                            {getEmployeeFullName(encargadoDisplay)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Responsable asignado</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                                </>
                            ) : (
                                <div className="flex items-center justify-center w-full py-2 text-muted-foreground gap-2">
                                    <span className="font-medium">Seleccionar encargado...</span>
                                </div>
                            )}
                        </div>
                        {selectedEncargado && (
                            <div className="flex justify-end">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-xs h-7 text-red-500 hover:bg-red-50 hover:text-red-600"
                                    onClick={(e) => { e.stopPropagation(); setSelectedEncargado(null); }}
                                >
                                    <Trash2 className="w-3 h-3 mr-1" /> Quitar
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent" />

                    {/* Tecnicos Selection */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <Users className="w-3.5 h-3.5" /> Técnicos Asignados ({selectedTecnicos.length})
                            </Label>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 rounded-full text-xs font-medium border-dashed border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800"
                                onClick={() => {
                                    setSearchQuery('');
                                    setPickerMode('tecnico');
                                }}
                            >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Añadir / Editar
                            </Button>
                        </div>

                        {selectedTecnicos.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {selectedTecnicos.map(techId => {
                                    const emp = employees.find(e => e.id === techId);
                                    if (!emp) return null;
                                    return (
                                        <div key={techId} className="flex items-center gap-3 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={emp.foto_url} />
                                                <AvatarFallback className="text-xs bg-emerald-100 text-emerald-700">
                                                    {getInitials(emp.nombre, emp.apellidos)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="flex-1 text-sm font-medium truncate">
                                                {getEmployeeFullName(emp)}
                                            </span>
                                            <button 
                                                onClick={(e) => removeTecnico(techId, e)}
                                                className="p-1 rounded-full text-slate-400 hover:bg-red-100 hover:text-red-500 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-8 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50">
                                <p className="text-sm text-muted-foreground">No hay técnicos asignados aún.</p>
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(val) => { if (!val) onClose(); }}>
            <DialogContent className="max-w-md md:max-w-lg h-[80vh] md:h-auto md:max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl">
                
                {/* Fixed Header */}
                <div className="flex-none p-5 border-b border-slate-100 dark:border-slate-800">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-indigo-500" />
                            Gestión de Equipo
                        </DialogTitle>
                        <DialogDescription className="text-sm line-clamp-1">
                            {executionTitle}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Dynamic Content Area (Summary or Picker) */}
                <div className="flex-1 overflow-hidden relative flex flex-col">
                    {loading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-black/80 z-20">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                            <p className="text-xs text-muted-foreground">Cargando datos...</p>
                        </div>
                    ) : null}

                    {pickerMode ? renderPickerView() : renderSummaryView()}
                </div>

                {/* Fixed Footer (only on summary view) */}
                {!pickerMode && (
                    <div className="flex-none p-5 border-t border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button 
                                type="button"
                                variant="outline" 
                                onClick={onClose} 
                                disabled={saving} 
                                className="w-full sm:w-auto"
                            >
                                Cancelar
                            </Button>
                            <Button 
                                type="button"
                                onClick={handleSave} 
                                disabled={saving || loading} 
                                className={cn(
                                    "w-full sm:w-auto shadow-md",
                                    "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white border-0"
                                )}
                            >
                                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                Guardar Cambios
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default AssignmentModal;