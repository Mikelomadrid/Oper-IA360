import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock, LogIn, LogOut, MapPin, Building2, Wrench,
  Loader2, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { fmtMadrid } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

const NAVE_TALLER_SENTINEL = '00000000-0000-0000-0000-000000000001';

/**
 * Devuelve la hora local de Madrid en formato naive "YYYY-MM-DD HH:mm:ss"
 * (igual que guarda el cliente de los técnicos en hora_entrada).
 */
function madridNaiveNow(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(date); // -> "2026-06-17 10:25:55"
}

/** GPS opcional: si el usuario lo deniega o falla, devolvemos null sin bloquear. */
function getPositionSafe() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  });
}

function formatElapsed(ms) {
  if (ms == null || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function FichajeAdmin() {
  const [empleado, setEmpleado] = useState(null);     // { id, nombre, rol }
  const [openSession, setOpenSession] = useState(null); // fila de control_horario abierta
  const [destinos, setDestinos] = useState([]);
  const [destinoSel, setDestinoSel] = useState('');    // destino_id seleccionado
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);       // bloqueo durante INSERT/UPDATE
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now());

  const timerRef = useRef(null);

  // -- Cronómetro en vivo cuando hay sesión abierta --
  useEffect(() => {
    if (openSession) {
      timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [openSession]);

  const loadOpenSession = useCallback(async (empleadoId) => {
    const { data, error } = await supabase
      .from('control_horario')
      .select('id, tipo, proyecto_id, centro_coste_interno_id, hora_entrada, hora_entrada_utc')
      .eq('empleado_id', empleadoId)
      .is('hora_salida', null)
      .order('hora_entrada', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }, []);

  // -- Carga inicial: empleado, destinos y sesión abierta --
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No hay sesión de usuario.');

        const { data: emp, error: empErr } = await supabase
          .from('empleados')
          .select('id, nombre, rol')
          .eq('auth_user_id', user.id)
          .eq('activo', true)
          .maybeSingle();
        if (empErr) throw empErr;
        if (!emp) throw new Error('Tu usuario no está vinculado a una ficha de empleado activa.');

        const { data: dests, error: destErr } = await supabase
          .from('v_destinos_fichaje')
          .select('tipo, destino_id, nombre, centro_coste_interno_id, estado')
          .eq('estado', 'activo');
        if (destErr) throw destErr;

        const open = await loadOpenSession(emp.id);

        if (!alive) return;
        setEmpleado(emp);
        setDestinos(dests || []);
        setOpenSession(open);
      } catch (err) {
        console.error('Error inicializando fichaje admin:', err);
        if (alive) setError(err.message || 'No se pudo cargar el fichaje.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [loadOpenSession]);

  const handleEntrada = async () => {
    if (!empleado || !destinoSel) {
      toast({ title: 'Selecciona un destino', description: 'Elige una obra o la nave/taller antes de fichar.', variant: 'destructive' });
      return;
    }
    const destino = destinos.find((d) => d.destino_id === destinoSel);
    if (!destino) return;

    setWorking(true);
    try {
      const pos = await getPositionSafe();
      const instant = new Date();

      const esProyecto = destino.tipo === 'proyecto';
      const payload = {
        empleado_id: empleado.id,
        tipo: esProyecto ? 'entrada_obra' : 'nave_taller',
        proyecto_id: esProyecto ? destino.destino_id : null,
        centro_coste_interno_id: esProyecto ? null : destino.destino_id,
        hora_entrada: madridNaiveNow(instant),
        hora_entrada_utc: instant.toISOString(),
        latitud: pos?.lat ?? null,
        longitud: pos?.lon ?? null,
      };

      const { data, error } = await supabase
        .from('control_horario')
        .insert(payload)
        .select('id, tipo, proyecto_id, centro_coste_interno_id, hora_entrada, hora_entrada_utc')
        .single();
      if (error) throw error;

      setOpenSession(data);
      setDestinoSel('');
      toast({ title: 'Entrada registrada', description: `Fichaje iniciado en ${destino.nombre}.` });
    } catch (err) {
      console.error('Error en entrada:', err);
      toast({ title: 'Error', description: 'No se pudo registrar la entrada.', variant: 'destructive' });
    } finally {
      setWorking(false);
    }
  };

  const handleSalida = async () => {
    if (!openSession) return;
    setWorking(true);
    try {
      const pos = await getPositionSafe();
      const instant = new Date();

      const { error } = await supabase
        .from('control_horario')
        .update({
          hora_salida: instant.toISOString(),
          hora_salida_utc: instant.toISOString(),
          latitud_salida: pos?.lat ?? null,
          longitud_salida: pos?.lon ?? null,
        })
        .eq('id', openSession.id);
      if (error) throw error;

      setOpenSession(null);
      toast({ title: 'Salida registrada', description: 'Jornada cerrada correctamente.' });
    } catch (err) {
      console.error('Error en salida:', err);
      toast({ title: 'Error', description: 'No se pudo registrar la salida.', variant: 'destructive' });
    } finally {
      setWorking(false);
    }
  };

  // ---------------- Render ----------------

  if (loading) {
    return (
      <Card className="w-full max-w-md mx-auto shadow-sm border rounded-xl">
        <CardContent className="p-8 flex justify-center items-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-3" /> Cargando fichaje...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-md mx-auto shadow-sm border rounded-xl border-red-100 bg-red-50/30">
        <CardContent className="p-6 flex items-center text-red-600">
          <AlertTriangle className="h-5 w-5 mr-2 shrink-0" /> {error}
        </CardContent>
      </Card>
    );
  }

  const proyectos = destinos.filter((d) => d.tipo === 'proyecto');
  const centros = destinos.filter((d) => d.tipo === 'centro');

  // Hora de entrada de la sesión abierta (para el cronómetro)
  const entradaMs = openSession
    ? new Date(openSession.hora_entrada_utc || openSession.hora_entrada).getTime()
    : null;

  let destinoNombreAbierto = null;
  if (openSession) {
    const match = destinos.find((d) =>
      (openSession.proyecto_id && d.destino_id === openSession.proyecto_id) ||
      (openSession.centro_coste_interno_id && d.destino_id === openSession.centro_coste_interno_id)
    );
    destinoNombreAbierto = match?.nombre
      || (openSession.tipo === 'nave_taller' ? 'Nave / Taller' : 'Obra');
  }

  return (
    <Card className="w-full max-w-md mx-auto shadow-md border rounded-xl overflow-hidden">
      <CardHeader className="bg-muted/30 border-b pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Mi Fichaje
        </CardTitle>
        {empleado && (
          <p className="text-sm text-muted-foreground">
            {empleado.nombre} · <span className="uppercase">{empleado.rol}</span>
          </p>
        )}
      </CardHeader>

      <CardContent className="p-6 space-y-5">
        {openSession ? (
          // ---- SESIÓN ABIERTA: mostrar estado + botón salida ----
          <>
            <div className="flex items-center justify-between">
              <Badge className="bg-green-500 hover:bg-green-600">En curso</Badge>
              <span className="text-xs text-muted-foreground">
                Entrada: {fmtMadrid(openSession.hora_entrada_utc || openSession.hora_entrada, 'time')}
              </span>
            </div>

            <div className="rounded-xl border bg-blue-50/40 border-blue-200 p-4 flex items-start gap-3">
              {openSession.tipo === 'nave_taller'
                ? <Wrench className="w-5 h-5 text-blue-600 mt-0.5" />
                : <Building2 className="w-5 h-5 text-blue-600 mt-0.5" />}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  {openSession.tipo === 'nave_taller' ? 'Nave / Taller' : 'Obra / Proyecto'}
                </p>
                <p className="text-base font-bold text-gray-900 leading-tight">{destinoNombreAbierto}</p>
              </div>
            </div>

            <div className="text-center py-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Tiempo trabajado</p>
              <p className="text-4xl font-bold font-mono text-slate-900 tabular-nums">
                {formatElapsed(now - entradaMs)}
              </p>
            </div>

            <Button
              size="lg"
              className="w-full bg-red-600 hover:bg-red-700 h-12 text-base"
              onClick={handleSalida}
              disabled={working}
            >
              {working
                ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Registrando...</>
                : <><LogOut className="w-5 h-5 mr-2" /> Fichar Salida</>}
            </Button>
          </>
        ) : (
          // ---- SIN SESIÓN: selector de destino + botón entrada ----
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Destino del fichaje</label>
              <select
                value={destinoSel}
                onChange={(e) => setDestinoSel(e.target.value)}
                disabled={working}
                className="w-full h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">— Selecciona obra o nave —</option>
                {proyectos.length > 0 && (
                  <optgroup label="Obras / Proyectos">
                    {proyectos.map((d) => (
                      <option key={d.destino_id} value={d.destino_id}>{d.nombre}</option>
                    ))}
                  </optgroup>
                )}
                {centros.length > 0 && (
                  <optgroup label="Nave / Taller / Interno">
                    {centros.map((d) => (
                      <option key={d.destino_id} value={d.destino_id}>{d.nombre}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Se intentará registrar tu ubicación GPS. Si la deniegas, el fichaje se guarda igualmente sin coordenadas.</span>
            </div>

            <Button
              size="lg"
              className="w-full bg-green-600 hover:bg-green-700 h-12 text-base"
              onClick={handleEntrada}
              disabled={working || !destinoSel}
            >
              {working
                ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Registrando...</>
                : <><LogIn className="w-5 h-5 mr-2" /> Fichar Entrada</>}
            </Button>

            <div className="flex items-center gap-2 text-xs text-slate-400 justify-center pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> No tienes ningún fichaje abierto
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
