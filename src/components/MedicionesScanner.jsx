import { useState, useRef } from "react";
import { supabase } from "../supabaseClient";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

export default function MedicionesScanner({ obraId, obraNombre, onClose, onConfirmado }) {
  const [fase, setFase] = useState("upload"); // upload | procesando | revision | guardando | listo
  const [pdfBase64, setPdfBase64] = useState(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [partidas, setPartidas] = useState([]);
  const [error, setError] = useState(null);
  const [progreso, setProgreso] = useState("");
  const fileRef = useRef();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== "application/pdf") {
      setError("Por favor selecciona un archivo PDF.");
      return;
    }
    setError(null);
    setNombreArchivo(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      setPdfBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const procesarPDF = async () => {
    if (!pdfBase64) return;
    setFase("procesando");
    setProgreso("Enviando PDF a Claude Vision...");
    setError(null);

    try {
      const prompt = `Analiza este presupuesto o plano de construcción en PDF y extrae TODAS las partidas/tareas con sus mediciones.

Para cada partida devuelve un JSON con este formato exacto:
{
  "partidas": [
    {
      "codigo": "1.1",
      "descripcion": "Descripción de la tarea o partida",
      "unidad": "m²",
      "cantidad_total": 45.5,
      "precio_unitario": 12.50
    }
  ]
}

Reglas:
- Si no hay código de partida, usa un número correlativo (1, 2, 3...)
- La unidad puede ser: m², ml, ud, h, kg, m³, pa, o la que aparezca
- Si no hay precio unitario, pon null
- Si no hay cantidad, pon 0
- Extrae TODAS las partidas que encuentres, aunque sean muchas
- Responde SOLO con el JSON, sin texto adicional, sin markdown`;

      setProgreso("Claude está analizando el documento...");

      const response = await fetch(CLAUDE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: pdfBase64,
                  },
                },
                { type: "text", text: prompt },
              ],
            },
          ],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Error al llamar a Claude");
      }

      setProgreso("Procesando resultados...");

      const texto = data.content?.find((b) => b.type === "text")?.text || "";
      const clean = texto.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      if (!parsed.partidas || !Array.isArray(parsed.partidas)) {
        throw new Error("No se encontraron partidas en el documento.");
      }

      setPartidas(
        parsed.partidas.map((p, i) => ({
          ...p,
          _id: i,
          _activa: true,
        }))
      );
      setFase("revision");
    } catch (err) {
      console.error(err);
      setError("Error al procesar el PDF: " + err.message);
      setFase("upload");
    }
  };

  const updatePartida = (idx, campo, valor) => {
    setPartidas((prev) =>
      prev.map((p) => (p._id === idx ? { ...p, [campo]: valor } : p))
    );
  };

  const eliminarPartida = (idx) => {
    setPartidas((prev) => prev.filter((p) => p._id !== idx));
  };

  const agregarPartida = () => {
    const newId = Math.max(...partidas.map((p) => p._id), 0) + 1;
    setPartidas((prev) => [
      ...prev,
      {
        _id: newId,
        codigo: "",
        descripcion: "",
        unidad: "m²",
        cantidad_total: 0,
        precio_unitario: null,
        _activa: true,
      },
    ]);
  };

  const confirmarYGuardar = async () => {
    setFase("guardando");
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Guardar registro del PDF
      const { data: pdfRecord, error: pdfError } = await supabase
        .from("obras_mediciones_pdf")
        .insert({
          obra_id: obraId,
          nombre_archivo: nombreArchivo,
          subido_por: user?.id,
          estado: "confirmado",
        })
        .select()
        .single();

      if (pdfError) throw pdfError;

      // 2. Guardar partidas
      const partidasInsert = partidas.map((p, i) => ({
        obra_id: obraId,
        pdf_id: pdfRecord.id,
        codigo: p.codigo || String(i + 1),
        descripcion: p.descripcion,
        unidad: p.unidad || "m²",
        cantidad_total: parseFloat(p.cantidad_total) || 0,
        precio_unitario: p.precio_unitario ? parseFloat(p.precio_unitario) : null,
        orden: i,
        activa: true,
      }));

      const { error: partidasError } = await supabase
        .from("obras_partidas")
        .insert(partidasInsert);

      if (partidasError) throw partidasError;

      setFase("listo");
      setTimeout(() => {
        onConfirmado?.();
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
      setError("Error al guardar: " + err.message);
      setFase("revision");
    }
  };

  // ── ESTILOS ──────────────────────────────────────────────
  const overlay = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
    zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
    padding: "16px",
  };
  const modal = {
    background: "var(--color-background-primary, #fff)",
    borderRadius: "16px", width: "100%", maxWidth: "780px",
    maxHeight: "90vh", display: "flex", flexDirection: "column",
    overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  };
  const header = {
    padding: "20px 24px 16px",
    borderBottom: "1px solid var(--color-border-tertiary, #eee)",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    flexShrink: 0,
  };
  const body = { padding: "24px", overflowY: "auto", flex: 1 };
  const footer = {
    padding: "16px 24px",
    borderTop: "1px solid var(--color-border-tertiary, #eee)",
    display: "flex", gap: "12px", justifyContent: "flex-end",
    flexShrink: 0,
  };
  const btn = (variant) => ({
    padding: "10px 20px", borderRadius: "8px", border: "none",
    cursor: "pointer", fontWeight: 500, fontSize: "14px",
    background: variant === "primary" ? "#2563eb" : variant === "danger" ? "#dc2626" : variant === "success" ? "#16a34a" : "#f3f4f6",
    color: variant === "ghost" ? "#374151" : "#fff",
    opacity: 1, transition: "opacity 0.15s",
  });
  const inputStyle = {
    border: "1px solid var(--color-border-secondary, #d1d5db)",
    borderRadius: "6px", padding: "6px 8px", fontSize: "13px",
    width: "100%", background: "transparent",
    color: "var(--color-text-primary)",
  };
  const tdStyle = { padding: "6px 8px", verticalAlign: "middle" };

  // ── RENDER ───────────────────────────────────────────────
  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal}>

        {/* HEADER */}
        <div style={header}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "16px", color: "var(--color-text-primary)" }}>
              📐 Escáner de Mediciones
            </div>
            <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
              {obraNombre}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: "var(--color-text-secondary)" }}>✕</button>
        </div>

        {/* BODY */}
        <div style={body}>

          {/* FASE: UPLOAD */}
          {fase === "upload" && (
            <div>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: "2px dashed var(--color-border-secondary, #d1d5db)",
                  borderRadius: "12px", padding: "48px 24px",
                  textAlign: "center", cursor: "pointer",
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = "#2563eb"}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--color-border-secondary, #d1d5db)"}
              >
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>📄</div>
                <div style={{ fontWeight: 600, fontSize: "15px", color: "var(--color-text-primary)", marginBottom: "6px" }}>
                  {nombreArchivo || "Haz clic para seleccionar el PDF"}
                </div>
                <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                  Presupuesto o plano con mediciones
                </div>
                <input ref={fileRef} type="file" accept="application/pdf" onChange={handleFile} style={{ display: "none" }} />
              </div>

              {error && (
                <div style={{ marginTop: "16px", padding: "12px 16px", background: "#fef2f2", borderRadius: "8px", color: "#dc2626", fontSize: "14px" }}>
                  ⚠️ {error}
                </div>
              )}
            </div>
          )}

          {/* FASE: PROCESANDO */}
          {fase === "procesando" && (
            <div style={{ textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>🤖</div>
              <div style={{ fontWeight: 600, fontSize: "16px", marginBottom: "8px", color: "var(--color-text-primary)" }}>
                Analizando documento...
              </div>
              <div style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>{progreso}</div>
              <div style={{ marginTop: "24px", height: "4px", background: "#f3f4f6", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{
                  height: "100%", background: "#2563eb", borderRadius: "2px",
                  width: "60%", animation: "scan-progress 1.5s ease-in-out infinite alternate",
                }} />
              </div>
              <style>{`@keyframes scan-progress { from { width: 20%; } to { width: 85%; } }`}</style>
            </div>
          )}

          {/* FASE: REVISION */}
          {fase === "revision" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "15px", color: "var(--color-text-primary)" }}>
                    ✅ {partidas.length} partidas extraídas
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
                    Revisa y edita antes de confirmar
                  </div>
                </div>
                <button onClick={agregarPartida} style={{ ...btn("ghost"), fontSize: "13px", padding: "8px 14px" }}>
                  + Añadir partida
                </button>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--color-border-secondary, #e5e7eb)" }}>
                      <th style={{ ...tdStyle, textAlign: "left", fontWeight: 600, width: "60px" }}>Cód.</th>
                      <th style={{ ...tdStyle, textAlign: "left", fontWeight: 600 }}>Descripción</th>
                      <th style={{ ...tdStyle, textAlign: "center", fontWeight: 600, width: "70px" }}>Unidad</th>
                      <th style={{ ...tdStyle, textAlign: "right", fontWeight: 600, width: "90px" }}>Cantidad</th>
                      <th style={{ ...tdStyle, textAlign: "right", fontWeight: 600, width: "90px" }}>€/ud</th>
                      <th style={{ ...tdStyle, width: "36px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {partidas.map((p) => (
                      <tr key={p._id} style={{ borderBottom: "1px solid var(--color-border-tertiary, #f3f4f6)" }}>
                        <td style={tdStyle}>
                          <input
                            value={p.codigo || ""}
                            onChange={(e) => updatePartida(p._id, "codigo", e.target.value)}
                            style={{ ...inputStyle, width: "52px" }}
                          />
                        </td>
                        <td style={tdStyle}>
                          <input
                            value={p.descripcion || ""}
                            onChange={(e) => updatePartida(p._id, "descripcion", e.target.value)}
                            style={inputStyle}
                          />
                        </td>
                        <td style={tdStyle}>
                          <select
                            value={p.unidad || "m²"}
                            onChange={(e) => updatePartida(p._id, "unidad", e.target.value)}
                            style={{ ...inputStyle, width: "64px" }}
                          >
                            {["m²", "ml", "ud", "h", "kg", "m³", "pa", "l"].map((u) => (
                              <option key={u}>{u}</option>
                            ))}
                          </select>
                        </td>
                        <td style={tdStyle}>
                          <input
                            type="number"
                            value={p.cantidad_total || 0}
                            onChange={(e) => updatePartida(p._id, "cantidad_total", e.target.value)}
                            style={{ ...inputStyle, textAlign: "right", width: "82px" }}
                          />
                        </td>
                        <td style={tdStyle}>
                          <input
                            type="number"
                            value={p.precio_unitario ?? ""}
                            placeholder="—"
                            onChange={(e) => updatePartida(p._id, "precio_unitario", e.target.value)}
                            style={{ ...inputStyle, textAlign: "right", width: "82px" }}
                          />
                        </td>
                        <td style={tdStyle}>
                          <button
                            onClick={() => eliminarPartida(p._id)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: "16px", padding: "2px 6px" }}
                            title="Eliminar"
                          >✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {error && (
                <div style={{ marginTop: "16px", padding: "12px 16px", background: "#fef2f2", borderRadius: "8px", color: "#dc2626", fontSize: "14px" }}>
                  ⚠️ {error}
                </div>
              )}
            </div>
          )}

          {/* FASE: GUARDANDO */}
          {fase === "guardando" && (
            <div style={{ textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>💾</div>
              <div style={{ fontWeight: 600, fontSize: "16px", color: "var(--color-text-primary)" }}>
                Guardando partidas...
              </div>
            </div>
          )}

          {/* FASE: LISTO */}
          {fase === "listo" && (
            <div style={{ textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
              <div style={{ fontWeight: 600, fontSize: "16px", color: "#16a34a" }}>
                ¡Partidas guardadas correctamente!
              </div>
            </div>
          )}

        </div>

        {/* FOOTER */}
        <div style={footer}>
          {fase === "upload" && (
            <>
              <button onClick={onClose} style={btn("ghost")}>Cancelar</button>
              <button
                onClick={procesarPDF}
                disabled={!pdfBase64}
                style={{ ...btn("primary"), opacity: pdfBase64 ? 1 : 0.4, cursor: pdfBase64 ? "pointer" : "not-allowed" }}
              >
                🤖 Analizar con IA
              </button>
            </>
          )}
          {fase === "revision" && (
            <>
              <button onClick={() => { setFase("upload"); setPartidas([]); }} style={btn("ghost")}>
                ← Volver
              </button>
              <button
                onClick={confirmarYGuardar}
                disabled={partidas.length === 0}
                style={{ ...btn("success"), opacity: partidas.length > 0 ? 1 : 0.4 }}
              >
                ✅ Confirmar y guardar ({partidas.length} partidas)
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
