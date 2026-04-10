import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import MedicionesScanner from "./MedicionesScanner";
import MedicionesRegistro from "./MedicionesRegistro";

export default function MedicionesPanel({ obraId, obraNombre, userRol }) {
  const [partidas, setPartidas] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [showRegistro, setShowRegistro] = useState(false);
  const [partidaSeleccionada, setPartidaSeleccionada] = useState(null);
  const [tab, setTab] = useState("partidas"); // partidas | resumen

  const puedeEditar = ["admin", "encargado"].includes(userRol);

  useEffect(() => {
    cargarDatos();
  }, [obraId]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [{ data: p }, { data: e }, { data: r }] = await Promise.all([
        supabase
          .from("obras_partidas")
          .select(`
            *,
            obras_partidas_asignaciones (
              id, empleado_id,
              empleados ( id, nombre, apellidos )
            )
          `)
          .eq("obra_id", obraId)
          .eq("activa", true)
          .order("orden"),
        supabase.from("empleados").select("id, nombre, apellidos").eq("activo", true).order("nombre"),
        supabase
          .from("obras_partidas_registro")
          .select("*, empleados(nombre, apellidos)")
          .eq("obra_id", obraId)
          .order("fecha", { ascending: false }),
      ]);
      setPartidas(p || []);
      setEmpleados(e || []);
      setRegistros(r || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const asignarEmpleado = async (partidaId, empleadoId) => {
    if (!empleadoId) return;
    const yaExiste = partidas
      .find((p) => p.id === partidaId)
      ?.obras_partidas_asignaciones?.some((a) => a.empleado_id === empleadoId);
    if (yaExiste) return;

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("obras_partidas_asignaciones").insert({
      partida_id: partidaId,
      empleado_id: empleadoId,
      obra_id: obraId,
      asignado_por: user?.id,
    });
    cargarDatos();
  };

  const quitarAsignacion = async (asignacionId) => {
    await supabase.from("obras_partidas_asignaciones").delete().eq("id", asignacionId);
    cargarDatos();
  };

  // Calcular totales por partida
  const totalEjecutado = (partidaId) =>
    registros.filter((r) => r.partida_id === partidaId).reduce((s, r) => s + (r.cantidad_ejecutada || 0), 0);

  const pct = (ejecutado, total) => (total > 0 ? Math.min(100, Math.round((ejecutado / total) * 100)) : 0);

  // ── ESTILOS ──
  const card = {
    background: "var(--color-background-secondary, #f9fafb)",
    borderRadius: "10px", border: "1px solid var(--color-border-tertiary, #e5e7eb)",
    padding: "16px", marginBottom: "12px",
  };
  const badge = (color) => ({
    display: "inline-block", padding: "2px 8px", borderRadius: "20px",
    fontSize: "11px", fontWeight: 600,
    background: color === "green" ? "#dcfce7" : color === "amber" ? "#fef9c3" : "#f3f4f6",
    color: color === "green" ? "#15803d" : color === "amber" ? "#92400e" : "#6b7280",
  });
  const tabBtn = (active) => ({
    padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer",
    fontWeight: active ? 600 : 400, fontSize: "14px",
    background: active ? "#2563eb" : "transparent",
    color: active ? "#fff" : "var(--color-text-secondary)",
  });

  if (loading) return <div style={{ padding: "32px", textAlign: "center", color: "var(--color-text-secondary)" }}>Cargando mediciones...</div>;

  return (
    <div style={{ padding: "0" }}>

      {/* CABECERA */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => setTab("partidas")} style={tabBtn(tab === "partidas")}>Partidas</button>
          <button onClick={() => setTab("resumen")} style={tabBtn(tab === "resumen")}>Resumen por empleado</button>
        </div>
        {puedeEditar && (
          <div style={{ display: "flex", gap: "8px" }}>
            {partidas.length > 0 && (
              <button
                onClick={() => { setPartidaSeleccionada(null); setShowRegistro(true); }}
                style={{ padding: "9px 16px", borderRadius: "8px", border: "none", cursor: "pointer", background: "#16a34a", color: "#fff", fontWeight: 500, fontSize: "14px" }}
              >
                ✏️ Registrar avance
              </button>
            )}
            <button
              onClick={() => setShowScanner(true)}
              style={{ padding: "9px 16px", borderRadius: "8px", border: "none", cursor: "pointer", background: "#2563eb", color: "#fff", fontWeight: 500, fontSize: "14px" }}
            >
              📄 Subir PDF
            </button>
          </div>
        )}
      </div>

      {/* TAB: PARTIDAS */}
      {tab === "partidas" && (
        <>
          {partidas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--color-text-secondary)" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>📐</div>
              <div style={{ fontWeight: 600, marginBottom: "6px" }}>Sin partidas todavía</div>
              <div style={{ fontSize: "14px" }}>Sube un PDF de presupuesto o plano para extraer las partidas automáticamente</div>
            </div>
          ) : (
            partidas.map((partida) => {
              const ejecutado = totalEjecutado(partida.id);
              const porcentaje = pct(ejecutado, partida.cantidad_total);
              const asignaciones = partida.obras_partidas_asignaciones || [];

              return (
                <div key={partida.id} style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "10px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        {partida.codigo && (
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280", background: "#f3f4f6", padding: "1px 6px", borderRadius: "4px" }}>
                            {partida.codigo}
                          </span>
                        )}
                        <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--color-text-primary)" }}>
                          {partida.descripcion}
                        </span>
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                        Total: <strong>{partida.cantidad_total} {partida.unidad}</strong>
                        {partida.precio_unitario && ` · ${partida.precio_unitario}€/${partida.unidad}`}
                      </div>
                    </div>
                    <span style={badge(porcentaje >= 100 ? "green" : porcentaje > 0 ? "amber" : "gray")}>
                      {porcentaje}%
                    </span>
                  </div>

                  {/* Barra de progreso */}
                  <div style={{ height: "6px", background: "#e5e7eb", borderRadius: "3px", overflow: "hidden", marginBottom: "12px" }}>
                    <div style={{
                      height: "100%", borderRadius: "3px", transition: "width 0.5s",
                      width: `${porcentaje}%`,
                      background: porcentaje >= 100 ? "#16a34a" : "#2563eb",
                    }} />
                  </div>

                  <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginBottom: "10px" }}>
                    Ejecutado: <strong>{ejecutado} {partida.unidad}</strong> de {partida.cantidad_total} {partida.unidad}
                  </div>

                  {/* Asignaciones */}
                  {puedeEditar && (
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "6px" }}>
                        EMPLEADOS ASIGNADOS
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                        {asignaciones.map((a) => (
                          <span key={a.id} style={{
                            display: "inline-flex", alignItems: "center", gap: "4px",
                            background: "#dbeafe", color: "#1e40af", padding: "3px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 500
                          }}>
                            {a.empleados?.nombre} {a.empleados?.apellidos}
                            <button onClick={() => quitarAsignacion(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#3b82f6", fontSize: "14px", padding: "0 0 0 2px", lineHeight: 1 }}>✕</button>
                          </span>
                        ))}
                        {asignaciones.length === 0 && (
                          <span style={{ fontSize: "12px", color: "#9ca3af" }}>Sin asignar</span>
                        )}
                      </div>
                      <select
                        defaultValue=""
                        onChange={(e) => { asignarEmpleado(partida.id, e.target.value); e.target.value = ""; }}
                        style={{ fontSize: "12px", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--color-border-secondary, #d1d5db)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}
                      >
                        <option value="">+ Asignar empleado...</option>
                        {empleados.filter((emp) => !asignaciones.some((a) => a.empleado_id === emp.id)).map((emp) => (
                          <option key={emp.id} value={emp.id}>{emp.nombre} {emp.apellidos}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>
      )}

      {/* TAB: RESUMEN POR EMPLEADO */}
      {tab === "resumen" && (
        <div>
          {empleados.filter((emp) =>
            registros.some((r) => r.empleado_id === emp.id)
          ).length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--color-text-secondary)" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>📊</div>
              <div style={{ fontWeight: 600 }}>Sin registros aún</div>
            </div>
          ) : (
            empleados
              .filter((emp) => registros.some((r) => r.empleado_id === emp.id))
              .map((emp) => {
                const regsEmp = registros.filter((r) => r.empleado_id === emp.id);
                const porPartida = partidas.map((p) => ({
                  partida: p,
                  ejecutado: regsEmp.filter((r) => r.partida_id === p.id).reduce((s, r) => s + (r.cantidad_ejecutada || 0), 0),
                })).filter((x) => x.ejecutado > 0);

                return (
                  <div key={emp.id} style={{ ...card, marginBottom: "16px" }}>
                    <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "12px", color: "var(--color-text-primary)" }}>
                      👷 {emp.nombre} {emp.apellidos}
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--color-border-secondary)" }}>
                          <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600 }}>Partida</th>
                          <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 600 }}>Ejecutado</th>
                          <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 600 }}>% sobre total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {porPartida.map(({ partida, ejecutado }) => (
                          <tr key={partida.id} style={{ borderBottom: "1px solid var(--color-border-tertiary)" }}>
                            <td style={{ padding: "6px 8px", color: "var(--color-text-primary)" }}>
                              {partida.codigo && <span style={{ color: "#9ca3af", marginRight: "6px" }}>{partida.codigo}</span>}
                              {partida.descripcion}
                            </td>
                            <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 500 }}>
                              {ejecutado} {partida.unidad}
                            </td>
                            <td style={{ padding: "6px 8px", textAlign: "right" }}>
                              <span style={badge(pct(ejecutado, partida.cantidad_total) >= 100 ? "green" : "amber")}>
                                {pct(ejecutado, partida.cantidad_total)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })
          )}
        </div>
      )}

      {/* MODALES */}
      {showScanner && (
        <MedicionesScanner
          obraId={obraId}
          obraNombre={obraNombre}
          onClose={() => setShowScanner(false)}
          onConfirmado={cargarDatos}
        />
      )}

      {showRegistro && (
        <MedicionesRegistro
          obraId={obraId}
          partidas={partidas}
          empleados={empleados}
          onClose={() => setShowRegistro(false)}
          onGuardado={cargarDatos}
        />
      )}
    </div>
  );
}
