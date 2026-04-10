import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapPin, Play, Utensils, PlayCircle, Square, AlertCircle, Loader2 } from 'lucide-react';

// Fix for default marker icons in React-Leaflet/Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to handle map bounds automatically
const MapBoundsHandler = ({ locations }) => {
  const map = useMap();

  useEffect(() => {
    if (locations.length > 0) {
      try {
        const bounds = L.latLngBounds(locations.map(l => [l.lat, l.lon]));
        // Add some padding to the bounds
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      } catch (e) {
        console.error("Error setting map bounds:", e);
      }
    }
  }, [locations, map]);

  return null;
};

const createCustomIcon = (IconComponent, colorClass) => {
  // Mapping basic tailwind color classes to hex values for inline styles
  const colorMap = {
    'bg-green-500': '#22c55e',
    'bg-red-500': '#ef4444',
    'bg-amber-500': '#f59e0b',
    'bg-blue-500': '#3b82f6',
    'bg-gray-500': '#6b7280',
  };
  
  const color = colorMap[colorClass] || '#3b82f6';

  const iconMarkup = renderToStaticMarkup(
    <div style={{
      backgroundColor: color,
      width: '32px',
      height: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '50%',
      border: '2px solid white',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
    }}>
      <IconComponent color="white" size={16} />
    </div>
  );

  return L.divIcon({
    html: iconMarkup,
    className: 'custom-marker-icon', // Use a class to avoid default Leaflet square styles if any
    iconSize: [32, 32],
    iconAnchor: [16, 16], // Center of the circle
    popupAnchor: [0, -20]
  });
};

