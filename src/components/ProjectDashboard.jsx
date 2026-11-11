import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Euro, Users, Wrench, HardHat, BarChart3, Clock, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Minus, Loader2, Phone, MapPin, Building, User, Calendar, CalendarClock, FileDown, UploadCloud, FileText, X, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import ReactECharts from 'echarts-for-react';
import { useTheme } from '@/contexts/ThemeContext';
import ChartPlaceholder from '@/components/ChartPlaceholder';
import { formatDate } from '@/lib/utils';
import { useInformeObraPDF } from '@/components/useInformeObraPDF';
import LeadInheritedInfo from '@/components/LeadInheritedInfo';
import { fetchProjectMaterialNetTotal } from '@/lib/projectMaterialCosts';
import ProjectProfitabilityForecast from '@/components/ProjectProfitabilityForecast';

const StatCard = ({ title, value, icon, description, details, trend, trendValue, colorClass }) => {
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    return (
        <Card className="transition-transform duration-300 hover:scale-105 hover:shadow-lg overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6">
                <CardTitle className="text-xs md:text-sm font-medium truncate pr-1">{title}</CardTitle>
                <div className={`w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-lg text-white ${colorClass}`}>
                    {React.cloneElement(icon, { className: "w-3.5 h-3.5 md:w-5 md:h-5" })}
                </div>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                <div className="text-lg md:text-2xl font-bold truncate">{value}</div>
                {(description || trend) && (
                    <p className="text-[10px] md:text-xs text-muted-foreground flex items-center mt-1">
                        {description && <span className="truncate max-w-[80px] md:max-w-none">{description}</span>}
                        {trend && (
                            <div className={`${description ? 'ml-2' : ''} flex items-center ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                                <TrendIcon className="h-3 w-3 md:h-4 md:w-4" />
                                <span>{trendValue}</span>
                            </div>
                        )}
                    </p>
                )}
                {details && (
                    <div className="mt-2 grid grid-cols-2 gap-x-3 text-[10px] leading-4 text-muted-foreground md:text-xs">
                        {details.map((detail) => (
                            <div key={detail.label} className="flex min-w-0 items-center justify-center gap-1 text-center" title={detail.label} aria-label={`${detail.label}: ${detail.value}`}>
                                {React.cloneElement(detail.icon, { className: "h-3.5 w-3.5 shrink-0" })}
                                <span className="whitespace-nowrap font-medium tabular-nums text-foreground">{detail.value}</span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

const BudgetReconciliation = ({ baseBudget, approvedExtras, updatedContract, estimatedExtraCost, actualExtraLabor, pendingCount, pendingAmount, formatCurrency }) => (
    <Card className="mb-3 overflow-hidden shadow-sm md:mb-4">
        <CardContent className="p-4 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground">Presupuesto original</p>
                    <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{formatCurrency(baseBudget)}</p>
                </div>
                <div className="hidden text-xl text-muted-foreground/50 lg:block">+</div>
                <div className="min-w-0 flex-1 border-t pt-3 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-medium text-emerald-700">Extras aprobados</p>
                        {pendingCount > 0 && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                                {pendingCount} pendiente{pendingCount === 1 ? '' : 's'} · {formatCurrency(pendingAmount)}
                            </span>
                        )}
                    </div>
                    <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-emerald-700">{formatCurrency(approvedExtras)}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                        Coste previsto {formatCurrency(estimatedExtraCost)} · Mano de obra real {formatCurrency(actualExtraLabor)}
                    </p>
                </div>
                <div className="hidden text-xl text-muted-foreground/50 lg:block">=</div>
                <div className="min-w-0 flex-1 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-900 dark:bg-violet-950/30">
                    <p className="text-xs font-medium text-violet-700 dark:text-violet-300">Contrato actualizado</p>
                    <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-violet-950 dark:text-violet-100">{formatCurrency(updatedContract)}</p>
                    <p className="mt-1 text-[11px] text-violet-700 dark:text-violet-300">Solo incluye extras aprobados por el cliente</p>
                </div>
            </div>
        </CardContent>
    </Card>
);

const ProjectDashboard = ({ projectId, project }) => {
    const [kpis, setKpis] = useState(null);
    const [clientData, setClientData] = useState(null);
    const [projectStartDate, setProjectStartDate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showClientComments, setShowClientComments] = useState(false);
    const [generandoPDF, setGenerandoPDF] = useState(false);
    const [modalInformeOpen, setModalInformeOpen] = useState(false);
    const [incluirPresupuesto, setIncluirPresupuesto] = useState(true);
    const [presupuestoPDF, setPresupuestoPDF] = useState(null);
    const [analizandoPresupuesto, setAnalizandoPresupuesto] = useState(false);
    const { theme } = useTheme();
    const { generarPDF } = useInformeObraPDF();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const kpiPromise = supabase
                    .from('v_proyecto_kpis_con_estado')
                    .select('*')
                    .eq('proyecto_id', projectId)
                    .single();

                const laborPromise = supabase
                    .from('ui_v_proyecto_mano_obra_totales_v2')
                    .select('coste_total_mano_obra')
                    .eq('proyecto_id', projectId)
                    .maybeSingle();

                const materialBasePromise = fetchProjectMaterialNetTotal(projectId);

                const extrasPromise = supabase
                    .from('proyecto_trabajos_extra')
                    .select('id, estado, importe_venta, coste_estimado, tarea_id')
                    .eq('proyecto_id', projectId);

                let currentClientId = project?.cliente_id;
                let currentStartDate = project?.fecha_inicio;
                let clientPromise = Promise.resolve({ data: null, error: null });

                if ((!currentClientId || !currentStartDate) && projectId) {
                    const { data: projData } = await supabase
                        .from('proyectos')
                        .select('cliente_id, fecha_inicio')
                        .eq('id', projectId)
                        .maybeSingle();

                    if (projData) {
                        currentClientId = currentClientId || projData.cliente_id;
                        currentStartDate = currentStartDate || projData.fecha_inicio;
                    }
                }

                setProjectStartDate(currentStartDate);

                if (currentClientId) {
                    clientPromise = supabase
                        .from('clientes')
                        .select('*')
                        .eq('id', currentClientId)
                        .maybeSingle();
                }

                const [kpiRes, laborRes, clientRes, materialBase, extrasRes] = await Promise.all([
                    kpiPromise,
                    laborPromise,
                    clientPromise,
                    materialBasePromise,
                    extrasPromise,
                ]);

                if (kpiRes.error) {
                    // La vista de KPIs no existe en algunas instalaciones antiguas.
                    // El detalle debe seguir funcionando con los datos básicos de proyectos.
                    console.warn("[ProjectDashboard] Vista de KPIs no disponible; usando datos básicos:", kpiRes.error.message || kpiRes.error);
                }

                const baseData = kpiRes.data || project || null;
                if (baseData) {
                    const laborCost = laborRes.data?.coste_total_mano_obra || 0;
                    if (extrasRes.error) {
                        console.warn("[ProjectDashboard] Extras no disponibles:", extrasRes.error.message || extrasRes.error);
                    }
                    const extras = extrasRes.data || [];
                    const approvedExtrasRows = extras.filter((extra) => extra.estado === 'aprobado');
                    const pendingExtrasRows = extras.filter((extra) => extra.estado === 'pendiente_cliente');
                    const approvedExtras = approvedExtrasRows.reduce((sum, extra) => sum + Number(extra.importe_venta || 0), 0);
                    const estimatedExtraCost = approvedExtrasRows.reduce((sum, extra) => sum + Number(extra.coste_estimado || 0), 0);
                    const pendingExtraAmount = pendingExtrasRows.reduce((sum, extra) => sum + Number(extra.importe_venta || 0), 0);
                    const extraTaskIds = approvedExtrasRows.map((extra) => extra.tarea_id).filter(Boolean);
                    let actualExtraLabor = 0;
                    if (extraTaskIds.length > 0) {
                        const { data: executions, error: executionsError } = await supabase
                            .from('tarea_ejecuciones_reales')
                            .select('coste_mano_obra')
                            .in('tarea_id', extraTaskIds);
                        if (executionsError) throw executionsError;
                        actualExtraLabor = (executions || []).reduce((sum, execution) => sum + Number(execution.coste_mano_obra || 0), 0);
                    }
                    // Presupuesto y margen trabajan sin IVA: materiales = base imponible.
                    const materialCost = Number(materialBase || 0);
                    const totalCost = materialCost + laborCost;
                    const updatedContract = Number(baseData.presupuesto_aceptado || 0) + approvedExtras;
                    const margin = updatedContract - totalCost;
                    const profitability = updatedContract > 0
                        ? (margin / updatedContract) * 100
                        : 0;

                    const combinedData = {
                        ...baseData,
                        coste_total_materiales: materialCost,
                        coste_total_mano_obra: laborCost,
                        costo_total: totalCost,
                        margen: margin,
                        rentabilidad_real_pct: profitability,
                        extras_aprobados: approvedExtras,
                        extras_coste_estimado: estimatedExtraCost,
                        extras_mano_obra_real: actualExtraLabor,
                        extras_pendientes_count: pendingExtrasRows.length,
                        extras_pendientes_importe: pendingExtraAmount,
                        importe_contrato_actualizado: updatedContract,
                        estado: project?.estado,
                        fecha_fin_estimada: project?.fecha_fin_estimada,
                    };
                    setKpis(combinedData);
                } else {
                    setKpis(null);
                }

                if (clientRes.data) {
                    setClientData(clientRes.data);
                } else {
                    setClientData(null);
                    if (projectId) {
                        const { data: proyData } = await supabase
                            .from('proyectos')
                            .select('contacto_nombre, contacto_telefono, direccion_obra')
                            .eq('id', projectId)
                            .maybeSingle();
                        if (proyData) {
                            setClientData({
                                contacto: proyData.contacto_nombre,
                                telefono: proyData.contacto_telefono,
                                _direccion_obra: proyData.direccion_obra,
                            });
                        }
                    }
                }

            } catch (error) {
                console.error("Error general fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        if (projectId) {
            fetchData();
        }
    }, [projectId, project]);

    // Analizar PDF del presupuesto con Claude
    const analizarPresupuestoPDF = async (file) => {
        setAnalizandoPresupuesto(true);
        try {
            const reader = new FileReader();
            const base64 = await new Promise((res, rej) => {
                reader.onload = () => res(reader.result.split(',')[1]);
                reader.onerror = rej;
                reader.readAsDataURL(file);
            });

            const { data: { session } } = await supabase.auth.getSession();
            const supabaseUrl = window.SUPABASE_CONFIG?.url;
            const supabaseKey = window.SUPABASE_CONFIG?.anonKey;

            const prompt = `Eres un experto en presupuestos de obra. Analiza este documento y extrae TODAS las partidas con TODOS sus datos numéricos.

INSTRUCCIONES CRÍTICAS:
- Extrae CADA partida que aparezca en el documento, sin omitir ninguna
- Para "cantidad": si aparece "1 ud", "1,00", "1.00" o similar, pon 1. Si no hay cantidad visible, pon 1 como valor por defecto. NUNCA pongas 0 salvo que el documento diga explícitamente 0.
- Para "precio_unitario": extrae el precio exacto que aparece en el documento
- Para "total_partida": si aparece en el documento úsalo, si no calcula cantidad × precio_unitario
- Para "descripcion": copia el texto completo de la descripción, sin truncar
- Si hay capítulos o secciones, inclúyelos en "capitulo"

Responde SOLO con este JSON sin texto adicional ni markdown:
{
  "titulo": "título del presupuesto o null",
  "cliente": "nombre del cliente o null",
  "fecha": "YYYY-MM-DD o null",
  "total": 0.00,
  "partidas": [
    {
      "capitulo": "capítulo o null",
      "codigo": "código de partida o null",
      "descripcion": "descripción completa de la partida sin truncar",
      "cantidad": 1.00,
      "unidad": "ud",
      "precio_unitario": 0.00,
      "total_partida": 0.00
    }
  ]
}`;

            const res = await fetch(`${supabaseUrl}/functions/v1/claude-scanner`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                    'apikey': supabaseKey,
                },
                body: JSON.stringify({ base64, mediaType: 'application/pdf', prompt }),
            });

            if (!res.ok) throw new Error(`Error ${res.status}`);
            const data = await res.json();
            const texto = data.content?.find(b => b.type === 'text')?.text || '';
            const clean = texto.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(clean);
            return parsed.partidas || [];
        } catch (err) {
            console.error('Error analizando presupuesto:', err);
            toast({ variant: 'destructive', title: 'Error al analizar el presupuesto', description: err.message });
            return [];
        } finally {
            setAnalizandoPresupuesto(false);
        }
    };

    // ✅ Handler para generar el PDF
    const handleGenerarInforme = async () => {
        setModalInformeOpen(false);
        setGenerandoPDF(true);
        try {
            const infoParaPDF = {
                ...project,
                nombre_proyecto: project?.nombre_proyecto,
                estado: project?.estado,
                fecha_inicio: projectStartDate,
                fecha_fin_estimada: project?.fecha_fin_estimada,
                fecha_fin_real: project?.fecha_fin_real || project?.fecha_cierre_real,
                direccion_obra: project?.direccion_obra,
                contacto_nombre: project?.contacto_nombre,
                contacto_telefono: project?.contacto_telefono,
                cliente: clientData,
            };

            // Fetch gastos + fichajes completos con desglose de extras diario/finde
            const [gastosRes, fichajesRes] = await Promise.all([
                supabase.from('gastos').select('*').eq('proyecto_id', projectId).order('fecha', { ascending: false }),
                supabase
                    .from('v_fichajes_admin_neto_v5')
                    .select('empleado_id, empleado_nombre, empleado_apellidos, hora_entrada, hora_salida, fecha, horas_normales_dia, horas_extra_dia, horas_festivo_dia, es_fin_semana, es_festivo, horas_extra_laborable_ui, horas_festivo_ui')
                    .eq('proyecto_id', projectId)
                    .order('fecha', { ascending: true }),
            ]);

            const gastos = gastosRes.data || [];
            const fichajesRaw = fichajesRes.data || [];

            // Agrupar por empleado para resumen
            const horasMap = {};
            fichajesRaw.forEach(r => {
                const id = r.empleado_id;
                if (!horasMap[id]) {
                    horasMap[id] = {
                        nombre: `${r.empleado_nombre || ''} ${r.empleado_apellidos || ''}`.trim(),
                        jornadas: 0,
                        horas_normales: 0,
                        horas_extra_diario: 0,
                        horas_extra_finde: 0,
                    };
                }
                horasMap[id].jornadas          += 1;
                horasMap[id].horas_normales     += Number(r.horas_normales_dia || 0);
                horasMap[id].horas_extra_diario += Number(r.horas_extra_laborable_ui || 0);
                horasMap[id].horas_extra_finde  += Number(r.horas_festivo_ui || 0);
            });

            // Analizar presupuesto PDF si se adjuntó
            let partidas = [];
            if (incluirPresupuesto && presupuestoPDF) {
                partidas = await analizarPresupuestoPDF(presupuestoPDF);
            }

            await generarPDF({
                info: infoParaPDF,
                kpis,
                gastos,
                horasData: Object.values(horasMap),
                fichajes: fichajesRaw,
                partidas,
            });
        } catch (err) {
            console.error('Error generando PDF:', err);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo generar el informe.' });
        } finally {
            setGenerandoPDF(false);
        }
    };

    const chartOptions = useMemo(() => {
        if (!kpis) return null;

        const style = getComputedStyle(document.documentElement);
        const textColor = `hsl(${style.getPropertyValue('--foreground').trim()})`;
        const surfaceColor = `hsl(${style.getPropertyValue('--card').trim()})`;
        const borderColor = `hsl(${style.getPropertyValue('--border').trim()})`;
        const itemBorderColor = theme === 'dark' ? 'rgba(14, 27, 36, 0.6)' : '#fff';

        const presupuesto = kpis.importe_contrato_actualizado || kpis.presupuesto_aceptado || 0;
        const materiales = kpis.coste_total_materiales || 0;
        const manoObra = kpis.coste_total_mano_obra || 0;
        const margenGrafico = Math.max(0, presupuesto - (materiales + manoObra));

        const data = [
            { value: materiales, name: 'Materiales' },
            { value: manoObra, name: 'Mano Obra' },
            { value: margenGrafico, name: 'Margen' },
        ];

        const totalGrafico = data.reduce((sum, item) => sum + item.value, 0);

        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'item',
                formatter: params => {
                    const percent = totalGrafico > 0 ? ((params.value / totalGrafico) * 100).toFixed(1) : 0;
                    return `${params.name}:<br/><strong>${params.value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</strong> (${percent}%)`;
                },
                backgroundColor: surfaceColor,
                borderColor: borderColor,
                textStyle: { color: textColor, fontSize: 12 },
                confine: true
            },
            legend: {
                bottom: 0,
                left: 'center',
                textStyle: { color: textColor, fontSize: 10 },
                icon: 'circle',
                itemWidth: 8,
                itemHeight: 8,
                itemGap: 5,
                padding: 0
            },
            series: [
                {
                    name: 'Distribución',
                    type: 'pie',
                    radius: ['45%', '70%'],
                    center: ['50%', '45%'],
                    avoidLabelOverlap: false,
                    itemStyle: {
                        borderRadius: 4,
                        borderColor: itemBorderColor,
                        borderWidth: 1,
                    },
                    label: { show: false, position: 'center' },
                    emphasis: { label: { show: false } },
                    labelLine: { show: false },
                    data: data,
                    color: ['#3b82f6', '#f97316', '#22c55e'],
                },
            ],
        };
    }, [kpis, theme]);

    if (loading) {
        return (
            <div className="grid gap-3 grid-cols-2 md:gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i}><CardHeader className="p-4"><div className="h-3 bg-muted rounded w-3/4"></div></CardHeader><CardContent className="p-4"><div className="h-6 bg-muted rounded w-1/2"></div></CardContent></Card>
                ))}
                <Card className="col-span-2 md:col-span-5 h-[300px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></Card>
            </div>
        );
    }

    if (!kpis) {
        return <ChartPlaceholder message="No hay datos de KPIs para este proyecto." icon={BarChart3} />;
    }

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0);
    };

    const isProfit = kpis.margen >= 0;
    const rentabilidadPct = kpis.rentabilidad_real_pct || 0;
    const isRentable = rentabilidadPct >= 0;

    const cards = [
        { title: "Contrato actualizado", value: formatCurrency(kpis.importe_contrato_actualizado), icon: <Euro />, description: `Base + extras aprobados`, colorClass: 'bg-violet-600' },
        {
            title: "Coste acumulado",
            value: formatCurrency(kpis.costo_total),
            icon: <Users />,
            details: [
                { label: "Materiales", icon: <Wrench />, value: formatCurrency(kpis.coste_total_materiales) },
                { label: "Mano de obra", icon: <HardHat />, value: formatCurrency(kpis.coste_total_mano_obra) },
            ],
            colorClass: 'bg-orange-500'
        },
        { title: "Margen acumulado", value: formatCurrency(kpis.margen), icon: isProfit ? <CheckCircle2 /> : <AlertTriangle />, description: isProfit ? 'Todavía no es el margen final' : 'Pérdida acumulada', colorClass: isProfit ? 'bg-green-500' : 'bg-red-500' },
        { title: "Rentabilidad actual", value: `${rentabilidadPct.toFixed(2)}%`, icon: <BarChart3 />, description: `Acumulada hasta hoy`, colorClass: isRentable ? 'bg-purple-500' : 'bg-yellow-500' },
    ];

    const displayClienteName = clientData?.nombre || project?.contacto_nombre || '-';
    const displayContactoName = project?.contacto_nombre || clientData?.contacto || 'Sin contacto';
    const displayPhone = project?.contacto_telefono || clientData?.telefono || '-';
    const clientFullAddress = clientData
        ? [clientData.direccion, clientData.calle_numero, clientData.codigo_postal, clientData.municipio, clientData.provincia].filter(Boolean).join(', ')
        : '';
    const displayAddress = project?.direccion_obra || clientFullAddress || '-';
    const formattedStartDate = projectStartDate ? formatDate(projectStartDate) : 'No programada';
    const formattedEndDate = project?.fecha_fin_estimada ? formatDate(project.fecha_fin_estimada) : 'No programada';

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>

            {/* ✅ BOTÓN INFORME PDF */}
            <div className="flex justify-end mb-3">
                <Button
                    size="sm"
                    onClick={() => setModalInformeOpen(true)}
                    disabled={generandoPDF}
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                >
                    {generandoPDF
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generando...</>
                        : <><FileDown className="w-4 h-4 mr-2" /> Informe PDF</>
                    }
                </Button>
            </div>

            {/* ✅ MODAL GENERAR INFORME */}
            <Dialog open={modalInformeOpen} onOpenChange={setModalInformeOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileDown className="w-5 h-5 text-blue-600" />
                            Generar Informe PDF
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                        {/* Checkbox incluir presupuesto */}
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={incluirPresupuesto}
                                onChange={e => {
                                    setIncluirPresupuesto(e.target.checked);
                                    if (!e.target.checked) setPresupuestoPDF(null);
                                }}
                                className="mt-0.5 w-4 h-4 accent-blue-600"
                            />
                            <div>
                                <p className="font-semibold text-sm text-gray-800">Incluir presupuesto en el informe</p>
                                <p className="text-xs text-gray-500 mt-0.5">Claude analizará el PDF y extraerá todas las partidas, precios e importes</p>
                            </div>
                        </label>

                        {/* Dropzone PDF presupuesto */}
                        {incluirPresupuesto && (
                            <div>
                                {!presupuestoPDF ? (
                                    <label
                                        htmlFor="presupuesto-upload"
                                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-blue-300 rounded-xl bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors"
                                    >
                                        <UploadCloud className="w-8 h-8 text-blue-400 mb-2" />
                                        <p className="text-sm text-blue-600 font-medium">Arrastra o haz clic para subir</p>
                                        <p className="text-xs text-blue-400 mt-1">PDF del presupuesto</p>
                                        <input
                                            id="presupuesto-upload"
                                            type="file"
                                            accept="application/pdf"
                                            className="hidden"
                                            onChange={e => {
                                                if (e.target.files?.[0]) setPresupuestoPDF(e.target.files[0]);
                                            }}
                                        />
                                    </label>
                                ) : (
                                    <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                                        <FileText className="w-8 h-8 text-green-600 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-green-800 truncate">{presupuestoPDF.name}</p>
                                            <p className="text-xs text-green-600">{(presupuestoPDF.size / 1024 / 1024).toFixed(2)} MB · listo para analizar</p>
                                        </div>
                                        <button
                                            onClick={() => setPresupuestoPDF(null)}
                                            className="text-green-400 hover:text-red-500 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                                {incluirPresupuesto && !presupuestoPDF && (
                                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                                        ⚠ Sin PDF, el informe se generará sin sección de presupuesto
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setModalInformeOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleGenerarInforme}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {analizandoPresupuesto
                                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analizando presupuesto...</>
                                : <><FileDown className="w-4 h-4 mr-2" /> Generar informe</>
                            }
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="budget-reconciliation-desktop-only hidden md:block">
                <BudgetReconciliation
                    baseBudget={kpis.presupuesto_aceptado || 0}
                    approvedExtras={kpis.extras_aprobados || 0}
                    updatedContract={kpis.importe_contrato_actualizado || kpis.presupuesto_aceptado || 0}
                    estimatedExtraCost={kpis.extras_coste_estimado || 0}
                    actualExtraLabor={kpis.extras_mano_obra_real || 0}
                    pendingCount={kpis.extras_pendientes_count || 0}
                    pendingAmount={kpis.extras_pendientes_importe || 0}
                    formatCurrency={formatCurrency}
                />
            </div>

            {/* ===================== LAYOUT PRINCIPAL ===================== */}
            {/* Izquierda: Distribución (arriba) + Información del Cliente (abajo) */}
            {/* Derecha: KPIs 2×2 */}
            {/* En móvil: KPIs primero, luego Distribución y Cliente */}
            <div className="grid gap-3 md:gap-4 lg:grid-cols-2 items-start">

                {/* KPIs 2×2 — móvil: primero / desktop: derecha */}
                <div className="grid grid-cols-2 gap-2 md:gap-4 content-start lg:order-2">
                    {cards.map((card, i) => (
                        <motion.div key={card.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                            <StatCard {...card} />
                        </motion.div>
                    ))}
                </div>

                {/* Columna izquierda: Distribución + Información del Cliente */}
                <div className="space-y-3 md:space-y-4 lg:order-1">

                    {/* Distribución */}
                    <Card className="shadow-sm overflow-hidden">
                        <CardHeader className="p-2 md:p-6 pb-0 md:pb-2">
                            <CardTitle className="text-xs md:text-lg font-medium md:font-semibold truncate">Distribución</CardTitle>
                            <CardDescription className="text-[10px] md:text-sm hidden md:block">Margen vs Costes</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[180px] md:h-[300px] p-0 md:p-0">
                            {chartOptions ? (
                                <ReactECharts option={chartOptions} style={{ height: '100%', width: '100%' }} notMerge={true} lazyUpdate={true} />
                            ) : (
                                <ChartPlaceholder message="No data" className="text-xs" />
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <ProjectProfitabilityForecast projectId={projectId} project={project} kpis={kpis} />

            {/* ===================== INFO CLIENTE (OBRA SIN LEAD) ===================== */}
            {/* Mismo diseño que la tarjeta del lead: grid compacto de 2-3 columnas.   */}
            {/* Solo se muestra cuando la obra NO proviene de un lead.                   */}
            {(
                <div className="mt-4 md:mt-6 space-y-4 md:space-y-6">
                    <Card className={project?.lead_id ? 'md:hidden' : ''}>
                        <CardHeader>
                            <CardTitle className="text-base md:text-lg flex items-center gap-2">
                                <Building className="hidden md:inline w-5 h-5" /> Información del Cliente
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-x-6 md:gap-y-3 text-sm md:text-base">
                            <div className={!displayClienteName || displayClienteName === '-' ? 'hidden md:block' : ''}><Label className="text-[10px] md:text-xs text-muted-foreground">Cliente</Label><p className="font-medium break-words">{displayClienteName}</p></div>
                            <div className={!displayContactoName || displayContactoName === '-' || displayContactoName === 'Sin contacto' ? 'hidden md:block' : ''}><Label className="text-[10px] md:text-xs text-muted-foreground">Contacto</Label><p className="font-medium break-words">{displayContactoName}</p></div>
                            <div className={!displayPhone || displayPhone === '-' ? 'hidden md:block' : ''}>
                                <Label className="text-[10px] md:text-xs text-muted-foreground">Teléfono</Label>
                                {displayPhone && displayPhone !== '-' ? (
                                    <a href={`tel:${displayPhone}`} className="flex items-center gap-2 text-primary hover:underline"><Phone className="hidden md:inline w-4 h-4" /> {displayPhone}</a>
                                ) : (
                                    <p>N/A</p>
                                )}
                            </div>
                            {clientData?.email && (
                                <div><Label className="text-[10px] md:text-xs text-muted-foreground">Email</Label><a href={`mailto:${clientData.email}`} className="flex items-center gap-2 text-primary hover:underline break-all"><Mail className="hidden md:inline w-4 h-4" /> {clientData.email}</a></div>
                            )}
                            {clientData?.cif && (
                                <div><Label className="text-[10px] md:text-xs text-muted-foreground">CIF</Label><p>{clientData.cif}</p></div>
                            )}
                            <div className={!displayAddress || displayAddress === '-' ? 'hidden md:block' : ''}><Label className="text-[10px] md:text-xs text-muted-foreground">Dirección</Label><p className="flex items-center gap-2 break-words"><MapPin className="hidden md:inline w-4 h-4 text-primary shrink-0" /> {displayAddress}</p></div>
                            {clientData?.codigo_postal && (
                                <div><Label className="text-[10px] md:text-xs text-muted-foreground">Código Postal</Label><p>{clientData.codigo_postal}</p></div>
                            )}
                            {clientData?.municipio && (
                                <div><Label className="text-[10px] md:text-xs text-muted-foreground">Municipio</Label><p>{clientData.municipio}</p></div>
                            )}
                            <div className={!projectStartDate ? 'hidden md:block' : ''}><Label className="text-[10px] md:text-xs text-muted-foreground">Fecha Inicio de Obra</Label><p className="flex items-center gap-2"><Calendar className="hidden md:inline w-4 h-4 text-primary shrink-0" /> {formattedStartDate}</p></div>
                            <div className={!project?.fecha_fin_estimada ? 'hidden md:block' : ''}><Label className="text-[10px] md:text-xs text-muted-foreground">Fin Estimado</Label><p className="flex items-center gap-2"><CalendarClock className="hidden md:inline w-4 h-4 text-primary shrink-0" /> {formattedEndDate}</p></div>
                        </CardContent>
                    </Card>

                </div>
            )}

            {/* ===================== INFO HEREDADA DEL LEAD ===================== */}
            {/* Si la obra nació de un lead, se muestran debajo las mismas tarjetas */}
            {/* del lead: Información General y Ubicación + Historial de Comentarios */}
            {project?.lead_id && (
                <LeadInheritedInfo leadId={project.lead_id} />
            )}
        </motion.div>
    );
};

export default ProjectDashboard;
