import React, { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  Loader2, ArrowLeft, ServerCrash, TrendingUp, DollarSign,
  FileText, Zap, User, Phone, MapPin,
  Building, Mail, PieChart as PieChartIcon,
  Map, Calendar, CalendarClock, Hash, ExternalLink, FileQuestion
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { fmtMadrid, formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import MedicionesPanel from '@/components/MedicionesPanel';
import ReplanteoTab from '@/components/ReplanteoTab';

// --- Helper Functions ---

// Updated fetch: Queries 'proyectos' table directly with a join to 'clientes' 
// to ensure we get specific project fields (like contacto_nombre) AND client details in one go.
const fetchProjectInfo = async (obraId) => {
  if (!obraId) return null;
  const { data, error } = await supabase
    .from('proyectos')
    .select(`
      *,
      cliente:clientes (*)
    `)
    .eq('id', obraId)
    .maybeSingle();

  if (error) {
    console.error("[ObraDashboard] Error fetching info:", error);
    throw error;
  }
  return data;
};

const fetchDashboardKpis = async (obraId) => {
  if (!obraId) return null;
  const { data, error } = await supabase
    .from('v_proyecto_dashboard_v1')
    .select('*')
    .eq('proyecto_id', obraId)
    .maybeSingle();

  if (error) {
    console.warn("[ObraDashboard] Warning fetching KPIs:", error.message);
    return null;
  }
  return data;
};

// --- Sub-Components ---

const DetailItem = ({ icon: Icon, label, value, href, isLink, fullWidth }) => (
  <div className={`flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group ${fullWidth ? 'col-span-full' : ''}`}>
    <div className="p-2.5 rounded-lg bg-white/10 text-white shrink-0 group-hover:scale-110 transition-transform mt-0.5">
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex flex-col min-w-0 flex-1">
      <span className="text-[10px] uppercase tracking-wider font-bold text-blue-100/70 mb-0.5">{label}</span>
      {isLink && href ? (
        <a
          href={href}
          className="text-base font-semibold text-white hover:text-blue-200 truncate hover:underline underline-offset-4 decoration-blue-200/50 break-words"
          title={value}
        >
          {value}
        </a>
      ) : (
        <span className="text-base font-semibold text-white break-words leading-tight">
          {value || <span className="text-white/30 italic font-normal">--</span>}
        </span>
      )}
    </div>
  </div>
);

const ClientInfoSection = ({ client, project, isLoading, navigate }) => {
  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg bg-muted/10 overflow-hidden mb-8 animate-pulse">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-1/3 space-y-4">
              <Skeleton className="h-8 w-3/4 bg-muted" />
              <Skeleton className="h-4 w-1/2 bg-muted" />
            </div>
            <div className="w-full md:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-16 w-full bg-muted" />
              <Skeleton className="h-16 w-full bg-muted" />
              <Skeleton className="h-16 w-full bg-muted" />
              <Skeleton className="h-16 w-full bg-muted" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Fallback if no project or client is linked, but show partial data if available
  const hasClient = !!client;
  const displayClientName = client?.nombre || 'Sin Cliente Asignado';

  // Resolve Contact Info: Prioritize Project Specifics -> Fallback to Client Defaults
  const contactName = project?.contacto_nombre || client?.contacto || client?.persona_contacto || 'Sin contacto';
  const contactPhone = project?.contacto_telefono || client?.telefono || 'Sin teléfono';
  const contactEmail = client?.email || 'Sin email';
  const projectAddress = project?.direccion_obra; // Address of the worksite
  const clientAddress = [client?.direccion, client?.calle_numero, client?.codigo_postal, client?.municipio, client?.provincia].filter(Boolean).join(', ');

  return (
    <Card className="border-0 shadow-2xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white overflow-hidden mb-8 relative group isolate">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 -z-10" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 -z-10" />

      <CardContent className="p-6 md:p-8">
        <div className="flex flex-col xl:flex-row gap-8 xl:gap-12">

          {/* Identity Column */}
          <div className="xl:w-1/3 flex flex-col gap-4 border-b xl:border-b-0 xl:border-r border-white/10 pb-6 xl:pb-0 xl:pr-8">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md shadow-inner border border-white/5">
                <Building className="w-8 h-8 text-blue-200" />
              </div>
              <div className="space-y-1">
                <h2 className="text-3xl font-extrabold tracking-tight leading-none text-white drop-shadow-sm">
                  {displayClientName}
                </h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge className="bg-blue-500/20 text-blue-100 hover:bg-blue-500/30 border-blue-400/20">
                    {hasClient ? 'CLIENTE' : 'NO ASIGNADO'}
                  </Badge>
                  {client?.cif && (
                    <Badge variant="outline" className="text-white/80 border-white/20 font-mono">
                      CIF: {client.cif}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {hasClient && (
              <div className="mt-2">
                <Button
                  onClick={() => navigate(`/crm/clientes`)}
                  className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-lg backdrop-blur-sm transition-all"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ver ficha cliente
                </Button>
              </div>
            )}

            {hasClient && (
              <div className="mt-auto pt-4 text-white/50 text-xs flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                <span>Cliente desde: {client.fecha_creacion ? fmtMadrid(client.fecha_creacion, 'date') : 'N/A'}</span>
              </div>
            )}
          </div>

          {/* Details Grid */}
          <div className="xl:w-2/3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <DetailItem
              icon={User}
              label="Contacto Obra / Cliente"
              value={contactName}
            />
            <DetailItem
              icon={Phone}
              label="Teléfono Contacto"
              value={contactPhone}
              href={contactPhone && contactPhone !== 'Sin teléfono' ? `tel:${contactPhone}` : null}
              isLink
            />
            <DetailItem
              icon={Mail}
              label="Email (Cliente)"
              value={contactEmail}
              href={contactEmail && contactEmail !== 'Sin email' ? `mailto:${contactEmail}` : null}
              isLink
            />

            {/* Project Dates */}
            <DetailItem
              icon={Calendar}
              label="Inicio de Obra"
              value={project?.fecha_inicio ? fmtMadrid(project.fecha_inicio, 'date') : 'No def.'}
            />
            <DetailItem
              icon={CalendarClock}
              label="Fin Estimado"
              value={project?.fecha_fin_estimada ? fmtMadrid(project.fecha_fin_estimada, 'date') : 'No def.'}
            />

            {/* Show Project Address specifically */}
            <DetailItem
              icon={MapPin}
              label="Dirección de la Obra"
              value={projectAddress || 'No especificada'}
              fullWidth={!clientAddress}
            />

            {/* Show Client Address if different or available */}
            {clientAddress && (
              <DetailItem
                icon={Map}
                label="Dirección Fiscal Cliente"
                value={clientAddress}
                fullWidth
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const KpiCard = ({ title, value, icon, subValue, className, trend }) => (
  <Card className={`${className} transition-all duration-200 hover:scale-[1.02] hover:shadow-md`}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {subValue && (
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          {trend && <span className={trend === 'up' ? 'text-green-500' : 'text-red-500'}>{trend === 'up' ? '↑' : '↓'}</span>}
          {subValue}
        </p>
      )}
    </CardContent>
  </Card>
);

const DistributionChart = ({ data, isLoading }) => {
  const COLORS = ['#3b82f6', '#f97316', '#22c55e', '#ef4444'];

  const chartData = useMemo(() => {
    if (!data) return [];
    const materiales = Number(data.coste_total_materiales || 0);
    const manoObra = Number(data.coste_total_mano_obra || 0);
    const margen = Number(data.margen || 0);
    const result = [
      { name: 'Materiales', value: materiales },
      { name: 'Mano Obra', value: manoObra },
    ];
    if (margen > 0) {
      result.push({ name: 'Margen', value: margen });
    }
    return result;
  }, [data]);

  const total = useMemo(() => {
    if (!data) return 0;
    return Number(data.presupuesto_aceptado || 0);
  }, [data]);

  if (isLoading) {
    return <Card className="h-full flex items-center justify-center bg-muted/5 min-h-[300px]"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></Card>;
  }

  if (total === 0 && chartData.every(d => d.value === 0)) {
    return (
      <Card className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground bg-muted/5 border-dashed min-h-[300px]">
        <PieChartIcon className="w-12 h-12 mb-3 opacity-20" />
        <p>No hay datos financieros suficientes para mostrar la distribución.</p>
      </Card>
    );
  }

  return (
    <Card className="h-full rounded-xl shadow-lg border border-border/50 overflow-hidden flex flex-col min-h-[350px]">
      <CardHeader className="border-b border-border/40 bg-muted/10 pb-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-bold">Distribución Económica</CardTitle>
          <Badge variant="outline" className="ml-2">Costes vs Margen</Badge>
        </div>
        <CardDescription>Desglose del presupuesto</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 p-6 relative">
        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
              ))}
            </Pie>
            <RechartsTooltip
              formatter={(value) => formatCurrency(value)}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            />
            <Legend verticalAlign="bottom" height={36} iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
          <span className="text-xs text-muted-foreground uppercase font-semibold">Total</span>
          <span className="text-xl font-bold text-foreground">{formatCurrency(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
};

// --- Main Component ---

const ObraDashboardSafe = ({ navigate, appState, obraId: propObraId }) => {
  const { toast } = useToast();
  const { sessionRole } = useAuth();
  console.log('SESSION ROLE COMPLETO:', JSON.stringify(sessionRole));
  console.log('sessionRole:', sessionRole);
  // Resolve Obra ID (prop or appState)
  const obraId = propObraId || appState?.selected_obra_id;

  const [activeTab, setActiveTab] = useState('resumen');
  const [isUpdateModalOpen, setUpdateModalOpen] = useState(false);
  const [newEstado, setNewEstado] = useState('');

  // 1. Info Proyecto (fetches project AND client now)
  const { data: info, isLoading: loadingInfo, refetch: refetchInfo } = useQuery({
    queryKey: ['ds_info', obraId],
    queryFn: () => fetchProjectInfo(obraId),
    enabled: !!obraId,
    retry: 1
  });

  // Extract client info from the joined response
  const clientInfo = info?.cliente;

  // 2. KPIs
  const { data: kpis, isLoading: loadingKpis, refetch: refetchKpis } = useQuery({
    queryKey: ['ds_kpis', obraId],
    queryFn: () => fetchDashboardKpis(obraId),
    enabled: !!obraId
  });

  const setEstadoMutation = useMutation({
    mutationFn: async ({ id, estado }) => {
      const { error } = await supabase.rpc('proyecto_set_estado_v1', { p_id: id, p_estado: estado });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Estado actualizado' });
      setUpdateModalOpen(false);
      refetchInfo();
      refetchKpis();
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Error', description: error.message })
  });

  const handleUpdateEstado = () => {
    if (newEstado) setEstadoMutation.mutate({ id: obraId, estado: newEstado });
  };

  const estadoOptions = ['activo', 'pendiente', 'en curso', 'facturado', 'completada'];

  if (!obraId) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] text-center">
        <ServerCrash className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">No se ha seleccionado ninguna obra</h2>
        <Button onClick={() => navigate('/gestion/obras')}><ArrowLeft className="mr-2 h-4 w-4" /> Volver al listado</Button>
      </div>
    );
  }

  // Tabs definition
  const TABS = [
    { id: 'resumen', label: '📊 Resumen' },
    { id: 'replanteo', label: '🧠 Replanteo IA' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">

      {/* 1. Client & Project Header Info */}
      <ClientInfoSection
        client={clientInfo}
        project={info}
        isLoading={loadingInfo}
        navigate={navigate}
      />

      {/* 2. Tab Navigation */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-all border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
        {(sessionRole?.role === 'admin' || sessionRole?.role === 'encargado') && (
          <div className="ml-auto flex items-center pb-1">
            <Button variant="outline" size="sm" onClick={() => setUpdateModalOpen(true)}>
              Cambiar Estado Obra
            </Button>
          </div>
        )}
      </div>

      {/* 3. Tab Content */}
      {activeTab === 'resumen' && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              className="shadow-sm border-l-4 border-l-blue-500"
              title="Presupuesto"
              value={formatCurrency(kpis?.presupuesto_aceptado || 0)}
              icon={<FileText className="h-4 w-4 text-blue-500" />}
            />
            <KpiCard
              className="shadow-sm border-l-4 border-l-orange-500"
              title="Coste Total"
              value={formatCurrency(kpis?.costo_total || 0)}
              icon={<TrendingUp className="h-4 w-4 text-orange-500" />}
              subValue="Mat. + Mano Obra"
            />
            <KpiCard
              className="shadow-sm border-l-4 border-l-green-500"
              title="Margen Bruto"
              value={formatCurrency(kpis?.margen || 0)}
              icon={<DollarSign className="h-4 w-4 text-green-500" />}
              subValue="Beneficio"
              trend={kpis?.margen >= 0 ? 'up' : 'down'}
            />
            <KpiCard
              className="shadow-sm border-l-4 border-l-purple-500"
              title="Rentabilidad"
              value={`${Number(kpis?.rentabilidad_real_pct || 0).toFixed(2)}%`}
              icon={<Zap className="h-4 w-4 text-purple-500" />}
              subValue="Real"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div className="md:col-span-2">
              <DistributionChart data={kpis} isLoading={loadingKpis} />
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-xl font-bold mb-4">📐 Mediciones por empleado</h2>
            <MedicionesPanel
              obraId={obraId}
              obraNombre={info?.nombre_proyecto || ''}
              userRol={sessionRole?.rol}
            />
          </div>
        </>
      )}

      {activeTab === 'replanteo' && (
        <ReplanteoTab proyectoId={obraId} />
      )}

      {/* Update Modal */}
      <Dialog open={isUpdateModalOpen} onOpenChange={setUpdateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Actualizar Estado de Obra</DialogTitle>
            <DialogDescription>Selecciona el nuevo estado para "{info?.nombre_proyecto}".</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="estado-update">Nuevo Estado</Label>
              <Select value={newEstado} onValueChange={setNewEstado}>
                <SelectTrigger id="estado-update"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {estadoOptions.map(opt => (
                    <SelectItem key={opt} value={opt} className="capitalize">{opt.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdateEstado} disabled={setEstadoMutation.isPending}>
              {setEstadoMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Actualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ObraDashboardSafe;