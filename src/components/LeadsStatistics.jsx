import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Users, TrendingUp, AlertCircle, PieChart, BarChart2, CheckCircle2, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ElegantDonutChart from '@/components/charts/ElegantDonutChart';
import { getStatusLabel, STATUS_COLORS } from '@/utils/leadStatus';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { supabase } from '@/lib/customSupabaseClient';

// --- CONSTANTS ---
// Use centralized colors to ensure chart matches badges/selectors
const COLORS_STATUS = {
  ...STATUS_COLORS
};

const COLORS_CONVERSION = {
  'Ganado': STATUS_COLORS.aceptado,      // emerald-500
  'Perdido': STATUS_COLORS.rechazado,    // red-500
  'En Progreso': STATUS_COLORS.nuevo     // blue-500
};

const COLORS_CATEGORY = [
  '#6366f1', // Indigo
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#f43f5e', // Rose
  '#64748b', // Slate
  '#3b82f6', // Blue
  '#d946ef'  // Fuchsia
];

// --- HELPERS ---

const normalizeText = (text) => {
  return getStatusLabel(text);
};

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

// --- CUSTOM COMPONENTS ---

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const { value, percentUi, tipo } = payload[0].payload;
    return (
      <div className="bg-slate-800 text-white text-xs py-1 px-2 rounded shadow-lg border border-slate-700 font-medium z-50">
        <div>{value} {percentUi}</div>
        {tipo && <div className="text-[10px] text-slate-400 capitalize mt-0.5">{tipo}</div>}
      </div>
    );
  }
  return null;
};

const CustomYAxisTick = ({ x, y, payload, isMobile }) => {
  const width = isMobile ? 115 : 120; 
  const xPos = x - 5; 

  return (
    <foreignObject x={xPos - width} y={y - 10} width={width} height={20}>
      <div 
        xmlns="http://www.w3.org/1999/xhtml"
        className="h-full flex items-center justify-end text-slate-500 font-medium leading-tight"
        style={{ 
            fontSize: isMobile ? '10px' : '11px', 
            textAlign: 'right',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            lineHeight: '1.1',
            overflow: 'hidden'
        }}
        title={payload.value}
      >
        <span className="line-clamp-2 w-full">{payload.value}</span>
      </div>
    </foreignObject>
  );
};

