import { useState, useEffect } from "react";
import { supabase } from "@/lib/customSupabaseClient";

// ─── Helpers ───────────────────────────────────────────────────────────────
const ESTADOS_COLOR = {
  pendiente: "bg-gray-100 text-gray-600",
  en_curso: "bg-blue-100 text-blue-700",
  completada: "bg-green-100 text-green-700",
};

const NIVEL_BADGE = {
  alto: "bg-red-100 text-red-700",
  medio: "bg-yellow-100 text-yellow-700",
  bajo: "bg-green-100 text-green-700",
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── PASO 1: Wizard de configuración ──────────────────────────────────────
function WizardConfig({ proyectoId, onGenerado }) {
  const [empleados, setEmpleados] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [fechaInicio, setFechaInicio] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase
      .from("empleados")
      .select("id, nombre, apellidos, rol")
      .eq("activo", true)
      .eq("baja", false)
      .in("rol", ["tecnico", "encargado"])
      .order("nombre")
      .then(({ data }) => setEmpleados(data || []));
  }, []);

  const toggleEmpleado = (id) => {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleGenerar = async () => {
    if (!fechaInicio) return setError("Selecciona la fecha de inicio de obra.");
    if (seleccionados.length === 0) return setError("Selecciona al menos un empleado.");
    setError(null);
    setLoading(true);
    try {
      await onGenerado(fechaInicio, seleccionados);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 text-white">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🧠</span>
          <div>
            <h2 className="text-lg font-bold">Replanteo automático con IA</h2>
            <p className="text-indigo-200 text-sm">
              Claude analizará el presupuesto y asignará empleados según sus habilidades
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Fecha inicio */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            📅 Fecha de inicio de obra
          </label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Selección de empleados */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            👷 Empleados disponibles para esta obra
          </label>
          <div className="grid grid-cols-2 gap-2">
            {empleados.map((emp) => {
              const activo = seleccionados.includes(emp.id);
              return (
                <button
                  key={emp.id}
                  onClick={() => toggleEmpleado(emp.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    activo
                      ? "bg-indigo-50 border-indigo-400 text-indigo-800"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                      activo ? "bg-indigo-500 border-indigo-500" : "border-gray-300"
                    }`}
                  />
                  {emp.nombre} {emp.apellidos}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {seleccionados.length} empleado{seleccionados.length !== 1 ? "s" : ""} seleccionado
            {seleccionados.length !== 1 ? "s" : ""}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}

        <button
          onClick={handleGenerar}
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold text-sm hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Claude está analizando el proyecto...
            </>
          ) : (
            <>🚀 Generar replanteo con IA</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Resultado: Vista de fases y tareas ───────────────────────────────────
function VistaReplanteo({ fases, empleadosMap, onVolcarGantt, onResetVolcado, volcadoHecho, proyectoId }) {
  const [expandidas, setExpandidas] = useState({});
  const [volcando, setVolcando] = useState(false);

  const toggleFase = (id) => setExpandidas((p) => ({ ...p, [id]: !p[id] }));

  const handleVolcar = async () => {
    setVolcando(true);
    try {
      await onVolcarGantt();
    } finally {
      setVolcando(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cabecera resumen */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-800">
            📋 {fases.length} fase{fases.length !== 1 ? "s" : ""} generadas
          </h3>
          <p className="text-sm text-gray-500">
            {fases.reduce((acc, f) => acc + (f.tareas?.length || 0), 0)} tareas en total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {volcadoHecho && (
            <button
              onClick={onResetVolcado}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 transition-all"
              title="Limpiaste el Gantt y quieres volver a volcar"
            >
              🔓 Desbloquear volcado
            </button>
          )}
          <button
            onClick={handleVolcar}
            disabled={volcadoHecho || volcando}
            className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
              volcadoHecho
                ? "bg-green-100 text-green-700 cursor-default"
                : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            }`}
          >
            {volcando ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Volcando...
              </>
            ) : volcadoHecho ? (
              <>✅ Volcado al Gantt</>
            ) : (
              <>📊 Volcar al Gantt</>
            )}
          </button>
        </div>
      </div>

      {/* Fases */}
      {fases.map((fase, idx) => (
        <div key={fase.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => toggleFase(fase.id)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <div className="text-left">
                <p className="font-semibold text-gray-800">{fase.nombre}</p>
                <p className="text-xs text-gray-500">
                  {formatDate(fase.fecha_inicio)} → {formatDate(fase.fecha_fin)} ·{" "}
                  {fase.tareas?.length || 0} tareas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADOS_COLOR[fase.estado]}`}>
                {fase.estado}
              </span>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${expandidas[fase.id] ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {expandidas[fase.id] && fase.tareas?.length > 0 && (
            <div className="border-t border-gray-100 divide-y divide-gray-50">
              {fase.tareas.map((tarea) => (
                <div key={tarea.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{tarea.titulo}</p>
                      {tarea.descripcion && (
                        <p className="text-xs text-gray-500 mt-0.5">{tarea.descripcion}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {tarea.fecha_inicio && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {formatDate(tarea.fecha_inicio)} → {formatDate(tarea.fecha_fin)}
                          </span>
                        )}
                        {tarea.habilidad_requerida && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                            🔧 {tarea.habilidad_requerida}
                          </span>
                        )}
                        {tarea.nivel_requerido && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${NIVEL_BADGE[tarea.nivel_requerido]}`}>
                            {tarea.nivel_requerido === "alto" ? "Oficial 1ª" : tarea.nivel_requerido === "medio" ? "Oficial 2ª" : "Ayuda"}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Empleados asignados */}
                    <div className="flex flex-col gap-1 items-end">
                      {tarea.empleados?.map((e) => (
                        <span key={e.empleado_id} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                          👷 {empleadosMap[e.empleado_id] || "—"}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────
export default function ReplanteoTab({ proyectoId }) {
  const [estado, setEstado] = useState("loading"); // loading | wizard | generando | resultado | error
  const [fases, setFases] = useState([]);
  const [empleadosMap, setEmpleadosMap] = useState({});
  const [volcadoHecho, setVolcadoHecho] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Cargar mapa de empleados para mostrar nombres
  const cargarEmpleadosMap = async () => {
    const { data } = await supabase.from("empleados").select("id, nombre, apellidos");
    const map = {};
    (data || []).forEach((e) => (map[e.id] = `${e.nombre} ${e.apellidos}`));
    setEmpleadosMap(map);
  };

  // Cargar si ya hay replanteo guardado
  const cargarReplanteoExistente = async () => {
    const { data: config } = await supabase
      .from("obras_replanteo_config")
      .select("*")
      .eq("proyecto_id", proyectoId)
      .maybeSingle();

    if (!config) return setEstado("wizard");

    setVolcadoHecho(config.volcado_gantt || false);
    await cargarFasesCompletas();
  };

  const cargarFasesCompletas = async () => {
    const { data: fasesData } = await supabase
      .from("obras_fases")
      .select("*")
      .eq("proyecto_id", proyectoId)
      .order("orden");

    if (!fasesData || fasesData.length === 0) return setEstado("wizard");

    const { data: tareasData } = await supabase
      .from("obras_tareas_replanteo")
      .select("*")
      .eq("proyecto_id", proyectoId)
      .order("orden");

    const { data: asignaciones } = await supabase
      .from("obras_tareas_replanteo_empleados")
      .select("*")
      .in("tarea_replanteo_id", (tareasData || []).map((t) => t.id));

    const fasesConTareas = fasesData.map((f) => ({
      ...f,
      tareas: (tareasData || [])
        .filter((t) => t.fase_id === f.id)
        .map((t) => ({
          ...t,
          empleados: (asignaciones || []).filter((a) => a.tarea_replanteo_id === t.id),
        })),
    }));

    setFases(fasesConTareas);
    setEstado("resultado");
  };

  useEffect(() => {
    if (!proyectoId) return;
    cargarEmpleadosMap();
    cargarReplanteoExistente();
  }, [proyectoId]);

  // ── Generar replanteo con IA ──────────────────────────────────────────
  const handleGenerarConIA = async (fechaInicio, empleadosSeleccionados) => {
    setEstado("generando");
    setErrorMsg("");

    try {
      // 1. Cargar partidas del presupuesto de la obra
      const { data: partidas } = await supabase
        .from("obras_partidas")
        .select("*")
        .eq("obra_id", proyectoId)
        .order("orden");

      // 2. Cargar habilidades de los empleados seleccionados
      const { data: habilidades } = await supabase
        .from("empleado_habilidades")
        .select("*, empleados(nombre, apellidos)")
        .in("empleado_id", empleadosSeleccionados);

      // 3. Cargar datos del proyecto
      const { data: proyecto } = await supabase
        .from("proyectos")
        .select("nombre_proyecto, descripcion, presupuesto_aceptado")
        .eq("id", proyectoId)
        .single();

      // 4. Construir prompt para Claude
      const apiKey = window.ANTHROPIC_CONFIG?.apiKey;
      if (!apiKey) throw new Error("No se encontró la API key de Anthropic en window.ANTHROPIC_CONFIG");

      const promptPartidas =
        partidas && partidas.length > 0
          ? partidas.map((p) => `- ${p.descripcion || p.codigo || JSON.stringify(p)} (${p.cantidad_total || ''} ${p.unidad || ''} x ${p.precio_unitario || ''}€)`).join("\n")
          : "(Sin partidas cargadas — usar descripción general del proyecto)";

      const promptHabilidades =
        habilidades && habilidades.length > 0
          ? habilidades
              .map(
                (h) =>
                  `${h.empleados?.nombre} ${h.empleados?.apellidos}: ${h.nombre} (nivel: ${h.nivel}${h.puede_ayudar ? ", puede ayudar" : ""})`
              )
              .join("\n")
          : "(Sin habilidades registradas)";

      const prompt = `Eres un jefe de obra experto en planificación de proyectos de construcción e instalaciones.

PROYECTO: ${proyecto?.nombre_proyecto || "Obra"}
DESCRIPCIÓN: ${proyecto?.descripcion || "Sin descripción"}
PRESUPUESTO ACEPTADO: ${proyecto?.presupuesto_aceptado ? proyecto.presupuesto_aceptado + " €" : "No definido"}
FECHA DE INICIO: ${fechaInicio}

PARTIDAS DEL PRESUPUESTO:
${promptPartidas}

EMPLEADOS DISPONIBLES Y SUS HABILIDADES:
${promptHabilidades}

TAREA: Genera un plan de obra completo y detallado siguiendo el orden lógico de ejecución.

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta (sin texto adicional, sin markdown):
{
  "fases": [
    {
      "nombre": "Nombre de la fase",
      "descripcion": "Descripción breve",
      "orden": 1,
      "fecha_inicio": "YYYY-MM-DD",
      "fecha_fin": "YYYY-MM-DD",
      "tareas": [
        {
          "titulo": "Nombre de la tarea",
          "descripcion": "Qué se hace exactamente",
          "orden": 1,
          "fecha_inicio": "YYYY-MM-DD",
          "fecha_fin": "YYYY-MM-DD",
          "duracion_dias": 3,
          "habilidad_requerida": "Nombre del oficio necesario",
          "nivel_requerido": "alto|medio|bajo",
          "empleados_asignados": ["Nombre Apellido del empleado más adecuado"]
        }
      ]
    }
  ]
}

Reglas OBLIGATORIAS:
- Genera entre 3 y 6 fases siguiendo el orden real de ejecución en obra
- Cada fase tendrá entre 1 y 4 tareas
- Las fechas deben ser reales partiendo del ${fechaInicio}
- CRÍTICO: Las fechas NUNCA pueden caer en sábado (día 6) ni domingo (día 0). Si una fecha calculada cae en fin de semana, muévela al lunes siguiente.
- CRÍTICO: Solo cuenta días laborables de lunes a viernes para calcular duraciones. Un trabajo de 3 días que empieza el jueves termina el lunes siguiente (no el sábado).
- Asigna empleados según sus habilidades registradas. Si un empleado tiene nivel "alto" en esa habilidad, asígnalo primero
- Pueden coincidir varias tareas en fechas si son independientes entre sí
- Sé específico y fiel a las partidas del presupuesto. No inventes trabajos que no están en el presupuesto.
- Si el presupuesto es de pladur y pintura, genera SOLO fases de pladur y pintura.`;

      // Llamada a la Edge Function (evita bloqueo CORS del navegador)
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = window.SUPABASE_CONFIG?.url;
      const supabaseKey = window.SUPABASE_CONFIG?.anonKey;

      const edgeResponse = await fetch(`${supabaseUrl}/functions/v1/claude-scanner`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
          "apikey": supabaseKey,
        },
        body: JSON.stringify({
          base64: null,
          mediaType: "text/plain",
          prompt: prompt,
        }),
      });

      if (!edgeResponse.ok) {
        const errText = await edgeResponse.text();
        throw new Error(`Error ${edgeResponse.status}: ${errText}`);
      }

      const data = await edgeResponse.json();
      const texto = data.content?.find((c) => c.type === "text")?.text || "";
      const clean = texto.replace(/```json|```/g, "").trim();
      const plan = JSON.parse(clean);

      // 5. Guardar config del replanteo
      await supabase.from("obras_replanteo_config").upsert({
        proyecto_id: proyectoId,
        fecha_inicio_obra: fechaInicio,
        empleados_disponibles: empleadosSeleccionados,
        volcado_gantt: false,
        generado_at: new Date().toISOString(),
      });

      // 6. Borrar replanteo anterior si existía
      const { data: fasesViejas } = await supabase
        .from("obras_fases")
        .select("id")
        .eq("proyecto_id", proyectoId);
      if (fasesViejas?.length > 0) {
        const idsViejos = fasesViejas.map((f) => f.id);
        const { data: tareasViejas } = await supabase
          .from("obras_tareas_replanteo")
          .select("id")
          .in("fase_id", idsViejos);
        if (tareasViejas?.length > 0) {
          await supabase
            .from("obras_tareas_replanteo_empleados")
            .delete()
            .in("tarea_replanteo_id", tareasViejas.map((t) => t.id));
          await supabase.from("obras_tareas_replanteo").delete().in("fase_id", idsViejos);
        }
        await supabase.from("obras_fases").delete().eq("proyecto_id", proyectoId);
      }

      // 7. Insertar fases, tareas y asignaciones
      const { data: empleadosData } = await supabase
        .from("empleados")
        .select("id, nombre, apellidos")
        .in("id", empleadosSeleccionados);

      for (const fase of plan.fases) {
        const { data: faseInsertada } = await supabase
          .from("obras_fases")
          .insert({
            proyecto_id: proyectoId,
            nombre: fase.nombre,
            descripcion: fase.descripcion,
            orden: fase.orden,
            fecha_inicio: fase.fecha_inicio,
            fecha_fin: fase.fecha_fin,
            estado: "pendiente",
            generado_por_ia: true,
          })
          .select()
          .single();

        for (const tarea of fase.tareas || []) {
          const { data: tareaInsertada } = await supabase
            .from("obras_tareas_replanteo")
            .insert({
              fase_id: faseInsertada.id,
              proyecto_id: proyectoId,
              titulo: tarea.titulo,
              descripcion: tarea.descripcion,
              orden: tarea.orden,
              fecha_inicio: tarea.fecha_inicio,
              fecha_fin: tarea.fecha_fin,
              duracion_dias: tarea.duracion_dias,
              habilidad_requerida: tarea.habilidad_requerida,
              nivel_requerido: tarea.nivel_requerido,
              estado: "pendiente",
            })
            .select()
            .single();

          // Asignar empleados por nombre
          for (const nombreCompleto of tarea.empleados_asignados || []) {
            const emp = (empleadosData || []).find((e) =>
              `${e.nombre} ${e.apellidos}`.toLowerCase() === nombreCompleto.toLowerCase() ||
              e.nombre.toLowerCase() === nombreCompleto.toLowerCase()
            );
            if (emp) {
              await supabase.from("obras_tareas_replanteo_empleados").insert({
                tarea_replanteo_id: tareaInsertada.id,
                empleado_id: emp.id,
                rol: "ejecutor",
              });
            }
          }
        }
      }

      await cargarFasesCompletas();
    } catch (e) {
      console.error(e);
      setErrorMsg(e.message || "Error al generar el replanteo");
      setEstado("wizard");
    }
  };

  // ── Volcar al Gantt ──────────────────────────────────────────────────
  const handleVolcarGantt = async () => {
    try {
      for (const fase of fases) {
        for (const tarea of fase.tareas || []) {
          const { data: tareaGantt } = await supabase
            .from("tareas")
            .insert({
              proyecto_id: proyectoId,
              titulo: `[${fase.nombre}] ${tarea.titulo}`,
              descripcion: tarea.descripcion || "",
              fecha_inicio: tarea.fecha_inicio,
              fecha_limite: tarea.fecha_fin,
              estado: "pendiente",
            })
            .select()
            .single();

          for (const asig of tarea.empleados || []) {
            await supabase.from("tarea_empleados").insert({
              tarea_id: tareaGantt.id,
              empleado_id: asig.empleado_id,
            });
          }
        }
      }

      await supabase
        .from("obras_replanteo_config")
        .update({ volcado_gantt: true, fecha_volcado: new Date().toISOString() })
        .eq("proyecto_id", proyectoId);

      setVolcadoHecho(true);
    } catch (e) {
      alert("Error al volcar al Gantt: " + e.message);
    }
  };

  // ── Resetear volcado (para poder volver a volcar tras limpiar el Gantt) ──
  const handleResetVolcado = async () => {
    await supabase
      .from("obras_replanteo_config")
      .update({ volcado_gantt: false, fecha_volcado: null })
      .eq("proyecto_id", proyectoId);
    setVolcadoHecho(false);
  };

  // ── Render ──────────────────────────────────────────────────────────
  if (estado === "loading") {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <svg className="animate-spin h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Cargando...
      </div>
    );
  }

  if (estado === "generando") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center animate-pulse">
          <span className="text-3xl">🧠</span>
        </div>
        <p className="font-semibold text-gray-700">Claude está analizando el proyecto...</p>
        <p className="text-sm text-gray-400">
          Revisando partidas, habilidades y generando el plan de obra
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex justify-between items-center">
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="text-red-400 hover:text-red-600 ml-4">✕</button>
        </div>
      )}

      {estado === "wizard" && (
        <WizardConfig proyectoId={proyectoId} onGenerado={handleGenerarConIA} />
      )}

      {estado === "resultado" && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => setEstado("wizard")}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
            >
              🔄 Regenerar replanteo
            </button>
          </div>
          <VistaReplanteo
            fases={fases}
            empleadosMap={empleadosMap}
            onVolcarGantt={handleVolcarGantt}
            onResetVolcado={handleResetVolcado}
            volcadoHecho={volcadoHecho}
            proyectoId={proyectoId}
          />
        </>
      )}
    </div>
  );
}
