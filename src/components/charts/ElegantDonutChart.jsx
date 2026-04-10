import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const ElegantDonutChart = ({ 
  title, 
  data = [], 
  centerLabel, 
  icon: Icon,
  className,
  activeKey, 
  onSectionClick
}) => {
  // Memoize chart data to handle opacity changes for active/inactive segments
  const chartData = useMemo(() => {
    return data.map(item => ({
      ...item,
      // Dim non-active items if an activeKey is set
      opacity: activeKey && item.name.toLowerCase() !== activeKey.toLowerCase() ? 0.3 : 1
    }));
  }, [data, activeKey]);

  const totalValue = useMemo(() => data.reduce((acc, curr) => acc + curr.value, 0), [data]);

  // Create a stable key for Recharts to force re-mount/animation only when REAL data changes.
  // We exclude activeKey/opacity from this key to allow smooth CSS transitions for highlighting
  // without re-drawing the whole chart from 0.
  const chartKey = useMemo(() => 
    `donut-${data.length}-${JSON.stringify(data.map(d => ({ n: d.name, v: d.value })))}`, 
  [data]);

  // Center Text Configuration
  const CenterText = ({ viewBox }) => {
    const { cx, cy } = viewBox;
    return (
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
        <tspan x={cx} dy="-0.5em" className="text-3xl font-black fill-slate-900 dark:fill-white">
          {centerLabel?.value || totalValue}
        </tspan>
        <tspan x={cx} dy="1.5em" className="text-xs font-medium uppercase tracking-widest fill-slate-500 dark:fill-slate-400">
          {centerLabel?.label || 'Total'}
        </tspan>
      </text>
    );
  };

  return (
    <Card className={cn("flex flex-col shadow-sm hover:shadow-md transition-all duration-300 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden h-full", className)}>
      <CardHeader className="pb-2 pt-5 px-5">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
              <Icon className="w-4 h-4" />
            </div>
          )}
          <CardTitle className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            {title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-[300px] flex flex-col items-center justify-center p-0 pb-6 relative">
        <div className="w-full h-[220px] relative z-10">
          {/* Key on ResponsiveContainer forces full remount on data change to ensure animation plays */}
          <ResponsiveContainer width="100%" height="100%" key={chartKey}>
            <PieChart>
              <Tooltip 
                cursor={false}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white text-xs rounded-lg py-1 px-3 shadow-xl border-0">
                        <span className="font-bold">{d.name}:</span> {d.value}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={85}
                cornerRadius={5}
                paddingAngle={2}
                onClick={onSectionClick ? (d) => onSectionClick(d) : undefined}
                className="cursor-pointer focus:outline-none"
                isAnimationActive={true}
                animationDuration={1000}
                animationBegin={0}
                animationEasing="ease-in-out"
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color} 
                    stroke="transparent"
                    style={{ 
                        opacity: entry.opacity,
                        transition: 'opacity 0.3s ease',
                        filter: activeKey && entry.name.toLowerCase() === activeKey.toLowerCase() ? 'drop-shadow(0px 0px 6px rgba(0,0,0,0.2))' : 'none',
                        outline: 'none'
                    }}
                  />
                ))}
                <Label content={<CenterText />} position="center" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Custom Legend */}
        <div className="w-full px-6 mt-2">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            {chartData.slice(0, 8).map((entry, i) => (
              <div 
                key={i} 
                className={cn(
                    "flex items-center gap-1.5 text-[10px] font-medium text-slate-600 dark:text-slate-400 cursor-pointer hover:opacity-80 transition-opacity",
                    activeKey && entry.name.toLowerCase() !== activeKey.toLowerCase() && "opacity-40 grayscale"
                )}
                onClick={() => onSectionClick && onSectionClick(entry)}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span>{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ElegantDonutChart;