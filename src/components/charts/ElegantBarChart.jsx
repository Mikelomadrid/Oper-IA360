import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const ElegantBarChart = ({ 
  title, 
  data = [], 
  icon: Icon,
  className,
  activeKey,
  onBarClick
}) => {
  // Create a stable key based on data values to force Recharts animation on data change
  const chartKey = useMemo(() => 
    `bar-${data.length}-${JSON.stringify(data.map(d => ({ n: d.name, v: d.value })))}`, 
  [data]);

  return (
    <Card className={cn("flex flex-col shadow-sm hover:shadow-md transition-all duration-300 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden h-full", className)}>
      <CardHeader className="pb-2 pt-5 px-5 border-b border-slate-100 dark:border-slate-800/50">
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
      <CardContent className="flex-1 p-4 min-h-[300px]">
        {/* Key on ResponsiveContainer forces full remount on data change to ensure animation plays */}
        <ResponsiveContainer width="100%" height="100%" key={chartKey}>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
            barSize={12}
          >
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={100}
              tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.03)' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-slate-900 text-white text-xs rounded py-1 px-2 shadow-lg">
                      <span className="font-bold">{payload[0].payload.name}:</span> {payload[0].value}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar 
                dataKey="value" 
                radius={[0, 4, 4, 0]} 
                onClick={onBarClick}
                className="cursor-pointer"
                isAnimationActive={true}
                animationDuration={1000}
                animationBegin={0}
                animationEasing="ease-in-out"
            >
              {data.map((entry, index) => (
                <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color || '#6366f1'} 
                    style={{
                        opacity: activeKey && entry.name !== activeKey ? 0.3 : 1,
                        transition: 'opacity 0.3s ease',
                        outline: 'none'
                    }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ElegantBarChart;