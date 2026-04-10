import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Wrench, CheckCircle2, PieChart, BarChart2, Filter, X, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ElegantDonutChart from '@/components/charts/ElegantDonutChart';
import ElegantBarChart from '@/components/charts/ElegantBarChart';
import { getStatusColor, getStatusLabel } from '@/utils/statusColors';

const COLORS_CONVERSION = {
  'Ganado': '#10b981',      // emerald-500
  'Perdido': '#f43f5e',     // rose-500
  'En Progreso': '#3b82f6'  // blue-500
};

const COLORS_ORIGIN = [
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

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
      duration: 0.5
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: {
      duration: 0.8,
      ease: "easeInOut"
    }
  }
};

const PartesStatistics = ({ 
  partes = [], 
  filters = {}, 
  onStatusClick, 
  onOriginClick, 
  onClearFilters 
}) => {
  
  const [animateCharts, setAnimateCharts] = useState(false);

  // --- Derived Data ---
  const stats = useMemo(() => {
    const total = partes.length;
    
    // 1. Status Distribution with REQUIRED 8 states
    const requiredStates = [
        'NUEVO', 
        'CONTACTADO', 
        'VISITA AGENDADA', 
        'VISITADO', 
        'PRESUPUESTADO', 
        'ACEPTADO', 
        'RECHAZADO', 
        'CANCELADO'
    ];

    const statusCounts = {};
    // Initialize counts to 0
    requiredStates.forEach(s => statusCounts[s] = 0);

    // Count actual data
    partes.forEach(p => {
      const s = p.estado_ui || 'DESCONOCIDO';
      // Normalize to match required keys if casing differs, though view returns UPPER
      const key = requiredStates.includes(s) ? s : 'DESCONOCIDO';
      if (key !== 'DESCONOCIDO') {
          statusCounts[key] = (statusCounts[key] || 0) + 1;
      }
    });
    
    // Map to chart format, keeping exact order
    const statusData = requiredStates.map(key => ({
      name: getStatusLabel(key), // Uses utility to get nice label
      rawName: key,
      value: statusCounts[key],
      color: getStatusColor(key) 
    }));

    // 2. Conversion / Resolution Funnel (Simplified based on new states)
    // ACEPTADO = Ganado
    // RECHAZADO/CANCELADO = Perdido
    // Others = En Progreso
    let ganado = statusCounts['ACEPTADO'] || 0;
    let perdido = (statusCounts['RECHAZADO'] || 0) + (statusCounts['CANCELADO'] || 0);
    let enProgreso = total - (ganado + perdido);

    const conversionData = [
      { name: 'Ganado', value: ganado, color: COLORS_CONVERSION['Ganado'], percent: total > 0 ? ganado/total : 0 },
      { name: 'En Progreso', value: enProgreso, color: COLORS_CONVERSION['En Progreso'], percent: total > 0 ? enProgreso/total : 0 },
      { name: 'Perdido', value: perdido, color: COLORS_CONVERSION['Perdido'], percent: total > 0 ? perdido/total : 0 }
    ].filter(d => d.value > 0); // Hide zero segments for cleanliness in funnel

    const completionRate = total > 0 ? ((ganado / total) * 100).toFixed(1) : 0;

    // 3. Origin Distribution
    const originCounts = {};
    partes.forEach(p => {
      const o = p.origin || 'Interno';
      originCounts[o] = (originCounts[o] || 0) + 1;
    });

    const originData = Object.entries(originCounts).map(([key, val], idx) => ({
      name: key,
      rawName: key,
      value: val,
      color: COLORS_ORIGIN[idx % COLORS_ORIGIN.length]
    })).sort((a, b) => b.value - a.value);

    // 4. Labels for Filters
    const activeLabels = [];
    if (filters.status && filters.status !== 'all') activeLabels.push(`Estado: ${getStatusLabel(filters.status)}`);
    if (filters.origin && filters.origin !== 'all') activeLabels.push(`Origen: ${filters.origin}`);
    if (filters.search) activeLabels.push(`Busq: "${filters.search}"`);
    
    const filterLabel = activeLabels.length > 0 ? `Filtrado por: ${activeLabels.join(' + ')}` : null;

    return {
      total,
      completionRate,
      statusData,
      conversionData,
      originData,
      filterLabel
    };
  }, [partes, filters]);

  // Trigger animation only when data is ready
  useEffect(() => {
    if (partes) { // Always animate if loaded, even if total is 0 (shows empty charts correctly initialized)
        const timer = setTimeout(() => {
            setAnimateCharts(true);
        }, 100);
        return () => clearTimeout(timer);
    }
  }, [partes]);

  const handleOriginBarClick = (entry) => {
    const newOrigin = entry.rawName === filters.origin ? 'all' : entry.rawName;
    if (onOriginClick) onOriginClick(newOrigin);
  };

  if (!stats) return null;

  return (
    <motion.div 
      key={`stats-container-${stats.total}`}
      variants={containerVariants}
      initial="hidden"
      animate={animateCharts ? "show" : "hidden"}
      className="space-y-6 mb-8"
    >
      {/* --- KPI CARDS ROW --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Total Partes */}
        <motion.div variants={itemVariants} whileHover={{ y: -4 }} className="h-full">
          <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-slate-900 border-blue-100 dark:border-blue-900/50 shadow-sm overflow-hidden h-full">
            <CardContent className="p-5 flex items-center justify-between relative h-full">
              <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-6 -mt-6 blur-2xl"></div>
              <div className="flex flex-col justify-between h-full z-10">
                <div>
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Total Partes</p>
                  <p className="text-3xl font-black text-slate-800 dark:text-white tabular-nums">{stats.total}</p>
                </div>
                {stats.filterLabel && (
                  <div className="mt-3 pt-3 border-t border-blue-100 dark:border-blue-900/30 flex justify-between items-center">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 leading-tight max-w-[80%]">
                      <Filter className="w-3 h-3 flex-shrink-0" /> 
                      <span className="truncate" title={stats.filterLabel}>{stats.filterLabel}</span>
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
                <Wrench className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Card 2: Resolution Rate */}
        <motion.div variants={itemVariants} whileHover={{ y: -4 }} className="h-full">
          <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900 border-emerald-100 dark:border-emerald-900/50 shadow-sm overflow-hidden h-full">
            <CardContent className="p-5 flex items-center justify-between relative h-full">
              <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-6 -mt-6 blur-2xl"></div>
              <div className="flex flex-col justify-between h-full z-10">
                <div>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Tasa Resolución</p>
                  <p className="text-3xl font-black text-slate-800 dark:text-white tabular-nums">{stats.completionRate}%</p>
                </div>
                {stats.filterLabel && (
                  <div className="mt-3 pt-3 border-t border-emerald-100 dark:border-emerald-900/30">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 leading-tight">
                      <span className="opacity-70">En vista actual</span>
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

      {/* --- CHARTS GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
        
        {/* CHART 1: Status Distribution (Donut) */}
        <motion.div variants={itemVariants} className="min-h-[300px]">
          <ElegantDonutChart 
            key="chart-status"
            title="Estado Actual"
            icon={PieChart}
            data={stats.statusData} 
            centerLabel={{ value: stats.total, label: 'Total' }}
            activeKey={filters.status && filters.status !== 'all' ? getStatusLabel(filters.status) : null}
            onSectionClick={onStatusClick ? (data) => onStatusClick(data.rawName) : undefined}
          />
        </motion.div>

        {/* CHART 2: Funnel / Resolution (Donut) */}
        <motion.div variants={itemVariants} className="min-h-[300px]">
          <ElegantDonutChart 
            key="chart-conversion"
            title="Estado Resolución"
            icon={CheckCircle2}
            data={stats.conversionData} 
            centerLabel={{ value: stats.completionRate + '%', label: 'Éxito' }}
          />
        </motion.div>

        {/* CHART 3: Origin (Bar) */}
        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-1 w-full h-[400px]">
          <ElegantBarChart 
            key="chart-origin"
            title="Origen de Partes" 
            icon={BarChart2}
            data={stats.originData}
            activeKey={filters.origin && filters.origin !== 'all' ? filters.origin : null}
            onBarClick={handleOriginBarClick}
            className="h-full shadow-sm hover:shadow-md transition-all duration-300 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
          />
        </motion.div>
        
      </div>
    </motion.div>
  );
};

export default PartesStatistics;