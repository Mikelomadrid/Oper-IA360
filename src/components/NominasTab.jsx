import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/customSupabaseClient";

// ─── Constantes ───────────────────────────────────────────────────────────────
const TARIFA_FONTANERIA = 15;
const TARIFA_EXTRA_LABORABLE_TECNICO = 14.19;
const TARIFA_EXTRA_FESTIVO_TECNICO = 16.73;
const TARIFA_EXTRA_LABORABLE_ENCARGADO = 17.40;
const TARIFA_EXTRA_FESTIVO_ENCARGADO = 19.81;

const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

const TIPOS_BAJA = ["IT","accidente","maternidad","paternidad","otro"];

const ETIQUETA_AUSENCIA = {
  vacaciones: "Vacaciones",
  baja: "Baja",
  ausencia_injustificada: "Aus. injustificada",
  otro: "Otro",
};

function tarifaExtra(rol, tipo) {
  if (rol === "encargado") return tipo === "festivo" ? TARIFA_EXTRA_FESTIVO_ENCARGADO : TARIFA_EXTRA_LABORABLE_ENCARGADO;
  return tipo === "festivo" ? TARIFA_EXTRA_FESTIVO_TECNICO : TARIFA_EXTRA_LABORABLE_TECNICO;
}

function formatEur(n) {
  return Number(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function formatHoras(h) {
  const total = Number(h || 0);
  const hh = Math.floor(total);
  const mm = Math.round((total - hh) * 60);
  return `${hh}h ${mm.toString().padStart(2,"0")}m`;
}

// Calcula días naturales que caen dentro del mes dado
function diasEnMes(fechaIni, fechaFin, anio, mes) {
  const ini = new Date(fechaIni);
  const fin = fechaFin ? new Date(fechaFin) : new Date(anio, mes, 0); // fin de mes si sigue abierta
  const mesIni = new Date(anio, mes - 1, 1);
  const mesFin = new Date(anio, mes, 0);
  const start = ini < mesIni ? mesIni : ini;
  const end   = fin > mesFin ? mesFin : fin;
  if (start > end) return 0;
  return Math.ceil((end - start) / 86400000) + 1;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function NominasTab() {
  const ahora = new Date();
  const [mes, setMes] = useState(ahora.getMonth() + 1);
  const [anio, setAnio] = useState(ahora.getFullYear());
  const [empleados, setEmpleados] = useState([]);
  const [datosNomina, setDatosNomina] = useState([]);
  const [resumen, setResumen] = useState([]);
  const [loading, setLoading] = useState(false);
  const [vista, setVista] = useState("informe");
  const [editandoSueldo, setEditandoSueldo] = useState(null);
  const [formSueldo, setFormSueldo] = useState({ sueldo_neto: "", plus_voluntario: "", notas: "" });
  const [bajas, setBajas] = useState([]);
  const [formBaja, setFormBaja] = useState({ empleado_id: "", fecha_inicio: "", fecha_fin: "", tipo_baja: "IT", observaciones: "" });
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    supabase
      .from("empleados")
      .select("id, nombre, apellidos, rol")
      .eq("activo", true)
      .in("rol", ["tecnico", "encargado"])
      .order("nombre")
      .then(({ data }) => setEmpleados(data || []));
  }, []);

  useEffect(() => {
    if (vista === "informe") cargarResumen();
    if (vista === "sueldos") cargarSueldos();
    if (vista === "bajas") cargarBajas();
  }, [mes, anio, vista, empleados]);

  async function cargarSueldos() {
    const fechaLimite = `${anio}-${String(mes).padStart(2,"0")}-01`;
    const { data } = await supabase
      .from("datos_nomina_empleado")
      .select("*, empleados(nombre, apellidos)")
      .lte("fecha_efectiva", fechaLimite)
      .order("fecha_efectiva", { ascending: false });
    const porEmpleado = {};
    (data || []).forEach(r => { if (!porEmpleado[r.empleado_id]) porEmpleado[r.empleado_id] = r; });
    setDatosNomina(Object.values(porEmpleado));
  }

  async function cargarBajas() {
    const fechaInicio = `${anio}-${String(mes).padStart(2,"0")}-01`;
    const fechaFin = new Date(anio, mes, 0).toISOString().split("T")[0];
    const { data } = await supabase
      .from("bajas_empleados")
      .select("*, empleados(nombre)")
      .or(`fecha_inicio.lte.${fechaFin},fecha_fin.gte.${fechaInicio}`)
      .order("fecha_inicio", { ascending: false });
    setBajas(data || []);
  }

  async function cargarResumen() {
    if (empleados.length === 0) return;
    setLoading(true);
    try {
      const fechaInicio = `${anio}-${String(mes).padStart(2,"0")}-01`;
      const fechaFin = new Date(anio, mes, 0).toISOString().split("T")[0];
      const fechaLimite = fechaInicio;

      // 1. Sueldos vigentes
      const { data: sueldosRaw } = await supabase
        .from("datos_nomina_empleado").select("*")
        .lte("fecha_efectiva", fechaLimite).order("fecha_efectiva", { ascending: false });
      const sueldoMap = {};
      (sueldosRaw || []).forEach(r => { if (!sueldoMap[r.empleado_id]) sueldoMap[r.empleado_id] = r; });

      // 2. Horas extras del mes
      const { data: horasRaw } = await supabase
        .from("v_control_horas_extra_ui_nombre_20260125_v3")
        .select("empleado_id, horas_normales, horas_extras, horas_festivo")
        .gte("dia", fechaInicio).lte("dia", fechaFin);
      const horasMap = {};
      (horasRaw || []).forEach(r => {
        if (!horasMap[r.empleado_id]) horasMap[r.empleado_id] = { normales: 0, extras: 0, festivo: 0 };
        horasMap[r.empleado_id].normales += Number(r.horas_normales || 0);
        horasMap[r.empleado_id].extras   += Number(r.horas_extras || 0);
        horasMap[r.empleado_id].festivo  += Number(r.horas_festivo || 0);
      });

      // 3. Fontanería
      const { data: fontaneriaRaw } = await supabase
        .from("fontaneria_horas").select("empleado_id, horas")
        .gte("fecha", fechaInicio).lte("fecha", fechaFin);
      const fontMap = {};
      (fontaneriaRaw || []).forEach(r => { fontMap[r.empleado_id] = (fontMap[r.empleado_id] || 0) + Number(r.horas || 0); });

      // 4. Anticipos del mes
      const { data: anticRaw } = await supabase
        .from("anticipos_nomina").select("empleado_id, cantidad, estado")
        .gte("fecha_solicitud", fechaInicio).lte("fecha_solicitud", fechaFin);
      const anticMap = {};
      (anticRaw || []).forEach(r => { anticMap[r.empleado_id] = (anticMap[r.empleado_id] || 0) + Number(r.cantidad || 0); });

      // 5. Embargos: plan notificado y retenciones del periodo.
      // empleado_id en embargos es empleados.auth_user_id.
      const { data: embargosRaw } = await supabase
        .from("embargos")
        .select("empleado_id, numero_cuotas, importe_cuota, importe_pendiente, estado, embargos_retenciones(fecha, importe)");
      const embargoMap = {};
      (embargosRaw || []).forEach(e => {
        const empleado = empleados.find(emp => emp.auth_user_id === e.empleado_id);
        if (!empleado) return;
        const retenciones = e.embargos_retenciones || [];
        const retenidoMes = retenciones
          .filter(r => r.fecha >= fechaInicio && r.fecha <= fechaFin)
          .reduce((s, r) => s + Number(r.importe || 0), 0);
        const cuotasPagadas = retenciones.length;
        if (!embargoMap[empleado.id]) embargoMap[empleado.id] = [];
        embargoMap[empleado.id].push({
          numeroCuotas: Number(e.numero_cuotas || 0),
          importeCuota: Number(e.importe_cuota || 0),
          cuotasPagadas,
          cuotasPendientes: Math.max(Number(e.numero_cuotas || 0) - cuotasPagadas, 0),
          importeMes: retenidoMes || (e.estado === "activo" ? Number(e.importe_cuota || 0) : 0),
          importePendiente: Number(e.importe_pendiente || 0),
        });
      });

      // 6. Bajas propias (tabla nóminas)
      const { data: bajasRaw } = await supabase
        .from("bajas_empleados").select("empleado_id, fecha_inicio, fecha_fin, dias_naturales, tipo_baja");
      const bajasMap = {};
      (bajasRaw || []).forEach(b => {
        const dias = b.dias_naturales || diasEnMes(b.fecha_inicio, b.fecha_fin, anio, mes);
        if (dias > 0) {
          if (!bajasMap[b.empleado_id]) bajasMap[b.empleado_id] = [];
          bajasMap[b.empleado_id].push({ dias, tipo: b.tipo_baja });
        }
      });

      // 7. Ausencias del mes (vacaciones, baja, ausencia injustificada)
      const { data: ausenciasRaw } = await supabase
        .from("ausencias_empleados")
        .select("empleado_id, fecha_inicio, fecha_fin, tipo")
        .lte("fecha_inicio", fechaFin)
        .or(`fecha_fin.gte.${fechaInicio},fecha_fin.is.null`);
      const ausenciasMap = {};
      (ausenciasRaw || []).forEach(a => {
        const dias = diasEnMes(a.fecha_inicio, a.fecha_fin, anio, mes);
        if (dias > 0) {
          if (!ausenciasMap[a.empleado_id]) ausenciasMap[a.empleado_id] = [];
          ausenciasMap[a.empleado_id].push({ dias, tipo: a.tipo });
        }
      });

      // 8. Vacaciones aprobadas (vacaciones_solicitudes)
      const { data: vacRaw } = await supabase
        .from("vacaciones_solicitudes")
        .select("empleado_id, fecha_inicio, fecha_fin, dias_solicitados, estado")
        .eq("estado", "aprobada")
        .lte("fecha_inicio", fechaFin)
        .or(`fecha_fin.gte.${fechaInicio},fecha_fin.is.null`);
      const vacMap = {};
      (vacRaw || []).forEach(v => {
        const dias = v.dias_solicitados || diasEnMes(v.fecha_inicio, v.fecha_fin, anio, mes);
        if (dias > 0) {
          if (!vacMap[v.empleado_id]) vacMap[v.empleado_id] = 0;
          vacMap[v.empleado_id] += dias;
        }
      });

      // 9. Construir resumen por empleado
      const filas = empleados.map(emp => {
        const sueldo    = sueldoMap[emp.id] || null;
        const horas     = horasMap[emp.id]  || { normales: 0, extras: 0, festivo: 0 };
        const fontHoras = fontMap[emp.id]   || 0;
        const anticipo  = anticMap[emp.id]  || 0;
        const embargos  = embargoMap[emp.id] || [];
        const importeEmbargo = embargos.reduce((s, e) => s + e.importeMes, 0);
        const bajasEmp  = bajasMap[emp.id]  || [];
        const diasBaja  = bajasEmp.reduce((s, b) => s + b.dias, 0);

        // Ausencias de ausencias_empleados agrupadas por tipo
        const ausEmp = ausenciasMap[emp.id] || [];
        const diasVacAus   = ausEmp.filter(a => a.tipo === "vacaciones").reduce((s,a) => s + a.dias, 0);
        const diasBajaAus  = ausEmp.filter(a => a.tipo === "baja").reduce((s,a) => s + a.dias, 0);
        const diasOtroAus  = ausEmp.filter(a => a.tipo !== "vacaciones" && a.tipo !== "baja").reduce((s,a) => s + a.dias, 0);

        // Vacaciones aprobadas
        const diasVacSol = vacMap[emp.id] || 0;

        // Total vacaciones = las de ausencias_empleados + las de vacaciones_solicitudes (sin duplicar)
        const diasVacaciones = Math.max(diasVacAus, diasVacSol); // usar el mayor para no duplicar
        const diasAusenciaInjustificada = ausEmp.filter(a => a.tipo === "ausencia_injustificada").reduce((s,a) => s + a.dias, 0);

        const importeExtraLab   = horas.extras  * tarifaExtra(emp.rol, "laborable");
        const importeExtraFest  = horas.festivo * tarifaExtra(emp.rol, "festivo");
        const importeFontaneria = fontHoras * TARIFA_FONTANERIA;
        const plusVol    = sueldo ? Number(sueldo.plus_voluntario || 0) : 0;
        const sueldoBase = sueldo ? Number(sueldo.sueldo_neto     || 0) : 0;
        const totalBruto = sueldoBase + plusVol + importeExtraLab + importeExtraFest + importeFontaneria - anticipo - importeEmbargo;

        return {
          ...emp,
          horas, fontHoras,
          importeExtraLab, importeExtraFest, importeFontaneria,
          plusVol, sueldoBase, anticipo,
          embargos, importeEmbargo,
          bajasEmp, diasBaja,
          diasVacaciones,
          diasBajaAus,
          diasAusenciaInjustificada,
          totalBruto,
          sinSueldo: !sueldo,
        };
      });

      setResumen(filas);
    } finally {
      setLoading(false);
    }
  }

  async function guardarSueldo() {
    setGuardando(true);
    const payload = {
      empleado_id: editandoSueldo,
      sueldo_neto: parseFloat(formSueldo.sueldo_neto) || 0,
      plus_voluntario: parseFloat(formSueldo.plus_voluntario) || 0,
      fecha_efectiva: `${anio}-${String(mes).padStart(2,"0")}-01`,
      notas: formSueldo.notas,
    };
    const { error } = await supabase
      .from("datos_nomina_empleado")
      .upsert(payload, { onConflict: "empleado_id,fecha_efectiva" });
    if (error) setMsg({ tipo: "error", texto: "Error al guardar: " + error.message });
    else { setMsg({ tipo: "ok", texto: "Guardado correctamente" }); setEditandoSueldo(null); cargarSueldos(); }
    setGuardando(false);
    setTimeout(() => setMsg(null), 3000);
  }

  async function guardarBaja() {
    setGuardando(true);
    const ini = new Date(formBaja.fecha_inicio);
    const fin = formBaja.fecha_fin ? new Date(formBaja.fecha_fin) : null;
    const dias = fin ? Math.ceil((fin - ini) / 86400000) + 1 : null;
    const { error } = await supabase.from("bajas_empleados").insert({ ...formBaja, dias_naturales: dias });
    if (error) setMsg({ tipo: "error", texto: "Error: " + error.message });
    else { setMsg({ tipo: "ok", texto: "Baja registrada" }); setFormBaja({ empleado_id: "", fecha_inicio: "", fecha_fin: "", tipo_baja: "IT", observaciones: "" }); cargarBajas(); }
    setGuardando(false);
    setTimeout(() => setMsg(null), 3000);
  }

  async function eliminarBaja(id) {
    if (!confirm("¿Eliminar esta baja?")) return;
    await supabase.from("bajas_empleados").delete().eq("id", id);
    cargarBajas();
  }

  // ── Generación PDF ──────────────────────────────────────────────────────────
  function generarPDF() {
    const estilos = `
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'IBM Plex Sans',sans-serif; font-size:11px; color:#1a1a2e; background:white; }
      .page { padding:32px 36px; max-width:920px; margin:auto; }
      .cabecera { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:16px; border-bottom:3px solid #1a1a2e; margin-bottom:24px; }
      .empresa { font-size:18px; font-weight:700; letter-spacing:-0.5px; }
      .empresa span { color:#e63946; }
      .meta { text-align:right; }
      .meta .periodo { font-size:15px; font-weight:600; }
      .meta .generado { color:#666; font-size:10px; margin-top:4px; }
      h2 { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#666; margin-bottom:12px; margin-top:24px; }
      .empleado-card { border:1px solid #e8e8e8; border-radius:6px; margin-bottom:16px; overflow:hidden; page-break-inside:avoid; }
      .empleado-header { background:#1a1a2e; color:white; padding:10px 16px; display:flex; justify-content:space-between; align-items:center; }
      .empleado-nombre { font-size:13px; font-weight:600; }
      .empleado-rol { font-size:10px; opacity:0.7; text-transform:uppercase; letter-spacing:0.5px; }
      .empleado-body { padding:12px 16px; }
      .grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px 16px; }
      .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; }
      .seccion-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#666; margin:10px 0 6px; padding-bottom:3px; border-bottom:1px solid #eee; }
      .linea { display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f0f0f0; }
      .linea:last-child { border-bottom:none; }
      .linea .label { color:#555; }
      .linea .valor { font-weight:600; }
      .linea .valor.verde { color:#2d6a4f; }
      .linea .valor.rojo { color:#e63946; }
      .linea .valor.naranja { color:#e76f51; }
      .linea .valor.azul { color:#2563eb; }
      .linea .valor.morado { color:#7c3aed; }
      .total-row { background:#f8f9fa; border-top:2px solid #1a1a2e; padding:10px 16px; display:flex; justify-content:space-between; align-items:center; }
      .total-label { font-weight:600; font-size:12px; }
      .total-valor { font-size:16px; font-weight:700; }
      .badge { display:inline-block; padding:2px 8px; border-radius:3px; font-size:10px; font-weight:600; margin-right:4px; }
      .badge-baja { background:#fee2e2; color:#991b1b; }
      .badge-vac  { background:#dbeafe; color:#1e40af; }
      .badge-aus  { background:#fef3c7; color:#92400e; }
      .sin-datos { color:#aaa; font-style:italic; font-size:10px; }
      .pie { margin-top:32px; padding-top:12px; border-top:1px solid #ddd; display:flex; justify-content:space-between; color:#999; font-size:10px; }
      @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
    `;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Informe Nóminas ${MESES[mes-1]} ${anio}</title><style>${estilos}</style></head><body><div class="page">
      <div class="cabecera">
        <div>
          <div class="empresa">ORKALED <span>INSTALACIONES</span> SLU</div>
          <div style="color:#666;font-size:11px;margin-top:4px;">Informe de nóminas para gestoría</div>
        </div>
        <div class="meta">
          <div class="periodo">${MESES[mes-1].toUpperCase()} ${anio}</div>
          <div class="generado">Generado: ${new Date().toLocaleDateString("es-ES", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}</div>
        </div>
      </div>

      <h2>Detalle por empleado</h2>

      ${resumen.map(emp => {
        const tieneAusencias = emp.diasVacaciones > 0 || emp.diasBajaAus > 0 || emp.diasAusenciaInjustificada > 0 || emp.diasBaja > 0;
        return `
        <div class="empleado-card">
          <div class="empleado-header">
            <div>
              <div class="empleado-nombre">${emp.nombre} ${emp.apellidos || ""}</div>
              <div class="empleado-rol">${emp.rol}</div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
              ${emp.diasVacaciones > 0 ? `<span class="badge badge-vac">🏖 ${emp.diasVacaciones}d vacaciones</span>` : ""}
              ${emp.diasBaja > 0 || emp.diasBajaAus > 0 ? `<span class="badge badge-baja">⚕ ${Math.max(emp.diasBaja, emp.diasBajaAus)}d baja</span>` : ""}
              ${emp.diasAusenciaInjustificada > 0 ? `<span class="badge badge-aus">⚠ ${emp.diasAusenciaInjustificada}d aus. injust.</span>` : ""}
            </div>
          </div>
          <div class="empleado-body">

            <div class="seccion-label">Retribución</div>
            <div class="grid-2">
              <div>
                <div class="linea"><span class="label">Sueldo neto base</span><span class="valor">${formatEur(emp.sueldoBase)}</span></div>
                <div class="linea"><span class="label">Plus voluntario</span><span class="valor ${emp.plusVol > 0 ? "verde" : ""}">${formatEur(emp.plusVol)}</span></div>
                <div class="linea"><span class="label">Anticipos</span><span class="valor ${emp.anticipo > 0 ? "rojo" : ""}">${emp.anticipo > 0 ? "− " : ""}${formatEur(emp.anticipo)}</span></div>
                ${emp.importeEmbargo > 0 ? `<div class="linea"><span class="label">Embargos (${emp.embargos.reduce((s, e) => s + e.cuotasPendientes, 0)} cuotas pendientes)</span><span class="valor rojo">− ${formatEur(emp.importeEmbargo)}</span></div>` : ""}
              </div>
              <div>
                <div class="linea"><span class="label">H. extras laborables (${formatHoras(emp.horas.extras)})</span><span class="valor naranja">${formatEur(emp.importeExtraLab)}</span></div>
                <div class="linea"><span class="label">H. extras festivos (${formatHoras(emp.horas.festivo)})</span><span class="valor naranja">${formatEur(emp.importeExtraFest)}</span></div>
                ${emp.fontHoras > 0 ? `<div class="linea"><span class="label">Plus fontanería (${formatHoras(emp.fontHoras)})</span><span class="valor verde">${formatEur(emp.importeFontaneria)}</span></div>` : ""}
              </div>
            </div>

            ${emp.embargos.length ? `
            <div class="seccion-label">Plan de embargos</div>
            <div class="grid-2">
              ${emp.embargos.map((e, i) => `<div class="linea"><span class="label">Expediente ${i + 1} · ${e.numeroCuotas > 0 ? `${e.cuotasPendientes} cuotas pendientes` : "plan sin cuotas"}</span><span class="valor rojo">${e.importeCuota > 0 ? `${formatEur(e.importeCuota)}/cuota` : "—"}</span></div>`).join("")}
            </div>
            ` : ""}

            ${tieneAusencias ? `
            <div class="seccion-label">Ausencias del mes</div>
            <div class="grid-3">
              <div class="linea"><span class="label">🏖 Vacaciones</span><span class="valor azul">${emp.diasVacaciones > 0 ? emp.diasVacaciones + " día" + (emp.diasVacaciones !== 1 ? "s" : "") : "—"}</span></div>
              <div class="linea"><span class="label">⚕ Baja médica</span><span class="valor rojo">${(emp.diasBaja > 0 || emp.diasBajaAus > 0) ? Math.max(emp.diasBaja, emp.diasBajaAus) + " día" + (Math.max(emp.diasBaja, emp.diasBajaAus) !== 1 ? "s" : "") : "—"}</span></div>
              <div class="linea"><span class="label">⚠ Aus. injustificada</span><span class="valor naranja">${emp.diasAusenciaInjustificada > 0 ? emp.diasAusenciaInjustificada + " día" + (emp.diasAusenciaInjustificada !== 1 ? "s" : "") : "—"}</span></div>
            </div>
            ` : ""}

            ${emp.sinSueldo ? `<div style="margin-top:8px"><span class="sin-datos">⚠ Sin datos salariales configurados para este período</span></div>` : ""}
          </div>
          <div class="total-row">
            <span class="total-label">TOTAL A TRANSFERIR</span>
            <span class="total-valor">${formatEur(emp.totalBruto)}</span>
          </div>
        </div>
      `}).join("")}

      <div class="pie">
        <span>ORKALED INSTALACIONES SLU — Uso exclusivo gestoría</span>
        <span>Oper-IA360 ERP · ${MESES[mes-1]} ${anio}</span>
      </div>
    </div></body></html>`;

    const ventana = window.open("", "_blank", "width=1000,height=800");
    ventana.document.write(html);
    ventana.document.close();
    ventana.onload = () => ventana.print();
  }

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "24px", fontFamily: "inherit", maxWidth: "1200px" }}>
      {/* Cabecera */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#1a1a2e", margin: 0 }}>Nóminas</h1>
          <p style={{ color: "#666", fontSize: "13px", marginTop: "4px" }}>Informe mensual para gestoría</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select value={mes} onChange={e => setMes(Number(e.target.value))}
            style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px", fontSize: "13px", background: "white" }}>
            {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={anio} onChange={e => setAnio(Number(e.target.value))}
            style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px", fontSize: "13px", background: "white" }}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "24px", borderBottom: "2px solid #eee" }}>
        {[
          { id: "informe", label: "📋 Informe" },
          { id: "sueldos", label: "⚙️ Sueldos" },
          { id: "bajas",   label: "🏥 Bajas" },
        ].map(tab => (
          <button key={tab.id} onClick={() => setVista(tab.id)}
            style={{
              padding: "8px 18px", border: "none", background: "none", cursor: "pointer",
              fontSize: "13px", fontWeight: vista === tab.id ? 700 : 400,
              color: vista === tab.id ? "#1a1a2e" : "#888",
              borderBottom: vista === tab.id ? "2px solid #1a1a2e" : "2px solid transparent",
              marginBottom: "-2px"
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {msg && (
        <div style={{ padding: "10px 16px", borderRadius: "6px", marginBottom: "16px", fontSize: "13px",
          background: msg.tipo === "ok" ? "#d1fae5" : "#fee2e2",
          color: msg.tipo === "ok" ? "#065f46" : "#991b1b" }}>
          {msg.texto}
        </div>
      )}

      {/* ── VISTA INFORME ── */}
      {vista === "informe" && (
        <div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "48px", color: "#999" }}>Cargando datos...</div>
          ) : (
            <>
              {resumen.some(e => e.sinSueldo) && (
                <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "6px", padding: "10px 16px", marginBottom: "16px", fontSize: "13px", color: "#856404" }}>
                  ⚠️ Algunos empleados no tienen sueldo configurado. Ve a la pestaña <strong>Sueldos</strong>.
                </div>
              )}

              <div style={{ overflowX: "auto", marginBottom: "20px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "#1a1a2e", color: "white" }}>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Empleado</th>
                      <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>Sueldo base</th>
                      <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>Plus vol.</th>
                      <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>H. extras</th>
                      <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>Plus font.</th>
                      <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>Anticipos</th>
                      <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>Embargos</th>
                      <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600, color: "#93c5fd" }}>🏖 Vac.</th>
                      <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600, color: "#fca5a5" }}>⚕ Baja</th>
                      <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600, color: "#fcd34d" }}>⚠ Aus.</th>
                      <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.map((emp, i) => (
                      <tr key={emp.id} style={{ background: i % 2 === 0 ? "#fafafa" : "white", borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 600, fontSize: "13px" }}>
                          {emp.nombre}
                          {emp.sinSueldo && <span style={{ color: "#e63946", fontSize: "10px", marginLeft: "6px" }}>sin datos</span>}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>{formatEur(emp.sueldoBase)}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", color: emp.plusVol > 0 ? "#2d6a4f" : "#ccc" }}>{formatEur(emp.plusVol)}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", color: (emp.importeExtraLab + emp.importeExtraFest) > 0 ? "#e76f51" : "#ccc", fontSize: "11px" }}>
                          {(emp.importeExtraLab + emp.importeExtraFest) > 0
                            ? formatEur(emp.importeExtraLab + emp.importeExtraFest)
                            : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", color: emp.importeFontaneria > 0 ? "#2d6a4f" : "#ccc" }}>
                          {emp.importeFontaneria > 0 ? formatEur(emp.importeFontaneria) : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", color: emp.anticipo > 0 ? "#e63946" : "#ccc" }}>
                          {emp.anticipo > 0 ? `− ${formatEur(emp.anticipo)}` : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", color: emp.importeEmbargo > 0 ? "#e63946" : "#ccc" }}>
                          {emp.importeEmbargo > 0 ? `− ${formatEur(emp.importeEmbargo)}` : "—"}
                          {emp.embargos.length > 0 && <div style={{ fontSize: "10px", color: "#888" }}>{emp.embargos.reduce((s, e) => s + e.cuotasPendientes, 0)} cuotas</div>}
                        </td>
                        {/* Vacaciones */}
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          {emp.diasVacaciones > 0
                            ? <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600 }}>{emp.diasVacaciones}d</span>
                            : <span style={{ color: "#ccc" }}>—</span>}
                        </td>
                        {/* Baja */}
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          {(emp.diasBaja > 0 || emp.diasBajaAus > 0)
                            ? <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600 }}>{Math.max(emp.diasBaja, emp.diasBajaAus)}d</span>
                            : <span style={{ color: "#ccc" }}>—</span>}
                        </td>
                        {/* Ausencia injustificada */}
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          {emp.diasAusenciaInjustificada > 0
                            ? <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600 }}>{emp.diasAusenciaInjustificada}d</span>
                            : <span style={{ color: "#ccc" }}>—</span>}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, fontSize: "14px" }}>
                          {formatEur(emp.totalBruto)}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: "#1a1a2e", color: "white" }}>
                      <td style={{ padding: "12px", fontWeight: 700 }} colSpan={10}>TOTAL MASA SALARIAL</td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: 700, fontSize: "15px" }}>
                        {formatEur(resumen.reduce((s, e) => s + e.totalBruto, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <button onClick={generarPDF}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "12px 24px", background: "#1a1a2e", color: "white",
                  border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer"
                }}>
                📄 Generar PDF para gestoría — {MESES[mes-1]} {anio}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── VISTA SUELDOS ── */}
      {vista === "sueldos" && (
        <div>
          <p style={{ color: "#666", fontSize: "13px", marginBottom: "16px" }}>
            Introduce o actualiza el sueldo para <strong>{MESES[mes-1]} {anio}</strong>. Solo visible para administradores.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#f5f5f5" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600 }}>Empleado</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>Sueldo neto</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>Plus voluntario</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600 }}>Notas</th>
                <th style={{ padding: "10px 14px" }}></th>
              </tr>
            </thead>
            <tbody>
              {empleados.map((emp, i) => {
                const dato = datosNomina.find(d => d.empleado_id === emp.id);
                const editando = editandoSueldo === emp.id;
                return (
                  <tr key={emp.id} style={{ borderBottom: "1px solid #eee", background: i % 2 === 0 ? "#fafafa" : "white" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                      {emp.nombre}
                      <span style={{ fontSize: "11px", color: "#999", marginLeft: "6px", fontWeight: 400 }}>{emp.rol}</span>
                    </td>
                    {editando ? (
                      <>
                        <td style={{ padding: "6px 14px" }}>
                          <input type="number" value={formSueldo.sueldo_neto}
                            onChange={e => setFormSueldo(f => ({ ...f, sueldo_neto: e.target.value }))}
                            placeholder="0.00" step="0.01"
                            style={{ width: "100%", padding: "6px 8px", border: "1px solid #1a1a2e", borderRadius: "4px", fontSize: "13px", textAlign: "right" }} />
                        </td>
                        <td style={{ padding: "6px 14px" }}>
                          <input type="number" value={formSueldo.plus_voluntario}
                            onChange={e => setFormSueldo(f => ({ ...f, plus_voluntario: e.target.value }))}
                            placeholder="0.00" step="0.01"
                            style={{ width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", textAlign: "right" }} />
                        </td>
                        <td style={{ padding: "6px 14px" }}>
                          <input type="text" value={formSueldo.notas}
                            onChange={e => setFormSueldo(f => ({ ...f, notas: e.target.value }))}
                            placeholder="Notas opcionales"
                            style={{ width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }} />
                        </td>
                        <td style={{ padding: "6px 14px", textAlign: "center", whiteSpace: "nowrap" }}>
                          <button onClick={guardarSueldo} disabled={guardando}
                            style={{ padding: "6px 14px", background: "#1a1a2e", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px", marginRight: "6px" }}>
                            Guardar
                          </button>
                          <button onClick={() => setEditandoSueldo(null)}
                            style={{ padding: "6px 10px", background: "#f0f0f0", color: "#333", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>
                            Cancelar
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: dato ? 600 : 400, color: dato ? "#1a1a2e" : "#bbb" }}>
                          {dato ? formatEur(dato.sueldo_neto) : "—"}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: dato?.plus_voluntario > 0 ? "#2d6a4f" : "#bbb" }}>
                          {dato?.plus_voluntario > 0 ? formatEur(dato.plus_voluntario) : "—"}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center", color: "#999", fontSize: "12px" }}>
                          {dato?.notas || "—"}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <button onClick={() => {
                            setEditandoSueldo(emp.id);
                            setFormSueldo({ sueldo_neto: dato?.sueldo_neto || "", plus_voluntario: dato?.plus_voluntario || "", notas: dato?.notas || "" });
                          }}
                            style={{ padding: "6px 14px", background: dato ? "#f0f0f0" : "#1a1a2e", color: dato ? "#333" : "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>
                            {dato ? "✏️ Editar" : "+ Introducir"}
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── VISTA BAJAS ── */}
      {vista === "bajas" && (
        <div>
          <div style={{ background: "#f8f9fa", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "16px", marginBottom: "24px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: 700, marginBottom: "12px" }}>Registrar nueva baja</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <select value={formBaja.empleado_id} onChange={e => setFormBaja(f => ({ ...f, empleado_id: e.target.value }))}
                style={{ padding: "8px 10px", border: "1px solid #ddd", borderRadius: "6px", fontSize: "13px" }}>
                <option value="">Empleado...</option>
                {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
              <input type="date" value={formBaja.fecha_inicio} onChange={e => setFormBaja(f => ({ ...f, fecha_inicio: e.target.value }))}
                style={{ padding: "8px 10px", border: "1px solid #ddd", borderRadius: "6px", fontSize: "13px" }} />
              <input type="date" value={formBaja.fecha_fin} onChange={e => setFormBaja(f => ({ ...f, fecha_fin: e.target.value }))}
                style={{ padding: "8px 10px", border: "1px solid #ddd", borderRadius: "6px", fontSize: "13px" }} />
              <select value={formBaja.tipo_baja} onChange={e => setFormBaja(f => ({ ...f, tipo_baja: e.target.value }))}
                style={{ padding: "8px 10px", border: "1px solid #ddd", borderRadius: "6px", fontSize: "13px" }}>
                {TIPOS_BAJA.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <input type="text" value={formBaja.observaciones} onChange={e => setFormBaja(f => ({ ...f, observaciones: e.target.value }))}
                placeholder="Observaciones opcionales"
                style={{ flex: 1, padding: "8px 10px", border: "1px solid #ddd", borderRadius: "6px", fontSize: "13px" }} />
              <button onClick={guardarBaja} disabled={guardando || !formBaja.empleado_id || !formBaja.fecha_inicio}
                style={{ padding: "8px 20px", background: "#1a1a2e", color: "white", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                + Registrar baja
              </button>
            </div>
          </div>

          {bajas.length === 0 ? (
            <p style={{ color: "#999", textAlign: "center", padding: "32px", fontSize: "13px" }}>No hay bajas registradas para este período</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600 }}>Empleado</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600 }}>Inicio</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600 }}>Fin</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600 }}>Tipo</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600 }}>Días</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600 }}>Observaciones</th>
                  <th style={{ padding: "10px 14px" }}></th>
                </tr>
              </thead>
              <tbody>
                {bajas.map((b, i) => (
                  <tr key={b.id} style={{ borderBottom: "1px solid #eee", background: i % 2 === 0 ? "#fafafa" : "white" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>{b.empleados?.nombre}</td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>{b.fecha_inicio}</td>
                    <td style={{ padding: "10px 14px", textAlign: "center", color: b.fecha_fin ? "#1a1a2e" : "#999" }}>{b.fecha_fin || "En curso"}</td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <span style={{ background: "#fff3cd", color: "#856404", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600 }}>{b.tipo_baja}</span>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600 }}>{b.dias_naturales || "—"}</td>
                    <td style={{ padding: "10px 14px", color: "#666" }}>{b.observaciones || "—"}</td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <button onClick={() => eliminarBaja(b.id)}
                        style={{ padding: "4px 10px", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