const TimeClockMap = ({ employeeId, date, fichajeId, height = "h-96" }) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchTimeClockData = async () => {
      if (!fichajeId && !employeeId) {
        if (isMounted) setLoading(false);
        return;
      }

      // Avoid setting loading true if we are just refreshing data for the same entity slightly?
      // For now, we set it to true to show activity, but we rely on the OVERLAY instead of unmounting.
      if (isMounted) {
        setLoading(true);
        setError(null);
      }

      let entry = null;

      try {
        if (fichajeId) {
          // Fetch specific fichaje
          const { data, error } = await supabase
            .from('control_horario')
            .select('id, hora_entrada, hora_salida, latitud, longitud, latitud_salida, longitud_salida')
            .eq('id', fichajeId)
            .single();
          
          if (error) throw error;
          entry = data;
        } else {
          // Fetch by date/employee
          const targetDate = date ? new Date(date) : new Date();
          targetDate.setHours(0, 0, 0, 0);
          const nextDate = new Date(targetDate);
          nextDate.setDate(nextDate.getDate() + 1);

          const { data, error } = await supabase
            .from('control_horario')
            .select('id, hora_entrada, hora_salida, latitud, longitud, latitud_salida, longitud_salida')
            .eq('empleado_id', employeeId)
            .gte('hora_entrada', targetDate.toISOString())
            .lt('hora_entrada', nextDate.toISOString())
            .order('hora_entrada', { ascending: false })
            .limit(1);

          if (error) throw error;
          if (data && data.length > 0) {
            entry = data[0];
          }
        }

        if (!entry) {
          // Keep specific error if ID was provided, otherwise just generic info
          if (isMounted) {
             setError(fichajeId ? 'Fichaje no encontrado' : 'No hay datos de fichaje para esta fecha.');
             setLocations([]);
          }
          return;
        }

        let points = [];

        // Entry Point
        if (entry.latitud && entry.longitud) {
          points.push({ 
            type: 'Entrada', 
            lat: Number(entry.latitud), 
            lon: Number(entry.longitud), 
            icon: Play, 
            color: 'bg-green-500',
            time: entry.hora_entrada
          });
        }

        // Exit Point
        if (entry.latitud_salida && entry.longitud_salida) {
          points.push({ 
            type: 'Salida', 
            lat: Number(entry.latitud_salida), 
            lon: Number(entry.longitud_salida), 
            icon: Square, 
            color: 'bg-red-500',
            time: entry.hora_salida
          });
        }

        // Fetch Pauses
        const { data: pauseData, error: pauseError } = await supabase
          .from('pausas')
          .select('latitud_inicio, longitud_inicio, latitud_fin, longitud_fin, hora_inicio_pausa, hora_fin_pausa')
          .eq('fichaje_id', entry.id);

        if (!pauseError && pauseData) {
          pauseData.forEach((p, idx) => {
            if (p.latitud_inicio && p.longitud_inicio) {
              points.push({ 
                type: `Pausa ${idx + 1} (Inicio)`, 
                lat: Number(p.latitud_inicio), 
                lon: Number(p.longitud_inicio), 
                icon: Utensils, 
                color: 'bg-amber-500',
                time: p.hora_inicio_pausa
              });
            }
            if (p.latitud_fin && p.longitud_fin) {
              points.push({ 
                type: `Pausa ${idx + 1} (Fin)`, 
                lat: Number(p.latitud_fin), 
                lon: Number(p.longitud_fin), 
                icon: PlayCircle, 
                color: 'bg-blue-500',
                time: p.hora_fin_pausa
              });
            }
          });
        }
        
        const validPoints = points.filter(p => 
          !isNaN(p.lat) && !isNaN(p.lon) && p.lat !== 0 && p.lon !== 0
        );

        if (isMounted) {
          if (validPoints.length === 0) {
            setError("No hay coordenadas GPS registradas para este fichaje.");
            setLocations([]);
          } else {
            setLocations(validPoints);
          }
        }

      } catch (err) {
        console.error("Error loading map data:", err);
        if (isMounted) {
          setError('Error al cargar datos del mapa.');
          setLocations([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTimeClockData();

    return () => {
      isMounted = false;
    };
  }, [employeeId, date, fichajeId]);

  // Use overlay for loading instead of unmounting the map to prevent DOM errors in React-Leaflet
  return (
    <div className={`${height} w-full rounded-xl overflow-hidden border border-border shadow-sm relative z-0 bg-card group`}>
      
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-[1000] bg-background/50 backdrop-blur-[1px] flex flex-col items-center justify-center text-muted-foreground transition-all duration-300">
          <div className="bg-background/80 p-4 rounded-full shadow-lg border mb-2">
             <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
          <span className="text-xs font-medium bg-background/80 px-2 py-1 rounded-md shadow-sm">Actualizando mapa...</span>
        </div>
      )}

      {/* Error Overlay - Now sits ON TOP of the map instead of replacing it */}
      {error && !loading && (
        <div className="absolute inset-0 z-[900] bg-muted/90 flex items-center justify-center backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <AlertCircle className="w-8 h-8" />
            <span className="text-sm px-4 text-center">{error}</span>
          </div>
        </div>
      )}

      {/* MapContainer - Always rendered to preserve DOM node stability */}
      <MapContainer 
          center={[40.416775, -3.703790]} 
          zoom={6} 
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom={false}
      >
          <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {locations.map((loc, idx) => (
          <Marker 
              key={`${idx}-${loc.type}-${loc.time}`} 
              position={[loc.lat, loc.lon]}
              icon={createCustomIcon(loc.icon, loc.color)}
          >
              <Popup>
              <div className="text-sm p-1">
                  <p className="font-bold mb-1 flex items-center gap-2">
                  {loc.type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                  {new Date(loc.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                  <div className="mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground grid grid-cols-2 gap-x-2">
                  <span>Lat: {loc.lat.toFixed(5)}</span>
                  <span>Lon: {loc.lon.toFixed(5)}</span>
                  </div>
              </div>
              </Popup>
          </Marker>
          ))}
          <MapBoundsHandler locations={locations} />
      </MapContainer>
    </div>
  );
};

export default TimeClockMap;