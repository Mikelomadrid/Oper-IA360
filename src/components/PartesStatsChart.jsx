import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PieChart, Users, Filter, Info } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import ElegantDonutChart from '@/components/charts/ElegantDonutChart';
import ElegantBarChart from '@/components/charts/ElegantBarChart';
import { getStatusColor, getStatusLabel, getStatusTextColor } from '@/utils/statusColors';

const ORIGIN_COLORS = ['#8b5cf6', '#ec4899', '#06b6d4', '#eab308', '#64748b'];

const PartesStatsChart = ({ 
  statusData = [], 
  originData = [], 
  totalPartes = 0,
  onFilterStatus,
  onFilterOrigin,
  activeStatusFilter,
  activeOriginFilter
}) => {
  
  // Transform Data for ElegantCharts
  const chartStatusData = useMemo(() => {
    return statusData.map(item => ({
        name: getStatusLabel(item.name) || item.name,
        rawName: item.name,
        value: item.value,
        color: getStatusColor(item.name) || '#94a3b8'
    }));
  }, [statusData]);

  const chartOriginData = useMemo(() => {
    return originData.map((item, index) => ({
        name: item.name,
        rawName: item.name,
        value: item.value,
        color: ORIGIN_COLORS[index % ORIGIN_COLORS.length]
    }));
  }, [originData]);

  return (
    <Card className="shadow-sm border border-border/60 overflow-hidden bg-card mb-6">
      <div className="p-5 border-b border-border/40 bg-muted/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
            <PieChart className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-foreground tracking-tight">Estadísticas de Partes</h3>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Incluye partes activos y archivados (históricos).</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Análisis global de estado y procedencia.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           {(activeStatusFilter !== 'all' || activeOriginFilter !== 'all') && (
              <button 
                onClick={() => {
                    if(onFilterStatus) onFilterStatus('all');
                    if(onFilterOrigin) onFilterOrigin('all');
                }}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
              >
                <Filter className="w-3 h-3" /> Limpiar filtros
              </button>
           )}
           <div className="px-4 py-1.5 rounded-full border border-border bg-background shadow-sm">
              <span className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                {totalPartes} <span className="text-muted-foreground font-normal">Total Global</span>
              </span>
           </div>
        </div>
      </div>

      <CardContent className="p-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border/40">
          
          {/* Status Chart using ElegantDonutChart */}
          <div className="p-4 flex flex-col items-center min-h-[350px]">
             {statusData.length > 0 ? (
                <ElegantDonutChart 
                    title="Por Estado (Todos)"
                    data={chartStatusData}
                    centerLabel={{ value: totalPartes, label: 'Global' }}
                    activeKey={activeStatusFilter !== 'all' ? getStatusLabel(activeStatusFilter) : null}
                    onSectionClick={(data) => onFilterStatus && onFilterStatus(data.rawName)}
                    className="border-0 shadow-none bg-transparent"
                />
             ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Sin datos
                </div>
             )}
          </div>

          {/* Origin Chart using ElegantDonutChart */}
          <div className="p-4 flex flex-col items-center min-h-[350px]">
             {originData.length > 0 ? (
                <ElegantDonutChart 
                    title="Por Origen"
                    data={chartOriginData}
                    centerLabel={{ value: totalPartes, label: 'Total' }}
                    activeKey={activeOriginFilter !== 'all' ? activeOriginFilter : null}
                    onSectionClick={(data) => onFilterOrigin && onFilterOrigin(data.rawName)}
                    className="border-0 shadow-none bg-transparent"
                />
             ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Sin datos
                </div>
             )}
          </div>

          {/* Detailed Breakdown List */}
          <div className="p-6 flex flex-col bg-muted/5">
            <h4 className="text-xs font-bold text-foreground mb-4 flex items-center justify-between uppercase tracking-wider">
              <span>Desglose de Estados</span>
            </h4>
            <ScrollArea className="h-[300px] w-full pr-4">
              <div className="space-y-3">
                {statusData.length > 0 ? (
                  statusData.map((item) => {
                    const color = getStatusColor(item.name) || '#94a3b8';
                    const label = getStatusLabel(item.name);
                    const isActive = activeStatusFilter === 'all' || activeStatusFilter === item.name;
                    const percent = totalPartes > 0 ? ((item.value / totalPartes) * 100).toFixed(1) : 0;
                    const textColor = getStatusTextColor(item.name) || '#ffffff';
                    
                    return (
                      <motion.div 
                        key={item.name}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => onFilterStatus && onFilterStatus(item.name)}
                        className={cn(
                          "flex items-center justify-between group cursor-pointer p-2.5 rounded-lg transition-all border border-transparent",
                          isActive ? "bg-white dark:bg-slate-800 shadow-sm border-border" : "opacity-50 hover:opacity-100 hover:bg-white/50 dark:hover:bg-slate-800/50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded-full shadow-sm ring-2 ring-transparent group-hover:ring-offset-1 transition-all"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-sm font-medium text-foreground/90 capitalize">
                            {label}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-foreground">{item.value}</div>
                          <div className="text-[10px] text-muted-foreground font-medium">
                            {percent}%
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-10">No hay datos disponibles</p>
                )}
              </div>
            </ScrollArea>
          </div>

        </div>
      </CardContent>
    </Card>
  );
};

export default PartesStatsChart;