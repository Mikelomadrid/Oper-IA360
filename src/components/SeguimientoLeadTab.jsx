import { useState, useEffect } from "react";
import { supabase } from "@/lib/customSupabaseClient";
import { useAuth } from "@/contexts/SupabaseAuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare, User, Phone, Mail, MapPin, Calendar,
  Clock, Image as ImageIcon, FileText, Plus, ChevronDown,
  ChevronUp, ExternalLink, AlertCircle
} from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-ES", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}
function fmtDateShort(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

// ── componente ────────────────────────────────────────────────────────────────
export default function SeguimientoLeadTab({ projectId }) {
  const { sessionRole } = useAuth();
  const { toast } = useToast();

  const [lead, setLead] = useState(null);
  const [comentariosLead, setComentariosLead] = useState([]);
  const [fotosLead, setFotosLead] = useState([]);
  const [adjuntosLead, setAdjuntosLead] = useState([]);
  const [notasObra, setNotasObra] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nuevaNota, setNuevaNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [seccionLead, setSeccionLead] = useState(true); // colapsable
  const [fotoAmpliada, setFotoAmpliada] = useState(null);

  // ── carga inicial ──
  useEffect(() => {
    if (!projectId) return;
    cargarTodo();
  }, [projectId]);

  async function cargarTodo() {
    setLoading(true);
    try {
      // 1. Obtener lead_id del proyecto
      const { data: proyecto } = await supabase
        .from("proyectos")
        .select("lead_id")
        .eq("id", projectId)
        .maybeSingle();

      const leadId = proyecto?.lead_id;

      if (leadId) {
        // 2. Datos del lead
        const { data: leadData } = await supabase
          .from("leads")
          .select("id, nombre_contacto, nombre_empresa, telefono, email, direccion, municipio, codigo_postal, tipo, comentario, fecha_visita, created_at, base_imponible, categoria, origen")
          .eq("id", leadId)
          .maybeSingle();
        setLead(leadData);

        // 3. Comentarios del lead con nombre de autor
        const { data: comentarios } = await supabase
          .from("lead_comentarios")
          .select("id, comentario, created_at, autor_tipo, autor_id, empleados(nombre)")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: true });
        setComentariosLead(comentarios || []);

        // 4. Fotos del lead (bucket público lead_fotos)
        const { data: fotos } = await supabase
          .from("lead_fotos")
          .select("id, url, descripcion, created_at")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false });
        setFotosLead(fotos || []);

        // 5. Adjuntos del lead
        const { data: adjuntos } = await supabase
          .from("lead_adjuntos")
          .select("id, archivo_url, url, descripcion, tipo, created_at")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false });
        setAdjuntosLead(adjuntos || []);
      }

      // 6. Notas de obra (nuevas, post-conversión)
      const { data: notas } = await supabase
        .from("obra_notas")
        .select("id, contenido, created_at, created_by, empleados(nombre)")
        .eq("obra_id", projectId)
        .order("created_at", { ascending: false });
      setNotasObra(notas || []);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function guardarNota() {
    if (!nuevaNota.trim()) return;
    setGuardando(true);
    const { error } = await supabase.from("obra_notas").insert({
      obra_id: projectId,
      contenido: nuevaNota.trim(),
      created_by: sessionRole?.empleadoId || null,
    });
    if (error) {
      toast({ variant: "destructive", title: "Error al guardar la nota", description: error.message });
    } else {
      setNuevaNota("");
      toast({ title: "Nota añadida" });
      cargarTodo();
    }
    setGuardando(false);
  }

  async function eliminarNota(id) {
    if (!confirm("¿Eliminar esta nota?")) return;
    await supabase.from("obra_notas").delete().eq("id", id);
    cargarTodo();
  }

  // ── render ──
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 64, color: "#999" }}>
        Cargando seguimiento...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 0 48px" }}>

      {/* ── BLOQUE: Historial del lead ── */}
      {lead ? (
        <div style={{ marginBottom: 32, border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          {/* cabecera colapsable */}
          <button
            onClick={() => setSeccionLead(v => !v)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 20px", background: "hsl(var(--muted)/0.4)", border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 14, color: "hsl(var(--foreground))"
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <MessageSquare style={{ width: 16, height: 16, opacity: 0.7 }} />
              Historial del lead original
              <span style={{ fontSize: 11, fontWeight: 400, color: "hsl(var(--muted-foreground))", marginLeft: 4 }}>
                (readonly — datos de la visita comercial)
              </span>
            </span>
            {seccionLead
              ? <ChevronUp style={{ width: 16, height: 16, opacity: 0.5 }} />
              : <ChevronDown style={{ width: 16, height: 16, opacity: 0.5 }} />}
          </button>

          {seccionLead && (
            <div style={{ padding: "20px" }}>

              {/* Ficha de contacto */}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "12px 24px", marginBottom: 20, padding: 16,
                background: "hsl(var(--muted)/0.2)", borderRadius: 8
              }}>
                {lead.nombre_contacto && (
                  <Item icon={<User />} label="Contacto" value={lead.nombre_contacto} />
                )}
                {lead.nombre_empresa && (
                  <Item icon={<FileText />} label="Empresa" value={lead.nombre_empresa} />
                )}
                {lead.telefono && (
                  <Item icon={<Phone />} label="Teléfono" value={lead.telefono} />
                )}
                {lead.email && (
                  <Item icon={<Mail />} label="Email" value={lead.email} />
                )}
                {(lead.direccion || lead.municipio) && (
                  <Item icon={<MapPin />} label="Dirección" value={[lead.direccion, lead.municipio, lead.codigo_postal].filter(Boolean).join(", ")} />
                )}
                {lead.fecha_visita && (
                  <Item icon={<Calendar />} label="Fecha visita" value={fmtDate(lead.fecha_visita)} />
                )}
                {lead.tipo && (
                  <Item icon={<FileText />} label="Tipo" value={lead.tipo} />
                )}
                {lead.categoria && (
                  <Item icon={<FileText />} label="Categoría" value={lead.categoria} />
                )}
                {lead.base_imponible > 0 && (
                  <Item icon={<FileText />} label="Base imponible" value={Number(lead.base_imponible).toLocaleString("es-ES", { style: "currency", currency: "EUR" })} />
                )}
              </div>

              {/* Comentario inicial del cliente */}
              {lead.comentario && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                    Comentario inicial del cliente
                  </p>
                  <div style={{ padding: "12px 16px", background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 14, lineHeight: 1.6, color: "hsl(var(--foreground))" }}>
                    {lead.comentario}
                  </div>
                </div>
              )}

              {/* Comentarios del técnico durante el lead */}
              {comentariosLead.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                    Anotaciones del técnico ({comentariosLead.length})
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {comentariosLead.map(c => (
                      <div key={c.id} style={{
                        padding: "10px 14px", background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))", borderRadius: 8
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--primary))" }}>
                            {c.empleados?.nombre || c.autor_tipo || "Técnico"}
                          </span>
                          <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                            {fmtDate(c.created_at)}
                          </span>
                        </div>
                        <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>{c.comentario}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fotos del lead */}
              {fotosLead.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                    Fotos de la visita ({fotosLead.length})
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                    {fotosLead.map(f => (
                      <div key={f.id}
                        onClick={() => setFotoAmpliada(f.url)}
                        style={{
                          aspectRatio: "1", borderRadius: 6, overflow: "hidden",
                          cursor: "pointer", border: "1px solid hsl(var(--border))",
                          position: "relative"
                        }}>
                        <img
                          src={f.url}
                          alt={f.descripcion || "foto"}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={e => { e.target.style.display = "none"; }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Adjuntos del lead */}
              {adjuntosLead.length > 0 && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                    Archivos adjuntos ({adjuntosLead.length})
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {adjuntosLead.map(a => {
                      const href = a.archivo_url || a.url;
                      return (
                        <a key={a.id} href={href} target="_blank" rel="noopener noreferrer"
                          style={{
                            display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                            background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                            borderRadius: 6, textDecoration: "none", color: "hsl(var(--foreground))", fontSize: 13
                          }}>
                          <FileText style={{ width: 14, height: 14, opacity: 0.6, flexShrink: 0 }} />
                          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {a.descripcion || "Adjunto"}
                          </span>
                          <ExternalLink style={{ width: 12, height: 12, opacity: 0.4, flexShrink: 0 }} />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sin datos */}
              {comentariosLead.length === 0 && fotosLead.length === 0 && adjuntosLead.length === 0 && !lead.comentario && (
                <p style={{ color: "hsl(var(--muted-foreground))", fontSize: 13, fontStyle: "italic" }}>
                  Este lead no tiene anotaciones ni archivos registrados.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{
          marginBottom: 32, padding: "16px 20px",
          background: "hsl(var(--muted)/0.3)", borderRadius: 10,
          display: "flex", alignItems: "center", gap: 10,
          fontSize: 13, color: "hsl(var(--muted-foreground))"
        }}>
          <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
          Esta obra no tiene un lead de origen vinculado.
        </div>
      )}

      {/* ── BLOQUE: Notas de obra ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
            📝 Notas de obra
            {notasObra.length > 0 && (
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: "hsl(var(--muted-foreground))" }}>
                {notasObra.length} nota{notasObra.length !== 1 ? "s" : ""}
              </span>
            )}
          </h2>
        </div>

        {/* Nueva nota */}
        <div style={{
          marginBottom: 20, padding: 16,
          border: "1px solid hsl(var(--border))", borderRadius: 10,
          background: "hsl(var(--card))"
        }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
            Añadir nueva nota
          </p>
          <textarea
            value={nuevaNota}
            onChange={e => setNuevaNota(e.target.value)}
            placeholder="Escribe una nota, observación o actualización sobre la obra..."
            rows={4}
            style={{
              width: "100%", padding: "10px 12px",
              border: "1px solid hsl(var(--border))", borderRadius: 6,
              fontSize: 13, lineHeight: 1.6, resize: "vertical",
              background: "hsl(var(--background))", color: "hsl(var(--foreground))",
              outline: "none", fontFamily: "inherit", boxSizing: "border-box"
            }}
            onKeyDown={e => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) guardarNota();
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
              Ctrl+Enter para guardar
            </span>
            <Button
              onClick={guardarNota}
              disabled={guardando || !nuevaNota.trim()}
              size="sm"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus style={{ width: 14, height: 14 }} />
              {guardando ? "Guardando..." : "Añadir nota"}
            </Button>
          </div>
        </div>

        {/* Lista de notas */}
        {notasObra.length === 0 ? (
          <div style={{
            padding: "32px", textAlign: "center",
            border: "1px dashed hsl(var(--border))", borderRadius: 10,
            color: "hsl(var(--muted-foreground))", fontSize: 13
          }}>
            No hay notas de obra todavía. Añade la primera arriba.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {notasObra.map(nota => (
              <div key={nota.id} style={{
                padding: "14px 16px",
                border: "1px solid hsl(var(--border))", borderRadius: 8,
                background: "hsl(var(--card))"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--primary))" }}>
                      {nota.empleados?.nombre || "Admin"}
                    </span>
                    <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                      {fmtDate(nota.created_at)}
                    </span>
                  </div>
                  {sessionRole?.rol === "admin" && (
                    <button
                      onClick={() => eliminarNota(nota.id)}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        fontSize: 11, color: "hsl(var(--muted-foreground))",
                        padding: "2px 6px", borderRadius: 4
                      }}
                      onMouseOver={e => { e.currentTarget.style.color = "#e63946"; e.currentTarget.style.background = "#fee2e2"; }}
                      onMouseOut={e => { e.currentTarget.style.color = "hsl(var(--muted-foreground))"; e.currentTarget.style.background = "none"; }}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {nota.contenido}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox foto ampliada */}
      {fotoAmpliada && (
        <div
          onClick={() => setFotoAmpliada(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 99999,
            background: "rgba(0,0,0,0.85)", display: "flex",
            alignItems: "center", justifyContent: "center", cursor: "zoom-out"
          }}>
          <img
            src={fotoAmpliada}
            alt="foto ampliada"
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, objectFit: "contain" }}
          />
        </div>
      )}
    </div>
  );
}

// ── helper de fila de ficha ──
function Item({ icon, label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: "hsl(var(--foreground))", display: "flex", alignItems: "center", gap: 5 }}>
        {value}
      </span>
    </div>
  );
}
