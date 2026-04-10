import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ReactECharts from 'echarts-for-react';
import { PieChart, BarChart3 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

// Color map uses strict lowercase keys matching database constraints
const STATUS_COLORS = {
  contactado: '#3b82f6', // blue-500
  agendada_visita: '#6366f1', // indigo-500
  visitado: '#a855f7', // purple-500
  en_preparacion: '#f59e0b', // amber-500
  presupuestado: '#f97316', // orange-500
  aceptado: '#10b981', // emerald-500 (green)
  default: '#cbd5e1'
};

const PRIORITY_COLORS = {
  baja: '#94a3b8', // slate-400
  media: '#f97316', // orange-500
  alta: '#ef4444', // red-500
  default: '#cbd5e1'
};

const PartesStatisticsFinca = ({ partes = [] }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const statusData = useMemo(() => {
    const counts = {};
    partes.forEach(p => {
      const s = p.estado ? p.estado.toLowerCase() : 'desconocido';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({
      name: key.replace(/_/g, ' ').toUpperCase(),
      value: counts[key],
      rawName: key
    })).sort((a, b) => b.value - a.value);
  }, [partes]);

  const priorityData = useMemo(() => {
    const counts = {};
    partes.forEach(p => {
      const pr = p.prioridad || 'desconocido';
      counts[pr] = (counts[pr] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({
      name: key.toUpperCase(),
      value: counts[key],
      rawName: key
    })).sort((a, b) => b.value - a.value);
  }, [partes]);

  const getPieOption = (title, data, colorMap) => {
    const textColor = isDark ? '#e5e7eb' : '#374151';
    
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          return `<div class="font-semibold capitalize">${params.name}</div>
                  <div>${params.value} partes (${params.percent}%)</div>`;
        },
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        textStyle: { color: textColor }
      },
      legend: {
        orient: 'horizontal',
        bottom: '0',
        textStyle: { color: isDark ? '#9ca3af' : '#4b5563' },
        itemWidth: 10,
        itemHeight: 10
      },
      series: [
        {
          name: title,
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 5,
            borderColor: isDark ? '#020817' : '#fff',
            borderWidth: 2
          },
          label: { show: false },
          emphasis: {
            label: {
              show: true,
              fontSize: 12,
              fontWeight: 'bold',
              color: textColor
            },
            scale: true,
            scaleSize: 5
          },
          data: data.map(d => ({
            ...d,
            itemStyle: { color: colorMap[d.rawName] || colorMap.default }
          }))
        }
      ]
    };
  };

  if (!partes || partes.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4 duration-500 mb-6">
      {/* Chart: Estado */}
      <Card className="shadow-sm border-l-4 border-l-blue-500">
        <CardHeader className="pb-2 border-b bg-muted/10">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-2"><PieChart className="h-4 w-4" /> Distribución por Estado</span>
            <span className="text-xs bg-background px-2 py-1 rounded-full border">{partes.length} Total</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="h-[250px] w-full">
            <ReactECharts 
              option={getPieOption('Estado', statusData, STATUS_COLORS)} 
              style={{ height: '100%', width: '100%' }}
              theme={isDark ? 'dark' : 'light'}
              notMerge={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Chart: Prioridad */}
      <Card className="shadow-sm border-l-4 border-l-orange-500">
        <CardHeader className="pb-2 border-b bg-muted/10">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Distribución por Prioridad</span>
            <span className="text-xs bg-background px-2 py-1 rounded-full border">
               {priorityData.find(p => p.rawName === 'alta')?.value || 0} Alta
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="h-[250px] w-full">
            <ReactECharts 
              option={getPieOption('Prioridad', priorityData, PRIORITY_COLORS)} 
              style={{ height: '100%', width: '100%' }}
              theme={isDark ? 'dark' : 'light'}
              notMerge={true}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PartesStatisticsFinca;