import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Calendar as CalendarIcon, User, Briefcase, Timer, Loader2, Building2, StickyNote, Save, Trash2 } from 'lucide-react';
import { formatSecondsToHoursMinutes, fmtMadrid } from '@/lib/utils';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from '@/components/ui/use-toast';

// Fix for default Leaflet marker icons in React

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

const FichajeDetailModal = ({ fichajeId, isOpen, onClose }) => {
    const [fichaje, setFichaje] = useState(null);
    const [pausas, setPausas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Notes State
    const [noteText, setNoteText] = useState("");
    const [existingNoteId, setExistingNoteId] = useState(null);
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [isDeletingNote, setIsDeletingNote] = useState(false);

    useEffect(() => {
        const fetchDetails = async () => {
            if (!fichajeId) return;
            setLoading(true);
            setError(null);
            try {
                // 1. Fetch main fichaje data
                const { data: fichajeData, error: fichajeError } = await supabase
                    .from('control_horario')
                    .select(`
                        *,
                        empleado:empleados!control_horario_empleado_id_fkey (
                            id,
                            nombre,
                            apellidos,
                            email,
                            foto_url,
                            auth_user_id
                        ),
                        proyecto:proyectos!control_horario_proyecto_id_fkey (
                            id,
                            nombre_proyecto,
                            direccion_obra
                        ),
                        centro:centros_coste_internos!control_horario_centro_coste_interno_id_fkey (
                            id,
                            nombre_centro,
                            es_taller
                        )
                    `)
                    .eq('id', fichajeId)
                    .single();

                if (fichajeError) throw fichajeError;

                // 2. Fetch View Data
                const { data: viewData, error: viewError } = await supabase
                    .from('v_fichajes_admin_neto_v5')
                    .select('duracion_neta_segundos, saldo_dia, horas_normales_dia, horas_extra_dia, pausa_segundos')
                    .eq('id', fichajeId)
                    .maybeSingle();
                
                if (viewError) console.warn("View data fetch warning:", viewError);

                // 3. Fetch Pauses
                const { data: pausasData, error: pausasError } = await supabase
                    .from('pausas')
                    .select('*')
                    .eq('fichaje_id', fichajeId)
                    .order('hora_inicio_pausa', { ascending: true });

                if (pausasError) throw pausasError;

                // 4. Fetch Note
                const { data: noteData, error: noteError } = await supabase
                    .from('horas_extras_notas')
                    .select('id, nota')
                    .eq('fichaje_id', fichajeId)
                    .maybeSingle();
                
                if (noteError && noteError.code !== 'PGRST116') {
                    console.error("Error fetching note:", noteError);
                }

                // Set note state
                if (noteData) {
                    setNoteText(noteData.nota || "");
                    setExistingNoteId(noteData.id);
                } else {
                    setNoteText("");
                    setExistingNoteId(null);
                }

                // Construct display object
                const empleadoNombre = fichajeData.empleado 
                    ? `${fichajeData.empleado.nombre || ''} ${fichajeData.empleado.apellidos || ''}`.trim() 
                    : 'Empleado desconocido';

                let mainLocationName = 'Sin asignar';
                let isProject = false;
                let address = null;

                if (fichajeData.proyecto_id && fichajeData.proyecto) {
                    mainLocationName = fichajeData.proyecto.nombre_proyecto;
                    isProject = true;
                    address = fichajeData.proyecto.direccion_obra;
                } else if (fichajeData.centro_coste_interno_id && fichajeData.centro) {
                    mainLocationName = fichajeData.centro.nombre_centro;
                    isProject = false; 
                } else if (fichajeData.tipo === 'nave_taller' || fichajeData.tipo === 'entrada_nave') {
                     mainLocationName = 'Nave / Taller (Genérico)';
                }

                setFichaje({
                    ...fichajeData,
                    ...viewData,
                    empleado_nombre_completo: empleadoNombre,
                    empleado_email: fichajeData.empleado?.email,
                    display_location_name: mainLocationName,
                    display_location_type: isProject ? 'Obra / Proyecto' : 'Nave / Taller / Interno',
                    display_address: address,
                    pausa_segundos: viewData?.pausa_segundos ?? 0 
                });
                
                setPausas(pausasData || []);

            } catch (err) {
                console.error("Error loading fichaje details:", err);
                setError("No se pudo cargar la información del fichaje.");
                setFichaje(null);
            } finally {
                setLoading(false);
            }
        };

        if (isOpen) {
            fetchDetails();
        } else {
            setFichaje(null);
            setPausas([]);
            setNoteText("");
            setExistingNoteId(null);
            setLoading(true);
            setError(null);
        }
    }, [fichajeId, isOpen]);

    const handleSaveNote = async () => {
        if (!fichaje) return;
        
        if (!noteText.trim()) {
            toast({
                title: "Nota vacía",
                description: "Escribe algo o usa el botón de eliminar.",
                variant: "destructive"
            });
            return;
        }

        setIsSavingNote(true);
        try {
            const user = (await supabase.auth.getUser()).data.user;
            
            // Resolve created_by (employee id of current user)
            const { data: empData } = await supabase
                .from('empleados')
                .select('id')
                .eq('auth_user_id', user.id)
                .single();

            const payload = {
                fichaje_id: fichajeId,
                empleado_id: fichaje.empleado_id, // Required by schema
                dia: fichaje.hora_entrada ? fichaje.hora_entrada.split('T')[0] : new Date().toISOString().split('T')[0], // Required by schema
                proyecto_id: fichaje.proyecto_id || null,
                nota: noteText.trim(),
                updated_at: new Date().toISOString(),
                created_by: empData?.id
            };

            const { data, error } = await supabase
                .from('horas_extras_notas')
                .upsert(payload, { onConflict: 'fichaje_id' })
                .select()
                .single();

            if (error) throw error;

            setExistingNoteId(data.id);
            toast({
                title: "Nota guardada",
                description: "La nota se ha actualizado correctamente.",
            });
        } catch (error) {
            console.error('Error saving note:', error);
            toast({
                title: "Error",
                description: "No se pudo guardar la nota.",
                variant: "destructive"
            });
        } finally {
            setIsSavingNote(false);
        }
    };

    const handleDeleteNote = async () => {
        if (!existingNoteId) return;

        setIsDeletingNote(true);
        try {
            const { error } = await supabase
                .from('horas_extras_notas')
                .delete()
                .eq('id', existingNoteId);

            if (error) throw error;

            setNoteText("");
            setExistingNoteId(null);
            toast({
                title: "Nota eliminada",
                description: "La nota ha sido borrada.",
            });
        } catch (error) {
            console.error('Error deleting note:', error);
            toast({
                title: "Error",
                description: "No se pudo eliminar la nota.",
                variant: "destructive"
            });
        } finally {
            setIsDeletingNote(false);
        }
    };

    if (!isOpen) return null;

    const formatTime = (dateStr) => dateStr ? fmtMadrid(dateStr, 'time') : '--:--';
    const formatDate = (dateStr) => dateStr ? fmtMadrid(dateStr, 'date') : 'Fecha desconocida';

    const hasLocation = fichaje && ((fichaje.latitud && fichaje.longitud) || (fichaje.latitud_salida && fichaje.longitud_salida));
    const centerLat = fichaje?.latitud || fichaje?.latitud_salida || 40.416775;
    const centerLon = fichaje?.longitud || fichaje?.longitud_salida || -3.703790;

    const timelineEvents = !fichaje ? [] : [
        {
            type: 'entry',
            timeStr: fichaje.hora_entrada,
            label: 'Entrada',
            icon: <Clock className="w-4 h-4 text-green-600" />,
            color: 'bg-green-100 border-green-200',
            originalTime: new Date(fichaje.hora_entrada_utc || fichaje.hora_entrada)
        },
        ...pausas.map(p => ({
            type: 'pause_start',
            timeStr: p.hora_inicio_pausa,
            label: 'Inicio Pausa',
            icon: <Timer className="w-4 h-4 text-orange-600" />,
            color: 'bg-orange-100 border-orange-200',
            originalTime: new Date(p.hora_inicio_pausa)
        })),
        ...pausas.map(p => {
            if (!p.hora_fin_pausa) return null;
            return {
                type: 'pause_end',
                timeStr: p.hora_fin_pausa,
                label: 'Fin Pausa',
                icon: <Timer className="w-4 h-4 text-orange-600" />,
                color: 'bg-orange-100 border-orange-200',
                originalTime: new Date(p.hora_fin_pausa)
            };
        }).filter(Boolean),
        ...(fichaje.hora_salida ? [{
            type: 'exit',
            timeStr: fichaje.hora_salida,
            label: 'Salida',
            icon: <Clock className="w-4 h-4 text-red-600" />,
            color: 'bg-red-100 border-red-200',
            originalTime: new Date(fichaje.hora_salida_utc || fichaje.hora_salida)
        }] : [])
    ].sort((a, b) => a.originalTime - b.originalTime);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-50/50 p-0 gap-0">
                
                {/* Header */}
                <div className="p-6 bg-white border-b sticky top-0 z-10">
                    {loading ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin" /> Cargando detalles...
                        </div>
                    ) : error || !fichaje ? (
                        <div className="flex items-center gap-2 text-red-500">
                            <Briefcase className="w-5 h-5" /> {error || "No se encontraron datos."}
                        </div>
                    ) : (
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                    <User className="w-6 h-6 text-primary" />
                                    {fichaje.empleado_nombre_completo}
                                </DialogTitle>
                                <DialogDescription className="mt-1 flex items-center gap-2 text-base">
                                    <CalendarIcon className="w-4 h-4" />
                                    {formatDate(fichaje.hora_entrada)}
                                    {fichaje.empleado_email && <span className="text-xs text-muted-foreground ml-2">({fichaje.empleado_email})</span>}
                                </DialogDescription>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <Badge variant={fichaje?.hora_salida ? "outline" : "default"} className={fichaje?.hora_salida ? "bg-slate-100 text-slate-700 border-slate-200" : "bg-green-500 hover:bg-green-600"}>
                                    {fichaje?.hora_salida ? 'Jornada Finalizada' : 'En Curso'}
                                </Badge>
                                <span className="text-xs text-muted-foreground font-mono">ID: {fichaje?.id?.slice(0, 8)}</span>
                            </div>
                        </div>
                    )}
                </div>

                {!loading && !error && fichaje && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x">
                        
                        {/* Left Column: Details & Timeline */}
                        <div className="col-span-1 lg:col-span-1 p-6 space-y-8 bg-white">
                            
                            {/* Obra y Proyecto */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Building2 className="w-4 h-4" /> Obra y Proyecto
                                </h4>
                                <div className={`p-4 rounded-xl border shadow-sm transition-colors ${fichaje.proyecto_id ? 'bg-blue-50/50 border-blue-200 hover:bg-blue-50' : 'bg-orange-50/50 border-orange-200 hover:bg-orange-50'}`}>
                                    <div className="flex flex-col">
                                        <span className={`text-xs font-semibold uppercase tracking-wider mb-1 ${fichaje.proyecto_id ? 'text-blue-600' : 'text-orange-600'}`}>
                                            {fichaje.display_location_type}
                                        </span>
                                        <span className="text-xl font-bold text-gray-900 leading-tight">
                                            {fichaje.display_location_name}
                                        </span>
                                        {fichaje.display_address && (
                                            <div className="flex items-start gap-1.5 mt-3 text-sm text-gray-600">
                                                <MapPin className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />
                                                <span>{fichaje.display_address}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <span className="text-xs text-muted-foreground block mb-1">Duración Neta</span>
                                    <span className="text-lg font-bold text-slate-900">
                                        {formatSecondsToHoursMinutes(fichaje.duracion_neta_segundos || 0)}
                                    </span>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <span className="text-xs text-muted-foreground block mb-1">Pausas</span>
                                    <span className="text-lg font-bold text-slate-900">
                                        {formatSecondsToHoursMinutes(fichaje.pausa_segundos || 0)}
                                    </span>
                                </div>
                                {(fichaje.horas_extra_dia > 0 || fichaje.horas_normales_dia > 0) && (
                                    <div className="col-span-2 p-3 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center">
                                        <div>
                                            <span className="text-xs text-muted-foreground block">Balance Día</span>
                                            <span className="text-sm font-bold text-slate-900">
                                                Normal: {fichaje.horas_normales_dia}h
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs text-muted-foreground block">Extras</span>
                                            <span className={`text-sm font-bold ${fichaje.horas_extra_dia > 0 ? 'text-green-600' : 'text-slate-900'}`}>
                                                +{fichaje.horas_extra_dia}h
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Notas Section */}
                            <div className="space-y-3 pt-2 border-t border-slate-100">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                        <StickyNote className="w-4 h-4" /> Notas de Gestión
                                    </h4>
                                    {existingNoteId && (
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                            onClick={handleDeleteNote}
                                            disabled={isDeletingNote || isSavingNote}
                                        >
                                            {isDeletingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                        </Button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Textarea 
                                        placeholder="Añadir nota interna sobre este fichaje..." 
                                        className="min-h-[80px] bg-amber-50/30 resize-none text-sm"
                                        value={noteText}
                                        onChange={(e) => setNoteText(e.target.value)}
                                    />
                                    <Button 
                                        size="sm" 
                                        className="w-full bg-slate-800 hover:bg-slate-700" 
                                        onClick={handleSaveNote}
                                        disabled={isSavingNote || isDeletingNote}
                                    >
                                        {isSavingNote ? (
                                            <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Guardando...</>
                                        ) : (
                                            <><Save className="w-3 h-3 mr-2" /> Guardar Nota</>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {/* Timeline */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Timer className="w-4 h-4" /> Cronología (Madrid)
                                </h4>
                                <div className="relative pl-4 border-l-2 border-slate-100 space-y-6">
                                    {timelineEvents.map((event, idx) => (
                                        <div key={idx} className="relative">
                                            <div className={`absolute -left-[21px] top-1 w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${event.color}`}>
                                                {event.icon}
                                            </div>
                                            <div className="pl-4">
                                                <p className="text-sm font-medium text-slate-900">{event.label}</p>
                                                <p className="text-xs text-slate-500 font-mono">
                                                    {formatTime(event.timeStr)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Map */}
                        <div className="col-span-1 lg:col-span-2 bg-slate-50 h-[400px] lg:h-auto min-h-[400px] relative">
                            {hasLocation ? (
                                <MapContainer 
                                    center={[centerLat, centerLon]} 
                                    zoom={15} 
                                    scrollWheelZoom={false}
                                    className="h-full w-full z-0"
                                >
                                    <TileLayer
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />
                                    {fichaje.latitud && fichaje.longitud && (
                                        <Marker position={[fichaje.latitud, fichaje.longitud]}>
                                            <Popup>
                                                <div className="text-center">
                                                    <strong className="block text-green-600">Entrada</strong>
                                                    <span className="text-xs">{formatTime(fichaje.hora_entrada)}</span>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    )}
                                    {fichaje.latitud_salida && fichaje.longitud_salida && (
                                        <Marker position={[fichaje.latitud_salida, fichaje.longitud_salida]}>
                                            <Popup>
                                                <div className="text-center">
                                                    <strong className="block text-red-600">Salida</strong>
                                                    <span className="text-xs">{formatTime(fichaje.hora_salida)}</span>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    )}
                                </MapContainer>
                            ) : (
                                <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                                    <MapPin className="w-16 h-16 mb-4 opacity-20" />
                                    <p className="font-medium">Sin datos GPS</p>
                                    <p className="text-sm max-w-xs mt-2">Este fichaje no tiene coordenadas registradas para entrada ni salida.</p>
                                </div>
                            )}
                            
                            {/* Overlay info if Map exists */}
                            {hasLocation && (
                                <div className="absolute bottom-4 left-4 right-4 z-[400] bg-white/90 backdrop-blur-sm p-3 rounded-lg border shadow-sm text-xs flex gap-4 justify-center">
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-blue-500 border border-white shadow-sm block"></span>
                                        <span>Entrada</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-blue-500 border border-white shadow-sm block opacity-50"></span>
                                        <span>Salida</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default FichajeDetailModal;