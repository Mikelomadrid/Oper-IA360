import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, RefreshCw, MapPin, User, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Fix default icon issues in React Leaflet by manually defining icon paths

let DefaultIcon = L.icon({
    iconUrl: '/leaflet/marker-icon.png',
    shadowUrl: '/leaflet/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Component to auto-fit bounds to markers
const FitBounds = ({ markers }) => {
    const map = useMap();
    useEffect(() => {
        if (markers.length > 0) {
            try {
                const bounds = L.latLngBounds(markers.map(m => [m.latitud, m.longitud]));
                if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
                }
            } catch (e) {
                console.error("Error fitting bounds:", e);
            }
        }
    }, [markers, map]);
    return null;
};

const MapaTecnicos = () => {
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchLocations = async () => {
        setLoading(true);
        try {
            // Fetch active clock-ins (abierto = true) with valid coordinates
            const { data, error } = await supabase
                .from('v_fichajes_admin_ui')
                .select('*')
                .eq('abierto', true)
                .not('latitud', 'is', null)
                .not('longitud', 'is', null);

            if (error) {
                console.error("Error fetching locations", error);
            } else {
                // Optional: filter out invalid coordinates (0,0 or crazy values)
                const validData = (data || []).filter(l => 
                    l.latitud !== 0 && l.longitud !== 0 && 
                    l.latitud > -90 && l.latitud < 90 &&
                    l.longitud > -180 && l.longitud < 180
                );
                setLocations(validData);
            }
        } catch (err) {
            console.error("Unexpected error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLocations();
        // Auto refresh every minute
        const interval = setInterval(fetchLocations, 60000);
        return () => clearInterval(interval);
    }, []);

    // Default center (e.g., Madrid) if no markers
    const defaultCenter = [40.416775, -3.703790]; 

    return (
        <div className="p-4 md:p-8 h-[calc(100vh-64px)] flex flex-col space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 gradient-text">
                        <MapPin className="w-8 h-8 text-primary" />
                        Mapa de Técnicos
                    </h1>
                    <p className="text-muted-foreground mt-1">Seguimiento en tiempo real de empleados con jornada activa.</p>
                </div>
                <Button variant="outline" onClick={fetchLocations} disabled={loading} className="shadow-sm">
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Actualizar Mapa
                </Button>
            </div>

            <Card className="flex-1 overflow-hidden flex flex-col min-h-[400px] border shadow-lg">
                <CardContent className="p-0 flex-1 relative z-0 h-full">
                     {locations.length === 0 && !loading && (
                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-card/90 backdrop-blur px-4 py-2 rounded-full shadow-md border border-border text-sm text-muted-foreground flex items-center gap-2">
                            <User className="w-4 h-4" />
                            No hay técnicos activos con ubicación en este momento.
                        </div>
                     )}
                     
                     <MapContainer center={defaultCenter} zoom={6} style={{ height: '100%', width: '100%' }}>
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                        {locations.map((loc) => (
                            <Marker key={loc.id} position={[loc.latitud, loc.longitud]}>
                                <Tooltip direction="top" offset={[0, -40]} opacity={1}>
                                    <span className="font-semibold text-sm">{loc.empleado_nombre}</span>
                                </Tooltip>
                                <Popup className="custom-popup">
                                    <div className="p-1 min-w-[240px]">
                                        <div className="flex items-center gap-3 mb-3 pb-2 border-b">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(loc.empleado_nombre)}&background=random`} />
                                                <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <h3 className="font-bold text-sm leading-none">{loc.empleado_nombre}</h3>
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{loc.empleado_rol}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-start gap-2">
                                                <Briefcase className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                                <div className="leading-tight">
                                                    <span className="block font-medium text-xs text-muted-foreground">Ubicación Actual</span>
                                                    <span className="block font-semibold text-foreground">{loc.proyecto_nombre || 'Sin Proyecto Asignado'}</span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex justify-between items-center pt-2 mt-2 border-t border-dashed">
                                                <span className="text-xs text-muted-foreground">Hora Entrada:</span>
                                                <span className="font-mono font-medium text-xs bg-muted px-1.5 py-0.5 rounded">
                                                    {new Date(loc.hora_entrada).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </span>
                                            </div>
                                            
                                            <div className="mt-2 pt-1">
                                                <Badge 
                                                    variant={loc.tipo === 'entrada_obra' ? 'default' : 'secondary'}
                                                    className="w-full justify-center"
                                                >
                                                    {loc.tipo === 'entrada_obra' ? 'En Obra' : 'En Taller/Nave'}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                        <FitBounds markers={locations} />
                    </MapContainer>
                </CardContent>
            </Card>
        </div>
    );
};

export default MapaTecnicos;