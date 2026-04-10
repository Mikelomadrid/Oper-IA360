import React, { useMemo } from 'react';
import ElegantBarChart from '@/components/charts/ElegantBarChart';
import { BarChart2 } from 'lucide-react';

const COLORS = [
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
  '#64748b', // Slate
  '#6366f1', // Indigo
  '#d946ef'  // Fuchsia
];

const PartesOriginChart = ({ data, className }) => {
  // Prepare data format for ElegantBarChart
  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    
    // Process data to ensure it has valid values and sorted
    const processed = data
      .map((d, index) => ({
        name: d.name || 'Desconocido',
        value: Number(d.value) || 0,
        rawName: d.name,
        color: COLORS[index % COLORS.length]
      }))
      .sort((a, b) => b.value - a.value); // Sort descending

    return processed;
  }, [data]);

  return (
    // Height constrained to prevent layout shifts
    <div className={`w-full h-[400px] overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm ${className || ''}`}>
      <ElegantBarChart
        title="Origen Solicitud"
        icon={BarChart2}
        data={chartData}
        className="h-full w-full"
      />
    </div>
  );
};

export default PartesOriginChart;