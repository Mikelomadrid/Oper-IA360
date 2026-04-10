import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Image as ImageIcon, Calendar, User, Briefcase, MessageSquare, Wrench, Hash, Clock } from 'lucide-react';
import { fmtMadrid } from '@/lib/utils';

const DetalleSolicitudHerramienta = ({ solicitudId }) => {
    const [data, setData] = useState(null);
    const [evidences, setEvidences] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchSolicitud = async () => {
            if (!solicitudId) return;
            setLoading(true);
            setError(null);
            try {
                // 1. Try fetching from the view (includes photos)
                const { data: viewData, error: viewError } = await supabase
                    .from('v_herr_solicitudes_con_fotos_v2')
                    .select('*')
                    .eq('solicitud_id', solicitudId);

                if (viewError) throw viewError;

                if (viewData && viewData.length > 0) {
                    // Found in view
                    const headerInfo = viewData[0];
                    setData(headerInfo);
                    
                    // Extract valid evidences
                    const evs = viewData
                        .filter(item => item.evidencia_id && item.evidencia_url)
                        .map(item => ({
                            id: item.evidencia_id,
                            url: item.evidencia_url,
                            notes: item.evidencia_notas,
                            created_at: item.evidencia_created_at
                        }));
                    setEvidences(evs);
                } else {
                    // 2. Fallback: Fetch basic details from table if view returns nothing (e.g. no photos or inner join issue)
                    const { data: tableData, error: tableError } = await supabase
                        .from('herramienta_solicitudes')
                        .select(`
                            *,
                            herramientas (nombre, marca, modelo),
                            empleados!herramienta_solicitudes_solicitada_por_fkey (nombre, apellidos),
                            proyectos (nombre_proyecto),
                            atendedor:empleados!herramienta_solicitudes_atendida_por_fkey (nombre, apellidos)
                        `)
                        .eq('id', solicitudId)
                        .single();
                    
                    if (tableError) {
                        setError("Solicitud no encontrada.");
                    } else {
                        // Transform table data to match view structure roughly for display
                        setData({
                            solicitud_id: tableData.id,
                            herramienta_id: tableData.herramienta_id,
                            proyecto_id: tableData.proyecto_id,
                            estado: tableData.estado,
                            solicitada_por: tableData.solicitada_por,
                            created_at: tableData.created_at,
                            atendida_por: tableData.atendida_por,
                            atendida_at: tableData.atendida_at,
                            mensaje: tableData.mensaje
                        });
                        setEvidences([]);
                    }
                }
            } catch (err) {
                console.error("Error fetching solicitud:", err);
                setError("Error cargando la solicitud.");
            } finally {
                setLoading(false);
            }
        };

        fetchSolicitud();
    }, [solicitudId]);

    // Helper to get public URL as requested
    const getImageUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        // Assuming bucket is 'herramienta_fotos' based on context
        const { data } = supabase.storage.from('herramienta_fotos').getPublicUrl(path);
        return data.publicUrl;
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    if (error) return <div className="p-8 text-center text-destructive bg-destructive/10 rounded-md border border-destructive/20">{error}</div>;
    if (!data) return null;

    return (
        <div className="w-full max-w-6xl mx-auto p-6 space-y-8 animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-6">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3 tracking-tight">
                        <FileTextIcon className="w-8 h-8 text-primary" />
                        Detalle de Solicitud
                    </h1>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                        <Hash className="w-3 h-3" />
                        <span className="font-mono bg-muted/50 px-1.5 py-0.5 rounded text-xs">{data.solicitud_id}</span>
                    </div>
                </div>
                <Badge 
                    variant={data.estado === 'pendiente' ? 'outline' : data.estado === 'aceptada' || data.estado === 'atendida' ? 'default' : 'destructive'} 
                    className="text-base px-4 py-1.5 uppercase tracking-wide"
                >
                    {data.estado}
                </Badge>
            </div>

            {/* Solicitation Data Card */}
            <Card className="shadow-sm border-border/60">
                <CardHeader className="bg-muted/30 pb-4 border-b border-border/40">
                    <CardTitle className="text-lg font-semibold text-foreground/90">Datos de la Solicitud</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="space-y-5">
                        <DataItem icon={Wrench} label="Herramienta ID" value={data.herramienta_id} mono />
                        <DataItem icon={Briefcase} label="Proyecto ID" value={data.proyecto_id || 'N/A'} mono />
                        <DataItem icon={User} label="Solicitada Por" value={data.solicitada_por} mono />
                        <DataItem icon={Calendar} label="Fecha Creación" value={fmtMadrid(data.created_at)} />
                    </div>

                    <div className="space-y-5">
                        <DataItem icon={User} label="Atendida Por" value={data.atendida_por || '-'} mono />
                        <DataItem icon={Clock} label="Fecha Atención" value={data.atendida_at ? fmtMadrid(data.atendida_at) : '-'} />
                        
                        <div className="pt-2">
                            <span className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" /> Mensaje / Motivo:
                            </span>
                            <div className="bg-muted/40 p-4 rounded-lg border border-border/50 text-sm text-foreground/90 italic">
                                {data.mensaje || "Sin mensaje"}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Evidence Repeater Section */}
            <div className="space-y-6 pt-4">
                <h3 className="text-xl font-semibold flex items-center gap-2 text-foreground/90">
                    <ImageIcon className="w-5 h-5 text-primary" />
                    Evidencias Adjuntas 
                    <Badge variant="secondary" className="ml-2">{evidences.length}</Badge>
                </h3>

                {evidences.length === 0 ? (
                    <div className="text-center py-16 bg-muted/5 border border-dashed border-border rounded-2xl">
                        <ImageIcon className="w-14 h-14 mx-auto text-muted-foreground/20 mb-3" />
                        <p className="text-muted-foreground font-medium">No hay evidencias asociadas a esta solicitud</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {evidences.map((ev) => (
                            <Card key={ev.id} className="group overflow-hidden hover:shadow-md transition-all border-border/60 bg-card">
                                <div className="aspect-[4/3] w-full bg-muted relative overflow-hidden">
                                    <img 
                                        src={getImageUrl(ev.url)} 
                                        alt={ev.notes || 'Evidencia'} 
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                        loading="lazy"
                                    />
                                </div>
                                <CardContent className="p-5 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <Badge variant="outline" className="text-[10px] px-1.5 h-5 font-mono text-muted-foreground bg-background">
                                            {ev.id.slice(0, 8)}...
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {fmtMadrid(ev.created_at, 'date')}
                                        </span>
                                    </div>
                                    <div className="text-sm text-foreground/80 line-clamp-2">
                                        {ev.notes || <span className="text-muted-foreground italic">Sin notas</span>}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// Mini helper component for consistent data rows
const DataItem = ({ icon: Icon, label, value, mono }) => (
    <div className="grid grid-cols-[140px_1fr] items-center">
        <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary/70" /> {label}:
        </span>
        <span className={`text-sm ${mono ? 'font-mono bg-muted/50 px-2 py-0.5 rounded text-foreground/80 w-fit' : 'text-foreground'}`}>
            {value}
        </span>
    </div>
);

// Helper icon since I used a custom name above
const FileTextIcon = (props) => (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <line x1="10" x2="8" y1="9" y2="9" />
    </svg>
);

export default DetalleSolicitudHerramienta;