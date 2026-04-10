import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function MedicionesRegistro({ obraId, partidas, empleados, onClose, onGuardado }) {
  const [partidaId, setPartidaId] = useState("");
  const [empleadoId, setEmpleadoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(false);

  const partidaActual = partidas.find((p) => p.id === partidaId);

  const guardar = async () => {
    if (!partidaId || !empleadoId || !cantidad) {
      setError("Completa todos los campos obligatorios.");
      return;
    }
    setGuardando(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Buscar asignación existente o crear una
      let asignacionId = null;
      const { data: asig } = await supabase
        .from("obras_partidas_asignaciones")
        .select("id")
        .eq("partida_id", partidaId)
        .eq("empleado_id", empleadoId)
        .single();

      if (asig) {
        asignacionId = asig.id;
      } else {
        // Crear asignación automáticamente si no existe
        const { data: newAsig } = await supabase
          .from("obras_partidas_asignaciones")
          .insert({ partida_id: partidaId, empleado_id: empleadoId, obra_id: obraId, asignado_por: user?.id })
          .select()
          .single();
        asignacionId = newAsig?.id;
      }

      const { error: regError } = await supabase.from("obras_partidas_registro").insert({
        partida_id: partidaId,
        asignacion_id: asignacionId,
        empleado_id: empleadoId,
        obra_id: obraId,
        fecha,
        cantidad_ejecutada: parseFloat(cantidad),
        notas: notas || null,
        registrado_por: user?.id,
      });

      if (regError) throw regError;

      setExito(true);
      setTimeout(() => {
        onGuardado?.();
        // Reset para otro registro
        setCantidad("");
        setNotas("");
        setExito(false);
      }, 1200);
    } catch (err) {
      setError("Error al guardar: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const overlay = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
    zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
  };
  const modal = {
    background: "var(--color-background-primary, #fff)",
    borderRadius: "16px", width: "100%", maxWidth: "480px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden",
  };
  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: "8px",
    border: "1px solid var(--color-border-secondary, #d1d5db)",
    fontSize: "14px", background: "transparent",
    color: "var(--color-text-primary)", boxSizing: "border-box",
  };
  const label = { display: "block", fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "6px" };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--color-border-tertiary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 600, fontSize: "16px" }}>✏️ Registrar avance</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: "var(--color-text-secondary)" }}>✕</button>
        </div>

        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>

          <div>
            <label style={label}>Partida *</label>
            <select value={partidaId} onChange={(e) => setPartidaId(e.target.value)} style={inputStyle}>
              <option value="">Selecciona una partida...</option>
              {partidas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigo ? `[${p.codigo}] ` : ""}{p.descripcion}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={label}>Empleado *</label>
            <select value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)} style={inputStyle}>
              <option value="">Selecciona un empleado...</option>
              {empleados.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.nombre} {emp.apellidos}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={label}>
                Cantidad ejecutada * {partidaActual && <span style={{ fontWeight: 400 }}>({partidaActual.unidad})</span>}
              </label>
              <input
                type="number"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={label}>Fecha *</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {partidaActual && (
            <div style={{ padding: "10px 14px", background: "var(--color-background-secondary)", borderRadius: "8px", fontSize: "13px", color: "var(--color-text-secondary)" }}>
              Total partida: <strong>{partidaActual.cantidad_total} {partidaActual.unidad}</strong>
            </div>
          )}

          <div>
            <label style={label}>Notas (opcional)</label>
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones..."
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{ padding: "10px 14px", background: "#fef2f2", borderRadius: "8px", color: "#dc2626", fontSize: "13px" }}>
              ⚠️ {error}
            </div>
          )}

          {exito && (
            <div style={{ padding: "10px 14px", background: "#f0fdf4", borderRadius: "8px", color: "#16a34a", fontSize: "13px", fontWeight: 500 }}>
              ✅ Registro guardado correctamente
            </div>
          )}
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--color-border-tertiary)", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", cursor: "pointer", background: "#f3f4f6", color: "#374151", fontWeight: 500 }}>
            Cerrar
          </button>
          <button
            onClick={guardar}
            disabled={guardando || !partidaId || !empleadoId || !cantidad}
            style={{
              padding: "10px 20px", borderRadius: "8px", border: "none", cursor: "pointer",
              background: "#16a34a", color: "#fff", fontWeight: 500,
              opacity: (!partidaId || !empleadoId || !cantidad || guardando) ? 0.4 : 1,
            }}
          >
            {guardando ? "Guardando..." : "💾 Guardar registro"}
          </button>
        </div>
      </div>
    </div>
  );
}