const LeadsStatistics = ({ 
  leads = [], 
  filteredLeads = [], 
  filters = {}, 
  onStatusClick, 
  onCategoryClick, 
  onConversionClick,
  onClearFilters 
}) => {
  
  const isMobile = useIsMobile();
  const currentCategoryKey = filters.category; 
  
  // State for category widget data
  const [categoryStats, setCategoryStats] = useState([]);

  // Fetch Category Stats
  useEffect(() => {
    const fetchStats = async () => {
        try {
            // Using the new simple view as requested
            const { data, error } = await supabase
                .from('v_leads_categoria_widget_simple_v1')
                .select('*');
            
            if (error) throw error;
            // Sorting ascending by total for the bar chart
            setCategoryStats((data || []).sort((a, b) => a.total - b.total));
        } catch (err) {
            console.error("Error fetching category stats", err);
        }
    };
    fetchStats();
  }, [leads]); // Re-fetch when leads list updates to keep counts in sync

  const handleCategoryBarClick = (entry) => {
    if (onCategoryClick) {
        onCategoryClick(entry.rawName); 
    }
  };

  const categoryChartData = useMemo(() => {
    if (!categoryStats || categoryStats.length === 0) return [];

    return categoryStats.map((item, idx) => ({
      name: item.nombre,          // mapped from nombre
      rawName: item.codigo,       // mapped from codigo (used for filtering)
      value: item.total,          // mapped from total
      percentUi: item.porcentaje_ui, 
      displayLabel: item.nombre,
      color: COLORS_CATEGORY[idx % COLORS_CATEGORY.length]
    }));
  }, [categoryStats]);

  const activeDataset = useMemo(() => {
    if (!currentCategoryKey) return leads;
    return leads.filter(l => l.category_code === currentCategoryKey);
  }, [leads, currentCategoryKey]);

  const currentCategoryLabel = useMemo(() => {
      if(!currentCategoryKey) return null;
      const found = categoryChartData.find(o => o.rawName === currentCategoryKey);
      return found ? found.name : currentCategoryKey;
  }, [currentCategoryKey, categoryChartData]);

  // Compressed vertical spacing logic
  const chartHeight = useMemo(() => {
      const calculated = 40 + (categoryChartData.length * 32);
      return Math.max(200, calculated);
  }, [categoryChartData.length]);

  const kpiData = useMemo(() => {
    const kpiSet = filteredLeads; 
    const total = kpiSet.length;
    const convertedCount = kpiSet.filter(l => ['aceptado'].includes(l.estado)).length;
    const conversionRate = total > 0 ? ((convertedCount / total) * 100).toFixed(1) : 0;

    const activeLabels = [];
    if (filters.status && filters.status !== 'all') activeLabels.push(`Estado: ${normalizeText(filters.status)}`);
    if (currentCategoryKey) activeLabels.push(`Categoría: ${currentCategoryLabel}`); 
    if (filters.conversion) activeLabels.push(`Fase: ${filters.conversion}`);
    if (filters.search) activeLabels.push(`Busq: "${filters.search}"`);

    const filterLabel = activeLabels.length > 0 ? `Filtrado por: ${activeLabels.join(' + ')}` : null;

    return {
      total,
      conversionRate,
      filterLabel
    };
  }, [filteredLeads, filters, currentCategoryKey, currentCategoryLabel]);

  const chartData = useMemo(() => {
    const total = activeDataset.length;
    if (total === 0) return null;

    const countsByLabel = {};
    const labelToColorKey = {}; 
    let validTotal = 0;

    activeDataset.forEach(l => {
      const s = l.estado || 'nuevo';
      if (['aprobado', 'convertido'].includes(s)) return;

      const label = normalizeText(s); 
      countsByLabel[label] = (countsByLabel[label] || 0) + 1;
      validTotal++;

      if (!labelToColorKey[label]) {
          labelToColorKey[label] = s;
      }
    });

    const statusData = Object.entries(countsByLabel).map(([label, val]) => {
      const sourceKey = labelToColorKey[label];
      const color = COLORS_STATUS[sourceKey] || COLORS_STATUS.default;

      return {
        name: label,
        rawName: sourceKey,
        value: val,
        color: color,
        percent: validTotal > 0 ? val / validTotal : 0
      };
    }).sort((a, b) => b.value - a.value);

    // Contadores para el funnel
    let converted = 0;
    let lost = 0;
    let inProgress = 0;

    activeDataset.forEach(l => {
      const s = l.estado;
      if (['aprobado', 'convertido'].includes(s)) return;

      if (['aceptado'].includes(s)) converted++;
      else if (['rechazado', 'cancelado', 'anulado'].includes(s)) lost++;
      else inProgress++;
    });

    // --- LÓGICA MODIFICADA PARA EL FUNNEL ---
    // Si hay una categoría seleccionada, mostrar solo Ganado vs Perdido (leads cerrados)
    // para reflejar el % de éxito real sin incluir los que están en progreso
    let conversionData;
    let contextConversionRate;

    if (currentCategoryKey) {
      // Vista filtrada por categoría: solo leads cerrados (Ganado + Perdido)
      const closedTotal = converted + lost;
      contextConversionRate = closedTotal > 0 ? ((converted / closedTotal) * 100).toFixed(1) : 0;
      
      conversionData = [
        { name: 'Ganado', value: converted, color: COLORS_CONVERSION['Ganado'], percent: closedTotal > 0 ? converted / closedTotal : 0 },
        { name: 'Perdido', value: lost, color: COLORS_CONVERSION['Perdido'], percent: closedTotal > 0 ? lost / closedTotal : 0 }
      ].filter(d => d.value > 0);
    } else {
      // Vista general: incluir todos (Ganado + En Progreso + Perdido)
      const funnelTotal = converted + inProgress + lost;
      contextConversionRate = funnelTotal > 0 ? ((converted / funnelTotal) * 100).toFixed(1) : 0;
      
      conversionData = [
        { name: 'Ganado', value: converted, color: COLORS_CONVERSION['Ganado'], percent: funnelTotal > 0 ? converted / funnelTotal : 0 },
        { name: 'En Progreso', value: inProgress, color: COLORS_CONVERSION['En Progreso'], percent: funnelTotal > 0 ? inProgress / funnelTotal : 0 },
        { name: 'Perdido', value: lost, color: COLORS_CONVERSION['Perdido'], percent: funnelTotal > 0 ? lost / funnelTotal : 0 }
      ].filter(d => d.value > 0);
    }

    return {
      statusData,
      conversionData,
      contextTotal: validTotal, 
      contextConversionRate
    };
  }, [activeDataset, currentCategoryKey]);


  if (!categoryChartData || categoryChartData.length === 0) return (
    <div className="flex flex-col items-center justify-center p-12 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 mb-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
        <AlertCircle className="h-8 w-8 text-slate-400" />
      </div>
      <p className="text-slate-600 dark:text-slate-400 font-medium">No hay datos suficientes para mostrar estadísticas.</p>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.5, staggerChildren: 0.1 }}
      className="space-y-6 mb-8"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div whileHover={{ y: -4 }} className="h-full">
          <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-slate-900 border-blue-100 dark:border-blue-900/50 shadow-sm overflow-hidden h-full">
            <CardContent className="p-5 flex items-center justify-between relative h-full">
              <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-6 -mt-6 blur-2xl"></div>
              <div className="flex flex-col justify-between h-full z-10">
                <div>
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Total Leads</p>
                  <p className="text-3xl font-black text-slate-800 dark:text-white tabular-nums">
                    {kpiData.total}
                  </p>
                </div>
                {kpiData.filterLabel && (
                  <div className="mt-3 pt-3 border-t border-blue-100 dark:border-blue-900/30 flex justify-between items-center">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 leading-tight max-w-[80%]">
                      <Filter className="w-3 h-3 flex-shrink-0" /> 
                      <span className="truncate" title={kpiData.filterLabel}>{kpiData.filterLabel}</span>
                    </p>
                    {onClearFilters && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 -mr-1 text-blue-400 hover:text-blue-600 hover:bg-blue-100"
                            onClick={onClearFilters}
                            title="Limpiar filtros"
                        >
                            <X className="w-3 h-3" />
                        </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400 absolute top-5 right-5">
                <Users className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileHover={{ y: -4 }} className="h-full">
          <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900 border-emerald-100 dark:border-emerald-900/50 shadow-sm overflow-hidden h-full">
            <CardContent className="p-5 flex items-center justify-between relative h-full">
              <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-6 -mt-6 blur-2xl"></div>
              <div className="flex flex-col justify-between h-full z-10">
                <div>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Conversión</p>
                  <p className="text-3xl font-black text-slate-800 dark:text-white tabular-nums">{kpiData.conversionRate}%</p>
                </div>
                {kpiData.filterLabel && (
                  <div className="mt-3 pt-3 border-t border-emerald-100 dark:border-emerald-900/30">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 leading-tight">
                      <span className="opacity-70">
                        {currentCategoryKey ? `En ${currentCategoryLabel}` : 'En vista actual'}
                      </span>
                    </p>
                  </div>
                )}
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 absolute top-5 right-5">
                <TrendingUp className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
        <div className="min-h-[300px]">
            {chartData ? (
                <ElegantDonutChart 
                title={currentCategoryKey ? `Estado (${currentCategoryLabel})` : "Estado Actual"}
                icon={PieChart}
                data={chartData.statusData} 
                centerLabel={{ value: chartData.contextTotal, label: 'Total' }}
                activeKey={filters.status !== 'all' ? normalizeText(filters.status) : null}
                onSectionClick={(data) => onStatusClick(data.rawName)}
                />
            ) : (
                <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground bg-white/50 rounded-xl border border-dashed">
                    Sin datos para esta selección
                </div>
            )}
        </div>

        <div className="min-h-[300px]">
            {chartData ? (
                <ElegantDonutChart 
                title={currentCategoryKey ? `Funnel (${currentCategoryLabel})` : "Funnel Conversión"}
                icon={CheckCircle2}
                data={chartData.conversionData} 
                centerLabel={{ value: chartData.contextConversionRate + '%', label: 'Éxito' }}
                activeKey={filters.conversion}
                onSectionClick={(data) => onConversionClick(data.name)} 
                />
            ) : (
                <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground bg-white/50 rounded-xl border border-dashed">
                    Sin datos para esta selección
                </div>
            )}
        </div>

        <div className="md:col-span-2 lg:col-span-1 w-full" style={{ height: chartHeight }}>
          <Card className="h-full shadow-sm hover:shadow-md transition-all duration-300 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
               <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                 <BarChart2 className="w-5 h-5" />
               </div>
               <h3 className="font-semibold text-slate-700 dark:text-slate-200">Categoría de Leads</h3>
            </div>
            <div className="flex-1 p-4 min-h-0"> 
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    layout="vertical"
                    data={categoryChartData} 
                    margin={{ top: 0, right: 30, left: 0, bottom: 0 }} 
                    barCategoryGap={2} 
                  >
                     <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" opacity={0.5} />
                     <XAxis type="number" hide />
                     <YAxis 
                        dataKey="displayLabel" 
                        type="category" 
                        width={isMobile ? 120 : 130}
                        axisLine={false} 
                        tickLine={false} 
                        tick={<CustomYAxisTick isMobile={isMobile} />} 
                        interval={0}
                        reversed={true} 
                     />
                     <Tooltip 
                        content={<CustomTooltip />} 
                        cursor={{ fill: 'transparent' }} 
                     />
                     <Bar 
                        dataKey="value" 
                        radius={[0, 4, 4, 0]} 
                        barSize={isMobile ? 18 : 14} 
                        maxBarSize={40}
                     >
                       {categoryChartData.map((entry, index) => (
                         <Cell 
                           key={`cell-${index}`} 
                           fill={entry.rawName === currentCategoryKey ? '#3b82f6' : entry.color} 
                           className="cursor-pointer transition-all duration-300 hover:opacity-80"
                           onClick={() => handleCategoryBarClick(entry)}
                         />
                       ))}
                     </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
};

export default LeadsStatistics;
